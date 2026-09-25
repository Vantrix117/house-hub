// TELL / static: every web-tell-relevant declaration and call in the 11 source files, with file:line.
//   node audits/tools/phase4/TELL/static.mjs   → audits/evidence/p4/TELL/static.json
// Lines longer than 4000 chars (the Dollywood data blobs) are skipped for CSS/JS patterns and reported as skipped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const FILES = { 'design.css': 'apps/design.css', 'hub.js': 'apps/hub.js', shell: 'index.html', f260: 'apps/f260.html', leftovers: 'apps/leftovers.html', prayer: 'apps/prayer.html', tally: 'apps/tally.html', timer: 'apps/timer.html', dollywood: 'apps/dollywood.html', 'dollywood-live': 'apps/dollywood-live.html', kidverse: 'apps/kidverse.html', verses: 'apps/verses.html' };
const P = {
  viewport: /<meta[^>]+name=["']?viewport["']?[^>]*>/i,
  tapHighlight: /-webkit-tap-highlight-color\s*:\s*([^;}"]+)/,
  userSelect: /(?:-webkit-)?user-select\s*:\s*([a-z-]+)/,
  touchCallout: /-webkit-touch-callout\s*:\s*([a-z-]+)/,
  userDrag: /-webkit-user-drag|draggable\s*=\s*["']?false|ondragstart|dragstart/,
  overscroll: /overscroll-behavior(?:-[xy])?\s*:\s*([a-z ]+)/,
  scrollbar: /scrollbar-width\s*:\s*([a-z]+)|::-webkit-scrollbar[\w-]*|scrollbar-gutter|scrollbar-color/,
  focusVisible: /:focus-visible/,
  focusPlain: /:focus(?![-\w])/,
  outlineNone: /outline\s*:\s*(none|0)\b/,
  appearanceNone: /(?:-webkit-)?appearance\s*:\s*none/,
  touchAction: /touch-action\s*:\s*([a-z- ]+)/,
  dialog: /(?<![\w.$'"`])(?:window\.)?(alert|confirm|prompt)\s*\(/,
  skeleton: /skeleton|shimmer/i,
  spinner: /spinner|@keyframes\s+spin|\bspin\b\s+[\d.]+m?s|rotate\(360deg\)/i,
  loadingText: /Loading[ .…]|Building the 3D|>…<|'…'|"…"/,
  anchor: /<a\s[^>]*href|createElement\(['"]a['"]\)|<a href/,
  hover: /:hover/,
  hoverGuard: /@media[^{]*hover\s*:\s*hover/,
  colorScheme: /color-scheme\s*:\s*([a-z ]+)|name=["']color-scheme/,
  nativeCtl: /<select\b|type=["']?(checkbox|radio|range|date|number|search|time|file)\b/,
};
const out = { note: 'Per source file, every line matching a web-tell pattern (line numbers 1-based). dialog = alert( / confirm( / prompt( not preceded by a word char, dot or quote (so hub.confirm, confirmModal( and "confirm(" in strings are excluded). Long lines (>4000 chars) are skipped and counted.', files: {} };
for (const [k, f] of Object.entries(FILES)) {
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  const R = { file: f, lines: lines.length, skippedLong: 0, hits: {} };
  lines.forEach((ln, i) => {
    if (ln.length > 4000) { R.skippedLong++; return; }
    for (const [p, re] of Object.entries(P)) {
      const m = ln.match(re); if (!m) continue;
      (R.hits[p] ||= []).push({ line: i + 1, m: (m[1] || m[0]).trim().slice(0, 60), text: ln.trim().slice(0, 160) });
    }
  });
  R.counts = Object.fromEntries(Object.keys(P).map(p => [p, (R.hits[p] || []).length]));
  out.files[k] = R;
}
fs.mkdirSync(path.join(ROOT, 'audits/evidence/p4/TELL'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/TELL/static.json'), JSON.stringify(out, null, 1));
const keys = Object.keys(P);
console.log('file'.padEnd(15) + keys.map(k => k.slice(0, 9).padStart(10)).join(''));
for (const [k, R] of Object.entries(out.files)) console.log(k.padEnd(15) + keys.map(p => String(R.counts[p]).padStart(10)).join('') + (R.skippedLong ? `  (skipped ${R.skippedLong} long)` : ''));
