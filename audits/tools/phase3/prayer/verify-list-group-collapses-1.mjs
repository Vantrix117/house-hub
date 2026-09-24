// Skeptic #1 for "list-group-collapses": on the List screen, does ticking a request (or a remote change) fold the
// open category group shut? Independent reproduction: iPad portrait (the kitchen device), Eli, typical seed, real clock.
//  A. open the first group that has an unticked row, tap its tick (real pointer via Frame.click) -> open groups after?
//  B. open two groups, tick in one -> are both closed?
//  C. remote change by ANOTHER person (Mae writes a family-scope prayer row via API) while Eli's personal List shows
//     an open group -> pull -> open groups after?
//  D. control: with a search term, groups are open and stay open after a tick (by design, groupedHTML(act, !!q)).
// Run: node "audits/tools/phase3/prayer/verify-list-group-collapses-1.mjs"
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(800);
  await f.click('nav [data-go="all"]'); await sleep(500);
  const openCats = () => f.evaluate(() => [...document.querySelectorAll('#allList details.cat')].filter(x => x.open).map(x => x.querySelector('summary span').textContent.trim()));
  const groups = await f.evaluate(() => [...document.querySelectorAll('#allList details.cat')].map(x => ({
    cat: x.querySelector('[data-copycat]') && x.querySelector('[data-copycat]').dataset.copycat,
    unticked: [...x.querySelectorAll('[data-pray]')].filter(b => b.getAttribute('aria-pressed') !== 'true').map(b => b.dataset.pray) })));
  res.activeList = await f.evaluate(() => D.activeList);
  res.groups = groups.map(g => g.cat);
  res.openAtStart = await openCats();
  const withRow = groups.filter(g => g.cat && g.unticked.length);
  const g1 = withRow[0], g2 = withRow[1];
  const summ = c => f.click(`#allList details.cat:has(button[data-copycat="${c}"]) > summary > span:first-child`);
  // A
  await summ(g1.cat); await sleep(300);
  res.A_openBefore = await openCats();
  await d.shot(`${OUT}/verify-list-group-collapses-1-A-open.png`);
  const id = g1.unticked[0];
  await f.click(`#allList [data-pray="${id}"]`); await sleep(700);
  res.A_openAfter = await openCats();
  res.A_tickStored = await f.evaluate(id => L().prayers.find(p => p.id === id).lastPrayedAt === TODAY, id);
  res.A_tickedId = id;
  await d.shot(`${OUT}/verify-list-group-collapses-1-A-after-tick.png`);
  console.log('A group', g1.cat, '| open before', JSON.stringify(res.A_openBefore), '| after tick', JSON.stringify(res.A_openAfter), '| stored', res.A_tickStored);
  // B
  await summ(g1.cat); await summ(g2.cat); await sleep(300);
  res.B_openBefore = await openCats();
  const id2 = g2.unticked[0];
  await f.click(`#allList [data-pray="${id2}"]`); await sleep(700);
  res.B_openAfter = await openCats();
  console.log('B open before', JSON.stringify(res.B_openBefore), '| after tick in', g2.cat, JSON.stringify(res.B_openAfter));
  // C: another person's write on the family list
  await summ(g1.cat); await sleep(300);
  res.C_openBefore = await openCats();
  const fam = (await L.apiAs('christian', '/api/data/prayer?scope=family')).body.items.filter(i => i.key.startsWith('prayer:') && i.value);
  const row = fam[0];
  const w = await L.apiAs('christian', '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items: [{ key: row.key, value: { ...row.value, detail: (row.value.detail || '') + ' (Mae added a note)' }, updated_at: Date.now() }] } });
  res.C_write = w.status;
  await f.evaluate(() => hub.pull()); await sleep(1800);
  res.C_openAfter = await openCats();
  res.C_activeList = await f.evaluate(() => D.activeList);
  console.log('C Mae family write', w.status, '| Eli list', res.C_activeList, '| open before', JSON.stringify(res.C_openBefore), '| after pull', JSON.stringify(res.C_openAfter));
  // D: control with search
  await f.fill('#f-search', 'a'); await f.dispatchEvent('#f-search', 'input'); await sleep(400);
  const openD = await openCats();
  const idD = await f.evaluate(() => { const b = [...document.querySelectorAll('#allList [data-pray]')].find(b => b.getAttribute('aria-pressed') !== 'true'); return b && b.dataset.pray; });
  await f.evaluate(() => document.activeElement && document.activeElement.blur());
  if (idD) { await f.click(`#allList [data-pray="${idD}"]`); await sleep(600); }
  res.D_openBeforeCount = openD.length; res.D_openAfterCount = (await openCats()).length;
  console.log('D search control: open groups before', openD.length, '| after tick', res.D_openAfterCount);
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/verify-list-group-collapses-1.json`, JSON.stringify(res, null, 1)); await L.close(); }
