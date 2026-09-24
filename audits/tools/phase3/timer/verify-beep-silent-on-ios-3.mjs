// Skeptic 3 (tie-break) for "beep-silent-on-ios". Independent, minimal reproduction:
//  1. WebKit (the rig's engine): does it expose Web Audio / audioSession at all?
//  2. Chromium, real clock, Timer app open in the shell viewer: tap "1 min", tap Start, wait 61 s of real time
//     (no page.evaluate between the tap and 0, so no rig-granted activation lands in that window except the reads
//     right after Start). Every AudioContext construction and resume() call is logged in every frame with
//     navigator.userActivation.isActive (a gesture being processed — what iOS WebKit's Web Audio start gate looks for).
//  3. Static: every audio-related line in timer.html, index.html, hub.js.
// Run: node "audits/tools/phase3/timer/verify-beep-silent-on-ios-3.mjs"   (~1.5 min)
// Output: audits/evidence/p3/timer/verify-beep-silent-on-ios-3.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer', 'verify-beep-silent-on-ios-3.json');
const out = {};
const probe = () => {
  const log = window.__ac3 = { made: [], resume: 0 };
  const R = window.AudioContext || window.webkitAudioContext; if (!R) { log.none = true; return; }
  class P extends R {
    constructor(...a) { super(...a); const ua = navigator.userActivation || {};
      log.made.push({ t: Date.now(), where: location.pathname, transient: ua.isActive, state: this.state,
        stack: (new Error().stack || '').split('\n').slice(2, 4).map(s => s.trim()).join(' | ').slice(0, 200) }); }
    resume() { log.resume++; return super.resume(); }
  }
  window.AudioContext = P; window.webkitAudioContext = P;
};
const clear = L => L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: null, updated_at: Date.now() + 1 }] } }).catch(() => {});
{ // 1
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  try { const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false }); await d.goto('#home');
    out.webkit = await d.page.evaluate(() => ({ AudioContext: typeof window.AudioContext, webkitAudioContext: typeof window.webkitAudioContext, audioSession: typeof navigator.audioSession, ua: navigator.userAgent.slice(0, 120) }));
  } finally { await L.close(); }
}
{ // 2
  const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
  try {
    await clear(L);
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(probe);
    await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await sleep(800);
    const f = await d.openApp('timer'); await f.waitForFunction(() => document.getElementById('go') && window.__ac3);
    await f.click('[data-s="60"]'); await f.click('#go'); const tap = Date.now();
    out.afterStart = { app: await f.evaluate(() => ({ made: window.__ac3.made.length, resume: window.__ac3.resume, btn: document.getElementById('go').textContent })),
                       shell: await d.page.evaluate(() => window.__ac3.made.length) };
    await sleep(Math.max(0, tap + 61500 - Date.now()));
    const app = await f.evaluate(() => ({ made: window.__ac3.made, resume: window.__ac3.resume, clock: document.getElementById('t').textContent, done: document.body.classList.contains('done') }));
    const shell = await d.page.evaluate(() => ({ made: window.__ac3.made, resume: window.__ac3.resume }));
    out.atZero = { app, shell, msTapToContext: app.made[0] ? app.made[0].t - tap : null };
    await d.shot(path.join(ROOT, 'audits', 'evidence', 'p3', 'timer', 'verify-beep-silent-on-ios-3-at-zero-ipad.png'));
    await d.close();
  } finally { await clear(L); await L.close(); }
}
{ // 3
  out.static = {};
  for (const f of ['apps/timer.html', 'index.html', 'apps/hub.js']) out.static[f] = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')
    .map((l, i) => [i + 1, l]).filter(([, l]) => /AudioContext|\.resume\(\)|audioSession|new Audio\(|<audio|\.play\(\)/.test(l)).map(([n, l]) => n + ': ' + l.trim().slice(0, 110));
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
