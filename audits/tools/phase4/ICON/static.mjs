// Phase 4 ICON — static inventory of every icon-like thing in the shell and the nine apps.
// Reads files only (no app runs, no network). For each area file it lists:
//   svgs     every <svg …> / <symbol …> open tag in markup or JS strings, with viewBox, width/height, stroke-width, fill,
//            stroke, linecap/linejoin, class and the line it is on
//   strokes  every stroke-width value (attribute or CSS) with its line, so mixed weights are visible
//   uses     every <use href="#…"> sprite reference
//   glyphs   every Unicode symbol that can act as an icon (arrows, geometric shapes, dingbats, misc symbols, a few math
//            and punctuation marks) with a 70-char context; typographic "…" after a word is tagged 'ellipsis'
//   emoji    every Extended_Pictographic code point sequence with its context
// Lines longer than 20 000 characters (the Dollywood payload JSON and the bundled 3D library) are scanned for emoji and
// SVG counts only and reported under `longLines`, never printed.
//
//   node audits/tools/phase4/ICON/static.mjs     → audits/evidence/p4/ICON/static.json + a summary table on stdout
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'ICON');
fs.mkdirSync(OUT, { recursive: true });

const AREAS = [
  ['shell', 'index.html'], ['shell-css', 'apps/design.css'], ['shell-sdk', 'apps/hub.js'],
  ['f260', 'apps/f260.html'], ['leftovers', 'apps/leftovers.html'], ['prayer', 'apps/prayer.html'],
  ['tally', 'apps/tally.html'], ['timer', 'apps/timer.html'], ['dollywood', 'apps/dollywood.html'],
  ['dollywood-live', 'apps/dollywood-live.html'], ['kidverse', 'apps/kidverse.html'], ['verses', 'apps/verses.html'],
];
// Symbols that can stand in for an icon. Letters, digits, ordinary punctuation and the typographic quotes/dashes are not.
const GLYPH = /[←-⇿⌀-⏿■-◿☀-⛿✀-➿⬀-⯿⊕-⊟−×‹›«»…⋯⋮•·✓-✘★☆♥♡✎✕✖⭐⚠ℹ≡☰±＋]/gu;
const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?|[\u{1F3FB}-\u{1F3FF}])*/gu;
const LONG = 20000;

const attr = (tag, a) => { const m = tag.match(new RegExp(`\\s${a}\\s*=\\s*(["'])(.*?)\\1`)); return m ? m[2] : null; };

const result = {};
for (const [area, rel] of AREAS) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const lines = src.split('\n');
  const r = { file: rel, svgs: [], symbols: [], uses: [], strokes: [], glyphs: [], emoji: [], longLines: [] };
  lines.forEach((ln, i) => {
    const L = i + 1;
    if (ln.length > LONG) {
      const e = [...ln.matchAll(EMOJI)].map(m => m[0]);
      r.longLines.push({ line: L, length: ln.length, svgOpen: (ln.match(/<svg\b/g) || []).length, emoji: [...new Set(e)].slice(0, 40), emojiCount: e.length });
      return;
    }
    for (const m of ln.matchAll(/<(svg|symbol)\b[^>]*>/g)) {
      const t = m[0];
      const rec = { line: L, col: m.index + 1, kind: m[1], id: attr(t, 'id'), viewBox: attr(t, 'viewBox'), width: attr(t, 'width'), height: attr(t, 'height'),
        strokeWidth: attr(t, 'stroke-width'), fill: attr(t, 'fill'), stroke: attr(t, 'stroke'), cap: attr(t, 'stroke-linecap'), join: attr(t, 'stroke-linejoin'),
        cls: attr(t, 'class'), aria: attr(t, 'aria-hidden') || attr(t, 'aria-label') || attr(t, 'role'), ctx: ln.slice(Math.max(0, m.index - 60), m.index).trim().slice(-60) };
      (m[1] === 'symbol' ? r.symbols : r.svgs).push(rec);
    }
    for (const m of ln.matchAll(/<use\b[^>]*href\s*=\s*["']#([\w-]+)["']/g)) r.uses.push({ line: L, id: m[1] });
    for (const m of ln.matchAll(/(\$\{[^}]*\}|['"`+]\s*)?#(i-[\w-]+)\b/g)) if (!/href/.test(ln.slice(Math.max(0, m.index - 12), m.index))) r.uses.push({ line: L, id: m[2], indirect: true });
    for (const m of ln.matchAll(/stroke-width\s*[:=]\s*["']?\s*([\d.]+)/g)) r.strokes.push({ line: L, value: +m[1], ctx: ln.slice(Math.max(0, m.index - 50), m.index + 25).trim() });
    for (const m of ln.matchAll(GLYPH)) {
      const before = ln.slice(Math.max(0, m.index - 40), m.index), after = ln.slice(m.index + m[0].length, m.index + m[0].length + 30);
      let tag = 'glyph';
      if (m[0] === '…' && /[A-Za-z0-9)]$/.test(before)) tag = 'ellipsis';
      if (m[0] === '·' || m[0] === '•') tag = 'separator';
      r.glyphs.push({ line: L, ch: m[0], cp: 'U+' + m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0'), tag, ctx: (before + '⟦' + m[0] + '⟧' + after).replace(/\s+/g, ' ') });
    }
    for (const m of ln.matchAll(EMOJI)) {
      if (GLYPH.test(m[0]) && m[0].length === 1) { GLYPH.lastIndex = 0; continue; } // counted as a glyph already
      GLYPH.lastIndex = 0;
      r.emoji.push({ line: L, ch: m[0], ctx: (ln.slice(Math.max(0, m.index - 40), m.index) + '⟦' + m[0] + '⟧' + ln.slice(m.index + m[0].length, m.index + m[0].length + 30)).replace(/\s+/g, ' ') });
    }
  });
  result[area] = r;
}

// Summary per area
const rows = [];
for (const [area, r] of Object.entries(result)) {
  const sw = {}; for (const s of r.strokes) sw[s.value] = (sw[s.value] || 0) + 1;
  const vb = {}; for (const s of [...r.svgs, ...r.symbols]) { const k = s.viewBox || '(none)'; vb[k] = (vb[k] || 0) + 1; }
  const gl = {}; for (const g of r.glyphs.filter(g => g.tag === 'glyph')) gl[g.ch] = (gl[g.ch] || 0) + 1;
  const em = {}; for (const e of r.emoji) em[e.ch] = (em[e.ch] || 0) + 1;
  rows.push({ area, svgTags: r.svgs.length, symbols: r.symbols.length, uses: r.uses.length, strokeWidths: sw, viewBoxes: vb,
    glyphs: gl, glyphCount: Object.values(gl).reduce((a, b) => a + b, 0), emojiDistinct: Object.keys(em).length, emojiCount: r.emoji.length,
    longLineEmoji: r.longLines.reduce((a, l) => a + l.emojiCount, 0) });
}
result._summary = rows;
fs.writeFileSync(path.join(OUT, 'static.json'), JSON.stringify(result, null, 1));
for (const r of rows) console.log(JSON.stringify(r));
