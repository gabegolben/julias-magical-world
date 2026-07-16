/**
 * Procedural coloring-page art for the demo (pre-AI).
 *
 * Each (character, setting, page) triple renders a deterministic SVG scene:
 * chunky #37305A outlines on white — the exact contract the magic-fill
 * engine expects (line = luminance <= 96, fillable = white). Shapes are
 * closed and regions are toddler-sized on purpose.
 *
 * When the DALL-E/SD pipeline ships, this module stays as the offline
 * fallback and the test fixture generator for the fill engine.
 */

import type { CharacterKey, SettingKey } from "./stories";

const INK = "#37305A";
const W = 1000;
const H = 760;

const S = `stroke="${INK}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"`;

const shape = (d: string) => `<path d="${d}" fill="white" ${S}/>`;
const stroke = (d: string, w = 7) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`;
const circle = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" ${S}/>`;
const ellipse = (cx: number, cy: number, rx: number, ry: number, rot = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white" ${S}${
    rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ""
  }/>`;
const rect = (x: number, y: number, w: number, h: number, rx = 10) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="white" ${S}/>`;
const dot = (cx: number, cy: number, r = 7) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK}"/>`;
const g = (x: number, y: number, scale: number, inner: string) =>
  `<g transform="translate(${x} ${y}) scale(${scale})">${inner}</g>`;

function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(1)},${(cy + rad * Math.sin(ang)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}
const star = (cx: number, cy: number, r: number) => shape(starPath(cx, cy, r));

const sun = (cx: number, cy: number, r: number) => {
  let rays = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = cx + (r + 18) * Math.cos(a);
    const y1 = cy + (r + 18) * Math.sin(a);
    const x2 = cx + (r + 52) * Math.cos(a);
    const y2 = cy + (r + 52) * Math.sin(a);
    rays += stroke(`M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`, 9);
  }
  return rays + circle(cx, cy, r);
};

const cloud = (cx: number, cy: number, s = 1) =>
  g(
    cx,
    cy,
    s,
    shape(
      "M-95,25 Q-130,25 -130,-5 Q-130,-38 -95,-35 Q-85,-70 -40,-65 Q0,-62 5,-35 Q45,-42 55,-10 Q60,25 20,25 Z",
    ),
  );

const moon = (cx: number, cy: number, r: number) =>
  circle(cx, cy, r) + circle(cx - r * 0.3, cy - r * 0.25, r * 0.18) + circle(cx + r * 0.3, cy + r * 0.3, r * 0.13);

/* ------------------------------------------------------------------ */
/* Characters — drawn around (0,0) = center of feet, extending upward. */
/* ------------------------------------------------------------------ */

const unicorn =
  rect(-98, -92, 26, 92, 12) +
  rect(-52, -92, 26, 92, 12) +
  rect(30, -92, 26, 92, 12) +
  rect(72, -92, 26, 92, 12) +
  circle(-118, -152, 26) +
  circle(-138, -116, 21) +
  circle(-122, -86, 16) +
  ellipse(0, -125, 112, 72) +
  shape("M55,-165 L98,-255 L140,-255 L108,-140 Z") +
  circle(48, -215, 23) +
  circle(66, -252, 23) +
  circle(88, -285, 23) +
  shape("M148,-308 L164,-385 L181,-303 Z") +
  shape("M103,-308 L114,-346 L136,-303 Z") +
  circle(128, -272, 46) +
  dot(140, -278) +
  stroke("M152,-248 q10,10 24,3");

const dinosaur =
  rect(-110, -82, 30, 82, 12) +
  rect(-56, -82, 30, 82, 12) +
  rect(32, -82, 30, 82, 12) +
  rect(82, -82, 30, 82, 12) +
  shape("M-118,-140 Q-215,-165 -250,-92 Q-198,-112 -112,-80 Z") +
  ellipse(0, -115, 132, 76) +
  shape("M-62,-182 L-42,-220 L-22,-182 Z") +
  shape("M-16,-186 L4,-226 L24,-186 Z") +
  shape("M30,-182 L50,-220 L70,-182 Z") +
  shape("M78,-165 L118,-300 L165,-300 L128,-145 Z") +
  ellipse(150, -318, 52, 37) +
  dot(162, -328) +
  stroke("M182,-305 q9,9 20,3");

const princess =
  shape("M0,-195 L-98,0 L98,0 Z") +
  stroke("M-64,-68 Q0,-38 64,-68") +
  shape("M-26,-186 L-72,-122 L-56,-108 L-14,-168 Z") +
  shape("M26,-186 L72,-122 L56,-108 L14,-168 Z") +
  circle(-66, -114, 14) +
  circle(66, -114, 14) +
  circle(-56, -226, 16) +
  circle(-62, -196, 13) +
  circle(56, -226, 16) +
  circle(62, -196, 13) +
  circle(0, -238, 47) +
  shape("M-47,-252 Q-52,-300 0,-302 Q52,-300 47,-252 Q20,-268 0,-266 Q-20,-268 -47,-252 Z") +
  shape("M-28,-288 L-28,-320 L-14,-300 L0,-326 L14,-300 L28,-320 L28,-288 Z") +
  dot(-16, -238, 6) +
  dot(16, -238, 6) +
  stroke("M-13,-218 q13,13 26,0");

const robot =
  rect(-55, -22, 48, 22, 8) +
  rect(7, -22, 48, 22, 8) +
  rect(-45, -72, 28, 52, 8) +
  rect(17, -72, 28, 52, 8) +
  rect(-118, -180, 48, 24, 10) +
  rect(70, -180, 48, 24, 10) +
  circle(-128, -168, 17) +
  circle(128, -168, 17) +
  rect(-70, -192, 140, 122, 15) +
  circle(0, -132, 26) +
  dot(-42, -100, 6) +
  dot(42, -100, 6) +
  rect(-16, -208, 32, 16, 6) +
  stroke("M0,-282 L0,-318", 8) +
  circle(0, -330, 11) +
  rect(-51, -282, 102, 74, 12) +
  circle(-25, -246, 13) +
  circle(25, -246, 13) +
  dot(-25, -246, 5) +
  dot(25, -246, 5) +
  stroke("M-16,-222 L16,-222", 7);

const puppy =
  rect(-78, -46, 24, 46, 11) +
  rect(-40, -46, 24, 46, 11) +
  rect(18, -46, 24, 46, 11) +
  rect(54, -46, 24, 46, 11) +
  shape("M-88,-122 Q-142,-172 -132,-108 Q-124,-86 -94,-94 Z") +
  ellipse(0, -92, 96, 62) +
  circle(-20, -95, 22) +
  ellipse(52, -218, 19, 32, -22) +
  ellipse(122, -212, 19, 32, 18) +
  circle(86, -172, 56) +
  ellipse(102, -148, 26, 18) +
  dot(112, -152, 9) +
  dot(68, -188, 6) +
  dot(104, -190, 6) +
  stroke("M92,-136 q10,8 22,1");

const CHARACTERS: Record<CharacterKey, string> = { unicorn, dinosaur, princess, robot, puppy };

/**
 * The child protagonist — deliberately generic (round face, short wavy
 * hair, tee + shorts) so any kid can see themselves in it. Drawn when a
 * parent added a name (Plan Weeks 5-6: optional name insertion).
 */
const child =
  rect(-34, -60, 26, 60, 11) +
  rect(8, -60, 26, 60, 11) +
  shape("M-30,-152 L-68,-92 L-52,-80 L-18,-136 Z") +
  shape("M30,-152 L68,-92 L52,-80 L18,-136 Z") +
  circle(-60, -84, 12) +
  circle(60, -84, 12) +
  shape("M-38,-160 L38,-160 L46,-55 L-46,-55 Z") +
  stroke("M-46,-98 L46,-98", 7) +
  circle(0, -200, 44) +
  shape("M-44,-212 Q-38,-262 0,-262 Q38,-262 44,-212 Q28,-234 12,-226 Q0,-244 -14,-226 Q-30,-234 -44,-212 Z") +
  dot(-15, -202, 6) +
  dot(15, -202, 6) +
  stroke("M-12,-182 q12,12 24,0");

/* --------------------------------------------------------- */
/* Settings — each returns scene art + character placement.   */
/* --------------------------------------------------------- */

interface Scene {
  art: string;
  charX: number;
  charY: number;
  charScale: number;
}

const sandGround = shape("M-20,545 Q250,512 500,542 Q750,572 1020,542 L1020,780 L-20,780 Z");
const waveLines =
  stroke("M545,600 q30,-26 60,0 q30,26 60,0", 8) + stroke("M650,650 q30,-26 60,0 q30,26 60,0", 8);

const sandcastle =
  rect(575, 425, 56, 195, 8) +
  rect(770, 425, 56, 195, 8) +
  rect(628, 472, 145, 148, 8) +
  shape("M568,425 L603,368 L638,425 Z") +
  shape("M763,425 L798,368 L833,425 Z") +
  stroke("M603,368 L603,330", 7) +
  shape("M603,330 L648,345 L603,362 Z") +
  shape("M672,620 L672,555 Q700,522 728,555 L728,620 Z");

const crab = (cx: number, cy: number) =>
  g(
    cx,
    cy,
    1,
    stroke("M-38,-58 L-58,-88", 8) +
      stroke("M38,-58 L58,-88", 8) +
      circle(-58, -95, 10) +
      circle(58, -95, 10) +
      stroke("M-44,-18 L-78,-2", 8) +
      stroke("M-40,0 L-70,20", 8) +
      stroke("M44,-18 L78,-2", 8) +
      stroke("M40,0 L70,20", 8) +
      circle(-78, -40, 24) +
      circle(78, -40, 24) +
      circle(0, -35, 46) +
      dot(-15, -45, 6) +
      dot(15, -45, 6) +
      stroke("M-12,-22 q12,10 24,0"),
  );

const boat =
  shape("M85,472 L235,472 L205,525 L112,525 Z") +
  stroke("M158,466 L158,352", 8) +
  shape("M166,358 L242,462 L166,462 Z");

function beach(page: number): Scene {
  const parts: string[] = [];
  if (page === 3) {
    parts.push(sun(500, 480, 78), sandGround, cloud(190, 140), boat);
    return { art: parts.join(""), charX: 730, charY: 668, charScale: 0.85 };
  }
  parts.push(sun(845, 118, 62), sandGround);
  if (page === 0) parts.push(cloud(230, 130), waveLines);
  if (page === 1) parts.push(cloud(200, 120, 0.8), sandcastle);
  if (page === 2) parts.push(cloud(200, 120, 0.8), crab(720, 640));
  return { art: parts.join(""), charX: 285, charY: 662, charScale: 0.9 };
}

const forestGround = shape("M-20,562 Q250,520 500,558 Q750,596 1020,558 L1020,780 L-20,780 Z");

const tree = (x: number, gy: number, s = 1) =>
  g(
    x,
    gy,
    s,
    rect(-26, -175, 52, 175, 16) +
      circle(-72, -215, 56) +
      circle(72, -215, 56) +
      circle(0, -268, 88),
  );

const mushroom = (cx: number, cy: number) =>
  g(
    cx,
    cy,
    1,
    rect(-30, -72, 60, 72, 18) +
      shape("M-80,-72 Q-80,-158 0,-158 Q80,-158 80,-72 Z") +
      circle(-32, -110, 11) +
      circle(12, -132, 11) +
      circle(40, -98, 10) +
      shape("M-14,-40 L-14,-6 Q0,-18 14,-6 L14,-40 Z"),
  );

const butterfly = (cx: number, cy: number) =>
  g(
    cx,
    cy,
    1,
    ellipse(-40, -32, 36, 48, -22) +
      ellipse(40, -32, 36, 48, 22) +
      ellipse(-32, 28, 26, 32, 18) +
      ellipse(32, 28, 26, 32, -18) +
      ellipse(0, 0, 13, 42) +
      stroke("M-6,-38 Q-14,-62 -26,-70", 6) +
      stroke("M6,-38 Q14,-62 26,-70", 6),
  );

function forest(page: number): Scene {
  const parts: string[] = [];
  if (page === 3) {
    parts.push(
      moon(140, 130, 55),
      star(500, 115, 30),
      star(700, 85, 25),
      star(880, 165, 30),
      star(340, 75, 22),
      forestGround,
      tree(780, 640, 1),
    );
    return { art: parts.join(""), charX: 300, charY: 655, charScale: 0.9 };
  }
  parts.push(sun(120, 118, 58), forestGround);
  if (page === 0) parts.push(tree(700, 630, 1), tree(905, 655, 0.75), cloud(420, 110, 0.8));
  if (page === 1) parts.push(tree(840, 640, 1), mushroom(620, 645), cloud(500, 110, 0.8));
  if (page === 2) parts.push(tree(840, 640, 1), butterfly(560, 300), cloud(640, 130, 0.8));
  return { art: parts.join(""), charX: 300, charY: 655, charScale: 0.9 };
}

const hillGround = shape("M-20,612 Q500,468 1020,612 L1020,780 L-20,780 Z");

const castle = (() => {
  const cx = 670;
  return (
    rect(cx - 150, 262, 64, 268, 6) +
    rect(cx + 86, 262, 64, 268, 6) +
    shape(`M${cx - 158},262 L${cx - 118},188 L${cx - 78},262 Z`) +
    shape(`M${cx + 78},262 L${cx + 118},188 L${cx + 158},262 Z`) +
    stroke(`M${cx - 118},188 L${cx - 118},148`, 7) +
    shape(`M${cx - 118},148 L${cx - 70},163 L${cx - 118},178 Z`) +
    stroke(`M${cx + 118},188 L${cx + 118},148`, 7) +
    shape(`M${cx + 118},148 L${cx + 166},163 L${cx + 118},178 Z`) +
    rect(cx - 100, 330, 200, 200, 6) +
    rect(cx - 88, 302, 30, 28, 5) +
    rect(cx - 15, 302, 30, 28, 5) +
    rect(cx + 58, 302, 30, 28, 5) +
    circle(cx, 385, 23) +
    shape(`M${cx - 36},530 L${cx - 36},458 Q${cx},415 ${cx + 36},458 L${cx + 36},530 Z`)
  );
})();

const steps =
  rect(620, 530, 100, 26, 6) + rect(600, 556, 140, 26, 6) + rect(580, 582, 180, 26, 6);

const balloons = (cx: number, cy: number) =>
  g(
    cx,
    cy,
    1,
    stroke("M-68,-2 Q-40,60 0,118", 6) +
      stroke("M12,-38 Q8,40 0,118", 6) +
      stroke("M80,18 Q40,70 0,118", 6) +
      circle(-70, -40, 38) +
      circle(12, -80, 38) +
      circle(82, -20, 38),
  );

const bunting = (() => {
  let out = stroke("M55,95 Q500,45 945,80", 8);
  const flags: Array<[number, number]> = [
    [140, 88],
    [280, 76],
    [420, 66],
    [560, 63],
    [700, 66],
    [840, 73],
  ];
  for (const [x, y] of flags) out += shape(`M${x - 24},${y} L${x},${y + 52} L${x + 24},${y - 4} Z`);
  return out;
})();

function castleScene(page: number): Scene {
  const parts: string[] = [];
  if (page === 0) parts.push(sun(140, 128, 58), cloud(330, 105, 0.85), hillGround, castle);
  if (page === 1) parts.push(sun(140, 128, 58), cloud(280, 110, 0.8), hillGround, castle, steps);
  if (page === 2) parts.push(sun(120, 118, 52), hillGround, castle, balloons(270, 260));
  if (page === 3) parts.push(bunting, star(180, 210, 26), star(890, 230, 26), hillGround, castle);
  return { art: parts.join(""), charX: 290, charY: 692, charScale: 0.9 };
}

const rocket = (cx: number, cy: number, s = 1) =>
  g(
    cx,
    cy,
    s,
    shape("M-95,-60 L-162,42 L-95,20 Z") +
      shape("M95,-60 L162,42 L95,20 Z") +
      shape("M-45,12 Q0,112 45,12 Q0,52 -45,12 Z") +
      shape("M0,-322 Q95,-192 95,0 L-95,0 Q-95,-192 0,-322 Z") +
      circle(0, -160, 43) +
      stroke("M-60,-38 L60,-38", 8),
  );

const moonGround =
  shape("M-20,622 Q500,522 1020,622 L1020,780 L-20,780 Z") +
  ellipse(300, 692, 46, 18) +
  ellipse(650, 672, 36, 14) +
  ellipse(860, 714, 30, 12);

const planet = (cx: number, cy: number) =>
  circle(cx, cy, 90) +
  circle(cx - 30, cy - 25, 18) +
  circle(cx + 32, cy + 28, 13) +
  `<ellipse cx="${cx}" cy="${cy + 6}" rx="152" ry="42" fill="none" ${S}/>`;

const starFriend = (cx: number, cy: number) =>
  star(cx, cy, 118) + dot(cx - 34, cy - 20, 8) + dot(cx + 34, cy - 20, 8) + stroke(`M${cx - 32},${cy + 22} q32,28 64,0`);

function space(page: number): Scene {
  const parts: string[] = [];
  if (page === 0) {
    parts.push(star(150, 150, 28), star(320, 560, 24), star(870, 420, 30), rocket(650, 560, 1.1));
    return { art: parts.join(""), charX: 240, charY: 470, charScale: 0.85 };
  }
  if (page === 1) {
    parts.push(circle(855, 140, 55), stroke("M818,120 q20,26 40,6 q20,-20 34,6", 7), star(340, 120, 26), star(600, 90, 22), moonGround);
    return { art: parts.join(""), charX: 430, charY: 645, charScale: 0.95 };
  }
  if (page === 2) {
    parts.push(star(180, 140, 24), star(880, 130, 28), star(830, 560, 20), starFriend(660, 400));
    return { art: parts.join(""), charX: 270, charY: 610, charScale: 0.9 };
  }
  parts.push(moon(180, 150, 52), star(420, 100, 24), star(560, 250, 20), star(880, 520, 24), star(330, 560, 20), planet(700, 310));
  return { art: parts.join(""), charX: 330, charY: 640, charScale: 0.9 };
}

const farmGround = shape("M-20,602 Q500,572 1020,602 L1020,780 L-20,780 Z");

const barn = (() => {
  const cx = 720;
  return (
    rect(cx - 130, 340, 260, 222, 8) +
    shape(`M${cx - 152},340 L${cx},215 L${cx + 152},340 Z`) +
    rect(cx - 45, 442, 90, 120, 8) +
    stroke(`M${cx - 45},442 L${cx + 45},562`, 7) +
    stroke(`M${cx + 45},442 L${cx - 45},562`, 7) +
    circle(cx, 298, 26)
  );
})();

const fence = (() => {
  let out = rect(62, 512, 320, 15, 7) + rect(62, 552, 320, 15, 7);
  for (let i = 0; i < 4; i++) out += rect(80 + i * 88, 490, 20, 100, 8);
  return out;
})();

const chicken = (cx: number, cy: number, s = 1) =>
  g(
    cx,
    cy,
    s,
    stroke("M-14,-8 L-14,8", 7) +
      stroke("M14,-8 L14,8", 7) +
      shape("M-14,-86 Q-8,-104 0,-88 Q8,-104 14,-86 Z") +
      circle(0, -48, 42) +
      shape("M38,-56 L60,-48 L38,-40 Z") +
      dot(14, -58, 6) +
      stroke("M-24,-48 q14,14 30,4", 7),
  );

const pig = (cx: number, cy: number, s = 1) =>
  g(
    cx,
    cy,
    s,
    rect(-52, -30, 20, 30, 9) +
      rect(-14, -30, 20, 30, 9) +
      rect(24, -30, 20, 30, 9) +
      stroke("M-62,-70 q-22,-16 -10,-34 q12,-10 16,4", 7) +
      ellipse(0, -62, 68, 48) +
      shape("M22,-102 L38,-128 L52,-98 Z") +
      shape("M48,-96 L66,-120 L76,-88 Z") +
      ellipse(58, -60, 18, 14) +
      dot(52, -62, 4) +
      dot(64, -62, 4) +
      dot(34, -76, 6),
  );

const tractor = (cx: number, cy: number) =>
  g(
    cx,
    cy,
    1,
    rect(104, -200, 20, 48, 6) +
      rect(-48, -232, 96, 88, 12) +
      stroke("M-30,-214 L30,-214", 7) +
      rect(-56, -156, 196, 62, 12) +
      circle(0, -60, 62) +
      dot(0, -60, 12) +
      circle(124, -46, 44) +
      dot(124, -46, 10),
  );

function farm(page: number): Scene {
  const parts: string[] = [];
  if (page === 3) {
    parts.push(moon(150, 122, 52), star(420, 95, 24), star(560, 180, 20), star(300, 210, 18), farmGround, barn, fence);
    return { art: parts.join(""), charX: 330, charY: 682, charScale: 0.9 };
  }
  parts.push(sun(128, 118, 58), farmGround);
  if (page === 0) parts.push(cloud(350, 110, 0.8), barn, fence);
  if (page === 1) parts.push(cloud(880, 110, 0.75), pig(470, 665), chicken(620, 645), chicken(720, 660, 0.72));
  if (page === 2) parts.push(cloud(880, 110, 0.75), tractor(640, 645));
  return { art: parts.join(""), charX: 250, charY: 682, charScale: 0.9 };
}

const SCENES: Record<SettingKey, (page: number) => Scene> = {
  beach,
  forest,
  castle: castleScene,
  space,
  farm,
};

/** Full coloring page as an SVG data URL, safe to draw on a canvas (no CORS taint). */
export function lineArtDataUrl(
  character: CharacterKey,
  setting: SettingKey,
  page: number,
  withChild = false,
): string {
  const scene = SCENES[setting](page);
  const char = g(scene.charX, scene.charY, scene.charScale, CHARACTERS[character]);
  // Child stands canvas-inward from the character; drawn after the scene so
  // its white fill reads as standing in front of fences/hills.
  const kid = withChild
    ? g(
        scene.charX + (scene.charX >= 500 ? 160 : -160) * scene.charScale,
        scene.charY,
        scene.charScale * 0.92,
        child,
      )
    : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="white"/>${scene.art}${kid}${char}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
