// Phase 4 MOTION — do JS smooth scrolls (behavior:'smooth') still animate under Reduce Motion? The app CSS rules for
// reduced motion only cover transitions and animations (apps/design.css:611-613, apps/f260.html:476,
// apps/dollywood*.html:139); F260 and the Dollywood pair scroll with behavior:'smooth' from JS without checking.
// Opens F260 standalone (a long page) in WebKit and Chromium with reduce and with no-preference, fires F260's own
// "reflect" jump (apps/f260.html:1474, scrollIntoView smooth) and samples the scroll position every 16 ms for 600 ms.
//   node "audits/tools/phase4/MOTION/rm-smooth.mjs"  → audits/evidence/p4/MOTION/rm-smooth.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const out = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const rm of ['no-preference', 'reduce']) {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
      await d.page.emulateMedia({ reducedMotion: rm });
      await d.page.goto(L.site + '/apps/f260.html', { waitUntil: 'load' });
      await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      const r = await d.page.evaluate(async () => {
        const btn = document.getElementById('reflectBtn'); const target = document.getElementById('reflect');
        if (!btn || !target) return { err: 'reflectBtn/reflect missing' };
        const se = document.scrollingElement; const y0 = se.scrollTop; const samples = [];
        btn.click();
        const t0 = performance.now();
        await new Promise(res => { const tick = () => { samples.push([Math.round(performance.now() - t0), Math.round(se.scrollTop)]); if (performance.now() - t0 < 600) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
        const final = samples[samples.length - 1][1];
        const intermediate = samples.filter(([, y]) => y !== y0 && y !== final).length;
        return { y0, final, framesInBetween: intermediate, first5: samples.slice(0, 5) };
      });
      out[`${engine}-${rm}`] = r;
      console.log(engine, rm, JSON.stringify(r));
      await d.close();
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, 'rm-smooth.json'), JSON.stringify(out, null, 1));
