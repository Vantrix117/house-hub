// Phase 5 ux-verify, skeptic s2, UX-DOLLYWOOD-2: on iPad portrait and desktop, do the build card's Next / Show on map
// move a map the reader cannot see? Two reading positions are tried: the card centred (as Phase 3 did) and the minimal
// scroll that brings the whole card, buttons included, on screen (the most map-friendly way to read it). For each, the
// map's visible rows and the highlighted step target's on-screen rect are recorded before and after Next and Show on map.
//   node "audits/tools/phase5/ux-verify/UX-DOLLYWOOD-2/s2-card-moves-hidden-map.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p5/ux-verify/UX-DOLLYWOOD-2/s2');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };

const measure = f => f.evaluate(() => {
  const mb = document.querySelector('.mapbox').getBoundingClientRect();
  const hl = G.hl.getBoundingClientRect();
  const visTop = Math.max(0, mb.top), visBot = Math.min(innerHeight, mb.bottom);
  const cy = hl.top + hl.height / 2, cx = hl.left + hl.width / 2;
  return {
    scrollY: Math.round(scrollY), vh: innerHeight, mapTop: Math.round(mb.top), mapBottom: Math.round(mb.bottom), mapH: Math.round(mb.height),
    mapVisiblePx: Math.round(Math.max(0, visBot - visTop)),
    target: { top: Math.round(hl.top), bottom: Math.round(hl.bottom), h: Math.round(hl.height), centreY: Math.round(cy),
      centreOnScreen: hl.height > 0 && cy >= Math.max(0, mb.top) && cy <= Math.min(innerHeight, mb.bottom) && cx >= mb.left && cx <= mb.right,
      anyPartOnScreen: hl.height > 0 && hl.bottom > Math.max(0, mb.top) && hl.top < Math.min(innerHeight, mb.bottom) },
    view: view.map(Math.round), step: (document.querySelector('#b-now h3') || {}).textContent,
    cardTop: Math.round(document.getElementById('b-now').getBoundingClientRect().top),
    buttonsBottom: Math.round(document.querySelector('#b-now .bctl').getBoundingClientRect().bottom),
  };
});

async function run(L, device) {
  const d = await L.device({ device, profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  await sleep(600);
  const r = { atOpen: await measure(f) };
  for (const pos of ['minimal', 'centre']) {
    await f.evaluate(p => { window.scrollTo(0, 0); const n = document.getElementById('b-now');
      if (p === 'centre') n.scrollIntoView({ block: 'center' });
      else { const b = document.querySelector('#b-now .bctl').getBoundingClientRect().bottom + scrollY; window.scrollTo(0, Math.max(0, b - innerHeight + 12)); } }, pos);
    await sleep(500);
    const before = await measure(f);
    await f.evaluate(() => document.getElementById('b-next').click()); await sleep(1200);
    const afterNext = await measure(f);
    await d.page.screenshot({ path: path.join(EV, `${device}-${pos}-after-next.png`), animations: 'disabled', caret: 'hide' }).catch(() => {});
    await f.evaluate(() => document.getElementById('b-show').click()); await sleep(1200);
    const afterShow = await measure(f);
    await f.evaluate(() => document.getElementById('b-prev').click()); await sleep(800);
    r[pos] = { before, afterNext, afterShow };
  }
  await d.close();
  return r;
}

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const dev of (process.argv[2] ? process.argv[2].split(',') : ['ipad-portrait', 'desktop'])) log(dev, await run(L, dev));
} finally {
  fs.writeFileSync(path.join(EV, process.argv[2] ? 'result-' + process.argv[2] + '.json' : 'result.json'), JSON.stringify(out, null, 1));
  await L.close();
}
