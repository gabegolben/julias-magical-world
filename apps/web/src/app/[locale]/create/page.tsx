"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { StoryBuilder } from "@/components/magic-mode/StoryBuilder";
import { createStory, sanitizeChildName, type CharacterKey, type SettingKey } from "@/lib/stories";
import { generateAiStory } from "@/lib/aiStories";
import { pushStory } from "@/lib/sync";

/**
 * Story creation. Signed-in parents on the server build get a real
 * AI-generated story (Haiku via /api/generate); everyone else — signed out,
 * offline, or on the static mirror — gets the template engine. The child
 * can't tell the difference in flow: pick, magic, story.
 */
export default function CreatePage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("generating");
  const [generating, setGenerating] = useState(false);

  async function handleCreate(
    characterKey: string,
    settingKey: string,
    childName: string,
    childGender?: "boy" | "girl",
  ) {
    setGenerating(true);
    const name = sanitizeChildName(childName);
    // Keep the magic moment at least as long as the animation beat.
    const [aiStory] = await Promise.all([
      generateAiStory({
        characterKey: characterKey as CharacterKey,
        settingKey: settingKey as SettingKey,
        language: locale,
        ...(name ? { childName: name } : {}),
        ...(childGender ? { childGender } : {}),
      }),
      new Promise((resolve) => setTimeout(resolve, 2400)),
    ]);
    const story = createStory(
      characterKey as CharacterKey,
      settingKey as SettingKey,
      name,
      aiStory ?? undefined,
      childGender,
    );
    void pushStory(story); // cloud copy when a parent is signed in
    router.push(`/story?id=${story.id}`);
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
