// Batch 6 copy of audits/tools/phase2/STAB/verify3-timer-cleared-by-sleeping-device-1.mjs (P2-STAB-13, with UX-TIMER-3).
// Why a copy: the data contract changed on purpose. The original reads the single row timer.active and starts timers with
// the old preset chips + Start; since batch 6 every timer is its own person-scope row timer:<id> (server ms) handled through
// hub.timers (apps/hub.js), and nothing clears a row at 0: an ended row stays until Stop (or 10 minutes), and a device
// clears a row only after a pull and only if the stored row is still the start it saw end. So this copy starts timers with
// hub.timers.start() in the shell (the defect is about clearing, not about the start buttons) and reads the timer: rows.
//
//   node audits/tools/phase6/6/verify3-timer-cleared-by-sleeping-device-1-6.mjs     (about 6 minutes, real clock)
//
// Local rig (typical seed, WebKit, real clock). Devices signed in as Elizabeth (mom):
//   A  = Mom's iPad, awake on Home the whole time.
//   B  = Mom's iPhone with a Playwright clock, "slept" as iOS freezes a backgrounded PWA (hidden + clock paused), woken
//        70 s after the end (clock set to now, visible).
//   C  = Mom's laptop, whose page is closed and reopened (a cold start) instead of slept.
//   P1  the candidate as written: the timer ends while B sleeps. Expected now: A rings at 0 and the row STAYS (no device
//       clears it at 0); B, woken 70 s later, rings too and reads "Ended at …" (UX-TIMER-3: no longer "no trace").
//   P2  A Stops the ended timer and starts a new 10-minute one before B wakes: the new one survives B's wake.
//   P3  the same row restarted on A (same id, a new start) while B sleeps; B wakes and taps Stop on the start it saw end:
//       the house keeps the new start (the startedAt rule, after a pull).
//   P4  as P2 with C cold-reopened: the new timer survives.
// Exit 0 only when every expectation holds. Evidence: audits/evidence/p6/6/verify3-timer-cleared-6.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p6/6');
fs.mkdirSync(OUT, { recursive: true });
const R = { steps: [], checks: [] };
const t0 = Date.now();
const log = (k, v) => { R.steps.push({ s: Math.round((Date.now() - t0) / 1000), k, v }); console.log(String(Math.round((Date.now() - t0) / 1000)).padStart(4), k.padEnd(64), typeof v === 'string' ? v : JSON.stringify(v)); };
let fail = 0;
const ok = (c, name, v) => { R.checks.push({ ok: !!c, name, v }); if (!c) fail++; console.log(c ? '  ✓' : '  ✗', name, c ? '' : JSON.stringify(v)); };
const until = async t => { const w = t - Date.now(); if (w > 0) await sleep(w); };
const L = await local({ variant: 'typical', clock: 'real' });

const instrument = ctx => ctx.addInitScript(() => {
  Object.defineProperty(Document.prototype, 'hidden', { get() { return !!window.__rigHidden; }, configurable: true });
  Object.defineProperty(Document.prototype, 'visibilityState', { get() { return window.__rigHidden ? 'hidden' : 'visible'; }, configurable: true });
});
const state = page => page.evaluate(() => {
  const p = document.getElementById('timer-pill');
  let rows = []; try { rows = hub.timers.list().map(r => ({ id: r.id, label: r.label, state: r.state, startedAt: r.startedAt })); } catch {}
  return { rings: (window.__timerShell || {}).rings || 0, pill: !p.hidden, ringing: p.classList.contains('ringing'), label: document.getElementById('timer-pill-label').textContent, rows };
});
const waitShell = page => page.waitForFunction(() => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === 'mom' && hub.sync.lastPull > 0, null, { timeout: 20000 });
async function sleepB(B) { await B.page.evaluate(() => { window.__rigHidden = true; document.dispatchEvent(new Event('visibilitychange')); }); await B.ctx.clock.pauseAt(await B.page.evaluate(() => Date.now()) + 50); }
async function wakeB(B) { await B.ctx.clock.setSystemTime(Date.now()); await B.page.evaluate(() => { window.__rigHidden = false; document.dispatchEvent(new Event('visibilitychange')); }); await B.ctx.clock.resume(); }
const start = (d, total, label, id) => d.page.evaluate(([t, l, i]) => { const r = hub.timers.start({ total: t, label: l, ...(i ? { id: i } : {}) }); return hub.flush().then(() => ({ id: r.id, startedAt: r.startedAt, endAt: r.endAt })); }, [total, label, id]);

try {
  const reader = await L.newDevice({ name: 'Reader (API only)', profiles: ['mom'] });
  const devA = await L.newDevice({ name: "Mom's iPad", profiles: ['mom'] });
  const devB = await L.newDevice({ name: "Mom's iPhone", profiles: ['mom'] });
  const devC = await L.newDevice({ name: "Mom's laptop", profiles: ['mom'] });
  const server = async () => { const r = await L.apiAs(null, '/api/data/timer?scope=person', { deviceToken: reader.device.token, profileToken: reader.sessions.mom }); return (r.body.items || []).filter(i => /^timer:/.test(i.key) && i.value).map(i => ({ id: i.value.id, label: i.value.label, startedAt: i.value.startedAt, endAt: i.value.endAt })); };
  const A = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false, as: devA });
  const B = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: Date.now(), as: devB });
  let C = await L.device({ device: 'desktop', profile: 'mom', fixedTime: false, as: devC });
  for (const d of [A, B, C]) await instrument(d.ctx);
  for (const d of [A, B, C]) { await d.goto('#home'); await waitShell(d.page); }
  // a clean slate: none of Mom's seeded timers
  await A.page.evaluate(() => { for (const r of hub.timers.list({ stale: true })) hub.timers.clear(r.id, r.startedAt); return new Promise(r => setTimeout(r, 1500)).then(() => hub.flush()); });
  log('slate: server timers', await server());

  // ── P1 ──
  const t1 = await start(A, 60000, 'P1');
  await B.page.evaluate(() => hub.pull()); await sleep(800);
  log('P1 timer (1 min) started on A; ends', new Date(t1.endAt).toISOString());
  log('P1 B before sleep', await state(B.page));
  await sleepB(B);
  await until(t1.endAt + 4000);
  const a1 = await state(A.page); log('P1 A at end+4 s', a1);
  ok(a1.rings >= 1 && a1.ringing, 'P1: A rang at 0 and its pill says time is up', a1);
  const s1 = await server(); log('P1 server at end+4 s', s1);
  ok(s1.some(x => x.id === t1.id && x.startedAt === t1.startedAt), 'P1: no device cleared the row at 0 (it stays until Stop)', s1);
  await until(t1.endAt + 70000);
  await wakeB(B); await sleep(3000);
  const b1 = await state(B.page); log('P1 B 3 s after waking at end+70 s', b1);
  ok(b1.rings >= 1 && b1.ringing && /^Ended at /.test(b1.label), 'P1: B, woken 70 s after the end, rings and reads "Ended at …" (UX-TIMER-3: not "no trace")', b1);
  ok((await server()).some(x => x.id === t1.id), 'P1: B\'s wake cleared nothing', await server());
  await A.page.click('#timer-pill'); await sleep(2500); await A.page.evaluate(() => hub.flush());
  await B.page.evaluate(() => hub.pull()); await sleep(1200);
  const b1b = await state(B.page); log('P1 after A\'s Stop: B', b1b);
  ok(!(await server()).some(x => x.id === t1.id) && !b1b.pill, 'P1: Stop on A removes the row; B stops ringing on its next pull', { server: await server(), b1b });

  // ── P2 ──
  const t2 = await start(A, 60000, 'P2a');
  await B.page.evaluate(() => hub.pull()); await sleep(800);
  await sleepB(B);
  await until(t2.endAt + 4000);
  await A.page.click('#timer-pill'); await sleep(2500);          // Stop the ended one…
  const t2b = await start(A, 600000, 'P2b');                     // …and start the sauce
  log('P2 A stopped P2a and started P2b (10 min); server', await server());
  await until(t2.endAt + 70000);
  await wakeB(B); await sleep(4000);
  const s2 = await server(); log('P2 server 4 s after B woke', s2);
  ok(s2.some(x => x.id === t2b.id && x.startedAt === t2b.startedAt) && !s2.some(x => x.id === t2.id), 'P2: the new 10-minute timer survives B\'s wake (and the stopped one stays stopped)', s2);
  const a2 = await state(A.page);
  ok(a2.pill && !a2.ringing && a2.rows.some(r => r.id === t2b.id && r.state === 'running'), 'P2: A still shows it running', a2);
  const b2 = await state(B.page);
  ok(b2.rows.some(r => r.id === t2b.id && r.state === 'running'), 'P2: B shows the new timer after its wake', b2);
  await A.page.evaluate(id => { const r = hub.timers.get(id); return hub.timers.clear(r.id, r.startedAt); }, t2b.id); await sleep(1500); await A.page.evaluate(() => hub.flush());

  // ── P3: the same row restarted ──
  const t3 = await start(A, 60000, 'P3', 'samerow');
  await B.page.evaluate(() => hub.pull()); await sleep(800);
  await sleepB(B);
  await until(t3.endAt + 4000);
  const re = await A.page.evaluate(() => { const r = hub.timers.get('samerow'), now = hub.serverNow(); hub.timers.put({ ...r, startedAt: now, endAt: now + 600000, pausedAt: null, remaining: null, total: 600000 }); return hub.flush().then(() => now); });
  log('P3 A restarted the same row (samerow) with a new start', new Date(re).toISOString());
  await until(t3.endAt + 70000);
  await B.ctx.clock.setSystemTime(Date.now()); await B.ctx.clock.resume();
  const seen = await B.page.evaluate(() => { const r = hub.timers.get('samerow'); return r && r.startedAt; });
  log('P3 B on waking (before any pull) holds the start', seen);
  // B taps Stop on what it shows (the old start, ended) at once, before its pull lands
  await B.page.evaluate(start0 => hub.timers.clear('samerow', start0), seen);
  await B.page.evaluate(() => { window.__rigHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(4000);
  const s3 = await server(); log('P3 server 4 s after B\'s Stop', s3);
  ok(seen === t3.startedAt && s3.some(x => x.id === 'samerow' && x.startedAt === re), 'P3: B\'s Stop of the start it saw end never removes the newer start of the same row (P2-STAB-13)', { seen, s3 });
  await A.page.evaluate(() => { const r = hub.timers.get('samerow'); return r && hub.timers.clear(r.id, r.startedAt); }); await sleep(1500); await A.page.evaluate(() => hub.flush());

  // ── P4: C closed and reopened ──
  const t4 = await start(A, 60000, 'P4a');
  await C.page.evaluate(() => hub.pull()); await sleep(800);
  await C.close();
  await until(t4.endAt + 4000);
  await A.page.click('#timer-pill'); await sleep(2500);
  const t4b = await start(A, 600000, 'P4b');
  await until(t4.endAt + 70000);
  C = await L.device({ device: 'desktop', profile: 'mom', fixedTime: false, as: devC });
  await instrument(C.ctx); await C.goto('#home'); await waitShell(C.page); await sleep(4000);
  const s4 = await server(); log('P4 server 4 s after C reopened', s4);
  ok(s4.some(x => x.id === t4b.id && x.startedAt === t4b.startedAt), 'P4: the new timer survives C\'s cold reopen', s4);
  const c4 = await state(C.page);
  ok(c4.rows.some(r => r.id === t4b.id && r.state === 'running') && c4.pill, 'P4: C shows it running', c4);
  await A.page.evaluate(id => { const r = hub.timers.get(id); return r && hub.timers.clear(r.id, r.startedAt); }, t4b.id); await sleep(1500);
} catch (e) { fail++; console.log('  ✗ crashed:', e.stack || e); R.error = String(e && e.stack || e); }
finally {
  fs.writeFileSync(path.join(OUT, 'verify3-timer-cleared-6.json'), JSON.stringify(R, null, 1));
  await L.close();
}
console.log(`\n${R.checks.filter(c => c.ok).length} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
