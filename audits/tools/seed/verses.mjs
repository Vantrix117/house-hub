// Verses seed (apps/verses.html). Owns only the app 'verses' person rows:
//   log      { 'YYYY-MM-DD': n }   ratings per day — the trainer's day streak (apps/verses.html:216, 235, 297)
//   summary  { due, streak, boxes, total, reviewedToday, week, at }   (apps/verses.html:239-245)
// The verses themselves are F260's: f260.mem / f260.recall / f260.verses in each person's f260 scope, written by the F260
// seed, which seed.mjs runs first. This module reads them back (h.get) so the log agrees with the recall rows (every
// `last` review day has at least that many ratings) and the summary is exactly what the app would compute on open
// (so opening the trainer writes nothing). Kids train the family week's two verses (kidverse family 'week', seeded earlier).
// Variants: empty writes nothing; typical gives each adult with memorised verses a day streak ending yesterday (nothing
// rated yet today, so Eli's due verses are still to do); overflow gives long streaks and big daily counts.
export default function verses(h) {
  if (h.empty) return;
  const today = h.day(0);
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const parseId = id => { const m = /^(\d{1,2})-([01])$/.exec(String(id)); if (!m) return null; const w = +m[1]; return w >= 1 && w <= 52 ? { w, i: +m[2] } : null; };
  const clampBox = b => Math.min(5, Math.max(1, Math.floor(Number(b) || 1)));
  const norm = r => { r = obj(r); return { box: clampBox(r.box), due: isDay(r.due) ? r.due : null, last: isDay(r.last) ? r.last : null }; };   // apps/verses.html:219
  const fw = h.get('family', null, 'kidverse', 'week');
  const familyWeek = Math.min(52, Math.max(1, Math.floor(Number(fw && typeof fw === 'object' ? fw.week : fw) || 1)));   // apps/verses.html:217

  // the least number of days in a row each person has practised, ending yesterday (typical / overflow). The streak the app
  // shows can be longer: F260's recall rows already put ratings on their `last` days, e.g. typical Eli 13, Mae 13, David 4.
  const STREAK = h.overflow
    ? { eli: 184, christian: 61, mom: 365, dad: 12, niece: 3 }
    : { eli: 9, christian: 3, mom: 21, dad: 0, niece: 0 };

  for (const p of h.profiles()) {
    if (p.kind === 'kiosk' || p.is_guest) continue;
    const kid = p.kind === 'kid';
    const mem = obj(h.get('person', p.id, 'f260', 'f260.mem'));
    const rc = obj(h.get('person', p.id, 'f260', 'f260.recall'));
    // trained ids (apps/verses.html:221-224): adults every memorised verse; kids the family week's pair + anything rated before
    const trained = kid ? [...new Set([familyWeek + '-0', familyWeek + '-1', ...Object.keys(rc).filter(parseId)])]
      : Object.keys(mem).filter(id => mem[id] && parseId(id));
    if (!kid && !trained.length) continue;                               // nothing memorised: the empty state stays true

    // log: every recall row's last review day counts, then a run of practice days up to yesterday
    const log = {};
    for (const id of trained) { const r = rc[id] && norm(rc[id]); if (r && r.last && r.last <= today) log[r.last] = (log[r.last] || 0) + 1; }
    const run = kid ? 0 : (STREAK[p.id] || 0);
    for (let i = 1; i <= run; i++) { const d = h.day(-i); if (!log[d]) log[d] = h.overflow ? 3 + (i * 7) % 9 : 1 + (i * 5) % 3; }
    if (h.overflow && p.id === 'eli') log[h.day(-1)] = Math.max(log[h.day(-1)] || 0, 128);   // Eli had one marathon evening: a big number
    if (Object.keys(log).length) h.person(p.id, 'verses', 'log', log, log[today] ? h.ago(20) : h.time(-1, '21:10'));

    // summary exactly as writeSummary computes it (apps/verses.html:239-245), with its key order (the app compares JSON)
    const due = kid
      ? [familyWeek + '-0', familyWeek + '-1'].filter(id => { const r = rc[id] && norm(rc[id]); return !(r && r.last === today); }).length
      : trained.filter(id => { const r = rc[id] ? norm(rc[id]) : null; return !r || !r.due || r.due <= today; }).length;
    let streak = 0; for (let d = log[today] ? 0 : -1; log[h.day(d)]; d--) streak++;                 // apps/verses.html:235
    const boxes = [0, 0, 0, 0, 0]; for (const id of trained) boxes[(rc[id] ? norm(rc[id]).box : 1) - 1]++;   // :236
    const summary = { due, streak, boxes, total: trained.length, reviewedToday: Math.max(0, Math.floor(Number(log[today]) || 0)), week: kid ? familyWeek : null, at: today };
    h.person(p.id, 'verses', 'summary', summary, h.ago(15));   // refreshed when the trainer last opened, this morning
  }
}
