// Skeptic #1 for "critic-guest-gets-legacy-migration-2": does a guest who opens Tally first on a device take the
// pre-hub tally.count, set hub.migrated['tally.person'], and leave the next household adult with nothing?
// Independent reproduction: Tally opened STANDALONE (apps/tally.html, not the shell viewer) on one shared phone context,
// profiles switched by rewriting hub.session (what the picker stores after sign-in).
//   Run A: guest-grandmajo first, then mom.   Run B (after reset, control): ezra (kid) first, then mom.
// Run: node "audits/tools/phase3/tally/verify-critic-guest-gets-legacy-migration-2-1.mjs"
//   -> audits/evidence/p3/tally/verify-critic-guest-gets-legacy-migration-2-1.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally/verify-critic-guest-gets-legacy-migration-2-1';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const server = async pid => { const r = await L.apiAs(pid, '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
async function asProfile(d, ph, pid) {
  const me = await (await fetch(L.api + '/api/me', { headers: { 'X-Device-Token': ph.device.token, 'X-Profile-Token': ph.sessions[pid] } })).json();
  await d.page.evaluate(s => { localStorage.setItem('hub.session', JSON.stringify(s)); localStorage.setItem('hub.lastProfile', JSON.stringify(s.profile.id)); }, { token: ph.sessions[pid], profile: me.profile });
  return me.profile;
}
async function openTally(d) {
  await d.page.goto(L.site + '/apps/tally.html', { waitUntil: 'load' });
  await d.page.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 10000 });
  await sleep(3000);   // let the flush land
  return d.page.evaluate(() => ({ who: document.getElementById('who').textContent, shows: document.getElementById('n').textContent,
    hubProfile: hub.profile, migrated: localStorage.getItem('hub.migrated'), legacy: localStorage.getItem('tally.count'), sync: hub.sync.state }));
}
async function run(first, label) {
  const ph = await L.newDevice({ name: 'Shared phone ' + label, profiles: [first, 'mom'] });
  const out = { before: { first: await server(first), mom: await server('mom') } };
  const d = await L.device({ device: 'iphone-pwa', profile: first, fixedTime: false, as: ph, localStorage: { 'tally.count': '23' } });
  out.firstProfileFromApiMe = (await (await fetch(L.api + "/api/me", { headers: { "X-Device-Token": ph.device.token, "X-Profile-Token": ph.sessions[first] } })).json()).profile;   // the rig seeds hub.session for the first profile
  out.first = await openTally(d); out.first.server = await server(first);
  await asProfile(d, ph, 'mom');
  out.mom = await openTally(d); out.mom.server = await server('mom');
  await d.page.screenshot({ path: `${OUT}-${label}-mom.png` });
  await d.close();
  return out;
}
try {
  await L.sessions();
  res.A_guestFirst = await run('guest-grandmajo', 'A');
  console.log('A guest first:', JSON.stringify(res.A_guestFirst, null, 1));
  await L.reset('typical');
  res.B_kidFirst = await run('ezra', 'B');
  console.log('B kid first (control):', JSON.stringify({ first: res.B_kidFirst.first, mom: res.B_kidFirst.mom }, null, 1));
} catch (e) { res.error = String(e && e.stack || e); console.log(res.error); }
finally {
  fs.writeFileSync(OUT + '.json', JSON.stringify(res, null, 2));
  await L.close();
}
