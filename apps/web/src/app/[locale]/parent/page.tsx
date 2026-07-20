"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Session } from "@supabase/supabase-js";
import { Link } from "@/i18n/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getPlan } from "@/lib/aiStories";
import { fullSync } from "@/lib/sync";

type View = "loading" | "signedOut" | "checkEmail" | "signedIn";

/**
 * Parent area (Plan Week 2, demo phase): email+password account whose
 * verification doubles as COPPA "email plus" consent. Signing in turns on
 * cloud sync for the device library. The child-facing app never links here
 * prominently — the entry point is a small footer link on the home page.
 */
export default function ParentPage() {
  const t = useTranslations("parent");
  const [view, setView] = useState<View>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const [plan, setPlan] = useState<"free" | "premium" | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setView("signedOut");
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setView(data.session ? "signedIn" : "signedOut");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setView((v) => (s ? "signedIn" : v === "checkEmail" ? v : "signedOut"));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Signed in → reconcile the library right away, and read the plan.
  useEffect(() => {
    if (!session) {
      setPlan(null);
      return;
    }
    setError(null);
    fullSync()
      .then((r) => r && setSyncedCount(r.stories))
      .catch((e: Error) => setError(e.message));
    getPlan().then(setPlan);
  }, [session]);

  async function submit(mode: "signIn" | "signUp") {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signIn") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.href },
        });
        if (err) throw err;
        if (!data.session) setView("checkEmail");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setError(null);
    try {
      const r = await fullSync();
      if (r) setSyncedCount(r.stories);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 bg-paper p-6">
      <header className="flex items-center gap-4">
        <Link href="/" aria-label={t("backHome")} className="rounded-wobble border-4 border-ink/20 bg-white px-4 py-2 font-display text-xl text-ink">
          ←
        </Link>
        <h1 className="font-display text-3xl text-ink">🔒 {t("dashboard")}</h1>
      </header>

      {!isSupabaseConfigured && (
        <p className="rounded-wobble border-4 border-ink/15 bg-white p-5 font-body text-lg text-ink/70">
          {t("notConfigured")}
        </p>
      )}

      {isSupabaseConfigured && view === "checkEmail" && (
        <p className="rounded-wobble border-4 border-meadow bg-white p-5 font-body text-lg text-ink">
          📬 {t("checkEmail")}
        </p>
      )}

      {isSupabaseConfigured && view === "signedOut" && (
        <form
          className="flex flex-col gap-4 rounded-wobble border-4 border-ink/15 bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit("signIn");
          }}
        >
          <p className="font-body text-lg text-ink/70">{t("intro")}</p>
          <label className="flex flex-col gap-1 font-body text-sm text-ink/60">
            {t("email")}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="rounded-lg border-2 border-ink/20 px-3 py-2 font-body text-lg text-ink outline-none focus:border-julia"
            />
          </label>
          <label className="flex flex-col gap-1 font-body text-sm text-ink/60">
            {t("password")}
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="rounded-lg border-2 border-ink/20 px-3 py-2 font-body text-lg text-ink outline-none focus:border-julia"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={busy}
              className="min-h-tap flex-1 rounded-wobble border-4 border-ink bg-julia px-6 font-display text-xl text-white shadow-[0_6px_0_#37305A] disabled:opacity-40"
            >
              {t("signIn")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit("signUp")}
              className="min-h-tap flex-1 rounded-wobble border-4 border-ink/20 bg-white px-6 font-display text-xl text-ink disabled:opacity-40"
            >
              {t("signUp")}
            </button>
          </div>
        </form>
      )}

      {isSupabaseConfigured && view === "signedIn" && session && (
        <div className="flex flex-col gap-4 rounded-wobble border-4 border-ink/15 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-body text-lg text-ink">
              {t("signedInAs", { email: session.user.email ?? "" })}
            </p>
            {plan && (
              <span
                className={[
                  "rounded-full border-2 px-3 py-1 font-display text-sm",
                  plan === "premium"
                    ? "border-julia bg-julia/10 text-julia"
                    : "border-ink/20 bg-white text-ink/60",
                ].join(" ")}
              >
                {plan === "premium" ? t("planPremium") : t("planFree")}
              </span>
            )}
          </div>
          {syncedCount !== null && (
            <p className="font-body text-lg text-meadow">✅ {t("synced", { count: syncedCount })}</p>
          )}
          <p className="font-body text-sm text-ink/60">{t("syncInfo")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => void syncNow()}
              className="min-h-tap flex-1 rounded-wobble border-4 border-ink bg-julia px-6 font-display text-xl text-white shadow-[0_6px_0_#37305A] disabled:opacity-40"
            >
              {busy ? t("syncing") : t("syncNow")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void getSupabase()?.auth.signOut()}
              className="min-h-tap flex-1 rounded-wobble border-4 border-ink/20 bg-white px-6 font-display text-xl text-ink disabled:opacity-40"
            >
              {t("signOut")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-wobble border-4 border-[#E4572E] bg-white p-4 font-body text-ink">
          ⚠️ {error}
        </p>
      )}
    </main>
  );
}
