# Batches 9 + 10 (Dollywood build guide + park map): brief for the workers

## Setup: READ CAREFULLY

### Where to work
- **Hub repo:** `/home/user/house-hub`, branch `audit-wip-pxwuhn` (batches 0a-7 done; 8 lands soon, see below). The orchestrator writes the base commit to `SCRATCH/b910-base.txt`; call it BASE below.
- **Batch 8 is NOT merged into `/home/user/house-hub` yet** (it is being finished in `/home/user/hh-b8`). The orchestrator merges it into the hub checkout soon; it changes `CLAUDE.md`, `index.html`, `apps/hub.js`, `sw.js`, `worker/README.md`, `worker/src/policy.js`, `worker/src/reminders.js`, `worker/src/chat.js`, `scripts/smoke-api.sh`, `scripts/test-home.mjs`, `scripts/test-push2.mjs`, `scripts/test-kitchen.mjs`, `icons/`. **Until the file `SCRATCH/b8-landed` exists, nobody edits any of those hub files** (the merge would fail on them). Template-repo work, `apps/dollywood*` exports, new files under `audits/tools/phase6/9|10/`, and `worker/src` files not in that list are fine meanwhile. Worker D: do the template, build-infrastructure and Worker-route work first.
- **Template repo:** `/home/user/dollywood-build-project`, branch `master` at `6192e96`. Its `build/*.html` are already modified in the working tree (a Linux rebuild); that is expected.
- **Never touch** `/home/user/hh-b8` (batch 8's worktree).
- **SCRATCH** = `/tmp/claude-0/-home-user-house-hub/cb8149f8-d9e8-5d60-902a-c782be42c8e1/scratchpad`.
- No commit, no push, no deploy, in either repo. The orchestrator commits both.

### Environment (every shell that runs a script)
```
export HUB_AUDIT_HOME=$HOME/house-hub-audit NODE_PATH=$HOME/house-hub-audit/node_modules HUB_CHROME=/opt/pw-browsers/chromium
```
- The cloud rig runs Chromium in place of WebKit. Say "Chromium" in your report wherever a Phase 3 script says WebKit.
- The local pairing code is in `SCRATCH/localcode`. Pass it only as an argument; never print it.

### The one template, and how it ships
- `scripts/template.html` (1,899 lines) builds three flavours in `scripts/build_html.py`: `reference` (the desk tool; keeps its own look), `hub` (the build guide, `apps/dollywood.html`) and `live` (the park map, `apps/dollywood-live.html`).
- **Never edit `apps/dollywood.html`, `apps/dollywood-live.html` or `apps/dollywood/*` by hand.** An export overwrites them.
- The loop, from the template repo, under the build lock (below):
  ```
  cd /home/user/dollywood-build-project/scripts
  python3 build_html.py && python3 verify.py && python3 export_hub.py /home/user/house-hub
  ```
  `verify.py` must end with `step checks: all sections OK` and exit 0. Read its output, not only the exit code.
- **The build lock** `SCRATCH/b910-build.lock`: take it with `until mkdir SCRATCH/b910-build.lock 2>/dev/null; do sleep 5; done` before `build_html.py`, and `rmdir` it after `export_hub.py`. Builds write the shared `build/` and `apps/dollywood*.html`.
- **The template must build at every moment.** Each Edit is one complete change; never leave a half-written function between two Edits. A broken build blocks all four workers.
- `build_html.py` asserts these anchors exist exactly once. Do not break them; if your change must move one, change `build_html.py` in the same step:
  - `function init3D(){` and `three={resize,build,key,retexture,homeCam}}`;
  - `function setMode(m){` followed by `if($('m-2d')){`;
  - the three `STRIP3D` markup fragments (the 2D/3D button group, `<div id="view3d"></div>`, the `#exag` div);
  - the reference theme toggle block (`if(FLAVOR==='reference'){$('theme').onclick=` … `}else{const t=$('theme-row');if(t)t.remove()}`);
  - `CONSTS`, `<!--HUBBOOT-->` … `<!--/HUBBOOT-->`, `__DATA__`, `__HUBJS__`, `__GRASS__`.
- **Every inline `<script>` is hashed** into the hub flavours' CSP by `add_csp()`. Never add an inline event handler (`onclick="…"`) or a `javascript:` URL; they will not run.
- **No new network hosts.** The CSP's `connect-src`/`img-src` stay as they are. External links (dollywood.com, web search) are navigations, which is fine.

### Read first
- **`CLAUDE.md`** (hub), the parts that apply:
  - the two Dollywood bullets ("generated files", "Build guide");
  - Who may write what (`worker/src/policy.js`: `dollywood-live` family rows);
  - Push ("Meet at <name>", the park switch) and Push reminders (`jobsAt`, the minute trigger);
  - the shell (Home cards, `home-art-5`);
  - "Adding an app" rules 1 and 6 (self-contained, 44 px, hover behind `(hover: hover) and (pointer: fine)`, safe areas);
  - design.css, Liquid glass (glass only on chrome; content cards solid), the segmented control, the sprite, `hub.toast`, `hub.confirm`.
- **The template's own `README.md`**: the park-map, GPS and wait-time sections, and "Interaction is composited": **nothing in the map SVG may carry an `opacity` attribute or property** (use `fill-opacity` / `stroke-opacity`).
- **`audits/05-decisions.md`**: D12 (park-map colours are a documented cartography exemption) and "Features kept or cut".

## The batch
- **Entries:** `audits/handoff-cloud/scratch/b910.md`: 48 for batch 9, 42 for batch 10, plus IMP-DOLLYWOOD-I1.
- **Carry-overs:** `SCRATCH/b910-carry.md`: 20 ids plus 2 unfiled findings. They are assigned below like entries.
- **Phase 3 reports:** `audits/03-apps/dollywood.md`, `audits/03-apps/dollywood-live.md`. Each entry cites its line.
- **The Worker routes** (`worker/src/index.js`, about :95-180): `GET /api/dollywood/waits` and `POST`/`DELETE /api/dollywood/rally`. They stay as they are; the batch adds no route.
- **Template line numbers below are at `6192e96`.** They drift as you edit: find code by the banner comments (`/* ==== … ==== */`, `/* ---- … ---- */`), never by a number.

## Decisions (do not re-open)

### Shared rules for every worker
- **Colour.** In the hub and live flavours, every chrome colour is a design.css token.
  - Map data colours (category colours, terrain, marker fills, coaster hues, amenity fills) are cartography under D12 and may stay hex. Gather the JS ones into one `MAPCOL` object (A creates it in the helpers region; others add their own keys there).
  - `scripts/screens-apps.mjs` requires the line starting `[data-flavor=hub],[data-flavor=live]{` to have no hex. Never put a hex on that line.
  - Never `prefers-color-scheme`. Theme selectors use `[data-scheme=…]`.
  - The reference flavour keeps its own look. Put new hub-only CSS under `[data-flavor=hub]` / `[data-flavor=live]`. Behaviour (bug) fixes apply to all flavours.
- **Icons (CONS-ICON-1, VIS-ICON-1).**
  - Hub UI icons are the shared sprite: `<svg class="sym" aria-hidden="true"><use href="../icons/sprite.svg#i-NAME"/></svg>` beside a visible word, or with an `aria-label` on the button. Map amenity pins use `<use>` inside their `<g>` too. Lucide geometry, one weight `--icon-stroke`, sizes `--icon-*`.
  - A writes one helper `ic(name)` that returns that markup (helpers region), plus the template CSS for `svg.sym` (the page has no `.ds`). Everyone uses it.
  - Missing symbols are drawn into `icons/sprite.svg` in Lucide's style. Each worker lists the names it needs in `SCRATCH/b910-hooks.md`; **D adds them all** to the sprite and to `icons/LICENSE-lucide.txt`.
  - One drawing per meaning (Table ICON-6 in `audits/04-design-system.md`):
    - the map tools: `move`, `chart-spline`, `ruler`, `scan`, `layers`, `map`, `locate-fixed`, `navigation-2`, `compass`;
    - the amenities: AED `heart-pulse` (never `heart`), first aid `cross`, restroom `toilet`, nursing `baby`, water `droplet`, lost and found `circle-help`, strollers `shopping-cart`, ATM `banknote`;
    - closed `ban`, close `x`, zoom `minus`/`plus`, meeting point `flag`, warning `triangle-alert`, external `external-link`, done `check`, menus `ellipsis` and `chevron-down`, help `circle-help`.
  - People's faces are the only allowed emoji. Running-text `…` and `±` stay.
- **Targets.** Every control is at least `var(--tap)` (44 px; 64 for a kid) on every size. Primary actions use `--btn-h-lg`.
- **Motion.** Durations and easings are `--dur-*` / `--ease-*` / `--spring-*`. Ambient loops stop after `--ambient-iterations` (3; 0 under Reduce Motion).
- **The region rule for the shared carry-overs** (CONS-TOK-1, -2, -3, CONS-TYPE-2, GAP-TOK-4, CONS-SHAPE-3, VIS-SHAPE-1, GAP-TOK-7, VIS-ICON-1, CONS-ICON-1). Each worker applies them to the lines it owns:
  - local aliases (`--panel`, `--panel2`, `--panel3`, `--dim`, `--ink`, `--ochre`, `--moss`, `--forest`, `--clay`, `--cream`, `--sky`) become role tokens (`--surface`, `--surface-2`, `--text-2`/`--text-3`, `--bg`, the `-ink`/`-graphic` roles);
  - `color-mix()` becomes role tokens (`--material-solid-bg`, `--glass-*`, `--tint-*`, `--sel-*`);
  - `max(var(--fs-floor,0px),calc(Npx * var(--ts,1)))` becomes the nearest Dynamic Type role (`--fs-body`, `--fs-subheadline`, `--fs-footnote`, `--fs-caption1`, `--fs-caption2`, …);
  - spacing becomes `--sp-*` on the 4 px grid, radii `--r-*` (concentric: a child takes `--r-inset` of its parent), and z-index `--z-*`;
  - chrome glyphs become `ic()` icons.

  **A owns the measurement and the status wording** for these ids, and removes the alias definitions (template :225-228) last, once the others report their regions clean. Record exceptions that have no token (`--peek-h`, pin sizes, the compass) in a comment.

### Who owns which lines of `template.html` (at 6192e96)
| Lines | What | Owner |
|---|---|---|
| 1-18 | head, pre-paint bootstrap | nobody (byte-identical) |
| 19-440 | base CSS, build-guide CSS, hub-flavour CSS, the hub phone block (`@media(max-width:699px)`) | A |
| 441-635 | live CSS | C, except rules whose selector starts `.lv-meet`, `.wtile`, `.lv-wait`, `.wt`, `.lv-src`, `.lv-stamp` (D). D adds new rules in a block it creates just before :636, `/* ---- live: waits and the meeting point (batch 10) ---- */` |
| 636-643 | confirm-sheet CSS, the "not live: hide" rule | A |
| 644-689 | header, chips, toolbar, map box, readout, maphint, mini, pop | A, except the 2D/3D group (:665), `#view3d` (:683) and `#exag` (:689): B |
| 690-715 | live markup (`lv-*`) | C, except `#lv-meet` (:699): D |
| 716-735 | `.under` (legend, help), `#build` (:721-728), `.profwrap` | A, except `#build`: B |
| 737-747, 758 | side tabs, Layers tab, footer | A |
| 748-755 | Scale tab | B |
| 762-1101 | helpers, `ask`/`tell`, 2D layers, view/zoom/pan/keys/`fitBox`, rotation, minimap, measure, highlight, cross-section, popup | A, except the one line in `pick()` with `elm.dataset.pick.split(':')`: C |
| 1102-1129 | listings, search, Layers tab (including the **Upright** handler) | B |
| 1130-1144 | theme, View menu, More, "?" popover | A |
| 1145-1427 | Scale tab, build steps, the hub migration IIFE, sections/chips, phone sheet, coaster legend, 3D | B |
| 1428-1769 | live tracker, drawing, state, pill, directions, controls, `liveInit` | C |
| 1770-1816 | wait times | D |
| 1817-1859 | who can ride / heights, next ride, amenities | C |
| 1860-1876 | meet here, rally | D |
| 1877-1891 | family layer | C |
| 1892-1895 | boot | A |

- **Other files in the template repo:**
  - `build_html.py`: D. B may edit only the `STRIP3D` list.
  - `verify.py`: each worker edits only the checks for its own region, as small Edits.
  - `README.md`: D, from the others' notes.
- **Shared edits.** Make small Edits with unique anchors, and re-read the lines just before each Edit (other workers are editing the same file).
- **Hooks.** Agree hooks (function names, row shapes, ids, data attributes) in `SCRATCH/b910-hooks.md`. Seed it with: `ic()`, `MAPCOL`, `clampPop()`, `secView`, the `summary` row, the `push_pref:arrive` row, `parkOn()`, and `WAITS.hist`.

### Batch 9: the build guide

#### The step card and progress
- **One tap to tick (UX-DOLLYWOOD-1, CONS-SHAPE-4).**
  - On iPad and desktop (≥ 700 px), a sticky bar is pinned to the viewport bottom (safe area) while the step card's own controls are off screen. It is glass, because it floats.
  - Its contents: "Step 7 of 9 · <title>", Previous, **Mark done** (the primary: a capsule at `--btn-h-lg`, the person's strong tone) and Next.
  - In the card itself, Mark done is the same capsule.
  - The guide opens at the step `summary.next` points to (see below), without scrolling.
- **The `summary` row** (B writes it; D's Home card reads it).
  - It is a person row in `dollywood`: `summary = {next:{id,title,sec,secName,i,n}, secDone, secTotal, done, total, at}`.
  - B writes it after any change of ticks, debounced 2 s, only when it differs.
- **The Home card (D, in `index.html`).**
  - For an adult or a guest who can see the app, once `summary` exists. Never on a kid's Home, the TV or the kitchen.
  - Orchid, with `art/app/dollywood.svg`, in the `.gfoot` pattern.
  - Words: heading "Build guide"; "Next: Blueprint the section"; "Entrance & Plaza · 7 of 9 done"; button "Continue".
  - When everything is ticked: "All 242 steps built" and "Open the guide".
  - Patched in place. The shell syncs `dollywood` person scope.
- **The feed (UX-DOLLYWOOD-11).**
  - A tick no longer posts a line at once. 60 s after the last tick or untick (and on `hub.onLeave`), post the net change since the last post, one line per section:
    - one step: "Built Blueprint the section (Entrance & Plaza)";
    - several: "Built 3 steps in Entrance & Plaza".
  - A step ticked and unticked inside the window posts nothing. Never post unticks.
- **Section complete (IMP-DOLLYWOOD-I1).**
  - When a tick completes a section: `hub.toast("Showstreet done — 21 steps")`, and the chip's bar shows a calm check that settles once (no confetti; nothing under Reduce Motion).
  - Only on the transition, never on load. No extra feed line.
- **The plot width.**
  - (P3-DOLLYWOOD-07) `updScale()` re-renders the step card when the factor changes: after load, an edit and a synced change.
  - (P3-DOLLYWOOD-18) `adopt()` applies a null `plot` (clears the field, factor "—"). Signed in, the boot never reads `localStorage dw-plot`. After a successful migrate, `dw-plot` is removed.
  - (UX-DOLLYWOOD-12) Valid is empty, or 50-2,000 m. Otherwise show "Enter a width from 50 to 2,000 m." under the field (`role="alert"`, `aria-invalid`); nothing is saved and nothing is converted.
  - (P3-DOLLYWOOD-15) The Scale copy reads: "Enter the width you can give it in the game, and every measurement on the step card and the listing cards is also shown in game metres."
- **Read-only (UX-DOLLYWOOD-14).** When `!hub.canWrite`: no Mark done, Reset or Import, and the plot field is read-only. Previous, Next and Show on map stay.
- **The loading jump (CONS-MOTION-4).** The step card and the tab body keep their loaded height from the first paint, with a sized skeleton, while `HUBWAIT`. Target: MOTION/cls landmark moves 37 → 0 / 945 → 0 px (iPad portrait) and 4 → 0 (iPhone), at 150 ms.
- **The park map stops running the guide's migration (UNFILED-2).** The hub IIFE (about :1231-1254) runs only when `FLAVOR==='hub'`. Measure: 0 `step:` rows in `dollywood-live`.

#### The phone sheet and the menus
- **The … menu (P3-DOLLYWOOD-03).**
  - Below 700 px it opens as a bottom action sheet over the build sheet: "Export progress", "Import progress", "Reset progress" (danger ink) and "Cancel", each row ≥ 52 px.
  - The backdrop and Escape close it. Focus goes to the first row, and back to … on close.
  - From 700 px it stays a popover, clamped by `clampPop()`.
- **Next unfinished (UX-DOLLYWOOD-7).** On a phone it raises the sheet to half, so the new step shows.
- **The map comes into view (UX-DOLLYWOOD-2).** `mapIntoView` runs at every size for Next, Previous, Show on map and a list tap. It does nothing when ≥ 60 % of the map box is already in view. Smooth scrolling, but instant under Reduce Motion.
- **The phone fit and Upright (P3-DOLLYWOOD-05).** `fitBoxPhone` rotates the target's corners by `ROT` when Upright is on, as `fitBox` does.
- **Upright, both flavours (P3-DOLLYWOOD-11, P3-DOLLYWOOD-LIVE-09).**
  - Turning Upright on or off never fits a section.
  - With the Whole park chip pressed (a `secView` variable that `selectSection` sets, `'all'` or an id), it fits the whole park.
  - Otherwise it rotates the current view in place, keeping its centre and scale.
  - The park map's compass calls the same handler, so the compass never jumps to the Entrance.
- **The height filter (P3-DOLLYWOOD-06, P3-DOLLYWOOD-LIVE-14).** "Up to N″" keeps `!o.height_in || o.height_in <= N`, in both exports. The option words are unchanged.
- **Search (UX-DOLLYWOOD-4).** This is for the hub and reference flavours; the park map's search stays in its sheet.
  - Typing shows a list right under the search field: up to 8 matches, each a 44 px row (number badge, name, area).
  - The last row is "Show all N in Listings", which selects the Listings tab and scrolls to it.
  - With no match: "No match for “zipline”".
  - Arrow keys move through the rows, Enter opens one, and Escape or blur closes the list. A single match still flies to it and opens its card.

#### 3D
- **The way out (P3-DOLLYWOOD-04).** The 3D button toggles (`aria-pressed`). While in 3D, a glass capsule "Back to map" (`ic('map')`, 44 px) sits at the 3D view's top left, at every size. Update `STRIP3D` in `build_html.py` with any markup change.
- **The render loop (P3-DOLLYWOOD-09).** Leaving 3D cancels the render loop (`cancelAnimationFrame`); entering starts it.
- **The step in 3D (GAP-DOLLYWOOD-1).**
  - In 3D the current step's target is drawn on the terrain: its outline as a line loop 3 m above the ground, in the person's accent graphic colour, plus a translucent 6 m curtain.
  - The camera frames it on entering 3D.
  - In 3D, Previous, Next and Mark done stay in 3D and move the outline and the camera. Show on map still goes to 2D.
- **The hint.**
  - (P3-DOLLYWOOD-14) `setMode('2d')` writes the same hint as boot (one `hintText()`): on a coarse pointer, "Tap anything for details · pinch to zoom".
  - (VIS-DOLLYWOOD-11) In 3D on a coarse pointer: "Drag to turn · pinch to zoom". No keys, and it wraps instead of scrolling. A fine pointer keeps the keys.
- **The phone camera (VIS-DOLLYWOOD-16).** The phone home camera frames the terrain in the part of the view above the sheet's peek, with sky at most 15 % of the view.

#### The shared map and look (A)
- **Keys.**
  - (P3-DOLLYWOOD-16) The shortcut handler ignores any event with Ctrl, Cmd or Alt held, and any while a sheet, menu or popover is open.
  - (P3-DOLLYWOOD-17) The arrow keys pan only when the map has focus, or when focus is on the page body and ≥ 50 % of the map box is in view. Otherwise the page scrolls. The map box gets `tabindex="0"`.
- **Done steps (VIS-DOLLYWOOD-1).** `ic('check')` in `--success-ink`, the title in `--text-2` at full opacity, no strike-through. Contrast ≥ 4.5:1 in every palette.
- **Targets (VIS-DOLLYWOOD-2).** All 35 phone and 15 iPad controls go to `var(--tap)`: chips, tool and zoom buttons, legend items (a 44 px row; the swatch stays small), "?", the sheet handle (a 44 px hit area around its bar), Next unfinished, …, Compare, and the exaggeration slider (a 44 px tall hit area). Target 0 under 44 at 390 and 820.
- **Fonts (CONS-TYPE-6).** No generic family and no Fraunces or Archivo in the hub and live flavours. Use `--font-display`, `--font-ui` and `--font-numeral`, live `.tabbody h2` included.
- **The step highlight (P3-DOLLYWOOD-08).** `hlring` runs `var(--ambient-iterations)` times and rests at full stroke. It stays on `stroke-opacity`, because the README bans `opacity` in the SVG; a finite loop is the fix. It restarts on a new step.
- **The dead compass (P3-DOLLYWOOD-10).** `.lv-northwrap` joins the "not live: hide" rule (:643).
- **Popovers (P3-DOLLYWOOD-12, P3-DOLLYWOOD-13).** One `clampPop(el)` runs after any popover opens ("?", View ▾, …): it keeps it 8 px inside the viewport, at most `calc(100vw - 16px)` wide, and lets it wrap. Below 700 px the "?" popover is a full-width panel under the hint line.
- **The chip strip (P4-TELL-05).** `#chips` has `min-height: var(--min-h-chips)` from the first paint. Target: CLS < 0.05 through the hub's viewer.
- **Map labels (P4-TYPE-01, GAP-TYPE-3).**
  - Every map label is sized in screen pixels with an 11 px floor (`FLOOR()`, 16 for a kid): section names, listing numbers, contour heights.
  - A listing number or contour height that would sit under the floor is hidden (the marker stays a tappable dot).
  - `.onum` and `.clab` get `max(var(--fs-floor), …)`.
  - Target: code-scan under-11 2 → 0 per export; hidden-text 0 in both.
- **The phone's first screen (UX-DOLLYWOOD-3).**
  - Below 700 px the header is one line (the title only; the subtitle and stats move into Layers → About).
  - The chips are one scrollable row.
  - At 390×844 the map's top is at most 160 px from the top, and the boot fit frames the built park in the area above the peek.
  - Target: at least 40 of the 68 attraction markers visible and not under the sheet.
- **The cross-section (UX-DOLLYWOOD-8).** After the second point, the pill reads "Profile ready — tap two points for a new cut". The profile scrolls into view (`block: 'nearest'`; instant under Reduce Motion) when it is off screen.
- **Cards stay on screen (UX-DOLLYWOOD-9).**
  - From 700 px, `openPop` keeps the card inside the visible part of the viewport, 8 px in, with a `max-height` of that space. The body scrolls inside, and the head with ✕ stays sticky.
  - If that space is under 320 px tall, the card opens as the phone's bottom sheet.
- **The web search (UX-DOLLYWOOD-13).** An unlisted structure's search is prefilled `Dollywood <kind> <section>`, e.g. "Dollywood building Showstreet" (kind = its type, else "building").
- **The profile labels (VIS-DOLLYWOOD-4).** The axis labels are sized so they render at least `--fs-caption2` on screen, recomputed on resize.
- **Solid content (VIS-DOLLYWOOD-6, CONS-GLASS-2).**
  - The header, side panel, readout, `#exag`, `#cam-reset` and the map-surface controls are solid (`--material-solid-bg`).
  - Glass stays only on the toolbar (sticky on the phone), the sheets and the floating buttons.
  - Target: GLASS/layers guide contentLive 196 → 0.
- **Native controls (VIS-DOLLYWOOD-8, VIS-ICON-1, CONS-ICON-1).**
  - Selects: `appearance: none` with the `--select-chevron` mask.
  - Number fields: no spinners.
  - The search field: no native clear glyph; an ✕ button (`ic('x')`, 44 px) appears while it has text.
  - Checkboxes: drawn as the shared switch with `--switch-on`, `--switch-off`, `--switch-knob` and `--switch-off-ring`, 52×32 with a 44 px hit area. The inputs, ids and change events stay.
  - Glyph buttons become icons: ▾ `chevron-down`, … `ellipsis`, ? `circle-help`, × `x`, ↗ `external-link` ("Web ↗" becomes "Web" with the icon), −/+ `minus`/`plus`.
- **The green bands (VIS-DOLLYWOOD-9).**
  - Below 700 px the guide's map uses `preserveAspectRatio="xMidYMid slice"`, as the park map does. The fit math already reads the element's box.
  - The map box background is the basemap's edge colour (`__GRASS__` for illustrated), so Upright's corners never show a flat band.
- **The header on an iPad (VIS-DOLLYWOOD-10, UNFILED-1).**
  - From 1024 to 1279 px it is one row: art (96 px), the title block flexing, and the stats as a compact 2×2 grid on the right. At most 150 px tall at 1180×820.
  - The stats never wrap to their own row on iPad portrait (the 58 px case).
- **The duplicate title (CONS-TYPE-1).** Option A: in the hub flavour the `h1` is visually hidden and kept for screen readers (the viewer bar already names the app). Standalone keeps it.
- **The Layers legend (VIS-DOLLYWOOD-13).** The swatches get a `--field-border` ring (`box-shadow: inset 0 0 0 1.5px`). The inline `style="background:#…"` moves into `MAPCOL`.
- **The measure label (VIS-DOLLYWOOD-14).** A pill: `--map-halo` fill, `--map-ink` text, semibold, ≥ 11 px on screen, counter-scaled like the section labels.
- **Listing labels (VIS-DOLLYWOOD-15).** At section zoom they go through a greedy collision pass in screen pixels, like the park map's `drawNames`: attractions first, and a label that would overlap a marker or another label is dropped.
- **The desktop toolbar (VIS-DOLLYWOOD-17).** From 1280 px the Search group flexes (`1 1 220px`) on the first row. Its label keeps ≥ 6 px from the focus ring.
- **The side tabs (VIS-SHAPE-3, CONS-TOK-2).** Listings / Layers / Scale become `.segmented`. `role="tab"` and `aria-selected` stay; the selected item also gets class `on`. C gives the park map's Nearby / Waits switch the same recipe.
- **Labels and values (VIS-TYPE-2).** `dl.kv dt` and the profile stat labels read `--text-label`; `dd` and the values read `--text-value`. Weight and size carry the difference, not ink alone.
- **Hover (VIS-DOLLYWOOD-LIVE-6).** The seven `:hover` rules (:25, :65, :77, :100, :124, :134, :192) move inside `@media (hover: hover) and (pointer: fine)`.
- **Selectable chrome (CONS-TELL-1).** `-webkit-user-select: none; -webkit-touch-callout: none` on the template's labels and control text (`label.vx`, `label.tog`, the Scale labels; D adds the same to `.lv-src a`). Target: TELL text 2 → 0 (guide), 1 → 0 (park map). The iPad long-press itself is a device check.
- **The first frame (VIS-TELL-1, D).** `build_html.py` puts `<link rel="stylesheet" href="design.css">` in `<head>`, right after the HUBBOOT block, for both hub flavours. `hub.js` stays where it is. Gate: `TELL/flash.mjs` shows no dark frame in a light house.

### Batch 10: the park map

#### Location and sharing (C)
- **The first open (P3-DOLLYWOOD-LIVE-03).**
  - When the person channel lands (`hub.loaded()` for `'person'`, and `onChange` for `share`), re-check `shareOn()` and start GPS if it is on.
  - Until it lands, the pill and the Share row say "Loading…", never "not sharing".
- **The meeting bar (P3-DOLLYWOOD-LIVE-04).** `setMe()` and `livePlace()` call `renderMeet()`, so the walk time and Go appear with the first fix.
- **Kids' controls (P3-DOLLYWOOD-LIVE-05).** The kids' beacons and heights render whether or not anyone else is sharing.
- **At home (P3-DOLLYWOOD-LIVE-06).**
  - `publish()` sends a fix only when `onProperty()` (the frame, 300 m around it, or the property polygon).
  - D's half: Home's `atPark()`, chat's `where_is_family` and `parkJob`'s "fresh adult" ignore rows outside `parkOn(x,y)`, which is the frame box plus 300 m: `-300 ≤ x ≤ 1835`, `-300 ≤ y ≤ 2511`.
- **Old fixes outside the frame (P3-DOLLYWOOD-LIVE-07).** The arriving and far states honour `stale`: "Last seen 14 h ago", the place as the subtitle, and a Find me chip.
- **Amenity taps (P3-DOLLYWOOD-LIVE-08).** `pick()` splits on the first `:` only, so `a:<kind>:<x>:<y>` reaches `showAmen`. This is the one line of A's region C may edit.
- **The denied state.**
  - (P3-DOLLYWOOD-LIVE-17) A denial sets `gpsErr = 1` and calls `updLoc()`, so the designed denied state and its "Set my spot" chip show at once.
  - (P3-DOLLYWOOD-LIVE-10) On phones the denied pill wraps to two lines, and the chip stays visible.
  - (UX-DOLLYWOOD-LIVE-1) A kid sees `ic('map-pin-off')` and "Ask a grown-up to turn on location". An adult sees "Location is off for this site" and "Allow Location for the Hub in Settings › Safari, or use Set my spot".
- **Kids' beacons.**
  - (P3-DOLLYWOOD-LIVE-12) When `kidshare:<me>` turns false on a kid's open map, it stops the watch and removes `loc:<me>` (a tombstone; the policy already allows a kid's own).
  - (P3-DOLLYWOOD-LIVE-13) When `kidshare:<me>` turns true, the kid's open map starts locating and publishing at once.
  - (P3-DOLLYWOOD-LIVE-16) A kid never sees the Share switch. With the beacon on, the row reads "Your beacon is on — a grown-up can switch it off".
- **A view-only kid (UX-DOLLYWOOD-LIVE-2).** The Nearby empty state reads "A grown-up can show where you are." "Set my spot" is hidden when `VIEW_ONLY()`.

#### The look (C)
- **Family labels (VIS-DOLLYWOOD-LIVE-1).** Family name pills go through the same screen-pixel collision pass, placed before the ride labels. One that still overlaps shows initials (at most 2 letters); the full name stays on the card.
- **The compass (P4-ACCENT-06, P4-ICON-04, CONS-MOTION-1).**
  - Pressed, it keeps its neutral fill with a 2 px `--accent-graphic` ring.
  - The needle's north half is `var(--map-north)`, the "N" `--danger-ink` at ≥ 11 px bold.
  - The rotation moves to an inner element, so `:active` can scale the button (press 0.97 plus dim).
- **Pulses (P4-MOTION-03).**
  - `lvlive`, `fabring`, `me-pulse` and `me-pulse2` run `--ambient-iterations` times, on transform and opacity only.
  - The `box-shadow` rings become a pseudo-element ring scaled by transform.
  - The dot's pulse is added only when the last pulse was more than 60 s ago.
  - Target: park-live idle main thread under 5 %.
- **Targets (P4-SHAPE-03, VIS-DOLLYWOOD-LIVE-5).** All at `var(--tap)`: the handle (a 44 px hit area), About, the layer rows, heights, the directions-bar buttons, Set my spot, Done, the Nearby / Waits segment and the chips.
- **The ride card (UX-DOLLYWOOD-LIVE-4, VIS-DOLLYWOOD-LIVE-3).**
  - Track opens a family ride card: name, wait, height rule, ride type and year opened, and "Show the track" (highlights it on the map). No survey rows, no metres, no OSM note and no elevation chart.
  - An empty About is not drawn. Cards have a sticky head.
- **Kid mode (UX-DOLLYWOOD-LIVE-5).**
  - The pill shows the kid's face, one short line and a speaker button that reads it aloud (`speechSynthesis`).
  - Waits and Nearby rows: the wait tile, a category icon, and "too short" as a `ruler` icon on the danger fill with the kid's face. Tapping a row speaks "Thunderhead, 20 minutes".
  - No ride art, because there is none and the batch adds no imagery.
- **Heights (UX-DOLLYWOOD-LIVE-7).**
  - A number field (`inputmode="numeric"`, 28-72, "in" suffix) starts at the kid's last value and writes once on change, blur or Enter.
  - Out of range: "28 to 72 inches".
- **Cards on iPad portrait (VIS-DOLLYWOOD-LIVE-4).** From 700 to 1023 px, cards open as a bottom sheet whose top stays below the meeting bar and the search field.
- **The external link (VIS-DOLLYWOOD-LIVE-9).** "dollywood.com" is a button-styled row (44 px, `--r-control`, no underline) with `ic('external-link')`.
- **Wide screens (VIS-DOLLYWOOD-LIVE-10).** From 1024 px, the Waits rows and the meeting bar are at most `var(--col-narrow)` wide. The map box background is `__GRASS__`, so the art's edge blends.
- **Placing mode (VIS-DOLLYWOOD-LIVE-11).** The sheet is hidden entirely (transform plus `visibility`). The pill offers "Cancel".
- **Whole park (VIS-DOLLYWOOD-LIVE-13).** On iPhone it fits the park between the pill (and the meeting bar) and the sheet's peek. A full sheet is solid (`--material-solid-bg`) and the meeting bar is hidden behind it.
- **Glyphs (CONS-ICON-2).**
  - The pill states: idle/searching `locate`, placing `crosshair`, good `circle-dot`, weak `triangle-alert`, stale `history`, arriving `car`, far `plane`, denied `map-pin-off`.
  - The `AMEN` table uses the amenity icons above, with fills in `MAPCOL`. ♥ appears nowhere as an AED.
  - Target: park emoji 7 → 0.

#### Waits, the meeting point and alerts (D)
- **Rally (P2-PWA-18).**
  - The meeting bar gets a "Rally" button for household adults (`HOUSEHOLD()`). It asks first (`ask`): title "Rally the family to <name>?", body "The other grown-ups get “Meet at <name>” on their phones.", OK "Rally".
  - It posts `/api/dollywood/rally` with `MEET`'s name, x, y and note. It does not call `setMeet` (the Worker writes the row and its own feed line).
  - The meta line then reads:
    - "Rallied 3 · set by you just now";
    - 0 sent: "Nobody else has park alerts on — they will see the pin on the map.";
    - 429: "You rallied a minute ago — try again shortly.";
    - an error: "Couldn’t send the rally — they will see the pin on their next sync."
  - The button is disabled for 60 s after a success.
  - The ride card keeps "Meet here". Its confirm sheet now says "Then tap Rally on the meeting bar to buzz the other grown-ups."
- **Arrivals (GAP-DOLLYWOOD-LIVE-1, the small honest version).**
  - A Worker job on the minute trigger, `arriveJob`. It reads `dollywood-live` family `loc:` rows updated in the last 3 minutes and the `meet` row (under 2 h old).
  - When a household person's dot goes from outside to within 40 m of the meeting point (accuracy ≤ 60 m), it pushes the other household adults: "Mae reached the meeting point", body "<meeting point name> · open the park map", url `#dollywood-live`, kind `arrive`, tag `arrive-<meetAt>-<id>`.
  - Once per person per meeting point. Someone already within 40 m when the point is set is not announced. State lives in `settings.park_arrive`.
  - The switch is `push_pref:arrive` (on by default; household adults only, never guests, kids, the TV or the kitchen), in Me → Notifications as "Park day: someone reaches the meeting point".
  - The job can be forced with `POST /api/admin/cron/run {"job":"arrive"}`.
  - **The "left the park" half is DEFERRED:** a web page cannot read location in the background, so it would only fire with the map open on screen.
  - If `audits/tools/phase6/6/cron-check-6.mjs` asserts that the minute trigger runs only the timer, write a `-10` copy.
- **The meeting point.**
  - (P3-DOLLYWOOD-LIVE-18) `loadMeet()` runs on a 30 s timer (while visible) and on `visibilitychange`, so the age updates and the pin drops at 2 h.
  - (VIS-DOLLYWOOD-LIVE-2) The label is a haloed pill at most 180 px wide on screen with an ellipsis. It is placed on whichever side (right, left, above) has no family puck within 40 px.
- **Waits.**
  - (P3-DOLLYWOOD-LIVE-11) `WALIAS = {'Dollywood Express': 'Dollywood Express Train Depot'}`. Feed names that still match no listing are logged once with `console.info`.
  - (P3-DOLLYWOOD-LIVE-15) Waits older than 6 h are dropped everywhere (the chips, the hero, Nearby, Waits, the directions bar, cards) through one gate in `waitOf()`. The 60 s retry keeps running.
  - (UX-DOLLYWOOD-LIVE-6) One error line: "Can't reach wait times · last updated 2:41 pm · retrying every minute" (with no earlier success: "Can't reach wait times right now · retrying every minute").
  - (VIS-DOLLYWOOD-LIVE-8) The wait tiles use `--wait-short`, `--wait-medium`, `--wait-long` and `--wait-closed` fills with their `-ink`, and the MIN label is at `--fs-caption2`, ≥ 4.5:1. The map's chips are cartography and stay.
  - (GAP-DOLLYWOOD-LIVE-2) A trend from this device's own history: `WAITS.hist` in `localStorage dollywood.live.waithist`, one sample per ride at most every 5 min, 90 min kept (try/catch).
    - A rise or fall of ≥ 5 min against the sample at least 15 min old shows `ic('trending-up')` / `ic('trending-down')` beside the wait, with an aria-label like "Rising — 20 min half an hour ago".
    - The card's wait line adds "Rising · was 20 min at 2:10".
    - No Worker storage.
- **Offline (GAP-DOLLYWOOD-LIVE-4).** The Style pane says: "Offline, the illustrated map, your dot and the last waits still work. Satellite and live waits need signal."
- **Hours and shows (GAP-DOLLYWOOD-LIVE-3).** The Style pane gets a link row "Park hours, shows and dining · dollywood.com" (`ic('external-link')`; hidden for kids and the TV). **The data itself is DEFERRED** (no feed; it would need scraping a new host).
- **The illustrated raster (VIS-DOLLYWOOD-LIVE-12): DEFERRED.** The park map already uses the full 4000×5763 warp of the 2559×2094 official sheet; a larger export would only upscale, and no better source exists. Record it; build nothing.

### Kept for later, not this batch (say so in the report)
- "Left the park" alerts.
- Park hours, shows and dining data.
- A sharper illustrated map.
- Ride art for kid mode.
- The lint for sub-floor sizes and inline styles across the repo (GAP-TYPE-3, GAP-TOK-7 name it; no batch owns it).

## Hard rules (all workers)
- **Edit only what you own** in the table above.
  - Template repo: `scripts/template.html`, plus `build_html.py` / `verify.py` / `README.md` as assigned.
  - Hub repo: D owns `index.html`, `apps/hub.js` (only if a hook truly needs it), `worker/`, `icons/sprite.svg`, `icons/LICENSE-lucide.txt`, `sw.js`, `CLAUDE.md`, `worker/README.md`, `scripts/smoke-api.sh`, `scripts/test-home.mjs` and `scripts/test-push2.mjs`. The Dollywood tests are shared, by section.
- **design.css:** `apps/design.css` lines 11-765 stay byte-identical to `git show BASE:apps/design.css | sed -n 11,765p`. Prefer not touching design.css at all.
- **Never touch:** the pre-paint bootstraps, `handoff/`, the other apps' html files, `apps/dollywood*.html` by hand.
- **Process.**
  - No build step in the hub, no `package.json`, no downloads. Keep line endings.
  - The Worker has no npm dependencies.
  - Never write or print a secret, PIN, code or token.
  - No commit, push or deploy. Do NOT run `SCRATCH/repo-tests.sh` or `SCRATCH/final.sh`.
  - Never kill another agent's process, and never kill by name; stop only the PIDs you started.
- **Data rules.**
  - New keys follow hub.js's rules (`[A-Za-z0-9_.:-/]`, ≤ 200): `dollywood` person `summary`, hub person `push_pref:arrive`.
  - Device-only state lives in `localStorage` with try/catch.
  - Server rules stay: the policy's `dollywood-live` family rules are unchanged; D checks that `push_pref:arrive` passes.
- **Ids and test hooks** (`#loc-btn`, `#lv-meet`, `#b-done`, `#q`, `#chips`, `#lv-north` …) stay; add new ones.
  - When visible words change, update the tests that match them: `scripts/test-dollywood.mjs`, `test-dollywood-sync.mjs`, `test-dollywood-themes.mjs`, `verify.py`, and grep the Phase 3 scripts.
- **Stale scripts.** If a Phase 2/3/4 script fails only because its UI or data contract changed on purpose, copy it to `audits/tools/phase6/9/<name>-9.mjs` (guide) or `audits/tools/phase6/10/<name>-10.mjs` (park map). Add a header saying what changed and why, and report both runs.
- **The lock.** `SCRATCH/suite.lock` is a directory lock, machine-wide, for anything that serves the repo on `localhost:8765` or another fixed port (repo suites, `capture.mjs`, the audit rig scripts).
  - Take it with `until mkdir SCRATCH/suite.lock 2>/dev/null; do sleep 10; done` and release it with `rmdir`.
  - Wait in a sleep loop inside your turn, with no limit. Never remove another's lock.
  - Do not hand back while waiting. If you truly must stop, say exactly what remains.

## Worker A: the shared map and look (Sonnet)
- **Entries (27):**
  - batch 9: P3-DOLLYWOOD-08, -10, -12, -13, -16, -17, P4-TELL-05, P4-TYPE-01, UX-DOLLYWOOD-3, -8, -9, -13, VIS-DOLLYWOOD-1, -2, -4, -6, -8, -9, -10, -13, -14, -15, -17, VIS-SHAPE-3, VIS-TYPE-2, CONS-TYPE-6;
  - batch 10: VIS-DOLLYWOOD-LIVE-6.
- **Carry-overs:**
  - guide only: CONS-GLASS-2, CONS-TYPE-1, UNFILED-1;
  - "both": the look parts, with the measurement and the status wording: CONS-ICON-1, VIS-ICON-1, CONS-TOK-1, CONS-TOK-2, CONS-TOK-3, CONS-TYPE-2, GAP-TOK-4, CONS-SHAPE-3, GAP-TYPE-3, VIS-SHAPE-1, GAP-TOK-7, CONS-TELL-1.
  - B, C and D apply the region rule in their own lines and report their region clean in the hooks file.
- **Provides first** (post in hooks before anything else): `ic()`, the `svg.sym` CSS, `MAPCOL`, `clampPop()`.
- **Check:** write `audits/tools/phase6/9/look-a-9.mjs` (audit rig, Chromium; both flavours). It measures:
  - targets under 44 = 0 at 390 and 820;
  - no rendered map text under 11 px at the default fit on the iPhone and the iPad;
  - done-step contrast ≥ 4.5 in all six palettes;
  - popovers inside the viewport (390, 820);
  - the chip-strip CLS < 0.05 in the viewer;
  - the phone first screen (map top ≤ 160, ≥ 40 markers visible);
  - cards inside the viewport (iPad portrait, desktop);
  - Ctrl+D, Cmd+P and Alt with arrows write 0 rows;
  - arrows scroll the page when the map is out of view;
  - no horizontal scroll 375-1440, default and XXL;
  - GLASS contentLive 0 for the guide.
  Also re-run the Phase 4 tools named in `b910-carry.md` for the carry-overs (TOK/literals, TYPE/code-scan, ICON/static, SHAPE/analyze, GLASS/layers, TELL/tells-webkit, MOTION/press), before and after.

## Worker B: the build guide (Sonnet)
- **Entries (23):**
  - batch 9: P3-DOLLYWOOD-03, -04, -05, -06, -07, -09, -11, -14, -15, -18, P3-DOLLYWOOD-LIVE-14, UX-DOLLYWOOD-1 (the template half; D builds the Home card), UX-DOLLYWOOD-2, -4, -7, -11, -12, -14, VIS-DOLLYWOOD-11, -16, GAP-DOLLYWOOD-1;
  - IMP-DOLLYWOOD-I1;
  - batch 10: P3-DOLLYWOOD-LIVE-09 (the shared Upright handler).
- **Carry-overs:** CONS-MOTION-4, CONS-SHAPE-4 (Mark done at `--btn-h-lg`), UNFILED-2. Also the region rule on your lines.
- **Tests:** extend `scripts/test-dollywood-sync.mjs` with the summary row, the plot clear syncing, and the read-only display.
- **Check:** write `audits/tools/phase6/9/guide-b-9.mjs`. It covers:
  - the … sheet on a phone;
  - 3D toggle and Back to map;
  - no rAF after leaving 3D;
  - the 3D step outline and its framing;
  - the phone fit with Upright;
  - Upright on Whole park, and Upright in place;
  - "up to 36″" counts including no-minimum rides;
  - the plot re-render, null, validation and the legacy key;
  - the sticky Mark done (1 tap);
  - the `summary` row;
  - the feed debounce (tick/untick → 0 lines; 3 ticks → 1 line);
  - section complete once;
  - the search popover and its empty state;
  - Next unfinished raising the sheet;
  - CONS-MOTION-4 landmark moves 0;
  - 0 `step:` rows in `dollywood-live`.

## Worker C: the park map (Sonnet)
- **Entries (28, batch 10):** P3-DOLLYWOOD-LIVE-03, -04, -05, -06 (the client; D does Home and chat), -07, -08, -10, -12, -13, -16, -17, VIS-DOLLYWOOD-LIVE-1, -3, -4, -5, -9, -10, -11, -13, UX-DOLLYWOOD-LIVE-1, -2, -4, -5, -7, P4-ACCENT-06, P4-ICON-04, P4-MOTION-03, P4-SHAPE-03.
- **Carry-overs:** CONS-ICON-2, CONS-MOTION-1 (the compass press). Also the region rule on your lines, with the park-map halves of VIS-SHAPE-1 (sheet children `--r-inset`, the amenity chip's tile, the kid `#q`) and CONS-SHAPE-3 (the park's off-grid paddings).
- **Tests:** extend `scripts/test-dollywood.mjs`: the beacon on/off on an open kid map, no publish off property, the kid's Share row, the view-only kid's text.
- **Check:** write `audits/tools/phase6/10/park-c-10.mjs`. It covers:
  - first open resumes sharing;
  - the meeting bar right after a fix;
  - kids' controls with nobody sharing;
  - no publish at home;
  - the stale states out of frame;
  - an amenity tap opens its card;
  - the compass keeps the view;
  - the denied state (adult and kid) at 390/430 with its chip visible;
  - the beacon off removes the dot within one pull, and on starts locating;
  - family labels without overlap (park seed at 390 and 820);
  - compass contrast ≥ 3:1 and N ≥ 4.5:1 in all palettes;
  - pulses stopped after 3 cycles (idle CPU);
  - targets 0 under 44;
  - the heights field writes once;
  - placing hides the sheet;
  - whole park above the sheet;
  - the iPad portrait card below the bar.

## Worker D: the Worker, the shell, waits, the meeting point, infrastructure and docs (Sonnet)
- **Entries (13):**
  - batch 10: GAP-DOLLYWOOD-LIVE-1, -2, -3, -4, P2-PWA-18, P3-DOLLYWOOD-LIVE-11, -15, -18, UX-DOLLYWOOD-LIVE-6, VIS-DOLLYWOOD-LIVE-2, -8, -12 (DEFER, record only);
  - batch 9: VIS-TELL-1.
- **Carry-overs:** GAP-ICON-2 (`LICENSE-lucide.txt` names every symbol added), GAP-MOTION-3 (list the device check: a guide chip and Mark done, a park FAB and a sheet tab on a real iPhone/iPad).
- **Support work (no id of your own):**
  - B's Home card for UX-DOLLYWOOD-1 (`index.html`, and `test-home.mjs` + `home-art-5.mjs` at 0);
  - C's P3-DOLLYWOOD-LIVE-06 (`parkOn()` in `index.html` `atPark`, `worker/src/chat.js` `where_is_family`, `worker/src/reminders.js` `parkJob`);
  - the sprite symbols everyone asks for.
- **Do first (infrastructure)**, and post in hooks when it is done:
  - `build_html.py` finds the hub via `HUB_REPO` (env) or a sibling `house-hub` (as well as "App Hub"), so `build/` gets `design.css` and `hub.js` again.
  - It copies `icons/sprite.svg` to the template repo's `icons/` beside `art/`, so standalone builds resolve `../icons/sprite.svg`.
  - Every `open()` in `build_html.py` and `verify.py` passes `encoding="utf-8"`. Found while planning: the Windows exports carry mojibake from `facts.json`, e.g. "No steam train â€" Electric Trolley". The Linux rebuild already fixes it; this keeps a Windows rebuild from bringing it back. Report it as found and fixed.
  - The `<head>` stylesheet for VIS-TELL-1.
- **Tests:**
  - `scripts/test-push2.mjs`: the forced `arrive` job: one push at the meeting point, none twice, none with the switch off, none to a guest or a kid, none for someone already there.
  - `scripts/smoke-api.sh`: the `push_pref:arrive` row and the forced job.
  - `scripts/test-home.mjs`: the guide card, and `atPark` ignoring an off-property row.
  - The rally UI: `audits/tools/phase2/PWA/verify3-rally-unreachable-1.mjs` must now find Rally; copy it to `-10` if its expectations no longer fit.
- **Check:** write `audits/tools/phase6/10/park-d-10.mjs`. It covers:
  - Rally from the bar (the request, the meta line, the 60 s disable, 429);
  - the meeting pin dropping at 2 h while open;
  - the Express wait attaching;
  - waits older than 6 h gone everywhere;
  - one error line;
  - the trend arrow from a seeded history;
  - the MIN label ≥ 11 px and ≥ 4.5:1 on all four bands;
  - the offline line;
  - the hours link (not for a kid).
- **Docs:**
  - `CLAUDE.md`: the Dollywood bullets (rally UI, the summary row and Home card, publish on property only), Push (the `arrive` kind and switch; the minute trigger now also runs `arriveJob`), the Tests table counts.
  - `worker/README.md`: the arrive job and the rally UI.
  - The template's `README.md`: the hub integration and the park-day features.
- **Precache:** `node scripts/bump-sw.mjs --check` must pass. The orchestrator bumps `sw.js` once at the end.

## How to check (report the numbers)
- **Scripts.** Run from `/home/user/house-hub` with the environment line: `node "<script>"`.
  - The batch's Phase 2/3/4 scripts are `audits/handoff-cloud/scratch/b910-scripts.txt` (86).
  - Before-run outputs on the pre-batch code: `SCRATCH/910-before/repro/` (scripts), `SCRATCH/cap910-before/` (captures). The Windows text outputs are in `audits/handoff-cloud/before-910-windows/`, for reference only.
  - Until `SCRATCH/final-910/_progress.txt` has a line starting `BEFORE done`, run nothing heavy: read, plan and edit.
  - Read the actual output, not only the exit code.
- **Your own Worker.**
  - Ports: A 8795, B 8796, C 8797, D 8798.
  - Copy `SCRATCH/d1-tmpl` to `SCRATCH/b910<a|b|c|d>/d1`. Apply `worker/migrations/008-timer-live.sql` once: `cd worker && npx wrangler d1 execute house-hub --local --persist-to <copy> --file migrations/008-timer-live.sql` (idempotent).
  - Then: `cd worker && setsid npx wrangler dev --port <port> --persist-to <copy> &`, remember the PID, and stop only that.
  - Use a fresh copy per suite run. Repo tests take `HUB_API=http://127.0.0.1:<port>` and the code as argv.
  - smoke-api's rally section allows one rally per adult per minute: wait 60 s between runs.
- **Repo tests that cover these apps:**
  - `scripts/test-dollywood.mjs` (park-map privacy, 32 checks);
  - `scripts/test-dollywood-sync.mjs` (guide sync and migration, port 8982);
  - `scripts/test-dollywood-themes.mjs` (themes, port 8781);
  - `scripts/screens-apps.mjs` (the Dollywood hex rule on the chrome line; no OS-scheme selectors);
  - `scripts/smoke-api.sh` (the rally and `dollywood-live` policy sections);
  - D adds `test-home.mjs` and `test-push2.mjs`.
  All of them take the suite lock.
- **Capture.** ALWAYS pass `--out SCRATCH/b910<a|b|c|d>/cap` and `--area dollywood` and/or `--area dollywood-live` (D: `--area shell` once, at the end). Never `--help`. Take the suite lock.
  - LOOK at the PNGs yourself: light and dark at 390, 820, 1180 and 1440, and XXL; an adult, a kid (park map), a guest, and the TV where it applies.
- **Gates:**
  - `verify.py` passes.
  - `node SCRATCH/parse-check.cjs /home/user/house-hub`: 0 failed.
  - `screens-apps.mjs`' Dollywood rule holds.
  - `node scripts/bump-sw.mjs --check`.
  - `audits/tools/phase6/5/home-art-5.mjs` stays at 0 (D).
  - `git checkout -- docs/screens` and restore `audits/evidence/p2|p3|p4` after scripts rewrite them (copy your outputs out first).

## Report (short)
- Each entry and carry-over: done, partly done, not done, or DEFER, with why.
- The files and template regions you changed.
- Scripts before → after, including any `-9`/`-10` copies.
- Suite counts and `verify.py`'s last line.
- What you looked at.
- What needs a real device: GPS and the wake lock on an iPhone in the park, the arrival and rally pushes, 3D performance on an iPad, the press feel, the iPad long-press, Safari's search field.
