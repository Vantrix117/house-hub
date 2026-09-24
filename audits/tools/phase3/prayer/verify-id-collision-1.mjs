// Skeptic #1 re-check of the Prayer "id-collision" finding: do two devices adding a request through the shipped UI pick
// the same prayer:<id> key, and does last-write-wins then drop one request everywhere?
//   V1  family list, Eli's phone and Mae's iPad both online, adds 3 s apart (inside one 30 s poll).
//   V2  Eli's private list, his phone offline, the kitchen iPad (also Eli) adds; phone reconnects.
// Run: node "audits/tools/phase3/prayer/verify-id-collision-1.mjs"  -> audits/evidence/p3/prayer/verify-id-collision-1.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const rows = async (who, scope) => ((await L.apiAs(who, `/api/data/prayer?scope=${scope}`)).body.items || [])
  .filter(i => i.key.startsWith('prayer:') && i.value);
async function open(d) {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 });
  await sleep(1000); return f;
}
async function addViaUi(f, title) {
  await f.click('nav [data-go="add"]'); await sleep(250);
  await f.fill('#f-title', title); await f.click('#f-save'); await sleep(300);
  return f.evaluate(t => { for (const k of Object.keys(D.lists)) { const p = D.lists[k].prayers.find(x => x.title === t); if (p) return p.id; } return null; }, title);
}
const titlesOn = (f, list) => f.evaluate(l => D.lists[l].prayers.map(p => p.title), list);
try {
  // V1
  {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const A = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const B = await L.device({ device: 'ipad-portrait', profile: 'christian', fixedTime: false });
    const fa = await open(A), fb = await open(B);
    for (const f of [fa, fb]) { await f.click('#listSwitch [data-list="shared"]'); await sleep(300); }
    const before = (await rows('eli', 'family')).map(r => r.key);
    const tA = 'V1 Eli: new job for Sam', tB = 'V1 Mae: safe travel for Aunt Ruth';
    const idA = await addViaUi(fa, tA); await sleep(3000);
    const idB = await addViaUi(fb, tB);
    await sleep(36000);  // past both devices' 30 s pulls
    const after = await rows('eli', 'family');
    out.V1 = { familyKeysBefore: before.length, idA, idB, sameKey: idA === idB, familyRowsAfter: after.length,
      onServer: { [tA]: after.some(r => r.value.title === tA), [tB]: after.some(r => r.value.title === tB) },
      serverRowForKey: (after.find(r => r.key === 'prayer:' + idA) || {}).value?.title || null,
      phoneShows: { [tA]: (await titlesOn(fa, 'shared')).includes(tA), [tB]: (await titlesOn(fa, 'shared')).includes(tB) },
      ipadShows: { [tA]: (await titlesOn(fb, 'shared')).includes(tA), [tB]: (await titlesOn(fb, 'shared')).includes(tB) } };
    console.log('V1', JSON.stringify(out.V1));
    await fa.evaluate(() => go('all')); await sleep(400);
    await A.shot(`${OUT}/verify-id-collision-1-V1-eli-phone.png`);
    await A.close(); await B.close();
  }
  // V2
  {
    await L.reset('typical');
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const A = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const B = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const fa = await open(A), fb = await open(B);
    const before = (await rows('eli', 'person')).length;
    await A.setOffline(true);
    const tA = 'V2 phone: patience with the kids', tB = 'V2 iPad: wisdom for the budget';
    const idA = await addViaUi(fa, tA); await sleep(1500);
    const idB = await addViaUi(fb, tB); await sleep(2000);
    await A.setOffline(false); await sleep(38000);
    const after = await rows('eli', 'person');
    out.V2 = { personRowsBefore: before, idA, idB, sameKey: idA === idB, personRowsAfter: after.length,
      onServer: { [tA]: after.some(r => r.value.title === tA), [tB]: after.some(r => r.value.title === tB) },
      phoneShows: { [tA]: (await titlesOn(fa, 'personal')).includes(tA), [tB]: (await titlesOn(fa, 'personal')).includes(tB) },
      ipadShows: { [tA]: (await titlesOn(fb, 'personal')).includes(tA), [tB]: (await titlesOn(fb, 'personal')).includes(tB) } };
    console.log('V2', JSON.stringify(out.V2));
    await A.close(); await B.close();
  }
} catch (e) { out.error = String(e && e.stack || e); console.error(e); }
finally {
  fs.writeFileSync(`${OUT}/verify-id-collision-1.json`, JSON.stringify(out, null, 2));
  await L.close();
}
