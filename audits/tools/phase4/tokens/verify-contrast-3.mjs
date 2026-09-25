#!/usr/bin/env node
// Phase 4 · independent contrast verifier, round 3.
//   node audits/tools/phase4/tokens/verify-contrast-3.mjs [TOKENS.md]
// Written from scratch: it imports nothing from contrast.mjs, colour-lib.mjs or the earlier verify-contrast-*.mjs.
// It parses proposed-tokens.css, runs its own cascade (specificity, source order, @media, custom-property inheritance,
// var() with fallbacks, color-mix() in srgb with premultiplied alpha, rgba() compositing in gamma sRGB), and then
//   1. GATES every text/background, fill/ink and non-text pair the section describes, in 6 palettes x 9 people x 8 modes
//      (adult, kid, kiosk, Increase Contrast by attribute, Increase Contrast by media mirror, Reduce Transparency by
//      attribute and by mirror, kiosk + Reduce Transparency), plus the no-data-theme dark root;
//   2. RECOMPUTES every number TOKENS.md states (the tables of §2.1-§2.5, §2.2a, §7, the verification table, the gap rows)
//      and compares: |stated - true| <= 0.05, and a stated minimum must not exceed the true minimum.
// Writes audits/evidence/p4/tokens/verify-contrast-3.json. Exit 0 only if every gate passes and every claim matches.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const CSS_FILE = path.join(HERE, 'proposed-tokens.css');
const MD_FILE = process.argv[2] || 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/ead87424-01af-4f71-ad5e-f00aad581d0b/scratchpad/p4/sections/TOKENS.md';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'tokens', 'verify-contrast-3.json');
const MD = fs.readFileSync(MD_FILE, 'utf8');

// ═════════════ 1. CSS parsing ═════════════
function splitTop(s, sep) {
  const out = []; let d = 0, q = null, cur = '';
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(') d++; else if (ch === ')') d--;
    if (ch === sep && d === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}
function parseBlocks(src, media, rules) {
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i); if (open < 0) break;
    const prelude = src.slice(i, open).trim();
    let d = 1, j = open + 1, q = null;
    for (; j < src.length && d; j++) {
      const ch = src[j];
      if (q) { if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") q = ch; else if (ch === '{') d++; else if (ch === '}') d--;
    }
    const body = src.slice(open + 1, j - 1);
    if (prelude.startsWith('@media')) parseBlocks(body, prelude.slice(6).trim(), rules);
    else if (prelude.startsWith('@')) throw new Error('unexpected at-rule ' + prelude);
    else rules.push({ order: rules.length, media, selectors: splitTop(prelude, ',').map(parseCompound), decls: splitTop(body, ';').map(d0 => { const k = d0.indexOf(':'); return [d0.slice(0, k).trim(), d0.slice(k + 1).trim()]; }) });
    i = j;
  }
  return rules;
}
function parseCompound(sel) {
  const parts = []; let s = sel.trim(), spec = 0;
  while (s.length) {
    let m;
    if ((m = s.match(/^:root/))) { parts.push({ t: 'root' }); spec += 1; }
    else if ((m = s.match(/^\[([\w-]+)(?:="([^"]*)")?\]/))) { parts.push({ t: 'attr', n: m[1], v: m[2] }); spec += 1; }
    else if ((m = s.match(/^:not\((.*?\])\)/))) { const inner = parseCompound(m[1]); parts.push({ t: 'not', inner }); spec += inner.spec; }
    else throw new Error('selector not understood: ' + sel);
    s = s.slice(m[0].length);
  }
  return { text: sel.trim(), parts, spec };
}
const matches = (el, c) => c.parts.every(p => p.t === 'root' ? el.isRoot : p.t === 'attr' ? (p.n in el.attrs && (p.v === undefined || el.attrs[p.n] === p.v)) : !matches(el, p.inner));
function mediaOK(cond, env) {
  if (!cond) return true;
  return cond.split(/\s+and\s+/).every(c => {
    const m = c.match(/^\(\s*([\w-]+)\s*:\s*([\w.-]+)\s*\)$/); if (!m) throw new Error('media not understood: ' + cond);
    const [, f, v] = m;
    if (f === 'min-width') return env.width >= parseFloat(v);
    if (f === 'pointer') return env.pointer === v;
    if (f === 'prefers-contrast') return env.contrast === v;
    if (f === 'prefers-reduced-transparency') return env.transparency === v;
    if (f === 'prefers-reduced-motion') return env.motion === v;
    throw new Error('media feature ' + f);
  });
}
const RULES = parseBlocks(fs.readFileSync(CSS_FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), null, []);

// ═════════════ 2. cascade + custom-property computation ═════════════
function computeChain(chain, env) {
  let parent = new Map();
  for (const el of chain) {
    const win = new Map();
    for (const r of RULES) {
      if (!mediaOK(r.media, env)) continue;
      let spec = -1; for (const s of r.selectors) if (matches(el, s)) spec = Math.max(spec, s.spec);
      if (spec < 0) continue;
      for (const [k, v] of r.decls) {
        if (!k.startsWith('--')) continue;
        const w = win.get(k);
        if (!w || spec > w.spec || (spec === w.spec && r.order >= w.order)) win.set(k, { spec, order: r.order, v });
      }
    }
    for (const [k, v] of Object.entries(el.style || {})) win.set(k, { spec: 1e9, order: 1e9, v });
    const out = new Map(parent), done = new Map(), busy = new Set(), par = parent;
    const get = n => { if (!win.has(n)) return par.get(n); if (done.has(n)) return done.get(n); if (busy.has(n)) return null; busy.add(n); const v = subst(win.get(n).v, get); busy.delete(n); done.set(n, v); return v; };
    for (const k of win.keys()) { const v = get(k); if (v == null) out.delete(k); else out.set(k, v); }
    parent = out;
  }
  return parent;
}
function subst(v, get) {
  let out = '', i = 0;
  while (i < v.length) {
    const k = v.indexOf('var(', i); if (k < 0) { out += v.slice(i); break; }
    out += v.slice(i, k);
    let d = 1, j = k + 4; for (; j < v.length && d; j++) { if (v[j] === '(') d++; else if (v[j] === ')') d--; }
    const inner = v.slice(k + 4, j - 1); const c = inner.indexOf(',');
    const name = (c < 0 ? inner : inner.slice(0, c)).trim(); const fb = c < 0 ? null : inner.slice(c + 1).trim();
    let val = get(name); if (val == null && fb != null) val = subst(fb, get);
    if (val == null) return null;
    out += val; i = j;
  }
  return out;
}

// ═════════════ 3. colour maths ═════════════
const NAMED = { white: '#FFFFFF', black: '#000000' };
function colour(s) {
  s = String(s).trim();
  if (NAMED[s]) s = NAMED[s];
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  let m;
  if ((m = s.match(/^#([0-9a-f]{6})$/i))) { const n = parseInt(m[1], 16); return { r: (n >> 16) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 }; }
  if ((m = s.match(/^#([0-9a-f]{3})$/i))) { const [r, g, b] = m[1].split('').map(x => parseInt(x + x, 16) / 255); return { r, g, b, a: 1 }; }
  if ((m = s.match(/^rgba?\(([^)]*)\)$/))) { const a = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: a[0] / 255, g: a[1] / 255, b: a[2] / 255, a: a[3] ?? 1 }; }
  if (s.startsWith('color-mix(')) {
    const args = splitTop(s.slice(10, -1), ',');
    if (args[0] !== 'in srgb') throw new Error('colour space ' + args[0]);
    const stop = t => { const mm = t.match(/^(.*\S)\s+(-?[\d.]+)%$/); return mm ? { c: colour(mm[1]), p: parseFloat(mm[2]) } : { c: colour(t), p: null }; };
    const A = stop(args[1]), B = stop(args[2]);
    let p1 = A.p, p2 = B.p;
    if (p1 == null && p2 == null) { p1 = 50; p2 = 50; } else if (p1 == null) p1 = 100 - p2; else if (p2 == null) p2 = 100 - p1;
    const sum = p1 + p2; const mult = sum < 100 ? sum / 100 : 1; const w1 = p1 / sum, w2 = p2 / sum;
    const a = A.c.a * w1 + B.c.a * w2;
    const ch = k => a === 0 ? 0 : (A.c[k] * A.c.a * w1 + B.c[k] * B.c.a * w2) / a;
    return { r: ch('r'), g: ch('g'), b: ch('b'), a: a * mult };
  }
  throw new Error('colour not understood: ' + s);
}
const over = (f, b) => { const a = f.a + b.a * (1 - f.a); if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }; const ch = k => (f[k] * f.a + b[k] * b.a * (1 - f.a)) / a; return { r: ch('r'), g: ch('g'), b: ch('b'), a }; };
const lin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const gam = c => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
const lum = c => { if (c.a < 0.999) throw new Error('luminance of a translucent colour'); return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); };
const cr = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
const hex = c => '#' + ['r', 'g', 'b'].map(k => Math.round(c[k] * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
function oklchC(c) {
  const [r, g, b] = [c.r, c.g, c.b].map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return Math.hypot(A, B);
}
function lab(c) {
  const [r, g, b] = [c.r, c.g, c.b].map(lin);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b, Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function de00(c1, c2) {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2), rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = a1 * (1 + G), ap2 = a2 * (1 + G), Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const h = (b, a) => { if (a === 0 && b === 0) return 0; const x = Math.atan2(b, a) / rad; return x < 0 ? x + 360 : x; };
  const hp1 = h(b1, ap1), hp2 = h(b2, ap2), dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = 0; if (Cp1 * Cp2) { dh = hp2 - hp1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh / 2 * rad), Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
  let hb = hp1 + hp2; if (Cp1 * Cp2) { if (Math.abs(hp1 - hp2) > 180) hb = hb < 360 ? hb + 360 : hb - 360; hb /= 2; }
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.20 * Math.cos((4 * hb - 63) * rad);
  const SL = 1 + 0.015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cpb, SH = 1 + 0.015 * Cpb * T;
  const RT = -2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
// Machado, Oliveira & Fernandes (2009), severity 1.0, applied to linear sRGB
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const sim = (c, v) => { if (v === 'normal') return c; const M = CVD[v], x = [c.r, c.g, c.b].map(lin); const y = M.map(r => Math.min(1, Math.max(0, r[0] * x[0] + r[1] * x[1] + r[2] * x[2]))).map(gam); return { r: y[0], g: y[1], b: y[2], a: 1 }; };

// ═════════════ 4. contexts ═════════════
const THEMES = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
const LIGHT = ['hearth', 'parchment', 'frost'], DARK = ['midnight', 'forest', 'graphite'];
const PEOPLE = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite'];
const HUES = PEOPLE.slice(0, 8), SEM = ['success', 'warning', 'danger'], FAM = [...PEOPLE, ...SEM];
const OPAQUE = ['bg', 'surface', 'surface-2', 'surface-raised', 'fill-field', 'hover'], PCS = ['bg', 'surface', 'surface-raised'], WELLS = ['surface-2', 'fill-field', 'hover'];
const MODES = {
  adult: { attrs: {}, env: {} },
  kid: { attrs: { 'data-kind': 'kid' }, env: {} },
  kiosk: { attrs: { 'data-kind': 'kiosk' }, env: {}, hi: true },
  'contrast-more': { attrs: { 'data-contrast': 'more' }, env: {}, hi: true },
  'contrast-more (media)': { attrs: {}, env: { contrast: 'more' }, hi: true },
  'reduce-transparency': { attrs: { 'data-transparency': 'reduce' }, env: {} },
  'reduce-transparency (media)': { attrs: {}, env: { transparency: 'reduce' } },
  'kiosk+reduce-transparency': { attrs: { 'data-kind': 'kiosk', 'data-transparency': 'reduce' }, env: {}, hi: true },
};
const ENV0 = { width: 390, pointer: 'fine', contrast: 'no-preference', transparency: 'no-preference', motion: 'no-preference' };
function ctx(theme, accent, mode, { noTheme = false, scheme } = {}) {
  const M = MODES[mode];
  const attrs = { 'data-scheme': scheme || THEMES[theme], 'data-accent': accent, 'data-kind': 'adult', ...M.attrs };
  if (!noTheme) attrs['data-theme'] = theme;
  const map = computeChain([{ isRoot: true, attrs }], { ...ENV0, ...M.env });
  const raw = n => { const v = map.get('--' + n); if (v == null) throw new Error(`--${n} unresolved in ${theme}/${accent}/${mode}`); return v; };
  const c = n => colour(raw(n));
  const s = n => { const x = c(n); if (x.a < 0.999) throw new Error(`--${n} not opaque (${theme}/${accent}/${mode})`); return x; };
  return { raw, c, s, map, hi: !!M.hi, scheme: attrs['data-scheme'], label: `${noTheme ? '(no data-theme)' : theme}/${accent}/${mode}` };
}

// ═════════════ 5. gates ═════════════
const gates = new Map();
function gate(id, v, thr, where) {
  let g = gates.get(id); if (!g) gates.set(id, g = { id, thr, n: 0, min: Infinity, at: null, fails: 0, failAt: [] });
  g.n++; if (v < g.min) { g.min = v; g.at = where; } if (v < thr - 1e-9) { g.fails++; if (g.failAt.length < 6) g.failAt.push(`${where}: ${v.toFixed(3)}`); }
}
const P = colour, WHITE = P('#FFFFFF'), BLACK = P('#000000'), MID = P('#767676');
const mins = {}; const mn = (k, v, at) => { if (!(k in mins) || v < mins[k].v) mins[k] = { v, at }; };
const maxs = {}; const mx = (k, v, at) => { if (!(k in maxs) || v > maxs[k].v) maxs[k] = { v, at }; };

function gateContext(X, theme, accent, mode) {
  const { s, c, hi, label } = X; const T = hi ? 7 : 4.5; const scheme = X.scheme;
  const txt = s('text'), t2 = s('text-2'), t3 = s('text-3');
  for (const b of OPAQUE) {
    const B = s(b);
    gate('text/opaque ≥ 7', cr(txt, B), 7, `${label}/${b}`);
    gate(`text-2/${PCS.includes(b) ? 'page-card-sheet ≥ 6' : 'wells ≥ 4.5'}${hi ? ' (7:1 mode ≥ 7)' : ''}`, cr(t2, B), hi ? 7 : PCS.includes(b) ? 6 : 4.5, `${label}/${b}`);
    gate(`text-3 + placeholder/opaque ≥ ${T}`, Math.min(cr(t3, B), cr(s('placeholder'), B)), T, `${label}/${b}`);
    for (const n of ['field-border', 'track-info', 'muted-decor', 'cell-empty', 'switch-off-ring']) gate(`${n}/opaque ≥ 3`, cr(s(n), B), 3, `${label}/${b}`);
    for (const n of ['focus-ring-color', 'today-ring', 'sel-fill-strong', 'accent-graphic', 'timer-done', 'star-stroke', 'switch-on', 'progress-fill']) gate(`${n}/opaque ≥ 3`, cr(s(n), B), 3, `${label}/${b}`);
    for (let i = 1; i <= 8; i++) gate('cat-N/opaque ≥ 3', cr(s('cat-' + i), B), 3, `${label}/${b}`);
    for (const n of ['fresh', 'aging', 'use-soon', 'status-offline', 'status-pending', 'status-synced', 'status-error']) gate('semantic graphics/opaque ≥ 3', cr(s(n), B), 3, `${label}/${b}/${n}`);
    gate(`accent-ink/opaque ≥ ${T}`, cr(s('accent-ink'), B), T, `${label}/${b}`);
    for (const n of ['accent', 'tint', 'accent-strong', 'accent-deep', 'tint-ink', 'gold', 'olive', 'teal', 'terra', 'slate', 'mocha', 'ok', 'warn', 'danger', 'gold-ink', 'olive-ink', 'teal-ink', 'terra-ink', 'slate-ink', 'mocha-ink', 'ok-ink', 'warn-ink', 'muted', 'info-ink'])
      gate(`legacy --${n} as text/opaque ≥ ${T}`, cr(s(n), B), T, `${label}/${b}`);
  }
  for (const b of PCS) gate('badge-bg/page-card-sheet ≥ 3', cr(s('badge-bg'), s(b)), 3, `${label}/${b}`);
  gate(`badge-ink/badge-bg ≥ ${T}`, cr(s('badge-ink'), s('badge-bg')), T, label);
  gate(`sel-ink/sel-fill ≥ ${T}`, cr(s('sel-ink'), s('sel-fill')), T, label);
  gate(`sel-ink-strong/sel-fill-strong ≥ ${T}`, cr(s('sel-ink-strong'), s('sel-fill-strong')), T, label);
  gate(`accent-on/accent-strong ≥ ${T}`, cr(s('accent-on'), s('accent-strong')), T, label);
  gate(`on-accent/accent (legacy solid) ≥ ${T}`, cr(s('on-accent'), s('accent')), T, label);
  gate(`hero-btn-ink/hero-btn-bg ≥ ${T}`, cr(s('hero-btn-ink'), s('hero-btn-bg')), T, label);
  gate('progress-fill/progress-track ≥ 3', cr(s('progress-fill'), s('progress-track')), 3, label);
  gate('tile glyph accent-ink/accent-fill-strong ≥ 3', cr(s('accent-ink'), s('accent-fill-strong')), 3, label);
  for (const n of ['accent-wash', 'accent-fill']) gate(`accent-ink/${n} (hero stops) ≥ ${T}`, cr(s('accent-ink'), s(n)), T, label);
  for (const n of ['text', 'text-2', 'text-3']) gate(`${n}/accent-wash ≥ ${T}`, cr(s(n), s('accent-wash')), T, label);
  gate('chevron-colour/fill-field ≥ 3', cr(s('chevron-colour'), s('fill-field')), 3, label);
  gate('switch-knob/switch-on ≥ 3', cr(s('switch-knob'), s('switch-on')), 3, label);
  for (const w of ['short', 'medium', 'long', 'closed']) gate(`wait-${w}-ink/wait-${w} ≥ ${T}`, cr(s(`wait-${w}-ink`), s(`wait-${w}`)), T, label);
  // glass
  const backs = { bg: s('bg'), surface: s('surface'), mid: MID, worst: scheme === 'light' ? BLACK : WHITE };
  for (const [bn, b] of Object.entries(backs)) {
    for (const g of ['glass', 'glass-strong']) {
      const gc = over(c(g), b);
      gate('text on glass (fill alone) ≥ 7', cr(txt, gc), 7, `${label}/${g}/${bn}`);
      gate(`text-2 on glass (fill alone) ≥ ${T}`, cr(t2, gc), T, `${label}/${g}/${bn}`);
      if (bn !== 'worst') gate(`text-3 on glass ≥ ${T}`, cr(t3, gc), T, `${label}/${g}/${bn}`);
    }
    const sheen = g => over(c('glass-spec'), over(c(g), b));
    gate('text under full sheen, glass-strong ≥ 7', cr(txt, sheen('glass-strong')), 7, `${label}/${bn}`);
    gate(`text-2 under full sheen, glass-strong ≥ ${T}`, cr(t2, sheen('glass-strong')), T, `${label}/${bn}`);
    if (bn !== 'worst') {
      gate('text under full sheen, glass ≥ 7', cr(txt, sheen('glass')), 7, `${label}/${bn}`);
      gate(`text-2 under full sheen, glass ≥ ${T}`, cr(t2, sheen('glass')), T, `${label}/${bn}`);
      const gs = over(c('glass-strong'), b);
      for (const n of ['status-offline', 'status-pending', 'status-synced', 'status-error', 'map-north']) gate('status dots + map-north on glass-strong ≥ 3', cr(s(n), gs), 3, `${label}/${bn}/${n}`);
      gate(`tab label accent-ink on glass-strong ≥ ${T}`, cr(s('accent-ink'), gs), T, `${label}/${bn}`);
      gate('tab icon accent-graphic on glass-strong ≥ 3', cr(s('accent-graphic'), gs), 3, `${label}/${bn}`);
      gate(`sel-ink on sel-fill in the bar ≥ ${T}`, cr(s('sel-ink'), over(c('sel-fill'), gs)), T, `${label}/${bn}`);
    }
    gate('toast-ink over toast ≥ 7', cr(s('toast-ink'), over(c('toast-bg'), b)), 7, `${label}/${bn}`);
    gate(`toast-ink-2 over toast ≥ ${T}`, cr(s('toast-ink-2'), over(c('toast-bg'), b)), T, `${label}/${bn}`);
    gate('glass-inverse-ink over glass-inverse ≥ 4.5', cr(s('glass-inverse-ink'), over(c('glass-inverse'), b)), 4.5, `${label}/${bn}`);
  }
  // families, per palette x mode (the accent does not change them)
  if (accent === 'graphite') {
    for (const f of FAM) {
      const F = n => s(`${f}-${n}`); const semantic = SEM.includes(f);
      gate(`family ink/fill ≥ ${T}`, cr(F('ink'), F('fill')), T, `${label}/${f}`);
      gate(`family ink/wash ≥ ${T}`, cr(F('ink'), F('wash')), T, `${label}/${f}`);
      gate('family ink-hi/fill ≥ 7', cr(F('ink-hi'), F('fill')), 7, `${label}/${f}`);
      gate('family ink/fill-strong (tile glyph) ≥ 3', cr(F('ink'), F('fill-strong')), 3, `${label}/${f}`);
      gate(semantic ? 'semantic on/strong ≥ 4.5 (AA by design)' : `person on/strong ≥ ${T}`, cr(F('on'), F('strong')), semantic ? 4.5 : T, `${label}/${f}`);
      gate('family strong/fill (progress) ≥ 3', cr(F('strong'), F('fill')), 3, `${label}/${f}`);
      for (const b of OPAQUE) {
        gate(`family ink/opaque ≥ ${T}`, cr(F('ink'), s(b)), T, `${label}/${f}/${b}`);
        gate('family ink-hi/opaque ≥ 7', cr(F('ink-hi'), s(b)), 7, `${label}/${f}/${b}`);
        gate(semantic ? 'semantic strong/opaque ≥ 3' : `person strong as text/opaque ≥ ${T}`, cr(F('strong'), s(b)), semantic ? 3 : T, `${label}/${f}/${b}`);
        gate('family graphic/opaque ≥ 3', cr(F('graphic'), s(b)), 3, `${label}/${f}/${b}`);
      }
      if (scheme === 'dark') gate('dark chip fill/card ≥ 1.5', cr(F('fill'), s('surface')), 1.5, `${label}/${f}`);
    }
    gate('semantic success vs danger strong luminance ≥ 1.3', cr(s('success-strong'), s('danger-strong')), 1.3, label);
    gate('semantic warning vs danger strong luminance ≥ 1.3', cr(s('warning-strong'), s('danger-strong')), 1.3, label);
    for (const se of SEM) for (const p of PEOPLE) gate('semantic graphic vs person graphic ΔE00 ≥ 10', de00(s(`${se}-graphic`), s(`${p}-graphic`)), 10, `${label}/${se}/${p}`);
    gate(`surface off bg ≥ ${scheme === 'dark' ? 1.2 : 1.05}`, cr(s('surface'), s('bg')), scheme === 'dark' ? 1.2 : 1.05, label);
    if (scheme === 'dark') for (const w of ['surface-2', 'fill-field', 'surface-raised']) gate('dark wells/sheet lighter than the card', lum(s(w)) > lum(s('surface')) ? 1 : 0, 1, `${label}/${w}`);
    if (mode.startsWith('kiosk')) {
      const photos = [WHITE, BLACK, MID, ...FAM.flatMap(f => [s(`${f}-fill`), s(`${f}-fill-strong`)])];
      for (const ph of photos) { const pc = over(c('tv-panel'), ph); gate('tv-text over tv-panel over any photo ≥ 7', cr(s('tv-text'), pc), 7, `${label}/${hex(ph)}`); gate('tv-text-2 over tv-panel ≥ 4.5', cr(s('tv-text-2'), pc), 4.5, `${label}/${hex(ph)}`); }
    }
  }
  if (mode.startsWith('reduce') || mode === 'kiosk+reduce-transparency') for (const g of ['glass', 'glass-strong', 'glass-look']) gate('Reduce Transparency: glass is opaque', c(g).a >= 0.999 ? 1 : 0, 1, `${label}/${g}`);
}

const ALL = [];
for (const theme of Object.keys(THEMES)) for (const accent of PEOPLE) for (const mode of Object.keys(MODES)) {
  const X = ctx(theme, accent, mode); ALL.push({ theme, accent, mode, X }); gateContext(X, theme, accent, mode);
}
// CVD: person graphics (gated at 10, normal/protan/deutan), fills reported
const cvd = {};
for (const theme of Object.keys(THEMES)) {
  const X = ctx(theme, 'graphite', 'adult');
  for (const role of ['graphic', 'fill']) for (const v of ['normal', 'protan', 'deutan', 'tritan']) {
    const set = role === 'graphic' ? PEOPLE : HUES; let m = Infinity, pr = '';
    for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
      const d = de00(sim(X.s(`${set[i]}-${role}`), v), sim(X.s(`${set[j]}-${role}`), v));
      if (d < m) { m = d; pr = `${set[i]}/${set[j]}`; }
      if (role === 'graphic' && v !== 'tritan') gate(`CVD person graphics ${v} ΔE00 ≥ 10`, d, 10, `${theme}/${set[i]}/${set[j]}`);
    }
    const k = `${THEMES[theme]}/${role}/${v}`; if (!cvd[k] || m < cvd[k].v) cvd[k] = { v: m, at: `${theme}: ${pr}` };
  }
}

// ═════════════ 6. recompute every stated number ═════════════
const claims = [];
const fl = (v, d = 2) => Math.floor(v * 10 ** d + 1e-9) / 10 ** d;
function claim(where, stated, trueV, { tol = 0.05, bound = true, dp = 2, at = '' } = {}) {
  const s = Number(stated);
  const diff = s - trueV;
  const within = Math.abs(diff) <= tol + 1e-9;
  const notAbove = !bound || s <= trueV + 1e-9;
  claims.push({ where, stated: s, true: +trueV.toFixed(dp + 2), at, ok: within && notAbove, within, notAbove });
}
const claimHex = (where, stated, trueHex) => claims.push({ where, stated, true: trueHex, ok: stated.toUpperCase() === trueHex.toUpperCase(), within: true, notAbove: true });
const byTheme = (list, fn) => { let m = Infinity, at = ''; for (const t of list) { const v = fn(ctx(t, 'graphite', 'adult'), t); if (v < m) { m = v; at = t; } } return { v: m, at }; };
const num = x => parseFloat(String(x).replace(/[^\d.]/g, ''));
const mdRows = (startHeading, first) => { const i = MD.indexOf(startHeading); const lines = MD.slice(i).split('\n'); const out = []; let seen = false; for (const l of lines) { if (l.startsWith('|')) { seen = true; out.push(l.split('|').slice(1, -1).map(x => x.trim())); } else if (seen && out.length > 2) break; } return out.slice(2); };

// §2.1 light table
{
  const rows = mdRows('#### 2.1', 'Family');
  for (const r of rows) {
    const f = r[0].split(' ')[0].toLowerCase(); if (!FAM.includes(f)) continue;
    const L = t => ctx(t, 'graphite', 'adult'); const F = (X, n) => X.s(`${f}-${n}`);
    const X0 = L('hearth');
    claimHex(`§2.1 light ${f} fill`, r[1], hex(F(X0, 'fill'))); claimHex(`§2.1 light ${f} ink`, r[2], hex(F(X0, 'ink')));
    claimHex(`§2.1 light ${f} ink-hi`, r[6], hex(F(X0, 'ink-hi'))); claimHex(`§2.1 light ${f} fill-strong`, r[8], hex(F(X0, 'fill-strong')));
    claimHex(`§2.1 light ${f} strong`, r[10], hex(F(X0, 'strong'))); claimHex(`§2.1 light ${f} graphic`, r[13], hex(F(X0, 'graphic')));
    const m = fn => byTheme(LIGHT, X => fn(X));
    const cols = [[3, X => cr(F(X, 'ink'), F(X, 'fill')), 'ink/fill'], [4, X => cr(F(X, 'ink'), F(X, 'wash')), 'ink/wash'], [5, X => Math.min(...OPAQUE.map(b => cr(F(X, 'ink'), X.s(b)))), 'ink/surfaces'],
      [7, X => cr(F(X, 'ink-hi'), F(X, 'fill')), 'ink-hi/fill'], [9, X => cr(F(X, 'ink'), F(X, 'fill-strong')), 'ink/fill-strong'], [11, X => cr(F(X, 'on'), F(X, 'strong')), 'on/strong'],
      [12, X => Math.min(...OPAQUE.map(b => cr(F(X, 'strong'), X.s(b)))), 'strong/surfaces'], [14, X => Math.min(...OPAQUE.map(b => cr(F(X, 'graphic'), X.s(b)))), 'graphic/surfaces']];
    for (const [i, fn, nm] of cols) { const t = m(fn); claim(`§2.1 light ${f} ${nm}`, num(r[i]), t.v, { at: t.at }); }
    if (r[15] !== '—') claim(`§2.1 light ${f} fill C`, num(r[15]), oklchC(F(X0, 'fill')), { tol: 0.002, dp: 3 });
  }
  const drows = mdRows('**Dark (Midnight', 'Family');
  for (const r of drows) {
    const f = r[0].split(' ')[0].toLowerCase(); if (!FAM.includes(f)) continue;
    const F = (X, n) => X.s(`${f}-${n}`); const X0 = ctx('midnight', 'graphite', 'adult');
    claimHex(`§2.1 dark ${f} fill`, r[1].replace(/\s*↑/, ''), hex(F(X0, 'fill'))); claimHex(`§2.1 dark ${f} ink`, r[3], hex(F(X0, 'ink')));
    claimHex(`§2.1 dark ${f} ink-hi`, r[6], hex(F(X0, 'ink-hi'))); claimHex(`§2.1 dark ${f} fill-strong`, r[7], hex(F(X0, 'fill-strong')));
    claimHex(`§2.1 dark ${f} strong`, r[9], hex(F(X0, 'strong'))); claimHex(`§2.1 dark ${f} on`, r[10], hex(F(X0, 'on'))); claimHex(`§2.1 dark ${f} graphic`, r[13], hex(F(X0, 'graphic')));
    const m = fn => byTheme(DARK, X => fn(X));
    const cols = [[2, X => cr(F(X, 'fill'), X.s('surface')), 'fill/card'], [4, X => cr(F(X, 'ink'), F(X, 'fill')), 'ink/fill'], [5, X => Math.min(...OPAQUE.map(b => cr(F(X, 'ink'), X.s(b)))), 'ink/surfaces'],
      [8, X => cr(F(X, 'ink'), F(X, 'fill-strong')), 'ink/fill-strong'], [11, X => cr(F(X, 'on'), F(X, 'strong')), 'on/strong'],
      [12, X => Math.min(...OPAQUE.map(b => cr(F(X, 'strong'), X.s(b)))), 'strong/surfaces'], [14, X => Math.min(...OPAQUE.map(b => cr(F(X, 'graphic'), X.s(b)))), 'graphic/surfaces']];
    for (const [i, fn, nm] of cols) { const t = m(fn); claim(`§2.1 dark ${f} ${nm}`, num(r[i]), t.v, { at: t.at }); }
    if (r[15] !== '—') claim(`§2.1 dark ${f} fill C`, num(r[15]), oklchC(F(X0, 'fill')), { tol: 0.002, dp: 3 });
  }
  // washes
  const wl = MD.match(/Washes \(`-wash`[^\n]*/)[0];
  for (const f of PEOPLE) { const m = wl.match(new RegExp(f[0].toUpperCase() + f.slice(1) + ' (#[0-9A-F]{6})')); claimHex(`§2.1 light ${f} wash`, m[1], hex(ctx('hearth', 'graphite', 'adult').s(`${f}-wash`))); }
  // dark prose: ink on chip >= 6.86, ink-hi >= 8.35 (true 8.356)
  const dk = byTheme(DARK, X => Math.min(...PEOPLE.map(f => cr(X.s(`${f}-ink`), X.s(`${f}-fill`)))));
  claim('§2.1 dark ink on its own chip ≥ 6.86', 6.86, dk.v);
  const dkh = byTheme(DARK, X => Math.min(...FAM.map(f => cr(X.s(`${f}-ink-hi`), X.s(`${f}-fill`)))));
  claim('§2.1 dark ink-hi on fill ≥ 8.35 (all 12 families; success is 8.350)', 8.35, dkh.v);
  const dkhP = byTheme(DARK, X => Math.min(...PEOPLE.map(f => cr(X.s(`${f}-ink-hi`), X.s(`${f}-fill`))))); claim('§2.1 dark ink-hi true minimum 8.356 (the nine person families of the table)', 8.356, dkhP.v, { tol: 0.0015, bound: false, dp: 3 });
  claim('§2.1 dark chips ≥ 1.52 off every card', 1.52, byTheme(DARK, X => Math.min(...PEOPLE.map(f => cr(X.s(`${f}-fill`), X.s('surface'))))).v);
}
// §2.2 semantic
{
  const H = ctx('hearth', 'graphite', 'adult'), M = ctx('midnight', 'graphite', 'adult');
  const rows = mdRows('#### 2.2 Semantic', 'Role');
  for (const r of rows) {
    const f = r[0].split(' ')[0].toLowerCase(); if (!SEM.includes(f)) continue;
    for (const [col, X, sch] of [[1, H, 'light'], [2, M, 'dark']]) {
      const [fill, rest] = [r[col].split(' / ')[0], r[col].split(' / ').slice(1)];
      const ink = rest[0].split(' ')[0], ratio = num(rest[0].split('(')[1]), strong = rest[1].replace(/\*/g, ''), graphic = rest[2].replace(/\*/g, '');
      claimHex(`§2.2 ${sch} ${f} fill`, fill.replace(/\s*↑/, ''), hex(X.s(`${f}-fill`))); claimHex(`§2.2 ${sch} ${f} ink`, ink, hex(X.s(`${f}-ink`)));
      claimHex(`§2.2 ${sch} ${f} strong`, strong, hex(X.s(`${f}-strong`))); claimHex(`§2.2 ${sch} ${f} graphic`, graphic, hex(X.s(`${f}-graphic`)));
      const t = byTheme(sch === 'light' ? LIGHT : DARK, Y => cr(Y.s(`${f}-ink`), Y.s(`${f}-fill`)));
      claim(`§2.2 ${sch} ${f} ink/fill`, ratio, t.v);
    }
  }
  const all = ALL.filter(a => a.mode === 'adult' && a.accent === 'graphite');
  const badge = (fn) => { let m = Infinity, at = ''; for (const a of all) { const v = fn(a.X); if (v < m) { m = v; at = a.theme; } } return { v: m, at }; };
  const bl = badge(X => cr(X.s('badge-ink'), X.s('badge-bg')));
  claim('§2.2 badge label 6.42', 6.42, bl.v, { at: bl.at });
  for (const [b, st, nm] of [['surface', 6.00, 'card'], ['surface-raised', 5.28, 'sheet'], ['bg', 7.35, 'page']]) { const t = badge(X => cr(X.s('badge-bg'), X.s(b))); claim(`§2.2/§2.5 badge vs ${nm} ≥ ${st}`, st, t.v, { at: t.at }); }
  claim('§2.2 badge vs card true minimum 6.004', 6.004, badge(X => cr(X.s('badge-bg'), X.s('surface'))).v, { tol: 0.0015, bound: false, dp: 3 });
  const lr = badge(X => Math.min(cr(X.s('success-strong'), X.s('danger-strong')), cr(X.s('warning-strong'), X.s('danger-strong'))));
  claim('§2.2 semantic luminance ratio lowest 1.57', 1.57, lr.v, { at: lr.at });
  let de = { v: Infinity };
  for (const a of all) for (const se of SEM) for (const p of PEOPLE) { const v = de00(a.X.s(`${se}-graphic`), a.X.s(`${p}-graphic`)); if (v < de.v) de = { v, at: `${a.theme} ${se}/${p}` }; }
  claim('§2.2 semantic vs person ≥ 10.74 ΔE00 (success vs Mint, light)', 10.74, de.v, { at: de.at });
  const sc = (sch, a, b, v) => de00(sim((sch === 'light' ? H : M).s(`${a}-graphic`), v), sim((sch === 'light' ? H : M).s(`${b}-graphic`), v));
  claim('§2.2 success vs warning protanopia (light) 3.9', 3.9, sc('light', 'success', 'warning', 'protan'), { tol: 0.05, bound: false, dp: 1 });
  claim('§2.2 success vs danger deuteranopia (dark) 8.6', 8.6, sc('dark', 'success', 'danger', 'deutan'), { tol: 0.05, bound: false, dp: 1 });
}
// §2.2a 7:1 modes table
{
  const run = (modes, fn) => { let m = Infinity, at = ''; for (const a of ALL) if (modes.includes(a.mode)) { const v = fn(a.X, a); if (v < m) { m = v; at = a.X.label; } } return { v: m, at }; };
  const HIM = ['kiosk', 'contrast-more', 'contrast-more (media)', 'kiosk+reduce-transparency'];
  const t2 = X => Math.min(...OPAQUE.map(b => cr(X.s('text-2'), X.s(b)))), t3 = X => Math.min(...OPAQUE.map(b => cr(X.s('text-3'), X.s(b))));
  claim('§2.2a text-2 adult ≥ 7.50', 7.50, run(['adult'], t2).v); claim('§2.2a text-3 adult ≥ 5.07', 5.07, run(['adult'], t3).v);
  const h23 = run(HIM, X => Math.min(t2(X), t3(X))); claim('§2.2a text-2/3 in 7:1 modes ≥ 10.38', 10.38, h23.v, { at: h23.at });
  const inks = X => Math.min(...FAM.flatMap(f => [cr(X.s(`${f}-ink`), X.s(`${f}-fill`)), ...OPAQUE.map(b => cr(X.s(`${f}-ink`), X.s(b)))]));
  const ia = run(['adult'], inks); claim('§2.2a hue inks on fills + surfaces adult ≥ 5.03', 5.03, ia.v, { at: ia.at });
  const ih = run(HIM, inks); claim('§2.2a hue inks on fills + surfaces 7:1 ≥ 7.01', 7.01, ih.v, { at: ih.at });
  const leg = X => Math.min(...OPAQUE.map(b => cr(X.s('accent'), X.s(b))));
  const la = run(['adult'], leg); claim('§2.2a legacy --accent text adult ≥ 4.58', 4.58, la.v, { at: la.at });
  const lh = run(HIM, leg); claim('§2.2a legacy --accent text 7:1 ≥ 7.28', 7.28, lh.v, { at: lh.at });
  const btn = X => Math.min(cr(X.s('accent-on'), X.s('accent-strong')), cr(X.s('sel-ink-strong'), X.s('sel-fill-strong')));
  const ba = run(['adult'], btn); claim('§2.2a primary-button label adult ≥ 5.90', 5.90, ba.v, { at: ba.at });
  const bh = run(HIM, btn); claim('§2.2a primary-button label 7:1 ≥ 9.37', 9.37, bh.v, { at: bh.at });
  const hero = (X, a) => THEMES[a.theme] === 'dark' ? cr(X.s('hero-btn-ink'), X.s('hero-btn-bg')) : Infinity;
  const ha = run(['adult'], hero); claim('§2.2a/§2.4 dark hero button adult ≥ 6.86', 6.86, ha.v, { at: ha.at });
  const hh = run(HIM, hero); claim('§2.2a/§2.4 dark hero button 7:1 ≥ 8.35', 8.35, hh.v, { at: hh.at });
  const hall = run(HIM, X => cr(X.s('hero-btn-ink'), X.s('hero-btn-bg'))); claims.push({ where: 'info: hero button in 7:1 modes, light + dark', stated: null, true: +hall.v.toFixed(3), at: hall.at, ok: true, info: true });
  const bda = run(['adult'], X => cr(X.s('badge-ink'), X.s('badge-bg'))); claim('§2.2a badge label adult 6.42', 6.42, bda.v, { at: bda.at });
  const bdh = run(HIM, X => cr(X.s('badge-ink'), X.s('badge-bg'))); claim('§2.2a badge label 7:1 10.73', 10.73, bdh.v, { at: bdh.at });
  const bds = run(HIM, X => Math.min(...PCS.map(b => cr(X.s('badge-bg'), X.s(b))))); claim('§2.2a badge ≥ 8.34 on every page, card, sheet (7:1)', 8.34, bds.v, { at: bds.at });
  const backs = (X, a) => [X.s('bg'), X.s('surface'), MID, THEMES[a.theme] === 'light' ? BLACK : WHITE];
  const toast2 = (X, a) => Math.min(...backs(X, a).map(b => cr(X.s('toast-ink-2'), over(X.c('toast-bg'), b))));
  const toast1 = (X, a) => Math.min(...backs(X, a).map(b => cr(X.s('toast-ink'), over(X.c('toast-bg'), b))));
  // "over every backdrop": also sweep white/black for both schemes
  const toastAny = (n) => (X) => Math.min(...[X.s('bg'), X.s('surface'), MID, BLACK, WHITE].map(b => cr(X.s(n), over(X.c('toast-bg'), b))));
  const t2a = run(['adult'], toastAny('toast-ink-2')); claim('§2.2a/§2.5 toast-ink-2 adult ≥ 6.58 (every backdrop)', 6.58, t2a.v, { at: t2a.at });
  const t2h = run(HIM, toastAny('toast-ink-2')); claim('§2.2a toast-ink-2 7:1 ≥ 10.02', 10.02, t2h.v, { at: t2h.at });
  const t1 = run(Object.keys(MODES), toastAny('toast-ink')); claim('§2.5 toast ink ≥ 10.02', 10.02, t1.v, { at: t1.at });
  const semOn = X => Math.min(...SEM.map(f => cr(X.s(`${f}-on`), X.s(`${f}-strong`))));
  claim('§2.2a semantic on/strong adult ≥ 4.76', 4.76, run(['adult'], semOn).v); claim('§2.2a semantic on/strong 7:1 ≥ 4.76', 4.76, run(HIM, semOn).v);
  // swapping the semantic solids collapses warning vs danger to 1.00
  const H = ctx('hearth', 'graphite', 'adult'); claim('§2.2a swapped semantic solids: warning vs danger 1.00', 1.00, Math.min(cr(H.s('warning-ink-hi'), H.s('danger-ink-hi')), cr(ctx('midnight', 'graphite', 'adult').s('warning-ink-hi'), ctx('midnight', 'graphite', 'adult').s('danger-ink-hi'))), { bound: false });
}
// §2.3 neutrals
{
  const rows = mdRows('#### 2.3 Neutrals', 'Token');
  const order = ['hearth', 'parchment', 'frost', 'midnight', 'forest', 'graphite'];
  const row = k => rows.find(r => r[0].includes(k));
  order.forEach((t, i) => {
    const X = ctx(t, 'graphite', 'adult'), cell = j => row(j)[i + 1];
    claimHex(`§2.3 ${t} --bg`, cell('`--bg`'), hex(X.s('bg'))); claimHex(`§2.3 ${t} --surface`, cell('`--surface` (card)'), hex(X.s('surface')));
    claimHex(`§2.3 ${t} --surface-2`, cell('`--surface-2`').match(/#[0-9A-F]{6}/)[0], hex(X.s('surface-2')));
    const ff = cell('`--surface-2`').match(/#[0-9A-F]{6}/g); if (ff[1]) claimHex(`§2.3 ${t} --fill-field`, ff[1], hex(X.s('fill-field')));
    claimHex(`§2.3 ${t} --surface-raised`, cell('`--surface-raised`'), hex(X.s('surface-raised')));
    const tx = cell('`--text` / on page'); claimHex(`§2.3 ${t} --text`, tx.match(/#[0-9A-F]{6}/)[0], hex(X.s('text'))); claim(`§2.3 ${t} text/page`, num(tx.split('/').pop()), cr(X.s('text'), X.s('bg')));
    const t2 = cell('`--text-2` / lowest'); claimHex(`§2.3 ${t} --text-2`, t2.match(/#[0-9A-F]{6}/)[0], hex(X.s('text-2'))); claim(`§2.3 ${t} text-2 lowest opaque`, num(t2.split('/').pop()), Math.min(...OPAQUE.map(b => cr(X.s('text-2'), X.s(b)))));
    const t3 = cell('`--text-3`'); claimHex(`§2.3 ${t} --text-3`, t3.match(/#[0-9A-F]{6}/)[0], hex(X.s('text-3'))); claim(`§2.3 ${t} text-3 lowest opaque`, num(t3.split('/').pop()), Math.min(...OPAQUE.map(b => cr(X.s('text-3'), X.s(b)))));
    claimHex(`§2.3 ${t} --text-2-hi`, cell('`--text-2-hi`'), hex(X.s('text-2-hi')));
    const worst = THEMES[t] === 'light' ? BLACK : WHITE;
    claim(`§2.3 ${t} text-2 on glass over worst (fill alone)`, num(cell('`--text-2` on light glass')), cr(X.s('text-2'), over(X.c('glass'), worst)));
    const fb = cell('`--field-border`'); claimHex(`§2.3 ${t} --field-border`, fb.match(/#[0-9A-F]{6}/)[0], hex(X.s('field-border'))); claim(`§2.3 ${t} field-border lowest`, num(fb.split('/').pop()), Math.min(...OPAQUE.map(b => cr(X.s('field-border'), X.s(b)))));
    claim(`§2.3 ${t} card ÷ page`, num(cell('Card ÷ page').replace(/\(was.*\)/, '')), cr(X.s('surface'), X.s('bg')));
    const ga = cell('Glass / glass-strong alpha'); const [a1, a2] = ga.match(/\d+/g).map(Number);
    claims.push({ where: `§2.3 ${t} glass alpha ${a1}/${a2}`, stated: `${a1}/${a2}`, true: `${X.raw('glass-alpha')}/${X.raw('glass-alpha-strong')}`, ok: `${a1}%` === X.raw('glass-alpha') && `${a2}%` === X.raw('glass-alpha-strong') });
    const spec = ga.match(/\.(\d+)/); claims.push({ where: `§2.3 ${t} glass-spec alpha .${spec[1]}`, stated: '.' + spec[1], true: X.c('glass-spec').a, ok: Math.abs(X.c('glass-spec').a - parseFloat('0.' + spec[1])) < 1e-6 });
  });
  const lf = byTheme(LIGHT, X => cr(X.s('surface'), X.s('bg'))), df = byTheme(DARK, X => cr(X.s('surface'), X.s('bg')));
  claim('verification card ÷ page 1.11 light', 1.11, lf.v, { at: lf.at }); claim('verification card ÷ page 1.20 dark', 1.20, df.v, { at: df.at });
  // --line-soft → --separator composited over its own page or card
  let sm = { v: Infinity }, sM = { v: -Infinity }; const lightSep = [];
  for (const t of Object.keys(THEMES)) { const X = ctx(t, 'graphite', 'adult'); for (const b of ['bg', 'surface']) { const v = cr(over(X.c('separator'), X.s(b)), X.s(b)); if (v < sm.v) sm = { v, at: `${t}/${b}` }; if (v > sM.v) sM = { v, at: `${t}/${b}` }; if (THEMES[t] === 'light') lightSep.push(v); } }
  claim('migration --line-soft ≈ 1.27 low (Graphite page)', 1.27, sm.v, { at: sm.at }); claim('migration --line-soft ≈ 1.44 high (Forest card)', 1.44, sM.v, { at: sM.at, bound: false });
  claims.push({ where: 'info: --separator light palettes range', stated: '≈1.3', true: `${Math.min(...lightSep).toFixed(2)}-${Math.max(...lightSep).toFixed(2)}`, ok: Math.min(...lightSep) >= 1.25 && Math.max(...lightSep) <= 1.35, info: true });
}
// §2.4 accent matrix
{
  const rows = mdRows('#### 2.4 Profile accents', 'Family');
  const adult = ALL.filter(a => a.mode === 'adult');
  for (const r of rows) {
    const f = r[0].toLowerCase(); if (!PEOPLE.includes(f)) continue;
    const my = adult.filter(a => a.accent === f);
    const m = fn => { let v = Infinity, at = ''; for (const a of my) { const x = fn(a.X); if (x < v) { v = x; at = a.theme; } } return { v, at }; };
    const A = (X, n) => X.s('accent-' + n);
    const cols = [[1, X => cr(A(X, 'ink'), X.s('surface')), 'ink/card'], [2, X => cr(A(X, 'ink'), X.s('bg')), 'ink/page'], [3, X => cr(A(X, 'ink'), A(X, 'fill')), 'ink/fill'], [4, X => cr(A(X, 'on'), A(X, 'strong')), 'on/strong'],
      [5, X => cr(X.s('accent'), X.s('bg')), 'strong as text/page'], [6, X => cr(A(X, 'graphic'), X.s('bg')), 'graphic/page'], [7, X => cr(X.s('hero-btn-ink'), X.s('hero-btn-bg')), 'hero button'],
      [8, X => cr(A(X, 'ink'), over(X.c('glass-strong'), MID)), 'tab label on glass-strong over #767676']];
    for (const [i, fn, nm] of cols) { const t = m(fn); claim(`§2.4 ${f} ${nm}`, num(r[i].split('(')[0]), t.v, { at: t.at }); }
    const dm = r[6].match(/dark ([\d.]+) on card/);
    if (dm) { const t = (() => { let v = Infinity, at = ''; for (const a of my) if (THEMES[a.theme] === 'dark') { const x = cr(A(a.X, 'graphic'), a.X.s('surface')); if (x < v) { v = x; at = a.theme; } } return { v, at }; })(); claim(`§2.4 ${f} dark graphic on card`, num(dm[1]), t.v, { at: t.at }); }
  }
  const run = fn => { let m = Infinity, at = ''; for (const a of adult) { const v = fn(a.X, a); if (v < m) { m = v; at = a.X.label; } } return { v: m, at }; };
  const fr = run(X => Math.min(...OPAQUE.flatMap(b => [cr(X.s('focus-ring-color'), X.s(b)), cr(X.s('today-ring'), X.s(b))]))); claim('§2.4/§2.5 focus + today rings ≥ 3.13 on every surface', 3.13, fr.v, { at: fr.at });
  const frAll = (() => { let m = Infinity, at = ''; for (const a of ALL) { const v = Math.min(...OPAQUE.map(b => cr(a.X.s('focus-ring-color'), a.X.s(b)))); if (v < m) { m = v; at = a.X.label; } } return { v: m, at }; })();
  claims.push({ where: 'info: focus ring every mode', stated: null, true: +frAll.v.toFixed(3), at: frAll.at, ok: true, info: true });
  const sl = run(X => cr(X.s('sel-ink'), X.s('sel-fill'))); claim('§2.4 selected label on its pill ≥ 5.03', 5.03, sl.v, { at: sl.at });
  const pr = run(X => cr(X.s('progress-fill'), X.s('progress-track'))); claim('§2.4 progress fill on track ≥ 4.00', 4.00, pr.v, { at: pr.at }); claim('§2.4 progress true minimum 4.005', 4.005, pr.v, { tol: 0.0015, bound: false, dp: 3, at: pr.at });
  const hl = run((X, a) => THEMES[a.theme] === 'light' ? cr(X.s('hero-btn-ink'), X.s('hero-btn-bg')) : Infinity); claim('ACCENT-4 hero button ≥ 6.58 (all)', 6.58, Math.min(hl.v, run(X => cr(X.s('hero-btn-ink'), X.s('hero-btn-bg'))).v), { at: hl.at });
  // DARK-3
  const d3 = run((X, a) => THEMES[a.theme] === 'dark' ? cr(X.s('accent-ink'), X.s('surface')) : Infinity); claim('DARK-3 dark accent-ink ≥ 10.53 on cards', 10.53, d3.v, { at: d3.at });
  const d3g = run((X, a) => THEMES[a.theme] === 'dark' ? Math.min(...OPAQUE.map(b => cr(X.s('accent-graphic'), X.s(b)))) : Infinity); claim('DARK-3 dark accent-graphic ≥ 3.28', 3.28, d3g.v, { at: d3g.at });
  const ti = ((fn) => { let m = Infinity, at = ''; for (const a of ALL) { const v = fn(a.X); if (v < m) { m = v; at = a.X.label; } } return { v: m, at }; })(X => Math.min(...['bg', 'surface'].map(b => cr(X.s('accent-graphic'), over(X.c('glass-strong'), X.s(b)))), cr(X.s('accent-graphic'), over(X.c('glass-strong'), MID)))); claim('§7 tab icon without pickup ≥ 3.31', 3.31, ti.v, { at: ti.at });
  const tl = run(X => Math.min(...['bg', 'surface'].map(b => cr(X.s('accent-ink'), over(X.c('glass-strong'), X.s(b)))), cr(X.s('accent-ink'), over(X.c('glass-strong'), MID)))); claim('§7/verif tab label on glass ≥ 5.48', 5.48, tl.v, { at: tl.at });
  const tile = run(X => cr(X.s('accent-ink'), X.s('accent-fill-strong'))); claim('ICON-3/COLOR-9 tile glyph ≥ 3.26', 3.26, tile.v, { at: tile.at });
  const wash = run(X => Math.min(...['text', 'text-2', 'text-3'].map(n => cr(X.s(n), X.s('accent-wash'))))); claim('COLOR-4 / F260 body.nt text-3 on --accent-wash ≥ 5.48', 5.48, wash.v, { at: wash.at });
  const lg = run(X => Math.min(...OPAQUE.flatMap(b => [cr(X.s('accent-graphic'), X.s(b)), cr(X.s('timer-done'), X.s(b))]))); claim('verif large-text numerals 3.13', 3.13, lg.v, { at: lg.at });
}
// CVD table
{
  const rows = mdRows('**Colour-vision separation of the person graphics', 'Scheme');
  for (const r of rows) {
    const sch = r[0].startsWith('Light') ? 'light' : 'dark';
    const vals = [['normal', r[1]], ['protan', r[2]], ['deutan', r[3]], ['tritan', r[4]]];
    for (const [v, cell] of vals) { const t = cvd[`${sch}/graphic/${v}`]; claim(`§2.4 CVD ${sch} graphic ${v}`, num(cell.split('(')[0]), t.v, { at: t.at }); const nm = cell.match(/\(([^)]+)\)/); if (nm) claims.push({ where: `§2.4 CVD ${sch} graphic ${v} closest pair`, stated: nm[1], true: t.at, ok: t.at.toLowerCase().includes(nm[1].toLowerCase().split('/')[0]) && t.at.toLowerCase().includes(nm[1].toLowerCase().split('/')[1]) }); }
    const fc = r[5];
    for (const v of ['normal', 'protan', 'deutan']) { const m = fc.match(new RegExp(v + ' ([\\d.]+)(?: \\(([^)]+)\\))?')); const t = cvd[`${sch}/fill/${v}`]; claim(`§2.4 CVD ${sch} pastel fills ${v}`, num(m[1]), t.v, { at: t.at }); if (m[2]) claims.push({ where: `§2.4 CVD ${sch} fills ${v} closest pair`, stated: m[2], true: t.at, ok: m[2].toLowerCase().split('/').every(x => t.at.toLowerCase().includes(x)) }); }
  }
  const dichro = ['light', 'dark'].flatMap(s => ['protan', 'deutan'].map(v => cvd[`${s}/fill/${v}`].v));
  claim('§2.4 prose + ACCENT-8: dichromat fill minima low end 0.48', 0.48, Math.min(...dichro)); claim('§2.4 prose + ACCENT-8: dichromat fill minima high end 1.30', 1.30, Math.max(...dichro), { bound: false });
  const nf = ['light', 'dark'].map(s => cvd[`${s}/fill/normal`].v); claim('ACCENT-8: fills 7.24 low (normal)', 7.24, Math.min(...nf)); claim('ACCENT-8: fills 7.85 high (normal)', 7.85, Math.max(...nf), { bound: false });
  const g = Math.min(...['light', 'dark'].flatMap(s => ['protan', 'deutan'].map(v => cvd[`${s}/graphic/${v}`].v))); claim('ACCENT-8 / verif cvd graphics ≥ 11.02 under CVD', 11.02, g);
  // today's person colours (seed.sql) for the comparison sentence
  const today = ['#4F5D8C', '#BC5A38', '#8A6A4B', '#3D5A3D', '#5B8143', '#137F77', '#B4861B', '#4C4C58'].map(P);
  for (const [v, st] of [['protan', 4.8], ['deutan', 2.1]]) { let m = Infinity; for (let i = 0; i < today.length; i++) for (let j = i + 1; j < today.length; j++) m = Math.min(m, de00(sim(today[i], v), sim(today[j], v))); claim(`§2.4 today's person colours ${v} ${st}`, st, m, { bound: false, dp: 1 }); }
}
// §2.5 other roles + verification-table minima
{
  const run = (modes, fn) => { let m = Infinity, at = ''; for (const a of ALL) if (modes.includes(a.mode)) { const v = fn(a.X, a); if (v < m) { m = v; at = a.X.label; } } return { v: m, at }; };
  const ALLM = Object.keys(MODES), AD = ['adult'];
  const so = run(ALLM, X => cr(X.s('switch-on'), X.s('surface'))); claim('§2.5 switch on ≥ 3.93 (vs the card, as contrast.mjs gates it)', 3.93, so.v, { at: so.at });
  const soAll = run(ALLM, X => Math.min(...OPAQUE.map(b => cr(X.s('switch-on'), X.s(b))))); claims.push({ where: 'info: switch-on vs every opaque surface (page, wells, sheet, hover)', stated: '≥ 3.93 (unqualified in §2.5)', true: +soAll.v.toFixed(3), at: soAll.at, ok: true, info: true });
  const sk = run(ALLM, X => cr(X.s('switch-knob'), X.s('switch-on'))); claim('§2.5 switch knob ≥ 4.02', 4.02, sk.v, { at: sk.at });
  const sr = run(ALLM, X => Math.min(...OPAQUE.map(b => cr(X.s('switch-off-ring'), X.s(b))))); claim('§2.5 switch ring ≥ 3.03', 3.03, sr.v, { at: sr.at });
  const st = run(ALLM, X => Math.min(...['status-offline', 'status-pending', 'status-synced', 'status-error'].flatMap(n => [X.s('bg'), X.s('surface'), MID].map(b => cr(X.s(n), over(X.c('glass-strong'), b)))))); claim('§2.5 status dots ≥ 3.28 on glass tab bar', 3.28, st.v, { at: st.at });
  const md = run(ALLM, X => Math.min(...OPAQUE.flatMap(b => ['muted-decor', 'cell-empty', 'field-border', 'track-info'].map(n => cr(X.s(n), X.s(b)))))); claim('§2.5/verif non-text 3.03 (field border, muted-decor, cell-empty)', 3.03, md.v, { at: md.at });
  const gi = run(ALLM, X => Math.min(...[X.s('bg'), X.s('surface'), MID, WHITE, BLACK].map(b => cr(X.s('glass-inverse-ink'), over(X.c('glass-inverse'), b))))); claim('§2.5 glass-inverse ≥ 6.52', 6.52, gi.v, { at: gi.at });
  const ss = run(ALLM, X => Math.min(...OPAQUE.map(b => cr(X.s('star-stroke'), X.s(b))))); claim('§2.5 star stroke ≥ 5.11 on every surface', 5.11, ss.v, { at: ss.at });
  const ssA = run(AD, X => Math.min(...OPAQUE.map(b => cr(X.s('star-stroke'), X.s(b))))); claims.push({ where: 'info: star stroke adult only', stated: null, true: +ssA.v.toFixed(3), at: ssA.at, ok: true, info: true });
  const ph = X => [WHITE, BLACK, MID, ...FAM.flatMap(f => [X.s(`${f}-fill`), X.s(`${f}-fill-strong`)])];
  const tv1 = run(ALLM, X => Math.min(...ph(X).map(p => cr(X.s('tv-text'), over(X.c('tv-panel'), p))))); claim('§2.5 tv-text ≥ 7.25', 7.25, tv1.v, { at: tv1.at });
  const tv2 = run(ALLM, X => Math.min(...ph(X).map(p => cr(X.s('tv-text-2'), over(X.c('tv-panel'), p))))); claim('§2.5 tv-text-2 ≥ 5.10', 5.10, tv2.v, { at: tv2.at });
  const bs = run(['adult'], X => Math.min(...['bg'].map(b => cr(X.s('badge-bg'), X.s(b))))); claim('§2.5 badge vs page ≥ 7.35 (adult)', 7.35, bs.v, { at: bs.at });
  const on12 = []; for (const t of ['hearth', 'midnight', 'forest', 'graphite', 'parchment', 'frost']) { const X = ctx(t, 'graphite', 'adult'); for (const f of FAM) on12.push(cr(X.s(`${f}-on`), X.s(`${f}-strong`))); }
  claim('TOK-1 --X-on range low 4.76', 4.76, Math.min(...on12)); claim('TOK-1 --X-on range high 10.19', 10.19, Math.max(...on12), { bound: false });
  const gr = run(AD, X => Math.min(...['warning', 'success', 'danger'].flatMap(f => OPAQUE.flatMap(b => [cr(X.s(`${f}-graphic`), X.s(b)), cr(X.s(`${f}-strong`), X.s(b))])), ...PEOPLE.flatMap(f => OPAQUE.map(b => cr(X.s(`${f}-graphic`), X.s(b)))), ...FAM.map(f => cr(X.s(`${f}-ink`), X.s(`${f}-fill-strong`)))));
  claim('verif graphic kind lowest 3.06 (warning graphic, Parchment page)', 3.06, gr.v, { at: gr.at });
  const grAll = run(ALLM, X => Math.min(...['warning', 'success', 'danger'].flatMap(f => OPAQUE.flatMap(b => [cr(X.s(`${f}-graphic`), X.s(b)), cr(X.s(`${f}-strong`), X.s(b))])), ...PEOPLE.flatMap(f => OPAQUE.map(b => cr(X.s(`${f}-graphic`), X.s(b)))), ...FAM.map(f => cr(X.s(`${f}-ink`), X.s(`${f}-fill-strong`)))));
  claims.push({ where: 'info: graphic kind, every mode', stated: null, true: +grAll.v.toFixed(3), at: grAll.at, ok: true, info: true });
  const hiT = run(ALLM, X => Math.min(...FAM.flatMap(f => [cr(X.s(`${f}-ink-hi`), X.s(`${f}-fill`)), ...OPAQUE.map(b => cr(X.s(`${f}-ink-hi`), X.s(b)))])));
  claim('verif text-hi lowest 7.01', 7.01, hiT.v, { at: hiT.at });
  // text minima
  const prim = run(ALLM, X => Math.min(...OPAQUE.map(b => cr(X.s('text'), X.s(b))))); claim('verif primary text on opaque 11.71', 11.71, prim.v, { at: prim.at });
  const worstOf = (X, a) => THEMES[a.theme] === 'light' ? BLACK : WHITE;
  const pg = run(ALLM, (X, a) => Math.min(...['glass', 'glass-strong'].map(g => cr(X.s('text'), over(X.c(g), worstOf(X, a)))))); claim('§7/verif primary on glass over worst, fill alone ≥ 7.01', 7.01, pg.v, { at: pg.at });
  const sg = run(ALLM, (X, a) => Math.min(...['glass', 'glass-strong'].map(g => cr(X.s('text-2'), over(X.c(g), worstOf(X, a)))))); claim('§7/verif secondary on glass over worst, fill alone ≥ 5.23', 5.23, sg.v, { at: sg.at });
  const sh = (X, g, b) => over(X.c('glass-spec'), over(X.c(g), b));
  const bk = (X, a) => [X.s('bg'), X.s('surface'), MID, worstOf(X, a)];
  const ps = run(ALLM, (X, a) => Math.min(...bk(X, a).map(b => cr(X.s('text'), sh(X, 'glass-strong', b))))); claim('§7/verif primary under full sheen, glass-strong ≥ 8.22', 8.22, ps.v, { at: ps.at });
  const ss2 = run(ALLM, (X, a) => Math.min(...bk(X, a).map(b => cr(X.s('text-2'), sh(X, 'glass-strong', b))))); claim('§7/verif secondary under full sheen, glass-strong ≥ 6.15', 6.15, ss2.v, { at: ss2.at });
  const pgl = run(ALLM, (X, a) => Math.min(...bk(X, a).slice(0, 3).map(b => cr(X.s('text'), sh(X, 'glass', b))))); claim('§7/verif primary under full sheen, --glass over page/card/#767676 ≥ 8.89', 8.89, pgl.v, { at: pgl.at });
  const sgl = run(ALLM, (X, a) => Math.min(...bk(X, a).slice(0, 3).map(b => cr(X.s('text-2'), sh(X, 'glass', b))))); claim('§7/verif secondary under full sheen, --glass over page/card/#767676 ≥ 6.62', 6.62, sgl.v, { at: sgl.at });
  const HIM = ['kiosk', 'contrast-more', 'contrast-more (media)', 'kiosk+reduce-transparency'];
  const sglh = run(HIM, (X, a) => Math.min(...bk(X, a).slice(0, 3).map(b => cr(X.s('text-2'), sh(X, 'glass', b))))); claim('§7 secondary under sheen on --glass ≥ 7 in the 7:1 modes (a threshold)', 7, sglh.v, { at: sglh.at, tol: Infinity });
  const wp = run(['adult', 'contrast-more'], (X, a) => cr(X.s('text'), sh(X, 'glass', worstOf(X, a)))); claim('§7 --glass over a white photo: primary 5.94 (reported)', 5.94, wp.v, { at: wp.at });
  const wp2 = run(['adult', 'contrast-more'], (X, a) => cr(X.s('text-2'), sh(X, 'glass', worstOf(X, a)))); claim('§7 --glass over a white photo: secondary 4.42 (reported)', 4.42, wp2.v, { at: wp2.at });
  const wpAll = run(ALLM, (X, a) => cr(X.s('text-2'), sh(X, 'glass', worstOf(X, a)))); claims.push({ where: 'info: --glass under sheen over worst, secondary, every mode', stated: null, true: +wpAll.v.toFixed(3), at: wpAll.at, ok: true, info: true });
  const t2p = run(ALLM, X => Math.min(...PCS.map(b => cr(X.s('text-2'), X.s(b))))); claim('verif secondary on page/card/sheet 8.13', 8.13, t2p.v, { at: t2p.at });
  const t2w = run(ALLM, X => Math.min(...WELLS.map(b => cr(X.s('text-2'), X.s(b))))); claim('verif secondary on wells 7.50', 7.50, t2w.v, { at: t2w.at });
  const t3 = run(ALLM, X => Math.min(...OPAQUE.flatMap(b => [cr(X.s('text-3'), X.s(b)), cr(X.s('placeholder'), X.s(b))]))); claim('verif/TOK-6 tertiary + placeholder 5.07', 5.07, t3.v, { at: t3.at });
  const inks = run(ALLM, X => Math.min(...FAM.map(f => cr(X.s(`${f}-ink`), X.s(`${f}-fill`))))); claim('verif hue inks on their fills 5.03', 5.03, inks.v, { at: inks.at });
  const giH = run(HIM, (X, a) => Math.min(...[X.s('bg'), X.s('surface'), X.s('surface-raised')].map(b => cr(X.s('glass-inverse-ink'), over(X.c('glass-inverse'), b)))));
  claims.push({ where: 'info: 7:1 modes: --glass-inverse-ink over glass-inverse over an ordinary page/card/sheet (§2.2a says everything else is >= 7)', stated: '≥ 7 implied', true: +giH.v.toFixed(3), at: giH.at, ok: giH.v >= 7, info: true });
  const tvH = run(['kiosk'], X => Math.min(...ph(X).map(p => cr(X.s('tv-text-2'), over(X.c('tv-panel'), p)))));
  claims.push({ where: 'info: kiosk: --tv-text-2 over the TV panel over album photos (§2.2a says everything else in the kiosk is >= 7)', stated: '≥ 7 implied', true: +tvH.v.toFixed(3), at: tvH.at, ok: tvH.v >= 7, info: true });
  const psl = run(HIM, X => Math.min(cr(X.s('accent-on'), X.s('accent-strong')), cr(X.s('sel-ink-strong'), X.s('sel-fill-strong')))); claim('verif person solid labels 9.37 (7:1)', 9.37, psl.v, { at: psl.at });
  const legAll = run(ALLM.filter(m => !HIM.includes(m)), X => Math.min(...OPAQUE.flatMap(b => ['accent', 'tint', 'accent-strong', 'accent-deep', 'tint-ink'].map(n => cr(X.s(n), X.s(b))))));
  claim('verif legacy 4.58 (--accent as text, Parchment/Lavender)', 4.58, legAll.v, { at: legAll.at });
  const chips = run(ALLM, (X, a) => THEMES[a.theme] === 'dark' ? Math.min(...FAM.map(f => cr(X.s(`${f}-fill`), X.s('surface')))) : Infinity); claim('COLOR-8/DARK-4 dark chips low 1.52', 1.52, chips.v, { at: chips.at });
  const perFam = PEOPLE.map(f => Math.min(...DARK.map(t => { const X = ctx(t, 'graphite', 'adult'); return cr(X.s(`${f}-fill`), X.s('surface')); })));
  claim('COLOR-8/DARK-4 dark chips high 1.58 (the highest per-family minimum)', 1.58, Math.max(...perFam));
  let chM = -Infinity; for (const t of DARK) { const X = ctx(t, 'graphite', 'adult'); for (const f of PEOPLE) chM = Math.max(chM, cr(X.s(`${f}-fill`), X.s('surface'))); }
  claims.push({ where: 'info: dark chip vs card, highest single value (the "1.52-1.58 off every card" range is of per-family minima)', stated: null, true: +chM.toFixed(3), ok: true, info: true });
  let dcM = -Infinity; for (const t of DARK) { const X = ctx(t, 'graphite', 'adult'); dcM = Math.max(dcM, cr(X.s('surface'), X.s('bg'))); } claim('COLOR-11 dark cards high 1.23', 1.23, dcM, { bound: false });
  let fc = Infinity; for (const t of ['hearth', 'midnight']) { const X = ctx(t, 'graphite', 'adult'); for (const f of HUES) fc = Math.min(fc, oklchC(X.s(`${f}-fill`))); } claim('verif fill C ≥ 0.056', 0.056, fc, { tol: 0.002, dp: 3 });
}
// §7 pickup table (reported upper bounds) and the 6 % cap
{
  const pick = (X, pct) => colour(`color-mix(in srgb, ${X.raw('accent-strong')} ${pct ?? X.raw('glass-pickup')}, transparent)`);
  const vals = { icon: {}, label: {} };
  for (const a of ALL) if (a.mode === 'adult' || a.mode === 'contrast-more') {
    const X = a.X; const worst = THEMES[a.theme] === 'light' ? BLACK : WHITE;
    for (const [bn, b] of [['page', X.s('bg')], ['mid', MID], ['worst', worst]]) {
      const bg = over(pick(X), over(X.c('glass-strong'), b));
      for (const [k, n] of [['icon', 'accent-graphic'], ['label', 'accent-ink']]) { const v = cr(X.s(n), bg); if (!vals[k][bn] || v < vals[k][bn].v) vals[k][bn] = { v, at: X.label }; }
    }
  }
  const st = { icon: [2.76, 2.41, 2.01], label: [5.10, 4.65, 4.20] };
  for (const k of ['icon', 'label']) ['page', 'mid', 'worst'].forEach((bn, i) => claim(`§7 pickup table tab ${k} over ${bn}`, st[k][i], vals[k][bn].v, { at: vals[k][bn].at }));
  claims.push({ where: '§7 lowest icon Forest/Lavender, lowest label Parchment/Mint', stated: 'forest/lavender; parchment/mint', true: `${vals.icon.worst.at}; ${vals.label.worst.at}`, ok: /forest\/lavender/.test(vals.icon.worst.at) && /parchment\/mint/.test(vals.label.worst.at) });
  const X = ctx('forest', 'lavender', 'adult'); const cap = cr(X.s('accent-graphic'), over(pick(X, '6%'), over(X.c('glass-strong'), MID)));
  claim('§7 pickup cap: 6 % keeps Forest/Lavender icon 3.00 over #767676', 3.00, cap, { at: 'forest/lavender' });
  let worstCap = { v: Infinity }; for (const a of ALL) if (a.mode === 'adult') { const v = cr(a.X.s('accent-graphic'), over(pick(a.X, '6%'), over(a.X.c('glass-strong'), MID))); if (v < worstCap.v) worstCap = { v, at: a.X.label }; }
  claims.push({ where: 'info: 6 % pickup cap, worst tab icon over #767676 across all palettes x people', stated: '≥ 3 implied', true: +worstCap.v.toFixed(3), at: worstCap.at, ok: worstCap.v >= 3, info: true });
}
// labelled legacy backgrounds (the named rules), as written and rewritten, every palette x person, adult
{
  const adult = ALL.filter(a => a.mode === 'adult');
  const m = fn => { let v = Infinity, at = ''; for (const a of adult) { const x = fn(a.X); if (x < v) { v = x; at = a.X.label; } } return { v, at }; };
  const mix = (X, a, p, b) => colour(`color-mix(in srgb, ${a} ${p}%, ${b})`);
  const r = (X, n) => X.raw(n);
  const icon = m(X => Math.min(...[22, 8].map(p => cr(X.s('tint'), mix(X, r(X, 'tint'), p, r(X, 'surface'))))));
  claim('migration .ds .app-icon as written ≥ 3.86', 3.86, icon.v, { at: icon.at });
  const ficon = m(X => cr(X.s('tint-ink'), mix(X, r(X, 'tint'), 14, r(X, 'surface')))); claim('migration .feed .ficon as written 5.03', 5.03, ficon.v, { at: ficon.at });
  const chip = m(X => cr(mix(X, r(X, 'tint'), 70, r(X, 'text')), mix(X, r(X, 'tint'), 14, r(X, 'surface')))); claim('migration .ds .person-chip as written ≥ 6.20', 6.20, chip.v, { at: chip.at });
  const badge = m(X => cr(WHITE, X.s('danger'))); claim('migration .ds .badge as written 1.48 (dark)', 1.48, badge.v, { at: badge.at, bound: false });
  const hero = m(X => Math.min(cr(X.s('on-accent'), mix(X, r(X, 'accent'), 70, 'white')), cr(X.s('on-accent'), X.s('accent')), cr(X.s('on-accent'), X.s('accent-deep'))));
  claim('migration .ds .hero as written 3.09', 3.09, hero.v, { at: hero.at, bound: false });
  const av = m(X => Math.min(...[30, 55].map(p => cr(X.s('text'), mix(X, r(X, 'tint'), p, r(X, 'surface')))))); claim('migration .ds .avatar as written 3.56', 3.56, av.v, { at: av.at, bound: false });
  const fab = m(X => Math.min(cr(X.s('on-accent'), mix(X, r(X, 'accent'), 60, 'white')), cr(X.s('on-accent'), X.s('accent')))); claim('migration template .fab-primary as written 2.55', 2.55, fab.v, { at: fab.at, bound: false });
  claim('migration .ds .badge after 6.42', 6.42, m(X => cr(X.s('badge-ink'), X.s('badge-bg'))).v);
  claim('migration .ds .hero after 5.03', 5.03, m(X => Math.min(cr(X.s('accent-ink'), X.s('accent-wash')), cr(X.s('accent-ink'), X.s('accent-fill')))).v);
  claim('migration .ds .avatar after 5.03', 5.03, m(X => cr(X.s('accent-ink'), X.s('accent-fill'))).v);
  claim('migration .fab-primary after 5.90', 5.90, m(X => cr(X.s('accent-on'), X.s('accent-strong'))).v);
}
// the no-data-theme dark root ("a document on today's hub.js"): the section says it resolves to Midnight's grounds
const noTheme = [];
for (const mode of Object.keys(MODES)) for (const accent of ['graphite', 'lavender', 'mint']) {
  const X = ctx(null, accent, mode, { noTheme: true, scheme: 'dark' }); const M = ctx('midnight', accent, mode);
  const diffs = ['bg', 'surface', 'text', 'text-2', 'text-3', 'separator', 'hairline', 'glass', 'glass-strong', 'accent-ink', 'accent-strong', 'badge-bg', 'toast-ink-2'].filter(n => hex(X.c(n)) + X.c(n).a.toFixed(3) !== hex(M.c(n)) + M.c(n).a.toFixed(3));
  gateContext(X, 'midnight', accent === 'graphite' ? 'graphite-nt' : accent, mode);
  noTheme.push({ mode, accent, differsFromMidnight: diffs.map(n => `${n}: ${hex(X.c(n))}@${X.c(n).a.toFixed(2)} vs ${hex(M.c(n))}@${M.c(n).a.toFixed(2)}`) });
}

// ═════════════ 7. report ═════════════
const gateList = [...gates.values()];
const failingGates = gateList.filter(g => g.fails);
const failingNoTheme = failingGates.filter(g => g.failAt.some(w => w.startsWith('(no data-theme)')));
const badClaims = claims.filter(c => !c.ok && !c.info);
const out = {
  method: 'Own cascade over proposed-tokens.css; WCAG 2.x luminance (0.04045 knee); translucent layers composited in gamma sRGB; color-mix in srgb with premultiplied alpha; CVD = Machado 2009 severity 1 on linear sRGB, distance CIEDE2000 (D65); OKLCH chroma. Claims: |stated - true| <= 0.05 (chroma 0.002) and a stated minimum <= the true minimum.',
  contexts: ALL.length + noTheme.length, gates: { kinds: gateList.length, evaluations: gateList.reduce((s, g) => s + g.n, 0), failing: failingGates.map(g => ({ id: g.id, thr: g.thr, min: +g.min.toFixed(3), at: g.at, fails: g.fails, n: g.n, examples: g.failAt })) },
  claims: { total: claims.length, numeric: claims.filter(c => typeof c.stated === 'number').length, mismatched: badClaims },
  noThemeDarkRoot: noTheme,
  cvd: Object.fromEntries(Object.entries(cvd).map(([k, v]) => [k, { v: +v.v.toFixed(3), at: v.at }])),
  info: claims.filter(c => c.info),
  allClaims: claims,
  gateMinima: gateList.map(g => ({ id: g.id, thr: g.thr, min: +g.min.toFixed(3), at: g.at, n: g.n, fails: g.fails })),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`contexts ${out.contexts}; gate kinds ${gateList.length}, evaluations ${out.gates.evaluations}, failing kinds ${failingGates.length} (${failingNoTheme.length} only through the no-data-theme dark root)`);
for (const g of failingGates) console.log(`FAIL ${g.id}: min ${g.min.toFixed(3)} < ${g.thr} (${g.fails}/${g.n}) e.g. ${g.failAt.slice(0, 3).join(' | ')}`);
console.log(`claims ${claims.length} (numeric ${out.claims.numeric}); mismatched ${badClaims.length}`);
for (const c of badClaims) console.log(`MISMATCH ${c.where}: stated ${c.stated}, true ${c.true} ${c.at || ''} ${c.within === false ? '(outside ±0.05)' : ''} ${c.notAbove === false ? '(stated above the true minimum)' : ''}`);
for (const c of out.info) console.log(`info ${c.where}: ${c.true} ${c.at || ''}`);
process.exit(failingGates.length || badClaims.length ? 1 : 0);
