// Phase 4 GLASS — text that sits on glass (text[].glass = the text or an ancestor has a backdrop-filter or a recipe
// class, page-lib.mjs glassy()) and whether it passes AA, per area and theme, from the v2 raw files (read-only).
// WebKit paints no blur, so these are contrasts against the UNBLURRED translucent fill with sharp content behind it;
// perf-free cross-check in Chromium (real blur): glass-text-blur.mjs.
//   node audits/tools/phase4/GLASS/glass-text.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const RAW = path.join(ROOT, 'audits/evidence/p4/measure/raw');
const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS/glass-text.json');
const A = {};
for (const run of ['themes', 'devices', 'states']) for (const area of fs.readdirSync(path.join(RAW, run))) for (const f of fs.readdirSync(path.join(RAW, run, area))) {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, run, area, f), 'utf8')); if (j.v !== 2) continue;
  const a = A[area] ||= { measured: 0, onGlass: 0, onGlassFail: 0, onGlassFailMed: 0, byTheme: {}, groups: {} };
  const theme = j.theme === 'system' ? 'system-' + j.mode : j.theme === 'hearth' ? 'hearth-dark' : j.theme;
  for (const t of j.text || []) {
    if (!t.measured) continue; a.measured++;
    if (!t.glass) continue; a.onGlass++;
    const th = a.byTheme[theme] ||= { onGlass: 0, fail: 0 }; th.onGlass++;
    if (t.aa) continue;
    a.onGlassFail++; th.fail++; if (!t.aaMed) a.onGlassFailMed++;
    const surf = t.bg && t.bg.sel || '?';
    const k = [t.doc, t.sel, surf].join(' | ');
    const g = a.groups[k] ||= { doc: t.doc, sel: t.sel, surface: surf, text: t.text, fs: t.fs, fw: t.fw, tok: t.tok, n: 0, medFails: 0, minP10: 99, minMed: 99, themes: new Set(), worstJob: null };
    g.n++; if (!t.aaMed) g.medFails++; g.themes.add(theme);
    if (t.p10 < g.minP10) { g.minP10 = t.p10; g.worstJob = `${run}/${area}/${f.replace(/\.json$/, '')}`; }
    if (t.med < g.minMed) g.minMed = t.med;
  }
}
const out = { note: 'Measured text on glass (the text or an ancestor has a computed backdrop-filter or a shared recipe class). fail = p10 below AA; medFails = even the median sample fails. Rendered in WebKit without blur: sharp content shows through translucent glass, so p10 over live-blur glass is pessimistic, and over look-only glass (no blur) it is what the device shows too.', areas: {} };
for (const [area, a] of Object.entries(A)) {
  const groups = Object.values(a.groups).map(g => ({ ...g, themes: [...g.themes] })).sort((x, y) => (y.medFails > 0) - (x.medFails > 0) || x.minMed - y.minMed || y.n - x.n);
  out.areas[area] = { measured: a.measured, onGlass: a.onGlass, onGlassShare: +(a.onGlass / Math.max(1, a.measured)).toFixed(3), onGlassFail: a.onGlassFail, onGlassFailMed: a.onGlassFailMed, byTheme: a.byTheme, groups: groups.slice(0, 25), groupCount: groups.length };
  console.log(area.padEnd(15), 'measured', a.measured, 'onGlass', a.onGlass, 'fail', a.onGlassFail, 'medFail', a.onGlassFailMed, 'groups', groups.length);
  for (const g of groups.slice(0, 6)) console.log('    ', g.doc, g.sel.slice(0, 50), '|', g.surface.slice(0, 40), '|', JSON.stringify(g.text).slice(0, 30), g.fs + '/' + g.fw, 'n', g.n, 'medF', g.medFails, 'p10', g.minP10, 'med', g.minMed, g.themes.join(','));
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
