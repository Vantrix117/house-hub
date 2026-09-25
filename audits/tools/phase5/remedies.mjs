// Phase 5: the remedies earlier phases already proposed, in one JSON file.
//  - Phase 3 improvements (each app report's §7 tables: polish / missing features / new ideas, with delight, effort and
//    the finding IDs in their Evidence column);
//  - Phase 4 gap-by-gap coverage rows (04-design-system.md, "Gap-by-gap coverage": row id, gap, source IDs, tokens, status).
//   node audits/tools/phase5/remedies.mjs  → audits/evidence/p5/remedies.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const A = p => path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), p);
const IDRE = /\b(?:P[2-4]-[A-Z0-9]+(?:-[A-Z]+)?-\d+|(?:[A-Z]+-)?(?:UX|VIS|GAP|CONS)(?:-[A-Z0-9]+)*-\d+)\b/g;
const cells = l => l.split('|').slice(1, -1).map(s => s.trim());
const imps = [];
for (const f of fs.readdirSync(A('03-apps')).filter(f => f.endsWith('.md'))) {
  const app = f.slice(0, -3), L = fs.readFileSync(A('03-apps/' + f), 'utf8').split(/\r?\n/);
  let on = false, kind = null;
  L.forEach((l, i) => {
    if (/^## 7\. Improvements/.test(l)) on = true; else if (/^## /.test(l)) on = false;
    if (!on) return;
    const k = l.match(/^\*\*(Polish|Missing features|New ideas)\*\*/); if (k) kind = { Polish: 'polish', 'Missing features': 'feature', 'New ideas': 'idea' }[k[1]];
    const c = /^\| *\d+ *\|/.test(l) ? cells(l) : null;
    if (c && c.length >= 5) imps.push({ id: `IMP-${app.toUpperCase()}-${kind[0].toUpperCase()}${c[0]}`, app, kind, rank: +c[0], text: c[1], delight: +c[2], effort: c[3], ratio: +c[4], evidence: c[5] || '', ids: [...new Set((c[5] || '').match(IDRE) || [])], src: `audits/03-apps/${f}:${i + 1}` });
  });
}
const gaps = [];
const D = fs.readFileSync(A('04-design-system.md'), 'utf8').split(/\r?\n/);
const g0 = D.findIndex(l => /^### Gap-by-gap coverage/.test(l)), g1 = D.findIndex((l, i) => i > g0 && /^### /.test(l));
for (let i = g0; i < g1; i++) { const l = D[i]; if (!/^\| *[A-Z]+-\d+ *\|/.test(l)) continue; const c = cells(l); gaps.push({ row: c[0], gap: c[1], source: c[2], tokens: c[3], status: c[4], ids: [...new Set((c[1] + ' ' + c[2]).match(IDRE) || [])], src: `audits/04-design-system.md:${i + 1}` }); }
fs.writeFileSync(A('evidence/p5/remedies.json'), JSON.stringify({ improvements: imps, gapRows: gaps }, null, 1));
console.log(imps.length, 'improvements;', gaps.length, 'gap rows;', imps.filter(x => !x.ids.length).length, 'improvements with no finding ID');
