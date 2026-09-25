#!/usr/bin/env node
// Phase 4 ACCENT — static token math. For every profile colour the hub can hold (the 8 household colours, the 2 extra
// admin/guest swatches, the overflow guest's colour, the signed-out default) and every theme key, derive the accent
// tokens exactly as apps/design.css does (color-mix in srgb), then compute the contrast of every accent use-pair the
// code paints (see USES below, each with its file:line), the OKLCH lightness/chroma of the accent and of its soft fill
// against the house pastels, and the colour-vision-deficiency distances between every pair of profile colours.
//
//   node audits/tools/phase4/ACCENT/tokens.mjs            → audits/evidence/p4/ACCENT/tokens.json (+ prints a summary)
//
// Theme surfaces are read from the Phase 4 dataset (audits/evidence/p4/measure/tokens-resolved.json, resolved in WebKit
// on the shell's :root), and the derived values are checked against that file's resolved --accent-* for Eli (and against
// the kid block for Ezra) so the math is proven to match the browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'ACCENT');
fs.mkdirSync(OUT, { recursive: true });
const TR = JSON.parse(fs.readFileSync(path.join(ROOT, 'audits/evidence/p4/measure/tokens-resolved.json'), 'utf8'));

// ── colours ───────────────────────────────────────────────────────────────────────────────────────────────────────
// worker/seed.sql:4-11 (household); index.html:449 SWATCHES (admin edit + Add a guest); audits/tools/seed/story.mjs:30-39
// (seeded guests); design.css:86 / index.html:450 / worker/src/index.js:182 (default #8A6A4B)
export const COLOURS = [
  { id: 'eli', name: 'Eli', hex: '#4F5D8C', kind: 'adult', src: 'worker/seed.sql:4' },
  { id: 'christian', name: 'Mae', hex: '#BC5A38', kind: 'adult', src: 'worker/seed.sql:5' },
  { id: 'ezra', name: 'Ezra', hex: '#137F77', kind: 'kid', src: 'worker/seed.sql:6' },
  { id: 'kiara', name: 'Kiara', hex: '#B4861B', kind: 'kid', src: 'worker/seed.sql:7' },
  { id: 'mom', name: 'Elizabeth', hex: '#8A6A4B', kind: 'adult', src: 'worker/seed.sql:8' },
  { id: 'dad', name: 'David', hex: '#3D5A3D', kind: 'adult', src: 'worker/seed.sql:9' },
  { id: 'niece', name: 'Mea', hex: '#5B8143', kind: 'adult', src: 'worker/seed.sql:10' },
  { id: 'tv', name: 'Downstairs TV', hex: '#4C4C58', kind: 'kiosk', src: 'worker/seed.sql:11' },
  { id: 'swatch-plum', name: 'Swatch 9 (plum)', hex: '#8C4F7A', kind: 'swatch', src: 'index.html:449' },
  { id: 'swatch-sage', name: 'Swatch 10 (sage)', hex: '#4C7B6A', kind: 'swatch', src: 'index.html:449' },
  { id: 'guest-theo', name: 'Cousin Theodore (overflow guest)', hex: '#1F6FB2', kind: 'guest', src: 'audits/tools/seed/story.mjs:37' },
];
// seeded guests that reuse a household colour (story.mjs:32, 36, 38)
export const SHARED = [
  { id: 'guest-grandmajo', name: 'Grandma Jo', hex: '#8A6A4B', same: 'mom' },
  { id: 'guest-auntwil', name: 'Great-Aunt Wilhelmina', hex: '#5B8143', same: 'niece' },
  { id: 'guest-pastor', name: 'Pastor Tim & Rebecca', hex: '#4F5D8C', same: 'eli' },
];
// HUB-AUDIT-PROMPT.md "Starting palette (fill / ink)"
export const HOUSE = [
  ['Bubblegum', '#FFC8DD', '#A3134F'], ['Peach', '#FFD6B8', '#9A3F0A'], ['Butter', '#FFF1A8', '#735A00'], ['Mint', '#B9F2D0', '#0E6B3B'],
  ['Aqua', '#B5EEF0', '#0B6468'], ['Sky', '#BFDDFF', '#1A4F9C'], ['Periwinkle', '#CCD3FF', '#3440A8'], ['Lavender', '#E0CCFF', '#5E2BAE'],
];

// ── themes: how design.css derives the accent tokens in each (design.css line refs) ───────────────────────────────
// deep: [mixPct, 'black'|'white'] ; onAccent literal ; pickup %
export const THEMES = {
  'system-light': { deep: [72, 'black'], on: '#FFFCF8', pickup: 12, dark: false, ref: 'design.css:86-93' },
  'system-dark': { deep: [58, 'white'], on: '#17120E', pickup: 16, dark: true, ref: 'design.css:190-193' },
  'hearth-dark': { deep: [58, 'white'], on: '#17120E', pickup: 16, dark: true, ref: 'design.css:190-193 (P2-VIS-03: Hearth on a dark OS)' },
  parchment: { deep: [66, 'black'], on: '#FFF8EC', pickup: 12, dark: false, ref: 'design.css:129-132' },
  frost: { deep: [72, 'black'], on: '#FFFFFF', pickup: 10, dark: false, ref: 'design.css:149-152' },
  midnight: { deep: [58, 'white'], on: '#17120E', pickup: 16, dark: true, ref: 'design.css:169-172' },
  forest: { deep: [58, 'white'], on: '#0E1412', pickup: 16, dark: true, ref: 'design.css:211-214' },
};
const tok = (name, th) => { const v = TR.tokens[name]; return v && (v[th] || v.all); };

// ── colour maths ──────────────────────────────────────────────────────────────────────────────────────────────────
export const hex2 = h => { const m = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16)); };
export const toHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const parseTok = s => { const [h, a] = String(s).split('/'); return { c: hex2(h), a: a ? +a : 1 }; };
export const mix = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));          // color-mix(in srgb, a p, b) — opaque
export const over = (fg, a, bg) => fg.map((v, i) => v * a + bg[i] * (1 - a));
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const delin = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
export const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const cr = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
export function oklab(c) {
  const [r, g, b] = c.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export const oklch = c => { const [L, a, b] = oklab(c); return { L: +L.toFixed(3), C: +Math.hypot(a, b).toFixed(3), h: +((Math.atan2(b, a) * 180 / Math.PI + 360) % 360).toFixed(0) }; };
const dOk = (a, b) => { const x = oklab(a), y = oklab(b); return +(100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])).toFixed(1); };
// CIE Lab (D65) + CIEDE2000
function lab(c) {
  const [r, g, b] = c.map(lin);
  let X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  X = f(X); Y = f(Y); Z = f(Z);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
export function de2000(c1, c2) {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2);
  const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (b, a) => { const v = Math.atan2(b, a) / rad; return v < 0 ? v + 360 : v; };
  const h1p = h(b1, a1p), h2p = h(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0; if (C1p * C2p) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2 * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p; if (C1p * C2p) { if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360; hbp /= 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + 0.015 * (Lbp - 50) ** 2 / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(2 * dTh * rad) * Rc;
  return +Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)).toFixed(1);
}
// Machado, Oliveira & Fernandes 2009, severity 1.0, applied to linear RGB (same matrices as phase2/VIS/palette.mjs:19,
// plus tritanopia)
export const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
export const sim = (c, M) => { const l = c.map(lin); return M.map(r => delin(Math.max(0, Math.min(1, r[0] * l[0] + r[1] * l[1] + r[2] * l[2])))); };

// ── derived accent tokens for one colour in one theme (design.css) ────────────────────────────────────────────────
export function derive(hex, th) {
  const T = THEMES[th], A = hex2(hex);
  const surface = parseTok(tok('--surface', th)).c, bg = parseTok(tok('--bg', th)).c, s2 = parseTok(tok('--surface-2', th)).c, text = parseTok(tok('--text', th)).c;
  const deep = mix(A, T.deep[1] === 'black' ? [0, 0, 0] : [255, 255, 255], T.deep[0] / 100);
  const gs = parseTok(tok('--glass-strong', th));
  return {
    accent: A, soft: mix(A, surface, 0.14), tint: mix(A, surface, 0.26), deep, on: hex2(T.on),
    deepTop: mix(deep, [255, 255, 255], 0.88),                                      // .btn-primary / .msg.user top stop
    surface, bg, s2, text, glassStrong: over(gs.c, gs.a, bg),                       // glass-strong over the page (no blur)
    tintInk: mix(A, text, 0.70),                                                    // feed/TV name ink, index.html:955, 1070
    focusOnSurface: over(A, 0.38, surface),                                         // --focus ring, design.css:102
    timerTrack: mix(A, s2, 0.16),                                                   // apps/timer.html:28
    heroBtn: over([255, 255, 255], 0.92, A),                                        // .hero .btn-primary bg over the accent, design.css:423
    tabSoftOnGlass: null,
  };
}

// ── every accent use-pair painted by the code, with where it is ────────────────────────────────────────────────────
// req: 4.5 text, 3 large text / non-text. fg/bg pick from derive().
export const USES = [
  { id: 'onaccent-on-deep', fg: 'on', bg: 'deep', req: 4.5, what: 'Filled primary button label, bottom stop', where: 'design.css:361 (.btn-primary); index.html:249 (.msg.user); apps/prayer.html:191, 193, 350, 422; dollywood template:225, 244, 453, 456 (lv-act 13px), 472', areas: ['shell', 'tally', 'timer', 'verses', 'kidverse', 'prayer', 'dollywood', 'dollywood-live'] },
  { id: 'onaccent-on-deeptop', fg: 'on', bg: 'deepTop', req: 4.5, what: 'Filled primary button label, top stop (accent-deep 88% + white)', where: 'design.css:361; index.html:249', areas: ['shell', 'tally', 'timer', 'verses', 'kidverse'] },
  { id: 'deep-on-soft', fg: 'deep', bg: 'soft', req: 4.5, what: 'Soft button / accent chip / selected tab / selected preset / Prayer nav current', where: 'design.css:362, 481, 510, 564-567; apps/timer.html:44; apps/prayer.html:281', areas: ['shell', 'timer', 'prayer', 'verses', 'tally'] },
  { id: 'deep-on-surface', fg: 'deep', bg: 'surface', req: 4.5, what: 'Accent text on a card (.accent, picker last-used sub, kid CTA, Prayer category, park-map link, timer pill time)', where: 'design.css:334; index.html:48, 185, 350, 360; apps/prayer.html:334; dollywood template:491', areas: ['shell', 'prayer', 'dollywood-live'] },
  { id: 'deep-on-bg', fg: 'deep', bg: 'bg', req: 4.5, what: 'Accent-deep text straight on the page background', where: 'index.html:74 (pull-to-refresh glyph); design.css:564 over the tab bar (glass over bg)', areas: ['shell'] },
  { id: 'deep-on-glass', fg: 'deep', bg: 'glassStrong', req: 4.5, what: 'Accent-deep label/icon on glass-strong over the page (tab label .tab.on, timer pill icon), no blur', where: 'design.css:564; index.html:349-361', areas: ['shell'] },
  { id: 'raw-on-surface', fg: 'accent', bg: 'surface', req: 4.5, what: 'RAW --accent used as small text on a card (Prayer kitchen category 13.5px; park map list "small" 11.5px; "from" name)', where: 'apps/prayer.html:359; dollywood template:440, 524', areas: ['prayer', 'dollywood-live'] },
  { id: 'raw-on-soft', fg: 'accent', bg: 'soft', req: 4.5, what: 'RAW --accent 11px initial on --accent-soft (Prayer who/asker initial)', where: 'apps/prayer.html:118', areas: ['prayer'] },
  { id: 'onaccent-on-raw', fg: 'on', bg: 'accent', req: 3, what: 'on-accent glyph on the RAW accent (park map locate FAB icon; hero mid stop)', where: 'dollywood template:412; design.css:411-412', areas: ['dollywood-live', 'shell'] },
  { id: 'tintink-on-surface', fg: 'tintInk', bg: 'surface', req: 4.5, what: "Another person's name in the feed / TV lines (colour 70% + --text)", where: 'index.html:183, 955 (feed); index.html:161, 1070 (TV)', areas: ['shell', 'tv'] },
  { id: 'deep-on-herobtn', fg: 'deep', bg: 'heroBtn', req: 4.5, what: 'Hero button label: accent-deep on 92% white over the accent (Me Switch, hero actions)', where: 'design.css:423', areas: ['shell'] },
  // non-text
  { id: 'raw-vs-surface', fg: 'accent', bg: 'surface', req: 3, nontext: true, what: 'RAW accent as a graphic on a card: progress/timer ring fill, PIN dots, last-used picker ring, TV face ring, focus outline, park-map tab icon', where: 'index.html:47, 58, 154, 683; apps/timer.html:29; apps/prayer.html:96, 141, 201, 419; dollywood template:429, 464', areas: ['shell', 'tv', 'timer', 'prayer', 'dollywood-live'] },
  { id: 'raw-vs-bg', fg: 'accent', bg: 'bg', req: 3, nontext: true, what: 'RAW accent graphic on the page background (picker last-used ring on the gate)', where: 'index.html:47', areas: ['shell'] },
  { id: 'deep-vs-surface', fg: 'deep', bg: 'surface', req: 3, nontext: true, what: 'Selected theme card border (the only on-state cue besides the tick)', where: 'index.html:292', areas: ['shell'] },
  { id: 'soft-vs-surface', fg: 'soft', bg: 'surface', req: 3, nontext: true, what: 'Selected-state FILL (tab indicator, preset .on, Prayer nav current, emoji grid .on) against the card it sits on', where: 'design.css:567; apps/timer.html:44; apps/prayer.html:281; index.html:312', areas: ['shell', 'timer', 'prayer'] },
  { id: 'focus-vs-surface', fg: 'focusOnSurface', bg: 'surface', req: 3, nontext: true, what: '--focus ring (accent 38% over the surface) on inputs', where: 'design.css:102, 446', areas: ['shell', 'verses', 'kidverse'] },
  { id: 'track-vs-surface', fg: 'timerTrack', bg: 'surface', req: 3, nontext: true, what: 'Timer ring track (accent 16% into surface-2) vs the dial', where: 'apps/timer.html:28 (P3 VIS-TIMER-7)', areas: ['timer'] },
];

export function compute() {
  const themes = Object.keys(THEMES);
  const rows = [];
  for (const c of COLOURS) for (const th of themes) {
    const d = derive(c.hex, th);
    const r = { colour: c.id, hex: c.hex, theme: th, tokens: { soft: toHex(d.soft), tint: toHex(d.tint), deep: toHex(d.deep), on: toHex(d.on), tintInk: toHex(d.tintInk) }, pairs: {} };
    for (const u of USES) r.pairs[u.id] = cr(d[u.fg], d[u.bg]);
    r.softChroma = oklch(d.soft).C; r.softL = oklch(d.soft).L;
    rows.push(r);
  }
  // verification against the browser (Eli adult tokens, Ezra kid tokens)
  const verify = [];
  for (const th of themes) {
    for (const [name, key] of [['--accent-soft', 'soft'], ['--accent-tint', 'tint'], ['--accent-deep', 'deep'], ['--on-accent', 'on']]) {
      const browser = tok(name, th); const mine = rows.find(r => r.colour === 'eli' && r.theme === th).tokens[key];
      const b = parseTok(browser).c, m = hex2(mine);
      verify.push({ theme: th, token: name, profile: 'eli', browser, mine, maxDiff: Math.max(...b.map((v, i) => Math.abs(v - m[i]))) });
    }
    const kid = TR.kinds && TR.kinds.kid && TR.kinds.kid[th] && TR.kinds.kid[th].diff;
    if (kid) for (const [name, key] of [['--accent-soft', 'soft'], ['--accent-tint', 'tint'], ['--accent-deep', 'deep']]) {
      if (!kid[name]) continue;
      const browser = kid[name].kid, mine = rows.find(r => r.colour === 'ezra' && r.theme === th).tokens[key];
      const b = parseTok(browser).c, m = hex2(mine);
      verify.push({ theme: th, token: name, profile: 'ezra (kid block)', browser, mine, maxDiff: Math.max(...b.map((v, i) => Math.abs(v - m[i]))) });
    }
  }
  // lightness / chroma: profile colours vs house pastels and inks
  const lc = COLOURS.map(c => ({ id: c.id, hex: c.hex, ...oklch(hex2(c.hex)) }));
  const house = HOUSE.map(([n, f, i]) => ({ name: n, fill: f, ink: i, fillL: oklch(hex2(f)).L, fillC: oklch(hex2(f)).C, inkL: oklch(hex2(i)).L, inkC: oklch(hex2(i)).C, fillInk: cr(hex2(f), hex2(i)) }));
  // pairwise distances, normal + CVD, on the raw colour and on the Hearth soft fill (what a chip actually paints)
  const set = COLOURS.filter(c => c.kind !== 'kiosk');
  const pairs = [];
  for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
    const a = hex2(set[i].hex), b = hex2(set[j].hex);
    const p = { a: set[i].id, b: set[j].id, both: [set[i].kind, set[j].kind] };
    p.normal = { de2000: de2000(a, b), ok: dOk(a, b) };
    for (const [k, M] of Object.entries(CVD)) p[k] = { de2000: de2000(sim(a, M), sim(b, M)), ok: dOk(sim(a, M), sim(b, M)) };
    const sa = derive(set[i].hex, 'system-light').soft, sb = derive(set[j].hex, 'system-light').soft;
    p.softHearth = { de2000: de2000(sa, sb) };
    const da = derive(set[i].hex, 'system-dark').soft, db = derive(set[j].hex, 'system-dark').soft;
    p.softMidnight = { de2000: de2000(da, db) };
    p.worstCvd = Math.min(p.protan.de2000, p.deutan.de2000, p.tritan.de2000);
    pairs.push(p);
  }
  pairs.sort((x, y) => x.worstCvd - y.worstCvd);
  const houseSoft = HOUSE.map(([n, f]) => oklch(hex2(f)).C);
  return { rows, verify, lc, house, houseSoftChroma: { min: Math.min(...houseSoft), max: Math.max(...houseSoft) }, pairs };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = compute();
  const out = {
    note: 'Static token math. rows[]: one per colour × theme key; tokens = derived --accent-soft/-tint/-deep, --on-accent, feed tint-ink; pairs = WCAG ratio for each USES entry (see uses[]). verify[]: my derivation vs the browser-resolved tokens (tokens-resolved.json), maxDiff in 0-255 units. lc: OKLCH of each profile colour; house: the house pastel fill/ink pairs. pairs[]: pairwise distances (CIEDE2000 and OKLab×100) normal and under Machado 2009 protan/deutan/tritan at severity 1.0, plus the distance between the two people\'s --accent-soft fills (what chips/tabs paint) in Hearth and Midnight. Sorted by the worst CVD distance.',
    colours: COLOURS, shared: SHARED, themes: THEMES, uses: USES, ...r,
  };
  fs.writeFileSync(path.join(OUT, 'tokens.json'), JSON.stringify(out, null, 1));
  // summary
  console.log('verify max diff:', Math.max(...r.verify.map(v => v.maxDiff)), 'over', r.verify.length, 'token checks');
  const ths = Object.keys(THEMES);
  for (const u of USES) {
    const fails = r.rows.filter(x => x.pairs[u.id] < u.req);
    const hh = r.rows.filter(x => COLOURS.find(c => c.id === x.colour).kind !== 'swatch' && COLOURS.find(c => c.id === x.colour).kind !== 'guest');
    const min = Math.min(...r.rows.map(x => x.pairs[u.id])), max = Math.max(...r.rows.map(x => x.pairs[u.id]));
    console.log(`${u.id.padEnd(20)} req ${u.req}  range ${min}-${max}  fail ${fails.length}/${r.rows.length} (household ${hh.filter(x => x.pairs[u.id] < u.req).length}/${hh.length})`);
  }
  console.log('\nlc', r.lc.map(x => `${x.id} L${x.L} C${x.C}`).join(' | '));
  console.log('house fills L', r.house.map(h => h.fillL).join(','), 'inks L', r.house.map(h => h.inkL).join(','));
  console.log('\nclosest pairs (worst CVD de2000):');
  for (const p of r.pairs.slice(0, 14)) console.log(`${p.a}/${p.b} normal ${p.normal.de2000} protan ${p.protan.de2000} deutan ${p.deutan.de2000} tritan ${p.tritan.de2000} | softHearth ${p.softHearth.de2000} softMidnight ${p.softMidnight.de2000}`);
}

// ── selection by hue only? The selected tab (design.css:564) differs from its neighbours only by ink: --accent-deep vs
// --muted (design.css:561); the indicator fill (design.css:567) is ~1.1-1.25:1 (soft-vs-surface). How far apart are the
// two inks in luminance (ratio) and in colour under each CVD?  node tokens.mjs --selection
if (process.argv.includes('--selection')) {
  const tokHex = (n, th) => hex2(String(tok(n, th)).split('/')[0]);
  const rows = [];
  for (const c of COLOURS) for (const th of Object.keys(THEMES)) {
    const d = derive(c.hex, th), muted = tokHex('--muted', th);
    const r = { colour: c.id, theme: th, lumRatio: cr(d.deep, muted), de2000: de2000(d.deep, muted) };
    for (const [k, M] of Object.entries(CVD)) r[k] = de2000(sim(d.deep, M), sim(muted, M));
    rows.push(r);
  }
  const f = path.join(OUT, 'tokens.json'); const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.selection = { note: 'Selected tab ink (--accent-deep) vs unselected tab ink (--muted): luminance ratio and CIEDE2000, normal and simulated. A pair with lumRatio < 1.5 and a small CVD distance is told apart by hue alone.', rows };
  fs.writeFileSync(f, JSON.stringify(j, null, 1));
  const ths = Object.keys(THEMES);
  console.log('lumRatio deep vs muted        ' + ths.join(' '));
  for (const c of COLOURS) console.log(c.id.padEnd(12), ths.map(t => String(rows.find(r => r.colour === c.id && r.theme === t).lumRatio).padStart(5)).join(' '), '| worst CVD dE', Math.min(...rows.filter(r => r.colour === c.id).map(r => Math.min(r.protan, r.deutan, r.tritan))));
}
