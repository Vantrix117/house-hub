// Phase 4 MOTION — are the shell's transitions interruptible? The viewer opens with the keyframe animation viewer-in
// (360 ms, --spring) and closes with viewer-out (220 ms) (index.html:327-330). A CSS keyframe animation that is replaced
// starts from the element's un-animated value, not from where the running one had got to, so closing an app while it
// is still opening should snap. Chromium, iPad portrait, Eli: tap the Tally tile, tap the viewer's Hub button 120 ms
// later, and sample the viewer's computed opacity and scale every animation frame from the tile tap to 700 ms.
// Control: the tab indicator, a CSS transition (index.html → design.css:567), retargeted mid-flight by two quick tab taps.
//   node "audits/tools/phase4/MOTION/interrupt.mjs"  → audits/evidence/p4/MOTION/interrupt.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.goto('#apps'); await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(800);
  out.viewer = await d.page.evaluate(async () => {
    const v = document.getElementById('viewer'); const s = [];
    const rd = () => { const c = getComputedStyle(v); const m = /matrix\(([^)]+)\)/.exec(c.transform); const sc = m ? Math.hypot(...m[1].split(',').slice(0, 2).map(Number)) : 1; return { o: +(+c.opacity).toFixed(2), s: +sc.toFixed(3), cls: v.className }; };
    const t0 = performance.now();
    document.querySelector('#grid .tile[data-id="tally"]').click();
    let closed = false;
    await new Promise(res => { const f = () => { const t = performance.now() - t0; if (!closed && t >= 120) { closed = true; document.getElementById('pill-home').click(); s.push({ t: Math.round(t), ev: 'close tapped' }); } s.push({ t: Math.round(t), ...rd() }); if (t < 700) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const before = s.filter(x => x.t < 120 && x.o != null).pop(); const after = s.find(x => x.t >= 120 && x.o != null && x.ev == null);
    return { lastBeforeClose: before, firstAfterClose: after, opacityJump: after && before ? +(after.o - before.o).toFixed(2) : null, samples: s };
  });
  console.log('viewer: last before close', JSON.stringify(out.viewer.lastBeforeClose), '→ first after', JSON.stringify(out.viewer.firstAfterClose), 'jump', out.viewer.opacityJump);
  await sleep(800);
  // control: a retargeted CSS transition (tab indicator) — Home, then Me 60 ms later
  out.tabIndicator = await d.page.evaluate(async () => {
    const ind = document.querySelector('.tab-ind') || document.getElementById('tab-ind'); if (!ind) return { err: 'no .tab-ind' };
    const prop = getComputedStyle(ind).transitionProperty; const key = /top/.test(prop) ? 'top' : 'left';
    const s = []; const t0 = performance.now();
    document.querySelector('#tabbar .tab[data-tab="home"]').click();
    let second = false;
    await new Promise(res => { const f = () => { const t = performance.now() - t0; if (!second && t >= 60) { second = true; document.querySelector('#tabbar .tab[data-tab="me"]').click(); s.push({ t: Math.round(t), ev: 'me tapped' }); } s.push({ t: Math.round(t), v: parseFloat(getComputedStyle(ind)[key]) }); if (t < 600) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const vals = s.filter(x => x.v != null); let maxStep = 0; for (let i = 1; i < vals.length; i++) maxStep = Math.max(maxStep, Math.abs(vals[i].v - vals[i - 1].v));
    return { axis: key, maxStepPx: +maxStep.toFixed(1), samples: s };
  });
  console.log('tab indicator: axis', out.tabIndicator.axis, 'largest per-frame step', out.tabIndicator.maxStepPx, 'px');
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, 'interrupt.json'), JSON.stringify(out, null, 1));
  await L.close();
}
