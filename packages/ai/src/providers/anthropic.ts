import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GeneratedStorySchema, type StoryRequest } from "../schemas.ts";
import { buildStorySystemPrompt, buildStoryUserPrompt } from "../prompts/story.ts";
import { REVIEW_SYSTEM_PROMPT } from "../safety.ts";
import type { StoryModel, StoryReviewer } from "./types.ts";

/**
 * Anthropic adapters. Structured outputs (`messages.parse` + zod) guarantee
 * the story matches GeneratedStorySchema — unparseable output throws and the
 * pipeline retries. Model choice is pinned via env after the bake-off
 * (scripts/bakeoff.mjs); until then the default is claude-opus-4-8.
 */

const DEFAULT_STORY_MODEL = "claude-opus-4-8";

export interface AnthropicOptions {
  model?: string;
  client?: Anthropic;
}

export function anthropicStoryModel(opts: AnthropicOptions = {}): StoryModel {
  const client = opts.client ?? new Anthropic();
  const model = opts.model ?? process.env.STORY_MODEL ?? DEFAULT_STORY_MODEL;
  return {
    name: `anthropic:${model}`,
    async generate(req: StoryRequest) {
      const response = await client.messages.parse({
        model,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: buildStorySystemPrompt(req),
        messages: [{ role: "user", content: buildStoryUserPrompt(req) }],
        output_config: { format: zodOutputFormat(GeneratedStorySchema) },
      });
      if (response.stop_reason === "refusal") {
        throw new Error("Story model refused the request");
      }
      if (!response.parsed_output) {
        throw new Error("Story output failed schema validation");
      }
      return response.parsed_output;
    },
  };
}

export function anthropicReviewer(opts: AnthropicOptions = {}): StoryReviewer {
  const client = opts.client ?? new Anthropic();
  const model = opts.model ?? process.env.REVIEW_MODEL ?? DEFAULT_STORY_MODEL;
  return {
    name: `anthropic:${model}`,
    async review(storyText: string) {
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        system: REVIEW_SYSTEM_PROMPT,
        messages: [{ role: "user", content: storyText }],
      });
      const block = response.content.find((b) => b.type === "text");
      // Fail closed: only an unambiguous PASS publishes.
      return block && block.text.trim().toUpperCase() === "PASS" ? "PASS" : "REVIEW";
    },
  };
}
