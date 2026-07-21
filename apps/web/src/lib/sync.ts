/**
 * Cloud sync for the device library (demo phase: one parent account owns
 * the whole library; child profiles come with the server phase).
 *
 * Everything here is fire-and-forget and silently no-ops when Supabase
 * isn't configured or nobody is signed in — the app must stay fully
 * functional offline/local-only.
 *
 * Merge policy: stories are unioned by id; for coloring ops the longer op
 * log wins (more progress), matching how the op-log only ever grows except
 * on undo.
 */

import { getSupabase } from "./supabase";
import {
  importStories,
  listStories,
  loadOps,
  saveOps,
  storyPageCount,
  type CharacterKey,
  type FillOp,
  type SettingKey,
  type StoryRecord,
} from "./stories";
import { importChildren, listChildren, type ChildProfile } from "./children";

interface StoryRow {
  id: string;
  character_key: string;
  setting_key: string;
  child_name: string | null;
  child_gender: string | null;
  title: string | null;
  pages: string[] | null;
  page_art: (string | null)[] | null;
  created_at: string;
}

const toRow = (s: StoryRecord) => ({
  id: s.id,
  character_key: s.characterKey,
  setting_key: s.settingKey,
  child_name: s.childName ?? null,
  child_gender: s.childGender ?? null,
  title: s.title ?? null,
  pages: s.pagesText ?? null,
  page_art: s.pageArt ?? null,
  created_at: s.createdAt,
});

const fromRow = (r: StoryRow): StoryRecord => ({
  id: r.id,
  characterKey: r.character_key as CharacterKey,
  settingKey: r.setting_key as SettingKey,
  ...(r.child_name ? { childName: r.child_name } : {}),
  ...(r.child_gender === "boy" || r.child_gender === "girl" ? { childGender: r.child_gender } : {}),
  ...(r.title && r.pages ? { title: r.title, pagesText: r.pages } : {}),
  ...(r.page_art?.some(Boolean) ? { pageArt: r.page_art } : {}),
  createdAt: r.created_at,
});

async function signedInClient() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ? supabase : null;
}

interface ChildRow {
  id: string;
  name: string;
  gender: string | null;
  traits: string | null;
  created_at: string;
}

const childToRow = (c: ChildProfile) => ({
  id: c.id,
  name: c.name,
  gender: c.gender ?? null,
  traits: c.traits ?? null,
  created_at: c.createdAt,
});

const childFromRow = (r: ChildRow): ChildProfile => ({
  id: r.id,
  name: r.name,
  ...(r.gender === "boy" || r.gender === "girl" ? { gender: r.gender } : {}),
  ...(r.traits ? { traits: r.traits } : {}),
  createdAt: r.created_at,
});

/** Push one child profile (called right after saving one). */
export async function pushChild(child: ChildProfile): Promise<void> {
  try {
    const supabase = await signedInClient();
    if (!supabase) return;
    await supabase.from("children").upsert(childToRow(child));
  } catch {
    // Offline/transient — fullSync reconciles.
  }
}

/** Delete one child profile from the cloud (local delete is separate). */
export async function removeChild(id: string): Promise<void> {
  try {
    const supabase = await signedInClient();
    if (!supabase) return;
    await supabase.from("children").delete().eq("id", id);
  } catch {
    // Best-effort.
  }
}

/** Push one story record (called right after creation). */
export async function pushStory(story: StoryRecord): Promise<void> {
  try {
    const supabase = await signedInClient();
    if (!supabase) return;
    await supabase.from("stories").upsert(toRow(story));
  } catch {
    // Offline or transient — the next fullSync picks it up.
  }
}

const opsTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Debounced push of a page's coloring ops (called from auto-save). */
export function pushOpsDebounced(storyId: string, page: number, ops: FillOp[]): void {
  const key = `${storyId}:${page}`;
  clearTimeout(opsTimers.get(key));
  opsTimers.set(
    key,
    setTimeout(async () => {
      try {
        const supabase = await signedInClient();
        if (!supabase) return;
        await supabase
          .from("colorings")
          .upsert({ story_id: storyId, page, ops, updated_at: new Date().toISOString() });
      } catch {
        // Best-effort; fullSync reconciles.
      }
    }, 1500),
  );
}

export interface SyncResult {
  stories: number;
}

/** Two-way reconcile: pull remote into local, then push local up. */
export async function fullSync(): Promise<SyncResult | null> {
  const supabase = await signedInClient();
  if (!supabase) return null;

  const { data: remoteStories, error } = await supabase.from("stories").select("*");
  if (error) throw error;
  importStories((remoteStories as StoryRow[]).map(fromRow));

  const { data: remoteColorings, error: colError } = await supabase.from("colorings").select("*");
  if (colError) throw colError;
  for (const row of remoteColorings as { story_id: string; page: number; ops: FillOp[] }[]) {
    if (row.ops.length > loadOps(row.story_id, row.page).length) {
      saveOps(row.story_id, row.page, row.ops);
    }
  }

  // Child profiles (best-effort: absent table pre-migration must not break sync).
  const { data: remoteChildren, error: childError } = await supabase.from("children").select("*");
  if (!childError && remoteChildren) {
    importChildren((remoteChildren as ChildRow[]).map(childFromRow));
    const localChildren = listChildren();
    if (localChildren.length > 0) await supabase.from("children").upsert(localChildren.map(childToRow));
  }

  const local = listStories();
  if (local.length > 0) {
    const { error: pushError } = await supabase.from("stories").upsert(local.map(toRow));
    if (pushError) throw pushError;

    const colorings = local.flatMap((s) =>
      Array.from({ length: storyPageCount(s) }, (_, page) => ({ story: s, page }))
        .map(({ story, page }) => ({ story_id: story.id, page, ops: loadOps(story.id, page) }))
        .filter((c) => c.ops.length > 0),
    );
    if (colorings.length > 0) {
      const { error: colPushError } = await supabase.from("colorings").upsert(colorings);
      if (colPushError) throw colPushError;
    }
  }

  return { stories: listStories().length };
}
