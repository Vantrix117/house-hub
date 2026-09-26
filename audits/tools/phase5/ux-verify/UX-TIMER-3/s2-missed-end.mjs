// Skeptic s2, UX-TIMER-3: what is left for the person when a timer ends while the only device is hidden or closed.
// Chromium (real AudioContext), typical seed, local rig, controllable browser clock (installClock). "Hidden" is emulated by
// forcing document.hidden and dispatching visibilitychange in every frame, then clock.fastForward (due timers fire at most
// once, as on a resumed page). Probes (audio/notification stubs) come from the Phase 3 timer _util (read-only helpers).
//  R1 Home, hidden through the end, back 30 s after 0     (inside the shell's 60 s window)
//  R2 Home, hidden through the end, back 2 min after 0    (outside it)
//  R3 Timer app open, whole page closed, reopened on #timer 2 min after 0
//  R4 Home visible at 0: notification fires; then what the notification's tap does (#timer, as the SW 'open' message sets it)
// Run: node "audits/tools/phase5/ux-verify/UX-TIMER-3/s2-missed-end.mjs"   Output: audits/evidence/p5/ux-verify/UX-TIMER-3/s2/missed-end.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
import { appState, pillState, audioProbe, notifyProbe, toastText } from '../../../phase3/timer/_util.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p5', 'ux-verify', 'UX-TIMER-3', 's2');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const server = async () => { const r = await L.apiAs('eli', '/api/data/timer?scope=person'); const o = {}; for (const it of (r.body && r.body.items) || []) o[it.key] = it.value; return o; };
const setHidden = async (page, h) => { for (const fr of page.frames()) await fr.evaluate(h => {
  Object.defineProperty(document, 'hidden', { get: () => h, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => (h ? 'hidden' : 'visible'), configurable: true });
  document.dispatchEvent(new Event('visibilitychange')); }, h).catch(() => {}); };
async function fresh() {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() });
  await audioProbe(d.ctx); await notifyProbe(d.ctx);
  await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await d.ctx.clock.runFor(800);
  return d;
}
async function timerFrame(d) { let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) { await d.ctx.clock.runFor(100); await sleep(50); }
  await f.waitForFunction(() => window.hub && document.getElementById('go')); await d.ctx.clock.runFor(800); return f; }
async function start1min(d) { await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]'); const f = await timerFrame(d);
  await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1000); return f; }
async function toHome(d) { await d.page.click('#pill-home'); await d.ctx.clock.runFor(600); await d.page.click('.tab[data-tab="home"]'); await d.ctx.clock.runFor(600); }
async function clear() { await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: null, updated_at: Date.now() + 1 }] } }); }
const feed = d => d.page.evaluate(() => document.getElementById('view-home') ? /timer/i.test(document.getElementById('view-home').innerText) : null);
const step = async (n, fn) => { try { await fn(); } catch (e) { out[n] = { error: String(e).slice(0, 400) }; } await clear(); };
try {
  for (const [name, back] of [['R1', '01:30'], ['R2', '03:00']]) await step(name, async () => {
    const d = await fresh(); await start1min(d); await toHome(d);
    const pillBefore = await pillState(d.page);
    await setHidden(d.page, true); await d.ctx.clock.fastForward(back);
    const whileHidden = await pillState(d.page);
    await setHidden(d.page, false); await d.ctx.clock.runFor(1200);
    out[name] = { backAfterStart: back, pillBefore: pillBefore.pill, whileHidden, back: await pillState(d.page), toast: await toastText(d.page), homeMentionsTimer: await feed(d), server: await server() };
    await d.close(); });
  await step('R3', async () => {
    const d = await fresh(); await start1min(d); await d.ctx.clock.runFor(1000);
    await d.page.goto('about:blank'); await d.ctx.clock.fastForward('03:00');
    await d.page.goto(L.site + '/index.html#timer'); await d.ctx.clock.runFor(2500);
    const f = await timerFrame(d);
    out.R3 = { reopened: await appState(f), shell: await pillState(d.page), toast: await toastText(d.page), server: await server() };
    await d.page.screenshot({ path: path.join(OUT, 'r3-reopened-after-end-iphone.png'), scale: 'css', animations: 'disabled' });
    await d.close(); });
  await step('R4', async () => {
    const d = await fresh(); await start1min(d); await toHome(d);
    await d.ctx.clock.runFor(61000);
    const atEnd = { shell: await pillState(d.page), toast: await toastText(d.page), server: await server() };
    await d.ctx.clock.runFor(5000);
    await d.page.evaluate(() => { location.hash = '#timer'; });   // what the SW 'open' message does for data.url '#timer'
    await d.ctx.clock.runFor(1500);
    const f = await timerFrame(d);
    out.R4 = { atEnd, afterNotificationTap: await appState(f) };
    await d.page.screenshot({ path: path.join(OUT, 'r4-timer-after-notification-tap-iphone.png'), scale: 'css', animations: 'disabled' });
    await d.close(); });
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'missed-end.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
