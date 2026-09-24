// Settings -> Backup -> "Import a backup" says "This replaces both lists on this device." (apps/prayer.html:1520), but the
// imported D is saved through save() (1524 -> 685-696): every family row is re-written with a new updated_at, and every
// family row that is not in the backup is deleted with hub.remove (692) — for the whole house, on every device.
// Under 200 rows, so this is not P2-SYNC-06 (which owns the >200-row drop and the false "Backup restored.").
// Steps (all UI, real clock):
//   1. Eli, kitchen iPad: More (nav) -> "Export both lists" -> the downloaded prayers-<date>.json is the backup.
//   2. Mae, her phone: Family -> Add "Mae: Grandma's cataract surgery" (a new family request after the backup).
//   3. Kiara, her iPad: taps Prayed on "Kiara's first weeks at preschool" (s004).
//   4. Eli: More (nav) -> Import a backup -> paste the file -> Import.
//   5. Server + Mae's phone after a pull: is Mae's request still there? Is Kiara's prayed mark still there?
// Run: node "audits/tools/phase3/prayer/import-family.mjs" -> audits/evidence/p3/prayer/import-family.json + PNG
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const fam = async () => { const r = await L.apiAs('eli', '/api/data/prayer?scope=family'); return r.body.items.filter(i => i.key.startsWith('prayer:')); };
async function open(d) { const f = await d.openApp('prayer', { wait: '#todayLine' }); await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(800); return f; }
try {
  const E = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const fe = await open(E);
  await fe.click('nav [data-go="more"]'); await sleep(300);
  const [dl] = await Promise.all([E.page.waitForEvent('download', { timeout: 8000 }).catch(e => null), fe.click('#f-export')]);
  let backup;
  if (dl) { const p = await dl.path(); backup = fs.readFileSync(p, 'utf8'); res.export = { via: 'download event', name: dl.suggestedFilename(), bytes: backup.length }; }
  else { backup = await fe.evaluate(() => JSON.stringify(D, null, 2)); res.export = { via: 'no download event in the rig; same JSON.stringify(D,null,2) as apps/prayer.html:1502', bytes: backup.length }; }
  console.log('export', JSON.stringify(res.export));
  res.familyBefore = (await fam()).filter(i => i.value).length;
  // 2. Mae adds a family request
  const ph = await L.newDevice({ name: 'Mae phone', profiles: ['christian'] });
  const M = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false, as: ph });
  const fm = await open(M);
  await fm.click('#listSwitch [data-list="shared"]'); await sleep(300);
  await fm.click('nav [data-go="add"]'); await fm.fill('#f-title', "Mae: Grandma's cataract surgery"); await fm.click('#f-save'); await sleep(2000);
  // 3. Kiara prays s004
  const kd = await L.newDevice({ name: 'Kiara iPad', profiles: ['kiara'] });
  const K = await L.device({ device: 'ipad-portrait', profile: 'kiara', fixedTime: false, as: kd });
  const fk = await open(K);
  await fk.click('[data-kpray="s004"]'); await sleep(2000);
  const mid = await fam();
  res.beforeImport = { maeRow: mid.some(i => i.value && i.value.title === "Mae: Grandma's cataract surgery"), kiaraMark: (mid.find(i => i.key === 'prayer:s004').value.prayedBy || {}) };
  console.log('before import', JSON.stringify(res.beforeImport));
  // 4. Eli imports
  await fe.evaluate(() => hub.pull()); await sleep(1500);
  await fe.click('#f-import'); await sleep(300);
  res.helpText = await fe.evaluate(() => document.querySelector('.ask .note').textContent);
  await fe.fill('#askIn', backup); await fe.click('#askSave'); await sleep(2500);
  res.toast = await fe.evaluate(() => document.getElementById('toastMsg').textContent);
  const after = await fam();
  const mae = after.find(i => i.value === null || (i.value && i.value.title === "Mae: Grandma's cataract surgery"));
  res.afterImport = { familyRows: after.filter(i => i.value).length, tombstones: after.filter(i => i.value === null).map(i => i.key),
    maeRow: after.some(i => i.value && i.value.title === "Mae: Grandma's cataract surgery"), kiaraMark: after.find(i => i.key === 'prayer:s004').value.prayedBy };
  console.log('help text:', res.helpText, '| toast:', res.toast);
  console.log('after import', JSON.stringify(res.afterImport));
  await sleep(33000);
  const maeSees = await fm.evaluate(() => D.lists.shared.prayers.map(p => p.title));
  res.maePhoneStillShows = maeSees.includes("Mae: Grandma's cataract surgery");
  console.log("Mae's phone after its pull still shows her request:", res.maePhoneStillShows);
  await fm.evaluate(() => go('today')); await sleep(300); await M.shot(`${OUT}/import-family-mae-phone-after.png`);
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/import-family.json`, JSON.stringify(res, null, 1)); await L.close(); }
