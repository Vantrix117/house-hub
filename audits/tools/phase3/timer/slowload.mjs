// A first open on a new device while the first pull is slow (local rig, WebKit, typical seed, real clock).
// Elizabeth (mom) has a 15-minute timer running on the server (seed). A brand-new device for her (empty localStorage)
// opens the Kitchen timer from the Apps tab while every /api/data/timer request is held for 9 s (hub.ready gives up after
// 6 s, apps/hub.js:337). What does the app show, do taps work, and what does one tap on Start do to her running timer?
// Run: node "audits/tools/phase3/timer/slowload.mjs"   Output: audits/evidence/p3/timer/slowload.json + PNGs
import { local, sleep } from '../../lib/local.mjs';
import { save, shot, appState, pillState, serverTimer } from './_util.mjs';
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  out.serverBefore = await serverTimer(L, 'mom');
  const nd = await L.newDevice({ name: 'Mom new phone', profiles: ['mom'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: nd });
  let held = 0;
  await d.ctx.route(/\/api\/data\/timer\?/, async r => { held++; await sleep(9000); await r.continue().catch(() => {}); });
  const t0 = Date.now();
  await d.goto('#timer');
  let f; for (let i = 0; i < 80 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForSelector('#go');
  await sleep(1500);
  out.at1_5s = { app: await appState(f), shell: await pillState(d.page), hubReady: await f.evaluate(() => !!(window.hub && hub.profile)) };
  await f.click('#go');                                   // a tap before hub.ready resolves
  await sleep(500);
  out.tapBeforeReady = await appState(f);
  out.shotLoading = await shot(d.page, 'slowload-at-2s-iphone.png');
  // wait for hub.ready's 6 s race to end (the pull is still held)
  await sleep(Math.max(0, 6800 - (Date.now() - t0)));
  out.afterReadyTimeout = await appState(f);
  await f.click('#go'); const tapAt = Date.now();         // she taps Start on what looks like an idle timer
  await sleep(600);
  out.afterStartTap = await appState(f);
  // let the held pulls land and the queue flush
  await sleep(12000);
  await f.evaluate(() => hub.pull()); await d.page.evaluate(() => hub.pull()); await sleep(1500);
  out.afterPullLanded = { app: await appState(f), shell: await pillState(d.page) };
  out.serverAfter = await serverTimer(L, 'mom');
  out.heldRequests = held;
  out.tapAtOffsetMs = tapAt - t0;
  out.shotAfter = await shot(d.page, 'slowload-after-iphone.png');
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('slowload.json', out));
