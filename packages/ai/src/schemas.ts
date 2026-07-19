// zod/v4: the API surface the Anthropic SDK's zodOutputFormat helper expects.
import { z } from "zod/v4";

/**
 * The structured story contract. The LLM must return exactly this shape;
 * anything that fails parsing is rejected and retried (never shown to a child).
 */
export const StoryPageSchema = z.object({
  pageNumber: z.number().int().min(1),
  text: z.string().min(1).max(400),
  illustrationPrompt: z.string().min(10).max(600),
  paletteHint: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(6).optional(),
});

export const GeneratedStorySchema = z.object({
  title: z.string().min(1).max(80),
  pages: z.array(StoryPageSchema).min(3).max(20),
});

export type GeneratedStory = z.infer<typeof GeneratedStorySchema>;

export const AgeBandSchema = z.enum(["EARLY_EXPLORER", "STORY_BUILDER", "YOUNG_CREATOR"]);
export type AgeBand = z.infer<typeof AgeBandSchema>;

export const LanguageSchema = z.enum(["en", "pt-BR", "es"]);
export type Language = z.infer<typeof LanguageSchema>;

export const ChildGenderSchema = z.enum(["boy", "girl"]);
export type ChildGender = z.infer<typeof ChildGenderSchema>;

/** Template-only input for ages 3-5: no free text = no injection surface. */
export const StoryRequestSchema = z.object({
  childId: z.string().uuid(),
  ageBand: AgeBandSchema,
  language: LanguageSchema,
  characterKey: z.enum(["unicorn", "dinosaur", "princess", "robot", "puppy"]),
  settingKey: z.enum(["beach", "forest", "castle", "space", "farm"]),
  style: z.enum(["STORYBOOK_CLASSIC", "CARTOON_BOLD", "WATERCOLOR_SOFT", "MANGA_SKETCH"]),
  childName: z.string().max(30).regex(/^[\p{L} \-']*$/u).optional(), // letters only — parent-entered
  childGender: ChildGenderSchema.optional(), // optional; refines hero pronouns + illustration
});
export type StoryRequest = z.infer<typeof StoryRequestSchema>;
