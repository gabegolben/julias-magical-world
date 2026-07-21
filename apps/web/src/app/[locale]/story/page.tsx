"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ColoringCanvas } from "@/components/coloring/ColoringCanvas";
import { lineArtDataUrl } from "@/lib/lineArt";
import { materializeStoryText, storyStrings } from "@/lib/storyText";
import { getPlan } from "@/lib/aiStories";
import { pushOpsDebounced, pushStory } from "@/lib/sync";
import {
  getStory,
  loadOps,
  saveOps,
  storyPageCount,
  updateStoryText,
  type StoryRecord,
} from "@/lib/stories";

const TTS_LANG: Record<string, string> = { en: "en-US", "pt-BR": "pt-BR", es: "es-ES" };

/**
 * The story reader + coloring surface (the heart of the Julia loop).
 * Static-export friendly: the story id travels as ?id= and everything is
 * hydrated from localStorage on the client.
 */
function StoryView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const locale = useLocale();
  const t = useTranslations();

  // undefined = still checking localStorage, null = genuinely not found.
  const [story, setStory] = useState<StoryRecord | null | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [finished, setFinished] = useState(false);
  const [premium, setPremium] = useState(false);
  // Editing draft (premium): null when not editing.
  const [draft, setDraft] = useState<{ title: string; pagesText: string[] } | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => setStory(getStory(id) ?? null), [id]);
  useEffect(() => () => window.speechSynthesis?.cancel(), [page, finished]);
  useEffect(() => {
    getPlan().then((p) => setPremium(p === "premium"));
  }, []);

  if (story === undefined) return <main className="min-h-dvh bg-paper" />;

  if (story === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-paper p-6 text-center">
        <p className="font-display text-3xl text-ink">{t("story.notFound")}</p>
        <Link href="/" className="min-h-tap rounded-wobble border-4 border-ink bg-julia px-8 py-4 font-display text-xl text-white">
          🏠 {t("story.backHome")}
        </Link>
      </main>
    );
  }

  const { title, pageText } = storyStrings(t, story);
  const text = pageText(page);
  const totalPages = storyPageCount(story);
  const record = story; // narrowed (non-null) for use inside the edit closures

  function readAloud() {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(page === 0 ? `${title}. ${text}` : text);
    u.lang = TTS_LANG[locale] ?? "en-US";
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  // Premium text editing. Edits live in the parent's own story record only —
  // the shared story_cache is written server-side and never touched here.
  function startEdit() {
    setJustSaved(false);
    setDraft(materializeStoryText(t, record));
  }
  function saveEdit() {
    if (!draft) return;
    const updated = updateStoryText(record.id, draft);
    if (updated) {
      setStory(updated);
      void pushStory(updated); // sync to the parent's own row (RLS owner), not the cache
    }
    setDraft(null);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  }

  if (finished) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-paper p-6 text-center">
        <div aria-hidden className="text-8xl motion-safe:animate-bounce">🎉</div>
        <h1 className="font-display text-4xl text-ink">{t("story.celebrationTitle")}</h1>
        <p className="max-w-md font-body text-xl text-ink/70">{t("story.celebrationText")}</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link href={`/story/print?id=${story.id}`} className="min-h-tap rounded-wobble border-4 border-ink bg-sunshine px-8 py-4 font-display text-xl text-ink shadow-[0_6px_0_#37305A]">
            🖨️ {t("story.print")}
          </Link>
          <Link href="/create" className="min-h-tap rounded-wobble border-4 border-ink bg-julia px-8 py-4 font-display text-xl text-white shadow-[0_6px_0_#37305A]">
            ✨ {t("story.makeAnother")}
          </Link>
          <Link href="/library" className="min-h-tap rounded-wobble border-4 border-ink/20 bg-white px-8 py-4 font-display text-xl text-ink shadow-[0_6px_0_rgba(55,48,90,0.15)]">
            📚 {t("story.backToLibrary")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center gap-5 bg-paper p-4 pb-10 sm:p-6">
      <header className="flex w-full items-center justify-between gap-3">
        <Link href="/library" aria-label={t("story.backToLibrary")} className="rounded-wobble border-4 border-ink/20 bg-white px-4 py-2 font-display text-xl text-ink">
          ←
        </Link>
        <h1 className="text-center font-display text-2xl text-ink sm:text-3xl">{title}</h1>
        <span className="flex items-center gap-3">
          <span className="whitespace-nowrap font-body text-sm text-ink/60">
            {t("story.pageOf", { current: page + 1, total: totalPages })}
          </span>
          <Link href={`/story/print?id=${story.id}`} aria-label={t("story.print")} className="rounded-wobble border-4 border-ink/20 bg-white px-3 py-2 font-display text-lg text-ink">
            🖨️
          </Link>
        </span>
      </header>

      <div className="flex w-full flex-col items-center gap-3 rounded-wobble border-4 border-ink/15 bg-white/70 p-4">
        {draft ? (
          <>
            {page === 0 && (
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                aria-label={t("story.editTitle")}
                maxLength={80}
                className="w-full max-w-xl rounded-wobble border-4 border-julia/40 bg-white px-3 py-2 text-center font-display text-2xl text-ink outline-none focus:border-julia"
              />
            )}
            <textarea
              value={draft.pagesText[page] ?? ""}
              onChange={(e) => {
                const next = draft.pagesText.slice();
                next[page] = e.target.value;
                setDraft({ ...draft, pagesText: next });
              }}
              rows={4}
              maxLength={400}
              className="w-full max-w-xl resize-none rounded-wobble border-4 border-julia/40 bg-white px-3 py-2 text-center font-body text-xl leading-relaxed text-ink outline-none focus:border-julia"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={saveEdit}
                className="min-h-tap rounded-wobble border-4 border-ink bg-meadow px-6 py-2 font-display text-lg text-ink motion-safe:active:translate-y-1"
              >
                {t("story.save")}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="min-h-tap rounded-wobble border-4 border-ink/20 bg-white px-6 py-2 font-display text-lg text-ink"
              >
                {t("story.cancel")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="max-w-xl text-center font-body text-xl leading-relaxed text-ink sm:text-2xl">{text}</p>
            {justSaved && (
              <p role="status" className="font-body text-sm text-meadow">
                ✅ {t("story.edited")}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={readAloud}
                className="min-h-tap rounded-wobble border-4 border-ink/20 bg-sky px-6 py-2 font-display text-lg text-ink motion-safe:active:translate-y-1"
              >
                🔊 {t("story.readToMe")}
              </button>
              {premium && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="min-h-tap rounded-wobble border-4 border-julia/40 bg-white px-6 py-2 font-display text-lg text-julia motion-safe:active:translate-y-1"
                >
                  {t("story.editText")}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <ColoringCanvas
        key={`${story.id}:${page}`}
        lineArtUrl={
          story.pageArt?.[page] ??
          lineArtDataUrl(story.characterKey, story.settingKey, page, !!story.childName)
        }
        initialOps={loadOps(story.id, page)}
        onOpsChange={(ops) => {
          saveOps(story.id, page, ops);
          pushOpsDebounced(story.id, page, ops);
        }}
      />

      <nav className={`w-full items-center justify-between gap-4 ${draft ? "hidden" : "flex"}`}>
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="min-h-tap rounded-wobble border-4 border-ink/20 bg-white px-8 font-display text-xl text-ink disabled:opacity-40"
        >
          ← {t("story.previous")}
        </button>
        <div aria-hidden className="flex gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full ${i === page ? "bg-julia" : "bg-ink/20"}`} />
          ))}
        </div>
        {page < totalPages - 1 ? (
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="min-h-tap rounded-wobble border-4 border-ink bg-julia px-8 font-display text-xl text-white shadow-[0_6px_0_#37305A] motion-safe:active:translate-y-1"
          >
            {t("story.next")} →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setFinished(true)}
            className="min-h-tap rounded-wobble border-4 border-ink bg-meadow px-8 font-display text-xl text-ink shadow-[0_6px_0_#37305A] motion-safe:active:translate-y-1"
          >
            🎉 {t("story.finish")}
          </button>
        )}
      </nav>
    </main>
  );
}

export default function StoryPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper" />}>
      <StoryView />
    </Suspense>
  );
}
