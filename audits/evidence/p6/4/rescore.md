# Phase 4 scorecard, F260 and Prayer rows rescored after audit batch 4

Independent judge. Method: `audits/04-design-system.md` lines 24-241 (shared bases + written rules TYP-1 … DEL-4, net adjustment per dimension clamped to ±2, cells 1-10 in 0.5 steps, row = mean of 11). The bases are `hearth-shared` as re-priced in `audits/evidence/p6/1/rescore.md` and are **not** re-priced here; only each row's rule adjustments change. Typography and Shape stay provisional: the rig paints no backdrop blur and renders fallback fonts.

**Evidence.** F260: before = batch 1's row (5.4), checked against the pre-batch control `SCRATCH/cap4-before/f260/*.png`; after = `audits/screens-after/4/f260/*.png` (629). 33 pairs opened (Today typical/done/overflow/loading/behind, Read ahead, Journal action, catch-up, weeks pane, heatmap, practice and practice fold, journal locked/empty/entries/passcode, reading mode and reading-mode week at all four sizes, settings and settings-more with the segmented controls, reset confirm, print, milestones, large text; light + dark; iPhone, iPad both orientations, desktop). Prayer: before = batch 3's final row (5.6) on `audits/screens-after/3/prayer/`; after = `audits/screens-after/4/prayer/` (809); 18 pairs opened (Today typical/family/done/loading, List open and desktop dark, Record, Settings and by-day, Add, detail sheet, Share & print, Pray mode, kid iPad light and iPhone dark, Kitchen, list loading). Composites and crops in `SCRATCH/rescore-4/`. Measurements: `audits/evidence/p6/4/measure/*.json` against `p6/1` and `p6/3`; the final-run `tells.json` (`SCRATCH/final-4/measure/agg/`); SHAPE/analyze re-run on the final raw data into `SCRATCH/rescore-4/analyze.txt` (repo file untouched; its radius list is stale, so radii are judged against design.css `--r-*`: 6, 12, 28, 32, 999, kid 38); Worker B's phase 4 log (`SCRATCH/b4b/p4-final.log`: MOTION/cls, MOTION/press, TYPE/code-scan, ICON/static) and Worker P's (`SCRATCH/b4p/final/m/`); `review/workers-and-reviews.md`.

## The rows

| Dimension | Base | F260 before (b1) | **F260 after** | F260 rules now | Prayer before (b3) | **Prayer after** | Prayer rules now |
|---|---|---|---|---|---|---|---|
| Typography* | 6 | 5 | **5.5** | TYP-1½ (TYP-2 lifted) | 6.5 | **6.5** | TYP-5 |
| Colour | 5 | 5 | **6** | COL-1 | 5 | **6** | COL-1 (policy 1) |
| Layout | 6.5 | 5.5 | **6.5** | LAY-4, LAY-5 (LAY-1, LAY-2 lifted) | 5 | **6** | LAY-2 (LAY-1 lifted) |
| Shape* | 6 | 6 | **6.5** | SHP-2 (SHP-4 lifted) | 6 | **6.5** | SHP-2 (SHP-4 lifted) |
| Icons | 5.5 | 3.5 | **4.5** | ICO-2 (was ICO-2b) | 5 | **5.5** | none (ICO-4 lifted) |
| Motion | 4.5 | 4.5 | **5.5** | MOT-5 +1 (MOT-2 lifted) | 5 | **5** | MOT-2½, MOT-5 +1 |
| Dark | 6.5 | 6.5 | **6.5** | none | 6.5 | **6.5** | none |
| Native | 6.5 | 5 | **6** | NAT-2, NAT-4, NAT-6 (NAT-3 lifted) | 6 | **6** | NAT-2, NAT-3½, NAT-6 |
| Glance | 4.5 | 5.5 | **5.5** | GLA-1 | 4.5 | **4.5** | none |
| Ease | 6 | 6.5 | **7** | EOU-1 (EOU-5½ lifted) | 6 | **6** | EOU-1, EOU-6 |
| Delight | 5.5 | 6.5 | **6.5** | DEL-1 | 6.5 | **6.5** | DEL-1 |
| **Average** | | **5.4** (5.41) | **6.0** (6.00) | +0.6 | **5.6** (5.64) | **5.9** (5.91) | +0.3 (+0.2 from batch 4, +0.1 policy 1) |

## F260: changed cells

- **Typography 5 → 5.5.** TYP-2 lifted: 68 calc sizes → 0, 117 role tokens (code-scan); rendered sizes 66 → 36 and Dynamic Type share 6.5 → 27.6 % (`measure/type.json`), level with Prayer (34), which is not charged. TYP-1½ added (new): `.hero .streak small` "· best 47" renders at **10.8 px** (n 8, `type.json` under11; `today-week-done-typical-desktop-dark`). It inherits `smaller` from `--fs-footnote`; batch 1 had none.
- **Colour 5 → 6: COL-1 earned.** Below-AA text 69 → 197 occurrences, but every one is now a disabled control in its measured state (Lock now, Change passcode, Erase, Face ID Enable/Turn off, journal search, sort, Copy all while locked or empty) or the toast mid fade-in (3); the resting failures of batch 1 (complete-week numbers, print sub-title, Open passage, Reading mode) are gone (`failing-pairs.json`). The disabled look is visible (`settings-more-typical-iphone-pwa-dark`, `journal-locked-typical-iphone-pwa-light`). Same exemption Kid Verse got in batch 1.
- **Layout 5.5 → 6.5.** LAY-1 lifted: macro spacing on the 4 px grid 36.8 → **93.3 %** (re-run on the final 523 jobs; Worker B's 85.2 % mixed pre-batch states data). LAY-2 lifted: iPhone margin 20 px (was 7/12), iPad portrait a 720 px column, landscape and desktop two panes with the weeks pane opening at the current week (`plan-typical-ipad-landscape-light`). LAY-4 added (new regression): in reading mode at ≥ 1024 px the "This week" card lies over the current week's header, hiding "Week 38 NOW", with the week ring peeking out beside Set passcode (`reading-mode-week-typical-ipad-landscape-dark`, `-desktop-light`; iPhone and iPad portrait are fine). LAY-5 holds.
- **Shape 6 → 6.5: SHP-4 lifted.** Large radii 95.4 % on the scale; against `--r-*` every large radius is a role except the 26 px pill clamp. Done, Journal and Read ahead are capsules; the four settings choices and Plan/Journal share one segmented recipe (`settings-typical-ipad-portrait-dark`). The practice modal is now solid (`practice-typical-iphone-pwa-light`).
- **Icons 3.5 → 4.5: ICO-2b → ICO-2.** One sprite at one weight replaces emoji and mixed strokes: the milestone emoji (📖 ✏️ 💯 🔥 ♪) are sprite symbols (`milestones-typical-ipad-landscape-dark`), the flame, external-link, chevrons and pen too (`today-typical-iphone-pwa-light`). Text ✓ stays beside the drawn check ("READ TODAY ✓", the "✓ Acts 6 · next" toast; ICON/static ✓4 ★1, emoji 13 → 1), so two families remain.
- **Motion 4.5 → 5.5: MOT-2 lifted.** Landmark moves on a held pull 9 (317/514 px) → 0; cold CLS 0.0463 → 0.0011 (MOTION/cls). Presses 56/102 → 105/105 at 0.97 (MOTION/press; MOT-1 was not charged).
- **Native 5 → 6: NAT-3 lifted.** The native "Show passcode" checkbox is a switch (`journal-typical-iphone-pwa-dark`); native forms 1 → 0 (`tells.json`). NAT-2 holds: dialog cards are still selectable text and the journal empty-state image (`.empty img.il`) has no drag guard. NAT-4 holds: on Hearth light the loading numbers have no visible placeholder, reading "of 260 readings", "of  chapters" (`today-loading-iphone-pwa-light`; visible in dark).
- **Ease 6.5 → 7: EOU-5½ lifted.** Today's HEAR entry is the Journal action on the Today card (2 taps + passcode, was 6 taps and a 1,100 px scroll), Settings is a header gear (`today-typical-iphone-pwa-light`).

## Prayer: changed cells

- **Layout 5 → 6: LAY-1 lifted.** Macro spacing on the grid 44.6 → **92.3 %** (`analyze.txt`, 649 jobs). LAY-2 holds: still a 552-560 px column leaving over half of iPad landscape and desktop empty (`settings-byday-typical-ipad-landscape-light`).
- **Shape 6 → 6.5: SHP-4 lifted.** Batch 3 held it at 50.8 % large radii on the old list; against `--r-*` every large radius is a role (6, 12, 28, 32, kid 38), and Pray now and Share & print are now one capsule pair (`today-typical-iphone-pwa-light`), as are Pray mode's Back/Prayed/Skip (`pray-mode-typical-iphone-pwa-light`).
- **Icons 5 → 5.5: ICO-4 lifted.** Its cause, the ⊕ Add tab against the Tally tile, is now the sprite plus (`list-open-typical-iphone-pwa-light`); every icon is a sprite symbol. ICO-1 still not earned: kid icons draw at 2.25 and adult at 1.75.
- **Colour 5 → 6: COL-1 (policy call 1, not a batch-4 effect).** Prayer's 162 below-AA occurrences are unchanged and all disabled or loading (`failing-pairs.json`). Batch 3 held COL-1 only so as not to reopen batch 1; with F260 awarded on the same evidence class, holding it for Prayer would score identical conditions differently.

## Cells that held, and why

- **F260 Dark 6.5, Glance 5.5, Delight 6.5:** no new dark-only failure; the key fact is still `--fs-glance-2` on the iPad (`today-done-typical-ipad-portrait-light`); DEL-1 holds (milestones, Read ahead).
- **Prayer Typography 6.5:** no size change; icons now scale with the text size, which no rule prices.
- **Prayer Motion 5 (MOT-2½ kept):** Pray now's move fell 60 → 5 px (iPhone) and 12 → 6 px (iPad), but on a held pull `#todayList` still moves 76 px (CLS 0.044 / 0.033) when the review prompt lands. The rule names "a primary action or block", so the half stays. Presses are now .pressable on every control (19/19, kid 9/9); MOT-1 was not charged.
- **Prayer Native 6:** selectable controls 10 → 0, but the empty-state `<img>` has no drag guard (NAT-2), and Active plan and Category are still OS selects in settings (NAT-3½). Loading now shows placeholders in the loaded content's space (`today-loading-iphone-pwa-light`).
- **Prayer Dark 6.5, Glance 4.5, Ease 6, Delight 6.5:** the segmented track is now visible and items are 44 px capsules, but no rule moves; EOU-6 kept as in batches 1 and 3.

## Policy calls (stated so they can be overruled)

1. **COL-1 for both rows** (above). Without it: F260 5.9 (5.91), Prayer 5.8 (5.82).
2. **F260 LAY-2 lifted.** Margins are 50 px (portrait, a centred 720 px column) and 32 px (landscape, two panes). If that is read as a jump between orientations, LAY-2 stays: F260 5.95 → still 6.0 rounded, 5.9 with policy 1 too.
3. **F260 LAY-1 at 93.3 %** (fresh data). On Worker B's 85.2 %, LAY-1 is half: −0.05.
4. **Prayer MOT-2½ kept** on the 76 px list move. If only the primary action counts (as batch 3 read it), Motion → 5.5 and Prayer → 6.0.

## Worse in batch 4 (fix before commit)

1. **F260 reading mode at ≥ 1024 px: the "This week" card covers the current week's header.** "Week 38 NOW · started" is hidden behind it, and the week ring shows beside Set passcode. `audits/screens-after/4/f260/reading-mode-week-typical-ipad-landscape-dark.png`, `…-desktop-light.png` (fine at 390 and 820). Probably the `.side` card keeping its sticky position after P3-F260-09 un-hid it. Scored LAY-4 (−½).
2. **F260 "· best 47" at 10.8 px**, under the 11 px floor: `.hero .streak small` inherits `font-size: smaller` from `--fs-footnote` (was 11.25 px from 13.5 px). Give it `--fs-caption1`. Scored TYP-1½.
3. **Segmented controls wrap into multi-row tracks on the iPhone.** Theme is three rows of a tan track, and "Open passages in" puts BibleGateway alone on a full-width row (`settings-typical-iphone-pwa-light`). Readable and unclipped, but not an iOS idiom (iOS would use a list with checkmarks). Not scored.
4. **Small wraps:** the catch-up line splits "Jeremiah 1-/3:5" across lines (`behind-typical-iphone-pwa-light`), and at Large text "~4 min" wraps alone onto its own line (`large-text-typical-iphone-pwa-light`). Cosmetic, not scored.

**Not worse, but cheap to fix.** F260's loading placeholders are invisible on Hearth light: give them `--track`, as Prayer now does. Both apps' empty-state images are draggable (`pointer-events:none`). Either fix lifts a rule: NAT-4 and NAT-2, about +0.05 each.

## Not judged without a device

- Real blur and the SF faces.
- Press feel on iOS `:active` (GAP-MOTION-3), long-press, springs and exits (stills only).
- The external sprite served offline from the service worker in an installed PWA.
- iOS select pickers (Week, Active plan, Category).
- Nested scrolling of the weeks pane on a real iPad in landscape.
- The iOS keyboard on the Journal focus.
- Face ID controls.
- Read-aloud.
- The Kitchen view read from across a room.
- Kid icons at 2.25 strokes at arm's length.
