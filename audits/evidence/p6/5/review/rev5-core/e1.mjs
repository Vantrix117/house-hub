// rev5-core experiments: E1 Undo vs a not-yet-pulled newer write; E2 streak resurrection; E3 text-row policy.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'empty', clock: 'real' });
const NY = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const today = NY(Date.now());
const D = n => new Date(Date.parse(today + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const put = (who, app, key, value, scope = 'person', updated_at = Date.now()) => L.apiAs(who, `/api/data/${app}/${encodeURIComponent(key)}?scope=${scope}`, { method: 'PUT', body: { value, updated_at } });
const get = async (who, app, key, scope = 'person') => { const r = await L.apiAs(who, `/api/data/${app}?scope=${scope}`); const items = r.body.items || r.body; const it = (Array.isArray(items) ? items : []).find(i => i.key === key); return it ? { value: it.value, updated_at: it.updated_at } : null; };
const out = {};
try {
  // ── E1 ──
  console.log('E1 setup', (await put('eli', 'f260', 'mem:1-0', true)).status);
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await A.page.goto(L.site + '/apps/verses.html');
  await A.page.waitForFunction(() => window.verses && hub.isLoaded() && hub.isLoaded('f260', 'person') && verses.current() === '1-0', null, { timeout: 20000 });
  await A.page.evaluate(() => { verses.reveal(); return verses.rate('got'); });
  await sleep(2500);
  out.e1_afterRate = await get('eli', 'f260', 'recall:1-0');
  const B = { s: 'got', t: Date.now(), box: 5, due: '2099-01-01', last: today, streak: 9, marker: 'device-B' };
  out.e1_putB = (await put('eli', 'f260', 'recall:1-0', B)).status;
  await sleep(200);
  out.e1_undo = await A.page.evaluate(() => verses.undo());
  await sleep(2500);
  out.e1_serverAfterUndo = await get('eli', 'f260', 'recall:1-0');
  out.e1_clobbered = !(out.e1_serverAfterUndo && out.e1_serverAfterUndo.value && out.e1_serverAfterUndo.value.marker === 'device-B');
  await A.close();

  // ── E2 ──  Mae: one verse, Not yet two days ago (due yesterday), yesterday missed, reviews D-3 and D-2
  await put('christian', 'f260', 'mem:2-0', true, 'person', Date.now() - 10 * 86400000);
  await put('christian', 'f260', 'recall:2-0', { s: 'not', t: Date.now() - 2 * 86400000, box: 1, due: D(-1), last: D(-2), streak: 0 });
  await put('christian', 'verses', `rev:${D(-2)}:2-0:x`, 1);
  await put('christian', 'verses', `rev:${D(-3)}:2-0:x`, 1);
  const M = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false });
  await M.page.goto(L.site + '/apps/verses.html');
  await M.page.waitForFunction(() => window.verses && hub.isLoaded() && hub.isLoaded('f260', 'person') && verses.current() === '2-0', null, { timeout: 20000 });
  out.e2_before = await M.page.evaluate(() => ({ streak: verses.dayStreak(), stat: document.querySelector('#st-streak').textContent, due: verses.dueIds() }));
  await M.page.evaluate(() => { verses.reveal(); return verses.rate('got'); });
  await sleep(1200);
  out.e2_after = await M.page.evaluate(() => ({ streak: verses.dayStreak(), stat: document.querySelector('#st-streak').textContent, summary: hub.get('summary') }));
  await M.close();

  // ── E3 ── the household text row from each kind of profile
  const tv = { text: 'PLACEHOLDER TEXT', by: 'x', at: Date.now() };
  for (const who of ['niece', 'ezra', 'kiara', 'tv']) out['e3_' + who] = (await put(who, 'verses', 'text:1-0', tv, 'family')).status + ' ' + JSON.stringify((await put(who, 'verses', 'text:1-0', tv, 'family')).body).slice(0, 80);
  for (const who of ['ezra', 'tv']) out['e3_delete_' + who] = (await L.apiAs(who, '/api/data/verses/text:1-0?scope=family', { method: 'DELETE' })).status;
  const kd = await L.newDevice({ name: 'Kitchen try', profiles: ['kitchen'] });
  out.e3_kitchen = await L.apiAs('kitchen', '/api/data/verses/text:1-0?scope=family', { method: 'PUT', body: { value: tv, updated_at: Date.now() }, deviceToken: kd.device.token, profileToken: kd.sessions.kitchen }).then(r => r.status + ' ' + JSON.stringify(r.body).slice(0, 100));
  const g = await L.apiAs('eli', '/api/profiles', { method: 'POST', body: { name: 'Aunt Sue', emoji: '🌻', color: '#137F77', expires_at: Date.now() + 86400000 } });
  out.e3_guestCreate = g.status;
  const gid = g.body && (g.body.profile ? g.body.profile.id : g.body.id);
  const gd = await L.newDevice({ name: 'Guest phone', profiles: [gid] });
  out.e3_guest = await L.apiAs(null, '/api/data/verses/text:1-1?scope=family', { method: 'PUT', body: { value: tv, updated_at: Date.now() }, deviceToken: gd.device.token, profileToken: gd.sessions[gid] }).then(r => r.status);
  // a kid writing a "summary" or arbitrary family key in verses
  out.e3_kid_family_other = (await put('ezra', 'verses', 'summary', { x: 1 }, 'family')).status;
  out.e3_adult_family_junk = (await put('niece', 'verses', 'anything', { x: 1 }, 'family')).status;
  out.e3_adult_huge_text = (await put('niece', 'verses', 'text:2-1', { text: 'A'.repeat(60000), by: 'niece', at: 1 }, 'family')).status;
} catch (e) { console.error(e); }
console.log(JSON.stringify(out, null, 1));
await L.close();
