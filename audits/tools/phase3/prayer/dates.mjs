// Prayer's date maths across the 2026-11-01 DST change in New York, and on a device in another time zone.
// dObj() pins every date to local noon and daysSince() rounds (apps/prayer.html:713-715), so a 23 h / 25 h day still
// counts as one. Part 1 evaluates the app's own functions on a page whose clock is fixed on Mon 2 Nov 2026 08:00 New York,
// with a synthetic in-memory prayerDays (nothing saved). Part 2 opens Prayer as David on a phone set to Los Angeles at
// Tue 22 Sep 22:30 PDT (= Wed 01:30 New York) and taps a family request: the mark is filed under the phone's local date.
// Midnight while open is P2-STAB-03 (not re-tested here).
// Demo clock: the seed's "today" is Tue 22 Sep 2026 (New York), so the phone's evening is still the seed's today.
// Run: node "audits/tools/phase3/prayer/dates.mjs" -> audits/evidence/p3/prayer/dates.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
async function open(opts) { const d = await L.device({ device: 'iphone-pwa', ...opts }); const f = await d.openApp('prayer', { wait: '#todayLine' }); await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(600); return { d, f }; }
try {
  for (const at of ['2026-11-02T08:00:00-05:00', '2026-11-01T01:30:00-04:00', '2026-11-01T01:30:00-05:00', '2026-11-01T23:59:00-05:00']) {
    const { d, f } = await open({ profile: 'eli', fixedTime: Date.parse(at) });
    const r = await f.evaluate(() => {
      const keep = L().prayerDays; L().prayerDays = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'].filter(x => x <= TODAY);
      const out = { TODAY, back1: shift(TODAY, -1), back2: shift(TODAY, -2), daysSince_1030: daysSince('2026-10-30'), streak: currentStreak(), longest: longestStreak(), monthDays: monthDays(),
        calLeadingBlanks: (calendarHTML().match(/class="blank"/g) || []).length, calDayCells: (calendarHTML().match(/<span class="(?!blank)/g) || []).length };
      L().prayerDays = keep; return out;
    });
    res['dst ' + at] = r; console.log('DST', at, JSON.stringify(r));
    await d.close();
  }
  // Part 2: a phone in Los Angeles
  const orig = L.browser.newContext.bind(L.browser);
  L.browser.newContext = o => orig({ ...o, timezoneId: 'America/Los_Angeles' });
  const at = Date.parse('2026-09-22T22:30:00-07:00');
  const { d, f } = await open({ profile: 'dad', fixedTime: at });
  L.browser.newContext = orig;
  await f.click('#listSwitch [data-list="shared"]'); await sleep(300);
  const id = await f.evaluate(() => todaySet().find(p => !Object.values(p.prayedBy || {}).some(v => v.includes('David'))).id);   // a row David never prayed
  await f.click(`#todayList [data-pray="${id}"]`); await sleep(1500);
  const srv = await L.apiAs('dad', '/api/data/prayer?scope=family');
  const row = srv.body.items.find(i => i.key === 'prayer:' + id).value;
  const la = await f.evaluate(() => ({ TODAY, local: new Date().toString().slice(0, 24) }));
  const ny = new Date(at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  res.timezone = { phone: la, newYorkDate: ny, keysWithDavid: Object.entries(row.prayedBy).filter(([, v]) => v.includes('David')).map(([k]) => k), onNewYorkTodayList: (row.prayedBy[ny] || []).includes('David') };
  console.log('TZ', JSON.stringify(res.timezone));
  await d.close();
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/dates.json`, JSON.stringify(res, null, 1)); await L.close(); }
