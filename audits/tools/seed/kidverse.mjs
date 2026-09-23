// Kid Verse seed (apps/kidverse.html). Owns the app 'kidverse' rows:
//   family  week                    the family memory-verse week an adult set (PLOT.kidverseWeek, set by Eli)
//   person  stars      (each kid)   the kid's stars row …
//   family  stars:<kid>             … and its mirror (identical; Home, Me and the TV read the mirror)
//   person  story      (each kid)   the days the kid tapped "I heard it" this ISO week …
//   family  story:<kid>             … and its mirror (F260's parents hero reads it; Kid Verse credits story stars from it)
//   family  ledger:<kid>:<id>       a parent's cash-ins / week resets, already applied by the kid's app (applied[key])
//
// Every row is a fixed point of the app's reconcile() (apps/kidverse.html:468-489): each story day in story:<kid> and each
// prayed day on the family prayer list (read here from the prayer seed's rows, plus PLOT.prayedToday) is already credited,
// `count` equals weekCount(), every ledger row is in `applied`, and every badge whose test passes is recorded. So opening
// Kid Verse as a kid writes nothing and shows no "New badge" toast or confetti — the screens show the seeded story.
//
// Variants: empty writes nothing (week 1 by default, no stars); typical/park follow PLOT (Ezra 3 this week, Kiara 1);
// overflow scales up: a year of history, 30 cash-ins and a reset in the ledger, every badge, a balance in the hundreds.
import { PLOT, HOUSEHOLD } from './story.mjs';

const KIDS = ['ezra', 'kiara'];

export default function kidverse(h) {
  if (h.empty) return;
  const pad = n => String(n).padStart(2, '0');
  const dayOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dow = new Date(h.now).getDay();                     // 0 Sun … 6 Sat (demo: Tuesday)
  const monday = -((dow + 6) % 7);                          // offset of this ISO week's Monday (apps/kidverse.html:262)
  const weekOffsets = Array.from({ length: 7 }, (_, i) => monday + i).filter(o => o <= 0);
  const thisWeek = new Set(weekOffsets.map(o => h.day(o)));
  const lookback = new Set(Array.from({ length: 14 }, (_, i) => h.day(-i)));   // reconcile credits 14 days back (apps/kidverse.html:472)
  const keepFrom = h.day(-29);                               // earnedAt is kept 30 days (apps/kidverse.html:410)

  // ── the family week (apps/kidverse.html:276 reads { week }; setWeek writes { week, by, at } at :338) ──
  const weekAt = h.time(monday - 1, '20:15');               // Sunday evening, after family devotions
  h.family('kidverse', 'week', { week: PLOT.kidverseWeek, by: 'eli', at: weekAt }, weekAt);

  // prayed days per kid, as the app finds them: family prayer:* rows, prayedBy[date] name lists (apps/kidverse.html:427-434)
  const prayerRows = h.list('family', null, 'prayer', 'prayer:');
  const prayedFromRows = name => {
    const out = new Set();
    for (const r of prayerRows) {
      const pb = r.value && r.value.prayedBy; if (!pb || typeof pb !== 'object') continue;
      for (const d of Object.keys(pb)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Array.isArray(pb[d]) && pb[d].map(x => String(x).trim()).includes(name)) out.add(d);
    }
    return out;
  };
  const prayedToday = new Set(PLOT.prayedToday.map(n => Object.keys(HOUSEHOLD).find(id => HOUSEHOLD[id].name === n)).filter(Boolean));

  // ── each kid's story: past events (day offsets), this week's target and the order this week's slots fill in ──
  const T = h.overflow ? { ezra: 6, kiara: 4 } : PLOT.kidsStarsThisWeek;
  const plan = {
    // typical — Ezra (5) has used it for three weeks; Kiara (4) started last week
    typical: {
      ezra: { verse: [-14, -13, -11, -8, -7, -5, -2], story: [-14, -12, -8, -6, -4], prayed: [-9, -5, -2],
        cashins: [{ off: -2, at: '19:00', by: 'eli' }], resets: [], fill: [['verse', monday], ['story', monday], ['story', 0], ['verse', 0]] },
      kiara: { verse: [-6, -4, -2], story: [-4], prayed: [],
        cashins: [], resets: [], fill: [['verse', monday], ['story', monday], ['verse', 0], ['story', 0]] },
    },
    // overflow — about a year of history, weekly cash-ins that stopped in the spring (so the balance is big), one reset
    overflow: {
      ezra: { ...history(420, 2, [7, 10], [3, 5], [3, 4]), cashins: sundays(-58 * 7, -29 * 7, '19:00', 'christian'),
        resets: [{ off: -40 * 7 + 2, at: '18:30', by: 'mom' }], fill: [['verse', monday], ['story', monday], ['prayed', monday], ['verse', 0], ['story', 0], ['prayed', 0]] },
      kiara: { ...history(200, 3, [3, 5], [1, 2], [2, 3]), cashins: sundays(-24 * 7, -6 * 7, '18:45', 'dad'),
        resets: [], fill: [['verse', monday], ['story', monday], ['verse', 0], ['prayed', monday], ['story', 0], ['prayed', 0]] },
    },
  }[h.base];

  // a deterministic history: over `days` days before this week, a day gets a verse/story/prayed star when (day·k) mod d < n
  function history(days, seed, v, s, p) {
    const out = { verse: [], story: [], prayed: [] };
    for (let o = monday - days; o < monday; o++) {
      const i = o + days + seed;
      if ((i * 7) % v[1] < v[0]) out.verse.push(o);
      if ((i * 11) % s[1] < s[0]) out.story.push(o);
      if ((i * 5) % p[1] < p[0]) out.prayed.push(o);
    }
    return out;
  }
  function sundays(from, to, at, by) { const out = []; for (let o = from; o <= to; o++) if (new Date(h.time(o, '12:00')).getDay() === 0) out.push({ off: o, at, by }); return out; }

  let feed = [];
  for (const kid of KIDS) {
    const cfg = plan[kid];
    const name = h.name(kid);
    // prayed: the kid's past days + today when PLOT says so + whatever the prayer seed recorded in the lookback window
    const prayed = new Set(cfg.prayed.map(o => h.day(o)));
    if (prayedToday.has(kid)) prayed.add(h.day(0));
    for (const d of prayedFromRows(name)) if (lookback.has(d)) prayed.add(d);
    const verse = new Set(cfg.verse.map(o => h.day(o)).filter(d => !thisWeek.has(d)));
    const story = new Set(cfg.story.map(o => h.day(o)).filter(d => !thisWeek.has(d)));
    // this week: prayed days count first; the rest of the target fills verse/story/prayed slots in the kid's order
    let left = T[kid] - [...prayed].filter(d => thisWeek.has(d)).length;
    for (const [kind, off] of cfg.fill) {
      if (left <= 0) break;
      const d = h.day(off); const set = kind === 'verse' ? verse : kind === 'story' ? story : prayed;
      if (set.has(d)) continue;
      set.add(d); left--;
    }
    // the events in time order: verse ★ in the morning, the story at bedtime, praying at breakfast (credited when Kid Verse opens)
    const lag = kid === 'kiara' ? 7 : 0;                     // Kiara is a few minutes behind her brother
    const at = (d, hhmm) => { const [y, m, dd] = d.split('-').map(Number); const [H, M] = hhmm.split(':').map(Number); return new Date(y, m - 1, dd, H, M + lag).getTime(); };
    const today = h.day(0);
    const ev = [
      ...[...verse].map(d => ({ kind: 'verse', d, t: at(d, d === today ? '08:25' : '07:50') })),
      ...[...story].map(d => ({ kind: 'story', d, t: at(d, d === today ? '08:30' : '19:20') })),
      ...[...prayed].map(d => ({ kind: 'prayed', d, t: at(d, d === today ? '08:20' : '08:10') })),
    ].filter(e => e.t <= h.now).sort((a, b) => a.t - b.t || a.kind.localeCompare(b.kind));
    const ledger = [
      ...cfg.cashins.map(c => ({ kind: 'cashin', d: h.day(c.off), t: h.time(c.off, c.at), by: c.by })),
      ...cfg.resets.map(r => ({ kind: 'reset', d: h.day(r.off), t: h.time(r.off, r.at), by: r.by })),
    ].sort((a, b) => a.t - b.t);

    // replay the history: stars earned, badges crossed (apps/kidverse.html:392-399), cash-ins and resets applied (:442-464)
    // stars row shape: { week, count, days, total, earned, credited, badges, payouts, applied, earnedAt } (apps/kidverse.html:381)
    const s = { week: h.isoWeek(0), count: 0, days: {}, total: 0, earned: 0, credited: { story: {}, prayed: {} }, badges: {}, payouts: [], applied: {}, earnedAt: {} };
    const status = new Map();   // 'kind:date' → true | 'reset'
    const perWeek = new Map(); let nStory = 0, nPrayed = 0;
    const isoOf = ms => { const dt = new Date(ms); const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return `${y}-W${pad(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7))}`; };
    const badge = (id, ok, d) => { if (ok && !s.badges[id]) s.badges[id] = d; };
    const timeline = [...ev.map(e => ({ ...e, star: true })), ...ledger].sort((a, b) => a.t - b.t);
    let li = 0;
    for (const e of timeline) {
      if (!e.star) {
        const key = `ledger:${kid}:${e.t.toString(36)}-${h.uid('k').slice(-4)}`;
        if (e.kind === 'cashin') {
          const amount = s.total; if (!amount) continue;
          // ledger row shape: { kind: 'cashin', date, amount, by, at } (index.html:1369; applied at apps/kidverse.html:447-450)
          h.family('kidverse', key, { kind: 'cashin', date: e.d, amount, by: e.by, at: e.t }, e.t);
          s.payouts.push({ date: e.d, amount, by: e.by }); s.total = 0;
          feed.push([e.by, `Cashed in ${name}'s ${amount} ${amount === 1 ? 'star' : 'stars'} ★`, e.t]);   // index.html:1370
        } else {
          // reset row shape: { kind: 'reset', date, days: [that ISO week's days up to date], by, at } (index.html:1374; applied at apps/kidverse.html:451-458)
          const wd = new Date(e.t).getDay(), mon = -((wd + 6) % 7); const days = [];
          for (let i = 0; i <= -mon; i++) days.push(dayOf(e.t + (mon + i) * 86400000));
          h.family('kidverse', key, { kind: 'reset', date: e.d, days, by: e.by, at: e.t }, e.t);
          for (const d of days) for (const kind of ['verse', 'story', 'prayed']) if (status.get(kind + ':' + d) === true) { status.set(kind + ':' + d, 'reset'); s.total = Math.max(0, s.total - 1); }
          feed.push([e.by, `Reset ${name}'s stars for the week`, e.t]);
        }
        s.applied[key] = true; li++;
        continue;
      }
      status.set(e.kind + ':' + e.d, true);
      s.total++; s.earned++;
      if (e.kind === 'story') nStory++; if (e.kind === 'prayed') nPrayed++;
      const wk = isoOf(e.t); perWeek.set(wk, (perWeek.get(wk) || 0) + 1);
      badge('first', s.earned >= 1, e.d); badge('ten', s.earned >= 10, e.d); badge('fifty', s.earned >= 50, e.d);
      badge('story', nStory >= 5, e.d); badge('prayer', nPrayed >= 5, e.d); badge('week', perWeek.get(wk) >= 7, e.d);
    }
    s.payouts = s.payouts.slice(-50);
    for (const [k, v] of status) {
      const [kind, d] = k.split(':');
      if (kind === 'verse') { if (thisWeek.has(d)) s.days[d] = v; }        // days holds this ISO week only (apps/kidverse.html:270)
      else s.credited[kind][d] = v;
      const e = ev.find(x => x.kind === kind && x.d === d);
      if (v === true && d >= keepFrom && e) s.earnedAt[k] = e.t;
    }
    s.count = [...status].filter(([k, v]) => v === true && thisWeek.has(k.split(':')[1])).length;   // weekCount (apps/kidverse.html:414)
    const last = Math.max(weekAt, ...ev.map(e => e.t), ...ledger.map(l => l.t));
    h.person(kid, 'kidverse', 'stars', s, last);
    h.family('kidverse', 'stars:' + kid, s, last);

    // story row shape: { week: 'YYYY-Www', days: { date: true } } for the ISO week of the last "I heard it" (apps/kidverse.html:598-604, 637-639)
    const heard = ev.filter(e => e.kind === 'story');
    if (heard.length) {
      const lastHeard = heard[heard.length - 1], wk = isoOf(lastHeard.t);
      const days = {}; for (const e of heard) if (isoOf(e.t) === wk) days[e.d] = true;
      h.person(kid, 'kidverse', 'story', { week: wk, days }, lastHeard.t);
      h.family('kidverse', 'story:' + kid, { week: wk, days }, lastHeard.t);
    }
    // a few feed lines from the last two days (what award() and heard() post: apps/kidverse.html:332, 640)
    for (const e of ev.filter(x => x.t >= h.time(-1, '00:00') && x.kind !== 'prayed')) feed.push([kid, e.kind === 'verse' ? `${name} read the verse ★` : `${name} heard this week's story`, e.t]);
  }
  feed = feed.filter(([, , t]) => t >= h.time(h.overflow ? -21 : -3, '00:00')).sort((a, b) => a[2] - b[2]);
  for (const [pid, text, t] of feed) h.activity(pid, 'kidverse', text, t);
}
