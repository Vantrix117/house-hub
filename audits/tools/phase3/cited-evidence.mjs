// Phase 3 cited-evidence check: evidence PNGs that no Phase 3 report cites stay on disk but out of git, because GitHub
// Pages publishes the whole repo (1 GB site limit). Writes audits/evidence/p3/.gitignore listing every uncited PNG.
//   node audits/tools/phase3/cited-evidence.mjs            → rewrite the .gitignore and print the counts
// A PNG counts as cited when its path relative to audits/evidence/p3/ (e.g. "tally/verify-x-1.png") or its bare file
// name appears in audits/03-apps.md or audits/03-apps/*.md. Rerun it whenever a Phase 3 report changes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const EV = path.join(ROOT, 'audits', 'evidence', 'p3');
const reports = [path.join(ROOT, 'audits', '03-apps.md'), ...fs.readdirSync(path.join(ROOT, 'audits', '03-apps')).filter(f => f.endsWith('.md')).map(f => path.join(ROOT, 'audits', '03-apps', f))];
const text = reports.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const pngs = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.png')) pngs.push(p); } })(EV);
const uncited = [], cited = [];
for (const p of pngs) {
  const rel = path.relative(EV, p).replace(/\\/g, '/');
  (text.includes(rel) || text.includes(path.basename(p)) ? cited : uncited).push({ rel, size: fs.statSync(p).size });
}
const mb = a => (a.reduce((s, x) => s + x.size, 0) / 1048576).toFixed(1);
fs.writeFileSync(path.join(EV, '.gitignore'), [
  '# Evidence PNGs not cited by audits/03-apps.md or audits/03-apps/*.md stay on disk but out of git (Pages publishes the whole repo).',
  '# Regenerate with: node audits/tools/phase3/cited-evidence.mjs',
  ...uncited.map(x => x.rel).sort(), ''].join('\n'));
console.log(`${pngs.length} PNGs: ${cited.length} cited (${mb(cited)} MB, committed), ${uncited.length} uncited (${mb(uncited)} MB, git-ignored)`);
const big = cited.filter(x => x.size > 1048576);
if (big.length) console.log('Cited PNGs over 1 MB:\n' + big.map(x => `  ${x.rel} ${(x.size / 1048576).toFixed(2)} MB`).join('\n'));
