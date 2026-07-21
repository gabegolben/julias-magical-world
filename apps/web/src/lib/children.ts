/**
 * Reusable child profiles (Plan: child accounts, brought forward lightly).
 * A parent saves a child's name, gender, and — premium — appearance/personality
 * once, then picks them on the create screen instead of re-typing. Stored
 * local-first (localStorage) and synced to the private `children` table for
 * signed-in parents (see sync.ts). This is the child's PII, never shared.
 */

export interface ChildProfile {
  id: string;
  name: string;
  gender?: "boy" | "girl";
  /** Premium free-text appearance/personality (drives images; see route). */
  traits?: string;
  createdAt: string; // ISO
}

const CHILDREN_KEY = "jmw.children";

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function listChildren(): ChildProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHILDREN_KEY);
    return raw ? (JSON.parse(raw) as ChildProfile[]) : [];
  } catch {
    return [];
  }
}

function write(all: ChildProfile[]): void {
  window.localStorage.setItem(CHILDREN_KEY, JSON.stringify(all));
}

/**
 * Upsert a profile by name (case-insensitive) so saving the same child twice
 * updates rather than duplicates. Returns the saved profile.
 */
export function saveChild(input: {
  name: string;
  gender?: "boy" | "girl";
  traits?: string;
}): ChildProfile {
  const all = listChildren();
  const existing = all.find((c) => c.name.toLowerCase() === input.name.toLowerCase());
  const profile: ChildProfile = {
    id: existing?.id ?? uuid(),
    name: input.name,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    ...(input.gender ? { gender: input.gender } : {}),
    ...(input.traits ? { traits: input.traits } : {}),
  };
  write(existing ? all.map((c) => (c.id === existing.id ? profile : c)) : [profile, ...all]);
  return profile;
}

export function deleteChild(id: string): void {
  write(listChildren().filter((c) => c.id !== id));
}

/** Merge remote profiles into the local list (by id, existing kept newest-first). */
export function importChildren(records: ChildProfile[]): void {
  const local = listChildren();
  const known = new Set(local.map((c) => c.id));
  write([...local, ...records.filter((r) => !known.has(r.id))]);
}
