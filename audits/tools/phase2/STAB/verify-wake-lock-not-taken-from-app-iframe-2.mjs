// Skeptic #2 for STAB finding "wake-lock-not-taken-from-app-iframe".
// Claim: index.html:1708-1712 requests the screen wake lock only on the first pointerdown on the SHELL's document; a tap inside
// an app iframe never reaches that listener, and apps/timer.html has no wake-lock call of its own, so a hub that loads straight
// into #timer (reload, or the "Timer done" notification deep link, index.html:801 + sw.js:64-68) and whose first tap is Start
// inside the app never takes the lock.
//   node "audits/tools/phase2/STAB/verify-wake-lock-not-taken-from-app-iframe-2.mjs"
// Counts navigator.wakeLock.request calls by patching WakeLock.prototype.request in every realm (shell + iframe) before any
// page script runs, and counts pointerdown events seen by each document. Real clock (fixedTime:false) so the timer really runs.
//   A  control:   #apps, tap the Timer tile in the shell, then tap Start inside the app      (expect 1 shell request)
//   B0 deep link: load index.html#timer while A's timer (same person, synced) is running: it resumes with no tap at all
//   B  then tap Pause and Start inside the app (the first taps on this page are inside the iframe), wait 2.5 s (claim: 0)
//   C  then one tap on the shell's own viewer bar (Switch app), Escape                          (expect the lock is taken then)
// Output: audits/evidence/p2/STAB/verify-wake-lock-not-taken-from-app-iframe-2.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB/verify-wake-lock-not-taken-from-app-iframe-2.json');
const PROBE = () => {
  let top; try { top = window.top.document ? window.top : window; } catch { top = window; }
  const rec = top.__probe || (top.__probe = { wl: [], pd: {} });
  const where = window === window.top ? 'shell' : location.pathname.split('/').pop();
  document.addEventListener('pointerdown', () => { rec.pd[where] = (rec.pd[where] || 0) + 1; }, true);
  if (typeof WakeLock !== 'undefined' && WakeLock.prototype.request) {
    const orig = WakeLock.prototype.request;
    WakeLock.prototype.request = function (type) {
      const c = { where, result: 'pending' }; rec.wl.push(c);
      return orig.call(this, type).then(s => { c.result = 'granted'; return s; }, e => { c.result = e.name; throw e; });
    };
  } else rec.noApi = true;
};
const read = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__probe || null)));
const frameOf = (page, id) => page.frames().find(f => f.url().includes(`/apps/${id}.html`));
async function waitFrame(page, id, sel) {
  for (let i = 0; i < 100; i++) { const f = frameOf(page, id); if (f) { await f.waitForSelector(sel, { timeout: 10000 }); return f; } await sleep(100); }
  throw new Error('no frame ' + id);
}

const R = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  const E = R[engine] = {};
  try {
    // A — control: through the shell
    let d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(PROBE);
    await d.goto('#apps'); await d.page.waitForSelector('.tile[data-id="timer"]');
    await d.page.tap('.tile[data-id="timer"]');
    let f = await waitFrame(d.page, 'timer', '#go'); await sleep(800);
    await f.tap('#go'); await sleep(1500);
    E.A_viaShellTile = { probe: await read(d.page), timer: await f.evaluate(() => document.getElementById('t').textContent), go: await f.evaluate(() => document.getElementById('go').textContent) };
    await f.evaluate(() => hub.flush()).catch(() => {}); await sleep(500);   // timer.active reaches the server (B resumes it)
    await d.close();

    // B — straight into #timer, first tap is Start inside the app
    d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(PROBE);
    await d.goto('#timer');
    f = await waitFrame(d.page, 'timer', '#go'); await sleep(800);
    for (let i = 0; i < 50 && (await f.evaluate(() => document.getElementById('go').textContent)) !== 'Pause'; i++) await sleep(200);
    E.B0_deepLinkResumedNoTap = { probe: await read(d.page), go: await f.evaluate(() => document.getElementById('go').textContent), timer: await f.evaluate(() => document.getElementById('t').textContent) };
    await f.tap('#go'); await sleep(400);                                     // Pause (clears timer.active)
    const before = await read(d.page);
    await f.tap('#go');                                                       // Start a fresh countdown
    const t1 = await f.evaluate(() => document.getElementById('t').textContent); await sleep(2500);
    const t2 = await f.evaluate(() => document.getElementById('t').textContent);
    E.B_deepLinkTapInsideApp = { probeBeforeTap: before, probe: await read(d.page), timerJustAfter: t1, timerAfter2_5s: t2,
      go: await f.evaluate(() => document.getElementById('go').textContent), hash: await d.page.evaluate(() => location.hash),
      timerActiveStored: await f.evaluate(() => { try { return !!hub.get('timer.active'); } catch { return 'err'; } }) };
    // C — one tap on the shell's own bar over the app
    await d.page.tap('#pill-name'); await sleep(600); await d.page.keyboard.press('Escape'); await sleep(300);
    E.C_thenOneShellTap = { probe: await read(d.page) };
    await d.close();
  } finally { await L.close(); }
  console.log(engine, JSON.stringify(E, null, 1));
}
fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
console.log('wrote', path.relative(ROOT, OUT));
