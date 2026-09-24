// Phase 3 / dollywood — skeptic #2 for "idle-pulse-cpu" (the step highlight's infinite pulse keeps the main thread busy while idle).
// Independent of perf-idle.mjs: opens the build guide INSIDE the shell viewer (the way the family opens it), not standalone.
// Chromium arms (CDP Performance.getMetrics, 10 s each, nobody touching the page), iPad portrait:
//   S  shell Home alone (baseline, no app open)
//   A  build guide as shipped in the viewer
//   B  the same with only '#hl .hl-ring' animation switched off (injected rule)
//   R  as shipped but prefers-reduced-motion: reduce (fresh load, standalone: the shell blanks under reduced motion, P2-STAB-01)
//   X  after closing the viewer (back to #home) — does the cost stop when the app is closed?
// WebKit arm: is the hlring animation running there too (document.getAnimations), i.e. not a Chromium-only artefact?
//   node "audits/tools/phase3/dollywood/verify-idle-pulse-cpu-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const ready = f => f.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
const probe = f => f.evaluate(() => { const r = document.querySelector('#hl .hl-ring'); return {
  flavor: document.documentElement.dataset.flavor, hlRings: document.querySelectorAll('#hl .hl-ring').length,
  anim: r ? getComputedStyle(r).animationName : null, iter: r ? getComputedStyle(r).animationIterationCount : null,
  running: document.getAnimations().filter(a => a.animationName === 'hlring' && a.playState === 'running').length,
  allRunning: document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName || a.constructor.name) }; });

async function measure(d, ms = 10000) {
  const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Performance.enable');
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const a = await m(); await sleep(ms); const b = await m(); const s = ms / 1000;
  await cdp.detach().catch(() => {});
  const pct = k => +(((b[k] - a[k]) / s) * 100).toFixed(1), rate = k => +((b[k] - a[k]) / s).toFixed(1);
  return { busyPct: pct('TaskDuration'), stylePct: pct('RecalcStyleDuration'), layoutPct: pct('LayoutDuration'), scriptPct: pct('ScriptDuration'), stylePerSec: rate('RecalcStyleCount'), layoutPerSec: rate('LayoutCount') };
}

let L = await local({ variant: 'typical', engine: 'chromium' });
try {
  // S + A + B + X on one device
  let d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(4000);
  log('S_shellHome', await measure(d));
  let f = await d.openApp('dollywood'); await ready(f); await sleep(3000);
  log('A_state', await probe(f));
  log('A_asShipped', await measure(d));
  await f.addStyleTag({ content: '#hl .hl-ring{animation:none!important}' }); await sleep(1500);
  log('B_pulseOff', await measure(d));
  await d.goto('#home'); await sleep(3000);
  log('X_afterClose', { frameStillThere: !!d.frame('dollywood'), ...(await measure(d)) });
  await d.close();
  // R: reduced motion from the first paint
  d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.page.emulateMedia({ reducedMotion: 'reduce' });
  // the shell itself does not boot under reduced motion (P2-STAB-01), so open the app standalone
  await d.page.goto(L.site + '/apps/dollywood.html'); f = d.page.mainFrame(); await ready(f); await sleep(3000);
  log('R_state', await probe(f));
  log('R_reducedMotion', await measure(d));
  await d.close();
} finally { await L.close(); }

L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood'); await ready(f); await sleep(3000);
  const p1 = await probe(f);
  const t0 = await f.evaluate(() => { const a = document.getAnimations().find(a => a.animationName === 'hlring'); return a ? a.currentTime : null; });
  await sleep(3000);
  const t1 = await f.evaluate(() => { const a = document.getAnimations().find(a => a.animationName === 'hlring'); return a ? a.currentTime : null; });
  log('W_webkit', { ...p1, currentTimeAdvancedMs: t0 != null && t1 != null ? Math.round(t1 - t0) : null });
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, 'verify-idle-pulse-cpu-2.json'), JSON.stringify(out, null, 1));
  await L.close();
}
