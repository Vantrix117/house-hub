// Skeptic s2, UX-TIMER-4: recompute the running-vs-done luminance ratios from design.css itself (per-theme --terra,
// which --danger aliases at design.css:82) for the two seed accents nearest to terra: Elizabeth #8A6A4B, Mae #BC5A38
// (worker/seed.sql:5,8). Also the dim-phase contrast of the done digits (opacity .3, design.css blink) on the dial face.
// Usage: node audits/tools/phase5/ux-verify/UX-TIMER-4/s2-done-ratios.mjs
import fs from 'node:fs';
const css = fs.readFileSync('apps/design.css', 'utf8');
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const L = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; const [r, g, b] = c.map(f); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a, b) => { const x = L(a), y = L(b); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2); };
const block = sel => { const i = css.indexOf(sel); const j = css.indexOf('}', i); return css.slice(i, j); };
const terra = b => hex(/--terra:\s*(#[0-9A-Fa-f]{6})/.exec(b)[1]);
const themes = { hearth: terra(block(':root {')), parchment: terra(block(':root[data-theme="parchment"]')), frost: terra(block(':root[data-theme="frost"]')),
  midnight: terra(block(':root[data-theme="midnight"]')), forest: terra(block(':root[data-theme="forest"]')) };
const people = { elizabeth: hex('#8A6A4B'), mae: hex('#BC5A38') };
const out = {};
for (const [t, d] of Object.entries(themes)) { out[t] = { danger: d }; for (const [p, a] of Object.entries(people)) out[t][p] = ratio(a, d); }
// dim phase: danger at opacity .3 over a near-white dial face (the screenshot's face, lum ≈ 250 → ~#FBF7F2)
const face = hex('#FBF7F2'), mix = (c, a) => c.map((v, i) => Math.round(v * a + face[i] * (1 - a)));
out.dimPhaseHearth = { digits: mix(themes.hearth, .3), vsFace: ratio(mix(themes.hearth, .3), face), fullPhaseVsFace: ratio(themes.hearth, face) };
fs.writeFileSync('audits/evidence/p5/ux-verify/UX-TIMER-4/s2/done-ratios.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
