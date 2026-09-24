// STAB (3): Screen Wake Lock for the kiosk and the timer (index.html:1708-1712: requested on the first pointerdown on the
// shell's document; re-requested on visibilitychange only if one was ever obtained; never released, no 'release' listener).
//   node "audits/tools/phase2/STAB/wakelock.mjs"
//
// Part 1, per engine (WebKit, Chromium): is navigator.wakeLock exposed on this (secure, localhost) page, and does a real
//   request('screen') succeed with and without a user gesture?
// Part 2, the shell's own calls, counted by wrapping navigator.wakeLock.request before the page's scripts run (where the
//   engine has no wakeLock, a recording stand-in is installed so the shell's code path can still be observed):
//   a  the TV board left alone for 10 simulated minutes          b  the TV driven by a remote (Tab + ArrowDown, no pointer)
//   c  the TV after one mouse click                               d  then hidden → visible again
//   e  the iPad opened straight into the Timer app (#timer), the first tap is Start inside the app iframe
// Output: audits/evidence/p2/STAB/wakelock.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { advance, settle } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const R = {};
const STUB = () => {
  // Wraps (or stands in for) navigator.wakeLock in every frame and records each request and its outcome in the TOP window.
  const top = (() => { try { return window.top.document && window.top; } catch { return window; } })();
  const rec = top.__wl || (top.__wl = { native: 'wakeLock' in navigator, calls: [] });
  const frame = window === window.top ? 'shell' : location.pathname.split('/').pop();
  if (!('wakeLock' in navigator)) {
    class Sentinel extends EventTarget { constructor() { super(); this.released = false; this.type = 'screen'; } async release() { this.released = true; this.dispatchEvent(new Event('release')); } }
    Object.defineProperty(Navigator.prototype, 'wakeLock', { configurable: true, get() { return { request: async () => new Sentinel() }; } });
  }
  const wl = navigator.wakeLock, orig = wl.request.bind(wl);
  window.__wlRef = wl;            // keep the wrapped object alive: WebKit may otherwise collect the JS wrapper and drop the patch
  const wrapped = async (t) => { const c = { frame, at: Date.now(), result: 'pending' }; rec.calls.push(c); try { const s = await orig(t); c.result = 'granted'; return s; } catch (e) { c.result = e.name + ': ' + e.message; throw e; } };
  try { Object.defineProperty(wl, 'request', { value: wrapped, configurable: true }); } catch { wl.request = wrapped; }
};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  const E = R[engine] = {};
  try {
    // ── part 1: the raw API ──
    const p = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    await p.goto('#home'); await p.page.waitForSelector('#tv #clock');
    E.api = await p.page.evaluate(async () => {
      const out = { isSecureContext, exposed: 'wakeLock' in navigator };
      if (out.exposed) { try { const s = await navigator.wakeLock.request('screen'); out.withoutGesture = 'granted'; await s.release(); } catch (e) { out.withoutGesture = e.name + ': ' + e.message; } }
      return out;
    });
    if (E.api.exposed) {
      await p.page.evaluate(() => { window.__g = null; document.addEventListener('click', async () => { try { const s = await navigator.wakeLock.request('screen'); window.__g = 'granted'; await s.release(); } catch (e) { window.__g = e.name + ': ' + e.message; } }, { once: true }); });
      await p.page.mouse.click(5, 5); await sleep(500);
      E.api.withGesture = await p.page.evaluate(() => window.__g);
    }
    await p.close();
    // ── part 2: the shell's calls ──
    const tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() });
    await tv.ctx.addInitScript(STUB);
    await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock');
    await advance(tv, 10 * 60000);
    const calls = () => tv.page.evaluate(() => ({ native: window.__wl && window.__wl.native, calls: (window.__wl && window.__wl.calls || []).map(c => `${c.frame}:${c.result}`) }));
    E.a_tvUntouched10min = await calls();
    await tv.page.keyboard.press('Tab'); await tv.page.keyboard.press('ArrowDown');   // a remote / keyboard: focus moves, no pointer
    await tv.ctx.clock.runFor(500); await settle(tv);
    E.b_tvRemoteKeys = { ...(await calls()), focused: await tv.page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName)) };
    await tv.page.mouse.click(960, 700); await tv.ctx.clock.runFor(500); await settle(tv, { min: 300 });
    E.c_tvAfterOneClick = await calls();
    await tv.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(300);
    E.d_tvAfterVisibilityChange = await calls();
    await tv.close();
    const ip = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() });
    await ip.ctx.addInitScript(STUB);
    const f = await ip.openApp('timer', { wait: '#go' });
    await f.click('#go'); await ip.ctx.clock.runFor(1500); await settle(ip);
    E.e_ipadTimerDeepLinkTapInsideApp = { ...(await ip.page.evaluate(() => ({ native: window.__wl && window.__wl.native, calls: (window.__wl && window.__wl.calls || []).map(c => `${c.frame}:${c.result}`) }))), timer: await f.evaluate(() => document.getElementById('t').textContent) };
    await ip.close();
  } finally { await L.close(); }
  console.log(engine, JSON.stringify(E, null, 1));
}
fs.writeFileSync(path.join(OUT, 'wakelock.json'), JSON.stringify(R, null, 1));
