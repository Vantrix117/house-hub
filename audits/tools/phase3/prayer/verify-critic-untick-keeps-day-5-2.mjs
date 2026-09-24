// Skeptic #2 for critic-untick-keeps-day-5: does undoing a tick leave TODAY in prayerDays?
// Independent path from skeptic 1: the TODAY screen's own circle (data-pray inside #todayList), personal list.
// The seeded adults with a Today set (mom, eli) have already prayed today, so as Dad (empty list, no prayerDays) the
// script adds one request through the real Add screen (nav Add -> #f-title -> #f-save, daily cadence), then taps its
// circle on Today twice. Reads the server row and re-opens the app to prove persistence.
// Fresh local instance, demo clock, WebKit, iPhone PWA.
// Run: node "audits/tools/phase3/prayer/verify-critic-untick-keeps-day-5-2.mjs"
//   -> audits/evidence/p3/prayer/verify-critic-untick-keeps-day-5-2.json (+ -today.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const read = fr => fr.evaluate(() => ({ TODAY, activeList: D.activeList,
    daysHasToday: D.lists[D.activeList].prayerDays.includes(TODAY), streak: currentStreak(), month: monthDays(),
    anyTickedToday: D.lists[D.activeList].prayers.some(p => p.lastPrayedAt === TODAY),
    todayMarks: document.querySelectorAll('#todayList [data-pray]').length,
    strip: document.getElementById('todayStrip').innerText.replace(/\s+/g, ' ').trim() }));
  const open = async d => {
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 });
    await sleep(800); return f;
  };
  const d = await L.device({ device: 'iphone-pwa', profile: 'dad' });
  let f = await open(d);
  log('before', await read(f));
  await f.click('nav [data-go="add"]'); await sleep(400);
  await f.fill('#f-title', 'Safe travel for the Millers'); await f.click('#f-save'); await sleep(1500);
  log('afterAdd', await read(f));
  const id = await f.evaluate(() => document.querySelector('#todayList [data-pray]').dataset.pray);
  const pressed = () => f.evaluate(id => document.querySelector(`#todayList [data-pray="${id}"]`)?.getAttribute('aria-pressed'), id);
  await f.click(`#todayList [data-pray="${id}"]`); await sleep(700);
  log('afterTick', { ...(await read(f)), pressed: await pressed() });
  await f.click(`#todayList [data-pray="${id}"]`); await sleep(3500);
  log('afterUntick', { ...(await read(f)), pressed: await pressed(),
    row: await f.evaluate(id => D.lists.personal.prayers.find(p => p.id === id).lastPrayedAt, id) });
  await d.shot(`${OUT}/verify-critic-untick-keeps-day-5-2-today.png`);
  const srv = await L.apiAs('dad', '/api/data/prayer?scope=person');
  const items = srv.body.items || [];
  const pd = items.find(i => i.key === 'prayerDays');
  const row = items.find(i => i.key === 'prayer:' + id);
  log('server', { prayerDays: pd && pd.value, rowLastPrayedAt: row && row.value.lastPrayedAt });
  await d.goto('#home'); await sleep(500);
  f = await open(d);
  log('afterReopen', await read(f));
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/verify-critic-untick-keeps-day-5-2.json`, JSON.stringify(res, null, 2)); await L.close(); }
