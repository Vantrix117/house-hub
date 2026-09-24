// Skeptic #1 for STAB finding "wake-lock-not-taken-from-app-iframe".
//   node "audits/tools/phase2/STAB/verify-wake-lock-not-taken-from-app-iframe-1.mjs"
// Claim: the shell takes the Screen Wake Lock only on the first pointerdown on ITS document (index.html:1708-1712);
// taps inside the app iframe never reach that listener and apps/timer.html has no wake-lock call of its own, so an iPad
// that lands straight in #timer (reload, "Timer done" notification deep link, apps/timer.html opened standalone →
// hub.js:329 redirect) and is only tapped inside the app never holds a lock.
// Independent of the investigator's wakelock.mjs: fresh local instance per engine, real clock, real pointer input.
//   A  deep link #timer, tap Start inside the iframe, let it run 5 s        → expect 0 requests if the claim holds
//   B  control: open #apps, tap the Timer tile (a shell tap), then Start    → expect 1 shell request (the normal path works)
//   C  deep link #timer, tap Start inside, then one tap on the shell's pill → shows any shell tap takes it
// Every frame wraps navigator.wakeLock.request (records frame + outcome in the top window) and counts pointerdowns that
// reach its own document. Output: audits/evidence/p2/STAB/verify-wake-lock-not-taken-from-app-iframe-1.json (+ PNG of A).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const PROBE = () => {
  const top = (() => { try { return window.top.document && window.top; } catch { return window; } })();
  const rec = top.__v || (top.__v = { native: 'wakeLock' in navigator, calls: [], pointerdowns: {} });
  const frame = window === window.top ? 'shell' : location.pathname.split('/').pop();
  document.addEventListener('pointerdown', () => { rec.pointerdowns[frame] = (rec.pointerdowns[frame] || 0) + 1; }, true);
  if (!('wakeLock' in navigator)) return;
  const wl = navigator.wakeLock, orig = wl.request.bind(wl);
  window.__keep = wl;
  const wrapped = async t => { const c = { frame, result: 'pending' }; rec.calls.push(c); try { const s = await orig(t); c.result = 'granted'; return s; } catch (e) { c.result = e.name; throw e; } };
  try { Object.defineProperty(wl, 'request', { value: wrapped, configurable: true }); } catch { wl.request = wrapped; }
};
const state = async d => d.page.evaluate(() => ({ native: window.__v && window.__v.native, calls: (window.__v ? window.__v.calls : []).map(c => c.frame + ':' + c.result), pointerdowns: window.__v ? window.__v.pointerdowns : {} }));
const R = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  const E = R[engine] = {};
  try {
    // A — deep link, only in-app taps
    let d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(PROBE);
    let f = await d.openApp('timer', { wait: '#go' });
    E.A_url = d.page.url().replace(/^.*\/index\.html/, 'index.html');
    await f.click('#go');                     // real mouse input at the button's coordinates (inside the iframe)
    await sleep(5000);
    E.A_deepLinkTapInsideOnly = { ...(await state(d)), timer: await f.evaluate(() => document.getElementById('t').textContent), go: await f.evaluate(() => document.getElementById('go').textContent) };
    // can the app frame itself take a lock? (iframe allow="screen-wake-lock", index.html:413)
    E.A_appFrameCanRequest = await f.evaluate(async () => { if (!('wakeLock' in navigator)) return 'not exposed'; try { const s = await navigator.wakeLock.request('screen'); await s.release(); return 'granted'; } catch (e) { return e.name + ': ' + e.message; } });
    await d.shot(path.join(OUT, `verify-wake-lock-not-taken-from-app-iframe-1-A-${engine}.png`));
    await d.close();
    // B — control: a tap on the shell first
    d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(PROBE);
    await d.goto('#apps');
    await d.page.waitForSelector('.tile[data-id="timer"]', { timeout: 10000 });
    await d.page.click('.tile[data-id="timer"]');
    let until = Date.now() + 10000; f = null;
    while (!f && Date.now() < until) { f = d.frame('timer'); if (!f) await sleep(100); }
    await f.waitForSelector('#go', { timeout: 10000 });
    await sleep(600);
    await f.click('#go'); await sleep(3000);
    E.B_tileTapThenStart = { ...(await state(d)), timer: await f.evaluate(() => document.getElementById('t').textContent) };
    await d.close();
    // C — deep link, tap inside, then one tap on the shell's app pill (the label area of the top bar)
    d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(PROBE);
    f = await d.openApp('timer', { wait: '#go' });
    await f.click('#go'); await sleep(1500);
    E.C_beforeShellTap = await state(d);
    const box = await d.page.locator('#pill').boundingBox();
    await d.page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);   // pill edge: a shell pointerdown
    await sleep(800);
    E.C_afterShellTap = await state(d);
    await d.close();
  } finally { await L.close(); }
  console.log(engine, JSON.stringify(E, null, 1));
}
fs.writeFileSync(path.join(OUT, 'verify-wake-lock-not-taken-from-app-iframe-1.json'), JSON.stringify(R, null, 1));
