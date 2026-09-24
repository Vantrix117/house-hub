// Skeptic #2 for "stars-row-growth": does Kid Verse ever drop credited.story / credited.prayed days older than its
// 14-day look-back, and how many bytes does one Done ★ upload? Independent of rowsize.mjs.
//   node "audits/tools/phase3/kidverse/verify-stars-row-growth-2.mjs"
// Method: typical variant, demo clock. Plant 300 old credited days (2025) in Ezra's person row as the kid (the shape the
// app itself would have written a year earlier), clear today's verse ★ so Done is live, open Kid Verse as Ezra, tap Done,
// capture every POST .../kidverse/batch body, then read both server rows back and count the old keys.
// Also: the overflow variant's seeded row size, for the growth rate per year.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse');
fs.mkdirSync(EVID, { recursive: true });
const out = {};
const get = async (L, who, scope, key) => { const r = await L.apiAs(who, `/api/data/kidverse?scope=${scope}&key=${encodeURIComponent(key)}`); return r.body && r.body.item; };
const oldDates = n => Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(2025, 0, 1 + i)); return d.toISOString().slice(0, 10); });

let L = await local({ variant: 'typical', clock: 'demo' });
try {
  const cur = await get(L, 'ezra', 'person', 'stars');
  const v = JSON.parse(JSON.stringify(cur.value));
  const today = '2026-09-22';
  const planted = oldDates(150);
  v.credited = v.credited || { story: {}, prayed: {} };
  for (const d of planted) { v.credited.story[d] = true; v.credited.prayed[d] = true; }
  const hadToday = v.days && v.days[today];
  if (v.days) delete v.days[today];
  if (v.earnedAt) delete v.earnedAt['verse:' + today];
  const put = await L.apiAs('ezra', '/api/data/kidverse/batch?scope=person', { method: 'POST', body: { items: [{ key: 'stars', value: v, updated_at: cur.updated_at + 1 }] } });
  out.plant = { status: put.status, hadTodayVerse: !!hadToday, plantedStory: planted.length, plantedPrayed: planted.length, bytesBefore: JSON.stringify(cur.value).length, bytesPlanted: JSON.stringify(v).length };

  const d = await L.device({ device: 'iphone-pwa', profile: 'ezra' });
  const posts = [];
  d.page.on('request', q => { if (q.method() === 'POST' && /\/api\/data\/kidverse\/batch/.test(q.url())) { const b = q.postData() || ''; let keys = []; try { keys = JSON.parse(b).items.map(i => i.key); } catch {} posts.push({ scope: /scope=(\w+)/.exec(q.url())[1], bytes: b.length, keys }); } });
  const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' });
  for (let i = 0; i < 80 && !(await f.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull)).catch(() => false)); i++) await sleep(150);
  await sleep(1500);
  const before = posts.length;
  out.doneLiveBeforeTap = await f.evaluate(() => !document.querySelector('#done').classList.contains('today'));
  await f.click('#done');
  for (let i = 0; i < 80; i++) { await sleep(200); if (await f.evaluate(() => hub.sync.state === 'synced').catch(() => false) && posts.length > before) break; }
  await sleep(1200);
  out.postsOnOpen = posts.slice(0, before);
  out.postsOnTap = posts.slice(before);
  await d.page.screenshot({ path: path.join(EVID, 'verify-stars-row-growth-2-after-tap.png'), scale: 'css' });
  await d.close();

  const count = (val, kind) => planted.filter(x => val && val.credited && val.credited[kind] && val.credited[kind][x]).length;
  const p = await get(L, 'ezra', 'person', 'stars'), m = await get(L, 'eli', 'family', 'stars:ezra');
  out.after = {
    person: { days: p.value.days, oldStoryKept: count(p.value, 'story'), oldPrayedKept: count(p.value, 'prayed'), earnedAtKeys: Object.keys(p.value.earnedAt || {}).length, bytes: JSON.stringify(p.value).length, updatedAfterTap: p.updated_at > cur.updated_at + 1 },
    mirror: { oldStoryKept: count(m.value, 'story'), oldPrayedKept: count(m.value, 'prayed'), bytes: JSON.stringify(m.value).length },
  };
} finally { await L.close(); }

L = await local({ variant: 'overflow', clock: 'demo' });
try {
  const r = await get(L, 'ezra', 'person', 'stars'); const v = r.value;
  const ks = o => Object.keys(o || {}).sort();
  out.overflow = { bytes: JSON.stringify(v).length, creditedBytes: JSON.stringify(v.credited).length, story: ks(v.credited.story).length, prayed: ks(v.credited.prayed).length, first: ks(v.credited.prayed)[0], last: ks(v.credited.prayed).pop(), applied: ks(v.applied).length, payouts: (v.payouts || []).length, earnedAt: ks(v.earnedAt).length };
} finally { await L.close(); }
// growth ceiling: two credited keys a day ('"YYYY-MM-DD":true,' = 18 chars each) against the Worker's 900 KB cap
out.ceiling = { bytesPerDayMax: 36, bytesPerYearMax: 36 * 365, yearsTo900KB: +((900 * 1024) / (36 * 365)).toFixed(1) };
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(EVID, 'verify-stars-row-growth-2.json'), JSON.stringify(out, null, 1));
