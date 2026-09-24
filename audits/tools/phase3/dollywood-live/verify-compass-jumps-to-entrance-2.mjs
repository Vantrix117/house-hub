// Skeptic #2: does tapping the compass (#lv-north) re-fit the view to Entrance & Plaza instead of keeping the current view?
// Setup: park variant, real clock, WebKit iPhone PWA as Eli. The view is moved to a far section (as if the parent had panned there,
// follow off), then the compass is tapped twice. We record ROT, curSec, l-upright, aria-pressed and the viewBox after each tap, and
// compare each post-tap viewBox with what fitBox(SEC.entrance.box) gives under the same rotation (the claimed target).
// Run: node "audits/tools/phase3/dollywood-live/verify-compass-jumps-to-entrance-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, EV, openMap, shot } from './_lib.mjs';
const PFX = 'verify-compass-jumps-to-entrance-2';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(1200);
  const f = await openMap(d, { settle: 2500 });
  const state = () => f.evaluate(() => ({ ROT: window.ROT, curSec: typeof curSec === 'undefined' ? 'n/a' : curSec, upright: document.getElementById('l-upright').checked,
    ariaPressed: document.getElementById('lv-north').getAttribute('aria-pressed'), viewBox: document.getElementById('map').getAttribute('viewBox') }));
  out.sections = await f.evaluate(() => D.sections.map(s => s.id));
  out.boot = await state();
  // pick the section whose box centre is farthest from the entrance box centre, and fit it (stand-in for the parent panning there)
  out.target = await f.evaluate(() => { const c = b => [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]; const e = c(SEC.entrance.box);
    let best = null, bd = -1; D.sections.forEach(s => { if (s.id === 'all' || s.id === 'entrance') return; const p = c(s.box), dd = Math.hypot(p[0] - e[0], p[1] - e[1]); if (dd > bd) { bd = dd; best = s.id } });
    fitBox(SEC[best].box, false); return { id: best, name: SEC[best].name, distFromEntrance_m: Math.round(bd) }; });
  await sleep(600);
  out.beforeTap = await state();
  await shot(d, `${PFX}-before.png`);
  await f.click('#lv-north'); await sleep(1200);
  out.afterTap1 = await state();
  await shot(d, `${PFX}-after-tap1.png`);
  // what fitBox(entrance) gives at this rotation, applied without tween, then restore
  out.entranceFitAtRot1 = await f.evaluate(() => { const v = document.getElementById('map').getAttribute('viewBox'); fitBox(SEC.entrance.box, false); const e = document.getElementById('map').getAttribute('viewBox'); return { entranceViewBox: e, same: v === e }; });
  await f.click('#lv-north'); await sleep(1200);
  out.afterTap2 = await state();
  await shot(d, `${PFX}-after-tap2.png`);
  out.entranceFitAtRot2 = await f.evaluate(() => { const v = document.getElementById('map').getAttribute('viewBox'); fitBox(SEC.entrance.box, false); const e = document.getElementById('map').getAttribute('viewBox'); return { entranceViewBox: e, same: v === e }; });
  const num = s => s.split(/\s+/).map(Number);
  const close = (a, b) => { const A = num(a), B = num(b); return A.every((v, i) => Math.abs(v - B[i]) < 1); };
  out.summary = {
    tap1_rotationChanged: out.beforeTap.ROT !== out.afterTap1.ROT,
    tap1_viewEqualsEntranceFit: close(out.afterTap1.viewBox, out.entranceFitAtRot1.entranceViewBox),
    tap1_viewMovedFromFarSection: !close(out.beforeTap.viewBox, out.afterTap1.viewBox),
    tap2_rotationChanged: out.afterTap1.ROT !== out.afterTap2.ROT,
    tap2_viewEqualsEntranceFit: close(out.afterTap2.viewBox, out.entranceFitAtRot2.entranceViewBox),
  };
  console.log(JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(EV, `${PFX}.json`), JSON.stringify(out, null, 2));
  console.log('wrote', path.join(EV, `${PFX}.json`));
} finally { await L.close(); }
