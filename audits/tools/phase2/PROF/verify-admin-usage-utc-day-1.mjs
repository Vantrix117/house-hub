// PROF skeptic #1: "Admin → Usage counts chat by UTC day while the cap uses New York days".
// Fresh local instance (demo clock). David sends one message at 19:30 New York (23:30 UTC, same UTC day) and one at
// 21:30 New York (01:30 UTC next day) on Tue 22 Sep 2026. We then read:
//   - GET /api/chat/history as David (the cap counter the Chat tab shows as "N/60 today"; worker/src/chat.js:112-116, 456)
//   - GET /api/admin/usage as Eli (the rows the Me → Admin → Usage table prints verbatim; index.html:1608-1609)
// Local rig only; no production traffic.
//
//   node "audits/tools/phase2/PROF/verify-admin-usage-utc-day-1.mjs"
import { local } from '../../lib/local.mjs';

const L = await local({ variant: 'empty', clock: 'demo' });
try {
  await L.anthropic([{ text: 'Noted.' }, { text: 'Noted again.' }]);

  await L.clock('2026-09-22T19:30:00-04:00');
  const a = await L.apiAs('dad', '/api/chat', { method: 'POST', body: { message: 'first message, 7:30 pm', apps: [] } });
  console.log('David chat at 19:30 NY (23:30 UTC 22 Sep) →', a.status);

  await L.clock('2026-09-22T21:30:00-04:00');
  const b = await L.apiAs('dad', '/api/chat', { method: 'POST', body: { message: 'second message, 9:30 pm', apps: [] } });
  console.log('David chat at 21:30 NY (01:30 UTC 23 Sep) →', b.status);

  const h = await L.apiAs('dad', '/api/chat/history');
  console.log('Chat tab cap counter for David at 21:30 NY on 22 Sep: used =', h.body.used, '/', h.body.cap, '(New York day 2026-09-22)');

  const u = await L.apiAs('eli', '/api/admin/usage');
  console.log('Admin → Usage chat rows:', JSON.stringify(u.body.chat));

  // Next NY morning: the cap has reset (NY day 23 Sep), but the admin table already shows a message on 23 Sep.
  await L.clock('2026-09-23T08:00:00-04:00');
  const h2 = await L.apiAs('dad', '/api/chat/history');
  console.log('Chat tab cap counter for David at 08:00 NY on 23 Sep: used =', h2.body.used);
  const u2 = await L.apiAs('eli', '/api/admin/usage');
  console.log('Admin → Usage chat rows at 08:00 NY 23 Sep:', JSON.stringify(u2.body.chat));
} finally { await L.close(); }
