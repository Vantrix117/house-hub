// Skeptic #1: does the build guide's "?" help popover open off the left edge on phones?
//   node "audits/tools/phase3/dollywood/verify-help-popover-offscreen-phone-1.mjs"
// Opens apps/dollywood.html in the hub viewer as Eli (typical seed), on iphone-pwa, iphone-safari and ipad-portrait (control),
// scrolls the "?" into view, taps it with a real pointer tap at its centre, and measures #help-pop, .helpwrap and the viewport.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const P = 'verify-help-popover-offscreen-phone-1';
const out = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'iphone-safari', 'ipad-portrait']) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await sleep(500);
    await f.evaluate(() => document.getElementById('help-btn').scrollIntoView({ block: 'center' })); await sleep(400);
    const btn = await f.evaluate(() => { const r = document.getElementById('help-btn').getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), hitAtCentre: hit ? (hit.id || String(hit.className) || hit.tagName) : null }; });
    // real tap through the parent page's mouse at the button's centre
    const fr = await (await f.frameElement()).boundingBox();
    await d.page.mouse.click(fr.x + btn.x + btn.w / 2, fr.y + btn.y + btn.h / 2); await sleep(400);
    const m = await f.evaluate(() => {
      const p = document.getElementById('help-pop'), w = document.querySelector('.helpwrap'), cs = getComputedStyle(p);
      const r = p.getBoundingClientRect(), rw = w.getBoundingClientRect();
      const visW = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      return { hidden: p.hidden, flavor: document.documentElement.dataset.flavor, vw: innerWidth, vh: innerHeight,
        pop: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) },
        visibleWidthPx: Math.round(visW), visibleFraction: +(visW / r.width).toFixed(2),
        cssLeft: cs.left, cssRight: cs.right, wrap: { x: Math.round(rw.x), right: Math.round(rw.right) },
        text: p.innerText.replace(/\s+/g, ' ').slice(0, 200) };
    });
    out[device] = { btn, ...m };
    console.log(device, JSON.stringify(out[device]));
    if (device === 'iphone-pwa') await d.page.screenshot({ path: path.join(EV, `${P}-${device}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
  }
  fs.writeFileSync(path.join(EV, `${P}.json`), JSON.stringify(out, null, 2));
} finally { await L.close(); }
