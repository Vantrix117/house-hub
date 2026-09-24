// Skeptic #2 for critic-kid-share-switch-noop-5: does a kid with his beacon on get a "Share my spot" switch that cannot be
// switched off? Independent run: park seed (confirms kidshare:ezra first), real clock, WebKit, Ezra's own paired phone.
// Steps: open the park map in the shell, give a GPS fix, Family tab, read the switch; untick it with a real click on the
// label; read switch/shareOn/person share/server loc:ezra; move the fix 3 times; read again. Also a control: an adult
// (Mae) unticks hers and her loc: row must stay gone after moving.
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-kid-share-switch-noop-5-2.mjs"
import { local, sleep, save, shot, openMap, latLon } from './_lib.mjs';
const P = 'verify-critic-kid-share-switch-noop-5-2';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const locOf = async id => { const r = await L.apiAs('eli', '/api/data/dollywood-live?scope=family'); const it = (r.body.items || []).find(x => x.key === 'loc:' + id); return !it ? 'absent' : it.value == null ? 'tombstone' : { x: it.value.x, y: it.value.y, ageS: Math.round((Date.now() - it.value.t) / 1000) }; };
async function run(profile, label) {
  const o = {};
  const nd = await L.newDevice({ name: label + ' phone', profiles: [profile] });
  const d = await L.device({ device: 'iphone-pwa', profile, fixedTime: false, as: nd });
  await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await d.goto('#home'); await sleep(1500);
  const f = await openMap(d, { settle: 500 });
  let pos = [850, 860];
  await d.ctx.setGeolocation({ ...(await latLon(f, ...pos)), accuracy: 8 });
  o.kind = await f.evaluate(() => hub.profile.kind);
  o.kidshareRow = await f.evaluate(() => hub.get('kidshare:' + hub.profile.id, { scope: 'family' }));
  if (profile !== 'ezra') { await f.evaluate(() => setShare(true)); }
  await sleep(4000);
  await f.click('#lv-family').catch(e => { o.famClickErr = String(e).slice(0, 120); }); await sleep(800);
  const sw = () => f.evaluate(() => { const c = document.getElementById('lv-share'); return c ? { shown: true, checked: c.checked, text: c.closest('label').innerText.replace(/\s+/g, ' ').trim() } : { shown: false }; });
  o.A_before = { switch: await sw(), shareOn: await f.evaluate(() => shareOn()), viewOnly: await f.evaluate(() => VIEW_ONLY()), loc: await locOf(profile) };
  if (profile === 'ezra') await shot(d, P + '-A-before-ezra.png');
  // real user click on the label (the switch)
  await f.click('label.lv-share:has(#lv-share)').catch(async e => { o.clickErr = String(e).slice(0, 120); await f.evaluate(() => document.getElementById('lv-share').click()); });
  await sleep(1500);
  o.B_afterUntick = { switch: await sw(), shareOn: await f.evaluate(() => shareOn()), personShare: await f.evaluate(() => hub.get('share', { scope: 'person' })), loc: await locOf(profile) };
  for (let i = 0; i < 3; i++) { pos = [pos[0] + 12, pos[1] + 7]; await d.ctx.setGeolocation({ ...(await latLon(f, ...pos)), accuracy: 8 }); await sleep(3500); }
  await sleep(2000);
  o.C_afterWalking = { switch: await sw(), shareOn: await f.evaluate(() => shareOn()), loc: await locOf(profile), pill: await f.evaluate(() => document.getElementById('loc-acc').textContent) };
  if (profile === 'ezra') await shot(d, P + '-C-after-ezra.png');
  return o;
}
try {
  out.ezra = await run('ezra', 'Ezra');
  out.control_mae = await run('christian', 'Mae');
} catch (e) { out.error = String(e && e.stack || e); }
finally { save(P + '.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
