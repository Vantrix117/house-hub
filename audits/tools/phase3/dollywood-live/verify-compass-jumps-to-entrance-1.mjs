// Skeptic #1 for finding "compass-jumps-to-entrance" (apps/dollywood-live.html :1467 -> :1029, curSec :1062).
// Fresh local instance. (A) the user drags the map away from the entrance, then taps the compass twice;
// (B) GPS follow at a far ride, then the compass. For each state: ROT, l-upright, aria-pressed, and the screen
// distance (CSS px) from the map-viewport centre to the Entrance & Plaza centre and to the point the user was looking at.
import { local, sleep, save, shot, openMap, putAt, grant } from './_lib.mjs';
const P = 'verify-compass-jumps-to-entrance-1';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home');
  const f = await openMap(d, { settle: 1500 });
  // map-metre point -> screen px inside the frame, via ROOT's CTM (the page's own transform)
  const probe = (pts) => f.evaluate((pts) => {
    const svg = document.getElementById('map'), r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const tgt = window.ROOT || svg; const m = tgt.getScreenCTM();
    const res = { ROT: window.ROT, upright: document.getElementById('l-upright').checked,
      ariaPressed: document.getElementById('lv-north').getAttribute('aria-pressed'), viewBox: svg.getAttribute('viewBox'),
      curSec: (() => { try { return curSec } catch (e) { return 'n/a' } })(), pts: {} };
    for (const [k, [x, y]] of Object.entries(pts)) { const p = svg.createSVGPoint(); p.x = x; p.y = Y(y); const s = p.matrixTransform(m);
      res.pts[k] = { sx: Math.round(s.x), sy: Math.round(s.y), distFromCentre: Math.round(Math.hypot(s.x - cx, s.y - cy)),
        onScreen: s.x >= r.left && s.x <= r.right && s.y >= r.top && s.y <= r.bottom }; }
    return res; }, pts);
  const ent = await f.evaluate(() => { const b = SEC.entrance.box; return [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]; });
  // a far point: the east end of the park
  const far = await f.evaluate(() => { const b = D.layers.allbox; return [b[0] + (b[1] - b[0]) * 0.8, b[2] + (b[3] - b[2]) * 0.55]; });
  out.entranceCentre = ent; out.farPoint = far;
  out.A0_boot = await probe({ entrance: ent, far });
  // (A) user pans: zoom to the far point the way a user would see it (fit a small box there), then a real drag
  await f.evaluate(([x, y]) => fitBox([x - 90, x + 90, y - 90, y + 90], false), far); await sleep(400);
  const box = await (await f.frameElement()).boundingBox();
  await d.page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.4); await d.page.mouse.down();
  await d.page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height * 0.4 + 20, { steps: 8 }); await d.page.mouse.up(); await sleep(600);
  out.A1_beforeTap = await probe({ entrance: ent, far });
  await shot(d, `${P}-A1-before.png`);
  await f.click('#lv-north'); await sleep(1500);
  out.A2_afterTap1 = await probe({ entrance: ent, far });
  await shot(d, `${P}-A2-after-tap1.png`);
  await f.click('#lv-north'); await sleep(1500);
  out.A3_afterTap2 = await probe({ entrance: ent, far });
  await shot(d, `${P}-A3-after-tap2.png`);
  // (B) GPS follow at the far point on a second, fresh device
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await grant(d2, L.site); await d2.goto('#home');
  const f2 = await openMap(d2, { settle: 1500 });
  await putAt(d2, f2, far[0], far[1], 8);
  await f2.click('#loc-btn'); await sleep(2500);
  const probe2 = (pts) => f2.evaluate((pts) => { const svg = document.getElementById('map'), r = svg.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const m = (window.ROOT || svg).getScreenCTM(); const res = { ROT: window.ROT, pill: document.getElementById('lv-pill').dataset.state, pts: {} };
    for (const [k, [x, y]] of Object.entries(pts)) { const p = svg.createSVGPoint(); p.x = x; p.y = Y(y); const s = p.matrixTransform(m); res.pts[k] = { distFromCentre: Math.round(Math.hypot(s.x - cx, s.y - cy)), onScreen: s.x >= r.left && s.x <= r.right && s.y >= r.top && s.y <= r.bottom }; } return res; }, pts);
  out.B1_following = await probe2({ entrance: ent, far });
  await f2.click('#lv-north'); await sleep(1500);
  out.B2_afterTap = await probe2({ entrance: ent, far });
  await putAt(d2, f2, far[0] + 3, far[1] + 3, 8); await sleep(3000);   // next GPS fix
  out.B3_afterNextFix = await probe2({ entrance: ent, far });
  await shot(d2, `${P}-B3-after-next-fix.png`);
} catch (e) { out.error = String(e && e.stack || e); }
finally { save(`${P}.json`, out); console.log(JSON.stringify(out, null, 1)); await L.close(); }
