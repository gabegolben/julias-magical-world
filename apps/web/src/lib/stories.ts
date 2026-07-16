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
  createdAt: string; // ISO
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

export function createStory(characterKey: CharacterKey, settingKey: SettingKey): StoryRecord {
  const story: StoryRecord = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    characterKey,
    settingKey,
    createdAt: new Date().toISOString(),
  };
  const all = listStories();
  all.unshift(story);
  window.localStorage.setItem(STORIES_KEY, JSON.stringify(all));
  return story;
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
