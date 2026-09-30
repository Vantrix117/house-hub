#!/usr/bin/env node
// The park alert (reminders.js parkJob), in process: the real Worker (worker/src/index.js) on the audit rig's in-memory D1
// (audits/tools/lib/d1.mjs) with the demo household, a stand-in push receiver and a controllable clock, because the rule
// is about time passing: a kid's dot the house has not heard from for 20 min, while an adult's is fresh, on a park day.
// The house's own clock decides (when a row reached it), never the phone's `t`. Each quiet spell is told once per person.
//   node scripts/test-park.mjs          (no Worker, no network; Node 22.5+ for node:sqlite)
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RealDate = Date; let NOW = RealDate.parse('2026-09-26T10:00:00-04:00');
class SimDate extends RealDate { constructor(...a) { if (a.length === 0) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = SimDate;
globalThis.caches ||= { default: { async match() {}, async put() {} } };
const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
const { seedDemo, DEVICE, sessionToken } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);

let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } };
const MIN = 60000;

const received = [];
const port = await new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const rx = http.createServer((q, s) => { q.resume(); q.on('end', () => { received.push(q.url.split('/').pop()); s.writeHead(201); s.end(); }); }).listen(port, '127.0.0.1');
const subKeys = async () => { const k = await crypto.webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']); return { p256dh: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', k.publicKey)).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') }; };
const vk = await crypto.webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const env = { DB: createD1(':memory:'), ALLOWED_ORIGINS: 'http://localhost:8765', VAPID_PUBLIC_KEY: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', vk.publicKey)).toString('base64url'), VAPID_PRIVATE_KEY: (await crypto.webcrypto.subtle.exportKey('jwk', vk.privateKey)).d, VAPID_SUBJECT: 'mailto:rig@example.invalid' };
await seedDemo(env.DB, { variant: 'typical', now: NOW, assets: '' });
env.DB.sqlite.prepare("DELETE FROM app_data WHERE app_id = 'dollywood-live' AND (key LIKE 'loc:%' OR key LIKE 'kidshare:%')").run();
env.DB.sqlite.prepare('DELETE FROM push_log').run();
const call = async (pid, method, p, body) => { const r = await worker.fetch(new Request('http://api.local' + p, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8765', 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(pid) }, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {}, passThroughOnException() {} }); const t = await r.text(); try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; } };
const loc = (pid, clockSlowMin = 0) => call(pid, 'PUT', `/api/data/dollywood-live/loc:${pid}?scope=family`, { value: { x: 500, y: 500, acc: 8, t: NOW - clockSlowMin * MIN, name: pid }, updated_at: NOW });
const park = async () => (await call('eli', 'POST', '/api/admin/cron/run', { job: 'park' })).body;
const at = m => { NOW += m * MIN; };

try {
  console.log('\n## setup: three adults subscribed, mom has the park switch off, the kids\' beacons on');
  for (const id of ['eli', 'christian', 'mom']) ok((await call(id, 'POST', '/api/push/subscribe', { subscription: { endpoint: `http://127.0.0.1:${port}/push/${id}`, keys: await subKeys() } })).status === 200, `${id} subscribed`);
  ok((await call('mom', 'PUT', '/api/data/hub/push_pref:park?scope=person', { value: false, updated_at: NOW })).status === 200, 'mom: park switch off (one row per switch)');
  for (const k of ['ezra', 'kiara']) ok((await call('eli', 'PUT', `/api/data/dollywood-live/kidshare:${k}?scope=family`, { value: true, updated_at: NOW })).status === 200, `${k}'s beacon on`);

  console.log('\n## a kid goes quiet');
  await loc('eli'); await loc('ezra'); await loc('kiara', 25);   // Kiara's phone clock runs 25 min slow
  let r = await park();
  ok(r.parkDay && !r.stale.length && !r.notified.length, 'everyone just heard from: nothing (Kiara\'s slow clock does not count against her)', r);
  at(10); await loc('eli'); await loc('kiara', 25);
  at(15); await loc('eli'); await loc('kiara', 25);                // Ezra last heard 25 min ago, Eli 0, Kiara 0
  r = await park();
  ok(r.stale.length === 1 && r.stale[0].id === 'ezra' && r.stale[0].ageMin === 25, 'Ezra quiet 25 min (> 20) is flagged, Kiara (updating) is not', r.stale);
  ok(r.notified.map(n => n.profile).sort().join() === 'christian,eli', 'Eli and Mae are told', r.notified);
  ok(r.skipped.some(s => s.profile === 'mom' && s.why === 'pref_off'), 'mom skipped: switch off', r.skipped);
  ok(received.filter(x => x === 'eli').length === 1 && !received.includes('mom'), 'the receiver: one push to Eli, none to mom', received);
  at(15); await loc('eli');
  r = await park();
  ok(!r.notified.length && r.skipped.filter(s => s.why === 'already_told').length === 2, 'the next run: the same quiet spell is not told again', r);
  ok((await call('mom', 'PUT', '/api/data/hub/push_pref:park?scope=person', { value: true, updated_at: NOW })).status === 200, 'mom turns the park switch on');
  r = await park();
  ok(r.notified.map(n => n.profile).join() === 'mom', 'mom is told about the spell she missed', r.notified);

  console.log('\n## the spell ends, a second one is told again');
  at(1); await loc('ezra'); await loc('eli');
  r = await park();
  ok(!r.stale.length, 'Ezra updates: no one is quiet', r.stale);
  at(21); await loc('eli'); await loc('kiara', 25);
  r = await park();
  ok(r.stale.map(s => s.id).join() === 'ezra' && r.notified.length === 3, 'Ezra quiet again (21 min): all three adults are told again', r);

  console.log('\n## who counts as an adult at the park');
  at(40);                                                           // Eli's dot 40 min old: no adult fresh
  r = await park();
  ok(r.stale.length >= 1 && !r.notified.length && !r.skipped.length, 'no fresh adult dot: nothing sent', r);
  const g = await call('guest-grandmajo', 'PUT', '/api/data/dollywood-live/loc:guest-grandmajo?scope=family', { value: { x: 1, y: 1, t: NOW, name: 'Jo' }, updated_at: NOW });
  ok(g.status === 200, 'a guest publishes a dot');
  r = await park();
  ok(!r.notified.length, 'a guest\'s fresh dot is not "an adult at the park"', r);
  at(13 * 60); await loc('eli');
  r = await park();
  ok(!r.stale.length, 'a dot 13 h old is not today\'s park day', r.stale);
} catch (e) { fail++; console.log('  ✗ crashed', e.stack || e); }
finally { globalThis.Date = RealDate; rx.close(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
