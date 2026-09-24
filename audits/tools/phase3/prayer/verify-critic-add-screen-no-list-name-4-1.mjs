// Skeptic #1 for critic-add-screen-no-list-name-4: does the Add form silently add to the family list when the adult's
// last Today view was Family, with no list name on the form? (apps/prayer.html:479-501 form, 694 activeList saved in
// person scope, 707 L(), 1271-1275 switch, 1436 push to L()). Demo clock, typical seed, WebKit, iPhone PWA as Eli.
// Run: node "audits/tools/phase3/prayer/verify-critic-add-screen-no-list-name-4-1.mjs"
//   -> audits/evidence/p3/prayer/verify-critic-add-screen-no-list-name-4-1.json (+ PNG)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const P = `${OUT}/verify-critic-add-screen-no-list-name-4-1`;
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 500)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const ready = async f => { await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800); };
try {
  // Seed the family-prayer push watermark first so a later run shows what it would announce.
  log('prayerJobSeed', (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } })).body);
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  let f = await d.openApp('prayer', { wait: '#todayLine' }); await ready(f);
  log('initialList', await f.evaluate(() => D.activeList));
  // Session 1: Eli looks at the Family list, then leaves the app.
  await f.click('#listSwitch [data-list="shared"]'); await sleep(2500);
  log('personScopeActiveList', (await L.apiAs('eli', '/api/data/prayer?scope=person')).body.items?.filter(i => i.key === 'activeList').map(i => i.value));
  await d.close();
  // Session 2 (later, fresh page): Eli opens Prayer and goes straight to Add via the bottom nav.
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  f = await d2.openApp('prayer', { wait: '#todayLine' }); await ready(f);
  log('reopenedOnList', await f.evaluate(() => D.activeList));
  await f.click('nav [data-go="add"]'); await sleep(500);
  const addInfo = await f.evaluate(() => {
    const s = document.getElementById('s-add');
    const visibleText = [...s.querySelectorAll('h1,label,button,p,.note')].filter(e => e.offsetParent !== null).map(e => e.textContent.trim()).filter(Boolean);
    return { heading: s.querySelector('h1').textContent, labelsAndButtons: visibleText,
      mentionsListOutsideCategorySelect: /family list|my list|\bmine\b|family\b/i.test(visibleText.join(' | ')),
      listSwitchVisible: document.getElementById('listSwitch').offsetParent !== null,
      bodyShared: document.body.classList.contains('shared') };
  });
  log('addScreen', addInfo);
  await d2.page.screenshot({ path: `${P}-add-screen.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
  const title = 'Verify private: my test results';
  await f.fill('#f-title', title); await f.click('#f-save'); await sleep(3500);
  const fam = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const famRow = (fam.body.items || []).find(i => i.value && i.value.title === title);
  const per = await L.apiAs('eli', '/api/data/prayer?scope=person');
  const perRow = (per.body.items || []).find(i => i.value && i.value.title === title);
  log('landed', { family: famRow ? { key: famRow.key, by: famRow.value.by } : null, person: perRow ? perRow.key : null });
  log('toastOrConfirmAfterSave', await f.evaluate(() => ({ toast: document.getElementById('toast').classList.contains('on') ? document.getElementById('toast').innerText : null, screen: document.querySelector('.screen.on')?.id })));
  const k = await L.device({ device: 'ipad-portrait', profile: 'ezra' });
  const kf = await k.openApp('prayer', { wait: '#todayLine' }); await sleep(3000);
  log('ezraSeesIt', await kf.evaluate(t => document.body.innerText.includes(t), title));
  await k.close();
  log('prayerJobAfter', (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } })).body);
  const feed = await L.apiAs('mom', '/api/activity');
  log('feedLines', JSON.stringify(feed.body).match(/[^"]*test results[^"]*/g));
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${P}.json`, JSON.stringify(res, null, 2)); await L.close(); }
