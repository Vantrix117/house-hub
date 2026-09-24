// Skeptic #2 for "critic-add-screen-no-list-name-4": the Add form never names the list it adds to.
// Lens: intent/context. Checks (demo clock, typical seed, WebKit, iPhone PWA as Eli):
//  1. Is the Mine/Family choice sticky across a fresh app open (person-scope activeList, apps/prayer.html:633, 694)?
//  2. What does the Add screen show: any list name, the switch, the accent colour (body.shared, :39, :875)?
//  3. After "Add to the list", where does the row land, is there a toast/undo, does Ezra (kid) see it?
//  4. Would the family prayer push announce it (seed the watermark first, then run the prayer job)?
// Run: node "audits/tools/phase3/prayer/verify-critic-add-screen-no-list-name-4-2.mjs"
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const P = `${OUT}/verify-critic-add-screen-no-list-name-4-2`;
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 700)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // seed the prayer push watermark before anything is added
  log('cronSeed', (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } })).body);
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  let f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 }); await sleep(700);
  log('initialList', await f.evaluate(() => D.activeList));
  // Earlier session: Eli looks at the family list, then leaves the app
  await f.click('#listSwitch [data-list="shared"]'); await sleep(1500);
  await d.goto('#home'); await sleep(1500);
  // Later: a fresh open of Prayer (full reload of the page to rule out in-memory state)
  await d.page.reload(); await sleep(2000);
  f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 12000 }); await sleep(700);
  log('listAfterReopen', await f.evaluate(() => ({ active: D.activeList, pressed: [...document.querySelectorAll('#listSwitch button')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')) })));
  // He goes to Settings first, then uses the nav Add (switch not on screen from Settings)
  await f.click('nav [data-go="more"]'); await sleep(300);
  await f.click('nav [data-go="add"]'); await sleep(400);
  const add = await f.evaluate(() => {
    const s = document.getElementById('s-add');
    const txt = s.innerText.replace(/\s+/g, ' ');
    const noOptions = [...s.querySelectorAll('h1,label,button,p,.note')].map(e => e.innerText.trim()).join(' | ');
    const sw = document.getElementById('listSwitch'); const r = sw.getBoundingClientRect();
    return { visibleText: noOptions, namesListOutsideSelect: /family list|my list|\bmine\b|to the family|private/i.test(noOptions),
      switchVisible: !!(sw.offsetParent) && r.height > 0, bodyShared: document.body.classList.contains('shared'),
      accent: getComputedStyle(document.body).getPropertyValue('--accent').trim(), saveBtnBg: getComputedStyle(document.getElementById('f-save')).backgroundColor,
      categoryOptions: [...document.querySelectorAll('#f-cat option')].map(o => o.textContent) };
  });
  log('addScreen', add);
  await d.shot(`${P}-add-screen.png`);
  const title = 'My blood test results on Friday';
  await f.fill('#f-title', title); await f.click('#f-save'); await sleep(600);
  log('afterSave', await f.evaluate(() => ({ screen: [...document.querySelectorAll('.screen.on')].map(s => s.id), toast: document.getElementById('toast').classList.contains('on') ? document.getElementById('toast').innerText : null, active: D.activeList })));
  await d.shot(`${P}-after-save.png`);
  await sleep(3500);
  const fam = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const row = (fam.body.items || []).find(i => i.value && i.value.title === title);
  const mine = await L.apiAs('eli', '/api/data/prayer?scope=person');
  log('landed', { family: row ? { key: row.key, by: row.value.by } : false, person: !!(mine.body.items || []).find(i => i.value && i.value.title === title) });
  const k = await L.device({ device: 'ipad-portrait', profile: 'ezra' });
  const kf = await k.openApp('prayer', { wait: '#todayLine' }); await sleep(2500);
  log('kidSees', await kf.evaluate(t => document.body.innerText.includes(t), title));
  await k.shot(`${P}-ezra.png`); await k.close();
  const job = (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } })).body;
  log('cronAfter', job);
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${P}.json`, JSON.stringify(res, null, 2)); await L.close(); }
