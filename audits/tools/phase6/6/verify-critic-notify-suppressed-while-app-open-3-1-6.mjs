// Batch 6 copy of audits/tools/phase3/timer/verify-critic-notify-suppressed-while-app-open-3-1.mjs. WHY A COPY: batch 6 replaced the single row timer.active with one row per timer (timer:<id>, server time, apps/hub.js
// hub.timers), and a timer now rings at 0 until Stop instead of clearing itself. The original reads or writes timer.active,
// so it measures nothing on the new code. A page on an installed clock holds hub.skew at 0 (_t6.mjs holdSkew), or
// the skew rule would put the timer back on the real clock after every jump. This copy writes and reads the new rows
// through ./_t6.mjs and saves under
// audits/evidence/p6/6.
//   node "audits/tools/phase6/6/verify-critic-notify-suppressed-while-app-open-3-1-6.mjs"
// Skeptic #1 for critic-notify-suppressed-while-app-open-3: does the shell's "Timer done" local notification fire at 0
// when the Timer app is open (page hidden, and page visible), versus the Timer app closed (on Home, page hidden)?
// Independent of the investigator's _util.mjs: own notification stub (permission 'granted' + fake SW registration that
// records showNotification) and own hub.toast spy. Chromium, typical seed, real server clock, controllable browser clock.
// "Hidden": first try a real second tab brought to front; if the shell still reports 'visible' (headless), force
// document.hidden/visibilityState in every frame and dispatch visibilitychange. The shell's finish path (index.html:804-811)
// never reads visibility, so this only makes the scenario realistic.
// Run: node "audits/tools/phase6/6/verify-critic-notify-suppressed-while-app-open-3-1-6.mjs"
// Output: audits/evidence/p3/timer/verify-critic-notify-suppressed-while-app-open-3-1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { clearTimers, timerRows, holdSkew, closeRig, watchdog } from './_t6.mjs';
watchdog();   // batch 6 final run 3: a script that never exits is cut off and says so
const OUT = path.join(ROOT, 'audits', 'evidence', 'p6', '6', 'verify-critic-notify-suppressed-while-app-open-3-1-6.json');
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const stub = () => {
  try { const R = window.AudioContext; if (R) window.AudioContext = class extends R { createOscillator(...a) { window.__beeps = (window.__beeps || 0) + 1; return super.createOscillator(...a); } }; } catch {}
  const log = window.__v = { notes: [], toasts: [] };
  try {
    if (!('Notification' in window)) window.Notification = function () {};
    Object.defineProperty(window.Notification, 'permission', { get: () => 'granted', configurable: true });
    const reg = { showNotification: (t, o) => { log.notes.push({ t, body: o && o.body }); return Promise.resolve(); } };
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = () => Promise.resolve(reg);
    else Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: () => Promise.resolve(reg), register: () => Promise.reject(new Error('rig')) }, configurable: true });
  } catch (e) { log.err = String(e); }
};
const clearTimer = () => clearTimers(L, 'eli');
async function hide(d) {
  const other = await d.ctx.newPage(); await other.goto('about:blank'); await other.bringToFront();
  let vis = await d.page.evaluate(() => document.visibilityState);
  let method = 'real second tab';
  if (vis !== 'hidden') {
    method = 'forced document.hidden';
    for (const fr of d.page.frames()) await fr.evaluate(() => {
      Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }).catch(() => {});
    vis = await d.page.evaluate(() => document.visibilityState);
  }
  return { method, shellVisibility: vis };
}
async function run(name, { appOpenAtEnd, hidden }) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() });
  await d.ctx.addInitScript(stub); await holdSkew(d.ctx);
  await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile);
  await d.page.evaluate(() => { const t = hub.toast; hub.toast = (m, ...r) => { window.__v.toasts.push(m); return t.call(hub, m, ...r); }; });
  await d.ctx.clock.runFor(800);
  const f = await d.openApp('timer', { wait: '#go' }); await f.waitForFunction(() => window.hub && hub.profile);
  await d.ctx.clock.runFor(700);
  await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1500);
  const started = await timerRows(L, 'eli').then(r => r[0]);
  if (!appOpenAtEnd) { await d.page.click('#pill-home'); await d.ctx.clock.runFor(600); await d.page.click('.tab[data-tab="home"]'); await d.ctx.clock.runFor(600); }
  const openAppId = await d.page.evaluate(() => { const v = document.querySelector('iframe'); return v && !v.closest('[hidden]') ? (v.getAttribute('src') || '').replace(/.*apps\/|\.html.*/g, '') : null; });
  const vis = hidden ? await hide(d) : { method: 'visible', shellVisibility: await d.page.evaluate(() => document.visibilityState) };
  const samples = [];                                // app display every 2 s through 0 (1-min timer); 'n/a' once the frame is gone
  for (let i = 0; i < 31; i++) { await d.ctx.clock.runFor(2000); await sleep(30);
    samples.push(await f.evaluate(() => document.getElementById('t').textContent + (document.body.classList.contains('done') ? ' done' : '') + ' osc:' + (window.__beeps || 0)).catch(() => 'n/a')); }
  const res = await d.page.evaluate(() => ({ notes: window.__v.notes, toasts: window.__v.toasts, pill: document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent }));
  const app = await f.evaluate(() => ({ t: document.getElementById('t').textContent, done: document.body.classList.contains('done'), notesInFrame: window.__v ? window.__v.notes.length : null })).catch(e => ({ err: String(e).slice(0, 100) }));
  const server = await timerRows(L, 'eli').then(r => r[0]);
  out[name] = { appOpenAtEnd, appSamples2s: samples.join(' | '), openAppIdBeforeEnd: openAppId, visibility: vis, startedRow: started && started.value, shellNotifications: res.notes, shellToasts: res.toasts, pillAfter: res.pill, appAfter: app, serverAfter: server ? server.value : 'absent' };
  console.log(name, JSON.stringify(out[name]));
  await d.close(); await clearTimer();
}
try {
  await run('A_appOpen_hidden', { appOpenAtEnd: true, hidden: true });
  await run('B_appClosedOnHome_hidden', { appOpenAtEnd: false, hidden: true });
  await run('C_appOpen_visible', { appOpenAtEnd: true, hidden: false });
} catch (e) { out.error = String(e).slice(0, 400); console.log('ERROR', out.error); }
finally { await closeRig(L); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('saved', path.relative(ROOT, OUT));
process.exit(process.exitCode || 0);   // nothing left open keeps the script alive (batch 6 final run 3)
