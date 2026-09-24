// Phase 3 / dollywood: main-thread cost of the build guide sitting idle in 2D (nobody touching it), in Chromium via CDP.
// Arms: A as shipped (the current step's target pulses: CSS animation hlring on #hl .hl-ring, apps/dollywood.html:282-283);
//       B the same page with that one animation switched off by an injected rule; C the highlight cleared (highlight(null)).
// Also counts style recalcs / layouts per second (CDP metrics RecalcStyleCount, LayoutCount).
//   node "audits/tools/phase3/dollywood/perf-idle.mjs" [ipad-portrait|desktop]
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const devs = process.argv.slice(2).length ? process.argv.slice(2) : ['ipad-portrait', 'desktop'];
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  for (const dev of devs) {
    const d = await L.device({ device: dev, profile: 'eli', fixedTime: false });
    await d.page.goto(L.site + '/apps/dollywood.html');
    await d.page.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
    await sleep(3000);
    const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Performance.enable');
    const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    const idle = async ms => { const a = await m(); await sleep(ms); const b = await m(); const s = ms / 1000;
      return { busyPct: +(((b.TaskDuration - a.TaskDuration) / s) * 100).toFixed(1), scriptPct: +(((b.ScriptDuration - a.ScriptDuration) / s) * 100).toFixed(1), stylePerSec: +((b.RecalcStyleCount - a.RecalcStyleCount) / s).toFixed(1), layoutPerSec: +((b.LayoutCount - a.LayoutCount) / s).toFixed(1) }; };
    const state = await d.page.evaluate(() => ({ hlRings: document.querySelectorAll('#hl .hl-ring').length, anim: (document.querySelector('#hl .hl-ring') ? getComputedStyle(document.querySelector('#hl .hl-ring')).animationName : null), svgNodes: document.querySelectorAll('svg#map *').length }));
    const A = await idle(10000);
    await d.page.addStyleTag({ content: '#hl .hl-ring{animation:none!important}' }); await sleep(1500);
    const B = await idle(10000);
    await d.page.evaluate(() => highlight(null)); await sleep(1500);
    const C = await idle(10000);
    log(dev, { state, A_asShipped: A, B_pulseOff: B, C_noHighlight: C });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'perf-idle.json'), JSON.stringify(out, null, 1));
  await L.close();
}
