// Phase 4 GLASS — live backdrop-filter layers whose own background is (almost) opaque, so the blur can never show:
// cost with no visual effect. From the v2 raw files (glass[].bg = computed background-color rgba, the top-most fill;
// gradients in background-image are translucent sheens over it). Writes audits/evidence/p4/GLASS/opaque-blur.json.
//   node audits/tools/phase4/GLASS/opaque-blur.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw');
const S = {};
for (const run of ['themes', 'devices', 'states']) for (const area of fs.readdirSync(path.join(RAW, run))) for (const f of fs.readdirSync(path.join(RAW, run, area))) {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, run, area, f), 'utf8')); if (j.v !== 2) continue;
  for (const d of j.docs || []) for (const g of d.glass || []) {
    if (!g.bf || !(g.visArea > 0)) continue;
    const a = g.bg ? g.bg[3] : 0; const k = area + ' | ' + d.name + ' | ' + g.sel;
    const s = S[k] ||= { area, doc: d.name, sel: g.sel, n: 0, alphaMin: 1, alphaMax: 0, bgs: new Set(), maxVisArea: 0, job: null };
    s.n++; s.alphaMin = Math.min(s.alphaMin, a); s.alphaMax = Math.max(s.alphaMax, a); s.bgs.add(JSON.stringify(g.bg)); if (g.visArea > s.maxVisArea) { s.maxVisArea = g.visArea; s.job = `${run}/${area}/${f.replace(/\.json$/, '')}`; }
  }
}
const all = Object.values(S).map(s => ({ ...s, bgs: [...s.bgs].slice(0, 4) }));
const opaque = all.filter(s => s.alphaMin >= 0.95).sort((a, b) => b.maxVisArea - a.maxVisArea);
const out = { note: 'Live blur layers (visible, computed backdrop-filter) by selector with the alpha range of their computed background-color across every job and theme. opaque = alphaMin >= 0.95: the fill hides the blurred backdrop entirely (alpha 0.84 glass-strong keeps 16% of it).', opaque, alphaHistogram: Object.fromEntries(['<0.5', '0.5-0.7', '0.7-0.9', '0.9-0.95', '>=0.95'].map(b => [b, 0])), all: all.sort((a, b) => a.alphaMin - b.alphaMin) };
for (const s of all) { const a = s.alphaMin; out.alphaHistogram[a < 0.5 ? '<0.5' : a < 0.7 ? '0.5-0.7' : a < 0.9 ? '0.7-0.9' : a < 0.95 ? '0.9-0.95' : '>=0.95']++; }
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/GLASS/opaque-blur.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.alphaHistogram));
for (const s of all) console.log(s.area.padEnd(15), s.doc.padEnd(20), s.sel.slice(0, 55).padEnd(55), 'alpha', s.alphaMin, '-', s.alphaMax, 'max', s.maxVisArea, s.bgs[0]);
