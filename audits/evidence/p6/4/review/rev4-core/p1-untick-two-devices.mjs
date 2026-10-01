// Probe 1: can an untick on one device erase today's log while a reading ticked today on another device (offline, or
// not yet pulled) stands? Two devices on eli, controllable clocks.
import { local, sleep, DEMO, rows, texts, ready } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  await L.reset('typical');
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  const fa = await A.openApp('f260'); await ready(fa);
  const today = await fa.evaluate(() => hub.today());
  let r = await rows(L, 'eli');
  out.today = today; out.before = { log: r['log:' + today], todayCard: await texts(fa, ['#todayTitle', '#todayKind', '#todayDone']) };
  // A goes offline and ticks today's reading (Done)
  await A.setOffline(true); await sleep(300);
  await fa.evaluate(() => document.getElementById('todayDone').click()); await sleep(800);
  out.aAfterTick = await texts(fa, ['#todayKind', '#todayStreak']);
  const aTicked = await fa.evaluate(() => Object.keys(hub.list('done:').reduce((m, r) => (r.value && (m[r.key] = 1), m), {})).length);
  // a minute later B (online) ticks some other reading and unticks it again (a mis-tap)
  await A.ctx.clock.fastForward(60000);
  const B = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + 60000 });
  const fb = await B.openApp('f260'); await ready(fb);
  await fb.evaluate(() => { const m = document.querySelector('[data-day="45-0"] .mark'); m.click(); }); await sleep(600);
  out.bAfterTick = await texts(fb, ['#todayKind', '#todayStreak']);
  await B.ctx.clock.fastForward(5000);
  await fb.evaluate(() => { const m = document.querySelector('[data-day="45-0"] .mark'); m.click(); }); await sleep(600);
  await fb.evaluate(() => hub.flush()); await sleep(800);
  out.bAfterUntick = await texts(fb, ['#todayKind', '#todayStreak']);
  r = await rows(L, 'eli');
  out.serverAfterB = { log: r['log:' + today] };
  // A comes back online and flushes its tick
  await A.ctx.clock.fastForward(5000);
  await A.setOffline(false); await sleep(500);
  await fa.evaluate(() => hub.flush()); await sleep(1500);
  await fa.evaluate(() => hub.pull()); await sleep(1500);
  r = await rows(L, 'eli');
  const doneToday = Object.keys(r).filter(k => k.startsWith('done:'));
  out.serverAfterA = { log: r['log:' + today], summary: r['f260.summary'] && { readToday: r['f260.summary'].readToday, streak: r['f260.summary'].streak } };
  out.aView = await texts(fa, ['#todayKind', '#todayStreak', '#todayDone']);
  // reopen B to see what a device shows now
  await fb.evaluate(() => hub.pull()); await sleep(1500);
  out.bView = await texts(fb, ['#todayKind', '#todayStreak']);
  const readers = await L.apiAs('eli', '/api/f260/readers');
  out.readers = readers.body;
} catch (e) { out.err = String(e && e.stack || e); }
finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
