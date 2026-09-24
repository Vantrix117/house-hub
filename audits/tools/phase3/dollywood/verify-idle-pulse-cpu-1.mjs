// Skeptic #1 for finding "idle-pulse-cpu" (dollywood build guide): does the #hl .hl-ring pulse (apps/dollywood.html:282-283)
// really keep the main thread busy while idle, and is it the map's size or any stroke-opacity animation?
// Arms (Chromium, CDP Performance metrics, 8 s idle each):
//   A  standalone page as shipped             B  same, pulse off by injected rule
//   R  standalone, prefers-reduced-motion      S  inside the shell viewer (openApp) as shipped
//   K  control: a blank page with ONE tiny SVG circle running the same keyframes (rig baseline for any 60 fps SVG anim)
//   node "audits/tools/phase3/dollywood/verify-idle-pulse-cpu-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', engine: 'chromium' });
async function meter(page) {
  const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  return async (ms = 8000) => { const a = await m(); await sleep(ms); const b = await m(); const s = ms / 1000;
    return { busyPct: +(((b.TaskDuration - a.TaskDuration) / s) * 100).toFixed(1), scriptPct: +(((b.ScriptDuration - a.ScriptDuration) / s) * 100).toFixed(1),
      stylePerSec: +((b.RecalcStyleCount - a.RecalcStyleCount) / s).toFixed(1), layoutPerSec: +((b.LayoutCount - a.LayoutCount) / s).toFixed(1) }; };
}
const ready = p => p.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
try {
  // A / B
  let d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.page.goto(L.site + '/apps/dollywood.html'); await ready(d.page); await sleep(3000);
  const st = await d.page.evaluate(() => { const r = document.querySelector('#hl .hl-ring');
    return { hlRings: document.querySelectorAll('#hl .hl-ring').length, anim: r ? getComputedStyle(r).animationName + ' ' + getComputedStyle(r).animationDuration + ' ' + getComputedStyle(r).animationIterationCount : null,
      svgNodes: document.querySelectorAll('svg#map *').length, flavor: document.documentElement.dataset.flavor, runningAnims: document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName || a.constructor.name) }; });
  log('state_standalone', st);
  let idle = await meter(d.page);
  log('A_standalone_asShipped', await idle());
  await d.page.addStyleTag({ content: '#hl .hl-ring{animation:none!important}' }); await sleep(1500);
  log('B_standalone_pulseOff', await idle());
  await d.close();
  // R reduced motion
  d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.page.emulateMedia({ reducedMotion: 'reduce' });
  await d.page.goto(L.site + '/apps/dollywood.html'); await ready(d.page); await sleep(3000);
  log('R_state', await d.page.evaluate(() => ({ running: document.getAnimations().filter(a => a.playState === 'running').length })));
  idle = await meter(d.page); log('R_reducedMotion', await idle()); await d.close();
  // S inside the shell
  d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.goto('#home'); const f = await d.openApp('dollywood');
  await f.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 }); await sleep(3000);
  log('S_state', await f.evaluate(() => ({ hlRings: document.querySelectorAll('#hl .hl-ring').length, running: document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName) })));
  idle = await meter(d.page); log('S_inShell_asShipped', await idle());
  await f.addStyleTag({ content: '#hl .hl-ring{animation:none!important}' }); await sleep(1500);
  log('S2_inShell_pulseOff', await idle());
  await d.close();
  // K control: one tiny circle, same keyframes, on a plain page of the same origin
  d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.page.goto(L.site + '/icons/');
  await d.page.setContent('<style>.r{animation:hlring 2.2s ease-in-out infinite}@keyframes hlring{0%,100%{stroke-opacity:1}50%{stroke-opacity:.45}}</style><svg width="200" height="200"><circle class="r" cx="100" cy="100" r="40" fill="none" stroke="orange" stroke-width="2.2"/></svg>');
  await sleep(1500); idle = await meter(d.page); log('K_control_oneCircle', await idle());
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, 'verify-idle-pulse-cpu-1.json'), JSON.stringify(out, null, 1));
  await L.close();
}
