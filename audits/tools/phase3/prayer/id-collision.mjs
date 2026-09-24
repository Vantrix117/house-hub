// Prayer ids are sequential per list: nextId() = 'p' + (rows on this device + 1) (apps/prayer.html:719-721), and a share
// to the family list uses 's' + (family rows + 1) (1312-1314). Two devices that add before seeing each other's row pick
// the same key 'prayer:<id>', and last-write-wins (apps/hub.js:236, 295) keeps only one of the two requests.
// Variants (all through the shipped UI: nav Add -> type a title -> "Add to the list"):
//   A  family list, both devices online: Eli's phone adds, Mae's iPad adds 3 s later (before its 30 s pull).
//   B  family list, Mae's iPad offline (e.g. at church), both add, then the iPad reconnects.
//   C  Eli's own private list on his phone and the kitchen iPad, phone offline, both add, phone reconnects.
//   D  "Send to family list" from two people's private lists within seconds (the 's' ids).
// Run: node "audits/tools/phase3/prayer/id-collision.mjs" [A|B|C|D ...]  -> audits/evidence/p3/prayer/id-collision.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const only = process.argv.slice(2);
const want = v => !only.length || only.includes(v);
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const server = async (who, scope) => { const r = await L.apiAs(who, `/api/data/prayer?scope=${scope}`); return (r.body.items || []).filter(i => i.key.startsWith('prayer:') && i.value); };
async function open(d) {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 });
  await sleep(800); return f;
}
const toFamily = async f => { await f.click('#listSwitch [data-list="shared"]'); await sleep(300); };
async function add(f, title) {
  await f.click('nav [data-go="add"]'); await sleep(200);
  await f.fill('#f-title', title); await f.click('#f-save'); await sleep(200);
  return f.evaluate(t => { const p = D.lists[D.activeList].prayers.find(x => x.title === t); return p && p.id; }, title);
}
async function share(f, rowTitle, famTitle) {
  const id = await f.evaluate(t => D.lists.personal.prayers.find(p => p.title === t).id, rowTitle);
  await f.click('nav [data-go="all"]'); await sleep(200); await f.fill('#f-search', rowTitle); await sleep(300);   // List -> search opens the groups
  await f.click(`#allList [data-open="${id}"]`); await sleep(400);
  await f.click(`[data-share="${id}"]`); await sleep(200);
  await f.fill('#askIn', famTitle); await f.click('#askSave'); await sleep(300);
  return f.evaluate(t => { const p = D.lists.shared.prayers.find(x => x.title === t); return p && p.id; }, famTitle);
}
function report(name, rows, titles, extra = {}) {
  res[name] = { ...extra, found: titles.map(t => ({ title: t, onServer: rows.some(r => r.value.title === t), key: (rows.find(r => r.value.title === t) || {}).key || null })) };
  console.log(name, JSON.stringify(res[name]));
}
async function pair(profA, profB) {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: [profA] });
  const A = await L.device({ device: 'iphone-pwa', profile: profA, fixedTime: false, as: ph });
  const B = await L.device({ device: 'ipad-portrait', profile: profB, fixedTime: false });
  return { A, B, fa: await open(A), fb: await open(B) };
}
try {
  if (want('A')) {
    const { A, B, fa, fb } = await pair('eli', 'christian'); await toFamily(fa); await toFamily(fb);
    const before = (await server('eli', 'family')).length;
    const idA = await add(fa, 'Eli: rides for Grandma Jo'); await sleep(3000);
    const idB = await add(fb, 'Mae: the car repair bill'); await sleep(3000);
    await sleep(34000);                                       // both devices' 30 s pulls
    const rows = await server('eli', 'family');
    const t = ['Eli: rides for Grandma Jo', 'Mae: the car repair bill'];
    const onA = await fa.evaluate(() => D.lists.shared.prayers.map(p => p.title)), onB = await fb.evaluate(() => D.lists.shared.prayers.map(p => p.title));
    report('A', rows, t, { familyRowsBefore: before, familyRowsAfter: rows.length, idA, idB, phoneShows: t.map(x => onA.includes(x)), ipadShows: t.map(x => onB.includes(x)) });
    await fa.evaluate(() => go('today')); await sleep(300);
    await A.shot(`${OUT}/id-collision-A-eli-phone-after.png`);
    await A.close(); await B.close();
  }
  if (want('B')) {
    await L.reset('typical');
    const { A, B, fa, fb } = await pair('eli', 'christian'); await toFamily(fa); await toFamily(fb);
    await B.setOffline(true);
    const idB = await add(fb, 'Mae: the car repair bill'); await sleep(1000);
    const idA = await add(fa, 'Eli: rides for Grandma Jo'); await sleep(2000);
    await B.setOffline(false); await sleep(38000);
    const rows = await server('eli', 'family');
    report('B', rows, ['Eli: rides for Grandma Jo', 'Mae: the car repair bill'], { idA, idB, familyRowsAfter: rows.length });
    await A.close(); await B.close();
  }
  if (want('C')) {
    await L.reset('typical');
    const { A, B, fa, fb } = await pair('eli', 'eli');
    await A.setOffline(true);
    const idA = await add(fa, 'Private: courage for the talk with my boss'); await sleep(1000);
    const idB = await add(fb, 'Private: rest for Mae this week'); await sleep(2000);
    await A.setOffline(false); await sleep(38000);
    const rows = await server('eli', 'person');
    report('C', rows, ['Private: courage for the talk with my boss', 'Private: rest for Mae this week'], { idA, idB, personRowsAfter: rows.length });
    await A.close(); await B.close();
  }
  if (want('D')) {
    await L.reset('typical');
    const { A, B, fa, fb } = await pair('eli', 'mom');
    const idA = await share(fa, "Dad's knee recovery", "Eli asks: Dad's knee recovery"); await sleep(3000);
    const idB = await share(fb, 'Mrs. Patterson next door, recently widowed', 'Mom asks: Mrs. Patterson'); await sleep(3000);
    await sleep(34000);
    const rows = await server('eli', 'family');
    report('D', rows, ["Eli asks: Dad's knee recovery", 'Mom asks: Mrs. Patterson'], { idA, idB, familyRowsAfter: rows.length });
    await A.close(); await B.close();
  }
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/id-collision${only.length ? '-' + only.join('') : ''}.json`, JSON.stringify(res, null, 1)); await L.close(); }
