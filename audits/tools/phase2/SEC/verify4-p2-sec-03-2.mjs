// SEC skeptic #2 (rev 2) for P2-SEC-03 "Switch while offline leaves the session valid on the server".
// Independent end-to-end check on a fresh local instance (typical seed, demo clock, WebKit), through the real shell UI:
//   0. control: Me -> Switch while ONLINE revokes the token (so the offline result is not a rig/logout artefact)
//   1. Mea (niece) signs in with her PIN through the picker keypad; the token the server minted is read from localStorage
//      (standing in for the copy the finding's precondition needs) and scanned for elsewhere on the device afterwards
//   2. the device goes offline (rig: API route aborted with internetdisconnected + navigator.onLine false + 'offline'),
//      Me -> Switch is tapped: picker shown? local session cleared? logout attempted? did the server ever see it?
//   3. reconnect: 'online' event, a visibilitychange, 35 s of the shell's 30 s pull timer, a full reload -> every request
//      the page makes is logged; is /api/logout ever retried? /api/me with the old token after each step
//   4. "does anything later revoke it?": the next person (Ezra, kid, tap) signs in on the same iPad; Mea signs in again and
//      switches ONLINE (only the new token goes); every admin cron job (morning/evening/behind/prayer/park); pairing-code
//      rotation; Worker clock moved to day 364.9 / 365.1 after login; then admin Reset PIN and admin Unpair (the known
//      revocations) as the last steps
//   5. side checks: Switch on a connection that hangs (12 s client timeout, request never delivered); "Forget this
//      device" (Me -> Sync) while ONLINE — does it log the session out or unpair the device?
// Run:  node "audits/tools/phase2/SEC/verify4-p2-sec-03-2.mjs"
// Local only (the harness blocks production). Throwaway PIN 2468 for the seeded PIN-less Mea; throwaway pairing code.
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
const DAY = 86400000;
const PIN = '2468';
const out = { run_at: new Date().toISOString(), engine: 'webkit', device: 'ipad-portrait', profile: 'niece (Mea, adult)' };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const DT = L.S.info.device.token;                       // the rig's Kitchen iPad (the browser context below is this device)
  const st = r => r.status + (r.body && r.body.error ? ' ' + r.body.error : '');
  const me = (dt, pt) => L.apiAs(null, '/api/me', { deviceToken: dt, profileToken: pt }).then(r => st(r) + (r.body && r.body.profile ? ' ' + r.body.profile.id : ''));

  // throwaway PIN for Mea (seeded without one); the token returned here is not used further
  out.setup_create_pin = (await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: PIN }, profileToken: null })).status;

  const ipad = await L.device({ device: 'ipad-portrait', profile: null });
  const api = [];                                           // every request the page (shell + frames) makes to the API
  ipad.page.on('request', r => { if (r.url().startsWith(L.api)) api.push({ t: Date.now(), m: r.method(), p: new URL(r.url()).pathname }); });
  const reqFailed = [];
  ipad.page.on('requestfailed', r => { if (r.url().includes('/api/logout')) reqFailed.push((r.failure() || {}).errorText || 'failed'); });
  // what reached the Worker: count logout calls server-side by watching the rig server's own responses is not exposed,
  // so the browser's response events stand in (a route-aborted request never produces one)
  const logoutResponses = [];
  ipad.page.on('response', r => { if (r.url().includes('/api/logout')) logoutResponses.push(r.status()); });
  const logoutsSince = i => api.slice(i).filter(x => x.p === '/api/logout').map(x => x.m + ' ' + x.p);

  const signInMea = async () => {
    await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 15000 });
    await ipad.page.click('.pcard[data-id="niece"]');
    await ipad.page.waitForSelector('#pingo', { timeout: 10000 });
    for (const d of PIN) await ipad.page.click(`#pad button[data-d="${d}"]`);
    await ipad.page.click('#pingo');
    await ipad.page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'niece', null, { timeout: 10000 });
  };
  const localCopy = () => ipad.page.evaluate(() => ({ device: JSON.parse(localStorage.getItem('hub.device')), session: JSON.parse(localStorage.getItem('hub.session')) }));
  const onPicker = () => ipad.page.evaluate(() => !!document.querySelector('.pcard[data-id="niece"]'));
  const tapSwitch = async () => {
    await ipad.goto('#me'); await ipad.page.waitForSelector('#switch', { timeout: 10000 });
    await ipad.page.click('#switch');
    await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 20000 }); await sleep(300);
  };
  const scanForToken = tok => ipad.page.evaluate(t => {
    const hits = [];
    for (const [name, s] of [['localStorage', localStorage], ['sessionStorage', sessionStorage]]) for (const k of Object.keys(s)) if ((s.getItem(k) || '').includes(t)) hits.push(name + ':' + k);
    for (const f of document.querySelectorAll('iframe')) { try { const w = f.contentWindow; if (w.hub && w.hub.session && w.hub.session.token === t) hits.push('iframe hub.session'); } catch {} }
    if (window.hub && hub.session && hub.session.token === t) hits.push('shell hub.session');
    return hits;
  }, tok);

  // ── 0. control: online Switch revokes ──
  await ipad.goto('');
  await signInMea();
  const c0 = await localCopy();
  let i0 = api.length;
  const ctl = { token_before: await me(c0.device.token, c0.session.token) };
  await tapSwitch();
  ctl.logout_requests = logoutsSince(i0);
  ctl.logout_responses = logoutResponses.splice(0);
  ctl.picker_shown = await onPicker();
  ctl.token_after = await me(c0.device.token, c0.session.token);
  out.S0_control_online_switch = ctl;

  // ── 1 + 2. offline Switch ──
  await signInMea();
  const c = await localCopy();                              // the device + profile token the server minted for this sign-in
  out.S1_signed_in = {
    session_device_matches_rig_device: c.device.token === DT,
    token_before_switch: await me(c.device.token, c.session.token),
  };
  await ipad.goto('#me'); await ipad.page.waitForSelector('#switch', { timeout: 10000 });
  await ipad.setOffline(true);
  const off = { navigator_onLine: await ipad.page.evaluate(() => navigator.onLine) };
  let i1 = api.length;
  const tClick = Date.now();
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 20000 });
  off.ms_click_to_picker = Date.now() - tClick;
  await sleep(300);
  off.logout_requests_attempted = logoutsSince(i1);
  off.logout_request_failures = reqFailed.splice(0);
  off.logout_responses_received = logoutResponses.splice(0);
  off.picker_shown = await onPicker();
  off.local_hub_session = await ipad.page.evaluate(() => localStorage.getItem('hub.session'));
  off.token_copies_left_on_device = await scanForToken(c.session.token);
  off.device_token_left_on_device = await ipad.page.evaluate(() => !!localStorage.getItem('hub.device'));
  off.screenshot = await ipad.page.screenshot({ path: path.join(OUT, 'verify4-p2-sec-03-2-offline-switch.png'), scale: 'css', animations: 'disabled', caret: 'hide' }).then(() => 'audits/evidence/p2/SEC/verify4-p2-sec-03-2-offline-switch.png');
  out.S2_offline_switch = off;

  // ── 3. reconnect ──
  const rec = {};
  let i2 = api.length;
  await ipad.setOffline(false);
  await ipad.page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(1500);
  rec.after_online_event = { requests: api.slice(i2).map(x => x.m + ' ' + x.p), token: await me(c.device.token, c.session.token) };
  let i3 = api.length;
  await sleep(35000);                                       // one full tick of the shell's 30 s pull timer
  rec.after_35s_on_picker = { requests: [...new Set(api.slice(i3).map(x => x.m + ' ' + x.p))], logout_requests: logoutsSince(i3), token: await me(c.device.token, c.session.token) };
  let i4 = api.length;
  await ipad.goto(''); await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 15000 }); await sleep(2000);
  rec.after_reload = { requests: [...new Set(api.slice(i4).map(x => x.m + ' ' + x.p))], logout_requests: logoutsSince(i4), token: await me(c.device.token, c.session.token) };
  rec.logout_requests_total_after_reconnect = logoutsSince(i2);
  out.S3_reconnect = rec;

  // what the leftover token can do (same device; the session is bound to it)
  out.S3b_leftover_token_power = {
    read_person_f260: st(await L.apiAs(null, '/api/data/f260?scope=person', { deviceToken: c.device.token, profileToken: c.session.token })),
    write_person_row: st(await L.apiAs(null, '/api/data/hub/verify4:probe?scope=person', { method: 'PUT', deviceToken: c.device.token, profileToken: c.session.token, body: { value: { probe: 1 }, updated_at: Date.now() } })),
    other_device_same_token: st(await L.apiAs(null, '/api/me', { deviceToken: (await L.newDevice({ name: 'Verify4 other', profiles: [] })).device.token, profileToken: c.session.token })),
  };

  // ── 4. does anything later revoke it? ──
  const later = {};
  let i5 = api.length;
  await ipad.page.click('.pcard[data-id="ezra"]');
  await ipad.page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'ezra', null, { timeout: 10000 });
  later.next_person_ezra_signs_in = { logout_requests: logoutsSince(i5), token: await me(c.device.token, c.session.token) };
  await tapSwitch();                                        // Ezra switches back to the picker (online)
  later.ezra_switches_online = { token: await me(c.device.token, c.session.token) };
  await signInMea();
  const c2 = await localCopy();
  later.mea_signs_in_again = { new_token_differs: c2.session.token !== c.session.token, old_token: await me(c.device.token, c.session.token) };
  await tapSwitch();
  later.mea_switches_online = { new_token: await me(c2.device.token, c2.session.token), old_token: await me(c.device.token, c.session.token) };
  const cron = {};
  for (const job of ['morning', 'evening', 'behind', 'prayer', 'park']) cron[job] = (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job } })).status;
  later.every_admin_cron_job = { status: cron, old_token: await me(c.device.token, c.session.token) };
  later.pairing_code_rotated = { status: (await L.apiAs('eli', '/api/admin/pairing-code/rotate', { method: 'POST', body: { code: 'throwaway-verify4-code' } })).status, old_token: await me(c.device.token, c.session.token) };
  const clk = {};
  for (const d of [30, 180, 364.9, 365.1]) { await L.clock(new Date(DEMO + d * DAY).toISOString()); clk['day_' + d] = await me(c.device.token, c.session.token); }
  await L.clock(new Date(DEMO + 60000).toISOString());
  clk.back_to_day_0 = await me(c.device.token, c.session.token);
  later.worker_clock_moved = clk;
  out.S4_later_revocation = later;

  // ── 5a. side check: a hanging connection (request never delivered) ──
  const hang = {};
  await signInMea();
  const c3 = await localCopy();
  const hangRoute = u => u.href.includes('/api/logout');
  await ipad.ctx.route(hangRoute, () => { /* never answered: the 12 s AbortController in hub.request fires */ });
  await ipad.goto('#me'); await ipad.page.waitForSelector('#switch', { timeout: 10000 });
  const tH = Date.now();
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 20000 });
  hang.ms_click_to_picker = Date.now() - tH;
  await ipad.ctx.unroute(hangRoute);
  hang.local_hub_session = await ipad.page.evaluate(() => localStorage.getItem('hub.session'));
  hang.token_after = await me(c3.device.token, c3.session.token);
  out.S5a_hanging_connection_switch = hang;

  // ── 5b. side check: "Forget this device" while online ──
  const fg = {};
  await signInMea();
  const c4 = await localCopy();
  await ipad.goto('#me'); await ipad.page.waitForSelector('#forget', { timeout: 10000 });
  ipad.page.once('dialog', dlg => dlg.accept());
  let i6 = api.length;
  await Promise.all([ipad.page.waitForEvent('load', { timeout: 15000 }).catch(() => null), ipad.page.click('#forget')]);
  await sleep(1500);
  fg.requests = [...new Set(api.slice(i6).map(x => x.m + ' ' + x.p))];
  fg.local_device_after = await ipad.page.evaluate(() => localStorage.getItem('hub.device'));
  fg.session_token_after = await me(c4.device.token, c4.session.token);
  fg.device_token_family_read_after = st(await L.apiAs(null, '/api/data/prayer?scope=family', { deviceToken: c4.device.token, profileToken: null }));
  out.S5b_forget_device_online = fg;

  // ── 4 (cont). the known revocations, last because they end the leftover ──
  const known = {};
  known.admin_reset_pin_mea = (await L.apiAs('eli', '/api/admin/profiles/niece/reset-pin', { method: 'POST', body: {} })).status;
  known.old_token_after_reset_pin = await me(c.device.token, c.session.token);
  // unpair needs a separate leftover (reset-PIN already killed Mea's): mint one for kid Kiara on a second device, unpair it
  const d2 = await L.newDevice({ name: 'Verify4 phone', profiles: ['kiara'] });
  known.second_device_token_before_unpair = await me(d2.device.token, d2.sessions.kiara);
  known.admin_unpair = (await L.apiAs('eli', `/api/admin/devices/${d2.device.id}`, { method: 'DELETE' })).status;
  known.second_device_token_after_unpair = await me(d2.device.token, d2.sessions.kiara);
  out.S4b_known_revocations = known;

  out.page_errors = ipad.logs.filter(l => /pageerror|error/i.test(l)).slice(0, 10);
  console.log(JSON.stringify(out, null, 1));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'verify4-p2-sec-03-2.json'), JSON.stringify(out, null, 1));
} finally {
  await L.close();
}
