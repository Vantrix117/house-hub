// Skeptic #2 for critic-notify-suppressed-while-app-open-3: is the "Timer done" notification lost only because the Timer
// app is open, or is the original B2/B4 comparison confounded (B2 fast-forwarded 3 min while hidden, so the end was
// already > 60 s old when the shell's tick next ran, and B4 was visible)? Like-for-like here: desktop, Chromium, a 1-min
// timer, the page emulated hidden through the end and timers left running at their normal rate (clock.runFor in 1 s steps
// with a real-time yield, as a hidden desktop Chrome tab ticks at 1 Hz), to ~4 s past 0. Only the open app differs:
//   A — Timer app open (the state right after Start), page hidden
//   C — Timer app closed (back on Home, pill showing), page hidden
//   V — Timer app open, page visible (control for the app's own finish)
// Notifications counted via a stubbed 'granted' permission + fake SW registration; beeps via an AudioContext probe
// (both from _util.mjs, init scripts in every frame). All taps go through the real UI.
// Run: node "audits/tools/phase3/timer/verify-critic-notify-suppressed-while-app-open-3-2.mjs"
// Output: audits/evidence/p3/timer/verify-critic-notify-suppressed-while-app-open-3-2.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { audioProbe, notifyProbe } from './_util.mjs';
const NAME = 'verify-critic-notify-suppressed-while-app-open-3-2';
const EVD = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer');
const out = { engine: 'chromium', device: 'desktop', timer: '1:00', method: 'hidden = document.hidden/visibilityState forced + visibilitychange in every frame; clock.runFor(1000) x64 with 60 ms real yields (timers keep firing, as in a hidden desktop tab)' };
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const setHidden = async (page, hidden) => {
  for (const fr of page.frames()) await fr.evaluate(h => {
    Object.defineProperty(document, 'hidden', { get: () => h, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => (h ? 'hidden' : 'visible'), configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden).catch(() => {});
};
const reset = () => L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: null, updated_at: Date.now() + 1 }] } });
const probe = async (d, f) => {
  const shell = await d.page.evaluate(() => ({ notify: window.__notify ? window.__notify.shown : null, beeps: window.__audio ? window.__audio.osc / 3 : null,
    toast: (t => t && !t.hidden ? t.textContent : null)(document.getElementById('hub-toast')), pill: document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent,
    hidden: document.hidden, openApp: (document.querySelector('.viewer iframe, iframe') || {}).src || null }));
  const app = f ? await f.evaluate(() => ({ notify: window.__notify ? window.__notify.shown : null, beeps: window.__audio ? window.__audio.osc / 3 : null,
    time: document.getElementById('t').textContent, done: document.body.classList.contains('done'), hidden: document.hidden })).catch(e => ({ error: String(e).slice(0, 120) })) : null;
  return { shell, app };
};
async function run(label, { appOpen, hidden }) {
  const d = await L.device({ device: 'desktop', profile: 'eli', installClock: Date.now() });
  await audioProbe(d.ctx); await notifyProbe(d.ctx);
  await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await d.ctx.clock.runFor(800);
  await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]');
  let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go') && window.__audio);
  await d.ctx.clock.runFor(700);
  await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1000);
  if (!appOpen) { await d.page.click('#pill-home'); await d.ctx.clock.runFor(600); await d.page.click('.tab[data-tab="home"]'); await d.ctx.clock.runFor(600); f = null; }
  const before = await probe(d, f);
  if (hidden) await setHidden(d.page, true);
  for (let s = 0; s < 64; s++) { await d.ctx.clock.runFor(1000); await sleep(60); }   // through 0 and ~4 s past it in 1 s steps, yielding real time so fetches and storage events land
  const atEnd = await probe(d, f);
  out[label] = { appOpen, hidden, before: { pill: before.shell.pill, appTime: before.app && before.app.time }, atEndWhileHidden: atEnd,
    notifications: (atEnd.shell.notify || []).length + ((atEnd.app && atEnd.app.notify) || []).length,
    beeps: (atEnd.shell.beeps || 0) + ((atEnd.app && atEnd.app.beeps) || 0) };
  if (hidden) await setHidden(d.page, false);
  await d.close(); await reset();
}
try {
  await run('A_appOpen_hidden', { appOpen: true, hidden: true });
  await run('C_appClosed_hidden', { appOpen: false, hidden: true });
  await run('V_appOpen_visible', { appOpen: true, hidden: false });
} catch (e) { out.error = String(e).slice(0, 400); }
finally { await L.close(); }
for (const k of ['A_appOpen_hidden', 'C_appClosed_hidden', 'V_appOpen_visible']) if (out[k])
  console.log(k, '| notifications:', out[k].notifications, JSON.stringify((out[k].atEndWhileHidden.shell.notify || []).map(n => n.title + ' / ' + n.body)),
    '| beeps shell/app:', out[k].atEndWhileHidden.shell.beeps, '/', out[k].atEndWhileHidden.app && out[k].atEndWhileHidden.app.beeps,
    '| toast:', out[k].atEndWhileHidden.shell.toast, '| app:', JSON.stringify(out[k].atEndWhileHidden.app && { t: out[k].atEndWhileHidden.app.time, done: out[k].atEndWhileHidden.app.done }));
if (out.error) console.log('ERROR', out.error);
fs.writeFileSync(path.join(EVD, NAME + '.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p3/timer/' + NAME + '.json');
