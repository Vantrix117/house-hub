// Phase 4 DARK: is the pastel the "glowing foreground" in dark, and are the dark fills vibrant or muddy?
// Pure computation from the literal token values in apps/design.css (read here from the file) and the profile
// colours in worker/seed.sql; color-mix(in srgb, …) is emulated in gamma-encoded sRGB as the spec defines.
//   node audits/tools/phase4/DARK/palette-dark.mjs
// Writes audits/evidence/p4/DARK/palette-dark.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const css = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8');
const seed = fs.readFileSync(path.join(ROOT, 'worker/seed.sql'), 'utf8');

const block = sel => { const i = css.indexOf(sel); const s = css.indexOf('{', i); const e = css.indexOf('\n}', s); return css.slice(s + 1, e); };
const vars = txt => Object.fromEntries([...txt.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2].toUpperCase()]));
const THEMES = {
  hearth: vars(block(':root {')),
  parchment: vars(block(':root[data-theme="parchment"]')),
  frost: vars(block(':root[data-theme="frost"]')),
  midnight: vars(block(':root[data-theme="midnight"]')),
  systemDark: vars(block(':root:not([data-theme])')),
  forest: vars(block(':root[data-theme="forest"]')),
};
const deepMix = { hearth: ['black', 72], parchment: ['black', 66], frost: ['black', 72], midnight: ['white', 58], systemDark: ['white', 58], forest: ['white', 58] };

const h2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const mix = (a, p, b) => toHex(h2(a).map((v, i) => v * p / 100 + h2(b)[i] * (100 - p) / 100));
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Lr = h => { const [r, g, b] = h2(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const CR = (a, b) => { const x = Lr(a), y = Lr(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
function oklch(h) {
  const [r, g, b] = h2(h).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { L: +L.toFixed(3), C: +Math.hypot(A, B).toFixed(3), h: +((Math.atan2(B, A) * 180 / Math.PI + 360) % 360).toFixed(0) };
}
const profiles = [...seed.matchAll(/\('([a-z]+)',\s*'([^']+)',\s*'[^']*',\s*'(#[0-9A-Fa-f]{6})',\s*'([a-z]+)'/g)].map(m => ({ id: m[1], name: m[2], color: m[3].toUpperCase(), kind: m[4] }));
profiles.push({ id: 'guest-theo', name: 'Cousin Theodore (seeded guest)', color: '#1F6FB2', kind: 'guest' });
const HOUSE = { Bubblegum: ['#FFC8DD', '#A3134F'], Peach: ['#FFD6B8', '#9A3F0A'], Butter: ['#FFF1A8', '#735A00'], Mint: ['#B9F2D0', '#0E6B3B'], Aqua: ['#B5EEF0', '#0B6468'], Sky: ['#BFDDFF', '#1A4F9C'], Periwinkle: ['#CCD3FF', '#3440A8'], Lavender: ['#E0CCFF', '#5E2BAE'] };

const out = { note: 'Contrast = WCAG 2 ratio; OKLCH computed from sRGB. accent = the profile colour hub.js sets inline (apps/hub.js:80), never adjusted per theme. accentSoft = color-mix(accent 14%, surface) (design.css:171 etc.), accentDeep = color-mix(accent 58%, white) in dark / 72% black in Hearth, tintInk = color-mix(accent 70%, text) (index.html:955).', house: {}, accents: {}, semantics: {}, surfaces: {} };
for (const [n, [fill, ink]] of Object.entries(HOUSE)) out.house[n] = { fill: oklch(fill), ink: oklch(ink), inkOnFill: CR(ink, fill) };
for (const [t, v] of Object.entries(THEMES)) {
  const surf = v['--surface'], bg = v['--bg'], text = v['--text'];
  out.surfaces[t] = { bg, surface: surf, surface2: v['--surface-2'], line: v['--line'], surfaceVsBg: CR(surf, bg), surface2VsSurface: CR(v['--surface-2'], surf), lineVsSurface: CR(v['--line'], surf), mutedDecorVsSurface: CR(v['--muted-decor'], surf), bgOklch: oklch(bg), surfaceOklch: oklch(surf) };
  out.accents[t] = profiles.map(p => {
    const soft = mix(p.color, 14, surf), deep = mix(p.color, deepMix[t][1], deepMix[t][0] === 'white' ? '#FFFFFF' : '#000000'), tint = mix(p.color, 70, text);
    return { id: p.id, kind: p.kind, accent: p.color, accentVsSurface: CR(p.color, surf), accentVsBg: CR(p.color, bg), accentOklch: oklch(p.color), soft, softVsSurface: CR(soft, surf), softOklch: oklch(soft), deep, deepVsSurface: CR(deep, surf), deepVsSoft: CR(deep, soft), deepOklch: oklch(deep), tintInk: tint, tintInkVsSurface: CR(tint, surf) };
  });
  out.semantics[t] = ['mocha', 'gold', 'olive', 'teal', 'terra', 'slate'].map(n => {
    const base = v['--' + n], soft = v['--' + n + '-soft'], ink = v['--' + n + '-ink'];
    return { name: n, base, soft, ink, softVsSurface: CR(soft, surf), softVsBg: CR(soft, bg), inkVsSoft: CR(ink, soft), baseVsSurface: CR(base, surf), softOklch: oklch(soft), inkOklch: oklch(ink), baseOklch: oklch(base) };
  });
}
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/DARK/palette-dark.json'), JSON.stringify(out, null, 1));
const pr = (t) => { console.log(`\n## ${t} accents: id accent vsSurf | soft C, vsSurf | deep vsSurf | tintInk vsSurf`);
  for (const a of out.accents[t]) console.log(a.id.padEnd(11), a.accent, String(a.accentVsSurface).padStart(5), '| L', a.accentOklch.L, 'C', a.accentOklch.C, '| soft', a.soft, 'C', a.softOklch.C, a.softVsSurface, '| deep', a.deep, a.deepVsSurface, 'C', a.deepOklch.C, '| tint', a.tintInkVsSurface);
  console.log(`## ${t} semantics: name soft C vsSurf | ink C inkVsSoft | base vsSurf`);
  for (const s of out.semantics[t]) console.log(s.name.padEnd(6), s.soft, 'L', s.softOklch.L, 'C', s.softOklch.C, s.softVsSurface, '| ink', s.ink, 'L', s.inkOklch.L, 'C', s.inkOklch.C, s.inkVsSoft, '| base', s.base, s.baseVsSurface);
  console.log('surfaces', JSON.stringify(out.surfaces[t])); };
pr('hearth'); pr('midnight'); pr('forest');
console.log('\nhouse pastels', Object.entries(out.house).map(([n, h]) => `${n} fill L${h.fill.L} C${h.fill.C} ink L${h.ink.L} C${h.ink.C}`).join('\n'));
