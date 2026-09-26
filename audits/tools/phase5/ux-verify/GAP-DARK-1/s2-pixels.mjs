// s2: sample rendered soft fills vs the card behind them in existing full-size Midnight captures.
import { readFileSync } from 'node:fs';
import { decodePng, at } from '../../../phase4/ACCENT/png.mjs';
import { cr, rgb2hex } from '../VIS-ACCENT-1/s2-colour.mjs';
const root = new URL('../../../../../', import.meta.url);
const shots = [
  ['audits/screens/verses/revealed-typical-ipad-portrait-dark.png', 820, [['Not yet btn', 110, 330, 'card', 150, 420], ['Almost btn', 330, 330, 'card', 400, 420]]],
  ['audits/evidence/p4/SCORE/shots/midnight/leftovers/main-typical-ipad-portrait-light.png', 820, [['Use it up chip', 560, 268, 'row', 500, 240], ['Aging chip', 572, 392, 'row', 520, 365], ['Fresh chip', 575, 609, 'row', 520, 585]]],
];
const out = [];
for (const [f, cssW, probes] of shots) { const img = decodePng(readFileSync(new URL(f, root))); const s = img.w / cssW;
  for (const [a, ax, ay, b, bx, by] of probes) { const A = rgb2hex(at(img, ax * s, ay * s).map(v => v / 255)), B = rgb2hex(at(img, bx * s, by * s).map(v => v / 255)); out.push({ shot: f, scale: s, probe: a, fill: A, behind: b, bg: B, ratio: +cr(A, B).toFixed(2) }); } }
console.log(JSON.stringify(out, null, 1));
