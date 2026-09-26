// PWA-GAP-1 skeptic s1: when does "Timer done" produce a notification?
// iPhone PWA (WebKit), Eli, real clock. Notification and the service-worker registration are stubbed in the top frame
// so a showNotification call and a requestPermission call are counted. Cases:
//   A  permission granted, shell on Home when the timer ends          (control: should notify)
//   B  permission 'default' (never turned push on), shell on Home     (claim: no notification, and no prompt)
//   C  permission granted, Timer app open when it ends                (claim: shell stays silent; the app only beeps)
//   D  permission granted, hub not running at endAt, reopened 70 s later (claim: cleared silently, no alert ever)
//   node "audits/tools/phase5/ux-verify/PWA-GAP-1/s1-timer-notify.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/PWA-GAP-1/s1');
fs.mkdirSync(OUT, { recursive: true });
const stubs = perm => {
  if (window.top !== window) return;
  window.__notes = []; window.__asked = 0; window.__toasts = [];
  window.Notification = class { static get permission() { return perm; } static async requestPermission() { window.__asked++; return perm; } };
  const reg = { showNotification: async (t, o) => { window.__notes.push({ t, body: o && o.body }); }, pushManager: { getSubscription: async () => null } };
  Object.defineProperty(Navigator.prototype, 'serviceWorker', { get: () => ({ getRegistration: async () => reg, register: async () => reg, ready: Promise.resolve(reg), addEventListener() {}, controller: null }), configurable: true });
  let last = ''; setInterval(() => { const t = document.getElementById('hub-toast'); const s = t && !t.hidden ? t.textContent : ''; if (s && s !== last) window.__toasts.push(s); last = s; }, 100);
};
const ready = d => d.page.waitForFunction(() => window.hub && hub.profile && !document.getElementById('shell').hidden, null, { timeout: 20000 });
const setTimer = (d, endOffset, total = 60) => d.page.evaluate(([o, t]) => { const now = Date.now(); hub.set('timer.active', { endAt: now + o, total: t, startedAt: now + o - t * 1000 }, { app: 'timer', scope: 'person' }); }, [endOffset, total]);
const counters = d => d.page.evaluate(() => ({ notifications: window.__notes, permissionPrompts: window.__asked, toasts: window.__toasts, timerRow: hub.get('timer.active', { app: 'timer', scope: 'person' }) || null }));
const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  for (const [name, perm, appOpen] of [['A-granted-home', 'granted', false], ['B-default-home', 'default', false], ['C-granted-timer-app-open', 'granted', true]]) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(stubs, perm);
    if (appOpen) await d.openApp('timer', { wait: '#go' }); else await d.goto('#home');
    await ready(d);
    await setTimer(d, 4000, 4);
    await sleep(7000);
    out[name] = await counters(d);
    await d.close();
  }
  // D: the timer ran out while the hub was not running; the hub opens 70 s after endAt
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(stubs, 'granted');
    await d.goto('#home'); await ready(d);
    await d.page.evaluate(() => { hub.set('timer.active', { endAt: Date.now() - 70000, total: 300, startedAt: Date.now() - 370000 }, { app: 'timer', scope: 'person' }); });
    await d.page.goto('about:blank'); await sleep(500);   // the hub is closed; the row is in the cache (and flushed or queued)
    await d.goto('#home'); await ready(d); await sleep(3000);
    out['D-closed-reopened-70s-late'] = await counters(d);
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'timer-notify.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
