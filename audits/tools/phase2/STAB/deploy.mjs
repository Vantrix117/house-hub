// STAB (5): how a PWA that never closes picks up a new deploy. Chromium (working service workers), real clock.
//   node "audits/tools/phase2/STAB/deploy.mjs" [--cc no-cache|max-age=600|max-age=20] [--expire]
//   --reload re-opens with page.reload() (a reload revalidates the navigation) instead of a fresh navigation
//   --keep-overlay leaves overlay-deploy/ on disk after the run (it is deleted by default: it is a working copy of the app)
//   --expire (with max-age=600): after the two re-opens, wait until max-age has run out and re-open twice more (~11 min)
//
// 1. Eli's Home loads with the service worker allowed (sw.js registers on localhost) and the SW takes control.
// 2. A "deploy" is served over the repo: audits/tools/phase2/STAB/overlay-deploy/ holds copies of the working tree's sw.js
//    (VERSION bumped), index.html, apps/hub.js and apps/tally.html, each with a marker (window.__stabDeploy / __stabHub /
//    __stabApp = 'v2'). The copies are regenerated from the working tree on every run.
// 3. Nothing is clicked for 40 s (real time, ≥ 1 hub.js pull): does the page notice the deploy by itself?
// 4. An app is opened in the viewer (an iframe navigation): does that start the update check?
// 5. If not, reg.update() is called, as a browser's own periodic check would. Recorded: every toast, the SW states, cache
//    names, whether the RUNNING page has the new code, what an app opened afterwards runs, and each reload's index.html.
// --cc sets the site's Cache-Control (GitHub Pages sends max-age=600 — see live-cache-headers.txt). With max-age the
// SW's install precache (cache.add → HTTP cache) can store the OLD file under the NEW version.
// Output: audits/evidence/p2/STAB/deploy-<cc>.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { shot1x } from './advance.mjs';

const CC = (() => { const i = process.argv.indexOf('--cc'); return i > 0 ? process.argv[i + 1] : 'no-cache'; })();
const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const OV = path.join(ROOT, 'audits/tools/phase2/STAB/overlay-deploy');
// ── build the overlay from the working tree ──
fs.mkdirSync(path.join(OV, 'apps'), { recursive: true });
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sw = src('sw.js'); const oldVersion = sw.match(/const VERSION = '([^']+)'/)[1]; const newVersion = oldVersion + '-stab';
fs.writeFileSync(path.join(OV, 'sw.js'), sw.replace(`const VERSION = '${oldVersion}'`, `const VERSION = '${newVersion}'`));
fs.writeFileSync(path.join(OV, 'index.html'), src('index.html').replace('<head>', `<head><script>window.__stabDeploy = 'v2';</script>`));
fs.writeFileSync(path.join(OV, 'apps/hub.js'), src('apps/hub.js') + `\n;window.__stabHub = 'v2';\n`);
fs.writeFileSync(path.join(OV, 'apps/tally.html'), src('apps/tally.html').replace('<head>', `<head><script>window.__stabApp = 'v2';</script>`));

const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium', siteCacheControl: CC });
const RELOAD = process.argv.includes('--reload');
const SFX = CC.replace(/[^a-z0-9]+/gi, '') + (RELOAD ? '-reload' : '');
const R = { cc: CC, reopenBy: RELOAD ? 'page.reload()' : 'fresh navigation (about:blank → index.html)', oldVersion, newVersion, steps: [] };
const step = (name, v) => { R.steps.push({ name, ...v }); console.log(name, JSON.stringify(v)); };
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', sw: true, fixedTime: false });
  // Playwright turns the browser's HTTP cache OFF whenever a context has a route() — and L.device routes the production
  // API host to an abort as a safety net. To test max-age the route must go, so production is refused another way: an
  // init script makes fetch() reject any URL on the production host in every frame (hub.js only talks through fetch, and
  // hub.api is the local Worker anyway), and every request is watched; any production request fails the run.
  const PROD = 'house-hub-api.catalystfarm1.workers.dev';
  if (/max-age/.test(CC)) {
    await d.ctx.unrouteAll({ behavior: 'wait' });
    await d.ctx.addInitScript(host => { const f = window.fetch; window.fetch = function (u, o) { if (String(u && u.url || u).includes(host)) return Promise.reject(new TypeError('blocked by STAB: production')); return f.call(this, u, o); }; }, PROD);
    d.ctx.on('request', r => { if (r.url().includes(PROD)) { console.error('PRODUCTION REQUEST SEEN — aborting', r.url()); process.exit(2); } });
    R.httpCache = 'on (route removed; production blocked by a fetch guard)';
  }
  await d.ctx.addInitScript(() => {           // record the SW lifecycle as the page sees it (hub.toast calls are recorded by wrapping hub.toast after load)
    window.__toasts = []; window.__sw = [];
    if (navigator.serviceWorker && window.top === window) navigator.serviceWorker.getRegistration().then(function hook(reg) {
      if (!reg) return setTimeout(() => navigator.serviceWorker.getRegistration().then(hook), 200);
      reg.addEventListener('updatefound', () => { const w = reg.installing; window.__sw.push('updatefound controller=' + !!navigator.serviceWorker.controller);
        if (w) w.addEventListener('statechange', () => window.__sw.push('statechange ' + w.state + ' controller=' + !!navigator.serviceWorker.controller)); });
    });
    if (navigator.serviceWorker && window.top === window) navigator.serviceWorker.addEventListener('controllerchange', () => window.__sw.push('controllerchange'));
  });
  const reopen = async () => { if (RELOAD) await d.page.reload({ waitUntil: 'load' }); else { await d.page.goto('about:blank'); await d.goto('#home'); } };
  const state = async () => d.page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const idx = async name => { try { const c = await caches.open(name); const r = await c.match('index.html'); return r ? (await r.text()).includes("__stabDeploy = 'v2'") ? 'v2' : 'v1' : null; } catch (e) { return String(e); } };
    const names = await caches.keys();
    return { controller: !!navigator.serviceWorker.controller, active: reg && reg.active && reg.active.state, waiting: !!(reg && reg.waiting), installing: !!(reg && reg.installing),
      caches: Object.fromEntries(await Promise.all(names.map(async n => [n, await idx(n)]))),
      runningShell: window.__stabDeploy || 'v1', runningShellHub: window.__stabHub || 'v1', toastCalls: (window.__toastCalls || []).slice(), swEvents: window.__sw.slice() };
  });
  await d.goto('#home'); await d.page.waitForSelector('#view-home .card');
  await d.page.evaluate(() => navigator.serviceWorker.ready);
  for (let i = 0; i < 50 && !(await d.page.evaluate(() => !!navigator.serviceWorker.controller)); i++) await sleep(100);
  await sleep(1500);
  await d.page.evaluate(() => { const t = hub.toast; window.__toastCalls = []; hub.toast = (m, ms) => { window.__toastCalls.push(m); return t(m, ms); }; });
  step('1 first load, SW installed', await state());
  // 2. deploy
  await L.overlay(path.relative(ROOT, OV));
  // 3. leave it alone for 40 s of real time
  await sleep(40000);
  step('3 40 s after the deploy, untouched', await state());
  // 4. open an app (iframe navigation inside the SW scope)
  const f = await d.openApp('tally');
  for (let i = 0; i < 40 && !(await d.page.evaluate(() => (window.__toastCalls || []).length)); i++) await sleep(100);
  await sleep(400); await shot1x(d, path.join(OUT, `deploy-${SFX}-toast.png`)); await sleep(3000);
  step('4 after opening Tally', { ...(await state()), app: await f.evaluate(() => ({ app: window.__stabApp || 'v1', hub: window.__stabHub || 'v1' })) });
  await d.page.click('#pill-home').catch(() => {}); await sleep(500);
  // 5. an explicit update check
  await d.page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  for (let i = 0; i < 60; i++) { const s = await d.page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !r.installing && !r.waiting; }); if (s) break; await sleep(250); }
  await sleep(1500);
  step('5 after reg.update()', await state());
  // 6. an app opened AFTER the new SW took over, inside the old running shell
  const f4 = await d.openApp('tally'); await sleep(2500);
  step('6 Tally opened after the new SW took over (old shell still running)', { ...(await state()), app: await f4.evaluate(() => ({ app: window.__stabApp || 'v1', hub: window.__stabHub || 'v1' })) });
  // 7. "next time it opens": a fresh navigation (about:blank, then index.html — not a reload, which would revalidate), twice
  for (const n of [1, 2]) {
    await reopen(); await d.page.waitForSelector('#view-home .card', { timeout: 15000 }).catch(() => {}); await sleep(2000);
    step(`7.${n} re-open #${n}`, await state());
  }
  if (/max-age=(\d+)/.test(CC) && (+CC.match(/max-age=(\d+)/)[1] <= 30 || process.argv.includes('--expire'))) {
    const wait = +CC.match(/max-age=(\d+)/)[1] * 1000 + 2000;
    await sleep(wait);
    for (const n of [3, 4]) {
      await reopen(); await d.page.waitForSelector('#view-home .card', { timeout: 15000 }).catch(() => {}); await sleep(2000);
      step(`7.${n} re-open #${n} (after max-age expired)`, await state());
    }
  }
  R.logs = d.logs.filter(l => !/favicon/.test(l)).slice(0, 20);
  fs.writeFileSync(path.join(OUT, `deploy-${SFX}.json`), JSON.stringify(R, null, 1));
} finally {
  await L.close();
  // the overlay is a full copy of the app (index.html, hub.js, sw.js, tally.html): remove it so it is never committed and
  // published by GitHub Pages as a second working hub under /audits/… (--keep-overlay to inspect it)
  if (!process.argv.includes('--keep-overlay')) fs.rmSync(OV, { recursive: true, force: true });
}
