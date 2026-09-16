// Scheduled reminders + push delivery.
//   morning (8:00 New York): leftovers that hit "use it up" within two days -> every adult who opted in
//   evening (8:00 pm New York): F260 reading not checked today -> that profile
// Cron triggers are UTC, so wrangler.toml fires at both possible UTC hours and runCron checks the local hour.
import { sendPush } from './push.js';
import { liveItems, getOne } from './data.js';

const NY = 'America/New_York';
export function nyParts(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: NY, year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hour12: false }).formatToParts(d);
  const g = t => (p.find(x => x.type === t) || {}).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: +g('hour') % 24 };
}
const ageDays = (dateLogged, today) => Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(dateLogged + 'T00:00:00Z')) / 86400000);

export const vapidFrom = env => (env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY
  ? { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:hub@example.com' } : null);

/** Per-profile toggles, stored by the Me tab as app_data(person, hub, push_prefs). Everything defaults to on. */
export async function prefsFor(env, profileId) {
  const row = await getOne(env, { appId: 'hub', scope: 'person', profile: { id: profileId }, key: 'push_prefs' });
  return { leftovers: true, f260: true, ...(row && row.value ? row.value : {}) };
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

export async function morningJob(env, now = Date.now()) {
  const { date } = nyParts(new Date(now));
  const items = (await liveItems(env, { appId: 'leftovers', scope: 'family', profile: null, prefix: 'item:' })).map(r => r.value)
    .map(i => ({ ...i, days: ageDays(i.dateLogged, date) })).filter(i => i.days >= 5).sort((a, b) => b.days - a.days);
  const out = { job: 'morning', date, due: items.map(i => `${i.name} (${i.days}d)`), notified: [] };
  if (!items.length) return out;
  const body = items.length === 1
    ? `${items[0].name} is ${items[0].days} days old — use it up.`
    : `${items.length} to use up: ` + items.slice(0, 4).map(i => `${i.name} (${i.days}d)`).join(', ') + (items.length > 4 ? '…' : '');
  const { results: adults } = await env.DB.prepare("SELECT id FROM profiles WHERE kind = 'adult'").all();
  for (const p of adults) {
    if (!(await prefsFor(env, p.id)).leftovers) continue;
    if (await alreadySentToday(env, p.id, 'leftovers', now)) continue;
    const r = await pushTo(env, p.id, 'leftovers', { title: 'Larder Ledger', body, url: '#leftovers', tag: 'leftovers' }, { ttl: 6 * 3600 });
    if (r.sent) out.notified.push({ profile: p.id, ...r });
  }
  return out;
}

export async function eveningJob(env, now = Date.now()) {
  const { date } = nyParts(new Date(now));
  const out = { job: 'evening', date, checked: [], notified: [] };
  const { results } = await env.DB.prepare("SELECT profile_id, key, value FROM app_data WHERE app_id = 'f260' AND scope = 'person' AND key IN ('f260.log', 'f260.summary') AND value IS NOT NULL").all();
  const byProfile = {};
  for (const r of results) { (byProfile[r.profile_id] ||= {})[r.key] = JSON.parse(r.value); }
  for (const [pid, d] of Object.entries(byProfile)) {
    const log = d['f260.log'] || {}, sum = d['f260.summary'] || null;
    const readToday = !!log[date];
    out.checked.push({ profile: pid, readToday });
    if (readToday || (sum && sum.finished)) continue;
    if (!(await prefsFor(env, pid)).f260) continue;
    if (await alreadySentToday(env, pid, 'f260', now)) continue;
    const next = sum && sum.next ? `${sum.next.ref} is next (week ${sum.next.week}, day ${sum.next.day}).` : 'Your next reading is waiting.';
    const r = await pushTo(env, pid, 'f260', { title: 'F260', body: `No reading checked off today yet. ${next}`, url: '#f260', tag: 'f260' }, { ttl: 3 * 3600 });
    if (r.sent) out.notified.push({ profile: pid, ...r });
  }
  return out;
}

/** Called by the cron trigger. Runs whichever job matches the New York hour (8 -> morning, 20 -> evening). */
export async function runCron(env, now = Date.now(), force = null) {
  const { hour } = nyParts(new Date(now));
  const job = force || (hour === 8 ? 'morning' : hour === 20 ? 'evening' : null);
  if (job === 'morning') return morningJob(env, now);
  if (job === 'evening') return eveningJob(env, now);
  return { job: null, skipped: true, nyHour: hour };
}
