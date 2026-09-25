// Phase 4 COLOR: non-text contrast summary per area from nontext/<area>.json (svg icons only for icon failures,
// as the rig verifier asked; emoji/img counted apart as informational). Writes audits/evidence/p4/COLOR/nontext-summary.json
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../../..');
const M = path.join(ROOT, 'audits/evidence/p4/measure/nontext');
const AREAS = ['shell','tv','f260','leftovers','prayer','tally','timer','dollywood','dollywood-live','kidverse','verses'];
const tail = s => s.split(' > ').slice(-2).join(' > ');
const out = {};
for (const a of AREAS) {
  const n = JSON.parse(fs.readFileSync(path.join(M, a + '.json')));
  const svg = n.icons.filter(i => i.kind === 'svg'), emo = n.icons.filter(i => i.kind !== 'svg');
  const bySel = (arr, key = g => tail(g.sel)) => { const m = {}; for (const g of arr) { const k = key(g); const e = m[k] ||= { n: 0, min: 99, max: 0, themes: new Set(), ex: null }; e.n += g.n; e.min = Math.min(e.min, g.minRatio ?? g.minBoundary); e.max = Math.max(e.max, g.minRatio ?? g.minBoundary); e.themes.add(g.theme); if (!e.ex || (g.minRatio ?? g.minBoundary) <= (e.ex.minRatio ?? e.ex.minBoundary)) e.ex = g; } return Object.fromEntries(Object.entries(m).sort((x, y) => y[1].n - x[1].n).map(([k, e]) => [k, { n: e.n, min: +e.min.toFixed(2), maxOfMins: +e.max.toFixed(2), themes: [...e.themes], ink: e.ex.ink || e.ex.paint || e.ex.fill, bg: e.ex.bg || e.ex.adjacentAtMin || e.ex.outside, kind: e.ex.kind, job: e.ex.jobs?.[0] }])); };
  out[a] = {
    counts: n.counts,
    svgIconFailOcc: svg.reduce((s, g) => s + g.n, 0), emojiImgLowOcc: emo.reduce((s, g) => s + g.n, 0),
    svgIcons: bySel(svg),
    controlsByKind: Object.fromEntries(['field', 'toggle', 'chip', 'button'].map(k => [k, bySel(n.controls.filter(c => c.kind === k))])),
    graphics: Object.fromEntries([...new Set(n.graphics.map(g => g.kind))].map(k => [k, bySel(n.graphics.filter(g => g.kind === k))])),
  };
}
fs.mkdirSync(path.join(ROOT, 'audits/evidence/p4/COLOR'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/COLOR/nontext-summary.json'), JSON.stringify({ note: 'Per area: counts from the rig; svgIconFailOcc = occurrences of svg icons < 3:1 (emoji/img excluded, informational); groups keyed by the last two selector steps, n = occurrences, min = worst ratio, maxOfMins = best of the per-group minima, themes where it fails.', areas: out }, null, 1));
for (const a of AREAS) {
  const o = out[a]; console.log(`\n## ${a}  svgIconFail ${o.svgIconFailOcc} (emoji/img low ${o.emojiImgLowOcc}); controlFail ${o.counts.controlFail}/${o.counts.controlNeedsBoundary}; graphicFail ${o.counts.graphicFail}/${o.counts.graphics} ${JSON.stringify(o.counts.graphicFailByKind)}`);
  for (const [k, v] of Object.entries(o.svgIcons).slice(0, 6)) console.log('  icon', k, JSON.stringify(v).slice(0, 220));
  for (const kind of Object.keys(o.controlsByKind)) for (const [k, v] of Object.entries(o.controlsByKind[kind]).slice(0, 5)) console.log('  ctl', kind, k, JSON.stringify(v).slice(0, 200));
  for (const kind of Object.keys(o.graphics)) for (const [k, v] of Object.entries(o.graphics[kind]).slice(0, 6)) console.log('  gfx', kind, k, JSON.stringify(v).slice(0, 240));
}
