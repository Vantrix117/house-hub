// Batch 0d supplement for apps/prayer.html. The Worker now refuses a kid's plant, so the original repro scripts measure the
// server, not the app. Here the payloads are planted by a household ADULT (Mae), which the Worker still accepts, to test
// the client fix: (A) crafted row id, (B) crafted plan id, (C) private feed lines, (D) a kid's tick is never refused.
// Run from the repo root: node audits/tools/phase6/0d/supp-0d-prayer.mjs  -> audits/evidence/p6/0d/p3/prayer/supp-0d-prayer.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/0d/p3/prayer';
fs.mkdirSync(OUT, { recursive: true });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 700)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
async function app(profile, device = 'iphone-pwa') {
  const d = await L.device({ device, profile, fixedTime: false });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => typeof D !== 'undefined' && D && document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(1200);
  return { d, f };
}
const fam = async () => (await L.apiAs('eli', '/api/data/prayer?scope=family')).body.items || [];
const errs = d => d.logs.filter(l => /pageerror|could not be saved|rejected/i.test(l)).map(l => l.slice(0, 140));
try {
  // (A) crafted row id, planted by Mae
  const rowPayload = 'zz1"><img src="x:" onerror="window.__xss=(window.__xss||0)+1"><i x="';
  const value = { id: rowPayload, title: 'Pray for the school play', for: '', phone: '', detail: '', category: 'Family', cadence: 'daily', days: [], status: 'active',
    createdAt: '2026-09-01', lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, updatedAt: new Date().toISOString() };
  const w = await L.apiAs('christian', '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items: [{ key: 'prayer:zz1', value, updated_at: Date.now() }] } });
  log('A.plantAsMae', { status: w.status, applied: w.body && w.body.results && w.body.results[0].applied });
  const k = await app('kiara', 'ipad-portrait');
  log('A.kiara', { xss: await k.f.evaluate(() => window.__xss || 0), rendered: await k.f.evaluate(() => D.lists.shared.prayers.some(p => p.title === 'Pray for the school play')), errors: errs(k.d) });
  await sleep(2500);
  log('A.serverRowAfterKid', (await fam()).some(i => i.key === 'prayer:zz1' && i.value));
  await k.d.close();
  const e = await app('eli');
  await e.f.click('#listSwitch [data-list="shared"]'); await sleep(1000);
  await e.f.click('nav [data-go="today"]'); await sleep(800);
  log('A.eli', { xss: await e.f.evaluate(() => window.__xss || 0), rendered: await e.f.evaluate(() => D.lists.shared.prayers.some(p => p.title === 'Pray for the school play')), errors: errs(e.d) });
  await sleep(3000);
  log('A.serverRowAfterEli', (await fam()).some(i => i.key === 'prayer:zz1' && i.value));
  await e.d.close();

  // (B) crafted plan id, planted by Mae after both pages are open
  const planPayload = 'plx"><img src="x:" onerror="window.__px=(window.__px||0)+1"><i x="';
  const plan = { id: planPayload, name: 'Everything', mode: 'everything', focusCategory: '', includeDaily: true, rotationSize: 3, groupByCategory: false,
    dayMap: { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] }, show: { meter: true, streak: true, answered: true, anniversaries: true, review: true } };
  const kid = await app('kiara', 'ipad-portrait');
  const eli = await app('eli');
  await sleep(4000);
  const now = Date.now();
  const w2 = await L.apiAs('christian', '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items: [{ key: 'plans', value: [plan], updated_at: now }, { key: 'activePlan', value: planPayload, updated_at: now }] } });
  log('B.plantAsMae', { status: w2.status, applied: (w2.body.results || []).map(r => r.applied) });
  const t0 = Date.now(); let pulled = false;
  while (Date.now() - t0 < 45000 && !pulled) { await sleep(1000); pulled = await kid.f.evaluate(() => hub.get('activePlan', { scope: 'family' }) !== undefined && String(hub.get('activePlan', { scope: 'family' })).startsWith('plx')); }
  await sleep(2500);
  log('B.kiara', { pulled, afterMs: Date.now() - t0, px: await kid.f.evaluate(() => window.__px || 0), planIds: await kid.f.evaluate(() => D.lists.shared.plans.map(p => p.id)), errors: errs(kid.d) });
  await eli.f.click('#listSwitch [data-list="shared"]'); await sleep(800);
  await eli.f.click('nav [data-go="more"]'); await sleep(800);
  log('B.eli', { px: await eli.f.evaluate(() => window.__px || 0), options: await eli.f.evaluate(() => [...document.querySelectorAll('#f-plan option')].map(o => o.value)), errors: errs(eli.d) });
  await eli.f.click('nav [data-go="today"]'); await sleep(600);
  const tick = await eli.f.evaluate(() => { const b = document.querySelector('#todayList .mark[data-pray]'); return b && b.dataset.pray; });
  if (tick) await eli.f.click(`#todayList .mark[data-pray="${tick}"]`);
  await sleep(3500);
  const items = await fam();
  const plans = items.find(i => i.key === 'plans'), active = items.find(i => i.key === 'activePlan');
  log('B.serverAfterEliSave', { ticked: tick, planIds: plans && plans.value && plans.value.map(p => p.id), activePlan: active && active.value });
  await kid.d.close();

  // (C) feed lines: private tick + answer, family tick
  const priv = await eli.f.evaluate(() => D.lists.personal.prayers.find(p => p.status === 'active'));
  await eli.f.click('#listSwitch [data-list="personal"]'); await sleep(800);
  await eli.f.evaluate(id => { const p = D.lists.personal.prayers.find(x => x.id === id); setPrayed(p, true); }, priv.id);
  await eli.f.evaluate(id => sheetFor(id), priv.id); await sleep(400);
  await eli.f.click(`[data-answer="${priv.id}"]`); await sleep(300);
  await eli.f.fill('#askIn', 'Benign.'); await eli.f.click('#askSave'); await sleep(3500);
  const feed = (await L.apiAs(null, '/api/activity?limit=100')).body.activity || [];
  const last = feed.filter(a => a.profile_id === 'eli').slice(0, 6).map(a => a.text);
  log('C.privateTitle', priv.title);
  log('C.eliFeedLines', last);
  log('C.privateTitleInFeed', feed.some(a => (a.text || '').includes(priv.title)));
  log('C.eliErrors', errs(eli.d));
  await eli.d.close();

  // (D) a kid's tick: only prayedBy / lastPrayedAt / updatedAt change, and nothing is refused
  const k2 = await app('kiara', 'ipad-portrait');
  const target = await k2.f.evaluate(() => { const b = document.querySelector('[data-kpray][aria-pressed="false"]'); return b && b.dataset.kpray; });
  const before = (await fam()).find(i => i.key === 'prayer:' + target);
  await k2.f.click(`[data-kpray="${target}"]`); await sleep(4000);
  const after = (await fam()).find(i => i.key === 'prayer:' + target);
  const changed = Object.keys({ ...before.value, ...after.value }).filter(x => JSON.stringify(before.value[x]) !== JSON.stringify(after.value[x]));
  const q = await k2.f.evaluate(() => Object.keys(localStorage).filter(x => x.startsWith('hub.queue.')).map(x => [x, (JSON.parse(localStorage.getItem(x) || '[]') || []).length]));
  log('D.kidTick', { target, changedFields: changed, prayedByToday: after.value.prayedBy && Object.entries(after.value.prayedBy).slice(-1), sync: await k2.f.evaluate(() => hub.sync && hub.sync.state), queues: q, errors: errs(k2.d) });
  await k2.d.close();
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/supp-0d-prayer.json`, JSON.stringify(res, null, 2)); await L.close(); }
