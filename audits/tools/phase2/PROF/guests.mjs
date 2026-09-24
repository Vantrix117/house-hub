// PROF (audit Phase 2), brief item 1 (guests in the picker): expired guests hidden on the server and in the picker,
// refused at sign-in, their old session cut off, and what an offline picker with a stale cache shows. Overflow seed
// (Cousin Theodore's stay ended yesterday; Pastor Tim's ends later today). Local rig only.
//
//   node "audits/tools/phase2/PROF/guests.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const log = (k, v) => console.log(k.padEnd(50), typeof v === 'string' ? v : JSON.stringify(v));
const L = await local({ variant: 'overflow', clock: 'real' });
try {
  const all = (await L.apiAs('eli', '/api/profiles')).body.profiles.filter(p => p.is_guest).map(p => `${p.id} ends ${p.expires_at ? new Date(p.expires_at).toISOString().slice(0, 16) : 'never'}`);
  log('guests (admin view)', all);
  const pub = (await L.apiAs(null, '/api/profiles')).body.profiles.filter(p => p.is_guest).map(p => p.id);
  log('guests the picker gets (device token only)', pub);
  const login = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'guest-theo' } });
  log('expired guest signs in', `${login.status} ${login.body.error}: ${login.body.message}`);
  const sess = await L.apiAs('guest-theo', '/api/me');
  log("expired guest's old session", `${sess.status} ${sess.body.error}: ${sess.body.message}`);
  const ok = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'guest-grandmajo' } });
  log('current PIN-less guest signs in on tap', `${ok.status} kind=${ok.body.profile && ok.body.profile.kind} is_guest=${ok.body.profile && ok.body.profile.is_guest}`);

  // a picker cached while Pastor Tim was still here, reopened offline after his stay ended
  const cached = (await L.apiAs(null, '/api/profiles')).body.profiles;
  await L.apiAs('eli', '/api/admin/profiles/guest-pastor', { method: 'PUT', body: { expires_at: Date.now() - 60000 } });
  const d = await L.device({ device: 'iphone-pwa', profile: null, fixedTime: false, localStorage: { 'hub.profiles': cached } });
  await d.setOffline(true); await d.goto(''); await d.page.waitForSelector('#profiles .pcard[data-id]', { timeout: 15000 }); await sleep(600);
  log('offline picker (stale cache) still offers Pastor Tim?', String(await d.page.locator('#profiles .pcard[data-id="guest-pastor"]').count() === 1) + ' — label: ' + JSON.stringify(await d.page.locator('#profiles .pcard[data-id="guest-pastor"] .psub').textContent().catch(() => null)));
  await d.setOffline(false); await d.goto(''); await d.page.waitForSelector('#profiles .pcard[data-id]'); await sleep(600);
  log('online picker offers Pastor Tim?', String(await d.page.locator('#profiles .pcard[data-id="guest-pastor"]').count() === 1));
  await d.close();
} finally { await L.close(); }
