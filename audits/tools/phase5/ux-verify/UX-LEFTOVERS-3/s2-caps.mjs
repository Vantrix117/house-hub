// Skeptic s2, UX-LEFTOVERS-3: recompute cap heights of the Larder's text on the iPad (0.1924 mm per CSS px, canvas
// measureText('H') in each element's own font), and check whether the shell ever leaves the Larder on screen unattended
// (an idle return to Home) — i.e. whether the Larder is an across-the-room surface at all. No writes.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/UX-LEFTOVERS-3/s2');
fs.mkdirSync(OUT, { recursive: true });
const MM = 0.1924;
const SEL = ['h1', '.tally', '.lede', '.alert', '.group h2', '.group h2 small', '.nm', '.meta', '.status'];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { mmPerCssPx: MM, rows: {} };
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0);
  await sleep(1200);
  const m = await f.evaluate(SEL => {
    const c = document.createElement('canvas').getContext('2d');
    const r = {};
    for (const s of SEL) {
      const e = s === '.alert' ? document.querySelector('.alert') : document.querySelector(s);
      if (!e) { r[s] = null; continue; }
      const cs = getComputedStyle(e);
      c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const t = c.measureText('H');
      r[s] = { px: parseFloat(cs.fontSize), capPx: t.actualBoundingBoxAscent, text: e.textContent.trim().slice(0, 50) };
    }
    return r;
  }, SEL);
  for (const [s, v] of Object.entries(m)) {
    if (!v) { out.rows[s] = null; continue; }
    const mm = +(v.capPx * MM).toFixed(2);
    out.rows[s] = { ...v, capMm: mm, H1at2m: mm >= 10 ? 'pass' : 'fail', H2at2m: mm >= 5.8 ? 'pass' : 'fail', H2at1m: mm >= 2.9 ? 'pass' : 'fail' };
  }
  // Leave the Larder open on the iPad for 3 simulated minutes of no input: does the shell go back to Home?
  const hashBefore = await d.page.evaluate(() => location.hash);
  await sleep(4000);
  out.idle = { hashBefore, hashAfter4s: await d.page.evaluate(() => location.hash) };
  await d.shot(path.join(OUT, 'larder-ipad-portrait.png'));
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(OUT, 'caps.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
