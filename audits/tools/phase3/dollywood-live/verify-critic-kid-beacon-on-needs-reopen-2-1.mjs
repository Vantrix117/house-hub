// Skeptic #1 for "critic-kid-beacon-on-needs-reopen-2": a kid's beacon switched ON while the kid's park map is open.
// Independent minimal reproduction: park seed, real clock, WebKit, local instance only.
//  1. Kiara's own paired phone opens the map, geolocation granted and set to a point in the park.
//  2. Mom's iPad opens the map, Family pane, taps Kiara's beacon switch (UI click, :1308).
//  3. Kiara's page: force hub.pull() so the change certainly arrived, then poll 45 s: VIEW_ONLY/shareOn/watchId/◎/pill/server loc:kiara.
//  4. Control: reopen the map on Kiara's phone and see whether it now locates and publishes.
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
fs.mkdirSync(EV, { recursive: true });
const PFX = 'verify-critic-kid-beacon-on-needs-reopen-2-1';

const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const openMap = async d => { const f = await d.openApp('dollywood-live'); await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 }); await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }); await sleep(800); return f; };
const ll = (f, x, y) => f.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [x, y]);
const locKiara = async () => { const r = await L.apiAs('mom', '/api/data/dollywood-live?scope=family'); const it = (r.body.items || []).find(x => x.key === 'loc:kiara'); return it ? (it.value ? { ageS: Math.round((Date.now() - it.value.t) / 1000) } : 'tombstone') : 'absent'; };
const kidshareKiara = async () => { const r = await L.apiAs('mom', '/api/data/dollywood-live?scope=family'); const it = (r.body.items || []).find(x => x.key === 'kidshare:kiara'); return it ? it.value : 'absent'; };
const st = f => f.evaluate(() => ({ kidshare: hub.get('kidshare:' + hub.profile.id, { scope: 'family' }) ?? null, viewOnly: VIEW_ONLY(), shareOn: shareOn(), watching: watchId != null, meSrc: me ? me.src : null, locBtnHidden: document.getElementById('loc-btn').hidden, pill: document.getElementById('lv-pill').dataset.state, title: document.getElementById('loc-sec').textContent, sub: document.getElementById('loc-acc').textContent }));
try {
  const kd = await L.newDevice({ name: 'Kiara phone (skeptic)', profiles: ['kiara'] });
  const kiara = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false, as: kd });
  await kiara.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await kiara.goto('#home'); await sleep(1200);
  let kf = await openMap(kiara);
  await kiara.ctx.setGeolocation({ ...(await ll(kf, 839, 861)), accuracy: 9 });
  await sleep(2500);
  out.k1_before = { ...(await st(kf)), serverKidshare: await kidshareKiara(), serverLoc: await locKiara() };

  const md = await L.newDevice({ name: 'Mom iPad (skeptic)', profiles: ['mom'] });
  const mom = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false, as: md });
  await mom.goto('#home'); await sleep(1200);
  const mf = await openMap(mom); await sleep(1500);
  await mf.click('#lv-family').catch(() => {}); await sleep(800);
  out.m1_switchBefore = await mf.evaluate(() => { const c = document.querySelector('#fam-list input[data-kid="kiara"]'); return c ? { checked: c.checked, copy: c.closest('label').innerText.replace(/\s+/g, ' ').trim() } : null; });
  await mf.click('#fam-list input[data-kid="kiara"]');
  const t0 = Date.now(); await sleep(2500);
  out.m2_switchAfter = await mf.evaluate(() => { const c = document.querySelector('#fam-list input[data-kid="kiara"]'); return c ? { checked: c.checked, copy: c.closest('label').innerText.replace(/\s+/g, ' ').trim() } : null; });
  out.server_after_switch = { kidshare: await kidshareKiara() };

  // make sure Kiara's hub.js has the row (rules out "it just had not pulled yet")
  await kf.evaluate(() => hub.pull()); await sleep(1500);
  out.k2_polls = [];
  for (let i = 0; i < 4; i++) { out.k2_polls.push({ s: Math.round((Date.now() - t0) / 1000), ...(await st(kf)), serverLoc: await locKiara() }); await sleep(12000); }
  await kiara.page.screenshot({ path: path.join(EV, PFX + '-kiara-open.png'), scale: 'css' });

  // control: reopen
  await kiara.goto('#home'); await sleep(1200);
  kf = await openMap(kiara); await sleep(8000);
  out.k3_afterReopen = { ...(await st(kf)), serverLoc: await locKiara() };
  await kiara.page.screenshot({ path: path.join(EV, PFX + '-kiara-reopened.png'), scale: 'css' });
} catch (e) { out.error = String(e && e.stack || e); }
finally {
  fs.writeFileSync(path.join(EV, PFX + '.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await L.close();
}
