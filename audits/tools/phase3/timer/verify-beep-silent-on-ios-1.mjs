// Skeptic #1 for finding "beep-silent-on-ios". Independent reproduction on the local rig.
// 1) WebKit (the rig's iOS stand-in): does it even expose AudioContext?  2) Chromium: tap 1 min -> Start in the Timer app
// on the phone, wait for 0; a second device (iPad, same profile, no tap at all on it) sees the same timer via pull and
// its shell beeps at 0. Every AudioContext construction is logged per frame with the frame URL, the state at construction,
// the state 400 ms later, whether the frame had sticky/transient user activation at that moment, and a stack hint.
// Also a control page with no gesture. Writes audits/evidence/p3/timer/verify-beep-silent-on-ios-1.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer', 'verify-beep-silent-on-ios-1.json');
const probe = () => {
  const log = window.__ac = [];
  const Real = window.AudioContext || window.webkitAudioContext;
  window.__acAvail = { AudioContext: typeof window.AudioContext, webkitAudioContext: typeof window.webkitAudioContext };
  if (!Real) return;
  class P extends Real {
    constructor(...a) {
      super(...a);
      const e = { at: Date.now(), url: location.pathname + location.hash, state0: this.state,
        sticky: navigator.userActivation ? navigator.userActivation.hasBeenActive : null,
        transient: navigator.userActivation ? navigator.userActivation.isActive : null,
        stack: (new Error().stack || '').split('\n').slice(2, 5).map(s => s.trim()).join(' | ') };
      log.push(e); setTimeout(() => { e.state400 = this.state; }, 400);
    }
  }
  window.AudioContext = P; window.webkitAudioContext = P;
};
const frameLogs = async page => { const out = []; for (const fr of page.frames()) { try { out.push({ frame: fr.url().replace(/^https?:\/\/[^/]+/, ''), avail: await fr.evaluate(() => window.__acAvail), ac: await fr.evaluate(() => window.__ac || null) }); } catch {} } return out; };
const result = { script: 'audits/tools/phase3/timer/verify-beep-silent-on-ios-1.mjs' };

// 1) WebKit availability
{
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  try {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(probe);
    await d.goto('#home');
    result.webkit = { avail: await d.page.evaluate(() => ({ AudioContext: typeof window.AudioContext, webkitAudioContext: typeof window.webkitAudioContext, audioSession: typeof navigator.audioSession, userAgent: navigator.userAgent })) };
  } finally { await L.close(); }
}
console.log('webkit:', JSON.stringify(result.webkit));

// 2) Chromium run
{
  const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await phone.ctx.addInitScript(probe); await ipad.ctx.addInitScript(probe);
    // control: a fresh page, no gesture, creates a context
    await ipad.goto('#home'); await phone.goto('#home');
    result.control = await ipad.page.evaluate(() => { const c = new (window.AudioContext)(); return { state: c.state, sticky: navigator.userActivation.hasBeenActive }; });
    const f = await phone.openApp('timer');
    await f.waitForFunction(() => window.hub && document.getElementById('go'));
    await f.click('[data-s="60"]');
    const tStart = Date.now();
    await f.click('#go');
    result.afterStartClick = { phoneTimerFrame: await f.evaluate(() => window.__ac), goText: await f.evaluate(() => document.getElementById('go').textContent) };
    console.log('after Start: contexts created in timer frame =', (result.afterStartClick.phoneTimerFrame || []).length);
    // wait for 0 (+ a margin for the iPad pull every 30 s and the shell's 1 s tick)
    await f.waitForFunction(() => document.body.classList.contains('done'), null, { timeout: 90000 });
    result.phoneDoneAfterMs = Date.now() - tStart;
    await sleep(1500);
    result.phone = await frameLogs(phone.page);
    // iPad: did it see the timer and beep? wait up to 40 s more for a pull that may already have cleared it
    let ipadLogs; const t0 = Date.now();
    while (Date.now() - t0 < 40000) { ipadLogs = await frameLogs(ipad.page); if (ipadLogs.some(x => x.ac && x.ac.length)) break; await sleep(1000); }
    await sleep(600);
    result.ipad = await frameLogs(ipad.page);
    result.ipadUserActivation = await ipad.page.evaluate(() => navigator.userActivation.hasBeenActive);
  } finally { await L.close(); }
}
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log('control (no gesture):', JSON.stringify(result.control));
console.log('phone done after ms:', result.phoneDoneAfterMs);
for (const [k, v] of [['phone', result.phone], ['ipad', result.ipad]]) for (const fr of v || []) if (fr.ac && fr.ac.length) console.log(k, fr.frame, JSON.stringify(fr.ac.map(e => ({ url: e.url, state0: e.state0, state400: e.state400, sticky: e.sticky, transient: e.transient, stack: e.stack.slice(0, 160) }))));
console.log('ipad sticky activation:', result.ipadUserActivation);
console.log('wrote', path.relative(ROOT, OUT));
