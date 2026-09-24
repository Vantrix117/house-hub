// Skeptic #1 for finding "3d-rebuild-texture-leak" (dollywood build guide).
// Question: after exaggeration-slider rebuilds (apps/dollywood.html:1274 -> build() :1232), are the old WebGL textures
// really leaked (still reachable, GPU memory held), or merely not deleteTexture()'d but freed when the JS wrapper is GC'd
// (the WebGL spec frees the GL object when its JS object is collected)?
// Counts: createTexture / deleteTexture calls, WebGLTexture wrappers finalised by GC (FinalizationRegistry), and
// texImage2D bytes whose texture is still alive (live bytes, not cumulative uploads).
//   NOGC=1 skips the forced GC (natural collection only).
//   node "audits/tools/phase3/dollywood/verify-3d-rebuild-texture-leak-1.mjs" [ipad-portrait]
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const dev = process.argv[2] || 'ipad-portrait';
const WRAP = () => {
  const S = window.__v = { created: 0, deleted: 0, finalized: 0, uploadBytes: 0, liveBytes: 0 };
  const sizes = new Map(); let nextId = 1; const ids = new WeakMap();
  const reg = new FinalizationRegistry(id => { S.finalized++; S.liveBytes -= sizes.get(id) || 0; sizes.delete(id); });
  let bound = null;
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue; const p = C.prototype;
    const oc = p.createTexture; p.createTexture = function () { const t = oc.call(this); S.created++; const id = nextId++; ids.set(t, id); sizes.set(id, 0); reg.register(t, id); return t; };
    const od = p.deleteTexture; p.deleteTexture = function (t) { S.deleted++; const id = ids.get(t); if (id) { S.liveBytes -= sizes.get(id) || 0; sizes.set(id, 0); } return od.call(this, t); };
    const ob = p.bindTexture; p.bindTexture = function (tg, t) { bound = t; return ob.call(this, tg, t); };
    const oi = p.texImage2D; p.texImage2D = function (...a) { try { let b = 0; if (a.length >= 9) b = a[3] * a[4] * 4; else { const s = a[5]; if (s && s.width) b = s.width * s.height * 4; }
      if (a[1] === 0 && bound) { const id = ids.get(bound); if (id) { S.liveBytes += b - (sizes.get(id) || 0); sizes.set(id, b); } } S.uploadBytes += b; } catch (e) {} return oi.apply(this, a); };
  }
};
const L = await local({ variant: 'typical', engine: 'chromium' });
const out = { dev };
try {
  const d = await L.device({ device: dev, profile: 'eli', fixedTime: false });
  await d.ctx.addInitScript(WRAP);
  await d.page.goto(L.site + '/apps/dollywood.html');
  await d.page.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
  await sleep(1500);
  const cdp = await d.ctx.newCDPSession(d.page);
  const gc = async () => { if (process.env.NOGC) return; for (let i = 0; i < 4; i++) { await cdp.send('HeapProfiler.collectGarbage'); await sleep(400); } };
  const snap = async label => { await gc(); const v = await d.page.evaluate(() => ({ ...window.__v, liveWrappers: __v.created - __v.finalized - 0, liveMB: +(__v.liveBytes / 1048576).toFixed(1), uploadMB: +(__v.uploadBytes / 1048576).toFixed(1) })); out[label] = v; console.log(label, JSON.stringify(v)); return v; };
  await d.page.evaluate(() => document.getElementById('m-3d').click());
  await d.page.waitForFunction(() => typeof three !== 'undefined' && three, null, { timeout: 180000 });
  out.lite = await d.page.evaluate(() => matchMedia('(pointer:coarse)').matches);
  await sleep(3000);
  await snap('after3dOpen');
  for (let i = 0; i < 10; i++) { await d.page.evaluate(v => { const r = document.getElementById('exag-r'); r.value = v; r.dispatchEvent(new Event('input')); }, String(i % 2 ? 1.5 : 2)); await sleep(2500); }
  await sleep(2000);
  await snap('after10Rebuilds');
  await sleep(5000);
  await snap('after10Rebuilds+5s');
  // a control: 10 more, to see whether live count grows linearly or plateaus
  for (let i = 0; i < 10; i++) { await d.page.evaluate(v => { const r = document.getElementById('exag-r'); r.value = v; r.dispatchEvent(new Event('input')); }, String(i % 2 ? 1.5 : 2)); await sleep(2500); }
  await sleep(2000);
  await snap('after20Rebuilds');
  out.canvasBlank = await d.page.evaluate(() => { const c = document.querySelector('#view3d canvas'); return c ? { w: c.width, h: c.height } : null; });
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, process.env.NOGC ? 'verify-3d-rebuild-texture-leak-1-nogc.json' : 'verify-3d-rebuild-texture-leak-1.json'), JSON.stringify(out, null, 1));
  await L.close();
}
