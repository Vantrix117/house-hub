// Phase 3 / dollywood — skeptic #3 (tie-break) for finding "3d-rebuild-texture-leak".
// Claim: every exaggeration change rebuilds the 3D scene (build(), template.html:1230 / apps/dollywood.html:1232, which
// disposes only o.geometry) and "leaks" ~157 textures. Question settled here: after a rebuild, are the old three.js
// CanvasTextures / SpriteMaterials and their WebGLTexture objects still REACHABLE (a real leak, engine-independent), or
// only garbage waiting for GC? Reachability is JS semantics, so a forced full GC in Chromium answers it for both engines.
// WebKit (no forced GC) is run for how promptly its collector actually reclaims them, plus whether the context is lost.
// Counts use FinalizationRegistry (weak: it keeps nothing alive). THREE.CanvasTexture / THREE.SpriteMaterial are wrapped
// in subclasses after the page loads (the app calls `new THREE.CanvasTexture(...)` at build time).
//   node "audits/tools/phase3/dollywood/verify-3d-rebuild-texture-leak-3.mjs" [chromium|webkit] [rebuilds=30]
// Writes audits/evidence/p3/dollywood/verify-3d-rebuild-texture-leak-3-<engine>.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const ENGINE = process.argv[2] === 'webkit' ? 'webkit' : 'chromium';
const N = +(process.argv[3] || 30);
const out = { engine: ENGINE, device: 'ipad-portrait', steps: [] };

const INIT = () => {
  const S = window.__v3 = { glCreated: 0, glDeleted: 0, glFinal: 0, ctFinal: 0, ctMade: 0, smMade: 0, smFinal: 0, lost: 0, restored: 0 };
  const reg = window.__v3reg = new FinalizationRegistry(k => { S[k]++; });
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue; const p = C.prototype;
    const oc = p.createTexture; p.createTexture = function () { const t = oc.call(this); S.glCreated++; reg.register(t, 'glFinal'); return t; };
    const od = p.deleteTexture; p.deleteTexture = function (t) { S.glDeleted++; return od.call(this, t); };
  }
  const og = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    if (/webgl/.test(String(type)) && !this.__v3) { this.__v3 = 1; this.addEventListener('webglcontextlost', () => S.lost++); this.addEventListener('webglcontextrestored', () => S.restored++); }
    return og.call(this, type, ...a);
  };
};
const PATCH = () => {
  const S = window.__v3, reg = window.__v3reg, T = window.THREE;
  const CT = T.CanvasTexture, SM = T.SpriteMaterial;
  class CT2 extends CT { constructor(...a) { super(...a); S.ctMade++; reg.register(this, 'ctFinal'); } }
  class SM2 extends SM { constructor(...a) { super(...a); S.smMade++; reg.register(this, 'smFinal'); } }
  try { T.CanvasTexture = CT2; T.SpriteMaterial = SM2; } catch (e) { return 'patch failed: ' + e.message; }
  return T.CanvasTexture === CT2 ? 'patched r' + T.REVISION : 'THREE not writable';
};

const L = await local({ variant: 'typical', engine: ENGINE });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.ctx.addInitScript(INIT);
  await d.page.goto(L.site + '/apps/dollywood.html');
  await d.page.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
  await sleep(1000);
  out.patch = await d.page.evaluate(PATCH); console.log('patch:', out.patch);
  const cdp = ENGINE === 'chromium' ? await d.ctx.newCDPSession(d.page) : null;
  const gc = async () => {
    if (cdp) { for (let i = 0; i < 4; i++) { await cdp.send('HeapProfiler.collectGarbage'); await sleep(500); } await sleep(1000); return 'CDP HeapProfiler.collectGarbage x4'; }
    for (let r = 0; r < 20; r++) { await d.page.evaluate(() => { let k = []; for (let i = 0; i < 60; i++) k.push(new Float64Array(1 << 20)); k = null; }); await sleep(300); }
    await sleep(2000); return 'WebKit: 20 rounds of ~480 MB typed-array churn (no forced GC available)';
  };
  const snap = async label => {
    const s = await d.page.evaluate(() => ({ ...window.__v3, canvasShown: getComputedStyle(document.getElementById('view3d')).display }));
    s.label = label; s.glLive = s.glCreated - s.glDeleted - s.glFinal; s.canvasTexLive = s.ctMade - s.ctFinal; s.spriteMatLive = s.smMade - s.smFinal;
    out.steps.push(s); console.log(JSON.stringify(s));
  };
  const rebuilds = async n => { for (let i = 0; i < n; i++) { await d.page.evaluate(v => { const r = document.getElementById('exag-r'); r.value = v; r.dispatchEvent(new Event('input')); }, String(i % 2 ? 1.5 : 2)); await sleep(1500); } await sleep(1500); };

  await d.page.evaluate(() => document.getElementById('m-3d').click());
  await d.page.waitForFunction(() => typeof three !== 'undefined' && three, null, { timeout: 180000 });
  await sleep(2500);
  await snap('3d-open');
  out.gcMethod = await gc(); await snap('3d-open+gc');
  await rebuilds(10); await snap('after-10-rebuilds');
  await gc(); await snap('after-10-rebuilds+gc');
  await rebuilds(N - 10); await snap(`after-${N}-rebuilds`);
  await gc(); await snap(`after-${N}-rebuilds+gc`);
  await sleep(15000); await gc(); await snap(`after-${N}-rebuilds+15s+gc`);
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, `verify-3d-rebuild-texture-leak-3-${ENGINE}.json`), JSON.stringify(out, null, 1));
  await L.close();
}
