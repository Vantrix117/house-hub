// reviewer-7 round 2: moveOfferFrom() exactly as apps/kidverse.html:612-616 now has it, swept over 2 years in 7-minute steps (both DST changes)
const NYF = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const today = t => NYF.format(new Date(t));
const addDays = (d, n) => new Date(Date.UTC(...d.split('-').map((x, i) => i === 1 ? +x - 1 : +x)) + n * 86400000).toISOString().slice(0, 10);
const utcOf = day => { const [y, m, d] = String(day).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const MOVE_HOUR = 17, MOVE_MIN_AGE = 5 * 86400000;
const nyHour = t => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date(t)));
const nyMin = t => new Date(t).getUTCMinutes();
const nyDow = t => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date(t));
const nyInstant = (day, hour) => { const [y, m, d] = day.split('-').map(Number); for (const off of [4, 5]) { const t = Date.UTC(y, m - 1, d, hour + off); if (today(t) === day && nyHour(t) === hour) return t; } return Date.UTC(y, m - 1, d, hour + 5); };
function moveOfferFrom(at) { const edge = at + MOVE_MIN_AGE, d0 = today(edge); const sunday = addDays(d0, 6 - ((utcOf(d0).getUTCDay() + 6) % 7)); let from = nyInstant(sunday, MOVE_HOUR); if (from <= edge) from = nyInstant(addDays(sunday, 7), MOVE_HOUR); return from; }
let n = 0, bad = [], maxGap = 0, minGap = Infinity;
for (let at = Date.parse('2026-01-01T00:00:00Z'); at < Date.parse('2028-01-01T00:00:00Z'); at += 7 * 60000 + 13) {
  const f = moveOfferFrom(at); n++;
  const gap = (f - at) / 86400000; maxGap = Math.max(maxGap, gap); minGap = Math.min(minGap, gap);
  if (nyDow(f) !== 'Sun' || nyHour(f) !== 17 || nyMin(f) !== 0 || f - at <= MOVE_MIN_AGE || f - at > MOVE_MIN_AGE + 7 * 86400000 + 3600000) { if (bad.length < 5) bad.push(new Date(at).toISOString() + ' -> ' + new Date(f).toISOString()); }
}
console.log({ instants: n, bad: bad.length, sample: bad, minDays: minGap.toFixed(3), maxDays: maxGap.toFixed(3) });
