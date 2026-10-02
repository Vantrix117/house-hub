// Batch 6 (PWA-GAP-1), in process, on the pattern of audits/tools/phase6/5/cron-check-5.mjs: the "Timer done" push.
// wrangler.toml has a second trigger, "* * * * *"; the scheduled handler runs ONLY timerJob for it, and the 15-minute trigger
// runs the other jobs unchanged (jobsAt never lists the timer). timerJob reads the person-scope timer:<id> rows (server ms) and
// the legacy timer.active: a timer whose endAt fell in the last 10 minutes, not paused, not acknowledged and not pushed yet,
// is pushed once to its owner's devices ("Timer done: <label>", tag timer-<id>; nothing private beyond the label); the switch
// push_pref:timer is on unless turned off; kids cannot subscribe (their timers ring on the device); a failed delivery is
// tried again at the next minute; settings.timer_pushed remembers each push and is pruned after a day. The 10-minute rule
// clears a row that ended more than 10 minutes ago and its family mirror run:<owner>:<id> under the same start, and a
// mirror left without its person row. Review round 1: the key and the tag carry endAt (+1 min after it rang is told again,
// L1); the top-of-the-hour firing deletes the Timer's tombstones older than a day and the reads use the partial index of
// live rows (M2). Run from the repo root:  node audits/tools/phase6/6/cron-check-6.mjs
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.cwd();
const RealDate = Date; let NOW = RealDate.parse('2026-10-01T17:00:00-04:00');
class SimDate extends RealDate { constructor(...a) { if (a.length === 0) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = SimDate;
globalThis.caches ||= { default: { async match() {}, async put() {} } };
const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { jobsAt, PREF_DEFAULTS, MINUTE_CRON, JOBS, timerFmt } = await import(pathToFileURL(path.join(ROOT, 'worker/src/reminders.js')).href);
const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
const { seedDemo, DEVICE, sessionToken } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);
let pass = 0, fail = 0; const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 600)); } };

console.log('## the two triggers');
const toml = fs.readFileSync(path.join(ROOT, 'worker/wrangler.toml'), 'utf8');
ok(/crons\s*=\s*\[\s*"\*\/15 \* \* \* \*"\s*,\s*"\* \* \* \* \*"\s*\]/.test(toml), 'wrangler.toml: crons = ["*/15 * * * *", "* * * * *"]', toml.match(/crons.*$/m));
ok(MINUTE_CRON === '* * * * *' && typeof JOBS.timer === 'function', 'the minute cron name and the timer job (forceable from Admin)');
const J = iso => jobsAt(RealDate.parse(iso)).names.join('+');
ok(J('2026-09-29T23:00:00Z') === 'evening+verses+park+praytime' && J('2026-07-01T12:00:00Z') === 'evening+morning+prayer+park+praytime' && J('2026-09-28T00:00:00Z') === 'evening+behind+prayer+prayedfor+park+praytime',
  'the 15-minute firings run what they ran before batch 6, never the timer');
ok(PREF_DEFAULTS.timer === true && PREF_DEFAULTS.verses === false, 'the timer switch starts on (a timer is something you asked for)', PREF_DEFAULTS);
ok(timerFmt(720000) === '12:00' && timerFmt(3725000) === '1:02:05' && timerFmt(59001) === '1:00', 'the Worker formats as the hub does (h:mm:ss, seconds rounded up)');

// a stand-in push service that decrypts what it gets (RFC 8291), one subscription per person
const received = []; let failOnce = new Set();
const keysOf = {};
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const port = await freePort();
const W = crypto.webcrypto, enc = new TextEncoder();
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const hkdf = async (salt, ikm, info, bits) => new Uint8Array(await W.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await W.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bits));
async function decrypt(who, body) {
  const k = keysOf[who]; const salt = body.slice(0, 16), idlen = body[20], asPublic = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
  const asKey = await W.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await W.subtle.deriveBits({ name: 'ECDH', public: asKey }, k.priv, 256));
  const ikm = await hkdf(k.auth, shared, concat(enc.encode('WebPush: info\0'), k.pub, asPublic), 256);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128), nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);
  const plain = new Uint8Array(await W.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await W.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher));
  let end = plain.length - 1; while (end > 0 && plain[end] === 0) end--;
  return JSON.parse(new TextDecoder().decode(plain.slice(0, end)));
}
const rx = http.createServer((q, s) => { const chunks = []; q.on('data', d => chunks.push(d)); q.on('end', async () => {
  const who = q.url.split('/').pop();
  if (failOnce.has(who)) { failOnce.delete(who); s.writeHead(500); s.end(); return; }
  try { received.push({ who, msg: await decrypt(who, new Uint8Array(Buffer.concat(chunks))) }); } catch (e) { received.push({ who, error: String(e) }); }
  s.writeHead(201); s.end(); }); }).listen(port, '127.0.0.1');
const subKeys = async who => {
  const k = await W.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await W.subtle.exportKey('raw', k.publicKey)), auth = crypto.randomBytes(16);
  keysOf[who] = { priv: k.privateKey, pub, auth: new Uint8Array(auth) };
  return { p256dh: Buffer.from(pub).toString('base64url'), auth: auth.toString('base64url') };
};
const vk = await W.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const VAPID = { VAPID_PUBLIC_KEY: Buffer.from(await W.subtle.exportKey('raw', vk.publicKey)).toString('base64url'), VAPID_PRIVATE_KEY: (await W.subtle.exportKey('jwk', vk.privateKey)).d, VAPID_SUBJECT: 'mailto:rig@example.invalid' };
const DB = createD1(':memory:'); const env = { DB, ALLOWED_ORIGINS: 'http://localhost:8765', ...VAPID };
await seedDemo(DB, { variant: 'typical', now: NOW, assets: '' });
DB.sqlite.prepare('DELETE FROM push_log').run();
DB.sqlite.prepare("DELETE FROM app_data WHERE app_id = 'timer'").run();   // a clean slate: only this check's timers
const call = async (pid, method, p, body) => { const r = await worker.fetch(new Request('http://api.local' + p, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8765', 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(pid) }, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {}, passThroughOnException() {} }); const t = await r.text(); try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; } };
for (const id of ['eli', 'christian', 'mom', 'dad']) { const r = await call(id, 'POST', '/api/push/subscribe', { subscription: { endpoint: `http://127.0.0.1:${port}/push/${id}`, keys: await subKeys(id) } }); if (r.status !== 200) throw new Error('sub ' + id + JSON.stringify(r.body)); }
{ const r = await call('ezra', 'POST', '/api/push/subscribe', { subscription: { endpoint: `http://127.0.0.1:${port}/push/ezra`, keys: await subKeys('ezra') } }); ok(r.status === 403, 'a kid cannot subscribe (403): a kid\'s timer rings on the device', r.status); }
const put = (pid, scope, key, value) => call(pid, 'PUT', `/api/data/timer/${encodeURIComponent(key)}?scope=${scope}`, { value, updated_at: NOW });
// run one firing of a trigger at `iso`: the scheduled handler, the log lines it wrote
async function fire(cron, iso) {
  NOW = RealDate.parse(iso); received.length = 0; const logs = []; const orig = console.log, oerr = console.error;
  console.log = (...a) => logs.push(a); console.error = (...a) => logs.push(['ERR', ...a]);
  try { await worker.scheduled({ cron, scheduledTime: NOW }, env, { waitUntil() {} }); } finally { console.log = orig; console.error = oerr; }
  const t = logs.find(a => a[0] === 'cron timer'), main = logs.find(a => a[0] === 'cron');
  return { timer: t ? JSON.parse(t[1]) : null, main: main ? JSON.parse(main[2]) : null, errors: logs.filter(a => a[0] === 'ERR' || /cron timer/.test(String(a[0])) && a[0] !== 'cron timer') };
}
const T0 = RealDate.parse('2026-10-01T17:05:00-04:00');   // Eli's pasta ends at 5:05 pm
const row = (id, o) => ({ id, label: '', total: 60000, startedAt: T0 - 60000, endAt: T0, pausedAt: null, remaining: null, by: null, ackAt: null, ...o });

console.log('## seeds');
for (const [pid, key, v] of [
  ['eli', 'timer:pasta', row('pasta', { label: 'Pasta', total: 720000, startedAt: T0 - 720000, by: 'eli' })],
  ['eli', 'timer:oven', row('oven', { label: 'Oven', total: 3600000, startedAt: T0 - 600000, endAt: T0 + 3000000, by: 'eli' })],                   // still running
  ['eli', 'timer:rest', row('rest', { label: 'Dough', total: 600000, endAt: null, pausedAt: T0 - 60000, remaining: 240000, by: 'eli' })],          // paused
  ['christian', 'timer:tea', row('tea', { label: 'Tea', total: 240000, startedAt: T0 - 240000, by: 'christian' })],                              // her push fails once
  ['mom', 'timer:bread', row('bread', { label: 'Bread', by: 'mom' })],                                                                           // her switch is off
  ['ezra', 'timer:egg', row('egg', { label: 'Egg', by: 'ezra' })],                                                                               // a kid
]) { const r = await put(pid, 'person', key, v); ok(r.status === 200, `${pid} ${key}`, r.body); }
{ const r = await call('mom', 'PUT', '/api/data/hub/push_pref%3Atimer?scope=person', { value: false, updated_at: NOW }); ok(r.status === 200, 'Mom turns the Timer done switch off', r.body); }
// David's older app still writes the legacy single row (total in seconds)
{ const r = await put('dad', 'person', 'timer.active', { endAt: T0, total: 300, startedAt: T0 - 300000 }); ok(r.status === 200, 'dad timer.active (legacy, total in s)', r.body); }
// mirrors: Eli's pasta, a mirror for a timer whose row is gone (orphan), and Eli's oven mirror
for (const [k, v] of [['run:eli:pasta', { label: 'Pasta', total: 720000, endAt: T0, startedAt: T0 - 720000 }], ['run:eli:ghost', { label: 'Ghost', total: 60000, endAt: T0 + 9e6, startedAt: T0 - 1000 }], ['run:eli:oven', { label: 'Oven', total: 3600000, endAt: T0 + 3000000, startedAt: T0 - 600000 }]]) {
  const r = await call('eli', 'POST', '/api/data/timer/batch?scope=family', { items: [{ key: k, value: v, updated_at: NOW }] }); ok(r.status === 200 && !r.body.results[0].rejected, 'eli mirror ' + k, r.body);
}

console.log('## the minute trigger');
let f = await fire('* * * * *', '2026-10-01T17:04:30-04:00');
ok(!f.main, 'the minute trigger runs nothing of the 15-minute jobs', f.main);
ok(!received.length && (!f.timer || !f.timer.due.length), '4:04:30 pm: nothing has ended yet, nothing sent', f.timer);
failOnce.add('christian');                                  // the push service answers 500 to Mae's phone once
f = await fire('* * * * *', '2026-10-01T17:05:10-04:00');
const due = f.timer ? f.timer.due.map(d => d.profile + ' ' + d.key).sort().join(', ') : '';
ok(due === 'christian timer:tea, dad timer.active, eli timer:pasta, ezra timer:egg, mom timer:bread', '5:05:10 pm: the five ended timers are due (not the running oven, not the paused dough)', due);
const got = Object.fromEntries(received.map(x => [x.who, x.msg]));
ok(got.eli && got.eli.title === 'Timer done: Pasta' && got.eli.body === 'Pasta is up.' && got.eli.tag === 'timer-pasta-' + T0 && got.eli.url === '#timer' && got.eli.to === 'eli', 'Eli hears "Timer done: Pasta" (tag timer-pasta-<endAt>, to eli)', got.eli);
ok(got.dad && got.dad.title === 'Timer done' && got.dad.body === '5:00 timer is up.' && got.dad.tag === 'timer-legacy-' + T0, 'David\'s legacy timer.active: "Timer done", "5:00 timer is up."', got.dad);
ok(got.eli && Object.keys(got.eli).sort().join() === 'body,tag,title,to,url', 'the payload carries nothing but the title, body, tag, link and whose it is', got.eli && Object.keys(got.eli));
ok(!got.mom && f.timer.skipped.some(x => x.profile === 'mom' && x.why === 'pref_off'), 'Mom (switch off) is not told', f.timer.skipped);
ok(!got.ezra && f.timer.skipped.some(x => x.profile === 'ezra' && x.why === 'no_push_for_kind'), 'Ezra (a kid) is not pushed', f.timer.skipped);
ok(!got.christian && f.timer.skipped.some(x => x.profile === 'christian' && x.why === 'delivery_failed_retry'), 'Mae\'s delivery failed: kept for the next minute', f.timer.skipped);
f = await fire('* * * * *', '2026-10-01T17:06:10-04:00');
ok(received.map(x => x.who).join() === 'christian' && received[0].msg.title === 'Timer done: Tea', '5:06 pm: Mae is told now; nobody else twice', received.map(x => x.who));
f = await fire('* * * * *', '2026-10-01T17:07:10-04:00');
ok(!received.length, '5:07 pm: nothing more (each timer once)', received.map(x => x.who));
const mem = JSON.parse(DB.sqlite.prepare("SELECT value FROM settings WHERE key = 'timer_pushed'").get().value);
ok(Object.keys(mem).sort().join() === ['christian|timer:tea|', 'dad|timer.active|', 'eli|timer:pasta|', 'ezra|timer:egg|', 'mom|timer:bread|'].map((k, i) => k + [T0 - 240000, T0 - 300000, T0 - 720000, T0 - 60000, T0 - 60000][i] + '|' + T0).sort().join(), 'settings.timer_pushed: one entry per timer start and end (profile|key|startedAt|endAt)', mem);
// Eli restarts the same pasta row (a new start): it is a new timer, told again when it ends
await put('eli', 'person', 'timer:pasta', row('pasta', { label: 'Pasta', total: 120000, startedAt: RealDate.parse('2026-10-01T17:07:30-04:00'), endAt: RealDate.parse('2026-10-01T17:09:30-04:00'), by: 'eli' }));
f = await fire('* * * * *', '2026-10-01T17:10:00-04:00');
ok(received.some(x => x.who === 'eli' && x.msg.title === 'Timer done: Pasta'), 'the same row restarted (a new startedAt) is told again', received.map(x => x.who));
// an acknowledged one (ackAt) is never told
await put('dad', 'person', 'timer:ack', row('ack', { endAt: RealDate.parse('2026-10-01T17:10:30-04:00'), startedAt: RealDate.parse('2026-10-01T17:09:30-04:00'), ackAt: RealDate.parse('2026-10-01T17:10:40-04:00'), by: 'dad' }));
f = await fire('* * * * *', '2026-10-01T17:11:00-04:00');
ok(!received.some(x => x.who === 'dad'), 'an acknowledged timer (ackAt) is not told', received.map(x => x.who));
// L1 (review round 1): +1 min on a timer that has rung: the same start, a new end, told again at that end
{
  const s2 = RealDate.parse('2026-10-01T17:11:00-04:00'), e2 = RealDate.parse('2026-10-01T17:11:30-04:00');
  await put('christian', 'person', 'timer:tea2', row('tea2', { label: 'Tea', total: 30000, startedAt: s2, endAt: e2, by: 'christian' }));
  f = await fire('* * * * *', '2026-10-01T17:11:40-04:00');
  const a1 = received.filter(x => x.who === 'christian').map(x => x.msg.tag);
  NOW = RealDate.parse('2026-10-01T17:11:45-04:00');
  await put('christian', 'person', 'timer:tea2', row('tea2', { label: 'Tea', total: 90000, startedAt: s2, endAt: e2 + 70000, by: 'christian' }));   // +1 min, 15 s after it rang
  f = await fire('* * * * *', '2026-10-01T17:12:10-04:00');
  const mid = received.filter(x => x.who === 'christian').length;
  f = await fire('* * * * *', '2026-10-01T17:12:50-04:00');
  const a2 = received.filter(x => x.who === 'christian').map(x => x.msg.tag);
  ok(a1.join() === 'timer-tea2-' + e2 && mid === 0 && a2.join() === 'timer-tea2-' + (e2 + 70000), '+1 min after it rang: told at the first end, nothing while it runs again, told again at the new end (tag timer-<id>-<endAt>)', { a1, mid, a2 });
}

console.log('## the 10-minute rule');
const rowsOf = (scope) => Object.fromEntries(DB.sqlite.prepare(`SELECT IFNULL(profile_id, '') AS p, key, value FROM app_data WHERE app_id = 'timer' AND scope = ?`).all(scope).map(r => [(r.p ? r.p + ' ' : '') + r.key, r.value == null ? null : JSON.parse(r.value)]));
f = await fire('* * * * *', '2026-10-01T17:14:00-04:00');
let P = rowsOf('person'), F = rowsOf('family');
ok(P['mom timer:bread'] && P['ezra timer:egg'], '9 minutes after: the ended rows still stand ("Ended at 5:05")', Object.keys(P));
ok(F['run:eli:ghost'] === null, 'a mirror whose person row is gone is cleared', F['run:eli:ghost']);
ok(F['run:eli:oven'] && F['run:eli:pasta'], 'the running oven\'s mirror and the restarted pasta\'s stay', F);
f = await fire('* * * * *', '2026-10-01T17:16:00-04:00');
P = rowsOf('person'); F = rowsOf('family');
ok(P['mom timer:bread'] === null && P['ezra timer:egg'] === null && P['christian timer:tea'] === null && P['dad timer.active'] === null, '11 minutes after: ended rows are cleared (the legacy row too)', P);
ok(P['eli timer:oven'] && P['eli timer:rest'] && P['eli timer:pasta'], 'the running oven, the paused dough and the restarted pasta stay', P);
ok(f.timer && f.timer.cleared.some(c => c.key === 'timer:bread'), 'the job says what it cleared', f.timer);
f = await fire('* * * * *', '2026-10-01T17:21:00-04:00');
P = rowsOf('person'); F = rowsOf('family');
ok(P['eli timer:pasta'] === null && F['run:eli:pasta'] === null, '5:21 pm: the restarted pasta (ended 5:09:30) is cleared, with its mirror under the same start', { p: P['eli timer:pasta'], f: F['run:eli:pasta'] });
// a mirror whose person row is a NEWER start is not cleared by the old start's rule
await put('dad', 'person', 'timer:x', row('x', { startedAt: RealDate.parse('2026-10-01T17:00:00-04:00'), endAt: RealDate.parse('2026-10-01T17:01:00-04:00'), by: 'dad' }));
await call('dad', 'POST', '/api/data/timer/batch?scope=family', { items: [{ key: 'run:dad:x', value: { total: 60000, startedAt: RealDate.parse('2026-10-01T17:20:00-04:00'), endAt: RealDate.parse('2026-10-01T17:40:00-04:00') }, updated_at: NOW }] });
f = await fire('* * * * *', '2026-10-01T17:21:30-04:00');
F = rowsOf('family');
ok(rowsOf('person')['dad timer:x'] === null && F['run:dad:x'] && F['run:dad:x'].startedAt === RealDate.parse('2026-10-01T17:20:00-04:00'), 'an old row is cleared but a mirror of a newer start is not (it waits for its own row, or the orphan rule)', F['run:dad:x']);
// the clear is conditional: a row written again between the job's read and its clear is never cleared
{
  const id = DB.sqlite.prepare("SELECT id, updated_at FROM app_data WHERE app_id = 'timer' AND profile_id = 'eli' AND key = 'timer:oven'").get();
  const r = DB.sqlite.prepare('UPDATE app_data SET value = NULL, updated_at = ?, synced_at = ? WHERE id = ? AND updated_at = ?').run(NOW, NOW, id.id, id.updated_at - 1);
  ok(r.changes === 0 && rowsOf('person')['eli timer:oven'], 'the clear names the updated_at it read: a newer write is never cleared (the SQL the job uses)');
}

console.log('## settings.timer_pushed is pruned after a day');
NOW = RealDate.parse('2026-10-02T18:00:00-04:00');
await put('eli', 'person', 'timer:late', row('late', { label: 'Late', startedAt: NOW - 120000, endAt: NOW - 60000, by: 'eli' }));
f = await fire('* * * * *', '2026-10-02T18:00:00-04:00');
const mem2 = JSON.parse(DB.sqlite.prepare("SELECT value FROM settings WHERE key = 'timer_pushed'").get().value);
ok(Object.keys(mem2).length === 1 && Object.keys(mem2)[0].startsWith('eli|timer:late|'), 'yesterday\'s entries are gone; today\'s one is kept', Object.keys(mem2));
// M2 (review round 1): the firing at the top of the hour deletes the Timer's tombstones older than a day; live rows stay
{
  const old = DB.sqlite.prepare("SELECT count(*) c FROM app_data WHERE app_id = 'timer' AND value IS NULL AND updated_at < ?").get(NOW - 30 * 86400000).c;
  const young = DB.sqlite.prepare("SELECT count(*) c FROM app_data WHERE app_id = 'timer' AND value IS NULL").get().c;
  const liveN = DB.sqlite.prepare("SELECT count(*) c FROM app_data WHERE app_id = 'timer' AND value IS NOT NULL").get().c;
  ok(f.timer && f.timer.purged === 0 && old === 0 && young > 0 && liveN >= 1, `the 6 pm firing purges only tombstones older than 30 days: none yet, ${young} younger ones kept (a device away up to a month still hears of them); ${liveN} live rows stay`, { purged: f.timer && f.timer.purged, old, young, liveN });
  {   // a tombstone 31 days old goes at the next top of the hour
    DB.sqlite.prepare("INSERT INTO app_data (scope, profile_id, app_id, key, value, updated_at, synced_at) VALUES ('person', 'eli', 'timer', 'timer:ancient', NULL, ?, ?)").run(NOW - 31 * 86400000, NOW - 31 * 86400000);
    const g = await JOBS.timer(env, RealDate.parse('2026-10-02T19:00:00-04:00'));
    ok(g.purged === 1 && !DB.sqlite.prepare("SELECT 1 FROM app_data WHERE key = 'timer:ancient'").get(), 'a tombstone 31 days old is purged at the top of the hour', g);
  }
  const plan = DB.sqlite.prepare("EXPLAIN QUERY PLAN SELECT id FROM app_data INDEXED BY app_data_timer_live WHERE app_id = 'timer' AND scope = 'person' AND value IS NOT NULL").all().map(r => r.detail).join();
  ok(/app_data_timer_live/.test(plan), 'the job reads through the partial index of live Timer rows (migrations/008)', plan);
  NOW = RealDate.parse('2026-10-02T18:05:00-04:00');
  const off = await JOBS.timer(env, NOW);
  ok(off.job === 'timer' && off.purged === undefined, 'off the hour the job purges nothing (it only reads)', off);
}

console.log('## forced from Admin');
NOW = RealDate.parse('2026-10-02T18:00:30-04:00');
{ const r = await call('eli', 'POST', '/api/admin/cron/run', { job: 'timer' }); ok(r.status === 200 && r.body.job === 'timer', 'POST /api/admin/cron/run {job: "timer"}', r.body); }
{ const r = await call('christian', 'POST', '/api/admin/cron/run', { job: 'timer' }); ok(r.status === 403, 'admin only', r.body); }

globalThis.Date = RealDate; rx.close();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
