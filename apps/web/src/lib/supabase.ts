import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-side Supabase singleton. The anon (publishable) key is public by
 * design — every table is guarded by row-level security (see
 * packages/db/supabase/migrations). When the env vars are absent (e.g. a
 * fork without a project) the app runs fully local and `supabase` is null.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || typeof window === "undefined") return null;
  if (!client) client = createClient(url!, anonKey!);
  return client;
}
