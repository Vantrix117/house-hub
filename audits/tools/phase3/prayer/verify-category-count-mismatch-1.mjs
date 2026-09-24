// Skeptic #1 for "category-count-mismatch": does the category row count differ from the Remove confirm count?
// Fresh local instance, typical seed, demo clock, Eli on iPhone PWA, personal list, More (Settings) screen.
// Run: node "audits/tools/phase3/prayer/verify-category-count-mismatch-1.mjs"
//   -> audits/evidence/p3/prayer/verify-category-count-mismatch-1.json + -row.png + -confirm.png
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const P = OUT + '/verify-category-count-mismatch-1';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v)); };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(800);
  await f.click('nav [data-go="more"]'); await sleep(400);
  const rows = await f.evaluate(() => [...document.querySelectorAll('.catrow')].map(r => {
    const name = r.querySelector('[data-delcat]') ? L().categories[+r.querySelector('[data-delcat]').dataset.delcat] : null;
    const all = L().prayers.filter(p => p.category === name);
    return { name, rowText: r.textContent.replace(/\s+/g, ' ').trim(), shownCount: +(r.querySelector('span span:last-child')?.textContent || NaN),
      total: all.length, byStatus: all.reduce((a, p) => (a[p.status] = (a[p.status] || 0) + 1, a), {}), items: all.map(p => p.title + ' [' + p.status + ']') };
  }));
  log('rows', rows);
  const mism = rows.filter(r => r.shownCount !== r.total);
  log('mismatchedRows', mism.map(r => r.name + ': row ' + r.shownCount + ' vs all ' + r.total));
  const target = mism[0] || rows.find(r => r.name === 'Health Needs');
  const idx = await f.evaluate(n => L().categories.indexOf(n), target.name);
  await f.evaluate(i => document.querySelector(`[data-delcat="${i}"]`).closest('.catrow').scrollIntoView({ block: 'center' }), idx); await sleep(200);
  await d.shot(P + '-row.png');
  await f.click(`[data-delcat="${idx}"]`); await sleep(400);
  const confirm = await f.evaluate(() => document.querySelector('.ask .line')?.textContent);
  log('confirm', { category: target.name, rowText: target.rowText, confirmText: confirm });
  await d.shot(P + '-confirm.png');
  await f.click('#askCancel'); await sleep(200);
  // after cancel nothing changed
  log('afterCancel', await f.evaluate(n => L().prayers.filter(p => p.category === n).length, target.name));
  await d.close();
} finally {
  fs.writeFileSync(P + '.json', JSON.stringify(res, null, 1));
  await L.close();
}
