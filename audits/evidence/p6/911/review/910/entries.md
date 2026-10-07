# Batches 9 + 10 — Dollywood build guide and park map (one template): 90 entries + the kept improvements; carry-overs are in b910-carry.md

### Batch 9 — Dollywood build guide (48)

#### P3-DOLLYWOOD-03 — On phones the … menu opens out of the sheet: Export and Import cannot be reached, and only a sliver of Reset can

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:229`; `apps/dollywood.html:313`, `apps/dollywood.html:371`, `apps/dollywood.html:359`; `audits/evidence/p3/dollywood/phone-progress-menu-clipped.png`, `audits/evidence/p3/dollywood/verify-progress-menu-clipped-phone-1-half.png`
- **What happens now.** Inside the `@media (max-width:699px)` block that opens at `apps/dollywood.html:313`, the menu is set to open upward (`bottom: calc(100% + 6px)`, `apps/dollywood.html:371`). It hangs off the sheet's top row, and the sheet is `position: fixed` with `overflow: hidden` (`apps/dollywood.html:359`), so almost all of it is clipped.
- **Why it matters.** On a phone there is no way to make a backup (Export), which is the only recovery from P3-DOLLYWOOD-01 and -02, or to restore one.
- **Proposed fix.** On phones the … menu opens downward inside the sheet (or as its own sheet) so Export, Import and Reset are reachable. (Phase 3: IMP-DOLLYWOOD-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-progress-menu-clipped-phone-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-progress-menu-clipped-phone-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-04 — On phones the pressed 3D button never returns to 2D, and nothing on screen names the way back

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:259`; `apps/dollywood.html:333`, `apps/dollywood.html:1156`, `apps/dollywood.html:856`, `apps/dollywood.html:821`; `audits/evidence/p3/dollywood/phone-3d-after-second-tap.png`, `audits/evidence/p3/dollywood/verify-phone-3d-no-exit-2-phone.png`
- **What happens now.** Below 700 px the 2D button is hidden (`apps/dollywood.html:333`, inside the block at `:313`), and the 3D button's handler always calls `setMode('3d')` (`apps/dollywood.html:1156`). The T key toggles (`apps/dollywood.html:856`), but a phone has no keyboard.
- **Why it matters.** On a phone the 3D view is mostly sky (VIS-DOLLYWOOD-16). The person who opened it has to guess a way out, and the only control worded like one ("Reset view") just resets the camera.
- **Proposed fix.** The 3D button toggles back to 2D (aria-pressed), and a "Map" control shows while in 3D. (Phase 3: IMP-DOLLYWOOD-P1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-phone-3d-no-exit-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-phone-3d-no-exit-2.mjs"`, `node "audits/tools/phase3/dollywood/repro-new.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-05 — On phones with Upright on, every map jump frames the unrotated box: Fit cuts off half the park and a section chip can miss its section

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:287`; `apps/dollywood.html:1088`, `apps/dollywood.html:1143-1146`, `apps/dollywood.html:809`; `audits/evidence/p3/dollywood/phone-upright-fit.png`, `audits/evidence/p3/dollywood/verify-upright-fit-phone-2-iphone-pwa-chip.png`
- **What happens now.** `fitTarget` sends every phone fit to `fitBoxPhone` (`apps/dollywood.html:1088`), which builds the view from the unrotated box (`apps/dollywood.html:1143-1146`). `fitBox`, used on wider screens, first rotates the box corners by `ROT` (`apps/dollywood.html:809`). With `ROT` −98.71°, the phone's Fit produces exactly the north-up view.
- **Why it matters.** Turning Upright on on a phone shows parking lots and hills, and every jump (a section, a search result, a step) lands somewhere else.
- **Proposed fix.** The phone fit rotates the target box as fitBox does when Upright is on. (Phase 3: IMP-DOLLYWOOD-P7)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-upright-fit-phone-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-upright-fit-phone-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-06 — The "up to N″" rider-height filter hides every listing with no height requirement

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:320`; `apps/dollywood-live.html:1007`, `apps/dollywood.html:1007`, `apps/dollywood.html:1671`; `audits/screens/dollywood/listings-height-typical-ipad-portrait-light.png`, `audits/evidence/p3/dollywood/verify-height-filter-drops-no-requirement-2-upto36.png`
- **What happens now.** `listItems` keeps `hf === 'none' ? !o.height_in : (o.height_in && o.height_in <= +hf)` (`apps/dollywood.html:1007`). So "up to 36″" shows 9 of 145, "up to 42″" 18 and "up to 48″" 23, although 120 listings have no requirement at all. The same file's park-map rule `fits()` treats no requirement as rideable (`apps/dollywood.html:1671`).
- **Why it matters.** A parent planning for a small child sees 9 rides, and none of the 43 attractions with no requirement, such as the Village Carousel, the Amazing Flying Elephants and Lil' Pilots Playground.
- **Proposed fix.** "Up to N″" keeps listings with no height requirement (!o.height_in || o.height_in <= N), shared template code for both exports (template :1004). (Phase 3: IMP-DOLLYWOOD-LIVE-P11, IMP-DOLLYWOOD-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-height-filter-drops-no-requirement-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-height-filter-drops-no-requirement-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-07 — The step card's in-game line ignores the saved plot width after load and after every plot change

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:347`; `apps/dollywood.html:1057`, `apps/dollywood.html:1109`, `apps/dollywood.html:1110`, `apps/dollywood.html:1049-1052`; `audits/screens/dollywood/steps-full-overflow-iphone-pwa-light.png`, `audits/screens/dollywood/scale-overflow-iphone-pwa-light.png`
- **What happens now.** `adopt()` renders the step (`apps/dollywood.html:1109`) before it applies `plot` (`apps/dollywood.html:1110`), and `updScale()` sets the factor but never re-renders (`apps/dollywood.html:1049-1052`).
- **Why it matters.** Eli builds to the numbers on the card. Unscaled or stale game metres mean pieces built at the wrong size.
- **Proposed fix.** Re-render the step card when the plot width changes (after load, an edit and a synced change).
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-plot-card-stale-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-plot-card-stale-2.mjs"`, `node "audits/tools/phase3/dollywood/data-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-16 — The keyboard shortcuts ignore Ctrl, Cmd and Alt: Ctrl/Cmd+D (bookmark) ticks or silently unticks the current step, and Ctrl/Cmd+P and page zoom are taken over

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:544`; `apps/dollywood.html:852`, `apps/dollywood-live.html:852`, `apps/dollywood.html:853-857`, `apps/dollywood.html:1086`; `audits/evidence/p3/dollywood/critic-ctrl-d-desktop.png`, `audits/evidence/p3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-1-webkit.png`
- **What happens now.** The document keydown handler returns early only for inputs and for keys the 3D view handles (`apps/dollywood.html:852`). It then maps bare `e.key` values (`+` / `=`, `-`, `0`, the arrows, `v`, `s`, `m`, `t`, `n`, `p`, `d`, Escape) to actions, and calls `preventDefault()` for each (`apps/dollywood.html:853-857`).
- **Why it matters.** Eli builds at the PC beside the game. Pressing Ctrl+D to bookmark the guide, or Ctrl+P to print a step, marks a step done that he has not built and tells the family feed he built it, or quietly unticks one he has built.
- **Proposed fix.** The keyboard shortcuts ignore events with Ctrl, Cmd or Alt held (template :849), so browser shortcuts never tick or untick a step.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/critic-keys-plot.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-2.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### UX-DOLLYWOOD-2 — On iPad and desktop, the card's Next and Show on map move a map the person cannot see

- **Area** dollywood · **Type** usability · **Severity** medium · **Effort** S · **Batch** 9
- **Verified (step 3).** was medium; skeptics medium (partly) and medium (partly). Correction: The claim is wrong for iPad portrait. At the natural scroll that brings the card's buttons into view, 694 of the 738 px map is on screen together with the card, and the target Next frames is visible. The '261 px' figure is an artefact of centring the card.
- **Evidence.** `audits/03-apps/dollywood.md:669`; `apps/dollywood.html:1140`; `audits/screens/dollywood/step-on-map-typical-ipad-portrait-light.png`
- **What happens now.** `mapIntoView` returns early unless on a phone (`apps/dollywood.html:1140`).
- **Why it matters.** The map moves out of sight.
- **Proposed fix.** On iPad and desktop, Next and Show on map scroll the map into view (mapIntoView for every size).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-4 — Below 1180 px, search results appear about 2,000 px from the search box, and a no-match search says only "0 of 145"

- **Area** dollywood · **Type** usability · **Severity** medium · **Effort** S · **Batch** 9
- **Verified (step 3).** was medium; skeptics medium and medium (partly). Correction: The limit is 'at or below 1180 px', not 'below 1180 px'. iPad landscape (exactly 1180 wide) is affected too, with a 2,264 px gap. The visual-check line saying there is no clear button is wrong: the search field is type=search and shows a native clear glyph in every capture.
- **Evidence.** `audits/03-apps/dollywood.md:676`; `audits/evidence/p3/dollywood/ipad-search-no-match.png`, `audits/screens/dollywood/search-none-typical-ipad-portrait-light.png`
- **What happens now.** Searching "zipline" on iPad portrait put the results list top at y=2506 (search box bottom 428, viewport 1132), with no empty-state message. A single match does fly to it and open its card ("thunder").
- **Why it matters.** Results appear 2,000 px away.
- **Proposed fix.** Show search results directly under the search box (a popover list) with a "No match for zipline" empty state. (Phase 3: IMP-DOLLYWOOD-F4)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-1 — Completed steps are struck through at 2.2:1 (light) and 3.5:1 (dark)

- **Area** dollywood · **Type** visual · **Severity** medium · **Effort** S · **Batch** 9
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: 'Barely legible' overstates it. At 2.2:1 in bold the rows are faint but readable in both the iPad capture and my own. The Midnight figure depends on which background is used (3.62 against the card, about 3.75 against the page).
- **Evidence.** `audits/03-apps/dollywood.md:714`; `apps/dollywood.html:100-101`; `audits/evidence/p3/dollywood/ipad-card-hearth.png`, `audits/evidence/p3/dollywood/ipad-card-midnight.png`
- **What happens now.** `.bitem.ok` combines the dim colour, opacity .55 and a line-through (`apps/dollywood.html:100-101`). Rendered contrast of the 13 px text: Hearth 2.23, Parchment 2.31, Frost 2.26, Midnight 3.62, Forest 3.49 (AA needs 4.5). The checker confirmed the rows are barely legible.
- **Why it matters.** Done steps fail contrast at 2.2:1.
- **Proposed fix.** Completed steps: a check glyph and --text-2 at full opacity, no strike-through (CONS-COLOR-1 rule: never dim text with opacity). (Phase 3: IMP-DOLLYWOOD-P6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-2 — 35 tap targets under 44 px on the phone, 15 on the iPad

- **Area** dollywood · **Type** visual · **Severity** medium · **Effort** M · **Batch** 9
- **Verified (step 3).** was medium; skeptics medium and medium (partly). Correction: Minor details only. The phone list in the report adds up to 34 items; the 35th is the Basemap select (42x42), which is counted but not named. The card link buttons measure 35 px tall, not about 33.
- **Evidence.** `audits/03-apps/dollywood.md:717`; `apps/dollywood.html:1148`, `apps/dollywood.html:300`
- **What happens now.** Phone: the 13 section chips (36 px tall), six tool and zoom buttons (32 px wide), nine coaster-legend items (17 px tall, tappable, `apps/dollywood.html:1148`), "?" (32×32), the sheet handle (22 px tall), Next unfinished (40 px), … (44×40), Compare (36 px), the exaggeration slider (20 px).
- **Why it matters.** 35 targets under 44 px on the phone.
- **Proposed fix.** Every control to var(--tap): chips, tool and zoom buttons, legend items, "?", handle, Next unfinished, …, Compare. (Phase 3: IMP-DOLLYWOOD-P9)
- **How it will be verified.** recapture its screens (capture area dollywood) and compare; plus batch 9's checks.

#### CONS-TYPE-6 — The park map's pane headings fall back to the generic serif (Times on Apple devices), and the Dollywood badges and marker numbers to generic sans, because the template names faces it never loads

- **Area** design system (park map) · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:1501`; `apps/dollywood.html:223`, `apps/dollywood-live.html:223`, `apps/dollywood.html:281`, `apps/dollywood-live.html:544`; `audits/screens/dollywood-live/search-typical-iphone-pwa-light.png`
- **What happens now.** The pane headings. The hub flavour remaps `.tabbody h2` to `--font-display` (`apps/dollywood.html:223`). The live flavour remaps only `.pop h2` (`apps/dollywood-live.html:223`).
- **Why it matters.** One export shows Times headings next to SF Pro Rounded, and the two exports of one template disagree.
- **Proposed fix.** The template names real stacks (--font-serif / --font-text) instead of generic families.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### GAP-DOLLYWOOD-1 — The 3D view never shows the current step

- **Area** dollywood · **Type** feature gap · **Severity** low · **Effort** L · **Batch** 9
- **Verified (step 3).** was medium; skeptics low and low. Correction: The code claim is correct. The report misses that Previous, Next, Mark done and Show on map all force the view back to 2D (apps/dollywood.html:1085-1087). The 2D map is therefore the app's designated view for a step, and the 3D view is not simply a place where the step is missing.
- **Evidence.** `audits/03-apps/dollywood.md:772`; `apps/dollywood.html:1157`, `apps/dollywood.html:1153`; `audits/screens/dollywood/view-3d-typical-ipad-portrait-light.png`
- **What happens now.** LEGO Builder's core is a step you can zoom and spin. Here the 3D code never reads the current section or step: no `curSec`, `curIdx`, `stepTarget` or `highlight` between `apps/dollywood.html:1157` and `:1290` (NOT FOUND IN CODE), and entering 3D hides the 2D map that carries the step highlight …
- **Why it matters.** The one 3D view never shows what to build.
- **Proposed fix.** The 3D view highlights and frames the current step (read curSec/curIdx), like LEGO Builder's step view. (Phase 3: IMP-DOLLYWOOD-I2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### P3-DOLLYWOOD-08 — Sitting idle in 2D, the step highlight's infinite pulse keeps the main thread busy (15.8-27.7% in Chromium)

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:381`; `apps/dollywood.html:282-283`, `apps/design.css:611-613`
- **What happens now.** The current step's target carries `#hl .hl-ring { animation: hlring 2.2s ease-in-out infinite }`, which animates `stroke-opacity` (`apps/dollywood.html:282-283`; the class is set at `:907-913`), on a 2,783-node SVG map. `stroke-opacity` is not a compositor-only property, so the map is repainted every frame.
- **Why it matters.** An iPad or PC left open on the guide keeps repainting the whole map sixty times a second: battery drain and heat for nothing.
- **Proposed fix.** The step highlight pulses three times (--ambient-iterations) on transform/opacity, then rests. (Phase 3: IMP-DOLLYWOOD-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-idle-pulse-cpu-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-idle-pulse-cpu-2.mjs"`, `node "audits/tools/phase3/dollywood/perf-idle.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-09 — After 3D has been opened once, the render loop keeps requesting 60 frames a second in 2D until the guide is closed

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:401`; `apps/dollywood.html:1269`, `apps/dollywood.html:1152-1156`, `index.html:729-733`, `index.html:732`
- **What happens now.** The 3D render loop reschedules `requestAnimationFrame` on every frame and renders only in 3D: `(function loop(){ if (mode==='3d') {…render…} requestAnimationFrame(loop) })()` (`apps/dollywood.html:1269`). Nothing cancels it; `setMode('2d')` does not stop it (`apps/dollywood.html:1152-1156`).
- **Why it matters.** A small, needless wake-up of the page sixty times a second while the guide sits open in 2D.
- **Proposed fix.** Stop the 3D render loop (cancelAnimationFrame) when leaving 3D.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-raf-loop-after-3d-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-raf-loop-after-3d-2.mjs"`, `node "audits/tools/phase3/dollywood/perf-3d.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-10 — A dead "N" compass button sits over the iPad and desktop map, and over 3D

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:421`; `apps/dollywood.html:352`, `apps/dollywood.html:565`, `apps/dollywood.html:1597`, `apps/dollywood.html:1740`; `audits/evidence/p3/dollywood/verify-dead-north-button-1-ipad-3d.png`, `audits/screens/dollywood/view-3d-typical-ipad-portrait-light.png`
- **What happens now.** `.lv-northwrap` is hidden only below 700 px (`apps/dollywood.html:352`, inside the block at `:313`). The rule that hides the park map's other chrome outside the live flavour (`apps/dollywood.html:565`) leaves it out.
- **Why it matters.** A compass that does nothing over the map and over 3D teaches that the controls cannot be trusted.
- **Proposed fix.** Hide the dead N button outside the park map (or wire it to Upright).
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-dead-north-button-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-dead-north-button-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-11 — Turning Upright on or off with "Whole park" pressed zooms to the last-selected section

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:441`; `apps/dollywood.html:1029`, `apps/dollywood-live.html:1029`, `apps/dollywood.html:1121`, `apps/dollywood-live.html:1121`; `audits/evidence/p3/dollywood/ipad-upright-whole-park.png`, `audits/evidence/p3/dollywood/verify-upright-whole-park-zooms-entrance-1-A-first-open-upright-on.png`
- **What happens now.** `curSec` starts as `'entrance'` (`apps/dollywood.html:1062`) and `selectSection('all')` never sets it (`apps/dollywood.html:1121`). The Upright handler fits `SEC[curSec]` unless `curSec === 'all'` (`apps/dollywood.html:1029`), so that guard never fires from the Whole park chip.
- **Why it matters.** Upright is the way to see the park the way the game shows it; turning it on zooms somewhere unexpected.
- **Proposed fix.** With Whole park pressed, Upright fits the whole park (template :1029, shared).
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-upright-whole-park-zooms-entrance-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-upright-whole-park-zooms-entrance-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-12 — On phones the "?" popover opens off the left edge (48 of 267 px visible)

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:462`; `apps/dollywood.html:358`, `apps/dollywood.html:174-176`; `audits/evidence/p3/dollywood/phone-help-popover.png`, `audits/evidence/p3/dollywood/verify-help-popover-offscreen-phone-2-iphone-pwa-chromium.png`
- **What happens now.** Below 700 px the hint text fills the first line, so the "?" wraps to the start of the next line at x=16. The phone rule `right: 0` (`apps/dollywood.html:358`) then makes the 267 px, no-wrap popover grow leftwards from x=48, so it starts at x=−219 (`apps/dollywood.html:174-176, 640-641`).
- **Why it matters.** A visible control opens a panel that cannot be read.
- **Proposed fix.** Clamp the "?" popover inside the viewport on phones.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-help-popover-offscreen-phone-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-help-popover-offscreen-phone-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-13 — On iPad portrait the View ▾ menu runs 26 px past the right edge

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:482`; `apps/dollywood.html:164`, `apps/dollywood.html:1034`, `apps/dollywood.html:343`; `audits/evidence/p3/dollywood/ipad-view-menu.png`, `audits/evidence/p3/dollywood/verify-view-menu-offscreen-ipad-2-webkit.png`
- **What happens now.** `.vmenu` is `left: 0` with `min-width: 250px` (`apps/dollywood.html:164`), anchored to a View button whose left edge is at x=596, so its right edge lands at 846 in an 820 px viewport. The menu holds the contour-interval select and the Steepness switch (the theme row is removed, `apps/dollywood.html:1034`).
- **Why it matters.** The contour select and the steepness checkbox are cut at the edge, and the page gains a sideways scroll while the menu is open.
- **Proposed fix.** Anchor the View ▾ menu to the right edge (or clamp it) on iPad portrait.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-view-menu-offscreen-ipad-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-view-menu-offscreen-ipad-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-14 — After 3D, touch devices get the mouse hint "Move over the map… scroll to zoom"

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:502`; `apps/dollywood.html:1154`, `apps/dollywood.html:607`, `apps/dollywood.html:824`; `audits/evidence/p3/dollywood/verify-readout-mouse-copy-touch-1-iphone-pwa.png`
- **What happens now.** `setMode` writes the mouse text for 2D with no coarse-pointer check (`apps/dollywood.html:1154`). At boot (`apps/dollywood.html:607`) and in `setTool` (`apps/dollywood.html:824`) the app picks the touch text, "Tap anything for details · pinch to zoom", on coarse pointers.
- **Why it matters.** The one line of help on the map tells an iPad user to hover and scroll.
- **Proposed fix.** Keep the touch hint after leaving 3D on coarse pointers.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-readout-mouse-copy-touch-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-readout-mouse-copy-touch-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-15 — The Scale tab refers to an "Info tab" that does not exist (also found by the visual check)

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:522`; `apps/dollywood.html:672`, `apps/dollywood.html:660`, `apps/dollywood.html:958`, `apps/dollywood.html:973-974`; `audits/screens/dollywood/scale-empty-ipad-portrait-light.png`, `audits/evidence/p3/dollywood/verify-scale-copy-info-tab-2-scale-tab.png`
- **What happens now.** The Scale tab says every dimension "shown in the Info tab will also be shown in game metres" (`apps/dollywood.html:672`). The tabs are Listings, Layers and Scale (`apps/dollywood.html:660`; `showTab` toggles only those three, `apps/dollywood.html:958`).
- **Why it matters.** A reader looks for a tab that is not there and cannot tell where the converted numbers show.
- **Proposed fix.** The Scale copy says where the numbers appear ("on the step card and the listing cards").
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-scale-copy-info-tab-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-scale-copy-info-tab-2.mjs"`, `node "audits/tools/phase3/dollywood/verify-vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1-1.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-17 — The arrow keys never scroll the page: they pan a map that is scrolled away, even while the person reads the step card

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:583`; `apps/dollywood.html:854`, `apps/dollywood.html:857`, `apps/dollywood.html:852`, `apps/dollywood.html:641`; `audits/evidence/p3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-1-webkit-after-arrowdown.png`, `audits/evidence/p3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-1-chromium-after-arrowdown.png`
- **What happens now.** The global handler binds ArrowLeft, ArrowRight, ArrowUp and ArrowDown to panning the map (`apps/dollywood.html:854`) and calls `preventDefault()` (`apps/dollywood.html:857`) wherever focus is, except in an input, select or textarea (`apps/dollywood.html:852`).
- **Why it matters.** On the PC Eli reads the step card below the map. The standard keyboard way down the page does nothing he can see, and it pans a map he cannot see, which he finds moved when he scrolls back up.
- **Proposed fix.** Arrow keys pan the map only when it has focus or is mostly on screen.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/critic-arrows.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-2.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-18 — Clearing the plot width does not reach another open device, and a legacy `dw-plot` key brings an old width back on every boot

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:615`; `apps/dollywood.html:1055`, `apps/dollywood.html:1110`, `apps/dollywood.html:1057`, `apps/hub.js:392`; `audits/evidence/p3/dollywood/verify-critic-critic-plot-clear-not-synced-2-2-phone-after-pull.png`, `audits/evidence/p3/dollywood/verify-critic-critic-plot-clear-not-synced-2-2-legacy-after-reload.png`
- **What happens now.** Clearing `#sc-plot` runs `savePlot`, which writes `hub.set('plot', v || null)` (`apps/dollywood.html:1055`), so the server row becomes null. `adopt()` applies a remote plot only when `v != null` (`apps/dollywood.html:1110`).
- **Why it matters.** The step card and the listing cards convert every measurement by this factor. When two devices disagree about the plot width, Eli builds to different in-game sizes depending on which device he reads.
- **Proposed fix.** adopt() applies a null plot width like any value; once signed in, the legacy dw-plot key is removed after migration.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/critic-keys-plot.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-plot-clear-not-synced-2-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-plot-clear-not-synced-2-2.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P4-TELL-05 — The build guide first paints an empty section-chip strip, then its map drops 44-48 px when the chips arrive (CLS 0.119-0.128 on a cold open through the hub)

- **Area** design system (build guide) · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:6223`; `apps/dollywood.html:578`, `apps/dollywood.html:684`, `apps/dollywood.html:2`, `index.html:327-329`
- **What happens now.** The section-chip row is an empty `<div id="chips">` in the exported HTML (`apps/dollywood.html:578` = template `:578`). The main inline script fills it (template `:1120`), and that script runs after the multi-megabyte payload (template `:682`) and the parser-blocking external `hub.js` (`apps/dollywood.html:684`).
- **Why it matters.** The map, which is the point of the page, jumps as the guide opens. That is a tell the house style bans.
- **Proposed fix.** Reserve the chip strip's height (--min-h-chips) before the chips arrive. (Phase 4 gap row TELL-8)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TELL/verify-build-guide-cls-in-viewer-2.mjs"`, `node "audits/tools/phase4/TELL/loading.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P4-TYPE-01 — Build guide map labels render below 11 px at the default whole-park view: section names 6.1 px on the iPhone (5.5 px in Safari), listing numbers 6.8 px on every device, contour heights 9.5 px at every zoom

- **Area** design system (build guide) · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:1330`; `apps/dollywood-live.html:526`, `apps/dollywood.html:802-805`, `apps/dollywood.html:281`, `apps/dollywood.html:111`; `audits/evidence/p4/TYPE/verify-build-guide-svg-labels-under-11-1-iphone-pwa.png`, `audits/screens/dollywood/map-typical-iphone-pwa-light.png`
- **What happens now.** The cause is the template's `apply()`, which runs after every pan and zoom (`../dollywood-build-project/scripts/template.html:799-802`, exported to `apps/dollywood.html:802-805`). `k` is metres per CSS px (`mpp()`, `template.html:788`), so the map's own drawing scale is 1/k.
- **Why it matters.** On a phone the section names and listing numbers are how the map is read, and at 5.5-6.8 px they cannot be read.
- **Proposed fix.** Map labels in screen px with an 11 px floor (--fs-caption2), independent of the map scale. (Phase 4 gap row TYPE-11)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TYPE/verify-build-guide-svg-labels-under-11-1.mjs"`, `node "audits/tools/phase4/TYPE/hidden-text.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### UX-DOLLYWOOD-1 — Ticking the step just built takes 3-4 taps plus a scroll, and Home has no build-guide card

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** M · **Batch** 9
- **Verified (step 3).** was medium; skeptics low (partly) and low. Correction: The report frames it as the cost of every tick ('Ticking the step just built takes 3-4 taps plus a scroll'). In fact it is the cold-start cost per session: within a session each tick is 1 tap, and the card stays in view and advances by itself.
- **Evidence.** `audits/03-apps/dollywood.md:665`; `index.html:458-459`; `audits/screens/dollywood/map-typical-ipad-portrait-light.png`, `audits/screens/dollywood/map-typical-desktop-light.png`
- **What happens now.** J1 is 4 taps on the iPhone (the sheet must be raised first) and 3 taps plus a scroll on the iPad and desktop. On iPad portrait the card title sits at y=1400 in a 1132 px viewport; on desktop the card starts at y=1441 in 852.
- **Why it matters.** Ticking the step just built takes 3-4 taps and a scroll.
- **Proposed fix.** A sticky "Mark done" on the step card, the card scrolled into view on open, and a build-guide Home card ("Next: Blueprint the section · 7 of 9"). (Phase 3: IMP-DOLLYWOOD-F3, IMP-DOLLYWOOD-F6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-3 — A phone's first screen is header, chips and parking lots; the park sits under the peeking sheet

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** M · **Batch** 9
- **Verified (step 3).** was medium; skeptics low and low.
- **Evidence.** `audits/03-apps/dollywood.md:673`; `audits/evidence/p3/dollywood/phone-first-screen.png`, `audits/screens/dollywood/map-typical-iphone-pwa-light.png`
- **What happens now.** The map starts at y=470 and the sheet at 766 (viewport 884). 56 of 68 markers are under the sheet and 11 are in view. The chips wrap to 2 rows, and only 2 of 13 are fully visible.
- **Why it matters.** The first screen is header and parking lots.
- **Proposed fix.** On phones, open on the map with the sheet peeking below the park, and one row of scrollable chips.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-7 — On phones, Next unfinished from the peeking sheet leaves the new step hidden

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:687`; `audits/screens/dollywood/next-unfinished-overflow-iphone-pwa-light.png`
- **What happens now.** The sheet stays at peek; the new title "Blueprint the section" sits at y=928, below the 884 px viewport. Only the header changes.
- **Why it matters.** The new step is hidden.
- **Proposed fix.** Next unfinished raises the sheet so the new step shows.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-8 — After a cut, the profile is about 1,000 px below and the map still says "Tap two points"

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:690`; `apps/dollywood.html:824`; `audits/evidence/p3/dollywood/ipad-cross-section-cut.png`
- **What happens now.** On iPad portrait the profile top was at y=2101 (viewport 1132). The map pill still read "Tap two points", and the readout repeated the instruction (`apps/dollywood.html:824, 826`).
- **Why it matters.** The result is 1,000 px away and the hint is stale.
- **Proposed fix.** After a cut, scroll to the profile and change the pill to "Profile ready". (Phase 3: IMP-DOLLYWOOD-F2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-9 — Map cards run off-screen

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:693`; `apps/dollywood.html:961-963`; `audits/evidence/p3/dollywood/ipad-listing-card-low-marker.png`, `audits/screens/dollywood/coaster-typical-desktop-light.png`
- **What happens now.** `openPop` keeps the card inside the map box, not the viewport (`apps/dollywood.html:961-963`). On iPad portrait a listing card opened on a low marker ended at y=1176 in a 1132 px viewport. On desktop the coaster card is 926 px tall in an 852 px viewport (bottom 1331).
- **Why it matters.** Cards run off screen.
- **Proposed fix.** openPop keeps cards inside the viewport, not only the map box; tall cards become a sheet.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-11 — Every tick posts a family-feed line; an untick leaves it, and a re-tick doubles it

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:699`; `apps/dollywood.html:1086`
- **What happens now.** Five Mark done taps on the last Entrance steps (tick, tick, untick, tick, untick) posted 3 lines to the family feed that Home and the TV read, including "Ticked Blueprint the section" twice, although that step ended unticked (`apps/dollywood.html:1086`).
- **Why it matters.** The feed fills with ticks and unticks.
- **Proposed fix.** Post one feed line per session summary ("Built 3 steps in the Entrance") instead of one per tick; an untick within a minute cancels its line.
- **How it will be verified.** recapture its screens (capture area dollywood) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-12 — The plot width accepts implausible values without comment

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:702`; `apps/dollywood.html:673`; `audits/screens/dollywood/scale-overflow-iphone-pwa-light.png`
- **What happens now.** 12,500 m reads "1363% of real size (13.631×)". The input has only `min=50`, which typing does not enforce (`apps/dollywood.html:673, 1049-1052`).
- **Why it matters.** Implausible values are accepted.
- **Proposed fix.** Validate the plot width (50-2,000 m) with an inline message.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-13 — The "Unlisted structure" card offers web search with an empty query

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:705`; `apps/dollywood.html:987`; `audits/screens/dollywood/building-typical-iphone-pwa-light.png`
- **What happens now.** `srch(t.name || '')` (`apps/dollywood.html:987`) leaves the search box empty next to Web / Photos / Videos / dollywood.com buttons.
- **Why it matters.** Web search opens empty.
- **Proposed fix.** Fill the search query with the structure's kind and section.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-4 — Profile axis labels render at 5.7 px on the phone

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:726`; `apps/dollywood.html:936`; `audits/screens/dollywood/cross-section-typical-iphone-pwa-light.png`
- **What happens now.** `font-size` 12 inside a 1000-wide viewBox (`apps/dollywood.html:936`), drawn 372 px wide. The checker saw illegible smudges.
- **Why it matters.** 5.7 px labels on the phone.
- **Proposed fix.** Profile axis labels in screen px (vector-effect or HTML labels) at --fs-caption2 minimum.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-6 — The glass look sits on content (header, side panel), and cards read through to the map

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:732`; `apps/dollywood.html:234`; `audits/screens/dollywood/listing-typical-ipad-landscape-dark.png`, `audits/screens/dollywood/coaster-typical-desktop-light.png`
- **What happens now.** The header, toolbar and side panel carry the specular glass gradient (`apps/dollywood.html:234, 245, 249`) with no backdrop blur. On the iPad only the readout and the dead N button have blur; on the phone the sticky toolbar and the sheet do.
- **Why it matters.** Glass on content.
- **Proposed fix.** Header and side panel become solid material (--material-solid-bg); glass stays on the toolbar and sheet only.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-8 — Default form controls, `confirm()` / `alert()` and text-glyph buttons

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** M · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:739`; `apps/dollywood.html:1098`, `apps/dollywood.html:1101`; `audits/screens/dollywood/layers-typical-ipad-portrait-light.png`, `audits/screens/dollywood/scale-typical-ipad-portrait-dark.png`
- **What happens now.** Native selects (`#bmap`, `#cint`, `#hf`), checkboxes, range and number inputs with spinners, and a search field with the browser's clear glyph. `confirm()` at `apps/dollywood.html:1098` and `alert()` at `apps/dollywood.html:1101`. Buttons drawn as glyphs: …, ?, ×, ↗, ▾; the iPad and desktop toolbar is all text.
- **Why it matters.** Default controls and native dialogs.
- **Proposed fix.** Styled selects (the --select-chevron mask), the shared switch, the shared confirm sheet and toast, and Lucide icons instead of text glyphs.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-9 — Flat green bands where a basemap does not fill the frame

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:742`; `apps/dollywood.html:284`; `audits/screens/dollywood/aerial-typical-iphone-pwa-dark.png`, `audits/screens/dollywood/upright-typical-desktop-light.png`
- **What happens now.** The phone map box is taller than the map's aspect ratio, so its `#4F6A48` background (`apps/dollywood.html:284, 348`) shows as a band under the aerial, illustrated and steepness basemaps, and as wedges with Upright on. From the visual check: on the phone, Upright also shows a diagonal raster edge over the band.
- **Why it matters.** Flat green bands.
- **Proposed fix.** Size the map box to the basemap's aspect ratio on phones, or fill with the basemap's edge colour.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-10 — The header wraps badly on iPad landscape

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:745`; `audits/evidence/p3/dollywood/ipad-landscape-header.png`, `audits/screens/dollywood/map-loading-ipad-landscape-light.png`
- **What happens now.** The hero art ends at x=171 and the title starts at x=690, a 519 px gap; the stats wrap below; the header is 213 px tall.
- **Why it matters.** A 519 px gap and a wrapped header.
- **Proposed fix.** On iPad landscape the header puts art, title and stats in one row.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-11 — The 3D gesture hint is truncated on phones and lists keyboard keys

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:748`; `audits/screens/dollywood/view-3d-typical-iphone-pwa-light.png`
- **What happens now.** The readout has a scroll width of 570 in 274 px on a coarse pointer, and it mentions "arrows or WASD" and "Q/E".
- **Why it matters.** A truncated hint that lists WASD.
- **Proposed fix.** Touch devices get a short gesture hint without keyboard keys.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-13 — Layer legend swatches vanish on the light panel

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:754`; `apps/dollywood.html:664`; `audits/screens/dollywood/layers-typical-ipad-portrait-light.png`, `audits/screens/dollywood/about-typical-ipad-portrait-light.png`
- **What happens now.** In Layers, the Section names swatch is an inline `#FFF8E6` (`apps/dollywood.html:664`) on a cream panel, about 1:1. Official listings looks the same, and the Contours, Dollywood Express and Guest paths swatches are pale yellow. Below the 3:1 floor for non-text.
- **Why it matters.** Swatches vanish.
- **Proposed fix.** Legend swatches get a --field-border ring so pale swatches show on the light panel.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-14 — The measure label is thin, small and unhaloed over the map

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:757`; `audits/screens/dollywood/measure-typical-ipad-landscape-light.png`
- **What happens now.** "555 m · 242 m in game" is small regular text straight on the terrain, with no pill or halo; the section labels get heavy haloed caps.
- **Why it matters.** Thin, small, unhaloed text on the map.
- **Proposed fix.** The measure label becomes a haloed pill like section labels.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-15 — Listing labels collide with markers and each other at section zoom

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:760`; `audits/screens/dollywood/section-typical-ipad-landscape-light.png`
- **What happens now.** In the Showstreet view, "Ride Accessibility Center" is drawn over marker 8, "TimeSaver & Special Experiences Reservation Center" runs across two buildings, and "126 Dreamsong Theater" overlaps its neighbour.
- **Why it matters.** Labels collide at section zoom.
- **Proposed fix.** Listing labels use the same collision pass as section labels.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-16 — The phone 3D view is mostly sky

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:763`; `audits/screens/dollywood/view-3d-typical-iphone-pwa-light.png`, `audits/evidence/p3/dollywood/phone-3d-after-second-tap.png`
- **What happens now.** The camera frames the park in the lower third; about 40% is empty sky, and the nearest terrain disappears under the sheet. It is also the screen P3-DOLLYWOOD-04 leaves the person on.
- **Why it matters.** Mostly sky.
- **Proposed fix.** Frame the phone 3D camera on the terrain above the sheet.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-17 — The desktop toolbar wraps Search onto a near-empty second row

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:766`; `audits/screens/dollywood/map-typical-desktop-light.png`, `audits/screens/dollywood/search-none-typical-desktop-dark.png`
- **What happens now.** At 1440 px the first row ends with about 100 px of space after Terrain, and Search sits alone on a second row with about 800 px of space. Its "SEARCH" label touches the field's focus ring when focused.
- **Why it matters.** Search alone on a second row.
- **Proposed fix.** Let the toolbar's search flex into the first row at 1440 px.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-SHAPE-3 — The build guide's Listings / Layers / Scale switcher is square underline tabs

- **Area** design system (build guide) · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:2335`; `apps/design.css:465-468`; `audits/evidence/p4/SHAPE/sheet-buttons.png`
- **What happens now.** The side-panel tabs are 262×52 buttons with `border-radius: 0` and a 2 px underline, a Material and web idiom, inside an R20 panel (`template.html:55-57, 250`). The shell uses a rounded `.seg` segmented control (`apps/design.css:465-468`), and F260 a glass pill switch, for the same job.
- **Why it matters.** A web tell, on the app that already scores lowest for layout.
- **Proposed fix.** The Listings/Layers/Scale switcher becomes the shared segmented control.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-TELL-1 — Light themes open the build guide on a near-black frame

- **Area** design system (build guide) · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:6384`; `apps.json:9-10`, `index.html:722`, `index.html:331`, `apps/dollywood.html:2`
- **What happens now.** With a light OS and the System theme, and `hub.js` immediate (scenario C), the build guide shows about 240 ms of dark frames (mean luminance 0.23-0.30) before it settles light (0.545).
- **Why it matters.** It is a flash in the other direction: a black frame in a light house.
- **Proposed fix.** The viewer's loading background follows the theme (--viewer-loading-bg), not a dark frame, for the build guide. (Phase 4 gap row TELL-7)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TELL/flash.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 9's checks.

#### VIS-TYPE-2 — The Dollywood template tells labels from values by ink alone (dt and dd both 13/400; profile stats 12.5/700), and the difference shrinks to 1.62:1 in Midnight

- **Area** design system, all areas · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:1526`; `audits/screens/dollywood/cross-section-typical-ipad-portrait-light.png`
- **What happens now.** Sibling texts with the same family, size, weight and transform differ only in ink: 14 pairs in the build guide and 1 in the park map (Table TYPE-8). The clearest is the key/value list: `dl.kv dt` and `dd` are both 13/400 ui-rounded, with ink `--dim` against `--text`.
- **Why it matters.** Low-vision readers, and anyone in bright park sunlight, lose a distinction carried only by grey levels. In dark palettes it nearly disappears.
- **Proposed fix.** Key/value pairs use --text-label / --text-value (weight and size, not ink alone).
- **How it will be verified.** Rerun `node "audits/tools/phase4/TYPE/colour-only.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-14 — If the display profile loads the file by URL, it is offered Mark done, Reset and Import

- **Area** dollywood · **Type** usability · **Severity** info · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:708`
- **What happens now.** A tap gives the toast "This screen only looks — sign in on a phone to change things." and writes 0 rows. The kiosk has no tile, and `#dollywood` gives a toast, so it cannot normally get here.
- **Why it matters.** The kiosk is offered actions it cannot take.
- **Proposed fix.** Hide Mark done, Reset and Import when !hub.canWrite (info).
- **How it will be verified.** recapture its screens (capture area dollywood) and compare; plus batch 9's checks.

#### P3-DOLLYWOOD-LIVE-14 — Search's "rider height: up to N" filter hides every listing with no height requirement (carousel, train, playgrounds) (from the completeness critic) (pointer to P3-DOLLYWOOD-06)

- **Area** dollywood-live · **Type** bug · **Severity** medium (pointer) · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood-live.md:480`; `apps/dollywood-live.html:1541`, `apps/dollywood.html:1007`, `apps/dollywood-live.html:1007`, `apps/dollywood-live.html:1012`; `audits/evidence/p3/dollywood-live/critic-search-height-36-iphone.png`, `audits/evidence/p3/dollywood-live/verify-critic-search-height-filter-hides-no-requirement-3-1-36-iphone.png`
- **Proposed fix.** Pointer to P3-DOLLYWOOD-06 (one template fix, both exports). (Phase 3: IMP-DOLLYWOOD-LIVE-P11)

#### Improvements with no finding (dollywood)

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). The household kept all of them (`audits/05-decisions.md`, "Features kept or cut"), so each app batch carries its own.

| ID | Improvement | Kind | Delight | Effort | Source | Status |
|---|---|---|---|---|---|---|
| IMP-DOLLYWOOD-I1 | A section-complete moment: a calm check and "Showstreet done — 21 steps" when a section fills (a completion cue for the builder, not a reward system) | idea | 3 | S | `audits/03-apps/dollywood.md:964` | open |

### Batch 10 — Dollywood park map (42)

#### GAP-DOLLYWOOD-LIVE-1 — No Find-My-style arrival or leave alerts

- **Area** dollywood-live · **Type** feature gap · **Severity** medium · **Effort** M · **Batch** 10
- **Verified (step 3).** was medium; skeptics low and medium; tie-break medium. Correction: The claims are accurate. Only the rating is too high: medium should be low, since checking the live map or Family pane is a reasonable workaround and the related defects are filed and rated on their own.
- **Evidence.** `audits/03-apps/dollywood-live.md:687`
- **What happens now.** No Find-My-style arrival or leave alerts (medium). Nothing tells a parent "Mae reached the meeting point" or "Ezra's phone left the park". The only proximity signal is the server's stale-kid push, which barely fires (P2-PWA-02), and the "Meet at <name>" push cannot be sent (P2-PWA-18).
- **Why it matters.** Find My's most useful family feature is missing on park days.
- **Proposed fix.** Arrival and leave alerts for adults: "Mae reached the meeting point", "Ezra's phone left the park" (a push kind on the park-day switch, per-person toggle). (Phase 3: IMP-DOLLYWOOD-LIVE-F3)
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.

#### P2-PWA-18 — "Rally the family" (the "Meet at <name>" push) cannot be triggered from any UI

- **Area** shell / platform · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/02-shell.md:4738`; `apps/dollywood-live.html:1589`, `apps/dollywood.html:1719`, `apps/dollywood-live.html:1440`, `worker/src/index.js:132-139`
- **What happens now.** `rally()` is defined at apps/dollywood-live.html:1589 and apps/dollywood.html:1719. It posts to `POST /api/dollywood/rally`, but nothing calls it. The other "rally" matches in each file are a comment (:1577 / :1707) and the confirm text (:1591 / :1721).
- **Why it matters.** CLAUDE.md ("Rally the family"; Push: "on demand 'Meet at <name>' when an adult rallies the family from the park map") documents the push as working. So does the map repo's README.md:182.
- **Proposed fix.** Add the "Rally the family here" action to the meeting-point bar and the ride card (adults only), calling the existing rally(). (Phase 3: IMP-DOLLYWOOD-LIVE-F1)
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify3-rally-unreachable-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-03 — On a device's first open, the map says you are not sharing though Share my spot is on, and never locates you

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:206`; `apps/dollywood-live.html:1486`, `index.html:459`, `apps/hub.js:334`, `apps/hub.js:334-337`; `audits/evidence/p3/dollywood-live/geo-first-open-iphone.png`, `audits/evidence/p3/dollywood-live/verify-first-open-gps-not-resumed-1-A-first-open.png`
- **What happens now.** `hub.ready` resolves at once because another channel has already been pulled (`apps/hub.js:334-337`). `liveInit` then runs `if(shareOn())startGps()` (`apps/dollywood-live.html:1486`) before the person-scope `share` row arrives, so `shareOn()` is false.
- **Why it matters.** A parent who switched on sharing is told, on the phone they just opened at the park, that only they can see their dot, and the family cannot see them until they tap Find me.
- **Proposed fix.** After the person pull lands, re-check shareOn() and start GPS; the pill never says "not sharing" while Share is on. (Phase 3: IMP-DOLLYWOOD-LIVE-P3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-first-open-gps-not-resumed-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-first-open-gps-not-resumed-1.mjs"`, `node "audits/tools/phase3/dollywood-live/geo.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-04 — After you locate yourself, the meeting-point bar has no walk time and no Go, and does not heal on its own

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:231`; `apps/dollywood-live.html:1484`, `apps/dollywood-live.html:1245`, `apps/dollywood-live.html:1579`, `apps/dollywood-live.html:1256`; `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-1-A-after-place.png`, `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-1-B-after-45s-idle.png`
- **What happens now.** `setMe()` calls `drawMe`, `updLoc`, `renderNear`, `renderFam` and `publish`, but not `renderMeet` (`apps/dollywood-live.html:1245`). `renderMeet` is called only from `loadMeet`, `setMeet` and `clearMeet` (`apps/dollywood-live.html:1579, 1587, 1588`).
- **Why it matters.** The moment after "where am I?" is when a parent wants "how far to the meeting point, and Go". The bar gives neither, with no hint why.
- **Proposed fix.** Re-render the meeting bar on every fix and on placing yourself: walk time and Go at once. (Phase 3: IMP-DOLLYWOOD-LIVE-P6)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-meet-bar-stale-after-place-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-meet-bar-stale-after-place-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-05 — An adult cannot switch on a kid's beacon or set heights until someone else is already sharing

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:256`; `apps/dollywood-live.html:1254`, `apps/dollywood-live.html:1304`, `apps/dollywood-live.html:1307`, `apps/dollywood-live.html:1309`; `audits/screens/dollywood-live/family-kids-empty-ipad-portrait-light.png`, `audits/evidence/p3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-1-A-eli-family-ipad.png`
- **What happens now.** `renderFam()` returns right after the "No one else is sharing right now…" line when there are no other rows (`apps/dollywood-live.html:1304`), before the Kids' beacons block (`apps/dollywood-live.html:1307`) and before `renderKids()` (`apps/dollywood-live.html:1309`), which is its only call site.
- **Why it matters.** The natural time to set up a child's beacon and enter heights is before the family sets off, exactly when nobody is sharing yet. On an ordinary day the seeded heights (43" and 40") cannot be seen or corrected from the map.
- **Proposed fix.** Render the adult beacon and height controls whether or not anyone else is sharing.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-06 — With Share my spot left on, opening the map away from the park publishes a home position, and Home says "At the park"

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:280`; `apps/dollywood-live.html:1486`, `apps/dollywood-live.html:1475`, `apps/dollywood-live.html:1250`, `apps/dollywood-live.html:1170`; `audits/evidence/p3/dollywood-live/geo-far-mom-home-ipad.png`, `audits/evidence/p3/dollywood-live/verify-publish-off-site-1-mom-home-ipad.png`
- **What happens now.** `publish()` writes `loc:<id>` for any GPS fix under 150 m accuracy and never checks `onProperty()` (`apps/dollywood-live.html:1250`, `onProperty` at `apps/dollywood-live.html:1170`). Home's `atPark()` counts every `loc:` row under 4 h old, with no position test (`index.html:872-877`).
- **Why it matters.** For up to 4 hours every Home in the house, the Kitchen iPad included, says a person is "At Dollywood · last seen just now" while they are at home.
- **Proposed fix.** Publish a fix only when it is on the park property (the map's bounds plus a margin); Home's park card ignores off-property rows. (Phase 3: IMP-DOLLYWOOD-LIVE-P9)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-publish-off-site-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-publish-off-site-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-07 — An old fix outside the map frame reads as a live position, with no "Last seen" and no Find me chip

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:304`; `apps/dollywood-live.html:1250`, `apps/dollywood-live.html:1478`, `apps/dollywood-live.html:1270-1274`, `apps/dollywood-live.html:1264`; `audits/evidence/p3/dollywood-live/states-arriving.png`, `audits/evidence/p3/dollywood-live/states-far.png`
- **What happens now.** In `updLoc()`, the "arriving" and "far" branches (`apps/dollywood-live.html:1270-1274`) never consult the computed `stale` flag (`apps/dollywood-live.html:1264`); only the in-frame branch does (`apps/dollywood-live.html:1279`).
- **Why it matters.** Reopening the map the next morning, a parent sees "At Dollywood — the parking lots" with a precise "± 30 ft", as if they were arriving now.
- **Proposed fix.** Give an old fix outside the frame the same stale treatment as inside: "Last seen N ago" and a Find me chip. (Phase 3: IMP-DOLLYWOOD-LIVE-P7)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-out-of-frame-stale-reads-live-1.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-out-of-frame-stale-reads-live-2.mjs"`, `node "audits/tools/phase3/dollywood-live/states.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-08 — Tapping a restroom, first-aid, AED or other amenity marker does nothing

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:328`; `apps/dollywood-live.html:1571-1573`, `apps/dollywood-live.html:1566`, `apps/dollywood-live.html:844`, `apps/dollywood-live.html:1574`; `audits/evidence/p3/dollywood-live/verify-amenity-tap-dead-1-after-tap.png`, `audits/evidence/p3/dollywood-live/verify-amenity-tap-dead-1-control-showAmen.png`
- **What happens now.** `drawAmen` writes `data-pick="a:<kind>:<x>:<y>"`. `pick()` splits it with a two-part destructure, `const [k,v]=elm.dataset.pick.split(':')` (`apps/dollywood-live.html:844`), so `v` is only the kind and x and y come out undefined; no amenity matches, and `showAmen` (`apps/dollywood-live.html:1574`) is never reached.
- **Why it matters.** A parent tapping the restroom or first-aid marker nearest a child gets nothing, and an AED location can only be seen, not opened.
- **Proposed fix.** Pass the full kind:x:y id to showAmen so amenity markers open their card. (Phase 3: IMP-DOLLYWOOD-LIVE-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-amenity-tap-dead-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-amenity-tap-dead-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-09 — Every tap of the compass jumps the view to the Entrance, and the first tap does not rotate anything

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:352`; `apps/dollywood-live.html:1246`, `apps/dollywood-live.html:1398`, `apps/dollywood-live.html:1029`, `apps/dollywood.html:1029`; `audits/evidence/p3/dollywood-live/functional-compass-after.png`, `audits/evidence/p3/dollywood-live/measure-after-compass-ipad.png`
- **What happens now.** `#lv-north` toggles the hidden `#l-upright` checkbox and fires its change handler (`apps/dollywood-live.html:1467`), which sets the rotation and then fits `SEC[curSec]` (`apps/dollywood-live.html:1029`).
- **Why it matters.** A parent tapping the compass to get their bearings is thrown to the entrance and parking area, away from where they were looking and from the family's markers.
- **Proposed fix.** The compass re-orients the current view in place (template :1029 upright handler) and never jumps to the Entrance.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-compass-jumps-to-entrance-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-compass-jumps-to-entrance-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-10 — On iPhone the pill cuts off the location-denied instructions before "or use Set my spot" (from the visual check)

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:377`; `apps/dollywood-live.html:399`, `apps/dollywood-live.html:516-517`, `apps/dollywood-live.html:613`, `apps/dollywood-live.html:1404-1405`; `audits/evidence/p3/dollywood-live/denied-adult-iphone.png`, `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png`
- **What happens now.** The pill title and subtitle are single lines with an ellipsis (`apps/dollywood-live.html:399`), and so are the meeting bar's name and meta (`apps/dollywood-live.html:516-517`). There is no title attribute and no way to expand either (`apps/dollywood-live.html:613, 621`). On a 430 px iPhone:
- **Why it matters.** At the moment location fails in the park, a parent reads half an instruction and sees no way forward, and the "or use Set my spot" escape route is never shown.
- **Proposed fix.** The denied pill wraps to two lines on phones (or opens a short sheet) and keeps the Set my spot action visible. (Phase 3: IMP-DOLLYWOOD-LIVE-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-12 — Switching a kid's beacon off while the kid's map is open does not hide the kid: the kid's phone republishes its spot and the last position stays (from the completeness critic)

- **Area** dollywood-live · **Type** bug (security) · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:429`; `apps/hub.js:342`, `apps/dollywood-live.html:1308`, `apps/dollywood-live.html:694`, `apps/dollywood-live.html:1483`; `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-off-republished-1-2-A-mom-family-ipad.png`
- **What happens now.** The parent's switch writes `kidshare:<kid> = false` and tombstones `loc:<kid>` (`apps/dollywood-live.html:1308`). The kid's page still has `kidshare` true in its cache until its next pull, so `publish()`, which checks only `shareOn()` (`apps/dollywood-live.html:694, 1250-1253`), writes a fresh `loc:<kid>` on the next fix, and that later …
- **Why it matters.** A parent's deliberate choice to stop showing a 4- or 5-year-old's position is undone without any sign: the switch reads off while the child's last spot stays on every phone, the Kitchen iPad's Home card and chat for hours.
- **Proposed fix.** When kidshare:<kid> turns false, the kid's open map stops watchPosition and publishes a tombstone for loc:<kid>; the parent's map drops the marker at once. (Phase 3: IMP-DOLLYWOOD-LIVE-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/critic-kid-beacon.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-off-republished-1-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-off-republished-1-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-13 — Switching a kid's beacon on does nothing on the kid's open map until it is closed and reopened, while the parent's switch says it is sharing (from the completeness critic)

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:455`; `apps/dollywood-live.html:1307`, `apps/dollywood-live.html:693-694`, `apps/dollywood-live.html:1486`, `apps/dollywood-live.html:1485`; `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1-kiara-open.png`, `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1-kiara-reopened.png`
- **What happens now.** `VIEW_ONLY()` and `shareOn()` read `kidshare` live (`apps/dollywood-live.html:693-694`), so after the pull the kid's page is no longer view-only and `shareOn()` is true.
- **Why it matters.** At the park, a parent switches the beacon on for a child who already has the map open and expects the child's dot; nothing appears, and both switches say it is sharing.
- **Proposed fix.** When kidshare:<kid> turns true, the kid's open map starts locating and publishing on the next onChange.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1.mjs"`, `node "audits/tools/phase3/dollywood-live/critic-kid-beacon.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-2.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-1 — Family marker labels pile into an unreadable stack with long names

- **Area** dollywood-live · **Type** visual · **Severity** medium · **Effort** M · **Batch** 10
- **Verified (step 3).** was medium; skeptics medium (partly) and medium (partly). Correction: The title and text blame long names, but the collision also happens with the real short names. In the park seed Ezra's marker hides Elizabeth's label and marker on iPad and iPhone, so exposure is wider than stated.
- **Evidence.** `audits/03-apps/dollywood-live.md:644`; `apps/dollywood-live.html:1219-1221`; `audits/screens/dollywood-live/map-overflow-ipad-portrait-light.png`, `audits/screens/dollywood-live/meet-overflow-iphone-pwa-light.png`
- **What happens now.** `drawFam` draws each name pill with no collision handling (`apps/dollywood-live.html:1219-1221`), unlike the ride labels. In the overflow seed 4-5 long-name pills stack around Thunderhead and the Great Tree Swing ("Kiara Seraphina Josephine" covers "Ezra Bartholomew Anderson"), and a guest's label is clipped at the …
- **Why it matters.** Long names pile into an unreadable stack.
- **Proposed fix.** Family marker labels collide-avoid like ride labels, and collapse to initials when they overlap. (Phase 3: IMP-DOLLYWOOD-LIVE-P15)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### GAP-DOLLYWOOD-LIVE-2 — No wait-time history or trend

- **Area** dollywood-live · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:688`; `apps/dollywood-live.html:1502`
- **What happens now.** No wait-time history or trend (low). Thrill-Data shows whether a line is growing; here each wait is a single number (`apps/dollywood-live.html:1502`).
- **Why it matters.** Whether a line is growing decides where to go next.
- **Proposed fix.** Show a trend arrow per ride from the last few waits the Worker already fetches (60 s cache). (Phase 3: IMP-DOLLYWOOD-LIVE-F4)
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.

#### GAP-DOLLYWOOD-LIVE-4 — Offline is the precached page and rasters plus the last pull

- **Area** dollywood-live · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:690`; `sw.js:16`, `apps/dollywood-live.html:696`, `sw.js:15`, `scripts/bump-sw.mjs:18`
- **What happens now.** Offline is the precached page and rasters plus the last pull (low). The page and four rasters (relief, relief_soft, slope, illustrated_lo) are precached (`sw.js:16`); the Satellite style's `aerial.jpg` (`apps/dollywood-live.html:696`) is not, by design (`sw.js:15`, `scripts/bump-sw.mjs:18`), so Satellite has no image offline unless it was opened online earlier (not tested). Family positions are whatever the last pull brought, and there are no wider tiles.
- **Why it matters.** Signal is patchy in the park.
- **Proposed fix.** Say what works offline in the park ("Map and last waits available offline; live waits need signal").
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-11 — A waits-feed ride whose name differs from the listing (the Dollywood Express) silently shows no wait

- **Area** dollywood-live · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:405`; `apps/dollywood-live.html:1493`, `apps/dollywood-live.html:1501-1502`, `apps/dollywood-live.html:1494`, `apps/dollywood-live.html:1493-1494`; `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/evidence/p3/dollywood-live/verify-waits-name-match-drops-1-seeded-waits-iphone.png`
- **What happens now.** `loadWaits` attaches a feed ride only when its normalised name (`wnorm`, `apps/dollywood-live.html:1493`) equals an attraction listing's exactly (`apps/dollywood-live.html:1501-1502`), and the alias table `WALIAS` is empty (`apps/dollywood-live.html:1494`).
- **Why it matters.** The family's train ride shows no posted wait, with no sign that one exists.
- **Proposed fix.** Alias the waits feed's renamed rides (the Dollywood Express) in the name table and log unmatched feed names to the console once. (Phase 3: IMP-DOLLYWOOD-LIVE-F2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-waits-name-match-drops-1.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-waits-name-match-drops-2.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-15 — After the waits feed fails, a map left open keeps showing the last waits as current, past the app's own 6 h limit (from the completeness critic)

- **Area** dollywood-live · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:507`; `apps/dollywood-live.html:1400`, `apps/dollywood-live.html:1504`, `apps/dollywood-live.html:1507-1510`, `apps/dollywood-live.html:1554-1560`; `audits/evidence/p3/dollywood-live/critic-waits-stale-7h-iphone.png`, `audits/evidence/p3/dollywood-live/verify-critic-waits-stale-while-open-4-1-A-fresh.png`
- **What happens now.** `loadWaits` applies the 6 h cache limit only inside `if(!WAITS.at)` (`apps/dollywood-live.html:1504`), that is, only when nothing has loaded since the map opened. After one success, each failure sets `WAITS.err` and keeps `WAITS.by`, however old.
- **Why it matters.** On a patchy park network, the Next-ride hero can steer the family to a ride using the morning's waits.
- **Proposed fix.** Waits older than 6 h are dropped everywhere (chips, hero, Nearby rows, directions bar), not only in the list; the 60 s retry keeps running while open. (Phase 3: IMP-DOLLYWOOD-LIVE-P13)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-critic-waits-stale-while-open-4-1.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-waits-stale-while-open-4-2.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-16 — A kid with his beacon on gets a "Share my spot" switch that cannot be switched off: it snaps back on and his spot is republished (from the completeness critic)

- **Area** dollywood-live · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:532`; `apps/dollywood-live.html:1300-1301`, `apps/dollywood-live.html:693`, `apps/dollywood-live.html:1310-1313`, `apps/dollywood-live.html:694`; `audits/evidence/p3/dollywood-live/critic-kid-share-switch-ezra-iphone.png`, `audits/evidence/p3/dollywood-live/verify-critic-kid-share-switch-noop-5-1-b-after-untick.png`
- **What happens now.** `renderFam` shows the Share switch to any writer who is not view-only (`canShare`, `apps/dollywood-live.html:1300-1301`), and a kid whose beacon is on is not view-only (`apps/dollywood-live.html:693`). Unticking runs `setShare(false)`: it writes person `share=false` and tombstones `loc:<kid>` (`apps/dollywood-live.html:1310-1313`).
- **Why it matters.** The switch looks as if the child can stop sharing, briefly deletes his marker for the parents, then quietly republishes it.
- **Proposed fix.** For a kid the beacon is the parent's control: hide the Share switch and show "Your beacon is on — a grown-up can switch it off".
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-critic-kid-share-switch-noop-5-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-kid-share-switch-noop-5-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-17 — On a location denial the error handler bypasses the app's designed "denied" state, so no Set my spot chip appears until the app is backgrounded (from the completeness critic)

- **Area** dollywood-live · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:557`; `apps/dollywood-live.html:1404-1405`, `apps/dollywood-live.html:1408`, `apps/dollywood-live.html:1267`, `apps/dollywood-live.html:1257-1258`; `audits/evidence/p3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-1-eli-iphone-pwa-denied.png`, `audits/evidence/p3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-1-eli-iphone-pwa-after-visibility.png`
- **What happens now.** For error code 1 the `watchPosition` handler writes "Location is off for this site" and the long Settings hint into `#loc-sec` and `#loc-acc`, then returns without calling `updLoc()` (`apps/dollywood-live.html:1404-1405`).
- **Why it matters.** At the moment location fails in the park, the pill offers no action, although the app has a designed state for exactly this. On an iPhone the Nearby pane's Set my spot button sits just below the fold of the peek sheet.
- **Proposed fix.** The geolocation error path sets gpsErr and calls updLoc(), so the designed denied state and its Set my spot chip show at once. (Phase 3: IMP-DOLLYWOOD-LIVE-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-18 — While the map stays open, the meeting point never expires and its "set by … N min ago" age never updates (from the completeness critic)

- **Area** dollywood-live · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:582`; `apps/hub.js:292-298`, `apps/dollywood-live.html:1475-1476`, `apps/dollywood-live.html:1579`, `apps/dollywood-live.html:1256`; `audits/evidence/p3/dollywood-live/critic-meet-expiry-iphone.png`, `audits/evidence/p3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-1-C-plus2h10.png`
- **What happens now.** `loadMeet` applies the 2 h expiry and calls `renderMeet`, which computes the age with `agoOf` (`apps/dollywood-live.html:1579, 1583-1584`). Both run only at start and from `loadFam` when another device changes a family row (`apps/dollywood-live.html:1256, 1483`).
- **Why it matters.** "12 min ago" on a 2-hour-old meeting point can send a parent to a place the family left long ago.
- **Proposed fix.** Re-run loadMeet() on the 30 s timer and on becoming visible, so the age updates and the pin drops at 2 h.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P4-ACCENT-06 — With north-up pressed, the compass fills with the person's `--accent-deep`: its 9 px red "N" drops to 1.0-2.45:1 for every profile, and its red needle to 1.0-1.5:1 in dark

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/04-design-system.md:5591`
- **What happens now.** The fill wins on specificity. `[data-flavor=live] button[aria-pressed=true]{background:var(--accent-deep)}` (template `:225`, specificity 0,2,1) beats `.lv-north`'s glass (`:417`, 0,1,0) once the button is pressed (`:1595`). The glyphs are fixed red.
- **Why it matters.** North-up is the orientation aid on a rotated park map. When it is switched on, its own label all but vanishes.
- **Proposed fix.** The pressed compass keeps its needle and "N" at ≥ 3:1 (a --map-north mark on a neutral fill).
- **How it will be verified.** Rerun `node "audits/tools/phase4/ACCENT/verify-park-north-n-on-accent-2.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P4-ICON-04 — The map compass's north needle is a fixed `#FF6B4A`: 2.24-2.75:1 in the three light palettes

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/04-design-system.md:2878`; `apps/dollywood-live.html:620`, `apps/dollywood.html:620`, `apps/dollywood.html:313`; `audits/screens/dollywood-live/amenity-tap-typical-iphone-pwa-light.png`
- **What happens now.** The markup. The north half of `#lv-north` is `fill="#FF6B4A"` as a literal attribute (`apps/dollywood-live.html:620`; identical at `apps/dollywood.html:620`, from `template.html:620`). It sits on the cream glass button (`var(--lv-glass-soft)`, `:417`). Measured:
- **Why it matters.** It is the colour cue for north on a rotated map, and it fails in the normal daylight themes. CLAUDE.md allows hex only for map colours, and this is control chrome.
- **Proposed fix.** The compass needle reads --map-north (danger graphic, ≥ 3:1). (Phase 4 gap row ICON-10)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ICON/measure.mjs"`, `node "audits/tools/phase4/ICON/report.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P4-MOTION-03 — Park map on a park day: four infinite pulses keep the main thread 17-28 % busy while the map sits open; the two `box-shadow` rings drive it

- **Area** design system (park map) · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/04-design-system.md:3994`; `apps/dollywood-live.html:1475`, `apps/dollywood-live.html:400-401`, `apps/design.css:611-613`
- **What happens now.** Four infinite animations run while the person is located and sharing:
- **Why it matters.** On a park day the map is open on phones for hours, with the screen held on. A constant 17-28 % main-thread load drains batteries when the family most needs them.
- **Proposed fix.** Park-map pulses stop after three cycles (--ambient-iterations) and animate transform/opacity, not box-shadow. (Phase 4 gap row MOTION-9)
- **How it will be verified.** Rerun `node "audits/tools/phase4/MOTION/park-live.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P4-SHAPE-03 — Park map: five control rules under 44 px beyond the five P3 recorded, namely the sheet handle (22), About the data (29), the layer-toggle rows (29), the kids' height stepper (40×40) and the directions-bar buttons (40)

- **Area** design system (park map) · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/04-design-system.md:2107`; `apps/dollywood-live.html:1473`, `apps/dollywood-live.html:1301`; `audits/screens/dollywood-live/meet-overflow-iphone-pwa-light.png`
- **What happens now.** The investigator's count. The rig found 18 interactive selectors under 44 in the park map's own document, 19 with an inline link, measured by element box.
- **Why it matters.** The park map is used one-handed while walking, and the small controls are the ones most often missed. The handle is how the sheet is opened.
- **Proposed fix.** The five further park-map controls (handle, About, layer rows, heights, …) at var(--tap). (Phase 4 gap row SHAPE-10)
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/verify-parkmap-targets-18-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-1 — The location-denied state is incomplete, and a kid gets adult "Settings › Safari" wording

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** S · **Batch** 10
- **Verified (step 3).** was medium; skeptics low and low. Correction: The facts are right, but medium is inflated. The wording is correct and actionable for the adult who is always with a 5-year-old at the park. A pre-reader is not helped by any wording, and nothing is broken or misleading, so the rating should be low.
- **Evidence.** `audits/03-apps/dollywood-live.md:613`; `apps/dollywood-live.html:1404-1405`, `apps/dollywood-live.html:1267`; `audits/evidence/p3/dollywood-live/denied-adult-iphone.png`, `audits/evidence/p3/dollywood-live/denied-kid-iphone.png`
- **What happens now.** The missing designed state and its Set my spot chip were filed here first; the completeness critic reclassified that part as a bug against the code's own design, and it is now P3-DOLLYWOOD-LIVE-17 (confirmed 2/2). What stays here is the wording.
- **Why it matters.** A kid gets adult Settings instructions.
- **Proposed fix.** Kid-appropriate denied wording ("Ask a grown-up to turn on location") with a picture; adults get the steps. (Phase 3: IMP-DOLLYWOOD-LIVE-P4)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-2 — A view-only kid is told to tap a button that is hidden for her

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:618`; `apps/dollywood-live.html:1290`, `apps/dollywood-live.html:1485`, `apps/dollywood-live.html:1250`; `audits/evidence/p3/dollywood-live/states-kid-nearby.png`, `audits/screens/dollywood-live/kid-nearby-typical-desktop-light.png`
- **What happens now.** Nearby's empty text reads "Find yourself first: tap ◎, or use Set my spot." (`apps/dollywood-live.html:1290`), but ◎ is hidden for view-only users (`apps/dollywood-live.html:1485`). Set my spot is still offered to her;
- **Why it matters.** The kid is told to tap a hidden button.
- **Proposed fix.** View-only kids get "A grown-up can show where you are" instead of "tap ◎".
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-4 — The build guide's engineering panels leak into the family park map

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** M · **Batch** 10
- **Verified (step 3).** was medium; skeptics low and low. Correction: The facts are right, but the severity is inflated. The only misleading element, the height select, is P3-DOLLYWOOD-LIVE-14. What remains is clutter in an optional card and in secondary panes, so it is low.
- **Evidence.** `audits/03-apps/dollywood-live.md:625`; `apps/dollywood-live.html:1464`, `apps/dollywood-live.html:936`; `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png`, `audits/screens/dollywood-live/search-query-typical-iphone-safari-dark.png`
- **What happens now.** The ride card's Track button opens the guide's coaster survey card: "Mapped track 936 m" (metric beside feet elsewhere), "Ground under track 1053–1098 ft", "In Planet Coaster 2: Wooden coaster; keep the station fly-through", an OpenStreetMap disclaimer and an elevation chart.
- **Why it matters.** Engineering detail crowds the family map.
- **Proposed fix.** The park map hides the build guide's engineering panels (coaster survey, OSM disclaimer, metric track data); Track shows a family-friendly ride card. (Phase 3: IMP-DOLLYWOOD-LIVE-P11, IMP-DOLLYWOOD-LIVE-P16)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-5 — Kid mode needs reading

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** M · **Batch** 10
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: Waits rows are not left without a reason: each one prints the ride's height requirement in its subline ('55"', '48"'). What is missing is only the 'needs N"' chip that Nearby and Search show. The fade is not kid mode either.
- **Evidence.** `audits/03-apps/dollywood-live.md:630`; `apps/dollywood-live.html:1532`; `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/kid-typical-ipad-portrait-dark.png`
- **What happens now.** A pre-reader's pill shows "Location is off for this site / Allow Location …" (beacon on) or "Rides and the family, live / Kiara · just looking".
- **Why it matters.** Kids cannot use the map without reading.
- **Proposed fix.** Kid mode: picture-first pill and Waits (ride art, a height badge "too short" with an icon), no reading needed. (Phase 3: IMP-DOLLYWOOD-LIVE-P10)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-6 — The waits error state says the same thing twice

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:635`; `apps/dollywood-live.html:1526`, `apps/dollywood-live.html:1522`; `audits/screens/dollywood-live/waits-error-iphone-pwa-light.png`, `audits/evidence/p3/dollywood-live/waits-error-iphone.png`
- **What happens now.** Under the illustrated pin the pane says "Could not reach the wait-time feed. It retries every minute." (`apps/dollywood-live.html:1526`) and further down "Wait times are not available right now." (`apps/dollywood-live.html:1522`).
- **Why it matters.** The same message twice.
- **Proposed fix.** One waits error line, with when it last worked.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-7 — Kids' heights take one tap per inch from 36

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:638`; `apps/dollywood-live.html:1547-1548`
- **What happens now.** With no stored height the stepper starts from 36 and moves one inch per tap, with one family write per tap (`apps/dollywood-live.html:1547-1548`). Entering Ezra's measured 43" is 7 taps and 7 writes; 48" is 12. At the park that is a parent holding a child with one hand. A number field or a picker would take one entry.
- **Why it matters.** Seven taps and seven writes for one height.
- **Proposed fix.** Heights: a number field (or a ruler slider) that starts at the kid's last value, one write when done. (Phase 3: IMP-DOLLYWOOD-LIVE-P14)
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-2 — The meeting-point label collides with pucks and is clipped

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:647`; `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png`
- **What happens now.** "Meet · The Wildwood Tree" is overdrawn by the Ezra, Elizabeth and Mae pucks and cut to "Meet · The Wildw…ree" on iPhone; a long name runs off the right edge under the buttons ("Meet · TimeSaver & Special Experiences Res").
- **Why it matters.** The label is overdrawn and clipped.
- **Proposed fix.** The meeting-point label gets collision handling and a max width with ellipsis. (Phase 3: IMP-DOLLYWOOD-LIVE-I1)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-3 — The ride card's ABOUT is often empty, and Track opens the raw survey card

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:650`; `apps/dollywood-live.html:1447`, `apps/dollywood-live.html:936`, `apps/dollywood-live.html:113-114`, `apps/dollywood-live.html:984`; `audits/screens/dollywood-live/ride-card-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/coaster-card-typical-desktop-dark.png`
- **What happens now.** The park-day ride card folds bookkeeping into an About section (`apps/dollywood-live.html:1447`) that often holds only the dollywood.com link. Track reuses the build guide's coaster card with no sticky head or action row; on phones the ride card covers the lower map, including Whole park and Find me.
- **Why it matters.** Empty sections and a raw survey card.
- **Proposed fix.** Hide an empty ABOUT section; Track opens a sticky-headed card. (Phase 3: IMP-DOLLYWOOD-LIVE-P16)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-4 — On iPad portrait the coaster card covers the meeting bar and runs over the search field

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:654`; `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png`
- **What happens now.** The card's top edge hides "set by Mae 12 min ago" and half of Done; its "Zoom to it" area runs into the Search input behind it.
- **Why it matters.** The card covers the meeting bar.
- **Proposed fix.** On iPad portrait the coaster card is a sheet below the meeting bar, never over it or the search field.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-5 — Five control rules are under the 44 px minimum

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:657`; `apps/dollywood-live.html:432`, `apps/dollywood-live.html:517`, `apps/dollywood-live.html:522`, `apps/dollywood-live.html:503`; `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/screens/dollywood-live/meet-overflow-iphone-pwa-light.png`
- **What happens now.** Measured: Set my spot 96×36 (`measure.json` `B_targets`). The checker estimated from 1× captures the meeting bar's Done at about 33 px, the Nearby / Waits segment at about 32 and the filter chips at about 36.
- **Why it matters.** Small targets outdoors, one-handed, in the sun.
- **Proposed fix.** All ten controls under 44 px move to var(--tap) (Set my spot, Done, the segment, chips, handle, About, layer rows, heights). (Phase 3: IMP-DOLLYWOOD-LIVE-P12)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-6 — Seven :hover rules are not behind a fine-pointer query

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:661`; `apps/dollywood-live.html:25`
- **What happens now.** `button`, `.oi`, `.info a.btn`, `.bitem`, `.pop a.btn`, `.offm` and `.used a` hover rules at `apps/dollywood-live.html:25, 65, 77, 100, 124, 134, 192`; `hoverGuarded 0`. On touch a tapped button can keep its hover look.
- **Why it matters.** Tapped buttons keep a hover look on touch.
- **Proposed fix.** Put the seven :hover rules behind @media (hover: hover) and (pointer: fine).
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-8 — The wait tiles' "MIN" label is 9.5 px white on saturated bands, failing 4.5:1 on green and amber

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:667`; `apps/dollywood-live.html:500`, `apps/dollywood-live.html:501`; `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/screens/dollywood-live/waits-typical-desktop-dark.png`
- **What happens now.** `.wtile small` is 9.5 px (`apps/dollywood-live.html:500`), below the 11 px floor. White on the short band `#1E8A4C` is 4.38:1 and on the mid band `#C77A00` 3.38:1 (`apps/dollywood-live.html:501`); the 20 px numerals pass 3:1 on every band. The bands are saturated literals, not house pastels with a deep ink.
- **Why it matters.** The label fails contrast in the sun.
- **Proposed fix.** Wait tiles: the MIN label at --fs-caption2 (11 px) in --wait-*-ink on the pastel wait fills (--wait-short/-medium/-long), gated at 4.5:1. (Phase 3: IMP-DOLLYWOOD-LIVE-P17)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/vischeck-contrast.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-9 — An underlined text link on the ride card

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:670`; `apps/dollywood-live.html:491`; `audits/screens/dollywood-live/ride-card-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/ride-card-typical-ipad-landscape-dark.png`
- **What happens now.** "dollywood.com ↗" is underlined in light and dark; `.lv-link` sets no `text-decoration` (`apps/dollywood-live.html:491`).
- **Why it matters.** A web-style link.
- **Proposed fix.** The ride card's link becomes a button-styled row (no underline) with an external-link icon.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-10 — Desktop and iPad-landscape layout: 1,400 px rows and a visible edge to the map art

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:673`; `audits/screens/dollywood-live/waits-typical-desktop-dark.png`, `audits/screens/dollywood-live/map-typical-desktop-light.png`
- **What happens now.** At 1440 px the Waits rows and the meeting bar span the full width, with the facts at opposite edges. The illustrated art ends in a hard vertical edge at about x 160 on desktop and x 82 on iPad landscape, with flat green beyond.
- **Why it matters.** Stretched rows and a hard edge to the art.
- **Proposed fix.** Cap row widths at --col-narrow on wide screens and fill the map edge with the terrain colour (or crop the art).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-11 — Placing mode shows a cut-off sliver of sheet buttons under the tabs

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:676`; `audits/screens/dollywood-live/placing-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/placing-typical-iphone-safari-dark.png`
- **What happens now.** Evidence: `audits/screens/dollywood-live/placing-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/placing-typical-iphone-safari-dark.png`, `audits/screens/dollywood-live/placing-typical-ipad-portrait-light.png`.
- **Why it matters.** A cut-off row of buttons.
- **Proposed fix.** In placing mode hide the sheet completely instead of leaving a sliver.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-12 — The illustrated map is one low-resolution raster that goes soft at ride zoom

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** M · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:678`; `audits/screens/dollywood-live/ride-card-typical-ipad-landscape-dark.png`, `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png`
- **What happens now.** The only illustrated asset is `apps/dollywood/illustrated_lo.jpg` (403,725 bytes; no higher-resolution illustrated file in `apps/dollywood/`). Zoomed on a ride on iPad landscape, the art is visibly blurred beside the crisp vector chips.
- **Why it matters.** The art goes soft when zoomed.
- **Proposed fix.** Export a 2x illustrated raster (or tiles) for ride zoom, within the precache size limit (scripts/bump-sw.mjs skip list if large).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-13 — Whole park on iPhone leaves the park small, and the full-height sheet ghosts over the meeting bar

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:681`; `audits/screens/dollywood-live/whole-park-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/map-loading-iphone-pwa-light.png`
- **What happens now.** Whole park leaves empty green bands above and below the park (about 150 px under the meeting bar, per the checker). At full height, the sheet slides over the meeting bar, which shows through.
- **Why it matters.** The park is small and the bar ghosts through.
- **Proposed fix.** Whole park fits the park to the visible area above the sheet on iPhone; the full sheet hides the meeting bar behind a solid material.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### GAP-DOLLYWOOD-LIVE-3 — No park hours, showtimes or dining

- **Area** dollywood-live · **Type** feature gap · **Severity** info · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:689`
- **What happens now.** No park hours, showtimes or dining (info). NOT FOUND IN CODE; reasonably out of scope for a family hub.
- **Why it matters.** Info only.
- **Proposed fix.** Out of scope (info): link to dollywood.com for hours and shows; no change planned. (Phase 3: IMP-DOLLYWOOD-LIVE-I2)
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.
