// Phase 3 / dollywood, skeptic #2 for finding "readout-mouse-copy-touch": after leaving 3D, does a touch device get the
// mouse hint "Move over the map for elevation · scroll to zoom · drag to pan"?
//   node "audits/tools/phase3/dollywood/verify-readout-mouse-copy-touch-2.mjs"
// Code under test: apps/dollywood.html:606-607 (initial readout, coarse-pointer swap), :824 (setTool swaps on coarse),
// :1154 (setMode hard-codes the mouse text for 2D). Unlike layout-checks.mjs (which called setMode('2d') from script),
// this uses real taps/clicks on the shipped controls only: iPad portrait 3D -> 2D button; iPhone 3D -> section chip
// (the phone hides the 2D button); iPad with the Section tool on, 3D -> 2D; desktop (fine pointer) as a control.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
const open = async device => {
  const d = await L.device({ device, profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 30000 });
  await sleep(800); return { d, f };
};
const tap = async (d, f, sel) => { const el = await f.$(sel); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); await d.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
const st = f => f.evaluate(() => ({ mode, tool, readout: document.getElementById('readout').textContent, coarse: matchMedia('(pointer:coarse)').matches, hover: matchMedia('(hover:hover)').matches, innerWidth }));
const wait3d = f => f.waitForFunction(() => typeof three !== 'undefined' && three && !/Building/.test(document.getElementById('readout').textContent), null, { timeout: 120000 });
try {
  // A. iPad portrait: 3D button, then 2D button
  {
    const { d, f } = await open('ipad-portrait');
    const before = await st(f);
    await tap(d, f, '#m-3d'); await wait3d(f); await sleep(1000); const in3d = await st(f);
    await tap(d, f, '#m-2d'); await sleep(900); const after2d = await st(f);
    // B. same iPad: Section tool on, then 3D, then 2D — the tool stays 'section' but the readout?
    await tap(d, f, '#t-sec'); await sleep(400); const secOn = await st(f);
    await tap(d, f, '#m-3d'); await sleep(1200); await tap(d, f, '#m-2d'); await sleep(900); const secAfter2d = await st(f);
    log('ipad', { before, in3d, after2d, secOn, secAfter2d });
    await d.close();
  }
  // C. iPhone PWA: 3D, then a section chip (the phone's shipped way back to 2D; #m-2d is hidden < 700 px)
  {
    const { d, f } = await open('iphone-pwa');
    const before = await st(f);
    await f.evaluate(() => window.scrollTo(0, 0));
    await tap(d, f, '#m-3d'); await wait3d(f); await sleep(1000); const in3d = await st(f);
    const chipSel = await f.evaluate(() => { const b = [...document.querySelectorAll('#chips button')].find(x => x.dataset.sec !== 'all'); return b ? `#chips button[data-sec="${b.dataset.sec}"]` : null; });
    await tap(d, f, chipSel); await sleep(1200); const afterChip = await st(f);
    log('phone', { before, in3d, chipSel, afterChip });
    await d.close();
  }
  // D. control: desktop (fine pointer) — the mouse text is right there
  {
    const { d, f } = await open('desktop');
    const before = await st(f);
    await tap(d, f, '#m-3d'); await wait3d(f); await sleep(800);
    await tap(d, f, '#m-2d'); await sleep(800); const after2d = await st(f);
    log('desktop', { before, after2d });
    await d.close();
  }
} catch (e) { console.error('ERROR', e); out.error = String(e); }
finally {
  fs.writeFileSync(path.join(EV, 'verify-readout-mouse-copy-touch-2.json'), JSON.stringify(out, null, 1));
  await L.close();
}
