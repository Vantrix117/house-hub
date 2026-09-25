// Phase 4 MOTION skeptic #1 — verify "park-map-located-idle-pulses": located + sharing on a park day, which infinite
// animations run on the park map, what they cost on the main thread (CDP TaskDuration / RecalcStyleCount / LayoutCount),
// and an ablation: pause each animation group in turn (animation-play-state: paused) to see which one carries the cost.
// Also: not located (GPS never granted) and reduced motion. Chromium, variant 'park', real clock, iPhone PWA, Eli.
//   node "audits/tools/phase4/MOTION/verify-park-map-located-idle-pulses-1.mjs"
//     → audits/evidence/p4/MOTION/verify-park-map-located-idle-pulses-1.json (+ -located.png)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const ARM = process.env.ARM || 'ABC';   // ARM=D: explicit-selector cross-check only → -1-crosscheck.json
const OUT = path.join(EV, ARM === 'D' ? 'verify-park-map-located-idle-pulses-1-crosscheck.json' : 'verify-park-map-located-idle-pulses-1.json');
const WIN = 8000;
const out = { method: 'CDP Performance.getMetrics delta over ' + WIN + ' ms windows, page idle (no input)', arms: {} };
const L = await local({ variant: 'park', clock: 'real', engine: 'chromium' });
const inv = () => {
  const run = document.getAnimations().filter(a => a.playState === 'running');
  return { gps: document.getElementById('loc-btn')?.dataset.gps, pill: document.getElementById('lv-pill')?.dataset.state,
    running: run.map(a => `${a.animationName}@${a.effect.target?.id || a.effect.target?.getAttribute?.('class') || a.effect.target?.tagName} ${a.effect.getComputedTiming().duration}ms x${a.effect.getComputedTiming().iterations}`) };
};
async function measure(d, cdp) {
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const a = await m(); await sleep(WIN); const b = await m();
  const s = WIN / 1000;
  return { busyPct: +(((b.TaskDuration - a.TaskDuration) / s) * 100).toFixed(1), stylePerSec: +((b.RecalcStyleCount - a.RecalcStyleCount) / s).toFixed(1),
    layoutPerSec: +((b.LayoutCount - a.LayoutCount) / s).toFixed(1), scriptPct: +(((b.ScriptDuration - a.ScriptDuration) / s) * 100).toFixed(1) };
}
async function open(rm, locate) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  if (locate) await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await d.page.emulateMedia({ reducedMotion: rm });
  await d.page.goto(L.site + '/apps/dollywood-live.html', { waitUntil: 'load' });
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && window.D && D.geo, null, { timeout: 20000 }).catch(() => {});
  if (locate) {
    const ll = await d.page.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [762, 842]);
    await d.ctx.setGeolocation({ ...ll, accuracy: 6 });
    await sleep(1500);
    const g = await d.page.evaluate(() => document.getElementById('loc-btn')?.dataset.gps);
    if (g !== 'on') await d.page.click('#loc-btn').catch(() => {});
  }
  await sleep(4000);
  const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Performance.enable');
  return { d, cdp };
}
const pause = (d, sel) => d.page.evaluate(sel => { let s = document.getElementById('__v1pause'); if (!s) { s = document.createElement('style'); s.id = '__v1pause'; document.head.appendChild(s); } s.textContent = sel ? sel + '{animation-play-state:paused!important}' : ''; }, sel);
try {
  if (ARM === 'D') {
    // Arm D: fresh page, explicit selectors: box-shadow pulses paused, SVG pulses left running; then the reverse
    const { d, cdp } = await open('no-preference', true);
    const D2 = { state: await d.page.evaluate(inv), all: await measure(d, cdp) };
    const run = () => d.page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName));
    await pause(d, '.lv-live,.fab-primary'); await sleep(500);
    D2.boxShadowPaused_svgRunning = { stillRunning: await run(), ...(await measure(d, cdp)) };
    await pause(d, '.me-pulse,.me-pulse2'); await sleep(500);
    D2.svgPaused_boxShadowRunning = { stillRunning: await run(), ...(await measure(d, cdp)) };
    await pause(d, '');
    D2.resumed = await measure(d, cdp);
    out.arms.crosscheck = D2; console.log('D', JSON.stringify(D2));
    await d.close();
  }
  // Arm A: located, no-preference, with ablation
  if (ARM !== 'D') {
    const { d, cdp } = await open('no-preference', true);
    const A = { state: await d.page.evaluate(inv) };
    A.all_run1 = await measure(d, cdp);
    A.all_run2 = await measure(d, cdp);
    const groups = { mepulse: '.me-pulse,.me-pulse2', lvlive: '.lv-live', fabring: '.fab-primary', all: '*,*::before,*::after' };
    A.ablation = {};
    for (const [k, sel] of Object.entries(groups)) {
      await pause(d, sel); await sleep(500);
      A.ablation['paused_' + k] = { stillRunning: (await d.page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName))), ...(await measure(d, cdp)) };
    }
    // only one group running at a time
    for (const [k, sel] of Object.entries({ only_mepulse: ':not(.me-pulse):not(.me-pulse2)', only_lvlive: ':not(.lv-live)', only_fabring: ':not(.fab-primary)' })) {
      await pause(d, sel); await sleep(500);
      A.ablation[k] = { stillRunning: (await d.page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName))), ...(await measure(d, cdp)) };
    }
    await pause(d, '');
    await d.page.screenshot({ path: path.join(EV, 'verify-park-map-located-idle-pulses-1-located.png'), scale: 'css', animations: 'disabled' }).catch(() => {});
    out.arms.located_noPreference = A; console.log('A', JSON.stringify(A));
    await d.close();
  }
  // Arm B: located, reduce
  if (ARM !== 'D') {
    const { d, cdp } = await open('reduce', true);
    const B = { state: await d.page.evaluate(inv), ...(await measure(d, cdp)) };
    out.arms.located_reduce = B; console.log('B', JSON.stringify(B));
    await d.close();
  }
  // Arm C: not located (no geolocation permission), no-preference
  if (ARM !== 'D') {
    const { d, cdp } = await open('no-preference', false);
    const C = { state: await d.page.evaluate(inv), ...(await measure(d, cdp)) };
    out.arms.notLocated_noPreference = C; console.log('C', JSON.stringify(C));
    await d.close();
  }
} catch (e) { out.error = String(e && e.stack || e); console.error(e); }
finally {
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  await L.close();
}
