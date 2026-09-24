// CHAT 09 — the Chat tab's history (GET /api/chat/history: newest 20 rows, any age, worker/src/chat.js:455) versus what
// the model is sent (newest 20 rows of the last 36 h, chat.js:398, 403). Overflow variant: two weeks of chat per person.
//   node "audits/tools/phase2/CHAT/09-history-window.mjs"
import { local, DEMO } from '../../lib/local.mjs';
import { chat, history, save } from './lib.mjs';

const L = await local({ variant: 'overflow', clock: 'demo' });
const out = [];
try {
  for (const pid of ['eli', 'christian', 'mom', 'dad', 'ezra', 'kiara', 'guest-grandmajo']) {
    const h = await history(L, pid);
    if (h.used >= h.cap) { out.push({ pid, shown: h.messages.length, note: 'at cap, cannot send' }); continue; }
    await L.anthropicLog({ clear: true }); await L.anthropic([{ text: 'ok' }]);
    await chat(L, pid, 'do you remember what we talked about?');
    const sent = (await L.anthropicLog())[0].body.messages.length - 1;   // minus the new message
    const ages = h.messages.map(m => Math.round((DEMO - m.created_at) / 3600000));
    const rec = { pid, shownInTab: h.messages.length, shownOlderThan36h: ages.filter(a => a > 36).length, oldestShownHoursAgo: Math.max(...ages, 0), historyTurnsSentUpstream: sent };
    out.push(rec); console.log(JSON.stringify(rec));
  }
  console.log('evidence:', save('09-history-window.json', out));
} finally { await L.close(); }
