// Skeptic s1, VIS-F260-1: independent contrast check by a different method from the Phase 3 sweep.
// Instead of screenshot sampling, resolve each target's computed text colour, multiply the opacity of every ancestor,
// composite it over the nearest opaque background (both through a canvas), and compute the WCAG ratio.
// Run in each palette at iPhone 430 px (typical household, plan at week 38 = NT tint on), then again with the NT tint
// removed (what an Old Testament week, 1-30, paints).
//   node "audits/tools/phase5/ux-verify/VIS-F260-1/s1-contrast.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/VIS-F260-1/s1'); fs.mkdirSync(OUT, { recursive: true });
const TARGETS = {
  pastWeekSpan: '.week.complete:not(.current) .wk-head .span',
  pastWeekNum: '.week.complete:not(.current) .wk-head .num',
  futureWeekSpan: '.week:not(.complete):not(.current) .wk-head .span',
  chCount: '#chCount',
  memVerseLink: '.mem .refs a',
  thisWeekKicker: '.reflect .rf-top .k',
  mvLabel: '.mem .lbl',
  todayKicker: '#todayKind',
  subCaption: 'header .sub',
  unearnedMileName: '.mile:not(.on) .mn',
  journalTab: '#tabJournal',
  todayTitle: '#todayTitle',
  doneBtn: '#todayDone',
};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  for (const [theme, mode] of [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'light'], ['forest', 'light']]) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, mode });
    await d.ctx.route(u => u.href.startsWith(L.api + '/api/') && !u.href.startsWith(L.api + '/api/media/'), r => r.request().method() === 'GET' ? r.fallback() : r.abort());
    await d.page.goto(L.site + '/apps/f260.html', { waitUntil: 'load' });
    await d.page.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 });
    await d.page.evaluate(t => hub.setTheme(t), theme); await sleep(800);
    const measure = () => d.page.evaluate(T => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
      const rgba = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const p = cx.getImageData(0, 0, 1, 1).data; return [p[0], p[1], p[2], p[3] / 255]; };
      const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
      const cr = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2); };
      const mix = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t));
      const res = {};
      for (const [k, sel] of Object.entries(T)) {
        const e = [...document.querySelectorAll(sel)].find(x => x.getClientRects().length); if (!e) { res[k] = null; continue; }
        // nearest ancestor-or-self with a painted background
        let bgEl = e, bg = null; while (bgEl) { const c = rgba(getComputedStyle(bgEl).backgroundColor); if (getComputedStyle(bgEl).backgroundColor !== 'rgba(0, 0, 0, 0)' && c[3] > 0) { bg = c; break; } bgEl = bgEl.parentElement; }
        let under = rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3);
        if (bg) under = mix(bg.slice(0, 3), under, bg[3]);
        // opacity of the element and ancestors up to (not including) the background owner
        let op = 1; for (let p = e; p && p !== bgEl; p = p.parentElement) op *= +getComputedStyle(p).opacity;
        const s = getComputedStyle(e); const fg = rgba(s.color);
        const seen = mix(fg.slice(0, 3), under, fg[3] * op);
        const fs = parseFloat(s.fontSize), fw = +s.fontWeight; const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
        const ratio = cr(seen, under);
        res[k] = { text: e.textContent.trim().slice(0, 30), fs, fw, opacity: +op.toFixed(2), color: s.color, bg: under.map(Math.round), ratio, need: large ? 3 : 4.5, pass: ratio >= (large ? 3 : 4.5) };
      }
      return { theme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme, nt: document.body.classList.contains('nt'), res };
    }, TARGETS);
    const nt = await measure();
    await d.page.evaluate(() => document.body.classList.remove('nt')); await sleep(700);
    const ot = await measure();
    out[theme] = { ntWeek38: nt, otTintOff: ot };
    console.log('==', theme, nt.scheme);
    for (const k of Object.keys(TARGETS)) { const a = nt.res[k], b = ot.res[k]; console.log('  ', k.padEnd(18), a ? (a.ratio + (a.pass ? ' ok ' : ' FAIL') + ' (need ' + a.need + ', ' + a.fs + 'px/' + a.fw + ', op ' + a.opacity + ')') : '-', '| OT', b ? b.ratio + (b.pass ? ' ok' : ' FAIL') : '-'); }
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 's1-contrast.json'), JSON.stringify(out, null, 1));
console.log('saved', path.relative(ROOT, path.join(OUT, 's1-contrast.json')));
