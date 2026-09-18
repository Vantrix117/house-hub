#!/usr/bin/env node
// Roadmap 7 checks: preferences follow the person. Theme set on one device shows up on another for the same
// person and not for the next person; F260 text size + autolock ride along in person scope; the display
// profile gets a toast instead of a silent drop (or a crash) when it taps something.
//   cd worker && npx wrangler dev --port 8787     (seeded local D1)
//   node scripts/test-prefs.mjs <pairing-code>
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
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(8765);

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, { timeout = 12000, every = 150, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}
const errors = [];
async function newContext(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light' });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, API);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  await page.goto(SITE + '/index.html'); await page.waitForSelector('#paircode');
  await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); await page.waitForSelector('.pcard[data-id]');
  return { ctx, page };
}
async function signIn(page, id, pin) {
  const create = pin && /Create/.test(await page.$eval(`.pcard[data-id=${id}] .psub`, e => e.textContent));
  await page.click(`.pcard[data-id=${id}]`);
  if (pin) {
    await page.waitForSelector('#pad'); await sleep(450);
    const tap = async () => { for (const d of pin) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); };
    await tap();
    if (create) {
      await page.waitForFunction(() => /again/.test((document.getElementById('pinhint') || {}).textContent || ''), null, { timeout: 15000 }); await sleep(200); await tap();
      // a picker rendered before another device created the PIN falls back to the "Enter your PIN" pad: type it once more
      await page.waitForFunction(() => document.getElementById('gate').hidden || /Enter your PIN/.test((document.getElementById('pinhint') || {}).textContent || ''), null, { timeout: 15000 });
      if (await page.$('#gate:not([hidden]) #pad')) { await sleep(200); await tap(); }
    }
  }
  try { await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 }); }
  catch (e) { console.log('signIn state', await page.evaluate(() => ({ gate: document.getElementById('gate').hidden, shell: document.getElementById('shell').hidden, hint: (document.getElementById('pinhint') || {}).textContent, msg: (document.getElementById('pinmsg') || {}).textContent, dots: document.querySelectorAll('#dots i.on').length }))); throw e; }
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
}
const themeOf = page => page.evaluate(() => document.documentElement.dataset.theme || 'system');
const switchTo = async (page, id, pin) => { await page.click('.tab[data-tab=me]'); await page.click('#switch'); await page.waitForSelector('.pcard[data-id]'); await signIn(page, id, pin); };

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## theme follows the person');
    const A = await newContext(browser, 'A'), B = await newContext(browser, 'B');
    await signIn(A.page, 'eli', '1357');
    await A.page.click('.tab[data-tab=me]'); await A.page.click('#theme [data-theme=dark]');
    ok(await themeOf(A.page) === 'dark', 'A: Dark applies at once');
    ok(await A.page.evaluate(() => hub.get('theme', { app: 'hub', scope: 'person' }) === 'dark'), 'A: theme written to person scope');
    await waitFor(() => A.page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'A flushed' });
    await signIn(B.page, 'eli', '1357');
    await waitFor(() => themeOf(B.page).then(t => t === 'dark'), { label: 'B dark' });
    ok(true, 'B: Eli is dark on the second device after one pull');
    await switchTo(B.page, 'christian', '2468');
    await waitFor(() => themeOf(B.page).then(t => t === 'system'), { label: 'B christian system' });
    ok(true, 'B: Christian on the same device is back to System');
    await B.page.click('.tab[data-tab=me]'); await B.page.click('#theme [data-theme=light]');
    await waitFor(() => B.page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'B flushed' });
    await switchTo(B.page, 'eli', '1357');
    await waitFor(() => themeOf(B.page).then(t => t === 'dark'), { label: 'B eli dark again' });
    ok(true, 'B: back to Eli → dark again (from the cache, no flash of the wrong theme)');
    await A.page.click('.tab[data-tab=home]'); await A.page.click('.tab[data-tab=me]');
    ok(await A.page.$eval('#theme .on', b => b.dataset.theme) === 'dark', 'A: Me shows Dark selected');
    // change it from A while B is signed in as Eli: B follows within a pull
    await A.page.click('#theme [data-theme=light]');
    await waitFor(() => A.page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'A flushed light' });
    await B.page.evaluate(() => hub.pull());
    await waitFor(() => themeOf(B.page).then(t => t === 'system' || t === 'light'), { label: 'B follows light' });
    ok(await themeOf(B.page) === 'light', 'B: follows A\'s change to Light on the next pull');

    console.log('\n## F260 text size + autolock follow the person');
    await A.page.click('.tab[data-tab=apps]'); await A.page.click('.tile[data-id=f260]');
    const fa = await waitFor(() => { const f = A.page.frame({ url: /apps\/f260/ }); return f; }, { label: 'f260 frame A' });
    await fa.waitForFunction(() => window.hub && hub.sync.lastPull > 0);
    await fa.evaluate(() => { document.querySelector('#sizeSeg [data-big="1"]').click(); document.querySelector('#autoSeg [data-min="5"]').click(); });
    ok(await fa.evaluate(() => hub.get('f260.big') === true && hub.get('f260.autolock') === 5), 'A: big text + 5 min autolock stored in person scope', await fa.evaluate(() => JSON.stringify([hub.get('f260.big'), hub.get('f260.autolock')])));
    await waitFor(() => fa.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'f260 flushed' });
    await B.page.click('.tab[data-tab=apps]'); await B.page.click('.tile[data-id=f260]');
    const fb = await waitFor(() => B.page.frame({ url: /apps\/f260/ }), { label: 'f260 frame B' });
    await fb.waitForFunction(() => window.hub && hub.sync.lastPull > 0);
    await waitFor(() => fb.evaluate(() => document.body.classList.contains('big')), { label: 'B big text' });
    ok(true, 'B: F260 opens with big text for Eli');
    ok(await fb.evaluate(() => document.querySelector('#autoSeg [data-min="5"]').getAttribute('aria-pressed') === 'true'), 'B: autolock 5 min selected');

    console.log('\n## the display profile only looks');
    const C = await newContext(browser, 'C');
    await signIn(C.page, 'tv');
    ok(await C.page.evaluate(() => hub.isKiosk && !hub.canWrite), 'kiosk session');
    await C.page.goto(SITE + '/apps/f260.html');       // the shell hides apps from the display; the page itself must still be safe
    await C.page.waitForFunction(() => window.hub && hub.profile && hub.sync && (hub.sync.lastPull > 0 || hub.sync.state === 'offline'), null, { timeout: 15000 });
    await C.page.waitForSelector('[data-day="1-0"] .mark');
    await C.page.click('[data-day="1-0"] .mark');
    await sleep(300);
    const kiosk = await C.page.evaluate(() => ({ done: document.querySelector('[data-day="1-0"]').classList.contains('done'), toast: (document.getElementById('hub-toast') || {}).textContent || '', hidden: (document.getElementById('hub-toast') || { hidden: true }).hidden }));
    ok(!kiosk.done, 'tap leaves the reading unchecked');
    ok(/only looks/.test(kiosk.toast) && !kiosk.hidden, `toast says this screen only looks (${JSON.stringify(kiosk.toast)})`);
    await C.page.goto(SITE + '/apps/tally.html');
    await C.page.waitForFunction(() => window.hub && hub.profile && document.getElementById('n').textContent !== '', null, { timeout: 15000 });
    await C.page.click('#plus'); await sleep(300);
    ok(await C.page.evaluate(() => document.getElementById('n').textContent === '0'), 'tally stays at 0 for the display');
    ok(await C.page.evaluate(() => /only looks/.test((document.getElementById('hub-toast') || {}).textContent || '')), 'tally shows the toast, no crash');
    await C.ctx.close(); await B.ctx.close(); await A.ctx.close();
    ok(errors.length === 0, 'no console/page errors', errors.slice(0, 5).join(' | '));
  } finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
