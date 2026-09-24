// Skeptic #2 for CHAT finding "usage-utc-vs-cap": Admin → Usage groups chat by UTC day, the cap by New York day.
//   node "audits/tools/phase2/CHAT/verify-usage-utc-vs-cap-2.mjs"
// Part A: the seeded demo household (typical, demo clock Tue 22 Sep 2026 08:40 NY) — Eli's counter vs his usage rows,
//         with the created_at of each of his user messages shown in NY and UTC.
// Part B: a controlled run on the empty household: move the Worker clock, send messages, compare.
//   B1. 22 Sep 21:30 NY (= 23 Sep 01:30 UTC) Eli sends 1 message.
//   B2. 23 Sep 08:40 NY Eli sends 1 message.
//   Expect (NY-day intent): Eli's counter says 1/60 on 23 Sep, usage should say 22 Sep: 1, 23 Sep: 1.
import { local } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT');
fs.mkdirSync(EVID, { recursive: true });

const ny = t => new Date(t).toLocaleString('en-CA', { timeZone: 'America/New_York', hour12: false });
const utc = t => new Date(t).toISOString();
const chatAs = async (L, pid, message) => {
  const r = await L.apiAs(pid, '/api/chat', { method: 'POST', body: { message, apps: [] } });
  const done = typeof r.body === 'string' ? (r.body.match(/event: done\ndata: (.*)/) || [])[1] : null;
  return { status: r.status, done: done ? JSON.parse(done) : r.body };
};
const out = {};

// ── Part A ────────────────────────────────────────────────────────────────
let L = await local({ variant: 'typical', clock: 'demo' });
try {
  const hist = (await L.apiAs('eli', '/api/chat/history')).body;
  const usage = (await L.apiAs('eli', '/api/admin/usage')).body;
  out.A = {
    counter: `${hist.used}/${hist.cap}`,
    eliUserMessages: hist.messages.filter(m => m.role === 'user').map(m => ({ ny: ny(m.created_at), utc: utc(m.created_at) })),
    usageRowsEli: usage.chat.filter(r => r.profile_id === 'eli'),
    usageRowsAll: usage.chat.slice(0, 8),
  };
  console.log('A counter (Chat tab):', out.A.counter);
  console.log('A Eli user messages:', JSON.stringify(out.A.eliUserMessages));
  console.log('A usage rows for Eli:', JSON.stringify(out.A.usageRowsEli));
  console.log('A usage rows (first 8):', JSON.stringify(out.A.usageRowsAll));
  // Same grouping on the push half (index.js:525-526). Seed (seed/shell.mjs:106-107): the 8 pm F260 nudge on Sun 20 and
  // Mon 21 Sep NY, and Sunday's 8 pm "behind" push on Sun 20 Sep NY. 8 pm EDT is 00:00 UTC the next day.
  out.A.pushEvening = usage.push.filter(r => r.kind === 'f260' || r.kind === 'behind');
  console.log('A push rows for the 8 pm kinds (seeded Sun 20 + Mon 21 Sep 20:00 NY):', JSON.stringify(out.A.pushEvening));
} finally { await L.close(); }

// ── Part B ────────────────────────────────────────────────────────────────
L = await local({ variant: 'empty', clock: 'demo' });
try {
  const before = (await L.apiAs('eli', '/api/admin/usage')).body.chat.filter(r => r.profile_id === 'eli');
  await L.clock('2026-09-22T21:30:00-04:00');
  const b1 = await chatAs(L, 'eli', 'evening question');
  const h1 = (await L.apiAs('eli', '/api/chat/history')).body;
  await L.clock('2026-09-23T08:40:00-04:00');
  const h2pre = (await L.apiAs('eli', '/api/chat/history')).body;
  const b2 = await chatAs(L, 'eli', 'morning question');
  const h2 = (await L.apiAs('eli', '/api/chat/history')).body;
  const usage = (await L.apiAs('eli', '/api/admin/usage')).body.chat.filter(r => r.profile_id === 'eli');
  out.B = {
    usageBefore: before,
    evening: { status: b1.status, doneUsed: b1.done && b1.done.used, counterAfter: `${h1.used}/${h1.cap}` },
    nextMorningCounterBeforeSend: `${h2pre.used}/${h2pre.cap}`,
    morning: { status: b2.status, doneUsed: b2.done && b2.done.used, counterAfter: `${h2.used}/${h2.cap}` },
    userRows: h2.messages.filter(m => m.role === 'user').map(m => ({ content: m.content, ny: ny(m.created_at), utc: utc(m.created_at) })),
    usageRowsEli: usage,
  };
  console.log('B usage before:', JSON.stringify(before));
  console.log('B 22 Sep 21:30 NY send:', JSON.stringify(out.B.evening));
  console.log('B 23 Sep 08:40 NY counter before send:', out.B.nextMorningCounterBeforeSend);
  console.log('B 23 Sep 08:40 NY send:', JSON.stringify(out.B.morning));
  console.log('B user rows:', JSON.stringify(out.B.userRows));
  console.log('B Admin usage rows for Eli:', JSON.stringify(usage));
} finally { await L.close(); }

const f = path.join(EVID, 'verify-usage-utc-vs-cap-2.json');
fs.writeFileSync(f, JSON.stringify(out, null, 2));
console.log('evidence:', path.relative(ROOT, f).replace(/\\/g, '/'));
