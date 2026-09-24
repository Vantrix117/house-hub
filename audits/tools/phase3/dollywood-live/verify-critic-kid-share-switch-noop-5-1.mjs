// Skeptic #1 for critic-kid-share-switch-noop-5: a kid whose beacon is on sees a "Share my spot" switch;
// unticking it (a real tap on the switch) writes person share=false and tombstones loc:<kid> (setShare, :1310-1313),
// but shareOn() (:694) is still true through kidBeaconOn() (:1601), so the switch redraws checked and the next
// GPS fix republishes loc:<kid> (publish, :1250-1253). Also: does a reopen of the map keep it on? Does a second
// untick behave the same? Park seed, real clock, WebKit, local instance only.
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-kid-share-switch-noop-5-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
const PFX = 'verify-critic-kid-share-switch-noop-5-1';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const row = async key => { const r = await L.apiAs('mom', '/api/data/dollywood-live?scope=family'); const it = (r.body.items || []).find(x => x.key === key); if (!it) return 'absent'; if (it.value == null) return { tombstone: true, updated_at: it.updated_at }; const v = it.value; return { x: v.x, y: v.y, ageS: v.t ? Math.round((Date.now() - v.t) / 1000) : null, updated_at: it.updated_at }; };
const ll = (f, x, y) => f.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [x, y]);
try {
  out.seed_kidshare_ezra = await row('kidshare:ezra');
  const ed = await L.newDevice({ name: 'Ezra phone (verify)', profiles: ['ezra'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ed });
  await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
  let pos = [850, 860];
  await d.goto('#home'); await sleep(1500);
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 });
  await d.ctx.setGeolocation({ ...(await ll(f, ...pos)), accuracy: 9 });
  await sleep(4000);
  const state = async () => f.evaluate(() => { const c = document.getElementById('lv-share'); const lab = c && c.closest('label'); return { profile: hub.profile.id + '/' + hub.profile.kind, viewOnly: VIEW_ONLY(), kidBeaconOn: kidBeaconOn(), shareOn: shareOn(), personShare: hub.get('share', { scope: 'person' }), switchShown: !!c, switchChecked: c ? c.checked : null, switchText: lab ? lab.innerText.replace(/\s+/g, ' ').trim() : null }; });
  await f.click('#lv-family').catch(e => { out.familyClickErr = String(e); }); await sleep(800);
  out.A_before = { ...(await state()), locEzra: await row('loc:ezra') };
  await d.page.screenshot({ path: path.join(EV, PFX + '-a-before.png'), scale: 'css' });
  // A real tap on the switch (label), as the kid would do it.
  await f.click('#lv-share', { force: true });
  await sleep(1500);
  out.B_afterTap = { ...(await state()), locEzra: await row('loc:ezra') };
  await d.page.screenshot({ path: path.join(EV, PFX + '-b-after-untick.png'), scale: 'css' });
  const samples = [];
  for (let i = 0; i < 5; i++) { pos = [pos[0] + 12, pos[1] + 5]; await d.ctx.setGeolocation({ ...(await ll(f, ...pos)), accuracy: 9 }); await sleep(3000); samples.push({ t: (i + 1) * 3, locEzra: await row('loc:ezra') }); }
  out.C_walking = { samples, final: await state() };
  // What a parent sees from their device (API view): Ezra's spot is published again.
  // Second untick: same outcome?
  await f.click('#lv-share', { force: true }); await sleep(1200);
  out.D_secondTap = { ...(await state()), locEzra: await row('loc:ezra') };
  pos = [pos[0] + 12, pos[1] + 5]; await d.ctx.setGeolocation({ ...(await ll(f, ...pos)), accuracy: 9 }); await sleep(4000);
  out.D_after4s = { locEzra: await row('loc:ezra') };
  // Control: with the beacon switched off by an adult, is the switch hidden?
  await L.apiAs('mom', '/api/data/dollywood-live', { method: 'POST', body: { items: [{ scope: 'family', key: 'kidshare:ezra', value: false }] } }).then(r => { out.E_adultOffWrite = r.status; }).catch(e => { out.E_adultOffWrite = String(e); });
} catch (e) { out.error = String(e && e.stack || e); }
finally { fs.writeFileSync(path.join(EV, PFX + '.json'), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); await L.close(); }
