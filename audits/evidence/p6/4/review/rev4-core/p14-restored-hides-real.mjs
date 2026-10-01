// Probe 14 (round 4): can restored:<date> hide a REAL tick made today after an Undo?
// Reset -> Undo (38-0/38-1 are written back and listed). Later today the person unticks 38-1 and ticks it again (a real
// tick: today is logged). Then a mis-tap: tick Acts 6 (38-2) and untick it. Does today stay logged?
import { local, sleep, DEMO, rows, texts, ready } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const tap = async (f, A, id) => { await f.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), id); await A.ctx.clock.runFor(400); };
try {
  await L.reset('typical');
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO }); const f = await A.openApp('f260'); await ready(f);
  const today = await f.evaluate(() => hub.today());
  await f.evaluate(() => { document.getElementById('settingsBtn').click(); document.getElementById('resetBtn').click(); document.getElementById('doConfirm').click(); });
  await A.ctx.clock.runFor(1500); await sleep(600);
  await f.evaluate(() => document.querySelector('#hub-toast .toast-act').click()); await A.ctx.clock.runFor(1500); await sleep(1500);
  await f.evaluate(() => hub.flush()); await sleep(1000);
  let r = await rows(L, 'eli');
  out.afterUndo = { restoredLen: (r['restored:' + today] || []).length, has381: (r['restored:' + today] || []).includes('38-1'), log: r['log:' + today], doneCount: (await texts(f, ['#doneCount']))['#doneCount'] };
  await A.ctx.clock.fastForward(120000);   // two minutes later, same day
  await tap(f, A, '38-1'); await tap(f, A, '38-1');            // untick, re-tick: a real tick today
  await f.evaluate(() => hub.flush()); await sleep(800);
  r = await rows(L, 'eli');
  out.afterRetick = { d381: r['done:38-1'], log: r['log:' + today], kind: (await texts(f, ['#todayKind']))['#todayKind'] };
  await A.ctx.clock.fastForward(60000);
  await tap(f, A, '38-2'); await tap(f, A, '38-2');            // mis-tap on Acts 6: tick, untick
  await f.evaluate(() => hub.flush()); await sleep(800); await A.ctx.clock.runFor(2500); await sleep(800); await f.evaluate(() => hub.flush()); await sleep(800);
  r = await rows(L, 'eli');
  out.afterMisTap = { d381: r['done:38-1'], d382: r['done:38-2'], log: r['log:' + today], kind: (await texts(f, ['#todayKind']))['#todayKind'], streak: (await texts(f, ['#todayStreak']))['#todayStreak'], readers: (await L.apiAs('eli', '/api/f260/readers')).body.readers };
  out.restoredKeys = Object.keys(r).filter(k => k.startsWith('restored:'));
} catch (e) { out.err = String(e && e.stack || e); }
finally { await L.close(); }
console.log(JSON.stringify(out));
