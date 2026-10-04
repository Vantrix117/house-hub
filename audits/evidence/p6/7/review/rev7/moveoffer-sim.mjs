// reviewer-7: the exact moveOffer() arithmetic from apps/kidverse.html:600-614, with hub.today/addDays as hub.js defines them (NY date)
const NYF = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const today = t => NYF.format(new Date(t));
const addDays = (d, n) => new Date(Date.UTC(...d.split('-').map((x, i) => i === 1 ? +x - 1 : +x)) + n * 86400000).toISOString().slice(0, 10);
const utcOf = day => { const [y, m, d] = String(day).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const MOVE_HOUR = 17, MOVE_MIN_AGE = 5 * 86400000;
const nyHour = t => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date(t)));
const nyInstant = (day, hour) => { const [y, m, d] = day.split('-').map(Number); for (const off of [4, 5]) { const t = Date.UTC(y, m - 1, d, hour + off); if (today(t) === day && nyHour(t) === hour) return t; } return Date.UTC(y, m - 1, d, hour + 5); };
function offered(at, nowMs) {
  if (!(at > 0) || nowMs - at <= MOVE_MIN_AGE) return false;
  const atDay = today(at), sunday = addDays(atDay, 6 - ((utcOf(atDay).getUTCDay() + 6) % 7));
  let from = nyInstant(sunday, MOVE_HOUR); if (at >= from) from = nyInstant(addDays(sunday, 7), MOVE_HOUR);
  return nowMs >= from;
}
const ny = (day, h, m = 0) => nyInstant(day, h) + m * 60000;
const fmt = t => new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
// set on Sunday 2026-10-04 at 4:00 pm NY; check every hour of the following week: when does the offer first appear?
for (const [label, at] of [['Sun 4:00 pm', ny('2026-10-04', 16)], ['Sat 10:00 am', ny('2026-10-03', 10)], ['Thu 12:00 pm', ny('2026-10-01', 12)], ['Mon 9:00 am', ny('2026-09-28', 9)], ['Sun 6:00 pm', ny('2026-10-04', 18)]]) {
  let first = null; for (let t = at; t < at + 14 * 86400000; t += 60000 * 15) if (offered(at, t)) { first = t; break; }
  console.log(`week set ${label} (${fmt(at)}) -> offer first shows ${fmt(first)}`);
}
