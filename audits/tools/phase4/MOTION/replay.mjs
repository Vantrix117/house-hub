// Phase 4 MOTION — entrance animations that replay on their own while the screen sits idle. The Apps grid is a
// `.stagger` container (index.html:380; design.css:597-599: every child runs hub-pop, 360 ms, from opacity 0 and
// scale .96) and the shell re-renders the grid on every pull while the Apps tab is showing (index.html:1243 →
// renderGrid, index.html:693-706, grid.innerHTML). So every 30 s pull (apps/hub.js:342) should replay the pop-in on
// every tile. WebKit, iPad portrait, Eli; listens for animationstart for 65 s on #apps, and on #home and the TV board
// as controls. Nothing is tapped after load.
//   node "audits/tools/phase4/MOTION/replay.mjs"  → audits/evidence/p4/MOTION/replay.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', engine: 'webkit', clock: 'real' });
try {
  const runs = [['apps', 'ipad-portrait', 'eli', '#apps'], ['home', 'ipad-portrait', 'eli', '#home'], ['tv', 'tv', 'tv', '#home']];
  await Promise.all(runs.map(async ([name, device, profile, hash]) => {
    const d = await L.device({ device, profile, fixedTime: false });
    await d.ctx.addInitScript(() => { window.__starts = []; document.addEventListener('animationstart', e => { window.__starts.push({ t: Math.round(performance.now()), name: e.animationName, el: (e.target.className && String(e.target.className).split(' ')[0]) || e.target.tagName.toLowerCase() }); }, true); });
    await d.goto(hash); await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
    await sleep(2000);
    const t0 = await d.page.evaluate(() => { window.__mark = performance.now(); return Math.round(window.__mark); });
    await sleep(65000);
    const r = await d.page.evaluate(() => { const s = window.__starts.filter(x => x.t >= window.__mark); const by = {}; for (const x of s) { const k = x.name + ' on ' + x.el; (by[k] = by[k] || []).push(Math.round((x.t - window.__mark) / 1000)); } return { count: s.length, byNameSecondsAfterStart: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, [...new Set(v)]])), perName: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length])) }; });
    out[name] = r;
    console.log(name, JSON.stringify(r));
    await d.close();
  }));
} finally {
  fs.writeFileSync(path.join(EV, 'replay.json'), JSON.stringify(out, null, 1));
  await L.close();
}
