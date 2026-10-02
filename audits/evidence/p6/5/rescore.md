# Phase 4 scorecard: the Verses row rescored after audit batch 5 (final, on the finished code)

**Independent judge, second pass.** The method is unchanged from the first pass (`rescore-5/rescore.md`): the bases are `hearth-shared` as re-priced in `audits/evidence/p6/1/rescore.md`, and only the row's rules change. Typography and Shape stay provisional (no backdrop blur, fallback fonts).

## Evidence, all on the finished code

**After captures:** `audits/screens-after/5/verses/*.png` (208). The capture now stubs `MediaRecorder`, so the recorder is in the shots.
- I opened 26 before/after pairs (composites in `rescore-5/pairs-final/`).
- They cover:
  - trainer typical (iPhone light, iPad portrait dark);
  - revealed (iPhone light; iPad landscape dark; revealed-overflow on iPad landscape);
  - text-veiled typical and overflow (iPhone, and iPhone Safari dark);
  - text-revealed (iPhone dark; overflow on iPad landscape);
  - rated (iPhone light, iPad portrait dark), done (iPhone light, iPad landscape dark), nothing-due, overdue (iPad dark), trainer overflow, practise-anyway;
  - kid typical (Safari, iPad landscape), kid revealed (iPhone light, Safari dark), kid done dark;
  - empty dark and loading.

**Measurements:** `SCRATCH/final-5b/measure/agg/*.json`, compared through `rescore-5/cmp-b.cjs` and `fp-b.cjs`.

**Phase 4 tools:** `audits/evidence/p6/5/p4tools/out` against `before` (TOK, TYPE, ICON, MOTION press/cls, SHAPE analyze, TELL tells-webkit).

**My own probes** on a refreshed scratch copy (`rescore-5/copy`, outputs in `rescore-5/chrome/`):
- where Show lands at 375, 390 and 430, in Chromium (recorder present) and WebKit;
- a Tab walk;
- the practice modes.

**Not run:** the capture rig.

## The row

| Dimension | Base | Before (b1) | First pass | **Final** | Rules now applied |
|---|---|---|---|---|---|
| Typography* | 6 | 6 | 6 | **6** | none |
| Colour | 5 | 4.5 | 4.5 | **6.5** | COL-1, COL-5 (COL-2½ lifted) |
| Layout | 6.5 | 6 | 5.5 | **6** | LAY-2 (LAY-3½ lifted) |
| Shape* | 6 | 5.5 | 6.5 | **6.5** | SHP-2 |
| Icons | 5.5 | 6.5 | 6 | **6** | ICO-1, ICO-4 |
| Motion | 4.5 | 4.5 | 5 | **5** | MOT-5 +½ |
| Dark | 6.5 | 6.5 | 6.5 | **6.5** | none |
| Native | 6.5 | 6 | 6.5 | **7** | NAT-6 (NAT-2 lifted) |
| Glance | 4.5 | 5.5 | 5.5 | **5.5** | GLA-1 |
| Ease | 6 | 5 | 6 | **6** | none |
| Delight | 5.5 | 5.5 | 6.5 | **6.5** | DEL-2 |
| **Average** | | **5.6** (5.59) | **5.9** (5.86) | **6.1** (6.14) | b1 → final **+0.5** |

## Cells that changed since the first pass

**Colour 4.5 → 6.5: COL-1 earned, COL-5 restored, COL-2½ lifted.**
- In all 7 theme keys, the only below-AA text is the disabled Show, Read aloud and Record during loading (`final-5b failing-pairs.json`). That is the same exempt class F260 and Prayer were scored on in batch 4.
- The Frost current row now uses `--text-2`: Frost has 0 failures, and the lowest `.cv` pair in any palette is 5.68 (Forest).
- COL-5 is restored. My first-pass withdrawal was tied to the failing pair. The row text is now design.css's selection pattern (`--sel-fill` under text inks), passing everywhere, and the hue fills (`#addtext`, the ratings, the chips) use their `-ink` or `-on` tokens. This is policy call 1.

**Layout 5.5 → 6: LAY-3½ lifted.** These are the frame coordinates of Show on the second card (John 17:3), at 375×667 (frame 619 px):

| Code and engine | Show top-bottom |
|---|---|
| Pre-batch | 506-566 |
| First pass, WebKit | 606-666 |
| First pass, Chromium (with the recorder) | 691-751 |
| **Final, WebKit** | **526-586** |
| **Final, Chromium** | **526-586** |

- Final at 390 and 430: 558-618 of 796 and 884.
- Evidence: `rescore-5/chrome/final-eli-375-c-next.png`.
- The 352-character verse at 375 still needs a scroll, as it did before the batch, so it is not a regression.
- LAY-2 stays: a 656 px column at 1180 and 1440.

**Native 6.5 → 7: NAT-2 lifted.**
- `tells-webkit`: 31 controls, 0 selectable, `imgsDraggable` 1 → **0** (the avatar now has `draggable=false`).
- NAT-6 holds: a re-run Tab walk rings on every stop, including the new in-card Undo (`#rated-undo`), Record, the queue rows and the four modes.

## Cells that held since the first pass, and why

- **Typography 6.** Nothing renders under 11 px; code-scan finds 42 tokens and 0 px literals.
- **Shape 6.5 (SHP-2).**
  - 0 of 356 jobs have content glass.
  - Off-concentric pairs went 4 → **0**; kid radii are 18 and 38 (roles); `--r-inset` is used throughout.
  - SHP-4 is not met.
- **Icons 6 (ICO-1 +1, ICO-4 −½ kept).**
  - Kid Got it is now a check, so the star collision is gone.
  - But kid **Almost is still a smile** while the adult Almost is `circle-dashed`, and kid "I said it" still uses Show's eye (`kid-revealed-typical-iphone-pwa-light`, `kid-typical-iphone-safari-light`). One meaning is still drawn two ways within the area. This is policy call 2.
- **Motion 5 (MOT-5 +½).**
  - The in-card result line with Undo replaces the toast.
  - Cold load: CLS 0 and 0 landmark moves on iPhone and iPad (was 2 moves of 27 px). Presses 7/7.
  - With the row reserved, the first rating no longer moves the card.
  - No second ½: the line only fades.
- **Dark 6.5.** No dark-only failure. Box 5 is still the brightest bar, now `--mint-strong` and less glaring (`trainer-typical-ipad-portrait-dark`, `overdue-typical-ipad-portrait-dark`). The workers kept it as "mastery", and it is not scored.
- **Glance 5.5, Ease 6, Delight 6.5.**
  - Glance holds: the reference keeps the glance size on the iPad (GLA-1).
  - EOU-1 is still not earned: Review now, then Show, then a rating is 3 taps.
  - DEL-2 holds for the practice modes and recording. No DEL-1 moment was added.

## First-pass issues: status

| # | First-pass issue | Status | Evidence |
|---|---|---|---|
| 1 | Show below the first screen on small iPhones | **FIXED** | 526-586 of 619 in both engines (`chrome/final-eli-375-c-next.png`); `text-veiled-typical-iphone-pwa-light` |
| 2 | The captures hide the recorder | **FIXED** | Record is visible in `trainer-typical-iphone-pwa-light`, `revealed-typical-iphone-pwa-light`, `trainer-typical-ipad-portrait-dark` |
| 3 | The top toast covers the pill | **FIXED** | In-card line with Undo (`rated-typical-ipad-portrait-dark`, `done-typical-iphone-pwa-light`); the pill stays readable. One residual, new issue B below |
| 4 | Frost AA on the current row | **FIXED** | 0 Frost failures; lowest pair 5.68 |
| 5 | The kid star collides with the reward star | **PARTLY** | Got it is a check now; Almost (smile) and "I said it" (eye) still differ from the adult drawings (`kid-revealed-typical-iphone-pwa-light`) |
| 6 | Two empty bands before Show | **PARTLY** | The band above the buttons is gone, but a new empty band sits at the card top (new issue A), and "Add the verse text" sits under a ratings-sized gap (`trainer-typical-iphone-pwa-light`, `trainer-typical-ipad-portrait-dark`) |
| 7 | `--r-lg` radii | **FIXED** | `SHAPE/analyze`: concentric bad 0; kid 18/38 |
| 8 | Dark histogram brightest bar | **Accepted as designed** (partly changed) | Box 5 is `--mint-strong` (`overdue-typical-ipad-portrait-dark`) |
| 9 | "2 weeks  tomorrow" | **FIXED** | "every 2 weeks  tomorrow" (`done-typical-iphone-pwa-light`) |
| 10 | First letters dot runs | **FIXED** | Hairline underlines (`chrome/final-mode-letters-light.png`) |
| 11 | Kid Undo 44 px | **FIXED** | Kid line Undo is 64 px (`kid-done-typical-iphone-pwa-dark`); `SHAPE` kid under44 0 |
| 12 | Draggable avatar | **FIXED** | `imgsDraggable` 0 |
| 13 | Toast wrap | **FIXED** (no toast) | — |

## New or still open, ranked

**A. Low: an empty band at the top of every first card in a visit.**
- **What is wrong:** the result-line row (44 px, 64 px for kids) is reserved from the first paint. So before any rating the kicker floats about 90 px below the card's top edge, over empty space. With the ratings gap below the buttons, the pre-Show card is top- and middle-empty.
- **Where:** `trainer-typical-iphone-pwa-light`, `revealed-typical-iphone-pwa-light`, `trainer-typical-ipad-portrait-dark`, `trainer-overflow-iphone-pwa-light`.
- **Smallest fix:** let the kicker ("Week 33 · Verse 1" and the chip) occupy that reserved row by default, and swap it for the result line for the line's 10 s. That gives the same height with no empty row.

**B. Low: after Show, the scroll-into-view pushes the result line under the viewer bar.**
- **What is wrong:** Undo is only half visible for the rest of the 10 s.
- **Where:** `text-revealed-overflow-ipad-landscape-light`.
- **Smallest fix:** in the reveal scroll, use `block: 'nearest'` on the trainer card rather than on the ratings when the result line is showing. Alternatively, give `#rated` a `scroll-margin-top` and scroll the card, not the ratings.

**C. Low: the kid icons still differ from the adult ones for the same meaning** (Almost: smile against dashed circle; "I said it": eye). This keeps ICO-4.
- **Where:** `kid-revealed-typical-iphone-pwa-light`, `kid-typical-iphone-safari-light`.
- **Smallest fix:** use `i-circle-dashed` at kid size for kid Almost (or the smile for both), and give "I said it" `i-check` or `i-mic`.

**D. Nit: the mode switch's items wrap to two lines on a phone.**
- **What is wrong:** "First / letters", "Fill the / gaps", "Word / order" beside a one-line "Recall" give a lumpy track.
- **Where:** `text-veiled-typical-iphone-pwa-light`, `chrome/final-eli-375-c-next.png`, `chrome/final-mode-letters-light.png`.
- **Smallest fix:** below 430 px use shorter labels ("Letters", "Gaps", "Order"), or `--fs-sm` on the items.

**E. Nit: in the scrolled overdue view no due count is visible.** The pill is off-screen and the list header reads "tap one to practise it" (`overdue-typical-ipad-portrait-dark`, `overdue-typical-iphone-pwa-light`). Smallest fix: "25 due · tap one to practise it" in the Due today header's right slot.

## Policy calls (stated so they can be overruled)

1. **COL-5 restored on the selection row.** Withheld: Colour 6 and the row 6.09 (6.1).
2. **ICO-4 kept for kid Almost and the eye.** Dropped: Icons 6.5 and the row 6.18 (6.2).
3. **COL-1 on the "disabled and loading only" exemption,** as for F260 and Prayer. Withheld: 6.05 (6.0 or 6.1).
4. **DEL-2.** Withheld: 6.05.
5. **EOU-1.** Counted (Review now and Show as 2 taps): 6.23 (6.2).

Range: **6.0-6.2**. Central: **6.1**.

## Not judged without a device

- Real blur.
- The SF faces.
- iOS `:active` presses.
- `.card-in`, the line's fade, and the Word order shake.
- Recording and its permission prompt on iOS.
- The focus ring after a touch rating; captures show a ring on Show and Practise.
- Read-aloud voices.
- The kid buttons on an iPad.
- The 7 pm push.
- The Home card and its grid (shell row).


# Verses rescore, confirmation addendum (third final run, final-5c)

This adds to `rescore-final.md`. The method, the bases and the policy calls are unchanged, and I did not run the capture rig.

**Evidence**
- 10 before/after pairs from `audits/screens-after/5/verses/`, as recaptured in the third run (composites in `rescore-5/pairs-confirm/`).
- The measurements in `SCRATCH/final-5c/measure/agg/`, compared with `rescore-5/cmp-c.cjs` and `fp-c.cjs`.
- `audits/evidence/p6/5/p4tools/out` against `before`. All 8 tools exit 0.

**What the measurements show**
- **Contrast.** The only below-AA text is the disabled Show, Read aloud and Record during loading. Every other pair passes in all 7 theme keys, and the lowest is 4.77.
- **Glass on content:** 0 of 356 jobs.
- **Small type:** nothing under 11 px.
- **Shape:** 0 off-concentric pairs; kid radii are 18 and 38. No adult or kid target is under 44 px.
- **Layout shift:** CLS 0 and 0 landmark moves on the iPhone and the iPad.
- **Presses:** 7/7.
- **Selection and dragging:** 0 selectable controls, 0 draggable images.
- **Icons:** 20 sprite uses and no own stroke widths.

None of these moved from final-5b.

## Final row

| Dimension | Base | b1 | First pass | Final (5b) | **Confirm (5c)** | Rules |
|---|---|---|---|---|---|---|
| Typography* | 6 | 6 | 6 | 6 | **6** | none |
| Colour | 5 | 4.5 | 4.5 | 6.5 | **6.5** | COL-1, COL-5 |
| Layout | 6.5 | 6 | 5.5 | 6 | **6** | LAY-2 (a 656 px column at 1180 and 1440) |
| Shape* | 6 | 5.5 | 6.5 | 6.5 | **6.5** | SHP-2 |
| Icons | 5.5 | 6.5 | 6 | 6 | **6** | ICO-1, ICO-4 (now for the mic; see C) |
| Motion | 4.5 | 4.5 | 5 | 5 | **5** | MOT-5 +½ |
| Dark | 6.5 | 6.5 | 6.5 | 6.5 | **6.5** | none |
| Native | 6.5 | 6 | 6.5 | 7 | **7** | NAT-6 |
| Glance | 4.5 | 5.5 | 5.5 | 5.5 | **5.5** | GLA-1 |
| Ease | 6 | 5 | 6 | 6 | **6** | none |
| Delight | 5.5 | 5.5 | 6.5 | 6.5 | **6.5** | DEL-2 |
| **Average** | | **5.6** (5.59) | **5.9** (5.86) | **6.1** (6.14) | **6.1** (6.14) | b1 → final **+0.5** |

No cell changed.
- **Layout:** A and B remove visible faults, but no rule was charging them; LAY-2 is unrelated and remains.
- **Ease:** E improves the copy, but no EOU rule moves. EOU-1 is still 3 taps (Review now, Show, a rating).
- **Native:** no change.
- **Icons:** ICO-4 now applies for a different reason (item C below).

**Policy call (new).** If the mic is read as "your voice" in both places, so that the two uses are one meaning, ICO-4 lifts: Icons becomes 6.5 and the row 6.18 (**6.2**). The range across all the policy calls is 6.0-6.2.

## A-E status

| Item | Status | Evidence |
|---|---|---|
| A: empty band at the card top | **FIXED** | The kicker and the result line share one slot. The card now starts at its padding (`trainer-typical-iphone-pwa-light`, `revealed-typical-iphone-pwa-light`), and the line sits where the kicker was (`text-veiled-typical-iphone-pwa-light`). The only empty space left before Show is the reserved rating room at the card foot. That space is deliberate (VIS-VERSES-1, no jump on Show) and is not scored. |
| B: the line scrolls under the viewer bar on an iPad in landscape | **FIXED** | The line and Undo are fully in view after Show (`text-revealed-overflow-ipad-landscape-light`). |
| C: the kid icons differ from the adult ones | **PARTLY FIXED** | Kid Almost is now `i-circle-dashed`, the same as the adult, and Got it is a check (`kid-revealed-typical-iphone-pwa-light`). But "I said it" is now `i-mic` (`kid-typical-iphone-safari-light`), the drawing the adult **Record** button uses (`trainer-typical-iphone-pwa-light`). One drawing now has two meanings within the area, so ICO-4 stays. A mic also suggests to a kid that the app is listening, and it is not. This follows my own first-pass suggestion ("i-check or i-mic"); `i-check` would have collided with Got it. **Smallest fix:** go back to `i-eye` for "I said it". It is the same reveal action as the adult Show, so it is one drawing with one meaning, and ICO-4 would lift (row 6.2). |
| D: the mode labels wrap | **FIXED** | "Recall · Letters · Gaps · Order" fits one row on the iPhone and the iPad (`text-veiled-typical-iphone-pwa-light`, `text-revealed-overflow-ipad-landscape-light`). |
| E: no due count in the scrolled overdue view | **FIXED** | The header reads "25 due · tap one to practise it" (`overdue-typical-iphone-pwa-light`). |

**Also checked**
- The kid sees one verse with its paraphrase, and the pill reads "Ezra · 1 to go" (`kid-revealed-typical-iphone-pwa-light`, `kid-typical-iphone-safari-light`).
- I did not judge `againIds` following a week change from a still. The core reviewer's e7 repro and test-verses 184/0 cover it.

## Open

- **Low, C:** the mic on the kid's "I said it" is the same drawing as the adult Record button. Fix: `i-eye`.
- Nothing else is new.
- The not-judged-without-a-device list from `rescore-final.md` stands.

## Addendum 2: item C on the recaptured code

**C is fixed.** I opened `kid-typical-iphone-pwa-light`, `kid-typical-ipad-portrait-light`, `kid-revealed-typical-iphone-pwa-dark` and `kid-revealed-typical-ipad-landscape-light` (composites in `rescore-5/pairs-c/`).
- **"I said it" uses `i-eye`.** It is the same `#show` button and the same reveal action as the adult Show, so it is one drawing with one meaning.
- **The rating buttons match the adult drawings.** Kid Almost is `i-circle-dashed` and kid Got it is `i-check`.
- **The mic means only voice input.** A grep of `apps/verses.html` finds `i-mic` only on Record (`:410`, plus the dynamic `label(recBtn, 'mic', …)` at `:1348` and `:1370`) and on the editor's "Say it" dictation (`:428`). Both are voice input, so that is one meaning too.

**ICO-4 is lifted.** No meaning is drawn two ways, and no drawing carries two meanings, within the area or against the shell. ICO-1 (+1) holds. Icons: 6 → **6.5**.

**Final row: 6.2** (6.18).

| Dimension | Score |
|---|---|
| Typography | 6 |
| Colour | 6.5 |
| Layout | 6 |
| Shape | 6.5 |
| Icons | **6.5** |
| Motion | 5 |
| Dark | 6.5 |
| Native | 7 |
| Glance | 5.5 |
| Ease | 6 |
| Delight | 6.5 |

- **History:** b1 5.6 → first pass 5.9 → final 6.1 → **6.2** (+0.6 over b1).
- **Policy-call range:** 6.1-6.2.
- **Open issues:** none.
- **Follow-up checks:** test-verses 184/0 and verses-look-5 275/0 (`audits/evidence/p6/5/followup/`), as reported. I did not re-run them.
