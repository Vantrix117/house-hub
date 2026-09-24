// Skeptic #2 re-check of the Prayer "id-collision" finding, written independently of id-collision.mjs.
// Claim: nextId() (apps/prayer.html:719-721) is 'p' + (rows this device holds + 1), so two devices adding before
// they see each other's row write the same 'prayer:<id>' key and last-write-wins keeps only one request.
// Different people and devices from the investigator's run:
//   S1  family list, Elizabeth (mom) on a phone and David (dad) on the kitchen iPad, both ONLINE, adds 2 s apart.
//   S2  Mae's (christian) PRIVATE list, her phone OFFLINE and the kitchen iPad online, then the phone reconnects.
//   S3  control: after the pulls, the loser adds again -> gets a fresh id, both rows survive (collision needs concurrency).
// Run: node "audits/tools/phase3/prayer/verify-id-collision-2.mjs"  -> audits/evidence/p3/prayer/verify-id-collision-2.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const rows = async (who, scope) => ((await L.apiAs(who, `/api/data/prayer?scope=${scope}`)).body.items || []).filter(i => i.key.startsWith('prayer:') && i.value);
async function open(d) {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 });
  await sleep(1000); return f;
}
async function add(f, title) {
  await f.click('nav [data-go="add"]'); await sleep(250);
  await f.fill('#f-title', title); await f.click('#f-save'); await sleep(300);
  return f.evaluate(t => { const p = D.lists[D.activeList].prayers.find(x => x.title === t); return p && p.id; }, title);
}
const state = f => f.evaluate(() => ({ sync: hub.sync && hub.sync.state, toast: (document.getElementById('toast') || {}).textContent || '' }));
const titlesOn = (f, which) => f.evaluate(w => D.lists[w].prayers.map(p => p.title), which);
try {
  // S1
  {
    const ph = await L.newDevice({ name: 'Elizabeth phone', profiles: ['mom'] });
    const A = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: ph });
    const B = await L.device({ device: 'ipad-portrait', profile: 'dad', fixedTime: false });
    const fa = await open(A), fb = await open(B);
    await fa.click('#listSwitch [data-list="shared"]'); await fb.click('#listSwitch [data-list="shared"]'); await sleep(400);
    const before = (await rows('mom', 'family')).length;
    const tA = 'Mom: safe travel for Aunt Ruth', tB = 'Dad: the roof estimate';
    const idA = await add(fa, tA); await sleep(2000);
    const idB = await add(fb, tB); await sleep(2000);
    await sleep(35000);                                  // one 30 s poll on each device
    const srv = await rows('mom', 'family');
    res.S1 = { familyRowsBefore: before, familyRowsAfter: srv.length, idA, idB,
      onServer: { [tA]: srv.some(r => r.value.title === tA), [tB]: srv.some(r => r.value.title === tB) },
      keyHolder: (srv.find(r => r.key === 'prayer:' + idA) || {}).value?.title || null,
      momPhoneShows: (await titlesOn(fa, 'shared')).filter(t => t === tA || t === tB),
      dadIpadShows: (await titlesOn(fb, 'shared')).filter(t => t === tA || t === tB),
      momPhoneState: await state(fa) };
    console.log('S1', JSON.stringify(res.S1));
    await fa.evaluate(() => go('today')); await sleep(400);
    await A.shot(`${OUT}/verify-id-collision-2-S1-mom-phone.png`);
    // S3 control on the same pair: now that both have pulled, the loser adds again.
    const t3 = 'Mom: safe travel for Aunt Ruth (again)';
    const id3 = await add(fa, t3); await sleep(3000); await sleep(33000);
    const srv3 = await rows('mom', 'family');
    res.S3 = { id3, familyRowsAfter: srv3.length, onServer: { [t3]: srv3.some(r => r.value.title === t3), [tB]: srv3.some(r => r.value.title === tB) } };
    console.log('S3', JSON.stringify(res.S3));
    await A.close(); await B.close();
  }
  // S2
  {
    await L.reset('typical');
    const ph = await L.newDevice({ name: 'Mae phone', profiles: ['christian'] });
    const A = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false, as: ph });
    const B = await L.device({ device: 'ipad-portrait', profile: 'christian', fixedTime: false });
    const fa = await open(A), fb = await open(B);
    await fa.click('#listSwitch [data-list="personal"]'); await fb.click('#listSwitch [data-list="personal"]'); await sleep(400);
    const before = (await rows('christian', 'person')).length;
    await A.setOffline(true);
    const tA = 'Mae private: patience at work', tB = 'Mae private: my sister\'s scan results';
    const idA = await add(fa, tA); await sleep(1000);
    const idB = await add(fb, tB); await sleep(2000);
    await A.setOffline(false); await sleep(38000);
    const srv = await rows('christian', 'person');
    res.S2 = { personRowsBefore: before, personRowsAfter: srv.length, idA, idB,
      onServer: { [tA]: srv.some(r => r.value.title === tA), [tB]: srv.some(r => r.value.title === tB) },
      phoneShows: (await titlesOn(fa, 'personal')).filter(t => t === tA || t === tB),
      ipadShows: (await titlesOn(fb, 'personal')).filter(t => t === tA || t === tB),
      phoneState: await state(fa), ipadState: await state(fb) };
    console.log('S2', JSON.stringify(res.S2));
    await A.close(); await B.close();
  }
} catch (e) { res.error = String(e && e.stack || e); console.error(e); }
finally {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/verify-id-collision-2.json`, JSON.stringify(res, null, 1));
  await L.close();
}
