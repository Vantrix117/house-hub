// Phase 4 DARK: app-local custom properties (docs[].tokens.local in the rig's raw files) that resolve to the same
// value in System light and in Midnight/Forest, i.e. local colours that do not adapt to dark.
//   node audits/tools/phase4/DARK/local-tokens.mjs  -> audits/evidence/p4/DARK/local-tokens.json
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw/themes');
const out = { note: 'Per app document: local custom properties with a colour value, their resolved value in system-light, midnight and forest, and same=true when all three are identical (does not adapt). One job per theme (the first screen alphabetically that has the document).', docs: {} };
for (const area of fs.readdirSync(RAW)) {
  const dir = path.join(RAW, area); if (!fs.statSync(dir).isDirectory()) continue;
  const per = {};
  for (const f of fs.readdirSync(dir).sort()) {
    const m = f.match(/-(light|dark)-(system|midnight|forest)\.json$/); if (!m) continue;
    const k = m[2] === 'system' ? 'system-' + m[1] : m[2]; if (k === 'system-dark') continue;
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const d of j.docs) { if (!d.name.startsWith('frame:')) continue; const loc = d.tokens && d.tokens.local || {}; if (!Object.keys(loc).length) continue; const p = per[d.name] ||= {}; if (p[k]) continue; p[k] = { job: f, loc }; }
  }
  for (const [doc, p] of Object.entries(per)) {
    if (!p['system-light'] || !p.midnight) continue;
    const rows = [];
    for (const [n, v] of Object.entries(p['system-light'].loc)) {
      if (!v || !v.rgba) continue;
      const hx = x => x && x.rgba ? x.rgba.map((c, i) => i < 3 ? Math.round(c) : +(+c).toFixed(2)).join(',') : (x && x.raw);
      const a = hx(v), b = hx(p.midnight.loc[n]), c = p.forest ? hx(p.forest.loc[n]) : null;
      rows.push({ token: n, light: a, midnight: b, forest: c, same: a === b && (c == null || c === a), raw: v.raw });
    }
    out.docs[doc] = { jobs: Object.fromEntries(Object.entries(p).map(([k, x]) => [k, x.job])), colourTokens: rows.length, same: rows.filter(r => r.same), adapts: rows.filter(r => !r.same).map(r => r.token) };
    console.log(doc.padEnd(22), 'colour tokens', rows.length, 'same in light+dark', out.docs[doc].same.length, out.docs[doc].same.map(r => `${r.token}=${r.light}`).join(' ').slice(0, 900));
  }
}
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/DARK/local-tokens.json'), JSON.stringify(out, null, 1));
