// Skeptic #1 for finding "delete-copy-wrong" (Phase 3, Prayer). Independent reproduction.
// Claim: the family-list delete confirm says "Sync does not carry deletions, so it can come back from another device."
// (apps/prayer.html:1258-1259) but save() sends a tombstone via hub.remove (692; hub.js:244 remove = set(key, null)).
// Test: Elizabeth's Kitchen iPad has the family list open (s001 cached). Eli deletes s001 from the Family list on his
// phone through the UI. Then: does the server hold a tombstone? Does Elizabeth's iPad drop s001 after a pull, stay
// without it after she ticks another row (save()), and after a fresh reopen? Does Eli's own reopen keep it gone?
// Run: node "audits/tools/phase3/prayer/verify-delete-copy-wrong-1.mjs"
//   -> audits/evidence/p3/prayer/verify-delete-copy-wrong-1.json (+ -confirm.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const P = 'verify-delete-copy-wrong-1';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '→', JSON.stringify(v)); };
const openFamily = async (d) => {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(800);
  const sw = await f.$('#listSwitch [data-list="shared"]'); if (sw && await sw.isVisible()) { await sw.click(); await sleep(500); }
  return f;
};
const has = f => f.evaluate(() => ({ inData: D.lists.shared.prayers.some(p => p.id === 's001'), inHub: hub.list('prayer:', { scope: 'family' }).some(r => r.key === 'prayer:s001'), rows: document.querySelectorAll('[data-open="s001"],[data-pray="s001"]').length }));
const srv = async () => { const r = await L.apiAs('mom', '/api/data/prayer?scope=family'); const it = (r.body.items || []).find(i => i.key === 'prayer:s001');
  return it ? { present: true, valueNull: it.value == null, title: it.value && it.value.title, updated_at: it.updated_at } : { present: false }; };
try {
  const M = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false });
  const fm = await openFamily(M);
  log('momBefore', await has(fm));
  log('serverBefore', await srv());

  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const E = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const fe = await openFamily(E);
  log('eliActiveList', await fe.evaluate(() => D.activeList));
  await fe.click('#todayList [data-open="s001"]'); await sleep(400);
  await fe.click('[data-delete="s001"]'); await sleep(400);
  log('confirmText', await fe.evaluate(() => document.querySelector('.ask .line').textContent));
  await E.shot(`${OUT}/${P}-confirm.png`);
  await fe.click('#askSave'); await sleep(2500);
  log('eliAfterDelete', await has(fe));
  log('serverAfterDelete', await srv());

  // Elizabeth's iPad: pull (what a visibilitychange / the 30 s timer does)
  await fm.evaluate(() => hub.pull()); await sleep(5000);   // absorbRemote may defer; give it time
  log('momAfterPull', await has(fm));
  // Elizabeth ticks another family row -> save() runs over her whole list
  const other = await fm.evaluate(() => { const b = document.querySelector('#todayList [data-pray]:not([data-pray="s001"])'); return b && b.dataset.pray; });
  if (other) { await fm.click(`#todayList [data-pray="${other}"]`); await sleep(2500); }
  log('momTickedOther', other);
  log('serverAfterMomSave', await srv());
  // Fresh reopen on both devices
  const fm2 = await openFamily(M); log('momReopen', await has(fm2));
  const fe2 = await openFamily(E); log('eliReopen', await has(fe2));
  log('serverFinal', await srv());
  const t = res.confirmText || '';
  res.verdictHint = { copyClaimsNoSync: /Sync does not carry deletions/.test(t), deletionSynced: res.serverAfterDelete.valueNull && !res.momAfterPull.inData && !res.momReopen.inData && res.serverFinal.valueNull };
  console.log('HINT', JSON.stringify(res.verdictHint));
} catch (e) { console.error('ERROR', e); res.error = String(e); }
finally {
  fs.writeFileSync(`${OUT}/${P}.json`, JSON.stringify(res, null, 2));
  await L.close();
}
