#!/usr/bin/env node
// Phase 4 ACCENT — read the shared Phase 4 dataset (audits/evidence/p4/measure/raw/<run>/…, rig v2) and pull out every
// measured text whose ink or background resolves to a person-colour token (the rig records the matching tokens per
// text: text[].tok and text[].bg.tok), plus every svg icon and graphic whose paint equals that document's resolved
// --accent / --accent-deep. Covers every Phase 1 screen (themes run: all 7 theme keys on the primary device; devices
// and states runs: System light/dark), but only as the profile each screen script signs in (mostly Eli; kid screens as
// Ezra/Kiara; the TV as the kiosk) — runtime.mjs covers every profile on a subset of screens.
//
//   node audits/tools/phase4/ACCENT/dataset-scan.mjs  → audits/evidence/p4/ACCENT/dataset-accent.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw');
const OUT = path.join(ROOT, 'audits/evidence/p4/ACCENT/dataset-accent.json');
const ACC = new Set(['--accent', '--accent-deep', '--accent-strong', '--accent-soft', '--accent-tint', '--tint']);
const near = (a, b) => a && b && Math.abs(a[0] - b[0]) <= 2.6 && Math.abs(a[1] - b[1]) <= 2.6 && Math.abs(a[2] - b[2]) <= 2.6;

const agg = {};              // area → { texts, fails, byTok, sels: {sel: {n, fails, minP10, themes:Set, profiles:Set, fs}} }
const icons = {}, graphics = {};
let files = 0;
for (const run of fs.readdirSync(RAW).filter(d => !d.startsWith('_'))) {
  for (const area of fs.readdirSync(path.join(RAW, run))) {
    for (const f of fs.readdirSync(path.join(RAW, run, area))) {
      if (!f.endsWith('.json')) continue;
      let j; try { j = JSON.parse(fs.readFileSync(path.join(RAW, run, area, f), 'utf8')); } catch { continue; }
      if (j.v !== 2 || !j.ok) continue;
      files++;
      const A = agg[area] ||= { texts: 0, fails: 0, failsMed: 0, byRole: {}, sels: {} };
      const docTok = {};
      for (const d of j.docs || []) { const t = d.tokens && d.tokens.design; if (t) docTok[d.name || d.doc] = { accent: t['--accent'] && t['--accent'].rgba, deep: t['--accent-deep'] && t['--accent-deep'].rgba, profile: d.meta && d.meta.profile && d.meta.profile.id }; }
      for (const t of j.text || []) {
        if (!t.measured) continue;
        const fg = (t.tok || []).filter(x => ACC.has(x)), bg = ((t.bg && t.bg.tok) || []).filter(x => ACC.has(x));
        const bgImgAcc = t.bg && t.bg.img && docTok[t.doc] && docTok[t.doc].accent && /color\(srgb|rgb/.test(t.bg.img) && false;
        if (!fg.length && !bg.length && !bgImgAcc) continue;
        const role = fg.length ? `ink ${fg[0]}` + (bg.length ? ` on ${bg[0]}` : '') : `on ${bg[0]}`;
        A.texts++; A.byRole[role] = (A.byRole[role] || 0) + 1;
        const fail = !t.aa; if (fail) A.fails++; if (!t.aaMed) A.failsMed++;
        const key = `${t.doc} | ${t.sel} | ${role}`;
        const s = A.sels[key] ||= { n: 0, fails: 0, minP10: 99, minMed: 99, fs: t.fs, fw: t.fw, req: t.req, themes: {}, profiles: {}, example: null };
        s.n++; if (fail) s.fails++;
        s.minP10 = Math.min(s.minP10, t.p10); s.minMed = Math.min(s.minMed, t.med);
        const th = `${j.theme}-${j.mode}`; s.themes[th] = Math.min(s.themes[th] || 99, t.p10);
        s.profiles[j.profile] = 1;
        if (fail && (!s.example || t.p10 < s.example.p10)) s.example = { job: `${run}/${area}/${f}`, text: t.text.slice(0, 40), p10: t.p10, med: t.med };
      }
      for (const ic of (j.nontext && j.nontext.icons) || []) {
        if (ic.kind !== 'svg') continue;
        const dt = docTok[ic.doc]; if (!dt) continue;
        const tokn = near(ic.color, dt.accent) ? 'accent' : near(ic.color, dt.deep) ? 'accent-deep' : null;
        if (!tokn) continue;
        const I = icons[area] ||= {}; const key = `${ic.doc} | ${ic.sel} | ${tokn}`;
        const s = I[key] ||= { n: 0, fails: 0, min: 99, themes: {} };
        s.n++; if (!ic.pass) s.fails++; s.min = Math.min(s.min, ic.ratio); const th = `${j.theme}-${j.mode}`; s.themes[th] = Math.min(s.themes[th] || 99, ic.ratio);
      }
      for (const g of (j.nontext && j.nontext.graphics) || []) {
        const dt = docTok[g.doc]; if (!dt || !g.paint) continue;
        const tokn = near(g.paint, dt.accent) ? 'accent' : near(g.paint, dt.deep) ? 'accent-deep' : null;
        if (!tokn) continue;
        const G = graphics[area] ||= {}; const key = `${g.doc} | ${g.kind} | ${g.sel} | ${tokn}`;
        const s = G[key] ||= { n: 0, fails: 0, min: 99, themes: {} };
        s.n++; if (!g.pass) s.fails++; s.min = Math.min(s.min, g.ratio); const th = `${j.theme}-${j.mode}`; s.themes[th] = Math.min(s.themes[th] || 99, g.ratio);
      }
    }
  }
}
const summary = {};
for (const [a, A] of Object.entries(agg)) {
  const sels = Object.entries(A.sels).map(([k, s]) => ({ key: k, ...s, minP10: +s.minP10.toFixed(2), minMed: +s.minMed.toFixed(2), profiles: Object.keys(s.profiles) })).sort((x, y) => x.minP10 - y.minP10);
  summary[a] = { texts: A.texts, fails: A.fails, failsMed: A.failsMed, byRole: A.byRole, selectors: sels.length, failingSelectors: sels.filter(s => s.fails).length, sels };
}
const pack = o => Object.fromEntries(Object.entries(o).map(([a, I]) => [a, Object.entries(I).map(([k, s]) => ({ key: k, ...s, min: +s.min.toFixed(2) })).sort((x, y) => x.min - y.min)]));
fs.writeFileSync(OUT, JSON.stringify({ note: 'From the Phase 4 dataset raw v2 files. texts: measured text whose ink (text.tok) or declared background (text.bg.tok) resolved to --accent, --accent-deep, --accent-strong, --accent-soft, --accent-tint or --tint in that job (as the screen\'s own profile). fails = p10 below AA (the rig\'s aa flag); failsMed = median below AA. themes = the lowest p10 per theme-mode. icons/graphics: svg icons and graphics whose paint equals the document\'s resolved --accent (raw) or --accent-deep. Text on accent gradients (hero) is not tagged by the rig (bg.img) and is covered by runtime.mjs.', files, summary, icons: pack(icons), graphics: pack(graphics) }, null, 1));
console.log('files', files);
for (const [a, s] of Object.entries(summary)) console.log(a.padEnd(15), 'texts', s.texts, 'fails', s.fails, 'failsMed', s.failsMed, 'sels', s.selectors, 'failSels', s.failingSelectors, JSON.stringify(s.byRole));
for (const [a, I] of Object.entries(pack(icons))) console.log('icons', a, I.length, 'fail', I.filter(x => x.fails).length, I.filter(x => x.fails).slice(0, 4).map(x => x.key.split(' | ').slice(1).join(' ') + ' ' + x.min).join(' ; '));
for (const [a, I] of Object.entries(pack(graphics))) console.log('graphics', a, I.length, 'fail', I.filter(x => x.fails).length, I.filter(x => x.fails).slice(0, 4).map(x => x.key.split(' | ').slice(1).join(' ') + ' ' + x.min).join(' ; '));
