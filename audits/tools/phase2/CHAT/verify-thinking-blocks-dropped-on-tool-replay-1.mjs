// Skeptic #1 for CHAT finding "thinking-blocks-dropped-on-tool-replay".
//   node "audits/tools/phase2/CHAT/verify-thinking-blocks-dropped-on-tool-replay-1.mjs"
// The real Worker (worker/src/index.js) imported directly on the rig's in-memory SQLite + demo household, with a stand-in
// upstream (the rig's anthropic-mock cannot emit thinking blocks). Nothing leaves this process: fetch() is replaced and
// refuses every URL except http://upstream.test/.
// Scenarios (Sonnet 5 stream shapes, display "omitted" = empty thinking text + signature_delta):
//   S1 [thinking, text, tool_use(add_list_item leftovers)] -> [text]          : what is replayed; did the write land first?
//   S2 [thinking, tool_use(list_apps)] -> [thinking, tool_use(list_apps)] -> [text] : interleaved thinking, 3 calls
//   S3 [redacted_thinking, tool_use(list_apps)] -> [text]
//   S4 upstream 400 on the 2nd call (what the user would see IF the API rejected the replay)
// For each replay it reports: blocks of the last assistant message, whether ANY thinking/redacted_thinking block remains
// anywhere in the body, the thinking config/model, and whether the one structural rule the docs tie to missing thinking
// ("final assistant turn must begin with a thinking block") would apply — the docs say only manual mode enforces it.
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createD1 } from '../../lib/d1.mjs';
import { seedDemo, DEVICE, sessionToken } from '../../seed.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT');
fs.mkdirSync(EVID, { recursive: true });
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));

const sse = evs => evs.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const start = { type: 'message_start', message: { id: 'msg_v', role: 'assistant', content: [], usage: { input_tokens: 5, output_tokens: 1 } } };
const B = {
  thinking: (i, sig) => [{ type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '', signature: '' } },
    { type: 'content_block_delta', index: i, delta: { type: 'thinking_delta', thinking: '' } },
    { type: 'content_block_delta', index: i, delta: { type: 'signature_delta', signature: sig } },
    { type: 'content_block_stop', index: i }],
  redacted: (i, data) => [{ type: 'content_block_start', index: i, content_block: { type: 'redacted_thinking', data } }, { type: 'content_block_stop', index: i }],
  text: (i, t) => [{ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: t } }, { type: 'content_block_stop', index: i }],
  tool: (i, id, name, input) => [{ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id, name, input: {} } },
    { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } }, { type: 'content_block_stop', index: i }],
};
const turn = (blocks, stop) => sse([start, ...blocks.flat(), { type: 'message_delta', delta: { stop_reason: stop }, usage: { output_tokens: 9 } }, { type: 'message_stop' }]);

const up = { calls: [], script: [] };
let dbRef = null;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('http://upstream.test/')) throw new Error('refused ' + url);
  // snapshot the fridge at the moment each upstream call is made
  const fridge = dbRef ? dbRef.sqlite.prepare("SELECT key, value FROM app_data WHERE app_id='leftovers' AND scope='family' AND value LIKE '%Audit soup%'").all().length : null;
  up.calls.push({ body: JSON.parse(init.body), auditSoupRowsAtCallTime: fridge });
  const t = up.script.shift() || { body: turn([B.text(0, 'ok')], 'end_turn') };
  if (t.status) return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: t.message } }), { status: t.status, headers: { 'Content-Type': 'application/json' } });
  return new Response(t.body, { headers: { 'Content-Type': 'text/event-stream' } });
};

const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const ORIGIN = 'http://localhost:8765';
async function send(env, pid, message) {
  const pending = [];
  const req = new Request('http://api.local/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(pid) }, body: JSON.stringify({ message, apps }) });
  const res = await worker.fetch(req, { ...env, ALLOWED_ORIGINS: ORIGIN, ANTHROPIC_API_KEY: 'sk-ant-VERIFY-FAKE', ANTHROPIC_BASE_URL: 'http://upstream.test' }, { waitUntil: p => pending.push(p), passThroughOnException() {} });
  const text = await res.text(); await Promise.all(pending);
  const events = [];
  for (const c of text.split('\n\n')) { if (!c.trim()) continue; let ev = 'message', data = null; for (const l of c.split('\n')) { if (l.startsWith('event:')) ev = l.slice(6).trim(); else if (l.startsWith('data:')) { try { data = JSON.parse(l.slice(5)); } catch { data = l.slice(5); } } } events.push({ event: ev, data }); }
  return { status: res.status, events };
}
const THINK = new Set(['thinking', 'redacted_thinking']);
function describe(call) {
  const b = call.body; const msgs = b.messages;
  const lastAsst = [...msgs].reverse().find(m => m.role === 'assistant');
  const lastAsstBlocks = lastAsst && Array.isArray(lastAsst.content) ? lastAsst.content.map(x => x.type) : null;
  const thinkingBlocksAnywhere = msgs.reduce((n, m) => n + (Array.isArray(m.content) ? m.content.filter(x => THINK.has(x.type)).length : 0), 0);
  return {
    model: b.model, thinking: b.thinking, effort: b.output_config && b.output_config.effort,
    roles: msgs.map(m => m.role).join(','),
    lastAssistantBlocks: lastAsstBlocks,
    thinkingBlocksAnywhereInBody: thinkingBlocksAnywhere,
    manualModeRuleWouldFire: !!(lastAsstBlocks && !THINK.has(lastAsstBlocks[0]) && b.thinking && b.thinking.type === 'enabled'),
    lastAssistantStartsWithThinking: !!(lastAsstBlocks && THINK.has(lastAsstBlocks[0])),
    auditSoupRowsAtCallTime: call.auditSoupRowsAtCallTime,
  };
}
async function freshEnv() { const DB = createD1(':memory:'); await seedDemo(DB, { variant: 'typical', now: Date.now() }); dbRef = DB; return { DB }; }

const out = {};
{ // S1
  const env = await freshEnv(); up.calls = [];
  up.script = [{ body: turn([B.thinking(0, 'SIG-S1'), B.text(1, 'Adding it now.'), B.tool(2, 'toolu_v1', 'add_list_item', { app_id: 'leftovers', item: { name: 'Audit soup', size: 'Medium' } })], 'tool_use') },
               { body: turn([B.text(0, 'Added Audit soup to the fridge.')], 'end_turn') }];
  const r = await send(env, 'eli', 'add audit soup to leftovers');
  out.S1 = { upstreamCalls: up.calls.length, call2: describe(up.calls[1]), clientEvents: r.events.map(e => e.event), chip: (r.events.find(e => e.event === 'tool') || {}).data?.chip };
  console.log('S1 write + replay:', JSON.stringify(out.S1));
}
{ // S2 interleaved
  const env = await freshEnv(); up.calls = [];
  up.script = [{ body: turn([B.thinking(0, 'SIG-S2a'), B.tool(1, 'toolu_v2a', 'list_apps', {})], 'tool_use') },
               { body: turn([B.thinking(0, 'SIG-S2b'), B.tool(1, 'toolu_v2b', 'list_apps', {})], 'tool_use') },
               { body: turn([B.text(0, 'Done.')], 'end_turn') }];
  const r = await send(env, 'eli', 'list my apps twice');
  out.S2 = { upstreamCalls: up.calls.length, call2: describe(up.calls[1]), call3: describe(up.calls[2]), clientEvents: r.events.map(e => e.event) };
  console.log('S2 interleaved:', JSON.stringify(out.S2));
}
{ // S3 redacted
  const env = await freshEnv(); up.calls = [];
  up.script = [{ body: turn([B.redacted(0, 'REDACTED-DATA'), B.tool(1, 'toolu_v3', 'list_apps', {})], 'tool_use') }, { body: turn([B.text(0, 'Done.')], 'end_turn') }];
  const r = await send(env, 'eli', 'what apps');
  out.S3 = { upstreamCalls: up.calls.length, call2: describe(up.calls[1]), clientEvents: r.events.map(e => e.event) };
  console.log('S3 redacted:', JSON.stringify(out.S3));
}
{ // S4 hypothetical rejection on the 2nd call: what the household sees
  const env = await freshEnv(); up.calls = [];
  up.script = [{ body: turn([B.thinking(0, 'SIG-S4'), B.tool(1, 'toolu_v4', 'add_list_item', { app_id: 'leftovers', item: { name: 'Audit soup', size: 'Small' } })], 'tool_use') },
               { status: 400, message: 'hypothetical rejection of the replayed turn' }];
  const r = await send(env, 'eli', 'add audit soup');
  const rows = env.DB.sqlite.prepare("SELECT COUNT(*) n FROM app_data WHERE app_id='leftovers' AND value LIKE '%Audit soup%'").get().n;
  out.S4 = { clientEvents: r.events.map(e => e.event), chip: (r.events.find(e => e.event === 'tool') || {}).data?.chip, error: (r.events.find(e => e.event === 'error') || {}).data, auditSoupRowsAfter: rows };
  console.log('S4 if 2nd call were rejected:', JSON.stringify(out.S4));
}
const file = path.join(EVID, 'verify-thinking-blocks-dropped-on-tool-replay-1.json');
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log('evidence:', path.relative(ROOT, file));
process.exit(0);
