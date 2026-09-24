// Skeptic 2 for finding "slow-start-person-wipe" (Prayer): does a slow or failed first prayer/person pull on a new device
// make Prayer overwrite the person's own list settings (prayerDays, plans, activePlan, rotationFor) on the server?
// Code under test: apps/hub.js:334-337 (hub.ready's 6 s race, skipped when any channel was pulled before),
// apps/hub.js:295 (pullScope skips server rows older than a queued write), apps/prayer.html:624-639 (listFromHub/load),
// :685-695 (save writes every LIST_KEY that differs from SNAP), :826-833 (todaySet freezes a rotation and calls save()).
// Arms, each on a freshly paired phone for Eli (empty localStorage), iphone-pwa, WebKit, real clock, variant typical:
//   A control  - no interference
//   B hold9s   - every GET /api/data/prayer?scope=person held 9 s (shell's and the app's)
//   C fail     - every GET /api/data/prayer?scope=person aborted (network error) for the first 15 s, then allowed
// Each arm: open #prayer via the shell, record first paint, POSTs to /api/data/prayer/batch, server state before/after (25 s),
// the stamps of the seeded rows vs the wall clock (to rule out the future-stamp rig artefact noted in 02-shell.md:2210).
// Run: node "audits/tools/phase3/prayer/verify-slow-start-person-wipe-2.mjs"
//   -> audits/evidence/p3/prayer/verify-slow-start-person-wipe-2.json (+ first-paint PNGs for B and C)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const KEYS = ['label', 'categories', 'prayerDays', 'plans', 'activePlan', 'rotationFor', 'activeList', 'lastExport'];
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = { startedAt: new Date().toISOString() };
async function state(scope) {
  const r = await L.apiAs('eli', `/api/data/prayer?scope=${scope}`);
  const get = k => r.body.items.find(i => i.key === k);
  const out = { now: r.body.now };
  for (const k of KEYS) { const it = get(k); if (!it) continue;
    const v = it.value;
    out[k] = { stampVsNowMs: it.updated_at - r.body.now,
      summary: k === 'prayerDays' ? (v || []).length : k === 'plans' ? (v || []).map(p => p.name) : k === 'rotationFor' ? (v && { date: v.date, n: (v.ids || []).length }) : v }; }
  out.prayerRows = r.body.items.filter(i => i.key.startsWith('prayer:') && i.value).length;
  return out;
}
async function run(label, mode) {
  const before = { person: await state('person'), family: await state('family') };
  const ph = await L.newDevice({ name: 'Eli new phone ' + label, profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const t0 = Date.now(); const events = [];
  await d.ctx.route(u => /\/api\/data\/prayer\?scope=person/.test(u.href), async r => {
    const at = Date.now() - t0;
    if (mode === 'hold9s') { events.push({ at, ev: 'person GET held' }); await sleep(9000); events.push({ at: Date.now() - t0, ev: 'person GET released' }); return r.continue(); }
    if (mode === 'fail' && at < 15000) { events.push({ at, ev: 'person GET aborted' }); return r.abort('failed'); }
    events.push({ at, ev: 'person GET passed' }); return r.continue();
  });
  d.page.on('request', q => { if (q.method() === 'POST' && q.url().includes('/api/data/prayer/batch')) {
    try { events.push({ at: Date.now() - t0, ev: 'POST ' + q.url().replace(/^.*\/api/, '/api'), keys: JSON.parse(q.postData()).items.map(i => i.key) }); } catch {} } });
  const f = await d.openApp('prayer');
  await f.waitForFunction(() => { const e = document.getElementById('todayLine'); return e && e.textContent.trim().length > 0; }, null, { timeout: 20000 });
  const text = () => f.evaluate(() => ({ headline: document.getElementById('todayLine').textContent.trim(), strip: document.getElementById('todayStrip').textContent.replace(/\s+/g, ' ').trim() }));
  const firstPaint = { ms: Date.now() - t0, ...(await text()) };
  if (mode !== 'control') await d.shot(`${OUT}/verify-slow-start-person-wipe-2-${label}-first-paint.png`);
  await sleep(25000);
  const after = { person: await state('person'), family: await state('family') };
  const shownAfter = await text();
  const sync = await d.hub(f);
  res[label] = { mode, before, firstPaint, events, after, shownAfter25s: shownAfter, syncAfter: sync.sync };
  const s = x => JSON.stringify({ prayerDays: x.person.prayerDays && x.person.prayerDays.summary, plans: x.person.plans && x.person.plans.summary, activePlan: x.person.activePlan && x.person.activePlan.summary, famDays: x.family.prayerDays && x.family.prayerDays.summary, famPlans: x.family.plans && x.family.plans.summary, rows: x.person.prayerRows });
  console.log(`\n[${label}] firstPaint ${firstPaint.ms} ms: "${firstPaint.headline}" | ${firstPaint.strip}`);
  console.log(`[${label}] events`, JSON.stringify(events.map(e => `${e.at}ms ${e.ev}${e.keys ? ' [' + e.keys.join(',') + ']' : ''}`)));
  console.log(`[${label}] before ${s(before)}`);
  console.log(`[${label}] after  ${s(after)}`);
  console.log(`[${label}] shown after 25 s: "${shownAfter.headline}" | ${shownAfter.strip}`);
  await d.close();
}
try {
  await run('A-control', 'control');
  await L.reset('typical'); await run('B-hold9s', 'hold9s');
  await L.reset('typical'); await run('C-fail', 'fail');
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/verify-slow-start-person-wipe-2.json`, JSON.stringify(res, null, 1)); await L.close(); }
