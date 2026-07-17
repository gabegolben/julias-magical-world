/**
 * Week 3 model bake-off (Plan: "test 2-3 current LLMs for structured story
 * JSON and 2-3 image models for coloring-book line art. Lock choices.")
 *
 * Run from packages/ai:
 *   node --experimental-strip-types scripts/bakeoff.mjs [--stories N]
 *
 * Requires ANTHROPIC_API_KEY for the story bake-off and OPENAI_API_KEY for
 * the image bake-off; each half skips gracefully when its key is absent.
 * Results print as a table and are written to bakeoff-results.json.
 *
 * Scoring:
 *   Story models — schema-valid rate (structured outputs make hard failures
 *   rare; we count retries/refusals), keyword-screen pass rate, page-count
 *   compliance, latency, token usage, estimated $/story.
 *   Image models — the magic-fill quality gate (assessLineArt): line-density
 *   ratio + fill-containment probe ratio, i.e. "will tap-to-fill work on it".
 */

import { writeFileSync } from "node:fs";
import { anthropicStoryModel } from "../src/providers/anthropic.ts";
import { openaiImageModel } from "../src/providers/openaiImage.ts";
import { buildIllustrationPrompt } from "../src/prompts/illustration.ts";
import { screenStoryText } from "../src/safety.ts";
import { assessLineArt } from "../src/quality.ts";

// Filter candidates to avoid re-spending on models already measured:
//   --story-models claude-haiku-4-5   --image-models none
function listArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  const values = process.argv[i + 1].split(",").filter((v) => v && v !== "none");
  return values;
}
const STORY_MODELS = listArg("--story-models", ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"]);
const IMAGE_MODELS = listArg("--image-models", ["gpt-image-1", "dall-e-3"]);

// $/MTok (input, output) — verify against current pricing before deciding.
const PRICING = {
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5": [3, 15],
  "claude-haiku-4-5": [1, 5],
};

const SAMPLE_REQUESTS = [
  { ageBand: "EARLY_EXPLORER", language: "pt-BR", characterKey: "unicorn", settingKey: "beach", style: "CARTOON_BOLD", childName: "Julia", expectedPages: [4, 4] },
  { ageBand: "STORY_BUILDER", language: "en", characterKey: "robot", settingKey: "space", style: "STORYBOOK_CLASSIC", expectedPages: [8, 12] },
  { ageBand: "YOUNG_CREATOR", language: "es", characterKey: "dinosaur", settingKey: "castle", style: "MANGA_SKETCH", expectedPages: [10, 20] },
].map((r, i) => ({ ...r, childId: `00000000-0000-4000-8000-00000000000${i}` }));

const IMAGE_PROMPTS = [
  "A friendly unicorn building a sandcastle with a small child on a sunny beach, both smiling, a bucket and starfish nearby",
  "A round robot bouncing on the moon next to a smiling child in a space suit, Earth visible in the sky",
  "A gentle dinosaur and a child having a picnic in front of a castle with two towers and flags",
].map((p) => buildIllustrationPrompt(p, "CARTOON_BOLD"));

const results = { ranAt: new Date().toISOString(), story: [], image: [] };

async function storyBakeoff(perModel) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("⏭️  Story bake-off skipped — set ANTHROPIC_API_KEY to run it.");
    return;
  }
  for (const model of STORY_MODELS) {
    const provider = anthropicStoryModel({ model });
    const row = { model, attempts: 0, valid: 0, safe: 0, lengthOk: 0, totalMs: 0, estCost: 0, errors: [] };
    for (let i = 0; i < perModel; i++) {
      const req = SAMPLE_REQUESTS[i % SAMPLE_REQUESTS.length];
      row.attempts += 1;
      const t0 = Date.now();
      try {
        const story = await provider.generate(req);
        row.totalMs += Date.now() - t0;
        row.valid += 1;
        const text = `${story.title}\n${story.pages.map((p) => p.text).join("\n")}`;
        if (screenStoryText(text).ok) row.safe += 1;
        const [lo, hi] = req.expectedPages;
        if (story.pages.length >= lo && story.pages.length <= hi) row.lengthOk += 1;
        // Rough cost from typical prompt/response sizes when usage isn't piped
        // through; refine by logging response.usage in the provider if needed.
        const [inRate, outRate] = PRICING[model];
        row.estCost += (2000 * inRate + 3000 * outRate) / 1e6;
      } catch (err) {
        row.totalMs += Date.now() - t0;
        row.errors.push(String(err).slice(0, 120));
      }
    }
    row.avgMs = Math.round(row.totalMs / Math.max(row.attempts, 1));
    row.estCostPerStory = +(row.estCost / Math.max(row.valid, 1)).toFixed(4);
    results.story.push(row);
    console.log(`📖 ${model}: valid ${row.valid}/${row.attempts}, safe ${row.safe}, length-ok ${row.lengthOk}, avg ${row.avgMs}ms, ~$${row.estCostPerStory}/story`);
    if (row.errors.length) console.log(`   errors: ${row.errors.join(" | ")}`);
  }
}

async function imageBakeoff() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("⏭️  Image bake-off skipped — set OPENAI_API_KEY to run it.");
    return;
  }
  const { PNG } = await import("pngjs");
  for (const model of IMAGE_MODELS) {
    const provider = openaiImageModel({ model });
    const row = { model, attempts: 0, passed: 0, avgContained: 0, avgLineRatio: 0, totalMs: 0, errors: [] };
    for (const prompt of IMAGE_PROMPTS) {
      row.attempts += 1;
      const t0 = Date.now();
      try {
        const image = await provider.generateLineArt(prompt);
        row.totalMs += Date.now() - t0;
        const png = PNG.sync.read(Buffer.from(image.pngBase64, "base64"));
        const assessment = assessLineArt(new Uint8ClampedArray(png.data), png.width, png.height);
        row.avgContained += assessment.containedProbeRatio;
        row.avgLineRatio += assessment.lineRatio;
        if (assessment.ok) row.passed += 1;
        console.log(`🖼️  ${model} [${row.attempts}]: ${assessment.ok ? "PASS" : "FAIL"} contained=${(assessment.containedProbeRatio * 100).toFixed(0)}% lines=${(assessment.lineRatio * 100).toFixed(1)}% ${assessment.reasons.join("; ")}`);
      } catch (err) {
        row.totalMs += Date.now() - t0;
        row.errors.push(String(err).slice(0, 120));
      }
    }
    const n = Math.max(row.attempts - row.errors.length, 1);
    row.avgContained = +(row.avgContained / n).toFixed(3);
    row.avgLineRatio = +(row.avgLineRatio / n).toFixed(3);
    row.avgMs = Math.round(row.totalMs / Math.max(row.attempts, 1));
    results.image.push(row);
    console.log(`🖼️  ${model}: fill-friendly ${row.passed}/${row.attempts}, avg contained ${(row.avgContained * 100).toFixed(0)}%, avg ${row.avgMs}ms`);
    if (row.errors.length) console.log(`   errors: ${row.errors.join(" | ")}`);
  }
}

const perModel = Number(process.argv[process.argv.indexOf("--stories") + 1]) || 3;
await storyBakeoff(perModel);
await imageBakeoff();
writeFileSync("bakeoff-results.json", JSON.stringify(results, null, 2));
console.log("\nWrote bakeoff-results.json — pin winners via STORY_MODEL / ILLUSTRATION_MODEL / REVIEW_MODEL.");
