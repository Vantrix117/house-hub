// Phase 4 MOTION — what a tab switch costs while its indicator animates. The tab indicator moves with a `left`
// (bottom bar) or `top` (sidebar) transition, 360 ms --spring (apps/design.css:567, 575): layout properties that animate
// on the main thread, while showTab re-renders the whole view on the same thread (index.html:634-647). Chromium,
// iPad portrait (bottom bar) and desktop (sidebar), Eli: for each tab tap, the long tasks (>50 ms) and the animation
// frames the indicator actually got during its 360 ms.
//   node "audits/tools/phase4/MOTION/tabswitch.mjs"  → audits/evidence/p4/MOTION/tabswitch.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  for (const device of ['ipad-portrait', 'desktop']) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(1500);
    out[device] = {};
    for (const tab of ['apps', 'me', 'chat', 'home', 'me', 'home']) {
      const r = await d.page.evaluate(async tab => {
        const lt = []; const po = new PerformanceObserver(l => { for (const e of l.getEntries()) lt.push(Math.round(e.duration)); }); po.observe({ type: 'longtask' });
        const ind = document.querySelector('.tab-ind'); const key = getComputedStyle(ind).transitionProperty.includes('top') ? 'top' : 'left';
        const frames = []; const t0 = performance.now();
        document.querySelector(`#tabbar .tab[data-tab="${tab}"]`).click();
        const clickMs = Math.round(performance.now() - t0);
        await new Promise(res => { const f = () => { const t = performance.now() - t0; frames.push([Math.round(t), Math.round(parseFloat(getComputedStyle(ind)[key]))]); if (t < 420) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
        await new Promise(r => setTimeout(r, 300)); po.disconnect();
        let maxGap = 0; for (let i = 1; i < frames.length; i++) maxGap = Math.max(maxGap, frames[i][0] - frames[i - 1][0]);
        const moving = frames.filter(([t]) => t <= 360).length;
        return { key, syncClickHandlerMs: clickMs, longTasks: lt, framesIn360ms: moving, firstFrameAt: frames[0] && frames[0][0], maxFrameGapMs: maxGap };
      }, tab);
      out[device][tab + '#' + Object.keys(out[device]).length] = r;
      console.log(device, tab.padEnd(5), JSON.stringify(r));
      await sleep(600);
    }
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'tabswitch.json'), JSON.stringify(out, null, 1));
  await L.close();
}
