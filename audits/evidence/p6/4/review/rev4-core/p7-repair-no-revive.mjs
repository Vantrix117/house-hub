// Probe 7: repairLog must never revive a day the person really unticked once both devices have synced.
import { local, sleep, DEMO, rows, texts, ready } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const settle = async (devs) => { for (const [d, f] of devs) { await f.evaluate(() => hub.flush()).catch(() => {}); } await sleep(500); for (const [d, f] of devs) { await f.evaluate(() => hub.pull()).catch(() => {}); await d.ctx.clock.runFor(2600); } await sleep(1200); for (const [d, f] of devs) { await f.evaluate(() => hub.flush()).catch(() => {}); } await sleep(800); };
try {
  await L.reset('typical');
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  const fa = await A.openApp('f260'); await ready(fa);
  const today = await fa.evaluate(() => hub.today());
  const B = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + 1000 });
  const fb = await B.openApp('f260'); await ready(fb);
  // case 1: A ticks Acts 6 (synced); B pulls, B unticks it; both sync and repair
  await fa.evaluate(() => document.getElementById('todayDone').click()); await A.ctx.clock.runFor(1000);
  await settle([[A, fa], [B, fb]]);
  out.c1afterTick = { log: (await rows(L, 'eli'))['log:' + today] };
  await B.ctx.clock.fastForward(30000);
  await fb.evaluate(() => { const m = document.querySelector('[data-day="38-2"] .mark'); if (m.closest('.day').classList.contains('done')) m.click(); }); await B.ctx.clock.runFor(1000);
  await settle([[B, fb], [A, fa]]); await settle([[A, fa], [B, fb]]);
  let r = await rows(L, 'eli');
  out.c1 = { log: r['log:' + today], d382: r['done:38-2'], a: await texts(fa, ['#todayKind']), b: await texts(fb, ['#todayKind']), readers: (await L.apiAs('eli', '/api/f260/readers')).body.readers };
  // case 2: A ticks 38-2 offline; B ticks 45-0 and unticks it; A online -> repaired true; then A unticks 38-2 -> must stay false
  await A.ctx.clock.fastForward(60000); await B.ctx.clock.fastForward(60000);
  await A.setOffline(true);
  await fa.evaluate(() => document.querySelector('[data-day="38-2"] .mark').click()); await A.ctx.clock.runFor(500);
  await B.ctx.clock.fastForward(5000);
  await fb.evaluate(() => document.querySelector('[data-day="45-0"] .mark').click()); await B.ctx.clock.runFor(500);
  await B.ctx.clock.fastForward(3000);
  await fb.evaluate(() => document.querySelector('[data-day="45-0"] .mark').click()); await B.ctx.clock.runFor(500);
  await fb.evaluate(() => hub.flush()); await sleep(600);
  out.c2afterB = { log: (await rows(L, 'eli'))['log:' + today] };
  await A.ctx.clock.fastForward(5000); await A.setOffline(false);
  await settle([[A, fa], [B, fb]]); await settle([[B, fb], [A, fa]]);
  out.c2repaired = { log: (await rows(L, 'eli'))['log:' + today], a: await texts(fa, ['#todayKind']), b: await texts(fb, ['#todayKind']) };
  await A.ctx.clock.fastForward(60000); await B.ctx.clock.fastForward(60000);
  await fa.evaluate(() => document.querySelector('[data-day="38-2"] .mark').click()); await A.ctx.clock.runFor(500);
  await settle([[A, fa], [B, fb]]); await settle([[B, fb], [A, fa]]); await settle([[A, fa], [B, fb]]);
  r = await rows(L, 'eli');
  out.c2final = { log: r['log:' + today], d382: r['done:38-2'], a: await texts(fa, ['#todayKind']), b: await texts(fb, ['#todayKind']), readers: (await L.apiAs('eli', '/api/f260/readers')).body.readers };
} catch (e) { out.err = String(e && e.stack || e); }
finally { await L.close(); }
console.log(JSON.stringify(out));
