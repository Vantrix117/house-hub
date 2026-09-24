// Completeness critic: hub.migrate gives person-scope legacy data to the first profile with kind 'adult' (hub.js:399),
// and guests are kind 'adult' (worker/src/index.js:170; publicProfile drops is_guest, hub.js:62). So on a device that
// still holds the pre-hub key tally.count, a guest who opens Tally first receives the household's legacy count, the
// device is marked migrated, and the household adult who opens Tally next on that device gets nothing.
// One phone (one localStorage) with tally.count = "23": Grandma Jo (guest) opens Tally, then Mom (no tally row) signs in
// on the same phone and opens Tally. Normal network, no holds.
// Run: node "audits/tools/phase3/tally/critic-guest-migrate.mjs"  -> audits/evidence/p3/tally/critic-guest-migrate.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const server = async pid => { const r = await L.apiAs(pid, '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
const ready = f => f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
try {
  const S = await L.sessions();
  const gid = Object.keys(S.sessions || S.info?.sessions || {}).find(s => s.startsWith('guest-grandmajo')) || 'guest-grandmajo';
  const ph = await L.newDevice({ name: 'Shared phone', profiles: [gid, 'mom'] });
  res.before = { guest: await server(gid).catch(e => String(e)), mom: await server('mom') };
  const d = await L.device({ device: 'iphone-pwa', profile: gid, fixedTime: false, as: ph, localStorage: { 'tally.count': '23' } });
  let f = await d.openApp('tally'); await ready(f); await sleep(2500);
  res.guest = { id: gid, who: await f.evaluate(() => document.getElementById('who').textContent), shows: await f.evaluate(() => document.getElementById('n').textContent),
    migratedMark: await d.page.evaluate(() => localStorage.getItem('hub.migrated')), serverGuest: await server(gid) };
  console.log('guest', JSON.stringify(res.guest));
  // Mom signs in on the same phone (same localStorage): swap the session the way the picker does, reopen Tally
  const me = await (await fetch(L.api + '/api/me', { headers: { 'X-Device-Token': ph.device.token, 'X-Profile-Token': ph.sessions.mom } })).json();
  await d.page.evaluate(s => { localStorage.setItem('hub.session', JSON.stringify(s)); localStorage.setItem('hub.lastProfile', JSON.stringify('mom')); }, { token: ph.sessions.mom, profile: me.profile });
  f = await d.openApp('tally'); await ready(f); await sleep(2500);
  res.mom = { who: await f.evaluate(() => document.getElementById('who').textContent), shows: await f.evaluate(() => document.getElementById('n').textContent),
    legacyStillOnDevice: await d.page.evaluate(() => localStorage.getItem('tally.count')), serverMom: await server('mom') };
  console.log('mom', JSON.stringify(res.mom));
  await d.close();
} finally {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(OUT + '/critic-guest-migrate.json', JSON.stringify(res, null, 2));
  await L.close();
}
