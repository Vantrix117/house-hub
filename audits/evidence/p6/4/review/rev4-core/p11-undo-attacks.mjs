// Probe 11: attacks on the by-value Undo (round 3): offline Undo; tick/untick inside the window; a double tap; another
// device that was offline across the reset and flushes an older tick afterwards.
import { local, sleep, DEMO, rows, texts, ready } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const on = (r, p) => Object.keys(r).filter(k => k.startsWith(p) && r[k] !== false && r[k] != null).length;
const sum = r => ({ done: on(r, 'done:'), log: on(r, 'log:'), mem: on(r, 'mem:'), recall: on(r, 'recall:'), week: r['f260.week'], best: r['f260.best'] && r['f260.best'].n, ws: Object.keys(r['f260.weekStart'] || {}).length, d380: r['done:38-0'], d451: r['done:45-1'], d452: r['done:45-2'] });
const reset = async (fa, A) => { await fa.evaluate(() => { document.getElementById('settingsBtn').click(); document.getElementById('resetBtn').click(); document.getElementById('doConfirm').click(); }); await A.ctx.clock.runFor(1500); await sleep(800); await fa.evaluate(() => hub.flush()); await sleep(800); };
const undo = async (fa, A, n = 1) => { await fa.evaluate(n => { const b = document.querySelector('#hub-toast .toast-act'); for (let i = 0; i < n; i++) b.click(); }, n); await A.ctx.clock.runFor(1500); await sleep(1200); };
try {
  // (b0) does a tick inside the window take the Undo away on this device?
  await L.reset('typical');
  let A0 = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO }); let f0 = await A0.openApp('f260'); await ready(f0);
  await reset(f0, A0);
  await f0.evaluate(() => document.querySelector('[data-day="38-0"] .mark').click()); await A0.ctx.clock.runFor(300);
  out.b0_toastAfterTick = await f0.evaluate(() => { const t = document.getElementById('hub-toast'); return { text: t.textContent, hidden: t.hidden, undo: !!t.querySelector('.toast-act') }; });
  await A0.close();
  // (a) offline Undo
  await L.reset('typical');
  let A = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO }); let fa = await A.openApp('f260'); await ready(fa);
  await reset(fa, A);
  await A.setOffline(true); await sleep(300);
  const t0 = Date.now(); await undo(fa, A);
  out.a_offline = { ms: Date.now() - t0, shown: await texts(fa, ['#doneCount']), toast: await fa.evaluate(() => document.getElementById('hub-toast').textContent) };
  await A.setOffline(false); await sleep(300); await fa.evaluate(() => hub.flush()); await sleep(2500);
  out.a_server = sum(await rows(L, 'eli')); out.a_errors = A.logs.filter(l => /error|reject/i.test(l)).slice(0, 4);
  await A.close();
  // (b) inside the window: re-tick then untick a reading the snapshot had (38-0), tick then untick one it did not (45-1); (c) double tap
  await L.reset('typical');
  A = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO }); fa = await A.openApp('f260'); await ready(fa);
  await reset(fa, A);
  { const B1 = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + 4000 }); const fb1 = await B1.openApp('f260'); await ready(fb1);
    for (const id of ['38-0', '45-1']) { await fb1.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), id); await B1.ctx.clock.runFor(300); await fb1.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), id); await B1.ctx.clock.runFor(300); }
    await fb1.evaluate(() => hub.flush()); await sleep(1000); out.b_mid = sum(await rows(L, 'eli')); await B1.close(); }
  await undo(fa, A, 2); await fa.evaluate(() => hub.flush()); await sleep(2000);
  out.bc = { server: sum(await rows(L, 'eli')), shown: await texts(fa, ['#doneCount']), errors: A.logs.filter(l => /error|reject/i.test(l)).slice(0, 4) };
  await A.close();
  // (d) B offline across the reset: ticks 45-2 before A's reset, flushes after A's Undo
  await L.reset('typical');
  const B = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  const fb = await B.openApp('f260'); await ready(fb);
  await B.setOffline(true); await sleep(200);
  await fb.evaluate(() => document.querySelector('[data-day="45-2"] .mark').click()); await B.ctx.clock.runFor(500);
  A = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO + 2000 }); fa = await A.openApp('f260'); await ready(fa);
  await reset(fa, A); await undo(fa, A); await fa.evaluate(() => hub.flush()); await sleep(1500);
  out.d_afterUndo = sum(await rows(L, 'eli'));
  await B.ctx.clock.fastForward(20000); await B.setOffline(false); await sleep(300);
  await fb.evaluate(() => hub.flush()); await sleep(1500); await fb.evaluate(() => hub.pull()); await B.ctx.clock.runFor(2500); await sleep(1500); await fb.evaluate(() => hub.flush()); await sleep(1000);
  out.d_afterB = { server: sum(await rows(L, 'eli')), bShown: await texts(fb, ['#doneCount']) };
} catch (e) { out.err = String(e && e.stack || e); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
