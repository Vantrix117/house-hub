#!/usr/bin/env node
// The kitchen timer (roadmap 9; batch 6). One person-scope row per timer, timer:<id> = { id, label, total, startedAt, endAt,
// pausedAt, remaining, by, ackAt } in the house's clock (hub.serverNow()), through hub.timers (apps/hub.js) in the app and
// the shell alike. The app: Start / Pause (stored) / Resume / +1 min / Reset, a preset never replaces a running timer
// without asking (Replace, or Add a second timer), up to three timers, labels, custom times (h:mm:ss), recents, the alert
// that repeats every 15 s until Stop on one AudioContext, "Ended at" for a timer that ended unseen, the 10-minute rule,
// the clear rule (a device never clears a newer start), the skew rule (two clocks 90 s apart agree), the migration from
// timer.active, Say it's parser, aria-live and aria-pressed, the wake lock. The shell: a pill on every tab that follows
// the timer, rings at 0 with the app closed and stops from the pill; the display only looks. The shell's half (Worker C):
// two timers ("+1" on the pill), the ring again 15 s later until Stop on one AudioContext, Stop in the pill removes only
// that row, a notification at 0 with the Timer open and the page hidden (P3-TIMER-04), the wake lock asked again on a
// return to view with no tap (P2-STAB-09), and a Switch that keeps the timer counting and ringing on the device, with the
// next person's Stop stopping it there only (P2-PROF-08); a kid's pill is --tap (64 px) high (P4-SHAPE-01).
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
const SHOTS = process.env.TIMER_SHOTS || path.join(ROOT, 'docs', 'screens');
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
async function newContext(browser, name, opts = {}, { clockOffset = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light', ...opts });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, HUB_API);
  // every window counts its AudioContexts and the notes it plays (no sound card needed), and its wake-lock requests
  await ctx.addInitScript(() => {
    window.__audio = { made: 0, osc: 0 }; window.__beeps = 0; window.__wl = 0;
    const Real = window.AudioContext || window.webkitAudioContext;
    if (Real) window.AudioContext = window.webkitAudioContext = function (...a) {
      window.__audio.made++; window.__beeps++; const c = new Real(...a);
      const co = c.createOscillator.bind(c); c.createOscillator = () => { window.__audio.osc++; return co(); };
      return c;
    };
    try { if (navigator.wakeLock) { const r = navigator.wakeLock.request.bind(navigator.wakeLock); navigator.wakeLock.request = (...a) => { window.__wl++; return r(...a); }; } } catch {}
  });
  // a device whose clock is wrong (P2-STAB-08): Date.now() runs clockOffset ms ahead
  if (clockOffset) await ctx.addInitScript(off => { const n = Date.now.bind(Date); Date.now = () => n() + off; }, clockOffset);
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
  let rows = []; try { rows = hub.timers.list(); } catch {}
  return { shown: !p.hidden && getComputedStyle(p).display !== 'none', time: document.getElementById('timer-pill-time').textContent,
    chip: !c.hidden, chipTime: document.getElementById('pill-timer-time').textContent, rows, active: rows[0] || null,
    toast: (document.getElementById('hub-toast') || {}).textContent || '', toastShown: !((document.getElementById('hub-toast') || { hidden: true }).hidden) };
});
const secs = t => t.split(':').map(Number).reduce((a, x) => a * 60 + x, 0);
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
// every timer row of the signed-in person goes, the legacy row, the recents and the sound too: a clean start
const wipe = page => page.evaluate(() => {
  const P = { app: 'timer', scope: 'person' };
  for (const x of hub.list('timer:', P)) hub.remove(x.key, P);
  for (const k of ['timer.active', 'recents', 'sound']) if (hub.has(k, P)) hub.remove(k, P);
  try { localStorage.removeItem('hub.timers.acked'); localStorage.removeItem('hub.timers.device'); } catch {}
});
// the Timer app, opened from Apps, live (it has pulled)
async function openTimer(page, label = 'timer frame') {
  await page.click('.tab[data-tab=apps]'); await page.click('.tile[data-id=timer]');
  const f = await waitFor(() => page.frame({ url: /apps\/timer/ }), { label });
  await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 });
  return f;
}
const app = f => f.evaluate(() => {
  const g = document.getElementById('go'), q = id => document.getElementById(id);
  const rows = hub.timers.list();
  return { t: q('t').textContent, go: g.textContent.trim(), goState: g.dataset.state, primary: g.classList.contains('btn-primary'),
    state: (q('tstate').hidden ? '' : q('tstate').textContent.trim()), label: q('tlabel').hidden ? '' : q('tlabel').textContent.trim(),
    done: document.body.classList.contains('done'), ask: q('ask').hidden ? null : q('ask-text').textContent,
    // rescore 6: what shows below the actions (the picker parts), and whether +1 min / Reset can be seen
    below: ['presets', 'ask', 'custom', 'recents', 'say', 'tsettings-btn', 'tsettings'].filter(id => q(id) && q(id).getClientRects().length > 0).concat(document.querySelector('.lab').getClientRects().length ? ['lab'] : []),
    picker: q('presets').getClientRects().length > 0,
    resetVis: getComputedStyle(q('reset')).visibility === 'visible' && !q('reset').disabled, plus1Vis: getComputedStyle(q('plus1')).visibility === 'visible' && !q('plus1').disabled,
    list: [...document.querySelectorAll('#list .tm')].map(b => b.querySelector('.tm-label').textContent + ' ' + b.querySelector('.tm-time').textContent),
    addShown: !!(q('add') && !q('add').hidden && !q('list').hidden), live: q('live').textContent, rows, sel: __timer.sel(),
    pressed: [...document.querySelectorAll('[aria-pressed="true"]')].map(b => b.dataset.s || b.dataset.r || b.dataset.sound || b.dataset.id || b.id),
    recents: [...document.querySelectorAll('#recents [data-r]')].map(b => b.textContent.trim()), audio: { ...window.__audio }, wl: window.__wl };
});
const P = { app: 'timer', scope: 'person' };

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
  fs.mkdirSync(SHOTS, { recursive: true });
  try {
    console.log('\n## the contract: Start writes timer:<id> (server time) and its family mirror');
    const A = await newContext(browser, 'A'), B = await newContext(browser, 'B', {}, { clockOffset: 90000 });
    await signIn(A.page, 'eli', '1357');
    await wipe(A.page); await flushed(A.page);
    let fa = await openTimer(A.page, 'timer frame A');
    let s = await app(fa);
    ok(s.goState === 'start' && s.primary, `A: idle, Start is the primary button (${s.go})`);
    ok(await fa.evaluate(() => [...document.querySelectorAll('#presets [data-s]')].every(b => b.hasAttribute('aria-pressed'))), 'A: every preset carries aria-pressed (UX-TIMER-10)');
    await fa.click('[data-s="60"]');
    s = await app(fa);
    ok(s.t === '1:00' && s.pressed.includes('60') && s.rows.length === 0, `A: a preset with no timer running only sets the length (${s.t}, pressed ${s.pressed})`);
    const goTop0 = await fa.evaluate(() => Math.round(document.getElementById('go').getBoundingClientRect().top));
    const t0 = Date.now();
    await fa.click('#go');
    const row = await fa.evaluate(() => { const r = hub.timers.list()[0]; return { r, raw: hub.get('timer:' + r.id, { app: 'timer', scope: 'person' }), mirror: hub.get('run:eli:' + r.id, { app: 'timer', scope: 'family' }), now: hub.serverNow() }; });
    ok(row.r && row.r.total === 60000 && row.r.endAt > row.now + 55000 && row.r.endAt <= row.now + 61000 && row.r.startedAt > 0 && row.r.pausedAt === null && row.r.by === 'eli',
      'A: Start writes timer:<id> {total 60000 ms, endAt in server time, startedAt, by eli}', JSON.stringify(row.r));
    ok(row.raw && ['id', 'label', 'total', 'startedAt', 'endAt', 'pausedAt', 'remaining', 'by', 'ackAt'].every(k => k in row.raw) && Object.keys(row.raw).length === 9, 'A: the stored row has exactly the contract\'s fields', JSON.stringify(row.raw));
    ok(row.mirror && row.mirror.endAt === row.r.endAt && row.mirror.total === 60000, 'A: the family mirror run:eli:<id> follows it (GAP-HOME-1)', JSON.stringify(row.mirror));
    ok(await fa.evaluate(() => !hub.has('timer.active')), 'A: nothing writes the old timer.active');
    s = await app(fa);
    ok(s.goState === 'pause' && s.go === 'Pause' && s.primary, 'A: while running, Pause is the primary button (VIS-TIMER-1)');
    // P3-TIMER-05: the digits round up, so 1:00 holds for a whole second
    await sleep(Math.max(0, 550 - (Date.now() - t0)));
    ok((await app(fa)).t === '1:00', 'A: half a second after Start it still reads 1:00 (Math.ceil, P3-TIMER-05)');
    ok(await fa.evaluate(() => window.__wl) >= 1, 'A: the app asked for the wake lock itself while the timer runs (P2-STAB-09)');
    let st = await pillState(A.page);
    ok(!st.shown && !st.chip, 'A: no pill or chip while the timer app itself is open');
    // judge round: on the first Start, while the browser has not been asked, "Notify me" is offered inline, once, below the list
    const offer = await fa.evaluate(() => ({ perm: 'Notification' in window ? Notification.permission : 'none', shown: document.getElementById('notify-offer').getClientRects().length > 0, goTop: Math.round(document.getElementById('go').getBoundingClientRect().top) }));
    ok(offer.perm !== 'default' || (offer.shown && offer.goTop === goTop0), `A: first Start offers "Notify me when it ends" inline, and Start/Pause did not move (${JSON.stringify(offer)}, before ${goTop0})`);
    if (offer.shown) {
      await fa.click('#notify-offer-no');
      ok(await fa.evaluate(() => document.getElementById('notify-offer').hidden && Math.round(document.getElementById('go').getBoundingClientRect().top)) === goTop0, 'A: "Not now" puts it away; Pause did not move');
    }

    console.log('\n## the pill follows you (the shell)');
    await A.page.click('#pill-home');
    await waitFor(() => pillState(A.page).then(s => s.shown), { label: 'A pill' });
    st = await pillState(A.page);
    ok(st.shown && /^(1:00|0:5\d)$/.test(st.time), `A: shell pill shows with the app closed (${st.time})`);
    const p1 = secs(st.time); await sleep(2100); const p2 = secs((await pillState(A.page)).time);
    ok(p1 - p2 >= 2 && p1 - p2 <= 3, `A: the pill counts down each second (${p1} → ${p2})`);
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
    await A.page.click('.tab[data-tab=apps]'); await A.page.click('.tile[data-id=tally]');
    await waitFor(() => A.page.frame({ url: /apps\/tally/ }), { label: 'tally frame' });
    st = await pillState(A.page);
    ok(!st.shown && st.chip && /^0:\d\d$/.test(st.chipTime), `A: over another app the countdown sits in the app bar (${st.chipTime})`);
    await sleep(500);
    await A.page.screenshot({ path: path.join(SHOTS, 'rm9-chip-390.png') });
    await A.page.click('#pill-timer');
    fa = await waitFor(() => A.page.frame({ url: /apps\/timer/ }), { label: 'timer frame A again' });
    await fa.waitForFunction(() => window.__timer && __timer.isLive());
    s = await app(fa);
    ok(s.goState === 'pause' && /^0:[45]\d$/.test(s.t), `A: the chip reopens the app and it resumes from endAt (${s.t}), not from 1:00`);

    console.log('\n## two devices, two clocks (P2-STAB-08)');
    await flushed(A.page);
    await signIn(B.page, 'eli', '1357');
    await B.page.evaluate(() => hub.pull());
    await waitFor(() => pillState(B.page).then(s => s.shown), { label: 'B pill' });
    const skewB = await B.page.evaluate(() => hub.skew);
    ok(skewB < -85000 && skewB > -95000, `B: this device runs 90 s fast and knows it (skew ${Math.round(skewB / 1000)} s)`);
    st = await pillState(B.page);
    const dA = secs((await app(fa)).t), dB = secs(st.time);
    ok(Math.abs(dA - dB) <= 2, `A and B agree on the time left despite B's clock (${dA} vs ${dB})`);

    console.log('\n## Pause is stored, +1 min, Resume (UX-TIMER-2, GAP-TIMER-3)');
    await fa.click('#go');
    s = await app(fa);
    const paused = s.rows[0];
    ok(paused && paused.pausedAt > 0 && paused.endAt === null && paused.remaining > 40000 && paused.remaining < 60000 && s.state === 'Paused' && s.goState === 'resume',
      `A: Pause stores {pausedAt, remaining ${paused && Math.round(paused.remaining / 1000)} s, endAt null}; the dial says Paused; the button Resume`);
    await flushed(A.page); await B.page.evaluate(() => hub.pull());
    st = await pillState(B.page);
    ok(st.active && st.active.state === 'paused' && st.shown, `B: the second device shows it paused (${st.time}), not gone`);
    await A.page.click('#pill-home'); await sleep(300);
    fa = await openTimer(A.page, 'timer frame A paused');
    s = await app(fa);
    ok(s.goState === 'resume' && secs(s.t) === Math.ceil(paused.remaining / 1000), `A: reopened, it is still paused at ${s.t}, not reset to 1:00`);
    await fa.click('#plus1');
    s = await app(fa);
    ok(s.rows[0].remaining >= paused.remaining + 59000 && s.rows[0].total === 120000, `A: +1 min on a paused timer adds a minute (${s.t}, total ${s.rows[0].total / 1000} s)`);
    await fa.click('#go');
    s = await app(fa);
    ok(s.rows[0].state === 'running' && s.rows[0].endAt > 0 && s.goState === 'pause', `A: Resume runs it again (${s.t})`);
    const endBefore = s.rows[0].endAt;
    await fa.click('#plus1');
    s = await app(fa);
    ok(s.rows[0].endAt - endBefore >= 59000 && s.rows[0].endAt - endBefore <= 61000, 'A: +1 min on a running timer moves endAt a minute later');

    console.log('\n## while a timer runs the screen is calm; New timer opens the picker; three is the most (rescore 6, UX-TIMER-1, GAP-TIMER-3)');
    const firstId = s.rows[0].id;
    ok(s.below.length === 0 && !s.picker, `A: running, nothing below the actions but the list (below: ${s.below.join(', ') || 'nothing'})`);
    ok(s.addShown && s.list.length === 0 && s.resetVis && s.plus1Vis, 'A: with one timer the list is just New timer; +1 min and Reset are there');
    await fa.click('#add');
    s = await app(fa);
    ok(s.goState === 'start' && s.picker && s.list.length === 1 && s.rows.length === 1 && s.rows[0].id === firstId, 'A: New timer opens the picker in place; the first timer keeps running, in the list');
    await fa.click('[data-s="180"]');
    s = await app(fa);
    ok(s.ask === null && s.pressed.includes('180') && s.rows.length === 1, 'A: a preset only picks the new length: no question, nothing replaced');
    await fa.click('#go');
    s = await app(fa);
    ok(s.rows.length === 2 && s.rows.some(r => r.total === 180000) && s.rows.some(r => r.id === firstId) && s.list.length === 2 && s.below.length === 0, `A: Start runs 3:00 beside the first; calm again, both in the list (${s.list.join(' | ')})`);
    await fa.click('#add'); await fa.fill('#label', 'pasta'); await fa.click('[data-s="600"]'); await fa.click('#go');
    s = await app(fa);
    const pasta = s.rows.find(r => r.label === 'pasta');
    ok(s.rows.length === 3 && pasta && pasta.total === 600000 && s.label === 'pasta', `A: a third timer, labelled "pasta" on the dial (${s.label})`);
    ok(!s.addShown && !s.picker, 'A: at three New timer is gone, and no preset can be tapped while a timer is on the dial (so none is ever replaced)');
    await flushed(A.page); await sleep(400); await A.page.evaluate(() => hub.pull()); await flushed(A.page);
    const serverRows = await A.page.evaluate(() => hub.timers.list().map(r => r.total).sort((x, y) => x - y));
    ok(serverRows.length === 3 && serverRows.includes(600000), `A: after a pull the house has the three timers (${serverRows.map(x => x / 1000)} s)`);

    console.log('\n## recents (UX-TIMER-7) and a custom time in hours (VIS-TIMER-4)');
    const rec = await fa.evaluate(() => hub.timers.recents());
    ok(rec.length === 3 && rec[0].total === 600000 && rec[0].label === 'pasta' && new Set(rec.map(r => r.total)).size === 3, `A: recents keep the last three distinct lengths, newest first (${rec.map(r => r.total / 1000 + (r.label ? ' ' + r.label : '')).join(', ')})`);
    // judge round: Reset has the same 6 s Undo as Home and the kitchen; Undo puts the timer back as it was, focus on Pause
    const onDial = s.rows.find(r => r.id === s.sel);
    await fa.click('#reset');
    const tst = await fa.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent.trim() : null; });
    ok(/^pasta timer reset\s*Undo$/i.test(tst || '') && !(await app(fa)).rows.some(r => r.id === onDial.id), `A: Reset clears it and toasts "${tst}"`);
    await fa.click('#hub-toast .toast-act');
    s = await app(fa);
    ok(s.rows.some(r => r.id === onDial.id && r.startedAt === onDial.startedAt && r.state === onDial.state) && s.sel === onDial.id && await fa.evaluate(() => document.activeElement && document.activeElement.id === 'go'),
      'A: Undo puts the same timer back on the dial (same start), focus on its Pause');
    // stop all three: Reset on each (a reset timer is gone here at once)
    for (let i = 0; i < 3; i++) { await fa.click('#reset'); await sleep(150); }
    s = await app(fa);
    ok(s.rows.length === 0 && s.goState === 'start' && s.picker && !s.resetVis && !s.plus1Vis, 'A: Reset clears each timer; idle, the picker is back and +1 min / Reset keep their place unseen');
    ok(s.recents.length === 1 && /10:00 · pasta/.test(s.recents[0]), `A: a recent a preset already offers (3:00, 1:00, no label) is left out; "10:00 · pasta" stays (${s.recents.join(' | ')})`);
    await fa.click('#custom-btn');
    ok(await fa.evaluate(() => !document.getElementById('custom').hidden && document.activeElement.id === 'cm'), 'A: Custom opens minutes and seconds, the minutes focused');
    await fa.fill('#cm', '65'); await fa.fill('#cs', '0'); await fa.press('#cm', 'Enter');
    s = await app(fa);
    ok(s.t === '1:05:00', `A: 65 minutes shows as 1:05:00, never 65:00 (${s.t})`);
    await fa.click('#custom-btn'); await fa.click('#cs-up'); await fa.click('#cset');
    ok((await app(fa)).t === '1:05:05', 'A: the seconds stepper adds 5 s (1:05:05)');
    await fa.click('#custom-btn'); await fa.fill('#cm', '0'); await fa.fill('#cs', '0'); await fa.click('#cset');
    ok(await fa.evaluate(() => !document.getElementById('custom').hidden), 'A: 0:00 is refused (the panel stays open)');
    await fa.press('#cm', 'Escape');
    ok(await fa.evaluate(() => document.getElementById('custom').hidden), 'A: Escape closes Custom');
    await fa.click('[data-r="0"]');
    s = await app(fa);
    ok(s.t === '10:00' && s.label === 'pasta' && s.pressed.includes('0'), `A: a recent picks its length and label (${s.t} ${s.label})`);

    console.log('\n## time\'s up: the alert repeats every 15 s until Stop, on one AudioContext (GAP-TIMER-2, P3-TIMER-03, UX-TIMER-4)');
    const before = (await app(fa)).audio;
    await fa.click('#go');
    await fa.evaluate(() => { const r = hub.timers.list()[0]; hub.timers.put({ ...r, endAt: hub.serverNow() + 11500, total: 11500 }); });
    await waitFor(() => fa.evaluate(() => /10 seconds left/.test(document.getElementById('live').textContent)), { timeout: 4000, label: '10 s announcement' }).catch(() => {});
    ok(/10 seconds left/.test((await app(fa)).live), `A: aria-live says "10 seconds left" (UX-TIMER-10; "${(await app(fa)).live}")`);
    await waitFor(() => fa.evaluate(() => document.body.classList.contains('done')), { timeout: 15000, label: 'done' });
    const tDone = Date.now();
    s = await app(fa);
    ok(s.done && /Time's up/.test(s.state) && s.goState === 'stop' && s.go === 'Stop' && s.t === '0:00', `A: at 0 the dial says "${s.state}" in words, Stop is the primary button`);
    ok(!s.resetVis && s.below.length === 0, `A: ringing, Reset steps aside (Stop is the one action) and nothing shows below the actions (${s.below.join(', ') || 'nothing'})`);
    ok(await fa.evaluate(() => !!document.querySelector('#tstate use[href$="#i-bell"]')), 'A: with the bell from the sprite');
    await sleep(200);
    ok(/Time's up/.test((await app(fa)).live), 'A: aria-live says Time\'s up');
    const firstRing = (await app(fa)).audio;
    ok(firstRing.osc > before.osc, `A: it rang (${firstRing.osc - before.osc} notes)`);
    ok(firstRing.made <= 1, `A: one AudioContext for the life of the page (${firstRing.made})`);
    ok(s.rows.length === 1 && s.rows[0].state === 'ended', 'A: the row stays (ended) until Stop: nothing clears it just because it ended');
    await sleep(Math.max(0, 15600 - (Date.now() - tDone)));
    const secondRing = (await app(fa)).audio;
    ok(secondRing.osc > firstRing.osc && secondRing.made <= 1, `A: 15 s later it rings again (${secondRing.osc - firstRing.osc} more notes, still ${secondRing.made} context)`);
    const shellRings = await A.page.evaluate(() => (window.__timerShell || {}).rings || 0);
    ok(shellRings === 0, `A: with the Timer open the shell stays quiet (${shellRings} shell rings)`);
    ok((await pillState(A.page)).toastShown === false, 'A: no shell toast over the app');
    const under = await Promise.all(['#go', '#plus1'].map(sel => underAppButton(A.page, fa, sel)));
    ok(under.every(u => u === 'frame'), `A: Stop and +1 min are tappable at 0 (under: ${under.join(', ')})`);
    await fa.click('#go');
    s = await app(fa);
    ok(!s.done && s.rows.length === 0 && s.goState === 'start' && s.t === '0:12', `A: Stop ends the ringing; the length is ready again (${s.t})`);
    const oscAtStop = (await app(fa)).audio.osc;
    await sleep(15500);
    ok((await app(fa)).audio.osc === oscAtStop, 'A: and it does not ring again');
    const goneInHouse = await waitFor(async () => { await flushed(A.page); await A.page.evaluate(() => hub.pull()); return A.page.evaluate(() => hub.list('timer:', { app: 'timer', scope: 'person' }).length === 0); }, { timeout: 8000, label: 'row gone' }).catch(() => false);
    ok(goneInHouse, 'A: Stop removed the row in the house');

    console.log('\n## the clear rule: a device never clears a newer start (P2-STAB-13)');
    await B.page.evaluate(() => hub.pull());
    const Z = await A.page.evaluate(() => hub.timers.start({ total: 600000 }).id);
    await flushed(A.page); await B.page.evaluate(() => hub.pull());
    const seenOnB = await B.page.evaluate(id => hub.timers.get(id), Z);
    ok(seenOnB && seenOnB.total === 600000, 'B: sees the timer');
    // A restarts the same timer (a new start); B, with the old start in hand, asks to clear the one it saw
    await A.page.evaluate(id => { const r = hub.timers.get(id); const n = hub.serverNow(); hub.timers.put({ ...r, startedAt: n, endAt: n + 300000, total: 300000 }); }, Z);
    await flushed(A.page);
    const cleared = await B.page.evaluate(([id, s0]) => hub.timers.clear(id, s0), [Z, seenOnB.startedAt]);
    await flushed(B.page); await A.page.evaluate(() => hub.pull());
    const still = await A.page.evaluate(id => hub.timers.get(id), Z);
    ok(cleared === false && still && still.total === 300000, `B: clear(old start) refused (${cleared}); A's newer start is still there`);
    // a device asleep through the end wakes on a stale cache: it does not clear the newer timer A started meanwhile
    await B.page.evaluate(id => hub.timers.put({ ...hub.timers.get(id), endAt: hub.serverNow() + 1500, total: 1500 }), Z);
    await flushed(B.page); await A.page.evaluate(() => hub.pull()); await sleep(200);
    await B.ctx.setOffline(true);
    await sleep(2500);                                           // Z ends on both; B is "asleep"
    await A.page.evaluate(id => { const r = hub.timers.list().find(x => x.id === id); if (r) hub.timers.clear(r.id, r.startedAt); }, Z);
    const Y = await A.page.evaluate(() => hub.timers.start({ total: 600000, label: 'oven' }).id);
    await flushed(A.page);
    await B.ctx.setOffline(false);
    await B.page.evaluate(() => hub.pull()); await sleep(800); await flushed(B.page);
    await A.page.evaluate(() => hub.pull());
    const after = await A.page.evaluate(() => hub.timers.list().map(r => r.label + ':' + r.state));
    ok(after.length === 1 && after[0] === 'oven:running', `A: the newer timer survives the device that woke (${after.join(', ')})`);
    ok(await B.page.evaluate(id => hub.timers.list().some(r => r.id === id && r.state === 'running'), Y), 'B: and B shows it running after its pull');

    console.log('\n## the shell rings with the app closed; Stop from the pill');
    await A.page.click('#pill-home'); await sleep(300);
    await A.page.evaluate(id => hub.timers.put({ ...hub.timers.get(id), endAt: hub.serverNow() + 1500, total: 61500 }), Y);
    await flushed(A.page);
    await waitFor(() => A.page.evaluate(() => (window.__timerShell || {}).rings > 0), { timeout: 5000, label: 'shell rang' });
    st = await pillState(A.page);
    ok(st.shown && st.active && st.active.state === 'ended', `A: the pill stays at 0 for the ringing timer (${st.time})`);
    // visual review round 1: no toast over the pill — the pill itself says "Time's up" and is the Stop
    { const lab = await A.page.$eval('#timer-pill-label', e => e.textContent); ok(/^Time's up/.test(lab) && !st.toastShown, `A: the pill says "${lab}" (no toast over it)`); }
    await A.page.click('#timer-pill');
    await waitFor(() => pillState(A.page).then(s => !s.shown && s.rows.length === 0), { timeout: 6000, label: 'A stopped' });
    ok(true, 'A: a tap on the ringing pill stops it');
    // the row goes once A's own pull has landed (hub.timers.clear acts only right after a good pull): flush A, pull B, until gone
    await waitFor(async () => { await flushed(A.page); await B.page.evaluate(() => hub.pull()); return pillState(B.page).then(s => s.rows.length === 0); }, { timeout: 12000, every: 500, label: 'B stopped' }).then(() => ok(true, 'B: gone on the second device too'), () => ok(false, 'B: gone on the second device too'));

    console.log('\n## a timer that ended unseen, and the 10-minute rule (UX-TIMER-3)');
    await A.page.evaluate(() => { const n = hub.serverNow(); hub.timers.put({ id: 'unseen1', label: 'bread', total: 600000, startedAt: n - 780000, endAt: n - 180000, pausedAt: null, remaining: null, ackAt: null }, { fresh: true }); });
    await A.page.evaluate(() => { const n = hub.serverNow(); hub.timers.put({ id: 'old1', label: 'tea', total: 300000, startedAt: n - 960000, endAt: n - 660000, pausedAt: null, remaining: null, ackAt: null }, { fresh: true }); });
    await flushed(A.page);
    fa = await openTimer(A.page, 'timer frame unseen');
    await waitFor(() => fa.evaluate(() => document.body.classList.contains('done')), { timeout: 5000, label: 'unseen done' });
    s = await app(fa);
    // rescore 6: announced once, on the dial ("Ended 8:37 AM") with OK, not a separate line
    ok(s.done && /^Ended \d{1,2}:\d\d/.test(s.state) && s.goState === 'ok' && s.go === 'OK' && !s.resetVis && !(await fa.evaluate(() => !!document.getElementById('ended'))),
      `A: reopened 3 min after the end: the dial reads "${s.state}" and the main button OK (no separate line), and it rings`);
    ok(s.rows.length === 1 && s.rows[0].id === 'unseen1', 'A: the one ended 11 min ago does not ring (only the 3-minute one is live)');
    await A.page.evaluate(() => hub.pull()); await sleep(600); await flushed(A.page);
    ok(await A.page.evaluate(() => !hub.timers.get('old1')), 'A: the 11-minute one was cleared on fresh data (the 10-minute rule)');
    await fa.click('#go');
    s = await app(fa);
    ok(!s.done && s.rows.length === 0, 'A: OK clears it');

    console.log('\n## the migration from timer.active');
    await A.page.click('#pill-home'); await sleep(200);
    const legacyStart = await A.page.evaluate(() => { const n = hub.serverNow(); hub.set('timer.active', { endAt: n + 240000, total: 300, startedAt: n - 60000 }, { app: 'timer', scope: 'person' }); return n - 60000; });
    await flushed(A.page);
    st = await pillState(A.page);
    // the shell may already have moved it (it migrates after each good pull, review round 1): either way one running 5:00 timer
    ok(st.rows.length === 1 && (st.active.legacy || st.active.id === 'm' + Math.round(legacyStart)) && st.active.total === 300000 && st.active.state === 'running', `A: the shell shows an old timer.active as one running timer (${st.active && st.active.id})`, JSON.stringify(st.rows));
    fa = await openTimer(A.page, 'timer frame migrate');
    await sleep(300);
    const mig = await fa.evaluate(() => ({ rows: hub.list('timer:', { app: 'timer', scope: 'person' }).map(x => x.value), legacy: hub.has('timer.active') }));
    ok(mig.rows.length === 1 && mig.rows[0].id === 'm' + Math.round(legacyStart) && mig.rows[0].total === 300000 && !mig.legacy, `A: opening the Timer moves it to timer:${mig.rows[0] && mig.rows[0].id} and removes timer.active`);
    await fa.click('#reset'); await flushed(A.page);
    // the deploy window (review round 1): an old device writes timer.active while a timer: row already runs
    await fa.click('[data-s="600"]'); await fa.click('#go');
    const started2 = await app(fa);
    await flushed(A.page);
    // the old device is B (its hub.js still writes the single row): B writes timer.active, A's Timer pulls it
    await B.page.evaluate(() => hub.pull()); await flushed(B.page);
    const legacy2 = await B.page.evaluate(() => { const n = hub.serverNow(); hub.set('timer.active', { endAt: n + 300000, total: 420, startedAt: n - 120000 }, { app: 'timer', scope: 'person' }); return n - 120000; });
    await flushed(B.page); await fa.evaluate(() => hub.pull()); await sleep(600);
    const mig2 = await fa.evaluate(() => ({ ids: hub.timers.list().map(r => r.id), legacy: hub.has('timer.active') }));
    ok(mig2.ids.length === 2 && mig2.ids.includes('m' + Math.round(legacy2)) && !mig2.legacy, `A: a timer.active written beside a running timer: row is moved too and shows (${mig2.ids.join(', ')})`,
      JSON.stringify({ afterGo: started2.rows.map(r => r.id + ':' + r.state), migRows: mig.rows.map(r => r.id) }));
    for (let i = 0; i < 2 && await fa.evaluate(() => !document.getElementById('reset').disabled); i++) { await fa.click('#reset'); await sleep(150); }
    await flushed(A.page);

    console.log('\n## Say it: the parser (IMP-TIMER-I2)');
    const cases = [
      ['ten minutes', 'start', 600000, ''], ['1 hour 5 minutes', 'start', 3900000, ''], ['90 seconds', 'start', 90000, ''],
      ['pasta 12 minutes', 'start', 720000, 'pasta'], ['set a timer for 12 minutes for the pasta', 'start', 720000, 'pasta'],
      ['half an hour', 'start', 1800000, ''], ['an hour and a half', 'start', 5400000, ''], ['two and a half minutes', 'start', 150000, ''],
      ['twenty five minutes', 'start', 1500000, ''], ['eggs for 7 minutes', 'start', 420000, 'eggs'],
      ['add a minute', 'add', 60000], ['one more minute', 'add', 60000], ['add 2 minutes to the timer', 'add', 120000],
      ['add a timer for 5 minutes', 'start', 300000, ''], ['what time is it', null],
    ];
    const got = await fa.evaluate(cs => cs.map(([t]) => __timer.parse(t)), cases);
    const bad = cases.filter(([, kind, ms, label], i) => kind === null ? got[i] !== null : !(got[i] && got[i].kind === kind && (kind === 'add' ? got[i].ms === ms : got[i].total === ms && got[i].label === label)));
    ok(bad.length === 0, `parser: ${cases.length - bad.length}/${cases.length} phrases understood`, JSON.stringify(bad.map(b => [b[0], got[cases.indexOf(b)]])));
    ok(await fa.evaluate(() => document.getElementById('say').hidden === !hub.voiceSupported), 'Say it shows only where speech recognition exists');

    console.log('\n## Notify me (GAP-TIMER-1) and the sound choice, in Timer settings');
    ok(await fa.evaluate(() => document.getElementById('tsettings').hidden && document.getElementById('tsettings-btn').getAttribute('aria-expanded') === 'false'), 'Timer settings starts closed');
    await fa.click('#tsettings-btn');
    ok(await fa.evaluate(() => !document.getElementById('tsettings').hidden && document.getElementById('tsettings-btn').getAttribute('aria-expanded') === 'true'), 'Timer settings opens the sound and Notify me in place');
    ok(await fa.evaluate(() => !('Notification' in window) || Notification.permission !== 'default' || !document.getElementById('notify').hidden), 'Notify me is offered while the browser has not been asked');
    await fa.click('#sound [data-sound="bell"]');
    s = await app(fa);
    ok(s.pressed.includes('bell') && await fa.evaluate(() => hub.get('sound') === 'bell'), 'Bell chosen: a person row, pressed');
    await fa.click('#sound [data-sound="chime"]');

    console.log('\n## desktop: the pill sits beside the sidebar');
    await A.page.click('#pill-home');
    const D = await newContext(browser, 'D', { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    await signIn(D.page, 'eli', '1357');
    await D.page.evaluate(() => hub.timers.start({ total: 600000 }));
    await waitFor(() => pillState(D.page).then(s => s.shown), { label: 'D pill' });
    const dbox = await D.page.$eval('#timer-pill', e => e.getBoundingClientRect());
    ok(dbox.left >= 0 && dbox.right <= 220 && dbox.height >= 44, `D: pill at the foot of the sidebar at 1440, never on content (VIS-HOME-2; left ${Math.round(dbox.left)}, right ${Math.round(dbox.right)})`);
    await D.page.screenshot({ path: path.join(SHOTS, 'rm9-pill-1440.png') });
    await D.page.click('.tab[data-tab=chat]'); await sleep(400);
    cc = await chatClear(D.page);
    ok((await pillState(D.page)).shown && !cc.overlap && cc.underInput === 'chat-in' && cc.underSend !== 'timer-pill' && cc.underMic !== 'timer-pill', `D: on Chat at 1440 the pill (in the sidebar) is clear of the composer, mic and send uncovered (${JSON.stringify(cc)})`);
    await D.page.screenshot({ path: path.join(SHOTS, 'rm9-chat-1440.png') });
    await D.page.click('.tab[data-tab=home]');
    ok(await D.page.$eval('#timer-pill', e => e.getBoundingClientRect().bottom > 900 - 60), 'D: back on Home the pill drops back to the bottom');
    await flushed(D.page);
    const E = await newContext(browser, 'E', { viewport: { width: 820, height: 1180 } });
    await signIn(E.page, 'eli', '1357');
    await E.page.evaluate(() => hub.pull());
    await waitFor(() => pillState(E.page).then(s => s.shown), { label: 'E pill' });
    await E.page.click('.tab[data-tab=chat]'); await sleep(400);
    cc = await chatClear(E.page);
    ok(chatOk(cc), `E: on Chat at 820 the pill sits clear above the composer (${JSON.stringify(cc)})`);
    await E.page.screenshot({ path: path.join(SHOTS, 'rm9-chat-820.png') });
    await E.ctx.close();
    await D.page.evaluate(() => { for (const r of hub.timers.list()) hub.timers.clear(r.id, r.startedAt); });
    await sleep(800); await flushed(D.page); await D.ctx.close();

    // ── shell half (Worker C) ──
    console.log('\n## the shell: several timers, the ring, Stop in the pill (batch 6, Worker C)');
    {
      const S = await newContext(browser, 'S');
      await signIn(S.page, 'eli', '1357');
      await wipe(S.page); await flushed(S.page);
      // two timers: a 6-second one and a 10-minute one, started from the page (no tap: the wake-lock check below needs none)
      await S.page.evaluate(() => { hub.timers.start({ total: 600000, label: 'Roast' }); hub.timers.start({ total: 6000, label: 'Tea' }); });
      await waitFor(() => pillState(S.page).then(s => s.shown), { label: 'S pill' });
      const p1 = await S.page.evaluate(() => ({ label: document.getElementById('timer-pill-label').textContent, more: document.getElementById('timer-pill-more').hidden ? '' : document.getElementById('timer-pill-more').textContent, time: document.getElementById('timer-pill-time').textContent }));
      ok(p1.label === 'Tea' && p1.more === '+1' && /^0:0[3-6]$/.test(p1.time), `two timers: the pill shows the soonest ("${p1.label} ${p1.time}") and "+1" for the other`, JSON.stringify(p1));
      // the ring: Tea ends; the pill becomes "Time's up · Tea" with Stop, and the sound plays, then again 15 s later
      await waitFor(() => S.page.evaluate(() => document.getElementById('timer-pill').classList.contains('ringing')), { timeout: 12000, label: 'ringing' });
      const r1 = await S.page.evaluate(() => ({ label: document.getElementById('timer-pill-label').textContent, stop: !document.getElementById('timer-pill-stop').hidden, stopText: document.getElementById('timer-pill-stop').textContent, time: getComputedStyle(document.getElementById('timer-pill-time')).display, rings: window.__timerShell.rings, aria: document.getElementById('timer-pill').getAttribute('aria-label'), icon: document.querySelector('#timer-pill use').getAttribute('href') }));
      ok(/^Time's up · Tea$/.test(r1.label) && r1.stop && r1.stopText === 'Stop' && r1.time === 'none' && /icons\/sprite\.svg#i-bell$/.test(r1.icon), `at 0 the pill says "${r1.label}" with the bell and a Stop (UX-TIMER-4: words and an icon, not colour alone)`, JSON.stringify(r1));
      ok(r1.rings >= 1 && /Stop it/.test(r1.aria), 'the shell rang (the Timer app is closed) and the pill is Stop for VoiceOver', JSON.stringify(r1));
      const ctxs = await S.page.evaluate(() => hub.timers.contexts);
      ok(ctxs <= 1, `one AudioContext in the shell, reused (P3-TIMER-03): ${ctxs}`);
      // the shell's tick is 1 s and it rings again 14.5 s after the last ring, so the second ring lands 15 s (+ a tick's drift)
      // after the first; 16.5 s covers one late tick and no more (L4: 15.6 s missed it whenever a tick ran a few ms late)
      await sleep(16500);
      const r2 = await S.page.evaluate(() => window.__timerShell.rings);
      ok(r2 >= r1.rings + 1, `it rings again 15 s later until Stop (GAP-TIMER-2): ${r1.rings} → ${r2}`);
      const rows0 = await S.page.evaluate(() => hub.timers.list().map(r => r.label + ':' + r.state));
      ok(rows0.includes('Tea:ended') && rows0.includes('Roast:running'), 'the ended row stays on the house until Stop (no device clears it at 0)', JSON.stringify(rows0));
      await S.page.click('#timer-pill');                                   // the whole pill is Stop while it rings
      await sleep(300);
      const p2 = await S.page.evaluate(() => ({ ringing: document.getElementById('timer-pill').classList.contains('ringing'), label: document.getElementById('timer-pill-label').textContent, more: document.getElementById('timer-pill-more').hidden, list: hub.timers.list().map(r => r.label) }));
      ok(!p2.ringing && p2.label === 'Roast' && p2.more && p2.list.join() === 'Roast', 'Stop in the pill: Tea stops at once on this device and the pill shows Roast', JSON.stringify(p2));
      await flushed(S.page);
      const srv = await S.page.evaluate(() => hub.request('/api/data/timer?scope=person').then(r => r.items.filter(i => i.value && /^timer:/.test(i.key)).map(i => i.value.label)));
      ok(srv.join() === 'Roast', 'Tea\'s row is removed from the house (after a pull, under its own start)', JSON.stringify(srv));
      const rings3 = await S.page.evaluate(() => window.__timerShell.rings); await sleep(1500);
      ok(await S.page.evaluate(() => window.__timerShell.rings) === rings3, 'after Stop nothing rings');
      // P2-STAB-09, with Roast still counting
      // (a second page of the same device, opened straight onto Home: nothing has been tapped there, so it holds no lock)
      {
        const W2 = await S.ctx.newPage();
        await W2.goto(SITE + '/index.html'); await W2.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && hub.timers.list().length === 1, null, { timeout: 15000 });
        const wl0 = await W2.evaluate(() => window.__wl);
        await W2.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await sleep(200);
        const wl1 = await W2.evaluate(() => window.__wl);
        ok(wl0 === 0 && wl1 >= 1, 'P2-STAB-09: back in view with a timer counting, the shell asks for the wake lock with no tap', JSON.stringify({ before: wl0, after: wl1 }));
        await W2.close(); await S.page.bringToFront();               // the first page is the one in view again
      }
      await wipe(S.page); await flushed(S.page);

      console.log('\n## the Timer app open, the page hidden at 0: a notification all the same (P3-TIMER-04)');
      await S.ctx.grantPermissions(['notifications'], { origin: SITE });
      const f = await openTimer(S.page);
      await S.page.evaluate(() => { localStorage.removeItem('hub.timers.notified'); hub.timers.start({ total: 3000, label: 'Kettle' }); });
      await S.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
      await waitFor(() => S.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hub.timers.notified') || '{}')).length > 0), { timeout: 12000, label: 'notified' }).catch(() => {});
      const nt = await S.page.evaluate(() => ({ marks: Object.keys(JSON.parse(localStorage.getItem('hub.timers.notified') || '{}')), shell: window.__timerShell.notified, perm: Notification.permission, regs: navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r => r.length) : 0 }));
      ok(nt.marks.length === 1 && /^[a-z0-9]+@\d+@\d+$/.test(nt.marks[0]), `with the Timer open and the page hidden, "Timer done" is notified once for Kettle (marks ${nt.marks.length}; the shell showed ${nt.shell})`, JSON.stringify(nt));
      ok(await S.page.evaluate(() => window.__timerShell.ringing.length === 0), 'with the Timer app open the shell plays nothing for the person\'s own timers (the app rings for itself)');
      await S.page.evaluate(() => { delete document.hidden; delete document.visibilityState; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
      await f.evaluate(() => { for (const r of hub.timers.list()) hub.timers.clear(r.id, r.startedAt); });
      await sleep(600); await flushed(S.page);
      await S.ctx.close();
    }

    console.log('\n## a Switch keeps the running timer on this device (P2-PROF-08)');
    {
      const K = await newContext(browser, 'K', { viewport: { width: 820, height: 1180 } });
      await signIn(K.page, 'eli', '1357');
      await wipe(K.page); await flushed(K.page);
      await K.page.evaluate(() => hub.timers.start({ total: 15000, label: 'Pasta' }));
      await flushed(K.page);
      const startedAt = await K.page.evaluate(() => hub.timers.list()[0].startedAt);
      await K.page.click('.tab[data-tab=me]'); await K.page.click('#switch');
      await K.page.waitForSelector('.pcard[data-id=ezra]');
      const atPicker = await K.page.evaluate(() => ({ pill: !document.getElementById('timer-pill').hidden, dev: JSON.parse(localStorage.getItem('hub.timers.device') || '[]').map(e => e.owner + ':' + e.row.label) }));
      ok(!atPicker.pill && atPicker.dev.join() === 'eli:Pasta', 'at the picker the timer is kept on this device (hub.timers.device) and the pill waits (only a ringing one shows there)', JSON.stringify(atPicker));
      await K.page.click('.pcard[data-id=ezra]');
      await K.page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
      await waitFor(() => pillState(K.page).then(s => s.shown), { label: 'Eli\'s pill for Ezra' });
      const k1 = await K.page.evaluate(() => ({ label: document.getElementById('timer-pill-label').textContent, time: document.getElementById('timer-pill-time').textContent, who: hub.profile.id, h: document.getElementById('timer-pill').getBoundingClientRect().height }));
      ok(k1.who === 'ezra' && k1.label === "Eli's Pasta" && /^0:(0\d|1[0-5])$/.test(k1.time), `after the Switch Ezra's pill reads "${k1.label} · ${k1.time}"`, JSON.stringify(k1));
      ok(k1.h >= 64, `P4-SHAPE-01: a kid's pill is --tap high (${Math.round(k1.h)} px at 820, ≥ 64)`, String(k1.h));
      await waitFor(() => K.page.evaluate(() => document.getElementById('timer-pill').classList.contains('ringing')), { timeout: 20000, label: 'Eli\'s timer rings for Ezra' });
      const k2 = await K.page.evaluate(() => ({ label: document.getElementById('timer-pill-label').textContent, rings: window.__timerShell.rings }));
      ok(/^Time's up · Eli's Pasta$/.test(k2.label) && k2.rings >= 1, `at 0 it rings on this device for Ezra: "${k2.label}"`, JSON.stringify(k2));
      await K.page.click('#timer-pill');
      await sleep(300);
      ok(await K.page.evaluate(() => document.getElementById('timer-pill').hidden && !JSON.parse(localStorage.getItem('hub.timers.device') || '[]').length), 'Ezra\'s Stop stops it on this device');
      // Eli's row is Eli's: a Stop by someone else never writes it (the owner's next session, or the Worker's 10-minute rule)
      const B2 = await newContext(browser, 'B2');
      await signIn(B2.page, 'eli', '1357');
      const eliRows = await B2.page.evaluate(() => hub.request('/api/data/timer?scope=person').then(r => r.items.filter(i => i.value && /^timer:/.test(i.key)).map(i => i.value.startedAt)));
      ok(eliRows.includes(startedAt), 'Eli\'s ended row is still on the house after Ezra\'s Stop (nobody writes another person\'s rows)', JSON.stringify(eliRows));
      await B2.page.evaluate(() => { for (const r of hub.timers.list({ stale: true })) hub.timers.clear(r.id, r.startedAt); });
      await sleep(600); await flushed(B2.page);
      await B2.ctx.close(); await K.ctx.close();
    }


    console.log('\n## the shell and the Timer frame write the same queue at once (core review round 1)');
    {
      const Q = await newContext(browser, 'Q');
      await signIn(Q.page, 'eli', '1357');
      const fq = await openTimer(Q.page, 'Q timer frame');
      await Q.ctx.setOffline(true); await sleep(300);
      const run = Date.now().toString(36), want = [];
      for (let i = 0; i < 12; i++) {
        want.push(`probe:${run}:s${i}`, `probe:${run}:a${i}`);
        await Promise.all([
          Q.page.evaluate(k => { hub.set(k, { by: 'shell' }, { app: 'timer', scope: 'person', unloaded: true }); }, `probe:${run}:s${i}`),
          fq.evaluate(k => { hub.set(k, { by: 'app' }, { unloaded: true }); }, `probe:${run}:a${i}`),
        ]);
      }
      await sleep(500);
      const q = await Q.page.evaluate(() => Object.keys(Object.assign({}, ...Object.keys(localStorage).filter(k => k === 'hub.queue.timer.person.eli' || k.startsWith('hub.queue.timer.person.eli.')).map(k => JSON.parse(localStorage.getItem(k) || '{}')))));
      const missing = want.filter(k => !q.includes(k));
      ok(!missing.length, `offline, 12 pairs written at once by the shell and the Timer frame: all 24 rows stay queued (hub.js saveQueue merges the stored queue; missing ${missing.length})`, JSON.stringify(missing));
      await Q.ctx.setOffline(false);
      for (let i = 0; i < 30; i++) { await Q.page.evaluate(() => hub.flush()); await fq.evaluate(() => hub.flush()); if (!(await Q.page.evaluate(() => hub.sync.pending))) break; await sleep(300); }
      const srv = await Q.page.evaluate(r => hub.request('/api/data/timer?scope=person&prefix=probe:' + r).then(x => x.items.filter(i => i.value).map(i => i.key)), run);
      const lost = want.filter(k => !srv.includes(k));
      ok(!lost.length, `back online, every one of them reaches the house (lost ${lost.length})`, JSON.stringify(lost));
      await Q.page.evaluate(ks => { for (const k of ks) hub.set(k, null, { app: 'timer', scope: 'person', unloaded: true }); return hub.flush(); }, want);
      await Q.ctx.close();
    }

    console.log('\n## the display profile only looks');
    const C = await newContext(browser, 'C');
    await signIn(C.page, 'tv');
    ok(await C.page.evaluate(() => hub.isKiosk && !hub.canWrite), 'kiosk session');
    ok(await C.page.evaluate(() => hub.timers.start({ total: 60000 }) === null && hub.sync.pending === 0), 'kiosk: hub.timers writes nothing');
    ok(await C.page.evaluate(() => window.__beeps) === 0, 'kiosk: no beep');
    ok(await C.page.evaluate(() => hub.sync.pending === 0 && hub.sync.state !== 'error'), 'kiosk: nothing written, no error');
    await C.ctx.close(); await B.ctx.close(); await A.ctx.close();
    ok(errors.length === 0, 'no console/page errors', errors.slice(0, 5).join(' | '));
  } finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
