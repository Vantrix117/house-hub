// UX-LEFTOVERS-3, skeptic s1: recompute cap heights in the Larder on the Kitchen iPad (portrait and landscape) with
// canvas measureText('H').actualBoundingBoxAscent in each element's computed font, converted at 0.1924 mm per CSS px
// (iPad Air 11", 264 ppi, DPR 2). Checked against Phase 2's H1 (d/200) and H2 (d/344) at 0.5 m, 1 m, 2 m and 3 m.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p5/ux-verify/UX-LEFTOVERS-3/s1');
fs.mkdirSync(OUT, { recursive: true });
const MM = 0.1924;
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { mmPerCssPx: MM, heuristics: {} };
for (const m of [0.5, 1, 2, 3]) out.heuristics[m + 'm'] = { H1mm: +(m * 1000 / 200).toFixed(2), H2mm: +(m * 1000 / 344).toFixed(2) };
try {
  for (const device of ['ipad-portrait', 'ipad-landscape']) {
    const d = await L.device({ device, profile: 'eli' });
    const f = await d.openApp('leftovers');
    await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
    await sleep(800);
    const m = await f.evaluate(() => {
      const c = document.createElement('canvas').getContext('2d');
      const sel = { title: 'h1', tally: '.tally', lede: '.lede', alert: '.alert', groupTitle: '.group h2', groupSub: '.group h2 small', name: '.nm', meta: '.meta', chip: '.status' };
      const r = {};
      for (const [k, s] of Object.entries(sel)) {
        const el = document.querySelector(s); if (!el) continue;
        const cs = getComputedStyle(el);
        c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const cap = c.measureText('H').actualBoundingBoxAscent;
        r[k] = { px: parseFloat(cs.fontSize), capPx: +cap.toFixed(2), ratio: +(cap / parseFloat(cs.fontSize)).toFixed(3), text: el.textContent.trim().slice(0, 40) };
      }
      r.frameWidth = innerWidth;
      return r;
    });
    for (const [k, v] of Object.entries(m)) {
      if (typeof v !== 'object') continue;
      v.capMm = +(v.capPx * MM).toFixed(2);
      for (const dist of [0.5, 1, 2, 3]) v['at' + dist + 'm'] = v.capMm >= dist * 1000 / 200 ? 'H1 pass' : v.capMm >= dist * 1000 / 344 ? 'H2 only' : 'fail';
    }
    out[device] = m;
    await d.shot(path.join(OUT, `larder-${device}.png`));
    await d.close();
  }
  fs.writeFileSync(path.join(OUT, 'caps.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
} finally { await L.close(); }
