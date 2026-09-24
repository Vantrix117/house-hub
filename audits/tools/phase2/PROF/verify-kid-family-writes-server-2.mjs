// PROF skeptic #2 for finding "kid-family-writes-server": does /api/data enforce anything for kids and guests beyond the
// kiosk check, and which of the listed writes are really UI-only limits (versus things the UI itself allows)?
// Fresh local instance (the real worker/src on in-memory SQLite). Nothing touches production.
//
//   node "audits/tools/phase2/PROF/verify-kid-family-writes-server-2.mjs"
//
// Writes audits/evidence/p2/PROF/verify-kid-family-writes-server-2.json
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const log = [];
const say = (...a) => { const s = a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); log.push(s); console.log(s); };
const now = () => Date.now();
const api = (who, p, method = 'GET', body) => L.apiAs(who, p, { method, body });
const val = async (app, key, scope = 'family', who = 'eli') => { const r = await api(who, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`); return r.body && r.body.item ? r.body.item.value : undefined; };
const fam = async app => ((await api('eli', `/api/data/${app}?scope=family`)).body.items || []).filter(i => i.value != null).map(i => i.key);
const line = (who, what, r) => say(`${who.padEnd(15)} ${what.padEnd(58)} → ${r.status}${r.body && r.body.error ? ' ' + r.body.error : ''}${r.body && r.body.applied !== undefined ? ' applied=' + r.body.applied : ''}`);

try {
  say('── A. Controls: the server does enforce the kiosk and the dedicated routes ──');
  line('tv (kiosk)', 'PUT reminders/item:tv family', await api('tv', '/api/data/reminders/item:tv?scope=family', 'PUT', { value: { text: 'x' }, updated_at: now() }));
  line('ezra (kid)', 'POST /api/dollywood/rally', await api('ezra', '/api/dollywood/rally', 'POST', { name: 'Candy', x: 1, y: 1 }));
  line('ezra (kid)', 'POST /api/album', await api('ezra', '/api/album', 'POST', { sm: 'x', lg: 'x' }));
  const albums = (await fam('hub')).filter(k => k.startsWith('album:'));
  const a0 = albums[0];
  line('ezra (kid)', `DELETE /api/album/${a0.slice(6)} (not his)`, await api('ezra', `/api/album/${a0.slice(6)}`, 'DELETE'));

  say('\n── B. The same things through the generic /api/data as the kid ──');
  line('ezra (kid)', 'PUT dollywood-live/meet family', await api('ezra', '/api/data/dollywood-live/meet?scope=family', 'PUT', { value: { x: 10, y: 10, name: 'Candy shop', note: '', by: 'dad', byName: 'David', at: now() }, updated_at: now() }));
  say('   meet now =', await val('dollywood-live', 'meet'));
  line('ezra (kid)', `DELETE hub/${a0} (someone else\'s photo row)`, await api('ezra', `/api/data/hub/${a0}?scope=family`, 'DELETE'));
  say(`   ${a0} now =`, await val('hub', a0));
  line('ezra (kid)', 'PUT hub/album:forged family', await api('ezra', '/api/data/hub/album:forged?scope=family', 'PUT', { value: { id: 'forged', sm: '/x', lg: '/x', by: 'eli', byName: 'Eli', caption: 'forged', at: now() }, updated_at: now() }));
  line('ezra (kid)', 'PUT dollywood-live/kidshare:ezra = true', await api('ezra', '/api/data/dollywood-live/kidshare:ezra?scope=family', 'PUT', { value: true, updated_at: now() }));
  say('   kidshare:ezra now =', await val('dollywood-live', 'kidshare:ezra'), '(apps/dollywood-live.html:693 treats === true as "beacon on")');
  line('ezra (kid)', 'PUT dollywood-live/loc:mom', await api('ezra', '/api/data/dollywood-live/loc:mom?scope=family', 'PUT', { value: { x: 1, y: 1, at: now() }, updated_at: now() }));
  const rem = await fam('reminders');
  line('ezra (kid)', 'PUT reminders/item:kid-rem (byName Elizabeth)', await api('ezra', '/api/data/reminders/item:kid-rem?scope=family', 'PUT', { value: { id: 'kid-rem', text: 'No bedtime tonight', by: 'mom', byName: 'Elizabeth', createdAt: now() }, updated_at: now() }));
  if (rem[0]) line('ezra (kid)', `DELETE reminders/${rem[0]}`, await api('ezra', `/api/data/reminders/${rem[0]}?scope=family`, 'DELETE'));
  line('ezra (kid)', 'PUT kidverse/week family', await api('ezra', '/api/data/kidverse/week?scope=family', 'PUT', { value: { week: 52 }, updated_at: now() }));
  line('ezra (kid)', 'PUT f260/anything family (f260 not visible to kids)', await api('ezra', '/api/data/f260/anything?scope=family', 'PUT', { value: 1, updated_at: now() }));
  const prayers = (await fam('prayer')).filter(k => k.startsWith('prayer:'));
  const wipe = await api('ezra', '/api/data/prayer/batch?scope=family', 'POST', { items: prayers.map(k => ({ key: k, value: null, updated_at: now() })) });
  line('ezra (kid)', `POST prayer/batch tombstone all ${prayers.length} family prayers`, wipe);
  say('   family prayers left after the batch =', (await fam('prayer')).filter(k => k.startsWith('prayer:')).length, 'of', prayers.length);

  say('\n── C. Stars: a forged parent cash-in for Kiara, applied by Kiara\'s own Kid Verse ──');
  const kBefore = await val('kidverse', 'stars', 'person', 'kiara');
  say('   kiara stars (person) before: total =', kBefore && kBefore.total, 'earned =', kBefore && kBefore.earned, 'payouts =', kBefore && (kBefore.payouts || []).length);
  const lk = 'ledger:kiara:forged-' + now().toString(36);
  line('ezra (kid)', `PUT kidverse/${lk} {kind:cashin, by:'eli'}`, await api('ezra', `/api/data/kidverse/${lk}?scope=family`, 'PUT', { value: { kind: 'cashin', date: new Date().toISOString().slice(0, 10), amount: 99, by: 'eli', at: now() }, updated_at: now() }));
  const kd = await L.device({ device: 'ipad-portrait', profile: 'kiara', fixedTime: false });
  const f = await kd.openApp('kidverse');
  let kAfter;
  for (let i = 0; i < 40; i++) { await sleep(500); kAfter = await val('kidverse', 'stars', 'person', 'kiara'); if (kAfter && kAfter.applied && kAfter.applied[lk]) break; }
  say('   kiara stars (person) after she opened Kid Verse: total =', kAfter && kAfter.total, '| applied[forged] =', !!(kAfter && kAfter.applied && kAfter.applied[lk]), '| last payout =', kAfter && (kAfter.payouts || []).slice(-1)[0]);
  const mirror = await val('kidverse', 'stars:kiara');
  say('   mirror stars:kiara total =', mirror && mirror.total);
  await kd.close();

  say('\n── D. Which limits are UI-only, and which the UI itself allows ──');
  const ez = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
  const lf = await ez.openApp('leftovers');
  await lf.waitForSelector('.card, .empty', { timeout: 10000 }).catch(() => {});
  await sleep(1500);
  const kidLarder = await lf.evaluate(() => ({ kind: hub.profile.kind, canWrite: hub.canWrite, doneButtons: document.querySelectorAll('button.done').length, addFormVisible: !!document.querySelector('form#add') && getComputedStyle(document.querySelector('form#add')).display !== 'none' }));
  say('   Ezra in the Larder UI:', kidLarder, '(apps/leftovers.html:180, 275-282 — kids get "Mark used up" buttons)');
  await ez.close();
  const gd = await L.device({ device: 'ipad-portrait', profile: 'guest-grandmajo', fixedTime: false });
  await gd.goto('#home'); await sleep(2000);
  const guest = await gd.page.evaluate(() => ({ id: hub.profile && hub.profile.id, kind: hub.profile && hub.profile.kind, canWrite: hub.canWrite }));
  say('   Grandma Jo (guest) in the shell:', guest, "→ park map Family pane shows Kids' beacons switches when kind==='adult'&&canWrite (apps/dollywood-live.html:1307)");
  await gd.close();
  line('guest-grandmajo', 'PUT dollywood-live/kidshare:kiara = true', await api('guest-grandmajo', '/api/data/dollywood-live/kidshare:kiara?scope=family', 'PUT', { value: true, updated_at: now() }));
  line('guest-grandmajo', 'PUT kidverse/ledger:ezra:g1 cashin', await api('guest-grandmajo', '/api/data/kidverse/ledger:ezra:g1?scope=family', 'PUT', { value: { kind: 'cashin', date: '2026-09-24', amount: 3, by: 'guest-grandmajo', at: now() }, updated_at: now() }));

  fs.writeFileSync(path.join(OUT, 'verify-kid-family-writes-server-2.json'), JSON.stringify({ at: new Date().toISOString(), log }, null, 1));
  say('\nwrote audits/evidence/p2/PROF/verify-kid-family-writes-server-2.json');
} finally { await L.close(); }
