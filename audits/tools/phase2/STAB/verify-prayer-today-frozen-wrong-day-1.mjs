// Skeptic #1 for STAB "prayer-today-frozen-wrong-day": Prayer left open past midnight records prayers on yesterday's date.
//   node "audits/tools/phase2/STAB/verify-prayer-today-frozen-wrong-day-1.mjs"
// Independent of midnight.mjs. Steps (WebKit, demo household re-seeded with the Worker clock at Sun 27 Sep 2026 23:58 NY):
//  A. Kiara's iPad, installed clock Sun 23:59:30, Prayer open (family list, kid mode). At Sun 23:59:45 she taps Prayed on
//     card #1 (a genuine Sunday prayer). The Worker clock moves to Mon 00:00:10 and the page runs 3 more minutes of real pulls.
//     At Mon ~00:03 she taps Prayed on card #2. Read the rows back from the local API.
//  C. A freshly loaded TV board on Monday (after the stale tap, before any control tap): what does "Prayed today" show?
//  D. A freshly loaded Kid Verse for Kiara on Monday (same point): which prayed days are credited in her stars row?
//  B. Control, last: the Prayer frame reloaded on Monday (fresh page load), she taps Prayed on card #3 → which day is stored?
// Output: audits/evidence/p2/STAB/verify-prayer-frozen-1.json + verify-prayer-frozen-1-{before,after}.png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { advance, settle, shot1x } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const R = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const row = async id => { const r = (await L.apiAs('kiara', '/api/data/prayer?scope=family')).body.items.find(x => x.key === 'prayer:' + id); return r && { lastPrayedAt: r.value.lastPrayedAt, kiaraOn: Object.entries(r.value.prayedBy || {}).filter(([, v]) => v.includes('Kiara')).map(([k]) => k), prayedByKeys: Object.keys(r.value.prayedBy || {}).sort() }; };
const state = f => f.evaluate(() => ({
  browserNow: new Date().toString().slice(0, 24),
  todayDate: document.getElementById('todayDate')?.innerText,
  todayLine: document.getElementById('todayLine')?.innerText,
  cards: [...document.querySelectorAll('[data-kpray]')].map(b => b.dataset.kpray + ' pressed=' + b.getAttribute('aria-pressed') + ' | ' + (b.closest('li')?.querySelector('.kwho')?.innerText.replace(/\s+/g, ' ').trim() || '-')),
}));
const unpressed = f => f.evaluate(() => [...document.querySelectorAll('[data-kpray]')].filter(b => b.getAttribute('aria-pressed') !== 'true').map(b => b.dataset.kpray));
try {
  await L.clock('2026-09-27T23:58:00-04:00'); await L.reset('typical');
  const d = await L.device({ device: 'ipad-portrait', profile: 'kiara', installClock: Date.parse('2026-09-27T23:59:30-04:00') });
  await d.goto('#home'); await d.page.waitForSelector('#view-home .hero-title', { timeout: 15000 });
  let f = await d.openApp('prayer'); await f.waitForSelector('[data-kpray]', { timeout: 15000 });
  await advance(d, 10000); await settle(d, { min: 400 });
  const free = await unpressed(f);
  R.unpressedAtStart = free;
  const [c1, c2, c3] = free;
  // A1: a real Sunday prayer at 23:59:4x
  await f.click(`[data-kpray="${c1}"]`); await d.ctx.clock.runFor(1500); await settle(d, { min: 600 });
  R.before = await state(f); R.card1_sunday = { id: c1, ...(await row(c1)) };
  await shot1x(d, path.join(OUT, 'verify-prayer-frozen-1-before.png'));
  // cross midnight: Worker clock + 3 min of page time with real pulls
  await L.clock('2026-09-28T00:00:10-04:00');
  await advance(d, 180000); await settle(d, { min: 600 });
  R.after = await state(f);
  await shot1x(d, path.join(OUT, 'verify-prayer-frozen-1-after.png'));
  // A2: the Monday tap with the page open since Sunday
  await f.click(`[data-kpray="${c2}"]`); await d.ctx.clock.runFor(1500); await settle(d, { min: 800 });
  R.card2_monday_stalePage = { id: c2, browserNow: await f.evaluate(() => new Date().toString().slice(0, 24)), ...(await row(c2)) };
  R.afterTap = await state(f);
  // C: a fresh TV board on Monday
  const tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.parse('2026-09-28T00:04:00-04:00') });
  await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock', { timeout: 15000 });
  await advance(tv, 20000); await settle(tv, { min: 500 });
  R.tvFresh = await tv.page.evaluate(() => ({ now: new Date().toString().slice(0, 24), date: document.getElementById('tv-date')?.innerText, prayed: document.getElementById('tv-prayed')?.innerText.replace(/\s+/g, ' ').trim() }));
  // D: a fresh Kid Verse for Kiara on Monday — which prayed days are credited?
  const kv = await L.device({ device: 'ipad-portrait', profile: 'kiara', installClock: Date.parse('2026-09-28T00:05:00-04:00') });
  await kv.goto('#home'); await kv.page.waitForSelector('#view-home .hero-title', { timeout: 15000 });
  await kv.openApp('kidverse'); await advance(kv, 20000); await settle(kv, { min: 800 });
  const stars = (await L.apiAs('kiara', '/api/data/kidverse?scope=person')).body.items.find(x => x.key === 'stars');
  const sv = stars && stars.value || {};
  R.kidverse = { week: sv.week, count: sv.count, total: sv.total, earned: sv.earned, creditedPrayed: sv.credited && sv.credited.prayed, days: sv.days };
  // B: control — reload the app on Monday, tap card 3
  await f.evaluate(() => { window.__skepticMark = 1; });
  await f.evaluate(() => location.reload()).catch(() => {});
  await sleep(1500); await d.ctx.clock.runFor(1000); await settle(d, { min: 800 });
  f = d.frame('prayer'); await f.waitForSelector('[data-kpray]', { timeout: 15000 });
  R.reloadedFresh = await f.evaluate(() => window.__skepticMark === undefined);
  R.reloaded = await state(f);
  await f.click(`[data-kpray="${c3}"]`); await d.ctx.clock.runFor(1500); await settle(d, { min: 800 });
  R.card3_monday_reloaded = { id: c3, browserNow: await f.evaluate(() => new Date().toString().slice(0, 24)), ...(await row(c3)) };
  console.log(JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(OUT, 'verify-prayer-frozen-1.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
