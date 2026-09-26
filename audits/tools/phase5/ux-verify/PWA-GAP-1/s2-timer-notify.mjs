// PWA-GAP-1 skeptic s2: when does the shell raise the "Timer done" notification?
// Notification permission and the service-worker registration are stubbed so every showNotification call is recorded.
// Cases: A visible on Home at 0 · B the hub comes back 90 s after 0 (as after a locked phone) · C Timer app open at 0 ·
// D permission never granted (push switch never used). WebKit, iPhone PWA, local rig only.
//   node "audits/tools/phase5/ux-verify/PWA-GAP-1/s2-timer-notify.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/PWA-GAP-1/s2');
fs.mkdirSync(OUT, { recursive: true });
const stub = perm => {
  window.__notes = []; window.__permAsked = 0;
  window.Notification = class { static get permission() { return perm; } static requestPermission() { window.__permAsked++; return Promise.resolve(perm); } };
  const reg = { showNotification: (t, o) => { window.__notes.push({ t, body: o && o.body }); return Promise.resolve(); }, pushManager: { getSubscription: async () => null } };
  try { Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: async () => reg, register: async () => reg, ready: Promise.resolve(reg), addEventListener() {}, controller: null }, configurable: true }); } catch {}
};
const T = { app: 'timer', scope: 'person' };
const setTimer = (page, endOffsetMs, total) => page.evaluate(([o, t, T]) => { const now = Date.now(); hub.set('timer.active', { endAt: now + o, total: t, startedAt: now + o - t * 1000 }, T); }, [endOffsetMs, total, T]);
const state = page => page.evaluate(T => ({ notes: window.__notes.slice(), permAsked: window.__permAsked, toast: (() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; })(), active: !!hub.get('timer.active', T) }), T);
const out = {};
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  for (const perm of ['granted', 'default']) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(stub, perm);
    const r = out[perm] = {};
    // A: on Home, visible, timer hits 0
    await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 }); await sleep(1500);
    await setTimer(d.page, 3000, 180); await sleep(5500);
    r.A_visibleHome = await state(d.page);
    // B: timer ran out 90 s ago while the hub was not running (locked phone / app switched), hub comes back
    await setTimer(d.page, -90000, 300);
    await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 }); await sleep(3000);
    r.B_back90sLate = await state(d.page);
    // C: Timer app open when it hits 0
    await d.openApp('timer'); await sleep(1500);
    await setTimer(d.page, 3000, 120); await sleep(5500);
    r.C_timerAppOpen = await state(d.page);
    if (perm === 'granted') await d.page.screenshot({ path: path.join(OUT, 'timer-app-open-after-zero-iphone-light.png'), scale: 'css', caret: 'hide' });
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'timer-notify.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
