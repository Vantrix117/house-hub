// Skeptic #1 for "guest-can-flip-kid-beacon": independent reproduction, UI clicks only (no hand-made API writes).
//  1. Grandma Jo (seeded guest, kind adult, is_guest, PIN-less) signs in on her own phone, opens the park map -> Family.
//     Count the kids' beacon switches (#fam-list input[data-kid]) and the height steppers (#kid-list .lv-kid button).
//  2. She taps Ezra's beacon switch; read kidshare:ezra from the server (as Eli) before/after.
//  3. She taps a height "+" for Ezra; read kid:ezra before/after.
//  4. Ezra's own phone then opens the map: does VIEW_ONLY() flip off (his device may now locate and publish)?
//  Baseline: Ezra (kid) gets no switches/steppers.
// Run: node "audits/tools/phase3/dollywood-live/verify-guest-can-flip-kid-beacon-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live'); fs.mkdirSync(EV, { recursive: true });
const PFX = 'verify-guest-can-flip-kid-beacon-1';
const out = {};
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
async function openMap(d) {
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 20000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
  await sleep(2000); return f;
}
const rows = async () => (await L.apiAs('eli', '/api/data/dollywood-live?scope=family')).body.items || [];
const pick = (items, key) => { const r = items.find(x => x.key === key); return r ? { value: r.value, updated_by: r.updated_by ?? r.profile_id ?? null, updated_at: r.updated_at } : null; };
const pane = f => f.evaluate(() => ({
  viewer: { id: hub.profile.id, kind: hub.profile.kind, is_guest: !!(hub.session && hub.session.profile && hub.session.profile.is_guest), canWrite: hub.canWrite },
  beaconSwitches: [...document.querySelectorAll('#fam-list input[data-kid]')].map(i => ({ kid: i.dataset.kid, checked: i.checked, label: i.getAttribute('aria-label') })),
  groups: [...document.querySelectorAll('#fam-list .lv-grp, #kid-list .lv-grp')].map(g => g.textContent.trim()),
  heightSteppers: document.querySelectorAll('#kid-list .lv-kid button').length,
}));
try {
  // 1. guest
  const gdev = await L.newDevice({ name: 'Grandma Jo phone', profiles: ['guest-grandmajo'] });
  const g = await L.device({ device: 'iphone-pwa', profile: 'guest-grandmajo', fixedTime: false, as: gdev });
  await g.goto('#home'); await sleep(1200);
  let f = await openMap(g);
  await f.click('#lv-family'); await sleep(1500);
  out.guestPane = await pane(f);
  await g.page.screenshot({ path: path.join(EV, PFX + '-guest-family-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  // 2. flip Ezra's beacon
  out.kidshareEzraBefore = pick(await rows(), 'kidshare:ezra');
  const sw = await f.$('#fam-list input[data-kid="ezra"]');
  if (sw) { await sw.click(); await sleep(2500); }
  out.guestClickedBeacon = !!sw;
  out.kidshareEzraAfter = pick(await rows(), 'kidshare:ezra');

  // 3. height stepper for Ezra (first button in his row)
  out.kidHeightEzraBefore = pick(await rows(), 'kid:ezra');
  const plus = await f.$('#kid-list .lv-kid[data-k="ezra"] button');
  if (plus) { out.stepperDelta = await plus.getAttribute('data-d'); await plus.click(); await sleep(2500); }
  out.kidHeightEzraAfter = pick(await rows(), 'kid:ezra');
  await g.page.screenshot({ path: path.join(EV, PFX + '-guest-after-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await g.close();

  // 4. Ezra's phone: view-only lifted?
  const edev = await L.newDevice({ name: 'Ezra phone', profiles: ['ezra'] });
  const e = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: edev });
  await e.goto('#home'); await sleep(1200);
  f = await openMap(e);
  out.ezraAfter = await f.evaluate(() => ({ kidshareSeen: hub.get('kidshare:ezra', { scope: 'family' }), viewOnly: VIEW_ONLY(), locBtnHidden: !!(document.getElementById('loc-btn') || {}).hidden, pill: document.getElementById('loc-sec').textContent }));
  await f.click('#lv-family').catch(() => {}); await sleep(1200);
  out.kidPane = await pane(f);
  await e.close();
} catch (err) { out.error = String(err && err.stack || err); }
finally {
  fs.writeFileSync(path.join(EV, PFX + '.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await L.close();
}
