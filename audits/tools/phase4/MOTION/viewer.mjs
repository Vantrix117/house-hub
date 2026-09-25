// Phase 4 MOTION — the shell's app viewer and sheets as motion: what runs when an app opens and closes, and whether
// the close can be interrupted. WebKit, iPad portrait, Eli, typical seed. Nothing is written: only navigation taps.
//  A  open: tap the Tally tile → the animations running on #viewer (name, duration, easing) and its transform-origin.
//  B  close: tap the viewer's Hub button → the exit animation, and when the iframe is blanked.
//  C  a raw tap on the Timer tile 80 ms into the 220 ms exit: what is under the finger, and what opens.
//  D  an app opened by hash 80 ms into the exit (the notification-click path) → is it on screen 800 ms later?
//  E  control: the same hash 400 ms after the close.
//  F  a sheet (Switch app, from the viewer's name button): entry animation; exit when the backdrop is tapped.
//   node "audits/tools/phase4/MOTION/viewer.mjs"  → audits/evidence/p4/MOTION/viewer.json (+ PNGs for C)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const out = {};
const anims = sel => `(() => { const e = document.querySelector('${sel}'); return e ? e.getAnimations().map(a => ({ name: a.animationName, duration: a.effect.getComputedTiming().duration, easing: a.effect.getTiming().easing, play: a.playState })) : null; })()`;
const state = p => p.evaluate(() => { const v = document.getElementById('viewer'), f = document.getElementById('frame'); return { viewerClass: v.className, viewerDisplay: getComputedStyle(v).display, frameSrc: (f.getAttribute('src') || '').replace(/^.*\/apps\//, 'apps/'), frameId: f.dataset.id || null, hash: location.hash }; });
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.goto('#apps'); await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(800);
  const tile = id => d.page.locator(`#grid .tile[data-id="${id}"]`);
  // A
  await tile('tally').click(); await sleep(30);
  out.A_open = { animations: await d.page.evaluate(anims('#viewer')), origin: await d.page.evaluate(() => getComputedStyle(document.getElementById('viewer')).transformOrigin) };
  await sleep(1500);
  // B
  await d.page.click('#pill-home'); await sleep(30);
  out.B_close = { animations: await d.page.evaluate(anims('#viewer')), at30ms: await state(d.page) };
  await sleep(400); out.B_close.at430ms = await state(d.page);
  // C: a real tap 80 ms into the exit, at the Timer tile's position (raw mouse, no actionability wait)
  const box = await tile('timer').boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await tile('tally').click(); await sleep(1500);
  await d.page.click('#pill-home'); await sleep(80);
  out.C_insideAppAt80ms = await d.page.frames().find(f => f.url().includes('/apps/tally.html')).evaluate(([x, y]) => { const e = document.elementFromPoint(x, y - 48); return e ? (e.getAttribute('aria-label') || e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')) : null; }, [cx, cy]).catch(e => String(e).slice(0, 80));
  out.C_hitAt80ms = await d.page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : '') : null; }, [cx, cy]);
  await d.page.mouse.click(cx, cy); await sleep(800);
  out.C_rawTapDuringExit = await state(d.page);
  // D: an app opened programmatically 80 ms into the exit (the hashchange path, index.html:650-652, which the service
  // worker's notification click also takes via location.hash, index.html:1575)
  await d.goto('#apps'); await sleep(1200);
  await tile('tally').click(); await sleep(1500);
  await d.page.click('#pill-home'); await sleep(80);
  await d.page.evaluate(() => { location.hash = '#timer'; }); await sleep(800);
  out.D_hashDuringExit = await state(d.page);
  await d.page.screenshot({ path: path.join(EV, 'viewer-open-during-exit-ipad.png'), scale: 'css', animations: 'disabled' });
  // E: control, same hash 400 ms after the close
  await d.goto('#apps'); await sleep(1200);
  await tile('tally').click(); await sleep(1500);
  await d.page.click('#pill-home'); await sleep(400);
  await d.page.evaluate(() => { location.hash = '#timer'; }); await sleep(800);
  out.E_hashAfter400ms = await state(d.page);
  // F: sheet (the viewer's Switch app sheet)
  await d.page.click('#pill-name'); await sleep(40);
  out.F_sheet = { backdrop: await d.page.evaluate(anims('.sheet-backdrop')), sheet: await d.page.evaluate(anims('.sheet')) };
  await sleep(600);
  await d.page.mouse.click(10, 300); await sleep(16);
  out.F_sheet.afterBackdropTap16ms = await d.page.evaluate(() => ({ backdrops: document.querySelectorAll('.sheet-backdrop').length }));
  out.F_sheet.grabberDragHandlers = await d.page.evaluate(() => 'NOT MEASURABLE FROM DOM; see code');
  out.logs = d.logs.filter(l => /error/i.test(l)).slice(0, 5);
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, 'viewer.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  await L.close();
}
