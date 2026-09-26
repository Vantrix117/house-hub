// s2: park variant, iPhone: is Elizabeth's marker still visible/tappable under Ezra's, and at what zoom do they separate?
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/VIS-DOLLYWOOD-LIVE-1/s2');
const L = await local({ variant: 'park', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const f = await d.openApp('dollywood-live', { wait: '.famk' });
  await sleep(2500);
  const r = await f.evaluate(() => {
    const g = id => document.querySelector(`.famk[data-pick="f:${id}"]`);
    const out = {};
    for (const id of ['mom', 'ezra', 'christian']) {
      const c = g(id).querySelector('circle').getBoundingClientRect();
      const pts = [];
      for (let dx = -0.4; dx <= 0.41; dx += 0.2) for (let dy = -0.4; dy <= 0.41; dy += 0.2) {
        const x = c.left + c.width * (0.5 + dx), y = c.top + c.height * (0.5 + dy);
        const hit = document.elementFromPoint(x, y); const grp = hit && hit.closest('[data-pick]');
        pts.push(grp ? grp.dataset.pick : null);
      }
      out[id] = { dotW: Math.round(c.width), centre: [Math.round(c.left + c.width / 2), Math.round(c.top + c.height / 2)], hitsOwn: pts.filter(p => p === 'f:' + id).length, samples: pts.length, others: [...new Set(pts.filter(p => p !== 'f:' + id))] };
    }
    const a = out.mom.centre, b = out.ezra.centre; out.centreGapPx = Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]));
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  fs.writeFileSync(path.join(OUT, 'dots-park-iphone.json'), JSON.stringify(r, null, 1));
  await d.close();
} finally { await L.close(); }
