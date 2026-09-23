// Area "dollywood-live": the Dollywood park map (apps/dollywood-live.html — a generated export; never edited here).
//
// One full-bleed map (the park's illustrated sheet, rotated upright, :1426) with a status pill (:1259-1287), the Find me /
// Whole park buttons, a meeting-point bar (:1579-1591), a directions bar with steps (:1319-1395), and a bottom sheet with
// four tabs: Nearby (Nearby | Waits, :1288-1293, :1523-1533), Family (:1295-1309 + kids' heights :1545-1548), Search
// (the listings, moved into the sheet at :1463) and Style (:1415-1416, :1464). Tapping a listing opens its card (:1432-1450).
//
// Data (seed/dollywood-live.mjs, seed/waits.mjs): family loc:<id>, meet, kid:<kidId>, kidshare:<kidId>; person share.
// Park-day screens use variant { typical: 'park' }; overflow is a park day too (see the seed). The Worker's waits proxy is
// fed by seed/waits.mjs in every variant (public data, not app data), so "empty" still has wait chips.
//
// Geolocation: the rig never grants it. WebKit then denies watchPosition at once (code 1). On a park day Eli's
// "Share my spot" is on, so opening the map starts GPS (:1486) and the denial writes "Location is off for this site"
// straight into the pill (:1404) — that is the `map` typical capture. A spot with a fix is reached the way a person without
// GPS gets one: Set my spot → I'm here (:1266, :1468-1470), which places them at the map's centre (Timber Canyon, beside
// Whistle Punk Chaser) — every "…-spot"/nearby/ride-card/directions capture starts that way ("placed by hand" in the pill).
// A restored last fix (localStorage dollywood.live.last, :1478) gives the stale state (map-restored) and, outside the
// mapped frame, the arriving and far states (map-arriving, map-far): those branches of updLoc (:1270-1274) ignore staleness.
//
// Not capturable: every confirm() — Meet here (:1591), long-press meeting point (:1460), Done/clear meeting point (:1457) —
// Playwright dismisses native dialogs, so those flows stop at the dialog (see observations). A live GPS fix, the heading
// cone and the "weak"/"searching" pill states need real positions. Kiosk: the shell lists no apps for
// the kiosk. The amenity card (:1574) cannot open today (pick() at :844 drops the x/y of "a:kind:x:y"); amenity-tap
// taps a marker anyway, so it shows what a tap does today and the card once that is fixed.
import { DEMO_TIME } from '../seed/story.mjs';
import { waitsFeed } from '../seed/waits.mjs';

export const area = 'dollywood-live';
const APP = 'dollywood-live';

// ── helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────
const F = t => t.frame();
const sel = s => `#lv-pill[data-state="${s}"]`;

// Open the map and wait until it has drawn (the pill gets a state in liveInit, :1489) and — outside the loading state —
// until hub.js has delivered the family rows (a family marker, the meeting-point bar or, in empty, the Family pane's
// empty line) and the waits have attached (a .lv-wait chip), each with a short timeout.
async function open(t, { family = true } = {}) {
  const f = await t.openApp(APP);
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 12000 });
  if (t.loading) { await t.sleep(300); return f; }
  if (family && !t.variant.startsWith('empty')) {
    await f.waitForFunction(() => document.querySelectorAll('#fam .famk').length > 0 || !document.getElementById('lv-meet').hidden
      || document.querySelector('#kid-list .lv-kid'), null, { timeout: 5000, polling: 100 }).catch(() => {});
  }
  await f.waitForSelector('.lv-wait', { state: 'attached', timeout: 4000 }).catch(() => {});
  await t.sleep(250);
  return f;
}

// Set my spot → I'm here: places "me" at the centre of the map (the crosshair), like a person without GPS would.
async function placeSpot(t, f) {
  await t.tap(F(t).locator('#loc-place'));
  await f.waitForSelector(sel('placing'), { timeout: 3000 }).catch(() => {});
  await t.tap(F(t).locator('#lv-act'));
  await f.waitForFunction(() => !['placing', 'idle', 'searching', 'denied'].includes(document.getElementById('lv-pill').dataset.state), null, { timeout: 3000, polling: 100 }).catch(() => {});
  await t.sleep(200);
}

// Open a sheet tab ('near' | 'family' | 'search' | 'layers'); from peek the sheet opens to half (:1471).
async function pane(t, f, tab) {
  const id = { near: '#loc-near', family: '#lv-family', search: '#lv-search', layers: '#lv-layers-tab' }[tab];
  await t.tap(F(t).locator(id));
  await f.waitForSelector('#lv-sheet[data-state="half"]', { timeout: 3000 }).catch(() => {});
  await t.sleep(450);   // the sheet's 300 ms height transition
}

// Search the listings and open one's card (the .oi row → flyTo → showOfficial, :1008, :1432).
async function openCard(t, f, query, num) {
  await pane(t, f, 'search');
  await F(t).locator('#q').fill(query);
  await f.waitForSelector(`#tab-list .oi[data-n="${num}"]`, { timeout: 3000 });
  await t.tap(F(t).locator(`#tab-list .oi[data-n="${num}"]`));
  await f.waitForSelector('#pop.show .pop-head', { timeout: 4000 }).catch(() => {});
  await t.sleep(900);   // flyTo's tween
}

async function scrollSheet(t, f, y = 'bottom') { await t.scroll('#lv-sheet .lv-body', y, f); }

// Tap an amenity marker (restroom first) that sits in the open part of the map and is not covered by a listing marker or
// a wait chip at its centre (elementFromPoint). drawAmen (:1566) only draws them between 0.3 and 0.6 m per px on the
// illustrated style, so zoom in with the map's own "+" key (:853) until some are drawn.
async function tapAmenity(t, f) {
  for (let i = 0; i < 5; i++) {
    const pick = await f.evaluate(() => {
      const W = innerWidth, top = document.getElementById('lv-meet').getBoundingClientRect().bottom || 140;
      const bottom = document.getElementById('lv-sheet').getBoundingClientRect().top - 30;
      const c = [...document.querySelectorAll('g.amk')].map(g => { const r = g.getBoundingClientRect(); return { g, p: g.dataset.pick, x: r.x + r.width / 2, y: r.y + r.height / 2 }; })
        .filter(a => a.x > W * 0.15 && a.x < W * 0.85 && a.y > top + 30 && a.y < bottom)
        .filter(a => { const e = document.elementFromPoint(a.x, a.y); return e && e.closest('g.amk') === a.g; })
        .sort((a, b) => (b.p.startsWith('a:restroom') - a.p.startsWith('a:restroom')) || (Math.hypot(a.x - W / 2, a.y - (top + bottom) / 2) - Math.hypot(b.x - W / 2, b.y - (top + bottom) / 2)));
      return c.length ? c[0].p : null;
    });
    if (pick) { await t.tap(F(t).locator(`g.amk[data-pick="${pick}"]`), { force: true }); return true; }
    await F(t).locator('body').press('+'); await t.sleep(350);
  }
  return false;
}

// The upstream feed failing: the Worker answers 502 upstream (worker/src/index.js:67), as it does when queue-times is down.
// t.failApi adds the site's CORS headers as the Worker does, so the page sees a 502 (r.ok false, :1500), not a CORS failure.
async function failWaits(t) {
  await t.failApi('/api/dollywood/waits', { status: 502, error: 'upstream', message: 'Wait times are not available right now.' });
}

// The Worker's answer (worker/src/index.js:71-76) for the seed's rides with every one posted closed, as queue-times posts
// them outside opening hours: open false, wait 0 (the app shows a closed ride as wait null, :1502).
function closedWaits() {
  const rides = waitsFeed(DEMO).lands.flatMap(l => l.rides.map(r => ({ name: r.name.replace(/[®™]/g, '').trim(), land: l.name, open: false, wait: 0, updated: r.last_updated })));
  return { ok: true, at: DEMO, updated: rides.reduce((m, r) => (r.updated > m ? r.updated : m), ''), source: 'queue-times.com', rides };
}

// Breadcrumbs a device that has had the map open for ten minutes keeps (localStorage dollywood.live.trails, :1595-1597):
// [x, y, t] per person, oldest first, ending where the seed puts them now. Fixed to the demo clock.
const DEMO = Date.parse(DEMO_TIME);
const ago = m => DEMO - m * 60000;
const TRAILS = {
  christian: [[855, 921, ago(11)], [858, 890, ago(9)], [861, 856, ago(8)], [864, 822, ago(6)], [866, 796, ago(5)], [866, 784, ago(4)]],
  mom: [[828, 801, ago(10)], [833, 816, ago(9)], [838, 832, ago(7)], [841, 846, ago(5)], [842, 858, ago(3)]],
  ezra: [[829, 803, ago(10)], [835, 819, ago(8)], [840, 836, ago(6)], [844, 851, ago(3)], [847, 864, ago(1)]],
};

// Eli's own last fix on this device, 2 minutes old, where the seed's loc:eli puts him (the Thunderhead queue).
const MEET_FIX = { x: 762, y: 842, acc: 6, hdg: null, t: ago(2), src: 'gps', sec: 'timber' };
// A last fix in the parking lots north of the mapped frame (y > D.hm 2211.5; within 300 m, so "on the property", :1170),
// and one about eight miles from the park (invented map metres, no real place). Both outside the frame, so no area (sec null).
const ARRIVE_FIX = { x: 702, y: 2318, acc: 9, hdg: null, t: ago(1), src: 'gps', sec: null };
const FAR_FIX = { x: -9000, y: 12500, acc: 14, hdg: null, t: ago(3), src: 'gps', sec: null };

// The park day for every state that reads the typical data: typical itself, and loading/offline/error, which the rig
// otherwise builds from the plain 'typical' variant (capture.mjs variantFor) — a non-park day with no one on the map.
const PARK = { typical: 'park', loading: 'park', offline: 'park', error: 'park' };

export const screens = [
  // ── the map ──────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    screen: 'map', profile: 'eli', variant: PARK,
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Opening view, no fix. Park day (typical, overflow, offline): family markers, meeting-point bar; Eli shares his spot, so GPS starts and the rig\'s denial shows "Location is off for this site". Empty: idle pill "Where are you?" + Find me. Loading: map drawn, no family, no waits.',
    async go(t) { await open(t); },
  },
  {
    screen: 'map-spot', profile: 'eli', variant: PARK,
    states: ['empty', 'typical', 'overflow', 'offline'],
    note: 'After Set my spot → I\'m here: the good pill ("You\'re in Timber Canyon … placed by hand"), the area highlighted, Eli\'s dot. Typical and offline (the park day) carry ten minutes of breadcrumb trails. No loading: placing a spot is the same with or without data (see map/loading).',
    async go(t) {
      // the trails end where the park seed puts Mae, Elizabeth and Ezra, so only the park variant gets them (overflow puts
      // Mae elsewhere); set before the app reads them at load (:1597), and only if the device has none yet
      if (t.variant === 'park') await t.ctx.addInitScript(tr => { try { if (!localStorage.getItem('dollywood.live.trails')) localStorage.setItem('dollywood.live.trails', tr); } catch (e) {} }, JSON.stringify(TRAILS));
      const f = await open(t); await placeSpot(t, f);
    },
  },
  {
    screen: 'placing', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Set my spot tapped: crosshair in the middle, pill "Line up the crosshair on you — then tap I\'m here". One state: nothing in it depends on data.',
    async go(t) { const f = await open(t); await t.tap(F(t).locator('#loc-place')); await f.waitForSelector(sel('placing'), { timeout: 3000 }).catch(() => {}); },
  },
  {
    screen: 'map-restored', profile: 'guest-grandmajo', variant: PARK,
    states: ['typical'],
    localStorage: { 'dollywood.live.last': { x: 771, y: 832, acc: 7, hdg: null, t: ago(25), src: 'gps', sec: 'timber' } },
    note: 'Grandma Jo (guest, not sharing, so no GPS starts on open) reopens the map 25 minutes after her last fix on this device (dollywood.live.last, :1478): the stale pill "Last seen 25 min ago" with Find me, her dot faded. (For anyone sharing, the rig\'s GPS denial overwrites this pill — see meet.)',
    async go(t) { await open(t); },
  },
  {
    screen: 'map-denied', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'The designed "denied" pill: after the GPS denial, Set my spot tapped and tapped again (cancel) re-runs updLoc (:1266), which only now shows "Location is off for this site" with its Set my spot chip. On first open the denial handler (:1404) writes the text but leaves the pill without the chip (see map/typical).',
    async go(t) {
      const f = await open(t);
      await t.tap(F(t).locator('#loc-place')); await f.waitForSelector(sel('placing'), { timeout: 3000 }).catch(() => {});
      await t.tap(F(t).locator('#loc-place')); await f.waitForSelector(sel('denied'), { timeout: 3000 }).catch(() => {});
    },
  },
  {
    screen: 'whole-park', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Whole park (the corner-brackets button, :1466): the fit-all view of the property, parking lots included, family markers and the meeting-point flag at that scale.',
    async go(t) { const f = await open(t); await t.tap(F(t).locator('#lv-fit')); await t.sleep(900); },
  },
  {
    screen: 'north-up', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'The compass button tapped (:1467): it toggles the build guide\'s l-upright layer switch. The capture shows what a person gets: the view jumps from Timber Canyon (where the family is) to the Entrance and parking area at a closer zoom, with no visible change of orientation and the compass glyph re-rotated (see observations).',
    async go(t) { const f = await open(t); await t.tap(F(t).locator('#lv-north')); await t.sleep(900); },
  },
  {
    screen: 'map-satellite', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Style → Satellite, sheet back to peek: the aerial photo (apps/dollywood/aerial.jpg, 1.6 MB, not precached) with paths and rides drawn on.',
    async go(t) {
      const f = await open(t); await pane(t, f, 'layers');
      await t.tap(F(t).locator('#lv-styles button[data-bm="aerial"]'));
      await t.tap(F(t).locator('#lv-handle')); await t.tap(F(t).locator('#lv-handle'));   // half → full → peek
      await f.waitForSelector('#lv-sheet[data-state="peek"]', { timeout: 3000 }).catch(() => {});
      await t.sleep(1200);   // the aerial image decodes
    },
  },
  // ── Nearby ───────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    screen: 'nearby', profile: 'eli', variant: PARK,
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Spot placed, Nearby open (half sheet): kid chips (with heights), the "Next ride · door to seat" card, amenity chips, the 12 nearest listings with wait chips. Loading: no waits → no hero card, no chips. Empty: no kids\' heights on the chips.',
    async go(t) { const f = await open(t); await placeSpot(t, f); await pane(t, f, 'near'); },
  },
  {
    screen: 'nearby-nofix', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Nearby before anyone has a spot: "Find yourself first: tap ◎, or use Set my spot."',
    async go(t) { const f = await open(t); await pane(t, f, 'near'); },
  },
  {
    screen: 'nearby-scrolled', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Nearby scrolled to the end of the list: the last listings and the Queue-Times credit line.',
    async go(t) { const f = await open(t); await placeSpot(t, f); await pane(t, f, 'near'); await scrollSheet(t, f); },
  },
  // ── Waits ────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    screen: 'waits', profile: 'eli', variant: PARK,
    states: ['typical', 'overflow', 'loading', 'offline', 'error'],
    note: 'Nearby → Waits with a spot placed: banded by wait (under 15 / 15–35 / 35+ / Closed), Shortest wait | Near me. Loading: "Loading wait times…". Offline: the cached waits under "⚠ Waits as of 8:40 AM — offline, retrying". Error: the waits call answers 502 (queue-times down) → "Could not reach the wait-time feed". No empty: waits are the public feed, not app data (empty only drops the heights from the kid chips — see nearby/empty).',
    async go(t) {
      if (t.error) await failWaits(t);
      const f = await open(t); await placeSpot(t, f); await pane(t, f, 'near');
      await t.tap(F(t).locator('#near-mode-waits')); await t.sleep(300);
    },
  },
  {
    screen: 'waits-park-closed', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Every ride posted closed (the feed before opening or after close): parkClosed() (:1506) drops every wait chip from the map and Waits says "The park is closed — waits will show here once rides open." (:1526). Made by answering the waits call with the seed\'s rides, all closed, in the Worker\'s shape (worker/src/index.js:71-76).',
    async go(t) {
      await t.answer('/api/dollywood/waits', { body: closedWaits() });
      const f = await open(t); await placeSpot(t, f); await pane(t, f, 'near');
      await t.tap(F(t).locator('#near-mode-waits')); await t.sleep(300);
    },
  },
  {
    screen: 'waits-scrolled', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'The Waits list scrolled to the end: the 35-min-and-up band, Closed rides and the credit line.',
    async go(t) {
      const f = await open(t); await placeSpot(t, f); await pane(t, f, 'near');
      await t.tap(F(t).locator('#near-mode-waits')); await t.sleep(300); await scrollSheet(t, f);
    },
  },
  {
    screen: 'waits-kid', profile: 'eli', variant: PARK,
    states: ['typical', 'overflow'],
    note: 'Waits filtered for Ezra (43"), the "35 min and up" band scrolled to the top of the sheet: rides he is too short for are faded (Thunderhead and Lightning Rod, 48"; the Waits rows carry no "needs 48"" chip — only Nearby and Search rows do, :1292, :1452), and the chip row that says the filter is on has scrolled away; the choice is kept per device (dollywood.live.who).',
    async go(t) {
      const f = await open(t); await placeSpot(t, f); await pane(t, f, 'near');
      await t.tap(F(t).locator('#near-mode-waits')); await t.sleep(300);
      await t.tap(F(t).locator('#near-list .lv-who-chips button[data-who="ezra"]')); await t.sleep(300);
      // the long-wait band at the top of the sheet body (where the faded rows are), not the end of the list (waits-scrolled)
      await f.evaluate(() => { const body = document.querySelector('#lv-sheet .lv-body'); const g = body && [...body.querySelectorAll('.lv-grp')].find(e => /35 min and up/i.test(e.textContent));
        if (g) body.scrollTop += g.getBoundingClientRect().top - body.getBoundingClientRect().top - 4; });
      await t.sleep(250);
    },
  },
  // ── Family ───────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    screen: 'family', profile: 'eli', variant: PARK,
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Family pane (half sheet): Share my spot, Eli\'s own row, everyone sharing (place · seen N min ago), then Kids\' beacons and Kids\' heights further down. Empty: sharing off, "No one else is sharing right now" and no kids\' sections at all (see family-kids). Loading: the family rows never arrive and the header already reads "offline — showing last known". Offline: the same header over the cached rows.',
    async go(t) { const f = await open(t); await pane(t, f, 'family'); },
  },
  {
    screen: 'family-kids', profile: 'eli', variant: PARK,
    states: ['empty', 'typical', 'overflow'],
    note: 'The Family pane scrolled to the end: Kids\' beacons (adults only) and the Kids\' heights steppers. Empty: neither section is drawn — renderFam returns early when nobody else is sharing (:1304), before the beacons (:1307) and renderKids (:1309), so an adult cannot switch on a beacon or enter a height until someone shares (see observations).',
    async go(t) { const f = await open(t); await pane(t, f, 'family'); await scrollSheet(t, f); },
  },
  {
    screen: 'family-card', profile: 'eli', variant: PARK,
    states: ['typical', 'overflow'],
    note: 'Mae\'s row tapped: the map flies to her and opens her card (place, seen N min ago, accuracy).',
    async go(t) {
      const f = await open(t); await pane(t, f, 'family');
      await t.tap(F(t).locator('#fam-list .lv-item[data-f="christian"]'));
      await f.waitForSelector('#pop.show', { timeout: 3000 }).catch(() => {}); await t.sleep(900);
    },
  },
  {
    screen: 'family-guest', profile: 'guest-grandmajo', variant: PARK,
    states: ['typical'],
    note: 'Grandma Jo (a guest) in the Family pane: the park map has no guest check, so a guest gets Share my spot, the kids\' beacon switches and the height steppers like a household adult.',
    async go(t) { const f = await open(t); await pane(t, f, 'family'); await scrollSheet(t, f); },
  },
  // ── Search & Style ───────────────────────────────────────────────────────────────────────────────────────────────
  {
    screen: 'search', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Search pane before typing: the build guide\'s listings panel moved into the sheet (:1463) — a short search field, "Official listings", the rider-height select, "145 of 145", then every listing by area with the guide\'s "N/N placed" counts and category tags. Kid chips and wait chips appear only once a query is typed (search-query). Typical only: the pane is the page\'s own data, so empty/overflow/loading/offline change nothing in it, only the map behind it (see map/*).',
    async go(t) { const f = await open(t); await pane(t, f, 'search'); },
  },
  {
    screen: 'search-full', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'The sheet at full height (handle tapped from half, :1471) on the Search pane: how much of the map stays visible above the tallest sheet state.',
    async go(t) {
      const f = await open(t); await pane(t, f, 'search');
      await t.tap(F(t).locator('#lv-handle'));
      await f.waitForSelector('#lv-sheet[data-state="full"]', { timeout: 3000 }).catch(() => {}); await t.sleep(450);
    },
  },
  {
    screen: 'search-query', profile: 'eli', variant: PARK,
    states: ['typical', 'loading'],
    note: '"wild" typed: the list filters as you type (5 of 145), the kid chips appear, and rides carry their wait chip (Wild Eagle "35 min wait"). Loading: the same results without wait chips. No empty/overflow/offline: the listings are the page\'s own data and the waits the public feed (offline shows the cached chips, as typical).',
    async go(t) { const f = await open(t); await pane(t, f, 'search'); await F(t).locator('#q').fill('wild'); await t.sleep(300); },
  },
  {
    screen: 'search-none', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'A search with no match ("zipline"): "0 of 145" and no empty-state message.',
    async go(t) { const f = await open(t); await pane(t, f, 'search'); await F(t).locator('#q').fill('zipline'); await t.sleep(300); },
  },
  {
    screen: 'style', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Style pane: Illustrated | Satellite, "Contour interval (satellite)" and the build guide\'s Layers tab moved in (:1464). No data in it, so one state.',
    async go(t) { const f = await open(t); await pane(t, f, 'layers'); },
  },
  {
    screen: 'style-scrolled', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'The Style pane scrolled to the end: the layer toggles and "About the data".',
    async go(t) { const f = await open(t); await pane(t, f, 'layers'); await scrollSheet(t, f); },
  },
  // ── cards, meeting point, directions ─────────────────────────────────────────────────────────────────────────────
  {
    screen: 'ride-card', profile: 'eli', variant: PARK,
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    note: 'Spot placed, then Thunderhead (#28) opened from Search: category band, Directions / Meet here / Zoom / Track, who can ride (Ezra 43" and Kiara 40" vs 48"), the wait + distance line, About. Empty: "height?" for each kid. Loading: no wait line.',
    async go(t) { const f = await open(t); await placeSpot(t, f); await openCard(t, f, 'Thunderhead', 28); },
  },
  {
    screen: 'ride-card-closed', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Blazing Fury (#46), closed this morning: the grey "Closed" line on its card.',
    async go(t) { const f = await open(t); await placeSpot(t, f); await openCard(t, f, 'Blazing', 46); },
  },
  {
    screen: 'ride-card-kid', profile: 'kiara', variant: PARK,
    states: ['typical'],
    note: 'Kiara (kid, beacon off → view-only) opens The Mad Mockingbird (#137): no Meet here, no web link; Directions still offered though a view-only kid can never get a spot.',
    async go(t) { const f = await open(t); await openCard(t, f, 'Mockingbird', 137); },
  },
  {
    screen: 'amenity-tap', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Spot placed, zoomed in with the map\'s + key until the amenity markers draw (:1566, only between 0.3 and 0.6 m/px on the illustrated style), then an uncovered restroom marker tapped. The amenity card (:1574) should open, but today nothing does: pick() (:844) splits "a:restroom:x:y" into only two parts, so x and y are undefined and no amenity matches (see observations). The capture therefore shows the zoomed-in amenity markers after the tap; it will show the card once pick() is fixed. If no marker could be tapped, the capture\'s console lines say so.',
    async go(t) {
      const f = await open(t); await placeSpot(t, f);
      if (await tapAmenity(t, f)) { await f.waitForSelector('#pop.show', { timeout: 3000 }).catch(() => {}); await t.sleep(500); }
      else await f.evaluate(() => console.warn('rig: no uncovered amenity marker to tap on this device'));
    },
  },
  {
    screen: 'coaster-card', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Thunderhead\'s card → Track (#i-coast, :984): the build guide\'s coaster card (showCoaster :989-1003) — mapped track length, footprint, ground under the track, a track mini-map and a ground-elevation profile. liveCard (:1438) reshapes only listing cards, so this one arrives in the park map as the survey card. One state: nothing in it is app data.',
    async go(t) {
      const f = await open(t); await openCard(t, f, 'Thunderhead', 28);
      await t.tap(F(t).locator('#i-coast'));
      await f.waitForSelector('#pop.show #gp', { timeout: 3000 }).catch(() => {}); await t.sleep(600);
    },
  },
  {
    screen: 'dining-card', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Spot placed, then Till & Harvest Food Hall (#144, dining) opened from Search: a listing card with no wait line and no who-can-ride row (both are ride-only). Shops use the same card.',
    async go(t) { const f = await open(t); await placeSpot(t, f); await openCard(t, f, 'Till', 144); },
  },
  {
    screen: 'map-arriving', profile: 'guest-grandmajo', variant: PARK,
    states: ['typical'],
    localStorage: { 'dollywood.live.last': ARRIVE_FIX },
    note: 'Grandma Jo (not sharing, so no GPS starts) reopens the map a minute after a fix in the parking lots north of the mapped frame: the "arriving" pill ("At Dollywood — the parking lots", distance off the map and to the gates) and her dot at the frame\'s edge. Reached from a restored fix because the rig has no GPS; the out-of-frame branches of updLoc (:1270-1274) ignore staleness, so a live fix there shows the same pill.',
    async go(t) { await open(t); },
  },
  {
    screen: 'nearby-arriving', profile: 'guest-grandmajo', variant: PARK,
    states: ['typical'],
    localStorage: { 'dollywood.live.last': ARRIVE_FIX },
    note: 'The same arrival fix, Nearby open: "You\'re in the arrival area — the entrance is … away … Rides will list here once you\'re through the gates." (:1289).',
    async go(t) { const f = await open(t); await pane(t, f, 'near'); },
  },
  {
    screen: 'map-far', profile: 'dad', variant: PARK,
    states: ['typical'],
    localStorage: { 'dollywood.live.last': FAR_FIX },
    note: 'David, at home on the family\'s park day (not sharing), opens the map to see where everyone is, with a fix from a few minutes ago, about eight miles away: the "far" pill ("N mi from the park · Dollywood is to your …"). Restored fix, as map-arriving.',
    async go(t) { await open(t); },
  },
  {
    screen: 'nearby-far', profile: 'dad', variant: PARK,
    states: ['typical'],
    localStorage: { 'dollywood.live.last': FAR_FIX },
    note: 'The same far-away fix, Nearby open: "You are away from the park — rides will list here once you arrive." (:1290).',
    async go(t) { const f = await open(t); await pane(t, f, 'near'); },
  },
  {
    screen: 'meet', profile: 'eli', variant: PARK,
    states: ['typical', 'overflow', 'offline'],
    localStorage: { 'dollywood.live.last': MEET_FIX },
    note: 'Eli with his fix from 2 minutes ago (restored on this device): the meeting-point bar shows the walk time, Go and Done (Done clears it after a confirm() the rig cannot show). The bar is only re-rendered on a family change, so a spot placed by hand does not add Go (see observations); hence the restored fix. The pill shows the rig\'s GPS denial. No empty/loading: no meeting point then (see map/empty).',
    async go(t) { const f = await open(t); await f.waitForSelector('#meet-go:not([hidden])', { timeout: 3000 }).catch(() => {}); },
  },
  {
    screen: 'directions', profile: 'eli', variant: PARK,
    states: ['typical', 'overflow'],
    localStorage: { 'dollywood.live.last': MEET_FIX },
    note: 'Meeting point → Go (from the fix of the meet capture): the walking route over the mapped paths, the bar with the first step, "then …", minutes and distance.',
    async go(t) {
      const f = await open(t);
      await f.waitForSelector('#meet-go:not([hidden])', { timeout: 3000 });
      await t.tap(F(t).locator('#meet-go'));
      await f.waitForSelector('#lv-route:not([hidden])', { timeout: 3000 }).catch(() => {}); await t.sleep(900);
    },
  },
  {
    screen: 'directions-steps', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Directions to Wild Eagle (#37) from its card, the bar tapped open: every step with its glyph and distance.',
    async go(t) {
      const f = await open(t); await placeSpot(t, f); await openCard(t, f, 'Wild Eagle', 37);
      await t.tap(F(t).locator('#lv-go'));
      await f.waitForSelector('#lv-route:not([hidden])', { timeout: 3000 }).catch(() => {}); await t.sleep(700);
      await t.tap(F(t).locator('#route-head')); await t.sleep(400);
    },
  },
  {
    screen: 'directions-straight', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Directions to Mystery Mine (#27), 140 m away: no connected mapped path, so the fallback — a dashed straight line and "Head SE straight toward…".',
    async go(t) {
      const f = await open(t); await placeSpot(t, f); await openCard(t, f, 'Mystery', 27);
      await t.tap(F(t).locator('#lv-go'));
      await f.waitForSelector('#lv-route:not([hidden])', { timeout: 3000 }).catch(() => {}); await t.sleep(900);
    },
  },
  {
    screen: 'directions-amenity', profile: 'eli', variant: PARK,
    states: ['typical'],
    note: 'Nearby → Restroom chip: directions to the nearest restroom.',
    async go(t) {
      const f = await open(t); await placeSpot(t, f); await pane(t, f, 'near');
      await t.tap(F(t).locator('#near-list [data-amen="restroom"]'));
      await f.waitForSelector('#lv-route:not([hidden])', { timeout: 3000 }).catch(() => {}); await t.sleep(900);
    },
  },
  // ── kids ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    screen: 'kid', profile: 'ezra', variant: PARK,
    states: ['empty', 'typical', 'overflow', 'offline'],
    note: 'Ezra\'s map. Park day: his beacon is on (an adult switched it on), so he may locate and share — GPS starts and the rig denies it. Empty: no beacon → view-only ("Rides and the family, live · Ezra · just looking", no Find me). No loading: same as map/loading.',
    async go(t) { await open(t); },
  },
  {
    screen: 'kid-family', profile: 'ezra', variant: PARK,
    states: ['typical', 'overflow'],
    note: 'Ezra\'s Family pane: his beacon shows as Share my spot; no kids\' beacons or heights (adults only).',
    async go(t) { const f = await open(t); await pane(t, f, 'family'); },
  },
  {
    screen: 'kid-viewonly', profile: 'kiara', variant: PARK,
    states: ['typical'],
    note: 'Kiara on the park day, beacon off: view-only — no Find me, idle pill "Kiara · just looking", the family and the meeting point visible.',
    async go(t) { await open(t); },
  },
  {
    screen: 'kid-nearby', profile: 'kiara', variant: PARK,
    states: ['typical'],
    note: 'Kiara (view-only) opens Nearby: "Find yourself first: tap ◎, or use Set my spot" — but the ◎ button is hidden for her.',
    async go(t) { const f = await open(t); await pane(t, f, 'near'); },
  },
];
