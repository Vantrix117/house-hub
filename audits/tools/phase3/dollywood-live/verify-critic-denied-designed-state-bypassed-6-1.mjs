// Skeptic 1 for "critic-denied-designed-state-bypassed-6": on a location denial (watchPosition error code 1),
// does the pill stay in data-state 'searching' with no action chip, instead of the designed 'denied' state
// with a "Set my spot" chip (apps/dollywood-live.html:1267 vs 1404-1405)? And what brings the designed state back?
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
const PFX = 'verify-critic-denied-designed-state-bypassed-6-1';
fs.mkdirSync(EV, { recursive: true });
const snap = f => f.evaluate(() => {
  const g = id => document.getElementById(id);
  const vis = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { hidden: e.hidden || r.width === 0, inViewport: r.bottom > 0 && r.top < innerHeight && r.width > 0, top: Math.round(r.top) }; };
  let err = null, wid = null; try { err = gpsErr; wid = watchId; } catch (e) { err = 'n/a'; }
  return { state: g('lv-pill').dataset.state, glyph: g('lv-emoji').textContent, emojiHidden: g('lv-emoji').hidden,
    title: g('loc-sec').textContent, sub: g('loc-acc').textContent, actHidden: g('lv-act').hidden, actText: g('lv-act').textContent,
    gpsErr: err, watchId: wid, setMySpotBtn: vis(g('loc-place')), sheet: g('lv-sheet') && g('lv-sheet').dataset.state };
});
const out = { engine: 'webkit', note: 'geolocation permission not granted in the context, so watchPosition rejects with code 1 (PERMISSION_DENIED)' };
let L;
try {
  L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  for (const [dev, prof] of [['iphone-pwa', 'eli'], ['ipad-portrait', 'mom']]) {
    const k = `${prof}-${dev}`; const r = (out[k] = {});
    const d = await L.device({ device: dev, profile: prof, fixedTime: false });
    await d.goto('#home'); await sleep(1200);
    const f = await d.openApp('dollywood-live');
    await f.waitForSelector('#lv-pill[data-state]', { timeout: 20000 });
    await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
    await sleep(2000);
    r.before = await snap(f);
    await f.click('#loc-btn');                       // "Find me"
    await sleep(1500); r.denied_1_5s = await snap(f);
    await sleep(15500); r.denied_17s = await snap(f); // past the 15 s interval (which needs a fix anyway)
    if (k === 'eli-iphone-pwa') await d.page.screenshot({ path: path.join(EV, `${PFX}-${k}-denied.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    // what re-renders it: a visibilitychange with the page still visible (what returning from the background does)
    await f.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await sleep(500); r.afterVisibilityChange = await snap(f);
    if (k === 'eli-iphone-pwa') await d.page.screenshot({ path: path.join(EV, `${PFX}-${k}-after-visibility.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    await d.close();
  }
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, `${PFX}.json`), JSON.stringify(out, null, 1));
} finally { if (L) await L.close(); }
