// Phase 4 GLASS — glass layers per area from the v2 measurement raw files (read-only).
// For every job and document: live-blur layers (computed backdrop-filter), recipe-look layers without blur,
// hand-made glass (a backdrop-filter on an element with no shared recipe class), chrome vs content (the rig's
// heuristic, page-lib.mjs glass()), visible painted area. Writes audits/evidence/p4/GLASS/layers.json.
//   node audits/tools/phase4/GLASS/layers.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw');
const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS/layers.json');

const files = [];
for (const run of ['themes', 'devices', 'states']) for (const area of fs.readdirSync(path.join(RAW, run))) for (const f of fs.readdirSync(path.join(RAW, run, area))) files.push({ run, area, f: path.join(RAW, run, area, f) });

const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const A = {};
for (const { run, area, f } of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (j.v !== 2) continue;
  const a = A[area] ||= { jobs: 0, perJob: [], share: [], sels: {}, byDevice: {} };
  a.jobs++;
  let live = 0, liveArea = 0, contentLive = 0, look = 0, own = 0, vp = 0;
  for (const d of j.docs || []) {
    const vpA = d.meta && d.meta.vw ? d.meta.vw * d.meta.vh : null;
    for (const g of d.glass || []) {
      const vis = g.visArea > 0;
      const key = (d.name === 'page' ? 'page' : d.name) + ' :: ' + g.sel;
      const s = a.sels[key] ||= { sel: g.sel, doc: d.name, bf: new Set(), recipe: g.recipe, chrome: g.chrome, why: g.why, n: 0, visN: 0, maxVisArea: 0, maxW: 0, maxH: 0, example: null };
      s.n++; if (g.bf) s.bf.add(g.bf); else s.bf.add('none');
      if (vis) { s.visN++; if (g.visArea > s.maxVisArea) { s.maxVisArea = g.visArea; s.maxW = g.w; s.maxH = g.h; s.example = `${run}/${area}/${path.basename(f, '.json')}`; } }
      if (!vis) continue;
      if (g.bf) { live++; liveArea += g.visArea; if (!g.chrome) contentLive++; if (!g.recipe) own++; }
      else if (g.recipe) look++;
    }
  }
  const page = (j.docs || []).find(d => d.name === 'page');
  vp = page && page.meta && page.meta.vw ? page.meta.vw * page.meta.vh : null;
  a.perJob.push({ job: `${run}/${area}/${path.basename(f, '.json')}`, device: j.device, live, contentLive, own, look, liveArea, share: vp ? liveArea / vp : null });
  const bd = a.byDevice[j.device] ||= []; bd.push(live);
}
const out = { note: 'Per area, from v2 raw (all three runs). live = visible elements with a computed backdrop-filter (any document of the job); contentLive = live layers the rig classes as content (not fixed/sticky, no chrome name, tag or role); own = live layers on an element with none of the shared recipe classes (glass, glass-strong, btn-glass, pill, topbar, tabbar, sheet) = hand-made glass; look = visible recipe-class elements whose backdrop-filter is none (the look without blur: the .card.glass guard, the TV panes). share = live visible area / page viewport (overlaps counted twice). Selectors list every element seen, with the job where it was largest.', areas: {} };
for (const [area, a] of Object.entries(A)) {
  const L = a.perJob.map(p => p.live), C = a.perJob.map(p => p.contentLive), S = a.perJob.map(p => p.share).filter(x => x != null);
  const top = [...a.perJob].sort((x, y) => y.liveArea - x.liveArea || y.live - x.live).slice(0, 5);
  out.areas[area] = {
    jobs: a.jobs,
    live: { median: q(L, .5), p90: q(L, .9), max: Math.max(...L) },
    contentLive: { jobsWith: C.filter(x => x > 0).length, share: +(C.filter(x => x > 0).length / a.jobs).toFixed(3), max: Math.max(...C) },
    ownLiveJobs: a.perJob.filter(p => p.own > 0).length,
    lookOnlyJobs: a.perJob.filter(p => p.look > 0).length,
    areaShare: { median: +(q(S, .5) || 0).toFixed(3), p90: +(q(S, .9) || 0).toFixed(3), max: +(Math.max(0, ...S)).toFixed(3) },
    liveByDevice: Object.fromEntries(Object.entries(a.byDevice).map(([k, v]) => [k, { median: q(v, .5), max: Math.max(...v) }])),
    heaviest: top,
    elements: Object.values(a.sels).filter(s => s.visN > 0).map(s => ({ ...s, bf: [...s.bf] })).sort((x, y) => y.maxVisArea - x.maxVisArea),
  };
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
for (const [area, v] of Object.entries(out.areas)) {
  console.log(`${area.padEnd(15)} jobs ${String(v.jobs).padStart(4)} live med ${v.live.median} p90 ${v.live.p90} max ${v.live.max} | contentLive jobs ${v.contentLive.jobsWith} (${(v.contentLive.share * 100).toFixed(0)}%) max ${v.contentLive.max} | own-glass jobs ${v.ownLiveJobs} | look-only jobs ${v.lookOnlyJobs} | area share med ${v.areaShare.median} max ${v.areaShare.max}`);
}
console.log('wrote', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
