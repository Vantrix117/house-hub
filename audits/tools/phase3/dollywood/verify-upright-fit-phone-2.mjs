// Phase 3 / dollywood, skeptic 2 for "upright-fit-phone": on a phone, Upright then Fit (and a section chip under Upright)
// frames the unrotated box, so the rotated park lands off the map. Controls: the same steps on the iPad (fitBox path),
// Upright alone on the phone (its change handler calls fitBox), and a Chromium run (to rule out a WebKit artefact).
//   node "audits/tools/phase3/dollywood/verify-upright-fit-phone-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const shot = async (d, name) => { const f = path.join(EV, 'verify-upright-fit-phone-2-' + name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };

// markers of the official layer inside / outside the visible map (the svg rect clipped to the viewport and above the sheet)
const measure = f => f.evaluate(() => {
  const s = document.querySelector('svg#map').getBoundingClientRect(), b = document.getElementById('build'), bt = b ? b.getBoundingClientRect().top : innerHeight;
  const phone = typeof PHONE === 'function' && PHONE();
  const vis = { l: Math.max(0, s.left), r: Math.min(innerWidth, s.right), t: Math.max(0, s.top), b: Math.min(innerHeight, s.bottom, phone ? bt : 1e9) };
  const ms = [...document.querySelectorAll('#official .mk')].map(m => m.getBoundingClientRect()).filter(r => r.width);
  const c = r => [r.left + r.width / 2, r.top + r.height / 2];
  const inside = ms.filter(r => { const [x, y] = c(r); return x >= vis.l && x <= vis.r && y >= vis.t && y <= vis.b; }).length;
  return { phone, ROT: window.ROT, view: view.map(Math.round), markers: ms.length, centresInVisibleMap: inside, offRight: ms.filter(r => c(r)[0] > vis.r).length, offLeft: ms.filter(r => c(r)[0] < vis.l).length,
    offBelowOrUnderSheet: ms.filter(r => c(r)[1] > vis.b).length, offAbove: ms.filter(r => c(r)[1] < vis.t).length,
    markerX: [Math.round(Math.min(...ms.map(r => r.left))), Math.round(Math.max(...ms.map(r => r.right)))], visibleMap: Object.fromEntries(Object.entries(vis).map(([k, v]) => [k, Math.round(v)])), sheet: b && b.dataset.state };
});
const setUpright = (f, on) => f.evaluate(on => { const u = document.getElementById('l-upright'); u.checked = on; u.dispatchEvent(new Event('change')); }, on);

async function run(engine) {
  const L = await local({ variant: 'typical', engine });
  const r = {};
  try {
    for (const device of ['iphone-pwa', 'ipad-portrait']) {
      const d = await L.device({ device, profile: 'eli', fixedTime: false });
      const f = await d.openApp('dollywood', { wait: '#b-count' });
      await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 30000 });
      await sleep(800);
      r[device + '.start'] = await measure(f);
      await f.evaluate(() => document.getElementById('z-fit').click()); await sleep(900);
      r[device + '.fitNorthUp'] = await measure(f);
      await setUpright(f, true); await sleep(1000);
      r[device + '.uprightOnly'] = await measure(f);
      // real tap on the Fit button
      await f.locator('#z-fit').tap().catch(async () => f.locator('#z-fit').click()); await sleep(1000);
      r[device + '.uprightThenFit'] = await measure(f);
      if (engine === 'webkit') r[device + '.uprightThenFit.png'] = await shot(d, device + '.png');
      // what fitBox's rotation math would have produced for the same box (the rotated axis-aligned bounds)
      r[device + '.rotatedAllboxVsRaw'] = await f.evaluate(() => { const b = D.layers.allbox, rr = ROT * Math.PI / 180, cx = WM / 2, cy = HM / 2, c = Math.cos(rr), s = Math.sin(rr);
        const P = [[b[0], b[2]], [b[1], b[2]], [b[0], b[3]], [b[1], b[3]]].map(([x, y]) => { const ux = x - cx, uy = Y(y) - cy; return [cx + ux * c - uy * s, cy + ux * s + uy * c]; });
        const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
        return { rawUserX: [Math.round(b[0]), Math.round(b[1])], rawUserY: [Math.round(Y(b[3])), Math.round(Y(b[2]))], rotatedUserX: [Math.round(Math.min(...xs)), Math.round(Math.max(...xs))], rotatedUserY: [Math.round(Math.min(...ys)), Math.round(Math.max(...ys))], viewNow: view.map(Math.round) }; });
      // a section chip under Upright (fitTarget -> fitBoxPhone on a phone): Timber Canyon if present, else the 3rd chip
      const chip = await f.evaluate(() => { const bs = [...document.querySelectorAll('#chips button')]; const b = bs.find(x => /timber/i.test(x.textContent)) || bs[2]; b.click(); return b.textContent.trim(); }); await sleep(1100);
      r[device + '.uprightChip'] = { chip, ...(await f.evaluate(() => { const id = curSec; const s = document.querySelector('svg#map').getBoundingClientRect(), bt = document.getElementById('build').getBoundingClientRect().top, ph = PHONE();
        const vb = Math.min(innerHeight, s.bottom, ph ? bt : 1e9);
        const ms = [...document.querySelectorAll('#official .mk')].filter(m => { const o = OFF.find(o => 'o:' + o.n === m.dataset.pick || String(o.n) === m.dataset.pick); return true; }).map(m => m.getBoundingClientRect()).filter(r => r.width);
        const box = SEC[id] && SEC[id].box; const rr = ROT * Math.PI / 180, cx = WM / 2, cy = HM / 2;
        // the section box's centre, rotated, in screen px via the svg CTM of the root group
        const root = document.getElementById('root'); const pt = document.querySelector('svg#map').createSVGPoint(); pt.x = (box[0] + box[1]) / 2; pt.y = Y((box[2] + box[3]) / 2);
        const sc = pt.matrixTransform((root || document.querySelector('svg#map')).getScreenCTM());
        return { curSec: id, sectionCentreOnScreen: [Math.round(sc.x), Math.round(sc.y)], centreInsideVisibleMap: sc.x >= Math.max(0, s.left) && sc.x <= Math.min(innerWidth, s.right) && sc.y >= Math.max(0, s.top) && sc.y <= vb, visibleMap: { l: Math.round(Math.max(0, s.left)), r: Math.round(Math.min(innerWidth, s.right)), t: Math.round(Math.max(0, s.top)), b: Math.round(vb) } };
      })) };
      if (engine === 'webkit') r[device + '.uprightChip.png'] = await shot(d, device + '-chip.png');
      // is Upright remembered across a reload? (grep the payload's storage key)
      r[device + '.uprightPersisted'] = await f.evaluate(() => { try { return Object.keys(localStorage).filter(k => /upright|rot/i.test(k)); } catch (e) { return String(e); } });
      await setUpright(f, false);
      await d.close();
    }
  } finally { await L.close(); }
  return r;
}
out.webkit = await run('webkit');
for (const [k, v] of Object.entries(out.webkit)) console.log('webkit', k, JSON.stringify(v));
out.chromium = await run('chromium');
for (const [k, v] of Object.entries(out.chromium)) console.log('chromium', k, JSON.stringify(v));
fs.writeFileSync(path.join(EV, 'verify-upright-fit-phone-2.json'), JSON.stringify(out, null, 1));
console.log('wrote audits/evidence/p3/dollywood/verify-upright-fit-phone-2.json');
