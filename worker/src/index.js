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
  hashSecret, verifySecret, sha256, randomToken, randomId, publicProfile,
  rateCheck, rateHit, rateClear,
} from './auth.js';
import { listData, getOne, putOne, checkScope, checkKey } from './data.js';
import { runCron, pushTo, vapidFrom } from './reminders.js';
import { chatHandler, chatHistory } from './chat.js';

const PIN_RE = /^\d{4,8}$/;
const MIN = 60000;

// ── response helpers ──────────────────────────────────────────
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Device-Token, X-Profile-Token, X-House-Key',
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

route('GET', '/api/profiles', async c => {
  await c.auth();
  const { results } = await c.env.DB.prepare('SELECT * FROM profiles ORDER BY sort_order, name').all();
  return { profiles: results.map(publicProfile) };
});

route('POST', '/api/login', async c => {
  const { device } = await c.auth();
  const { profile_id, pin } = await c.body();
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(String(profile_id || '')).first();
  if (!p) throw new HttpError(404, 'no_such_profile', 'No profile with that id.');
  if (p.kind === 'adult') {
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
    `SELECT a.id, a.profile_id, a.app_id, a.text, a.created_at, p.name, p.emoji, p.color
       FROM activity a LEFT JOIN profiles p ON p.id = a.profile_id
      ORDER BY a.created_at DESC, a.id DESC LIMIT ?`).bind(limit).all();
  return { activity: results };
});

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
route('POST', '/api/chat', async c => { const auth = await c.auth(); const p = requireProfile(auth); if (p.kind === 'kiosk') throw new HttpError(403, 'no_chat', 'The display profile has no chat.'); return chatHandler(c, auth); });
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
  if (!name) throw new HttpError(400, 'bad_name', 'Name is required.');
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new HttpError(400, 'bad_color', 'Color must be #rrggbb.');
  if (!['adult', 'kid', 'kiosk'].includes(kind)) throw new HttpError(400, 'bad_kind', 'kind must be adult, kid or kiosk.');
  if (p.is_admin && kind !== 'adult') throw new HttpError(400, 'admin_must_be_adult', 'The admin profile has to stay an adult.');
  const pinHash = kind === 'adult' ? p.pin_hash : null;
  await c.env.DB.prepare('UPDATE profiles SET name = ?, emoji = ?, color = ?, kind = ?, sort_order = ?, pin_hash = ? WHERE id = ?')
    .bind(name, emoji, color, kind, sort, pinHash, p.id).run();
  return { profile: publicProfile({ ...p, name, emoji, color, kind, sort_order: sort, pin_hash: pinHash }) };
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
// Run a reminder job now (admin), e.g. to demo it. {job: 'morning' | 'evening'}
route('POST', '/api/admin/cron/run', async c => {
  requireAdmin(await c.auth());
  const { job } = await c.body();
  if (!['morning', 'evening'].includes(job)) throw new HttpError(400, 'bad_job', "job must be 'morning' or 'evening'.");
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

// ── legacy Larder Ledger routes (X-House-Key) — removed in Phase 3 once the app uses hub.js ──
async function legacyAuth(c) {
  if (!c.env.HOUSE_KEY) throw new HttpError(500, 'no_house_key', 'HOUSE_KEY secret is not set.');
  const got = c.request.headers.get('X-House-Key') || '';
  let diff = got.length ^ c.env.HOUSE_KEY.length;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ (c.env.HOUSE_KEY.charCodeAt(i) || 0);
  if (diff) throw new HttpError(401, 'unauthorized', 'Wrong or missing passphrase');
}
const legacyList = async env => ({
  items: (await listData(env, { appId: 'leftovers', scope: 'family', profile: null, prefix: 'item:' }))
    .filter(r => r.value).map(r => r.value)
    .sort((a, b) => (a.dateLogged || '').localeCompare(b.dateLogged || '') || (a.name || '').localeCompare(b.name || '')),
});
const legacyWriter = { id: 'legacy', kind: 'adult' };
route('GET', '/items', async c => { await legacyAuth(c); return legacyList(c.env); });
route('POST', '/items', async c => {
  await legacyAuth(c);
  const b = await c.body();
  const name = String(b.name || '').trim().slice(0, 80);
  if (!name) throw new HttpError(400, 'bad_item', 'name is required');
  const item = { id: String(b.id || randomId()), name, size: String(b.size || ''), dateLogged: String(b.dateLogged || new Date().toISOString().slice(0, 10)) };
  await putOne(c.env, { appId: 'leftovers', scope: 'family', profile: legacyWriter, key: 'item:' + item.id, value: item, updated_at: Date.now() });
  return legacyList(c.env);
});
route('DELETE', '/items/:id', async c => {
  await legacyAuth(c);
  await putOne(c.env, { appId: 'leftovers', scope: 'family', profile: legacyWriter, key: 'item:' + c.params.id, value: null, updated_at: Date.now() });
  return legacyList(c.env);
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
    const out = await runCron(env, Date.now());
    console.log('cron', event.cron, JSON.stringify(out));
  },
};
