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
  rateCheck, rateHit, rateClear, pinCheck, pinFail, pinClear, pinUnlock, oneTimeCode,
} from './auth.js';
import { listData, getOne, putOne, checkScope, checkKey } from './data.js';
import { householdLoader, checkRead, guardedPut, creditFor, isHouseholdAdult } from './policy.js';
import { runCron, pushTo, prefsFor, vapidFrom, JOBS } from './reminders.js';
import { chatHandler, chatHistory, chatUndo, activity } from './chat.js';
import { decodeImage, putMedia, getMedia, deletePrefix, MAX_SM, MAX_LG } from './media.js';

const PIN_RE = /^\d{4,8}$/;
const MIN = 60000;
// Names and emoji are shown in many places, some of which build markup (P3-DOLLYWOOD-LIVE-01): no angle brackets.
const NO_MARKUP = /[<>]/;
function checkName(name, emoji) {
  if (NO_MARKUP.test(name)) throw new HttpError(400, 'bad_name', 'Names cannot contain < or >.');
  if (emoji !== undefined && NO_MARKUP.test(emoji)) throw new HttpError(400, 'bad_emoji', 'The icon cannot contain < or >.');
}
// The 18 colour families the admin may assign (audits/05-decisions.md, "Admin-assigned colours"): the people's nine and the apps' nine.
const HUES = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite',
  'coral', 'apricot', 'honey', 'pistachio', 'leaf', 'seafoam', 'lagoon', 'cornflower', 'orchid'];
const RESET_CODE_MS = 24 * 60 * MIN;
/** Tells the admin when a profile's sign-ins are paused after repeated wrong PINs or codes (P2-SEC-01). */
async function alertAdmin(c, p, paused) {
  const admins = (await c.env.DB.prepare('SELECT id FROM profiles WHERE is_admin = 1').all()).results;
  const hours = Math.round(paused / 3600000);
  const payload = { title: 'Too many wrong PINs', body: `Someone typed ${p.name}'s PIN or code wrong 10 times. ${p.name} cannot sign in for ${hours} h. Reset PIN in Me → Admin unlocks it.`, url: '#me', tag: 'security-' + p.id };
  for (const a of admins) c.exec.waitUntil(pushTo(c.env, a.id, 'security', payload, { ttl: 3600, urgency: 'high' }).catch(e => console.error('security push', (e && e.stack) || e)));
}
/** One wrong PIN or code: counted, the admin told if it paused the profile, then 401. */
async function wrongSecret(c, p, deviceId, error, message) {
  const { paused } = await pinFail(c.env, p.id, deviceId);
  if (paused) await alertAdmin(c, p, paused);
  throw new HttpError(401, error, message);
}
/** The admin types their PIN again for the actions that hand over a device or an account (role changes, their own reset). */
async function checkAdminPin(c, me, pin) {
  const { device } = await c.auth();
  await pinCheck(c.env, me.id, device.id);
  const row = await c.env.DB.prepare('SELECT pin_hash FROM profiles WHERE id = ?').bind(me.id).first();
  if (!row || !row.pin_hash || !(await verifySecret(String(pin ?? ''), row.pin_hash))) {
    // 403, not 401: the admin's session is fine, and a 401 would sign the shell out
    const { paused } = await pinFail(c.env, me.id, device.id);
    if (paused) await alertAdmin(c, me, paused);
    throw new HttpError(403, 'wrong_admin_pin', 'That is not your PIN.');
  }
  await pinClear(c.env, me.id, device.id);
}

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

// Dollywood wait times for the park map. queue-times.com republishes the park's posted waits as JSON but sends no
// CORS header, so the page cannot read it directly; this proxies it, normalised, behind a 60 s edge cache so the whole
// family shares one upstream fetch a minute. Public data, no auth. Attribution ("Powered by Queue-Times.com") is the
// site's condition of use and the park map shows it.
const WAITS_URL = 'https://queue-times.com/parks/55/queue_times.json';
route('GET', '/api/dollywood/waits', async c => {
  const cache = caches.default, key = new Request(WAITS_URL, { method: 'GET' });
  let up = await cache.match(key);
  if (!up) {
    up = await fetch(WAITS_URL, { headers: { 'User-Agent': 'house-hub park map (family use)' } });
    if (!up.ok) throw new HttpError(502, 'upstream', 'Wait times are not available right now.');
    up = new Response(up.body, up); up.headers.set('Cache-Control', 'public, max-age=60');
    c.exec.waitUntil(cache.put(key, up.clone()));
  }
  const d = await up.json();
  const rides = [];
  for (const land of d.lands || []) for (const r of land.rides || []) rides.push({ name: r.name.replace(/[®™]/g, '').trim(), land: land.name, open: !!r.is_open, wait: r.wait_time ?? null, updated: r.last_updated });
  for (const r of d.rides || []) rides.push({ name: r.name.replace(/[®™]/g, '').trim(), land: null, open: !!r.is_open, wait: r.wait_time ?? null, updated: r.last_updated });
  const updated = rides.reduce((m, r) => (r.updated > m ? r.updated : m), '');
  return json({ ok: true, at: Date.now(), updated, source: 'queue-times.com', rides }, 200, { ...c.cors, 'Cache-Control': 'public, max-age=60' });
});

// "Rally the family" for the park map. A household adult drops a meeting point; every other household adult's phone
// is told. The point is one family-scope row, app_data(family, 'dollywood-live', 'meet') =
//   { x, y, name, note, by, byName, at }   (x/y map positions like the loc:* markers, at = server ms)
// written through putOne() so every phone's hub.js picks it up on its next pull, and DELETE tombstones it the same
// way. Household adults only — kids, the display and guests get 403 adults_only. One rally per adult per minute.
// The push honours the 'park' switch in Me → Notifications (push_prefs.park, the park-day kind) but is logged as kind
// 'rally', so a rally never uses up the park job's one-alert-a-day for the stale-kid-marker warning. A dead or
// malformed subscription is reported under `skipped`, never a 500: the row is already saved by then.
const RALLY_APP = 'dollywood-live', RALLY_KEY = 'meet';
const RALLY_NAME_MAX = 60, RALLY_NOTE_MAX = 140;
function requireHouseholdAdult(auth) {
  const p = requireProfile(auth);
  if (p.kind !== 'adult' || p.is_guest) throw new HttpError(403, 'adults_only', 'Only a household grown-up can rally the family.');
  return p;
}
/** A timestamp that beats whatever the row holds now, so the newest human intent always wins the last-write-wins compare. */
const beats = cur => Math.max(Date.now(), cur ? +cur.updated_at + 1 : 0);
route('POST', '/api/dollywood/rally', async c => {
  const me = requireHouseholdAdult(await c.auth());
  const rateKey = 'rally:' + me.id;
  await rateCheck(c.env, rateKey, 1);
  const b = await c.body();
  const str = v => (typeof v === 'string' ? v : '').trim();
  const name = str(b.name).slice(0, RALLY_NAME_MAX);
  if (!name) throw new HttpError(400, 'bad_name', 'Give the meeting point a name.');
  if (typeof b.x !== 'number' || typeof b.y !== 'number' || !Number.isFinite(b.x) || !Number.isFinite(b.y)) {
    throw new HttpError(400, 'bad_point', 'x and y must be numbers (map positions).');
  }
  const note = str(b.note).slice(0, RALLY_NOTE_MAX);
  const value = { x: b.x, y: b.y, name, note, by: me.id, byName: me.name, at: Date.now() };
  const cur = await getOne(c.env, { appId: RALLY_APP, scope: 'family', profile: me, key: RALLY_KEY });
  const row = await putOne(c.env, { appId: RALLY_APP, scope: 'family', profile: me, key: RALLY_KEY, value, updated_at: beats(cur) });
  await rateHit(c.env, rateKey, MIN);
  await activity(c.env, me, RALLY_APP, `Set a meeting point: ${name}`);

  const { results: others } = await c.env.DB.prepare(
    "SELECT id FROM profiles WHERE kind = 'adult' AND is_guest = 0 AND id != ? ORDER BY sort_order").bind(me.id).all();
  const payload = { title: `Meet at ${name}`, body: `${me.name} is gathering the family — open the park map`, url: '#dollywood-live', tag: 'rally' };
  let pushed = 0; const notified = [], skipped = [];
  for (const { id } of others) {
    if (!(await prefsFor(c.env, id)).park) { skipped.push({ profile: id, why: 'pref_off' }); continue; }
    try {
      const r = await pushTo(c.env, id, 'rally', payload, { ttl: 1800, urgency: 'high' });
      if (r.ok) { pushed++; notified.push({ profile: id, devices: r.ok }); }
      else skipped.push({ profile: id, why: r.error || (r.sent ? 'delivery_failed' : 'no_subscription') });
    } catch (e) {
      skipped.push({ profile: id, why: 'push_error' });
      console.error('rally push', id, (e && e.stack) || e);
    }
  }
  return { ok: true, pushed, meet: value, updated_at: row.updated_at, notified, skipped };
});
route('DELETE', '/api/dollywood/rally', async c => {
  const me = requireHouseholdAdult(await c.auth());
  const cur = await getOne(c.env, { appId: RALLY_APP, scope: 'family', profile: me, key: RALLY_KEY });
  const had = !!(cur && cur.value && typeof cur.value === 'object');
  const row = await putOne(c.env, { appId: RALLY_APP, scope: 'family', profile: me, key: RALLY_KEY, value: null, updated_at: beats(cur) });
  if (had) await activity(c.env, me, RALLY_APP, `Cleared the meeting point${cur.value.name ? ': ' + cur.value.name : ''}`);
  return { ok: true, cleared: had, updated_at: row.updated_at };
});

// Pair this device with the house using the one-time pairing code.
// Wrong codes are limited per device (the random install id the page sends as fp: 5 per 15 min) and, as a backstop, per
// address (20 per 15 min), so one device typing wrong codes no longer blocks every device in the house (UX-PROF-a7).
// A page too old to send fp keeps the old limit of 10 per address.
route('POST', '/api/pair', async c => {
  const { code, name, fp } = await c.body();
  const ip = clientIp(c.request);
  const fpOk = typeof fp === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(fp);
  const limits = fpOk ? [['pairfp:' + fp, 5], ['pairip:' + ip, 20]] : [['pair:' + ip, 10]];
  for (const [key, max] of limits) await rateCheck(c.env, key, max);
  const stored = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'pairing_code_hash'").first('value');
  if (!stored) throw new HttpError(503, 'pairing_not_configured', 'No pairing code has been set yet (scripts/set-pairing-code.mjs).');
  if (!(await verifySecret(String(code || ''), stored))) {
    for (const [key] of limits) await rateHit(c.env, key, 15 * MIN);
    throw new HttpError(401, 'bad_pairing_code', 'That pairing code is not right.');
  }
  await rateClear(c.env, limits[0][0]);
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
// {name, emoji?|icon?, color?, hue?, pin?, expires_at?} (hue: one of the 18 families, default sky): pin is optional (a guest without one signs in on tap),
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
  checkName(name, emoji);
  const color = b.color === undefined || b.color === null || b.color === '' ? '#8A6A4B' : String(b.color);
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new HttpError(400, 'bad_color', 'Color must be #rrggbb.');
  const hue = b.hue === undefined || b.hue === null || b.hue === '' ? 'sky' : String(b.hue);   // a new guest is sky unless given a family
  if (!HUES.includes(hue)) throw new HttpError(400, 'bad_hue', 'hue must be one of: ' + HUES.join(', ') + '.');
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
    `INSERT INTO profiles (id, name, emoji, color, kind, pin_hash, is_admin, sort_order, is_guest, created_by, expires_at, hue)
       VALUES (?, ?, ?, ?, 'adult', ?, 0, ?, 1, ?, ?, ?)`).bind(id, name, emoji, color, pinHash, sort, me.id, expiresAt, hue).run();
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
    env.DB.prepare('DELETE FROM rate_limits WHERE key LIKE ? OR key LIKE ? OR key = ? OR key = ?').bind(`login:${p.id}:%`, `pintrust:${p.id}:%`, `pinp:${p.id}`, `pinstrike:${p.id}`),
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
  // KITCHEN-1: a kitchen device signs in only as the kitchen, and the kitchen only on a kitchen device. No PIN there.
  if (device.role === 'kitchen' && p.kind !== 'kitchen') throw new HttpError(403, 'kitchen_device', 'This device is the kitchen: nobody signs in here.');
  if (p.kind === 'kitchen' && device.role !== 'kitchen') throw new HttpError(403, 'not_kitchen_device', 'Only the kitchen device signs in as the kitchen.');
  // a guest without a PIN signs in on tap (the person who added them chose that); everyone else with kind adult needs one
  if (p.kind === 'adult' && !(p.is_guest && p.pin_hash == null)) {
    if (p.pin_hash == null) throw new HttpError(403, 'needs_pin_setup', `${p.name} has not created a PIN yet.`, { pin_reset: p.pin_reset_hash != null });
    await pinCheck(c.env, p.id, device.id);
    if (!(await verifySecret(String(pin ?? ''), p.pin_hash))) await wrongSecret(c, p, device.id, 'wrong_pin', 'Wrong PIN.');
    await pinClear(c.env, p.id, device.id);
  }
  return { profile_token: await createSession(c.env, p.id, device.id), profile: publicProfile(p) };
});

// PIN creation: only while pin_hash is NULL, only from a paired device. After an admin reset (P2-PROF-04) it also needs
// the one-time code the admin was shown, within 24 h; wrong codes count like wrong PINs. A profile that never had a PIN
// (a new household adult) still creates it on first tap; the admin can close that too by issuing a code for it.
route('POST', '/api/profiles/:id/pin', async c => {
  const { device } = await c.auth();
  const { pin, code } = await c.body();
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(c.params.id).first();
  if (!p) throw new HttpError(404, 'no_such_profile', 'No profile with that id.');
  if (p.kind !== 'adult') throw new HttpError(400, 'no_pin_for_kind', 'Only adult profiles have a PIN.');
  // guests (roadmap 23): a guest's PIN is chosen when they are added (or cleared by the admin). A guest without one
  // signs in on tap, so letting any paired device "create" a PIN for them would lock the guest out or hijack the profile.
  if (p.is_guest) throw new HttpError(403, 'guest_pin_fixed', `${p.name} is a guest: their PIN was chosen when they were added. Ask the admin to clear it.`);
  if (p.pin_hash != null) throw new HttpError(409, 'pin_already_set', 'A PIN is already set. Ask the admin to reset it.');
  if (!PIN_RE.test(String(pin ?? ''))) throw new HttpError(400, 'bad_pin', 'PIN must be 4 to 8 digits.');
  if (p.pin_reset_hash != null) {
    await pinCheck(c.env, p.id, device.id);
    if (code === undefined || code === null || code === '') throw new HttpError(403, 'needs_code', `Enter the code the admin gave you for ${p.name}.`);
    if (!(+p.pin_reset_expires > Date.now())) throw new HttpError(403, 'code_expired', 'That code has expired. Ask the admin for a new one.');
    if (!(await verifySecret(String(code), p.pin_reset_hash))) await wrongSecret(c, p, device.id, 'wrong_code', 'That code is not right.');
  }
  const r = await c.env.DB.prepare('UPDATE profiles SET pin_hash = ?, pin_reset_hash = NULL, pin_reset_expires = NULL WHERE id = ? AND pin_hash IS NULL')
    .bind(await hashSecret(String(pin)), p.id).run();
  if (!r.meta.changes) throw new HttpError(409, 'pin_already_set', 'A PIN was just set from another device.');
  p.pin_hash = 'set'; p.pin_reset_hash = null;
  await pinClear(c.env, p.id, device.id);
  return { profile_token: await createSession(c.env, p.id, device.id), profile: publicProfile(p) };
});

route('GET', '/api/me', async c => ({ profile: publicProfile(requireProfile(await c.auth())) }));

// Me → Change my PIN (GAP-PROF-a1): the current PIN, then the new one. Household adults only (a guest's PIN is fixed).
// A wrong current PIN counts like a wrong sign-in, answered 403 so the shell stays signed in. Other devices stay signed in.
route('POST', '/api/me/pin', async c => {
  const auth = await c.auth(); const me = requireProfile(auth);
  if (!isHouseholdAdult(me)) throw new HttpError(403, 'adults_only', 'Only a household adult has a PIN to change.');
  const { current, pin } = await c.body();
  if (!PIN_RE.test(String(pin ?? ''))) throw new HttpError(400, 'bad_pin', 'PIN must be 4 to 8 digits.');
  await pinCheck(c.env, me.id, auth.device.id);
  const row = await c.env.DB.prepare('SELECT pin_hash FROM profiles WHERE id = ?').bind(me.id).first();
  if (!row || !row.pin_hash || !(await verifySecret(String(current ?? ''), row.pin_hash))) {
    const { paused } = await pinFail(c.env, me.id, auth.device.id);
    if (paused) await alertAdmin(c, me, paused);
    throw new HttpError(403, 'wrong_pin', 'That is not your current PIN.');
  }
  await c.env.DB.prepare('UPDATE profiles SET pin_hash = ?, pin_reset_hash = NULL, pin_reset_expires = NULL WHERE id = ?').bind(await hashSecret(String(pin)), me.id).run();
  await pinClear(c.env, me.id, auth.device.id);
  return { ok: true };
});

// What this device is (KITCHEN-1): the shell asks at boot and after a 401; on a kitchen device it signs in as the kitchen.
route('GET', '/api/device', async c => {
  const { device } = await c.auth();
  const kitchen = device.role === 'kitchen' ? await c.env.DB.prepare("SELECT id FROM profiles WHERE kind = 'kitchen' ORDER BY sort_order LIMIT 1").first('id') : null;
  return { id: device.id, name: device.name, role: device.role || null, kitchen_profile: kitchen || null };
});

// Forget this device (Me → Sync, household adults): the device, every session on it and its push subscriptions go, so a
// phone given away stops receiving the household's notifications and leaves no ghost in the admin's device list.
route('POST', '/api/device/forget', async c => {
  const auth = await c.auth();
  const p = requireWriter(auth);
  if (p.kind !== 'adult' || p.is_guest) throw new HttpError(403, 'adults_only', 'Only a household adult can forget this device.');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE device_id = ?').bind(auth.device.id),
    c.env.DB.prepare('DELETE FROM push_subscriptions WHERE device_id = ?').bind(auth.device.id),
    c.env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(auth.device.id),
  ]);
  return { ok: true };
});

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
  await checkRead(auth.profile, args, householdLoader(c.env));
  const since = +(c.url.searchParams.get('since') || 0) || 0;
  const prefix = c.url.searchParams.get('prefix') || '';
  const key = c.url.searchParams.get('key');
  // `now` is taken before the query so a client can safely use it as the next `since`.
  const now = Date.now() - 1;
  if (key) return { item: await getOne(c.env, { ...args, key: checkKey(key) }), now };
  return { items: await listData(c.env, { ...args, since, prefix }), now };
});

// Every write goes through policy.js (who may write which rows). A single refused row answers 403 not_allowed with what
// the house holds; in a batch a refused row comes back as { key, rejected, value, updated_at } and the others still save.
async function writeOne(c, args) {
  const r = await guardedPut(c.env, args.profile, args, householdLoader(c.env));
  if (r.rejected) throw new HttpError(403, 'not_allowed', 'This profile cannot change that.', { rejected: r.rejected, key: r.key, value: r.value, updated_at: r.updated_at });
  return r;
}
route('PUT', '/api/data/:appId/:key', async c => {
  const auth = await c.auth();
  const { value, updated_at } = await c.body();
  return writeOne(c, { ...dataArgs(c, auth, true), key: checkKey(c.params.key), value, updated_at });
});

route('DELETE', '/api/data/:appId/:key', async c => {
  const auth = await c.auth();
  return writeOne(c, { ...dataArgs(c, auth, true), key: checkKey(c.params.key), value: null, updated_at: Date.now() });
});

// Flush a whole offline queue in one round trip.
route('POST', '/api/data/:appId/batch', async c => {
  const auth = await c.auth();
  const args = dataArgs(c, auth, true);
  const { items } = await c.body();
  if (!Array.isArray(items) || items.length > 200) throw new HttpError(400, 'bad_batch', 'items must be an array of at most 200.');
  const results = [], people = householdLoader(c.env);
  for (const it of items) results.push(await guardedPut(c.env, args.profile, { ...args, key: checkKey(it.key), value: it.value, updated_at: it.updated_at }, people));
  return { results, now: Date.now() };
});

// ── activity feed ─────────────────────────────────────────────
route('GET', '/api/activity', async c => {
  await c.auth();
  const limit = Math.min(100, Math.max(1, +(c.url.searchParams.get('limit') || 30) || 30));
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.profile_id, a.app_id, a.text, a.created_at, p.name, p.emoji, p.color, p.hue, p.is_guest, p.photo
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
  const me = requireWriter(await c.auth());
  const b = await c.body();
  // the kitchen adds a photo for the household adult whose face was tapped (b.as); it cannot add one as itself
  if (me.kind === 'kitchen' && (b.as === undefined || b.as === null || b.as === me.id)) throw new HttpError(400, 'needs_who', 'Say who is adding the photo.');
  const p = await creditFor(me, b.as, 'album', householdLoader(c.env));
  if (p.kind !== 'adult') throw new HttpError(403, 'adults_only', 'Ask a grown-up to add photos.');
  const sm = decodeImage(b.sm, MAX_SM, 'The thumbnail'), lg = decodeImage(b.lg, MAX_LG, 'The photo');
  const id = randomId();
  await putMedia(c.env, `album/${id}-256.jpg`, sm);
  await putMedia(c.env, `album/${id}-1024.jpg`, lg);
  const value = { id, sm: `/api/media/album/${id}-256.jpg`, lg: `/api/media/album/${id}-1024.jpg`, by: p.id, byName: p.name, caption: String(b.caption || '').trim().slice(0, 140), at: Date.now() };
  const row = await putOne(c.env, { appId: 'hub', scope: 'family', profile: me, key: 'album:' + id, value });
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

// A prayer line names only a family-list request: "Prayed for …" / "Answered: …" must carry the title of a family
// prayer row, or the generic "a private request" (P2-PWA-01). A private title never reaches the feed or the TV.
async function prayerLineOk(env, me, t) {
  const m = /^(?:Prayed for |Answered: )([\s\S]*)$/.exec(t);
  if (!m) return true;
  const title = m[1].replace(/ \(via chat\)$/, '').replace(/ \(family list\)$/, '').trim();
  if (title === 'a private request') return true;
  const rows = await listData(env, { appId: 'prayer', scope: 'family', profile: me, prefix: 'prayer:' });
  return rows.some(r => r.value && typeof r.value === 'object' && String(r.value.title || '').trim() === title);
}
route('POST', '/api/activity', async c => {
  const me = requireWriter(await c.auth());
  const { app_id, text, at, as } = await c.body();
  const t = String(text || '').trim().slice(0, 200);
  if (!t) throw new HttpError(400, 'bad_text', 'text is required.');
  const p = await creditFor(me, as, String(app_id || 'hub'), householdLoader(c.env));   // the kitchen files a line under the tapped face
  if (String(app_id) === 'prayer' && !(await prayerLineOk(c.env, me, t))) throw new HttpError(400, 'private_title', 'A private request is never named on the family feed.');
  // a line queued offline keeps the time it happened (never in the future, never more than a week back)
  const now = Number.isFinite(+at) && +at > 0 ? Math.round(Math.max(Date.now() - 7 * 86400000, Math.min(+at, Date.now()))) : Date.now();
  const app = checkKey(String(app_id || 'hub'));
  const r = await c.env.DB.prepare('INSERT INTO activity (profile_id, app_id, text, created_at) VALUES (?, ?, ?, ?)')
    .bind(p.id, app, t, now).run();
  return { id: r.meta.last_row_id, profile_id: p.id, app_id: app, text: t, created_at: now, name: p.name, emoji: p.emoji, color: p.color, hue: p.hue || null, is_guest: p.is_guest ? 1 : 0 };
});

// ── push ──────────────────────────────────────────────────────
route('GET', '/api/push/config', async c => {
  await c.auth();
  return { public_key: c.env.VAPID_PUBLIC_KEY || null, enabled: !!vapidFrom(c.env) };
});
route('POST', '/api/push/subscribe', async c => {
  const auth = await c.auth();
  const p = requireProfile(auth);
  if (p.kind === 'kitchen') throw new HttpError(403, 'no_push', 'The kitchen device gets no personal notifications.');
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
  if (p.kind === 'kitchen') throw new HttpError(403, 'no_chat', 'The kitchen device has no chat.');
  return chatHandler(c, auth);   // the apps this person can open come from the Worker's copy of apps.json (policy.js), never the request
});
route('GET', '/api/chat/history', async c => { const auth = await c.auth(); requireProfile(auth); return chatHistory(c, auth); });
// the chip's Undo (batch 0i): puts back what one chat action wrote, where nobody has changed it since
route('POST', '/api/chat/undo', async c => { const auth = await c.auth(); requireProfile(auth); return chatUndo(c, auth); });

// ── admin ─────────────────────────────────────────────────────
// Reset PIN (P2-PROF-04, P5-D4). For a household adult it issues a one-time code, shown to the admin once and good for
// 24 h, which the person must enter before choosing a new PIN, so no other device can claim the account meanwhile. The
// admin's own reset also needs the admin's current PIN (P2-PROF-06). For a guest it clears the PIN (they then sign in on
// tap, as when they were added without one). Either way the profile's sessions end and its wrong-PIN pause is lifted.
route('POST', '/api/admin/profiles/:id/reset-pin', async c => {
  const me = requireAdmin(await c.auth());
  const b = await c.body().catch(() => ({}));
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(c.params.id).first();
  if (!p) throw new HttpError(404, 'no_such_profile', 'No profile with that id.');
  if (p.kind !== 'adult') throw new HttpError(400, 'no_pin_for_kind', 'Only adult profiles have a PIN.');
  if (p.id === me.id) await checkAdminPin(c, me, b.admin_pin);
  await pinUnlock(c.env, p.id);
  if (p.is_guest) {
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE profiles SET pin_hash = NULL, pin_reset_hash = NULL, pin_reset_expires = NULL WHERE id = ?').bind(p.id),
      c.env.DB.prepare('DELETE FROM sessions WHERE profile_id = ?').bind(p.id),
    ]);
    return { ok: true, id: p.id };
  }
  const code = oneTimeCode(), expires = Date.now() + RESET_CODE_MS;
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE profiles SET pin_hash = NULL, pin_reset_hash = ?, pin_reset_expires = ? WHERE id = ?').bind(await hashSecret(code), expires, p.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE profile_id = ?').bind(p.id),
  ]);
  return { ok: true, id: p.id, code, expires_at: expires };
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
  const hue = b.hue !== undefined ? (b.hue === null || b.hue === '' ? null : String(b.hue)) : (p.hue || null);
  if (hue !== null && !HUES.includes(hue)) throw new HttpError(400, 'bad_hue', 'hue must be one of: ' + HUES.join(', ') + '.');
  // KITCHEN-1: the kitchen is not a person. Only its colour changes; a profile becomes the kitchen only through the seed.
  if (p.kind === 'kitchen' && (name !== p.name || emoji !== p.emoji || kind !== p.kind || sort !== p.sort_order)) {
    throw new HttpError(400, 'kitchen_fixed', 'Only the kitchen\'s colour can be changed.');
  }
  if (p.kind !== 'kitchen' && kind === 'kitchen') throw new HttpError(400, 'bad_kind', 'kind must be adult, kid or kiosk.');
  checkName(name, emoji);
  let expiresAt = p.expires_at;   // guests only: ms since epoch, null = keep (lets the admin extend or end a stay)
  if (p.is_guest && b.expires_at !== undefined) {
    expiresAt = b.expires_at === null || b.expires_at === '' ? null : Math.floor(+b.expires_at);
    if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= 0)) throw new HttpError(400, 'bad_expiry', 'expires_at must be milliseconds since the epoch, or null to keep the guest.');
  }
  if (!name) throw new HttpError(400, 'bad_name', 'Name is required.');
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new HttpError(400, 'bad_color', 'Color must be #rrggbb.');
  if (!['adult', 'kid', 'kiosk', 'kitchen'].includes(kind)) throw new HttpError(400, 'bad_kind', 'kind must be adult, kid or kiosk.');
  if (p.is_admin && kind !== 'adult') throw new HttpError(400, 'admin_must_be_adult', 'The admin profile has to stay an adult.');
  if (p.is_guest && kind !== 'adult') throw new HttpError(400, 'guest_must_be_adult', 'A guest is always an adult profile; remove the guest instead.');
  const pinHash = kind === 'adult' ? p.pin_hash : null;
  // A household profile that becomes an adult has no PIN yet: a set-up code, so no other device can claim it first
  let setupCode = null, resetHash = kind === 'adult' ? p.pin_reset_hash : null, resetExpires = kind === 'adult' ? p.pin_reset_expires : null;
  if (kind === 'adult' && p.kind !== 'adult' && !p.is_guest) { setupCode = oneTimeCode(); resetHash = await hashSecret(setupCode); resetExpires = Date.now() + RESET_CODE_MS; }
  await c.env.DB.prepare('UPDATE profiles SET name = ?, emoji = ?, color = ?, kind = ?, sort_order = ?, pin_hash = ?, expires_at = ?, hue = ?, pin_reset_hash = ?, pin_reset_expires = ? WHERE id = ?')
    .bind(name, emoji, color, kind, sort, pinHash, expiresAt, hue, resetHash, resetExpires, p.id).run();
  if (kind !== p.kind) await c.env.DB.prepare('DELETE FROM sessions WHERE profile_id = ?').bind(p.id).run();   // a new kind starts with a new sign-in
  // ending a guest's stay drops their sessions and push subscriptions now, not at the next cron
  if (p.is_guest && expiresAt !== null && expiresAt < Date.now()) await silenceExpiredGuests(c.env, Date.now(), p.id);
  return { profile: publicProfile({ ...p, name, emoji, color, kind, hue, sort_order: sort, pin_hash: pinHash, pin_reset_hash: resetHash, expires_at: expiresAt }), ...(setupCode ? { setup_code: setupCode, code_expires_at: resetExpires } : {}) };
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
  const devices = await c.env.DB.prepare('SELECT id, name, paired_at, last_seen, role FROM devices ORDER BY last_seen DESC').all();
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

// Mark a device as the kitchen, or clear it (KITCHEN-1). Admin only, from another device, with the admin's PIN typed
// again. Setting it ends every personal session and push subscription on that device; clearing it ends the kitchen's
// session there, so the device's next request gets a 401 and its shell shows the picker.
route('PUT', '/api/admin/devices/:id/role', async c => {
  const auth = await c.auth(); const me = requireAdmin(auth);
  const b = await c.body();
  if (c.params.id === auth.device.id) throw new HttpError(400, 'cannot_change_self', 'Change this device from another one.');
  const role = b.role === 'kitchen' ? 'kitchen' : (b.role === null || b.role === '' || b.role === undefined ? null : undefined);
  if (role === undefined) throw new HttpError(400, 'bad_role', "role must be 'kitchen' or null.");
  const dev = await c.env.DB.prepare('SELECT id, role FROM devices WHERE id = ?').bind(c.params.id).first();
  if (!dev) throw new HttpError(404, 'no_such_device', 'No device with that id.');
  await checkAdminPin(c, me, b.admin_pin);
  const kitchens = "SELECT id FROM profiles WHERE kind = 'kitchen'";
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE devices SET role = ? WHERE id = ?').bind(role, dev.id),
    role === 'kitchen'
      ? c.env.DB.prepare(`DELETE FROM sessions WHERE device_id = ? AND profile_id NOT IN (${kitchens})`).bind(dev.id)
      : c.env.DB.prepare(`DELETE FROM sessions WHERE device_id = ? AND profile_id IN (${kitchens})`).bind(dev.id),
    ...(role === 'kitchen' ? [c.env.DB.prepare('DELETE FROM push_subscriptions WHERE device_id = ?').bind(dev.id)] : []),
  ]);
  return { ok: true, id: dev.id, role };
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
