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

export async function generateAiStory(params: {
  characterKey: CharacterKey;
  settingKey: SettingKey;
  language: string;
  childName?: string;
}): Promise<{ title: string; pagesText: string[] } | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return fallback("supabase not configured in this build");
    const { data } = await supabase.auth.getSession();
    if (!data.session) return fallback("no parent signed in on this device/domain");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
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
      story?: { title: string; pages: { text: string }[] };
    };
    if (json.status !== "READY" || !json.story) return fallback(`status ${json.status}`);
    return { title: json.story.title, pagesText: json.story.pages.map((p) => p.text) };
  } catch (err) {
    return fallback(`request failed (offline/static/timeout): ${String(err)}`);
  }
}
