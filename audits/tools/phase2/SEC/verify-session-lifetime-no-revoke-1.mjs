// Skeptic #1 for "session-lifetime-no-revoke": 365-day sessions, no rotation, logout per token only, TV Switch never
// calls the server. Re-derived from scratch on a fresh local instance, with REAL sessions (made by /api/profiles/:id/pin
// and /api/login — the rig's seeded sessions are 300 days, so they cannot prove the lifetime).
// Run:  node "audits/tools/phase2/SEC/verify-session-lifetime-no-revoke-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
const DAY = 86400000;
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  const devA = L.S.info.device;                                         // the rig's Kitchen iPad
  const devB = (await L.newDevice({ name: 'Mea phone', profiles: [] })).device;   // a second paired device, no sessions
  const api = (p, dt, pt, init = {}) => L.apiAs(null, p, { ...init, deviceToken: dt, profileToken: pt || null });
  const me = async (dt, pt) => (await api('/api/me', dt, pt)).status;

  // 1. real sessions for one adult (Mea / niece has no PIN yet) on two devices
  const create = await api('/api/profiles/niece/pin', devA.token, null, { method: 'POST', body: { pin: '2580' } });
  const tokA = create.body.profile_token;
  const tokB = (await api('/api/login', devB.token, null, { method: 'POST', body: { profile_id: 'niece', pin: '2580' } })).body.profile_token;
  const tokB2 = (await api('/api/login', devB.token, null, { method: 'POST', body: { profile_id: 'niece', pin: '2580' } })).body.profile_token;
  out.setup = { create_pin: create.status, meA: await me(devA.token, tokA), meB: await me(devB.token, tokB), meB2: await me(devB.token, tokB2),
    note: 'each login mints a new token; older tokens for the same profile+device are not replaced' };

  // 2. self-service revocation options
  out.self_service = {
    change_own_pin: await api('/api/profiles/niece/pin', devA.token, tokA, { method: 'POST', body: { pin: '1357' } }).then(r => ({ status: r.status, error: r.body.error })),
    note: 'no endpoint lets a non-admin change their PIN or end their other sessions',
  };

  // 3. logout is per token
  const lo = await api('/api/logout', devB.token, tokB, { method: 'POST', body: {} });
  out.logout_per_token = { logout: lo.status, loggedOut_B: await me(devB.token, tokB), same_device_other_token_B2: await me(devB.token, tokB2), other_device_A: await me(devA.token, tokA) };

  // 4. UI: Me → Switch while OFFLINE on device B (tokB2): hub.signOut swallows the failed /api/logout
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'niece', fixedTime: false, as: { device: devB, sessions: { niece: tokB2 } } });
    await d.goto('#me'); await d.page.waitForSelector('#switch', { timeout: 15000 });
    await d.setOffline(true);
    await d.page.click('#switch'); await d.page.waitForSelector('#profiles', { timeout: 10000 }); await sleep(500);
    const local = await d.page.evaluate(() => localStorage.getItem('hub.session'));
    await d.setOffline(false);
    out.ui_switch_offline = { local_session_after: local, server_token_B2_after: await me(devB.token, tokB2) };
    await d.close();
  }

  // 5. UI: Me → Switch ONLINE on device A (tokA). This is the finding's failure scenario: a borrower copied
  //    hub.device + hub.session from this device earlier. Is the copied pair still alive after the owner's Switch?
  {
    const copied = await L.device({ device: 'ipad-portrait', profile: 'niece', fixedTime: false, as: { device: devA, sessions: { niece: tokA } } });
    await copied.goto('#home'); await sleep(800);
    const ls = await copied.page.evaluate(() => ({ device: JSON.parse(localStorage.getItem('hub.device')), session: JSON.parse(localStorage.getItem('hub.session')) }));
    const stolen = { dt: ls.device.token, pt: ls.session.token };
    out.borrower_copied = { same_as_owner_token: stolen.pt === tokA, works_before: await me(stolen.dt, stolen.pt) };
    await copied.goto('#me'); await copied.page.waitForSelector('#switch', { timeout: 15000 });
    await copied.page.click('#switch'); await copied.page.waitForSelector('#profiles', { timeout: 10000 }); await sleep(500);
    out.borrower_copied.after_owner_switch = await me(stolen.dt, stolen.pt);
    // what the borrower still holds: the device token, which never expires
    out.borrower_device_token_only = {
      family_prayer_read_no_profile: await api('/api/data/prayer?scope=family', stolen.dt, null).then(r => ({ status: r.status, items: Array.isArray(r.body.items) ? r.body.items.length : r.body.error })),
      mint_kid_session: await api('/api/login', stolen.dt, null, { method: 'POST', body: { profile_id: 'ezra' } }).then(r => r.status),
      adult_without_pin: await api('/api/login', stolen.dt, null, { method: 'POST', body: { profile_id: 'niece', pin: '0000' } }).then(r => ({ status: r.status, error: r.body.error })),
    };
    await copied.close();
  }

  // 6. UI: the TV board's Switch (kiosk profile, seeded session) — does it end the server session?
  {
    const tvTok = L.S.info.sessions.tv;
    const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    await tv.goto('#home'); await tv.page.waitForSelector('#kiosk-switch', { timeout: 15000 });
    const reqs = []; tv.page.on('request', r => { if (r.url().includes('/api/logout')) reqs.push(r.url()); });
    await tv.page.click('#kiosk-switch'); await tv.page.waitForSelector('#profiles', { timeout: 10000 }); await sleep(800);
    out.tv_switch = { logout_requests: reqs.length, local_session_after: await tv.page.evaluate(() => localStorage.getItem('hub.session')), server_tv_token_after: await me(devA.token, tvTok) };
    await tv.close();
  }

  // 7. lifetime and no sliding refresh: a REAL session made now; use it at +200 d, then +364 d, then +366 d
  {
    const t0 = DEMO; await L.clock(new Date(t0).toISOString());
    const kidTok = (await api('/api/login', devA.token, null, { method: 'POST', body: { profile_id: 'kiara' } })).body.profile_token;
    const at = async days => { await L.clock(new Date(t0 + days * DAY).toISOString()); return me(devA.token, kidTok); };
    out.lifetime = { d0: await at(0), d200: await at(200), d364: await at(364), d365_5: await at(365.5), d366: await at(366) };
    out.lifetime.device_token_at_d366 = await api('/api/login', devA.token, null, { method: 'POST', body: { profile_id: 'kiara' } }).then(r => r.status);
    await L.clock(new Date(t0).toISOString());
  }

  // 8. the broad revokers that do exist: admin reset-PIN (all of a profile's sessions), admin unpair (all of a device's)
  {
    const eli = L.S.info.sessions.eli;
    const tA = (await api('/api/login', devA.token, null, { method: 'POST', body: { profile_id: 'niece', pin: '2580' } }));
    const tB = (await api('/api/login', devB.token, null, { method: 'POST', body: { profile_id: 'niece', pin: '2580' } }));
    out.admin_revoke = { note: 'fresh niece tokens on A and B, then admin reset-pin' , loginA: tA.status, loginB: tB.status };
    out.admin_revoke.reset = (await api('/api/admin/profiles/niece/reset-pin', devA.token, eli, { method: 'POST', body: {} })).status;
    out.admin_revoke.after = { A: await me(devA.token, tA.body.profile_token), B: await me(devB.token, tB.body.profile_token), B2_from_offline_switch: await me(devB.token, tokB2) };
    const kidB = (await api('/api/login', devB.token, null, { method: 'POST', body: { profile_id: 'ezra' } })).body.profile_token;
    out.admin_unpair = { before: await me(devB.token, kidB), unpair: (await api('/api/admin/devices/' + devB.id, devA.token, eli, { method: 'DELETE' })).status, after: await me(devB.token, kidB) };
  }
} catch (e) {
  out.error = String(e && e.stack || e);
} finally {
  await L.close();
}
console.log(JSON.stringify(out, null, 1));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'verify-session-lifetime-no-revoke-1.json'), JSON.stringify(out, null, 1));
