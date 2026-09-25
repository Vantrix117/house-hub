// Phase 4 COLOR: area x theme table of text pairs measured / failing AA, from the committed rig summaries.
// Usage: node audits/tools/phase4/COLOR/table.mjs  -> audits/evidence/p4/COLOR/table.json + prints markdown
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../../..');
const M = path.join(ROOT, 'audits/evidence/p4/measure');
const OUT = path.join(ROOT, 'audits/evidence/p4/COLOR'); fs.mkdirSync(OUT, { recursive: true });
const pairs = JSON.parse(fs.readFileSync(path.join(M, 'pairs.json'))).areas;
const fp = JSON.parse(fs.readFileSync(path.join(M, 'failing-pairs.json')));
const THEMES = ['system-light','system-dark','hearth-dark','parchment','frost','midnight','forest'];
const AREAS = ['shell','tv','f260','leftovers','prayer','tally','timer','dollywood','dollywood-live','kidverse','verses'];
const res = {};
for (const a of AREAS) {
  res[a] = {};
  let full = {}; try { full = JSON.parse(fs.readFileSync(path.join(M, 'failing-pairs', a + '.json'))); } catch {}
  for (const t of THEMES) {
    const p = pairs[a]?.[t]; if (!p) { res[a][t] = null; continue; }
    const groups = full[t] || [];
    const real = groups.filter(g => !g.suspect);
    const solid = real.filter(g => g.medAlsoFails > 0 && !g.bgImage);
    const inter = real.filter(g => g.interactive);
    res[a][t] = { pairs: p.pairs, failingPairs: p.failingPairs, occ: p.occurrences, failOcc: p.failingOccurrences,
      pctOcc: +(100 * p.failingOccurrences / Math.max(1, p.occurrences)).toFixed(1),
      groups: groups.length, nonSuspect: real.length, medFailGroups: solid.length, interactiveGroups: inter.length,
      worst: real.slice().sort((x, y) => x.minP10 - y.minP10).slice(0, 3).map(g => `${g.sel.split(' > ').slice(-2).join(' > ')} "${(g.texts||[])[0]||''}" ${g.color} on ${g.bgMed} p10 ${g.minP10} med ${g.medMedian}`) };
  }
}
fs.writeFileSync(path.join(OUT, 'table.json'), JSON.stringify({ note: 'Per area x theme from pairs.json (pairs = unique colour/bg-bucket/size; occ = text occurrences measured) and failing-pairs/<area>.json (groups = selector+colour groups below AA; nonSuspect excludes p10-only-on-solid; medFailGroups = non-suspect groups that fail at the median on a non-image background).', res }, null, 1));
let md = '| Area | ' + THEMES.join(' | ') + ' |\n|---|' + THEMES.map(() => '---').join('|') + '|\n';
for (const a of AREAS) md += `| ${a} | ` + THEMES.map(t => { const r = res[a][t]; return r ? `${r.failingPairs}/${r.pairs} · ${r.failOcc}/${r.occ} (${r.pctOcc}%) · g${r.nonSuspect}` : '—'; }).join(' | ') + ' |\n';
console.log(md);
