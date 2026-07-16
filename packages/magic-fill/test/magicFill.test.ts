/**
 * Magic Fill test suite — runs with zero dependencies:
 *   node --experimental-strip-types --test test/magicFill.test.ts
 *
 * Simulates the real-world failure mode from the Implementation Plan
 * (Risk #1): AI-generated line art with gaps in the outlines.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { magicFill, magicFillSafe, type RGBA } from "../src/floodFill.ts";
import { buildLineMask, dilateMask, magicFillMasked } from "../src/gapClosing.ts";

const W = 200;
const H = 200;

const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 255 };
const BLACK: RGBA = { r: 20, g: 20, b: 20, a: 255 };
const PURPLE: RGBA = { r: 147, g: 51, b: 234, a: 255 }; // Julia's favorite

/** Blank white RGBA canvas. */
function canvas(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
  }
  return d;
}

function setPx(d: Uint8ClampedArray, x: number, y: number, c: RGBA) {
  const i = (y * W + x) * 4;
  d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b; d[i + 3] = c.a;
}

function getPx(d: Uint8ClampedArray, x: number, y: number): RGBA {
  const i = (y * W + x) * 4;
  return { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] };
}

/**
 * Draw a circle outline (thickness ~2px) centred at (cx, cy).
 * If gapAngle is given, leave a gap of gapWidthPx centred at that angle —
 * simulating broken AI line art.
 */
function drawCircle(
  d: Uint8ClampedArray,
  cx: number,
  cy: number,
  radius: number,
  gapAngle?: number,
  gapWidthPx = 3,
) {
  const steps = Math.ceil(2 * Math.PI * radius * 4);
  const gapHalf = gapWidthPx / 2 / radius; // radians
  for (let s = 0; s < steps; s++) {
    const a = (s / steps) * 2 * Math.PI;
    if (gapAngle !== undefined) {
      let diff = Math.abs(a - gapAngle);
      diff = Math.min(diff, 2 * Math.PI - diff);
      if (diff < gapHalf) continue; // the gap
    }
    for (const rr of [radius - 0.5, radius, radius + 0.5]) {
      const x = Math.round(cx + rr * Math.cos(a));
      const y = Math.round(cy + rr * Math.sin(a));
      if (x >= 0 && x < W && y >= 0 && y < H) setPx(d, x, y, BLACK);
    }
  }
}

// ---------------------------------------------------------------------------

test("fills a closed circle without touching the outline", () => {
  const d = canvas();
  drawCircle(d, 100, 100, 50);

  const r = magicFill(d, W, H, 100, 100, PURPLE);

  const inside = getPx(d, 100, 100);
  assert.equal(inside.r, PURPLE.r, "centre should be purple");

  const outside = getPx(d, 10, 10);
  assert.equal(outside.r, 255, "outside must stay white");

  const line = getPx(d, 100, 50); // top of the circle outline
  assert.ok(line.r < 96, "outline must survive the fill");

  assert.ok(!r.touchedBorder, "closed region must not reach the border");
  // πr²/(W·H) ≈ 0.196 — sanity band around the analytic area.
  assert.ok(r.coverageRatio > 0.15 && r.coverageRatio < 0.25,
    `coverage ${r.coverageRatio.toFixed(3)} should be ≈ area of the circle`);
});

test("LEAK: a 3px gap floods the page with naive fill", () => {
  const d = canvas();
  drawCircle(d, 100, 100, 50, 0, 3); // gap on the right side

  const r = magicFill(d, W, H, 100, 100, PURPLE);

  assert.ok(r.touchedBorder, "leak should reach the canvas border");
  assert.ok(r.coverageRatio > 0.5, "leak should flood most of the page");
});

test("magicFillSafe detects the leak and rolls back losslessly", () => {
  const d = canvas();
  drawCircle(d, 100, 100, 50, 0, 3);
  const before = d.slice();

  const r = magicFillSafe(d, W, H, 100, 100, PURPLE);

  assert.equal(r.leaked, true, "leak must be reported");
  assert.deepEqual(d, before, "canvas must be restored byte-for-byte");
});

test("GAP CLOSING: dilated mask seals a 3px gap — fill stays contained", () => {
  const d = canvas();
  drawCircle(d, 100, 100, 50, 0, 3);

  const mask = dilateMask(buildLineMask(d, W, H), W, H, 2);
  const r = magicFillMasked(d, mask, W, H, 100, 100, PURPLE);

  assert.ok(r.pixelsFilled > 0, "fill must happen");
  assert.ok(!r.touchedBorder, "sealed region must not leak to the border");
  assert.ok(r.coverageRatio < 0.25,
    `coverage ${r.coverageRatio.toFixed(3)} should stay ≈ circle area, not flood`);

  const outside = getPx(d, 10, 10);
  assert.equal(outside.r, 255, "outside must stay white");

  // The visible line art is untouched by dilation (mask is fill-only).
  const line = getPx(d, 100, 50);
  assert.ok(line.r < 96, "visible outline unchanged");
});

test("gap closing also seals a wider 5px gap at radius 3", () => {
  const d = canvas();
  drawCircle(d, 100, 100, 50, Math.PI / 2, 5);

  const mask = dilateMask(buildLineMask(d, W, H), W, H, 3);
  const r = magicFillMasked(d, mask, W, H, 100, 100, PURPLE);

  assert.ok(r.pixelsFilled > 0 && !r.touchedBorder && r.coverageRatio < 0.25,
    "5px gap sealed at dilation radius 3");
});

test("tapping ON the line does nothing destructive (naive) / nudges inside (masked)", () => {
  const d1 = canvas();
  drawCircle(d1, 100, 100, 50);
  const r1 = magicFill(d1, W, H, 100, 50, PURPLE); // exactly on the outline
  assert.equal(r1.pixelsFilled, 0, "naive fill: line tap is a no-op");

  const d2 = canvas();
  drawCircle(d2, 100, 100, 50);
  const mask = dilateMask(buildLineMask(d2, W, H), W, H, 2);
  const r2 = magicFillMasked(d2, mask, W, H, 100, 50, PURPLE);
  assert.ok(r2.pixelsFilled > 0, "masked fill: tap on line nudges to nearest region");
  assert.ok(!r2.touchedBorder, "nudged fill stays contained");
});

test("tolerance absorbs anti-aliased (light gray) interior pixels", () => {
  const d = canvas();
  drawCircle(d, 100, 100, 50);
  // Simulate AA haze: sprinkle light-gray pixels inside the circle.
  for (let k = 0; k < 200; k++) {
    const a = Math.random() * 2 * Math.PI;
    const rr = Math.random() * 40;
    setPx(d, Math.round(100 + rr * Math.cos(a)), Math.round(100 + rr * Math.sin(a)),
      { r: 225, g: 225, b: 225, a: 255 });
  }

  const r = magicFill(d, W, H, 100, 100, PURPLE, { tolerance: 48 });
  assert.ok(r.coverageRatio > 0.15, "AA pixels absorbed into the fill");

  // No white speckles left inside a 20px box around the centre.
  let speckles = 0;
  for (let y = 90; y <= 110; y++) {
    for (let x = 90; x <= 110; x++) {
      if (getPx(d, x, y).r === 225) speckles++;
    }
  }
  assert.equal(speckles, 0, "no unfilled AA speckles near the seed");
});

test("performance: 1024×1024 full-canvas fill under 250ms", () => {
  const BW = 1024, BH = 1024;
  const d = new Uint8ClampedArray(BW * BH * 4).fill(255);
  const t0 = performance.now();
  const r = magicFill(d, BW, BH, 512, 512, PURPLE);
  const ms = performance.now() - t0;
  assert.equal(r.pixelsFilled, BW * BH, "everything filled");
  assert.ok(ms < 250, `took ${ms.toFixed(1)}ms — must be tablet-friendly`);
});
