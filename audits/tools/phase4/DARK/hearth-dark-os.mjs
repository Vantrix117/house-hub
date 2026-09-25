// Phase 4 DARK: how P2-VIS-03 (Hearth chosen on a dark-OS device paints Midnight tokens with data-scheme "light")
// shows in each area. Compares the rig's themes run "hearth-dark" jobs with "system-dark" jobs of the same screen
// (same dark OS, same device): the only difference is data-scheme light vs dark over the same Midnight tokens.
//   node audits/tools/phase4/DARK/hearth-dark-os.mjs
// Writes audits/evidence/p4/DARK/hearth-dark-os.json. Read-only on raw/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw/themes');
const hex = c => c ? '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() : null;
const out = { note: 'hearth = themes run, Hearth on a dark OS; sysdark = System on a dark OS, same screen. worse = texts (doc|selector|text) failing AA under hearth while passing under sysdark; better = the reverse. tokens = resolved --bg/--surface/--text/--accent-deep and data-scheme in each document.', areas: {} };
for (const area of fs.readdirSync(RAW)) {
  const dir = path.join(RAW, area); if (!fs.statSync(dir).isDirectory()) continue;
  const H = new Map(), S = new Map(); const A = { screens: 0, hearthFail: 0, sysdarkFail: 0, measured: 0, worse: {}, better: {}, tokens: {}, schemes: {} };
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.*)-dark-(hearth|system)\.json$/); if (!m) continue;
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (j.v !== 2 || !j.ok) continue;
    const tgt = m[2] === 'hearth' ? H : S; if (m[2] === 'hearth') A.screens++;
    for (const d of j.docs) {
      const tk = d.tokens && d.tokens.design || {}; const pick = n => tk[n] && (tk[n].rgba ? hex(tk[n].rgba) : tk[n].raw);
      const key = `${m[2]}|${d.name}`; A.tokens[key] ||= { bg: pick('--bg'), surface: pick('--surface'), text: pick('--text'), accentDeep: pick('--accent-deep'), onAccent: pick('--on-accent'), theme: d.meta && d.meta.theme, scheme: d.meta && d.meta.scheme };
      A.schemes[key] = (A.schemes[key] || 0) + 1;
    }
    for (const t of j.text) {
      if (!t.measured || t.p10 == null) continue;
      const k = `${m[1]}|${t.doc}|${t.sel}|${t.text}`;
      (tgt.get(k) || tgt.set(k, []).get(k)).push(t);
    }
  }
  for (const [k, hs] of H) {
    const ss = S.get(k); if (!ss) continue;
    A.measured++;
    const hf = hs.some(t => !t.aa), sf = ss.some(t => !t.aa);
    if (hf) A.hearthFail++; if (sf) A.sysdarkFail++;
    const put = (bucket, t, o) => { const g = bucket[`${t.doc}|${t.sel}`] ||= { doc: t.doc, sel: t.sel, color: hex(t.color), otherColor: hex(o.color), minP10: 99, otherMinP10: 99, n: 0, texts: [] }; g.n++; g.minP10 = Math.min(g.minP10, ...(bucket === A.worse ? hs : ss).map(x => x.p10)); g.otherMinP10 = Math.min(g.otherMinP10, ...(bucket === A.worse ? ss : hs).map(x => x.p10)); if (g.texts.length < 3) g.texts.push(t.text); };
    if (hf && !sf) put(A.worse, hs.find(t => !t.aa), ss[0]);
    if (sf && !hf) put(A.better, ss.find(t => !t.aa), hs[0]);
  }
  A.worse = Object.values(A.worse).sort((a, b) => b.n - a.n); A.better = Object.values(A.better).sort((a, b) => b.n - a.n);
  out.areas[area] = A;
  console.log(area.padEnd(15), 'screens', A.screens, 'texts', A.measured, 'fail hearth', A.hearthFail, 'sysdark', A.sysdarkFail, 'worse', A.worse.length, 'better', A.better.length);
  for (const g of A.worse.slice(0, 6)) console.log('   worse', g.doc, g.sel.split('>').slice(-2).join('>').trim().slice(0, 55), g.color, 'p10', g.minP10, 'vs', g.otherMinP10, 'n', g.n, '«' + g.texts[0].slice(0, 20) + '»');
  for (const g of A.better.slice(0, 3)) console.log('   better', g.doc, g.sel.split('>').slice(-2).join('>').trim().slice(0, 55), 'p10', g.otherMinP10, 'vs', g.minP10, 'n', g.n);
}
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/DARK/hearth-dark-os.json'), JSON.stringify(out, null, 1));
