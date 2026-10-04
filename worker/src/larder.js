// The Larder's freshness rule, the Worker's copy (batch 8, P3-LEFTOVERS-02, GAP-LEFTOVERS-1). The Worker cannot import
// apps/hub.js, so this is the same rule written once more: apps/hub.js `hub.larder.fresh` is the one the Larder, Home's
// fridge card and the Apps badge use, and audits/tools/phase6/8/larder-a-8.mjs runs both over one table and asserts they
// agree. Change one, change the other.
//   Without a use-by: 0-3 days old is fresh, 4-6 days "eat soon", 7 or more "use it up"; a date that is not a real day
//   is "check the date" (use it up). With a use-by (item.useBy, YYYY-MM-DD): "use it up" from the use-by day, "eat soon"
//   in the two days before it, fresh before that. A "some left" item (portion: 'some') is judged like any other.

const OLD_DAYS = 7, SOON_DAYS = 4, SOON_BEFORE = 2;

export const isDay = v => { const d = String(v || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false; const x = new Date(d + 'T12:00:00Z'); return !isNaN(x) && x.toISOString().slice(0, 10) === d; };
const dayNum = d => Date.parse(d + 'T00:00:00Z') / 86400000;
const daysBetween = (a, b) => Math.round(dayNum(b) - dayNum(a));
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/** { level: 'fresh' | 'soon' | 'old', days, daysLeft, useBy, label, age, when, short, score } — hub.larder.fresh's twin. */
export function fresh(item, today) {
  const it = item || {};
  const days = isDay(it.dateLogged) ? Math.max(0, daysBetween(it.dateLogged, today)) : Infinity;
  const useBy = isDay(it.useBy) ? String(it.useBy) : null;
  const daysLeft = useBy ? daysBetween(today, useBy) : null;
  const level = useBy ? (daysLeft <= 0 ? 'old' : daysLeft <= SOON_BEFORE ? 'soon' : 'fresh')
    : (days === Infinity || days >= OLD_DAYS ? 'old' : days >= SOON_DAYS ? 'soon' : 'fresh');
  const label = !useBy && days === Infinity ? 'Check date' : level === 'old' ? 'Use it up' : level === 'soon' ? 'Eat soon' : 'Fresh';
  const age = days === Infinity ? 'date unknown' : days === 0 ? 'today' : plural(days, 'day');
  const when = useBy ? (daysLeft < 0 ? plural(-daysLeft, 'day') + ' past use-by' : daysLeft === 0 ? 'use by today' : daysLeft === 1 ? 'use by tomorrow' : 'use by in ' + daysLeft + ' days')
    : days === Infinity ? 'check the date' : age;
  const short = useBy ? (daysLeft === 0 ? 'today' : daysLeft < 0 ? -daysLeft + 'd over' : daysLeft + 'd left') : days === Infinity ? 'date?' : days + 'd';
  const score = useBy ? OLD_DAYS - daysLeft : days;
  return { level, days, daysLeft, useBy, label, age, when, short, score };
}

/** What needs eating, most urgent first: { due: [{ it, f }], old, soon } — hub.larder.due's twin. */
export function due(items, today) {
  const all = (items || []).filter(Boolean).map(it => ({ it, f: fresh(it, today) })).filter(x => x.f.level !== 'fresh');
  all.sort((a, b) => (b.f.score === a.f.score ? 0 : b.f.score > a.f.score ? 1 : -1));
  return { due: all, old: all.filter(x => x.f.level === 'old'), soon: all.filter(x => x.f.level === 'soon') };
}

/** The 8 am push's body: "Use it up: chili (8 days) · Eat soon: soup (4 days)". Up to MAX names, then "+N more"; null when nothing needs eating. */
export const PUSH_MAX = 4;
export function pushBody(items, today) {
  const { due: list } = due(items, today);
  if (!list.length) return null;
  const shown = list.slice(0, PUSH_MAX), more = list.length - shown.length;
  const part = (level, word) => {
    const rows = shown.filter(x => x.f.level === level);
    return rows.length ? word + ': ' + rows.map(x => `${x.it.name} (${x.f.when})`).join(', ') : '';
  };
  return [part('old', 'Use it up'), part('soon', 'Eat soon')].filter(Boolean).join(' · ') + (more ? ` · +${more} more` : '');
}
