// Phase 2 / PWA — skeptic #2 for finding "open-page-never-takes-new-build".
//   node "audits/tools/phase2/PWA/verify-open-page-never-takes-new-build-2.mjs"
// Independent of sw.mjs. Chromium (the installed Chrome; Playwright WebKit cannot run service workers), rig site at
// http://localhost with the default Cache-Control: no-cache, HTTP cache off (routed context) — i.e. the most favourable
// case for an update to land. Two always-open devices:
//   A) the Kitchen iPad signed in as Eli, left on Home;  B) the Downstairs TV (kiosk) left on its board.
// For each: warm the SW, stamp the in-memory page, "deploy" (overlay = sw.js VERSION bump + index.html with a marker meta),
// then WITHOUT calling reg.update() wait through two hub.js 30 s polls and see whether the device even notices the deploy.
// A additionally opens an app in the shell (hash change = same document, iframe navigation) — a real-life trigger.
// Finally force reg.update() (what sw.mjs did) and record: controllerchange count, same page?, which index.html is running,
// toasts, and whether anything reloads in the next 40 s.
// Evidence: audits/evidence/p2/PWA/verify-open-page-never-takes-new-build-2.json
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA/verify-open-page-never-takes-new-build-2.json');
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const VERSION = /const VERSION = '([^']+)'/.exec(swSrc)[1];
const V2 = VERSION + '-verify2';
const OV = path.join(HERE, 'verify2-overlay');
fs.mkdirSync(OV, { recursive: true });
fs.writeFileSync(path.join(OV, 'index.html'), idx.replace('<head>', '<head>\n<meta name="audit-build" content="NEW-DEPLOY">'));
fs.writeFileSync(path.join(OV, 'sw.js'), swSrc.replace(`const VERSION = '${VERSION}'`, `const VERSION = '${V2}'`));
const OVREL = path.relative(ROOT, OV).replace(/\\/g, '/');

const spy = () => {
  window.__toasts = [];
  new MutationObserver(() => { const t = document.getElementById('hub-toast'); if (t && !t.hidden && t.textContent && !window.__toasts.includes(t.textContent)) window.__toasts.push(t.textContent); })
    .observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
};
const waitFor = async (page, fn, arg, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await page.evaluate(fn, arg)) return true; } catch {} await sleep(250); } return false; };
const state = page => page.evaluate(async v2 => {
  const reg = await navigator.serviceWorker.getRegistration();
  return {
    samePage: window.__stamp === 'before-deploy',
    runningIndexHtml: (document.querySelector('meta[name="audit-build"]') || {}).content || 'ORIGINAL',
    controllerchangeEvents: window.__cc,
    cacheKeys: await caches.keys(),
    newVersionInstalled: (await caches.keys()).includes(v2),
    reg: reg && { active: reg.active && reg.active.state, waiting: !!reg.waiting, installing: !!reg.installing },
    toasts: window.__toasts,
    navEntries: performance.getEntriesByType('navigation').length,
    hash: location.hash,
  };
}, V2);

async function run(L, label, devOpts, openAppMidway) {
  const r = { label };
  await L.overlay('');                       // start from the current repo
  const d = await L.device({ ...devOpts, sw: true, fixedTime: false });
  try {
    await d.ctx.addInitScript(spy);
    await d.goto('#home');
    r.controlled = await waitFor(d.page, () => !!navigator.serviceWorker.controller);
    r.precached = await waitFor(d.page, async v => (await (await caches.open(v)).keys()).length >= 60, VERSION, 20000);
    // cold reopen so the page is controlled from its first byte (like a real launch)
    await d.goto('#home'); await sleep(1500);
    await d.page.evaluate(() => { window.__stamp = 'before-deploy'; window.__cc = 0; navigator.serviceWorker.addEventListener('controllerchange', () => window.__cc++); });
    r.beforeDeploy = await state(d.page);
    await L.overlay(OVREL);                  // the deploy
    const t0 = Date.now();
    await sleep(65000);                      // two hub.js 30 s polls, no update() from the test
    r.after65sNoForcedUpdate = { ...(await state(d.page)), secondsAfterDeploy: Math.round((Date.now() - t0) / 1000) };
    if (openAppMidway) {
      await d.page.evaluate(id => { location.hash = '#' + id; }, openAppMidway);   // same document; the shell navigates its iframe
      await sleep(10000);
      r.afterOpeningAppInShell = { app: openAppMidway, ...(await state(d.page)), frameUrl: (d.page.frames().find(f => f.url().includes('/apps/')) || { url: () => null }).url() };
      await d.page.evaluate(() => { location.hash = '#home'; }); await sleep(1500);
    }
    if (!(await state(d.page)).newVersionInstalled) {
      await d.page.evaluate(() => navigator.serviceWorker.getRegistration().then(x => x.update()));
      r.forcedUpdate = true;
      await waitFor(d.page, v => caches.keys().then(k => k.includes(v)), V2, 20000);
    }
    await sleep(3000);
    r.afterNewWorkerActive = await state(d.page);
    await sleep(40000);
    r.forty5sLater = await state(d.page);
    r.logs = d.logs.filter(l => /error|sw|service/i.test(l)).slice(0, 10);
  } finally { await d.close(); }
  return r;
}

const out = { VERSION, V2, note: 'rig site Cache-Control no-cache; Playwright routed context (HTTP cache off)' };
let L;
try {
  L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
  out.sessions = Object.keys(L.S.info.sessions);
  out.ipad = await run(L, 'Kitchen iPad (Eli, Home)', { device: 'ipad-landscape', profile: 'eli' }, 'tally');
  console.log(JSON.stringify(out.ipad, null, 1));
  out.tv = await run(L, 'Downstairs TV (kiosk board)', { device: 'tv', profile: 'tv' }, null);
  console.log(JSON.stringify(out.tv, null, 1));
} finally {
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  fs.rmSync(OV, { recursive: true, force: true });   // never leave a second index.html under audits/ (Pages would publish it)
  if (L) await L.close();
  console.log('wrote', path.relative(ROOT, OUT));
}
