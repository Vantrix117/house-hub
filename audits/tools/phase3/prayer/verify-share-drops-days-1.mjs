// Skeptic #1 for finding "share-drops-days": does "Send to family list" on a weekly request drop its days,
// so the family copy never appears on the family Today? Drives the real UI only (no in-page state swaps).
// Demo clock Tue 22 Sep 2026 08:40 NY, typical seed, WebKit. Eli shares p006 (weekly Sun/Tue/Thu) from his phone;
// then we read the server row, Eli's family Today DOM, and Elizabeth's family Today DOM on her own device.
// Run: node "audits/tools/phase3/prayer/verify-share-drops-days-1.mjs" -> audits/evidence/p3/prayer/verify-share-drops-days-1.json (+2 PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '→', JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
async function app(profile, as) {
  const d = await L.device({ device: 'iphone-pwa', profile, ...(as ? { as } : {}) });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(600);
  return { d, f };
}
const todayIds = f => f.evaluate(() => [...document.querySelectorAll('#todayList [data-open]')].map(b => b.dataset.open));
try {
  const { d, f } = await app('eli');
  log('dow', await f.evaluate(() => new Date().toString()));
  // make sure we are on Eli's own list
  if (await f.$('#listSwitch [data-list="personal"]')) { await f.click('#listSwitch [data-list="personal"]'); await sleep(300); }
  log('eliPersonalTodayHasP006', (await todayIds(f)).includes('p006'));
  await f.click('nav [data-go="all"]'); await f.fill('#f-search', 'Pastor Tim'); await sleep(300);
  await f.click('#allList [data-open="p006"]'); await sleep(400);
  log('sourceBefore', await f.evaluate(() => { const p = D.lists.personal.prayers.find(x => x.id === 'p006'); return { title: p.title, cadence: p.cadence, days: p.days }; }));
  await f.click('[data-share="p006"]'); await sleep(300);
  log('askLabel', await f.evaluate(() => document.querySelector('.ask')?.textContent.replace(/\s+/g, ' ').trim()));
  await f.click('#askSave'); await sleep(800);
  log('copyLocal', await f.evaluate(() => { const c = D.lists.shared.prayers.find(p => p.sharedFrom === 'p006'); return c && { id: c.id, cadence: c.cadence, days: c.days, status: c.status }; }));
  // switch to the family list through the UI and go to Today
  await f.click('[data-shut]').catch(() => {}); await sleep(300);
  await f.click('nav [data-go="today"]').catch(() => {}); await sleep(300);
  await f.click('#listSwitch [data-list="shared"]'); await sleep(600);
  const copyId = res.copyLocal?.id;
  const ids = await todayIds(f);
  log('eliFamilyToday', { activeList: await f.evaluate(() => D.activeList), plan: await f.evaluate(() => { const S = D.lists.shared; const p = S.plans.find(x => x.id === S.activePlan); return { name: p.name, mode: p.mode }; }), ids, copyShown: ids.includes(copyId), s005WeeklyTueShown: ids.includes('s005') });
  await d.shot(`${OUT}/verify-share-drops-days-1-eli-family-today.png`);
  // wait for flush, then read the server
  await sleep(4000);
  const srv = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const row = (srv.body?.items || []).find(i => i.value && i.value.sharedFrom === 'p006');
  log('serverRow', row ? { key: row.key, cadence: row.value.cadence, days: row.value.days, status: row.value.status } : null);
  await d.close();
  // Elizabeth on her own phone, family list
  const ph = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });
  const m2 = await app('mom', ph);
  if (await m2.f.$('#listSwitch [data-list="shared"]')) { await m2.f.click('#listSwitch [data-list="shared"]'); await sleep(600); }
  const mids = await todayIds(m2.f);
  log('momFamilyToday', { hasCopyInData: await m2.f.evaluate(id => { const c = D.lists.shared.prayers.find(p => p.id === id); return c ? { cadence: c.cadence, days: c.days } : null; }, copyId), ids: mids, copyShown: mids.includes(copyId) });
  await m2.d.shot(`${OUT}/verify-share-drops-days-1-mom-family-today.png`);
  // does it show on ANY day of the week under 'everything'? (pure filter check, rotating dow)
  log('copyOnAnyDow', await m2.f.evaluate(id => { const c = D.lists.shared.prayers.find(p => p.id === id); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter(dow => c.cadence === 'weekly' && (c.days || []).includes(dow)); }, copyId));
  await m2.d.close();
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/verify-share-drops-days-1.json`, JSON.stringify(res, null, 2)); await L.close(); }
