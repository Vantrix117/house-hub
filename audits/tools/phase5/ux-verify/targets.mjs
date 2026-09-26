// Phase 5 step 3: the high and medium usability, visual, consistency and gap items (UX-*, VIS-*, CONS-*, GAP-*)
// that go to two-skeptic verification. Reads audits/evidence/p5/catalog.json; writes
//   audits/evidence/p5/ux-verify/targets.json   the items, grouped (≤ 3 per group, one source report per group)
//   audits/evidence/p5/ux-verify/items/<ID>.md  each item's full report block, for the skeptics to read
//   node audits/tools/phase5/ux-verify/targets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify');
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'audits/evidence/p5/catalog.json'), 'utf8'));
const sel = cat.filter(f => /^(UX|VIS|CONS|GAP)$/.test(f.kind) && !f.pointerTo && /^(high|medium)$/.test(f.severity));
fs.mkdirSync(path.join(OUT, 'items'), { recursive: true });
for (const f of sel) fs.writeFileSync(path.join(OUT, 'items', f.id + '.md'),
  `<!-- ${f.file}:${f.line} · section "${f.section}" · area ${f.area} · kind ${f.kind} · rated ${f.severity} -->\n${f.block}\n`);
const byFile = {};
for (const f of sel) (byFile[f.file] = byFile[f.file] || []).push(f);
const groups = [];
for (const [file, list] of Object.entries(byFile)) {
  const n = Math.ceil(list.length / 3), size = Math.ceil(list.length / n);
  for (let k = 0; k < list.length; k += size) groups.push({ key: 'G' + String(groups.length + 1).padStart(2, '0'), file, items: list.slice(k, k + size).map(f => ({ id: f.id, kind: f.kind, severity: f.severity, area: f.area, line: f.line, title: f.title.replace(/\*\*/g, '').trim(), itemFile: `audits/evidence/p5/ux-verify/items/${f.id}.md` })) });
}
fs.writeFileSync(path.join(OUT, 'targets.json'), JSON.stringify({ count: sel.length, groups }, null, 1));
console.log(sel.length, 'items in', groups.length, 'groups;', JSON.stringify(sel.reduce((m, f) => (m[f.kind + ' ' + f.severity] = (m[f.kind + ' ' + f.severity] || 0) + 1, m), {})));
