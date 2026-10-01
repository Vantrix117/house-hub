// Scheduled reminders + push delivery.
//   morning   (8:00 New York):        leftovers that hit "use it up" within two days -> every household adult who opted in
//   evening   (every run, 15 min):    F260 reading not checked today -> that profile, at their time (push_pref:readAt; 8 pm unset)
//   behind    (Sunday 8:00 pm):       F260 week running 2+ readings behind -> that adult (weekly catch-up)
//   prayer    (8 am and 8 pm hours):  family-list prayers each household adult has not been told about yet (never their own)
//   prayedfor (8 pm hour):            someone prayed today for a family request you added -> you (GAP-PRAYER-1)
//   park      (every run, 15 min):    a kid's map marker has gone quiet while an adult's is fresh -> household adults
//   praytime  (every run, 15 min):    the person's own "reminder to pray" time (push_prefs.prayAt) -> that person
// The cron (wrangler.toml) fires every 15 minutes; runCron reads the New York time of the firing, so 8:00 am / 8:00 pm (and
// each person's chosen time) stay put across daylight saving, and every firing of those hours runs them (a failed push is tried again). morning,
// evening, behind, praytime and prayedfor send at most once per person per day (push_log, delivered pushes only); prayer
// and park remember per person what they have told (settings), so nothing is lost to a push sent earlier that day. Every
// kind honours the person's switch (app_data(person, hub, 'push_pref:<kind>') over the old 'push_prefs' row; default on)
// and can be forced with POST /api/admin/cron/run {job}. Guests get only their own nudges (evening, behind, praytime,
// prayedfor), never the household's (morning, prayer, park) — PWA-UX-2. Kids, the display and the kitchen get none.
import { sendPush, unb64u } from './push.js';
import { liveItems, getOne } from './data.js';

const NY = 'America/New_York';
export function nyParts(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: NY, year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(d);
  const g = t => (p.find(x => x.type === t) || {}).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: +g('hour') % 24, minute: +g('minute') || 0, weekday: g('weekday') };
}
const ageDays = (dateLogged, today) => Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(dateLogged + 'T00:00:00Z')) / 86400000);
// A Larder item's age in calendar days; a future date counts as today, and a date that is not a real YYYY-MM-DD as long overdue (the Larder shows it
// as "Check date" with the oldest, batch 0i) so it is still warned about
const UNKNOWN_AGE = 99;                   // a date that is not a real day: warned about, worded "check the date"
const larderAge = (dateLogged, today) => { const d = String(dateLogged || ''), x = Date.parse(d + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(x)) return UNKNOWN_AGE;
  return Math.max(0, Math.round((Date.parse(today + 'T00:00:00Z') - x) / 86400000)); };

export const vapidFrom = env => (env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY
  ? { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:hub@example.com' } : null);

/** Every reminder kind and its default. The Me tab stores overrides as app_data(person, hub, 'push_pref:<kind>'); prayAt ("HH:MM",
 *  a quarter hour, New York time) turns the reminder to pray on — unset, it is off. readAt ("HH:MM", New York) is when the
 *  reading nudge (kind f260) comes — unset, 8 pm (IMP-F260-F4); the f260 switch still turns it off. */
export const PREF_DEFAULTS = { leftovers: true, f260: true, behind: true, prayer: true, park: true, prayedfor: true, prayAt: null, readAt: null };
export const READ_AT_DEFAULT = '20:00';
/** "HH:MM" → minutes after midnight, or null for anything else. */
export const minutesOf = s => { const m = /^(\d{2}):(\d{2})$/.exec(String(s || '')); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
/** A per-person time pref (prayAt, readAt) for everyone who set one: the row push_pref:<name> over the old whole row. */
async function chosenTimes(env, name) {
  const { results } = await env.DB.prepare("SELECT profile_id, key, value FROM app_data WHERE app_id = 'hub' AND scope = 'person' AND ((key = 'push_prefs' AND value LIKE ?) OR key = ?)").bind('%' + name + '%', 'push_pref:' + name).all();
  const at = {};
  for (const r of results) {
    let v; try { v = r.value == null ? undefined : JSON.parse(r.value); } catch { continue; }
    if (r.key === 'push_pref:' + name) { if (v !== undefined) at[r.profile_id] = { v, row: true }; }
    else if (!(at[r.profile_id] && at[r.profile_id].row) && v && typeof v === 'object') at[r.profile_id] = { v: v[name], row: false };
  }
  return Object.fromEntries(Object.entries(at).map(([pid, x]) => [pid, x.v]));
}

/**
 * Per-profile toggles. Since the review of batch 2b the Me tab keeps one row per kind, app_data(person, hub, 'push_pref:<kind>')
 * (true / false, or "HH:MM" / null for prayAt), so two devices never overwrite each other's switches; the old whole row
 * app_data(person, hub, 'push_prefs') stays as a read-only base the rows override (CLAUDE.md: maps are one row per entry).
 * Everything defaults to on; prayAt to off.
 */
export function mergePrefs(base, rows) {
  const out = { ...PREF_DEFAULTS, ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  for (const r of rows || []) { if (r.value === undefined) continue; const k = r.key.slice('push_pref:'.length); if (k) out[k] = r.value; }
  return out;
}
export async function prefsFor(env, profileId) {
  const profile = { id: profileId };
  const [row, rows] = await Promise.all([
    getOne(env, { appId: 'hub', scope: 'person', profile, key: 'push_prefs' }),
    liveItems(env, { appId: 'hub', scope: 'person', profile, prefix: 'push_pref:' }),
  ]);
  return mergePrefs(row && row.value, rows);
}

/**
 * A PushSubscription the Worker can encrypt for (P2-PWA-10): an http(s) endpoint, keys.p256dh an uncompressed P-256
 * point (65 bytes) and keys.auth 16 bytes, all base64url. Anything else is refused on subscribe and deleted by pushTo.
 */
export function validSubscription(sub) {
  try {
    if (!sub || typeof sub !== 'object' || typeof sub.endpoint !== 'string' || sub.endpoint.length > 2048) return false;
    const u = new URL(sub.endpoint);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname))) return false;   // http only for a local stand-in
    const k = sub.keys; if (!k || typeof k.p256dh !== 'string' || typeof k.auth !== 'string') return false;
    const pub = unb64u(k.p256dh), auth = unb64u(k.auth);
    return pub.length === 65 && pub[0] === 4 && auth.length === 16;
  } catch { return false; }
}

/**
 * Sends one notification to every device where `profileId` has opted in — or, with { deviceId }, to that device's
 * subscription only (Me → Send a test notification, P2-PWA-12). A subscription that cannot be encrypted for, or that the
 * push service says is gone, is deleted; one bad row never stops the others (P2-PWA-10). The payload carries `to` (the
 * profile it is for), so a tap on a shared device can tell whose it was. push_log gets one row: ok 1 only when at least
 * one device took it.
 */
const NO_PUSH_KINDS = ['kid', 'kiosk', 'kitchen'];
export async function pushTo(env, profileId, kind, payload, opts, { deviceId = null } = {}) {
  const vapid = vapidFrom(env);
  if (!vapid) return { sent: 0, ok: 0, error: 'vapid_not_configured' };
  // kids, the display and the kitchen have no notifications (P2-PROF-16): a row one of them still holds from before is removed
  const who = await env.DB.prepare('SELECT kind FROM profiles WHERE id = ?').bind(profileId).first('kind');
  if (!who || NO_PUSH_KINDS.includes(who)) {
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE profile_id = ?').bind(profileId).run().catch(() => {});
    return { sent: 0, ok: 0, error: who ? 'no_push_for_kind' : 'no_such_profile' };
  }
  const q = deviceId
    ? env.DB.prepare('SELECT id, subscription FROM push_subscriptions WHERE profile_id = ? AND device_id = ?').bind(profileId, deviceId)
    : env.DB.prepare('SELECT id, subscription FROM push_subscriptions WHERE profile_id = ?').bind(profileId);
  const { results } = await q.all();
  let ok = 0; const details = [];
  const body = { ...payload, to: profileId };
  for (const row of results) {
    let sub; try { sub = JSON.parse(row.subscription); } catch { sub = null; }
    let r;
    if (!validSubscription(sub)) r = { ok: false, status: 0, gone: true, error: 'bad_subscription' };
    else { try { r = await sendPush(sub, body, vapid, opts); } catch (e) { r = { ok: false, status: 0, gone: false, error: String(e && e.message || e).slice(0, 200) }; } }
    if (r.ok) ok++;
    if (r.gone) { try { await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(row.id).run(); } catch {} }
    details.push({ endpoint: sub && typeof sub.endpoint === 'string' ? sub.endpoint.slice(0, 40) + '…' : null, status: r.status, ok: r.ok, error: r.error || null });
  }
  if (results.length) await env.DB.prepare('INSERT INTO push_log (profile_id, kind, ok, created_at) VALUES (?, ?, ?, ?)').bind(profileId, kind, ok ? 1 : 0, Date.now()).run();
  return { sent: results.length, ok, details };
}

/** Only a push some device took counts toward the day (P2-PWA-11): a failed attempt leaves the kind free for a later run. */
async function alreadySentToday(env, profileId, kind, now) {
  const start = now - 26 * 3600000;
  const { results } = await env.DB.prepare('SELECT created_at FROM push_log WHERE profile_id = ? AND kind = ? AND ok = 1 AND created_at > ?').bind(profileId, kind, start).all();
  const today = nyParts(new Date(now)).date;
  return results.some(r => nyParts(new Date(r.created_at)).date === today);
}

/** The household's grown-ups: the household pushes (fridge, new family prayers, the park) never go to a guest (PWA-UX-2). */
const adultIds = async env => (await env.DB.prepare("SELECT id FROM profiles WHERE kind = 'adult' AND is_guest = 0 ORDER BY sort_order").all()).results.map(r => r.id);
/** Every grown-up, guests too: for their own nudges (the Sunday catch-up is their own reading). */
const anyAdultIds = async env => (await env.DB.prepare("SELECT id FROM profiles WHERE kind = 'adult' ORDER BY sort_order").all()).results.map(r => r.id);

/** Opt-in + once-a-day gate, then send. Appends to out.notified when the person has a device to send to. */
async function notify(env, out, profileId, kind, payload, opts, now) {
  if ((await prefsFor(env, profileId))[kind] === false) { out.skipped.push({ profile: profileId, why: 'pref_off' }); return null; }   // a kind with no switch (praytime: its time is its switch) is on
  if (await alreadySentToday(env, profileId, kind, now)) { out.skipped.push({ profile: profileId, why: 'already_today' }); return null; }
  const r = await pushTo(env, profileId, kind, payload, opts);
  if (r.sent) out.notified.push({ profile: profileId, ...r });
  return r;
}

/** A small JSON value in settings (the prayer and park memories). */
async function readSetting(env, key) {
  const v = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first('value');
  try { return v ? JSON.parse(v) : null; } catch { return null; }
}
async function writeSetting(env, key, value) {
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, JSON.stringify(value)).run();
}

export async function morningJob(env, now = Date.now()) {
  const { date } = nyParts(new Date(now));
  const items = (await liveItems(env, { appId: 'leftovers', scope: 'family', profile: null, prefix: 'item:' })).map(r => r.value)
    .map(i => ({ ...i, days: larderAge(i.dateLogged, date) })).filter(i => i.days >= 5).sort((a, b) => b.days - a.days);
  const age = i => i.days === UNKNOWN_AGE ? 'check the date' : i.days + 'd';
  const out = { job: 'morning', date, due: items.map(i => `${i.name} (${age(i)})`), notified: [], skipped: [] };
  if (!items.length) return out;
  const body = items.length === 1
    ? (items[0].days === UNKNOWN_AGE ? `${items[0].name}: check the date — it may need using up.` : `${items[0].name} is ${items[0].days} days old — use it up.`)
    : `${items.length} to use up: ` + items.slice(0, 4).map(i => `${i.name} (${age(i)})`).join(', ') + (items.length > 4 ? '…' : '');
  for (const pid of await adultIds(env)) {
    await notify(env, out, pid, 'leftovers', { title: 'Larder Ledger', body, url: '#leftovers', tag: 'leftovers' }, { ttl: 6 * 3600 }, now);
  }
  return out;
}

/**
 * Everyone's F260 person rows, keyed by profile: { 'f260.log', 'f260.summary', 'f260.weekStart' }. Since batch 0e the
 * log is one row per day (log:<date>, true | false) over the old whole-map row; they are folded into 'f260.log' here.
 */
async function f260ByProfile(env, date = null, now = Date.now()) {
  const { results } = await env.DB.prepare("SELECT profile_id, key, value, updated_at FROM app_data WHERE app_id = 'f260' AND scope = 'person' AND (key IN ('f260.log', 'f260.summary', 'f260.weekStart') OR substr(key, 1, 4) = 'log:') AND value IS NOT NULL ORDER BY key").all();
  const byProfile = {}, days = {};
  for (const r of results) {
    let v; try { v = JSON.parse(r.value); } catch { continue; }
    if (r.key.startsWith('log:')) { (days[r.profile_id] ||= []).push([r.key.slice(4), v]); if (date && r.key === 'log:' + date) (byProfile[r.profile_id] ||= {}).logRow = { value: v, updated_at: +r.updated_at }; }
    else (byProfile[r.profile_id] ||= {})[r.key] = v;
  }
  for (const [pid, list] of Object.entries(days)) {
    const d = (byProfile[pid] ||= {}); const log = { ...(d['f260.log'] && typeof d['f260.log'] === 'object' ? d['f260.log'] : {}) };
    for (const [day, v] of list) { if (v === false) delete log[day]; else log[day] = v; }
    d['f260.log'] = log;
  }
  // the readings ticked in the last two days, for an untick another device's tick outlived (f260UntickOutlived)
  if (date) {
    const ticks = await f260RecentTicks(env, null, date, now);
    for (const [pid, list] of Object.entries(ticks)) if (byProfile[pid]) byProfile[pid].ticks = list;
  }
  return byProfile;
}
/**
 * P3-F260-02, review round 1: an untick on one device sees only that device's ticks, so a reading another device ticked
 * offline can land after it with an older log:<date> = true that loses. Today still counts as read when its log:<date>
 * row is an untick (false) written AFTER a reading that is still ticked and was ticked that day (the app puts the day
 * back on its next pull; this is the house's own reading meanwhile). A later write (a Reset's Undo, a restore) never counts.
 */
/**
 * The readings ticked in the last two days, per profile, as their rows' times — less the ones a Reset's Undo or a restore
 * wrote back on `date` (listed in the person row restored:<date>, review round 3): those carry today's date but were
 * not read today. profileIds null = everyone.
 */
export async function f260RecentTicks(env, profileIds, date, now = Date.now()) {
  const only = profileIds ? ` AND IFNULL(profile_id, '') IN (${profileIds.map(() => '?').join(',')})` : '';
  const args = profileIds || [];
  const { results: ticks } = await env.DB.prepare(`SELECT profile_id, key, updated_at FROM app_data WHERE app_id = 'f260' AND scope = 'person' AND substr(key, 1, 5) = 'done:' AND value = 'true' AND updated_at > ?${only}`).bind(now - 2 * 86400000, ...args).all();
  const { results: back } = await env.DB.prepare(`SELECT profile_id, value FROM app_data WHERE app_id = 'f260' AND scope = 'person' AND substr(key, 1, ?) = ? AND value IS NOT NULL${only}`).bind(('restored:' + date + ':').length, 'restored:' + date + ':', ...args).all();
  const restored = {};
  for (const r of back) { let v; try { v = JSON.parse(r.value); } catch { continue; } addRestored((restored[r.profile_id] ||= new Map()), v); }
  const out = {};
  for (const t of ticks) { if (isWrittenBack(restored[t.profile_id], t.key.slice(5), +t.updated_at)) continue; (out[t.profile_id] ||= []).push(+t.updated_at); }
  return out;
}
/**
 * Review round 4: a restored:<date>:<uid> row is { ids, upTo } — the readings one Undo or restore turned back on and the
 * newest stamp it gave them (upTo null while it is being written: all of them). A done: row of a listed id stamped at or
 * before upTo was written back; a later tick of it is real. apps/f260.html restoredOn()/ticksToday() read it the same way.
 */
export function addRestored(map, v) {
  if (!v || typeof v !== 'object' || !Array.isArray(v.ids)) return map;
  const up = v.upTo != null && Number.isFinite(+v.upTo) ? +v.upTo : Infinity;
  for (const id of v.ids) map.set(String(id), Math.max(map.get(String(id)) || 0, up));
  return map;
}
export const isWrittenBack = (map, id, t) => !!map && map.has(id) && t <= map.get(id);
/** The first 8 am / 8 pm firing: restored:<date>:* rows older than yesterday (New York) go (round 4); only today's are read. */
export async function pruneRestored(env, now = Date.now()) {
  const today = nyParts(new Date(now)).date, yesterday = new Date(Date.parse(today + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
  const r = await env.DB.prepare("DELETE FROM app_data WHERE app_id = 'f260' AND scope = 'person' AND substr(key, 1, 9) = 'restored:' AND substr(key, 10, 10) < ?").bind(yesterday).run();
  return (r && r.meta && r.meta.changes) || 0;
}
export function f260UntickOutlived(date, logRow, tickTimes) {
  if (!logRow || logRow.value !== false || !logRow.updated_at) return false;
  return (tickTimes || []).some(t => t < logRow.updated_at && nyParts(new Date(t)).date === date);
}

/**
 * The reading nudge (kind f260): no F260 reading logged today -> that person, at the time they chose in Me → Notifications
 * (push_pref:readAt, "HH:MM" New York, on the half hour; unset = 8 pm), once a day. It runs at every cron firing (IMP-F260-F4);
 * the chosen time's whole hour is eligible, as praytime's is, so a push that failed is tried again at the next firing and the
 * once-a-day gate (delivered pushes only) stops a second. Forced from Admin ({ forced }), it ignores the time.
 */
export async function eveningJob(env, now = Date.now(), { forced = false } = {}) {
  const { date, hour, minute } = nyParts(new Date(now));
  const out = { job: 'evening', date, checked: [], notified: [], skipped: [] };
  const times = await chosenTimes(env, 'readAt'), nowMin = hour * 60 + minute;
  const timeOf = pid => (minutesOf(times[pid]) !== null ? times[pid] : READ_AT_DEFAULT);
  const due = pid => { const m = minutesOf(timeOf(pid)); return nowMin >= m && nowMin < m + 60; };
  // a firing in no one's hour reads nothing more (the default hour, 8 pm, covers everyone who chose no time)
  const defaultDue = (m => nowMin >= m && nowMin < m + 60)(minutesOf(READ_AT_DEFAULT));
  if (!forced && !defaultDue && !Object.keys(times).some(pid => minutesOf(times[pid]) !== null && due(pid))) { out.quiet = true; return out; }
  for (const [pid, d] of Object.entries(await f260ByProfile(env, date, now))) {
    const log = d['f260.log'] || {}, sum = d['f260.summary'] || null;
    const readToday = !!log[date] || f260UntickOutlived(date, d.logRow, d.ticks);   // an untick another device's tick outlived (review round 1)
    out.checked.push({ profile: pid, readToday, at: timeOf(pid) });
    if (readToday || (sum && sum.finished)) continue;
    if (!forced && !due(pid)) { out.skipped.push({ profile: pid, why: 'not_their_time' }); continue; }
    const next = sum && sum.next ? `${sum.next.ref} is next (week ${sum.next.week}, day ${sum.next.day}).` : 'Your next reading is waiting.';
    await notify(env, out, pid, 'f260', { title: 'F260', body: `No reading checked off today yet. ${next}`, url: '#f260', tag: 'f260' }, { ttl: 3 * 3600 }, now);
  }
  return out;
}

/**
 * Weekly catch-up (Sunday 8 pm). "Behind" is read off the app's own rows, never recomputed from the log:
 *   f260.summary  = { week, weekDone, streak, next: {week, day, ref}, finished }  (written by apps/f260.html on every render)
 *   f260.weekStart = { "<week>": "YYYY-MM-DD" }                                   (the day each week was started)
 * Rule: a week has 5 readings. If the person's current week was started more than 3 days ago (so they have had
 * at least four calendar days on it), behind = 5 - weekDone. We push when behind >= 2 — one reading short on a Sunday is
 * normal, two or more means the week is slipping. No weekStart for the current week (or a finished plan) → not judged.
 * Adults only: F260 is an adult app. One per person per day, kind 'behind', pref push_prefs.behind.
 */
export function behindFor(d, today) {
  const sum = d['f260.summary'], starts = d['f260.weekStart'] || {};
  if (!sum || sum.finished || !Number.isFinite(+sum.week)) return { behind: 0, why: 'no_summary' };
  const started = starts[String(sum.week)];
  if (!started) return { behind: 0, why: 'no_week_start' };
  const days = ageDays(started, today);
  if (!(days > 3)) return { behind: 0, why: 'week_too_young', days };
  const done = Math.max(0, Math.min(5, +sum.weekDone || 0));
  return { behind: 5 - done, days, next: sum.next || null };
}

export async function behindJob(env, now = Date.now()) {
  const { date } = nyParts(new Date(now));
  const out = { job: 'behind', date, checked: [], notified: [], skipped: [] };
  const adults = new Set(await anyAdultIds(env));   // a guest's own reading too (they see the switch)
  for (const [pid, d] of Object.entries(await f260ByProfile(env))) {
    if (!adults.has(pid)) continue;
    const b = behindFor(d, date);
    out.checked.push({ profile: pid, behind: b.behind, why: b.why || null });
    if (b.behind < 2) continue;
    const next = b.next && b.next.ref ? ` — ${b.next.ref} is next` : '';
    await notify(env, out, pid, 'behind', { title: 'F260 · weekly catch-up', body: `You are ${b.behind} readings behind${next}.`, url: '#f260', tag: 'behind' }, { ttl: 12 * 3600 }, now);
  }
  return out;
}

/**
 * New family-list prayers -> every household adult except whoever added it. Runs at the 8 am and 8 pm runs.
 * "New" cannot be read off app_data.id (a key can be re-used after a delete: same row, tombstone -> live), so the job keeps
 * a snapshot of what was live at its last run:
 *   settings.last_prayer_push_at = {"v": 2, "at": <ms>, "seen": {"prayer:<id>": "<id>|<createdAt>", …}, "owed": {"<profile>": ["prayer:<id>", …]}}
 * A live row is NEW when its key was not live at the last run, or when its fingerprint (the request's own id and its
 * createdAt, never the title: editing the wording is not a new request, P3-PRAYER-25) differs (deleted and re-created
 * under the same key between two runs). Each new row is OWED to every household adult but its author, and stays owed
 * until a push to that person was delivered (P2-PWA-04: no once-a-day gate, so a prayer added after the morning push goes
 * out at 8 pm; a failed delivery is tried again at the next run). A person with the switch off, or with no device
 * subscribed, is not owed anything (nothing piles up for later). A row deleted meanwhile is dropped from what is owed.
 * The very first run (or no watermark) only seeds the snapshot; a v1 snapshot's keys count as seen.
 * The author is the row's `by` field (the prayer app writes `by: hub.profile.id` on every row it creates); rows without it
 * (older app versions, hand-written rows) fall back to the profile behind the matching "…family list: <title>" /
 * "Added a family prayer request: <title>" activity line since the last run. Unknown author -> every adult is owed it.
 */
const PRAYER_WM = 'last_prayer_push_at';
const prayerFingerprint = v => `${v.id || ''}|${v.createdAt || ''}`;
/** Every live family prayer row as { key, value, updated_at } (bad JSON and rows without a title are dropped). */
async function liveFamilyPrayers(env) {
  const { results } = await env.DB.prepare("SELECT key, value, updated_at FROM app_data WHERE app_id = 'prayer' AND scope = 'family' AND key LIKE 'prayer:%' AND value IS NOT NULL ORDER BY synced_at, id").all();
  const rows = [];
  for (const r of results) { try { const v = JSON.parse(r.value); if (v && v.title) rows.push({ key: r.key, value: v, updated_at: r.updated_at }); } catch {} }
  return rows;
}

export async function prayerJob(env, now = Date.now()) {
  const { date } = nyParts(new Date(now));
  const out = { job: 'prayer', date, new: [], notified: [], skipped: [] };
  const live = await liveFamilyPrayers(env);
  const byKey = Object.fromEntries(live.map(r => [r.key, r]));
  const seen = Object.fromEntries(live.map(r => [r.key, prayerFingerprint(r.value)]));
  const wm = await readSetting(env, PRAYER_WM);
  if (!wm || !wm.seen || typeof wm.seen !== 'object') { await writeSetting(env, PRAYER_WM, { v: 2, at: now, seen, owed: {} }); out.seeded = { live: live.length }; return out; }
  const v1 = wm.v !== 2;   // a snapshot from before batch 2b holds createdAt|title: its keys count as seen, never re-announced
  const fresh = live.filter(r => !(r.key in wm.seen) || (!v1 && wm.seen[r.key] !== seen[r.key]));
  const owed = {};
  for (const [pid, keys] of Object.entries(wm.owed && typeof wm.owed === 'object' ? wm.owed : {})) {
    const still = (Array.isArray(keys) ? keys : []).filter(k => byKey[k]);
    if (still.length) owed[pid] = still;
  }
  let acts = [];
  if (fresh.some(r => typeof (r.value.by || r.value.addedBy || r.value.author || r.value.createdBy) !== 'string')) {
    acts = (await env.DB.prepare("SELECT profile_id, text FROM activity WHERE app_id = 'prayer' AND created_at > ? AND profile_id IS NOT NULL").bind((+wm.at || 0) - 3600000).all()).results;
  }
  const authorOf = p => {
    const named = p.by || p.addedBy || p.author || p.createdBy;
    if (typeof named === 'string') return named;
    const t = String(p.title).trim();
    const a = acts.find(x => x.text === 'Sent a request to the family list: ' + t || x.text.startsWith('Added a family prayer request: ' + t));
    return a ? a.profile_id : null;
  };
  const author = {};
  for (const r of fresh) { author[r.key] = authorOf(r.value); out.new.push({ title: r.value.title, by: author[r.key] }); }
  const adults = await adultIds(env);
  for (const pid of adults) {
    const add = fresh.filter(r => author[r.key] !== pid).map(r => r.key);
    if (add.length) owed[pid] = [...new Set([...(owed[pid] || []), ...add])];
  }
  for (const pid of adults) {
    const keys = owed[pid] || [];
    if (!keys.length) { if (fresh.length) out.skipped.push({ profile: pid, why: 'author' }); continue; }
    if (!(await prefsFor(env, pid)).prayer) { out.skipped.push({ profile: pid, why: 'pref_off' }); delete owed[pid]; continue; }
    const mine = keys.map(k => byKey[k].value);
    const first = mine[0];
    const who = first.for ? ` (for ${first.for})` : '';
    const body = mine.length === 1
      ? `New on the family list: ${first.title}${who}.`
      : `${mine.length} new on the family list: ` + mine.slice(0, 3).map(p => p.title).join(', ') + (mine.length > 3 ? '…' : '') + '.';
    const r = await pushTo(env, pid, 'prayer', { title: 'Prayer', body, url: '#prayer', tag: 'prayer' }, { ttl: 12 * 3600 });
    if (r.sent) out.notified.push({ profile: pid, ...r });
    if (r.ok || !r.sent) delete owed[pid];                               // told, or nowhere to tell them
    else out.skipped.push({ profile: pid, why: 'delivery_failed_retry' }); // kept: the next run tries again
  }
  for (const pid of Object.keys(owed)) if (!adults.includes(pid)) delete owed[pid];
  await writeSetting(env, PRAYER_WM, { v: 2, at: now, seen, owed });
  return out;
}

/**
 * GAP-PRAYER-1 (the asker): at 8 pm, whoever added a family request hears who prayed for it today, e.g. "Elizabeth prayed
 * for your request today: Grandma's surgery." One push a day per person (kind 'prayedfor', default on), never for their
 * own ticks, never for an answered request. Reads the rows' prayedBy[today] (profile ids since batch 0g; an older name
 * is shown as written).
 */
export async function prayedForJob(env, now = Date.now()) {
  const { date } = nyParts(new Date(now));
  const out = { job: 'prayedfor', date, askers: [], notified: [], skipped: [] };
  const { results: profiles } = await env.DB.prepare('SELECT id, name, kind FROM profiles').all();
  const byId = Object.fromEntries(profiles.map(p => [p.id, p]));
  const mine = {};
  for (const r of await liveFamilyPrayers(env)) {
    const p = r.value, by = typeof p.by === 'string' ? p.by : null;
    if (!by || !byId[by] || byId[by].kind !== 'adult' || p.status === 'answered') continue;
    const day = p.prayedBy && typeof p.prayedBy === 'object' && !Array.isArray(p.prayedBy) ? p.prayedBy[date] : null;
    const who = (Array.isArray(day) ? day : []).map(x => String(x)).filter(x => x && x !== by && x !== byId[by].name);
    if (!who.length) continue;
    (mine[by] ||= []).push({ title: p.title, names: [...new Set(who.map(x => (byId[x] ? byId[x].name : x)))] });
  }
  const and = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  for (const [pid, reqs] of Object.entries(mine)) {
    out.askers.push({ profile: pid, prayed: [...new Set(reqs.flatMap(q => q.names))], requests: reqs.length });
    // each request names only the people who prayed for it (review of batch 2b)
    const body = reqs.length === 1
      ? `${and(reqs[0].names)} prayed for your request today: ${reqs[0].title}.`
      : 'Prayed for your requests today: ' + reqs.slice(0, 3).map(q => `${q.title} (${and(q.names)})`).join('; ') + (reqs.length > 3 ? '…' : '') + '.';
    await notify(env, out, pid, 'prayedfor', { title: 'Prayer', body, url: '#prayer', tag: 'prayedfor' }, { ttl: 12 * 3600 }, now);
  }
  return out;
}

/**
 * GAP-PRAYER-1 (the reminder): a person who picked a time in Me → Notifications (push_prefs.prayAt, "HH:MM" New York on
 * the quarter hour) is reminded at that run: "Time to pray — 3 on your list, 5 on the family list." Private titles are
 * never put on a lock screen. Once a day (kind 'praytime').
 */
export async function prayTimeJob(env, now = Date.now()) {
  const { date, hour, minute } = nyParts(new Date(now));
  const slot = `${String(hour).padStart(2, '0')}:${String(minute - minute % 15).padStart(2, '0')}`;
  const out = { job: 'praytime', date, slot, due: [], notified: [], skipped: [] };
  // who chose a time: the per-kind row push_pref:prayAt over the old whole row (review of batch 2b)
  const at = await chosenTimes(env, 'prayAt');
  // the chosen time's whole hour is eligible (a push that failed at the time is tried again until it lands, review of
  // batch 2b); the once-a-day gate (delivered pushes only) stops a second one
  const nowMin = hour * 60 + minute;
  const due = Object.entries(at).filter(([, v]) => { const m = minutesOf(v); return m !== null && nowMin >= m && nowMin < m + 60; }).map(([pid]) => pid);
  if (!due.length) return out;
  const { results: rows } = await env.DB.prepare("SELECT scope, profile_id, value FROM app_data WHERE app_id = 'prayer' AND key LIKE 'prayer:%' AND value IS NOT NULL AND (scope = 'family' OR (scope = 'person' AND profile_id IN (" + due.map(() => '?').join(',') + ')))').bind(...due).all();
  const active = r => { try { const v = JSON.parse(r.value); return !!(v && v.title && (v.status || 'active') === 'active'); } catch { return false; } };
  const fam = rows.filter(r => r.scope === 'family' && active(r)).length;
  for (const pid of due) {
    const own = rows.filter(r => r.scope === 'person' && r.profile_id === pid && active(r)).length;
    out.due.push(pid);
    const parts = [own ? `${own} on your list` : '', fam ? `${fam} on the family list` : ''].filter(Boolean);
    await notify(env, out, pid, 'praytime', { title: 'Time to pray', body: parts.length ? parts.join(', ') + '.' : 'A quiet moment to pray.', url: '#prayer', tag: 'praytime' }, { ttl: 3600 }, now);
  }
  return out;
}

/**
 * Park day: a kid's marker on the park map has gone quiet. Rows are app_data(family, dollywood-live, loc:<profileId>)
 * = { x, y, acc, hdg, t: <writer ms>, name, emoji, color }. The job runs at every cron firing (every 15 min, P2-PWA-02).
 * Ages are when the house last HEARD from a dot — the row's synced_at, the Worker's own clock — never the phone's `t` (a
 * phone with a slow clock that keeps publishing is not quiet). When at least one household adult's dot (never a guest's)
 * is fresh (≤ 30 min) and a kid's has not been heard from for more than 20 min (and less than 12 h: an old day's dot is
 * not today's park day), every household adult with the park switch on is told. Each quiet spell (a kid's dot as last
 * heard) is told once per person, remembered in settings.park_alerts = {kid: {t, told: [ids]}}: a person whose push
 * failed, or who turns the switch on or subscribes later in the spell, is told at the next run; the kid's next update ends
 * the spell, so a second quiet spell the same day is told again. Kids never receive it. scripts/test-park.mjs proves it.
 */
const PARK_DAY_MS = 4 * 3600000, FRESH_MS = 30 * 60000, QUIET_MS = 20 * 60000, KID_WINDOW_MS = 12 * 3600000;
const PARK_KEY = 'park_alerts';
export async function parkJob(env, now = Date.now()) {
  const { date } = nyParts(new Date(now));
  const out = { job: 'park', date, parkDay: false, markers: [], stale: [], notified: [], skipped: [] };
  // when the house last HEARD from each dot (synced_at, the Worker's own clock), not the writer's t: a kid's phone whose clock
  // runs slow still counts as updating (review of batch 2b)
  const { results: rows } = await env.DB.prepare("SELECT key, synced_at, updated_at FROM app_data WHERE app_id = 'dollywood-live' AND scope = 'family' AND profile_id IS NULL AND substr(key, 1, 4) = 'loc:' AND value IS NOT NULL").all();
  const memory = (await readSetting(env, PARK_KEY)) || {};
  const spells = {};
  const save = async () => { if (JSON.stringify(spells) !== JSON.stringify(memory)) await writeSetting(env, PARK_KEY, spells); };
  if (!rows.length) { await save(); return out; }
  const { results: profiles } = await env.DB.prepare('SELECT id, name, kind, is_guest FROM profiles').all();
  const kindOf = Object.fromEntries(profiles.map(p => [p.id, p.kind === 'adult' && p.is_guest ? 'guest' : p.kind])), nameOf = Object.fromEntries(profiles.map(p => [p.id, p.name]));
  const markers = rows.map(r => { const id = r.key.slice(4); const t = Math.min(+r.synced_at || +r.updated_at || 0, now); return { id, kind: kindOf[id], name: nameOf[id] || id, t, age: now - t }; })
    .filter(m => m.kind);
  out.markers = markers.map(m => ({ id: m.id, kind: m.kind, ageMin: Math.round(m.age / 60000) }));
  out.parkDay = markers.some(m => m.age < PARK_DAY_MS);
  const stale = markers.filter(m => m.kind === 'kid' && m.age > QUIET_MS && m.age < KID_WINDOW_MS);
  out.stale = stale.map(m => ({ id: m.id, ageMin: Math.round(m.age / 60000) }));
  // a spell ends when the kid's marker moves on (another t) or ages out of the window
  for (const m of stale) spells[m.id] = memory[m.id] && +memory[m.id].t === +m.t ? { t: m.t, told: Array.isArray(memory[m.id].told) ? [...memory[m.id].told] : [] } : { t: m.t, told: [] };
  const adultFresh = markers.some(m => m.kind === 'adult' && m.age <= FRESH_MS);
  if (!out.parkDay || !adultFresh || !stale.length) { await save(); return out; }
  const min = m => Math.round(m.age / 60000);
  for (const pid of await adultIds(env)) {
    const kids = stale.filter(m => !spells[m.id].told.includes(pid));
    if (!kids.length) { out.skipped.push({ profile: pid, why: 'already_told' }); continue; }
    if (!(await prefsFor(env, pid)).park) { out.skipped.push({ profile: pid, why: 'pref_off' }); continue; }
    const body = kids.length === 1
      ? `${kids[0].name}'s spot has not updated for ${min(kids[0])} min.`
      : kids.map(m => `${m.name}'s spot`).join(' and ') + ` have not updated (${kids.map(m => min(m) + ' min').join(', ')}).`;
    const r = await pushTo(env, pid, 'park', { title: 'Dollywood park map', body, url: '#dollywood-live', tag: 'park' }, { ttl: 1800, urgency: 'high' });
    if (r.sent) out.notified.push({ profile: pid, ...r });
    if (r.ok) for (const m of kids) spells[m.id].told.push(pid);
  }
  await save();
  return out;
}

export const JOBS = { morning: morningJob, evening: eveningJob, behind: behindJob, prayer: prayerJob, prayedfor: prayedForJob, park: parkJob, praytime: prayTimeJob };

/**
 * What a cron firing at `now` runs (the cron fires every 15 min): every firing of the 8 o'clock hour, New York -> morning +
 * prayer; of the 20 o'clock hour -> behind on Sundays + prayer + prayedfor (a push that failed at :00 is tried again at
 * :15, :30, :45; the once-a-day gate and the prayer memory keep anyone from being told twice); every firing -> evening (the
 * reading nudge, which picks the people whose chosen time's hour this is, 8 pm unless they chose another; IMP-F260-F4),
 * park and praytime (likewise). main = the first firing of 8 am / 8 pm (the guest and kids'-chat clean-ups run then).
 */
export function jobsAt(now) {
  const { hour, minute, weekday } = nyParts(new Date(now));
  const main = minute < 15 && (hour === 8 || hour === 20);
  // every firing of the 8 o'clock and 20 o'clock hours runs that hour's jobs (review of batch 2b): a push that failed at
  // 8:00 is tried again at 8:15, 8:30 and 8:45; the once-a-day gate (delivered pushes only) and the prayer job's own memory
  // keep anyone from being told twice
  const names = hour === 8 ? ['morning', 'prayer'] : hour === 20 ? [...(weekday === 'Sun' ? ['behind'] : []), 'prayer', 'prayedfor'] : [];
  return { hour, minute, weekday, main, names: ['evening', ...names, 'park', 'praytime'] };
}
/**
 * Called by the cron trigger. `force` runs one named job regardless of the clock and returns its result alone
 * (POST /api/admin/cron/run); a scheduled run returns { nyHour, nyMinute, weekday, main, ran: [results] }.
 */
export async function runCron(env, now = Date.now(), force = null) {
  if (force) {
    if (!JOBS[force]) return { job: null, error: 'bad_job' };
    return JOBS[force](env, now, { forced: true });   // the reading nudge then ignores each person's time (the others ignore the flag)
  }
  const { hour, minute, weekday, main, names } = jobsAt(now);
  const ran = [];
  for (const n of names) {
    try { ran.push(await JOBS[n](env, now)); } catch (e) { ran.push({ job: n, error: String(e && e.message || e) }); }
  }
  return { nyHour: hour, nyMinute: minute, weekday, main, ran };
}
