// Skeptic #1 for finding "slow-start-person-wipe" (Prayer). Independent reproduction, three arms on fresh devices:
//   control  : no interference.
//   latency  : the prayer/person GET reaches the server at once (route.fetch) but its RESPONSE is held 9 s — a slow
//              cellular link where the server answered with the real rows. (The investigator held the request itself, so
//              the server answered after the POST; this arm checks the realistic ordering.)
//   fail503  : every prayer/person GET answers 503 for the first 5 s (a failed first pull), then passes through.
// Each arm: pair a new phone for Eli, open #prayer, record first paint + every POST to /api/data/prayer/batch, wait 20 s,
// read Eli's person scope and the family scope from the server. The DB is reset between arms.
// Run: node "audits/tools/phase3/prayer/verify-slow-start-person-wipe-1.mjs"
//   -> audits/evidence/p3/prayer/verify-slow-start-person-wipe-1.json (+ first-paint PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const snap = async scope => {
  const r = await L.apiAs('eli', `/api/data/prayer?scope=${scope}`);
  const g = k => (r.body.items.find(i => i.key === k) || {}).value;
  return { prayerDays: (g('prayerDays') || []).length, plans: (g('plans') || []).map(p => p.name), activePlan: g('activePlan'),
    categories: (g('categories') || []).length, label: g('label'), rows: r.body.items.filter(i => i.key.startsWith('prayer:') && i.value).length };
};
const PERSON_GET = u => /\/api\/data\/prayer\?scope=person/.test(u.href);
async function arm(label, install) {
  const before = { person: await snap('person'), family: await snap('family') };
  const ph = await L.newDevice({ name: 'Eli new phone ' + label, profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const posts = [];
  const t0 = Date.now();
  if (install) await install(d, t0);
  d.page.on('request', q => { if (q.method() === 'POST' && q.url().includes('/api/data/prayer/batch')) {
    try { posts.push({ atMs: Date.now() - t0, scope: q.url().replace(/^.*scope=/, ''), keys: JSON.parse(q.postData()).items.map(i => i.key) }); } catch {} } });
  const f = await d.openApp('prayer');
  await f.waitForFunction(() => { const e = document.getElementById('todayLine'); return e && e.textContent.trim().length > 0; }, null, { timeout: 20000 });
  const text = () => f.evaluate(() => ({ headline: document.getElementById('todayLine').textContent.trim(),
    strip: document.getElementById('todayStrip').textContent.replace(/\s+/g, ' ').trim() }));
  const firstPaint = { ms: Date.now() - t0, ...(await text()) };
  await d.shot(`${OUT}/verify-slow-start-person-wipe-1-${label}-first-paint.png`);
  await sleep(20000);
  const after = { person: await snap('person'), family: await snap('family') };
  res[label] = { before, firstPaint, posts, after, shownAfter20s: await text() };
  console.log('\n== ' + label); console.log(JSON.stringify(res[label], null, 0));
  await d.close();
}
try {
  await arm('control', null);
  await L.reset('typical');
  await arm('latency', async d => { await d.ctx.route(PERSON_GET, async r => { const resp = await r.fetch(); await sleep(9000); await r.fulfill({ response: resp }); }); });
  await L.reset('typical');
  await arm('fail503', async (d, t0) => { await d.ctx.route(PERSON_GET, async r => {
    if (Date.now() - t0 < 5000) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' });
    return r.continue(); }); });
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/verify-slow-start-person-wipe-1.json`, JSON.stringify(res, null, 1)); await L.close(); }
