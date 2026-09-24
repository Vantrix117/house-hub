// Skeptic 2 for "critic-denied-designed-state-bypassed-6": on a location denial (watchPosition error code 1) does the pill
// stay in 'searching' with no action chip, instead of the designed 'denied' state with "Set my spot" (apps/dollywood-live.html:1267)?
// A: the rig's own denial (no geolocation permission) on WebKit and Chromium, iPhone, Eli.
// B: engine-independent: watchPosition stubbed in the app frame to fail with code 1 asynchronously (as iOS does after "Don't Allow").
// Samples the pill at 0.5 s, 3 s and 16 s (past the 15 s timer), checks whether a Set my spot control is reachable elsewhere
// (#loc-place in the sheet), then fires visibilitychange to show the designed state is one updLoc() away.
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-2.mjs"
import { local, sleep, save, shot, openMap, pill } from './_lib.mjs';
const PFX = 'verify-critic-denied-designed-state-bypassed-6-2';
const out = { ranAt: new Date().toISOString() };
const extra = f => f.evaluate(() => {
  const lp = document.getElementById('loc-place'); const r = lp.getBoundingClientRect();
  const lpVisible = !!(lp.offsetParent) && r.bottom > 0 && r.top < innerHeight && r.width > 0;
  let ge = 'n/a', wid = 'n/a'; try { ge = gpsErr; } catch (e) {} try { wid = watchId; } catch (e) {}
  return { gpsErr: ge, watchId: wid, emoji: document.getElementById('lv-emoji').textContent, emojiSt: document.getElementById('lv-emoji').classList.contains('st'),
    locPlace: { visible: lpVisible, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, text: lp.textContent },
    nearList: (document.getElementById('near-list').textContent || '').slice(0, 90) };
});
async function run(L, key, { stub = false } = {}) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(1000);
  const f = await openMap(d, { settle: 1500 });
  if (stub) await f.evaluate(() => { navigator.geolocation.watchPosition = (ok, err) => { setTimeout(() => err({ code: 1, message: 'User denied' }), 300); return 7; }; navigator.geolocation.clearWatch = () => {}; });
  const r = { before: await pill(f) };
  await f.click('#loc-btn');
  await sleep(500); r.at05s = { ...(await pill(f)), ...(await extra(f)) };
  await sleep(2500); r.at3s = await pill(f);
  await shot(d, `${PFX}-${key}-denied.png`);
  await sleep(13500); r.at16s = await pill(f);
  await f.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(400);
  r.afterVisibilitychange = await pill(f);
  await shot(d, `${PFX}-${key}-after-updloc.png`);
  await d.close();
  console.log(key, JSON.stringify(r, null, 1));
  return r;
}
let L;
try {
  L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  out.webkitRig = await run(L, 'webkit-rig');
  out.webkitStub = await run(L, 'webkit-stub', { stub: true });
  await L.close(); L = null;
  L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  out.chromiumRig = await run(L, 'chromium-rig');
} catch (e) { out.error = String(e && e.stack || e).slice(0, 600); console.error(e); }
finally { if (L) await L.close(); }
save(`${PFX}.json`, out);
