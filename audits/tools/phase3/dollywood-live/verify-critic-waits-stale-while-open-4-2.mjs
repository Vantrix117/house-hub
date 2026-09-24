// Skeptic #2 for "critic-waits-stale-while-open-4": after the waits feed fails, does the open map keep showing old waits
// as current on the markers, the Nearby rows, the Next-ride hero and the ride card?
// Differences from the investigator: the failure is a real network loss (context offline), not a routed 502; the ride
// card is opened; and a control run reopens the map at the same instant to compare with the app's own 6 h cache rule
// (apps/dollywood-live.html:1504 — a reopened map drops waits older than 6 h).
// Park seed, real clock start, installed Playwright clock, WebKit, Eli iPhone.
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-waits-stale-while-open-4-2.mjs"
import { local, sleep, save, shot, openMap, latLon } from './_lib.mjs';
const P = 'verify-critic-waits-stale-while-open-4-2';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const snap = f => f.evaluate(() => {
  renderNear();
  const hero = document.querySelector('#near-list .lv-hero-card');
  const n = hero ? +hero.dataset.n : null;
  const rowChips = [...document.querySelectorAll('#near-list .lv-item .wt')].map(e => e.textContent).slice(0, 5);
  let card = null;
  if (n != null) { showOfficial(OFFNUM[n]); renderWaitCard(); const wl = pop.querySelector('.lv-waitline'); card = wl ? wl.textContent.replace(/\s+/g, ' ').trim() : null; }
  const nearText = document.getElementById('near-list').textContent;
  return {
    waitsAgeMin: Math.round((Date.now() - WAITS.at) / 60000), err: WAITS.err, ridesWithWait: Object.keys(WAITS.by).length,
    markerChips: document.querySelectorAll('.lv-wait').length,
    heroMarkerChip: n != null && OFFNUM[n].el ? (OFFNUM[n].el.querySelector('.lv-wait text') || {}).textContent || null : null,
    hero: hero ? hero.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : null,
    nearbyRowChips: rowChips, card,
    nearbyListStaleCue: /as of|offline|retrying|stale/i.test(nearText),
    footer: (document.getElementById('lv-src') || {}).textContent || null,
    stampElems: document.querySelectorAll('.lv-stamp').length,
  };
});
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now(), as: ph });
  await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await d.goto('#home'); await sleep(1500);
  let f = await openMap(d, { settle: 2500 });
  await d.ctx.setGeolocation({ ...(await latLon(f, 762, 842)), accuracy: 6 });
  await f.evaluate(() => { if (watchId == null) document.getElementById('loc-btn').click(); });
  await f.waitForFunction(() => WAITS.at > 0 && me && me.src === 'gps', null, { timeout: 20000 });
  await sleep(1500);
  out.A_fresh = await snap(f);
  // B: the phone loses the network for 90 min, then 7 h; the 60 s interval runs loadWaits (called directly here).
  await d.setOffline(true);
  for (const [label, dur] of [['B_offline90min', '01:30:00'], ['C_offline7h', '05:30:00']]) {
    await d.ctx.clock.fastForward(dur);
    await d.ctx.setGeolocation({ ...(await latLon(f, 764, 844)), accuracy: 6 });
    await sleep(1200);
    await f.evaluate(() => loadWaits()); await sleep(1200);
    out[label] = await snap(f);
  }
  await f.evaluate(() => { const p = document.querySelector('.pop-close,[data-close]'); if (p) p.click(); });
  await shot(d, P + '-7h-offline-iphone.png');
  await f.evaluate(() => document.getElementById('near-mode-waits').click()); await sleep(400);
  out.C_waitsListHead = await f.evaluate(() => document.getElementById('near-list').textContent.replace(/\s+/g, ' ').slice(0, 120));
  await f.evaluate(() => document.getElementById('near-mode-near').click()); await sleep(300);
  // D: control — back online but the feed still failing (502), and the map reopened at the same instant.
  await d.setOffline(false);
  await d.ctx.route('**/api/dollywood/waits', r => r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"upstream"}' }));
  await d.page.reload(); await sleep(2000);
  await d.goto('#home'); await sleep(1500);
  f = await openMap(d, { settle: 2500 });
  await d.ctx.setGeolocation({ ...(await latLon(f, 762, 842)), accuracy: 6 });
  await f.evaluate(() => { if (watchId == null) document.getElementById('loc-btn').click(); });
  await f.waitForFunction(() => WAITS.err === true && me, null, { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  out.D_reopenedSameInstant = await snap(f);
  out.D_cacheAgeMin = await f.evaluate(() => { try { const c = JSON.parse(localStorage.getItem('dollywood.live.waits') || 'null'); return c ? Math.round((Date.now() - c.at) / 60000) : null; } catch (e) { return 'err'; } });
} catch (e) { out.error = String(e && e.stack || e); }
finally { save(P + '.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
