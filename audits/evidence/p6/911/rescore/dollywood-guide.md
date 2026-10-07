# Phase 4 scorecard: the Dollywood build guide row after batch 9, and the re-priced dollywood-template base

**Independent judge.** Method: `audits/04-design-system.md` scorecard (bases + written rules TYP-1 … DEL-4, net per dimension clamped to ±2, 0.5 steps, row = mean of 11), applied as in `audits/handoff-cloud/scratch/rescore-8/rescore.md` and `audits/evidence/p6/6/rescore.md`.

**Starting row.** The guide's last recorded row is the batch 1 rescore (`audits/evidence/p6/1/rescore.md`): **4.1** (45/11).

**The base.** This rescore re-prices the shared `dollywood-template` base once, from the evidence, as batch 1 re-priced `hearth-shared`. The same re-priced base is applied to the park map; see the dated addendum in `b910/rescore-park/rescore.md`. Typography and Shape stay provisional (no backdrop blur in the rig, fallback fonts).

## Code and captures

**Code snapshot.** I copied the hub-audit working files and the template at 02:45 on 7 Oct (local), converted them to LF, and saved them in `rescore-guide/wt`. MD5 checksums:

| File | MD5 |
|---|---|
| `apps/dollywood.html` | `dfdeb304…` |
| `apps/dollywood-live.html` | `95a0f50b…` |
| `template.html` | `4a3f0c8a…` |

Both exports were written at 02:39:05.

**The after captures are the final code.**
- **Build guide:** `b910/wb/cap2/dollywood/` (432 files, captured 02:38-02:43). I recaptured 10 states from my snapshot (`rescore-guide/mycap/`): map and steps × typical and overflow × iPhone PWA, iPhone Safari and iPad portrait. All 10 differ from cap2 by **0.000 %** of pixels.
- **Park map:** I used **`wc/cap6`** (captured 02:49-03:09, after the 02:39 export), not cap5. 28 of my snapshot captures differ from cap6 by **0.000 %**. They differ from cap5 by 0.008-0.039 %, so cap5 predates the last export.

**Before:** `…/scratchpad/cap910-before/dollywood/` (432 files, pre-batch code 6688e17).

**Pairs.** 27 guide pairs are in `rescore-guide/pairs/` (`comp.mjs`):
- **Map:** typical on iPhone light, iPad portrait light, iPad landscape dark and desktop light; overflow on iPhone dark.
- **Steps:** typical on iPhone light, iPad portrait dark, iPad landscape dark and desktop light; overflow on iPad portrait.
- **Other screens:** view-3d (iPhone), progress-menu (iPhone), map-loading and steps-loading, search (iPad portrait), search-none, listings dark, cross-section-cut (iPhone), measure dark, next-unfinished, step-on-map (iPad landscape), section (iPad landscape), coaster dark, help, layers, scale, view-menu, building (desktop dark).

**Opened at full size:** `steps-typical-iphone-pwa-light`, `steps-overflow-iphone-pwa-light`, `steps-typical-ipad-portrait-light`, and the measure rig's `shots/forest/dollywood/steps-typical-ipad-portrait-light.png`.

**Tools, run by me on the snapshot (all exit 0, outputs in `wt/out/`).**
- TOK/literals, TYPE/code-scan, ICON/static, TYPE/hidden-text (`--only dollywood,dollywood-live`).
- The measurement rig on both areas, fresh: guide 409/409 jobs, park 642/642, then `aggregate.mjs`.
- SHAPE/analyze, GLASS/layers, MOTION/press, MOTION/cls lat150, SHAPE/verify, TELL/tells-webkit (both areas), SHAPE/verify-parkmap-targets-18-1.

**Before numbers:** `audits/evidence/p6/8/p4tools/out` and `p6/8/measure` (batch 8's final run on 6688e17, the pre-batch template).

| Tool, build guide | Before | After |
|---|---|---|
| TOK/literals | colour 15, font size 38, weight 10, spacing 75 (31 exact), radius 15, target 29 | colour 8, font size 6, weight 0, **spacing 2**, radius 3, target 6; 0 mixed units (was 25) |
| TYPE/code-scan | token 2, clamp/calc 143, px 8, under-11 2 | **token 157**, clamp/calc 6, px 2, under-11 0 |
| TYPE/hidden-text (SVG and pseudo text, effective size) | P4-TYPE-01: section names 6.1 px on the iPhone, listing numbers 6.8, contour heights 9.5 | **minimum effective 11 px** on every measured screen (map, cross-section, steps; iPhone and iPad) |
| ICON/static | 0 sprite uses; 53 glyphs (× ↗ ◎ ⌖ ⚑ ✚ ♥ ❓ ✈ ⊘ ◔ ▾ …); 7 emoji | **27 sprite uses**; 33 glyphs, all text (× in sizes, ± ft, the "+ −" key names in the shortcuts help, … in "Loading…"); 2 "emoji" are ® ™ inside a regex |
| Measure: failing text (Hearth light / dark / named palettes) | 143 / 142 / 27-53 | 57 / 58 / 0 (Forest 1). Every remaining case is either the loading state's dimmed steps (`map-loading-ipad-portrait`, transient and disabled) or the hidden, fading sticky-bar "Mark done" in Forest (the card's own button shows at full contrast in the same shot). |
| Measure: text under 11 px | 0 | 0 |
| Measure: information graphics and icons below 3:1 | 0 / 0 | 0 / 0 |
| Measure: small target selectors | 35 on the phone (VIS-DOLLYWOOD-2) | **0** of 32,207 measured |
| MOTION/press | 14/16 | 16/24 (more controls; 4 press signatures) |
| MOTION/cls lat150 | iPad 37 landmark moves, max 945 px; iPhone 18, max 138 | **0 moves, CLS 0** on both |
| SHAPE/analyze | macro 4 px grid 83.5 %; large radii on tokens 94.1 %; 1 off-concentric pair | **96.8 %**; 94.6 %; 3 off-concentric pairs (sticky Next, phone search field, phone Cancel) |
| GLASS/layers | content live glass on 196 of 409 jobs (48 %) | **13 jobs (3 %)**, all of them "Back to map", a floating button over the 3D view (policy call 2) |
| TELL/tells-webkit | (not run on the guide before) | 56 controls, none selectable, no double-tap selection, no ring after a tap |

**Not run:** contrast across every household profile (the rig uses Eli and the kids), DARK/art-dark, MOTION idle and reduced-motion, a Tab walk.

## The re-priced `dollywood-template` base (done once, applied to both rows)

Batch 1 re-priced `hearth-shared` only for "Against" items that were FIXED and visible. I apply the same test.

Batches 9 and 10 changed the one template both exports are built from: one CSS, the shared `ic()` sprite and the shared controls. So the evidence below is the same code in both files. Code-scan and TOK figures are identical or near-identical for the two exports. The cited tool runs are from both areas.

| Dimension | b1 base | **Re-priced** | What moved it (FIXED and visible) | Still against it |
|---|---|---|---|---|
| Typography* | 5 | **6** | 0 → 157 Dynamic Type role tokens, so the iPad tier and the text-size preference reach both exports. Literal px sizes 8 → 2. SVG labels 11 px minimum effective in both exports (TYPE/hidden-text), and no measured text under 11 px. | Fonts unverifiable on WebKit/Windows (as `hearth-shared`). |
| Colour | 4.5 | **5** | Chrome colour literals 15/29 → 8/5; the rest are map colours in `MAPCOL` (D12). Compass N passes (COLOR re-run 21/42 → 0 under 4.5, min 5.68; Worker C's run). Wait tiles on ink tokens. Failing text near 0 in both areas. | No semantic ramp beyond the map palette. |
| Layout | 4 | **5** | Spacing literals 75/91 → 2/18. Macro grid 83.5/65.6 % → 96.8/96.0 %. iPad margins 28-32 px (guide). | Literal breakpoints (8 widths). A 1,416 px tab-bar row and a visible map-art edge on the park desktop. 12-16 px floating-control margins on the park's iPad. |
| Shape* | 5.5 | **6** | Large radii on tokens 94.6 % (guide). The park's 58.8 % is a counting artefact: 2,224 readings are `calc(var(--r-sheet) - var(--sp-3))`. Native checkboxes in sheets are now switches; selects styled. | Hand-made glass with no `@supports` fallback in either export. 3 off-concentric pairs each. |
| Icons | 4 | **5.5** | One Lucide sprite (`ic()`): 0 → 27 uses per export. 52-53 text glyphs and 7 emoji gone. The native disclosure triangle gone ("About the data"). | The compass is still a drawn literal. A Lucide notice exists, but I did not check its template listing (GAP-ICON-2). |
| Motion | 4 | **4.5** | Pulses retired or cheap: the guide's highlight runs 3 iterations (P3-DOLLYWOOD-08); the park uses fill-opacity pulses. Motion tokens (`--dur-*`, `--spring-*`). CLS 0 on both. Reduce Motion: design.css's global kill plus the template's tween guard. | No exit animations seen. |
| Dark | 5 | **5** | (nothing re-priced) | The daylight map under dark chrome is unchanged in both. |
| Native | 5 | **5.5** | TELL: 56 + 13 controls, none selectable. 0 fields under 16 px. Checkboxes → switches. Select and caret styled. No `confirm()`. | A range slider (vertical exaggeration). Tab rings unverified. |
| Glanceability | 4.5 | **4.5** | (nothing new: role tokens were already credited in batch 1) | Phone-sized text everywhere. |
| Ease of use | 4.5 | **5** | No glyph buttons under 44 px (guide: 0 small selectors; park: 2 marginal readings). The rider-height filter fixed and styled. | A filter is still a select. |
| Delight | 5.5 | **5.5** | (nothing) | The build guide's engineering layers still show in the park's Style pane. |

**Total base change: +6 points across the 11 dimensions, +0.55 on each row.**

**One redistribution in Motion.** Batch 1 raised the base partly for "confirm() replaced with sheet + 30 s Undo". I re-priced Motion without the undo, which is an area's own action. Each area's undo toast is now counted under MOT-5, as for every Hearth area.

## The build guide's row

| Dimension | Base b1 → re-priced | b1 | **After b9** | Rules now applied | Change |
|---|---|---|---|---|---|
| Typography* | 5 → 6 | 4 | **6** | none | TYP-1 lifted |
| Colour | 4.5 → 5 | 4.5 | **5** | none | (base) |
| Layout | 4 → 5 | 3 | **4** | LAY-3½, LAY-4 | LAY-3 halved; LAY-4 new |
| Shape* | 5.5 → 6 | 5 | **6.5** | SHP-2 | SHP-4 lifted; SHP-2 earned (policy 2) |
| Icons | 4 → 5.5 | 3 | **6.5** | ICO-1 | ICO-3 lifted; ICO-1 earned |
| Motion | 4 → 4.5 | 3.5 | **5.5** | MOT-5 (+1) | MOT-2½ lifted; MOT-5 earned (policy 3) |
| Dark | 5 → 5 | 5 | **5** | none | held |
| Native | 5 → 5.5 | 5 | **5.5** | none | (base) |
| Glance | 4.5 → 4.5 | 3.5 | **3.5** | GLA-3 | held |
| Ease | 4.5 → 5 | 3.5 | **6** | EOU-1 | EOU-5 lifted; EOU-1 earned (policy 1) |
| Delight | 5.5 → 5.5 | 5.5 | **6.5** | DEL-2 | DEL-3 lifted |
| **Average** | | **4.1** (45/11) | **5.5** (60/11 = 5.45) | | **+1.4** |

- **Range** under the policy calls: **5.2-5.5**.
- **With the batch 1 base held** (sensitivity only): 54/11 = **4.9**.

### Cells that changed, with the evidence

**Typography 4 → 6.**
- **TYP-1 lifted.**
  - Phase 4 charged section names at 6.1 px on the iPhone and listing numbers at 6.8. TYPE/hidden-text now finds an 11 px minimum effective size on every measured guide screen, iPhone and iPad (`pairs/map-typical-iphone-pwa-light`, `pairs/map-typical-ipad-portrait-light`).
  - At the whole-park view the listing numbers give way and the section names stay legible.
- The rest is the base.

**Layout 3 → 4.**
- **LAY-3 halved.**
  - The map is now on the first screen at every size, with the chips and a compact toolbar above it (`pairs/map-typical-iphone-pwa-light`; before: hero, two chip rows and the toolbar, with the map at y 545).
  - On the iPad and desktop the sticky step bar puts Previous / **Mark done** / Next on the first screen (`pairs/map-typical-ipad-portrait-light`, `pairs/step-on-map-typical-ipad-landscape-light`, `pairs/map-typical-desktop-light`).
  - On the iPhone the default view shows the sheet at peek: the section, its progress and Next unfinished, but not Mark done. Mark done needs the sheet raised. That is one device class, so the deduction is halved.
- **LAY-4 applied (new; a regression).**
  - On the iPhone with the sheet at half, the step list (Terrain / "Flatten the plaza at 1,010 ft" / "Bank the sides of the approach") draws **over** the step's description text.
  - Evidence: `wb/cap2/dollywood/steps-typical-iphone-pwa-light.png`, `steps-overflow-iphone-pwa-light.png`. Both are reproduced pixel for pixel by my recapture of the final code.
  - The iPad and desktop are correct (`mycap/dollywood/steps-typical-ipad-portrait-light.png`).
  - Listing labels at section zoom still run under boundary lines and over each other in places (`pairs/section-typical-ipad-landscape-light`).
- **LAY-5 not given,** as in batch 1. The desktop side column existed before; the phone map is an inset card, not full-bleed.

**Shape 5 → 6.5.**
- **SHP-4 lifted.** The square underline Listings / Layers / Scale tabs are now the shared segmented control (`pairs/listings-typical-iphone-pwa-dark`). Large radii on tokens 94.6 %.
- **SHP-2 given (policy call 2).** GLASS/layers' 13 content-glass jobs are all "Back to map", a floating button over the 3D view: the control layer the house rules allow. Every other layer is chrome: toolbar, sticky bar, zoom group. That is down from 48 % of jobs, when the header and side panel were glass (VIS-DOLLYWOOD-6).

**Icons 3 → 6.5.**
- **ICO-3 lifted.** On the iPad and desktop the toolbar now has icon + word: Pan (move), Cross-section (chart-spline), Measure (ruler), Fit (scan), View (chevron) (`pairs/map-typical-ipad-portrait-light`). On the phone the same icons stand alone with labels (`pairs/map-typical-iphone-pwa-light`).
- **ICO-1 earned.**
  - Every control icon is a sprite `<use>` at the one `--icon-stroke`: the `stroke-width:2.2` overrides are gone from the template, and the only 2.2 left is a map marker ring.
  - No glyph or emoji stands in (ICON/static).
  - The "◌" dotted circle in the listings is a data mark (a georeferenced position, explained in About), read like the Larder's `.pbar`.
- **ICO-4 not found** in the guide.

**Motion 3.5 → 5.5.**
- **MOT-2½ lifted.** MOTION/cls: 0 landmark moves on the iPad and iPhone, against 37 moves and a 945 px maximum. The cold open no longer drops the map under arriving chips (P4-TELL-05).
- **MOT-5 +1 (policy call 3).**
  - **+½ for Reset's Undo.** Reset progress keeps its 30 s Undo; Import has a 10 s Undo (code).
  - **+½ for a Reduce-Motion-gated celebration.** When a section completes, its chip's check settles in (`@keyframes cdone-settle`, switched off under `prefers-reduced-motion` and `data-motion=reduce`), and the chip shows ✓ (`wb/cap2/dollywood/steps-overflow-iphone-pwa-light.png`: "Entrance & Plaza 94 ft · 9/9 ✓").
- Press feedback 16/24, so MOT-1 is not applied.

**Ease 3.5 → 6.**
- **EOU-5 lifted.** Ticking the built step was 3-4 taps plus a scroll (UX-DOLLYWOOD-1).
  - Now: Home's Build guide card, then the guide opens on the next step with **Mark done** at `--btn-h-lg` (60 px) in the sticky bar (iPad and desktop) or the half sheet (iPhone).
- **EOU-1 given (policy call 1).** Two taps from Home and a 60 px primary on the first screen on the iPad and desktop, the devices the guide is used on beside the game. On the iPhone the default peek hides it.
- 0 small target selectors (VIS-DOLLYWOOD-2 fixed).

**Delight 5.5 → 6.5.**
- **DEL-3 lifted.** Completion is now marked: a ✓ settling into the section chip, a section-done toast (lifted above the sticky bar), a "Built …" feed line and the Home card's progress.
- DEL-2 (the 3D terrain view) holds. In 3D the current step is now outlined and framed (`pairs/view-3d-typical-iphone-pwa-light`: Entrance & Plaza drawn in 3D with its markers, against before's mostly-sky view).
- **DEL-1 not given.** A toast and a check are feedback, not a designed moment.

### Held cells

- **Colour 5.** No real failing text in any palette; see the table for what remains. No COL rule is in reach, and COL-1 is not given (policy call 4).
- **Dark 5.**
  - No dark-only failure. Midnight, Forest and Hearth-dark read 0 failing text except the hidden Forest sticky-bar button.
  - The near-black frame on light themes is gone (VIS-TELL-1; `pairs/map-typical-ipad-landscape-dark` is a dark-theme shot with dark chrome).
- **Native 5.5.** The base only:
  - 56 controls none selectable, 0 fields under 16 px;
  - the progress menu is a phone action sheet (`pairs/progress-menu-typical-iphone-pwa-light`; before, it opened out of the sheet);
  - the Terrain select and rider-height select are styled.
  - NAT-6 not earned: no Tab walk.
- **Glance 3.5.** GLA-3 holds. Nothing reads beyond about 1 m on the iPad:
  - the step in the sticky bar is about 17 px;
  - the hero stats are about 20 px;
  - the "Dollywood, in contours" title is gone on the iPad and phone.

### Policy calls

| # | Call | If overruled | Guide row |
|---|---|---|---|
| 1 | EOU-1 given (iPad and desktop first screen; the iPhone peek hides Mark done) | Withheld: Ease 5 | 5.36 |
| 2 | SHP-2 given ("Back to map" is a floating control over 3D, not content) | Not given: Shape 6 | 5.41 |
| 3 | MOT-5 second ½ for the gated chip check | Not given: Motion 5 | 5.41 |
| 4 | COL-1 not given (profiles beyond Eli and the kids unmeasured) | Given: Colour 6 | 5.55 |
| 5 | LAY-3 halved (one device class) | Full: Layout 3.5 | 5.41 |
| 6 | Base re-priced (above) | The batch 1 base held | 4.9 |

## Found, not fixed (build guide, ranked; the cheapest fix with each)

1. **iPhone: the step list draws over the step's text in the half sheet** (LAY-4).
   - "Terrain / ✓ Flatten the plaza at 1,010 ft / ✓ Bank the sides…" sits on top of the description and the "Position estimated…" note.
   - Evidence: `wb/cap2/dollywood/steps-typical-iphone-pwa-light.png`, `steps-overflow-iphone-pwa-light.png`; reproduced from the final code.
   - It is phone-only: `sizeCard()` clears `--bnow-h` below 700 px, yet the list still overlaps. Something in the phone sheet's layout (`.bnow` flex with `.bctl{order:-1}` inside the sheet body) lets the card's content overflow its box.
   - Fix: give the phone sheet's `.bnow` `min-height:auto; overflow:visible` inside a normal-flow column, check `#b-list` is not positioned or gridded over it below 700 px, and add a no-overlap assertion to `guide-b-9`.
2. **The iPad card keeps a big blank.** The "one height" rule reserves the tallest step's height: about 260 px empty above the buttons on the iPad in portrait (`mycap/dollywood/steps-typical-ipad-portrait-light.png`).
   - Fix: reserve at most the 80th-percentile height, or let the buttons sit right under the text and reserve the space below them.
3. **Glance: nothing on the iPad reads past about 1 m** (GLA-3). The step is about 17 px in the sticky bar.
   - Fix: on the iPad, show the step title in the sticky bar at `--fs-title3` (bold) and the "8 of 9" count as rounded numerals at `--fs-title2`. That would probably lift GLA-3: Glance 4.5, row 5.55.
4. **Listing labels at section zoom** still cross boundary lines and each other (VIS-DOLLYWOOD-15 partly; `pairs/section-typical-ipad-landscape-light`).
   - Fix: give listing labels the map halo (`--map-halo` stroke) and drop labels whose boxes collide, keeping the marker.
5. **On the iPhone, Mark done is not on the first screen.** The default sheet is at peek (`pairs/map-typical-iphone-pwa-light`).
   - Fix: show the step title and a compact Mark done in the peek row (as the iPad sticky bar does). That lifts LAY-3½ and makes EOU-1 unconditional.
6. **3 off-concentric pairs:**
   - the sticky bar's Next (r 12 in r 20 with a 17 px inset);
   - the phone search field in the toolbar;
   - the phone sheet's Cancel.
   - Fix: `--r-inset` from each container's padding.
7. **Long section names wrap the build head** at iPad portrait ("Entrance & Plaza / — build steps" on two lines beside "…": `mycap/dollywood/steps-typical-ipad-portrait-light.png`).
   - Fix: put the progress bar under the title from 820 px.

## Device checks

- **Rendering:** real blur on the toolbar and sticky bar; SF faces; iOS presses.
- **Interaction:** the phone sheet's drag and detents; the sticky bar appearing on scroll in Safari.
- **3D:** performance on the iPad and the 3D outline of the current step.
- **Timing:** the "<Section> done" toast's position and timing.
- **Keyboard:** a Tab walk (NAT-6) and the keyboard shortcuts at the PC.
- **Two devices:** the plot field saving only valid values.
- **Home:** the Home card on a cold device (the 672 px move Worker D reports for a device with no saved hint).
