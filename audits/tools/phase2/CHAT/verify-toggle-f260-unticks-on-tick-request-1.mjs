// Skeptic #1 for finding "toggle-f260-unticks-on-tick-request" (audit Phase 2, CHAT).
// Independent re-run on a fresh local instance: does toggle_f260_reading untick an already-ticked reading
// when the user asks to tick it off, and what does the chip / feed / summary / log say afterwards?
// Also: the "retry after a failed send" variant (upstream 500 after the tool already ran, then the same request again).
// Run: node "audits/tools/phase2/CHAT/verify-toggle-f260-unticks-on-tick-request-1.mjs"
import { local } from '../../lib/local.mjs';
import { toolCall, chat, data, feed, history, save } from './lib.mjs';

const out = {};
// clock 'real': the rig's demo clock advances 1 ms per real second (lib/server.mjs:35), so two chat writes a few
// seconds apart share an updated_at and the second loses last-write-wins (data.js:60) — a rig artefact, not the app.
const CLOCK = process.argv[2] || 'real';
const L = await local({ variant: 'typical', clock: CLOCK });
out.clock = CLOCK;
try {
  const P = 'eli';
  const get = k => data(L, P, 'f260', 'person', k);
  const done0 = await get('f260.done'); const sum0 = await get('f260.summary'); const log0 = await get('f260.log');
  const week = sum0.week;
  const ticked = [0, 1, 2, 3, 4].find(d => done0[`${week}-${d}`]);
  const unticked = [0, 1, 2, 3, 4].find(d => !done0[`${week}-${d}`]);
  out.before = { week, weekDone: sum0.weekDone, readToday: sum0.readToday, total: sum0.total, doneThisWeek: [0, 1, 2, 3, 4].filter(d => done0[`${week}-${d}`]).map(d => d + 1), ticked: ticked + 1, unticked: unticked + 1, logKeysTail: Object.keys(log0 || {}).sort().slice(-3) };
  console.log('BEFORE', JSON.stringify(out.before));

  // A. "I read it, tick it off" on a reading that is already ticked
  let r = await toolCall(L, P, 'toggle_f260_reading', { week, day: ticked + 1 }, { message: `I read week ${week} day ${ticked + 1}, tick it off`, after: 'Ticked it off.' });
  const done1 = await get('f260.done'); const sum1 = await get('f260.summary'); const log1 = await get('f260.log');
  out.A = { key: `${week}-${ticked}`, doneBefore: !!done0[`${week}-${ticked}`], doneAfter: !!done1[`${week}-${ticked}`], ok: r.ok, chip: r.chip, toolResult: r.toolResult,
    weekDone: `${sum0.weekDone} -> ${sum1.weekDone}`, total: `${sum0.total} -> ${sum1.total}`, readToday: `${sum0.readToday} -> ${sum1.readToday}`,
    logChanged: JSON.stringify(log0) !== JSON.stringify(log1) };
  const f = await feed(L, P, 3); out.A.feedTop = (Array.isArray(f) ? f : (f.items || f.activity || [])).slice(0, 2).map(x => x.text);
  console.log('A (tick-off on already ticked)', JSON.stringify(out.A));

  // B. Retry after a failed send: tool runs (ticks an unticked day), follow-up upstream call 500s, user sends the same line again.
  const kB = `${week}-${unticked}`;
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name: 'toggle_f260_reading', input: { week, day: unticked + 1 } }] }, { status: 500, message: 'overloaded' }]);
  const b1 = await chat(L, P, `I read week ${week} day ${unticked + 1}, tick it off`);
  const afterFail = !!(await get('f260.done'))[kB];
  const hist = await history(L, P);
  const lastAssistant = (Array.isArray(hist) ? hist : (hist.messages || [])).filter(m => m.role === 'assistant').slice(-1)[0];
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name: 'toggle_f260_reading', input: { week, day: unticked + 1 } }] }, { text: 'Done, ticked off.' }]);
  const b2 = await chat(L, P, `I read week ${week} day ${unticked + 1}, tick it off`);
  const log = await L.anthropicLog();
  const retryHistorySent = log[0] && log[0].body.messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content.slice(-120) : '[blocks]' })).slice(-3);
  const afterRetry = !!(await get('f260.done'))[kB];
  out.B = { key: kB, firstSend: { chips: b1.chips, error: b1.error, textShown: b1.text }, tickLandedDespiteError: afterFail, historyAssistantAfterFail: lastAssistant && lastAssistant.content,
    retry: { chips: b2.chips, text: b2.text }, doneAfterRetry: afterRetry, retryUpstreamSawHistory: retryHistorySent };
  console.log('B (retry after failed send)', JSON.stringify(out.B));
} finally {
  console.log('saved', save('verify-toggle-f260-unticks-on-tick-request-1.json', out));
  await L.close();
}
