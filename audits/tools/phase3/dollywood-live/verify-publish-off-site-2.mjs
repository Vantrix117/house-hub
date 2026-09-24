// Skeptic #2 for finding "publish-off-site": does the park map publish loc:<id> for a fix far from Dollywood, and does
// Home's "At the park" card then count that person? Scenario: an ordinary (non-park) day; Eli left "Share my spot" on
// from an earlier park visit (person-scope 'share' = true) and opens the park map at home, ~7 mi from the park.
// The map resumes GPS without a tap when sharing is on (apps/dollywood-live.html:1486) and publish() (:1250) has no
// onProperty() gate. Mom's Home (index.html:872-877) counts any loc:* row under 4 h old.
// Run: node "audits/tools/phase3/dollywood-live/verify-publish-off-site-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const parkCard = async d => d.page.evaluate(() => { const c = document.querySelector('.park-card'); return c ? c.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null; });
  const locRows = async () => { const r = await L.apiAs('mom', '/api/data/dollywood-live?scope=family'); const rows = (r.body && (r.body.rows || r.body.items || r.body)) || []; return (Array.isArray(rows) ? rows : []).filter(x => String(x.key).startsWith('loc:')).map(x => { const v = typeof x.value === 'string' ? JSON.parse(x.value) : x.value; return { key: x.key, x: v && v.x, y: v && v.y, ageS: v && v.t ? Math.round((Date.now() - v.t) / 1000) : null }; }); };

  // 1. Baseline: an ordinary day, nobody at the park.
  const mom = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false });
  await mom.goto('#home'); await sleep(2500);
  out.A_baselineMomParkCard = await parkCard(mom);
  out.A_baselineLocRows = await locRows();

  // 2. Eli's phone at home. Open the map once (share off) to learn the page's own geo frame, then place the phone ~7 mi away.
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const eli = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  await eli.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await eli.goto('#home');
  let f = await eli.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 20000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 });
  const HOME_XY = [-9000, 10000];   // map metres: ~13.4 km (8.4 mi) NW of the frame
  const ll = await f.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), HOME_XY);
  out.B_homeLatLon = ll;
  await eli.ctx.setGeolocation({ ...ll, accuracy: 12 });
  out.B_shareBefore = await f.evaluate(() => hub.get('share', { scope: 'person' }));
  // "Share my spot" left on from the last park day: the same person-scope write setShare() makes (:1314).
  await f.evaluate(() => hub.set('share', true, { scope: 'person' }));
  await sleep(1500);

  // 3. Next open of the map (at home): GPS resumes because sharing is on; no tap.
  await eli.goto('#home'); await sleep(800);
  f = await eli.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 20000 });
  await f.waitForFunction(() => typeof me !== 'undefined' && me && me.src === 'gps', null, { timeout: 20000 }).catch(() => {});
  await sleep(4000);
  out.C_eliMap = await f.evaluate(() => ({ pill: document.getElementById('lv-pill').dataset.state, title: document.getElementById('loc-sec').textContent, sub: document.getElementById('loc-acc').textContent,
    me: me ? { x: Math.round(me.x), y: Math.round(me.y), acc: me.acc, src: me.src } : null, onProperty: me ? onProperty([me.x, me.y]) : null, shareOn: shareOn(), watching: watchId != null }));
  await sleep(2500);
  out.C_serverLocRows = await locRows();

  // 4. Mom's Home and Mom's park map.
  await mom.goto('#home'); await sleep(1500);
  await mom.page.evaluate(() => hub.pull && hub.pull()).catch(() => {});
  await sleep(2500);
  await mom.goto('#home'); await sleep(2500);
  out.D_momParkCard = await parkCard(mom);
  await mom.page.screenshot({ path: path.join(EV, 'verify-publish-off-site-2-mom-home-ipad.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  const mf = await mom.openApp('dollywood-live');
  await mf.waitForSelector('#lv-pill[data-state]', { timeout: 20000 });
  await sleep(2500);
  out.E_momMap = await mf.evaluate(() => {
    const e = FAM.eli; const btn = document.querySelector('.lv-item[data-f="eli"]');
    return { famEli: e ? { x: e.x, y: e.y } : null, placeOf: e ? placeOf([e.x, e.y]) : null, familyRow: btn ? btn.innerText.replace(/\s+/g, ' ').trim() : null,
      markerOnMap: !!document.querySelector('[data-f="eli"]:not(.lv-item), [data-id="f:eli"]') };
  });
} catch (e) { out.error = String(e && e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verify-publish-off-site-2.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
