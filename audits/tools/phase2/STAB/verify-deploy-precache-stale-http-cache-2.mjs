// STAB skeptic #2 for "deploy-precache-stale-http-cache": does a new sw.js VERSION precache the OLD files when the site
// sends GitHub Pages' Cache-Control: max-age=600, while the page toasts "Hub updated"?
// Independent of deploy.mjs: a different trigger (the update check comes from re-opening the PWA, i.e. a navigation —
// what Eli's phone does after he pushes), its own overlay folder, and a root-cause arm.
//
//   node "audits/tools/phase2/STAB/verify-deploy-precache-stale-http-cache-2.mjs" --cc max-age=600
//   node "audits/tools/phase2/STAB/verify-deploy-precache-stale-http-cache-2.mjs" --cc no-cache                (control)
//   node "audits/tools/phase2/STAB/verify-deploy-precache-stale-http-cache-2.mjs" --cc max-age=600 --fix      (root cause:
//        the overlay sw.js's install fetches with {cache:'reload'} — nothing else changed; the overlay is test-only)
//   node "audits/tools/phase2/STAB/verify-deploy-precache-stale-http-cache-2.mjs" --cc max-age=600 --reload   (re-open by reload)
//   node "audits/tools/phase2/STAB/verify-deploy-precache-stale-http-cache-2.mjs" --cc max-age=45 --expire    (convergence)
//
// Chromium (installed Chrome, service workers allowed), real clock. Playwright disables the HTTP cache while a context has
// any route(), so the harness's production-abort route is removed and production is refused by a fetch guard in every frame
// plus a request watcher that kills the run on any production request.
// Output: audits/evidence/p2/STAB/verify2-deploy-<cc>[-fix][-reload][-expire].json (+ a 1x toast PNG)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CC = arg('--cc', 'max-age=600');
const FIX = process.argv.includes('--fix');
const RELOAD = process.argv.includes('--reload');
const EXPIRE = process.argv.includes('--expire');
const SFX = CC.replace(/[^a-z0-9]+/gi, '') + (FIX ? '-fix' : '') + (RELOAD ? '-reload' : '') + (EXPIRE ? '-expire' : '');
const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const OV = path.join(ROOT, 'audits/tools/phase2/STAB/overlay-verify2-deploy');

// ── the "deploy": copies of the working tree with a marker each, VERSION bumped ──
fs.rmSync(OV, { recursive: true, force: true });
fs.mkdirSync(path.join(OV, 'apps'), { recursive: true });
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let sw = src('sw.js');
const oldVersion = sw.match(/const VERSION = '([^']+)'/)[1]; const newVersion = oldVersion + '-verify2';
sw = sw.replace(`const VERSION = '${oldVersion}'`, `const VERSION = '${newVersion}'`);
if (FIX) {
  const before = 'SHELL.map(u => c.add(u))';
  if (!sw.includes(before)) throw new Error('sw.js install line changed; update the --fix arm');
  sw = sw.replace(before, "SHELL.map(u => c.add(new Request(u, { cache: 'reload' })))");
}
fs.writeFileSync(path.join(OV, 'sw.js'), sw);
fs.writeFileSync(path.join(OV, 'index.html'), src('index.html').replace('<head>', `<head><script>window.__v2shell = true;</script>`));
fs.writeFileSync(path.join(OV, 'apps/hub.js'), src('apps/hub.js') + `\n;window.__v2hub = true;\n`);

const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium', siteCacheControl: CC });
const R = { cc: CC, fix: FIX, reopenBy: RELOAD ? 'page.reload()' : 'about:blank → index.html#home', oldVersion, newVersion, steps: [] };
const PROD = 'house-hub-api.catalystfarm1.workers.dev';
let prodSeen = 0;
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', sw: true, fixedTime: false });
  await d.ctx.unrouteAll({ behavior: 'wait' });             // HTTP cache back on (Playwright disables it under route())
  await d.ctx.addInitScript(host => { const f = window.fetch; window.fetch = function (u, o) { if (String(u && u.url || u).includes(host)) return Promise.reject(new TypeError('blocked: production')); return f.call(this, u, o); }; }, PROD);
  d.ctx.on('request', r => { if (r.url().includes(PROD)) { prodSeen++; console.error('PRODUCTION REQUEST — aborting', r.url()); process.exit(2); } });
  await d.ctx.addInitScript(() => {                          // record every "Hub updated" toast that appears in the shell
    window.__toastSeen = [];
    if (window.top !== window) return;
    const mo = new MutationObserver(() => { const t = document.body && document.body.innerText || ''; if (/Hub updated/.test(t) && !window.__toastSeen.length) window.__toastSeen.push(t.match(/Hub updated[^\n]*/)[0]); });
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { childList: true, subtree: true, characterData: true }));
  });
  const state = async label => {
    const s = await d.page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const ver = async (c, key, marker) => { const r = await c.match(key); if (!r) return null; return (await r.text()).includes(marker) ? 'v2' : 'v1'; };
      const caches_ = {};
      for (const n of await caches.keys()) { const c = await caches.open(n); caches_[n] = { 'index.html': await ver(c, 'index.html', '__v2shell'), 'apps/hub.js': await ver(c, 'apps/hub.js', '__v2hub') }; }
      return { controller: !!navigator.serviceWorker.controller, waiting: !!(reg && reg.waiting), installing: !!(reg && reg.installing),
        caches: caches_, runningShell: window.__v2shell ? 'v2' : 'v1', runningHub: window.__v2hub ? 'v2' : 'v1', toast: (window.__toastSeen || []).slice() };
    });
    R.steps.push({ step: label, ...s }); console.log(label.padEnd(44), JSON.stringify(s));
    return s;
  };
  const reopen = async () => {
    if (RELOAD) await d.page.reload({ waitUntil: 'load' }); else { await d.page.goto('about:blank'); await d.goto('#home'); }
    await d.page.waitForSelector('#view-home .card', { timeout: 15000 }).catch(() => {});
  };
  const settleSW = async () => { for (let i = 0; i < 80; i++) { const busy = await d.page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && (r.installing || r.waiting)); }); if (!busy) break; await sleep(250); } };

  // 1. the device has the hub open (v1), SW installed and in control
  await d.goto('#home'); await d.page.waitForSelector('#view-home .card');
  await d.page.evaluate(() => navigator.serviceWorker.ready);
  for (let i = 0; i < 50 && !(await d.page.evaluate(() => !!navigator.serviceWorker.controller)); i++) await sleep(100);
  await sleep(1500);
  await state('1 before the deploy');
  // 2. Eli deploys (sw.js VERSION bumped, index.html + hub.js changed)
  await L.overlay(path.relative(ROOT, OV));
  R.deployedAt = new Date().toISOString();
  await sleep(2000);
  // 3. the device re-opens the hub: the navigation triggers the browser's update check; the new SW installs + activates
  await reopen();
  for (let i = 0; i < 60 && !(await d.page.evaluate(() => (window.__toastSeen || []).length)); i++) await sleep(100);
  await d.page.screenshot({ path: path.join(OUT, `verify2-deploy-${SFX}-toast.png`), scale: 'css' });
  await settleSW(); await sleep(1500);
  await state('3 re-open #1 (update check → new SW)');
  // 4. "next time it opens"
  for (const n of [2, 3]) { await reopen(); await sleep(2000); await state(`4.${n} re-open #${n}`); }
  if (EXPIRE) {
    const ms = +CC.match(/max-age=(\d+)/)[1] * 1000 + 3000;
    console.log(`waiting ${ms / 1000} s for max-age to run out…`); await sleep(ms);
    for (const n of [4, 5]) { await reopen(); await sleep(2000); await state(`5.${n} re-open #${n} after max-age ran out`); }
  }
  R.prodRequests = prodSeen;
  R.pageErrors = d.logs.filter(l => /pageerror/.test(l)).slice(0, 5);
  fs.writeFileSync(path.join(OUT, `verify2-deploy-${SFX}.json`), JSON.stringify(R, null, 1));
  console.log('wrote', path.join('audits/evidence/p2/STAB', `verify2-deploy-${SFX}.json`));
} finally {
  await L.close();
  fs.rmSync(OV, { recursive: true, force: true });           // the overlay is a working copy of the app: never leave it on disk
}
