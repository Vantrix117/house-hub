// Skeptic #2 for "build-guide-offline-blank": offline, a build guide that was never opened online shows the service
// worker's bare 503 "Offline" in the dark viewer. Independent re-run on a fresh local instance.
//   node "audits/tools/phase2/PWA/verify-build-guide-offline-blank-2.mjs"
// A  Chromium, OS light: warm the SW (precache), confirm apps/dollywood.html is NOT cached, go offline, cold-open the
//    hub, open the build guide → what the frame holds, its colours vs the viewer, a screenshot.
// B  Chromium, OS dark: same as A (does the colour-scheme change what is readable?).
// C  Chromium, OS light, control: open the build guide ONCE online first, then offline cold start → does it open?
// D  WebKit, OS light: warm page, go offline in-page, open the build guide via the hash (no page navigation, which
//    Playwright WebKit cannot serve offline) → same probes.
// Evidence: audits/evidence/p2/PWA/verify-build-guide-offline-blank-2.json + -*.png (1× css).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const TAG = 'verify-build-guide-offline-blank-2';
const out = {};
const waitFor = async (page, fn, arg, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await page.evaluate(fn, arg)) return true; } catch {} await sleep(250); } return false; };
const cacheHas = page => page.evaluate(async () => { const ks = await caches.keys(); const r = { caches: {}, dollywood: false, dollywoodLive: false }; for (const k of ks) { const c = await caches.open(k); const keys = (await c.keys()).map(q => new URL(q.url).pathname); r.caches[k] = keys.length; if (keys.some(p => p.endsWith('/apps/dollywood.html'))) r.dollywood = true; if (keys.some(p => p.endsWith('/apps/dollywood-live.html'))) r.dollywoodLive = true; } return r; });

// what the build-guide frame shows, and its colours against the viewer behind it
async function probeFrame(d) {
  const page = d.page;
  const until = Date.now() + 10000; let f = null;
  while (Date.now() < until && !f) { f = page.frames().find(x => x.url().includes('/apps/dollywood.html')); if (!f) await sleep(100); }
  if (!f) return { frame: 'not found' };
  await f.waitForLoadState('domcontentloaded').catch(() => {});
  await sleep(2500);
  const inner = await f.evaluate(() => {
    const el = document.querySelector('pre') || document.body;
    const cs = el ? getComputedStyle(el) : null; const bcs = document.body ? getComputedStyle(document.body) : null; const hcs = getComputedStyle(document.documentElement);
    return { contentType: document.contentType, text: (document.body ? document.body.innerText : '').slice(0, 100).replace(/\s+/g, ' '), textEl: el && el.tagName, textColor: cs && cs.color, fontFamily: cs && cs.fontFamily, fontSize: cs && cs.fontSize, bodyBg: bcs && bcs.backgroundColor, htmlBg: hcs.backgroundColor, htmlColorScheme: hcs.colorScheme, hasHubJs: !!window.hub, childCount: document.body ? document.body.querySelectorAll('*').length : 0 };
  }).catch(e => ({ evalError: e.message.split('\n')[0] }));
  const outer = await page.evaluate(() => { const v = document.getElementById('viewer'); const fr = document.getElementById('frame'); return { viewerDark: v.classList.contains('dark'), viewerBg: getComputedStyle(v).backgroundColor, frameBg: getComputedStyle(fr).backgroundColor, frameColorScheme: getComputedStyle(fr).colorScheme, pillLabel: document.getElementById('pill-label').textContent, osDark: matchMedia('(prefers-color-scheme: dark)').matches, anyShellMessage: [...document.querySelectorAll('#viewer *')].filter(e => /offline|connect|online/i.test(e.textContent || '') && !e.children.length && e.id !== 'frame').map(e => e.textContent.trim()).slice(0, 5) }; });
  // pixel check: sample the rendered region where the word sits and a blank region
  return { inner, outer };
}

async function chromiumCold(mode, openOnlineFirst, label) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  try {
    const d = await L.device({ device: 'iphone-pwa', mode, profile: 'eli', sw: true });
    await d.goto('#home');
    const controlled = await waitFor(d.page, () => !!navigator.serviceWorker.controller);
    await waitFor(d.page, async () => { const ks = await caches.keys(); if (!ks.length) return false; return (await (await caches.open(ks[0])).keys()).length >= 60; });
    let onlineOpen = null;
    if (openOnlineFirst) { const f = await d.openApp('dollywood'); await sleep(4000); onlineOpen = await f.evaluate(() => ({ text: document.body.innerText.slice(0, 60).replace(/\s+/g, ' '), hasHubJs: !!window.hub })).catch(e => e.message); await d.goto('#home'); await sleep(1000); }
    const before = await cacheHas(d.page);
    await d.ctx.setOffline(true); await d.setOffline(true);
    await d.page.goto('about:blank');
    let navErr = null; try { await d.goto('#home'); } catch (e) { navErr = e.message.split('\n')[0]; }
    await sleep(2000);
    const shellUp = await d.page.evaluate(() => ({ shellVisible: !!document.getElementById('shell') && !document.getElementById('shell').hidden, swControlled: !!navigator.serviceWorker.controller })).catch(e => e.message);
    // the Apps tab: does the build-guide tile say anything about being unavailable offline?
    await d.page.evaluate(() => { location.hash = '#apps'; }); await sleep(800);
    const tile = await d.page.evaluate(() => { const t = document.querySelector('.tile[data-id="dollywood"]'); return t ? { text: t.innerText.replace(/\s+/g, ' '), disabled: t.disabled, aria: t.getAttribute('aria-label') } : null; });
    await d.page.evaluate(() => { location.hash = '#dollywood'; });
    const probe = await probeFrame(d);
    const shot = path.join(OUT, `${TAG}-${label}.png`);
    await d.page.screenshot({ path: shot, scale: 'css' });
    const r = { engine: 'chromium', mode, openOnlineFirst, swControlledAfterWarm: controlled, onlineOpen, cacheBeforeOffline: before, navErr, shellUp, appsTile: tile, ...probe, shot: path.relative(ROOT, shot).replace(/\\/g, '/') };
    return r;
  } finally { await L.close(); }
}

async function webkitInPage(mode, label) {
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  try {
    const d = await L.device({ device: 'iphone-pwa', mode, profile: 'eli', sw: true });
    await d.goto('#home');
    const controlled = await waitFor(d.page, () => !!(navigator.serviceWorker && navigator.serviceWorker.controller), null, 15000);
    let precached = false;
    if (controlled) precached = await waitFor(d.page, async () => { const ks = await caches.keys(); if (!ks.length) return false; return (await (await caches.open(ks[0])).keys()).length >= 60; });
    if (controlled) { await d.goto('#home'); await sleep(1000); }
    const before = await cacheHas(d.page).catch(e => e.message);
    await d.ctx.setOffline(true); await d.setOffline(true);
    await d.page.evaluate(() => { location.hash = '#dollywood'; });
    const probe = await probeFrame(d);
    const shot = path.join(OUT, `${TAG}-${label}.png`);
    await d.page.screenshot({ path: shot, scale: 'css' });
    return { engine: 'webkit', mode, swControlled: controlled, precached, cacheBeforeOffline: before, ...probe, shot: path.relative(ROOT, shot).replace(/\\/g, '/') };
  } finally { await L.close(); }
}

const run = async (k, fn) => { try { out[k] = await fn(); } catch (e) { out[k] = { error: e.message.split('\n').slice(0, 3).join(' | ') }; } console.log('\n== ' + k + '\n' + JSON.stringify(out[k], null, 1)); };
try {
  await run('A chromium light, never opened online', () => chromiumCold('light', false, 'A-chromium-light-never-opened'));
  await run('B chromium dark, never opened online', () => chromiumCold('dark', false, 'B-chromium-dark-never-opened'));
  await run('C chromium light, opened once online first', () => chromiumCold('light', true, 'C-chromium-light-opened-once'));
  await run('D webkit light, in-page open offline', () => webkitInPage('light', 'D-webkit-light-in-page'));
} finally {
  fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('\nwrote ' + TAG + '.json');
}
