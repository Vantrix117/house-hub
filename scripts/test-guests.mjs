#!/usr/bin/env node
// Roadmap 23 checks: guest profiles on demand. Mae adds "Aunt Sue" from Me on one device (face, colour, a week);
// Sue taps her name on a second device with no PIN and sees every adult app; an already-expired guest is hidden
// from the picker but listed for the admin with Purge; Remove/Purge delete the guest and bounce her device back
// to the picker. Kids still only see the apps that list them. A guest's PIN is fixed at creation (no paired device
// can "create" one on a tap-to-open guest; the admin can clear it), and ending a stay drops the guest's sessions
// and push subscriptions so the reminder jobs never reach a departed visitor.
//   cd worker && npx wrangler dev --port 8787     (seeded local D1 with migrations/005 applied)
//   node scripts/test-guests.mjs <pairing-code>
// Serves the repo on :9023 and proxies /api to the Worker so the page is same-origin (CORS allows only :8765).
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
const PORT = +(process.env.PORT || 9023);
const SITE = 'http://localhost:' + PORT;
const SHOTS = path.join(ROOT, 'docs', 'screens');
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {   // proxy to the Worker
    const u = new URL(API + req.url);
    const headers = { ...req.headers, host: u.host, origin: 'http://localhost:8765' };
    const p = http.request(u, { method: req.method, headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on('error', e => { res.writeHead(502); res.end(String(e)); });
    req.pipe(p);
    return;
  }
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
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
const errors = [];
async function newContext(browser, name, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 800, isMobile: viewport.width < 800, colorScheme: 'light' });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, SITE);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('dialog', d => d.accept());
  await page.goto(SITE + '/index.html'); await page.waitForSelector('#paircode');
  await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); await page.waitForSelector('.pcard[data-id]');
  return { ctx, page };
}
async function signIn(page, id, pin) {
  const create = pin && /Create/.test(await page.$eval(`.pcard[data-id="${id}"] .psub`, e => e.textContent));
  await page.click(`.pcard[data-id="${id}"]`);
  if (pin) {
    await page.waitForSelector('#pad'); await sleep(450);
    const tap = async () => { for (const d of pin) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); };
    await tap();
    if (create) {
      await page.waitForFunction(() => /again/.test((document.getElementById('pinhint') || {}).textContent || ''), null, { timeout: 15000 }); await sleep(200); await tap();
      await page.waitForFunction(() => document.getElementById('gate').hidden || /Enter your PIN/.test((document.getElementById('pinhint') || {}).textContent || ''), null, { timeout: 15000 });
      if (await page.$('#gate:not([hidden]) #pad')) { await sleep(200); await tap(); }
    }
  }
  await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
}
const toPicker = async page => { await page.click('.tab[data-tab=me]'); await page.click('#switch'); await page.waitForSelector('.pcard[data-id]'); };
const tiles = page => page.evaluate(() => [...document.querySelectorAll('#view-apps .tile[data-id]')].map(t => t.dataset.id));
// plain API calls from Node, as another paired device would make them (no page involved)
const api = async (method, p, body, headers = {}) => {
  const r = await fetch(API + p, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8765', ...headers }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8'));
const adultIds = ['eli', 'christian', 'mom', 'dad', 'niece'];
const expectedGuestApps = registry.apps.filter(a => !a.visibleTo || a.visibleTo.some(id => adultIds.includes(id))).map(a => a.id).sort();
const expectedKidApps = registry.apps.filter(a => !a.visibleTo || a.visibleTo.includes('ezra')).map(a => a.id).sort();

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## Mae adds Aunt Sue from Me');
    const A = await newContext(browser, 'A');
    await signIn(A.page, 'christian', '2468');
    await A.page.click('.tab[data-tab=me]');
    ok(await A.page.$('#guests #guest-add') !== null, 'A: Me shows the Guests card with "Add a guest" for an adult');
    await A.page.click('#guest-add');
    await A.page.waitForSelector('#gform');
    ok(await A.page.$$eval('#gemoji button', b => b.length) === 24, 'sheet: a grid of 24 faces');
    ok(await A.page.$$eval('#gswatches .swatch', b => b.length) >= 8, 'sheet: the colour swatches');
    const small = await A.page.$$eval('#gform button, #gform input', els => els.filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).length);
    ok(small === 0, 'sheet: every control is at least 44 px', 'small=' + small);
    await A.page.fill('#gname', 'Aunt Sue');
    await A.page.click('#gemoji [data-e="🌻"]');
    ok(await A.page.$eval('#gemoji [data-e="🌻"]', b => b.classList.contains('on') && b.getAttribute('aria-pressed') === 'true'), 'sheet: picking a face marks it');
    await A.page.click('#gswatches .swatch[data-c="#137F77"]');
    await A.page.click('#gexp [data-x="week"]');
    await A.page.screenshot({ path: path.join(SHOTS, 'rm23-add-guest-sheet.png') });
    await A.page.click('#gform button[type=submit]');
    await waitFor(() => A.page.evaluate(() => !document.querySelector('#gform') && /Aunt Sue/.test(document.body.textContent)), { label: 'sheet closes' });
    const listed = await waitFor(() => A.page.$eval('#guest-list', e => /Aunt Sue/.test(e.textContent) && /until/.test(e.textContent) && /taps to sign in/.test(e.textContent)), { label: 'guest listed' });
    ok(listed, 'A: the Guests card lists Aunt Sue · until <date> · taps to sign in');
    const guest = await A.page.evaluate(() => hub.people().find(p => p.is_guest && p.name === 'Aunt Sue'));
    ok(guest && guest.kind === 'adult' && !guest.is_admin && guest.emoji === '🌻' && guest.color === '#137F77' && guest.created_by === 'christian' && guest.expires_at > Date.now() + 6 * 86400000, 'guest row: adult, not admin, chosen face + colour, created_by christian, expires in ~a week', JSON.stringify(guest));
    await A.page.click('.tab[data-tab=home]'); await A.page.click('#feed-refresh').catch(() => {});
    ok(await waitFor(() => A.page.$eval('#feed', e => /Added a guest: Aunt Sue/.test(e.textContent)), { label: 'feed line' }).catch(() => false), 'A: "Added a guest: Aunt Sue" shows in the Home feed');
    await A.page.click('.tab[data-tab=me]');

    console.log('\n## Sue signs in on a second device without a PIN');
    const B = await newContext(browser, 'B');
    const card = await B.page.waitForSelector(`.pcard[data-id="${guest.id}"]`, { timeout: 15000 });
    ok(!!card, 'B: the picker shows Aunt Sue after one fetch');
    const sub = await B.page.$eval(`.pcard[data-id="${guest.id}"] .psub`, e => e.textContent);
    ok(/^Guest · until /.test(sub), 'B: her card says "Guest · until <date>"', sub);
    ok(await B.page.$eval(`.pcard[data-id="${guest.id}"]`, e => /🌻/.test(e.textContent)), 'B: her card shows the chosen face');
    await sleep(1500); await B.page.$eval(`.pcard[data-id="${guest.id}"]`, e => e.scrollIntoView({ block: 'center' })); await sleep(400);
    await B.page.screenshot({ path: path.join(SHOTS, 'rm23-picker-guest.png') });
    await B.page.click(`.pcard[data-id="${guest.id}"]`);
    await B.page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
    ok(await B.page.$('#pad') === null, 'B: no PIN pad — straight into the shell');
    await B.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
    ok(await B.page.evaluate(() => hub.profile.kind === 'adult' && !hub.profile.isAdmin && hub.canWrite && hub.session.profile.is_guest === true), 'B: signed in as an adult guest who can write');
    await B.page.click('.tab[data-tab=apps]');
    const got = (await tiles(B.page)).sort();
    ok(JSON.stringify(got) === JSON.stringify(expectedGuestApps), 'B: a guest sees every app open to any household adult (F260, Prayer, Larder, …)', got.join(','));
    ok(await B.page.$('.tab[data-tab=chat]') !== null, 'B: the Chat tab is there for a guest');
    await B.page.screenshot({ path: path.join(SHOTS, 'rm23-guest-apps.png') });
    await B.page.click('#view-apps .tile[data-id="f260"]');
    await waitFor(() => B.page.evaluate(() => document.querySelector('#viewer.on') && /f260\.html/.test(document.getElementById('frame').src)), { label: 'F260 opens' });
    const inner = await waitFor(async () => { const fr = B.page.frames().find(f => /f260\.html/.test(f.url())); return fr && await fr.evaluate(() => window.hub && hub.profile && hub.profile.id).catch(() => null); }, { label: 'F260 hub ready' });
    ok(inner === guest.id, 'B: F260 runs as the guest (person scope is hers)', inner);
    await B.page.evaluate(() => hub.set('week', 2, { app: 'hub', scope: 'person' }));
    await waitFor(() => B.page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'B flushed' });
    ok(true, 'B: a guest write flushes to the house');
    await B.page.click('#pill-home');
    await B.page.click('.tab[data-tab=me]');
    ok(await B.page.$('#guests') === null, 'B: a guest cannot add guests (no Guests card on Me)');
    ok(await B.page.$('#photo-btn:not([disabled])') !== null, 'B: a guest can set a photo like any adult');

    console.log('\n## An expired guest is hidden from the picker but the admin still sees her');
    const old = await A.page.evaluate(() => hub.request('/api/profiles', { method: 'POST', body: { name: 'Old Guest', emoji: '🐢', expires_at: 1000 } }).then(r => r.profile));
    ok(old && old.is_guest && old.expires_at === 1000, 'created "Old Guest" with expires_at in the past');
    const C = await newContext(browser, 'C');
    await C.page.waitForSelector(`.pcard[data-id="${guest.id}"]`);
    ok(await C.page.$(`.pcard[data-id="${old.id}"]`) === null, 'C: the picker does not show the expired guest');
    const denied = await C.page.evaluate(id => hub.request('/api/login', { method: 'POST', body: { profile_id: id } }).then(() => 'signed_in').catch(e => e.error), old.id);
    ok(denied === 'guest_expired', 'C: the expired guest cannot sign in (guest_expired)', denied);
    await signIn(C.page, 'ezra');
    await C.page.click('.tab[data-tab=apps]');
    const kidGot = (await tiles(C.page)).sort();
    ok(JSON.stringify(kidGot) === JSON.stringify(expectedKidApps), 'C: a kid still sees only the apps that list them', kidGot.join(','));

    console.log("\n## Eli's admin panel: Guest rows with Remove / Purge");
    await toPicker(A.page);
    await signIn(A.page, 'eli', '1357');
    await A.page.click('.tab[data-tab=me]');
    await A.page.waitForSelector('#admin-body .admin-people');
    const rowText = id => A.page.$eval(`#admin-body [data-edit="${id}"]`, b => b.closest('li').textContent);
    const sueRow = await rowText(guest.id), oldRow = await rowText(old.id);
    ok(/Guest · until /.test(sueRow) && /added by Mae/.test(sueRow) && /Remove/.test(sueRow) && !/Purge/.test(sueRow), 'admin: Aunt Sue row says "Guest · until …" with Remove, no Purge', sueRow.trim());
    ok(/Guest · ended /.test(oldRow) && /Purge/.test(oldRow), 'admin: Old Guest row says "Guest · ended …" with Purge', oldRow.trim());
    ok(await A.page.$$eval('#admin-body .guest-btns .btn', bs => bs.every(b => b.getBoundingClientRect().height >= 44)), 'admin: guest buttons are 44 px tall');
    await A.page.screenshot({ path: path.join(SHOTS, 'rm23-me-guests.png') });
    await A.page.$eval('#admin', e => e.scrollIntoView()); await sleep(300);
    await A.page.screenshot({ path: path.join(SHOTS, 'rm23-admin-guests.png') });
    const D = await newContext(browser, 'D', { width: 1280, height: 900 });
    await signIn(D.page, 'eli', '1357');
    await D.page.click('.tab[data-tab=me]'); await D.page.waitForSelector('#admin-body .admin-people');
    await D.page.$eval('#admin', e => e.scrollIntoView());
    await D.page.screenshot({ path: path.join(SHOTS, 'rm23-admin-guests-desktop.png') });
    ok(await D.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'desktop: no horizontal scroll with guest rows');
    await D.ctx.close();

    console.log("\n## A guest's PIN is fixed at creation; ending a stay stops push");
    const N = { 'X-Device-Token': (await api('POST', '/api/pair', { code: CODE, name: 'guests N' })).body.device_token };
    const hijack = await api('POST', `/api/profiles/${guest.id}/pin`, { pin: '9999' }, N);
    ok(hijack.status === 403 && hijack.body && hijack.body.error === 'guest_pin_fixed', 'another paired device cannot set a PIN on a tap-to-open guest (403 guest_pin_fixed)', JSON.stringify(hijack));
    ok((await api('POST', '/api/login', { profile_id: guest.id }, N)).status === 200, 'Aunt Sue still signs in on tap afterwards');
    const admin = body => A.page.evaluate(b => hub.request(b.p, { method: b.method, body: b.body }), body);
    const pg = (await admin({ method: 'POST', p: '/api/profiles', body: { name: 'Push Guest', emoji: '🐝', pin: '1111', expires_at: Date.now() + 86400000 } })).profile;
    ok(pg && pg.has_pin, 'Eli adds "Push Guest" with a PIN');
    const pgLogin = await api('POST', '/api/login', { profile_id: pg.id, pin: '1111' }, N);
    ok(pgLogin.status === 200, 'Push Guest signs in with her PIN on device N');
    const PG = { ...N, 'X-Profile-Token': pgLogin.body.profile_token };
    const subscription = { endpoint: 'https://push.example/rm23-guest', keys: { p256dh: 'x', auth: 'y' } };
    ok((await api('POST', '/api/push/subscribe', { subscription }, PG)).status === 200, 'Push Guest subscribes to push on device N');
    await A.page.click('.tab[data-tab=home]'); await A.page.click('.tab[data-tab=me]'); await A.page.waitForSelector(`#admin-body [data-resetpin="${pg.id}"]`, { timeout: 15000 });
    const pgRow = await rowText(pg.id);
    ok(/PIN set/.test(pgRow) && /Clear PIN/.test(pgRow), 'admin: a guest with a PIN gets a "Clear PIN" button', pgRow.trim());
    ok(!(await A.page.$(`#admin-body [data-resetpin="${guest.id}"]`)), 'admin: a tap-to-open guest has no Clear PIN button');
    await A.page.click(`#admin-body [data-resetpin="${pg.id}"]`);
    await waitFor(() => A.page.evaluate(id => !document.querySelector(`#admin-body [data-resetpin="${id}"]`), pg.id), { label: 'PIN cleared' });
    ok(/no PIN/.test(await rowText(pg.id)), 'admin: Clear PIN turns her into a tap-to-open guest');
    const pgTap = await api('POST', '/api/login', { profile_id: pg.id }, N);
    ok(pgTap.status === 200, 'Push Guest now signs in on tap (no PIN pad)', JSON.stringify(pgTap.body).slice(0, 120));
    const PG2 = { ...N, 'X-Profile-Token': pgTap.body.profile_token };
    ok((await api('POST', '/api/push/subscribe', { subscription }, PG2)).status === 200, 'her push subscription is (re)registered');
    let usage = await admin({ method: 'GET', p: '/api/admin/usage' });
    ok(usage.push_subscriptions.some(r => r.profile_id === pg.id), 'admin usage lists her push subscription while the stay is on');
    const ended = await admin({ method: 'PUT', p: `/api/admin/profiles/${pg.id}`, body: { expires_at: 1000 } });
    ok(ended.profile && ended.profile.expires_at === 1000, 'Eli ends her stay (expires_at in the past)');
    ok((await api('GET', '/api/me', null, PG2)).status === 401, 'her session on device N is gone (401)');
    usage = await admin({ method: 'GET', p: '/api/admin/usage' });
    ok(!usage.push_subscriptions.some(r => r.profile_id === pg.id), 'her push subscription is deleted the moment the stay ends');
    const morning = await admin({ method: 'POST', p: '/api/admin/cron/run', body: { job: 'morning' } });
    const prayer = await admin({ method: 'POST', p: '/api/admin/cron/run', body: { job: 'prayer' } });
    ok(!JSON.stringify([morning, prayer]).includes(pg.id), 'forced morning + prayer jobs never reach the departed guest', JSON.stringify(morning).slice(0, 200));
    ok(!!(await admin({ method: 'DELETE', p: `/api/admin/profiles/${pg.id}` })).ok, 'cleanup: Push Guest removed');
    await A.page.click('.tab[data-tab=home]'); await A.page.click('.tab[data-tab=me]'); await A.page.waitForSelector(`#admin-body [data-purge="${old.id}"]`, { timeout: 15000 });

    await A.page.click(`#admin-body [data-purge="${old.id}"]`);
    await waitFor(() => A.page.evaluate(id => !document.querySelector(`#admin-body [data-edit="${id}"]`), old.id), { label: 'Old Guest purged' });
    ok(true, 'admin: Purge removes the expired guest');
    ok((await A.page.evaluate(() => hub.people().map(p => p.id))).includes(old.id) === false, 'admin: the profiles cache no longer lists her');
    await A.page.click(`#admin-body [data-remove="${guest.id}"]`);
    await waitFor(() => A.page.evaluate(id => !document.querySelector(`#admin-body [data-edit="${id}"]`), guest.id), { label: 'Aunt Sue removed' });
    ok(true, 'admin: Remove deletes Aunt Sue');
    const gone = await A.page.evaluate(id => hub.request('/api/login', { method: 'POST', body: { profile_id: id } }).then(() => 'signed_in').catch(e => e.error), guest.id);
    ok(gone === 'no_such_profile', 'her profile is gone', gone);
    await B.page.evaluate(() => hub.pull().catch(() => {}));
    await B.page.waitForSelector('.pcard[data-id]', { timeout: 15000 });
    ok(await B.page.$(`.pcard[data-id="${guest.id}"]`) === null, "B: Sue's device drops back to the picker and she is no longer on it");
    ok(await A.page.$('#guests #guest-add') !== null, 'A: Eli (adult) also has the Guests card');
  } catch (e) { fail++; console.log('  ✗ crashed:', e.stack || e); }
  finally {
    await browser.close(); server.close();
    const real = errors.filter(e => !/net::ERR|Failed to fetch|NetworkError|hub:reauth/.test(e));
    ok(real.length === 0, 'no page errors', real.join(' | '));
    console.log(`\nPASS ${pass}  FAIL ${fail}`);
    process.exit(fail ? 1 : 0);
  }
})();
