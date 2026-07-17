import type { GeneratedStory, StoryRequest } from "../schemas.ts";

/**
 * Provider seams for the generation pipeline (Plan, Week 3).
 * Each provider owns its own prompting + parsing; the pipeline only sees
 * schema-valid stories and finished images. Swapping a bake-off winner in
 * means swapping one factory call.
 */

export interface StoryModel {
  readonly name: string;
  /** Must return a schema-valid story or throw (caller retries). */
  generate(req: StoryRequest): Promise<GeneratedStory>;
}

export interface GeneratedImage {
  /** Raster line art (PNG) — the normal provider output. */
  pngBase64?: string;
  /** Vector line art — used by the mock/procedural fallback. */
  svg?: string;
}

export interface ImageModel {
  readonly name: string;
  generateLineArt(prompt: string): Promise<GeneratedImage>;
}

export interface StoryReviewer {
  readonly name: string;
  /** LLM safety grade. Callers treat anything but "PASS" — or a throw — as REVIEW. */
  review(storyText: string): Promise<"PASS" | "REVIEW">;
}
