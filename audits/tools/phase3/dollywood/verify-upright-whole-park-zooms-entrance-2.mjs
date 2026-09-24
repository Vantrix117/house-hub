// Phase 3 / dollywood skeptic #2: does turning on "Upright" while "Whole park" is the pressed chip zoom to one section?
// Real clicks on the label (not a synthetic change event), iPad portrait + desktop, Eli, typical seed.
//   node "audits/tools/phase3/dollywood/verify-upright-whole-park-zooms-entrance-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood'); fs.mkdirSync(EV, { recursive: true });
const P = 'verify-upright-whole-park-zooms-entrance-2';
const out = {}; const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const state = f => f.evaluate(() => ({
  pressedChip: (document.querySelector('#chips button[aria-pressed=true] .cl') || {}).textContent,
  curSec, upright: document.getElementById('l-upright').checked, ROT: window.ROT,
  viewW: Math.round(view[2]), wholeParkFitW: Math.round(FITW), ratio: +(view[2] / FITW).toFixed(2),
  labelVisible: (() => { const r = document.getElementById('l-upright').closest('label').getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
}));
const clickUpright = async f => { if (await f.locator('#tab-layers').isHidden()) { const t = f.locator('.tabs [data-tab=layers]'); await t.scrollIntoViewIfNeeded(); await t.click(); await sleep(300); } const lab = f.locator('label:has(#l-upright)'); await lab.scrollIntoViewIfNeeded(); await lab.click(); await sleep(1200); };
const clickChip = async (f, re) => { const b = f.locator('#chips button', { hasText: re }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await sleep(1200); };
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const device of ['ipad-portrait', 'desktop']) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 }); await sleep(600);
    log(device + '.A.fresh', await state(f));
    await clickUpright(f); log(device + '.A.afterUprightOn', await state(f));
    await clickUpright(f); log(device + '.A.afterUprightOff', await state(f));
    // B: pick another section, then Whole park explicitly, then Upright
    const chips = await f.evaluate(() => [...document.querySelectorAll('#chips button .cl')].map(c => c.textContent.trim()));
    log(device + '.chips', chips);
    const other = chips.find(c => !/Whole park|Entrance/.test(c));
    await clickChip(f, other.split('  ')[0]); log(device + '.B.afterOtherChip', await state(f));
    await clickChip(f, 'Whole park'); log(device + '.B.afterWholeParkChip', await state(f));
    await clickUpright(f); log(device + '.B.afterUprightOn', await state(f));
    if (device === 'ipad-portrait') await d.page.screenshot({ path: path.join(EV, P + '-ipad-wholepark-after-other-upright.png'), scale: 'css' });
    // C: control — with Upright on, the Fit button gives the whole-park width
    const fit = f.locator('#z-fit'); if (await fit.isVisible()) { await fit.click(); await sleep(1200); log(device + '.C.afterFitButton', await state(f)); } else log(device + '.C.fitButton', 'not visible');
    await d.ctx.close();
  }
} finally { fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 1)); await L.close(); }
