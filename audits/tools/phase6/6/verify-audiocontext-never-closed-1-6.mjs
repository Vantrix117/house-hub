// Batch 6 copy of audits/tools/phase3/timer/verify-audiocontext-never-closed-1.mjs. WHY A COPY: batch 6 replaced the single row timer.active with one row per timer (timer:<id>, server time, apps/hub.js
// hub.timers), and a timer now rings at 0 until Stop instead of clearing itself. The original reads or writes timer.active,
// so it measures nothing on the new code. A page on an installed clock holds hub.skew at 0 (_t6.mjs holdSkew), or
// the skew rule would put the timer back on the real clock after every jump. This copy writes and reads the new rows
// through ./_t6.mjs and saves under
// audits/evidence/p6/6; part A waits for "live" and taps Stop before each new Start (a finished timer rings until Stop).
//   node "audits/tools/phase6/6/verify-audiocontext-never-closed-1-6.mjs"
// Skeptic #1 for finding "audiocontext-never-closed" (Kitchen timer). Independent of clocktz.mjs.
//  A  apps/timer.html standalone, browser clock installed: 1-min preset, Start, run 62 s to the end (beep), Start again ... x3,
//     all through the UI (clicks). Count AudioContexts constructed / close() calls / state of every context kept alive.
//  B  the shell (index.html#home, Timer app NOT open, real clock): timer.active written through the API 4 s ahead, shell pulls,
//     pill reaches 0 -> finishTimer -> timerBeep (index.html:788-796). x3. Same counts in the shell document.
// Run: node "audits/tools/phase6/6/verify-audiocontext-never-closed-1-6.mjs"
// Output: audits/evidence/p3/timer/verify-audiocontext-never-closed-1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { putTimer, clearTimers, holdSkew, closeRig, watchdog } from './_t6.mjs';
watchdog();   // batch 6 final run 3: a script that never exits is cut off and says so
const OUT = path.join(ROOT, 'audits', 'evidence', 'p6', '6', 'verify-audiocontext-never-closed-1-6.json');
const probe = () => {
  const Real = window.AudioContext || window.webkitAudioContext;
  const log = window.__ac = { made: 0, closeCalls: 0, list: [] };
  if (!Real) { log.none = true; return; }
  class P extends Real { constructor(...a) { super(...a); log.made++; log.list.push(this); } close() { log.closeCalls++; return super.close(); } }
  window.AudioContext = P; window.webkitAudioContext = P;
};
const read = f => f.evaluate(() => { const l = window.__ac; return l.none ? { none: true } : { made: l.made, closeCalls: l.closeCalls, states: l.list.map(c => c.state), notClosed: l.list.filter(c => c.state !== 'closed').length }; });
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  { // A
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() });
    await d.ctx.addInitScript(probe); await holdSkew(d.ctx);
    await d.page.goto(L.site + '/apps/timer.html');
    await d.page.waitForFunction(() => window.hub && hub.profile && document.getElementById('go'));
    await d.ctx.clock.runFor(1500);
    for (let i = 0; i < 150; i++) { if (await d.page.evaluate(() => !!(window.__timer && __timer.isLive()))) break; await d.ctx.clock.runFor(100); await sleep(20); }
    const f = d.page.mainFrame();
    await f.click('[data-s="60"]');
    const runs = [];
    for (let i = 0; i < 3; i++) {
      if (await f.evaluate(() => document.getElementById('go').dataset.state === 'stop')) await f.click('#go');
      await f.click('#go'); await d.ctx.clock.runFor(62000); await sleep(400);
      runs.push({ run: i + 1, time: await f.textContent('#t'), done: await f.evaluate(() => document.body.classList.contains('done')), ...(await read(f)) });
    }
    await d.ctx.clock.runFor(120000); await sleep(300);
    out.A_timerApp = { runs, twoMinutesAfterLast: await read(f), engine: 'chromium' };
    await d.close(); await clearTimers(L, 'eli');
  }
  { // B
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(probe); await holdSkew(d.ctx);
    await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await sleep(1500);
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const now = Date.now();
      const w = await putTimer(L, 'eli', { endAt: now + 4000, total: 60, startedAt: now - 56000 });
      await d.page.evaluate(() => hub.pull()).catch(e => String(e));
      await sleep(8000);
      runs.push({ run: i + 1, write: w.status, pill: await d.page.evaluate(() => document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent),
        toastSeen: await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t ? t.textContent : null; }), ...(await read(d.page)) });
    }
    out.B_shell = { runs };
    await d.close();
  }
} finally { await closeRig(L); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
console.log('saved', path.relative(ROOT, OUT));
process.exit(process.exitCode || 0);   // nothing left open keeps the script alive (batch 6 final run 3)
