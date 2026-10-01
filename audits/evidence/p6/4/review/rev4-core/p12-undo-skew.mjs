// Probe 11: attacks on the by-value Undo (round 3): offline Undo; tick/untick inside the window; a double tap; another
// device that was offline across the reset and flushes an older tick afterwards.
import { local, sleep, DEMO, rows, texts, ready, rowMeta } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const on = (r, p) => Object.keys(r).filter(k => k.startsWith(p) && r[k] !== false && r[k] != null).length;
const sum = r => ({ done: on(r, 'done:'), log: on(r, 'log:'), mem: on(r, 'mem:'), recall: on(r, 'recall:'), week: r['f260.week'], best: r['f260.best'] && r['f260.best'].n, ws: Object.keys(r['f260.weekStart'] || {}).length, d380: r['done:38-0'], d451: r['done:45-1'], d452: r['done:45-2'] });
const reset = async (fa, A) => { await fa.evaluate(() => { document.getElementById('settingsBtn').click(); document.getElementById('resetBtn').click(); document.getElementById('doConfirm').click(); }); await A.ctx.clock.runFor(1500); await sleep(800); await fa.evaluate(() => hub.flush()); await sleep(800); };
const undo = async (fa, A, n = 1) => { await fa.evaluate(n => { const b = document.querySelector('#hub-toast .toast-act'); for (let i = 0; i < n; i++) b.click(); }, n); await A.ctx.clock.runFor(1500); await sleep(1200); };
try {
  let A, fa;
  // (b) inside the window: re-tick then untick a reading the snapshot had (38-0), tick then untick one it did not (45-1); (c) double tap
  await L.reset('typical');
  A = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO }); fa = await A.openApp('f260'); await ready(fa);
  await reset(fa, A); var SKA = await fa.evaluate(() => hub.skew);
  { const B1 = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + (+process.env.BSKEW || 0) }); const fb1 = await B1.openApp('f260'); await ready(fb1);
    for (const id of ['38-0', '45-1']) { await fb1.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), id); await B1.ctx.clock.runFor(300); await fb1.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), id); await B1.ctx.clock.runFor(300); }
    await fb1.evaluate(() => hub.flush()); await sleep(1000); out.b_mid = sum(await rows(L, 'eli')); out.skewB = await fb1.evaluate(() => hub.skew); await B1.close(); }
  await undo(fa, A, 2); await fa.evaluate(() => hub.flush()); await sleep(2000);
  out.bc = { server: sum(await rows(L, 'eli')), shown: await texts(fa, ['#doneCount']), errors: A.logs.filter(l => /error|reject/i.test(l)).slice(0, 4) };
  await A.close();
  for (const k of ["log:2026-09-22","done:38-0","done:45-1"]) { const m = await rowMeta(L, "eli", k); out["meta "+k] = m && { v: m.value, at: m.updated_at }; }
  out.skewA = SKA;
} catch (e) { out.err = String(e && e.stack || e); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
