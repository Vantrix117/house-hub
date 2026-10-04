# Phase 4 scorecard: the Kid Verse row after batch 7 (working tree on ac5f7e4)

**Independent judge.** I used the method in `audits/04-design-system.md` (lines 24-241): the `hearth-shared` base as re-priced in `audits/evidence/p6/1/rescore.md`, plus the written rules, with the net per dimension clamped to ±2 and every cell in 0.5 steps. The format follows `audits/evidence/p6/6/rescore.md`.

- **Before** is Kid Verse's batch-1 row (5.6). No later batch rescored Kid Verse, and the pre-batch captures (`cap7-before`) show the same state batch 1 scored: "Done ★", the glass "Read it to me" and Done below the fold on the iPad in landscape.
- **Provisional dimensions.** Typography and Shape are provisional as always: the rig has no backdrop blur and uses fallback fonts. Colour, Shape and Layout are also provisional on measurements: the final run (`final-7`) had measured Kid Verse (themes, devices, states) but had not aggregated it when I read it.

## Evidence

**Before/after pairs:** 35 in `SCRATCH/rescore-7/pairs/`, built from `cap7-before/kidverse` → `cap7-r1/kidverse`.
- Kid: iPhone PWA (light and dark), iPhone Safari, iPad portrait (dark), iPad landscape, desktop.
- States: stars, story, rewards, empty, loading, stalled-loading, reading, Kiara, week-reset, overflow, award-empty, cashed-in, offline.
- Adult: iPhone, iPad landscape, desktop (dark), verse, empty, overflow, f260-hint, guest (dark), stalled-loading.

**Also opened:**
- `cap7-r1/kidverse/kid-week-reset-typical-ipad-portrait-dark.png`
- `rev7/shots2/voice-panel-adult-light.png`
- `rev7/shots2/kid-xxl-dark-430-top.png`
- `b7b/cap2/ezra-430-xxl-dark-story.png`

**Static Phase 4 tools,** run on a copy of the working tree (`rescore-7/wt`) and on a copy of HEAD (`rescore-7/wtb`), all exit 0:

| Tool | Before (HEAD) | After (batch 7) |
|---|---|---|
| TOK/literals | 41 literals (font-size 2, line-height 8, opacity 1, target 7, local 2, plus colour 17 and glass 1 from the shared bootstrap) | 18 (colour 17 and glass 1 only, the same bootstrap lines every app has) |
| TYPE/code-scan | 2 px font sizes, 30 tokens | 0 px font sizes, 43 tokens; under-11 px: 0 |
| ICON/static | 7 hand-drawn SVGs, stroke 1.5 ×1, glyphs ★18 ✓1 −2 | 8 sprite uses, strokeWidths {}, no hand-drawn SVG |

- **ICON/static detail (after).** Every remaining ★ is in a comment, the speech `replace(/★/g,'star')`, or the feed line "Read the verse ★" (shown on Home and the TV, not on Kid Verse). The one emoji, 🎙️, is a fallback face for a recording whose author is missing.

**Measurement-based evidence:**
- **Final run, raw files** (`audits/evidence/p4/measure/raw/*/kidverse`, read only):
  - below-AA text is 0 in every Kid Verse job except one: `themes/kid-week-reset-typical-ipad-portrait-dark-hearth`, where `b#star-count` "0" was sampled with a light-theme ink while a toast was fading in (p10 1.19, median 16.85, `aaMed: true`);
  - kid text floor 16 px;
  - story title 26.4 px on the iPhone and 29.6 px on the iPad; "My rewards" 24 / 26.9 px;
  - reference 47.3 px on the iPhone and 64 px on the iPad in landscape.
- **Worker B's mid-batch tool run** (`b7b/tools`):
  - MOTION/cls kidverse: 0 moves on the iPhone and the iPad;
  - press: kid 2/2, adult 4/4;
  - SHAPE/verify V2 span 656 at 1180 and 1440; V4 kid targets 325×114;
  - SHAPE/analyze macro g4 50.7 %, noted by Worker B as raw-stale;
  - TELL: 11 controls, all unselectable, double-click selects only the verse reference "Acts".
- **Batch check** `audits/tools/phase6/7/kidverse-look-7.mjs` (log `b7b/tools/look-final.txt`, 127/0; the report gives 148/0 after round 1). It checks:
  - Done, the art, the reference and the speaker on the first screen at 390×844, 430×932, 820×1180, 1180×820 and 1440×900;
  - 0 live-blur layers in the app document;
  - every icon an `svg.sym` from the sprite;
  - no ★/✓/− glyph in a label.
- **Batch 1 glass evidence** (`audits/evidence/p6/1/measure/glass.json`, kidverse content): `#say` and `#story-say` btn-glass (186 jobs), plus the zero-area `#ptr`.

**Not run:** the capture rig, any suite, the measuring tools against the repo, a Tab walk.

## The row

| Dimension | Base | Before (b1) | **After** | Rules now applied | Change |
|---|---|---|---|---|---|
| Typography* | 6 | 6 | **6** | none | held |
| Colour | 5 | 6 | **6** | COL-1 | held (provisional) |
| Layout | 6.5 | 5 | **6** | LAY-2 | LAY-3 lifted (+1) |
| Shape* | 6 | 5.5 | **6.5** | SHP-2 | SHP-1½ lifted, SHP-2 earned (+1, provisional) |
| Icons | 5.5 | 4.5 | **6.5** | ICO-1 | ICO-2 lifted, ICO-1 earned (+2) |
| Motion | 4.5 | 5 | **5** | MOT-5 +½ | held |
| Dark | 6.5 | 6 | **6.5** | none | DRK-5 lifted (+½) |
| Native | 6.5 | 6.5 | **6.5** | none | held |
| Glance | 4.5 | 5.5 | **5.5** | GLA-4 | held |
| Ease | 6 | 6 | **7** | EOU-1 | EOU-1 earned (+1) |
| Delight | 5.5 | 6 | **6** | DEL-1, DEL-4 | held |
| **Average** | | **5.6** (61.5/11 = 5.59) | **6.1** (67.5/11 = 6.14) | | **+0.55** |

## Cells that changed, with the PNGs

### Layout 5 → 6: LAY-3 lifted (−1 removed)

**Before:** the art filled the first screen on the iPad in landscape and on the desktop, so "Done ★" sat below the fold (`pairs/kid-typical-ipad-landscape-light.png` left, `pairs/kid-typical-desktop-light.png` left). On the iPhone the paraphrase pushed it down too (`pairs/kid-typical-iphone-pwa-light.png` left).

**After:** the art is sized in dvh at 3:2, and Read it to me and Done sit side by side straight under the reference on every frame:
- `pairs/kid-typical-iphone-pwa-light.png`
- `pairs/kid-typical-iphone-safari-light.png`
- `pairs/kid-typical-ipad-landscape-light.png`
- `pairs/kid-kiara-typical-ipad-landscape-light.png`
- `pairs/kid-typical-desktop-light.png`
- `pairs/kid-typical-ipad-portrait-dark.png`
- XXL text size: `rev7/shots2/kid-xxl-dark-430-top.png`

kidverse-look-7 asserts the same at all five sizes in light and dark. The adult's main job, the stars and the week stepper, is now first (`pairs/adult-typical-iphone-pwa-light.png`).

**Rules held in Layout:**
- **LAY-2 −½ holds.** The 656 px column leaves 54 % of the 1440 desktop empty (SHAPE/verify V2; `pairs/kid-typical-desktop-light.png`).
- **LAY-4 is not charged.** The adult overflow collision, where long names ran under the day dots, is fixed: the name and ★ now sit on their own row above the dots (`pairs/adult-overflow-iphone-pwa-light.png`).

### Shape 5.5 → 6.5: SHP-1½ lifted, SHP-2 +½ (provisional)

The only live glass on content in batch 1 was the two "Read it to me" buttons (`glass.json`: `#say` and `#story-say` btn-glass in 186 of 186 jobs). Both are now solid `btn-soft` fills, and the who-chip is solid:
- `pairs/kid-stars-typical-iphone-pwa-light.png`: a white glass capsule before, an aqua solid tile after;
- `pairs/kid-typical-ipad-portrait-dark.png`;
- `pairs/adult-typical-iphone-pwa-light.png`.

kidverse-look-7 measures 0 live-blur layers in the document. As with F260 in batch 1, the shell's zero-area `#ptr` does not count, so 0 % of screens put glass on content, which earns SHP-2. The story picture is now concentric (R38 / inset 20 / r18, look-7).

**Provisional** until the final `glass.json` aggregate confirms `jobsWithContentGlass` is 0 (policy call 1).

### Icons 4.5 → 6.5: ICO-2 lifted (+1), ICO-1 earned (+1)

**Before:** text ★ glyphs sat beside drawn icons ("Done ★", "Done today ★", the "for the verse ★" line, "I heard it" with a ✓; `pairs/kid-stars-typical-iphone-pwa-light.png` left, `pairs/kid-rewards-typical-iphone-pwa-light.png` left). The Prayer-warrior badge was a heart.

**After:** every icon is a Lucide sprite symbol at the one non-scaling 1.75 px stroke (`design.css:169, 820`; ICON/static strokeWidths {}):
- **The two speakers have their own pictures:** a scroll for the verse and an open book for the story.
- **"I heard it"** is an ear with the star mark.
- **Done** is the filled star, the one fill, as Timer's ring was.
- **The badges** are drawn:
  - Story lover has the book;
  - Prayer warrior has the praying hands;
  - the badge numerals stay numbers.
- **The day dots** draw a star, a book or praying hands for each kind of star earned.

Evidence:
- `pairs/kid-rewards-typical-iphone-pwa-light.png`
- `pairs/kid-story-typical-ipad-portrait-light.png`
- `pairs/kid-stars-typical-ipad-portrait-dark.png`
- `pairs/adult-typical-iphone-pwa-light.png`

ICO-4 is not charged; see policy call 3.

### Dark 6 → 6.5: DRK-5 lifted

**Before:** the pale art plate covered about 27 % of the first screen on the iPad in portrait, dark (`pairs/kid-typical-ipad-portrait-dark.png` left).

**After:** the plate is still the same pale, unthemed plate, but the art is now:
- about 8 % of the frame on the iPad in portrait (`pairs/kid-typical-ipad-portrait-dark.png`);
- about 12 % on the iPhone (`pairs/kid-typical-iphone-pwa-dark.png`);
- about 12 % at XXL (`rev7/shots2/kid-xxl-dark-430-top.png`).

That is under the rule's quarter-of-the-first-screen threshold, so DRK-5 no longer applies. The plate itself is unchanged, so this lift is on size only (policy call 2). DRK-1 and DRK-3 stay lifted: dark below-AA is 0 in the raw data, and Read it to me (teal) and Done today (olive) are distinct fills that carry a label.

### Ease 6 → 7: EOU-1 earned

The most frequent job takes two taps: the kid Home tile, then Done. Done is now:
- **on the first screen** on every device class (see Layout);
- **at least 114 px tall** for a kid (V4: 325×114 on the iPad; 188×114 on the iPhone, look-7).

Phase 4 withheld EOU-1 only because Done was on the first screen in iPad portrait alone (`04-design-system.md:110`), and that is fixed.

No new deduction:
- **Kid controls** are all ≥ 64 px (look-7: 11 buttons, the smallest 64 high).
- **Adult controls** (the stepper, Move and Not now) are ≥ 44 px.
- **Replacing or removing a recording** goes through `hub.confirm` (`kidverse.html:1498, 1520`).
- **Done today and Heard it today** change their label as well as their fill (`pairs/kid-stars-overflow-iphone-pwa-dark.png`).

## Held cells, re-checked

- **Typography 6.** There is no text under 11 px (the kid floor is 16 px), and all sizes are tokens: code-scan 43 tokens, 0 px.
  - **TYP-5 (+½) is not met.** It needs titles of 28 px or more; on the iPhone the story title is 26.4 px and "My rewards" / "Earlier weeks" are 24 px.
  - **TYP-3 stays lifted.** The star count is 900 weight with tabular figures.
- **Colour 6 (COL-1).** Every resting pair passes in all 84 theme jobs.
  - The one sample is transient: the star count "0" measured mid-toast in the dark Hearth week-reset job, which reads white in `cap7-r1/.../kid-week-reset-typical-ipad-portrait-dark.png`.
  - The wash is now a token, not a `color-mix`, and the `<style>` has no hex (look-7).
  - COL-5 is not awarded; see policy call 4.
- **Motion 5 (MOT-5 +½).**
  - MOT-2 stays lifted: CLS 0, 0 moves (MOTION/cls).
  - Presses: 2/2 kid controls and 4/4 adult.
  - The word highlight has deliberately no motion. Done has no Undo. Nothing earns a second ½.
- **Native 6.5.**
  - TELL: 0 selectable controls; only the verse reference text selects, and that is content.
  - The art is not draggable. No native controls.
  - NAT-4 stays lifted: "Getting your stars…" / "Getting your story…" and skeleton lines (`pairs/kid-loading-ipad-portrait-light.png`). See issue 5 for a weak spot.
  - NAT-6 is not earned: there is no Tab-walk evidence, as for the Timer.
- **Glance 5.5 (GLA-4).** The kid's fact still reads with a picture and colour state, and a 47-64 px reference. GLA-1 is not re-opened; see policy call 7.
- **Delight 6 (DEL-1, DEL-4).**
  - DEL-1 holds (celebrations and badges).
  - DEL-4 still applies: the week's art visibly repeats, the same picture in the verse card and in the story thumbnail on one screen (`pairs/kid-stars-typical-iphone-pwa-light.png`, `pairs/kid-typical-ipad-portrait-dark.png`), and the plate is still pale in dark.
  - DEL-2 is not given; see policy call 5.

## Policy calls (stated so they can be overruled)

1. **SHP-2 earned provisionally,** on look-7's 0 live-blur layers, pending the final `glass.json`.
   - If the aggregate shows only the zero-area `#ptr`, the call stands.
   - If SHP-1½ is lifted but SHP-2 withheld: Shape 6, row **6.09**.
   - If cross-area content glass appears in Kid Verse's jobs and SHP-1½ is held, as for the Timer: Shape 5.5, row **6.0**.
2. **DRK-5 lifted on area.** The plate is still un-darkened, now 8-12 % of the first screen. Kept: Dark 6, row **6.09**.
3. **ICO-4 not charged** for "Read it to me" wearing three pictures: a speaker on the no-week placeholder (`kidverse.html:272`, `pairs/kid-empty-iphone-pwa-light.png`), a scroll on the verse and a book on the story. Each picture names what is read, which is UX-1's point. Charged: Icons 6, row **6.09**.
4. **COL-5 not awarded.** Text and icons on fills use the -ink and -on tokens, and accents re-point through `data-accent`. But this was already true at batch 1, which did not award it, and batch 7 changed only the decorative wash. This matches batch 3's COL-1 hold for Prayer. Awarded: Colour 6.5, row **6.18**.
5. **DEL-2 not given** for the parent's own recorded voice, the word highlight and the earlier-weeks shelf. None is visible playing in a capture, and all need a device. Given: Delight 7, row **6.23**.
6. **LAY-1 not applied** to the kid ×1.25 spacing scale (batch 1's policy). The macro grid is 50.7 % in Worker B's run, flagged raw-stale. Applied: Layout 5, row **6.05**.
7. **GLA-1 not re-opened.** The reference is 64 px on the iPad (about 2.2 m), unchanged by this batch, and batch 1 scored the kid audience by GLA-4. Given: Glance 6.5, row **6.23**.

**Range:** 5.95 (calls 1 and 6 against the area) to 6.36 (calls 4, 5 and 7 in its favour). **Central: 6.1** (6.14).

## Top remaining issues, ranked

1. **Medium, cheap: the verse art is letterboxed in an oversized white card.**
   - **What is wrong:** since the dvh art fix, the picture is a small plate centred in a full-width white card. About 235 px of art sits in a 656 px card on the iPad in landscape; about 270 px sits in a 390 px card on the iPhone. The scene that was the kid's hero now looks like a thumbnail in a frame.
   - **Evidence:** `pairs/kid-typical-ipad-landscape-light.png`, `pairs/kid-typical-desktop-light.png`, `pairs/adult-typical-ipad-landscape-light.png`, `pairs/kid-typical-iphone-pwa-light.png`.
   - **Fix:** let the card hug the art (`width: fit-content; margin-inline: auto`), or drop the outer card and give the plate the card radius and elevation. Keep the dvh height cap.
2. **Medium, medium effort: the art has no dark form, and the verse picture repeats as the story thumbnail.**
   - **What is wrong:** this keeps DEL-4 and is the only reason DRK-5 needed a policy call.
   - **Evidence:** `pairs/kid-typical-iphone-pwa-dark.png`, `pairs/kid-stars-typical-ipad-portrait-dark.png`.
   - **Fix:** a dark `--art-plate` value per scheme in place of the brightness(.82) dim, and a distinct story scene, or the thumbnail dropped where the verse art is on screen.
   - **Gain:** lifts DEL-4 (Delight 6.5).
3. **Low-medium, cheap: the day-dot marks are too small for a kid when two or three share a dot.**
   - **What is wrong:** at `--icon-xs × .8` the star, book and hands shrink to about 10-13 px inside a 36-44 px dot, and two marks sit side by side. They cannot be told apart at arm's length.
   - **Evidence:** `pairs/kid-stars-typical-ipad-portrait-dark.png`, `pairs/kid-story-typical-ipad-portrait-light.png`, `pairs/adult-overflow-iphone-pwa-light.png`.
   - **Fix:** in kid mode, draw one mark per dot (the newest kind) with a small "+2" count, or grow a dot that has marks.
4. **Low, medium effort: the desktop and iPad landscape stay one 656 px column (LAY-2).**
   - **Evidence:** `pairs/kid-typical-desktop-light.png`.
   - **Fix:** from 1024 px, a second column, with the verse and actions on the left and the story, stars and rewards on the right.
   - **Gain:** lifts LAY-2 and earns LAY-5 (Layout 7, row about 6.2).
5. **Low, cheap: two loading tells.**
   - **What is wrong:** while loading, Done loses its fill and reads as loose text, "★ Getting your stars…", beside a filled Read it to me. The verse reference has no skeleton, just a blank band under the kicker.
   - **Evidence:** `pairs/kid-loading-ipad-portrait-light.png`, `pairs/kid-stalled-loading-iphone-pwa-light.png`.
   - **Fix:** keep the capsule's soft fill in the busy state, and add a 2-line skeleton for `#ref`.
6. **Low, cheap: the story head wraps awkwardly beside its thumbnail at 390-430 px.**
   - **What is wrong:** "EZRA'S STORY THIS / WEEK", the story tiles wrap to "Read it / to me", and at XXL "I heard / it".
   - **Evidence:** `pairs/kid-stars-typical-iphone-pwa-light.png`, `pairs/kid-award-empty-iphone-pwa-light.png`, `b7b/cap2/ezra-430-xxl-dark-story.png`.
   - **Fix:** under 480 px, stack the thumbnail above the head (as at XXL), or shorten the kicker to "Ezra's story". Give the tile labels `text-wrap: balance` with a min width.
7. **Low, cheap: kid section titles just miss TYP-5.**
   - **What is wrong:** the story title is 26.4 px and "My rewards" / "Earlier weeks" are 24 px on the iPhone, against the rule's 28 px.
   - **Fix:** map these headings to `--fs-title1` in the kid block.
   - **Gain:** TYP-5 +½ (Typography 6.5, row about 6.2).
8. **Nit, cheap: "Read it to me" wears a speaker on the no-week placeholder** (`kidverse.html:272`; policy call 3).
   - **Fix:** use the scroll there too.

## Not judged without a device

- Blur and the system fonts.
- iOS presses.
- Speech boundary events, so the word highlight on a real voice; spoken toasts.
- Recording and playback in Safari, and the microphone wording.
- The shelf sheet's focus on iOS.
- A Tab walk.
- The Move offer at Sunday 5 pm.
- The final measurement aggregate (glass, contrast, non-text): the Colour and Shape cells are provisional until it lands.
