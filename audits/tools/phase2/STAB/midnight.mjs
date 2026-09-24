// STAB (4): midnight rollover of "today" with the pages left open (no reload), Sunday 27 Sep 2026 → Monday 28 Sep (a new
// ISO week, so the kids' weekly stars must also start over).
//   node "audits/tools/phase2/STAB/midnight.mjs" [--night sun|tue]
// --night tue (Tuesday 22 → Wednesday 23, a reading day: Elizabeth and Mae read on Tuesday) runs home-adult, f260 and tv
// only, to see whether "read today" carries over; its files end in -tue.
//
// The Worker's demo clock is moved to Sunday 23:58 New York and the typical household is re-seeded relative to it, so the
// seed's "today" is Sunday: Elizabeth read and prayed today, Ezra has today's verse ★ (3 stars in week 39), Kiara has not
// prayed. Each surface gets its own WebKit context whose clock is installed at Sunday 23:59:20 and advanced with real pulls
// (advance.mjs). Before = 23:59:40, then the Worker's clock is moved past midnight, then each page runs 3 more minutes
// (≥ 6 pulls, 3 TV repaints) and is read again. Surfaces:
//   home-adult  Elizabeth's Home (ipad-portrait)       home-kid  Ezra's Home (ipad-portrait)       tv  the kiosk board
//   f260        Elizabeth with F260 open                kidverse  Ezra with Kid Verse open
//   prayer      Kiara with Prayer open (the family list); after midnight she taps "Prayed" and the stored day is checked
//   home-kid-switched  Ezra's Home reached by Me → Switch from Eli in the same page (the 30 s poll is gone, see poll.mjs)
//   leftovers   Elizabeth with Larder open (it has its own minute rollover, apps/leftovers.html:361-375)
// Output: audits/evidence/p2/STAB/midnight.json + midnight-<surface>-<before|after>.png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { advance, settle, shot1x } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const NIGHT = (() => { const i = process.argv.indexOf('--night'); return i > 0 ? process.argv[i + 1] : 'sun'; })();
const [SUN, MON] = NIGHT === 'tue' ? ['2026-09-22', '2026-09-23'] : ['2026-09-27', '2026-09-28'];
const SFX = NIGHT === 'tue' ? '-tue' : '';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const R = { surfaces: {} };
try {
  await L.clock(`${SUN}T23:58:00-04:00`); await L.reset('typical');
  const start = Date.parse(`${SUN}T23:59:20-04:00`);
  const ALL = {
    'home-adult': { device: 'ipad-portrait', profile: 'mom' },
    'home-kid': { device: 'ipad-portrait', profile: 'ezra' },
    tv: { device: 'tv', profile: 'tv' },
    f260: { device: 'ipad-portrait', profile: 'mom', app: 'f260' },
    kidverse: { device: 'ipad-portrait', profile: 'ezra', app: 'kidverse' },
    prayer: { device: 'ipad-portrait', profile: 'kiara', app: 'prayer' },
    leftovers: { device: 'ipad-portrait', profile: 'mom', app: 'leftovers' },
    'home-kid-switched': { device: 'ipad-portrait', profile: 'eli', switchTo: 'ezra' },
  };
  const S = NIGHT === 'tue' ? { 'home-adult': ALL['home-adult'], f260: ALL.f260, tv: ALL.tv } : ALL;
  const txt = (root, sel) => [...root.querySelectorAll(sel)].map(e => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const read = {
    'home-adult': d => d.page.evaluate(() => ({ now: new Date().toString().slice(0, 21), kicker: document.querySelector('#view-home .hero-kicker')?.innerText, title: document.querySelector('#view-home .hero-title')?.innerText, sub: document.querySelector('#view-home .hero-sub')?.innerText,
      cards: [...document.querySelectorAll('#view-home .gcard')].map(c => c.innerText.replace(/\s+/g, ' ').trim().slice(0, 160)) })),
    'home-kid-switched': d => read['home-kid'](d),
    'home-kid': d => d.page.evaluate(() => ({ now: new Date().toString().slice(0, 21), kicker: document.querySelector('#view-home .hero-kicker')?.innerText, title: document.querySelector('#view-home .hero-title')?.innerText, sub: document.querySelector('#view-home .hero-sub')?.innerText,
      stars: document.querySelector('#view-home .stars-card')?.innerText.replace(/\s+/g, ' ').trim() })),
    tv: d => d.page.evaluate(() => { const t = id => document.getElementById(id)?.innerText.replace(/\s+/g, ' ').trim(); return { now: new Date().toString().slice(0, 21), date: t('tv-date'), clock: t('clock'), greet: t('tv-greet'), verse: t('tv-verse-hd'), prayed: t('tv-prayed'), read: [...document.querySelectorAll('#tv-read .tv-face')].map(f => (f.classList.contains('off') ? '(dim) ' : '') + f.innerText.trim()), stars: t('tv-stars') }; }),
    f260: d => d.frame('f260').evaluate(() => ({ now: new Date().toString().slice(0, 21), todayKind: document.getElementById('todayKind')?.innerText, todayDate: document.getElementById('todayDate')?.innerText, todayRead: document.getElementById('today')?.classList.contains('read'), streak: document.getElementById('streak')?.innerText })),
    kidverse: d => d.frame('kidverse').evaluate(() => ({ now: new Date().toString().slice(0, 21), text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 400), days: [...document.querySelectorAll('.days span')].map(s => (s.classList.contains('today') ? '[' : '') + (s.classList.contains('on') ? '★' : s.textContent) + (s.classList.contains('today') ? ']' : '')).join(' ') })),
    leftovers: d => d.frame('leftovers').evaluate(() => ({ now: new Date().toString().slice(0, 21), dateValue: document.getElementById('date')?.value, dateMax: document.getElementById('date')?.max, larderToday: window.__larder && window.__larder.today(), ages: (document.body.innerText.match(/\b\d+d\b|\bToday\b|\bYesterday\b|\d+ days? ago/gi) || []).slice(0, 8) })),
    prayer: d => d.frame('prayer').evaluate(() => ({ now: new Date().toString().slice(0, 21), cards: [...document.querySelectorAll('[data-kpray]')].map(b => ({ id: b.dataset.kpray, pressed: b.getAttribute('aria-pressed'), card: b.closest('li')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 90) })) })),
  };
  const dev = {};
  for (const [k, s] of Object.entries(S)) {
    const d = await L.device({ device: s.device, profile: s.profile, installClock: start });
    await d.goto('#home');
    await d.page.waitForSelector(k === 'tv' ? '#tv #clock' : '#view-home .hero-title', { timeout: 15000 });
    if (s.app) await d.openApp(s.app);
    if (s.switchTo) {                                              // Eli hands the iPad to Ezra: Me → Switch → Ezra, in the same page
      await d.page.evaluate(() => { location.hash = '#me'; }); await d.page.waitForSelector('#switch'); await d.page.click('#switch');
      await d.page.waitForSelector(`#profiles .pcard[data-id="${s.switchTo}"]`); await d.page.click(`#profiles .pcard[data-id="${s.switchTo}"]`);
      await d.page.waitForFunction(pid => window.hub && hub.profile && hub.profile.id === pid && document.getElementById('gate').hidden, s.switchTo);
      await d.page.evaluate(() => { location.hash = '#home'; });
    }
    await advance(d, 20000); await settle(d, { min: 500 });
    dev[k] = d;
    R.surfaces[k] = { before: await read[k](d) };
    await shot1x(d, path.join(OUT, `midnight-${k}-before${SFX}.png`));
  }
  await L.clock(`${MON}T00:00:10-04:00`);                         // the Worker crosses midnight too
  for (const [k, d] of Object.entries(dev)) {
    await advance(d, 180000); await settle(d, { min: 500 });
    R.surfaces[k].after = await read[k](d);
    await shot1x(d, path.join(OUT, `midnight-${k}-after${SFX}.png`));
  }
  // Kiara taps "Prayed" on the first family prayer she has not prayed for, on Monday, with the app open since Sunday
  const pd = dev.prayer, pf = pd && pd.frame('prayer');
  const target = pf && await pf.evaluate(() => { const b = [...document.querySelectorAll('[data-kpray]')].find(x => x.getAttribute('aria-pressed') !== 'true'); return b && b.dataset.kpray; });
  if (pd && target) {
    await pf.click(`[data-kpray="${target}"]`);
    await pd.ctx.clock.runFor(1500); await settle(pd, { min: 800 });
    const rows = (await L.apiAs('kiara', '/api/data/prayer?scope=family')).body.items;
    const row = rows.find(r => r.key === 'prayer:' + target);
    const feed = (await L.apiAs('christian', '/api/activity?limit=5')).body.activity.filter(a => a.profile_id === 'kiara').slice(0, 1);
    R.prayerTap = { browserNow: await pf.evaluate(() => new Date().toString().slice(0, 24)), prayer: target, prayedByKeys: Object.keys(row.value.prayedBy || {}), kiaraOn: Object.entries(row.value.prayedBy || {}).filter(([, v]) => v.includes('Kiara')).map(([k]) => k), lastPrayedAt: row.value.lastPrayedAt, feedLine: feed.map(a => a.text) };
    // the TV (already past midnight) repaints each minute: does it show Kiara under "Prayed today"?
    await advance(dev.tv, 65000);
    R.prayerTap.tvPrayedToday = await dev.tv.page.evaluate(() => document.getElementById('tv-prayed').innerText.replace(/\s+/g, ' ').trim());
  }
  for (const [k, v] of Object.entries(R.surfaces)) console.log(k, '\n  before', JSON.stringify(v.before), '\n  after ', JSON.stringify(v.after));
  console.log('prayerTap', JSON.stringify(R.prayerTap));
  fs.writeFileSync(path.join(OUT, 'midnight' + SFX + '.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
