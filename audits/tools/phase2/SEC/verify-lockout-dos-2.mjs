// SEC skeptic #2 for finding "lockout-dos" (lens: intent and context). Independent of rate-limits.mjs and verify-lockout-dos-1:
// runs through the rig's HTTP local instance (lib/local.mjs: real worker/src on in-memory SQLite, demo clock) + one WebKit iPad.
//   node "audits/tools/phase2/SEC/verify-lockout-dos-2.mjs"
// Questions: (a) does the correct PIN / pairing code really get 429 during a lock; (b) who can trigger it (what does the
// attacker need); (c) blast radius (other device, other profile, other IP, already-paired devices); (d) how long it lasts;
// (e) what the keypad tells the user. Writes audits/evidence/p2/SEC/verify-lockout-dos-2.json and -ui.png.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../../evidence/p2/SEC');
fs.mkdirSync(OUT, { recursive: true });
const iso = ms => new Date(ms).toISOString();
const out = {};
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const KITCHEN = L.S.info.device.token;
  const phone = await L.newDevice({ name: 'Mea phone', profiles: [] });
  const raw = async (p, { method = 'POST', body, dt, ip } = {}) => {
    const h = { 'Content-Type': 'application/json' };
    if (dt) h['X-Device-Token'] = dt; if (ip) h['CF-Connecting-IP'] = ip;
    const r = await fetch(L.api + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, error: j && j.error, message: j && j.message, retry_after: j && j.retry_after };
  };
  const login = (pid, pin, dt) => raw('/api/login', { body: { profile_id: pid, pin }, dt });
  const PIN = '5813';

  await L.clock(iso(DEMO));
  out.setup_create_pin_niece = (await raw('/api/profiles/niece/pin', { body: { pin: PIN }, dt: KITCHEN })).status;

  // (b) who can trigger: without a device token nothing reaches the counter
  const noTok = [];
  for (let i = 0; i < 7; i++) noTok.push((await login('niece', '0000', undefined)).status);
  out.b_no_device_token_statuses = noTok;
  out.b_correct_after_7_tokenless = (await login('niece', PIN, KITCHEN)).status;   // expect 200: tokenless tries never counted

  // (a) five wrong on the Kitchen iPad → 6th 429 → correct PIN 429
  await L.clock(iso(DEMO + 60000));
  out.a_wrong = [];
  for (let i = 1; i <= 6; i++) { const r = await login('niece', '0000', KITCHEN); out.a_wrong.push(`${i}:${r.status}${r.error ? ' ' + r.error : ''}`); }
  out.a_correct_same_device_locked = await login('niece', PIN, KITCHEN);

  // (c) blast radius
  out.c_correct_other_device = (await login('niece', PIN, phone.device.token)).status;          // same profile, another device
  out.c_other_profile_same_device_wrongpin = (await login('eli', '0000', KITCHEN)).status;       // 401 = not locked
  out.c_kid_same_device = (await login('ezra', undefined, KITCHEN)).status;                     // kids open on tap

  // (d) duration: fixed window from the FIRST failure (T=+1 min); lock lifts at T+15
  await L.clock(iso(DEMO + 60000 + 14.5 * 60000));
  out.d_correct_at_T_plus_14_5 = (await login('niece', PIN, KITCHEN)).status;
  await L.clock(iso(DEMO + 60000 + 15.2 * 60000));
  out.d_correct_at_T_plus_15_2 = (await login('niece', PIN, KITCHEN)).status;
  // a lock that let the right PIN through would not limit anything: an attacker keeps guessing through it.
  // Show that with the locked counter nothing distinguishes a right from a wrong guess (both 429, same body).
  await L.clock(iso(DEMO + 2 * 3600000));
  for (let i = 0; i < 5; i++) await login('niece', '0000', KITCHEN);
  const wrongLocked = await login('niece', '1111', KITCHEN), rightLocked = await login('niece', PIN, KITCHEN);
  out.a_locked_wrong_vs_right_identical = wrongLocked.status === rightLocked.status && wrongLocked.error === rightLocked.error;

  // (e) keypad on the locked Kitchen iPad (WebKit)
  await L.sessions();
  const ipad = await L.device({ device: 'ipad-portrait', profile: null, fixedTime: false });
  const pg = ipad.page;
  await ipad.goto(''); await pg.waitForSelector('.pcard[data-id="niece"]', { timeout: 20000 });
  await pg.click('.pcard[data-id="niece"]'); await pg.waitForSelector('#pad');
  for (const d of PIN) await pg.click(`#pad button[data-d="${d}"]`);
  await pg.click('#pingo');
  await pg.waitForFunction(() => (document.querySelector('#pinmsg') || {}).textContent, null, { timeout: 10000 });
  out.e_keypad = await pg.evaluate(() => ({
    message: document.querySelector('#pinmsg').textContent,
    padButtonsDisabled: [...document.querySelectorAll('#pad button')].filter(b => b.disabled).length,
    padButtons: document.querySelectorAll('#pad button').length,
  }));
  await pg.screenshot({ path: path.join(OUT, 'verify-lockout-dos-2-ui.png'), scale: 'css', animations: 'disabled', caret: 'hide' });   // 1x css
  await ipad.close();

  // pairing: 10 wrong per IP; the correct code from the same IP is 429, another IP pairs; an already-paired device is unaffected
  await L.clock(iso(DEMO + 4 * 3600000));
  const CODE = 'throwaway-skeptic2-' + Math.random().toString(36).slice(2);
  await L.setPairingCode(CODE);
  const pw = [];
  for (let i = 1; i <= 11; i++) pw.push((await raw('/api/pair', { body: { code: 'nope', name: 'x' }, ip: '203.0.113.9' })).status);
  out.p_wrong_statuses = pw;
  out.p_correct_same_ip = await raw('/api/pair', { body: { code: CODE, name: 'y' }, ip: '203.0.113.9' });
  out.p_correct_other_ip = (await raw('/api/pair', { body: { code: CODE, name: 'z' }, ip: '198.51.100.5' })).status;
  out.p_existing_device_same_ip_still_works = (await raw('/api/login', { body: { profile_id: 'ezra' }, dt: KITCHEN, ip: '203.0.113.9' })).status;
} finally {
  await L.close();
}
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'verify-lockout-dos-2.json'), JSON.stringify(out, null, 1));
