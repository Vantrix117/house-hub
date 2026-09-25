// Phase 4 · token proposal · independent CONTRAST VERIFIER, round 5.
//   node audits/tools/phase4/tokens/verify-contrast-5.mjs [proposed-tokens.css] [out.json]
// Written from scratch for round 5: it imports nothing from contrast.mjs, colour-lib.mjs or the earlier verify-contrast-*.mjs.
// It parses proposed-tokens.css, runs its own cascade on <html> (and on one nested element for swatches), resolves var()
// (with fallbacks), color-mix(in srgb) with premultiplied alpha, rgba() and gamma-sRGB compositing, then recomputes every
// text/background and fill/ink pair TOKENS.md states, gates every pair at its threshold, and compares every stated number.
//   Contrast: WCAG 2.x relative luminance (0.04045 knee).  CVD: Machado, Oliveira & Fernandes 2009, severity 1.0, linear sRGB,
//   clamped.  Distance: CIEDE2000, D65.  Chroma: OKLCH C.
// Claim rule: |stated - true| <= 0.05 (chroma 0.002), and a stated minimum ("≥ x" or a table minimum, which TOKENS.md says is
// floored) must not exceed the true minimum.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const CSS_FILE = process.argv[2] || path.join(HERE, 'proposed-tokens.css');
const OUT = process.argv[3] || path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'verify-contrast-5.json');

// ───────────────────────── 1. CSS parsing ─────────────────────────
const raw = fs.readFileSync(CSS_FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
if (/!important/.test(raw)) throw new Error('unexpected !important');
const rules = []; let order = 0;
function parseBlock(text, media) {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const head = text.slice(i, open).trim();
    // find matching close
    let depth = 1, j = open + 1;
    while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    const body = text.slice(open + 1, j - 1);
    if (head.startsWith('@media')) parseBlock(body, head.slice(6).trim());
    else if (head) rules.push({ selectors: splitTop(head, ','), decls: parseDecls(body), media, order: order++ });
    i = j;
  }
}
function splitTop(s, sep) {
  const out = []; let depth = 0, q = null, cur = '';
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function parseDecls(body) {
  const d = [];
  for (const part of splitTop(body, ';')) {
    const k = part.indexOf(':'); if (k < 0) continue;
    d.push([part.slice(0, k).trim(), part.slice(k + 1).trim()]);
  }
  return d;
}
parseBlock(raw, null);

// selectors: compound only (no combinators in the token file)
function parseCompound(sel) {
  const parts = []; let i = 0; sel = sel.trim();
  while (i < sel.length) {
    if (sel.startsWith(':root', i)) { parts.push({ t: 'root' }); i += 5; continue; }
    if (sel[i] === '[') {
      const j = sel.indexOf(']', i);
      const m = sel.slice(i + 1, j).match(/^([\w-]+)(?:="([^"]*)")?$/);
      if (!m) throw new Error('attr ' + sel);
      parts.push({ t: 'attr', name: m[1], value: m[2] }); i = j + 1; continue;
    }
    const fm = sel.slice(i).match(/^:(not|where)\(/);
    if (fm) {
      let depth = 1, j = i + fm[0].length;
      while (depth) { if (sel[j] === '(') depth++; else if (sel[j] === ')') depth--; j++; }
      const inner = sel.slice(i + fm[0].length, j - 1);
      parts.push({ t: fm[1], list: splitTop(inner, ',').map(parseCompound) }); i = j; continue;
    }
    throw new Error(`unsupported selector "${sel}" at ${i}`);
  }
  return parts;
}
function spec(parts) {
  let b = 0;
  for (const p of parts) {
    if (p.t === 'root' || p.t === 'attr') b++;
    else if (p.t === 'not') b += Math.max(...p.list.map(spec));
  }
  return b;
}
function matches(parts, el) {
  return parts.every(p => {
    if (p.t === 'root') return el.isRoot;
    if (p.t === 'attr') return p.name in el.attrs && (p.value === undefined || el.attrs[p.name] === p.value);
    if (p.t === 'not') return !p.list.some(c => matches(c, el));
    if (p.t === 'where') return p.list.some(c => matches(c, el));
    return false;
  });
}
for (const r of rules) r.parsed = r.selectors.map(s => { const p = parseCompound(s); return { p, s: spec(p) }; });

function mediaMatches(q, env) {
  if (!q) return true;
  return q.split(/\s+and\s+/).every(c => {
    const m = c.trim().match(/^\(\s*([\w-]+)\s*:\s*([\w-]+?)(px)?\s*\)$/);
    if (!m) throw new Error('media ' + q);
    const [, f, v] = m;
    if (f === 'min-width') return env.width >= +v;
    if (f === 'pointer') return env.pointer === v;
    if (f === 'prefers-contrast') return env.contrast === v;
    if (f === 'prefers-reduced-transparency') return env.transparency === v;
    if (f === 'prefers-reduced-motion') return env.motion === v;
    throw new Error('media feature ' + f);
  });
}

// computed custom properties of one element
function compute(el, env, parent) {
  const winners = {};
  for (const r of rules) {
    if (!mediaMatches(r.media, env)) continue;
    let best = -1;
    for (const s of r.parsed) if (matches(s.p, el)) best = Math.max(best, s.s);
    if (best < 0) continue;
    for (const [k, v] of r.decls) {
      const w = winners[k];
      if (!w || best > w.s || (best === w.s && r.order >= w.o)) winners[k] = { v, s: best, o: r.order };
    }
  }
  const out = Object.create(null);
  const inherited = parent || {};
  const resolving = new Set();
  function sub(val) {
    let s = val, guard = 0;
    while (s.includes('var(') && guard++ < 500) {
      const i = s.lastIndexOf('var(');
      let depth = 1, j = i + 4;
      while (depth && j < s.length) { if (s[j] === '(') depth++; else if (s[j] === ')') depth--; j++; }
      const inner = s.slice(i + 4, j - 1);
      const c = inner.indexOf(',');
      const name = (c < 0 ? inner : inner.slice(0, c)).trim();
      const fb = c < 0 ? undefined : inner.slice(c + 1).trim();
      let rep = get(name);
      if (rep === undefined) { if (fb === undefined) return undefined; rep = fb; }
      s = s.slice(0, i) + rep + s.slice(j);
    }
    return s;
  }
  function get(name) {
    if (name in out) return out[name];
    if (winners[name]) {
      if (resolving.has(name)) return undefined;
      resolving.add(name);
      const v = sub(winners[name].v);
      resolving.delete(name);
      out[name] = v; return v;
    }
    return inherited[name];
  }
  for (const k of Object.keys(winners)) get(k);
  for (const k of Object.keys(inherited)) if (!(k in out)) out[k] = inherited[k];
  return out;
}

// ───────────────────────── 2. colour ─────────────────────────
function parseColour(str) {
  str = str.trim();
  if (str === 'transparent') return [0, 0, 0, 0];
  let m;
  if ((m = str.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i))) {   // 8 digits only appear in the engine samples
    let h = m[1]; if (h.length === 3) h = [...h].map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  if ((m = str.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/))) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  if (str.startsWith('color-mix(')) {
    const inner = str.slice(10, -1);
    const parts = splitTop(inner, ',');
    if (parts[0].trim() !== 'in srgb') throw new Error('mix space ' + parts[0]);
    const arg = s => { const mm = s.trim().match(/^(.*?)(?:\s+([\d.]+)%)?$/s); return [parseColour(mm[1]), mm[2] === undefined ? null : +mm[2]]; };
    let [c1, p1] = arg(parts[1]); let [c2, p2] = arg(parts[2]);
    if (p1 === null && p2 === null) { p1 = 50; p2 = 50; } else if (p1 === null) p1 = 100 - p2; else if (p2 === null) p2 = 100 - p1;
    const sum = p1 + p2; if (sum === 0) throw new Error('mix 0');
    const alphaMul = sum < 100 ? sum / 100 : 1;
    const w1 = p1 / sum, w2 = p2 / sum;
    const a = c1[3] * w1 + c2[3] * w2;
    const ch = k => a === 0 ? 0 : (c1[k] * c1[3] * w1 + c2[k] * c2[3] * w2) / a;
    return [ch(0), ch(1), ch(2), a * alphaMul];
  }
  throw new Error('colour? ' + str);
}
const over = (fg, bg) => { const a = fg[3]; return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]; };
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
function cr(a, b) { if (a[3] < 1 - 1e-9 || b[3] < 1 - 1e-9) throw new Error('contrast of translucent ' + a + ' / ' + b); const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
// OKLCH chroma
function oklchC(c) {
  const [r, g, b] = c.slice(0, 3).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return Math.hypot(A, B);
}
// CVD
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
function linRGB(c) { return c.slice(0, 3).map(lin); }
function simulate(c, kind) {
  const L = linRGB(c); if (kind === 'normal') return L;
  const M = MACHADO[kind];
  return M.map(row => Math.min(1, Math.max(0, row[0] * L[0] + row[1] * L[1] + row[2] * L[2])));
}
function labFromLinear([r, g, b]) {
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / 1.0;
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function de2000(l1, l2) {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2;
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (b, a) => { if (a === 0 && b === 0) return 0; let h = Math.atan2(b, a) * deg; return h < 0 ? h + 360 : h; };
  const h1p = hp(b1, a1p), h2p = hp(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2 * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hbp = (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2; else hbp = (h1p + h2p) / 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + 0.015 * (Lbp - 50) ** 2 / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
const deCvd = (c1, c2, kind) => de2000(labFromLinear(simulate(c1, kind)), labFromLinear(simulate(c2, kind)));

// ───────────────────────── 3. contexts ─────────────────────────
const THEMES = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
const LIGHT = ['hearth', 'parchment', 'frost'], DARK = ['midnight', 'forest', 'graphite'];
const PEOPLE = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite'];
const HUES8 = PEOPLE.slice(0, 8);
const SEM = ['success', 'warning', 'danger'];
const FAMS = [...PEOPLE, ...SEM];
const MODES = {
  adult: { attrs: { 'data-kind': 'adult' }, env: {} },
  kid: { attrs: { 'data-kind': 'kid' }, env: {} },
  kiosk: { attrs: { 'data-kind': 'kiosk' }, env: {} },
  more: { attrs: { 'data-kind': 'adult', 'data-contrast': 'more' }, env: {} },
  'more-media': { attrs: { 'data-kind': 'adult' }, env: { contrast: 'more' } },
  'kiosk+more-media': { attrs: { 'data-kind': 'kiosk' }, env: { contrast: 'more' } },
  rt: { attrs: { 'data-kind': 'adult', 'data-transparency': 'reduce' }, env: {} },
  'rt-media': { attrs: { 'data-kind': 'adult' }, env: { transparency: 'reduce' } },
  'kiosk+rt': { attrs: { 'data-kind': 'kiosk', 'data-transparency': 'reduce' }, env: {} },
  'more+rt': { attrs: { 'data-kind': 'adult', 'data-contrast': 'more', 'data-transparency': 'reduce' }, env: {} },
};
const HI_MODES = new Set(['kiosk', 'more', 'more-media', 'kiosk+more-media', 'kiosk+rt', 'more+rt']);
const baseEnv = { width: 1024, pointer: 'fine', contrast: 'no-preference', transparency: 'no-preference', motion: 'no-preference' };
const ctxs = [];
function makeCtx(theme, person, mode, extra = {}) {
  const m = MODES[mode];
  const attrs = { ...(theme ? { 'data-theme': theme } : {}), 'data-scheme': extra.scheme || THEMES[theme], 'data-accent': person, ...m.attrs };
  const env = { ...baseEnv, ...m.env, ...(extra.env || {}) };
  const v = compute({ isRoot: true, attrs }, env, null);
  const C = name => { const s = v[name]; if (s === undefined) throw new Error(`${name} undefined in ${theme}/${person}/${mode}`); return parseColour(s); };
  return { theme, person, mode, scheme: attrs['data-scheme'], v, C, hi: HI_MODES.has(mode), id: `${theme || 'no-theme'}/${person}/${mode}` };
}
for (const t of Object.keys(THEMES)) for (const p of PEOPLE) for (const m of Object.keys(MODES)) ctxs.push(makeCtx(t, p, m));

// ───────────────────────── 4. gates and measurements ─────────────────────────
const gates = {}; // id -> {threshold, min, at, n, fails:[]}
function gate(id, thr, val, at) {
  const g = gates[id] || (gates[id] = { threshold: thr, min: Infinity, at: null, n: 0, fails: [] });
  g.n++;
  if (val < g.min) { g.min = val; g.at = at; }
  if (val < thr - 1e-9) g.fails.push({ at, val: +val.toFixed(4) });
}
const meas = {}; // id -> {min, at, max, maxAt, n}
function m(id, val, at) {
  const e = meas[id] || (meas[id] = { min: Infinity, at: null, max: -Infinity, maxAt: null, n: 0 });
  e.n++;
  if (val < e.min) { e.min = val; e.at = at; }
  if (val > e.max) { e.max = val; e.maxAt = at; }
  return val;
}
const OPAQUE = { page: '--bg', card: '--surface', well: '--surface-2', sheet: '--surface-raised', field: '--fill-field', hover: '--hover' };
const WHITE = [255, 255, 255, 1], BLACK = [0, 0, 0, 1], MID = [118, 118, 118, 1];

for (const c of ctxs) {
  const at = c.id, S = {};
  for (const [k, tok] of Object.entries(OPAQUE)) { S[k] = c.C(tok); if (S[k][3] !== 1) throw new Error('not opaque ' + tok + ' ' + at); }
  const sch = c.scheme, adult = c.mode === 'adult', hi = c.hi;
  const T = hi ? 7 : 4.5, tag = hi ? '7:1' : 'aa';
  const worst = sch === 'light' ? BLACK : WHITE;
  // neutral text
  for (const [k, s] of Object.entries(S)) {
    gate(`text-primary/${k}`, 7, m(`text/${sch}/${c.mode}/${c.theme}`, cr(c.C('--text'), s), at), at);
    m(`text-all/${c.mode}`, cr(c.C('--text'), s), at);
    const t2 = cr(c.C('--text-2'), s), t3 = cr(c.C('--text-3'), s);
    gate(`text-2/${tag}/${k}`, hi ? 7 : (['page', 'card', 'sheet'].includes(k) ? 6 : 4.5), t2, at);
    gate(`text-3/${tag}/${k}`, T, t3, at);
    m(`text2/${c.mode}/${c.theme}`, t2, at + '/' + k); m(`text3/${c.mode}/${c.theme}`, t3, at + '/' + k);
    m(`text2-all/${hi ? 'hi' : c.mode}`, t2, at + '/' + k); m(`text3-all/${hi ? 'hi' : c.mode}`, t3, at + '/' + k);
    if (['page', 'card', 'sheet'].includes(k)) m(`text2-pcs/${c.mode}`, t2, at + '/' + k);
    if (k === 'well') m(`text2-well/${c.mode}`, t2, at);
    m(`placeholder/${c.mode}`, cr(c.C('--placeholder'), s), at + '/' + k);
    // non-text greys
    const fb = cr(c.C('--field-border'), s);
    gate(`nontext/field-border/${k}`, 3, fb, at); m(`field-border/${c.mode}/${c.theme}`, fb, at + '/' + k); m(`field-border-all/${c.mode}`, fb, at + '/' + k);
    gate(`nontext/muted-decor/${k}`, 3, m(`muted-decor/${c.mode}`, cr(c.C('--muted-decor'), s), at + '/' + k), at);
    gate(`nontext/cell-empty/${k}`, 3, cr(c.C('--cell-empty'), s), at);
    gate(`nontext/switch-off-ring/${k}`, 3, m(`switch-off-ring/${c.mode}`, cr(c.C('--switch-off-ring'), s), at + '/' + k), at);
    const sw = cr(c.C('--switch-on'), s);
    gate(`nontext/switch-on/${k}`, 3, sw, at); m(`switch-on/${c.mode}`, sw, at + '/' + k); m(`switch-on/${sch}/${c.mode}`, sw, at + '/' + k);
    if (k === 'card') m(`switch-on-card/${c.mode}`, sw, at);
    m(`switch-on/${c.theme}/${k}/${c.mode}`, sw, at);
    gate(`nontext/focus/${k}`, 3, m(`focus/${c.mode}`, cr(c.C('--focus-ring-color'), s), at + '/' + k), at);
    gate(`nontext/today/${k}`, 3, m(`today/${c.mode}`, cr(c.C('--today-ring'), s), at + '/' + k), at);
    gate(`nontext/star-stroke/${k}`, 3, m(`star-stroke/${c.mode}`, cr(c.C('--star-stroke'), s), at + '/' + k), at);
    gate(`nontext/chevron/${k}`, 3, cr(c.C('--chevron-colour'), s), at);
    for (const st of ['offline', 'pending', 'synced', 'error']) gate(`nontext/status-${st}/${k}`, 3, cr(c.C('--status-' + st), s), at);
    for (let i = 1; i <= 8; i++) gate(`graphic/cat-${i}/${k}`, 3, cr(c.C('--cat-' + i), s), at);
    for (const f of ['fresh', 'aging', 'use-soon', 'map-attr', 'map-shop', 'map-dine', 'map-water', 'map-north']) gate(`graphic/${f}/${k}`, 3, cr(c.C('--' + f), s), at);
    // legacy aliases as text
    for (const a of ['--muted', '--gold', '--olive', '--teal', '--terra', '--slate', '--mocha', '--ok', '--warn', '--danger', '--accent', '--tint', '--accent-strong', '--accent-deep', '--info-ink', '--gold-ink', '--ok-ink', '--warn-ink']) gate(`legacy/${a}/${tag}/${k}`, T, cr(c.C(a), s), at);
    const acc = cr(c.C('--accent'), s);
    m(`accent-text/${hi ? 'hi' : c.mode}`, acc, at + '/' + k); m(`accent-text/${sch}/${hi ? 'hi' : c.mode}`, acc, at + '/' + k);
    if (k === 'page') m(`accent-text-page/${c.person}/${c.mode}`, acc, at);
    // badge vs surfaces
    const bdg = cr(c.C('--badge-bg'), s);
    if (['page', 'card', 'sheet'].includes(k)) { gate(`nontext/badge/${k}`, 3, bdg, at); m(`badge-vs-${k}/${hi ? 'hi' : c.mode}`, bdg, at); m(`badge-vs-pcs/${hi ? 'hi' : c.mode}`, bdg, at + '/' + k); }
    // accent roles on surfaces
    m(`accent-ink/${k}/${c.person}/${c.mode}`, cr(c.C('--accent-ink'), s), at);
    m(`accent-graphic/${k}/${c.person}/${c.mode}`, cr(c.C('--accent-graphic'), s), at);
    m(`accent-graphic-any/${sch}/${c.person}/${c.mode}`, cr(c.C('--accent-graphic'), s), at + '/' + k);
    if (k === 'card' && sch === 'dark') m(`dark-accent-ink-card/${c.mode}`, cr(c.C('--accent-ink'), s), at);
    if (sch === 'dark') m(`dark-accent-graphic/${c.mode}`, cr(c.C('--accent-graphic'), s), at + '/' + k);
  }
  // hue families (identical for every person in a context; measure them in person graphite only to avoid 9x repeats)
  if (c.person === 'graphite' || true) {
    for (const f of FAMS) {
      const F = x => c.C(`--${f}-${x}`);
      const ink = F('ink'), fill = F('fill'), wash = F('wash'), fs_ = F('fill-strong'), strong = F('strong'), on = F('on'), graphic = F('graphic'), inkhi = F('ink-hi');
      const sem = SEM.includes(f);
      const k0 = `${f}/${sch}/${c.mode}`;
      gate(`ink/${tag}/fill`, T, m(`ink-fill/${k0}`, cr(ink, fill), at), at);
      gate(`ink/${tag}/wash`, T, m(`ink-wash/${k0}`, cr(ink, wash), at), at);
      for (const [k, s] of Object.entries(S)) { gate(`ink/${tag}/${k}`, T, m(`ink-surf/${k0}`, cr(ink, s), at + '/' + k), at); m(`ink-any/${hi ? 'hi' : c.mode}`, cr(ink, s), at + '/' + f + '/' + k); }
      m(`ink-any/${hi ? 'hi' : c.mode}`, cr(ink, fill), at + '/' + f + '/fill'); m(`ink-any/${hi ? 'hi' : c.mode}`, cr(ink, wash), at + '/' + f + '/wash');
      m(`ink-own-fill/${hi ? 'hi' : c.mode}`, cr(ink, fill), at + '/' + f);
      m(`inkhi-fill/${k0}`, cr(inkhi, fill), at);
      gate('text-hi/ink-hi-fill', 7, cr(inkhi, fill), at + '/' + f);
      for (const [k, s] of Object.entries(S)) gate('text-hi/ink-hi-surface', 7, cr(inkhi, s), at + '/' + f + '/' + k);
      gate('graphic/tile-glyph', 3, m(`ink-fillstrong/${k0}`, cr(ink, fs_), at), at + '/' + f);
      gate(sem ? `semantic-on/${f}` : `on-strong/${tag}`, sem ? 4.5 : T, m(`on-strong/${k0}`, cr(on, strong), at), at + '/' + f);
      m(`on-strong-all/${sem ? 'sem' : 'person'}/${hi ? 'hi' : c.mode}`, cr(on, strong), at + '/' + f);
      m(`on-strong-range/${c.mode}`, cr(on, strong), at + '/' + f);
      for (const [k, s] of Object.entries(S)) {
        const st = cr(strong, s), gr = cr(graphic, s);
        m(`strong-surf/${k0}`, st, at + '/' + k);
        if (!sem) gate(`strong-as-text/${tag}/${k}`, T, st, at + '/' + f); else { gate(`graphic/semantic-strong/${k}`, 3, st, at + '/' + f); m(`sem-strong-text/${f}/${c.theme}/${k}/${c.mode}`, st, at); m(`sem-strong-graphic/${c.mode}`, st, at + '/' + f + '/' + k); }
        gate(`graphic/${sem ? 'semantic' : 'person'}-graphic/${k}`, 3, m(`graphic-surf/${k0}`, gr, at + '/' + k), at + '/' + f);
        m(`graphic-all/${c.mode}`, gr, at + '/' + f + '/' + k);
      }
      m(`chroma/${f}/${sch}`, oklchC(fill), at);
      if (sch === 'dark') {
        const fc = cr(fill, S.card);
        if (f !== 'success' || true) m(`chip-card/${f}/${c.mode}`, fc, at);
        if (['adult'].includes(c.mode)) gate('depth/dark-chip-card', 1.5, fc, at + '/' + f);
      }
    }
    // wait bands
    for (const w of ['short', 'medium', 'long', 'closed']) gate(`text/wait-${w}`, T, cr(c.C(`--wait-${w}-ink`), c.C(`--wait-${w}`)), at);
    // semantic luminance ratio (strong tones)
    const ss = c.C('--success-strong'), ws = c.C('--warning-strong'), ds = c.C('--danger-strong');
    gate('semantic/lum-success-danger', 1.3, m(`semlum/${c.mode}`, cr(ss, ds), at + '/s-d'), at);
    gate('semantic/lum-warning-danger', 1.3, m(`semlum/${c.mode}`, cr(ws, ds), at + '/w-d'), at);
    // depth
    const cp = cr(S.card, S.page);
    m(`card-page/${c.theme}`, cp, at); m(`card-page/${sch}/${c.mode}`, cp, at);
    if (sch === 'dark') gate('depth/dark-card-page', 1.2, cp, at);
  }
  // accent-derived pairs
  const ai = c.C('--accent-ink'), af = c.C('--accent-fill'), as = c.C('--accent-strong'), ao = c.C('--accent-on'), ag = c.C('--accent-graphic');
  gate(`accent/on-strong/${tag}`, T, m(`acc-on-strong/${c.person}/${c.mode}`, cr(ao, as), at), at);
  m(`acc-on-strong-all/${hi ? 'hi' : c.mode}`, cr(ao, as), at); m(`acc-on-strong-all/${sch}/${hi ? 'hi' : c.mode}`, cr(ao, as), at);
  gate(`accent/sel-ink-strong/${tag}`, T, m(`sel-ink-strong/${hi ? 'hi' : c.mode}`, cr(c.C('--sel-ink-strong'), c.C('--sel-fill-strong')), at), at);
  m(`sel-ink-strong/${sch}/${hi ? 'hi' : c.mode}`, cr(c.C('--sel-ink-strong'), c.C('--sel-fill-strong')), at);
  gate(`accent/sel-ink/${tag}`, T, m(`sel-ink/${hi ? 'hi' : c.mode}`, cr(c.C('--sel-ink'), c.C('--sel-fill')), at), at);
  const hb = c.C('--hero-btn-bg'); if (hb[3] !== 1) throw new Error('hero bg translucent');
  const hr = cr(c.C('--hero-btn-ink'), hb);
  gate(`accent/hero-btn/${tag}`, T, hr, at);
  m(`hero/${c.person}/${c.mode}`, hr, at); m(`hero-all/${sch}/${hi ? 'hi' : c.mode}`, hr, at); m(`hero-all/${hi ? 'hi' : c.mode}`, hr, at);
  gate('nontext/progress', 3, m(`progress/${c.mode}`, cr(c.C('--progress-fill'), c.C('--progress-track')), at), at);
  m(`acc-ink-fill/${c.person}/${c.mode}`, cr(ai, af), at);
  // text on accent-wash (F260 body.nt, COLOR-4)
  for (const t of ['--text', '--text-2', '--text-3']) gate(`text/on-accent-wash/${tag}`, T, m(`on-wash/${t}/${c.mode}`, cr(c.C(t), c.C('--accent-wash')), at), at);
  m(`text3-on-wash/${c.mode}`, cr(c.C('--text-3'), c.C('--accent-wash')), at);
  // badge label
  gate(`badge/label/${tag}`, T, m(`badge-label/${hi ? 'hi' : c.mode}`, cr(c.C('--badge-ink'), c.C('--badge-bg')), at), at);
  // toast, inverse glass, over backdrops
  const backs = { page: S.page, card: S.card, sheet: S.sheet, white: WHITE, black: BLACK, mid: MID };
  for (const [bk, b] of Object.entries(backs)) {
    const tb = over(c.C('--toast-bg'), b);
    gate(`toast/ink/${tag}`, T, m(`toast-ink/${hi ? 'hi' : c.mode}`, cr(c.C('--toast-ink'), tb), at + '/' + bk), at);
    gate(`toast/ink-2/${tag}`, T, m(`toast-ink2/${hi ? 'hi' : c.mode}`, cr(over(c.C('--toast-ink-2'), tb), tb), at + '/' + bk), at);
    const ib = over(c.C('--glass-inverse'), b);
    gate(`inverse/${tag}`, T, m(`inverse/${hi ? 'hi' : c.mode}`, cr(c.C('--glass-inverse-ink'), ib), at + '/' + bk), at);
  }
  // TV panel (kiosk only)
  if (c.mode.startsWith('kiosk')) {
    const photos = { white: WHITE, black: BLACK, mid: MID };
    for (const f of HUES8.concat(['graphite'], SEM)) for (const r of ['fill', 'fill-strong', 'wash', 'strong', 'graphic']) photos[`${f}-${r}`] = c.C(`--${f}-${r}`);
    for (const [pk, ph] of Object.entries(photos)) {
      const pnl = over(c.C('--tv-panel'), ph);
      gate('tv/text', 7, m('tv-text', cr(c.C('--tv-text'), pnl), at + '/' + pk), at);
      gate('tv/text-2', 7, m('tv-text2', cr(c.C('--tv-text-2'), pnl), at + '/' + pk), at);
    }
  }
  // glass
  const spec = c.C('--glass-spec');
  const pk = parseFloat(c.v['--glass-pickup']);
  const pick = [...c.C('--accent-fill-strong').slice(0, 3), c.C('--accent-fill-strong')[3] * pk / 100];
  const pickupLayer = parseColour(`color-mix(in srgb, ${c.v['--accent-fill-strong']} ${c.v['--glass-pickup']}, transparent)`);
  if (Math.abs(pickupLayer[3] - pick[3]) > 1e-9) throw new Error('pickup alpha');
  const glassKinds = { strong: c.C('--glass-strong'), glass: c.C('--glass') };
  const gBacks = { page: S.page, card: S.card, mid: MID, worst };
  for (const [gk, g] of Object.entries(glassKinds)) for (const [bk, b] of Object.entries(gBacks)) {
    const fillOnly = over(g, b);
    const sheen = over(spec, fillOnly);
    const pickup = over(pickupLayer, fillOnly);
    const sheenPick = over(spec, pickup);
    const layers = { fill: fillOnly, sheen, pickup, 'sheen+pickup': sheenPick };
    const gated = gk === 'strong' || bk !== 'worst';
    for (const [lk, surf] of Object.entries(layers)) {
      const p = cr(c.C('--text'), surf), s2 = cr(c.C('--text-2'), surf), s3 = cr(c.C('--text-3'), surf);
      const key = `${gk}/${lk}/${bk}`;
      m(`glass-text/${key}/${hi ? 'hi' : c.mode}`, p, at); m(`glass-text2/${key}/${hi ? 'hi' : c.mode}`, s2, at);
      m(`glass-text2/${gk}/${lk}/${bk}/${c.theme}/${c.mode}`, s2, at);
      if (gated && lk !== 'pickup') {
        gate(`glass/primary/${tag}/${gk}/${lk}`, 7, p, at + '/' + bk);
        gate(`glass/secondary/${tag}/${gk}/${lk}`, T, s2, at + '/' + bk);
      }
      // aggregated by backdrop class
      const bcls = bk === 'worst' ? 'worst' : 'pcm';
      m(`gtext/${gk}/${lk}/${bcls}/${hi ? 'hi' : c.mode}`, p, at + '/' + bk); m(`gtext2/${gk}/${lk}/${bcls}/${hi ? 'hi' : c.mode}`, s2, at + '/' + bk);
      m(`gtext/${gk}/${lk}/all/${hi ? 'hi' : c.mode}`, p, at + '/' + bk); m(`gtext2/${gk}/${lk}/all/${hi ? 'hi' : c.mode}`, s2, at + '/' + bk);
      m(`gtext3/${gk}/${lk}/${bcls}/${c.mode}`, s3, at + '/' + bk);
      // tabs and marks
      const ink = cr(c.C('--accent-ink'), surf), gr = cr(c.C('--accent-graphic'), surf);
      m(`tab-ink/${gk}/${lk}/${bk}/${c.mode}`, ink, at); m(`tab-ink/${gk}/${lk}/${bk}/any`, ink, at + ' ' + c.mode);
      m(`mark/${gk}/${lk}/${bk}/${c.mode}`, gr, at); m(`mark/${gk}/${lk}/${bk}/any`, gr, at + ' ' + c.mode);
      m(`tab-text3/${gk}/${lk}/${bk}/any`, s3, at + ' ' + c.mode);
      if (gk === 'strong' && lk === 'sheen' && bk !== 'worst') {
        gate(`tabs/selected-under-sheen/${tag}`, T, ink, at + '/' + bk);
        gate(`tabs/unselected-under-sheen/${tag}`, T, s3, at + '/' + bk);
        m(`tab-sel-sheen/${hi ? 'hi' : c.mode}`, ink, at + '/' + bk); m(`tab-unsel-sheen/${hi ? 'hi' : c.mode}`, s3, at + '/' + bk);
        m(`tab-sel-sheen-all`, ink, at + '/' + bk); m(`tab-unsel-sheen-all`, s3, at + '/' + bk);
      }
      if (lk === 'fill' && bk === 'mid') {
        m(`tab-label-mid/${gk}/${c.person}/${c.mode}`, ink, at);
        if (gk === 'strong') { gate(`tabs/label-mid/${tag}`, T, ink, at); gate('nontext/mark-on-bar', 3, gr, at); m(`mark-bar/${c.mode}`, gr, at); }
        for (const st of ['offline', 'pending', 'synced', 'error']) { const v = cr(c.C('--status-' + st), surf); m(`status/${gk}/${c.mode}`, v, at + '/' + st); m(`status/${gk}/all`, v, at + '/' + st + ' ' + c.mode); if (gk === 'strong') gate('nontext/status-on-bar', 3, v, at + '/' + st); }
      }
      if (lk === 'fill' && bk !== 'worst') for (const st of ['offline', 'pending', 'synced', 'error']) m(`status-bar-all/${gk}`, cr(c.C('--status-' + st), surf), at + '/' + st + '/' + bk);
      if (lk === 'fill' && bk !== 'worst') { const nv = cr(c.C('--map-north'), surf); m(`map-north-glass/${gk}`, nv, at + '/' + bk); gate('nontext/map-north-on-glass', 3, nv, at + '/' + bk + '/' + gk); }
      if (lk === 'fill' && bk !== 'worst') m(`mark-bar-any/${gk}`, gr, at + '/' + bk);
    }
  }
  // legacy labelled backgrounds, as written (apps/design.css:501, :607; index.html:210) with the proposed tokens
  const tint = c.v['--tint'], sfc = c.v['--surface'], txt = c.v['--text'];
  const chipBg = parseColour(`color-mix(in srgb, ${tint} 14%, ${sfc})`), chipTx = parseColour(`color-mix(in srgb, ${tint} 70%, ${txt})`);
  gate(`legacy-label/person-chip`, 4.5, m(`lbl-person-chip/${c.mode}`, cr(chipTx, chipBg), at), at);
  for (const pct of [22, 8]) gate('legacy-label/app-icon', 3, m(`lbl-app-icon/${c.mode}`, cr(parseColour(tint), parseColour(`color-mix(in srgb, ${tint} ${pct}%, ${sfc})`)), at + '/' + pct), at);
  gate('legacy-label/ficon', 3, m(`lbl-ficon/${c.mode}`, cr(parseColour(c.v['--tint-ink']), chipBg), at), at);
  // --line-soft decorative
  for (const k of ['page', 'card']) { const ls = over(c.C('--line-soft'), S[k]); m(`line-soft/${sch}/${c.mode}`, cr(ls, S[k]), at + '/' + k); m(`line-soft/${c.theme}/${k}/${c.mode}`, cr(ls, S[k]), at); }
  // switch knob
  gate('nontext/switch-knob', 3, m(`knob/${sch}/${c.mode}`, cr(c.C('--switch-knob'), c.C('--switch-on')), at), at);
  // map halo / ink and chevron on field already covered
}

// ── CVD separation of the identity tones and the fills; semantic distances ──
const cvd = {};
for (const sch of ['light', 'dark']) {
  const cx = ctxs.find(c => c.scheme === sch && c.mode === 'adult' && c.person === 'graphite');
  for (const role of ['graphic', 'fill']) for (const kind of ['normal', 'protan', 'deutan', 'tritan']) {
    let min = Infinity, pair = null;
    for (let i = 0; i < PEOPLE.length; i++) for (let j = i + 1; j < PEOPLE.length; j++) {
      if (role === 'fill' && (PEOPLE[i] === 'graphite' || PEOPLE[j] === 'graphite')) continue;
      const d = deCvd(cx.C(`--${PEOPLE[i]}-${role}`), cx.C(`--${PEOPLE[j]}-${role}`), kind);
      if (d < min) { min = d; pair = `${PEOPLE[i]}/${PEOPLE[j]}`; }
    }
    cvd[`${role}/${sch}/${kind}`] = { min, pair };
    if (role === 'graphic' && kind !== 'tritan') gate(`cvd/${kind}`, 10, min, `${sch} ${pair}`);
  }
  // fills incl. graphite
  for (const kind of ['normal', 'protan', 'deutan']) {
    let min = Infinity, pair = null;
    for (let i = 0; i < PEOPLE.length; i++) for (let j = i + 1; j < PEOPLE.length; j++) {
      const d = deCvd(cx.C(`--${PEOPLE[i]}-fill`), cx.C(`--${PEOPLE[j]}-fill`), kind);
      if (d < min) { min = d; pair = `${PEOPLE[i]}/${PEOPLE[j]}`; }
    }
    cvd[`fill9/${sch}/${kind}`] = { min, pair };
  }
  // semantic vs person graphics
  let min = Infinity, pair = null;
  for (const s of SEM) for (const p of PEOPLE) { const d = deCvd(cx.C(`--${s}-graphic`), cx.C(`--${p}-graphic`), 'normal'); if (d < min) { min = d; pair = `${s}/${p}`; } }
  cvd[`sem-vs-person/${sch}`] = { min, pair }; gate('semantic/vs-person-de', 10, min, `${sch} ${pair}`);
  for (const kind of ['protan', 'deutan', 'tritan']) {
    cvd[`sem/${sch}/${kind}/success-warning`] = deCvd(cx.C('--success-graphic'), cx.C('--warning-graphic'), kind);
    cvd[`sem/${sch}/${kind}/success-danger`] = deCvd(cx.C('--success-graphic'), cx.C('--danger-graphic'), kind);
    cvd[`sem/${sch}/${kind}/warning-danger`] = deCvd(cx.C('--warning-graphic'), cx.C('--danger-graphic'), kind);
  }
  // pickup ΔE from the bare pane (full pickup vs pane) on the white/dark cards, fill-strong tone and strong tone
  for (const tone of ['fill-strong', 'strong']) {
    let lo = Infinity, hiv = -Infinity;
    for (const theme of sch === 'light' ? ['hearth', 'frost'] : ['midnight', 'graphite']) for (const p of HUES8) {
      const c = ctxs.find(x => x.theme === theme && x.person === p && x.mode === 'adult');
      const pane = over(c.C('--glass-strong'), c.C('--surface'));
      const layer = parseColour(`color-mix(in srgb, ${c.v['--accent-' + tone]} ${c.v['--glass-pickup']}, transparent)`);
      const d = de2000(labFromLinear(linRGB(over(layer, pane))), labFromLinear(linRGB(pane)));
      lo = Math.min(lo, d); hiv = Math.max(hiv, d);
    }
    cvd[`pickupDE/${sch}/${tone}`] = { min: lo, max: hiv };
  }
}

// ── Theme swatch (nested [data-theme-preview=hearth] under Increase Contrast, adult values expected) ──
const swatch = {};
{
  const rootAttrs = { 'data-theme': 'hearth', 'data-scheme': 'light', 'data-accent': 'periwinkle', 'data-kind': 'adult', 'data-contrast': 'more' };
  const rootV = compute({ isRoot: true, attrs: rootAttrs }, baseEnv, null);
  const childV = compute({ isRoot: false, attrs: { 'data-theme-preview': 'hearth', 'data-scheme': 'light', 'data-accent': 'mint' } }, baseEnv, rootV);
  const C = n => parseColour(childV[n]);
  swatch.text3OnSurface = cr(C('--text-3'), C('--surface'));
  swatch.mintInkOnFill = cr(C('--mint-ink'), C('--mint-fill'));
  swatch.rootText3 = cr(parseColour(rootV['--text-3']), parseColour(rootV['--surface']));
  // the System card's night half inside a Hearth swatch, with and without data-accent
  const cardV = childV;
  const halfNo = compute({ isRoot: false, attrs: { 'data-theme-preview': 'midnight', 'data-scheme': 'dark' } }, baseEnv, cardV);
  const halfYes = compute({ isRoot: false, attrs: { 'data-theme-preview': 'midnight', 'data-scheme': 'dark', 'data-accent': 'mint' } }, baseEnv, cardV);
  swatch.halfNoAccentFill = halfNo['--accent-fill']; swatch.halfNoAccentSurface = halfNo['--surface'];
  swatch.halfWithAccentFill = halfYes['--accent-fill'];
}
// no-theme dark root equals Midnight (colours only, every mode)
const noTheme = [];
for (const mode of Object.keys(MODES)) {
  const a = makeCtx(null, 'periwinkle', mode, { scheme: 'dark' }), b = makeCtx('midnight', 'periwinkle', mode);
  const diffs = Object.keys(b.v).filter(k => a.v[k] !== b.v[k]);
  noTheme.push({ mode, diffs: diffs.length, sample: diffs.slice(0, 5) });
}

// ───────────────────────── 5. claims ─────────────────────────
const claims = [];
const G = id => { const e = meas[id]; if (!e) throw new Error('no measurement ' + id); return e; };
function minOf(ids) { let best = { min: Infinity, at: null }; for (const id of ids) { const e = meas[id]; if (!e) throw new Error('no measurement ' + id); if (e.min < best.min) best = { min: e.min, at: e.at }; } return best; }
function maxOf(ids) { let best = { max: -Infinity, at: null }; for (const id of ids) { const e = meas[id]; if (!e) throw new Error('no measurement ' + id); if (e.max > best.max) best = { max: e.max, at: e.maxAt }; } return best; }
function claim(where, stated, trueVal, at, opt = {}) {
  const tol = opt.tol ?? 0.05;
  const within = Math.abs(stated - trueVal) <= tol + 1e-9;
  const isMin = opt.kind !== 'exact' && opt.kind !== 'max';
  // stated minimum must not exceed the true minimum: allow only float noise at the shown precision
  const notAbove = !isMin || stated <= trueVal + 1e-9;
  const notBelowMax = true;   // a range's upper end is floored like every other figure: tolerance only
  claims.push({ where, stated, true: +trueVal.toFixed(4), at, ok: within && notAbove && notBelowMax, within, notAbove: notAbove && notBelowMax, kind: opt.kind || 'min' });
}
const AD = 'adult';
const lightPal = ['hearth', 'parchment', 'frost'];
// §2.1 light table
const L21 = {
  bubblegum: [5.26, 6.97, 5.90, 7.05, 3.77, 5.92, 4.60, 3.60, 0.067],
  peach: [5.03, 6.23, 5.28, 7.01, 3.36, 5.93, 4.61, 4.93, 0.060],
  butter: [5.76, 6.06, 5.11, 8.24, 3.26, 5.92, 4.60, 3.14, 0.092],
  mint: [5.23, 6.12, 5.12, 7.44, 3.26, 5.93, 4.61, 4.85, 0.074],
  aqua: [5.41, 6.42, 5.37, 7.34, 3.41, 6.08, 4.72, 3.83, 0.057],
  sky: [5.67, 7.34, 6.17, 7.06, 3.94, 5.93, 4.61, 4.13, 0.056],
  periwinkle: [5.86, 7.90, 6.67, 7.02, 4.25, 5.94, 4.62, 3.13, 0.061],
  lavender: [5.85, 7.91, 6.71, 7.04, 4.27, 5.90, 4.58, 7.30, 0.072],
  graphite: [7.09, 8.26, 7.05, 10.87, 4.47, 5.92, 4.60, 7.44, null],
};
for (const [f, v] of Object.entries(L21)) {
  const k = `${f}/light/${AD}`;
  claim(`§2.1 light ${f} ink/fill`, v[0], G(`ink-fill/${k}`).min, G(`ink-fill/${k}`).at);
  claim(`§2.1 light ${f} ink/wash`, v[1], G(`ink-wash/${k}`).min, G(`ink-wash/${k}`).at);
  claim(`§2.1 light ${f} ink/all surfaces`, v[2], G(`ink-surf/${k}`).min, G(`ink-surf/${k}`).at);
  claim(`§2.1 light ${f} ink-hi/fill`, v[3], G(`inkhi-fill/${k}`).min, G(`inkhi-fill/${k}`).at);
  claim(`§2.1 light ${f} ink/fill-strong`, v[4], G(`ink-fillstrong/${k}`).min, G(`ink-fillstrong/${k}`).at);
  claim(`§2.1 light ${f} on/strong`, v[5], G(`on-strong/${k}`).min, G(`on-strong/${k}`).at);
  claim(`§2.1 light ${f} strong/all surfaces`, v[6], G(`strong-surf/${k}`).min, G(`strong-surf/${k}`).at);
  claim(`§2.1 light ${f} graphic/surfaces`, v[7], G(`graphic-surf/${k}`).min, G(`graphic-surf/${k}`).at);
  if (v[8] !== null) claim(`§2.1 light ${f} fill C`, v[8], G(`chroma/${f}/light`).min, '', { tol: 0.002 });
}
const D21 = {
  bubblegum: [1.53, 6.86, 9.19, 5.35, 8.67, 7.06, 5.11, 0.074],
  peach: [1.53, 6.94, 9.31, 5.31, 8.68, 7.12, 5.24, 0.075],
  butter: [1.52, 7.12, 9.51, 5.19, 8.97, 7.40, 10.32, 0.074],
  mint: [1.58, 7.03, 9.75, 5.06, 9.26, 7.85, 3.71, 0.074],
  aqua: [1.57, 7.09, 9.74, 5.18, 9.22, 7.76, 6.07, 0.063],
  sky: [1.52, 7.14, 9.53, 5.25, 8.98, 7.44, 8.47, 0.074],
  periwinkle: [1.53, 7.01, 9.39, 5.28, 8.84, 7.27, 5.52, 0.075],
  lavender: [1.53, 6.93, 9.29, 5.33, 8.72, 7.13, 3.28, 0.074],
  graphite: [1.53, 7.39, 9.92, 6.12, 9.80, 7.97, 11.17, null],
};
for (const [f, v] of Object.entries(D21)) {
  const k = `${f}/dark/${AD}`;
  claim(`§2.1 dark ${f} fill/card`, v[0], G(`chip-card/${f}/${AD}`).min, G(`chip-card/${f}/${AD}`).at);
  claim(`§2.1 dark ${f} ink/fill`, v[1], G(`ink-fill/${k}`).min, G(`ink-fill/${k}`).at);
  claim(`§2.1 dark ${f} ink/all surfaces`, v[2], G(`ink-surf/${k}`).min, G(`ink-surf/${k}`).at);
  claim(`§2.1 dark ${f} ink/fill-strong`, v[3], G(`ink-fillstrong/${k}`).min, G(`ink-fillstrong/${k}`).at);
  claim(`§2.1 dark ${f} on/strong`, v[4], G(`on-strong/${k}`).min, G(`on-strong/${k}`).at);
  claim(`§2.1 dark ${f} strong/surfaces`, v[5], G(`strong-surf/${k}`).min, G(`strong-surf/${k}`).at);
  claim(`§2.1 dark ${f} graphic/surfaces`, v[6], G(`graphic-surf/${k}`).min, G(`graphic-surf/${k}`).at);
  if (v[7] !== null) claim(`§2.1 dark ${f} fill C`, v[7], G(`chroma/${f}/dark`).min, '', { tol: 0.002 });
}
const darkPeople = PEOPLE.map(f => `ink-fill/${f}/dark/${AD}`);
claim('§2.1 dark ink on its own chip ≥ 6.86', 6.86, minOf(darkPeople).min, minOf(darkPeople).at);
claim('§2.1 dark ink-hi ≥ 8.35 (ink-hi on fill)', 8.35, minOf(PEOPLE.map(f => `inkhi-fill/${f}/dark/${AD}`)).min, minOf(PEOPLE.map(f => `inkhi-fill/${f}/dark/${AD}`)).at);
claim('§2.1 dark ink-hi true minimum 8.356 (exact)', 8.356, minOf(PEOPLE.map(f => `inkhi-fill/${f}/dark/${AD}`)).min, minOf(PEOPLE.map(f => `inkhi-fill/${f}/dark/${AD}`)).at, { kind: 'exact', tol: 0.001 });
claim('§2.1 dark -strong gives -on ≥ 8.67', 8.67, minOf(PEOPLE.map(f => `on-strong/${f}/dark/${AD}`)).min, minOf(PEOPLE.map(f => `on-strong/${f}/dark/${AD}`)).at);
claim('§2.1 dark -strong reads ≥ 7.06 as text on every dark surface', 7.06, minOf(PEOPLE.map(f => `strong-surf/${f}/dark/${AD}`)).min, minOf(PEOPLE.map(f => `strong-surf/${f}/dark/${AD}`)).at);
claim('§2.1 dark chips ≥ 1.52 off every card', 1.52, minOf(PEOPLE.map(f => `chip-card/${f}/${AD}`)).min, minOf(PEOPLE.map(f => `chip-card/${f}/${AD}`)).at);
claim('COLOR-8 dark chip max pair 1.708 (Mint on Graphite card)', 1.708, maxOf(PEOPLE.map(f => `chip-card/${f}/${AD}`)).max, maxOf(PEOPLE.map(f => `chip-card/${f}/${AD}`)).at, { kind: 'max', tol: 0.001 });
claim('COLOR-8 per-family chip minima upper end 1.58', 1.58, Math.max(...HUES8.map(f => G(`chip-card/${f}/${AD}`).min)), '', { kind: 'exact' });
claim('§2.1 light person -strong ≥ 4.58 as text', 4.58, minOf(PEOPLE.map(f => `strong-surf/${f}/light/${AD}`)).min, minOf(PEOPLE.map(f => `strong-surf/${f}/light/${AD}`)).at);
// Bubblegum dark strong ΔE00 from old #FF99C3
claim('§2.1 Bubblegum #FF99C3 → #FF9BC4 ΔE00 0.44', 0.44, de2000(labFromLinear(linRGB(parseColour('#FF99C3'))), labFromLinear(linRGB(parseColour('#FF9BC4')))), '', { kind: 'exact', tol: 0.01 });
{ const fw = ctxs.find(c => c.theme === 'forest' && c.mode === 'adult'); claim('§2.1 #FF99C3 read 6.97 on Forest well', 6.97, cr(parseColour('#FF99C3'), fw.C('--surface-2')), 'forest well', { kind: 'exact' }); }
// §2.2 semantic
const SEMT = { success: [6.76, 7.06], warning: [6.23, 7.03], danger: [5.48, 6.97] };
for (const [f, [l, d]] of Object.entries(SEMT)) {
  claim(`§2.2 ${f} light ink/fill`, l, G(`ink-fill/${f}/light/${AD}`).min, '');
  claim(`§2.2 ${f} dark ink/fill`, d, G(`ink-fill/${f}/dark/${AD}`).min, '');
}
claim('§2.2 dark switch: white knob ≥ 4.02', 4.02, G(`knob/dark/${AD}`).min, G(`knob/dark/${AD}`).at);
claim('§2.2 badge label 6.42', 6.42, G(`badge-label/${AD}`).min, G(`badge-label/${AD}`).at);
claim('§2.2 badge vs card ≥ 6.00', 6.00, G(`badge-vs-card/${AD}`).min, G(`badge-vs-card/${AD}`).at);
claim('§2.2 badge vs card true minimum 6.004', 6.004, G(`badge-vs-card/${AD}`).min, G(`badge-vs-card/${AD}`).at, { kind: 'exact', tol: 0.001 });
claim('§2.2 badge vs sheet ≥ 5.28', 5.28, G(`badge-vs-sheet/${AD}`).min, G(`badge-vs-sheet/${AD}`).at);
claim('§2.2 badge vs page ≥ 7.35', 7.35, G(`badge-vs-page/${AD}`).min, G(`badge-vs-page/${AD}`).at);
{
  const par = `parchment`;
  claim('§2.2 success-strong as text on Parchment page 3.70', 3.70, G(`sem-strong-text/success/${par}/page/${AD}`).min, '', { kind: 'exact' });
  claim('§2.2 warning-strong as text on Parchment page 3.79', 3.79, G(`sem-strong-text/warning/${par}/page/${AD}`).min, '', { kind: 'exact' });
  claim('§2.2 success-strong on white 4.77', 4.77, G(`sem-strong-text/success/hearth/card/${AD}`).min, '', { kind: 'exact' });
  claim('§2.2 warning-strong on white 4.88', 4.88, G(`sem-strong-text/warning/hearth/card/${AD}`).min, '', { kind: 'exact' });
  const d = minOf(['hearth', 'parchment', 'frost'].flatMap(t => Object.keys(OPAQUE).map(k => `sem-strong-text/danger/${t}/${k}/${AD}`)));
  claim('§1 danger strong reads 7.42 as text (light min)', 7.42, d.min, d.at);
  const sl = minOf(['success', 'warning'].flatMap(f => ['hearth', 'parchment', 'frost'].map(t => `sem-strong-text/${f}/${t}/page/${AD}`)));
  claims.push({ where: 'info: semantic -strong as text under 4.5 on every light page (max over pages)', stated: '< 4.5', true: +Math.max(...['success', 'warning'].flatMap(f => ['hearth', 'parchment', 'frost'].map(t => G(`sem-strong-text/${f}/${t}/page/${AD}`).min))).toFixed(4), ok: Math.max(...['success', 'warning'].flatMap(f => ['hearth', 'parchment', 'frost'].map(t => G(`sem-strong-text/${f}/${t}/page/${AD}`).min))) < 4.5, info: true });
}
claim('§2.2 semantic on/strong ≥ 4.76', 4.76, G(`on-strong-all/sem/${AD}`).min, G(`on-strong-all/sem/${AD}`).at);
claim('§2.2a semantic on/strong in 7:1 modes ≥ 4.76', 4.76, G(`on-strong-all/sem/hi`).min, G(`on-strong-all/sem/hi`).at);
claim('§2.2 "the gate holds a semantic -strong to 3:1 as a graphic (lowest 3.06)": lowest semantic -strong on a surface', 3.06, G(`sem-strong-graphic/${AD}`).min, G(`sem-strong-graphic/${AD}`).at);
claims.push({ where: 'info: lowest semantic -graphic on a surface (what 3.06 is)', stated: 3.06, true: +minOf(SEM.map(f => `graphic-surf/${f}/light/${AD}`)).min.toFixed(4), at: minOf(SEM.map(f => `graphic-surf/${f}/light/${AD}`)).at, ok: true, info: true });
claim('§2.2 semantic luminance ratio lowest 1.57', 1.57, Math.min(...Object.keys(MODES).map(md => G(`semlum/${md}`).min)), G(`semlum/${AD}`).at);
claim('§2.2 semantic ≥ 10.74 ΔE00 from every person graphic', 10.74, Math.min(cvd['sem-vs-person/light'].min, cvd['sem-vs-person/dark'].min), cvd['sem-vs-person/light'].pair + ' / ' + cvd['sem-vs-person/dark'].pair);
claim('§2.2 CVD success vs warning protan (light) 3.9', 3.9, cvd['sem/light/protan/success-warning'], '', { kind: 'exact', tol: 0.05 });
claim('§2.2 CVD success vs danger deutan (dark) 8.6', 8.6, cvd['sem/dark/deutan/success-danger'], '', { kind: 'exact', tol: 0.05 });
// §2.2a table
const hiIds = pre => [`${pre}/hi`];
claim('§2.2a text-2/3 adult ≥ 7.50 (text-2)', 7.50, G(`text2-all/${AD}`).min, G(`text2-all/${AD}`).at);
claim('§2.2a text-3 adult ≥ 5.07', 5.07, G(`text3-all/${AD}`).min, G(`text3-all/${AD}`).at);
claim('§2.2a text-2/text-3 in 7:1 modes ≥ 10.38', 10.38, Math.min(G('text2-all/hi').min, G('text3-all/hi').min), G('text3-all/hi').at);
claim('§2.2a hue inks on fills and every surface adult ≥ 5.03', 5.03, G(`ink-any/${AD}`).min, G(`ink-any/${AD}`).at);
claim('§2.2a hue inks in 7:1 modes ≥ 7.01', 7.01, G('ink-any/hi').min, G('ink-any/hi').at);
claim('§2.2a legacy --accent text adult ≥ 4.58', 4.58, G(`accent-text/${AD}`).min, G(`accent-text/${AD}`).at);
claim('§2.2a legacy --accent text 7:1 ≥ 7.06', 7.06, G('accent-text/hi').min, G('accent-text/hi').at);
claim('§2.2a legacy --accent text 7:1 light ≥ 7.28', 7.28, G('accent-text/light/hi').min, G('accent-text/light/hi').at);
claim('§2.2a legacy --accent text 7:1 dark ≥ 7.06', 7.06, G('accent-text/dark/hi').min, G('accent-text/dark/hi').at);
claim('§2.2a accent-on/strong adult ≥ 5.90', 5.90, G(`acc-on-strong-all/${AD}`).min, G(`acc-on-strong-all/${AD}`).at);
claim('§2.2a sel-ink-strong/sel-fill-strong adult ≥ 5.90', 5.90, G(`sel-ink-strong/${AD}`).min, G(`sel-ink-strong/${AD}`).at);
claim('§2.2a accent-on/strong 7:1 ≥ 8.67', 8.67, G('acc-on-strong-all/hi').min, G('acc-on-strong-all/hi').at);
claim('§2.2a accent-on/strong 7:1 light ≥ 9.37', 9.37, G('acc-on-strong-all/light/hi').min, G('acc-on-strong-all/light/hi').at);
claim('§2.2a sel-ink-strong 7:1 ≥ 8.67', 8.67, G('sel-ink-strong/hi').min, G('sel-ink-strong/hi').at);
claim('§2.2a dark hero button adult ≥ 6.86', 6.86, G(`hero-all/dark/${AD}`).min, G(`hero-all/dark/${AD}`).at);
claim('§2.2a dark hero button 7:1 ≥ 8.35', 8.35, G('hero-all/dark/hi').min, G('hero-all/dark/hi').at);
claim('§2.2a badge 7:1 label 10.73', 10.73, G('badge-label/hi').min, G('badge-label/hi').at);
claim('§2.2a badge 7:1 ≥ 8.34 on every page, card and sheet', 8.34, G('badge-vs-pcs/hi').min, G('badge-vs-pcs/hi').at);
claim('§2.2a toast-ink-2 adult ≥ 6.58', 6.58, G(`toast-ink2/${AD}`).min, G(`toast-ink2/${AD}`).at);
claim('§2.2a toast-ink-2 7:1 ≥ 10.02', 10.02, G('toast-ink2/hi').min, G('toast-ink2/hi').at);
claim('§2.5 toast ink ≥ 10.02', 10.02, G(`toast-ink/${AD}`).min, G(`toast-ink/${AD}`).at);
claim('§2.2a inverse glass adult ≥ 6.52', 6.52, G(`inverse/${AD}`).min, G(`inverse/${AD}`).at);
claim('§2.2a inverse glass 7:1 ≥ 7.37', 7.37, G('inverse/hi').min, G('inverse/hi').at);
claim('§2.2a TV text ≥ 10.00', 10.00, G('tv-text').min, G('tv-text').at);
claim('§2.2a TV text-2 ≥ 7.03', 7.03, G('tv-text2').min, G('tv-text2').at);
claim('§2.2a large numerals in graphic ≥ 3.13 (adult)', 3.13, minOf(PEOPLE.map(f => `graphic-surf/${f}/light/${AD}`).concat(PEOPLE.map(f => `graphic-surf/${f}/dark/${AD}`))).min, minOf(PEOPLE.map(f => `graphic-surf/${f}/light/${AD}`).concat(PEOPLE.map(f => `graphic-surf/${f}/dark/${AD}`))).at);
claim('§2.2a large numerals in graphic ≥ 3.13 (7:1 modes)', 3.13, minOf([...HI_MODES].flatMap(md => PEOPLE.flatMap(f => [`graphic-surf/${f}/light/${md}`, `graphic-surf/${f}/dark/${md}`]))).min, minOf([...HI_MODES].flatMap(md => PEOPLE.flatMap(f => [`graphic-surf/${f}/light/${md}`, `graphic-surf/${f}/dark/${md}`]))).at);
claim('§2.2a Timer digits (--accent-strong) ≥ 7.06 in 7:1 modes', 7.06, G('accent-text/hi').min, G('accent-text/hi').at);
claim('§2.2a Hearth swatch under IC: text-3 on surface 6.66', 6.66, swatch.text3OnSurface, 'nested swatch', { kind: 'exact' });
claim('§2.2a Hearth swatch under IC: Mint ink on fill 5.23', 5.23, swatch.mintInkOnFill, 'nested swatch', { kind: 'exact' });
{ const r = ['bubblegum', 'peach', 'lavender'].map(f => G(`ink-fill/${f}/dark/${AD}`).min); claim('§2.2a dark ink/chip 6.86-6.94 (Bubblegum, Peach, Lavender) low', 6.86, Math.min(...r), ''); claim('§2.2a dark ink/chip 6.86-6.94 high', 6.94, Math.max(...r), '', { kind: 'max' }); }
// glass text rows in the 7:1 table (adult primary ≥ 7.01 = fill alone over worst; secondary ≥ 4.5)
// §2.3 neutrals
const N23 = {
  hearth: [14.95, 8.21, 5.55, 5.82, 3.07, 1.12], parchment: [12.25, 8.36, 6.21, 5.96, 3.23, 1.20], frost: [15.08, 7.50, 5.07, 5.36, 3.03, 1.11],
  midnight: [17.72, 8.58, 5.52, 5.23, 3.14, 1.20], forest: [16.43, 8.86, 5.67, 5.30, 3.44, 1.22], graphite: [19.28, 9.15, 5.41, 5.86, 3.35, 1.23],
};
for (const [t, v] of Object.entries(N23)) {
  const c = ctxs.find(x => x.theme === t && x.mode === 'adult' && x.person === 'graphite');
  claim(`§2.3 ${t} text on page`, v[0], cr(c.C('--text'), c.C('--bg')), t, { kind: 'exact' });
  claim(`§2.3 ${t} text-2 lowest on any opaque surface`, v[1], G(`text2/${AD}/${t}`).min, G(`text2/${AD}/${t}`).at);
  claim(`§2.3 ${t} text-3 lowest`, v[2], G(`text3/${AD}/${t}`).min, G(`text3/${AD}/${t}`).at);
  const gl = minOf(PEOPLE.map(() => `glass-text2/glass/fill/worst/${t}/${AD}`));
  claim(`§2.3 ${t} text-2 on glass (fill alone) over worst`, v[3], gl.min, gl.at);
  claim(`§2.3 ${t} field-border lowest`, v[4], G(`field-border/${AD}/${t}`).min, G(`field-border/${AD}/${t}`).at);
  claim(`§2.3 ${t} card ÷ page`, v[5], G(`card-page/${t}`).min, t);
}
// §2.4 accent matrix
const A24 = {
  bubblegum: [7.10, 5.90, 5.26, 5.92, 4.60, 3.60, 6.86, 6.33], peach: [6.35, 5.28, 5.03, 5.93, 4.61, 4.93, 6.79, 5.66],
  butter: [6.15, 5.11, 5.76, 5.92, 4.60, 3.14, 6.58, 5.48], mint: [6.16, 5.12, 5.23, 5.93, 4.61, 4.85, 6.59, 5.49],
  aqua: [6.46, 5.37, 5.41, 6.08, 4.72, 3.83, 6.91, 5.76], sky: [7.43, 6.17, 5.67, 5.93, 4.61, 4.13, 7.14, 6.62],
  periwinkle: [8.03, 6.67, 5.86, 5.94, 4.62, 3.13, 7.01, 7.15], lavender: [8.07, 6.71, 5.85, 5.90, 4.58, 4.60, 6.93, 7.19],
  graphite: [8.48, 7.05, 7.09, 5.92, 4.60, 7.44, 7.39, 7.55],
};
for (const [p, v] of Object.entries(A24)) {
  const a = (id) => G(id);
  claim(`§2.4 ${p} ink/card`, v[0], a(`accent-ink/card/${p}/${AD}`).min, a(`accent-ink/card/${p}/${AD}`).at);
  claim(`§2.4 ${p} ink/page`, v[1], a(`accent-ink/page/${p}/${AD}`).min, a(`accent-ink/page/${p}/${AD}`).at);
  claim(`§2.4 ${p} ink/fill`, v[2], a(`acc-ink-fill/${p}/${AD}`).min, a(`acc-ink-fill/${p}/${AD}`).at);
  claim(`§2.4 ${p} on/strong`, v[3], a(`acc-on-strong/${p}/${AD}`).min, a(`acc-on-strong/${p}/${AD}`).at);
  claim(`§2.4 ${p} strong as text/page`, v[4], a(`accent-text-page/${p}/${AD}`).min, a(`accent-text-page/${p}/${AD}`).at);
  claim(`§2.4 ${p} graphic/page`, v[5], a(`accent-graphic/page/${p}/${AD}`).min, a(`accent-graphic/page/${p}/${AD}`).at);
  claim(`§2.4 ${p} hero button`, v[6], a(`hero/${p}/${AD}`).min, a(`hero/${p}/${AD}`).at);
  claim(`§2.4 ${p} tab label on glass over #767676 (--glass-strong)`, v[7], a(`tab-label-mid/strong/${p}/${AD}`).min, a(`tab-label-mid/strong/${p}/${AD}`).at);
}
{ // Lavender "dark 3.76 on card"
  const e = G(`accent-graphic/card/lavender/${AD}`); const darkCard = DARK.map(t => ctxs.find(c => c.theme === t && c.person === 'lavender' && c.mode === AD)).map(c => cr(c.C('--accent-graphic'), c.C('--surface')));
  claim('§2.4 Lavender graphic dark 3.76 on card', 3.76, Math.min(...darkCard), '');
}
claim('§2.4 focus and today rings ≥ 3.13 on every surface', 3.13, Math.min(...Object.keys(MODES).map(md => Math.min(G(`focus/${md}`).min, G(`today/${md}`).min))), G(`focus/${AD}`).at);
claim('§2.4 selected label on its pill ≥ 5.03', 5.03, G(`sel-ink/${AD}`).min, G(`sel-ink/${AD}`).at);
claim('§2.4 progress fill on track ≥ 4.00', 4.00, G(`progress/${AD}`).min, G(`progress/${AD}`).at);
claim('§2.4 progress true minimum 4.005', 4.005, G(`progress/${AD}`).min, G(`progress/${AD}`).at, { kind: 'exact', tol: 0.001 });
claim('§2.4 hero dark ≥ 6.86', 6.86, G(`hero-all/dark/${AD}`).min, G(`hero-all/dark/${AD}`).at);
claim('§2.4 hero 7:1 ≥ 8.35', 8.35, G('hero-all/dark/hi').min, G('hero-all/dark/hi').at);
claim('ACCENT-4 hero button ≥ 6.58', 6.58, G(`hero-all/${AD}`).min, G(`hero-all/${AD}`).at);
// CVD table
const CV = [['graphic/light/normal', 14.60, 'mint/aqua'], ['graphic/light/protan', 11.27, 'peach/mint'], ['graphic/light/deutan', 11.02, 'sky/lavender'], ['graphic/light/tritan', 5.14],
  ['fill/light/normal', 7.85, 'periwinkle/lavender'], ['fill/light/protan', 1.08, 'periwinkle/lavender'], ['fill/light/deutan', 0.48, 'periwinkle/lavender'],
  ['graphic/dark/normal', 13.25, 'sky/periwinkle'], ['graphic/dark/protan', 12.66, 'aqua/graphite'], ['graphic/dark/deutan', 12.76, 'sky/periwinkle'], ['graphic/dark/tritan', 5.26],
  ['fill/dark/normal', 7.24], ['fill/dark/protan', 1.30, 'periwinkle/lavender'], ['fill/dark/deutan', 0.57, 'sky/periwinkle']];
const cvdPairs = [];
for (const [k, v, pair] of CV) {
  claim(`§2.4 CVD ${k}`, v, cvd[k].min, cvd[k].pair);
  if (pair) cvdPairs.push({ k, stated: pair, true: cvd[k].pair, ok: pair === cvd[k].pair });
}
claim('§2.4 CVD graphics ≥ 11.02 under CVD (ACCENT-8)', 11.02, Math.min(...['light', 'dark'].flatMap(s => ['protan', 'deutan'].map(k => cvd[`graphic/${s}/${k}`].min))), '');
claim('ACCENT-8 dichromat fill minima range low 0.48', 0.48, Math.min(...['light', 'dark'].flatMap(s => ['protan', 'deutan'].map(k => cvd[`fill/${s}/${k}`].min))), '');
claim('ACCENT-8 dichromat fill minima range high 1.30', 1.30, Math.max(...['light', 'dark'].flatMap(s => ['protan', 'deutan'].map(k => cvd[`fill/${s}/${k}`].min))), '', { kind: 'max' });
// §2.5
claim('§2.5 switch on ≥ 3.43 every opaque surface', 3.43, Math.min(...Object.keys(MODES).map(md => G(`switch-on/${md}`).min)), G(`switch-on/${AD}`).at);
claim('§2.5 switch on the card 3.93 (dark, lowest card)', 3.93, Math.min(...DARK.map(t => G(`switch-on/${t}/card/${AD}`).min)), '', { kind: 'exact' });
claim('§2.5 switch Forest well (#269143 on #213029) = lowest 3.43', 3.43, G(`switch-on/forest/well/${AD}`).min, '', { kind: 'exact' });
claim('§2.5 switch Graphite sheet 3.46', 3.46, G(`switch-on/graphite/sheet/${AD}`).min, '', { kind: 'exact' });
claim('§2.5 switch 3.70 in light on Parchment page', 3.70, G(`switch-on/parchment/page/${AD}`).min, '', { kind: 'exact' });
claim('§2.5 switch light minimum = Parchment page', 3.70, G(`switch-on/light/${AD}`).min, G(`switch-on/light/${AD}`).at);
claim('§2.5 knob ≥ 4.02', 4.02, Math.min(G(`knob/light/${AD}`).min, G(`knob/dark/${AD}`).min), '');
claim('§2.5 switch-off ring ≥ 3.03', 3.03, Math.min(...Object.keys(MODES).map(md => G(`switch-off-ring/${md}`).min)), G(`switch-off-ring/${AD}`).at);
claim('§2.5 status dots ≥ 3.28 on glass tab bar over #767676 (--glass-strong, adult)', 3.28, G(`status/strong/${AD}`).min, G(`status/strong/${AD}`).at);
claim('§2.5 status dots ≥ 3.28 on glass tab bar over #767676 (every mode)', 3.28, G(`status/strong/all`).min, G(`status/strong/all`).at);
claim('§2.5 cell-empty / muted-decor ≥ 3.03', 3.03, Math.min(...Object.keys(MODES).map(md => G(`muted-decor/${md}`).min)), G(`muted-decor/${AD}`).at);
claim('§2.5 star stroke ≥ 5.11 on every surface', 5.11, Math.min(...Object.keys(MODES).map(md => G(`star-stroke/${md}`).min)), G(`star-stroke/${AD}`).at);
claim('§2.5 badge label 6.42 / 7:1 10.73', 10.73, G('badge-label/hi').min, '');
// §7 glass
claim('§7 fill alone over worst: primary ≥ 7.01 (--glass)', 7.01, G(`gtext/glass/fill/worst/${AD}`).min, G(`gtext/glass/fill/worst/${AD}`).at);
claim('§7 fill alone over worst: secondary ≥ 5.23 (--glass)', 5.23, G(`gtext2/glass/fill/worst/${AD}`).min, G(`gtext2/glass/fill/worst/${AD}`).at);
claim('§7 full sheen on --glass-strong over worst: primary ≥ 8.22', 8.22, G(`gtext/strong/sheen/all/${AD}`).min, G(`gtext/strong/sheen/all/${AD}`).at);
claim('§7 full sheen on --glass-strong over worst: secondary ≥ 6.15', 6.15, G(`gtext2/strong/sheen/all/${AD}`).min, G(`gtext2/strong/sheen/all/${AD}`).at);
claim('§7 sheen+pickup on --glass-strong every backdrop: primary ≥ 7.52', 7.52, G(`gtext/strong/sheen+pickup/all/${AD}`).min, G(`gtext/strong/sheen+pickup/all/${AD}`).at);
claim('§7 sheen+pickup on --glass-strong every backdrop: secondary ≥ 5.56', 5.56, G(`gtext2/strong/sheen+pickup/all/${AD}`).min, G(`gtext2/strong/sheen+pickup/all/${AD}`).at);
claim('§7 sheen+pickup on --glass over page/card/#767676: primary ≥ 7.98', 7.98, G(`gtext/glass/sheen+pickup/pcm/${AD}`).min, G(`gtext/glass/sheen+pickup/pcm/${AD}`).at);
claim('§7 sheen+pickup on --glass over page/card/#767676: secondary ≥ 5.89', 5.89, G(`gtext2/glass/sheen+pickup/pcm/${AD}`).min, G(`gtext2/glass/sheen+pickup/pcm/${AD}`).at);
{
  const p = Math.min(G('gtext/strong/sheen+pickup/all/hi').min, G('gtext/glass/sheen+pickup/pcm/hi').min);
  const s = Math.min(G('gtext2/strong/sheen+pickup/all/hi').min, G('gtext2/glass/sheen+pickup/pcm/hi').min);
  claim('§7 sheen+pickup in 7:1 modes: primary 9.79', 9.79, p, ''); claim('§7 sheen+pickup in 7:1 modes: secondary 8.93', 8.93, s, '');
}
claim('§7 full sheen on --glass over page/card/#767676: primary ≥ 8.89', 8.89, G(`gtext/glass/sheen/pcm/${AD}`).min, G(`gtext/glass/sheen/pcm/${AD}`).at);
claim('§7 full sheen on --glass over page/card/#767676: secondary ≥ 6.62', 6.62, G(`gtext2/glass/sheen/pcm/${AD}`).min, G(`gtext2/glass/sheen/pcm/${AD}`).at);
claim('§7 tabs under full sheen: selected ≥ 5.97', 5.97, G('tab-sel-sheen-all').min, G('tab-sel-sheen-all').at);
claim('§7 tabs under full sheen: unselected (text-3) ≥ 4.50', 4.50, G('tab-unsel-sheen-all').min, G('tab-unsel-sheen-all').at);
claim('§7 reported: --glass over white under full sheen, primary 5.94', 5.94, G(`gtext/glass/sheen/worst/${AD}`).min, G(`gtext/glass/sheen/worst/${AD}`).at);
claim('§7 reported: --glass over white under full sheen, secondary 4.42', 4.42, G(`gtext2/glass/sheen/worst/${AD}`).min, G(`gtext2/glass/sheen/worst/${AD}`).at);
// marks table (adult; lowest over page / card / #767676 / worst; --glass-strong assumed for the bars, --glass reported alongside)
const MK = [['tab-ink', 'pickup', [5.39, 5.47, 4.96, 4.52]], ['mark', 'pickup', [3.32, 3.27, 2.99, 2.55]], ['mark', 'sheen', [3.24, 3.15, 2.81, 2.30]]];
const markAlt = {};
for (const [what, layer, vals] of MK) ['page', 'card', 'mid', 'worst'].forEach((bk, i) => {
  const s = G(`${what}/strong/${layer}/${bk}/${AD}`), g = G(`${what}/glass/${layer}/${bk}/${AD}`);
  markAlt[`${what}/${layer}/${bk}`] = { strong: +s.min.toFixed(4), strongAt: s.at, glass: +g.min.toFixed(4), glassAt: g.at };
  claim(`§7 marks table ${what} under full ${layer} over ${bk} (adult, --glass-strong)`, vals[i], s.min, s.at);
});
claim('§1 role table: selected tab ink ≥ 4.52 under full pickup over any backdrop', 4.52, Math.min(...['page', 'card', 'mid', 'worst'].map(bk => G(`tab-ink/strong/pickup/${bk}/any`).min)), '');
claim('§1 role table: graphic under full sheen 2.75 (Lavender, RT) — lowest over page/card/#767676, any mode', 2.75, Math.min(...['page', 'card', 'mid'].map(bk => G(`mark/strong/sheen/${bk}/any`).min)), ['page', 'card', 'mid'].map(bk => G(`mark/strong/sheen/${bk}/any`).at).join(' | '), { kind: 'exact' });
claim('§7 identity mark on the bar without sheen/pickup ≥ 3.31', 3.31, Math.min(...Object.keys(MODES).map(md => G(`mark-bar/${md}`).min)), G(`mark-bar/${AD}`).at);
claim('§7 pickup ΔE light low 6.2', 6.2, cvd['pickupDE/light/fill-strong'].min, '', { tol: 0.05 });
claim('§7 pickup ΔE light high 12.9', 12.9, cvd['pickupDE/light/fill-strong'].max, '', { kind: 'max', tol: 0.1 });
claim('§7 pickup ΔE dark low 8.2', 8.2, cvd['pickupDE/dark/fill-strong'].min, '', { tol: 0.05 });
claim('§7 pickup ΔE dark high 14.3', 14.3, cvd['pickupDE/dark/fill-strong'].max, '', { kind: 'max', tol: 0.1 });
// verification table / misc
claim('VR primary text 11.71 on opaque surfaces', 11.71, Math.min(...Object.keys(MODES).map(md => G(`text-all/${md}`).min)), G(`text-all/${AD}`).at);
claim('VR secondary 8.13 on page, card, sheet', 8.13, G(`text2-pcs/${AD}`).min, G(`text2-pcs/${AD}`).at);
claim('VR "secondary text 7.50 on wells": text-2 on --surface-2', 7.50, G(`text2-well/${AD}`).min, G(`text2-well/${AD}`).at);
claims.push({ where: 'info: where text-2 is 7.50 (Frost)', stated: 7.50, true: { well: gates['text-2/aa/well'].min, field: gates['text-2/aa/field'].min, hover: gates['text-2/aa/hover'].min }, ok: true, info: true });
claim('VR tertiary / placeholder 5.07', 5.07, G(`placeholder/${AD}`).min, G(`placeholder/${AD}`).at);
claim('VR selected tab label on glass over #767676 5.48', 5.48, minOf(PEOPLE.map(p => `tab-label-mid/strong/${p}/${AD}`)).min, minOf(PEOPLE.map(p => `tab-label-mid/strong/${p}/${AD}`)).at);
claim('VR non-text 3.03 (field border / muted-decor on hover)', 3.03, Math.min(...Object.keys(MODES).map(md => G(`field-border-all/${md}`).min)), G(`field-border-all/${AD}`).at);
claim('VR graphic 3.06 (warning graphic on Parchment page) — all graphic + semantic strong', 3.06, Math.min(G(`graphic-all/${AD}`).min, G(`sem-strong-graphic/${AD}`).min), G(`graphic-all/${AD}`).at + ' | ' + G(`sem-strong-graphic/${AD}`).at);
claim('VR depth card ÷ page light 1.11', 1.11, Math.min(...LIGHT.map(t => G(`card-page/${t}`).min)), '');
claim('VR depth card ÷ page dark 1.20', 1.20, Math.min(...DARK.map(t => G(`card-page/${t}`).min)), '');
claim('VR fill C ≥ 0.056', 0.056, Math.min(...HUES8.flatMap(f => [G(`chroma/${f}/light`).min, G(`chroma/${f}/dark`).min])), '', { tol: 0.002 });
claim('VR legacy labelled tints: .ds .app-icon ≥ 3.86', 3.86, G(`lbl-app-icon/${AD}`).min, G(`lbl-app-icon/${AD}`).at);
claim('VR legacy labelled tints: .feed .ficon 5.03', 5.03, G(`lbl-ficon/${AD}`).min, G(`lbl-ficon/${AD}`).at);
claim('VR legacy labelled tints: .ds .person-chip ≥ 6.20', 6.20, G(`lbl-person-chip/${AD}`).min, G(`lbl-person-chip/${AD}`).at);
claim('migration --line-soft Graphite page 1.26', 1.26, G(`line-soft/graphite/page/${AD}`).min, '');
claim('migration --line-soft Forest card 1.44 (the max)', 1.44, maxOf([`line-soft/dark/${AD}`, `line-soft/light/${AD}`]).max, maxOf([`line-soft/dark/${AD}`, `line-soft/light/${AD}`]).at, { kind: 'max' });
claim('migration --line-soft light low 1.30', 1.30, G(`line-soft/light/${AD}`).min, G(`line-soft/light/${AD}`).at);
claim('migration --line-soft light high 1.37', 1.37, G(`line-soft/light/${AD}`).max, G(`line-soft/light/${AD}`).maxAt, { kind: 'max' });
claim('migration --line-soft overall low 1.26', 1.26, Math.min(G(`line-soft/light/${AD}`).min, G(`line-soft/dark/${AD}`).min), G(`line-soft/dark/${AD}`).at);
claim('TOK-1 --X-on range low 4.76 (adult)', 4.76, G(`on-strong-range/${AD}`).min, G(`on-strong-range/${AD}`).at);
claim('TOK-1 --X-on range high 10.19 (adult)', 10.19, G(`on-strong-range/${AD}`).max, G(`on-strong-range/${AD}`).maxAt, { kind: 'max' });
claims.push({ where: 'info: --X-on on --X-strong range in the 7:1 modes', stated: 'n/a', true: `${G('on-strong-range/more').min.toFixed(2)}-${G('on-strong-range/more').max.toFixed(2)}`, ok: true, info: true });
claim('F260 body.nt / COLOR-4 text-3 on accent-wash ≥ 5.48', 5.48, Math.min(G(`on-wash/--text/${AD}`).min, G(`on-wash/--text-2/${AD}`).min, G(`on-wash/--text-3/${AD}`).min), G(`on-wash/--text-3/${AD}`).at);
claim('DARK-3 dark accent-ink ≥ 10.53 on cards', 10.53, G(`dark-accent-ink-card/${AD}`).min, G(`dark-accent-ink-card/${AD}`).at);
claim('DARK-3 dark accent-graphic ≥ 3.28', 3.28, G(`dark-accent-graphic/${AD}`).min, G(`dark-accent-graphic/${AD}`).at);
claim('ICON-3 / COLOR-9 tile glyph ≥ 3.26', 3.26, minOf(FAMS.flatMap(f => [`ink-fillstrong/${f}/light/${AD}`, `ink-fillstrong/${f}/dark/${AD}`])).min, minOf(FAMS.flatMap(f => [`ink-fillstrong/${f}/light/${AD}`, `ink-fillstrong/${f}/dark/${AD}`])).at);
claim('migration rewrites .ds .badge 6.42', 6.42, G(`badge-label/${AD}`).min, '');
claim('migration rewrites .ds .hero / .avatar 5.03 (accent-ink on fill)', 5.03, minOf(PEOPLE.map(p => `acc-ink-fill/${p}/${AD}`)).min, minOf(PEOPLE.map(p => `acc-ink-fill/${p}/${AD}`)).at);
claim('migration rewrites .fab-primary 5.90', 5.90, G(`acc-on-strong-all/${AD}`).min, '');
claims.push({ where: 'gate: §2.5 map-north ≥ 3 on glass (page/card/#767676)', stated: '≥ 3', true: +Math.min(G('map-north-glass/strong').min, G('map-north-glass/glass').min).toFixed(4), ok: Math.min(G('map-north-glass/strong').min, G('map-north-glass/glass').min) >= 3, info: true });

// extra single-pair claims
{
  const hl = ctxs.find(c => c.theme === 'hearth' && c.mode === AD && c.person === 'graphite');
  const dk = ctxs.find(c => c.theme === 'midnight' && c.mode === AD && c.person === 'graphite');
  claim('§1 pairing rule: white on --mint-fill 1.26', 1.26, cr(WHITE, hl.C('--mint-fill')), '', { kind: 'exact' });
  claim('§1 pairing rule: white on --butter-fill 1.14', 1.14, cr(WHITE, hl.C('--butter-fill')), '', { kind: 'exact' });
  claim('§2.5 / migration: white on dark danger (#FFC6C1) 1.48', 1.48, cr(WHITE, dk.C('--danger-ink')), '', { kind: 'exact' });
  // today's person colours (worker/seed.sql per the TOKENS.md table): protan / deutan minima
  const today = { eli: '#4F5D8C', mae: '#BC5A38', elizabeth: '#8A6A4B', david: '#3D5A3D', mea: '#5B8143', ezra: '#137F77', kiara: '#B4861B', tv: '#4C4C58' };
  const tv = Object.entries(today);
  for (const [kind, st] of [['protan', 4.8], ['deutan', 2.1]]) {
    let mn = Infinity, pr = null;
    for (let i = 0; i < tv.length; i++) for (let j = i + 1; j < tv.length; j++) { const d = deCvd(parseColour(tv[i][1]), parseColour(tv[j][1]), kind); if (d < mn) { mn = d; pr = tv[i][0] + '/' + tv[j][0]; } }
    claim(`§2.4 today's person colours ${kind} ${st} (8 profiles)`, st, mn, pr, { kind: 'exact', tol: 0.05 });
  }
  // historical: the strong-tone pickup (revision 2/3 figures)
  const fl = ctxs.find(c => c.theme === 'forest' && c.person === 'lavender' && c.mode === AD);
  const pane = over(fl.C('--glass-strong'), MID);
  const lay6 = parseColour(`color-mix(in srgb, ${fl.v['--accent-strong']} 6%, transparent)`);
  claim('§7 historical: strong-tone pickup at 6 % → Forest/Lavender icon 2.99 over #767676', 2.99, cr(fl.C('--accent-graphic'), over(lay6, pane)), 'forest/lavender', { kind: 'exact' });
  let mn = Infinity, at = null;
  for (const c of ctxs.filter(c => c.scheme === 'dark' && c.mode === AD)) {
    const oldPk = { midnight: 16, forest: 16, graphite: 14 }[c.theme];
    const surf = over(c.C('--glass-spec'), over(parseColour(`color-mix(in srgb, ${c.v['--accent-strong']} ${oldPk}%, transparent)`), over(c.C('--glass-strong'), WHITE)));
    const v = cr(c.C('--text'), surf); if (v < mn) { mn = v; at = c.id; }
  }
  claim('§7 historical: strong-tone pickup (16/16/14 %) sheet title over a white photo 5.91', 5.91, mn, at, { kind: 'exact' });
}

// cross-check of this script's cascade against the engine-confirmed samples (contrast.json → engineSamples, which
// browser-check.mjs re-resolved in WebKit and Chromium with 0 mismatches). Data only: nothing of contrast.mjs is imported.
const engineCross = { samples: 0, tokens: 0, mismatches: [] };
{
  const f = path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'contrast.json');
  if (fs.existsSync(f)) {
    const cj = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const smp of cj.engineSamples || []) {
      const v = compute({ isRoot: true, attrs: smp.attrs }, baseEnv, null);
      engineCross.samples++;
      for (const [k, want] of Object.entries(smp.toks)) {
        engineCross.tokens++;
        let mine;
        try { mine = parseColour(v[k]); } catch { engineCross.mismatches.push({ attrs: smp.attrs, k, want, mine: v[k] }); continue; }
        const w = parseColour(want);
        const d = Math.max(...[0, 1, 2].map(i => Math.abs(mine[i] - w[i])), Math.abs(mine[3] - w[3]) * 255);
        if (d > 0.51) engineCross.mismatches.push({ attrs: smp.attrs, k, want, mine: hex(mine) + '/' + mine[3].toFixed(3) });
      }
    }
  }
}
// 7:1-mode figures the section words loosely: text on --glass over a white photo, and the legacy labelled chip
const extraInfo = {
  glassOverWhiteHi: { primarySheen: +G('gtext/glass/sheen/worst/hi').min.toFixed(4), secondarySheen: +G('gtext2/glass/sheen/worst/hi').min.toFixed(4), at: G('gtext2/glass/sheen/worst/hi').at, secondaryFill: +G('gtext2/glass/fill/worst/hi').min.toFixed(4) },
  personChipHi: Object.fromEntries([...HI_MODES].map(md => [md, +G(`lbl-person-chip/${md}`).min.toFixed(4)])),
  personChipHiAt: G('lbl-person-chip/more').at,
  ficonHi: +G('lbl-ficon/more').min.toFixed(4), appIconHi: +G('lbl-app-icon/more').min.toFixed(4),
  swapCheck: ['hearth', 'parchment', 'frost', 'midnight', 'forest', 'graphite'].map(t => ({ t, kiosk: makeCtx(t, 'bubblegum', 'kiosk').v['--accent-strong'], more: makeCtx(t, 'bubblegum', 'more').v['--accent-strong'], media: makeCtx(t, 'bubblegum', 'more-media').v['--accent-strong'], adult: makeCtx(t, 'bubblegum', 'adult').v['--accent-strong'] })),
  noThemeKioskStrong: makeCtx(null, 'bubblegum', 'kiosk', { scheme: 'dark' }).v['--accent-strong'],
  noThemeLightKioskStrong: makeCtx(null, 'bubblegum', 'kiosk', { scheme: 'light' }).v['--accent-strong'],
};

// historical figures the revision notes quote
{
  const k = ctxs.find(c => c.theme === 'hearth' && c.mode === 'kiosk' && c.person === 'graphite');
  claim('rev 3 note: --tv-text-2 at the old .66 panel over white 5.10', 5.10, cr(k.C('--tv-text-2'), over([0, 0, 0, 0.66], WHITE)), 'hearth kiosk', { kind: 'exact' });
  const h = ctxs.find(c => c.theme === 'hearth' && c.mode === AD && c.person === 'graphite');
  claim('rev 3 note: adult light inverse glass over a white card 6.72', 6.72, cr(h.C('--glass-inverse-ink'), over(h.C('--glass-inverse'), WHITE)), 'hearth adult', { kind: 'exact' });
  claim('§2.2a/§2.5 inverse glass adult lowest ≥ 6.52 is over', 6.52, G(`inverse/${AD}`).min, G(`inverse/${AD}`).at);
}

// status dots under the sheen (the Me tab's sync dot sits beside the tab icon; the desktop sidebar's tabs sit under the sheen)
const dotsUnderSheen = {};
for (const c of ctxs) {
  const bks = { page: c.C('--bg'), card: c.C('--surface'), mid: MID };
  for (const [bk, b] of Object.entries(bks)) {
    const surf = over(c.C('--glass-spec'), over(c.C('--glass-strong'), b));
    for (const st of ['offline', 'pending', 'synced', 'error']) {
      const v = cr(c.C('--status-' + st), surf);
      const key = c.mode;
      if (!dotsUnderSheen[key] || v < dotsUnderSheen[key].min) dotsUnderSheen[key] = { min: +v.toFixed(4), at: `${c.id}/${bk}/${st}` };
      gate('info/status-dot-under-full-sheen', 0, v, `${c.id}/${bk}/${st}`);
    }
  }
}
extraInfo.dotsUnderSheen = dotsUnderSheen;

// ───────────────────────── 6. output ─────────────────────────
const failingGates = Object.entries(gates).filter(([, g]) => g.fails.length).map(([id, g]) => ({ id, threshold: g.threshold, min: +g.min.toFixed(4), at: g.at, fails: g.fails.length, first: g.fails.slice(0, 3) }));
const mism = claims.filter(c => !c.ok);
const out = {
  generated: new Date().toISOString(), tokens: path.relative(ROOT, CSS_FILE).replace(/\\/g, '/'), script: 'audits/tools/phase4/tokens/verify-contrast-5.mjs',
  method: 'Own cascade over proposed-tokens.css (compound selectors incl. :not/:where, specificity, source order, @media width/pointer/prefers-*, var() with fallbacks, nested-scope inheritance for the swatch); color-mix(in srgb) premultiplied with alpha multiplier; rgba compositing in gamma sRGB over opaque backdrops (page, card, sheet, #767676, white, black; glass: page, card, #767676 and the worst backdrop = black under light / white under dark); WCAG 2.x contrast; Machado 2009 severity 1 in linear sRGB (clamped) + CIEDE2000 (D65); OKLCH chroma.',
  contexts: { themes: Object.keys(THEMES), people: PEOPLE, modes: Object.keys(MODES), count: ctxs.length },
  gateCount: Object.keys(gates).length, evaluations: Object.values(gates).reduce((a, g) => a + g.n, 0), failingGates,
  gateMinima: Object.fromEntries(Object.entries(gates).map(([id, g]) => [id, { thr: g.threshold, min: +g.min.toFixed(4), at: g.at }])),
  claims: { total: claims.length, mismatched: mism.length, list: claims }, engineCross, extraInfo, cvdPairs, cvd, markAlt, swatch, noTheme,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`contexts ${ctxs.length}; gates ${out.gateCount}; evaluations ${out.evaluations}; failing gates ${failingGates.length}`);
for (const f of failingGates) console.log('FAIL', JSON.stringify(f));
console.log(`claims ${claims.length}; mismatched ${mism.length}`);
for (const c of mism) console.log('MISMATCH', JSON.stringify(c));
for (const p of cvdPairs.filter(p => !p.ok)) console.log('PAIR', JSON.stringify(p));
console.log('noTheme', JSON.stringify(noTheme.map(n => [n.mode, n.diffs])));
console.log('swatch', JSON.stringify(swatch));
console.log('engineCross', engineCross.samples, engineCross.tokens, engineCross.mismatches.length, JSON.stringify(engineCross.mismatches.slice(0,5)));
console.log('extraInfo', JSON.stringify(extraInfo));
process.exit(failingGates.length || mism.length || engineCross.mismatches.length ? 1 : 0);
