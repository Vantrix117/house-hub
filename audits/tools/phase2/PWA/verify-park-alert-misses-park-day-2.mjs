// Phase 2 / PWA — skeptic #2 for finding "park-alert-misses-park-day".
//   node "audits/tools/phase2/PWA/verify-park-alert-misses-park-day-2.mjs"
//
// Part A — the REAL scheduled path, not the forced admin route. In one Node process (never production) it:
//   * builds a fresh in-memory D1 (audits/tools/lib/d1.mjs) seeded with the demo household (audits/tools/seed.mjs, 'typical'),
//     deletes the seed's loc:* markers so only this scenario's markers exist,
//   * subscribes every adult to a tiny local push receiver (a throwaway VAPID pair, real worker/src/push.js encryption),
//   * simulates a Dollywood day on Sat 26 Sep 2026 (EDT): from 09:30 to 20:30 New York, every 10 min Eli's park map
//     publishes loc:eli (the adult has the map open all day — the best case for the alert), and Ezra's beacon publishes
//     loc:ezra until the minute he "goes quiet" (Q), then never again,
//   * calls the Worker's own `scheduled()` handler (worker/src/index.js:593) at every instant the wrangler.toml cron
//     fires (worker/wrangler.toml:25: 12:00, 13:00, 00:00, 01:00 UTC) from Sat 8 am through Sun 9 am, and records each
//     run's park result and every push the receiver got.
//   One fresh database per scenario Q, so the once-a-day push_log gate never hides anything.
// Part B — the investigator's own reproduction on a fresh harness instance (local(), forced 'park' job at Sun 8 pm).
// Writes audits/evidence/p2/PWA/verify-park-alert-misses-park-day-2.json and prints a table.
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });

// ── a controllable clock for the in-process Worker (Part A only) ──────────────
const RealDate = Date;
let NOW = RealDate.parse('2026-09-26T06:00:00-04:00');
class SimDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}
globalThis.Date = SimDate;
globalThis.caches ||= { default: { async match() { return undefined; }, async put() {} } };

const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
const { seedDemo, DEVICE, sessionToken } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);

const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

// ── the stand-in push service: records who got what, answers 201 ────────────────
const received = [];
const rxPort = await freePort();
const rx = http.createServer((req, res) => { req.resume(); req.on('end', () => { received.push({ to: req.url.split('/').pop(), at: NOW }); res.writeHead(201); res.end(); }); }).listen(rxPort, '127.0.0.1');
const subKeys = async () => {
  const k = await crypto.webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { p256dh: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', k.publicKey)).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') };
};
const vk = await crypto.webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const VAPID = { VAPID_PUBLIC_KEY: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', vk.publicKey)).toString('base64url'), VAPID_PRIVATE_KEY: (await crypto.webcrypto.subtle.exportKey('jwk', vk.privateKey)).d, VAPID_SUBJECT: 'mailto:rig@example.invalid' };

const ORIGIN = 'http://localhost:8765';
async function call(env, profile, method, p, body) {
  const r = await worker.fetch(new Request('http://api.local' + p, { method, headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(profile) }, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {}, passThroughOnException() {} });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
const ny = ms => new RealDate(ms).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' });

// the wrangler.toml cron instants (UTC) covering the park day and the next morning
const CRONS = [['2026-09-26T12:00:00Z', '0 12,13 * * *'], ['2026-09-26T13:00:00Z', '0 12,13 * * *'], ['2026-09-27T00:00:00Z', '0 0,1 * * *'], ['2026-09-27T01:00:00Z', '0 0,1 * * *'], ['2026-09-27T12:00:00Z', '0 12,13 * * *'], ['2026-09-27T13:00:00Z', '0 12,13 * * *']].map(([iso, cron]) => ({ at: RealDate.parse(iso), cron }));
const ARRIVE = RealDate.parse('2026-09-26T09:30:00-04:00'), LEAVE = RealDate.parse('2026-09-26T20:30:00-04:00');

async function scenario(quietAt) {
  NOW = RealDate.parse('2026-09-26T06:00:00-04:00');
  const DB = createD1(':memory:');
  const env = { DB, ALLOWED_ORIGINS: ORIGIN, ...VAPID };
  await seedDemo(DB, { variant: 'typical', now: NOW, assets: '' });
  DB.sqlite.prepare("DELETE FROM app_data WHERE app_id = 'dollywood-live' AND key LIKE 'loc:%'").run();
  DB.sqlite.prepare('DELETE FROM push_log').run();
  const adults = DB.sqlite.prepare("SELECT id FROM profiles WHERE kind = 'adult'").all().map(r => r.id);
  for (const id of adults) { const r = await call(env, id, 'POST', '/api/push/subscribe', { subscription: { endpoint: `http://127.0.0.1:${rxPort}/push/${id}`, keys: await subKeys() } }); if (r.status !== 200) throw new Error('subscribe ' + id + ' ' + r.status + JSON.stringify(r.body)); }
  const mark = received.length;
  // events: 10-minute publishes during the visit + the cron instants, in time order
  const events = [];
  for (let t = ARRIVE; t <= LEAVE; t += 10 * 60000) events.push({ at: t, kind: 'pub' });
  for (const c of CRONS) events.push({ at: c.at, kind: 'cron', cron: c.cron });
  events.sort((a, b) => a.at - b.at || (a.kind === 'pub' ? -1 : 1));
  const runs = [];
  for (const e of events) {
    NOW = e.at;
    if (e.kind === 'pub') {
      const loc = (pid, t) => call(env, pid, 'PUT', `/api/data/dollywood-live/loc:${pid}?scope=family`, { value: { x: 500, y: 500, acc: 8, hdg: null, t, name: pid, emoji: '•', color: '#888888' }, updated_at: t });
      const r1 = await loc('eli', NOW); if (r1.status !== 200) throw new Error('eli loc ' + r1.status + JSON.stringify(r1.body));
      if (NOW <= quietAt) { const r2 = await loc('ezra', NOW); if (r2.status !== 200) throw new Error('ezra loc ' + r2.status + JSON.stringify(r2.body)); }
      continue;
    }
    // the Worker's real scheduled() handler; it console.logs 'cron', event.cron, JSON(out)
    const logs = []; const orig = console.log; console.log = (...a) => logs.push(a);
    try { await worker.scheduled({ cron: e.cron, scheduledTime: NOW }, env, { waitUntil() {} }); } finally { console.log = orig; }
    const line = logs.find(a => a[0] === 'cron'); const out = line ? JSON.parse(line[2]) : null;
    const park = out && out.ran ? out.ran.find(j => j.job === 'park') : null;
    runs.push({ ny: ny(NOW), nyHour: out && out.nyHour, skipped: !!(out && out.skipped), ranJobs: out && out.ran ? out.ran.map(j => j.job) : [], park: park ? { parkDay: park.parkDay, markers: park.markers, stale: park.stale, notified: park.notified.map(n => n.profile) } : null });
  }
  const pushes = received.slice(mark);
  const parkLog = DB.sqlite.prepare("SELECT profile_id, ok, created_at FROM push_log WHERE kind = 'park' ORDER BY id").all().map(r => `${r.profile_id}@${ny(r.created_at)}${r.ok ? '' : ' (failed)'}`);
  try { DB.close ? DB.close() : DB.sqlite.close(); } catch {}
  const alertRun = runs.find(r => r.park && r.park.notified.length);
  return { quietAt: ny(quietAt), alerted: !!alertRun, alertAt: alertRun ? alertRun.ny : null, quietForMinAtAlert: alertRun ? alertRun.park.stale.map(s => s.ageMin) : null, parkPushLog: parkLog, allPushesReceived: pushes.map(p => `${p.to}@${ny(p.at)}`), runs };
}

const Qs = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '15:50', '16:10', '17:00', '18:00', '19:00', '19:20', '19:40', '20:00', '20:30'];
const results = [];
for (const q of Qs) results.push(await scenario(RealDate.parse(`2026-09-26T${q}:00-04:00`)));
globalThis.Date = RealDate;
rx.close();

console.log('Part A — the real scheduled() handler at every wrangler.toml cron instant, Sat 26 Sep 2026 park day (Eli publishing 09:30–20:30 every 10 min)');
console.log('cron runs per scenario:', results[0].runs.map(r => `${r.ny} → ${r.skipped ? 'skipped (NY hour ' + r.nyHour + ')' : 'ran ' + r.ranJobs.join('+')}`).join(' | '));
console.log('\nEzra goes quiet at | park alert? | when        | Ezra quiet (min) | push_log kind=park rows (each delivered to the local receiver)');
for (const r of results) console.log(`${r.quietAt.padEnd(18)} | ${String(r.alerted).padEnd(11)} | ${String(r.alertAt || '-').padEnd(11)} | ${String(r.quietForMinAtAlert || '-').padEnd(16)} | ${r.parkPushLog.join(', ') || 'none'}`);
const at8pm = results.map(r => ({ q: r.quietAt, run: r.runs.find(x => /8:00 PM/.test(x.ny) && /Sat/.test(x.ny)) }));
console.log('\nSat 8:00 pm park result per scenario (stale list):');
for (const x of at8pm) console.log(`  quiet ${x.q}: parkDay ${x.run.park.parkDay}, markers ${JSON.stringify(x.run.park.markers)}, stale ${JSON.stringify(x.run.park.stale)}`);

// ── Part B: the investigator's scenario, from scratch on a fresh harness instance ─────────────
const { local } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/local.mjs')).href);
const L = await local({ variant: 'typical', clock: 'demo' });
const partB = {};
try {
  const put = (who, pid, t) => L.apiAs(who, `/api/data/dollywood-live/loc:${pid}?scope=family`, { method: 'PUT', body: { value: { x: 0.5, y: 0.5, acc: 8, t, name: pid } } });
  await L.clock('2026-09-27T20:00:00-04:00');
  const now2 = RealDate.parse('2026-09-27T20:00:00-04:00');
  await put('eli', 'eli', now2 - 5 * 60000); await put('ezra', 'ezra', RealDate.parse('2026-09-27T11:00:00-04:00'));
  let r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'park' } });
  partB.quiet1100 = { status: r.status, parkDay: r.body.parkDay, markers: r.body.markers, stale: r.body.stale };
  // control: Ezra's marker rewritten as last seen at 17:00 (explicit updated_at so last-write-wins applies on the slow demo clock)
  await L.apiAs('ezra', '/api/data/dollywood-live/loc:ezra?scope=family', { method: 'PUT', body: { value: { x: 0.5, y: 0.5, acc: 8, t: RealDate.parse('2026-09-27T17:00:00-04:00'), name: 'ezra' }, updated_at: now2 + 60000 } });
  r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'park' } });
  partB.quiet1700 = { status: r.status, parkDay: r.body.parkDay, markers: r.body.markers, stale: r.body.stale };
} finally { await L.close(); }
console.log('\nPart B — fresh local() instance, forced park job at Sun 27 Sep 8:00 pm, Eli 5 min old:');
console.log('  Ezra quiet since 11:00 →', JSON.stringify(partB.quiet1100));
console.log('  Ezra quiet since 17:00 (control) →', JSON.stringify(partB.quiet1700));

fs.writeFileSync(path.join(OUT, 'verify-park-alert-misses-park-day-2.json'), JSON.stringify({ partA: results, partB }, null, 1));
console.log('\nwrote audits/evidence/p2/PWA/verify-park-alert-misses-park-day-2.json');
