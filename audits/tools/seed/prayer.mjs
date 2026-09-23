// Prayer (apps/prayer.html) demo data: Eli's own list, lighter own lists for Elizabeth (mom) and Mae (christian),
// and the shared family list that the TV board, Kid Verse and kid mode read.
//
// Where the app keeps things (apps/prayer.html:575-586): app 'prayer', one row per list setting (LIST_KEYS: label,
// categories, prayerDays, plans, activePlan, rotationFor) plus one row per request ('prayer:<id>'), in person scope for
// the person's own list and family scope for the family list; 'activeList' and 'lastExport' in person scope (633-634).
//
// Cross-app facts (seed/story.mjs PLOT): the union of prayedBy[today] over the family rows is exactly PLOT.prayedToday
// (Elizabeth, Ezra) in typical/park. Earlier days carry Ezra only on the days seed/kidverse.mjs already credits him for
// praying (-9, -5, -2), so Kid Verse's prayed-star reconcile (14-day look-back) finds nothing new to credit. Overflow scales
// the family list up and puts many more names (long names, guests) on today's prayedBy to find clipping; its earlier
// days are adults only.
//
// Variants: empty writes nothing; typical and park are the same; overflow has 36 active + 26 answered on Eli's list,
// 32 family requests, long titles/details/names and big numbers.
import { PLOT, HOUSEHOLD } from './story.mjs';

// apps/prayer.html:588-596 — the default categories every list starts with (emptyList → CATEGORIES.slice()).
const CATEGORIES = [
  'Spiritual Needs', 'Personal', 'Family', 'Friends', 'Coworkers',
  'Those Who Are Lost - Family', 'Those Who Are Lost - Friends', 'Those Who Are Lost - Coworkers and Other',
  'Health Needs', 'Grief and Loss', 'Marriage', 'Children and Youth', 'Expecting and New Parents',
  'Widows and Elderly', 'Financial Needs', 'Work and Job Search', 'Wisdom and Decisions',
  'Church Leadership', 'Missionaries - USA', 'Missionaries - Abroad', 'Persecuted Church',
  'Schools and Students', 'Military and First Responders', 'Government', 'Nation',
  'World and Disaster Relief', 'Neighbors', 'Praise and Thanksgiving',
];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function seedPrayer(h) {
  if (h.empty) return;                                   // empty: no app data at all (the illustrated empty states)
  const O = h.overflow;
  const today = h.day(0);
  const iso = ms => new Date(ms).toISOString();

  // apps/prayer.html:599-605 emptyPlan() — { id, name, mode, focusCategory, includeDaily, rotationSize, groupByCategory, dayMap, show }
  const plan = (id, name, o = {}) => ({
    id, name, mode: o.mode || 'everything', focusCategory: o.focusCategory || '', includeDaily: o.includeDaily !== false,
    rotationSize: o.rotationSize || 3, groupByCategory: !!o.groupByCategory,
    dayMap: Object.fromEntries(DOW.map(d => [d, (o.dayMap && o.dayMap[d]) || []])),
    show: { meter: true, streak: true, answered: true, anniversaries: true, review: true, ...(o.show || {}) },
  });

  // apps/prayer.html:1436-1439 — the row an Add writes:
  // {id,title,for,phone,detail,category,cadence,days,status,createdAt,lastPrayedAt,answeredAt,answerNote,updates[],sharedFrom,prayedBy{},by,updatedAt}
  // Offsets are days from the demo morning (0 = today). `at` = when the row last changed (ms); `prayed` = { offset: [profile ids] }
  // becomes prayedBy { 'YYYY-MM-DD': [display names] } (names, not ids: apps/prayer.html:1597-1603).
  const row = o => {
    const offs = [o.created, o.last, o.answered, ...(o.updates || []).map(u => u[0])].filter(x => x != null);
    const at = o.at != null ? o.at : h.time(Math.max(...offs), o.last === 0 ? '06:30' : '20:45');
    return {
      at,
      value: {
        id: o.id, title: o.title, for: o.for || '', phone: o.phone || '', detail: o.detail || '', category: o.category,
        cadence: o.cadence || 'daily', days: o.cadence === 'weekly' ? (o.days || []) : [],
        status: o.answered != null ? 'answered' : 'active',
        createdAt: h.day(o.created), lastPrayedAt: o.last == null ? null : h.day(o.last),
        answeredAt: o.answered == null ? null : h.day(o.answered), answerNote: o.answered == null ? null : (o.note || ''),
        updates: (o.updates || []).map(([d, note]) => ({ date: h.day(d), note })),
        sharedFrom: o.sharedFrom || null,
        prayedBy: Object.fromEntries(Object.entries(o.prayed || {}).map(([d, ids]) => [h.day(+d), ids.map(id => h.name(id)).filter(Boolean)])),
        by: o.by,
        updatedAt: iso(at),
      },
    };
  };
  // apps/prayer.html:826-831 — today's rotation, frozen: active rotation rows, least recently prayed first, first `size`.
  // Written so Today and Home's read-only port (index.html:848-869) show the same set without the app having to save.
  const rotation = (rows, size, key) => ({
    date: today, size, key,
    ids: rows.map(r => r.value).filter(p => p.status === 'active' && p.cadence === 'rotation')
      .map((p, i) => ({ p, i, since: p.lastPrayedAt ? Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(p.lastPrayedAt + 'T12:00:00Z')) / 86400000) : 9999 }))
      .sort((a, b) => b.since - a.since || a.i - b.i).slice(0, size).map(x => x.p.id),
  });
  // A whole list: the LIST_KEYS rows (apps/prayer.html:585) plus one 'prayer:<id>' row per request (627).
  const writeList = (scope, pid, { label, categories = CATEGORIES, days, plans, active, rows }) => {
    const put = (k, v, at) => h.put(scope, pid, 'prayer', k, v, at);
    const which = scope === 'family' ? 'shared' : 'personal';
    const pl = plans.find(p => p.id === active);
    put('label', label, h.time(-200, '09:00'));
    put('categories', categories, h.time(-30, '21:00'));
    put('prayerDays', [...new Set(days)].sort(), Math.max(...rows.map(r => r.at)));      // apps/prayer.html:732-733
    put('plans', plans, h.time(-14, '21:00'));
    put('activePlan', active, h.time(-14, '21:00'));
    if (pl.mode === 'everything') put('rotationFor', rotation(rows, pl.rotationSize, which + '|' + pl.id), h.time(0, '05:58'));
    for (const r of rows) put('prayer:' + r.value.id, r.value, r.at);
  };
  const run = (from, to) => { const out = []; for (let d = from; d <= to; d++) out.push(h.day(d)); return out; };   // consecutive days
  const idOfName = n => Object.keys(HOUSEHOLD).find(id => HOUSEHOLD[id].name === n);
  const PRAYED = PLOT.prayedToday.map(idOfName);          // ['mom', 'ezra'] — the family list's prayedBy[today]

  if (!O) typical(); else overflow();

  // ── typical / park: a Tuesday morning ─────────────────────────────────────────────────────────────────────────
  function typical() {
    // Eli: 14 active, 5 answered. Today's set (plan "Morning", everything): daily p001-p005 + Tuesday's p006 + the
    // frozen rotation (p014, p011, p009) = 9; p001, p002, p005 prayed at 6:20 → "6 to pray · 3 done" on Home.
    const T = (m) => h.time(0, m);
    const eli = [
      { id: 'p001', title: 'Ezra and Kiara settling into school', for: 'Ezra & Kiara', category: 'Children and Youth', created: -21, last: 0, at: T('06:18'),
        updates: [[-8, 'Ezra says his teacher Mrs. Ortiz is "the nicest one."']] },
      { id: 'p002', title: "Mae's job interview on Thursday", for: 'Mae', category: 'Work and Job Search', created: -6, last: 0, at: T('06:19'),
        detail: 'Second interview at the library. She is a little nervous about the ten-minute presentation.' },
      { id: 'p003', title: "Dad's knee recovery", for: 'Dad', phone: '555-0147', category: 'Health Needs', created: -19, last: -1,
        detail: 'Knee replacement on September 3. Physical therapy three mornings a week.',
        updates: [[-18, 'Surgery went well. Home the next afternoon.'], [-4, 'Walking to the mailbox without the cane.']] },
      { id: 'p004', title: 'Patience and gentleness at home', category: 'Personal', created: -60, last: -1 },
      { id: 'p005', title: 'Our small group', for: 'The Parkers, the Lees and the Okafors', category: 'Friends', created: -120, last: 0, at: T('06:21') },
      { id: 'p006', title: 'Pastor Tim and the church staff', for: 'Pastor Tim & Rebecca', category: 'Church Leadership', cadence: 'weekly', days: ['Sun', 'Tue', 'Thu'], created: -200, last: -5 },
      { id: 'p007', title: 'The Nguyen family next door', for: 'The Nguyens', category: 'Neighbors', cadence: 'weekly', days: ['Mon', 'Fri'], created: -90, last: -1 },
      { id: 'p008', title: 'The Carters serving in Peru', for: 'The Carters', category: 'Missionaries - Abroad', cadence: 'rotation', created: -300, last: -9 },
      // created exactly two years ago today → Today shows the anniversary line (apps/prayer.html:778-784)
      { id: 'p009', title: 'Uncle Ray to come to faith', for: 'Uncle Ray', phone: '555-0163', category: 'Those Who Are Lost - Family', cadence: 'rotation', created: -730, last: -24,
        updates: [[-40, 'He came to the Fourth of July picnic and asked about the church.']] },
      { id: 'p010', title: 'Sam from work, and his mom in hospice', for: 'Sam', category: 'Coworkers', cadence: 'rotation', created: -35, last: -6 },
      { id: 'p011', title: 'Wisdom for the city council', category: 'Government', cadence: 'rotation', created: -150, last: -31 },
      { id: 'p012', title: 'Hurricane relief volunteers on the coast', category: 'World and Disaster Relief', cadence: 'rotation', created: -20, last: -7 },
      { id: 'p013', title: 'Jonah and Priya, expecting in November', for: 'Jonah & Priya', category: 'Expecting and New Parents', cadence: 'rotation', created: -45, last: -3 },
      { id: 'p014', title: 'Believers facing persecution', category: 'Persecuted Church', cadence: 'rotation', created: -400, last: -33 },
      // answered: the Record screen, "Answered recently" (≤ 30 days: p015, p018) and search
      { id: 'p015', title: 'A job for Luke', for: 'Luke', category: 'Work and Job Search', created: -95, last: -13, answered: -12,
        note: 'Luke starts at the county hospital in October. Three interviews, and the third one said yes.' },
      { id: 'p016', title: 'Wisdom about buying a minivan', category: 'Wisdom and Decisions', created: -220, last: -181, answered: -180,
        note: 'The Parkers were selling theirs, at a fair price, the week we started looking.' },
      { id: 'p017', title: "A buyer for the Hendersons' house", for: 'The Hendersons', category: 'Neighbors', created: -160, last: -77, answered: -76,
        note: 'Sold to a young family from church.' },
      { id: 'p018', title: 'Healing for my shoulder', category: 'Health Needs', created: -70, last: -26, answered: -25,
        note: 'Six weeks of stretches and it is back to normal. Lifting Kiara again.' },
      { id: 'p019', title: "The Parkers' adoption to be finalized", for: 'The Parkers', category: 'Friends', created: -140, last: -59, answered: -58,
        note: 'Finalized in court on a Friday morning. Little Grace is home for good.' },
    ].map(o => row({ by: 'eli', ...o }));
    writeList('person', 'eli', {
      label: 'My list', rows: eli, active: 'plEliMorning',
      plans: [plan('plEliMorning', 'Morning'), plan('plEliSunday', 'Sunday missions', { mode: 'focus', focusCategory: 'Missionaries - Abroad' })],
      // 9-day run (Sep 14-22, 18 days this month) after a 23-day run in August (the best run)
      days: [...run(-51, -29), -21, -20, -19, -17, -16, -14, -13, -12, -11].map(d => typeof d === 'number' ? h.day(d) : d).concat(run(-8, 0)),
    });
    h.person('eli', 'prayer', 'activeList', 'personal', h.time(-2, '21:00'));   // apps/prayer.html:633, 694
    h.person('eli', 'prayer', 'lastExport', h.day(-23), h.time(-23, '20:00'));    // apps/prayer.html:634, 1501

    // Elizabeth: a by-day plan grouped by category (Tuesday = Family, Widows and Elderly, Nation, plus every-day
    // requests) → 7 today, 3 done at 6:40. Her own streak: 41 days.
    const mom = [
      { id: 'p001', title: "David's knee, and patience with the therapy", for: 'David', category: 'Health Needs', created: -19, last: 0, at: T('06:38') },
      { id: 'p002', title: 'Ezra and Kiara', category: 'Children and Youth', created: -300, last: 0, at: T('06:39') },
      { id: 'p003', title: 'Mea finishing nursing school', for: 'Mea', category: 'Schools and Students', created: -120, last: -1 },
      { id: 'p004', title: 'Mrs. Patterson next door, recently widowed', for: 'Mrs. Patterson', category: 'Widows and Elderly', cadence: 'rotation', created: -40, last: -5 },
      { id: 'p005', title: "Aunt Carol's move to assisted living", for: 'Aunt Carol', category: 'Widows and Elderly', cadence: 'weekly', days: ['Tue'], created: -30, last: -7,
        updates: [[-7, 'She has a room with a garden window. Moving day is October 1.']] },
      { id: 'p006', title: 'Our leaders and the election', category: 'Nation', cadence: 'rotation', created: -90, last: -9 },
      { id: 'p007', title: 'My sister Ruth and her family', for: 'Ruth', category: 'Family', created: -500, last: 0, at: T('06:40') },
      { id: 'p008', title: 'The Carters in Peru', for: 'The Carters', category: 'Missionaries - Abroad', cadence: 'weekly', days: ['Sun'], created: -210, last: -2 },
      { id: 'p009', title: 'A smooth closing on the lake cabin', category: 'Financial Needs', created: -80, last: -46, answered: -45, note: 'Closed on time, and the sellers left us the canoe.' },
    ].map(o => row({ by: 'mom', ...o }));
    writeList('person', 'mom', {
      label: 'My list', rows: mom, active: 'plMomDays',
      plans: [plan('plMomDays', 'By the day', { mode: 'byDay', groupByCategory: true, dayMap: {
        Sun: ['Missionaries - Abroad', 'Church Leadership'], Mon: ['Friends', 'Neighbors'], Tue: ['Family', 'Widows and Elderly', 'Nation'],
        Wed: ['Health Needs', 'Grief and Loss'], Thu: ['Schools and Students', 'Government'], Fri: ['Financial Needs', 'Marriage'], Sat: ['Praise and Thanksgiving'] } })],
      days: run(-40, 0),
    });
    h.person('mom', 'prayer', 'activeList', 'personal', h.time(-3, '07:00'));

    // Mae: a by-day plan with nothing set up for Tuesdays and every-day requests left out → her Today reads
    // "Nothing scheduled for today under this plan." (apps/prayer.html:917-919); Home: "Nothing on the list today".
    const mae = [
      { id: 'p001', title: "Clear words for Thursday's interview", category: 'Work and Job Search', created: -6, last: -1 },
      { id: 'p002', title: "Ezra and Kiara's friendships at school", for: 'Ezra & Kiara', category: 'Children and Youth', created: -15, last: -1 },
      { id: 'p003', title: 'My sister Hannah and the new baby', for: 'Hannah', category: 'Expecting and New Parents', cadence: 'rotation', created: -30, last: -8 },
      { id: 'p004', title: "The women's Bible study", category: 'Friends', cadence: 'weekly', days: ['Wed'], created: -80, last: -6 },
      { id: 'p005', title: 'A babysitter we trust', category: 'Family', created: -60, last: -31, answered: -30, note: 'Mrs. Alvarez from church. The kids adore her.' },
    ].map(o => row({ by: 'christian', ...o }));
    writeList('person', 'christian', {
      label: 'My list', rows: mae, active: 'plMaeWeek',
      plans: [plan('plMaeWeek', 'Weekday categories', { mode: 'byDay', includeDaily: false, dayMap: {
        Sun: ['Church Leadership', 'Missionaries - Abroad'], Mon: ['Children and Youth', 'Work and Job Search'], Wed: ['Friends', 'Family'], Fri: ['Expecting and New Parents', 'Neighbors'] } })],
      days: [...run(-3, -1), ...run(-12, -7)],
    });

    // The family list. Today's set (everything): daily s001 s002 s003 s004 s007 + Tuesday's s005 + rotation (s008, s006)
    // = 8. Elizabeth prayed s001 and s002 at 6:52, Ezra s001 and s003 at 7:31 → prayedBy[today] ∪ = PLOT.prayedToday.
    // Ezra's earlier prayed days (-9, -5, -2) are the ones seed/kidverse.mjs already credits in his stars (its plan.typical.ezra.prayed),
    // so the rows and Kid Verse tell the same story and its 14-day reconcile finds nothing new to credit.
    const [MOM, EZRA] = PRAYED;
    const fam = [
      { id: 's001', title: "Grandpa's knee to heal", for: 'Grandpa David', category: 'Health Needs', by: 'mom', created: -19, last: 0, at: T('07:31'),
        prayed: { 0: [MOM, EZRA], '-1': ['mom', 'eli', 'christian'], '-2': ['dad', 'mom', 'ezra'] },
        updates: [[-4, 'Walking to the mailbox without the cane.']] },
      { id: 's002', title: "Grandma Jo's visit this week", for: 'Grandma Jo', category: 'Family', by: 'eli', created: -5, last: 0, at: T('06:53'),
        prayed: { 0: [MOM], '-1': ['christian', 'eli'] } },
      { id: 's003', title: "Mae's job interview on Thursday", for: 'Mae', category: 'Work and Job Search', by: 'eli', sharedFrom: 'p002', created: -1, last: 0, at: T('07:32'),
        prayed: { 0: [EZRA], '-1': ['mom'] } },
      { id: 's004', title: "Kiara's first weeks at preschool", for: 'Kiara', category: 'Children and Youth', by: 'christian', created: -16, last: -1,
        prayed: { '-1': ['christian', 'dad'], '-3': ['christian'], '-5': ['ezra'] } },
      { id: 's005', title: 'The Carters in Peru', for: 'The Carters', category: 'Missionaries - Abroad', cadence: 'weekly', days: ['Tue', 'Fri'], by: 'dad', created: -210, last: -4,
        prayed: { '-4': ['dad'] } },
      { id: 's006', title: 'Our neighbors, the Nguyens', for: 'The Nguyens', category: 'Neighbors', cadence: 'rotation', by: 'christian', created: -90, last: -6, prayed: { '-6': ['christian'] } },
      // sent from Elizabeth's own p003 (same who, category and cadence: the share copies them, apps/prayer.html:1314-1317)
      { id: 's007', title: "Mea's nursing exams", for: 'Mea', category: 'Schools and Students', by: 'mom', sharedFrom: 'p003', created: -9, last: -1,
        prayed: { '-1': ['mom'], '-9': ['ezra'] } },
      { id: 's008', title: 'Pastor Tim and Rebecca', for: 'Pastor Tim & Rebecca', category: 'Church Leadership', cadence: 'rotation', by: 'dad', created: -300, last: -13, prayed: { '-13': ['dad'] } },
      { id: 's009', title: 'A safe drive for Uncle Ben on Friday', for: 'Uncle Ben', category: 'Family', cadence: 'weekly', days: ['Fri'], by: 'mom', created: -2 },
      { id: 's010', title: "Kiara's ear infection", for: 'Kiara', category: 'Health Needs', by: 'christian', created: -50, last: -42, answered: -41,
        note: 'All clear at the check-up. She says her ear is "fixed."' },
      { id: 's011', title: 'Safe travels for Grandma Jo', for: 'Grandma Jo', category: 'Family', by: 'eli', created: -14, last: -4, answered: -3,
        note: 'She landed Saturday afternoon, right on time.' },
    ].map(row);
    writeList('family', null, {
      label: 'Family list', rows: fam, active: 'plFamily',
      plans: [plan('plFamily', 'Around the table')],     // not the default name, so a reset to defaults is visible
      days: [...run(-15, 0), ...run(-30, -18)],
    });

    // Feed lines in the app's own wording (apps/prayer.html:1606 'Prayed for …' (+ ' (family list)'), 1318, 1329).
    // Note the private-list lines: the app posts those titles to the family feed as well. Only a share from a private list
    // posts "Sent a request…" (1318); a request added straight to the family list (s009) posts nothing (1429-1443).
    h.activity('eli', 'prayer', 'Prayed for Ezra and Kiara settling into school', T('06:18'));
    h.activity('eli', 'prayer', "Prayed for Mae's job interview on Thursday", T('06:19'));
    h.activity('eli', 'prayer', 'Prayed for Our small group', T('06:21'));
    h.activity('mom', 'prayer', "Prayed for David's knee, and patience with the therapy", T('06:38'));
    h.activity('mom', 'prayer', "Prayed for Grandpa's knee to heal (family list)", T('06:52'));
    h.activity('mom', 'prayer', "Prayed for Grandma Jo's visit this week (family list)", T('06:53'));
    h.activity('ezra', 'prayer', "Prayed for Grandpa's knee to heal (family list)", T('07:31'));
    h.activity('ezra', 'prayer', "Prayed for Mae's job interview on Thursday (family list)", T('07:32'));
    h.activity('eli', 'prayer', "Sent a request to the family list: Mae's job interview on Thursday", h.time(-1, '21:10'));
    h.activity('mom', 'prayer', "Sent a request to the family list: Mea's nursing exams", h.time(-9, '19:05'));
    h.activity('eli', 'prayer', 'Answered: Safe travels for Grandma Jo', h.time(-3, '19:40'));
  }

  // ── overflow: long everything, many of everything ─────────────────────────────────────────────────────────────
  function overflow() {
    const LONG_CATS = [
      'Grandparents, Great-Grandparents and Extended Family Across Three States',
      'Homeschool Co-op Families and the Tuesday Morning Park Group',
      'Neighbors on Maple Street and the Whole Cul-de-sac',
      'Church Plant on the East Side and the Launch Team',
      'Little League Team, Coaches and Parents',
    ];
    const cats = [...CATEGORIES, ...LONG_CATS];
    // [title, category]: six very long titles, then thirty ordinary ones, each filed where a family would file it
    const LONG = [
      ['Healing, strength and a full recovery for Grandpa David after his knee replacement surgery and the long weeks of physical therapy ahead', LONG_CATS[0]],
      ['Wisdom, patience, gentleness and a steady joy for both of us as parents in a very full season of school, work, church and family', 'Marriage'],
      ['That the whole extended family would come together peacefully for Thanksgiving this year, with no arguments about the seating chart', LONG_CATS[0]],
      ['Protection, rest and encouragement for every missionary family our church supports on four continents, especially the ones far from home', 'Missionaries - Abroad'],
      ['A new job for Luke that uses his gifts, pays enough to support the family, and lets him be home for dinner most nights of the week', 'Work and Job Search'],
      ["Comfort and peace for Sam's mom in hospice, and for Sam and his brothers as they take turns sitting with her through the nights", 'Grief and Loss'],
    ];
    // Five more long ones, so the longer lists (Elizabeth's 24, the family's 32) never show the same request twice.
    const LONG2 = [
      ['Courage and kind words for Ezra and Kiara as they make new friends at school, share their toys and learn to be patient with each other', 'Children and Youth'],
      ['Safe roads, good weather and plenty of rest for everyone driving up to the family reunion at the lake cabin over the long weekend', 'Family'],
      ['Strength and wisdom for the doctors, nurses and therapists at the clinic across town who are caring for Grandpa David every week', 'Health Needs'],
      ['Open doors and warm conversations with the new neighbors on Maple Street, and a chance to have them over for supper this fall', LONG_CATS[2]],
      ['A calm and joyful Christmas season for the whole family this year, with time set aside every evening to remember why we celebrate', 'Praise and Thanksgiving'],
    ];
    const LONGS = [...LONG, ...LONG2];
    const SHORT = [
      ['Ezra and Kiara settling into school', 'Children and Youth'], ['Patience at home', 'Personal'], ['Our small group', 'Friends'],
      ['The Nguyen family next door', LONG_CATS[2]], ['Mae at the library', 'Work and Job Search'], ['Uncle Ray to come to faith', 'Those Who Are Lost - Family'],
      ['Wisdom for the city council', 'Government'], ['Hurricane relief volunteers', 'World and Disaster Relief'], ['Jonah and Priya, expecting in November', 'Expecting and New Parents'],
      ['Believers facing persecution', 'Persecuted Church'], ['The Carters in Peru', 'Missionaries - Abroad'], ['Pastor Tim and the church staff', 'Church Leadership'],
      ['Mea finishing nursing school', 'Schools and Students'], ['Our marriage', 'Marriage'], ['The youth group retreat', 'Children and Youth'],
      ['Coach Daniels and the team', LONG_CATS[4]], ['The new family at church', 'Friends'], ['Healing for Aunt Carol', 'Health Needs'],
      ['The homeschool co-op', LONG_CATS[1]], ['First responders in our town', 'Military and First Responders'], ['Wisdom for the school board', 'Schools and Students'],
      ['Our budget this fall', 'Financial Needs'], ['The church plant launch team', LONG_CATS[3]], ['Friends in the hospital this week', 'Health Needs'],
      ['The widows at church', 'Widows and Elderly'], ['Rain for the Fitzgerald farm', 'Praise and Thanksgiving'], ['Neighbors on Maple Street', LONG_CATS[2]],
      ['Thanks for a good harvest', 'Praise and Thanksgiving'], ['Peace for the Delacroix family', 'Family'], ['A safe winter for everyone', 'Nation'],
    ];
    const ANSWERED = [
      ['A job for Luke', 'Work and Job Search'], ['Wisdom about buying a minivan', 'Wisdom and Decisions'], ["A buyer for the Hendersons' house", LONG_CATS[2]],
      ['Healing for my shoulder', 'Health Needs'], ["The Parkers' adoption to be finalized", 'Friends'], ["Kiara's ear infection", 'Health Needs'],
      ['Safe travels for Grandma Jo', LONG_CATS[0]], ['A babysitter we trust', 'Family'], ['Rain after the long dry summer', 'Praise and Thanksgiving'],
      ["Mea's scholarship", 'Schools and Students'], ['A smooth closing on the lake cabin', 'Financial Needs'], ['Clear scans for Aunt Carol', 'Health Needs'],
      ['A reliable used car for the youth pastor', 'Church Leadership'], ['Peace between the cousins after the wedding', 'Family'], ['A church home for the Okafors', 'Friends'],
      ['Our tax refund in time for the roof repair', 'Financial Needs'], ['A good teacher for Ezra', 'Children and Youth'], ['The church roof fund', LONG_CATS[3]],
      ['Uncle Ben finding work', 'Work and Job Search'], ['A safe delivery for Hannah and the baby', 'Expecting and New Parents'], ['The visa for the Carters', 'Missionaries - Abroad'],
      ['Healing for Coach Daniels', LONG_CATS[4]], ['A quiet week at the hospital for Priya', 'Expecting and New Parents'], ['The adoption paperwork for the Lees', 'Friends'],
      ["A buyer for Grandpa's old tractor", LONG_CATS[0]], ['Wisdom about the move to Tennessee', 'Wisdom and Decisions'],
    ];
    const updatesPool = ['Called on Sunday. Still waiting on the test results but in good spirits.', 'Dropped off a meal. The kids helped make the card.',
      'Good news: the first round is done.', 'Asked us to keep praying for sleep.', 'Visited after church; we prayed together in the kitchen.',
      'A hard week. Tired, but thankful for everyone checking in.', 'Walking further every day.', 'Sent a text: "Thank you for praying, it means the world."'];
    const pick = (arr, i) => arr[Math.floor(i) % arr.length];
    // "Who is it for?" belongs to its request (the detail sheet, Pray now, the kitchen view and Copy all show it next to the title),
    // long where a family would write a long one; a request with no entry here has no "for".
    const FOR = {
      [LONG[0][0]]: 'Grandpa David Alexander Fitzgerald, and Grandma driving him to every appointment',
      [LONG[3][0]]: 'The Carters in Peru, the Hendersons in Kenya and the Morales family in the Philippines',
      [LONG[4][0]]: 'Luke, Hannah and the three little ones', [LONG[5][0]]: 'Sam, his brothers and their mom',
      [LONG2[1][0]]: 'Uncle Ben, Aunt Carol and all the cousins on the road', [LONG2[3][0]]: 'The Nguyens, the Pattersons and the new family across the street',
      'Wisdom for the city council': 'Mayor Delgado and the whole city council', 'Believers facing persecution': 'Brothers and sisters in the persecuted church around the world',
      'Mea finishing nursing school': 'Mea Rosalind Winterbottom', 'Coach Daniels and the team': 'Coach Daniels, the assistant coaches and the whole Little League team',
      'The homeschool co-op': 'Our friends in the Tuesday Morning Park Group', 'Peace for the Delacroix family': 'Dr. Marguerite Delacroix-Winterbottom and her family',
      'Ezra and Kiara settling into school': 'Ezra Bartholomew and Kiara Seraphina', 'Our small group': 'The Okafor, Lee, Parker and Nguyen families',
      'Mae at the library': 'Mae-Christiane Delacroix', 'Jonah and Priya, expecting in November': 'Jonah & Priya', 'The Carters in Peru': 'The Carters and their mission team',
      'The youth group retreat': 'Every student and leader going on the youth group retreat', 'The new family at church': 'The Okonkwo family, new at church this month',
      'Wisdom for the school board': 'Everyone on the county school board', 'The church plant launch team': 'Pastor Tim & Rebecca and the whole launch team',
      'Neighbors on Maple Street': 'Everyone on Maple Street and the whole cul-de-sac', 'Uncle Ray to come to faith': 'Uncle Ray',
      'Hurricane relief volunteers': 'The volunteers from church working on the coast this month', 'Pastor Tim and the church staff': 'Pastor Tim & Rebecca and the whole staff',
      'Healing for Aunt Carol': 'Aunt Carol', 'First responders in our town': 'The firefighters, paramedics and police officers in our town',
      'Friends in the hospital this week': 'Great-Aunt Wilhelmina Fairweather-Pennington and everyone on her hospital floor',
      'Rain for the Fitzgerald farm': 'The Fitzgerald cousins on the farm', "The new baby at the Lees' house": 'The Lees and baby Samuel',
      'A job for Luke': 'Luke, Hannah and the three little ones', "The Parkers' adoption to be finalized": 'The Parkers and little Grace',
      'Rain after the long dry summer': 'Every farm family in the county', 'A reliable used car for the youth pastor': 'Pastor Josh and his family',
      'A good teacher for Ezra': 'Ezra Bartholomew Anderson', 'The visa for the Carters': 'The Carters in Peru', "A buyer for Grandpa's old tractor": 'Grandpa David Alexander Fitzgerald',
    };
    const whoFor = title => FOR[title] || '';
    const LONG_DETAIL = 'Knee replacement on September 3, then physical therapy three mornings a week at the clinic across town. He is doing the exercises faithfully but the nights are hard and he is not sleeping well. Pray for rest, for the swelling to go down, for Grandma as she drives him to every appointment, and for his spirits, which dip in the afternoons when the house is quiet. He would love visitors on Saturdays.';
    const LONG_NOTE = 'Answered in a way none of us expected, and better than we asked. We told the kids the whole story at dinner and wrote it in the front of the family Bible so we remember it.';

    // Eli: 36 active (22 daily, 5 weekly incl. 4 on Tuesdays, 9 rotation, 4 of them over a month quiet → the review
    // nudge shows), 26 answered. Today: 22 + 4 + rotation 8 = 34; 11 prayed at 6:22-6:42 → "23 to pray · 11 done".
    // Titles: daily = the six long ones + SHORT[6..21], weekly = SHORT[22..26] (+ a long tail), rotation = SHORT[27..29, 0..5].
    // The prayed ones are daily 11-21, so the six long titles are still to pray: they head Today and Pray now (a prayed row sinks
    // below the rest: hub.list keeps the order rows were synced in, apps/hub.js:225-229).
    const eli = [];
    let n = 0;
    const id = () => 'p' + String(++n).padStart(3, '0');
    for (let i = 0; i < 22; i++) {
      const [title, category] = i < LONG.length ? LONG[i] : SHORT[i];
      const now = i >= 11;                                                         // prayed this morning
      eli.push({ id: id(), title, category, for: i % 3 === 0 ? whoFor(title) : '', phone: i % 5 === 0 ? '555-01' + String(10 + i).padStart(2, '0') : '',
        detail: i === 0 ? LONG_DETAIL : i % 2 ? 'A few words about this one so the detail line wraps onto a second line on a phone.' : '',
        created: -30 - i * 7, last: now ? 0 : -1 - (i % 3), at: now ? h.time(0, '06:' + String(i * 2).padStart(2, '0')) : undefined,
        updates: i === 0 ? updatesPool.map((u, k) => [-18 + k * 2, u]) : i % 4 === 1 ? [[-2 - i, pick(updatesPool, i)]] : [] });
    }
    for (let i = 0; i < 5; i++) {
      const [title, category] = SHORT[22 + i];
      eli.push({ id: id(), title: title + ' and everyone connected with it this autumn', category, cadence: 'weekly',
        days: i < 4 ? ['Sun', 'Tue', 'Thu', 'Sat'].slice(0, 2 + i % 3) : ['Mon', 'Fri'], created: -60 - i * 11, last: -2 - i });
    }
    for (let i = 0; i < 9; i++) {
      const [title, category] = pick(SHORT, 27 + i);
      eli.push({ id: id(), title, category, for: i % 2 ? whoFor(title) : '', cadence: 'rotation', created: -200 - i * 30, last: i < 4 ? -35 - i * 6 : -3 - i });
    }
    // answered: 26 over two years; p040 (i = 3) was answered a year ago today → an anniversary line on Today
    for (let i = 0; i < 26; i++) {
      const ago = i === 3 ? -365 : -2 - i * 23;
      const [title, category] = ANSWERED[i];
      eli.push({ id: id(), title: i % 3 === 0 ? title + ', and everything that came after it that we never thought to ask for' : title, category,
        for: i % 4 === 0 ? whoFor(title) : '', created: ago - 40, last: ago - 1, answered: ago, note: i % 2 ? LONG_NOTE : 'Yes, and on time.' });
    }
    writeList('person', 'eli', {
      label: 'My list', categories: cats, rows: eli.map(o => row({ by: 'eli', ...o })), active: 'plEliLong',
      plans: [plan('plEliLong', 'Everything, every single morning before the kids wake up', { rotationSize: 8 }),
        plan('plEliCommute', 'Weekday categories for the long commute', { mode: 'byDay', dayMap: { Mon: ['Family', 'Friends'], Tue: ['Nation', 'Government'] } }),
        plan('plEliMissions', 'Missions focus for the first Sunday of every month', { mode: 'focus', focusCategory: 'Missionaries - Abroad' })],
      days: run(-1203, 0),                                                         // "1204 days in a row"
    });
    h.person('eli', 'prayer', 'activeList', 'personal', h.time(-2, '21:00'));

    // Elizabeth: by-day plan grouped by category, every-day requests included; 24 requests, 8 prayed this morning.
    const mom = [];
    n = 0;
    for (let i = 0; i < 24; i++) {
      const [title, category] = i % 3 === 0 ? LONGS[i / 3] : SHORT[i + 3];            // 8 long + 16 short, all different
      mom.push({ id: id(), title, category, for: i % 2 ? whoFor(title) : '', cadence: i % 5 === 4 ? 'rotation' : 'daily',
        created: -20 - i * 9, last: i < 8 ? 0 : -1 - (i % 4), at: i < 8 ? h.time(0, '06:' + String(10 + i * 3).padStart(2, '0')) : undefined });
    }
    writeList('person', 'mom', {
      label: 'My list', categories: cats, rows: mom.map(o => row({ by: 'mom', ...o })), active: 'plMomDays',
      plans: [plan('plMomDays', 'By the day, grouped, with every-day requests', { mode: 'byDay', groupByCategory: true, dayMap: {
        Tue: ['Family', 'Widows and Elderly', 'Nation', LONG_CATS[0], LONG_CATS[2]], Sun: ['Missionaries - Abroad'] } })],
      days: run(-400, 0),
    });

    // Mae: as typical but more, still nothing scheduled on Tuesdays.
    const mae = [];
    n = 0;
    for (let i = 0; i < 12; i++) { const [title, category] = pick(SHORT, i + 11); mae.push({ id: id(), title, category, created: -10 - i * 5, last: -1 - (i % 5) }); }
    writeList('person', 'christian', {
      label: 'My list', categories: cats, rows: mae.map(o => row({ by: 'christian', ...o })), active: 'plMaeWeek',
      plans: [plan('plMaeWeek', 'Weekday categories', { mode: 'byDay', includeDaily: false, dayMap: { Mon: ['Children and Youth', 'Work and Job Search'], Wed: ['Friends', 'Family'] } })],
      days: run(-60, -1),
    });

    // Family: 32 requests (24 daily, 8 rotation), 6 answered; today's prayedBy carries up to 9 long names (faces then "+N").
    const everyone = ['mom', 'dad', 'eli', 'christian', 'ezra', 'kiara', 'guest-grandmajo', 'guest-pastor', 'guest-auntwil'];
    const askers = ['mom', 'eli', 'christian', 'dad', 'guest-grandmajo', 'guest-auntwil'];
    const fam = [];
    n = 0;
    const sid = () => 's' + String(++n).padStart(3, '0');
    for (let i = 0; i < 32; i++) {
      const who = i < 14 ? everyone.slice(0, 1 + (i * 5) % everyone.length) : [];
      // 11 long + 21 short, all different (SHORT has 30: the last short slot takes one of its own)
      const [title, category] = i % 3 === 0 ? LONGS[i / 3] : i < SHORT.length ? SHORT[i] : ["The new baby at the Lees' house", 'Expecting and New Parents'];
      const last = who.length ? 0 : -1 - (i % 6);
      // prayedBy's newest day is the row's lastPrayedAt (setPrayed writes both, apps/prayer.html:1596-1602); earlier days adults only
      const adults = ['mom', 'dad', 'eli', 'christian'].slice(0, 1 + i % 4);
      fam.push({ id: sid(), title, category, for: i % 2 ? whoFor(title) : '', cadence: i >= 24 ? 'rotation' : 'daily', by: pick(askers, i),
        sharedFrom: i === 0 ? 'p001' : null,                                         // Elizabeth's p001 (the same title), sent five days ago
        created: -5 - i * 8, last, at: who.length ? h.time(0, '07:' + String(i * 3).padStart(2, '0')) : undefined,
        prayed: who.length ? { 0: who, '-1': adults, '-2': ['dad'] } : { [last]: adults, [last - 1]: ['dad'] },
        updates: i % 5 === 0 ? [[-3, pick(updatesPool, i)]] : [] });
    }
    for (let i = 0; i < 6; i++) {
      const [title, category] = ANSWERED[i * 4];
      fam.push({ id: sid(), title, category, for: whoFor(title), by: pick(askers, i + 2),
        created: -60 - i * 30, last: -20 - i * 30, answered: -19 - i * 30, note: 'Answered, and the whole family was there to see it. We wrote it on the fridge calendar.' });
    }
    writeList('family', null, {
      label: 'Family list', categories: cats, rows: fam.map(row), active: 'plFamily',
      plans: [plan('plFamily', 'Everything the whole family is carrying this season', { rotationSize: 6 })],
      days: run(-700, 0),
    });

    // Feed: one line for every prayer the rows record this morning, in the app's wording (apps/prayer.html:1606): Eli's and
    // Elizabeth's own lists, then each name on a family row's prayedBy[today] a minute apart up to the row's time (~80 lines).
    const feed = [];
    for (const [pid, list] of [['eli', eli], ['mom', mom]]) for (const o of list) if (o.last === 0) feed.push([pid, 'Prayed for ' + o.title, o.at]);
    for (const o of fam) {
      const who = (o.prayed && o.prayed[0]) || [];
      who.forEach((pid, k) => feed.push([pid, 'Prayed for ' + o.title + ' (family list)', o.at - (who.length - 1 - k) * 60000]));
    }
    for (const [pid, text, at] of feed.sort((a, b) => a[2] - b[2])) h.activity(pid, 'prayer', text, at);
    // s001 is Elizabeth's own p001 sent to the family list five days ago (1318); Eli's newest answer is two days old (1329).
    h.activity('mom', 'prayer', 'Sent a request to the family list: ' + fam[0].title, h.time(-5, '21:10'));
    const lastAnswer = eli.filter(o => o.answered != null).sort((a, b) => b.answered - a.answered)[0];
    h.activity('eli', 'prayer', 'Answered: ' + lastAnswer.title, h.time(lastAnswer.answered, '19:40'));
  }
}
