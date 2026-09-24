// Skeptic #1 for finding "review-double-count": does the Record's "Needs attention" badge count a request twice,
// and does the rendered list show the same request under two headings? Reads the DOM only (not reviewItems()).
// Run: node "audits/tools/phase3/prayer/verify-review-double-count-1.mjs"
//   -> audits/evidence/p3/prayer/verify-review-double-count-1.json + verify-review-double-count-1-iphone.png
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 });
  await sleep(800);
  await f.click('nav [data-go="answered"]'); await sleep(400);
  await f.evaluate(() => { document.getElementById('reviewWrap').open = true; }); await sleep(300);
  Object.assign(res, await f.evaluate(() => {
    const body = document.getElementById('reviewBody');
    const sections = []; let cur = null;
    for (const n of body.children) {
      if (n.tagName === 'H3') { cur = { heading: n.textContent, rows: [] }; sections.push(cur); }
      if (n.tagName === 'UL' && cur) cur.rows = [...n.querySelectorAll(':scope > li')].map(li => {
        const t = li.querySelector('[data-open]'); return { id: t ? t.dataset.open : null, text: li.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) };
      });
    }
    const ids = sections.flatMap(s => s.rows.map(r => r.id));
    const dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
    const P = D.lists.personal.prayers;
    return {
      activeList: D.activeList,
      badge: document.getElementById('reviewCount').textContent,
      summary: document.querySelector('#reviewWrap > summary').textContent.replace(/\s+/g, ' ').trim(),
      sections: sections.map(s => ({ heading: s.heading, n: s.rows.length, ids: s.rows.map(r => r.id) })),
      rowsRendered: ids.length, distinct: new Set(ids).size,
      duplicates: dup.map(id => { const p = P.find(x => x.id === id); return { id, title: p.title, createdAt: p.createdAt, lastPrayedAt: p.lastPrayedAt, updates: p.updates.length, lastUpdate: p.updates.length ? p.updates[p.updates.length - 1].date : null, headings: sections.filter(s => s.rows.some(r => r.id === id)).map(s => s.heading) }; })
    };
  }));
  await f.evaluate(() => document.getElementById('reviewWrap').scrollIntoView());
  await d.shot(`${OUT}/verify-review-double-count-1-iphone.png`);
  await d.close();
} catch (e) { res.error = String(e && e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(`${OUT}/verify-review-double-count-1.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
