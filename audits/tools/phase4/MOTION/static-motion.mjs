// Phase 4 MOTION — static motion inventory for every area (shell = index.html + apps/design.css; nine apps).
// Reads files only; runs no app. For each file it walks the CSS (inside <style>, or the whole file for design.css) and
// records every transition / animation declaration (durations in ms, easing, token or literal), every @keyframes, every
// :active rule (transform scale, filter/brightness, background-only), every prefers-reduced-motion block (what it
// switches off), and in inline JS: setInterval / requestAnimationFrame / element.animate / smooth scrolls / vibrate /
// confirm-alert-prompt / reduced-motion matchMedia. Lines longer than 5000 chars (the Dollywood payload and the bundled
// three.js) are skipped for the JS scan and reported as skipped.
//
//   node "audits/tools/phase4/MOTION/static-motion.mjs"   → audits/evidence/p4/MOTION/static-motion.json (+ table on stdout)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'MOTION');
fs.mkdirSync(OUT, { recursive: true });

const AREAS = [
  ['design.css', 'apps/design.css', true],
  ['shell', 'index.html'],
  ['f260', 'apps/f260.html'], ['leftovers', 'apps/leftovers.html'], ['prayer', 'apps/prayer.html'], ['tally', 'apps/tally.html'],
  ['timer', 'apps/timer.html'], ['dollywood', 'apps/dollywood.html'], ['dollywood-live', 'apps/dollywood-live.html'],
  ['kidverse', 'apps/kidverse.html'], ['verses', 'apps/verses.html'],
];
const TOKENS = { '--ease': 'cubic-bezier(.2,.7,.2,1)', '--ease-out': 'cubic-bezier(.2,.7,.2,1)', '--ease-in-out': 'cubic-bezier(.65,0,.35,1)', '--spring': 'cubic-bezier(.34,1.4,.64,1)', '--dur': '220ms', '--dur-1': '120ms', '--dur-2': '220ms', '--dur-3': '360ms' };
const DURTOK = { '--dur': 220, '--dur-1': 120, '--dur-2': 220, '--dur-3': 360 };

const lineAt = (src, i) => { let n = 1; for (let k = 0; k < i; k++) if (src.charCodeAt(k) === 10) n++; return n; };
function lineIndex(src) { const idx = [0]; for (let k = 0; k < src.length; k++) if (src.charCodeAt(k) === 10) idx.push(k + 1); return i => { let lo = 0, hi = idx.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (idx[m] <= i) lo = m; else hi = m - 1; } return lo + 1; }; }

function cssRegions(src, whole) {
  if (whole) return [{ start: 0, text: src }];
  const out = []; const re = /<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi; let m;
  while ((m = re.exec(src))) out.push({ start: m.index + m[0].indexOf('>') + 1, text: m[2] });
  return out;
}
function jsRegions(src) {
  const out = []; const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(src))) { if (/\ssrc\s*=|type=["']application\/json/.test(m[1] || '')) continue; out.push({ start: m.index + m[0].indexOf('>') + 1, text: m[2] }); }
  return out;
}

// Minimal CSS walker: yields {selector, media[], prop, value, pos}
function walkCss(text, base) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, s => s.replace(/[^\n]/g, ' '));
  const decls = [], keyframes = [], stack = [];
  let i = 0, buf = '', bufStart = 0;
  while (i < clean.length) {
    const c = clean[i];
    if (c === '{') {
      const prelude = buf.trim(); stack.push({ prelude, pos: base + bufStart }); buf = ''; bufStart = i + 1;
      if (/^@(-webkit-)?keyframes/.test(prelude)) keyframes.push({ name: prelude.split(/\s+/)[1], pos: base + bufStart });
    } else if (c === '}') {
      if (buf.trim()) pushDecls(buf, bufStart);
      stack.pop(); buf = ''; bufStart = i + 1;
    } else if (c === ';') { pushDecls(buf, bufStart); buf = ''; bufStart = i + 1; }
    else { if (!buf.length) bufStart = i; buf += c; }
    i++;
  }
  function pushDecls(b, st) {
    const t = b.trim(); if (!t || !stack.length) return;
    const k = t.indexOf(':'); if (k < 0) return;
    const prop = t.slice(0, k).trim().toLowerCase(), value = t.slice(k + 1).trim();
    const sel = stack.filter(s => !s.prelude.startsWith('@')).map(s => s.prelude).pop() || '';
    const media = stack.filter(s => s.prelude.startsWith('@')).map(s => s.prelude);
    const off = b.indexOf(t);
    decls.push({ selector: sel.replace(/\s+/g, ' '), media, prop, value: value.replace(/\s+/g, ' '), pos: base + st + off });
  }
  return { decls, keyframes };
}

const msOf = s => { const m = /^(-?\d*\.?\d+)(ms|s)$/.exec(s); return m ? (m[2] === 's' ? +m[1] * 1000 : +m[1]) : null; };
function parseTimes(value) {
  // split top-level commas
  const parts = []; let depth = 0, cur = '';
  for (const ch of value) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { parts.push(cur); cur = ''; } else cur += ch; }
  parts.push(cur);
  return parts.map(p => {
    const toks = p.trim().match(/var\([^)]*\)|cubic-bezier\([^)]*\)|steps\([^)]*\)|[^\s]+/g) || [];
    const times = [], eas = []; let tokenDur = false, tokenEase = false; let infinite = false; let name = null;
    for (const t of toks) {
      const v = /^var\((--[\w-]+)/.exec(t);
      if (v && DURTOK[v[1]] != null) { times.push(DURTOK[v[1]]); tokenDur = true; continue; }
      if (v && TOKENS[v[1]]) { eas.push(v[1]); tokenEase = true; continue; }
      const ms = msOf(t); if (ms != null) { times.push(ms); continue; }
      if (/^(cubic-bezier|steps)\(|^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)$/.test(t)) { eas.push(t.replace(/\s+/g, '')); continue; }
      if (t === 'infinite') { infinite = true; continue; }
      if (/^\d+$/.test(t) || /^(both|forwards|backwards|alternate|reverse|normal|running|paused|all|none|!important)$/.test(t)) continue;
      if (!name) name = t;
    }
    return { raw: p.trim(), name, duration: times[0] ?? null, delay: times[1] ?? null, easing: eas[0] || null, tokenDur, tokenEase, infinite };
  });
}

const res = {};
for (const [area, rel, whole] of AREAS) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const L = lineIndex(src);
  const r = { file: rel, transitions: [], animations: [], keyframes: [], active: [], reducedMotion: [], js: { setInterval: [], raf: [], waapi: [], smoothScroll: [], vibrate: [], dialogs: [], rmMatchMedia: [], skippedLongLines: [] }, hover: [] };
  for (const reg of cssRegions(src, whole)) {
    const { decls, keyframes } = walkCss(reg.text, reg.start);
    for (const k of keyframes) r.keyframes.push({ name: k.name, line: L(k.pos) });
    for (const d of decls) {
      const line = L(d.pos); const inRM = d.media.some(m => /prefers-reduced-motion/.test(m));
      const inKF = d.media.some(m => /keyframes/.test(m));
      if (inRM) { r.reducedMotion.push({ line, selector: d.selector.slice(0, 120), decl: `${d.prop}: ${d.value}`.slice(0, 160) }); continue; }
      if (inKF) continue;
      if (/^(transition|-webkit-transition|transition-duration|transition-timing-function)$/.test(d.prop)) for (const t of parseTimes(d.value)) r.transitions.push({ line, selector: d.selector.slice(0, 100), prop: d.prop, ...t, media: d.media.join(' ').slice(0, 80) || undefined });
      if (/^(animation|-webkit-animation|animation-duration|animation-name|animation-timing-function)$/.test(d.prop) && d.value !== 'none') for (const t of parseTimes(d.value)) r.animations.push({ line, selector: d.selector.slice(0, 100), prop: d.prop, ...t });
      if (/:active\b/.test(d.selector) && /^(transform|filter|background|background-color|opacity|box-shadow|scale|color|border-color|--[\w-]+)$/.test(d.prop)) {
        const sc = /scale\(\s*([\d.]+)/.exec(d.value) || (d.prop === 'scale' ? [null, d.value] : null);
        r.active.push({ line, selector: d.selector.slice(0, 110), prop: d.prop, value: d.value.slice(0, 90), scale: sc ? +sc[1] : null, brightness: /brightness\(/.test(d.value) ? d.value : null });
      }
    }
  }
  for (const reg of jsRegions(src)) {
    const lines = reg.text.split('\n'); const first = L(reg.start);
    lines.forEach((ln, k) => {
      const n = first + k; if (ln.length > 5000) { r.js.skippedLongLines.push({ line: n, length: ln.length }); return; }
      const push = (arr, re) => { const m = ln.match(re); if (m) arr.push({ line: n, text: ln.trim().slice(0, 170) }); };
      push(r.js.setInterval, /\bsetInterval\s*\(/); push(r.js.raf, /\brequestAnimationFrame\s*\(/); push(r.js.waapi, /\.animate\s*\(\s*[\[{]/);
      push(r.js.smoothScroll, /behavior\s*:\s*['"]smooth|scroll-behavior/); push(r.js.vibrate, /\bvibrate\s*\(/);
      push(r.js.dialogs, /(^|[^.\w])(confirm|alert|prompt)\s*\(/); push(r.js.rmMatchMedia, /prefers-reduced-motion/);
    });
  }
  res[area] = r;
}

// Summaries
const summary = {};
const bucket = ms => ms == null ? 'none' : ms < 200 ? '<200' : ms <= 350 ? '200-350' : ms <= 600 ? '351-600' : '>600';
for (const [area, r] of Object.entries(res)) {
  const all = [...r.transitions, ...r.animations].filter(t => t.prop !== 'transition-timing-function' && t.prop !== 'animation-timing-function' && t.prop !== 'animation-name');
  const durs = all.map(t => t.duration).filter(x => x != null);
  const easings = {}; for (const t of all) { const e = t.easing || '(default ease)'; easings[e] = (easings[e] || 0) + 1; }
  const buckets = {}; for (const t of all) { const b = bucket(t.duration); buckets[b] = (buckets[b] || 0) + 1; }
  summary[area] = {
    declarations: all.length, tokenDuration: all.filter(t => t.tokenDur).length, literalDuration: all.filter(t => t.duration != null && !t.tokenDur).length,
    tokenEasing: all.filter(t => t.tokenEase).length, distinctDurationsMs: [...new Set(durs)].sort((a, b) => a - b), buckets, easings,
    infinite: r.animations.filter(a => a.infinite).map(a => `${a.name || '?'} ${a.duration}ms @${a.line}`),
    keyframes: r.keyframes.length,
    pressRules: r.active.length, pressScales: [...new Set(r.active.filter(a => a.scale != null).map(a => a.scale))].sort(), pressBrightness: r.active.filter(a => a.brightness || /brightness/.test(a.value)).length,
    pressBackgroundOnly: r.active.filter(a => a.scale == null && /background/.test(a.prop)).length,
    reducedMotionRules: r.reducedMotion.length, reducedMotionJs: r.js.rmMatchMedia.map(x => x.line),
    intervals: r.js.setInterval.length, raf: r.js.raf.length, waapi: r.js.waapi.length, smoothScroll: r.js.smoothScroll.length, vibrate: r.js.vibrate.length, dialogs: r.js.dialogs.length,
  };
}
fs.writeFileSync(path.join(OUT, 'static-motion.json'), JSON.stringify({ generated: new Date().toISOString(), tokens: TOKENS, summary, detail: res }, null, 1));
console.log('area            decl tokDur litDur tokEase  <200 200-350 351-600 >600  infinite  press scales            brightness bgOnly  RM-css RM-js  int raf smooth vib dlg');
for (const [a, s] of Object.entries(summary)) console.log(`${a.padEnd(15)} ${String(s.declarations).padStart(4)} ${String(s.tokenDuration).padStart(6)} ${String(s.literalDuration).padStart(6)} ${String(s.tokenEasing).padStart(7)}  ${String(s.buckets['<200'] || 0).padStart(4)} ${String(s.buckets['200-350'] || 0).padStart(7)} ${String(s.buckets['351-600'] || 0).padStart(7)} ${String(s.buckets['>600'] || 0).padStart(4)}  ${String(s.infinite.length).padStart(8)}  ${String(s.pressRules).padStart(5)} ${JSON.stringify(s.pressScales).padEnd(18)} ${String(s.pressBrightness).padStart(9)} ${String(s.pressBackgroundOnly).padStart(6)}  ${String(s.reducedMotionRules).padStart(6)} ${String(s.reducedMotionJs.length).padStart(5)}  ${String(s.intervals).padStart(3)} ${String(s.raf).padStart(3)} ${String(s.smoothScroll).padStart(6)} ${String(s.vibrate).padStart(3)} ${String(s.dialogs).padStart(3)}`);
for (const [a, s] of Object.entries(summary)) console.log(`\n${a}: durations ${JSON.stringify(s.distinctDurationsMs)}\n  easings ${JSON.stringify(s.easings)}\n  infinite ${JSON.stringify(s.infinite)}`);
