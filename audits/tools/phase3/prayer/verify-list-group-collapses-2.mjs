// Skeptic #2 for "list-group-collapses" (lens: intent / rig artefact). Is the List group folding on a tick an engine or
// rig artefact? Run in BOTH engines (WebKit rig + installed Chrome), iPhone PWA, Eli, typical seed, real clock.
//  1. open a group that sits low on the list (the 5th group with an unticked row), scroll it into view, tick a row:
//     open groups after? where does the ticked row's category header end up on screen (y before/after)?
//  2. reopen it, do nothing, wait 35 s (covers the 30 s poll and the tick's own flush echo): does it fold on its own?
//  3. reopen it, Mae (another person) edits a FAMILY row via the API, then hub.pull(): open groups after?
// Run: node "audits/tools/phase3/prayer/verify-list-group-collapses-2.mjs"
//   -> audits/evidence/p3/prayer/verify-list-group-collapses-2.json (+ two WebKit PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const all = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  const res = all[engine] = {};
  try {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(800);
    await f.click('nav [data-go="all"]'); await sleep(500);
    const openCats = () => f.evaluate(() => [...document.querySelectorAll('#allList details.cat')].filter(x => x.open)
      .map(x => x.querySelector('[data-copycat]').dataset.copycat));
    const groups = await f.evaluate(() => [...document.querySelectorAll('#allList details.cat')].map(x => ({
      cat: x.querySelector('[data-copycat]').dataset.copycat,
      unticked: [...x.querySelectorAll('[data-pray]')].filter(b => b.getAttribute('aria-pressed') !== 'true').map(b => b.dataset.pray) })));
    const g = groups.filter(x => x.unticked.length)[4] || groups.filter(x => x.unticked.length).slice(-1)[0];
    res.group = g.cat; res.groupCount = groups.length;
    const sumSel = `#allList details.cat:has(button[data-copycat="${g.cat}"]) > summary > span:first-child`;
    const openG = async () => { await f.click(sumSel); await sleep(300); };
    // 1
    await openG();
    const id = g.unticked[0];
    await f.evaluate(id => document.querySelector(`#allList [data-pray="${id}"]`).scrollIntoView({ block: 'center' }), id); await sleep(300);
    res.t1_openBefore = await openCats();
    res.t1_rowYBefore = await f.evaluate(id => Math.round(document.querySelector(`#allList [data-pray="${id}"]`).getBoundingClientRect().top), id);
    if (engine === 'webkit') await d.shot(`${OUT}/verify-list-group-collapses-2-webkit-1-before-tick.png`);
    await f.click(`#allList [data-pray="${id}"]`); await sleep(700);
    res.t1_openAfter = await openCats();
    res.t1_tickStored = await f.evaluate(id => L().prayers.find(p => p.id === id).lastPrayedAt === TODAY, id);
    res.t1_rowVisibleAfter = await f.evaluate(id => { const b = document.querySelector(`#allList [data-pray="${id}"]`); return !!(b && b.offsetParent); }, id);
    res.t1_headerYAfter = await f.evaluate(s => Math.round(document.querySelector(s).getBoundingClientRect().top), sumSel);
    if (engine === 'webkit') await d.shot(`${OUT}/verify-list-group-collapses-2-webkit-2-after-tick.png`);
    console.log(engine, '1 tick in', g.cat, '| open before', JSON.stringify(res.t1_openBefore), '| after', JSON.stringify(res.t1_openAfter),
      '| stored', res.t1_tickStored, '| ticked row still visible', res.t1_rowVisibleAfter, '| row y', res.t1_rowYBefore, '-> header y', res.t1_headerYAfter);
    // 2: idle 35 s, no one else writes
    await openG();
    res.t2_openBefore = await openCats();
    await sleep(35000);
    res.t2_openAfterIdle = await openCats();
    console.log(engine, '2 idle 35 s | open before', JSON.stringify(res.t2_openBefore), '| after', JSON.stringify(res.t2_openAfterIdle));
    // 3: another person's family-scope edit
    if (!(await openCats()).includes(g.cat)) await openG();
    res.t3_openBefore = await openCats();
    const fam = (await L.apiAs('christian', '/api/data/prayer?scope=family')).body.items.filter(i => i.key.startsWith('prayer:') && i.value);
    const row = fam[0];
    const w = await L.apiAs('christian', '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items: [{ key: row.key, value: { ...row.value, detail: (row.value.detail || '') + ' (note from Mae)' }, updated_at: Date.now() }] } });
    res.t3_write = w.status;
    await f.evaluate(() => hub.pull()); await sleep(1800);
    res.t3_openAfter = await openCats();
    res.t3_activeList = await f.evaluate(() => D.activeList);
    console.log(engine, '3 Mae family edit', w.status, '| Eli viewing', res.t3_activeList, '| open before', JSON.stringify(res.t3_openBefore), '| after pull', JSON.stringify(res.t3_openAfter));
  } catch (e) { console.error(engine, e); res.error = String(e.stack || e); }
  finally { await L.close(); }
}
fs.writeFileSync(`${OUT}/verify-list-group-collapses-2.json`, JSON.stringify(all, null, 1));
