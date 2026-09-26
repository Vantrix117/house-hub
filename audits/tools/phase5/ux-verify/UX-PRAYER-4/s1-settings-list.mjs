// Skeptic s1 for UX-PRAYER-4: after an adult last viewed Family on Today, does Settings name the list it edits, and does a
// plan change there rewrite the family-scope plan row that everyone (incl. kids) reads? Demo clock, typical seed, WebKit,
// iPhone PWA as Eli inside the hub viewer; Mom on a second device. apps/prayer.html:503-532, 685-695, 707-708, 1171-1227.
// Run: node audits/tools/phase5/ux-verify/UX-PRAYER-4/s1-settings-list.mjs -> audits/evidence/p5/ux-verify/UX-PRAYER-4/s1/
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/UX-PRAYER-4/s1';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 700)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const ready = async f => { await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800); };
const famPlans = async () => { const b = (await L.apiAs('mom', '/api/data/prayer?scope=family')).body; const it = (b.items || []).filter(i => i.key === 'plans' || i.key === 'activePlan'); return it.map(i => ({ key: i.key, value: i.key === 'plans' ? i.value.map(p => ({ id: p.id, name: p.name, mode: p.mode, rotationSize: p.rotationSize })) : i.value, updated_at: i.updated_at })); };
const settingsText = f => f.evaluate(() => {
  const s = document.getElementById('s-more');
  const vis = [...s.querySelectorAll('h1,h2,label,button,p,.note,option:checked')].filter(e => e.offsetParent !== null || e.tagName === 'OPTION').map(e => e.textContent.trim()).filter(Boolean);
  const nonCat = vis.filter(t => !/^(Family|Those Who Are Lost - Family)$/.test(t));
  return { headings: [...s.querySelectorAll('h1,h2')].map(h => h.textContent.trim()), activePlanOption: s.querySelector('#f-plan option:checked')?.textContent,
    namesList: /family list|my list|\bmine\b|shared|everyone|the house/i.test(nonCat.join(' | ')),
    listSwitchVisible: document.getElementById('listSwitch').offsetParent !== null, bodyShared: document.body.classList.contains('shared'),
    accent: getComputedStyle(document.body).getPropertyValue('--accent').trim(), activeList: D.activeList,
    pressedChipBg: (() => { const c = s.querySelector('#p-rot .chip[aria-pressed="true"]'); return c ? getComputedStyle(c).backgroundColor : null; })() };
});
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  let f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f);
  await f.click('nav [data-go="more"]'); await sleep(600);
  log('settingsOnMine', await settingsText(f));
  await d.page.screenshot({ path: `${OUT}/settings-mine.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
  await f.click('nav [data-go="today"]'); await sleep(400);
  await f.click('#listSwitch [data-list="shared"]'); await sleep(1500);
  await d.close();
  // later session: Eli opens Prayer and goes straight to Settings
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  f = await d2.openApp('prayer', { wait: '#todayLine' }); await ready(f);
  await f.click('nav [data-go="more"]'); await sleep(600);
  log('settingsOnFamily', await settingsText(f));
  await d2.page.screenshot({ path: `${OUT}/settings-family.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
  log('familyPlansBefore', await famPlans());
  const cur = await f.evaluate(() => PL().rotationSize);
  const target = cur === 5 ? 6 : 5;
  await f.click(`#p-rot [data-rot="${target}"]`); await sleep(3500);
  log('toastOrConfirm', await f.evaluate(() => ({ toast: document.getElementById('toast')?.classList.contains('on') ? document.getElementById('toast').innerText : null, dialog: !!document.querySelector('.sheet.on') })));
  log('familyPlansAfter', await famPlans());
  const per = (await L.apiAs('eli', '/api/data/prayer?scope=person')).body;
  log('eliPersonPlansRotation', (per.items || []).filter(i => i.key === 'plans').map(i => i.value.map(p => p.rotationSize)));
  const k = await L.device({ device: 'ipad-portrait', profile: 'ezra' });
  const kf = await k.openApp('prayer', { wait: '#todayLine' }); await sleep(3000);
  log('ezraFamilyRotation', await kf.evaluate(() => ({ activeList: D.activeList, rotationSize: PL().rotationSize })));
  await k.close();
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/settings-list.json`, JSON.stringify(res, null, 2)); await L.close(); }
