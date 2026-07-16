"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { StoryBuilder } from "@/components/magic-mode/StoryBuilder";
import { createStory, sanitizeChildName, type CharacterKey, type SettingKey } from "@/lib/stories";

/**
 * Demo mode: the story is assembled client-side from locale templates
 * (see lib/stories.ts) — no server, no keys, works offline. The short
 * "magic" pause keeps the moment of anticipation the real AI pipeline
 * will need anyway (Plan, Weeks 5-6: make waiting delightful).
 */
export default function CreatePage() {
  const router = useRouter();
  const t = useTranslations("generating");
  const [generating, setGenerating] = useState(false);

  function handleCreate(characterKey: string, settingKey: string, childName: string) {
    setGenerating(true);
    const story = createStory(
      characterKey as CharacterKey,
      settingKey as SettingKey,
      sanitizeChildName(childName),
    );
    setTimeout(() => router.push(`/story?id=${story.id}`), 2400);
  }

  if (generating) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-paper p-6 text-center">
        <div aria-hidden className="text-8xl motion-safe:animate-bounce">🪄</div>
        <h1 className="font-display text-4xl text-ink">{t("title")}</h1>
        <p className="font-body text-xl text-ink/70">{t("hint")}</p>
        <div aria-hidden className="flex gap-3 text-4xl">
          <span className="motion-safe:animate-pulse">✨</span>
          <span className="motion-safe:animate-pulse [animation-delay:300ms]">⭐</span>
          <span className="motion-safe:animate-pulse [animation-delay:600ms]">✨</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper">
      <StoryBuilder onCreate={handleCreate} />
    </main>
  );
}
