// Phase 2 / PWA — push notifications end to end on the local rig (never production).
//   node "audits/tools/phase2/PWA/push.mjs"
// What it does:
//   1. Starts the stand-in push service scripts/push-receiver.mjs on a free port and reads its subscription.
//   2. Starts the rig with a throwaway VAPID pair (local({ vapid: true })), clock = the demo clock (moved with L.clock).
//   3. Subscribes every profile (adults, kids, the kiosk, the guest) on the rig's Kitchen iPad through the real
//      POST /api/push/subscribe, each with its own endpoint path (/push/<profileId>) so the receiver log shows who got what.
//   4. Forces each job with POST /api/admin/cron/run as Eli, at New York times set with L.clock(), and prints every
//      decrypted notification (title/body/url/tag/TTL/urgency) per recipient, plus the job's notified/skipped lists.
//   5. Reproduces: the once-a-day gate; a family prayer added between the 8 am and 8 pm runs is never announced to the
//      adults who got the 8 am prayer push; logout keeps the device subscribed; the kiosk and kids can subscribe;
//      the test button counts every device of the profile; a failed send blocks the day's retry; one malformed
//      subscription aborts the whole job for everyone after that person.
// Writes audits/evidence/p2/PWA/push-run.json with everything observed.
import { local, sleep } from '../../lib/local.mjs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

// ── 1. the stand-in push service ─────────────────────────────────────────────
const rxPort = await freePort();
const rx = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
let baseSub = null; const pushes = []; let rxBuf = '';
rx.stdout.on('data', d => {
  rxBuf += d; let i;
  while ((i = rxBuf.indexOf('\n')) >= 0) {
    const line = rxBuf.slice(0, i).trim(); rxBuf = rxBuf.slice(i + 1);
    if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
    const m = /^PUSH #(\d+) url=(\S+) vapid=(\S+) ttl=(\S+) urgency=(\S+) enc=(\S+) payload=(.*)$/.exec(line);
    if (m) { let payload; try { payload = JSON.parse(m[7]); } catch { payload = m[7]; } pushes.push({ to: m[2].split('/').pop(), vapid: m[3], ttl: m[4], urgency: m[5], payload }); }
    else if (/^PUSH/.test(line)) pushes.push({ raw: line });
  }
});
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) throw new Error('push receiver did not start');
const subFor = pid => ({ ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${pid}` });

// ── 2. the rig ───────────────────────────────────────────────────────────────
const L = await local({ variant: 'typical', clock: 'demo', vapid: true });
const log = { receiverPort: rxPort, steps: [] };
const say = (title, obj) => { console.log('\n== ' + title); if (obj !== undefined) console.log(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1)); log.steps.push({ title, obj }); };
let mark = 0;
const newPushes = async () => { await sleep(600); const n = pushes.slice(mark); mark = pushes.length; return n.map(p => p.raw ? p : ({ to: p.to, title: p.payload.title, body: p.payload.body, url: p.payload.url, tag: p.payload.tag, ttl: p.ttl, urgency: p.urgency, vapid: p.vapid })); };
let adminOpts = {};   // after Eli signs out of the Kitchen iPad, the admin calls go through his phone's session
const run = async job => {
  const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job }, ...adminOpts });
  const b = r.body || {};
  return { status: r.status, job, notified: (b.notified || []).map(n => `${n.profile}(sent ${n.sent}, ok ${n.ok})`), skipped: (b.skipped || []).map(s => `${s.profile}:${s.why}`), extra: { new: b.new, seeded: b.seeded, due: b.due, checked: b.checked, stale: b.stale, parkDay: b.parkDay, error: b.error || (typeof b === 'object' ? b.message : b) }, received: await newPushes() };
};
const nyClock = async iso => { await L.clock(iso); return iso; };

try {
  const profiles = L.S.profiles.map(p => ({ id: p.id, kind: p.kind, guest: !!p.is_guest, name: p.name }));
  say('profiles on the rig', profiles.map(p => `${p.id} (${p.kind}${p.guest ? ', guest' : ''})`).join(', '));

  // ── 3. subscribe everyone on the Kitchen iPad through the real route ──────────
  const subs = {};
  for (const p of profiles) { const r = await L.apiAs(p.id, '/api/push/subscribe', { method: 'POST', body: { subscription: subFor(p.id) } }); subs[p.id] = r.status + ' ' + JSON.stringify(r.body); }
  say('POST /api/push/subscribe per profile (Kitchen iPad)', subs);
  const cfg = await L.apiAs('eli', '/api/push/config');
  say('GET /api/push/config', cfg.body);

  // ── 4a. morning job + once-a-day gate (Wed 23 Sep 2026, 8:00 am NY; the seed logged Tue's pushes) ──────────
  await nyClock('2026-09-23T08:00:00-04:00');
  say('morning job, Wed 8:00 am', await run('morning'));
  say('morning job again, Wed 8:05 am (once-a-day gate)', (await nyClock('2026-09-23T08:05:00-04:00'), await run('morning')));

  // ── 4b. prayer: watermark, 8 am run, a prayer added at 12:30, the 8 pm run, next morning ───────────────
  await nyClock('2026-09-22T20:00:00-04:00');
  say('prayer job Tue 8:00 pm (baseline: seeds or clears the watermark)', await run('prayer'));
  await nyClock('2026-09-23T07:30:00-04:00');
  const pray = (who, id, title, forWhom) => L.apiAs(who, `/api/data/prayer/prayer:${id}?scope=family`, { method: 'PUT', body: { value: { id, title, for: forWhom, by: who, category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt: '2026-09-23', lastPrayedAt: null, prayedBy: {}, updates: [] } } });
  say('Elizabeth (mom) adds a family prayer at 7:30 am', (await pray('mom', 'audit-a', 'Safe travel for Aunt Ruth', 'Aunt Ruth')).status);
  await nyClock('2026-09-23T08:00:00-04:00');
  say('prayer job Wed 8:00 am', await run('prayer'));
  await nyClock('2026-09-23T12:30:00-04:00');
  say('David (dad) adds a family prayer at 12:30 pm', (await pray('dad', 'audit-b', 'Job interview for Sam', 'Sam')).status);
  await nyClock('2026-09-23T20:00:00-04:00');
  say('prayer job Wed 8:00 pm', await run('prayer'));
  await nyClock('2026-09-24T08:00:00-04:00');
  say('prayer job Thu 8:00 am (is "Job interview for Sam" ever announced?)', await run('prayer'));

  // ── 4c. evening + behind (Wed 8 pm) ────────────────────────────────────────
  await nyClock('2026-09-23T20:00:00-04:00');
  say('evening job Wed 8:00 pm', await run('evening'));
  say('behind job Wed 8:00 pm (forced; the cron only runs it on Sundays)', await run('behind'));

  // ── 4d. park: an adult marker fresh, Ezra's 45 min old ───────────────────────
  await nyClock('2026-09-23T14:00:00-04:00');
  const now = Date.parse('2026-09-23T14:00:00-04:00');
  const loc = (who, pid, ageMin) => L.apiAs(who, `/api/data/dollywood-live/loc:${pid}?scope=family`, { method: 'PUT', body: { value: { x: 0.5, y: 0.5, acc: 8, t: now - ageMin * 60000, name: pid } } });
  await loc('eli', 'eli', 3); await loc('ezra', 'ezra', 45);
  say('park job Wed 2:00 pm (forced; the cron only runs it at 8 am / 8 pm)', await run('park'));

  // ── 4e. test push counts every device of the profile, not this device ────────
  const phone = await L.newDevice({ name: "Eli's phone (rig)", profiles: ['eli', 'mom'] });
  await L.apiAs('eli', '/api/push/subscribe', { method: 'DELETE' });                      // Eli: nothing on the Kitchen iPad
  await L.apiAs('eli', '/api/push/subscribe', { method: 'POST', body: { subscription: subFor('eli-phone') }, deviceToken: phone.device.token, profileToken: phone.sessions.eli });
  const t = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: {} });          // pressed on the Kitchen iPad
  say('Me → Send a test notification, pressed on the Kitchen iPad (Eli subscribed only on his phone)', { status: t.status, body: t.body, received: await newPushes(), uiWouldSay: t.body.sent ? (t.body.ok ? 'Sent — it should appear in a moment.' : 'The push service refused it') : 'No subscription on the server for this device yet.' });
  await L.apiAs('eli', '/api/push/subscribe', { method: 'POST', body: { subscription: subFor('eli') } });   // back on the iPad

  // ── 4f. shared iPad: Eli signs out (Me → Switch = POST /api/logout); his subscription stays ──────────
  const out = await L.apiAs('eli', '/api/logout', { method: 'POST', body: {} });
  const me = await L.apiAs('eli', '/api/me');
  const usage = await L.apiAs('eli', '/api/admin/usage', { deviceToken: phone.device.token, profileToken: phone.sessions.eli });
  say('Eli signs out on the Kitchen iPad', { logout: out.status, meAfter: me.status + ' ' + (me.body.error || ''), pushSubscriptionsByProfile: usage.body.push_subscriptions });
  adminOpts = { deviceToken: phone.device.token, profileToken: phone.sessions.eli };
  const t2 = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: { profile_id: 'eli' }, deviceToken: phone.device.token, profileToken: phone.sessions.eli });
  say('a push to Eli after he signed out of the Kitchen iPad', { status: t2.status, sent: t2.body.sent, received: await newPushes() });

  // ── 4g. kiosk and kid: subscribe + test ──────────────────────────────────────
  for (const pid of ['tv', 'ezra']) {
    const r = await L.apiAs(pid, '/api/push/test', { method: 'POST', body: {} });
    say(`test push as ${pid}`, { status: r.status, sent: r.body.sent, ok: r.body.ok, received: await newPushes() });
  }

  // ── 4h. a failed send counts as "sent today": the 8 pm run cannot retry it ──────
  await nyClock('2026-09-25T08:00:00-04:00');
  const closed = await freePort();
  await L.apiAs('niece', '/api/push/subscribe', { method: 'POST', body: { subscription: { ...baseSub, endpoint: `http://127.0.0.1:${closed}/push/niece` } } });
  await pray('mom', 'audit-c', 'Healing for Mr. Patel', 'Mr. Patel');
  say('Fri 8:00 am prayer run, Mea\'s push service unreachable', await run('prayer'));
  await L.apiAs('niece', '/api/push/subscribe', { method: 'POST', body: { subscription: subFor('niece') } });
  await pray('dad', 'audit-d', 'Rain for the garden', '');
  await nyClock('2026-09-25T20:00:00-04:00');
  say('Fri 8:00 pm prayer run, Mea\'s push service back', await run('prayer'));

  // ── 4i. one malformed subscription row aborts the job for everyone after it (adultIds order) ────────
  await nyClock('2026-09-26T08:00:00-04:00');
  const bad = await L.apiAs('christian', '/api/push/subscribe', { method: 'POST', body: { subscription: { endpoint: `http://127.0.0.1:${rxPort}/push/christian-bad` } } });
  say('Mae (christian) saves a subscription with no keys (only endpoint is validated)', bad.status + ' ' + JSON.stringify(bad.body));
  say('Sat 8:00 am morning job with that row present', await run('morning'));
  await L.apiAs('christian', '/api/push/subscribe', { method: 'POST', body: { subscription: subFor('christian') } });
  await nyClock('2026-09-26T08:10:00-04:00');
  say('same job after Mae\'s row is fixed', await run('morning'));

  // ── 4j. park day on the real schedule: Ezra's marker went quiet at 11:00 am, Eli is still at the park at 8 pm ──
  // (the cron runs park only at 8 am and 8 pm, worker/src/reminders.js:253-255; a stale kid must be 30 min – 4 h old)
  const now2 = Date.parse('2026-09-27T20:00:00-04:00');
  await nyClock('2026-09-27T20:00:00-04:00');
  await L.apiAs('eli', '/api/data/dollywood-live/loc:eli?scope=family', { method: 'PUT', body: { value: { x: 0.5, y: 0.5, acc: 8, t: now2 - 5 * 60000, name: 'eli' } }, ...adminOpts });
  await L.apiAs('ezra', '/api/data/dollywood-live/loc:ezra?scope=family', { method: 'PUT', body: { value: { x: 0.4, y: 0.6, acc: 8, t: Date.parse('2026-09-27T11:00:00-04:00'), name: 'ezra' } } });
  say('Sun 8:00 pm park run — the first scheduled run after Ezra went quiet at 11:00 am', await run('park'));
} finally {
  fs.writeFileSync(path.join(OUT, 'push-run.json'), JSON.stringify(log, null, 1));
  console.log('\nwrote audits/evidence/p2/PWA/push-run.json');
  await L.close(); rx.kill();
}
