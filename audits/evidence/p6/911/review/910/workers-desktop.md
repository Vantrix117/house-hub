# Batch 9+10 worker reports (desktop round)

## Worker B (build guide) — desktop finish
- All B entries + carry-overs done: P3-DOLLYWOOD-03,-04,-05,-06,-07,-09,-11,-14,-15,-18, P3-DOLLYWOOD-LIVE-14, UX-DOLLYWOOD-1 (template half),-2,-4,-7,-11,-12,-14, VIS-DOLLYWOOD-11,-16, GAP-DOLLYWOOD-1, IMP-DOLLYWOOD-I1, P3-DOLLYWOOD-LIVE-09, CONS-MOTION-4, CONS-SHAPE-4, UNFILED-2; REGION CLEAN.
- Fixes: sticky bar re-reads on scroll/resize/repaint (sbCalc); phone step-card buttons first (order:-1); build-head loading line keeps its rows (.ldx).
- verify.py hub-phone thresholds 70dvh->60dvh, toolbar groups 5->4 (A's phone first screen made them obsolete).
- guide-b-9: waits poll for state; cold-open CLS measured from the first sample after the card is built (was measuring a half-parsed document).
- Results: guide-b-9 138/9 -> 147/0 (one run 146/1 under load, unidentified); test-dollywood-sync 60/0; look-a-9 143/0; verify.py "step checks: all sections OK".
- Device: sticky bar + phone sheet in Safari; 3D perf on iPad; possible early-tap landing on the shell tab bar within ~1 s of an app's first load (rig only, not investigated).

## Worker D (Worker, shell, waits, meeting point, infra) — desktop finish
- Waits core re-read: complete, unchanged. Build OK with HUB_REPO=hub-audit; parse 34 + 8 scripts, 0 failed.
- Done: GAP-DOLLYWOOD-LIVE-1 (arrive push), -2 (trend), P2-PWA-18 (Rally), P3-DOLLYWOOD-LIVE-11 (Express alias), -15 (6 h drop), -18 (pin drops at 2 h), UX-DOLLYWOOD-LIVE-6 (one error line), VIS-DOLLYWOOD-LIVE-2, -8, GAP-DOLLYWOOD-LIVE-4 (offline line), VIS-TELL-1, sprite.
- Partly: GAP-DOLLYWOOD-LIVE-3 (hours link only; data deferred). DEFER: VIS-DOLLYWOOD-LIVE-12, "left the park" alerts. GAP-ICON-2 / GAP-MOTION-3 not re-checked (cloud did them).
- Results: park-d-10 61/0; smoke-api 445/0; test-park 22/0; test-push2 118/0 (arrive: once, not twice, none with switch off/guest/kid/already there); test-home 123/0; home-art-5 0 overlaps (run split typical/park: one-shot crashes Chromium); rally -10 "reachable (fixed)"; bump-sw --check ok.
- Script fixes: park-d-10 section 5 read innerText of a collapsed pane -> #lv-src/.lv-stamp textContent; smoke-api arrive block: Eli's token (Niece's was reset), kid token for admin-only check, read-back via ?scope=person&key=, item.value.
- CLAUDE.md test counts: smoke-api 445, test-home 123, test-push2 118, test-park 22.
- Device: Rally -> "Meet at" push on a 2nd iPhone; arrival push walking to the pin; live wait chips/trends; GAP-MOTION-3 motion; Express names vs queue-times.

## Worker C (park map) — desktop finish
- verify.py "step checks: all sections OK" (kids' heights now types into the number field; a guide phone-layout 572 vs 591 px failure once, passed on rerun: load).
- park-c-10 53/0 -> 57/0 (WebKit; +1 check: "Set my spot" chip label vs fill). test-dollywood 42/0. screens-apps 91/0. test-dollywood-themes not run (harness passes the code where it expects a port).
- Bug fixed: A's `[data-flavor=live] button{background-color:var(--surface)}` beat `.lv-act` -> denied chip white on white; `.lv-act`/`.lv-act.sec` now prefixed. Placing pill title wraps on phones.
- All 28 C entries + CONS-ICON-2, CONS-MOTION-1, VIS-SHAPE-1/CONS-SHAPE-3 park halves done (park-c-10 sections 1-18 + heights).
- Phase 3/4 park scripts: 28 run; compass contrast 21/42 sub-4.5 -> 0 (min 5.68); idle main thread 2.4% -> 0.5%; targets under 44 13 -> 4 (52x32 switches inside 44 px labels); long meet text still truncates at 317 px.
- -10 copies: verify-critic-kid-share-switch-noop-5-1-10, -5-2-10 (kid never sees Share switch); verify-beacon-height-controls-missing-when-nobody-sharing-2-10 (number fields).
- Open: meeting-pin label cut off at the left edge on a 390 px phone ("eet · The Wildwood Tree") — D's region. Captures not compared with before.
- Device: GPS + wake lock in park; kid speech; press feel; WebKit pulse timing.

## Worker D — park review round 1 fixes (server)
- Item 1: shared park box x -300..2500, y -300..3510 (contains the PROPERTY polygon) in park.js:6-7, parkJob, where_is_family, index.html parkOn(); docs fixed (park.js, index.html, CLAUDE.md:21, worker/README.md 237/286, template README). test-park +lot case (24/0); test-home +far-lot case (run queued). Probe B: lot alert now notifies eli, christian, mom.
- Item 2: arriveJob retries owed switched-on recipients every minute until the meet ends / 2 h; also fixed told arrays aliasing in-memory state (a later success was never stored). test-push2 +failed-delivery case (122/0). Probe A: retried once, then nothing twice.
- Item 10: smoke-api arrive block commented as wiring-only (points to test-push2). Item 11: CLAUDE.md test-push2/test-park rows.
- smoke-api 445/0; park-d-10 61/0 (one mock now sends pref_off for the new third Rally wording). verify.py OK; exported.
- test-home pending at C:/Users/ex_bo/b910/runs/d/home2/_summary.txt (expect 124/0).

## Worker C — park review round 1 fixes (map)
- Items 3-9 fixed in template.html: 3 meeting bar below 600 px: name full row (3 lines, meta 2), buttons own row; 4 drawMeet keeps the label in the visible map clear of controls (right/left/above/below, slide), redrawn on layout changes; 5 "a spot near X" / section / "a spot on the map", never "here"; 6 setMeet writes no feed line (Rally's Worker line only); 7 zero-reached wording from skipped reasons; 8 pill second line wraps; 9 pulses use fill-opacity. Also: far-state "undefined" bearing -> "a long way off".
- park-c-10 57 -> 79/0 (sections 19-21 new); park-d-10 61/0 (section 9 relaxed: label any side that fits); vis-pill -1-1 317/317, -1-2 meta visible 0.28 -> 1; rally -10 reachable. verify.py OK; exported.
- probe-meet 390: adult name 194 -> 332 px, XXL 163 -> 332 unclipped; pin label on screen (adult, XXL, kid).
- test-dollywood not re-run yet (stale suite lock from 21:19, cleared by orchestrator 23:2x).
- Not looked at: kid dark, 1180/1440 captures; iPad portrait only overflow.

## Worker D — guide review round 1 (items 1, 6b)
- index.html guideHome() (~1757) {loading:true} with no summary/no pull/no cache; guideCardHtml() (~1765) same-size skeleton .is-loading at EVERY width (hiding it below 1024 kept the move at 672).
- TELL/loading shell iPad portrait largest move 672 -> 431 px (card off 424; pre-batch 403). test-home 123 -> 126/0 (new loading check). home-art-5 typical/park 0 overlaps.
- CLAUDE.md rows: test-home 126 (NOTE: its text says "hidden below 1024 px" but the skeleton shows at every width — check); test-dollywood-sync 60; new rows test-dollywood (42) and test-dollywood-themes (PORT arg, no count).

## Worker B — guide review round 1 (items 2,3,4,5,6a,7,8,9,10)
- 2 plot: typing previews only; saved 900 ms after last key / change / blur / onLeave, only when valid; badInput invalid. 3 toast lifted above #stickbar from 700 px. 4 sizeCard measures every step (1 distinct height over 242 steps at 820/1180/1440 default and 1180 XXL). 5 build_html.py inlines the 25 used sprite symbols into the reference build (36 uses, none missing). 6a template README 60dvh/one chip row + "The build guide in the hub (batch 9)"; LICENSE "Four more symbols"; template icons/sprite.svg stays untracked (copied at build; README says so). 7 .readout wraps. 8 seed "Built … (Showstreet)". 9 #secsel/coaster casing stroke-opacity; basemap filter:opacity(.45) (SVG <image> has no fill-opacity). 10 .bhead title flex:1 1 0, … on the title row (no CLS).
- guide-b-9 147 -> 161/0 (new "review" section); look-a-9 143/0; test-dollywood-sync 60/0; verify.py OK; exported. Plot fill in tests dispatches change.
- Follow-up asked: remaining SVG opacity (coaster track image, highlight/cross-section attrs).

## Worker D — park round 2 (arrive retry window)
- arriveJob owed[id]={at,n,to}: retry only within 15 min (ARRIVE_RETRY_MS), max 5 tries (ARRIVE_TRIES), only recipients owed at arrival. probe-spam: 118 extra attempts / 119 failed rows -> 4 / 5. probe-arrive A still retries once. test-push2 122 -> 124/0; test-park 24/0; smoke-api 445/0; park-d-10 61/0. README/comment/CLAUDE row updated. 15-min limit proven by the probe's simulated clock only.

## Worker B — opacity sweep follow-up
- Highlight ring/halo, cut line, ghost, profile fill, .clab -> fill/stroke-opacity; coaster track <image> filter:opacity(.85). Built pages: 0 map-SVG opacity besides the two documented image filters. guide-b-9 161/0, look-a-9 143/0; park-c-10 74/5 on B's run (reviewer got 79/0 on the same export: load suspected; C confirming).

## Tally (batch 11) — round 2 fixes
- >3 counters: #cpick "<name> … Counters · N" opens a list sheet (rows --tap-row, 72 px kid). Room mode .count calc(var(--disc)*1.3/max(digits,3)): Eli 162 -> 313 px. test-tally 141/0, tally-claims-11 196/0.

## Worker C — park round 2 + park-c-10 74/5 cause
- Cause: the park seed stamps rows at "today 08:07 New York"; before 08:07 they are future-dated and putOne refuses writes more than 30 s ahead (applied:false), so the beacon-off / share-off writes fail. Not a code regression. park-c-10 now SKIPs (loudly) sections whose seeded rows are future-dated: before 08:07 NY: PASS 60 FAIL 0 SKIPPED 4 (sections 1, 8, 9, 21). FINAL RUN MUST BE AFTER 08:07 NY.
- (a) layoutTop line break restored (grep "R-park 4)window" = 0). (b) drawMeet extra candidates (above2/below2/aboveL/R/belowL/R), farthest from faces; new section 22 (XXL 430 px no face over the label) passes.

## Worker D — guide round 2 (Home skeleton for non-users)
- guideHome(): skeleton only with a per-person hint hub.guideHint.<id> (the last settled card's data, saved when a summary row is seen, cleared when a pull shows none); the skeleton is that card's own text in skeleton paint (same height at every width). No row -> no place, no jump.
- test-home 126 -> 132/0 (skeleton height = settled at 390/820/1180; hint cleared; no-row person never shows a skeleton). home-art-5 0 overlaps (typical 1064 cards, park 1192). CLAUDE.md test-home row fixed (132).
- TELL/loading shell (cold device, held pull): 431 -> 672 px again — a cold device has no hint, so the card pops in once; trade-off for reviewer judgement.
