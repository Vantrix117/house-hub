// Skeptic #2 (intent/context lens) for "a guest who opens Tally first receives the household's legacy tally.count".
// Arm A: one phone with legacy tally.count = "23" and no hub.migrated. Grandma Jo (guest, no PIN) opens Tally first;
//   then the phone's session becomes Mom's (what the picker's hub.setSession leaves behind) and Mom opens Tally.
// Arm B (control): a fresh phone with the same legacy key; Mom opens Tally first. Shows that only the guest's
//   earlier open made Mom miss the migration.
// Also records whether the guest flag was available to the app (hub.session.profile.is_guest vs hub.profile).
// Run: node "audits/tools/phase3/tally/verify-critic-guest-gets-legacy-migration-2-2.mjs"
//   -> audits/evidence/p3/tally/verify-critic-guest-gets-legacy-migration-2-2.json (+ -guest.png, -mom.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally', NAME = 'verify-critic-guest-gets-legacy-migration-2-2';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const serverCount = async pid => { const r = await L.apiAs(pid, '/api/data/tally?scope=person'); const b = r.body || r; const it = (b.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
const waitWho = f => f.waitForFunction(() => (document.getElementById('who')?.textContent || '').trim().length > 0, null, { timeout: 10000 });
const snap = async (d, f) => ({
  who: await f.evaluate(() => document.getElementById('who').textContent),
  shows: await f.evaluate(() => document.getElementById('n').textContent),
  profileSeenByApp: await f.evaluate(() => hub.profile),
  sessionIsGuest: await f.evaluate(() => !!(hub.session && hub.session.profile && hub.session.profile.is_guest)),
  migrated: await d.page.evaluate(() => localStorage.getItem('hub.migrated')),
  legacyOnDevice: await d.page.evaluate(() => localStorage.getItem('tally.count')),
});
try {
  const G = 'guest-grandmajo';
  res.serverBefore = { guest: await serverCount(G).catch(e => 'ERR ' + e.message), mom: await serverCount('mom') };
  console.log('server before', JSON.stringify(res.serverBefore));

  // Arm A
  const ph = await L.newDevice({ name: 'Shared phone A', profiles: [G, 'mom'] });
  const d = await L.device({ device: 'iphone-pwa', profile: G, fixedTime: false, as: ph, localStorage: { 'tally.count': '23' } });
  await d.goto('#home'); await sleep(1000);
  res.A = { migratedBefore: await d.page.evaluate(() => localStorage.getItem('hub.migrated')), legacyBefore: await d.page.evaluate(() => localStorage.getItem('tally.count')) };
  let f = await d.openApp('tally'); await waitWho(f); await sleep(3000);
  res.A.guest = await snap(d, f); res.A.guest.server = await serverCount(G);
  await d.page.screenshot({ path: `${OUT}/${NAME}-guest.png`, scale: 'css' });
  console.log('A guest', JSON.stringify(res.A.guest));
  const me = await (await fetch(L.api + '/api/me', { headers: { 'X-Device-Token': ph.device.token, 'X-Profile-Token': ph.sessions.mom } })).json();
  await d.page.evaluate(s => { localStorage.setItem('hub.session', JSON.stringify(s)); localStorage.setItem('hub.lastProfile', JSON.stringify('mom')); }, { token: ph.sessions.mom, profile: me.profile });
  await d.goto('#home'); await d.page.reload(); await sleep(1500);
  f = await d.openApp('tally'); await waitWho(f); await sleep(3000);
  res.A.mom = await snap(d, f); res.A.mom.server = await serverCount('mom');
  await d.page.screenshot({ path: `${OUT}/${NAME}-mom.png`, scale: 'css' });
  console.log('A mom', JSON.stringify(res.A.mom));
  await d.close();

  // Arm B (control): Mom first on a fresh phone
  const ph2 = await L.newDevice({ name: 'Shared phone B', profiles: ['mom'] });
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: ph2, localStorage: { 'tally.count': '23' } });
  const f2 = await d2.openApp('tally'); await waitWho(f2); await sleep(3000);
  res.B = { mom: await snap(d2, f2) }; res.B.mom.server = await serverCount('mom');
  console.log('B mom-first', JSON.stringify(res.B.mom));
  await d2.close();
} catch (e) { res.error = String(e && e.stack || e); console.error(e); }
finally {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(res, null, 2));
  await L.close();
}
