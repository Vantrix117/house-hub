#!/usr/bin/env node
// Phase 4 — INDEPENDENT contrast verifier #1 for the proposed token set.
// Written from scratch: it does NOT import contrast.mjs or colour-lib.mjs. It parses
// audits/tools/phase4/tokens/proposed-tokens.css, runs its own cascade (specificity + source order, @media),
// resolves var() / color-mix() / rgba(), and recomputes every number TOKENS.md states, then compares each to the
// section's figure (tolerance ±0.05; ±0.002 for OKLCH chroma) and to its threshold.
// Usage: node audits/tools/phase4/tokens/verify-contrast-1.mjs  → audits/evidence/p4/tokens/verify-contrast-1.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');
const CSS = readFileSync(resolve(HERE, 'proposed-tokens.css'), 'utf8');
const OUT = resolve(ROOT, 'audits/evidence/p4/tokens/verify-contrast-1.json');

// ───────────────────────── 1. parse ─────────────────────────
function parseCss(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = []; let order = 0;
  function walk(text, media) {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i); if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith('@media')) walk(body, [...media, head.slice(6).trim()]);
      else {
        const decls = {};
        // split declarations on ; not inside parentheses
        let d = 0, start = 0;
        const push = s => { const k = s.indexOf(':'); if (k > 0) { const name = s.slice(0, k).trim(); if (name) decls[name] = s.slice(k + 1).trim(); } };
        for (let k = 0; k < body.length; k++) { const c = body[k]; if (c === '(') d++; else if (c === ')') d--; else if (c === ';' && !d) { push(body.slice(start, k)); start = k + 1; } }
        push(body.slice(start));
        rules.push({ selectors: splitTop(head, ','), decls, media, order: order++ });
      }
      i = j;
    }
  }
  walk(src, []);
  return rules;
}
function splitTop(s, sep) { const out = []; let d = 0, st = 0; for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '(') d++; else if (c === ')') d--; else if (c === sep && !d) { out.push(s.slice(st, i).trim()); st = i + 1; } } out.push(s.slice(st).trim()); return out.filter(Boolean); }

// ───────────────────────── 2. selector matching on <html> (a compound selector only) ─────────────────────────
// returns specificity (b-count: attributes + pseudo-classes) or null
function matchCompound(sel, attrs) {
  let spec = 0, s = sel.trim();
  while (s.length) {
    if (s.startsWith(':root')) { spec++; s = s.slice(5); continue; }
    if (s.startsWith(':not(')) {
      let d = 0, k = 4; for (; k < s.length; k++) { if (s[k] === '(') d++; else if (s[k] === ')') { d--; if (!d) break; } }
      const inner = s.slice(5, k); const r = matchCompound(inner, attrs);
      if (r !== null) return null; spec += specOf(inner); s = s.slice(k + 1); continue;
    }
    const m = s.match(/^\[([a-z-]+)(?:="([^"]*)")?\]/);
    if (m) { const v = attrs[m[1]]; if (v === undefined) return null; if (m[2] !== undefined && v !== m[2]) return null; spec++; s = s.slice(m[0].length); continue; }
    throw new Error('unsupported selector: ' + sel);
  }
  return spec;
}
function specOf(sel) { return (sel.match(/\[|:root/g) || []).length; }
function mediaOk(q, env) {
  return q.split(/\s+and\s+/).every(part => {
    const m = part.trim().match(/^\(([a-z-]+):\s*([^)]+)\)$/); if (!m) throw new Error('media ' + q);
    const [, f, v] = m;
    if (f === 'min-width') return env.width >= parseFloat(v);
    if (f === 'pointer') return env.pointer === v.trim();
    return (env.prefers[f] || 'no-preference') === v.trim();
  });
}

const RULES = parseCss(CSS);
function cascade(attrs, env = { width: 1440, pointer: 'fine', prefers: {} }, rules = RULES) {
  const win = {};
  for (const r of rules) {
    if (!r.media.every(q => mediaOk(q, env))) continue;
    let best = null; for (const s of r.selectors) { const sp = matchCompound(s, attrs); if (sp !== null && (best === null || sp > best)) best = sp; }
    if (best === null) continue;
    for (const [k, v] of Object.entries(r.decls)) { const cur = win[k]; if (!cur || best > cur.spec || (best === cur.spec && r.order >= cur.order)) win[k] = { v, spec: best, order: r.order }; }
  }
  return Object.fromEntries(Object.entries(win).map(([k, o]) => [k, o.v]));
}

// ───────────────────────── 3. values: var(), color-mix(), rgba(), hex ─────────────────────────
function substitute(val, map, seen = new Set()) {
  for (let guard = 0; guard < 200; guard++) {
    const i = val.indexOf('var('); if (i < 0) return val;
    let d = 0, k = i + 3; for (; k < val.length; k++) { if (val[k] === '(') d++; else if (val[k] === ')') { d--; if (!d) break; } }
    const inner = val.slice(i + 4, k); const parts = splitTop(inner, ',');
    const name = parts[0].trim(); const fb = parts.length > 1 ? inner.slice(inner.indexOf(',') + 1).trim() : undefined;
    let rep;
    if (map[name] !== undefined && !seen.has(name)) rep = substitute(map[name], map, new Set([...seen, name]));
    else if (fb !== undefined) rep = substitute(fb, map, seen);
    else throw new Error('unresolved ' + name);
    val = val.slice(0, i) + rep + val.slice(k + 1);
  }
  throw new Error('var loop');
}
function parseColor(s) {
  s = s.trim();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  let m = s.match(/^#([0-9a-f]{6})$/i); if (m) { const n = parseInt(m[1], 16); return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 }; }
  m = s.match(/^#([0-9a-f]{3})$/i); if (m) { const [r, g, b] = m[1].split('').map(c => parseInt(c + c, 16)); return { r, g, b, a: 1 }; }
  m = s.match(/^rgba?\(([^)]+)\)$/); if (m) { const p = m[1].split(',').map(x => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  m = s.match(/^color-mix\(in srgb,(.*)\)$/s);
  if (m) {
    const args = splitTop(m[1], ',');
    const one = a => { const mm = a.trim().match(/^(.*?)\s+(\d+(?:\.\d+)?)%$/s); return mm ? { c: parseColor(mm[1]), p: parseFloat(mm[2]) } : { c: parseColor(a), p: undefined }; };
    const A = one(args[0]), B = one(args[1]);
    let p1 = A.p, p2 = B.p; if (p1 === undefined && p2 === undefined) { p1 = 50; p2 = 50; } else if (p1 === undefined) p1 = 100 - p2; else if (p2 === undefined) p2 = 100 - p1;
    const sum = p1 + p2; const w1 = p1 / sum, w2 = p2 / sum; const mult = sum < 100 ? sum / 100 : 1;
    const a = A.c.a * w1 + B.c.a * w2;
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const ch = k => (A.c[k] * A.c.a * w1 + B.c[k] * B.c.a * w2) / a;   // premultiplied interpolation (CSS Color 5)
    return { r: ch('r'), g: ch('g'), b: ch('b'), a: a * mult };
  }
  throw new Error('colour? ' + s);
}
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Y = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const cr = (a, b) => { if (a.a < 1 || b.a < 1) throw new Error('contrast of a translucent colour'); const x = Y(a), y = Y(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const HEX = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
function oklchC(c) {
  const [r, g, b] = [lin(c.r), lin(c.g), lin(c.b)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return Math.hypot(A, B);
}
function labOfLinear([r, g, b]) {
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Yy = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b, Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  return [116 * f(Yy) - 16, 500 * (f(X) - f(Yy)), 200 * (f(Yy) - f(Z))];
}
function de2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (b, a) => { if (b === 0 && a === 0) return 0; const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const h1p = hp(b1, a1p), h2p = hp(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0; if (C1p * C2p) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p; if (C1p * C2p) { if (Math.abs(h1p - h2p) > 180) hbp = (h1p + h2p < 360) ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2; else hbp = (h1p + h2p) / 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + 0.015 * (Lbp - 50) ** 2 / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
// Machado, Oliveira & Fernandes 2009, severity 1.0, applied in linear sRGB and clipped
const MACHADO = {
  normal: null,
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
function labSim(c, kind) {
  let v = [lin(c.r), lin(c.g), lin(c.b)];
  const M = MACHADO[kind]; if (M) v = M.map(row => Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2])));
  return labOfLinear(v);
}
const dE = (a, b, kind = 'normal') => de2000(labSim(a, kind), labSim(b, kind));

// ───────────────────────── 4. contexts ─────────────────────────
const LIGHT = ['hearth', 'parchment', 'frost'], DARK = ['midnight', 'forest', 'graphite'], THEMES = [...LIGHT, ...DARK];
const schemeOf = t => LIGHT.includes(t) ? 'light' : 'dark';
const PEOPLE = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite'];
const SEM = ['success', 'warning', 'danger'];
const OPAQUE = ['bg', 'surface', 'surface-2', 'surface-raised', 'fill-field', 'hover'];
const MODES = {
  adult: { kind: 'adult' }, kid: { kind: 'kid' }, kiosk: { kind: 'kiosk' },
  contrast: { kind: 'adult', contrast: 'more' }, reduceT: { kind: 'adult', transparency: 'reduce' }, kioskRT: { kind: 'kiosk', transparency: 'reduce' },
};
const MID = parseColor('#767676'), WHITE = parseColor('#FFFFFF'), BLACK = parseColor('#000000');
function ctx(theme, accent = 'graphite', mode = 'adult', rules = RULES) {
  const m = MODES[mode];
  const attrs = { 'data-theme': theme, 'data-scheme': schemeOf(theme), 'data-accent': accent, 'data-kind': m.kind };
  if (m.contrast) attrs['data-contrast'] = m.contrast; if (m.transparency) attrs['data-transparency'] = m.transparency;
  const map = cascade(attrs, undefined, rules);
  const cache = {};
  const col = n => cache[n] ??= parseColor(substitute(`var(--${n})`, map));
  const solid = n => { const c = col(n); if (c.a < 1) throw new Error(`--${n} is translucent in ${theme}/${accent}/${mode}`); return c; };
  return { theme, accent, mode, scheme: schemeOf(theme), col, solid, raw: n => map['--' + n] };
}
const C = {}; const get = (t, a = 'graphite', m = 'adult') => C[`${t}|${a}|${m}`] ??= ctx(t, a, m);
const min = arr => Math.min(...arr), max = arr => Math.max(...arr);
const r2 = v => Math.round(v * 100) / 100;

// ───────────────────────── 5. claims (every number TOKENS.md states) ─────────────────────────
const claims = [];   // {id, stated, computed, threshold, where}
function claim(id, stated, computed, threshold = null, tol = 0.05, note = '') {
  const v = typeof computed === 'object' ? computed.v : computed; const where = typeof computed === 'object' ? computed.where : '';
  claims.push({ id, stated, computed: +v.toFixed(tol < 0.01 ? 4 : 3), threshold, match: stated === null ? null : Math.abs(v - stated) <= tol + 1e-9, pass: threshold === null ? null : v + 1e-9 >= threshold, where, note });
}
function argmin(items) { let best = null; for (const it of items) if (!best || it.v < best.v) best = it; return best; }

// 5.1 light hue table (min across hearth / parchment / frost)
const T21 = {
  bubblegum: [5.27, 6.98, 5.91, 7.05, 3.77, 5.93, 4.61, 3.60, 0.068], peach: [5.04, 6.24, 5.28, 7.01, 3.36, 5.94, 4.62, 4.93, 0.061],
  butter: [5.77, 6.07, 5.12, 8.24, 3.27, 5.92, 4.60, 3.14, 0.093], mint: [5.24, 6.13, 5.13, 7.44, 3.26, 5.93, 4.61, 4.86, 0.074],
  aqua: [5.42, 6.42, 5.38, 7.34, 3.41, 6.08, 4.73, 3.83, 0.058], sky: [5.68, 7.35, 6.18, 7.07, 3.94, 5.94, 4.62, 4.13, 0.057],
  periwinkle: [5.86, 7.90, 6.68, 7.03, 4.26, 5.95, 4.62, 3.14, 0.061], lavender: [5.86, 7.92, 6.71, 7.04, 4.28, 5.90, 4.59, 7.31, 0.072],
  graphite: [7.09, 8.26, 7.05, 10.87, 4.47, 5.93, 4.61, 7.44, null],
};
const cols21 = ['ink/fill', 'ink/wash', 'ink/all surfaces', 'ink-hi/fill', 'ink/fill-strong', 'on/strong', 'strong/all surfaces', 'graphic/surfaces', 'fill C'];
const thr21 = [4.5, 4.5, 4.5, 7, 3, 4.5, 4.5, 3, null];
for (const [f, row] of Object.entries(T21)) {
  const H = n => get('hearth').solid(`${f}-${n}`);
  const vals = [
    cr(H('ink'), H('fill')), cr(H('ink'), H('wash')),
    argmin(LIGHT.flatMap(t => OPAQUE.map(s => ({ v: cr(H('ink'), get(t).solid(s)), where: `${t}/${s}` })))),
    cr(H('ink-hi'), H('fill')), cr(H('ink'), H('fill-strong')), cr(H('on'), H('strong')),
    argmin(LIGHT.flatMap(t => OPAQUE.map(s => ({ v: cr(H('strong'), get(t).solid(s)), where: `${t}/${s}` })))),
    argmin(LIGHT.flatMap(t => OPAQUE.map(s => ({ v: cr(H('graphic'), get(t).solid(s)), where: `${t}/${s}` })))),
    oklchC(H('fill')),
  ];
  vals.forEach((v, i) => { if (row[i] !== null) claim(`2.1 light ${f} ${cols21[i]}`, row[i], v, thr21[i], i === 8 ? 0.002 : 0.05); });
}
// 5.2 dark hue table (min across midnight / forest / graphite)
const T21d = {
  bubblegum: [1.47, 7.17, 9.19, 5.35, 8.56, 6.97, 5.11, 0.075], peach: [1.49, 7.16, 9.31, 5.31, 8.69, 7.12, 5.25, 0.075],
  butter: [1.53, 7.13, 9.51, 5.20, 8.97, 7.41, 10.32, 0.075], mint: [1.59, 7.03, 9.75, 5.06, 9.27, 7.85, 3.71, 0.074],
  aqua: [1.57, 7.10, 9.75, 5.18, 9.22, 7.76, 6.07, 0.063], sky: [1.53, 7.15, 9.53, 5.26, 8.99, 7.45, 8.48, 0.075],
  periwinkle: [1.51, 7.13, 9.39, 5.29, 8.84, 7.28, 5.53, 0.076], lavender: [1.49, 7.15, 9.30, 5.34, 8.73, 7.13, 3.28, 0.074],
  graphite: [1.44, 7.87, 9.92, 6.12, 9.81, 7.97, 11.18, null],
};
const cols21d = ['fill/card', 'ink/fill', 'ink/all surfaces', 'ink/fill-strong', 'on/strong', 'strong/surfaces', 'graphic/surfaces', 'fill C'];
const thr21d = [1.4, 4.5, 4.5, 3, 4.5, 4.5, 3, null];
for (const [f, row] of Object.entries(T21d)) {
  const M = n => get('midnight').solid(`${f}-${n}`);
  const vals = [
    argmin(DARK.map(t => ({ v: cr(M('fill'), get(t).solid('surface')), where: t }))),
    cr(M('ink'), M('fill')),
    argmin(DARK.flatMap(t => OPAQUE.map(s => ({ v: cr(M('ink'), get(t).solid(s)), where: `${t}/${s}` })))),
    cr(M('ink'), M('fill-strong')), cr(M('on'), M('strong')),
    argmin(DARK.flatMap(t => OPAQUE.map(s => ({ v: cr(M('strong'), get(t).solid(s)), where: `${t}/${s}` })))),
    argmin(DARK.flatMap(t => OPAQUE.map(s => ({ v: cr(M('graphic'), get(t).solid(s)), where: `${t}/${s}` })))),
    oklchC(M('fill')),
  ];
  vals.forEach((v, i) => { if (row[i] !== null) claim(`2.1 dark ${f} ${cols21d[i]}`, row[i], v, thr21d[i], i === 7 ? 0.002 : 0.05); });
}
// "Dark text on a hue is >= 7:1 everywhere"
claim('2.1 dark: ink on its fill >= 7 for every family', 7.0, min(PEOPLE.map(f => cr(get('midnight').solid(`${f}-ink`), get('midnight').solid(`${f}-fill`)))), 7, 1e9, 'stated as a floor');

// 5.3 semantic (2.2)
const semLight = { success: 6.76, warning: 6.24, danger: 5.49 }, semDark = { success: 7.06, warning: 7.15, danger: 7.19 };
for (const s of SEM) {
  claim(`2.2 light ${s} ink/fill`, semLight[s], cr(get('hearth').solid(`${s}-ink`), get('hearth').solid(`${s}-fill`)), 4.5);
  claim(`2.2 dark ${s} ink/fill`, semDark[s], cr(get('midnight').solid(`${s}-ink`), get('midnight').solid(`${s}-fill`)), 4.5);
}
claim('2.2/2.5 badge-ink on badge-bg (min both schemes)', 6.42, argmin(THEMES.map(t => ({ v: cr(get(t).solid('badge-ink'), get(t).solid('badge-bg')), where: t }))), 4.5);
claim('2.5 badge-bg vs card (min) — section: "badge vs card ≥ 5.29"', 5.29, argmin(THEMES.map(t => ({ v: cr(get(t).solid('badge-bg'), get(t).solid('surface')), where: t }))), 3);
claim('2.5 badge-bg vs sheet (surface-raised), min — where 5.29 actually comes from', 5.29, argmin(THEMES.map(t => ({ v: cr(get(t).solid('badge-bg'), get(t).solid('surface-raised')), where: t }))), 3);
const lr = (a, b) => { const x = Y(a) + 0.05, y = Y(b) + 0.05; return max([x, y]) / min([x, y]); };
claim('2.2 semantic strong luminance ratio (success|warning vs danger, both schemes) min', 1.58,
  argmin(['hearth', 'midnight'].flatMap(t => ['success', 'warning'].map(s => ({ v: lr(get(t).solid(`${s}-strong`), get(t).solid('danger-strong')), where: `${t}/${s}-vs-danger` })))), 1.3);
{
  const items = ['hearth', 'midnight'].flatMap(t => SEM.flatMap(s => PEOPLE.map(p => ({ v: dE(get(t).solid(`${s}-graphic`), get(t).solid(`${p}-graphic`)), where: `${schemeOf(t)} ${s}/${p}` }))));
  claim('2.2 semantic graphic vs every person graphic ΔE00 min (closest success/Mint light)', 10.74, argmin(items), 10);
  claim('2.2 CVD reported: success vs warning, protanopia, light (graphic)', 3.9, dE(get('hearth').solid('success-graphic'), get('hearth').solid('warning-graphic'), 'protan'), null, 0.05);
  claim('2.2 CVD reported: success vs danger, deuteranopia, dark (graphic)', 8.6, dE(get('midnight').solid('success-graphic'), get('midnight').solid('danger-graphic'), 'deutan'), null, 0.05);
}
// X-on x12 range 4.77-10.2
{
  const fams = [...PEOPLE, ...SEM]; const vals = ['hearth', 'midnight'].flatMap(t => fams.map(f => ({ v: cr(get(t).solid(`${f}-on`), get(t).solid(`${f}-strong`)), where: `${schemeOf(t)} ${f}` })));
  claim('TOK-1 --X-on on --X-strong, low end (12 families, both schemes)', 4.77, argmin(vals), 4.5);
  const hi = vals.reduce((a, b) => b.v > a.v ? b : a); claim('TOK-1 --X-on on --X-strong, high end', 10.2, hi, null, 0.05);
}

// 5.4 neutrals (2.3), adult, per palette
const N23 = {
  hearth: [14.95, 8.22, 5.56, 5.82, 3.07, 1.13], parchment: [12.26, 8.37, 6.22, 5.97, 3.23, 1.20], frost: [15.08, 7.50, 5.08, 5.37, 3.03, 1.12],
  midnight: [17.73, 8.58, 5.52, 5.23, 3.14, 1.20], forest: [16.88, 8.86, 5.68, 5.31, 3.45, 1.22], graphite: [19.29, 9.16, 5.42, 5.87, 3.35, 1.23],
};
for (const [t, row] of Object.entries(N23)) {
  const c = get(t); const worst = c.scheme === 'light' ? BLACK : WHITE;
  const vals = [cr(c.solid('text'), c.solid('bg')),
    argmin(OPAQUE.map(s => ({ v: cr(c.solid('text-2'), c.solid(s)), where: s }))),
    argmin(OPAQUE.map(s => ({ v: cr(c.solid('text-3'), c.solid(s)), where: s }))),
    cr(c.solid('text-2'), over(c.col('glass'), worst)),
    argmin(OPAQUE.map(s => ({ v: cr(c.solid('field-border'), c.solid(s)), where: s }))),
    cr(c.solid('surface'), c.solid('bg'))];
  const names = ['text/page', 'text-2 lowest opaque', 'text-3 lowest opaque', 'text-2 on --glass over worst', 'field-border lowest', 'card ÷ page'];
  const thr = [7, 4.5, 4.5, 4.5, 3, c.scheme === 'dark' ? 1.2 : null];
  vals.forEach((v, i) => claim(`2.3 ${t} ${names[i]}`, row[i], v, thr[i]));
  const ga = parseFloat(c.raw('glass-alpha')), gs = parseFloat(c.raw('glass-alpha-strong'));
  claim(`2.3 ${t} glass alpha`, c.scheme === 'light' ? 78 : 80, ga, null, 0); claim(`2.3 ${t} glass-strong alpha`, 90, gs, null, 0);
}

// 5.5 accent matrix (2.4): min over all six palettes, adult
const A24 = {
  bubblegum: [7.11, 5.91, 5.27, 5.93, 4.61, 3.60, 7.17, 6.33], peach: [6.36, 5.28, 5.04, 5.94, 4.62, 4.93, 6.80, 5.67],
  butter: [6.15, 5.12, 5.77, 5.92, 4.60, 3.14, 6.58, 5.48], mint: [6.17, 5.13, 5.24, 5.93, 4.61, 4.86, 6.59, 5.50],
  aqua: [6.47, 5.38, 5.42, 6.08, 4.73, 3.83, 6.91, 5.76], sky: [7.43, 6.18, 5.68, 5.94, 4.62, 4.13, 7.15, 6.62],
  periwinkle: [8.03, 6.68, 5.86, 5.95, 4.62, 3.14, 7.13, 7.16], lavender: [8.07, 6.71, 5.86, 5.90, 4.59, 4.61, 7.15, 7.20],
  graphite: [8.48, 7.05, 7.09, 5.93, 4.61, 7.44, 7.87, 7.56],
};
const cols24 = ['ink / card', 'ink / page', 'ink / fill', 'on / strong', 'strong as text / page', 'graphic / page', 'hero button ink / bg', 'tab label on glass over #767676'];
const thr24 = [4.5, 4.5, 4.5, 4.5, 4.5, 3, 4.5, 4.5];
for (const [f, row] of Object.entries(A24)) {
  const per = THEMES.map(t => get(t, f));
  const fns = [c => cr(c.solid('accent-ink'), c.solid('surface')), c => cr(c.solid('accent-ink'), c.solid('bg')), c => cr(c.solid('accent-ink'), c.solid('accent-fill')),
    c => cr(c.solid('accent-on'), c.solid('accent-strong')), c => cr(c.solid('accent-strong'), c.solid('bg')), c => cr(c.solid('accent-graphic'), c.solid('bg')),
    c => cr(c.solid('hero-btn-ink'), c.solid('hero-btn-bg')), c => cr(c.solid('accent-ink'), over(c.col('glass-strong'), MID))];
  fns.forEach((fn, i) => claim(`2.4 ${f} ${cols24[i]}`, row[i], argmin(per.map(c => ({ v: fn(c), where: c.theme }))), thr24[i]));
}
claim('2.4 lavender graphic on card (dark) "3.76"', 3.76, argmin(DARK.map(t => ({ v: cr(get(t, 'lavender').solid('accent-graphic'), get(t).solid('surface')), where: t }))), 3);
{
  const all = THEMES.flatMap(t => PEOPLE.map(p => get(t, p)));
  claim('2.4 focus/today ring (accent-graphic) on every opaque surface, min', 3.14, argmin(all.flatMap(c => OPAQUE.flatMap(s => ['focus-ring-color', 'today-ring'].map(n => ({ v: cr(c.solid(n), c.solid(s)), where: `${c.theme}/${c.accent}/${n}/${s}` }))))), 3);
  claim('2.4 selected label on its pill (sel-ink/sel-fill), min', 5.04, argmin(all.map(c => ({ v: cr(c.solid('sel-ink'), c.solid('sel-fill')), where: `${c.theme}/${c.accent}` }))), 4.5);
  claim('2.4 progress fill on its track, min', 4.01, argmin(all.map(c => ({ v: cr(c.solid('progress-fill'), c.solid('progress-track')), where: `${c.theme}/${c.accent}` }))), 3);
  claim('2.4 hero button (dark), min', 7.03, argmin(all.filter(c => c.scheme === 'dark').map(c => ({ v: cr(c.solid('hero-btn-ink'), c.solid('hero-btn-bg')), where: `${c.theme}/${c.accent}` }))), 4.5);
  claim('ACCENT-4 hero button, min all', 6.58, argmin(all.map(c => ({ v: cr(c.solid('hero-btn-ink'), c.solid('hero-btn-bg')), where: `${c.theme}/${c.accent}` }))), 4.5);
  claim('DARK-3 dark --accent-ink on cards (surface), min', 10.53, argmin(all.filter(c => c.scheme === 'dark').map(c => ({ v: cr(c.solid('accent-ink'), c.solid('surface')), where: `${c.theme}/${c.accent}` }))), 4.5);
  claim('DARK-3 dark --accent-graphic on every opaque surface, min', 3.28, argmin(all.filter(c => c.scheme === 'dark').flatMap(c => OPAQUE.map(s => ({ v: cr(c.solid('accent-graphic'), c.solid(s)), where: `${c.theme}/${c.accent}/${s}` })))), 3);
  claim('ICON-3 tile glyph accent-ink on accent-fill-strong, min', 3.26, argmin(all.map(c => ({ v: cr(c.solid('accent-ink'), c.solid('accent-fill-strong')), where: `${c.theme}/${c.accent}` }))), 3);
  claim('legacy --accent as text on every opaque surface, min (Parchment page, Lavender)', 4.59, argmin(all.flatMap(c => OPAQUE.map(s => ({ v: cr(c.solid('accent'), c.solid(s)), where: `${c.theme}/${c.accent}/${s}` })))), 4.5);
  claim('COLOR-4 --text-3 on --accent-wash (page wash over bg), min — a floor (">= 5.08"): threshold check only', null, argmin(all.map(c => ({ v: cr(c.solid('text-3'), over(c.col('accent-wash'), c.solid('bg'))), where: `${c.theme}/${c.accent}` }))), 5.08,
    0.05, 'stated as "≥ 5.08 on every opaque surface and on --accent-wash"');
}

// 5.6 CVD separation of the 9 person graphics (and pastel fills)
const CVD = { light: { normal: 14.61, protan: 11.27, deutan: 11.03, tritan: 5.14, fillDeutan: 0.48 }, dark: { normal: 13.25, protan: 12.67, deutan: 12.76, tritan: 5.26, fillDeutan: 0.37 } };
const pairWise = (t, role, kind) => { const out = []; for (let i = 0; i < PEOPLE.length; i++) for (let j = i + 1; j < PEOPLE.length; j++) out.push({ v: dE(get(t).solid(`${PEOPLE[i]}-${role}`), get(t).solid(`${PEOPLE[j]}-${role}`), kind), where: `${PEOPLE[i]}/${PEOPLE[j]}` }); return out; };
const cvdPairs = {};
for (const [scheme, t] of [['light', 'hearth'], ['dark', 'midnight']]) {
  for (const k of ['normal', 'protan', 'deutan', 'tritan']) {
    const ps = pairWise(t, 'graphic', k); cvdPairs[`${scheme}/${k}`] = ps.length;
    claim(`CVD ${scheme} graphics ${k} min ΔE00`, CVD[scheme][k], argmin(ps), k === 'tritan' ? null : 10);
  }
  claim(`CVD ${scheme} pastel fills NORMAL-vision min ΔE00 (contrast.json cvd.fill.normal)`, scheme === 'light' ? 7.85 : 7.24, argmin(pairWise(t, 'fill', 'normal')), null);
  claim(`CVD ${scheme} pastel fills protan min ΔE00 (contrast.json cvd.fill.protan)`, scheme === 'light' ? 1.09 : 1.51, argmin(pairWise(t, 'fill', 'protan')), null);
  claim(`CVD ${scheme} pastel fills deutan min ΔE00 (reported)`, CVD[scheme].fillDeutan, argmin(pairWise(t, 'fill', 'deutan')), null);
}
{
  const fillsMax = ['hearth', 'midnight'].flatMap(t => ['protan', 'deutan'].map(k => argmin(pairWise(t, 'fill', k))));
  claim('ACCENT-8 pastel fills dichromat range, upper "7.85" (max over the per-scheme dichromat minima)', 7.85, fillsMax.reduce((a, b) => b.v > a.v ? b : a), null, 0.05, 'interpretation: largest of the four per-scheme protan/deutan minima');
}

// 5.7 other colour roles (2.5)
{
  claim('2.5 switch-on vs surface, min', 3.93, argmin(THEMES.map(t => ({ v: cr(get(t).solid('switch-on'), get(t).solid('surface')), where: t }))), 3);
  claim('2.5 switch-knob on switch-on, min', 4.03, argmin(THEMES.map(t => ({ v: cr(get(t).solid('switch-knob'), get(t).solid('switch-on')), where: t }))), 3);
  claim('2.5 switch-off-ring on every opaque surface, min', 3.03, argmin(THEMES.flatMap(t => OPAQUE.map(s => ({ v: cr(get(t).solid('switch-off-ring'), get(t).solid(s)), where: `${t}/${s}` })))), 3);
  claim('2.5 cell-empty on every opaque surface, min', 3.03, argmin(THEMES.flatMap(t => OPAQUE.map(s => ({ v: cr(get(t).solid('cell-empty'), get(t).solid(s)), where: `${t}/${s}` })))), 3);
  const sd = THEMES.flatMap(t => { const c = get(t); return ['bg', 'surface', 'mid'].flatMap(b => { const back = b === 'mid' ? MID : c.solid(b); const g = over(c.col('glass-strong'), back); return ['status-offline', 'status-pending', 'status-synced', 'status-error'].map(s => ({ v: cr(c.solid(s), g), where: `${t}/${s}/over ${b}` })); }); });
  claim('2.5 status dots on glass-strong (over page/card/#767676), min', 3.29, argmin(sd), 3);
  const backs = c => ({ bg: c.solid('bg'), surface: c.solid('surface'), mid: MID, white: WHITE, black: BLACK });
  const toast = (n) => argmin(THEMES.flatMap(t => { const c = get(t); return Object.entries(backs(c)).map(([bn, b]) => ({ v: cr(c.solid(n), over(c.col('toast-bg'), b)), where: `${t}/over ${bn}` })); }));
  claim('2.5 toast-ink over every backdrop, min', 10.0, toast('toast-ink'), 7);
  claim('2.5 toast-ink-2 over every backdrop, min', 6.59, toast('toast-ink-2'), 4.5);
  claim('2.5 glass-inverse-ink on glass-inverse over every backdrop, min', 6.53, argmin(THEMES.flatMap(t => { const c = get(t); return Object.entries(backs(c)).map(([bn, b]) => ({ v: cr(c.solid('glass-inverse-ink'), over(c.col('glass-inverse'), b)), where: `${t}/over ${bn}` })); })), 4.5);
  claim('2.5 star-stroke on every opaque surface, min', 5.12, argmin(THEMES.flatMap(t => OPAQUE.map(s => ({ v: cr(get(t).solid('star-stroke'), get(t).solid(s)), where: `${t}/${s}` })))), 3);
  const photos = t => { const c = get(t); return { white: WHITE, black: BLACK, mid: MID, ...Object.fromEntries([...PEOPLE, ...SEM].flatMap(f => [[`${f}-fill`, c.solid(`${f}-fill`)], [`${f}-fill-strong`, c.solid(`${f}-fill-strong`)]])) }; };
  for (const [n, st, th] of [['tv-text', 7.26, 7], ['tv-text-2', 5.11, 4.5]])
    claim(`2.5 ${n} on tv-panel over any photo, min`, st, argmin(['hearth', 'midnight'].flatMap(t => Object.entries(photos(t)).map(([pn, p]) => ({ v: cr(get(t, 'graphite', 'kiosk').solid(n), over(get(t, 'graphite', 'kiosk').col('tv-panel'), p)), where: pn })))), th);
}

// 5.8 verification-table minima across ALL palettes × people × six modes
{
  const all = Object.keys(MODES).flatMap(m => THEMES.flatMap(t => PEOPLE.map(p => get(t, p, m))));
  const hiMode = c => c.mode === 'kiosk' || c.mode === 'kioskRT' || c.mode === 'contrast';
  const worstB = c => c.scheme === 'light' ? BLACK : WHITE;
  const W = (arr) => argmin(arr);
  claim('verify: primary text on opaque surfaces, min', 12.04, W(all.flatMap(c => OPAQUE.map(s => ({ v: cr(c.solid('text'), c.solid(s)), where: `${c.theme}/${c.mode}/${s}` })))), 7);
  claim('verify: primary text on glass over the worst backdrop, min', 7.21, W(all.flatMap(c => ['glass', 'glass-strong'].map(g => ({ v: cr(c.solid('text'), over(c.col(g), worstB(c))), where: `${c.theme}/${c.mode}/${g}` })))), 7);
  claim('verify: secondary on page/card/sheet, min', 8.14, W(all.flatMap(c => ['bg', 'surface', 'surface-raised'].map(s => ({ v: cr(c.solid('text-2'), c.solid(s)), where: `${c.theme}/${c.mode}/${s}` })))), 6);
  claim('verify: secondary on wells (surface-2, fill-field, hover), min', 7.50, W(all.flatMap(c => ['surface-2', 'fill-field', 'hover'].map(s => ({ v: cr(c.solid('text-2'), c.solid(s)), where: `${c.theme}/${c.mode}/${s}` })))), 4.5);
  claim('verify: secondary on glass over the worst backdrop, min', 5.23, W(all.flatMap(c => ['glass', 'glass-strong'].map(g => ({ v: cr(c.solid('text-2'), over(c.col(g), worstB(c))), where: `${c.theme}/${c.mode}/${g}` })))), 4.5);
  claim('verify: tertiary / placeholder on opaque, min', 5.08, W(all.flatMap(c => OPAQUE.flatMap(s => ['text-3', 'placeholder'].map(n => ({ v: cr(c.solid(n), c.solid(s)), where: `${c.theme}/${c.mode}/${n}/${s}` }))))), 4.5);
  claim('verify: hue inks on their fills (all families, all modes), min', 5.04, W(all.flatMap(c => [...PEOPLE, ...SEM].map(f => ({ v: cr(c.solid(`${f}-ink`), c.solid(`${f}-fill`)), where: `${c.theme}/${c.mode}/${f}` })))), 4.5);
  claim('verify: tab labels (accent-ink) on glass-strong over #767676, min', 5.48, W(all.map(c => ({ v: cr(c.solid('accent-ink'), over(c.col('glass-strong'), MID)), where: `${c.theme}/${c.accent}/${c.mode}` }))), 4.5);
  claim('verify: text-hi (ink-hi on fill), min', 7.01, W(all.flatMap(c => [...PEOPLE, ...SEM].map(f => ({ v: cr(c.solid(`${f}-ink-hi`), c.solid(`${f}-fill`)), where: `${c.theme}/${f}` })))), 7);
  claim('verify: non-text field-border lowest (on hover)', 3.03, W(all.flatMap(c => OPAQUE.map(s => ({ v: cr(c.solid('field-border'), c.solid(s)), where: `${c.theme}/${s}` })))), 3);
  claim('verify: large-text numerals (accent-graphic, timer-done) on opaque, min', 3.14, W(all.flatMap(c => OPAQUE.flatMap(s => ['accent-graphic', 'timer-done'].map(n => ({ v: cr(c.solid(n), c.solid(s)), where: `${c.theme}/${c.accent}/${n}/${s}` }))))), 3);
  const graphic = all.flatMap(c => [
    ...['bg', 'surface', 'mid'].map(b => ({ v: cr(c.solid('accent-graphic'), over(c.col('glass-strong'), b === 'mid' ? MID : c.solid(b))), where: `${c.theme}/${c.accent}/${c.mode}/tab icon over ${b}` })),
    { v: cr(c.solid('accent-ink'), c.solid('accent-fill-strong')), where: `${c.theme}/${c.accent}/${c.mode}/tile glyph` },
    ...SEM.flatMap(s => OPAQUE.map(b => ({ v: cr(c.solid(`${s}-graphic`), c.solid(b)), where: `${c.theme}/${s}-graphic/${b}` }))),
  ]);
  claim('verify: graphic kind lowest (tab icon on glass, tile glyph, semantic graphic)', 3.07, W(graphic), 3);
  claim('verify: dark chips (fill ÷ card), min', 1.44, W(DARK.flatMap(t => PEOPLE.map(f => ({ v: cr(get(t).solid(`${f}-fill`), get(t).solid('surface')), where: `${t}/${f}` })))), 1.4);
  claim('verify: person fill chroma C, min (light + dark)', 0.057, W(['hearth', 'midnight'].flatMap(t => PEOPLE.filter(f => f !== 'graphite').map(f => ({ v: oklchC(get(t).solid(`${f}-fill`)), where: `${schemeOf(t)}/${f}` })))), null, 0.002);
  // 7:1 modes: "All text gated at 7:1" under Increase Contrast / kiosk
  const hi = all.filter(hiMode);
  claim('7:1 modes: text-2 / text-3 on opaque, min', null, W(hi.flatMap(c => OPAQUE.flatMap(s => ['text-2', 'text-3'].map(n => ({ v: cr(c.solid(n), c.solid(s)), where: `${c.theme}/${c.mode}/${n}/${s}` }))))), 7);
  claim('7:1 modes: accent-ink on accent-fill, min', null, W(hi.map(c => ({ v: cr(c.solid('accent-ink'), c.solid('accent-fill')), where: `${c.theme}/${c.accent}/${c.mode}` }))), 7);
  claim('7:1 modes: accent-ink on opaque surfaces, min', null, W(hi.flatMap(c => OPAQUE.map(s => ({ v: cr(c.solid('accent-ink'), c.solid(s)), where: `${c.theme}/${c.accent}/${c.mode}/${s}` })))), 7);
  claim('7:1 modes: text-2 on glass over the worst backdrop, min', null, W(hi.flatMap(c => ['glass', 'glass-strong'].map(g => ({ v: cr(c.solid('text-2'), over(c.col(g), worstB(c))), where: `${c.theme}/${c.mode}/${g}` })))), 7);
  claim('7:1 modes: legacy --accent (= accent-strong) as text on opaque, min', null, W(hi.flatMap(c => OPAQUE.map(s => ({ v: cr(c.solid('accent'), c.solid(s)), where: `${c.theme}/${c.accent}/${c.mode}/${s}` })))), 7, 0.05,
    'not swapped by the 7:1 modes; the section says "All text gated at 7:1" for Increase Contrast');
  claim('7:1 modes: tab label accent-ink on glass-strong over #767676, min', null, W(hi.map(c => ({ v: cr(c.solid('accent-ink'), over(c.col('glass-strong'), MID)), where: `${c.theme}/${c.accent}/${c.mode}` }))), 7);
  claim('7:1 modes: primary text on glass over the worst backdrop, min', null, W(hi.flatMap(c => ['glass', 'glass-strong'].map(g => ({ v: cr(c.solid('text'), over(c.col(g), worstB(c))), where: `${c.theme}/${c.mode}/${g}` })))), 7);
  claim('7:1 modes: accent-on on accent-strong (primary button label), min', null, W(hi.map(c => ({ v: cr(c.solid('accent-on'), c.solid('accent-strong')), where: `${c.theme}/${c.accent}/${c.mode}` }))), 7, 0.05, 'strong/on are not swapped by the 7:1 modes');
  claim('7:1 modes: badge-ink on badge-bg, min', null, W(hi.map(c => ({ v: cr(c.solid('badge-ink'), c.solid('badge-bg')), where: `${c.theme}/${c.mode}` }))), 7, 0.05);
  claim('7:1 modes: toast-ink-2 over every backdrop, min', null, W(hi.flatMap(c => [c.solid('bg'), c.solid('surface'), MID, WHITE, BLACK].map((b, i) => ({ v: cr(c.solid('toast-ink-2'), over(c.col('toast-bg'), b)), where: `${c.theme}/${c.mode}/${i}` })))), 7, 0.05);
  claim('7:1 modes: sel-ink-strong on sel-fill-strong, min', null, W(hi.map(c => ({ v: cr(c.solid('sel-ink-strong'), c.solid('sel-fill-strong')), where: `${c.theme}/${c.accent}/${c.mode}` }))), 7, 0.05);
}

// 5.9 model sensitivity: the tab bar is --glass-bg-strong, which also carries the person's strong tone at --glass-pickup
{
  const all = THEMES.flatMap(t => PEOPLE.map(p => get(t, p)));
  const withPickup = all.map(c => { const g = over(c.col('glass-strong'), MID); const pk = parseFloat(c.raw('glass-pickup')) / 100; const s = c.solid('accent-strong'); const layered = over({ ...s, a: pk }, g); return { v: cr(c.solid('accent-ink'), layered), where: `${c.theme}/${c.accent}` }; });
  claim('sensitivity: tab label on glass-strong + FULL accent pickup (radial centre) over #767676, min', null, argmin(withPickup), 4.5, 0.05,
    'upper bound on the pickup: the radial is centred at y=-10% with a 70% radius and ends at 62%, i.e. by y≈33% of the bar, so bottom-row labels get none');
  const iconPickup = all.map(c => { const g = over(c.col('glass-strong'), MID); const pk = parseFloat(c.raw('glass-pickup')) / 100; return { v: cr(c.solid('accent-graphic'), over({ ...c.solid('accent-strong'), a: pk }, g)), where: `${c.theme}/${c.accent}` }; });
  claim('sensitivity: tab icon (accent-graphic) on glass-strong + FULL accent pickup over #767676, min', null, argmin(iconPickup), 3, 0.05, 'icons sit higher in the bar than labels');
  // dark glass: the specular sheen (--glass-spec, white) sits on top at y=0 and fades out by 34%: it LIGHTENS dark glass
  const specDark = all.filter(c => c.scheme === 'dark').flatMap(c => ['glass', 'glass-strong'].flatMap(gn => { const g = over(c.col(gn), WHITE); const top = over(c.col('glass-spec'), g); return ['text', 'text-2'].map(n => ({ v: cr(c.solid(n), top), where: `${c.theme}/${gn}/${n} (spec at full, white backdrop)` })); }));
  claim('sensitivity: dark text-2 on glass + full specular sheen over white, min', null, argmin(specDark.filter(x => x.where.includes('text-2'))), 4.5, 0.05, 'the sheen is full only at the top edge');
  const specDarkPage = all.filter(c => c.scheme === 'dark').flatMap(c => ['glass', 'glass-strong'].map(gn => ({ v: cr(c.solid('text-2'), over(c.col('glass-spec'), over(c.col(gn), c.solid('bg')))), where: `${c.theme}/${gn}` })));
  claim('sensitivity: dark text-2 on glass + full specular sheen over the PAGE, min', null, argmin(specDarkPage), 4.5, 0.05, 'realistic backdrop');
  // the radial pickup at a tab icon's centre (~y=25% of the bar): alpha = pickup × (1 − d/(0.62·R)), d = 35% of height, R = 70%
  const f25 = 1 - (0.35 / 0.70) / 0.62;
  const iconPartial = all.map(c => { const g = over(c.col('glass-strong'), MID); const pk = parseFloat(c.raw('glass-pickup')) / 100 * f25; return { v: cr(c.solid('accent-graphic'), over({ ...c.solid('accent-strong'), a: pk }, g)), where: `${c.theme}/${c.accent}` }; });
  claim(`sensitivity: tab icon on glass-strong + pickup at y≈25% (×${f25.toFixed(2)}) over #767676, min`, null, argmin(iconPartial), 3, 0.05, 'geometry-weighted pickup');
  const iconNone = all.map(c => ({ v: cr(c.solid('accent-graphic'), over(c.col('glass-strong'), MID)), where: `${c.theme}/${c.accent}` }));
  claim('baseline: tab icon on glass-strong over #767676 (no pickup), min', null, argmin(iconNone), 3);
  claim('sensitivity: dark primary text on glass + full specular sheen over white, min', null, argmin(specDark.filter(x => !x.where.includes('text-2'))), 7, 0.05, 'the sheen is full only at the top edge');
}

// ───────────────────────── 5.10 fix experiment: 7:1 swaps for the PERSON solid roles, the badge and toast-ink-2 (semantic strongs untouched so the
//      luminance-separation gate still holds; swapping them too collapses warning vs danger to 1.00 in light) — a proposed fix, not in the token file ─────────────────────────
const FIX_CSS = `
:root[data-kind="kiosk"], :root[data-contrast="more"] {
  --bubblegum-strong: var(--bubblegum-ink-hi); --peach-strong: var(--peach-ink-hi); --butter-strong: var(--butter-ink-hi); --mint-strong: var(--mint-ink-hi);
  --aqua-strong: var(--aqua-ink-hi); --sky-strong: var(--sky-ink-hi); --periwinkle-strong: var(--periwinkle-ink-hi); --lavender-strong: var(--lavender-ink-hi);
  --graphite-strong: var(--graphite-ink-hi);
  --badge-bg: var(--danger-ink-hi);
  --toast-ink-2: var(--toast-ink);
}`;
const FIX_RULES = [...RULES, ...parseCss(FIX_CSS).map((r, i) => ({ ...r, order: RULES.length + i }))];
const fixExperiment = { css: FIX_CSS.trim(), results: {} };
{
  const hi = ['kiosk', 'contrast'].flatMap(m => THEMES.flatMap(t => PEOPLE.map(p => ctx(t, p, m, FIX_RULES))));
  const worst = (arr) => { const w = argmin(arr); return { min: +w.v.toFixed(3), where: w.where, pass7: w.v >= 7 }; };
  const R = fixExperiment.results;
  R['legacy --accent as text on opaque'] = worst(hi.flatMap(c => OPAQUE.map(s => ({ v: cr(c.solid('accent'), c.solid(s)), where: `${c.theme}/${c.accent}/${c.mode}/${s}` }))));
  R['accent-on on accent-strong'] = worst(hi.map(c => ({ v: cr(c.solid('accent-on'), c.solid('accent-strong')), where: `${c.theme}/${c.accent}/${c.mode}` })));
  R['X-on on X-strong (12 families)'] = worst(hi.flatMap(c => [...PEOPLE, ...SEM].map(f => ({ v: cr(c.solid(`${f}-on`), c.solid(`${f}-strong`)), where: `${c.theme}/${f}/${c.mode}` }))));
  R['badge-ink on badge-bg'] = worst(hi.map(c => ({ v: cr(c.solid('badge-ink'), c.solid('badge-bg')), where: `${c.theme}/${c.mode}` })));
  R['sel-ink-strong on sel-fill-strong'] = worst(hi.map(c => ({ v: cr(c.solid('sel-ink-strong'), c.solid('sel-fill-strong')), where: `${c.theme}/${c.accent}/${c.mode}` })));
  R['toast-ink-2 over every backdrop'] = worst(hi.flatMap(c => [['bg', c.solid('bg')], ['surface', c.solid('surface')], ['mid', MID], ['white', WHITE], ['black', BLACK]].map(([n, b]) => ({ v: cr(c.solid('toast-ink-2'), over(c.col('toast-bg'), b)), where: `${c.theme}/${c.mode}/${n}` }))));
  R['progress-fill on progress-track (non-text >= 3)'] = worst(hi.map(c => ({ v: cr(c.solid('progress-fill'), c.solid('progress-track')), where: `${c.theme}/${c.accent}/${c.mode}` })));
  R['switch-on vs surface (non-text >= 3)'] = worst(hi.map(c => ({ v: cr(c.solid('switch-on'), c.solid('surface')), where: `${c.theme}/${c.mode}` })));
  R['switch-knob on switch-on (non-text >= 3)'] = worst(hi.map(c => ({ v: cr(c.solid('switch-knob'), c.solid('switch-on')), where: `${c.theme}/${c.mode}` })));
  R['badge-bg vs every opaque surface (non-text >= 3)'] = worst(hi.flatMap(c => OPAQUE.map(s => ({ v: cr(c.solid('badge-bg'), c.solid(s)), where: `${c.theme}/${c.mode}/${s}` }))));
  R['semantic strong luminance ratio success|warning vs danger'] = worst(hi.flatMap(c => ['success', 'warning'].map(x => ({ v: lr(c.solid(`${x}-strong`), c.solid('danger-strong')), where: `${c.theme}/${c.mode}/${x}` }))));
}

// ───────────────────────── 6. report ─────────────────────────
const mismatches = claims.filter(c => c.match === false);
const isBound = c => c.id.startsWith('sensitivity:');
const failures = claims.filter(c => c.pass === false && !isBound(c));
const sensitivity = claims.filter(isBound);
const out = { script: 'audits/tools/phase4/tokens/verify-contrast-1.mjs', source: 'audits/tools/phase4/tokens/proposed-tokens.css', rules: RULES.length,
  method: 'Own cascade (specificity, order, @media at 1440 fine pointer, no prefers-*); WCAG 2.x luminance; color-mix premultiplied in sRGB; translucent layers composited in gamma sRGB, unblurred; OKLCH chroma; CIEDE2000 (D65); Machado 2009 severity 1.0 in linear sRGB, clipped.',
  counts: { claims: claims.length, compared: claims.filter(c => c.match !== null).length, mismatches: mismatches.length, thresholdFailures: failures.length, cvdPairsPerScheme: cvdPairs['light/normal'] },
  mismatches, failures, sensitivity, fixExperiment, claims };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`claims ${claims.length}, compared ${out.counts.compared}, mismatches ${mismatches.length}, threshold failures ${failures.length}`);
for (const m of mismatches) console.log(`MISMATCH ${m.id}: stated ${m.stated}, computed ${m.computed} (${m.where})`);
for (const f of fixExperiment ? Object.entries(fixExperiment.results) : []) console.log('FIX-EXPERIMENT', f[0], JSON.stringify(f[1]));
for (const b of sensitivity) console.log(`BOUND ${b.id}: ${b.computed} (threshold ${b.threshold}; ${b.where})`);
for (const f of failures) console.log(`FAIL ${f.id}: ${f.computed} < ${f.threshold} (${f.where})${f.note ? ' — ' + f.note : ''}`);
process.exitCode = mismatches.length || failures.length ? 1 : 0;
