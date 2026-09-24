// Skeptic #2 for CHAT finding "set-data-overwrites-any-row". Independent re-run on a fresh local instance (clock real).
// For every chat set_data write the finding reports, it also tries the SAME write through the raw data API
// (PUT /api/data/:app/:key, what hub.js uses) as the same session — so the report can tell a chat-only bypass
// from a server-wide property of family scope that chat merely makes reachable in one sentence.
//   node "audits/tools/phase2/CHAT/verify-set-data-overwrites-any-row-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT');
const APPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));

const L = await local({ variant: 'typical', clock: 'real' });
const out = { runAt: new Date().toISOString() };
const log = (k, v) => { out[k] = v; console.log(k.padEnd(34), JSON.stringify(v)); };

const get = async (pid, app, scope, key) => { const r = await L.apiAs(pid, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`); return r.body.item ? r.body.item.value : undefined; };
const list = async (pid, app, scope) => (await L.apiAs(pid, `/api/data/${app}?scope=${scope}`)).body.items || [];
const rawPut = async (pid, app, scope, key, value) => { const r = await L.apiAs(pid, `/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', body: { value, updated_at: Date.now() } }); return `${r.status} ${r.body.error || (r.body.applied === true ? 'applied' : JSON.stringify(r.body).slice(0, 60))}`; };
/** One scripted upstream: the model asks for set_data(input), then says "Done.". Returns the SSE tool event. */
async function chatSet(pid, input, message = 'please change that') {
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name: 'set_data', input }] }, { text: 'Done.' }]);
  const r = await L.apiAs(pid, '/api/chat', { method: 'POST', body: { message, apps: APPS } });
  const ev = String(r.body).split('\n\n').filter(c => c.startsWith('event: tool')).map(c => JSON.parse(c.split('\n').find(l => l.startsWith('data:')).slice(5)))[0] || {};
  const up = await L.anthropicLog();
  const sse = String(r.body).split('\n\n').map(c => (c.match(/^event: (\w+)/) || [])[1]).filter(Boolean);
  return { status: r.status, ok: ev.ok, chip: ev.chip, upstreamCalls: up.length, sseEvents: [...new Set(sse)] };
}

try {
  // A. Eli's own F260 history, and whether the F260 app itself guards this (apps/f260.html:1763 confirmModal 'Reset all progress?')
  const d0 = await get('eli', 'f260', 'person', 'f260.done');
  const a = await chatSet('eli', { app_id: 'f260', scope: 'person', key: 'f260.done', value: {} }, 'clear my reading list');
  const d1 = await get('eli', 'f260', 'person', 'f260.done');
  log('A eli f260.done via chat', { before: Object.keys(d0 || {}).length, after: Object.keys(d1 || {}).length, chip: a.chip, upstreamCalls: a.upstreamCalls, sseEvents: a.sseEvents });

  // B. Album row owned by someone else: DELETE /api/album guard vs raw PUT vs chat
  const albums = (await list('christian', 'hub', 'family')).filter(x => x.key.startsWith('album:') && x.value && x.value.by !== 'christian');
  log('B album rows not by Mae', albums.map(x => `${x.key} by ${x.value.by}`));
  const [rowRaw, rowChat] = albums;
  const del = await L.apiAs('christian', `/api/album/${rowRaw.value.id}`, { method: 'DELETE' });
  const raw = await rawPut('christian', 'hub', 'family', rowRaw.key, null);
  const rawAfter = await get('eli', 'hub', 'family', rowRaw.key);
  const b = await chatSet('christian', { app_id: 'hub', scope: 'family', key: rowChat.key, value: null });
  const chatAfter = await get('eli', 'hub', 'family', rowChat.key);
  const media = await fetch(L.api + rowChat.value.sm);
  log('B album', { deleteRoute: `${del.status} ${del.body.error}`, rawPutNullAsMae: raw, rawRowAfter: rawAfter === null ? 'tombstoned' : 'present', chatChip: b.chip, chatRowAfter: chatAfter === null ? 'tombstoned' : 'present', mediaStillServed: media.status });

  // C. Kid star mirrors (CLAUDE.md: Kid Verse signed in as that kid is the only writer)
  const s0 = await get('christian', 'kidverse', 'family', 'stars:ezra');
  const rawStars = await rawPut('christian', 'kidverse', 'family', 'stars:ezra', { ...(s0 || {}), count: 5, total: 50 });
  const c1 = await chatSet('christian', { app_id: 'kidverse', scope: 'family', key: 'stars:ezra', value: { ...(s0 || {}), count: 7, total: 99 } });
  const s1 = await get('eli', 'kidverse', 'family', 'stars:ezra');
  const c2 = await chatSet('guest-grandmajo', { app_id: 'kidverse', scope: 'family', key: 'stars:kiara', value: { count: 0, total: 0, week: 'x' } });
  const rawGuest = await rawPut('guest-grandmajo', 'kidverse', 'family', 'stars:kiara', { count: 1, total: 1, week: 'y' });
  log('C stars', { before: s0 && { count: s0.count, total: s0.total }, rawPutAsMae: rawStars, maeChatChip: c1.chip, after: { count: s1.count, total: s1.total }, guestChatChip: c2.chip, guestRawPut: rawGuest });

  // D. Meeting point: rally route rules vs raw PUT vs chat (and the park map's own setMeet: apps/dollywood-live.html:1586 lets any kind==='adult' write 'meet' via hub.set)
  const g1 = await chatSet('guest-grandmajo', { app_id: 'dollywood-live', scope: 'family', key: 'meet', value: { x: 1, y: 1, name: 'Guest meet 1', by: 'guest-grandmajo', at: Date.now() } });
  const g2 = await chatSet('guest-grandmajo', { app_id: 'dollywood-live', scope: 'family', key: 'meet', value: { x: 2, y: 2, name: 'Guest meet 2', by: 'guest-grandmajo', at: Date.now() } });
  const gr = await L.apiAs('guest-grandmajo', '/api/dollywood/rally', { method: 'POST', body: { name: 'G', x: 1, y: 1 } });
  const graw = await rawPut('guest-grandmajo', 'dollywood-live', 'family', 'meet', { x: 3, y: 3, name: 'Guest meet raw', by: 'guest-grandmajo', at: Date.now() });
  const guestProfile = (await L.apiAs('guest-grandmajo', '/api/me')).body.profile;
  log('D meet', { guestKind: guestProfile && guestProfile.kind, guestIsGuest: guestProfile && guestProfile.is_guest, chat1: g1.chip, chat2: g2.chip, rallyRoute: `${gr.status} ${gr.body.error}`, rawPut: graw, meetNow: (await get('eli', 'dollywood-live', 'family', 'meet')).name });

  // E. Key the data API refuses
  const e = await chatSet('eli', { app_id: 'tally', scope: 'person', key: 'bad key & symbols!', value: 1 });
  const eraw = await rawPut('eli', 'tally', 'person', 'bad key & symbols!', 1);
  const stored = (await list('eli', 'tally', 'person')).filter(x => /bad key/.test(x.key)).map(x => x.key);
  const long = 'k'.repeat(260);
  const e2 = await chatSet('eli', { app_id: 'tally', scope: 'person', key: long, value: 1 });
  const storedLong = (await list('eli', 'tally', 'person')).some(x => x.key === long);
  log('E bad keys', { chatChip: e.chip, rawPut: eraw, storedKeys: stored, chat260charChip: e2.chip, stored260: storedLong });

  // F. Kid and kiosk guards on set_data (context: who can NOT do this)
  const k = await chatSet('ezra', { app_id: 'kidverse', scope: 'family', key: 'stars:kiara', value: { count: 9 } });
  const kh = await chatSet('ezra', { app_id: 'hub', scope: 'family', key: 'album:x', value: null });
  const kiosk = await L.apiAs('tv', '/api/chat', { method: 'POST', body: { message: 'hi', apps: APPS } }).catch(e => ({ status: 'err ' + e.message }));
  log('F kid/kiosk', { kidKidverse: `${k.ok} ${k.chip}`, kidHub: `${kh.ok} ${kh.chip}`, kioskChat: `${kiosk.status} ${kiosk.body && kiosk.body.error}` });

  // G. Feed lines
  const feed = (await L.apiAs('eli', '/api/activity?limit=30')).body.activity.filter(x => /via chat/.test(x.text)).map(x => `${x.name}: ${x.text}`);
  log('G feed', feed.slice(0, 10));

  fs.mkdirSync(EVID, { recursive: true });
  fs.writeFileSync(path.join(EVID, 'verify-set-data-overwrites-any-row-2.json'), JSON.stringify(out, null, 2));
  console.log('\nevidence: audits/evidence/p2/CHAT/verify-set-data-overwrites-any-row-2.json');
} finally { await L.close(); }
