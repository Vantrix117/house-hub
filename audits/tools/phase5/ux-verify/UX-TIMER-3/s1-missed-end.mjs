// Skeptic s1, UX-TIMER-3: a timer that ends while the only device is suspended or closed — what is left on return?
// WebKit (iPhone PWA, Eli), typical seed, real server clock, a controllable browser clock (installClock).
// Suspension is modelled differently from the investigator's B5: document.hidden forced true, then clock.setSystemTime jumps the
// wall clock WITHOUT firing any due timer (as iOS does for a suspended page), then visible again + visibilitychange.
// Beeps counted by an AudioContext probe (stub in WebKit), notifications by a stubbed 'granted' permission + fake registration
// (probes imported read-only from audits/tools/phase3/timer/_util.mjs).
// Run: node "audits/tools/phase5/ux-verify/UX-TIMER-3/s1-missed-end.mjs"  Output: audits/evidence/p5/ux-verify/UX-TIMER-3/s1/
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
import { audioProbe, notifyProbe } from '../../../phase3/timer/_util.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-TIMER-3/s1'); fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const setHidden = async (page, hidden) => { for (const fr of page.frames()) await fr.evaluate(h => {
  Object.defineProperty(document, 'hidden', { get: () => h, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => (h ? 'hidden' : 'visible'), configurable: true });
  document.dispatchEvent(new Event('visibilitychange')); }, hidden).catch(() => {}); };
const app = f => f.evaluate(() => ({ time: t.textContent, go: go.textContent, done: document.body.classList.contains('done'), text: document.body.innerText.replace(/\s+/g, ' ').trim(), osc: window.__audio && window.__audio.osc }));
const shell = p => p.evaluate(() => ({ pill: document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent,
  toast: (() => { const x = document.getElementById('hub-toast'); return x && !x.hidden ? x.textContent : null; })(), osc: window.__audio && window.__audio.osc, notify: window.__notify && window.__notify.shown.map(n => n.title + ' / ' + n.body) }));
const server = async () => { const r = await L.apiAs('eli', '/api/data/timer?scope=person'); const o = {}; for (const it of (r.body && r.body.items) || []) o[it.key] = it.value; return o; };
const reset = () => L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: null, updated_at: Date.now() + 1 }] } });
let T0;
async function fresh() {
  T0 = Date.now();
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: T0 });
  await audioProbe(d.ctx); await notifyProbe(d.ctx);
  await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await d.ctx.clock.runFor(800);
  return d;
}
async function startOneMin(d) {
  await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]');
  let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go') && window.__audio); await d.ctx.clock.runFor(700);
  await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1000);
  const endAt = await f.evaluate(() => hub.get('timer.active').endAt);
  return { f, endAt };
}
async function toHome(d) { await d.page.click('#pill-home'); await d.ctx.clock.runFor(600); await d.page.click('.tab[data-tab="home"]'); await d.ctx.clock.runFor(600); }
async function suspendUntil(d, at) { await setHidden(d.page, true); await d.ctx.clock.setSystemTime(at); await setHidden(d.page, false); await d.ctx.clock.runFor(1500); await sleep(800); await d.ctx.clock.runFor(1000); }
const step = async (name, fn) => { try { await fn(); } catch (e) { out[name] = { error: String(e).slice(0, 400) }; } };
try {
  // S1: Timer closed (Home), phone suspended through the end, back 2 min after 0
  await step('S1_home_back2min', async () => { const d = await fresh(); const { endAt } = await startOneMin(d); await toHome(d);
    const before = await shell(d.page);
    await suspendUntil(d, endAt + 120000);
    out.S1_home_back2min = { before, back: await shell(d.page), server: await server() };
    await d.shot(path.join(OUT, 's1-home-back-2min-iphone.png'));
    // open the Timer now
    await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]'); await sleep(600);
    const f2 = d.frame('timer'); await f2.waitForFunction(() => window.hub && document.getElementById('go')); await d.ctx.clock.runFor(800);
    out.S1_home_back2min.timerOpened = await app(f2);
    await d.close(); await reset(); });
  // S2: same, back 30 s after 0 (inside the 60 s window) — then "tap the notification" (the SW posts {open '#timer'} → location.hash)
  await step('S2_home_back30s', async () => { const d = await fresh(); const { endAt } = await startOneMin(d); await toHome(d);
    await suspendUntil(d, endAt + 30000);
    out.S2_home_back30s = { back: await shell(d.page), server: await server() };
    await d.page.evaluate(() => { location.hash = '#timer'; }); await sleep(600);
    let f2; for (let i = 0; i < 40 && !(f2 = d.frame('timer')); i++) await sleep(100);
    await f2.waitForFunction(() => window.hub && document.getElementById('go')); await d.ctx.clock.runFor(800);
    out.S2_home_back30s.afterNotificationTap = await app(f2);
    await d.shot(path.join(OUT, 's2-after-notification-tap-iphone.png'));
    await d.close(); await reset(); });
  // S3: Timer open, suspended through the end, back 2 min after 0
  await step('S3_appOpen_back2min', async () => { const d = await fresh(); const { f, endAt } = await startOneMin(d);
    const oscBefore = (await app(f)).osc;
    await suspendUntil(d, endAt + 120000);
    out.S3_appOpen_back2min = { oscBefore, app: await app(f), shell: await shell(d.page), server: await server() };
    await d.close(); await reset(); });
  // S4: whole page closed with the Timer open, reopened on #timer 2 min after 0
  await step('S4_closed_reopen2min', async () => { const d = await fresh(); const { endAt } = await startOneMin(d);
    await d.page.goto('about:blank'); await d.ctx.clock.setSystemTime(endAt + 120000);
    await d.page.goto(L.site + '/index.html#timer'); await d.ctx.clock.runFor(2500);
    let f2; for (let i = 0; i < 40 && !(f2 = d.frame('timer')); i++) { await d.ctx.clock.runFor(100); await sleep(50); }
    await f2.waitForFunction(() => window.hub && document.getElementById('go')); await d.ctx.clock.runFor(1500);
    out.S4_closed_reopen2min = { app: await app(f2), shell: await shell(d.page), server: await server() };
    await d.shot(path.join(OUT, 's4-reopened-iphone.png'));
    await d.close(); await reset(); });
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
