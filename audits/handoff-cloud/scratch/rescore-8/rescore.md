# Phase 4 scorecard: the Larder Ledger row after batch 8

**Independent judge.** Method: `audits/04-design-system.md` scorecard (bases + written rules TYP-1 … DEL-4, net per dimension clamped to ±2, 0.5 steps, row = mean of 11), applied as in `audits/evidence/p6/1/rescore.md` (Larder 5.5) and `audits/evidence/p6/6/rescore.md` (Timer). The hearth-shared bases are held at their batch 1 values (Typ 6, Col 5, Lay 6.5, Shp 6, Ico 5.5, Mot 4.5, Drk 6.5, Nat 6.5, Gla 4.5, EoU 6, Del 5.5). Rules are applied or lifted only on evidence below.

## Evidence

- **Captures.** After: `SCRATCH/b8e/cap2/leftovers/*.png` (184). Before: `SCRATCH/cap8-before/leftovers/*.png` (pre-batch code, the state since batch 2a).
- **34 before/after pairs** built in `SCRATCH/rescore-8/pairs/` (`comp2.mjs`): main-typical iPhone light/dark, iPad portrait light, iPad landscape light/dark, desktop light; main-overflow iPhone light and iPad portrait dark; lower-typical iPhone; lower-overflow iPad landscape dark; middle-overflow iPhone; add-typical iPhone and iPad landscape dark; kid iPhone light, iPad portrait light/dark, iPad landscape dark; main-loading, main-empty (dark), main-error (iPhone light, Safari dark), main-offline iPad portrait; stalled-loading; finished; copy; copy-error (PWA light, Safari dark); voice; voice-error dark; logged; queued-offline (iPad landscape light, iPhone dark); slow-sync.
- **Opened at full size:** after `main-typical-ipad-portrait-light` against before; `b8e/look2/bottom-overflow-390xxl`, `edit-sheet-390`, `kitchen-landscape`; `b8e/pieces/swipe-open-dark`, `some-left-dark`.
- **Measurements:** `b8e/look2/larder-look-8.json` (kitchen glance, bottom padding, icons, Log colours, names, kid geometry).
- **Static Phase 4 tools, run by me** on a copy of the worktree (`SCRATCH/rescore-8/wt`, outputs `wt/out/*.txt`):
  - TOK/literals, leftovers: colour 17 (the bootstrap map, as every file), **spacing 0** (was 44, 18 off the scale), line-height 1, shadow 5, glass filter 1, opacity 2, local literal 1 (`--addbar-h`). Every spacing value is now an `--sp-*` / `--pad-*` token, all on the 4 px grid for adults.
  - TYPE/code-scan: `{"token":38,"inherit/keyword":10,"clamp/calc":1}`, under-11 0 (the calc is the avatar initial).
  - ICON/static: svgTags 4, **uses 4, symbols 0, strokeWidths {}, glyphs only "…"** (was uses 0, ✓ ×7). `larder-look-8.json` icons: sprite uses i-triangle-alert, i-check, i-x, i-copy, i-mic, i-plus, one stroke 1.75 px, glyphs [].
- **Not run (final run):** contrast, SHAPE/analyze and SHAPE/verify, MOTION/press and MOTION/cls, TELL, GLASS/layers, DARK/art-dark. Cells resting on them are marked *provisional* below.

## The row

| Dimension | Base | b1 (5.5) | **After b8** | Rules now applied | Change |
|---|---|---|---|---|---|
| Typography* | 6 | 6 | **6** | none | held |
| Colour (prov.) | 5 | 6.5 | **6.5** | COL-1, COL-5 | held |
| Layout (prov.) | 6.5 | 4.5 | **6** | LAY-2 | LAY-1, LAY-3½, LAY-4 lifted |
| Shape* (prov.) | 6 | 6.5 | **6.5** | SHP-2 | held |
| Icons | 5.5 | 5 | **6** | ICO-1, ICO-4 | ICO-1 earned |
| Motion (prov.) | 4.5 | 5 | **5.5** | MOT-5 (+1) | second ½ earned |
| Dark (prov.) | 6.5 | 6.5 | **6.5** | none | held |
| Native (prov.) | 6.5 | 5.5 | **6.5** | none | NAT-3 lifted |
| Glance | 4.5 | 3.5 | **4** | GLA-3½ | halved (policy 2) |
| Ease | 6 | 6 | **7** | EOU-1 | EOU-1 earned |
| Delight | 5.5 | 5.5 | **5.5** | none | held |
| **Average** | | **5.5** | **6.0** (66/11 = 6.00) | | **+0.5** |

Range under the policy calls below: **5.9-6.1**. Central **6.0**.

## Cells that changed, with the evidence

**Layout 4.5 → 6 (net −2 clamped → −½).**
- **LAY-1 lifted (provisional on SHAPE/analyze).** Batch 1's 45.8 % macro grid came from `row-gap 10`, `padding 14`, `margin 2/18/114`. TOK/literals now finds 0 spacing literals; every gap and pad is `--sp-1…16` / `--pad-card`, all 4 px multiples for adults (the kid ×1.25 scale stays excluded by batch 1's policy). The final run's SHAPE/analyze must confirm ≥ 90 %.
- **LAY-4 lifted.** Long names now wrap to two lines with a tap to the full name in the edit sheet, owners are faces, nothing runs under the chip or ✓: `pairs/main-overflow-iphone-pwa-light.png`, `pairs/main-overflow-ipad-portrait-dark.png` (before: "Forgotten jar of homema…", "Elizabeth Anne Marguerite" wrapping into the meta). `larder-look-8.json` names-820: 0 cut. Kid cards wrap whole (`kidGeom` cut 0).
- **LAY-3½ lifted (policy call 1).** The bar is still glass over the scrolling list, but nothing can stay under it: the page pads to the measured bar + 16 px at every width (`bottom`: last block ends 15.6-16 px above the bar at 375/390/430/820/1180/1440 and XXL; `b8e/look2/bottom-overflow-390xxl.png`), a new entry is scrolled above the bar with a toast (`pairs/queued-offline-iphone-pwa-dark.png`), and the Copy block clears it (`pairs/lower-typical-iphone-pwa-light.png`, `pairs/lower-overflow-ipad-landscape-dark.png`). A fixed toolbar over scrolling content is the iOS pattern; what LAY-3 charged was content that could not get out from under it.
- **LAY-2 stays.** The person's iPad landscape and desktop keep the 560 px column with over half the frame empty (`pairs/main-typical-ipad-landscape-light.png`, `pairs/main-typical-desktop-light.png`). Only the kitchen widens to 840.

**Icons 5 → 6.**
- **ICO-1 earned (+1).** Every control icon is a sprite `<use>` at one stroke (1.75 px): Log plus, mic, Copy, the ✓, the swipe Finish, the banner triangle, the chip icons. No text glyph remains (ICON/static glyphs "…" only, the Loading text). `pairs/main-typical-iphone-pwa-light.png`, `pairs/lower-typical-iphone-pwa-light.png` (copy icon).
- **ICO-4 held, for a new reason.** The old reason (the refresh glyph on Copy, VIS-LEFTOVERS-9) is fixed. But one card now shows the same check twice with two meanings: a status ("✓ Fresh") directly above an action ("✓" = mark used up / Finish), and "Use it up" wears the X that means close / remove in the shell (`main-typical-ipad-portrait-light.png`, `pieces/swipe-open-dark.png`).
- **Watch: the "Some left" swipe action and card line use a CSS mini-bar (`.pbar`) where the Finish action has a sprite icon** (`pieces/swipe-open-dark.png`, `pieces/some-left-dark.png`). I read it as a data mark, not an icon (policy call 3); read as a CSS shape standing in for an icon it withdraws ICO-1 and adds ICO-2.

**Motion 5 → 5.5 (MOT-5 now +1).** The finish already had its 6 s Undo (+½, `pairs/finished-typical-iphone-pwa-light.png`). New: the trailing swipe tracks the finger, settles on `--spring-snappy`, can be grabbed mid-settle, and a full swipe finishes through the same Undo path (`leftovers.html:842-888`, transform transition `:131-132`; linear under Reduce Motion). That is the "animated, interruptible state change". Not seen in stills. MOT-2 stays lifted pending MOTION/cls; see issue 4 for an 18 px move I saw.

**Native 5.5 → 6.5 (NAT-3 lifted).** The size select and date field are `appearance: none` in the shared field style with a drawn caret, matching the name field (`pairs/main-typical-iphone-pwa-light.png`, before: grey native select). The ISO "2026-09-22" is Windows WebKit's rendering of a date input; iOS shows a localized date and its own picker. A rig artefact never drives a rule. NAT-2 and NAT-4 stay lifted (skeleton, `pairs/main-loading-iphone-pwa-light.png`). NAT-6 not given: no Tab walk.

**Glanceability 3.5 → 4 (GLA-3 halved, policy call 2).** On the Kitchen iPad the oldest item's name and age are `--fs-glance-3` (44 px), cap 5.96 mm on the 11" iPad, about 2.05 m at H2, portrait and landscape (`look2/kitchen-landscape.png`, `larder-look-8.json` kitchen). So "nothing reads beyond about 1 m on the iPad" is no longer true of the area. On a person's own iPad the key fact is still about 18 px (`main-typical-ipad-portrait-light.png`). Consistent with the Timer's policy that a kitchen-only reading earns no bonus, I halve the deduction rather than lift it.

**Ease 6 → 7 (EOU-1 earned).** Phase 4 withheld EOU-1 only because Log and the ✓ were 48-52 px. Log is now `--btn-h-lg` (60 px, `pairs/main-typical-iphone-pwa-light.png`, in the fixed bar on the first screen at every size). Logging is Home → Larder → Log: 2 taps. EOU-6 stays lifted (finish, Some left and edit each have Undo or Save), EOU-3 stays lifted (kid picture view, 64 px pictures, `pairs/kid-typical-iphone-pwa-light.png`).

## Held cells, re-checked

- **Typography 6.** 38 role tokens, none under 11 px. In the frame the "The Larder Ledger" title is hidden (CONS-TYPE-1, the viewer bar names the app); no TYP rule changes.
- **Colour 6.5 (provisional).** COL-1 now also has to hold for the person-coloured Log: Eli periwinkle (79,82,216) and Mae peach (170,68,0) under white both compute about 5.9:1 (`logColours`), and dark Log is the pale strong with a dark label. The new amber sync line with Retry (`pairs/main-error-iphone-pwa-light.png`) and the faces are on tokens. The final contrast run, all profiles, decides.
- **Shape 6.5 (provisional).** Cards are solid; glass only on the add bar and the edit sheet (control layer; the sheet's ghosting in `edit-sheet-390.png` is the rig's missing blur). The add bar's four off-concentric pairs should be gone (bar `--r-card` 28 = field `--r-control` 12 + `--pad-card` 16); SHAPE/analyze to confirm. No SHP rule beyond SHP-2 is in reach.
- **Dark 6.5 (provisional).** No dark-only failure seen (`pairs/main-typical-ipad-landscape-dark.png`, `pairs/main-error-iphone-safari-dark.png`, `pieces/swipe-open-dark.png`). The empty-state fridge plate is unchanged (VIS-LEFTOVERS-7 stopgap; `pairs/main-empty-iphone-pwa-dark.png`), under a quarter of the screen, so no DRK-5.
- **Delight 5.5.** Faces on every card (`pairs/main-typical-iphone-pwa-light.png`) are the base's "faces wherever a person appears", not a DEL-1 moment. The swipe with Some left is good iOS craft but has equivalents elsewhere (no DEL-2).

## Policy calls (stated so they can be overruled)

1. **LAY-3½ lifted** because the bar no longer hides anything that cannot be scrolled clear. Held: Layout 5.5, row **5.95**.
2. **GLA-3 halved** for the kitchen-only reading. Lifted fully: Glance 4.5, row **6.05**. Held fully: 3.5, row **5.95**.
3. **The `.pbar` read as a data mark.** Read as an icon stand-in: ICO-1 withdrawn and ICO-2 applied, Icons 4, row **5.8**. Cheap to remove (issue 1).
4. **NAT-3 lifted** on the rig-artefact rule. Halved instead (the date shows ISO in some browsers): Native 6, row **5.95**.

## What still keeps the score down, ranked (with the cheapest fix)

1. **"Some left" has no icon; a CSS mini-bar stands in** (Icons, policy call 3). `b8e/pieces/swipe-open-dark.png` (orange action), `b8e/pieces/some-left-dark.png` (the card line looks like a switch). Fix: draw one Lucide-style symbol into `icons/sprite.svg` (e.g. `i-circle-half` or a half-filled container) and use `sym()` on both; keep the freshness bar as the only bar. Removes the ICO-1 risk.
2. **The check and the X each carry two meanings** (ICO-4, −½). `cap2/leftovers/main-typical-ipad-portrait-light.png`: "✓ Fresh" sits right above the ✓ that finishes the item; "✕ Use it up" uses the shell's close/remove X. Fix: keep `i-check` for the finish action only; give Fresh a non-check mark or none (the word already differs), and Use it up an existing sprite drawing such as `i-flame` or `i-timer`. Lifts ICO-4: Icons 6.5, row **6.05**.
3. **The 560 px column on the person's iPad landscape and desktop** (LAY-2, −½). `pairs/main-typical-ipad-landscape-light.png`, `pairs/main-typical-desktop-light.png`. Fix: from 1024 px, lay the three groups in two columns (Use it up + Eat soon | Fresh + Recently finished) inside `--col-wide`, the add bar keeping the same width. Lifts LAY-2 and earns LAY-5 (+½ each): Layout 7, row **6.1**. Medium effort.
4. **Chip and ✓ stack in every card at every width**, so cards are about 30 % taller than before and the first screen holds fewer items: iPhone 3.5 cards against 4.5, iPad portrait 5.5 against 6 plus the Copy block. `pairs/main-typical-iphone-pwa-light.png`, `pairs/main-typical-ipad-portrait-light.png`. No rule, but it costs the at-a-glance list. Fix: a container query on `.body` (chip beside the ✓ when the card is ≥ about 480 px, i.e. iPad and desktop), or move the chip onto the meta line on the iPhone.
5. **Orphaned "6 IN THE FRIDGE" caption in the frame.** With the title hidden, the mono count sits alone top-right over a 40-60 px empty band (`pairs/main-typical-iphone-pwa-light.png`, `look2/kitchen-landscape.png`). It also appears only after load, moving the subtitle about 18 px down (`pairs/main-loading-iphone-pwa-light.png` vs `main-typical`), a MOT-2 risk for the final cls run. Fix: put the count on the subtitle's row (right-aligned, same baseline) and render the row's space while loading.
6. **Glance on the person's own iPad** (GLA-3½). `cap2/leftovers/main-typical-ipad-portrait-light.png`: the oldest item about 18 px. Fix: on any iPad (≥ 768 px), give the banner "Chicken alfredo is 8 days old" `--fs-title2` or the first Use-it-up card the kitchen's glance-3 name and age. Would lift GLA-3 fully: row **6.05**.
7. **No Tab-walk evidence** (NAT-6, +½ unclaimed). The edit sheet traps Tab and rings its fields (`look2/edit-sheet-390.png`), the card name is a focusable button. Fix: record a Tab walk in the final run (TELL); if every stop rings, Native 7, row **6.05**.
8. **Toast over the add bar's fields.** "Logged Chicken tortilla soup" covers Size and Date (`pairs/queued-offline-iphone-pwa-dark.png`); the finish toast likewise (`pairs/finished-typical-iphone-pwa-light.png`, as before). Cosmetic. Fix: lift the shared toast above the bar while the Larder shows it (`--addbar-h` + gap as its bottom offset).

## Not judged without a device

The blur on the bar and the sheet, the system fonts, iOS presses, the swipe and its spring, iOS edge back-swipe against the swipe, the iOS date control's look, dictation, navigator.share, the kitchen from 2 m by eye, a Tab walk.
