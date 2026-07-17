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
      // No response_format: the current API rejects it; models return either
      // base64 (gpt-image-*) or a short-lived URL (dall-e-*) — handle both.
      const response = await client.images.generate({
        model,
        prompt,
        size: "1024x1024",
        n: 1,
      });
      const item = response.data?.[0];
      if (item?.b64_json) return { pngBase64: item.b64_json };
      if (item?.url) {
        const download = await fetch(item.url);
        if (!download.ok) throw new Error(`Image download failed: HTTP ${download.status}`);
        return { pngBase64: Buffer.from(await download.arrayBuffer()).toString("base64") };
      }
      throw new Error(`Image model ${model} returned no image payload`);
    },
  };
}
