"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { OptionCard } from "./OptionCard";
import { CHARACTER_EMOJI, CHARACTER_KEYS, SETTING_EMOJI, SETTING_KEYS } from "@/lib/stories";

const CHARACTERS = CHARACTER_KEYS.map((key) => ({ key, emoji: CHARACTER_EMOJI[key] }));
const SETTINGS = SETTING_KEYS.map((key) => ({ key, emoji: SETTING_EMOJI[key] }));

/**
 * Two-tap story creation for Early Explorers (Plan, Weeks 5-6):
 * pick a friend → pick a place → make magic. No text input exists on this
 * screen by design (safety-by-construction).
 */
export function StoryBuilder({ onCreate }: { onCreate: (characterKey: string, settingKey: string) => void }) {
  const t = useTranslations("create");
  const [character, setCharacter] = useState<string | null>(null);
  const [setting, setSetting] = useState<string | null>(null);

  const step: "friend" | "place" | "ready" = !character ? "friend" : !setting ? "place" : "ready";

  return (
    <div className="flex flex-col items-center gap-8 p-6">
      <h1 className="font-display text-4xl text-ink">
        {step === "friend" ? t("pickFriend") : t("pickPlace")}
      </h1>

      {step === "friend" && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {CHARACTERS.map((c) => (
            <OptionCard key={c.key} emoji={c.emoji} label={t(`characters.${c.key}`)}
              selected={character === c.key} onSelect={() => setCharacter(c.key)} />
          ))}
        </div>
      )}

      {step !== "friend" && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {SETTINGS.map((s) => (
            <OptionCard key={s.key} emoji={s.emoji} label={t(`settings.${s.key}`)}
              selected={setting === s.key} onSelect={() => setSetting(s.key)} />
          ))}
        </div>
      )}

      {step === "ready" && character && setting && (
        <button
          type="button"
          onClick={() => onCreate(character, setting)}
          className="min-h-tap rounded-wobble border-4 border-ink bg-sunshine px-10 font-display text-3xl text-ink shadow-[0_8px_0_#37305A] transition-transform motion-safe:active:translate-y-1 motion-safe:active:shadow-[0_4px_0_#37305A] focus-visible:outline-4 focus-visible:outline-julia focus-visible:outline-offset-4"
        >
          ✨ {t("makeMagic")}
        </button>
      )}
    </div>
  );
}
