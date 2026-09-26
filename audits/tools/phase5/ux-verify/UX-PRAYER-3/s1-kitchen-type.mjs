// UX-PRAYER-3 skeptic s1: Kitchen view and Today type on the iPad (landscape), measured font size and cap height,
// then readable distance under two thresholds: comfortable (cap >= d/200, ~17 arcmin) and minimum (cap >= d/344, ~10 arcmin).
// 1 CSS px = 0.192 mm on an 11-inch iPad Air (264 ppi, 2x).
// Run: node audits/tools/phase5/ux-verify/UX-PRAYER-3/s1-kitchen-type.mjs
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/UX-PRAYER-3/s1';
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  const d = await L.device({ device: 'ipad-landscape', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(700);
  const meas = sels => f.evaluate(sels => { const cv = document.createElement('canvas').getContext('2d'); const o = {};
    for (const [k, s] of Object.entries(sels)) { const e = document.querySelector(s); if (!e) { o[k] = null; continue; } const c = getComputedStyle(e);
      cv.font = `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`; o[k] = { fs: parseFloat(c.fontSize), cap: +cv.measureText('H').actualBoundingBoxAscent.toFixed(1), ff: c.fontFamily.split(',')[0] }; } return o; }, sels);
  out.today = await meas({ h1: '#todayLine', title: '#todayList .title', meta: '#todayList .meta', nav: 'nav button' });
  await f.click('#moreBtn'); await sleep(300);
  out.moreLabel = await f.evaluate(() => document.querySelector('[data-more="kitchen"]').textContent);
  await f.click('[data-more="kitchen"]'); await sleep(500);
  out.kitchen = await meas({ h1: '#kitchen h1', item: '#kitchen .k-item', cat: '#kitchen .k-cat', for: '#kitchen .k-for' });
  out.kitchenItems = await f.evaluate(() => document.querySelectorAll('#kitchen .k-item').length);
  await d.shot(`${OUT}/kitchen-ipad-landscape.png`);
  const MM = 0.192;
  out.distances = {};
  for (const [grp, o] of Object.entries({ today: out.today, kitchen: out.kitchen })) for (const [k, t] of Object.entries(o)) if (t)
    out.distances[grp + '.' + k] = { comfortable_m: +(t.cap * MM * 200 / 1000).toFixed(2), minimum_m: +(t.cap * MM * 344 / 1000).toFixed(2) };
  const capRatio = out.kitchen.item.cap / out.kitchen.item.fs;
  out.fontSizeNeeded = Object.fromEntries([2, 3].map(m => [m + 'm', { comfortable_px: Math.round(m * 1000 / 200 / MM / capRatio), minimum_px: Math.round(m * 1000 / 344 / MM / capRatio) }]));
  console.log(JSON.stringify(out, null, 1));
  await d.close();
} catch (e) { console.error(e); out.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/kitchen-type.json`, JSON.stringify(out, null, 1)); await L.close(); }
