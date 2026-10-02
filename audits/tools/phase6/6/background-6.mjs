// Batch 6 copy of audits/tools/phase3/timer/background.mjs. WHY A COPY: batch 6 replaced the single row timer.active with one row per timer (timer:<id>, server time, apps/hub.js
// hub.timers), and a timer now rings at 0 until Stop instead of clearing itself. The original reads or writes timer.active,
// so it measures nothing on the new code. A page on an installed clock holds hub.skew at 0 (_t6.mjs holdSkew), or
// the skew rule would put the timer back on the real clock after every jump. This copy writes and reads the new rows
// through ./_t6.mjs and saves under
// audits/evidence/p6/6; reset() clears every timer: row.
//   node "audits/tools/phase6/6/background-6.mjs"
// Accuracy after backgrounding and what fires at 0, on the local rig (Chromium: it has a real AudioContext; typical seed,
// real server clock, a controllable browser clock via installClock). "Hidden" is emulated: document.hidden forced true and
// visibilitychange dispatched in the shell and the app frame, then clock.fastForward (due timers fire at most once, as on
// a page resumed after suspension), then visible again. Beeps are counted by wrapping AudioContext; notifications by a
// stubbed 'granted' permission + fake service-worker registration (see _util.mjs). All taps go through the real UI.
// Run: node "audits/tools/phase6/6/background-6.mjs"   Output: audits/evidence/p3/timer/background.json
import { local, sleep } from '../../lib/local.mjs';
import { shot, appState, pillState, audioProbe, notifyProbe, toastText } from '../../phase3/timer/_util.mjs';
import { save6 as save, serverTimers as serverTimer, clearTimers, holdSkew, closeRig, watchdog } from './_t6.mjs';
watchdog();   // batch 6 final run 3: a script that never exits is cut off and says so
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const setHidden = async (page, hidden) => {
  for (const fr of page.frames()) await fr.evaluate(h => {
    Object.defineProperty(document, 'hidden', { get: () => h, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => (h ? 'hidden' : 'visible'), configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden).catch(() => {});
};
async function fresh() {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() });
  await audioProbe(d.ctx); await notifyProbe(d.ctx); await holdSkew(d.ctx);
  await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await d.ctx.clock.runFor(800);
  return d;
}
async function openTimer(d) {
  await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]');
  let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go') && window.__audio);
  await d.ctx.clock.runFor(700); return f;
}
async function reset(pid = 'eli') { await clearTimers(L, pid); }
const step = async (name, fn) => { try { await fn(); } catch (e) { out[name] = { error: String(e).slice(0, 300) }; } };
try {
  // B1 — app open, 10-min timer, hidden 4 min, back: app time; then leave to Home (pill), hidden 3 min, then Tally (chip)
  await step('B1', async () => { const d = await fresh(); const f = await openTimer(d);
    await f.click('[data-s="600"]'); await f.click('#go'); await d.ctx.clock.runFor(2000);
    const before = await appState(f);
    await setHidden(d.page, true); await d.ctx.clock.fastForward('04:00'); await setHidden(d.page, false); await d.ctx.clock.runFor(1000);
    const after = await appState(f);
    await d.page.click('#pill-home'); await d.ctx.clock.runFor(1500); await d.page.click('.tab[data-tab="home"]'); await d.ctx.clock.runFor(1200);
    const pill = await pillState(d.page);
    await setHidden(d.page, true); await d.ctx.clock.fastForward('03:00'); await setHidden(d.page, false); await d.ctx.clock.runFor(1200);
    const pillAfter3 = await pillState(d.page);
    await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="tally"]'); await d.ctx.clock.runFor(1500);
    const chip = await pillState(d.page);
    out.B1 = { before: before.time, afterHidden4min: after.time, homePill: pill.pill, pillAfterHidden3min: pillAfter3.pill, chipOverTally: chip.chip, pillHiddenInApp: chip.pill,
      shot: await shot(d.page, 'background-chip-over-tally-iphone.png') };
    await d.close(); await reset(); });
  // B2 — app open, 1-min timer, the page hidden through the end and back 3 min after start
  await step('B2', async () => { const d = await fresh(); const f = await openTimer(d);
    await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1500);
    await setHidden(d.page, true); await d.ctx.clock.fastForward('03:00');
    const whileHidden = { app: await appState(f), shell: await pillState(d.page) };
    await setHidden(d.page, false); await d.ctx.clock.runFor(1500);
    out.B2 = { whileHidden, back: await appState(f), shell: await pillState(d.page), toast: await toastText(d.page), server: await serverTimer(L, 'eli') };
    await d.close(); await reset(); });
  // B3 — app open and visible at 0 (the common case: start, leave the phone on the counter)
  await step('B3', async () => { const d = await fresh(); const f = await openTimer(d);
    await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(58000); const at58 = await appState(f);
    await d.ctx.clock.runFor(4000);
    out.B3 = { at58: at58.time, atEnd: await appState(f), shell: await pillState(d.page), toast: await toastText(d.page), server: await serverTimer(L, 'eli') };
    await d.ctx.clock.runFor(60000); out.B3.oneMinuteLater = { app: await appState(f), shell: await pillState(d.page) };
    await d.close(); await reset(); });
  // B4 — app closed (Home) and visible at 0
  await step('B4', async () => { const d = await fresh(); const f = await openTimer(d);
    await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1000);
    await d.page.click('#pill-home'); await d.ctx.clock.runFor(600); await d.page.click('.tab[data-tab="home"]');
    await d.ctx.clock.runFor(61000);
    out.B4 = { shell: await pillState(d.page), toast: await toastText(d.page), server: await serverTimer(L, 'eli') };
    await d.ctx.clock.runFor(60000); out.B4.oneMinuteLater = { shell: await pillState(d.page), toast: await toastText(d.page) };
    await d.close(); await reset(); });
  // B5 — app closed, page hidden through the end, back 3 min after start
  await step('B5', async () => { const d = await fresh(); const f = await openTimer(d);
    await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1000);
    await d.page.click('#pill-home'); await d.ctx.clock.runFor(600); await d.page.click('.tab[data-tab="home"]');
    await setHidden(d.page, true); await d.ctx.clock.fastForward('03:00'); const hid = await pillState(d.page); await setHidden(d.page, false); await d.ctx.clock.runFor(1500);
    out.B5 = { whileHidden: hid, back: await pillState(d.page), toast: await toastText(d.page), server: await serverTimer(L, 'eli') };
    await d.close(); await reset(); });
  // B6 — the whole page closed before 0 (Timer app was open), reopened on #timer 3 min later
  await step('B6', async () => { const d = await fresh(); const f = await openTimer(d);
    await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(2000);
    await d.page.goto('about:blank'); await d.ctx.clock.fastForward('03:00');
    await d.page.goto(L.site + '/index.html#timer'); await d.ctx.clock.runFor(2500);
    let f2; for (let i = 0; i < 40 && !(f2 = d.frame('timer')); i++) { await d.ctx.clock.runFor(100); await sleep(50); }
    await f2.waitForFunction(() => window.hub && document.getElementById('go')); await d.ctx.clock.runFor(1500);
    out.B6 = { reopened: await appState(f2), shell: await pillState(d.page), toast: await toastText(d.page), server: await serverTimer(L, 'eli') };
    await d.close(); await reset(); });
} finally { await closeRig(L); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('background-6.json', out));
process.exit(process.exitCode || 0);   // nothing left open keeps the script alive (batch 6 final run 3)
