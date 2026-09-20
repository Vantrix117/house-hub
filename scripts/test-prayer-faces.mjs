#!/usr/bin/env node
// Roadmap 18 checks for apps/prayer.html — family prayer with faces:
//   • the family list shows the requester ("<name> asked") and who prayed as real faces (hub.avatarHtml: photo or emoji on the person colour), 28 px, at most five then "+N";
//   • a kid opens straight on the family list as big cards (title in --fs-2xl, the requester's face, one 64 px Prayed button),
//     with no nav, no list switch, no Add / More / Record, no text input reachable and the private list route blocked;
//   • tapping Prayed adds the kid's name to prayedBy[today] like an adult, so her face shows on the adults' family list.
//   cd worker && npx wrangler dev --port 8787     (seeded local D1)
//   node scripts/test-prayer-faces.mjs <pairing-code>
// Serves the repo on localhost:8978 and proxies /api to the Worker from the same origin (its CORS list only has :8765).
// Screenshots → docs/screens/rm18-*.png
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
const PORT = 8978;
const SITE = `http://localhost:${PORT}`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
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
// Re-pairs every time: other suites reset the shared Worker's sessions, so nothing is assumed.
async function session(profileId, pin) {
  const pair = await post('/api/pair', { code: CODE, name: 'test-prayer-faces ' + profileId });
  if (!pair.json.device_token) throw new Error('pair failed: ' + JSON.stringify(pair.json));
  const device = { id: pair.json.device_id, token: pair.json.device_token, name: 'test-prayer-faces ' + profileId };
  const dh = { 'X-Device-Token': device.token };
  let login = await post('/api/login', { profile_id: profileId, ...(pin ? { pin } : {}) }, dh);
  if (login.json.error === 'needs_pin_setup') login = await post(`/api/profiles/${profileId}/pin`, { pin }, dh);
  else if (!login.json.profile_token && pin) login = await post('/api/login', { profile_id: profileId, pin }, dh);
  if (!login.json.profile_token) throw new Error('login failed for ' + profileId + ': ' + JSON.stringify(login.json));
  const pr = await fetch(API + '/api/profiles', { headers: dh }).then(r => r.json());
  return { device, session: { token: login.json.profile_token, profile: login.json.profile }, profiles: pr.profiles || [] };
}
const errors = [];
async function openApp(browser, auth, name, { width = 390, height = 844, seedPeople = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: width < 700, isMobile: width < 700, colorScheme: 'light' });
  await ctx.addInitScript(({ api, device, session, profiles }) => { try {
    localStorage.setItem('hub.api', JSON.stringify(api)); localStorage.setItem('hub.device', JSON.stringify(device)); localStorage.setItem('hub.session', JSON.stringify(session));
    if (profiles) localStorage.setItem('hub.profiles', JSON.stringify(profiles)); else localStorage.removeItem('hub.profiles');
  } catch {} }, { api: SITE, device: auth.device, session: auth.session, profiles: seedPeople ? auth.profiles : null });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  await page.goto(SITE + '/apps/prayer.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && typeof D !== "undefined" && D, null, { timeout: 15000 });
  await sleep(300);
  return { ctx, page };
}
async function clearLists(page) {
  await page.evaluate(async () => {
    for (const scope of ['person', 'family']) for (const r of hub.list('prayer:', { scope })) hub.remove(r.key, { scope });
    await hub.flush();
  });
  await waitFor(() => page.evaluate(() => hub.sync.pending === 0), { label: 'lists cleared' });
}
const flushed = page => page.evaluate(() => hub.flush()).then(() => waitFor(() => page.evaluate(() => hub.sync.pending === 0), { label: 'flushed' }));
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name), fullPage: false });
const vis = (page, sel) => page.$eval(sel, e => !!(e.offsetParent || e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden').catch(() => false);
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
// Every face in the who-prayed row(s) of the family Today list: title (name), size, and the --tint it carries.
const faces = page => page.$$eval('#todayList .who .avatar, #todayList .who .init, #todayList .who .more', els => els.map(e => {
  const r = e.getBoundingClientRect(); return { cls: e.className, title: e.getAttribute('title'), w: Math.round(r.width), h: Math.round(r.height), tint: e.style.getPropertyValue('--tint').trim(), img: !!e.querySelector('img'), text: e.textContent.trim() }; }));
// The requester on each family row (adults' list): face class, name, size, tint and the label text.
const askers = page => page.$$eval('#todayList .row .asker', els => els.map(e => { const a = e.querySelector('.avatar, .init'); const r = a ? a.getBoundingClientRect() : { width: 0, height: 0 };
  return { cls: a ? a.className : '', title: a && a.getAttribute('title'), w: Math.round(r.width), h: Math.round(r.height), tint: a ? a.style.getPropertyValue('--tint').trim() : '', text: (e.querySelector('.by') || e).textContent.trim() }; }));
const visibleInputs = page => page.$$eval('input, textarea, select, [contenteditable]', els => els.filter(e => (e.offsetParent || e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden').map(e => e.id || e.tagName));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    const eli = await session('eli', '1357');
    const kiara = await session('kiara');
    const P = Object.fromEntries(eli.profiles.map(p => [p.id, p]));
    ok(P.eli && P.kiara && P.kiara.kind === 'kid', 'the profiles list has Eli and Kiara (kid)', Object.keys(P).join(','));

    console.log('\n## apps.json: the prayer app is visible to the kids');
    const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps;
    const pr = apps.find(a => a.id === 'prayer');
    ok(pr && pr.visibleTo.includes('ezra') && pr.visibleTo.includes('kiara'), 'prayer.visibleTo lists ezra and kiara', JSON.stringify(pr && pr.visibleTo));

    console.log('\n## Eli adds a family prayer and marks it prayed');
    let { ctx, page } = await openApp(browser, eli, 'eli');
    await clearLists(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && typeof D !== "undefined" && D, null, { timeout: 15000 }); await sleep(300);
    await page.click('.switch button[data-list="shared"]'); await sleep(300);
    ok(await page.evaluate(() => D.activeList === 'shared'), 'Eli switches to the Family list');
    await page.click('nav button[data-go="add"]'); await sleep(200);
    await page.fill('#f-title', 'Healing for Grandma'); await page.fill('#f-for', 'Grandma'); await page.click('#f-save'); await sleep(500);
    await page.click('nav button[data-go="today"]'); await sleep(300);
    const added = await page.evaluate(() => D.lists.shared.prayers.map(p => ({ title: p.title, by: p.by })));
    ok(added.length === 1 && added[0].title === 'Healing for Grandma' && added[0].by === 'eli', 'the family list has the request, authored by eli', JSON.stringify(added));
    ok((await faces(page)).length === 0, 'no who-prayed faces before anyone prays');
    let asked = await askers(page);
    ok(asked.length === 1 && /\bavatar\b/.test(asked[0].cls) && asked[0].title === 'Eli' && asked[0].text === 'Eli asked', 'the adult family row shows the requester as a face: "Eli asked"', JSON.stringify(asked));
    ok(asked[0] && asked[0].w === 28 && asked[0].h === 28 && asked[0].tint.toUpperCase() === P.eli.color.toUpperCase(), 'the requester face is 28 px in Eli\'s colour', JSON.stringify(asked[0]));
    await page.click('.switch button[data-list="personal"]'); await sleep(200);
    ok((await askers(page)).length === 0, 'the private list shows no requester face');
    await page.click('.switch button[data-list="shared"]'); await sleep(200);
    await page.click('#todayList .mark'); await sleep(300);
    let f = await faces(page);
    ok(f.length === 1 && f[0].title === 'Eli' && /\bavatar\b/.test(f[0].cls), 'after Eli prays, his face is on the row (hub.avatarHtml)', JSON.stringify(f));
    ok(f[0] && f[0].w === 28 && f[0].h === 28, 'the face is 28 px', JSON.stringify(f[0]));
    ok(f[0] && f[0].tint.toUpperCase() === P.eli.color.toUpperCase(), 'and carries Eli\'s colour as --tint', f[0] && f[0].tint);
    // "+N": seven names on a row show five faces and "+2" (rendered locally, not saved)
    const plusN = await page.evaluate(() => { const p = D.lists.shared.prayers[0]; const keep = p.prayedBy[TODAY];
      p.prayedBy[TODAY] = ['Eli', 'Kiara', 'Ezra', 'Elizabeth', 'David', 'Mea', 'Mae']; renderToday();
      const out = { faces: document.querySelectorAll('#todayList .who .avatar, #todayList .who .init').length, more: (document.querySelector('#todayList .who .more') || {}).textContent };
      p.prayedBy[TODAY] = keep; renderToday(); return out; });
    ok(plusN.faces === 5 && plusN.more === '+2', 'seven names → five faces then "+2"', JSON.stringify(plusN));
    await flushed(page);
    await shot(page, 'rm18-prayer-family-eli-390.png');
    await ctx.close();

    console.log('\n## Kiara (kid) opens the app');
    ({ ctx, page } = await openApp(browser, kiara, 'kiara', { seedPeople: false }));   // no profiles cache: the app must fetch faces itself
    ok(await page.evaluate(() => hub.isKid === true && document.documentElement.dataset.kind === 'kid'), 'kid session, <html data-kind="kid">');
    ok(await page.evaluate(() => D.activeList === 'shared'), 'opens straight on the family list');
    ok(await vis(page, '#s-today') && !(await vis(page, '#s-all')) && !(await vis(page, '#s-add')) && !(await vis(page, '#s-more')) && !(await vis(page, '#s-answered')), 'only the Today screen is shown');
    ok(!(await vis(page, 'nav')) && !(await vis(page, '.switch')) && !(await vis(page, '.fab')) && !(await vis(page, '#todayActions')) && !(await vis(page, '#moreBtn')), 'no nav, no Mine/Family switch, no +, no Pray now / More');
    const inputs = await visibleInputs(page);
    ok(inputs.length === 0, 'no input, textarea, select or contenteditable is reachable', inputs.join(','));
    await waitFor(() => page.$$eval('#todayList .kid', c => c.length === 1), { label: 'kid card' });
    const card = await page.$eval('#todayList .kid', c => {
      const t = c.querySelector('.kt'), b = c.querySelector('.prayed'), a = c.querySelector('.kby .avatar'), root = getComputedStyle(document.documentElement);
      const br = b.getBoundingClientRect();
      return { title: t.textContent.trim(), titleFs: getComputedStyle(t).fontSize, fs2xl: root.getPropertyValue('--fs-2xl').trim(), btn: b.textContent.trim(), btnW: Math.round(br.width), btnH: Math.round(br.height),
        pressed: b.getAttribute('aria-pressed'), asker: (c.querySelector('.kby') || {}).textContent.trim(), askerTint: a && a.style.getPropertyValue('--tint').trim(), askerSize: a && Math.round(a.getBoundingClientRect().width),
        buttons: c.querySelectorAll('button').length, opens: c.querySelectorAll('[data-open]').length };
    });
    ok(card.title === 'Healing for Grandma', 'the card shows the request title', card.title);
    ok(card.titleFs === card.fs2xl && parseInt(card.fs2xl) >= 34, 'the title is set in --fs-2xl (kid scale)', card.titleFs + ' vs ' + card.fs2xl);
    ok(card.buttons === 1 && card.btn === 'Prayed' && card.pressed === 'false', 'one "Prayed" button per card, not yet pressed', JSON.stringify(card));
    ok(card.btnH >= 64 && card.btnW >= 64, 'the Prayed button is at least 64 px', card.btnW + '×' + card.btnH);
    ok(/Eli asked/.test(card.asker) && card.askerTint.toUpperCase() === P.eli.color.toUpperCase() && card.askerSize === 44, 'the requester\'s face (Eli, his colour) is on the card', JSON.stringify([card.asker, card.askerTint, card.askerSize]));
    ok(card.opens === 0, 'the card does not open the detail sheet (no data-open)');
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'no horizontal scroll at 390');
    await shot(page, 'rm18-prayer-kid-390.png');

    console.log('\n## the private list and the other screens are unreachable for a kid');
    const blocked = await page.evaluate(() => {
      const out = {};
      go('all'); out.all = document.getElementById('s-today').classList.contains('on') && !document.getElementById('s-all').classList.contains('on');
      go('add'); out.add = document.getElementById('s-today').classList.contains('on') && !document.getElementById('s-add').classList.contains('on');
      go('more'); out.more = document.getElementById('s-today').classList.contains('on') && !document.getElementById('s-more').classList.contains('on');
      document.querySelector('nav button[data-go="all"]').click(); out.navAll = document.getElementById('s-today').classList.contains('on');
      document.querySelector('.switch button[data-list="personal"]').click(); out.list = D.activeList;
      document.getElementById('fab').click(); out.fab = document.getElementById('s-today').classList.contains('on');
      return out; });
    ok(blocked.all && blocked.add && blocked.more, 'go("all" | "add" | "more") lands on Today', JSON.stringify(blocked));
    ok(blocked.navAll && blocked.fab, 'the hidden nav / + buttons cannot leave Today either');
    ok(blocked.list === 'shared', 'the hidden Mine switch cannot reach the private list', blocked.list);
    ok(!(await vis(page, '#sheet')) && !(await vis(page, '#pray')) && (await visibleInputs(page)).length === 0, 'still no sheet, pray-through view or input on screen');

    console.log('\n## Kiara taps Prayed');
    await page.click('#todayList .kid .prayed'); await sleep(300);
    const after = await page.evaluate(() => { const p = D.lists.shared.prayers[0]; return { names: p.prayedBy[TODAY] || [], done: document.querySelector('#todayList .kid').classList.contains('done'), pressed: document.querySelector('#todayList .kid .prayed').getAttribute('aria-pressed'), line: document.getElementById('todayLine').textContent }; });
    ok(after.names.includes('Kiara') && after.names.includes('Eli'), 'her name joins prayedBy[today] next to Eli\'s', JSON.stringify(after.names));
    ok(after.done && after.pressed === 'true', 'the card turns done', JSON.stringify(after));
    ok(after.line === 'You prayed for everyone today!', 'the headline cheers', after.line);
    f = await faces(page);
    ok(f.some(x => x.title === 'Kiara' && /\bavatar\b/.test(x.cls)) && f.some(x => x.title === 'Eli'), 'the card\'s who-prayed row shows both faces', JSON.stringify(f));
    await page.click('#todayList .kid .prayed'); await sleep(200);
    ok(await page.evaluate(() => (D.lists.shared.prayers[0].prayedBy[TODAY] || []).filter(n => n === 'Kiara').length === 1), 'a second tap does not un-pray or double her');
    await flushed(page);
    await shot(page, 'rm18-prayer-kid-done-390.png');
    ok(!errors.some(e => e.startsWith('kiara:')), 'no page errors for the kid', errors.filter(e => e.startsWith('kiara:')).join(' | '));
    await ctx.close();

    // the same at iPad width
    ({ ctx, page } = await openApp(browser, kiara, 'kiara-1024', { width: 1024, height: 768 }));
    await waitFor(() => page.$$eval('#todayList .kid', c => c.length === 1), { label: 'kid card 1024' });
    ok(!(await vis(page, 'nav')) && (await visibleInputs(page)).length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'at 1024: no nav, no input, no horizontal scroll');
    await shot(page, 'rm18-prayer-kid-1024.png');
    await ctx.close();

    console.log('\n## Eli reloads and sees Kiara\'s face');
    ({ ctx, page } = await openApp(browser, eli, 'eli-2'));
    ok(await page.evaluate(() => D.activeList === 'shared'), 'Eli comes back on the Family list (his choice was saved)');
    f = await waitFor(async () => { const x = await faces(page); return x.some(a => a.title === 'Kiara') ? x : null; }, { label: 'Kiara\'s face on Eli\'s row' });
    const k = f.find(a => a.title === 'Kiara');
    ok(/\bavatar\b/.test(k.cls) && k.tint.toUpperCase() === P.kiara.color.toUpperCase() && k.w === 28, 'Kiara\'s avatar (her colour, 28 px) is in who-prayed', JSON.stringify(k));
    ok(f.length === 2 && f.every(a => /\bavatar\b/.test(a.cls)), 'both faces are avatars, no initials fallback', JSON.stringify(f));
    asked = await askers(page);
    ok(asked.length === 1 && asked[0].title === 'Eli' && /\bavatar\b/.test(asked[0].cls) && asked[0].w === 28, 'the requester face (Eli, 28 px) is still on the row after reload', JSON.stringify(asked));
    ok(await vis(page, 'nav') && await vis(page, '.switch') && (await page.$$eval('#todayList .kid', c => c.length)) === 0, 'an adult still gets the normal rows, nav and list switch');
    await shot(page, 'rm18-prayer-family-eli-after-390.png');
    await ctx.close();
  } catch (e) { fail++; console.log('  ✗ threw:', e.stack || e); }
  finally {
    ok(errors.length === 0, 'no console or page errors', errors.join(' | '));
    await browser.close(); server.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
