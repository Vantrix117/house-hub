// Phase 2 / PWA — skeptic #1 for "build-guide-offline-blank": offline, a build guide never opened online shows a bare
// 503 "Offline" in dark text on the dark viewer.
//   node "audits/tools/phase2/PWA/verify-build-guide-offline-blank-1.mjs"
// A  Chromium, service worker on, light: warm the hub (precache), never open the build guide, go truly offline
//    (context offline, so the SW's own fetch fails), cold-open the hub, open the build guide from the shell.
//    Records: is apps/dollywood.html in the cache, the frame's contentType/text/colours, the viewer background, contrast.
// B  the same in OS dark mode (does the plain-text page pick a light text colour there?).
// C  control: the same device flow, but the build guide is opened once online first → offline it should load for real.
// D  WebKit (the iPhone/iPad engine) cannot serve an offline navigation from a service worker in Playwright, so the SW's
//    fallback response is replayed with a route (status 503, body "Offline", the default text/plain;charset=UTF-8) —
//    this shows only how WebKit paints that response in the dark viewer, not the SW path itself.
// E  after a deploy: open the build guide online (cached on first use), then a deploy that bumps sw.js VERSION (overlay
//    generated here, deleted at the end) → update → is the build guide still cached? offline → what opens?
//    --only A|B|C|D|E runs one section; the JSON is written as -1.json (all) or -1-<X>.json.
// Evidence: audits/evidence/p2/PWA/verify-build-guide-offline-blank-1.json and -*.png (1× css).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const TAG = 'verify-build-guide-offline-blank-1';
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const log = {};
const say = (k, v) => { log[k] = v; console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); };
const waitFor = async (page, fn, arg, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await page.evaluate(fn, arg)) return true; } catch {} await sleep(250); } return false; };
const hasInCache = (page, p) => page.evaluate(async p => { for (const k of await caches.keys()) { const c = await caches.open(k); if (await c.match(p) || await c.match(p, { ignoreSearch: true })) return true; } return false; }, p);

// relative luminance contrast of two 'rgb(a)' strings (alpha ignored)
const lum = s => { const [r, g, b] = s.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };

async function inspect(d, f, shotName) {
  await sleep(2000);
  const frameInfo = await f.evaluate(() => {
    const pre = document.querySelector('pre');
    const el = pre || document.body;
    const cs = el ? getComputedStyle(el) : null;
    return {
      url: location.pathname, contentType: document.contentType, title: document.title,
      text: (document.body ? document.body.innerText : '').slice(0, 120).replace(/\s+/g, ' '),
      textColor: cs && cs.color, fontFamily: cs && cs.fontFamily, fontSize: cs && cs.fontSize,
      htmlBg: getComputedStyle(document.documentElement).backgroundColor, bodyBg: document.body && getComputedStyle(document.body).backgroundColor,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      navStatus: (performance.getEntriesByType('navigation')[0] || {}).responseStatus,
    };
  }).catch(e => ({ evalError: e.message.split('\n')[0] }));
  const shell = await d.page.evaluate(() => {
    const v = document.getElementById('viewer');
    return { viewerClass: v.className, viewerBg: getComputedStyle(v).backgroundColor, frameBg: getComputedStyle(document.getElementById('frame')).backgroundColor, pill: document.getElementById('pill-label').textContent, scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme };
  });
  const shot = path.join(OUT, `${TAG}-${shotName}.png`);
  await d.page.screenshot({ path: shot, scale: 'css' });
  let ratio = null;
  try { if (frameInfo.textColor && /^rgba?\(/.test(shell.viewerBg)) ratio = contrast(frameInfo.textColor, shell.viewerBg); } catch {}
  return { frame: frameInfo, shell, textVsViewerContrast: ratio, shot: rel(shot) };
}

async function swRun({ mode, openOnlineFirst }) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  try {
    const d = await L.device({ device: 'iphone-pwa', mode, profile: 'eli', sw: true });
    await d.goto('#home');
    const controlled = await waitFor(d.page, () => !!navigator.serviceWorker.controller);
    await waitFor(d.page, async () => { const k = await caches.keys(); if (!k.length) return false; return (await (await caches.open(k[0])).keys()).length >= 60; });
    await d.page.goto('about:blank'); await d.goto('#home'); await sleep(1500);   // a second, controlled open
    let onlineOpen = null;
    if (openOnlineFirst) {
      const f = await d.openApp('dollywood');
      await sleep(3000);
      onlineOpen = { text: await f.evaluate(() => document.body.innerText.slice(0, 80).replace(/\s+/g, ' ')).catch(e => e.message) };
      onlineOpen.cachedAfterOnlineOpen = await waitFor(d.page, () => caches.keys().then(async ks => { for (const k of ks) if (await (await caches.open(k)).match('apps/dollywood.html')) return true; return false; }), null, 20000);
    }
    const before = { controlled, cacheNames: await d.page.evaluate(() => caches.keys()), dollywoodHtmlCached: await hasInCache(d.page, 'apps/dollywood.html'), dollywoodLiveHtmlCached: await hasInCache(d.page, 'apps/dollywood-live.html') };
    await d.ctx.setOffline(true); await d.setOffline(true);
    await d.page.goto('about:blank');
    let navErr = null; try { await d.goto('#home'); } catch (e) { navErr = e.message.split('\n')[0]; }
    await sleep(2000);
    const coldHome = await d.page.evaluate(() => ({ shellVisible: !document.getElementById('shell').hidden, onLine: navigator.onLine, controlled: !!navigator.serviceWorker.controller }));
    const f = await d.openApp('dollywood');
    const got = await inspect(d, f, `chromium-${mode}${openOnlineFirst ? '-opened-online-first' : ''}`);
    return { before, onlineOpen, offlineColdStart: { navErr, ...coldHome }, buildGuideOffline: got };
  } finally { await L.close(); }
}

async function webkitReplay(mode) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  try {
    const d = await L.device({ device: 'iphone-pwa', mode, profile: 'eli' });
    await d.ctx.route(u => u.pathname.endsWith('/apps/dollywood.html'), r => r.fulfill({ status: 503, body: 'Offline', contentType: 'text/plain;charset=UTF-8' }));
    const f = await d.openApp('dollywood');
    return await inspect(d, f, `webkit-replay-${mode}`);
  } finally { await L.close(); }
}

async function afterDeploy() {
  const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const VERSION = /const VERSION = '([^']+)'/.exec(swSrc)[1];
  const ov = path.join(HERE, 'overlay-verify-bgob1'); fs.mkdirSync(ov, { recursive: true });
  fs.writeFileSync(path.join(ov, 'sw.js'), swSrc.replace(`const VERSION = '${VERSION}'`, `const VERSION = '${VERSION}-audit'`));
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  try {
    const d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli', sw: true });
    await d.goto('#home');
    await waitFor(d.page, () => !!navigator.serviceWorker.controller);
    await waitFor(d.page, async () => { const k = await caches.keys(); if (!k.length) return false; return (await (await caches.open(k[0])).keys()).length >= 60; });
    await d.page.goto('about:blank'); await d.goto('#home'); await sleep(1500);
    await d.openApp('dollywood'); await sleep(3000);
    const cachedBeforeDeploy = await waitFor(d.page, () => caches.keys().then(async ks => { for (const k of ks) if (await (await caches.open(k)).match('apps/dollywood.html')) return true; return false; }), null, 20000);
    await d.goto('#home'); await sleep(1000);
    await L.overlay(rel(ov));
    await d.page.evaluate(() => navigator.serviceWorker.getRegistration().then(x => x.update()));
    const newCacheActive = await waitFor(d.page, v => caches.keys().then(k => k.includes(v) && k.length === 1), VERSION + '-audit', 30000);
    await sleep(1500);
    const after = { cacheNames: await d.page.evaluate(() => caches.keys()), dollywoodHtmlCached: await hasInCache(d.page, 'apps/dollywood.html'), dollywoodLiveHtmlCached: await hasInCache(d.page, 'apps/dollywood-live.html') };
    await d.ctx.setOffline(true); await d.setOffline(true);
    await d.page.goto('about:blank'); await d.goto('#home'); await sleep(1500);
    const f = await d.openApp('dollywood');
    return { cachedBeforeDeploy, newCacheActive, afterDeploy: after, buildGuideOffline: await inspect(d, f, 'chromium-light-after-version-bump') };
  } finally { await L.close(); fs.rmSync(ov, { recursive: true, force: true }); }
}

const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : null; })();
const run = x => !only || only === x;
try {
  if (run('A')) say('A chromium light, build guide never opened', await swRun({ mode: 'light', openOnlineFirst: false }));
  if (run('B')) say('B chromium dark, build guide never opened', await swRun({ mode: 'dark', openOnlineFirst: false }));
  if (run('C')) say('C chromium light, build guide opened once online first (control)', await swRun({ mode: 'light', openOnlineFirst: true }));
  if (run('D')) say('D webkit light, SW fallback response replayed by route', await webkitReplay('light'));
  if (run('D')) say('D webkit dark, SW fallback response replayed by route', await webkitReplay('dark'));
  if (run('E')) say('E chromium light, build guide opened online, then a VERSION-bump deploy', await afterDeploy());
} finally {
  const out = path.join(OUT, only ? `${TAG}-${only}.json` : `${TAG}.json`);
  fs.writeFileSync(out, JSON.stringify(log, null, 1));
  console.log('\nwrote ' + rel(out));
}
