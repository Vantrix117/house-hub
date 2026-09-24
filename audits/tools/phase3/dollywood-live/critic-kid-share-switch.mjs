// Completeness critic: a kid whose beacon is on sees his own "Share my spot" switch (canShare = canWrite && !VIEW_ONLY, :1300).
// Switching it off runs setShare(false) (:1310-1313): it writes person 'share'=false and removes loc:<kid>, but shareOn()
// stays true through kidBeaconOn() (:694, :1597), so the next fix republishes loc:<kid> and the switch redraws as checked.
// Park seed (Ezra's beacon is on), real clock, WebKit. Local instance only.
// Run: node "audits/tools/phase3/dollywood-live/critic-kid-share-switch.mjs"
import { local, sleep, save, shot, openMap, latLon } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const locEzra = async () => { const r = await L.apiAs('eli', '/api/data/dollywood-live?scope=family'); const it = (r.body.items || []).find(x => x.key === 'loc:ezra'); return !it ? 'absent' : it.value == null ? 'tombstone' : { x: it.value.x, y: it.value.y, ageS: Math.round((Date.now() - it.value.t) / 1000) }; };
try {
  const ed = await L.newDevice({ name: 'Ezra phone', profiles: ['ezra'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ed });
  await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await d.goto('#home'); await sleep(1500);
  const f = await openMap(d, { settle: 500 });
  let pos = [847, 864];
  await d.ctx.setGeolocation({ ...(await latLon(f, ...pos)), accuracy: 9 });
  await sleep(4000);
  await f.click('#lv-family').catch(() => {}); await sleep(800);
  const sw = () => f.evaluate(() => { const c = document.getElementById('lv-share'); const lab = c && c.closest('label'); return c ? { shown: true, checked: c.checked, text: lab.innerText.replace(/\s+/g, ' ').trim() } : { shown: false }; });
  out.A_kidSwitch = await sw();
  out.A_shareOn = await f.evaluate(() => shareOn());
  out.A_locEzra = await locEzra();
  await f.evaluate(() => document.getElementById('lv-share').click());
  await sleep(1200);
  out.B_rightAfterUntick = { switch: await sw(), shareOn: await f.evaluate(() => shareOn()), personShare: await f.evaluate(() => hub.get('share', { scope: 'person' })), locEzra: await locEzra() };
  for (let i = 0; i < 4; i++) { pos = [pos[0] + 10, pos[1] + 6]; await d.ctx.setGeolocation({ ...(await latLon(f, ...pos)), accuracy: 9 }); await sleep(3000); }
  out.C_after12sWalking = { switch: await sw(), shareOn: await f.evaluate(() => shareOn()), locEzra: await locEzra(), pill: await f.evaluate(() => document.getElementById('loc-acc').textContent) };
  await shot(d, 'critic-kid-share-switch-ezra-iphone.png');
} catch (e) { out.error = String(e && e.stack || e); }
finally { save('critic-kid-share-switch.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
