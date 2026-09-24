// PROF skeptic #2 — "Any writer can stamp a row 5 minutes into the future and make others' writes lose".
// Independent re-run on a fresh local instance (real worker/src on in-memory SQLite; nothing touches production).
//
//   node "audits/tools/phase2/PROF/verify-future-stamp-lock-2.mjs"
//
// A. The raw-API claim as stated: Ezra PUTs updated_at = now + 1 h; Mom PUTs with a normal clock.
// B. The server's own Date.now() writers against a future-stamped row: DELETE route, chat finish_leftover, chat set_data.
// C. The real hub.js client (Mom's phone, Larder app) that has PULLED the future-stamped row, then edits it.
// D. The real hub.js client with a STALE cache (row future-stamped after its last pull), edits twice.
// E. "Bad device clock": a phone whose clock is 1 h fast — online (skew corrected) and before its first successful pull.
// Writes audits/evidence/p2/PROF/verify-future-stamp-lock-2.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const ev = { at: new Date().toISOString(), steps: [] };
const log = (name, o) => { ev.steps.push({ name, ...o }); console.log(`\n## ${name}\n` + Object.entries(o).map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')); };

const L = await local({ variant: 'typical', clock: 'real' });
const row = async key => { const r = await L.apiAs('eli', `/api/data/leftovers?scope=family&key=${encodeURIComponent(key)}`); return { item: r.body.item, serverNow: r.body.now }; };
const ahead = async key => { const { item, serverNow } = await row(key); return { value: item && item.value, aheadOfServerNow_s: item ? +((item.updated_at - serverNow) / 1000).toFixed(1) : null }; };
const putRaw = (who, key, value, updated_at) => L.apiAs(who, `/api/data/leftovers/${encodeURIComponent(key)}?scope=family`, { method: 'PUT', body: { value, updated_at } });
const future = (who, key, name) => putRaw(who, key, { id: key.slice(5), name, size: 'Small', dateLogged: '2026-09-24', by: who }, Date.now() + 3600e3);

function parseSSE(text) {
  return String(text).split('\n\n').filter(c => c.trim()).map(c => {
    let event = 'message', data = null;
    for (const l of c.split('\n')) { if (l.startsWith('event:')) event = l.slice(6).trim(); else if (l.startsWith('data:')) { try { data = JSON.parse(l.slice(5)); } catch { data = l.slice(5); } } }
    return { event, data };
  });
}
const APPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
async function toolCall(who, name, input) {
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name, input }] }, { text: 'Done.' }]);
  const r = await L.apiAs(who, '/api/chat', { method: 'POST', body: { message: 'please ' + name, apps: APPS } });
  const tools = typeof r.body === 'string' ? parseSSE(r.body).filter(e => e.event === 'tool').map(e => e.data) : [];
  return { status: r.status, ok: tools[0] && tools[0].ok, chip: tools[0] && tools[0].chip };
}

try {
  // ── A. the claim as stated ──
  const a1 = await future('ezra', 'item:fsA', 'Ezra future row');
  const aStored = await ahead('item:fsA');
  await sleep(1000);
  const a2 = await putRaw('mom', 'item:fsA', { id: 'fsA', name: 'Mom fixed it' }, Date.now());
  log('A. raw PUT, Ezra +1 h then Mom normal clock 1 s later', { ezraPut: `${a1.status} applied=${a1.body.applied}`, storedAhead_s: aStored.aheadOfServerNow_s, momPut: `${a2.status} applied=${a2.body.applied}`, rowAfter: (await ahead('item:fsA')) });

  // ── B. server-side Date.now() writers ──
  await future('ezra', 'item:fsB1', 'Zebra soup');
  const del = await L.apiAs('mom', '/api/data/leftovers/item:fsB1?scope=family', { method: 'DELETE' });
  log('B1. Mom DELETE /api/data/leftovers/item:fsB1 (route stamps Date.now(), index.js:306)', { status: del.status, applied: del.body.applied, rowAfter: await ahead('item:fsB1') });

  await future('ezra', 'item:fsB2', 'Walrus stew');
  const fin = await toolCall('mom', 'finish_leftover', { name: 'Walrus stew' });
  const finRow = await ahead('item:fsB2');
  const feed = (await L.apiAs('eli', '/api/activity?limit=100')).body;
  const feedItems = (feed.activity || []).map(a => a.text).filter(t => /Walrus/.test(t));
  log('B2. Mom via chat: finish_leftover "Walrus stew" (chat.js:279 stamps Date.now(), ignores applied)', { chatStatus: fin.status, toolOk: fin.ok, chip: fin.chip, rowAfter: finRow, stillInFridge: finRow.value != null, feedLines: feedItems });

  await future('ezra', 'item:fsB3', 'Yak curry');
  const sd = await toolCall('mom', 'set_data', { app_id: 'leftovers', scope: 'family', key: 'item:fsB3', value: { id: 'fsB3', name: 'Yak curry (Mom via chat)' } });
  log('B3. Mom via chat: set_data item:fsB3 (chat.js:177 stamps Date.now())', { toolOk: sd.ok, chip: sd.chip, rowAfter: await ahead('item:fsB3') });

  // ── C/D. real hub.js client on Mom's phone ──
  const momDev = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: momDev });
  const f = await phone.openApp('leftovers');
  await f.evaluate(() => hub.ready());
  await f.evaluate(() => hub.pull());

  await future('ezra', 'item:fsC', 'Ezra future row C');
  const c = await f.evaluate(async () => {
    await hub.pull();
    const before = hub.list('item:fsC')[0];
    hub.set('item:fsC', { id: 'fsC', name: 'Mom edit via Larder', size: 'Small', dateLogged: '2026-09-24' });
    await hub.flush();
    return { cachedT_minus_now_s: before ? +((before.updated_at - (Date.now() + hub.skew)) / 1000).toFixed(1) : null, localAfter: hub.get('item:fsC'), sync: hub.sync.state };
  });
  log('C. hub.js client that has pulled the future row, then edits it (hub.js:236 t = max(now+skew, cached t + 1))', { ...c, serverRowAfter: await ahead('item:fsC') });

  // D: Mom's phone has item:fsD at a normal stamp; Ezra future-stamps it; Mom edits before her next pull
  await putRaw('mom', 'item:fsD', { id: 'fsD', name: 'Lasagna', size: 'Large', dateLogged: '2026-09-23' }, Date.now());
  await f.evaluate(() => hub.pull());
  await future('ezra', 'item:fsD', 'Lasagna (Ezra future)');
  const d = await f.evaluate(async () => {
    hub.set('item:fsD', { id: 'fsD', name: 'Lasagna (Mom edit 1)', size: 'Large', dateLogged: '2026-09-23' });
    await hub.flush();
    const afterFirst = hub.get('item:fsD');
    hub.set('item:fsD', { id: 'fsD', name: 'Lasagna (Mom edit 2)', size: 'Large', dateLogged: '2026-09-23' });
    await hub.flush();
    return { localAfterFirstEdit: afterFirst && afterFirst.name, localAfterSecondEdit: hub.get('item:fsD').name };
  });
  log('D. hub.js client with a stale cache: edit 1 then edit 2', { ...d, serverRowAfter: await ahead('item:fsD') });

  // ── E. bad device clock (1 h fast) ──
  const momDev2 = await L.newDevice({ name: 'Mom fast-clock phone', profiles: ['mom'] });
  const fast = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: Date.now() + 3600e3, as: momDev2 });
  const f2 = await fast.openApp('leftovers');
  await f2.evaluate(() => hub.ready());
  await f2.evaluate(() => hub.pull());
  const e1 = await f2.evaluate(async () => { hub.set('item:fsE1', { id: 'fsE1', name: 'Fast-clock online write' }); await hub.flush(); return { skew_s: Math.round(hub.skew / 1000) }; });
  log('E1. phone clock +1 h, online (skew learnt from a pull, hub.js:290)', { ...e1, serverRowAfter: await ahead('item:fsE1') });

  const momDev3 = await L.newDevice({ name: 'Mom fast-clock offline phone', profiles: ['mom'] });
  const off = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: Date.now() + 3600e3, as: momDev3 });
  await off.setOffline(true);                       // API unreachable from the first load: no pull ever succeeds, skew stays 0
  const f3 = await off.openApp('leftovers');
  await f3.waitForFunction(() => window.hub && hub.profile).catch(() => {});
  await off.setOffline(true);                       // also flip navigator.onLine now that the frames exist
  const e2pre = await f3.evaluate(() => { hub.set('item:fsE2', { id: 'fsE2', name: 'Fast-clock offline write' }); return { skew_s: Math.round(hub.skew / 1000), sync: hub.sync.state }; });
  await off.setOffline(false);
  await f3.evaluate(() => hub.flush());
  await sleep(1500);
  log('E2. phone clock +1 h, write made before any successful pull (offline from load), then online', { ...e2pre, serverRowAfter: await ahead('item:fsE2') });
  await sleep(500);
  const e2b = await putRaw('dad', 'item:fsE2', { id: 'fsE2', name: 'Dad raw now' }, Date.now());
  const e2c = await toolCall('dad', 'finish_leftover', { name: 'Fast-clock offline write' });
  log('E2b. after that, Dad raw PUT (Date.now) and Dad chat finish_leftover on item:fsE2', { dadPutApplied: e2b.body.applied, chatChip: e2c.chip, rowAfter: await ahead('item:fsE2') });

  fs.writeFileSync(path.join(OUT, 'verify-future-stamp-lock-2.json'), JSON.stringify(ev, null, 1));
  console.log('\nwrote audits/evidence/p2/PROF/verify-future-stamp-lock-2.json');
} finally { await L.close(); }
