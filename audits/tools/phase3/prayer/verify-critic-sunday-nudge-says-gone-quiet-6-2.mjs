// Skeptic #2 for critic-sunday-nudge-says-gone-quiet-6: on a Sunday, Today's review nudge claims
// "Some of the list has gone quiet" (apps/prayer.html:911-913) because reviewDue() is true every Sunday (:803-806),
// even when reviewItems() has nothing cold/silent/fresh. Control: the Saturday before (no nudge expected).
// Run: node "audits/tools/phase3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-2.mjs"
//   -> audits/evidence/p3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-2.json (+ one PNG)
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const NAME = 'verify-critic-sunday-nudge-says-gone-quiet-6-2';
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const days = { saturday: DEMO + 4 * 86400000, sunday: DEMO + 5 * 86400000 };   // Sat 26 / Sun 27 Sep 2026 08:40 NY
  for (const p of ['christian', 'niece']) {
    for (const [label, t] of Object.entries(days)) {
      const d = await L.device({ device: 'iphone-pwa', profile: p, fixedTime: t });
      const f = await d.openApp('prayer', { wait: '#todayLine' });
      await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 });
      await sleep(800);
      const r = await f.evaluate(() => {
        const r = reviewItems();
        return { day: new Date().toDateString(), dow: new Date().getDay(), cold: r.cold.length, silent: r.silent.length, fresh: r.fresh.length,
          reviewDue: reviewDue(), showReview: PL().show.review,
          prompt: document.getElementById('reviewPrompt').innerText.replace(/\s+/g, ' ').trim(),
          todayList: document.getElementById('todayList').innerText.replace(/\s+/g, ' ').trim().slice(0, 120) };
      });
      log(`${p}-${label}`, r);
      if (label === 'sunday' && r.prompt) {
        if (p === 'christian') await d.shot(`${OUT}/${NAME}-christian-sunday-today.png`);
        await f.click('#reviewPrompt [data-go="answered"]'); await sleep(600);
        log(`${p}-${label}-seeWhat`, await f.evaluate(() => ({ reviewOpen: document.getElementById('reviewWrap').open,
          body: document.getElementById('reviewBody').innerText.replace(/\s+/g, ' ').trim().slice(0, 160),
          badge: document.getElementById('reviewCount').textContent })));
      }
      await d.close();
    }
  }
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(res, null, 2)); await L.close(); }
