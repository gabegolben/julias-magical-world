"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { buildLineMask, dilateMask, magicFillMasked } from "@jmw/magic-fill";
import type { FillOp } from "@/lib/stories";

/** Magic Mode 8-color palette (Overview §6, ages 3-5). */
const PALETTE = [
  "#E4572E", "#F3A712", "#FFE066", "#74C98F",
  "#8AD4F0", "#7C4DD8", "#F49FBC", "#8B5E3C",
] as const;

const hexToRgba = (hex: string) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
  a: 255,
});

/**
 * Tap-to-fill coloring surface (Plan, Weeks 7-9).
 *
 * Architecture:
 * - The line-art image renders once into an offscreen-sized canvas.
 * - On load we build the DILATED line mask (gap radius 2) exactly once —
 *   the fill sees sealed regions while the child sees the original art.
 * - Every tap is a magicFillMasked call directly on the canvas ImageData.
 * - Undo = replay the op log (ops are tiny; replay is fast and this is the
 *   same op log we persist to Coloring.canvasOps for auto-save).
 */
export function ColoringCanvas({
  lineArtUrl,
  initialOps,
  onOpsChange,
}: {
  lineArtUrl: string;
  /** Previously saved op log to replay once the art loads (remount per page). */
  initialOps?: FillOp[];
  onOpsChange?: (ops: FillOp[]) => void;
}) {
  const t = useTranslations("coloring");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<Uint8Array | null>(null);
  const baseImageRef = useRef<ImageData | null>(null);
  const [color, setColor] = useState<string>(PALETTE[5]); // Julia purple first
  const [ops, setOps] = useState<FillOp[]>(initialOps ?? []);
  const opsRef = useRef(ops);
  opsRef.current = ops;
  const [hint, setHint] = useState(false);

  // Load art, build the sealed mask once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      const base = ctx.getImageData(0, 0, canvas.width, canvas.height);
      baseImageRef.current = base;
      maskRef.current = dilateMask(
        buildLineMask(base.data, canvas.width, canvas.height),
        canvas.width,
        canvas.height,
        2,
      );
      if (opsRef.current.length > 0) applyOps(opsRef.current); // restore saved coloring
    };
    img.src = lineArtUrl;
  }, [lineArtUrl]);

  const applyOps = useCallback((opsToApply: FillOp[]) => {
    const canvas = canvasRef.current;
    const base = baseImageRef.current;
    const mask = maskRef.current;
    if (!canvas || !base || !mask) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const working = new ImageData(base.data.slice(), base.width, base.height);
    for (const op of opsToApply) {
      magicFillMasked(working.data, mask, base.width, base.height, op.x, op.y, hexToRgba(op.color));
    }
    ctx.putImageData(working, 0, 0);
  }, []);

  const handleTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const mask = maskRef.current;
    if (!canvas || !mask) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);

    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = magicFillMasked(frame.data, mask, canvas.width, canvas.height, x, y, hexToRgba(color));

    if (result.pixelsFilled === 0) {
      setHint(true); // gentle nudge, auto-hides
      setTimeout(() => setHint(false), 2000);
      return;
    }
    ctx.putImageData(frame, 0, 0);
    // Read through the ref: two taps landing in the same tick must both
    // make it into the op log (state closures go stale under batching).
    const next = [...opsRef.current, { x, y, color }];
    opsRef.current = next;
    setOps(next);
    onOpsChange?.(next); // parent debounces -> Coloring.canvasOps auto-save
  };

  const undo = () => {
    const next = opsRef.current.slice(0, -1);
    opsRef.current = next;
    setOps(next);
    applyOps(next);
    onOpsChange?.(next);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        onPointerDown={handleTap}
        className="w-full max-w-2xl touch-none rounded-wobble border-4 border-ink/20 bg-white"
        aria-label={t("pickColor")}
      />
      {hint && (
        <p role="status" className="font-body text-lg text-ink/70">{t("tryElsewhere")}</p>
      )}
      <div className="flex flex-wrap justify-center gap-3" role="radiogroup" aria-label={t("pickColor")}>
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            onClick={() => setColor(c)}
            style={{ backgroundColor: c }}
            className={[
              "h-16 w-16 rounded-full border-4 transition-transform motion-safe:active:scale-90",
              "focus-visible:outline-4 focus-visible:outline-ink focus-visible:outline-offset-2",
              color === c ? "scale-110 border-ink" : "border-white shadow-md",
            ].join(" ")}
          />
        ))}
        <button
          type="button"
          onClick={undo}
          disabled={ops.length === 0}
          className="min-h-16 rounded-wobble border-4 border-ink/20 bg-white px-5 font-display text-ink disabled:opacity-40"
        >
          ↩️ {t("undo")}
        </button>
      </div>
    </div>
  );
}
