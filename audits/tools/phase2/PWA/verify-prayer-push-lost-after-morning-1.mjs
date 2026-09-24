// Phase 2 / PWA — skeptic #1 for finding "prayer-push-lost-after-morning" (independent of push.mjs).
//   node "audits/tools/phase2/PWA/verify-prayer-push-lost-after-morning-1.mjs"
// Claim: a family prayer added after the 8 am run is never pushed to adults who already got the 8 am prayer push:
//   the 8 pm run skips them (once-a-day gate, worker/src/reminders.js:51-55, 61) but still advances the watermark
//   (reminders.js:182), so the next morning's run no longer sees the prayer as new.
// Runs two scenarios on the local rig (demo clock moved with L.clock; the job is forced through
// POST /api/admin/cron/run, which calls the same JOBS.prayer(env, now) the scheduled runCron() calls, index.js:541-546,
// reminders.js:246-260) with a stand-in push service (scripts/push-receiver.mjs) that decrypts every push:
//   A  morning announcement happens (Mom's prayer before 8 am), then Dad adds "Job interview for Sam" at 12:30.
//   B  control: no morning announcement; Dad adds the same prayer at 12:30.
// For each, prints each run's new/notified/skipped and, at the end, who ever received a push naming Dad's prayer
// through Fri 8 am. Writes audits/evidence/p2/PWA/verify-prayer-push-lost-after-morning-1.json.
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
let baseSub = null, buf = ''; const pushes = [];
rx.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
    const m = /^PUSH #\d+ url=(\S+) .*payload=(.*)$/.exec(line);
    if (m) { let p; try { p = JSON.parse(m[2]); } catch { p = { body: m[2] }; } pushes.push({ to: m[1].split('/').pop(), body: p.body, tag: p.tag }); }
  }
});
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) throw new Error('push receiver did not start');

const L = await local({ variant: 'typical', clock: 'demo', vapid: true });
const report = { scenarios: {} };
const DAD = 'Job interview for Sam';

async function scenario(name, withMorning) {
  const steps = [];
  const adults = L.S.profiles.filter(p => p.kind === 'adult').map(p => p.id);
  for (const id of adults) {
    const r = await L.apiAs(id, '/api/push/subscribe', { method: 'POST', body: { subscription: { ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${name}-${id}` } } });
    if (r.status !== 200) throw new Error('subscribe ' + id + ' → ' + r.status + JSON.stringify(r.body));
  }
  const mark = pushes.length;
  const at = iso => L.clock(iso);
  const run = async label => {
    const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } });
    await sleep(500);
    const b = r.body;
    const s = { label, status: r.status, new: (b.new || []).map(n => `${n.title} [by ${n.by}]`), seeded: b.seeded || null,
      notified: (b.notified || []).map(n => n.profile), skipped: (b.skipped || []).map(x => `${x.profile}:${x.why}`) };
    steps.push(s); console.log(`  [${name}] ${label}: ` + JSON.stringify(s));
  };
  const pray = async (who, id, title, forWhom, created) => {
    const r = await L.apiAs(who, `/api/data/prayer/prayer:${id}?scope=family`, { method: 'PUT', body: { value: { id, title, for: forWhom, by: who, category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt: created, lastPrayedAt: null, prayedBy: {}, updates: [] } } });
    steps.push({ label: `${who} PUT prayer:${id} "${title}"`, status: r.status }); console.log(`  [${name}] ${who} adds "${title}" → ${r.status}`);
  };

  await at('2026-09-22T20:00:00-04:00'); await run('Tue 8:00 pm run (seeds watermark)');
  if (withMorning) { await at('2026-09-23T07:30:00-04:00'); await pray('mom', 'v1a', 'Safe travel for Aunt Ruth', 'Aunt Ruth', '2026-09-23'); }
  await at('2026-09-23T08:00:00-04:00'); await run('Wed 8:00 am run');
  await at('2026-09-23T12:30:00-04:00'); await pray('dad', 'v1b', DAD, 'Sam', '2026-09-23');
  await at('2026-09-23T20:00:00-04:00'); await run('Wed 8:00 pm run');
  await at('2026-09-24T08:00:00-04:00'); await run('Thu 8:00 am run');
  await at('2026-09-24T20:00:00-04:00'); await run('Thu 8:00 pm run');
  await at('2026-09-25T08:00:00-04:00'); await run('Fri 8:00 am run');

  const mine = pushes.slice(mark).filter(p => p.to.startsWith(name + '-'));
  const got = Object.fromEntries(adults.map(id => [id, mine.filter(p => p.to === `${name}-${id}` && String(p.body).includes(DAD)).length]));
  const never = adults.filter(id => id !== 'dad' && !got[id]);
  console.log(`  [${name}] pushes naming "${DAD}" per adult (Wed 12:30 → Fri 8 am): ` + JSON.stringify(got));
  console.log(`  [${name}] adults (other than the author, dad) who NEVER got it: ` + JSON.stringify(never));
  report.scenarios[name] = { withMorning, adults, steps, receivedNamingDadPrayer: got, neverAnnounced: never, allPushes: mine };
}

try {
  console.log('Scenario A: a prayer was announced at 8 am; Dad adds another at 12:30');
  await scenario('A', true);
  await L.reset('typical');
  console.log('\nScenario B (control): nothing announced at 8 am; Dad adds the same prayer at 12:30');
  await scenario('B', false);
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-prayer-push-lost-after-morning-1.json'), JSON.stringify(report, null, 1));
  console.log('\nwrote audits/evidence/p2/PWA/verify-prayer-push-lost-after-morning-1.json');
  await L.close(); rx.kill();
}
