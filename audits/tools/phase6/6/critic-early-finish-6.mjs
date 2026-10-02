// Batch 6 copy of audits/tools/phase3/timer/critic-early-finish.mjs. WHY A COPY: batch 6 replaced the single row timer.active with one row per timer (timer:<id>, server time, apps/hub.js
// hub.timers), and a timer now rings at 0 until Stop instead of clearing itself. The original reads or writes timer.active,
// so it measures nothing on the new code. A page on an installed clock holds hub.skew at 0 (_t6.mjs holdSkew), or
// the skew rule would put the timer back on the real clock after every jump. This copy writes and reads the new rows
// through ./_t6.mjs and saves under
// audits/evidence/p6/6; the wait for the app is "live" (it has pulled), and every time read in the page is hub.serverNow()
// (the stored times are server ms; the skew is held after Start so the installed clock can run ahead). Beeps are oscillator starts (one AudioContext now lives for the page).
//   node "audits/tools/phase6/6/critic-early-finish-6.mjs"
// Completeness critic: when does the Kitchen timer reach 0:00 relative to endAt? step() rounds (apps/timer.html:108), and
// the shell pill rounds too (index.html:815). Standalone app (no shell, so one clock), WebKit, controllable browser clock
// stepped 50 ms at a time. Records the offset (ms before/after endAt) of the first "0:59" after Start, of "0:00" + done,
// and of the shell's clear when run inside the hub.
// Run: node "audits/tools/phase6/6/critic-early-finish-6.mjs"  -> audits/evidence/p3/timer/critic-early-finish.json
import { local, sleep } from '../../lib/local.mjs';
import { audioProbe } from '../../phase3/timer/_util.mjs';
import { save6 as save, PAGE_FIRST, closeRig, watchdog } from './_t6.mjs';
watchdog();   // batch 6 final run 3: a script that never exits is cut off and says so
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() });
  await audioProbe(d.ctx);
  await d.page.goto(L.site + '/apps/timer.html', { waitUntil: 'load' });
  const f = d.page;
  for (let i = 0; i < 100; i++) { if (await f.evaluate(() => window.__timer && __timer.isLive())) break; await d.ctx.clock.runFor(100); await sleep(20); }
  await f.click('[data-s="60"]'); await f.click('#go'); await f.evaluate(() => { const k = +hub.skew || 0; Object.defineProperty(hub, 'skew', { get: () => k, set: () => {}, configurable: true }); });   // the fake clock: hold the skew (a server reply would snap serverNow back to real time)
  const endAt = await f.evaluate('(' + PAGE_FIRST + ').endAt');
  const rows = [];
  let first59 = null, done = null;
  const read = () => f.evaluate(() => ({ now: hub.serverNow(), t: document.getElementById('t').textContent, done: document.body.classList.contains('done'), beeps: window.__audio ? window.__audio.osc : null }));
  for (let i = 0; i < 40; i++) { await d.ctx.clock.runFor(50); const r = await read(); if (r.t === '0:59' && first59 == null) { first59 = { ...r, msAfterStart: r.now - (endAt - 60000) }; break; } }
  await d.ctx.clock.runFor(endAt - 2000 - (await read()).now);
  for (let i = 0; i < 60; i++) { await d.ctx.clock.runFor(50); const r = await read(); rows.push({ msToEnd: endAt - r.now, t: r.t, done: r.done }); if (r.done) { done = { ...r, msBeforeEndAt: endAt - r.now }; break; } }
  Object.assign(out, { endAt, first59, done, lastRows: rows.slice(-8) });
} finally { await closeRig(L); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('critic-early-finish-6.json', out));
process.exit(process.exitCode || 0);   // nothing left open keeps the script alive (batch 6 final run 3)
