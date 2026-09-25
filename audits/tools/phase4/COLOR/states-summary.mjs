// Summarise the states sweep (states-sweep.mjs): per theme key and area, how many state rules and targets were found,
// how many targets change a text pair, and every text pair that fails AA only in a state (grouped by component).
// Per-person runs (states-sweep.mjs <theme>:<os> <areas> <profile>) are included under their own key.
// Usage: node audits/tools/phase4/COLOR/states-summary.mjs → audits/evidence/p4/COLOR/states-summary.json (+ prints the groups)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../lib/local.mjs';
const DIR = path.join(ROOT, 'audits/evidence/p4/COLOR/states');
const KEYS = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();   // the 7 theme keys as Eli, plus any per-person runs (<theme>-<os>-<profile>)
const out = { method: 'audits/tools/phase4/COLOR/states-sweep.mjs (desktop 1440x900, Chromium, eli; Kid Verse as ezra)', keys: {}, newFailGroups: [], pseudo: [] };
const groups = new Map();
for (const k of KEYS) {
  const f = path.join(DIR, k + '.json'); if (!fs.existsSync(f)) { out.keys[k] = 'missing'; continue; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  out.keys[k] = {};
  for (const a of j.areas) {
    if (a.error) { out.keys[k][a.area] = { error: a.error }; continue; }
    out.keys[k][a.area] = { applied: a.applied, cloned: a.cloned, targets: a.targets, changed: a.changed.length, newFail: a.changed.filter(c => c.newFail).length };
    for (const c of a.changed) for (const t of c.inState) {
      if (!t.fail || (t.restMedian != null && t.restMedian < (t.large ? 3 : 4.5))) continue;
      const comp = c.path.split(' > ').slice(-2).join(' > ').replace(/#[\w-]+/g, '#…');
      const key = [a.area, c.state, comp, t.fs, t.color].join('|');
      const g = groups.get(key) || { area: a.area, state: c.state, component: comp, fs: t.fs, fw: t.fw, color: t.color, keys: new Set(), n: 0, median: [Infinity, 0], rest: [Infinity, 0], sample: t.text };
      g.keys.add(k); g.n++; g.median = [Math.min(g.median[0], t.median), Math.max(g.median[1], t.median)];
      if (t.restMedian != null) g.rest = [Math.min(g.rest[0], t.restMedian), Math.max(g.rest[1], t.restMedian)];
      groups.set(key, g);
    }
    for (const p of a.pseudo || []) out.pseudo.push({ key: k, area: a.area, path: p.path, content: p.content, fs: p.fs, ratio: p.ratio, fail: p.fail });
  }
}
out.newFailGroups = [...groups.values()].map(g => ({ ...g, keys: [...g.keys] })).sort((a, b) => a.area.localeCompare(b.area) || a.median[0] - b.median[0]);
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/COLOR/states-summary.json'), JSON.stringify(out, null, 1));
for (const g of out.newFailGroups) console.log(`${g.area} ${g.state} ${g.component} ${g.fs}px ${g.color} ×${g.n} in ${g.keys.join(',')}: ${g.median.join('-')} (rest ${g.rest.join('-')}) "${g.sample}"`);
const pf = out.pseudo.filter(p => p.fail); console.log(`pseudo-element text: ${out.pseudo.length} measured, ${pf.length} fail`, pf.map(p => p.key + ' ' + p.path + ' ' + p.ratio).join('; '));
