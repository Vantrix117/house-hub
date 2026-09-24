// Completeness critic: a genuinely frozen page, real clock. Standalone Kitchen timer as Eli (no shell, so only the app's
// own code acts). Freeze = the V8 debugger paused through CDP (Chromium): no script and no timer callback runs until thaw.
// (Page.setWebLifecycleState 'frozen' was tried first and had no effect on a visible headless page.)
//  F1 accuracy: a 60 s timer, frozen for 20 s, then running again: is the time right within one tick of waking?
//  F2 the app's own finish on wake (the P2-STAB-13 variant Phase 2 left "by code, not run", audits/02-shell.md:3547):
//     Eli's timer R1 ends while the phone is frozen; meanwhile Eli starts R2 (10 min) on another device (API write).
//     The phone wakes: does its finish() -> write(null) (apps/timer.html:102, 91) delete R2 on the server?
// Run: node "audits/tools/phase3/timer/critic-frozen-wake.mjs"  -> audits/evidence/p3/timer/critic-frozen-wake.json
import { local, sleep } from '../../lib/local.mjs';
import { save, audioProbe, serverTimer } from './_util.mjs';
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const st = p => p.evaluate(() => ({ now: Date.now(), t: document.getElementById('t').textContent, go: document.getElementById('go').textContent, done: document.body.classList.contains('done'), beeps: window.__audio ? window.__audio.made : null, cache: (hub.get('timer.active') || null) }));
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await audioProbe(d.ctx);
  const cdp = await d.ctx.newCDPSession(d.page);
  const posts = out.posts = [];
  d.page.on('request', r => { if (r.method() === 'POST' && /batch/.test(r.url())) posts.push({ at: Date.now(), body: r.postData() }); });
  d.page.on('response', async r => { if (r.request().method() === 'POST' && /batch/.test(r.url())) posts.push({ at: Date.now(), status: r.status(), res: (await r.text().catch(() => '')).slice(0, 300) }); });
  await cdp.send('Debugger.enable');
  let paused = false;
  cdp.on('Debugger.paused', () => { paused = true; });
  cdp.on('Debugger.resumed', () => { paused = false; });
  const log = out.freezeLog = [];
  const freeze = async label => { await cdp.send('Debugger.pause'); for (let i = 0; i < 60 && !paused; i++) await sleep(50); log.push({ label, pausedAt: Date.now(), paused }); };
  const thaw = async label => { await cdp.send('Debugger.resume'); log.push({ label, resumedAt: Date.now() }); };
  await d.page.goto(L.site + '/apps/timer.html', { waitUntil: 'load' });
  for (let i = 0; i < 100; i++) { if (await d.page.evaluate(() => typeof document.getElementById('go').onclick === 'function')) break; await sleep(100); }
  // F1
  await d.page.click('[data-s="60"]'); await d.page.click('#go'); await sleep(1200);
  const f1 = out.F1 = { before: await st(d.page) };
  await freeze('F1');
  await sleep(20000);
  await thaw('F1');
  await sleep(400);
  f1.after = await st(d.page);
  const endAt = f1.before.cache && f1.before.cache.endAt;
  f1.expectedLeft = Math.round((endAt - f1.after.now) / 1000);
  // F2
  await d.page.click('#reset'); await sleep(1500);
  let now = Date.now();
  await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: now + 8000, total: 60, startedAt: now - 52000 }, updated_at: now }] } });
  await d.page.evaluate(() => hub.pull()); await sleep(800);
  const f2 = out.F2 = { runningR1: await st(d.page) };
  await freeze('F2');
  await sleep(12000);                                   // R1 ends while frozen
  now = Date.now();
  await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: now + 600000, total: 600, startedAt: now }, updated_at: now }] } });
  f2.r2WrittenAt = now;
  f2.serverWithR2 = await serverTimer(L, 'eli');
  await sleep(1000);
  await thaw('F2');
  await sleep(3000);
  f2.phoneAfterWake = await st(d.page);
  f2.hubAfterWake = await d.hub(d.page);
  f2.serverAfterWake = await serverTimer(L, 'eli');
  await sleep(30000);                                   // the phone's next 30 s pull
  f2.phoneAfterNextPull = await st(d.page);
  f2.serverLater = await serverTimer(L, 'eli');
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('critic-frozen-wake.json', out));
