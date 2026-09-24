// Skeptic #1 for finding "first-open-gps-not-resumed": on a device that has never opened the park map, with the person's
// Share my spot ON on the server, does the first open start GPS (apps/dollywood-live.html:1486) or not?
// Differences from the investigator's geo.mjs: the geolocation permission AND a position are set BEFORE the shell loads
// (so no "no position yet" confound), and navigator.geolocation.watchPosition is wrapped in every frame to count calls.
// Scenarios (fresh browser context each, real clock, variant park where Eli's share row = true, seed dollywood-live.mjs:58):
//   A  Home first (the PWA boots to Home, the shell pulls the dollywood-live FAMILY channel, index.html:459), then open the map.
//   A2 the same map frame 35 s later (at least one 30 s pull cycle).
//   B  second open on the same device.
//   C  a fresh device that deep-links straight to #dollywood-live (no Home visit first).
// Run: node "audits/tools/phase3/dollywood-live/verify-first-open-gps-not-resumed-1.mjs"
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
const P = 'verify-first-open-gps-not-resumed-1';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const probe = f => f.evaluate(() => {
  const g = id => { const e = document.getElementById(id); return e ? e.textContent : null; };
  const c = document.getElementById('lv-share');
  return { watchPositionCalls: (window.__wp || []).length, firstCallAtMsAfterNav: (window.__wp || [])[0] ?? null, watchId: typeof watchId === 'undefined' ? 'n/a' : watchId,
    shareOnNow: shareOn(), shareRowNow: hub.get('share', { scope: 'person' }), shareRowAtReady: window.__shareAtReady,
    familyPaneSwitchChecked: c ? c.checked : null, pill: { state: document.getElementById('lv-pill').dataset.state, title: g('loc-sec'), sub: g('loc-acc') },
    trackKey: (() => { try { return localStorage.getItem('dollywood.live.track:' + hub.profile.id); } catch { return 'err'; } })(), sync: hub.sync.state };
});
async function mkDevice() {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await d.ctx.setGeolocation({ latitude: 35.7955, longitude: -83.5307, accuracy: 6 });   // a fix exists from the start
  await d.ctx.addInitScript(() => {
    if (!/\/apps\/dollywood-live\.html/.test(location.pathname) || !navigator.geolocation) return;
    const t0 = performance.now(); window.__wp = [];
    const orig = navigator.geolocation.watchPosition.bind(navigator.geolocation);
    navigator.geolocation.watchPosition = (...a) => { window.__wp.push(Math.round(performance.now() - t0)); return orig(...a); };
    // record what the person-scope share row was when hub.ready() resolved for the app
    const iv = setInterval(() => { if (window.hub && hub.ready) { clearInterval(iv); const r = hub.ready.bind(hub); let done = false;
      hub.ready = o => r(o).then(v => { if (!done) { done = true; try { window.__shareAtReady = hub.get('share', { scope: 'person' }); } catch { window.__shareAtReady = 'err'; } } return v; }); } }, 0);
  });
  const pulls = []; d.page.on('response', r => { const u = r.url(); if (/\/api\/data\/dollywood-live\?scope=/.test(u)) pulls.push({ t: Date.now(), scope: (u.match(/scope=(\w+)/) || [])[1], status: r.status() }); });
  return { d, pulls };
}
async function openMap(d) {
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
  return f;
}
try {
  out.server = (await L.apiAs('eli', '/api/data/dollywood-live?scope=person')).body.items?.filter(r => r.key === 'share').map(r => ({ key: r.key, value: r.value }));
  // A: Home first, then the map
  { const { d, pulls } = await mkDevice();
    await d.goto('#home'); await sleep(2000);
    const tOpen = Date.now(); const f = await openMap(d); await sleep(5000);
    out.A_firstOpen_after5s = { ...(await probe(f)), pullsAfterOpen: pulls.filter(p => p.t >= tOpen).map(p => ({ scope: p.scope, msAfterOpen: p.t - tOpen })) , pullsBeforeOpen: pulls.filter(p => p.t < tOpen).map(p => p.scope) };
    await d.page.screenshot({ path: path.join(EV, P + '-A-first-open.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    await sleep(35000);
    out.A2_sameFrame_after40s = await probe(f);
    // B: second open, same device
    const f2 = await openMap(d); await sleep(4000);
    out.B_secondOpen = await probe(f2);
    await d.page.screenshot({ path: path.join(EV, P + '-B-second-open.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    await d.close(); }
  // C: a fresh device straight to the map
  { const { d, pulls } = await mkDevice(); const tOpen = Date.now();
    const f = await openMap(d); await sleep(5000);
    out.C_deepLinkFresh_after5s = { ...(await probe(f)), pulls: pulls.map(p => ({ scope: p.scope, msAfterOpen: p.t - tOpen })) };
    await d.close(); }
} catch (e) { out.error = String(e && e.stack || e); }
finally { fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); await L.close(); }
