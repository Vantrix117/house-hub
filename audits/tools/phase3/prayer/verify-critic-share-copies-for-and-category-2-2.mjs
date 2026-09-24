// Skeptic #2 for finding critic-share-copies-for-and-category-2: "Send to family list" asks only for the title
// (apps/prayer.html:1306-1323) but copies the private request's `for` and `category` to the family row; the prayer push body
// adds "(for <for>)" (worker/src/reminders.js:196-198). Independent re-run on a fresh local instance (demo clock, WebKit).
// Also checks where the For actually surfaces: another adult's detail sheet, a guest, a kid's card (the kid card shows
// "<author> asked" when `by` is set, apps/prayer.html:1580-1582), and the kid-readable family API.
// Run: node "audits/tools/phase3/prayer/verify-critic-share-copies-for-and-category-2-2.mjs"
//   -> audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-2.json (+ -panel.png, -mom-sheet.png, -kid.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const TAG = 'verify-critic-share-copies-for-and-category-2-2';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 700)); };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const job = async () => { const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } }); return { status: r.status, new: r.body && r.body.new, skipped: r.body && r.body.skipped, seeded: r.body && r.body.seeded }; };
async function app(profile, device = 'iphone-pwa') {
  const d = await L.device({ device, profile });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800);
  return { d, f };
}
try {
  log('job0 seeds watermark', await job());
  const { d: ed, f: ef } = await app('eli');
  if (await ef.evaluate(() => D.activeList) !== 'personal') { await ef.click('#listSwitch [data-list="personal"]'); await sleep(400); }
  const src = await ef.evaluate(() => { const p = D.lists.personal.prayers.find(x => x.status === 'active' && x.for); return p && { id: p.id, title: p.title, for: p.for, category: p.category, detail: p.detail, phone: p.phone }; });
  log('privateSource', src);
  await ef.click('nav [data-go="all"]'); await ef.fill('#f-search', src.title.slice(0, 14)); await sleep(300);
  await ef.click(`#allList [data-open="${src.id}"]`); await sleep(400);
  await ef.click(`[data-share="${src.id}"]`); await sleep(400);
  log('sharePanel', await ef.evaluate(() => { const a = document.querySelector('.ask'); return { text: a.innerText.replace(/\s+/g, ' ').trim(), inputs: [...a.querySelectorAll('input,textarea,select')].map(i => ({ id: i.id, type: i.type, value: i.value })), mentionsFor: /for|who/i.test(a.innerText.replace(/How should this read on the family list\?/, '')) }; }));
  await ed.shot(`${OUT}/${TAG}-panel.png`);
  await ef.fill('#askIn', 'A hard season for a friend');
  await ef.click('#askSave'); await sleep(3500);
  const kidApi = await L.apiAs('ezra', '/api/data/prayer?scope=family');
  const copy = (kidApi.body.items || []).find(i => i.value && i.value.sharedFrom === src.id);
  log('familyCopyAsReadByKidApi', copy && { status: kidApi.status, key: copy.key, title: copy.value.title, for: copy.value.for, category: copy.value.category, detail: copy.value.detail, phone: copy.value.phone, by: copy.value.by });
  log('privateOriginalUnchanged', await ef.evaluate(id => { const p = D.lists.personal.prayers.find(x => x.id === id); return { title: p.title, for: p.for }; }, src.id));
  const j = await job();
  log('job after share', { new: j.new, skipped: j.skipped });
  // push body the job would build for an adult with this single new row (formula copied from worker/src/reminders.js:196-198)
  const v = copy.value; log('pushBodyPerCode', `New on the family list: ${v.title}${v.for ? ` (for ${v.for})` : ''}.`);
  await ed.close();
  // another adult (Mom) on the family list: detail sheet
  const { d: md, f: mf } = await app('mom');
  if (await mf.evaluate(() => D.activeList) !== 'shared') { await mf.click('#listSwitch [data-list="shared"]'); await sleep(500); }
  await mf.click('nav [data-go="all"]'); await mf.fill('#f-search', 'hard season'); await sleep(300);
  await mf.click(`#allList [data-open="${v.id}"]`); await sleep(500);
  log('momDetailSheet', await mf.evaluate(() => { const s = document.querySelector('#sheet, .sheet.on, [role=dialog]'); return s ? s.innerText.replace(/\s+/g, ' ').trim().slice(0, 400) : null; }));
  log('momAllListRow', await mf.evaluate(id => { const b = document.querySelector(`#allList [data-open="${id}"]`); return b ? b.innerText.replace(/\s+/g, ' ').trim() : null; }, v.id));
  await md.shot(`${OUT}/${TAG}-mom-sheet.png`);
  // can the author fix it afterwards? the family copy has the ordinary Edit sheet with "Who is it for?"
  log('momEditHasForField', await mf.evaluate(id => !!document.querySelector(`[data-edit="${id}"]`), v.id));
  await md.close();
  // kid view
  const { d: kd, f: kf } = await app('kiara', 'ipad-portrait');
  await sleep(1500);
  log('kidView', await kf.evaluate(id => { const b = document.querySelector(`[data-kpray="${id}"]`); const li = b && b.closest('li'); return { card: li ? li.innerText.replace(/\s+/g, ' ').trim() : null, bodyHasUncle: document.body.innerText.includes('Uncle Ray'), bodyHasCategory: document.body.innerText.includes('Those Who Are Lost') }; }, v.id));
  await kd.shot(`${OUT}/${TAG}-kid.png`);
  await kd.close();
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(res, null, 2)); await L.close(); }
