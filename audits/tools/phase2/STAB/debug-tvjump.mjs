// STAB helper: what does the TV's 1 s tick do on the first tick after a clock jump?
//   node "audits/tools/phase2/STAB/debug-tvjump.mjs" [webkit|chromium]
import { local, sleep } from '../../lib/local.mjs';
import { settle, track } from './advance.mjs';
const engine = process.argv[2] || 'webkit';
const L = await local({ variant: 'typical', clock: 'real', engine });
try {
  const tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() });
  track(tv);
  await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock'); await tv.ctx.clock.runFor(2000); await settle(tv);
  await tv.page.evaluate(() => { window.__ticks = 0; new MutationObserver(() => window.__ticks++).observe(document.getElementById('clock'), { childList: true, characterData: true, subtree: true }); });
  const st = () => tv.page.evaluate(() => ({ now: new Date().toTimeString().slice(0, 8), ticks: window.__ticks, ...window.__tv.state(), sync: hub.sync.lastPull }));
  const a = await st(); console.log('before', JSON.stringify(a));
  await tv.ctx.clock.fastForward('10:00');
  const b = await st(); console.log('right after fastForward', JSON.stringify(b), 'lastFade moved:', b.lastFade > a.lastFade, 'lastFeed moved:', b.lastFeed > a.lastFeed);
  await settle(tv, { min: 300 });
  const c = await st(); console.log('after settle', JSON.stringify(c));
  await tv.ctx.clock.runFor(1500); await settle(tv, { min: 300 });
  const e = await st(); console.log('after runFor 1.5 s', JSON.stringify(e), 'lastFade moved:', e.lastFade > a.lastFade, 'lastFeed moved:', e.lastFeed > a.lastFeed, 'feed fetches', tv._track.byKind.activity);
} finally { await L.close(); }
