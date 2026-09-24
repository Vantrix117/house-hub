// SEC skeptic #1 for finding "lockout-dos": do the PIN / pairing lockouts block the CORRECT secret too, how wide is the
// blast radius, how long does it last, and what does the keypad do? Independent of rate-limits.mjs: runs through the
// rig's HTTP local instance (lib/local.mjs, real worker/src on in-memory SQLite, demo clock) and a WebKit iPad.
//   node "audits/tools/phase2/SEC/verify-lockout-dos-1.mjs"
// Writes audits/evidence/p2/SEC/verify-lockout-dos-1.json and verify-lockout-dos-1-ui.png.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../evidence/p2/SEC');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
const iso = ms => new Date(ms).toISOString();
try {
  const KITCHEN = L.S.info.device.token;                                  // the rig's Kitchen iPad
  const other = await L.newDevice({ name: 'Mea phone', profiles: [] });  // a second paired device
  const raw = async (p, { method = 'POST', body, dt, ip } = {}) => {
    const h = { 'Content-Type': 'application/json' };
    if (dt) h['X-Device-Token'] = dt; if (ip) h['CF-Connecting-IP'] = ip;
    const r = await fetch(L.api + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, error: j && j.error, message: j && j.message, retry_after: j && j.retry_after };
  };
  const login = (pid, pin, dt) => raw('/api/login', { body: { profile_id: pid, pin }, dt });
  const PIN = '2468';

  // Mea (niece) has never made a PIN in the seed: make a known one through the real first-tap route.
  await L.clock(iso(DEMO));
  out.create_known_pin = (await raw('/api/profiles/niece/pin', { body: { pin: PIN }, dt: KITCHEN })).status;

  // 1. five wrong PINs on the Kitchen iPad, then a sixth, then the right one
  out.wrong = [];
  for (let i = 1; i <= 6; i++) { const r = await login('niece', '0000', KITCHEN); out.wrong.push(`${i}:${r.status}${r.error ? ' ' + r.error : ''}`); }
  out.correct_same_device_during_lock = await login('niece', PIN, KITCHEN);
  // 2. blast radius: same profile on another device, another profile on the same device
  out.correct_other_device_during_lock = await login('niece', PIN, other.device.token);
  out.other_profile_same_device_wrong_pin = await login('eli', '0000', KITCHEN);   // wrong on purpose: 401 means not locked

  // 3. keypad on the locked Kitchen iPad (WebKit): pick Mea, type the right PIN, Continue
  await L.sessions();   // refresh the cached profile list so Mea shows as having a PIN
  const ipad = await L.device({ device: 'ipad-portrait', profile: null, fixedTime: false });
  const pg = ipad.page;
  await ipad.goto(''); await pg.waitForSelector('.pcard[data-id="niece"]', { timeout: 20000 });
  await pg.click('.pcard[data-id="niece"]'); await pg.waitForSelector('#pad');
  const typePin = async () => { for (const d of PIN) await pg.click(`#pad button[data-d="${d}"]`); };
  await typePin(); await pg.click('#pingo');
  await pg.waitForFunction(() => document.querySelector('#pinmsg') && document.querySelector('#pinmsg').textContent.trim().length > 0, null, { timeout: 10000 });
  const ui1 = await pg.evaluate(() => ({ msg: document.querySelector('#pinmsg').textContent, padDisabled: [...document.querySelectorAll('#pad button')].filter(b => b.disabled).length, padButtons: document.querySelectorAll('#pad button').length, continueDisabledEmpty: document.querySelector('#pingo').disabled }));
  await typePin();
  const ui2 = await pg.evaluate(() => ({ continueDisabledAfterRetype: document.querySelector('#pingo').disabled }));
  await pg.click('#pingo'); await sleep(800);
  const ui3 = await pg.evaluate(() => ({ msgAfterSecondSubmit: document.querySelector('#pinmsg').textContent, stillOnPad: !!document.querySelector('#pad') }));
  await pg.screenshot({ path: path.join(OUT, 'verify-lockout-dos-1-ui.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  out.keypad = { ...ui1, ...ui2, ...ui3 };
  await ipad.close();

  // 4. duration: the window is fixed from the FIRST wrong attempt (reset_at is set once), not from the lock
  await L.clock(iso(DEMO + 14 * 60000));
  out.correct_at_plus14min = await login('niece', PIN, KITCHEN);
  await L.clock(iso(DEMO + 16 * 60000));
  out.correct_at_plus16min = await login('niece', PIN, KITCHEN);
  // fixed-window check: 1 wrong at T, 4 wrong at T+10 → locked; right PIN at T+15.5 works (window counted from T)
  const T = DEMO + 60 * 60000;
  await L.clock(iso(T)); await login('niece', '0000', KITCHEN);
  await L.clock(iso(T + 10 * 60000)); for (let i = 0; i < 4; i++) await login('niece', '0000', KITCHEN);
  out.fixed_window_locked_at_T10 = (await login('niece', PIN, KITCHEN)).status;
  await L.clock(iso(T + 15.5 * 60000));
  out.fixed_window_correct_at_T15_5 = (await login('niece', PIN, KITCHEN)).status;
  // the attacker can simply relock after expiry (5 more wrong guesses)
  for (let i = 0; i < 5; i++) await login('niece', '0000', KITCHEN);
  out.relock_after_expiry = (await login('niece', PIN, KITCHEN)).status;
  // does an admin Reset PIN free the locked device early? (login checks pin_hash NULL before the rate check)
  out.admin_reset_pin = (await L.apiAs('eli', '/api/admin/profiles/niece/reset-pin', { method: 'POST', body: {} })).status;
  out.login_after_admin_reset = await login('niece', PIN, KITCHEN);
  out.create_pin_after_admin_reset = (await raw('/api/profiles/niece/pin', { body: { pin: PIN }, dt: KITCHEN })).status;

  // 5. pairing: 10 wrong codes per IP (CF-Connecting-IP), then the right code from that IP / another IP / no header
  await L.clock(iso(DEMO + 3 * 3600000));
  const CODE = 'throwaway-verify-code-' + Math.random().toString(36).slice(2);
  await L.setPairingCode(CODE);
  out.pair_wrong = [];
  for (let i = 1; i <= 11; i++) { const r = await raw('/api/pair', { body: { code: 'nope', name: 'x' }, ip: '203.0.113.9' }); out.pair_wrong.push(`${i}:${r.status}`); }
  out.pair_correct_same_ip = await raw('/api/pair', { body: { code: CODE, name: 'y' }, ip: '203.0.113.9' });
  out.pair_correct_other_ip = (await raw('/api/pair', { body: { code: CODE, name: 'z' }, ip: '198.51.100.5' })).status;
  out.pair_correct_no_ip_header = (await raw('/api/pair', { body: { code: CODE, name: 'w' } })).status;
} finally {
  await L.close();
}
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'verify-lockout-dos-1.json'), JSON.stringify(out, null, 1));
