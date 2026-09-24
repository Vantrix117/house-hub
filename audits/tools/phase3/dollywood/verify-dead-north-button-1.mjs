// Phase 3 / dollywood, skeptic #1 for finding "dead-north-button": is the 'N' compass button over the build guide's map
// shown on iPad/desktop, does a tap do nothing, is it still there in 3D, and is it hidden on the phone (control)?
//   node "audits/tools/phase3/dollywood/verify-dead-north-button-1.mjs"
// Writes audits/evidence/p3/dollywood/verify-dead-north-button-1.json (+ two 1x PNGs).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };

const probe = f => f.evaluate(() => {
  const b = document.getElementById('lv-north'), w = b.parentElement, r = b.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hit = r.width ? document.elementFromPoint(cx, cy) : null;
  const lab = b.querySelector('b'), cs = getComputedStyle(lab), bs = getComputedStyle(b);
  return {
    flavor: document.documentElement.dataset.flavor, innerWidth,
    wrapDisplay: getComputedStyle(w).display, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    inViewport: r.width > 0 && r.bottom > 0 && r.top < innerHeight,
    centreHitIsButton: !!hit && (hit === b || b.contains(hit)),
    onclick: typeof b.onclick, ROT: window.ROT, pressed: b.getAttribute('aria-pressed'), upright: document.getElementById('l-upright').checked,
    mode: typeof mode !== 'undefined' ? mode : null,
    label: { fontSize: cs.fontSize, color: cs.color, btnBg: bs.backgroundColor },
  };
});

async function run(L, device) {
  const d = await L.device({ device, profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 30000 });
  await sleep(600);
  await f.evaluate(() => document.querySelector('.mapbox').scrollIntoView({ block: 'start' })); await sleep(400);
  const before = await probe(f);
  let afterTap = null;
  if (before.inViewport && before.wrapDisplay !== 'none') {
    // a real pointer tap at the button's centre, through the shell's iframe
    const fr = await (await f.frameElement()).boundingBox();
    await d.page.mouse.click(fr.x + before.rect.x + before.rect.w / 2, fr.y + before.rect.y + before.rect.h / 2);
    await sleep(600);
    afterTap = await probe(f);
  }
  const res = { before, afterTap };
  if (device === 'ipad-portrait') {
    { const fr = await (await f.frameElement()).boundingBox(); const b = await f.evaluate(() => document.getElementById('lv-north').getBoundingClientRect().top); const y = Math.max(0, Math.round(fr.y + b - 420)); await d.page.screenshot({ path: path.join(EV, 'verify-dead-north-button-1-ipad-2d.png'), scale: 'css', animations: 'disabled', caret: 'hide', clip: { x: 0, y, width: 820, height: 520 } }); }
    // control: the view-menu "map up" toggle does rotate (so rotation works in this flavor; only the N button is unwired)
    const ctl = await f.evaluate(async () => { const up = document.getElementById('l-upright'); up.checked = true; up.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 400)); const r1 = window.ROT; up.checked = false; up.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 400)); return { ROTwithUpright: r1, ROTafterOff: window.ROT }; });
    res.uprightToggleControl = ctl;
    // 3D
    await f.evaluate(() => document.getElementById('m-3d').click());
    await f.waitForFunction(() => (typeof three !== 'undefined' && three) || /failed/.test(document.getElementById('view3d').textContent), null, { timeout: 90000 });
    await sleep(1500);
    await f.evaluate(() => document.querySelector('.mapbox').scrollIntoView({ block: 'start' })); await sleep(400);
    res.in3d = await probe(f);
    { const fr = await (await f.frameElement()).boundingBox(); const b = await f.evaluate(() => document.getElementById('lv-north').getBoundingClientRect().top); const y = Math.max(0, Math.round(fr.y + b - 420)); await d.page.screenshot({ path: path.join(EV, 'verify-dead-north-button-1-ipad-3d.png'), scale: 'css', animations: 'disabled', caret: 'hide', clip: { x: 0, y, width: 820, height: 520 } }); }
  }
  await d.close?.();
  return res;
}

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const dev of ['ipad-portrait', 'desktop', 'iphone-pwa']) log(dev, await run(L, dev));
} catch (e) { console.error('ERROR', e); out.error = String(e && e.stack || e); }
finally {
  fs.writeFileSync(path.join(EV, 'verify-dead-north-button-1.json'), JSON.stringify(out, null, 1));
  await L.close();
}
