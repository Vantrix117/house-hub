// Skeptic #1 for CHAT finding "set-data-overwrites-any-row". Independent re-run on a fresh local rig (clock real).
// Checks each sub-claim, plus the limits the claim may overstate: can set_data reach ANOTHER person's person scope?
// does the raw data API (PUT /api/data) already allow the same family writes, i.e. is chat an escalation or not?
//   node "audits/tools/phase2/CHAT/verify-set-data-overwrites-any-row-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT');
fs.mkdirSync(EVID, { recursive: true });
const APPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));

const L = await local({ variant: 'typical', clock: 'real' });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k.padEnd(44), JSON.stringify(v)); };

// One scripted model turn: the upstream asks for set_data(input), then says "Done."
async function setData(pid, input) {
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name: 'set_data', input }] }, { text: 'Done.' }]);
  const r = await L.apiAs(pid, '/api/chat', { method: 'POST', body: { message: 'please do it', apps: APPS } });
  const body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
  const events = body.split('\n\n').filter(Boolean).map(ch => { const ev = (ch.match(/^event: (.*)$/m) || [])[1]; const d = (ch.match(/^data: (.*)$/m) || [])[1]; let data = d; try { data = JSON.parse(d); } catch {} return { ev, data }; });
  const tool = (events.find(e => e.ev === 'tool') || {}).data || {};
  const upstream = await L.anthropicLog();
  return { http: r.status, ok: tool.ok, chip: tool.chip, eventKinds: [...new Set(events.map(e => e.ev))], upstreamCalls: upstream.length };
}
const get = async (pid, app, scope, key) => { const r = await L.apiAs(pid, `/api/data/${app}?scope=${scope}` + (key ? '&key=' + encodeURIComponent(key) : '')); return key ? (r.body.item ? r.body.item.value : undefined) : r.body.items; };
const rawPut = (pid, app, scope, key, value) => L.apiAs(pid, `/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', body: { value, updated_at: Date.now() } });

try {
  // 1. Eli wipes his own F260 history in one call
  const eliDone0 = await get('eli', 'f260', 'person', 'f260.done') || {};
  const r1 = await setData('eli', { app_id: 'f260', scope: 'person', key: 'f260.done', value: {} });
  const eliDone1 = await get('eli', 'f260', 'person', 'f260.done') || {};
  log('1 eli f260.done readings before/after', { before: Object.keys(eliDone0).length, after: Object.keys(eliDone1).length, chip: r1.chip, sseEvents: r1.eventKinds, upstreamCalls: r1.upstreamCalls });

  // 1b. Can Mae's set_data reach ELI's person scope? (the title says "any row")
  const maeDone0 = await get('christian', 'f260', 'person', 'f260.done') || {};
  const dadDone0 = await get('dad', 'f260', 'person', 'f260.done') || {};
  const r1b = await setData('christian', { app_id: 'f260', scope: 'person', key: 'f260.done', value: { 'audit-marker': true } });
  const dadDone1 = await get('dad', 'f260', 'person', 'f260.done') || {};
  const maeDone1 = await get('christian', 'f260', 'person', 'f260.done') || {};
  log('1b mae person write lands on', { chip: r1b.chip, maeBefore: Object.keys(maeDone0).length, maeAfter: Object.keys(maeDone1), dadBefore: Object.keys(dadDone0).length, dadAfter: Object.keys(dadDone1).length });

  // 2. Album: DELETE route refuses a non-owner; chat set_data tombstones it; raw PUT also tombstones (server-wide gap?)
  const albums = (await get('eli', 'hub', 'family')).filter(x => x.key.startsWith('album:') && x.value);
  const notMae = albums.filter(x => x.value.by !== 'christian');
  log('2 album rows (total / not by Mae)', { total: albums.length, notMae: notMae.length, owners: albums.map(x => x.value.by) });
  const a1 = notMae[0], a2 = notMae[1];
  const del = await L.apiAs('christian', `/api/album/${a1.value.id}`, { method: 'DELETE' });
  const r2 = await setData('christian', { app_id: 'hub', scope: 'family', key: a1.key, value: null });
  const a1After = await get('eli', 'hub', 'family', a1.key);
  const media = await L.apiAs('eli', a1.value.sm);
  log('2a mae: DELETE /api/album vs chat set_data', { photoBy: a1.value.by, albumRoute: `${del.status} ${del.body && del.body.error}`, chat: r2.chip, rowAfter: a1After === null ? 'tombstone (null)' : a1After, mediaStillServed: media.status });
  if (a2) {
    const rp = await rawPut('christian', 'hub', 'family', a2.key, null);
    const a2After = await get('eli', 'hub', 'family', a2.key);
    log('2b mae raw PUT /api/data/hub/album:* null', { photoBy: a2.value.by, status: rp.status, rowAfter: a2After === null ? 'tombstone (null)' : 'still there' });
  }

  // 3. Kid star mirrors: Mae via chat, guest via chat, and a raw PUT for comparison
  const ez0 = await get('eli', 'kidverse', 'family', 'stars:ezra');
  const r3 = await setData('christian', { app_id: 'kidverse', scope: 'family', key: 'stars:ezra', value: { ...(ez0 || {}), count: 7, total: 99 } });
  const ez1 = await get('eli', 'kidverse', 'family', 'stars:ezra');
  log('3a mae chat stars:ezra', { chip: r3.chip, before: ez0 && { count: ez0.count, total: ez0.total }, after: ez1 && { count: ez1.count, total: ez1.total } });
  const r3g = await setData('guest-grandmajo', { app_id: 'kidverse', scope: 'family', key: 'stars:kiara', value: { count: 0, total: 0, week: 'x' } });
  log('3b guest chat stars:kiara', { chip: r3g.chip, ok: r3g.ok, after: await get('eli', 'kidverse', 'family', 'stars:kiara') });
  const rp3 = await rawPut('guest-grandmajo', 'kidverse', 'family', 'stars:ezra', { count: 1, total: 1, week: 'raw' });
  log('3c guest raw PUT stars:ezra', { status: rp3.status, after: await get('eli', 'kidverse', 'family', 'stars:ezra') });

  // 4. Meeting point: route guards vs chat vs raw PUT
  const ral1 = await L.apiAs('christian', '/api/dollywood/rally', { method: 'POST', body: { name: 'Rally A', x: 800, y: 800 } });
  const ral2 = await L.apiAs('christian', '/api/dollywood/rally', { method: 'POST', body: { name: 'Rally B', x: 800, y: 800 } });
  const ralG = await L.apiAs('guest-grandmajo', '/api/dollywood/rally', { method: 'POST', body: { name: 'G', x: 1, y: 1 } });
  const g1 = await setData('guest-grandmajo', { app_id: 'dollywood-live', scope: 'family', key: 'meet', value: { x: 1, y: 1, name: 'Guest meet 1' } });
  const m1 = (await get('eli', 'dollywood-live', 'family', 'meet') || {}).name;
  const g2 = await setData('guest-grandmajo', { app_id: 'dollywood-live', scope: 'family', key: 'meet', value: { x: 2, y: 2, name: 'Guest meet 2' } });
  const m2 = (await get('eli', 'dollywood-live', 'family', 'meet') || {}).name;
  const rp4 = await rawPut('guest-grandmajo', 'dollywood-live', 'family', 'meet', { x: 3, y: 3, name: 'Guest raw meet' });
  const m3 = (await get('eli', 'dollywood-live', 'family', 'meet') || {}).name;
  log('4 meeting point', { maeRally1: ral1.status, maeRally2: `${ral2.status} ${ral2.body && ral2.body.error}`, guestRally: `${ralG.status} ${ralG.body && ralG.body.error}`, guestChat1: g1.chip, meetAfter1: m1, guestChat2: g2.chip, meetAfter2: m2, guestRawPut: rp4.status, meetAfterRaw: m3 });

  // 5. Key validation: chat skips checkKey; can the row be removed through the data API afterwards?
  const bad = 'bad key with spaces & symbols!';
  const r5 = await setData('eli', { app_id: 'tally', scope: 'person', key: bad, value: 1 });
  const api5 = await rawPut('eli', 'tally', 'person', bad, 1);
  const listed = (await get('eli', 'tally', 'person')).filter(x => x.key === bad);
  const del5 = await L.apiAs('eli', `/api/data/tally/${encodeURIComponent(bad)}?scope=person`, { method: 'DELETE' });
  const longKey = 'k'.repeat(500);
  const r5b = await setData('eli', { app_id: 'tally', scope: 'person', key: longKey, value: 1 });
  const listedLong = (await get('eli', 'tally', 'person')).filter(x => x.key === longKey).length;
  log('5 bad key', { chatChip: r5.chip, rawPut: `${api5.status} ${api5.body && api5.body.error}`, rowListedByGet: listed.length, rawDelete: `${del5.status} ${del5.body && del5.body.error}`, chat500CharKey: r5b.chip, longRowListed: listedLong });

  // 6. Feed lines chat wrote
  const feed = (await L.apiAs('eli', '/api/activity?limit=40')).body;
  const rows = (feed.activity || feed.items || feed || []);
  log('6 feed via chat', (Array.isArray(rows) ? rows : []).filter(a => /via chat/.test(a.text)).map(a => `${a.name || a.profile_id}: ${a.text}`).slice(0, 12));

  fs.writeFileSync(path.join(EVID, 'verify-set-data-overwrites-any-row-1.json'), JSON.stringify({ runAt: new Date().toISOString(), ...out }, null, 2));
  console.log('\nevidence: audits/evidence/p2/CHAT/verify-set-data-overwrites-any-row-1.json');
} finally { await L.close(); }
