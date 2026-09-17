#!/usr/bin/env node
// Roadmap item 1 checks: park-map privacy. Kid/kiosk = view-only (no GPS, no broadcast, no web search);
// adults broadcast only after switching "Share my spot" on; the build guide is hidden from kids.
//   cd worker && npx wrangler dev --port 8787      (seeded local D1, pairing code set)
//   node scripts/test-dollywood.mjs <pairing-code>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = process.argv[2] || 'local-test-code';
const API = process.env.HUB_API || 'http://127.0.0.1:8787';
const SITE = 'http://localhost:8765';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); });
}).listen(8765);

let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, { timeout = 15000, every = 200, label = 'condition' } = {}) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); } throw new Error('timeout: ' + label); }
const errors = {};
async function ctx(browser, name) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, geolocation: { latitude: 35.789, longitude: -83.54 }, permissions: ['geolocation'] });
  // Count geolocation watches so we can prove they never start for a kid / never start on load for an adult.
  await c.addInitScript(api => {
    try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {}
    window.__geoCalls = 0;
    if (navigator.geolocation) { const w = navigator.geolocation.watchPosition.bind(navigator.geolocation); navigator.geolocation.watchPosition = (...a) => { window.__geoCalls++; return w(...a); }; }
  }, API);
  const page = await c.newPage(); errors[name] = [];
  page.on('pageerror', e => errors[name].push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/40[13]|429|ERR_INTERNET_DISCONNECTED/.test(m.text())) errors[name].push(m.text()); });   // the offline phase makes the API unreachable on purpose
  await page.goto(SITE + '/index.html'); await page.waitForSelector('#paircode'); await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); await page.waitForSelector('.pcard[data-id]');
  return page;
}
async function signIn(page, id, pin) {
  await page.click(`.pcard[data-id=${id}]`);
  if (pin) { await page.waitForSelector('#pad'); for (let k = 0; k < 2; k++) { for (const d of pin) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); await sleep(600); if (!(await page.isVisible('#pad'))) break; } }
  await page.waitForSelector('#shell:not([hidden])');
}
const frameOf = page => page.frame({ url: /apps\// });
async function openMap(page) {
  await page.click('.tab[data-tab=apps]'); await page.click('.tile[data-id="dollywood-live"]');
  await waitFor(() => { const f = frameOf(page); return f && f.url().includes('dollywood-live'); }, { label: 'map frame' });
  const f = frameOf(page);
  await f.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && document.getElementById('fam-list') && document.getElementById('fam-list').innerHTML.length > 0, null, { timeout: 40000 });
  await sleep(500); return f;
}

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## Ezra (kid): view-only');
    const K = await ctx(browser, 'K'); await signIn(K.page ? K.page : K, 'ezra');
    const kp = K;
    await kp.click('.tab[data-tab=apps]');
    const tiles = await kp.$$eval('.tile', els => els.map(e => e.dataset.id));
    ok(!tiles.includes('dollywood') && tiles.includes('dollywood-live'), 'kid sees the park map but not the build guide', tiles.join(','));
    const fk = await openMap(kp);
    ok(await fk.evaluate(() => VIEW_ONLY() === true), 'VIEW_ONLY for a kid');
    ok(await fk.evaluate(() => document.getElementById('loc-btn').hidden === true), 'Find-me button hidden');
    ok(await fk.evaluate(() => srch('Lightning Rod') === ''), 'no web-search box in ride popups');
    ok(await fk.evaluate(() => window.__geoCalls === 0), 'geolocation never started for a kid');
    ok(await fk.evaluate(() => !document.getElementById('lv-share')), 'no Share toggle for a kid');
    ok((await fk.textContent('#loc-acc')).includes('just looking'), 'status says "just looking"');
    await kp.screenshot({ path: path.join(ROOT, 'docs/screens/rm1-map-kid.png') });

    console.log('\n## Eli (adult): explicit sharing');
    const A = await ctx(browser, 'A'); await signIn(A, 'eli', '1357');
    const fa = await openMap(A);
    ok(await fa.evaluate(() => window.__geoCalls === 0), 'no GPS on load before sharing is switched on');
    ok(await fa.evaluate(() => shareOn() === false && !!document.getElementById('lv-share') && !document.getElementById('lv-share').checked), 'Share toggle present and off by default');
    ok(await fa.evaluate(() => srch('Lightning Rod') !== ''), 'adult keeps the web-search box');
    await fa.click('#lv-family'); await fa.click('#lv-share');
    await waitFor(() => fa.evaluate(() => window.__geoCalls > 0 && shareOn() === true), { label: 'gps after toggle' });
    ok(true, 'toggle on → GPS starts and preference saved (person scope)');
    await waitFor(() => fa.evaluate(() => hub.list('loc:', { scope: 'family' }).some(r => r.key === 'loc:eli')), { label: 'own loc published' });
    ok(true, 'own location published to family scope');
    await fa.evaluate(() => hub.flush());
    await fa.click('#lv-share');
    await waitFor(() => fa.evaluate(() => !hub.list('loc:', { scope: 'family' }).some(r => r.key === 'loc:eli') && shareOn() === false), { label: 'loc removed' });
    ok(true, 'toggle off → own marker removed (tombstone) and preference off');
    const status = await fa.textContent('#loc-acc');
    ok(/not sharing|Only you can see/i.test(status) || (await fa.textContent('#fam-list')).includes('not sharing'), 'status reflects not sharing', status);
    await A.screenshot({ path: path.join(ROOT, 'docs/screens/rm1-map-adult.png') });

    console.log('\n## Kid pull: Eli\'s marker gone from the family list');
    await waitFor(() => fa.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'A flushed the removal' });
    await fk.evaluate(() => hub.pull());
    await sleep(1500);
    ok(await fk.evaluate(() => !hub.list('loc:', { scope: 'family' }).some(r => r.key === 'loc:eli')), 'kid no longer sees Eli after he stopped sharing');

    console.log('\n## Item 2: lean file, lazy layers, no 3D remnant');
    const src = fs.readFileSync(path.join(ROOT, 'apps/dollywood-live.html'), 'utf8');
    ok(src.length < 1.6e6, 'park map source under 1.6 MB (was 4.0 MB)', String(src.length));
    ok(!/\bTHREE\b/.test(src) && !src.includes('id="m-3d"') && !src.includes('id="view3d"'), 'no Three.js / 3D mode remnant');
    for (const f of ['relief.jpg', 'slope.png', 'aerial.jpg']) ok(fs.existsSync(path.join(ROOT, 'apps/dollywood', f)), 'layer file apps/dollywood/' + f);
    ok(await fa.evaluate(() => !aer.getAttribute('href') && !slopeImg.getAttribute('href') && img.getAttribute('href') === 'dollywood/relief.jpg'), 'aerial + slope not fetched until chosen; relief is the default');
    await fa.evaluate(() => setStyle('aerial'));
    ok(await fa.evaluate(() => aer.getAttribute('href') === 'dollywood/aerial.jpg'), 'choosing Satellite loads the aerial layer');
    ok(await fa.evaluate(() => apply.toString().includes('scheduleNames') && !drawMe.toString().includes('drawNames(')), 'labels settle after the pan/zoom tween instead of every frame');
    ok(await fa.evaluate(() => typeof setMode === 'function' && (setMode('3d'), mode === '2d')), 'setMode(3d) is a harmless no-op');

    console.log('\n## Item 2: where\'s everyone — stale rows greyed, day-old rows tombstoned');
    await fa.evaluate(() => { const now = Date.now(); hub.set('loc:mom', { x: 800, y: 700, t: now - 6 * 3600e3, name: 'Elizabeth', emoji: '🌷', color: '#8A6A4B' }, { scope: 'family' }); hub.set('loc:dad', { x: 820, y: 720, t: now - 30 * 3600e3, name: 'David', emoji: '🎣', color: '#3D5A3D' }, { scope: 'family' }); return hub.flush(); });
    await fa.evaluate(() => loadFam());
    await waitFor(() => fa.evaluate(() => hub.flush().then(() => hub.sync.pending === 0 && !hub.list('loc:', { scope: 'family' }).some(r => r.key === 'loc:dad'))), { label: 'dad tombstoned' });
    ok(true, "30-hour-old marker (David) tombstoned by an adult's map");
    const famHtml = await fa.evaluate(() => document.getElementById('fam-list').innerHTML);
    ok(famHtml.includes('Elizabeth') && famHtml.includes('h ago') && famHtml.includes('opacity:.55'), '6-hour-old marker (Elizabeth) listed greyed with last-seen time');
    ok(await fa.evaluate(() => !document.querySelector('#fam-list [data-f="dad"]')), 'David no longer listed');

    console.log('\n## Item 2: offline — the map opens from the service worker cache');
    await A.goto(SITE + '/index.html'); await A.waitForSelector('#shell:not([hidden])');
    await waitFor(() => A.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); if (!r || !r.active) return false; const keys = await caches.keys(); const v = keys.find(k => k.startsWith('hub-')); if (!v) return false; const c = await caches.open(v); const ks = (await c.keys()).map(k => k.url); return ks.some(u => u.endsWith('apps/dollywood-live.html')) && ks.some(u => u.endsWith('apps/dollywood/relief.jpg')); }), { timeout: 60000, label: 'precache complete' });
    ok(true, 'service worker precached the park map and its relief layer');
    await A.context().setOffline(true);
    await A.reload(); await A.waitForSelector('#shell:not([hidden])', { timeout: 20000 });
    ok(true, 'hub shell loads offline');
    await A.click('.tab[data-tab=apps]'); await A.click('.tile[data-id="dollywood-live"]');
    await waitFor(() => { const f = frameOf(A); return f && f.url().includes('dollywood-live'); }, { label: 'offline map frame' });
    const fo = frameOf(A);
    await fo.waitForFunction(() => typeof OFF !== 'undefined' && OFF.length > 100 && document.querySelectorAll('.mk').length > 100, null, { timeout: 30000 });
    ok(true, 'park map renders offline (145 listings drawn)');
    ok(await fo.evaluate(async () => { try { const r = await fetch('dollywood/relief.jpg'); return r.ok && (await r.blob()).size > 500000; } catch { return false; } }), 'relief layer served from cache offline');
    ok(await fo.evaluate(() => hub.list('loc:', { scope: 'family' }).some(r => r.key === 'loc:mom')), 'family positions available offline from the local cache');
    await A.context().setOffline(false);

    console.log('\n## Console');
    for (const [n, l] of Object.entries(errors)) ok(l.length === 0, 'no errors in ' + n, l.join(' | '));
  } catch (e) { fail++; console.log('  ✗ CRASH', e.stack || e.message); }
  finally { await browser.close(); server.close(); console.log(`\nPASS ${pass}  FAIL ${fail}`); process.exit(fail ? 1 : 0); }
})();
