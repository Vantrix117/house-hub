// R-park probe: arriveJob retry after a failed delivery; parking-lot fixes (inside the map's PROPERTY polygon, outside the Worker box)
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'C:/Users/ex_bo/hub-audit';
const RealDate = Date; let NOW = RealDate.parse('2026-09-26T10:00:00-04:00');
class SimDate extends RealDate { constructor(...a) { if (a.length === 0) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = SimDate;
globalThis.caches ||= { default: { async match() {}, async put() {} } };
const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
const { seedDemo, DEVICE, sessionToken } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);
const MIN = 60000;
let failFor = new Set();
const received = [];
const port = await new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
http.createServer((q, s) => { q.resume(); q.on('end', () => { const who = q.url.split('/').pop(); if (failFor.has(who)) { s.writeHead(500); s.end(); return; } received.push(who); s.writeHead(201); s.end(); }); }).listen(port, '127.0.0.1');
const subKeys = async () => { const k = await crypto.webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']); return { p256dh: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', k.publicKey)).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') }; };
const vk = await crypto.webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const env = { DB: createD1(':memory:'), ALLOWED_ORIGINS: 'http://localhost:8765', VAPID_PUBLIC_KEY: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', vk.publicKey)).toString('base64url'), VAPID_PRIVATE_KEY: (await crypto.webcrypto.subtle.exportKey('jwk', vk.privateKey)).d, VAPID_SUBJECT: 'mailto:rig@example.invalid' };
await seedDemo(env.DB, { variant: 'typical', now: NOW, assets: '' });
env.DB.sqlite.prepare("DELETE FROM app_data WHERE app_id = 'dollywood-live' AND (key LIKE 'loc:%' OR key LIKE 'kidshare:%' OR key = 'meet')").run();
env.DB.sqlite.prepare('DELETE FROM push_log').run();
const call = async (pid, method, p, body) => { const r = await worker.fetch(new Request('http://api.local' + p, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8765', 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(pid) }, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {}, passThroughOnException() {} }); const t = await r.text(); try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; } };
const loc = (pid, x, y, acc = 10) => call(pid, 'PUT', `/api/data/dollywood-live/loc:${pid}?scope=family`, { value: { x, y, acc, t: NOW, name: pid }, updated_at: NOW });
const job = async j => (await call('eli', 'POST', '/api/admin/cron/run', { job: j })).body;
const at = m => { NOW += m * MIN; };

for (const id of ['eli', 'christian', 'mom']) console.log(id, 'subscribe', (await call(id, 'POST', '/api/push/subscribe', { subscription: { endpoint: `http://127.0.0.1:${port}/push/${id}`, keys: await subKeys() } })).status);

console.log('\n## A: arrive retry after a failed delivery (comment: "a push that failed is tried again the next minute")');
console.log('meet put', (await call('eli', 'PUT', '/api/data/dollywood-live/meet?scope=family', { value: { x: 1000, y: 1000, name: 'Bench', note: '', by: 'eli', byName: 'Eli', at: NOW }, updated_at: NOW })).status);
await loc('christian', 1500, 1000); await loc('mom', 1600, 1000);
let r = await job('arrive'); console.log('run1', JSON.stringify(r));
failFor = new Set(['eli']);   // Eli's push service is down for this minute
at(1); await loc('christian', 1010, 1005); await loc('mom', 1600, 1000);
r = await job('arrive'); console.log('run2 (eli fails)', JSON.stringify({ arrived: r.arrived, notified: r.notified.map(n => [n.profile, n.ok]), skipped: r.skipped }));
failFor = new Set();
for (let i = 0; i < 3; i++) { at(1); await loc('christian', 1011, 1006); r = await job('arrive'); console.log(`retry run ${i + 1}`, JSON.stringify({ arrived: r.arrived, notified: r.notified.map(n => [n.profile, n.ok]), skipped: r.skipped })); }
console.log('received', received);
console.log('push_log', JSON.stringify(env.DB.sqlite.prepare("SELECT profile_id, kind, ok FROM push_log WHERE kind='arrive'").all()));
console.log('setting', env.DB.sqlite.prepare("SELECT value FROM settings WHERE key='park_arrive'").get());

console.log('\n## B: a fix in the far parking lot (inside the map PROPERTY polygon at x=1500,y=3000, which the map publishes) vs the Worker box');
env.DB.sqlite.prepare("DELETE FROM app_data WHERE app_id = 'dollywood-live' AND (key LIKE 'loc:%' OR key = 'meet')").run();
for (const k of ['ezra']) await call('eli', 'PUT', `/api/data/dollywood-live/kidshare:${k}?scope=family`, { value: true, updated_at: NOW });
at(5);
await loc('eli', 1500, 3000); await loc('ezra', 1500, 3010);
r = await job('park'); console.log('park run (both in the lot, fresh)', JSON.stringify({ parkDay: r.parkDay, markers: r.markers, stale: r.stale }));
at(25); await loc('eli', 1500, 3000);
r = await job('park'); console.log('park run (Ezra quiet 25 min in the lot, Eli fresh in the lot)', JSON.stringify({ parkDay: r.parkDay, stale: r.stale, notified: r.notified.map(n => n.profile) }));
at(0.2); await loc('eli', 1000, 1000);
r = await job('park'); console.log('park run (Eli back in the park, Ezra quiet 25 min in the lot)', JSON.stringify({ parkDay: r.parkDay, stale: r.stale, notified: r.notified.map(n => n.profile) }));
process.exit(0);
