#!/usr/bin/env node
// Roadmap 9 checks: the kitchen timer survives navigation. Start a timer in the app on device A, leave the app —
// the shell shows a glass pill that keeps counting; device B shows the same pill after a pull; when it reaches 0
// the shell (app closed) clears timer.active, toasts and beeps; the app resumes a running timer when reopened;
// the display profile gets the pill but never beeps or writes. The shell adds no toast over the open app's buttons,
// and Me → Switch takes the pill off the profile picker.
//   cd worker && npx wrangler dev --port 8787     (seeded local D1)
//   node scripts/test-timer.mjs <pairing-code>
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
const SHOTS = path.join(ROOT, 'docs', 'screens');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
// on any port but 8765 the Worker's CORS allow-list would refuse the browser, so /api is proxied through this server
const PROXY = PORT !== 8765;
const HUB_API = PROXY ? SITE : API;
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
async function waitFor(fn, { timeout = 12000, every = 150, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}
const errors = [];
async function newContext(browser, name, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light', ...opts });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, HUB_API);
  // count the shell's beeps without needing a sound card: every AudioContext the shell opens is one beep
  await ctx.addInitScript(() => {
    const Real = window.AudioContext; window.__beeps = 0;
    if (Real) window.AudioContext = window.webkitAudioContext = function () { window.__beeps++; return new Real(); };
  });
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
      await page.waitForFunction(() => document.getElementById('gate').hidden || /Enter your PIN/.test((document.getElementById('pinhint') || {}).textContent || ''), null, { timeout: 15000 });
      if (await page.$('#gate:not([hidden]) #pad')) { await sleep(200); await tap(); }
    }
  }
  await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
}
const pillState = page => page.evaluate(() => {
  const p = document.getElementById('timer-pill'), c = document.getElementById('pill-timer');
  return { shown: !p.hidden && getComputedStyle(p).display !== 'none', time: document.getElementById('timer-pill-time').textContent,
    chip: !c.hidden, chipTime: document.getElementById('pill-timer-time').textContent,
    active: hub.get('timer.active', { app: 'timer', scope: 'person' }) || null,
    toast: (document.getElementById('hub-toast') || {}).textContent || '', toastShown: !((document.getElementById('hub-toast') || { hidden: true }).hidden) };
});
const secs = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
// what the top page has under the centre of a button inside the app iframe — the iframe itself, or something over it
const underAppButton = (page, frame, sel) => frame.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel)
  .then(pt => page.evaluate(pt => { const f = document.getElementById('frame').getBoundingClientRect(); const el = document.elementFromPoint(f.left + pt.x, f.top + pt.y); return el ? (el.id || el.tagName.toLowerCase()) : ''; }, pt));
const flushed = page => waitFor(() => page.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), { label: 'flushed' });
// the Chat tab: the composer owns the band above the tab bar, so the pill must sit clear of it and every composer control must be tappable
const chatClear = page => page.evaluate(() => {
  const r = id => document.getElementById(id).getBoundingClientRect();
  const pill = r('timer-pill'), form = r('chat-form');
  const at = (x, y) => { const el = document.elementFromPoint(x, y); return el ? (el.id || el.tagName.toLowerCase()) : ''; };
  const centre = id => { const b = r(id); return at(b.left + b.width / 2, b.top + b.height / 2); };
  const inp = r('chat-in');
  return { overlap: !(pill.right <= form.left || pill.left >= form.right || pill.bottom <= form.top || pill.top >= form.bottom),
    gap: Math.round(form.top - pill.bottom), pillTop: Math.round(pill.top),
    underInput: centre('chat-in'), underInputLeft: at(inp.left + 20, inp.top + inp.height / 2), underSend: centre('chat-send'),
    underMic: document.getElementById('chat-mic').hidden ? 'hidden' : centre('chat-mic') };
});
const chatOk = c => !c.overlap && c.gap >= 4 && c.pillTop > 0 && c.underInput === 'chat-in' && c.underInputLeft === 'chat-in' && c.underSend !== 'timer-pill' && c.underMic !== 'timer-pill';

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  fs.mkdirSync(SHOTS, { recursive: true });
  try {
    console.log('\n## start a timer, leave the app, the pill follows you');
    const A = await newContext(browser, 'A'), B = await newContext(browser, 'B');
    await signIn(A.page, 'eli', '1357');
    // a stale record from an earlier run must not confuse this one
    await A.page.evaluate(() => { if (hub.has('timer.active', { app: 'timer', scope: 'person' })) hub.remove('timer.active', { app: 'timer', scope: 'person' }); });
    await flushed(A.page);
    await A.page.click('.tab[data-tab=apps]'); await A.page.click('.tile[data-id=timer]');
    const fa = await waitFor(() => A.page.frame({ url: /apps\/timer/ }), { label: 'timer frame A' });
    await fa.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('go'));
    await fa.click('[data-s="60"]'); await fa.click('#go');
    const rec = await fa.evaluate(() => hub.get('timer.active'));
    ok(rec && rec.total === 60 && rec.endAt > Date.now() + 55000 && rec.endAt <= Date.now() + 61000 && rec.startedAt > 0, 'A: Start writes timer.active {endAt, total:60, startedAt} in the timer person scope', JSON.stringify(rec));
    ok(await fa.evaluate(() => document.getElementById('go').textContent === 'Pause'), 'A: the app is counting (button says Pause)');
    let st = await pillState(A.page);
    ok(!st.shown && !st.chip, 'A: no pill or chip while the timer app itself is open');
    await A.page.click('#pill-home');                       // leave the app
    await waitFor(() => pillState(A.page).then(s => s.shown), { label: 'A pill' });
    st = await pillState(A.page);
    ok(st.shown && /^(1:00|0:5\d)$/.test(st.time), `A: shell pill shows with the app closed (${st.time})`);
    const t1 = secs(st.time); await sleep(2100); const t2 = secs((await pillState(A.page)).time);
    ok(t1 - t2 >= 2 && t1 - t2 <= 3, `A: the pill counts down each second (${t1} → ${t2})`);
    await A.page.click('.tab[data-tab=home]');
    ok((await pillState(A.page)).shown, 'A: still there on Home');
    await A.page.click('.tab[data-tab=me]');
    ok((await pillState(A.page)).shown, 'A: still there on Me');
    await A.page.click('.tab[data-tab=chat]'); await sleep(400);
    ok((await pillState(A.page)).shown, 'A: still there on Chat');
    let cc = await chatClear(A.page);
    ok(chatOk(cc), `A: on Chat the pill sits clear above the composer, input/mic/send all tappable (${JSON.stringify(cc)})`);
    await A.page.click('#chat-in');
    ok(await A.page.evaluate(() => document.activeElement && document.activeElement.id === 'chat-in'), 'A: a tap in the middle of the chat input focuses it, not the timer');
    await A.page.screenshot({ path: path.join(SHOTS, 'rm9-chat-390.png') });
    await A.page.click('.tab[data-tab=me]');
    const box = await A.page.$eval('#timer-pill', e => e.getBoundingClientRect());
    ok(box.height >= 44 && box.bottom < 844 - 60 && box.top > 0, `A: pill is a 44 px target above the tab bar (h ${Math.round(box.height)}, bottom ${Math.round(box.bottom)})`);
    await A.page.screenshot({ path: path.join(SHOTS, 'rm9-pill-390.png') });
    // over another app the countdown moves into the slim bar above the app, never over it
    await A.page.click('.tab[data-tab=apps]'); await A.page.click('.tile[data-id=tally]');
    await waitFor(() => A.page.frame({ url: /apps\/tally/ }), { label: 'tally frame' });
    st = await pillState(A.page);
    ok(!st.shown && st.chip && /^0:\d\d$/.test(st.chipTime), `A: over another app the countdown sits in the app bar (${st.chipTime})`);
    await sleep(500);                                       // let the viewer finish scaling in
    await A.page.screenshot({ path: path.join(SHOTS, 'rm9-chip-390.png') });
    await A.page.click('#pill-timer');
    const fa2 = await waitFor(() => A.page.frame({ url: /apps\/timer/ }), { label: 'timer frame A again' });
    await fa2.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('go'));
    await waitFor(() => fa2.evaluate(() => document.getElementById('go').textContent === 'Pause'), { label: 'A app resumes' });
    const shown = await fa2.evaluate(() => document.getElementById('t').textContent);
    ok(/^0:[45]\d$/.test(shown), `A: tapping the chip reopens the app and it resumes from endAt (${shown}), not from 1:00`);
    await A.page.click('#pill-home');
    await waitFor(() => pillState(A.page).then(s => s.shown), { label: 'A pill again' });

    console.log('\n## a second device sees it');
    await flushed(A.page);
    await signIn(B.page, 'eli', '1357');
    await B.page.evaluate(() => hub.pull());
    await waitFor(() => pillState(B.page).then(s => s.shown), { label: 'B pill' });
    st = await pillState(B.page);
    ok(st.shown && st.active && st.active.total === 60, `B: pill shows after a pull (${st.time})`);
    const dA = secs((await pillState(A.page)).time), dB = secs(st.time);
    ok(Math.abs(dA - dB) <= 2, `A and B agree on the time left (${dA} vs ${dB})`);

    console.log('\n## it reaches 0 with the app closed');
    const beepsBefore = await A.page.evaluate(() => window.__beeps);
    await A.page.evaluate(() => hub.set('timer.active', { endAt: Date.now() + 1500, total: 60, startedAt: Date.now() - 58500 }, { app: 'timer', scope: 'person' }));
    await flushed(A.page);
    await B.page.evaluate(() => hub.pull());
    const t0 = Date.now();
    await waitFor(() => pillState(A.page).then(s => !s.shown && !s.active), { timeout: 4000, label: 'A finished' });
    st = await pillState(A.page);
    ok(!st.shown && !st.active, `A: pill gone and timer.active cleared ${Date.now() - t0} ms after the shortened end`);
    ok(/Timer done/.test(st.toast) && st.toastShown, `A: toast "${st.toast}"`);
    ok(await A.page.evaluate(() => window.__beeps) > beepsBefore, 'A: the shell beeped (WebAudio) with the app closed');
    await flushed(A.page);
    await B.page.evaluate(() => hub.pull());
    await waitFor(() => pillState(B.page).then(s => !s.shown && !s.active), { timeout: 4000, label: 'B finished' });
    ok(true, 'B: pill gone and timer.active gone on the second device too');
    ok(await A.page.evaluate(() => hub.sync.pending === 0), 'A: nothing left in the write queue');

    console.log('\n## the shell stays quiet while the app is open');
    // a toast still up from the finish above must not follow the user into an app, where it would cover its buttons
    await A.page.evaluate(() => hub.toast('Timer done — 1:00 is up.', 4000));
    await A.page.click('.tab[data-tab=apps]'); await A.page.click('.tile[data-id=timer]');
    const fq = await waitFor(() => A.page.frame({ url: /apps\/timer/ }), { label: 'timer frame A quiet' });
    await fq.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('go'));
    st = await pillState(A.page);
    ok(!st.toastShown, 'A: opening an app dismisses the shell toast');
    await sleep(500);
    ok((await underAppButton(A.page, fq, '#go')) === 'frame', 'A: nothing from the shell sits over the app\'s Start button');
    // a timer that runs out with the app open (started here, end moved up as another device would): the app beeps
    // and shows done; the shell must not toast over it
    const shellBeeps = await A.page.evaluate(() => window.__beeps), appBeeps = await fq.evaluate(() => window.__beeps);
    await fq.click('[data-s="60"]'); await fq.click('#go');
    await A.page.evaluate(() => hub.set('timer.active', { endAt: Date.now() + 1500, total: 60, startedAt: Date.now() - 58500 }, { app: 'timer', scope: 'person' }));
    await waitFor(() => fq.evaluate(() => document.body.classList.contains('done') && document.getElementById('go').textContent === 'Start'), { timeout: 5000, label: 'app done' });
    await sleep(400);                                       // give the shell's own tick a chance to react
    st = await pillState(A.page);
    ok(!st.active && !st.shown && !st.chip, 'A: timer.active cleared, no pill or chip');
    ok(!st.toastShown, 'A: no shell toast while the timer app is open');
    ok(await A.page.evaluate(() => window.__beeps) === shellBeeps && await fq.evaluate(() => window.__beeps) === appBeeps + 1, 'A: the app beeped once, the shell stayed quiet');
    const under = await Promise.all(['#go', '#reset'].map(sel => underAppButton(A.page, fq, sel)));
    ok(under.every(u => u === 'frame'), `A: Start and Reset are tappable right after the finish (under: ${under.join(', ')})`);
    await fq.click('#go');                                  // and a real tap lands
    ok(await fq.evaluate(() => document.getElementById('go').textContent === 'Pause' && !!hub.get('timer.active')), 'A: a tap on Start right after the finish is not swallowed');
    await fq.click('#go'); await A.page.click('#pill-home'); await sleep(300);

    console.log('\n## pause and reset clear the record');
    await A.page.click('.tab[data-tab=apps]'); await A.page.click('.tile[data-id=timer]');
    const fa3 = await waitFor(() => A.page.frame({ url: /apps\/timer/ }), { label: 'timer frame A 3' });
    await fa3.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('go'));
    await fa3.click('[data-s="180"]'); await fa3.click('#go');
    ok(await fa3.evaluate(() => (hub.get('timer.active') || {}).total === 180), 'A: 3 min started → record total 180');
    await fa3.click('#go');
    ok(await fa3.evaluate(() => !hub.has('timer.active') && document.getElementById('go').textContent === 'Start'), 'A: Pause clears timer.active');
    await fa3.click('#go'); await fa3.click('#reset');
    ok(await fa3.evaluate(() => !hub.has('timer.active') && document.getElementById('t').textContent === '3:00'), 'A: Reset clears it and shows 3:00');
    await A.page.click('#pill-home'); await sleep(300);
    ok(!(await pillState(A.page)).shown, 'A: no pill after reset');

    console.log('\n## Me → Switch takes the pill off the profile picker');
    await A.page.evaluate(() => hub.set('timer.active', { endAt: Date.now() + 600000, total: 600, startedAt: Date.now() }, { app: 'timer', scope: 'person' }));
    await waitFor(() => pillState(A.page).then(s => s.shown), { label: 'A pill before switch' });
    await A.page.click('.tab[data-tab=me]'); await A.page.click('#switch');
    await A.page.waitForSelector('#gate:not([hidden]) .pcard[data-id]', { timeout: 15000 });
    st = await pillState(A.page);
    ok(!st.shown, 'A: pill hidden on the picker after Switch');
    const under2 = await A.page.evaluate(() => { const c = document.querySelector('.pcard[data-id=tv]'); const r = c.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el && el.closest('#timer-pill') ? 'timer-pill' : 'gate'; });
    ok(under2 === 'gate', 'A: nothing over the profile cards');
    await sleep(1200);
    ok((await pillState(A.page)).time === st.time && !(await pillState(A.page)).shown, 'A: the tick stopped with the gate up');
    await A.page.screenshot({ path: path.join(SHOTS, 'rm9-switch-390.png') });
    await signIn(A.page, 'eli', '1357');
    await waitFor(() => pillState(A.page).then(s => s.shown), { label: 'A pill after signing back in' });
    ok((await pillState(A.page)).shown, 'A: the pill is back once Eli signs in again');
    await A.page.evaluate(() => hub.remove('timer.active', { app: 'timer', scope: 'person' }));
    await flushed(A.page);

    console.log('\n## desktop: the pill sits beside the sidebar');
    const D = await newContext(browser, 'D', { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    await signIn(D.page, 'eli', '1357');
    await D.page.evaluate(() => hub.set('timer.active', { endAt: Date.now() + 600000, total: 600, startedAt: Date.now() }, { app: 'timer', scope: 'person' }));
    await D.page.evaluate(() => hub.pull());
    await waitFor(() => pillState(D.page).then(s => s.shown), { label: 'D pill' });
    const dbox = await D.page.$eval('#timer-pill', e => e.getBoundingClientRect());
    ok(dbox.left >= 220 && dbox.left < 400 && dbox.height >= 44, `D: pill beside the sidebar at 1440 (left ${Math.round(dbox.left)})`);
    await D.page.screenshot({ path: path.join(SHOTS, 'rm9-pill-1440.png') });
    await D.page.click('.tab[data-tab=chat]'); await sleep(400);
    cc = await chatClear(D.page);
    ok((await pillState(D.page)).shown && chatOk(cc), `D: on Chat at 1440 the pill sits clear above the composer, mic and send uncovered (${JSON.stringify(cc)})`);
    await D.page.screenshot({ path: path.join(SHOTS, 'rm9-chat-1440.png') });
    await D.page.click('.tab[data-tab=home]');
    ok(await D.page.$eval('#timer-pill', e => e.getBoundingClientRect().bottom > 900 - 60), 'D: back on Home the pill drops back to the bottom');
    const E = await newContext(browser, 'E', { viewport: { width: 820, height: 1180 } });
    await signIn(E.page, 'eli', '1357');
    await E.page.evaluate(() => hub.pull());
    await waitFor(() => pillState(E.page).then(s => s.shown), { label: 'E pill' });
    await E.page.click('.tab[data-tab=chat]'); await sleep(400);
    cc = await chatClear(E.page);
    ok(chatOk(cc), `E: on Chat at 820 the pill sits clear above the composer (${JSON.stringify(cc)})`);
    await E.page.screenshot({ path: path.join(SHOTS, 'rm9-chat-820.png') });
    await E.ctx.close();
    await D.page.evaluate(() => hub.remove('timer.active', { app: 'timer', scope: 'person' }));
    await flushed(D.page); await D.ctx.close();

    console.log('\n## the display profile only looks');
    const C = await newContext(browser, 'C');
    await signIn(C.page, 'tv');
    ok(await C.page.evaluate(() => hub.isKiosk && !hub.canWrite), 'kiosk session');
    // the display has no timer of its own (it can never write one); simulate a record arriving in its cache
    await C.page.evaluate(() => {
      const key = 'hub.cache.timer.person.tv';           // LS.cache(app, scope, pid) in hub.js
      const st = JSON.parse(localStorage.getItem(key) || '{"items":{},"since":0}');
      st.items['timer.active'] = { v: { endAt: Date.now() + 4000, total: 60, startedAt: Date.now() }, t: Date.now() };
      localStorage.setItem(key, JSON.stringify(st));
    });
    await C.page.reload(); await C.page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
    const kShown = await waitFor(() => pillState(C.page).then(s => s.shown || null), { timeout: 3000, label: 'kiosk pill' }).catch(() => false);
    ok(kShown, 'kiosk: pill visible (read-only)');
    await waitFor(() => pillState(C.page).then(s => !s.shown), { timeout: 6000, label: 'kiosk pill gone' });
    st = await pillState(C.page);
    ok(!st.shown, 'kiosk: pill goes away at 0');
    ok(await C.page.evaluate(() => window.__beeps) === 0, 'kiosk: no beep');
    ok(await C.page.evaluate(() => hub.sync.pending === 0 && hub.sync.state !== 'error'), 'kiosk: nothing written, no error');
    await C.ctx.close(); await B.ctx.close(); await A.ctx.close();
    ok(errors.length === 0, 'no console/page errors', errors.slice(0, 5).join(' | '));
  } finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
