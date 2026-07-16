// Dev utility: render every character×setting/page sample into one HTML
// grid for visual review. Run from apps/web:
//   node --experimental-strip-types scripts/art-review.mjs <outfile.html>
import { lineArtDataUrl } from "../src/lib/lineArt.ts";
import { writeFileSync } from "node:fs";

const combos = [
  ["unicorn", "beach", 0],
  ["dinosaur", "farm", 1],
  ["princess", "castle", 2],
  ["robot", "space", 0],
  ["puppy", "forest", 1],
  ["unicorn", "space", 3],
  ["dinosaur", "beach", 1],
  ["princess", "forest", 3],
  ["robot", "farm", 2],
  ["puppy", "castle", 0],
  ["dinosaur", "space", 2],
  ["unicorn", "farm", 3],
];

const cells = combos
  .map(
    ([c, s, p]) =>
      `<figure><img src="${lineArtDataUrl(c, s, p)}" width="440"><figcaption>${c} / ${s} / p${p + 1}</figcaption></figure>`,
  )
  .join("\n");

writeFileSync(
  process.argv[2] ?? "art-review.html",
  `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#eee;font:14px sans-serif}
  main{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px}
  figure{margin:0;background:#fff}img{display:block;width:100%}
  figcaption{padding:2px 6px;color:#c00}
  </style><main>${cells}</main>`,
);
console.log(`wrote ${combos.length} cells`);
