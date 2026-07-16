// Dev utility: review the child-companion figure across scenes.
//   node --experimental-strip-types scripts/child-review.mjs <outfile.html>
import { lineArtDataUrl } from "../src/lib/lineArt.ts";
import { writeFileSync } from "node:fs";

const combos = [
  ["unicorn", "beach", 0],
  ["dinosaur", "farm", 0],
  ["princess", "castle", 2],
  ["robot", "space", 1],
  ["puppy", "forest", 3],
  ["unicorn", "beach", 3],
];

const cells = combos
  .map(
    ([c, s, p]) =>
      `<figure><img src="${lineArtDataUrl(c, s, p, true)}" width="440"><figcaption>${c} / ${s} / p${p + 1} + child</figcaption></figure>`,
  )
  .join("\n");

writeFileSync(
  process.argv[2] ?? "child-review.html",
  `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#eee;font:14px sans-serif}
  main{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px}
  figure{margin:0;background:#fff}img{display:block;width:100%}
  figcaption{padding:2px 6px;color:#c00}
  </style><main>${cells}</main>`,
);
console.log(`wrote ${combos.length} cells`);
