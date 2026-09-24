// PROF (audit Phase 2): what the Worker itself enforces for kids, the kiosk, guests and non-admin adults.
// Every call goes to the rig's local Worker (the real worker/src code on in-memory SQLite). Nothing touches production.
//
//   node "audits/tools/phase2/PROF/api-matrix.mjs"
//
// Prints one line per call: who, method, path, status, error code, and (for writes) whether the row landed.
// Writes the full table to audits/evidence/p2/PROF/api-matrix.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real' });
const rows = [];
const now = () => Date.now();
async function call(who, method, p, body, opts = {}) {
  const r = await L.apiAs(who, p, { method, body, ...opts });
  const row = { who: who || '(device only)', method, path: p, status: r.status, error: r.body && r.body.error, applied: r.body && r.body.applied, note: opts.note || '' };
  rows.push(row);
  console.log(`${row.who.padEnd(16)} ${method.padEnd(6)} ${p.padEnd(62)} → ${r.status} ${row.error || ''}${row.applied !== undefined ? ' applied=' + row.applied : ''}${row.note ? '  # ' + row.note : ''}`);
  return r;
}
const val = async (app, key, scope = 'family', who = 'eli') => {
  const r = await L.apiAs(who, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`);
  return r.body && r.body.item ? r.body.item.value : undefined;
};

try {
  // ── what exists in the typical seed (family rows kids should not be able to change) ──
  const fam = async app => ((await L.apiAs('eli', `/api/data/${app}?scope=family`)).body.items || []).filter(i => i.value != null).map(i => i.key);
  const left = await fam('leftovers'), rem = await fam('reminders'), kv = await fam('kidverse'), hubf = await fam('hub'), dwl = await fam('dollywood-live'), pr = await fam('prayer');
  console.log('seed family keys: leftovers', left.length, '| reminders', rem.length, '| kidverse', kv.join(','), '| hub', hubf.slice(0, 3).join(','), '| dollywood-live', dwl.join(','), '| prayer', pr.length);

  console.log('\n── 1. Kid (Ezra) through the raw data API ──');
  const lv0 = left[0];
  await call('ezra', 'DELETE', `/api/data/leftovers/${lv0}?scope=family`, undefined, { note: 'tombstone a family fridge item' });
  console.log('   leftovers', lv0, 'after kid DELETE →', JSON.stringify(await val('leftovers', lv0)));
  await call('ezra', 'PUT', `/api/data/reminders/item:kid-rem?scope=family`, { value: { id: 'kid-rem', text: 'No bedtime tonight', by: 'mom', byName: 'Elizabeth', createdAt: now() }, updated_at: now() }, { note: 'reminder forged as Elizabeth (chat refuses kids reminders)' });
  console.log('   reminders item:kid-rem →', JSON.stringify(await val('reminders', 'item:kid-rem')));
  if (rem[0]) await call('ezra', 'DELETE', `/api/data/reminders/${rem[0]}?scope=family`, undefined, { note: 'clear a family reminder (UI shows Done only to adults)' });
  await call('ezra', 'PUT', `/api/data/dollywood-live/meet?scope=family`, { value: { x: 10, y: 10, name: 'Candy shop', note: '', by: 'dad', byName: 'David', at: now() }, updated_at: now() }, { note: 'family meeting point (rally route is household-adults-only)' });
  await call('ezra', 'PUT', `/api/data/dollywood-live/kidshare:ezra?scope=family`, { value: { on: true, by: 'eli', at: now() }, updated_at: now() }, { note: "switch on own beacon (an adult's switch)" });
  await call('ezra', 'PUT', `/api/data/dollywood-live/loc:mom?scope=family`, { value: { x: 1, y: 1, at: now(), name: 'Elizabeth' }, updated_at: now() }, { note: "move Mom's park marker" });
  await call('ezra', 'PUT', `/api/data/hub/album:fake1?scope=family`, { value: { id: 'fake1', sm: '/api/media/album/x-256.jpg', lg: '/api/media/album/x-1024.jpg', by: 'eli', byName: 'Eli', caption: 'forged', at: now() }, updated_at: now() }, { note: 'album row (POST /api/album is adults-only)' });
  if (hubf.find(k => k.startsWith('album:'))) await call('ezra', 'DELETE', `/api/data/hub/${hubf.find(k => k.startsWith('album:'))}?scope=family`, undefined, { note: "remove someone else's album photo row (DELETE /api/album says not_yours)" });
  await call('ezra', 'PUT', `/api/data/kidverse/ledger:kiara:k1?scope=family`, { value: { kind: 'cashin', date: '2026-09-24', amount: 99, by: 'eli', at: now() }, updated_at: now() }, { note: "kid writes a parent's cash-in ledger row for his sister" });
  await call('ezra', 'PUT', `/api/data/kidverse/stars:kiara?scope=family`, { value: { week: '2026-W39', count: 0, total: 0, earned: 0 }, updated_at: now() }, { note: "zero sister's star mirror (only Kid Verse as Kiara should write)" });
  await call('ezra', 'PUT', `/api/data/kidverse/stars:ezra?scope=family`, { value: { week: '2026-W39', count: 7, total: 500, earned: 500 }, updated_at: now() }, { note: 'own mirror: 500 stars to cash in' });
  await call('ezra', 'PUT', `/api/data/kidverse/week?scope=family`, { value: { week: 52, by: 'ezra', at: now() }, updated_at: now() }, { note: "family memory-verse week (adult stepper only)" });
  await call('ezra', 'PUT', `/api/data/f260/anything?scope=family`, { value: { x: 1 }, updated_at: now() }, { note: 'family row for an app kids cannot see (f260 visibleTo excludes kids)' });
  await call('ezra', 'PUT', `/api/data/prayer/prayer:kidadd?scope=family`, { value: { id: 'kidadd', title: 'forged request', status: 'active' }, updated_at: now() }, { note: 'kid prayer UI has no inputs' });
  await call('ezra', 'POST', `/api/data/leftovers/batch?scope=family`, { items: left.slice(1, 4).map(k => ({ key: k, value: null, updated_at: now() })) }, { note: 'batch-tombstone 3 fridge items' });
  await call('ezra', 'PUT', `/api/data/nosuchapp/x?scope=family`, { value: 1, updated_at: now() }, { note: 'an app id that does not exist' });
  await call('ezra', 'PUT', `/api/data/leftovers/item:future?scope=family`, { value: { id: 'future', name: 'future-stamped' }, updated_at: now() + 3600e3 }, { note: 'updated_at 1 h ahead (server clamps to +5 min)' });
  const fut = (await L.apiAs('eli', `/api/data/leftovers?scope=family&key=item:future`)).body.item;
  console.log('   item:future stored updated_at − now =', Math.round((fut.updated_at - now()) / 1000), 's');
  const adultFix = await call('mom', 'PUT', `/api/data/leftovers/item:future?scope=family`, { value: { id: 'future', name: 'Mom fixed it' }, updated_at: now() }, { note: 'an adult writes the same row 1 s later with a normal clock' });
  console.log('   → adult write applied =', adultFix.body.applied, '; row now', JSON.stringify(await val('leftovers', 'item:future')));

  console.log('\n── 2. Person scope: always the caller\'s own ──');
  await call('ezra', 'PUT', `/api/data/f260/f260.summary?scope=person&profile_id=eli`, { value: { week: 1, weekDone: 0, forged: true }, updated_at: now() + 1000 }, { note: 'profile_id param ignored?' });
  const eliSum = await val('f260', 'f260.summary', 'person', 'eli');
  const ezSum = await val('f260', 'f260.summary', 'person', 'ezra');
  console.log('   eli f260.summary forged?', !!(eliSum && eliSum.forged), '| written to ezra\'s own scope?', !!(ezSum && ezSum.forged));
  await call('ezra', 'GET', `/api/data/f260?scope=person`, undefined, { note: 'reads only own person rows' });

  console.log('\n── 3. Reads without a profile ──');
  await call(null, 'GET', `/api/data/reminders?scope=family`, undefined, { note: 'device token only' });
  await call(null, 'GET', `/api/data/f260?scope=person`, undefined, { note: 'device token only, person scope' });
  await call(null, 'GET', `/api/data/reminders?scope=family`, undefined, { deviceToken: null, note: 'no device token' });
  await call(null, 'GET', `/api/activity?limit=3`, undefined, { note: 'feed with device token only' });

  console.log('\n── 4. Other kid routes ──');
  await call('ezra', 'POST', '/api/profiles', { name: 'Kid guest' }, { note: 'add a guest' });
  await call('ezra', 'PUT', '/api/profiles/ezra/photo', { sm: 'x', lg: 'x' }, { note: 'own photo' });
  await call('ezra', 'DELETE', '/api/profiles/kiara/photo', undefined, { note: "sister's photo" });
  await call('ezra', 'POST', '/api/album', { sm: 'x', lg: 'x' }, { note: 'album upload' });
  await call('ezra', 'POST', '/api/dollywood/rally', { name: 'Candy', x: 1, y: 1 }, { note: 'rally' });
  await call('ezra', 'POST', '/api/activity', { app_id: 'leftovers', text: 'Threw out everything in the fridge' }, { note: 'arbitrary feed line under any app' });
  await call('ezra', 'POST', '/api/profiles/niece/pin', { pin: '4321' }, { profileToken: null, note: "claim Mea's unset adult PIN from the kitchen iPad (device token only)" });
  const meaMe = rows.at(-1).status === 200;
  if (meaMe) {
    const tok = (await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: '4321' } })).body; // second try shows it is now taken
    console.log('   second claim →', tok.error);
  }

  console.log('\n── 5. Kiosk (Downstairs TV) session ──');
  await call('tv', 'PUT', `/api/data/reminders/item:tv?scope=family`, { value: { id: 'tv', text: 'tv' }, updated_at: now() });
  await call('tv', 'DELETE', `/api/data/reminders/${rem[1] || 'item:x'}?scope=family`);
  await call('tv', 'POST', `/api/data/reminders/batch?scope=family`, { items: [{ key: 'item:tv2', value: { text: 'tv2' }, updated_at: now() }] });
  await call('tv', 'PUT', `/api/data/hub/theme?scope=person`, { value: 'forest', updated_at: now() }, { note: 'own person-scope pref' });
  await call('tv', 'POST', '/api/activity', { text: 'TV says hi' });
  await call('tv', 'POST', '/api/album', { sm: 'x', lg: 'x' });
  await call('tv', 'PUT', '/api/profiles/tv/photo', { sm: 'x', lg: 'x' });
  await call('tv', 'DELETE', '/api/profiles/tv/photo');
  await call('tv', 'POST', '/api/profiles', { name: 'TV guest' });
  await call('tv', 'POST', '/api/chat', { message: 'hi', apps: [] });
  await call('tv', 'GET', '/api/chat/history');
  await call('tv', 'POST', '/api/dollywood/rally', { name: 'x', x: 1, y: 1 });
  await call('tv', 'POST', '/api/push/subscribe', { subscription: { endpoint: 'http://127.0.0.1:9/tv-sub', keys: { p256dh: 'x', auth: 'y' } } }, { note: 'kiosk push subscription' });
  await call('tv', 'POST', '/api/push/test', {}, { note: 'kiosk test push' });
  await call('tv', 'DELETE', '/api/push/subscribe');
  await call('tv', 'GET', '/api/data/reminders?scope=family', undefined, { note: 'reads family' });

  console.log('\n── 6. Every /api/admin/* route as non-admins ──');
  const ADMIN = [
    ['POST', '/api/admin/profiles/christian/reset-pin', {}],
    ['PUT', '/api/admin/profiles/ezra', { name: 'Ezra', kind: 'adult' }],
    ['DELETE', '/api/admin/profiles/guest-grandmajo'],
    ['POST', '/api/admin/profiles/guest-grandmajo/purge', {}],
    ['POST', '/api/admin/guests/purge', {}],
    ['POST', '/api/admin/pairing-code/rotate', { code: 'pwned-code' }],
    ['GET', '/api/admin/usage'],
    ['POST', '/api/admin/cron/run', { job: 'morning' }],
    ['DELETE', '/api/admin/devices/rig-kitchen-ipad'],
    ['POST', '/api/push/test', { profile_id: 'mom' }],
  ];
  const matrix = {};
  for (const who of ['christian', 'ezra', 'guest-grandmajo', 'tv', null]) {
    for (const [m, p, b] of ADMIN) {
      const r = await L.apiAs(who, p, { method: m, body: b });
      (matrix[p + ' ' + m] ||= {})[who || '(no profile)'] = r.status + (r.body && r.body.error ? ' ' + r.body.error : '');
      rows.push({ who: who || '(device only)', method: m, path: p, status: r.status, error: r.body && r.body.error, note: 'admin route' });
    }
  }
  console.table(matrix);

  console.log('\n── 7. Guest (Grandma Jo) ──');
  await call('guest-grandmajo', 'POST', '/api/profiles', { name: 'Friend' });
  await call('guest-grandmajo', 'POST', '/api/dollywood/rally', { name: 'x', x: 1, y: 1 });
  await call('guest-grandmajo', 'POST', '/api/profiles/guest-grandmajo/pin', { pin: '1234' }, { profileToken: null });
  await call('guest-grandmajo', 'PUT', `/api/data/dollywood-live/kidshare:kiara?scope=family`, { value: { on: true, by: 'guest-grandmajo', at: now() }, updated_at: now() }, { note: "a guest switches on a kid's beacon" });
  await call('guest-grandmajo', 'PUT', `/api/data/kidverse/ledger:ezra:g1?scope=family`, { value: { kind: 'cashin', date: '2026-09-24', amount: 3, by: 'guest-grandmajo', at: now() }, updated_at: now() }, { note: "cash in a kid's stars (Me hides Kids' rewards from guests)" });

  console.log('\n── 8. The admin can reset their own PIN, and the admin profile is then claimable ──');
  await call('eli', 'POST', '/api/admin/profiles/eli/reset-pin', {}, { note: 'Eli resets his own PIN' });
  await call('eli', 'GET', '/api/me', undefined, { note: "Eli's own session after the reset" });
  const claim = await L.apiAs('ezra', '/api/profiles/eli/pin', { method: 'POST', body: { pin: '0000' }, profileToken: null });
  rows.push({ who: 'ezra (device only)', method: 'POST', path: '/api/profiles/eli/pin', status: claim.status, error: claim.body.error, note: 'claim the admin' });
  console.log('ezra device    POST   /api/profiles/eli/pin {pin:0000} →', claim.status, claim.body.error || '', claim.body.profile ? `is_admin=${claim.body.profile.is_admin}` : '');
  if (claim.body.profile_token) {
    const u = await L.apiAs(null, '/api/admin/usage', { profileToken: claim.body.profile_token });
    console.log('   with that token GET /api/admin/usage →', u.status, Object.keys(u.body || {}).join(','));
    rows.push({ who: 'claimed-eli', method: 'GET', path: '/api/admin/usage', status: u.status, note: 'admin via a claimed PIN' });
  }
  fs.writeFileSync(path.join(OUT, 'api-matrix.json'), JSON.stringify({ at: new Date().toISOString(), rows, adminMatrix: matrix }, null, 1));
  console.log('\nwrote', path.relative(ROOT, path.join(OUT, 'api-matrix.json')));
} finally { await L.close(); }
