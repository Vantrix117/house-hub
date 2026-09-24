// Skeptic 2 for "family-tick-shared": independent run, Chromium (not WebKit), Eli on an iPhone, Mae (not Elizabeth)
// as the second viewer, plus the detail sheet's "Last prayed" line and the server row.
// Steps (demo clock, typical seed):
//   1. Eli iPhone -> Prayer -> Family. Record every row's tick vs its prayedBy[TODAY], the headline, the Pray now queue.
//   2. Pick a row ticked although Eli is not in prayedBy[TODAY]. Record its server row + detail-sheet line.
//   3. Eli taps its check ONCE (he means "I prayed"). Record memory, server, tick, detail sheet.
//   4. Mae's iPad (a new paired device) opens Family: does the row read prayed? does its prayer-by face remain?
// Run: node "audits/tools/phase3/prayer/verify-family-tick-shared-2.mjs"
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
const res = {};
const state = f => f.evaluate(() => ({
  headline: document.getElementById('todayLine').textContent,
  me: hub.profile.name,
  rows: [...document.querySelectorAll('#todayList li.row')].map(li => {
    const id = li.querySelector('.mark').dataset.pray, p = D.lists.shared.prayers.find(q => q.id === id);
    return { id, title: p.title, ticked: li.querySelector('.mark').getAttribute('aria-pressed') === 'true',
      lastPrayedAt: p.lastPrayedAt, prayedByToday: (p.prayedBy || {})[TODAY] || [], facesLabel: (li.querySelector('.who') || {}).ariaLabel || li.querySelector('.who')?.getAttribute('aria-label') || null };
  }),
}));
const srv = async id => { const r = await L.apiAs('christian', '/api/data/prayer?scope=family'); const it = r.body.items.find(i => i.key === 'prayer:' + id); return it && { lastPrayedAt: it.value.lastPrayedAt, prayedBy: it.value.prayedBy, updated_at: it.updated_at }; };
const sheet = async (f, id) => { await f.click(`#todayList [data-open="${id}"]`); await sleep(400);
  const t = await f.evaluate(() => [...document.querySelectorAll('#sheetInner .meta')].map(m => m.textContent).find(s => /prayed/i.test(s)));
  await f.click('#sheetInner [data-shut]'); await sleep(300); return t; };
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const E = await L.device({ device: 'iphone-pwa', profile: 'eli', as: ph });
  const f = await E.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(800);
  await f.click('#listSwitch [data-list="shared"]'); await sleep(600);
  res.before = await state(f);
  res.tickedButNotMe = res.before.rows.filter(r => r.ticked && !r.prayedByToday.includes(res.before.me)).map(r => r.id);
  await f.click('#startPray'); await sleep(300);
  res.prayNowQueue = await f.evaluate(() => prayList.map(p => p.id)); await f.click('#prayShut'); await sleep(300);
  console.log('ME', res.before.me, '| HEADLINE', res.before.headline);
  for (const r of res.before.rows) console.log('  ', r.id, 'ticked=' + r.ticked, 'prayedBy=' + JSON.stringify(r.prayedByToday), r.title);
  console.log('TICKED BUT NOT ME', res.tickedButNotMe, '| PRAY NOW QUEUE', res.prayNowQueue);
  const target = res.tickedButNotMe[0];
  if (!target) throw new Error('no row ticked by someone else');
  res.target = target;
  res.targetServerBefore = await srv(target);
  res.targetSheetBefore = await sheet(f, target);
  await E.shot(`${OUT}/verify-family-tick-shared-2-eli-before.png`);
  console.log('TARGET', target, 'SERVER BEFORE', JSON.stringify(res.targetServerBefore), '| SHEET', res.targetSheetBefore);
  await f.click(`#todayList [data-pray="${target}"]`); await sleep(2000);
  res.after = { row: (await state(f)).rows.find(r => r.id === target), headline: (await state(f)).headline, server: await srv(target), sheet: await sheet(f, target) };
  await E.shot(`${OUT}/verify-family-tick-shared-2-eli-after-one-tap.png`);
  console.log('AFTER ONE TAP (Eli)', JSON.stringify(res.after));
  const mp = await L.newDevice({ name: 'Mae ipad', profiles: ['christian'] });
  const M = await L.device({ device: 'ipad-portrait', profile: 'christian', as: mp });
  const fm = await M.openApp('prayer', { wait: '#todayLine' });
  await fm.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(900);
  await fm.click('#listSwitch [data-list="shared"]'); await sleep(600);
  const ms = await state(fm);
  res.maeSees = { headline: ms.headline, row: ms.rows.find(r => r.id === target) };
  await M.shot(`${OUT}/verify-family-tick-shared-2-mae-ipad.png`);
  console.log('MAE SEES', JSON.stringify(res.maeSees));
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/verify-family-tick-shared-2.json`, JSON.stringify(res, null, 1)); await L.close(); }
