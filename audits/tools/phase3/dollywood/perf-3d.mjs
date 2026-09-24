// Phase 3 / dollywood: 3D view cost in Chromium (CDP), as Eli on the rig's iPad-portrait size (coarse pointer = the "lite"
// build, apps/dollywood.html:1161) and on desktop (fine pointer = the full build).
// Measures: time to build the 3D model, JS heap and DOM nodes (CDP Performance.getMetrics), live WebGL objects (textures,
// buffers, programs: counted by wrapping the WebGL context's create*/delete* calls), texture bytes uploaded, the
// requestAnimationFrame rate while back in 2D after 3D was opened (the loop at :1269), and what 10 changes of the
// vertical-exaggeration slider (each a full rebuild, :1274 -> build() :1232) leave behind.
// Headless Chromium renders WebGL in software (SwiftShader): frame times here are NOT an iPad's; counts and bytes are.
//   node "audits/tools/phase3/dollywood/perf-3d.mjs" [ipad-portrait|desktop]
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const devs = process.argv.slice(2).length ? process.argv.slice(2) : ['ipad-portrait', 'desktop'];
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const WRAP = () => {
  const S = window.__gl = { tex: 0, texDel: 0, buf: 0, bufDel: 0, prog: 0, progDel: 0, texBytes: 0, contexts: 0, raf: 0 };
  const origRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { S.raf++; return origRaf(cb); };
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue; const p = C.prototype;
    const w = (name, fn) => { const o = p[name]; if (!o) return; p[name] = function (...a) { fn.apply(this, a); return o.apply(this, a); }; };
    w('createTexture', () => S.tex++); w('deleteTexture', () => S.texDel++);
    w('createBuffer', () => S.buf++); w('deleteBuffer', () => S.bufDel++);
    w('createProgram', () => S.prog++); w('deleteProgram', () => S.progDel++);
    w('texImage2D', function (...a) { try { if (a.length >= 9) S.texBytes += a[3] * a[4] * 4; else { const src = a[5]; if (src && src.width) S.texBytes += src.width * src.height * 4; } } catch (e) {} });
  }
  const oc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { if (/webgl/.test(t)) S.contexts++; return oc.call(this, t, ...r); };
};
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  for (const dev of devs) {
    const d = await L.device({ device: dev, profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(WRAP);
    await d.page.goto(L.site + '/apps/dollywood.html');   // standalone: one page, one CDP target
    await d.page.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
    await sleep(1500);
    const cdp = await d.ctx.newCDPSession(d.page);
    await cdp.send('Performance.enable');
    const metrics = async () => { await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value])); return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, taskSec: +m.TaskDuration.toFixed(2) }; };
    const gl = () => d.page.evaluate(() => ({ ...window.__gl, liveTex: __gl.tex - __gl.texDel, liveBuf: __gl.buf - __gl.bufDel, texMB: +(__gl.texBytes / 1048576).toFixed(1) }));
    const cpu = async ms => { const a = (await cdp.send('Performance.getMetrics')).metrics.find(x => x.name === 'TaskDuration').value; await sleep(ms); const b = (await cdp.send('Performance.getMetrics')).metrics.find(x => x.name === 'TaskDuration').value; return +(((b - a) / (ms / 1000)) * 100).toFixed(2); };   // main-thread busy %
    const rafRate = async ms => { const a = await d.page.evaluate(() => __gl.raf); await sleep(ms); const b = await d.page.evaluate(() => __gl.raf); return Math.round((b - a) / (ms / 1000)); };
    const m2d = await metrics();
    const raf2dBefore = await rafRate(3000);
    const cpu2dBefore = await cpu(5000);
    const t0 = Date.now();
    await d.page.evaluate(() => document.getElementById('m-3d').click());
    const ok = await d.page.waitForFunction(() => (typeof three !== 'undefined' && three) || /failed/.test(document.getElementById('view3d').textContent), null, { timeout: 180000 }).then(() => true).catch(() => false);
    const buildMs = Date.now() - t0;
    const lite = await d.page.evaluate(() => matchMedia('(pointer:coarse)').matches);
    const failed = await d.page.evaluate(() => /failed/.test(document.getElementById('view3d').textContent));
    await sleep(3000);
    const m3d = await metrics(); const gl3d = await gl();
    // frame pacing in 3D over 4 s (software GL — for reference only)
    const fps3d = await rafRate(4000);
    // back to 2D: the loop keeps scheduling frames
    await d.page.evaluate(() => setMode('2d')); await sleep(500);
    const raf2dAfter = await rafRate(3000);
    const cpu2dAfter = await cpu(5000);
    const m2dAfter = await metrics();
    // 10 exaggeration changes, each followed by its debounced rebuild
    await d.page.evaluate(() => setMode('3d')); await sleep(800);
    for (let i = 0; i < 10; i++) { await d.page.evaluate(v => { const r = document.getElementById('exag-r'); r.value = v; r.dispatchEvent(new Event('input')); }, String(i % 2 ? 1.5 : 2)); await sleep(2500); }
    await sleep(2000);
    const mAfterRebuilds = await metrics(); const glAfterRebuilds = await gl();
    log(dev, { lite, ok, failed, buildMs, raf2dBefore, fps3dSoftwareGL: fps3d, raf2dAfter3d: raf2dAfter, mainThreadBusyPct2d: { before3d: cpu2dBefore, after3d: cpu2dAfter }, heap: { twoD: m2d, threeD: m3d, back2D: m2dAfter, after10Rebuilds: mAfterRebuilds }, webgl: { after3dOpen: gl3d, after10Rebuilds: glAfterRebuilds } });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'perf-3d.json'), JSON.stringify(out, null, 1));
  await L.close();
}
