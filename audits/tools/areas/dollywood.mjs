// Dollywood build guide (apps/dollywood.html, app id 'dollywood'): the Planet Coaster 2 rebuild reference.
// Adults only (apps.json:9 visibleTo), signed in as Eli, whose person-scope 'progress' and 'plot' come from
// seed/dollywood.mjs. The file is a 2.2 MB generated export (three.js inlined); everything below only taps and types.
//
// Layout facts the scripts lean on (apps/dollywood.html):
//   < 700 px (PHONE(), :689; CSS :303-377): sticky compact tool bar, More disclosure, build steps as a bottom sheet
//     (#build[data-state] peek/half/full, cycled by #bh-handle, :1135-1137).
//   <= 1180 px (CSS :256): one column, so the side tabs (Listings / Layers / Scale) sit below the map, build card and
//     cross-section; on the desktop (1440) they are a sticky right-hand column.
// Guests are adult-kind profiles and see exactly the adult guide (no guest check in the code, 00-inventory 9c §7), so
// no guest screens; kids and the kiosk never get the app (visibleTo).
export const area = 'dollywood';

const APP = 'dollywood';
const phone = t => t.dev.viewport.width < 700;
const wide = t => t.dev.viewport.width > 1180;

/** Tap on touch devices, click otherwise, on a locator inside the app frame. Forced: Playwright's stability checks
 *  wait for animation frames, and each frame of this SVG-heavy page is slow in WebKit, which cost ~2 s per tap. */
async function press(t, loc, opts = {}) {
  await loc.waitFor({ state: 'attached', timeout: 4000 });
  if (t.touch) { await loc.tap({ timeout: 4000, force: true, ...opts }); await park(t); }
  else await loc.click({ timeout: 4000, force: true, ...opts });
}
/** Touch devices: move the engine's virtual mouse off the app (onto the shell's top bar) after a tap. WebKit keeps a
 *  mouse position at the last tap and, after the page scrolls, re-hovers whatever is now under it: the elevation
 *  readout then shows a height no touch produced (pointermove :834-836) and a listing row takes its :hover fill
 *  (unguarded :hover, CSS :66). A finger leaves nothing hovering, so neither is what a person on an iPad sees. */
const park = t => t.page.mouse.move(1, 1).catch(() => {});
/** Scroll the app document so an element is in view (instant; the app has no smooth scroll on its root). */
const reveal = (f, sel, block = 'start') => f.evaluate(([s, b]) => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: b, inline: 'nearest', behavior: 'instant' }); }, [sel, block]);
/** Scroll so an element's top sits just under the tool bar, which is sticky on phones (CSS :318) — the same offset
 *  the app's own mapIntoView() uses (:1140). */
const revealTop = (f, sel) => f.evaluate(s => {
  const e = document.querySelector(s), tb = document.getElementById('toolbar'); if (!e) return;
  const sticky = tb && getComputedStyle(tb).position === 'sticky';
  window.scrollTo({ top: Math.max(0, e.getBoundingClientRect().top + window.scrollY - (sticky ? tb.offsetHeight + 6 : 12)), behavior: 'instant' });
}, sel);
/** Scroll so a card (the map popup) is as whole as it fits: its top under the tool bar, its bottom on screen if it can be. */
const revealCard = (f, sel) => f.evaluate(s => {
  const e = document.querySelector(s), tb = document.getElementById('toolbar'); if (!e) return;
  const top = tb && getComputedStyle(tb).position === 'sticky' ? tb.offsetHeight + 6 : 12;
  const r = e.getBoundingClientRect(), build = document.getElementById('build');
  const bottom = build && getComputedStyle(build).position === 'fixed' ? build.getBoundingClientRect().top - 6 : window.innerHeight - 12;
  const dy = r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - top) : r.top < top ? r.top - top : 0;
  if (dy) window.scrollBy({ top: dy, behavior: 'instant' });
}, sel);
/** Tap an element in the page flow. On phones the peeking build sheet is fixed over the bottom ~120 px (CSS :359), and
 *  a forced tap lands on whatever is on top, so on the short Safari viewport a Layers checkbox scrolled just into view
 *  sat under the sheet and the tap opened the sheet instead. Centre the element first, then tap it. */
async function pressFree(t, f, sel) {
  await reveal(f, sel, 'center');
  await press(t, f.locator(sel));
}
/** Bring the map into view: on phones under the sticky tool bar (as the app does when a step is picked), elsewhere with the tool bar above it. */
const revealMap = (t, f) => phone(t) ? revealTop(f, '.mapbox') : revealTop(f, '.toolbar');

/** Open the guide in the hub viewer and wait until the map is drawn and (when data can arrive) Eli's rows are in. */
async function open(t) {
  const f = await t.openApp(APP, { wait: '#chips button' });
  await f.waitForSelector('#map .mk', { state: 'attached', timeout: 12000 }).catch(() => {});
  if (!t.loading) await f.evaluate(() => Promise.race([window.hub && hub.ready({ optional: true }), new Promise(r => setTimeout(r, 4000))])).catch(() => {});
  await t.sleep(250);                                   // the phone fit runs on a 0 ms timer after boot (:1147)
  return f;
}

/** Tap points on the map, given as fractions of the part of the map that is on screen (page coordinates). */
async function tapMap(t, f, pts) {
  const box = await f.locator('#map').boundingBox();   // Playwright gives frame elements in main-page coordinates
  const fr = await (await f.frameElement()).boundingBox();
  if (!box || !fr) return;
  const vh = t.dev.viewport.height, y0 = Math.max(box.y, fr.y), y1 = Math.min(box.y + box.height, vh, fr.y + fr.height);
  for (const [fx, fy] of pts) {
    const x = box.x + box.width * fx, y = y0 + (y1 - y0) * fy;
    if (t.touch) await t.page.touchscreen.tap(x, y); else await t.page.mouse.click(x, y);
    await t.sleep(220);
  }
  if (t.touch) await park(t);
}

/** Tap a section chip (zooms the map to it and switches the build card to that section, :1117-1122). */
async function chip(t, f, sec) {
  await press(t, f.locator(`#chips button[data-sec="${sec}"]`));
  await t.sleep(750);                                   // 360 ms tween + commit; on phones the page also scrolls the map up (smooth)
}

/** Open a side tab (Listings / Layers / Scale) and bring the side panel into view. */
async function sideTab(t, f, tab) {
  if (!wide(t)) await revealTop(f, 'aside.side');
  if (tab !== 'list') await press(t, f.locator(`.tabs button[data-tab="${tab}"]`));
  if (!wide(t)) await revealTop(f, 'aside.side');
  await t.sleep(150);
}
/** Turn on a Layers-tab checkbox the way a person does (side panel → Layers → tick), then go back to the map. */
async function layerToggle(t, f, id) {
  await sideTab(t, f, 'layers');
  await pressFree(t, f, '#' + id);
  await t.sleep(900);
  await revealMap(t, f);
}
/** Pick a basemap from the Terrain select (on phones an invisible select over the layers icon, CSS :335-337). */
async function basemap(t, f, value) {
  await f.locator('#bmap').selectOption(value);
  await f.waitForLoadState('load').catch(() => {});
  await t.sleep(900);
  await revealMap(t, f);
}

/** On phones the search box and View options sit behind More (:1044). */
async function more(t, f) { if (phone(t)) { await press(t, f.locator('#more-btn')); await t.sleep(200); } }
async function search(t, f, q) {
  await more(t, f);
  await press(t, f.locator('#q'));
  await f.locator('#q').fill(q);
  await t.sleep(350);
}

const ALL = ['empty', 'typical', 'overflow', 'loading', 'offline'];
const STATIC = 'Drawn from the page payload only (no person data), so empty/overflow look the same as typical; loading/offline change nothing on this view.';
// These views also print sizes in game metres from Eli's plot width (person 'plot' → scale.fac, updScale :1049): gameDim :973 on the
// cards, the measure label :875, the profile length :951. So empty (no plot: no in-game figures) and overflow (12500 m, x13.6:
// four- and five-digit figures) differ from typical (400 m, x0.44).
const SCALED = "Drawn from the page payload, except the in-game sizes, which use Eli's plot width (person 'plot'): typical 400 m (x0.44), overflow 12500 m (x13.6, four- and five-digit figures), empty none (the in-game figures disappear). Loading/offline: as empty/typical.";

export const screens = [
  {
    screen: 'map', profile: 'eli', states: ALL,
    note: 'Default view: header, section chips with per-section progress, tool bar, whole-park terrain map (phones: build sheet peeking). Loading = no progress yet (0/N everywhere).',
    async go(t) { await open(t); },
  },
  {
    screen: 'steps', profile: 'eli', states: ALL,
    note: 'Build steps for the boot section (Entrance & Plaza): the card under the map on iPad/desktop, the bottom sheet at half height on phones.',
    async go(t) {
      const f = await open(t);
      if (phone(t)) { await press(t, f.locator('#bh-handle')); await t.sleep(450); }
      else await reveal(f, '#build', wide(t) ? 'center' : 'end');
    },
  },
  {
    screen: 'steps-full', profile: 'eli', states: ['typical', 'overflow'], devices: ['iphone-pwa', 'iphone-safari'],
    note: 'Phones only: the build sheet at full height (step card + step list). Empty looks like steps-empty; loading/offline as in steps.',
    async go(t) {
      const f = await open(t);
      await press(t, f.locator('#bh-handle')); await t.sleep(400);
      await press(t, f.locator('#bh-handle')); await t.sleep(450);
    },
  },
  {
    screen: 'step-on-map', profile: 'eli', states: ['typical'],
    note: 'The build card\'s "Show on map" on the current step (Entrance & Plaza step 8, an estimated position): the map fits the step\'s target and rings it (go() :1087, fitTarget :1088). Phones: tapped in the half sheet; the app keeps the sheet at half and scrolls the map under the tool bar itself (fitBoxPhone :1143). iPad/desktop: the app zooms the map but does not scroll to it (mapIntoView is phone-only, :1140), so the capture scrolls up to the map. Empty/overflow only change which step is current; loading/offline change nothing here.',
    async go(t) {
      const f = await open(t);
      if (phone(t)) { await press(t, f.locator('#bh-handle')); await t.sleep(450); }
      else await reveal(f, '#build', wide(t) ? 'center' : 'end');
      await press(t, f.locator('#b-show'));
      await t.sleep(900);                               // 360 ms tween + commit; phones also smooth-scroll the map up
      if (!phone(t)) await revealMap(t, f);
    },
  },
  {
    screen: 'next-unfinished', profile: 'eli', states: ['typical', 'overflow'],
    note: '"Next unfinished" in the build card header (:1092, nextUnfinished :1090). Typical: step 9 of Entrance & Plaza. Overflow: Entrance & Plaza is complete, so it jumps to the only section with work left, Wildwood Grove step 24 (23/26 ticked). Phones: tapped in the peeking sheet, which stays at peek while the map fits the step. Empty: step 2 of Entrance & Plaza; loading/offline as typical/empty.',
    async go(t) {
      const f = await open(t);
      if (!phone(t)) await reveal(f, '#build', wide(t) ? 'center' : 'end');
      await press(t, f.locator('#b-nextun'));
      await t.sleep(900);
      if (!phone(t)) await reveal(f, '#build', wide(t) ? 'center' : 'end');
    },
  },
  {
    screen: 'section', profile: 'eli', states: ['typical', 'overflow'],
    note: 'Showstreet chip tapped: the map zooms to the section and the build card switches to its steps (typical 13/21, overflow 21/21). Empty = typical without ticks; loading/offline change only the counts, as in map/steps.',
    async go(t) {
      const f = await open(t);
      await chip(t, f, 'show');
      if (!phone(t)) await revealMap(t, f);             // phones: the app scrolls the map under the tool bar itself
    },
  },
  {
    screen: 'listing', profile: 'eli', states: ['typical'],
    note: 'Timber Canyon chip, then the Thunderhead (#28) marker tapped on the map: the listing card. ' + STATIC,
    async go(t) {
      const f = await open(t);
      await chip(t, f, 'timber');
      await press(t, f.locator('#map [data-pick="o:28"]'), { force: true });
      await f.waitForSelector('#pop.show', { timeout: 3000 }).catch(() => {});
      await revealCard(f, '#pop');
    },
  },
  {
    screen: 'coaster', profile: 'eli', states: ['empty', 'typical', 'overflow'],
    note: 'From the Thunderhead listing card, "Track & profile": the coaster card with the track and the ground profile. ' + SCALED,
    async go(t) {
      const f = await open(t);
      await chip(t, f, 'timber');
      await f.locator('#map [data-pick="o:28"]').evaluate(e => e.scrollIntoView({ block: 'center' })).catch(() => {});   // the sticky step bar (>= 700 px) covers the bottom of the viewport: bring the marker clear of it
      await press(t, f.locator('#map [data-pick="o:28"]'), { force: true });
      await f.waitForSelector('#pop.show #i-coast', { timeout: 3000 }).catch(() => {});
      await press(t, f.locator('#i-coast'));
      await f.waitForSelector('#pop.show #trk', { timeout: 3000 }).catch(() => {});
      await revealCard(f, '#pop');
    },
  },
  {
    screen: 'building', profile: 'eli', states: ['empty', 'typical', 'overflow'],
    note: 'Country Fair chip, then an unlisted 62 x 19 m building footprint (OSM building 13, clear of tracks and markers) tapped: the "Unlisted structure" card. ' + SCALED,
    async go(t) {
      const f = await open(t);
      await chip(t, f, 'fair');
      await press(t, f.locator('#map [data-pick="b:13"]'), { force: true });
      await f.waitForSelector('#pop.show', { timeout: 3000 }).catch(() => {});
      await revealCard(f, '#pop');
    },
  },
  {
    screen: 'listings', profile: 'eli', states: ['typical'],
    note: 'Side panel, Listings tab (the default): the 145 official listings by section with the rider-height filter. ' + STATIC,
    async go(t) { const f = await open(t); await sideTab(t, f, 'list'); },
  },
  {
    screen: 'layers', profile: 'eli', states: ['typical'],
    note: 'Side panel, Layers tab: map layer toggles, terrain options, "About the data". ' + STATIC,
    async go(t) { const f = await open(t); await sideTab(t, f, 'layers'); },
  },
  {
    screen: 'about', profile: 'eli', states: ['typical'],
    note: 'Layers tab with the "About the data" disclosure opened (a native <details>, :665): the sources and caveats notes, scrolled to. ' + STATIC,
    async go(t) {
      const f = await open(t);
      await sideTab(t, f, 'layers');
      await pressFree(t, f, '#about summary');
      await t.sleep(200);
      await revealTop(f, '#about');
    },
  },
  {
    screen: 'listings-height', profile: 'eli', states: ['typical'],
    note: 'Listings tab with the rider-height filter set to "up to 36"" (#hf, :1012; the list re-renders on change): what a parent checks for a small rider. ' + STATIC,
    async go(t) {
      const f = await open(t);
      await sideTab(t, f, 'list');
      await f.locator('#hf').selectOption('36');
      await t.sleep(250);
      if (!wide(t)) await revealTop(f, 'aside.side');
    },
  },
  {
    screen: 'scale', profile: 'eli', states: ['empty', 'typical', 'overflow'],
    note: "Side panel, Scale tab: Eli's Planet Coaster plot width (person 'plot'; empty unset, typical 400 m, overflow 12500 m). Loading/offline: the same field, filled or not.",
    async go(t) { const f = await open(t); await sideTab(t, f, 'scale'); },
  },
  {
    screen: 'search', profile: 'eli', states: ['typical'],
    note: 'Tool-bar search "mountain" (phones: behind More). The Listings tab filters as you type; below 1180 px it sits far under the map, so the capture scrolls to it. ' + STATIC,
    async go(t) {
      const f = await open(t);
      await search(t, f, 'mountain');
      if (!wide(t)) await revealTop(f, 'aside.side');
    },
  },
  {
    screen: 'search-none', profile: 'eli', states: ['typical'],
    note: 'Search with no match ("waterpark"). Phones: scrolled to the side panel (query still in the sticky bar); iPad: what the person sees after typing — the only feedback, "0 of 145", is far below. ' + STATIC,
    async go(t) {
      const f = await open(t);
      await search(t, f, 'waterpark');
      if (phone(t)) await revealTop(f, 'aside.side');
      else if (!wide(t)) await revealMap(t, f);
    },
  },
  {
    screen: 'cross-section', profile: 'eli', states: ['typical', 'overflow'],
    note: 'Cross-section tool on, a cut tapped across the map, then the profile panel (scrolled to; on phones centred above the peeking sheet). The only person data is the in-game length in the stats row. ' + SCALED,
    async go(t) {
      const f = await open(t);
      await revealMap(t, f);
      await press(t, f.locator('#t-sec'));
      await tapMap(t, f, [[0.25, 0.6], [0.75, 0.45]]);
      await t.sleep(250);
      await reveal(f, '.profwrap', phone(t) ? 'center' : 'end');
    },
  },
  {
    screen: 'cross-section-compare', profile: 'eli', states: ['typical'],
    note: 'Compare mode of the profile (:944, :954): Compare tapped on the boot profile (Whole park, west to east), which stays as a grey ghost and the button turns into "Clear ghost"; then the same cut as cross-section, drawn over the ghost, with the "ghost" stat in the stats row. Only typical: the plot-width states are shown on cross-section. ' + SCALED,
    async go(t) {
      const f = await open(t);
      await reveal(f, '.profwrap', 'center');
      await press(t, f.locator('#p-cmp'));
      await revealMap(t, f);
      await press(t, f.locator('#t-sec'));
      await tapMap(t, f, [[0.25, 0.6], [0.75, 0.45]]);
      await t.sleep(250);
      await reveal(f, '.profwrap', phone(t) ? 'center' : 'end');
    },
  },
  {
    screen: 'cross-section-cut', profile: 'eli', states: ['typical'],
    note: 'The same cut as cross-section, left where the person is when they finish it: the map with the cut line drawn. Below 1180 px the profile it produced is out of sight, under the legend and the build card (phones: under the sheet). ' + STATIC,
    async go(t) {
      const f = await open(t);
      await revealMap(t, f);
      await press(t, f.locator('#t-sec'));
      await tapMap(t, f, [[0.25, 0.6], [0.75, 0.45]]);
      await t.sleep(250);
    },
  },
  {
    screen: 'measure', profile: 'eli', states: ['typical', 'overflow'],
    note: 'Measure tool on, two points tapped: the distance line and its label on the map (the label adds the in-game distance). ' + SCALED,
    async go(t) {
      const f = await open(t);
      await revealMap(t, f);
      await press(t, f.locator('#t-mea'));
      await tapMap(t, f, [[0.3, 0.3], [0.7, 0.6]]);
    },
  },
  {
    screen: 'view-3d', profile: 'eli', states: ['typical'],
    note: '3D terrain (three.js r128 WebGL, built after the tap paints; WebGL works in Playwright WebKit here). ' + STATIC,
    async go(t) {
      const f = await open(t);
      await press(t, f.locator('#m-3d'));
      await f.waitForSelector('#view3d canvas, #view3d p', { timeout: 9000 }).catch(() => {});
      await t.sleep(1500);
      await revealMap(t, f);
      await t.sleep(300);
    },
  },
  {
    screen: 'illustrated', profile: 'eli', states: ['typical'],
    note: 'Basemap "Park map (illustrated)": the official park sheet warped into the frame. ' + STATIC,
    async go(t) { const f = await open(t); await basemap(t, f, 'official'); },
  },
  {
    screen: 'aerial', profile: 'eli', states: ['typical'],
    note: 'Basemap "Aerial photo" (1.6 MB, not precached). ' + STATIC,
    async go(t) { const f = await open(t); await basemap(t, f, 'aerial'); },
  },
  {
    screen: 'aerial-mix', profile: 'eli', states: ['typical'],
    note: 'Basemap "Aerial + shading" (#bmap value mix, :596): the aerial photo blended with the terrain shading. ' + STATIC,
    async go(t) { const f = await open(t); await basemap(t, f, 'mix'); },
  },
  {
    screen: 'steepness', profile: 'eli', states: ['typical'],
    note: 'Layers → Steepness on: orange >= 25 %, red >= 40 % grade over the terrain (the View menu has the same switch). ' + STATIC,
    async go(t) { const f = await open(t); await layerToggle(t, f, 'l-slope'); },
  },
  {
    screen: 'upright', profile: 'eli', states: ['typical'],
    note: "Layers → Upright, then Fit: the whole park turned to the printed park map's orientation (the toggle itself zooms to Entrance & Plaza, :1029). " + STATIC,
    async go(t) { const f = await open(t); await layerToggle(t, f, 'l-upright'); await press(t, f.locator('#z-fit')); await t.sleep(700); },
  },
  {
    screen: 'view-menu', profile: 'eli', states: ['typical'],
    note: 'The View ▾ menu (contour interval, steepness); on phones the More disclosure, which also holds the search box. ' + STATIC,
    async go(t) {
      const f = await open(t);
      if (phone(t)) await more(t, f);
      else { await revealMap(t, f); await press(t, f.locator('#view-btn')); }
      await t.sleep(200);
    },
  },
  {
    screen: 'help', profile: 'eli', states: ['typical'],
    note: 'The "?" keyboard-shortcuts popover under the map (offered on touch devices too). ' + STATIC,
    async go(t) {
      const f = await open(t);
      await reveal(f, '.under', phone(t) ? 'center' : 'end');
      await press(t, f.locator('#help-btn'));
      await t.sleep(250);
    },
  },
  {
    screen: 'progress-menu', profile: 'eli', states: ['typical'],
    note: 'The build card\'s "…" menu: Export / Import / Reset progress. Phones: tapped in the peeking sheet; the menu opens upward (CSS :371) inside the fixed sheet, whose overflow:hidden (:359) clips it to a sliver — at half height too — so what shows is what a phone user gets. Reset uses confirm() and a bad import alert(): native dialogs the rig cannot capture.',
    async go(t) {
      const f = await open(t);
      if (!phone(t)) await reveal(f, '#build', wide(t) ? 'center' : 'end');
      await press(t, f.locator('#b-menu'));
      await t.sleep(250);
    },
  },
];
