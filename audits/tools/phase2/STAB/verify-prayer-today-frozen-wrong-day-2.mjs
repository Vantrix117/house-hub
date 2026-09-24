// Skeptic #2 for STAB finding "prayer-today-frozen-wrong-day": Prayer left open past midnight records prayers on
// yesterday's date. Independent of midnight.mjs / advance.mjs (own clock loop, own reads).
//   node "audits/tools/phase2/STAB/verify-prayer-today-frozen-wrong-day-2.mjs"
// Steps (typical household, WebKit, iPad portrait, America/New_York):
//   1. Worker clock -> Sun 27 Sep 2026 23:58 NY, reseed (the seed's "today" = Sunday: Elizabeth + Ezra prayed, Kiara not).
//   2. Kiara's Kitchen-iPad page with an installed (controllable) clock at Sun 23:59:30; open Prayer (family list, kid cards).
//   3. Worker clock -> Mon 00:00:10; advance the page clock 3 min in 10 s slices (real pulls in between).
//   4. Kiara taps "Prayed" on a card she has not prayed. Read the row back from the local API.
//   5. A fresh TV (kiosk) page on Monday: what does "Prayed today" say?
//   6. Kid Verse as Kiara on Monday: where does the prayed star land (credited.prayed keys, week count)?
//   7. Control: reload Prayer (the shell's reload pill) on Monday and tap again -> stored under Monday?
//   8. (runs between 3 and 4) Adult side effect: Elizabeth's Prayer open since Sunday on the Family list; on Monday she
//      taps the tick of s002, prayed by her on Sunday and still shown ticked -> does that erase Sunday's record?
// Evidence: audits/evidence/p2/STAB/verify-prayer-frozen-2.json + verify-prayer-frozen-2-*.png (1x css)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
fs.mkdirSync(OUT, { recursive: true });
const SUN = '2026-09-27', MON = '2026-09-28';
const R = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });

// advance an installed clock in < 12 s slices, letting real network settle in between (hub.request aborts at 12 s page time)
async function run(d, ms) { for (let t = 0; t < ms; t += 10000) { await d.ctx.clock.runFor(Math.min(10000, ms - t)); await sleep(400); } }
const shot = (d, name) => d.page.screenshot({ path: path.join(OUT, `verify-prayer-frozen-2-${name}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
const famRow = async (who, id) => ((await L.apiAs(who, '/api/data/prayer?scope=family')).body.items || []).find(r => r.key === 'prayer:' + id);
const summary = r => r && { prayedBy: r.value.prayedBy, lastPrayedAt: r.value.lastPrayedAt, updated_at: r.updated_at };
const prayerState = f => f.evaluate(() => ({
  browserNow: new Date().toString().slice(0, 24),
  TODAY: (typeof TODAY !== 'undefined') ? TODAY : null,           // apps/prayer.html:712 (top-level const)
  header: (document.querySelector('.date') || {}).innerText || null,
  kidCards: [...document.querySelectorAll('[data-kpray]')].map(b => ({ id: b.dataset.kpray, pressed: b.getAttribute('aria-pressed'), who: (b.closest('li').querySelector('.kwho') || {}).innerText || '' })),
  adultRows: [...document.querySelectorAll('[data-pray]')].map(b => ({ id: b.dataset.pray, done: !!b.closest('.done, [aria-pressed="true"]') || b.getAttribute('aria-pressed') === 'true' || b.classList.contains('on') })),
}));

try {
  await L.clock(`${SUN}T23:58:00-04:00`); await L.reset('typical');
  const start = Date.parse(`${SUN}T23:59:30-04:00`);

  // ── Kiara ──
  const kid = await L.device({ device: 'ipad-portrait', profile: 'kiara', installClock: start });
  await kid.goto('#home'); await kid.page.waitForSelector('#view-home .hero-title', { timeout: 15000 });
  let kf = await kid.openApp('prayer'); await kf.waitForSelector('[data-kpray]', { timeout: 15000 });
  await run(kid, 10000);
  R.kidBefore = await prayerState(kf);

  // ── Elizabeth (adult) on the Family list ──
  const mom = await L.device({ device: 'ipad-portrait', profile: 'mom', installClock: start });
  await mom.goto('#home'); await mom.page.waitForSelector('#view-home .hero-title', { timeout: 15000 });
  const mf = await mom.openApp('prayer'); await mf.waitForSelector('[data-list="shared"]', { timeout: 15000 });
  await mf.click('[data-list="shared"]'); await sleep(300);
  await run(mom, 10000);
  R.momBefore = await prayerState(mf);
  R.serverBefore = { s001: summary(await famRow('mom', 's001')), s002: summary(await famRow('mom', 's002')), s004: summary(await famRow('mom', 's004')) };

  // ── midnight ──
  await L.clock(`${MON}T00:00:10-04:00`);
  await run(kid, 180000); await run(mom, 180000);
  R.kidAfterMidnight = await prayerState(kf);
  R.momAfterMidnight = await prayerState(mf);
  await shot(kid, 'kid-after-midnight');

  // 8. (run right after midnight, before Kiara's taps) Elizabeth, page open since Sunday on the Family list, taps the
  //    tick of s002 — a row she prayed on Sunday, still shown ticked — at Monday 00:03
  R.momTargetBefore = summary(await famRow('mom', 's002'));
  R.momRowShown = await mf.evaluate(() => [...document.querySelectorAll('[data-pray="s002"]')].filter(x => x.offsetParent !== null).map(x => x.getAttribute('aria-pressed')));
  await mf.click('[data-pray="s002"]:visible');
  await run(mom, 3000); await sleep(1000);
  R.momTap = { browserNow: await mf.evaluate(() => new Date().toString().slice(0, 24)), local: await mf.evaluate(() => { const v = hub.get('prayer:s002', { scope: 'family' }); return v && { prayedBy: v.prayedBy, lastPrayedAt: v.lastPrayedAt }; }), server: summary(await famRow('mom', 's002')), sync: await mf.evaluate(() => ({ ...hub.sync })) };
  await shot(mom, 'mom-after-tap');

  // 4. Kiara taps a card she has not prayed
  const target = R.kidAfterMidnight.kidCards.find(c => c.pressed !== 'true').id;
  await kf.click(`[data-kpray="${target}"]`);
  await run(kid, 2000); await sleep(800);
  R.kidTap = { target, browserNow: await kf.evaluate(() => new Date().toString().slice(0, 24)), server: summary(await famRow('kiara', target)) };

  // 5. fresh TV on Monday
  const tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.parse(`${MON}T00:04:00-04:00`) });
  await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock', { timeout: 15000 });
  await run(tv, 20000);
  R.tvAfterStaleTap = await tv.page.evaluate(() => ({ now: new Date().toString().slice(0, 24), date: document.getElementById('tv-date')?.innerText, prayed: document.getElementById('tv-prayed')?.innerText.replace(/\s+/g, ' ').trim(), stars: document.getElementById('tv-stars')?.innerText.replace(/\s+/g, ' ').trim() }));
  await tv.page.screenshot({ path: path.join(OUT, 'verify-prayer-frozen-2-tv-after-stale-tap.png'), scale: 'css', animations: 'disabled' });

  // 6. Kid Verse as Kiara (same page, so the shell's reconcile runs on Monday's clock)
  const kv = await kid.openApp('kidverse'); await kv.waitForLoadState('domcontentloaded');
  await run(kid, 15000); await sleep(800);
  const stars = ((await L.apiAs('kiara', '/api/data/kidverse?scope=person')).body.items || []).find(r => r.key === 'stars');
  R.kidverseAfterStaleTap = stars && { week: stars.value.week, count: stars.value.count, total: stars.value.total, creditedPrayed: stars.value.credited && stars.value.credited.prayed };

  // 7. control: reload Prayer on Monday, tap the same card again
  kf = await kid.openApp('prayer'); await kf.waitForSelector('[data-kpray]', { timeout: 15000 });
  await run(kid, 5000);
  R.kidAfterReload = await prayerState(kf);
  await kf.click(`[data-kpray="${target}"]`);
  await run(kid, 2000); await sleep(800);
  R.kidTapAfterReload = { server: summary(await famRow('kiara', target)) };
  await run(tv, 70000);
  R.tvAfterReloadTap = await tv.page.evaluate(() => document.getElementById('tv-prayed')?.innerText.replace(/\s+/g, ' ').trim());

  R.logs = { kid: kid.logs.filter(l => /error/i.test(l)).slice(0, 10), mom: mom.logs.filter(l => /error/i.test(l)).slice(0, 10) };
  fs.writeFileSync(path.join(OUT, 'verify-prayer-frozen-2.json'), JSON.stringify(R, null, 1));
  for (const [k, v] of Object.entries(R)) console.log(k, JSON.stringify(v));
} finally { await L.close(); }
