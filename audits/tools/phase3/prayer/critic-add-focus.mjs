// Completeness critic, Prayer. Two more leads the report does not cover (UI only, demo clock, typical seed, WebKit):
//  addlist  The Add screen never names the list it adds to (apps/prayer.html:479-501, 1436 uses L() = the list last
//           chosen on Today). An adult whose last list was Family adds a private-sounding request: where does it land?
//  focus    Removing a category that a "One category only" plan uses: delcat fixes dayMap but not focusCategory
//           (apps/prayer.html:1361-1367; rename does fix it at 1350), so the plan keeps pointing at a deleted category.
// Run: node "audits/tools/phase3/prayer/critic-add-focus.mjs" -> audits/evidence/p3/prayer/critic-add-focus.json (+ PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 600)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 }); await sleep(700);
  // ── addlist: Eli looked at the family list earlier, then comes back later to add something of his own
  await f.click('#listSwitch [data-list="shared"]'); await sleep(500);
  await f.click('nav [data-go="add"]'); await sleep(400);
  log('addScreenText', await f.evaluate(() => document.getElementById('s-add').innerText.replace(/\s+/g, ' ').slice(0, 260)));
  log('addScreenNamesList', await f.evaluate(() => /family|my list|mine/i.test(document.getElementById('s-add').innerText)));
  await d.shot(`${OUT}/critic-add-on-family.png`);
  const title = 'My blood test results on Friday';
  await f.fill('#f-title', title); await f.click('#f-save'); await sleep(3500);
  const fam = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const row = (fam.body.items || []).find(i => i.value && i.value.title === title);
  log('landedOnFamilyList', row ? { key: row.key, by: row.value.by } : false);
  log('kidCanSee', await (async () => { const k = await L.device({ device: 'ipad-portrait', profile: 'ezra' }); const kf = await k.openApp('prayer', { wait: '#todayLine' }); await sleep(2500); const t = await kf.evaluate(t => document.body.innerText.includes(t), title); await k.close(); return t; })());
  log('prayerJobWouldAnnounce', (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } })).body);
  // ── focus: back on Eli's own list, make a focus plan on "Health Needs", then remove that category
  await f.click('nav [data-go="today"]'); await sleep(300);
  await f.click('#listSwitch [data-list="personal"]'); await sleep(400);
  await f.click('nav [data-go="more"]'); await sleep(300);
  await f.click('#f-newplan'); await sleep(200); await f.fill('#askIn', 'Health week'); await f.click('#askSave'); await sleep(300);
  await f.click('[data-mode="focus"]'); await sleep(300);
  await f.selectOption('#p-focus', 'Health Needs'); await sleep(300);
  await f.click('nav [data-go="today"]'); await sleep(300);
  log('focusBefore', await f.evaluate(() => ({ focus: PL().focusCategory, today: [...document.querySelectorAll('#todayList .title')].map(t => t.textContent), line: document.getElementById('todayLine').textContent })));
  await f.click('nav [data-go="more"]'); await sleep(300);
  const idx = await f.evaluate(() => L().categories.indexOf('Health Needs'));
  await f.click(`[data-delcat="${idx}"]`); await sleep(200); await f.click('#askSave'); await sleep(500);
  log('settingsAfterRemove', await f.evaluate(() => ({ planFocusCategory: PL().focusCategory, selectShows: document.getElementById('p-focus').value, categoryStillListed: L().categories.includes('Health Needs') })));
  await d.shot(`${OUT}/critic-focus-settings-after-remove.png`);
  await f.click('nav [data-go="today"]'); await sleep(300);
  log('todayAfterRemove', await f.evaluate(() => ({ line: document.getElementById('todayLine').textContent, empty: (document.querySelector('#todayList .empty') || {}).innerText, movedToPersonal: L().prayers.filter(p => p.status === 'active' && p.category === 'Personal').map(p => p.title) })));
  await d.shot(`${OUT}/critic-focus-today-after-remove.png`);
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/critic-add-focus.json`, JSON.stringify(res, null, 2)); await L.close(); }
