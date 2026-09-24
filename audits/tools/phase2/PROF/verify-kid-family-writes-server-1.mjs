// PROF skeptic #1 (audit Phase 2): re-check "kid (and guest) limits exist only in the UI: the Worker accepts any
// family-scope write from a kid session". Independent of api-matrix.mjs: it mints Ezra's token through the real
// POST /api/login (device token only, no PIN), writes with that token, reads back as Eli, and then checks in the apps
// (WebKit, local rig) whether each write actually takes effect — and which of them the UI itself already allows a kid.
//
//   node "audits/tools/phase2/PROF/verify-kid-family-writes-server-1.mjs"
//
// Everything runs on the rig's local Worker (worker/src on in-memory SQLite). Nothing touches production.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real' });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k.padEnd(44), typeof v === 'string' ? v : JSON.stringify(v)); };
const now = () => Date.now();
const pad = n => String(n).padStart(2, '0');
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
const readAs = async (who, app, key, scope = 'family') => { const r = await L.apiAs(who, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`); return r.body && r.body.item; };
const settle = async (f, ms = 2500) => { await f.evaluate(async () => { try { await hub.ready(); await hub.sync.pull?.(); } catch {} }).catch(() => {}); await sleep(ms); };

try {
  // ── A. a kid token needs nothing but a paired device ──
  const login = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'ezra' }, profileToken: null });
  log('A. POST /api/login ezra (no PIN)', `${login.status} kind=${login.body.profile && login.body.profile.kind}`);
  const EZ = login.body.profile_token;
  const ez = (p, method, body) => L.apiAs(null, p, { method, body, profileToken: EZ });

  // ── B. what the kid's own apps already let him do (UI, before any forged write) ──
  const kidPad = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
  const lf = await kidPad.openApp('leftovers', { wait: '.done' });
  await sleep(1500);
  log('B1. Larder as Ezra: canWrite / "used up" buttons', await lf.evaluate(() => ({ canWrite: hub.canWrite, kind: hub.profile.kind, doneButtons: document.querySelectorAll('button.done').length, addForm: !!document.querySelector('form#add') && getComputedStyle(document.querySelector('form#add')).display !== 'none' })));
  const mapBefore = await kidPad.openApp('dollywood-live');
  await settle(mapBefore, 3000);
  log('B2. Park map as Ezra before: VIEW_ONLY()', await mapBefore.evaluate(() => { try { return { viewOnly: VIEW_ONLY(), kidshare: hub.get('kidshare:' + hub.profile.id, { scope: 'family' }) ?? null }; } catch (e) { return 'err ' + e.message; } }));
  await kidPad.close();

  // Kiara's own (person-scope) stars before anything happens
  const kiBefore = await readAs('kiara', 'kidverse', 'stars', 'person');
  log('B3. Kiara person stars before', { total: kiBefore && kiBefore.value.total, earned: kiBefore && kiBefore.value.earned, payouts: kiBefore && kiBefore.value.payouts.length });

  // ── C. raw writes with Ezra's fresh token ──
  const W = [];
  const put = async (label, app, key, value) => { const r = await ez(`/api/data/${app}/${encodeURIComponent(key)}?scope=family`, 'PUT', { value, updated_at: now() }); W.push([label, r.status, r.body.applied, r.body.error]); return r; };
  const del = async (label, app, key) => { const r = await ez(`/api/data/${app}/${encodeURIComponent(key)}?scope=family`, 'DELETE'); W.push([label, r.status, r.body.applied, r.body.error]); return r; };
  const ledgerKey = 'ledger:kiara:skeptic1';
  await put('ledger cash-in against Kiara (by mom)', 'kidverse', ledgerKey, { kind: 'cashin', date: today, amount: 999, by: 'mom', at: now() });
  await put('own beacon kidshare:ezra = true', 'dollywood-live', 'kidshare:ezra', true);
  await put('family meeting point', 'dollywood-live', 'meet', { x: 500, y: 700, name: 'Candy shop', note: '', by: 'dad', byName: 'David', at: now() });
  await put('reminder signed Elizabeth', 'reminders', 'item:skeptic1', { id: 'skeptic1', text: 'No bedtime tonight', by: 'mom', byName: 'Elizabeth', createdAt: now() });
  const rems = ((await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items || []).filter(i => i.value != null && i.key !== 'item:skeptic1');
  await del('clear a seeded reminder', 'reminders', rems[0].key);
  await put('family verse week → 52', 'kidverse', 'week', { week: 52, by: 'eli', at: now() });
  const album = ((await L.apiAs('eli', '/api/data/hub?scope=family&prefix=album:')).body.items || []).find(i => i.value != null && i.value.by !== 'ezra');
  const albumApi = await L.apiAs(null, `/api/album/${album.value.id || album.key.slice(6)}`, { method: 'DELETE', profileToken: EZ });   // the dedicated route first (row still there)
  await del(`delete ${album.value.by}'s album row`, 'hub', album.key);
  for (const w of W) console.log('   C. ezra ' + w[0].padEnd(40), '→', w[1], w[3] || '', 'applied=' + w[2]);
  out.C = W;
  log('C'.padEnd(3) + '(same album photo via DELETE /api/album as Ezra)', `${albumApi.status} ${albumApi.body.error || ''}`);

  // read back as Eli
  log('C1. stored ledger row (read as Eli)', (await readAs('eli', 'kidverse', ledgerKey)).value);
  log('C2. stored kidshare:ezra', (await readAs('eli', 'dollywood-live', 'kidshare:ezra')).value);
  log('C3. stored meet', (await readAs('eli', 'dollywood-live', 'meet')).value);
  log('C4. reminder shown as by', (await readAs('eli', 'reminders', 'item:skeptic1')).value.byName);
  log('C5. seeded reminder now', (await readAs('eli', 'reminders', rems[0].key)).value);
  log('C6. family verse week now', (await readAs('eli', 'kidverse', 'week')).value);
  log('C7. album row now', (await readAs('eli', 'hub', album.key)).value);

  // ── D. do the forged rows take effect in the apps? ──
  // D1: Kiara opens Kid Verse on her own device: her app applies the forged "parent" cash-in to her own stars row
  const kiPad = await L.device({ device: 'ipad-portrait', profile: 'kiara', fixedTime: false });
  const kv = await kiPad.openApp('kidverse');
  await settle(kv, 5000);
  await kiPad.close();
  await sleep(1500);
  const kiAfter = await readAs('kiara', 'kidverse', 'stars', 'person');
  log('D1. Kiara person stars after she opens Kid Verse', { total: kiAfter.value.total, earned: kiAfter.value.earned, lastPayout: kiAfter.value.payouts.at(-1), appliedForged: !!kiAfter.value.applied[ledgerKey] });
  // D2: Ezra's park map is no longer view-only
  const kidPad2 = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
  const map2 = await kidPad2.openApp('dollywood-live');
  await settle(map2, 3000);
  log('D2. Park map as Ezra after: VIEW_ONLY()', await map2.evaluate(() => { try { return { viewOnly: VIEW_ONLY(), kidshare: hub.get('kidshare:' + hub.profile.id, { scope: 'family' }) ?? null, shareRow: !!document.getElementById('lv-share') }; } catch (e) { return 'err ' + e.message; } }));
  // D3: the investigator's object value {on:true} would not have switched the beacon on (the map tests === true)
  await ez(`/api/data/dollywood-live/kidshare:ezra?scope=family`, 'PUT', { value: { on: true, by: 'eli', at: now() }, updated_at: now() });
  await map2.evaluate(() => location.reload()).catch(() => {});
  await sleep(1500);
  const map3 = kidPad2.frame('dollywood-live') || (await kidPad2.openApp('dollywood-live'));
  await settle(map3, 3000);
  log('D3. with value {on:true} instead: VIEW_ONLY()', await map3.evaluate(() => { try { return { viewOnly: VIEW_ONLY(), kidshare: hub.get('kidshare:' + hub.profile.id, { scope: 'family' }) }; } catch (e) { return 'err ' + e.message; } }));
  await kidPad2.close();

  // ── E. the chat path: does chat hold the kid rules the finding says the server lacks? ──
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name: 'set_data', input: { app_id: 'dollywood-live', scope: 'family', key: 'kidshare:kiara', value: true } }] }, { text: 'Done.' }]);
  const chat = await L.apiAs(null, '/api/chat', { method: 'POST', body: { message: "turn on Kiara's beacon", apps: reg }, profileToken: EZ });
  const chatText = typeof chat.body === 'string' ? chat.body : JSON.stringify(chat.body);
  const log1 = JSON.stringify(await L.anthropicLog());
  log('E1. chat as Ezra set_data kidshare:kiara', `${chat.status} chip=${(chatText.match(/✓[^"\\]*/) || ['(none)'])[0]} refusedToModel=${/Kids cannot/.test(log1)}`);
  log('E2. stored kidshare:kiara after chat', (await readAs('eli', 'dollywood-live', 'kidshare:kiara'))?.value ?? null);
  await L.anthropic([{ tools: [{ name: 'add_list_item', input: { app_id: 'reminders', item: { text: 'chat reminder' } } }] }, { text: 'ok' }]);
  const chat2 = await L.apiAs(null, '/api/chat', { method: 'POST', body: { message: 'remind everyone', apps: reg }, profileToken: EZ });
  const c2 = typeof chat2.body === 'string' ? chat2.body : JSON.stringify(chat2.body);
  const log2 = JSON.stringify(await L.anthropicLog());
  log('E3. chat as Ezra add reminder', `${chat2.status} chip=${(c2.match(/✓[^"\\]*/) || ['(none)'])[0]} refusedToModel=${/Kids cannot add reminders/.test(log2)}`);

  // ── F. guests in the park map: is the kids' beacon switch offered to a guest by the UI itself? ──
  const gPad = await L.device({ device: 'ipad-portrait', profile: 'guest-grandmajo', fixedTime: false });
  const gm = await gPad.openApp('dollywood-live');
  await settle(gm, 3000);
  log('F1. park map as guest: kind / is_guest / beacon-switch condition', await gm.evaluate(() => ({ id: hub.profile.id, name: hub.profile.name, kind: hub.profile.kind, isGuest: !!(hub.profile.is_guest || hub.profile.isGuest), canWrite: hub.canWrite, showsKidsBeaconsSwitch: hub.profile.kind === 'adult' && hub.canWrite })));
  await gPad.close();

  fs.writeFileSync(path.join(OUT, 'verify-kid-family-writes-server-1.json'), JSON.stringify({ at: new Date().toISOString(), ...out }, null, 1));
  console.log('\nwrote audits/evidence/p2/PROF/verify-kid-family-writes-server-1.json');
} finally { await L.close(); }
