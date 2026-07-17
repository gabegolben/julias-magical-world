import {
  StoryRequestSchema,
  type GeneratedStory,
  type StoryRequest,
} from "./schemas.ts";
import { buildIllustrationPrompt } from "./prompts/illustration.ts";
import { screenStoryText } from "./safety.ts";
import type { GeneratedImage, ImageModel, StoryModel, StoryReviewer } from "./providers/types.ts";

/**
 * The generation pipeline as one plain async function:
 *
 *   validate request → story (retry on bad output) → keyword screen
 *   → LLM review (fail CLOSED) → per-page line art (parallel)
 *
 * This is the unit the bake-off, the tests, and a future API route all call.
 * pipeline.ts wraps the same steps as Inngest jobs for the server phase.
 */

export interface PipelineProviders {
  story: StoryModel;
  image: ImageModel;
  reviewer: StoryReviewer;
}

export interface PipelineResult {
  status: "READY" | "SAFETY_REVIEW";
  story: GeneratedStory;
  /** Present only when READY; index-aligned with story.pages. */
  images?: GeneratedImage[];
  /** Why the story was held back (keyword hits, review outcome, errors). */
  flags: string[];
}

const STORY_ATTEMPTS = 3; // 1 try + 2 retries, mirroring the Inngest config

export async function runStoryPipeline(
  request: StoryRequest,
  providers: PipelineProviders,
): Promise<PipelineResult> {
  const req = StoryRequestSchema.parse(request);

  // 1. Story text — schema-invalid output throws inside the provider; retry.
  let story: GeneratedStory | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < STORY_ATTEMPTS && !story; attempt++) {
    try {
      story = await providers.story.generate(req);
    } catch (err) {
      lastError = err;
    }
  }
  if (!story) throw new Error(`Story generation failed after ${STORY_ATTEMPTS} attempts: ${String(lastError)}`);

  const fullText = `${story.title}\n${story.pages.map((p) => p.text).join("\n")}`;
  const flags: string[] = [];

  // 2. Keyword screen — fail closed into human review, never to a child.
  const screen = screenStoryText(fullText);
  if (!screen.ok) flags.push(...screen.hits.map((h) => `keyword:${h}`));

  // 3. LLM review — any error counts as REVIEW (fail closed).
  if (flags.length === 0) {
    try {
      const verdict = await providers.reviewer.review(fullText);
      if (verdict !== "PASS") flags.push("llm-review:REVIEW");
    } catch (err) {
      flags.push(`llm-review:error:${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (flags.length > 0) {
    return { status: "SAFETY_REVIEW", story, flags };
  }

  // 4. Illustrations — parallel, one per page.
  const images = await Promise.all(
    story.pages.map((page) =>
      providers.image.generateLineArt(buildIllustrationPrompt(page.illustrationPrompt, req.style)),
    ),
  );

  return { status: "READY", story, images, flags };
}
