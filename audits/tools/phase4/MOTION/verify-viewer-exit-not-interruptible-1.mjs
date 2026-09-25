// Phase 4 MOTION, skeptic #1 for "viewer-exit-not-interruptible". Independent re-measure; nothing is written (navigation only).
// WebKit, iPad portrait, Eli, typical seed, real clock. Uses Prayer -> Leftovers (not the finding's Tally -> Timer) so it is
// an independent pair, then Tally -> Timer as a cross-check.
//  T1  tap a tile at 60 / 120 / 180 ms into the 220 ms exit (raw mouse, no actionability wait): what the point hits, and is
//      the tapped app on screen 900 ms later? Control at 300 ms.
//  T2  location.hash = '#<app>' at 60 / 150 ms into the exit (the hashchange path the service-worker 'open' message uses,
//      index.html:1575 -> 650-652): state 900 ms later. Control at 300 ms. Screenshot of the 150 ms case.
//  T3  (Chromium) close 120 ms into viewer-in, read computed opacity/scale synchronously just before and just after the
//      close click in the same task, so frame gaps cannot inflate the jump.
//   node "audits/tools/phase4/MOTION/verify-viewer-exit-not-interruptible-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const out = { T1: {}, T2: {}, T3: [] };
const state = p => p.evaluate(() => { const v = document.getElementById('viewer'), f = document.getElementById('frame'); return { viewerClass: v.className, viewerDisplay: getComputedStyle(v).display, frameSrc: (f.getAttribute('src') || '').replace(/^.*\/apps\//, 'apps/'), hash: location.hash, visibleView: [...document.querySelectorAll('.view.on')].map(e => e.id).join(',') }; });
let L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const home = async () => { await d.goto('#apps'); await sleep(1000); };
  await home(); await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
  const tile = id => d.page.locator(`#grid .tile[data-id="${id}"]`);
  const openThenClose = async (a) => { await tile(a).click(); await sleep(1500); await d.page.click('#pill-home'); };
  for (const [a, b] of [['prayer', 'leftovers'], ['tally', 'timer']]) {
    for (const ms of [60, 120, 180, 300]) {
      await home();
      const bx = await tile(b).boundingBox(); const cx = bx.x + bx.width / 2, cy = bx.y + bx.height / 2;
      await openThenClose(a); const t0 = Date.now(); await sleep(ms);
      const hit = await d.page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.dataset && e.dataset.id ? '[' + e.dataset.id + ']' : '') : null; }, [cx, cy]);
      const actual = Date.now() - t0;
      await d.page.mouse.click(cx, cy); await sleep(900);
      out.T1[`${a}->${b}@${ms}`] = { actualMs: actual, hit, after: await state(d.page) };
    }
    for (const ms of [60, 150, 300]) {
      await home(); await openThenClose(a); const t0 = Date.now(); await sleep(ms);
      await d.page.evaluate(h => { location.hash = h; }, '#' + b); const actual = Date.now() - t0; await sleep(900);
      out.T2[`${a}->#${b}@${ms}`] = { actualMs: actual, after: await state(d.page) };
      if (ms === 150 && a === 'prayer') await d.page.screenshot({ path: path.join(EV, 'verify-viewer-exit-not-interruptible-1-hash-during-exit-ipad.png'), scale: 'css', animations: 'disabled' });
    }
  }
  await d.close();
} finally { await L.close(); }
L = await local({ variant: 'typical', engine: 'chromium' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.goto('#apps'); await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(800);
  for (const at of [60, 120, 200]) {
    out.T3.push(await d.page.evaluate(async at => {
      const v = document.getElementById('viewer');
      const rd = () => { const c = getComputedStyle(v); const m = /matrix\(([^)]+)\)/.exec(c.transform); const sc = m ? Math.hypot(...m[1].split(',').slice(0, 2).map(Number)) : 1; return { o: +(+c.opacity).toFixed(3), s: +sc.toFixed(3) }; };
      document.querySelector('#grid .tile[data-id="tally"]').click();
      const anim = v.getAnimations()[0];
      await new Promise(res => { const f = () => (anim.currentTime >= at ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      const t = Math.round(anim.currentTime); const before = rd();
      document.getElementById('pill-home').click();
      const after = rd(); const outAnim = v.getAnimations().map(a => a.animationName + '@' + Math.round(a.currentTime));
      await new Promise(r => setTimeout(r, 600));
      return { closeAtViewerInMs: t, before, after, opacityJump: +(after.o - before.o).toFixed(3), scaleJump: +(after.s - before.s).toFixed(3), runningAfter: outAnim };
    }, at));
    await sleep(700); await d.goto('#apps'); await sleep(800);
  }
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, 'verify-viewer-exit-not-interruptible-1.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  await L.close();
}
