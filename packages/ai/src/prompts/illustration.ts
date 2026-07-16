import type { StoryRequest } from "../schemas.js";

/** Style suffixes appended to every illustration prompt (Decision #2). */
const STYLE_SUFFIX = {
  STORYBOOK_CLASSIC:
    "classic children's storybook line art, warm soft outlines, medium detail",
  CARTOON_BOLD:
    "very thick bold cartoon outlines, extra-large simple regions, minimal detail, perfect for toddler tap-to-fill coloring",
  WATERCOLOR_SOFT:
    "gentle flowing organic line work, soft rounded shapes, light detail",
  MANGA_SKETCH:
    "clean detailed manga-style line art, dynamic composition, fine detail",
} as const;

const BASE =
  "black and white coloring book page, crisp closed black outlines on pure white background, no shading, no grayscale fill, no text, no signature";

export function buildIllustrationPrompt(pagePrompt: string, style: StoryRequest["style"]): string {
  return `${pagePrompt}. ${BASE}, ${STYLE_SUFFIX[style]}`;
}

/**
 * Post-generation quality gate (Plan, Week 3 + Risk #1):
 * given the image as ImageData, verify it is fill-friendly before a child
 * ever sees it. Uses the magic-fill engine's own mask utilities.
 */
export const LINE_ART_QUALITY = {
  // Reject if <2% or >45% of pixels are line pixels (blank or too dense).
  minLineRatio: 0.02,
  maxLineRatio: 0.45,
  // After dilation r=2, probe a grid of interior seeds: at least 80% of
  // probes must produce contained fills (no border leaks).
  minContainedProbeRatio: 0.8,
} as const;
