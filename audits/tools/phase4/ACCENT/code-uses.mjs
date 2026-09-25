#!/usr/bin/env node
// Phase 4 ACCENT — static inventory of every use of the person-colour tokens in the shell and the nine apps.
// Scans index.html, apps/design.css, apps/<app>.html and, for the two generated Dollywood files, the sibling template
// (../dollywood-build-project/scripts/template.html, read-only; its CSS lines are the same lines in the exports) for
// var(--accent…), --tint, --tint-ink, --on-accent, --glass-pickup and --glow-accent, and classifies each by the CSS
// property it paints (ink = color/stroke/fill of glyphs; fill = background; line = border/outline/box-shadow ring;
// glass = the pickup inside a glass recipe; var = a token (re)definition) and by which accent token (raw --accent vs
// the scheme-adapted --accent-deep/-soft/-tint).
//
//   node audits/tools/phase4/ACCENT/code-uses.mjs     → audits/evidence/p4/ACCENT/code-uses.json + a printed table
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'ACCENT');
const TEMPLATE = path.resolve(ROOT, '..', 'dollywood-build-project', 'scripts', 'template.html');
const FILES = [
  ['design.css', 'apps/design.css'], ['shell', 'index.html'], ['f260', 'apps/f260.html'], ['leftovers', 'apps/leftovers.html'],
  ['prayer', 'apps/prayer.html'], ['tally', 'apps/tally.html'], ['timer', 'apps/timer.html'], ['kidverse', 'apps/kidverse.html'],
  ['verses', 'apps/verses.html'], ['dollywood (template)', TEMPLATE],
];
const RX = /var\(--(accent(?:-soft|-tint|-deep|-strong|-glow)?|tint(?:-ink)?|on-accent|glass-pickup|glow-accent)\b[^)]*\)|--(accent(?:-soft|-tint|-deep|-strong|-glow)?|tint(?:-ink)?)\s*:/g;
const out = { note: 'Per file: every match of the person-colour tokens, with the line, the CSS property it sits in and a role. role: ink (color/stroke/fill/caret/text), fill (background/stop-color), line (border/outline/box-shadow), glass (inside a glass recipe: the pickup), def (the token is (re)defined here), js (inside script: inline style or SVG attribute). token: raw = --accent/--tint (the unadapted profile hex); adapted = --accent-deep/-strong/-soft/-tint; on = --on-accent; other = glow/pickup. Lines longer than 6000 characters are skipped (the generated Dollywood exports; the template is scanned instead).', files: {} };

for (const [area, rel] of FILES) {
  const f = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  if (!fs.existsSync(f)) { out.files[area] = { error: 'missing ' + f }; continue; }
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const uses = [];
  let inScript = false;
  lines.forEach((ln, i) => {
    if (/<script\b/.test(ln) && !/<script[^>]*src=/.test(ln)) inScript = true;
    if (ln.length > 6000) { if (/<\/script>/.test(ln)) inScript = false; return; }
    RX.lastIndex = 0; let m;
    while ((m = RX.exec(ln))) {
      const name = m[1] || m[2];
      const before = ln.slice(0, m.index);
      const decl = /([a-z-]+)\s*:[^;:{}]*$/.exec(before);            // the property this var() sits in
      const prop = m[2] ? '--' + m[2] : decl ? decl[1] : (inScript ? 'script' : '?');
      let role = 'other';
      if (m[2]) role = 'def';
      else if (/glass-pickup/.test(name)) role = 'glass';
      else if (/^--/.test(prop)) role = 'def';
      else if (/^(color|stroke|fill|caret-color|-webkit-text-fill-color|text-decoration-color|accent-color)$/.test(prop)) role = 'ink';
      else if (/^(background|background-color|background-image|stop-color|flood-color)$/.test(prop)) role = /radial-gradient\(90% 70% at var\(--sheen-x\)/.test(before.slice(-120)) ? 'glass' : 'fill';
      else if (/^(border|border-color|border-top-color|border-bottom-color|outline|outline-color|box-shadow|filter)$/.test(prop)) role = 'line';
      else if (inScript) role = 'js';
      const token = /^(accent|tint)$/.test(name) ? 'raw' : /deep|strong|soft|tint-ink|accent-tint/.test(name) ? 'adapted' : name === 'on-accent' ? 'on' : 'other';
      const sel = (() => { for (let k = i; k >= Math.max(0, i - 6); k--) { const s = /([^{}]+)\{[^}]*$/.exec(k === i ? before : lines[k]); if (s) return s[1].trim().slice(-90); } return null; })();
      uses.push({ line: i + 1, token: name, kind: token, prop, role, sel, text: ln.trim().slice(0, 160) });
    }
    if (/<\/script>/.test(ln)) inScript = false;
  });
  const count = (fn) => uses.filter(fn).length;
  out.files[area] = {
    file: path.isAbsolute(rel) ? '../dollywood-build-project/scripts/template.html' : rel,
    total: uses.length,
    byRole: Object.fromEntries(['ink', 'fill', 'line', 'glass', 'def', 'js', 'other'].map(r => [r, count(u => u.role === r)])),
    rawInk: uses.filter(u => u.kind === 'raw' && u.role === 'ink').map(u => `${u.line} ${u.sel || ''} → ${u.prop}`),
    rawLine: uses.filter(u => u.kind === 'raw' && u.role === 'line').map(u => `${u.line} ${u.sel || ''} → ${u.prop}`),
    adaptedInk: count(u => u.kind === 'adapted' && u.role === 'ink'),
    overrides: uses.filter(u => u.role === 'def' && u.kind !== 'other').map(u => `${u.line} ${u.sel || ''} ${u.token}`),
    hardFallbacks: uses.filter(u => /var\(--accent,\s*#/.test(u.text)).map(u => u.line),
    uses,
  };
}
fs.writeFileSync(path.join(OUT, 'code-uses.json'), JSON.stringify(out, null, 1));
console.log('area'.padEnd(22), 'total ink fill line glass def js | rawInk rawLine adaptedInk overrides');
for (const [a, f] of Object.entries(out.files)) {
  if (f.error) { console.log(a, f.error); continue; }
  const r = f.byRole;
  console.log(a.padEnd(22), String(f.total).padStart(5), r.ink, r.fill, r.line, r.glass, r.def, r.js, '|', f.rawInk.length, f.rawLine.length, f.adaptedInk, f.overrides.length);
}
for (const [a, f] of Object.entries(out.files)) if (f.rawInk && f.rawInk.length) console.log('\nRAW INK', a, '\n  ' + f.rawInk.join('\n  '));
for (const [a, f] of Object.entries(out.files)) if (f.overrides && f.overrides.length) console.log('\nOVERRIDES', a, '\n  ' + f.overrides.join('\n  '));
