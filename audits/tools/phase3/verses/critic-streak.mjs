// Completeness critic, Verses: does a day with nothing due break the day streak?
// dayStreak() counts consecutive days with >= 1 rating in verses.log (apps/verses.html:235); a rating is possible only
// for a due verse or through "Practise one anyway" (apps/verses.html:290-306, 366-371). Elizabeth (mom) has 75
// memorised verses, 0 due on Tue 22 Sep and a seeded log run ending Mon 21 Sep.
// Run: node "audits/tools/phase3/verses/critic-streak.mjs"
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
import { openVerses, state, serverRow } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const tue = Date.parse('2026-09-22T08:40:00-04:00');
  const d1 = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: tue });
  const f1 = await openVerses(d1);
  const s1 = await state(f1);
  out.tue = { today: s1.today, who: s1.who, doneBig: s1.doneBig, doneSub: s1.doneSub, stats: s1.stats, again: s1.again, dueIds: await f1.evaluate(() => window.verses.dueIds()) };
  const lg = (await serverRow(L, 'mom', 'verses', 'log')).value;
  out.logLastDays = Object.keys(lg).sort().slice(-4);
  await d1.close();
  // next days, nothing rated on Tuesday (there was nothing due)
  for (const [label, iso] of [['wed', '2026-09-23T08:40:00-04:00'], ['thu', '2026-09-24T08:40:00-04:00']]) {
    await L.clock(iso);
    const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: Date.parse(iso) });
    const f = await openVerses(d);
    const s = await state(f);
    out[label] = { today: s.today, who: s.who, doneBig: s.doneBig, stats: s.stats, dueCount: (await f.evaluate(() => window.verses.dueIds())).length, summaryStreak: (await f.evaluate(() => window.verses.summary())).streak };
    if (label === 'wed') { await d.page.screenshot({ path: 'audits/evidence/p3/verses/critic-streak-wed-iphone.png', scale: 'css' }); }
    await d.close();
  }
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync('audits/evidence/p3/verses/critic-streak.json', JSON.stringify(out, null, 1));
} finally { await L.close(); }
