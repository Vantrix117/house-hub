// Skeptic #2 for finding "guest-can-flip-kid-beacon" (dollywood-live).
// Independent reproduction: a guest (Grandma Jo, kind adult, is_guest) opens the park map's Family pane on a park day.
//  1. What does the page think the profile is (kind, is_guest on the session)?
//  2. Are the Kids' beacons switches and the height steppers rendered?
//  3. Flip Kiara's beacon and tap a height "+" as the guest: what lands on the server (value, updated_by)?
//  4. Contrast: the server's rally endpoint refuses the same guest (household adults only), and a household adult sees the
//     same controls (so the gate is kind==='adult' only).
// Run: node "audits/tools/phase3/dollywood-live/verify-guest-can-flip-kid-beacon-2.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const fam = async () => (await L.apiAs('eli', '/api/data/dollywood-live?scope=family')).body.items
  .filter(r => /^(kidshare|kid):/.test(r.key)).map(r => ({ key: r.key, value: r.value, by: r.updated_by ?? r.by ?? r.profile_id ?? null, deleted: r.deleted ?? undefined }));
try {
  out.before = await fam();
  const gdev = await L.newDevice({ name: 'Grandma phone', profiles: ['guest-grandmajo'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'guest-grandmajo', fixedTime: false, as: gdev });
  await d.goto('#home'); await sleep(1200);
  const f = await openMap(d, { settle: 2500 });
  await f.click('#lv-family'); await sleep(1200);
  out.guestView = await f.evaluate(() => ({
    profileId: hub.profile.id, kind: hub.profile.kind,
    sessionIsGuest: !!(hub.session && hub.session.profile && hub.session.profile.is_guest),
    canWrite: hub.canWrite,
    beaconSwitches: [...document.querySelectorAll('#fam-list input[data-kid]')].map(c => ({ kid: c.dataset.kid, checked: c.checked, label: c.getAttribute('aria-label') })),
    heightButtons: document.querySelectorAll('#kid-list .lv-kid button').length,
  }));
  await shot(d, 'verify-guest-can-flip-kid-beacon-2-guest-family-iphone.png');
  // flip Kiara's beacon (whatever it is) and bump Ezra's height once
  const kiara = await f.$('#fam-list input[data-kid="kiara"]');
  if (kiara) { await kiara.click(); await sleep(1800); }
  const plus = await f.evaluate(() => { const row = document.querySelector('#kid-list .lv-kid[data-k="ezra"]'); if (!row) return null; const bs = [...row.querySelectorAll('button')]; const b = bs.find(x => +x.dataset.d > 0) || bs[bs.length - 1]; b.click(); return b.dataset.d; });
  out.heightButtonDelta = plus; await sleep(1800);
  out.after = await fam();
  const raw = (await L.apiAs('eli', '/api/data/dollywood-live?scope=family')).body.items.filter(r => r.key === 'kidshare:kiara' || r.key === 'kid:ezra');
  out.rawRowsAfter = raw;
  // server-side contrast: rally as the guest
  out.guestRally = await L.apiAs('guest-grandmajo', '/api/dollywood/rally', { method: 'POST', body: { name: 'Test spot', x: 700, y: 1100 } }).then(r => ({ status: r.status, body: r.body })).catch(e => ({ error: String(e) }));
  await d.close();
} finally { save('verify-guest-can-flip-kid-beacon-2.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
