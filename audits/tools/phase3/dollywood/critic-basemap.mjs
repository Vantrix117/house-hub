// Phase 3 / dollywood — completeness critic: lead audits/01-leads.md:345 says switching basemap on a phone "re-fits to
// the whole frame instead of keeping the phone fit". The bmap handler (apps/dollywood.html:1032) has no fit call; this
// reads the view box before and after each basemap on the iPhone PWA.
//   node "audits/tools/phase3/dollywood/critic-basemap.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const L = await local({ variant: 'typical', engine: 'webkit' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 30000 }); await sleep(1000);
  const v = () => f.evaluate(() => ({ view: view.map(x => Math.round(x)), vb: document.getElementById('map').getAttribute('viewBox') }));
  out.boot = await v();
  for (const bm of ['aerial', 'mix', 'official', 'relief']) {
    await f.evaluate(b => { const s = document.getElementById('bmap'); s.value = b; s.dispatchEvent(new Event('change')); }, bm); await sleep(1200);
    out[bm] = await v();
  }
  console.log(JSON.stringify(out));
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, 'critic-basemap.json'), JSON.stringify(out, null, 1));
  await L.close();
}
