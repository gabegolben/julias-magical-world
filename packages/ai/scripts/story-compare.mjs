/**
 * Side-by-side story quality comparison: the SAME request against each
 * candidate model, with exact measured cost from response.usage.
 *
 *   node --experimental-strip-types --env-file-if-exists=../../.env scripts/story-compare.mjs
 *
 * Writes story-compare.json and prints the full stories.
 */

import { writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GeneratedStorySchema } from "../src/schemas.ts";
import { buildStorySystemPrompt, buildStoryUserPrompt } from "../src/prompts/story.ts";

const MODELS = ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"];
// $/MTok [input, output] — list prices; Sonnet 5 has intro pricing ($2/$10) through 2026-08-31.
const PRICING = {
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5": [3, 15],
  "claude-haiku-4-5": [1, 5],
};
const supportsAdaptiveThinking = (m) => !/haiku-4-5|sonnet-4-5|opus-4-[0-5]|claude-3/.test(m);

// The canonical Julia request — same as the live demo's default.
const req = {
  childId: "00000000-0000-4000-8000-000000000042",
  ageBand: "EARLY_EXPLORER",
  language: "pt-BR",
  characterKey: "unicorn",
  settingKey: "beach",
  style: "CARTOON_BOLD",
  childName: "Julia",
};

const client = new Anthropic();
const out = [];

for (const model of MODELS) {
  const t0 = Date.now();
  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    ...(supportsAdaptiveThinking(model) ? { thinking: { type: "adaptive" } } : {}),
    system: buildStorySystemPrompt(req),
    messages: [{ role: "user", content: buildStoryUserPrompt(req) }],
    output_config: { format: zodOutputFormat(GeneratedStorySchema) },
  });
  const ms = Date.now() - t0;
  const { input_tokens, output_tokens } = response.usage;
  const [inRate, outRate] = PRICING[model];
  const cost = (input_tokens * inRate + output_tokens * outRate) / 1e6;
  const story = response.parsed_output;
  out.push({ model, ms, input_tokens, output_tokens, cost: +cost.toFixed(4), story });

  console.log(`\n===== ${model}  (${(ms / 1000).toFixed(1)}s · ${input_tokens} in / ${output_tokens} out · $${cost.toFixed(4)}) =====`);
  console.log(`TITLE: ${story.title}`);
  for (const page of story.pages) console.log(`  [${page.pageNumber}] ${page.text}`);
}

writeFileSync("story-compare.json", JSON.stringify(out, null, 2));
console.log("\nWrote story-compare.json");
