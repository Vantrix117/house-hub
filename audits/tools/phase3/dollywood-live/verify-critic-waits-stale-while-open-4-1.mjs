// Skeptic #1 for critic-waits-stale-while-open-4: once waits have loaded, does a long feed/network failure leave the
// marker chips, the Nearby "Next ride" hero, the ride card and the directions bar showing the old waits with no stale cue?
// Independent of the investigator's script: the phone goes OFFLINE (the rig's setOffline: every non-site host aborts)
// instead of a 502 route, and the app's own 60 s setInterval (:1455) is left to fire via clock.runFor — loadWaits is
// never called by hand. Then (C) the map is reopened to show the 6 h cache limit (:1504) does apply on a fresh open.
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-waits-stale-while-open-4-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
const P = 'verify-critic-waits-stale-while-open-4-1';
fs.mkdirSync(EV, { recursive: true });
const shot = async (d, n) => { const p = path.join(EV, `${P}-${n}.png`); await d.page.screenshot({ path: p, scale: 'css', animations: 'disabled', caret: 'hide' }); console.log('shot', p); };

const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now(), as: ph });
  await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
  const open = async () => {
    const f = await d.openApp('dollywood-live');
    await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
    await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
    await sleep(2000); return f;
  };
  let f = await open();
  const ll = ([x, y]) => f.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [x, y]);
  await d.ctx.setGeolocation({ ...(await ll([700, 800])), accuracy: 6 });
  await f.evaluate(() => { if (watchId == null) document.getElementById('loc-btn').click(); });
  await f.waitForFunction(() => WAITS.at > 0 && me && me.src === 'gps' && inFrame([me.x, me.y]), null, { timeout: 20000 });
  await sleep(1500);
  const snap = () => f.evaluate(() => {
    renderNear();
    const hero = document.querySelector('#near-list .lv-hero-card');
    const n = hero ? +hero.dataset.n : null; const o = n != null ? OFFNUM[n] : null;
    const chip = o && o.el ? (o.el.querySelector('.lv-wait text') || {}).textContent : null;
    const chipOpacity = o && o.el && o.el.querySelector('.lv-wait') ? getComputedStyle(o.el.querySelector('.lv-wait')).opacity : null;
    const near = document.getElementById('near-list').textContent.replace(/\s+/g, ' ');
    return { nowISO: new Date().toISOString(), waitsAgeMin: Math.round((Date.now() - WAITS.at) / 60000), err: WAITS.err, ridesWithWait: Object.keys(WAITS.by).length,
      markerChips: document.querySelectorAll('.lv-wait').length, heroNum: n, heroText: hero ? hero.textContent.replace(/\s+/g, ' ').trim() : null, heroMarkerChip: chip, chipOpacity,
      nearbyStaleCue: (near.match(/as of|offline|retrying|stale|old/i) || [null])[0], nearbyFooter: (document.getElementById('lv-src') || {}).textContent || null };
  });
  out.A_fresh = await snap();
  await shot(d, 'A-fresh');

  // the phone loses the network; 7 h pass; the app's own 60 s interval fires loadWaits
  await d.setOffline(true);
  await d.ctx.clock.fastForward('07:00:00');
  let fetches = 0; d.page.on('request', r => { if (r.url().includes('/api/dollywood/waits')) fetches++; });
  await d.ctx.clock.runFor('02:30');   // >= 2 interval ticks
  await sleep(1500);
  await d.ctx.setGeolocation({ ...(await ll([702, 802])), accuracy: 6 });
  await sleep(1500);
  out.B_after7hOffline = { ...(await snap()), waitsFetchAttemptsDuringRunFor: fetches };
  // ride card + directions bar for the hero ride
  out.B_cardAndRoute = await f.evaluate(async () => {
    const hero = document.querySelector('#near-list .lv-hero-card'); const o = OFFNUM[+hero.dataset.n];
    showOfficial(o); await new Promise(r => setTimeout(r, 400));
    const wl = document.querySelector('.lv-waitline'); const card = wl ? wl.textContent.replace(/\s+/g, ' ') : null;
    routeTo(o); await new Promise(r => setTimeout(r, 400));
    return { ride: o.name, cardWaitLine: card, routeMeta: document.getElementById('route-meta').textContent };
  });
  await shot(d, 'B-7h-offline-route');
  await f.evaluate(() => { document.getElementById('near-mode-waits').click(); });
  await sleep(400);
  out.B_waitsListHead = await f.evaluate(() => document.getElementById('near-list').textContent.replace(/\s+/g, ' ').slice(0, 120));
  await f.evaluate(() => { document.getElementById('near-mode-near').click(); });

  // C: reopen the map (still offline, same 7 h later clock): the 6 h cache limit applies only here
  f = await open();
  await sleep(1500);
  out.C_reopenedOffline = await f.evaluate(() => ({ waitsAt: WAITS.at, err: WAITS.err, ridesWithWait: Object.keys(WAITS.by).length, markerChips: document.querySelectorAll('.lv-wait').length,
    cacheAgeMin: (() => { try { const c = JSON.parse(localStorage.getItem('dollywood.live.waits')); return Math.round((Date.now() - c.at) / 60000); } catch (e) { return null; } })() }));
  await d.setOffline(false);
} catch (e) { out.error = String(e && e.stack || e); }
finally {
  fs.writeFileSync(path.join(EV, `${P}.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); await L.close();
}
