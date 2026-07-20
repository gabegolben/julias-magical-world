import { getSupabase } from "./supabase";
import type { CharacterKey, SettingKey } from "./stories";

/**
 * Client for /api/generate. Returns null in every situation where AI
 * generation isn't available — signed out, static mirror (no API), server
 * error, safety hold — and the caller falls back to the template engine.
 * The child always gets a story.
 */
/**
 * Static builds (GitHub Pages) have no local API — NEXT_PUBLIC_AI_API_URL is
 * baked in at build time to point at the Vercel deployment (CORS-enabled).
 * Server builds leave it unset and call the same-origin route.
 */
const API_BASE = process.env.NEXT_PUBLIC_AI_API_URL ?? "";

function fallback(reason: string): null {
  // Visible in the browser console — the fast way to see why a story came
  // from templates instead of the AI service.
  console.info(`[jmw] template fallback: ${reason}`);
  return null;
}

/**
 * The signed-in parent's plan, read from their own profiles row (RLS lets a
 * user read only their own). Drives premium-only UI. Defaults to "free" when
 * signed out, unconfigured, or on any error — the server re-derives the tier
 * anyway, so this only decides what the UI offers.
 */
export async function getPlan(): Promise<"free" | "premium"> {
  try {
    const supabase = getSupabase();
    if (!supabase) return "free";
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return "free";
    const { data } = await supabase.from("profiles").select("plan").maybeSingle();
    return data?.plan === "premium" ? "premium" : "free";
  } catch {
    return "free";
  }
}

export async function generateAiStory(params: {
  characterKey: CharacterKey;
  settingKey: SettingKey;
  language: string;
  childName?: string;
  childGender?: "boy" | "girl";
  childTraits?: string;
}): Promise<{ title: string; pagesText: string[]; pageArt: (string | null)[] } | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return fallback("supabase not configured in this build");
    const { data } = await supabase.auth.getSession();
    if (!data.session) return fallback("no parent signed in on this device/domain");

    const controller = new AbortController();
    // Generous: story + per-page image generation with a retry can take a
    // while. Stays under the route's maxDuration (120s) with headroom.
    const timer = setTimeout(() => controller.abort(), 115_000);
    // Trailing slash required: trailingSlash:true 308s the bare path, and
    // browsers reject any redirect on a CORS preflight.
    const response = await fetch(`${API_BASE}/api/generate/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({
        characterKey: params.characterKey,
        settingKey: params.settingKey,
        language: params.language,
        ...(params.childName ? { childName: params.childName } : {}),
        ...(params.childGender ? { childGender: params.childGender } : {}),
        ...(params.childTraits ? { childTraits: params.childTraits } : {}),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return fallback(`API responded ${response.status}: ${body.slice(0, 200)}`);
    }
    const json = (await response.json()) as {
      status: string;
      story?: { title: string; pages: { text: string; artUrl?: string | null }[] };
    };
    if (json.status !== "READY" || !json.story) return fallback(`status ${json.status}`);
    return {
      title: json.story.title,
      pagesText: json.story.pages.map((p) => p.text),
      pageArt: json.story.pages.map((p) => p.artUrl ?? null),
    };
  } catch (err) {
    return fallback(`request failed (offline/static/timeout): ${String(err)}`);
  }
}
