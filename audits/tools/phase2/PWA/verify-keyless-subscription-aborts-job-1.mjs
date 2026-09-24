// Phase 2 / PWA — skeptic #1 for "keyless-subscription-aborts-job".
//   node "audits/tools/phase2/PWA/verify-keyless-subscription-aborts-job-1.mjs"
// Claim: POST /api/push/subscribe accepts {endpoint} with no keys; the reminder jobs then throw on that person
// (encrypt() reads subscription.keys.p256dh), so every adult after them gets nothing, every day, and the row is never removed.
// Part A (the rig over HTTP, forced jobs via POST /api/admin/cron/run as Eli):
//   A1 baseline Wed 8:00 — all adults valid → who is notified
//   A2 Mae (christian) re-subscribes the Kitchen iPad with {endpoint} only → status
//   A3 Thu 8:00 morning → status + who received;  A4 Fri 8:00 morning → again (every day? row still there?)
//   A5 prayer job with the keyless row: Eli adds a family prayer, the prayer job runs → who hears; then after the fix
//      the prayer job again → is the prayer still announced to the others?
//   A6 fix Mae's row (valid keys) → Fri 8:00 morning again → who receives
//   A7 a kid (Ezra) saves a keyless row → Sat 8:00 morning is unaffected? (scope of "any signed-in profile")
// Part B (in process, the real scheduled() handler — the path the production cron takes, which the rig cannot trigger):
//   the Worker's default export .scheduled() at Thu 8:00 NY with Mae's keyless row → the logged 'cron' result.
// Writes audits/evidence/p2/PWA/verify-keyless-subscription-aborts-job-1.json
process.env.TZ = 'America/New_York';
import { local, sleep } from '../../lib/local.mjs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

// ── stand-in push service ─────────────────────────────────────────────────────
const rxPort = await freePort();
const rx = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
let baseSub = null; const pushes = []; let buf = '';
rx.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
    const m = /^PUSH #\d+ url=(\S+) .* payload=(.*)$/.exec(line);
    if (m) { let p; try { p = JSON.parse(m[2]); } catch { p = { title: m[2] }; } pushes.push({ to: m[1].split('/').pop(), title: p.title }); }
  }
});
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) throw new Error('push receiver did not start');
const subFor = pid => ({ ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${pid}` });
const keyless = pid => ({ endpoint: `http://127.0.0.1:${rxPort}/push/${pid}` });
let mark = 0;
const received = async () => { await sleep(700); const n = pushes.slice(mark); mark = pushes.length; return n.map(p => `${p.to}:${p.title}`); };

const result = { A: {}, B: {} };
const say = (k, v) => { console.log(`\n== ${k}\n${typeof v === 'string' ? v : JSON.stringify(v, null, 1)}`); return v; };

// ── Part A ───────────────────────────────────────────────────────────────────
const L = await local({ variant: 'typical', clock: 'demo', vapid: true });
try {
  const adults = L.S.profiles.filter(p => p.kind === 'adult').map(p => p.id);
  result.A.adultsInSortOrder = say('adults (sort order as the job walks them)', adults);
  for (const pid of adults) await L.apiAs(pid, '/api/push/subscribe', { method: 'POST', body: { subscription: subFor(pid) } });
  const job = async (job, iso) => {
    await L.clock(iso);
    const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job } });
    const b = r.body || {};
    return { at: iso, job, status: r.status, notified: (b.notified || []).map(n => `${n.profile}(ok ${n.ok})`), skipped: (b.skipped || []).map(s => `${s.profile}:${s.why}`), error: r.status >= 400 ? b : undefined, received: await received() };
  };
  const errLines = () => L.serverLog.join('').split('\n').filter(l => /TypeError|p256dh|keys/.test(l)).slice(0, 4);

  result.A.A1 = say('A1 baseline Wed 23 Sep 8:00 morning, every adult subscribed with keys', await job('morning', '2026-09-23T08:00:00-04:00'));

  const s = await L.apiAs('christian', '/api/push/subscribe', { method: 'POST', body: { subscription: keyless('christian') } });
  result.A.A2 = say('A2 Mae (christian) POST /api/push/subscribe {endpoint} only', `${s.status} ${JSON.stringify(s.body)}`);

  result.A.A3 = say('A3 Thu 24 Sep 8:00 morning with the keyless row', await job('morning', '2026-09-24T08:00:00-04:00'));
  result.A.A3.serverErr = say('A3 server stderr (TypeError lines)', errLines());
  result.A.A4 = say('A4 Fri 25 Sep 8:00 morning, next day, row untouched', await job('morning', '2026-09-25T08:00:00-04:00'));

  // prayer job: seed the watermark, Eli adds a family prayer, the next run with Mae's keyless row
  await job('prayer', '2026-09-25T08:10:00-04:00');
  await L.clock('2026-09-25T12:00:00-04:00');
  const pr = await L.apiAs('eli', '/api/data/prayer/prayer:kx1?scope=family', { method: 'PUT', body: { value: { id: 'kx1', title: 'Skeptic test prayer', by: 'eli', category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt: '2026-09-25', prayedBy: {}, updates: [] }, updated_at: Date.parse('2026-09-25T12:00:00-04:00') } });
  say('A5 Eli adds a family prayer', `${pr.status}`);
  result.A.A5 = say('A5 Fri 8:00 pm prayer job with the keyless row', await job('prayer', '2026-09-25T20:00:00-04:00'));

  const f = await L.apiAs('christian', '/api/push/subscribe', { method: 'POST', body: { subscription: subFor('christian') } });
  say('A6 Mae re-subscribes with keys', `${f.status}`);
  result.A.A6 = say('A6 Fri 25 Sep 8:05 morning after the fix', await job('morning', '2026-09-25T08:05:00-04:00'));
  result.A.A6prayer = say('A6 Fri 8:05 pm prayer job after the fix (is the Eli prayer still announced?)', await job('prayer', '2026-09-25T20:05:00-04:00'));

  const k = await L.apiAs('ezra', '/api/push/subscribe', { method: 'POST', body: { subscription: keyless('ezra') } });
  say('A7 Ezra (kid) POST keyless', `${k.status}`);
  result.A.A7 = say('A7 Sat 26 Sep 8:00 morning with only a kid keyless row', await job('morning', '2026-09-26T08:00:00-04:00'));
} finally { await L.close(); }

// ── Part B: the real scheduled() handler, in process ────────────────────────
{
  const RealDate = Date;
  let base = RealDate.parse('2026-09-24T08:00:00-04:00'); const t0 = RealDate.now();
  class FakeDate extends RealDate { constructor(...a) { if (a.length === 0) super(base + (RealDate.now() - t0)); else super(...a); } static now() { return base + (RealDate.now() - t0); } }
  globalThis.Date = FakeDate;
  const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
  const { seedDemo } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);
  const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
  const { webcrypto } = await import('node:crypto');
  const k = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', k.privateKey);
  const pub = Buffer.from(await webcrypto.subtle.exportKey('raw', k.publicKey)).toString('base64url');
  const DB = createD1(':memory:');
  await seedDemo(DB, { variant: 'typical', now: RealDate.parse('2026-09-22T08:40:00-04:00') });
  const env = { DB, VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: jwk.d, VAPID_SUBJECT: 'mailto:rig@example.invalid', ALLOWED_ORIGINS: 'http://localhost' };
  const adults = DB.sqlite.prepare("SELECT id FROM profiles WHERE kind = 'adult' ORDER BY sort_order").all().map(r => r.id);
  const dev = DB.sqlite.prepare('SELECT id FROM devices LIMIT 1').get().id;
  DB.sqlite.prepare('DELETE FROM push_subscriptions').run();
  for (const pid of adults) DB.sqlite.prepare('INSERT INTO push_subscriptions (profile_id, device_id, subscription, created_at) VALUES (?, ?, ?, ?)').run(pid, dev, JSON.stringify(pid === 'christian' ? keyless(pid) : subFor(pid)), Date.now());
  const logs = []; const origLog = console.log, origErr = console.error;
  console.log = (...a) => logs.push(a.map(String).join(' ')); console.error = (...a) => logs.push('ERR ' + a.map(String).join(' '));
  let threw = null;
  try { await worker.scheduled({ cron: '0 12,13 * * *', scheduledTime: Date.now() }, env, { waitUntil() {} }); } catch (e) { threw = String(e); }
  console.log = origLog; console.error = origErr;
  const cronLine = logs.find(l => l.startsWith('cron '));
  const out = cronLine ? JSON.parse(cronLine.slice(cronLine.indexOf('{'))) : null;
  result.B = say('B scheduled() Thu 24 Sep 8:00 NY, Mae keyless (real cron path)', {
    threw,
    ran: out && out.ran.map(r => ({ job: r.job, error: r.error, notified: (r.notified || []).map(n => n.profile), skipped: (r.skipped || []).map(s => `${s.profile}:${s.why}`) })),
    received: await received(),
    maeRowStillThere: !!DB.sqlite.prepare("SELECT 1 FROM push_subscriptions WHERE profile_id = 'christian'").get(),
    pushLogToday: DB.sqlite.prepare('SELECT profile_id, kind FROM push_log WHERE created_at >= ?').all(RealDate.parse('2026-09-24T00:00:00-04:00')),
  });
  globalThis.Date = RealDate;
  DB.close && DB.close();
}
rx.kill();
fs.writeFileSync(path.join(OUT, 'verify-keyless-subscription-aborts-job-1.json'), JSON.stringify(result, null, 1));
console.log('\nwrote audits/evidence/p2/PWA/verify-keyless-subscription-aborts-job-1.json');
