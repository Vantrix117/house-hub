// F260 Reading Plan seed (apps/f260.html, person scope). Owns every f260.* key for the adults who read the plan
// (eli, christian = Mae, mom = Elizabeth, dad = David; the niece Mea and the guests have no F260 data), plus F260's own
// feed lines. No journal vault is written (it is encrypted): the journal always shows its "set a passcode" state.
//
// How it works: each reader is described by a plan position (current week, readings done this week), a start date,
// a reading rhythm (weekdays, breaks) and an explicit recent "tail" of reading days that fixes the streak and whether
// they read today (story.mjs PLOT). The readings are then laid out in plan order across those days, and every derived
// row (done, log, weekStart, weekDone, best, miles, summary) is computed with the app's own rules, ported below, so the
// app finds nothing to rewrite when it opens and Home / the TV / Verses read the same numbers the app shows.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLOT } from './story.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// ── the plan itself, read from the app so the seed can never drift from it (apps/f260.html:788-841) ──────────
let PLAN = null;
function plan() {
  if (PLAN) return PLAN;
  const src = fs.readFileSync(path.join(ROOT, 'apps', 'f260.html'), 'utf8');
  const out = [];
  for (const m of src.matchAll(/\{\s*w:\s*(\d+),\s*r:\s*(\[[^\]]*\]),\s*m:\s*(\[[^\]]*\])\s*\}/g)) out.push({ w: +m[1], r: JSON.parse(m[2]), m: JSON.parse(m[3]) });
  if (out.length !== 52 || out.some((wk, i) => wk.w !== i + 1 || wk.r.length !== 5 || wk.m.length !== 2)) throw new Error('seed/f260: could not read PLAN from apps/f260.html');
  return (PLAN = out);
}

// ── ports of the app's plan helpers (apps/f260.html:949-960, 1185-1215) ─────────────────────────────────────────
const BOOK_RE = /^((?:[1-3]\s+)?[A-Z][a-z]+(?:\s+of\s+[A-Z][a-z]+)?)\s+(.*)$/;
function splitRefs(s) {
  const out = []; let book = '';
  s.split(/\s*[,;]\s*/).forEach(part => {
    if (!part) return;
    const m = part.match(BOOK_RE);
    if (m) { book = m[1]; out.push({ book, rest: m[2], text: part }); }
    else if (book) out.push({ book, rest: part, text: book + ' ' + part });
    else out.push({ book: '', rest: part, text: part });
  });
  return out;
}
const LAW = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];
const normBook = b => b === 'Psalm' ? 'Psalms' : b;
let BOOKS = null;
function booksInPlan() {
  if (BOOKS) return BOOKS;
  const m = new Map();
  const add = (b, id) => { b = normBook(b); if (!m.has(b)) m.set(b, { book: b, days: [] }); const e = m.get(b); if (!e.days.includes(id)) e.days.push(id); };
  plan().forEach(wk => wk.r.forEach((r, d) => { const id = wk.w + '-' + d;
    splitRefs(r).forEach(x => { if (/[–—]/.test(x.text)) x.text.split(/\s*[–—]\s*/).forEach(p => { const mm = p.match(BOOK_RE); if (mm) add(mm[1], id); }); else if (x.book) add(x.book, id); }); }));
  return (BOOKS = [...m.values()]);
}

// milestones and their tests (apps/f260.html:1218-1240); entries stay 0 because no journal is seeded
const MILES = [
  ['first-reading', s => s.readings >= 1], ['first-entry', s => s.entries >= 1], ['first-verse', s => s.mem >= 1],
  ['first-book', s => s.booksDone >= 1], ['streak-7', s => s.best >= 7], ['pentateuch', s => LAW.every(b => s.bookDone[b])],
  ['readings-100', s => s.readings >= 100], ['streak-30', s => s.best >= 30], ['psalms', s => !!s.bookDone['Psalms']],
  ['halfway', s => s.weeks26], ['nt', s => s.ntStarted], ['entries-50', s => s.entries >= 50], ['verses-104', s => s.mem >= 104],
  ['complete', s => s.readings >= 260],
];
function statsOf(done, mem, best) {
  const bd = {}; for (const e of booksInPlan()) bd[e.book] = e.days.every(id => done[id]);
  const weekCount = w => [0, 1, 2, 3, 4].filter(d => done[w + '-' + d]).length;
  return { readings: Object.keys(done).length, entries: 0, mem: Object.keys(mem).length, best,
    bookDone: bd, booksDone: Object.values(bd).filter(Boolean).length,
    weeks26: plan().slice(0, 26).every(wk => weekCount(wk.w) === 5), ntStarted: Object.keys(done).some(k => +k.split('-')[0] >= 31) };
}

// ── date keys (YYYY-MM-DD), pure arithmetic ─────────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
const k2ms = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const ms2k = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const shift = (k, n) => ms2k(k2ms(k) + n * 86400000);
const between = (a, b) => Math.round((k2ms(b) - k2ms(a)) / 86400000);
const dow = k => new Date(k2ms(k)).getUTCDay();          // 0 = Sunday

// streak with rest days, walking back from today (apps/f260.html:1385-1395)
function streakInfo(days, today) {
  let cursor = today, streak = 0, gap = 0, started = false;
  for (let i = 0; i < 400; i++) {
    if (days[cursor]) { streak++; gap = 0; started = true; } else { gap++; if (gap > 2) break; }
    cursor = shift(cursor, -1);
  }
  if (!started) streak = 0;
  return streak;
}
// the next unread reading (apps/f260.html:1480-1489)
function nextReading(done, curWeek) {
  const order = []; for (let w = curWeek; w <= 52; w++) order.push(w); for (let w = 1; w < curWeek; w++) order.push(w);
  for (const w of order) { const d = plan()[w - 1].r.findIndex((_, i) => !done[w + '-' + i]); if (d >= 0) return { week: w, day: d + 1, ref: plan()[w - 1].r[d] }; }
  return null;
}

// ── the readers ─────────────────────────────────────────────────────────────────────────────────────────────────
// Offsets are days from the demo morning (Tue 22 Sep 2026). dows: weekdays they usually read (0 = Sun).
// tail: [offset, readings] — the recent days that fix the streak; the window [start, windowEnd] holds the rest of the
// year, one reading per usual day (a few doubles or dropped days so the count comes out exactly).
// skip: readings left unticked in earlier weeks (a partial week in the year grid).
// mem: [from, to, verses] ranges of memorised verse ids; notYet: verses practised "not yet" (the F260 "Practice again" row);
// dueToday: verses whose Leitner review falls due today in the Verses app (the "not yet" ones are due today too).
const P = PLOT.f260;
const nonSundayTail = (n, readings = {}) => { const out = []; for (let o = 0; out.length < n; o--) if (dow(shift(DAY0, o)) !== 0) out.push([o, readings[o] || 1]); return out.reverse(); };
let DAY0 = '2026-09-22';

function readers(h) {
  if (h.typical) return {
    // Eli: week 38, 2 of 5, a 12-day streak that began after the Labor Day weekend away; not read yet today.
    eli: { week: P.eli.week, weekDone: P.eli.weekDone, start: -260, dows: [1, 2, 3, 4, 5], windowEnd: -18,
      breaks: [[-221, -218], [-172, -169], [-95, -90], [-53, -50]],
      tail: [[-14, 1], [-13, 1], [-12, 1], [-11, 1], [-10, 1], [-8, 1], [-7, 1], [-6, 1], [-5, 1], [-4, 1], [-2, 1], [-1, 1]],
      mem: [[1, 24, [0, 1]], [25, 37, [0]], [31, 32, [1]], [36, 36, [1]]], notYet: ['36-1', '37-0'], dueToday: ['33-0'],
      texts: ['36-1', '31-1', '32-1', '20-1', '1-0', '35-0', '34-0'], clock: '21:10' },
    // Mae: finished week 37 this morning (two readings today); a 4-day streak after a midweek gap.
    christian: { week: P.christian.week, weekDone: P.christian.weekDone, start: -253, dows: [0, 1, 2, 3, 4], windowEnd: -8,
      breaks: [[-200, -196], [-130, -126], [-60, -56]],
      tail: [[-4, 1], [-3, 1], [-1, 1], [0, 2]],
      mem: [[1, 30, [0]], [31, 31, [1]]], notYet: [], dueToday: [], texts: ['31-1'], clock: '07:05' },
    // Elizabeth: the steady one — a 26-day streak (Sundays off), week 38 reading 3 done this morning.
    mom: { week: P.mom.week, weekDone: P.mom.weekDone, start: -260, dows: [1, 2, 3, 4, 5, 6],
      breaks: [[-190, -186], [-120, -116], [-75, -71]],
      tail: nonSundayTail(P.mom.streak),
      mem: [[1, 37, [0, 1]], [38, 38, [0]]], notYet: [], dueToday: [], texts: ['38-0', '37-1', '35-0', '20-1'], clock: '06:10' },
    // David: behind — week 31 started a week ago with Luke 1, nothing since; two readings left behind in weeks 24 and 28.
    dad: { week: P.dad.week, weekDone: P.dad.weekDone, start: -260, dows: [1, 3, 4, 6], windowEnd: -12,
      breaks: [[-230, -222], [-150, -140], [-100, -93], [-40, -33]],
      tail: [[-8, 1]], skip: ['24-3', '28-4'],
      mem: [[1, 10, [0]], [1, 1, [1]]], notYet: [], dueToday: [], texts: [], clock: '22:20' },
  };
  if (h.overflow) return {
    // Eli: a year in, the last reading of the whole plan still to go, every verse memorised, a long unbroken streak.
    eli: { week: 52, weekDone: 4, start: -363, dows: [1, 2, 3, 4, 5], windowEnd: -1, breaks: [], tail: [],
      mem: [[1, 52, [0, 1]]], notYet: ['37-0', '40-1', '41-1', '42-1', '43-1', '44-1', '45-1', '46-1', '47-0', '48-1', '49-1', '50-1', '51-1', '52-1'],
      dueToday: ['2-0', '5-1', '9-0', '14-1', '22-0', '27-1'],
      texts: ['37-0', '45-1', '47-0', '52-1', '49-1', '36-1', '31-1', '32-1', '35-0', '34-0', '38-0', '37-1', '20-1', '1-0'], clock: '21:10' },
    // Mae: week 51 finished this morning.
    christian: { week: 51, weekDone: 5, start: -364, dows: [0, 1, 2, 3, 4], windowEnd: -3, breaks: [[-200, -196]],
      tail: [[-2, 1], [-1, 2], [0, 2]], mem: [[1, 40, [0, 1]]], notYet: ['39-1', '40-0'], dueToday: [], texts: ['38-0', '40-0'], clock: '07:05' },
    // Elizabeth: the whole plan finished yesterday.
    mom: { week: 52, weekDone: 5, start: -371, dows: [1, 2, 3, 4, 5, 6], windowEnd: -2, breaks: [[-300, -296]],
      tail: [[-1, 1]], mem: [[1, 48, [0, 1]]], notYet: [], dueToday: [], texts: ['52-1', '20-1'], clock: '06:10', finished: true },
    // David: week 46, still behind, six readings left behind in earlier weeks.
    dad: { week: 46, weekDone: 1, start: -365, dows: [1, 3, 4, 6], windowEnd: -10, breaks: [[-230, -222], [-100, -93]],
      tail: [[-6, 1]], skip: ['12-2', '19-4', '24-3', '28-4', '33-1', '41-0'],
      mem: [[1, 15, [0, 1]]], notYet: ['15-1'], dueToday: [], texts: [], clock: '22:20' },
  };
  return {};
}

// Verse texts pasted once for practice (f260.verses). King James Version (public domain).
const KJV = {
  '1-0': 'So God created man in his own image, in the image of God created he him; male and female created he them.',
  '20-1': 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
  '31-1': 'And the Word was made flesh, and dwelt among us, (and we beheld his glory, the glory as of the only begotten of the Father,) full of grace and truth.',
  '32-1': 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.',
  '34-0': 'For even the Son of man came not to be ministered unto, but to minister, and to give his life a ransom for many.',
  '35-0': 'A new commandment I give unto you, That ye love one another; as I have loved you, that ye also love one another. By this shall all men know that ye are my disciples, if ye have love one to another.',
  '36-1': 'And this is life eternal, that they might know thee the only true God, and Jesus Christ, whom thou hast sent.',
  '37-0': 'And Jesus came and spake unto them, saying, All power is given unto me in heaven and in earth. Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost: Teaching them to observe all things whatsoever I have commanded you: and, lo, I am with you alway, even unto the end of the world. Amen.',
  '37-1': 'But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me both in Jerusalem, and in all Judaea, and in Samaria, and unto the uttermost part of the earth.',
  '38-0': 'And they continued stedfastly in the apostles\u2019 doctrine and fellowship, and in breaking of bread, and in prayers.',
  '40-0': 'These were more noble than those in Thessalonica, in that they received the word with all readiness of mind, and searched the scriptures daily, whether those things were so.',
  '45-1': 'I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service. And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.',
  '47-0': 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast. For we are his workmanship, created in Christ Jesus unto good works, which God hath before ordained that we should walk in them.',
  '49-1': 'Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.',
  '52-1': 'And I heard a great voice out of heaven saying, Behold, the tabernacle of God is with men, and he will dwell with them, and they shall be his people, and God himself shall be with them, and be their God. And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.',
};

const INTERVALS = [1, 2, 4, 7, 14];   // Leitner days by box (apps/verses.html:193)

// ── build one reader ────────────────────────────────────────────────────────────────────────────────────────────
function build(spec, today) {
  const at = o => shift(today, o);
  // the readings, in plan order (earlier weeks complete except `skip`, then this week's first weekDone)
  const seq = [];
  for (let w = 1; w < spec.week; w++) for (let d = 0; d < 5; d++) if (!(spec.skip || []).includes(w + '-' + d)) seq.push(w + '-' + d);
  for (let d = 0; d < spec.weekDone; d++) seq.push(spec.week + '-' + d);
  // reading days: the tail, then the window before it
  const tail = spec.tail.map(([o, n]) => [at(o), n]);
  const tailN = tail.reduce((a, [, n]) => a + n, 0);
  const end = spec.windowEnd != null ? spec.windowEnd : spec.tail[0][0] - 4;       // 3 quiet days end the earlier run
  const inBreak = o => spec.breaks.some(([a, b]) => o >= a && o <= b);
  const cand = [];
  for (let o = spec.start; o <= end; o++) if ((o === spec.start || spec.dows.includes(dow(at(o)))) && !inBreak(o)) cand.push(at(o));
  const R = seq.length - tailN;
  if (R < 1 || !cand.length) throw new Error('seed/f260: reader does not fit its window');
  let win;
  if (cand.length >= R) win = Array.from({ length: R }, (_, i) => [cand[R === 1 ? 0 : Math.round(i * (cand.length - 1) / (R - 1))], 1]);
  else { const base = Math.floor(R / cand.length), extra = R % cand.length; win = cand.map(k => [k, base]);
    for (let i = 0; i < extra; i++) win[Math.floor((i + 0.5) * cand.length / extra)][1]++; }
  const days = [...win, ...tail];
  // lay the readings over the days, in order
  const readOn = {};                      // id → day
  let q = 0;
  for (const [k, n] of days) for (let j = 0; j < n; j++) readOn[seq[q++]] = k;
  if (q !== seq.length) throw new Error('seed/f260: readings and days disagree');

  // derived rows
  const done = {}; for (const id of seq) done[id] = true;                                   // { "38-1": true }  (f260.html:908)
  const log = {}; for (const [k] of days) log[k] = true;                                     // { "2026-09-21": true }  (f260.html:917, 1662)
  const weekStart = {}, weekDone = {};                                                       // { "38": "2026-09-20" }  (f260.html:918-919)
  for (const id of seq) { const w = id.split('-')[0]; if (!weekStart[w] || readOn[id] < weekStart[w]) weekStart[w] = readOn[id]; }
  for (let w = 1; w <= spec.week; w++) { const ids = [0, 1, 2, 3, 4].map(d => w + '-' + d); if (ids.every(id => done[id])) weekDone[w] = ids.map(id => readOn[id]).sort().pop(); }
  // memorised verses and the day each was learned (a day or two after that week's last reading)
  const memIds = [];
  for (const [a, b, is] of spec.mem) for (let w = a; w <= b; w++) for (const i of is) if (!memIds.includes(w + '-' + i)) memIds.push(w + '-' + i);
  const lastOfWeek = w => [0, 1, 2, 3, 4].map(d => readOn[w + '-' + d]).filter(Boolean).sort().pop();
  const memOn = {}; for (const id of memIds) { const [w, i] = id.split('-').map(Number); const base = lastOfWeek(w) || today; memOn[id] = [shift(base, i ? 3 : 1), today].sort()[0]; }

  // walk the year day by day: best streak and milestones as the app would have recorded them (f260.html:1242-1249, 1503)
  const calendar = [...new Set([...days.map(([k]) => k), ...Object.values(memOn)])].sort();
  const doneSoFar = {}, memSoFar = {}, miles = {}; let run = 0, prev = null, best = { n: 0, at: null };
  const byDay = {}; for (const id of seq) (byDay[readOn[id]] ||= []).push(id);
  for (const k of calendar) {
    if (log[k]) { run = prev && between(prev, k) - 1 <= 2 ? run + 1 : 1; prev = k; if (run > best.n) best = { n: run, at: k }; }
    for (const id of byDay[k] || []) doneSoFar[id] = true;
    for (const id of memIds) if (memOn[id] === k) memSoFar[id] = true;
    const s = statsOf(doneSoFar, memSoFar, best.n);
    for (const [mid, test] of MILES) if (!miles[mid] && test(s)) miles[mid] = k;
  }
  const streak = streakInfo(log, today);
  if (streak > best.n) best = { n: streak, at: today };
  const finished = seq.length >= 260 ? readOn[seq[seq.length - 1]] : null;
  const nx = nextReading(done, spec.week);
  // f260.summary, in the key order the app writes it so its JSON comparison finds nothing to change (f260.html:1506-1509)
  const summary = { week: spec.week, weekDone: [0, 1, 2, 3, 4].filter(d => done[spec.week + '-' + d]).length, total: seq.length, streak,
    readToday: !!log[today], next: nx ? { week: nx.week, day: nx.day, ref: nx.ref } : null, finished: !!finished };

  // Leitner review rows (apps/verses.html:296 writes { s, t, box, due, last, streak }); every memorised verse has one,
  // so the Verses app sees exactly spec.dueToday + spec.notYet as due today and the rest later.
  const recall = {};
  memIds.forEach((id, n) => {
    const [w] = id.split('-').map(Number);
    if (spec.notYet.includes(id)) { const last = shift(today, -1); recall[id] = { s: 'not', t: 0, box: 1, due: shift(last, 1), last, streak: 0, _at: last }; return; }
    const box = w <= 20 ? 5 : w <= 30 ? 4 : w <= 34 ? 3 : 2, iv = INTERVALS[box - 1];
    if (spec.dueToday.includes(id)) { const last = shift(today, -iv); recall[id] = { s: 'got', t: 0, box, due: today, last, streak: box - 1, _at: last }; return; }
    const back = 1 + (w * 3 + n) % (iv - 1);                  // reviewed 1..iv-1 days ago → due 1..iv-1 days from now
    const last = shift(today, -back);
    recall[id] = { s: 'got', t: 0, box, due: shift(last, iv), last, streak: box - 1, _at: last };
  });
  return { seq, readOn, days, done, log, weekStart, weekDone, memIds, memOn, miles, best, streak, finished, summary, recall };
}

export default function seedF260(h) {
  if (h.empty) return;                                    // empty: no F260 rows — the app opens on week 1
  DAY0 = h.day(0);
  const today = DAY0;
  const R = readers(h);
  const stamp = (k, hhmm) => h.time(between(today, k), hhmm);
  const plus = (hhmm, mins) => { const [H, M] = hhmm.split(':').map(Number); const t = H * 60 + M + mins; return pad(Math.floor(t / 60) % 24) + ':' + pad(t % 60); };
  const feedFrom = h.overflow ? -6 : -2;
  for (const [pid, spec] of Object.entries(R)) {
    const b = build(spec, today);
    const lastDay = b.days[b.days.length - 1][0];
    const lastAt = stamp(lastDay, plus(spec.clock, 12 * (b.days[b.days.length - 1][1] - 1)));
    const put = (key, value, at = lastAt) => h.person(pid, 'f260', key, value, Math.min(at, h.now - 60000));
    put('f260.done', b.done);                             // { "w-d": true }, d 0-based        (f260.html:908, 1659-1660)
    put('f260.week', spec.week, stamp(b.weekStart[spec.week], spec.clock));   // current week   (f260.html:909, 1685)
    put('f260.weekStart', b.weekStart);                   // { "w": "YYYY-MM-DD" }            (f260.html:918, 1686)
    put('f260.weekDone', b.weekDone);                     // { "w": "YYYY-MM-DD" }            (f260.html:919, 1670)
    put('f260.log', b.log);                               // { "YYYY-MM-DD": true }           (f260.html:917, 1662)
    put('f260.best', b.best);                             // { n, at }                        (f260.html:923, 1503)
    put('f260.miles', b.miles);                           // { milestoneId: "YYYY-MM-DD" }    (f260.html:924, 1244-1245)
    // memorised verses { "w-i": true } (f260.html:916, 1652-1653)
    const memAt = stamp([...Object.values(b.memOn)].sort().pop(), spec.clock);
    put('f260.mem', Object.fromEntries(b.memIds.map(id => [id, true])), memAt);
    // verse texts pasted for practice { "w-i": "text" } (f260.html:926, 1913)
    const texts = Object.fromEntries(spec.texts.filter(id => KJV[id] && b.memIds.includes(id)).map(id => [id, KJV[id]]));
    if (Object.keys(texts).length) put('f260.verses', texts, memAt);
    // Leitner rows { s, t, box, due, last, streak } (apps/verses.html:296; f260.html:927, 1344, 1363)
    const recall = {};
    for (const [id, r] of Object.entries(b.recall)) { const { _at, ...row } = r; row.t = stamp(_at, r.s === 'not' ? plus(spec.clock, 20) : '07:30'); recall[id] = row; }
    if (Object.keys(recall).length) put('f260.recall', recall, Math.max(...Object.values(recall).map(r => r.t)));
    if (b.finished) put('f260.finished', b.finished);    // "YYYY-MM-DD" of the 260th reading (f260.html:928, 1672)
    put('f260.summary', b.summary);                       // Home card, TV, chat, reminders (f260.html:1506-1509)
    // F260's feed lines: "Read week W day D — REF" (f260.html:1661); every reading of the last few days plus the latest one
    const recentFrom = shift(today, feedFrom);
    const lastDayIds = b.seq.filter(id => b.readOn[id] === lastDay);
    const perDay = {};
    for (const id of b.seq) {
      const k = b.readOn[id];
      if (k < recentFrom && !lastDayIds.includes(id)) continue;
      const n = perDay[k] = (perDay[k] || 0) + 1;
      const [w, d] = id.split('-').map(Number);
      h.activity(pid, 'f260', 'Read week ' + w + ' day ' + (d + 1) + ' — ' + plan()[w - 1].r[d], Math.min(stamp(k, plus(spec.clock, 12 * (n - 1))), h.now - 60000));
    }
  }
}

// For the report: what each reader ends up with (node -e "import('./audits/tools/seed/f260.mjs').then(m => m.describe('typical'))").
export function describe(variant = 'typical', todayKey = '2026-09-22') {
  const h = { empty: variant === 'empty', typical: variant === 'typical' || variant === 'park', overflow: variant === 'overflow' };
  DAY0 = todayKey;
  const out = {};
  for (const [pid, spec] of Object.entries(readers(h))) {
    const b = build(spec, todayKey);
    const due = Object.entries(b.recall).filter(([, r]) => r.due <= todayKey).map(([id]) => id);
    out[pid] = { summary: b.summary, best: b.best, miles: Object.keys(b.miles).length, start: Object.values(b.weekStart).sort()[0], mem: b.memIds.length, dueToday: due, logDays: Object.keys(b.log).length };
  }
  return out;
}
