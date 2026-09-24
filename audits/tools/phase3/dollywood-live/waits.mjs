// Live-waits behaviour: freshness label, park-closed, upstream error + 6 h stale-cache fallback, and the name-match
// gap (WALIAS is empty, so a feed ride whose name differs from the listing never attaches a wait).
// Run: node "audits/tools/phase3/dollywood-live/waits.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
async function serveWaits(d, body) { await d.ctx.route('**/api/dollywood/waits*', r => r.fulfill({ status: 200, headers: cors, body: JSON.stringify(body) })); }
async function failWaits(d) { await d.ctx.unroute('**/api/dollywood/waits*').catch(() => {}); await d.ctx.route('**/api/dollywood/waits*', r => r.fulfill({ status: 502, headers: cors, body: JSON.stringify({ error: 'upstream', message: 'Wait times are not available right now.' }) })); }
const nowIso = mAgo => new Date(Date.now() - mAgo * 60000).toISOString();
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  // A. a normal feed: Thunderhead 40 min (matches the listing name) + a MISMATCHED name that should fail to attach
  await serveWaits(d, { ok: true, at: Date.now(), updated: nowIso(3), source: 'queue-times.com', rides: [
    { name: 'Thunderhead', land: 'Timber Canyon', open: true, wait: 40, updated: nowIso(3) },
    { name: 'Lightning Rod Roller Coaster', land: 'Jukebox Junction', open: true, wait: 25, updated: nowIso(3) },   // listing is likely "Lightning Rod"
    { name: 'Dollywood Express Train Depot', land: null, open: true, wait: 10, updated: nowIso(3) },
  ] });
  await d.goto('#home'); await sleep(1000);
  const f = await openMap(d, { settle: 2000 });
  await f.click('#lv-family').catch(() => {});
  await f.click('#loc-near'); await sleep(300);
  await f.evaluate(() => { document.getElementById('near-mode-waits').click(); }); await sleep(1200);
  out.A_waits = await f.evaluate(() => {
    const src = document.querySelector('.lv-src') && document.querySelector('.lv-src').innerText;
    const attached = Object.keys(WAITS.by).length;
    const rows = [...document.querySelectorAll('#near-list .lv-item--wait')].map(b => b.innerText.replace(/\s+/g, ' ').slice(0, 60));
    return { srcLine: src, attachedCount: attached, feedRideCount: 3, rows };
  });
  out.A_note = 'attachedCount < feedRideCount means some feed names did not match a listing (WALIAS empty, :1494; wnorm exact-match only, :1502)';
  await shot(d, 'waits-normal-iphone.png');

  // B. park closed: every ride open:false
  await d.ctx.unroute('**/api/dollywood/waits*');
  await serveWaits(d, { ok: true, at: Date.now(), updated: nowIso(4), source: 'queue-times.com', rides: [
    { name: 'Thunderhead', land: 'Timber Canyon', open: false, wait: 0, updated: nowIso(4) },
  ] });
  await f.evaluate(() => loadWaits()); await sleep(1000);
  out.B_closed = await f.evaluate(() => ({ empty: (document.getElementById('near-list').innerText || '').slice(0, 90), src: document.querySelector('.lv-src') && document.querySelector('.lv-src').innerText }));

  // C. upstream 502 while a cache exists (< 6 h): the stamped "offline, retrying" banner + kept waits
  await failWaits(d);
  await f.evaluate(() => loadWaits()); await sleep(1200);
  out.C_error = await f.evaluate(() => ({ stamp: (document.querySelector('.lv-stamp') && document.querySelector('.lv-stamp').innerText) || null, src: document.querySelector('.lv-src') && document.querySelector('.lv-src').innerText, rows: document.querySelectorAll('#near-list .lv-item--wait').length, WAITSerr: WAITS.err, keptCache: Object.keys(WAITS.by).length }));
  await shot(d, 'waits-error-iphone.png');
} finally { save('waits.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
