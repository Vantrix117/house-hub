// Completeness critic: kid beacon switched while the kid's park map is already open.
//  A. Beacon OFF: Mom switches Ezra's beacon off in her Family pane (writes kidshare:ezra=false and removes loc:ezra, :1308)
//     while Ezra's phone has the map open and is walking. Does Ezra's phone re-create loc:ezra before it learns the switch?
//  B. Beacon ON: Mom switches Kiara's beacon on while Kiara's phone already has the map open (view-only at load).
//     Does Kiara's phone start locating / publishing without a reopen? (onChange only calls loadFam/renderNear, :1483;
//     the locate button is hidden once at :1485; startGps only at :1486.)
// Park seed, real clock, WebKit. Local instance only.
// Run: node "audits/tools/phase3/dollywood-live/critic-kid-beacon.mjs"
import { local, sleep, save, openMap, latLon } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const row = async key => { const r = await L.apiAs('eli', '/api/data/dollywood-live?scope=family'); const it = (r.body.items || []).find(x => x.key === key); if (!it) return { present: false }; const v = it.value; return v == null ? { present: true, tombstone: true, updated_at: it.updated_at } : { present: true, t: v.t, ageS: v.t ? Math.round((Date.now() - v.t) / 1000) : null, x: v.x, y: v.y, updated_at: it.updated_at }; };
const state = f => f.evaluate(() => ({ viewOnly: VIEW_ONLY(), shareOn: shareOn(), watching: watchId != null, locBtnHidden: document.getElementById('loc-btn').hidden, pill: document.getElementById('lv-pill').dataset.state, title: document.getElementById('loc-sec').textContent, sub: document.getElementById('loc-acc').textContent, kidshare: hub.get('kidshare:' + hub.profile.id, { scope: 'family' }) ?? null }));
try {
  // ---------- A. beacon OFF while Ezra walks ----------
  const ed = await L.newDevice({ name: 'Ezra phone', profiles: ['ezra'] });
  const ezra = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ed });
  await ezra.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await ezra.goto('#home'); await sleep(1500);
  let ef = await openMap(ezra, { settle: 500 });
  let pos = [847, 864];
  await ezra.ctx.setGeolocation({ ...(await latLon(ef, ...pos)), accuracy: 9 });
  // a cold open may have resumed before the fix was set: tap nothing, just wait for the watch
  await sleep(4000);
  out.A_ezraAtStart = await state(ef);
  let walking = true;
  const walk = (async () => { while (walking) { pos = [pos[0] + 6, pos[1] + 4]; await ezra.ctx.setGeolocation({ ...(await latLon(ef, ...pos)), accuracy: 9 }).catch(() => {}); await sleep(2000); } })();
  await sleep(8000);
  out.A_serverLocEzraBeforeSwitch = await row('loc:ezra');

  const md = await L.newDevice({ name: 'Mom iPad', profiles: ['mom'] });
  const mom = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false, as: md });
  await mom.goto('#home'); await sleep(1500);
  const mf = await openMap(mom, { settle: 2500 });
  await mf.click('#lv-family').catch(() => {}); await sleep(1000);
  out.A_momSwitchesBefore = await mf.evaluate(() => [...document.querySelectorAll('#fam-list input[data-kid]')].map(c => ({ kid: c.dataset.kid, checked: c.checked })));
  const tOff = Date.now();
  await mf.evaluate(() => { const c = document.querySelector('#fam-list input[data-kid="ezra"]'); c.click(); });
  await sleep(1500);
  out.A_rightAfterSwitchOff = { kidshare: await row('kidshare:ezra'), loc: await row('loc:ezra') };
  const poll = [];
  for (let i = 0; i < 20; i++) { await sleep(3000); const r = await row('loc:ezra'); poll.push({ s: Math.round((Date.now() - tOff) / 1000), ...r }); }
  out.A_pollLocEzraAfterSwitchOff = poll;
  out.A_ezraDeviceAfter60s = await state(ef);
  walking = false; await walk;
  await sleep(4000);
  out.A_finalLocEzra = await row('loc:ezra');
  // what Mom's map shows for Ezra after a pull
  await mf.evaluate(() => hub.pull && hub.pull()).catch(() => {});
  await sleep(3000);
  out.A_momSeesEzra = await mf.evaluate(() => { const f = FAM.ezra; const b = document.querySelector('.lv-item[data-f="ezra"]'); return { inFAM: !!f, ageS: f ? Math.round((Date.now() - f.t) / 1000) : null, familyRow: b ? b.innerText.replace(/\s+/g, ' ').trim() : null, beaconSwitch: (document.querySelector('#fam-list input[data-kid="ezra"]') || {}).checked ?? null }; });

  // ---------- B. beacon ON while Kiara's map is open ----------
  const kd = await L.newDevice({ name: 'Kiara phone', profiles: ['kiara'] });
  const kiara = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false, as: kd });
  await kiara.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await kiara.goto('#home'); await sleep(1500);
  let kf = await openMap(kiara, { settle: 500 });
  await kiara.ctx.setGeolocation({ ...(await latLon(kf, 839, 861)), accuracy: 9 });
  await sleep(2500);
  out.B_kiaraBefore = await state(kf);
  out.B_serverKidshareKiaraBefore = await row('kidshare:kiara');
  await mf.evaluate(() => { renderFam(); const c = document.querySelector('#fam-list input[data-kid="kiara"]'); if (c && !c.checked) c.click(); });
  const tOn = Date.now(); await sleep(1500);
  out.B_serverKidshareKiaraAfterSwitch = await row('kidshare:kiara');
  const kpoll = [];
  for (let i = 0; i < 3; i++) { await sleep(15000); kpoll.push({ s: Math.round((Date.now() - tOn) / 1000), ...(await state(kf)), serverLocKiara: await row('loc:kiara') }); }
  out.B_kiaraWhileOpen = kpoll;
  // reopen the map on Kiara's phone
  await kiara.goto('#home'); await sleep(1200);
  kf = await openMap(kiara, { settle: 500 });
  await sleep(8000);
  out.B_kiaraAfterReopen = { ...(await state(kf)), serverLocKiara: await row('loc:kiara') };
} catch (e) { out.error = String(e && e.stack || e); }
finally { save('critic-kid-beacon.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
