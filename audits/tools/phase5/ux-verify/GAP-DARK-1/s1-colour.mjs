// s1 independent recompute for GAP-DARK-1 and VIS-ACCENT-1: parses apps/design.css token blocks,
// computes WCAG contrast, OKLCH and CIEDE2000 from scratch (no phase-4 code reused).
import fs from 'node:fs';
const css = fs.readFileSync('apps/design.css', 'utf8');
const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const Y = c => { const [r, g, b] = c.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const x = Y(a), y = Y(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p)); // color-mix in srgb (gamma-encoded)
function oklch(c) {
  const [r, g, b] = c.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L: +L.toFixed(3), C: +Math.hypot(A, B).toFixed(3) };
}
function lab(c) {
  const [r, g, b] = c.map(lin);
  let X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Yv = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const fx = f(X), fy = f(Yv), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function de00(c1, c2) {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2);
  const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (a, b) => { if (a === 0 && b === 0) return 0; const t = Math.atan2(b, a) / rad; return t < 0 ? t + 360 : t; };
  const h1 = h(a1p, b1), h2 = h(a2p, b2);
  const dL = L2 - L1, dC = C2p - C1p;
  let dh = 0; if (C1p * C2p) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * rad / 2);
  const Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hb = h1 + h2; if (C1p * C2p) { if (Math.abs(h1 - h2) > 180) hb = h1 + h2 < 360 ? hb + 360 : hb - 360; hb /= 2; }
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const dT = 30 * Math.exp(-(((hb - 275) / 25) ** 2)), RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + 0.015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T, RT = -Math.sin(2 * dT * rad) * RC;
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
function block(sel) { const i = css.indexOf(sel); const j = css.indexOf('}', i); return css.slice(i, j); }
function tok(b, n) { const m = b.match(new RegExp('--' + n + ':[ ]*(#[0-9A-Fa-f]{6})')); return m && hex(m[1]); }
const themes = {
  hearth: block(String.fromCharCode(10) + ':root {'), parchment: block(':root[data-theme="parchment"]'), frost: block(':root[data-theme="frost"]'),
  midnight: block(':root[data-theme="midnight"]'), forest: block(':root[data-theme="forest"]'),
};
const sems = ['mocha', 'gold', 'olive', 'teal', 'terra', 'slate'];
const people = { Eli: '#4F5D8C', Mae: '#BC5A38', Ezra: '#137F77', Kiara: '#B4861B', Elizabeth: '#8A6A4B', David: '#3D5A3D', Mea: '#5B8143' };
const out = { semantics: {}, accentSoft: {}, accentDeep: {}, raw: {}, pairsSoft: {}, pairsRaw: [] };
const deepMix = { hearth: [0.72, [0, 0, 0]], parchment: [0.66, [0, 0, 0]], frost: [0.72, [0, 0, 0]], midnight: [0.58, [255, 255, 255]], forest: [0.58, [255, 255, 255]] };
for (const [t, b] of Object.entries(themes)) {
  const surf = tok(b, 'surface');
  out.semantics[t] = Object.fromEntries(sems.map(s => { const soft = tok(b, s + '-soft'), ink = tok(b, s + '-ink'); return [s, { soft: toHex(soft), vsSurface: +cr(soft, surf).toFixed(2), ...oklch(soft), inkOnSoft: +cr(ink, soft).toFixed(2), rawVsSurface: +cr(tok(b, s), surf).toFixed(2) }]; }));
  out.accentSoft[t] = {}; out.accentDeep[t] = {};
  const softs = {};
  for (const [p, h] of Object.entries(people)) {
    const s = mix(hex(h), surf, 0.14); softs[p] = s;
    out.accentSoft[t][p] = { hex: toHex(s), vsSurface: +cr(s, surf).toFixed(2), ...oklch(s) };
    const [pc, base] = deepMix[t]; const d = mix(hex(h), base, pc);
    out.accentDeep[t][p] = { hex: toHex(d), ...oklch(d), vsSurface: +cr(d, surf).toFixed(2) };
  }
  const names = Object.keys(people); const pr = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) pr.push([names[i] + '/' + names[j], +de00(softs[names[i]], softs[names[j]]).toFixed(2)]);
  pr.sort((a, b) => a[1] - b[1]); out.pairsSoft[t] = { under5: pr.filter(x => x[1] < 5).length, total: pr.length, closest: pr.slice(0, 8) };
}
const names = Object.keys(people);
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) out.pairsRaw.push([names[i] + '/' + names[j], +de00(hex(people[names[i]]), hex(people[names[j]])).toFixed(2)]);
out.pairsRaw.sort((a, b) => a[1] - b[1]); out.pairsRawUnder5 = out.pairsRaw.filter(x => x[1] < 5).length; out.pairsRaw = out.pairsRaw.slice(0, 8);
for (const [p, h] of Object.entries(people)) out.raw[p] = { hex: h, ...oklch(hex(h)) };
const dest = process.argv[2];
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 0).slice(0, 200));
