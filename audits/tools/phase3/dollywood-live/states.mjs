// Pill-state bugs that need a restored / out-of-frame last fix, plus the location-denied wording, and the view-only kid.
// Uses localStorage dollywood.live.last (restored as stale under 12 h, :1478) to reach the arriving/far/restored branches.
// Run: node "audits/tools/phase3/dollywood-live/states.mjs"
import { local, sleep, save, shot, openMap, pill } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const ago = m => Date.now() - m * 60000;
try {
  // A. a restored fix in the parking lots (north of the frame, y>2211): the "arriving" branch
  const arrive = { x: 700, y: 2318, acc: 9, hdg: null, t: ago(90), src: 'gps', sec: null };
  let d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, localStorage: { 'dollywood.live.last': JSON.stringify(arrive) } });
  await d.goto('#home'); await sleep(1000);
  let f = await openMap(d, { settle: 2000 });
  out.A_arriving = { ...(await pill(f)), stale: await f.evaluate(() => !!(me && me.stale)), ageMin: 90 };
  await shot(d, 'states-arriving.png'); await d.close();

  // B. a restored fix ~8 mi from the park: the "far" branch
  const far = { x: -9000, y: 12500, acc: 14, hdg: null, t: ago(90), src: 'gps', sec: null };
  d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, localStorage: { 'dollywood.live.last': JSON.stringify(far) } });
  await d.goto('#home'); await sleep(1000);
  f = await openMap(d, { settle: 2000 });
  out.B_far = { ...(await pill(f)), stale: await f.evaluate(() => !!(me && me.stale)), ageMin: 90 };
  await shot(d, 'states-far.png'); await d.close();

  // C. a restored fix inside the park (control): should say "Last seen 90 min ago"
  const inpark = { x: 762, y: 842, acc: 6, hdg: null, t: ago(90), src: 'gps', sec: 'timber' };
  d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, localStorage: { 'dollywood.live.last': JSON.stringify(inpark) } });
  await d.goto('#home'); await sleep(1000);
  f = await openMap(d, { settle: 2000 });
  out.C_inFrame = await pill(f);
  await d.close();

  // D. view-only kid (Kiara, no beacon): the Nearby empty text points at ◎ which is hidden for her; Set my spot present?
  d = await L.device({ device: 'iphone-pwa', profile: 'kiara', fixedTime: false });
  await d.goto('#home'); await sleep(1200);
  f = await openMap(d, { settle: 2000 });
  out.D_kid = await f.evaluate(() => ({
    viewOnly: VIEW_ONLY(),
    findMeBtnHidden: document.getElementById('loc-btn').hidden,
    idlePill: document.getElementById('loc-sec').textContent,
    setMySpotVisible: !!document.getElementById('loc-place') && getComputedStyle(document.getElementById('loc-place')).display !== 'none',
    nearbyEmpty: (document.getElementById('near-list').innerText || '').slice(0, 160),
  }));
  await d.click ? null : null;
  await f.click('#loc-near').catch(() => {}); await sleep(400);
  out.D_kidNearbyText = await f.evaluate(() => (document.getElementById('near-list').innerText || '').slice(0, 200));
  await shot(d, 'states-kid-nearby.png');
} finally { save('states.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
