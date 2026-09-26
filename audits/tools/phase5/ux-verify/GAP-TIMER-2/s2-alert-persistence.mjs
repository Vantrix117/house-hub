// Skeptic s2, GAP-TIMER-2 (+ GAP-TIMER-3 DOM inventory): how long does the Timer's alert last, does it repeat, and what stays
// on screen afterwards, on the Kitchen iPad (ipad-landscape), app open (A) and app closed on Home (B). Local rig only
// (Chromium for a real AudioContext; controllable browser clock). Also records the Timer's controls (C) for GAP-TIMER-3.
// Run: node "audits/tools/phase5/ux-verify/GAP-TIMER-2/s2-alert-persistence.mjs"
// Output: audits/evidence/p5/ux-verify/GAP-TIMER-2/s2/alert.json (+ screenshots), audits/evidence/p5/ux-verify/GAP-TIMER-3/s2/controls.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT2 = path.join(ROOT, 'audits/evidence/p5/ux-verify/GAP-TIMER-2/s2');
const OUT3 = path.join(ROOT, 'audits/evidence/p5/ux-verify/GAP-TIMER-3/s2');
fs.mkdirSync(OUT2, { recursive: true }); fs.mkdirSync(OUT3, { recursive: true });
const out = {}, ctl = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
async function probes(ctx) {
  await ctx.addInitScript(() => {
    const log = window.__a = { made: 0, starts: [] };
    const Real = window.AudioContext || window.webkitAudioContext; if (!Real) return;
    class P extends Real { constructor(...a) { super(...a); log.made++; const o = this.createOscillator; this.createOscillator = (...x) => { const n = o.apply(this, x); const s = n.start.bind(n);
      n.start = (w) => { log.starts.push({ at: Date.now(), offset: +(w - this.currentTime).toFixed(3), hz: n.frequency.value }); return s(w); }; return n; }; } }
    window.AudioContext = P; window.webkitAudioContext = P;
    const nl = window.__n = [];
    try { Object.defineProperty(window.Notification, 'permission', { get: () => 'granted', configurable: true });
      const reg = { showNotification: (t, o) => { nl.push({ t, body: o && o.body }); return Promise.resolve(); } };
      navigator.serviceWorker.getRegistration = () => Promise.resolve(reg); } catch {}
  });
}
const toast = p => p.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
const shell = p => p.evaluate(() => ({ pill: document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent, audio: window.__a, notify: window.__n }));
const app = f => f.evaluate(() => ({ time: document.getElementById('t').textContent, done: document.body.classList.contains('done'), audio: window.__a }));
async function fresh() {
  const d = await L.device({ device: 'ipad-landscape', profile: 'eli', installClock: Date.now() });
  await probes(d.ctx); await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await d.ctx.clock.runFor(800); return d;
}
async function openTimer(d) {
  await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]');
  let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go') && window.__a); await d.ctx.clock.runFor(700); return f;
}
async function clear() { await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: null, updated_at: Date.now() + 1 }] } }); }
try {
  // A — app open at 0; then 3 minutes more
  { const d = await fresh(); const f = await openTimer(d);
    ctl.presets = await f.evaluate(() => [...document.querySelectorAll('[data-s]')].map(b => ({ label: b.textContent, s: +b.dataset.s })));
    ctl.inputs = await f.evaluate(() => document.querySelectorAll('input, select, textarea, [contenteditable]').length);
    ctl.buttons = await f.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim()));
    await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(59000);
    const t0 = Date.now(); await d.ctx.clock.runFor(3000);
    out.A = { atEnd: await app(f), toast: await toast(d.page), shell: await shell(d.page) };
    await d.ctx.clock.runFor(180000);
    out.A.threeMinLater = { app: await app(f), toast: await toast(d.page) };
    await d.page.screenshot({ path: path.join(OUT2, 'A-app-open-3min-after-ipad.png'), animations: 'disabled' });
    // pause trick for 12 min: 15 min, pause after 3 min, then Start resumes from 12:00?
    await f.click('[data-s="900"]'); await f.click('#go'); await d.ctx.clock.runFor(180000); await f.click('#go');
    const paused = await f.evaluate(() => document.getElementById('t').textContent); await f.click('#go'); await d.ctx.clock.runFor(1200);
    ctl.pauseTrick = { afterPause: paused, resumedShows: await f.evaluate(() => document.getElementById('t').textContent) };
    await f.click('#reset'); await d.ctx.clock.runFor(500);
    await d.ctx.close(); await clear(); }
  // B — app closed on Home at 0: toast lifetime, pill, what remains
  { const d = await fresh(); const f = await openTimer(d);
    await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1000);
    await d.page.click('#pill-home'); await d.ctx.clock.runFor(600); await d.page.click('.tab[data-tab="home"]');
    // step to 0 then sample the toast every 500 ms
    await d.ctx.clock.runFor(58000); const samples = [];
    for (let i = 0; i < 16; i++) { samples.push({ ms: i * 500, toast: await toast(d.page), pill: (await shell(d.page)).pill }); await d.ctx.clock.runFor(500); }
    out.B = { samples, shell: await shell(d.page) };
    await d.ctx.clock.runFor(180000); out.B.threeMinLater = { toast: await toast(d.page), shell: await shell(d.page) };
    await d.page.screenshot({ path: path.join(OUT2, 'B-home-3min-after-ipad.png'), animations: 'disabled' });
    await d.ctx.close(); await clear(); }
} catch (e) { out.error = String(e.stack || e).slice(0, 600); }
finally { await L.close(); }
fs.writeFileSync(path.join(OUT2, 'alert.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT3, 'controls.json'), JSON.stringify(ctl, null, 1));
console.log(JSON.stringify({ out, ctl }, null, 1).slice(0, 6000));
