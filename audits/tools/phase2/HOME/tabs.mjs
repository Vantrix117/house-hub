// HOME brief (3), shell side: how long a tab tap takes to show the new tab on the iPad (WebKit, local, relative only).
// For each tab, 5 taps from another tab: the synchronous handler time (showTab → renderHome/renderGrid/renderMe) and
// the time until two animation frames later (the frame after the new content was painted).
//
//   node "audits/tools/phase2/HOME/tabs.mjs"      → audits/evidence/p2/HOME/tabs.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
const L = await local({ variant: 'typical', clock: 'real' });
const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
await d.goto('#home');
await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#feed .fline'), null, { timeout: 15000 });
await sleep(800);
const res = {};
for (const t of ['apps', 'home', 'me', 'home', 'chat', 'home']) {
  const from = t === 'home' ? null : 'home';
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const other = t === 'home' ? 'apps' : 'home';
    await d.page.evaluate(o => document.querySelector(`#tabbar .tab[data-tab="${o}"]`).click(), other); await sleep(350);
    runs.push(await d.page.evaluate(async t => {
      const t0 = performance.now(); document.querySelector(`#tabbar .tab[data-tab="${t}"]`).click(); const sync = performance.now() - t0;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { sync: Math.round(sync * 10) / 10, twoFrames: Math.round(performance.now() - t0) };
    }, t));
    await sleep(350);
  }
  res[t] = res[t] || [];
  res[t].push(...runs);
}
const med = a => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
for (const [t, runs] of Object.entries(res)) console.log(`[tab] → ${t.padEnd(5)} sync handler median ${med(runs.map(r => r.sync))} ms (${runs.map(r => r.sync).join('/')}); painted (2 frames) median ${med(runs.map(r => r.twoFrames))} ms (${runs.map(r => r.twoFrames).join('/')})`);
fs.writeFileSync(path.join(OUT, 'tabs.json'), JSON.stringify(res, null, 1));
await L.close();
