// Skeptic #1 for STAB finding "deploy-precache-stale-http-cache": does a new sw.js VERSION precache the OLD files
// when the site is served with Cache-Control: max-age=600 (as GitHub Pages does), while the shell toasts "Hub updated"?
//
//   node "audits/tools/phase2/STAB/verify-deploy-precache-stale-http-cache-1.mjs" --cc max-age=600          (the claim)
//   node "audits/tools/phase2/STAB/verify-deploy-precache-stale-http-cache-1.mjs" --cc no-cache             (control)
//   node "audits/tools/phase2/STAB/verify-deploy-precache-stale-http-cache-1.mjs" --cc max-age=600 --fix    (cause check:
//        the deployed sw.js adds with new Request(u, {cache:'reload'}) instead of c.add(u) — only sw.js:22 differs)
//   add --reload to re-open with page.reload() instead of a fresh navigation
//   add --expire to wait out max-age and re-open twice more (use a short max-age, e.g. --cc max-age=45 --expire)
//
// Independent of the investigator's deploy.mjs. Chromium (the installed Chrome: working service workers), real clock.
// Every variant removes Playwright's routes (a route turns the HTTP cache off), so the ONLY difference between the claim
// and the control is the Cache-Control header the local site sends. Production is refused three ways: CDP
// Network.setBlockedURLs on the page target, a fetch() guard in every frame, and a request watcher that aborts the run.
// The "deploy" is an overlay folder (removed at the end) holding sw.js (VERSION + '-verify'), index.html with
// window.__vIdx='v2' and apps/hub.js with window.__vHub='v2'. Any network hit after the overlay returns v2 bytes, so a
// v1 body inside the NEW cache can only have come from the browser's HTTP cache.
// Output: audits/evidence/p2/STAB/verify-precache-<variant>.json (+ a 1× PNG of the toast).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const argv = process.argv;
const val = (k, d) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : d; };
const CC = val('--cc', 'max-age=600');
const FIX = argv.includes('--fix');
const EXPIRE = argv.includes('--expire');
const RELOAD = argv.includes('--reload');   // re-open with page.reload() (revalidates the navigation only) instead of a fresh navigation
const TAG = CC.replace(/[^a-z0-9]+/gi, '') + (FIX ? '-fix' : '') + (EXPIRE ? '-expire' : '') + (RELOAD ? '-reload' : '');
const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const OV = path.join(ROOT, 'audits/tools/phase2/STAB/overlay-verify-precache');
const PROD = 'house-hub-api.catalystfarm1.workers.dev';

// ── the "deploy" (built from the working tree) ──
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
fs.rmSync(OV, { recursive: true, force: true });
fs.mkdirSync(path.join(OV, 'apps'), { recursive: true });
const sw = src('sw.js');
const oldVersion = sw.match(/const VERSION = '([^']+)'/)[1];
const newVersion = oldVersion + '-verify';
let sw2 = sw.replace(`const VERSION = '${oldVersion}'`, `const VERSION = '${newVersion}'`);
if (FIX) { if (!sw2.includes('c.add(u)')) throw new Error('sw.js no longer has c.add(u)'); sw2 = sw2.replace('c.add(u)', "c.add(new Request(u, { cache: 'reload' }))"); }
fs.writeFileSync(path.join(OV, 'sw.js'), sw2);
fs.writeFileSync(path.join(OV, 'index.html'), src('index.html').replace('<head>', "<head><script>window.__vIdx = 'v2';</script>"));
fs.writeFileSync(path.join(OV, 'apps/hub.js'), src('apps/hub.js') + "\n;window.__vHub = 'v2';\n");

const R = { cc: CC, fix: FIX, oldVersion, newVersion, steps: [] };
const log = (name, v) => { R.steps.push({ name, ...v }); console.log('\n## ' + name + '\n' + JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium', siteCacheControl: CC });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', sw: true, fixedTime: false });
  await d.ctx.unrouteAll({ behavior: 'wait' });                     // HTTP cache back on (all variants alike)
  const cdp = await d.ctx.newCDPSession(d.page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs', { urls: [`*${PROD}*`] });
  await d.ctx.addInitScript(host => { const f = window.fetch; window.fetch = function (u, o) { if (String(u && u.url || u).includes(host)) return Promise.reject(new TypeError('blocked: production')); return f.call(this, u, o); }; }, PROD);
  d.ctx.on('request', r => { if (r.url().includes(PROD)) { console.error('PRODUCTION REQUEST SEEN — aborting', r.url()); process.exit(2); } });
  // record what the browser does per request for the two files (served from HTTP cache or network)
  const net = [];
  cdp.on('Network.responseReceived', e => { if (/\/(index\.html|apps\/hub\.js|sw\.js)(\?|$)/.test(e.response.url)) net.push({ url: e.response.url.replace(L.site, ''), fromServiceWorker: !!e.response.fromServiceWorker, fromDiskCache: !!e.response.fromDiskCache, cc: e.response.headers['Cache-Control'] || e.response.headers['cache-control'] }); });

  const state = () => d.page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const names = await caches.keys();
    const caches_ = {};
    for (const n of names) {
      const c = await caches.open(n);
      const idx = await c.match('index.html'); const hubjs = await c.match('apps/hub.js'); const swjs = await c.match('sw.js');
      caches_[n] = {
        'index.html': idx ? ((await idx.text()).includes("__vIdx = 'v2'") ? 'v2' : 'v1') : null,
        'apps/hub.js': hubjs ? ((await hubjs.text()).includes("__vHub = 'v2'") ? 'v2' : 'v1') : null,
        'sw.js VERSION': swjs ? ((await swjs.text()).match(/const VERSION = '([^']+)'/) || [])[1] : null,
      };
    }
    return { controller: !!navigator.serviceWorker.controller, active: reg && reg.active && reg.active.state, installing: !!(reg && reg.installing), waiting: !!(reg && reg.waiting),
      caches: caches_, running: { 'index.html': window.__vIdx || 'v1', 'apps/hub.js': window.__vHub || 'v1' }, toastCalls: (window.__toastCalls || []).slice() };
  });

  // 1. first load: SW installs and takes control (populates hub-vNN and the HTTP cache)
  const t0 = Date.now();
  await d.goto('#home'); await d.page.waitForSelector('#view-home .card', { timeout: 20000 });
  await d.page.evaluate(() => navigator.serviceWorker.ready);
  for (let i = 0; i < 60 && !(await d.page.evaluate(() => !!navigator.serviceWorker.controller)); i++) await sleep(100);
  // let the install precache finish (it is Promise.allSettled over ~80 files)
  for (let i = 0; i < 60; i++) { const s = await state(); if (s.caches[oldVersion] && s.caches[oldVersion]['apps/hub.js']) break; await sleep(250); }
  await sleep(1000);
  await d.page.evaluate(() => { const t = hub.toast; window.__toastCalls = []; hub.toast = (m, ms) => { window.__toastCalls.push(m); return t(m, ms); }; });
  log('1 first load, SW active', await state());

  // 2. deploy; sanity-check that the server now really serves v2
  await L.overlay(path.relative(ROOT, OV));
  const direct = {
    'index.html': (await (await fetch(L.site + '/index.html')).text()).includes("__vIdx = 'v2'") ? 'v2' : 'v1',
    'apps/hub.js': (await (await fetch(L.site + '/apps/hub.js')).text()).includes("__vHub = 'v2'") ? 'v2' : 'v1',
    'sw.js VERSION': (await (await fetch(L.site + '/sw.js')).text()).match(/const VERSION = '([^']+)'/)[1],
    'Cache-Control': (await fetch(L.site + '/index.html')).headers.get('cache-control'),
  };
  log('2 deployed — what the server serves now (Node fetch, no browser cache)', { server: direct, secondsSinceFirstLoad: Math.round((Date.now() - t0) / 1000) });

  // 3. the browser's update check (as on a navigation or the browser's periodic check)
  net.length = 0;
  await d.page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  for (let i = 0; i < 80; i++) { const s = await state(); if (s.caches[newVersion] && !s.caches[oldVersion] && !s.installing && !s.waiting) break; await sleep(250); }
  for (let i = 0; i < 20 && !(await d.page.evaluate(() => (window.__toastCalls || []).length)); i++) await sleep(100);
  await sleep(300);
  fs.mkdirSync(OUT, { recursive: true });
  await d.page.screenshot({ path: path.join(OUT, `verify-precache-${TAG}-toast.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
  log('3 after reg.update(): new SW installed + activated', await state());

  // 4. "next time it opens": fresh navigations (about:blank, then index.html)
  const reopen = async n => {
    net.length = 0;
    if (RELOAD) await d.page.reload({ waitUntil: 'load' }); else { await d.page.goto('about:blank'); await d.goto('#home'); }
    await d.page.waitForSelector('#view-home .card', { timeout: 20000 }).catch(() => {});
    await sleep(2500);                                          // let the SW's background refresh land
    log(`4.${n} re-open #${n}`, { ...(await state()), requests: net.slice() });
  };
  await reopen(1); await reopen(2);
  if (EXPIRE) {
    const ma = +((CC.match(/max-age=(\d+)/) || [])[1] || 0);
    console.log(`\n… waiting ${ma + 3} s for max-age to run out`);
    await sleep((ma + 3) * 1000);
    await reopen(3); await reopen(4);
  }
  R.pageErrors = d.logs.filter(l => /pageerror/.test(l)).slice(0, 10);
  fs.writeFileSync(path.join(OUT, `verify-precache-${TAG}.json`), JSON.stringify(R, null, 1));
  console.log('\nwrote', path.relative(ROOT, path.join(OUT, `verify-precache-${TAG}.json`)));
} finally {
  await L.close();
  fs.rmSync(OV, { recursive: true, force: true });           // never leave a second copy of the app under audits/
}
