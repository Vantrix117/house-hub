// Phase 4 "migration" proposal: derives the hue families (8 house pastels + 3 semantic + a graphite neutral)
// from the HOUSE STYLE pairs (audits/HUB-AUDIT-PROMPT.md:55-64) and the proposed neutral surfaces.
// Rules applied (HOUSE STYLE): keep the pastel fill exactly; if an ink fails, darken it (light) or lighten it (dark);
// never dull the fill. The "strong" (graphic) tone of each person hue is searched so the eight hues stay
// >= 10 CIEDE2000 apart under normal vision, protanopia and deuteranopia (Machado 2009, severity 1.0).
// Deterministic (seeded PRNG). build-tokens.mjs imports buildPalette(); `node palette.mjs` prints it.
import * as C from './color.mjs';

export const NEUTRALS = {
  // light
  frost:     { scheme: 'light', bg: '#F2F2F7', surface: '#FFFFFF', surface2: '#F2F2F7', elev: '#FFFFFF', hover: '#ECECF1', text: '#1C1C1E', text2: '#48484A', muted: '#666669', decor: '#AEAEB2', line: '#D1D1D6', lineSoft: '#E5E5EA', fieldBorder: '#8A8A8E', track: '#E3E3E8', shadow: '28,28,40' },
  hearth:    { scheme: 'light', bg: '#F7F2EB', surface: '#FFFCF8', surface2: '#F0E9DF', elev: '#FFFCF8', hover: '#F2EADF', text: '#2E251D', text2: '#5F5044', muted: '#6E6053', decor: '#A79B8E', line: '#E6DCCE', lineSoft: '#F0E8DC', fieldBorder: '#8C7F70', track: '#EAE1D5', shadow: '58,46,36' },
  parchment: { scheme: 'light', bg: '#E7D9BE', surface: '#F3EAD7', surface2: '#EADFC8', elev: '#F6EFE0', hover: '#EDE2CB', text: '#3A2A1A', text2: '#56432F', muted: '#5E4B37', decor: '#9E8A70', line: '#D3C09E', lineSoft: '#DFD0B3', fieldBorder: '#86735B', track: '#DDCDAF', shadow: '58,42,26' },
  // dark
  graphite:  { scheme: 'dark', bg: '#000000', surface: '#1C1C1E', surface2: '#2C2C2E', elev: '#2C2C2E', hover: '#2C2C2E', text: '#F5F5F7', text2: '#D1D1D6', muted: '#A1A1A6', decor: '#636366', line: '#38383A', lineSoft: '#2C2C2E', fieldBorder: '#7C7C80', track: '#3A3A3C', shadow: '0,0,0' },
  midnight:  { scheme: 'dark', bg: '#1A1512', surface: '#2D2621', surface2: '#3A312B', elev: '#3A312B', hover: '#352D27', text: '#F3EDE5', text2: '#D3C6B7', muted: '#ADA095', decor: '#6E6258', line: '#40362F', lineSoft: '#352D27', fieldBorder: '#8E8176', track: '#473D36', shadow: '0,0,0' },
  forest:    { scheme: 'dark', bg: '#10171A', surface: '#1D292D', surface2: '#27363A', elev: '#27363A', hover: '#223034', text: '#EFE7D6', text2: '#CBC3AF', muted: '#AFA797', decor: '#66625A', line: '#2F3E43', lineSoft: '#223034', fieldBorder: '#7B8580', track: '#34454A', shadow: '0,0,0' },
};
// The eight house pastels (fill / ink) and hue angles; the ink hex is the house starting point.
export const HOUSE = {
  bubblegum:  { fill: '#FFC8DD', ink: '#A3134F', H: 354 },
  peach:      { fill: '#FFD6B8', ink: '#9A3F0A', H: 52 },
  butter:     { fill: '#FFF1A8', ink: '#735A00', H: 95 },
  mint:       { fill: '#B9F2D0', ink: '#0E6B3B', H: 160 },
  aqua:       { fill: '#B5EEF0', ink: '#0B6468', H: 200 },
  sky:        { fill: '#BFDDFF', ink: '#1A4F9C', H: 250 },
  periwinkle: { fill: '#CCD3FF', ink: '#3440A8', H: 276 },
  lavender:   { fill: '#E0CCFF', ink: '#5E2BAE', H: 300 },
};
// Semantic families, at hue angles between the person hues so no profile can take them.
export const SEMANTIC = { danger: { H: 25 }, warn: { H: 72 }, ok: { H: 140 } };
export const HOUSEHOLD = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle'];   // lavender = the guest hue

const P = C.parseHex;
export const themesOf = s => Object.values(NEUTRALS).filter(t => t.scheme === s);
const surfOf = ts => ts.flatMap(t => [t.bg, t.surface, t.surface2, t.elev, t.track]).map(P);
function maxC(L, H) { let lo = 0, hi = 0.4; for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (C.inGamut(L, m, H)) lo = m; else hi = m; } return lo; }
const lch = (L, Cc, H) => C.fromOklch(L, Math.min(Cc, maxC(L, H)), H);
const minCon = (c, list) => Math.min(...list.map(b => C.contrast(c, b)));
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// rounds through hex so the value tested is exactly the value written to tokens.css
const q8 = c => P(C.toHex(c));
// darken (dir -1) or lighten (dir +1) along OKLCH L until the check passes
function tuneL(start, dir, ok, step = 0.004) {
  let { L, C: Cc, H } = C.oklch(start); let c = q8(start);
  for (let i = 0; i < 250 && !ok(c); i++) { L += dir * step; c = q8(lch(L, Cc, H)); }
  return c;
}
export function cvdMin(list) { let m = 99; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) for (const k of ['normal', 'protan', 'deutan']) m = Math.min(m, C.de00(C.simulate(list[i], k), C.simulate(list[j], k))); return m; }

// capped objective: separation first (up to CAP), then vividness (chroma) and lightness
const CAP = 11;
const objective = cs => { const d = cvdMin(cs); const v = cs.reduce((a, c) => { const o = C.oklch(c); return a + o.C + 0.25 * o.L; }, 0) / cs.length; return Math.min(d, CAP) * 10 + v; };
function searchStrong({ bgs, Lr, minChroma }, names, seed, iters) {
  const R = rng(seed);
  const make = q => q8(lch(q.L, q.C, HOUSE[q.h].H + q.dH));
  const valid = c => C.oklch(c).C >= minChroma - 1e-3 && minCon(c, bgs) >= 3.05;
  let best = null, bestS = -1;
  for (let it = 0; it < iters; it++) {
    const p = names.map(h => ({ h, L: Lr[0] + R() * (Lr[1] - Lr[0]), C: 0.10 + R() * 0.16, dH: -8 + R() * 16 }));
    let cs = p.map(make); if (!cs.every(valid)) continue;
    let s = objective(cs);
    for (let r = 0; r < 150; r++) {
      const i = Math.floor(R() * p.length);
      const q = { ...p[i], L: Math.min(Lr[1], Math.max(Lr[0], p[i].L - 0.03 + R() * 0.06)), C: Math.min(0.3, Math.max(0.08, p[i].C - 0.02 + R() * 0.04)), dH: Math.max(-10, Math.min(10, p[i].dH - 2 + R() * 4)) };
      const c = make(q); if (!valid(c)) continue;
      const cs2 = cs.slice(); cs2[i] = c; const s2 = objective(cs2); if (s2 > s) { s = s2; cs = cs2; p[i] = q; }
    }
    if (s > bestS) { bestS = s; best = Object.fromEntries(names.map((h, i) => [h, cs[i]])); }
  }
  return { strong: best, score: cvdMin(Object.values(best)) };
}

// Dark fills are deep tints, color-mix(in oklab, strong p%, var(--surface)). p is chosen per family so the chip lifts
// >= 1.45:1 off the card in every dark palette (fill) and about 1.9:1 (fill-2) while --text stays >= 4.5 on it.
export function darkMix(strong, pct, surfaceHex) { return q8(C.mix('oklab', strong, pct, P(surfaceHex), 100 - pct)); }
function darkPcts(strong) {
  const ts = themesOf('dark');
  const lift = p => Math.min(...ts.map(t => C.contrast(darkMix(strong, p, t.surface), P(t.surface))));
  const textOk = p => Math.min(...ts.map(t => C.contrast(P(t.text), darkMix(strong, p, t.surface)))) >= 4.6;
  let p1 = 10; while (lift(p1) < 1.45 && p1 < 60) p1++;
  let p2 = p1 + 6; while (lift(p2) < 1.9 && p2 < 70 && textOk(p2 + 1)) p2++;
  while (!textOk(p2) && p2 > p1 + 4) p2--;
  return [p1, p2];
}

export function buildPalette({ iters = 1500 } = {}) {
  const out = { light: {}, dark: {}, parchment: {}, meta: {} };
  const darkTs = themesOf('dark');
  const Ls = surfOf(themesOf('light')), Ds = surfOf(darkTs);
  const white = P('#FFFFFF'), nearBlack = P('#141416');
  const names = Object.keys(HOUSE);
  // the eight person tones: Frost and Hearth (white-ish paper), Parchment (tan paper, its own set), dark (shared)
  const sl = searchStrong({ bgs: surfOf([NEUTRALS.frost, NEUTRALS.hearth]), Lr: [0.36, 0.64], minChroma: 0.085 }, names, 11, iters);
  const sp = searchStrong({ bgs: surfOf([NEUTRALS.parchment]), Lr: [0.30, 0.58], minChroma: 0.08 }, names, 13, iters);
  const sd = searchStrong({ bgs: Ds, Lr: [0.62, 0.93], minChroma: 0.08 }, names, 23, iters);
  out.meta = { cvdMinAll8Light: sl.score, cvdMinAll8Parchment: sp.score, cvdMinAll8Dark: sd.score };
  const darkFills = (strong, [p1, p2]) => darkTs.flatMap(t => [darkMix(strong, p1, t.surface), darkMix(strong, p2, t.surface)]);
  const family = (fill, fill2, inkStart, strongL, strongP, strongD, inkDStart) => {
    const ink = tuneL(inkStart, -1, c => minCon(c, [...Ls, fill, fill2]) >= 4.55 && C.contrast(white, c) >= 4.55);
    const pct = darkPcts(strongD);
    const inkD = tuneL(inkDStart, +1, c => minCon(c, [...Ds, ...darkFills(strongD, pct)]) >= 4.55 && C.contrast(nearBlack, c) >= 4.55);
    return { light: { fill, fill2, ink, strong: strongL, on: white }, parchment: strongP, dark: { ink: inkD, strong: strongD, on: nearBlack, pct } };
  };
  const put = (k, f) => { out.light[k] = f.light; out.dark[k] = f.dark; if (f.parchment) out.parchment[k] = f.parchment; };
  for (const h of names) {
    const hs = HOUSE[h]; const fill = P(hs.fill); const fo = C.oklch(fill);
    const fill2 = q8(lch(fo.L - 0.085, Math.max(fo.C * 2.0, 0.12), fo.H));   // saturated end of the tile gradient
    put(h, family(fill, fill2, P(hs.ink), sl.strong[h], sp.strong[h], sd.strong[h], fill));
  }
  // semantic: success and destructive differ in luminance (danger is the darker ink and tone in light, the deeper
  // pastel in dark); fills sit at house chroma. Values are [OKLCH L, C]; contrast.mjs checks the result.
  const SEM = {
    danger: { fill: [0.885, 0.07], strongL: [0.47, 0.19], inkL: [0.38, 0.14], strongD: [0.68, 0.18], inkD: [0.82, 0.09] },
    warn:   { fill: [0.925, 0.085], strongL: [0.62, 0.14], inkL: [0.46, 0.10], strongD: [0.84, 0.15], inkD: [0.90, 0.08] },
    ok:     { fill: [0.925, 0.075], strongL: [0.62, 0.16], inkL: [0.47, 0.13], strongD: [0.86, 0.17], inkD: [0.94, 0.07] },
  };
  for (const [k, s] of Object.entries(SEMANTIC)) {
    const v = SEM[k]; const fill = q8(lch(v.fill[0], v.fill[1], s.H)); const fill2 = q8(lch(v.fill[0] - 0.05, v.fill[1] * 1.6, s.H));
    const strongL = tuneL(lch(v.strongL[0], v.strongL[1], s.H), -1, c => minCon(c, Ls) >= 3.05);
    const strongD = tuneL(lch(v.strongD[0], v.strongD[1], s.H), +1, c => minCon(c, Ds) >= 3.05);
    put(k, family(fill, fill2, lch(v.inkL[0], v.inkL[1], s.H), strongL, null, strongD, lch(v.inkD[0], v.inkD[1], s.H)));
  }
  // graphite: the neutral accent (signed out, the TV, --accent-none)
  {
    const strong = tuneL(P('#7C7C82'), -1, c => minCon(c, Ls) >= 3.05);
    const strongD = tuneL(P('#8E8E93'), +1, c => minCon(c, Ds) >= 3.05);
    put('graphite', family(P('#E5E5EA'), P('#D1D1D6'), P('#48484A'), strong, null, strongD, P('#E5E5EA')));
  }
  return out;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/palette.mjs')) {
  const p = buildPalette();
  console.log('cvd min (normal/protan/deutan)', JSON.stringify(p.meta));
  const f = c => C.toHex(c) + ` (L${C.oklch(c).L.toFixed(2)} C${C.oklch(c).C.toFixed(3)})`;
  for (const s of ['light', 'dark']) for (const [h, v] of Object.entries(p[s])) console.log(s, h.padEnd(11), Object.entries(v).map(([k, c]) => k + ' ' + (Array.isArray(c) ? c.join('/') : f(c))).join('  '), s === 'light' && p.parchment[h] ? 'parch ' + f(p.parchment[h]) : '');
}
