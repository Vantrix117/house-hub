# Phase 4 scorecard: the Tally counter row, rescored after audit batch 11

**Current verdict: 6.2** (68/11 = 6.18), the re-score at the end of this file, on the code after the worker's fixes (captures `b11/cap3`). The first verdict, 6.0, follows unchanged as a dated section.

## First verdict (2026-10-07, first pass, captures `b11/cap2`): 5.7 → 6.0

**Independent judge.** Method: `audits/04-design-system.md` scorecard (bases + written rules TYP-1 … DEL-4, net per dimension clamped to ±2, 0.5 steps, row = mean of 11), applied as in `audits/evidence/p6/6/rescore.md` (Timer) and `audits/handoff-cloud/scratch/rescore-8/rescore.md` (Larder). The hearth-shared bases are held at their batch 1 values (Typ 6, Col 5, Lay 6.5, Shp 6, Ico 5.5, Mot 4.5, Drk 6.5, Nat 6.5, Gla 4.5, EoU 6, Del 5.5). Rules are applied or lifted only on evidence below. Typography and Shape stay provisional (no backdrop blur and fallback fonts on the rig).

**Starting row.** Tally's last score is batch 1's **5.7** (63/11 = 5.73; `audits/evidence/p6/1/rescore.md:15, :51`). No later rescore touched Tally (batches 3-8 only mention it in passing). Phase 4 was 4.6.

## Evidence

- **Captures.** 60 after (`b11/cap2/tally/*.png`, final code) against 60 before (`…/scratchpad/cap11-before/tally/`), composited side by side in `b11/rescore/pairs/` (`pairs.py`). Opened at full size: main-typical iPhone light, iPad portrait light, iPad landscape dark; kid-typical iPad landscape light (and the after alone), iPad portrait dark, iPhone Safari light; main-overflow iPhone dark; kid-overflow iPad portrait light, iPhone dark; main-loading iPhone light; main-empty desktop light; main-offline iPad portrait dark.
- **Reviewer shots** (`b11/rev/shots5/`, final round): `eli-7c-390x844`, `ezra-2c-844x390-xxl`, `ezra-7c-1180x820`; crop `rescore/crop-picker.png`. Worker shots `b11/shots/home-card-390.png`, `home-820.png`, `tv.png` (dated Oct 6 17:21, before the review rounds: used for the Home card and the TV only).
- **Phase 4 tools**, run by me on an LF copy (`b11/rescore/wt`, outputs `b11/rescore/out/`), against batch 7/8's `p4tools/out` (pre-batch Tally code):

| Tool | Before (b7/b8 out) | After (mine) |
|---|---|---|
| TOK/literals tally (non-colour) | 15: fontSize 1, lineHeight 2, spacing 1, shadow 3, glassFilter 1, zIndex 4, opacity 1, localLiteral 2; no breakpoints | **7**: fontSize 2, shadow 3, zIndex 1, opacity 1; **4 literal breakpoints** (max-width 899, 600, max-height 560, min-width 768) |
| TYPE/code-scan | clamp/calc 1, under-11 0 | token 5, clamp/calc 2, under-11 0 (`--fs-sm/lg/md`) |
| ICON/static | svg 2, uses 0, strokes `{1.75:2}`, glyphs {} | svg 4, **uses 4**, strokes {} (static), glyphs {}, emoji 0 |
| MOTION/press | 3/3 | **4/4** (minus, plus, Reset, New counter; 0.97 + brightness .94) |
| MOTION/cls lat150 | 0 shifts, **0 landmark moves** | CLS 0, **3 landmark moves, max 30 px** (−, +, Reset 30 px up) on iPad portrait and iPhone |
| MOTION/cls held | (not in b7/b8) | CLS 0.0076 / 0.0196, 1 shift, same 30 px moves; skeleton shown |
| TELL/tells-webkit | 3 controls `none`, dbl "" | 4 controls `none`, dbl "", zoom 0 |
| SHAPE/verify V2 | span 318 / 360 / 360 / 360 | **unchanged**: 318 / 360 / 360 / 360 (dial capped) |
| SHAPE/verify V4 kid | plus 168, minus 116, reset 197×64 | plus 168, minus 116, reset 133×64 |
| SHAPE/analyze | 74.0 % macro grid (b7) | **not measured**: `files 0`, no `audits/evidence/p4/measure/raw` |
| GLASS/layers | contentLive 100 % (b1) | **could not run**: needs `measure/raw/themes`, absent (exit 1). Content glass judged from code + the worker's `tally-claims-11` ("content glass layers: 0", 196/0, `b11/runs5/claims.txt`) |

## The row

| Dimension | Base | b1 (5.7) | **After b11** | Rules now applied | Change |
|---|---|---|---|---|---|
| Typography* | 6 | 7 | **7** | TYP-4 | held |
| Colour | 5 | 6 | **6** | COL-1 (held, partly unverified) | held |
| Layout | 6.5 | 5.5 | **6** | LAY-2 (LAY-4 lifted) | +0.5 |
| Shape* | 6 | 5.5 | **6.5** | SHP-2 (SHP-1½ lifted) | +1 |
| Icons | 5.5 | 5.5 | **5.5** | none | held |
| Motion | 4.5 | 4.5 | **4.5** | MOT-5 +½, MOT-2½ | held (net 0) |
| Dark | 6.5 | 6.5 | **6.5** | none | held |
| Native | 6.5 | 6.5 | **6.5** | none | held |
| Glance | 4.5 | 6.5 | **6.5** | GLA-2 | held |
| Ease | 6 | 5 | **6** | none (EOU-6 lifted) | +1 |
| Delight | 5.5 | 4.5 | **4.5** | DEL-3 | held |
| **Average** | | **5.7** (63/11 = 5.73) | **6.0** (66/11 = 6.00) | | **+0.3** |

## Cells that changed

- **Layout 5.5 → 6: LAY-4 lifted.** The name pill is in the flow above the dial and no longer touches it in kid iPad landscape (`pairs/kid-typical-ipad-landscape-light.png`, was the batch 1 reason) or iPhone Safari (`pairs/kid-typical-iphone-safari-light.png`). Long names show whole ("Elijah Montgomery-Anderson's counter", "Ezra Bartholomew Anderson's counter", was truncated "…CO…": `pairs/kid-overflow-iphone-pwa-dark.png`); 250,000 and 999,999 fit the dial. The picker's "Seventh from another iPa" is the 24-character name limit, not a clip (`crop-picker.png`). **LAY-2 stays:** V2 span 360 px at 1180 and 1440 (`SHAPE_verify.txt:27, :35`); the desktop leaves well over half empty (`pairs/main-empty-desktop-light.png`). Room mode grows the dial (360 → 452 at 1180×820, 722 at 820×1180) only after 20 s idle, so it does not change the resting layout.
- **Shape 5.5 → 6.5: SHP-1½ lifted, SHP-2 earned.** No `backdrop-filter` remains in `apps/tally.html`; the dial, pill, Reset (`.btn-soft`, design.css:878, a solid fill) and the resets card are solid; `tally-claims-11`: "content glass layers: 0". Held back: GLASS/layers itself could not be run (no raw), so this rests on code plus the worker's check, not my own measurement.
- **Ease 5 → 6: EOU-6 lifted.** Reset now writes at once and offers "Reset from 37 · Undo" for 10 s, Undo pulls first and merges by value (`apps/tally.html` reset.onclick; review r1 item 2 fixed per `runs3/p2-undo-race.txt`); Remove counter has Undo too; − is aria-disabled at 0 and writes nothing. Reset is now a smaller soft pill with the rotate icon, below the pair. EOU-1 not earned: the Home card's + is one tap, but on the iPhone it is the fifth card of a carousel (`shots/home-card-390.png`, dots 5/5) and on the iPad it sits below the first screen (`shots/home-820.png` is scrolled), as the Timer's ruling.
- **Motion: MOT-5 +½ earned, MOT-2½ newly applied, net 0.** The Undo toast is the main destructive action's undo. But the first pull now moves −, + and Reset up 30 px on the iPad and the iPhone in both arms (`out/MOTION_cls.txt`, `MOTION_cls_held.txt`; was 0 moves): "New counter" appears below the controls when the count lands and the centred grid re-centres (visible in `pairs/main-loading-iphone-pwa-light.png` vs `main-typical`). 30 px is in MOT-2's 20-100 px half band.

## Held cells, re-checked

- **Typography 7 (TYP-4).** Rounded tabular numerals, `--font-numeral` + `--numeral-features`; about 162 px on the iPad for two digits; grouped large counts ("250,000"). code-scan: 0 under 11 px. The pill is now sentence case at `--fs-sm` semibold.
- **Colour 6 (COL-1).** Tick ring 3.67-4.09:1 in all six palettes (claims), the batch 1 disc fix holds. **Not re-measured:** no contrast/measure run covers the new text (Reset label on `--accent-fill`, "Counters · 8" in `--text-2` on `--accent-fill`, the Recent resets list, "View only" in `--text-2`). They are token pairs the gate covers in principle; COL-1 is held on that, not on a measurement.
- **Icons 5.5.** ICO-3 stays lifted; every icon is a sprite symbol (uses 4: minus, plus, rotate-ccw, plus on New counter); the tile is now `hash`, so the circle-plus collision is gone (no ICO-4). **ICO-1 not given:** + and − draw at `--icon-stroke × 1.8` (about 3.15 px) while Reset and New counter draw at `--icon-stroke` (1.75), two computed weights; Phase 4 withdrew ICO-1 from Prayer for mixed weights. Given, Icons 6.5 and the row 6.09.
- **Dark 6.5.** The corner art sits on `--art-plate` (`pairs/main-typical-ipad-landscape-dark.png`); dark dial and discs read; no dark-only failure seen.
- **Native 6.5.** NAT-4 stays lifted (skeleton, buttons visibly off while loading); TELL 4/4 unselectable, zoom 0, art `draggable=false`. NAT-6 not earned: no Tab-walk evidence (the counter sheet traps focus by code, not seen).
- **Glance 6.5 (GLA-2).** The iPad count is unchanged at about 162 px; room mode grows a six-digit count from 69 to 134 px on the iPad in portrait (claims 1c). TV view-only shows "0" large with "View only" (`shots/tv.png`).
- **Delight 4.5 (DEL-3).** A + tap still changes only the number (press scale and dim; no count animation, sound or haptic; the brief chose no sound). Faces on the pill and the art plate do not mark completion. The corner art is now hidden below 900 px width or 700 px height, so the iPhone and iPad portrait lose it (`pairs/main-typical-ipad-portrait-light.png`); not a rule, but a small Delight loss.

## Policy calls (stated so they can be overruled)

1. **SHP-2 given on code + the worker's check** because GLASS/layers had no raw data. If refused (Shape 6): row 5.95 → **5.9**.
2. **ICO-1 not given** for two stroke weights. Given: **6.1**.
3. **MOT-2½ applied** for a 30 px move of the primary + on first pull. Excluded: **6.05**.
4. **LAY-5 not given** for the short-landscape-phone side-by-side layout (it is a phone fix, not an iPad/desktop re-flow); the iPad and desktop keep a centred 360 px column.
5. **COL-1 held** without a fresh contrast run on the new surfaces.

Range: **5.9-6.1**. Central: **6.0**.

## Found, not fixed (I would still mark these down)

1. **First-pull jump (MOT-2½).** −, + and Reset move 30 px up when the count lands, iPad and iPhone, both arms (`out/MOTION_cls*.txt`). Fix: reserve the "New counter" row's height while loading (render it `visibility:hidden` instead of `hidden`), or align the column to the top.
2. **iPad landscape and desktop still a 360 px dial in an empty frame (LAY-2).** V2 span 360 at 1180 and 1440. Room mode proves a bigger dial fits; let the resting dial use `min(52vh, 46vw, 34rem)` on ≥ 1024 px.
3. **Kid iPad landscape and iPhone Safari: Reset (and its Undo route) is below the fold** (`cap2/tally/kid-typical-ipad-landscape-light.png`, `kid-typical-iphone-safari-light.png`), and **XXL kid on a landscape phone cuts the dial's lower half** (`rev/shots5/ezra-2c-844x390-xxl.png`). Secondary/narrow, so not scored.
4. **Two icon weights** (+/− at ~3.15 px, Reset/New counter at 1.75): one weight scaled per size would earn ICO-1.
5. **Breakpoint literals and kept literals.** TOK: 4 new literal breakpoints (899/600/560/768) off the documented set (390/744/1024/1180/1600); fontSize 2, shadow 3, z 1, opacity 1 left (GAP-TOK-4 partial).
6. **The Home Tally card is not on a first screen** (iPhone carousel slot 5; iPad below the fold), and on the iPad the card's + floats mid-card with a wide gap (`shots/home-820.png`): one tap, but not a glance.
7. **Corner art gone on iPhone and iPad portrait** (hidden below 900 px wide), where the app is used most.

## Device checks (not judged here)

- Press feel of +, −, Reset on a real iPhone and iPad (VIS-TALLY-7, GAP-MOTION-3; iOS `:active`).
- VoiceOver: the polite live region says the new count after +, −, Reset, Undo; the Home card announces only after a tap.
- Long-press on the count and art: no callout on iOS.
- Room mode on a real iPad (20 s idle, the waking tap only wakes; Reduce Motion instant).
- The Undo toast and its 64 px kid button on screen; the counter list sheet with VoiceOver and a keyboard (Tab walk, NAT-6).
- Real backdrop blur and SF faces (Typography/Shape provisional).

## Not verified by me

GLASS/layers and SHAPE/analyze (no measurement raw in the worktree; I did not run the measurement rig); contrast of the new text pairs; the Undo toast, the kid Home tile badge and the final Home card (no capture of them on the final code; the worker's Home shots predate the review rounds); test suites (I relied on `b11/runs5/claims.txt` 196/0 and the reviewer's runs, not my own).

---

## Re-score (2026-10-07, second pass, after the worker's fixes): 6.0 → 6.2

**Evidence.**
- **Fresh LF copy:** `b11/rescore/wt2` (`apps/tally.html` is now 429 lines). Tool outputs are in `b11/rescore/out2/`, all exit 0.
- **Captures:** 60 new captures `b11/cap3/tally/` against the same pre-batch set, as composites in `b11/rescore/pairs3/` (`pairs3.py`).
- **Opened at full size:**
  - main-typical: iPad landscape dark, iPad portrait light, iPhone light, desktop light;
  - kid-typical: iPad landscape light, iPhone Safari light;
  - main-loading iPhone light; kid-overflow iPad landscape dark; main-overflow iPhone dark.
- **Code diff** against the first pass (wt → wt2): main is now top-aligned; the dial is fitted down to Reset by an early `fit()` before the first paint; a landscape rule puts the dial beside the controls; the portrait ≥ 744 px cap is 32rem; the count font scales with the dial; `.manage.loading` keeps its row with `visibility:hidden`; `.tbtn svg.sym` lost its ×1.8 stroke; `placeArt()` replaces the size cut-off.

| Tool | First pass | Now |
|---|---|---|
| MOTION/cls lat150 | 3 moves, max 30 px (iPad, iPhone) | **0 moves, CLS 0** on both |
| MOTION/cls held | CLS 0.0076 / 0.0196, 30 px moves | **CLS 0, 0 moves** on both, with the skeleton shown |
| SHAPE/verify V2 tally | span 318 / 360 / 360 / 360 | 318 (iPhone) / **508** (iPad portrait) / **831** (iPad landscape, dial + controls) / **832** (desktop) |
| SHAPE/verify V4 kid | plus 168, minus 116, reset 133×64 | the same |
| MOTION/press | 4/4 | 4/4 |
| TELL | 4 `none`, zoom 0 | the same |
| ICON/static | uses 4, glyphs {} | uses 4, glyphs {}; no stroke-width in `tally.html` (every sym at design.css:820 `--icon-stroke`) |
| TOK/literals | 7 non-colour; breakpoints 899/600/560/768 | 7 non-colour; breakpoints **600 / 744 / 560 / 768** (744 is a documented one) |
| TYPE/code-scan | token 5, under-11 0 | the same |

GLASS/layers and SHAPE/analyze still cannot run (no measurement raw), as before.

### The row

| Dimension | Base | b1 | First pass | **Now** | Rules now applied |
|---|---|---|---|---|---|
| Typography* | 6 | 7 | 7 | **7** | TYP-4 |
| Colour | 5 | 6 | 6 | **6** | COL-1 (held, new pairs not measured) |
| Layout | 6.5 | 5.5 | 6 | **7** | LAY-5 (LAY-2, LAY-4 lifted) |
| Shape* | 6 | 5.5 | 6.5 | **6.5** | SHP-2 |
| Icons | 5.5 | 5.5 | 5.5 | **6.5** | ICO-1 |
| Motion | 4.5 | 4.5 | 4.5 | **5** | MOT-5 +½ (MOT-2½ lifted) |
| Dark | 6.5 | 6.5 | 6.5 | **6.5** | none |
| Native | 6.5 | 6.5 | 6.5 | **6.5** | none |
| Glance | 4.5 | 6.5 | 6.5 | **6.5** | GLA-2 |
| Ease | 6 | 5 | 6 | **6** | none |
| Delight | 5.5 | 4.5 | 4.5 | **4.5** | DEL-3 |
| **Average** | | **5.7** (5.73) | **6.0** (6.00) | **6.2** (68/11 = 6.18) | b1 → now **+0.5** |

### Cells that changed

- **Layout 6 → 7.**
  - **LAY-2 lifted.** The dial is about 543 px on the iPad in landscape and on the desktop, with − / + / Reset in a second column level with it (`pairs3/main-typical-ipad-landscape-dark.png`, `main-typical-desktop-light.png`). In portrait the dial is 508 px (`main-typical-ipad-portrait-light.png`). V2 spans 831 and 832 px. The frame is no longer mostly empty.
  - **LAY-5 earned.** The area reflows for the device: a second column in landscape on the iPad and the desktop, the same reading that gave the Timer LAY-5.
  - **LAY-4 stays lifted.** Long names and 250,000 fit (`kid-overflow-ipad-landscape-dark.png`, `main-overflow-iphone-pwa-dark.png`).
- **Icons 5.5 → 6.5: ICO-1 earned.**
  - Every control icon is a sprite symbol at the one `--icon-stroke`: −, +, the Reset rotate and the New counter plus. No glyph, no emoji.
  - The tile is `hash`, and the Home card's + uses the same sym rule (`index.html:277`, size only).
- **Motion 4.5 → 5: MOT-2½ lifted.**
  - Both cls arms show 0 moves and CLS 0 on the iPad and the iPhone.
  - The loading frame and the loaded frame hold the same positions (`pairs3/main-loading-iphone-pwa-light.png`: the dial, the pair and Reset sit where they do in `main-typical`).
  - MOT-5 +½ (Undo on Reset) stays. No second ½: the only animated state change is the room-mode dial, which already existed at batch 1 and earned nothing then.

### Held cells, re-checked

- **Typography 7.** The count is larger now (about 240 px for "37" on the iPad), still rounded and tabular.
- **Shape 6.5.** No `backdrop-filter` in the file. SHP-2 still rests on code plus the worker's claims check, not on GLASS/layers.
- **Dark 6.5.** The art plate shows in dark (`main-overflow-iphone-pwa-dark.png`). No dark-only failure seen.
- **Native 6.5.** TELL is clean. NAT-6 is still not earned: no Tab walk.
- **Ease 6.** EOU-1 is still not earned. I have no new Home capture: the worker says the card's + now sits beside the number, but the card's place on Home (iPhone carousel slot 5, below the fold on the iPad) is unchanged by this round's description.
- **Delight 4.5.** DEL-3 stays: a + tap still changes only the number. The corner art is back on the iPhone and the iPad in portrait wherever it touches nothing.
- **Kid route.** In kid iPhone Safari, + and Reset are now both on the first screen (`pairs3/kid-typical-iphone-safari-light.png`). In kid iPad landscape, Reset sits beside the controls (`kid-typical-ipad-landscape-light.png`).

### Policy calls (current)

| Call | Row if reversed |
|---|---|
| SHP-2 given on code plus the worker's check | 6.14 |
| COL-1 held without a fresh contrast run | 6.09 |
| MOT-5 second ½ not given | 6.23 |

Range: **6.1-6.2**. Central: **6.2**.

### Still found, not fixed

1. **The + and − glyphs are now hairlines on big discs.**
   - One 1.75 px stroke earns ICO-1, but on a 140-168 px disc the plus is a thin 70-84 px cross. It reads weaker than before and weaker than the Home card's + (`pairs3/main-typical-iphone-pwa-light.png`, `kid-typical-iphone-safari-light.png`).
   - Fix: keep one weight family by giving the disc icons a size-scaled `--icon-stroke` token (for example `--icon-stroke-xl`), used by every disc-size icon in the hub, rather than a local multiplier.
2. **DEL-3: the core tap gives only a changed number.** A brief count bump (a scale pulse on `.count`, off under Reduce Motion) would lift it.
3. **Landscape composition.**
   - The name pill and "New counter" are centred on the whole dial-plus-controls row, not on the dial, so the pill floats right of the dial's axis (`pairs3/main-typical-ipad-landscape-dark.png`, `kid-typical-ipad-landscape-light.png`).
   - The control column sits slightly above the dial's centre.
   - Small, but it reads unaligned. Fix: centre the pill over the dial, or left-align the header with the dial.
4. **EOU-1 not earned: the Home card is not on a first screen.** This is a shell placement call.
5. **Not measured by me:**
   - contrast of the new text pairs (Colour);
   - GLASS/layers and SHAPE/analyze (no raw);
   - the XXL landscape-phone and multi-counter states (no capture in `cap3`; the worker's claim, not seen);
   - the Undo toast, the kid tile badge and the Home card on the final code.

### Device checks (unchanged)

- The press feel of −, + and Reset on a real iPhone and iPad.
- VoiceOver announcing the count.
- No callout on a long-press.
- Room mode on a real iPad.
- The Undo toast at 64 px for a kid.
- A Tab walk through the counter sheet.
- Real blur and the SF fonts.
