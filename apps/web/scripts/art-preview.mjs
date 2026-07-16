// Dev utility: dump a sample of generated line-art data URLs to JSON so a
// browser can rasterize them into a review collage. Run from apps/web:
//   node --experimental-strip-types scripts/art-preview.mjs <outfile>
import { lineArtDataUrl } from "../src/lib/lineArt.ts";
import { writeFileSync } from "node:fs";

const combos = [
  ["unicorn", "beach", 0],
  ["dinosaur", "farm", 1],
  ["princess", "castle", 2],
  ["robot", "space", 0],
  ["puppy", "forest", 1],
  ["unicorn", "space", 3],
];

const out = combos.map(([c, s, p]) => ({ label: `${c}/${s}/p${p + 1}`, url: lineArtDataUrl(c, s, p) }));
writeFileSync(process.argv[2] ?? "art-preview.json", JSON.stringify(out));
console.log(`wrote ${out.length} scenes`);
