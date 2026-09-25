// Phase 4 COLOR: are the semantic colours (success / warning / destructive / info) unmistakable?
// For each theme (tokens-resolved.json) it takes --ok/--warn/--danger/--info (base, soft, ink) and, for comparison, the
// house pastel candidates (Mint / Butter / Bubblegum / Sky), and reports each pair's OKLab distance (x100) and luminance
// ratio with normal vision and simulated deuteranopia, protanopia and tritanopia (Machado et al. 2009, severity 1,
// applied in linear sRGB). It also lists which profile colours (worker/seed.sql:4-11) equal a semantic base.
// Usage: node audits/tools/phase4/COLOR/semantic.mjs -> audits/evidence/p4/COLOR/semantic.json
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
import { hex2, toHex, cr, oklch } from './palette.mjs';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../../..');
const TR = JSON.parse(fs.readFileSync(path.join(ROOT, 'audits/evidence/p4/measure/tokens-resolved.json')));
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const unlin = v => 255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055);
const MAT = {
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const sim = (h, k) => { if (k === 'normal') return h; const c = hex2(h).map(lin), m = MAT[k]; return toHex(m.map(r => unlin(Math.max(0, Math.min(1, r[0] * c[0] + r[1] * c[1] + r[2] * c[2]))))); };
const lab = h => { const o = oklch(h); return [o.L, o.C * Math.cos(o.H * Math.PI / 180), o.C * Math.sin(o.H * Math.PI / 180)]; };
const dE = (a, b) => { const x = lab(a), y = lab(b); return +(100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])).toFixed(1); };
const VIS = ['normal', 'deutan', 'protan', 'tritan'];
const pairs = obj => { const k = Object.keys(obj), r = {}; for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = obj[k[i]], b = obj[k[j]]; r[`${k[i]}-${k[j]}`] = Object.fromEntries(VIS.map(v => [v, { dE: dE(sim(a, v), sim(b, v)), lumRatio: cr(sim(a, v), sim(b, v)) }])); } return r; };
const out = { note: 'dE = OKLab Euclidean distance x100 (about 2 is a just-noticeable difference; below ~10 two flat colours are easily confused at a glance); lumRatio = WCAG luminance ratio between the two (1.0 = same lightness, no cue in greyscale or glare). base = the mid tone used for fills, bars, dots and (often) text; ink = the -ink token.', themes: {}, house: {} };
const tok = (n, th) => TR.tokens[n][th];
for (const th of TR.themes) {
  const base = { ok: tok('--ok', th), warn: tok('--warn', th), danger: tok('--danger', th), info: tok('--info', th) };
  const ink = { ok: tok('--ok-ink', th), warn: tok('--warn-ink', th), danger: tok('--danger-ink', th), info: tok('--info-ink', th) };
  const soft = { ok: tok('--ok-soft', th), warn: tok('--warn-soft', th), danger: tok('--danger-soft', th), info: tok('--info-soft', th) };
  out.themes[th] = { base, ink, soft, hue: Object.fromEntries(Object.entries(base).map(([k, v]) => [k, oklch(v).H])), basePairs: pairs(base), softPairs: pairs(soft) };
}
const H = { ok: ['#B9F2D0', '#0E6B3B'], warn: ['#FFF1A8', '#735A00'], danger: ['#FFC8DD', '#A3134F'], info: ['#BFDDFF', '#1A4F9C'] };
out.house = { fills: Object.fromEntries(Object.entries(H).map(([k, v]) => [k, v[0]])), inks: Object.fromEntries(Object.entries(H).map(([k, v]) => [k, v[1]])) };
out.house.fillPairs = pairs(out.house.fills); out.house.inkPairs = pairs(out.house.inks);
const PROF = { Eli: '#4F5D8C', Mae: '#BC5A38', Ezra: '#137F77', Kiara: '#B4861B', Elizabeth: '#8A6A4B', David: '#3D5A3D', Mea: '#5B8143', TV: '#4C4C58' };
const hearth = out.themes['system-light'].base;
out.profileEqualsSemantic = Object.fromEntries(Object.entries(PROF).map(([n, c]) => [n, Object.entries(hearth).filter(([, v]) => v.toUpperCase() === c.toUpperCase()).map(([k]) => k)]).filter(([, v]) => v.length));
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/COLOR/semantic.json'), JSON.stringify(out, null, 1));
const row = (name, p) => console.log(name.padEnd(12), Object.entries(p).map(([k, v]) => `${k} ${VIS.map(x => v[x].dE + '/' + v[x].lumRatio).join(' ')}`).join(' | '));
console.log('pair: normal deutan protan tritan as dE/lumRatio');
for (const th of TR.themes) { const t = out.themes[th]; console.log(`\n${th} base ${JSON.stringify(t.base)} hue ${JSON.stringify(t.hue)}`); row('base', t.basePairs); row('soft', t.softPairs); }
console.log('\nhouse'); row('fills', out.house.fillPairs); row('inks', out.house.inkPairs);
console.log('\nprofile colours equal to a Hearth semantic base:', JSON.stringify(out.profileEqualsSemantic));
