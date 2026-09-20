// Scheduled reminders + push delivery.
//   morning (8:00 New York):        leftovers that hit "use it up" within two days -> every adult who opted in
//   evening (8:00 pm New York):     F260 reading not checked today -> that profile
//   behind  (Sunday 8:00 pm):       F260 week running 2+ readings behind -> that adult (weekly catch-up)
//   prayer  (every run, 8 am/8 pm): a family-list prayer added since the last run -> every adult except whoever added it
//   park    (every run):            on a park day, a kid's map marker has gone quiet while an adult's is fresh -> adults
// Cron triggers are UTC, so wrangler.toml fires at both possible UTC hours and runCron checks the local hour.
// Every kind is one notification per person per day (push_log), honours app_data(person, hub, push_prefs).<kind>
// (default on) and can be forced with POST /api/admin/cron/run {job}.
import { sendPush } from './push.js';
import { liveItems, getOne } from './data.js';

const NY = 'America/New_York';
export function nyParts(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: NY, year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hour12: false, weekday: 'short' }).formatToParts(d);
  const g = t => (p.find(x => x.type === t) || {}).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: +g('hour') % 24, weekday: g('weekday') };
}
const ageDays = (dateLogged, today) => Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(dateLogged + 'T00:00:00Z')) / 86400000);

export const vapidFrom = env => (env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY
  ? { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:hub@example.com' } : null);

/** Every reminder kind and its default. The Me tab stores overrides as app_data(person, hub, push_prefs). */
export const PREF_DEFAULTS = { leftovers: true, f260: true, behind: true, prayer: true, park: true };

/** Per-profile toggles, stored by the Me tab as app_data(person, hub, push_prefs). Everything defaults to on. */
export async function prefsFor(env, profileId) {
  const row = await getOne(env, { appId: 'hub', scope: 'person', profile: { id: profileId }, key: 'push_prefs' });
  return { ...PREF_DEFAULTS, ...(row && row.value ? row.value : {}) };
}

/** Sends one notification to every device where `profileId` has opted in. Dead subscriptions are removed. */
export async function pushTo(env, profileId, kind, payload, opts) {
  const vapid = vapidFrom(env);
  if (!vapid) return { sent: 0, ok: 0, error: 'vapid_not_configured' };
  const { results } = await env.DB.prepare('SELECT id, subscription FROM push_subscriptions WHERE profile_id = ?').bind(profileId).all();
  let ok = 0; const details = [];
  for (const row of results) {
    let sub; try { sub = JSON.parse(row.subscription); } catch { sub = null; }
    const r = sub && sub.endpoint ? await sendPush(sub, payload, vapid, opts) : { ok: false, status: 0, gone: true };
    if (r.ok) ok++;
    if (r.gone) await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(row.id).run();
    details.push({ endpoint: sub ? sub.endpoint.slice(0, 40) + '…' : null, status: r.status, ok: r.ok, error: r.error || null });
  }
  if (results.length) await env.DB.prepare('INSERT INTO push_log (profile_id, kind, ok, created_at) VALUES (?, ?, ?, ?)').bind(profileId, kind, ok ? 1 : 0, Date.now()).run();
  return { sent: results.length, ok, details };
}

async function alreadySentToday(env, profileId, kind, now) {
  const start = now - 24 * 3600000;
  const row = await env.DB.prepare('SELECT created_at FROM push_log WHERE profile_id = ? AND kind = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1').bind(profileId, kind, start).first();
  return !!row && nyParts(new Date(row.created_at)).date === nyParts(new Date(now)).date;
}

const adultIds = async env => (await env.DB.prepare("SELECT id FROM profiles WHERE kind = 'adult' ORDER BY sort_order").all()).results.map(r => r.id);

/** Opt-in + once-a-day gate, then send. Appends to out.notified when at least one device was reached. */
async function notify(env, out, profileId, kind, payload, opts, now) {
  if (!(await prefsFor(env, profileId))[kind]) { out.skipped.push({ profile: profileId, why: 'pref_off' }); return; }
  if (await alreadySentToday(env, profileId, kind, now)) { out.skipped.push({ profile: profileId, why: 'already_today' }); return; }
  const r = await pushTo(env, profileId, kind, payload, opts);
  if (r.sent) out.notified.push({ profile: profileId, ...r });
}

export async function morningJob(env, now = Date.now()) {
  const { date } = nyParts(new Date(now));
  const items = (await liveItems(env, { appId: 'leftovers', scope: 'family', profile: null, prefix: 'item:' })).map(r => r.value)
    .map(i => ({ ...i, days: ageDays(i.dateLogged, date) })).filter(i => i.days >= 5).sort((a, b) => b.days - a.days);
  const out = { job: 'morning', date, due: items.map(i => `${i.name} (${i.days}d)`), notified: [], skipped: [] };
  if (!items.length) return out;
  const body = items.length === 1
    ? `${items[0].name} is ${items[0].days} days old — use it up.`
    : `${items.length} to use up: ` + items.slice(0, 4).map(i => `${i.name} (${i.days}d)`).join(', ') + (items.length > 4 ? '…' : '');
  for (const pid of await adultIds(env)) {
    await notify(env, out, pid, 'leftovers', { title: 'Larder Ledger', body, url: '#leftovers', tag: 'leftovers' }, { ttl: 6 * 3600 }, now);
  }
  return out;
}

/** Everyone's F260 person rows, keyed by profile: { 'f260.log', 'f260.summary', 'f260.weekStart' }. */
async function f260ByProfile(env) {
  const { results } = await env.DB.prepare("SELECT profile_id, key, value FROM app_data WHERE app_id = 'f260' AND scope = 'person' AND key IN ('f260.log', 'f260.summary', 'f260.weekStart') AND value IS NOT NULL").all();
  const byProfile = {};
  for (const r of results) { try { (byProfile[r.profile_id] ||= {})[r.key] = JSON.parse(r.value); } catch {} }
  return byProfile;
}

export async function eveningJob(env, now = Date.now()) {
  const { date } = nyParts(new Date(now));
  const out = { job: 'evening', date, checked: [], notified: [], skipped: [] };
  for (const [pid, d] of Object.entries(await f260ByProfile(env))) {
    const log = d['f260.log'] || {}, sum = d['f260.summary'] || null;
    const readToday = !!log[date];
    out.checked.push({ profile: pid, readToday });
    if (readToday || (sum && sum.finished)) continue;
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
  const adults = new Set(await adultIds(env));
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
 * New family-list prayers -> every adult except whoever added it. Runs at the ordinary 8 am / 8 pm runs.
 * "New since the last run" cannot be read off app_data.id: the prayer app re-uses keys (nextId() picks
 * 'p' + (count + 1), so deleting the newest prayer and adding another lands on the same prayer:<id> row, which putOne()
 * UPDATEs in place — same id, tombstone → live). So the watermark is a snapshot of what was live at the last run:
 *   settings.last_prayer_push_at = {"at": <ms>, "seen": {"prayer:<id>": "<createdAt>|<title>", …}}
 * A live row is NEW when its key was not live at the last run (brand new, or a tombstone then), or when its fingerprint
 * (createdAt + title — the app never changes either after creation; praying, updates and answers touch other fields)
 * differs from the snapshot (deleted and re-created under the same key between two runs). The one blind spot is a
 * same-day delete-and-re-add with the identical title, which reads as the same prayer and is not re-announced.
 * The very first run (or an older {at, id} watermark) only seeds the snapshot — otherwise deploying this would announce
 * every prayer already on the list.
 * The author is the row's `by` field: the prayer app writes `by: hub.profile.id` on every row it creates (the add form,
 * "share to the family list" and paste-import), so a prayer typed straight into the family list names its author without
 * an activity line. Rows without it (older app versions, the chat tool, hand-written rows) fall back to the profile behind
 * the matching "…family list: <title>" / "Added a family prayer request: <title>" activity line since the last run.
 * Unknown author → every adult hears about it.
 */
const PRAYER_WM = 'last_prayer_push_at';
const prayerFingerprint = v => `${v.createdAt || ''}|${String(v.title).trim().slice(0, 120)}`;
async function prayerWatermark(env) {
  const v = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(PRAYER_WM).first('value');
  try { const o = v ? JSON.parse(v) : null; return o && o.seen && typeof o.seen === 'object' ? { at: +o.at || 0, seen: o.seen } : null; } catch { return null; }
}
async function setPrayerWatermark(env, at, seen) {
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(PRAYER_WM, JSON.stringify({ at, seen })).run();
}
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
  const seen = Object.fromEntries(live.map(r => [r.key, prayerFingerprint(r.value)]));
  const wm = await prayerWatermark(env);
  if (!wm) { await setPrayerWatermark(env, now, seen); out.seeded = { live: live.length }; return out; }
  const rows = live.filter(r => wm.seen[r.key] !== seen[r.key]).map(r => ({ ...r.value, _key: r.key, _at: r.updated_at }));
  await setPrayerWatermark(env, now, seen);
  if (!rows.length) return out;
  const { results: acts } = await env.DB.prepare("SELECT profile_id, text FROM activity WHERE app_id = 'prayer' AND created_at > ? AND profile_id IS NOT NULL").bind(wm.at - 3600000).all();
  const authorOf = p => {
    const named = p.by || p.addedBy || p.author || p.createdBy;
    if (typeof named === 'string') return named;
    const t = String(p.title).trim();
    const a = acts.find(x => x.text === 'Sent a request to the family list: ' + t || x.text.startsWith('Added a family prayer request: ' + t));
    return a ? a.profile_id : null;
  };
  const adults = await adultIds(env);
  const byAuthor = {};
  for (const p of rows) { const a = authorOf(p); out.new.push({ title: p.title, by: a }); (byAuthor[a || ''] ||= []).push(p); }
  for (const pid of adults) {
    const mine = rows.filter(p => authorOf(p) !== pid);
    if (!mine.length) { out.skipped.push({ profile: pid, why: 'author' }); continue; }
    const first = mine[0];
    const who = first.for ? ` (for ${first.for})` : '';
    const body = mine.length === 1
      ? `New on the family list: ${first.title}${who}.`
      : `${mine.length} new on the family list: ` + mine.slice(0, 3).map(p => p.title).join(', ') + (mine.length > 3 ? '…' : '') + '.';
    await notify(env, out, pid, 'prayer', { title: 'Prayer', body, url: '#prayer', tag: 'prayer' }, { ttl: 12 * 3600 }, now);
  }
  return out;
}

/**
 * Park day: a kid's marker on the park map has gone quiet. Rows are app_data(family, dollywood-live, loc:<profileId>)
 * = { x, y, acc, hdg, t: <writer ms>, name, emoji, color }. A "park day" is any marker fresher than 4 h. When at least
 * one adult's marker is fresh (≤ 30 min) and a kid's is older than 30 min, every adult is told — once a day, kind 'park',
 * pref push_prefs.park. Kids never receive it. Freshness uses the row's own `t`, falling back to updated_at.
 */
const PARK_DAY_MS = 4 * 3600000, STALE_MS = 30 * 60000;
export async function parkJob(env, now = Date.now()) {
  const { date } = nyParts(new Date(now));
  const out = { job: 'park', date, parkDay: false, markers: [], stale: [], notified: [], skipped: [] };
  const { results: profiles } = await env.DB.prepare('SELECT id, name, kind FROM profiles').all();
  const kindOf = Object.fromEntries(profiles.map(p => [p.id, p.kind])), nameOf = Object.fromEntries(profiles.map(p => [p.id, p.name]));
  const rows = await liveItems(env, { appId: 'dollywood-live', scope: 'family', profile: null, prefix: 'loc:' });
  const markers = rows.map(r => { const id = r.key.slice(4); const t = Number.isFinite(+r.value.t) && +r.value.t > 0 ? Math.min(+r.value.t, now) : r.updated_at; return { id, kind: kindOf[id], name: nameOf[id] || r.value.name || id, age: now - t }; })
    .filter(m => m.kind);
  out.markers = markers.map(m => ({ id: m.id, kind: m.kind, ageMin: Math.round(m.age / 60000) }));
  out.parkDay = markers.some(m => m.age < PARK_DAY_MS);
  if (!out.parkDay) return out;
  const adultFresh = markers.some(m => m.kind === 'adult' && m.age <= STALE_MS);
  const stale = markers.filter(m => m.kind === 'kid' && m.age > STALE_MS && m.age < PARK_DAY_MS);
  out.stale = stale.map(m => ({ id: m.id, ageMin: Math.round(m.age / 60000) }));
  if (!adultFresh || !stale.length) return out;
  const min = m => Math.round(m.age / 60000);
  const body = stale.length === 1
    ? `${stale[0].name}'s spot has not updated for ${min(stale[0])} min.`
    : stale.map(m => `${m.name}'s spot`).join(' and ') + ` have not updated (${stale.map(m => min(m) + ' min').join(', ')}).`;
  for (const pid of await adultIds(env)) {
    await notify(env, out, pid, 'park', { title: 'Dollywood park map', body, url: '#dollywood-live', tag: 'park' }, { ttl: 1800, urgency: 'high' }, now);
  }
  return out;
}

export const JOBS = { morning: morningJob, evening: eveningJob, behind: behindJob, prayer: prayerJob, park: parkJob };

/**
 * Called by the cron trigger. Runs whatever matches the New York hour: 8 -> morning, 20 -> evening (+ behind on Sundays);
 * prayer and park ride along on both runs. `force` runs one named job regardless of the clock and returns its result
 * alone (POST /api/admin/cron/run); a scheduled run returns { nyHour, ran: [results] }.
 */
export async function runCron(env, now = Date.now(), force = null) {
  const { hour, weekday } = nyParts(new Date(now));
  if (force) {
    if (!JOBS[force]) return { job: null, error: 'bad_job' };
    return JOBS[force](env, now);
  }
  const names = hour === 8 ? ['morning'] : hour === 20 ? ['evening', ...(weekday === 'Sun' ? ['behind'] : [])] : [];
  if (!names.length) return { job: null, skipped: true, nyHour: hour };
  names.push('prayer', 'park');
  const ran = [];
  for (const n of names) {
    try { ran.push(await JOBS[n](env, now)); } catch (e) { ran.push({ job: n, error: String(e && e.message || e) }); }
  }
  return { nyHour: hour, weekday, ran };
}
