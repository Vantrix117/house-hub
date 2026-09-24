// STAB helper: prove the advance() slicing keeps pulls real (no fake-clock aborts). Compares 30 s slices + 150 ms pause
// (aborts) with advance() (10 s slices + settle).
//   node "audits/tools/phase2/STAB/debug-pull.mjs"
import { local, sleep } from '../../lib/local.mjs';
import { advance, track } from './advance.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  for (const mode of ['30s+150ms', 'advance']) {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() });
    const T = track(d);
    await d.goto('#home'); await d.page.waitForSelector('#view-home .card');
    const t0 = Date.now(); T.total = 0; T.failed = 0; T.failedUrls = {}; T.byKind = {};
    if (mode === 'advance') await advance(d, 30 * 60000);
    else for (let i = 0; i < 60; i++) { await d.ctx.clock.runFor(30000); await sleep(150); }
    const s = await d.page.evaluate(() => ({ state: hub.sync.state, lastPullAgoS: Math.round((Date.now() - hub.sync.lastPull) / 1000) }));
    console.log(mode, '30 simulated min in', Date.now() - t0, 'ms real', JSON.stringify({ requests: T.byKind, failed: T.failed, failedUrls: T.failedUrls, sync: s }));
    await d.close();
  }
} finally { await L.close(); }
