// Phase 4 · independent CONTRAST verifier, round 4.
//   node audits/tools/phase4/tokens/verify-contrast-4.mjs [tokens.css] [out.json]
// Written from scratch: it imports nothing from contrast.mjs, colour-lib.mjs or the earlier verify-contrast-*.mjs.
// 1. Parses proposed-tokens.css and runs its own cascade on a model <html> (and a nested element where a scope matters):
//    compound selectors (:root, [a], [a="v"], :not(), :where()), specificity, source order, @media (width, pointer,
//    prefers-contrast, prefers-reduced-transparency, prefers-reduced-motion), custom-property inheritance, var() with
//    fallbacks, color-mix(in srgb) with premultiplied alpha, rgba() compositing in gamma sRGB.
// 2. Gates every text / non-text / graphic pair the section's thresholds name, in 10 palettes (6 + light/dark aliases + a
//    dark and a light root with no data-theme) x 9 people x 10 modes.
// 3. Recomputes every number TOKENS.md states about contrast, CVD and chroma and compares: |stated - true| <= 0.05
//    (chroma 0.002) and a stated minimum ("≥ x", a table minimum) must not exceed the true minimum.
// Writes audits/evidence/p4/tokens/verify-contrast-4.json. Exit 1 when a gate fails or a claim mismatches.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const cssFile = process.argv[2] || path.join(HERE, 'proposed-tokens.css');
const outFile = process.argv[3] || path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'verify-contrast-4.json');

// ───────────────────────── CSS parsing ─────────────────────────
const src = fs.readFileSync(cssFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
function splitTop(s, sep) {   // split at top level (outside (), quotes)
  const out = []; let depth = 0, q = null, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '(') depth++; else if (c === ')') depth--;
    if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur); return out;
}
const RULES = []; let ORDER = 0;
function parseBlock(s, media) {
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf('{', i); if (open < 0) break;
    const prelude = s.slice(i, open).trim();
    // find matching close
    let d = 0, j = open, q = null;
    for (; j < s.length; j++) { const c = s[j]; if (q) { if (c === q) q = null; continue; } if (c === '"' || c === "'") { q = c; continue; } if (c === '{') d++; else if (c === '}') { d--; if (d === 0) break; } }
    const body = s.slice(open + 1, j);
    if (prelude.startsWith('@media')) parseBlock(body, (media ? media + ' and ' : '') + prelude.slice(6).trim());
    else {
      const decls = splitTop(body, ';').map(x => x.trim()).filter(Boolean).map(x => { const k = x.indexOf(':'); return [x.slice(0, k).trim(), x.slice(k + 1).trim()]; });
      RULES.push({ selectors: splitTop(prelude, ',').map(x => x.trim()).filter(Boolean).map(parseSelector), decls, media, order: ORDER++ });
    }
    i = j + 1;
  }
}
function parseSelector(sel) {
  const parts = []; let i = 0;
  if (/\s/.test(sel.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, ''))) throw new Error('combinator not supported: ' + sel);
  while (i < sel.length) {
    if (sel.startsWith(':root', i)) { parts.push({ t: 'root' }); i += 5; continue; }
    if (sel[i] === '[') { const j = sel.indexOf(']', i); const inner = sel.slice(i + 1, j); const m = inner.match(/^([\w-]+)(?:="([^"]*)")?$/); parts.push({ t: 'attr', name: m[1], value: m[2] }); i = j + 1; continue; }
    const pm = sel.slice(i).match(/^:(not|where)\(/);
    if (pm) {
      let d = 0, j = i + pm[0].length - 1;
      for (; j < sel.length; j++) { if (sel[j] === '(') d++; else if (sel[j] === ')') { d--; if (d === 0) break; } }
      const inner = sel.slice(i + pm[0].length, j);
      parts.push({ t: pm[1], list: splitTop(inner, ',').map(x => parseSelector(x.trim())) }); i = j + 1; continue;
    }
    throw new Error('selector not understood: ' + sel + ' at ' + i);
  }
  return { text: sel, parts };
}
function specOf(sel) {
  let s = 0;
  for (const p of sel.parts) {
    if (p.t === 'root' || p.t === 'attr') s += 1;
    else if (p.t === 'not') s += Math.max(...p.list.map(specOf));
  }
  return s;   // only class-level specificity occurs in this file
}
function matches(sel, el) {
  return sel.parts.every(p => {
    if (p.t === 'root') return el.isRoot;
    if (p.t === 'attr') return p.name in el.attrs && (p.value === undefined || el.attrs[p.name] === p.value);
    if (p.t === 'not') return !p.list.some(s => matches(s, el));
    if (p.t === 'where') return p.list.some(s => matches(s, el));
    return false;
  });
}
function mediaOk(m, env) {
  if (!m) return true;
  return m.split(/\s+and\s+/).every(f => {
    const x = f.trim().replace(/^\(|\)$/g, ''); const [k, v] = x.split(':').map(s => s.trim());
    if (k === 'min-width') return env.width >= parseFloat(v);
    if (k === 'pointer') return env.pointer === v;
    if (k === 'prefers-contrast') return env.prefersContrast === v;
    if (k === 'prefers-reduced-transparency') return env.prefersTransparency === v;
    if (k === 'prefers-reduced-motion') return env.prefersMotion === v;
    throw new Error('media feature ' + k);
  });
}
parseBlock(src, null);

// ───────────────────────── cascade ─────────────────────────
function cascade(el, env, parentVals) {
  const win = new Map();   // prop -> {spec, order, idx, value}
  for (const r of RULES) {
    if (!mediaOk(r.media, env)) continue;
    let best = -1; for (const s of r.selectors) if (matches(s, el)) best = Math.max(best, specOf(s));
    if (best < 0) continue;
    r.decls.forEach(([k, v], idx) => {
      const cur = win.get(k); const key = [best, r.order, idx];
      if (!cur || best > cur.spec || (best === cur.spec && (r.order > cur.order || (r.order === cur.order && idx > cur.idx)))) win.set(k, { spec: best, order: r.order, idx, value: v });
    });
  }
  const raw = new Map(); for (const [k, v] of win) raw.set(k, v.value);
  const resolved = new Map();
  const resolving = new Set();
  const get = name => {
    if (resolved.has(name)) return resolved.get(name);
    if (!raw.has(name)) return parentVals ? parentVals.get(name) : undefined;
    if (resolving.has(name)) return undefined;   // cycle → guaranteed-invalid
    resolving.add(name);
    const v = subst(raw.get(name));
    resolving.delete(name); resolved.set(name, v); return v;
  };
  const subst = s => {
    let out = '', i = 0;
    while (i < s.length) {
      const k = s.indexOf('var(', i); if (k < 0) { out += s.slice(i); break; }
      out += s.slice(i, k);
      let d = 0, j = k + 3; for (; j < s.length; j++) { if (s[j] === '(') d++; else if (s[j] === ')') { d--; if (d === 0) break; } }
      const inner = s.slice(k + 4, j); const parts = splitTop(inner, ','); const nm = parts[0].trim();
      let v = get(nm);
      if (v === undefined && parts.length > 1) v = subst(parts.slice(1).join(',').trim());
      if (v === undefined) throw new Error('unresolved var ' + nm);
      out += v; i = j + 1;
    }
    return out;
  };
  const vals = new Map(parentVals || []);
  for (const k of raw.keys()) vals.set(k, get(k));
  return vals;
}

// ───────────────────────── colour ─────────────────────────
const NAMED = { transparent: [0, 0, 0, 0], white: [1, 1, 1, 1], black: [0, 0, 0, 1] };
function parseColour(s) {
  s = s.trim();
  if (NAMED[s.toLowerCase()]) { const [r, g, b, a] = NAMED[s.toLowerCase()]; return { r, g, b, a }; }
  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1]; if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
    const n = i => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
  }
  m = s.match(/^rgba?\((.*)\)$/i);
  if (m) { const a = m[1].split(/[\s,\/]+/).filter(Boolean).map(x => x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x)); return { r: a[0] / 255, g: a[1] / 255, b: a[2] / 255, a: a[3] ?? 1 }; }
  m = s.match(/^color-mix\((.*)\)$/i);
  if (m) {
    const args = splitTop(m[1], ',').map(x => x.trim());
    if (args[0] !== 'in srgb') throw new Error('colour space ' + args[0]);
    const item = x => { const mm = x.match(/^(.*?)(?:\s+([\d.]+)%)?$/); return { c: parseColour(mm[1]), p: mm[2] !== undefined ? parseFloat(mm[2]) / 100 : undefined }; };
    const A = item(args[1]), B = item(args[2]);
    let p1 = A.p, p2 = B.p;
    if (p1 === undefined && p2 === undefined) { p1 = .5; p2 = .5; } else if (p1 === undefined) p1 = 1 - p2; else if (p2 === undefined) p2 = 1 - p1;
    const sum = p1 + p2; let mult = 1; if (sum === 0) throw new Error('0% mix');
    if (sum < 1) mult = sum; p1 /= sum; p2 /= sum;
    const a = A.c.a * p1 + B.c.a * p2;
    const ch = k => a === 0 ? 0 : (A.c[k] * A.c.a * p1 + B.c[k] * B.c.a * p2) / a;
    return { r: ch('r'), g: ch('g'), b: ch('b'), a: a * mult };
  }
  throw new Error('colour not understood: ' + s);
}
const over = (f, b) => { const a = f.a + b.a * (1 - f.a); if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }; const c = k => (f[k] * f.a + b[k] * b.a * (1 - f.a)) / a; return { r: c('r'), g: c('g'), b: c('b'), a }; };
const lin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const cr = (a, b) => { if (a.a < 0.999 || b.a < 0.999) throw new Error('contrast on a translucent colour'); const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const P = h => parseColour(h);
function oklchC(c) {
  const r = lin(c.r), g = lin(c.g), b = lin(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return Math.hypot(A, B);
}
// CVD: Machado, Oliveira & Fernandes 2009, severity 1.0, on linear sRGB
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const clamp = x => Math.min(1, Math.max(0, x));
function linRGB(c, type) {
  const v = [lin(c.r), lin(c.g), lin(c.b)];
  if (!type || type === 'normal') return v;
  const M = MACHADO[type]; return M.map(row => clamp(row[0] * v[0] + row[1] * v[1] + row[2] * v[2]));
}
function lab(v) {
  const [r, g, b] = v;
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b, Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function de2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (b, a) => { if (b === 0 && a === 0) return 0; const x = Math.atan2(b, a) / rad; return x < 0 ? x + 360 : x; };
  const h1p = h(b1, a1p), h2p = h(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0; if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p; if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hbp = (h1p + h2p < 360) ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2; else hbp = (h1p + h2p) / 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2)), RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + 0.015 * (Lbp - 50) ** 2 / Math.sqrt(20 + (Lbp - 50) ** 2), SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T, RT = -Math.sin(2 * dTh * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}
const dE = (c1, c2, type) => de2000(lab(linRGB(c1, type)), lab(linRGB(c2, type)));

// ───────────────────────── contexts ─────────────────────────
const PALETTES = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
const THEMES = { ...Object.fromEntries(Object.entries(PALETTES).map(([k, v]) => [k, { attrs: { 'data-theme': k, 'data-scheme': v }, scheme: v, pal: k }])),
  'alias-light': { attrs: { 'data-theme': 'light', 'data-scheme': 'light' }, scheme: 'light', pal: 'hearth' },
  'alias-dark': { attrs: { 'data-theme': 'dark', 'data-scheme': 'dark' }, scheme: 'dark', pal: 'midnight' },
  'no-theme-dark': { attrs: { 'data-scheme': 'dark' }, scheme: 'dark', pal: 'midnight' },
  'no-theme-light': { attrs: { 'data-scheme': 'light' }, scheme: 'light', pal: 'hearth' } };
const ACCENTS = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite'];
const PERSON = ACCENTS;
const FAMILIES = [...ACCENTS.slice(0, 8), 'graphite', 'success', 'warning', 'danger'];
const SEMANTIC = ['success', 'warning', 'danger'];
const MODES = {
  adult: { attrs: {}, env: {} },
  kid: { attrs: { 'data-kind': 'kid' }, env: {} },
  kiosk: { attrs: { 'data-kind': 'kiosk' }, env: {}, hi: true },
  'contrast-more': { attrs: { 'data-contrast': 'more' }, env: {}, hi: true },
  'contrast-media': { attrs: {}, env: { prefersContrast: 'more' }, hi: true },
  'reduce-transparency': { attrs: { 'data-transparency': 'reduce' }, env: {} },
  'rt-media': { attrs: {}, env: { prefersTransparency: 'reduce' } },
  'kiosk+rt': { attrs: { 'data-kind': 'kiosk', 'data-transparency': 'reduce' }, env: {}, hi: true },
  'kiosk+contrast': { attrs: { 'data-kind': 'kiosk', 'data-contrast': 'more' }, env: {}, hi: true },
  'kid+contrast': { attrs: { 'data-kind': 'kid', 'data-contrast': 'more' }, env: {}, hi: true },
};
const BASE_ENV = { width: 390, pointer: 'coarse', prefersContrast: 'no-preference', prefersTransparency: 'no-preference', prefersMotion: 'no-preference' };
function ctx(theme, accent, mode, extraEnv = {}) {
  const T = THEMES[theme], M = MODES[mode];
  const el = { isRoot: true, attrs: { ...T.attrs, 'data-accent': accent, ...M.attrs } };
  const env = { ...BASE_ENV, ...M.env, ...extraEnv };
  const vals = cascade(el, env, null);
  const col = n => { const v = vals.get('--' + n); if (v === undefined) throw new Error(`--${n} undefined in ${theme}/${accent}/${mode}`); return parseColour(v); };
  const solid = n => { const c = col(n); if (c.a < 0.999) throw new Error(`--${n} not opaque (${theme}/${mode}): ${vals.get('--' + n)}`); return c; };
  return { theme, accent, mode, scheme: T.scheme, pal: T.pal, hi: !!M.hi, vals, col, solid, env, el };
}

// ───────────────────────── gates ─────────────────────────
const gates = new Map();
function gate(id, value, thr, where) {
  let g = gates.get(id); if (!g) { g = { id, thr, n: 0, min: Infinity, at: null, fails: 0, examples: [] }; gates.set(id, g); }
  g.n++; if (value < g.min) { g.min = value; g.at = where; }
  if (value < thr - 1e-9) { g.fails++; if (g.examples.length < 6) g.examples.push(`${where}: ${value.toFixed(3)}`); }
}
// metric store for claims: key -> {min, at, max, atMax}
const M = new Map();
function note(key, v, where) { let m = M.get(key); if (!m) { m = { min: Infinity, max: -Infinity, at: null, atMax: null }; M.set(key, m); } if (v < m.min) { m.min = v; m.at = where; } if (v > m.max) { m.max = v; m.atMax = where; } }

const OPAQUE = ['bg', 'surface', 'surface-2', 'surface-raised', 'fill-field', 'hover'];
const PAGE_CARD_SHEET = ['bg', 'surface', 'surface-raised'];
const WELLS = ['surface-2', 'fill-field', 'hover'];
const all = [];
for (const theme of Object.keys(THEMES)) for (const accent of ACCENTS) for (const mode of Object.keys(MODES)) all.push(ctx(theme, accent, mode));
// also the kid + contrast media, kiosk + RT media combos
for (const theme of Object.keys(PALETTES)) for (const accent of ACCENTS) {
  all.push(Object.assign(ctx(theme, accent, 'kiosk', { prefersTransparency: 'reduce' }), { mode: 'kiosk+rt-media' }));
  all.push(Object.assign(ctx(theme, accent, 'kiosk', { prefersContrast: 'more' }), { mode: 'kiosk+contrast-media' }));
}
// the contrast media opt-out must behave like adult
for (const theme of Object.keys(PALETTES)) for (const accent of ACCENTS) {
  const a = ctx(theme, accent, 'adult'); const b = ctx(theme, accent, 'adult', { prefersContrast: 'more' });
  b.el.attrs['data-contrast'] = 'standard';
}

const wordAt = c => `${c.theme}/${c.accent}/${c.mode}`;
const backs = c => ({ bg: c.solid('bg'), surface: c.solid('surface'), mid: P('#767676'), worst: P(c.scheme === 'light' ? '#000000' : '#FFFFFF') });
const GREYS = Array.from({ length: 52 }, (_, i) => { const v = i * 5 / 255; return { r: v, g: v, b: v, a: 1 }; });
function firstColourIn(s) {   // the first colour token inside a gradient string
  const m = s.match(/color-mix\((?:[^()]|\([^()]*\))*\)|rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/); return parseColour(m[0]);
}
function layers(c) {
  const spec = c.col('glass-spec');
  const pl = c.vals.get('--glass-pickup-layer'); const pick = firstColourIn(pl);
  // sanity: the tinted recipes are sheen → pickup → fill, in that order (first listed = on top)
  const tinted = splitTop(c.vals.get('--glass-bg-strong-tinted'), ',').join(',');
  return { spec, pick };
}

for (const c of all) {
  const W = wordAt(c); const hi = c.hi; const T = hi ? 7 : 4.5;
  const S = n => c.solid(n);
  const B = backs(c); const { spec, pick } = layers(c);
  // A. neutral text on opaque surfaces
  for (const bg of OPAQUE) {
    gate('text/opaque ≥ 7', cr(S('text'), S(bg)), 7, `${W}/${bg}`); note('text/opaque', cr(S('text'), S(bg)), `${W}/${bg}`);
    gate(`text-2/${PAGE_CARD_SHEET.includes(bg) ? 'page-card-sheet ≥ 6' : 'wells ≥ 4.5'}${hi ? ' (7:1 mode ≥ 7)' : ''}`, cr(S('text-2'), S(bg)), hi ? 7 : PAGE_CARD_SHEET.includes(bg) ? 6 : 4.5, `${W}/${bg}`);
    note(`text-2/opaque${hi ? '/hi' : ''}`, cr(S('text-2'), S(bg)), `${W}/${bg}`);
    if (PAGE_CARD_SHEET.includes(bg)) note(`text-2/pcs${hi ? '/hi' : ''}`, cr(S('text-2'), S(bg)), `${W}/${bg}`); else note(`text-2/wells${hi ? '/hi' : ''}`, cr(S('text-2'), S(bg)), `${W}/${bg}`);
    for (const t of ['text-3', 'placeholder', 'muted']) { gate(`${t}/opaque ≥ ${T}`, cr(S(t), S(bg)), T, `${W}/${bg}`); note(`${t}/opaque${hi ? '/hi' : ''}`, cr(S(t), S(bg)), `${W}/${bg}`); }
  }
  for (const t of ['text', 'text-2', 'text-3']) { gate(`${t}/accent-wash ≥ ${T}`, cr(S(t), S('accent-wash')), T, W); note(`${t}/accent-wash${hi ? '/hi' : ''}`, cr(S(t), S('accent-wash')), W); }
  // B. families
  for (const f of FAMILIES) {
    const F = n => S(`${f}-${n}`);
    const isSem = SEMANTIC.includes(f);
    for (const bg of ['wash', 'fill']) { const v = cr(F('ink'), F(bg)); gate(`fam ink/${bg} ≥ ${T}`, v, T, `${W}/${f}`); note(`fam:${f}:ink/${bg}:${c.scheme}${hi ? ':hi' : ''}`, v, W); note(`ink/${bg}${hi ? '/hi' : ''}`, v, `${W}/${f}`); }
    for (const bg of OPAQUE) { const v = cr(F('ink'), S(bg)); gate(`fam ink/opaque ≥ ${T}`, v, T, `${W}/${f}/${bg}`); note(`fam:${f}:ink/opaque:${c.scheme}${hi ? ':hi' : ''}`, v, `${W}/${bg}`); note(`ink/opaque${hi ? '/hi' : ''}`, v, `${W}/${f}/${bg}`); if (bg === 'surface') note(`fam:${f}:ink/surface:${c.scheme}`, v, W); }
    { const v = cr(F('ink-hi'), F('fill')); gate('fam ink-hi/fill ≥ 7', v, 7, `${W}/${f}`); note(`fam:${f}:ink-hi/fill:${c.scheme}`, v, W); note(`ink-hi/fill:${c.scheme}`, v, `${W}/${f}`); }
    for (const bg of OPAQUE) gate('fam ink-hi/opaque ≥ 7', cr(F('ink-hi'), S(bg)), 7, `${W}/${f}/${bg}`);
    { const v = cr(F('ink'), F('fill-strong')); gate('fam ink/fill-strong (tile glyph) ≥ 3', v, 3, `${W}/${f}`); note(`fam:${f}:ink/fill-strong:${c.scheme}${hi ? ':hi' : ''}`, v, W); note(`tile glyph${hi ? '/hi' : ''}`, v, `${W}/${f}`); }
    { const v = cr(F('on'), F('strong')); const thr = isSem ? 4.5 : T; gate(`fam on/strong ≥ ${thr}${isSem ? ' (semantic)' : ''}`, v, thr, `${W}/${f}`); note(`fam:${f}:on/strong:${c.scheme}${hi ? ':hi' : ''}`, v, W); note(`on/strong${isSem ? '/sem' : '/person'}${hi ? '/hi' : ''}`, v, `${W}/${f}`); }
    for (const bg of OPAQUE) {
      const v = cr(F('strong'), S(bg)); note(`fam:${f}:strong/opaque:${c.scheme}${hi ? ':hi' : ''}`, v, `${W}/${bg}`);
      if (!isSem) gate(`fam person strong as text/opaque ≥ ${T}`, v, T, `${W}/${f}/${bg}`); else note(`semantic strong as text/opaque${hi ? '/hi' : ''}`, v, `${W}/${f}/${bg}`);
      const g = cr(F('graphic'), S(bg)); gate('fam graphic/opaque ≥ 3', g, 3, `${W}/${f}/${bg}`); note(`fam:${f}:graphic/opaque:${c.scheme}`, g, `${W}/${bg}`); note('graphic/opaque', g, `${W}/${f}/${bg}`);
      if (bg === 'bg') note(`fam:${f}:graphic/page:${c.scheme}`, g, W);
      if (isSem) { gate('semantic strong (graphic) ≥ 3', v, 3, `${W}/${f}/${bg}`); }
    }
    if (c.scheme === 'dark') { const v = cr(F('fill'), S('surface')); gate('dark fill (chip) / card ≥ 1.5', v, 1.5, `${W}/${f}`); note(`fam:${f}:fill/card`, v, W); note('dark chip/card', v, `${W}/${f}`); }
  }
  // C. accent roles
  const A = n => S(`accent-${n}`);
  { const v = cr(S('sel-ink'), S('sel-fill')); gate(`sel-ink/sel-fill ≥ ${T}`, v, T, W); note(`sel-ink/sel-fill${hi ? '/hi' : ''}`, v, W); }
  { const v = cr(S('sel-ink-strong'), S('sel-fill-strong')); gate(`sel-ink-strong/sel-fill-strong ≥ ${T}`, v, T, W); note(`sel-strong${hi ? '/hi' : ''}`, v, W); }
  { const v = cr(A('on'), A('strong')); gate(`accent-on/accent-strong ≥ ${T}`, v, T, W); note(`accent on/strong${hi ? '/hi' : ''}`, v, W); note(`acc:${c.accent}:on/strong${hi ? ':hi' : ''}`, v, W); }
  { const v = cr(S('hero-btn-ink'), S('hero-btn-bg')); gate(`hero-btn ≥ ${T}`, v, T, W); note(`hero-btn${hi ? '/hi' : ''}:${c.scheme}`, v, W); note(`acc:${c.accent}:hero${hi ? ':hi' : ''}`, v, W); note(`hero-btn${hi ? '/hi' : ''}`, v, W); }
  for (const stop of ['wash', 'fill']) { const v = cr(A('ink'), A(stop)); gate(`accent-ink/hero-bg stop ≥ ${T}`, v, T, `${W}/${stop}`); if (stop === 'fill') note(`hero-bg ink${hi ? '/hi' : ''}`, v, W); }
  for (const bg of OPAQUE) {
    for (const t of ['accent', 'tint', 'accent-strong', 'accent-deep', 'accent-ink']) { const v = cr(S(t), S(bg)); gate(`legacy/role ${t} as text/opaque ≥ ${T}`, v, T, `${W}/${bg}`); if (t === 'accent') note(`legacy accent as text${hi ? '/hi' : ''}`, v, `${W}/${bg}`); }
    for (const t of ['focus-ring-color', 'today-ring', 'accent-graphic', 'sel-fill-strong', 'timer-done']) { const v = cr(S(t), S(bg)); gate(`${t}/opaque ≥ 3`, v, 3, `${W}/${bg}`); note(`${t}/opaque`, v, `${W}/${bg}`); }
    { const v = cr(A('graphic'), S(bg)); gate('large numerals in the person graphic ≥ 3', v, 3, `${W}/${bg}`); note(`numeral graphic${hi ? '/hi' : ''}`, v, `${W}/${bg}`); }
    { const v = cr(A('ink'), S(bg)); note(`acc:${c.accent}:ink/${bg}`, v, W); if (c.scheme === 'dark' && bg === 'surface') note('dark accent-ink/card', v, W); if (c.scheme === 'dark') note('dark accent-graphic/opaque', cr(A('graphic'), S(bg)), `${W}/${bg}`); }
  }
  if (c.mode === 'adult') {
    note(`acc:${c.accent}:ink/card`, cr(A('ink'), S('surface')), W); note(`acc:${c.accent}:ink/page`, cr(A('ink'), S('bg')), W);
    note(`acc:${c.accent}:ink/fill`, cr(A('ink'), A('fill')), W); note(`acc:${c.accent}:strong/page`, cr(A('strong'), S('bg')), W);
    note(`acc:${c.accent}:graphic/page`, cr(A('graphic'), S('bg')), W);
    if (c.scheme === 'dark') note(`acc:${c.accent}:graphic/card:dark`, cr(A('graphic'), S('surface')), W);
    note(`acc:${c.accent}:tab label on glass/mid`, cr(A('ink'), over(c.col('glass-strong'), B.mid)), W);
  }
  { const v = cr(S('progress-fill'), S('progress-track')); gate('progress fill/track ≥ 3', v, 3, W); note('progress', v, W); }
  // D. legacy hue aliases as text + their soft/ink pairs
  for (const t of ['gold', 'olive', 'teal', 'terra', 'slate', 'mocha', 'ok', 'warn', 'danger', 'info-ink', 'gold-ink', 'ok-ink', 'warn-ink', 'attention'])
    for (const bg of OPAQUE) gate(`legacy ${t} as text/opaque ≥ ${T}`, cr(S(t), S(bg)), T, `${W}/${bg}`);
  for (const [ink, fill] of [['ok-ink', 'ok-soft'], ['warn-ink', 'warn-soft'], ['gold-ink', 'gold-soft'], ['olive-ink', 'olive-soft'], ['teal-ink', 'teal-soft'], ['terra-ink', 'terra-soft'], ['slate-ink', 'slate-soft'], ['mocha-ink', 'mocha-soft'], ['info-ink', 'info-soft'], ['danger', 'danger-soft'], ['attention', 'attention-fill'], ['wait-short-ink', 'wait-short'], ['wait-medium-ink', 'wait-medium'], ['wait-long-ink', 'wait-long'], ['wait-closed-ink', 'wait-closed']])
    gate(`ink on fill (${ink}/${fill}) ≥ ${T}`, cr(S(ink), S(fill)), T, W);
  // E. non-text
  for (const fg of ['field-border', 'track-info', 'cell-empty', 'switch-off-ring', 'muted-decor', 'status-offline', 'status-pending', 'status-synced', 'status-error', 'fresh', 'aging', 'use-soon', 'cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-8', 'star-stroke', 'map-north', 'map-attr', 'map-shop', 'map-dine', 'map-water'])
    for (const bg of OPAQUE) { const v = cr(S(fg), S(bg)); gate(`${fg}/opaque ≥ 3`, v, 3, `${W}/${bg}`); note(`${fg}/opaque`, v, `${W}/${bg}`); }
  for (const bg of OPAQUE) { const v = cr(S('switch-on'), S(bg)); gate('switch-on/opaque ≥ 3', v, 3, `${W}/${bg}`); note('switch-on/opaque', v, `${W}/${bg}`); note(`switch-on/${bg}:${c.scheme}`, v, W); }
  { const v = cr(S('switch-knob'), S('switch-on')); gate('switch knob/on ≥ 3', v, 3, W); note('switch knob', v, W); }
  { const v = cr(S('chevron-colour'), S('fill-field')); gate('chevron/field ≥ 3', v, 3, W); note('chevron', v, W); }
  { const v = cr(S('badge-ink'), S('badge-bg')); gate(`badge label ≥ ${T}`, v, T, W); note(`badge label${hi ? '/hi' : ''}`, v, W); }
  for (const bg of PAGE_CARD_SHEET) { const v = cr(S('badge-bg'), S(bg)); gate('badge/page-card-sheet ≥ 3', v, 3, `${W}/${bg}`); note(`badge/${bg}${hi ? '/hi' : ''}`, v, W); note(`badge/pcs${hi ? '/hi' : ''}`, v, `${W}/${bg}`); }
  // F. translucent roles over backdrops (every backdrop: the palette's grounds, #767676, black, white and a grey ramp)
  const anyBacks = [...OPAQUE.map(n => [n, S(n)]), ['mid', P('#767676')], ['black', P('#000000')], ['white', P('#FFFFFF')], ...GREYS.map((g, i) => ['grey' + i * 5, g])];
  for (const [bn, b] of anyBacks) {
    { const v = cr(S('toast-ink'), over(c.col('toast-bg'), b)); gate('toast-ink over toast over any backdrop ≥ 7', v, 7, `${W}/${bn}`); note(`toast-ink${hi ? '/hi' : ''}`, v, `${W}/${bn}`); }
    { const v = cr(S('toast-ink-2'), over(c.col('toast-bg'), b)); gate(`toast-ink-2 over any backdrop ≥ ${T}`, v, T, `${W}/${bn}`); note(`toast-ink-2${hi ? '/hi' : ''}`, v, `${W}/${bn}`); }
    { const v = cr(S('glass-inverse-ink'), over(c.col('glass-inverse'), b)); gate(`glass-inverse-ink over any backdrop ≥ ${T}`, v, T, `${W}/${bn}`); note(`inverse${hi ? '/hi' : ''}`, v, `${W}/${bn}`); }
  }
  // the TV panel over album photos (white, black, mid grey, grey ramp, every pastel fill and tile end of both schemes)
  if (c.mode === 'kiosk' || c.mode === 'kiosk+rt' || c.mode === 'adult') {
    const photos = [...anyBacks, ...FAMILIES.flatMap(f => [[f + '-fill', S(f + '-fill')], [f + '-fill-strong', S(f + '-fill-strong')]])];
    for (const [pn, ph] of photos) {
      const bgc = over(c.col('tv-panel'), ph);
      const v1 = cr(S('tv-text'), bgc), v2 = cr(S('tv-text-2'), bgc);
      gate('tv-text over tv-panel over any photo ≥ 7', v1, 7, `${W}/${pn}`); gate('tv-text-2 over tv-panel over any photo ≥ 7', v2, 7, `${W}/${pn}`);
      note('tv-text', v1, `${W}/${pn}`); note('tv-text-2', v2, `${W}/${pn}`);
    }
  }
  // G. glass: the fill alone, the full sheen, the full sheen + pickup (text), tabs, status dots
  for (const [bn, b] of Object.entries(B)) {
    for (const g of ['glass', 'glass-strong']) {
      const fill = over(c.col(g), b);
      const sheen = over(spec, fill);
      const tint = over(spec, over(pick, fill));
      const v1 = cr(S('text'), fill), v2 = cr(S('text-2'), fill);
      gate('text on glass fill ≥ 7', v1, 7, `${W}/${g}/${bn}`); gate(`text-2 on glass fill ≥ ${T}`, v2, T, `${W}/${g}/${bn}`);
      note(`glassfill:text${hi ? '/hi' : ''}${bn === 'worst' ? '/worst' : ''}`, v1, `${W}/${g}/${bn}`); note(`glassfill:text-2${hi ? '/hi' : ''}${bn === 'worst' ? '/worst' : ''}`, v2, `${W}/${g}/${bn}`);
      if (g === 'glass' && bn === 'worst') note(`nt:${c.pal}:text-2 on glass over worst${c.mode === 'adult' ? '' : ':' + c.mode}`, v2, W);
      if (bn !== 'worst') { const v3 = cr(S('text-3'), fill); gate(`text-3 on glass fill ≥ ${T}`, v3, T, `${W}/${g}/${bn}`); }
      const gated = g === 'glass-strong' || bn !== 'worst';
      for (const [nm, bgc] of [['sheen', sheen], ['sheen+pickup', tint]]) {
        const p1 = cr(S('text'), bgc), p2 = cr(S('text-2'), bgc);
        if (gated) { gate(`text under ${nm} on ${g} ≥ 7`, p1, 7, `${W}/${bn}`); gate(`text-2 under ${nm} on ${g} ≥ ${T}`, p2, T, `${W}/${bn}`); }
        note(`${nm}:${g}:text${hi ? '/hi' : ''}${bn === 'worst' ? '/worst' : '/pcm'}`, p1, `${W}/${bn}`); note(`${nm}:${g}:text-2${hi ? '/hi' : ''}${bn === 'worst' ? '/worst' : '/pcm'}`, p2, `${W}/${bn}`);
      }
    }
    const gs = over(c.col('glass-strong'), b);
    const gsSheen = over(spec, gs);
    const gsPick = over(pick, gs);
    if (bn !== 'worst') {
      { const v = cr(S('accent-ink'), gsSheen); gate(`selected tab (accent-ink) under the full sheen ≥ ${T}`, v, T, `${W}/${bn}`); note(`tab sel sheen${hi ? '/hi' : ''}`, v, `${W}/${bn}`); }
      { const v = cr(S('text-3'), gsSheen); gate(`unselected tab (text-3) under the full sheen ≥ ${T}`, v, T, `${W}/${bn}`); note(`tab unsel sheen${hi ? '/hi' : ''}`, v, `${W}/${bn}`); }
      for (const s of ['status-offline', 'status-pending', 'status-synced', 'status-error', 'map-north']) { const v = cr(S(s), gs); gate(`${s} on glass-strong ≥ 3`, v, 3, `${W}/${bn}`); if (s.startsWith('status')) note(`status dots on glass${bn === 'mid' ? '/mid' : ''}`, v, `${W}/${s}/${bn}`); }
      { const v = cr(S('accent-graphic'), gs); gate('identity mark on the bar (no sheen, no pickup) ≥ 3', v, 3, `${W}/${bn}`); note('mark on bar', v, `${W}/${bn}`); }
      { const v = cr(S('accent-ink'), gs); if (bn === 'mid') { gate(`tab label on glass over #767676 ≥ ${T}`, v, T, W); note(`tab label mid${hi ? '/hi' : ''}`, v, W); } }
    }
    if (c.mode === 'adult') {
      note(`marks:ink pickup:${bn}`, cr(S('accent-ink'), gsPick), W);
      note(`marks:graphic pickup:${bn}`, cr(S('accent-graphic'), gsPick), W);
      note(`marks:graphic sheen:${bn}`, cr(S('accent-graphic'), gsSheen), W);
    }
    note(`marks:graphic sheen:${bn}:${c.mode}`, cr(S('accent-graphic'), gsSheen), W);
    // true worst over ANY backdrop (grey ramp): for mid-tone marks black/white are not the worst
    if (bn === 'worst' && c.mode === 'adult') {
      let wg = Infinity, wi = Infinity; for (const g of GREYS) { const x = over(c.col('glass-strong'), g); wg = Math.min(wg, cr(S('accent-graphic'), over(pick, x))); wi = Math.min(wi, cr(S('accent-ink'), over(pick, x))); }
      note('marks:graphic pickup:any-grey', wg, W); note('marks:ink pickup:any-grey', wi, W);
    }
  }
  // H. semantic luminance separation + CVD info
  { const Ls = n => S(`${n}-strong`); note(`sem lum${hi ? '/hi' : ''}`, cr(Ls('success'), Ls('danger')), `${W}/success-danger`); note(`sem lum${hi ? '/hi' : ''}`, cr(Ls('warning'), Ls('danger')), `${W}/warning-danger`);
    gate('semantic strong luminance ratio ≥ 1.3', cr(Ls('success'), Ls('danger')), 1.3, `${W}/s-d`); gate('semantic strong luminance ratio ≥ 1.3', cr(Ls('warning'), Ls('danger')), 1.3, `${W}/w-d`); }
  // I. separator composited over its own page / card
  if (c.mode === 'adult' && c.accent === 'graphite' && c.theme in PALETTES) for (const bg of ['bg', 'surface']) note(`separator:${c.scheme}`, cr(over(c.col('separator'), S(bg)), S(bg)), `${c.theme}/${bg}`);
  // J. star
  // K. labelled legacy tints, as written with v3 tokens
  {
    const tint = c.vals.get('--tint'), surf = c.vals.get('--surface'), text = c.vals.get('--text'), tintInk = c.vals.get('--tint-ink');
    const mix = (a, p, b) => parseColour(`color-mix(in srgb, ${a} ${p}%, ${b})`);
    const appIcon = Math.min(cr(parseColour(tint), mix(tint, 22, surf)), cr(parseColour(tint), mix(tint, 8, surf)));
    const ficon = cr(parseColour(tintInk), mix(tint, 14, surf));
    const chip = cr(mix(tint, 70, text), mix(tint, 14, surf));
    note(`label:app-icon${hi ? '/hi' : ''}`, appIcon, W); note(`label:ficon${hi ? '/hi' : ''}`, ficon, W); note(`label:person-chip${hi ? '/hi' : ''}`, chip, W);
  }
  // L. depth
  note(`card/page:${c.pal}`, cr(S('surface'), S('bg')), W); note(`card/page:${c.scheme}`, cr(S('surface'), S('bg')), W);
  if (c.mode === 'adult' && c.accent === 'graphite') for (const bg of OPAQUE) note(`fieldborder:${c.pal}`, cr(S('field-border'), S(bg)), `${c.theme}/${bg}`);
  if (c.accent === 'graphite') for (const bg of OPAQUE) { note(`nt:${c.pal}:text-2 min${c.mode === 'adult' ? '' : ':' + c.mode}`, cr(S('text-2'), S(bg)), `${c.theme}/${bg}`); note(`nt:${c.pal}:text-3 min${c.mode === 'adult' ? '' : ':' + c.mode}`, cr(S('text-3'), S(bg)), `${c.theme}/${bg}`); }
  if (c.accent === 'graphite' && c.mode === 'adult') note(`nt:${c.pal}:text/bg`, cr(S('text'), S('bg')), c.theme);
  // M. semantic -on in every mode
  for (const f of SEMANTIC) note(`sem on/strong all modes`, cr(S(`${f}-on`), S(`${f}-strong`)), `${W}/${f}`);
  // N. star stroke
  for (const bg of OPAQUE) note('star-stroke', cr(S('star-stroke'), S(bg)), `${W}/${bg}`);
}

// No-theme dark root must equal Midnight token-for-token in every mode (and a light one Hearth)
const noThemeDiffs = [];
for (const mode of Object.keys(MODES)) for (const accent of ['graphite', 'mint', 'lavender']) for (const [nt, ref] of [['no-theme-dark', 'midnight'], ['no-theme-light', 'hearth'], ['alias-dark', 'midnight'], ['alias-light', 'hearth']]) {
  const a = ctx(nt, accent, mode), b = ctx(ref, accent, mode);
  const keys = new Set([...a.vals.keys(), ...b.vals.keys()]); const d = [];
  for (const k of keys) if (a.vals.get(k) !== b.vals.get(k)) d.push(`${k}: ${a.vals.get(k)} vs ${b.vals.get(k)}`);
  if (d.length) noThemeDiffs.push({ mode, accent, nt, ref, diffs: d.slice(0, 8), n: d.length });
}
// prefers-contrast media with the data-contrast="standard" opt-out = adult; media alone = attribute
const mediaDiffs = [];
for (const theme of Object.keys(PALETTES)) for (const accent of ['bubblegum', 'graphite']) {
  const std = ctx(theme, accent, 'adult', { prefersContrast: 'more' });
  const elStd = { isRoot: true, attrs: { ...THEMES[theme].attrs, 'data-accent': accent, 'data-contrast': 'standard' } };
  const vStd = cascade(elStd, { ...BASE_ENV, prefersContrast: 'more' }, null), vAd = ctx(theme, accent, 'adult').vals;
  for (const k of new Set([...vStd.keys(), ...vAd.keys()])) if (vStd.get(k) !== vAd.get(k)) mediaDiffs.push(`${theme}/${accent} opt-out: ${k}`);
  const vA = ctx(theme, accent, 'contrast-more').vals, vM = ctx(theme, accent, 'contrast-media').vals;
  for (const k of new Set([...vA.keys(), ...vM.keys()])) if (vA.get(k) !== vM.get(k)) mediaDiffs.push(`${theme}/${accent} attr vs media: ${k}`);
}

// Nested scopes: a theme swatch (data-theme-preview + data-scheme + data-accent) inside a 7:1-mode root.
const nested = [];
for (const mode of ['kiosk', 'contrast-more']) for (const [root, prev, sch] of [['hearth', 'midnight', 'dark'], ['midnight', 'hearth', 'light'], ['hearth', 'hearth', 'light']]) {
  const rootEl = { isRoot: true, attrs: { ...THEMES[root].attrs, 'data-accent': 'mint', ...MODES[mode].attrs } };
  const rv = cascade(rootEl, BASE_ENV, null);
  const child = { isRoot: false, attrs: { 'data-theme-preview': prev, 'data-scheme': sch, 'data-accent': 'mint' } };
  const cv = cascade(child, BASE_ENV, rv);
  const s = n => parseColour(cv.get('--' + n));
  nested.push({ mode, root, preview: prev, 'text-3/surface': +cr(s('text-3'), s('surface')).toFixed(3), 'accent-ink/accent-fill': +cr(s('accent-ink'), s('accent-fill')).toFixed(3), 'accent-on/accent-strong': +cr(s('accent-on'), s('accent-strong')).toFixed(3), 'mint-ink value': cv.get('--mint-ink'), 'text-3 value': cv.get('--text-3') });
}
// a plain nested data-accent (an avatar) inside a 7:1-mode root keeps ink-hi
const nestedAccent = [];
for (const mode of ['kiosk', 'contrast-more']) for (const theme of Object.keys(PALETTES)) {
  const rootEl = { isRoot: true, attrs: { ...THEMES[theme].attrs, 'data-accent': 'graphite', ...MODES[mode].attrs } };
  const rv = cascade(rootEl, BASE_ENV, null);
  for (const a of ACCENTS) { const cv = cascade({ isRoot: false, attrs: { 'data-accent': a } }, BASE_ENV, rv); const s = n => parseColour(cv.get('--' + n)); const v = cr(s('accent-on'), s('accent-strong')); const w = cr(s('accent-ink'), s('accent-fill')); gate('nested data-accent in a 7:1 mode: on/strong ≥ 7', v, 7, `${theme}/${mode}/${a}`); gate('nested data-accent in a 7:1 mode: ink/fill ≥ 7', w, 7, `${theme}/${mode}/${a}`); }
}

// ───────────────────────── CVD ─────────────────────────
const cvd = {};
for (const scheme of ['light', 'dark']) {
  const c = ctx(scheme === 'light' ? 'hearth' : 'midnight', 'graphite', 'adult');
  for (const set of ['graphic', 'fill']) for (const type of ['normal', 'protan', 'deutan', 'tritan']) {
    let min = Infinity, at = '';
    const names = set === 'graphic' ? PERSON : ACCENTS.slice(0, 8);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const d = dE(c.solid(`${names[i]}-${set}`), c.solid(`${names[j]}-${set}`), type); if (d < min) { min = d; at = `${names[i]}/${names[j]}`; } }
    cvd[`${scheme}/${set}/${type}`] = { v: min, at };
    if (set === 'graphic' && type !== 'tritan') gate(`CVD person graphics ${type} ≥ 10`, min, 10, `${scheme}/${at}`);
  }
  // semantic vs person
  let sm = Infinity, sat = '';
  for (const s of SEMANTIC) for (const p of PERSON) { const d = dE(c.solid(`${s}-graphic`), c.solid(`${p}-graphic`)); if (d < sm) { sm = d; sat = `${s}/${p}`; } }
  cvd[`${scheme}/semantic-vs-person`] = { v: sm, at: sat }; gate('semantic graphic vs person graphic ≥ 10 ΔE00', sm, 10, `${scheme}/${sat}`);
  for (const type of ['protan', 'deutan']) for (const [a, b] of [['success', 'warning'], ['success', 'danger'], ['warning', 'danger']]) cvd[`${scheme}/sem/${a}-${b}/${type}`] = { v: dE(c.solid(`${a}-graphic`), c.solid(`${b}-graphic`), type) };
  // pastel fill chroma
  for (const f of ACCENTS.slice(0, 8)) note(`C:${f}:${scheme}`, oklchC(c.solid(`${f}-fill`)), scheme);
  for (const f of ACCENTS.slice(0, 8)) note('fill C', oklchC(c.solid(`${f}-fill`)), `${scheme}/${f}`);
}
// pickup ΔE00 from the bare pane (hue tone vs the strong tone), and the historic pickup cap
const pickupDE = {};
for (const theme of ['hearth', 'frost', 'midnight', 'graphite']) for (const a of ACCENTS.slice(0, 8)) {
  const c = ctx(theme, a, 'adult');
  for (const g of ['glass', 'glass-strong']) {
    const pane = over(c.col(g), c.solid('surface'));
    const p = parseFloat(c.vals.get('--glass-pickup')) / 100;
    const fs = c.solid('accent-fill-strong'), st = c.solid('accent-strong');
    const withTone = t => over({ ...t, a: p }, pane);
    const OLD = { hearth: 0.12, frost: 0.10, midnight: 0.16, graphite: 0.14 };   // revision 2's --glass-pickup, used with the strong tone
    { const k = `${g}:${c.scheme}:strong@rev2`; const d = dE(over({ ...st, a: OLD[theme] }, pane), pane); const mm = pickupDE[k] ??= { min: Infinity, max: -Infinity }; mm.min = Math.min(mm.min, d); mm.max = Math.max(mm.max, d); }
    for (const [nm, t] of [['fill-strong', fs], ['strong', st]]) { const k = `${g}:${c.scheme}:${nm}`; const d = dE(withTone(t), pane); const m = pickupDE[k] ??= { min: Infinity, max: -Infinity }; m.min = Math.min(m.min, d); m.max = Math.max(m.max, d); }
  }
}
function capAt(p) {   // strong tone at p over glass-strong over #767676: min over dark palettes of accent-graphic
  let min = Infinity, at = '';
  for (const theme of Object.keys(PALETTES)) for (const a of ACCENTS) { const c = ctx(theme, a, 'adult'); const pk = { ...c.solid('accent-strong'), a: p }; const v = cr(c.solid('accent-graphic'), over(pk, over(c.col('glass-strong'), P('#767676')))); if (v < min) { min = v; at = `${theme}/${a}`; } }
  return { min, at };
}
const cap = { at6: capAt(0.06), at59: capAt(0.059) };
// the historic strong-tone pickup: a sheet title (text under the full sheen + the full pickup) on --glass-strong over a white photo
function strongToneTitle(strengths) {
  let min = Infinity, at = '';
  for (const theme of Object.keys(PALETTES)) for (const a of ACCENTS) { const c = ctx(theme, a, 'adult'); const pp = strengths ? strengths[theme] : parseFloat(c.vals.get('--glass-pickup')) / 100; const pk = { ...c.solid('accent-strong'), a: pp }; for (const b of [P('#FFFFFF'), P('#000000')]) { const v = cr(c.solid('text'), over(c.col('glass-spec'), over(pk, over(c.col('glass-strong'), b)))); if (v < min) { min = v; at = `${theme}/${a}`; } } }
  return { min, at };
}
const strongTone = { rev3Strengths: strongToneTitle(null), rev2Strengths: strongToneTitle({ hearth: .12, frost: .10, parchment: .12, midnight: .16, forest: .16, graphite: .14 }) };
// the TV panel at .66 (the comment's 5.10)
const tv66 = (() => { const c = ctx('hearth', 'graphite', 'kiosk'); return cr(c.solid('tv-text-2'), over(P('rgba(0,0,0,0.66)'), P('#FFFFFF'))); })();

// ───────────────────────── claims ─────────────────────────
const claims = [];
const m = k => { const x = M.get(k); if (!x) throw new Error('no metric ' + k); return x; };
function claim(where, stated, trueV, at, opts = {}) {
  const tol = opts.tol ?? 0.05; const bound = opts.bound ?? true;   // bound: a minimum / "≥" — must not be above the truth
  const within = opts.thresholdOnly ? true : Math.abs(stated - trueV) <= tol + 1e-9;
  const notAbove = !bound || stated <= trueV + 1e-9;
  claims.push({ where, stated, true: +trueV.toFixed(4), at, ok: within && notAbove, within, notAbove });
}
const minOf = (pred) => { let min = Infinity, at = null; for (const [k, v] of M) if (pred(k) && v.min < min) { min = v.min; at = v.at + ' [' + k + ']'; } return { min, at }; };
const maxOf = (pred) => { let max = -Infinity, at = null; for (const [k, v] of M) if (pred(k) && v.max > max) { max = v.max; at = v.atMax + ' [' + k + ']'; } return { max, at }; };
// hexes: the §2.1 tables must equal the CSS
const HEX = {
  light: { bubblegum: ['#FFC8DD', '#A3134F', '#85003D', '#FF97BF', '#BC1D6F', '#D72D77'], peach: ['#FFD6B8', '#9A3F0A', '#7A2E01', '#FF9E72', '#AA4400', '#954C00'], butter: ['#FFF1A8', '#735A00', '#574400', '#EAAC2C', '#845D00', '#9C7A00'], mint: ['#B9F2D0', '#0E6B3B', '#00522A', '#48CD8C', '#007346', '#006F46'], aqua: ['#B5EEF0', '#0B6468', '#004F52', '#00C9DA', '#006B87', '#007E79'], sky: ['#BFDDFF', '#1A4F9C', '#08408C', '#7DBBFF', '#0065B6', '#0071AB'], periwinkle: ['#CCD3FF', '#3440A8', '#2A339A', '#A5B2FF', '#4F52D8', '#606FFE'], lavender: ['#E0CCFF', '#5E2BAE', '#531AA0', '#C7A7FF', '#7F43CA', '#581DB2'], graphite: ['#E3E3E8', '#48484F', '#2C2C30', '#B3B6BF', '#61646B', '#43454C'] },
  dark: { bubblegum: ['#613146', '#FFC2D9', '#FFE0EB', '#7F3858', '#FF99C3', '#F2749E', '#311220'], peach: ['#603616', '#FFC9A5', '#FFE3D2', '#7F410A', '#FFA566', '#EE842C', '#311602'], butter: ['#4D3F02', '#E7D695', '#F3EAC8', '#645300', '#DABC43', '#FFDB7E', '#251D00'], mint: ['#144C31', '#A6E7C1', '#D2F3DE', '#00653D', '#63D99B', '#00976B', '#002614'], aqua: ['#004A4D', '#8FE7EC', '#C8F3F5', '#006064', '#00D7E0', '#00C0B7', '#002425'], sky: ['#1E4266', '#B7DAFF', '#DAECFF', '#1D568B', '#89C3FF', '#9CD0FF', '#061F37'], periwinkle: ['#373D69', '#CAD3FF', '#E3E8FF', '#454D8D', '#ACB8FF', '#859FFF', '#171B38'], lavender: ['#4A3863', '#DFCBFF', '#EEE4FF', '#5F4484', '#CCABFF', '#8569D6', '#231733'], graphite: ['#404045', '#DADADF', '#EDEDF0', '#4C4C52', '#C4C4CC', '#E4E7F0', '#1C1C1F'] },
};
const hexMismatches = [];
for (const scheme of ['light', 'dark']) { const c = ctx(scheme === 'light' ? 'hearth' : 'midnight', 'graphite', 'adult'); for (const [f, hs] of Object.entries(HEX[scheme])) ['fill', 'ink', 'ink-hi', 'fill-strong', 'strong', 'graphic', 'on'].slice(0, hs.length).forEach((r, i) => { const v = hex(c.solid(`${f}-${r}`)); if (v !== hs[i]) hexMismatches.push(`${scheme} ${f}-${r}: stated ${hs[i]}, css ${v}`); }); }
const SEMHEX = { light: { success: ['#C4F7CA', '#005D22', '#008533', '#008533'], warning: ['#FFDCB6', '#724600', '#9F6400', '#BC6D00'], danger: ['#FFC8C3', '#9B1E25', '#900017', '#900017'] }, dark: { success: ['#214B29', '#B0E6B7', '#84E093', '#84E093'], warning: ['#5A390A', '#FACD98', '#FFBB69', '#FFBB69'], danger: ['#64312E', '#FFC6C1', '#F07E79', '#F07E79'] } };
for (const scheme of ['light', 'dark']) { const c = ctx(scheme === 'light' ? 'hearth' : 'midnight', 'graphite', 'adult'); for (const [f, hs] of Object.entries(SEMHEX[scheme])) ['fill', 'ink', 'strong', 'graphic'].forEach((r, i) => { const v = hex(c.solid(`${f}-${r}`)); if (v !== hs[i]) hexMismatches.push(`${scheme} ${f}-${r}: stated ${hs[i]}, css ${v}`); }); }
const NEUT = { hearth: ['#F4F1EC', '#FFFFFF', '#F4F1EC', '#FFFFFF', '#221C17', '#4A423A', '#635B53', '#37302A', '#8C847B', '#EFEBE5'], parchment: ['#ECE2CD', '#FBF7EE', '#F1E9D8', '#FFFBF3', '#2B2116', '#4A3B2B', '#5E4E3A', '#35291B', '#8B7A60', '#EFE6D3'], frost: ['#F2F2F7', '#FFFFFF', '#F2F2F7', '#FFFFFF', '#1D1D1F', '#48484E', '#616168', '#333338', '#85858B', '#EEEEF0'], midnight: ['#0B0A09', '#211F1D', '#2E2B28', '#2A2725', '#F5F2EE', '#D0C9C1', '#A9A198', '#E4DFD9', '#7D766F', '#2E2B28'], forest: ['#070F0D', '#182522', '#213029', '#1F2D29', '#F1ECDF', '#C9D1CB', '#9DA9A1', '#DDE4DF', '#75827B', '#213029'], graphite: ['#000000', '#1C1C1E', '#2C2C2E', '#2C2C2E', '#F5F5F7', '#D1D1D6', '#A1A1A6', '#E5E5EA', '#7C7C80', '#2C2C2E'] };
for (const [p, hs] of Object.entries(NEUT)) { const c = ctx(p, 'graphite', 'adult'); ['bg', 'surface', 'surface-2', 'surface-raised', 'text', 'text-2', 'text-3', 'text-2-hi', 'field-border', 'fill-field'].forEach((r, i) => { const v = hex(c.solid(r)); if (v !== hs[i]) hexMismatches.push(`${p} --${r}: stated ${hs[i]}, css ${v}`); }); }

// §2.1 light table
const L21 = { bubblegum: [5.26, 6.97, 5.90, 7.05, 3.77, 5.92, 4.60, 3.60, 0.067], peach: [5.03, 6.23, 5.28, 7.01, 3.36, 5.93, 4.61, 4.93, 0.060], butter: [5.76, 6.06, 5.11, 8.24, 3.26, 5.92, 4.60, 3.14, 0.092], mint: [5.23, 6.12, 5.12, 7.44, 3.26, 5.93, 4.61, 4.85, 0.074], aqua: [5.41, 6.42, 5.37, 7.34, 3.41, 6.08, 4.72, 3.83, 0.057], sky: [5.67, 7.34, 6.17, 7.06, 3.94, 5.93, 4.61, 4.13, 0.056], periwinkle: [5.86, 7.90, 6.67, 7.02, 4.25, 5.94, 4.62, 3.13, 0.061], lavender: [5.85, 7.91, 6.71, 7.04, 4.27, 5.90, 4.58, 7.30, 0.072], graphite: [7.09, 8.26, 7.05, 10.87, 4.47, 5.92, 4.60, 7.44, null] };
const famMin = (f, what, scheme) => { let min = Infinity, at = null; for (const [k, v] of M) if (k === `fam:${f}:${what}:${scheme}` && v.min < min) { min = v.min; at = v.at; } return { min, at }; };
// adult-only light-palette minima need the adult rows only: collect separately
function adultMin(f, fn, scheme) {
  let min = Infinity, at = '';
  for (const p of Object.keys(PALETTES)) { if (PALETTES[p] !== scheme) continue; const c = ctx(p, 'graphite', 'adult'); const v = fn(c, f); if (v < min) { min = v; at = p; } }
  return { min, at };
}
const F_ = (c, f, n) => c.solid(`${f}-${n}`);
const minOver = (c, fg, bgs) => Math.min(...bgs.map(b => cr(fg, c.solid(b))));
for (const [f, v] of Object.entries(L21)) {
  const cols = [
    ['ink/fill', (c) => cr(F_(c, f, 'ink'), F_(c, f, 'fill'))], ['ink/wash', (c) => cr(F_(c, f, 'ink'), F_(c, f, 'wash'))], ['ink/all surfaces', (c) => minOver(c, F_(c, f, 'ink'), OPAQUE)],
    ['ink-hi/fill', (c) => cr(F_(c, f, 'ink-hi'), F_(c, f, 'fill'))], ['ink/fill-strong', (c) => cr(F_(c, f, 'ink'), F_(c, f, 'fill-strong'))], ['on/strong', (c) => cr(F_(c, f, 'on'), F_(c, f, 'strong'))],
    ['strong/all surfaces', (c) => minOver(c, F_(c, f, 'strong'), OPAQUE)], ['graphic/surfaces', (c) => minOver(c, F_(c, f, 'graphic'), OPAQUE)],
  ];
  cols.forEach(([nm, fn], i) => { const r = adultMin(f, fn, 'light'); claim(`§2.1 light ${f} ${nm}`, v[i], r.min, r.at); });
  if (v[8] !== null) claim(`§2.1 light ${f} fill C`, v[8], oklchC(ctx('hearth', 'graphite', 'adult').solid(`${f}-fill`)), 'light', { tol: 0.002 });
}
const D21 = { bubblegum: [1.53, 6.86, 9.19, 5.35, 8.55, 6.97, 5.11, 0.074], peach: [1.53, 6.94, 9.31, 5.31, 8.68, 7.12, 5.24, 0.075], butter: [1.52, 7.12, 9.51, 5.19, 8.97, 7.40, 10.32, 0.074], mint: [1.58, 7.03, 9.75, 5.06, 9.26, 7.85, 3.71, 0.074], aqua: [1.57, 7.09, 9.74, 5.18, 9.22, 7.76, 6.07, 0.063], sky: [1.52, 7.14, 9.53, 5.25, 8.98, 7.44, 8.47, 0.074], periwinkle: [1.53, 7.01, 9.39, 5.28, 8.84, 7.27, 5.52, 0.075], lavender: [1.53, 6.93, 9.29, 5.33, 8.72, 7.13, 3.28, 0.074], graphite: [1.53, 7.39, 9.92, 6.12, 9.80, 7.97, 11.17, null] };
for (const [f, v] of Object.entries(D21)) {
  const cols = [
    ['fill/card', (c) => cr(F_(c, f, 'fill'), c.solid('surface'))], ['ink/fill', (c) => cr(F_(c, f, 'ink'), F_(c, f, 'fill'))], ['ink/all surfaces', (c) => minOver(c, F_(c, f, 'ink'), OPAQUE)],
    ['ink/fill-strong', (c) => cr(F_(c, f, 'ink'), F_(c, f, 'fill-strong'))], ['on/strong', (c) => cr(F_(c, f, 'on'), F_(c, f, 'strong'))], ['strong/surfaces', (c) => minOver(c, F_(c, f, 'strong'), OPAQUE)], ['graphic/surfaces', (c) => minOver(c, F_(c, f, 'graphic'), OPAQUE)],
  ];
  cols.forEach(([nm, fn], i) => { const r = adultMin(f, fn, 'dark'); claim(`§2.1 dark ${f} ${nm}`, v[i], r.min, r.at); });
  if (v[7] !== null) claim(`§2.1 dark ${f} fill C`, v[7], oklchC(ctx('midnight', 'graphite', 'adult').solid(`${f}-fill`)), 'dark', { tol: 0.002 });
}
{ let min = Infinity, at = ''; for (const f of PERSON) { const r = adultMin(f, c => cr(F_(c, f, 'ink-hi'), F_(c, f, 'fill')), 'dark'); if (r.min < min) { min = r.min; at = `${r.at}/${f}`; } } claim('§2.1 dark ink-hi on fill ≥ 8.35', 8.35, min, at); claim('§2.1 "true minimum is 8.356" (floored to 3 dp)', 8.356, Math.floor(min * 1000) / 1000, at, { tol: 0.0001, bound: false }); }
{ let min = Infinity, at = ''; for (const f of PERSON) { const r = adultMin(f, c => cr(F_(c, f, 'ink'), F_(c, f, 'fill')), 'dark'); if (r.min < min) { min = r.min; at = `${r.at}/${f}`; } } claim('§2.1 dark ink on its own chip ≥ 6.86', 6.86, min, at); }
{ let min = Infinity, at = ''; for (const f of FAMILIES) { const r = adultMin(f, c => cr(F_(c, f, 'fill'), c.solid('surface')), 'dark'); if (r.min < min) { min = r.min; at = `${r.at}/${f}`; } } claim('§2.1 every dark chip ≥ 1.52 off every dark card', 1.52, min, at); claim('verification: dark chips 1.52', 1.52, min, at); }
// §2.2 semantic
for (const [f, l, d] of [['success', 6.76, 7.06], ['warning', 6.23, 7.03], ['danger', 5.48, 6.97]]) {
  const rl = adultMin(f, c => cr(F_(c, f, 'ink'), F_(c, f, 'fill')), 'light'); claim(`§2.2 light ${f} ink/fill`, l, rl.min, rl.at);
  const rd = adultMin(f, c => cr(F_(c, f, 'ink'), F_(c, f, 'fill')), 'dark'); claim(`§2.2 dark ${f} ink/fill`, d, rd.min, rd.at);
}
const adultAll = (fn) => { let min = Infinity, at = ''; for (const p of Object.keys(PALETTES)) for (const a of ACCENTS) { const c = ctx(p, a, 'adult'); const v = fn(c); if (v < min) { min = v; at = `${p}/${a}`; } } return { min, at }; };
const hiAll = (fn) => { let min = Infinity, at = ''; for (const p of Object.keys(THEMES)) for (const a of ACCENTS) for (const md of Object.keys(MODES)) { if (!MODES[md].hi) continue; const c = ctx(p, a, md); const v = fn(c); if (v < min) { min = v; at = `${p}/${a}/${md}`; } } return { min, at }; };
{ const r = adultAll(c => cr(c.solid('badge-ink'), c.solid('badge-bg'))); claim('§2.2 badge label 6.42', 6.42, r.min, r.at); }
{ const r = adultAll(c => cr(c.solid('badge-bg'), c.solid('surface'))); claim('§2.2 badge vs card ≥ 6.00', 6.00, r.min, r.at); claim('§2.2 badge vs card true minimum 6.004 (floored to 3 dp)', 6.004, Math.floor(r.min * 1000) / 1000, r.at, { tol: 0.0001, bound: false }); }
{ const r = adultAll(c => cr(c.solid('badge-bg'), c.solid('surface-raised'))); claim('§2.2 badge vs sheet ≥ 5.28 (Graphite)', 5.28, r.min, r.at); }
{ const r = adultAll(c => cr(c.solid('badge-bg'), c.solid('bg'))); claim('§2.2 badge vs page ≥ 7.35', 7.35, r.min, r.at); }
{ const r = minOf(k => k === 'sem lum'); claim('§2.2 semantic luminance lowest 1.57', 1.57, r.min, r.at); }
{ const v = Math.min(cvd['light/semantic-vs-person'].v, cvd['dark/semantic-vs-person'].v); claim('§2.2 semantic ≥ 10.74 ΔE00 from every person', 10.74, v, cvd['light/semantic-vs-person'].at + ' / ' + cvd['dark/semantic-vs-person'].at); }
claim('§2.2 success vs warning protan (light) 3.9', 3.9, cvd['light/sem/success-warning/protan'].v, 'light', { bound: false });
claim('§2.2 success vs danger deutan (dark) 8.6', 8.6, cvd['dark/sem/success-danger/deutan'].v, 'dark', { bound: false });
{ const r = adultAll(c => cr(c.solid('switch-knob'), c.solid('switch-on'))); claim('§2.2/§2.5 switch knob ≥ 4.02', 4.02, r.min, r.at); }
// §2.2a
const allModesMin = (fn, onlyHi) => { let min = Infinity, at = ''; for (const c of all) { if (onlyHi === true && !c.hi) continue; if (onlyHi === false && c.hi) continue; const v = fn(c); if (v < min) { min = v; at = wordAt(c); } } return { min, at }; };
{ const r = allModesMin(c => minOver(c, c.solid('text-2'), OPAQUE), false); claim('§2.2a secondary every opaque surface, adult ≥ 7.50', 7.50, r.min, r.at); }
{ const r = allModesMin(c => Math.min(minOver(c, c.solid('text-3'), OPAQUE), minOver(c, c.solid('placeholder'), OPAQUE)), false); claim('§2.2a tertiary every opaque surface, adult ≥ 5.07', 5.07, r.min, r.at); }
{ const r = allModesMin(c => Math.min(minOver(c, c.solid('text-2'), OPAQUE), minOver(c, c.solid('text-3'), OPAQUE)), true); claim('§2.2a secondary/tertiary, 7:1 modes ≥ 10.38', 10.38, r.min, r.at); }
const inkPairs = (c) => Math.min(...FAMILIES.flatMap(f => [cr(F_(c, f, 'ink'), F_(c, f, 'fill')), ...OPAQUE.map(b => cr(F_(c, f, 'ink'), c.solid(b)))]));
{ const r = allModesMin(inkPairs, false); claim('§2.2a hue inks on fills and every surface, adult ≥ 5.03', 5.03, r.min, r.at); }
{ const r = allModesMin(inkPairs, true); claim('§2.2a hue inks, 7:1 modes ≥ 7.01', 7.01, r.min, r.at); }
{ const r = allModesMin(c => minOver(c, c.solid('accent'), OPAQUE), false); claim('§2.2a legacy --accent text adult ≥ 4.58', 4.58, r.min, r.at); }
{ const r = allModesMin(c => minOver(c, c.solid('accent'), OPAQUE), true); claim('§2.2a legacy --accent text 7:1 ≥ 7.28', 7.28, r.min, r.at); }
{ const r = allModesMin(c => Math.min(cr(c.solid('accent-on'), c.solid('accent-strong')), cr(c.solid('sel-ink-strong'), c.solid('sel-fill-strong'))), false); claim('§2.2a primary button / sel-strong adult ≥ 5.90', 5.90, r.min, r.at); }
{ const r = allModesMin(c => Math.min(cr(c.solid('accent-on'), c.solid('accent-strong')), cr(c.solid('sel-ink-strong'), c.solid('sel-fill-strong'))), true); claim('§2.2a primary button / sel-strong 7:1 ≥ 9.37', 9.37, r.min, r.at); }
{ const r = allModesMin(c => c.scheme === 'dark' ? cr(c.solid('hero-btn-ink'), c.solid('hero-btn-bg')) : Infinity, false); claim('§2.2a/§2.4 dark hero button adult ≥ 6.86', 6.86, r.min, r.at); }
{ const r = allModesMin(c => c.scheme === 'dark' ? cr(c.solid('hero-btn-ink'), c.solid('hero-btn-bg')) : Infinity, true); claim('§2.2a/§2.4 dark hero button 7:1 ≥ 8.35', 8.35, r.min, r.at); }
{ const r = allModesMin(c => cr(c.solid('hero-btn-ink'), c.solid('hero-btn-bg')), true); claim('§2.4 hero button in the 7:1 modes, light + dark ≥ 8.35', 8.35, r.min, r.at); }
{ const r = allModesMin(c => cr(c.solid('badge-ink'), c.solid('badge-bg')), false); claim('§2.2a badge adult 6.42', 6.42, r.min, r.at); }
{ const r = allModesMin(c => cr(c.solid('badge-ink'), c.solid('badge-bg')), true); claim('§2.2a badge 7:1 10.73', 10.73, r.min, r.at); }
{ const r = allModesMin(c => minOver(c, c.solid('badge-bg'), PAGE_CARD_SHEET), true); claim('§2.2a badge ≥ 8.34 on every page, card and sheet (7:1)', 8.34, r.min, r.at); }
{ const r = minOf(k => k === 'toast-ink-2'); claim('§2.2a toast-ink-2 adult ≥ 6.58 (every backdrop)', 6.58, r.min, r.at); }
{ const r = minOf(k => k === 'toast-ink-2/hi'); claim('§2.2a toast-ink-2 7:1 ≥ 10.02', 10.02, r.min, r.at); }
{ const r = minOf(k => k.startsWith('toast-ink') && !k.startsWith('toast-ink-2')); claim('§2.5 toast ink ≥ 10.02', 10.02, r.min, r.at); }
{ const r = minOf(k => k === 'inverse'); claim('§2.2a/§2.5 inverse glass adult ≥ 6.52 (every backdrop)', 6.52, r.min, r.at); }
{ const r = minOf(k => k === 'inverse/hi'); claim('§2.2a/§2.5 inverse glass 7:1 ≥ 7.37', 7.37, r.min, r.at); }
{ const r = minOf(k => k === 'tv-text'); claim('§2.2a/§2.5 tv-text ≥ 10.00', 10.00, r.min, r.at); }
{ const r = minOf(k => k === 'tv-text-2'); claim('§2.2a/§2.5 tv-text-2 ≥ 7.03', 7.03, r.min, r.at); }
{ const r = minOf(k => k === 'sem on/strong all modes'); claim('§2.2a semantic -on on -strong ≥ 4.76 (every mode)', 4.76, r.min, r.at); }
{ const r = minOf(k => k.startsWith('numeral graphic')); claim('§2.2a large numerals graphic ≥ 3.13', 3.13, r.min, r.at); }
{ const r = minOf(k => /^glassfill:text(\/hi)?(\/worst)?$/.test(k) && !k.includes('/hi')); claim('§2.2a/§7 primary text on glass (fill alone) ≥ 7.01', 7.01, r.min, r.at); }
// text on glass in 7:1 modes: fill, sheen, sheen+pickup, over every gated backdrop incl. a white photo
{ const r = minOf(k => (/^glassfill:text-?2?\/hi/.test(k)) || (/^(sheen|sheen\+pickup):glass-strong:text(-2)?\/hi/.test(k)) || (/^(sheen|sheen\+pickup):glass:text(-2)?\/hi\/pcm/.test(k))); claim('§2.2a text on glass (every layer) 7:1 ≥ 7', 7, r.min, r.at, { thresholdOnly: true }); }
// §2.3 neutral table
const N23 = { hearth: [14.95, 8.21, 5.55, 5.82, 3.07, 1.12], parchment: [12.25, 8.36, 6.21, 5.96, 3.23, 1.20], frost: [15.08, 7.50, 5.07, 5.36, 3.03, 1.11], midnight: [17.72, 8.58, 5.52, 5.23, 3.14, 1.20], forest: [16.43, 8.86, 5.67, 5.30, 3.44, 1.22], graphite: [19.28, 9.15, 5.41, 5.86, 3.35, 1.23] };
for (const [p, v] of Object.entries(N23)) {
  const c = ctx(p, 'graphite', 'adult');
  claim(`§2.3 ${p} text/page`, v[0], cr(c.solid('text'), c.solid('bg')), p, { bound: false });
  claim(`§2.3 ${p} text-2 lowest opaque`, v[1], minOver(c, c.solid('text-2'), OPAQUE), p);
  claim(`§2.3 ${p} text-3 lowest opaque`, v[2], minOver(c, c.solid('text-3'), OPAQUE), p);
  claim(`§2.3 ${p} text-2 on glass (fill alone) over the worst backdrop`, v[3], cr(c.solid('text-2'), over(c.col('glass'), backs(c).worst)), p);
  claim(`§2.3 ${p} field-border lowest`, v[4], minOver(c, c.solid('field-border'), OPAQUE), p);
  claim(`§2.3 ${p} card ÷ page`, v[5], cr(c.solid('surface'), c.solid('bg')), p, { bound: false });
}
// §2.4 accent matrix (min over the six palettes, adult)
const A24 = { bubblegum: [7.10, 5.90, 5.26, 5.92, 4.60, 3.60, 6.86, 6.33], peach: [6.35, 5.28, 5.03, 5.93, 4.61, 4.93, 6.79, 5.66], butter: [6.15, 5.11, 5.76, 5.92, 4.60, 3.14, 6.58, 5.48], mint: [6.16, 5.12, 5.23, 5.93, 4.61, 4.85, 6.59, 5.49], aqua: [6.46, 5.37, 5.41, 6.08, 4.72, 3.83, 6.91, 5.76], sky: [7.43, 6.17, 5.67, 5.93, 4.61, 4.13, 7.14, 6.62], periwinkle: [8.03, 6.67, 5.86, 5.94, 4.62, 3.13, 7.01, 7.15], lavender: [8.07, 6.71, 5.85, 5.90, 4.58, 4.60, 6.93, 7.19], graphite: [8.48, 7.05, 7.09, 5.92, 4.60, 7.44, 7.39, 7.55] };
const accMin = (a, fn) => { let min = Infinity, at = ''; for (const p of Object.keys(PALETTES)) { const c = ctx(p, a, 'adult'); const v = fn(c); if (v < min) { min = v; at = p; } } return { min, at }; };
for (const [a, v] of Object.entries(A24)) {
  const fns = [['ink/card', c => cr(c.solid('accent-ink'), c.solid('surface'))], ['ink/page', c => cr(c.solid('accent-ink'), c.solid('bg'))], ['ink/fill', c => cr(c.solid('accent-ink'), c.solid('accent-fill'))], ['on/strong', c => cr(c.solid('accent-on'), c.solid('accent-strong'))], ['strong as text/page', c => cr(c.solid('accent-strong'), c.solid('bg'))], ['graphic/page', c => cr(c.solid('accent-graphic'), c.solid('bg'))], ['hero button ink/bg', c => cr(c.solid('hero-btn-ink'), c.solid('hero-btn-bg'))], ['tab label on glass over #767676', c => cr(c.solid('accent-ink'), over(c.col('glass-strong'), P('#767676')))]];
  fns.forEach(([nm, fn], i) => { const r = accMin(a, fn); claim(`§2.4 ${a} ${nm}`, v[i], r.min, r.at); });
}
{ const r = accMin('lavender', c => c.scheme === 'dark' ? cr(c.solid('accent-graphic'), c.solid('surface')) : Infinity); claim('§2.4 lavender graphic "dark 3.76 on card"', 3.76, r.min, r.at); }
{ const r = minOf(k => k === 'focus-ring-color/opaque' || k === 'today-ring/opaque'); claim('§2.4/§2.5 focus and today rings ≥ 3.13 every surface', 3.13, r.min, r.at); }
{ const r = minOf(k => k === 'sel-ink/sel-fill'); claim('§2.4 selected label on its pill ≥ 5.03', 5.03, r.min, r.at); }
{ const r = minOf(k => k === 'progress'); claim('§2.4 progress ≥ 4.00', 4.00, r.min, r.at); claim('§2.4 progress true minimum 4.005 (floored to 3 dp)', 4.005, Math.floor(r.min * 1000) / 1000, r.at, { tol: 0.0001, bound: false }); }
// CVD table
const C24 = [['light/graphic/normal', 14.60], ['light/graphic/protan', 11.27], ['light/graphic/deutan', 11.02], ['light/graphic/tritan', 5.14], ['light/fill/normal', 7.85], ['light/fill/protan', 1.08], ['light/fill/deutan', 0.48], ['dark/graphic/normal', 13.25], ['dark/graphic/protan', 12.66], ['dark/graphic/deutan', 12.76], ['dark/graphic/tritan', 5.26], ['dark/fill/normal', 7.24], ['dark/fill/protan', 1.30], ['dark/fill/deutan', 0.57]];
for (const [k, v] of C24) claim(`§2.4 CVD ${k}`, v, cvd[k].v, cvd[k].at);
claim('ACCENT-8 graphics ≥ 11.02 under CVD', 11.02, Math.min(cvd['light/graphic/protan'].v, cvd['light/graphic/deutan'].v, cvd['dark/graphic/protan'].v, cvd['dark/graphic/deutan'].v), 'both');
claim('ACCENT-8 dichromat minima low 0.48', 0.48, Math.min(cvd['light/fill/protan'].v, cvd['light/fill/deutan'].v, cvd['dark/fill/protan'].v, cvd['dark/fill/deutan'].v), 'both');
claim('ACCENT-8 dichromat minima high 1.30 (the largest of the four minima)', 1.30, Math.max(cvd['light/fill/protan'].v, cvd['light/fill/deutan'].v, cvd['dark/fill/protan'].v, cvd['dark/fill/deutan'].v), 'both', { bound: false });
// §2.5
{ const r = minOf(k => k === 'switch-on/opaque'); claim('§2.5 switch on ≥ 3.43 every opaque surface', 3.43, r.min, r.at); }
{ const r = minOf(k => k === 'switch-on/surface:dark' || k === 'switch-on/surface:light'); claim('§2.5 switch on the card 3.93', 3.93, r.min, r.at); }
{ const r = adultAll(c => c.theme === 'graphite' ? cr(c.solid('switch-on'), c.solid('surface-raised')) : Infinity); claim("§2.5 switch Graphite's sheet 3.46", 3.46, r.min, r.at); }
{ const r = adultAll(c => c.scheme === 'light' ? minOver(c, c.solid('switch-on'), OPAQUE) : Infinity); claim('§2.5 switch 3.70 in light (Parchment page)', 3.70, r.min, r.at); }
{ const r = minOf(k => k === 'field-border/opaque' || k === 'switch-off-ring/opaque'); claim('§2.5 switch ring / field border ≥ 3.03', 3.03, r.min, r.at); }
{ const r = minOf(k => k === 'cell-empty/opaque'); claim('§2.5 cell-empty ≥ 3.03', 3.03, r.min, r.at); }
{ const r = minOf(k => k === 'muted-decor/opaque'); claim('§2.5 muted-decor ≥ 3.03', 3.03, r.min, r.at); }
{ const r = minOf(k => k === 'status dots on glass/mid'); claim('§2.5 status dots ≥ 3.28 on the glass tab bar over #767676', 3.28, r.min, r.at); }
{ const r = minOf(k => k === 'status dots on glass' || k === 'status dots on glass/mid'); claim('verification: status dots on glass 3.28 (page, card and #767676)', 3.28, r.min, r.at); }
{ const r = minOf(k => k === 'star-stroke'); claim('§2.5 star stroke ≥ 5.11 every surface', 5.11, r.min, r.at); }
// §7
{ const r = minOf(k => /^glassfill:text-2(\/worst)?$/.test(k)); claim('§7 secondary on the glass fill over the worst ≥ 5.23', 5.23, r.min, r.at); }
{ const r = minOf(k => k === 'sheen:glass-strong:text/worst' || k === 'sheen:glass-strong:text/pcm'); claim('§7 full sheen on glass-strong primary ≥ 8.22', 8.22, r.min, r.at); }
{ const r = minOf(k => k === 'sheen:glass-strong:text-2/worst' || k === 'sheen:glass-strong:text-2/pcm'); claim('§7 full sheen on glass-strong secondary ≥ 6.15', 6.15, r.min, r.at); }
{ const r = minOf(k => k === 'sheen+pickup:glass-strong:text/worst' || k === 'sheen+pickup:glass-strong:text/pcm'); claim('§7 sheen+pickup glass-strong primary ≥ 7.52', 7.52, r.min, r.at); }
{ const r = minOf(k => k === 'sheen+pickup:glass-strong:text-2/worst' || k === 'sheen+pickup:glass-strong:text-2/pcm'); claim('§7 sheen+pickup glass-strong secondary ≥ 5.56', 5.56, r.min, r.at); }
{ const r = minOf(k => k === 'sheen+pickup:glass:text/pcm'); claim('§7 sheen+pickup --glass primary ≥ 7.98', 7.98, r.min, r.at); }
{ const r = minOf(k => k === 'sheen+pickup:glass:text-2/pcm'); claim('§7 sheen+pickup --glass secondary ≥ 5.89', 5.89, r.min, r.at); }
{ const r = minOf(k => /^sheen\+pickup:glass-strong:text\/hi/.test(k) || k === 'sheen+pickup:glass:text/hi/pcm'); claim('§7 sheen+pickup 7:1 primary 9.79', 9.79, r.min, r.at); }
{ const r = minOf(k => /^sheen\+pickup:glass-strong:text-2\/hi/.test(k) || k === 'sheen+pickup:glass:text-2/hi/pcm'); claim('§7 sheen+pickup 7:1 secondary 8.93', 8.93, r.min, r.at); }
{ const r = minOf(k => k === 'sheen:glass:text/pcm'); claim('§7 full sheen on --glass primary ≥ 8.89', 8.89, r.min, r.at); }
{ const r = minOf(k => k === 'sheen:glass:text-2/pcm'); claim('§7 full sheen on --glass secondary ≥ 6.62', 6.62, r.min, r.at); }
{ const r = minOf(k => k === 'sheen:glass:text-2/hi/pcm' || k === 'sheen:glass:text/hi/pcm'); claim('§7 full sheen on --glass ≥ 7 in the 7:1 modes', 7, r.min, r.at, { thresholdOnly: true }); }
{ const r = minOf(k => k === 'tab sel sheen'); claim('§7/§1 selected tab under the full sheen ≥ 5.97', 5.97, r.min, r.at); }
{ const r = minOf(k => k === 'tab unsel sheen'); claim('§7 unselected tab (text-3) under the full sheen ≥ 4.50', 4.50, r.min, r.at); }
{ const r = minOf(k => k === 'tab sel sheen/hi' || k === 'tab unsel sheen/hi'); claim('§7 tabs under the full sheen ≥ 7 in the 7:1 modes', 7, r.min, r.at, { thresholdOnly: true }); }
{ const r = minOf(k => k === 'tab label mid'); claim('verification: selected tab label on glass over #767676 5.48', 5.48, r.min, r.at); }
{ const r = adultAll(c => cr(c.solid('text'), over(spec_(c), over(c.col('glass'), backs(c).worst)))); claim('§7 reported: --glass over the worst photo under the sheen, primary 5.94', 5.94, r.min, r.at); }
{ const r = adultAll(c => cr(c.solid('text-2'), over(spec_(c), over(c.col('glass'), backs(c).worst)))); claim('§7 reported: --glass over the worst photo under the sheen, secondary 4.42', 4.42, r.min, r.at); }
function spec_(c) { return c.col('glass-spec'); }
const MK = [['ink pickup', [5.39, 5.47, 4.96, 4.52]], ['graphic pickup', [3.32, 3.27, 2.99, 2.55]], ['graphic sheen', [3.24, 3.15, 2.81, 2.30]]];
for (const [nm, vs] of MK) ['bg', 'surface', 'mid', 'worst'].forEach((b, i) => { const r = minOf(k => k === `marks:${nm}:${b}`); claim(`§7 marks table ${nm} over ${b}`, vs[i], r.min, r.at); });
{ const r = minOf(k => k === 'marks:ink pickup:worst' || k === 'marks:ink pickup:any-grey'); claim('§1 ink ≥ 4.52 under the full pickup over ANY backdrop', 4.52, r.min, r.at); }
{ const r = minOf(k => k === 'marks:graphic pickup:any-grey'); claim('§7 graphic under the full pickup: the worst over ANY backdrop (table says 2.55)', 2.55, r.min, r.at); }
{ const r = minOf(k => k === 'mark on bar'); claim('§7 identity mark on the bar without sheen/pickup ≥ 3.31', 3.31, r.min, r.at); }
{ const r = minOf(k => /^marks:graphic sheen:(bg|surface|mid):(reduce-transparency|rt-media)$/.test(k)); claim('§1 graphic under the full sheen in Reduce Transparency 2.75 (Lavender)', 2.75, r.min, r.at, { bound: false }); }
claim('§7 / rev 3: the strong-tone pickup (revision 2 strengths) took sheet titles to 5.91 over a white photo', 5.91, strongTone.rev2Strengths.min, strongTone.rev2Strengths.at);
claim('tokens.css: --tv-panel at .66 gave --tv-text-2 5.10 over white', 5.10, tv66, 'white');
claim('§7 pickup cap: at 6 % the Forest/Lavender icon measured 2.99', 2.99, cap.at6.min, cap.at6.at);
claim('§7 pickup cap: ≤ 5.9 % keeps ≥ 3', 3.0, cap.at59.min, cap.at59.at, { tol: 0.05, bound: true });
// pickup ΔE ranges
for (const g of ['glass', 'glass-strong']) {
  const fl = x => Math.floor(x * 10) / 10;
  pickupDE[g + ':summary'] = { light: [fl(pickupDE[`${g}:light:fill-strong`].min), fl(pickupDE[`${g}:light:fill-strong`].max)], dark: [fl(pickupDE[`${g}:dark:fill-strong`].min), fl(pickupDE[`${g}:dark:fill-strong`].max)], lightStrong: [fl(pickupDE[`${g}:light:strong`].min), fl(pickupDE[`${g}:light:strong`].max)], darkStrong: [fl(pickupDE[`${g}:dark:strong`].min), fl(pickupDE[`${g}:dark:strong`].max)], lightStrongRev2: [fl(pickupDE[`${g}:light:strong@rev2`].min), fl(pickupDE[`${g}:light:strong@rev2`].max)], darkStrongRev2: [fl(pickupDE[`${g}:dark:strong@rev2`].min), fl(pickupDE[`${g}:dark:strong@rev2`].max)] };
}
{ const s = pickupDE['glass-strong:summary']; claim('§7 pickup ΔE light low 6.2', 6.2, s.light[0], 'glass-strong over card', { tol: 0.05 }); claim('§7 pickup ΔE light high 12.9', 12.9, s.light[1], '', { bound: false }); claim('§7 pickup ΔE dark low 8.2', 8.2, s.dark[0], ''); claim('§7 pickup ΔE dark high 14.3', 14.3, s.dark[1], '', { bound: false }); claim('§7 strong-tone ΔE (revision 2 strengths) light low 5.5', 5.5, s.lightStrongRev2[0], ''); claim('§7 strong-tone ΔE (rev 2) light high 10.7', 10.7, s.lightStrongRev2[1], '', { bound: false }); claim('§7 strong-tone ΔE (rev 2) dark low 8.9', 8.9, s.darkStrongRev2[0], ''); claim('§7 strong-tone ΔE (rev 2) dark high 16.1', 16.1, s.darkStrongRev2[1], '', { bound: false }); }
// verification table and gap table
{ const r = minOf(k => k === 'text/opaque'); claim('verification: primary text 11.71 on opaque surfaces', 11.71, r.min, r.at); }
{ const r = minOf(k => k === 'text-2/pcs'); claim('verification: secondary 8.13 on page, card and sheet', 8.13, r.min, r.at); }
{ const r = minOf(k => k === 'text-2/wells'); claim('verification: secondary 7.50 on wells', 7.50, r.min, r.at); }
{ const r = minOf(k => k === 'text-3/opaque' || k === 'placeholder/opaque'); claim('verification / TOK-6 / COLOR-4: tertiary + placeholder 5.07', 5.07, r.min, r.at); }
{ const r = minOf(k => k === 'text-3/accent-wash'); claim('COLOR-4 / body.nt: text-3 on --accent-wash ≥ 5.48', 5.48, r.min, r.at); }
{ const r = minOf(k => k === 'text-3/accent-wash' || k === 'text-2/accent-wash' || k === 'text/accent-wash'); claim('body.nt: text, text-2, text-3 on the wash ≥ 5.48', 5.48, r.min, r.at); }
{ const r = minOf(k => k === 'ink/fill'); claim('verification: hue inks on their fills 5.03', 5.03, r.min, r.at); }
{ const r = minOf(k => k.startsWith('fam:') && k.includes(':ink-hi/fill:')); claim('verification: text-hi (ink-hi) 7.01', 7.01, r.min, r.at); }
{ const r = minOf(k => k === 'field-border/opaque' || k === 'muted-decor/opaque'); claim('verification: non-text 3.03', 3.03, r.min, r.at); }
{ const r = minOf(k => k === 'graphic/opaque'); claim('verification: graphic 3.06 (warning graphic, Parchment page)', 3.06, r.min, r.at); }
{ const r = minOf(k => k === 'tile glyph'); claim('ICON-3 / COLOR-9 / §10 tile glyph ≥ 3.26', 3.26, r.min, r.at); }
{ const r = minOf(k => k === 'legacy accent as text'); claim('verification legacy 4.58', 4.58, r.min, r.at); }
{ const r = minOf(k => k === 'legacy accent as text/hi'); claim('verification legacy 7:1 7.28', 7.28, r.min, r.at); }
{ const r = minOf(k => k === 'card/page:light'); claim('verification: card ÷ page 1.11 light', 1.11, r.min, r.at); }
{ const r = minOf(k => k === 'card/page:dark'); claim('verification: card ÷ page 1.20 dark', 1.20, r.min, r.at); }
{ const r = maxOf(k => k === 'card/page:dark'); claim('COLOR-11 / §6: dark cards 1.20-1.23 (high end)', 1.23, r.max, r.at, { bound: false }); }
{ let hi = -Infinity, at = ''; for (const f of FAMILIES) { const r = adultMin(f, c => cr(F_(c, f, 'fill'), c.solid('surface')), 'dark'); if (r.min > hi) { hi = r.min; at = f; } } claim('COLOR-8 / DARK-4: dark chips 1.52-1.58 (high end = the largest per-family minimum)', 1.58, hi, at, { bound: false });
  const r = maxOf(k => k === 'dark chip/card'); note('info: dark chip vs card, highest single value', r.max, r.at); }
{ const r = minOf(k => k === 'fill C'); claim('verification: fill C ≥ 0.056', 0.056, r.min, r.at, { tol: 0.002 }); }
{ const r = minOf(k => k === 'on/strong/sem' || k === 'on/strong/person'); const x = maxOf(k => k === 'on/strong/sem' || k === 'on/strong/person'); claim('TOK-1 --X-on ×12 low 4.76', 4.76, r.min, r.at); claim('TOK-1 --X-on ×12 high 10.19', 10.19, x.max, x.at, { bound: false }); }
{ const r = minOf(k => k === 'dark accent-ink/card'); claim('DARK-3 dark --accent-ink ≥ 10.53 on cards', 10.53, r.min, r.at); }
{ const r = minOf(k => k === 'dark accent-graphic/opaque'); claim('DARK-3 dark --accent-graphic ≥ 3.28', 3.28, r.min, r.at); }
{ const r = adultAll(c => cr(c.solid('hero-btn-ink'), c.solid('hero-btn-bg'))); claim('ACCENT-4 hero button ≥ 6.58', 6.58, r.min, r.at); }
{ const r = minOf(k => k === 'label:app-icon'); claim('labelled tints: .ds .app-icon ≥ 3.86 (adult)', 3.86, r.min, r.at); }
{ const r = minOf(k => k === 'label:ficon'); claim('labelled tints: .feed .ficon 5.03 (adult)', 5.03, r.min, r.at); }
{ const r = minOf(k => k === 'label:person-chip'); claim('labelled tints: .ds .person-chip ≥ 6.20 (adult)', 6.20, r.min, r.at); }
{ const c1 = ctx('hearth', 'graphite', 'adult'); claim('§1 white on --mint-fill 1.26', 1.26, cr(P('#FFFFFF'), c1.solid('mint-fill')), 'light', { bound: false }); claim('§1 white on --butter-fill 1.14', 1.14, cr(P('#FFFFFF'), c1.solid('butter-fill')), 'light', { bound: false }); const c2 = ctx('midnight', 'graphite', 'adult'); claim('migration: white on dark --danger (#FFC6C1) 1.48', 1.48, cr(P('#FFFFFF'), c2.solid('danger')), 'dark', { bound: false }); }
{ const lo = minOf(k => k === 'separator:dark'), hi2 = maxOf(k => k === 'separator:dark'), llo = minOf(k => k === 'separator:light'), lhi = maxOf(k => k === 'separator:light');
  claim('migration --line-soft low 1.26 (Graphite page)', 1.26, lo.min, lo.at); claim('migration --line-soft high 1.44 (Forest card)', 1.44, hi2.max, hi2.at, { bound: false }); claim('migration --line-soft light low 1.31', 1.31, llo.min, llo.at); claim('migration --line-soft light high 1.37', 1.37, lhi.max, lhi.at, { bound: false }); }
{ const r = minOf(k => k === 'chevron'); claim('§2.5 chevron ≥ 3 on the field', 3, r.min, r.at, { thresholdOnly: true }); }
{ const r = minOf(k => k === 'hero-bg ink'); claim('migration .ds .hero / .ds .avatar rewrite 5.03', 5.03, r.min, r.at); }
{ const r = minOf(k => k === 'accent on/strong'); claim('migration .fab-primary rewrite 5.90', 5.90, r.min, r.at); }

// the "every text pair ≥ 7 in the 7:1 modes" statement vs the labelled tints the gate measures as text
const extraInfo = {
  semanticStrongAsText: minOf(k => k === 'semantic strong as text/opaque'),
  semanticStrongAsText7to1: minOf(k => k === 'semantic strong as text/opaque/hi'),
  glassOverWorstUnderSheen7to1: minOf(k => k === 'sheen:glass:text-2/hi/worst' || k === 'sheen:glass:text/hi/worst'),
  glassFillText3OverWorst: minOf(k => false),
  darkChipHighestSingle: minOf(k => k === 'info: dark chip vs card, highest single value'),
};
const hiLabels = { appIcon: minOf(k => k === 'label:app-icon/hi'), ficon: minOf(k => k === 'label:ficon/hi'), personChip: minOf(k => k === 'label:person-chip/hi') };

// cross-check: my cascade vs the token values contrast.mjs recorded for the engines (which WebKit and Chromium matched)
const engineCross = { samples: 0, values: 0, mismatches: [] };
try {
  const cj = JSON.parse(fs.readFileSync(path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'contrast.json'), 'utf8'));
  for (const smp of cj.engineSamples || []) {
    const env = { ...BASE_ENV }; const vals = cascade({ isRoot: true, attrs: { ...smp.attrs } }, env, null); engineCross.samples++;
    for (const [k, v] of Object.entries(smp.toks)) {
      let mine; try { mine = parseColour(vals.get(k)); } catch { continue; }
      const theirs = parseColour(v); engineCross.values++;
      const d = Math.max(...['r', 'g', 'b'].map(ch => Math.abs(mine[ch] - theirs[ch]) * 255 * (theirs.a > 0 ? 1 : 0)), Math.abs(mine.a - theirs.a) * 255);
      if (d > 0.51) engineCross.mismatches.push(`${JSON.stringify(smp.attrs)} ${k}: mine ${vals.get(k)} vs ${v}`);
    }
  }
} catch (e) { engineCross.error = String(e); }

// ───────────────────────── output ─────────────────────────
const gateList = [...gates.values()].map(g => ({ ...g, min: +g.min.toFixed(4) }));
const failing = gateList.filter(g => g.fails);
const mism = claims.filter(c => !c.ok);
const out = {
  method: 'Own cascade over proposed-tokens.css (compound selectors, specificity, order, @media, inheritance, var() + fallbacks); WCAG 2.x luminance; translucent layers composited in gamma sRGB (premultiplied); color-mix in srgb with premultiplied alpha; CVD Machado 2009 severity 1 on linear sRGB (clamped), CIEDE2000 D65; OKLCH chroma. Claims: |stated - true| <= 0.05 (chroma 0.002) and a stated minimum <= the true minimum.',
  contexts: all.length,
  gates: { kinds: gateList.length, evaluations: gateList.reduce((s, g) => s + g.n, 0), failing },
  claims: { total: claims.length, mismatched: mism },
  extraInfo, strongTone, engineCross, hexMismatches, noThemeDiffs, mediaDiffs, nestedPreviewIn7to1: nested, cvd, pickupDE, pickupCap: cap, hiLabels,
  allClaims: claims, gateMinima: gateList.map(g => ({ id: g.id, thr: g.thr, min: g.min, at: g.at, n: g.n, fails: g.fails })),
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`contexts ${all.length}; gate kinds ${gateList.length}, evaluations ${out.gates.evaluations}, failing kinds ${failing.length}`);
for (const f of failing) console.log(`GATE FAIL ${f.id}: min ${f.min} < ${f.thr} (${f.fails}/${f.n}) e.g. ${f.examples.join('; ')}`);
console.log(`claims ${claims.length}; mismatched ${mism.length}`);
for (const c of mism) console.log(`CLAIM ${c.where}: stated ${c.stated}, true ${c.true} at ${c.at} (within ±tol ${c.within}, not above ${c.notAbove})`);
console.log('hex mismatches', hexMismatches.length, hexMismatches.slice(0, 10));
console.log('no-theme / alias diffs', noThemeDiffs.length, JSON.stringify(noThemeDiffs.slice(0, 3)));
console.log('media diffs', mediaDiffs.length, mediaDiffs.slice(0, 5));
console.log('nested previews in 7:1 modes', JSON.stringify(nested));
console.log('engine cross-check', engineCross.samples, engineCross.values, engineCross.mismatches.length, engineCross.mismatches.slice(0, 5), engineCross.error || '');
console.log('extra info', JSON.stringify(extraInfo));
console.log('7:1-mode labelled tints', JSON.stringify(hiLabels));
console.log('pickup ΔE', JSON.stringify({ g: pickupDE['glass:summary'], gs: pickupDE['glass-strong:summary'] }), 'cap', JSON.stringify(cap));
process.exit(failing.length || mism.length || hexMismatches.length ? 1 : 0);
