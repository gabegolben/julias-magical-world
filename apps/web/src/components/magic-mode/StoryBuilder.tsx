"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { OptionCard } from "./OptionCard";
import { CHARACTER_EMOJI, CHARACTER_KEYS, SETTING_EMOJI, SETTING_KEYS } from "@/lib/stories";
import type { ChildProfile } from "@/lib/children";

const CHARACTERS = CHARACTER_KEYS.map((key) => ({ key, emoji: CHARACTER_EMOJI[key] }));
const SETTINGS = SETTING_KEYS.map((key) => ({ key, emoji: SETTING_EMOJI[key] }));

/**
 * Two-tap story creation for Early Explorers (Plan, Weeks 5-6):
 * pick a friend → pick a place → make magic. The child's flow has no text
 * input (safety-by-construction); the optional name field on the final
 * step is visually framed as a grown-up extra, first name only.
 */
type Gender = "boy" | "girl";

export function StoryBuilder({
  onCreate,
  premium = false,
  children = [],
  onRememberChild,
}: {
  onCreate: (
    characterKey: string,
    settingKey: string,
    childName: string,
    childGender?: Gender,
    childTraits?: string,
  ) => void;
  /** Premium parents get the optional free-text "about your child" field. */
  premium?: boolean;
  /** Saved child profiles to pick from (pre-fills the fields). */
  children?: ChildProfile[];
  /** Persist the current name/gender/traits as a reusable profile. */
  onRememberChild?: (input: { name: string; gender?: Gender; traits?: string }) => void;
}) {
  const t = useTranslations("create");
  const [character, setCharacter] = useState<string | null>(null);
  const [setting, setSetting] = useState<string | null>(null);
  const [childName, setChildName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [traits, setTraits] = useState("");
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [remembered, setRemembered] = useState(false);

  function pickChild(child: ChildProfile) {
    setSelectedChildId(child.id);
    setChildName(child.name);
    setGender(child.gender ?? null);
    setTraits(premium ? (child.traits ?? "") : "");
    setRemembered(false);
  }
  function pickNewChild() {
    setSelectedChildId(null);
    setChildName("");
    setGender(null);
    setTraits("");
    setRemembered(false);
  }
  function rememberChild() {
    if (!childName.trim() || !onRememberChild) return;
    onRememberChild({
      name: childName.trim(),
      ...(gender ? { gender } : {}),
      ...(premium && traits.trim() ? { traits: traits.trim() } : {}),
    });
    setRemembered(true);
  }

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
        <div className="flex flex-col items-center gap-4">
          {/* Saved child profiles — tap to pre-fill the fields below. */}
          {children.length > 0 && (
            <div className="flex flex-col items-center gap-2 font-body text-sm text-ink/60">
              {t("childPickerLabel")}
              <div className="flex flex-wrap justify-center gap-2">
                {children.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickChild(c)}
                    className={[
                      "min-h-tap rounded-wobble border-4 px-4 py-2 font-display text-lg transition-transform",
                      selectedChildId === c.id
                        ? "border-ink bg-julia text-white"
                        : "border-ink/20 bg-white text-ink",
                    ].join(" ")}
                  >
                    {c.gender === "boy" ? "👦 " : c.gender === "girl" ? "👧 " : ""}
                    {c.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={pickNewChild}
                  className="min-h-tap rounded-wobble border-4 border-dashed border-ink/30 bg-white px-4 py-2 font-display text-lg text-ink/70"
                >
                  {t("childNew")}
                </button>
              </div>
            </div>
          )}

          <label className="flex flex-col items-center gap-2 font-body text-sm text-ink/60">
            {t("childNameLabel")}
            <input
              type="text"
              value={childName}
              onChange={(e) => {
                setChildName(e.target.value);
                setSelectedChildId(null);
                setRemembered(false);
              }}
              placeholder={t("childNamePlaceholder")}
              maxLength={20}
              autoComplete="off"
              className="rounded-wobble border-4 border-ink/20 bg-white px-4 py-2 text-center font-display text-xl text-ink outline-none focus:border-julia"
            />
          </label>

          {/* Optional boy/girl — tap again to clear (stays optional). */}
          <div
            role="radiogroup"
            aria-label={t("childGenderLabel")}
            className="flex flex-col items-center gap-2 font-body text-sm text-ink/60"
          >
            {t("childGenderLabel")}
            <div className="flex gap-3">
              {(["boy", "girl"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={gender === g}
                  onClick={() => setGender((cur) => (cur === g ? null : g))}
                  className={[
                    "min-h-tap rounded-wobble border-4 px-6 py-2 font-display text-xl transition-transform",
                    "focus-visible:outline-4 focus-visible:outline-julia focus-visible:outline-offset-2",
                    gender === g
                      ? "border-ink bg-julia text-white"
                      : "border-ink/20 bg-white text-ink",
                  ].join(" ")}
                >
                  {g === "boy" ? `👦 ${t("genderBoy")}` : `👧 ${t("genderGirl")}`}
                </button>
              ))}
            </div>
          </div>

          {/* Premium-only: free-text traits that enrich the story + art. */}
          {premium && (
            <label className="flex w-full max-w-md flex-col items-center gap-2 font-body text-sm text-ink/60">
              {t("childTraitsLabel")}
              <textarea
                value={traits}
                onChange={(e) => {
                  setTraits(e.target.value);
                  setRemembered(false);
                }}
                placeholder={t("childTraitsPlaceholder")}
                maxLength={300}
                rows={3}
                className="w-full resize-none rounded-wobble border-4 border-julia/40 bg-white px-4 py-2 text-center font-body text-lg text-ink outline-none focus:border-julia"
              />
            </label>
          )}

          {/* Remember the current details as a reusable profile. */}
          {onRememberChild && childName.trim() && (
            remembered ? (
              <p role="status" className="font-body text-sm text-meadow">✅ {t("childRemembered")}</p>
            ) : (
              <button
                type="button"
                onClick={rememberChild}
                className="rounded-wobble border-4 border-ink/20 bg-white px-5 py-2 font-body text-sm text-ink/70 motion-safe:active:translate-y-0.5"
              >
                {t("rememberChild")}
              </button>
            )
          )}
        </div>
      )}

      {step === "ready" && character && setting && (
        <button
          type="button"
          onClick={() =>
            onCreate(
              character,
              setting,
              childName,
              gender ?? undefined,
              premium && traits.trim() ? traits.trim() : undefined,
            )
          }
          className="min-h-tap rounded-wobble border-4 border-ink bg-sunshine px-10 font-display text-3xl text-ink shadow-[0_8px_0_#37305A] transition-transform motion-safe:active:translate-y-1 motion-safe:active:shadow-[0_4px_0_#37305A] focus-visible:outline-4 focus-visible:outline-julia focus-visible:outline-offset-4"
        >
          ✨ {t("makeMagic")}
        </button>
      )}
    </div>
  );
}
