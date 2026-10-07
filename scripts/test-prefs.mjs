#!/usr/bin/env node
// Roadmap 7 checks: preferences follow the person. Theme set on one device shows up on another for the same
// person and not for the next person; F260's Large is the hub text size (D17) and its autolock rides along in person scope; the display
// profile gets a toast instead of a silent drop (or a crash) when it taps something.
// Audit batch 1a (04-design-system.md §1, "Person preferences"): the text size, Increase Contrast, the glass level
// (Solid = Reduce Transparency) and Reduce Motion follow the person the same way, one hub row each; a stale device
// mirror loses to the row after the first pull; the display keeps its settings on the device, writes no row, shows
// no toast and throws nothing, and a reload keeps them (the pre-paint bootstrap reads the mirror).
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
const themeOf = page => page.evaluate(() => document.documentElement.dataset.themeChoice || 'system');
const attrs = page => page.evaluate(() => { const d = document.documentElement.dataset; return { textSize: d.textSize || null, contrast: d.contrast || null, transparency: d.transparency || null, motion: d.motion || null, glass: d.glass || null }; });
const flushed = page => waitFor(() => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flushed' });
const PARCHMENT = 'rgb(236, 226, 205)';   // Parchment's v3 --bg
const switchTo = async (page, id, pin) => { await page.click('.tab[data-tab=me]'); await page.click('#switch'); await page.waitForSelector('.pcard[data-id]'); await signIn(page, id, pin); };

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## theme follows the person');
    const A = await newContext(browser, 'A'), B = await newContext(browser, 'B');
    await signIn(A.page, 'eli', '1357');
    await A.page.click('.tab[data-tab=me]'); await A.page.click('#theme [data-theme=midnight]');
    ok(await themeOf(A.page) === 'midnight' && await A.page.evaluate(() => document.documentElement.dataset.scheme === 'dark'), 'A: Midnight applies at once (data-scheme=dark)');
    ok(await A.page.evaluate(() => hub.get('theme', { app: 'hub', scope: 'person' }) === 'midnight'), 'A: theme written to person scope');
    await waitFor(() => A.page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'A flushed' });
    await signIn(B.page, 'eli', '1357');
    await waitFor(() => themeOf(B.page).then(t => t === 'midnight'), { label: 'B dark' });
    ok(true, 'B: Eli is Midnight on the second device after one pull');
    await switchTo(B.page, 'christian', '2468');
    await waitFor(() => themeOf(B.page).then(t => t === 'system'), { label: 'B christian system' });
    ok(true, 'B: Mae on the same device is back to System');
    await B.page.click('.tab[data-tab=me]'); await B.page.click('#theme [data-theme=parchment]');
    await waitFor(() => B.page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'B flushed' });
    await switchTo(B.page, 'eli', '1357');
    await waitFor(() => themeOf(B.page).then(t => t === 'midnight'), { label: 'B eli dark again' });
    ok(true, 'B: back to Eli → Midnight again (from the cache, no flash of the wrong theme)');
    await A.page.click('.tab[data-tab=home]'); await A.page.click('.tab[data-tab=me]');
    ok(await A.page.$eval('#theme .on', b => b.dataset.theme) === 'midnight', 'A: Me shows Midnight selected');
    // change it from A while B is signed in as Eli: B follows within a pull
    await A.page.click('#theme [data-theme=parchment]');
    await waitFor(() => A.page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'A flushed light' });
    await B.page.evaluate(() => hub.pull());
    await waitFor(() => themeOf(B.page).then(t => t === 'parchment'), { label: 'B follows parchment' });
    ok(await B.page.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(236, 226, 205)' && document.documentElement.dataset.scheme === 'light'), 'B: follows A\'s change to Parchment on the next pull (tan paper, light scheme)');
    // Parchment on a dark OS: the hub stays tan and F260's own dark CSS stays off
    const dk = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    await dk.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); localStorage.setItem('hub.theme', JSON.stringify('parchment')); } catch {} }, API);
    const dp = await dk.newPage(); await dp.goto(SITE + '/docs/design.html'); await dp.waitForTimeout(200);
    await dp.evaluate(() => window.__setTheme('parchment'));
    ok(await dp.evaluate(() => document.documentElement.dataset.scheme === 'light' && getComputedStyle(document.body).backgroundColor === 'rgb(236, 226, 205)'), 'Parchment on a dark-mode device still renders tan with data-scheme=light');
    await dk.close();

    console.log('\n## text size, contrast, glass and motion follow the person (batch 1a, D8, D11)');
    // A and B are both Eli here
    await A.page.click('.tab[data-tab=home]'); await A.page.click('.tab[data-tab=me]');
    await A.page.click('#ap-size [data-v="l"]');
    ok(await A.page.evaluate(() => document.documentElement.dataset.textSize === 'l' && hub.get('textSize', { app: 'hub', scope: 'person' }) === 'l'), 'A: text size L applies at once and is written to person scope');
    ok(await A.page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize) > 17.5), 'A: body text grows with the size (above 17 px)');
    await A.page.click('#ap-glass [data-v="solid"]');
    await A.page.click('#ap-contrast'); await A.page.click('#ap-motion');
    const a1 = await attrs(A.page);
    ok(a1.transparency === 'reduce' && a1.contrast === 'more' && a1.motion === 'reduce', `A: Solid glass, Increase Contrast and Reduce Motion apply at once (${JSON.stringify(a1)})`);
    ok(await A.page.evaluate(() => ['glass', 'contrast', 'motion'].every(k => hub.get(k, { app: 'hub', scope: 'person' }))), 'A: each is its own person-scope hub row');
    await flushed(A.page);
    await B.page.evaluate(() => hub.pull());
    await waitFor(() => attrs(B.page).then(x => x.textSize === 'l' && x.transparency === 'reduce' && x.contrast === 'more' && x.motion === 'reduce'), { label: 'B follows the prefs' });
    ok(true, 'B: Eli\'s text size, contrast, Solid glass and motion follow on the next pull');
    const bar = await B.page.evaluate(() => { const cs = getComputedStyle(document.getElementById('tabbar')); return { bg: cs.backgroundColor, bf: cs.backdropFilter || cs.webkitBackdropFilter }; });
    const alpha = (bar.bg.match(/rgba?\(([^)]*)\)/) || ['', '0,0,0,0'])[1].split(',').map(Number)[3];
    ok((alpha === undefined || alpha >= 0.999) && (bar.bf === 'none' || !bar.bf), `B: under Solid (Reduce Transparency) the tab bar is opaque with no blur (${bar.bg} / ${bar.bf})`);
    await switchTo(B.page, 'christian', '2468');
    await waitFor(() => attrs(B.page).then(x => !x.textSize && !x.transparency && !x.contrast && !x.motion), { label: 'Mae has none of them' });
    ok(true, 'B: Mae on the same device gets none of Eli\'s preferences');
    await switchTo(B.page, 'eli', '1357');
    await waitFor(() => attrs(B.page).then(x => x.textSize === 'l' && x.contrast === 'more'), { label: 'Eli again' });
    ok(true, 'B: back to Eli, his preferences return');
    // a stale device mirror loses to the row after the first pull (the bootstrap paints the mirror first)
    await B.page.evaluate(() => { localStorage.setItem('hub.prefs', JSON.stringify({ textSize: 'xs' })); localStorage.setItem('hub.prefs.eli', JSON.stringify({ textSize: 'xs' })); });
    await B.page.reload(); await B.page.waitForSelector('#shell:not([hidden])');
    await waitFor(() => B.page.evaluate(() => window.hub && hub.sync && hub.sync.lastPull > 0), { label: 'B pulled after reload' });
    await waitFor(() => attrs(B.page).then(x => x.textSize === 'l'), { label: 'the row wins over the stale mirror' });
    ok(await B.page.evaluate(() => JSON.parse(localStorage.getItem('hub.prefs')).textSize === 'l'), 'B: a stale mirror (XS) loses to the row (L) after the first pull, and the mirror is corrected');
    // put Eli back to the defaults, so later suites see the standard look
    await A.page.evaluate(() => { hub.setTextSize('m'); hub.setGlass(null); hub.setContrast(null); hub.setMotion(null); });
    ok(await A.page.evaluate(() => ['textSize', 'glass', 'contrast', 'motion'].every(k => hub.get(k, { app: 'hub', scope: 'person' }) === undefined)), 'A: back to the defaults (the rows are cleared)');
    await flushed(A.page);

    // Decision D17 (04-design-system.md, "F260 text size"): F260's Normal/Large IS the hub text size (one hub row, written by
    // the shell); the old f260.big moves once to the hub's L for an adult with no hub size, and the move is not repeated
    // after they choose Normal in Me. Autolock stays in F260's own person scope.
    console.log('\n## F260 text size is the hub text size (D17); autolock follows the person');
    const closeApp = async page => { if (await page.$('#viewer.on:not(.closing)')) { await page.click('#pill-home'); await page.waitForSelector('#viewer:not(.on)', { state: 'attached' }); } };   // back to the hub first
    const f260Frame = async (page, label) => {
      await closeApp(page);
      await page.click('.tab[data-tab=apps]'); await page.click('.tile[data-id=f260]');
      const f = await waitFor(async () => { const x = page.frame({ url: /apps\/f260/ }); return x && await x.evaluate(() => !!(window.hub && hub.isLoaded() && document.getElementById('sizeSeg'))).catch(() => false) ? x : null; }, { label });
      await sleep(400); return f;
    };
    const HUBP = { app: 'hub', scope: 'person' };
    const fa = await f260Frame(A.page, 'f260 frame A');
    await fa.evaluate(() => { document.querySelector('#sizeSeg [data-big="1"]').click(); document.querySelector('#autoSeg [data-min="5"]').click(); });
    await waitFor(() => A.page.evaluate(h => hub.get('textSize', h) === 'l', HUBP), { label: 'the shell wrote the hub size' });
    ok(await fa.evaluate(() => document.documentElement.dataset.textSize === 'l' && !document.body.classList.contains('big') && hub.get('f260.autolock') === 5),
      'A: Large in F260 sets the hub text size L (one hub row, no zoom); 5 min autolock stored in F260 person scope', await fa.evaluate(() => JSON.stringify([document.documentElement.dataset.textSize, hub.get('f260.big'), hub.get('f260.autolock')])));
    ok(await fa.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize) > 18.5 && getComputedStyle(document.body).zoom !== '1.15'), 'A: F260 text grows through --ts (body above 18.5 px), not a page zoom');
    await waitFor(() => fa.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'f260 flushed' });
    await flushed(A.page);
    await B.page.evaluate(() => hub.pull());
    const fb = await f260Frame(B.page, 'f260 frame B');
    await waitFor(() => fb.evaluate(() => document.documentElement.dataset.textSize === 'l'), { label: 'B large text' });
    ok(await fb.evaluate(() => document.querySelector('#sizeSeg [data-big="1"]').getAttribute('aria-pressed') === 'true'), 'B: F260 opens with Large for Eli (the hub size), Large selected');
    await waitFor(() => fb.evaluate(() => document.querySelector('#autoSeg [data-min="5"]').getAttribute('aria-pressed') === 'true'), { label: 'B autolock' });
    ok(true, 'B: autolock 5 min selected');
    // the one-time move: an adult with the old f260.big and no hub size gets the hub's L when F260 opens
    await A.page.evaluate(() => hub.setTextSize('m')); await flushed(A.page);
    await fa.evaluate(() => { hub.set('f260.big', true); hub.remove('f260.bigMoved'); });
    await waitFor(() => fa.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'legacy row flushed' });
    await B.page.evaluate(() => hub.pull()); await waitFor(() => attrs(B.page).then(x => !x.textSize), { label: 'B back to M' });
    const fb2 = await f260Frame(B.page, 'f260 frame B, legacy');
    await waitFor(() => B.page.evaluate(h => hub.get('textSize', h) === 'l', HUBP), { label: 'f260.big moved to the hub size' });
    ok(await fb2.evaluate(() => hub.get('f260.bigMoved') === true && document.documentElement.dataset.textSize === 'l' && !document.body.classList.contains('big')), 'B: the old f260.big moved once to the hub size L (f260.bigMoved recorded, no zoom)');
    await flushed(B.page); await waitFor(() => fb2.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'move flushed' });
    // Normal in Me afterwards is not undone by the next F260 open
    await closeApp(B.page); await B.page.click('.tab[data-tab=me]'); await B.page.click('#ap-size [data-v="m"]'); await flushed(B.page);
    const fb3 = await f260Frame(B.page, 'f260 frame B, after Normal'); await sleep(800);
    ok(await B.page.evaluate(h => hub.get('textSize', h) === undefined, HUBP) && await fb3.evaluate(() => !document.documentElement.dataset.textSize && document.querySelector('#sizeSeg [data-big="0"]').getAttribute('aria-pressed') === 'true'),
      'B: Normal chosen in Me afterwards stays Normal when F260 opens again (the move ran once)');
    await fb3.evaluate(() => { hub.remove('f260.big'); hub.remove('f260.bigMoved'); });   // leave Eli at the defaults for later suites
    await waitFor(() => fb3.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'cleanup flushed' });

    console.log('\n## the display profile only looks');
    const C = await newContext(browser, 'C');
    await signIn(C.page, 'tv');
    ok(await C.page.evaluate(() => hub.isKiosk && !hub.canWrite), 'kiosk session');
    // the display keeps its preferences on the device: mirror + attribute, no row, no toast, nothing thrown
    const kp = await C.page.evaluate(() => { const r = { threw: null }; try { hub.setContrast('more'); hub.setMotion('reduce'); hub.setTransparency('reduce'); hub.setTextSize('xl'); } catch (e) { r.threw = e.message; }
      const t = document.getElementById('hub-toast'); r.toast = t && !t.hidden ? t.textContent : ''; r.pending = hub.sync.pending;
      r.rows = ['contrast', 'motion', 'transparency', 'textSize'].filter(k => hub.get(k, { app: 'hub', scope: 'person' }) !== undefined);
      r.mirror = JSON.parse(localStorage.getItem('hub.prefs') || '{}'); return r; });
    ok(!kp.threw && !kp.toast && !kp.pending && !kp.rows.length, `display: the setters write no row, show no toast and do not throw (${JSON.stringify(kp)})`);
    ok(kp.mirror.contrast === 'more' && kp.mirror.motion === 'reduce' && kp.mirror.transparency === 'reduce', 'display: the device mirror holds the settings');
    const k1 = await attrs(C.page);
    ok(k1.contrast === 'more' && k1.motion === 'reduce' && k1.transparency === 'reduce', `display: the attributes apply at once (${JSON.stringify(k1)})`);
    ok(await C.page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ts-user')) === 1), 'display: the CSS ignores the text size on the TV');
    await C.page.reload(); await C.page.waitForSelector('#shell:not([hidden])');
    await waitFor(() => C.page.evaluate(() => window.hub && hub.sync && hub.sync.lastPull > 0), { label: 'C pulled after reload' });
    const k2 = await attrs(C.page);
    ok(k2.contrast === 'more' && k2.motion === 'reduce' && k2.transparency === 'reduce', `display: a reload keeps them (the bootstrap reads the mirror), and no person's rows adopt onto it (${JSON.stringify(k2)})`);
    await C.page.evaluate(() => { hub.setContrast(null); hub.setMotion(null); hub.setTransparency(null); hub.setTextSize('m'); });
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
    // since batch 11 (P3-TALLY-09) the display draws no +, - or Reset at all and says "View only"; a click that still
    // reaches the hidden button (dispatched in the DOM) must write nothing and must not crash
    ok(await C.page.evaluate(() => { const b = document.getElementById('plus'); return !b || !b.getClientRects().length || getComputedStyle(b).visibility === 'hidden'; }), 'tally shows no + to the display');
    ok(await C.page.evaluate(() => /view only/i.test(document.body.innerText)), 'tally says View only on the display');
    await C.page.evaluate(() => { const b = document.getElementById('plus'); if (b) b.click(); }); await sleep(300);
    ok(await C.page.evaluate(() => document.getElementById('n').textContent === '0'), 'tally stays at 0 for the display, even on a dispatched click');
    await C.ctx.close(); await B.ctx.close(); await A.ctx.close();
    ok(errors.length === 0, 'no console/page errors', errors.slice(0, 5).join(' | '));
  } finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
