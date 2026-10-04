#!/usr/bin/env node
// The Kitchen device, both halves (KITCHEN-1, audit batch 0d: data and server; KITCHEN-2, batch 2a: the shell), against a
// LOCAL API.
//
//   1. cd worker && npx wrangler dev --port 8787        (local D1 with schema+seed, migrations/006, a pairing code)
//   2. node scripts/test-kitchen.mjs <pairing-code>      (ADMIN_PIN=<pin> if Eli already has one)
//      HUB_API=http://127.0.0.1:<port> for another Worker; SITE_PORT=<port> to serve the repo elsewhere (the Worker's
//      ALLOWED_ORIGINS must list http://localhost:<port>); KITCHEN_SHOTS=<dir> saves the kitchen Home at 390/820/1280.
//
// Eli is signed in on the iPad when the admin, from his phone's Me → Admin → Devices, makes it the kitchen with his PIN (a
// wrong PIN is refused there). On its next request the iPad is the kitchen: no picker, no Me or Chat tab at 390, 820 and
// 1280, only the Larder, Prayer, Timer and Tally, and the calm kitchen Home (batch 6: every running timer in the house with
// its owner's face, read-only unless it is the kitchen's own). The kitchen writes the family apps, cannot
// read or write anyone's person scope, has no chat or admin, cannot sign in as a person (Eli included) and nobody else can
// sign in as it (P2-PROF-09). Prayed, the Larder's finish and the album's Add open the face sheet (Prayer: everyone in the
// household; the Larder and the album: adults only) and credit the tapped person, which another device sees in the rows
// and the feed; Ezra's prayer star follows once his Kid Verse opens. Clearing the role from Admin → Devices sends the iPad
// back to the picker, no longer the kitchen.
//
// Needs playwright-core (any location on NODE_PATH) and Google Chrome or Edge installed.

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
const ADMIN_PIN = process.env.ADMIN_PIN || '1357';
const PORT = +(process.env.SITE_PORT || 8765);
const SITE = 'http://localhost:' + PORT;
const SHOTS = process.env.KITCHEN_SHOTS || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT);

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, { timeout = 12000, every = 150, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}

// plain API calls (the admin's and the kids' own devices), outside any page
async function api(p, { method = 'GET', body, dt, pt } = {}) {
  const h = { 'Content-Type': 'application/json', Origin: SITE };
  if (dt) h['X-Device-Token'] = dt; if (pt) h['X-Profile-Token'] = pt;
  const r = await fetch(API + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}
async function signIn(dt, id, pin) {
  let r = await api('/api/login', { method: 'POST', dt, body: { profile_id: id, pin } });
  if (r.body && r.body.error === 'needs_pin_setup') r = await api(`/api/profiles/${id}/pin`, { method: 'POST', dt, body: { pin } });
  if (r.status !== 200) throw new Error(`sign-in ${id}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.profile_token;
}

const consoleErrors = [];
async function newContext(browser, name, viewport = { width: 820, height: 1180 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, API);
  const page = await ctx.newPage();
  // the role changes provoke 401s and the refused writes 403s on purpose; Chrome logs those as resource errors
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|429)/.test(m.text())) consoleErrors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', e => consoleErrors.push(`[${name}] pageerror: ${e.message}`));
  page.on('dialog', d => { consoleErrors.push(`[${name}] native dialog: ${d.message()}`); d.dismiss().catch(() => {}); });
  return { ctx, page, name };
}
async function tapDigits(page, digits) { for (const d of digits) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); }
const who = page => page.evaluate(() => hub.profile && { id: hub.profile.id, kind: hub.profile.kind });
const shellShown = page => page.evaluate(() => !document.getElementById('shell').hidden && document.getElementById('gate').hidden);
const visibleTabs = page => page.evaluate(() => [...document.querySelectorAll('#tabbar .tab')].filter(b => b.getClientRects().length && getComputedStyle(b).display !== 'none').map(b => b.dataset.tab));
// the app open in the shell's viewer
const appFrame = async (page, id) => { await page.waitForFunction(i => { const f = document.getElementById('frame'); return f && f.dataset.id === i && f.contentWindow && f.contentWindow.hub; }, id, { timeout: 15000 }); return page.frames().find(f => /\/apps\//.test(f.url()) && f.url().includes(id + '.html')); };
// the face sheet (hub.whoDidThis) in a page or frame: the faces offered, then a tap on one
async function faceSheet(ctx) { await ctx.waitForSelector('.hub-who .hub-face', { timeout: 8000 }); return ctx.$$eval('.hub-who .hub-face', bs => bs.map(b => b.dataset.id)); }
async function adminPin(page, pin) { await page.waitForSelector('#apform #apin'); await page.fill('#apin', pin); await page.click('#apform button[type=submit]'); }

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    // the admin's own phone (API calls) — Eli's PIN is created here when he has none yet
    const adminDev = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'Eli phone', fp: 'kitchen-test-admin' } })).body;
    const eli = await signIn(adminDev.device_token, 'eli', ADMIN_PIN);
    const A = { dt: adminDev.device_token, pt: eli };
    const household = (await api('/api/profiles', { dt: A.dt })).body.profiles;
    const kids = household.filter(p => p.kind === 'kid' && !p.is_guest).map(p => p.id);
    const adults = household.filter(p => p.kind === 'adult' && !p.is_guest).map(p => p.id);

    console.log('\n## The kitchen iPad starts as an ordinary device with Eli signed in');
    const K = await newContext(browser, 'kitchen');
    await K.page.goto(SITE + '/index.html');
    await K.page.waitForSelector('#paircode');
    await K.page.fill('#paircode', CODE); await K.page.fill('#pairname', 'Kitchen iPad');
    await K.page.click('#pairform button[type=submit]');
    await K.page.waitForSelector('.pcard[data-id]');
    ok(await K.page.$('.pcard[data-id="kitchen"]') === null, 'the picker on an ordinary device has no Kitchen face');
    await K.page.click('.pcard[data-id="eli"]');
    await K.page.waitForSelector('#pad');
    await tapDigits(K.page, ADMIN_PIN);
    await waitFor(() => shellShown(K.page), { label: 'Eli in the shell' });
    ok((await who(K.page)).id === 'eli', 'Eli is signed in on the iPad');
    const kDevice = await K.page.evaluate(() => hub.device.id);

    console.log('\n## The admin makes it the kitchen from his phone: Me → Admin → Devices, with his PIN');
    const AD = await newContext(browser, 'admin', { width: 1280, height: 900 });
    await AD.ctx.addInitScript(d => { try { localStorage.setItem('hub.device', JSON.stringify(d)); } catch {} }, { id: adminDev.device_id, token: adminDev.device_token, name: 'Eli phone' });
    await AD.page.goto(SITE + '/index.html');
    await AD.page.click('.pcard[data-id="eli"]'); await AD.page.waitForSelector('#pad'); await tapDigits(AD.page, ADMIN_PIN);
    await waitFor(() => shellShown(AD.page), { label: 'Eli on his phone' });
    await AD.page.click('.tab[data-tab=me]');
    const kBtn = `#admin-body [data-kitchen="${kDevice}"]`;
    await AD.page.waitForSelector(kBtn, { timeout: 15000 });
    ok(/Make it the kitchen/.test(await AD.page.textContent(kBtn)), 'Admin → Devices offers "Make it the kitchen" for the iPad');
    ok(await AD.page.$(`#admin-body [data-kitchen="${adminDev.device_id}"]`) === null, '…but not for the device the admin is holding');
    await AD.page.click(kBtn); await adminPin(AD.page, '0000');
    await waitFor(() => AD.page.textContent('#apmsg').then(t => /not your PIN/.test(t)), { label: 'wrong PIN message' });
    ok(true, 'a wrong admin PIN is refused in the sheet');
    ok((await api('/api/device', { dt: await K.page.evaluate(() => hub.device.token) })).body.role === null, '…and the iPad is not the kitchen');
    await AD.page.fill('#apin', ADMIN_PIN); await AD.page.click('#apform button[type=submit]');
    await AD.page.waitForSelector('#apform', { state: 'detached', timeout: 8000 });
    await waitFor(() => AD.page.textContent(kBtn).then(t => /Not the kitchen/.test(t)), { label: 'the row says Kitchen' });
    ok(true, 'with the right PIN the iPad is the kitchen (its row now offers "Not the kitchen")');
    await K.page.evaluate(() => hub.pull().catch(() => {}));   // "its next request"
    await waitFor(async () => { const w = await who(K.page); return w && w.kind === 'kitchen' && await shellShown(K.page); }, { label: 'the kitchen shell' });
    ok(true, 'on its next request the iPad is the kitchen, with no picker in between');
    ok(await K.page.evaluate(() => !document.querySelector('.pcard')), 'no profile picker on screen');
    await K.page.waitForSelector('#kitchen-home');
    const cards = await K.page.$$eval('#kitchen-home section h2', hs => hs.map(h => h.textContent.trim()));
    ok(['Timer', 'Eat soon', 'Family prayers', 'Reminders', 'Family album'].every(t => cards.some(c => c.startsWith(t))), 'the kitchen Home: timer, food to eat soon, family prayers, reminders, the album', JSON.stringify(cards));
    for (const [w, h] of [[390, 844], [820, 1180], [1280, 900]]) {
      await K.page.setViewportSize({ width: w, height: h }); await sleep(250);
      const tabs = await visibleTabs(K.page);
      const glance = await K.page.$eval('#k-clock', e => parseFloat(getComputedStyle(e).fontSize));
      const hscroll = await K.page.evaluate(() => document.getElementById('views').scrollWidth > document.getElementById('views').clientWidth + 1);
      ok(JSON.stringify(tabs) === '["home","apps"]' && !(await K.page.$('.pcard')) && !hscroll && glance >= 64, `at ${w}: only Home and Apps, no picker, no sideways scroll, a ${Math.round(glance)} px clock`, JSON.stringify({ tabs, hscroll, glance }));
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await K.page.screenshot({ path: path.join(SHOTS, `kitchen-home-${w}.png`), fullPage: false }); }
    }
    await K.page.setViewportSize({ width: 820, height: 1180 });
    await K.page.evaluate(() => { location.hash = 'me'; }); await sleep(300);
    ok(await K.page.evaluate(() => document.getElementById('view-home').classList.contains('on') && !document.getElementById('view-me').classList.contains('on')), '#me on the kitchen lands on Home');
    const tiles = await K.page.evaluate(async () => { document.querySelector('.tab[data-tab=apps]').click(); await new Promise(r => setTimeout(r, 400)); return [...document.querySelectorAll('.tile[data-id]')].map(t => t.dataset.id).sort(); });
    ok(JSON.stringify(tiles) === JSON.stringify(['leftovers', 'prayer', 'tally', 'timer']), 'the kitchen\'s apps are the Larder, Prayer, Timer and Tally', JSON.stringify(tiles));
    await K.page.click('.tab[data-tab=home]');

    console.log('\n## What the kitchen may do (P2-PROF-09: nobody\'s chat, private prayers or admin)');
    await K.page.evaluate(() => hub.ready());
    const today = await K.page.evaluate(() => hub.today());
    const larder = await K.page.evaluate(async () => {
      await hub.loaded('leftovers', 'family');
      hub.set('item:kit1', { id: 'kit1', name: 'Kitchen soup', size: 'Large', dateLogged: hub.today(), by: 'kitchen' }, { app: 'leftovers', scope: 'family' });
      return hub.flush();
    });
    ok(larder.sent >= 1 && !larder.rejected, 'the kitchen adds to the Larder through hub.js', JSON.stringify(larder));
    const seen = await api('/api/data/leftovers?scope=family&key=item:kit1', { dt: A.dt });
    ok(seen.body.item && seen.body.item.value && seen.body.item.value.name === 'Kitchen soup', 'another device sees the kitchen\'s Larder row');
    await api('/api/data/f260/f260.summary?scope=person', { method: 'PUT', ...A, body: { value: { week: 7, secret: 'eli-only' } } });
    const kr = await K.page.evaluate(async () => {
      const get = await hub.request('/api/data/f260?scope=person').then(r => r.items.length, e => e.status);
      const put = await hub.request('/api/data/f260/f260.done?scope=person', { method: 'PUT', body: { value: { '1-0': true } } }).then(() => 200, e => e.status);
      const prayerMine = await hub.request('/api/data/prayer/prayer:k-private?scope=person', { method: 'PUT', body: { value: { id: 'k-private', title: 'x' } } }).then(() => 200, e => e.status);
      const timer = await hub.request('/api/data/timer/timer.active?scope=person', { method: 'PUT', body: { value: { endAt: Date.now() + 60000, total: 60 } } }).then(() => 200, e => e.status);
      const admin = await hub.request('/api/admin/usage').then(() => 200, e => e.status);
      return { get, put, prayerMine, timer, admin };
    });
    ok(kr.get === 0, 'the kitchen reads no one\'s person rows (its own F260 scope is empty; Eli\'s stays his)', JSON.stringify(kr));
    ok(kr.put === 403 && kr.prayerMine === 403, 'the kitchen cannot write person rows of F260 or a private prayer list', JSON.stringify(kr));
    ok(kr.admin === 403, 'the kitchen has no admin', JSON.stringify(kr));
    ok(kr.timer === 200, 'the kitchen keeps its own timer row');
    await K.page.evaluate(() => hub.pull());
    await waitFor(() => K.page.$eval('#k-timer', e => /\d+:\d\d/.test(e.textContent)), { label: 'the timer card counting' }).catch(() => {});
    ok(await K.page.$eval('#k-timer', e => /\d+:\d\d/.test(e.textContent) && parseFloat(getComputedStyle(e.querySelector('.k-num')).fontSize) >= 48), 'the running timer shows on the kitchen Home in glance-size numbers', await K.page.$eval('#k-timer', e => e.textContent));
    // GAP-HOME-1 (batch 6): every running timer in the house — the family mirror run:<owner>:<id> each owner's device keeps —
    // with the owner's face; only the kitchen's own has Pause / Stop
    {
      const t0 = Date.now();
      await api('/api/data/timer/timer:k6?scope=person', { method: 'PUT', ...A, body: { value: { id: 'k6', label: 'Roast', total: 3600000, startedAt: t0 - 600000, endAt: t0 + 3000000, pausedAt: null, remaining: null, by: 'eli', ackAt: null }, updated_at: t0 } });
      const m = await api('/api/data/timer/run:eli:k6?scope=family', { method: 'PUT', ...A, body: { value: { label: 'Roast', total: 3600000, startedAt: t0 - 600000, endAt: t0 + 3000000, pausedAt: null, remaining: null, by: 'eli' }, updated_at: t0 } });
      ok(m.status === 200, "Eli's phone keeps the family mirror of his roast timer", JSON.stringify(m.body));
      await K.page.evaluate(() => hub.pull());
      await waitFor(() => K.page.$$eval('#k-timer .k-timer-row', els => els.length >= 2), { label: 'two timers on the kitchen' }).catch(() => {});
      const rows = await K.page.$$eval('#k-timer .k-timer-row', els => els.map(e => ({ owner: e.dataset.owner, face: !!e.querySelector('.avatar'), acts: e.querySelectorAll('[data-ktimer]').length, text: e.textContent.replace(/\s+/g, ' ').trim(), num: (e.querySelector('[data-tleft]') || {}).textContent })));
      ok(rows.some(r => r.owner === 'eli' && r.face && r.acts === 0 && /Eli · Roast/.test(r.text) && /^\d+:\d\d$/.test(r.num || '')), "Eli's running timer shows on the kitchen with his face and name, read-only", JSON.stringify(rows));
      ok(rows.some(r => r.owner === 'kitchen' && r.acts === 2), "the kitchen's own timer has Pause and Reset", JSON.stringify(rows));
      const kr = await K.page.$eval('#k-timer .k-timer-row[data-owner=kitchen] [data-ktimer=reset]', b => ({ name: b.getAttribute('aria-label'), word: b.textContent.trim(), icon: b.querySelector('use').getAttribute('href') })).catch(() => null);
      ok(kr && /^Reset (\S.* )?timer$/.test(kr.name) && kr.word === 'Reset' && /#i-rotate-ccw$/.test(kr.icon), "…Reset is the app's word and drawing (rotate-ccw), with a name", JSON.stringify(kr));
      if (SHOTS) { await K.page.$eval('#k-timer', e => e.scrollIntoView({ block: 'center' })); await K.page.screenshot({ path: path.join(SHOTS, 'kitchen-two-timers.png') }); }
      const before = await K.page.$eval('#k-timer .k-timer-row[data-owner=eli] [data-tleft]', e => e.textContent);
      await sleep(2200);
      const after = await K.page.$eval('#k-timer .k-timer-row[data-owner=eli] [data-tleft]', e => e.textContent);
      ok(before !== after, 'its time counts down in place', before + ' → ' + after);
      await K.page.click('#k-timer .k-timer-row[data-owner=kitchen] [data-ktimer=reset]');
      await waitFor(() => K.page.evaluate(() => hub.request('/api/data/timer?scope=person').then(r => !r.items.some(i => i.value && (i.key === 'timer.active' || /^timer:/.test(i.key))))), { label: 'the kitchen timer stopped on the house' }).catch(() => {});
      ok(await K.page.evaluate(() => hub.request('/api/data/timer?scope=person').then(r => !r.items.some(i => i.value && (i.key === 'timer.active' || /^timer:/.test(i.key))))), "Reset on the kitchen's own timer removes its row from the house");
      ok(await K.page.$$eval('#k-timer .k-timer-row', els => els.length === 1 && els[0].dataset.owner === 'eli'), "…and Eli's stays (the kitchen never clears someone else's)");
      await api('/api/data/timer/timer:k6?scope=person', { method: 'PUT', ...A, body: { value: null, updated_at: Date.now() } });
      await api('/api/data/timer/run:eli:k6?scope=family', { method: 'PUT', ...A, body: { value: null, updated_at: Date.now() } });
    }
    for (const [id, pin] of [['niece', '2468'], ['eli', ADMIN_PIN]]) {
      const noPerson = await K.page.evaluate(([i, p]) => hub.login(i, p).then(() => 'signed in', e => e.error), [id, pin]);
      ok(noPerson === 'kitchen_device', `nobody signs in as a person on the kitchen device (${id})`, noPerson);
    }
    ok(await K.page.evaluate(() => hub.profile && hub.profile.kind) === 'kitchen', '…and the kitchen stays signed in');
    const noKitchen = await api('/api/login', { method: 'POST', dt: A.dt, body: { profile_id: 'kitchen' } });
    ok(noKitchen.status === 403 && noKitchen.body.error === 'not_kitchen_device', 'no other device signs in as the kitchen');
    const pubList = (await api('/api/profiles', { dt: A.dt })).body.profiles;
    ok(pubList.some(p => p.id === 'kitchen' && p.kind === 'kitchen'), 'the profile list marks the kitchen (kind kitchen), which every picker leaves out');
    ok(await K.page.evaluate(() => !hub.people().some(p => p.kind === 'kitchen')), 'hub.people() leaves the kitchen out');
    const chat = await K.page.evaluate(() => hub.request('/api/chat', { method: 'POST', body: { message: 'hi' } }).then(() => 200, e => e.status + ' ' + e.error));
    ok(chat === '403 no_chat', 'the kitchen has no chat', chat);

    console.log('\n## Prayed on the kitchen: the face sheet (everyone in the household), then the tapped person\'s tick');
    await api('/api/data/prayer/prayer:kit-p1?scope=family', { method: 'PUT', ...A, body: { value: { id: 'kit-p1', title: 'Grandpa\'s knee', for: '', category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt: today, lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, by: 'eli', updatedAt: new Date().toISOString() } } });
    await K.page.evaluate(() => hub.pull());
    await waitFor(() => K.page.$eval('#k-pray', e => /Grandpa/.test(e.textContent)), { label: 'the prayer on the kitchen Home' }).catch(() => {});
    ok(/0 of \d+ prayed/.test(await K.page.textContent('#k-pray')), 'the kitchen Home lists today\'s family prayers', await K.page.textContent('#k-pray'));
    await K.page.click('#k-pray ~ .btn[data-open="prayer"]');
    const PF = await appFrame(K.page, 'prayer');
    await PF.waitForSelector('[data-pray="kit-p1"]', { timeout: 15000 });
    await PF.click('[data-pray="kit-p1"]');
    const prayFaces = await faceSheet(PF);
    ok(kids.every(k => prayFaces.includes(k)) && adults.every(a => prayFaces.includes(a)) && !prayFaces.includes('kitchen') && !prayFaces.includes('tv'), 'Prayed opens the face sheet with everyone in the household, kids included (never the kitchen or the TV)', JSON.stringify(prayFaces));
    await PF.click('.hub-who .hub-face[data-id="ezra"]');
    const row = await waitFor(async () => { const r = await api('/api/data/prayer?scope=family&key=prayer:kit-p1', { dt: A.dt }); const v = r.body.item && r.body.item.value; return v && v.prayedBy && Array.isArray(v.prayedBy[today]) && v.prayedBy[today].includes('ezra') ? v : null; }, { timeout: 15000, label: 'Ezra\'s tick on the house copy' }).catch(() => null);
    ok(!!row && !row.prayedBy[today].includes('kitchen'), 'another device sees Ezra (not the kitchen) on today\'s list', JSON.stringify(row && row.prayedBy));
    const feed = await waitFor(async () => { const f = (await api('/api/activity?limit=8', { dt: A.dt })).body.activity; return f.some(l => l.profile_id === 'ezra' && /Grandpa's knee/.test(l.text)) ? f : null; }, { timeout: 15000, label: 'the feed line' }).catch(() => null);
    ok(!!feed, 'the feed line is filed under Ezra, not the kitchen');
    await PF.click('[data-pray="kit-p1"]'); await faceSheet(PF); await PF.click('.hub-who .hub-face[data-id="ezra"]'); await sleep(600);
    // batch 3 (P4-SHAPE-02, on purpose): Prayer's toast is the shared hub.toast (#hub-toast), not its own #toastMsg
    ok(await PF.evaluate(() => /Ezra already prayed/.test((document.getElementById('hub-toast') || {}).textContent || '')), 'a second tap for Ezra says he already prayed and changes nothing');
    await PF.click('[data-pray="kit-p1"]'); await faceSheet(PF); await PF.click('.hub-who .sheet-actions .btn'); await sleep(300);
    ok(!(await PF.$('.hub-who')), 'Cancel closes the face sheet with nothing credited');
    const outsider = await K.page.evaluate(async d => {
      const p = hub.get('prayer:kit-p1', { app: 'prayer', scope: 'family' });
      return hub.request('/api/data/prayer/prayer:kit-p1?scope=family', { method: 'PUT', body: { value: { ...p, prayedBy: { [d]: ['ezra', 'Grandma Jo'] } } } }).then(() => 200, e => e.status + ' ' + e.error);
    }, today);
    ok(outsider === '403 not_allowed', 'a name outside the household is refused', outsider);
    const selfCredit = await K.page.evaluate(async d => {
      await hub.pull();
      const p = hub.get('prayer:kit-p1', { app: 'prayer', scope: 'family' });
      hub.set('prayer:kit-p1', { ...p, prayedBy: { [d]: ['ezra', 'Kitchen'] } }, { app: 'prayer', scope: 'family' });
      const f = await hub.flush();
      const back = hub.get('prayer:kit-p1', { app: 'prayer', scope: 'family' });
      return { f, names: back.prayedBy[d] };
    }, today);
    ok(selfCredit.f.rejected === 1 && JSON.stringify(selfCredit.names) === '["ezra"]', 'a refused row is put back on the device (the kitchen cannot credit itself)', JSON.stringify(selfCredit));

    console.log('\n## The Larder\'s finish: the face sheet has the adults only');
    await api('/api/data/leftovers/item:kit2?scope=family', { method: 'PUT', ...A, body: { value: { id: 'kit2', name: 'Chili', size: 'Medium', dateLogged: today, by: 'eli', byName: 'Eli' } } });
    await K.page.click('#pill-home');
    await K.page.click('.btn[data-open="leftovers"]');
    const LF = await appFrame(K.page, 'leftovers');
    await LF.evaluate(() => hub.pull());
    const pill = await LF.waitForSelector('#newpill:not([hidden])', { timeout: 4000 }).catch(() => null);   // a row from another device waits behind "N new" (batch 0h)
    if (pill) await pill.click();
    const doneBtn = await LF.waitForSelector('.item[data-id="kit2"] .done', { timeout: 15000 });
    await doneBtn.click();
    const larderFaces = await faceSheet(LF);
    ok(!larderFaces.some(f => kids.includes(f)) && adults.every(a => larderFaces.includes(a)), 'finishing opens the face sheet with the household adults and no kids', JSON.stringify(larderFaces));
    await LF.click('.hub-who .hub-face[data-id="dad"]');
    const fin = await waitFor(async () => { const r = await api('/api/data/leftovers?scope=family&key=finished:kit2', { dt: A.dt }); return r.body.item && r.body.item.value; }, { timeout: 20000, label: 'the finished row' }).catch(() => null);
    ok(!!fin && fin.finishedBy === 'dad', 'another device sees the Chili finished by David', JSON.stringify(fin));
    const feed2 = (await api('/api/activity?limit=8', { dt: A.dt })).body.activity;
    ok(feed2.some(l => l.profile_id === 'dad' && /Finished the Chili/.test(l.text)), 'the feed line is filed under David', JSON.stringify(feed2.slice(0, 3).map(l => [l.profile_id, l.text])));
    // batch 8 (IMP-LEFTOVERS-I1): a full swipe on a card is the check button's own path, so on the Kitchen iPad it opens the same face sheet
    await api('/api/data/leftovers/item:kit3?scope=family', { method: 'PUT', ...A, body: { value: { id: 'kit3', name: 'Soup', size: 'Medium', dateLogged: today, by: 'eli', byName: 'Eli' } } });
    await LF.evaluate(() => hub.pull());
    { const pill3 = await LF.waitForSelector('#newpill:not([hidden])', { timeout: 4000 }).catch(() => null); if (pill3) await pill3.click(); }
    await LF.waitForSelector('.item[data-id="kit3"]', { timeout: 15000 });
    await LF.evaluate(() => document.querySelector('.item[data-id="kit3"]').scrollIntoView({ block: 'center' })); await sleep(400);
    { const fe = await (await LF.frameElement()).boundingBox(), g = await LF.$eval('.item[data-id="kit3"]', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      const x0 = fe.x + g.x + g.w - 90, y0 = fe.y + g.y + g.h / 2;
      await K.page.mouse.move(x0, y0); await K.page.mouse.down(); for (let i = 1; i <= 14; i++) await K.page.mouse.move(x0 - (g.w * 0.85) * i / 14, y0); await K.page.mouse.up(); }
    const swipeFaces = await faceSheet(LF);
    ok(!swipeFaces.some(f => kids.includes(f)) && adults.every(a => swipeFaces.includes(a)), 'a full swipe on the Kitchen iPad opens the same face sheet (household adults, no kids)', JSON.stringify(swipeFaces));
    await LF.click('.hub-who .hub-face[data-id="mom"]');
    ok(await waitFor(() => LF.$eval('.item[data-id="kit3"]', c => c.classList.contains('finishing')).catch(() => false), { timeout: 8000, label: 'the swiped card finishing' }).then(() => true, () => false), 'the swiped card then finishes in place with Undo, like the check button');
    await sleep(900); await LF.click('.item[data-id="kit3"] .undo').catch(() => {});
    await api('/api/data/leftovers/item:kit3?scope=family', { method: 'DELETE', ...A }).catch(() => {});
    // the Worker checks finishedBy like by (review of batch 2a): a kid, a guest or the TV is refused, an adult is taken
    const guest = (await api('/api/profiles', { method: 'POST', ...A, body: { name: 'Kitchen Credit', emoji: '🙂', color: '#4C4C58', hue: 'sky' } })).body.profile;
    const pplNow = (await api('/api/profiles', { dt: A.dt })).body.profiles;
    const nameOf = id => (pplNow.find(p => p.id === id) || {}).name;
    const credit = await K.page.evaluate(async ([cases, d]) => {
      const out = {};
      for (const [id, name] of cases) out[id] = await hub.request('/api/data/leftovers/finished:kitc?scope=family', { method: 'PUT', body: { value: { id: 'kitc', name: 'Stew', finishedAt: d, finishedBy: id, finishedByName: name } } }).then(() => '200', e => e.status + ' ' + ((e.data && e.data.rejected) || e.error));
      return out;
    }, [[['ezra', nameOf('ezra')], [guest.id, guest.name], ['tv', nameOf('tv')], ['niece', nameOf('niece')]], today]);
    ok(/^403 bad_credit/.test(credit.ezra) && /^403 bad_credit/.test(credit[guest.id]) && /^403 bad_credit/.test(credit.tv), 'the kitchen cannot credit a finish to a kid, a guest or the TV (403 bad_credit)', JSON.stringify(credit));
    ok(credit.niece === '200', '…and can credit it to a household adult', JSON.stringify(credit));
    await api('/api/data/leftovers/finished:kitc?scope=family', { method: 'DELETE', ...A });

    console.log('\n## A guest\'s reminder on the kitchen Home: ✓, Undo, then ✓ for good (review of batch 2a)');
    const gTok = await signIn(A.dt, guest.id);
    await api('/api/data/reminders/item:kitrem?scope=family', { method: 'PUT', dt: A.dt, pt: gTok, body: { value: { id: 'kitrem', text: 'Guest note for the house', by: guest.id, byName: guest.name, createdAt: Date.now() } } });
    await K.page.click('#pill-home'); await K.page.click('.tab[data-tab=home]');
    await K.page.evaluate(() => hub.pull());
    await K.page.waitForSelector('#k-rem [data-kdone="kitrem"]', { timeout: 15000 });
    const remRow = async () => { const r = await api('/api/data/reminders?scope=family&key=item:kitrem', { dt: A.dt }); return r.body.item && r.body.item.value; };
    await K.page.click('#k-rem [data-kdone="kitrem"]');
    ok(!(await K.page.$('#k-rem [data-kdone="kitrem"]')), '✓ takes the reminder off the kitchen Home at once');
    await K.page.click('#hub-toast .toast-act');
    await sleep(7500); await K.page.evaluate(() => hub.flush());
    ok(!!(await K.page.$('#k-rem [data-kdone="kitrem"]')) && !!(await remRow()), 'Undo within 6 s: the guest\'s reminder is back on the kitchen and was never removed from the house');
    await K.page.click('#k-rem [data-kdone="kitrem"]');
    await sleep(7500); await K.page.evaluate(() => hub.flush());
    ok(!(await remRow()), 'without Undo it is removed for everyone after 6 s');
    ok(!consoleErrors.some(e => /not something|bad_credit/.test(e)), 'no refused write on the way');
    await api(`/api/admin/profiles/${guest.id}`, { method: 'DELETE', ...A });

    console.log('\n## The album\'s Add on the kitchen Home: adults only, filed under the tapped face');
    if (await K.page.$('#viewer.on')) await K.page.click('#pill-home');
    await K.page.click('.tab[data-tab=home]');
    await K.page.waitForSelector('#k-album-add');
    await K.page.setInputFiles('#k-file', path.join(ROOT, 'icons', 'icon-192.png'));
    const albumFaces = await faceSheet(K.page);
    ok(!albumFaces.some(f => kids.includes(f)) && adults.every(a => albumFaces.includes(a)), 'Add a photo opens the face sheet with the household adults and no kids', JSON.stringify(albumFaces));
    await K.page.click('.hub-who .hub-face[data-id="christian"]');
    const photo = await waitFor(async () => { const r = await api('/api/data/hub?scope=family&prefix=album:', { dt: A.dt }); return (r.body.items || []).map(i => i.value).find(v => v && v.by === 'christian'); }, { timeout: 30000, label: 'the album row' }).catch(() => null);
    ok(!!photo && photo.byName === 'Mae', 'another device sees the photo added by Mae', JSON.stringify(photo && { by: photo.by, byName: photo.byName }));
    await K.page.evaluate(() => hub.pull());
    await waitFor(() => K.page.$$eval('#k-album img', i => i.length >= 1), { label: 'the photo on the kitchen Home' }).catch(() => {});
    ok(await K.page.$$eval('#k-album img', i => i.length >= 1), 'the photo shows in the kitchen Home\'s album card');

    console.log('\n## Ezra\'s prayer star, on his own tablet');
    const kidDev = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'Ezra tablet', fp: 'kitchen-test-ezra' } })).body;
    const E = await newContext(browser, 'ezra', { width: 390, height: 844 });
    await E.ctx.addInitScript(([d]) => { try { localStorage.setItem('hub.device', JSON.stringify(d)); } catch {} }, [{ id: kidDev.device_id, token: kidDev.device_token, name: 'Ezra tablet' }]);
    await E.page.goto(SITE + '/index.html');
    await E.page.waitForSelector('.pcard[data-id="ezra"]');
    ok(await E.page.$('.pcard[data-id="kitchen"]') === null, 'Ezra\'s picker has no Kitchen face');
    await E.page.click('.pcard[data-id="ezra"]');
    await waitFor(() => shellShown(E.page), { label: 'Ezra in the shell' });
    await E.page.evaluate(() => { location.hash = 'kidverse'; });
    const star = await waitFor(async () => {
      const r = await api('/api/data/kidverse?scope=family&key=stars:ezra', { dt: A.dt });
      const v = r.body.item && r.body.item.value; return v && v.credited && v.credited.prayed && v.credited.prayed[today] === true ? v : null;
    }, { timeout: 20000, label: 'Ezra\'s prayer star' }).catch(() => null);
    ok(!!star, 'Ezra\'s prayer star for today appears once Kid Verse opens', star ? `count ${star.count}` : 'no star');

    console.log('\n## The admin clears the role from Admin → Devices');
    await AD.page.click('.tab[data-tab=home]'); await AD.page.click('.tab[data-tab=me]');
    await AD.page.waitForSelector(kBtn, { timeout: 15000 });
    await AD.page.click(kBtn); await adminPin(AD.page, '0000');
    await waitFor(() => AD.page.textContent('#apmsg').then(t => /not your PIN/.test(t)), { label: 'wrong PIN message' });
    ok((await api('/api/device', { dt: await K.page.evaluate(() => hub.device.token) })).body.role === 'kitchen', 'a wrong admin PIN leaves the kitchen as it is');
    await AD.page.fill('#apin', ADMIN_PIN); await AD.page.click('#apform button[type=submit]');
    await AD.page.waitForSelector('#apform', { state: 'detached', timeout: 8000 });
    await waitFor(() => AD.page.textContent(kBtn).then(t => /Make it the kitchen/.test(t)), { label: 'the row is ordinary again' });
    ok(true, 'the role is cleared');
    await K.page.evaluate(() => hub.pull().catch(() => {}));
    await K.page.waitForSelector('.pcard[data-id]', { timeout: 15000 });
    ok(!(await shellShown(K.page)) && !(await who(K.page)), 'on its next request the iPad shows the picker, signed out');
    const again = await api('/api/login', { method: 'POST', dt: await K.page.evaluate(() => hub.device.token), body: { profile_id: 'kitchen' } });
    ok(again.status === 403, 'it can no longer act as the kitchen');
    await E.ctx.close(); await K.ctx.close(); await AD.ctx.close();
    // tidy what this test added to the shared local D1
    await api('/api/data/leftovers/item:kit1?scope=family', { method: 'DELETE', ...A });
    await api('/api/data/leftovers/finished:kit2?scope=family', { method: 'DELETE', ...A });
    await api('/api/data/prayer/prayer:kit-p1?scope=family', { method: 'DELETE', ...A });
    if (photo) await api(`/api/album/${photo.id}`, { method: 'DELETE', ...A });
  } catch (e) {
    fail++; console.log('  ✗ test crashed:', e.stack || e.message);
  } finally {
    await browser.close(); server.close();
    if (consoleErrors.length) { console.log('\nconsole errors:'); for (const c of consoleErrors) console.log('  ' + c); }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
