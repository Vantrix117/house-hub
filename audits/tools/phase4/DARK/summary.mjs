// Phase 4 DARK: dark-mode completeness summary from the rig's themes run (iPad portrait, typical state).
// Reads audits/evidence/p4/measure/raw/themes/<area>/*.json (rig v2) read-only and writes
// audits/evidence/p4/DARK/summary.json.
//   node audits/tools/phase4/DARK/summary.mjs
// Per area x theme key: text measured/failing (app frame vs shell page), graphics and control-boundary failures,
// "dark-only" text failures (fail in a dark theme, pass in System light for the same screen/doc/selector/text),
// "light islands" (text on a rendered background with relative luminance > 0.40 while the scheme is dark), and
// "non-adapting" elements (the same computed colour in System light and in Midnight for the same element).
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw/themes');
const OUT = path.join(ROOT, 'audits/evidence/p4/DARK/summary.json');
const DARK = ['system-dark', 'hearth-dark', 'midnight', 'forest'];
const KEYS = ['system-light', 'system-dark', 'hearth-dark', 'parchment', 'frost', 'midnight', 'forest'];

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = rgb => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const hex = rgb => rgb ? '#' + rgb.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() + (rgb[3] != null && rgb[3] < 1 ? '/' + (+rgb[3]).toFixed(2) : '') : null;
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

function key(mode, theme) { return theme === 'system' ? 'system-' + mode : theme === 'hearth' ? 'hearth-' + mode : theme; }

const areas = fs.readdirSync(RAW).filter(a => fs.statSync(path.join(RAW, a)).isDirectory());
const out = { note: 'See header of audits/tools/phase4/DARK/summary.mjs. Themes run only (typical state, iPad portrait or the screen\'s first device). app = the app iframe document(s); page = the shell page. darkOnly = (doc, selector, text) failing AA in that theme while every occurrence passes in system-light on the same screen. lightIslands = texts whose rendered background median has relative luminance > 0.40 in a dark theme. nonAdapting = the same element with an identical computed colour in system-light and midnight.', areas: {} };

for (const area of areas) {
  const files = fs.readdirSync(path.join(RAW, area)).filter(f => f.endsWith('.json'));
  const A = { themes: {}, darkOnly: {}, lightIslands: {}, nonAdaptText: {}, nonAdaptGraphic: {}, nonAdaptControl: {}, schemeCheck: {} };
  const byEl = new Map();     // elKey -> {theme -> rec}
  const gByEl = new Map(), cByEl = new Map();
  for (const f of files) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(RAW, area, f), 'utf8')); } catch { continue; }
    if (j.v !== 2 || !j.ok) continue;
    const k = key(j.mode, j.theme); if (!KEYS.includes(k)) continue;
    const screen = `${j.screen}-${j.state}-${j.device}`;
    const T = A.themes[k] ||= { jobs: 0, app: { measured: 0, fail: 0 }, page: { measured: 0, fail: 0 }, graphics: 0, graphicFail: 0, controlsNeed: 0, controlFail: 0, icons: 0, iconFail: 0 };
    T.jobs++;
    // scheme check
    const sc = A.schemeCheck[k] ||= {};
    for (const d of j.docs) { const s = `${d.name}:${d.meta && d.meta.theme}/${d.meta && d.meta.scheme}`; sc[s] = (sc[s] || 0) + 1; }
    for (const t of j.text) {
      if (!t.measured || t.p10 == null) continue;
      const side = t.doc === 'page' ? 'page' : 'app';
      T[side].measured++; if (!t.aa) T[side].fail++;
      const ek = `${screen}|${t.doc}|${t.sel}|${t.text}`;
      let m = byEl.get(ek); if (!m) byEl.set(ek, m = {});
      (m[k] ||= []).push({ color: t.color, bgMed: t.bgMed, p10: t.p10, med: t.med, aa: t.aa, fs: t.fs, doc: t.doc, sel: t.sel, text: t.text, job: `themes/${area}/${f.replace(/\.json$/, '')}`, tok: t.tok, bgImg: !!(t.bg && t.bg.img), bgSel: t.bg && t.bg.sel });
    }
    for (const g of (j.nontext.graphics || [])) {
      T.graphics++; if (!g.pass) T.graphicFail++;
      const ek = `${screen}|${g.doc}|${g.sel}|${g.kind}`;
      let m = gByEl.get(ek); if (!m) gByEl.set(ek, m = {});
      (m[k] ||= []).push({ paint: g.paint, ratio: g.ratio, pass: g.pass, sel: g.sel, doc: g.doc, kind: g.kind });
    }
    for (const c of (j.nontext.controls || [])) {
      const ek = `${screen}|${c.doc}|${c.sel}`;
      let m = cByEl.get(ek); if (!m) cByEl.set(ek, m = {});
      (m[k] ||= []).push({ fill: c.fill, boundary: c.boundary, kind: c.kind, sel: c.sel, doc: c.doc, hasText: c.hasText, outer: c.outerMed });
    }
    for (const i of (j.nontext.icons || [])) { if (i.kind && i.kind !== 'svg') continue; T.icons++; if (!i.pass) T.iconFail++; }
  }
  // dark-only failures and light islands
  for (const [ek, m] of byEl) {
    const lightRecs = m['system-light'];
    for (const k of DARK) {
      const recs = m[k]; if (!recs) continue;
      for (const r of recs) {
        if (!r.aa && lightRecs && lightRecs.every(x => x.aa)) {
          const gk = `${r.doc}|${r.sel}|${hex(r.color)}`;
          const g = (A.darkOnly[k] ||= {})[gk] ||= { doc: r.doc, sel: r.sel, color: hex(r.color), tok: r.tok, n: 0, minP10: 99, lightMinP10: 99, texts: new Set(), bg: hex(r.bgMed), jobs: new Set() };
          g.n++; g.minP10 = Math.min(g.minP10, r.p10); g.lightMinP10 = Math.min(g.lightMinP10, ...lightRecs.map(x => x.p10)); g.texts.add(r.text); g.jobs.add(r.job);
        }
        if (r.bgMed && L(r.bgMed) > 0.40) {
          const gk = `${r.doc}|${r.sel}`;
          const g = (A.lightIslands[k] ||= {})[gk] ||= { doc: r.doc, sel: r.sel, color: hex(r.color), bg: hex(r.bgMed), bgL: +L(r.bgMed).toFixed(3), bgSel: r.bgSel, bgImg: r.bgImg, n: 0, texts: new Set(), jobs: new Set() };
          g.n++; g.texts.add(r.text); g.jobs.add(r.job);
        }
      }
    }
    // non-adapting text colour: same colour in system-light and midnight
    const a = m['system-light'], b = m['midnight'];
    if (a && b) {
      const ca = hex(a[0].color), cb = hex(b[0].color), ba = hex(a[0].bgMed), bb = hex(b[0].bgMed);
      if (ca === cb) {
        const gk = `${a[0].doc}|${a[0].sel}|${ca}`;
        const g = A.nonAdaptText[gk] ||= { doc: a[0].doc, sel: a[0].sel, color: ca, tok: b[0].tok, bgLight: ba, bgMidnight: bb, p10Light: a[0].p10, p10Midnight: b[0].p10, n: 0, texts: new Set(), job: b[0].job };
        g.n++; g.texts.add(a[0].text);
      }
    }
  }
  for (const [ek, m] of gByEl) {
    const a = m['system-light'], b = m['midnight']; if (!a || !b) continue;
    if (hex(a[0].paint) === hex(b[0].paint)) {
      const gk = `${a[0].doc}|${a[0].sel}|${hex(a[0].paint)}`;
      const g = A.nonAdaptGraphic[gk] ||= { doc: a[0].doc, sel: a[0].sel, kind: a[0].kind, paint: hex(a[0].paint), ratioLight: a[0].ratio, ratioMidnight: b[0].ratio, n: 0 };
      g.n++;
    }
  }
  for (const [ek, m] of cByEl) {
    const a = m['system-light'], b = m['midnight']; if (!a || !b || !a[0].fill || !b[0].fill) continue;
    if (a[0].fill[3] === 0) continue;
    if (hex(a[0].fill) === hex(b[0].fill)) {
      const gk = `${a[0].doc}|${a[0].sel}|${hex(a[0].fill)}`;
      const g = A.nonAdaptControl[gk] ||= { doc: a[0].doc, sel: a[0].sel, kind: a[0].kind, fill: hex(a[0].fill), fillL: +L(a[0].fill).toFixed(3), outerMidnight: hex(b[0].outer), boundaryMidnight: b[0].boundary, n: 0 };
      g.n++;
    }
  }
  const fin = o => Object.values(o).map(g => ({ ...g, texts: g.texts ? [...g.texts].slice(0, 4) : undefined, jobs: g.jobs ? [...g.jobs].slice(0, 3) : undefined })).sort((x, y) => (y.n - x.n));
  for (const k of Object.keys(A.darkOnly)) A.darkOnly[k] = fin(A.darkOnly[k]).sort((x, y) => x.minP10 - y.minP10);
  for (const k of Object.keys(A.lightIslands)) A.lightIslands[k] = fin(A.lightIslands[k]);
  A.nonAdaptText = fin(A.nonAdaptText); A.nonAdaptGraphic = fin(A.nonAdaptGraphic); A.nonAdaptControl = fin(A.nonAdaptControl);
  for (const k of Object.keys(A.themes)) { const T = A.themes[k]; for (const s of ['app', 'page']) T[s].failShare = T[s].measured ? +(T[s].fail / T[s].measured).toFixed(3) : null; T.graphicFailShare = T.graphics ? +(T.graphicFail / T.graphics).toFixed(3) : null; }
  out.areas[area] = A;
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
// console table
const rows = [];
for (const [a, A] of Object.entries(out.areas)) for (const k of KEYS) { const T = A.themes[k]; if (!T) continue; const side = (a === 'shell' || a === 'tv') ? 'page' : 'app';
  rows.push([a, k, T.jobs, `${T[side].fail}/${T[side].measured}`, T[side].failShare, `${T.graphicFail}/${T.graphics}`, DARK.includes(k) ? (A.darkOnly[k] || []).length : '', DARK.includes(k) ? (A.lightIslands[k] || []).length : ''].join('\t')); }
console.log('area\ttheme\tjobs\ttextFail/measured\tshare\tgraphicFail\tdarkOnlyGroups\tlightIslandGroups'); console.log(rows.join('\n'));
for (const [a, A] of Object.entries(out.areas)) console.log(a, 'nonAdaptText', A.nonAdaptText.length, 'nonAdaptGraphic', A.nonAdaptGraphic.length, 'nonAdaptControl', A.nonAdaptControl.length);
