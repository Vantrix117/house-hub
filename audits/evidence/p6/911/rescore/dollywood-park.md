# Phase 4 scorecard: the Dollywood park map row after batch 10

**Independent judge.** Method: `audits/04-design-system.md` scorecard (bases + written rules TYP-1 … DEL-4, net per dimension clamped to ±2, 0.5 steps, row = mean of 11), applied as in `audits/handoff-cloud/scratch/rescore-8/rescore.md` (Larder) and `audits/evidence/p6/6/rescore.md` (Timer).

**Starting row.** The park map's last recorded row is the batch 1 rescore (`audits/evidence/p6/1/rescore.md`): **4.9** (54/11). No later rescore touched it. The `dollywood-template` bases are held at their batch 1 values, as instructed: Typ 5, Col 4.5, Lay 4, Shp 5.5, Ico 4, Mot 4, Drk 5, Nat 5, Gla 4.5, EoU 4.5, Del 5.5. Map colour is exempt (D12). Typography and Shape stay provisional (no backdrop blur in the rig, fallback fonts).

## Evidence

**Captures.**
- After: `b910/wc/cap4/dollywood-live/*.png` (722).
- Before: `…/scratchpad/cap910-before/dollywood-live/*.png` (722, same plan).
- **The after set is the final code.** I recaptured 12 states from my LF copy of the final export (map, family and meet × typical and overflow × iPhone PWA and iPad portrait, light), saved in `rescore-park/mycap/`. All 12 differ from cap4 by **0.000 %** of pixels (`rescore-park/pdiff.mjs`). The export also equals the template build byte for byte (`dollywood-build-project/build/dollywood_live.html`, ignoring CR).

**Before/after pairs.** 59 pairs in `rescore-park/pairs/` (`comp.mjs`):
- **Typical and park day:** map (iPhone light, iPad portrait light, iPad landscape dark, desktop light), meet (iPhone Safari dark, iPad landscape light), waits, nearby (desktop dark, arriving), map-arriving dark, map-far, map-restored, north-up dark, whole-park, placing, amenity-tap, ride-card, coaster-card (iPad portrait), directions-steps dark, search (iPad landscape), search-none, style and style-scrolled, satellite (iPad portrait dark).
- **Family:** family typical (iPad portrait dark), family-kids, family-guest.
- **Kid:** kid typical, kid-viewonly (iPad portrait), kid-nearby dark, kid-family (iPad landscape dark), waits-kid (desktop, iPad portrait), ride-card-kid.
- **Overflow:** map (iPhone, iPad portrait), meet (iPhone, iPad portrait dark), family, family-card, family-kids, nearby, directions, ride-card, waits (iPad portrait dark), waits-kid, kid, kid-family dark, map-spot (iPad landscape).
- **Loading, error and denied:** map-loading, waits-loading, family-loading dark, nearby-loading, ride-card-loading, waits-error dark, map-denied, nearby-nofix.

**Opened at full size:** `map-typical-desktop-light`, `amenity-tap-typical-iphone-pwa-light`, and the reviewer's `rev-park/shots/meet-eli-xxl.png`.

**Phase 4 tools, run by me.** They ran on an LF copy of the hub-audit working files, `rescore-park/wt`, with the template copied beside it for code-scan. Outputs are in `wt/out/`; all exit 0.

**I ran the measurement rig for this area.** The working tree had no raw measure data for GLASS/layers and SHAPE/analyze, so I ran `measure.mjs --area dollywood-live` for themes, devices and states: 642 of 642 jobs, 0 failed. I then ran `aggregate.mjs` (this area only).

**Before numbers** come from `audits/evidence/p6/8/p4tools/out` and `p6/8/measure`, batch 8's final run on 6688e17. That is the pre-batch park map.

| Tool | Before | After |
|---|---|---|
| TOK/literals | colour 29, font size 64, spacing 91 (33 exact-token), radius 8, shadow 13, target 27 | colour **5**, font size **2**, spacing **15**, radius 5, shadow 6, target 5; 0 mixed units (was 25) |
| TYPE/code-scan | token 2, clamp/calc 143, px 8, under-11 2 | **token 157**, clamp/calc 6, px 2, **under-11 0**. The template matches. |
| ICON/static | uses 0; 52 glyphs (× ↗ ◎ ⌖ ⚑ ✚ ♥ ❓ ✈ ⊘ ◔ …); 7 emoji | **uses 23** (+ `ic()` calls); 32 glyphs, all text (× in sizes, ± ft, › in "Settings › Safari", → in the guide-only Scale panel, … in "Loading…"); 2 "emoji" are ® ™ inside a regex |
| MOTION/press | 9/9 controls press | 9/9 |
| MOTION/cls lat150 | 0 moves, iPhone and iPad | 0 moves, iPhone and iPad |
| SHAPE/analyze | macro 4 px grid 65.6 %; margins about 10 px; large radii on tokens 92.5 %, kid 0 %; 4 off-concentric pairs | **macro grid 95.9 %**; margins 12-16 px; large radii 58.7 % (see policy call 6), kid 56.9 %; 2 off-concentric pairs |
| SHAPE/verify V4 (kid, iPad) | handle 64, tabs 64, north 73, fit 64 | handle 64, tabs 72, north 64, fit 74 |
| GLASS/layers | 642 jobs; content live glass 0 %; live layers median 7; area share 0.561 | content live glass **0 %**; median 6; area share 0.444. Every layer is chrome. |
| TELL/tells-webkit | (not run on the park map before) | 13 controls, none selectable, 0 imgs, 0 fields under 16 px, no double-tap selection, no ring after a tap |

**Measure aggregate.**
- **Failing text occurrences** (system light / dark / Frost):
  - Before: **184 / 182 / 37**.
  - After: **3 / 3 / 4**. All are p10-only: the card title over the map art (glass with no blur in the rig), category badges flagged "suspect", and Frost's hero-card caption, which reads 4.34 at p10 and 4.55 at the median.
- **Text under 11 px:** 0.
- **Information graphics:** 91 of 120 below 3:1. All are the directions step tiles (`.lv-step > span.g`); see Colour.

**Other checks.**
- **Targets:** `SHAPE/verify-parkmap-targets-18-1` finds 2 effective adult targets under 44 px (batch 1: 16 selectors):
  - `#meet-go` at 43.2 × 44 on the desktop;
  - `#near-mode-near` at 42.7 px tall on the iPhone. That is 44 × 0.97, a press scale caught mid-press; every other state reads 44.
  - The switches are 52 × 32 inside 398 × 44 labels.

**Not run:** contrast across every household profile (the rig uses Eli and the kids), TYPE/hidden-text, DARK/art-dark, MOTION idle and reduced-motion, a Tab walk.

## The row

| Dimension | Base (d) | b1 | **After b10** | Rules now applied | Change |
|---|---|---|---|---|---|
| Typography* | 5 | 5 | **5** | none | held |
| Colour | 4.5 | 4 | **4.5** | none | COL-4 lifted (policy 1) |
| Layout | 4 | 3.5 | **3.5** | LAY-3½, LAY-4, LAY-5 | held |
| Shape* | 5.5 | 6 | **6** | SHP-2 | held |
| Icons | 4 | 3.5 | **4** | none | ICO-4 lifted; ICO-1 not earned |
| Motion | 4 | 4.5 | **4.5** | MOT-5 (+½) | held |
| Dark | 5 | 5 | **5** | none | held |
| Native | 5 | 5 | **5** | none | held |
| Glance | 4.5 | 5.5 | **5.5** | GLA-4 | held |
| Ease | 4.5 | 4.5 | **5.5** | EOU-1 | EOU-2 lifted |
| Delight | 5.5 | 7.5 | **7.5** | DEL-1, DEL-2 | held |
| **Average** | | **4.9** (54/11 = 4.91) | **5.1** (56/11 = 5.09) | | **+0.2** |

The range under the policy calls below is **4.9-5.3**; the central score is **5.1**.

**Why so little for so much work.** Most of batch 10 fixes items that the `dollywood-template` base prices, not area rules:
- 0 → 157 type tokens;
- spacing on tokens and the grid;
- the text glyphs and the native disclosure gone;
- native checkboxes now switches;
- the selects styled;
- glyph buttons under 44 px gone;
- a kid scale.

Bases are held by instruction. Re-pricing the template base the way batch 1 re-priced `hearth-shared` (only for "Against" items now FIXED in both exports and visible) would add about +1 to Typography, Layout and Icons, and about +½ to Colour, Shape, Motion, Native and Ease. That is roughly **5.6-5.7**, an indicative figure only, and it needs the build guide's rescore to agree on the same base.

## Cells that changed, with the evidence

**Colour 4 → 4.5: COL-4 lifted (correction; policy call 1).**
- **What batch 1 kept.** It kept COL-4 for "91 of 104 information dots under 3:1, unchanged". The aggregate shows what those "dots" are: the 32 px tiles behind each turn arrow in the directions list (`div.lv-step > span.g`, 1.25-1.58 against the row, in both rigs).
- **Why the tiles are not the carrier.** The turn is carried by the arrow drawn in the tile and by the row's words ("Turn left at Lumber Jack's Pizza for 550 ft"). The tile is not the only carrier of its meaning.
- **Precedent.** This is the test the Phase 4 consistency pass used to withdraw COL-4 from the Timer arc, the Larder bar, Prayer's dots and the Verses histogram.
- **What was fixed in this batch:**
  - the compass needle: COLOR checks 21/42 under 4.5 → 0, minimum 5.68 (Worker C);
  - the MIN labels on the wait tiles, now dark ink on pale fills (`pairs/waits-typical-iphone-pwa-light`).
- **COL-2 and COL-3 stay lifted.** Failing text is down to 3-4 p10-only occurrences per palette, from 184.
- **COL-1 is not given (policy call 2).**

**Icons 3.5 → 4: ICO-4 lifted, ICO-1 not earned.**
- **Every control icon is now a Lucide sprite symbol:**
  - locate-fixed, scan, flag, map-pin, users, search and layers on the tabs;
  - x, chevron-up, arrow-up turns, trending-up and trending-down, ban for a closed ride;
  - ruler for "too short", amenity symbols (toilet, cross, heart-pulse, baby, droplet), external-link and volume-2.
- **No glyph or emoji stands in for an icon.** `pairs/map-typical-iphone-pwa-light` (before: ◎ and literal marks), `pairs/directions-steps-typical-iphone-pwa-dark`, `pairs/ride-card-typical-iphone-pwa-light` (before: an underlined "dollywood.com ↗"; after: a capsule with the external-link icon).
- **ICO-4 lifted.** I found no meaning drawn two ways or drawing with two meanings in the live flavour. The flag marks both the meeting point and a route's arrival; I read both as "destination" (policy call 4).
- **ICO-1 withheld.** The turn arrows are drawn at `stroke-width:2.2`, while every other sprite icon uses `--icon-stroke` 1.75 (`.lv-turn .sym`, `.lv-step .g .sym`, template CSS around export lines 590 and 593). That is two computed weights, so the rule fails by its letter (policy call 3).

**Ease 4.5 → 5.5: EOU-2 lifted (policy call 5).**
- Batch 1's 16 adult selectors under 44 px are gone: sheet handle 22 → 44, About 29, mode chips 32, height stepper 40 → number fields, directions buttons 40.
- The only remaining sub-44 readings are a 0.8 px shortfall on a desktop (fine pointer) Go capsule and a mid-press capture (verify-parkmap-targets-18-1).
- **EOU-1 holds:** Home → map in one tap, with Find me and Set my spot on the first screen.
- **EOU-3 stays lifted:** kid targets are all 64 px or more (V4), and the kid's view-only state now says "A grown-up can show where you are" (`pairs/kid-nearby-typical-iphone-pwa-dark`).

## Held cells, re-checked

- **Typography 5.**
  - No text under 11 px in 642 jobs. 157 role tokens.
  - Family labels and the meeting pill hold a floor of 11 px.
  - TYP-3 and TYP-5 were never applied here; no new evidence.
- **Layout 3.5.**
  - **LAY-3½ held, and the cover is larger on phones.** The location pill now carries a full-width Set my spot, and the meeting bar a second row of Go / Rally / Done. Together they cover the top:
    - about 35 % of the iPhone map (`pairs/map-typical-iphone-pwa-light`);
    - about 38 % with a long name (`pairs/meet-overflow-iphone-pwa-light`);
    - about half at XXL (`rev-park/shots/meet-eli-xxl.png`, where faces sit under the bar's edge).
  - With the sheet at half, the visible map is about 180 px tall (`pairs/family-overflow-iphone-pwa-light`).
  - **LAY-4 held.** The stacked family labels are fixed (initials, no pile-up: `pairs/map-overflow-iphone-pwa-light`, `pairs/map-overflow-ipad-portrait-light`). But the meeting pill "Meet · The Wildwood Tree" now sits under the "Now" wait chip in the typical state at every size from the iPad up:
    - `map-typical-desktop-light` (full size);
    - `pairs/family-typical-ipad-portrait-dark`, `pairs/kid-viewonly-typical-ipad-portrait-light`, `pairs/map-typical-ipad-landscape-dark`.
  - On the iPhone with the sheet open, a puck sits over the pill and the compass and scale sit over family labels (`pairs/family-overflow-iphone-pwa-light`, `pairs/kid-nearby-typical-iphone-pwa-dark`).
  - **LAY-5 held:** floating controls and a detent sheet over the full-bleed map; the meeting bar is capped and centred on the iPad and desktop.
  - **LAY-1 not charged:** grid 65.6 → 95.9 %, priced in the base.
- **Shape 6.**
  - SHP-2 holds: content live glass is 0 %, and all glass is chrome (sheet, route, card sheet, meeting bar, pill, fabs, compass).
  - SHP-3 stays lifted. The template's hand-made glass has no `@supports` fallback, before and after; that is a base item.
  - SHP-4 not applied (policy call 6).
- **Motion 4.5.**
  - MOT-5 +½ holds: Done on the meeting point shows "Meeting point cleared for everyone." with Undo for 8 s. This was already true before the batch.
  - No second ½ on stills.
  - Press 9/9; cls 0; no infinite animation at 1.2 s; Reduce Motion is the global design.css kill plus the template's tween guard.
- **Dark 5.**
  - No dark-only failing text (Midnight, Forest and Hearth-dark: 0).
  - The daylight map under dark chrome is a base item.
  - The light empty-state plate in waits-error dark is under a quarter of the screen, so no DRK-5.
- **Native 5.**
  - TELL: 13 controls, none selectable, 0 draggable images, 0 fields under 16 px.
  - Switches replace checkboxes (`pairs/style-scrolled-typical-iphone-pwa-light`); the contour select has a drawn caret.
  - NAT-6 is not earned: no Tab-walk evidence.
  - NAT-4 is not applied: the loading states say "Loading…" (`pairs/map-loading-iphone-pwa-light`, `pairs/waits-loading-iphone-pwa-light`). But see found item 9.
- **Glance 5.5.** GLA-4 holds: wait tiles in colour bands with 20 px+ numerals, a kid's pucks and faces.
- **Delight 7.5.** DEL-1 and DEL-2 hold. Rally the family, the arrival push and wait trends add to the signature experience; the clamp is already reached.

## Policy calls (stated so they can be overruled)

| # | Call | If overruled | Row |
|---|---|---|---|
| 1 | COL-4 lifted (the step tiles are containers, not the sole carrier) | Held: Colour 4 | 5.05 |
| 2 | COL-1 not given (Frost caption at 4.34 p10; only Eli and the kids measured) | Given: Colour 5.5 | 5.18 |
| 3 | ICO-1 not given (2.2 vs 1.75 stroke) | Given: Icons 5 | 5.18 |
| 4 | ICO-4 lifted (flag = destination in both uses) | Held: Icons 3.5 | 5.05 |
| 5 | EOU-2 lifted (0.8 px on a fine pointer; the other reading is a mid-press artefact) | Halved: Ease 5 | 5.05 |
| 6 | SHP-4 not applied | Applied: Shape 5.5 | 5.05 |
| 7 | LAY-4 held on the pill and chip collision | Lifted: Layout 4 | 5.14 |
| 8 | Bases held (instruction) | Template re-priced | about 5.6-5.7 |

On call 6: SHAPE/analyze reads 58.7 % of large radii on tokens, under SHP-4's 60 % line. But 2,224 of the off-token readings are the sheet tabs at `calc(var(--r-sheet) - var(--sp-3))` = 20 px, a token expression (`.lv-tabs button`). Counting them gives about 86 %.

## Found, not fixed (ranked; the cheapest fix with each)

1. **The phone map is mostly chrome in the commonest park states** (LAY-3½).
   - Denied pill + Set my spot + the two-row meeting bar cover 35-38 % of the iPhone map, and half at XXL.
   - With the sheet at half, about 180 px of map is left.
   - Evidence: `pairs/map-typical-iphone-pwa-light`, `pairs/meet-overflow-iphone-pwa-light`, `pairs/family-overflow-iphone-pwa-light`, `rev-park/shots/meet-eli-xxl.png`.
   - Fix: when a meeting bar is showing, collapse the location pill to one line with an icon-sized Set my spot (or fold the denied note into the meeting bar). Keep Go / Rally / Done on the name row from 390 px with icon + short label, and fall back to the second row only at XXL.
2. **The meeting pill collides with the "Now" wait chip and other map labels** (LAY-4).
   - On the iPad and desktop the "Now" chip is drawn over "…Tree" in the typical state.
   - On the iPhone with the sheet open, a puck covers the pill, and the compass and scale sit over family labels.
   - Evidence: `wc/cap4/dollywood-live/map-typical-desktop-light.png`, `pairs/family-typical-ipad-portrait-dark`, `pairs/kid-viewonly-typical-ipad-portrait-light`, `pairs/family-overflow-iphone-pwa-light`.
   - Fix: add the wait chips' and amenity markers' boxes to `drawMeet()`'s avoid set (it now avoids faces and floating controls only), and raise the pill above the chips' layer.
3. **The current turn's arrow is under 3:1 in every palette** (a regression from the sprite swap).
   - `.lv-step.now .g` fills with `--accent-strong`, but the arrow keeps `stroke: var(--text)`: 2.65-2.83 in light, 1.65-1.70 in dark (nontext `svgIcons`).
   - Evidence: `pairs/directions-steps-typical-iphone-pwa-dark`; the first row's white arrow on lavender.
   - The words carry the turn too, so no rule applies.
   - Fix: `.lv-step.now .g .sym{stroke:var(--accent-on)}`.
4. **Two family members share one initial.** Ezra and Elizabeth both read "E" beside their pucks.
   - Evidence: `pairs/ride-card-typical-iphone-pwa-light`, `pairs/map-typical-iphone-pwa-light`, `wc/cap4/dollywood-live/amenity-tap-typical-iphone-pwa-light.png`.
   - The faces differ, but the label no longer tells them apart at arm's length.
   - Fix: when two shown initials collide, use two letters (the overflow state already shows "EA", "GJ"), or the first name when there is room.
5. **Two icon stroke weights** (withholds ICO-1). The turn arrows use 2.2, every other symbol 1.75.
   - Fix: drop `stroke-width:2.2` from `.lv-turn .sym` and `.lv-step .g .sym`, or make the turn icons `--icon-lg`, which reads heavier at 1.75. That earns ICO-1: Icons 5, row 5.18.
6. **The amenity card's close button is at the bottom right**, below Directions; the ride and coaster cards put it top right.
   - With a card open, the sheet's own buttons peek under the tab bar (before as well).
   - Evidence: `wc/cap4/dollywood-live/amenity-tap-typical-iphone-pwa-light.png`, `pairs/coaster-card-typical-ipad-portrait-light`.
   - Fix: one `.pop-head` row with the X for every card; hide the pane body while a card holds the sheet.
7. **The placing pill's title wraps to three lines** ("Line up the / crosshair on / you") in a narrow column beside I'm here and Cancel (`pairs/placing-typical-iphone-pwa-light`).
   - Fix: put I'm here and Cancel on their own row below 600 px, as the meeting bar does.
8. **The waits error says "No waits to show yet."** under "Can't reach wait times right now" (`pairs/waits-error-iphone-pwa-dark`). "Yet" reads as loading.
   - Fix: in the error state, show only the banner, or "Last waits will show here when the feed is back".
9. **Switches drawn Off while loading.** On a cold open, Share my spot and every kid's beacon show an Off switch beside "Loading…" (`pairs/family-loading-iphone-pwa-dark`). This is a finished-looking state, half a step from NAT-4.
   - Fix: render the switches `disabled` with a skeleton knob until the first pull lands.
10. **Desktop and iPad landscape still leave work** (VIS-DOLLYWOOD-LIVE-10, partly done).
    - The tab bar is a 1,416 px row of four tabs.
    - A visible edge of the map art sits at about x = 160 (`map-typical-desktop-light`).
    - Fix: cap the sheet and its tabs at `--col-wide` and centre them; extend the grass fill under the art's edge.
11. **The Style pane still lists the build guide's engineering layers**: Contours, "Steepness — orange ≥25 %, red ≥40 % grade", "Guest paths (to width)", Service roads (`pairs/style-scrolled-typical-iphone-pwa-light`).
    - Fix: in the live flavour, show Illustrated / Satellite, Section names, Official listings and Streams & water; move the rest behind "More layers".
12. **Off-concentric sheet tabs** (SHAPE/analyze: 2 pairs). The tabs are r 20 inside the r 32 sheet with a 24 px inset; 8 would be concentric.
    - Fix: use `--r-inset` from the sheet padding, or a 12 px inset.

## Device checks (not judged without a device)

- **Rendering:**
  - real blur under the meeting bar, pill, sheet and card sheets (several p10 "failures" and the ghosting are the rig's missing blur);
  - SF faces;
  - iOS `:active` presses.
- **Motion:**
  - the sheet's drag and detents;
  - the compass needle's turn;
  - the route-in animation;
  - Reduce Motion.
- **Location and push:**
  - GPS and the locate states;
  - the wake lock in the park;
  - the Rally push and the arrival push (Worker D's device list);
  - live waits and trends against queue-times.
- **Kid:** kid speech (`#lv-speak`).
- **Keyboard and VoiceOver:** a Tab walk (NAT-6) and VoiceOver order over the map.
- **Away from the rig:**
  - every household profile's accent on Rally, Set my spot and the selected tab;
  - arm's-length reading in sunlight.

## Not verified by me

- Contrast for profiles other than Eli and the kids.
- TYPE/hidden-text: the SVG labels' effective size at the far zoom.
- DARK/art-dark.
- MOTION idle (Worker C reports idle main thread 2.4 → 0.5 %) and the reduced-motion tool.
- The iPad landscape target sizes; verify-18-1 measures the iPhone, iPad portrait and desktop only.
- The second ½ of MOT-5.


---

# Addendum, 7 Oct 2026, 03:40: the park map on the final export, with the re-priced template base

**Why this addendum.** The park map changed again after the capture above. The template was rebuilt at 02:35 and both exports were written at 02:39:05. The coordinator also asked that the `dollywood-template` base be re-priced once and applied to both Dollywood rows. The re-pricing, with its evidence, is in `b910/rescore-guide/rescore.md` → "The re-priced dollywood-template base". This addendum applies it here.

**Base, batch 1 → re-priced:**

| Dimension | b1 | Re-priced |
|---|---|---|
| Typography | 5 | **6** |
| Colour | 4.5 | **5** |
| Layout | 4 | **5** |
| Shape | 5.5 | **6** |
| Icons | 4 | **5.5** |
| Motion | 4 | **4.5** |
| Dark | 5 | 5 |
| Native | 5 | **5.5** |
| Glance | 4.5 | 4.5 |
| Ease | 4.5 | **5** |
| Delight | 5.5 | 5.5 |

Motion's base no longer includes any area's own undo; the park's meeting-point Undo stays an area MOT-5 ½.

## Which captures

**I used `b910/wc/cap6/dollywood-live` (722 files, captured 02:49-03:09), not cap5.**
- My snapshot of the 02:39 export (`rescore-guide/wt`, `dollywood-live.html` MD5 `95a0f50b…`) recaptured 28 states (`rescore-guide/mycap-park/`: map, meet, directions-steps, family × typical/overflow × iPhone/iPad × light/dark).
- All 28 match cap6 at **0.000 %** of pixels.
- cap5 (02:08-02:19) differs by 0.008-0.039 %, so it predates the last export.

**Pairs:**
- cap4 → cap6: 14 pairs in `rescore-park/pairs6/`.
- before → cap6: `pairs6/vsbefore-*`.

**Tools** (fresh, on the snapshot): the measure rig 642/642, aggregate, SHAPE/analyze, GLASS/layers, MOTION/press, MOTION/cls, SHAPE/verify, TELL/tells-webkit, verify-parkmap-targets-18-1, TYPE/hidden-text. Outputs are in `rescore-guide/wt/out/`.

## What changed in the park since cap4 (seen in cap6 and the tools)

- **The phone's top chrome is about half as tall** (`pairs6/family-overflow-iphone-pwa-light`, `pairs6/map-typical-iphone-pwa-light`):
  - the meeting bar is one row: flag, name with a disclosure chevron, then icon buttons Go (navigation-2), Rally (users) and Clear (x);
  - the location-off pill puts Set my spot beside its title;
  - the pill and bar together now cover about 20 % of the iPhone map, against about 35-38 %;
  - the iPad and desktop keep the worded Rally / Done (`pairs6/family-typical-ipad-portrait-dark`).
- **The meeting pill no longer sits under the "Now" wait chip** on the iPad and desktop (`pairs6/map-typical-desktop-light`, `pairs6/family-typical-ipad-portrait-dark`).
- **Colliding initials split.** Elizabeth "El" beside Ezra "E" (`pairs6/family-typical-ipad-portrait-dark`, `pairs6/waits-error-iphone-pwa-dark`).
- **The current turn's arrow follows its tile** (`.lv-step.now .g .sym{color:var(--accent-on)}`; `mycap-park/dollywood-live/directions-steps-typical-iphone-pwa-dark.png`: dark arrow on periwinkle). Nontext: 0 failing svg icons.
- **One icon weight.** The `stroke-width:2.2` overrides on the turn icons are gone, so all control icons are at `--icon-stroke`. The only 2.2 left is a map marker ring.
- **Smaller fixes:**
  - the amenity card's X is top right (`pairs6/amenity-tap-typical-iphone-pwa-light`);
  - the placing pill's buttons have their own row (`pairs6/placing-typical-iphone-pwa-light`);
  - the waits error reads "Wait times are not available right now." (`pairs6/waits-error-iphone-pwa-dark`);
  - loading switches show an empty track with no Off knob (`pairs6/family-loading-iphone-pwa-dark`).
- **Measured on the new code:**
  - **Failing text:** one new group, the visually hidden "Rally" label (`.lv-meet:not([data-open]) button .bl`, clipped to 1 px), which the rig reads at 1.1:1. It is not visible, so it is a rig artefact. The rest are the p10-only suspects already listed.
  - **Shape and glass:** 0 % content glass; macro grid 96.0 %.
  - **Motion:** press 9/9; CLS 0.0036 on the iPhone (the pill, 0 px move).
  - **Text:** none under 11 px; SVG labels 11 px minimum.
  - **Targets:** effective adult targets under 44 px are `#meet-go` at 43.2 px wide on the desktop (fine pointer) and the location pill's text box at 163.8 × 40 inside the taller pill (policy as before).

## The park row, rescored on cap6 with the re-priced base

| Dimension | Re-priced base | First pass (cap4, b1 base) | **Addendum (cap6, re-priced base)** | Rules |
|---|---|---|---|---|
| Typography* | 6 | 5 | **6** | none |
| Colour | 5 | 4.5 | **5** | none (COL-4 lifted, policy 1 above; COL-1 not given, policy 2) |
| Layout | 5 | 3.5 | **4.5** | LAY-3½, LAY-4, LAY-5 |
| Shape* | 6 | 6 | **6.5** | SHP-2 |
| Icons | 5.5 | 4 | **6** | ICO-1 (+1), ICO-4 (−½) |
| Motion | 4.5 | 4.5 | **5** | MOT-5 ½ |
| Dark | 5 | 5 | **5** | none |
| Native | 5.5 | 5 | **5.5** | none |
| Glance | 4.5 | 5.5 | **5.5** | GLA-4 |
| Ease | 5 | 5.5 | **6** | EOU-1 |
| Delight | 5.5 | 7.5 | **7.5** | DEL-1, DEL-2 |
| **Average** | | **5.1** (56/11) | **5.7** (62.5/11 = 5.68) | |

- From batch 1: **4.9 → 5.7**.
- With the batch 1 base held, the same rules give 56.5/11 = **5.1** (the code changes alone: ICO-1 earned, ICO-4 re-applied).

### Rule changes against the first pass

- **ICO-1 earned (+1)** on the code. The two-weight reason (first-pass policy call 3) is gone: one `--icon-stroke`, sprite only, no glyph stand-ins.
- **ICO-4 re-applied (−½), for a new reason.** The one-row meeting bar draws:
  - **Rally** with `users`, the drawing of the Family tab;
  - **Clear the meeting point for everyone** with `x`, the close of every card and sheet (`pairs6/meet-typical-iphone-pwa-light`, `pairs6/amenity-tap-typical-iphone-pwa-light`).
  - One drawing, two meanings, twice. The iPad and desktop still say Rally and Done in words.
- **LAY-3½ held.**
  - The top chrome is much smaller.
  - But the whole-park view on the iPhone still shows the park as a small inset with the map art's edge visible on all four sides, and about a third of the frame empty grass (`pairs6/vsbefore-whole-park-typical-iphone-pwa-light`; VIS-DOLLYWOOD-LIVE-13 not fixed).
  - With the sheet at half, about 315 px of map remains.
- **LAY-4 held, now for the phone only.**
  - With the sheet open, the meeting pill sits under a family puck and the "EA" badge.
  - The compass sits over a family label ("…irweather-Pennington").
  - Evidence: `pairs6/family-overflow-iphone-pwa-light`.
  - The iPad and desktop collision is fixed. The rule has no half, so it stays −½.
- **EOU-2 stays lifted** (as policy call 5).
- **Everything else** is unchanged from the first pass, on the re-priced base.

### Found, not fixed: status of the first pass's list on cap6

| # | Item | Status |
|---|---|---|
| 1 | Chrome covers the phone map | **Mostly fixed** (about 20 % now); the whole-park inset remains (above) |
| 2 | Meeting pill collides with labels | **Fixed** on the iPad and desktop; **open** on the phone with the sheet open |
| 3 | Current turn arrow under 3:1 | **Fixed** |
| 4 | Two people share "E" | **Fixed** ("El") |
| 5 | Two stroke weights | **Fixed** |
| 6 | Amenity card's close at bottom right | **Fixed**. The sheet's own buttons still peek under the tab bar with a card open (`pairs6/amenity-tap-typical-iphone-pwa-light`). |
| 7 | Placing pill wraps to three lines | **Fixed** |
| 8 | Waits error "yet" | **Fixed** |
| 9 | Switches Off while loading | **Fixed** (empty track) |
| 10 | Desktop 1,416 px tab bar; map-art edge | **Open** (`pairs6/map-typical-desktop-light`) |
| 11 | Engineering layers in Style | **Open** (`pairs6/style-scrolled-typical-iphone-pwa-light`) |
| 12 | Off-concentric sheet tabs | **Open**; now 3 pairs (+ the ride card's Directions at a 25 px inset) |

**New on cap6:**
- **A.** Icon-only Rally (`users`) and Clear (`x`) on the phone (ICO-4).
  - Fix: Rally gets a distinct symbol (e.g. a megaphone or `bell-ring`, drawn into the sprite in Lucide's style). Clear gets `flag-off` or a "Done" word in the expanded state.
  - That lifts ICO-4: Icons 6.5, row 5.73.
- **B.** The meeting name is cut to "Meet at TimeSaver …" behind a chevron on the phone (`pairs6/family-overflow-iphone-pwa-light`); the full name needs a tap.
  - Acceptable as a disclosure, but at 390 px "Meet at The Wildw…" loses the place's identity.
  - Fix: drop "Meet at" on the phone, since the flag says it.

**Top found, not fixed (park, on cap6):**
1. The whole-park view on the iPhone is a small inset with visible art edges.
2. Phone, sheet open: a puck covers the meeting pill and the compass sits on a family label.
3. Rally and Clear borrow the Family tab's and close's drawings.
4. The desktop tab bar is a 1,416 px row.
5. The engineering layers in Style.

**Device checks** are unchanged, plus the one-row meeting bar's disclosure on a real iPhone, and VoiceOver reading the icon-only Go / Rally / Clear by their labels.
