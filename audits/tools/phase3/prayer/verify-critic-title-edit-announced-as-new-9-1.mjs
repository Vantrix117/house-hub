// Skeptic #1 for "critic-title-edit-announced-as-new-9": does editing an old family request's wording make the Worker's
// prayer job list it as new (worker/src/reminders.js:157 fingerprint createdAt|title, :181 filter)?
// Independent of critic-push-share.mjs: fresh local instance, a DIFFERENT family row than s002, plus two controls:
//   control A = no change at all; control B = a detail-only edit through the same Edit sheet (title untouched).
// Recipients: the job's `skipped` list names who is excluded as the author ('author'); no push service is attached,
// so `notified` stays empty — the recipient set is read from `skipped` + reminders.js:193-201.
// Run: node "audits/tools/phase3/prayer/verify-critic-title-edit-announced-as-new-9-1.mjs"
//   -> audits/evidence/p3/prayer/verify-critic-title-edit-announced-as-new-9-1.json (+ one PNG of the saved sheet)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const NAME = 'verify-critic-title-edit-announced-as-new-9-1';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 700)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const job = async () => {
  const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } });
  return { status: r.status, new: r.body && r.body.new, notified: r.body && r.body.notified, skipped: r.body && r.body.skipped, seeded: r.body && r.body.seeded };
};
const famRow = async key => { const s = await L.apiAs('mom', '/api/data/prayer?scope=family'); const r = (s.body.items || []).find(i => i.key === key); return r && { title: r.value.title, createdAt: r.value.createdAt, by: r.value.by, detail: r.value.detail }; };
async function editVia(f, id, title, fn) {
  await f.click('nav [data-go="all"]'); await sleep(300);
  await f.fill('#f-search', title.slice(0, 12)); await sleep(400);   // search opens the collapsed groups
  await f.click(`#allList [data-open="${id}"]`); await sleep(400);
  await f.click(`[data-edit="${id}"]`); await sleep(300);
  await fn();
  await f.click(`[data-esave="${id}"]`); await sleep(3500);   // let hub.js flush
  await f.click('#sheet.on [data-shut]'); await sleep(400);   // saveEdit leaves the detail sheet open; tap Done
}
let d;
try {
  log('job0 baseline (seeds the watermark)', await job());
  log('job1 control A: nothing changed', await job());
  d = await L.device({ device: 'iphone-pwa', profile: 'christian' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(700);
  await f.click('#listSwitch [data-list="shared"]'); await sleep(500);
  const rows = await f.evaluate(() => D.lists.shared.prayers.filter(p => p.status === 'active').map(p => ({ id: p.id, title: p.title, createdAt: p.createdAt, by: p.by })));
  log('familyActiveRows', rows);
  // pick two rows other than s002 (the investigator's) that are not authored by Mae
  const pool = rows.filter(p => p.id !== 's002');
  const tgt = pool[0], ctl = pool[1];
  log('targets', { titleEdit: tgt, detailEdit: ctl });
  // control B: detail-only edit
  await editVia(f, ctl.id, ctl.title, async () => { await f.fill('#e-detail', 'Added a note on ' + Date.now()); });
  log('server after detail-only edit', await famRow('prayer:' + ctl.id));
  log('job2 control B: detail-only edit', await job());
  // the claim: title edit
  const newTitle = tgt.title + ' (updated)';
  await editVia(f, tgt.id, tgt.title, async () => { await f.fill('#e-title', newTitle); });
  await d.page.screenshot({ path: `${OUT}/${NAME}-after-save.png`, scale: 'css' });   // 1x CSS scale
  log('server after title edit', await famRow('prayer:' + tgt.id));
  const j3 = await job();
  log('job3 after title edit', j3);
  log('job4 control C: nothing changed since job3', await job());
  const adults = ['eli', 'christian', 'mom', 'dad', 'niece'];
  const authorSkipped = (j3.skipped || []).filter(s => s.why === 'author').map(s => s.profile);
  log('recipients (adults not skipped as author)', { authorSkipped, wouldBeNotified: adults.filter(a => !authorSkipped.includes(a)), editorIsMae: 'christian', editorIncluded: !authorSkipped.includes('christian') });
} catch (e) { log('error', String(e.stack || e)); }
finally {
  fs.writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(res, null, 2));
  try { if (d) await d.close(); } catch {}
  await L.close();
}
