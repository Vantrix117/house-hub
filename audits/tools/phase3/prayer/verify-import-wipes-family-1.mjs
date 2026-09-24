// Skeptic #1 for "import-wipes-family": does Prayer -> More -> Import a backup delete other people's newer family rows?
// Independent of import-family.mjs: Eli's import runs on a FRESH kitchen-iPad context opened after Mae's and Kiara's
// changes (a normal open, no forced hub.pull()), Mae's request is added from the Family list, Kiara prays through her
// kid card, and the server is read as Mae (not Eli). Real clock, WebKit, typical household, local rig only.
// Run: node "audits/tools/phase3/prayer/verify-import-wipes-family-1.mjs"
//   -> audits/evidence/p3/prayer/verify-import-wipes-family-1.json (+ -mae-after.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const TITLE = 'Verify: Aunt Ruth new job';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const famRows = async () => (await L.apiAs('christian', '/api/data/prayer?scope=family')).body.items.filter(i => i.key.startsWith('prayer:'));
async function open(d) {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 });
  await sleep(1000); return f;
}
try {
  // 1. Eli exports (real download)
  const E1 = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const fe1 = await open(E1);
  await fe1.click('nav [data-go="more"]'); await sleep(300);
  const [dl] = await Promise.all([E1.page.waitForEvent('download', { timeout: 10000 }), fe1.click('#f-export')]);
  const backup = fs.readFileSync(await dl.path(), 'utf8');
  res.export = { name: dl.suggestedFilename(), bytes: backup.length, familyPrayersInBackup: JSON.parse(backup).lists.shared.prayers.length };
  await E1.ctx.close();
  const b0 = await famRows();
  res.serverBefore = { live: b0.filter(i => i.value).length, tombstones: b0.filter(i => i.value === null).length };
  // 2. Mae adds a family request on her phone
  const ph = await L.newDevice({ name: 'Mae phone v', profiles: ['christian'] });
  const M = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false, as: ph });
  const fm = await open(M);
  await fm.click('#listSwitch [data-list="shared"]'); await sleep(300);
  await fm.click('nav [data-go="add"]'); await fm.fill('#f-title', TITLE); await fm.click('#f-save'); await sleep(2500);
  // 3. Kiara taps Prayed on her iPad (first un-prayed family card)
  const kd = await L.newDevice({ name: 'Kiara iPad v', profiles: ['kiara'] });
  const K = await L.device({ device: 'ipad-portrait', profile: 'kiara', fixedTime: false, as: kd });
  const fk = await open(K);
  const kid = await fk.evaluate(() => { const b = document.querySelector('[data-kpray][aria-pressed="false"]'); return b && b.dataset.kpray; });
  await fk.click(`[data-kpray="${kid}"]`); await sleep(2500);
  const today = await fk.evaluate(() => TODAY);
  const mid = await famRows();
  const maeKeyMid = (mid.find(i => i.value && i.value.title === TITLE) || {}).key;
  res.beforeImport = { kidPrayedId: kid, today, maeKey: maeKeyMid,
    kiaraMarkToday: ((mid.find(i => i.key === 'prayer:' + kid).value.prayedBy || {})[today]) || null };
  console.log('before import', JSON.stringify(res.beforeImport));
  // 4. Eli, a fresh open on the kitchen iPad (sees Mae's row and Kiara's mark), imports his earlier file
  const E2 = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const fe2 = await open(E2);
  res.eliSeesBeforeImport = await fe2.evaluate(([t, k, d]) => ({ mae: D.lists.shared.prayers.some(p => p.title === t),
    kiara: ((D.lists.shared.prayers.find(p => p.id === k) || {}).prayedBy || {})[d] || null }), [TITLE, kid, today]);
  await fe2.click('nav [data-go="more"]'); await sleep(300);
  await fe2.click('#f-import'); await sleep(400);
  res.helpText = await fe2.evaluate(() => (document.querySelector('.ask .note') || {}).textContent || null);
  await fe2.fill('#askIn', backup); await fe2.click('#askSave'); await sleep(3000);
  res.toast = await fe2.evaluate(() => document.getElementById('toastMsg').textContent);
  res.eliSync = await fe2.evaluate(() => hub.sync.state);
  const after = await famRows();
  const maeAfter = after.find(i => i.key === maeKeyMid);
  res.serverAfter = { live: after.filter(i => i.value).length, tombstones: after.filter(i => i.value === null).map(i => i.key),
    maeRowValue: maeAfter ? (maeAfter.value === null ? 'null (tombstone)' : maeAfter.value.title) : 'absent',
    kiaraMarkToday: ((after.find(i => i.key === 'prayer:' + kid).value.prayedBy || {})[today]) || null };
  console.log('help:', res.helpText, '| toast:', res.toast, '| sync:', res.eliSync);
  console.log('after import', JSON.stringify(res.serverAfter));
  // 5. Mae's and Kiara's devices after a pull
  await fm.evaluate(() => hub.pull()); await fk.evaluate(() => hub.pull()); await sleep(6000);
  res.maePhoneShowsRequest = await fm.evaluate(t => D.lists.shared.prayers.some(p => p.title === t), TITLE);
  res.kiaraDeviceMarkToday = await fk.evaluate(([k, d]) => (((D.lists.shared.prayers.find(p => p.id === k) || {}).prayedBy || {})[d]) || null, [kid, today]);
  res.kiaraCardPressed = await fk.evaluate(k => { const b = document.querySelector(`[data-kpray="${k}"]`); return b && b.getAttribute('aria-pressed'); }, kid);
  console.log('Mae phone shows request:', res.maePhoneShowsRequest, '| Kiara device mark:', JSON.stringify(res.kiaraDeviceMarkToday), '| card pressed:', res.kiaraCardPressed);
  await fm.evaluate(() => { document.querySelector('#listSwitch [data-list="shared"]').click(); go('today'); }); await sleep(500);
  await M.shot(`${OUT}/verify-import-wipes-family-1-mae-after.png`);
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/verify-import-wipes-family-1.json`, JSON.stringify(res, null, 1)); await L.close(); }
