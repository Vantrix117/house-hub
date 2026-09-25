// Phase 4 MOTION skeptic #1 — does the Apps grid replay its .stagger entrance on every background pull?
// Independent of replay.mjs: watches #grid with a MutationObserver (childList replacements), records every pull
// (hub.onSync lastPull changes), whether the re-rendered markup is identical to what it replaced, animationstart
// events on tiles, and a per-frame sample of the tiles' computed opacity (frames where every tile is < .1).
// WebKit, real clock, idle 65 s, nothing tapped. Runs: Eli on iPad portrait, Ezra (kid) on iPhone PWA.
//   node "audits/tools/phase4/MOTION/verify-apps-grid-replays-entrance-every-pull-1.mjs"
//   → audits/evidence/p4/MOTION/verify-apps-grid-replays-entrance-every-pull-1.json (+ -mid.png)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const BASE = 'verify-apps-grid-replays-entrance-every-pull-1';
const out = {};
const L = await local({ variant: 'typical', engine: 'webkit', clock: 'real' });
try {
  const runs = [['eli-ipad', 'ipad-portrait', 'eli'], ['ezra-iphone', 'iphone-pwa', 'ezra']];
  await Promise.all(runs.map(async ([name, device, profile]) => {
    const d = await L.device({ device, profile, fixedTime: false });
    await d.ctx.addInitScript(() => {
      const W = window.__v = { anim: [], muts: [], pulls: [], blankFrames: [], frames: 0 };
      document.addEventListener('animationstart', e => { if (e.target.classList && e.target.classList.contains('tile')) W.anim.push({ t: performance.now(), name: e.animationName }); }, true);
      const wire = () => {
        const g = document.getElementById('grid'); if (!g) return setTimeout(wire, 50);
        let prev = g.innerHTML;
        new MutationObserver(() => { const now = g.innerHTML; W.muts.push({ t: performance.now(), identical: now === prev, tiles: g.querySelectorAll('.tile').length }); prev = now; }).observe(g, { childList: true });
        const tick = () => {
          const ts = [...g.querySelectorAll('.tile')];
          if (ts.length && document.getElementById('view-apps').offsetParent !== null) {
            W.frames++;
            const ops = ts.map(t => +getComputedStyle(t).opacity);
            if (ops.every(o => o < 0.1)) W.blankFrames.push(performance.now());
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const hw = () => { if (!window.hub || !hub.onSync) return setTimeout(hw, 50); let lp = 0; hub.onSync(s => { if (s.lastPull && s.lastPull !== lp) { lp = s.lastPull; W.pulls.push(performance.now()); } }); };
        hw();
      };
      document.addEventListener('DOMContentLoaded', wire);
    });
    await d.goto('#apps');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
    await sleep(2000);
    await d.page.evaluate(() => { window.__mark = performance.now(); });
    // capture a mid-replay frame: wait until the next grid mutation, then 30 ms later screenshot (animations live)
    let shotDone = false;
    const shotter = (async () => {
      if (name !== 'eli-ipad') return;
      const ok = await d.page.waitForFunction(() => window.__v.muts.some(m => m.t > window.__mark), null, { timeout: 40000, polling: 'raf' }).then(() => true).catch(() => false);
      if (!ok) return;
      await sleep(30);
      const ops = await d.page.evaluate(() => [...document.querySelectorAll('#grid .tile')].map(t => +(+getComputedStyle(t).opacity).toFixed(2)));
      await d.page.screenshot({ path: path.join(EV, BASE + '-mid.png'), animations: 'allow', scale: 'css' });
      out[name + '-midOpacities'] = ops; shotDone = true;
    })();
    await sleep(65000);
    await shotter;
    const r = await d.page.evaluate(() => {
      const m = window.__mark, W = window.__v, s = t => +((t - m) / 1000).toFixed(1);
      const muts = W.muts.filter(x => x.t >= m), pulls = W.pulls.filter(t => t >= m), anim = W.anim.filter(x => x.t >= m), blank = W.blankFrames.filter(t => t >= m);
      // group blank frames into episodes (gap > 200 ms = new episode)
      const eps = []; for (const t of blank) { const e = eps[eps.length - 1]; if (e && t - e.end < 200) e.end = t; else eps.push({ start: t, end: t }); }
      return {
        tiles: document.querySelectorAll('#grid .tile').length,
        pullsAtS: pulls.map(s),
        gridReplacementsAtS: muts.map(x => s(x.t)), replacementsIdenticalMarkup: muts.map(x => x.identical),
        tileAnimationStarts: anim.length, animNames: [...new Set(anim.map(x => x.name))], animAtS: [...new Set(anim.map(x => s(x.t)))],
        allTilesBlankEpisodes: eps.map(e => ({ atS: s(e.start), durMs: Math.round(e.end - e.start) })),
        framesSampled: W.frames,
        durVar: getComputedStyle(document.documentElement).getPropertyValue('--dur-3').trim(),
      };
    });
    out[name] = r;
    console.log(name, JSON.stringify(r));
    await d.close();
  }));
} finally {
  fs.writeFileSync(path.join(EV, BASE + '.json'), JSON.stringify(out, null, 1));
  await L.close();
}
