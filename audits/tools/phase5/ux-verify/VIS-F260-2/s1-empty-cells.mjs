// Skeptic s1, VIS-F260-2: how visible are F260's "not yet" cells, in every palette, OT and NT paper, empty and typical plans?
// For the year grid, heatmap, book bar and meter: rendered background of an unread cell vs the page (and vs a filled
// olive cell), plus the cell's border/box-shadow (anything else that could outline it). Screenshots of the progress
// block on an iPhone in the empty plan (Hearth light, Midnight) and the typical plan at week 38 (Midnight).
//   node "audits/tools/phase5/ux-verify/VIS-F260-2/s1-empty-cells.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/VIS-F260-2/s1'); fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'empty', clock: 'demo', engine: 'webkit' });
async function open(theme, mode, variant) {
  await L.reset(variant);
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, mode });
  await d.ctx.route(u => u.href.startsWith(L.api + '/api/') && !u.href.startsWith(L.api + '/api/media/'), r => r.request().method() === 'GET' ? r.fallback() : r.abort());
  await d.page.goto(L.site + '/apps/f260.html', { waitUntil: 'load' });
  await d.page.waitForFunction(() => { const t = document.getElementById('todayTitle'); return t && t.textContent.trim().length > 0; }, null, { timeout: 15000 });
  await d.page.evaluate(t => hub.setTheme(t), theme); await sleep(900);
  return d;
}
const measure = d => d.page.evaluate(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgb = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const p = cx.getImageData(0, 0, 1, 1).data; return [p[0], p[1], p[2]]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2); };
  const page = rgb(getComputedStyle(document.body).backgroundColor);
  const olive = rgb(getComputedStyle(document.documentElement).getPropertyValue('--olive').trim());
  const one = (sel, filt) => { const e = [...document.querySelectorAll(sel)].find(filt || (() => true)); if (!e) return null; const s = getComputedStyle(e); const c = rgb(s.backgroundColor);
    const r = e.getBoundingClientRect(); return { size: Math.round(r.width) + 'x' + Math.round(r.height), vsPage: cr(c, page), border: s.borderTopWidth + ' ' + s.borderTopStyle, shadow: s.boxShadow, opacity: s.opacity }; };
  const cells = [...document.querySelectorAll('#ygrid button')];
  return {
    theme: document.documentElement.dataset.theme || '(hearth/system)', scheme: document.documentElement.dataset.scheme, nt: document.body.classList.contains('nt'),
    page, oliveVsPage: cr(olive, page),
    yearUnread: one('#ygrid button', e => !/done|part|cur/.test(e.className)),
    heatEmpty: one('#heat span', e => !e.className.trim()),
    heatFuture: one('#heat span.future', e => !/on|rest/.test(e.className)),
    meterTrack: one('.meter'),
    bookUnread: one('#jbar button', e => !e.classList.contains('cur')),
    yearCounts: { done: cells.filter(e => e.classList.contains('done')).length, part: cells.filter(e => e.classList.contains('part')).length, unread: cells.filter(e => !/done|part/.test(e.className)).length },
    labels: [...document.querySelectorAll('.ylbl, #hlbl, #jWhere, #jBooks')].map(e => e.textContent.trim()),
  };
});
try {
  for (const [theme, mode, variant] of [['hearth', 'light', 'empty'], ['parchment', 'light', 'empty'], ['frost', 'light', 'empty'], ['midnight', 'light', 'empty'], ['forest', 'light', 'empty'], ['hearth', 'dark', 'empty'], ['midnight', 'light', 'typical'], ['hearth', 'light', 'typical']]) {
    const d = await open(theme, mode, variant);
    const m = await measure(d);
    const key = theme + '-' + mode + 'OS-' + variant;
    out[key] = m;
    console.log(key.padEnd(28), m.scheme, 'nt=' + m.nt, 'grid', m.yearUnread && m.yearUnread.vsPage, 'heat', m.heatEmpty && m.heatEmpty.vsPage, 'meter', m.meterTrack && m.meterTrack.vsPage, 'book', m.bookUnread && m.bookUnread.vsPage, '| olive/page', m.oliveVsPage, '| cell', m.yearUnread && (m.yearUnread.size + ' border ' + m.yearUnread.border + ' shadow ' + m.yearUnread.shadow), JSON.stringify(m.yearCounts));
    if (['hearth-lightOS-empty', 'midnight-lightOS-empty', 'midnight-lightOS-typical', 'hearth-darkOS-empty'].includes(key)) {
      const box = await d.page.evaluate(() => { const a = document.querySelector('.meter').getBoundingClientRect(), b = document.getElementById('hlbl').getBoundingClientRect(); return { x: 0, y: Math.max(0, a.top + scrollY - 20), width: innerWidth, height: b.bottom - a.top + 40 }; });
      await d.page.screenshot({ path: path.join(OUT, `s1-progress-${key}-iphone.png`), clip: box, scale: 'css', animations: 'disabled' });
    }
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 's1-empty-cells.json'), JSON.stringify(out, null, 1));
console.log('saved', path.relative(ROOT, path.join(OUT, 's1-empty-cells.json')));
