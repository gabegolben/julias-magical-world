"use client";

/**
 * A single tappable choice for ages 3-5: emoji-first, huge tap target,
 * wobbly crayon border (the design signature), spoken label support.
 * prefers-reduced-motion respected via motion-safe utilities.
 */
export interface OptionCardProps {
  emoji: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export function OptionCard({ emoji, label, selected, onSelect }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "flex min-h-tap min-w-tap flex-col items-center justify-center gap-1 p-4",
        "rounded-wobble border-4 font-display text-lg text-ink",
        "transition-transform motion-safe:active:scale-90 motion-safe:hover:-rotate-1",
        "focus-visible:outline-4 focus-visible:outline-julia focus-visible:outline-offset-4",
        selected
          ? "border-julia bg-julia-soft shadow-[0_6px_0_#7C4DD8]"
          : "border-ink/20 bg-white shadow-[0_6px_0_rgba(55,48,90,0.15)]",
      ].join(" ")}
    >
      <span aria-hidden className="text-6xl leading-none">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}
