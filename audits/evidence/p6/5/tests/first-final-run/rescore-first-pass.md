# Phase 4 scorecard: the Verses row rescored after audit batch 5

**Independent judge.** Method: `audits/04-design-system.md` lines 24-241 (shared bases plus the written rules TYP-1 … DEL-4; the net adjustment per dimension is clamped to ±2, cells run 1-10 in 0.5 steps, and the row is the mean of 11 cells).
- The bases are `hearth-shared` as re-priced in `audits/evidence/p6/1/rescore.md`. They are **not** re-priced here; only the row's rule adjustments change.
- Typography and Shape stay provisional, because the rig paints no backdrop blur and renders fallback fonts.

**Evidence.**
- **Before:** batch 1's row (5.6, `p6/1/rescore.md:56`), checked against the pre-batch control `SCRATCH/cap5-before/verses/*.png`.
- **After:** `audits/screens-after/5/verses/*.png` (208). I opened 35 before/after pairs (composites are in `rescore-5/pairs/`). They cover:
  - trainer typical at 390, 820, 1180 and 1440, light and dark;
  - revealed iPhone light and iPad portrait dark, and revealed overflow on iPad landscape;
  - text-veiled typical and overflow on the iPhone, and text-revealed iPhone dark and iPad landscape overflow;
  - done, iPhone light and iPad landscape dark;
  - empty, iPhone light and iPad portrait dark;
  - nothing-due on iPhone and iPad portrait, overdue on iPhone and iPad portrait dark, and trainer overflow;
  - loading, stalled loading and offline;
  - the kid states: typical on iPhone and iPad landscape, revealed on iPhone, iPhone Safari dark and iPad portrait, done in dark, and overflow;
  - rated (the toast) on iPhone and iPad portrait dark;
  - practise-anyway on iPhone and desktop dark.
- **Crops:** `rescore-5/crops/` (the histogram in light and dark, the toast in light and dark).
- **Large text:** the worker's XXL look shots (`SCRATCH/b5b/look/*-xxl-*`).
- **Measurements:**
  - `SCRATCH/final-5/measure/agg/*.json` against `audits/evidence/p6/1/measure` and the committed `audits/evidence/p4/measure` (script: `rescore-5/cmp.cjs`, `fp.cjs`, `nt.cjs`).
  - Phase 4 tools re-run on a scratch copy (`rescore-5/copy`, outputs in `rescore-5/out/`): TOK/literals, TYPE/code-scan, ICON/static, SHAPE/analyze (on the final-5 raw jobs), MOTION/cls (held and lat150), MOTION/press, and TELL/tells-webkit verses.
  - My own probes: `rescore-5/chrome.mjs`, `webkit.mjs` and `webkit-before.mjs` (where Show lands on small iPhones, after and before), `tabwalk.mjs` (a keyboard ring on every Tab stop), and `modes.mjs` (the practice modes).
  - The repo's `audits/evidence/p4` is untouched.
- **What changed:** `SCRATCH/b5.md`, `b5-carry.md`, `b5-report.md`.

**One evidence gap the captures hide.**
- The capture rig's WebKit has no `MediaRecorder` (`canRec: "undefined"`), so **none of the 208 shots shows the "Record yourself" row**.
- `paintRecorder()` (`apps/verses.html:1288-1294`) shows that row on **every adult card** wherever `MediaRecorder` exists, which is every current iPhone, iPad and desktop browser.
- In Chromium the row adds about 85 px between the hint and Show (`rescore-5/chrome/eli-390-a.png`, `eli-390-c-next.png`). I judged the real card with it.

## The row

| Dimension | Base | Before (b1) | **After** | Rules now applied |
|---|---|---|---|---|
| Typography* | 6 | 6 | **6** | none |
| Colour | 5 | 4.5 | **4.5** | COL-2½ (was COL-2); COL-5 withdrawn |
| Layout | 6.5 | 6 | **5.5** | LAY-2, LAY-3½ (new) |
| Shape* | 6 | 5.5 | **6.5** | SHP-2 (SHP-1½ lifted) |
| Icons | 5.5 | 6.5 | **6** | ICO-1, ICO-4 (new) |
| Motion | 4.5 | 4.5 | **5** | MOT-5 +½ |
| Dark | 6.5 | 6.5 | **6.5** | none |
| Native | 6.5 | 6 | **6.5** | NAT-2, NAT-6 (new) |
| Glance | 4.5 | 5.5 | **5.5** | GLA-1 |
| Ease | 6 | 5 | **6** | none (EOU-5 lifted) |
| Delight | 5.5 | 5.5 | **6.5** | DEL-2 (new) |
| **Average** | | **5.6** (5.59) | **5.9** (5.86) | **+0.3** |

Five cells rose (Shape, Motion, Native, Ease, Delight), two fell (Layout, Icons), and four held (Typography, Colour, Dark, Glance).

## Changed cells

**Shape 5.5 → 6.5: SHP-1½ lifted, SHP-2 earned.**
- Read aloud and Practise again are no longer `.btn-glass` (btn-glass 3 → 0).
- Live glass on content fell from 120 of 356 jobs to **0 of 356** (`glass.json`). The only glass left is pull-to-refresh and the floating toast, which are chrome.
- SHP-4 was considered and not applied. See issue 7: legacy `--r-lg` radii bring back 4 off-concentric pairs.

**Motion 4.5 → 5: MOT-5 +½.**
- Every rating now gets an Undo toast that lasts 10 s, restores by value and pulls first (`rated-typical-iphone-pwa-light`).
- Cold load on the iPhone: landmark moves 2 → **0** (27 px → 0) and CLS 0. On the iPad, CLS is 0.0018 with no moves (`out/MOTION_cls_*.txt`).
- Presses: 2/2 → **7/7** at 0.97 with a dim (`out/MOTION_press.txt`).
- The second ½ is not given: `.card-in` and the Word order shake cannot be judged from stills, and the done star is static.

**Native 6 → 6.5: NAT-6 earned. NAT-2 held.**
- Remove and the first household share go through `hub.confirm`. There is no native dialog.
- A Tab walk in Chromium found a visible ring on every stop: the queue rows, the toast's Undo, the four practice modes, Record yourself, Read aloud and Show (`tabwalk.mjs`).
- Selectable chrome: 16 → **0** (`tells-webkit`: 31 controls, all `user-select: none`). The empty-state art is no longer draggable.
- NAT-2 still holds. One draggable `<img>` remains in the trainer, the pill's photo avatar from the shared `hub.avatarHtml` (`hub.js:1219`). Phase 4's checker charged Verses NAT-2 for this same image (`b5-carry.md`, CONS-TELL-1), so it stays for consistency.

**Ease 5 → 6: EOU-5 lifted.**
- The Home card's "Review now" makes the daily review one tap into the trainer. The rule's cause, UX-VERSES-3 ("8 taps from Home"), is gone.
- Every rating is undoable, so EOU-6 cannot apply.
- EOU-1 was not earned: the first review is Review now, Show and a rating, which is 3 taps.
- Show off the first screen on small iPhones is charged once, under Layout (one fault, one dimension).

**Delight 5.5 → 6.5: DEL-2 earned.**
- The practice modes (First letters, Fill the gaps, Word order) and Record yourself are a signature experience with no equivalent elsewhere in the hub (`chrome/mode-*.png`).
- DEL-1 is still not earned. The done star was already there in batch 1 and nothing new celebrates progress. "Streak safe" is a label, not a moment.

**Layout 6 → 5.5: LAY-3½ (new regression).** For verses with text, Show falls below the first screen on a small iPhone. These are the frame coordinates of Show on the second card (John 17:3, typical length):

| 375×667 iPhone (frame 619 px) | Show top-bottom |
|---|---|
| Pre-batch code, WebKit | 506-566 (on screen) |
| Batch 5, WebKit (no recorder) | 606-666 (only 13 px visible) |
| Batch 5, Chromium (with the recorder, as on a real iPhone) | 691-751 (off screen) |

- **Causes:**
  - the 2×2 practice-mode grid adds about 100 px;
  - the reserved band for "Share this text with the house" adds about 75 px;
  - the recorder row adds about 85 px.
- **At the captured 430×932:** with the long-text verse, Show already sits at 865-926 of 932, in the home-indicator zone (`text-veiled-overflow-iphone-pwa-light`).
- **Why it is halved:** the rule's "some states" (cards with text).
- LAY-2 holds: a 656 px column leaves 56 % of iPad landscape and 54 % of the desktop empty (`SHAPE/analyze` margins 262 and 392).

**Icons 6.5 → 6: ICO-4 (new). ICO-1 holds.**
- ICO-1 holds: 19 sprite uses, 0 own SVGs, no own stroke widths (`out/ICON_static.txt`: `strokeWidths {}`, glyphs "…" ×4 in running text), at one 1.75 non-scaling stroke.
- ICO-4 applies because one meaning is drawn two ways within the area:
  - Got it is a check for adults and a **star** for kids;
  - Almost is `circle-dashed` for adults and a smile for kids.
- The star also means "a reward star" across the hub (Kid Verse, Home's Kids card, the TV), and "All done" in Verses itself.
- Evidence: `kid-revealed-typical-iphone-pwa-light`, `revealed-typical-iphone-pwa-light`.

**Colour 4.5 (held, but the rules changed).**
- Batch 1's COL-2 cause is gone: "Got it" at 4.34 on the desktop no longer fails. On every device, in every palette, the remaining below-AA text is the disabled Show and Read aloud in the loading state, which is exempt.
- **New, in Frost:** the current queue row paints `--text-3` on `--sel-fill`:
  - "Week 33" (`.rf small .cv`, 13.4 px/600) measures **4.19:1** (`themes/verses/overdue-typical-ipad-portrait-light-frost`);
  - "tomorrow" (`.when`, 16.8 px/600) measures **4.26:1** (`themes/verses/practise-anyway-typical-ipad-portrait-light-frost`).
- That is needed text on a control in one non-default palette, and it is secondary text, so COL-2 is halved.
- The same pair is a neutral ink on a hue fill, which is the condition COL-5 rewards the absence of, so COL-5 (+½) is withdrawn.
- 5 − ½ = 4.5.

## Held cells

- **Typography 6.**
  - No text under 11 px (`type.json` under11 `[]`).
  - Sizes: 37 role tokens and 0 px literals (`TYPE/code-scan`, which was 18 tokens and 1 px).
  - Kid text is 16 px or more. On iPad landscape the kid buttons render at 20.2 px.
  - No TYP rule moves.
- **Dark 6.5.**
  - No dark-only failing text.
  - The low-box histogram bars are 1.16:1 fills but carry a visible `--mint-graphic` edge and printed counts (`crops/hist-dark-ipad.png`), so DRK-3 does not apply.
  - The pale "2 weeks" block in dark is noted as issue 8, not scored.
- **Glance 5.5.** GLA-1 holds: the reference keeps the glance size on the iPad.

## Policy calls (stated so they can be overruled)

1. **ICO-4 for the kid pictures.** If the kid icons count as a deliberate kid register (UX-VERSES-1 asked for a star and a smile), Icons → 6.5 and the row is 5.91, still 5.9.
2. **COL-2 halved and COL-5 withdrawn on the Frost row:**
   - with COL-5 kept: 5.91;
   - with COL-2 full: 5.82 (5.8).
3. **LAY-3½ on a 375×667 iPhone.** If only the rig's 430×932 iPhone counts, Layout → 6 and the row is 5.91. I keep it because the real-device card (with the recorder) is worse than the captures.
4. **DEL-2.** Withheld, the row is 5.77 (5.8).
5. **EOU-1.** If Review now plus Show counts as "2 taps", Ease → 7 and the row is 5.95 (6.0).

Range across the calls: **5.8-6.0**. Central: **5.9**.

## Found while judging: fix before commit, ranked

1. **Medium: Show drops below the first screen on small iPhones for verses with text, and the captures cannot show it.**
   - **Where:** `rescore-5/chrome/eli-375-c-next.png` (Chromium, the recorder visible) and `wk-eli-375-c-next.png` (WebKit). The table above has the numbers. At 430: `screens-after/5/verses/text-veiled-overflow-iphone-pwa-light.png`.
   - **Smallest fix:** in `#trainer`, move `#rec` (Record yourself and its note) after the rating row so it shows only after Show. Move "Share this text with the house" below the ratings too, so nothing is reserved above Read aloud and Show. Together these recover about 160 px.
   - **Optionally:** below 560 px, render the mode switch as one row (`.seg` without `.seg-grid`).
2. **Medium: the capture set hides the recorder.**
   - **What is wrong:** all 208 after-shots are WebKit without `MediaRecorder`, so every adult card is about 85 px shorter than on a device.
   - **Smallest fix:** stub `window.MediaRecorder` and `navigator.mediaDevices.getUserMedia` in the capture's init script for the verses area, then recapture.
3. **Low-medium: the top toast covers the pill for 10 s after every rating.**
   - **Where:** `rated-typical-iphone-pwa-light`, `done-typical-iphone-pwa-light`, `text-revealed-overflow-ipad-landscape-light` (on the iPad it also covers the kicker and chip).
   - **Why it matters:** after UX-VERSES-8 the pill ("2 to go") is the only place the due count lives, and it is hidden exactly when the count changes. With no blur in the rig the pill also shows through the toast's text (`crops/toast-iphone.png`; on a device it becomes a smudge).
   - **Smallest fix:** let Verses pass a placement that puts the toast at the bottom. The stats card no longer carries the due count, so covering it is harmless. Alternatively, show "Next review in N days · Undo" as an `aria-live` line inside the card.
4. **Low: secondary text on the current queue row fails AA in Frost.**
   - **Where:** `.rf small .cv` 4.19:1 and `.when` 4.26:1 on `--sel-fill` (the Frost themes jobs above).
   - **Smallest fix:** `.ds .queue li.cur :is(.rf small, .when) { color: var(--text-2); }` (or `--accent-ink`). This also restores COL-5.
5. **Low: kid icons collide with the hub's reward star.**
   - **What is wrong:** the kid "Got it" is the reward star, and Ezra may expect a Kid Verse star that never comes. "I said it" wears Show's eye.
   - **Where:** `kid-revealed-typical-iphone-pwa-light`, `kid-typical-iphone-pwa-light`.
   - **Smallest fix:** kid Got it uses a large `i-check` (or a thumbs-up drawn into the sprite) and keeps `i-star` for rewards. Give "I said it" `i-check` or `i-mic`.
6. **Low: two empty bands in the veiled text card before Show.**
   - **Where:** `rated-typical-ipad-portrait-dark` (about 75 px above Read aloud and Show, about 90 px below), `text-veiled-typical-iphone-pwa-light`.
   - **What is wrong:** the buttons float mid-card. VIS-VERSES-1's "empty glass" complaint is fixed after Show, but it is larger before Show on text cards.
   - **Smallest fix:** the same move as issue 1 (the share link below the ratings), which leaves a single reserved band below the buttons.
7. **Low: legacy radii on the rating tiles and kid buttons.**
   - **What is wrong:** `border-radius: var(--r-lg)` (22 adult, 28 kid) at `apps/verses.html:109, 132, 140`. Off-concentric pairs went from 0 to 4 selectors (`out/SHAPE_analyze.txt`), and kid large radii on role values are 47 %.
   - **Smallest fix:** `var(--r-inset)` at those three lines.
8. **Low: the dark histogram ramp ends in the brightest block on the screen.**
   - **What is wrong:** "2 weeks", the box needing least attention, is a pale mint block, while Daily and 2 days are near-black fills with only an edge.
   - **Where:** `revealed-typical-ipad-portrait-dark`, `done-typical-ipad-landscape-dark`, `trainer-typical-ipad-landscape-dark`.
   - **Smallest fix:** in dark, map the box steps to fill → strong (`--mint-strong` at box 5) rather than to the light fill.
9. **Low: "2 weeks  tomorrow" in Coming up reads as one phrase.**
   - **Where:** `done-typical-iphone-pwa-light`, `nothing-due-typical-iphone-pwa-light`.
   - **Smallest fix:** chip text "every 2 weeks" (or drop the chip, since the histogram already explains the intervals).
10. **Low: the First letters placeholders render as broken, uneven dot runs.**
    - **Where:** `rescore-5/chrome/mode-letters-light.png` ("m.. ......", "o..... ..").
    - **Smallest fix:** one solid hairline underline (`border-bottom: var(--border-w) solid var(--text-3)`) on the hidden-word box, not dotted runs.
11. **Low: the kid Undo target is 78×44, under the kid 64 px.**
    - **Where:** `SHAPE/analyze` kid targets, `div#hub-toast > button.toast-act`.
    - **Smallest fix:** `:root[data-kind="kid"] .toast-act { min-height: var(--tap-kid); }` in the shared toast CSS.
12. **Nit: the draggable avatar photo keeps NAT-2 for Verses, and for every app with a pill face.** Smallest fix: add `draggable="false"` to the `<img>` in `hub.avatarHtml` (`apps/hub.js:1219`).
13. **Nit: the shared toast wraps "Next review in 7 / days." on a 390 iPhone with Undo on the second line** (`chrome/mode-*-light.png`). Shorter copy ("Next in 7 days") keeps it on one line.

**Not scored but worth knowing.**
- The orchestrator's first-visit Home regression (Today's reading art over "12-day streak") belongs to the shell row.
- The Home Verses card was not judged here.

## Not judged without a device

- Real blur, under the toast in particular.
- The SF faces.
- iOS `:active` presses.
- `.card-in` and the Word order shake.
- Recording and its permission prompt on iOS.
- Whether iOS Safari shows a focus ring after the programmatic focus moves that follow a touch rating (the captures show a ring on "Practise one anyway" and Show).
- Read-aloud voices.
- The kid picture buttons at arm's length on an iPad.
- The 7 pm push.
