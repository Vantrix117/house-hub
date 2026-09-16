// POST /api/chat — the house chatbot. Streams Claude's reply as Server-Sent Events and runs tools
// against D1 in between turns. Every tool action is echoed to the client as a chip and to the activity feed.
//
// SSE events sent to the client:
//   text  {text}                      a chunk of the reply
//   tool  {name, input, chip, ok}     a tool ran (chip is the human-readable summary)
//   done  {usage, stop_reason}        finished
//   error {error, message}
import { HttpError } from './auth.js';
import { listData, getOne, putOne, liveItems } from './data.js';
import { nyParts } from './reminders.js';

export const MODEL = 'claude-sonnet-5';
export const MAX_TOKENS = 800;
export const DAILY_CAP = 60;
export const HISTORY = 20;
const MAX_TURNS = 6;                      // tool round-trips per message
const BIG_VALUE = 4000;                   // chars; larger values are summarised, never sent to the model

const enc = new TextEncoder();
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ── tools ─────────────────────────────────────────────────────
const TOOLS = [
  { name: 'list_apps', description: 'List the apps in the hub this person can use, with their data scope.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_data', description: "Read an app's stored data. scope 'person' is the signed-in person's own data; 'family' is shared by the whole house. Omit key to list everything.",
    input_schema: { type: 'object', properties: { app_id: { type: 'string' }, scope: { type: 'string', enum: ['person', 'family'] }, key: { type: 'string' } }, required: ['app_id', 'scope'], additionalProperties: false } },
  { name: 'set_data', description: 'Write one value into an app. Use add_list_item for list apps (leftovers, reminders) and add_prayer for prayers instead of this.',
    input_schema: { type: 'object', properties: { app_id: { type: 'string' }, scope: { type: 'string', enum: ['person', 'family'] }, key: { type: 'string' }, value: {} }, required: ['app_id', 'scope', 'key', 'value'], additionalProperties: false } },
  { name: 'add_list_item', description: "Add an item to a family list. app_id 'leftovers' (item: {name, size?, dateLogged?}) or 'reminders' (item: {text}).",
    input_schema: { type: 'object', properties: { app_id: { type: 'string', enum: ['leftovers', 'reminders'] }, item: { type: 'object', properties: { name: { type: 'string' }, size: { type: 'string', enum: ['Small', 'Medium', 'Large', 'Family-size'] }, dateLogged: { type: 'string', description: 'YYYY-MM-DD, defaults to today' }, text: { type: 'string' } }, additionalProperties: false } }, required: ['app_id', 'item'], additionalProperties: false } },
  { name: 'toggle_f260_reading', description: "Mark (or unmark) one F260 reading as done for the signed-in person. week 1-52, day 1-5.",
    input_schema: { type: 'object', properties: { week: { type: 'integer', minimum: 1, maximum: 52 }, day: { type: 'integer', minimum: 1, maximum: 5 } }, required: ['week', 'day'], additionalProperties: false } },
  { name: 'add_prayer', description: "Add a prayer request. list 'private' is the person's own list, 'family' is the shared house list.",
    input_schema: { type: 'object', properties: { list: { type: 'string', enum: ['private', 'family'] }, text: { type: 'string' }, for: { type: 'string', description: 'who it is for, optional' } }, required: ['list', 'text'], additionalProperties: false } },
];

const today = () => nyParts().date;
async function usedToday(env, profileId) {
  const { results } = await env.DB.prepare("SELECT created_at FROM chat_log WHERE profile_id = ? AND role = 'user' AND created_at > ?").bind(profileId, Date.now() - 36 * 3600000).all();
  const d = today();
  return results.filter(r => nyParts(new Date(r.created_at)).date === d).length;
}
const visibleApps = (apps, profile) => (apps || []).filter(a => !a.visibleTo || a.visibleTo.includes(profile.id));
const adultOnly = (apps, appId) => { const a = (apps || []).find(x => x.id === appId); return !!(a && a.visibleTo); };

async function activity(env, profile, appId, text) {
  await env.DB.prepare('INSERT INTO activity (profile_id, app_id, text, created_at) VALUES (?, ?, ?, ?)').bind(profile.id, appId, text.slice(0, 200), Date.now()).run();
}

/** Runs one tool. Returns { result (for the model), chip (for the UI), ok }. Never throws for user-level problems. */
async function runTool(env, ctx, name, input) {
  const { profile, apps } = ctx;
  const canUse = id => visibleApps(apps, profile).some(a => a.id === id);
  const shrink = v => { const s = JSON.stringify(v); return s.length > BIG_VALUE ? `(large value, ${s.length} chars, not shown)` : v; };
  try {
    if (name === 'list_apps') return { ok: true, result: visibleApps(apps, profile).map(a => ({ id: a.id, name: a.name, scope: a.scope })), chip: null };

    if (name === 'get_data') {
      if (!canUse(input.app_id) && !['reminders', 'hub'].includes(input.app_id)) return { ok: false, result: 'This person cannot use that app.', chip: null };
      const args = { appId: input.app_id, scope: input.scope, profile };
      if (input.key) { const r = await getOne(env, { ...args, key: input.key }); return { ok: true, result: r && r.value != null ? shrink(r.value) : null, chip: null }; }
      const rows = (await listData(env, args)).filter(r => r.value != null && !/\.vault$/.test(r.key)).slice(0, 60);
      return { ok: true, result: rows.map(r => ({ key: r.key, value: shrink(r.value) })), chip: null };
    }

    if (name === 'set_data') {
      if (profile.kind === 'kid' && (adultOnly(apps, input.app_id) || !canUse(input.app_id))) return { ok: false, result: 'Kids cannot change that app.', chip: null };
      if (!canUse(input.app_id) && !['reminders', 'hub'].includes(input.app_id)) return { ok: false, result: 'This person cannot use that app.', chip: null };
      if (/\.vault$/.test(input.key)) return { ok: false, result: 'The journal vault cannot be edited from chat.', chip: null };
      await putOne(env, { appId: input.app_id, scope: input.scope, profile, key: input.key, value: input.value, updated_at: Date.now() });
      await activity(env, profile, input.app_id, `Changed ${input.key} in ${input.app_id} (via chat)`);
      return { ok: true, result: 'saved', chip: `✓ Saved ${input.key} in ${input.app_id}` };
    }

    if (name === 'add_list_item') {
      const id = rid();
      if (input.app_id === 'leftovers') {
        if (!canUse('leftovers')) return { ok: false, result: 'This person cannot use the Larder Ledger.', chip: null };
        const nm = String(input.item.name || '').trim(); if (!nm) return { ok: false, result: 'name is required', chip: null };
        const item = { id, name: nm, size: input.item.size || 'Medium', dateLogged: input.item.dateLogged || today(), by: profile.id, byName: profile.name };
        await putOne(env, { appId: 'leftovers', scope: 'family', profile, key: 'item:' + id, value: item, updated_at: Date.now() });
        await activity(env, profile, 'leftovers', `Logged ${nm} (${item.size}) in the fridge (via chat)`);
        return { ok: true, result: item, chip: `✓ Added ${nm} to leftovers` };
      }
      if (input.app_id === 'reminders') {
        if (profile.kind === 'kid') return { ok: false, result: 'Kids cannot add reminders for the house.', chip: null };
        const t = String(input.item.text || input.item.name || '').trim(); if (!t) return { ok: false, result: 'text is required', chip: null };
        const item = { id, text: t, by: profile.id, byName: profile.name, createdAt: Date.now() };
        await putOne(env, { appId: 'reminders', scope: 'family', profile, key: 'item:' + id, value: item, updated_at: Date.now() });
        await activity(env, profile, 'reminders', `Added a reminder: ${t} (via chat)`);
        return { ok: true, result: item, chip: `✓ Added reminder: ${t}` };
      }
      return { ok: false, result: 'unknown list', chip: null };
    }

    if (name === 'toggle_f260_reading') {
      if (!canUse('f260')) return { ok: false, result: 'This person does not use F260.', chip: null };
      const k = `${input.week}-${input.day - 1}`;
      const doneRow = await getOne(env, { appId: 'f260', scope: 'person', profile, key: 'f260.done' });
      const done = { ...(doneRow && doneRow.value ? doneRow.value : {}) };
      const now = Date.now();
      if (done[k]) delete done[k]; else done[k] = true;
      await putOne(env, { appId: 'f260', scope: 'person', profile, key: 'f260.done', value: done, updated_at: now });
      if (done[k]) {
        const logRow = await getOne(env, { appId: 'f260', scope: 'person', profile, key: 'f260.log' });
        await putOne(env, { appId: 'f260', scope: 'person', profile, key: 'f260.log', value: { ...(logRow && logRow.value ? logRow.value : {}), [today()]: true }, updated_at: now });
      }
      const sumRow = await getOne(env, { appId: 'f260', scope: 'person', profile, key: 'f260.summary' });
      if (sumRow && sumRow.value) {
        const s = sumRow.value; const weekDone = [0, 1, 2, 3, 4].filter(d => done[`${input.week}-${d}`]).length;
        await putOne(env, { appId: 'f260', scope: 'person', profile, key: 'f260.summary', value: { ...s, weekDone: s.week === input.week ? weekDone : s.weekDone, readToday: done[k] ? true : s.readToday, total: Object.keys(done).length }, updated_at: now });
      }
      await activity(env, profile, 'f260', `${done[k] ? 'Read' : 'Unchecked'} week ${input.week} day ${input.day} (via chat)`);
      return { ok: true, result: { week: input.week, day: input.day, done: !!done[k] }, chip: `✓ Week ${input.week} day ${input.day} ${done[k] ? 'checked off' : 'unchecked'}` };
    }

    if (name === 'add_prayer') {
      if (!canUse('prayer')) return { ok: false, result: 'This person does not use the prayer app.', chip: null };
      const t = String(input.text || '').trim(); if (!t) return { ok: false, result: 'text is required', chip: null };
      const scope = input.list === 'family' ? 'family' : 'person';
      const id = 'c' + rid();
      const p = { id, title: t, for: input.for || '', phone: '', detail: '', category: 'Personal', cadence: 'daily', days: [], status: 'active',
        createdAt: today(), lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, updatedAt: new Date().toISOString() };
      await putOne(env, { appId: 'prayer', scope, profile, key: 'prayer:' + id, value: p, updated_at: Date.now() });
      await activity(env, profile, 'prayer', scope === 'family' ? `Added a family prayer request: ${t} (via chat)` : 'Added a private prayer request (via chat)');
      return { ok: true, result: p, chip: `✓ Added to ${scope === 'family' ? 'the family' : 'your private'} prayer list: ${t}` };
    }
    return { ok: false, result: 'unknown tool', chip: null };
  } catch (e) {
    return { ok: false, result: 'Tool failed: ' + (e.message || e), chip: null };
  }
}

// ── prompt ────────────────────────────────────────────────────
function systemPrompt({ profile, household, apps }) {
  const people = household.map(p => `${p.name} (${p.kind}${p.is_admin ? ', admin' : ''})`).join(', ');
  const appList = visibleApps(apps, profile).map(a => `- ${a.id}: ${a.name} [${a.scope} data]`).join('\n');
  const base = `You are the Anderson House helper, a friendly assistant built into the family's hub app.
Household: ${people}.
Signed in now: ${profile.name} (${profile.kind}${profile.isAdmin ? ', admin' : ''}). Only their own person-scope data is reachable; family-scope data is shared by everyone.
Today is ${today()} (America/New_York).

Apps in the hub:
${appList}
Data conventions: leftovers and reminders are lists stored as item:<id> rows in family scope; prayers are prayer:<id> rows; F260 progress is f260.done ({"week-dayIndex": true}, dayIndex 0-4) and f260.summary in person scope.

How to behave:
- Keep replies short (a sentence or three); this is a phone-sized chat. Plain text, no markdown headings.
- Use tools to look things up or make changes instead of guessing. After a tool runs, confirm in one short line.
- To add food to the fridge list use add_list_item with app_id leftovers; for house reminders use add_list_item with app_id reminders; for prayers use add_prayer; to check off a Bible reading use toggle_f260_reading.
- If something isn't possible or the app isn't available to this person, say so simply.`;
  const kid = `

This person is a young child. Use simple, warm, cheerful words and short sentences. Only talk about kind, safe, family-friendly things; if asked about anything scary, grown-up, or unsafe, gently steer back to something fun and suggest asking a parent. Never change data in apps this child cannot open. Do not give medical, legal or financial advice.`;
  return base + (profile.kind === 'kid' ? kid : '');
}

// ── Anthropic streaming call ──────────────────────────────────
async function* anthropicStream(env, body) {
  const r = await fetch((env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!r.ok) {
    let msg = 'HTTP ' + r.status; try { const j = await r.json(); msg = (j.error && j.error.message) || msg; } catch {}
    throw new HttpError(r.status === 429 ? 503 : 502, 'upstream', 'The assistant is unavailable right now (' + msg + ').');
  }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of chunk.split('\n')) if (line.startsWith('data:')) { try { yield JSON.parse(line.slice(5).trim()); } catch {} }
    }
  }
}

/** One assistant turn: streams text to `send`, returns the full content blocks + stop reason. */
async function assistantTurn(env, body, send) {
  const blocks = []; let stop = null; let usage = null;
  for await (const ev of anthropicStream(env, body)) {
    if (ev.type === 'message_start') usage = ev.message.usage;
    else if (ev.type === 'content_block_start') blocks[ev.index] = ev.content_block.type === 'tool_use' ? { type: 'tool_use', id: ev.content_block.id, name: ev.content_block.name, json: '' } : ev.content_block.type === 'text' ? { type: 'text', text: '' } : { type: ev.content_block.type, skip: true };
    else if (ev.type === 'content_block_delta') {
      const b = blocks[ev.index]; if (!b || b.skip) continue;
      if (ev.delta.type === 'text_delta') { b.text += ev.delta.text; send('text', { text: ev.delta.text }); }
      else if (ev.delta.type === 'input_json_delta') b.json += ev.delta.partial_json;
    }
    else if (ev.type === 'message_delta') { stop = ev.delta.stop_reason; if (ev.usage) usage = { ...(usage || {}), ...ev.usage }; }
    else if (ev.type === 'error') throw new HttpError(502, 'upstream', (ev.error && ev.error.message) || 'stream error');
  }
  const content = blocks.filter(b => b && !b.skip).map(b => b.type === 'tool_use' ? { type: 'tool_use', id: b.id, name: b.name, input: safeJson(b.json) } : { type: 'text', text: b.text });
  return { content, stop, usage };
}
const safeJson = s => { try { return JSON.parse(s || '{}'); } catch { return null; } };

// ── request handler ───────────────────────────────────────────
export async function chatHandler(c, auth) {
  const profile = auth.profile;
  if (!c.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'chat_not_configured', 'The assistant has no API key yet (npx wrangler secret put ANTHROPIC_API_KEY).');
  if (profile.kind === 'kiosk') throw new HttpError(403, 'no_chat', 'The display profile has no chat.');
  const body = await c.body();
  const text = String(body.message || '').trim().slice(0, 2000);
  if (!text) throw new HttpError(400, 'bad_message', 'Say something first.');
  const apps = Array.isArray(body.apps) ? body.apps.slice(0, 40).map(a => ({ id: String(a.id), name: String(a.name || a.id), scope: String(a.scope || 'person'), visibleTo: Array.isArray(a.visibleTo) ? a.visibleTo.map(String) : undefined })) : [];

  // Daily cap: user messages sent today (New York day).
  const { results: recent } = await c.env.DB.prepare("SELECT role, content, created_at FROM chat_log WHERE profile_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 200").bind(profile.id, Date.now() - 36 * 3600000).all();
  const used = await usedToday(c.env, profile.id);
  if (used >= DAILY_CAP) throw new HttpError(429, 'daily_cap', `That's ${DAILY_CAP} messages for today — the assistant is resting until tomorrow.`, { used, cap: DAILY_CAP });

  const { results: household } = await c.env.DB.prepare("SELECT name, kind, is_admin FROM profiles ORDER BY sort_order").all();
  const history = recent.slice(0, HISTORY).reverse().filter(r => r.role === 'user' || r.role === 'assistant').map(r => ({ role: r.role, content: r.content }));
  // The API wants alternating turns starting with user; drop a leading assistant and collapse repeats.
  const msgs = [];
  for (const m of history) { if (!msgs.length && m.role !== 'user') continue; if (msgs.length && msgs[msgs.length - 1].role === m.role) msgs[msgs.length - 1].content += '\n' + m.content; else msgs.push({ ...m }); }
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs.pop();
  msgs.push({ role: 'user', content: text });

  const now = Date.now();
  await c.env.DB.prepare('INSERT INTO chat_log (profile_id, role, content, created_at) VALUES (?, ?, ?, ?)').bind(profile.id, 'user', text, now).run();

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const send = (event, data) => writer.write(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)).catch(() => {});
  const ctx = { profile, apps };

  const run = async () => {
    let finalText = '', chips = [], usage = null, stop = null;
    try {
      const base = { model: MODEL, max_tokens: MAX_TOKENS, system: systemPrompt({ profile, household, apps }), tools: TOOLS, thinking: { type: 'adaptive' }, output_config: { effort: 'low' } };
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const t = await assistantTurn(c.env, { ...base, messages: msgs }, send);
        usage = t.usage; stop = t.stop;
        finalText += t.content.filter(b => b.type === 'text').map(b => b.text).join('');
        const uses = t.content.filter(b => b.type === 'tool_use');
        if (t.stop !== 'tool_use' || !uses.length) break;
        msgs.push({ role: 'assistant', content: t.content });
        const results = [];
        for (const u of uses) {
          const r = u.input === null ? { ok: false, result: 'tool input was not valid JSON', chip: null } : await runTool(c.env, ctx, u.name, u.input);
          if (r.chip) { chips.push(r.chip); }
          send('tool', { name: u.name, input: u.input, chip: r.chip, ok: r.ok });
          results.push({ type: 'tool_result', tool_use_id: u.id, content: typeof r.result === 'string' ? r.result : JSON.stringify(r.result), is_error: !r.ok });
        }
        msgs.push({ role: 'user', content: results });
        finalText += finalText && !finalText.endsWith('\n') ? '\n' : '';
      }
      if (stop === 'max_tokens') send('text', { text: ' …' });
      send('done', { usage: usage ? { input: usage.input_tokens, output: usage.output_tokens } : null, stop_reason: stop, used: used + 1, cap: DAILY_CAP });
    } catch (e) {
      send('error', { error: e.error || 'chat_failed', message: e.message || String(e) });
    } finally {
      const saved = (finalText.trim() || (chips.length ? chips.join(' · ') : '')).slice(0, 4000);
      if (saved) await c.env.DB.prepare('INSERT INTO chat_log (profile_id, role, content, created_at) VALUES (?, ?, ?, ?)').bind(profile.id, 'assistant', saved + (chips.length && finalText.trim() ? '\n' + chips.join(' · ') : ''), Date.now()).run().catch(() => {});
      try { await writer.close(); } catch {}
    }
  };
  c.exec.waitUntil(run());
  return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', ...(c.cors || {}) } });
}

/** GET /api/chat/history — the rolling window the model also sees, for the Chat tab to show on open. */
export async function chatHistory(c, auth) {
  const { results } = await c.env.DB.prepare('SELECT role, content, created_at FROM chat_log WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?').bind(auth.profile.id, HISTORY).all();
  return { messages: results.reverse(), used: await usedToday(c.env, auth.profile.id), cap: DAILY_CAP, enabled: !!c.env.ANTHROPIC_API_KEY };
}
