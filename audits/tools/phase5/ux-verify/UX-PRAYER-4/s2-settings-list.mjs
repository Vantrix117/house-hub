// Skeptic s2, UX-PRAYER-4: does Settings say which list it edits, and does a plan change on Settings silently rewrite the
// family plan row? Eli picks Family on Today on one iPhone; later, on the Kitchen iPad, opens Settings (never touching the switch)
// and changes "What Today shows"; we read the family and person 'plans' rows on the server before and after, and every
// visible text on Settings. Also checks what a kid's Today header shows afterwards.
// Run: node audits/tools/phase5/ux-verify/UX-PRAYER-4/s2-settings-list.mjs
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/UX-PRAYER-4/s2';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const rows = async (scope) => { const r = await L.apiAs('eli', '/api/data/prayer?scope=' + scope); return r; };
const pick = (r, key) => { const b = r && r.body !== undefined ? r.body : r; const items = (b && (b.items || b.rows || b.data)) || b; const arr = Array.isArray(items) ? items : []; const x = arr.find(i => i.key === key); return x ? x.value : undefined; };
const open = async (d) => { await d.page.goto(L.site + '/apps/prayer.html', { waitUntil: 'load' });
  await d.page.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(600); };
try {
  const famBefore = await rows('family'), perBefore = await rows('person');
  res.rawShape = Object.keys(famBefore || {});
  const planSummary = v => v && v.map(p => ({ id: p.id, name: p.name, mode: p.mode }));
  res.before = { familyPlans: planSummary(pick(famBefore, 'plans')), familyActive: pick(famBefore, 'activePlan'), personPlans: planSummary(pick(perBefore, 'plans')), personActive: pick(perBefore, 'activePlan'), activeList: pick(perBefore, 'activeList') };
  // 1. iPhone: Eli taps Family on Today, closes.
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await open(phone); await phone.page.click('#listSwitch [data-list="shared"]'); await sleep(2500);
  await phone.close();
  res.afterPhone = { activeList: pick(await rows('person'), 'activeList') };
  // 2. iPad: Eli opens Prayer, goes straight to Settings (More tab).
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await open(ipad);
  res.ipadTodaySwitch = await ipad.page.evaluate(() => [...document.querySelectorAll('#listSwitch button')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')));
  await ipad.page.click('nav [data-go="more"]'); await sleep(600);
  res.settingsText = await ipad.page.evaluate(() => document.getElementById('s-more').innerText);
  res.settingsMentions = { myList: /my list|mine/i.test(res.settingsText), familyList: /family list/i.test(res.settingsText), familyWord: (res.settingsText.match(/family/gi) || []).length };
  res.settingsHeadings = await ipad.page.evaluate(() => [...document.querySelectorAll('#s-more h1, #s-more h2, #s-more label')].map(e => e.textContent.trim()));
  res.chipPressedBg = await ipad.page.evaluate(() => { const c = document.querySelector('#p-mode .chip[aria-pressed="true"]'); return c && getComputedStyle(c).backgroundColor; });
  res.bodyShared = await ipad.page.evaluate(() => document.body.classList.contains('shared'));
  await ipad.page.screenshot({ path: `${OUT}/ipad-settings-after-family.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
  // change "What Today shows" to "One category only"
  const toasts0 = await ipad.page.evaluate(() => document.querySelectorAll('.toast, #toast').length);
  await ipad.page.click('#p-mode [data-mode="focus"]'); await sleep(400);
  res.toastAfterChange = await ipad.page.evaluate(() => { const t = document.querySelector('.toast.on, #toast.on, .toast'); return t ? t.textContent : null; });
  res.toastCountBefore = toasts0;
  await sleep(3000);
  await ipad.close();
  const famAfter = await rows('family'), perAfter = await rows('person');
  res.after = { familyPlans: planSummary(pick(famAfter, 'plans')), familyActive: pick(famAfter, 'activePlan'), personPlans: planSummary(pick(perAfter, 'plans')), personActive: pick(perAfter, 'activePlan') };
  // 3. Kid (Ezra) on the family list: what does his header show now?
  const kid = await L.device({ device: 'ipad-portrait', profile: 'ezra' });
  await kid.page.goto(L.site + '/apps/prayer.html', { waitUntil: 'load' }); await sleep(2500);
  res.kidHeader = await kid.page.evaluate(() => (document.getElementById('todayDate') || {}).textContent);
  await kid.page.screenshot({ path: `${OUT}/kid-after.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
  await kid.close();
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/settings-list.json`, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1).slice(0, 5000)); await L.close(); }
