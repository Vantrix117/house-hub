// Skeptic #2 for "import-wipes-family": does Prayer -> More -> Import a backup delete/overwrite other people's newer
// family-list changes on the server (not just "on this device", as its help text says, apps/prayer.html:1520)?
// Independent of import-family.mjs: Eli's device never calls hub.pull() by hand; it re-opens the app (the normal
// pull-on-open path) before importing. Kiara's and Mae's devices are checked after their own pulls.
// Steps (UI only, real clock, WebKit):
//   1. Eli (Kitchen iPad): More -> Export both lists -> the downloaded file is the backup.
//   2. Mae (her phone): Family list -> Add a request.
//   3. Kiara (her iPad): taps Prayed on a family card (first data-kpray button).
//   4. Eli: go Home, re-open Prayer (pull on open), More -> Import a backup -> paste -> Import.
//   5. Server rows, Mae's phone and Kiara's iPad after a pull.
// Run: node "audits/tools/phase3/prayer/verify-import-wipes-family-2.mjs"
//   -> audits/evidence/p3/prayer/verify-import-wipes-family-2.json (+ -mae-after.png, -kiara-after.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const TAG = 'verify-import-wipes-family-2';
const TITLE = 'Mae: verify2 request for Aunt Jo';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const famRows = async () => (await L.apiAs('eli', '/api/data/prayer?scope=family')).body.items.filter(i => i.key.startsWith('prayer:'));
async function open(d) {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 });
  await sleep(1000); return f;
}
try {
  const E = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  let fe = await open(E);
  await fe.click('nav [data-go="more"]'); await sleep(300);
  const [dl] = await Promise.all([E.page.waitForEvent('download', { timeout: 8000 }).catch(() => null), fe.click('#f-export')]);
  if (!dl) throw new Error('no download event from Export both lists');
  const backup = fs.readFileSync(await dl.path(), 'utf8');
  const bj = JSON.parse(backup);
  res.export = { name: dl.suggestedFilename(), bytes: backup.length, sharedPrayers: bj.lists.shared.prayers.length, personalPrayers: bj.lists.personal.prayers.length };
  console.log('1 export', JSON.stringify(res.export));

  const mp = await L.newDevice({ name: 'Mae phone v2', profiles: ['christian'] });
  const M = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false, as: mp });
  const fm = await open(M);
  await fm.click('#listSwitch [data-list="shared"]'); await sleep(300);
  await fm.click('nav [data-go="add"]'); await fm.fill('#f-title', TITLE); await fm.click('#f-save'); await sleep(2500);

  const kp = await L.newDevice({ name: 'Kiara iPad v2', profiles: ['kiara'] });
  const K = await L.device({ device: 'ipad-portrait', profile: 'kiara', fixedTime: false, as: kp });
  const fk = await open(K);
  const kid = await fk.evaluate(() => document.querySelector('[data-kpray][aria-pressed="false"]').dataset.kpray);
  await fk.click(`[data-kpray="${kid}"]`); await sleep(2500);
  const today = await fk.evaluate(() => TODAY);
  let rows = await famRows();
  const maeKey = (rows.find(i => i.value && i.value.title === TITLE) || {}).key;
  res.beforeImport = { today, kidCard: kid, maeKey, maeRowOnServer: !!maeKey,
    kiaraMarkOnServer: ((rows.find(i => i.key === 'prayer:' + kid).value.prayedBy || {})[today] || []) };
  console.log('2-3 before import', JSON.stringify(res.beforeImport));

  // 4. Eli: normal re-open (no manual hub.pull)
  await E.goto('#home'); await sleep(800);
  fe = await open(E); await sleep(2000);
  res.eliDeviceSawNewer = await fe.evaluate(([t, k, d]) => ({ maeRowLocal: D.lists.shared.prayers.some(p => p.title === t),
    kiaraMarkLocal: ((D.lists.shared.prayers.find(p => p.id === k) || {}).prayedBy || {})[d] || [] }), [TITLE, kid, today]);
  console.log('4 Eli device before import', JSON.stringify(res.eliDeviceSawNewer));
  await fe.click('nav [data-go="more"]'); await sleep(300);
  await fe.click('#f-import'); await sleep(400);
  res.helpText = await fe.evaluate(() => (document.querySelector('.ask .note') || {}).textContent);
  res.anyConfirmOrWarning = await fe.evaluate(() => (document.querySelector('.ask') || {}).innerText);
  await fe.fill('#askIn', backup); await fe.click('#askSave'); await sleep(3000);
  res.toast = await fe.evaluate(() => document.getElementById('toastMsg').textContent);
  res.syncState = await fe.evaluate(() => hub.sync.state);
  rows = await famRows();
  const maeAfter = rows.find(i => i.key === maeKey);
  const kidAfter = rows.find(i => i.key === 'prayer:' + kid);
  res.afterImport = { tombstones: rows.filter(i => i.value === null).map(i => i.key),
    maeRowValue: maeAfter ? (maeAfter.value === null ? 'TOMBSTONE' : maeAfter.value.title) : 'absent',
    maeRowUpdatedBy: maeAfter && (maeAfter.updated_by || maeAfter.by || null),
    kiaraMarkOnServer: ((kidAfter.value.prayedBy || {})[today] || []) };
  console.log('help:', res.helpText, '| toast:', res.toast, '| sync:', res.syncState);
  console.log('4 after import (server)', JSON.stringify(res.afterImport));

  // 5. other devices after their periodic pull (30 s)
  await sleep(34000);
  res.maePhone = await fm.evaluate(t => D.lists.shared.prayers.some(p => p.title === t), TITLE);
  res.kiaraIpad = await fk.evaluate(([k, d]) => ({ mark: ((D.lists.shared.prayers.find(p => p.id === k) || {}).prayedBy || {})[d] || [],
    pressed: (document.querySelector(`[data-kpray="${k}"]`) || {}).getAttribute?.('aria-pressed') }), [kid, today]);
  console.log('5 Mae phone still shows her request:', res.maePhone, '| Kiara iPad:', JSON.stringify(res.kiaraIpad));
  await fm.evaluate(() => { D.activeList = 'shared'; go('today'); }).catch(() => {}); await sleep(400);
  await M.shot(`${OUT}/${TAG}-mae-after.png`);
  await K.shot(`${OUT}/${TAG}-kiara-after.png`);
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(res, null, 1)); await L.close(); }
