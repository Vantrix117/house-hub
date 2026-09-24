// PROF skeptic #2 for "admin-usage-utc-day": does Admin → Usage group chat by a different day than the daily cap?
// Two messages from David on the SAME New York day (22 Sep 2026, 10:00 and 21:30 EDT). The cap (GET /api/chat/history
// `used`, and the `done` event's `used`) is read at 21:35 New York; Admin → Usage is read as Eli right after.
// Control: a third message at 00:30 NY on 23 Sep, to see where it lands. Also: David subscribes a stand-in push endpoint
// on 127.0.0.1 and sends himself a test push at 20:05 NY 22 Sep (the hour the 8 pm reminders go out), to see which day the push table files it under.
// Local rig only.
//
//   node "audits/tools/phase2/PROF/verify-admin-usage-utc-day-2.mjs"
import { local } from '../../lib/local.mjs';
import http from 'node:http';
import crypto from 'node:crypto';

const L = await local({ variant: 'empty', clock: 'demo', vapid: true });
// a stand-in push endpoint on 127.0.0.1 (the rig allows local outbound fetch) that accepts everything
const rx = http.createServer((q, s) => { q.resume(); q.on('end', () => { s.statusCode = 201; s.end(); }); });
await new Promise(r => rx.listen(0, '127.0.0.1', r));
const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
const sub = { endpoint: 'http://127.0.0.1:' + rx.address().port + '/push/dad', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
const say = async (iso, msg) => {
  await L.clock(iso);
  await L.anthropic([{ text: 'Noted.' }]);
  const r = await L.apiAs('dad', '/api/chat', { method: 'POST', body: { message: msg, apps: [] } });
  const done = String(r.body).split('\n').find(l => l.includes('"used"')) || '';
  console.log(`chat as David at ${iso} → ${r.status}  done: ${done.trim()}`);
};
try {
  console.log('subscribe David →', (await L.apiAs('dad', '/api/push/subscribe', { method: 'POST', body: { subscription: sub } })).status);
  await L.clock('2026-09-22T20:05:00-04:00');
  const ev = await L.apiAs('dad', '/api/push/test', { method: 'POST', body: {} });
  console.log('8:05 pm NY 22 Sep, David taps Send a test notification →', ev.status, JSON.stringify(ev.body).slice(0, 160));
  await say('2026-09-22T10:00:00-04:00', 'Morning note');
  await say('2026-09-22T21:30:00-04:00', 'Evening note');
  await L.clock('2026-09-22T21:35:00-04:00');
  const h = await L.apiAs('dad', '/api/chat/history');
  console.log('At 21:35 NY 22 Sep, David\'s Chat tab cap:', `${h.body.used}/${h.body.cap} today`);
  const u = await L.apiAs('eli', '/api/admin/usage');
  console.log('At 21:35 NY 22 Sep, Admin → Usage chat rows:', JSON.stringify(u.body.chat));

  await say('2026-09-23T00:30:00-04:00', 'After midnight');
  const h2 = await L.apiAs('dad', '/api/chat/history');
  console.log('At 00:30 NY 23 Sep, David\'s Chat tab cap:', `${h2.body.used}/${h2.body.cap} today`);
  const u2 = await L.apiAs('eli', '/api/admin/usage');
  console.log('At 00:30 NY 23 Sep, Admin → Usage chat rows:', JSON.stringify(u2.body.chat));
  console.log('Push rows (same UTC grouping, for reference):', JSON.stringify(u2.body.push));
} finally { await L.close(); rx.close(); }
