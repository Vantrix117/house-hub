// Skeptic #1 for CHAT finding "cap-check-not-atomic": is the 60-per-day chat cap a read-then-insert race?
//   node "audits/tools/phase2/CHAT/verify-cap-check-not-atomic-1.mjs"
// Independent of 03-cap.mjs / 06-worker-direct.mjs (own helpers, own latency model, own counts).
//   R. The rig (fresh local(), real clock, synchronous node:sqlite D1 shim): Mae at 59/60, then 2 concurrent sends;
//      Mae at 57/60, then 10 concurrent sends.
//   W. The real Worker imported directly with a D1 wrapper that answers each statement after N ms (Cloudflare D1 is a
//      network round-trip per statement; the shim is not). Latencies 0/1/5/20 ms and 2-20 ms jitter. For each: the
//      2-at-59 and 10-at-57 cases; count HTTP 200s, 429s, user rows today and the upstream (Anthropic) calls made.
//   S. Sanity: sequential sends at 59 with 20 ms latency still stop at 60.
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT');
fs.mkdirSync(EVID, { recursive: true });
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
const P = 'christian';   // Mae, an adult
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = { R: {}, W: [], S: null };

// ── R: the rig ───────────────────────────────────────────────
{
  const { local } = await import('../../lib/local.mjs');
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const used = async () => (await L.apiAs(P, '/api/chat/history')).body.used;
    const send = m => L.apiAs(P, '/api/chat', { method: 'POST', body: { message: m, apps } });
    for (const [target, n] of [[59, 2], [57, 10]]) {
      await L.reset('typical');
      let u = await used();
      for (let i = u; i < target; i++) { const r = await send('fill ' + i); if (r.status !== 200) throw new Error('fill failed ' + r.status); }
      const before = await used();
      const rs = await Promise.all(Array.from({ length: n }, (_, i) => send('burst ' + i)));
      const after = await used();
      out.R[`${n}at${target}`] = { before, fired: n, s200: rs.filter(r => r.status === 200).length, s429: rs.filter(r => r.status === 429).length, after, cap: 60 };
      console.log(`R rig ${n} concurrent at ${before}/60:`, JSON.stringify(out.R[`${n}at${target}`]));
    }
  } finally { await L.close(); }
}

// ── W: the Worker with per-statement latency ─────────────────
const { createD1 } = await import('../../lib/d1.mjs');
const { seedDemo, DEVICE, sessionToken } = await import('../../seed.mjs');
let upstreamCalls = 0;
const realFetch = globalThis.fetch;
const sse = evs => evs.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const reply = () => sse([
  { type: 'message_start', message: { id: 'm', role: 'assistant', content: [], usage: { input_tokens: 5, output_tokens: 1 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 2 } },
  { type: 'message_stop' }]);
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('http://upstream.invalid/')) { upstreamCalls++; return new Response(reply(), { headers: { 'Content-Type': 'text/event-stream' } }); }
  throw new Error('outbound fetch refused: ' + url);
};
const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const ORIGIN = 'http://localhost:8765';

async function freshEnv(lat) {
  const raw = createD1(':memory:');
  await seedDemo(raw, { variant: 'typical', now: Date.now() });
  const delay = () => sleep(typeof lat === 'function' ? lat() : lat);
  const wrap = st => ({
    bind: (...a) => wrap(st.bind(...a)),
    first: async c => { await delay(); return st.first(c); },
    all: async () => { await delay(); return st.all(); },
    run: async () => { await delay(); return st.run(); },
    raw: async () => { await delay(); return st.raw(); },
    _any: () => st._any(),
  });
  const DB = { ...raw, prepare: sql => wrap(raw.prepare(sql)), batch: async s => { await delay(); return raw.batch(s.map(x => ({ _any: x._any }))); } };
  return { raw, env: { DB, ALLOWED_ORIGINS: ORIGIN, ANTHROPIC_API_KEY: 'sk-ant-VERIFY-FAKE', ANTHROPIC_BASE_URL: 'http://upstream.invalid' } };
}
async function call(env, p, body) {
  const waits = [];
  const res = await worker.fetch(new Request('http://api.local' + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(P) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil: x => waits.push(x), passThroughOnException() {} });
  const text = await res.text();
  await Promise.allSettled(waits);
  return { status: res.status, text };
}
const usedNow = async env => JSON.parse((await call(env, '/api/chat/history')).text).used;
function fillTo(raw, target, have) {
  const now = Date.now();
  for (let i = have; i < target; i++) raw.sqlite.prepare("INSERT INTO chat_log (profile_id, role, content, created_at) VALUES (?, 'user', ?, ?)").run(P, 'fill ' + i, now - 2000 - i);
}
const latencies = [['0ms', 0], ['1ms', 1], ['5ms', 5], ['20ms', 20], ['jitter2-20ms', () => 2 + Math.random() * 18]];
for (const [label, lat] of latencies) {
  for (const [target, n] of [[59, 2], [57, 10]]) {
    const { raw, env } = await freshEnv(lat);
    fillTo(raw, target, await usedNow(env));
    const before = await usedNow(env);
    upstreamCalls = 0;
    const rs = await Promise.all(Array.from({ length: n }, (_, i) => call(env, '/api/chat', { message: 'burst ' + i, apps })));
    const after = await usedNow(env);
    const row = { latency: label, before, fired: n, s200: rs.filter(r => r.status === 200).length, s429: rs.filter(r => r.status === 429).length, after, cap: 60, upstreamCalls, overCapBy: Math.max(0, after - 60) };
    out.W.push(row);
    console.log('W worker', JSON.stringify(row));
  }
}
// ── S: sequential sanity with latency ────────────────────────
{
  const { raw, env } = await freshEnv(20);
  fillTo(raw, 59, await usedNow(env));
  upstreamCalls = 0;
  const seq = [];
  for (let i = 0; i < 3; i++) seq.push((await call(env, '/api/chat', { message: 'seq ' + i, apps })).status);
  out.S = { latency: '20ms', startAt: 59, statuses: seq, after: await usedNow(env), upstreamCalls };
  console.log('S sequential:', JSON.stringify(out.S));
}
// ── X: is the overshoot bounded server-side? A scripted client (valid session) at 59/60 with 20 ms per statement:
//    100 fired at once, and 10 staggered 5 ms apart (not simultaneous — arrivals spread over 45 ms).
{
  const { raw, env } = await freshEnv(20);
  fillTo(raw, 59, await usedNow(env));
  upstreamCalls = 0;
  const rs = await Promise.all(Array.from({ length: 100 }, (_, i) => call(env, '/api/chat', { message: 'big ' + i, apps })));
  out.X_burst100 = { latency: '20ms', before: 59, fired: 100, s200: rs.filter(r => r.status === 200).length, s429: rs.filter(r => r.status === 429).length, after: await usedNow(env), upstreamCalls };
  console.log('X burst of 100 at 59:', JSON.stringify(out.X_burst100));
}
{
  const { raw, env } = await freshEnv(20);
  fillTo(raw, 59, await usedNow(env));
  upstreamCalls = 0;
  const rs = await Promise.all(Array.from({ length: 10 }, async (_, i) => { await sleep(i * 5); return call(env, '/api/chat', { message: 'stagger ' + i, apps }); }));
  out.X_stagger = { latency: '20ms', before: 59, fired: 10, spacingMs: 5, s200: rs.filter(r => r.status === 200).length, s429: rs.filter(r => r.status === 429).length, after: await usedNow(env), upstreamCalls };
  console.log('X staggered 10 (5 ms apart) at 59:', JSON.stringify(out.X_stagger));
}
globalThis.fetch = realFetch;
const f = path.join(EVID, 'verify-cap-check-not-atomic-1.json');
fs.writeFileSync(f, JSON.stringify(out, null, 2));
console.log('evidence:', path.relative(ROOT, f).replace(/\\/g, '/'));
process.exit(0);
