// Batch 6, core review round 1: two documents in one tab — the shell and the Timer app's frame — write different rows of the
// same app and scope within a few milliseconds while offline. Each hub.js keeps an in-memory copy of the write queue
// hub.queue.timer.person.<pid> and saved it whole to the one localStorage key, so the second save replaced the first
// document's queued row before its storage event arrived: a write lost for good. The fix (apps/hub.js saveQueue) merges the
// stored queue into the document's copy by key (newest updated_at wins) before every save. After the fix every row of every
// pair is in the queue, and all of them reach the house once the device is back online.
//   node audits/tools/phase6/6/verify-queue-merge-6.mjs      (local rig, Chromium, under a minute)
// Evidence: audits/evidence/p6/6/verify-queue-merge-6.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p6/6'); fs.mkdirSync(OUT, { recursive: true });
const R = { checks: [] }; let fail = 0;
const ok = (c, name, v) => { R.checks.push({ ok: !!c, name, v }); if (!c) fail++; console.log(c ? '  ✓' : '  ✗', name, c ? '' : JSON.stringify(v).slice(0, 600)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const N = 12;
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await d.openApp('timer', { wait: '#go' });
  await f.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 });
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 });
  await d.setOffline(true); await sleep(300);
  const P = { app: 'timer', scope: 'person' }, run = Date.now().toString(36);
  for (let i = 0; i < N; i++) {
    // the shell and the frame each write their own row at (nearly) the same instant
    await Promise.all([
      d.page.evaluate(([k, P]) => { hub.set(k, { by: 'shell' }, { ...P, unloaded: true }); }, [`probe:${run}:s${i}`, P]),
      f.evaluate(k => { hub.set(k, { by: 'app' }, { unloaded: true }); }, `probe:${run}:a${i}`),
    ]);
  }
  await sleep(500);
  const q = await d.page.evaluate(() => Object.keys(Object.assign({}, ...Object.keys(localStorage).filter(k => k === 'hub.queue.timer.person.eli' || k.startsWith('hub.queue.timer.person.eli.')).map(k => JSON.parse(localStorage.getItem(k) || '{}')))));
  const want = [...Array(N).keys()].flatMap(i => [`probe:${run}:s${i}`, `probe:${run}:a${i}`]);
  const missing = want.filter(k => !q.includes(k));
  R.missingFromQueue = missing;
  ok(!missing.length, `offline, ${N} pairs written at once by the shell and the Timer frame: all ${want.length} rows are in the stored queue (missing ${missing.length})`, missing);
  await d.setOffline(false);
  for (let i = 0; i < 30; i++) { await d.page.evaluate(() => hub.flush()); await f.evaluate(() => hub.flush()); const n = await d.page.evaluate(() => hub.sync.pending); if (!n) break; await sleep(300); }
  const srv = (((await L.apiAs('eli', '/api/data/timer?scope=person&prefix=probe:' + run)).body.items) || []).filter(x => x.value).map(x => x.key);
  const lost = want.filter(k => !srv.includes(k));
  R.lostOnServer = lost;
  ok(!lost.length, `back online, every row reaches the house (lost ${lost.length})`, lost);
  await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: want.map(key => ({ key, value: null, updated_at: Date.now() })) } });
  await d.close();
} catch (e) { fail++; console.log('  ✗ crashed', e.stack || e); }
finally { fs.writeFileSync(path.join(OUT, 'verify-queue-merge-6.json'), JSON.stringify(R, null, 1)); await L.close(); }
console.log(`\n${R.checks.filter(c => c.ok).length} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
