// Skeptic 2: do the pill subtitle (#loc-acc) and the meeting-bar meta (#meet-meta) cut off their text on an iPhone?
// Measures scrollWidth vs clientWidth and the visible fraction, on iPhone (430) and iPad (820), adult and kid,
// idle -> denied (geolocation never granted), and the meeting bar with the overflow seed's long note and a short note.
// Run: node "audits/tools/phase3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
const PFX = 'verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-2';
fs.mkdirSync(EV, { recursive: true });
const shot = (d, n) => d.page.screenshot({ path: path.join(EV, `${PFX}-${n}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
const measure = f => f.evaluate(() => {
  const m = id => { const e = document.getElementById(id); if (!e) return null; const cs = getComputedStyle(e);
    return { text: e.textContent, client: e.clientWidth, scroll: e.scrollWidth, cut: e.scrollWidth > e.clientWidth + 1,
      visibleFrac: +(e.clientWidth / Math.max(1, e.scrollWidth)).toFixed(2), overflow: cs.textOverflow, ws: cs.whiteSpace, font: cs.fontFamily.slice(0, 60),
      title: e.getAttribute('title') || e.parentElement.getAttribute('title') || document.getElementById('lv-pill').getAttribute('title') }; };
  return { pillState: document.getElementById('lv-pill').dataset.state, actHidden: document.getElementById('lv-act').hidden,
    locSec: m('loc-sec'), locAcc: m('loc-acc'), meetHidden: document.getElementById('lv-meet').hidden, meetName: m('meet-name'), meetMeta: m('meet-meta') };
});
async function openMap(d) {
  await d.goto('#home'); await sleep(1200);
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 20000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
  await sleep(1500); return f;
}
const out = { note: 'geolocation permission never granted; WebKit rejects watchPosition with code 1' };
let L;
try {
  // A. typical: pill idle -> denied on iPhone and iPad (adult), and iPhone kid (Ezra)
  L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  for (const [dev, prof] of [['iphone-pwa', 'eli'], ['ipad-portrait', 'eli'], ['iphone-pwa', 'ezra']]) {
    const k = `${prof}-${dev}`; const d = await L.device({ device: dev, profile: prof, fixedTime: false });
    const f = await openMap(d);
    const idle = await measure(f);
    await f.click('#loc-btn').catch(e => (out[k + '-clickErr'] = String(e).slice(0, 120)));
    await sleep(2500);
    const denied = await measure(f);
    await sleep(3000); const deniedLater = await measure(f);   // does updLoc rewrite it to the designed denied state?
    // does tapping the pill reveal anything?
    await f.click('#lv-pill', { position: { x: 60, y: 20 } }).catch(() => {}); await sleep(600);
    const afterTap = await measure(f);
    out[k] = { idle: { state: idle.pillState, locAcc: idle.locAcc }, denied: { state: denied.pillState, actHidden: denied.actHidden, locAcc: denied.locAcc },
      deniedAfter3s: { state: deniedLater.pillState, sub: deniedLater.locAcc.text, cut: deniedLater.locAcc.cut }, afterPillTap: { sub: afterTap.locAcc.text, cut: afterTap.locAcc.cut, client: afterTap.locAcc.client } };
    await shot(d, `denied-${k}`);
    await d.close();
  }
  // B. typical: a meeting point with a SHORT rally-style note, written as the rally endpoint would (family 'meet' row)
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    let f = await openMap(d);
    await f.evaluate(() => { hub.set('meet', { x: 855, y: 921, name: 'The Wildwood Tree', note: 'bring the stroller', by: 'christian', byName: 'Mae', at: Date.now() - 5 * 60e3 }, { scope: 'family' }); loadMeet(); });
    await sleep(800);
    out['meet-short-iphone'] = (await measure(f)).meetMeta;
    await shot(d, 'meet-short-iphone'); await d.close();
    const ip = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    f = await openMap(ip); await f.evaluate(() => loadMeet()); await sleep(500);
    out['meet-short-ipad'] = (await measure(f)).meetMeta; await ip.close();
  }
  await L.close(); L = null;
  // C. overflow seed: the long rally note, iPhone vs iPad, adult and kid
  L = await local({ variant: 'overflow', clock: 'demo', engine: 'webkit' });
  for (const [dev, prof] of [['iphone-pwa', 'eli'], ['ipad-portrait', 'eli'], ['iphone-pwa', 'ezra']]) {
    const d = await L.device({ device: dev, profile: prof });
    const f = await openMap(d); const m = await measure(f);
    out[`meet-overflow-${prof}-${dev}`] = { hidden: m.meetHidden, name: m.meetName, meta: m.meetMeta };
    if (dev === 'iphone-pwa' && prof === 'eli') await shot(d, 'meet-overflow-iphone');
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, `${PFX}.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (L) await L.close();
}
