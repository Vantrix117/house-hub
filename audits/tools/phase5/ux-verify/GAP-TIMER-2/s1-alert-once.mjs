// Skeptic s1, GAP-TIMER-2: does the finish alert ever repeat, how long does it sound, and what stays on screen?
// Chromium (real AudioContext), typical seed, real server clock, controllable browser clock. Records every oscillator's
// scheduled start/stop (in AudioContext seconds) in the app frame and the shell, and the visible state afterwards.
// Case A: Timer app open and visible at 0. Case B: app closed, Home visible at 0 (shell beep + toast).
// Run: node "audits/tools/phase5/ux-verify/GAP-TIMER-2/s1-alert-once.mjs"
// Output: audits/evidence/p5/ux-verify/GAP-TIMER-2/s1/alert-once.json (+ two screenshots)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p5', 'ux-verify', 'GAP-TIMER-2', 's1');
fs.mkdirSync(OUT, { recursive: true });
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const probe = ctx => ctx.addInitScript(() => {
  const log = window.__a = { made: 0, osc: [] };
  const Real = window.AudioContext || window.webkitAudioContext; if (!Real) { log.none = true; return; }
  class P extends Real { constructor(...a) { super(...a); log.made++; const co = this.createOscillator.bind(this);
    this.createOscillator = () => { const o = co(); const rec = { freq: null }; log.osc.push(rec);
      const s = o.start.bind(o), st = o.stop.bind(o);
      o.start = w => { rec.start = +(w - this.currentTime).toFixed(3); rec.freq = o.frequency.value; rec.wall = Date.now(); return s(w); };
      o.stop = w => { rec.stop = +(w - this.currentTime).toFixed(3); return st(w); }; return o; }; } }
  window.AudioContext = P; window.webkitAudioContext = P;
});
const state = f => f.evaluate(() => ({ time: document.getElementById('t').textContent, done: document.body.classList.contains('done'),
  go: document.getElementById('go').textContent, anim: getComputedStyle(document.getElementById('t')).animationName,
  audio: window.__a && { made: window.__a.made, osc: window.__a.osc.length, notes: window.__a.osc } }));
const shell = p => p.evaluate(() => { const t = document.getElementById('hub-toast');
  return { toast: t && !t.hidden ? t.textContent : null, audio: window.__a && { made: window.__a.made, osc: window.__a.osc.length, notes: window.__a.osc } }; });
async function reset() { await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: null, updated_at: Date.now() + 1 }] } }); }
async function fresh() {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() });
  await probe(d.ctx); await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await d.ctx.clock.runFor(800);
  await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]');
  let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go') && window.__a); await d.ctx.clock.runFor(700);
  return { d, f };
}
try {
  { const { d, f } = await fresh();                 // A — app open at 0
    await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(2000); const at2s = await state(f);
    await d.ctx.clock.runFor(20000); const at22s = await state(f);
    out.A_start = { at2s, at22s };
    if (!/^0:[34]/.test(at22s.time)) {           // the start did not hold: tap Start again once and record it
      await f.click('#go'); await d.ctx.clock.runFor(2000); out.A_start.afterRetap = await state(f); await d.ctx.clock.runFor(20000); }
    out.A_trace = [];
    for (let i = 0; i < 40; i++) { await d.ctx.clock.runFor(1000);
      const s = await state(f).catch(e => ({ err: String(e).slice(0, 80) }));
      const doc = await f.evaluate(() => performance.timeOrigin).catch(() => null);
      out.A_trace.push({ t: 23 + i, time: s.time, done: s.done, go: s.go, made: s.audio && s.audio.made, doc, url: f.url().split('/').pop() }); }
    const atEnd = await state(f); await d.ctx.clock.runFor(1500); const plus1_5s = await state(f);
    await d.ctx.clock.runFor(180000); const plus3min = await state(f);
    const shotA = path.join(OUT, 'A-app-3min-after-end-ipad.png'); await d.page.screenshot({ path: shotA, scale: 'css', animations: 'disabled' });
    out.A = { atEnd, plus1_5s, plus3min, shell3min: await shell(d.page), shot: rel(shotA) };
    await d.close(); await reset(); }
  { const { d, f } = await fresh();                 // B — app closed, Home at 0
    await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1000);
    await d.page.click('#pill-home'); await d.ctx.clock.runFor(600); await d.page.click('.tab[data-tab="home"]');
    await d.ctx.clock.runFor(60000); const atEnd = await shell(d.page);
    await d.ctx.clock.runFor(3500); const plus3_5s = await shell(d.page);
    await d.ctx.clock.runFor(1000); const plus4_5s = await shell(d.page);
    await d.ctx.clock.runFor(180000); const plus3min = await shell(d.page);
    const shotB = path.join(OUT, 'B-home-3min-after-end-ipad.png'); await d.page.screenshot({ path: shotB, scale: 'css', animations: 'disabled' });
    out.B = { atEnd, plus3_5s, plus4_5s, plus3min, shot: rel(shotB) };
    await d.close(); await reset(); }
} catch (e) { out.error = String(e).slice(0, 400); } finally { await L.close(); }
const f = path.join(OUT, 'alert-once.json'); fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1)); console.log('saved', rel(f));
