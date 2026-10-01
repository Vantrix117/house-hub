// Probe 15 (round 5): the upTo rule across devices. A resets and undoes (38-1 written back, listed, upTo = A's stamps).
// Device B (pulled) re-ticks 38-1 a minute later while its clock reads SKEW ms behind the house (hub.skew shifted), then
// mis-taps Acts 6. Does the real re-tick count (today stays logged)? SKEW from env (ms; default 0 = control).
import { local, sleep, DEMO, rows, rowMeta, texts, ready } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const SKEW = +process.env.SKEW || 0;
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { SKEW };
const tap = async (f, D, id) => { await f.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), id); await D.ctx.clock.runFor(400); };
try {
  await L.reset('typical');
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO }); const fa = await A.openApp('f260'); await ready(fa);
  const today = await fa.evaluate(() => hub.today());
  await fa.evaluate(() => { document.getElementById('settingsBtn').click(); document.getElementById('resetBtn').click(); document.getElementById('doConfirm').click(); });
  await A.ctx.clock.runFor(1500); await sleep(600);
  await fa.evaluate(() => document.querySelector('#hub-toast .toast-act').click()); await A.ctx.clock.runFor(1500); await sleep(1500);
  await fa.evaluate(() => hub.flush()); await sleep(1200);
  let r = await rows(L, 'eli');
  const rk = Object.keys(r).filter(k => k.startsWith('restored:'));
  out.rows = rk.map(k => ({ k, n: r[k].ids.length, upTo: r[k].upTo }));
  out.d381meta = (await rowMeta(L, 'eli', 'done:38-1')).updated_at;
  const B = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + 60000 }); const fb = await B.openApp('f260'); await ready(fb);
  await fb.evaluate(() => hub.pull()); await B.ctx.clock.runFor(500); await sleep(500);
  out.skewB = await fb.evaluate(s => { hub.skew = (+hub.skew || 0) - s; return hub.skew; }, SKEW);
  await tap(fb, B, '38-1'); await tap(fb, B, '38-1');
  await fb.evaluate(() => hub.flush()); await sleep(800);
  out.retick = { at: (await rowMeta(L, 'eli', 'done:38-1')).updated_at, log: (await rows(L, 'eli'))['log:' + today], skewNow: await fb.evaluate(() => hub.skew) };
  await B.ctx.clock.fastForward(30000);
  await tap(fb, B, '38-2'); await tap(fb, B, '38-2');
  await fb.evaluate(() => hub.flush()); await sleep(800); await B.ctx.clock.runFor(2500); await sleep(600); await fb.evaluate(() => hub.flush()); await sleep(600);
  r = await rows(L, 'eli');
  out.final = { log: r['log:' + today], d381: r['done:38-1'], kind: (await texts(fb, ['#todayKind']))['#todayKind'], readers: (await L.apiAs('eli', '/api/f260/readers')).body.readers };
} catch (e) { out.err = String(e && e.stack || e); }
finally { await L.close(); }
console.log(JSON.stringify(out));
