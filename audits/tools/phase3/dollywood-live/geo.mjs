// Geolocation end to end on a real clock (variant park: Eli's Share my spot is on, on the server).
//  A. First open of the map on a device: does the saved "Share my spot" resume GPS, and what does the pill say?
//  B. Second open on the same device.
//  C. A good fix in the park; the publish cadence while walking and while standing still.
//  D. A fix far from the park (at home): is it published, and what does Home's "At the park" card say on Mom's iPad?
// Run: node "audits/tools/phase3/dollywood-live/geo.mjs"
import { local, sleep, save, shot, openMap, putAt, grant, pill } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = { watchOptions: 'enableHighAccuracy:true, maximumAge:5000, timeout:15000 (apps/dollywood-live.html:1408)' };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await grant(d, L.site);
  const writes = [];
  d.page.on('request', r => { const u = r.url(); if (/\/api\/data\/dollywood-live/.test(u) && r.method() !== 'GET') writes.push({ t: Date.now(), url: u.replace(L.api, ''), body: (r.postData() || '').slice(0, 240) }); });
  await d.goto('#home'); await sleep(1500);            // the shell pulls its channels (dollywood-live family among them, index.html:459)
  // A. first open
  let f = await openMap(d, { settle: 300 });
  await putAt(d, f, 762, 842, 6);                      // the phone is in the Thunderhead queue
  await sleep(4000);
  out.A_firstOpen = { pill: await pill(f), ...(await f.evaluate(() => { renderFam(); const c = document.getElementById('lv-share'); return { watchId, shareOnNow: shareOn(), shareRowNow: hub.get('share', { scope: 'person' }), familyPaneSwitchChecked: c ? c.checked : null, sync: hub.sync.state }; })) };
  await sleep(35000);                                   // one more 30 s pull cycle
  out.A_firstOpenAfter39s = { pill: await pill(f), watchId: await f.evaluate(() => watchId), writesSoFar: writes.length };
  await shot(d, 'geo-first-open-iphone.png');
  // B. second open on the same device
  f = await openMap(d, { settle: 3000 });
  await putAt(d, f, 762, 842, 6); await sleep(3000);
  out.B_secondOpen = { pill: await pill(f), watchId: await f.evaluate(() => watchId), fab: await f.evaluate(() => document.getElementById('loc-btn').dataset.gps) };
  await shot(d, 'geo-good-iphone.png');
  // C. walking 1.5 m/s north-east for 40 s, then standing still 30 s
  let w0 = writes.length, t0 = Date.now();
  for (let i = 0; i < 40; i++) { await putAt(d, f, 762 + i * 1.06, 842 + i * 1.06, 6); await sleep(1000); }
  out.C_walk = { seconds: Math.round((Date.now() - t0) / 1000), dataWriteRequests: writes.length - w0, sample: writes.slice(w0, w0 + 2) };
  w0 = writes.length; t0 = Date.now();
  for (let i = 0; i < 30; i++) { await putAt(d, f, 804, 884, 6); await sleep(1000); }
  out.C_still = { seconds: Math.round((Date.now() - t0) / 1000), dataWriteRequests: writes.length - w0 };
  // D. at home, ~13 km north-west of the park
  await putAt(d, f, -9000, 10000, 10);
  await sleep(8000);
  out.D_atHome = { pill: await pill(f), onProperty: await f.evaluate(() => onProperty([me.x, me.y])) };
  await shot(d, 'geo-far-iphone.png');
  const srv = await L.apiAs('eli', '/api/data/dollywood-live?scope=family');
  const row = (srv.body.items || []).find(r => r.key === 'loc:eli');
  out.D_serverLocEli = row && { x: row.value.x, y: row.value.y, acc: row.value.acc, ageS: Math.round((Date.now() - row.value.t) / 1000) };
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false });
  await ipad.goto('#home'); await sleep(4000);
  out.D_momHomeParkCard = await ipad.page.evaluate(() => { const c = document.querySelector('.park-card'); return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 300) : null; });
  await shot(ipad, 'geo-far-mom-home-ipad.png');
  out.errors = d.logs.filter(l => /error/i.test(l)).slice(0, 5);
} finally { save('geo.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
