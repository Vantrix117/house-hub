// Compare a capture run with a baseline manifest by SHA-256 (Phase 6 before/after, and the determinism check).
//   node audits/tools/lib/compare.mjs <baseline manifest.json> <new manifest.json>
// Prints how many captures are byte-identical and lists the ones that differ, grouped by screen and state.
import fs from 'node:fs';

const [basePath, newPath] = process.argv.slice(2);
if (!basePath || !newPath) { console.error('usage: node compare.mjs <baseline manifest.json> <new manifest.json>'); process.exit(2); }
const load = p => JSON.parse(fs.readFileSync(p, 'utf8')).captures;
const key = f => f.replace(/\\/g, '/').split('/').slice(-2).join('/');     // <area>/<file>.png
const base = new Map(load(basePath).map(c => [key(c.file), c]));
const now = load(newPath);
let same = 0; const diff = [], missing = [];
for (const c of now) {
  const b = base.get(key(c.file));
  if (!b) missing.push(key(c.file));
  else if (b.sha256 === c.sha256) same++;
  else diff.push(key(c.file));
}
console.log(`identical ${same} of ${now.length}; different ${diff.length}; not in baseline ${missing.length}`);
const groups = {};
for (const d of diff) { const g = d.replace(/-(light|dark)\.png$/, '').replace(/-(ipad-portrait|ipad-landscape|iphone-pwa|iphone-safari|desktop|tv)$/, ''); (groups[g] ||= []).push(d.split('/')[1]); }
for (const [g, files] of Object.entries(groups)) console.log(`  ${g}: ${files.length} (${files.slice(0, 4).join(', ')}${files.length > 4 ? ', …' : ''})`);
if (missing.length) console.log('  not in baseline: ' + missing.slice(0, 10).join(', '));
