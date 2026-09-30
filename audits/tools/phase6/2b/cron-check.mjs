// In-process checks of the batch 2b cron (run from the repo root): jobsAt across DST, the scheduled() handler's main /
// quiet firings, the kids' 90-day chat clean-up, praytime and prayedfor (GAP-PRAYER-1) delivered to a stand-in receiver,
// and the admin-forced runs of the two new jobs.
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.cwd();
const RealDate = Date; let NOW = RealDate.parse('2026-09-26T06:00:00-04:00');
class SimDate extends RealDate { constructor(...a) { if (a.length === 0) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = SimDate;
globalThis.caches ||= { default: { async match() {}, async put() {} } };
const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { jobsAt } = await import(pathToFileURL(path.join(ROOT, 'worker/src/reminders.js')).href);
const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
const { seedDemo, DEVICE, sessionToken } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);
let pass = 0, fail = 0; const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 500)); } };

// jobsAt across the year (EDT and EST) and the quiet firings
const J = iso => jobsAt(RealDate.parse(iso)).names.join('+');
ok(J('2026-07-01T12:00:00Z') === 'morning+prayer+park+praytime', '8:00 am EDT (12:00Z) is the morning run', J('2026-07-01T12:00:00Z'));
ok(J('2026-12-01T13:00:00Z') === 'morning+prayer+park+praytime', '8:00 am EST (13:00Z) is the morning run', J('2026-12-01T13:00:00Z'));
ok(J('2026-12-01T12:00:00Z') === 'park+praytime', '7:00 am EST is a quiet firing', J('2026-12-01T12:00:00Z'));
ok(J('2026-07-01T12:15:00Z') === 'morning+prayer+park+praytime' && !jobsAt(RealDate.parse('2026-07-01T12:15:00Z')).main, '8:15 am runs the morning jobs again (a failed push retried), not main', J('2026-07-01T12:15:00Z'));
ok(J('2026-09-28T00:00:00Z') === 'evening+behind+prayer+prayedfor+park+praytime', 'Sunday 8:00 pm EDT: evening + behind + prayer + prayedfor', J('2026-09-28T00:00:00Z'));
ok(J('2026-09-29T00:00:00Z') === 'evening+prayer+prayedfor+park+praytime', 'Monday 8:00 pm: no behind', J('2026-09-29T00:00:00Z'));
ok(J('2026-09-29T00:45:00Z') === 'evening+prayer+prayedfor+park+praytime' && J('2026-09-29T01:00:00Z') === 'park+praytime', 'the whole 8 pm hour is eligible, 9 pm is not');

// receiver + VAPID
const received = [];
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const port = await freePort();
const rx = http.createServer((q, s) => { q.resume(); q.on('end', () => { received.push(q.url.split('/').pop()); s.writeHead(201); s.end(); }); }).listen(port, '127.0.0.1');
const subKeys = async () => { const k = await crypto.webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']); return { p256dh: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', k.publicKey)).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') }; };
const vk = await crypto.webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const VAPID = { VAPID_PUBLIC_KEY: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', vk.publicKey)).toString('base64url'), VAPID_PRIVATE_KEY: (await crypto.webcrypto.subtle.exportKey('jwk', vk.privateKey)).d, VAPID_SUBJECT: 'mailto:rig@example.invalid' };
const DB = createD1(':memory:'); const env = { DB, ALLOWED_ORIGINS: 'http://localhost:8765', ...VAPID };
await seedDemo(DB, { variant: 'typical', now: NOW, assets: '' });
DB.sqlite.prepare('DELETE FROM push_log').run();
const call = async (pid, method, p, body) => { const r = await worker.fetch(new Request('http://api.local' + p, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8765', 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(pid) }, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {}, passThroughOnException() {} }); const t = await r.text(); try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; } };
for (const id of ['eli', 'christian', 'mom', 'dad']) { const r = await call(id, 'POST', '/api/push/subscribe', { subscription: { endpoint: `http://127.0.0.1:${port}/push/${id}`, keys: await subKeys() } }); if (r.status !== 200) throw new Error('sub ' + id + JSON.stringify(r.body)); }
const sched = async iso => { NOW = RealDate.parse(iso); const logs = []; const orig = console.log; console.log = (...a) => logs.push(a); try { await worker.scheduled({ cron: '*/15 * * * *', scheduledTime: NOW }, env, { waitUntil() {} }); } finally { console.log = orig; } const l = logs.find(a => a[0] === 'cron'); return { out: l ? JSON.parse(l[2]) : null, logs }; };

// kids' chat older than 90 days goes at a main firing, not at a quiet one; an adult's stays
const old = RealDate.parse('2026-06-01T12:00:00Z');
DB.sqlite.prepare("INSERT INTO chat_log (profile_id, role, content, created_at) VALUES ('ezra','user','old kid line',?), ('eli','user','old adult line',?)").run(old, old);
DB.sqlite.prepare("INSERT INTO rate_limits (key, count, reset_at) VALUES ('chat:eli:2026-06-01', 3, ?)").run(old + 40 * 86400000);
let s = await sched('2026-09-26T10:15:00-04:00');
ok(s.out && s.out.ran.map(j => j.job).join() === 'park,praytime' && !s.out.main, 'a quiet firing runs park + praytime only', s.out && s.out.ran.map(j => j.job));
ok(DB.sqlite.prepare("SELECT COUNT(*) n FROM chat_log WHERE content = 'old kid line'").get().n === 1, 'the quiet firing leaves the chat alone');

// GAP-PRAYER-1: praytime at the person's chosen slot (Eli 20:00), once a day
await call('eli', 'PUT', '/api/data/hub/push_prefs?scope=person', { value: { prayAt: '20:00' }, updated_at: NOW });
// prayedfor: Mom's family request, Eli and Ezra prayed today; Mom's own tick does not count
const today = '2026-09-26';
await call('mom', 'PUT', '/api/data/prayer/prayer:s900?scope=family', { value: { id: 's900', title: 'Uncle Joe\'s surgery', status: 'active', createdAt: today, by: 'mom', prayedBy: { [today]: ['eli', 'ezra', 'mom'] } }, updated_at: NOW });
received.length = 0;
s = await sched('2026-09-26T20:00:00-04:00');
const ran = Object.fromEntries((s.out ? s.out.ran : []).map(j => [j.job, j]));
ok(s.out && s.out.main && ['evening', 'prayer', 'prayedfor', 'park', 'praytime'].every(k => ran[k]), 'the 8 pm firing runs evening, prayer, prayedfor, park, praytime', s.out && Object.keys(ran));
ok(ran.praytime && ran.praytime.slot === '20:00' && ran.praytime.due.join() === 'eli' && ran.praytime.notified.map(n => n.profile).join() === 'eli', 'praytime: Eli reminded at his 8:00 pm slot', ran.praytime);
const momA = ran.prayedfor && ran.prayedfor.askers.find(a => a.profile === 'mom');
ok(momA && momA.prayed.includes('Eli') && momA.prayed.includes('Ezra') && !momA.prayed.includes('Elizabeth') && ran.prayedfor.askers.every(a => !a.prayed.includes(({eli:'Eli',mom:'Elizabeth',christian:'Mae',dad:'David'})[a.profile])), 'prayedfor: Mom hears that Eli and Ezra prayed; nobody hears about their own ticks', ran.prayedfor);
ok(received.includes('mom') && received.includes('eli'), 'the receiver got both', received);
ok(DB.sqlite.prepare("SELECT COUNT(*) n FROM chat_log WHERE content = 'old kid line'").get().n === 0 && DB.sqlite.prepare("SELECT COUNT(*) n FROM chat_log WHERE content = 'old adult line'").get().n === 1, 'the 8 pm firing deletes a kid\'s 90-day-old chat, not an adult\'s');
ok(DB.sqlite.prepare("SELECT COUNT(*) n FROM rate_limits WHERE key = 'chat:eli:2026-06-01'").get().n === 0, 'and an expired day counter');
received.length = 0;
s = await sched('2026-09-26T20:15:00-04:00');
const ran2 = Object.fromEntries((s.out ? s.out.ran : []).map(j => [j.job, j]));
ok(ran2.praytime && ran2.praytime.skipped.some(x => x.profile === 'eli' && x.why === 'already_today') && !received.includes('eli'), '8:15 pm: eligible again (the hour), but no second reminder (delivered once today)', ran2.praytime);
const forced = await call('eli', 'POST', '/api/admin/cron/run', { job: 'prayedfor' });
ok(forced.status === 200 && forced.body.skipped.some(x => x.profile === 'mom' && x.why === 'already_today'), 'a forced prayedfor the same day: Mom already told today', forced.body);
NOW = RealDate.parse('2026-09-26T20:00:00-04:00');
const forced2 = await call('eli', 'POST', '/api/admin/cron/run', { job: 'praytime' });
ok(forced2.status === 200 && forced2.body.skipped.some(x => x.profile === 'eli' && x.why === 'already_today'), 'a forced praytime at the slot: once a day', forced2.body);
globalThis.Date = RealDate; rx.close();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
