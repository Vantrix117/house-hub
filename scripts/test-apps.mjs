#!/usr/bin/env node
// Phase 3 checks: migrated apps on hub.js, Home dashboard, widgets, kid/kiosk screens, legacy migration counts.
//   cd worker && npx wrangler dev --port 8787     (fresh local D1: schema + seed + pairing code)
//   node scripts/test-apps.mjs <pairing-code>
// Writes screenshots to docs/screens/p3-*.png (390x844 + 1024x1366, light + dark).
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
const errors = {};
async function newContext(browser, name, { init, dark, size } = {}) {
  const ctx = await browser.newContext({ viewport: size || { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: dark ? 'dark' : 'light' });
  await ctx.addInitScript(([api, extra]) => {
    try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {}
    if (extra) for (const [k, v] of Object.entries(extra)) { try { if (localStorage.getItem(k) == null) localStorage.setItem(k, v); } catch {} }
  }, [API, init || null]);
  const page = await ctx.newPage();
  errors[name] = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|429)/.test(m.text())) errors[name].push(m.text()); });
  page.on('pageerror', e => errors[name].push('pageerror: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' <- ')));
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
async function signIn(page, id, pin, create) {
  await page.click(`.pcard[data-id=${id}]`);
  if (pin) { await page.waitForSelector('#pad'); await tapDigits(page, pin); if (create) await tapDigits(page, pin); }
  await page.waitForSelector('#shell:not([hidden])');
}
const frameOf = page => page.frame({ url: /apps\// }) || page.frames()[1];
async function openApp(page, id) {
  if (await page.$('#viewer.on')) await page.click('#pill-home');
  await page.click('.tab[data-tab=apps]');
  await page.click(`.tile[data-id="${id}"]`);
  await waitFor(() => { const f = frameOf(page); return f && f.url().includes(`apps/${id}.html`); }, { label: id + ' frame' });
  const f = frameOf(page);
  await f.waitForFunction(() => window.hub && window.hub.sync && (window.hub.sync.lastPull || window.hub.sync.state === 'offline'), null, { timeout: 15000 });
  await sleep(300);
  return f;
}
const settled = f => f.evaluate(() => hub.flush().then(() => hub.sync.pending === 0));
const shots = path.join(ROOT, 'docs', 'screens'); fs.mkdirSync(shots, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(shots, `p3-${name}.png`), fullPage: false });

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## Eli (admin): dashboard, icons, widgets');
    const A = await newContext(browser, 'A');
    await pair(A.page);
    await signIn(A.page, 'eli', '1357', true);
    await waitFor(() => A.page.evaluate(() => hub.sync.lastPull > 0), { label: 'A pulled' });
    const home = await A.page.textContent('#view-home');
    ok(/Good (morning|afternoon|evening), Eli/.test(home), 'greeting by name');
    ok(home.includes("Today's reading") && home.includes('Genesis 1-2') && home.includes('In the fridge') && home.includes('Prayer') && home.includes('Reminders') && home.includes('Around the house'), 'Home shows reading, fridge, prayer, reminders, feed');
    await shot(A.page, 'home-eli-390-light');
    await A.page.click('.tab[data-tab=apps]');
    ok(await A.page.$$eval('.tile .icon', els => els.length) === 5, 'all five tiles use SVG icons');
    ok(await A.page.$('.tile.wide[data-id=f260] .ring') !== null, 'F260 wide tile has a progress ring');
    await shot(A.page, 'apps-eli-390-light');

    console.log('\n## F260 on hub.js');
    let f = await openApp(A.page, 'f260');
    ok(await f.evaluate(() => !!document.querySelector('[data-day]')), 'F260 renders the plan');
    await f.click('[data-day="1-0"] .mark');
    ok(await f.evaluate(() => !!hub.get('f260.done')['1-0']), 'checking a reading writes f260.done to person scope');
    ok(await f.evaluate(() => hub.get('f260.summary') && hub.get('f260.summary').weekDone === 1), 'F260 publishes a summary (1/5)');
    await f.evaluate(() => { const b = document.querySelector('[data-src="esv"]'); if (b) b.click(); });
    ok(await f.evaluate(() => hub.get('f260.source') === 'esv'), 'translation preference is stored per profile');
    await waitFor(() => settled(f), { label: 'f260 flushed' });
    await A.page.click('#pill-home'); await A.page.click('.tab[data-tab=home]');
    await waitFor(() => A.page.textContent('#view-home').then(t => t.includes('Genesis 3-4')), { label: 'home next reading' });
    ok(true, 'Home card advances to the next reading (Genesis 3-4)');
    ok((await A.page.textContent('#view-home')).includes('read today'), 'Home card shows read today');
    await A.page.click('.tab[data-tab=apps]');
    ok((await A.page.textContent('.tile.wide[data-id=f260]')).includes('1/5'), 'wide tile ring label 1/5');

    console.log('\n## Larder Ledger on hub.js (family scope)');
    f = await openApp(A.page, 'leftovers');
    ok(await f.$('#unlock') === null, 'no passphrase screen any more');
    await f.fill('#name', 'Chili'); await f.fill('#date', new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10));
    await f.click('#add .log');
    ok((await f.textContent('#list')).includes('Chili'), 'logged item renders');
    ok(await f.evaluate(() => hub.list('item:').some(r => /^item:/.test(r.key) && r.value.name === 'Chili')), 'item stored under family scope item:<id>');
    await waitFor(() => settled(f), { label: 'leftovers flushed' });
    await A.page.click('#pill-home'); await A.page.click('.tab[data-tab=apps]');
    await waitFor(() => A.page.$eval('.tile[data-id=leftovers] .badge', b => +b.textContent >= 1).catch(() => false), { label: 'badge' });
    ok(true, 'Larder tile badge counts aging items');
    await A.page.click('.tab[data-tab=home]');
    await waitFor(() => A.page.textContent('#view-home').then(x => /\d+ to eat this week/.test(x) && x.includes('Chili')), { label: 'home fridge card' });
    ok(true, 'Home fridge card lists Chili');

    console.log('\n## Prayer on hub.js (person + family)');
    f = await openApp(A.page, 'prayer');
    ok(await f.$('#lock') === null && await f.$('#f-token') === null && await f.$('#f-setpin') === null, 'lock screen, GitHub sync and PIN settings removed');
    ok(await f.evaluate(() => L().prayers.length === 0 && D.activeList === 'personal'), 'new profile starts with an empty private list (no sample data)');
    await f.click('nav [data-go="add"]');
    await f.fill('#f-title', 'Wisdom for the week'); await f.click('#f-save');
    ok(await f.evaluate(() => hub.list('prayer:', { scope: 'person' }).length === 1), 'private request stored in person scope');
    await f.click('#listSwitch [data-list="shared"]');
    await f.click('nav [data-go="add"]');
    await f.fill('#f-title', 'Grandma\'s knee'); await f.click('#f-save');
    ok(await f.evaluate(() => hub.list('prayer:', { scope: 'family' }).length === 1), 'family request stored in family scope');
    await f.click('nav [data-go="today"]');
    await f.click('[data-pray]');
    ok(await f.evaluate(() => { const p = D.lists.shared.prayers[0]; return (p.prayedBy[TODAY] || []).includes('Eli'); }), 'who-prayed uses the signed-in profile name');
    await waitFor(() => settled(f), { label: 'prayer flushed' });
    ok(await f.evaluate(() => hub.voiceSupported ? !document.getElementById('f-mic').hidden : document.getElementById('f-mic').hidden), 'voice button shown only when speech recognition exists');

    console.log('\n## Christian sees the family list, not Eli\'s private list');
    const B = await newContext(browser, 'B');
    await pair(B.page);
    await signIn(B.page, 'christian', '2468', true);
    let fb = await openApp(B.page, 'prayer');
    ok(await fb.evaluate(() => D.lists.personal.prayers.length === 0), 'private list is empty for Christian');
    ok(await fb.evaluate(() => D.lists.shared.prayers.length === 1 && D.lists.shared.prayers[0].title === "Grandma's knee"), 'family list shows the shared request');
    ok(await fb.evaluate(() => D.lists.shared.prayers[0].prayedBy[TODAY].includes('Eli')), "Eli's initials came through on the family list");
    fb = await openApp(B.page, 'leftovers');
    ok((await fb.textContent('#list')).includes('Chili'), 'Christian sees Chili in the shared ledger');

    console.log('\n## Legacy migration counts (Mom, with pre-profiles localStorage)');
    const legacy = {
      version: 3, activeList: 'personal', pin: '1111', me: 'Mom', theme: 'system', sync: { mode: 'off' },
      lists: {
        personal: { label: 'My list', categories: ['Family', 'Health Needs'], prayerDays: ['2026-09-14', '2026-09-15'], plans: [{ id: 'pl1', name: 'Everything', mode: 'everything', focusCategory: '', includeDaily: true, rotationSize: 3, groupByCategory: false, dayMap: {}, show: {} }], activePlan: 'pl1', rotationFor: null,
          prayers: ['Aunt June', 'The Carters', 'New job for Sam'].map((t, i) => ({ id: 'p00' + (i + 1), title: t, for: '', phone: '', detail: '', category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt: '2026-09-10', lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, updatedAt: '2026-09-10T00:00:00.000Z' })) },
        shared: { label: 'Family list', categories: ['Family'], prayerDays: [], plans: [{ id: 'pl2', name: 'Everything', mode: 'everything', focusCategory: '', includeDaily: true, rotationSize: 3, groupByCategory: false, dayMap: {}, show: {} }], activePlan: 'pl2', rotationFor: null,
          prayers: ['Safe travels', 'Church picnic'].map((t, i) => ({ id: 's00' + (i + 1), title: t, for: '', phone: '', detail: '', category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt: '2026-09-10', lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, updatedAt: '2026-09-10T00:00:00.000Z' })) },
      },
    };
    const E = await newContext(browser, 'E', { init: { 'prayer-data-v3': JSON.stringify(legacy), 'f260.done': JSON.stringify({ '1-0': true, '1-1': true }), 'f260.week': '1', 'f260.source': JSON.stringify('esv') } });
    await pair(E.page);
    await signIn(E.page, 'mom', '1357', true);
    console.log('   before: personal prayers 3, shared prayers 2 (legacy) + 1 already on the family list; f260 readings 2');
    let fe = await openApp(E.page, 'prayer');
    const counts = await fe.evaluate(() => ({ personal: D.lists.personal.prayers.length, shared: D.lists.shared.prayers.length, days: D.lists.personal.prayerDays.length }));
    console.log('   after :', JSON.stringify(counts));
    ok(counts.personal === 3, "Mom's private list migrated: 3 prayers", JSON.stringify(counts));
    ok(counts.shared === 3, 'family list = 2 migrated + 1 existing = 3', JSON.stringify(counts));
    ok(counts.days === 2, 'prayer days migrated (streak history kept)');
    ok(await fe.evaluate(() => !!localStorage.getItem('prayer-data-v3')), 'legacy blob left untouched');
    await waitFor(() => settled(fe), { label: 'E prayer flushed' });
    fe = await openApp(E.page, 'f260');
    ok(await fe.evaluate(() => Object.keys(hub.get('f260.done')).length === 2 && hub.get('f260.source') === 'esv'), 'F260 progress + translation migrated (2 readings, ESV)');
    await waitFor(() => settled(fe), { label: 'E f260 flushed' });
    await E.page.click('#pill-home'); await E.page.click('.tab[data-tab=home]');
    ok((await E.page.textContent('#view-home')).includes('2-day streak'), "Home shows Mom's 2-day prayer streak");

    console.log('\n## Tally + timer on hub.js');
    f = await openApp(A.page, 'timer');
    await f.click('[data-s="600"]');
    ok(await f.evaluate(() => hub.get('lastPreset') === 600), 'timer remembers the preset per profile');
    f = await openApp(A.page, 'tally');
    await f.click('#plus');
    ok(await f.evaluate(() => hub.get('count') === 1), 'tally counts in person scope');

    console.log('\n## Admin panel');
    await A.page.click('#pill-home'); await A.page.click('.tab[data-tab=me]');
    await waitFor(() => A.page.textContent('#admin-body').then(t => t.includes('Pairing code') && t.includes('Devices')), { label: 'admin panel' });
    const adm = await A.page.textContent('#admin-body');
    ok(adm.includes('Christian') && adm.includes('PIN set') && adm.includes('Downstairs TV'), 'admin lists profiles with PIN state');
    ok((adm.match(/Unpair/g) || []).length >= 2, 'admin lists other paired devices with Unpair');
    await A.page.click('[data-edit="tv"]');
    await A.page.fill('#pname', 'Kitchen TV'); await A.page.click('#pform button[type=submit]');
    await waitFor(() => A.page.textContent('#admin-body').then(t => t.includes('Kitchen TV')), { label: 'rename' });
    ok(true, 'admin rename saves and re-renders');
    await A.page.click('[data-edit="tv"]'); await A.page.fill('#pname', 'Downstairs TV'); await A.page.click('#pform button[type=submit]');
    await waitFor(() => A.page.textContent('#admin-body').then(t => t.includes('Downstairs TV')), { label: 'rename back' });
    await shot(A.page, 'me-admin-390-light');

    console.log('\n## Screenshots: kid, kiosk, dark, iPad');
    const K = await newContext(browser, 'K');
    await pair(K.page); await signIn(K.page, 'ezra');
    await waitFor(() => K.page.evaluate(() => hub.sync.lastPull > 0));
    await shot(K.page, 'home-kid-390-light');
    await K.page.click('.tab[data-tab=apps]'); await shot(K.page, 'apps-kid-390-light');
    const T = await newContext(browser, 'T', { size: { width: 1024, height: 1366 } });
    await pair(T.page); await signIn(T.page, 'tv');
    await waitFor(() => T.page.evaluate(() => hub.sync.lastPull > 0));
    await shot(T.page, 'home-kiosk-1024-light');
    const D = await newContext(browser, 'D', { dark: true, size: { width: 1024, height: 1366 } });
    await pair(D.page); await signIn(D.page, 'eli', '1357');
    await waitFor(() => D.page.evaluate(() => hub.sync.lastPull > 0));
    await shot(D.page, 'home-eli-1024-dark');
    await D.page.click('.tab[data-tab=apps]'); await shot(D.page, 'apps-eli-1024-dark');
    ok(await D.page.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(28, 23, 20)'), 'dark palette applies from prefers-color-scheme');
    ok(await D.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll at 1024');
    const D2 = await newContext(browser, 'D2', { dark: true });
    await pair(D2.page); await signIn(D2.page, 'ezra');
    await waitFor(() => D2.page.evaluate(() => hub.sync.lastPull > 0));
    await shot(D2.page, 'home-kid-390-dark');
    await D2.page.click('.tab[data-tab=apps]'); await shot(D2.page, 'apps-kid-390-dark');
    const T2 = await newContext(browser, 'T2', { dark: true });
    await pair(T2.page); await signIn(T2.page, 'tv');
    await waitFor(() => T2.page.evaluate(() => hub.sync.lastPull > 0));
    await shot(T2.page, 'home-kiosk-390-dark');
    const L = await newContext(browser, 'L', { size: { width: 1024, height: 1366 } });
    await pair(L.page); await signIn(L.page, 'eli', '1357');
    await waitFor(() => L.page.evaluate(() => hub.sync.lastPull > 0));
    await shot(L.page, 'home-eli-1024-light');
    await L.page.click('.tab[data-tab=apps]'); await shot(L.page, 'apps-eli-1024-light');

    console.log('\n## Console errors');
    for (const [n, list] of Object.entries(errors)) ok(list.length === 0, `no console errors in context ${n}`, list.join(' | '));
  } catch (e) {
    fail++; console.log('  ✗ CRASH', e.stack || e.message);
  } finally {
    await browser.close(); server.close();
    console.log(`\nPASS ${pass}  FAIL ${fail}`);
    process.exit(fail ? 1 : 0);
  }
})();
