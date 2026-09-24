// Lead 2 (01-leads.md): a first open of Prayer on a device whose prayer/person pull is slow (> 6 s, the hub.ready race at
// apps/hub.js:334-337) builds Eli's private list from an empty cache (apps/prayer.html:624-639), and todaySet() freezes a
// new rotation and calls save() (826-833), which writes every list key from defaults (685-693). pullScope then skips
// server rows older than the queued write (apps/hub.js:295), so the flush replaces Eli's real plans, streak days
// (prayerDays) and rotation. P2-SYNC-02 owns the family-scope version of this (first open, hub.ready not waiting).
// Steps: pair a new phone for Eli; hold GET /api/data/prayer?scope=person for 9 s; open #prayer; wait 20 s; read the server.
// Control: the same with no hold.
// Run: node "audits/tools/phase3/prayer/slow-start.mjs" -> audits/evidence/p3/prayer/slow-start.json + PNG
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const person = async () => { const r = await L.apiAs('eli', '/api/data/prayer?scope=person'); const g = k => (r.body.items.find(i => i.key === k) || {}).value; const plans = g('plans') || [];
  return { prayerDays: (g('prayerDays') || []).length, plans: plans.map(p => p.name), activePlan: g('activePlan'), rows: r.body.items.filter(i => i.key.startsWith('prayer:') && i.value).length }; };
async function run(label, holdMs) {
  const before = await person();
  const ph = await L.newDevice({ name: 'Eli new phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const posts = [];
  await d.ctx.route(u => /\/api\/data\/prayer\?scope=person/.test(u.href), async r => { if (holdMs) await sleep(holdMs); r.continue(); });
  d.page.on('request', q => { if (q.method() === 'POST' && q.url().includes('/api/data/prayer/batch')) { try { posts.push({ url: q.url().replace(/^.*\/api/, '/api'), keys: JSON.parse(q.postData()).items.map(i => i.key) }); } catch {} } });
  const t0 = Date.now();
  const f = await d.openApp('prayer');
  await f.waitForFunction(() => document.getElementById('todayLine') && document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 });
  const firstPaint = { ms: Date.now() - t0, headline: await f.evaluate(() => document.getElementById('todayLine').textContent), strip: await f.evaluate(() => document.getElementById('todayStrip').textContent.replace(/\s+/g, ' ')) };
  await d.shot(`${OUT}/slow-start-${label}-first-paint.png`);
  await sleep(20000);
  const after = await person();
  const shown = { headline: await f.evaluate(() => document.getElementById('todayLine').textContent), strip: await f.evaluate(() => document.getElementById('todayStrip').textContent.replace(/\s+/g, ' ')) };
  res[label] = { holdMs, before, firstPaint, posts, after, shownAfter20s: shown };
  console.log(label, JSON.stringify(res[label]));
  await d.close();
}
try { await run('control', 0); await L.reset('typical'); await run('hold9s', 9000); }
catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/slow-start.json`, JSON.stringify(res, null, 1)); await L.close(); }
