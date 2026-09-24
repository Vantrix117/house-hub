// Skeptic #1 for finding critic-kid-beacon-off-republished-1: does switching a kid's beacon off while the kid's map is
// open leave the kid republishing loc:<kid>? Independent re-run. Park seed, real clock, WebKit, local instance only.
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-off-republished-1-1.mjs"
import { local, sleep, save, openMap, latLon } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const row = async key => { const r = await L.apiAs('dad', '/api/data/dollywood-live?scope=family'); const it = (r.body.items || []).find(x => x.key === key); if (!it) return { present: false }; const v = it.value; return v == null ? { tombstone: true, updated_at: it.updated_at } : { live: true, x: v.x, y: v.y, t: v.t, updated_at: it.updated_at }; };
const kidState = f => f.evaluate(() => ({ kidshareCache: hub.get('kidshare:' + hub.profile.id, { scope: 'family' }) ?? null, viewOnly: VIEW_ONLY(), shareOn: shareOn(), kidBeaconOn: kidBeaconOn(), watching: watchId != null, wakeLock: typeof wakeLock !== 'undefined' ? !!wakeLock : 'n/a', locBtnHidden: document.getElementById('loc-btn').hidden, pill: document.getElementById('lv-pill').dataset.state, sync: hub.sync && hub.sync.state }));
try {
  const kd = await L.newDevice({ name: 'Ezra phone (verify)', profiles: ['ezra'] });
  const kid = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: kd });
  await kid.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await kid.goto('#home'); await sleep(1200);
  const kf = await openMap(kid, { settle: 400 });
  let p = [850, 870];
  await kid.ctx.setGeolocation({ ...(await latLon(kf, ...p)), accuracy: 8 });
  await sleep(4000);
  out.kidAtStart = await kidState(kf);
  let walking = true;
  const walk = (async () => { while (walking) { p = [p[0] + 5, p[1] + 5]; await kid.ctx.setGeolocation({ ...(await latLon(kf, ...p)), accuracy: 8 }).catch(() => {}); await sleep(2000); } })();
  await sleep(7000);
  out.serverBeforeSwitch = { kidshare: await row('kidshare:ezra'), loc: await row('loc:ezra') };

  const md = await L.newDevice({ name: 'Dad iPad (verify)', profiles: ['dad'] });
  const par = await L.device({ device: 'ipad-portrait', profile: 'dad', fixedTime: false, as: md });
  await par.goto('#home'); await sleep(1200);
  const pf = await openMap(par, { settle: 2000 });
  await pf.click('#lv-family').catch(() => {}); await sleep(800);
  out.parentSwitchBefore = await pf.evaluate(() => { const c = document.querySelector('#fam-list input[data-kid="ezra"]'); return c ? c.checked : 'missing'; });
  const t0 = Date.now();
  // a real tap on the switch (label wraps the checkbox)
  await pf.locator('#fam-list input[data-kid="ezra"]').click({ force: true });
  await sleep(1500);
  out.serverRightAfterSwitch = { kidshare: await row('kidshare:ezra'), loc: await row('loc:ezra'), tSwitch: t0 };
  const poll = [];
  for (let i = 0; i < 16; i++) { await sleep(3000); poll.push({ s: Math.round((Date.now() - t0) / 1000), loc: await row('loc:ezra'), kid: await kidState(kf) }); }
  out.poll = poll.map(x => ({ s: x.s, locLive: !!x.loc.live, locTomb: !!x.loc.tombstone, xy: x.loc.live ? [x.loc.x, x.loc.y] : null, updated_at: x.loc.updated_at, kidKidshare: x.kid.kidshareCache, kidShareOn: x.kid.shareOn }));
  out.kidAfter = await kidState(kf);
  walking = false; await walk; await sleep(10000);
  out.serverFinal = { kidshare: await row('kidshare:ezra'), loc: await row('loc:ezra'), ageS: Math.round((Date.now() - t0) / 1000) };
  await pf.evaluate(() => hub.pull && hub.pull()).catch(() => {}); await sleep(2500);
  out.parentSees = await pf.evaluate(() => { renderFam(); drawFam(); const b = document.querySelector('.lv-item[data-f="ezra"]'); return { inFAM: !!FAM.ezra, row: b ? b.innerText.replace(/\s+/g, ' ').trim() : null, markerOnMap: !!document.querySelector('.famk[data-pick="f:ezra"]'), switchChecked: (document.querySelector('#fam-list input[data-kid="ezra"]') || {}).checked ?? null }; });
  // Home's At-the-park card on the parent device
  await par.goto('#home'); await sleep(2500);
  out.parentHomeMentionsEzra = await par.page.evaluate(() => { const t = document.body.innerText; const i = t.indexOf('Ezra'); return i < 0 ? null : t.slice(Math.max(0, i - 80), i + 80).replace(/\s+/g, ' '); });
} catch (e) { out.error = String(e && e.stack || e); }
finally { save('verify-critic-kid-beacon-off-republished-1-1.json', out); console.log(JSON.stringify(out, null, 1)); await L.close(); }
