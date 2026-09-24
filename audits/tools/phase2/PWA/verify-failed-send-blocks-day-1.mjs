// Phase 2 / PWA — skeptic #1 for "failed-send-blocks-day": does a push that FAILED count towards the once-a-day gate?
//   node "audits/tools/phase2/PWA/verify-failed-send-blocks-day-1.mjs"
// Independent of push.mjs. Isolates the gate from the prayer job's watermark (which advances whether or not the push
// was delivered) by using jobs that re-evaluate the same condition on every run:
//   A. morning (leftovers) forced at Wed 8:00 am, then forced again at 8:30 am (the admin's "retry": POST /api/admin/cron/run).
//        niece  = subscribed, her push service answers 503 (a transient error; the subscription is kept, not "gone")
//        mom    = NO subscription at 8:00 (control: nothing logged), subscribes at 8:15
//        dad    = subscribed, works (control: a delivered push correctly blocks the second run)
//   B. park at Thu 8:00 am and Thu 8:00 pm (the two scheduled runs park rides along on), same stale-kid condition both times.
//        niece  = endpoint unreachable (connection refused) at 8 am, fixed before 8 pm
//        christian = no subscription at 8 am, subscribes before 8 pm (control)
// Prints each run's notified/skipped lists, what the stand-in push service decrypted, and push_log per profile (Admin → Usage).
// Writes audits/evidence/p2/PWA/verify-failed-send-blocks-day-1.{json,txt}.
import { local, sleep } from '../../lib/local.mjs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const lines = []; const log = { steps: [] };
const say = (t, o) => { const s = '\n== ' + t + (o === undefined ? '' : '\n' + (typeof o === 'string' ? o : JSON.stringify(o, null, 1))); console.log(s); lines.push(s); log.steps.push({ t, o }); };

// the stand-in push service (decrypts and prints every push)
const rxPort = await freePort();
const rx = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
let baseSub = null; const pushes = []; let buf = '';
rx.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
    const m = /^PUSH #\d+ url=(\S+) .*payload=(.*)$/.exec(line);
    if (m) { let p; try { p = JSON.parse(m[2]); } catch { p = m[2]; } pushes.push({ to: m[1].split('/').pop(), title: p.title, body: p.body }); }
  }
});
// a push service that is having a bad minute: every request gets 503
const flaky = http.createServer((req, res) => { req.resume(); req.on('end', () => { res.writeHead(503); res.end('service unavailable'); }); });
const flakyPort = await freePort();
await new Promise(r => flaky.listen(flakyPort, '127.0.0.1', r));
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) throw new Error('push receiver did not start');
const good = pid => ({ ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${pid}` });
const e503 = pid => ({ ...baseSub, endpoint: `http://127.0.0.1:${flakyPort}/push/${pid}` });
const refused = async pid => ({ ...baseSub, endpoint: `http://127.0.0.1:${await freePort()}/push/${pid}` });

const L = await local({ variant: 'typical', clock: 'demo', vapid: true });
let mark = 0;
const received = async () => { await sleep(600); const n = pushes.slice(mark); mark = pushes.length; return n.map(p => `${p.to}: ${p.title} — ${p.body}`); };
const run = async job => {
  const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job } });
  const b = r.body || {};
  return { status: r.status, notified: (b.notified || []).map(n => `${n.profile}(sent ${n.sent}, ok ${n.ok}${n.details ? ', status ' + n.details.map(d => d.status + (d.error ? ' ' + String(d.error).slice(0, 40) : '')).join('/') : ''})`), skipped: (b.skipped || []).map(s => `${s.profile}:${s.why}`), stale: b.stale, parkDay: b.parkDay, due: b.due && b.due.length, received: await received() };
};
const sub = (pid, s) => L.apiAs(pid, '/api/push/subscribe', { method: 'POST', body: { subscription: s } });
const unsub = pid => L.apiAs(pid, '/api/push/subscribe', { method: 'DELETE' });
const pushLog = async (day, kind) => ((await L.apiAs('eli', '/api/admin/usage')).body.push || []).filter(r => r.day === day && r.kind === kind).map(r => `${r.profile_id}: sends ${r.sends}, ok ${r.ok}`);

try {
  const adults = L.S.profiles.filter(p => p.kind === 'adult').map(p => p.id);
  say('adults on the rig (adultIds order)', adults.join(', '));
  for (const p of L.S.profiles) await unsub(p.id);                 // start clean: no subscriptions anywhere

  // ── A. morning (leftovers): forced at 8:00, then forced again at 8:30 after the push service recovers ─────────
  await L.clock('2026-09-23T08:00:00-04:00');
  await sub('dad', good('dad'));
  await sub('niece', e503('niece'));
  say('A1. Wed 8:00 am — morning job; niece\'s push service answers 503, mom has no subscription yet, dad works', await run('morning'));
  say('A1. push_log (Admin → Usage) for leftovers on 2026-09-23 UTC', await pushLog('2026-09-23', 'leftovers'));
  const subsAfter = (await L.apiAs('eli', '/api/admin/usage')).body.push_subscriptions;
  say('A1. push_subscriptions after the 503 (kept: a 503 is not "gone")', subsAfter);
  await L.clock('2026-09-23T08:15:00-04:00');
  await sub('niece', good('niece'));                                   // her push service is back
  await sub('mom', good('mom'));                                       // mom turns notifications on for the first time
  await L.clock('2026-09-23T08:30:00-04:00');
  say('A2. Wed 8:30 am — the admin forces the morning job again (a retry)', await run('morning'));

  // ── B. park: the 8 am and 8 pm scheduled runs (forced here at those NY times) with the same stale-kid condition ──
  for (const p of L.S.profiles) await unsub(p.id);
  const markers = async iso => {
    const now = Date.parse(iso);
    await L.apiAs('eli', '/api/data/dollywood-live/loc:eli?scope=family', { method: 'PUT', body: { value: { x: .5, y: .5, acc: 8, t: now - 3 * 60000, name: 'eli' }, updated_at: now } });
    await L.apiAs('ezra', '/api/data/dollywood-live/loc:ezra?scope=family', { method: 'PUT', body: { value: { x: .4, y: .4, acc: 8, t: now - 45 * 60000, name: 'ezra' }, updated_at: now } });
  };
  await L.clock('2026-09-24T08:00:00-04:00');
  await markers('2026-09-24T08:00:00-04:00');
  await sub('dad', good('dad'));
  await sub('niece', await refused('niece'));
  say('B1. Thu 8:00 am — park job; niece\'s endpoint refuses connections, christian has no subscription yet, dad works', await run('park'));
  say('B1. push_log for park on 2026-09-24 UTC', await pushLog('2026-09-24', 'park'));
  await L.clock('2026-09-24T19:55:00-04:00');
  await sub('niece', good('niece'));
  await sub('christian', good('christian'));
  await L.clock('2026-09-24T20:00:00-04:00');
  await markers('2026-09-24T20:00:00-04:00');
  say('B2. Thu 8:00 pm — park job again, same condition; niece\'s push service is back, christian subscribed at 7:55 pm', await run('park'));
  say('B2. push_log for park (UTC day 2026-09-25 holds the 8 pm NY run)', { '2026-09-24': await pushLog('2026-09-24', 'park'), '2026-09-25': await pushLog('2026-09-25', 'park') });
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-failed-send-blocks-day-1.json'), JSON.stringify(log, null, 1));
  fs.writeFileSync(path.join(OUT, 'verify-failed-send-blocks-day-1.txt'), lines.join('\n') + '\n');
  await L.close(); rx.kill(); flaky.close();
}
