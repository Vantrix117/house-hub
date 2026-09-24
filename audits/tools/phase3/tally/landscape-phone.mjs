// iPhone turned sideways (932x430 CSS, not in the rig's matrix): body is a centred grid of height 100% (tally.html:11, 22),
// so content taller than the frame overflows above the top edge, where it cannot be scrolled to.
// Measures, for Eli and Ezra, the dial/+/Reset rects, the frame height, and how far the top is cut; tries scrolling.
// Run: node "audits/tools/phase3/tally/landscape-phone.mjs"  -> audits/evidence/p3/tally/landscape-phone.json (+ PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const rows = [];
try {
  for (const profile of ['eli', 'ezra']) {
    const d = await L.device({ device: 'iphone-pwa', profile });
    await d.page.setViewportSize({ width: 932, height: 430 });
    const f = await d.openApp('tally', { wait: '.dial' });
    await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 }); await sleep(500);
    const m = await f.evaluate(() => {
      const R = s => { const r = document.querySelector(s).getBoundingClientRect(); return { y: Math.round(r.y), b: Math.round(r.bottom), h: Math.round(r.height) }; };
      const before = { dial: R('.dial'), plus: R('#plus'), reset: R('#reset'), who: R('#who') };
      window.scrollTo(0, -500); document.scrollingElement.scrollTop = 0;
      const top = R('.dial').y;
      document.scrollingElement.scrollTop = 10000;
      const after = { dial: R('.dial'), reset: R('#reset'), scrollTop: document.scrollingElement.scrollTop, scrollH: document.scrollingElement.scrollHeight };
      document.scrollingElement.scrollTop = 0;
      return { vh: innerHeight, before, dialTopAtScroll0: top, after, cutAboveTop: Math.max(0, -top) };
    });
    rows.push({ profile, ...m });
    console.log(profile, JSON.stringify(m));
    await d.page.screenshot({ path: `${OUT}/landscape-phone-${profile}.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    await d.close();
  }
} finally { fs.writeFileSync(`${OUT}/landscape-phone.json`, JSON.stringify(rows, null, 1)); await L.close(); }
