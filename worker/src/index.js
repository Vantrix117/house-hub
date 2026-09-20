/**
 * House Hub API — Cloudflare Worker + D1.
 *
 * Auth headers:
 *   X-Device-Token   from POST /api/pair (required on every /api route except /api/pair and /api/health)
 *   X-Profile-Token  from POST /api/login or POST /api/profiles/:id/pin (required for person-scope
 *                    reads, all writes, and /api/admin/*)
 *
 * Deploy from this folder:  npx wrangler deploy
 * Schema / seed:            npx wrangler d1 execute house-hub --remote --file schema.sql   (then seed.sql)
 * Pairing code:             node ../scripts/set-pairing-code.mjs
 */
import {
  HttpError, authenticate, requireProfile, requireWriter, requireAdmin, createSession,
  hashSecret, verifySecret, sha256, randomToken, randomId, publicProfile, isExpiredGuest, silenceExpiredGuests,
  rateCheck, rateHit, rateClear,
} from './auth.js';
import { listData, getOne, putOne, checkScope, checkKey } from './data.js';
import { runCron, pushTo, vapidFrom, JOBS } from './reminders.js';
import { chatHandler, chatHistory } from './chat.js';
import { decodeImage, putMedia, getMedia, deletePrefix, MAX_SM, MAX_LG } from './media.js';

const PIN_RE = /^\d{4,8}$/;
const MIN = 60000;

// ── response helpers ──────────────────────────────────────────
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Device-Token, X-Profile-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });

async function readJson(request) {
  try { return (await request.json()) ?? {}; }
  catch { throw new HttpError(400, 'bad_json', 'Request body must be JSON.'); }
}
const clientIp = r => r.headers.get('CF-Connecting-IP') || 'local';

// ── routes ────────────────────────────────────────────────────
// route(method, pattern, handler(c)) — c = { request, env, exec, url, params, body(), auth() }
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: pathRe(pattern), handler });
function pathRe(pattern) {
  return new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, '(?<$1>[^/]+)') + '\\/?$');
}

route('GET', '/api/health', async () => ({ ok: true, time: Date.now() }));

// Pair this device with the house using the one-time pairing code.
route('POST', '/api/pair', async c => {
  const key = 'pair:' + clientIp(c.request);
  await rateCheck(c.env, key, 10);
  const { code, name } = await c.body();
  const stored = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'pairing_code_hash'").first('value');
  if (!stored) throw new HttpError(503, 'pairing_not_configured', 'No pairing code has been set yet (scripts/set-pairing-code.mjs).');
  if (!(await verifySecret(String(code || ''), stored))) {
    await rateHit(c.env, key, 15 * MIN);
    throw new HttpError(401, 'bad_pairing_code', 'That pairing code is not right.');
  }
  await rateClear(c.env, key);
  const token = randomToken(), id = randomId(), now = Date.now();
  await c.env.DB.prepare('INSERT INTO devices (id, name, token_hash, paired_at, last_seen) VALUES (?, ?, ?, ?, ?)')
    .bind(id, String(name || '').slice(0, 80), await sha256(token), now, now).run();
  return { device_id: id, device_token: token };
});

// Everyone in the house. Guests whose stay has ended are left out unless the caller is the admin
// (the admin panel lists them with a Purge button until their data is gone).
route('GET', '/api/profiles', async c => {
  const auth = await c.auth();
  const admin = !!(auth.profile && auth.profile.is_admin);
  const now = Date.now();
  const { results } = await c.env.DB.prepare('SELECT * FROM profiles ORDER BY sort_order, name').all();
  return { profiles: results.filter(p => admin || !isExpiredGuest(p, now)).map(publicProfile) };
});

// ── guests (roadmap 23) ───────────────────────────────────────
// A household adult adds a guest profile on demand: kind 'adult', is_guest 1, never admin, id 'guest-<random>'.
// {name, emoji?|icon?, color?, pin?, expires_at?}: pin is optional (a guest without one signs in on tap),
// expires_at is ms since epoch (null/omitted = keep). Kids, the display and guests themselves cannot add guests.
const GUEST_RETENTION_MS = 30 * 86400000;   // an expired guest's data is kept this long, then the cron purge removes it
route('POST', '/api/profiles', async c => {
  const me = requireWriter(await c.auth());
  if (me.kind !== 'adult') throw new HttpError(403, 'adults_only', 'Ask a grown-up to add a guest.');
  if (me.is_guest) throw new HttpError(403, 'guests_cannot_invite', 'Guests cannot add other guests.');
  const b = await c.body();
  const name = String(b.name || '').trim().slice(0, 40);
  if (!name) throw new HttpError(400, 'bad_name', 'Name is required.');
  const emoji = String(b.emoji || b.icon || '🙂').trim().slice(0, 8) || '🙂';
  const color = b.color === undefined || b.color === null || b.color === '' ? '#8A6A4B' : String(b.color);
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new HttpError(400, 'bad_color', 'Color must be #rrggbb.');
  let pinHash = null;
  if (b.pin !== undefined && b.pin !== null && b.pin !== '') {
    if (!PIN_RE.test(String(b.pin))) throw new HttpError(400, 'bad_pin', 'PIN must be 4 to 8 digits.');
    pinHash = await hashSecret(String(b.pin));
  }
  let expiresAt = null;
  if (b.expires_at !== undefined && b.expires_at !== null && b.expires_at !== '') {
    expiresAt = Math.floor(+b.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) throw new HttpError(400, 'bad_expiry', 'expires_at must be milliseconds since the epoch, or null to keep the guest.');
  }
  const id = 'guest-' + randomId();
  const sort = ((await c.env.DB.prepare('SELECT MAX(sort_order) AS m FROM profiles').first('m')) || 0) + 1;
  await c.env.DB.prepare(
    `INSERT INTO profiles (id, name, emoji, color, kind, pin_hash, is_admin, sort_order, is_guest, created_by, expires_at)
       VALUES (?, ?, ?, ?, 'adult', ?, 0, ?, 1, ?, ?)`).bind(id, name, emoji, color, pinHash, sort, me.id, expiresAt).run();
  await c.env.DB.prepare('INSERT INTO activity (profile_id, app_id, text, created_at) VALUES (?, ?, ?, ?)')
    .bind(me.id, 'hub', `Added a guest: ${name}`, Date.now()).run();
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(id).first();
  return { profile: publicProfile(p) };
});

/** Removes a guest profile and everything that was theirs: person-scope rows, sessions, push subscriptions, chat, photos. */
async function deleteGuest(env, p) {
  await deletePrefix(env, `photos/${p.id}/`);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM app_data WHERE scope = 'person' AND profile_id = ?").bind(p.id),
    env.DB.prepare('DELETE FROM sessions WHERE profile_id = ?').bind(p.id),
    env.DB.prepare('DELETE FROM push_subscriptions WHERE profile_id = ?').bind(p.id),
    env.DB.prepare('DELETE FROM chat_log WHERE profile_id = ?').bind(p.id),
    env.DB.prepare('DELETE FROM push_log WHERE profile_id = ?').bind(p.id),
    env.DB.prepare('DELETE FROM activity WHERE profile_id = ?').bind(p.id),
    env.DB.prepare('DELETE FROM rate_limits WHERE key LIKE ?').bind(`login:${p.id}:%`),
    env.DB.prepare('DELETE FROM profiles WHERE id = ? AND is_guest = 1').bind(p.id),
  ]);
}
/**
 * Cron: every guest whose stay has ended loses their sessions and push subscriptions at once (so the reminder jobs
 * never reach a departed visitor); guests expired more than 30 days ago lose their profile and data. Returns both.
 */
export async function purgeExpiredGuests(env, now = Date.now()) {
  const silenced = await silenceExpiredGuests(env, now);
  const { results } = await env.DB.prepare('SELECT * FROM profiles WHERE is_guest = 1 AND expires_at IS NOT NULL AND expires_at < ?')
    .bind(now - GUEST_RETENTION_MS).all();
  for (const p of results) await deleteGuest(env, p);
  return { job: 'guests', purged: results.map(p => p.id), silenced };
}

route('POST', '/api/login', async c => {
  const { device } = await c.auth();
  const { profile_id, pin } = await c.body();
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(String(profile_id || '')).first();
  if (!p) throw new HttpError(404, 'no_such_profile', 'No profile with that id.');
  if (isExpiredGuest(p)) throw new HttpError(403, 'guest_expired', `${p.name}'s guest pass has ended.`);
  // a guest without a PIN signs in on tap (the person who added them chose that); everyone else with kind adult needs one
  if (p.kind === 'adult' && !(p.is_guest && p.pin_hash == null)) {
    if (p.pin_hash == null) throw new HttpError(403, 'needs_pin_setup', `${p.name} has not created a PIN yet.`);
    const key = `login:${p.id}:${device.id}`;
    await rateCheck(c.env, key, 5);
    if (!(await verifySecret(String(pin ?? ''), p.pin_hash))) {
      await rateHit(c.env, key, 15 * MIN);
      throw new HttpError(401, 'wrong_pin', 'Wrong PIN.');
    }
    await rateClear(c.env, key);
  }
  return { profile_token: await createSession(c.env, p.id, device.id), profile: publicProfile(p) };
});

// First-time PIN creation: only while pin_hash is NULL, only from a paired device.
route('POST', '/api/profiles/:id/pin', async c => {
  const { device } = await c.auth();
  const { pin } = await c.body();
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(c.params.id).first();
  if (!p) throw new HttpError(404, 'no_such_profile', 'No profile with that id.');
  if (p.kind !== 'adult') throw new HttpError(400, 'no_pin_for_kind', 'Only adult profiles have a PIN.');
  // guests (roadmap 23): a guest's PIN is chosen when they are added (or cleared by the admin). A guest without one
  // signs in on tap, so letting any paired device "create" a PIN for them would lock the guest out or hijack the profile.
  if (p.is_guest) throw new HttpError(403, 'guest_pin_fixed', `${p.name} is a guest: their PIN was chosen when they were added. Ask the admin to clear it.`);
  if (p.pin_hash != null) throw new HttpError(409, 'pin_already_set', 'A PIN is already set. Ask the admin to reset it.');
  if (!PIN_RE.test(String(pin ?? ''))) throw new HttpError(400, 'bad_pin', 'PIN must be 4 to 8 digits.');
  const r = await c.env.DB.prepare('UPDATE profiles SET pin_hash = ? WHERE id = ? AND pin_hash IS NULL')
    .bind(await hashSecret(String(pin)), p.id).run();
  if (!r.meta.changes) throw new HttpError(409, 'pin_already_set', 'A PIN was just set from another device.');
  p.pin_hash = 'set';
  return { profile_token: await createSession(c.env, p.id, device.id), profile: publicProfile(p) };
});

route('GET', '/api/me', async c => ({ profile: publicProfile(requireProfile(await c.auth())) }));

route('POST', '/api/logout', async c => {
  await c.auth();
  const pt = c.request.headers.get('X-Profile-Token');
  if (pt) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(pt)).run();
  return { ok: true };
});

// ── app data ──────────────────────────────────────────────────
function dataArgs(c, auth, needWriter) {
  const scope = checkScope(c.url.searchParams.get('scope') || 'person');
  const profile = needWriter ? requireWriter(auth) : (scope === 'person' ? requireProfile(auth) : auth.profile);
  return { appId: checkKey(c.params.appId), scope, profile };
}

route('GET', '/api/data/:appId', async c => {
  const auth = await c.auth();
  const args = dataArgs(c, auth, false);
  const since = +(c.url.searchParams.get('since') || 0) || 0;
  const prefix = c.url.searchParams.get('prefix') || '';
  const key = c.url.searchParams.get('key');
  // `now` is taken before the query so a client can safely use it as the next `since`.
  const now = Date.now() - 1;
  if (key) return { item: await getOne(c.env, { ...args, key: checkKey(key) }), now };
  return { items: await listData(c.env, { ...args, since, prefix }), now };
});

route('PUT', '/api/data/:appId/:key', async c => {
  const auth = await c.auth();
  const { value, updated_at } = await c.body();
  return putOne(c.env, { ...dataArgs(c, auth, true), key: checkKey(c.params.key), value, updated_at });
});

route('DELETE', '/api/data/:appId/:key', async c => {
  const auth = await c.auth();
  return putOne(c.env, { ...dataArgs(c, auth, true), key: checkKey(c.params.key), value: null, updated_at: Date.now() });
});

// Flush a whole offline queue in one round trip.
route('POST', '/api/data/:appId/batch', async c => {
  const auth = await c.auth();
  const args = dataArgs(c, auth, true);
  const { items } = await c.body();
  if (!Array.isArray(items) || items.length > 200) throw new HttpError(400, 'bad_batch', 'items must be an array of at most 200.');
  const results = [];
  for (const it of items) results.push(await putOne(c.env, { ...args, key: checkKey(it.key), value: it.value, updated_at: it.updated_at }));
  return { results, now: Date.now() };
});

// ── activity feed ─────────────────────────────────────────────
route('GET', '/api/activity', async c => {
  await c.auth();
  const limit = Math.min(100, Math.max(1, +(c.url.searchParams.get('limit') || 30) || 30));
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.profile_id, a.app_id, a.text, a.created_at, p.name, p.emoji, p.color, p.photo
       FROM activity a LEFT JOIN profiles p ON p.id = a.profile_id
      ORDER BY a.created_at DESC, a.id DESC LIMIT ?`).bind(limit).all();
  return { activity: results.map(r => ({ ...r, photo: r.photo ? { sm: `/api/media/photos/${r.profile_id}/${r.photo}-256.jpg` } : null })) };
});

// ── photos + the family album ─────────────────────────────────
// Bytes are stored by src/media.js (R2 when bound, else D1). Keys carry a random token, so GET /api/media/* needs no auth.
function canEditPhoto(auth, id) {
  const p = requireWriter(auth);
  if (p.id !== id && !p.is_admin) throw new HttpError(403, 'not_yours', 'You can only change your own photo.');
  if (p.id === id && p.kind !== 'adult' && !p.is_admin) throw new HttpError(403, 'adults_only', 'Ask a grown-up to set your photo.');
  return p;
}
route('PUT', '/api/profiles/:id/photo', async c => {
  canEditPhoto(await c.auth(), c.params.id);
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(c.params.id).first();
  if (!p) throw new HttpError(404, 'no_such_profile', 'No profile with that id.');
  const b = await c.body();
  const sm = decodeImage(b.sm, MAX_SM, 'The small photo'), lg = decodeImage(b.lg, MAX_LG, 'The large photo');
  const token = randomId();
  await putMedia(c.env, `photos/${p.id}/${token}-256.jpg`, sm);
  await putMedia(c.env, `photos/${p.id}/${token}-1024.jpg`, lg);
  await c.env.DB.prepare('UPDATE profiles SET photo = ? WHERE id = ?').bind(token, p.id).run();
  if (p.photo) c.exec.waitUntil(deletePrefix(c.env, `photos/${p.id}/${p.photo}-`));
  return { profile: publicProfile({ ...p, photo: token }) };
});
route('DELETE', '/api/profiles/:id/photo', async c => {
  canEditPhoto(await c.auth(), c.params.id);
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(c.params.id).first();
  if (!p) throw new HttpError(404, 'no_such_profile', 'No profile with that id.');
  await c.env.DB.prepare('UPDATE profiles SET photo = NULL WHERE id = ?').bind(p.id).run();
  await deletePrefix(c.env, `photos/${p.id}/`);
  return { profile: publicProfile({ ...p, photo: null }) };
});
// Album photos are family-scope app_data rows (app 'hub', key 'album:<id>') so every device syncs them like any list.
route('POST', '/api/album', async c => {
  const p = requireWriter(await c.auth());
  if (p.kind !== 'adult') throw new HttpError(403, 'adults_only', 'Ask a grown-up to add photos.');
  const b = await c.body();
  const sm = decodeImage(b.sm, MAX_SM, 'The thumbnail'), lg = decodeImage(b.lg, MAX_LG, 'The photo');
  const id = randomId();
  await putMedia(c.env, `album/${id}-256.jpg`, sm);
  await putMedia(c.env, `album/${id}-1024.jpg`, lg);
  const value = { id, sm: `/api/media/album/${id}-256.jpg`, lg: `/api/media/album/${id}-1024.jpg`, by: p.id, byName: p.name, caption: String(b.caption || '').trim().slice(0, 140), at: Date.now() };
  const row = await putOne(c.env, { appId: 'hub', scope: 'family', profile: p, key: 'album:' + id, value });
  return { photo: value, row };
});
route('DELETE', '/api/album/:id', async c => {
  const p = requireWriter(await c.auth());
  const id = c.params.id;
  const row = await getOne(c.env, { appId: 'hub', scope: 'family', profile: p, key: 'album:' + id });
  if (!row || row.value == null) throw new HttpError(404, 'no_such_photo', 'That photo is already gone.');
  const v = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  if (v.by !== p.id && !p.is_admin) throw new HttpError(403, 'not_yours', 'Only the person who added a photo (or the admin) can remove it.');
  await putOne(c.env, { appId: 'hub', scope: 'family', profile: p, key: 'album:' + id, value: null });
  await deletePrefix(c.env, `album/${id}-`);
  return { ok: true };
});
route('GET', '/api/media/:folder/:a/:b', async c => serveMedia(c, `${c.params.folder}/${c.params.a}/${c.params.b}`));
route('GET', '/api/media/:folder/:a', async c => serveMedia(c, `${c.params.folder}/${c.params.a}`));
async function serveMedia(c, key) {
  if (!/^(photos|album)\/[\w-]+(\/[\w-]+)?\.jpg$/.test(key)) throw new HttpError(404, 'not_found', 'Not found');
  const m = await getMedia(c.env, key);
  if (!m) throw new HttpError(404, 'not_found', 'No such photo.');
  return new Response(m.bytes, { headers: { 'Content-Type': m.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' } });
}

route('POST', '/api/activity', async c => {
  const p = requireWriter(await c.auth());
  const { app_id, text } = await c.body();
  const t = String(text || '').trim().slice(0, 200);
  if (!t) throw new HttpError(400, 'bad_text', 'text is required.');
  const now = Date.now();
  const app = checkKey(String(app_id || 'hub'));
  const r = await c.env.DB.prepare('INSERT INTO activity (profile_id, app_id, text, created_at) VALUES (?, ?, ?, ?)')
    .bind(p.id, app, t, now).run();
  return { id: r.meta.last_row_id, profile_id: p.id, app_id: app, text: t, created_at: now, name: p.name, emoji: p.emoji, color: p.color };
});

// ── push ──────────────────────────────────────────────────────
route('GET', '/api/push/config', async c => {
  await c.auth();
  return { public_key: c.env.VAPID_PUBLIC_KEY || null, enabled: !!vapidFrom(c.env) };
});
route('POST', '/api/push/subscribe', async c => {
  const auth = await c.auth();
  const p = requireProfile(auth);
  const { subscription } = await c.body();
  if (!subscription || typeof subscription.endpoint !== 'string') throw new HttpError(400, 'bad_subscription', 'subscription.endpoint is required.');
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (profile_id, device_id, subscription, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(profile_id, device_id) DO UPDATE SET subscription = excluded.subscription, created_at = excluded.created_at`)
    .bind(p.id, auth.device.id, JSON.stringify(subscription), Date.now()).run();
  return { ok: true };
});
route('DELETE', '/api/push/subscribe', async c => {
  const auth = await c.auth();
  const p = requireProfile(auth);
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE profile_id = ? AND device_id = ?').bind(p.id, auth.device.id).run();
  return { ok: true };
});

// ── chat ──────────────────────────────────────────────────────
route('POST', '/api/chat', async c => {
  const auth = await c.auth(); const p = requireProfile(auth);
  if (p.kind === 'kiosk') throw new HttpError(403, 'no_chat', 'The display profile has no chat.');
  if (p.is_guest) {
    // guests (roadmap 23): apps.json's visibleTo lists household ids, so add the guest to every app any household adult can see
    const raw = await c.body();
    const adults = (await c.env.DB.prepare("SELECT id FROM profiles WHERE kind = 'adult' AND is_guest = 0").all()).results.map(r => r.id);
    const apps = Array.isArray(raw.apps) ? raw.apps.map(a => a && Array.isArray(a.visibleTo) && a.visibleTo.some(id => adults.includes(id)) ? { ...a, visibleTo: [...a.visibleTo, p.id] } : a) : raw.apps;
    const body = { ...raw, apps };
    c.body = async () => body;
  }
  return chatHandler(c, auth);
});
route('GET', '/api/chat/history', async c => { const auth = await c.auth(); requireProfile(auth); return chatHistory(c, auth); });

// ── admin ─────────────────────────────────────────────────────
route('POST', '/api/admin/profiles/:id/reset-pin', async c => {
  requireAdmin(await c.auth());
  const r = await c.env.DB.prepare('UPDATE profiles SET pin_hash = NULL WHERE id = ?').bind(c.params.id).run();
  if (!r.meta.changes) throw new HttpError(404, 'no_such_profile', 'No profile with that id.');
  await c.env.DB.prepare('DELETE FROM sessions WHERE profile_id = ?').bind(c.params.id).run();
  return { ok: true, id: c.params.id };
});

route('PUT', '/api/admin/profiles/:id', async c => {
  requireAdmin(await c.auth());
  const b = await c.body();
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(c.params.id).first();
  if (!p) throw new HttpError(404, 'no_such_profile', 'No profile with that id.');
  const name = b.name !== undefined ? String(b.name).trim().slice(0, 40) : p.name;
  const emoji = b.emoji !== undefined ? String(b.emoji).slice(0, 8) : p.emoji;
  const color = b.color !== undefined ? String(b.color) : p.color;
  const kind = b.kind !== undefined ? String(b.kind) : p.kind;
  const sort = b.sort_order !== undefined ? (+b.sort_order || 0) : p.sort_order;
  let expiresAt = p.expires_at;   // guests only: ms since epoch, null = keep (lets the admin extend or end a stay)
  if (p.is_guest && b.expires_at !== undefined) {
    expiresAt = b.expires_at === null || b.expires_at === '' ? null : Math.floor(+b.expires_at);
    if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= 0)) throw new HttpError(400, 'bad_expiry', 'expires_at must be milliseconds since the epoch, or null to keep the guest.');
  }
  if (!name) throw new HttpError(400, 'bad_name', 'Name is required.');
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new HttpError(400, 'bad_color', 'Color must be #rrggbb.');
  if (!['adult', 'kid', 'kiosk'].includes(kind)) throw new HttpError(400, 'bad_kind', 'kind must be adult, kid or kiosk.');
  if (p.is_admin && kind !== 'adult') throw new HttpError(400, 'admin_must_be_adult', 'The admin profile has to stay an adult.');
  if (p.is_guest && kind !== 'adult') throw new HttpError(400, 'guest_must_be_adult', 'A guest is always an adult profile; remove the guest instead.');
  const pinHash = kind === 'adult' ? p.pin_hash : null;
  await c.env.DB.prepare('UPDATE profiles SET name = ?, emoji = ?, color = ?, kind = ?, sort_order = ?, pin_hash = ?, expires_at = ? WHERE id = ?')
    .bind(name, emoji, color, kind, sort, pinHash, expiresAt, p.id).run();
  // ending a guest's stay drops their sessions and push subscriptions now, not at the next cron
  if (p.is_guest && expiresAt !== null && expiresAt < Date.now()) await silenceExpiredGuests(c.env, Date.now(), p.id);
  return { profile: publicProfile({ ...p, name, emoji, color, kind, sort_order: sort, pin_hash: pinHash, expires_at: expiresAt }) };
});

// Remove a guest now (any guest), or purge one whose stay has ended without waiting for the 30-day cleanup.
// Household profiles are never deleted this way.
async function guestFor(c) {
  requireAdmin(await c.auth());
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(c.params.id).first();
  if (!p) throw new HttpError(404, 'no_such_profile', 'No profile with that id.');
  if (!p.is_guest) throw new HttpError(400, 'not_a_guest', 'Only guest profiles can be removed.');
  return p;
}
route('DELETE', '/api/admin/profiles/:id', async c => {
  const p = await guestFor(c);
  await deleteGuest(c.env, p);
  return { ok: true, id: p.id };
});
route('POST', '/api/admin/profiles/:id/purge', async c => {
  const p = await guestFor(c);
  if (!isExpiredGuest(p)) throw new HttpError(400, 'not_expired', `${p.name}'s stay has not ended yet — use Remove instead.`);
  await deleteGuest(c.env, p);
  return { ok: true, id: p.id, purged: true };
});
// Run the guest cleanup now (admin): purges guests expired more than 30 days ago.
route('POST', '/api/admin/guests/purge', async c => {
  requireAdmin(await c.auth());
  return purgeExpiredGuests(c.env, Date.now());
});

// Rotate the pairing code. Pass {code} to choose it, or omit to have one generated and returned once.
route('POST', '/api/admin/pairing-code/rotate', async c => {
  requireAdmin(await c.auth());
  const b = await c.body();
  const chosen = b.code !== undefined && b.code !== null && b.code !== '';
  const code = chosen ? String(b.code) : randomToken(6).replace(/[-_]/g, 'x').slice(0, 8);
  if (code.length < 6 || code.length > 64) throw new HttpError(400, 'bad_code', 'Pairing code must be 6-64 characters.');
  await c.env.DB.prepare("INSERT INTO settings (key, value) VALUES ('pairing_code_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(await hashSecret(code)).run();
  return chosen ? { ok: true } : { ok: true, code };
});

route('GET', '/api/admin/usage', async c => {
  requireAdmin(await c.auth());
  const since = Date.now() - 30 * 86400000;
  const chat = await c.env.DB.prepare(
    `SELECT profile_id, date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS messages
       FROM chat_log WHERE role = 'user' AND created_at > ? GROUP BY profile_id, day ORDER BY day DESC`).bind(since).all();
  const push = await c.env.DB.prepare(
    `SELECT profile_id, kind, date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS sends, SUM(ok) AS ok
       FROM push_log WHERE created_at > ? GROUP BY profile_id, kind, day ORDER BY day DESC`).bind(since).all();
  const devices = await c.env.DB.prepare('SELECT id, name, paired_at, last_seen FROM devices ORDER BY last_seen DESC').all();
  const subs = await c.env.DB.prepare('SELECT profile_id, COUNT(*) AS n FROM push_subscriptions GROUP BY profile_id').all();
  return { chat: chat.results, push: push.results, devices: devices.results, push_subscriptions: subs.results };
});

// Send a test notification to the caller (or, for the admin, any profile).
route('POST', '/api/push/test', async c => {
  const auth = await c.auth(); const me = requireProfile(auth);
  const b = await c.body();
  const target = b.profile_id && b.profile_id !== me.id ? (requireAdmin(auth), String(b.profile_id)) : me.id;
  return pushTo(c.env, target, 'test', { title: 'Anderson House', body: 'Notifications are working on this device.', url: '#me', tag: 'test' }, { ttl: 600, urgency: 'high' });
});
// Run a reminder job now (admin), e.g. to demo it. {job: 'morning' | 'evening' | 'behind' | 'prayer' | 'park'}
route('POST', '/api/admin/cron/run', async c => {
  requireAdmin(await c.auth());
  const { job } = await c.body();
  if (!Object.prototype.hasOwnProperty.call(JOBS, job)) throw new HttpError(400, 'bad_job', 'job must be one of ' + Object.keys(JOBS).map(j => `'${j}'`).join(', ') + '.');
  await silenceExpiredGuests(c.env, Date.now());   // guests (roadmap 23): a departed visitor is never on a job's list
  return runCron(c.env, Date.now(), job);
});

route('DELETE', '/api/admin/devices/:id', async c => {
  const auth = await c.auth(); requireAdmin(auth);
  if (c.params.id === auth.device.id) throw new HttpError(400, 'cannot_unpair_self', 'Unpair this device from another one.');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE device_id = ?').bind(c.params.id),
    c.env.DB.prepare('DELETE FROM push_subscriptions WHERE device_id = ?').bind(c.params.id),
    c.env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(c.params.id),
  ]);
  return { ok: true };
});

// ── dispatcher ────────────────────────────────────────────────
export async function handle(request, env, exec) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  let authCache = null;
  const c = {
    request, env, exec, url, params: {}, cors,
    body: () => readJson(request),
    auth: () => (authCache ||= authenticate(request, env, exec)),
  };
  try {
    let methodMatched = false;
    for (const r of routes) {
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      if (r.method !== request.method) { methodMatched = true; continue; }
      c.params = Object.fromEntries(Object.entries(m.groups || {}).map(([k, v]) => [k, decodeURIComponent(v)]));
      const out = await r.handler(c);
      return out instanceof Response ? out : json(out, 200, cors);
    }
    if (methodMatched) throw new HttpError(405, 'method_not_allowed', 'Method not allowed');
    throw new HttpError(404, 'not_found', 'Not found');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.error, message: e.message, ...(e.extra || {}) }, e.status, cors);
    console.error('unhandled', (e && e.stack) || e);
    return json({ error: 'internal', message: 'Something went wrong on the server.' }, 500, cors);
  }
}

export default {
  fetch: (request, env, ctx) => handle(request, env, ctx),
  // Cron (see wrangler.toml [triggers]). Locally: wrangler dev --test-scheduled, then GET /__scheduled?cron=0+12+*+*+*
  async scheduled(event, env, ctx) {
    // guests (roadmap 23): a guest whose stay ended since the last run loses sessions + push subscriptions first,
    // so the reminder jobs below (which push to every adult) never reach a departed visitor
    try { await silenceExpiredGuests(env, Date.now()); } catch (e) { console.error('cron guests silence', (e && e.stack) || e); }
    const out = await runCron(env, Date.now());
    console.log('cron', event.cron, JSON.stringify(out));
    try { const g = await purgeExpiredGuests(env, Date.now()); if (g.purged.length) console.log('cron guests purged', JSON.stringify(g.purged)); }
    catch (e) { console.error('cron guests', (e && e.stack) || e); }
  },
};
