// Skeptic #2 for finding "kid-chat-writes-adult-only-rows". Independent of 02-kid.mjs / lib.mjs.
// Signed in as Ezra (kid), a scripted upstream asks for set_data on the park map's adult-only family rows, and
// the same rows are compared against (a) the server's own adult-only rally endpoint and (b) the raw data API
// with the same kid session, so the reader can see whether chat adds anything the kid token could not already do.
//   node "audits/tools/phase2/CHAT/verify-kid-chat-writes-adult-only-rows-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT', 'verify-kid-chat-writes-adult-only-rows-2.json');
const APPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));

const sse = t => String(t).split('\n\n').filter(c => c.trim()).map(c => { let ev = 'message', d = null; for (const l of c.split('\n')) { if (l.startsWith('event:')) ev = l.slice(6).trim(); else if (l.startsWith('data:')) { try { d = JSON.parse(l.slice(5)); } catch { d = l.slice(5); } } } return { ev, d }; });

const L = await local({ variant: 'park', clock: 'real' });
const out = {};
const say = (k, v) => { out[k] = v; console.log(k.padEnd(44), JSON.stringify(v)); };
const get = async (pid, app, key, scope = 'family') => { const r = await L.apiAs(pid, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`); return r.body.item ? r.body.item.value : undefined; };
async function tool(pid, name, input) {
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name, input }] }, { text: 'ok' }]);
  const r = await L.apiAs(pid, '/api/chat', { method: 'POST', body: { message: 'please do it', apps: APPS } });
  const evs = typeof r.body === 'string' ? sse(r.body) : [];
  const t = evs.find(e => e.ev === 'tool');
  return { http: r.status, ok: t ? t.d.ok : null, chip: t ? t.d.chip : null, toolResult: await (async () => { const log = await L.anthropicLog(); const m = log[1] && log[1].body.messages.at(-1); const tr = m && Array.isArray(m.content) && m.content.find(b => b.type === 'tool_result'); return tr ? String(tr.content).slice(0, 160) : null; })() };
}
try {
  const me = await L.apiAs('ezra', '/api/me');
  say('ezra profile kind', me.body.profile && me.body.profile.kind);

  // control: the chat guard exists and works for an adult-only app
  say('control: kid set_data f260 (adult-only app)', await tool('ezra', 'set_data', { app_id: 'f260', scope: 'person', key: 'x', value: 1 }));
  say('control: kid finish_leftover', await tool('ezra', 'finish_leftover', { name: 'x' }));

  // discovery: a kid's model can read the park map's family rows to learn the key names
  const disc = await tool('ezra', 'get_data', { app_id: 'dollywood-live', scope: 'family' });
  say('kid get_data dollywood-live family (keys seen)', { ok: disc.ok, excerpt: disc.toolResult });

  const meet0 = await get('eli', 'dollywood-live', 'meet');
  const loc0 = await get('eli', 'dollywood-live', 'loc:eli');
  say('before: meet / loc:eli / kidshare:kiara / kid:kiara', { meet: meet0 && meet0.name, locEli: loc0 && { x: loc0.x, y: loc0.y }, kidshareKiara: await get('eli', 'dollywood-live', 'kidshare:kiara'), kidKiara: await get('eli', 'dollywood-live', 'kid:kiara') });

  say('chat set_data meet (as ezra)', await tool('ezra', 'set_data', { app_id: 'dollywood-live', scope: 'family', key: 'meet', value: { x: 10, y: 10, name: 'Candy shop', note: '', by: 'dad', byName: 'David', at: Date.now() } }));
  say('chat set_data kidshare:kiara=true (as ezra)', await tool('ezra', 'set_data', { app_id: 'dollywood-live', scope: 'family', key: 'kidshare:kiara', value: true }));
  say('chat set_data loc:eli (as ezra)', await tool('ezra', 'set_data', { app_id: 'dollywood-live', scope: 'family', key: 'loc:eli', value: { ...(loc0 || {}), x: 7, y: 7, t: Date.now() } }));
  say('chat set_data kid:kiara height 70 (as ezra)', await tool('ezra', 'set_data', { app_id: 'dollywood-live', scope: 'family', key: 'kid:kiara', value: { height_in: 70, at: Date.now(), by: 'ezra' } }));

  const meet1 = await get('eli', 'dollywood-live', 'meet');
  say('after (read as eli)', { meet: meet1 && { name: meet1.name, byName: meet1.byName }, locEli: (v => v && { x: v.x, y: v.y })(await get('eli', 'dollywood-live', 'loc:eli')), kidshareKiara: await get('eli', 'dollywood-live', 'kidshare:kiara'), kidKiara: (v => v && v.height_in)(await get('eli', 'dollywood-live', 'kid:kiara')) });

  // (the park seed's own feed rows sit a few hours ahead of the real clock, so filter rather than take the top rows)
  const feed = await L.apiAs('eli', '/api/activity?limit=100');
  say('activity feed: ezra via-chat lines', feed.body.activity.filter(a => a.profile_id === 'ezra' && /via chat/.test(a.text)).map(a => `${a.name}: ${a.text}`));

  // the server's own adult-only path for the same row
  const rally = await L.apiAs('ezra', '/api/dollywood/rally', { method: 'POST', body: { name: 'Candy shop', x: 10, y: 10 } });
  say('POST /api/dollywood/rally as ezra', { status: rally.status, error: rally.body && rally.body.error });

  // the raw data API with the same kid session (no chat involved)
  const raw = await L.apiAs('ezra', '/api/data/dollywood-live/meet?scope=family', { method: 'PUT', body: { value: { x: 20, y: 20, name: 'Raw API spot', by: 'ezra', byName: 'Ezra', at: Date.now() }, updated_at: Date.now() } });
  say('raw PUT /api/data/dollywood-live/meet as ezra', { status: raw.status, applied: raw.body && raw.body.applied });
  const rawKs = await L.apiAs('ezra', '/api/data/dollywood-live/kidshare:ezra?scope=family', { method: 'PUT', body: { value: true, updated_at: Date.now() } });
  say('raw PUT kidshare:ezra (own beacon) as ezra', { status: rawKs.status, applied: rawKs.body && rawKs.body.applied });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ runAt: new Date().toISOString(), ...out }, null, 2));
  console.log('\nevidence:', path.relative(ROOT, OUT).replace(/\\/g, '/'));
} finally { await L.close(); }
