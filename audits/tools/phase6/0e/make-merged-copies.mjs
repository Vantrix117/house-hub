// Batch 0e: four reproduction scripts also read the old whole-map rows INSIDE the page (hub.get('f260.done') …), where the
// Node preload merged-view.mjs cannot reach. This writes copies next to this file with those in-page reads replaced by the
// merge the apps themselves use (hub.rowMap; Verses' rev rows summed onto `log`). Nothing else changes: same steps, same
// timings, same output files. Run the copies with the preload, like the other scripts:
//   node audits/tools/phase6/0e/make-merged-copies.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, '..', '..');
const PREFIX = { 'f260.done': 'done:', 'f260.log': 'log:', 'f260.mem': 'mem:', 'f260.recall': 'recall:' };
const JOBS = [
  ['phase2/SYNC/verify-whole-map-lww-loses-ticks-1.mjs', { './_util.mjs': '../../phase2/SYNC/_util.mjs' }],
  ['phase2/SYNC/verify-whole-map-lww-loses-ticks-2.mjs', { './_util.mjs': '../../phase2/SYNC/_util.mjs' }],
  ['phase2/SYNC/e2a-stale-overwrite.mjs', { './_util.mjs': '../../phase2/SYNC/_util.mjs' }],
  ['phase3/verses/verify-recall-log-whole-map-lww-1.mjs', { './_lib.mjs': '../../phase3/verses/_lib.mjs' }],
];
for (const [rel, imports] of JOBS) {
  let s = fs.readFileSync(path.join(TOOLS, rel), 'utf8');
  for (const [a, b] of Object.entries(imports)) s = s.split(`'${a}'`).join(`'${b}'`);
  for (const [legacy, prefix] of Object.entries(PREFIX)) {
    s = s.split(`hub.get('${legacy}') || {}`).join(`hub.rowMap('${prefix}', '${legacy}')`);
    s = s.split(`hub.get('${legacy}', { app: 'f260', scope: 'person' }) || {}`).join(`hub.rowMap('${prefix}', '${legacy}', { app: 'f260', scope: 'person' })`);
  }
  s = s.split(`(hub.get('log') || {})`).join(`(() => { const o = { ...(hub.get('log') || {}) }; for (const r of hub.list('rev:')) { const d = r.key.slice(4, 14); o[d] = (o[d] || 0) + r.value; } return o; })()`);
  const left = (s.match(/hub\.get\('(f260\.(done|log|mem|recall)|log)'/g) || []).length;
  s = '// COPY (batch 0e) of ' + rel + ': in-page reads of the old whole-map rows replaced by the merged view; see make-merged-copies.mjs\n' + s;
  fs.writeFileSync(path.join(HERE, path.basename(rel)), s);
  console.log(path.basename(rel), 'in-page old-map reads left:', left);
}
