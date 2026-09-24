// Skeptic #1 for P2-SEC-03: "Switch while offline leaves the session valid on the server".
// Tries to refute it end to end through the shipped UI on the local rig (WebKit, iPad portrait):
//   A (control): Mea creates her PIN on first tap (real /api/profiles/:id/pin, real 365-day session), then Me → Switch
//     ONLINE. Expect the token to be revoked (401), so the online path is not the bug.
//   B (claim):   Mea signs in with her PIN (real /api/login), the device goes offline, Me → Switch. Then reconnect,
//     idle past the 30 s pull tick, reload the shell, and check the old token with /api/me.
//   Later triggers that might revoke it: same person signs in + Switches online again, a kid signs in + Switches,
//     the admin rotates the pairing code, the server clock passes 364.9 / 365.1 days.
//   Known revokers (code paths index.js:449, :553) re-checked with sessions made by real /api/login.
// No token, PIN or pairing code is written to the evidence: tokens appear as a short sha256 tag only; the PIN and the
// rotated pairing code are random per run and never recorded.
//
//   node "audits/tools/phase2/SEC/verify4-p2-sec-03-1.mjs"
// → audits/evidence/p2/SEC/verify4-p2-sec-03-1.json (+ 1× screenshots verify4-p2-sec-03-1-*.png)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { local, ROOT, DEMO, sleep } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
fs.mkdirSync(OUT, { recursive: true });
const tag = t => (t ? crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 10) : null);
const DAY = 86400000;
const PIN = String(crypto.randomInt(1000, 9999)) + String(crypto.randomInt(0, 9));   // 5 digits, random per run, never saved
const R = { claim: 'P2-SEC-03', engine: 'webkit', device: 'ipad-portrait', started: new Date().toISOString(), steps: [] };
const step = (name, data) => { R.steps.push({ name, ...data }); console.log(name, JSON.stringify(data)); };

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const me = async (deviceToken, profileToken) => {
    const r = await L.apiAs(null, '/api/me', { deviceToken, profileToken });
    return r.status === 200 ? `200 ${r.body.profile.id}` : `${r.status} ${r.body && r.body.error}`;
  };
  // Network log per browser context: every API request, with whether it carried a given profile token.
  const watch = d => {
    const log = [];
    d.ctx.on('request', q => { if (q.url().startsWith(L.api)) log.push({ t: Date.now(), method: q.method(), path: new URL(q.url()).pathname, pt: q.headers()['x-profile-token'] || null, status: 'sent' }); });
    d.ctx.on('requestfailed', q => { if (q.url().startsWith(L.api)) log.push({ t: Date.now(), method: q.method(), path: new URL(q.url()).pathname, pt: q.headers()['x-profile-token'] || null, status: 'failed: ' + (q.failure() && q.failure().errorText) }); });
    d.ctx.on('requestfinished', async q => { if (q.url().startsWith(L.api)) { const r = await q.response().catch(() => null); log.push({ t: Date.now(), method: q.method(), path: new URL(q.url()).pathname, pt: q.headers()['x-profile-token'] || null, status: 'done ' + (r ? r.status() : '?') }); } });
    return log;
  };
  const summarise = (log, token, since = 0) => log.filter(e => e.t >= since).map(e => `${e.method} ${e.path} ${e.status}${e.pt ? (e.pt === token ? ' [old token]' : ' [other token]') : ''}`);
  const gateUp = d => d.page.evaluate(() => !document.getElementById('gate').hidden && document.getElementById('shell').hidden);
  const lsSession = d => d.page.evaluate(() => { try { return JSON.parse(localStorage.getItem('hub.session')); } catch { return 'unreadable'; } });
  const tokenAnywhere = (d, token) => d.page.evaluate(t => {
    const hits = [];
    for (const [name, st] of [['localStorage', localStorage], ['sessionStorage', sessionStorage]]) for (let i = 0; i < st.length; i++) { const k = st.key(i); if (String(st.getItem(k)).includes(t)) hits.push(name + ':' + k); }
    if (window.hub && hub.session && hub.session.token === t) hits.push('memory:hub.session');
    return hits;
  }, token);
  const tap = async (d, sel) => { await d.page.waitForSelector(sel, { state: 'visible', timeout: 15000 }); await d.page.click(sel); };
  const typePin = async (d, pin) => { for (const ch of pin) await tap(d, `#pad button[data-d="${ch}"]`); await tap(d, '#pingo'); };
  const pickerCard = async (d, id) => { await d.page.waitForSelector(`#profiles .pcard[data-id="${id}"]`, { state: 'visible', timeout: 15000 }); return d.page.$eval(`#profiles .pcard[data-id="${id}"]`, b => b.textContent.replace(/\s+/g, ' ').trim()); };
  const waitShell = d => d.page.waitForFunction(() => document.getElementById('gate').hidden && !document.getElementById('shell').hidden, null, { timeout: 15000 });
  const switchViaMe = async d => { await tap(d, '.tab[data-tab="me"]'); await tap(d, '#switch'); await d.page.waitForFunction(() => !document.getElementById('gate').hidden, null, { timeout: 15000 }); await sleep(800); };
  const shot = async (d, name) => { const f = path.join(OUT, `verify4-p2-sec-03-1-${name}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };

  // ── A: control — first-tap PIN creation, then Switch ONLINE ─────────────────
  const devA = await L.newDevice({ name: 'Verify4 control iPad', profiles: [] });
  const A = await L.device({ device: 'ipad-portrait', profile: null, as: devA });
  const logA = watch(A);
  await A.goto('');
  const meaCardA = await pickerCard(A, 'niece');
  await tap(A, '#profiles .pcard[data-id="niece"]');
  await typePin(A, PIN); await sleep(300); await typePin(A, PIN);
  await waitShell(A);
  const TA = (await lsSession(A)).token;
  const TAexp = await L.apiAs(null, '/api/me', { deviceToken: devA.device.token, profileToken: TA });
  step('A1 Mea created her PIN on first tap (UI)', { picker_card: meaCardA, session_tag: tag(TA), me_before: await me(devA.device.token, TA) });
  const tA = Date.now();
  await switchViaMe(A);
  step('A2 Me → Switch ONLINE', { requests: summarise(logA, TA, tA), picker_shown: await gateUp(A), local_session_after: await lsSession(A), me_after_online_switch: await me(devA.device.token, TA) });

  // ── B: the claim — PIN login, device offline, Me → Switch ───────────────────
  const devB = await L.newDevice({ name: 'Verify4 shared iPad', profiles: [] });
  const B = await L.device({ device: 'ipad-portrait', profile: null, as: devB });
  const logB = watch(B);
  await B.goto('');
  const meaCardB = await pickerCard(B, 'niece');
  await tap(B, '#profiles .pcard[data-id="niece"]');
  await typePin(B, PIN);
  await waitShell(B);
  const TB = (await lsSession(B)).token;   // what someone with Web Inspector could copy while Mea is signed in (the precondition)
  // the server's own expiry for this session (real createSession, not the rig's 300-day rows)
  step('B1 Mea signed in with her PIN (UI, real /api/login)', { picker_card: meaCardB, session_tag: tag(TB), me_before: await me(devB.device.token, TB) });

  await B.setOffline(true);
  await sleep(500);
  const tOff = Date.now();
  await switchViaMe(B);
  const shotOffline = await shot(B, 'picker-after-offline-switch');
  step('B2 offline, Me → Switch', {
    navigator_onLine: await B.page.evaluate(() => navigator.onLine),
    requests_while_offline: summarise(logB, TB, tOff),
    picker_shown: await gateUp(B),
    local_session_after: await lsSession(B),
    old_token_found_on_device: await tokenAnywhere(B, TB),
    device_token_still_on_device: await B.page.evaluate(() => !!localStorage.getItem('hub.device')),
    screenshot: shotOffline,
  });

  const tOn = Date.now();
  await B.setOffline(false);
  await sleep(40000);   // past hub.js's 30 s pull tick and the 'online' handler
  step('B3 back online, picker left open 40 s', { requests_after_reconnect: summarise(logB, TB, tOn), logout_requests: logB.filter(e => e.t >= tOn && e.path === '/api/logout').length, old_token_sent: logB.filter(e => e.t >= tOn && e.pt === TB).length });

  const tReload = Date.now();
  await B.goto(''); await sleep(5000);
  step('B4 shell reloaded (app reopened)', { requests_after_reload: summarise(logB, TB, tReload), logout_requests: logB.filter(e => e.t >= tReload && e.path === '/api/logout').length, picker_shown: await gateUp(B) });

  const meB = await me(devB.device.token, TB);
  const readB = await L.apiAs(null, '/api/data/f260?scope=person', { deviceToken: devB.device.token, profileToken: TB });
  const writeB = await L.apiAs(null, '/api/data/f260/verify4-probe?scope=person', { method: 'PUT', deviceToken: devB.device.token, profileToken: TB, body: { value: { probe: true }, updated_at: Date.now() } });
  const otherDevice = await me(devA.device.token, TB);
  step('B5 the old token after reconnecting', { me: meB, read_person_scope: readB.status, write_person_scope: writeB.status, same_token_from_another_device: otherDevice });

  // ── later triggers that might revoke it ──────────────────────────────────────
  // R1: Mea signs in again on the same iPad and Switches online.
  await tap(B, '#profiles .pcard[data-id="niece"]');
  await typePin(B, PIN); await waitShell(B);
  const TB2 = (await lsSession(B)).token;
  await switchViaMe(B);
  step('R1 Mea signs in again + Switch online', { new_session_tag: tag(TB2), new_token_after: await me(devB.device.token, TB2), old_token_after: await me(devB.device.token, TB) });
  // R2: a kid opens on tap on the same iPad and Switches online.
  await tap(B, '#profiles .pcard[data-id="ezra"]'); await waitShell(B);
  await switchViaMe(B);
  step('R2 Ezra signs in on tap + Switch online', { old_token_after: await me(devB.device.token, TB) });
  // R3: the admin rotates the pairing code (random, never recorded).
  const rot = await L.apiAs('eli', '/api/admin/pairing-code/rotate', { method: 'POST', body: { code: 'v4-' + crypto.randomBytes(6).toString('hex') } });
  step('R3 admin rotates the pairing code', { rotate: rot.status, old_token_after: await me(devB.device.token, TB) });
  // R4: natural expiry — the demo clock runs 1000× slower than real time, so the session was created ≈ DEMO.
  await L.clock(new Date(DEMO + 364.9 * DAY).toISOString());
  const at3649 = await me(devB.device.token, TB);
  await L.clock(new Date(DEMO + 365.1 * DAY).toISOString());
  const at3651 = await me(devB.device.token, TB);
  await L.clock(new Date(DEMO).toISOString());
  step('R4 server clock moved', { at_364_9_days: at3649, at_365_1_days: at3651, auth_js_SESSION_MS_days: 365 });

  // ── known revokers, with sessions made by real /api/login (same server state as an orphaned token) ───────────
  const login = async dev => { const r = await L.apiAs(null, '/api/login', { method: 'POST', deviceToken: dev.device.token, profileToken: null, body: { profile_id: 'niece', pin: PIN } }); return r.body.profile_token; };
  const devC = await L.newDevice({ name: 'Verify4 lost phone', profiles: [] });
  const TC = await login(devB), TD = await login(devC);
  const before = { on_ipad: await me(devB.device.token, TC), on_phone: await me(devC.device.token, TD) };
  const unpair = await L.apiAs('eli', '/api/admin/devices/' + encodeURIComponent(devC.device.id), { method: 'DELETE' });
  const afterUnpair = { on_ipad: await me(devB.device.token, TC), on_phone: await me(devC.device.token, TD) };
  const reset = await L.apiAs('eli', '/api/admin/profiles/niece/reset-pin', { method: 'POST', body: {} });
  const afterReset = { on_ipad: await me(devB.device.token, TC) };
  step('K known revokers', { before, unpair: unpair.status, after_unpair: afterUnpair, reset_pin: reset.status, after_reset_pin: afterReset });

  R.summary = {
    online_switch_revokes: /^401/.test(R.steps.find(s => s.name.startsWith('A2')).me_after_online_switch),
    offline_switch_clears_device: R.steps.find(s => s.name.startsWith('B2')).local_session_after === null,
    old_token_left_on_device: R.steps.find(s => s.name.startsWith('B2')).old_token_found_on_device,
    logout_retried_after_reconnect_or_reload: R.steps.find(s => s.name.startsWith('B3')).logout_requests + R.steps.find(s => s.name.startsWith('B4')).logout_requests,
    old_token_after_reconnect: meB,
    old_token_after_R1_R2_R3: [R.steps.find(s => s.name.startsWith('R1')).old_token_after, R.steps.find(s => s.name.startsWith('R2')).old_token_after, R.steps.find(s => s.name.startsWith('R3')).old_token_after],
    natural_expiry: [at3649, at3651],
    revoked_by_unpair: afterUnpair.on_phone, revoked_by_reset_pin: afterReset.on_ipad,
  };
  R.browser_logs = { A: A.logs.slice(-15), B: B.logs.slice(-25) };
} catch (e) {
  R.error = String(e && e.stack || e);
  console.error(e);
} finally {
  R.finished = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'verify4-p2-sec-03-1.json'), JSON.stringify(R, null, 2));
  await L.close();
}
