// Phase 2 / PWA — skeptic #1 for finding "deploy-invisible-within-max-age":
//   "With GitHub Pages' max-age=600, a VERSION-bump deploy precaches the old files; 'Hub updated' shows but the old
//    build keeps loading."
// Independent re-run, written from scratch (does not reuse sw.mjs). Local instance only.
//
//   node "audits/tools/phase2/PWA/verify-deploy-invisible-within-max-age-1.mjs"             (all arms)
//   node "audits/tools/phase2/PWA/verify-deploy-invisible-within-max-age-1.mjs" --only A    (one arm)
//
// Why a separate browser: the harness routes the production API away in every context, and Playwright turns the HTTP
// cache off in any routed context — so an L.device() can never show HTTP-cache effects. Each arm here launches its own
// browser with NO routes (HTTP cache on); everything that is not localhost goes to a dead proxy (127.0.0.1:9), so
// production is unreachable. The page is pointed at the rig's API before any script runs (as the harness does).
//
// Deploy arms (service worker on, the rig's site served with the given Cache-Control):
//   A chromium max-age=600          — the live GitHub Pages header (curl -sI https://vantrix117.github.io/house-hub/index.html)
//   B chromium no-cache             — control: same browser setup, only the header differs
//   C chromium max-age=600 + CDP Network.clearBrowserCache just before the deploy — control: is the HTTP cache the source?
//   D chromium max-age=20, cold opens start 25 s after the deploy — how long does the lag last?
//   N chromium max-age=600, the update found by a cold open (navigation), as it is in real use — no reg.update()
//   E webkit   max-age=600, ephemeral context (browser.newContext)
//   F webkit   no-cache,    ephemeral context
//   G webkit   max-age=600, persistent profile (launchPersistentContext) — WebKit keeps no HTTP disk cache for ephemeral
//              sessions, so E/F cannot show an HTTP-cache effect either way; G is the closer model of a Home Screen app
//   H webkit   no-cache,    persistent profile — control for G
//   (On this Windows rig G/H never get that far: a persistent WebKit profile's service worker stays 'installing' — the
//    precache fills ~1 entry/s and stalls at 36 of 70 — so the page load times out. Rig limitation, not the app.)
// Probe arms (service worker blocked): does this browser setup have an HTTP cache at all? fetch apps/hub.js, "deploy",
// fetch it again — OLD means the second fetch came from the HTTP cache.
//   P1 chromium ephemeral · P2 webkit ephemeral · P3 webkit persistent (all max-age=600)
// Each deploy arm: open → SW controls + precache filled → one controlled cold open → "deploy" (overlay: sw.js VERSION
// bumped, index.html + apps/hub.js carry a marker) → reg.update() → new cache active → record toasts, what the NEW cache
// holds, then cold opens (about:blank → index.html#home) and which build each one ran.
// The overlay is generated from the current files under this folder and deleted at the end.
// Evidence: audits/evidence/p2/PWA/verify-deploy-invisible-within-max-age-1.json (+ .txt of stdout).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : null; })();
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const idxSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const hubSrc = fs.readFileSync(path.join(ROOT, 'apps/hub.js'), 'utf8');
const VERSION = /const VERSION = '([^']+)'/.exec(swSrc)[1];
const V2 = VERSION + '-skeptic1';
const MARK = 'skeptic1-deploy';
const OV = path.join(HERE, 'verify-overlay-deploy-1');
fs.mkdirSync(path.join(OV, 'apps'), { recursive: true });
fs.writeFileSync(path.join(OV, 'sw.js'), swSrc.replace(`const VERSION = '${VERSION}'`, `const VERSION = '${V2}'`));
fs.writeFileSync(path.join(OV, 'index.html'), idxSrc.replace('<head>', `<head>\n<meta name="audit-build" content="${MARK}">`));
fs.writeFileSync(path.join(OV, 'apps/hub.js'), hubSrc + `\n;window.__auditHubBuild = '${MARK}';\n`);

const toastSpy = () => {
  window.__toasts = [];
  const seen = new Set();
  new MutationObserver(() => { const t = document.getElementById('hub-toast'); if (t && !t.hidden && t.textContent && !seen.has(t.textContent)) { seen.add(t.textContent); window.__toasts.push(t.textContent); } })
    .observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
};
const waitFor = async (page, fn, arg, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await page.evaluate(fn, arg)) return true; } catch {} await sleep(200); } return false; };
const build = page => page.evaluate(() => ({
  index: (document.querySelector('meta[name="audit-build"]') || {}).content || 'original',
  hubjs: window.__auditHubBuild || 'original',
}));

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
// Own browser, no routes (HTTP cache on); non-localhost traffic goes to a dead proxy. persistent: a real profile directory.
async function openBrowser(L, engine, { persistent = false, sw = true } = {}) {
  const launch = { headless: true, proxy: { server: 'http://127.0.0.1:9', bypass: 'localhost,127.0.0.1' }, ...(engine === 'chromium' ? { executablePath: CHROME } : {}) };
  const ctxOpts = { viewport: { width: 1180, height: 820 }, serviceWorkers: sw ? 'allow' : 'block', timezoneId: 'America/New_York', locale: 'en-US' };
  if (persistent) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-skeptic1-'));
    const ctx = await L.pw[engine].launchPersistentContext(dir, { ...launch, ...ctxOpts });
    return { ctx, close: async () => { await ctx.close().catch(() => {}); fs.rmSync(dir, { recursive: true, force: true }); } };
  }
  const b = await L.pw[engine].launch(launch);
  const ctx = await b.newContext(ctxOpts);
  return { ctx, close: () => b.close().catch(() => {}) };
}

async function probe(id, engine, cc, { persistent = false } = {}) {
  const L = await local({ variant: 'typical', clock: 'real', engine, siteCacheControl: cc });
  const r = { arm: id, kind: 'HTTP-cache probe, service worker blocked', engine, persistent, cacheControl: cc };
  let B;
  try {
    B = await openBrowser(L, engine, { persistent, sw: false });
    const page = B.ctx.pages()[0] || await B.ctx.newPage();
    await page.goto(L.site + '/manifest.json');
    const get = () => page.evaluate(m => fetch('apps/hub.js').then(x => x.text()).then(t => t.includes(m) ? 'DEPLOYED' : 'OLD'), MARK);
    r.beforeDeploy = await get();
    await L.overlay(rel(OV));
    r.afterDeploy = await get();
    r.httpCacheServedSecondFetch = r.afterDeploy === 'OLD';
  } catch (e) { r.error = e.message.split('\n')[0]; }
  finally { if (B) await B.close(); await L.overlay('').catch(() => {}); await L.close(); }
  console.log('\n== arm ' + id + '\n' + JSON.stringify(r, null, 1));
  return r;
}

async function arm(id, engine, cc, { clearHttpCache = false, waitMs = 0, opens = 2, persistent = false, viaNavigation = false } = {}) {
  const L = await local({ variant: 'typical', clock: 'real', engine, siteCacheControl: cc });
  const r = { arm: id, engine, persistent, cacheControl: cc, clearHttpCacheBeforeDeploy: clearHttpCache, waitBeforeColdOpensMs: waitMs, updateFoundBy: viaNavigation ? 'the next cold open (browser navigation check — the hub never calls reg.update())' : 'reg.update() on the open page' };
  let B;
  try {
    B = await openBrowser(L, engine, { persistent });
    const ctx = B.ctx;
    await ctx.addInitScript(c => { try { if (location.origin === c.site && !localStorage.getItem('rig.init')) { localStorage.clear(); localStorage.setItem('hub.api', JSON.stringify(c.api)); localStorage.setItem('hub.device', JSON.stringify(c.device)); localStorage.setItem('hub.session', JSON.stringify(c.session)); localStorage.setItem('hub.profiles', JSON.stringify(c.profiles)); localStorage.setItem('hub.lastProfile', JSON.stringify('eli')); localStorage.setItem('rig.init', '1'); } } catch {} },
      { site: L.site, api: L.api, device: L.S.info.device, session: L.S.sessions.eli, profiles: L.S.profiles });
    await ctx.addInitScript(toastSpy);
    const page = ctx.pages()[0] || await ctx.newPage();
    const goto = async () => { await page.goto('about:blank'); await page.goto(L.site + '/index.html#home', { waitUntil: 'load' }); await sleep(1500); return build(page); };
    await page.goto(L.site + '/index.html#home', { waitUntil: 'load' });
    r.controlled = await waitFor(page, () => !!navigator.serviceWorker.controller);
    r.precacheFilled = await waitFor(page, async () => (await (await caches.open((await caches.keys())[0] || 'x')).keys()).length >= 60);
    r.beforeDeploy = await goto();                                         // a controlled open (SW revalidates in the background)
    r.cachesBefore = await page.evaluate(() => caches.keys());
    await page.evaluate(() => { window.__sameDoc = 1; });
    if (clearHttpCache) { const s = await ctx.newCDPSession(page); await s.send('Network.clearBrowserCache'); r.httpCacheCleared = true; }
    // the deploy: VERSION bump + changed index.html + changed apps/hub.js
    await L.overlay(rel(OV));
    const tDeploy = Date.now();
    if (viaNavigation) { await page.goto('about:blank'); await page.goto(L.site + '/index.html#home', { waitUntil: 'load' }); await page.evaluate(() => { window.__sameDoc = 1; }); r.buildOfTheOpenThatFoundTheUpdate = await build(page); }
    else await page.evaluate(() => navigator.serviceWorker.getRegistration().then(x => x.update()));
    r.newCacheActive = await waitFor(page, v => caches.keys().then(k => k.length === 1 && k[0] === v), V2);
    await sleep(2000);
    r.cachesAfter = await page.evaluate(() => caches.keys());
    r.openPage = await page.evaluate(() => ({ sameDocument: window.__sameDoc === 1, toasts: window.__toasts }));
    r.newCacheHolds = await page.evaluate(async ([v, mark]) => {
      const c = await caches.open(v); const out = {};
      for (const k of ['index.html', './', 'apps/hub.js']) { const m = await c.match(k); out[k] = !m ? 'missing' : (await m.text()).includes(mark) ? 'DEPLOYED' : 'OLD'; }
      return out;
    }, [V2, MARK]);
    if (waitMs) await sleep(waitMs);
    r.coldOpensAfterDeploy = [];
    for (let i = 0; i < opens; i++) r.coldOpensAfterDeploy.push({ secondsAfterDeploy: Math.round((Date.now() - tDeploy) / 1000), ...(await goto()) });
    r.cacheAfterOpens = await page.evaluate(async ([v, mark]) => { const c = await caches.open(v); const m = await c.match('index.html'); return m ? ((await m.text()).includes(mark) ? 'DEPLOYED' : 'OLD') : 'missing'; }, [V2, MARK]);
  } catch (e) { r.error = e.message.split('\n')[0]; }
  finally { if (B) await B.close(); await L.close(); }
  console.log('\n== arm ' + id + '\n' + JSON.stringify(r, null, 1));
  return r;
}

const ARMS = {
  A: () => arm('A', 'chromium', 'max-age=600'),
  B: () => arm('B', 'chromium', 'no-cache'),
  C: () => arm('C', 'chromium', 'max-age=600', { clearHttpCache: true }),
  D: () => arm('D', 'chromium', 'max-age=20', { waitMs: 25000, opens: 3 }),
  N: () => arm('N', 'chromium', 'max-age=600', { viaNavigation: true, opens: 3 }),
  E: () => arm('E', 'webkit', 'max-age=600'),
  F: () => arm('F', 'webkit', 'no-cache'),
  G: () => arm('G', 'webkit', 'max-age=600', { persistent: true }),
  H: () => arm('H', 'webkit', 'no-cache', { persistent: true }),
  P1: () => probe('P1', 'chromium', 'max-age=600'),
  P2: () => probe('P2', 'webkit', 'max-age=600'),
  P3: () => probe('P3', 'webkit', 'max-age=600', { persistent: true }),
};
const results = [];
try {
  for (const [k, run] of Object.entries(ARMS)) if (!only || only.split(',').includes(k)) results.push(await run());
} finally {
  fs.rmSync(OV, { recursive: true, force: true });
  const file = path.join(OUT, `verify-deploy-invisible-within-max-age-1${only ? '-' + only.replace(/,/g, '') : ''}.json`);
  fs.writeFileSync(file, JSON.stringify({ ranAt: new Date().toISOString(), version: VERSION, deployedVersion: V2, results }, null, 1));
  console.log('\nwrote ' + rel(file));
}
