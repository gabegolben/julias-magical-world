"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { OptionCard } from "./OptionCard";
import { CHARACTER_EMOJI, CHARACTER_KEYS, SETTING_EMOJI, SETTING_KEYS } from "@/lib/stories";

const CHARACTERS = CHARACTER_KEYS.map((key) => ({ key, emoji: CHARACTER_EMOJI[key] }));
const SETTINGS = SETTING_KEYS.map((key) => ({ key, emoji: SETTING_EMOJI[key] }));

/**
 * Two-tap story creation for Early Explorers (Plan, Weeks 5-6):
 * pick a friend → pick a place → make magic. The child's flow has no text
 * input (safety-by-construction); the optional name field on the final
 * step is visually framed as a grown-up extra, first name only.
 */
export function StoryBuilder({
  onCreate,
}: {
  onCreate: (characterKey: string, settingKey: string, childName: string) => void;
}) {
  const t = useTranslations("create");
  const [character, setCharacter] = useState<string | null>(null);
  const [setting, setSetting] = useState<string | null>(null);
  const [childName, setChildName] = useState("");

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

      {step === "ready" && (
        <label className="flex flex-col items-center gap-2 font-body text-sm text-ink/60">
          {t("childNameLabel")}
          <input
            type="text"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder={t("childNamePlaceholder")}
            maxLength={20}
            autoComplete="off"
            className="rounded-wobble border-4 border-ink/20 bg-white px-4 py-2 text-center font-display text-xl text-ink outline-none focus:border-julia"
          />
        </label>
      )}

      {step === "ready" && character && setting && (
        <button
          type="button"
          onClick={() => onCreate(character, setting, childName)}
          className="min-h-tap rounded-wobble border-4 border-ink bg-sunshine px-10 font-display text-3xl text-ink shadow-[0_8px_0_#37305A] transition-transform motion-safe:active:translate-y-1 motion-safe:active:shadow-[0_4px_0_#37305A] focus-visible:outline-4 focus-visible:outline-julia focus-visible:outline-offset-4"
        >
          ✨ {t("makeMagic")}
        </button>
      )}
    </div>
  );
}
