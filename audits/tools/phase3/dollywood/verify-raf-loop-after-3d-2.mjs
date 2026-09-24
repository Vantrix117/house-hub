// Phase 3 / dollywood — skeptic #2 for finding "raf-loop-after-3d".
// Claim: once 3D is opened, the loop at apps/dollywood.html:1269 keeps rescheduling requestAnimationFrame at ~60/s in 2D.
// Independent check: counts only invocations of the callback named `loop` (not every rAF), measures their JS cost in 2D,
// and checks context: (1) standalone page, (2) inside the shell viewer, then after "Hub" (closeViewer -> frame about:blank,
// index.html:732) whether any `loop` still runs, (3) whether the 3D loop renders every frame while nothing moves.
// Chromium (WebGL via SwiftShader); rates are browser-scheduling facts, not iPad frame times.
//   node "audits/tools/phase3/dollywood/verify-raf-loop-after-3d-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const HOOK = () => {
  const S = window.__loop = { calls: 0, ms: 0, renders: 0 };
  const o = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => o(cb && cb.name === 'loop'
    ? t => { S.calls++; const a = performance.now(); try { return cb(t); } finally { S.ms += performance.now() - a; } }
    : cb);
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue; const d = C.prototype.drawElements, a = C.prototype.drawArrays;
    C.prototype.drawElements = function (...x) { S.draws = (S.draws || 0) + 1; return d.apply(this, x); };
    C.prototype.drawArrays = function (...x) { S.draws = (S.draws || 0) + 1; return a.apply(this, x); };
  }
};
const rate = async (fr, ms) => {
  const a = await fr.evaluate(() => ({ ...window.__loop }));
  await sleep(ms);
  const b = await fr.evaluate(() => ({ ...window.__loop }));
  const s = ms / 1000;
  return { loopPerSec: Math.round((b.calls - a.calls) / s), loopJsMsPerSec: +((b.ms - a.ms) / s).toFixed(2), drawCallsPerSec: Math.round(((b.draws || 0) - (a.draws || 0)) / s) };
};
const wait3d = fr => fr.waitForFunction(() => (typeof three !== 'undefined' && three) || /failed/.test(document.getElementById('view3d').textContent), null, { timeout: 180000 });
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  // 1. standalone
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.ctx.addInitScript(HOOK);
  await d.page.goto(L.site + '/apps/dollywood.html');
  await d.page.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
  await sleep(1500);
  log('standalone.2dBefore3d', await rate(d.page, 3000));
  await d.page.evaluate(() => document.getElementById('m-3d').click());
  await wait3d(d.page); await sleep(2000);
  log('standalone.3dIdleNoInput', await rate(d.page, 3000));
  await d.page.evaluate(() => document.getElementById('m-2d').click()); await sleep(500);
  log('standalone.2dAfter3d', { ...(await rate(d.page, 3000)), mode: await d.page.evaluate(() => mode), canvasHidden: await d.page.evaluate(() => getComputedStyle(document.getElementById('view3d')).display) });
  await d.close();

  // 2. inside the shell viewer, then back to the hub
  const s = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await s.ctx.addInitScript(HOOK);
  await s.goto('#home');
  const f = await s.openApp('dollywood');
  await f.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
  await f.evaluate(() => document.getElementById('m-3d').click());
  await wait3d(f); await sleep(1500);
  await f.evaluate(() => document.getElementById('m-2d').click()); await sleep(500);
  log('shell.2dAfter3d', await rate(f, 3000));
  await s.page.click('#pill-home'); await sleep(1500);
  const after = await s.page.evaluate(() => ({ frameSrc: document.getElementById('frame').getAttribute('src'), shellLoopCalls: window.__loop.calls }));
  const frames = s.page.frames().map(fr => fr.url());
  log('shell.afterBackToHub', { ...after, frames });
  await s.close();
} finally {
  fs.writeFileSync(path.join(EV, 'verify-raf-loop-after-3d-2.json'), JSON.stringify(out, null, 1));
  await L.close();
}
