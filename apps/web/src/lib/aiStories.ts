import { getSupabase } from "./supabase";
import type { CharacterKey, SettingKey } from "./stories";

/**
 * Client for /api/generate. Returns null in every situation where AI
 * generation isn't available — signed out, static mirror (no API), server
 * error, safety hold — and the caller falls back to the template engine.
 * The child always gets a story.
 */
export async function generateAiStory(params: {
  characterKey: CharacterKey;
  settingKey: SettingKey;
  language: string;
  childName?: string;
}): Promise<{ title: string; pagesText: string[] } | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    const response = await fetch("/api/generate", {
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

    if (!response.ok) return null;
    const json = (await response.json()) as {
      status: string;
      story?: { title: string; pages: { text: string }[] };
    };
    if (json.status !== "READY" || !json.story) return null;
    return { title: json.story.title, pagesText: json.story.pages.map((p) => p.text) };
  } catch {
    return null; // offline / static build / abort — template fallback
  }
}
