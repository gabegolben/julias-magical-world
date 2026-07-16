/**
 * Gap closing — morphological preprocessing for AI-generated line art.
 *
 * Problem (Implementation Plan, Risk #1): image models sometimes draw
 * outlines with small breaks. Flood fill leaks through any gap, flooding the
 * whole page and ruining the magic-fill experience.
 *
 * Solution: build a boolean "line mask" from the artwork, dilate it by N
 * pixels to seal gaps up to ~2N px wide, and give the FILL ALGORITHM the
 * dilated mask as its boundary — while the VISIBLE artwork keeps the
 * original, undilated lines. The child sees crisp art; the fill sees sealed
 * regions.
 *
 * Usage:
 *   const mask = buildLineMask(imageData.data, w, h);
 *   const sealed = dilateMask(mask, w, h, 2);       // seals gaps ≤ ~4px
 *   magicFillMasked(imageData.data, sealed, w, h, x, y, color);
 */

import type { RGBA, FillOptions, FillResult } from "./floodFill.js";

const luminance = (r: number, g: number, b: number): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/** 1 = line pixel, 0 = fillable. */
export function buildLineMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  lineLuminanceThreshold = 96,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    if (luminance(data[i], data[i + 1], data[i + 2]) <= lineLuminanceThreshold) {
      mask[p] = 1;
    }
  }
  return mask;
}

/**
 * Dilate the line mask by `radius` pixels (square structuring element),
 * implemented as `radius` passes of 8-neighbour dilation. Seals line gaps
 * up to roughly 2×radius pixels wide.
 */
export function dilateMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius = 2,
): Uint8Array {
  let current = mask;
  for (let pass = 0; pass < radius; pass++) {
    const next = new Uint8Array(current); // copy, then OR in neighbours
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        if (current[row + x]) continue;
        // Any 8-neighbour a line pixel? → become one.
        const x0 = x > 0 ? x - 1 : x;
        const x1 = x < width - 1 ? x + 1 : x;
        const y0 = y > 0 ? y - 1 : y;
        const y1 = y < height - 1 ? y + 1 : y;
        outer: for (let ny = y0; ny <= y1; ny++) {
          for (let nx = x0; nx <= x1; nx++) {
            if (current[ny * width + nx]) {
              next[row + x] = 1;
              break outer;
            }
          }
        }
      }
    }
    current = next;
  }
  return current;
}

/**
 * Flood fill that uses an external line mask as its boundary instead of
 * pixel luminance. Same scanline core as magicFill, but the boundary
 * decision comes from the (dilated) mask, so gaps in the visible art
 * cannot leak.
 */
export function magicFillMasked(
  data: Uint8ClampedArray,
  lineMask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fillColor: RGBA,
  options: FillOptions = {},
): FillResult {
  const tolerance = options.tolerance ?? 48;
  const idx = (x: number, y: number) => (y * width + x) * 4;

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return { pixelsFilled: 0, coverageRatio: 0, touchedBorder: false };
  }

  // Seed on (dilated) line → nudge to a nearby fillable pixel. Little
  // fingers tap lines constantly; snapping to the intended region is far
  // better UX than a dead tap. A line tap is ambiguous (shape vs.
  // background), and the child almost always means the SHAPE — so we trial
  // each candidate and prefer the first fill that stays enclosed (doesn't
  // touch the canvas border). If every candidate reaches the border, the
  // tap was between background regions; accept the nearest one.
  let sx = startX;
  let sy = startY;
  if (lineMask[sy * width + sx]) {
    const candidates = fillableCandidates(lineMask, width, height, sx, sy, 6);
    if (candidates.length === 0) {
      return { pixelsFilled: 0, coverageRatio: 0, touchedBorder: false };
    }
    const chosen = candidates[0];
    const backup = data.slice();
    const skip = new Uint8Array(candidates.length);
    let trials = 0;
    for (let c = 0; c < candidates.length && trials < 4; c++) {
      if (skip[c]) continue;
      const [cx, cy] = candidates[c];
      const trial = magicFillMaskedCore(data, lineMask, width, height, cx, cy, fillColor, tolerance);
      trials++;
      if (trial.pixelsFilled > 0 && !trial.touchedBorder) {
        return trial; // enclosed region found — keep this fill
      }
      // Before rolling back, mark every other candidate this failed fill
      // reached — they're in the same region, so retrying them is pointless.
      for (let k = c + 1; k < candidates.length; k++) {
        const [kx, ky] = candidates[k];
        const ki = (ky * width + kx) * 4;
        if (
          data[ki] === fillColor.r &&
          data[ki + 1] === fillColor.g &&
          data[ki + 2] === fillColor.b
        ) {
          skip[k] = 1;
        }
      }
      data.set(backup); // restore and try the next distinct region
    }
    [sx, sy] = chosen; // no enclosed region nearby — fill nearest (background)
  }

  return magicFillMaskedCore(data, lineMask, width, height, sx, sy, fillColor, tolerance);
}

/** The scanline core, boundary decided by the (dilated) line mask. */
function magicFillMaskedCore(
  data: Uint8ClampedArray,
  lineMask: Uint8Array,
  width: number,
  height: number,
  sx: number,
  sy: number,
  fillColor: RGBA,
  tolerance: number,
): FillResult {
  const idx = (x: number, y: number) => (y * width + x) * 4;

  const si = idx(sx, sy);
  const seed: RGBA = { r: data[si], g: data[si + 1], b: data[si + 2], a: data[si + 3] };

  const matches = (p: number, i: number): boolean => {
    if (lineMask[p]) return false;
    return (
      Math.abs(data[i] - seed.r) <= tolerance &&
      Math.abs(data[i + 1] - seed.g) <= tolerance &&
      Math.abs(data[i + 2] - seed.b) <= tolerance
    );
  };

  const visited = new Uint8Array(width * height);
  let pixelsFilled = 0;
  let touchedBorder = false;
  const stack: number[] = [sx, sy];

  while (stack.length > 0) {
    const y = stack.pop() as number;
    let x = stack.pop() as number;

    while (x >= 0 && !visited[y * width + x] && matches(y * width + x, idx(x, y))) x--;
    x++;

    let spanAbove = false;
    let spanBelow = false;

    while (x < width && !visited[y * width + x] && matches(y * width + x, idx(x, y))) {
      const p = y * width + x;
      const i = idx(x, y);
      visited[p] = 1;
      data[i] = fillColor.r;
      data[i + 1] = fillColor.g;
      data[i + 2] = fillColor.b;
      data[i + 3] = fillColor.a;
      pixelsFilled++;

      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) touchedBorder = true;

      if (y > 0) {
        const ap = (y - 1) * width + x;
        const above = !visited[ap] && matches(ap, idx(x, y - 1));
        if (above && !spanAbove) {
          stack.push(x, y - 1);
          spanAbove = true;
        } else if (!above) spanAbove = false;
      }
      if (y < height - 1) {
        const bp = (y + 1) * width + x;
        const below = !visited[bp] && matches(bp, idx(x, y + 1));
        if (below && !spanBelow) {
          stack.push(x, y + 1);
          spanBelow = true;
        } else if (!below) spanBelow = false;
      }
      x++;
    }
  }

  return { pixelsFilled, coverageRatio: pixelsFilled / (width * height), touchedBorder };
}

/**
 * All non-line pixels within `maxRadius` of (x, y), ordered by ring
 * distance (nearest first). Ring-ordered so trial fills test the most
 * plausible tap targets before farther ones.
 */
function fillableCandidates(
  lineMask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  maxRadius: number,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring only
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (!lineMask[ny * width + nx]) out.push([nx, ny]);
      }
    }
  }
  return out;
}
