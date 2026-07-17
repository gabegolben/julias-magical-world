/**
 * Line-art quality gate (Plan Week 3, Risk #1) — the biggest technical
 * unknown made measurable: we score generated images with the SAME engine
 * children color with. An image passes only if magic fill will actually work
 * on it. Used post-generation in the pipeline and as the objective metric in
 * the image-model bake-off.
 */

// Direct .ts imports: this package runs under node --experimental-strip-types,
// which does not rewrite the package's .js specifiers (webpack does, for the app).
import { buildLineMask, dilateMask, magicFillMasked } from "../../magic-fill/src/gapClosing.ts";
import { LINE_ART_QUALITY } from "./prompts/illustration.ts";

export interface LineArtAssessment {
  ok: boolean;
  lineRatio: number;
  containedProbeRatio: number;
  probes: number;
  reasons: string[];
}

const PROBE_GRID = 5; // 5x5 interior seeds, central 60% of the canvas
const PROBE_FILL = { r: 255, g: 0, b: 255, a: 255 }; // magenta — never in line art

/** Assess RGBA pixel data (any decoded image) for fill-friendliness. */
export function assessLineArt(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): LineArtAssessment {
  const reasons: string[] = [];

  const mask = buildLineMask(data, width, height);
  let linePixels = 0;
  for (let i = 0; i < mask.length; i++) linePixels += mask[i];
  const lineRatio = linePixels / (width * height);

  if (lineRatio < LINE_ART_QUALITY.minLineRatio) reasons.push(`too little line work (${lineRatio.toFixed(3)})`);
  if (lineRatio > LINE_ART_QUALITY.maxLineRatio) reasons.push(`too dense (${lineRatio.toFixed(3)})`);

  const sealed = dilateMask(mask, width, height, 2);

  let probes = 0;
  let contained = 0;
  for (let gy = 0; gy < PROBE_GRID; gy++) {
    for (let gx = 0; gx < PROBE_GRID; gx++) {
      const x = Math.floor(width * (0.2 + (0.6 * gx) / (PROBE_GRID - 1)));
      const y = Math.floor(height * (0.2 + (0.6 * gy) / (PROBE_GRID - 1)));
      if (sealed[y * width + x]) continue; // on a line — not a probe
      probes += 1;
      const working = data.slice(); // trial fill on a copy
      const result = magicFillMasked(working, sealed, width, height, x, y, PROBE_FILL);
      // A fill that floods most of the page means broken outlines (the
      // catastrophic Risk #1 failure). Touching the border alone is fine —
      // open backgrounds are legitimate; children color those too.
      if (result.pixelsFilled > 0 && result.coverageRatio <= 0.6) contained += 1;
    }
  }

  const containedProbeRatio = probes > 0 ? contained / probes : 0;
  if (probes === 0) reasons.push("no fillable probe points");
  else if (containedProbeRatio < LINE_ART_QUALITY.minContainedProbeRatio) {
    reasons.push(`fills leak (${(containedProbeRatio * 100).toFixed(0)}% contained)`);
  }

  return { ok: reasons.length === 0, lineRatio, containedProbeRatio, probes, reasons };
}
