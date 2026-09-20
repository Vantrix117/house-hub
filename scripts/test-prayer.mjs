#!/usr/bin/env node
// Roadmap 11 checks for apps/prayer.html: "Pray now" is the one primary action on Today, above the fold on a phone;
// tapping it opens the pray-through view; Print, Copy as text and Kitchen view live behind "More"; an empty profile
// gets the illustrated empty state with a single "Add a request" action; the display profile is nudged, not crashed.
//   cd worker && npx wrangler dev --port 8787     (seeded local D1)
//   node scripts/test-prayer.mjs <pairing-code>
// Serves the repo on localhost:8851 and proxies /api to the Worker from the same origin (its CORS list only has :8765).
// Screenshots → docs/screens/rm11-*.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'screens');
const CODE = process.argv[2] || 'local-test-code';
const API = process.env.HUB_API || 'http://127.0.0.1:8787';
const PORT = 8851;
const SITE = `http://localhost:${PORT}`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const h = {}; for (const k of ['content-type', 'x-device-token', 'x-profile-token']) if (req.headers[k]) h[k] = req.headers[k];
    try {
      const r = await fetch(API + req.url, { method: req.method, headers: h, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
      return res.end(buf);
    } catch (e) { res.writeHead(502); return res.end(String(e)); }
  }
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
async function post(pathname, body, headers = {}) {
  const r = await fetch(API + pathname, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
// Pair a device and sign a profile in through the API, so the app can open standalone with the tokens already in localStorage.
async function session(profileId, pin) {
  const pair = await post('/api/pair', { code: CODE, name: 'test-prayer ' + profileId });
  if (!pair.json.device_token) throw new Error('pair failed: ' + JSON.stringify(pair.json));
  const device = { id: pair.json.device_id, token: pair.json.device_token, name: 'test-prayer ' + profileId };
  const dh = { 'X-Device-Token': device.token };
  let login = await post('/api/login', { profile_id: profileId, ...(pin ? { pin } : {}) }, dh);
  if (login.json.error === 'needs_pin_setup') login = await post(`/api/profiles/${profileId}/pin`, { pin }, dh);
  else if (!login.json.profile_token && pin) login = await post('/api/login', { profile_id: profileId, pin }, dh);
  if (!login.json.profile_token) throw new Error('login failed for ' + profileId + ': ' + JSON.stringify(login.json));
  return { device, session: { token: login.json.profile_token, profile: login.json.profile } };
}
const errors = [];
async function openApp(browser, auth, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
  await ctx.addInitScript(({ api, device, session }) => { try {
    localStorage.setItem('hub.api', JSON.stringify(api)); localStorage.setItem('hub.device', JSON.stringify(device)); localStorage.setItem('hub.session', JSON.stringify(session));
  } catch {} }, { api: SITE, ...auth });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  await page.goto(SITE + '/apps/prayer.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && typeof D !== "undefined" && D, null, { timeout: 15000 });
  await sleep(300);
  return { ctx, page };
}
// Wipe Eli's personal list and the family list so the run starts from an empty profile (deletes are tombstones, so this is safe to repeat).
async function clearLists(page) {
  await page.evaluate(async () => {
    for (const scope of ['person', 'family']) for (const r of hub.list('prayer:', { scope })) hub.remove(r.key, { scope });
    await hub.flush();
  });
  await waitFor(() => page.evaluate(() => hub.sync.pending === 0), { label: 'lists cleared' });
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });
const vis = (page, sel) => page.$eval(sel, e => !!(e.offsetParent || e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden').catch(() => false);
const rect = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, width: r.width }; });
const primaries = page => page.$$eval('#s-today button.act', bs => bs.filter(b => !b.classList.contains('ghost') && (b.offsetParent || b.getClientRects().length)).map(b => b.textContent.trim()));
const token = (page, name) => page.evaluate(n => { const d = document.createElement('div'); d.style.background = `var(${n})`; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; }, name);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    const eli = await session('eli', '1357');
    let { ctx, page } = await openApp(browser, eli, 'eli-empty');
    await clearLists(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && typeof D !== "undefined" && D, null, { timeout: 15000 }); await sleep(300);

    console.log('\n## empty profile');
    ok(await page.evaluate(() => D.lists.personal.prayers.length === 0), 'Eli\'s list is empty (no sample data seeded)', await page.evaluate(() => D.lists.personal.prayers.map(p => p.title).join(', ')));
    const img = await page.$eval('#todayList .empty img', i => ({ src: i.getAttribute('src'), w: i.naturalWidth, shown: i.getBoundingClientRect().height > 40 })).catch(() => null);
    ok(img && /art\/empty\/prayers\.svg$/.test(img.src) && img.w > 0 && img.shown, 'empty state shows the prayers illustration', JSON.stringify(img));
    const emptyBtns = await page.$$eval('#todayList .empty button', bs => bs.map(b => b.textContent.trim()));
    ok(emptyBtns.length === 1 && emptyBtns[0] === 'Add a request', 'empty state has a single "Add a request" action', emptyBtns.join(' | '));
    ok(!(await vis(page, '#startPray')) && !(await vis(page, '#moreBtn')), 'Pray now and More are hidden while there is nothing to pray through');
    const emptyPrim = await primaries(page);
    ok(emptyPrim.length === 1 && emptyPrim[0] === 'Add a request', '"Add a request" is the only primary button on the empty Today', emptyPrim.join(' | '));
    ok(!(await page.$('#f-theme')) && !(await page.$('[data-look]')), 'no in-app theme chips (Me tab owns the theme)');
    ok(!(await page.$('#backupWarn')), 'no stale "Safari clears data" warning');
    await shot(page, 'rm11-prayer-empty-390.png');
    await page.click('#todayList .empty button');
    ok(await vis(page, '#s-add'), '"Add a request" opens the Add screen');

    console.log('\n## Pray now is the one primary action');
    await page.fill('#f-title', 'Healing for a neighbour'); await page.fill('#f-for', 'Sam'); await page.click('#f-save'); await sleep(500);
    await page.click('nav button[data-go="add"]'); await page.fill('#f-title', 'Wisdom for the week'); await page.click('#f-save'); await sleep(500);
    await page.click('nav button[data-go="today"]'); await sleep(400);
    await page.evaluate(() => { window.scrollTo(0, 0); document.getElementById('toast').classList.remove('on'); });
    const r = await rect(page, '#startPray');
    ok(await vis(page, '#startPray') && r.bottom <= 844 && r.top >= 0, 'Pray now is visible above the fold at 390×844', JSON.stringify(r));
    ok(r.height >= 60, 'Pray now is at least 60 px tall', r.height);
    ok((await page.$eval('#startPray', b => b.textContent.trim())) === 'Pray now', 'the button says "Pray now"');
    const bg = await page.$eval('#startPray', b => getComputedStyle(b).backgroundColor);
    ok(bg === await token(page, '--accent-deep'), 'Pray now uses the design-token primary colour (--accent-deep)', bg);
    const prim = await primaries(page);
    ok(prim.length === 1 && prim[0] === 'Pray now', 'Pray now is the only primary button on Today', prim.join(' | '));
    const small = await page.$$eval('#s-today button, nav button, .fab', bs => bs.filter(b => b.offsetParent || b.getClientRects().length).map(b => { const q = b.getBoundingClientRect(); return [b.textContent.trim().slice(0, 14) || b.getAttribute('aria-label'), Math.round(q.width), Math.round(q.height)]; }).filter(([, w, h]) => w < 44 || h < 44));
    ok(small.length === 0, 'every visible button on Today is at least 44×44', JSON.stringify(small));
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'no horizontal scroll');
    await shot(page, 'rm11-prayer-today-390.png');
    await page.click('#startPray'); await sleep(400);
    ok(await page.$eval('#pray', p => p.classList.contains('on') && getComputedStyle(p).display !== 'none'), 'tapping Pray now enters the pray-through view');
    ok((await page.$eval('#prayBig', e => e.textContent.trim())).length > 0, 'the first request is on screen', await page.$eval('#prayBig', e => e.textContent));
    await shot(page, 'rm11-prayer-pray-390.png');
    await page.click('#prayNext'); await sleep(200);
    ok(await page.evaluate(() => D.lists.personal.prayers.some(p => p.lastPrayedAt === TODAY)), '"Prayed" marks the request for today');
    await page.click('#prayShut'); await sleep(300);
    ok(!(await page.$eval('#pray', p => p.classList.contains('on'))), 'Close leaves the pray-through view');

    console.log('\n## Print, Copy and Kitchen view sit behind More');
    ok(!(await page.$('#s-today #doPrint')) && !(await page.$('#s-today #copyToday')) && !(await page.$('#s-today #openKitchen')), 'no inline Print / Copy / Kitchen buttons on Today');
    await page.click('#moreBtn'); await sleep(400);
    const sheet = await page.$eval('#sheet', s => ({ on: s.classList.contains('on'), bf: getComputedStyle(s).backdropFilter || getComputedStyle(s).webkitBackdropFilter, items: [...s.querySelectorAll('[data-more]')].map(b => [b.dataset.more, b.textContent.trim().split(/\s{2,}|(?=Big|Paste|A tick)/)[0].trim(), Math.round(b.getBoundingClientRect().height)]) }));
    ok(sheet.on, 'More opens the overflow sheet');
    ok(sheet.bf && sheet.bf !== 'none', 'the overflow sheet is glass (backdrop-filter)', sheet.bf);
    const kinds = sheet.items.map(i => i[0]);
    ok(kinds.includes('kitchen') && kinds.includes('copy') && kinds.includes('print'), 'Kitchen view, Copy as text and Print are in the sheet', JSON.stringify(sheet.items));
    ok(sheet.items.every(i => i[2] >= 44), 'overflow actions are at least 44 px tall', JSON.stringify(sheet.items));
    await shot(page, 'rm11-prayer-more-390.png');
    await page.click('[data-more="kitchen"]'); await sleep(400);
    ok(await page.$eval('#kitchen', k => k.classList.contains('on')), 'Kitchen view opens from More');
    ok(!(await page.$eval('#sheet', s => s.classList.contains('on'))), 'the sheet closes behind it');
    ok((await page.$$eval('#kitchenBody .k-item', i => i.length)) === 2, 'kitchen view lists both requests');
    await page.click('#kitchenShut'); await sleep(300);
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await page.click('#moreBtn'); await sleep(300); await page.click('[data-more="print"]'); await sleep(300);
    ok(await page.evaluate(() => window.__printed === 1 && document.querySelectorAll('#printArea .p-box').length === 2), 'Print builds the tick list and calls print()');
    await page.click('#moreBtn'); await sleep(300); await page.click('[data-more="copy"]'); await sleep(500);
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    ok(/Healing for a neighbour/.test(clip) && /Wisdom for the week/.test(clip), 'Copy as text puts today\'s list on the clipboard', JSON.stringify(clip).slice(0, 80));
    ok(await page.$eval('#toast', t => t.classList.contains('on') && /Copied 2 requests/.test(t.textContent)), 'and says so in a toast');
    ok(!(await page.$eval('#sheet', s => s.classList.contains('on'))), 'the sheet closes after copying');
    await page.evaluate(() => hub.flush());
    await waitFor(() => page.evaluate(() => hub.sync.pending === 0), { label: 'flushed' });
    await ctx.close();

    console.log('\n## the display profile can look but not write');
    const tv = await session('tv');
    ({ ctx, page } = await openApp(browser, tv, 'tv'));
    ok(await page.evaluate(() => hub.canWrite === false), 'kiosk session cannot write');
    ok(!(await vis(page, '.fab')) && !(await vis(page, 'nav [data-go="add"]')), 'kiosk hides the + button and the Add tab');
    await page.click('.switch button[data-list="shared"]'); await sleep(300);
    ok(await page.$eval('#todayList .empty', e => !!e.querySelector('img')) && (await page.$$eval('#todayList .empty button', bs => bs.filter(b => b.offsetParent).length)) === 0, 'kiosk empty state keeps the picture and drops the Add action');
    await page.click('.switch button[data-list="personal"]'); await sleep(200);
    ok(!errors.some(e => e.startsWith('tv:')), 'no page errors for the display profile', errors.filter(e => e.startsWith('tv:')).join(' | '));
    await ctx.close();
  } catch (e) { fail++; console.log('  ✗ threw:', e.stack || e); }
  finally {
    ok(errors.length === 0, 'no console or page errors', errors.join(' | '));
    await browser.close(); server.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
