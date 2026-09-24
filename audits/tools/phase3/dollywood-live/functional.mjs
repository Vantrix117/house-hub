// Functional bugs on the park map, reproduced at runtime (variant park, Eli placed by hand at Timber Canyon).
//  1. amenity tap: does tapping a restroom/first-aid/AED marker open its card? (pick() :844 destructures the pick token)
//  2. meeting-point bar after "Set my spot": does the bar's walk time / Go appear? (setMe :1245 never calls renderMeet)
//  3. compass/upright button: does it keep the view where the family is, or jump? (:1467 toggles l-upright -> :1029 fits SEC[curSec], curSec='entrance')
//  4. amenity data present in this build at all (D.amen)
// Run: node "audits/tools/phase3/dollywood-live/functional.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(1200);
  const f = await openMap(d, { settle: 2500 });
  // place a spot by hand at the map centre (Timber Canyon), like a person with no GPS
  await f.click('#lv-family').catch(() => {});
  await f.click('#loc-near'); await sleep(300);
  await f.click('#loc-place'); await sleep(400);
  await f.click('#lv-act'); await sleep(1500);   // "I'm here"
  out.afterPlace_pill = await f.evaluate(() => document.getElementById('lv-pill').dataset.state);

  // (2) meeting-point bar state right after placing — MEET was set by Mae 12 min ago in the seed
  out.meetBarAfterPlace = await f.evaluate(() => { const b = document.getElementById('lv-meet'); return { hidden: b.hidden, meta: document.getElementById('meet-meta').textContent, goHidden: document.getElementById('meet-go').hidden }; });
  // force a family sync (what would eventually happen) and compare
  await f.evaluate(() => { if (window.loadMeet) loadMeet(); });
  await sleep(300);
  out.meetBarAfterSync = await f.evaluate(() => ({ meta: document.getElementById('meet-meta').textContent, goHidden: document.getElementById('meet-go').hidden }));

  // (4) amenity data in the payload
  out.amenData = await f.evaluate(() => ({ hasField: 'amen' in D, count: (D.amen || []).length, kinds: [...new Set((D.amen || []).map(a => a.kind))] }));

  // (1) amenity tap: zoom in until amenity markers draw, then click one and see if a card (#pop.show) opens
  out.amenityTap = await f.evaluate(async () => {
    // zoom to a small box around the centre so drawAmen draws (needs mpp between 0.3 and 0.6 on illustrated)
    for (let i = 0; i < 8 && !document.querySelector('g.amk'); i++) { document.body && document.querySelector('#z-in') && $('z-in').click(); await new Promise(r => setTimeout(r, 200)); }
    const amk = document.querySelector('g.amk');
    if (!amk) return { drew: false };
    const pickToken = amk.dataset.pick;
    // call the app's own pick() through a synthetic path: dispatch a click at the marker centre
    const before = document.querySelector('#pop.show') ? true : false;
    // simulate what a tap does: pointerdown/up on the svg element at the marker; instead call pick directly via the exposed path
    const r = amk.getBoundingClientRect();
    const res = window.pick ? window.pick(amk) : 'pick not global';
    const cardOpen = !!document.querySelector('#pop.show');
    return { drew: true, pickToken, pickReturn: res, cardOpenedByPickFn: cardOpen };
  });

  // (3) compass/upright: record the view before and after tapping #lv-north
  out.compass_viewBefore = await f.evaluate(() => document.getElementById('map').getAttribute('viewBox'));
  await f.click('#lv-north'); await sleep(900);
  out.compass_viewAfter = await f.evaluate(() => document.getElementById('map').getAttribute('viewBox'));
  out.compass_note = 'viewBox center should stay near Timber Canyon (~760,842 in map metres, i.e. x0~560,y0~560 in the fit); a jump to the entrance area (top of frame) means the upright handler re-fit to SEC[curSec] with curSec=entrance';
  await shot(d, 'functional-compass-after.png');
} finally { save('functional.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
