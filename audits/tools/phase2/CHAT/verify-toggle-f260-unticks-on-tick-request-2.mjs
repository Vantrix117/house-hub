// Skeptic #2 for finding "toggle-f260-unticks-on-tick-request" (audit Phase 2, CHAT).
// Independent of the investigator's scripts. Questions:
//   A. Does toggle_f260_reading on an already-ticked day untick it (done, summary, chip, feed, log)?
//   B. Is it non-idempotent: the same "tick week W day D" call twice (a resend) leaves the day unticked?
//      (Waits 1.5 s between writes: the rig's demo clock moves 1 ms per real second, and putOne is strict
//       last-write-wins on updated_at, so two writes in the same real second would tie and the second be dropped —
//       a rig artefact this script avoids.)
//   C. What the model is told: the tool description + the F260 line of the system prompt, and whether
//      f260_status (the prompt's "quick way") exposes per-day done state so a model could check before toggling.
//   D. After an upstream failure mid-turn, does the chat history the model sees on a resend record that the tick landed?
// Run: node "audits/tools/phase2/CHAT/verify-toggle-f260-unticks-on-tick-request-2.mjs"
import { local, sleep } from '../../lib/local.mjs';
import { toolCall, chat, data, feed, history, save } from './lib.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const P = 'eli';
  const get = k => data(L, P, 'f260', 'person', k);
  const snap = async () => ({ done: await get('f260.done') || {}, sum: await get('f260.summary'), log: await get('f260.log') || {} });
  const s0 = await snap();
  const week = s0.sum.week;
  const days = [0, 1, 2, 3, 4];
  const ticked = days.find(d => s0.done[`${week}-${d}`]);
  const unticked = days.filter(d => !s0.done[`${week}-${d}`]);
  out.before = { week, doneThisWeek: days.filter(d => s0.done[`${week}-${d}`]).map(d => d + 1), summary: { weekDone: s0.sum.weekDone, total: s0.sum.total, readToday: s0.sum.readToday } };
  console.log('BEFORE', JSON.stringify(out.before));

  // ── A: "tick it off" on an already-ticked day ──
  await sleep(1500);
  const a = await toolCall(L, P, 'toggle_f260_reading', { week, day: ticked + 1 }, { message: `I read week ${week} day ${ticked + 1}, tick it off please`, after: 'Ticked off.' });
  const s1 = await snap();
  const fa = await feed(L, P, 2);
  out.A = { day: ticked + 1, doneBefore: !!s0.done[`${week}-${ticked}`], doneAfter: !!s1.done[`${week}-${ticked}`], chip: a.chip, ok: a.ok, toolResult: a.toolResult && a.toolResult.content,
    modelFinalTextShown: a.text, weekDone: `${s0.sum.weekDone} -> ${s1.sum.weekDone}`, total: `${s0.sum.total} -> ${s1.sum.total}`, logUnchanged: JSON.stringify(s0.log) === JSON.stringify(s1.log),
    feedTop: (Array.isArray(fa) ? fa : (fa.items || [])).slice(0, 1).map(x => x.text) };
  console.log('A', JSON.stringify(out.A));

  // ── B: same tick request twice (a resend) on an unticked day ──
  const dB = unticked[0];
  await sleep(1500);
  const b1 = await toolCall(L, P, 'toggle_f260_reading', { week, day: dB + 1 }, { message: `tick off week ${week} day ${dB + 1}`, after: 'Done.' });
  const afterB1 = !!(await get('f260.done'))[`${week}-${dB}`];
  await sleep(1500);
  const b2 = await toolCall(L, P, 'toggle_f260_reading', { week, day: dB + 1 }, { message: `tick off week ${week} day ${dB + 1}`, after: 'Done.' });
  const afterB2 = !!(await get('f260.done'))[`${week}-${dB}`];
  out.B = { day: dB + 1, first: { chip: b1.chip, doneAfter: afterB1 }, second: { chip: b2.chip, doneAfter: afterB2 } };
  console.log('B', JSON.stringify(out.B));

  // ── C: what the model is told ──
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name: 'f260_status', input: {} }] }, { text: 'ok' }]);
  await sleep(1500);
  await chat(L, P, 'where am I in my reading?');
  const lg = await L.anthropicLog();
  const body0 = lg[0] && lg[0].body;
  const tdef = body0 && body0.tools.find(t => t.name === 'toggle_f260_reading');
  const sys = body0 && (typeof body0.system === 'string' ? body0.system : JSON.stringify(body0.system));
  const second = lg[1] && lg[1].body; const last = second && second.messages[second.messages.length - 1];
  const tr = last && Array.isArray(last.content) ? last.content.find(b => b.type === 'tool_result') : null;
  out.C = { toolDescription: tdef && tdef.description, toolInputProps: tdef && Object.keys(tdef.input_schema.properties),
    promptF260Line: sys && (sys.split('\n').find(l => l.includes('toggle_f260_reading')) || null),
    promptDataConventions: sys && (sys.split('\n').find(l => l.includes('f260.done')) || null),
    f260StatusResult: tr && tr.content };
  console.log('C', JSON.stringify(out.C));

  // ── D: failure after the tool ran; what the resend's upstream sees ──
  const dD = unticked[1] != null ? unticked[1] : unticked[0];
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name: 'toggle_f260_reading', input: { week, day: dD + 1 } }] }, { status: 500, message: 'overloaded' }]);
  await sleep(1500);
  const d1 = await chat(L, P, `I read week ${week} day ${dD + 1}, tick it off`);
  const afterD1 = !!(await get('f260.done'))[`${week}-${dD}`];
  const h = await history(L, P);
  const lastA = (h.messages || []).filter(m => m.role === 'assistant').slice(-1)[0];
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ text: 'noop' }]);
  await sleep(1500);
  await chat(L, P, `I read week ${week} day ${dD + 1}, tick it off`);
  const lg2 = await L.anthropicLog();
  const seen = lg2[0] && lg2[0].body.messages.slice(-3).map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '[blocks]' }));
  out.D = { day: dD + 1, firstSend: { chips: d1.chips, error: d1.error && d1.error.message }, tickLandedDespiteError: afterD1, historyAssistantAfterFail: lastA && lastA.content, resendUpstreamSees: seen };
  console.log('D', JSON.stringify(out.D));
} finally {
  console.log('saved', save('verify-toggle-f260-unticks-on-tick-request-2.json', out));
  await L.close();
}
