// Skeptic #1 for critic-untick-keeps-day-5: does an undone tick leave TODAY in prayerDays (streak / month / calendar)?
// Fresh local instance, demo clock, WebKit, iPhone PWA as Mae (christian). Opens the category group by tapping its
// <summary> (real UI), taps a row's circle, re-opens the group, taps the same circle again, then reloads the app to
// check persistence, and reads the server's person-scope prayerDays row.
// Run: node "audits/tools/phase3/prayer/verify-critic-untick-keeps-day-5-1.mjs"
//   -> audits/evidence/p3/prayer/verify-critic-untick-keeps-day-5-1.json (+ -calendar.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'christian' });
  const open = async () => {
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 });
    await sleep(800); return f;
  };
  let f = await open();
  const read = fr => fr.evaluate(() => ({ TODAY, daysHasToday: D.lists.personal.prayerDays.includes(TODAY),
    lastDays: D.lists.personal.prayerDays.slice(-5), streak: currentStreak(), month: monthDays(),
    anyTickedToday: D.lists.personal.prayers.some(p => p.lastPrayedAt === TODAY),
    strip: document.getElementById('todayStrip').innerText.replace(/\s+/g, ' ').trim() }));
  log('before', await read(f));
  await f.click('nav [data-go="all"]'); await sleep(400);
  const id = await f.evaluate(() => D.lists.personal.prayers.find(p => p.status === 'active').id);
  const tapSummaryIfClosed = async () => {
    const closed = await f.evaluate(id => !document.querySelector(`#allList [data-pray="${id}"]`).closest('details').open, id);
    if (closed) { await f.evaluate(id => document.querySelector(`#allList [data-pray="${id}"]`).closest('details').querySelector('summary').setAttribute('data-vc', '1'), id);
      await f.click('#allList summary[data-vc="1"]'); await sleep(300); }
    return closed;
  };
  log('groupWasClosedBeforeTick', await tapSummaryIfClosed());
  await f.click(`#allList [data-pray="${id}"]`); await sleep(600);
  log('afterTick', { ...(await read(f)), row: await f.evaluate(id => D.lists.personal.prayers.find(p => p.id === id).lastPrayedAt, id) });
  log('groupWasClosedBeforeUntick', await tapSummaryIfClosed());
  await f.click(`#allList [data-pray="${id}"]`); await sleep(3500);
  log('afterUntick', { ...(await read(f)), row: await f.evaluate(id => D.lists.personal.prayers.find(p => p.id === id).lastPrayedAt, id) });
  const srv = await L.apiAs('christian', '/api/data/prayer?scope=person');
  const pd = (srv.body.items || []).find(i => i.key === 'prayerDays');
  log('server', { prayerDaysTail: pd && pd.value.slice(-5), hasToday: !!(pd && pd.value.includes(res.before.TODAY)) });
  // reload: a fresh open must still show the same (persisted, not a stale in-memory view)
  await d.goto('#home'); await sleep(500);
  f = await open();
  log('afterReopen', await read(f));
  await f.click('nav [data-go="answered"]'); await sleep(500);
  log('record', await f.evaluate(() => ({ text: document.getElementById('record').innerText.replace(/\s+/g, ' ').slice(0, 120),
    todayCellOn: !!document.querySelector('#record span.on.today, #record span.today.on') })));
  await d.shot(`${OUT}/verify-critic-untick-keeps-day-5-1-record.png`);
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/verify-critic-untick-keeps-day-5-1.json`, JSON.stringify(res, null, 2)); await L.close(); }
