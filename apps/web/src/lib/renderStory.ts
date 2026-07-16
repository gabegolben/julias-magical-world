/**
 * Off-screen page renderer for exports: line art + replayed fill ops → PNG
 * data URL. Same masking/fill path as ColoringCanvas, so what the child
 * colored is exactly what prints. With no saved ops the page comes out as
 * blank line art — a printable coloring page for crayons ("fridge mode").
 */

import { buildLineMask, dilateMask, magicFillMasked } from "@jmw/magic-fill";
import { hexToRgba } from "./color";
import { lineArtDataUrl } from "./lineArt";
import { loadOps, type StoryRecord } from "./stories";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderColoredPage(story: StoryRecord, page: number): Promise<string> {
  const img = await loadImage(
    lineArtDataUrl(story.characterKey, story.settingKey, page, !!story.childName),
  );
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);

  const ops = loadOps(story.id, page);
  if (ops.length > 0) {
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mask = dilateMask(
      buildLineMask(frame.data, canvas.width, canvas.height),
      canvas.width,
      canvas.height,
      2,
    );
    for (const op of ops) {
      magicFillMasked(frame.data, mask, canvas.width, canvas.height, op.x, op.y, hexToRgba(op.color));
    }
    ctx.putImageData(frame, 0, 0);
  }
  return canvas.toDataURL("image/png");
}
