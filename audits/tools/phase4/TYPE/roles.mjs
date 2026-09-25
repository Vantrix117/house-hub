// Phase 4 TYPE: per-area type inventory from the rig-v2 raw files (all runs).
// Usage: node audits/tools/phase4/TYPE/roles.mjs [--out DIR]
//   -> DIR/roles.json (default audits/evidence/p4/TYPE): per area × document (page|frame) × profile kind:
//      combos (family/size/weight/line-height/tracking/transform/numeric) with devices and example selectors,
//      per-selector sizes by device (does it scale for iPad/TV?), everything under 11 px, big numerals and large titles.
// Reads audits/evidence/p4/measure/raw/<run>/<area>/*.json (git-ignored, rig v2). Read-only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw');
const argOut = process.argv.indexOf('--out');
const OUT = argOut > 0 ? path.resolve(process.argv[argOut + 1]) : path.join(ROOT, 'audits/evidence/p4/TYPE');
const RUNS = ['themes', 'devices', 'states'];
const selKey = s => s.split(' > ').slice(-2).join(' > ').replace(/\.(on|open|morning|afternoon|evening|night|done|active|sel|cur|today)\b/g, '');
const NUM = /^[\s\d:.,\/%+−–\-★⭐×x]+$/;
const R = {};
let files = 0, v1 = 0;
for (const run of RUNS) {
  const rd = path.join(RAW, run);
  if (!fs.existsSync(rd)) continue;
  for (const area of fs.readdirSync(rd)) {
    const ad = path.join(rd, area);
    if (!fs.statSync(ad).isDirectory()) continue;
    for (const f of fs.readdirSync(ad)) {
      if (!f.endsWith('.json')) continue;
      let j; try { j = JSON.parse(fs.readFileSync(path.join(ad, f), 'utf8')); } catch { continue; }
      if (j.v !== 2) { v1++; continue; }
      files++;
      const A = R[area] ??= { jobs: 0, combos: {}, scale: {}, under11: {}, numerals: {}, titles: {}, famDeclared: {}, famByDoc: {} };
      A.jobs++;
      const kindOf = {}; for (const d of j.docs || []) kindOf[d.name] = d.meta?.kind || '?';
      const jobId = `${run}/${area}/${f.replace(/\.json$/, '')}`;
      for (const t of j.text || []) {
        const docClass = t.doc === 'page' ? 'page' : 'frame';
        // the area's own text: the shell and TV board live in the page; an app lives in its frame
        const own = (area === 'shell' || area === 'tv') ? docClass === 'page' : docClass === 'frame';
        if (!own) continue;
        const kind = kindOf[t.doc] || '?';
        const st = (t.stack != null && j.stacks) ? j.stacks[t.stack] : t.ff;
        A.famDeclared[st] = (A.famDeclared[st] || 0) + 1;
        const ck = [kind, t.ff, t.ffr, t.fs, t.fw, t.lh, t.ls, t.tt, t.fvn].join('|');
        const C = A.combos[ck] ??= { kind, ff: t.ff, ffr: t.ffr, fs: t.fs, fw: t.fw, lh: t.lh, ls: t.ls, tt: t.tt, fvn: t.fvn, n: 0, jobs: new Set(), devices: new Set(), sels: {}, texts: new Set() };
        C.n++; C.jobs.add(jobId); C.devices.add(j.device);
        const sk = selKey(t.sel); C.sels[sk] = (C.sels[sk] || 0) + 1;
        if (C.texts.size < 4 && t.text) C.texts.add(t.text.slice(0, 40));
        const S = A.scale[kind + '|' + sk] ??= {};
        (S[j.device] ??= new Set()).add(t.fs);
        if (t.fs < 11) {
          const U = A.under11[kind + '|' + sk + '|' + t.fs] ??= { kind, sel: sk, fullSel: t.sel, fs: t.fs, fw: t.fw, tt: t.tt, text: new Set(), n: 0, measured: 0, devices: new Set(), jobs: new Set() };
          U.n++; if (t.measured) U.measured++; U.devices.add(j.device); if (U.jobs.size < 3) U.jobs.add(jobId); if (U.text.size < 4) U.text.add((t.text || '').slice(0, 30));
        }
        if (t.fs >= 24 && t.text && NUM.test(t.text.trim()) && /\d/.test(t.text)) {
          const nk = kind + '|' + sk;
          const N = A.numerals[nk] ??= { kind, sel: sk, ff: t.ff, fs: new Set(), fw: t.fw, ls: new Set(), fvn: t.fvn, text: new Set(), jobs: new Set() };
          N.fs.add(t.fs); N.ls.add(t.ls); if (N.text.size < 3) N.text.add(t.text.trim().slice(0, 16)); if (N.jobs.size < 2) N.jobs.add(jobId);
        } else if (t.fs >= 24 && t.text && t.text.trim().length > 1) {
          const tk = kind + '|' + sk;
          const T = A.titles[tk] ??= { kind, sel: sk, ff: t.ff, fs: new Set(), fw: t.fw, ls: new Set(), lh: new Set(), text: new Set(), jobs: new Set() };
          T.fs.add(t.fs); T.ls.add(t.ls); T.lh.add(t.lh); if (T.text.size < 3) T.text.add(t.text.trim().slice(0, 30)); if (T.jobs.size < 2) T.jobs.add(jobId);
        }
      }
    }
  }
}
const arr = s => [...s];
const out = { note: 'From rig-v2 raw (runs themes, devices, states). Only the area\'s own document: the page for shell/tv, the app frame for apps. kind = the profile kind of that document (adult/kid/kiosk). ff = declared first family, ffr = the face this Windows WebKit resolved. ls in px. scale: per selector (last two path segments), the sizes seen on each device. numerals: text that is only digits/:/★ etc. at >= 24 px. titles: other text >= 24 px.', files, skippedV1: v1, areas: {} };
for (const [area, A] of Object.entries(R)) {
  const combos = Object.values(A.combos).map(c => ({ ...c, jobs: c.jobs.size, devices: arr(c.devices), sels: Object.entries(c.sels).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]), texts: arr(c.texts) }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || b.fs - a.fs || b.n - a.n);
  const scale = {};
  for (const [k, S] of Object.entries(A.scale)) {
    const devs = Object.keys(S); if (devs.length < 2) continue;
    const all = new Set(Object.values(S).flatMap(s => arr(s)));
    scale[k] = Object.fromEntries(Object.entries(S).map(([d, s]) => [d, arr(s).sort((a, b) => a - b)]));
    scale[k]._varies = all.size > 1;
  }
  out.areas[area] = {
    jobs: A.jobs,
    famDeclared: A.famDeclared,
    combos,
    under11: Object.values(A.under11).map(u => ({ ...u, text: arr(u.text), devices: arr(u.devices), jobs: arr(u.jobs) })).sort((a, b) => a.fs - b.fs),
    numerals: Object.values(A.numerals).map(n => ({ ...n, fs: arr(n.fs).sort((a, b) => a - b), ls: arr(n.ls), text: arr(n.text), jobs: arr(n.jobs) })),
    titles: Object.values(A.titles).map(n => ({ ...n, fs: arr(n.fs).sort((a, b) => a - b), ls: arr(n.ls), lh: arr(n.lh), text: arr(n.text), jobs: arr(n.jobs) })).sort((a, b) => b.fs[b.fs.length - 1] - a.fs[a.fs.length - 1]),
    scale,
  };
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'roles.json'), JSON.stringify(out));
console.log('files', files, 'skipped v1', v1, '->', path.join(OUT, 'roles.json'), (fs.statSync(path.join(OUT, 'roles.json')).size / 1024).toFixed(0) + ' KB');
for (const [a, v] of Object.entries(out.areas)) console.log(a.padEnd(15), 'jobs', v.jobs, 'combos', v.combos.length, 'under11', v.under11.length, 'numerals', v.numerals.length, 'titles', v.titles.length);
