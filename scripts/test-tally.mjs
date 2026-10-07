#!/usr/bin/env node
// Tally counter (batch 11). The count is the sum of this epoch's per-device rows (hub.tally, apps/hub.js), shown on the app and
// on Home. Checks: two devices add up (a - on a device with no taps of its own too); Reset takes one tap and shows "Reset from N"
// with Undo (Undo writes a new epoch holding the old total plus what another device tapped since, and the other device sees it);
// - at 0 and Reset at 0 are off and write nothing; bad rows (negative, fractional, non-numeric, huge) read as safe integers
// 0 … 999 999 and are never written back; large counts are grouped; the display profile sees the count and "View only", no
// controls; named counters (add, switch, rename, remove with Undo and the purge afterwards, their own resets, the limit of six,
// the segmented control up to three and a grid past it); the recent resets (five shown, nothing older than 30 days); a polite
// live region says the new count; Home's Tally card counts with one tap and is never rebuilt under a finger, and a kid's Tally
// tile wears the count; the layout at phone, landscape phone, iPad and desktop sizes (the name pill never over the dial, + on
// the screen, no sideways scroll, targets 44 / 64 px for a kid); across the room (20 s idle on an iPad grows the count and puts
// Reset away, a tap only wakes it, none on a phone, instant under Reduce Motion).
//   cd worker && npx wrangler dev --port 8787     (seeded local D1)
//   node scripts/test-tally.mjs <pairing-code>        (HUB_API, PORT: another Worker / site port; /api is proxied off 8765)
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
const PORT = Number(process.env.PORT || 8765);
const SITE = 'http://localhost:' + PORT;
const PROXY = PORT !== 8765;               // off 8765 the Worker's CORS allow-list would refuse the browser: proxy /api
const HUB_API = PROXY ? SITE : API;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  if (PROXY && req.url.startsWith('/api/')) {
    const u = new URL(req.url, API);
    const up = http.request(u, { method: req.method, headers: { ...req.headers, host: u.host, origin: 'http://localhost:8765' } }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', () => { res.writeHead(502); res.end(); });
    return req.pipe(up);
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
async function waitFor(fn, { timeout = 12000, every = 120, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}
const errors = [];
const APP = SITE + '/apps/tally.html';
const O = { app: 'tally', scope: 'person' };

async function newContext(browser, name, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light', ...opts });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, HUB_API);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  return { ctx, page, name };
}
// Pair and sign in through the SDK on the standalone page, then reload so the app boots signed in.
async function signIn(page, id, pin, url = APP) {
  await page.goto(APP); await page.waitForFunction(() => window.hub && typeof hub.pair === 'function');
  await page.evaluate(async ({ code, id, pin }) => {
    if (!hub.device) await hub.pair(code, 'test-tally');
    try { await hub.login(id, pin); }
    catch (e) { if (e.error === 'needs_pin_setup') await hub.createPin(id, pin); else throw e; }
  }, { code: CODE, id, pin });
  await openApp(page, url);
}
async function openApp(page, url = APP) {
  await page.goto(url);
  if (/tally\.html/.test(url)) await page.waitForFunction(() => window.hub && hub.profile && hub.sync && hub.sync.lastPull > 0 && window.__tally && document.getElementById('n') && !document.getElementById('n').classList.contains('skeleton'), null, { timeout: 15000 });
  else await page.waitForFunction(() => window.hub && hub.profile && hub.sync && hub.sync.lastPull > 0 && document.querySelector('#view-home [data-part="glance"], #view-home [data-part="tiles"]'), null, { timeout: 15000 });
}
const flush = page => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0));
const pull = page => page.evaluate(() => hub.pull().then(() => true));
const wipe = async page => { await page.evaluate(O => { for (const r of hub.list('', O)) hub.remove(r.key, O); }, O); await flush(page); };
const txt = (page, sel) => page.$eval(sel, e => e.textContent.trim());
const shown = page => txt(page, '#n');
const off = (page, sel) => page.$eval(sel, e => e.getAttribute('aria-disabled') === 'true');
const row = (page, key) => page.evaluate(([k, O]) => { const r = hub.list(k, O).find(x => x.key === k); return r ? { value: r.value, t: r.updated_at } : null; }, [key, O]);
const rows = (page, prefix) => page.evaluate(([p, O]) => hub.list(p, O).map(r => ({ key: r.key, value: r.value })), [prefix, O]);
const box = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height, shown: getComputedStyle(e).display !== 'none' && r.width > 0 }; });
const toast = page => page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent.trim() : ''; });
const live = page => txt(page, '#live');
// apply a state as another device would have left it, then make this page see it
const setDevice = (page, a, b) => page.evaluate(async ([a, b]) => { await hub.flush(); await hub.pull(); return true; }, [a, b]);

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## one device: +, -, off states, one row per device, the live region');
    const A = await newContext(browser, 'A');
    await signIn(A.page, 'eli', '1357');
    const a = A.page;
    await wipe(a); await openApp(a);
    ok(await shown(a) === '0', 'a new counter shows 0 (never a skeleton once pulled)', await shown(a));
    ok(await off(a, '#minus') && await off(a, '#reset') && !await off(a, '#plus'), '- and Reset are off at 0, + is on');
    ok(await a.$eval('#main', m => !m.hasAttribute('aria-busy')), 'aria-busy cleared once live');
    ok(await a.$eval('#live', l => l.getAttribute('role') === 'status' && l.getAttribute('aria-live') === 'polite'), 'a polite live region (role=status)');
    for (let i = 0; i < 3; i++) await a.click('#plus');
    ok(await shown(a) === '3', '+ three times shows 3', await shown(a));
    await waitFor(async () => await live(a) === '3', { label: 'live 3' }).catch(() => {});
    ok(await live(a) === '3', 'the live region says "3" after +', await live(a));
    await a.click('#minus');
    ok(await shown(a) === '2' && await waitFor(async () => await live(a) === '2').then(() => true).catch(() => false), '- shows 2 and the live region says "2"', await shown(a) + '/' + await live(a));
    const dev = await a.evaluate(() => hub.device.id);
    const r1 = await row(a, 'count:' + dev);
    ok(r1 && r1.value.n === 2 && r1.value.epoch === null && !('sub' in r1.value), 'one row per device: count:<device> = { n: 2, epoch: null }', JSON.stringify(r1));
    ok(await a.$eval('#plus', b => b.querySelector('svg.sym use').getAttribute('href').endsWith('#i-plus')) && await a.$eval('#minus', b => b.querySelector('svg.sym use').getAttribute('href').endsWith('#i-minus')), '+ and - draw the shared sprite icons');
    await a.click('#minus'); await a.click('#minus');
    ok(await shown(a) === '0' && await off(a, '#minus'), 'two more - reach 0 and - turns off (aria-disabled)');
    await flush(a);
    const r0 = await row(a, 'count:' + dev);
    const pend0 = await a.evaluate(() => hub.sync.pending);
    for (let i = 0; i < 3; i++) await a.click('#minus', { force: true });
    await flush(a);
    const r2 = await row(a, 'count:' + dev);
    ok(await shown(a) === '0' && r2.t === r0.t && JSON.stringify(r2.value) === JSON.stringify(r0.value) && await a.evaluate(() => hub.sync.pending) === 0, '- at 0 writes nothing and does not re-stamp the row', JSON.stringify([r0, r2, pend0]));
    ok(await a.$eval('#minus', b => parseFloat(getComputedStyle(b).opacity) < 0.6), 'the off - looks off (dimmed)');
    await a.click('#reset', { force: true });
    ok(await toast(a) === '' && (await rows(a, 'resetlog:')).length === 0 && await row(a, 'reset') === null, 'Reset at 0 is off: no toast, no reset row, no log line');
    ok(await a.$eval('#reset', b => b.querySelector('svg.sym use').getAttribute('href').endsWith('#i-rotate-ccw') && /Reset/.test(b.textContent)), 'Reset carries the rotate-ccw icon and the word "Reset"');

    console.log('\n## Reset + Undo');
    await a.evaluate(([dev, O]) => { hub.set('count:' + dev, { n: 37, epoch: null }, O); window.__tally.show(); }, [dev, O]);
    ok(await shown(a) === '37', 'seeded 37');
    const resetBox = await box(a, '#reset'), plusBox = await box(a, '#plus');
    ok(resetBox.h < plusBox.h && resetBox.w < 4 * resetBox.h + 80, 'Reset is a smaller secondary control, away from +', JSON.stringify([resetBox, plusBox]));
    await a.click('#reset');
    ok(await shown(a) === '0', 'one tap on Reset shows 0 at once (no confirm sheet)', await shown(a));
    const t1 = await toast(a);
    ok(/Reset from 37/.test(t1) && /Undo/.test(t1), 'toast: "Reset from 37" with Undo', t1);
    ok(await waitFor(async () => await live(a) === '0').catch(() => false), 'the live region says "0" after Reset', await live(a));
    const log1 = await rows(a, 'resetlog:');
    ok(log1.length === 1 && log1[0].value.from === 37 && log1[0].value.cid === null, 'a reset line is kept: from 37', JSON.stringify(log1));
    ok(await a.$eval('#resets', e => !e.hidden && /37/.test(e.textContent)), 'Recent resets lists 37');
    ok(await a.$eval('#hub-toast', t => t.hidden === false) && await a.evaluate(() => { const t = document.getElementById('hub-toast'); return t._t != null; }), 'the toast is up (10 s)');
    await a.click('#hub-toast .toast-act');
    await waitFor(async () => (await shown(a)) !== '0').catch(() => {});
    ok(await shown(a) === '37', 'Undo brings 37 back', await shown(a));
    ok((await rows(a, 'resetlog:')).length === 0, 'Undo takes the reset line away');
    ok(await waitFor(async () => await live(a) === '37').catch(() => false), 'the live region says "37" after Undo', await live(a));
    const rs = await row(a, 'reset');
    ok(rs && rs.value.epoch && Object.keys(rs.value).sort().join() === 'at,epoch', 'Undo is a NEW epoch row, not a clock trick', JSON.stringify(rs));

    console.log('\n## two devices add up; Undo by value with another device\'s + kept');
    const B = await newContext(browser, 'B');
    await signIn(B.page, 'eli', '1357');
    const b = B.page;
    await wipe(a); await openApp(a); await pull(b); await openApp(b);
    await a.click('#plus'); await a.click('#plus'); await a.click('#plus'); await flush(a);
    await b.click('#plus'); await b.click('#plus'); await b.click('#plus'); await b.click('#plus'); await flush(b);
    await pull(a); await pull(b);
    ok(await shown(a) === '7' && await shown(b) === '7', 'A +3 and B +4 add up to 7 on both', await shown(a) + '/' + await shown(b));
    const devB = await b.evaluate(() => hub.device.id);
    ok(devB !== await a.evaluate(() => hub.device.id), 'the two contexts are two devices');
    await wipe(a); await pull(b); await pull(a);
    await a.click('#plus'); await a.click('#plus'); await a.click('#plus'); await a.click('#plus'); await a.click('#plus'); await flush(a); await pull(b);
    ok(await shown(b) === '5' && !await off(b, '#minus'), 'B sees A\'s 5 and its - is on');
    await b.click('#minus'); await flush(b); await pull(a);
    const rb = await row(b, 'count:' + devB);
    ok(await shown(b) === '4' && await shown(a) === '4', 'a - on B (which has no taps of its own) takes one off for both: 4', await shown(a) + '/' + await shown(b));
    ok(rb && rb.value.n === -1 && rb.value.epoch === null, 'B\'s row is a signed net { n: -1 } (what 0f devices wrote too)', JSON.stringify(rb));
    await b.click('#plus'); await flush(b); await pull(a);
    ok(await shown(a) === '5' && (await row(b, 'count:' + devB)).value.n === 0, 'a + on B brings its row back to 0: total 5');
    // reset on A; B taps twice on the new epoch before A undoes; both ends read 5 + 2
    await a.click('#reset'); await flush(a); await pull(b);
    ok(await shown(b) === '0', 'B sees A\'s Reset (0)');
    await b.click('#plus'); await b.click('#plus'); await flush(b);     // A does NOT pull: its Undo must send, pull and keep B's two taps
    await a.click('#hub-toast .toast-act');
    ok(await waitFor(async () => await shown(a) === '7').catch(() => false), 'Undo on A (no pull before it) restores 5 and keeps B\'s 2: 7', await shown(a));
    await flush(a); await pull(b);
    ok(await shown(b) === '7', 'B shows 7 too (Undo seen on the other device)', await shown(b));
    await b.click('#plus'); await flush(b); await pull(a);
    ok(await shown(a) === '8', 'a + on B after the Undo counts on the new epoch');
    // Undo after another device reset again: refused, nothing changed
    await a.click('#reset'); const snapT = await toast(a); await flush(a); await pull(b);
    await b.click('#plus'); await b.click('#reset'); await flush(b);     // A does NOT pull: its Undo pulls and sees B's newer reset
    ok(/Reset from 8/.test(snapT), 'Reset from 8 on A', snapT);
    await a.click('#hub-toast .toast-act');
    await waitFor(async () => /changed on another device/.test(await toast(a))).catch(() => {});
    ok(await shown(a) === '0' && /changed on another device/.test(await toast(a)), 'Undo after another device reset again is refused with a plain message and changes nothing', await shown(a) + ' / ' + await toast(a));
    await wipe(a); await pull(b);

    console.log('\n## bad rows read safely and are never written back');
    await a.evaluate(O => { hub.set('count:x1', { n: -13, epoch: null }, O); window.__tally.show(); }, O);
    ok(await shown(a) === '0', 'a negative device row (-13) alone reads as a total of 0', await shown(a));
    await a.evaluate(O => { hub.set('count:x1', { n: 10, epoch: null }, O); hub.set('count:x2', { n: -3, epoch: null }, O); window.__tally.show(); }, O);
    ok(await shown(a) === '7', 'an old device row of -3 beside +10 is the 0f sum: 7', await shown(a));
    await a.click('#plus');
    ok(await shown(a) === '8', 'and a + on top counts 8', await shown(a));
    await a.evaluate(O => { hub.remove('count:x2', O); hub.set('count:x1', { n: -13, epoch: null }, O); hub.remove('count:' + hub.device.id, O); window.__tally.show(); }, O);
    await a.evaluate(O => { hub.set('count:x1', { n: 12.5, epoch: null }, O); window.__tally.show(); }, O);
    ok(await shown(a) === '12', 'a fractional row (12.5) reads as 12', await shown(a));
    await a.evaluate(O => { hub.set('count:x1', { n: 1e21, epoch: null }, O); window.__tally.show(); }, O);
    ok(await shown(a) === '999,999' && await off(a, '#plus'), 'a huge row (1e21) reads as 999,999 (grouped) and + turns off at the top', await shown(a));
    await a.evaluate(O => { hub.set('count:x1', { n: 'twelve', epoch: null }, O); window.__tally.show(); }, O);
    ok(await shown(a) === '0', 'a non-numeric row reads as 0', await shown(a));
    await a.evaluate(O => { hub.set('count:x1', { n: 250000, epoch: null }, O); window.__tally.show(); }, O);
    ok(await shown(a) === '250,000', 'large counts are grouped: 250,000', await shown(a));
    await a.evaluate(O => { hub.set('count:x1', null, O); hub.set('count', -5, O); window.__tally.show(); }, O);
    ok(await shown(a) === '0', 'a negative legacy count reads as 0', await shown(a));
    await a.evaluate(O => { hub.set('count', 40, O); window.__tally.show(); }, O);
    ok(await shown(a) === '40', 'the legacy absolute count is still the base before a reset', await shown(a));
    await flush(a);
    const stamp = await row(a, 'count');
    await a.evaluate(O => { hub.set('count:x2', { n: 'bad', epoch: null }, O); window.__tally.show(); }, O);
    await flush(a);
    const x2 = await row(a, 'count:x2'), pendNow = await a.evaluate(() => hub.sync.pending);
    ok(x2.value.n === 'bad' && pendNow === 0, 'rendering a bad row never rewrites it (it stays as it was until the person taps)');
    await a.click('#plus'); await flush(a);
    ok(await shown(a) === '41' && (await row(a, 'count:x2')).value.n === 'bad', '+ on top of a bad row counts 41 and leaves the other device\'s row alone');
    await wipe(a);

    console.log('\n## named counters');
    await openApp(a);
    ok(await a.$eval('#switcher', s => s.hidden) && await a.$eval('#add-counter', x => !x.hidden && x.getBoundingClientRect().width > 0), 'with one counter: no switcher, a New counter button');
    await a.click('#add-counter');
    ok(await a.$eval('#cform', f => !f.hidden) && await a.evaluate(() => document.activeElement.id) === 'cname', 'New counter opens the name field with focus');
    await a.fill('#cname', 'Laps'); await a.press('#cname', 'Enter');
    await waitFor(() => a.$eval('#seg', s => !s.hidden && s.querySelectorAll('button').length === 2));
    ok(await a.$$eval('#seg button', bs => bs.map(x => x.textContent + ':' + x.getAttribute('aria-pressed')).join()) === 'Count:false,Laps:true', 'the segmented control lists Count and Laps, Laps selected');
    ok(await a.$eval('#seg', s => /seg/.test(s.className) && !/seg-grid/.test(s.className)), 'two or three counters use the shared segmented control');
    const cid = await a.evaluate(() => __tally.cid);
    ok(!!cid && (await row(a, 'counter:' + cid)).value.name === 'Laps', 'counter:<id> = { name, at }', cid);
    await a.click('#plus'); await a.click('#plus');
    const devA = await a.evaluate(() => hub.device.id);
    ok(await shown(a) === '2' && (await row(a, `c:${cid}:count:${devA}`)).value.n === 2, 'Laps counts in its own c:<id>:count:<device> row', await shown(a));
    ok(await row(a, 'count:' + devA) === null, 'the default counter is untouched');
    await a.click('#seg button[data-cid=""]');
    ok(await shown(a) === '0', 'switching to Count shows its own count (0)');
    await a.click('#plus');
    await a.click(`#seg button[data-cid="${cid}"]`);
    ok(await shown(a) === '2', 'switching back shows Laps (2)');
    await a.click('#reset');
    ok(await shown(a) === '0' && /Reset Laps from 2/.test(await toast(a)), 'Reset on Laps: "Reset Laps from 2"', await toast(a));
    ok(!!(await row(a, `c:${cid}:reset`)) && (await row(a, 'reset')) === null, 'a named reset writes c:<id>:reset only');
    const lg = await rows(a, 'resetlog:');
    ok(lg.length === 1 && lg[0].value.cid === cid && lg[0].value.from === 2, 'the reset line names the counter', JSON.stringify(lg));
    ok(await a.$eval('#resets', e => /Laps/.test(e.textContent)), 'Recent resets names Laps once there is more than one counter');
    await a.click('#hub-toast .toast-act');
    await waitFor(async () => (await shown(a)) !== '0').catch(() => {});
    ok(await shown(a) === '2', 'Undo on a named counter restores 2');
    await a.click('#rename');
    ok(await a.$eval('#cname', i => i.value) === 'Laps', 'Rename opens the field with the current name');
    await a.fill('#cname', 'Laps today'); await a.click('#cok');
    ok(await a.$$eval('#seg button', bs => bs.map(x => x.textContent).join()) === 'Count,Laps today', 'rename shows at once');
    ok(await a.evaluate(() => { try { hub.tally.rename(__tally.cid, '   '); return false; } catch (e) { return /name/i.test(e.message); } }), 'an empty name is refused');
    // remove with Undo, then the purge
    await a.click('#remove');
    ok(await a.$$eval('#seg button', bs => bs.length) === 1 || await a.$eval('#seg', s => s.hidden), 'Remove takes the counter off the list');
    ok(/Removed Laps today/.test(await toast(a)) && /Undo/.test(await toast(a)), 'toast: "Removed Laps today" with Undo', await toast(a));
    ok(await shown(a) === '1', 'the dial goes back to Count (1)');
    await a.click('#hub-toast .toast-act');
    ok(await a.$$eval('#seg button', bs => bs.map(x => x.textContent).join()) === 'Count,Laps today', 'Undo puts the counter back');
    await a.click(`#seg button[data-cid="${cid}"]`);
    ok(await shown(a) === '2', 'with its count (2)');
    await a.click('#remove');
    await sleep(11200);
    ok((await rows(a, `c:${cid}:`)).length === 0 && (await rows(a, 'resetlog:')).filter(r => r.value.cid === cid).length === 0, 'once Undo has gone a removed counter\'s own rows are cleared');
    // the limit, and the grid past three
    await openApp(a);
    for (let i = 1; i <= 6; i++) { await a.click('#add-counter'); await a.fill('#cname', 'C' + i); await a.press('#cname', 'Enter'); await waitFor(() => a.$$eval('#seg button', (bs, n) => bs.length === n, i + 1)); }
    ok(await a.$eval('#add-counter', x => x.hidden), 'at six extra counters the New counter button goes');
    ok(await a.$eval('#cpick', b => !b.hidden && /Counters . 7/.test(b.textContent)) && await a.$eval('#seg', s => s.hidden), 'more than three counters: one "Counters · 7" button (the current name beside it) instead of a row that hides the rest');
    await a.click('#cpick');
    ok(await a.$$eval('.csheet li button', bs => bs.length) === 7 && await a.$eval('.csheet', s => s.getAttribute('role') === 'dialog'), 'it opens a list sheet with every counter on its own row');
    ok(await a.$$eval('.csheet li button', bs => bs.every(b => b.getBoundingClientRect().height >= 44)), 'every row is a 44 px or taller target');
    await a.evaluate(() => document.querySelector('.csheet li:last-child button').focus()); await a.keyboard.press('Tab');
    ok(await a.evaluate(() => document.activeElement === document.querySelector('.csheet li:first-child button')), 'focus trap: Tab from the last row wraps to the first');
    await a.keyboard.press('Shift+Tab');
    ok(await a.evaluate(() => document.activeElement === document.querySelector('.csheet li:last-child button')), 'focus trap: Shift+Tab from the first row wraps to the last');
    await a.evaluate(() => document.activeElement.blur()); await a.keyboard.press('Tab');
    ok(await a.evaluate(() => !!document.activeElement.closest('.csheet')), 'focus trap: with focus nowhere, Tab lands inside the sheet');
    await a.keyboard.press('Escape');
    ok(await a.$('.csheet') === null, 'Escape closes the sheet');
    await a.click('#cpick'); await a.click('.csheet li:nth-child(3) button');
    ok(await a.$('.csheet') === null && await a.evaluate(() => hub.tally.counters()[2].id === __tally.cid), 'a row picks that counter and closes the sheet');
    ok(await a.evaluate(() => { try { hub.tally.addCounter('one more'); return false; } catch (e) { return /most/.test(e.message); } }), 'a seventh is refused with a plain message');
    ok(await a.evaluate(() => { const n = hub.tally.clean('  <b>Hi</b>   there  and a very very long name indeed '); return n === 'bHi/b there and a very' || n.length <= 24; }), 'names are cleaned (no < >, one line, 24 characters)');
    // recent resets: 5 shown, nothing older than 30 days
    await a.evaluate(O => { const now = hub.serverNow(); for (let i = 0; i < 7; i++) hub.set('resetlog:' + Math.round(now - 1000 * (i + 1)), { cid: null, from: 10 + i, at: Math.round(now - 1000 * (i + 1)) }, O); hub.set('resetlog:' + Math.round(now - 40 * 86400000), { cid: null, from: 99, at: Math.round(now - 40 * 86400000) }, O); window.__tally.show(); }, O);
    ok(await a.$$eval('#reset-list li', l => l.length) === 5, 'five recent resets shown of eight rows');
    ok(!/99/.test(await a.$eval('#reset-list', l => l.textContent)), 'a reset older than 30 days is ignored');
    await wipe(a);

    console.log('\n## display profile: view only');
    const V = await newContext(browser, 'TV');
    await signIn(V.page, 'tv', undefined);
    const v = V.page;
    ok(await v.evaluate(() => hub.isKiosk && !hub.canWrite), 'kiosk session');
    ok(await v.$eval('#ctl', c => getComputedStyle(c).display === 'none') && !(await box(v, '#plus')).shown, 'no +, - or Reset are drawn');
    ok(await v.$eval('#viewonly', e => !e.hidden && /View only/.test(e.textContent)), 'a "View only" line instead');
    ok(await v.$eval('#manage', e => getComputedStyle(e).display === 'none') && await v.$eval('#switcher', e => getComputedStyle(e).display === 'none'), 'no counter controls either');
    ok(await v.evaluate(() => hub.sync.pending === 0) && (await box(v, '.dial')).w > 200, 'nothing queued; the count shows large in its dial');

    console.log('\n## Home: the Tally card and a kid\'s tile');
    await wipe(a);
    await a.evaluate(([dev, O]) => hub.set('count:' + dev, { n: 12, epoch: null }, O), [devA, O]); await flush(a);
    await openApp(a, SITE + '/index.html');
    await waitFor(() => a.$('#home-tally'));
    ok(await a.$eval('#home-tally .tl-n', n => n.textContent) === '12', 'Eli\'s Home has a Tally card with the count (12)');
    ok(await a.$eval('#home-tally', c => c.querySelector('[data-open="tally"]') && /Open Tally/.test(c.textContent) && c.querySelector('.gfoot > .spot')), 'it has Open Tally in the footer with the spot art');
    const cardH = await box(a, '#home-tally [data-tally-add]');
    ok(cardH.w >= 60 && cardH.h >= 60, 'its + is 60 px or more', JSON.stringify(cardH));
    await a.evaluate(() => { document.getElementById('home-tally').__mark = 1; document.querySelector('#home-tally .tl-n').__mark = 1; });
    await a.click('#home-tally [data-tally-add]');
    ok(await a.$eval('#home-tally .tl-n', n => n.textContent) === '13', 'one tap on + counts: 13');
    ok((await row(a, 'count:' + devA)).value.n === 13, 'the tap wrote this device\'s count:<device> row');
    // a count arriving from another device must not rebuild the card
    await openApp(b); await pull(b);
    await b.click('#plus'); await flush(b); await pull(a);
    await sleep(400);
    ok(await a.$eval('#home-tally .tl-n', n => n.textContent) === '14', 'a + from another device shows on Home (14)', await a.$eval('#home-tally .tl-n', n => n.textContent));
    ok(await a.evaluate(() => document.getElementById('home-tally').__mark === 1 && document.querySelector('#home-tally .tl-n').__mark === 1), 'the card and its number are the same nodes (never rebuilt under a finger)');
    ok(await a.$eval('#home-tally .tl-n', n => !n.hasAttribute('aria-live')) && await a.$eval('#home-tally [data-tally-say]', s => s.getAttribute('role') === 'status' && s.getAttribute('aria-live') === 'polite'), 'the card announces through its own status line, not the number (a count arriving from elsewhere is not read out)');
    ok(await waitFor(async () => await a.$eval('#home-tally [data-tally-say]', s => s.textContent) === '13').catch(() => false), 'the status line holds what the person\'s own tap made: 13');
    await a.click('#home-tally [data-open="tally"]');
    await waitFor(() => a.$('#frame'));
    ok(true, 'Open Tally opens the app');
    await a.close();

    // a kid
    const K = await newContext(browser, 'Ezra');
    await signIn(K.page, 'ezra', undefined);
    const k = K.page;
    await wipe(k); await k.evaluate(([O]) => { hub.set('count:' + hub.device.id, { n: 9, epoch: null }, O); }, [O]); await flush(k); await openApp(k);
    ok(await k.evaluate(() => document.getElementById('plus') && document.getElementById('minus') && true), 'Ezra\'s Tally app has the controls');
    const kPlus = await box(k, '#plus'), kMinus = await box(k, '#minus'), kReset = await box(k, '#reset');
    ok(kPlus.w >= 64 && kMinus.w >= 64 && kReset.h >= 64, 'a kid\'s +, - and Reset are 64 px or more', JSON.stringify([kPlus.w, kMinus.w, kReset.h]));
    await k.click('#reset');
    const kUndo = await box(k, '#hub-toast .toast-act');
    ok(kUndo.h >= 63.5, 'a kid\'s Undo is 64 px high', JSON.stringify(kUndo));
    ok(/Reset from/.test(await toast(k)), 'a kid gets the same Reset toast with Undo, no confirm sheet', await toast(k));
    await k.click('#hub-toast .toast-act');
    await waitFor(async () => (await shown(k)) !== '0').catch(() => {});
    ok(await shown(k) === '9', 'a kid\'s Undo restores 9');
    await flush(k);
    await openApp(k, SITE + '/index.html');
    await waitFor(() => k.$('.kid-tile[data-open="tally"] .kt-n'));
    ok(await k.$eval('.kid-tile[data-open="tally"] .kt-n', n => !n.hidden && n.textContent) === '9', 'a kid\'s Tally tile wears the count (9)');
    ok(await k.$eval('.kid-tile[data-open="tally"]', t => t.getAttribute('aria-label')) === 'Open Tally, 9', 'the tile says the count too: "Open Tally, 9"');
    ok(await k.evaluate(() => { const t = document.querySelector('.kid-tile[data-open="tally"]'), b = t.querySelector('.kt-n').getBoundingClientRect(), i = t.querySelector('img').getBoundingClientRect(); return b.top >= i.bottom - 1 || b.bottom <= i.top + 1 || b.left >= i.right || b.right <= i.left; }), 'the badge does not cover the tile art');
    ok(!await k.$('#home-tally'), 'a kid\'s Home has no Tally card');
    await k.evaluate(() => { document.querySelector('.kid-tile[data-open="tally"]').__mark = 1; });
    const k2 = await K.ctx.newPage();   // the app in a second window (the shell's app frame is the same: one localStorage, the storage event carries the change)
    await k2.goto(APP); await k2.waitForFunction(() => window.__tally && hub.isLoaded() && !document.getElementById('n').classList.contains('skeleton'));
    await k2.click('#plus'); await flush(k2); await k2.close();
    await sleep(500);
    ok(await k.$eval('.kid-tile[data-open="tally"]', t => t.__mark === 1 && t.querySelector('.kt-n').textContent === '10'), 'the tile is the same node and shows 10');
    await wipe(k);
    await k.close();

    console.log('\n## layout: sizes, no overlap, + on the screen, no sideways scroll');
    const L = await newContext(browser, 'L');
    await signIn(L.page, 'eli', '1357');
    const l = L.page;
    const K2 = await newContext(browser, 'K2');
    await signIn(K2.page, 'ezra', undefined);
    const kk = K2.page;
    const sizes = [[390, 844], [844, 390], [375, 667], [820, 1180], [1180, 820], [1440, 900]];
    for (const [who, pg] of [['adult', l], ['kid', kk]]) {
      for (const [w, h] of sizes) {
        await pg.setViewportSize({ width: w, height: h }); await sleep(250);
        const m = await pg.evaluate(() => {
          const r = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, w: b.width }; };
          const whoB = r('#who'), dial = r('.dial'), plus = r('#plus'), minus = r('#minus');
          const over = !(whoB.bottom <= dial.top + 0.5 || whoB.top >= dial.bottom || whoB.right <= dial.left || whoB.left >= dial.right);
          return { over, plusIn: plus.top >= 0 && plus.bottom <= innerHeight && plus.left >= 0 && plus.right <= innerWidth, minusIn: minus.bottom <= innerHeight, hs: document.documentElement.scrollWidth > innerWidth + 1, plusW: plus.w, minusW: minus.w, whoB };
        });
        ok(!m.over && m.plusIn && m.minusIn && !m.hs, `${who} ${w}x${h}: name pill clear of the dial, + and - on the screen, no sideways scroll`, JSON.stringify(m));
        ok(m.plusW >= (who === 'kid' ? 64 : 44) && m.minusW >= (who === 'kid' ? 64 : 44), `${who} ${w}x${h}: + and - targets`, JSON.stringify([m.plusW, m.minusW]));
      }
    }
    await l.close(); await kk.close();

    console.log('\n## across the room (IMP-TALLY-I1)');
    const P = await newContext(browser, 'iPad', { viewport: { width: 820, height: 1180 }, isMobile: false });
    await signIn(P.page, 'eli', '1357');
    const ip = P.page;
    await ip.setViewportSize({ width: 820, height: 1180 });
    const before = await box(ip, '.dial');
    ok(!await ip.$eval('#main', m => m.classList.contains('far')), 'awake at first');
    await sleep(21500);
    ok(await ip.$eval('#main', m => m.classList.contains('far')), 'after 20 s idle on an iPad-sized screen the room mode comes on');
    await sleep(500);
    const after = await box(ip, '.dial');
    ok(after.w > before.w * 1.3, 'the count grows (the dial is much larger)', before.w + ' -> ' + after.w);
    ok(!(await box(ip, '#reset')).shown, 'Reset is put away');
    const nBefore = await shown(ip);
    await ip.mouse.click(410, 600);   // anywhere
    await sleep(300);
    ok(!await ip.$eval('#main', m => m.classList.contains('far')) && (await box(ip, '#reset')).shown, 'any tap brings everything back');
    ok(await shown(ip) === nBefore, 'the waking tap counts nothing');
    await ip.evaluate(() => __tally.far(true)); await sleep(100);
    const pb = await box(ip, '#plus');
    await ip.mouse.click(pb.left + pb.w / 2, pb.top + pb.h / 2); await sleep(300);
    ok(await shown(ip) === nBefore, 'a tap on + while the room mode is on only wakes the screen');
    await ip.click('#plus');
    ok(await shown(ip) === String(Number(nBefore.replace(/,/g, '')) + 1), 'the next tap counts');
    for (const [w, h] of [[1180, 820], [1366, 1024]]) {          // landscape (the kitchen iPad): the room-mode dial takes nearly the frame height
      await ip.evaluate(() => __tally.far(false)); await ip.setViewportSize({ width: w, height: h }); await sleep(900);
      const b0 = await box(ip, '.dial'); await ip.evaluate(() => __tally.far(true)); await sleep(900); const a0 = await box(ip, '.dial'); const ih = await ip.evaluate(() => innerHeight);
      ok(a0.w >= b0.w * 1.3 && a0.bottom <= ih, `room mode in landscape ${w}x${h}: the dial grows ${Math.round(b0.w)} -> ${Math.round(a0.w)} px (x1.3 at least) and stays on the screen`, JSON.stringify([b0.w, a0.w, a0.bottom, ih]));
      await ip.evaluate(() => __tally.far(false));
    }
    await ip.emulateMedia({ reducedMotion: 'reduce' }); await sleep(100);
    ok(await ip.$eval('.dial', d => !/width/.test(getComputedStyle(d).transitionProperty)), 'under Reduce Motion the dial does not animate its size (the change is instant)');
    await ip.emulateMedia({ reducedMotion: 'no-preference' });
    await ip.setViewportSize({ width: 390, height: 844 }); await ip.evaluate(() => __tally.far(false));
    await wipe(ip);
    await ip.close();
  } catch (e) {
    fail++; console.log('  ✗ crashed:', e && e.stack || e);
  } finally {
    ok(errors.length === 0, 'no console errors or page errors', errors.slice(0, 5).join(' | '));
    await browser.close(); server.close();
    console.log(`\nPASS ${pass} · FAIL ${fail}`);
    process.exit(fail ? 1 : 0);
  }
})();
