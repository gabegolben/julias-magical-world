/**
 * Magic Fill — scanline flood fill for coloring-book line art.
 *
 * Design constraints (from Implementation Plan, Weeks 7–9):
 * - Operates directly on ImageData-compatible RGBA buffers (works in any
 *   browser canvas AND in Node for testing — zero dependencies).
 * - Tolerance-based matching: AI-generated line art has anti-aliased edges,
 *   so exact-color matching leaks through soft pixels.
 * - Line-aware: dark pixels are treated as hard boundaries regardless of
 *   tolerance, so the fill can never "eat" the line art.
 * - Scanline algorithm: ~5-10x faster than naive 4-way BFS, no recursion,
 *   safe for large canvases on low-end tablets.
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FillOptions {
  /** 0-255. How far a pixel may differ from the seed color and still fill. */
  tolerance?: number;
  /**
   * Luminance (0-255) at or below which a pixel counts as "line art" and is
   * never filled. Protects outlines even at high tolerance.
   */
  lineLuminanceThreshold?: number;
  /**
   * If set, fill slightly under the line edges by this many pixels so no
   * white halo remains between fill and outline. 1 is usually right.
   */
  bleed?: number;
}

export interface FillResult {
  /** Number of pixels filled. 0 means the seed was on a line or already the fill color. */
  pixelsFilled: number;
  /** Fraction of the whole canvas that was filled. >0.5 usually means a leak (open region). */
  coverageRatio: number;
  /** True if the fill touched the canvas border — strong signal of a region leak. */
  touchedBorder: boolean;
}

const luminance = (r: number, g: number, b: number): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Fill the enclosed region containing (startX, startY) with fillColor.
 * Mutates `data` in place. Returns diagnostics used by the quality gate.
 */
export function magicFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fillColor: RGBA,
  options: FillOptions = {},
): FillResult {
  const tolerance = options.tolerance ?? 48;
  const lineThreshold = options.lineLuminanceThreshold ?? 96;

  const idx = (x: number, y: number) => (y * width + x) * 4;

  const inBounds = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height;

  if (!inBounds(startX, startY)) {
    return { pixelsFilled: 0, coverageRatio: 0, touchedBorder: false };
  }

  const si = idx(startX, startY);
  const seed: RGBA = { r: data[si], g: data[si + 1], b: data[si + 2], a: data[si + 3] };

  // Seed on line art → no-op (tapping the outline shouldn't recolor it).
  if (luminance(seed.r, seed.g, seed.b) <= lineThreshold) {
    return { pixelsFilled: 0, coverageRatio: 0, touchedBorder: false };
  }

  // Seed already the fill color → no-op.
  if (
    seed.r === fillColor.r &&
    seed.g === fillColor.g &&
    seed.b === fillColor.b &&
    seed.a === fillColor.a
  ) {
    return { pixelsFilled: 0, coverageRatio: 0, touchedBorder: false };
  }

  const matches = (i: number): boolean => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Hard boundary: line pixels never match.
    if (luminance(r, g, b) <= lineThreshold) return false;
    return (
      Math.abs(r - seed.r) <= tolerance &&
      Math.abs(g - seed.g) <= tolerance &&
      Math.abs(b - seed.b) <= tolerance
    );
  };

  const visited = new Uint8Array(width * height);
  const setPixel = (i: number) => {
    data[i] = fillColor.r;
    data[i + 1] = fillColor.g;
    data[i + 2] = fillColor.b;
    data[i + 3] = fillColor.a;
  };

  let pixelsFilled = 0;
  let touchedBorder = false;

  // Scanline flood fill with an explicit stack of (x, y) seeds.
  const stack: number[] = [startX, startY];

  while (stack.length > 0) {
    const y = stack.pop() as number;
    let x = stack.pop() as number;

    // Walk left to the start of this run.
    while (x >= 0 && !visited[y * width + x] && matches(idx(x, y))) x--;
    x++;

    let spanAbove = false;
    let spanBelow = false;

    while (x < width && !visited[y * width + x] && matches(idx(x, y))) {
      const vi = y * width + x;
      visited[vi] = 1;
      setPixel(idx(x, y));
      pixelsFilled++;

      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        touchedBorder = true;
      }

      // Queue spans above and below (classic scanline bookkeeping).
      if (y > 0) {
        const above = matches(idx(x, y - 1)) && !visited[(y - 1) * width + x];
        if (above && !spanAbove) {
          stack.push(x, y - 1);
          spanAbove = true;
        } else if (!above) {
          spanAbove = false;
        }
      }
      if (y < height - 1) {
        const below = matches(idx(x, y + 1)) && !visited[(y + 1) * width + x];
        if (below && !spanBelow) {
          stack.push(x, y + 1);
          spanBelow = true;
        } else if (!below) {
          spanBelow = false;
        }
      }
      x++;
    }
  }

  return {
    pixelsFilled,
    coverageRatio: pixelsFilled / (width * height),
    touchedBorder,
  };
}

/**
 * Safe fill with automatic leak detection and rollback.
 *
 * AI-generated line art sometimes has open regions. If a fill floods more
 * than `maxCoverage` of the canvas or touches the border from an interior
 * seed, we treat it as a leak, restore the original pixels, and report
 * failure so the UI can fall back (e.g., re-run after gap closing, or show
 * a gentle "try tapping somewhere else" hint).
 */
export function magicFillSafe(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fillColor: RGBA,
  options: FillOptions & { maxCoverage?: number } = {},
): FillResult & { leaked: boolean } {
  const maxCoverage = options.maxCoverage ?? 0.6;
  const backup = data.slice();

  const result = magicFill(data, width, height, startX, startY, fillColor, options);

  const interiorSeed =
    startX > width * 0.1 &&
    startX < width * 0.9 &&
    startY > height * 0.1 &&
    startY < height * 0.9;

  const leaked =
    result.coverageRatio > maxCoverage || (interiorSeed && result.touchedBorder);

  if (leaked) {
    data.set(backup);
    return { ...result, pixelsFilled: 0, leaked: true };
  }

  return { ...result, leaked: false };
}
