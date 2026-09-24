// Phase 2 / PWA — the service worker at runtime: first-visit toast, offline cold start, and how a new deploy reaches an
// always-open device. Uses the rig's local instance only (the live site is never loaded in a browser).
//   node "audits/tools/phase2/PWA/sw.mjs"            (all sections)   ·   --only s1|s2|s3
// S1 "Hub updated" on a brand-new install: 4 fresh installs each in Chromium and WebKit; counts the toast.
// S2 offline cold start (Chromium — Playwright WebKit cannot serve an offline navigation from a service worker):
//    warm once, go offline (context offline + navigator.onLine false), open the hub cold, then open a precached app,
//    the build guide (not precached) and the park map (precached).
// S3 a deploy reaching an always-open iPad (Chromium), four runs: max-age=600 (what GitHub Pages sends — see
//    manifest-run.json → live) in a Chrome with the HTTP cache on; max-age=20 the same, with the cold opens 25 s later;
//    and max-age=600 / no-cache in the harness's routed context (HTTP cache off — Playwright disables it there):
//    a) VERSION bump + a changed index.html (overlay) → update check → does the open page reload? what does the new
//       cache hold? what do the next two cold opens show?
//    b) a changed index.html without a VERSION bump → the next two cold opens.
// Overlays (the "deploys") are generated under audits/tools/phase2/PWA/overlay-*/ from the current files and deleted at
// the end (a copy of index.html under audits/ would otherwise be published by GitHub Pages as a second live hub).
// Evidence: audits/evidence/p2/PWA/sw-run.json and sw-*.png (1× css).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : null; })();
const log = {};
const say = (k, v) => { log[k] = v; console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); };
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

// ── overlays: a VERSION-bumped deploy and a no-bump deploy ───────────────────────
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const VERSION = /const VERSION = '([^']+)'/.exec(swSrc)[1];
const mkOverlay = (name, marker, bump) => {
  const dir = path.join(HERE, name); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), idx.replace('<head>', `<head>\n<meta name="audit-build" content="${marker}">`));
  if (bump) fs.writeFileSync(path.join(dir, 'sw.js'), swSrc.replace(`const VERSION = '${VERSION}'`, `const VERSION = '${VERSION}-audit'`));
  return rel(dir);
};
const OV_BUMP = mkOverlay('overlay-bump', 'deploy-with-version-bump', true);
const OV_NOBUMP = mkOverlay('overlay-nobump', 'deploy-without-bump', false);

// Records every toast the shell shows (hub.toast writes #hub-toast).
const toastSpy = () => {
  window.__toasts = [];
  const seen = new Set();
  new MutationObserver(() => { const t = document.getElementById('hub-toast'); if (t && !t.hidden && t.textContent && !seen.has(t.textContent)) { seen.add(t.textContent); window.__toasts.push(t.textContent); } })
    .observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
};
const waitFor = async (page, fn, arg, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await page.evaluate(fn, arg)) return true; } catch {} await sleep(200); } return false; };
const cacheState = page => page.evaluate(async () => { const keys = await caches.keys(); const out = {}; for (const k of keys) out[k] = (await (await caches.open(k)).keys()).length; return out; });
const coldOpen = async (d, hash = '#home') => { await d.page.goto('about:blank'); await d.goto(hash); await sleep(1500); return d.page.evaluate(() => { const m = document.querySelector('meta[name="audit-build"]'); return m ? m.content : '(original index.html)'; }); };

async function s1() {
  const res = {};
  for (const engine of ['chromium', 'webkit']) {
    const L = await local({ variant: 'typical', clock: 'demo', engine });
    try {
      res[engine] = [];
      for (let i = 0; i < 4; i++) {
        const d = await L.device({ device: 'ipad-portrait', profile: 'eli', sw: true });
        await d.ctx.addInitScript(toastSpy);
        await d.goto('#home');
        const controlled = await waitFor(d.page, () => !!navigator.serviceWorker.controller, null, 12000);
        await sleep(1500);
        res[engine].push({ controlled, toasts: await d.page.evaluate(() => window.__toasts) });
        await d.close();
      }
    } finally { await L.close(); }
  }
  say('S1 first visit: toasts seen on a brand-new install', res);
}

async function s2() {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  try {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', sw: true });
    await d.goto('#home');
    await waitFor(d.page, () => !!navigator.serviceWorker.controller);
    await waitFor(d.page, async () => { const c = await caches.open((await caches.keys())[0] || 'x'); return (await c.keys()).length >= 60; });
    await coldOpen(d);                                           // a second, controlled open (apps.json now cached too)
    const warm = await cacheState(d.page);
    await d.ctx.setOffline(true); await d.setOffline(true);
    const probe = await d.page.evaluate(async () => { const r = await fetch('apps/dollywood.html', { cache: 'no-store' }).catch(e => ({ status: 'threw ' + e.message })); return r.status; });
    await d.page.goto('about:blank');
    let err = null; try { await d.goto('#home'); } catch (e) { err = e.message.split('\n')[0]; }
    await sleep(2500);
    const home = await d.page.evaluate(() => ({ shellVisible: !document.getElementById('shell').hidden, homeText: (document.getElementById('view-home').innerText || '').slice(0, 160).replace(/\s+/g, ' '), apps: (JSON.parse(localStorage.getItem('hub.registry') || '{}').apps || []).length, onLine: navigator.onLine, sync: window.hub && hub.sync.state }));
    await d.page.screenshot({ path: path.join(OUT, 'sw-offline-cold-home-iphone-pwa-light.png'), scale: 'css' });
    const openOffline = async id => {
      let f = null, e2 = null; try { f = await d.openApp(id); await sleep(2500); } catch (e) { e2 = e.message.split('\n')[0]; }
      const text = f ? await f.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 80).replace(/\s+/g, ' ')).catch(e => 'eval failed: ' + e.message.split('\n')[0]) : null;
      const shot = path.join(OUT, `sw-offline-${id}-iphone-pwa-light.png`); await d.page.screenshot({ path: shot, scale: 'css' });
      return { error: e2, firstText: text, shot: rel(shot) };
    };
    say('S2 offline cold start (Chromium, service worker on)', { warmCaches: warm, swFetchOfNonPrecachedPageWhileOffline: probe, navError: err, home, homeShot: 'audits/evidence/p2/PWA/sw-offline-cold-home-iphone-pwa-light.png', leftovers: await openOffline('leftovers'), dollywood: await openOffline('dollywood'), 'dollywood-live': await openOffline('dollywood-live') });
  } finally { await L.close(); }
}

// Playwright turns the HTTP cache off in any context that has a route, and the harness always routes the production API
// away. To see what max-age=600 does, one run uses its own Chrome with no routes; production is made unreachable there by
// DNS (--host-resolver-rules) instead, and the page is pointed at the rig's API before any script runs, as the harness does.
async function ownChrome(L) {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const browser = await L.pw.chromium.launch({ executablePath: exe, headless: true, args: ['--host-resolver-rules=MAP house-hub-api.catalystfarm1.workers.dev 127.0.0.1:9, MAP queue-times.com 127.0.0.1:9, MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9'] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'allow', timezoneId: 'America/New_York', locale: 'en-US' });
  await ctx.addInitScript(c => { try { if (location.origin === c.site && !localStorage.getItem('rig.init')) { localStorage.clear(); localStorage.setItem('hub.api', JSON.stringify(c.api)); localStorage.setItem('hub.device', JSON.stringify(c.device)); localStorage.setItem('hub.session', JSON.stringify(c.session)); localStorage.setItem('hub.profiles', JSON.stringify(c.profiles)); localStorage.setItem('hub.lastProfile', JSON.stringify('eli')); localStorage.setItem('rig.init', '1'); } } catch {} },
    { site: L.site, api: L.api, device: L.S.info.device, session: L.S.sessions.eli, profiles: L.S.profiles });
  const page = await ctx.newPage();
  return { ctx, page, goto: async (hash = '') => { await page.goto(L.site + '/index.html' + hash, { waitUntil: 'load' }); }, close: () => browser.close() };
}

async function s3(cc, own = false, waitMs = 0) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium', siteCacheControl: cc });
  const r = { cacheControl: cc, waitBeforeColdOpensMs: waitMs, httpCache: own ? 'on (own Chrome, no routes)' : 'off (Playwright disables it in routed contexts)' };
  let d;
  try {
    d = own ? await ownChrome(L) : await L.device({ device: 'ipad-landscape', profile: 'eli', sw: true, fixedTime: false });
    await d.ctx.addInitScript(toastSpy);
    await d.goto('#home');
    await waitFor(d.page, () => !!navigator.serviceWorker.controller);
    await waitFor(d.page, async () => (await (await caches.open((await caches.keys())[0] || 'x')).keys()).length >= 60);
    await coldOpen(d);
    await d.page.evaluate(() => { window.__marker = 'loaded before the deploy'; window.__cc = 0; navigator.serviceWorker.addEventListener('controllerchange', () => window.__cc++); });
    // a) deploy with a VERSION bump
    await L.overlay(OV_BUMP);
    await d.page.evaluate(() => navigator.serviceWorker.getRegistration().then(x => x.update()));
    const activated = await waitFor(d.page, v => caches.keys().then(k => k.includes(v)), VERSION + '-audit', 20000);
    await sleep(2000);
    const v2 = VERSION + '-audit';
    r.bump = {
      newCacheActive: activated,
      openPage: await d.page.evaluate(() => ({ stillTheSamePage: window.__marker === 'loaded before the deploy', controllerchangeEvents: window.__cc, toasts: window.__toasts, runningBuild: (document.querySelector('meta[name="audit-build"]') || {}).content || '(original index.html)' })),
      caches: await cacheState(d.page),
      newCacheIndexHtml: await d.page.evaluate(async v => { const m = await (await caches.open(v)).match('index.html'); const t = m ? await m.text() : ''; return t.includes('audit-build') ? 'deployed index.html' : m ? 'OLD index.html' : 'missing'; }, v2),
    };
    if (waitMs) await sleep(waitMs);
    r.bump.coldOpen1 = await coldOpen(d);
    r.bump.coldOpen2 = await coldOpen(d);
    // b) the next deploy without a VERSION bump
    await L.overlay(OV_NOBUMP);
    r.noBump = { coldOpen1: await coldOpen(d), coldOpen2: await coldOpen(d), coldOpen3: await coldOpen(d) };
  } finally { if (own && d) await d.close(); await L.close(); }
  return r;
}

try {
  if (!only || only === 's1') await s1();
  if (!only || only === 's2') await s2();
  if (!only || only === 's3') say('S3 a deploy reaching an open iPad (Chromium)', [await s3('max-age=600', true), await s3('max-age=20', true, 25000), await s3('max-age=600'), await s3('no-cache')]);
} finally {
  fs.writeFileSync(path.join(OUT, only ? `sw-run-${only}.json` : 'sw-run.json'), JSON.stringify(log, null, 1));
  for (const o of [OV_BUMP, OV_NOBUMP]) fs.rmSync(path.join(ROOT, o), { recursive: true, force: true });
  console.log('\nwrote evidence json');
}
