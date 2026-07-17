/**
 * Generation pipeline as Inngest background jobs (Plan, Week 3).
 *
 *   story/requested ─▶ generateStory ─▶ page.n fan-out ─▶ generateIllustration
 *                                     └▶ safetyCheck ─▶ READY | SAFETY_REVIEW
 *
 * NOTE (Decision #5 + v1.2 note): model IDs below are placeholders —
 * run the Week 3 model bake-off and pin winners in one place here.
 */

import { Inngest } from "inngest";
import { type StoryRequest } from "./schemas.ts";
import { buildIllustrationPrompt } from "./prompts/illustration.ts";
import { screenStoryText } from "./safety.ts";
import { anthropicStoryModel } from "./providers/anthropic.ts";
import { openaiImageModel } from "./providers/openaiImage.ts";

export const inngest = new Inngest({ id: "julias-magical-world" });

/**
 * Provider defaults; pin bake-off winners via env (STORY_MODEL /
 * ILLUSTRATION_MODEL / REVIEW_MODEL). Run scripts/bakeoff.mjs to compare
 * candidates on schema validity, safety, cost, and fill-friendliness.
 */
export const MODELS = {
  story: process.env.STORY_MODEL ?? "claude-opus-4-8",
  illustration: process.env.ILLUSTRATION_MODEL ?? "gpt-image-1",
  review: process.env.REVIEW_MODEL ?? "claude-opus-4-8",
} as const;

export const generateStory = inngest.createFunction(
  { id: "generate-story", retries: 2, concurrency: { limit: 10 } },
  { event: "story/requested" },
  async ({ event, step }) => {
    const req = event.data as StoryRequest & { storyId: string };

    // 1. Story text (structured outputs, zod-validated — invalid output retries)
    const story = await step.run("llm-story", async () =>
      anthropicStoryModel({ model: MODELS.story }).generate(req),
    );

    // 2. Text safety screen — fail CLOSED into human review
    const screen = screenStoryText(story.pages.map((p) => p.text).join("\n"));
    if (!screen.ok) {
      await step.run("flag-for-review", () => flagStory(req.storyId, screen.hits));
      return { status: "SAFETY_REVIEW" };
    }

    // 3. Fan out one illustration job per page (parallel, independent retry)
    await Promise.all(
      story.pages.map((page) =>
        step.sendEvent(`page-${page.pageNumber}`, {
          name: "story/page.illustrate",
          data: {
            storyId: req.storyId,
            pageNumber: page.pageNumber,
            prompt: buildIllustrationPrompt(page.illustrationPrompt, req.style),
          },
        }),
      ),
    );

    await step.run("persist-text", () => persistStoryText(req.storyId, story));
    return { status: "GENERATING", pages: story.pages.length };
  },
);

export const generateIllustration = inngest.createFunction(
  { id: "generate-illustration", retries: 3, concurrency: { limit: 20 } },
  { event: "story/page.illustrate" },
  async ({ event, step }) => {
    const { storyId, pageNumber, prompt } = event.data;

    const imageUrl = await step.run("image-gen", () => callImageModel(prompt));
    // Image moderation + line-art quality gate happen here before publish:
    //   1. provider moderation API on the image
    //   2. fill-friendliness probe (see LINE_ART_QUALITY) — bad line art
    //      regenerates once, then falls back to a curated template page
    await step.run("persist-page-art", () => persistPageArt(storyId, pageNumber, imageUrl));
    return { storyId, pageNumber };
  },
);

// ---- Provider adapters -----------------------------------------------------
async function callImageModel(prompt: string): Promise<string> {
  const image = await openaiImageModel({ model: MODELS.illustration }).generateLineArt(prompt);
  return `data:image/png;base64,${image.pngBase64}`;
}
async function persistStoryText(storyId: string, story: unknown): Promise<void> {
  throw new Error("Wire to Prisma");
}
async function persistPageArt(storyId: string, pageNumber: number, url: string): Promise<void> {
  throw new Error("Wire to Prisma + Supabase Storage");
}
async function flagStory(storyId: string, hits: string[]): Promise<void> {
  throw new Error("Wire to AuditLog");
}
