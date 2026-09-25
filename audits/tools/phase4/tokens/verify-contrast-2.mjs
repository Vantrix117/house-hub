#!/usr/bin/env node
// Phase 4 — INDEPENDENT contrast verifier #2 for the proposed token set.
// Written from scratch. It imports nothing from contrast.mjs, colour-lib.mjs or verify-contrast-1.mjs.
// It parses audits/tools/phase4/tokens/proposed-tokens.css, runs its own cascade on <html> (compound selectors,
// specificity + source order, @media evaluated for a 1024 px fine-pointer window with no prefers-* set), resolves
// var() (with fallbacks), color-mix(in srgb …) (premultiplied), rgba() and alpha compositing, then recomputes every
// text/background, fill/ink, non-text and CVD figure the TOKENS section states, and compares each to the section's
// number (±0.05) and to its WCAG threshold.
//   node audits/tools/phase4/tokens/verify-contrast-2.mjs  → audits/evidence/p4/tokens/verify-contrast-2.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');
const CSS_PATH = resolve(HERE, 'proposed-tokens.css');
const OUT = resolve(ROOT, 'audits/evidence/p4/tokens/verify-contrast-2.json');
const TOL = 0.05;

// ═════════════════════════ 1. CSS parse ═════════════════════════
function splitTop(s, sep) {
  const out = []; let d = 0, q = null, st = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '(') d++; else if (c === ')') d--; else if (c === sep && d === 0) { out.push(s.slice(st, i)); st = i + 1; }
  }
  out.push(s.slice(st)); return out.map(x => x.trim()).filter(x => x.length);
}
function parse(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = []; let order = 0;
  (function walk(text, media) {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i); if (open < 0) return;
      const head = text.slice(i, open).trim();
      let d = 1, j = open + 1, q = null;
      for (; j < text.length && d; j++) { const c = text[j]; if (q) { if (c === q) q = null; continue; } if (c === '"' || c === "'") q = c; else if (c === '{') d++; else if (c === '}') d--; }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith('@media')) walk(body, [...media, head.slice(6).trim()]);
      else {
        const decls = {};
        for (const part of splitTop(body, ';')) { const k = part.indexOf(':'); if (k > 0) decls[part.slice(0, k).trim()] = part.slice(k + 1).trim(); }
        rules.push({ sels: splitTop(head, ','), decls, media, order: order++ });
      }
      i = j;
    }
  })(src, []);
  return rules;
}
const RULES = parse(readFileSync(CSS_PATH, 'utf8'));

// ═════════════════════════ 2. cascade on <html> ═════════════════════════
// attrs: { theme, scheme, accent, kind, contrast, transparency, motion, 'text-size' }, env: { width, coarse, prefers:{} }
function matchSel(sel, attrs) {           // returns specificity (count of attribute/pseudo-class selectors) or -1
  let s = sel.trim(), spec = 0;
  while (s.length) {
    if (s.startsWith(':root')) { spec++; s = s.slice(5); continue; }
    if (s.startsWith(':not(')) {
      let d = 0, k = 4; for (; k < s.length; k++) { if (s[k] === '(') d++; else if (s[k] === ')' && --d === 0) break; }
      const inner = s.slice(5, k); const r = matchSel(inner, attrs);
      if (r >= 0) return -1; spec += (inner.match(/\[|:root/g) || []).length; s = s.slice(k + 1); continue;
    }
    const m = s.match(/^\[data-([a-z-]+)(?:="([^"]*)")?\]/);
    if (!m) throw new Error('selector outside the supported subset: ' + sel);
    const v = attrs[m[1]]; if (v === undefined) return -1; if (m[2] !== undefined && m[2] !== v) return -1;
    spec++; s = s.slice(m[0].length);
  }
  return spec;
}
function mediaOk(q, env) {
  return q.split(/\s+and\s+/).every(part => {
    const m = part.trim().match(/^\(\s*([a-z-]+)\s*:\s*([^)]+)\)$/); if (!m) throw new Error('media: ' + q);
    const [, f, v] = m;
    if (f === 'min-width') return env.width >= parseFloat(v);
    if (f === 'pointer') return (env.coarse ? 'coarse' : 'fine') === v.trim();
    return env.prefers?.[f] === v.trim();
  });
}
function cascade(attrs, env = { width: 1024, coarse: false, prefers: {} }) {
  const win = {};
  for (const r of RULES) {
    if (!r.media.every(q => mediaOk(q, env))) continue;
    let spec = -1; for (const s of r.sels) spec = Math.max(spec, matchSel(s, attrs));
    if (spec < 0) continue;
    for (const [p, v] of Object.entries(r.decls)) { const w = win[p]; if (!w || spec > w.spec || (spec === w.spec && r.order >= w.order)) win[p] = { v, spec, order: r.order }; }
  }
  const raw = Object.fromEntries(Object.entries(win).map(([k, o]) => [k, o.v]));
  const memo = {};
  const sub = (val, stack) => {
    let out = '', i = 0;
    while (i < val.length) {
      const k = val.indexOf('var(', i); if (k < 0) { out += val.slice(i); break; }
      out += val.slice(i, k);
      let d = 0, j = k + 3; for (; j < val.length; j++) { if (val[j] === '(') d++; else if (val[j] === ')' && --d === 0) break; }
      const args = splitTop(val.slice(k + 4, j), ','); const name = args[0]; const fb = args.length > 1 ? val.slice(k + 4, j).slice(val.slice(k + 4, j).indexOf(',') + 1).trim() : undefined;
      let r = get(name, stack);
      if (r === undefined) { if (fb === undefined) return undefined; r = sub(fb, stack); if (r === undefined) return undefined; }
      out += r; i = j + 1;
    }
    return out;
  };
  const get = (name, stack = []) => {
    if (name in memo) return memo[name];
    if (stack.includes(name)) return undefined;             // cycle → invalid at computed-value time
    if (!(name in raw)) return undefined;
    return (memo[name] = sub(raw[name], [...stack, name]));
  };
  return { get: n => get(n.startsWith('--') ? n : '--' + n), raw };
}

// ═════════════════════════ 3. colour ═════════════════════════
const NAMED = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };
function colour(str) {
  const s = str.trim();
  if (NAMED[s.toLowerCase()]) return [...NAMED[s.toLowerCase()]];
  if (s[0] === '#') {
    let h = s.slice(1); if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
    const n = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    return [...n, h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  let m = s.match(/^rgba?\(([^)]*)\)$/i);
  if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  m = s.match(/^color-mix\(([\s\S]*)\)$/i);
  if (m) {
    const [space, a, b] = splitTop(m[1], ',');
    if (!/^in\s+srgb$/i.test(space)) throw new Error('color-mix space: ' + space);
    const comp = t => { let mm = t.match(/^([\s\S]*?)\s+(-?[\d.]+)%$/); if (mm) return [mm[1], +mm[2]]; mm = t.match(/^(-?[\d.]+)%\s+([\s\S]*)$/); if (mm) return [mm[2], +mm[1]]; return [t, null]; };
    let [ca, pa] = comp(a), [cb, pb] = comp(b);
    if (pa === null && pb === null) { pa = 50; pb = 50; } else if (pa === null) pa = 100 - pb; else if (pb === null) pb = 100 - pa;
    const sum = pa + pb; const mult = sum < 100 ? sum / 100 : 1; const wa = pa / sum, wb = pb / sum;
    const A = colour(ca), B = colour(cb);
    const al = A[3] * wa + B[3] * wb;
    const ch = i => al === 0 ? 0 : (A[i] * A[3] * wa + B[i] * B[3] * wb) / al;   // premultiplied
    return [ch(0), ch(1), ch(2), al * mult];
  }
  throw new Error('not a colour: ' + s);
}
const over = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)).concat(1 - (1 - a) * (1 - bg[3])); };
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
function oklchC(c) {
  const [r, g, b] = c.slice(0, 3).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return Math.hypot(A, B);
}
// Machado, Oliveira & Fernandes 2009, severity 1.0, applied to linear sRGB
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
function linRGB(c, vis) {
  const v = c.slice(0, 3).map(lin); if (!vis || vis === 'normal') return v;
  return MACHADO[vis].map(row => Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2])));
}
function lab(v) {
  const X = 0.4124564 * v[0] + 0.3575761 * v[1] + 0.1804375 * v[2], Y = 0.2126729 * v[0] + 0.7151522 * v[1] + 0.0721750 * v[2], Z = 0.0193339 * v[0] + 0.1191920 * v[1] + 0.9503041 * v[2];
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const fx = f(X / 0.95047), fy = f(Y / 1), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function de00(l1, l2) {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2, rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2, Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (b, a) => { if (a === 0 && b === 0) return 0; const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const h1 = hp(b1, ap1), h2 = hp(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = 0; if (Cp1 * Cp2 !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh * rad / 2);
  const Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
  let hb = h1 + h2; if (Cp1 * Cp2 !== 0) { if (Math.abs(h1 - h2) > 180) hb = h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2; else hb = (h1 + h2) / 2; }
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.20 * Math.cos((4 * hb - 63) * rad);
  const dT = 30 * Math.exp(-(((hb - 275) / 25) ** 2)), RC = 2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7));
  const SL = 1 + 0.015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cpb, SH = 1 + 0.015 * Cpb * T, RT = -Math.sin(2 * dT * rad) * RC;
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
const dE = (a, b, vis = 'normal') => de00(lab(linRGB(a, vis)), lab(linRGB(b, vis)));
// Self-test of the colour maths against published reference values
const SELFTEST = {
  'white/black = 21': +cr([255, 255, 255, 1], [0, 0, 0, 1]).toFixed(3),
  '#767676 on white = 4.54': +cr(colour('#767676'), colour('#FFFFFF')).toFixed(2),
  'CIEDE2000 Sharma pair 1 (50,2.6772,-79.7751)/(50,0,-82.7485) = 2.0425': +de00([50, 2.6772, -79.7751], [50, 0, -82.7485]).toFixed(4),
  'CIEDE2000 Sharma pair 17 (50,2.5,0)/(73,25,-18) = 27.1492': +de00([50, 2.5, 0], [73, 25, -18]).toFixed(4),
  'OKLCH C of #FF0000 = 0.2577': +oklchC(colour('#FF0000')).toFixed(4),
  'color-mix(in srgb, #000 50%, transparent) = rgba(0,0,0,.5)': JSON.stringify(colour('color-mix(in srgb, #000000 50%, transparent)')),
};

// ═════════════════════════ 4. contexts ═════════════════════════
const THEMES = { hearth: 'light', parchment: 'light', frost: 'light', midnight: 'dark', forest: 'dark', graphite: 'dark' };
const LIGHT = ['hearth', 'parchment', 'frost'], DARK = ['midnight', 'forest', 'graphite'];
const PEOPLE = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite'];
const HUES = PEOPLE.slice(0, 8), SEM = ['success', 'warning', 'danger'], FAM = [...PEOPLE, ...SEM];
const MODES = { adult: {}, kid: { kind: 'kid' }, kiosk: { kind: 'kiosk' }, 'contrast-more': { contrast: 'more' }, 'reduce-transparency': { transparency: 'reduce' }, 'kiosk+rt': { kind: 'kiosk', transparency: 'reduce' } };
const HIMODES = ['kiosk', 'contrast-more', 'kiosk+rt'];
const OPAQUE = ['bg', 'surface', 'surface-2', 'surface-raised', 'fill-field', 'hover'];
const PAGE_CARD_SHEET = ['bg', 'surface', 'surface-raised'], WELLS = ['surface-2', 'fill-field', 'hover'];
const ctxCache = new Map();
function ctx(theme, accent = 'graphite', mode = 'adult', env) {
  const key = `${theme}/${accent}/${mode}/${JSON.stringify(env || {})}`;
  if (ctxCache.has(key)) return ctxCache.get(key);
  const attrs = { theme, scheme: THEMES[theme], accent, kind: 'adult', ...MODES[mode] };
  const C = cascade(attrs, env);
  const c = n => { const v = C.get(n); if (v === undefined) throw new Error(`${key}: --${n} undefined`); return colour(v); };
  const o = n => { const x = c(n); if (x[3] < 0.999) throw new Error(`${key}: --${n} not opaque`); return x; };
  const r = { c, o, raw: n => C.get(n), theme, scheme: THEMES[theme], accent, mode };
  ctxCache.set(key, r); return r;
}
const each = (fn, { themes = Object.keys(THEMES), people = PEOPLE, modes = ['adult'] } = {}) => { const out = []; for (const t of themes) for (const p of people) for (const m of modes) out.push(...[].concat(fn(ctx(t, p, m), t, p, m))); return out; };
const minOf = arr => { let best = null; for (const x of arr) if (!best || x.v < best.v) best = x; return best; };
const maxOf = arr => { let best = null; for (const x of arr) if (!best || x.v > best.v) best = x; return best; };
const E = (v, at) => ({ v, at });

// ═════════════════════════ 5. claims ═════════════════════════
const claims = [];
function claim(id, where, stated, got, { thr = null, kind = 'min', note = '' } = {}) {
  // got: { v, at } (or a hex string for kind 'hex')
  if (kind === 'hex') { const ok = String(stated).toUpperCase() === String(got).toUpperCase(); claims.push({ id, where, stated, computed: got, match: ok, meetsThreshold: null, note }); return; }
  const v = +got.v.toFixed(3);
  const match = Math.abs(v - stated) <= TOL + 1e-9;
  const meets = thr === null ? null : v >= thr - 1e-9;
  claims.push({ id, where, stated, computed: +v.toFixed(2), at: got.at, threshold: thr, match, meetsThreshold: meets, note });
}
const gates = [];     // every pair recomputed against its threshold (not only the stated minima)
function gate(id, thr, list) { const m = minOf(list); const fails = list.filter(x => x.v < thr - 1e-9); gates.push({ id, threshold: thr, evaluations: list.length, min: +m.v.toFixed(2), at: m.at, failing: fails.length, examples: fails.slice(0, 5).map(x => ({ v: +x.v.toFixed(2), at: x.at })) }); return m; }

// ── 5.1 §2.1 light family table (min across Hearth, Parchment, Frost, adult) ──
const LIGHT_TABLE = {   // fill, ink, ink/fill, ink/wash, ink/all, ink-hi, ink-hi/fill, fill-strong, ink/fill-strong, strong, on/strong, strong/all, graphic, graphic/surf, C
  bubblegum: ['#FFC8DD', '#A3134F', 5.27, 6.98, 5.91, '#85003D', 7.05, '#FF97BF', 3.77, '#BC1D6F', 5.93, 4.61, '#D72D77', 3.60, 0.068],
  peach: ['#FFD6B8', '#9A3F0A', 5.04, 6.24, 5.28, '#7A2E01', 7.01, '#FF9E72', 3.36, '#AA4400', 5.94, 4.62, '#954C00', 4.93, 0.061],
  butter: ['#FFF1A8', '#735A00', 5.77, 6.07, 5.12, '#574400', 8.24, '#EAAC2C', 3.27, '#845D00', 5.92, 4.60, '#9C7A00', 3.14, 0.093],
  mint: ['#B9F2D0', '#0E6B3B', 5.24, 6.13, 5.13, '#00522A', 7.44, '#48CD8C', 3.26, '#007346', 5.93, 4.61, '#006F46', 4.86, 0.074],
  aqua: ['#B5EEF0', '#0B6468', 5.42, 6.42, 5.38, '#004F52', 7.34, '#00C9DA', 3.41, '#006B87', 6.08, 4.73, '#007E79', 3.83, 0.058],
  sky: ['#BFDDFF', '#1A4F9C', 5.68, 7.35, 6.18, '#08408C', 7.07, '#7DBBFF', 3.94, '#0065B6', 5.94, 4.62, '#0071AB', 4.13, 0.057],
  periwinkle: ['#CCD3FF', '#3440A8', 5.86, 7.90, 6.68, '#2A339A', 7.03, '#A5B2FF', 4.26, '#4F52D8', 5.95, 4.62, '#606FFE', 3.14, 0.061],
  lavender: ['#E0CCFF', '#5E2BAE', 5.86, 7.92, 6.71, '#531AA0', 7.04, '#C7A7FF', 4.28, '#7F43CA', 5.90, 4.59, '#581DB2', 7.31, 0.072],
  graphite: ['#E3E3E8', '#48484F', 7.09, 8.26, 7.05, '#2C2C30', 10.87, '#B3B6BF', 4.47, '#61646B', 5.93, 4.61, '#43454C', 7.44, null],
};
const WASHES = { bubblegum: '#FFF2F6', peach: '#FFF3EB', butter: '#FAF6E4', mint: '#E9FBF0', aqua: '#E4FBFC', sky: '#EFF7FF', periwinkle: '#F3F5FF', lavender: '#F8F3FF', graphite: '#F4F4F7' };
const HOUSE = { bubblegum: ['#FFC8DD', '#A3134F'], peach: ['#FFD6B8', '#9A3F0A'], butter: ['#FFF1A8', '#735A00'], mint: ['#B9F2D0', '#0E6B3B'], aqua: ['#B5EEF0', '#0B6468'], sky: ['#BFDDFF', '#1A4F9C'], periwinkle: ['#CCD3FF', '#3440A8'], lavender: ['#E0CCFF', '#5E2BAE'] };  // audits/HUB-AUDIT-PROMPT.md:57-64
const famMin = (themes, f, fn) => minOf(themes.map(t => { const x = ctx(t); const F = r => x.o(`${f}-${r}`); return E(fn(F, x), t); }));
for (const [f, row] of Object.entries(LIGHT_TABLE)) {
  const w = '§2.1 light table, ' + f; const x = ctx('hearth'); const F = r => hex(x.o(`${f}-${r}`));
  claim(`light ${f} fill hex`, w, row[0], F('fill'), { kind: 'hex' }); claim(`light ${f} ink hex`, w, row[1], F('ink'), { kind: 'hex' });
  claim(`light ${f} ink-hi hex`, w, row[5], F('ink-hi'), { kind: 'hex' }); claim(`light ${f} fill-strong hex`, w, row[7], F('fill-strong'), { kind: 'hex' });
  claim(`light ${f} strong hex`, w, row[9], F('strong'), { kind: 'hex' }); claim(`light ${f} graphic hex`, w, row[12], F('graphic'), { kind: 'hex' });
  claim(`light ${f} wash hex`, w, WASHES[f], F('wash'), { kind: 'hex' });
  if (HOUSE[f]) { claim(`light ${f} fill = house pastel`, 'HUB-AUDIT-PROMPT.md:57-64 via §2.1', HOUSE[f][0], F('fill'), { kind: 'hex' }); claim(`light ${f} ink = house ink`, 'HUB-AUDIT-PROMPT.md:57-64 via §2.1', HOUSE[f][1], F('ink'), { kind: 'hex' }); }
  claim(`light ${f} ink/fill`, w, row[2], famMin(LIGHT, f, F => cr(F('ink'), F('fill'))), { thr: 4.5 });
  claim(`light ${f} ink/wash`, w, row[3], famMin(LIGHT, f, F => cr(F('ink'), F('wash'))), { thr: 4.5 });
  claim(`light ${f} ink/all surfaces`, w, row[4], famMin(LIGHT, f, (F, x) => Math.min(...OPAQUE.map(b => cr(F('ink'), x.o(b))))), { thr: 4.5 });
  claim(`light ${f} ink-hi/fill`, w, row[6], famMin(LIGHT, f, F => cr(F('ink-hi'), F('fill'))), { thr: 7 });
  claim(`light ${f} ink/fill-strong (tile glyph)`, w, row[8], famMin(LIGHT, f, F => cr(F('ink'), F('fill-strong'))), { thr: 3 });
  claim(`light ${f} on/strong`, w, row[10], famMin(LIGHT, f, F => cr(F('on'), F('strong'))), { thr: 4.5 });
  claim(`light ${f} strong as text/all surfaces`, w, row[11], famMin(LIGHT, f, (F, x) => Math.min(...OPAQUE.map(b => cr(F('strong'), x.o(b))))), { thr: 4.5 });
  claim(`light ${f} graphic/surfaces`, w, row[13], famMin(LIGHT, f, (F, x) => Math.min(...OPAQUE.map(b => cr(F('graphic'), x.o(b))))), { thr: 3 });
  if (row[14] !== null) { const v = oklchC(ctx('hearth').o(`${f}-fill`)); claims.push({ id: `light ${f} fill OKLCH C`, where: w, stated: row[14], computed: +v.toFixed(3), match: Math.abs(v - row[14]) <= 0.0015, meetsThreshold: v >= 0.055, threshold: 0.055, note: 'chroma: ±0.0015 (3 dp)' }); }
}

// ── 5.2 §2.1 dark family table (min across Midnight, Forest, Graphite, adult) ──
const DARK_TABLE = {   // fill, fill/card, ink, ink/fill, ink/all, ink-hi, fill-strong, ink/fill-strong, strong, on, on/strong, strong/surfaces, graphic, graphic/surfaces, C
  bubblegum: ['#613146', 1.53, '#FFC2D9', 6.86, 9.19, '#FFE0EB', '#7F3858', 5.35, '#FF99C3', '#311220', 8.56, 6.97, '#F2749E', 5.11, 0.075],
  peach: ['#603616', 1.54, '#FFC9A5', 6.95, 9.31, '#FFE3D2', '#7F410A', 5.31, '#FFA566', '#311602', 8.69, 7.12, '#EE842C', 5.25, 0.075],
  butter: ['#4D3F02', 1.53, '#E7D695', 7.13, 9.51, '#F3EAC8', '#645300', 5.20, '#DABC43', '#251D00', 8.97, 7.41, '#FFDB7E', 10.32, 0.075],
  mint: ['#144C31', 1.59, '#A6E7C1', 7.03, 9.75, '#D2F3DE', '#00653D', 5.06, '#63D99B', '#002614', 9.27, 7.85, '#00976B', 3.71, 0.074],
  aqua: ['#004A4D', 1.57, '#8FE7EC', 7.10, 9.75, '#C8F3F5', '#006064', 5.18, '#00D7E0', '#002425', 9.22, 7.76, '#00C0B7', 6.07, 0.063],
  sky: ['#1E4266', 1.53, '#B7DAFF', 7.15, 9.53, '#DAECFF', '#1D568B', 5.26, '#89C3FF', '#061F37', 8.99, 7.45, '#9CD0FF', 8.48, 0.075],
  periwinkle: ['#373D69', 1.53, '#CAD3FF', 7.02, 9.39, '#E3E8FF', '#454D8D', 5.29, '#ACB8FF', '#171B38', 8.84, 7.28, '#859FFF', 5.53, 0.076],
  lavender: ['#4A3863', 1.54, '#DFCBFF', 6.93, 9.30, '#EEE4FF', '#5F4484', 5.34, '#CCABFF', '#231733', 8.73, 7.13, '#8569D6', 3.28, 0.074],
  graphite: ['#404045', 1.54, '#DADADF', 7.40, 9.92, '#EDEDF0', '#4C4C52', 6.12, '#C4C4CC', '#1C1C1F', 9.81, 7.97, '#E4E7F0', 11.18, null],
};
for (const [f, row] of Object.entries(DARK_TABLE)) {
  const w = '§2.1 dark table, ' + f; const x = ctx('midnight'); const F = r => hex(x.o(`${f}-${r}`));
  claim(`dark ${f} fill hex`, w, row[0], F('fill'), { kind: 'hex' }); claim(`dark ${f} ink hex`, w, row[2], F('ink'), { kind: 'hex' });
  claim(`dark ${f} ink-hi hex`, w, row[5], F('ink-hi'), { kind: 'hex' }); claim(`dark ${f} fill-strong hex`, w, row[6], F('fill-strong'), { kind: 'hex' });
  claim(`dark ${f} strong hex`, w, row[8], F('strong'), { kind: 'hex' }); claim(`dark ${f} on hex`, w, row[9], F('on'), { kind: 'hex' });
  claim(`dark ${f} graphic hex`, w, row[12], F('graphic'), { kind: 'hex' });
  claim(`dark ${f} fill/card (chip)`, w, row[1], famMin(DARK, f, (F, x) => cr(F('fill'), x.o('surface'))), { thr: 1.5 });
  claim(`dark ${f} ink/fill`, w, row[3], famMin(DARK, f, F => cr(F('ink'), F('fill'))), { thr: 4.5 });
  claim(`dark ${f} ink/all surfaces`, w, row[4], famMin(DARK, f, (F, x) => Math.min(...OPAQUE.map(b => cr(F('ink'), x.o(b))))), { thr: 4.5 });
  claim(`dark ${f} ink/fill-strong`, w, row[7], famMin(DARK, f, F => cr(F('ink'), F('fill-strong'))), { thr: 3 });
  claim(`dark ${f} on/strong`, w, row[10], famMin(DARK, f, F => cr(F('on'), F('strong'))), { thr: 4.5 });
  claim(`dark ${f} strong/surfaces`, w, row[11], famMin(DARK, f, (F, x) => Math.min(...OPAQUE.map(b => cr(F('strong'), x.o(b))))), { thr: 4.5 });
  claim(`dark ${f} graphic/surfaces`, w, row[13], famMin(DARK, f, (F, x) => Math.min(...OPAQUE.map(b => cr(F('graphic'), x.o(b))))), { thr: 3 });
  if (row[14] !== null) { const v = oklchC(ctx('midnight').o(`${f}-fill`)); claims.push({ id: `dark ${f} fill OKLCH C`, where: w, stated: row[14], computed: +v.toFixed(3), match: Math.abs(v - row[14]) <= 0.0015, meetsThreshold: v >= 0.05, threshold: 0.05, note: 'chroma: ±0.0015 (3 dp)' }); }
}
claim('dark: ink on its own chip (min over 9 people)', '§2.1 prose under the dark table', 6.86, minOf(PEOPLE.flatMap(f => DARK.map(t => E(cr(ctx(t).o(`${f}-ink`), ctx(t).o(`${f}-fill`)), `${t}/${f}`)))), { thr: 4.5 });
claim('dark: ink-hi on its own chip (min over 9 people)', '§2.1 prose "ink-hi is ≥ 8.4"', 8.4, minOf(PEOPLE.flatMap(f => DARK.map(t => E(cr(ctx(t).o(`${f}-ink-hi`), ctx(t).o(`${f}-fill`)), `${t}/${f}`)))), { thr: 7, note: 'stated as a bound' });

// ── 5.3 §2.2 semantic ──
const SEM_TABLE = { light: { success: ['#C4F7CA', '#005D22', 6.76, '#008533', '#008533'], warning: ['#FFDCB6', '#724600', 6.24, '#9F6400', '#BC6D00'], danger: ['#FFC8C3', '#9B1E25', 5.49, '#900017', '#900017'] },
  dark: { success: ['#214B29', '#B0E6B7', 7.06, '#84E093', '#84E093'], warning: ['#5A390A', '#FACD98', 7.04, '#FFBB69', '#FFBB69'], danger: ['#64312E', '#FFC6C1', 6.98, '#F07E79', '#F07E79'] } };
for (const [sch, rows] of Object.entries(SEM_TABLE)) for (const [f, row] of Object.entries(rows)) {
  const ths = sch === 'light' ? LIGHT : DARK; const x = ctx(ths[0]); const F = r => hex(x.o(`${f}-${r}`)); const w = `§2.2 semantic table, ${f} ${sch}`;
  claim(`${sch} ${f} fill hex`, w, row[0], F('fill'), { kind: 'hex' }); claim(`${sch} ${f} ink hex`, w, row[1], F('ink'), { kind: 'hex' });
  claim(`${sch} ${f} strong hex`, w, row[3], F('strong'), { kind: 'hex' }); claim(`${sch} ${f} graphic hex`, w, row[4], F('graphic'), { kind: 'hex' });
  claim(`${sch} ${f} ink/fill`, w, row[2], famMin(ths, f, F => cr(F('ink'), F('fill'))), { thr: 4.5 });
}
claim('switch-on dark hex', '§2.2 rules column', '#269143', hex(ctx('midnight').o('switch-on')), { kind: 'hex' });
claim('switch knob on switch-on (white knob)', '§2.2 "white knob stays ≥ 4.03" / §2.5', 4.03, minOf(each(x => E(cr(x.o('switch-knob'), x.o('switch-on')), `${x.theme}/${x.mode}`), { people: ['graphite'], modes: Object.keys(MODES) })), { thr: 3 });
const badgeLabel = m => minOf(each(x => E(cr(x.o('badge-ink'), x.o('badge-bg')), `${x.theme}/${x.mode}`), { people: ['graphite'], modes: m }));
claim('badge label badge-ink/badge-bg (adult)', '§2.2 / §2.2a / §2.5', 6.42, badgeLabel(['adult', 'kid', 'reduce-transparency']), { thr: 4.5 });
claim('badge label in the 7:1 modes', '§2.2a / §2.5', 10.74, badgeLabel(HIMODES), { thr: 7 });
const badgeOn = (bgs, m) => minOf(each(x => bgs.map(b => E(cr(x.o('badge-bg'), x.o(b)), `${x.theme}/${x.mode}/${b}`)), { people: ['graphite'], modes: m }));
claim('badge vs card (adult)', '§2.2 rules', 6.01, badgeOn(['surface'], ['adult']), { thr: 3 });
claim('badge vs sheet (adult; "Graphite\'s #2C2C2E sheet")', '§2.2 rules', 5.29, badgeOn(['surface-raised'], ['adult']), { thr: 3 });
claim('badge vs page (adult)', '§2.2 rules', 7.35, badgeOn(['bg'], ['adult']), { thr: 3 });
claim('badge vs page/card/sheet in the 7:1 modes', '§2.2a', 8.35, badgeOn(PAGE_CARD_SHEET, HIMODES), { thr: 3 });
const semLum = minOf(Object.keys(THEMES).flatMap(t => Object.keys(MODES).flatMap(m => { const x = ctx(t, 'graphite', m); return [E(cr(x.o('success-strong'), x.o('danger-strong')), `${t}/${m} success/danger`), E(cr(x.o('warning-strong'), x.o('danger-strong')), `${t}/${m} warning/danger`)]; })));
claim('semantic strong luminance ratio (success/danger, warning/danger)', '§2.2 / verification table', 1.58, semLum, { thr: 1.3 });
const semDE = minOf(Object.keys(THEMES).flatMap(t => { const x = ctx(t); return SEM.flatMap(s => PEOPLE.map(p => E(dE(x.o(`${s}-graphic`), x.o(`${p}-graphic`)), `${THEMES[t]} ${s}/${p}`))); }));
claim('semantic graphic vs every person graphic ΔE00', '§2.2 / §2.4 ACCENT-7 / verification', 10.74, semDE, { thr: 10, note: 'section names the closest pair "success vs Mint in light"' });
claims.push({ id: 'closest semantic/person pair', where: '§2.2', stated: 'success vs Mint, light', computed: semDE.at, match: /light success\/mint/.test(semDE.at), meetsThreshold: null });
const semCvd = (sch, a, b, vis) => dE(ctx(sch === 'light' ? 'hearth' : 'midnight').o(`${a}-graphic`), ctx(sch === 'light' ? 'hearth' : 'midnight').o(`${b}-graphic`), vis);
{ const v = semCvd('light', 'success', 'warning', 'protan'); claims.push({ id: 'success vs warning, protanopia, light (reported)', where: '§2.2', stated: 3.9, computed: +v.toFixed(2), match: Math.abs(v - 3.9) <= 0.05 + 0.05, meetsThreshold: null, note: 'stated to 1 dp, so ±0.1' }); }
{ const v = semCvd('dark', 'success', 'danger', 'deutan'); claims.push({ id: 'success vs danger, deuteranopia, dark (reported)', where: '§2.2', stated: 8.6, computed: +v.toFixed(2), match: Math.abs(v - 8.6) <= 0.1, meetsThreshold: null, note: 'stated to 1 dp, so ±0.1' }); }
{ const all = [];
  for (const sch of ['light', 'dark']) for (const [a, b] of [['success', 'danger'], ['success', 'warning'], ['warning', 'danger']]) for (const vis of ['protan', 'deutan']) all.push(E(semCvd(sch, a, b, vis), `${sch} ${a}/${b} ${vis}`));
  const m = minOf(all); claims.push({ id: 'lowest semantic-vs-semantic CVD distance (reported, for context)', where: '§2.2 "Colour-blind separation is reported"', stated: 'success vs warning 3.9 (protan, light) is quoted as the example', computed: `${m.v.toFixed(2)} at ${m.at}`, match: true, meetsThreshold: null, note: 'informational' }); }

// ── 5.4 §2.2a 7:1 modes ──
const txtOn = (fg, bgs, m) => minOf(each(x => bgs.map(b => E(cr(x.o(fg), x.o(b)), `${x.theme}/${x.mode}/${b}`)), { people: ['graphite'], modes: m }));
claim('text-2 on every opaque surface (adult)', '§2.2a row 1', 7.50, txtOn('text-2', OPAQUE, ['adult']), { thr: 4.5 });
claim('text-3 on every opaque surface (adult)', '§2.2a row 1 / TOK-6 / COLOR-4', 5.08, txtOn('text-3', OPAQUE, ['adult']), { thr: 4.5 });
claim('placeholder on every opaque surface (adult)', 'TOK-6 / verification "tertiary and placeholders"', 5.08, txtOn('placeholder', OPAQUE, ['adult']), { thr: 4.5 });
claim('text-2 and text-3 in the 7:1 modes', '§2.2a row 1 / verification', 10.38, minOf([txtOn('text-2', OPAQUE, HIMODES), txtOn('text-3', OPAQUE, HIMODES)]), { thr: 7 });
const inkAll = m => minOf(each(x => FAM.flatMap(f => ['fill', 'wash', ...OPAQUE].map(b => E(cr(x.o(`${f}-ink`), b === 'fill' || b === 'wash' ? x.o(`${f}-${b}`) : x.o(b)), `${x.theme}/${x.mode}/${f}-ink on ${b}`))), { people: ['graphite'], modes: m }));
claim('hue inks on their fills and every surface (adult)', '§2.2a row 2 / verification "hue inks on their fills 5.04"', 5.04, inkAll(['adult']), { thr: 4.5 });
claim('hue inks on their fills and every surface (7:1 modes)', '§2.2a row 2', 7.01, inkAll(HIMODES), { thr: 7 });
const accentText = m => minOf(each(x => OPAQUE.map(b => E(cr(x.o('accent'), x.o(b)), `${x.theme}/${x.accent}/${x.mode}/${b}`)), { modes: m }));
claim('legacy color: var(--accent) as text (adult)', '§2.2a row 3 / §2.4 / migration table', 4.59, accentText(['adult']), { thr: 4.5 });
claim('legacy color: var(--accent) as text (7:1 modes)', '§2.2a row 3 / verification', 7.29, accentText(HIMODES), { thr: 7 });
const btn = m => minOf(each(x => [E(cr(x.o('accent-on'), x.o('accent-strong')), `${x.theme}/${x.accent}/${x.mode} on/strong`), E(cr(x.o('sel-ink-strong'), x.o('sel-fill-strong')), `${x.theme}/${x.accent}/${x.mode} sel`)], { modes: m }));
claim('primary button label accent-on/accent-strong + sel-ink-strong/sel-fill-strong (adult)', '§2.2a row 4', 5.90, btn(['adult']), { thr: 4.5 });
claim('primary button label (7:1 modes)', '§2.2a row 4 / verification "person solid labels 9.37"', 9.37, btn(HIMODES), { thr: 7 });
const BACKS = x => ({ bg: x.o('bg'), surface: x.o('surface'), mid: colour('#767676'), worst: colour(x.scheme === 'light' ? '#000000' : '#FFFFFF') });
const toast = (tok, m) => minOf(each(x => Object.entries(BACKS(x)).map(([bn, b]) => E(cr(x.o(tok), over(x.c('toast-bg'), b)), `${x.theme}/${x.mode}/over ${bn}`)), { people: ['graphite'], modes: m }));
claim('toast-ink-2 over the toast, every backdrop (adult)', '§2.2a / §2.5', 6.59, toast('toast-ink-2', ['adult']), { thr: 4.5 });
claim('toast-ink-2 over the toast, every backdrop (7:1 modes)', '§2.2a / §2.5', 10.02, toast('toast-ink-2', HIMODES), { thr: 7 });
claim('toast-ink over the toast, every backdrop (all modes)', '§2.5 "ink ≥ 10.0"', 10.0, toast('toast-ink', Object.keys(MODES)), { thr: 7, note: 'stated as a bound' });
const semOn = m => minOf(each(x => SEM.map(f => E(cr(x.o(`${f}-on`), x.o(`${f}-strong`)), `${x.theme}/${x.mode}/${f}`)), { people: ['graphite'], modes: m }));
claim('semantic -on on -strong (adult)', '§2.2a last row / TOK-1 low end / rewrites "≥ 4.77"', 4.77, semOn(['adult']), { thr: 4.5 });
claim('semantic -on on -strong (7:1 modes; AA by design)', '§2.2a last row', 4.77, semOn(HIMODES), { thr: 4.5 });
{ const all = each(x => FAM.map(f => E(cr(x.o(`${f}-on`), x.o(`${f}-strong`)), `${x.scheme}/${f}`)), { people: ['graphite'], themes: ['hearth', 'parchment', 'frost', 'midnight', 'forest', 'graphite'] });
  const mn = minOf(all), mx = maxOf(all); claim('TOK-1 --X-on range low end', 'TOK-1 "4.77-10.2"', 4.77, mn, { thr: 4.5 }); claim('TOK-1 --X-on range high end', 'TOK-1 "4.77-10.2"', 10.2, mx, { kind: 'max' }); }

// ── 5.5 §2.3 neutrals ──
const NEUTRAL = {  // bg, surface, surface-2, fill-field, surface-raised, text, text/page, text-2, text-2 lowest, text-3, text-3 lowest, text-2-hi, text-2 on glass/worst, field-border, fb lowest, card/page, glass α, glass-strong α, spec α
  hearth: ['#F4F1EC', '#FFFFFF', '#F4F1EC', '#EFEBE5', '#FFFFFF', '#221C17', 14.95, '#4A423A', 8.22, '#635B53', 5.56, '#37302A', 5.82, '#8C847B', 3.07, 1.13, '78%', '90%', 0.62],
  parchment: ['#ECE2CD', '#FBF7EE', '#F1E9D8', '#EFE6D3', '#FFFBF3', '#2B2116', 12.26, '#4A3B2B', 8.37, '#5E4E3A', 6.22, '#35291B', 5.97, '#8B7A60', 3.23, 1.20, '78%', '90%', 0.60],
  frost: ['#F2F2F7', '#FFFFFF', '#F2F2F7', '#EEEEF0', '#FFFFFF', '#1D1D1F', 15.08, '#48484E', 7.50, '#616168', 5.08, '#333338', 5.37, '#85858B', 3.03, 1.12, '78%', '90%', 0.75],
  midnight: ['#0B0A09', '#211F1D', '#2E2B28', '#2E2B28', '#2A2725', '#F5F2EE', 17.73, '#D0C9C1', 8.58, '#A9A198', 5.52, '#E4DFD9', 5.23, '#7D766F', 3.14, 1.20, '80%', '90%', 0.06],
  forest: ['#070F0D', '#182522', '#213029', '#213029', '#1F2D29', '#F1ECDF', 16.44, '#C9D1CB', 8.86, '#9DA9A1', 5.68, '#DDE4DF', 5.31, '#75827B', 3.45, 1.22, '80%', '90%', 0.06],
  graphite: ['#000000', '#1C1C1E', '#2C2C2E', '#2C2C2E', '#2C2C2E', '#F5F5F7', 19.29, '#D1D1D6', 9.16, '#A1A1A6', 5.42, '#E5E5EA', 5.87, '#7C7C80', 3.35, 1.23, '80%', '90%', 0.06],
};
for (const [t, row] of Object.entries(NEUTRAL)) {
  const x = ctx(t), w = `§2.3 neutral table, ${t}`, H = n => hex(x.o(n)), mn = (fg, bgs) => minOf(bgs.map(b => E(cr(x.o(fg), x.o(b)), b)));
  ['bg', 'surface', 'surface-2', 'fill-field', 'surface-raised', 'text'].forEach((n, i) => claim(`${t} --${n} hex`, w, row[i], H(n), { kind: 'hex' }));
  claim(`${t} --text-2 hex`, w, row[7], H('text-2'), { kind: 'hex' }); claim(`${t} --text-3 hex`, w, row[9], H('text-3'), { kind: 'hex' });
  claim(`${t} --text-2-hi hex`, w, row[11], H('text-2-hi'), { kind: 'hex' }); claim(`${t} --field-border hex`, w, row[13], H('field-border'), { kind: 'hex' });
  claim(`${t} --track-info = --muted-decor = --field-border`, w, row[13], H('track-info') === H('muted-decor') ? H('track-info') : 'differ', { kind: 'hex' });
  claim(`${t} text/page`, w, row[6], E(cr(x.o('text'), x.o('bg')), 'bg'), { thr: 7 });
  claim(`${t} text-2 lowest on any opaque surface`, w, row[8], mn('text-2', OPAQUE), { thr: 4.5 });
  claim(`${t} text-3 lowest`, w, row[10], mn('text-3', OPAQUE), { thr: 4.5 });
  claim(`${t} text-2 on glass over the worst backdrop (fill alone)`, w, row[12], E(cr(x.o('text-2'), over(x.c('glass'), BACKS(x).worst)), x.scheme === 'light' ? 'glass over #000' : 'glass over #FFF'), { thr: 4.5 });
  claim(`${t} field-border lowest`, w, row[14], mn('field-border', OPAQUE), { thr: 3 });
  claim(`${t} card ÷ page`, w, row[15], E(cr(x.o('surface'), x.o('bg')), 'surface/bg'), { thr: x.scheme === 'dark' ? 1.2 : 1.05 });
  claims.push({ id: `${t} glass / glass-strong alpha`, where: w, stated: `${row[16]} / ${row[17]}`, computed: `${x.raw('glass-alpha')} / ${x.raw('glass-alpha-strong')}`, match: x.raw('glass-alpha') === row[16] && x.raw('glass-alpha-strong') === row[17], meetsThreshold: null });
  claims.push({ id: `${t} sheen alpha (--glass-spec)`, where: w, stated: row[18], computed: +x.c('glass-spec')[3].toFixed(2), match: Math.abs(x.c('glass-spec')[3] - row[18]) < 0.005, meetsThreshold: null });
  if (x.scheme === 'dark') for (const n of ['surface-2', 'fill-field', 'surface-raised']) claims.push({ id: `${t} ${n} lighter than the card`, where: '§2.3 / §6 / DARK-5', stated: 'lighter', computed: +cr(x.o(n), x.o('surface')).toFixed(2), match: lum(x.o(n)) > lum(x.o('surface')), meetsThreshold: null });
}
claim('dark card ÷ page range low', '§6 / COLOR-11 "1.20-1.23"', 1.20, minOf(DARK.map(t => E(cr(ctx(t).o('surface'), ctx(t).o('bg')), t))), { thr: 1.2 });
claim('dark card ÷ page range high', '§6 / COLOR-11 "1.20-1.23"', 1.23, maxOf(DARK.map(t => E(cr(ctx(t).o('surface'), ctx(t).o('bg')), t))), { kind: 'max' });
claim('light card ÷ page minimum', 'verification depth "1.12 light"', 1.12, minOf(LIGHT.map(t => E(cr(ctx(t).o('surface'), ctx(t).o('bg')), t))), { thr: 1.05 });

// ── 5.6 §2.4 profile accents (min across six palettes, adult) ──
const ACC = { // ink/card, ink/page, ink/fill, on/strong, strong/page, graphic/page, hero, tab label glass-strong over #767676
  bubblegum: [7.11, 5.91, 5.27, 5.93, 4.61, 3.60, 7.17, 6.33], peach: [6.36, 5.28, 5.04, 5.94, 4.62, 4.93, 6.80, 5.67], butter: [6.15, 5.12, 5.77, 5.92, 4.60, 3.14, 6.58, 5.48],
  mint: [6.17, 5.13, 5.24, 5.93, 4.61, 4.86, 6.59, 5.50], aqua: [6.47, 5.38, 5.42, 6.08, 4.73, 3.83, 6.91, 5.76], sky: [7.43, 6.18, 5.68, 5.94, 4.62, 4.13, 7.15, 6.62],
  periwinkle: [8.03, 6.68, 5.86, 5.95, 4.62, 3.14, 7.13, 7.16], lavender: [8.07, 6.71, 5.86, 5.90, 4.59, 4.61, 7.15, 7.20], graphite: [8.48, 7.05, 7.09, 5.93, 4.61, 7.44, 7.87, 7.56],
};
const accMin = (p, fn, themes = Object.keys(THEMES)) => minOf(themes.map(t => E(fn(ctx(t, p)), t)));
for (const [p, r] of Object.entries(ACC)) {
  const w = `§2.4 accent table, ${p}`;
  claim(`${p} accent-ink/card`, w, r[0], accMin(p, x => cr(x.o('accent-ink'), x.o('surface'))), { thr: 4.5 });
  claim(`${p} accent-ink/page`, w, r[1], accMin(p, x => cr(x.o('accent-ink'), x.o('bg'))), { thr: 4.5 });
  claim(`${p} accent-ink/accent-fill`, w, r[2], accMin(p, x => cr(x.o('accent-ink'), x.o('accent-fill'))), { thr: 4.5 });
  claim(`${p} accent-on/accent-strong`, w, r[3], accMin(p, x => cr(x.o('accent-on'), x.o('accent-strong'))), { thr: 4.5 });
  claim(`${p} strong as text/page (legacy --accent)`, w, r[4], accMin(p, x => cr(x.o('accent'), x.o('bg'))), { thr: 4.5 });
  claim(`${p} graphic/page`, w, r[5], accMin(p, x => cr(x.o('accent-graphic'), x.o('bg'))), { thr: 3 });
  claim(`${p} hero button ink/bg`, w, r[6], accMin(p, x => cr(x.o('hero-btn-ink'), x.o('hero-btn-bg'))), { thr: 4.5 });
  claim(`${p} tab label (accent-ink) on glass-strong over #767676`, w, r[7], accMin(p, x => cr(x.o('accent-ink'), over(x.c('glass-strong'), colour('#767676')))), { thr: 4.5 });
}
claim('lavender graphic on the dark card', '§2.4 table "(dark 3.76 on card)"', 3.76, accMin('lavender', x => cr(x.o('accent-graphic'), x.o('surface')), DARK), { thr: 3 });
const ringAll = minOf(each(x => OPAQUE.flatMap(b => [E(cr(x.o('focus-ring-color'), x.o(b)), `${x.theme}/${x.accent}/${x.mode}/focus/${b}`), E(cr(x.o('today-ring'), x.o(b)), `${x.theme}/${x.accent}/${x.mode}/today/${b}`)]), { modes: Object.keys(MODES) }));
claim('focus and today rings on every surface', '§2.4 other checks / §2.5 / DARK-7 / verification', 3.14, ringAll, { thr: 3 });
claim('selected label sel-ink/sel-fill', '§2.4 other checks', 5.04, minOf(each(x => E(cr(x.o('sel-ink'), x.o('sel-fill')), `${x.theme}/${x.accent}`))), { thr: 4.5 });
claim('progress fill on its own track', '§2.4 other checks', 4.01, minOf(each(x => E(cr(x.o('progress-fill'), x.o('progress-track')), `${x.theme}/${x.accent}/${x.mode}`), { modes: Object.keys(MODES) })), { thr: 3 });
claim('hero button in dark', '§2.4 other checks "≥ 7.03"', 7.03, minOf(each(x => E(cr(x.o('hero-btn-ink'), x.o('hero-btn-bg')), `${x.theme}/${x.accent}`), { themes: DARK })), { thr: 4.5 });
claim('hero button, all palettes (ACCENT-4)', 'ACCENT-4 "≥ 6.58"', 6.58, minOf(each(x => E(cr(x.o('hero-btn-ink'), x.o('hero-btn-bg')), `${x.theme}/${x.accent}`))), { thr: 4.5 });
claim('dark accent-ink on cards', 'DARK-3 "≥ 10.53 on cards"', 10.53, minOf(each(x => E(cr(x.o('accent-ink'), x.o('surface')), `${x.theme}/${x.accent}`), { themes: DARK })), { thr: 4.5 });
claim('dark accent-graphic on every surface', 'DARK-3 "≥ 3.28"', 3.28, minOf(each(x => OPAQUE.map(b => E(cr(x.o('accent-graphic'), x.o(b)), `${x.theme}/${x.accent}/${b}`)), { themes: DARK })), { thr: 3 });
claim('text, text-2, text-3 on --accent-wash (F260 body.nt paper)', 'migration table (F260) / COLOR-4 "≥ 5.48"', 5.48, minOf(each(x => ['text', 'text-2', 'text-3'].map(f => E(cr(x.o(f), over(x.c('accent-wash'), x.o('bg'))), `${x.theme}/${x.accent}/${f}`)))), { thr: 4.5 });
claim('dark --accent-soft (= accent-fill) off the card', 'migration table "--accent-soft ≥ 1.52"', 1.52, minOf(each(x => E(cr(x.o('accent-soft'), x.o('surface')), `${x.theme}/${x.accent}`), { themes: DARK })), { thr: 1.5 });
claim('tile glyph accent-ink on accent-fill-strong', 'ICON-3 / §10 "≥ 3.26"', 3.26, minOf(each(x => E(cr(x.o('accent-ink'), x.o('accent-fill-strong')), `${x.theme}/${x.accent}`))), { thr: 3 });

// ── 5.7 CVD separation (§2.4 table + ACCENT-8 + ACCENT-7 context) ──
const CVD_STATED = {
  light: { normal: [14.61, 'mint/aqua'], protan: [11.27, 'peach/mint'], deutan: [11.03, 'sky/lavender'], tritan: [5.14, null], fill: { normal: 7.85, protan: 1.09, deutan: 0.48 }, fillPair: 'periwinkle/lavender' },
  dark: { normal: [13.25, 'sky/periwinkle'], protan: [12.67, 'aqua/graphite'], deutan: [12.76, 'sky/periwinkle'], tritan: [5.26, null], fill: { normal: 7.24, protan: 1.31, deutan: 0.58 }, fillPairs: { protan: 'periwinkle/lavender', deutan: 'sky/periwinkle' } },
};
const cvdMin = (themes, set, role, vis) => { let best = null; for (const t of themes) { const x = ctx(t); for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) { const d = dE(x.o(`${set[i]}-${role}`), x.o(`${set[j]}-${role}`), vis); if (!best || d < best.v) best = E(d, `${t} ${set[i]}/${set[j]}`); } } return best; };
const cvdAll = {};
for (const [sch, st] of Object.entries(CVD_STATED)) {
  const ths = sch === 'light' ? LIGHT : DARK;
  for (const vis of ['normal', 'protan', 'deutan', 'tritan']) {
    const m = cvdMin(ths, PEOPLE, 'graphic', vis); (cvdAll[sch] ??= {})[vis] = m;
    claim(`CVD ${sch} person graphics ${vis}`, '§2.4 CVD table', st[vis][0], m, { thr: vis === 'tritan' ? null : 10, note: vis === 'tritan' ? 'reported, not gated' : '' });
    if (st[vis][1]) claims.push({ id: `CVD ${sch} graphics ${vis} closest pair`, where: '§2.4 CVD table', stated: st[vis][1], computed: m.at, match: m.at.endsWith(st[vis][1]) || m.at.endsWith(st[vis][1].split('/').reverse().join('/')), meetsThreshold: null });
  }
  for (const vis of ['normal', 'protan', 'deutan']) { const m = cvdMin(ths, HUES, 'fill', vis); claim(`CVD ${sch} pastel fills ${vis} (reported)`, '§2.4 CVD table', st.fill[vis], m, { note: 'reported, not gated; 8 hues' }); }
}
claim('ACCENT-8 "graphics ≥ 11.03 under CVD" (min over protan/deutan, both schemes)', 'ACCENT-8 / verification cvd row', 11.03, minOf(['light', 'dark'].flatMap(s => ['protan', 'deutan'].map(v => cvdAll[s][v]))), { thr: 10 });
{ // today's person colours (worker/seed.sql:4-11), for the "4.8 protan / 2.1 deutan" comparison (Table ACCENT-7)
  const today = ['#4F5D8C', '#BC5A38', '#137F77', '#B4861B', '#8A6A4B', '#3D5A3D', '#5B8143', '#4C4C58'].map(colour);
  const mm = vis => { let b = Infinity; for (let i = 0; i < today.length; i++) for (let j = i + 1; j < today.length; j++) b = Math.min(b, dE(today[i], today[j], vis)); return b; };
  claims.push({ id: "today's person colours protanopia min ΔE00 (8 seed colours incl. TV)", where: '§2.4 "4.8 apart under protanopia"', stated: 4.8, computed: +mm('protan').toFixed(2), match: Math.abs(mm('protan') - 4.8) <= 0.1, meetsThreshold: null, note: '1 dp, ±0.1' });
  claims.push({ id: "today's person colours deuteranopia min ΔE00", where: '§2.4 "2.1 under deuteranopia"', stated: 2.1, computed: +mm('deutan').toFixed(2), match: Math.abs(mm('deutan') - 2.1) <= 0.1, meetsThreshold: null, note: '1 dp, ±0.1' });
}

// ── 5.8 §2.5 other roles ──
const ui = (fg, bgs, modes = Object.keys(MODES), people = ['graphite']) => minOf(each(x => bgs.map(b => E(cr(x.o(fg), x.o(b)), `${x.theme}/${x.mode}/${b}`)), { people, modes }));
claim('switch-on vs card', '§2.5 "on ≥ 3.93"', 3.93, ui('switch-on', ['surface']), { thr: 3 });
claim('switch-off-ring on every opaque surface', '§2.5 "ring ≥ 3.03"', 3.03, ui('switch-off-ring', OPAQUE), { thr: 3 });
claim('cell-empty on every opaque surface', '§2.5 "≥ 3.03"', 3.03, ui('cell-empty', OPAQUE), { thr: 3 });
claim('--muted-decor on every opaque surface', '§2.5 / migration / TOK-5 "≥ 3.03"', 3.03, ui('muted-decor', OPAQUE), { thr: 3 });
claim('--field-border on every opaque surface (all modes)', 'verification non-text "3.03"', 3.03, ui('field-border', OPAQUE), { thr: 3 });
const statusOn = bns => minOf(each(x => ['status-offline', 'status-pending', 'status-synced', 'status-error'].flatMap(s => bns.map(bn => E(cr(x.o(s), over(x.c('glass-strong'), BACKS(x)[bn])), `${x.theme}/${x.mode}/${s}/over ${bn}`))), { people: ['graphite'], modes: Object.keys(MODES) }));
claim('status dots on the glass tab bar over #767676', '§2.5 "≥ 3.29 on the glass tab bar over #767676"', 3.29, statusOn(['mid']), { thr: 3 });
claim('status dots on glass-strong over page, card and #767676', 'verification non-text "status dots on glass 3.29"', 3.29, statusOn(['bg', 'surface', 'mid']), { thr: 3 });
claim('map-north on glass-strong (page, card, #767676)', '§2.5 "north ≥ 3 on glass"', 3, minOf(each(x => ['bg', 'surface', 'mid'].map(bn => E(cr(x.o('map-north'), over(x.c('glass-strong'), BACKS(x)[bn])), `${x.theme}/${x.mode}/${bn}`)), { people: ['graphite'], modes: Object.keys(MODES) })), { thr: 3, note: 'stated as a threshold, not a measured minimum' }); claims[claims.length - 1].match = claims[claims.length - 1].meetsThreshold;
claim('glass-inverse-ink on glass-inverse, every backdrop', '§2.5 "≥ 6.53"', 6.53, minOf(each(x => Object.entries(BACKS(x)).map(([bn, b]) => E(cr(x.o('glass-inverse-ink'), over(x.c('glass-inverse'), b)), `${x.theme}/${x.mode}/${bn}`)), { people: ['graphite'], modes: Object.keys(MODES) })), { thr: 4.5 });
claim('star-stroke on every opaque surface', '§2.5 "stroke ≥ 5.12"', 5.12, ui('star-stroke', OPAQUE), { thr: 3 });
{ const tv = tok => minOf(Object.keys(THEMES).flatMap(t => { const x = ctx(t, 'graphite', 'kiosk'); const photos = { white: colour('#FFFFFF'), black: colour('#000000'), mid: colour('#767676'), ...Object.fromEntries(FAM.flatMap(f => [[`${f}-fill`, x.o(`${f}-fill`)], [`${f}-fill-strong`, x.o(`${f}-fill-strong`)]])) }; return Object.entries(photos).map(([pn, ph]) => E(cr(x.o(tok), over(x.c('tv-panel'), ph)), `${t}/${pn}`)); }));
  claim('tv-text over tv-panel over any photo', '§2.5 "≥ 7.26"', 7.26, tv('tv-text'), { thr: 7 }); claim('tv-text-2 over tv-panel over any photo', '§2.5 "≥ 5.11"', 5.11, tv('tv-text-2'), { thr: 4.5 }); }
claim('chevron-colour on fill-field', '§2.5 "≥ 3 on the field"', 3, ui('chevron-colour', ['fill-field']), { thr: 3, note: 'stated as a threshold' }); claims[claims.length - 1].match = claims[claims.length - 1].meetsThreshold;
for (const [grp, toks, why] of [['cat-1…8', ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-8'], '§2.5 "≥ 3"'], ['fresh/aging/use-soon', ['fresh', 'aging', 'use-soon'], '§2.5 "≥ 3"']]) {
  const m = minOf(toks.map(tk => ui(tk, OPAQUE))); claim(`${grp} on every opaque surface`, why, 3, m, { thr: 3, note: 'stated as a threshold' }); claims[claims.length - 1].match = claims[claims.length - 1].meetsThreshold;
}
{ const m = minOf(['short', 'medium', 'long', 'closed'].map(k => minOf(each(x => E(cr(x.o(`wait-${k}-ink`), x.o(`wait-${k}`)), `${x.theme}/${x.mode}/${k}`), { people: ['graphite'], modes: Object.keys(MODES) }))));
  claim('wait band ink on its fill', '§2.5 "ink ≥ 4.5 on its fill"', 4.5, m, { thr: 4.5, note: 'stated as a threshold' }); claims[claims.length - 1].match = claims[claims.length - 1].meetsThreshold; }

// ── 5.9 §7 glass, verification text minima ──
const allModes = Object.keys(MODES);
const glassText = (fg, g, bns, modes, sheen = false) => minOf(each(x => bns.map(bn => { let c = over(x.c(g), BACKS(x)[bn]); if (sheen) c = over(x.c('glass-spec'), c); return E(cr(x.o(fg), c), `${x.theme}/${x.accent}/${x.mode}/${g}${sheen ? '+sheen' : ''}/over ${bn}`); }), { modes }));
claim('primary text on opaque surfaces', 'verification "11.72"', 11.72, txtOn('text', OPAQUE, allModes), { thr: 7 });
claim('primary text on glass (fill alone) over the worst backdrop', '§7 / verification "7.02"', 7.02, minOf([glassText('text', 'glass', ['worst'], allModes), glassText('text', 'glass-strong', ['worst'], allModes)]), { thr: 7 });
claim('secondary text on glass (fill alone) over the worst backdrop', '§7 / verification "5.24"', 5.24, minOf([glassText('text-2', 'glass', ['worst'], allModes), glassText('text-2', 'glass-strong', ['worst'], allModes)]), { thr: 4.5 });
claim('primary text under the full sheen on glass-strong, worst backdrop', '§7 gated / verification "8.23"', 8.23, glassText('text', 'glass-strong', ['bg', 'surface', 'mid', 'worst'], allModes, true), { thr: 7 });
claim('secondary text under the full sheen on glass-strong, worst backdrop', '§7 gated / verification "6.15"', 6.15, glassText('text-2', 'glass-strong', ['bg', 'surface', 'mid', 'worst'], allModes, true), { thr: 4.5 });
claim('secondary text on page, card and sheet', 'verification "8.14 (≥ 6)"', 8.14, txtOn('text-2', PAGE_CARD_SHEET, allModes), { thr: 6 });
claim('secondary text on wells', 'verification "7.50 on wells"', 7.50, txtOn('text-2', WELLS, allModes), { thr: 4.5 });
{ const rep = ['adult', 'contrast-more'];
  claim('--glass under the full sheen over page and cards: primary', '§7 reported "≥ 11.26"', 11.26, glassText('text', 'glass', ['bg', 'surface'], rep, true));
  claim('--glass under the full sheen over page and cards: secondary', '§7 reported "≥ 8.43"', 8.43, glassText('text-2', 'glass', ['bg', 'surface'], rep, true));
  claim('--glass under the full sheen over #767676: primary', '§7 reported "8.90"', 8.90, glassText('text', 'glass', ['mid'], rep, true));
  claim('--glass under the full sheen over #767676: secondary', '§7 reported "6.62"', 6.62, glassText('text-2', 'glass', ['mid'], rep, true));
  claim('--glass under the full sheen over the worst backdrop: primary', '§7 reported "5.95 over a white photo"', 5.95, glassText('text', 'glass', ['worst'], rep, true));
  claim('--glass under the full sheen over the worst backdrop: secondary', '§7 reported "4.42"', 4.42, glassText('text-2', 'glass', ['worst'], rep, true));
  const pick = (role, bn) => minOf(each(x => { const p = colour(`color-mix(in srgb, ${x.raw('accent-strong')} ${x.raw('glass-pickup')}, transparent)`); return E(cr(x.o(`accent-${role}`), over(p, over(x.c('glass-strong'), BACKS(x)[bn]))), `${x.theme}/${x.accent}/${x.mode}`); }, { modes: rep }));
  for (const [bn, si, sl] of [['bg', 2.77, 5.10], ['mid', 2.42, 4.66], ['worst', 2.02, 4.20]]) {
    claim(`tab icon (accent-graphic) under the full pickup over ${bn}`, '§7 pickup table (reported)', si, pick('graphic', bn));
    claim(`tab label (accent-ink) under the full pickup over ${bn}`, '§7 pickup table (reported)', sl, pick('ink', bn));
  }
}
const tabNoPick = role => minOf(each(x => ['bg', 'surface', 'mid'].map(bn => E(cr(x.o(`accent-${role}`), over(x.c('glass-strong'), BACKS(x)[bn])), `${x.theme}/${x.accent}/${x.mode}/over ${bn}`)), { modes: allModes }));
claim('tab icon on glass-strong without the pickup', '§7 "icon ≥ 3.31 (gated)"', 3.31, tabNoPick('graphic'), { thr: 3 });
claim('tab label on glass-strong without the pickup', '§7 / verification "5.48"', 5.48, tabNoPick('ink'), { thr: 4.5 });
{ // verification-table kind minima, as contrast.mjs defines each kind
  const textHi = minOf(each(x => FAM.flatMap(f => ['fill', ...OPAQUE].map(b => E(cr(x.o(`${f}-ink-hi`), b === 'fill' ? x.o(`${f}-fill`) : x.o(b)), `${x.theme}/${x.mode}/${f}-ink-hi/${b}`))), { people: ['graphite'], modes: allModes }));
  claim('text-hi kind (ink-hi on fill and every surface)', 'verification "7.01"', 7.01, textHi, { thr: 7 });
  const graphic = [];
  for (const t of Object.keys(THEMES)) for (const m of allModes) { const x = ctx(t, 'graphite', m);
    for (const f of FAM) { graphic.push(E(cr(x.o(`${f}-ink`), x.o(`${f}-fill-strong`)), `${t}/${m}/${f} tile glyph`)); graphic.push(E(cr(x.o(`${f}-strong`), x.o(`${f}-fill`)), `${t}/${m}/${f} strong on fill`));
      for (const b of OPAQUE) { graphic.push(E(cr(x.o(`${f}-graphic`), x.o(b)), `${t}/${m}/${f}-graphic/${b}`)); if (SEM.includes(f)) graphic.push(E(cr(x.o(`${f}-strong`), x.o(b)), `${t}/${m}/${f}-strong/${b}`)); } } }
  graphic.push(...each(x => [E(cr(x.o('accent-ink'), x.o('accent-fill-strong')), `${x.theme}/${x.accent}/${x.mode} tile`), ...['bg', 'surface', 'mid'].map(bn => E(cr(x.o('accent-graphic'), over(x.c('glass-strong'), BACKS(x)[bn])), `${x.theme}/${x.accent}/${x.mode} tab icon/${bn}`))], { modes: allModes }));
  claim('graphic kind lowest', 'verification "3.07"', 3.07, gate('graphic kind (identity marks, tile glyphs, semantic strong, tab icon, progress)', 3, graphic), { thr: 3 });
  claim('large-text kind (accent-graphic and timer-done numerals on every surface)', 'verification "3.14"', 3.14, gate('large numerals', 3, each(x => OPAQUE.flatMap(b => [E(cr(x.o('accent-graphic'), x.o(b)), `${x.theme}/${x.accent}/${x.mode}/graphic/${b}`), E(cr(x.o('timer-done'), x.o(b)), `${x.theme}/${x.accent}/${x.mode}/timer-done/${b}`)]), { modes: allModes })), { thr: 3 });
  claim('dark chips off every card (all modes)', 'verification depth "1.52"', 1.52, gate('dark chip fill off the card', 1.5, each(x => FAM.map(f => E(cr(x.o(`${f}-fill`), x.o('surface')), `${x.theme}/${x.mode}/${f}`)), { themes: DARK, people: ['graphite'], modes: allModes })), { thr: 1.5 });
  const Cs = [...LIGHT, ...DARK].flatMap(t => FAM.filter(f => f !== 'graphite').map(f => E(oklchC(ctx(t).o(`${f}-fill`)), `${t}/${f}`)));
  const cm = minOf(Cs); claims.push({ id: 'fill chroma C minimum (non-graphite families, both schemes)', where: 'verification "fill C ≥ 0.057"', stated: 0.057, computed: +cm.v.toFixed(3), at: cm.at, match: Math.abs(cm.v - 0.057) <= 0.0015, meetsThreshold: null });
}

// ── 5.10 full gates (every pair against its threshold; mirrors the grading the section describes) ──
{
  const ALL = { modes: allModes };
  gate('text ≥ 7 on every opaque surface', 7, each(x => OPAQUE.map(b => E(cr(x.o('text'), x.o(b)), `${x.theme}/${x.mode}/${b}`)), { ...ALL, people: ['graphite'] }));
  gate('text-2 ≥ 6 on page/card/sheet (7 in 7:1 modes via its own gate)', 6, each(x => PAGE_CARD_SHEET.map(b => E(cr(x.o('text-2'), x.o(b)), `${x.theme}/${x.mode}/${b}`)), { ...ALL, people: ['graphite'] }));
  gate('text-2/text-3/placeholder ≥ 7 in the 7:1 modes', 7, each(x => ['text-2', 'text-3', 'placeholder'].flatMap(f => OPAQUE.map(b => E(cr(x.o(f), x.o(b)), `${x.theme}/${x.mode}/${f}/${b}`))), { people: ['graphite'], modes: HIMODES }));
  gate('person accent-ink ≥ 4.5 on every opaque surface (≥ 7 checked next)', 4.5, each(x => OPAQUE.map(b => E(cr(x.o('accent-ink'), x.o(b)), `${x.theme}/${x.accent}/${x.mode}/${b}`)), ALL));
  gate('person accent-ink ≥ 7 on every opaque surface in the 7:1 modes', 7, each(x => OPAQUE.map(b => E(cr(x.o('accent-ink'), x.o(b)), `${x.theme}/${x.accent}/${x.mode}/${b}`)), { modes: HIMODES }));
  gate('accent-on/accent-strong ≥ 7 in the 7:1 modes', 7, each(x => E(cr(x.o('accent-on'), x.o('accent-strong')), `${x.theme}/${x.accent}/${x.mode}`), { modes: HIMODES }));
  gate('sel-ink/sel-fill ≥ 4.5 (all modes)', 4.5, each(x => E(cr(x.o('sel-ink'), x.o('sel-fill')), `${x.theme}/${x.accent}/${x.mode}`), ALL));
  gate('sel-ink/sel-fill ≥ 7 in the 7:1 modes', 7, each(x => E(cr(x.o('sel-ink'), x.o('sel-fill')), `${x.theme}/${x.accent}/${x.mode}`), { modes: HIMODES }));
  gate('sel-ink on sel-fill inside the bar (glass-strong over page/card/#767676) ≥ 4.5', 4.5, each(x => ['bg', 'surface', 'mid'].map(bn => E(cr(x.o('sel-ink'), over(x.c('sel-fill'), over(x.c('glass-strong'), BACKS(x)[bn]))), `${x.theme}/${x.accent}/${x.mode}/${bn}`)), ALL));
  gate('hero ink on --hero-bg stops (wash, fill) ≥ 4.5', 4.5, each(x => ['accent-wash', 'accent-fill'].map(s => E(cr(x.o('accent-ink'), x.o(s)), `${x.theme}/${x.accent}/${x.mode}/${s}`)), ALL));
  gate('hero-btn ink/bg ≥ 7 in the 7:1 modes', 7, each(x => E(cr(x.o('hero-btn-ink'), x.o('hero-btn-bg')), `${x.theme}/${x.accent}/${x.mode}`), { modes: HIMODES }));
  gate('legacy --accent/--tint/--accent-deep/--tint-ink as text ≥ 4.5', 4.5, each(x => ['accent', 'tint', 'accent-strong', 'accent-deep', 'tint-ink'].flatMap(n => OPAQUE.map(b => E(cr(x.o(n), x.o(b)), `${x.theme}/${x.accent}/${x.mode}/--${n}/${b}`))), ALL));
  gate('legacy hue aliases as text (gold … info, muted) ≥ 4.5', 4.5, each(x => ['gold', 'olive', 'teal', 'terra', 'slate', 'mocha', 'ok', 'warn', 'danger', 'info', 'gold-ink', 'olive-ink', 'teal-ink', 'terra-ink', 'slate-ink', 'mocha-ink', 'ok-ink', 'warn-ink', 'muted'].flatMap(n => OPAQUE.map(b => E(cr(x.o(n), x.o(b)), `${x.theme}/${x.mode}/--${n}/${b}`))), { ...ALL, people: ['graphite'] }));
  gate('legacy on-accent/--accent ≥ 4.5', 4.5, each(x => E(cr(x.o('on-accent'), x.o('accent')), `${x.theme}/${x.accent}/${x.mode}`), ALL));
  gate('focus/today/sel-fill-strong ≥ 3 on every opaque surface', 3, each(x => ['focus-ring-color', 'today-ring', 'sel-fill-strong'].flatMap(n => OPAQUE.map(b => E(cr(x.o(n), x.o(b)), `${x.theme}/${x.accent}/${x.mode}/${n}/${b}`))), ALL));
  gate('toast-ink over the toast ≥ 7', 7, each(x => Object.entries(BACKS(x)).map(([bn, b]) => E(cr(x.o('toast-ink'), over(x.c('toast-bg'), b)), `${x.theme}/${x.mode}/${bn}`)), { ...ALL, people: ['graphite'] }));
  gate('text-3 on glass (fill alone) over page/card/#767676 ≥ 4.5', 4.5, each(x => ['glass', 'glass-strong'].flatMap(g => ['bg', 'surface', 'mid'].map(bn => E(cr(x.o('text-3'), over(x.c(g), BACKS(x)[bn])), `${x.theme}/${x.accent}/${x.mode}/${g}/${bn}`))), ALL));
  gate('family ink ≥ 7 on fill/wash/every surface in the 7:1 modes', 7, each(x => FAM.flatMap(f => ['fill', 'wash', ...OPAQUE].map(b => E(cr(x.o(`${f}-ink`), b === 'fill' || b === 'wash' ? x.o(`${f}-${b}`) : x.o(b)), `${x.theme}/${x.mode}/${f}/${b}`))), { people: ['graphite'], modes: HIMODES }));
  gate('person family strong as text ≥ 4.5 on every surface (all modes)', 4.5, each(x => PEOPLE.flatMap(f => OPAQUE.map(b => E(cr(x.o(`${f}-strong`), x.o(b)), `${x.theme}/${x.mode}/${f}/${b}`))), { people: ['graphite'], modes: allModes }));
}

// ── 5.11 labelled legacy backgrounds, read from the shipped CSS (as written) and their batch-1a rewrites ──
// Each rule is transcribed from the cited file:line; the colours are evaluated by this script's own cascade.
const TPL = '../dollywood-build-project/scripts/template.html';
const LABELS = [   // [at, background, label, threshold, locals, rewrite {bg,label} | null]
  ['index.html:210 .feed .ficon', 'color-mix(in srgb, var(--tint) 14%, var(--surface))', 'var(--tint-ink, var(--text))', 3, null, null],
  ['index.html:249 .msg.user', 'linear-gradient(180deg, color-mix(in srgb, var(--accent-deep) 88%, white), var(--accent-deep))', 'var(--on-accent)', 4.5, null, ['var(--accent-fill)', 'var(--accent-ink)']],
  ['apps/design.css:361 .ds .btn-primary', 'linear-gradient(180deg, color-mix(in srgb, var(--accent-deep) 88%, white) 0%, var(--accent-deep) 100%)', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  ['apps/design.css:410-412 .ds .hero', 'radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--accent) 70%, white) 0%, var(--accent) 45%, var(--accent-deep) 100%)', 'var(--on-accent)', 4.5, null, ['linear-gradient(160deg, var(--accent-wash), var(--accent-fill))', 'var(--accent-ink)']],
  ['apps/design.css:492-493 .ds .avatar', 'radial-gradient(120% 120% at 30% 20%, color-mix(in srgb, var(--tint) 30%, var(--surface)), color-mix(in srgb, var(--tint) 55%, var(--surface)))', 'var(--text)', 4.5, null, ['var(--accent-fill)', 'var(--accent-ink)']],
  ['apps/design.css:501 .ds .person-chip', 'color-mix(in srgb, var(--tint) 14%, var(--surface))', 'color-mix(in srgb, var(--tint) 70%, var(--text))', 4.5, null, null],
  ['apps/design.css:516 .ds .badge', 'var(--danger)', '#fff', 4.5, null, ['var(--badge-bg)', 'var(--badge-ink)']],
  ['apps/design.css:607-608 .ds .app-icon', 'linear-gradient(160deg, color-mix(in srgb, var(--tint) 22%, var(--surface)), color-mix(in srgb, var(--tint) 8%, var(--surface)))', 'var(--tint)', 3, null, null],
  ['apps/f260.html:144 .tdone', 'var(--olive)', 'var(--on-solid)', 4.5, 'f260', ['var(--success-strong)', 'var(--success-on)']],
  ['apps/f260.html:208 .btn.primary', 'var(--slate)', 'var(--on-accent)', 4.5, null, ['var(--periwinkle-strong)', 'var(--periwinkle-on)']],
  ['apps/f260.html:308 .nextwk .btn', 'var(--olive)', 'var(--on-solid)', 4.5, 'f260', ['var(--mint-strong)', 'var(--mint-on)']],
  ['apps/f260.html:392 .modal .btn.danger', 'var(--terra)', 'var(--on-solid)', 4.5, 'f260', ['var(--danger-strong)', 'var(--danger-on)']],
  ['apps/f260.html:412 .modal .btn.got', 'var(--olive)', 'var(--on-solid)', 4.5, 'f260', ['var(--success-strong)', 'var(--success-on)']],
  ['apps/kidverse.html:88 .badges li.on .bicon', 'var(--gold)', 'var(--on-accent)', 3, null, ['var(--butter-strong)', 'var(--butter-on)']],
  ['apps/leftovers.html:54-55 .log', 'var(--ledger)', 'var(--ledger-ink)', 4.5, 'leftovers', ['var(--success-strong)', 'var(--success-on)']],
  ['apps/prayer.html:191 .chip[aria-pressed=true]', 'var(--accent-deep)', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  ['apps/prayer.html:193 button.act', 'var(--accent-deep)', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  ['apps/prayer.html:350 #pray .ctrl button.go', 'var(--accent-deep)', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  ['apps/prayer.html:422 .kid .prayed', 'var(--accent-deep)', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  ['apps/verses.html:59 .btn.got.btn-primary', 'var(--olive)', 'var(--on-accent)', 4.5, null, ['var(--success-strong)', 'var(--success-on)']],
  [TPL + ':28 button[aria-pressed=true]', 'var(--forest)', 'var(--on-accent)', 4.5, 'template', ['var(--mint-strong)', 'var(--mint-on)']],
  [TPL + ':225 [data-flavor=hub] button[aria-pressed=true]', 'var(--accent-deep)', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  [TPL + ':244 .chips button[aria-pressed=true]', 'var(--accent-deep)', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  [TPL + ':412 .fab-primary', 'radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 60%,white),var(--accent) 75%)', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  [TPL + ':428 .lv-tabs button[aria-pressed=true]', 'color-mix(in srgb,var(--accent) 18%,transparent)', 'var(--text)', 4.5, null, null],
  [TPL + ':453 .lv-gobtn', 'var(--accent-deep)', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  [TPL + ':458 .lv-turn', 'var(--accent-deep,var(--accent))', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  [TPL + ':471 .lv-step .n', 'color-mix(in srgb,var(--accent) 22%,transparent)', 'var(--text)', 4.5, null, null],
  [TPL + ':472 .lv-step.now .n', 'var(--accent-deep)', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  [TPL + ':503 .lv-chips button[aria-pressed=true]', 'var(--accent-deep,var(--accent))', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
  [TPL + ':523 .lv-from', 'color-mix(in srgb,var(--accent) 18%,transparent)', 'var(--text)', 4.5, null, null],
  [TPL + ':556 .lv-act', 'var(--accent-deep,var(--accent))', 'var(--on-accent)', 4.5, null, ['var(--accent-strong)', 'var(--accent-on)']],
];
// file-local definitions: apps/f260.html:26-28 (--on-solid white; dark: var(--on-accent)), apps/leftovers.html:14, template.html:212
const LOCALS = { f260: s => ({ '--on-solid': s === 'dark' ? 'var(--on-accent)' : 'white' }), leftovers: () => ({ '--ledger': 'var(--olive-ink)', '--ledger-ink': 'var(--surface)' }), template: () => ({ '--forest': 'var(--olive-ink)', '--moss': 'var(--olive)' }) };
function evalExpr(x, expr, locals) {  // substitute var() against the root cascade plus file locals, then return colour stops
  const resolveVars = (s, depth = 0) => {
    if (depth > 20) throw new Error('var depth');
    let out = '', i = 0;
    while (i < s.length) {
      const k = s.indexOf('var(', i); if (k < 0) { out += s.slice(i); break; }
      out += s.slice(i, k); let d = 0, j = k + 3; for (; j < s.length; j++) { if (s[j] === '(') d++; else if (s[j] === ')' && --d === 0) break; }
      const inner = s.slice(k + 4, j); const ci = inner.indexOf(','); const name = (ci < 0 ? inner : inner.slice(0, ci)).trim(); const fb = ci < 0 ? undefined : inner.slice(ci + 1).trim();
      let v = locals && name in locals ? resolveVars(locals[name], depth + 1) : x.raw(name);
      if (v === undefined) { if (fb === undefined) throw new Error('unresolved ' + name); v = resolveVars(fb, depth + 1); }
      out += v; i = j + 1;
    }
    return out;
  };
  const s = resolveVars(expr).trim();
  const g = s.match(/^(linear|radial)-gradient\(([\s\S]*)\)$/);
  if (!g) return [colour(s)];
  const parts = splitTop(g[2], ',');
  const stops = [];
  for (const p of parts) { const q = p.replace(/(\s+-?[\d.]+%)+$/, '').trim(); try { stops.push(colour(q)); } catch { /* the direction / shape argument */ } }
  return stops;
}
const labelRows = [];
for (const [at, bg, label, thr, loc, rw] of LABELS) {
  const run = (b, l) => { let best = null; for (const t of Object.keys(THEMES)) for (const p of PEOPLE) { const x = ctx(t, p); const locals = loc ? LOCALS[loc](x.scheme) : null;
    const lab_ = evalExpr(x, l, locals)[0]; for (const st of evalExpr(x, b, locals)) { const bgc = st[3] < 0.999 ? over(st, x.o('surface')) : st; const bgc2 = st[3] < 0.999 ? over(st, x.o('bg')) : st;
      for (const c of [bgc, bgc2]) { const v = cr(lab_, c); if (!best || v < best.v) best = E(v, `${t}/${p}`); } } } return best; };
  const asW = run(bg, label); const row = { at, threshold: thr, asWritten: +asW.v.toFixed(2), worst: asW.at, passesAsWritten: asW.v >= thr };
  if (rw) { const r = run(rw[0], rw[1]); row.rewrite = rw; row.rewriteMin = +r.v.toFixed(2); row.rewriteWorst = r.at; row.rewritePasses = r.v >= 4.5; }
  labelRows.push(row);
}
{ const L = n => labelRows.find(r => r.at.includes(n));
  const stated = [['.ds .badge', 'asWritten', 1.49], ['.ds .badge', 'rewriteMin', 6.42], ['.ds .hero', 'asWritten', 3.10], ['.ds .hero', 'rewriteMin', 5.04], ['.ds .avatar', 'asWritten', 3.57], ['.ds .avatar', 'rewriteMin', 5.04], [':412 .fab-primary', 'asWritten', 2.56], [':412 .fab-primary', 'rewriteMin', 5.90]];
  for (const [n, k, s] of stated) { const r = L(n); claims.push({ id: `labelled background ${n} ${k === 'asWritten' ? 'as written' : 'after the batch-1a rewrite'}`, where: 'migration §2 "four that fail as written"', stated: s, computed: r[k], at: k === 'asWritten' ? r.worst : r.rewriteWorst, match: Math.abs(r[k] - s) <= TOL, meetsThreshold: k === 'asWritten' ? null : r[k] >= 4.5 }); }
  const fails = labelRows.filter(r => !r.passesAsWritten).map(r => r.at);
  claims.push({ id: 'labelled backgrounds failing as written (count)', where: 'migration §2 table "Fail as written 4"', stated: 4, computed: fails.length, match: fails.length === 4, meetsThreshold: null, note: fails.join('; ') });
  const passRw = labelRows.filter(r => r.passesAsWritten && r.rewrite).length, passNo = labelRows.filter(r => r.passesAsWritten && !r.rewrite);
  claims.push({ id: 'labelled backgrounds passing as written with a rewrite (count)', where: 'migration §2 table "22"', stated: 22, computed: passRw, match: passRw === 22, meetsThreshold: null });
  claims.push({ id: 'labelled backgrounds passing as written, no rewrite (count)', where: 'migration §2 table "6"', stated: 6, computed: passNo.length, match: passNo.length === 6, meetsThreshold: null });
  const rwMin = minOf(labelRows.filter(r => r.rewrite).map(r => E(r.rewriteMin, r.at)));
  claim('every labelled-background rewrite', 'migration §2 "Every rewrite passes (≥ 4.77)" / verification "rewrites ≥ 4.77"', 4.77, rwMin, { thr: 4.5 });
  const icon = L('.ds .app-icon'); claim('tile icon (.ds .app-icon) as written', 'migration §2 "≥ 3.87 for the tile icon" / verification', 3.87, E(icon.asWritten, icon.worst), { thr: 3 });
  const textNoRw = minOf(passNo.filter(r => r.threshold === 4.5).map(r => E(r.asWritten, r.at)));
  claim('"tints carrying a text colour" (threshold 4.5, no rewrite) as written', 'migration §2 "≥ 5.04 for text" / verification "labelled tints … 5.04 (text)"', 5.04, textNoRw, { thr: 4.5 });
  const ficon = L('.feed .ficon'); claims.push({ id: '.feed .ficon (an icon, threshold 3) as written', where: 'context for the 5.04 above', stated: '—', computed: ficon.asWritten, at: ficon.worst, match: true, meetsThreshold: ficon.asWritten >= 3, note: 'informational' });
}

// ── 5.12 the reasons the section gives, checked ──
{ // §2.2a: "swapping the semantic solids to ink-hi collapses warning against danger to a luminance ratio of 1.00"
  const v = minOf(Object.keys(THEMES).map(t => E(cr(ctx(t).o('warning-ink-hi'), ctx(t).o('danger-ink-hi')), t)));
  claims.push({ id: 'warning-ink-hi vs danger-ink-hi luminance ratio (why the semantic solids are not swapped)', where: '§2.2a "collapses … to 1.00"', stated: 1.00, computed: +v.v.toFixed(2), at: v.at, match: Math.abs(v.v - 1.0) <= TOL, meetsThreshold: null });
  // migration table: --line-soft → --separator, "about 1.1-1.2:1"
  const seps = each(x => ['bg', 'surface'].map(b => E(cr(over(x.c('separator'), x.o(b)), x.o(b)), `${x.theme}/${b}`)), { people: ['graphite'] });
  const lo = minOf(seps), hi = maxOf(seps);
  claims.push({ id: '--separator (legacy --line-soft) against its ground, range', where: 'migration table "about 1.1-1.2:1"', stated: '1.1-1.2', computed: `${lo.v.toFixed(2)}-${hi.v.toFixed(2)}`, at: `${lo.at} … ${hi.at}`, match: lo.v >= 1.05 && hi.v <= 1.25, meetsThreshold: null, note: 'decorative; approximate claim' });
}
{ // ACCENT-3: "--sel-fill (the pastel) is under 3:1 against the card, so the non-colour cue is required"
  const m = maxOf(each(x => E(cr(x.o('sel-fill'), x.o('surface')), `${x.theme}/${x.accent}/${x.mode}`), { modes: Object.keys(MODES) }));
  claims.push({ id: 'sel-fill vs card, maximum (must stay under 3 for the claim to hold)', where: 'ACCENT-3', stated: '< 3', computed: +m.v.toFixed(2), at: m.at, match: m.v < 3, meetsThreshold: null });
}
// Rounded-up minima: a "≥ X" whose true minimum rounds to X only when rounded up (within tolerance, reported separately)
const roundedUp = claims.filter(c => typeof c.stated === 'number' && typeof c.computed === 'number' && c.match && c.threshold !== null && c.computed < c.stated - 1e-9).map(c => ({ id: c.id, where: c.where, stated: c.stated, computed: c.computed, at: c.at }));

// ═════════════════════════ 6. report ═════════════════════════
const numeric = claims.filter(c => typeof c.stated === 'number' || typeof c.computed === 'number');
const mism = claims.filter(c => c.match === false);
const below = claims.filter(c => c.meetsThreshold === false);
const gateFails = gates.filter(g => g.failing > 0);
const out = {
  generated: new Date().toISOString(),
  script: 'audits/tools/phase4/tokens/verify-contrast-2.mjs', tokens: 'audits/tools/phase4/tokens/proposed-tokens.css',
  method: 'Own CSS cascade on <html> (compound selectors, specificity, order; @media at 1024 px, fine pointer, no prefers-*); var() with fallbacks; color-mix(in srgb) premultiplied; layers composited in sRGB (float, no 8-bit rounding), unblurred; WCAG 2.x relative luminance (sRGB threshold 0.04045); OKLCH chroma (Ottosson); CVD = Machado 2009 severity 1.0 in linear sRGB, clamped; CIEDE2000 on CIELAB D65. Contexts: 6 palettes × 9 people × 6 modes (adult, kid, kiosk, contrast-more, reduce-transparency, kiosk+reduce-transparency). Tolerance ±0.05 (chroma ±0.0015; 1-dp figures ±0.1).',
  selfTest: SELFTEST,
  summary: { claims: claims.length, numericClaims: numeric.length, mismatches: mism.length, belowThreshold: below.length, gates: gates.length, gateEvaluations: gates.reduce((a, g) => a + g.evaluations, 0), gatesFailing: gateFails.length, ok: mism.length === 0 && below.length === 0 && gateFails.length === 0 },
  mismatches: mism, belowThreshold: below, roundedUpMinima: roundedUp, gates, labelled: labelRows, claims,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ selfTest: SELFTEST, summary: out.summary }, null, 1));
for (const m of mism) console.log('MISMATCH', m.id, '| stated', m.stated, '| computed', m.computed, m.at ? '@ ' + m.at : '', m.note ? '| ' + m.note : '');
for (const b of below) console.log('BELOW', b.id, b.computed, '<', b.threshold, b.at || '');
for (const g of gateFails) console.log('GATE FAIL', g.id, g.min, '<', g.threshold, g.at, g.failing);
