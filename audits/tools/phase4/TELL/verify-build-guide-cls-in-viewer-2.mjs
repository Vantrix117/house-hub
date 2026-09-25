// Skeptic #2 for TELL "build-guide-cls-in-viewer": does opening the build guide (apps/dollywood.html) shift its layout,
// in the viewer vs standalone, and is the parent viewer visible when it happens?
//   node audits/tools/phase4/TELL/verify-build-guide-cls-in-viewer-2.mjs [engine=chromium|webkit] [runs=3] [arm…]
//   → audits/evidence/p4/TELL/verify-build-guide-cls-in-viewer-2-<engine>.json (+ one PNG early in the cold viewer open)
// Arms: viewer-cold-held (index.html#dollywood, /api/data held 2500 ms, other API 150 ms; the finding's arm),
//       viewer-cold-fast (same, no added latency), viewer-tap (warm shell on #apps, tap the tile, held arm),
//       standalone-held (apps/dollywood.html directly, held arm).
// In the app document every animation frame that changes records chips height/count, workspace top, header height;
// Layout Instability entries (Chromium only). In the parent every changed frame records #viewer on/opacity, on absolute
// time (performance.timeOrigin + now) so the two timelines line up.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const engine = process.argv[2] || 'chromium'; const RUNS = +(process.argv[3] || 3);
const ARMS = process.argv.slice(4).length ? process.argv.slice(4) : ['viewer-cold-held', 'viewer-cold-fast', 'viewer-tap', 'standalone-held'];
const INIT = () => {
  const w = window; const abs = () => Math.round(performance.timeOrigin + performance.now());
  const isApp = /\/apps\/dollywood\.html/.test(location.pathname);
  w.__v = { entries: [], fr: [] };
  if (isApp) {
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) w.__v.entries.push({ t: Math.round(e.startTime), abs: Math.round(performance.timeOrigin + e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput, src: (e.sources || []).slice(0, 4).map(s => { const n = s.node; const d = n && n.nodeType === 1 ? n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList && n.classList.length ? '.' + [...n.classList].slice(0, 2).join('.') : '') : '?'; return `${d} y${Math.round(s.previousRect.y)}>${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}>${Math.round(s.currentRect.height)}`; }) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { w.__v.lsErr = String(e); }
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) w.__v[e.name] = Math.round(e.startTime); }).observe({ type: 'paint', buffered: true }); } catch (e) {}
    let last = '';
    const tick = () => {
      const c = document.getElementById('chips'), ws = document.querySelector('.workspace'), h = document.querySelector('header');
      const s = { chipsH: c ? c.offsetHeight : null, chipsN: c ? c.children.length : null, wsTop: ws ? Math.round(ws.getBoundingClientRect().top) : null, headerH: h ? Math.round(h.getBoundingClientRect().height) : null, hub: !!w.hub };
      const k = JSON.stringify(s); if (k !== last) { last = k; w.__v.fr.push({ t: Math.round(performance.now()), abs: abs(), ...s }); }
      if (performance.now() < 8000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } else if (window === window.top) {
    let last = '';
    const tick = () => {
      const v = document.getElementById('viewer');
      const s = v ? { on: v.classList.contains('on'), op: +(+getComputedStyle(v).opacity).toFixed(2) } : { none: 1 };
      const k = JSON.stringify(s); if (k !== last) { last = k; w.__v.fr.push({ abs: abs(), ...s }); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
};
const L = await local({ variant: 'typical', engine });
const OUT = path.join(EV, `verify-build-guide-cls-in-viewer-2-${engine}.json`);
const out = { engine, note: 'See the header of audits/tools/phase4/TELL/verify-build-guide-cls-in-viewer-2.mjs', runs: {} };
const route = (d, held) => d.ctx.route(L.api + '/api/**', async r => { const u = r.request().url(); const hold = held && r.request().method() === 'GET' && /\/api\/data\//.test(u); if (held) await sleep(hold ? 2500 : 150); r.continue().catch(() => {}); });
async function appFrame(d) { const until = Date.now() + 12000; while (Date.now() < until) { const f = d.page.frames().find(f => f.url().includes('/apps/dollywood.html')); if (f) return f; await sleep(20); } return null; }
try {
  for (const arm of ARMS) {
    out.runs[arm] = [];
    for (let i = 0; i < RUNS; i++) {
      const R = {};
      const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
      try {
        await route(d, arm !== 'viewer-cold-fast');
        await d.ctx.addInitScript(INIT);
        let f;
        if (arm === 'standalone-held') { await d.page.goto(L.site + '/apps/dollywood.html', { waitUntil: 'commit' }); f = d.page.mainFrame(); }
        else if (arm === 'viewer-tap') {
          await d.page.goto(L.site + '/index.html#apps', { waitUntil: 'load' });
          await d.page.waitForSelector('#grid .tile[data-id="dollywood"]', { timeout: 15000 });
          await sleep(3500);
          await d.page.click('#grid .tile[data-id="dollywood"]');
          f = await appFrame(d);
        } else { await d.page.goto(L.site + '/index.html#dollywood', { waitUntil: 'commit' }); f = await appFrame(d); }
        if (i === 0 && arm === 'viewer-cold-held') { await sleep(100); const p = path.join(EV, `verify-build-guide-cls-in-viewer-2-${engine}-early.png`); await d.page.screenshot({ path: p, scale: 'css' }); R.earlyShot = path.relative(ROOT, p).replace(/\\/g, '/'); }
        await sleep(7500);
        const app = await f.evaluate(() => window.__v).catch(e => ({ err: e.message.slice(0, 100) }));
        const par = arm === 'standalone-held' ? null : await d.page.evaluate(() => window.__v && window.__v.fr).catch(() => null);
        const noIn = (app.entries || []).filter(e => !e.input);
        R.cls = +noIn.reduce((s, e) => s + e.v, 0).toFixed(4);
        R.shifts = noIn.map(e => ({ t: e.t, v: e.v, src: e.src }));
        R.fcp = app['first-contentful-paint'] ?? null; R.fp = app['first-paint'] ?? null;
        R.frames = (app.fr || []).slice(0, 12).map(x => ({ t: x.t, chipsH: x.chipsH, chipsN: x.chipsN, wsTop: x.wsTop, headerH: x.headerH, hub: x.hub }));
        if (par) {
          const opAt = a => { let o = null; for (const p of par) { if (p.abs <= a) o = p; else break; } return o && { on: o.on, op: o.op }; };
          R.viewerAtShift = noIn.map(e => ({ t: e.t, v: e.v, viewer: opAt(e.abs) }));
          R.viewerAtFirstFrame = app.fr && app.fr[0] ? { t: app.fr[0].t, viewer: opAt(app.fr[0].abs) } : null;
          const fill = (app.fr || []).find(x => x.chipsN > 0);
          R.viewerAtChipsFill = fill ? { t: fill.t, viewer: opAt(fill.abs) } : null;
        }
        R.appErr = app.err; R.lsErr = app.lsErr;
      } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
      await d.close();
      out.runs[arm].push(R);
      console.log(arm, i, JSON.stringify({ cls: R.cls, shifts: R.shifts && R.shifts.map(s => `${s.t}:${s.v}:${s.src.join('|')}`), fcp: R.fcp, first: R.frames && R.frames.slice(0, 3), vShift: R.viewerAtShift && R.viewerAtShift.map(x => x.viewer), vFirst: R.viewerAtFirstFrame, vFill: R.viewerAtChipsFill, err: R.error || R.appErr }).slice(0, 1400));
      fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    }
  }
} finally { await L.close(); }
