// iPad glanceability: the rendered ink height of the count's digits (canvas measureText actualBoundingBoxAscent with
// the element's computed font), the pill's caps and the Reset label, on the Kitchen iPad (portrait and landscape).
// Heuristic: legible when character height >= viewing distance / 200; 1 CSS px ~ 0.192 mm on an 11-inch iPad
// (2360 px / 2 = 1180 CSS px over ~226 mm). Max distance = height_mm * 200.
// Run: node "audits/tools/phase3/tally/glance.mjs"  -> audits/evidence/p3/tally/glance.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const rows = [];
for (const variant of ['typical', 'overflow']) {
  const L = await local({ variant, clock: 'demo', engine: 'webkit' });
  try {
    for (const device of ['ipad-portrait', 'ipad-landscape']) for (const profile of ['eli', 'ezra']) {
      const d = await L.device({ device, profile });
      const f = await d.openApp('tally', { wait: '.dial' });
      await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 }); await sleep(400);
      const m = await f.evaluate(() => {
        const cx = document.createElement('canvas').getContext('2d');
        const ink = (sel, text) => { const el = document.querySelector(sel); const c = getComputedStyle(el); cx.font = `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`; const t = text || (c.textTransform === 'uppercase' ? el.textContent.toUpperCase() : el.textContent); const mt = cx.measureText(t.replace(/[^A-Z0-9]/g, '') || t); return { text: t, fs: parseFloat(c.fontSize), inkPx: +mt.actualBoundingBoxAscent.toFixed(1) }; };
        return { count: ink('#n'), who: ink('#who'), reset: ink('#reset', 'R') };
      });
      const mm = px => +(px * 0.192).toFixed(1), metres = px => +(px * 0.192 * 200 / 1000).toFixed(2);
      const row = { variant, device, profile };
      for (const k of ['count', 'who', 'reset']) row[k] = { ...m[k], inkMm: mm(m[k].inkPx), legibleToM: metres(m[k].inkPx) };
      rows.push(row);
      console.log(variant, device, profile, Object.entries(row).filter(([k]) => ['count', 'who', 'reset'].includes(k)).map(([k, v]) => `${k} "${v.text.slice(0, 16)}" ${v.fs}px ink ${v.inkPx}px = ${v.inkMm} mm -> ${v.legibleToM} m`).join(' | '));
      await d.close();
    }
  } finally { await L.close(); }
}
fs.writeFileSync(`${OUT}/glance.json`, JSON.stringify(rows, null, 1));
