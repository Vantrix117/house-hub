// Phase 3 / dollywood — skeptic #2 for finding "3d-rebuild-texture-leak".
// Question: are the textures that build() (apps/dollywood.html:1232, template.html:1230) leaves undisposed actually
// retained, or does the browser free them once the JS wrappers are garbage-collected (WebGL objects are deleted when
// their JS object is collected)? The investigator counted createTexture - deleteTexture only, which cannot see GC.
// This script counts WebGLTexture wrappers with a FinalizationRegistry (weak, so it keeps nothing alive), and reads the
// Chromium GPU process's private memory (SwiftShader keeps texture storage there) before/after rebuilds and after a GC.
//   node "audits/tools/phase3/dollywood/verify-3d-rebuild-texture-leak-2.mjs" [chromium|webkit]   (WebKit: no CDP, so no forced GC and no GPU-process
//   reading, natural finalization only; results go to verify-3d-rebuild-texture-leak-2-webkit.json)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const ENGINE = process.argv[2] === 'webkit' ? 'webkit' : 'chromium';
const out = { engine: ENGINE, steps: [] };
const WRAP = () => {
  const S = window.__vt = { created: 0, deleted: 0, finalized: 0, controlObj: 0, controlTex: 0 };
  const reg = new FinalizationRegistry(k => { if (k === 1) S.finalized++; else if (k === 2) S.controlObj++; else if (k === 3) S.controlTex++; });
  window.__vtReg = reg;
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue; const p = C.prototype;
    const oc = p.createTexture; p.createTexture = function () { const t = oc.call(this); if (!window.__vtNoCount) { S.created++; reg.register(t, 1); window.__vtCtx = new WeakRef(this); } return t; };
    const od = p.deleteTexture; p.deleteTexture = function (t) { S.deleted++; return od.call(this, t); };
  }
};
const L = await local({ variant: 'typical', engine: ENGINE });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.ctx.addInitScript(WRAP);
  await d.page.goto(L.site + '/apps/dollywood.html');
  await d.page.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
  await sleep(1500);
  const cdp = ENGINE === 'chromium' ? await d.ctx.newCDPSession(d.page) : null;
  const bcdp = ENGINE === 'chromium' ? await L.browser.newBrowserCDPSession() : null;
  const gpuMB = async () => {
    if (!bcdp) return null;
    const { processInfo } = await bcdp.send('SystemInfo.getProcessInfo');
    const g = processInfo.filter(p => p.type === 'GPU' || p.type === 'gpu');
    return g.map(p => { try { return +(Number(execSync(`powershell -NoProfile -Command "(Get-Process -Id ${p.id}).PrivateMemorySize64"`).toString().trim()) / 1048576).toFixed(1); } catch (e) { return null; } });
  };
  const snap = async label => {
    const c = await d.page.evaluate(() => ({ ...window.__vt, lite: matchMedia('(pointer:coarse)').matches, ok: typeof three !== 'undefined' && !!three }));
    const s = { label, ...c, liveByDeleteCount: c.created - c.deleted, liveAfterGC: c.created - c.deleted - c.finalized, gpuProcessPrivateMB: await gpuMB() };
    out.steps.push(s); console.log(JSON.stringify(s));
  };
  const gc = async () => { if (!cdp) {
    await d.page.evaluate(() => { const g = window.__vtCtx && window.__vtCtx.deref(); for (let i = 0; i < 20; i++) { window.__vtReg.register({ i }, 2); if (g) { window.__vtNoCount = true; window.__vtReg.register(g.createTexture(), 3); window.__vtNoCount = false; } } });
    for (let r = 0; r < 12; r++) { await d.page.evaluate(() => { let keep = []; for (let i = 0; i < 40; i++) keep.push(new Array(500000).fill(i)); keep = null; }); await sleep(400); }
    await sleep(1500); return; } for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await sleep(700); } await sleep(1500); };
  const rebuilds = async n => { for (let i = 0; i < n; i++) { await d.page.evaluate(v => { const r = document.getElementById('exag-r'); r.value = v; r.dispatchEvent(new Event('input')); }, String(i % 2 ? 1.5 : 2)); await sleep(2500); } await sleep(2000); };
  await snap('2d-open');
  await d.page.evaluate(() => document.getElementById('m-3d').click());
  await d.page.waitForFunction(() => typeof three !== 'undefined' && three, null, { timeout: 180000 });
  await sleep(3000);
  await snap('3d-open');
  await gc(); await snap('3d-open+gc');
  await rebuilds(10); await snap('after-10-rebuilds-no-forced-gc');
  await sleep(20000); await snap('after-10-rebuilds+20s-idle-no-forced-gc');
  await gc(); await snap('after-10-rebuilds+forced-gc');
  await rebuilds(20); await snap('after-30-rebuilds-no-forced-gc');
  await gc(); await snap('after-30-rebuilds+forced-gc');
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, ENGINE === 'webkit' ? 'verify-3d-rebuild-texture-leak-2-webkit.json' : 'verify-3d-rebuild-texture-leak-2.json'), JSON.stringify(out, null, 1));
  await L.close();
}
