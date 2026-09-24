// Skeptic #1 for finding "meet-bar-stale-after-place": after Set my spot (and after a first GPS fix) the meeting-point
// bar keeps "set by Mae N min ago" with no walk time and Go hidden, because setMe (apps/dollywood-live.html:1245) never
// calls renderMeet (:1583). Also tests the claimed self-heal: does it come back on its own on an idle 30 s sync, or only
// when some family row actually changes (hub.onChange -> loadFam -> loadMeet, :1483/:1256)?
// Run: node "audits/tools/phase3/dollywood-live/verify-meet-bar-stale-after-place-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
const P = 'verify-meet-bar-stale-after-place-1';
fs.mkdirSync(EV, { recursive: true });

const bar = f => f.evaluate(() => {
  const b = document.getElementById('lv-meet');
  return { hidden: b.hidden, name: document.getElementById('meet-name').textContent, meta: document.getElementById('meet-meta').textContent,
    goHidden: document.getElementById('meet-go').hidden, me: window.me ? null : undefined, sync: window.hub && hub.sync.state };
});
const meInfo = f => f.evaluate(() => { try { return typeof me !== 'undefined' && me ? { src: me.src, x: Math.round(me.x), y: Math.round(me.y), stale: !!me.stale } : null; } catch (e) { return 'err ' + e; } });
async function openMap(d) {
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
  await sleep(2500);
  return f;
}

const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = { script: 'audits/tools/phase3/dollywood-live/' + P + '.mjs' };
try {
  // ---- A. Set my spot by hand (no GPS), fresh device: no restored position in localStorage
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(1200);
  const f = await openMap(d);
  out.A0_beforePlace = { me: await meInfo(f), bar: await bar(f), meetRow: await f.evaluate(() => hub.get('meet', { scope: 'family' })) };
  await f.click('#loc-place'); await sleep(400);
  out.A1_placing_pill = await f.evaluate(() => ({ state: document.getElementById('lv-pill').dataset.state, act: document.getElementById('lv-act').textContent }));
  await f.click('#lv-act'); await sleep(1500);   // "I'm here" -> livePlace -> setMe(...,'place')
  out.A2_afterPlace = { me: await meInfo(f), bar: await bar(f), pill: await f.evaluate(() => document.getElementById('lv-pill').dataset.state) };
  await d.page.screenshot({ path: path.join(EV, P + '-A-after-place.png'), scale: 'css' });
  // idle 45 s: covers the hub's 30 s pull, the 30 s drawFam/renderFam timer (:1484), the 15 s updLoc timer (:1477)
  const pulls = []; d.page.on('request', r => { if (/\/api\/data\/dollywood-live\?scope=family/.test(r.url())) pulls.push(Date.now()); });
  const t0 = Date.now(); await sleep(45000);
  out.A3_after45sIdle = { bar: await bar(f), familyPullsDuring: pulls.length, seconds: Math.round((Date.now() - t0) / 1000) };
  await d.page.screenshot({ path: path.join(EV, P + '-B-after-45s-idle.png'), scale: 'css' });
  // another family row changes on the server (Mom's phone publishes a position) -> next pull emits -> loadFam -> loadMeet
  const put = await L.apiAs('mom', '/api/data/dollywood-live/loc:mom?scope=family', { method: 'PUT', body: { value: { x: 610, y: 705, t: Date.now(), name: 'Mom', emoji: '🌻', color: '#B5543C', acc: 8 } } }).then(() => 'ok').catch(e => String(e).slice(0, 200));
  let healedAfter = null; const t1 = Date.now();
  for (let i = 0; i < 45; i++) { const b = await bar(f); if (!b.goHidden) { healedAfter = Math.round((Date.now() - t1) / 1000); break; } await sleep(1000); }
  out.A4_afterFamilyChange = { put, healedAfterSeconds: healedAfter, bar: await bar(f) };
  await d.page.screenshot({ path: path.join(EV, P + '-C-after-family-change.png'), scale: 'css' });
  // control: calling renderMeet() by hand with the same state shows the walk time + Go (proves the missing call is the cause)
  const d2 = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d2.goto('#home'); await sleep(1200);
  const f2 = await openMap(d2);
  await f2.click('#loc-place'); await sleep(400); await f2.click('#lv-act'); await sleep(1500);
  const before = await bar(f2);
  await f2.evaluate(() => renderMeet()); await sleep(200);
  out.A5_control_renderMeetByHand = { before, after: await bar(f2) };

  // ---- B. first GPS fix on a fresh device (Locate me), same missing call
  const d3 = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d3.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await d3.goto('#home'); await sleep(1200);
  const f3 = await openMap(d3);
  const ll = await f3.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [762, 842]);
  await d3.ctx.setGeolocation({ ...ll, accuracy: 6 });
  out.B0_beforeGps = { me: await meInfo(f3), bar: await bar(f3) };
  await f3.click('#loc-btn').catch(e => out.B_clickErr = String(e).slice(0, 200)); await sleep(4000);
  out.B1_afterFirstFix = { me: await meInfo(f3), bar: await bar(f3) };
  await d3.page.screenshot({ path: path.join(EV, P + '-D-after-gps-fix.png'), scale: 'css' });
} catch (e) { out.error = String(e.stack || e).slice(0, 800); }
finally { await L.close(); }
fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
