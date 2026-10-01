// Batch 4 copy of audits/tools/phase6/2b/cron-check.mjs: since IMP-F260-F4 the reading nudge (evening) runs at every firing and
// picks the people whose chosen time (push_pref:readAt, unset = 8 pm) this hour is, so jobsAt lists it first at every firing
// and a quiet firing runs it as quiet. The readAt rules themselves are the block before the end. Run from the repo root.
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
ok(J('2026-07-01T12:00:00Z') === 'evening+morning+prayer+park+praytime', '8:00 am EDT (12:00Z) is the morning run', J('2026-07-01T12:00:00Z'));
ok(J('2026-12-01T13:00:00Z') === 'evening+morning+prayer+park+praytime', '8:00 am EST (13:00Z) is the morning run', J('2026-12-01T13:00:00Z'));
ok(J('2026-12-01T12:00:00Z') === 'evening+park+praytime', '7:00 am EST is a quiet firing (the reading nudge picks its own people)', J('2026-12-01T12:00:00Z'));
ok(J('2026-07-01T12:15:00Z') === 'evening+morning+prayer+park+praytime' && !jobsAt(RealDate.parse('2026-07-01T12:15:00Z')).main, '8:15 am runs the morning jobs again (a failed push retried), not main', J('2026-07-01T12:15:00Z'));
ok(J('2026-09-28T00:00:00Z') === 'evening+behind+prayer+prayedfor+park+praytime', 'Sunday 8:00 pm EDT: evening + behind + prayer + prayedfor', J('2026-09-28T00:00:00Z'));
ok(J('2026-09-29T00:00:00Z') === 'evening+prayer+prayedfor+park+praytime', 'Monday 8:00 pm: no behind', J('2026-09-29T00:00:00Z'));
ok(J('2026-09-29T00:45:00Z') === 'evening+prayer+prayedfor+park+praytime' && J('2026-09-29T01:00:00Z') === 'evening+park+praytime', 'the whole 8 pm hour is eligible, 9 pm is not');

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
ok(s.out && s.out.ran.map(j => j.job).join() === 'evening,park,praytime' && s.out.ran[0].quiet === true && !s.out.main, 'a quiet firing runs evening (in nobody\'s hour: quiet), park + praytime', s.out && s.out.ran.map(j => j.job));
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

// ── batch 4, IMP-F260-F4: the reading nudge at each person's own time (push_pref:readAt; unset = 8 pm) ──────────────
{
  const day = '2026-09-27';
  DB.sqlite.prepare('DELETE FROM push_log').run();
  // nobody has read on the 27th: every F260 person's log row for the day is false
  for (const id of ['eli', 'christian', 'mom', 'dad']) await call(id, 'PUT', `/api/data/f260/log:${day}?scope=person`, { value: false, updated_at: RealDate.parse('2026-09-27T00:05:00-04:00') });
  NOW = RealDate.parse('2026-09-27T05:00:00-04:00');
  { const r = await call('christian', 'PUT', '/api/data/hub/push_pref:readAt?scope=person', { value: '06:30', updated_at: NOW }); ok(r.status === 200, 'Mae picks 6:30 am (push_pref:readAt)', r.body); }
  // Mom set 7:00 in the old whole row push_prefs; a push_pref:readAt row would win over it
  { const r = await call('mom', 'PUT', '/api/data/hub/push_prefs?scope=person', { value: { readAt: '07:00' }, updated_at: NOW }); ok(r.status === 200, 'Mom has readAt 07:00 in the old push_prefs row', r.body); }
  const ev = async iso => { received.length = 0; const s = await sched(iso); return (s.out ? s.out.ran : []).find(j => j.job === 'evening') || null; };
  let e = await ev('2026-09-27T06:15:00-04:00');
  ok(e && e.quiet === true && !received.length, '6:15 am: in no one\'s hour, the reading nudge is quiet', e);
  e = await ev('2026-09-27T06:30:00-04:00');
  ok(e && e.notified.map(n => n.profile).join() === 'christian' && received.join() === 'christian', '6:30 am: Mae, and only Mae, gets her reading nudge', { e, received });
  ok(e && e.skipped.some(x => x.profile === 'eli' && x.why === 'not_their_time') && e.checked.find(c => c.profile === 'eli').at === '20:00', 'Eli (no time chosen) is not due: his is 8 pm', e && e.skipped);
  e = await ev('2026-09-27T07:15:00-04:00');
  ok(e && e.notified.map(n => n.profile).join() === 'mom' && e.skipped.some(x => x.profile === 'christian' && x.why === 'already_today') && received.join() === 'mom', '7:15 am: Mom from the old row\'s 07:00; Mae is still in her hour but already told today', { e, received });
  e = await ev('2026-09-27T07:45:00-04:00');
  ok(e && !e.notified.length && e.skipped.some(x => x.profile === 'christian' && x.why === 'not_their_time') && e.skipped.some(x => x.profile === 'mom' && x.why === 'already_today') && !received.length, '7:45 am: Mae\'s hour (6:30-7:30) is over; Mom is in hers but already told', e);
  // Mae reads at noon, then the default hour: Eli and Dad are nudged, Mae (read, and not her time) is not
  await call('christian', 'PUT', `/api/data/f260/log:${day}?scope=person`, { value: true, updated_at: RealDate.parse('2026-09-27T12:00:00-04:00') });
  e = await ev('2026-09-27T20:00:00-04:00');
  const got = e ? e.notified.map(n => n.profile).sort().join() : null;
  ok(got === 'dad,eli' && e.checked.find(c => c.profile === 'christian').readToday === true && e.skipped.some(x => x.profile === 'mom' && x.why === 'not_their_time'), '8:00 pm (a Sunday: behind runs too): the reading nudge goes to Eli and Dad (the default hour); not Mae (read) nor Mom (not her hour)', { got, received });
  e = await ev('2026-09-27T20:30:00-04:00');
  ok(e && !e.notified.length && e.skipped.filter(x => x.why === 'already_today').map(x => x.profile).sort().join() === 'dad,eli', '8:30 pm: the default hour again, nobody twice', e && e.skipped);
  // a bad value is the default; the f260 switch still turns it off
  await call('dad', 'PUT', '/api/data/hub/push_pref:readAt?scope=person', { value: '25:99', updated_at: NOW });
  await call('eli', 'PUT', '/api/data/hub/push_pref:f260?scope=person', { value: false, updated_at: NOW });
  await call('eli', 'PUT', '/api/data/hub/push_pref:readAt?scope=person', { value: '21:00', updated_at: NOW });
  DB.sqlite.prepare('DELETE FROM push_log').run();
  e = await ev('2026-09-27T21:00:00-04:00');
  ok(e && e.checked.find(c => c.profile === 'dad').at === '20:00' && e.skipped.some(x => x.profile === 'eli' && x.why === 'pref_off') && !received.length, '9 pm: Dad\'s "25:99" reads as 8 pm (not due); Eli chose 9 pm but has the reading nudge off', e);
  // forced from Admin: whatever anyone's time
  NOW = RealDate.parse('2026-09-27T03:00:00-04:00');
  const f = await call('eli', 'POST', '/api/admin/cron/run', { job: 'evening' });
  ok(f.status === 200 && !f.body.quiet && f.body.notified.some(n => n.profile === 'dad') && f.body.checked.find(c => c.profile === 'christian').at === '06:30', 'a forced run at 3 am checks everyone and nudges Dad (unread, switch on)', f.body);
}
// ── batch 4, round 4: the first 8 am / 8 pm firing drops restored:<date>:* rows older than yesterday (New York) ─────
{
  const put = (pid, key) => DB.sqlite.prepare("INSERT INTO app_data (scope, profile_id, app_id, key, value, updated_at, synced_at) VALUES ('person', ?, 'f260', ?, ?, ?, ?)").run(pid, key, JSON.stringify({ ids: ['1-0'], upTo: 1 }), RealDate.now(), RealDate.now());
  put('eli', 'restored:2026-09-25:old'); put('eli', 'restored:2026-09-26:yday'); put('mom', 'restored:2026-09-27:today'); put('mom', 'restored:2026-09-20:older');
  const left = () => DB.sqlite.prepare("SELECT key FROM app_data WHERE app_id = 'f260' AND substr(key, 1, 9) = 'restored:' ORDER BY key").all().map(r => r.key);
  await sched('2026-09-27T07:00:00-04:00');
  ok(left().length === 4, 'a quiet firing leaves the restored rows alone', left());
  await sched('2026-09-27T08:00:00-04:00');
  const l = left();
  ok(l.join() === 'restored:2026-09-26:yday,restored:2026-09-27:today', 'the first 8 am firing drops the restored rows older than yesterday, keeps yesterday\'s and today\'s', l);
}
globalThis.Date = RealDate; rx.close();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
