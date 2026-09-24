// Skeptic #1 for finding "raf-loop-after-3d": does the 3D render loop (apps/dollywood.html:1269) keep scheduling
// requestAnimationFrame at display rate after the user returns to 2D, and until when?
//   node "audits/tools/phase3/dollywood/verify-raf-loop-after-3d-1.mjs" [webkit|chromium]
// Opens the Build guide INSIDE the shell viewer (the way the family opens it) on the Kitchen iPad, counts rAF calls
// made by the app frame, and times the work done inside rAF callbacks. Then closes the viewer and checks again.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const engine = process.argv[2] || 'webkit';
const EV = path.resolve('audits/evidence/p3/dollywood');
const INIT = () => {
  if (!/\/apps\/dollywood\.html/.test(location.pathname)) return;
  const S = window.__rv = { raf: 0, cbMs: 0 };
  const o = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { S.raf++; return o(t => { const a = performance.now(); try { cb(t); } finally { S.cbMs += performance.now() - a; } }); };
};
const out = { engine };
const L = await local({ variant: 'typical', engine });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.ctx.addInitScript(INIT);
  const f = await d.openApp('dollywood');
  await f.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 60000 });
  await sleep(1500);
  const rate = async ms => { const a = await f.evaluate(() => ({ ...__rv })); await sleep(ms); const b = await f.evaluate(() => ({ ...__rv })); return { perSec: Math.round((b.raf - a.raf) / (ms / 1000)), cbMsPerSec: +((b.cbMs - a.cbMs) / (ms / 1000)).toFixed(2) }; };
  out.twoDBefore3d = await rate(3000);
  await f.evaluate(() => document.getElementById('m-3d').click());
  out.built = await f.waitForFunction(() => (typeof three !== 'undefined' && three) || /failed/.test(document.getElementById('view3d').textContent), null, { timeout: 180000 }).then(() => true).catch(() => false);
  out.threeState = await f.evaluate(() => ({ three: typeof three !== 'undefined' && !!three, mode, view3dText: document.getElementById('view3d').textContent.slice(0, 80) }));
  await sleep(2000);
  out.threeD = await rate(3000);
  await f.evaluate(() => document.getElementById('m-2d').click());
  await sleep(500);
  out.modeAfter = await f.evaluate(() => mode);
  out.twoDAfter3d = await rate(3000);
  out.twoDAfter3dLater = await (async () => { await sleep(10000); return rate(3000); })();
  await d.shot(path.join(EV, 'verify-raf-loop-after-3d-1-2d-after.png'));
  // close the viewer the way the shell does (Home tab) and see whether the frame is gone
  await d.page.evaluate(() => { location.hash = '#home'; });
  await sleep(1500);
  out.frameAfterClose = d.page.frames().filter(x => /dollywood\.html/.test(x.url())).length;
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, `verify-raf-loop-after-3d-1-${engine}.json`), JSON.stringify(out, null, 1));
} finally { await L.close(); }
