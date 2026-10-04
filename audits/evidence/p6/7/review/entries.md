# Batch 7 — Kid Verse: 16 entries + the 3 kept improvements (IMP-KIDVERSE-F3, -I1, -I2), at the end; carry-overs are in b7-carry.md

#### P3-KIDVERSE-04 — The seven day dots and their "N of 7 days" label show verse days only, while ★N also counts story and prayed stars

- **Area** kidverse · **Type** bug · **Severity** medium · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:289`; `apps/kidverse.html:277`, `apps/kidverse.html:60`; `audits/evidence/p3/kidverse/verify-day-dots-vs-count-1-mom-kids-panel.png`, `audits/evidence/p3/kidverse/verify-day-dots-vs-count-2-ezra-after-verse-and-story.png`
- **What happens now.** `daysHtml` lights a dot only where `s.days[d] === true`, a verse star (`apps/kidverse.html:277`). `weekCount` adds `credited.story` and `credited.prayed` (`:414`), and item 20 widened the count this way (`:269`) without changing the dots. Both the kid card (`:361`) and the grown-ups panel (`:372`) use them.
- **Why it matters.** For a pre-reader the dot row is the picture of their progress. It contradicts the number, hides two of the three ways to earn, and VoiceOver reads an impossible "N of 7 days".
- **Proposed fix.** Each day dot shows every star earned that day (star, book and heart marks), or the row is labelled as the verse row. (Phase 3: IMP-KIDVERSE-P2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/verify-day-dots-vs-count-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-day-dots-vs-count-2.mjs"`, `node "audits/tools/phase3/kidverse/star-rules.mjs"` — the defect must no longer reproduce; plus batch 7's checks.

#### P3-KIDVERSE-05 — After the week stepper the verse moves, but the story card stays on the old week while its speaker reads the new week's story

- **Area** kidverse · **Type** bug · **Severity** medium · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:325`; `apps/kidverse.html:336-340`, `apps/hub.js:206-210`, `apps/kidverse.html:672`; `audits/evidence/p3/kidverse/adult-week-A-after-plus-story-card.png`, `audits/evidence/p3/kidverse/verify-story-card-stale-after-step-2-after-plus-story.png`
- **What happens now.** `setWeek` calls only `render()` (`apps/kidverse.html:336-340`), which never touches the story card (`:343-377`). `renderStory` runs at boot and on `hub.onChange` (`:676`), and hub.js fires `onChange` only for remote changes (`apps/hub.js:206-210`): `hub.set` never emits (`:231-243`), and a pull skips a row whose local stamp is as new, so …
- **Why it matters.** The adult who just set the week sees a mismatched story. Reading the card aloud gives last week's story; tapping the speaker gives a different story from the one on screen.
- **Proposed fix.** A week change repaints the story card. (Phase 3: IMP-KIDVERSE-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/verify-story-card-stale-after-step-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-story-card-stale-after-step-2.mjs"`, `node "audits/tools/phase3/kidverse/adult-week.mjs"` — the defect must no longer reproduce; plus batch 7's checks.

#### P3-KIDVERSE-12 — A Reset week that Kid Verse applies after the ISO week rolls over leaves that week's verse stars on the balance

- **Area** kidverse · **Type** bug · **Severity** medium · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:538`; `index.html:1374`, `apps/kidverse.html:270`, `index.html:1326`, `apps/kidverse.html:456`; `audits/evidence/p3/kidverse/critic-reset-crossweek-next-kid-after.png`, `audits/evidence/p3/kidverse/critic-reset-crossweek-same-kid-after.png`
- **What happens now.** The reset row lists this ISO week's days up to today (`index.html:1374`). `normStars` rebuilds a row from an earlier ISO week with `days: {}` (`apps/kidverse.html:270`), and the shell's `rewardRow` does the same (`index.html:1326`). `applyLedger` resets a verse day only where `s.days[d] === true` (`apps/kidverse.html:456`;
- **Why it matters.** The parent was told "This week's 6 stars come off the balance". Up to 7 verse stars stay payable, and the balance in Me silently goes back up overnight.
- **Proposed fix.** A reset row carries the verse days it clears, and Kid Verse applies them whatever the current ISO week. (Phase 3: IMP-KIDVERSE-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/critic-reset-crossweek.mjs"`, `node "audits/tools/phase3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-2.mjs"` — the defect must no longer reproduce; plus batch 7's checks.

#### P3-KIDVERSE-13 — A story or prayed day not yet credited when a parent resets the week is credited after the reset

- **Area** kidverse · **Type** bug · **Severity** medium · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:576`; `apps/kidverse.html:457`, `index.html:1348`, `apps/kidverse.html:453-457`, `index.html:1341`; `audits/evidence/p3/kidverse/critic-reset-uncredited-prayed-kiara-after.png`, `audits/evidence/p3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-2-kiara-after.png`
- **What happens now.** `applyLedger` marks `'reset'` only the story and prayed days already credited `=== true` (`apps/kidverse.html:457`). `reconcile()` applies the ledger first (`:471`), then credits every uncredited story and prayed day in the 14-day look-back with a fresh `earnedAt` (`:473-474`), which is later than the reset's `at`, so the `before()` …
- **Why it matters.** The parent sees the week cleared; then the kid's card shows stars for that same week and the balance goes back up, even above its pre-reset figure.
- **Proposed fix.** A reset marks story and prayed days up to its date as reset before crediting (time-stamped marks for the reset's own day). (Phase 3: IMP-KIDVERSE-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/critic-reset-uncredited-prayed.mjs"`, `node "audits/tools/phase3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-2.mjs"` — the defect must no longer reproduce; plus batch 7's checks.

#### UX-KIDVERSE-2 — Done ★ is below the first screen on iPhone, iPad landscape and desktop; "I heard it" is two screens down

- **Area** kidverse · **Type** usability · **Severity** medium · **Effort** M · **Batch** 7
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: The report understates the landscape, desktop and Safari case. There, 'Read it to me' is off the first screen as well as Done ★, so the whole action row is hidden. 'I heard it is two screens down' is loose: its top sits at 1.89 viewport heights, on the second screen, about one screen of scrolling.
- **Evidence.** `audits/03-apps/kidverse.md:663`; `audits/evidence/p3/kidverse/visual-P-kid-iphone-first-screen.png`, `audits/screens/kidverse/kid-typical-iphone-pwa-light.png`
- **What happens now.** Standalone at 430×932 the scene art takes 274 px; Done ★ spans 851-935 px, so in the shell (48 px viewer bar) only its top edge shows; the stars card starts at 951 px, "I heard it" at 1713 px, on a 2304 px page.
- **Why it matters.** Done ★ is below the first screen.
- **Proposed fix.** Kid layout: the art, the speaker and Done ★ fit the first screen on every device; the story card follows. (Phase 3: IMP-KIDVERSE-P3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/visual.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 7's checks.

#### GAP-KIDVERSE-1 — The family week never advances by itself, and changing it tells nobody

- **Area** kidverse · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:741`; `apps/kidverse.html:338`, `apps/kidverse.html:336-340`; `audits/screens/kidverse/adult-f260-hint-typical-iphone-pwa-light.png`
- **What happens now.** `setWeek` writes only `{week, by, at}` (`apps/kidverse.html:338`), with no `hub.activity` line. Nothing advances the week with the calendar or F260; the only link is the adult's own "Use week N" hint (`:370`). This also leaves the TV's kid line empty (P2-HOME-07).
- **Why it matters.** The week never advances and nobody is told.
- **Proposed fix.** Offer "Move to week 39?" on Sunday evening to adults, and post a feed line when the week changes. (Phase 3: IMP-KIDVERSE-F1)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 7's checks.

#### P3-KIDVERSE-06 — The kid's stars card labels the cash-in balance "all time"

- **Area** kidverse · **Type** bug · **Severity** low · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:361`; `apps/kidverse.html:361`, `apps/kidverse.html:497`, `apps/kidverse.html:381-384`, `apps/kidverse.html:355-362`; `audits/evidence/p3/kidverse/verify-all-time-label-2-A-before-cashin.png`, `audits/screens/kidverse/kid-stars-overflow-ipad-portrait-light.png`
- **What happens now.** The stars card prints `s.total`, the balance a cash-in resets, as "N all time" (`apps/kidverse.html:361`). The code's own comment (`:381-384`) and CLAUDE.md define `total` as the cash-in balance and `earned` as all-time; "My rewards" on the same page prints `s.earned` as "N ever" (`:497`).
- **Why it matters.** Two contradictory totals sit on one screen, and a parent looking at the kid's device misreads the balance.
- **Proposed fix.** Label the balance "to cash in" and show earned as "869 ever". (Phase 3: IMP-KIDVERSE-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/verify-all-time-label-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-all-time-label-2.mjs"`, `node "audits/tools/phase3/kidverse/rowsize.mjs"` — the defect must no longer reproduce; plus batch 7's checks.

#### P3-KIDVERSE-09 — The stars row keeps every credited day forever, and every change uploads the whole row twice

- **Area** kidverse · **Type** bug (perf) · **Severity** low · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:437`; `worker/src/data.js:4`, `apps/kidverse.html:405`, `apps/hub.js:264`, `apps/kidverse.html:402-413`; `audits/evidence/p3/kidverse/verify-stars-row-growth-2-after-tap.png`
- **What happens now.** `rewardsExtra` keeps every date key in `credited.story` and `credited.prayed` (`apps/kidverse.html:405, 411`) and trims only `earnedAt`, to 30 days (`:410`). `applied` is never pruned either (`:409`); `payouts` is capped at 50 (`:407, 449`).
- **Why it matters.** Each star uploads about 15 KB twice after a year, and every device keeps and re-downloads it.
- **Proposed fix.** Fold credited days older than the look-back into counters; upload once per change.
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/verify-stars-row-growth-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-stars-row-growth-2.mjs"`, `node "audits/tools/phase3/kidverse/rowsize.mjs"` — the defect must no longer reproduce; plus batch 7's checks.

#### UX-KIDVERSE-1 — Several kid steps need reading: identical "Read it to me" buttons, the "I heard it" check, and text-only toasts

- **Area** kidverse · **Type** usability · **Severity** low · **Effort** M · **Batch** 7
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: The headline 'several kid steps need reading' overstates it. No step needs reading to complete. Reading is needed only to understand text-only feedback and to know to listen before tapping. 'Past midnight a pressed Done today ★ can show beside 0 stars' is not supported.
- **Evidence.** `audits/03-apps/kidverse.md:656`; `apps/kidverse.html:665`; `audits/evidence/p3/kidverse/webtells-toast-over-content.png`, `audits/screens/kidverse/kid-story-typical-iphone-pwa-light.png`
- **What happens now.** Verse: speaker, then star, works by icon and position, but Done ★ is off the first iPhone screen and nothing tells the child to listen first.
- **Why it matters.** Several kid steps need reading.
- **Proposed fix.** Distinct pictures for the two speaker buttons (a verse scroll, a storybook), a big picture "I heard it" (an ear + star), and spoken toasts. (Phase 3: IMP-KIDVERSE-F2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 7's checks.

#### UX-KIDVERSE-4 — After a parent's Reset week, the stars card says "No stars yet" while the story card says "Heard 1 day this week"

- **Area** kidverse · **Type** usability · **Severity** low · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:672`; `apps/kidverse.html:451-458`; `audits/evidence/p3/kidverse/ledger-L4-after-reset-today-spent.png`, `audits/screens/kidverse/kid-week-reset-typical-ipad-portrait-light.png`
- **What happens now.** A reset marks credited days "reset" in the stars row (`apps/kidverse.html:451-458`); the story card counts the separate story row (`:661-665`), which a reset does not touch. After a reset of today, Done ★ stays pressed ("Done today ★") beside 0: correct under the one-a-day rule, but it looks like an error to a child.
- **Why it matters.** Contradictory cards.
- **Proposed fix.** After a reset, the story card and the stars card agree ("Heard 1 day · no stars this week").
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 7's checks.

#### UX-KIDVERSE-5 — With no family week set, Kid Verse silently shows week 1

- **Area** kidverse · **Type** usability · **Severity** low · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:675`; `apps/kidverse.html:253`; `audits/screens/kidverse/kid-empty-iphone-pwa-light.png`, `audits/screens/kidverse/adult-empty-iphone-pwa-light.png`
- **What happens now.** `clampWeek(undefined)` is 1 (`apps/kidverse.html:253, 276`). An empty household sees Genesis 1:27 and the creation art as if an adult had chosen it, with no prompt to pick a week.
- **Why it matters.** Week 1 shows silently.
- **Proposed fix.** With no family week, adults get "Pick this week's verse" and kids a friendly placeholder.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 7's checks.

#### UX-KIDVERSE-9 — Badge and payout dates have no year

- **Area** kidverse · **Type** usability · **Severity** low · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:691`; `apps/kidverse.html:490`; `audits/evidence/p3/kidverse/rowsize-overflow-ezra-rewards.png`
- **What happens now.** `fmtDay` formats month and day only (`apps/kidverse.html:490, 498-499`). Overflow Ezra's badges from 2025 read "Jul 28" and "Jul 30"; "Last cashed in: 13 stars on Mar 1."
- **Why it matters.** Badge dates have no year.
- **Proposed fix.** Show the year on dates older than this year. (Phase 3: IMP-KIDVERSE-P5)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 7's checks.

#### UX-KIDVERSE-10 — For adults, their own panel is two or more screens below the kid art

- **Area** kidverse · **Type** usability · **Severity** low · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:694`; `audits/screens/kidverse/adult-verse-typical-desktop-light.png`, `audits/screens/kidverse/adult-empty-ipad-portrait-light.png`
- **What happens now.** Adults get the full kid layout first: the scene, the reference and two cards. The Kids' stars panel and the week stepper, the adult's job here, sit two or more screens down on desktop, iPad and iPhone.
- **Why it matters.** The adult's job is two screens down.
- **Proposed fix.** For adults, the Kids' stars panel and week stepper come first. (Phase 3: IMP-KIDVERSE-P7)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 7's checks.

#### VIS-KIDVERSE-5 — In the grown-ups panel on iPhone the day dots cover each kid's ★ count

- **Area** kidverse · **Type** visual · **Severity** low · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:712`; `apps/kidverse.html:104-111`; `audits/evidence/p3/kidverse/visual-G-adult-kids-panel-overflow-430.png`, `audits/screens/kidverse/adult-typical-iphone-pwa-light.png`
- **What happens now.** `.kn` is `flex:1; min-width:0` beside a `flex:0 0 auto` `.days` (`apps/kidverse.html:104-111`), so the name box is 48 px wide: "Ezra ★3" count right edge 151 px vs dots from 149 px; "Kiara ★1" 157 vs 149, so the "1" is hidden. In overflow, "Ezra Bartholomew Anderson ★6" wraps into three lines under the dots.
- **Why it matters.** The dots cover the count.
- **Proposed fix.** The grown-ups panel gives each kid's name and ★ count their own line on the iPhone. (Phase 3: IMP-KIDVERSE-P6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 7's checks.

#### VIS-KIDVERSE-9 — Button labels repeat their own icon, and the stepper uses text − and +

- **Area** kidverse · **Type** visual · **Severity** low · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:729`; `apps/kidverse.html:160`; `audits/screens/kidverse/kid-stars-overflow-ipad-portrait-light.png`, `audits/screens/kidverse/adult-typical-iphone-pwa-light.png`
- **What happens now.** A star SVG beside "Done ★" / "Done today ★" (`apps/kidverse.html:160, 359`), a check SVG beside "Heard it today ✓" (`:173, 663`); the stepper's − and + are text glyphs (`:369`); three badges use the numerals 7, 10 and 50 as glyphs.
- **Why it matters.** Doubled icons.
- **Proposed fix.** Drop the repeated ★/✓ glyphs from labels and use Lucide minus/plus in the stepper.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 7's checks.

#### VIS-KIDVERSE-11 — The rewards summary wraps with a dangling separator

- **Area** kidverse · **Type** visual · **Severity** low · **Effort** S · **Batch** 7
- **Evidence.** `audits/03-apps/kidverse.md:735`; `audits/screens/kidverse/kid-rewards-overflow-iphone-pwa-dark.png`, `audits/screens/kidverse/kid-story-overflow-iphone-pwa-light.png`
- **What happens now.** With a large balance at 430 px, "· 6 this week ·" ends line 1 with a dot and "867 ever" sits alone on line 2.
- **Why it matters.** A dangling dot.
- **Proposed fix.** Wrap the rewards summary as separate items without dangling separators.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 7's checks.
#### Improvements with no finding (kidverse)

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). The household kept all of them (`audits/05-decisions.md`, "Features kept or cut"), so each app batch carries its own.

| ID | Improvement | Kind | Delight | Effort | Source | Status |
|---|---|---|---|---|---|---|
| IMP-KIDVERSE-F3 | Highlight each word of the paraphrase and story as it is read, from `SpeechSynthesisUtterance` boundary events | feature | 5 | M | `audits/03-apps/kidverse.md:903` | open |
| IMP-KIDVERSE-I1 | Past weeks shelf: earlier weeks' scene cards a kid can tap to hear an old verse or story again (read-only, no new stars) | idea | 4 | M | `audits/03-apps/kidverse.md:911` | open |
| IMP-KIDVERSE-I2 | Record a parent's voice: an adult records the verse once a week (the media store), and "Read it to me" plays Mom's or Dad's voice instead of the synthetic one | idea | 5 | L | `audits/03-apps/kidverse.md:912` | open |
