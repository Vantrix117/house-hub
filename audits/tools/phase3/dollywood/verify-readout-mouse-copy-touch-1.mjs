// Skeptic #1 for finding "readout-mouse-copy-touch": after leaving 3D on a touch device, does the readout show the
// mouse hint? Uses only UI paths (real taps on #m-3d and on a coaster legend chip, which calls setMode('2d')), no setMode() from
// the test. Rerunnable:  node "audits/tools/phase3/dollywood/verify-readout-mouse-copy-touch-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const read = f => f.evaluate(() => ({ mode, readout: document.getElementById('readout').textContent, coarse: matchMedia('(pointer:coarse)').matches }));
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'ipad-portrait']) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await sleep(500);
    log(device + '.boot', await read(f));
    await f.locator('#m-3d').tap();
    await f.waitForFunction(() => (typeof three !== 'undefined' && three) || /failed/.test(document.getElementById('view3d').textContent), null, { timeout: 90000 });
    await sleep(1200);
    log(device + '.in3d', await read(f));
    const chip = f.locator('#clegend .cle').first();
    await chip.scrollIntoViewIfNeeded();
    log(device + '.chip', await chip.textContent());
    await chip.tap();
    await sleep(800);
    const r = await read(f);
    log(device + '.afterChipTap', r);
    // tap the map once (no hover on touch) and read again
    const box = await f.locator('svg#map').boundingBox();
    if (box) { await d.page.touchscreen.tap(box.x + box.width / 2, box.y + 40); await sleep(500); }
    log(device + '.afterMapTap', await read(f));
    const png = path.join(EV, `verify-readout-mouse-copy-touch-1-${device}.png`);
    await d.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
    log(device + '.png', path.relative(process.cwd(), png).split(path.sep).join('/'));
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'verify-readout-mouse-copy-touch-1.json'), JSON.stringify(out, null, 1));
  await L.close();
}
