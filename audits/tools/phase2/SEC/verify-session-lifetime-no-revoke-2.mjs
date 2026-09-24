// SEC skeptic #2 for "session-lifetime-no-revoke": 365-day sessions, no rotation, logout revokes only the presented token.
// Re-runs the claim from scratch on the local instance (demo clock, so the Worker's clock can be moved a year on) and
// tests the finding's own failure scenario in the real UI: a borrower copies hub.device + hub.session off the iPad, then
// the owner taps Me -> Switch. Also: Switch while offline, the TV's Switch, what the device token alone still does, and
// whether admin reset-PIN / unpair revoke broadly.
// Run:  node "audits/tools/phase2/SEC/verify-session-lifetime-no-revoke-2.mjs"
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
const DAY = 86400000;
const PIN = '2468';                                     // throwaway PIN for Mea (niece), who has none in the demo seed
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const DT = L.S.info.device.token;                     // the rig's Kitchen iPad device token
  const me = (dt, pt) => L.apiAs(null, '/api/me', { deviceToken: dt, profileToken: pt }).then(r => r.status + (r.body && r.body.error ? ' ' + r.body.error : ''));

  // ── 1. real lifetime: a session minted by the real /api/login, then the Worker's clock moved forward ──
  const kid = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'ezra' }, profileToken: null });
  const Tk = kid.body.profile_token;
  const lifetime = {};
  for (const d of [1, 364, 366]) { await L.clock(new Date(DEMO + d * DAY).toISOString()); lifetime['day_' + d] = await me(DT, Tk); }
  await L.clock(new Date(DEMO).toISOString());
  lifetime.day_0_after_clock_reset = await me(DT, Tk);
  out.lifetime_real_login = lifetime;

  // rotation: does using a session ever hand back a new token?
  const meBody = await L.apiAs(null, '/api/me', { deviceToken: DT, profileToken: Tk });
  out.rotation = { me_response_keys: Object.keys(meBody.body || {}), new_token_header: Object.keys(meBody.headers).filter(h => /token/i.test(h)) };

  // ── 2. the finding's failure scenario, in the real UI ──
  // Mea creates her PIN on the iPad (first-tap flow), so a real adult session exists with a PIN we know
  const ipad = await L.device({ device: 'ipad-portrait', profile: null });
  await ipad.goto('');
  await ipad.page.click('.pcard[data-id="niece"]');
  const typePin = async () => { for (const d of PIN) await ipad.page.click(`.pin-pad button[data-d="${d}"]`); await ipad.page.click('#pingo'); };
  await typePin(); await sleep(400);
  if (await ipad.page.$('#pingo')) { await typePin(); await sleep(400); }   // create-PIN asks twice (enter + confirm)
  await ipad.page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'niece', null, { timeout: 10000 });
  const steal = () => ipad.page.evaluate(() => ({ device: JSON.parse(localStorage.getItem('hub.device')), session: JSON.parse(localStorage.getItem('hub.session')) }));
  const copy1 = await steal();                           // the borrower's copy
  const sc = { signed_in_as: (await ipad.hub()).profile, copied_pair_before_switch: await me(copy1.device.token, copy1.session.token) };
  await ipad.goto('#me'); await ipad.page.waitForSelector('#switch', { timeout: 10000 });
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 10000 });
  sc.copied_pair_after_owner_switch = await me(copy1.device.token, copy1.session.token);
  // what the copied DEVICE token alone still does after the Switch (the real residual credential)
  sc.device_token_only = {
    family_read: (await L.apiAs(null, '/api/data/prayer?scope=family', { deviceToken: copy1.device.token, profileToken: null })).status,
    kid_login_on_tap: (await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'kiara' }, deviceToken: copy1.device.token, profileToken: null })).status,
    adult_login_no_pin: await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'niece' }, deviceToken: copy1.device.token, profileToken: null }).then(r => r.status + ' ' + r.body.error),
  };
  out.scenario_switch_online = sc;

  // ── 3. Switch while the iPad is offline: hub.signOut swallows the failed /api/logout ──
  await ipad.page.click('.pcard[data-id="niece"]');
  await typePin();
  await ipad.page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'niece', null, { timeout: 10000 });
  const copy2 = await steal();
  await ipad.goto('#me'); await ipad.page.waitForSelector('#switch', { timeout: 10000 });
  await ipad.setOffline(true);
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 15000 });
  const localAfter = await ipad.page.evaluate(() => localStorage.getItem('hub.session'));
  await ipad.setOffline(false);
  out.scenario_switch_offline = { ipad_local_session_after_switch: localAfter, copied_pair_after_offline_switch: await me(copy2.device.token, copy2.session.token) };
  await ipad.page.screenshot({ path: path.join(OUT, 'session-verify2-picker-after-switch.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  // ── 4. the TV's Switch: client-side only ──
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  await tv.goto('#home'); await tv.page.waitForSelector('#kiosk-switch', { timeout: 10000 });
  const tvTok = L.S.info.sessions.tv;
  await tv.page.click('#kiosk-switch'); await sleep(500);
  out.tv_switch = {
    tv_token_after_switch: await me(DT, tvTok),
    tv_login_on_tap_from_device_token_alone: (await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'tv' }, profileToken: null })).status,
    tv_write_attempt: await L.apiAs(null, '/api/data/leftovers/item:x?scope=family', { method: 'PUT', deviceToken: DT, profileToken: tvTok, body: { value: { a: 1 }, updated_at: Date.now() } }).then(r => r.status + ' ' + r.body.error),
  };

  // ── 5. broad revocation that does exist ──
  const ph = await L.newDevice({ name: 'Mea phone', profiles: [] });
  const meaPhone = (await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'niece', pin: PIN }, deviceToken: ph.device.token, profileToken: null })).body.profile_token;
  const meaIpad = (await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'niece', pin: PIN }, profileToken: null })).body.profile_token;
  const rv = { before: { phone: await me(ph.device.token, meaPhone), ipad: await me(DT, meaIpad) } };
  rv.reset_pin = (await L.apiAs('eli', '/api/admin/profiles/niece/reset-pin', { method: 'POST', body: {} })).status;
  rv.after_reset_pin = { phone: await me(ph.device.token, meaPhone), ipad: await me(DT, meaIpad) };
  const kidPhone = (await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'ezra' }, deviceToken: ph.device.token, profileToken: null })).body.profile_token;
  rv.unpair = (await L.apiAs('eli', `/api/admin/devices/${ph.device.id}`, { method: 'DELETE' })).status;
  rv.after_unpair = { kid_session_on_phone: await me(ph.device.token, kidPhone), device_token_family_read: (await L.apiAs(null, '/api/data/prayer?scope=family', { deviceToken: ph.device.token, profileToken: null })).status };
  out.revocation = rv;

  console.log(JSON.stringify(out, null, 1));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'session-verify2.json'), JSON.stringify(out, null, 1));
} finally {
  await L.close();
}
