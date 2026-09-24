// Phase 3 / dollywood — skeptic #2 for finding "phone-3d-no-exit" (the 3D button cannot take you back to 2D on a phone).
//   node "audits/tools/phase3/dollywood/verify-phone-3d-no-exit-2.mjs"
// iphone-pwa (430 px): real taps on #m-3d three times; record mode, #m-2d display, aria-pressed, what is visible in the
// viewport that could leave 3D (chips, Fit, Next/Show on map), and whether "Fit park" leaves 3D.
// Control: ipad-portrait (820 px) — is #m-2d shown there (i.e. the gap is phone-only)?
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'webkit' });
const open = async device => { const d = await L.device({ device, profile: 'eli', fixedTime: false }); const f = await d.openApp('dollywood', { wait: '#b-count' }); await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 }); await sleep(600); return { d, f }; };
const tap = async (d, f, sel) => { const el = await f.$(sel); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); await d.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
const state = f => f.evaluate(() => ({ mode, m2dDisplay: getComputedStyle(document.getElementById('m-2d')).display, m3dPressed: document.getElementById('m-3d').getAttribute('aria-pressed'), view3d: getComputedStyle(document.getElementById('view3d')).display, sheet: document.getElementById('build')?.dataset.state }));
const inView = f => f.evaluate(() => {
  const vis = id => { const e = document.getElementById(id); if (!e || !e.offsetParent) return false; const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const chipsVisible = [...document.querySelectorAll('#chips button')].filter(b => { const r = b.getBoundingClientRect(); return b.offsetParent && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }).length;
  const texts = [...document.querySelectorAll('button,[role=button]')].filter(b => b.offsetParent).map(b => (b.id || '') + ':' + b.textContent.trim().slice(0, 24));
  return { chipsVisible, bNext: vis('b-next'), bShow: vis('b-show'), zFit: vis('z-fit'), readout: document.getElementById('readout').textContent, anyExitWord: texts.filter(t => /2d|back|exit|map view|flat/i.test(t)) };
});
try {
  {
    const { d, f } = await open('iphone-pwa');
    log('phone.start', await state(f));
    await tap(d, f, '#m-3d');
    await f.waitForFunction(() => typeof three !== 'undefined' && three, null, { timeout: 90000 }); await sleep(1200);
    log('phone.after1stTap', await state(f));
    await tap(d, f, '#m-3d'); await sleep(800);
    log('phone.after2ndTap', await state(f));
    await tap(d, f, '#m-3d'); await sleep(800);
    log('phone.after3rdTap', await state(f));
    log('phone.inViewWhile3D', await inView(f));
    await d.page.screenshot({ path: path.join(EV, 'verify-phone-3d-no-exit-2-phone.png'), scale: 'css', animations: 'disabled' });
    await tap(d, f, '#z-fit'); await sleep(800);
    log('phone.afterFitPark', await state(f));
    await tap(d, f, '#b-next'); await sleep(900);
    log('phone.afterNext', await state(f));
    await d.close();
  }
  {
    const { d, f } = await open('ipad-portrait');
    log('ipad.start', await state(f));
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'verify-phone-3d-no-exit-2.json'), JSON.stringify(out, null, 1));
  await L.close();
}
