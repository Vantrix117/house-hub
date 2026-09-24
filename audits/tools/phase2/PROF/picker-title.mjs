// PROF (audit Phase 2), lead "Profile picker cuts off its own title on iPhone": is the title hidden at open, and can
// the user scroll up to it? Runs the signed-out picker on iPhone sizes in WebKit and in Chromium (installed Chrome).
//
//   node "audits/tools/phase2/PROF/picker-title.mjs"
//
// Evidence: audits/evidence/p2/PROF/picker-title-*.png (at scroll 0 and scrolled fully up) and printed measurements.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
for (const engine of ['webkit', 'chromium']) {
  for (const variant of ['typical', 'overflow']) {
    const L = await local({ variant, clock: 'real', engine });
    try {
      for (const dev of ['iphone-pwa', 'iphone-safari']) {
        if (variant === 'overflow' && dev === 'iphone-safari') continue;
        const d = await L.device({ device: dev, profile: null, fixedTime: false });
        await d.goto(''); await d.page.waitForSelector('#profiles .pcard[data-id]'); await sleep(700);
        const m = await d.page.evaluate(() => {
          const g = document.getElementById('gate'), h1 = document.querySelector('.gate-title h1');
          const atOpen = { scrollTop: g.scrollTop, h1Top: Math.round(h1.getBoundingClientRect().top) };
          g.scrollTop = -10000; const up = { scrollTop: g.scrollTop, h1Top: Math.round(h1.getBoundingClientRect().top) };
          return { atOpen, scrolledFullyUp: up };
        });
        // the same thing with a real wheel/drag-like scroll: mouse wheel upwards over the gate
        await d.page.evaluate(() => { document.getElementById('gate').scrollTop = 0; });
        try { await d.page.mouse.move(200, 400); await d.page.mouse.wheel(0, -2000); await sleep(400); } catch { }   // mobile WebKit has no wheel: the programmatic scroll above stands in
        const wheel = await d.page.evaluate(() => ({ scrollTop: document.getElementById('gate').scrollTop, h1Top: Math.round(document.querySelector('.gate-title h1').getBoundingClientRect().top) }));
        console.log(`${engine.padEnd(8)} ${variant.padEnd(8)} ${dev.padEnd(13)} at open: h1 top ${m.atOpen.h1Top}px (scrollTop ${m.atOpen.scrollTop}) | scrollTop=-10000 → ${m.scrolledFullyUp.scrollTop}, h1 top ${m.scrolledFullyUp.h1Top}px | wheel up → scrollTop ${wheel.scrollTop}, h1 top ${wheel.h1Top}px`);
        if (variant === 'typical' && dev === 'iphone-pwa') {
          await d.page.evaluate(() => { document.getElementById('gate').scrollTop = 0; });
          await d.page.screenshot({ path: path.join(OUT, `picker-title-${engine}-at-open.png`), scale: 'css' });
          await d.page.evaluate(() => { document.getElementById('gate').scrollTop = -10000; });
          await d.page.screenshot({ path: path.join(OUT, `picker-title-${engine}-scrolled-up.png`), scale: 'css' });
        }
        await d.close();
      }
    } finally { await L.close(); }
  }
}
