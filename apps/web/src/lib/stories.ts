/**
 * Client-side story engine for the shareable demo (pre-AI).
 *
 * Stories are template-based: a (character, setting) pair indexes into
 * per-locale plot templates in `messages/*.json` (`storyData.*`). We store
 * only the keys — never generated text — so a saved story re-renders
 * correctly in any of the three Day-1 languages, and localStorage stays tiny.
 *
 * When the real AI pipeline (packages/ai) ships, StoryRecord grows a
 * `pages` payload and this module becomes the offline/fallback path.
 */

export const PAGES_PER_STORY = 4;

export const CHARACTER_KEYS = ["unicorn", "dinosaur", "princess", "robot", "puppy"] as const;
export const SETTING_KEYS = ["beach", "forest", "castle", "space", "farm"] as const;

export type CharacterKey = (typeof CHARACTER_KEYS)[number];
export type SettingKey = (typeof SETTING_KEYS)[number];

export const CHARACTER_EMOJI: Record<CharacterKey, string> = {
  unicorn: "🦄",
  dinosaur: "🦕",
  princess: "👸",
  robot: "🤖",
  puppy: "🐶",
};

export const SETTING_EMOJI: Record<SettingKey, string> = {
  beach: "🏖️",
  forest: "🌳",
  castle: "🏰",
  space: "🚀",
  farm: "🚜",
};

export interface StoryRecord {
  id: string;
  characterKey: CharacterKey;
  settingKey: SettingKey;
  /** Parent-entered first name (Plan Weeks 5-6). When set, the child is the
   *  protagonist and the character becomes their story friend. */
  childName?: string;
  /** AI-generated stories carry their own text; template stories derive
   *  text from locale files and leave these unset. */
  title?: string;
  pagesText?: string[];
  /** AI line-art URLs, index-aligned with pagesText. A null/missing entry
   *  means that page uses procedural art (bad quality gate, budget spent, or
   *  no image key) — the child always gets a colorable page either way. */
  pageArt?: (string | null)[];
  createdAt: string; // ISO
}

/** Page count for a story: AI stories bring their own, templates are fixed. */
export function storyPageCount(story: StoryRecord): number {
  return story.pagesText?.length ?? PAGES_PER_STORY;
}

/** First name only, letters/spaces/hyphens, capped — no PII beyond that. */
export function sanitizeChildName(raw: string): string | undefined {
  const cleaned = raw
    .replace(/[^\p{L} '\-]/gu, "")
    .trim()
    .slice(0, 20)
    .trim();
  if (!cleaned) return undefined;
  return cleaned.charAt(0).toLocaleUpperCase() + cleaned.slice(1);
}

export interface FillOp {
  x: number;
  y: number;
  color: string;
}

const STORIES_KEY = "jmw.stories";
const opsKey = (storyId: string, page: number) => `jmw.ops.${storyId}.${page}`;

export function listStories(): StoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORIES_KEY);
    return raw ? (JSON.parse(raw) as StoryRecord[]) : [];
  } catch {
    return [];
  }
}

export function getStory(id: string): StoryRecord | undefined {
  return listStories().find((s) => s.id === id);
}

export function createStory(
  characterKey: CharacterKey,
  settingKey: SettingKey,
  childName?: string,
  aiStory?: { title: string; pagesText: string[]; pageArt?: (string | null)[] },
): StoryRecord {
  const story: StoryRecord = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    characterKey,
    settingKey,
    ...(childName ? { childName } : {}),
    ...(aiStory ? { title: aiStory.title, pagesText: aiStory.pagesText } : {}),
    ...(aiStory?.pageArt?.some(Boolean) ? { pageArt: aiStory.pageArt } : {}),
    createdAt: new Date().toISOString(),
  };
  const all = listStories();
  all.unshift(story);
  window.localStorage.setItem(STORIES_KEY, JSON.stringify(all));
  return story;
}

/** Merge remote records into the local library (by id, newest first). */
export function importStories(records: StoryRecord[]): void {
  const local = listStories();
  const known = new Set(local.map((s) => s.id));
  const merged = [...local, ...records.filter((r) => !known.has(r.id))];
  merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  window.localStorage.setItem(STORIES_KEY, JSON.stringify(merged));
}

export function loadOps(storyId: string, page: number): FillOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(opsKey(storyId, page));
    return raw ? (JSON.parse(raw) as FillOp[]) : [];
  } catch {
    return [];
  }
}

export function saveOps(storyId: string, page: number, ops: FillOp[]): void {
  try {
    window.localStorage.setItem(opsKey(storyId, page), JSON.stringify(ops));
  } catch {
    // Storage full or unavailable — coloring still works, it just won't persist.
  }
}
