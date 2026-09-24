// Skeptic 2 for "beep-silent-on-ios": WHEN and FROM WHAT is the finish beep's AudioContext created, and is it ever resumed?
// Real clock (no fake timers, so transient user activation expires as on a device). Chromium has a real AudioContext;
// WebKit on Windows has none (probed). Each AudioContext construction records: frame, transient activation
// (navigator.userActivation.isActive — iOS WebKit's gate for starting Web Audio is a gesture being processed), sticky
// activation, the context state right after construction and 50 ms later, and whether resume() was ever called.
// Run: node "audits/tools/phase3/timer/verify-beep-silent-on-ios-2.mjs"  (~2.5 min)
// Output: audits/evidence/p3/timer/verify-beep-silent-on-ios-2.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer', 'verify-beep-silent-on-ios-2.json');
const out = { webkit: {}, chromium: {} };
const probe = () => {
  const log = window.__ac = { made: [], resumeCalls: 0, clicks: [] };
  document.addEventListener('click', e => log.clicks.push({ t: Date.now(), target: (e.target.id || e.target.textContent || '').slice(0, 20), madeSoFar: log.made.length }), true);
  const Real = window.AudioContext || window.webkitAudioContext;
  if (!Real) { log.none = true; return; }
  class P extends Real {
    constructor(...a) { super(...a); const ua = navigator.userActivation || {};
      const rec = { t: Date.now(), frame: location.pathname, transient: ua.isActive, sticky: ua.hasBeenActive, state0: this.state, stack: (new Error().stack || '').split('\n').slice(2, 5).map(s => s.trim()).join(' | ').slice(0, 300) };
      log.made.push(rec); setTimeout(() => { rec.state50ms = this.state; }, 50); }
    resume() { log.resumeCalls++; return super.resume(); }
  }
  window.AudioContext = P; window.webkitAudioContext = P;
};
async function reset(L) { await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: null, updated_at: Date.now() + 1 }] } }).catch(() => {}); }
async function openTimer(d) {
  await d.page.click('.tab[data-tab="apps"]'); await d.page.click('.tile[data-id="timer"]');
  let f; for (let i = 0; i < 80 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go') && window.__ac); await sleep(600); return f;
}
// 1. WebKit: does the rig's engine even have Web Audio?
{
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  try { const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false }); await d.goto('#home');
    out.webkit = await d.page.evaluate(() => ({ AudioContext: typeof window.AudioContext, webkitAudioContext: typeof window.webkitAudioContext, userActivation: typeof navigator.userActivation, audioSession: typeof navigator.audioSession }));
  } finally { await L.close(); }
}
// 2. Chromium: A = app open at 0; B = app closed (Home) at 0 -> shell beep
{
  const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
  try {
    for (const scen of ['A_appOpen', 'B_shellHome']) {
      await reset(L);
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
      await d.ctx.addInitScript(probe);
      await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await sleep(800);
      const f = await openTimer(d);
      await f.click('[data-s="60"]'); await f.click('#go'); const startedAt = Date.now();
      const afterStart = await f.evaluate(() => ({ made: window.__ac.made.length, resumeCalls: window.__ac.resumeCalls, clicks: window.__ac.clicks }));
      if (scen === 'B_shellHome') { await d.page.click('#pill-home'); await sleep(500); await d.page.click('.tab[data-tab="home"]'); }
      await sleep(Math.max(0, startedAt + 63000 - Date.now()));
      const app = await f.evaluate(() => ({ made: window.__ac.made, resumeCalls: window.__ac.resumeCalls, clock: document.getElementById('t').textContent, done: document.body.classList.contains('done') })).catch(e => ({ err: String(e).slice(0, 100) }));
      const shell = await d.page.evaluate(() => ({ made: window.__ac.made, resumeCalls: window.__ac.resumeCalls, toast: (document.getElementById('hub-toast') || {}).textContent || null }));
      out.chromium[scen] = { afterStartTap_appFrame: afterStart, atZero_appFrame: app, atZero_shell: shell, msFromStartTapToContext: (app.made && app.made[0] ? app.made[0].t : shell.made[0] ? shell.made[0].t : NaN) - startedAt };
      await d.close();
    }
  } finally { await reset(L); await L.close(); }
}
// 3. Static: any resume()/unlock/audioSession in the two beep owners?
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
out.static = {};
for (const f of ['apps/timer.html', 'index.html']) out.static[f] = src(f).map((l, i) => [i + 1, l]).filter(([, l]) => /AudioContext|\.resume\(|audioSession|new Audio\(|<audio/.test(l)).map(([n, l]) => n + ': ' + l.trim().slice(0, 120));
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
