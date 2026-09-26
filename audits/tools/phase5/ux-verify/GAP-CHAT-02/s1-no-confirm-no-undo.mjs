// GAP-CHAT-02 skeptic s1: does a chat write wait for any confirmation, and what can "undo" it afterwards?
// As Mae (adult) on the typical seed: finish_leftover on one fridge item, then the best "undo" the tools allow
// (add_list_item with what the finish result told the model), compared with the original row.
//   node "audits/tools/phase5/ux-verify/GAP-CHAT-02/s1-no-confirm-no-undo.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/GAP-CHAT-02/s1');
fs.mkdirSync(OUT, { recursive: true });
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
const parseSSE = t => String(t).split('\n\n').filter(c => c.trim()).map(c => { let event = 'message', data = null; for (const l of c.split('\n')) { if (l.startsWith('event:')) event = l.slice(6).trim(); else if (l.startsWith('data:')) { try { data = JSON.parse(l.slice(5)); } catch { data = l.slice(5); } } } return { event, data }; });
const out = {};
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const pid = 'christian';
  const items = async () => ((await L.apiAs(pid, '/api/data/leftovers?scope=family')).body.items || []).filter(r => r.key.startsWith('item:') && r.value);
  const before = await items();
  const target = before[0];
  out.itemsBefore = before.length; out.target = target;
  // 1. finish it through chat
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name: 'finish_leftover', input: { item_id: target.value.id } }] }, { text: 'Done, marked it finished.' }]);
  const r1 = await L.apiAs(pid, '/api/chat', { method: 'POST', body: { message: 'we finished the ' + target.value.name, apps } });
  const ev1 = parseSSE(r1.body);
  out.finish = { status: r1.status, eventKinds: [...new Set(ev1.map(e => e.event))], toolEvents: ev1.filter(e => e.event === 'tool').map(e => e.data) };
  const log1 = await L.anthropicLog();
  const second = log1[1] && log1[1].body; const last = second && second.messages[second.messages.length - 1];
  out.finish.toolResultSentToModel = last && Array.isArray(last.content) ? (last.content.find(b => b.type === 'tool_result') || {}).content : null;
  const mid = await items();
  out.afterFinish = { items: mid.length, targetStillThere: mid.some(r => r.key === target.key) };
  // 2. "oops, undo that": the only route is to re-add a new item
  await L.anthropic([{ tools: [{ name: 'add_list_item', input: { app_id: 'leftovers', item: { name: target.value.name } } }] }, { text: 'Put it back.' }]);
  const r2 = await L.apiAs(pid, '/api/chat', { method: 'POST', body: { message: 'oops, undo that', apps } });
  const ev2 = parseSSE(r2.body);
  out.undoAttempt = { toolEvents: ev2.filter(e => e.event === 'tool').map(e => e.data) };
  const after = await items();
  const readded = after.find(r => !before.some(b => b.key === r.key));
  out.afterReadd = { items: after.length, readded: readded && readded.value,
    sameKey: readded ? readded.key === target.key : null,
    diff: readded ? Object.fromEntries(['id', 'size', 'dateLogged', 'by', 'byName'].filter(k => readded.value[k] !== target.value[k]).map(k => [k, { was: target.value[k], now: readded.value[k] }])) : null };
  out.toolsOffered = (log1[0] && log1[0].body.tools || []).map(t => t.name);
  out.feed = (await L.apiAs(pid, '/api/activity?limit=4')).body;
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'no-confirm-no-undo.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
