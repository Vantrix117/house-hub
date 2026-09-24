// Skeptic #2 for "other-timezone-date": does a phone outside New York file a family "prayed" mark under its own local
// date, and does the New York TV then leave that person off "who prayed today"? Two travellers, both as Mea (niece, adult; the seed has no prayed mark from her on either date, unlike David):
//   west: Los Angeles, Tue 22 Sep 22:30 PDT (= Wed 23 Sep 01:30 New York)
//   east: London,      Wed 23 Sep 03:00 BST (= Tue 22 Sep 22:00 New York, when the TV is plausibly watched)
// For each: move the Worker clock to that instant, open Prayer on an iPhone whose timezoneId is the traveller's, switch
// to the family list, tap one request Mea has not prayed, read the stored row, then open the TV board (New York) at
// the same instant and read #tv-prayed. Chat's mark_prayed (worker/src/chat.js:112, 244-246) files under the New York
// date by design, so the NY date is also what the Worker would have written for the same action.
// Run: node "audits/tools/phase3/prayer/verify-other-timezone-date-2.mjs"
//   -> audits/evidence/p3/prayer/verify-other-timezone-date-2.json (+ -tv-east.png, 1x)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {}; const WHO = 'Mea';
const cases = [
  { name: 'west', tz: 'America/Los_Angeles', at: '2026-09-22T22:30:00-07:00' },
  { name: 'east', tz: 'Europe/London', at: '2026-09-23T03:00:00+01:00' },
];
try {
  for (const c of cases) {
    await L.reset('typical');
    const at = Date.parse(c.at);
    const nyDate0 = new Date(at).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const pre = await L.apiAs("eli", "/api/data/prayer?scope=family");
    const whoOnNyDateBefore = (pre.body.items || []).some(i => i.key.startsWith("prayer:") && i.value && i.value.prayedBy && (i.value.prayedBy[nyDate0] || []).includes(WHO));
    await L.clock(new Date(at).toISOString());
    const orig = L.browser.newContext.bind(L.browser);
    L.browser.newContext = o => orig({ ...o, timezoneId: c.tz });
    const d = await L.device({ device: 'iphone-pwa', profile: 'niece', fixedTime: at });
    L.browser.newContext = orig;
    await d.goto('#home');
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 });
    await sleep(800);
    await f.click('#listSwitch [data-list="shared"]'); await sleep(400);
    const id = await f.evaluate(who => { const p = todaySet().find(p => !Object.values(p.prayedBy || {}).some(v => (v || []).includes(who))); return p && p.id; }, WHO);
    await f.click(`#todayList [data-pray="${id}"]`); await sleep(2000);
    const phone = await f.evaluate(() => ({ TODAY, local: new Date().toString().slice(0, 33) }));
    const srv = await L.apiAs('niece', '/api/data/prayer?scope=family');
    const row = srv.body.items.find(i => i.key === 'prayer:' + id).value;
    const nyDate = new Date(at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const keysWithWho = Object.entries(row.prayedBy || {}).filter(([, v]) => (v || []).includes(WHO)).map(([k]) => k);
    await d.close();
    const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: at });
    await tv.goto('#home'); await sleep(3000);
    const tvState = await tv.page.evaluate(() => { const e = document.getElementById('tv-prayed'); return { text: e ? e.textContent.replace(/\s+/g, ' ').trim() : null, clock: (document.querySelector('#tv-clock, .tv-clock') || {}).textContent || null }; });
    if (c.name === 'east') await tv.shot(`${OUT}/verify-other-timezone-date-2-tv-east.png`);
    await tv.close();
    res[c.name] = { tz: c.tz, whoOnNyDateBefore, instant: new Date(at).toISOString(), phone, nyDate, row: id, keysWithWho, rowLastPrayedAt: row.lastPrayedAt, whoOnNyDate: (row.prayedBy[nyDate] || []).includes(WHO), tvPrayed: tvState.text, tvShowsWho: new RegExp(WHO).test(tvState.text || '') };
    console.log(c.name, JSON.stringify(res[c.name]));
  }
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/verify-other-timezone-date-2.json`, JSON.stringify(res, null, 1)); await L.close(); }
