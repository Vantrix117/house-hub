// Phase 4 DARK: non-text contrast (WCAG 1.4.11) in the dark renderings, from the rig's themes run.
// For each area: graphics (ring/bar/dot/stroke) and boundary-needing controls (fields, toggles, text-less controls
// without a passing icon) grouped by (doc, selector, kind), with the min ratio per theme and whether the element
// passes in System light but fails in a dark theme ("darkOnly") or fails in both ("both").
//   node audits/tools/phase4/DARK/nontext-dark.mjs
// Writes audits/evidence/p4/DARK/nontext-dark.json. Read-only on raw/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw/themes');
const key = (m, t) => t === 'system' ? 'system-' + m : t === 'hearth' ? 'hearth-' + m : t;
const DARK = ['system-dark', 'midnight', 'forest'];
const hex = c => c ? '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() + (c[3] != null && c[3] < 1 ? '/' + (+c[3]).toFixed(2) : '') : null;
const out = { note: 'graphics: ratio = best adjacent side (rig definition), per theme min over occurrences. controls: boundary = max(fill, border) contrast, only for fields/toggles/text-less controls with no passing icon (the aggregate.mjs rule). status darkOnly = passes (>=3) everywhere in system-light, fails in that dark theme.', areas: {} };
for (const area of fs.readdirSync(RAW)) {
  const dir = path.join(RAW, area); if (!fs.statSync(dir).isDirectory()) continue;
  const G = {}, C = {};
  for (const f of fs.readdirSync(dir)) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (j.v !== 2 || !j.ok) continue;
    const k = key(j.mode, j.theme);
    for (const g of j.nontext.graphics || []) {
      const gk = `${g.doc}|${g.sel}|${g.kind}`; const e = G[gk] ||= { doc: g.doc, sel: g.sel, kind: g.kind, t: {} };
      const r = e.t[k] ||= { min: 99, n: 0, paint: hex(g.paint), jobs: [] }; r.n++; if (g.ratio < r.min) { r.min = g.ratio; r.paint = hex(g.paint); } if (r.jobs.length < 2) r.jobs.push(`themes/${area}/${f.replace('.json', '')}`);
    }
    const icons = j.nontext.icons || [];
    for (const c of j.nontext.controls || []) {
      const iconPass = icons.some(i => i.doc === c.doc && i.pass && i.rect && c.rect && i.rect.x >= c.rect.x - 1 && i.rect.y >= c.rect.y - 1 && i.rect.x + i.rect.w <= c.rect.x + c.rect.w + 1 && i.rect.y + i.rect.h <= c.rect.y + c.rect.h + 1);
      const needs = c.kind === 'field' || c.kind === 'toggle' || (!c.hasText && !iconPass);
      if (!needs || c.boundary == null) continue;
      const ck = `${c.doc}|${c.sel}|${c.kind}`; const e = C[ck] ||= { doc: c.doc, sel: c.sel, kind: c.kind, t: {} };
      const r = e.t[k] ||= { min: 99, n: 0, fill: hex(c.fill), jobs: [] }; r.n++; if (c.boundary < r.min) { r.min = c.boundary; r.fill = hex(c.fill); } if (r.jobs.length < 2) r.jobs.push(`themes/${area}/${f.replace('.json', '')}`);
    }
  }
  const classify = e => { const l = e.t['system-light']; const res = {}; for (const k of DARK) { const d = e.t[k]; if (!d) continue; res[k] = d.min >= 3 ? 'pass' : (l && l.min >= 3 ? 'darkOnly' : 'both'); } return res; };
  const fin = o => Object.values(o).map(e => ({ ...e, status: classify(e) }));
  const g = fin(G), c = fin(C);
  const count = (arr, k, s) => arr.filter(e => e.status[k] === s).length;
  const A = out.areas[area] = { graphics: g.length, controls: c.length, summary: {}, darkOnlyGraphics: g.filter(e => e.status.midnight === 'darkOnly' || e.status['system-dark'] === 'darkOnly'), darkOnlyControls: c.filter(e => e.status.midnight === 'darkOnly' || e.status['system-dark'] === 'darkOnly'), failBothGraphics: g.filter(e => e.status.midnight === 'both') };
  for (const k of DARK) A.summary[k] = { gPass: count(g, k, 'pass'), gDarkOnly: count(g, k, 'darkOnly'), gBoth: count(g, k, 'both'), cPass: count(c, k, 'pass'), cDarkOnly: count(c, k, 'darkOnly'), cBoth: count(c, k, 'both') };
  console.log(area.padEnd(15), JSON.stringify(A.summary.midnight), '| sysdark', JSON.stringify(A.summary['system-dark']));
  for (const e of A.darkOnlyGraphics.slice(0, 12)) console.log('   G darkOnly', e.doc.replace('frame:', ''), e.kind, e.sel.split('>').slice(-2).join('>').trim().slice(0, 50), 'light', e.t['system-light'] && e.t['system-light'].min, 'midnight', e.t.midnight && e.t.midnight.min, e.t.midnight && e.t.midnight.paint);
  for (const e of A.darkOnlyControls.slice(0, 8)) console.log('   C darkOnly', e.doc.replace('frame:', ''), e.kind, e.sel.split('>').slice(-2).join('>').trim().slice(0, 50), 'light', e.t['system-light'] && e.t['system-light'].min, 'midnight', e.t.midnight && e.t.midnight.min, e.t.midnight && e.t.midnight.fill);
}
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/DARK/nontext-dark.json'), JSON.stringify(out, null, 1));
