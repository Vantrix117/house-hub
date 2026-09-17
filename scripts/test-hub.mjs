#!/usr/bin/env node
// Headless browser checks for the hub shell + hub.js against a LOCAL API.
//
//   1. cd worker && npx wrangler dev --port 8787        (local D1 with schema+seed and a pairing code)
//   2. node scripts/test-hub.mjs <pairing-code>
//
// Needs playwright-core (any location on NODE_PATH) and Google Chrome or Edge installed.
// Serves the repo root on http://localhost:8765 and points hub.js at http://127.0.0.1:8787.

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
async function waitFor(fn, { timeout = 10000, every = 150, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}

const consoleErrors = [];
async function newContext(browser, name, init) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(([api, extra]) => {
    try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {}
    if (extra) for (const [k, v] of Object.entries(extra)) { try { if (localStorage.getItem(k) == null) localStorage.setItem(k, v); } catch {} }
  }, [API, init || null]);
  const page = await ctx.newPage();
  // The wrong-PIN step deliberately provokes a 401 (and the kiosk test a 403); Chrome logs those as a resource error, which is not a bug.
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|429)/.test(m.text())) consoleErrors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', e => consoleErrors.push(`[${name}] pageerror: ${e.message}`));
  return { ctx, page, name };
}
async function pair(page) {
  await page.goto(SITE + '/index.html');
  await page.waitForSelector('#paircode');
  await page.fill('#paircode', CODE);
  await page.click('#pairform button[type=submit]');
  await page.waitForSelector('.pcard[data-id]');
}
async function tapDigits(page, digits) { for (const d of digits) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); }
const frameOf = page => page.frame({ url: /apps\// }) || page.frames()[1];
async function openApp(page, id) {
  await page.click('.tab[data-tab=apps]');
  await page.click(`.tile[data-id="${id}"]`);
  await waitFor(() => { const f = frameOf(page); return f && f.url().includes(`apps/${id}.html`); }, { label: id + ' frame' });
  const f = frameOf(page);
  await f.waitForFunction(() => window.hub && window.hub.sync && (window.hub.sync.lastPull || window.hub.sync.state === 'offline'), null, { timeout: 15000 });
  return f;
}
const tallyCount = f => f.evaluate(() => Number(document.getElementById('n').textContent));

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  const shots = path.join(ROOT, 'docs', 'screens'); fs.mkdirSync(shots, { recursive: true });
  try {
    console.log('\n## Device A: pair, adult first-tap PIN creation, write');
    const A = await newContext(browser, 'A');
    await pair(A.page);
    ok((await A.page.$$('.pcard[data-id]')).length === 8, 'picker shows 8 profiles');
    await A.page.screenshot({ path: path.join(shots, 'p2-picker.png') });
    await A.page.click('.pcard[data-id=niece]');
    await A.page.waitForSelector('#pad');
    ok((await A.page.textContent('h2')).includes('Create your PIN'), 'adult without PIN gets "Create your PIN"');
    await tapDigits(A.page, '2468');
    ok((await A.page.textContent('#pinhint')).includes('again'), 'asks to confirm');
    await tapDigits(A.page, '2468');
    await A.page.waitForSelector('#shell:not([hidden])');
    ok((await A.page.textContent('#view-home')).includes('Niece'), 'signed in as Niece after creating PIN');
    ok(await A.page.evaluate(() => document.documentElement.dataset.kind === 'adult'), 'html[data-kind=adult]');
    ok(await A.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() === '#5B8143'), 'accent set from profile colour');
    await A.page.screenshot({ path: path.join(shots, 'p2-home-adult.png') });
    const fa = await openApp(A.page, 'tally');
    for (let i = 0; i < 3; i++) await fa.click('#plus');
    ok(await tallyCount(fa) === 3, 'tally counts to 3');
    await waitFor(() => fa.evaluate(() => hub.sync.state === 'synced' && hub.sync.pending === 0), { label: 'A synced' });
    ok(true, 'A flushed to server (synced, 0 pending)');

    console.log('\n## Device B: pair, PIN pad login, read what A wrote');
    const B = await newContext(browser, 'B');
    await pair(B.page);
    await B.page.click('.pcard[data-id=niece]');
    await B.page.waitForSelector('#pad');
    ok((await B.page.textContent('#pinhint')).includes('Enter your PIN'), 'adult with PIN gets the PIN pad');
    await tapDigits(B.page, '1111');
    await waitFor(() => B.page.textContent('#pinmsg').then(t => /wrong/i.test(t)), { label: 'wrong pin msg' });
    ok(true, 'wrong PIN is rejected with a message');
    await tapDigits(B.page, '2468');
    await B.page.waitForSelector('#shell:not([hidden])');
    const fb = await openApp(B.page, 'tally');
    await waitFor(() => tallyCount(fb).then(n => n === 3), { label: 'B count 3' });
    ok(true, 'B reads count 3 written by A');

    console.log('\n## Offline write on A -> reconnect -> flush -> B sees it');
    await A.ctx.setOffline(true);
    await fa.evaluate(() => window.dispatchEvent(new Event('offline')));
    await fa.click('#plus');
    ok(await tallyCount(fa) === 4, 'A counts to 4 while offline');
    const st = await fa.evaluate(() => ({ ...hub.sync }));
    ok(st.pending === 1 && (st.state === 'offline' || st.state === 'pending'), 'A sync state offline/pending with 1 queued', JSON.stringify(st));
    await A.ctx.setOffline(false);
    await fa.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => fa.evaluate(() => hub.sync.state === 'synced' && hub.sync.pending === 0), { label: 'A reflush' });
    ok(true, 'A flushed after reconnect');
    await fb.evaluate(() => hub.pull());
    await waitFor(() => tallyCount(fb).then(n => n === 4), { label: 'B sees 4' });
    ok(true, 'B sees 4 after pull (onChange re-rendered)');

    console.log('\n## Kiosk profile');
    const C = await newContext(browser, 'C');
    await pair(C.page);
    await C.page.click('.pcard[data-id=tv]');
    await C.page.waitForSelector('#shell:not([hidden])');
    ok(await C.page.evaluate(() => document.documentElement.dataset.kind === 'kiosk'), 'html[data-kind=kiosk]');
    ok(await C.page.evaluate(() => getComputedStyle(document.getElementById('tabbar')).display === 'none'), 'kiosk has no tab bar');
    ok(await C.page.$('#clock') !== null && (await C.page.textContent('#view-home')).includes('Reminders'), 'kiosk Home shows clock + reminders');
    const thrown = await C.page.evaluate(() => { try { hub.set('item:x', { id: 'x' }, { app: 'reminders', scope: 'family' }); return null; } catch (e) { return e.error; } });
    ok(thrown === 'read_only', 'hub.set throws read_only for kiosk', thrown);
    const status = await C.page.evaluate(async () => {
      const r = await fetch(JSON.parse(localStorage.getItem('hub.api')) + '/api/data/reminders/item:x?scope=family', { method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Device-Token': JSON.parse(localStorage.getItem('hub.device')).token, 'X-Profile-Token': JSON.parse(localStorage.getItem('hub.session')).token },
        body: JSON.stringify({ value: { id: 'x' }, updated_at: Date.now() }) });
      return r.status;
    });
    ok(status === 403, 'server rejects kiosk write with 403', String(status));
    await C.page.screenshot({ path: path.join(shots, 'p2-kiosk.png') });

    console.log('\n## Reminders: adult adds on A, kiosk sees it');
    await A.page.click('#pill-home'); await A.page.click('.tab[data-tab=home]');
    await A.page.fill('#remtext', 'Take the bins out');
    await A.page.click('#remform button[type=submit]');
    ok((await A.page.textContent('#remlist')).includes('Take the bins out'), 'reminder shows on A at once');
    await waitFor(() => A.page.evaluate(() => hub.sync.pending === 0 && hub.sync.state === 'synced'), { label: 'A reminder flushed' });
    await C.page.evaluate(() => hub.pull());
    await waitFor(() => C.page.textContent('#remlist').then(t => t.includes('Take the bins out')), { label: 'kiosk reminder' });
    ok(true, 'kiosk shows the reminder after pull');
    await C.page.screenshot({ path: path.join(shots, 'p2-kiosk-reminder.png') });

    console.log('\n## Kid profile');
    const D = await newContext(browser, 'D');
    await pair(D.page);
    await D.page.click('.pcard[data-id=ezra]');
    await D.page.waitForSelector('#shell:not([hidden])');
    ok(await D.page.evaluate(() => document.documentElement.dataset.kind === 'kid'), 'html[data-kind=kid]');
    await D.page.click('.tab[data-tab=apps]');
    const tiles = await D.page.$$eval('.tile', els => els.map(e => e.dataset.id));
    ok(!tiles.includes('prayer') && tiles.includes('tally'), 'kid grid hides prayer (visibleTo)', tiles.join(','));
    ok(await D.page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap')) >= 64), 'kid tap targets >= 64px');
    ok(await D.page.$('#remform') === null, 'kid cannot add reminders');
    await D.page.screenshot({ path: path.join(shots, 'p2-kid-apps.png') });

    console.log('\n## Legacy localStorage migration (tally.count -> person scope)');
    const E = await newContext(browser, 'E', { 'tally.count': '7' });
    await pair(E.page);
    await E.page.click('.pcard[data-id=mom]');
    await E.page.waitForSelector('#pad');
    await tapDigits(E.page, '1357'); await tapDigits(E.page, '1357');
    await E.page.waitForSelector('#shell:not([hidden])');
    const fe = await openApp(E.page, 'tally');
    await waitFor(() => tallyCount(fe).then(n => n === 7), { label: 'E count 7' });
    ok(true, "Mom's tally starts at the legacy 7");
    ok(await fe.evaluate(() => localStorage.getItem('tally.count') === '7'), 'legacy key left untouched');
    await waitFor(() => fe.evaluate(() => hub.sync.pending === 0 && hub.sync.state === 'synced'), { label: 'E flushed' });
    const F = await newContext(browser, 'F', { 'tally.count': '99' });
    await pair(F.page);
    await F.page.click('.pcard[data-id=mom]'); await F.page.waitForSelector('#pad'); await tapDigits(F.page, '1357');
    await F.page.waitForSelector('#shell:not([hidden])');
    const ff = await openApp(F.page, 'tally');
    await waitFor(() => tallyCount(ff).then(n => n === 7), { label: 'F count 7' });
    await sleep(500);
    ok(await tallyCount(ff) === 7, 'second device does not overwrite server data with its own legacy value');

    console.log('\n## Switch profile + session persistence');
    await A.page.click('.tab[data-tab=me]');
    await A.page.click('#switch');
    await A.page.waitForSelector('.pcard[data-id]');
    ok(await A.page.$('.pcard.last[data-id=niece]') !== null, 'picker remembers last profile');
    await A.page.reload();
    await A.page.waitForSelector('.pcard[data-id]');
    ok(true, 'reload after switch lands on picker (no session)');
    await B.page.reload();
    await B.page.waitForSelector('#shell:not([hidden])');
    ok(await B.page.evaluate(() => hub.profile && hub.profile.id === 'niece'), 'B stays signed in across reload');
    ok(await B.page.evaluate(() => location.hash === '#tally' && document.getElementById('viewer').classList.contains('on')), 'reload reopens the app that was open');
    await B.page.click('#pill-home');

    console.log('\n## Desktop width');
    await B.page.setViewportSize({ width: 1280, height: 900 });
    await B.page.click('.tab[data-tab=apps]');
    const cols = await B.page.evaluate(() => getComputedStyle(document.getElementById('grid')).gridTemplateColumns.split(' ').length);
    ok(cols === 8, 'apps grid is 8 across on desktop', String(cols));
    const side = await B.page.evaluate(() => { const r = document.getElementById('tabbar').getBoundingClientRect(); return r.left === 0 && r.top === 0 && r.width < 260 && r.height > 400; });
    ok(side, 'tab bar becomes a sidebar at 1280');
    ok(await B.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll');
    await B.page.screenshot({ path: path.join(shots, 'p2-apps-desktop.png') });

    ok(consoleErrors.length === 0, 'no console errors', consoleErrors.join('\n      '));
  } catch (e) {
    fail++; console.log('  ✗ CRASH', e.message);
  } finally {
    await browser.close(); server.close();
    console.log(`\nPASS ${pass}  FAIL ${fail}`);
    process.exit(fail ? 1 : 0);
  }
})();
