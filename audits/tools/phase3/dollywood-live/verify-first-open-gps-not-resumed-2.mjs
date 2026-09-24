// Skeptic #2 for finding "first-open-gps-not-resumed": with Share my spot on (server), does the FIRST open of the
// park map on a device resume GPS (apps/dollywood-live.html:1486), and what do the pill and the Family pane say?
// Runs on WebKit and on Chromium (to rule out an engine artefact), variant park, real clock. Also:
//   - the localStorage caches before the open (is the family channel "seen" so hub.ready skips its 6 s wait, hub.js:333-337?)
//   - when the person 'share' row lands vs when hub.ready resolved
//   - control: second open on the same device; and a one-tap workaround (the locate button) on the first open.
// Run: node "audits/tools/phase3/dollywood-live/verify-first-open-gps-not-resumed-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
fs.mkdirSync(EV, { recursive: true });
const PRE = 'verify-first-open-gps-not-resumed-2';
const out = {};
const state = f => f.evaluate(() => {
  const c = document.getElementById('lv-share');
  return { watchId, shareOn: shareOn(), shareRow: hub.get('share', { scope: 'person' }), familySwitchChecked: c ? c.checked : null,
    pill: document.getElementById('lv-pill').dataset.state, title: document.getElementById('loc-sec').textContent, sub: document.getElementById('loc-acc').textContent,
    fab: document.getElementById('loc-btn').dataset.gps, sync: hub.sync.state };
});
async function geoAt(d, f, x, y, acc) {
  const ll = await f.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [x, y]);
  await d.ctx.setGeolocation({ ...ll, accuracy: acc });
}
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'park', clock: 'real', engine });
  const r = out[engine] = {};
  try {
    r.serverShareRow = ((await L.apiAs('eli', '/api/data/dollywood-live?scope=person')).body.items || []).filter(i => i.key === 'share').map(i => i.value);
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
    await d.goto('#home'); await sleep(2500);
    r.cachesBeforeFirstOpen = await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.cache.dollywood-live')).map(k => { let v = {}; try { v = JSON.parse(localStorage.getItem(k)); } catch (e) {} return { key: k, since: v.since, keys: Object.keys(v.items || {}).length }; }));
    const t0 = Date.now();
    const f = await d.openApp('dollywood-live');
    await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
    await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 });
    await geoAt(d, f, 762, 842, 6);
    // poll: when does the person share row land, and does watchId ever get set?
    const samples = [];
    for (let i = 0; i < 12; i++) { const s = await state(f); samples.push({ ms: Date.now() - t0, watchId: s.watchId, shareOn: s.shareOn, pill: s.pill }); await sleep(1000); }
    r.firstOpenSamples = samples;
    r.firstOpenAt12s = await state(f);
    await f.evaluate(() => renderFam());
    r.firstOpenAt12sAfterRenderFam = await state(f);
    await sleep(33000);                                 // past one 30 s pull cycle
    r.firstOpenAt45s = await state(f);
    await d.page.screenshot({ path: path.join(EV, `${PRE}-first-open-${engine}.png`), scale: 'css' });
    // workaround: one tap on the locate button on this same first open
    await f.click('#loc-btn'); await sleep(4000);
    r.firstOpenAfterLocateTap = await state(f);
    // control: second open on the same device
    await d.goto('#home'); await sleep(1500);
    const f2 = await d.openApp('dollywood-live');
    await f2.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
    await f2.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 });
    await geoAt(d, f2, 762, 842, 6); await sleep(4000);
    r.secondOpen = await state(f2);
  } catch (e) { r.error = String(e && e.stack || e).slice(0, 600); }
  finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, PRE + '.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
