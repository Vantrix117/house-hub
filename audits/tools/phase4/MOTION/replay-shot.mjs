// Phase 4 MOTION — a still of the Apps grid mid-replay (see replay.mjs): on #apps, trigger the same pull the 30 s timer
// runs (hub.pull()), then screenshot as soon as a tile's computed opacity drops below 0.9 (animations allowed).
// Chromium, iPad portrait, Eli.   node "audits/tools/phase4/MOTION/replay-shot.mjs"
//   → audits/evidence/p4/MOTION/apps-grid-replay-mid-ipad.png + replay-shot.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const L = await local({ variant: 'typical', engine: 'chromium' });
const out = {};
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.goto('#apps'); await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(1500);
  out.before = await d.page.evaluate(() => [...document.querySelectorAll('#grid .tile')].map(t => +(+getComputedStyle(t).opacity).toFixed(2)));
  await d.page.evaluate(() => { window.__lp = hub.sync.lastPull; hub.pull(); });
  await d.page.waitForFunction(() => [...document.querySelectorAll('#grid .tile')].some(t => +getComputedStyle(t).opacity < 0.9), null, { timeout: 10000, polling: 'raf' });
  out.mid = await d.page.evaluate(() => [...document.querySelectorAll('#grid .tile')].map(t => +(+getComputedStyle(t).opacity).toFixed(2)));
  await d.page.screenshot({ path: path.join(EV, 'apps-grid-replay-mid-ipad.png'), scale: 'css', animations: 'allow' });
  await sleep(800);
  out.after = await d.page.evaluate(() => [...document.querySelectorAll('#grid .tile')].map(t => +(+getComputedStyle(t).opacity).toFixed(2)));
  console.log(JSON.stringify(out));
  await d.close();
} finally { fs.writeFileSync(path.join(EV, 'replay-shot.json'), JSON.stringify(out, null, 1)); await L.close(); }
