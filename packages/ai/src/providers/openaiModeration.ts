import OpenAI from "openai";

/**
 * Image moderation (safety.ts Layer 4). Runs a generated coloring page
 * through OpenAI's multimodal moderation endpoint before it can reach a
 * child. This is the safety net for the premium free-text "about your child"
 * field, whose traits steer the (model-written) illustration prompt: even if
 * something slips the input screen and the story-text review, the rendered
 * image itself is checked here.
 *
 * The caller decides policy; a flagged image should fall back to the safe
 * procedural art. Errors propagate — the caller treats them as fail-closed.
 */

const DEFAULT_MODERATION_MODEL = "omni-moderation-latest";

export interface OpenAIModerationOptions {
  model?: string;
  client?: OpenAI;
}

export interface ImageModerationResult {
  flagged: boolean;
  categories: string[]; // names of the categories that tripped, for logging
}

export function openaiImageModerator(opts: OpenAIModerationOptions = {}) {
  const client = opts.client ?? new OpenAI();
  const model = opts.model ?? process.env.MODERATION_MODEL ?? DEFAULT_MODERATION_MODEL;
  return {
    name: `openai:${model}`,
    async check(pngBase64: string): Promise<ImageModerationResult> {
      const response = await client.moderations.create({
        model,
        input: [{ type: "image_url", image_url: { url: `data:image/png;base64,${pngBase64}` } }],
      });
      const result = response.results[0];
      const categories = result
        ? Object.entries(result.categories)
            .filter(([, tripped]) => tripped)
            .map(([name]) => name)
        : [];
      return { flagged: Boolean(result?.flagged), categories };
    },
  };
}
