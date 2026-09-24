// Phase 3 / dollywood, skeptic #2: is the build guide's "N" (#lv-north) button shown and dead on iPad/desktop, and over 3D?
// Checks: computed display of .lv-northwrap, box, hit-test at its centre, onclick presence, state before/after a real
// pointer tap (ROT, aria-pressed, #l-upright, map view), the same in 3D, and the phone (<700px) control.
// Runs WebKit and Chromium to rule out an engine artefact.
//   node "audits/tools/phase3/dollywood/verify-dead-north-button-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const shot = async (d, name) => { const f = path.join(EV, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };

const state = f => f.evaluate(() => {
  const b = document.getElementById('lv-north'), w = b.parentElement, r = b.getBoundingClientRect();
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  return {
    flavor: document.documentElement.dataset.flavor, vw: innerWidth,
    wrapDisplay: getComputedStyle(w).display, box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    hitIsButton: !!(hit && b.contains(hit)), onclick: typeof b.onclick, ROT: (typeof ROT !== 'undefined' ? ROT : 'n/a'), pressed: b.getAttribute('aria-pressed'),
    upright: document.getElementById('l-upright') && document.getElementById('l-upright').checked,
    view: (typeof view !== 'undefined' ? view.map(Math.round) : null), mode: (typeof mode !== 'undefined' ? mode : null), transform: b.style.transform || '',
    label: b.querySelector('b').textContent, title: b.title,
  };
});
async function tapNorth(d, f) {
  const fr = await (await f.frameElement()).boundingBox();
  const r = await f.evaluate(() => { const r = document.getElementById('lv-north').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await d.page.mouse.click(fr.x + r[0], fr.y + r[1]); await sleep(600);
}
async function run(engine) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const device of ['ipad-portrait', 'desktop', 'iphone-pwa']) {
      const d = await L.device({ device, profile: 'eli', fixedTime: false });
      const f = await d.openApp('dollywood', { wait: '#b-count' });
      await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
      await sleep(500);
      const k = `${engine}.${device}`;
      const s0 = await state(f);
      log(k + '.before', s0);
      if (s0.wrapDisplay !== 'none' && s0.box[2] > 0) {
        await tapNorth(d, f);
        log(k + '.afterTap2d', await state(f));
        if (engine === 'webkit' && device === 'ipad-portrait') log(k + '.png2d', await shot(d, 'verify-dead-north-button-2-ipad-2d.png'));
        await f.evaluate(() => document.getElementById('m-3d').click()); await sleep(2500);
        const s3 = await state(f);
        log(k + '.in3d', s3);
        await tapNorth(d, f);
        log(k + '.afterTap3d', await state(f));
        if (engine === 'webkit' && device === 'ipad-portrait') log(k + '.png3d', await shot(d, 'verify-dead-north-button-2-ipad-3d.png'));
        await f.evaluate(() => document.getElementById('m-2d').click()); await sleep(500);
      }
      await d.close?.();
    }
  } finally { await L.close(); }
}
try {
  await run('webkit');
  await run('chromium');
} finally {
  fs.writeFileSync(path.join(EV, 'verify-dead-north-button-2.json'), JSON.stringify(out, null, 1));
}
