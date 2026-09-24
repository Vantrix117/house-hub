// Skeptic #1 for CHAT finding "failed-upstream-spends-cap": does a chat message whose upstream call fails
// (HTTP 500, HTTP 429, mid-stream error) still count toward the 60-a-day cap?
// Independent of 03-cap.mjs: raw fetches through L.apiAs, own SSE parse, and a strong form of the claim —
// 60 failures in a row, zero answers, then the 61st send is refused with daily_cap.
//   node "audits/tools/phase2/CHAT/verify-failed-upstream-spends-cap-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT', 'verify-failed-upstream-spends-cap-1.json');
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));

const sse = t => String(t).split('\n\n').filter(c => c.trim()).map(c => {
  let event = 'message', data = null;
  for (const l of c.split('\n')) { if (l.startsWith('event:')) event = l.slice(6).trim(); else if (l.startsWith('data:')) { try { data = JSON.parse(l.slice(5)); } catch { data = l.slice(5); } } }
  return { event, data };
});

const L = await local({ variant: 'typical', clock: 'real' });
const out = {};
try {
  const P = 'christian'; // Mae, an adult
  const used = async () => (await L.apiAs(P, '/api/chat/history')).body.used;
  const send = async msg => {
    const r = await L.apiAs(P, '/api/chat', { method: 'POST', body: { message: msg, apps } });
    if (typeof r.body !== 'string') return { http: r.status, json: r.body };
    const ev = sse(r.body);
    return { http: r.status, error: (ev.find(e => e.event === 'error') || {}).data || null, done: (ev.find(e => e.event === 'done') || {}).data || null, text: ev.filter(e => e.event === 'text').map(e => e.data.text).join('') };
  };

  // A. control: a successful message costs exactly one
  const a0 = await used();
  await L.anthropic([{ text: 'Hello Mae.' }]);
  const ok = await send('control message');
  const a1 = await used();
  out.control = { before: a0, after: a1, reply: ok.text, done: ok.done };
  console.log('A control (success):', JSON.stringify(out.control));

  // B. one of each failure kind, used before/after each
  await L.reset('typical');
  const kinds = [
    ['http500', { status: 500, message: 'mock internal error' }],
    ['http429', { status: 429, message: 'rate limited upstream' }],
    ['streamError', { streamError: 'Overloaded' }],
  ];
  out.perKind = [];
  for (const [k, turn] of kinds) {
    const b = await used();
    await L.anthropic([turn]);
    const r = await send('try ' + k);
    const a = await used();
    out.perKind.push({ kind: k, usedBefore: b, usedAfter: a, http: r.http, errorEvent: r.error, doneEvent: r.done });
  }
  console.log('B per failure kind:', JSON.stringify(out.perKind));

  // C. strong form: from a fresh reset, every upstream call fails; how many sends until daily_cap, with zero answers?
  await L.reset('typical');
  await L.anthropicLog({ clear: true });
  const c0 = await used();
  await L.anthropic(Array.from({ length: 80 }, (_, i) => [{ status: 500, message: 'outage' }, { status: 429, message: 'busy' }, { streamError: 'Overloaded' }][i % 3]));
  let failedSends = 0, answered = 0, capHit = null;
  for (let i = 0; i < 80; i++) {
    const r = await send('outage retry ' + i);
    if (r.http === 429) { capHit = { afterFailedSends: failedSends, body: r.json }; break; }
    if (r.error) failedSends++; else answered++;
  }
  const upstreamCalls = (await L.anthropicLog()).length;
  const hist = (await L.apiAs(P, '/api/chat/history')).body;
  out.outage = { usedAtStart: c0, failedSends, answered, upstreamCallsMade: upstreamCalls, capHit, usedNow: hist.used,
    historyTail: hist.messages.slice(-3).map(m => `${m.role}: ${m.content.slice(0, 40)}`) };
  console.log('C outage until cap:', JSON.stringify(out.outage));
} finally { await L.close(); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('evidence:', path.relative(ROOT, OUT).replace(/\\/g, '/'));
