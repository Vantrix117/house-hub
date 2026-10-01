# Batch 4: the workers' reports (digest)

## Worker A — F260 logic, data, copy + IMP-F260-F4 (26 done, UX-F260-6 partly)
- P3-F260-02: an untick removes today's log (a `log:<date>` row) when no other reading was ticked today; the streak, summary, Home
  and the nudge follow; a best streak set today is given back. Chat's set_f260_reading done:false does the same.
- P3-F260-03: an unread today is pending, not a rest day, in F260 streakInfo, Home logStreak and chat logStreak. The card says
  "read today to keep it" when both rest days are used. "Start a new streak / 0" → "11-day streak · read today to keep it".
- P3-F260-04: `finished` and `summary.finished` clear when the total drops below 260.
- P3-F260-07: Undo restores the previous current week and removes the start date Done created.
- P3-F260-09: `.readmode .side` removed from the hide rule (a CSS line in B's region).
- P3-F260-10: percent floored, max 99 below 260, at least 1 after one reading.
- P3-F260-11: pace plural fixed (0/10 mismatches).
- P3-F260-12: the unlock and set-passcode text is device-neutral.
- P3-F260-15: Erase and Restore say "on all your devices".
- P3-F260-16 / UX-F260-2: the Reset confirm names the Verses review schedule; a 10 s hub.toast Undo restores every row from a
  one-level snapshot (Leitner fields included).
- P3-F260-17: HEAR, week note and follow-up save only when the text changed (date and iv unchanged, nothing re-uploaded).
- P3-F260-18: a week's start date is set by its first tick; "done in N days" ≥ 1.
- P3-F260-19: the stepper and Week select no longer stamp a start (week-start rows 38–41 → 38).
- P3-F260-20: search matches raw text and escapes each piece.
- UX-F260-1: no "this device" wording.
- UX-F260-3: the Journal tab shows a locked state with Unlock / Set passcode; HEAR buttons open the dialog.
- UX-F260-4: reading mode's exit reads "Close" with sprite i-x.
- UX-F260-6 PARTLY: at ≥ 1024 px the weeks column scrolls on its own and opens at the current week (B added a print override); phones
  and portrait iPad still open on Today (scrolling the page would push Done below the fold and break test-f260).
- UX-F260-8: a 44 px header gear `#hdrSettings` opens Settings (`#settingsBtn` kept).
- UX-F260-9: "last read" once.
- UX-F260-10: the sort button names the current order; aria-label says what a tap does.
- UX-F260-11: `#todayJournal` on the Today card → unlock → today's HEAR entry (2 taps + passcode; was 6).
- UX-F260-13: after today's tick, Done reads "Read ahead" (class `.ahead`, for B).
- UX-F260-14: `.hero.dup` hides the repeated kicker, title and meta (from the markup, so no jump).
- GAP-F260-1: `#todayCatch` "Missed: Week 30 · Day 3 — Malachi 2" + Catch up (Today offers it until ticked; "Not now"; page-only
  state); counts from the first week read.
- IMP-F260-F4:
  - A `push_pref:readAt` "HH:MM" on the half hour (unset = 8 pm).
  - eveningJob runs at every firing for each person's hour, once a day, only when nothing is logged; `chosenTimes()` is shared
    with prayTimeJob; a forced admin run ignores the times.
  - Me → Notifications gets `#notif-read`, greyed while the switch is off.
- Files:
  - f260.html: many script functions plus the markup `#hdrSettings`, `#todayCatch`, `#todayJournal`, `.hero.dup`, `.wkcol`.
  - Small CSS additions in B's region.
  - worker/src/reminders.js, worker/src/chat.js, index.html (Me notifications, Home logStreak), worker/README.md.
  - CLAUDE.md Push/Schedule; its smoke-api count still says 306, and it is now 325.
  - Tests: test-push2 (+9), smoke-api (+3), audits/tools/areas/f260.mjs (journalTab helper).
  - New in phase6/4: journal-4, verify-vis-unlock-…-1-1-4 and -1-2-4, cron-check-4, f260-a-4.
- Scripts:
  - journal, verify-vis-unlock-1-1/-1-2 fail on purpose (UX-F260-3); their -4 copies pass.
  - layout.mjs fails on B's heatmap class rename.
  - critic-dates A/B, hear-focus-3-2, week-ahead-4-x and stepper-5-1 hit the same clock.fastForward rig error before and after,
    and reach the fix before it.
  - cron-check-4 29/0; the original 2b cron-check is now 12/6 by the intended jobsAt change.
  - f260-a-4 21/0; the chat untick check 5/0.
- Suites (fresh D1):
  - test-f260 58/0 (×2), test-prefs 35, test-kidstory 50, test-verses 80, test-home 65.
  - test-push2 61 → 70, smoke-api 322 → 325, smoke-chat 64, test-park 20.
- Looked at: Today, reading mode, the locked journal, the catch-up line, XXL (the header gear wraps onto its own row at 390).
- For B: capture practice / practice-reveal overflow screens now time out (the "Practise N verses" collapse hides the chip
  areas/f260.mjs taps); layout.mjs and verify-heatmap-* look for `#heat span.today` (renamed by B).
- Needs a device: the reading nudge at a chosen time via real push; iOS keyboard on the Journal focus; nested scroll on iPad
  landscape.

## Worker B — F260 look + the shared icon set (all done except 3 partials)
- **icons/sprite.svg:** 48 symbols, Lucide geometry at one weight; external `<use>` works in the iframe in WebKit and Chromium.
  - The first version held an invalid `--` in an XML comment, so every icon was blank; now fixed. It was noted to P in b4-sprite.md.
  - design.css component half: `svg.sym` with size variants (token half byte-identical).
  - sw hub-v43 → v44; LICENSE-lucide lists what ships.
- **Entries done:**
  - P3-F260-08: heatmap today `.is-today` 25×12; grid 7 rows (was 8×14).
  - UX-F260-7: past three, the chips fold into one 44 px "Practice N verses"; Day 1 56 px below (was 340).
  - VIS-F260-3: CLS 0.0463 → 0.0011.
  - VIS-F260-4: `--op-disabled`.
  - VIS-F260-5: one footer style.
  - VIS-F260-6: WebKit clear glyph hidden; the ring on the pill.
  - VIS-F260-7: print tick boxes, read in grey, straight rules, 3 pages.
  - VIS-F260-8: footnote `--text-3`.
  - VIS-F260-9: sameRow at 1180/1440.
  - VIS-F260-13: wraps under the badges.
  - VIS-F260-15: controls disabled when locked or empty.
  - VIS-F260-16: modal solid.
- **Carry-overs 1-16 done:**
  - CONS-TOK-1, CONS-TYPE-2 (+ GAP-TOK-4's type half), CONS-MOTION-1, CONS-MOTION-4 (+ GAP-MOTION-1).
  - CONS-SHAPE-1/3/4/6, CONS-TELL-1, CONS-TOK-3, CONS-ICON-1 (+ GAP-ICON-2), CONS-ICON-2's F260 half.
  - CONS-TYPE-1: the h1 is hidden in the hub via `html.framed`, set pre-paint; standalone it takes the large-title role.
  - VIS-SHAPE-2: 20 px margin.
  - CONS-SHAPE-2 re-measure: 390 / 720 / 1200.
- **PARTLY:**
  - VIS-F260-12: chrome not selectable; the switch; memory ticks 44 px; book-bar hit areas via `::after`; year-grid cells cannot reach 44.
  - CONS-TOK-2: one segmented recipe for the Plan/Journal switch and the settings choices; `.switch`/`.sheet`/`.seg` names stay (the script and tools use them).
  - VIS-ICON-1: kept "Read today ✓" (test-f260 asserts it), ✓ and ★ in toasts, 🎉 in copied text.
- **Worker A's notes:** `.tdone.ahead` is an outlined capsule; the area file's `practiceChip()`; the -4 copies (layout-4, verify-heatmap-…-1-4/-2-4); the header holds one row at XXL on 390.
- **Phase 4, before → after:**
  - TOK/literals: spacing 211 → 2, radius 34 → 0, font-size 68 → 0, weight 88 → 0, color-mix 1 → 0, targets 48 → 2.
  - code-scan: 68 calc → 0 (117 role tokens).
  - ICON/static: stroke widths 2/2.5/2.6/3.5 → rings only; private symbols 11 → 0; emoji 13 → 1; glyphs 28 → ✓4 ★1 −1.
  - MOTION/press: 56/102 → 105/105.
  - MOTION/cls: landmark moves 9 (317/514 px) → 0.
  - SHAPE/analyze: macro grid 36.8 → 85.2 %; large radii on scale 96.8 %. The states-run raw data is still pre-batch.
- **Scripts:** 44 of 44 exited 0 before. After, 5 fail on purpose (layout and heatmap-1/2: class rename; journal and vis-unlock-1: A's UX-F260-3); their -4 copies pass.
- **Suites:** test-f260 58, test-prefs 35, test-design 60, contrast 0, print pass.
  - screens-apps 90/1: "tally: page background changes". Tally is untouched since 80af987; its body paints a gradient, so backgroundColor is transparent. B did not measure it on the pre-batch code.
  - It left untracked docs/screens/rm27-*-graphite-* files.
- **Gates:** parse 0, no hex, bump-sw OK, check.js 47/2, check-ids 49/49.
- **Capture:** 629 planned (72 journal/practice screens failed before A's area-file change); cap2 recapture 96/96. Looked at light/dark 390/430/820/1180/1440, L and XXL, print, the practice modal, Read ahead, the choices, the fold.
- **Needs a device:** GAP-MOTION-3 press feel; long-press on iOS; the external sprite offline from the SW precache in an installed PWA.
- **Open:** CLAUDE.md does not mention icons/sprite.svg or svg.sym yet. The shell's i-flame for the feed is 2a's half (the sprite has i-activity for it).

## Worker P — Prayer's missed batch-1 leftovers (all 11 done)
1. CONS-TOK-1: Prayer's alias block is gone; every read uses design.css names.
2. CONS-MOTION-1: every control uses the .pressable recipe, applied by selector (check.js reads the class names literally). Presses were .86/.94/.96/translateY; now adult 19/19 at 0.97 (kid 9/9, was 4/9).
3. CONS-SHAPE-4: Pray now and Pray mode's controls are capsules at --btn-h-lg; every button.act is --r-button.
4. CONS-SHAPE-1: ledger, prompt, .ask, and the kid cards now use the card tokens (.ask in the sheet is --r-control, concentric).
5. CONS-SHAPE-6: no radius literal left (7→--r-xs, 18→--r-full, .sk 6→--r-xs, 999→--r-full/--r-button).
   SHAPE/analyze "large radii on scale" fell 50.8 → 32.8 % (kid 97.8 → 0). The tool checks against a fixed old list (adult [12,16,22,28,36], kid [16…44]), not design.css's tokens (--r-xs 6, kid --r-card 38). NEEDS A JUDGEMENT on how to read that number.
6. CONS-SHAPE-3/GAP-TOK-4: spacing on --sp-* (macro grid 44.6 → 92.3 %); --margin replaces 22 px; faces are --face-* built on --icon-* and scale by kind.
7. CONS-TELL-1: .body/.ans/.recall/the read-aloud title/label are unselectable (selectable controls 10 → 0).
8. CONS-TOK-2: Mine/Family and My list/Family list now use design.css .ds .seg (the rows carry class ds).
   Renames: .chip→.p-chip, .small→.compact, .pill→.p-tag, .sheet→.p-sheet (it stopped leaking onto hub.confirm), .toast→.p-toast, .hero→.lead.
   Kept on purpose: .row/.list/.empty/.wrap/.dot/#pray .card/.bar.
9. CONS-MOTION-4: placeholders take the loaded content's space; bars use --track (invisible on Hearth before).
   Pray now moves: iPhone 60 → 5 px, iPad 12 → 6. The last 5–6 px is a whole-header first-paint shift that is also in the before run. Kid page 0.
10. CONS-ICON-1: Prayer uses icons/sprite.svg via svg.sym at --icon-stroke and --icon-* sizes; icon() draws from the sprite, and the SVG class names the checks read are kept. Stroke widths {1.75,2,2.2} → none on the page; 9 <use>.
11. Unassigned:
    - CONS-TOK-3: color-mix 1 → 0 (the pickup is now --glass-pickup-layer + --glass-shadow; @supports fallback --glass-strong-solid).
    - CONS-ICON-2: the Add tab is i-plus (not circle-plus).
    - Columns: kid .wrap → --col-read; #kitchen .k-in → --col-wide; #lock 19rem stays (no token).
    - Also: at XXL, Pray now stays on one line.
- Files: prayer.html (style, class names, inline margins, renderLoading, icon(), SVGs). test-prayer and test-prayer-faces use `.switch` → `#listSwitch`. New phase6/4/verify-share-drops-days-2-4.mjs.
- TOK/literals: spacing 170 → 1, radius 18 → 0, --size 7 → 0, targets 15 → 2 (kid 64, required by check.js).
- Suites: prayer 36, faces 42, kitchen 55, rewards 73; phase6/3 copies 12/12 (look-3 61/0, claims 6/6); check.js 47/2, check-ids 49/49.
- Capture 809/809, taken before the last XXL actions-row fix.
- Note: P's own transcript once showed the local test Worker's pairing code (from a process listing). It was not written to any file, and is not the household's real code.
- Needs a device: press feel, long-press, blur.

## screens-apps before/after (orchestrator)
- The check: base4 (pre-batch) gives 90 passed, 1 failed; the working tree gives 90 passed, 1 failed. The same failure both times: "tally: page background changes between forest and hearth (rgba(0,0,0,0) → rgba(0,0,0,0))".
- Verdict: PRE-EXISTING.
- Cause: Tally's body paints a gradient image, so backgroundColor is transparent.
- Owner: a test quirk for Tally's batch 11 (or a fix to the test); not caused by batch 4.

## Review round 1 — core
1. MEDIUM-HIGH regression: an untick erases a log day another device logged.
   - Where: f260.html:1965; the same pattern in worker/src/chat.js:399-406.
   - Cause: tickedToday() checks only this device's cache, so another device's offline or unpulled tick loses under LWW, and nothing repairs it.
   - Probe p1: server log:<today> is false while Acts 6 is ticked; readToday false; streak 12; /api/f260/readers drops Eli; the nudge would fire.
   - Fix: after each pull (loaded, writable), if tickedToday() && !log[today], write log today = true back (like Prayer's repairToday, after the whole pull). Optionally the Worker's evening job and readers also count done:* ticked today.
2. LOW: Reset's Undo overwrites changes made in the 10 s window (putMap over newer rows; weekStart, best and miles whole rows). Code reading only. Fix: skip rows newer than the reset's writes.
3. LOW: chat's untick does not give back best, and keeps summary.finished when the total drops below 260. Fix: finished: s.finished && total >= 260, and the best give-back.
4. nit: the "Read week N" feed line stays after an untick (Home feed, TV fallback).
5. nit: verses.summary goes stale after Reset or Undo until Verses opens.
- Fine:
  - the streak rule agrees in 3 places on 20,000 random logs;
  - a single-device untick;
  - week starts;
  - Reset/Undo of all rows (p5 3/3; f260-a-4 20/1 once under suite load: the server read before the ~400-row flush);
  - the journal rules; search XSS; the Journal action and locked state; the readAt rules incl. DST, invalid values and forced runs;
  - Prayer renames and .ds rows; the sprite, offline in Chromium.
- Suites: f260 58, prefs 35, kidstory 50, verses 80, home 65, push2 70, prayer 36, faces 42, kitchen 55, rewards 73, api 325, chat 64, claims-3 6/6, check.js 47/2, check-ids 49/49, phase6/4 9/9, phase6/3 12/12.

## Round 1 core fixes — Worker A
1. Fixed. `repairLog()` runs in f260.html 2 s after the last pull change (never mid-pull) and once on load, when loaded and writable.
   - It puts today back when log:<today> is an untick (false) written after a reading still ticked today.
   - A later write (Reset's Undo, a restore) never revives a day, and a lone untick stands.
   - Server side: the evening job and GET /api/f260/readers apply the same rule via `f260UntickOutlived()`.
   - p1: server log false → true; readToday false → true; streak 12 → 13; readers drop Eli → include him.
   - The single-device untick still removes the day; Mom's control stays true.
2. Fixed. The reset records its time. Undo skips map rows newer than that, and restores the whole rows only if unchanged since the reset. f260-a-4: a reading ticked by another device in the window survives.
3. Fixed. Chat untick gives back best (prev), tombstones f260.finished, and writes summary.finished = s.finished && total >= 260. chat-untick 7/0.
4. Left on purpose: the feed is append-only history; the log and readers (repaired) are the source; the TV uses feed lines only as a fallback.
5. Fixed. `refreshVersesSummary()` recomputes due, boxes and total after Reset and after Undo (keeps the Verses-owned streak and today count; writes only if a summary exists); f260 now loads verses person scope.
- Re-runs: f260-a-4 26/0 (21 + 5 new), cron-check-4 29/0, test-f260 58, prefs 35, kidstory 50, verses 80, home 65, push2 70, smoke-api 325, smoke-chat 64, parse 0.
- Files: f260.html (script only), worker/src/reminders.js, index.js, chat.js, phase6/4/f260-a-4.mjs.
- TODO at close: CLAUDE.md F260 rules — mention repairLog and the server rule (f260UntickOutlived).

## Review round 1 — entries and screens
- No high or medium. The entries, carry-overs, F4 and Prayer leftovers are done as stated; the workers' partials are confirmed: UX-F260-6, VIS-F260-12 (year cells 11×18, book segments 3–8×44), VIS-ICON-1 (✓/★ in toasts), CONS-TOK-2.
- Low findings:
  1. Prayer's Mine/Family `.ds .seg` track is invisible on Hearth (`--surface-2` = bg) and its item is an 8 px rectangle; F260 uses its own `.switch`. So there are 2 segmented looks, and CONS-TOK-2 is not hub-wide.
  2. In a dark theme F260 prints ticked boxes with a faint coloured border.
  3. `svg.sym` icons do not scale with the text size (XXL).
  4. The kid hands and check are thin 1.75 strokes (batch 3 had a 2.3 duotone).
  5. Prayer cold load CLS: 0.044 on iPhone, 0.033 on iPad (#todayList moves 76 px).
  6. F260 at 390: Journal wraps alone onto a second row.
  7. ICON-6 double meanings: chevron-right is "next" and also a disclosure while the fold uses chevron-down; book-open is both reading mode and the first-reading milestone.
- Nits: Prayer's mark press 0.94 vs F260's 0.97; printed memory box and reference split; a lone "min" wraps; 2 spacing literals left.
- SHAPE/analyze's radius list IS stale (hard-coded at analyze.mjs:12). Against design.css's --r-* roles, F260 is all roles except 26 (pill-clamped) and Prayer is about 100 %. P's 50.8 → 32.8 % is an artefact of the old list.
- Macro spacing: F260 93.2 %, Prayer 95.6 %.
- Scripts and captures:
  - 63 scripts run; only the 5 intended failures, and their -4 copies pass.
  - F260 629/629, Prayer 809/809.
  - Sprite: 564 svg.sym on F260, 16 on Prayer, none blank.
- Routing:
  - To B: 1 (one .ds .seg recipe in design.css, F260 adopts it, shell recapture, writes b4-seg.md), 2, 3 (svg.sym scales with text), 6, 7, and the nits.
  - To P: 1 (adapt Prayer per b4-seg.md), 4, 5, and chevrons per B's convention.

## Round 1 visual fixes — Worker P (Prayer)
1. Done: Prayer's .seg now uses B's shared .ds .seg recipe (b4-seg.md). Probe: track rgb(230,224,215) on page rgb(244,241,236) (visible), track corners 26, item a capsule 999 px at 44 px high, one row at XXL. Every Prayer icon size scales with --ts-user.
2. Done: kid icons --icon-stroke 2.25 (computed 2.25 px at 35 px); the hands keep the palm fill (sprite i-hands); 3-way state holds; no kid target under 64.
3. PARTLY:
   - Kid cold-load CLS 0.031 → 0.
   - Adult 0.044 (iPhone) / 0.033 (iPad) remains. The cause is the review prompt (~60 px + 16 margin) appearing between Pray now and the list once rows arrive (Sundays, or ≥ 3 quiet rotation requests); the header and stats already match.
   - ORCHESTRATOR DECISION: accepted as data-driven (first open only, < 0.1; reserving would leave a gap on most days).
   - lat150 CLS 0.
4. Done: disclosure = i-chevron-down, rotated -90° while closed, upright when open (B's convention).
- Re-runs: prayer 36, faces 42, kitchen 55, rewards 73, claims-3 6/6, review1 8/0, review2 4/0, press 19/19 + 9/9, check.js 47/2, check-ids 49/49, parse 0.
- prayer-look-3 58/3: date-bound. Its "empty calendar day ≥ 3:1" check fails on the 1st of a month (no past empty day); the pre-batch code also fails it today. Sent to P to make it deterministic.
- Capture b4p/cap3 809/809.

## Round 1 visual fixes — Worker B (all 6 done)
1. One segmented control: design.css component half has one rule for `.ds .seg` and a new global `.segmented`: a --track fill + --separator hairline, concentric corners, --r-full capsule items on one line, all states on tokens; token half byte-identical. F260's Plan/Journal and 4 settings choices carry `.segmented` (hooks kept); only the floating phone bar keeps glass (`.switch.segmented`). A contrast regression ("Week 13" 1.05-1.66) was caused and fixed back to 0. The shell's index.html .seg overrides (`.appearance .seg` wraps, item padding --sp-2) still apply and look right (Me → Appearance checked).
2. Print: ticked boxes black in every theme; print turns transitions off (the cause was a transition caught mid-way, which also printed read lines grey in dark WebKit); memory box + reference nowrap; print.mjs pass.
3. svg.sym and variants = --icon-* × --ts-user (stroke stays 1.75); F260's own icon sizes too; XXL icons grow.
4. Today at 390 after Done: one row (Done 192, Undo 64×44, Journal 44×44 pen-only with its name kept); at XL/XXL Done on its own row. No horizontal scroll; targets ≥ 44.
5. ICON-6: expand = i-chevron-down (−90° closed, upright open); next/prev = chevron-right/left; new i-book-marked for the First reading milestone (49 symbols); reading mode keeps i-book-open.
6. Nits: the meta keeps "~4 min" whole; .wkcol on tokens (spacing literals 2 → 0); min-width 200px stays (no token).
- Checks: layout-4 OK; cold CLS 0.0011; contrast 0 in 7 runs; test-f260 58 + test-prefs 35 (after the bar fix), test-design 60, screens-apps 90/1 (the same Tally check); parse 0; bump-sw OK (hub-v44).
- Captures b4b/cap3: F260 629/629, shell 979/979 (most F260 screens taken before the bar fix; not recaptured).

## Review round 2 — core
All round-1 fixes verified. p1 is fixed; p7 shows no revival of a really unticked day; the server rule matches the client; chat untick 7/0; shell .seg OK; Prayer OK.
1. NEW MEDIUM (from the round-1 Undo guard): undoReset's whole(...) guard skips the weekStart, best, miles, finished and week rows when any newer row exists. p5b otherPulled: week starts 38 → 1, best 53 → 13, miles 10 → 9 are lost. Fix sent to A: merge, not skip (week dates, miles, best = the higher); skip only for week and finished.
2. nit: refreshVersesSummary writes a row nothing outside Verses reads, and pulls the verses scope on every open. To A: remove it. (CLAUDE.md is accurate: it only says Verses writes it.)
3. f260-a-4 reads after a fixed sleep and flakes. To A: poll.
4. nit: the restore/undo timestamps (a 1 ms ordering edge). To A: optional, one shared stamp.
- Suites: f260 58, prefs 35, kidstory 50, verses 80, home 65, push2 70, prayer 36, faces 42, kitchen 55, rewards 73, design 60, hub 47, api 325, chat 64, claims 6/6, cron-check-4 29/0; f260-a-4 24/2 then 25/1 (the nits).
- Seen in passing: Add a guest's face grid is cut off at 390/XXL (6th column). Asked the visual reviewer whether it is pre-existing.

## Round 2 core fixes — Worker A
1. undoReset was rewritten: async, pull first, decide BY VALUE (the devices' clocks differ by ≥ 1 s, so a time guard lost the other device's tick).
   - The rule:
     - Maps: {...snapshot, ...current}, with the log written before the ticks.
     - Week starts, week ends and milestones: merged, the snapshot's older date winning where both have one.
     - Best: the higher, with its prev.
     - The current week: restored unless moved off week 1 since.
     - Finished: restored unless set since.
   - p5b otherPulled: done 188, log 178, best 53, miles 10, week starts 39, the iPad's tick survives.
   - p5b otherUnpulled: 188/178/53/10/38, the tick survives. Not re-read after the final run: whether week 45's start date survives.
   - A new f260-a-4 merge check.
2. refreshVersesSummary and hub.use('verses','person') were removed (CLAUDE.md is accurate).
3. f260-a-4 now flushes, then polls; 5 runs in a row at 26/0.
4. Restore and Undo write the log before the ticks.
- Re-runs: p1 fixed; p7 OK; cron-check-4 29; test-f260 58; verses 80; home 65; kidstory 50; smoke-chat 64; chat-untick 7/0; parse 0.
- To do at close: CLAUDE.md's F260 bullet should say Undo merges by value.
- Review round 3 (core) has been launched, focused on the by-value rule.

## Review round 2 — entries and screens
- Round-1 visual items all fixed:
  - one seg recipe (Prayer track visible, capsules, one row);
  - print black in dark, read lines struck through rgb(105) grey, memory box nowrap;
  - icons scale (24/20 → 30/25 XL → 36/30 XXL, stroke 1.75);
  - kid stroke 2.25 with palm fill;
  - CLS kid 0, adult header still (76 px from #todayList = the accepted prompt);
  - Today row at 390 and XL/XXL;
  - ICON-6 (chevron-down expand, i-book-marked, 49 symbols);
  - nits.
- NEW MEDIUM (from round 1's shared .seg recipe): F260 Settings #srcSeg is garbled on phones (3 long labels overlap in one nowrap row); at XXL #autoSeg clips too and the page scrolls sideways (sw 422 vs 390). Cause: design.css :is(.ds .seg,.segmented) nowrap + min-width:0, and f260 .segmented.seg fit-content. Sent to B: the shared recipe wraps when items can't fit.
- Add a guest face grid cut off at 390/XXL is PRE-EXISTING: identical numbers on base4 and the current tree. Cause: index.html .emoji-grid (6 columns follow the text scale). A shell issue, not batch 4; record as found-not-fixed.
- Scripts: 63 re-run; only the 5 intended failures; prayer-look-3 61/0; f260-a-4 26/0 alone.
- Captures cap2: f260 629, prayer 809, shell 979 OK. Shell vs screens-after/3: 80 changed (the seg capsules + the known Kitchen timer label shift).

## Review round 3 — core
- The by-value Undo is confirmed:
  - p5b all 3 modes keep the iPad's week-45 date;
  - offline Undo works; a double tap does one restore;
  - with B offline across the Reset and Undo, B's later flush lands;
  - after 10 s the toast is gone;
  - tick then untick inside the window: a reading in the snapshot comes back on (consistent with "undo the reset").
- Still green: p1, p7, chat-untick 7/0.
1. LOW-MEDIUM: Undo or restore can mark today read when nothing was read.
   - Cause: the restored done: rows are stamped today by this device's clock; another device's untick with a clock ahead is newer, so repairLog and the server's f260UntickOutlived revive today (p13: log 177 → 178).
   - Sent to A: (a) re-write log:<today>=false after Undo/restore when it is off; (b) this device remembers the keys it restored today, and tickedToday/repairLog ignore them.
2. LOW UX: a milestone toast replaces the Undo toast. Sent to A: no milestone toast while resetSnap is set.
3. nit (carried): after Undo/restore, today's untick cannot take the day off. (b) fixes this too.
- Suites: f260 58, verses 80, home 65, kidstory 50, prefs 35, push2 70, chat 64, claims 6/6, f260-a-4 26/0 ×3, cron-check-4 29.

## Round 3 core fixes — Worker A
1. A synced person row `restored:<date>` lists the reading ids written back (written before the log and the ticks).
   - Undo lists what it turns back on, except readings really read today before the Reset; restore lists every reading it turns on. done: rows keep their shape.
   - Left out of "ticked today" in: the app (ticksToday/tickedToday/repairLog), the Worker (f260RecentTicks → the evening job, and the readers route via f260UntickOutlived), and chat's untick.
   - (a) was dropped on purpose: re-writing log false after the ticks would make every written-back tick older than the untick, which is the "outlived" case, so the day would come back. A device-local list was not enough: the other device and the Worker apply the rule too.
   - p13 (offset 0 and 4000): log stays 177 (was 178).
   - New f260-a-4 check: read → Reset → Undo → untick removes the day. This also fixes the carried nit.
2. While a Reset can be undone, every F260 toast carries " · Progress reset." + Undo (p11 b0 fixed; a new check).
- Re-runs: p11 all, p5b 3 modes, p1, p7 OK; f260-a-4 30/0 ×3; cron-check-4 29; test-f260 58, verses 80, home 65, kidstory 50; smoke-chat 64; chat-untick 7/0; parse 0.
- Files: f260.html (script), reminders.js (f260RecentTicks), index.js (readers), chat.js, f260-a-4.mjs.
- To do at close: CLAUDE.md F260 bullet (the restored:<date> row, repairLog, the server rule, Undo by value).
- Review round 4 (core) launched.

## Review round 4 — core
- Round 3 fixes confirmed: p13 (both offsets, no revival), p11 (the Undo kept in the milestone toast; offline; double tap; B offline), p5b (3 modes), p1, p7, chat-untick 7/0.
- Code reading:
  - person scope only; the kiosk cannot write; guests write only their own;
  - New York date in the Worker and chat; hub.today() in the app;
  - not re-writing the log was correct.
1. LOW: restored:<date> hides a real tick made later the same day, so a later untick erases a read day (p14: streak 13 → 12, readers drop Eli). Sent to A: "written back and not ticked since", with a race-free shape (no whole-list rewrite under LWW), agreed in the app, the Worker and chat.
2. nit: restored:* rows are never cleaned up. Sent to A: delete them on the first 8 am/8 pm cron firing.
- Suites: f260 58, verses 80, home 65, kidstory 50, prefs 35, push2 70, api 325, chat 64, claims 6/6, f260-a-4 30/0 ×3, cron-check-4 29.

## Round 4 core fixes — Worker A
1. Each Undo/restore writes its own row `restored:<date>:<uid>` = {ids, upTo}, written before the ticks and given upTo after them in the same send, then never rewritten (race-free). A done: row counts as written back only if listed AND its stamp ≤ upTo, so a re-tick counts. The shared rule is in reminders.js addRestored/isWrittenBack; the app, f260RecentTicks and chat agree. p14 fixed (the re-tick counts; the mis-tap keeps the day, streak 13).
2. pruneRestored() on the first 8 am/8 pm firing deletes restored:* older than NY yesterday; README documented.
- Re-runs: p13, p11, p5b, p1, p7 OK; f260-a-4 32/0 ×3; cron-check-4 31/0; f260 58, verses 80, home 65, kidstory 50, push2 70, api 325, chat 64, chat-untick 7/0; parse 0.
- To do at close: CLAUDE.md F260 bullet: restored:<date>:<uid> rows + pruneRestored.
- Review round 5 (core) launched: attack clock skew on upTo, two undos in one day, a missing upTo, prune.

## Round 2 visual fix — Worker B
- **Shared recipe** (`:is(.ds .seg, .segmented)`):
  - The track now wraps (flex-wrap:wrap).
  - Items are flex:1 1 auto with min-width:0 removed, words kept whole, line-height --lh-title3.
  - The track radius stays one row's capsule radius, so a multi-row track stays concentric. B chose this over --r-control; the orchestrator accepts it.
  - The token half is byte-identical.
- **f260.html:** the #themeSeg override is removed. `.mv` (the memory-verse row) can now wrap: it was 235 px wide in a 162 px column at 390/XXL, now 162.
- **Results:**
  - probe-seg: 0 clipped labels at 390/430/820 × default/XXL (#srcSeg was clipped on every phone, plus #autoSeg at XXL).
  - probe-f260set: 390/XXL scrollWidth 422 → 390.
  - contrast 0 failing; test-f260 58, test-prefs 35, test-design 60.
  - parse 0; bump-sw OK.
  - cap4: f260 629, prayer 809, shell 979.
- **Not measured:** the shell's guest "Stays until" and Household "Adult or kid" controls. Round 3 visual review asked to check them.

## Review round 5 — core: NO NEW FINDINGS (core loop closed)
- Re-verified: p14, p13 (offsets 0 and +4 s), p11, p5b (3 modes), p1, p7, chat-untick 7/0.
- Attacks, all fine:
  - Clock skew (p15: the iPad 10 min behind): the re-tick still stamps upTo+2, because hub.set stamps each key ≥ 1 ms past its stored stamp.
  - Two undos in one day: separate uid rows; the readers take the highest upTo.
  - The finish step: the null upTo is never sent (the same queue entry, synchronous); if it ever were stored null, it is treated as Infinity (safe).
  - Prune: the boundary keeps yesterday and today; guests are covered.
  - Only F260, reminders.js, index.js and chat touch the rows.
- Theoretical, not ranked: a re-tick within milliseconds of the Undo on a device whose clock is behind.
- Suites: f260 58, verses 80, home 65, kidstory 50, push2 70, api 325, chat 64, claims 6/6, f260-a-4 32/0 ×3, cron-check-4 31/0.

## Review round 3 — entries and screens: NO NEW FINDINGS (visual loop closed)
- B's seg wrap holds:
  - probe-seg: 0 clipped labels across F260, Prayer and the shell at 390/430/820 × default/XXL.
  - probe-f260set: scrollWidth equals the viewport.
  - The shell's #gexp and #hhkind are one row (they wrap correctly at 320/XL).
  - Recapture cap3 vs cap2: f260 71, prayer 189 (a 1 px line-height shift) and shell 9 changed, all checked.
- Scripts: 63 run, with only the 5 intended failures; f260-a-4 32/0, cron-check-4 31/0, prayer-look-3 61/0.
- One nit, fixed by the orchestrator: the .mv "got it/again" tag wrapped under the check circle.
  - Fix: the reference and its tag are now wrapped in `.mvt` (an inline-flex that wraps), and .mv no longer wraps; print shows `.mvt` inline.
  - Checked by a capture of reading-mode-week-overflow-iphone: the tag sits under the reference. Parse 30/0.
- FINAL RUN `final-4.sh` launched.

## Final run follow-ups (orchestrator)
- **F260 below-AA:** the full detail is 243 (the summary json lists only the top groups: 197).
  - Disabled controls (VIS-F260-4/15, WCAG-exempt): 201.
  - The milestone toast mid fade-in: 3.
  - Under the iPhone floating glass Plan/Journal bar, sampled through the glass at /0.83–0.87 (HEAR, Week note, memory links, Copy summary; the same accepted overlay situation as Prayer's pill under the +): 22.
  - "Suspect" p10-only edge samples with median ≥ 5.9: 12.
  - The print-only subtitle `gray` on white, 3.95: 5. This was PRE-EXISTING (in batch 1's list) → FIXED by the orchestrator: `dimgray` (5.5:1); print.mjs re-run passes, 3 pages.
- **Phase 4 tools:** they were never re-run in the final run (the numbers came from the workers' reports) → `p4tools-4.sh` now runs TOK/literals, TYPE/code-scan, ICON/static, MOTION/press, MOTION/cls, SHAPE/analyze and SHAPE/verify on the final code AND on base4, filed under audits/evidence/p6/4/p4tools/.

## Rescore (audits/evidence/p6/4/rescore.md): F260 5.4 → 6.0; Prayer 5.6 → 5.9
- F260 cells: Typography 5 → 5.5, Colour 5 → 6, Layout 5.5 → 6.5, Shape 6 → 6.5, Icons 3.5 → 4.5, Motion 4.5 → 5.5, Native 5 → 6, Ease 6.5 → 7; Dark, Glance and Delight held.
- Prayer: Layout 5 → 6, Shape 6 → 6.5, Icons 5 → 5.5, Colour 5 → 6 (the latter is a consistency ruling).
- Worse in this batch, sent to B (post-final):
  1. A REGRESSION: in reading mode at ≥ 1024 px, the "This week" side card covers the current week's header.
  2. "· best 47" is 10.8 px, under the 11 px floor.
  3. iPhone multi-row segmented controls (theme 3 rows; BibleGateway alone on a row).
  4. The catch-up line breaks a reference; "~4 min" sits alone at Large.
  5. F260 placeholders are invisible on Hearth; empty images are draggable.
- To P: Prayer's empty-state images are draggable.
- The p4tools run was STOPPED mid-way (the fixes change F260); it will be re-run after them, along with re-measure, recapture and a quick visual review.

## Post-final — Worker P
- Prayer's empty-state images: `draggable="false"` plus `.empty img{-webkit-user-drag:none; user-select:none; -webkit-touch-callout:none}`, checked in WebKit.
- Results: prayer-look-3 61/0, test-prayer 36, faces 42, check.js 47/2, check-ids 49/49, parse 0; cap4 809/809.
- The long-press callout needs an iPad.

## Post-final — Worker B (all 5 fixed)
1. Reading mode at ≥ 1024: `.planview.readmode .side{position:static;max-height:none;overflow:visible}`. The card bottom is 455/513/455 against the week top 537/595/537 at 1024/1180/1440.
2. `.hero .streak small` uses the caption-1 role: 11/12/18 px at XS/default/XXL (was 10.8). `.jf` and `.wnbody label small` likewise.
3. A new opt-in `.seg-grid` in design.css's shared recipe: `repeat(auto-fit, minmax(min(100%, var(--seg-cell, 8em)), 1fr))`.
   - F260's Theme uses 5.5em (3 a row), passages 7em (2 a row; 1 column at XXL), auto-lock 4em.
   - Short controls, the shell and Prayer are untouched.
   - probe-seg: 0 clipped labels; probe-f260set: sw 390.
4. The catch-up reference is held whole; "1 chapter · ~4 min" is unbreakable.
5. Loading wells, strip numbers, % and the loading Done use --track (visible on Hearth). The Today and journal art is not draggable, and F260 sets `img{-webkit-user-drag:none}`.
- Re-runs: layout-4, print (3 pages), webtells CLS 0.0011, contrast 0, test-f260 58, prefs 35, design 60, parse 0, bump-sw OK.
- cap5: f260 629, shell 979. probe-seg was NOT run on the shell's controls this round.
- Review round 4 (visual) launched on the post-final fixes. Then: final-4b (full rerun) + p4tools.

## Review round 4 — entries and screens (post-final fixes): NO NEW FINDINGS
- All rescore fixes verified:
  - probe-readmode at 1024/1180/1440, light and dark, typical and overflow: no overlap.
  - probe-seg: 0 clipped incl. the shell; probe-shellseg unchanged; probe-f260set: sw = viewport.
  - Catch-up kept whole; loading wells visible; art not draggable.
- cap4 vs cap3: f260 213, prayer 15, shell 10 changed, all checked.
- Scripts: 51 with only the 5 intended failures; f260-a-4 32/0; cron-check-4 31/0.
- One comment-only nit (a misplaced comment at f260.html:60), fixed by the orchestrator.
- Then: move p6/4 aside → final-4b (full rerun) → p4tools-4.sh → restore p6/4 (rescore.md, review) → assemble from final-4b.
