// CHAT 03 — the daily cap, enforced server-side: messages until 429, concurrent sends at the cap edge, and whether a
// failed upstream still spends a message. Plus: a tool whose write loses last-write-wins still shows a ✓ chip.
//   node "audits/tools/phase2/CHAT/03-cap.mjs"
import { local } from '../../lib/local.mjs';
import { chat, toolCall, history, data, put, save } from './lib.mjs';

const out = {};
let L = await local({ variant: 'typical', clock: 'real' });
try {
  const P = 'christian';                                  // Mae
  // 1. sequential until 429
  let used0 = (await history(L, P)).used, sent = 0, first429 = null;
  for (let i = 0; i < 80; i++) {
    const r = await chat(L, P, 'message ' + i);
    if (r.status === 429) { first429 = { afterSends: sent, body: r.json }; break; }
    sent++;
  }
  out.sequential = { usedAtStart: used0, okSends: sent, first429, usedNow: (await history(L, P)).used };
  console.log('sequential:', JSON.stringify(out.sequential));

  // 2. concurrent sends at the edge: bring Mae to cap-3, then fire 10 at once
  await L.reset('typical');
  used0 = (await history(L, P)).used;
  for (let i = used0; i < 57; i++) await chat(L, P, 'fill ' + i);
  const before = (await history(L, P)).used;
  const burst = await Promise.all(Array.from({ length: 10 }, (_, i) => chat(L, P, 'burst ' + i)));
  const after = (await history(L, P)).used;
  out.concurrent = { usedBefore: before, fired: 10, status200: burst.filter(r => r.status === 200).length, status429: burst.filter(r => r.status === 429).length, usedAfter: after, cap: 60 };
  console.log('concurrent at the edge:', JSON.stringify(out.concurrent));

  // 3. failed upstream still counts
  await L.reset('typical');
  const u = [];
  u.push((await history(L, P)).used);
  await L.anthropic([{ status: 500, message: 'mock internal error' }]); const e500 = await chat(L, P, 'upstream 500 please');
  u.push((await history(L, P)).used);
  await L.anthropic([{ streamError: 'Overloaded' }]); const eStream = await chat(L, P, 'stream error please');
  u.push((await history(L, P)).used);
  await L.anthropic([{ status: 429, message: 'rate limited upstream' }]); const e429 = await chat(L, P, 'upstream 429 please');
  u.push((await history(L, P)).used);
  const h = await history(L, P);
  out.failedUpstream = {
    usedSequence: u, e500: { http: e500.status, error: e500.error }, eStream: { http: eStream.status, error: eStream.error }, e429: { http: e429.status, error: e429.error },
    historyTail: h.messages.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 60)}`),
  };
  console.log('failed upstream:', JSON.stringify(out.failedUpstream, null, 1));

  // 4. a tool write that loses last-write-wins still reports ✓ (chat.js ignores putOne's `applied`)
  //    Eli's F260 row was last written by a device whose clock runs 2 minutes fast (putOne accepts up to +5 min, data.js:41).
  const done0 = await data(L, 'eli', 'f260', 'person', 'f260.done');
  await L.apiAs('eli', '/api/data/f260/f260.done?scope=person', { method: 'PUT', body: { value: done0, updated_at: Date.now() + 120000 } });
  const sum = await data(L, 'eli', 'f260', 'person', 'f260.summary');
  const day = [0, 1, 2, 3, 4].find(d => !done0[`${sum.week}-${d}`]);
  const r = await toolCall(L, 'eli', 'toggle_f260_reading', { week: sum.week, day: day + 1 });
  const done1 = await data(L, 'eli', 'f260', 'person', 'f260.done');
  const feed = await L.apiAs('eli', '/api/activity?limit=3');
  out.lwwLostButTicked = { key: `${sum.week}-${day}`, chip: r.chip, toolResult: r.toolResult && r.toolResult.content, serverHasIt: !!done1[`${sum.week}-${day}`], feedTop: feed.body.activity[0] && feed.body.activity[0].text };
  console.log('LWW-lost write:', JSON.stringify(out.lwwLostButTicked));
} finally { await L.close(); }

// 5. lead check: Admin → Usage (UTC day) vs the cap (New York day), on the demo clock (Tue 22 Sep 08:40 NY = 12:40 UTC)
L = await local({ variant: 'typical', clock: 'demo' });
try {
  const usage = (await L.apiAs('eli', '/api/admin/usage')).body;
  const hist = await history(L, 'eli');
  const rows = (usage.chat || []).filter(x => x.profile_id === 'eli' || x.id === 'eli').slice(0, 3);
  out.usageVsCap = { capUsedToday: hist.used, usageRowsForEli: rows, usageKeys: Object.keys(usage) };
  console.log('usage vs cap:', JSON.stringify(out.usageVsCap));
} finally { await L.close(); }
console.log('evidence:', save('03-cap.json', out));
