// STAB (1): memory and resource growth over simulated hours, in Chromium (CDP Performance.getMetrics).
//
//   node "audits/tools/phase2/STAB/mem.mjs" --scenario tv|home|app [--hours 24] [--slice 10]
//
//   tv    Downstairs TV (profile 'tv') on the 1920×1080 'tv' device, #home = the kiosk board
//   home  Eli's adult Home on ipad-portrait
//   app   Eli's Home on ipad-portrait with Larder (leftovers) open in the viewer iframe
//
// How time is simulated: the browser clock is installed (Playwright ctx.clock.install) at the real now, then advanced with
// clock.runFor(10 s) slices (advance.mjs) and, after every slice, a REAL wait until no request is in flight, so the page's
// real requests to the local Worker (the 30 s hub.js pull, the TV's 5 min feed fetch, backdrop image loads) complete
// instead of being aborted by hub.request's 12 s timeout on the fake clock (see advance.mjs). Every setInterval /
// setTimeout still fires as often as it would in real time. It is an approximation: requests take real milliseconds while
// fake time stands still, the Worker's clock (clock:'real') does not jump with the browser's, and GC/idle work runs only
// during the real pauses. Each simulated hour the script forces a GC (HeapProfiler.collectGarbage) and samples
// JSHeapUsedSize, Nodes, JSEventListeners, Documents and Frames, plus the live setInterval count (a wrapper installed
// before the page's scripts), requests to the API in that hour and hub.sync.
// Output: audits/evidence/p2/STAB/mem-<scenario>.json (+ a screenshot at the end).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { advance, shot1x } from './advance.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const scenario = arg('scenario', 'tv'), HOURS = +arg('hours', 24), SLICE = +arg('slice', 10) * 1000;
const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
fs.mkdirSync(OUT, { recursive: true });

const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  const cfg = { tv: { device: 'tv', profile: 'tv' }, home: { device: 'ipad-portrait', profile: 'eli' }, app: { device: 'ipad-portrait', profile: 'eli' } }[scenario];
  if (!cfg) throw new Error('unknown scenario ' + scenario);
  const start = Date.now();
  const d = await L.device({ ...cfg, installClock: start });
  // count live intervals in every frame (wraps whatever setInterval is there when the page's own scripts start: the fake clock's)
  await d.ctx.addInitScript(() => {
    const si = window.setInterval, ci = window.clearInterval, live = new Set();
    window.setInterval = function (...a) { const id = si.apply(this, a); live.add(id); return id; };
    window.clearInterval = function (id) { live.delete(id); return ci.call(this, id); };
    Object.defineProperty(window, '__liveIntervals', { get: () => live.size });
  });
  let api = 0, apiData = 0, apiFeed = 0, images = 0, failed = 0;
  d.page.on('request', r => { const u = r.url(); if (u.startsWith(L.api)) { api++; if (u.includes('/api/data/')) apiData++; if (u.includes('/api/activity')) apiFeed++; } else if (r.resourceType() === 'image') images++; });
  d.page.on('requestfailed', r => { if (r.url().startsWith(L.api)) failed++; });
  if (scenario === 'app') { await d.goto('#home'); await d.page.waitForSelector('#view-home .card', { timeout: 15000 }); await d.openApp('leftovers'); }
  else await d.goto('#home');
  await d.page.waitForSelector(scenario === 'tv' ? '#tv #clock' : '#view-home .card', { timeout: 15000 });
  await d.ctx.clock.runFor(2000); await sleep(1500);
  // TV: count backdrop swaps (src changes on the two <img>s) so the log shows the crossfade keeps running
  if (scenario === 'tv') await d.page.evaluate(() => { window.__fades = 0; const mo = new MutationObserver(ms => { window.__fades += ms.length; }); document.querySelectorAll('.tv-bg-img').forEach(i => mo.observe(i, { attributes: true, attributeFilter: ['class'] })); });

  const cdp = await d.ctx.newCDPSession(d.page);
  await cdp.send('Performance.enable'); await cdp.send('HeapProfiler.enable');
  const sample = async (h) => {
    await cdp.send('HeapProfiler.collectGarbage'); await sleep(100);
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.filter(x => ['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'JSEventListeners', 'Documents', 'Frames', 'LayoutCount', 'RecalcStyleCount'].includes(x.name)).map(x => [x.name, x.value]));
    const pg = await d.page.evaluate(() => ({
      now: new Date().toString().slice(0, 24), intervals: window.__liveIntervals, sync: window.hub && { state: hub.sync.state, pending: hub.sync.pending, lastPullAgoS: hub.sync.lastPull ? Math.round((Date.now() - hub.sync.lastPull) / 1000) : null },
      domNodes: document.querySelectorAll('*').length, tvStats: window.__tvStats ? { ...window.__tvStats } : undefined,
      tvState: window.__tv ? window.__tv.state() : undefined,
      fadeAgoS: window.__tv ? Math.round((Date.now() - window.__tv.state().lastFade) / 1000) : undefined, fades: window.__fades,
      heroDate: (document.querySelector('#view-home .hero-kicker, #tv-date') || {}).textContent,
      clock: (document.querySelector('#clock') || {}).textContent,
    }));
    const fr = d.frame('leftovers');
    const app = fr ? await fr.evaluate(() => ({ intervals: window.__liveIntervals, domNodes: document.querySelectorAll('*').length, sync: window.hub && hub.sync.state })).catch(e => ({ err: e.message })) : undefined;
    return { hour: h, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), heapTotalMB: +(m.JSHeapTotalSize / 1048576).toFixed(2), nodes: m.Nodes, listeners: m.JSEventListeners, documents: m.Documents, frames: m.Frames,
      layouts: m.LayoutCount, styleRecalcs: m.RecalcStyleCount, api, apiData, apiFeed, images, failedApi: failed, ...pg, app };
  };
  const rows = [await sample(0)];
  console.log(JSON.stringify(rows[0]));
  const t0 = Date.now();
  for (let h = 1; h <= HOURS; h++) {
    api = apiData = apiFeed = images = failed = 0;
    await advance(d, 3600000, { slice: SLICE });
    const r = await sample(h); rows.push(r);
    console.log(JSON.stringify({ hour: h, heapMB: r.heapMB, nodes: r.nodes, listeners: r.listeners, documents: r.documents, frames: r.frames, intervals: r.intervals, domNodes: r.domNodes, api: r.api, apiData: r.apiData, apiFeed: r.apiFeed, images: r.images, failedApi: r.failedApi, sync: r.sync, now: r.now, app: r.app, heroDate: r.heroDate, tv: r.tvState && { front: r.tvState.front, url: r.tvState.url.map(u => u.replace(/^https?:\/\/[^/]+/, '')), fades: r.fades, fadeAgoS: r.fadeAgoS } }));
  }
  await shot1x(d, path.join(OUT, `mem-${scenario}-end.png`));
  const first = rows[1] || rows[0], last = rows[rows.length - 1];
  const summary = { scenario, hours: HOURS, sliceS: SLICE / 1000, realSeconds: Math.round((Date.now() - t0) / 1000),
    heapMB: { h0: rows[0].heapMB, h1: first.heapMB, last: last.heapMB, max: Math.max(...rows.map(r => r.heapMB)) },
    nodes: { h0: rows[0].nodes, h1: first.nodes, last: last.nodes, max: Math.max(...rows.map(r => r.nodes)) },
    listeners: { h0: rows[0].listeners, h1: first.listeners, last: last.listeners, max: Math.max(...rows.map(r => r.listeners)) },
    documents: { h0: rows[0].documents, last: last.documents, max: Math.max(...rows.map(r => r.documents)) },
    intervals: { h0: rows[0].intervals, last: last.intervals, max: Math.max(...rows.map(r => r.intervals || 0)) },
    consoleErrors: d.logs.filter(l => /^error|pageerror/.test(l)).slice(0, 10) };
  fs.writeFileSync(path.join(OUT, `mem-${scenario}.json`), JSON.stringify({ summary, rows }, null, 1));
  console.log('SUMMARY', JSON.stringify(summary));
} finally { await L.close(); }
