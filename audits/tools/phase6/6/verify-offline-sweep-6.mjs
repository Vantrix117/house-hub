// Batch 6, core review round 1 (H1): a device that is offline, or whose first pull after waking fails, must never sweep
// (or clear) from its stale cache. Before the fix, "fresh data" was only "this window has pulled once", so A — offline for
// 12 minutes while B paused A's timer — saw the timer "ended 11 minutes ago" in its cache and tombstoned it; the tombstone,
// stamped later, beat B's pause on the house. Now hub.timers.sweep / clear act only right after a pull that has just
// succeeded (hub.js justPulled), and the Worker's conditional 10-minute tombstone covers a device that never comes back.
// After the fix: A's queue holds no tombstone, the house keeps B's paused timer, B and the mirror still show it paused.
// Also: a Stop made offline waits (nothing is removed until a good pull), then removes the row once A is back.
//   node audits/tools/phase6/6/verify-offline-sweep-6.mjs      (local rig, Chromium, about a minute)
// Evidence: audits/evidence/p6/6/verify-offline-sweep-6.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p6/6'); fs.mkdirSync(OUT, { recursive: true });
const R = { checks: [] }; let fail = 0;
const ok = (c, name, v) => { R.checks.push({ ok: !!c, name, v }); if (!c) fail++; console.log(c ? '  ✓' : '  ✗', name, c ? '' : JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const rows = async pid => (((await L.apiAs(pid, '/api/data/timer?scope=person')).body.items) || []).filter(i => /^timer/.test(i.key));
const mir = async () => (((await L.apiAs('eli', '/api/data/timer?scope=family')).body.items) || []).filter(i => /^run:/.test(i.key));
const ready = d => d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && hub.isLoaded('timer', 'person'), null, { timeout: 30000 });
const drain = d => d.page.evaluate(async () => { for (let i = 0; i < 20; i++) { await hub.flush(); if (!hub.sync.pending) break; await new Promise(r => setTimeout(r, 250)); } });
try {
  console.log('## a paused timer survives the sweep of a device that was offline (H1)');
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() });
  const B = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await A.goto('#home'); await B.goto('#home'); await ready(A); await ready(B);
  const r = await A.page.evaluate(async () => { const r = hub.timers.start({ total: 60000, label: 'h1' }); await hub.flush(); return r; });
  await B.page.evaluate(() => hub.pull()); await sleep(500);
  await A.setOffline(true); await sleep(300);
  const p = await B.page.evaluate(async id => { const x = hub.timers.list().find(y => y.id === id); const q = hub.timers.pause(x); await hub.flush(); return q; }, r.id);
  ok(p && p.pausedAt > 0, 'B pauses the timer while A is offline', p);
  await A.ctx.clock.fastForward(12 * 60000); await sleep(1500);   // twelve minutes pass on A: its cache says "ended 11 minutes ago"
  const seen = await A.page.evaluate(id => hub.timers.list({ stale: true }).filter(x => x.id === id).map(x => x.state), r.id);
  await A.page.evaluate(() => hub.pull()); await sleep(800);       // a pull that cannot reach the house
  await A.page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); }); await sleep(500);
  const q = await A.page.evaluate(() => Object.assign({}, ...Object.keys(localStorage).filter(k => k === 'hub.queue.timer.person.eli' || k.startsWith('hub.queue.timer.person.eli.')).map(k => JSON.parse(localStorage.getItem(k) || '{}'))));
  ok(seen.join() === 'stale' && !q['timer:' + r.id], `A (offline, its cache says "${seen.join()}") queues no tombstone after a failed pull`, { seen, q });
  await A.setOffline(false);
  await A.page.evaluate(() => hub.pull()); await drain(A); await sleep(800);
  const srv = (await rows('eli')).filter(x => x.key === 'timer:' + r.id).map(x => x.value);
  ok(srv.length === 1 && srv[0] && srv[0].pausedAt > 0 && srv[0].endAt == null, 'after A is back the house still has B\'s paused timer', srv);
  const bView = await B.page.evaluate(async id => { await hub.pull(); return hub.timers.list().filter(x => x.id === id).map(x => x.state); }, r.id);
  const aView = await A.page.evaluate(id => hub.timers.list().filter(x => x.id === id).map(x => x.state), r.id);
  ok(bView.join() === 'paused' && aView.join() === 'paused', 'B and A both show it paused', { bView, aView });
  const m = (await mir()).filter(x => x.key === 'run:eli:' + r.id).map(x => x.value);
  ok(m.length === 1 && m[0] && m[0].pausedAt > 0, 'its family mirror says paused too', m);

  console.log('## a Stop made offline waits for a good pull');
  await A.setOffline(true); await sleep(300);
  await A.page.evaluate(id => { const x = hub.timers.get(id); return hub.timers.clear(x.id, x.startedAt); }, r.id); await sleep(800);
  const q2 = await A.page.evaluate(() => Object.assign({}, ...Object.keys(localStorage).filter(k => k === 'hub.queue.timer.person.eli' || k.startsWith('hub.queue.timer.person.eli.')).map(k => JSON.parse(localStorage.getItem(k) || '{}'))));
  const hid = await A.page.evaluate(id => !hub.timers.list().some(x => x.id === id), r.id);
  ok(hid && !q2['timer:' + r.id], 'offline: Stop hides it on A at once, and nothing is written yet', { hid, q2 });
  await A.setOffline(false);
  await A.page.evaluate(() => hub.pull()); await sleep(600); await drain(A); await sleep(600);
  const srv2 = (await rows('eli')).filter(x => x.key === 'timer:' + r.id).map(x => x.value);
  ok(srv2.length === 1 && srv2[0] === null, 'back online, the first good pull removes it from the house', srv2);
  await A.close(); await B.close();
} catch (e) { fail++; console.log('  ✗ crashed', e.stack || e); }
finally { fs.writeFileSync(path.join(OUT, 'verify-offline-sweep-6.json'), JSON.stringify(R, null, 1)); await L.close(); }
console.log(`\n${R.checks.filter(c => c.ok).length} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
