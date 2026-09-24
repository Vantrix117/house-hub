// Skeptic #2 for STAB finding "kiosk-no-wake-lock-untouched".
// Claim: index.html:1708-1712 requests the screen wake lock only on the first pointerdown on the shell document and
// re-requests on visibilitychange only if a lock was already held, so an untouched TV board never holds a lock.
//   node "audits/tools/phase2/STAB/verify3-kiosk-no-wake-lock-untouched-2.mjs"
// Counts WakeLock.prototype.request calls (patched before any page script, every realm) plus pointerdown / keydown / click
// events seen by the shell document. Both engines. Scenarios:
//   A   TV (profile tv) loaded straight into the board, left alone for 10 simulated minutes            (claim: 0 requests)
//   A2  then a visibilitychange (hidden -> visible return)                                             (claim: still 0)
//   A3  then remote-style keys only: Tab, ArrowDown, ArrowRight (no pointer)                          (claim: still 0)
//   B   then one synthetic pointerdown on document, then a real mouse click, then visibilitychange     (1, 1, 2)
//   C   mitigation check: the TV signed out, the Downstairs TV card picked with a MOUSE click (setup), then page reload
//   D   the same setup driven by a D-pad remote: TV card focused, Enter (keyboard activation => click, no pointerdown)
//   E   control: a gesture-free request('screen') from the untouched board succeeds in this engine?
// Output: audits/evidence/p2/STAB/verify3-kiosk-no-wake-lock-untouched-2.json (+ one 1x PNG of the untouched board per engine)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { advance, settle } from './advance.mjs';

const OUT_DIR = path.join(ROOT, 'audits/evidence/p2/STAB');
const OUT = path.join(OUT_DIR, 'verify3-kiosk-no-wake-lock-untouched-2.json');
const PROBE = () => {
  let top; try { top = window.top.document ? window.top : window; } catch { top = window; }
  const rec = top.__probe || (top.__probe = { wl: [], ev: {}, nativeApi: 'wakeLock' in navigator });
  const where = window === window.top ? 'shell' : location.pathname.split('/').pop();
  for (const t of ['pointerdown', 'keydown', 'click']) document.addEventListener(t, () => { const k = where + ':' + t; rec.ev[k] = (rec.ev[k] || 0) + 1; }, true);
  if (typeof WakeLock !== 'undefined' && WakeLock.prototype.request) {
    const orig = WakeLock.prototype.request;
    WakeLock.prototype.request = function (type) {
      const c = { where, tag: top.__tag || null, result: 'pending' }; rec.wl.push(c);
      return orig.call(this, type).then(s => { c.result = 'granted'; c.sentinel = s; return s; }, e => { c.result = e.name; throw e; });
    };
  } else rec.noApi = true;
};
const read = p => p.evaluate(() => {
  const r = window.__probe; if (!r) return null;
  return { nativeApi: r.nativeApi, noApi: !!r.noApi, ev: r.ev, requests: r.wl.map(c => ({ where: c.where, tag: c.tag, result: c.result, released: c.sentinel ? c.sentinel.released : null })) };
});
const boardUp = d => d.page.waitForSelector('#tv #clock', { timeout: 15000 });

const R = { ranAt: new Date().toISOString(), code: 'index.html:1708-1712' };
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  const E = R[engine] = {};
  try {
    // ── A: the board, untouched ──
    let tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() });
    await tv.ctx.addInitScript(PROBE);
    await tv.goto('#home'); await boardUp(tv); await settle(tv, { min: 300 });
    await advance(tv, 10 * 60000);
    E.A_untouched10min = { probe: await read(tv.page), kiosk: await tv.page.evaluate(() => !!(window.hub && hub.isKiosk)), visibility: await tv.page.evaluate(() => document.visibilityState),
      videos: await tv.page.evaluate(() => document.querySelectorAll('video').length), clock: await tv.page.evaluate(() => document.getElementById('clock').textContent) };
    await tv.page.screenshot({ path: path.join(OUT_DIR, `verify3-kiosk-no-wake-lock-untouched-2-A-${engine}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    await tv.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(300);
    E.A2_afterVisibilityChange = { probe: await read(tv.page) };
    for (const k of ['Tab', 'ArrowDown', 'ArrowRight']) { await tv.page.keyboard.press(k); await sleep(100); }
    await tv.ctx.clock.runFor(500); await settle(tv);
    E.A3_afterRemoteKeys = { probe: await read(tv.page), focused: await tv.page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName)) };
    // ── B: one pointerdown ──
    await tv.page.evaluate(() => { window.__tag = 'B-synthetic'; document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }); await sleep(400);
    E.B1_afterSyntheticPointerdown = { probe: await read(tv.page) };
    await tv.page.evaluate(() => { window.__tag = 'B-mouse'; }); await tv.page.mouse.click(960, 1000); await sleep(400);
    E.B2_afterRealMouseClick = { probe: await read(tv.page) };
    await tv.page.evaluate(() => { window.__tag = 'B-visibility'; document.dispatchEvent(new Event('visibilitychange')); }); await sleep(400);
    E.B3_afterVisibilityChange = { probe: await read(tv.page) };
    await tv.close();

    // ── C: setup with a pointer (picker card clicked), then a reload ──
    tv = await L.device({ device: 'tv', profile: null, fixedTime: false, localStorage: { 'hub.lastProfile': JSON.stringify('tv') } });
    await tv.ctx.addInitScript(PROBE);
    await tv.goto('#home'); await tv.page.waitForSelector('.pcard[data-id="tv"]', { timeout: 15000 });
    await tv.page.evaluate(() => { window.__tag = 'C-pick-mouse'; });
    await tv.page.click('.pcard[data-id="tv"]'); await boardUp(tv); await sleep(800);
    E.C1_setupPickedWithMouse = { probe: await read(tv.page), kiosk: await tv.page.evaluate(() => !!(window.hub && hub.isKiosk)) };
    await tv.page.reload({ waitUntil: 'load' }); await boardUp(tv); await sleep(20000);          // power cycle / browser restart / manual reload
    E.C2_afterReloadUntouched20s = { probe: await read(tv.page), kiosk: await tv.page.evaluate(() => !!(window.hub && hub.isKiosk)) };
    await tv.close();

    // ── D: setup with a D-pad remote (focus + Enter) ──
    tv = await L.device({ device: 'tv', profile: null, fixedTime: false, localStorage: { 'hub.lastProfile': JSON.stringify('tv') } });
    await tv.ctx.addInitScript(PROBE);
    await tv.goto('#home'); await tv.page.waitForSelector('.pcard[data-id="tv"]', { timeout: 15000 }); await sleep(300);
    const focusedBefore = await tv.page.evaluate(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.id);
    await tv.page.evaluate(() => { window.__tag = 'D-pick-enter'; });
    await tv.page.keyboard.press('Enter'); await boardUp(tv); await sleep(5000);
    E.D_setupPickedWithRemoteEnter = { focusedBefore, probe: await read(tv.page), kiosk: await tv.page.evaluate(() => !!(window.hub && hub.isKiosk)) };
    // ── E: control — would a gesture-free request have worked here? ──
    E.E_gestureFreeRequestControl = await tv.page.evaluate(async () => { window.__tag = 'E-control'; try { const s = await navigator.wakeLock.request('screen'); const r = 'granted'; await s.release(); return r; } catch (e) { return e.name + ': ' + e.message; } });
    await tv.close();
  } finally { await L.close(); }
  console.log(engine, JSON.stringify(E, null, 1));
}
fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
console.log('wrote', path.relative(ROOT, OUT));
