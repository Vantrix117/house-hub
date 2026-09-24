// Phase 3 / dollywood, skeptic #1 for "upright-fit-phone": on an iPhone, Upright then Fit (z-fit -> fitTarget -> fitBoxPhone)
// builds the view from the unrotated box. Compares: upright off + Fit, upright on (toggle's own fitBox), upright on + Fit (tap),
// and the iPad (fitBox path) as a control. Writes audits/evidence/p3/dollywood/verify-upright-fit-phone-1*.{json,png}.
//   node "audits/tools/phase3/dollywood/verify-upright-fit-phone-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const shot = async (d, name) => { const f = path.join(EV, 'verify-upright-fit-phone-1-' + name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), f).split(path.sep).join('/'); };
const measure = f => f.evaluate(() => {
  const s = document.querySelector('svg#map').getBoundingClientRect(), b = document.getElementById('build');
  const sheetTop = b ? b.getBoundingClientRect().top : innerHeight;
  const ms = [...document.querySelectorAll('#official .mk')].map(m => m.getBoundingClientRect()).filter(r => r.width);
  const cx = r => r.left + r.width / 2, cy = r => r.top + r.height / 2;
  const inMap = ms.filter(r => cx(r) >= s.left && cx(r) <= s.right && cy(r) >= s.top && cy(r) <= s.bottom);
  const inUncovered = inMap.filter(r => cy(r) < sheetTop && cy(r) >= 0);
  return { ROT: window.ROT, upright: document.getElementById('l-upright').checked, sheet: b && b.dataset.state, markers: ms.length,
    centreOffRight: ms.filter(r => cx(r) > s.right).length, centreOffLeft: ms.filter(r => cx(r) < s.left).length,
    centreOffTop: ms.filter(r => cy(r) < s.top).length, centreOffBottom: ms.filter(r => cy(r) > s.bottom).length,
    centreInsideMap: inMap.length, insideMapAboveSheet: inUncovered.length,
    rightmost: Math.round(Math.max(...ms.map(r => r.right))), leftmost: Math.round(Math.min(...ms.map(r => r.left))),
    map: { l: Math.round(s.left), r: Math.round(s.right), t: Math.round(s.top), b: Math.round(s.bottom) }, sheetTop: Math.round(sheetTop), vw: innerWidth };
});
const setUpright = (f, on) => f.evaluate(v => { const u = document.getElementById('l-upright'); u.checked = v; u.dispatchEvent(new Event('change')); }, on);
async function tapFit(d, f) {
  // a real tap on the visible Fit button (coordinates from the frame), falling back to .click() if it is not on screen
  await f.evaluate(() => document.getElementById('z-fit').scrollIntoView({ block: 'nearest' })); await sleep(300);
  const r = await f.evaluate(() => { const e = document.getElementById('z-fit').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2, w: e.width, vis: e.width > 0 && e.top >= 0 && e.bottom <= innerHeight }; });
  if (r.vis) { const fr = await (await f.frameElement()).boundingBox(); await d.page.mouse.click(fr.x + r.x, fr.y + r.y); }
  else await f.evaluate(() => document.getElementById('z-fit').click());
  await sleep(1000); return r.vis ? 'mouse tap' : 'element.click()';
}
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'ipad-portrait']) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await sleep(800);
    const k = device === 'iphone-pwa' ? 'phone' : 'ipad';
    log(k + '.phoneLayout', await f.evaluate(() => ({ phone: matchMedia('(max-width:699px)').matches, D_rot: (window.D || {}).rot })));
    log(k + '.boot', await measure(f));
    log(k + '.uprightOffFit.how', await tapFit(d, f));
    log(k + '.uprightOffFit', await measure(f));
    await setUpright(f, true); await sleep(1000);
    log(k + '.uprightToggleOnly', await measure(f));
    log(k + '.uprightFit.how', await tapFit(d, f));
    log(k + '.uprightFit', await measure(f));
    if (k === 'phone') log(k + '.uprightFit.png', await shot(d, k + '-upright-fit.png'));
    // the same fitTarget path is what flyTo (search / official pick, dw:1008) uses: a 140 m box around one marker
    const fly = on => f.evaluate(async on => {
      const u = document.getElementById('l-upright'); if (u.checked !== on) { u.checked = on; u.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 800)); }
      const s = document.querySelector('svg#map').getBoundingClientRect(), sheetTop = document.getElementById('build').getBoundingClientRect().top;
      const res = [];
      for (const m of [...document.querySelectorAll('#official .mk')].slice(0, 12)) {
        const x = +m.dataset.x, y = +m.dataset.y; fitTarget([x - 70, x + 70, y - 70, y + 70]);
        await new Promise(r => setTimeout(r, 600));
        const r = m.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        res.push(cx >= s.left && cx <= s.right && cy >= Math.max(0, s.top) && cy <= Math.min(s.bottom, sheetTop));
      }
      return { upright: on, tried: res.length, targetVisibleAfterFly: res.filter(Boolean).length };
    }, on);
    log(k + '.flyToUprightOff', await fly(false));
    log(k + '.flyToUprightOn', await fly(true));
    await setUpright(f, false); await sleep(600);
  }
  fs.writeFileSync(path.join(EV, 'verify-upright-fit-phone-1.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
