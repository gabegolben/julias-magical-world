"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { renderColoredPage } from "@/lib/renderStory";
import { storyStrings } from "@/lib/storyText";
import {
  CHARACTER_KEYS,
  SETTING_KEYS,
  getStory,
  storyPageCount,
  type CharacterKey,
  type SettingKey,
  type StoryRecord,
} from "@/lib/stories";

/**
 * Print / save-as-PDF view ("fridge mode", Plan Week 10 brought forward).
 * Renders every page with the child's saved coloring baked in; with
 * ?character=&setting= instead of ?id= it produces blank line-art pages —
 * a printable coloring book, no story record needed.
 */
function PrintView() {
  const searchParams = useSearchParams();
  const t = useTranslations();
  const id = searchParams.get("id");
  const character = searchParams.get("character");
  const setting = searchParams.get("setting");

  const [story, setStory] = useState<StoryRecord | null | undefined>(undefined);
  const [images, setImages] = useState<string[] | null>(null);

  useEffect(() => {
    let s: StoryRecord | undefined;
    if (id) {
      s = getStory(id);
    } else if (
      CHARACTER_KEYS.includes(character as CharacterKey) &&
      SETTING_KEYS.includes(setting as SettingKey)
    ) {
      // Ephemeral story: blank coloring pages straight off the picker.
      s = {
        id: "print-preview",
        characterKey: character as CharacterKey,
        settingKey: setting as SettingKey,
        createdAt: new Date().toISOString(),
      };
    }
    setStory(s ?? null);
    if (s) {
      const record = s;
      Promise.all(
        Array.from({ length: storyPageCount(record) }, (_, p) => renderColoredPage(record, p)),
      ).then(setImages);
    }
  }, [id, character, setting]);

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

  return (
    <main className="mx-auto max-w-3xl bg-white p-6 text-ink print:p-0">
      <style>{`@media print {
        @page { margin: 12mm; }
        .print-sheet { break-after: page; }
        .print-sheet:last-child { break-after: auto; }
      }`}</style>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link href={id ? `/story?id=${id}` : "/create"} className="rounded-wobble border-4 border-ink/20 bg-white px-4 py-2 font-display text-xl text-ink">
          ←
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={images === null}
          className="min-h-tap rounded-wobble border-4 border-ink bg-julia px-8 font-display text-xl text-white shadow-[0_6px_0_#37305A] disabled:opacity-40"
        >
          🖨️ {t("story.print")}
        </button>
      </header>

      {images === null && (
        <p className="py-20 text-center font-body text-xl text-ink/70">{t("story.preparingPrint")}</p>
      )}

      {images !== null &&
        images.map((src, p) => (
          <section key={p} className="print-sheet mb-10 flex flex-col items-center gap-4 print:mb-0">
            {p === 0 && <h1 className="text-center font-display text-4xl">{title}</h1>}
            {/* Data-URL renders of the child's own coloring — next/image adds nothing here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={t("story.pageOf", { current: p + 1, total: images.length })}
              className="w-full rounded border-2 border-ink/15 print:rounded-none"
            />
            <p className="max-w-xl text-center font-body text-lg leading-relaxed">{pageText(p)}</p>
            <p className="text-center font-body text-xs text-ink/40">
              {t("story.printFooter")} · {t("story.pageOf", { current: p + 1, total: images.length })}
            </p>
          </section>
        ))}
    </main>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper" />}>
      <PrintView />
    </Suspense>
  );
}
