import { reviewModel, storyModelFor } from "../../../lib/modelEnv";

/**
 * Config health check: reports env PRESENCE only (never secret values).
 * force-static keeps the STATIC_EXPORT (GitHub Pages) build happy — the
 * response is baked at build time, which on Vercel is also when env vars
 * are applied, so the snapshot is always current for the running deploy.
 * Lives apart from /api/generate because force-static strips request
 * headers from every handler in its route file, which would break the
 * Authorization check on POST.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json({
    ok: true,
    anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    openaiKey: Boolean(process.env.OPENAI_API_KEY),
    // Present ⇒ the shared story cache can be seeded (server-only writes).
    cacheWrites: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    cacheVariants: process.env.STORY_CACHE_VARIANTS ?? "(unset → 3)",
    illustrationModel: process.env.ILLUSTRATION_MODEL ?? "(unset → gpt-image-1)",
    storyDailyLimit: process.env.STORY_DAILY_LIMIT ?? "(unset → 15)",
    imageDailyLimit: process.env.IMAGE_DAILY_LIMIT ?? "(unset → 40)",
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    storyModel: process.env.STORY_MODEL ?? "(unset)",
    effectiveStoryModel: storyModelFor("free"),
    reviewModel: process.env.REVIEW_MODEL ?? "(unset)",
    effectiveReviewModel: reviewModel(),
  });
}
