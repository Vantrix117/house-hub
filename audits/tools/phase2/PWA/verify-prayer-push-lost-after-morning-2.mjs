// Phase 2 / PWA — skeptic #2 for finding "prayer-push-lost-after-morning".
//   node "audits/tools/phase2/PWA/verify-prayer-push-lost-after-morning-2.mjs"
// Independent rerun on a fresh local rig (never production):
//   - stand-in push service scripts/push-receiver.mjs (real VAPID + aes128gcm, decrypts every push);
//   - rig with a throwaway VAPID pair, demo clock moved with L.clock();
//   - every adult profile the rig has a session for subscribes through the real POST /api/push/subscribe;
//   - the prayer job is forced with POST /api/admin/cron/run {job:'prayer'} (runCron(env, now, 'prayer') calls the same
//     prayerJob(env, now) the 8 am / 8 pm scheduled run calls, worker/src/reminders.js:246-249, 253-255).
// Scenario A (the claim): Wed 7:30 Mom adds prayer A; Wed 8 am run; Wed 12:30 Dad adds prayer B; Wed 8 pm, Thu 8 am,
//   Thu 8 pm runs. Question: which adults ever receive a push naming prayer B?
// Scenario B (control): Fri, no morning announcement; Dad adds prayer C at 12:30; Fri 8 pm run. Does everyone but Dad hear?
// Writes audits/evidence/p2/PWA/verify-prayer-push-lost-after-morning-2.json.
import { local, sleep } from '../../lib/local.mjs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

const rxPort = await freePort();
const rx = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
let baseSub = null; const pushes = []; let buf = '';
rx.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
    const m = /^PUSH #(\d+) url=(\S+) .*payload=(.*)$/.exec(line);
    if (m) { let p; try { p = JSON.parse(m[3]); } catch { p = { raw: m[3] }; } pushes.push({ to: m[2].split('/').pop(), body: p.body, tag: p.tag }); }
  }
});
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) throw new Error('push receiver did not start');

const L = await local({ variant: 'typical', clock: 'demo', vapid: true });
const log = [];
const say = (title, obj) => { console.log('\n== ' + title); console.log(JSON.stringify(obj, null, 1)); log.push({ title, obj }); };
let mark = 0;
const fresh = async () => { await sleep(700); const n = pushes.slice(mark); mark = pushes.length; return n.map(p => `${p.to}: ${p.body}`); };
const run = async (label, iso) => {
  await L.clock(iso);
  const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } });
  const b = r.body || {};
  say(label + ' — prayer job at ' + iso, { status: r.status, new: b.new, seeded: b.seeded, notified: (b.notified || []).map(n => `${n.profile}(sent ${n.sent}, ok ${n.ok})`), skipped: (b.skipped || []).map(s => `${s.profile}:${s.why}`), received: await fresh() });
  return b;
};
const pray = async (who, id, title, forWhom, iso, createdAt) => {
  await L.clock(iso);
  const r = await L.apiAs(who, `/api/data/prayer/prayer:${id}?scope=family`, { method: 'PUT', body: { value: { id, title, for: forWhom, by: who, category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt, lastPrayedAt: null, prayedBy: {}, updates: [] }, updated_at: Date.parse(iso) } });
  say(`${who} adds family prayer "${title}" at ${iso}`, { status: r.status });
};

try {
  const adults = L.S.profiles.filter(p => p.kind === 'adult').map(p => p.id);
  const withSession = adults.filter(id => L.S.info.sessions[id]);
  const subs = {};
  for (const id of withSession) subs[id] = (await L.apiAs(id, '/api/push/subscribe', { method: 'POST', body: { subscription: { ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${id}` } } })).status;
  say('adult profiles / subscribed (POST /api/push/subscribe status)', { adults, subs });

  // Scenario A
  await run('baseline Tue 8 pm (seeds/clears the watermark)', '2026-09-22T20:00:00-04:00');
  await pray('mom', 'v2-a', 'Safe travel for Aunt Ruth', 'Aunt Ruth', '2026-09-23T07:30:00-04:00', '2026-09-23');
  await run('A: Wed 8 am', '2026-09-23T08:00:00-04:00');
  await pray('dad', 'v2-b', 'Job interview for Sam', 'Sam', '2026-09-23T12:30:00-04:00', '2026-09-23');
  await run('A: Wed 8 pm', '2026-09-23T20:00:00-04:00');
  await run('A: Thu 8 am', '2026-09-24T08:00:00-04:00');
  await run('A: Thu 8 pm', '2026-09-24T20:00:00-04:00');
  const heardB = [...new Set(pushes.filter(p => /Job interview for Sam/.test(p.body || '')).map(p => p.to))];
  const live = await L.apiAs('eli', '/api/data/prayer?scope=family');
  const rowsB = JSON.stringify(live.body).includes('Job interview for Sam');
  say('A summary: who ever received a push naming "Job interview for Sam"', { heardB, missedB: withSession.filter(id => id !== 'dad' && !heardB.includes(id)), prayerBStillLiveOnFamilyList: rowsB });

  // Scenario B (control): a day with no morning prayer push
  await run('B: Fri 8 am (nothing new)', '2026-09-25T08:00:00-04:00');
  await pray('dad', 'v2-c', 'Roof repair estimate', '', '2026-09-25T12:30:00-04:00', '2026-09-25');
  await run('B: Fri 8 pm', '2026-09-25T20:00:00-04:00');
  const heardC = [...new Set(pushes.filter(p => /Roof repair estimate/.test(p.body || '')).map(p => p.to))];
  say('B summary: who received a push naming "Roof repair estimate"', { heardC });

  fs.writeFileSync(path.join(OUT, 'verify-prayer-push-lost-after-morning-2.json'), JSON.stringify({ rxPort, log, pushes }, null, 1));
} finally {
  await L.close();
  rx.kill();
}
