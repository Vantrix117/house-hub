// Skeptic #2 for finding "delete-copy-wrong" (Phase 3, Prayer). Lens: intent and context.
// The family-list delete confirm (apps/prayer.html:1258-1259) says "Sync does not carry deletions, so it can come back
// from another device." That wording matches the retired GitHub-JSON sync (handoff/prayer/SPEC.md:247-248); on hub.js,
// save() tombstones removed rows (prayer.html:692 -> hub.js:244 remove = set(key, null)).
// Two tests:
//   A) propagation: Mae's iPhone (online) holds s002; Eli deletes it on his phone; does Mae lose it after a pull/reopen?
//   B) the "can come back" clause: Mom's Kitchen iPad goes offline holding s001; Eli deletes s001; Mom taps Prayed on
//      s001 while offline and reconnects. Does s001 come back (LWW), and for everyone?
// Run: node "audits/tools/phase3/prayer/verify-delete-copy-wrong-2.mjs" -> audits/evidence/p3/prayer/verify-delete-copy-wrong-2.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const P = 'verify-delete-copy-wrong-2';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v)); };
const openFamily = async (d) => {
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(800);
  const sw = await f.$('#listSwitch [data-list="shared"]'); if (sw && await sw.isVisible()) { await sw.click(); await sleep(500); }
  return f;
};
const has = (f, id) => f.evaluate(id => ({ inData: D.lists.shared.prayers.some(p => p.id === id), rows: document.querySelectorAll(`[data-open="${id}"],[data-pray="${id}"]`).length }), id);
const srv = async id => { const r = await L.apiAs('christian', '/api/data/prayer?scope=family'); const it = (r.body.items || []).find(i => i.key === 'prayer:' + id);
  return it ? { present: true, tombstone: it.value == null, title: it.value && it.value.title, updated_at: it.updated_at } : { present: false }; };
const del = async (fe, id) => {
  await fe.click(`#todayList [data-open="${id}"], #allList [data-open="${id}"]`).catch(async () => { await fe.click('nav [data-go="all"]'); await sleep(300); await fe.click(`[data-open="${id}"]`); });
  await sleep(400); await fe.click(`[data-delete="${id}"]`); await sleep(300);
  const txt = await fe.evaluate(() => document.querySelector('.ask .line').textContent);
  await fe.click('#askSave'); await sleep(2500); return txt;
};
try {
  const mom = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false });
  const fm = await openFamily(mom);
  const mp = await L.newDevice({ name: 'Mae phone', profiles: ['christian'] });
  const mae = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false, as: mp });
  const fa = await openFamily(mae);
  const ep = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const eli = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ep });
  const fe = await openFamily(eli);
  const ids = await fe.evaluate(() => D.lists.shared.prayers.filter(p => p.status === 'active').map(p => p.id));
  log('familyActiveIds', ids);
  const A = ids.find(i => i !== 's001') || ids[1], B = 's001';
  // ── A: propagation ──
  log('A.maeBefore', await has(fa, A)); log('A.serverBefore', await srv(A));
  log('A.confirmText', await del(fe, A));

  log('A.serverAfterDelete', await srv(A));
  await fa.evaluate(() => hub.pull()); await sleep(5000);
  log('A.maeAfterPull', await has(fa, A));
  const fa2 = await openFamily(mae); log('A.maeReopen', await has(fa2, A));

  // ── B: the "can come back" clause (stale offline device writes the row again) ──
  log('B.momBefore', await has(fm, B));
  await mom.setOffline(true); await sleep(300);
  log('B.confirmText', await del(fe, B));
  log('B.serverAfterDelete', await srv(B));
  const rowBtn = await fm.$(`#todayList [data-pray="${B}"]`);
  log('B.momHasPrayButtonOffline', !!rowBtn);
  if (rowBtn) { await rowBtn.click(); await sleep(800); }
  await mom.setOffline(false); await sleep(1000);
  await fm.evaluate(() => hub.flush ? hub.flush() : hub.pull()).catch(() => {}); await sleep(5000);
  log('B.serverAfterMomReconnect', await srv(B));
  const fe2 = await openFamily(eli); log('B.eliReopen', await has(fe2, B));

  res.summary = {
    copyClaimsNoSync: /Sync does not carry deletions/.test(res['A.confirmText'] || ''),
    deletionPropagated: res['A.serverAfterDelete'].tombstone && !res['A.maeAfterPull'].inData && !res['A.maeReopen'].inData,
    staleOfflineWriteResurrects: res['B.serverAfterMomReconnect'].present && !res['B.serverAfterMomReconnect'].tombstone,
  };
  console.log('SUMMARY', JSON.stringify(res.summary));
} catch (e) { console.error('ERROR', e); res.error = String(e && e.stack || e); }
finally {
  fs.writeFileSync(`${OUT}/${P}.json`, JSON.stringify(res, null, 2));
  await L.close();
}
