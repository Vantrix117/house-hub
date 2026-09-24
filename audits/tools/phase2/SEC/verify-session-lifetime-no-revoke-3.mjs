// SEC skeptic #3 (tie-break) for "session-lifetime-no-revoke": 365-day sessions with no rotation; logout revokes only the
// presented token; the TV's Switch never calls the server. Independent re-run on a fresh local instance (demo clock, so the
// Worker's clock can be moved a year on). Tests each sub-claim separately so the verdict can be split:
//   A. real lifetime of a session minted by the real API, and whether use extends it
//   B. rotation: does any response hand back a fresh token
//   C. logout scope: other device / other token on the same device
//   D. the finding's own failure scenario in the real UI: borrower copies hub.device + hub.session, owner taps Me -> Switch
//      (online, then offline)
//   E. the TV's Switch (network requests counted) and what a kiosk token is worth
//   F. self-service: can a non-admin adult revoke their own session on another device
//   G. broad revocation that exists: admin reset-PIN, admin unpair; pairing-code rotation
// Run:  node "audits/tools/phase2/SEC/verify-session-lifetime-no-revoke-3.mjs"
// Local only (production is blocked by the harness). Uses a throwaway PIN (5173) for the seeded PIN-less Mea (niece).
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
const DAY = 86400000;
const PIN = '5173';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const DT = L.S.info.device.token;                               // the rig's Kitchen iPad
  const st = r => r.status + (r.body && r.body.error ? ' ' + r.body.error : '');
  const me = (dt, pt) => L.apiAs(null, '/api/me', { deviceToken: dt, profileToken: pt }).then(st);
  const login = (dt, id, pin) => L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: id, ...(pin ? { pin } : {}) }, deviceToken: dt, profileToken: null });

  // ── A. lifetime ──
  const cp = await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: PIN }, profileToken: null });
  const T0 = cp.body.profile_token;
  const A = { create_pin: cp.status };
  for (const d of [0, 200, 364, 364.9, 365.1, 366]) { await L.clock(new Date(DEMO + d * DAY).toISOString()); A['day_' + d] = await me(DT, T0); }
  await L.clock(new Date(DEMO).toISOString());
  A.back_to_day_0 = await me(DT, T0);
  out.A_lifetime = A;

  // ── B. rotation ──
  const r1 = await L.apiAs(null, '/api/me', { deviceToken: DT, profileToken: T0 });
  const r2 = await L.apiAs(null, '/api/data/f260?scope=person', { deviceToken: DT, profileToken: T0 });
  out.B_rotation = {
    me_body_keys: Object.keys(r1.body || {}),
    token_like_headers: [...Object.keys(r1.headers), ...Object.keys(r2.headers)].filter(h => /token|session|set-cookie/i.test(h)),
    data_body_keys: Object.keys(r2.body || {}),
  };

  // ── C. logout scope ──
  const ph = await L.newDevice({ name: 'Mea phone', profiles: [] });
  const Tphone = (await login(ph.device.token, 'niece', PIN)).body.profile_token;
  const Tpad1 = (await login(DT, 'niece', PIN)).body.profile_token;
  const Tpad2 = (await login(DT, 'niece', PIN)).body.profile_token;
  const lo = await L.apiAs(null, '/api/logout', { method: 'POST', body: {}, deviceToken: DT, profileToken: Tpad2 });
  out.C_logout_scope = {
    logout: lo.status,
    logged_out_token: await me(DT, Tpad2),
    older_token_same_device: await me(DT, Tpad1),
    same_profile_other_device: await me(ph.device.token, Tphone),
    first_token_T0_same_device: await me(DT, T0),
  };

  // ── D. the failure scenario in the UI ──
  const ipad = await L.device({ device: 'ipad-portrait', profile: null });
  const reqs = [];
  ipad.page.on('request', r => { if (r.url().includes('/api/logout')) reqs.push(r.method() + ' ' + new URL(r.url()).pathname); });
  const signInMea = async () => {
    await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 10000 });
    await ipad.page.click('.pcard[data-id="niece"]');
    await ipad.page.waitForSelector('#pingo', { timeout: 10000 });
    for (const d of PIN) await ipad.page.click(`.pin-pad button[data-d="${d}"]`);
    await ipad.page.click('#pingo');
    await ipad.page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'niece', null, { timeout: 10000 });
  };
  const steal = () => ipad.page.evaluate(() => ({ device: JSON.parse(localStorage.getItem('hub.device')), session: JSON.parse(localStorage.getItem('hub.session')) }));
  await ipad.goto('');
  await signInMea();
  const c1 = await steal();
  const D = { online: { copied_before: await me(c1.device.token, c1.session.token) } };
  await ipad.goto('#me'); await ipad.page.waitForSelector('#switch', { timeout: 10000 });
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 10000 }); await sleep(300);
  D.online.logout_requests = reqs.splice(0);
  D.online.copied_after_owner_switch = await me(c1.device.token, c1.session.token);
  D.online.copied_device_token_family_read = (await L.apiAs(null, '/api/data/prayer?scope=family', { deviceToken: c1.device.token, profileToken: null })).status;
  D.online.copied_device_token_adult_login_without_pin = st(await login(c1.device.token, 'niece'));

  await signInMea();
  const c2 = await steal();
  await ipad.goto('#me'); await ipad.page.waitForSelector('#switch', { timeout: 10000 });
  await ipad.setOffline(true);
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 15000 }); await sleep(300);
  D.offline = {
    logout_requests_attempted: reqs.splice(0),
    ipad_local_session_after: await ipad.page.evaluate(() => localStorage.getItem('hub.session')),
  };
  await ipad.setOffline(false); await sleep(300);
  D.offline.copied_after_offline_switch = await me(c2.device.token, c2.session.token);
  D.offline.logout_requests_after_reconnect = reqs.splice(0);
  out.D_failure_scenario = D;

  // ── E. the TV's Switch ──
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  const tvReqs = [];
  tv.page.on('request', r => { if (r.url().includes('/api/logout')) tvReqs.push(r.url()); });
  await tv.goto('#home'); await tv.page.waitForSelector('#kiosk-switch', { timeout: 10000 });
  await tv.page.click('#kiosk-switch'); await sleep(500);
  const tvTok = L.S.info.sessions.tv;
  out.E_tv_switch = {
    logout_requests: tvReqs.length,
    tv_token_after: await me(DT, tvTok),
    tv_local_session_after: await tv.page.evaluate(() => localStorage.getItem('hub.session')),
    kiosk_login_from_device_token_alone: st(await login(DT, 'tv')),
    kiosk_write: st(await L.apiAs(null, '/api/data/leftovers/item:x?scope=family', { method: 'PUT', deviceToken: DT, profileToken: tvTok, body: { value: { a: 1 }, updated_at: Date.now() } })),
  };

  // ── F. self-service (Mea is a non-admin adult, signed in on the iPad; her phone session is the one to kill) ──
  const Tself = (await login(DT, 'niece', PIN)).body.profile_token;
  out.F_self_service = {
    unpair_own_phone: st(await L.apiAs(null, `/api/admin/devices/${ph.device.id}`, { method: 'DELETE', deviceToken: DT, profileToken: Tself })),
    reset_own_pin: st(await L.apiAs(null, '/api/admin/profiles/niece/reset-pin', { method: 'POST', body: {}, deviceToken: DT, profileToken: Tself })),
    change_own_pin: st(await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: '9999' }, deviceToken: DT, profileToken: Tself })),
    phone_session_still: await me(ph.device.token, Tphone),
  };

  // ── G. broad revocation that exists ──
  const G = {};
  G.rotate_pairing_code = (await L.apiAs('eli', '/api/admin/pairing-code/rotate', { method: 'POST', body: { code: 'throwaway-code-3' } })).status;
  G.after_rotation = { phone_session: await me(ph.device.token, Tphone), phone_device_family_read: (await L.apiAs(null, '/api/data/prayer?scope=family', { deviceToken: ph.device.token, profileToken: null })).status };
  G.reset_pin = (await L.apiAs('eli', '/api/admin/profiles/niece/reset-pin', { method: 'POST', body: {} })).status;
  G.after_reset_pin = { phone: await me(ph.device.token, Tphone), pad1: await me(DT, Tpad1), T0: await me(DT, T0), offline_switch_leftover: await me(c2.device.token, c2.session.token), self: await me(DT, Tself) };
  const kidPhone = (await login(ph.device.token, 'ezra')).body.profile_token;
  G.unpair = (await L.apiAs('eli', `/api/admin/devices/${ph.device.id}`, { method: 'DELETE' })).status;
  G.after_unpair = { kid_session_on_phone: await me(ph.device.token, kidPhone), phone_device_family_read: (await L.apiAs(null, '/api/data/prayer?scope=family', { deviceToken: ph.device.token, profileToken: null })).status };
  out.G_broad_revocation = G;

  out.logs = [...ipad.logs, ...tv.logs].filter(l => /error/i.test(l)).slice(0, 10);
  console.log(JSON.stringify(out, null, 1));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'session-verify3.json'), JSON.stringify(out, null, 1));
} finally {
  await L.close();
}
