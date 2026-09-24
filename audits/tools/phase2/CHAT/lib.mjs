// Shared helpers for the CHAT dimension experiments (audit Phase 2). Nothing here talks to production:
// every call goes to the rig's local instance started by ../../lib/local.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..', '..', '..');
export const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT');
fs.mkdirSync(EVID, { recursive: true });

/** The apps array exactly as the shell sends it (index.html:1494: registry.apps → {id,name,scope,visibleTo}). */
export function registryApps() {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8'));
  return reg.apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
}

/** Parse a text/event-stream body into [{event, data}]. */
export function parseSSE(text) {
  const out = [];
  for (const chunk of String(text).split('\n\n')) {
    if (!chunk.trim()) continue;
    let event = 'message', data = null;
    for (const line of chunk.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) { try { data = JSON.parse(line.slice(5)); } catch { data = line.slice(5); } }
    }
    out.push({ event, data });
  }
  return out;
}

/** POST /api/chat as a profile through the rig; returns { status, events, text, chips, tools, error, done, raw }. */
export async function chat(L, pid, message, { apps = registryApps(), deviceToken, profileToken } = {}) {
  const r = await L.apiAs(pid, '/api/chat', { method: 'POST', body: { message, apps }, deviceToken, profileToken });
  if (typeof r.body !== 'string') return { status: r.status, events: [], json: r.body, raw: JSON.stringify(r.body) };
  const events = parseSSE(r.body);
  const text = events.filter(e => e.event === 'text').map(e => e.data.text).join('');
  const tools = events.filter(e => e.event === 'tool').map(e => e.data);
  return { status: r.status, events, text, tools, chips: tools.filter(t => t.chip).map(t => t.chip), error: (events.find(e => e.event === 'error') || {}).data || null, done: (events.find(e => e.event === 'done') || {}).data || null, raw: r.body };
}

/** One scripted tool call: the upstream asks for `name(input)`, then answers `after`. Returns chat() plus the tool_result sent back. */
export async function toolCall(L, pid, name, input, { message = 'please ' + name, after = 'Done.', apps } = {}) {
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name, input }] }, { text: after }]);
  const res = await chat(L, pid, message, { apps });
  const log = await L.anthropicLog();
  const second = log[1] && log[1].body;
  let toolResult = null;
  if (second) {
    const last = second.messages[second.messages.length - 1];
    const tr = Array.isArray(last.content) ? last.content.find(b => b.type === 'tool_result') : null;
    toolResult = tr ? { is_error: tr.is_error, content: tr.content } : null;
  }
  const ev = res.tools[0] || null;
  return { status: res.status, ok: ev && ev.ok, chip: ev && ev.chip, toolResult, text: res.text, error: res.error, upstreamCalls: log.length };
}

export const data = async (L, pid, app, scope, key) => {
  const r = await L.apiAs(pid, `/api/data/${app}?scope=${scope}${key ? '&key=' + encodeURIComponent(key) : ''}`);
  return key ? (r.body.item ? r.body.item.value : undefined) : r.body.items;
};
export const put = (L, pid, app, scope, key, value) => L.apiAs(pid, `/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', body: { value, updated_at: Date.now() } });
export const history = async (L, pid) => (await L.apiAs(pid, '/api/chat/history')).body;
export const feed = async (L, pid = 'eli', n = 5) => { const r = await L.apiAs(pid, '/api/activity?limit=' + n); return r.body; };

export function save(name, obj) {
  const f = path.join(EVID, name);
  fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  return path.relative(ROOT, f).replace(/\\/g, '/');
}
export const short = (v, n = 160) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > n ? s.slice(0, n) + '…' : s; };
