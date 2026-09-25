// Phase 4 MOTION skeptic #2 — does the Apps grid replay its hub-pop entrance on every 30 s background pull?
// Independent of replay.mjs: WebKit (the iOS engine), no manual hub.pull(); waits for hub.js's own 30 s timer.
// Records animationstart events on #grid children, tile node identity across pulls, lastPull values, and opacity
// sampled on rAF; one adult (eli, iPad portrait) and one kid (ezra, iPhone PWA), plus eli on Home as the control.
//   node "audits/tools/phase4/MOTION/verify-apps-grid-replays-entrance-every-pull-2.mjs"
//   → audits/evidence/p4/MOTION/verify-apps-grid-replays-entrance-every-pull-2.json (+ -mid.png)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const BASE = 'verify-apps-grid-replays-entrance-every-pull-2';
const L = await local({ variant: 'typical', engine: 'webkit' });
const out = { engine: 'webkit', runs: [] };
const IDLE = Number(process.env.IDLE || 66000);
async function watch(device, profile, hash, shot) {
  const d = await L.device({ device, profile, fixedTime: false });
  await d.goto(hash);
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  await d.page.evaluate(() => {
    const g = document.getElementById('grid');
    window.__log = { starts: [], pulls: [], minOpacity: [], t0: performance.now(), firstTiles: [...g.children] };
    g.addEventListener('animationstart', e => { if (e.target.parentElement === g) window.__log.starts.push({ t: Math.round((performance.now() - window.__log.t0) / 1000), name: e.animationName }); });
    let last = hub.sync.lastPull;
    hub.onSync(s => { if (s.lastPull !== last) { last = s.lastPull; window.__log.pulls.push(Math.round((performance.now() - window.__log.t0) / 1000)); } });
    const tick = () => { const ts = [...g.children].filter(x => x.classList.contains('tile')); if (ts.length) { const m = Math.min(...ts.map(t => +getComputedStyle(t).opacity)); if (m < 0.5) window.__log.minOpacity.push({ t: +((performance.now() - window.__log.t0) / 1000).toFixed(1), min: +m.toFixed(2), zeroTiles: ts.filter(t => +getComputedStyle(t).opacity < 0.05).length, tiles: ts.length }); } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  let shotTaken = false;
  const t0 = Date.now();
  while (Date.now() - t0 < IDLE) {
    if (shot && !shotTaken) {
      const low = await d.page.evaluate(() => [...document.querySelectorAll('#grid .tile')].filter(t => +getComputedStyle(t).opacity < 0.5).length);
      if (low > 0) { await d.page.screenshot({ path: path.join(EV, BASE + '-mid.png'), scale: 'css', animations: 'allow' }); shotTaken = low; }
    }
    await sleep(shot && !shotTaken ? 20 : 1000);
  }
  const r = await d.page.evaluate(() => {
    const g = document.getElementById('grid'); const L = window.__log;
    const zeroFrames = L.minOpacity.filter(x => x.zeroTiles > 0);
    return { tab: location.hash, tiles: g.querySelectorAll('.tile').length, stagger: g.className, sameNodesAsStart: [...g.children].every((c, i) => c === L.firstTiles[i]),
      pullsAt: L.pulls, animationStarts: L.starts.length, startSeconds: [...new Set(L.starts.map(s => s.t))], names: [...new Set(L.starts.map(s => s.name))],
      framesWithTileBelow05: L.minOpacity.length, framesWithAnyTileNearZero: zeroFrames.length, maxTilesNearZeroInOneFrame: Math.max(0, ...zeroFrames.map(x => x.zeroTiles)),
      lowSeconds: [...new Set(L.minOpacity.map(x => Math.round(x.t)))] };
  });
  out.runs.push({ device, profile, hash, ...r, shotLowTiles: shotTaken || null });
  console.log(JSON.stringify(out.runs.at(-1)));
  await d.close();
}
try {
  await watch('ipad-portrait', 'eli', '#apps', true);
  await watch('iphone-pwa', 'ezra', '#apps', false);
  await watch('ipad-portrait', 'eli', '#home', false);
} finally { fs.writeFileSync(path.join(EV, BASE + '.json'), JSON.stringify(out, null, 1)); await L.close(); }
