import type { GeneratedStory, StoryRequest } from "../schemas.ts";
import type { ImageModel, StoryModel, StoryReviewer } from "./types.ts";

/**
 * Deterministic mock providers: the whole pipeline runs end-to-end with zero
 * keys and zero network. Used by the test suite and as the offline fallback
 * strategy (the web demo's template engine is the user-facing equivalent).
 */

const PAGE_COUNT = { EARLY_EXPLORER: 4, STORY_BUILDER: 8, YOUNG_CREATOR: 10 } as const;

export interface MockStoryOptions {
  /** Inject a blocked word so tests can exercise the fail-closed path. */
  poison?: boolean;
  /** Return malformed output on the first N calls (tests retry behavior). */
  failFirst?: number;
}

export function mockStoryModel(opts: MockStoryOptions = {}): StoryModel {
  let failures = opts.failFirst ?? 0;
  return {
    name: "mock:story",
    async generate(req: StoryRequest): Promise<GeneratedStory> {
      if (failures > 0) {
        failures -= 1;
        throw new Error("mock schema failure");
      }
      const hero = req.childName?.trim() || "Alex";
      const pages = Array.from({ length: PAGE_COUNT[req.ageBand] }, (_, i) => ({
        pageNumber: i + 1,
        text:
          opts.poison && i === 1
            ? `${hero} found a weapon by the ${req.settingKey}.`
            : `${hero} and the ${req.characterKey} smiled at the ${req.settingKey}. Page ${i + 1}!`,
        illustrationPrompt: `A happy ${req.characterKey} with a child at the ${req.settingKey}, scene ${i + 1}, same character design as every other page`,
        paletteHint: ["#8AD4F0", "#74C98F"],
      }));
      return { title: `${hero} and the ${req.characterKey}`, pages };
    },
  };
}

/** 1000x760 white canvas with a chunky closed frame + circle — always fill-friendly. */
export function mockImageModel(): ImageModel {
  return {
    name: "mock:image",
    async generateLineArt(prompt: string) {
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="760" viewBox="0 0 1000 760">` +
        `<rect width="1000" height="760" fill="white"/>` +
        `<rect x="40" y="40" width="920" height="680" rx="30" fill="white" stroke="#1E1E28" stroke-width="12"/>` +
        `<circle cx="500" cy="380" r="180" fill="white" stroke="#1E1E28" stroke-width="12"/>` +
        `<title>${prompt.slice(0, 64).replace(/[<>&]/g, "")}</title></svg>`;
      return { svg };
    },
  };
}

export function mockReviewer(result: "PASS" | "REVIEW" | "THROW" = "PASS"): StoryReviewer {
  return {
    name: "mock:reviewer",
    async review() {
      if (result === "THROW") throw new Error("mock reviewer outage");
      return result;
    },
  };
}
