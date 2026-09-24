// Skeptic #1 for STAB "kiosk-no-wake-lock-untouched": does a TV board that nobody touches really never request a
// Screen Wake Lock? Independent re-check (does not reuse wakelock.mjs or advance.mjs).
//   node "audits/tools/phase2/STAB/verify3-kiosk-no-wake-lock-untouched-1.mjs"
//
// Code under test: index.html:1708-1712 — wake() is bound to the FIRST pointerdown on the shell document ({once:true});
// visibilitychange re-requests only when `lock` is already set. No other navigator.wakeLock caller in the shell.
//
// Per engine (WebKit, Chromium):
//   api        is navigator.wakeLock exposed here, and is a request with NO gesture granted by the engine itself?
//   S1 real    TV board (profile tv, device 'tv'), real clock, 45 s wall time, no input at all
//   S2 ff      TV board with an installed clock, 60 simulated minutes fast-forwarded, no input
//   S3 keys    then remote-style keys (Tab, ArrowDown, ArrowRight) — keyboard only, no pointer
//   S4 hidden  then a hidden → visible cycle (a TV switched input and back) with no prior pointer
//   S5 ptr     then ONE synthetic pointerdown dispatched on document
//   S6 vis     then another visibilitychange (re-request expected now that a lock exists)
//   S7 reload  then reload the page (as after a power cut / browser restart) and wait again untouched
//   S8 setup   a signed-out paired TV: the TV card is tapped on the picker (setup by hand), board shows; then reload
//   S9 remote  a signed-out paired TV where the TV card is chosen with the keyboard (Enter on the focused card)
// Every navigator.wakeLock.request call in any frame is recorded by an init script (wrapping the native API).
// Output: audits/evidence/p2/STAB/verify3-kiosk-no-wake-lock-untouched-1.json + 1x screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const TAG = 'verify3-kiosk-no-wake-lock-untouched-1';
fs.mkdirSync(OUT, { recursive: true });

const RECORDER = () => {
  const top = (() => { try { return window.top.document && window.top; } catch { return window; } })();
  const rec = top.__v3wl || (top.__v3wl = { native: 'wakeLock' in navigator, calls: [] });
  const where = window === window.top ? 'shell' : location.pathname.split('/').pop();
  if (!('wakeLock' in navigator)) return;            // engine without the API: nothing to wrap (recorded as native:false)
  const wl = navigator.wakeLock; const orig = wl.request.bind(wl);
  window.__v3keep = wl;
  const wrapped = async (type) => {
    const c = { where, type, at: Date.now(), stack: (new Error().stack || '').split('\n').slice(1, 3).join(' | ').slice(0, 200), result: 'pending' };
    rec.calls.push(c);
    try { const s = await orig(type); c.result = 'granted'; return s; } catch (e) { c.result = e.name + ': ' + e.message; throw e; }
  };
  try { Object.defineProperty(wl, 'request', { value: wrapped, configurable: true }); } catch { wl.request = wrapped; }
};
const calls = d => d.page.evaluate(() => {
  const r = window.__v3wl || { native: null, calls: [] };
  return { native: r.native, n: r.calls.length, calls: r.calls.map(c => `${c.where}:${c.result}`), visibility: document.visibilityState, kind: document.documentElement.dataset.kind || null };
});
const shot = async (d, name) => { const f = path.join(OUT, `${TAG}-${name}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };
const fireVisibility = (d, hidden) => d.page.evaluate(h => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);

const R = { ran: new Date().toISOString(), code: 'index.html:1708-1712' };
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  const E = R[engine] = {};
  try {
    // ── api: what the engine itself allows ──
    {
      const d = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
      await d.goto('#home'); await d.page.waitForSelector('#tv #clock', { timeout: 15000 });
      E.api = await d.page.evaluate(async () => {
        const o = { secure: isSecureContext, exposed: 'wakeLock' in navigator };
        if (o.exposed) { try { const s = await navigator.wakeLock.request('screen'); o.noGestureRequest = 'granted'; await s.release(); } catch (e) { o.noGestureRequest = e.name + ': ' + e.message; } }
        return o;
      });
      await d.close();
    }
    // ── S1: real clock, 45 s wall time, untouched ──
    {
      const d = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
      await d.ctx.addInitScript(RECORDER);
      await d.goto('#home'); await d.page.waitForSelector('#tv #clock', { timeout: 15000 });
      E.S1_boardShown = await calls(d);
      await sleep(45000);
      E.S1_real45s = { ...(await calls(d)), clock: await d.page.textContent('#tv #clock') };
      E.S1_shot = await shot(d, `${engine}-tv-untouched-45s`);
      await d.close();
    }
    // ── S2..S7: installed clock, 60 simulated minutes, then keys / hidden / pointer / visibility / reload ──
    {
      const d = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() });
      await d.ctx.addInitScript(RECORDER);
      await d.goto('#home'); await d.page.waitForSelector('#tv #clock', { timeout: 15000 });
      for (let i = 0; i < 360; i++) { await d.ctx.clock.runFor(10000); if (i % 6 === 5) await sleep(40); }
      E.S2_ff60min = { ...(await calls(d)), clock: await d.page.textContent('#tv #clock') };
      E.S2_shot = await shot(d, `${engine}-tv-untouched-60min`);
      for (const k of ['Tab', 'ArrowDown', 'ArrowRight']) await d.page.keyboard.press(k);
      await d.ctx.clock.runFor(1000); await sleep(200);
      E.S3_remoteKeys = { ...(await calls(d)), focused: await d.page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName)) };
      await fireVisibility(d, true); await sleep(100); await fireVisibility(d, false); await sleep(300);
      E.S4_hiddenVisibleNoPointer = await calls(d);
      await d.page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })));
      await sleep(300);
      E.S5_onePointerdown = await calls(d);
      await d.page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })));
      await sleep(300);
      E.S5b_secondPointerdown = await calls(d);
      await fireVisibility(d, true); await sleep(100); await fireVisibility(d, false); await sleep(300);
      E.S6_visibilityAfterLock = await calls(d);
      await d.page.reload({ waitUntil: 'load' }); await d.page.waitForSelector('#tv #clock', { timeout: 15000 });
      for (let i = 0; i < 60; i++) { await d.ctx.clock.runFor(10000); if (i % 6 === 5) await sleep(40); }
      E.S7_afterReload10min = await calls(d);
      await d.close();
    }
    // ── S8: setup by hand — signed-out paired TV, tap the TV card, then reload ──
    {
      const d = await L.device({ device: 'tv', profile: null, fixedTime: false, localStorage: { 'hub.lastProfile': JSON.stringify('tv') } });
      await d.ctx.addInitScript(RECORDER);
      await d.goto(''); await d.page.waitForSelector('#profiles .pcard[data-id="tv"]', { timeout: 15000 });
      E.S8_picker = await calls(d);
      await d.page.click('#profiles .pcard[data-id="tv"]');
      await d.page.waitForSelector('#tv #clock', { timeout: 15000 }); await sleep(1500);
      E.S8_afterTapSetup = await calls(d);
      E.S8_shot = await shot(d, `${engine}-tv-after-tap-setup`);
      await d.page.reload({ waitUntil: 'load' }); await d.page.waitForSelector('#tv #clock', { timeout: 15000 }); await sleep(20000);
      E.S8_afterReload20s = await calls(d);
      await d.close();
    }
    // ── S9: setup with a remote — Enter on the focused TV card ──
    {
      const d = await L.device({ device: 'tv', profile: null, fixedTime: false, localStorage: { 'hub.lastProfile': JSON.stringify('tv') } });
      await d.ctx.addInitScript(RECORDER);
      await d.goto(''); await d.page.waitForSelector('#profiles .pcard[data-id="tv"]', { timeout: 15000 });
      await sleep(500);
      E.S9_focusedCard = await d.page.evaluate(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.id);
      await d.page.keyboard.press('Enter');
      await d.page.waitForSelector('#tv #clock', { timeout: 15000 }); await sleep(3000);
      E.S9_afterEnterSetup = await calls(d);
      await d.close();
    }
  } catch (e) { E.error = String(e && e.stack || e); }
  finally { await L.close(); }
  console.log(engine, JSON.stringify(E, null, 1));
}
fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(R, null, 1));
console.log('wrote', path.join(OUT, `${TAG}.json`));
