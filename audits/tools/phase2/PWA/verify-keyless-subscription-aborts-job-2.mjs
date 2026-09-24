// Skeptic #2 for finding "keyless-subscription-aborts-job" (Phase 2 / PWA). Local only, never production.
//   node "audits/tools/phase2/PWA/verify-keyless-subscription-aborts-job-2.mjs"
// Part A (the rig over HTTP, a fresh L): every adult subscribes through the real POST /api/push/subscribe to the stand-in
//   push service (scripts/push-receiver.mjs); Mae (christian) then re-subscribes with {endpoint} only. The admin's forced
//   morning job (POST /api/admin/cron/run) is run on three days: keyless row present Sat + Sun, fixed on Mon.
//   Observes: HTTP status, who actually received a decrypted push, and whether Mae's row is still stored (admin usage).
// Part B (in-process, the REAL scheduled path, which the rig does not expose): worker default export .scheduled() on an
//   in-memory D1 seeded with the demo household, a throwaway VAPID pair, outbound fetch stubbed to 201 and recorded.
//   Runs the 8 pm (Fri, all rows valid: seeds the prayer watermark), then a new family prayer by David, then Mae's row made
//   keyless, then the 8 am runs Sat and Sun, then Mae's row fixed, Mon 8 am. Prints the cron's own log line per run and
//   which endpoints were hit per run, so one can see which jobs the per-job try/catch in runCron saves and which it does not.
// Writes audits/evidence/p2/PWA/verify-keyless-subscription-aborts-job-2.json.
import { local, sleep } from '../../lib/local.mjs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const evidence = { partA: [], partB: [] };
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

// ───────────────────────────── Part A ─────────────────────────────
{
  const rxPort = await freePort();
  const rx = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let baseSub = null, buf = ''; const got = [];
  rx.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
      const m = /^PUSH #\d+ url=(\S+)/.exec(line); if (m) got.push(m[1].split('/').pop());
    }
  });
  for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
  if (!baseSub) throw new Error('push receiver did not start');
  const subFor = pid => ({ ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${pid}` });
  const L = await local({ variant: 'typical', clock: 'demo', vapid: true });
  const A = (title, obj) => { console.log('[A] ' + title + ' → ' + JSON.stringify(obj)); evidence.partA.push({ title, obj }); };
  let mark = 0; const fresh = async () => { await sleep(700); const n = got.slice(mark); mark = got.length; return n; };
  try {
    const adults = L.S.profiles.filter(p => p.kind === 'adult').map(p => p.id);
    A('adults (sort order)', adults);
    for (const pid of adults) await L.apiAs(pid, '/api/push/subscribe', { method: 'POST', body: { subscription: subFor(pid) } });
    const bad = await L.apiAs('christian', '/api/push/subscribe', { method: 'POST', body: { subscription: { endpoint: `http://127.0.0.1:${rxPort}/push/christian-bad` } } });
    A('Mae POSTs {endpoint} with no keys', { status: bad.status, body: bad.body });
    const morning = async (iso) => {
      await L.clock(iso);
      const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } });
      const usage = await L.apiAs('eli', '/api/admin/usage');
      return { at: iso, status: r.status, error: r.body && r.body.error, notified: (r.body.notified || []).map(n => n.profile), due: r.body.due, received: await fresh(),
        subsStored: Object.fromEntries((usage.body.push_subscriptions || []).map(s => [s.profile_id, s.n])) };
    };
    A('Sat 26 Sep 8:00 am forced morning, keyless row present', await morning('2026-09-26T08:00:00-04:00'));
    A('Sun 27 Sep 8:00 am forced morning, keyless row still present', await morning('2026-09-27T08:00:00-04:00'));
    await L.apiAs('christian', '/api/push/subscribe', { method: 'POST', body: { subscription: subFor('christian') } });
    A('Mon 28 Sep 8:00 am forced morning, Mae re-subscribed with keys', await morning('2026-09-28T08:00:00-04:00'));
  } finally { await L.close(); rx.kill(); }
}

// ───────────────────────────── Part B ─────────────────────────────
{
  const B = (title, obj) => { console.log('[B] ' + title + ' → ' + JSON.stringify(obj)); evidence.partB.push({ title, obj }); };
  const RealDate = Date; let NOW = RealDate.parse('2026-09-25T20:00:00-04:00');
  globalThis.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(NOW); else super(...a); } static now() { return NOW; } };
  const hits = [];
  globalThis.fetch = async (input) => { const url = typeof input === 'string' ? input : input.url; hits.push(url.split('/').pop()); return new Response('', { status: 201 }); };
  const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
  const { seedDemo } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);
  const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
  const DB = createD1(':memory:');
  await seedDemo(DB, { variant: 'typical', now: RealDate.parse('2026-09-22T08:40:00-04:00') });
  const s = webcrypto.subtle;
  const vk = await s.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const env = { DB, ALLOWED_ORIGINS: 'http://localhost', VAPID_PUBLIC_KEY: Buffer.from(await s.exportKey('raw', vk.publicKey)).toString('base64url'),
    VAPID_PRIVATE_KEY: (await s.exportKey('jwk', vk.privateKey)).d, VAPID_SUBJECT: 'mailto:rig@example.invalid' };
  const ua = await s.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const keys = { p256dh: Buffer.from(await s.exportKey('raw', ua.publicKey)).toString('base64url'), auth: Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString('base64url') };
  const sql = DB.sqlite;
  const adults = sql.prepare("SELECT id FROM profiles WHERE kind = 'adult' ORDER BY sort_order").all().map(r => r.id);
  const setSub = (pid, sub) => sql.prepare(`INSERT INTO push_subscriptions (profile_id, device_id, subscription, created_at) VALUES (?, 'rig-kitchen-ipad', ?, ?)
    ON CONFLICT(profile_id, device_id) DO UPDATE SET subscription = excluded.subscription`).run(pid, JSON.stringify(sub), NOW);
  for (const pid of adults) setSub(pid, { endpoint: `http://127.0.0.1:9/push/${pid}`, keys });
  B('adults (sort order), all subscribed with valid keys', adults);
  const origLog = console.log; const origErr = console.error;
  const tick = async (iso, label) => {
    NOW = RealDate.parse(iso); hits.length = 0; let cronLine = null;
    console.log = (...a) => { if (a[0] === 'cron') cronLine = JSON.parse(a[2]); else origLog(...a); };
    console.error = () => {};
    try { await worker.scheduled({ cron: '0 12,13 * * *' }, env, { waitUntil() {} }); } finally { console.log = origLog; console.error = origErr; }
    const ran = (cronLine && cronLine.ran || []).map(j => ({ job: j.job, error: j.error || null, notified: (j.notified || []).map(n => n.profile), new: j.new && j.new.map(x => x.title) }));
    const row = sql.prepare("SELECT subscription FROM push_subscriptions WHERE profile_id = 'christian'").get();
    B(label, { at: iso, nyHour: cronLine && cronLine.nyHour, ran, endpointsHit: [...hits], maeRowStored: row ? row.subscription : null });
  };
  await tick('2026-09-25T20:00:00-04:00', 'Fri 8:00 pm scheduled run, all rows valid (baseline + prayer watermark)');
  // David adds a family prayer before the Saturday run: everyone but David should hear about it at 8 am
  sql.prepare(`INSERT INTO app_data (scope, profile_id, app_id, key, value, updated_at, synced_at) VALUES ('family', NULL, 'prayer', 'prayer:verify-k2', ?, ?, ?)`)
    .run(JSON.stringify({ id: 'verify-k2', title: 'Safe travel for the Hendersons', by: 'dad', category: 'Family', status: 'active', createdAt: '2026-09-26', prayedBy: {}, updates: [] }), NOW + 3600000, NOW + 3600000);
  setSub('christian', { endpoint: 'http://127.0.0.1:9/push/christian-bad' });
  await tick('2026-09-26T08:00:00-04:00', 'Sat 8:00 am scheduled run, Mae keyless');
  await tick('2026-09-27T08:00:00-04:00', 'Sun 8:00 am scheduled run, Mae still keyless');
  setSub('christian', { endpoint: 'http://127.0.0.1:9/push/christian', keys });
  await tick('2026-09-28T08:00:00-04:00', 'Mon 8:00 am scheduled run, Mae fixed');
  globalThis.Date = RealDate;
  DB.close && DB.close();
}
fs.writeFileSync(path.join(OUT, 'verify-keyless-subscription-aborts-job-2.json'), JSON.stringify(evidence, null, 1));
console.log('wrote audits/evidence/p2/PWA/verify-keyless-subscription-aborts-job-2.json');
process.exit(0);
