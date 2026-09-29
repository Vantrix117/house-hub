#!/usr/bin/env node
// The Kitchen device, data and server half (KITCHEN-1, audit batch 0d), against a LOCAL API.
//
//   1. cd worker && npx wrangler dev --port 8787        (local D1 with schema+seed, migrations/006, a pairing code)
//   2. node scripts/test-kitchen.mjs <pairing-code>      (ADMIN_PIN=<pin> if Eli already has one)
//
// A personal session on the kitchen iPad moves to the kitchen on its next request once the admin marks the device; the
// kitchen writes the family apps, cannot read or write anyone's person scope, cannot sign in as a person, and nobody else
// can sign in as it; a face tap on Prayed credits the tapped person (Ezra's prayer star appears once Kid Verse opens); a
// name outside the household is refused; clearing the role sends the device back to the picker, no longer the kitchen.
// The face sheet and the kitchen Home are batch 2a (KITCHEN-2); here the kitchen's writes are made through hub.js.
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
const ADMIN_PIN = process.env.ADMIN_PIN || '1357';
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
  return { ctx, page, name };
}
async function tapDigits(page, digits) { for (const d of digits) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); }
const who = page => page.evaluate(() => hub.profile && { id: hub.profile.id, kind: hub.profile.kind });
const shellShown = page => page.evaluate(() => !document.getElementById('shell').hidden && document.getElementById('gate').hidden);

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    // the admin's own phone and Ezra's tablet, by API
    const adminDev = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'Eli phone', fp: 'kitchen-test-admin' } })).body;
    const eli = await signIn(adminDev.device_token, 'eli', ADMIN_PIN);
    const A = { dt: adminDev.device_token, pt: eli };

    console.log('\n## The kitchen iPad starts as an ordinary device with Mea signed in');
    const K = await newContext(browser, 'kitchen');
    await K.page.goto(SITE + '/index.html');
    await K.page.waitForSelector('#paircode');
    await K.page.fill('#paircode', CODE); await K.page.fill('#pairname', 'Kitchen iPad');
    await K.page.click('#pairform button[type=submit]');
    await K.page.waitForSelector('.pcard[data-id]');
    ok(await K.page.$('.pcard[data-id="kitchen"]') === null, 'the picker on an ordinary device has no Kitchen face');
    await K.page.click('.pcard[data-id="niece"]');
    await K.page.waitForSelector('#pad');
    await tapDigits(K.page, '2468'); await sleep(200); await tapDigits(K.page, '2468');   // first tap: create and confirm
    await waitFor(() => shellShown(K.page), { label: 'Mea in the shell' });
    ok((await who(K.page)).id === 'niece', 'Mea is signed in on the iPad');
    const kDevice = await K.page.evaluate(() => hub.device.id);

    console.log('\n## The admin marks it as the kitchen (from another device, with the admin PIN)');
    ok((await api(`/api/admin/devices/${kDevice}/role`, { method: 'PUT', ...A, body: { role: 'kitchen', admin_pin: '0000' } })).status === 403, 'a wrong admin PIN is refused');
    const set = await api(`/api/admin/devices/${kDevice}/role`, { method: 'PUT', ...A, body: { role: 'kitchen', admin_pin: ADMIN_PIN } });
    ok(set.status === 200 && set.body.role === 'kitchen', 'the role is set', JSON.stringify(set.body));
    await K.page.evaluate(() => hub.pull().catch(() => {}));   // "its next request"
    await waitFor(async () => { const w = await who(K.page); return w && w.kind === 'kitchen' && await shellShown(K.page); }, { label: 'the kitchen shell' });
    ok(true, 'on its next request the iPad is the kitchen, with no picker in between');
    ok(await K.page.evaluate(() => !document.querySelector('.pcard')), 'no profile picker on screen');
    const tiles = await K.page.evaluate(async () => { document.querySelector('.tab[data-tab=apps]').click(); await new Promise(r => setTimeout(r, 400)); return [...document.querySelectorAll('.tile[data-id]')].map(t => t.dataset.id).sort(); });
    ok(JSON.stringify(tiles) === JSON.stringify(['leftovers', 'prayer', 'tally', 'timer']), 'the kitchen\'s apps are the Larder, Prayer, Timer and Tally', JSON.stringify(tiles));

    console.log('\n## What the kitchen may do');
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
      return { get, put, prayerMine, timer };
    });
    ok(kr.get === 0, 'the kitchen reads no one\'s person rows (its own F260 scope is empty; Eli\'s stays his)', JSON.stringify(kr));
    ok(kr.put === 403 && kr.prayerMine === 403, 'the kitchen cannot write person rows of F260 or a private prayer list', JSON.stringify(kr));
    ok(kr.timer === 200, 'the kitchen keeps its own timer row');
    const noPerson = await K.page.evaluate(() => hub.login('niece', '2468').then(() => 'signed in', e => e.error));
    ok(noPerson === 'kitchen_device', 'nobody signs in as a person on the kitchen device', noPerson);
    ok(await K.page.evaluate(() => hub.profile && hub.profile.kind) === 'kitchen', '…and the kitchen stays signed in');
    const noKitchen = await api('/api/login', { method: 'POST', dt: A.dt, body: { profile_id: 'kitchen' } });
    ok(noKitchen.status === 403 && noKitchen.body.error === 'not_kitchen_device', 'no other device signs in as the kitchen');
    const pubList = (await api('/api/profiles', { dt: A.dt })).body.profiles;
    ok(pubList.some(p => p.id === 'kitchen' && p.kind === 'kitchen'), 'the profile list marks the kitchen (kind kitchen), which every picker leaves out');
    ok(await K.page.evaluate(() => !hub.people().some(p => p.kind === 'kitchen')), 'hub.people() leaves the kitchen out');
    const chat = await K.page.evaluate(() => hub.request('/api/chat', { method: 'POST', body: { message: 'hi' } }).then(() => 200, e => e.status + ' ' + e.error));
    ok(chat === '403 no_chat', 'the kitchen has no chat', chat);

    console.log('\n## A face tap on Prayed credits the tapped person');
    await api('/api/data/prayer/prayer:kit-p1?scope=family', { method: 'PUT', ...A, body: { value: { id: 'kit-p1', title: 'Grandpa\'s knee', for: '', category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt: today, lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, by: 'eli', updatedAt: new Date().toISOString() } } });
    const tap = await K.page.evaluate(async d => {
      hub.use('prayer', 'family'); hub.pull().catch(() => {});      // the shell syncs the family list on the kitchen Home from batch 2a
      await hub.loaded('prayer', 'family');
      const p = hub.get('prayer:kit-p1', { app: 'prayer', scope: 'family' });
      hub.set('prayer:kit-p1', { ...p, lastPrayedAt: d, prayedBy: { [d]: ['Ezra'] }, updatedAt: new Date().toISOString() }, { app: 'prayer', scope: 'family' });
      const f = await hub.flush();
      await hub.activity('Prayed for Grandpa\'s knee (family list)', 'prayer', { as: 'ezra' });
      return f;
    }, today);
    ok(tap.sent >= 1 && !tap.rejected, 'the kitchen\'s Prayed, credited to Ezra, is saved', JSON.stringify(tap));
    const feed = (await api('/api/activity?limit=5', { dt: A.dt })).body.activity;
    ok(feed.some(l => l.profile_id === 'ezra' && /Grandpa's knee/.test(l.text)), 'the feed line is filed under Ezra, not the kitchen', JSON.stringify(feed.slice(0, 2).map(l => [l.profile_id, l.text])));
    const outsider = await K.page.evaluate(async d => {
      const p = hub.get('prayer:kit-p1', { app: 'prayer', scope: 'family' });
      return hub.request('/api/data/prayer/prayer:kit-p1?scope=family', { method: 'PUT', body: { value: { ...p, prayedBy: { [d]: ['Ezra', 'Grandma Jo'] } } } }).then(() => 200, e => e.status + ' ' + e.error);
    }, today);
    ok(outsider === '403 not_allowed', 'a name outside the household is refused', outsider);
    const selfCredit = await K.page.evaluate(async d => {
      const p = hub.get('prayer:kit-p1', { app: 'prayer', scope: 'family' });
      hub.set('prayer:kit-p1', { ...p, prayedBy: { [d]: ['Ezra', 'Kitchen'] } }, { app: 'prayer', scope: 'family' });
      const f = await hub.flush();
      const back = hub.get('prayer:kit-p1', { app: 'prayer', scope: 'family' });
      return { f, names: back.prayedBy[d] };
    }, today);
    ok(selfCredit.f.rejected === 1 && JSON.stringify(selfCredit.names) === '["Ezra"]', 'a refused row is put back on the device (the kitchen cannot credit itself)', JSON.stringify(selfCredit));
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

    console.log('\n## The admin clears the role');
    const clr = await api(`/api/admin/devices/${kDevice}/role`, { method: 'PUT', ...A, body: { role: null, admin_pin: ADMIN_PIN } });
    ok(clr.status === 200 && clr.body.role === null, 'the role is cleared');
    await K.page.evaluate(() => hub.pull().catch(() => {}));
    await K.page.waitForSelector('.pcard[data-id]', { timeout: 15000 });
    ok(!(await shellShown(K.page)) && !(await who(K.page)), 'on its next request the iPad shows the picker, signed out');
    const again = await api('/api/login', { method: 'POST', dt: await K.page.evaluate(() => hub.device.token), body: { profile_id: 'kitchen' } });
    ok(again.status === 403, 'it can no longer act as the kitchen');
    await E.ctx.close(); await K.ctx.close();
    // tidy what this test added to the shared local D1
    await api('/api/data/leftovers/item:kit1?scope=family', { method: 'DELETE', ...A });
    await api('/api/data/prayer/prayer:kit-p1?scope=family', { method: 'DELETE', ...A });
  } catch (e) {
    fail++; console.log('  ✗ test crashed:', e.stack || e.message);
  } finally {
    await browser.close(); server.close();
    if (consoleErrors.length) { console.log('\nconsole errors:'); for (const c of consoleErrors) console.log('  ' + c); }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
