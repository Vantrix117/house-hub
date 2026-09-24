// SEC (2): rate limiting on the PIN and pairing routes, and the pairing bypass. In-process real Worker on a fresh D1.
// Setup writes known PIN hashes straight into the DB with the Worker's own hashSecret(), so every login/verify below
// runs the real route unchanged. Run:  node "audits/tools/phase2/SEC/rate-limits.mjs"
//   - wrong PIN: 5 per profile+device per 15 min → the 6th is 429
//   - pairing: 10 wrong codes per IP per 15 min → the 11th is 429
//   - bypass: the PIN limit keys on device.id, and successful pairings are NOT limited (they call rateClear), so pairing
//     N devices with a known code gives 5·N guesses per 15 min against one profile.
//   - first-tap create-PIN has no rate limit and any paired device can claim a PIN-less adult (Mea) in one call.
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
globalThis.fetch = async u => { throw new Error('outbound fetch refused: ' + (u.url || u)); };
globalThis.caches = { default: { async match() {}, async put() {} } };

const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
const { seedDemo } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);
const { hashSecret } = await import(pathToFileURL(path.join(ROOT, 'worker/src/auth.js')).href);

async function fresh() {
  const DB = createD1(':memory:');
  await seedDemo(DB, { variant: 'empty', now: Date.now() });
  const env = { DB, ALLOWED_ORIGINS: 'http://localhost:8765' };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const call = async (p, { method = 'GET', body, dt, pt, ip } = {}) => {
    const h = { 'Content-Type': 'application/json' };
    if (dt) h['X-Device-Token'] = dt; if (pt) h['X-Profile-Token'] = pt; if (ip) h['CF-Connecting-IP'] = ip;
    const r = await worker.fetch(new Request('http://api.local' + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, ctx);
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, error: j && j.error, body: j };
  };
  const CODE = 'throwaway-pair-code';
  DB.sqlite.prepare("UPDATE settings SET value = ? WHERE key = 'pairing_code_hash'").run(await hashSecret(CODE));
  const setPin = async (id, pin) => DB.sqlite.prepare('UPDATE profiles SET pin_hash = ? WHERE id = ?').run(await hashSecret(String(pin)), id);
  const clearPin = id => DB.sqlite.prepare('UPDATE profiles SET pin_hash = NULL WHERE id = ?').run(id);
  const pairDevice = async name => (await call('/api/pair', { method: 'POST', body: { code: CODE, name } })).body.device_token;
  return { DB, call, CODE, setPin, clearPin, pairDevice };
}
const out = {};

// ── wrong PIN: 5 per profile+device per 15 min ─────────────────
{
  const { call, setPin, pairDevice } = await fresh();
  await setPin('niece', '1234');
  const dt = await pairDevice('device-1');
  out.pin_limit = [];
  for (let i = 1; i <= 7; i++) { const r = await call('/api/login', { method: 'POST', body: { profile_id: 'niece', pin: '0000' }, dt }); out.pin_limit.push({ attempt: i, status: r.status, error: r.error }); }
  out.pin_limit_summary = { first_429_at_attempt: out.pin_limit.findIndex(a => a.status === 429) + 1, wrong_pin_before_lock: out.pin_limit.filter(a => a.error === 'wrong_pin').length };
  const blocked = await call('/api/login', { method: 'POST', body: { profile_id: 'niece', pin: '1234' }, dt });
  out.correct_pin_during_lock = { status: blocked.status, error: blocked.error, note: 'even the right PIN is refused until the 15-min window resets' };
}

// ── pairing: 10 wrong codes per IP per 15 min ──────────────────
{
  const { call, CODE } = await fresh();
  out.pair_limit = [];
  for (let i = 1; i <= 12; i++) { const r = await call('/api/pair', { method: 'POST', body: { code: 'wrong-code', name: 'x' }, ip: '203.0.113.9' }); out.pair_limit.push({ attempt: i, status: r.status, error: r.error }); }
  out.pair_limit_summary = { first_429_at_attempt: out.pair_limit.findIndex(a => a.status === 429) + 1, bad_code_before_lock: out.pair_limit.filter(a => a.error === 'bad_pairing_code').length };
  const pairLocked = await call('/api/pair', { method: 'POST', body: { code: CODE, name: 'y' }, ip: '203.0.113.9' });
  out.correct_pair_during_lock = { status: pairLocked.status, error: pairLocked.error, note: 'the limit sits before verify, so a genuine device on that IP is also locked out for 15 min' };
  // a DIFFERENT IP is unaffected — the limit is per IP, not global
  const otherIp = await call('/api/pair', { method: 'POST', body: { code: CODE, name: 'z' }, ip: '198.51.100.5' });
  out.pair_other_ip_ok = { status: otherIp.status, paired: !!(otherIp.body && otherIp.body.device_token) };
}

// ── bypass: successful pairings are unlimited; each device gets its own 5-guess PIN budget ──
{
  const { call, setPin, pairDevice } = await fresh();
  await setPin('christian', '9999');   // the PIN under attack (unknown to the attacker)
  const N = 30; let devicesPaired = 0, reachedVerify = 0, blocked429 = 0;
  for (let n = 0; n < N; n++) {
    const dv = await pairDevice('brute-' + n); if (!dv) break; devicesPaired++;   // pairing never 429s from one IP: rateClear on success
    for (let g = 0; g < 6; g++) {
      const r = await call('/api/login', { method: 'POST', body: { profile_id: 'christian', pin: String(1000 + n * 6 + g) }, dt: dv });
      if (r.status === 429) blocked429++; else reachedVerify++;
    }
  }
  out.bypass = {
    devices_paired_one_ip: devicesPaired,
    guesses_reaching_verify: reachedVerify,
    guesses_blocked_429: blocked429,
    guesses_per_15min_per_extra_device: 5,
    note: 'each newly paired device gets its own login:<profile>:<device> counter; pairing succeeds unlimited from one IP because /api/pair calls rateClear on a correct code',
  };
  out.time_to_exhaust_4digit = {
    space: 10000, guesses_per_device_per_15min: 5,
    devices_to_cover_whole_space_in_15min: Math.ceil(10000 / 5),
    with_100_devices_expected_windows: Math.ceil(5000 / (5 * 100)),
    with_100_devices_expected_minutes: Math.ceil(5000 / (5 * 100)) * 15,
    with_1000_devices_worst_case_minutes: Math.ceil(10000 / (5 * 1000)) * 15,
  };
}

// ── first-tap create-PIN: no rate limit; a paired device claims a PIN-less adult in one call ──
{
  const { call, clearPin, pairDevice } = await fresh();
  clearPin('niece');   // Mea has never signed in — pin_hash NULL
  const attacker = await pairDevice('attacker');
  const first = await call('/api/profiles/niece/pin', { method: 'POST', body: { pin: '7777' }, dt: attacker });
  out.create_pin_claim = { status: first.status, got_session_token: !!(first.body && first.body.profile_token), name: first.body && first.body.profile && first.body.profile.name, note: 'attacker device now holds a valid session as Mea; the real Mea is locked out and must ask the admin to reset' };
  // hammer create-PIN on a fresh PIN-less profile to show no 429 ever (route has no rateCheck/rateHit)
  const { call: call2, clearPin: clear2, pairDevice: pair2 } = await fresh();
  clear2('niece'); const dv = await pair2('spam'); let any429 = false, statuses = [];
  for (let i = 0; i < 12; i++) { const r = await call2('/api/profiles/niece/pin', { method: 'POST', body: { pin: '7777' }, dt: dv }); statuses.push(r.status); if (r.status === 429) any429 = true; }
  out.create_pin_no_rate_limit = { attempts: 12, any_429: any429, statuses_seen: [...new Set(statuses)], note: 'first sets the PIN (200); the rest are 409 pin_already_set — never 429, so there is no throttle on this route' };
}

console.log(JSON.stringify(out, null, 1));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'rate-limits.json'), JSON.stringify(out, null, 1));
