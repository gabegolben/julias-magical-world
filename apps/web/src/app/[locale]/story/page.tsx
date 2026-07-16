"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ColoringCanvas } from "@/components/coloring/ColoringCanvas";
import { lineArtDataUrl } from "@/lib/lineArt";
import { storyStrings } from "@/lib/storyText";
import { pushOpsDebounced } from "@/lib/sync";
import {
  PAGES_PER_STORY,
  getStory,
  loadOps,
  saveOps,
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

  useEffect(() => setStory(getStory(id) ?? null), [id]);
  useEffect(() => () => window.speechSynthesis?.cancel(), [page, finished]);

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

  function readAloud() {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(page === 0 ? `${title}. ${text}` : text);
    u.lang = TTS_LANG[locale] ?? "en-US";
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
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
            {t("story.pageOf", { current: page + 1, total: PAGES_PER_STORY })}
          </span>
          <Link href={`/story/print?id=${story.id}`} aria-label={t("story.print")} className="rounded-wobble border-4 border-ink/20 bg-white px-3 py-2 font-display text-lg text-ink">
            🖨️
          </Link>
        </span>
      </header>

      <div className="flex w-full flex-col items-center gap-3 rounded-wobble border-4 border-ink/15 bg-white/70 p-4">
        <p className="max-w-xl text-center font-body text-xl leading-relaxed text-ink sm:text-2xl">{text}</p>
        <button
          type="button"
          onClick={readAloud}
          className="min-h-tap rounded-wobble border-4 border-ink/20 bg-sky px-6 py-2 font-display text-lg text-ink motion-safe:active:translate-y-1"
        >
          🔊 {t("story.readToMe")}
        </button>
      </div>

      <ColoringCanvas
        key={`${story.id}:${page}`}
        lineArtUrl={lineArtDataUrl(story.characterKey, story.settingKey, page, !!story.childName)}
        initialOps={loadOps(story.id, page)}
        onOpsChange={(ops) => {
          saveOps(story.id, page, ops);
          pushOpsDebounced(story.id, page, ops);
        }}
      />

      <nav className="flex w-full items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="min-h-tap rounded-wobble border-4 border-ink/20 bg-white px-8 font-display text-xl text-ink disabled:opacity-40"
        >
          ← {t("story.previous")}
        </button>
        <div aria-hidden className="flex gap-2">
          {Array.from({ length: PAGES_PER_STORY }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full ${i === page ? "bg-julia" : "bg-ink/20"}`} />
          ))}
        </div>
        {page < PAGES_PER_STORY - 1 ? (
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
