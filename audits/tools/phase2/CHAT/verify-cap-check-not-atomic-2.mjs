// Skeptic #2 for finding "cap-check-not-atomic" (CHAT). Independent of 06-worker-direct.mjs.
// Imports the real Worker (worker/src/index.js) with a stand-in upstream that counts every Anthropic call (= spend),
// on in-memory SQLite (audits/tools/lib/d1.mjs) seeded with the demo household. Optional per-query latency wraps
// every D1 call (D1 is a network round trip in production; the rig's shim answers without any delay).
//   node "audits/tools/phase2/CHAT/verify-cap-check-not-atomic-2.mjs"
// Cases:
//   S  sequential control at 3 ms latency: from 57/60, 6 sends one after another -> the cap should hold exactly
//   R0 10 concurrent at 57/60, latency 0 (the shim as-is)
//   R3 10 concurrent at 57/60, latency 3 ms
//   RJ 10 concurrent at 57/60, latency jittered 5-40 ms (a plausible D1 round trip from a Worker)
//   R2 2 concurrent at 59/60, 3 ms (the realistic household case: phone + iPad send at the same moment)
//   RB 100 concurrent at 59/60, 3 ms (a scripted burst: is the overshoot bounded by anything but burst size?)
//   AGAIN after RB, one more concurrent burst of 10 -> all 429 (the overshoot is one burst, not repeatable)
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

const sleep = ms => new Promise(r => setTimeout(r, ms));
let upstreamCalls = 0;
const sse = evs => evs.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const reply = () => sse([
  { type: 'message_start', message: { id: 'm', role: 'assistant', content: [], usage: { input_tokens: 5, output_tokens: 1 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }, { type: 'message_stop' }]);
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('http://upstream.test/')) throw new Error('refused ' + url);   // nothing leaves this process
  upstreamCalls++;
  return new Response(reply(), { headers: { 'Content-Type': 'text/event-stream' } });
};
const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;

async function makeEnv(latency) {
  const raw = createD1(':memory:');
  await seedDemo(raw, { variant: 'typical', now: Date.now() });
  if (!latency) return { DB: raw, raw };
  const lag = () => sleep(typeof latency === 'function' ? latency() : latency);
  const wrap = st => ({ bind: (...a) => wrap(st.bind(...a)), first: async c => { await lag(); return st.first(c); }, all: async () => { await lag(); return st.all(); }, run: async () => { await lag(); return st.run(); }, raw: async () => { await lag(); return st.raw(); }, _any: () => st._any() });
  return { DB: { ...raw, prepare: sql => wrap(raw.prepare(sql)), batch: async s => { await lag(); return raw.batch(s); } }, raw };
}
const ORIGIN = 'http://localhost:8765';
async function send(env, pid, p, { method = 'GET', body } = {}) {
  const req = new Request('http://api.local' + p, { method, headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(pid) }, body: body ? JSON.stringify(body) : undefined });
  const res = await worker.fetch(req, { ...env, ALLOWED_ORIGINS: ORIGIN, ANTHROPIC_API_KEY: 'sk-ant-fake-audit', ANTHROPIC_BASE_URL: 'http://upstream.test' }, { waitUntil() {}, passThroughOnException() {} });
  return { status: res.status, text: await res.text() };
}
const P = 'christian';
async function used(env) { return JSON.parse((await send(env, P, '/api/chat/history')).text).used; }
async function fillTo(env, n) {
  const u = await used(env); const now = Date.now();
  for (let i = u; i < n; i++) env.raw.sqlite.prepare("INSERT INTO chat_log (profile_id, role, content, created_at) VALUES (?, 'user', ?, ?)").run(P, 'fill ' + i, now - 1000 - i);
  return used(env);
}
async function burst(env, n) {
  const c0 = upstreamCalls;
  const rs = await Promise.all(Array.from({ length: n }, (_, i) => send(env, P, '/api/chat', { method: 'POST', body: { message: 'burst ' + i, apps } })));
  return { fired: n, s200: rs.filter(r => r.status === 200).length, s429: rs.filter(r => r.status === 429).length, other: rs.filter(r => r.status !== 200 && r.status !== 429).map(r => r.status), upstreamCalls: upstreamCalls - c0 };
}

const out = {};
{ // S: sequential control
  const env = await makeEnv(3); const before = await fillTo(env, 57); const st = []; const c0 = upstreamCalls;
  for (let i = 0; i < 6; i++) st.push((await send(env, P, '/api/chat', { method: 'POST', body: { message: 'seq ' + i, apps } })).status);
  out.S_sequential_3ms = { usedBefore: before, statuses: st, upstreamCalls: upstreamCalls - c0, usedAfter: await used(env) };
  console.log('S  sequential 3ms :', JSON.stringify(out.S_sequential_3ms));
}
for (const [k, lat, at, n] of [['R0_concurrent_0ms', 0, 57, 10], ['R3_concurrent_3ms', 3, 57, 10], ['RJ_concurrent_5to40ms', () => 5 + Math.random() * 35, 57, 10], ['R2_two_devices_3ms', 3, 59, 2], ['RB_burst100_3ms', 3, 59, 100]]) {
  const env = await makeEnv(lat); const before = await fillTo(env, at);
  const b = await burst(env, n);
  out[k] = { usedBefore: before, ...b, usedAfter: await used(env), cap: 60 };
  console.log(k.padEnd(22), JSON.stringify(out[k]));
  if (k === 'RB_burst100_3ms') {
    const again = await burst(env, 10);
    out.AGAIN_after_RB = { usedBefore: out[k].usedAfter, ...again, usedAfter: await used(env) };
    console.log('AGAIN after RB        ', JSON.stringify(out.AGAIN_after_RB));
  }
}
const file = path.join(EVID, 'verify-cap-check-not-atomic-2.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log('evidence:', path.relative(ROOT, file));
process.exit(0);
