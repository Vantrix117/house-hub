#!/usr/bin/env node
// Phase 4 ACCENT — one element across every profile × theme, from runtime.mjs output.
//   node audits/tools/phase4/ACCENT/matrix.mjs "<selector regex>" [text|nontext] [--include-covered]
// Prints the lowest rendered ratio per signed-in profile (rows) and theme key (columns): text = p10 of the ink over the
// pixels under it; nontext = paint vs the nearest opaque declared background. "·" = not on screen for that profile.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const BASE = path.join(ROOT, 'audits/evidence/p4/ACCENT/runtime');
const [re, kind = 'text'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const incCov = process.argv.includes('--include-covered');
const RX = new RegExp(re);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.json') ? [path.join(d, e.name)] : []);
const M = {}; const themes = new Set(); const texts = new Set();
for (const f of walk(BASE)) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (!j.ok) continue;
  const th = (j.variant === 'park' ? 'park-' : '') + j.theme;
  for (const d of j.docs) for (const r of d.recs || []) {
    if (!RX.test(r.sel) || (r.covered && !incCov)) continue;
    const v = kind === 'text' ? r.p10 : r.nontext && r.nontext.vsDecl;
    if (v == null) continue;
    themes.add(th); if (r.text) texts.add(r.text.slice(0, 30));
    const row = M[j.profile] ||= {}; row[th] = Math.min(row[th] ?? 99, v);
  }
}
const T = [...themes].sort();
console.log('selector /' + re + '/ ' + kind + (texts.size ? ' — e.g. "' + [...texts].slice(0, 3).join('", "') + '"' : ''));
console.log('profile'.padEnd(12) + T.map(t => t.replace('park-', 'p-').padStart(13)).join(''));
for (const [p, row] of Object.entries(M)) console.log(p.padEnd(12) + T.map(t => String(row[t] == null ? '·' : row[t].toFixed(2)).padStart(13)).join(''));
