// Skeptic check for Prayer finding "other-timezone-date": a phone outside New York files a family prayed mark under
// its own local date (apps/prayer.html:711-712 TODAY = device-local date; 1598-1602 writes prayedBy[TODAY]) while the
// New York TV reads prayedBy[dayKey(now)] (index.html:834, 1059).
// One instant: Wed 23 Sep 2026 01:30 New York = Tue 22 Sep 22:30 Los Angeles. The Worker's demo clock is moved there too.
//   A) David's phone in America/Los_Angeles taps a family request he has never prayed.
//   B) Control: Elizabeth's phone in America/New_York taps a different family request at the same instant.
//   C) The Downstairs TV (New York) opens Home: which names does "Prayed today" show?
// Run: node "audits/tools/phase3/prayer/verify-other-timezone-date-1.mjs"
//   -> audits/evidence/p3/prayer/verify-other-timezone-date-1.json (+ -tv.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const AT = Date.parse('2026-09-23T01:30:00-04:00');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = { instant: new Date(AT).toISOString() };
async function withTz(tz, fn) { const orig = L.browser.newContext.bind(L.browser); L.browser.newContext = o => orig({ ...o, timezoneId: tz }); try { return await fn(); } finally { L.browser.newContext = orig; } }
async function tapFamily(profile, tz, who) {
  const d = await withTz(tz, () => L.device({ device: 'iphone-pwa', profile, fixedTime: AT }));
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 });
  await sleep(600);
  await f.click('#listSwitch [data-list="shared"]'); await sleep(400);
  const info = await f.evaluate(w => {
    const row = todaySet().find(p => !Object.values(p.prayedBy || {}).some(v => (v || []).some(n => String(n).startsWith(w))));
    return { TODAY, localClock: new Date().toString().slice(0, 33), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, id: row && row.id, title: row && row.title };
  }, who);
  await f.click(`#todayList [data-pray="${info.id}"]`); await sleep(2000);
  const srv = await L.apiAs(profile, '/api/data/prayer?scope=family');
  const row = srv.body.items.find(i => i.key === 'prayer:' + info.id).value;
  info.serverKeysWithName = Object.entries(row.prayedBy || {}).filter(([, v]) => v.some(n => String(n).startsWith(who))).map(([k]) => k);
  info.serverPrayedBy = row.prayedBy;
  await d.close();
  return info;
}
try {
  res.workerClock = await L.clock(new Date(AT).toISOString());
  res.A_david_LA = await tapFamily('dad', 'America/Los_Angeles', 'David');
  console.log('A David LA', JSON.stringify({ ...res.A_david_LA, serverPrayedBy: undefined }));
  res.B_elizabeth_NY = await tapFamily('mom', 'America/New_York', 'Elizabeth');
  console.log('B Elizabeth NY', JSON.stringify({ ...res.B_elizabeth_NY, serverPrayedBy: undefined }));
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: AT });
  await tv.goto('#home');
  await tv.page.waitForSelector('#tv-prayed', { timeout: 15000 }); await sleep(4000);
  res.C_tv = await tv.page.evaluate(() => ({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, clock: new Date().toString().slice(0, 33),
    prayedText: document.getElementById('tv-prayed').innerText.replace(/\s+/g, ' ').trim(),
    dateText: (document.querySelector('.tv-date, #tv-date') || {}).textContent || null }));
  res.C_tv.showsDavid = /David/.test(res.C_tv.prayedText); res.C_tv.showsElizabeth = /Elizabeth/.test(res.C_tv.prayedText);
  await tv.shot(`${OUT}/verify-other-timezone-date-1-tv.png`);
  console.log('C TV', JSON.stringify(res.C_tv));
  res.tvLogs = tv.logs.filter(l => /error/i.test(l)).slice(0, 10);
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/verify-other-timezone-date-1.json`, JSON.stringify(res, null, 1)); await L.close(); }
