// Skeptic #2 for CHAT finding "failed-upstream-spends-cap" (lens: intent and context — by design? mitigated? rig artefact?).
// Independent of 03-cap.mjs and verify-...-1.mjs: raw L.apiAs calls, own SSE parse, fresh local instance.
//   node "audits/tools/phase2/CHAT/verify-failed-upstream-spends-cap-2.mjs"
// What it checks:
//   A. local rejections (empty message → 400) do NOT spend — the handler deliberately rejects before the INSERT (chat.js:394-400 vs 411)
//   B. each upstream failure where the model produced nothing spends one: HTTP 500, 529 (Anthropic "overloaded"), 429, stream error
//   C. context: do the failed user rows leak into the next successful request? (msgs.pop at chat.js:407) and what history shows
//   D. a failure AFTER a tool already ran (tool write done, 2nd upstream call 500) — here counting is arguably right
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT', 'verify-failed-upstream-spends-cap-2.json');
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
const sse = t => String(t).split('\n\n').filter(c => c.trim()).map(c => {
  let event = 'message', data = null;
  for (const l of c.split('\n')) { if (l.startsWith('event:')) event = l.slice(6).trim(); else if (l.startsWith('data:')) { try { data = JSON.parse(l.slice(5)); } catch { data = l.slice(5); } } }
  return { event, data };
});

const L = await local({ variant: 'typical', clock: 'real' });
const out = {};
try {
  const P = 'niece'; // Mea (id niece), an adult — a different profile from the investigator's and skeptic #1's
  const used = async () => (await L.apiAs(P, '/api/chat/history')).body.used;
  const send = async msg => {
    const r = await L.apiAs(P, '/api/chat', { method: 'POST', body: { message: msg, apps } });
    if (typeof r.body !== 'string') return { http: r.status, json: r.body };
    const ev = sse(r.body);
    return { http: r.status, error: (ev.find(e => e.event === 'error') || {}).data || null, done: (ev.find(e => e.event === 'done') || {}).data || null,
      text: ev.filter(e => e.event === 'text').map(e => e.data.text).join(''), tools: ev.filter(e => e.event === 'tool').map(e => e.data) };
  };

  // A. local rejection before the INSERT
  const a0 = await used();
  const bad = await send('   ');
  out.localReject = { usedBefore: a0, http: bad.http, body: bad.json, usedAfter: await used() };
  console.log('A local reject (empty message):', JSON.stringify(out.localReject));

  // B. upstream failures with no model output
  out.upstream = [];
  for (const [kind, turn] of [['http500', { status: 500, message: 'mock 500' }], ['http529', { status: 529, message: 'Overloaded' }],
                              ['http429', { status: 429, message: 'rate limited' }], ['streamError', { streamError: 'Overloaded' }]]) {
    const b = await used();
    await L.anthropic([turn]);
    const r = await send('outage try ' + kind);
    out.upstream.push({ kind, usedBefore: b, usedAfter: await used(), http: r.http, error: r.error, done: r.done });
  }
  console.log('B upstream failures:', JSON.stringify(out.upstream.map(x => `${x.kind}: ${x.usedBefore}->${x.usedAfter} err=${x.error && x.error.message}`)));

  // C. next success: what went upstream, and what the history shows
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ text: 'Back now.' }]);
  const b = await used();
  const ok = await send('are you back?');
  const log = await L.anthropicLog();
  const sentMsgs = log[0].body.messages.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 50) : '[blocks]'}`);
  const hist = (await L.apiAs(P, '/api/chat/history')).body;
  out.afterRecovery = { usedBefore: b, usedAfter: await used(), reply: ok.text, doneUsed: ok.done && ok.done.used,
    failedTextsSentUpstream: sentMsgs.filter(s => s.includes('outage try')).length, lastUpstreamMsgs: sentMsgs.slice(-3),
    historyTail: hist.messages.slice(-6).map(m => `${m.role}: ${m.content.slice(0, 40)}`) };
  console.log('C after recovery:', JSON.stringify(out.afterRecovery, null, 1));

  // D. failure after a tool already ran: the write happened, then the 2nd upstream call fails
  const b2 = await used();
  await L.anthropic([{ tools: [{ name: 'f260_status', input: {} }] }, { status: 500, message: 'mock 500 after tool' }]);
  const d = await send('how is my reading going');
  out.failAfterTool = { usedBefore: b2, usedAfter: await used(), toolsRan: d.tools.map(t => t.name), error: d.error };
  console.log('D fail after a tool ran:', JSON.stringify(out.failAfterTool));
} finally { await L.close(); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('evidence:', path.relative(ROOT, OUT).replace(/\\/g, '/'));
