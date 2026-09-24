// Lead 3 (01-leads.md): on the family list a row's done state is the one shared `lastPrayedAt` (apps/prayer.html:841, 884),
// so a row Elizabeth or Ezra prayed shows as done for Eli; and Eli's tap toggles it OFF for the whole house
// (setPrayed: on = lastPrayedAt !== TODAY, 1595-1596) while only removing his own (absent) name from prayedBy (1599-1602).
// Steps (demo clock, typical seed: Elizabeth prayed s001+s002, Ezra s001+s003 this morning; Eli none):
//   1. Eli (kitchen iPad) opens Prayer -> Family. Record the ticks, headline and Pray now queue.
//   2. Eli taps the circle on "Grandma Jo's visit this week" (s002, prayed only by Elizabeth).
//   3. Read the row in memory and on the server; open Elizabeth's phone -> Family and read that row there.
//   4. Eli taps again; read the row.
// Run: node "audits/tools/phase3/prayer/family-tick.mjs" -> audits/evidence/p3/prayer/family-tick.json + PNGs
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const rowState = f => f.evaluate(() => ({
  headline: document.getElementById('todayLine').textContent,
  strip: document.getElementById('todayStrip').textContent.replace(/\s+/g, ' '),
  rows: [...document.querySelectorAll('#todayList li.row')].map(li => ({ title: li.querySelector('.title').childNodes[0].textContent, ticked: li.querySelector('.mark').getAttribute('aria-pressed') === 'true',
    prayedBy: (D.lists.shared.prayers.find(p => p.id === li.querySelector('.mark').dataset.pray).prayedBy || {})[TODAY] || [] })),
}));
const srvRow = async id => { const r = await L.apiAs('eli', '/api/data/prayer?scope=family'); const it = r.body.items.find(i => i.key === 'prayer:' + id); return it && { lastPrayedAt: it.value.lastPrayedAt, prayedByToday: it.value.prayedBy[Object.keys(it.value.prayedBy).sort().pop()] , prayedBy: it.value.prayedBy }; };
try {
  const E = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  const f = await E.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(600);
  await f.click('#listSwitch [data-list="shared"]'); await sleep(500);
  res.before = await rowState(f);
  await f.click('#startPray'); await sleep(300);
  res.prayNowQueue = await f.evaluate(() => prayList.map(p => p.title)); await f.click('#prayShut'); await sleep(300);
  await E.shot(`${OUT}/family-tick-1-eli-before.png`);
  console.log('BEFORE', JSON.stringify(res.before), '\nPray now queue', res.prayNowQueue);
  // 2. Eli taps s002
  await f.click('#todayList [data-pray="s002"]'); await sleep(1500);
  res.afterTap1 = { mem: await f.evaluate(() => { const p = D.lists.shared.prayers.find(p => p.id === 's002'); return { lastPrayedAt: p.lastPrayedAt, prayedByToday: p.prayedBy[TODAY] || [] }; }),
    ticked: await f.evaluate(() => document.querySelector('#todayList [data-pray="s002"]').getAttribute('aria-pressed')), server: await srvRow('s002') };
  console.log('AFTER TAP 1', JSON.stringify(res.afterTap1));
  await E.shot(`${OUT}/family-tick-2-eli-after-tap.png`);
  // 3. Elizabeth's phone
  const ph = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });
  const M = await L.device({ device: 'iphone-pwa', profile: 'mom', as: ph });
  const fm = await M.openApp('prayer', { wait: '#todayLine' });
  await fm.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(800);
  await fm.click('#listSwitch [data-list="shared"]'); await sleep(500);
  res.momView = await rowState(fm);
  console.log('ELIZABETH SEES', JSON.stringify(res.momView.rows.find(r => r.title.startsWith("Grandma Jo"))), res.momView.headline);
  await M.shot(`${OUT}/family-tick-3-elizabeth-phone.png`);
  // 4. Eli taps again
  await f.click('#todayList [data-pray="s002"]'); await sleep(1500);
  res.afterTap2 = { mem: await f.evaluate(() => { const p = D.lists.shared.prayers.find(p => p.id === 's002'); return { lastPrayedAt: p.lastPrayedAt, prayedByToday: p.prayedBy[TODAY] || [] }; }), server: await srvRow('s002') };
  console.log('AFTER TAP 2', JSON.stringify(res.afterTap2));
  // 5. And Ezra's Kiara-style kid view is by name, so it disagrees with the adult tick
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/family-tick.json`, JSON.stringify(res, null, 1)); await L.close(); }
