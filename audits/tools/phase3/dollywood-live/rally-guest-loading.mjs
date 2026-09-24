// Three checks:
//  A. Rally from the UI: accept every confirm() and watch for a request to /api/dollywood/rally from "Meet here" and a
//     long press. (P2-PWA-18 owns "no UI triggers rally"; this re-confirms in this app.)
//  B. A guest gets the kids'-beacon switches and height steppers in the Family pane (widen of the guest lead / P2-PROF-05).
//  C. Loading: while the first family pull is in flight, does Family read "offline — showing last known" and Share Off?
// Run: node "audits/tools/phase3/dollywood-live/rally-guest-loading.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  // A. rally
  let d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const rallyReqs = [];
  d.page.on('request', r => { if (/\/api\/dollywood\/rally/.test(r.url())) rallyReqs.push({ method: r.method(), body: r.postData() }); });
  d.page.on('dialog', async dl => { out.lastConfirm = dl.message().slice(0, 120); await dl.accept().catch(() => {}); });
  await d.goto('#home'); await sleep(1000);
  let f = await openMap(d, { settle: 2000 });
  // place a spot so directions/meet are enabled
  await f.click('#loc-place'); await sleep(300); await f.click('#lv-act'); await sleep(1200);
  // open a ride card and tap "Meet here"
  await f.click('#lv-search'); await sleep(500);
  await f.fill('#q', 'Thunderhead'); await sleep(600);
  const row = await f.$('#tab-list .oi');
  if (row) { await row.click(); await sleep(1000); }
  const meetBtn = await f.evaluate(() => { const b = [...document.querySelectorAll('.pop-act button')].find(x => /meet here/i.test(x.textContent)); if (b) { b.click(); return true; } return false; });
  await sleep(1500);
  out.A_meetHere = { meetBtnFound: meetBtn, rallyRequests: rallyReqs.length, meetBarMeta: await f.evaluate(() => document.getElementById('meet-meta').textContent) };
  out.A_note = 'meetHere confirm accepted; if rallyRequests is 0 no push went out (P2-PWA-18). The bar offers Go/Done only.';
  await d.close();

  // B. guest sees the kids' beacon switches + height steppers
  const gdev = await L.newDevice({ name: 'Guest phone', profiles: ['guest-grandmajo'] });
  d = await L.device({ device: 'iphone-pwa', profile: 'guest-grandmajo', fixedTime: false, as: gdev });
  await d.goto('#home'); await sleep(1200);
  f = await openMap(d, { settle: 2500 });
  await f.click('#lv-family'); await sleep(1200);
  out.B_guest = await f.evaluate(() => ({
    kind: hub.profile.kind, isGuest: /guest/i.test(hub.profile.id),
    beaconSwitches: document.querySelectorAll('#fam-list input[data-kid]').length,
    beaconLabels: [...document.querySelectorAll('#fam-list .lv-grp')].map(g => g.textContent.trim()).slice(0, 3),
    heightSteppers: document.querySelectorAll('#kid-list .lv-kid button').length,
    shareSwitch: !!document.getElementById('lv-share'),
  }));
  await shot(d, 'rally-guest-family-iphone.png');
  // prove the guest can actually flip a kid beacon (writes kidshare:*)
  const kidToggle = await f.$('#fam-list input[data-kid]');
  if (kidToggle) { const before = (await L.apiAs('eli', '/api/data/dollywood-live?scope=family')).body.items.find(r => /^kidshare:/.test(r.key)); await kidToggle.click(); await sleep(1500); const after = (await L.apiAs('eli', '/api/data/dollywood-live?scope=family')).body.items.filter(r => /^kidshare:/.test(r.key)); out.B_guestFlippedBeacon = { toggled: true, kidshareRowsAfter: after.map(r => ({ k: r.key, v: r.value })) }; }
  await d.close();

  // C. loading: throttle the family pull so the pane is read before data lands
  d = await L.device({ device: 'ipad-portrait', profile: 'eli', mode: 'dark', fixedTime: false });
  await d.ctx.route('**/api/data/dollywood-live?scope=family*', async r => { await new Promise(x => setTimeout(x, 4000)); r.continue(); });
  await d.goto('#home'); await sleep(500);
  f = await openMap(d, { settle: 200 });
  await f.click('#lv-family').catch(() => {}); await sleep(400);
  out.C_loading = await f.evaluate(() => ({
    famSync: document.getElementById('fam-sync').textContent,
    shareLabel: (() => { const l = [...document.querySelectorAll('#fam-list .lv-share')][0]; return l ? l.innerText.replace(/\s+/g, ' ').slice(0, 90) : null; })(),
    pillSub: document.getElementById('loc-acc').textContent,
  }));
  await shot(d, 'loading-family-ipad-dark.png');
} finally { save('rally-guest-loading.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
