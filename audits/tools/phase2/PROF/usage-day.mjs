// PROF (audit Phase 2), lead "Admin → Usage counts chat by UTC day, while the cap counts New York days".
// The Worker's clock is set to 9:30 pm New York (01:30 UTC the next day); David sends one chat message (scripted
// local stand-in upstream); Admin → Usage is read back. Local rig only.
//
//   node "audits/tools/phase2/PROF/usage-day.mjs"
import { local } from '../../lib/local.mjs';

const L = await local({ variant: 'empty', clock: 'demo' });
try {
  await L.clock('2026-09-22T21:30:00-04:00');
  await L.anthropic([{ text: 'Noted.' }]);
  const r = await L.apiAs('dad', '/api/chat', { method: 'POST', body: { message: 'Remind me about the trash', apps: [] } });
  console.log('chat as David at 21:30 New York →', r.status);
  const u = await L.apiAs('eli', '/api/admin/usage');
  console.log('Admin → Usage chat rows:', JSON.stringify(u.body.chat));
  console.log('New York date of that message: 2026-09-22 (the cap counts it there: worker/src/chat.js:112-116)');
} finally { await L.close(); }
