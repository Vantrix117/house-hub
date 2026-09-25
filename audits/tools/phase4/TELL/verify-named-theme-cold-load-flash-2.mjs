// Skeptic #2 for the TELL finding "named-theme-cold-load-flash". Independent of flash.mjs and verify-...-1.mjs.
//   node audits/tools/phase4/TELL/verify-named-theme-cold-load-flash-2.mjs chromium|webkit [order|sw] [area…]
// ORDER test: light OS, Midnight stored (localStorage 'hub.theme' + the person row). An init script in every document records,
//   with performance.now(): each requestAnimationFrame tick (a rendering opportunity) and the computed <body> background at it,
//   the first moment <html data-scheme> is set (hub.js applyTheme, apps/hub.js:75-83,111), and the Paint Timing entries.
//   hub.js for the target document is delayed by 0 / 50 / 150 / 400 ms. Result per delay: framesBeforeTheme = rAF ticks with a
//   body before data-scheme was set; firstBg = the body background at the first such tick; fcpBeforeTheme = FCP < schemeAt.
// SW test (Chromium): the realistic path. Service workers allowed; first load installs sw.js; then a reload served by the SW
//   (hub.js cache-first, sw.js:45-48) with no artificial delay: same metrics, three runs.
// Evidence: audits/evidence/p4/TELL/verify-named-theme-cold-load-flash-2-<engine>.json (+ -<engine>-shell-d150.png).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const engine = process.argv[2] === 'webkit' ? 'webkit' : 'chromium';
const test = process.argv[3] || 'order';
const ALL = ['shell', 'tv', 'f260', 'leftovers', 'prayer', 'tally', 'timer', 'kidverse', 'verses'];
const want = process.argv.slice(4).length ? process.argv.slice(4) : ALL;
const OUT = path.join(EV, `verify-named-theme-cold-load-flash-2-${engine}.json`);
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { engine };
out.order ||= {}; out.sw ||= {};
const prof = a => a === 'tv' ? 'tv' : a === 'kidverse' ? 'ezra' : 'eli';
const PROBE = () => {
  const P = window.__p2 = { ticks: [], schemeAt: null, themeAtSet: null, paints: [] };
  const mo = new MutationObserver(() => { const h = document.documentElement; if (P.schemeAt === null && h && h.dataset.scheme) { P.schemeAt = +performance.now().toFixed(1); P.themeAtSet = h.dataset.theme || '(none)'; } });
  mo.observe(document, { attributes: true, subtree: true, attributeFilter: ['data-scheme'] });
  const tick = () => { const b = document.body; if (b && P.ticks.length < 400) P.ticks.push([+performance.now().toFixed(1), getComputedStyle(b).backgroundColor, !!document.documentElement.dataset.scheme]); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.paints.push([e.name, +e.startTime.toFixed(1)]); }).observe({ type: 'paint', buffered: true }); } catch {}
};
const L = await local({ variant: 'typical', engine });
async function run(area, { delay = 0, sw = false } = {}) {
  await L.apiAs(prof(area) === 'tv' ? 'eli' : prof(area), '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'midnight' } });
  const d = await L.device({ device: area === 'tv' ? 'tv' : 'ipad-portrait', mode: 'light', profile: prof(area), sw, localStorage: { 'hub.theme': JSON.stringify('midnight') } });
  await d.ctx.addInitScript(PROBE);
  const shellArea = area === 'shell' || area === 'tv';
  if (sw) { await d.goto('#home'); await d.page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {}); await sleep(1500); }
  if (!shellArea) { await d.goto('#home'); await d.page.waitForFunction(() => window.hub && document.querySelector('#shell:not([hidden])'), null, { timeout: 15000 }).catch(() => {}); await sleep(1000); }
  if (delay) await d.ctx.route(/\/apps\/hub\.js(\?.*)?$/, async r => { const fr = r.request().frame(); const target = shellArea ? fr === d.page.mainFrame() : fr !== d.page.mainFrame(); if (target) await sleep(delay); await r.continue(); });
  let shot = null;
  if (shellArea) await d.page.goto(L.site + '/index.html#home', { waitUntil: 'commit' });
  else await d.page.evaluate(id => { location.hash = '#' + id; }, area);
  if (area === 'shell' && delay === 150 && !sw) { await sleep(90); shot = await d.page.screenshot({ scale: 'css' }).catch(() => null); }
  await sleep(2500);
  const doc = shellArea ? d.page.mainFrame() : d.page.frames().find(x => x.url().includes(`/apps/${area}.html`));
  const P = doc ? await doc.evaluate(() => window.__p2).catch(e => ({ err: String(e.message).split('\n')[0] })) : { err: 'no frame' };
  const ctl = sw ? await d.page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)) : null;
  await d.close();
  if (!P || P.err) return { delay, err: P && P.err };
  const before = P.ticks.filter(t => P.schemeAt === null || t[0] < P.schemeAt);
  const after = P.ticks.filter(t => P.schemeAt !== null && t[0] >= P.schemeAt);
  const fcp = (P.paints.find(p => p[0] === 'first-contentful-paint') || [])[1] ?? null;
  const fp = (P.paints.find(p => p[0] === 'first-paint') || [])[1] ?? null;
  return { delay, sw: sw ? { controlled: ctl } : undefined, schemeAt: P.schemeAt, themeAtSet: P.themeAtSet, firstPaint: fp, fcp, fcpBeforeTheme: fcp !== null && P.schemeAt !== null ? fcp < P.schemeAt : null,
    framesBeforeTheme: before.length, wrongWindowMs: before.length ? +(Math.min(P.schemeAt ?? before[before.length - 1][0], P.schemeAt ?? 1e9) - before[0][0]).toFixed(1) : 0,
    firstBg: before.length ? before[0][1] : null, settledBg: after.length ? after[after.length - 1][1] : null, shot };
}
try {
  for (const area of want) {
    if (test === 'order') {
      const R = out.order[area] = {};
      for (const delay of [0, 50, 150, 400]) {
        const r = await run(area, { delay });
        if (r.shot) { const f = path.join(EV, `verify-named-theme-cold-load-flash-2-${engine}-shell-d150.png`); fs.writeFileSync(f, r.shot); r.shot = path.relative(ROOT, f).replace(/\\/g, '/'); } else delete r.shot;
        R['d' + delay] = r; console.log(engine, area, 'd' + delay, JSON.stringify(r));
      }
    } else if (test === 'sw' && engine === 'chromium') {
      const R = out.sw[area] = [];
      for (let i = 0; i < 3; i++) { const r = await run(area, { sw: true }); delete r.shot; R.push(r); console.log(engine, 'sw', area, i, JSON.stringify(r)); }
    }
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  }
  for (const p of ['eli', 'ezra']) await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'system' } }).catch(() => {});
} finally { await L.close(); }
console.log('wrote', path.relative(ROOT, OUT));
