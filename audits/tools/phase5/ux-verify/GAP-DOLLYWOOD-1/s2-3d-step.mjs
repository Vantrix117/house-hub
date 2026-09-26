// Skeptic s2, GAP-DOLLYWOOD-1: does the 3D view show (or follow) the current build step? iPad portrait, inside the hub
// viewer, WebKit, as Eli, typical seed. Enter 3D, record what is visible, then tap Next / Mark-done-free step actions
// (Next, a step-list row, Show on map) and record whether the view stays in 3D.
//   node audits/tools/phase5/ux-verify/GAP-DOLLYWOOD-1/s2-3d-step.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/GAP-DOLLYWOOD-1/s2');
fs.mkdirSync(OUT, { recursive: true });
const res = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood');
  await f.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
  await sleep(1200);
  const state = () => f.evaluate(() => {
    const vis = id => { const e = document.getElementById(id); if (!e) return null; const cs = getComputedStyle(e); return cs.display !== 'none' && e.getBoundingClientRect().width > 0; };
    const hl = document.getElementById('hl');
    return { mode3dPressed: document.getElementById('m-3d').getAttribute('aria-pressed'), svgVisible: vis('map') ?? (document.querySelector('svg#map,svg.map,.mapbox svg') && getComputedStyle(document.querySelector('.mapbox svg')).display !== 'none'),
      view3dVisible: vis('view3d'), hasCanvas: !!document.querySelector('#view3d canvas'), hlExists: !!hl, hlVisibleInLayout: hl ? hl.getBoundingClientRect().width > 0 : null,
      step: (document.querySelector('#b-now h3') || {}).textContent, readout: (document.getElementById('readout') || {}).textContent };
  });
  res.before = await state();
  await f.evaluate(() => document.getElementById('m-3d').click());
  await f.waitForFunction(() => !!document.querySelector('#view3d canvas') || /failed/.test(document.getElementById('view3d').textContent), null, { timeout: 60000 }).catch(() => {});
  await sleep(4000);
  res.in3d = await state();
  await f.evaluate(() => document.querySelector('.mapbox').scrollIntoView({ block: 'start' })); await sleep(400);
  await d.page.screenshot({ path: path.join(OUT, 'ipad-3d.png'), animations: 'disabled' });
  // step actions while in 3D
  for (const [name, js] of [['Next', () => document.getElementById('b-next').click()], ['step-list row', () => document.querySelectorAll('.bitem')[2].click()], ['Show on map', () => document.getElementById('b-show').click()]]) {
    await f.evaluate(() => document.getElementById('m-3d').click()); await sleep(1500);
    const pre = (await state()).mode3dPressed;
    await f.evaluate(js); await sleep(1200);
    res['after ' + name] = { pressedBefore: pre, ...(await state()) };
  }
  console.log(JSON.stringify(res, null, 1));
  await d.close();
} finally {
  fs.writeFileSync(path.join(OUT, '3d-step.json'), JSON.stringify(res, null, 1));
  await L.close();
}
