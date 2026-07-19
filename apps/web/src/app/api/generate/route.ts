import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  LanguageSchema,
  anthropicReviewer,
  anthropicStoryModel,
  assessPngLineArt,
  buildIllustrationPrompt,
  mockImageModel,
  openaiImageModel,
  runStoryPipeline,
  type GeneratedStory,
} from "@jmw/ai";
import { z } from "zod/v4";
import { reviewModel, storyModelFor } from "../../../lib/modelEnv";

/**
 * Real AI story generation (server mode only — absent from the GitHub Pages
 * static mirror, whose client calls this API cross-origin instead).
 *
 * Pipeline: Claude story text (fail-closed safety) → per-page OpenAI line
 * art gated by the magic-fill engine itself (regenerate once on a bad page,
 * then null = the client's procedural art takes over) → Supabase Storage.
 *
 * Cost controls: signed-in parent (Supabase JWT), template-only inputs (zod
 * enums — zero injection surface), and per-user daily caps counted from the
 * append-only ai_usage ledger (STORY_DAILY_LIMIT / IMAGE_DAILY_LIMIT).
 */

export const maxDuration = 120;

// No GET here and NO `dynamic = "force-static"`: non-GET-only routes are
// simply dropped from a STATIC_EXPORT build, while force-static would make
// Next strip request headers (killing Authorization) even for POST in
// server mode. The GET health check lives in /api/health for this reason.

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
  childGender: z.enum(["boy", "girl"]).optional(),
  tier: z.enum(["free", "premium"]).default("free"),
});

// v0 fixes these; they still key the cache so a future age/style expansion
// can't collide with entries generated under the old defaults.
const AGE_BAND = "EARLY_EXPLORER" as const;
const STYLE = "CARTOON_BOLD" as const;

/** One page as stored/returned: text + optional AI art URL. */
interface StoryPageOut {
  text: string;
  artUrl: string | null;
}
interface StoryOut {
  title: string;
  pages: StoryPageOut[];
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

const NAME_TOKEN = "{{name}}";
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replace the generated name with the {{name}} token for name-independent storage. */
function templatize(text: string, name: string | undefined): string {
  if (!name) return text;
  return text.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "g"), NAME_TOKEN);
}

/** Swap the requester's name back into a cached (templatized) story. */
function detemplatizeStory(story: StoryOut, name: string | undefined): StoryOut {
  const swap = (s: string) => (name ? s.split(NAME_TOKEN).join(name) : s);
  return { title: swap(story.title), pages: story.pages.map((p) => ({ text: swap(p.text), artUrl: p.artUrl })) };
}

/**
 * Cache key = everything that shapes the story EXCEPT the name, plus whether a
 * name was used at all (named stories cast the child as hero with a child
 * figure in the art; anonymous ones cast the character as hero — different
 * text AND different illustrations, so they must not share an entry).
 */
function cacheKeyFor(body: z.infer<typeof BodySchema>): string {
  return [
    AGE_BAND,
    STYLE,
    body.tier, // premium may use a better image model later — never share entries across tiers
    body.language,
    body.characterKey,
    body.settingKey,
    body.childGender ?? "none",
    body.childName ? "named" : "anon",
  ].join("|");
}

/**
 * Service-role client for the ONE privileged operation: seeding the shared
 * cache. Kept separate from the user-scoped `db` so client JWTs can never
 * write re-served content. Returns null when the key isn't configured — the
 * cache then simply never fills and every request generates fresh.
 */
function cacheWriter(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** All cached variants for a combination (read via the user's RLS-scoped client). */
async function readCacheVariants(db: SupabaseClient, cacheKey: string): Promise<StoryOut[]> {
  const { data, error } = await db
    .from("story_cache")
    .select("title, pages")
    .eq("cache_key", cacheKey)
    .limit(STORY_CACHE_VARIANTS);
  if (error) {
    console.warn("story_cache read failed (run migrations 0005/0006?):", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({ title: r.title as string, pages: r.pages as StoryPageOut[] }));
}

/** Add one variant to the shared cache (server-only, best-effort). */
async function writeCache(cacheKey: string, story: StoryOut, name: string | undefined): Promise<void> {
  const sr = cacheWriter();
  if (!sr) return; // no service role configured — caching disabled, generation already succeeded
  const row = {
    cache_key: cacheKey,
    title: templatize(story.title, name),
    pages: story.pages.map((p) => ({ text: templatize(p.text, name), artUrl: p.artUrl })),
  };
  const { error } = await sr.from("story_cache").insert(row);
  if (error) console.warn("story_cache write failed:", error.message);
}

function dailyLimit(envVar: string | undefined, fallback: number): number {
  const n = Number(envVar);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
const STORY_DAILY_LIMIT = dailyLimit(process.env.STORY_DAILY_LIMIT, 15);
const IMAGE_DAILY_LIMIT = dailyLimit(process.env.IMAGE_DAILY_LIMIT, 40);
// How many distinct stories to cache per combination before serving cached
// ones at random. Each combination generates fresh (and costs) until it holds
// this many variants; after that, requests are free random picks. 1 = the
// original single-entry cache.
const STORY_CACHE_VARIANTS = Math.max(1, dailyLimit(process.env.STORY_CACHE_VARIANTS, 3));

/**
 * Usage in the last 24h from the append-only ledger. Fails OPEN (returns 0)
 * so generation keeps working before migration 0004 exists or through a DB
 * blip — the auth gate still bounds who can spend at all.
 */
async function usedToday(db: SupabaseClient, kind: "story" | "image"): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await db
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .gte("created_at", since);
  if (error) {
    console.warn("ai_usage count failed (run migration 0004?):", error.message);
    return 0;
  }
  return count ?? 0;
}

async function recordUsage(db: SupabaseClient, kind: "story" | "image", n = 1): Promise<void> {
  if (n <= 0) return;
  const { error } = await db.from("ai_usage").insert(Array.from({ length: n }, () => ({ kind })));
  if (error) console.warn("ai_usage insert failed (run migration 0004?):", error.message);
}

/**
 * Line art for each page: generate → magic-fill quality gate → one retry →
 * upload to the public story-art bucket. Any failure yields null for that
 * page and the client falls back to procedural art — the child always gets
 * a colorable page. Returns public URLs index-aligned with pages.
 */
async function illustratePages(
  db: SupabaseClient,
  story: GeneratedStory,
  budget: number,
): Promise<{ artUrls: (string | null)[]; imagesGenerated: number }> {
  const image = openaiImageModel(); // ILLUSTRATION_MODEL env (bake-off: gpt-image-1-mini)
  const artDir = randomUUID(); // per-generation folder; unguessable, never overwritten
  let attempts = 0;

  const artUrls = await Promise.all(
    story.pages.map(async (page, i): Promise<string | null> => {
      if (i >= budget) return null; // daily image cap: remaining pages go procedural
      const prompt = buildIllustrationPrompt(page.illustrationPrompt, "CARTOON_BOLD");
      try {
        let png: string | undefined;
        for (let attempt = 0; attempt < 2 && !png; attempt++) {
          attempts += 1;
          const candidate = await image.generateLineArt(prompt);
          if (!candidate.pngBase64) break; // non-raster provider (mock/SVG) — skip
          const verdict = assessPngLineArt(candidate.pngBase64);
          if (verdict.ok) png = candidate.pngBase64;
          else console.warn(`page ${i + 1} art failed gate (attempt ${attempt + 1}):`, verdict.reasons);
        }
        if (!png) return null;

        const path = `${artDir}/${i + 1}.png`;
        const { error } = await db.storage
          .from("story-art")
          .upload(path, Buffer.from(png, "base64"), { contentType: "image/png" });
        if (error) {
          console.warn("story-art upload failed (run migration 0004?):", error.message);
          return null;
        }
        return db.storage.from("story-art").getPublicUrl(path).data.publicUrl;
      } catch (err) {
        console.warn(`page ${i + 1} illustration failed:`, err instanceof Error ? err.message : err);
        return null;
      }
    }),
  );

  return { artUrls, imagesGenerated: attempts };
}

export async function POST(request: Request): Promise<Response> {
  // 1. Auth: a verified parent account is the gate on AI spend.
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return json({ error: "auth required", reason: "no bearer token" }, 401);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    // Reason is Supabase's own validation message ("token is expired", …) —
    // it describes the token, never contains it, and is what the client
    // console needs to make a 401 diagnosable from the browser.
    return json({ error: "auth required", reason: error?.message ?? "no user for token" }, 401);
  }

  // All DB/storage access below acts AS this user: RLS owns authorization,
  // no service-role key exists in this deployment at all.
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  // 2. Validate template-only input.
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid request" }, 400);
  const body = parsed.data;

  // 3. Cache: once a combination holds STORY_CACHE_VARIANTS distinct stories,
  //    serve one at random for free (name swapped in) — no AI/image spend, no
  //    quota. Below that count we fall through and generate a new variant, so
  //    each combination accrues variety over its first few requests.
  const cacheKey = cacheKeyFor(body);
  const variants = await readCacheVariants(db, cacheKey);
  if (variants.length >= STORY_CACHE_VARIANTS) {
    const pick = variants[Math.floor(Math.random() * variants.length)];
    return json({
      status: "READY",
      cached: true,
      variants: variants.length,
      story: detemplatizeStory(pick, body.childName),
    });
  }

  // 4. Daily story cap — reserved BEFORE spending, so failed generations
  //    still count and a crash loop can't burn the budget.
  if ((await usedToday(db, "story")) >= STORY_DAILY_LIMIT) {
    return json({ error: "rate limited", reason: "daily story limit reached" }, 429);
  }
  await recordUsage(db, "story");

  // 5. Story text (fail-closed safety inside).
  try {
    const result = await runStoryPipeline(
      {
        childId: randomUUID(), // child profiles arrive with the full schema phase
        ageBand: AGE_BAND,
        language: body.language,
        characterKey: body.characterKey,
        settingKey: body.settingKey,
        style: STYLE,
        ...(body.childName ? { childName: body.childName } : {}),
        ...(body.childGender ? { childGender: body.childGender } : {}),
      },
      {
        story: anthropicStoryModel({ model: storyModelFor(body.tier) }),
        // Explicit model so a bad REVIEW_MODEL env falls back instead of 404ing.
        reviewer: anthropicReviewer({ model: reviewModel() }),
        image: mockImageModel(), // images handled below with gate + storage
      },
      { generateImages: false },
    );

    if (result.status !== "READY") {
      // Held for review — the client falls back to a template story.
      return json({ status: "SAFETY_REVIEW" });
    }

    // 6. Illustrations — skipped entirely (procedural art) when the key is
    //    absent or the daily image budget is spent. IMAGE_DAILY_LIMIT=0 is
    //    the kill switch.
    let artUrls: (string | null)[] = result.story.pages.map(() => null);
    if (process.env.OPENAI_API_KEY && IMAGE_DAILY_LIMIT > 0) {
      const budget = Math.max(0, IMAGE_DAILY_LIMIT - (await usedToday(db, "image")));
      if (budget > 0) {
        const outcome = await illustratePages(db, result.story, budget);
        artUrls = outcome.artUrls;
        await recordUsage(db, "image", outcome.imagesGenerated);
      }
    }

    const storyOut: StoryOut = {
      title: result.story.title,
      pages: result.story.pages.map((p, i) => ({ text: p.text, artUrl: artUrls[i] ?? null })),
    };

    // 7. Add this as a new variant (server-only, best-effort) so the
    //    combination fills toward STORY_CACHE_VARIANTS and future requests are
    //    served free at random.
    await writeCache(cacheKey, storyOut, body.childName);

    return json({ status: "READY", cached: false, variants: variants.length + 1, story: storyOut });
  } catch (err) {
    console.error("generate failed:", err);
    return json({ error: "generation failed" }, 502);
  }
}
