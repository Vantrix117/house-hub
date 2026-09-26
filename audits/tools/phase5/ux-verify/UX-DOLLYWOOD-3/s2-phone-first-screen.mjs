// Phase 5 ux-verify, skeptic s2, UX-DOLLYWOOD-3: what a phone's first screen of the build guide shows, recomputed, and what
// one scroll to the map (the app's own mapIntoView position) shows. Markers counted as the Phase 3 check did, plus the
// share of the built park's bounding box (D.layers.allbox, via the rendered #official markers' extent) between map top and sheet.
//   node "audits/tools/phase5/ux-verify/UX-DOLLYWOOD-3/s2-phone-first-screen.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p5/ux-verify/UX-DOLLYWOOD-3/s2');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const measure = f => f.evaluate(() => {
  const mb = document.querySelector('.mapbox').getBoundingClientRect(), sh = document.getElementById('build').getBoundingClientRect();
  const bandTop = Math.max(0, mb.top), bandBot = Math.min(sh.top, mb.bottom, innerHeight);
  const mks = [...document.querySelectorAll('#official .mk')].map(m => m.getBoundingClientRect()).filter(r => r.width);
  const inBand = mks.filter(r => r.top >= bandTop && r.bottom <= bandBot && r.left >= 0 && r.right <= innerWidth).length;
  const underSheet = mks.filter(r => r.top + r.height / 2 > sh.top).length;
  const ys = mks.map(r => r.top + r.height / 2), yMin = Math.min(...ys), yMax = Math.max(...ys);
  const parkVisibleFrac = Math.max(0, Math.min(yMax, bandBot) - Math.max(yMin, bandTop)) / (yMax - yMin);
  const chips = [...document.querySelectorAll('#chips button')].map(c => c.getBoundingClientRect());
  return { vh: innerHeight, scrollY: Math.round(scrollY), mapTop: Math.round(mb.top), sheetTop: Math.round(sh.top), bandPx: Math.round(bandBot - bandTop),
    markers: mks.length, markersInBand: inBand, markersUnderSheet: underSheet, markerExtentY: [Math.round(yMin), Math.round(yMax)], parkVerticalExtentVisible: +parkVisibleFrac.toFixed(2),
    chipRows: new Set(chips.map(c => Math.round(c.top))).size, chipsTotal: chips.length, chipsFullyVisible: chips.filter(c => c.left >= 0 && c.right <= innerWidth).length,
    headerH: Math.round(document.querySelector('header').getBoundingClientRect().height) };
});

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'iphone-safari']) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await sleep(800);
    const first = await measure(f);
    await d.page.screenshot({ path: path.join(EV, `${device}-first-screen.png`), animations: 'disabled', caret: 'hide' }).catch(() => {});
    await f.evaluate(() => { const mb = document.querySelector('.mapbox'), tb = document.getElementById('toolbar'); window.scrollTo(0, mb.getBoundingClientRect().top + scrollY - (tb ? tb.offsetHeight : 0) - 6); });
    await sleep(800);
    const afterOneScroll = await measure(f);
    await d.page.screenshot({ path: path.join(EV, `${device}-after-scroll-to-map.png`), animations: 'disabled', caret: 'hide' }).catch(() => {});
    log(device, { first, afterOneScroll });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'result.json'), JSON.stringify(out, null, 1));
  await L.close();
}
