// Batch 6 copy of audits/tools/phase3/timer/verify-critic-early-finish-rounding-4-1.mjs. WHY A COPY: batch 6 replaced the single row timer.active with one row per timer (timer:<id>, server time, apps/hub.js
// hub.timers), and a timer now rings at 0 until Stop instead of clearing itself. The original reads or writes timer.active,
// so it measures nothing on the new code. A page on an installed clock holds hub.skew at 0 (_t6.mjs holdSkew), or
// the skew rule would put the timer back on the real clock after every jump. This copy writes and reads the new rows
// through ./_t6.mjs and saves under
// audits/evidence/p6/6; the wait is for "live", page times are hub.serverNow() (the skew held after Start so the installed
// clock can run ahead), and the beep time is the first oscillator
// (the one AudioContext is made at Start now, so its construction no longer marks the beep).
//   node "audits/tools/phase6/6/verify-critic-early-finish-rounding-4-1-6.mjs"
// Skeptic #1 for critic-early-finish-rounding-4: does the Kitchen timer reach 0:00 / done / beep before endAt, and does each
// digit change early, because step() uses Math.round (apps/timer.html:108-109)? Independent of the investigator's script:
// own AudioContext counter, 10 ms clock steps around each boundary, two presets (1 min and 3 min), and a check of when
// timer.active is removed relative to endAt.
// Run: node "audits/tools/phase6/6/verify-critic-early-finish-rounding-4-1-6.mjs"
//   -> audits/evidence/p3/timer/verify-critic-early-finish-rounding-4-1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { PAGE_FIRST, clearTimers, closeRig, watchdog } from './_t6.mjs';
watchdog();   // batch 6 final run 3: a script that never exits is cut off and says so
const OUT = path.join(ROOT, 'audits', 'evidence', 'p6', '6', 'verify-critic-early-finish-rounding-4-1-6.json');
const out = { runs: [] };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  for (const preset of [60, 180]) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() });
    await d.ctx.addInitScript(() => {
      window.__ac = 0; const W = window.AudioContext || window.webkitAudioContext;
      if (W) { const P = function (...a) { window.__ac++; const c = new W(...a); const co = c.createOscillator.bind(c); c.createOscillator = () => { if (!window.__acAt) window.__acAt = Date.now() + ((window.hub && +hub.skew) || 0); return co(); }; return c; }; window.AudioContext = P; window.webkitAudioContext = P; }
    });
    const p = d.page;
    await p.goto(L.site + '/apps/timer.html', { waitUntil: 'load' });
    for (let i = 0; i < 150; i++) { if (await p.evaluate(() => window.__timer && __timer.isLive())) break; await d.ctx.clock.runFor(100); await sleep(20); }
    await p.click(`[data-s="${preset}"]`); await p.click('#go'); await p.evaluate(() => { const k = +hub.skew || 0; Object.defineProperty(hub, 'skew', { get: () => k, set: () => {}, configurable: true }); });   // the fake clock: hold the skew (a server reply would snap serverNow back to real time)
    const endAt = await p.evaluate('(' + PAGE_FIRST + ').endAt');
    const start = endAt - preset * 1000;
    const read = () => p.evaluate(() => ({ now: hub.serverNow(), t: document.getElementById('t').textContent, done: document.body.classList.contains('done'), ac: window.__ac, acAt: window.__acAt || null, active: hub.timers.list().length > 0 }));
    const first = await read();
    // first digit change after Start
    let firstChange = null;
    for (let i = 0; i < 200; i++) { await d.ctx.clock.runFor(10); const r = await read(); if (r.t !== first.t) { firstChange = { from: first.t, to: r.t, msAfterStart: r.now - start }; break; } }
    // jump to 3 s before endAt, then 10 ms steps until done
    await d.ctx.clock.runFor(endAt - 3000 - (await read()).now);
    const trail = []; let done = null, prevT = null;
    for (let i = 0; i < 400; i++) {
      await d.ctx.clock.runFor(10); const r = await read();
      if (r.t !== prevT) trail.push({ t: r.t, msBeforeEndAt: endAt - r.now, done: r.done }); prevT = r.t;
      if (r.done) { done = { t: r.t, msBeforeEndAt: endAt - r.now, audioContextsMade: r.ac, beepMsBeforeEndAt: r.acAt ? endAt - r.acAt : null, timerActiveStillSet: r.active }; break; }
    }
    const run = { preset, startDisplay: first.t, firstChange, digitChangesNearEnd: trail, done };
    out.runs.push(run);
    console.log(`preset ${preset}s: start shows ${first.t}; first change ${firstChange && firstChange.from + '->' + firstChange.to} at +${firstChange && firstChange.msAfterStart} ms (ceil would be ~+1000)`);
    console.log('  digit changes near end (ms before endAt):', trail.map(x => `${x.t}@${x.msBeforeEndAt}${x.done ? ' DONE' : ''}`).join(', '));
    console.log('  done:', JSON.stringify(done));
    await d.ctx.close().catch(() => {}); await clearTimers(L, 'eli');   // the finished timer rings until Stop: clear it before the next preset
  }
} finally { await closeRig(L); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('saved', path.relative(ROOT, OUT));
process.exit(process.exitCode || 0);   // nothing left open keeps the script alive (batch 6 final run 3)
