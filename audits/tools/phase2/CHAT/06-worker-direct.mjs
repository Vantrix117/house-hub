// CHAT 06 — the real Worker (worker/src/index.js) imported directly, with a stand-in upstream this script controls
// completely (the rig's mock cannot emit thinking blocks or a stream that never ends, and the rig's D1 shim answers
// synchronously so it cannot show a race). Same seeded demo household (audits/tools/seed.mjs), in-memory SQLite.
//   node "audits/tools/phase2/CHAT/06-worker-direct.mjs"
// Checks:
//   A. what the Worker sends back after a turn that had a `thinking` block before its tool_use (adaptive thinking is on,
//      worker/src/chat.js:421) — is the thinking block replayed?
//   B. the upstream fetch: which headers, and is there any AbortSignal/timeout on it (chat.js:345-349)?
//   C. an upstream that sends message_start and then nothing: how long does the client's stream stay open?
//   D. the daily cap with D1-like latency (3 ms per query): 10 concurrent sends at 57/60.
//   E. the API key never reaches a client-visible body (history, SSE, errors).
process.env.TZ = 'America/New_York';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createD1 } from '../../lib/d1.mjs';
import { seedDemo, DEVICE, sessionToken } from '../../seed.mjs';
import { ROOT, registryApps, parseSSE, save } from './lib.mjs';

const KEY = 'sk-ant-AUDIT-FAKE-KEY-0123456789';
const up = { calls: [], script: [] };
const sse = evs => evs.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const start = { type: 'message_start', message: { id: 'm', role: 'assistant', content: [], usage: { input_tokens: 5, output_tokens: 1 } } };
const textTurn = t => sse([start, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }, { type: 'content_block_stop', index: 0 }, { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3 } }, { type: 'message_stop' }]);
const thinkingThenTool = sse([start,
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'AUDIT-SIGNATURE' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_audit_1', name: 'list_apps', input: {} } },
  { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{}' } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 9 } }, { type: 'message_stop' }]);

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('http://upstream.test/')) throw new Error('refused ' + url);
  up.calls.push({ url, headers: init.headers, hasSignal: !!init.signal, body: JSON.parse(init.body) });
  const turn = up.script.shift() || { body: textTurn('ok') };
  if (turn.hang) return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(sse([start]))); } }), { headers: { 'Content-Type': 'text/event-stream' } });
  return new Response(turn.body, { headers: { 'Content-Type': 'text/event-stream' } });
};

const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function makeEnv({ latencyMs = 0 } = {}) {
  const DB = createD1(':memory:');
  await seedDemo(DB, { variant: 'typical', now: Date.now() });
  if (!latencyMs) return { DB, raw: DB };
  const wrap = st => ({ bind: (...a) => wrap(st.bind(...a)), first: async c => { await sleep(latencyMs); return st.first(c); }, all: async () => { await sleep(latencyMs); return st.all(); }, run: async () => { await sleep(latencyMs); return st.run(); }, raw: async () => { await sleep(latencyMs); return st.raw(); } });
  return { DB: { ...DB, prepare: sql => wrap(DB.prepare(sql)) }, raw: DB };
}
const ORIGIN = 'http://localhost:8765';
async function call(env, pid, p, { method = 'GET', body, readMs } = {}) {
  const pending = [];
  const req = new Request('http://api.local' + p, { method, headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(pid) }, body: body ? JSON.stringify(body) : undefined });
  const res = await worker.fetch(req, { ...env, ALLOWED_ORIGINS: ORIGIN, ANTHROPIC_API_KEY: KEY, ANTHROPIC_BASE_URL: 'http://upstream.test' }, { waitUntil: p => pending.push(p), passThroughOnException() {} });
  if (readMs == null) return { status: res.status, text: await res.text() };
  // read for at most readMs, then give up (the client side of a hang)
  const reader = res.body.getReader(); const dec = new TextDecoder(); let text = ''; const t0 = Date.now();
  while (Date.now() - t0 < readMs) {
    const r = await Promise.race([reader.read(), sleep(readMs - (Date.now() - t0)).then(() => 'timeout')]);
    if (r === 'timeout' || r.done) { if (r !== 'timeout') return { status: res.status, text, closedAfterMs: Date.now() - t0 }; break; }
    text += dec.decode(r.value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return { status: res.status, text, stillOpenAfterMs: Date.now() - t0 };
}

const out = {};
// A + B + E
{
  const env = await makeEnv();
  up.calls = []; up.script = [{ body: thinkingThenTool }, { body: textTurn('Here are your apps.') }];
  const r = await call(env, 'eli', '/api/chat', { method: 'POST', body: { message: 'what apps do I have?', apps: registryApps() } });
  const second = up.calls[1] && up.calls[1].body;
  const asst = second && second.messages.filter(m => m.role === 'assistant').pop();
  out.A_thinkingReplay = {
    firstTurnBlocks: ['thinking', 'tool_use'],
    replayedAssistantBlocks: asst && asst.content.map(b => b.type),
    thinkingConfig: up.calls[0].body.thinking, effort: up.calls[0].body.output_config, model: up.calls[0].body.model, maxTokens: up.calls[0].body.max_tokens,
    clientEvents: parseSSE(r.text).map(e => e.event),
  };
  out.B_upstreamFetch = { headerNames: Object.keys(up.calls[0].headers), apiKeyInHeader: up.calls[0].headers['x-api-key'] === KEY, hasAbortSignal: up.calls[0].hasSignal };
  // E: a 401 from upstream (bad key) and the history — does the key ever reach the client?
  up.script = [{ body: null }];
  globalThis.__origFetch = globalThis.fetch;
  const f0 = globalThis.fetch;
  globalThis.fetch = async (i, init) => { if ((typeof i === 'string' ? i : i.url).startsWith('http://upstream.test/')) { up.calls.push({ headers: init.headers }); return new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'Content-Type': 'application/json' } }); } return f0(i, init); };
  const r401 = await call(env, 'eli', '/api/chat', { method: 'POST', body: { message: 'hello', apps: registryApps() } });
  globalThis.fetch = f0;
  const hist = await call(env, 'eli', '/api/chat/history');
  const me = await call(env, 'eli', '/api/me');
  const bodies = { chatOk: r.text, chat401: r401.text, history: hist.text, me: me.text };
  out.E_keyExposure = { checkedBodies: Object.keys(bodies), anyContainsKey: Object.values(bodies).some(t => t.includes(KEY) || t.includes('AUDIT-FAKE-KEY')), chat401ErrorEvent: parseSSE(r401.text).find(e => e.event === 'error').data };
  console.log('A thinking replay:', JSON.stringify(out.A_thinkingReplay));
  console.log('B upstream fetch:', JSON.stringify(out.B_upstreamFetch));
  console.log('E key exposure:', JSON.stringify(out.E_keyExposure));
}
// C: a hang
{
  const env = await makeEnv();
  up.calls = []; up.script = [{ hang: true }];
  const t0 = Date.now();
  const r = await call(env, 'eli', '/api/chat', { method: 'POST', body: { message: 'hang please', apps: registryApps() }, readMs: 20000 });
  const hist = JSON.parse((await call(env, 'eli', '/api/chat/history')).text);
  out.C_hang = { readForMs: Date.now() - t0, stillOpenAfterMs: r.stillOpenAfterMs, closedAfterMs: r.closedAfterMs, eventsReceived: parseSSE(r.text).map(e => e.event), usedAfter: hist.used, lastHistoryRow: hist.messages.slice(-1)[0].content };
  console.log('C hang:', JSON.stringify(out.C_hang));
}
// D: cap race with latency
{
  const env = await makeEnv({ latencyMs: 3 });
  const n0 = (await env.raw.prepare("SELECT COUNT(*) n FROM chat_log WHERE profile_id='christian' AND role='user'").first()).n;
  const hist0 = JSON.parse((await call(env, 'christian', '/api/chat/history')).text);
  const now = Date.now();
  for (let i = hist0.used; i < 57; i++) env.raw.sqlite.prepare("INSERT INTO chat_log (profile_id, role, content, created_at) VALUES ('christian','user',?,?)").run('fill ' + i, now - 1000 - i);
  const before = JSON.parse((await call(env, 'christian', '/api/chat/history')).text).used;
  up.script = [];
  const burst = await Promise.all(Array.from({ length: 10 }, (_, i) => call(env, 'christian', '/api/chat', { method: 'POST', body: { message: 'burst ' + i, apps: registryApps() } })));
  const after = JSON.parse((await call(env, 'christian', '/api/chat/history')).text).used;
  out.D_capRace = { latencyPerQueryMs: 3, usedBefore: before, fired: 10, status200: burst.filter(b => b.status === 200).length, status429: burst.filter(b => b.status === 429).length, usedAfter: after, cap: 60, seededUserRowsTotal: n0 };
  console.log('D cap race:', JSON.stringify(out.D_capRace));
}
console.log('evidence:', save('06-worker-direct.json', out));
process.exit(0);   // the hung upstream stream in C never ends by design
