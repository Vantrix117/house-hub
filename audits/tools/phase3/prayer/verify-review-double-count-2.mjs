// Skeptic #2 for finding "review-double-count": does Record > "Needs attention" list one request twice and
// does its badge count it twice? Reads the rendered DOM (not reviewItems()) on a fresh typical instance.
// Run: node "audits/tools/phase3/prayer/verify-review-double-count-2.mjs"
//   -> audits/evidence/p3/prayer/verify-review-double-count-2.json (+ .png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 });
  await sleep(600);
  await f.click('nav [data-go="answered"]'); await sleep(400);
  await f.evaluate(() => { document.getElementById('reviewWrap').open = true; }); await sleep(300);
  log('dom', await f.evaluate(() => {
    const body = document.getElementById('reviewBody');
    const sections = [...body.querySelectorAll('h3')].map(h => {
      const ul = h.nextElementSibling && h.nextElementSibling.nextElementSibling;
      const rows = ul ? [...ul.querySelectorAll('[data-open]')].map(r => r.dataset.open) : [];
      return { heading: h.textContent, ids: [...new Set(rows)] };
    });
    const all = sections.flatMap(s => s.ids);
    const dupIds = [...new Set(all.filter((x, i) => all.indexOf(x) !== i))];
    const title = id => (L().prayers.find(p => p.id === id) || {}).title;
    return {
      badge: document.getElementById('reviewCount').textContent,
      summary: document.querySelector('#reviewWrap > summary').textContent.replace(/\s+/g, ' ').trim(),
      sections: sections.map(s => ({ heading: s.heading, n: s.ids.length, titles: s.ids.map(title) })),
      rowsListed: all.length, distinct: new Set(all).size,
      listedTwice: dupIds.map(id => ({ id, title: title(id),
        lastPrayedAt: L().prayers.find(p => p.id === id).lastPrayedAt, createdAt: L().prayers.find(p => p.id === id).createdAt,
        updates: L().prayers.find(p => p.id === id).updates.length })),
      reviewDue: reviewDue(), clock: new Date().toString()
    };
  }));
  const top = await f.evaluate(() => document.getElementById('reviewWrap').getBoundingClientRect().top + scrollY);
  await f.evaluate(y => window.scrollTo(0, Math.max(0, y - 20)), top); await sleep(300);
  await d.page.screenshot({ path: `${OUT}/verify-review-double-count-2-iphone.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
  await d.close();
} catch (e) { log('error', String(e && e.stack || e)); }
finally {
  fs.writeFileSync(`${OUT}/verify-review-double-count-2.json`, JSON.stringify(res, null, 2));
  await L.close();
}
