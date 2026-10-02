// Batch 5 (IMP-VERSES-I2), in process, on the pattern of audits/tools/phase6/4/cron-check-4.mjs: the evening verse review.
// jobsAt runs `verses` at every firing of the 7 pm New York hour (EDT and EST) and at no other; the job counts what is due
// from the person's own F260 rows (mem:/recall: over the old f260.mem / f260.recall maps — never Verses' summary row), tells
// only a grown-up who switched it on (push_pref:verses = true; it starts off) and has something due, once a day (a 7:15 pm
// firing does not tell them twice, the next evening does), never a kid; and it can be forced from Admin. Run from the repo root.
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.cwd();
const RealDate = Date; let NOW = RealDate.parse('2026-09-29T12:00:00-04:00');
class SimDate extends RealDate { constructor(...a) { if (a.length === 0) super(NOW); else super(...a); } static now() { return NOW; } }
globalThis.Date = SimDate;
globalThis.caches ||= { default: { async match() {}, async put() {} } };
const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { jobsAt, versesDue, PREF_DEFAULTS } = await import(pathToFileURL(path.join(ROOT, 'worker/src/reminders.js')).href);
const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
const { seedDemo, DEVICE, sessionToken } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);
let pass = 0, fail = 0; const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 600)); } };

console.log('## jobsAt: the 7 pm hour');
const J = iso => jobsAt(RealDate.parse(iso)).names.join('+');
ok(J('2026-09-29T23:00:00Z') === 'evening+verses+park+praytime', '7:00 pm EDT (23:00Z) runs verses', J('2026-09-29T23:00:00Z'));
ok(J('2026-12-02T00:00:00Z') === 'evening+verses+park+praytime', '7:00 pm EST (00:00Z next day) runs verses', J('2026-12-02T00:00:00Z'));
ok(J('2026-09-29T23:45:00Z') === 'evening+verses+park+praytime' && !jobsAt(RealDate.parse('2026-09-29T23:45:00Z')).main, 'every firing of the hour (7:45 pm) runs it, and it is not a main firing', J('2026-09-29T23:45:00Z'));
ok(J('2026-09-29T22:45:00Z') === 'evening+park+praytime', '6:45 pm: no verses', J('2026-09-29T22:45:00Z'));
ok(J('2026-09-30T00:00:00Z') === 'evening+prayer+prayedfor+park+praytime', '8:00 pm (Tuesday): the 8 pm jobs, no verses', J('2026-09-30T00:00:00Z'));
ok(J('2026-07-01T12:00:00Z') === 'evening+morning+prayer+park+praytime' && J('2026-09-28T00:00:00Z') === 'evening+behind+prayer+prayedfor+park+praytime', 'the 8 am and Sunday 8 pm runs are unchanged');
ok(PREF_DEFAULTS.verses === false && PREF_DEFAULTS.f260 === true, 'the verses switch starts off (every other kind starts on)', PREF_DEFAULTS);

console.log('## versesDue: apps/verses.html dueIds() for a grown-up');
const T = '2026-09-29';
ok(versesDue({ '1-0': true, '1-1': true, '2-0': true, '2-1': true, '3-0': true }, { '1-0': { due: '2026-09-28' }, '1-1': { due: T }, '2-0': { due: '2026-10-01' }, '2-1': { s: 'got', t: 1 }, '3-0': { due: 'soon' } }, T).sort().join() === '1-0,1-1,2-1,3-0',
  'overdue, due today, a pre-Leitner row (no due) and a bad due are due; a future due is not');
ok(versesDue({ '53-0': true, '0-1': true, '4-2': true, 'x': true, '5-0': false, '6-1': 0 }, {}, T).length === 0, 'week 53, week 0, a third verse, a junk id and a verse marked off are never counted');
ok(versesDue({ '7-1': { at: 1 } }, null, T).join() === '7-1', 'a truthy mem value counts (F260 writes true) and no recall map means never reviewed');

// receiver + VAPID
const received = [];
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const port = await freePort();
const rx = http.createServer((q, s) => { let b = ''; q.on('data', d => b += d); q.on('end', () => { received.push(q.url.split('/').pop()); s.writeHead(201); s.end(); }); }).listen(port, '127.0.0.1');
const subKeys = async () => { const k = await crypto.webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']); return { p256dh: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', k.publicKey)).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') }; };
const vk = await crypto.webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const VAPID = { VAPID_PUBLIC_KEY: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', vk.publicKey)).toString('base64url'), VAPID_PRIVATE_KEY: (await crypto.webcrypto.subtle.exportKey('jwk', vk.privateKey)).d, VAPID_SUBJECT: 'mailto:rig@example.invalid' };
const DB = createD1(':memory:'); const env = { DB, ALLOWED_ORIGINS: 'http://localhost:8765', ...VAPID };
await seedDemo(DB, { variant: 'typical', now: NOW, assets: '' });
DB.sqlite.prepare('DELETE FROM push_log').run();
const call = async (pid, method, p, body) => { const r = await worker.fetch(new Request('http://api.local' + p, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8765', 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(pid) }, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {}, passThroughOnException() {} }); const t = await r.text(); try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; } };
for (const id of ['eli', 'christian', 'mom', 'dad']) { const r = await call(id, 'POST', '/api/push/subscribe', { subscription: { endpoint: `http://127.0.0.1:${port}/push/${id}`, keys: await subKeys() } }); if (r.status !== 200) throw new Error('sub ' + id + JSON.stringify(r.body)); }
const sched = async iso => { NOW = RealDate.parse(iso); received.length = 0; const logs = []; const orig = console.log; console.log = (...a) => logs.push(a); try { await worker.scheduled({ cron: '*/15 * * * *', scheduledTime: NOW }, env, { waitUntil() {} }); } finally { console.log = orig; } const l = logs.find(a => a[0] === 'cron'); const out = l ? JSON.parse(l[2]) : null; return { out, verses: out ? out.ran.find(j => j.job === 'verses') || null : null }; };
const put = (pid, app, key, value) => call(pid, 'PUT', `/api/data/${app}/${encodeURIComponent(key)}?scope=person`, { value, updated_at: NOW });

console.log('## the job, through the scheduled handler');
// David: a clean slate, then three memorised verses — 10-0 due today, 10-1 due in 3 days, 11-0 never reviewed → 2 due. The old
// whole maps sit under the rows: f260.mem lists 12-0 (switched off by its row mem:12-0 = false) and f260.recall says 10-1 was
// due on 1 September (its row says 2 October, and the row wins).
DB.sqlite.prepare("DELETE FROM app_data WHERE app_id = 'f260' AND scope = 'person' AND profile_id = 'dad' AND (substr(key, 1, 4) = 'mem:' OR substr(key, 1, 7) = 'recall:' OR key IN ('f260.mem', 'f260.recall'))").run();
for (const [k, v] of [['f260.mem', { '12-0': true }], ['f260.recall', { '10-1': { box: 1, due: '2026-09-01' } }], ['mem:10-0', true], ['mem:10-1', true], ['mem:11-0', true], ['mem:12-0', false],
  ['recall:10-0', { s: 'not', t: NOW, box: 1, due: T, last: '2026-09-28', streak: 0 }], ['recall:10-1', { s: 'got', t: NOW, box: 3, due: '2026-10-02', last: '2026-09-28', streak: 2 }]]) {
  const r = await put('dad', 'f260', k, v); if (r.status !== 200) ok(false, 'seed dad ' + k, r.body);
}
// a stale summary in Verses' own scope that says nothing is due: the job must not read it
await put('dad', 'verses', 'summary', { due: 0, streak: 3, boxes: [1, 0, 2, 0, 0], total: 3, reviewedToday: 0, week: null, at: '2026-09-20' });
// Eli: his seeded verses, the switch on; what is due is counted here independently, straight from the rows
const eliDue = (() => {
  const rows = DB.sqlite.prepare("SELECT key, value FROM app_data WHERE app_id = 'f260' AND scope = 'person' AND profile_id = 'eli' AND value IS NOT NULL").all();
  const val = k => { const r = rows.find(x => x.key === k); return r ? JSON.parse(r.value) : null; };
  const mem = { ...(val('f260.mem') || {}) }, rc = { ...(val('f260.recall') || {}) };
  for (const r of rows) { const v = JSON.parse(r.value); if (r.key.startsWith('mem:')) { if (v === false) delete mem[r.key.slice(4)]; else mem[r.key.slice(4)] = v; } if (r.key.startsWith('recall:')) { if (v === false) delete rc[r.key.slice(7)]; else rc[r.key.slice(7)] = v; } }
  let n = 0;
  for (const [id, on] of Object.entries(mem)) { const m = /^(\d+)-([01])$/.exec(id); if (!on || !m || +m[1] < 1 || +m[1] > 52) continue; const d = rc[id] && rc[id].due; if (!(typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) || d <= T) n++; }
  return n;
})();
for (const [pid, v] of [['dad', true], ['eli', true], ['mom', true]]) await put(pid, 'hub', 'push_pref:verses', v);
NOW += 1000; await put('mom', 'hub', 'push_pref:verses', false);   // Mom turned it on, then off again
// Ezra (a kid) has a due recall row (Verses writes it in his F260 scope) and his own switch row on
{ const r = await put('ezra', 'f260', 'recall:5-0', { s: 'not', t: NOW, box: 1, due: '2026-09-27', last: '2026-09-26', streak: 0 }); ok(r.status === 200, 'Ezra (kid) writes his own recall row', r.body); }
{ const r = await put('ezra', 'hub', 'push_pref:verses', true); ok(r.status === 200, 'Ezra writes push_pref:verses = true', r.body); }

let s = await sched('2026-09-29T18:45:00-04:00');
ok(s.out && !s.verses && !received.length, '6:45 pm: no verses job, nothing sent', s.out && s.out.ran.map(j => j.job));
s = await sched('2026-09-29T19:00:00-04:00');
const chk = s.verses ? Object.fromEntries(s.verses.checked.map(c => [c.profile, c.due])) : {};
ok(s.verses && chk.dad === 2, '7:00 pm: David has 2 due (today\'s and the never-reviewed; the row beats the old map both ways; the stale summary\'s 0 is not read)', s.verses);
ok(chk.eli === eliDue, `Eli's count is the rows' own (${eliDue}, counted independently here)`, { job: chk.eli, here: eliDue });
ok(s.verses && s.verses.skipped.some(x => x.profile === 'mom' && x.why === 'pref_off') && s.verses.skipped.some(x => x.profile === 'christian' && x.why === 'pref_off') && !('mom' in chk) && !('christian' in chk), 'Mom (switched off again) and Mae (never on) are not counted or told', s.verses && s.verses.skipped);
const everyone = s.verses ? JSON.stringify(s.verses) : '';
ok(s.verses && !/"(ezra|kiara|tv|kitchen)"/.test(everyone), 'no kid, display or kitchen is ever considered (Ezra has a verse due and his switch on)', s.verses);
const told = s.verses ? s.verses.notified.map(n => n.profile).sort().join() : null;
ok(told === (eliDue ? 'dad,eli' : 'dad') && received.sort().join() === told, `told and received: ${told}`, { told, received });
s = await sched('2026-09-29T19:15:00-04:00');
ok(s.verses && !s.verses.notified.length && s.verses.skipped.some(x => x.profile === 'dad' && x.why === 'already_today') && !received.length, '7:15 pm: eligible again, but nobody twice (once a day, delivered pushes only)', s.verses);
s = await sched('2026-09-29T20:00:00-04:00');
ok(s.out && !s.verses, '8:00 pm: the verses job does not run', s.out && s.out.ran.map(j => j.job));
NOW = RealDate.parse('2026-09-30T03:00:00-04:00');
{ const f = await call('eli', 'POST', '/api/admin/cron/run', { job: 'verses' }); ok(f.status === 200 && f.body.job === 'verses' && f.body.date === '2026-09-30' && f.body.notified.some(n => n.profile === 'dad'), 'forced from Admin at 3 am (30 Sept): it runs whatever the hour and tells David (a new day)', f.body); }
{ const f = await call('christian', 'POST', '/api/admin/cron/run', { job: 'verses' }); ok(f.status === 403, 'forcing it is admin only', f.body); }
s = await sched('2026-09-30T19:00:00-04:00');
ok(s.verses && s.verses.skipped.some(x => x.profile === 'dad' && x.why === 'already_today') && !received.includes('dad'), '30 Sept, 7 pm: the forced push that morning counts toward the day', s.verses);
// the next evening David is told again; then, with nothing due, he is not
s = await sched('2026-10-01T19:00:00-04:00');
ok(s.verses && s.verses.notified.some(n => n.profile === 'dad') && received.includes('dad'), 'the next evening (1 Oct, 7 pm): David is told again', s.verses);
NOW = RealDate.parse('2026-10-02T12:00:00-04:00');
await put('dad', 'f260', 'recall:10-0', { s: 'got', t: NOW, box: 2, due: '2026-10-04', last: '2026-10-02', streak: 1 });
await put('dad', 'f260', 'recall:11-0', { s: 'got', t: NOW, box: 2, due: '2026-10-04', last: '2026-10-02', streak: 1 });
await put('dad', 'f260', 'recall:10-1', { s: 'got', t: NOW, box: 4, due: '2026-10-09', last: '2026-10-02', streak: 3 });   // its 2 Oct review
s = await sched('2026-10-02T19:00:00-04:00');
ok(s.verses && s.verses.checked.find(c => c.profile === 'dad').due === 0 && s.verses.skipped.some(x => x.profile === 'dad' && x.why === 'nothing_due') && !received.includes('dad'), 'nothing due (2 Oct): David is not told', s.verses);

// batch 5 review round 2 (gap D): a GUEST's own evening review. The rig's guest (kept, not expiring) memorises two verses,
// both due; with push_pref:verses on she is told at 7 pm, and the next evening, switched off, she is not
console.log('## a guest');
const G = DB.sqlite.prepare('SELECT id FROM profiles WHERE is_guest = 1 ORDER BY sort_order LIMIT 1').get();
ok(!!G, 'the rig has a guest', G);
if (G) {
  const gid = G.id;
  DB.sqlite.prepare('UPDATE profiles SET expires_at = NULL WHERE id = ?').run(gid);
  NOW = RealDate.parse('2026-10-03T12:00:00-04:00');
  { const r = await call(gid, 'POST', '/api/push/subscribe', { subscription: { endpoint: `http://127.0.0.1:${port}/push/${gid}`, keys: await subKeys() } }); ok(r.status === 200, 'the guest subscribes on her phone', r.body); }
  for (const [k, v] of [['mem:20-0', true], ['mem:20-1', true], ['recall:20-1', { s: 'not', t: NOW, box: 1, due: '2026-10-02', last: '2026-10-01', streak: 0 }]]) { const r = await put(gid, 'f260', k, v); ok(r.status === 200, 'the guest writes her own ' + k, r.body); }
  await put(gid, 'hub', 'push_pref:verses', true);
  s = await sched('2026-10-03T19:00:00-04:00');
  const gc = s.verses && s.verses.checked.find(c => c.profile === gid);
  ok(gc && gc.due === 2 && s.verses.notified.some(n => n.profile === gid) && received.includes(gid), 'switched on, 2 due: the guest is told at 7 pm (her own review)', s.verses);
  NOW = RealDate.parse('2026-10-04T12:00:00-04:00');
  await put(gid, 'hub', 'push_pref:verses', false);
  s = await sched('2026-10-04T19:00:00-04:00');
  ok(s.verses && s.verses.skipped.some(x => x.profile === gid && x.why === 'pref_off') && !s.verses.notified.some(n => n.profile === gid) && !received.includes(gid), 'switched off (verses still due): the guest is not told', s.verses);
}

globalThis.Date = RealDate; rx.close();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
