// Skeptic #1 for critic-focus-plan-deleted-category-7: does removing the category a "One category only" plan uses
// leave plan.focusCategory pointing at the deleted category (apps/prayer.html:1355-1368 vs rename at 1341-1353)?
// Fresh local instance, typical seed, demo clock, WebKit, iPhone PWA as Eli on My list. Also reloads the app to
// check the stale focusCategory persists (not just an in-memory artefact) and that the UI offers no way back to
// the removed category except picking another one.
// Run: node "audits/tools/phase3/prayer/verify-critic-focus-plan-deleted-category-7-1.mjs"
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const P = 'verify-critic-focus-plan-deleted-category-7-1';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 500)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  let f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 }); await sleep(700);
  await f.click('#listSwitch [data-list="personal"]'); await sleep(400);
  log('categoriesAtStart', await f.evaluate(() => L().categories));
  // New plan -> focus -> Health Needs
  await f.click('nav [data-go="more"]'); await sleep(300);
  await f.click('#f-newplan'); await sleep(200); await f.fill('#askIn', 'Health week'); await f.click('#askSave'); await sleep(300);
  await f.click('[data-mode="focus"]'); await sleep(300);
  await f.selectOption('#p-focus', 'Health Needs'); await sleep(300);
  await f.click('nav [data-go="today"]'); await sleep(400);
  log('before', await f.evaluate(() => ({ plan: PL().name, mode: PL().mode, focus: PL().focusCategory,
    today: [...document.querySelectorAll('#todayList .title')].map(t => t.textContent), line: document.getElementById('todayLine').textContent })));
  // Remove Health Needs via More -> Categories -> Remove
  await f.click('nav [data-go="more"]'); await sleep(300);
  const idx = await f.evaluate(() => L().categories.indexOf('Health Needs'));
  await f.click(`[data-delcat="${idx}"]`); await sleep(250);
  log('confirmText', await f.evaluate(() => (document.querySelector('#askSave')?.closest('[role=dialog],.sheet,.ask,div')?.innerText || '').replace(/\s+/g,' ').slice(0,200)));
  await f.click('#askSave'); await sleep(600);
  log('afterRemove', await f.evaluate(() => ({ focus: PL().focusCategory, cats: L().categories,
    selectValue: document.getElementById('p-focus')?.value, selectOptions: [...(document.getElementById('p-focus')?.options || [])].map(o => o.value),
    anyOptionSelectedAttr: [...(document.getElementById('p-focus')?.options || [])].some(o => o.defaultSelected) })));
  await d.shot(`${OUT}/${P}-settings.png`);
  await f.click('nav [data-go="today"]'); await sleep(400);
  log('todayAfter', await f.evaluate(() => ({ line: document.getElementById('todayLine').textContent,
    empty: (document.querySelector('#todayList .empty') || {}).innerText, titles: [...document.querySelectorAll('#todayList .title')].map(t => t.textContent),
    movedToPersonal: L().prayers.filter(p => p.status === 'active' && p.category === 'Personal').map(p => p.title),
    activeTotal: L().prayers.filter(p => p.status === 'active').length })));
  await d.shot(`${OUT}/${P}-today.png`);
  // Persistence: wait for flush, reopen the app, check the plan still points at the removed category
  await sleep(3000);
  await d.goto('#home'); await sleep(500);
  f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 }); await sleep(700);
  await f.click('#listSwitch [data-list="personal"]'); await sleep(400);
  log('afterReopen', await f.evaluate(() => ({ plan: PL().name, focus: PL().focusCategory, catExists: L().categories.includes(PL().focusCategory),
    line: document.getElementById('todayLine').textContent, empty: (document.querySelector('#todayList .empty') || {}).innerText })));
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/${P}.json`, JSON.stringify(res, null, 2)); await L.close(); }
