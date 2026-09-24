// CHAT skeptic #2 — "thinking blocks are dropped when the Worker continues after a tool call".
//   node "audits/tools/phase2/CHAT/verify-thinking-blocks-dropped-on-tool-replay-2.mjs"
// Imports the real Worker (worker/src/index.js) on in-memory SQLite with the seeded demo household, and replaces the
// upstream with a stand-in this script controls (the rig's Anthropic mock cannot emit thinking blocks). Nothing leaves
// the process: any fetch that is not http://upstream.test/ throws. No real Anthropic API is called.
// Checks:
//   1. [thinking(sig), tool_use]            -> what the 2nd upstream call carries as the assistant turn
//   2. [thinking, text, tool_use] (a write) -> same, plus the write lands and the chip is sent before the 2nd call
//   3. [redacted_thinking, tool_use]        -> same
//   4. count of thinking/redacted_thinking blocks in ANY message of ANY upstream call (all-or-nothing vs partial drop)
//   5. SIMULATED: if the 2nd upstream call returned a 400, what the client sees (only to size the conditional impact;
//      the real API's behaviour is NOT exercised here)
process.env.TZ = 'America/New_York';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createD1 } from '../../lib/d1.mjs';
import { seedDemo, DEVICE, sessionToken } from '../../seed.mjs';
import { ROOT, registryApps, parseSSE, save } from './lib.mjs';

const up = { calls: [], script: [] };
const sse = evs => evs.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const start = { type: 'message_start', message: { id: 'm', role: 'assistant', content: [], usage: { input_tokens: 5, output_tokens: 1 } } };
const endTurn = t => sse([start,
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3 } }, { type: 'message_stop' }]);
const thinkingBlock = i => [
  { type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: i, delta: { type: 'thinking_delta', thinking: '' } },
  { type: 'content_block_delta', index: i, delta: { type: 'signature_delta', signature: 'SIG-SKEPTIC-2' } },
  { type: 'content_block_stop', index: i }];
const redactedBlock = i => [
  { type: 'content_block_start', index: i, content_block: { type: 'redacted_thinking', data: 'REDACTED-DATA-SKEPTIC-2' } },
  { type: 'content_block_stop', index: i }];
const textBlock = (i, t) => [
  { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: t } },
  { type: 'content_block_stop', index: i }];
const toolBlock = (i, id, name, input) => [
  { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id, name, input: {} } },
  { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
  { type: 'content_block_stop', index: i }];
const toolStop = [{ type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 9 } }, { type: 'message_stop' }];

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('http://upstream.test/')) throw new Error('refused ' + url);
  up.calls.push({ body: JSON.parse(init.body) });
  const turn = up.script.shift() || { body: endTurn('ok') };
  if (turn.status) return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: turn.message } }), { status: turn.status, headers: { 'Content-Type': 'application/json' } });
  return new Response(turn.body, { headers: { 'Content-Type': 'text/event-stream' } });
};

const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const ORIGIN = 'http://localhost:8765';
async function chat(DB, pid, message) {
  const pending = [];
  const req = new Request('http://api.local/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(pid) }, body: JSON.stringify({ message, apps: registryApps() }) });
  const res = await worker.fetch(req, { DB, ALLOWED_ORIGINS: ORIGIN, ANTHROPIC_API_KEY: 'sk-ant-SKEPTIC-FAKE', ANTHROPIC_BASE_URL: 'http://upstream.test' }, { waitUntil: p => pending.push(p), passThroughOnException() {} });
  const text = await res.text(); await Promise.all(pending);
  return { status: res.status, events: parseSSE(text) };
}
const blockTypes = call => call && call.messages.filter(m => m.role === 'assistant' && Array.isArray(m.content)).map(m => m.content.map(b => b.type));
const thinkingAnywhere = calls => calls.reduce((n, c) => n + c.body.messages.reduce((k, m) => k + (Array.isArray(m.content) ? m.content.filter(b => /thinking/.test(b.type)).length : 0), 0), 0);

const DB = createD1(':memory:');
await seedDemo(DB, { variant: 'typical', now: Date.now() });
const out = {};

// 1
up.calls = []; up.script = [{ body: sse([start, ...thinkingBlock(0), ...toolBlock(1, 'toolu_s2_1', 'list_apps', {}), ...toolStop]) }, { body: endTurn('Here are your apps.') }];
let r = await chat(DB, 'eli', 'what apps do I have?');
out.case1 = { sent: ['thinking', 'tool_use'], upstreamCalls: up.calls.length, replayedAssistant: blockTypes(up.calls[1] && up.calls[1].body), thinkingConfig: up.calls[0].body.thinking, effort: up.calls[0].body.output_config, model: up.calls[0].body.model, clientEvents: r.events.map(e => e.event) };

// 2 (a write: add_list_item leftovers)
const item = 'Skeptic2 soup ' + Date.now();
up.calls = []; up.script = [{ body: sse([start, ...thinkingBlock(0), ...textBlock(1, 'Adding it. '), ...toolBlock(2, 'toolu_s2_2', 'add_list_item', { app_id: 'leftovers', item: { name: item } }), ...toolStop]) }, { body: endTurn('Added.') }];
r = await chat(DB, 'eli', 'add soup to leftovers');
const landed = (await DB.prepare("SELECT COUNT(*) n FROM app_data WHERE app_id='leftovers' AND scope='family' AND value LIKE ?").bind('%' + item + '%').first()).n;
out.case2 = { sent: ['thinking', 'text', 'tool_use'], replayedAssistant: blockTypes(up.calls[1] && up.calls[1].body), writeLanded: landed === 1, chip: (r.events.find(e => e.event === 'tool') || {}).data?.chip, clientEvents: r.events.map(e => e.event) };

// 3
up.calls = []; up.script = [{ body: sse([start, ...redactedBlock(0), ...toolBlock(1, 'toolu_s2_3', 'list_apps', {}), ...toolStop]) }, { body: endTurn('ok') }];
r = await chat(DB, 'eli', 'what apps again?');
out.case3 = { sent: ['redacted_thinking', 'tool_use'], replayedAssistant: blockTypes(up.calls[1] && up.calls[1].body) };

// 4 — across all three runs above we only kept the last run's calls; re-run case 1 and count
up.calls = []; up.script = [{ body: sse([start, ...thinkingBlock(0), ...toolBlock(1, 'toolu_s2_4', 'list_apps', {}), ...toolStop]) }, { body: sse([start, ...thinkingBlock(0), ...toolBlock(1, 'toolu_s2_5', 'list_apps', {}), ...toolStop]) }, { body: endTurn('ok') }];
await chat(DB, 'eli', 'two tool rounds');
out.case4 = { upstreamCalls: up.calls.length, thinkingBlocksSentUpstreamInAnyMessage: thinkingAnywhere(up.calls), perCallAssistantTurns: up.calls.map(c => blockTypes(c.body)) };

// 5 — SIMULATED 400 on the continuation (hypothetical; the real API is not called)
const item5 = 'Skeptic2 chili ' + Date.now();
up.calls = []; up.script = [{ body: sse([start, ...thinkingBlock(0), ...toolBlock(1, 'toolu_s2_6', 'add_list_item', { app_id: 'leftovers', item: { name: item5 } }), ...toolStop]) }, { status: 400, message: 'SIMULATED continuation rejection' }];
r = await chat(DB, 'eli', 'add chili to leftovers');
const landed5 = (await DB.prepare("SELECT COUNT(*) n FROM app_data WHERE app_id='leftovers' AND scope='family' AND value LIKE ?").bind('%' + item5 + '%').first()).n;
out.case5_simulated = { writeLanded: landed5 === 1, events: r.events.map(e => e.event + (e.event === 'tool' ? ':' + e.data.chip : e.event === 'error' ? ':' + e.data.message : '')) };

for (const [k, v] of Object.entries(out)) console.log(k + ':', JSON.stringify(v));
console.log('evidence:', save('verify-thinking-blocks-dropped-on-tool-replay-2.json', out));
