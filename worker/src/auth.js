// Hashing, tokens, request authentication and rate limiting.

const enc = new TextEncoder();
export const PBKDF2_ITER = 10000;   // modest on purpose: Workers free tier allows ~10 ms CPU per request;
                                    // online rate limiting (below) is the real defence for 4–8 digit PINs.
const SESSION_MS = 365 * 86400000;

export const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));
export const randomId = () => randomToken(9);
export const sha256 = async s => b64url(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function pbkdf2(secret, saltB64, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(atob(saltB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  return b64url(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}

// Format: pbkdf2:<iter>:<salt>:<hash>  (no '$' so the string survives every shell unquoted)
export async function hashSecret(secret) {
  const salt = randomToken(16);
  return `pbkdf2:${PBKDF2_ITER}:${salt}:${await pbkdf2(secret, salt, PBKDF2_ITER)}`;
}

export async function verifySecret(secret, stored) {
  if (typeof secret !== 'string' || typeof stored !== 'string') return false;
  const [algo, iter, salt, hash] = stored.split(':');
  if (algo !== 'pbkdf2' || !salt || !hash) return false;
  return constantEqual(await pbkdf2(secret, salt, +iter), hash);
}

export function constantEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class HttpError extends Error {
  constructor(status, error, message, extra) { super(message || error); this.status = status; this.error = error; this.extra = extra; }
}

/** A guest whose stay is over: hidden from the picker (except for the admin), cannot sign in, sessions stop working. */
export const isExpiredGuest = (p, now = Date.now()) => !!(p && p.is_guest && p.expires_at != null && +p.expires_at < now);

/**
 * Cuts an expired guest off from the house: their sessions and push subscriptions go, so no device keeps a live
 * token and the reminder jobs (which push to every adult) can no longer reach the departed visitor's phone.
 * Their person-scope data stays for the 30-day retention window. `profileId` limits it to one guest; without it
 * every guest whose stay has ended is handled (run before each cron so a natural expiry needs no request first).
 */
export async function silenceExpiredGuests(env, now = Date.now(), profileId = null) {
  const where = profileId
    ? { sql: 'profile_id = ? AND profile_id IN (SELECT id FROM profiles WHERE is_guest = 1 AND expires_at IS NOT NULL AND expires_at < ?)', args: [profileId, now] }
    : { sql: 'profile_id IN (SELECT id FROM profiles WHERE is_guest = 1 AND expires_at IS NOT NULL AND expires_at < ?)', args: [now] };
  const [subs, sess] = await env.DB.batch([
    env.DB.prepare('DELETE FROM push_subscriptions WHERE ' + where.sql).bind(...where.args),
    env.DB.prepare('DELETE FROM sessions WHERE ' + where.sql).bind(...where.args),
  ]);
  return { push_subscriptions: subs.meta.changes || 0, sessions: sess.meta.changes || 0 };
}

export const publicProfile = p => p && ({
  id: p.id, name: p.name, emoji: p.emoji, color: p.color, kind: p.kind, hue: p.hue || null,
  is_admin: !!p.is_admin, sort_order: p.sort_order, has_pin: p.pin_hash != null,
  // an admin reset (P2-PROF-04) waits for the one-time code the admin was shown; the picker asks for it first
  pin_reset: p.pin_hash == null && p.pin_reset_hash != null,
  // guests (migrations/005): added on demand by an adult; expires_at ms or null = keep; created_by = who added them
  is_guest: !!p.is_guest, expires_at: p.expires_at == null ? null : +p.expires_at, created_by: p.is_guest ? (p.created_by || null) : null,
  photo: p.photo ? { sm: `/api/media/photos/${p.id}/${p.photo}-256.jpg`, lg: `/api/media/photos/${p.id}/${p.photo}-1024.jpg` } : null,
});

/** Resolves the device (required) and profile (optional) behind a request. */
export async function authenticate(request, env, ctx) {
  const dt = request.headers.get('X-Device-Token');
  if (!dt) throw new HttpError(401, 'device_not_paired', 'This device is not paired with the house.');
  const device = await env.DB.prepare('SELECT * FROM devices WHERE token_hash = ?').bind(await sha256(dt)).first();
  if (!device) throw new HttpError(401, 'device_not_paired', 'This device is not paired with the house.');

  const now = Date.now();
  if (now - device.last_seen > 5 * 60000) {
    ctx.waitUntil(env.DB.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').bind(now, device.id).run());
  }

  let profile = null;
  const pt = request.headers.get('X-Profile-Token');
  if (pt) {
    const row = await env.DB.prepare(
      `SELECT p.*, s.device_id AS session_device, s.expires_at AS session_expires
         FROM sessions s JOIN profiles p ON p.id = s.profile_id
        WHERE s.token_hash = ?`).bind(await sha256(pt)).first();
    if (!row || row.session_expires < now || row.session_device !== device.id) {
      // a session that ran out on this device takes the person's notifications here with it (review of batch 2b)
      if (row && row.session_device === device.id) ctx.waitUntil(env.DB.prepare('DELETE FROM push_subscriptions WHERE profile_id = ? AND device_id = ?').bind(row.id, device.id).run().catch(() => {}));
      throw new HttpError(401, 'profile_session_invalid', 'Please choose your profile again.');
    }
    if (isExpiredGuest(row, now)) {
      // the stay ended while this device still held a token: drop every session and push subscription the guest had
      ctx.waitUntil(silenceExpiredGuests(env, now, row.id).catch(() => {}));
      throw new HttpError(401, 'profile_session_invalid', 'This guest pass has ended.');
    }
    // KITCHEN-1: the kitchen profile lives only on a kitchen device, and a kitchen device holds no personal session.
    // A role changed since the session began ends that session here, on its next request.
    if ((row.kind === 'kitchen') !== (device.role === 'kitchen')) {
      ctx.waitUntil(env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(pt)).run().catch(() => {}));
      throw new HttpError(401, 'profile_session_invalid', device.role === 'kitchen' ? 'This device is the kitchen now.' : 'This device is no longer the kitchen.');
    }
    profile = row;
  }
  return { device, profile };
}

export function requireProfile(auth) {
  if (!auth.profile) throw new HttpError(401, 'profile_required', 'Choose a profile first.');
  return auth.profile;
}
export function requireWriter(auth) {
  const p = requireProfile(auth);
  if (p.kind === 'kiosk') throw new HttpError(403, 'read_only', 'This profile can only look, not change things.');
  return p;
}
export function requireAdmin(auth) {
  const p = requireProfile(auth);
  if (!p.is_admin) throw new HttpError(403, 'admin_only', 'Only the admin can do that.');
  return p;
}

/**
 * A new sign-in on a device. The device's notifications belong to whoever is signed in there (P2-PWA-03, review of batch
 * 2b): any other person's subscription on this device goes now, however their session ended (Switch, Reset PIN, a new
 * kind, a year's expiry, any 401), so the next person never receives the previous person's pushes.
 */
export async function createSession(env, profileId, deviceId) {
  const token = randomToken();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token_hash, profile_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256(token), profileId, deviceId, now, now + SESSION_MS),
    env.DB.prepare('DELETE FROM push_subscriptions WHERE device_id = ? AND profile_id != ?').bind(deviceId, profileId),
  ]);
  return token;
}

// ── rate limiting (fixed window, stored in D1) ─────────────────
export async function rateCheck(env, key, max) {
  const row = await env.DB.prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?').bind(key).first();
  if (row && row.reset_at > Date.now() && row.count >= max) {
    const retry = Math.ceil((row.reset_at - Date.now()) / 1000);
    throw new HttpError(429, 'too_many_attempts', `Too many attempts. Try again in ${Math.ceil(retry / 60)} min.`, { retry_after: retry });
  }
}
export async function rateHit(env, key, windowMs) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count    = CASE WHEN reset_at > ? THEN count + 1 ELSE 1 END,
         reset_at = CASE WHEN reset_at > ? THEN reset_at ELSE ? END`)
    .bind(key, now + windowMs, now, now, now + windowMs).run();
}
export const rateClear = (env, key) => env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();

// ── PIN and reset-code attempts (P2-SEC-01) ────────────────────
// Every PIN or one-time code attempt is counted BEFORE it is checked, with an atomic upsert, so a burst of parallel
// guesses cannot slip past the count. Two counters: per device (5 per 15 min, as before) and per profile across every
// device (10 per hour). The 10th wrong one pauses that profile's sign-ins for 1 h, then 2 h, 4 h … up to 24 h for each
// further pause within a week, and pushes the admin. Pairing more devices buys no more guesses. A device the person has
// signed in on before (pintrust:<profile>:<device>, kept a year) is not held by the profile-wide pause, only by its own
// per-device limits (5 per 15 min, 20 a day), so nobody can lock a person, the admin included, out of their own phone. A right answer takes its
// own attempt back off the profile count. The admin's Reset PIN clears everything for that profile (index.js).
const MIN_MS = 60000;
export const PIN_PER_DEVICE = 5, PIN_PER_PROFILE = 10;
const PIN_WINDOW = 60 * MIN_MS, PIN_BACKOFF_MAX = 24 * 60 * MIN_MS, STRIKE_WINDOW = 7 * 24 * 60 * MIN_MS, TRUST_MS = 365 * 24 * 60 * MIN_MS;
const PAUSED = 1000;   // a profile counter at or above this is a pause (set by pinFail), whatever the attempts since
export const pinKeys = (profileId, deviceId) => ({ device: `login:${profileId}:${deviceId}`, day: `login:${profileId}:${deviceId}:day`, profile: `pinp:${profileId}`, strikes: `pinstrike:${profileId}`, trust: `pintrust:${profileId}:${deviceId}` });
const PIN_PER_DEVICE_DAY = 20;   // a trusted device skips the profile-wide pause, not this: 20 wrong a day, then it waits too

/** One more attempt on a fixed-window counter, atomically: returns the count and window end after this attempt. */
async function bump(env, key, windowMs) {
  const now = Date.now();
  return env.DB.prepare(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count    = CASE WHEN reset_at > ? THEN count + 1 ELSE 1 END,
         reset_at = CASE WHEN reset_at > ? THEN reset_at ELSE ? END
     RETURNING count, reset_at`).bind(key, now + windowMs, now, now, now + windowMs).first();
}
const tooMany = resetAt => { const retry = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)); return new HttpError(429, 'too_many_attempts', `Too many attempts. Try again in ${Math.ceil(retry / 60)} min.`, { retry_after: retry }); };

/** Counts this attempt; throws 429 when this device, or (on a device the person has not used) the profile, is over its limit. */
export async function pinCheck(env, profileId, deviceId) {
  const k = pinKeys(profileId, deviceId);
  const trusted = await env.DB.prepare('SELECT 1 AS t FROM rate_limits WHERE key = ? AND reset_at > ?').bind(k.trust, Date.now()).first();
  const d = await bump(env, k.device, 15 * MIN_MS);
  if (d.count > PIN_PER_DEVICE) throw tooMany(d.reset_at);
  const day = await bump(env, k.day, 24 * 60 * MIN_MS);
  if (day.count > PIN_PER_DEVICE_DAY) throw tooMany(day.reset_at);
  const p = await bump(env, k.profile, PIN_WINDOW);
  if (!trusted && p.count > PIN_PER_PROFILE) throw tooMany(p.reset_at);
}
/** After a wrong answer (already counted): the attempt that reaches the profile limit starts a pause. Returns { paused: ms }. */
export async function pinFail(env, profileId, deviceId) {
  const k = pinKeys(profileId, deviceId);
  const s = await env.DB.prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?').bind(k.strikes).first();
  const strikes = s && s.reset_at > Date.now() ? s.count : 0;
  const pause = Math.min(PIN_BACKOFF_MAX, PIN_WINDOW * 2 ** strikes);
  // only one request can move the counter from "10 or more" to PAUSED, so the pause and the alert happen once
  const r = await env.DB.prepare('UPDATE rate_limits SET count = ?, reset_at = ? WHERE key = ? AND count >= ? AND count < ?')
    .bind(PAUSED, Date.now() + pause, k.profile, PIN_PER_PROFILE, PAUSED).run();
  if (!r.meta.changes) return { paused: 0 };
  await rateHit(env, k.strikes, STRIKE_WINDOW);
  return { paused: pause };
}
/** After a right answer: this device's counter goes, the attempt comes off the profile count, and the device is trusted. */
export async function pinClear(env, profileId, deviceId) {
  const k = pinKeys(profileId, deviceId), now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(k.device),
    env.DB.prepare('UPDATE rate_limits SET count = count - 1 WHERE key = ? AND count > 0').bind(k.day),
    env.DB.prepare('UPDATE rate_limits SET count = count - 1 WHERE key = ? AND count > 0 AND count < ?').bind(k.profile, PAUSED),
    env.DB.prepare('INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET reset_at = excluded.reset_at').bind(k.trust, now + TRUST_MS),
  ]);
}
/** The admin's unlock: every wrong-attempt counter of this profile, on every device (trusted devices stay trusted). */
export const pinUnlock = (env, profileId) => env.DB.prepare('DELETE FROM rate_limits WHERE key LIKE ? OR key = ? OR key = ?')
  .bind(`login:${profileId}:%`, `pinp:${profileId}`, `pinstrike:${profileId}`).run();

/** A six-digit one-time code (P2-PROF-04), from the CSPRNG. */
export function oneTimeCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, '0');
}
