// Skeptic #1 for critic-sunday-nudge-says-gone-quiet-6: does Today say "Some of the list has gone quiet" on a Sunday
// when reviewItems() has nothing cold (and Record then says the list is current)? Control: the same profiles on Saturday.
// Run: node "audits/tools/phase3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-1.mjs"
//   -> audits/evidence/p3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-1.json (+ one PNG)
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const TAG = 'verify-critic-sunday-nudge-says-gone-quiet-6-1';
const res = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const days = { saturday: DEMO + 4 * 86400000, sunday: DEMO + 5 * 86400000 };   // demo = Tue 22 Sep 2026 08:40 NY
  for (const [label, t] of Object.entries(days)) {
    for (const p of ['christian', 'niece']) {
      const d = await L.device({ device: 'iphone-pwa', profile: p, fixedTime: t });
      const f = await d.openApp('prayer', { wait: '#todayLine' });
      await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 });
      await sleep(1500);
      const r = await f.evaluate(() => {
        const r = reviewItems();
        return { day: new Date().toString().slice(0, 24), getDay: new Date().getDay(), list: D.activeList,
          active: L().prayers.filter(x => x.status === 'active').length,
          cold: r.cold.length, silent: r.silent.length, fresh: r.fresh.length, reviewDue: reviewDue(),
          showReview: PL().show.review,
          prompt: document.getElementById('reviewPrompt').innerText.replace(/\s+/g, ' ').trim(),
          todayLine: document.getElementById('todayLine').textContent };
      });
      if (r.prompt) {
        if (label === 'sunday' && p === 'christian') await d.shot(`${OUT}/${TAG}-christian-sunday.png`);
        await f.click('#reviewPrompt [data-go="answered"]'); await sleep(700);
        r.afterSeeWhat = await f.evaluate(() => ({ reviewOpen: document.getElementById('reviewWrap').open,
          reviewBody: document.getElementById('reviewBody').innerText.replace(/\s+/g, ' ').slice(0, 160),
          reviewCount: document.getElementById('reviewCount').textContent }));
      }
      res[`${p}-${label}`] = r;
      console.log(`${p} ${label}:`, JSON.stringify(r));
      await d.close();
    }
  }
} catch (e) { res.error = String(e.stack || e); console.log(res.error); }
finally { fs.writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(res, null, 2)); await L.close(); }
