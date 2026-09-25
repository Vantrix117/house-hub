// Phase 4 TOK: shared parsing for the token audit. Static analysis only; reads files, runs no app.
//   import { AREAS, readArea, cssDecls, parseDesignCss, TOKVAL } from './lib-tok.mjs';
// cssDecls(css, baseOffset, raw) walks a comment-stripped stylesheet with a real brace/paren/quote tokenizer and yields
// every declaration with its selector, its at-rule stack (so @media print, @keyframes and hover guards are known) and its
// 1-based line in the source file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'TOK');
fs.mkdirSync(OUT, { recursive: true });

export const AREAS = [
  { id: 'design.css', file: 'apps/design.css', kind: 'css' },
  { id: 'shell', file: 'index.html' },
  { id: 'f260', file: 'apps/f260.html' },
  { id: 'leftovers', file: 'apps/leftovers.html' },
  { id: 'prayer', file: 'apps/prayer.html' },
  { id: 'tally', file: 'apps/tally.html' },
  { id: 'timer', file: 'apps/timer.html' },
  { id: 'dollywood', file: 'apps/dollywood.html' },
  { id: 'dollywood-live', file: 'apps/dollywood-live.html' },
  { id: 'kidverse', file: 'apps/kidverse.html' },
  { id: 'verses', file: 'apps/verses.html' },
  { id: 'docs', file: 'docs/design.html' },
  { id: 'hub.js', file: 'apps/hub.js', kind: 'js' },
];

export const lineAt = (src, i) => { let n = 1; for (let j = 0; j < i; j++) if (src.charCodeAt(j) === 10) n++; return n; };
// faster repeated line lookup
export function lineIndex(src) { const nl = []; for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) nl.push(i); return i => { let lo = 0, hi = nl.length; while (lo < hi) { const m = (lo + hi) >> 1; if (nl[m] < i) lo = m + 1; else hi = m; } return lo + 1; }; }
export const blank = s => s.replace(/[^\n]/g, ' ');
export const stripCssComments = s => s.replace(/\/\*[\s\S]*?\*\//g, blank);

export function blocks(src, tag) {
  const out = [], re = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  let m; while ((m = re.exec(src))) {
    const attrs = m[1] || '';
    if (tag === 'script' && (/\ssrc\s*=/.test(attrs) || /application\/json/.test(attrs))) continue;
    const start = m.index + m[0].indexOf('>') + 1;
    out.push({ start, end: start + m[2].length, attrs });
  }
  return out;
}

export function readArea(a) {
  const raw = fs.readFileSync(path.join(ROOT, a.file), 'utf8');
  const L = lineIndex(raw);
  if (a.kind === 'css') return { ...a, raw, L, styles: [{ start: 0, end: raw.length }], scripts: [] };
  if (a.kind === 'js') return { ...a, raw, L, styles: [], scripts: [{ start: 0, end: raw.length }] };
  return { ...a, raw, L, styles: blocks(raw, 'style'), scripts: blocks(raw, 'script') };
}

// Tokenizer: yields {prop, value, selector, at:[preludes], line, index}
export function* cssDecls(css, base, L) {
  const stack = []; let buf = '', bufStart = 0, i = 0, paren = 0, quote = null;
  const flushDecl = endIdx => {
    const t = buf; const k = t.indexOf(':');
    if (k > 0 && stack.length) {
      const prop = t.slice(0, k).trim(); const value = t.slice(k + 1).trim();
      if (/^-{0,2}[a-zA-Z][\w-]*$/.test(prop)) {
        const lead = t.length - t.trimStart().length;
        const sel = [...stack].reverse().find(s => !s.startsWith('@')) || '';
        return { prop: prop.toLowerCase().startsWith('--') ? prop : prop.toLowerCase(), value, selector: sel, at: stack.filter(s => s.startsWith('@')), line: L(base + bufStart + lead), index: base + bufStart + lead };
      }
    }
    return null;
  };
  for (; i < css.length; i++) {
    const c = css[i];
    if (quote) { buf += c; if (c === quote && css[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; buf += c; continue; }
    if (c === '(') { paren++; buf += c; continue; }
    if (c === ')') { paren = Math.max(0, paren - 1); buf += c; continue; }
    if (paren) { buf += c; continue; }
    if (c === '{') {
      // is buf a declaration-ish nested thing? treat as prelude
      stack.push(buf.trim().replace(/\s+/g, ' ')); buf = ''; bufStart = i + 1; continue;
    }
    if (c === ';' || c === '}') {
      const d = flushDecl(i); if (d) yield d;
      buf = ''; bufStart = i + 1;
      if (c === '}') stack.pop();
      continue;
    }
    if (!buf.length) bufStart = i;
    buf += c;
  }
}

export function* areaCss(A) {
  for (const b of A.styles) {
    const css = stripCssComments(A.raw.slice(b.start, b.end));
    yield* cssDecls(css, b.start, A.L);
  }
}

// inline style="…" attributes in markup (outside <style>/<script>) and inside JS strings
export function* inlineDecls(A) {
  const skip = [...A.styles, ...A.scripts].map(b => [b.start, b.end]);
  const inSkip = i => skip.some(([a, z]) => i >= a && i < z);
  if (!A.kind) for (const m of A.raw.matchAll(/\sstyle\s*=\s*"([^"]*)"/g)) {
    if (inSkip(m.index)) continue;
    for (const d of m[1].split(';')) { const k = d.indexOf(':'); if (k > 0) yield { prop: d.slice(0, k).trim().toLowerCase(), value: d.slice(k + 1).trim(), selector: '[style attr]', at: [], line: A.L(m.index), index: m.index, src: 'inline' }; }
  }
  for (const b of A.scripts) {
    const js = A.raw.slice(b.start, b.end);
    // style="…" / style='…' inside template or string literals (values may contain ${…})
    for (const m of js.matchAll(/style\s*=\s*\\?(["'])((?:(?!\1)[^\\]|\\.)*?)\\?\1/g)) {
      for (const d of m[2].split(';')) { const k = d.indexOf(':'); if (k > 0) yield { prop: d.slice(0, k).trim().toLowerCase(), value: d.slice(k + 1).trim(), selector: '[style in JS]', at: [], line: A.L(b.start + m.index), index: b.start + m.index, src: 'js-inline' }; }
    }
    // el.style.prop = 'value'  and  style.setProperty('prop', value)
    for (const m of js.matchAll(/\.style\.([a-zA-Z]+)\s*=\s*([^;\n]+)/g)) {
      const prop = m[1].replace(/[A-Z]/g, c => '-' + c.toLowerCase());
      yield { prop, value: m[2].trim(), selector: '[style write in JS]', at: [], line: A.L(b.start + m.index), index: b.start + m.index, src: 'js-write' };
    }
    for (const m of js.matchAll(/style\.setProperty\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^)\n]+)\)/g)) {
      yield { prop: m[1], value: m[2].trim(), selector: '[setProperty in JS]', at: [], line: A.L(b.start + m.index), index: b.start + m.index, src: 'js-setProperty' };
    }
  }
}

// ---------- design.css token model ----------
export const THEME_BLOCKS = [
  // [column id, selector test]
  ['hearth', s => s === ':root'],
  ['parchment', s => s.startsWith(':root[data-theme="parchment"]')],
  ['frost', s => s.startsWith(':root[data-theme="frost"]')],
  ['midnight', s => s.startsWith(':root[data-theme="midnight"]')],
  ['system-dark', (s, at) => s === ':root:not([data-theme])' && at.some(a => /prefers-color-scheme: dark/.test(a))],
  ['forest', s => s === ':root[data-theme="forest"]'],
  ['tp-forest', s => s === '.tp[data-preview="forest"]'],
  ['tp-hearth', s => s.startsWith('.tp[data-preview="hearth"]')],
  ['tp-system-half', s => s.startsWith('.tp[data-preview="system"] .tp-half')],
  ['kid', s => s === ':root[data-kind="kid"]'],
  ['kiosk', s => s === ':root[data-kind="kiosk"]'],
];
export function parseDesignCss() {
  const A = readArea(AREAS[0]);
  const tokens = {}; const componentLocal = [];
  for (const d of areaCss(A)) {
    if (!d.prop.startsWith('--')) continue;
    const col = THEME_BLOCKS.find(([, t]) => t(d.selector, d.at));
    if (!col) { componentLocal.push({ name: d.prop, value: d.value, selector: d.selector, line: d.line }); continue; }
    (tokens[d.prop] ||= { name: d.prop, values: {}, lines: {} });
    tokens[d.prop].values[col[0]] = d.value.replace(/\s+/g, ' ');
    tokens[d.prop].lines[col[0]] = d.line;
  }
  return { A, tokens, componentLocal };
}

export function category(name) {
  const n = name.replace(/^--/, '');
  if (/^(font|fs|lh|ls)(-|$)/.test(n)) return 'type';
  if (/^sp-/.test(n)) return 'spacing';
  if (/^r(-|$)/.test(n)) return 'radius';
  if (/^(tap|tap-lg)$/.test(n)) return 'target';
  if (/^(max|max-read|safe-)/.test(n)) return 'layout';
  if (/^(e\d|shadow|glow|focus)/.test(n)) return 'shadow/elevation';
  if (/^(glass|blur|sheen)/.test(n)) return 'glass';
  if (/^(ease|spring|dur)/.test(n)) return 'motion';
  if (/^z/.test(n)) return 'z-index';
  return 'colour';
}

// literal→token lookup tables (Hearth adult values; kid/kiosk scale some of them)
export const TOKVAL = {
  fs: { 12: '--fs-xs', 14: '--fs-sm', 16: '--fs-md', 18: '--fs-lg', 22: '--fs-xl', 28: '--fs-2xl', 36: '--fs-3xl', 48: '--fs-4xl' },
  sp: { 4: '--sp-1', 8: '--sp-2', 12: '--sp-3', 16: '--sp-4', 20: '--sp-5', 24: '--sp-6', 32: '--sp-8', 40: '--sp-10', 48: '--sp-12', 64: '--sp-16' },
  r: { 12: '--r-sm', 16: '--r', 22: '--r-lg', 28: '--r-xl', 36: '--r-2xl', 999: '--r-full', 9999: '--r-full', 99: '--r-full', 100: '--r-full', 50: '--r-full' },
  dur: { 120: '--dur-1', 220: '--dur-2', 360: '--dur-3' },
  size: { 44: '--tap', 60: '--tap-lg', 720: '--max-read', 1200: '--max' },
  lh: { '1.1': '--lh-tight', '1.25': '--lh-snug', '1.45': '--lh' },
  ls: { '-0.02em': '--ls-tight', '-.02em': '--ls-tight', '.08em': '--ls-caps', '0.08em': '--ls-caps' },
  blur: { 18: '--blur' },
};
export const nearest = (tbl, v) => { const ks = Object.keys(tbl).map(Number).filter(k => k < 900 || v > 400).sort((a, b) => Math.abs(a - v) - Math.abs(b - v)); return ks.length ? { key: ks[0], token: tbl[ks[0]], off: +(v - ks[0]).toFixed(2) } : null; };

// ---------- colour maths ----------
export function parseColor(s) {
  s = s.trim().toLowerCase();
  let m;
  if ((m = s.match(/^#([0-9a-f]{3,8})$/))) {
    let h = m[1]; if (h.length <= 4) h = [...h].map(c => c + c).join('');
    const n = h.match(/../g).map(x => parseInt(x, 16));
    return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] / 255 : 1 };
  }
  if ((m = s.match(/^rgba?\(([^)]+)\)$/))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(x => x.endsWith('%') ? parseFloat(x) * 2.55 : parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? (m[1].includes('%') && p[3] > 1 ? p[3] / 255 : p[3]) : 1 };
  }
  if (s === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (s === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  return null;
}
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
export const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
export const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
// OKLab distance for "nearest token" suggestions
function oklab(c) { const l = lin(c.r), m = lin(c.g), s = lin(c.b);
  const L_ = Math.cbrt(0.4122214708 * l + 0.5363325363 * m + 0.0514459929 * s), M_ = Math.cbrt(0.2119034982 * l + 0.6806995451 * m + 0.1073969566 * s), S_ = Math.cbrt(0.0883024619 * l + 0.2817188376 * m + 0.6299787005 * s);
  return [0.2104542553 * L_ + 0.793617785 * M_ - 0.0040720468 * S_, 1.9779984951 * L_ - 2.428592205 * M_ + 0.4505937099 * S_, 0.0259040371 * L_ + 0.7827717662 * M_ - 0.808675766 * S_]; }
export const dE = (a, b) => { const p = oklab(a), q = oklab(b); return +(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100).toFixed(1); };
