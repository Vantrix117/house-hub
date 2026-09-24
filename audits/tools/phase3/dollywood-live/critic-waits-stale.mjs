// Completeness critic: live waits after the feed has been failing for hours while the map stays open.
// loadWaits (:1499-1505) falls back to the 6 h localStorage cache only when nothing was loaded yet (`if(!WAITS.at)`, :1504);
// once a load succeeded, a later failure keeps WAITS.by however old it gets. The Waits list shows an "as of … offline"
// stamp (:1525), but the ride markers' chips (:1507-1510), the Nearby "Next ride · door to seat" hero (:1554-1560) and the
// ride card keep using the old numbers.
// Park seed, real clock start, a Playwright clock installed so 7 h can pass; the waits route then answers 502.
// Run: node "audits/tools/phase3/dollywood-live/critic-waits-stale.mjs"
import { local, sleep, save, shot, openMap, latLon } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now(), as: ph });
  await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await d.goto('#home'); await sleep(1500);
  const f = await openMap(d, { settle: 2500 });
  await d.ctx.setGeolocation({ ...(await latLon(f, 762, 842)), accuracy: 6 });
  await f.evaluate(() => { if (watchId == null) document.getElementById('loc-btn').click(); });
  await f.waitForFunction(() => WAITS.at > 0 && me && me.src === 'gps', null, { timeout: 20000 });
  await sleep(1500);
  const snap = () => f.evaluate(() => {
    renderNear();
    const hero = document.querySelector('#near-list .lv-hero-card');
    const heroNum = hero ? +hero.dataset.n : null;
    const chip = heroNum != null && OFFNUM[heroNum] && OFFNUM[heroNum].el ? (OFFNUM[heroNum].el.querySelector('.lv-wait text') || {}).textContent : null;
    const nearText = document.getElementById('near-list').textContent.replace(/\s+/g, ' ').slice(0, 260);
    return { waitsAgeMin: Math.round((Date.now() - WAITS.at) / 60000), err: WAITS.err, feedUpdated: WAITS.updated, heroText: hero ? hero.textContent.replace(/\s+/g, ' ').trim() : null, heroMarkerChip: chip,
      nearbyHasStaleCue: /as of|offline|retrying|ago/i.test(nearText), src: (document.getElementById('lv-src') || {}).textContent || null, markerChips: document.querySelectorAll('.lv-wait').length };
  });
  out.A_fresh = await snap();
  await d.ctx.route('**/api/dollywood/waits', r => r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"upstream"}' }));
  await d.ctx.clock.fastForward('07:00:00');
  await d.ctx.setGeolocation({ ...(await latLon(f, 764, 844)), accuracy: 6 });   // a fresh fix so the hero is computed from "now"
  await sleep(1500);
  await f.evaluate(() => loadWaits());   // what the 60 s interval (:1455) runs
  await sleep(1500);
  out.B_after7hFailing = await snap();
  await f.evaluate(() => { document.getElementById('near-mode-waits').click(); });
  await sleep(500);
  out.B_waitsListHead = await f.evaluate(() => document.getElementById('near-list').textContent.replace(/\s+/g, ' ').slice(0, 200));
  await f.evaluate(() => { document.getElementById('near-mode-near').click(); });
  await sleep(500);
  await shot(d, 'critic-waits-stale-7h-iphone.png');
} catch (e) { out.error = String(e && e.stack || e); }
finally { save('critic-waits-stale.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
