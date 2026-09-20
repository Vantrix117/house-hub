#!/usr/bin/env node
// Roadmap 12 checks: the Larder Ledger is list-first. Signed in as Eli on a 390×844 phone, three items logged
// through the sticky glass add bar come back oldest first with a freshness bar each; the oldest item, its chip
// and the add bar all fit in the viewport at once; "Copy list for Hearth" still copies; and the "Nd ago" ages,
// the groups and the date box roll over when midnight passes while the page is open. The display profile (kiosk)
// sees the list but no bar and no Hearth block.
//   cd worker && npx wrangler dev --port 8787     (seeded local D1, pairing code local-test-code)
//   node scripts/test-leftovers.mjs <pairing-code>
// Serves the repo on localhost:8852 and proxies /api to the Worker (same origin, so no CORS entry is needed).
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
const PORT = 8852;
const SITE = 'http://localhost:' + PORT;
const SHOTS = path.join(ROOT, 'docs', 'screens');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {   // same-origin proxy to the Worker
    const u = new URL(API);
    const up = http.request({ host: u.hostname, port: u.port, method: req.method, path: req.url, headers: { ...req.headers, host: u.host } }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', e => { res.writeHead(502); res.end(String(e)); });
    req.pipe(up); return;
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
const errors = [];
const APP = SITE + '/apps/leftovers.html';
const dateStr = daysAgo => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

async function newContext(browser, name, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light', ...opts });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, SITE);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  return { ctx, page };
}
// Pair and sign in through the SDK on the standalone page, then reload so the app boots signed in.
async function signIn(page, id, pin) {
  await page.goto(APP); await page.waitForFunction(() => window.hub && typeof hub.pair === 'function');
  await page.evaluate(async ({ code, id, pin }) => {
    if (!hub.device) await hub.pair(code, 'test-leftovers');
    try { await hub.login(id, pin); }
    catch (e) { if (e.error === 'needs_pin_setup') await hub.createPin(id, pin); else throw e; }
  }, { code: CODE, id, pin });
  await page.goto(APP);
  await page.waitForFunction(() => window.hub && hub.profile && hub.sync && hub.sync.lastPull > 0 && window.__larder, null, { timeout: 15000 });
}
const settled = page => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0));
const box = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }; });
const inView = (r, H = 844, W = 390) => r && r.h > 0 && r.top >= 0 && r.bottom <= H && r.left >= 0 && r.right <= W;

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  fs.mkdirSync(SHOTS, { recursive: true });
  try {
    console.log('\n## list-first: three items through the add bar, oldest first');
    const A = await newContext(browser, 'A');
    await signIn(A.page, 'eli', '1357');
    // start from a clean ledger so the order assertions are about these three
    await A.page.evaluate(() => hub.list('item:').forEach(r => hub.remove(r.key)));
    await A.page.evaluate(() => __larder.render());
    ok(await A.page.$('#unlock') === null, 'no #unlock (passphrase screen) anywhere');
    ok(await A.page.$eval('body', b => { const l = b.querySelector('#list'), f = b.querySelector('#add'); return !!l && !!f && (l.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; }), '#list comes before #add in the document');
    ok(await A.page.$eval('#add', f => getComputedStyle(f).position === 'fixed' || getComputedStyle(f).position === 'sticky'), 'add bar is fixed/sticky', await A.page.$eval('#add', f => getComputedStyle(f).position));
    ok(await A.page.$eval('#add', f => getComputedStyle(f).backdropFilter !== 'none' || getComputedStyle(f).webkitBackdropFilter !== 'none'), 'add bar carries the glass recipe (backdrop-filter)');
    ok(await A.page.$$eval('#add #name, #add .log, #add #date', els => els.length === 3), 'bar has #name, #date and .log inside #add');
    ok(await A.page.$eval('#add .log', b => b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().width >= 44) && await A.page.$eval('#name', b => b.getBoundingClientRect().height >= 44), 'Log and name field are 44 px+ targets');

    const empty = await A.page.$('#list .empty');
    ok(!!empty, 'empty state renders when nothing is logged');

    for (const [name, size, n] of [['Pasta bake', 'Large', 2], ['Rice', 'Small', 8], ['Soup', 'Medium', 5]]) {
      await A.page.fill('#name', name);
      await A.page.selectOption('#size', size);
      await A.page.fill('#date', dateStr(n));
      await A.page.click('#add .log');
    }
    await waitFor(() => settled(A.page), { label: 'A flushed' });
    const names = await A.page.$$eval('#list .item .nm', els => els.map(e => e.textContent));
    ok(JSON.stringify(names) === JSON.stringify(['Rice', 'Soup', 'Pasta bake']), 'oldest first: Rice (8d) · Soup (5d) · Pasta bake (2d)', JSON.stringify(names));
    const days = await A.page.$$eval('#list .item', els => els.map(e => +e.dataset.days));
    ok(JSON.stringify(days) === JSON.stringify([8, 5, 2]), 'ages are 8, 5, 2 days', JSON.stringify(days));
    const groups = await A.page.$$eval('#list .group', els => els.map(e => e.dataset.tone + ':' + e.querySelectorAll('.item').length));
    ok(JSON.stringify(groups) === JSON.stringify(['urgent:1', 'warn:1', 'fresh:1']), 'grouped Use it up / Aging / Fresh, one each', JSON.stringify(groups));
    ok(await A.page.$eval('#name', i => i.value === '') && await A.page.$eval('#date', i => i.value === document.querySelector('#date').max), 'bar resets to an empty name and today after logging');

    console.log('\n## freshness bars');
    const bars = await A.page.$$eval('#list .item', els => els.map(e => {
      const b = e.querySelector('.bar'), i = b && b.querySelector('i');
      const bw = b ? b.getBoundingClientRect().width : 0, iw = i ? i.getBoundingClientRect().width : 0;
      const tint = e.style.getPropertyValue('--tint').trim();
      const fill = i ? getComputedStyle(i).backgroundImage : '';
      return { p: b && b.style.getPropertyValue('--p'), ratio: bw ? +(iw / bw).toFixed(2) : -1, tint, hasGradient: /gradient/.test(fill) };
    }));
    ok(bars.length === 3 && bars.every(b => b.hasGradient && b.ratio >= 0), 'every item has a .bar with a filled <i>', JSON.stringify(bars));
    ok(bars[0].p === '0.8' && bars[1].p === '0.5' && bars[2].p === '0.2', '--p is days/10 (0.8, 0.5, 0.2)', JSON.stringify(bars.map(b => b.p)));
    ok(Math.abs(bars[0].ratio - 0.8) < 0.06 && Math.abs(bars[1].ratio - 0.5) < 0.06 && Math.abs(bars[2].ratio - 0.2) < 0.06, 'fill widths follow --p', JSON.stringify(bars.map(b => b.ratio)));
    ok(bars[0].tint === 'var(--danger)' && bars[1].tint === 'var(--warn)' && bars[2].tint === 'var(--ok)', '--tint is danger / warn / ok by age (tokens, no hex)', JSON.stringify(bars.map(b => b.tint)));
    const fills = await A.page.$$eval('#list .item .bar > i', els => els.map(i => getComputedStyle(i).backgroundImage));
    ok(new Set(fills).size === 3, 'three distinct bar colours resolve from the tokens');

    console.log('\n## 390×844: oldest item + chip + add bar on screen together, no scrolling');
    await A.page.evaluate(() => window.scrollTo(0, 0));
    const item = await box(A.page, '#list .item'), chip = await box(A.page, '#list .item .status'), bar = await box(A.page, '#add'), logb = await box(A.page, '#add .log');
    console.log('    oldest item', JSON.stringify(item), '\n    chip', JSON.stringify(chip), '\n    add bar', JSON.stringify(bar));
    ok(inView(item), 'oldest item card within the 844 px viewport');
    ok(inView(chip) && chip.w > 0, 'its "Use it up" chip within the viewport');
    ok(inView(bar) && bar.bottom <= 844 - 12, 'add bar within the viewport, above the safe-area margin');
    ok(item.bottom <= bar.top, 'oldest item sits above the add bar (they do not overlap)');
    ok(inView(logb), 'Log button on screen at the same time', JSON.stringify(logb));
    ok(await A.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll at 390');
    ok(await A.page.evaluate(() => { const hearth = document.querySelector('.hearth'), add = document.querySelector('#add'); window.scrollTo(0, document.body.scrollHeight); const h = hearth.getBoundingClientRect(), a = add.getBoundingClientRect(); window.scrollTo(0, 0); return h.bottom <= a.top; }), 'scrolled to the end, the Hearth block clears the bar (bottom padding follows the bar height)');
    await A.page.screenshot({ path: path.join(SHOTS, 'rm12-larder-390.png') });
    await A.page.setViewportSize({ width: 1440, height: 900 });
    await sleep(200);
    const wide = await box(A.page, '#add');
    ok(wide.w <= 562 && Math.abs((wide.left + wide.right) / 2 - 720) < 4, 'at 1440 the bar stays 560 px and centred under the list', JSON.stringify(wide));
    await A.page.screenshot({ path: path.join(SHOTS, 'rm12-larder-1440.png') });
    await A.page.setViewportSize({ width: 390, height: 844 });

    console.log('\n## Copy for Hearth');
    await A.page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
    await A.page.click('#copy');
    const copied = await waitFor(() => A.page.evaluate(() => window.__copied), { label: 'clipboard' });
    console.log('    ' + copied.split('\n').join('\n    '));
    ok(/^Push these to the Hearth Calendar:/.test(copied), 'copied text starts with the Hearth line');
    ok(/• Rice \(Small\) — logged 8d ago, use it up/.test(copied) && /• Soup \(Medium\) — logged 5d ago, eat soon/.test(copied), 'lists Rice (use it up) and Soup (eat soon)');
    ok(!/Pasta bake/.test(copied), 'fresh Pasta bake is not in the Hearth list');
    ok(/Copied!/.test(await A.page.textContent('#copy')), 'button says Copied!');

    console.log('\n## midnight rollover while the page is open');
    const before = await A.page.evaluate(() => ({ today: __larder.today(), max: document.querySelector('#date').max, value: document.querySelector('#date').value, ages: [...document.querySelectorAll('#list .item')].map(e => +e.dataset.days) }));
    const rolled = await A.page.evaluate(() => {
      // tomorrow arrives: every `new Date()` and Date.now() is a day later from here on
      const Real = Date, OFF = 86400000;
      window.Date = class extends Real { constructor(...a) { if (a.length) super(...a); else super(Real.now() + OFF); } static now() { return Real.now() + OFF; } };
      return { ticked: __larder.rollover(), today: __larder.today(), max: document.querySelector('#date').max, value: document.querySelector('#date').value,
               ages: [...document.querySelectorAll('#list .item')].map(e => +e.dataset.days), meta: [...document.querySelectorAll('#list .item .meta')].map(e => e.textContent),
               groups: [...document.querySelectorAll('#list .group')].map(e => e.dataset.tone + ':' + e.querySelectorAll('.item').length) };
    });
    ok(rolled.ticked === true && rolled.today !== before.today && rolled.today > before.today, 'the minute check notices the new day key', rolled.today + ' vs ' + before.today);
    ok(JSON.stringify(rolled.ages) === JSON.stringify(before.ages.map(d => d + 1)), '"Nd ago" ages all advance by one (9, 6, 3)', JSON.stringify(rolled.ages));
    ok(rolled.meta.every((m, i) => m.includes(rolled.ages[i] + 'd ago')), 'meta lines show the new ages');
    ok(rolled.max === rolled.today && rolled.value === rolled.today && before.value === before.today, 'date box default and max move to the new today');
    ok(await A.page.evaluate(() => __larder.rollover() === false), 'a second check on the same day is a no-op');
    // the interval is registered too: 60 s is too long to wait here, so check it exists (setInterval was called with the hook)
    ok(await A.page.evaluate(() => typeof __larder.rollover === 'function' && typeof __larder.render === 'function'), 'window.__larder exposes render + rollover for tests');
    console.log('\n## inside the hub viewer (iframe under the 48 px pill)');
    // the app must also work framed: the same origin keeps the session, so an iframe boots signed in
    await A.page.goto(SITE + '/docs/design.html');   // any same-origin page; replace its body with a viewer-sized frame
    await A.page.evaluate(src => { document.body.innerHTML = ''; document.body.style.margin = '0'; const f = document.createElement('iframe'); f.id = 'frame'; f.src = src; f.style.cssText = 'display:block;border:0;width:390px;height:796px;margin-top:48px'; document.body.append(f); }, APP);
    const fr = await waitFor(() => A.page.frame({ url: /apps\/leftovers/ }), { label: 'leftovers frame' });
    await fr.waitForFunction(() => window.hub && hub.profile && hub.sync && hub.sync.lastPull > 0 && window.__larder, null, { timeout: 15000 });
    const fi = await fr.$eval('#list .item', e => e.getBoundingClientRect().toJSON()), fb = await fr.$eval('#add', e => e.getBoundingClientRect().toJSON());
    ok(fi.top >= 0 && fi.bottom <= fb.top && fb.bottom <= 796 && fb.top > 0, 'framed at 390×796: oldest item above the bar, bar inside the frame', JSON.stringify([fi, fb]));
    ok(await fr.$$eval('#list .item', els => els.length === 3), 'framed: the three items are there (session shared through the origin)');
    await A.page.screenshot({ path: path.join(SHOTS, 'rm12-larder-framed.png') });
    await A.page.goto(APP);
    await A.page.waitForFunction(() => window.hub && hub.profile && hub.sync && hub.sync.lastPull > 0 && window.__larder, null, { timeout: 15000 });
    await A.page.evaluate(() => hub.list('item:').forEach(r => hub.remove(r.key)));   // tidy: remove the three items (tombstones sync)
    await waitFor(() => settled(A.page), { label: 'A cleaned up' });

    console.log('\n## the display profile only looks');
    const K = await newContext(browser, 'K');
    // reuse the same pairing by copying A's device token, then open a kiosk session
    const device = await A.page.evaluate(() => localStorage.getItem('hub.device'));
    await K.page.goto(APP); await K.page.evaluate(d => localStorage.setItem('hub.device', d), device);
    await K.page.goto(APP); await K.page.waitForFunction(() => window.hub && hub.device && typeof hub.login === 'function');
    // seed one item from A so the kiosk has something to look at
    await A.page.evaluate(d => { const id = hub.uid(); hub.set('item:' + id, { id, name: 'Kiosk chili', size: 'Large', dateLogged: d }); }, dateStr(8));
    await waitFor(() => settled(A.page), { label: 'A flushed chili' });
    await K.page.evaluate(async () => { await hub.login('tv'); });
    await K.page.goto(APP);
    await K.page.waitForFunction(() => window.hub && hub.profile && hub.sync && hub.sync.lastPull > 0 && window.__larder, null, { timeout: 15000 });
    ok(await K.page.evaluate(() => hub.profile.kind === 'kiosk' && !hub.canWrite), 'signed in as the Downstairs TV (kiosk, cannot write)');
    ok(await K.page.$eval('#add', f => getComputedStyle(f).display === 'none'), 'kiosk: add bar hidden');
    ok(await K.page.$eval('.hearth', f => getComputedStyle(f).display === 'none'), 'kiosk: Hearth block hidden');
    ok((await K.page.textContent('#list')).includes('Kiosk chili') && await K.page.$('#list .item .bar') !== null, 'kiosk: sees the list with freshness bars');
    ok(await K.page.$('#list .done') === null, 'kiosk: no "mark used up" buttons');
    ok(await K.page.$eval('body', b => parseFloat(getComputedStyle(b).paddingBottom) < 120), 'kiosk: no bottom padding reserved for a bar it does not show');
    await K.page.screenshot({ path: path.join(SHOTS, 'rm12-larder-kiosk.png') });
    await A.page.evaluate(() => hub.list('item:').forEach(r => hub.remove(r.key)));
    await waitFor(() => settled(A.page), { label: 'A cleaned up 2' });
    await K.ctx.close(); await A.ctx.close();
  } catch (e) {
    fail++; console.log('  ✗ crashed:', e && e.stack || e);
  } finally {
    await browser.close(); server.close();
  }
  const real = errors.filter(e => !/net::ERR|Failed to fetch|ERR_ABORTED/.test(e));
  if (real.length) { console.log('\nconsole errors:'); real.forEach(e => console.log('  ', e)); }
  console.log(`\n${pass} passed, ${fail} failed${real.length ? ', ' + real.length + ' console error(s)' : ''}`);
  process.exit(fail || real.length ? 1 : 0);
})();
