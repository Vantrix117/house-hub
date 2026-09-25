// Skeptic #1 for TELL finding "build-guide-cls-in-viewer": re-measure the build guide's cold-open layout shift inside the
// shell viewer vs standalone, with and without the held first pull, and find what moves div.workspace.
//   node audits/tools/phase4/TELL/verify-build-guide-cls-in-viewer-1.mjs [engine=chromium|webkit] [runs=2]
//   node … chromium 2 4   → the same with 4x CPU throttling (checks whether the standalone 0 is a timing accident)
//   → audits/evidence/p4/TELL/verify-build-guide-cls-in-viewer-1-<engine>[-cpuN].json (+ one 1x PNG of the viewer at ~150 ms)
// Chromium: Layout Instability API entries (no recent input) + rAF-sampled geometry. WebKit has no layout-shift API,
// so there only the rAF geometry trace (workspace top, chipwrap/header heights, chip count) is recorded.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const engine = process.argv[2] || 'chromium';
const runs = +(process.argv[3] || 2);
const cpu = +(process.argv[4] || 1); // Chromium CPU throttling rate (CDP), 1 = none
const tag = engine + (cpu > 1 ? '-cpu' + cpu : '');
const INIT = () => {
  if (!/dollywood\.html/.test(location.pathname)) return;
  const w = window; w.__v = { ls: [], geo: [], paint: [], chipsAt: null, scriptAt: null };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) w.__v.ls.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput, src: (e.sources || []).map(s => { const n = s.node; const d = n && n.nodeType === 1 ? n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList && n.classList.length ? '.' + [...n.classList].slice(0, 2).join('.') : '') : (n ? '#text' : '?'); return `${d} y${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)}`; }) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { w.__v.lsErr = String(e); }
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) w.__v.paint.push({ n: e.name, t: Math.round(e.startTime) }); }).observe({ type: 'paint', buffered: true }); } catch (e) {}
  let last = '';
  const tick = () => {
    const ws = document.querySelector('.workspace'), cw = document.getElementById('chipwrap'), hd = document.querySelector('header'), ch = document.getElementById('chips');
    if (ch && ch.children.length && w.__v.chipsAt == null) w.__v.chipsAt = Math.round(performance.now());
    const g = { ws: ws ? Math.round(ws.getBoundingClientRect().top) : null, cw: cw ? Math.round(cw.getBoundingClientRect().height) : null, hd: hd ? Math.round(hd.getBoundingClientRect().height) : null, chips: ch ? ch.children.length : null, flavor: document.documentElement.dataset.flavor, theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme || null };
    const k = JSON.stringify(g); if (k !== last) { last = k; w.__v.geo.push({ t: Math.round(performance.now()), ...g }); }
    if (performance.now() < 9000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
if (process.argv[5] !== 'frames') {
const L = await local({ variant: 'typical', engine });
var out = { engine, note: 'See header of audits/tools/phase4/TELL/verify-build-guide-cls-in-viewer-1.mjs', runs: [] };
try {
  for (let r = 0; r < runs; r++) for (const where of ['viewer', 'standalone']) for (const arm of ['held', 'lat150']) {
    const R = { run: r, where, arm };
    try {
      const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
      await d.ctx.route(L.api + '/api/**', async rt => { const u = rt.request().url(); const hold = arm === 'held' && rt.request().method() === 'GET' && /\/api\/data\//.test(u); await sleep(hold ? 2500 : 150); rt.continue().catch(() => {}); });
      await d.ctx.addInitScript(INIT);
      if (cpu > 1) { const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
      await d.page.addInitScript(() => { if (location.pathname.endsWith('/index.html')) { window.__vw = { on: null }; const mo = new MutationObserver(() => { const v = document.getElementById('viewer'); if (v && v.classList.contains('on') && window.__vw.on == null) window.__vw.on = performance.timeOrigin + performance.now(); }); document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] })); } });
      await d.page.goto(L.site + (where === 'viewer' ? '/index.html#dollywood' : '/apps/dollywood.html'), { waitUntil: 'commit' });
      let doc = null; const until = Date.now() + 15000;
      while (Date.now() < until) { doc = d.page.frames().find(f => f.url().includes('/apps/dollywood.html')); if (doc) { const ok = await doc.evaluate(() => !!window.__v).catch(() => false); if (ok) break; } await sleep(30); }
      if (r === 0 && where === 'viewer' && arm === 'held') { await sleep(120); const f = path.join(EV, `verify-build-guide-cls-in-viewer-1-${tag}-viewer-early.png`); await d.page.screenshot({ path: f, scale: 'css' }).catch(() => {}); R.shot = path.relative(ROOT, f).split(path.sep).join('/'); }
      await sleep(8000);
      const v = await doc.evaluate(() => ({ ...window.__v, origin: performance.timeOrigin, pulled: !!(window.hub && hub.sync && hub.sync.lastPull) }));
      if (where === 'viewer') { const on = await d.page.evaluate(() => window.__vw && window.__vw.on).catch(() => null); R.viewerOnAtFrameMs = on == null ? null : Math.round(on - v.origin); R.viewerInMs = await d.page.evaluate(() => getComputedStyle(document.getElementById('viewer')).animationDuration).catch(() => null); }
      const noIn = v.ls.filter(e => !e.input);
      R.cls = +noIn.reduce((s, e) => s + e.v, 0).toFixed(4); R.shifts = noIn; R.lsErr = v.lsErr; R.paint = v.paint; R.chipsAt = v.chipsAt; R.pulled = v.pulled;
      R.geo = v.geo; R.wsFirst = v.geo.find(g => g.ws != null)?.ws; R.wsFinal = v.geo[v.geo.length - 1]?.ws;
      await d.close();
    } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
    out.runs.push(R);
    console.log(JSON.stringify({ r, where, arm, cls: R.cls, n: R.shifts && R.shifts.length, top: R.shifts && R.shifts.slice().sort((a, b) => b.v - a.v)[0], chipsAt: R.chipsAt, viewerOn: R.viewerOnAtFrameMs, paint: R.paint, ws: [R.wsFirst, R.wsFinal], err: R.error }));
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, `verify-build-guide-cls-in-viewer-1-${tag}.json`), JSON.stringify(out, null, 1));
}
// Frames arm: `node … chromium 1 6 frames` — standalone and viewer under CPU throttling, screenshots every ~120 ms with the
// frame's workspace top and chip count at that moment; keeps the last pre-chips and first post-chips shot of each (1x PNG).
if (process.argv[5] === 'frames') {
  const L2 = await local({ variant: 'typical', engine });
  const res = {};
  try {
    for (const where of ['standalone', 'viewer']) {
      const d = await L2.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
      await d.ctx.route(L2.api + '/api/**', async rt => { await sleep(150); rt.continue().catch(() => {}); });
      const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await d.page.goto(L2.site + (where === 'viewer' ? '/index.html#dollywood' : '/apps/dollywood.html'), { waitUntil: 'commit' });
      const seq = []; const t0 = Date.now(); let pre = null, post = null;
      while (Date.now() - t0 < 6000) {
        const fr = d.page.frames().find(f => f.url().includes('/apps/dollywood.html'));
        const g = fr ? await fr.evaluate(() => { const ws = document.querySelector('.workspace'), ch = document.getElementById('chips'); return { ws: ws ? Math.round(ws.getBoundingClientRect().top) : null, chips: ch ? ch.children.length : null }; }).catch(() => null) : null;
        const buf = await d.page.screenshot({ scale: 'css' }).catch(() => null);
        seq.push({ t: Date.now() - t0, ...(g || {}) });
        if (g && g.ws != null && g.chips === 0 && buf) pre = buf;
        if (g && g.chips > 0 && buf && !post) { post = buf; }
        if (post && seq.length > 3 && Date.now() - t0 > 1500) break;
        await sleep(60);
      }
      if (pre) fs.writeFileSync(path.join(EV, `verify-build-guide-cls-in-viewer-1-${where}-prechips.png`), pre);
      if (post) fs.writeFileSync(path.join(EV, `verify-build-guide-cls-in-viewer-1-${where}-postchips.png`), post);
      res[where] = { seq, preShot: !!pre, postShot: !!post };
      console.log(where, JSON.stringify(seq.filter(s => s.ws != null).slice(0, 12)));
      await d.close();
    }
  } finally { await L2.close(); }
  fs.writeFileSync(path.join(EV, `verify-build-guide-cls-in-viewer-1-frames-cpu${cpu}.json`), JSON.stringify(res, null, 1));
}
