// Phase 4 COLOR: the app-tile gradient against the house rule "pastel-to-saturated within one hue".
// .ds .app-icon (apps/design.css:606-608): linear-gradient(160deg, tint 22% over --surface, tint 8% over --surface),
// ink = the raw tint. For each app colour (apps.json) and theme: OKLCH of both stops, the tint, and the icon ink's
// contrast on each stop; beside it, the house tile a pastel-to-saturated recipe would give (house fill -> a saturated
// stop of the same hue at OKLCH L 0.72, with the house ink). Usage: node audits/tools/phase4/COLOR/tiles.mjs
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
import { cr, mix, oklch } from './palette.mjs';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../../..');
const TR = JSON.parse(fs.readFileSync(path.join(ROOT, 'audits/evidence/p4/measure/tokens-resolved.json')));
const APPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'))); const list = APPS.apps || APPS;
const out = { note: 'stop1 = tint 22% over --surface, stop2 = tint 8% over --surface (design.css:607); inkOnStop = raw tint as the icon stroke (design.css:608). C = OKLCH chroma; house pastels are C 0.057-0.093 at L 0.88-0.95.', apps: {} };
for (const a of list) {
  out.apps[a.id] = { color: a.color, oklch: oklch(a.color), themes: {} };
  for (const th of ['system-light', 'parchment', 'frost', 'midnight', 'forest']) {
    const s = TR.tokens['--surface'][th], s1 = mix(a.color, s, .22), s2 = mix(a.color, s, .08);
    out.apps[a.id].themes[th] = { stop1: s1, stop2: s2, C1: oklch(s1).C, C2: oklch(s2).C, L1: oklch(s1).L, inkOnStop1: cr(a.color, s1), inkOnStop2: cr(a.color, s2), stopContrast: cr(s1, s2), tileVsSurface: cr(s1, s) };
  }
}
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/COLOR/tiles.json'), JSON.stringify(out, null, 1));
for (const [id, o] of Object.entries(out.apps)) console.log(id.padEnd(15), o.color, 'C', o.oklch.C, Object.entries(o.themes).map(([th, t]) => `${th}: C ${t.C1}->${t.C2} ink ${t.inkOnStop1}/${t.inkOnStop2}`).join(' | '));
