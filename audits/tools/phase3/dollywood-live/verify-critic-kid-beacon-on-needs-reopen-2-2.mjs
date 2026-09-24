// Skeptic #2: kid beacon switched ON while the kid's park map is already open.
// Does the kid's open map start locating/publishing without a reopen? Also checks the mitigations a kid could stumble on:
// the pill's action button, the Family pane's Share row, a background/foreground (visibilitychange), and a reopen.
// Park seed, real clock, WebKit, local instance only.
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-2.mjs"
import { local, sleep, save, shot, openMap, latLon } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const P = 'verify-critic-kid-beacon-on-needs-reopen-2-2';
const row = async key => { const r = await L.apiAs('eli', '/api/data/dollywood-live?scope=family'); const it = (r.body.items || []).find(x => x.key === key); if (!it) return { present: false }; const v = it.value; return v == null ? { present: true, value: null } : { present: true, value: typeof v === 'object' ? { t: v.t, ageS: v.t ? Math.round((Date.now() - v.t) / 1000) : null } : v }; };
const state = f => f.evaluate(() => ({ kidshareLocal: hub.get('kidshare:' + hub.profile.id, { scope: 'family' }) ?? null, viewOnly: VIEW_ONLY(), shareOn: shareOn(), watching: watchId != null, hasMe: !!me,
  locBtnHidden: document.getElementById('loc-btn').hidden, pill: document.getElementById('lv-pill').dataset.state, title: document.getElementById('loc-sec').textContent, sub: document.getElementById('loc-acc').textContent,
  pillAction: document.getElementById('lv-act') && !document.getElementById('lv-act').hidden ? document.getElementById('lv-act').textContent : null,
  famShareRow: !!document.getElementById('lv-share'), famShareChecked: document.getElementById('lv-share') ? document.getElementById('lv-share').checked : null }));
try {
  const kd = await L.newDevice({ name: 'Kiara phone', profiles: ['kiara'] });
  const kiara = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false, as: kd });
  await kiara.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await kiara.goto('#home'); await sleep(1500);
  let kf = await openMap(kiara, { settle: 800 });
  await kiara.ctx.setGeolocation({ ...(await latLon(kf, 839, 861)), accuracy: 9 });
  await sleep(2500);
  out.kidshareServerBefore = await row('kidshare:kiara');
  out.kiaraAtOpen = await state(kf);

  const md = await L.newDevice({ name: 'Mom iPad', profiles: ['mom'] });
  const mom = await L.device({ device: 'ipad-portrait', profile: 'mom', fixedTime: false, as: md });
  await mom.goto('#home'); await sleep(1500);
  const mf = await openMap(mom, { settle: 2500 });
  out.momSwitchBefore = await mf.evaluate(() => { renderFam(); const c = document.querySelector('#fam-list input[data-kid="kiara"]'); return c ? { checked: c.checked, text: c.closest('label').innerText.replace(/\s+/g, ' ').trim() } : null; });
  await mf.evaluate(() => { const c = document.querySelector('#fam-list input[data-kid="kiara"]'); if (c && !c.checked) c.click(); });
  const tOn = Date.now(); await sleep(1500);
  out.momSwitchAfter = await mf.evaluate(() => { const c = document.querySelector('#fam-list input[data-kid="kiara"]'); return c ? { checked: c.checked, text: c.closest('label').innerText.replace(/\s+/g, ' ').trim() } : null; });
  out.kidshareServerAfter = await row('kidshare:kiara');
  const poll = [];
  for (let i = 0; i < 6; i++) { await sleep(15000); poll.push({ s: Math.round((Date.now() - tOn) / 1000), ...(await state(kf)), serverLocKiara: await row('loc:kiara') }); }
  out.kiaraWhileOpen = poll;
  await shot(kiara, P + '-kiara-open-90s.png');

  // background / foreground the page (what locking the phone does); does that start the beacon?
  await kf.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(500);
  await kf.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(6000);
  out.kiaraAfterVisibilityCycle = { ...(await state(kf)), serverLocKiara: await row('loc:kiara') };

  // reopen the map
  await kiara.goto('#home'); await sleep(1200);
  kf = await openMap(kiara, { settle: 500 });
  await sleep(9000);
  out.kiaraAfterReopen = { ...(await state(kf)), serverLocKiara: await row('loc:kiara') };
} catch (e) { out.error = String(e && e.stack || e); }
finally { save(P + '.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
