// Completeness critic, Prayer. Two leads the report does not cover:
//  (1) editing a family request's title makes the Worker's prayer job announce it as "New on the family list"
//      (fingerprint = createdAt|title, worker/src/reminders.js:157, 181);
//  (2) "Send to family list" asks only how the title should read (apps/prayer.html:1308) but silently copies the private
//      request's "Who is it for?" into the family row (apps/prayer.html:1314), which the prayer push then puts on every
//      other adult's lock screen as "(for <for>)" (worker/src/reminders.js:198).
// UI only for the edits and the share; the prayer job is forced with the admin route POST /api/admin/cron/run {job:'prayer'}
// (the same route CLAUDE.md documents for demos). No push service is needed: the job's result lists what it would announce.
// Run: node "audits/tools/phase3/prayer/critic-push-share.mjs" -> audits/evidence/p3/prayer/critic-push-share.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 900)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const job = async () => { const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } }); return { status: r.status, new: r.body && r.body.new, notified: r.body && r.body.notified, seeded: r.body && r.body.seeded }; };
async function app(profile, device = 'iphone-pwa') {
  const d = await L.device({ device, profile });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(700);
  return { d, f };
}
try {
  log('job0 (baseline)', await job());
  log('job1 (control, nothing changed)', await job());
  // (1) Mae edits the wording of an existing family request through the Edit sheet
  const { d: md, f: mf } = await app('christian');
  await mf.click('#listSwitch [data-list="shared"]'); await sleep(500);
  const target = await mf.evaluate(() => { const p = D.lists.shared.prayers.find(x => x.id === 's002'); return { id: p.id, title: p.title, createdAt: p.createdAt }; });
  log('editTarget', target);
  await mf.click('nav [data-go="all"]'); await mf.fill('#f-search', target.title.slice(0, 12)); await sleep(300);
  await mf.click('#allList [data-open="s002"]'); await sleep(400);
  await mf.click('[data-edit="s002"]'); await sleep(300);
  await mf.fill('#e-title', target.title.replace('this week', 'this weekend'));
  await mf.click('[data-esave="s002"]'); await sleep(3500);
  const srv = await L.apiAs('christian', '/api/data/prayer?scope=family');
  const row = (srv.body.items || []).find(i => i.key === 'prayer:s002');
  log('serverAfterEdit', { title: row.value.title, createdAt: row.value.createdAt });
  log('job2 (after a title edit of an old request)', await job());
  await md.close();
  // (2) Eli shares a private request that has a "for"
  const { d: ed, f: ef } = await app('eli');
  if (await ef.evaluate(() => D.activeList) !== 'personal') { await ef.click('#listSwitch [data-list="personal"]'); await sleep(400); }
  const src = await ef.evaluate(() => { const p = D.lists.personal.prayers.find(x => x.status === 'active' && x.for); return p && { id: p.id, title: p.title, for: p.for, category: p.category }; });
  log('shareSource', src);
  await ef.click('nav [data-go="all"]'); await ef.fill('#f-search', src.title.slice(0, 14)); await sleep(300);
  await ef.click(`#allList [data-open="${src.id}"]`); await sleep(400);
  await ef.click(`[data-share="${src.id}"]`); await sleep(300);
  log('sharePanel', await ef.evaluate(() => ({ text: document.querySelector('.ask').innerText.replace(/\s+/g, ' ').trim(), fields: [...document.querySelectorAll('.ask input, .ask textarea, .ask select')].map(i => i.id + '=' + i.value) })));
  await ed.shot(`${OUT}/critic-share-panel.png`);
  await ef.fill('#askIn', 'A hard season for a friend');       // the adult rewrites the title to be discreet
  await ef.click('#askSave'); await sleep(3500);
  const srv2 = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const copy = (srv2.body.items || []).find(i => i.value && i.value.sharedFrom === src.id);
  log('familyCopyOnServer', copy && { key: copy.key, title: copy.value.title, for: copy.value.for, category: copy.value.category, by: copy.value.by });
  log('job3 (after the share)', await job());
  // what a kid sees on the family copy
  await ed.close();
  const { d: kd, f: kf } = await app('kiara', 'ipad-portrait');
  log('kidCardForCopy', await kf.evaluate(id => { const b = document.querySelector(`[data-kpray="${id}"]`); return b ? b.closest('li').innerText.replace(/\s+/g, ' ').trim() : null; }, copy && copy.value.id));
  await kd.close();
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/critic-push-share.json`, JSON.stringify(res, null, 2)); await L.close(); }
