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
  page.on('pageerror', e => errors[name].push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/40[13]|429/.test(m.text())) errors[name].push(m.text()); });
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

    console.log('\n## Console');
    for (const [n, l] of Object.entries(errors)) ok(l.length === 0, 'no errors in ' + n, l.join(' | '));
  } catch (e) { fail++; console.log('  ✗ CRASH', e.stack || e.message); }
  finally { await browser.close(); server.close(); console.log(`\nPASS ${pass}  FAIL ${fail}`); process.exit(fail ? 1 : 0); }
})();
