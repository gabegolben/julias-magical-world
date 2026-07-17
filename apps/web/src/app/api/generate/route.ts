import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  LanguageSchema,
  anthropicReviewer,
  anthropicStoryModel,
  mockImageModel,
  runStoryPipeline,
} from "@jmw/ai";
import { z } from "zod/v4";

/**
 * Real AI story generation (server mode only — absent from the GitHub Pages
 * static mirror, where the client falls back to template stories).
 *
 * v0 generates story TEXT; illustrations stay procedural client-side until
 * the image-storage phase (Supabase Storage) lands.
 *
 * Cost controls: requires a signed-in parent (Supabase JWT), template-only
 * inputs (zod enums — zero injection surface), and the fail-closed safety
 * pipeline. Model tiers: STORY_MODEL (default claude-haiku-4-5, per the
 * 2026-07-17 bake-off) and STORY_MODEL_PREMIUM for paid tiers later.
 */

export const maxDuration = 120;

const BodySchema = z.object({
  characterKey: z.enum(["unicorn", "dinosaur", "princess", "robot", "puppy"]),
  settingKey: z.enum(["beach", "forest", "castle", "space", "farm"]),
  language: LanguageSchema,
  childName: z.string().max(30).regex(/^[\p{L} \-']*$/u).optional(),
  tier: z.enum(["free", "premium"]).default("free"),
});

function storyModelFor(tier: "free" | "premium"): string {
  if (tier === "premium" && process.env.STORY_MODEL_PREMIUM) {
    return process.env.STORY_MODEL_PREMIUM;
  }
  return process.env.STORY_MODEL ?? "claude-haiku-4-5";
}

export async function POST(request: Request): Promise<Response> {
  // 1. Auth: a verified parent account is the gate on AI spend.
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return Response.json({ error: "auth required" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "auth required" }, { status: 401 });

  // 2. Validate template-only input.
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });
  const body = parsed.data;

  // 3. Run the pipeline (text only; fail-closed safety inside).
  try {
    const result = await runStoryPipeline(
      {
        childId: randomUUID(), // child profiles arrive with the full schema phase
        ageBand: "EARLY_EXPLORER",
        language: body.language,
        characterKey: body.characterKey,
        settingKey: body.settingKey,
        style: "CARTOON_BOLD",
        ...(body.childName ? { childName: body.childName } : {}),
      },
      {
        story: anthropicStoryModel({ model: storyModelFor(body.tier) }),
        reviewer: anthropicReviewer(),
        image: mockImageModel(), // unused: generateImages=false
      },
      { generateImages: false },
    );

    if (result.status !== "READY") {
      // Held for review — the client falls back to a template story.
      return Response.json({ status: "SAFETY_REVIEW" }, { status: 200 });
    }
    return Response.json({
      status: "READY",
      story: {
        title: result.story.title,
        pages: result.story.pages.map((p) => ({ text: p.text })),
      },
    });
  } catch (err) {
    console.error("generate failed:", err);
    return Response.json({ error: "generation failed" }, { status: 502 });
  }
}
