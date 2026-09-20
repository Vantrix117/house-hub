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
  id: p.id, name: p.name, emoji: p.emoji, color: p.color, kind: p.kind,
  is_admin: !!p.is_admin, sort_order: p.sort_order, has_pin: p.pin_hash != null,
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
      throw new HttpError(401, 'profile_session_invalid', 'Please choose your profile again.');
    }
    if (isExpiredGuest(row, now)) {
      // the stay ended while this device still held a token: drop every session and push subscription the guest had
      ctx.waitUntil(silenceExpiredGuests(env, now, row.id).catch(() => {}));
      throw new HttpError(401, 'profile_session_invalid', 'This guest pass has ended.');
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

export async function createSession(env, profileId, deviceId) {
  const token = randomToken();
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, profile_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), profileId, deviceId, now, now + SESSION_MS).run();
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
