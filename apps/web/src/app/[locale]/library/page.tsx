"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  CHARACTER_EMOJI,
  SETTING_EMOJI,
  listStories,
  type StoryRecord,
} from "@/lib/stories";

/** The Adventure Library, v0: every saved story, newest first. */
export default function LibraryPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [stories, setStories] = useState<StoryRecord[] | null>(null);

  useEffect(() => setStories(listStories()), []);

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 bg-paper p-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" aria-label={t("story.backHome")} className="rounded-wobble border-4 border-ink/20 bg-white px-4 py-2 font-display text-xl text-ink">
          ←
        </Link>
        <h1 className="font-display text-4xl text-ink">📚 {t("library.title")}</h1>
        <span aria-hidden className="w-12" />
      </header>

      {stories !== null && stories.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="max-w-md font-body text-xl text-ink/70">{t("library.empty")}</p>
          <Link href="/create" className="min-h-tap rounded-wobble border-4 border-ink bg-julia px-10 py-5 font-display text-2xl text-white shadow-[0_8px_0_#37305A]">
            ✨ {t("library.new")}
          </Link>
        </div>
      )}

      {stories !== null && stories.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {stories.map((s) => (
              <Link
                key={s.id}
                href={`/story?id=${s.id}`}
                className="flex min-h-tap items-center gap-4 rounded-wobble border-4 border-ink/20 bg-white p-5 shadow-[0_6px_0_rgba(55,48,90,0.15)] transition-transform motion-safe:hover:-rotate-1 motion-safe:active:translate-y-1"
              >
                <span aria-hidden className="text-5xl">
                  {CHARACTER_EMOJI[s.characterKey]}
                  {SETTING_EMOJI[s.settingKey]}
                </span>
                <span className="flex flex-col text-left">
                  <span className="font-display text-xl text-ink">
                    {t(`storyData.plots.${s.settingKey}.title`, {
                      name: t(`storyData.characters.${s.characterKey}.name`),
                    })}
                  </span>
                  <span className="font-body text-sm text-ink/60">{dateFmt.format(new Date(s.createdAt))}</span>
                </span>
              </Link>
            ))}
          </div>
          <Link href="/create" className="self-center rounded-wobble border-4 border-ink bg-julia px-8 py-4 font-display text-xl text-white shadow-[0_6px_0_#37305A]">
            ✨ {t("library.new")}
          </Link>
        </>
      )}
    </main>
  );
}
