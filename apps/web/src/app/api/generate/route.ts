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

// Static export (GitHub Pages) prerenders GET and drops POST/OPTIONS; without
// this the STATIC_EXPORT=1 build fails on this route. Server mode (Vercel)
// still runs POST dynamically — env is read at build there, which is when
// Vercel applies env anyway.
export const dynamic = "force-static";

/**
 * The GitHub Pages mirror calls this API cross-origin (NEXT_PUBLIC_AI_API_URL
 * baked into the static build): a parent signed in on the Pages domain holds
 * a Supabase JWT that is project-scoped, not origin-scoped, so it verifies
 * here fine — the browser just needs CORS consent for the preflight.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://gabegolben.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const BodySchema = z.object({
  characterKey: z.enum(["unicorn", "dinosaur", "princess", "robot", "puppy"]),
  settingKey: z.enum(["beach", "forest", "castle", "space", "farm"]),
  language: LanguageSchema,
  childName: z.string().max(30).regex(/^[\p{L} \-']*$/u).optional(),
  tier: z.enum(["free", "premium"]).default("free"),
});

/**
 * Model envs must be API ids ("claude-haiku-4-5"), but a display name like
 * "Haiku 4.5" is an easy dashboard mistake that 404s every request. Treat
 * anything that isn't a plausible id as unset so generation never breaks
 * on a misconfigured env var.
 */
function validModelId(id: string | undefined): string | null {
  return id && /^claude-[a-z0-9.-]+$/.test(id) ? id : null;
}

function storyModelFor(tier: "free" | "premium"): string {
  if (tier === "premium") {
    const premium = validModelId(process.env.STORY_MODEL_PREMIUM);
    if (premium) return premium;
  }
  return validModelId(process.env.STORY_MODEL) ?? "claude-haiku-4-5";
}

/** Health check: reports config PRESENCE only (never secret values). */
export function GET(): Response {
  return Response.json({
    ok: true,
    anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    storyModel: process.env.STORY_MODEL ?? "(unset)",
    effectiveStoryModel: storyModelFor("free"),
    reviewModel: process.env.REVIEW_MODEL ?? "(unset)",
    effectiveReviewModel: validModelId(process.env.REVIEW_MODEL) ?? "claude-opus-4-8 (default)",
  });
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  // 1. Auth: a verified parent account is the gate on AI spend.
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return json({ error: "auth required" }, 401);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return json({ error: "auth required" }, 401);

  // 2. Validate template-only input.
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid request" }, 400);
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
        // Explicit model so a bad REVIEW_MODEL env falls back instead of 404ing.
        reviewer: anthropicReviewer({ model: validModelId(process.env.REVIEW_MODEL) ?? "claude-opus-4-8" }),
        image: mockImageModel(), // unused: generateImages=false
      },
      { generateImages: false },
    );

    if (result.status !== "READY") {
      // Held for review — the client falls back to a template story.
      return json({ status: "SAFETY_REVIEW" });
    }
    return json({
      status: "READY",
      story: {
        title: result.story.title,
        pages: result.story.pages.map((p) => ({ text: p.text })),
      },
    });
  } catch (err) {
    console.error("generate failed:", err);
    return json({ error: "generation failed" }, 502);
  }
}
