// TELL / from-raw: the rig v2 raw dataset re-cut per area and per DOCUMENT, so an app's tells are the app frame's own
// (the committed tells.json mixes the shell page behind the viewer into every app area).
//   node audits/tools/phase4/TELL/from-raw.mjs        → audits/evidence/p4/TELL/from-raw.json
// Shell and TV: the page document. Apps: frame:<id> documents only. Every run (themes, states, devices), every job.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw');
const OUT = path.join(ROOT, 'audits/evidence/p4/TELL/from-raw.json');
const hex = c => c ? (c[3] === 0 ? 'transparent' : '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() + (c[3] < 1 ? '/' + c[3].toFixed(2) : '')) : '-';
const A = {};
let files = 0, stale = 0;
for (const run of ['themes', 'states', 'devices']) {
  const rd = path.join(RAW, run); if (!fs.existsSync(rd)) continue;
  for (const area of fs.readdirSync(rd)) {
    for (const f of fs.readdirSync(path.join(rd, area))) {
      if (!f.endsWith('.json')) continue;
      let j; try { j = JSON.parse(fs.readFileSync(path.join(rd, area, f), 'utf8')); } catch { continue; }
      if (j.v !== 2) { stale++; continue; }
      files++;
      const want = (area === 'shell' || area === 'tv') ? (d => d.name === 'page') : (d => d.name === 'frame:' + area);
      const docs = (j.docs || []).filter(want);
      const X = A[area] ||= { jobs: 0, docs: 0, interactive: 0, userSelect: {}, touchCallout: {}, tapHighlight: {}, touchAction: {}, selOff: {}, taOff: {}, overscroll: {}, rootBg: {}, bodyPos: {}, scrollers: {}, scrollbarCss: false, forms: {}, links: {}, screens: new Set() };
      X.jobs++;
      for (const d of docs) {
        const t = d.tells; if (!t) continue;
        X.docs++; X.interactive += t.interactive || 0; X.screens.add(j.screen);
        for (const [h, o] of [['userSelect', X.userSelect], ['touchCallout', X.touchCallout], ['tapHighlight', X.tapHighlight], ['touchAction', X.touchAction]]) for (const [k, v] of Object.entries(t.hist[h] || {})) o[k] = (o[k] || 0) + v;
        for (const o of t.offenders.userSelect || []) { const r = X.selOff[o.sel] ||= { sel: o.sel, v: o.v, n: 0, screens: new Set() }; r.n++; r.screens.add(j.screen); }
        const r = t.root;
        const os = x => x ? `${x.overscrollX}/${x.overscrollY}` : '-';
        const ok = `html=${os(r.html)} body=${os(r.body)}`; X.overscroll[ok] = (X.overscroll[ok] || 0) + 1;
        const tk = j.theme === 'system' || !j.theme ? 'system-' + j.mode : (j.theme === 'hearth' && j.mode === 'dark' ? 'hearth-dark' : j.theme);
        const bk = `${tk} html=${hex(r.html.c)}${r.html.img ? '+img' : ''} body=${r.body ? hex(r.body.c) + (r.body.img ? '+img' : '') : '-'}`; X.rootBg[bk] = (X.rootBg[bk] || 0) + 1;
        if (r.body) X.bodyPos[r.body.position] = (X.bodyPos[r.body.position] || 0) + 1;
        for (const s of t.scrollers || []) { const k = s.sel; const o = X.scrollers[k] ||= { sel: s.sel, overscroll: new Set(), vbarMax: 0, hbarMax: 0, x: false, y: false, scrollbarWidth: new Set(), n: 0, devices: new Set(), screens: new Set() }; o.n++; o.overscroll.add(`${s.overscrollX}/${s.overscrollY}`); o.vbarMax = Math.max(o.vbarMax, s.vbar); o.hbarMax = Math.max(o.hbarMax, s.hbar); o.x ||= s.x; o.y ||= s.y; o.scrollbarWidth.add(s.scrollbarWidth); o.devices.add(j.device); o.screens.add(j.screen); }
        if (t.scrollbarCss) X.scrollbarCss = true;
        for (const fm of t.forms || []) { if (!fm.visible) continue; const k = `${fm.sel}|${fm.type}|${fm.appearance}`; const o = X.forms[k] ||= { sel: fm.sel, type: fm.type, appearance: fm.appearance, native: fm.native, w: fm.w, h: fm.h, n: 0, screens: new Set() }; o.n++; o.screens.add(j.screen); }
        for (const l of t.links || []) { const k = `${l.sel}|${l.text}`; const o = X.links[k] ||= { sel: l.sel, text: l.text, colors: new Set(), underline: l.underline, blue: l.blue, tell: l.tell, n: 0, screens: new Set() }; o.n++; o.colors.add(hex(l.color)); o.screens.add(j.screen); o.tell ||= l.tell; o.blue ||= l.blue; }
      }
    }
  }
}
const ser = v => v instanceof Set ? [...v] : v;
const out = { note: 'Rig v2 raw re-cut by document: shell/tv = the page document; each app = its own frame:<id> document. userSelect = computed -webkit-user-select on interactive chrome (buttons, [role=button], tabs, tiles, cards); touchCallout / tapHighlight = DECLARED value (this WebKit build computes neither); scrollers vbar/hbar = classic scrollbar px in WebKit on Windows (0 = overlay). forms: native = appearance not none.', files, stale, areas: {} };
for (const [a, X] of Object.entries(A).sort()) {
  const us = X.userSelect; const usTotal = Object.values(us).reduce((s, v) => s + v, 0);
  out.areas[a] = {
    jobs: X.jobs, docs: X.docs, screens: X.screens.size, interactive: X.interactive,
    userSelect: us, userSelectTextShare: usTotal ? +((us.text || 0) / usTotal).toFixed(3) : null,
    touchCallout: X.touchCallout, tapHighlight: X.tapHighlight, touchAction: X.touchAction,
    selectableChrome: Object.values(X.selOff).sort((x, y) => y.n - x.n).slice(0, 30).map(o => ({ sel: o.sel, v: o.v, n: o.n, screens: o.screens.size })),
    overscroll: X.overscroll, bodyPosition: X.bodyPos,
    rootBg: X.rootBg,
    scrollers: Object.values(X.scrollers).sort((x, y) => y.n - x.n).map(o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ser(v)]))),
    scrollbarCss: X.scrollbarCss,
    nativeForms: Object.values(X.forms).filter(f => f.native).map(o => ({ ...o, screens: [...o.screens] })),
    styledForms: Object.values(X.forms).filter(f => !f.native).map(o => ({ ...o, screens: [...o.screens] })),
    links: Object.values(X.links).map(o => ({ ...o, colors: [...o.colors], screens: [...o.screens] })),
  };
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('files', files, 'stale', stale, '→', path.relative(ROOT, OUT));
for (const [a, v] of Object.entries(out.areas)) console.log(a.padEnd(15), 'docs', v.docs, 'interactive', v.interactive, 'userSelect', JSON.stringify(v.userSelect), 'nativeForms', v.nativeForms.length, 'links', v.links.length, 'scrollers', v.scrollers.length, 'overscroll', JSON.stringify(v.overscroll));
