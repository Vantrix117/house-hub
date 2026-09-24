// Skeptic #2 for "audiocontext-never-closed": does every timer finish leave a new AudioContext open, and for how long?
// Chromium (WebKit on Windows has no AudioContext), real clock, Kitchen iPad signed in as Eli.
//   S: 5 finishes on Home with the Timer app closed (the shell's timerBeep, index.html:788-796)
//   A: 3 finishes with the Timer app open in the viewer (timer.html:93-101), then the viewer is closed
// Per frame: contexts made, close() calls, and each context's state + currentTime some seconds after its chime.
// Writes audits/evidence/p3/timer/verify-audiocontext-never-closed-2.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer', 'verify-audiocontext-never-closed-2.json');
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.ctx.addInitScript(() => {
    const R = window.AudioContext || window.webkitAudioContext; const log = window.__ac = { real: !!R, made: 0, closeCalls: 0, list: [] };
    if (!R) return;
    class P extends R { constructor(...a) { super(...a); log.made++; log.list.push(this); } close() { log.closeCalls++; return super.close(); } }
    window.AudioContext = P; window.webkitAudioContext = P;
  });
  const snap = fr => fr.evaluate(() => ({ real: __ac.real, made: __ac.made, closeCalls: __ac.closeCalls, contexts: __ac.list.map(c => ({ state: c.state, currentTime: +c.currentTime.toFixed(2) })) }));
  const finishOnce = async fr => {
    const now = Date.now();
    await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: now + 1500, total: 60, startedAt: now - 58500 }, updated_at: now } ] } });
    await fr.evaluate(() => hub.pull()); await sleep(4000);
  };
  await d.goto('#home'); await sleep(2500);
  for (let i = 0; i < 5; i++) await finishOnce(d.page.mainFrame());
  await sleep(5000);
  out.S_shell_after5 = await snap(d.page.mainFrame());
  const f = await d.openApp('timer'); await sleep(1500);
  for (let i = 0; i < 3; i++) await finishOnce(f);
  out.A_app_after3 = await snap(f);
  out.S_shell_during_app = await snap(d.page.mainFrame());
  await d.goto('#home'); await sleep(1500);
  out.A_viewer_closed = { timerFrameStillLoaded: d.page.frames().some(x => x.url().includes('/apps/timer.html')), frames: d.page.frames().map(x => x.url().replace(L.site, '')) };
  await sleep(3000);
  out.S_shell_end = await snap(d.page.mainFrame());
  await d.close();
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log('saved', path.relative(ROOT, OUT));
