// Skeptic #2 for "category-count-mismatch": the Settings category row count vs the Remove confirm count.
// Fresh local instance, typical seed, demo clock, WebKit, Eli on iPhone PWA. Cancels the confirm (no data changed).
// Run: node "audits/tools/phase3/prayer/verify-category-count-mismatch-2.mjs"
//   -> audits/evidence/p3/prayer/verify-category-count-mismatch-2.json (+ .png of the open confirm)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 });
  await sleep(600);
  await f.click('nav [data-go="more"]'); await sleep(400);
  const rows = await f.evaluate(() => [...document.querySelectorAll('.catrow')].map(r => {
    const name = L().categories[+r.querySelector('[data-delcat]').dataset.delcat];
    const inCat = L().prayers.filter(p => p.category === name);
    return { name, idx: r.querySelector('[data-delcat]').dataset.delcat, rowText: r.firstElementChild.textContent.replace(/\s+/g, ' ').trim(),
      active: inCat.filter(p => p.status === 'active').length, answered: inCat.filter(p => p.status === 'answered').length,
      other: inCat.filter(p => p.status !== 'active' && p.status !== 'answered').length };
  }));
  res.mismatchedRows = rows.filter(r => r.answered > 0);
  res.allRowsCount = rows.length;
  const hn = rows.find(r => r.name === 'Health Needs');
  res.healthNeeds = hn;
  await f.click(`[data-delcat="${hn.idx}"]`); await sleep(400);
  res.confirmText = await f.evaluate(() => document.querySelector('.ask .line').textContent);
  res.answeredInHealthNeeds = await f.evaluate(() => L().prayers.filter(p => p.category === 'Health Needs' && p.status === 'answered').map(p => ({ id: p.id, title: p.title })));
  await d.shot(`${OUT}/verify-category-count-mismatch-2.png`);
  await f.click('#askCancel'); await sleep(200);
  fs.writeFileSync(`${OUT}/verify-category-count-mismatch-2.json`, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
} finally { await L.close(); }
