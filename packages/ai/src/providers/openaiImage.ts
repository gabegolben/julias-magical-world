import OpenAI from "openai";
import type { GeneratedImage, ImageModel } from "./types.ts";

/**
 * OpenAI image adapter (line-art generation). Anthropic has no image model,
 * so illustration stays a second provider by necessity — exactly the hybrid
 * strategy from Overview Decision #5. Candidates for the bake-off:
 * gpt-image-1 (returns base64 natively) and dall-e-3 (needs response_format).
 */

const DEFAULT_IMAGE_MODEL = "gpt-image-1";

export interface OpenAIImageOptions {
  model?: string;
  client?: OpenAI;
}

export function openaiImageModel(opts: OpenAIImageOptions = {}): ImageModel {
  const client = opts.client ?? new OpenAI();
  const model = opts.model ?? process.env.ILLUSTRATION_MODEL ?? DEFAULT_IMAGE_MODEL;
  return {
    name: `openai:${model}`,
    async generateLineArt(prompt: string): Promise<GeneratedImage> {
      const response = await client.images.generate({
        model,
        prompt,
        size: "1024x1024",
        n: 1,
        // dall-e-* defaults to URLs; gpt-image-* is base64-only and rejects the param.
        ...(model.startsWith("dall-e") ? { response_format: "b64_json" as const } : {}),
      });
      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error(`Image model ${model} returned no base64 payload`);
      return { pngBase64: b64 };
    },
  };
}
