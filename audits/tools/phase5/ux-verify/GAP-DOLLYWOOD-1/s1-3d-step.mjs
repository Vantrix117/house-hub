// Skeptic s1, GAP-DOLLYWOOD-1: does the 3D view show or follow the current build step?
// iPad portrait inside the hub, WebKit, as Eli. Switch to 3D, step Next, then press "Show on map"; record mode, which views
// are displayed, the current step, and whether the 2D highlight layer is visible at each point. Screenshots of each state.
//   node "audits/tools/phase5/ux-verify/GAP-DOLLYWOOD-1/s1-3d-step.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/GAP-DOLLYWOOD-1/s1');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood');
  await f.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
  await sleep(1200);
  const state = () => f.evaluate(() => { const vis = id => { const e = document.getElementById(id) || document.querySelector(id); if (!e) return null; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0; };
    const svg = document.querySelector('svg#map') || document.querySelector('.mapbox svg');
    return { mode: typeof mode !== 'undefined' ? mode : '?', step: (document.querySelector('#b-now h3') || {}).textContent, pill: (document.querySelector('#b-now .pill:last-of-type') || {}).textContent,
      svgShown: svg ? getComputedStyle(svg).display !== 'none' : null, view3dShown: vis('view3d'), canvas: !!document.querySelector('#view3d canvas'), readout: (document.getElementById('readout') || {}).textContent,
      hlChildren: typeof G !== 'undefined' && G.hl ? G.hl.childElementCount : null, three: typeof three !== 'undefined' && !!three }; });
  const shot = async n => { await d.page.screenshot({ path: path.join(OUT, n), animations: 'disabled' }); return n; };
  out.a_2d = await state(); await f.evaluate(() => document.querySelector('.mapbox').scrollIntoView({ block: 'start' })); await sleep(300); out.a_png = await shot('a-2d.png');
  await f.click('#m-3d'); await sleep(6000);
  out.b_3d = await state(); out.b_png = await shot('b-3d.png');
  await f.evaluate(() => document.getElementById('b-next').click()); await sleep(1500);
  out.c_3d_afterNext = await state(); out.c_png = await shot('c-3d-after-next.png');
  await f.evaluate(() => document.getElementById('b-show').click()); await sleep(1500);
  out.d_afterShowOnMap = await state(); await f.evaluate(() => document.querySelector('.mapbox').scrollIntoView({ block: 'start' })); await sleep(300); out.d_png = await shot('d-after-show-on-map.png');
  out.logs = d.logs.filter(l => /error/i.test(l)).slice(0, 10);
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, '3d-step.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
