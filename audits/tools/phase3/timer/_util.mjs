// Shared helpers for the Phase 3 timer scripts. Writes only under audits/evidence/p3/timer/.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../lib/local.mjs';
export const EVD = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer');
fs.mkdirSync(EVD, { recursive: true });
export const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
/** 1x CSS-scale screenshot into the evidence folder. */
export async function shot(page, name) { const f = path.join(EVD, name); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return rel(f); }
export function save(name, obj) { const f = path.join(EVD, name); fs.writeFileSync(f, JSON.stringify(obj, null, 1)); return rel(f); }
/** Init script: count AudioContext constructions (and their state), closes, and oscillator starts, per frame; stub one if the engine has none. */
export async function audioProbe(ctx) {
  await ctx.addInitScript(() => {
    const log = window.__audio = { made: 0, closed: 0, states: [], osc: 0, stub: false };
    const Real = window.AudioContext || window.webkitAudioContext;
    if (!Real) {
      log.stub = true;
      class Fake { constructor() { log.made++; this.state = 'running'; this.currentTime = 0; this.destination = {}; log.states.push('stub'); }
        createOscillator() { return { connect() {}, frequency: {}, start() { log.osc++; }, stop() {} }; }
        createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
        close() { log.closed++; this.state = 'closed'; return Promise.resolve(); } }
      window.AudioContext = Fake; return;
    }
    class Probe extends Real { constructor(...a) { super(...a); log.made++; log.states.push(this.state); const o = this.createOscillator; this.createOscillator = (...x) => { const n = o.apply(this, x); const s = n.start.bind(n); n.start = (...y) => { log.osc++; return s(...y); }; return n; }; }
      close() { log.closed++; return super.close(); } }
    window.AudioContext = Probe; window.webkitAudioContext = Probe;
  });
}
/** Init script: record hub toasts and notifications (stubbed permission 'granted' + a fake registration) in every frame. */
export async function notifyProbe(ctx) {
  await ctx.addInitScript(() => {
    const log = window.__notify = { shown: [] };
    try {
      if (!('Notification' in window)) window.Notification = function () {};
      Object.defineProperty(window.Notification, 'permission', { get: () => 'granted', configurable: true });
      const fakeReg = { showNotification: (title, o) => { log.shown.push({ title, body: o && o.body, at: Date.now() }); return Promise.resolve(); } };
      if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = () => Promise.resolve(fakeReg);
      else Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: () => Promise.resolve(fakeReg), register: () => Promise.reject(new Error('rig')) }, configurable: true });
    } catch (e) { log.err = String(e); }
  });
}
export const toastText = page => page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
export const appState = f => f.evaluate(() => ({ time: document.getElementById('t').textContent, go: document.getElementById('go').textContent, primary: document.getElementById('go').classList.contains('btn-primary'), done: document.body.classList.contains('done'), on: [...document.querySelectorAll('[data-s].on')].map(b => b.textContent), audio: window.__audio ? { made: window.__audio.made, closed: window.__audio.closed, osc: window.__audio.osc, states: window.__audio.states, stub: window.__audio.stub } : null }));
export const pillState = page => page.evaluate(() => ({ pill: document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent, chip: document.getElementById('pill-timer').hidden ? null : document.getElementById('pill-timer-time').textContent, audio: window.__audio ? { made: window.__audio.made, osc: window.__audio.osc, states: window.__audio.states } : null, notify: window.__notify ? window.__notify.shown : null }));
export async function serverTimer(L, pid) { const r = await L.apiAs(pid, '/api/data/timer?scope=person'); const items = (r.body && r.body.items) || []; const o = {}; for (const it of items) o[it.key] = it.value; return o; }
