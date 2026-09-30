// Batch 3 copy of audits/tools/phase3/prayer/verify-critic-focus-plan-deleted-category-7-2.mjs.
// What changed on purpose: on the Family list the first change in Settings now asks in the shared confirm sheet (UX-PRAYER-4), so after New plan and after Remove the copy taps "Change it" in that sheet when it shows.
// Evidence goes to audits/evidence/p6/3 instead of p3. What it measures is unchanged.
// Skeptic 2 for "critic-focus-plan-deleted-category-7": removing a category that a "One category only" plan uses.
// Fresh local instance, typical seed, demo clock, WebKit, iPhone PWA as Eli. UI only (no hand-made API writes).
// Also runs on the Family list and reads the plan back from a second profile (Mom) through the API.
// Run: node "audits/tools/phase3/prayer/verify-critic-focus-plan-deleted-category-7-2.mjs"
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
fs.mkdirSync('audits/evidence/p6/3', { recursive: true });
const OUT = 'audits/evidence/p6/3';
const P = 'verify-critic-focus-plan-deleted-category-7-2';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 500)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 }); await sleep(800);
  const okConfirm = async () => { const b = await f.$('.hub-ask .btn-primary, .hub-ask .btn-danger'); if (b) { await b.click(); await sleep(500); } };
  async function run(list, cat, tag) {
    await f.click('nav [data-go="today"]'); await sleep(300);
    await f.click(`#listSwitch [data-list="${list}"]`); await sleep(500);
    log(tag + ':categories', await f.evaluate(() => L().categories.slice()));
    await f.click('nav [data-go="more"]'); await sleep(300);
    await f.click('#f-newplan'); await sleep(250); await okConfirm(); await f.fill('#askIn', 'Focus test ' + tag); await f.click('#askSave'); await sleep(300);
    await f.click('[data-mode="focus"]'); await sleep(300);
    await f.selectOption('#p-focus', cat); await sleep(400);
    await f.click('nav [data-go="today"]'); await sleep(400);
    log(tag + ':before', await f.evaluate(() => ({ focus: PL().focusCategory, today: [...document.querySelectorAll('#todayList .title')].map(t => t.textContent), line: document.getElementById('todayLine').textContent })));
    await f.click('nav [data-go="more"]'); await sleep(300);
    const idx = await f.evaluate(c => L().categories.indexOf(c), cat);
    await f.click(`[data-delcat="${idx}"]`); await sleep(250); await okConfirm();
    log(tag + ':confirmText', await f.evaluate(() => (document.querySelector('#askSave')?.closest('div,section,form')?.innerText || '').replace(/\s+/g, ' ').slice(0, 200)));
    await f.click('#askSave'); await sleep(600);
    log(tag + ':settingsAfter', await f.evaluate(c => ({ planFocus: PL().focusCategory, selectValue: document.getElementById('p-focus')?.value, anyOptionSelectedAttr: !!document.querySelector('#p-focus option[selected]'), catListed: L().categories.includes(c) }), cat));
    await d.shot(`${OUT}/${P}-${tag}-settings.png`);
    await f.click('nav [data-go="today"]'); await sleep(400);
    log(tag + ':todayAfter', await f.evaluate(c => ({ line: document.getElementById('todayLine').textContent, empty: (document.querySelector('#todayList .empty') || {}).innerText, today: [...document.querySelectorAll('#todayList .title')].map(t => t.textContent), stillActiveInPersonal: L().prayers.filter(p => p.status === 'active' && p.category === 'Personal').length }), cat));
    await d.shot(`${OUT}/${P}-${tag}-today.png`);
  }
  await run('personal', 'Health Needs', 'mine');
  // Family list: plans + activePlan are family-scope keys (apps/prayer.html:585, 626, 655)
  const famCats = await f.evaluate(() => { const s = D.lists.shared; return s ? s.categories.slice() : null; });
  const famCat = famCats && (famCats.find(c => c !== 'Personal') || null);
  log('familyCategoryUsed', famCat);
  if (famCat) {
    await run('shared', famCat, 'family');
    await sleep(3500); // let the write queue flush
    const r = await L.apiAs('mom', '/api/data/prayer?scope=family');
    const items = r.body.items || [];
    const plans = items.find(i => i.key === 'plans'), act = items.find(i => i.key === 'activePlan'), cats = items.find(i => i.key === 'categories');
    const ap = plans && act && plans.value.find(p => p.id === act.value);
    log('momSeesFamilyActivePlan', ap ? { name: ap.name, mode: ap.mode, focusCategory: ap.focusCategory, categoryExists: cats ? cats.value.includes(ap.focusCategory) : null } : { keys: items.map(i => i.key).slice(0, 30) });
  }
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/${P}.json`, JSON.stringify(res, null, 2)); await L.close(); }
