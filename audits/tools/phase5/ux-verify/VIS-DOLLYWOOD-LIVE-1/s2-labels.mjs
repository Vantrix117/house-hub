// s2: measure how much of each family name pill is covered by later-painted family markers, park + overflow, iPhone + iPad.
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/VIS-DOLLYWOOD-LIVE-1/s2');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
for (const variant of ['park', 'overflow']) {
  const L = await local({ variant, clock: 'demo', engine: 'webkit' });
  try {
    for (const device of ['iphone-pwa', 'ipad-portrait']) {
      const d = await L.device({ device, profile: 'eli' });
      const f = await d.openApp('dollywood-live', { wait: '.famk' });
      await sleep(2500);
      const m = await f.evaluate(() => {
        const gs = [...document.querySelectorAll('.famk')];
        const vw = innerWidth;
        const rect = r => ({ l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height });
        const items = gs.map(g => {
          const pill = g.querySelector('rect'), lab = g.querySelector('text.famlab, text.lab'), dot = g.querySelector('circle');
          return { pick: g.dataset.pick, name: lab && lab.textContent, pill: pill && rect(pill.getBoundingClientRect()), lab: lab && rect(lab.getBoundingClientRect()), dot: dot && rect(dot.getBoundingClientRect()), edge: g.classList.contains('lv-edge') };
        });
        const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
        // coverage of each label's text box by any later-painted group's pill or dot (approximate: box union by sampling)
        return items.map((it, i) => {
          const box = it.lab; if (!box) return it;
          let covered = 0, n = 0;
          for (let x = box.l + 0.5; x < box.r; x += 1) for (let y = box.t + 0.5; y < box.b; y += 1) {
            n++;
            const hit = items.slice(i + 1).some(o => [o.pill, o.dot, o.lab].some(r => r && x >= r.l && x <= r.r && y >= r.t && y <= r.b));
            if (hit) covered++;
          }
          const offLeft = Math.max(0, -box.l), offRight = Math.max(0, box.r - vw);
          return { ...it, labCoveredPct: n ? Math.round(100 * covered / n) : 0, clippedPx: Math.round(offLeft + offRight) };
        });
      });
      const scale = await f.evaluate(() => { const s = document.querySelector('.scale, #scale, [class*=scale]'); return s ? s.textContent.trim() : null; });
      results.push({ variant, device, scale, markers: m.map(x => ({ pick: x.pick, name: x.name, edge: x.edge, pillW: x.pill && Math.round(x.pill.w), pillH: x.pill && Math.round(x.pill.h), labCoveredPct: x.labCoveredPct, clippedPx: x.clippedPx, labL: x.lab && Math.round(x.lab.l), labT: x.lab && Math.round(x.lab.t) })) });
      await d.shot(path.join(OUT, `${variant}-${device}.png`));
      await d.close();
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(OUT, 'labels.json'), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
