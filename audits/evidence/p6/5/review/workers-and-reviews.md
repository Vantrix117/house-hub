# Batch 5 (Verses): workers' reports, digested

Base: HEAD 1ba5cec. The working tree holds batch 5. The brief is `batch5-brief.md`, the entries `b5.md`, and the carry-overs `b5-carry.md`.

## Worker A: Verses logic, data and copy

All 17 entries DONE.

**Household verse text (GAP-VERSES-1)**
- Family rows `text:<w>-<i>` = `{text, by, at}`. The household's text wins over the person's F260 paste.
- Add / Edit / Remove, where Remove asks through `hub.confirm`. Kids get no editor.
- `apps.json` verses `"scope":"both"` and `data-scope="both"`. Text rows are written with `{app:'verses', scope:'family'}`; the other rows are person rows.
- `worker/src/policy.js` did not change: adults and guests can already write family rows of an app they can open.

**Schedule and on-screen wording**
- Not yet → box 1. Each button shows its next interval (`.nx`). Toasts say "Next review in N days", with Undo.
- No "box" anywhere on screen (P3-05, GAP-2, UX-9).

**Bugs fixed**
- Read aloud stays after Show (P3-06).
- Rows are `button.qrow` "Practise <ref>". Picked verses show as extra practice and are not counted as due (P3-08, F6).
- Enter or Space on a focused button presses that button (P3-10).
- The day streak (`dayStreak`/`wasDueOn`): a day with nothing due keeps the streak, today is pending, unknown days are read generously (P3-11).
- A 400 ms double-tap guard (`#trainer.rated`), then `.card-in` (P3-12).
- The veiled text is `aria-hidden` and `inert` until Show (P3-13).
- New empty-state copy, plus Open F260 through `hub.open('f260')` (P3-14, GAP-3).

**Kids (UX-1)**
- Kid Verse's paraphrase table is copied in and checked. The paraphrase shows only on the paraphrased verse.
- Picture buttons star / smile / try-again. Show reads "I said it".

**Undo and the counts**
- Undo lasts 10 s, restores by value only if the row is unchanged, takes back the `rev:` count, and returns to the card revealed (UX-2).
- The pill wording; the star only after reviews; the due count shown once (`#st-due` hidden, `#st-today` added); the Due today list hidden when nothing is due (UX-4/-8).

**Tests and scripts**
- Repaired copies in phase6/5: kid-flow-5, critic-doubletap-5, the double-tap 2-1-5 / 2-2-5, and read-aloud-2-5.
- test-verses rewritten: 149/0.
- verses-a-5 23/0, test-kidverse 51/0, test-f260 58/0, test-home 78/0.

## Worker B: look, carry-overs, practice modes, recording

**Layout and look**
- VIS-1: no min-height. Before Show only what Show adds is reserved. At phone width the adult ratings sit in one row of three; at XL/XXL they stack. layout.mjs: no band left after Show, no jump.
- VIS-6: the histogram bars are tinted by box with the mint steps; edges are 4.25:1 or better in all 6 palettes.

**Practice modes (I3)**
- Recall / First letters / Fill the gaps / Word order, on `.seg.seg-grid`.
- Shown only on verses that have text, and only to adults. The mode is saved in the person row `mode`.
- Revealing a word keeps its width. A wrong tap in Word order shakes, or flashes under Reduce Motion.

**Recording (I1)**
- MediaRecorder, in memory only. Hidden where MediaRecorder is missing, and for kids.
- Checked in Chromium with a fake microphone.

**Icons**
- Everything comes from the sprite. Added `i-circle-dashed` (Almost), `i-smile`, `i-play` and `i-square`.
- `i-star` reads `--sym-fill`. The sprite parse is checked in verses-look-5.

**Carry-overs**
- UX-VERSES-6: the toast is now at the top of the page. It covers no box label, but does cover the pill for up to 10 s.
- CONS-MOTION-4 / GAP-MOTION-1: iPhone 27 px → 0.
- CONS-ICON-1 and -2, CONS-TOK-3 (mixes 1 → 0), CONS-TYPE-2 (px 1 → 0), GAP-TOK-4 (local literals 1 → 0; line-height 2 → 1, the `.lbl` 1.2 left).
- CONS-TELL-1: 16 → 0 selectable.
- Optional: CONS-GLASS-2 (btn-glass 3 → 0) and CONS-DARK-1 (the art plate).
- Also: MOTION/press 2/2 → 7/7; TOK targets 6 → 4.

**Files and suites**
- `audits/tools/areas/verses.mjs`: the rating helper now waits out the 400 ms guard.
- verses-look-5 164/0, test-design 60/0, screens-apps 90/1 (Tally's existing failure), test-prefs 35/0, capture 208/208.

## Worker C: Home card, evening push, docs

**Home card (GAP-HOME-2 / UX-3)**
- A Memory verses card after Today's reading: "3 verses to review · N-day streak" with Review now, or "Nothing due today" with Open Verses.
- It counts from the rows, not the summary; the summary is used only for a skeleton.
- Shown to adults and guests whose total is above 0. Never shown to kids, the TV or the kitchen.
- `versesStreak` is a copy of A's `dayStreak`.

**Evening push (I2)**
- `versesJob` runs in the 7 pm New York hour, using `push_pref:verses` (off by default).
- The due count is worked out on the server from the `mem:`/`recall:` rows. It sends once a day, only when something is due, and never to kids, the TV or the kitchen.
- The switch is in Me → Notifications.

**Tests**
- test-home 78/0, test-push2 70 → 81/0, smoke-api 325 → 330/0, cron-check-5 25/0, cron-check-4 31/0, test-push 6/6, test-kitchen 55/0.

**Docs:** CLAUDE.md (Memory verses, the shell, Push, Tests) and worker/README.md.

## Orchestrator, after the workers

- The Home card's "reviewed today ✓" is now "reviewed today", and test-home and CLAUDE.md follow.
- The → arrows and the "<svg>" in verses.html comments are now ASCII.
- sw.js: hub-v44 → hub-v45, via bump-sw.
- Parse check: 31/0.

## Device-only checks (owner, at the end)

- Read aloud with iOS voices.
- The editor's microphone.
- Recording, including the permission prompt.
- The 7 pm push on an iPhone, and its tap.
- The top toast under the notch.
- The kid picture buttons on an iPad.

## Review round 1

### Core review (rev5-core)
No regressions elsewhere. Suites all green: test-verses 149, test-home 78, test-push2 81, test-kidverse 51, test-f260 58, test-kitchen 55, test-tv 85, smoke-api 330.
1. **MEDIUM:** Undo erased another device's unpulled newer review. It did not pull first. Repro: e1.mjs, `e1_clobbered:true`.
2. **MEDIUM:** a missed due day was forgiven once the overdue verse was reviewed. The streak went 0 → 3. Repro: e1 E2.
3. **LOW-MED:** the person's private F260 paste reached the household with one Enter, and the button read "Edit the text". Repro: e2 E4.
4. **LOW:** offline once after the update, because the trainer waited on the verses family channel. Repro: e2 E7.
5. **LOW:** the Worker accepted any family key in verses, 60 KB texts, and a `by` naming someone else.
6. **NIT:** in CLAUDE.md, the test-verses row was stale, and the kitchen was missing from "everyone but".
7. **NIT:** after Undo, the feed line and the rev: count were taken back even when the other device's review was kept.
8. **GAP:** no test proved the guest verses push.
→ Items 1-7 went to Worker A.

### Visual review (rev5-visual)
Suites green: test-design 60, screens-apps 90/1 (Tally's, pre-existing), test-prefs 35, test-tv 85, test-kitchen 55. Phase 4 tools confirm Worker B's numbers.
1. **MEDIUM:** on the iPhone, the kid's ratings fell below the fold after "I said it" (792-918 of 772).
2. **MEDIUM:** the top toast covered the next card's reference after a row tap scrolled the page.
3. **LOW:** the "Your verses" h2 wrapped because of the new sub-heading.
4. **LOW:** Word order jumped 339 px on reveal.
5. **MEDIUM (a11y):** focus fell to body after Save, Undo, Show and rating. Show and rating did this pre-batch too.
6. **LOW:** in the practice modes, the Tab order did not match what is drawn.
7. **LOW:** Undo is 14 Tabs away. It is the shared toast.
8. **LOW:** the recorder row was not checked on a real iPhone. Added to the owner's device checks.
9. **NITs:** the "I said it" line break; aria-describedby; the qrow press scale; "reviewed today" wrapping.
→ Items 1-4, 6, the qrow and wrap NITs, and the #rec position went to Worker B. Items 5, the copy, nbsp, describedby, and an Undo key shortcut went to Worker A.

### Round-1 fixes, Worker B
- **Kid fold.**
  - The Read aloud and "I said it" buttons are now a picture beside the word, one row. The picture ratings are 1.25× the large button height, and the paraphrase is one size smaller.
  - On reveal the ratings scroll into view (onCard hook; block 'nearest'; smooth unless Reduce Motion).
  - The ratings are fully visible at 375×667, 390×844 and 430×932, and at XL/XXL.
- **Toast after a row tap.** The trainer has `scroll-margin-top` (the safe area plus 112 px). After a row tap and a rating, the toast sits at 8–100 and the card starts at 78.
- **Heading.** The h2's `<small>` wraps onto its own line; A shortened the copy to "streak safe".
- **Word order.** The pool is kept on reveal, so the card height does not change.
- **Tab order.** The #pm markup now comes before the text and `order:-1` is gone; a Tab-order check was added.
- **NITs.** `.qrow` presses at `--press-scale`; the stat labels use the xs role below 560 px.
- **#rec.** It stays above the buttons; b5-hooks.md was updated to match.
- **Checks.** verses-look-5 184/0, test-verses 168/0, screens-apps 90/1 (Tally's, pre-existing), capture 208/0, parse 31/0.

### Round-1 fixes, Worker A

- **Undo.**
  - Undo is now async and pulls first. The other device's newer review is kept along with its rev: count.
  - Test (d) presses Undo without pulling. e1 E1: clobbered true → false.
- **Streak.**
  - Each rating stores `prev:{due,last}`. A second rating on the same day keeps the first `prev`.
  - `wasDueOn` reads `prev`. Only rows without `prev` stay generous.
  - Home's `versesStreak` was updated the same way.
  - e1 E2: 0 → 3 before; 0 → 1 after.
- **Private paste.**
  - The label is now "Share this text with the house", and the first save asks through `hub.confirm`.
  - An unchanged household text saves nothing.
  - e2 E4: published before → not published.
- **Offline.**
  - `loaded()` waits only for the person channels (plus the kidverse family channel for kids). The editor waits for the family channel.
  - Test (k) covers it. e2 E7: stuck → works.
- **policy.js (narrowed).**
  - Verses family accepts only `text:<1-52>-<0|1>`, value null or `{text 1-4000, by:self, at}`, from adults (household and guests).
  - New check `phase6/5/text-policy-5.mjs`: 26/0.
- **CLAUDE.md.** The Memory verses bullet and the test-verses row are updated.
- **Focus.**
  - After Show → the first rating. After the cool-down → Show, #again or #open-f260. After Undo → Got it. After Save or Cancel → the card.
  - "streak safe"; nbsp in "I said it"; aria-describedby on the editor.
  - U / Ctrl+Z undoes, with `aria-keyshortcuts` on the toast button.
- **Results.** test-verses 168/0, test-home 78/0, test-kidverse 51/0, test-f260 58/0, smoke-api 330/0, verses-a-5 23/0, text-policy-5 26/0, parse 0 failed.

## Review round 2

### Core review (rev5-core)
Round-1 status:
- 1 FIXED, including offline and a hung network.
- 2 PARTLY: works for one review only.
- 3 FIXED. 4 FIXED. 6 FIXED.
- 5 FIXED. Policy matrix: allowed = own row, tombstone, guest; refused = someone else's `by`, a junk key, week 53, 4001 chars, an extra field, a kid, the TV.
- 7 PARTLY: the feed line stays, by choice.
- 8 not addressed.

New findings:
- **A, MEDIUM:** a missed day is forgiven after a second review. `prev` reaches back only one step. Repro: e3 E2b, streak 3 where it should be 2.
- **B, LOW:** the U/Ctrl+Z shortcut outlives its toast, including while a confirm is open.
- **C, NIT:** Undo during the cooldown re-enables the ratings while the pull waits.

Suites all green: test-verses 168, test-home 78, test-kidverse 51, test-f260 58, test-push2 81, smoke-api 330, text-policy-5 26, verses-a-5 23.

→ A, B, C and the guest push test (8) went to Worker A.

### Visual review (rev5-visual), round 2
- **Round-1 items:** 1-7 and 9 are FIXED. Item 8 (the recorder) is PARTLY fixed: the Chromium layout is fine, but it still needs a check on a real iPhone.
- **New findings, all low or nit:**
  - (1) The kid ratings sit flush at the bottom of the frame, which on an iPhone is the home-indicator area. → Worker B (scroll-margin-bottom).
  - (2) The row-tap scroll in `practise()` ignores Me → Motion "full". → Worker A.
  - (3) Pressing Enter twice after Show rates "Not yet". Accepted: Undo and the U key recover it.
  - (4) On the kid card, "Read aloud" wraps onto two lines. → Worker B.
- **Suites:** test-design 60/0, screens-apps 90/1 (the Tally failure, there before this batch), test-prefs 35/0, verses-look-5 184/0.
- **Capture:** 208/208.

### Round-2 fixes, Worker A
- **A. Missed days in the streak.** The recall row now keeps `hist:[{due,last}]`, the replaced schedules for 30 days (`HIST_DAYS`).
  - A second rating on the same day adds nothing to it.
  - The never-reviewed entry is dropped together with the trimmed entries.
  - Days older than the history are read generously. The old one-step `prev` is read as a history of one.
  - Home's `versesStreak` copies this logic.
  - test-verses (l) and test-home cover it. E2b: 3 → 2.
- **B. The U/Ctrl+Z shortcut.** It works only while its own toast is visible and connected, and never while a sheet or dialog is open. Tests added.
- **C. Undo and the cooldown.** `cooling` stays on until the pull returns. No test covers this.
- **D. Guest push.** The guest case is now in cron-check-5 (32/0).
- **Nit.** `practise()` scroll uses the `still` test.
- **Results:** test-verses 175/0, test-home 79/0, verses-a-5 23/0, cron-check-5 32/0, parse-check 0 failed. e3: E2b 2, E3 policy ok, E8/E9/E11 ok.

### Round-2 fixes, Worker B
- `#act-rate` now has a `scroll-margin-bottom`, so after "I said it" there is a 20 px gap below the ratings at every phone size and at XL/XXL text.
- At the default text size, the kid buttons "Read aloud" and "I said it" each stay on one line (smaller icon and type step, no wrapping).
- verses-look-5 193/0, test-verses 175/0, capture 208/0, parse-check 31/0.

## Review round 3

### Core review (rev5-core)
Round-2 items:
- **A FIXED.** E2b gives 2. The 30-day trim works. The `prev`+`hist` row is read correctly. Home and Verses agree (H1/H2/H3).
- **B FIXED** (confirmed by reading the code). E11 ok.
- **C FIXED.** With the network held and Undo pressed within 100 ms, the second tap was refused.
- **D FIXED.** cron-check-5 32/0.

New findings:
- **LOW:** a rating lost by a stale offline device reads harsh. Repro: e4 H1, which shows 1 where the truth is 3. → Worker A: use `rev:` rows to read that day generously.
- **NIT:** a break older than the 30-day history disappears on the next rating. This is the documented rule; accepted.

Suites: test-verses 175, test-home 79, cron-check-5 32, verses-a-5 23, text-policy-5 26.

### Visual review (rev5-visual), round 3

**Round-2 items, all fixed:**
- The kid gap is 20 px at every size.
- The kid labels sit on one line.
- The row-tap motion follows the Motion settings in both directions.
- The U key is dead once its toast is replaced, while a confirm sheet is open, and after the toast is dismissed.
- Nothing fixed in rounds 1 and 2 came back.

**New findings, both sent to Worker B:**
- **LOW:** on short screens a kid must scroll before tapping to reach "I said it" (375×667, and 430×740 in Safari).
- **NIT:** "20:1-3" wraps at the hyphen in Coming up.

**Checks:** verses-look-5 193/0, test-verses 175/0, test-design 60/0, capture 208/208.

**Housekeeping:** the reviewer deleted the 18 untracked rm27-*-graphite screenshots its round-2 run had made.

### Round-3 fixes
- **Worker A (the streak).** `wasDueOn` and `versesStreak` now count a verse's `rev:` days. If the verse was rated after the chosen schedule's `last` and before the day being checked, that day is read generously. In the e4 H1 case the streak went from 1 to 3. test-verses 176/0, test-home 80/0.
- **Worker B (kids on short screens).** At 760 px of height or less, the kid view uses tighter spacing and type and hides the paraphrase's small print; the label stays. "I said it" now shows without scrolling at 375×667 and in Safari at 430×740. Queue references no longer wrap. verses-look-5 207/0, test-verses 176/0, capture 208/0.

## Review round 4
- **Core: CLEAN.**
  - e4 H1 gives 3; H2, H3 and C are unchanged.
  - e5 tried to break the new rule: a zero `rev:`, a tombstone, `rev:` on the same day as `last`, `rev:` on day d, nothing due after a lost rating, and a kid. Every case matched, and Home and Verses agree.
  - test-verses 176/0, test-home 80/0.
- **Visual, round 4.**
  - The kid fold and the paraphrase label are verified.
  - New: the queue chevron lands alone on line 2 at 375 and 390. This is a LOW regression caused by the nowrap rule.
  - Nits:
    - At XXL a reference breaks at its hyphen.
    - The who-pill wraps to "2 to / go" (this was there before the batch).
  - All three went to Worker B.
  - verses-look-5 207/0; capture 208/208.

### Round-4 fixes, Worker B
- `.qrow` is a grid with the chevron in column 2.
- `span.cv` keeps "chapter:verse" and "Week N" together (a template change in the script).
- The pill count no longer wraps.
- verses-look-5 213/0; test-verses 176/0.

## Review round 5
- **Visual: CLEAN.**
  - Queue rows at every size and variant: 0 bad rows.
  - The pill count never breaks.
  - `.qbody` is a span; the accessible name stays "Practise <ref>"; the focus ring and Enter work.
  - Capture 208/208; verses-look-5 213/0.
- **Both reviews are clean. Final run next.**

## First final run (final-5)
- **Measure:** verses and the shell, all 3 sets: 0 failures.
- **Lanes:** 4 nonzero, all known stale tooling: kid-flow, critic-doubletap, double-tap 2-1, and 2-2 (not reset). All 9 -5 copies passed with exit 0:
  - verses-a-5 23/0;
  - verses-look-5 213/0;
  - text-policy-5 26/0;
  - cron-check-5 32/0.
- **Suites:** 23 passed. smoke-api 330/0, smoke-chat 64/0. prayer-check 47/2 (baseline), check-ids 49/49. The 9 phase6 checks and the p6-3 and p6-4 copies all exit 0.
- **Captures:** verses 208, shell 979, f260 629, prayer 809. All ok.
- **pxdiff against batch 4:**
  - f260: 25 changed. Prayer: 17 changed. Both apps' code is unchanged; the spot-checked shots show scroll-position and timing noise (week-complete-desktop: the week list caught mid-scroll in batch 4; kid-faces: a 1 px scroll). The sprite's i-star change defaults to no fill.
  - shell: 105 changed. Home: 92 (the new card). Apps: 6 (60 px). Chat: 5 (under 25 px). first-visit: 4.
- **REGRESSION found by orchestrator** (first-visit iPad portrait): Today's reading card is now shorter (paired with the Verses card) and its art overlaps "12-day streak". Prayer now has a gap and Kids sits alone in the grid. → Worker C.
- **Rescore:** started (independent judge).
- Apps 60 px change: cropped before and after, "Kitchen timer" label anti-aliasing only (noise).

### Worker C fix after the first final run (Home art overlap)

**Cause.** The spot art was absolutely positioned underneath the text. The overlap was older than this batch: batch 4's Home already had 322 text/art overlaps, in 102 of 144 loads (the Kids names, and the fridge "4d"/button at XXL). The Verses card's position exposed it on the 820 F260 card.

**Fix.**
- `.gcard` is now a grid with a footer row: the button on the left, the art in its own column (`--spot-w min(34%,150px)`; Kids and Stars `min(38%,170px)`).
- The button gets `max-width: 100%`.
- The Verses card moved after Prayer, which keeps the batch-4 pairs.

**New check: `phase6/5/home-art-5.mjs`.** 144 loads: Eli, a guest, Mom × 4 widths × light/dark × default/XXL × first visit/loading/offline.
- Overlaps: 322 (batch 4) / 348 (before the fix) → 0.
- Evidence in `p6/5/home-art/`.

**Tests.**
- test-home 80/0, test-kitchen 55/0, test-tv 85/0, parse-check 31/0.
- CLAUDE.md's shell bullet updated.

→ Visual review round 6 (the Home grid).

## Independent rescore (first pass, on the first final run)

**Verses:** 5.6 → 5.9 (5.59 → 5.86; range 5.8-6.0 depending on 5 policy calls).

**Changed cells:**
- Layout 6 → 5.5 (LAY-3½)
- Shape 5.5 → 6.5
- Icons 6.5 → 6 (ICO-4 for the kid pictures)
- Motion 4.5 → 5
- Native 6 → 6.5
- Ease 5 → 6
- Delight 5.5 → 6.5

**Issues and who fixes them:**
- Show falls below the fold on small iPhones because of the practice grid, the share link and the recorder (MED). → B
- The rig cannot show the recorder (MED). → B: stub it in areas/verses.mjs.
- The top toast covers the pill for 10 s (LOW-MED). → A: an in-card status line with Undo, 64 px for kids. This also fixes the kid Undo size and the toast wrap.
- Frost AA failure on the current queue row (4.19 / 4.26). → B
- The kid star collides with the reward star. → B
- Two empty bands. → B
- `--r-lg` off-concentric. → B
- The dark histogram's brightest bar. → B
- "2 weeks tomorrow" reads as one phrase. → B
- The First letters dots. → B
- The `hub.avatarHtml` photo can be dragged. → B

### Worker A: rescore follow-up

**The status line `#rated`**
- `role=status`, `aria-live=polite`. It is the first child of `#trainer`; `placeRated()` moves it to `#done` when that card shows.
- Adult text: "<word> — <ref>. Next review in N days." Kid text: "Got it! Next time: in 2 days."
- The Undo button is at least 44 px (at least 64 px for kids) and carries `aria-keyshortcuts`.
- The line lasts 10 s, then fades with the motion tokens. It keeps its row, which is reserved from the first rating of the visit.
- The U shortcut works only while the line's Undo is showing.

**Other changes**
- The top-toast override is removed. Other toasts use the shared bottom toast again.
- CLAUDE.md is updated. The kid "Got it" picture is now `i-check` (B's change); CLAUDE.md still says "star", for B to fix.

**Results:** test-verses 180/0, test-home 80/0, verses-a-5 23/0.

**Note:** the line's row takes space only after the first rating, so it adds height once.

## Visual review round 6 (the Home grid)

**Confirmed fine:**
- home-art-5: 0 overlaps.
- TV: 0 changed.
- screens-shell: layout shift 0, 18/0.
- test-home 80/0, test-kitchen 55/0, test-tv 85/0.

**Findings (both → Worker C):**
- **LOW:** buttons wrap in narrow cards (Open the ledger 175 → 156 px, two lines, at 1180), and the art shrank.
- **LOW:** the Kids card shares a row, so names truncate ("E.. ★3") or the card stretches. Fix: span the full row.

### Worker B: rescore follow-up (10 items)

1. **Show above the fold.** The text link, editor and recorder now sit below the rating row; the mode switch is one row below 560 px, with tighter spacing on short adult screens.
   - At 375×667, Show moved from 606–666 (WebKit) and 691–751 (Chromium, with the recorder) to 526–586 in both.
   - A's line is now a single 44 px row, and its selectors are scoped to `p.rated` (`#trainer.rated` was colliding with them).
2. **Capture stubs.** The capture adds MediaRecorder and getUserMedia stubs, so the recorder now shows.
3. **Frost contrast on `li.cur`.** `--text-2` raises it from 4.19 to 6.2; every palette is now at least 5.69.
4. **Kid "Got it".** It now uses `i-check`.
5. **Empty band above.** It is gone; the one band left is the reserved rating row.
6. **Radii.** `--r-inset`.
7. **Dark histogram ramp.** It runs fill → `--mint-strong`, with box 4 borrowing seafoam-graphic. Box 5 is still the brightest block, which was accepted because it encodes mastery.
8. **Chips.** They read "every N days".
9. **First letters.** A single hairline underline.
10. **`hub.avatarHtml`.** Added `draggable=false`; test-photos 28/0.

**Results:** verses-look-5 226/0, test-verses 180/0, test-design 60/0, screens-apps 90/1 (the Tally failure, pre-existing), capture 208.

**Leftovers sent to A:** the `span.cv` in the result line, and CLAUDE.md (check, layout).

## Visual round 7, part 1 (Verses after the rescore fixes)

**Findings:**
- **LOW-MED:** the card jumps +56 to 60 px when the first result line appears.
- **LOW:** the recorder floats about 100 px below Read aloud / Show before Show.
- **NITs:**
  - The mode switch at XXL is 72 px wide.
  - The Undo button reads as plain text.
  - The editor hint leaves an orphan "it.".
- **All of these went to Worker B.**

**Checked and fine:**
- Show stays on the first screen at 375 and 390, with and without text and the recorder.
- The line is a status line; Undo is 71×44 for adults and 102×64 for kids; it covers nothing.
- Focus order is correct.
- The histogram passes in all 6 palettes; the chips look right; the kid check is in place.
- verses-look-5 226/0, test-design 60/0.

## Core round 5 (the in-card line): CLEAN except one nit
- **e6 checked the line on the rig:**
  - no hub.toast;
  - Undo works by value, returns the verse revealed and puts focus on Got it;
  - the line moves to #done and back;
  - practise-anyway works;
  - when the line ends with focus on it, focus goes to Show;
  - U is ignored while the confirm is open;
  - the kid line uses a 64 px button;
  - the kiosk never arms it.
- **e1–e5 unchanged.** test-verses 181/0, test-photos 28/0, verses-a-5 24/0.
- **NIT:** the kid line said "Next time: in 2 days", but kids' verses come back daily. → A: "See you tomorrow".

### Worker C: round-6 Home fixes
**Layout changes**
- Footer row `.gfoot` = [button][art]: the button is `flex:none` and the art shrinks first.
- Wide cards (container query, 560 px and up) put the art back in the corner, which keeps batch 4's heights. Kids is 196 px.
- Kids takes a full row at 720 px and up.
- Kid chips wrap. Names are never ellipsised.

**home-art-5 is extended to 3 checks over 288 loads (typical and park day)**
- Art overlaps: batch 4 604 → 0.
- Wrapped labels: → 0.
- Cut names at default size: 0.
- Cut names at XXL: batch 4 24 → 0.
- A negative control fired.
- 116 one-line pager ellipses remain by design (100 in batch 4).

**Docs:** CLAUDE.md shell bullet updated.

**Not yet run (the lock was held by B):** suites, parse-check, re-capture.

### Worker B round-7 fixes
- **Result-line row** is reserved from the first paint: 44 px for adults, 64 px for kids. The kid's line sits at the foot of the trainer (`placeRated` changed; noted in hooks).
- **No movement** on the first rating: the reference keeps its in-card y at 375, 390 and 1180, for both adult and kid.
- **Show stays above the fold** before and after the first rating: at 375×667 it sits at 306–366 and 526–586.
- **Record** is now a compact row directly under Read aloud / Show, captioned "Stays on this device". After Show the ratings stay on screen: 375 → 430–516 of 619.
- **Smaller fixes:** 2×2 mode switch at XL/XXL, soft-filled Undo, `text-wrap: pretty`.
- **Checks:** verses-look-5 250/0, test-verses 181/0, capture 208.
- **Worker C's suites on the final round-6 Home:**
  - test-home 80/0, screens-shell 18/0 (Home CLS 0.000), test-kitchen 55/0, test-tv 85/0.
  - home-art-5: 288 loads / 1536 cards with 0 overlaps, 0 wraps and 0 cuts.
  - Capture: 42 OK.

## Visual round 7 part 2

**Verses:** all part-1 items are fixed.
- No jump: card and page positions stay identical.
- Show is on the first screen.
- The kid fold holds.
- The recorder sits with the button group.

**Home**
- Fixed:
  - Buttons no longer wrap.
  - Kids takes a full row.
  - home-art-5 shows 0/0/0.
  - screens-shell 18/0, CLS 0.
  - TV 0 changed.
- New findings:
  - **LOW:** the art can shrink to a 9 px speck at 1180 XXL. → C
  - **LOW:** the kid Stars headline wraps at 820. → C
  - **Pre-existing:** the kid's 7th star wraps on the park-day iPhone. → C (optional)
  - **NIT:** at 375 XXL the Verses mode switch is a 4-high stack. → B

### Worker C round-7 fixes (finished by the orchestrator)
- **Art width:** `watchSpots()` ResizeObserver adds `.thin` to any art under 48 px, which hides it.
- **Stars card:** keeps the full body width. On a kid's Home, every card takes the whole row from 720 px.
- **Week of stars:** the 7 stars fit on one row (`min(30px, (100% - 12px)/7)`).
- **home-art-5 r7-final:** 384 loads, 1664 cards. Every check is 0: overlaps, wraps, cuts (default and XXL), specks, the Stars headline, and the star row. 136 one-line phone ellipses are expected by design.
- **CLAUDE.md:** the orchestrator added the speck rule, the kid full-row rule and the stars-row rule.
- **Next:** the second final run (final-5b), which adds screens-shell. The first run's assembled evidence was moved to `SCRATCH/p6-5-first`.

## Second final run (final-5b): all green
- **Suites:** 24/24, including screens-shell 18/0.
- **API and chat:** smoke-api 330/0, smoke-chat 64/0.
- **Repro runs:** the -5 copies all exit 0. Only the 4 known stale originals still fail.
- **home-art-5:** 384 loads, 0 everywhere.
- **Captures:** verses 208, shell 979, f260 629, prayer 809.
- **Pixel diffs:** F260/Prayer differ from batch 4 in 23/20 shots. A recapture of the pre-batch code shows a different set (18/23). The opened pairs show only scroll-position timing with identical content; see `capture/f260-prayer-noise.md`.

## Final rescore (on final-5b)

**Verses: 5.6 → 5.9 (first pass) → 6.1 (6.14). The range is 6.0-6.2.**

| Cell | First pass → final | Why |
|---|---|---|
| Colour | 4.5 → 6.5 | COL-1 earned; COL-5 restored |
| Layout | 5.5 → 6 | |
| Native | 6.5 → 7 | |

**First-pass issues:** 10 fixed, 2 partly fixed, 1 accepted as designed (the box-5 brightness).

**Open issues, all sent to Worker B for a focused follow-up:**
- **A, low:** an empty band at the top of the card, because the line's row is reserved.
- **B, low:** the line sits under the viewer bar after Show on an iPad in landscape.
- **C, low:** the kid icons differ from the adult icons.
- **D, nit:** the mode labels wrap on a phone.
- **E, nit:** no due count in the scrolled overdue view.

**Contrast accounting, written to `p6/5/measure/contrast-accounting.md`:**
- **Verses:** 6 samples, all disabled buttons while loading.
- **Shell:** the new items come from shell work after batch 1, not this batch:
  - the locked PIN pad and the offline picker are disabled or edge samples;
  - the kid Home hero in dark mode is 4.01–4.38. This is real, it belongs to the shell, and it was found but not fixed.

## Status writer, first pass (on final-5b)
- **Result:** 20/20 entries FIXED; 4/4 work FIXED; carry: 1 FIXED (UX-VERSES-6), 10 PARTIAL. Check: 250/250.
- **Flags raised:**
  - UX-VERSES-1: the kid's second verse has no paraphrase. → A: kids practise only the verse Kid Verse teaches.
  - The I1 device check.
  - VIS-1: the reserved gap is by design.
  - **Home MOTION/cls regression:** iPhone moves 33 → 43; iPad 31 → 32, max 403 → 436 px. → C.
  - GLASS/layers was not re-run.
  - The 604 figure appears only in the review.
  - Shell literals grew: spacing 26 → 29, local 26 → 30.
- **Re-run:** the status writer will run again after the follow-up fixes and a focused re-run.

### Worker A: kids practise only the taught verse
- **Change:** `kidVerse()` = `<w>-<KIDWORDS[w-1][0]>`. The kid's trained list, due list, Practise again and summary (total 1) now cover only that verse. Older kid recall rows are kept but not shown.
- **Done text:** "You practised this week's verse."
- **Unchanged:** adults and Kid Verse.
- **Results:** test-verses 182/0, verses-a-5 24/0, kid-flow-5 exit 0 (Acts 2:42 shown with its paraphrase, "1 to go").
- **CLAUDE.md:** updated.

### Worker B: final-rescore items A–E

**A. The kicker and the result line share one slot.**
- The kicker is hidden while the line shows.
- The kicker's y-position is unchanged across the first rating (375 17→17, 390 25→25, 1180 29→29). The band went from about 90 px to 1–5 px.
- The reserved rating room moved to the foot (`order`), so there is no gap above "Add the verse text".

**B. The reveal scroll uses `window.scrollBy`** (not `scrollIntoView`, which also scrolled the hub page).
- iPad landscape: the line stays visible (1180: 60–115; 1024: 16–71), and the hub page scroll stays at 0.

**C. Kid icons.**
- Almost now uses `i-circle-dashed`; "I said it" uses `i-mic`.
- `i-smile` was removed from the sprite (52 symbols). Orchestrator check: nothing references `i-smile`, and every static and dynamic icon id resolves (Prayer maps chev and speak through `ICON_ID`; the rest are the shell's own symbols).

**D. Mode labels.**
- Now "Recall · Letters · Gaps · Order", with full `aria-label`s.
- One line at 375, 390 and 430; 2×2 at XL/XXL.

**E. The Due today header** now reads "25 due · tap one to practise it".

**Results:** verses-look-5 271/0, test-verses 182/0, verses-a-5 24/0, test-home 80/0, capture 208/208.

### Worker C: the Home motion regression
**Cause**
- The Kids card grew from 196 to 229 px when its data loaded (loading state had no summary line or badges).
- A new landmark: the Verses skeleton.

**Fix**
- Kids skeleton keeps its summary line and the badge text.
- The loading Verses card is `display:none` below 1024 px, where it fills its own pager page or cell. The pager dots skip it.
- The hero line keeps its place (phone: `min-height: 2lh`).

**MOTION/cls held**

| Device | base5 | before | after |
|---|---|---|---|
| iPad | 31/403 | 32/436 | **31/403** |
| iPhone | 33/391 | 34/391 | **29/376** |

The lat150 runs are noisy, but they sit within or below the base range.

**Checks**
- test-home 80/0.
- screens-shell 18/0.
- home-art-5 r8-final: still running at hand-back.
- test-kitchen and test-tv: not re-run yet.

## Core round 6
- **LOW:** a kid's "Practise again" keeps last week's verse after the week steps (stale `againIds`). Repro: e7. → A: filter by `trained()`.
- **Nit:** the pager dots are computed only at paint, so rotating across 1024 px while the card is loading can make them stale. → C.
- **Checked fine:** the kid one-verse flow, the summary, the done text, two devices, the old rows kept, Kid Verse untouched, the slot swap (the kicker reads current data after the fade), and the pager dots while loading and when loaded.
- **Suites:** test-verses 182/0, test-home 80/0, test-kidverse 51/0, test-tv 85/0.
- **A — againIds:** now filtered by `trained()`. e7: the device on Practise again moves to 5-0. test-verses 184/0.
- **C — pager dots:** `paintDots()` counts placed cards, after each paint and on matchMedia changes at 1023 and 719 px.
  - Probe: dots 4 → 5 → 4 → 5, always matching the cards.
  - home-art-5 r8-final: 384 loads, 1616 cards, 0 failures.
  - test-home 80/0, screens-shell 18/0.

## Visual round 8: CLEAN
- **Verses:**
  - the band is gone (the kicker sits at the card padding);
  - the slot swap holds steady at 375, 390, 1180 and 1440;
  - on the iPad in landscape the line is in view;
  - there is no gap above "Add the verse text";
  - the kid icons are right and there is one verse;
  - the mode labels fit one row (2×2 at XL/XXL);
  - verses-look-5 271/0.
- **Home:**
  - home-art-5 0s;
  - CLS held: iPad 31/403 (equal to batch 4), iPhone 29/376 (better than batch 4's 33/391);
  - the loading and loaded states look right;
  - screens-shell 18/0, CLS 0.
- **Nit, by design:** the line hides the next card's kicker for 10 s.
- **Next:** the third final run (final-5c) on the finished code.

## Rescore confirmation on final-5c
- **Score:** Verses stays at 6.1 (6.14); no cell changed.
- **A–E:** A, B, D and E are fixed. C is only partly fixed: the kid's "I said it" uses `i-mic`, the same icon as the adult Record button.
- **Follow-up:** Worker B is switching "I said it" to `i-eye`, the same drawing as Show. That keeps one meaning per icon (ICO-4 lifted, which would make the row 6.2). After the change: test-verses, verses-a-5, verses-look-5, then recapture verses into `screens-after/5`.
