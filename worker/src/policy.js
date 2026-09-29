// Who may read and write which rows. The data API, chat and the activity feed all ask here, so a limit the UI shows
// is also a limit a crafted request meets (P2-PROF-05, P2-SEC-02, P2-CHAT-02, P3-DOLLYWOOD-LIVE-02, UX-KIDVERSE-3, KITCHEN-1).
//
// Kinds: a household adult (kind 'adult', not a guest) may write anything but another person's own rows; a guest is an
// adult who uses the apps but not the household's controls; a kid writes only the rows the kid screens write; the TV
// (kiosk) writes nothing (auth.js requireWriter); the kitchen writes the family apps and its own Timer and Tally rows.
import registry from '../../apps.json' with { type: 'json' };
import { HttpError } from './auth.js';
import { getOne, putOne } from './data.js';
import { nyParts } from './reminders.js';

export const APPS = registry.apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
const byId = new Map(APPS.map(a => [a.id, a]));

// The kitchen device's apps (KITCHEN-1): the family ones, plus Timer and Tally, whose rows are person scope today.
export const KITCHEN_APPS = ['leftovers', 'prayer', 'timer', 'tally'];
const KITCHEN_FAMILY_WRITES = ['leftovers', 'prayer', 'reminders'];
const KITCHEN_PERSON_WRITES = ['timer', 'tally'];

export const isGuest = p => !!(p && p.is_guest);
export const isHouseholdAdult = p => !!(p && p.kind === 'adult' && !p.is_guest);
/** A member of the household a write may credit: a household adult or a kid (never a guest, the TV or the kitchen). */
export const isHouseholdMember = p => !!(p && !p.is_guest && (p.kind === 'adult' || p.kind === 'kid'));

/** Everyone, loaded once per request. */
export function householdLoader(env) {
  let cache = null;
  return () => (cache ||= env.DB.prepare('SELECT id, name, kind, is_guest, expires_at, emoji, color FROM profiles').all().then(r => r.results));
}

/**
 * Can this profile open the app? Mirrors index.html visibleApps: an app without visibleTo is everyone's; a guest sees
 * what any household adult sees; the kitchen sees its four apps; the TV opens none (it only reads family rows).
 * Ids that are not apps.json entries (the shell's 'hub', 'reminders') are open to everyone.
 */
export function canOpen(profile, appId, people) {
  if (!profile) return false;
  if (profile.kind === 'kiosk') return false;
  if (profile.kind === 'kitchen') return KITCHEN_APPS.includes(appId) || !byId.has(appId);
  const a = byId.get(appId);
  if (!a || !a.visibleTo) return true;
  if (a.visibleTo.includes(profile.id)) return true;
  if (isGuest(profile)) return people.some(q => isHouseholdAdult(q) && a.visibleTo.includes(q.id));
  return false;
}

/** The apps a profile can open, for chat (P2-CHAT-06: never the list the request carries). */
export async function appsFor(profile, loadPeople) {
  const people = await loadPeople();
  return APPS.filter(a => canOpen(profile, a.id, people));
}

/**
 * Reads. Person scope is always the caller's own rows (data.js owner()), so it stays open: the shell reads its own
 * f260 / prayer / timer rows for every profile. Family rows of an app the caller cannot open are refused.
 */
export async function checkRead(profile, { appId, scope }, loadPeople) {
  if (appId === 'chatundo') throw new HttpError(403, 'app_hidden', 'This profile cannot open that app.');   // chat's Undo records (batch 0i)
  if (scope !== 'family' || !profile) return;
  if (profile.kind === 'kiosk' || profile.kind === 'kitchen') return;   // the shared screens read every family board
  if (!canOpen(profile, appId, await loadPeople())) throw new HttpError(403, 'app_hidden', 'This profile cannot open that app.');
}

// ── writes ──────────────────────────────────────────────────────────────────────────────────────────────────
const empty = v => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && v && !Object.keys(v).length);
const same = (a, b) => (empty(a) && empty(b)) || JSON.stringify(a) === JSON.stringify(b);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const names = v => (Array.isArray(v) ? v.map(String) : []);
const DAY_MS = 86400000;

/** Entries (profile ids; names from an older app) added to (or taken from) a prayer row's prayedBy, compared with what is stored. */
function prayedByDiff(next, cur) {
  const a = obj(next && next.prayedBy) || {}, b = obj(cur && cur.prayedBy) || {};
  const added = new Set(), removed = new Set();
  for (const d of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const na = new Set(names(a[d])), nb = new Set(names(b[d]));
    for (const n of na) if (!nb.has(n)) added.add(n);
    for (const n of nb) if (!na.has(n)) removed.add(n);
  }
  return { added: [...added], removed: [...removed] };
}

/** The household's yesterday, today and tomorrow (New York): the only days a kid's tick may touch. */
const houseDays = (now = Date.now()) => new Set([nyParts(new Date(now - DAY_MS)).date, nyParts(new Date(now)).date, nyParts(new Date(now + DAY_MS)).date]);

/**
 * Who prayed a family request, merged (batch 0g). prayedBy[date] lists profile ids; an older app wrote display names.
 * A writer changes only their own entry: their id, and their name while no one else the house knows (a guest included)
 * has that name, so a guest called "Kiara" can never tick, or untick, for Kiara. Everyone else's entries stay as the
 * house has them, so an older copy of the row on one device can never undo someone else's tick. An entry is added on the
 * household's yesterday / today / tomorrow (a device clock a little off). It is taken away only today, and only when the
 * write says so (`unprayed` = today, which the Prayer app sends with an untick): a copy of the row from before the tick
 * (the same person's other device, not yet pulled) lacks the entry too, and must not take it away. `unprayed` is never
 * stored. The kitchen (a shared device) may also add household members; it never takes anyone's tick away.
 */
function ownEntries(profile, people) {
  const nm = String(profile.name || '').trim();
  const nameMine = !!nm && !people.some(q => q && q.id !== profile.id && String(q.name || '').trim() === nm);
  return { id: profile.id, nm: nameMine ? nm : null };
}
function mergePrayedBy(profile, value, cur, people, unprayed) {
  const pb = obj(cur && cur.prayedBy) ? JSON.parse(JSON.stringify(cur.prayedBy)) : {};
  const mine = obj(value && value.prayedBy) || {};
  const { id, nm } = ownEntries(profile, people);
  const days = houseDays(), today = nyParts(new Date()).date;
  const household = profile.kind === 'kitchen' ? new Set(people.filter(isHouseholdMember).flatMap(q => [q.id, q.name])) : null;
  const untick = unprayed === today;
  for (const d of days) {
    const set = new Set(names(pb[d])), v = names(mine[d]);
    if (v.includes(id) || (nm && v.includes(nm))) { set.add(id); if (nm) set.delete(nm); }
    else if (d === today && untick) { set.delete(id); if (nm) set.delete(nm); }
    if (household) for (const x of v) if (household.has(x)) set.add(x);
    if (set.size) pb[d] = [...set]; else delete pb[d];
  }
  return pb;
}
/** lastPrayedAt of a merged family row: the latest day anyone prayed it (or the row's own earlier date). */
function lastPrayed(pb, ...others) {
  const today = nyParts(new Date()).date, tomorrow = [...houseDays()].sort().pop();
  const days = Object.keys(pb).filter(d => names(pb[d]).length && d <= tomorrow);
  for (const o of others) if (typeof o === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o) && o < today) days.push(o);
  return days.sort().pop() || null;
}
/**
 * A kid's tick on the family list is merged, never taken whole: the stored row, with only the kid's own entry changed
 * (mergePrayedBy) and lastPrayedAt / updatedAt from the tick. Every other field stays as the house has it, so a kid's
 * older copy of the row can neither undo someone else's tick nor change the request, and a tick cannot be backdated to
 * mint Kid Verse stars.
 */
function kidPrayerMerge(profile, value, cur, people, unprayed) {
  const out = JSON.parse(JSON.stringify(cur));
  out.prayedBy = mergePrayedBy(profile, value, cur, people, unprayed);
  out.lastPrayedAt = lastPrayed(out.prayedBy, cur.lastPrayedAt);
  if (typeof value.updatedAt === 'string' && value.updatedAt.length <= 40) out.updatedAt = value.updatedAt;
  delete out.unprayed;                                                  // an older row may still hold one
  return out;
}
/** A kid's prayerDays: the house's days plus the kid's own among yesterday / today / tomorrow; nothing is ever dropped. */
function kidPrayerDays(value, cur) {
  const had = Array.isArray(cur) ? cur : [], days = houseDays();
  const add = (Array.isArray(value) ? value : []).map(String).filter(d => days.has(d) && !had.includes(d));
  return [...new Set([...had, ...add])].sort();
}

/**
 * Checks one write. Returns null when it may go ahead, or an error code. `cur` is the stored value (undefined when the
 * row does not exist, null for a tombstone). `value` null = a delete.
 */
export async function writeError(profile, { appId, scope, key, value }, cur, loadPeople) {
  if (!profile) return 'profile_required';
  if (profile.kind === 'kiosk') return 'read_only';
  if (appId === 'chatundo') return 'not_allowed';                       // chat's Undo records are the Worker's own (batch 0i)
  const people = await loadPeople();
  const self = profile.id;

  // Visibility (P2-SEC-02). Person rows of a hidden app are refused too, with one cross-app row: Verses keeps its
  // recall rows in the person's F260 scope (apps/verses.html), and kids use Verses though F260 is hidden from them.
  if (!canOpen(profile, appId, people)) {
    const versesRecall = scope === 'person' && appId === 'f260' && (key === 'f260.recall' || /^recall:/.test(key)) && canOpen(profile, 'verses', people);   // recall:<id> rows since batch 0e
    if (!versesRecall) return 'app_hidden';
  }

  // The F260 journal vault (batch 0e, P3-F260-13): a device still holding the key of a journal that was erased, re-created
  // or restored elsewhere must not write over the new one, even from a queue it sends much later. A vault's version is its
  // vid (or, for one written before versions, its passcode wrap's salt); a different version is refused unless the write
  // names the stored one as the vault it replaces (prev). Erasing (null) is always allowed.
  if (appId === 'f260' && scope === 'person' && key === 'f260.journal.vault' && obj(value) && obj(cur)) {
    const vidOf = b => b.vid || (obj(b.pass) && b.pass.salt ? 'p:' + b.pass.salt : null);
    const was = vidOf(cur);
    if (was && vidOf(value) !== was && value.prev !== was) return 'vault_changed';
  }

  // A Larder item's date (batch 0i, P3-LEFTOVERS-04, -09): a real YYYY-MM-DD, never after the household's today. A row
  // with "yesterday" or a future day would read NaN or "-3d ago", sit under Fresh and never be warned about.
  if (appId === 'leftovers' && scope === 'family' && /^item:/i.test(key) && obj(value)) {
    const d = String(value.dateLogged || ''), x = new Date(d + 'T12:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(x) || x.toISOString().slice(0, 10) !== d || d > [...houseDays()].sort().pop()) return 'bad_date';   // up to the house's tomorrow: a device clock a little fast just before midnight
  }

  // Rows that belong to one person, whoever writes them.
  // Prefixes are matched in any letter case, so "LOC:ezra" is Ezra's dot here too (belt and braces: listData's prefix
  // reads are exact since batch 0d, but a key's case must never be a way round a rule).
  const lk = key.toLowerCase();
  if (appId === 'kidverse' && scope === 'family') {
    const m = /^(stars|story):(.+)$/i.exec(key);
    if (m && m[2] !== self) return 'not_yours';                         // Kid Verse, signed in as that kid, is the only writer
    if ((lk === 'week' || lk.startsWith('ledger:')) && !isHouseholdAdult(profile)) return 'household_only';
  }
  if (appId === 'dollywood-live' && scope === 'family') {
    if ((lk.startsWith('kidshare:') || lk.startsWith('kid:') || lk === 'meet') && !(isHouseholdAdult(profile) || (lk === 'meet' && profile.kind === 'adult'))) return 'household_only';
    const m = /^loc:(.+)$/i.exec(key);
    if (m && m[1] !== self) {
      if (value != null) return 'not_yours';                            // only the person's own device places their dot
      // A household adult clears anyone's (switching a kid's beacon off). Others clear only a dot a day old.
      const stale = !obj(cur) || !(+cur.t > Date.now() - DAY_MS);
      if (!isHouseholdAdult(profile) && !stale) return 'not_yours';
    }
  }

  if (profile.kind === 'kid') return kidWrite(profile, { appId, scope, key, value }, cur);
  if (profile.kind === 'kitchen') return kitchenWrite(profile, { appId, scope, key, value }, cur, people);
  if (profile.kind !== 'adult') return 'read_only';
  return null;
}

// A kid writes only what the kid screens write (P2-PROF-05): their own person rows; on the family prayer list a tick
// under their own id and the day it adds to prayerDays; their Kid Verse mirror and story rows (checked above); their
// own park-map dot while an adult has their beacon on.
function kidWrite(profile, { appId, scope, key, value }, cur) {
  if (scope === 'person') return null;
  if (appId === 'prayer') {
    if (/^prayer:/.test(key)) return obj(value) && obj(cur) ? null : 'kid_readonly';   // merged in guardedPut (kidPrayerMerge: only the kid's own tick)
    if (key === 'prayerDays') return Array.isArray(value) ? null : 'kid_readonly';     // merged in guardedPut (kidPrayerDays)
    return 'kid_readonly';
  }
  if (appId === 'kidverse' && /^(stars|story):/.test(key)) return null;   // own rows only (checked in writeError)
  if (appId === 'dollywood-live' && key === 'loc:' + profile.id) return null;   // the beacon gate is kidLocAllowed()
  if (appId === 'dollywood-live' && /^loc:/i.test(key) && value == null) return null;   // a day-old dot (checked in writeError)
  return 'kid_readonly';
}

// The kitchen (KITCHEN-1): family rows of the family apps; person rows only its own Timer and Tally; anyone it credits
// must be a household member (a kid never on the Larder, P5-D2).
function kitchenWrite(profile, { appId, scope, key, value }, cur, people) {
  if (scope === 'person') return KITCHEN_PERSON_WRITES.includes(appId) || (appId === 'hub' && key === 'theme') ? null : 'kitchen_person';   // its own look too
  if (!KITCHEN_FAMILY_WRITES.includes(appId)) return 'kitchen_family';
  const v = obj(value);
  if (!v) return null;
  const c = obj(cur) || {};
  const member = id => people.find(q => q.id === id);
  const creditOk = id => {
    if (id === undefined || id === null || id === profile.id) return true;
    const q = member(String(id));
    if (!isHouseholdMember(q)) return false;
    return !(appId === 'leftovers' && q.kind === 'kid');
  };
  // only the credit this write gives: a row someone else wrote keeps its author (a guest's request, an older Larder row)
  const creditChanged = v.by !== c.by || v.byName !== c.byName;
  if (creditChanged && 'by' in v && !creditOk(v.by)) return 'bad_credit';
  if (creditChanged && 'by' in v && 'byName' in v && v.by !== profile.id && v.by != null) {
    const q = member(String(v.by)); if (!q || q.name !== v.byName) return 'bad_credit';
  }
  if (appId === 'prayer' && /^prayer:/i.test(key)) {
    const household = new Set(people.filter(isHouseholdMember).flatMap(q => [q.id, q.name]));   // ids; names from an older app
    if (prayedByDiff(v, obj(cur)).added.some(n => !household.has(n))) return 'bad_credit';
  }
  return null;
}

/** The kid beacon gate: a kid's own dot only while an adult has switched their beacon on (kidshare:<id> === true). */
async function kidLocAllowed(env, profile, { appId, scope, key, value }) {
  if (!(profile && profile.kind === 'kid' && appId === 'dollywood-live' && scope === 'family' && key === 'loc:' + profile.id && value != null)) return true;
  const share = await getOne(env, { appId, scope: 'family', profile, key: 'kidshare:' + profile.id });
  return !!(share && share.value === true);
}

/**
 * One checked write: the policy above, then last-write-wins (data.js putOne). A refused row comes back as
 * { key, rejected: <code>, value, updated_at } with what the house holds, so the device can put it back; nothing is stored.
 */
export async function guardedPut(env, profile, args, loadPeople) {
  const cur = await getOne(env, args);
  const r = await guardedPutAt(env, profile, args, loadPeople, cur);
  // chat asks for the row as it was before this write, read in the same step (its Undo record, batch 0i)
  return args.wantBefore ? { ...r, before: cur ? { value: cur.value, updated_at: cur.updated_at } : null } : r;
}
async function guardedPutAt(env, profile, args, loadPeople, cur) {
  const why = (await writeError(profile, args, cur ? cur.value : undefined, loadPeople))
    || (!(await kidLocAllowed(env, profile, args)) ? 'beacon_off' : null);
  if (why) return { key: args.key, rejected: why, value: cur ? cur.value : null, updated_at: cur ? cur.updated_at : 0, applied: false };
  // `unprayed` (an untick, batch 0g) is an instruction for the merge below, never stored, whichever way the row is written
  let unprayed = null;
  if (args.appId === 'prayer' && obj(args.value) && 'unprayed' in args.value) {
    unprayed = args.value.unprayed; const v = { ...args.value }; delete v.unprayed; args = { ...args, value: v };
  }
  if (profile.kind === 'kid' && args.appId === 'prayer' && args.scope === 'family') {
    // the merge is built on the row as stored now, so it may beat it: a kid's tick made offline is not lost to a later
    // write by someone else, and the kid's next pull brings the merged row back to their device
    const updated_at = Math.max((+args.updated_at || Date.now()) + 1, cur ? +cur.updated_at + 1 : 0);   // +1: newer than the copy on the kid's device, so its next pull shows the merged row
    if (/^prayer:/.test(args.key)) return putOne(env, { ...args, updated_at, value: kidPrayerMerge(profile, args.value, cur.value, await loadPeople(), unprayed) });
    if (args.key === 'prayerDays') return putOne(env, { ...args, updated_at, value: kidPrayerDays(args.value, cur ? cur.value : null) });
  }
  // Everyone else's family prayer rows (batch 0g, P3-PRAYER-05): the request itself is last-write-wins as before, but who
  // prayed it is merged, so a tap sent from an older copy of the row (a device that had not pulled, or was offline) never
  // takes away someone else's tick, and a tap that loses to a newer edit still counts.
  if (args.appId === 'prayer' && args.scope === 'family' && /^prayer:/.test(args.key) && obj(args.value) && cur && obj(cur.value)) {
    const people = await loadPeople(), pb = mergePrayedBy(profile, args.value, cur.value, people, unprayed);
    const wins = (+args.updated_at || 0) > +cur.updated_at;
    const base = wins ? args.value : cur.value;
    const value = { ...base, prayedBy: pb, lastPrayedAt: lastPrayed(pb, cur.value.lastPrayedAt, args.value.lastPrayedAt) };
    delete value.unprayed;                                                // an older row may still hold one
    if (JSON.stringify(value) === JSON.stringify(wins ? args.value : cur.value)) return putOne(env, args);   // nothing merged: the plain write
    // +1: newer than both copies, so the writer's next pull brings the merged row back to their device
    return putOne(env, { ...args, value, updated_at: Math.max((+args.updated_at || 0) + 1, +cur.updated_at + 1) });
  }
  return putOne(env, args);
}

/**
 * Who a kitchen write credits: a feed line or an album photo sent with `as`. Returns the household profile, or throws.
 * Anyone else's `as` is ignored: a personal session is always filed under itself.
 */
export async function creditFor(profile, as, appId, loadPeople) {
  if (!profile || profile.kind !== 'kitchen' || as === undefined || as === null || as === '' || as === profile.id) return profile;
  const q = (await loadPeople()).find(x => x.id === String(as));
  if (!isHouseholdMember(q)) throw new HttpError(403, 'bad_credit', 'Only someone in the household can be credited.');
  if ((appId === 'leftovers' || appId === 'album') && q.kind === 'kid') throw new HttpError(403, 'bad_credit', 'Kids only look at the Larder and the album.');
  return q;
}
