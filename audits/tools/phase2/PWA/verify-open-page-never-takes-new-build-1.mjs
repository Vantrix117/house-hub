// Skeptic #1 for finding "open-page-never-takes-new-build".
//   node "audits/tools/phase2/PWA/verify-open-page-never-takes-new-build-1.mjs"
// Independent of sw.mjs. Chromium (Playwright WebKit cannot run the service worker reliably), local rig only.
// A "deploy" = an overlay folder with: index.html carrying <meta name="audit-build">, apps/hub.js that sets
// window.__auditHubBuild, and sw.js with VERSION bumped. The overlay is deleted at the end.
//
// A  Kitchen iPad, Eli, Home open. Deploy. Trigger the update the way the household would: open an app (an iframe
//    navigation, which makes the browser check sw.js) — no manual reg.update() unless that fails. Then:
//      is it the same page (timeOrigin + a window marker)? how many controllerchange events? which index.html and
//      hub.js is the shell running? which hub.js does a freshly opened app iframe get? Wait 45 s more (longer than
//      the 30 s pull), check again. Finally a cold open (a real navigation) to show the new build was there all along.
// B  TV, kiosk profile, Home open, no app ever opened. Deploy, wait 45 s: does the browser even notice the new worker?
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const V1 = /const VERSION = '([^']+)'/.exec(swSrc)[1];
const V2 = V1 + '-skeptic';
const OV = path.join(HERE, 'overlay-skeptic1');
fs.mkdirSync(path.join(OV, 'apps'), { recursive: true });
fs.writeFileSync(path.join(OV, 'index.html'), fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace('<head>', '<head>\n<meta name="audit-build" content="deployed">'));
fs.writeFileSync(path.join(OV, 'apps/hub.js'), fs.readFileSync(path.join(ROOT, 'apps/hub.js'), 'utf8') + '\n;window.__auditHubBuild = "deployed";\n');
fs.writeFileSync(path.join(OV, 'sw.js'), swSrc.replace(`const VERSION = '${V1}'`, `const VERSION = '${V2}'`));

const waitFor = async (page, fn, arg, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await page.evaluate(fn, arg)) return true; } catch {} await sleep(250); } return false; };
const arm = page => page.evaluate(() => {
  window.__marker = 'before-deploy'; window.__cc = []; window.__toastsSeen = [];
  navigator.serviceWorker.addEventListener('controllerchange', () => window.__cc.push(new Date().toISOString()));
  new MutationObserver(() => { const t = document.getElementById('hub-toast'); if (t && !t.hidden && t.textContent && !window.__toastsSeen.includes(t.textContent)) window.__toastsSeen.push(t.textContent); })
    .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  return performance.timeOrigin;
});
const state = page => page.evaluate(async () => ({
  timeOrigin: performance.timeOrigin,
  marker: window.__marker || null,
  controllerchange: window.__cc || null,
  toasts: window.__toastsSeen || null,
  shellIndexHtml: document.querySelector('meta[name="audit-build"]') ? 'deployed' : 'original',
  shellHubJs: window.__auditHubBuild || 'original',
  activeWorkerScript: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL,
  caches: await caches.keys(),
}));
const frameHub = async (page, id) => { const f = page.frames().find(f => f.url().includes(`/apps/${id}.html`)); return f ? f.evaluate(() => window.__auditHubBuild || 'original').catch(e => 'err ' + e.message) : 'no frame'; };

const out = { version: { before: V1, deployed: V2 } };
let L;
try {
  // ── A: Kitchen iPad ──
  L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  const d = await L.device({ device: 'ipad-landscape', profile: 'eli', sw: true, fixedTime: false });
  await d.goto('#home');
  await waitFor(d.page, () => !!navigator.serviceWorker.controller);
  await waitFor(d.page, v => caches.open(v).then(c => c.keys()).then(k => k.length >= 60), V1, 20000);
  await d.goto('#home');                                   // a controlled load, like the iPad after its first day
  await sleep(1500);
  const origin = await arm(d.page);
  const A = { before: await state(d.page) };
  await L.overlay(rel(OV));                                // the deploy
  // household path: open an app (iframe navigation → the browser checks sw.js)
  await d.page.evaluate(() => { location.hash = '#tally'; });
  await sleep(1500);
  let detected = await waitFor(d.page, v => caches.keys().then(k => k.includes(v)), V2, 20000);
  A.updateTrigger = detected ? 'opening an app (iframe navigation), no manual update()' : 'manual reg.update() (the app open did not trigger it)';
  if (!detected) { await d.page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update())); detected = await waitFor(d.page, v => caches.keys().then(k => k.includes(v)), V2, 20000); }
  await waitFor(d.page, () => (window.__cc || []).length > 0, null, 5000);
  await sleep(1500);
  A.newWorkerActive = detected;
  A.afterUpdate = await state(d.page);
  A.firstAppFrameHubJs = await frameHub(d.page, 'tally');
  // close the viewer and open another app: a fresh iframe load after the takeover
  await d.page.evaluate(() => { location.hash = '#home'; }); await sleep(800);
  await d.page.evaluate(() => { location.hash = '#timer'; }); await sleep(2500);
  A.nextAppFrameHubJs = await frameHub(d.page, 'timer');
  await d.page.evaluate(() => { location.hash = '#home'; });
  await sleep(45000);                                      // longer than the 30 s pull cycle
  A.after45s = await state(d.page);
  A.samePageThroughout = A.after45s.timeOrigin === origin && A.after45s.marker === 'before-deploy';
  await d.page.goto('about:blank'); await d.goto('#home'); await sleep(1500);   // a real reopen (a new document, not a same-page hash change)
  A.afterColdOpen = await state(d.page);
  out.A_kitchenIpad = A;
  await L.close(); L = null;

  // ── B: TV kiosk, no app ever opened ──
  L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  const tv = await L.device({ device: 'tv', profile: 'tv', sw: true, fixedTime: false });
  await tv.goto('#home');
  await waitFor(tv.page, () => !!navigator.serviceWorker.controller);
  await waitFor(tv.page, v => caches.open(v).then(c => c.keys()).then(k => k.length >= 60), V1, 20000);
  await tv.goto('#home'); await sleep(1500);
  const tvOrigin = await arm(tv.page);
  const B = { before: await state(tv.page), kind: await tv.page.evaluate(() => document.documentElement.dataset.kind) };
  await L.overlay(rel(OV));
  await sleep(45000);
  B.after45sNoAppOpened = await state(tv.page);
  B.newWorkerNoticed = B.after45sNoAppOpened.caches.includes(V2);
  B.samePage = B.after45sNoAppOpened.timeOrigin === tvOrigin;
  // even when an update check does happen (forced here), the board keeps its code
  await tv.page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  await waitFor(tv.page, v => caches.keys().then(k => k.includes(v)), V2, 20000);
  await waitFor(tv.page, () => (window.__cc || []).length > 0, null, 5000);
  await sleep(1500);
  B.afterForcedUpdate = await state(tv.page);
  out.B_tvKiosk = B;
} finally {
  if (L) await L.close();
  fs.rmSync(OV, { recursive: true, force: true });
  fs.writeFileSync(path.join(OUT, 'verify-open-page-never-takes-new-build-1.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}
