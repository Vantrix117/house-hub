# House Hub audit, Phase 3: every app, deep dive

| | |
|---|---|
| **App code audited** | `fe6041d`, unchanged since the Phase 0 baseline. Phase 3 changed no app code; it wrote only under `audits/`. |
| **Scope** | The nine apps registered in `apps.json:4-12`: F260 (`f260`), Larder Ledger (`leftovers`), Prayer (`prayer`), Tally counter (`tally`), Kitchen timer (`timer`), Dollywood build guide (`dollywood`), Dollywood park map (`dollywood-live`), Kid Verse (`kidverse`) and Verses (`verses`). One report each in `audits/03-apps/<app-id>.md`. |
| **Date** | 2026-09-24 |
| **Inputs** | `audits/00-inventory.md` (Phase 0: per-app maps in §9a-9c), `audits/01-capture.md` (Phase 1: the rig; §3 at line 103 is what captures cannot show, §4 at line 122 the manual device checks, §6 at line 394 the contact-sheet index), `audits/01-leads.md` (leads per app), `audits/02-shell.md` (Phase 2: severity rule at lines 25-37, register at lines 117-217, shell rubric at line 5413). |
| **Runtime** | Local instance with the seeded demo household (`audits/tools/lib/local.mjs`), Playwright WebKit (Chromium where a report says so), the demo clock (Tue 22 Sep 2026 08:40 New York) or the real clock. No request went to production; no household data, PIN or pairing code was read or used. |
| **Reproduce** | Experiment scripts in `audits/tools/phase3/<app-id>/`, evidence in `audits/evidence/p3/<app-id>/`. Shared tools: `audits/tools/phase3/compliance.mjs` (platform-compliance counts per app → `audits/evidence/p3/_compliance/<app-id>.json`) and `audits/tools/phase3/check-citations.mjs` (checks every repo path and file:line in the Phase 3 reports). |

## How to read this report

**Method.** Phase 3 ran the same adversarial process as Phase 2, once per app.
1. **One investigator per app** read the code, the Phase 1 captures (`audits/screens/<area>/…`) and the Phase 0 map, and ran its own experiments on the local instance. Each bug, security or perf finding came with a rerunnable script.
2. **Two independent skeptics per finding** re-read the code and re-ran it with their own scripts; a third skeptic broke any split vote (the build guide records one such tie, and the Timer's refuted locked-phone finding went 1-2). A defect is **CONFIRMED** only with at least two confirmations and more confirmations than refutations. Refuted findings sit under each report's "Checked and not a bug", undecided ones under "Unresolved".
3. **A separate visual checker per app** re-scored every rubric dimension and re-checked every house-style deviation against the screenshots. A one-point difference takes the checker's score; a gap of 2 or more went to a judge. The judge ruled three times: Kid Verse Motion (6 vs 4 → 5), Timer Dark mode (7 vs 5 → 6) and Verses Colour (7 vs 5 → 5).
4. **A completeness critic per app** looked for what the first pass missed. Its new candidates went through the same two-skeptic verification; most "(from the critic)" IDs come from here.
5. **A cross-app critic** read all nine reports for duplicates and contradictions. It turned four IDs into pointers (below), added cross-references, and wrote the calibration notes in this file. Each app's owner applied its edits and re-ran the citation check.

UX, VIS, GAP and OK items describe the design, not malfunctions, so they were not sent to skeptics. **Severity** follows the rule in `audits/02-shell.md` (lines 25-37): critical = (a) household data lost or silently overwritten through the shipped UI in normal use, (b) an account or private content exposed, or (c) an app unusable on the iPad, iPhone or TV; downgraded only when it needs hand-made requests or unproven model behaviour. When two skeptics split on severity, one tie rule applies in every report: the rule's own text is applied to the skeptics' corrected claim, and the finding names the clause that decided it (for example `audits/03-apps/f260.md:14`, `audits/03-apps/leftovers.md:14`, `audits/03-apps/timer.md:14`).

**IDs.** `P3-<APP>-NN`. A **primary** ID owns a defect and its severity; a **pointer** keeps its number and evidence but is counted under its primary. A defect Phase 2 already confirmed is not re-filed: each report lists it as a P2 pointer and files only a new facet or trigger.

**Apps discovered.** Exactly the nine in `apps.json:4-12`. Phase 0 found no unregistered page in `apps/` and no registered page missing (`audits/00-inventory.md:145`, `audits/00-inventory.md:2945`); the other files in `apps/` are the shared SDK (`apps/hub.js`), the tokens (`apps/design.css`) and the Dollywood map images in `apps/dollywood/`.

## Summary

- **Totals.** 135 confirmed primary defects across the nine apps: **21 critical, 4 high, 41 medium, 69 low** (Phase 2 found 81 in the shell). Four more IDs are pointers counted under their primaries. Three findings were refuted and one is unresolved (the Timer's iOS beep, U-1); 213 UX, VIS and GAP items sit beside the defects. Every app except the Timer has at least one critical: Kid Verse 5, Prayer 4 (plus 3 high), Larder 3, Tally 3, F260 2, Verses 2, the build guide 1, the park map 1.
- **Worst security defect.** **P3-DOLLYWOOD-LIVE-01:** a name typed into Me → Add a guest runs as script in every household member's park map, and a skeptic read and replayed the admin's tokens locally. With Prayer's two id sinks (**P3-PRAYER-06, -17**, high because they need a hand-made request), it overturns Phase 2's "OK: no stored XSS" (`audits/02-shell.md:2002`). The unsandboxed app iframe with no CSP (`index.html:413`) lets each one reach the tokens.
- **Worst one-tap losses.** In the Larder a double-tap on ✓ finishes two items for everyone (**P3-LEFTOVERS-01**), a change from another device slides a different item under the finger (**-12**), and a kid's tap removes family food (**-13**). In Prayer, "Put back on the list" erases the answer note (**P3-PRAYER-04**) and two devices adding requests pick the same id, so one request is lost (**P3-PRAYER-01**). The build guide's Import took 24 ticks to 0 from an unrelated JSON file (**P3-DOLLYWOOD-02**). A practice rating in F260 wipes that verse's Verses schedule (**P3-F260-01**).
- **Worst losses from sync shape.** 11 of the 21 criticals come from three platform shapes:
  - writes before the app's own first pull lands: P3-TALLY-02, P3-KIDVERSE-01, -03, -11, P3-PRAYER-02, P3-VERSES-03;
  - whole-row last-write-wins on rows several devices write: P3-TALLY-01, P3-KIDVERSE-02, -10, P3-VERSES-02;
  - queued writes stranded when an app closes: P3-TALLY-05.

  Their causes are in `apps/hub.js:334-337` (`hub.ready` stops waiting at 6 s, or at once when any other channel is cached) and `index.html:458-459` (the shell flushes only the channels it declares).
- **Scorecard.** The apps average **4.8 / 10**, against the shell's 4.9 in Phase 2. They range from 3.9 (the build guide) to 5.6 (the park map). The visual check lowered every app's average, by 0.1 to 0.8 points (investigators averaged 5.2). The weakest dimensions across apps are Motion & feedback and Glanceability (4.2 each); the strongest are Delight (5.3) and Dark mode (5.2). Only three cells reach 7 (Tally's glanceability, the park map's dark mode and delight), and no app average reaches 6, so every app sits nearer the rubric's "clean but obviously a web page" anchor (4) than its "polished App Store app" anchor (7).
- **Cross-app themes** beyond sync: kid, guest and kiosk limits enforced only by what the UI hides; "today" computed from each device's local date, with open apps that never roll over (15 IDs in six apps); full re-renders under the finger; destructive actions with no undo; identity by display name; copy from the single-device era ("this device", "this iPad").
- **Phase 2 corrections.** Three Phase 2 statements do not hold for the apps: "OK: no stored XSS" (`audits/02-shell.md:2002`); P2-PROF-05's "no shipped screen lets a kid send these writes" (`audits/02-shell.md:1269`), broken by the Larder's kid ✓ and by the park map's guest beacon switch; and P2-SYNC-15's "Larder cold open is safe" (`audits/02-shell.md:2713`), broken by P3-LEFTOVERS-05. Phase 2's report is not edited; this roll-up records the corrections.
- **Best-value improvements.**
  - Undo toasts: Tally's Reset and the Larder's ✓ (each delight 5, effort S).
  - Escape names in the park map (5/S) and per-person done on the family prayer list (5/S).
  - One hub.js change with an app-side disabled state: hold writes until the calling app's own channels have pulled. It closes about a dozen IDs in eight apps.
  - The shell flushing every queued channel, which closes P3-TALLY-05 and its four sibling channels.

## Scorecard

Final checked scores, 1-10 (10 = could pass for first-party Apple software in the house palette; 7 = polished App Store app; 4 = clean but obviously a web page). The shell row is Phase 2's, for reference (`audits/02-shell.md:5413`). Each app's reasons and screenshot evidence are in its report's "Rubric scores".

| Area | Typography | Color & palette | Layout & spacing | Shape, depth & material | Iconography | Motion & feedback | Dark mode | Native feel | Glanceability | Ease of use | Delight | **Average** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Shell (Phase 2) | 5 | 4 | 6 | 5 | 6 | 3 | 4 | 5 | 4 | 6 | 6 | **4.9** |
| F260 | 5 | 4 | 5 | 5 | 4 | 5 | 5 | 4 | 3 | 5 | 6 | **4.6** |
| Larder Ledger | 5 | 4 | 5 | 5 | 5 | 3 | 5 | 4 | 3 | 4 | 4 | **4.3** |
| Prayer | 5 | 4 | 5 | 5 | 5 | 5 | 5 | 5 | 3 | 4 | 6 | **4.7** |
| Tally counter | 5 | 5 | 6 | 5 | 4 | 4 | 4 | 5 | 7 | 5 | 4 | **4.9** |
| Kitchen timer | 6 | 4 | 6 | 5 | 4 | 4 | 6 | 5 | 5 | 5 | 4 | **4.9** |
| Dollywood build guide | 4 | 4 | 3 | 5 | 4 | 3 | 5 | 3 | 3 | 3 | 6 | **3.9** |
| Dollywood park map | 5 | 6 | 5 | 6 | 6 | 5 | 7 | 5 | 5 | 5 | 7 | **5.6** |
| Kid Verse | 5 | 5 | 5 | 5 | 6 | 5 | 4 | 5 | 5 | 6 | 6 | **5.2** |
| Verses | 5 | 5 | 6 | 5 | 6 | 4 | 6 | 5 | 4 | 5 | 5 | **5.1** |
| **Apps mean (9)** | 5.0 | 4.6 | 5.1 | 5.1 | 4.9 | 4.2 | 5.2 | 4.6 | 4.2 | 4.7 | 5.3 | **4.8** |

- **Where the scores are.** F260 `audits/03-apps/f260.md:767`; Larder `audits/03-apps/leftovers.md:907`; Prayer `audits/03-apps/prayer.md:945`; Tally `audits/03-apps/tally.md:624`; Timer `audits/03-apps/timer.md:435`; build guide `audits/03-apps/dollywood.md:819`; park map `audits/03-apps/dollywood-live.md:725`; Kid Verse `audits/03-apps/kidverse.md:782`; Verses `audits/03-apps/verses.md:575`.
- **Investigator → final average.** F260 5.1 → 4.6; Larder 4.6 → 4.3; Prayer 5.2 → 4.7; Tally 5.1 → 4.9; Timer 5.3 → 4.9; build guide 4.0 → 3.9; park map 6.4 → 5.6; Kid Verse 5.8 → 5.2; Verses 5.6 → 5.1. Every app's average went down. Of the 99 dimension scores, only one was raised: the build guide's Glanceability, 2 → 3. Most of the cuts brought an app into line with the shell's score for the same shared Hearth patterns.
- **Provisional dimensions.** The rig renders fallback fonts and no real backdrop blur, and stills show no motion, so most apps mark Typography, Shape and Motion provisional (see Not verified).
- **Uneven calibration.** The cross-app critic found the same fault scored differently in different apps (see Calibration notes). Phase 4 should rescore the shared Hearth base and the shared Dollywood template once and deduct app-specific failures on top.

## Register of confirmed defects

Primary IDs only, in severity order, then by app in `apps.json` order. Each app cell cites the defect's section in its report, which holds the evidence, reproduction and both skeptics' records. Kinds are bugs unless marked security or perf.

| ID | Severity | App | Defect |
|---|---|---|---|
| P3-F260-01 | critical | F260 `audits/03-apps/f260.md:150` | Rating a verse in F260's practice dialog erases its schedule in the Verses trainer (also filed as P3-VERSES-01, now a pointer) |
| P3-F260-13 | critical | F260 `audits/03-apps/f260.md:462` | A device with the journal still unlocked overwrites a vault that another device erased or re-created; the journal then opens nowhere |
| P3-LEFTOVERS-01 | critical | Larder `audits/03-apps/leftovers.md:166` | A double-tap on one ✓ removes that item and the next one, for everyone, with no undo |
| P3-LEFTOVERS-12 | critical | Larder `audits/03-apps/leftovers.md:596` | A change from another device re-renders the open Larder under the finger, and a single tap removes a different item |
| P3-LEFTOVERS-13 | critical | Larder `audits/03-apps/leftovers.md:633` | A kid's tap on a ✓ removes a family fridge item for everyone, with no undo |
| P3-PRAYER-01 | critical | Prayer `audits/03-apps/prayer.md:177` | Two devices adding a request pick the same sequential id; one request is silently lost for the whole house |
| P3-PRAYER-02 | critical | Prayer `audits/03-apps/prayer.md:222` | A slow or failed first pull on a new device overwrites the person's prayed-days history and plans (and the family list's) |
| P3-PRAYER-03 | critical | Prayer `audits/03-apps/prayer.md:261` | Import a backup tombstones other people's newer family requests and erases today's prayed marks |
| P3-PRAYER-04 | critical | Prayer `audits/03-apps/prayer.md:296` | "Put back on the list" erases the answer note with one tap, no confirm and no undo |
| P3-TALLY-01 | critical | Tally `audits/03-apps/tally.md:146` | Two devices of the same person lose each other's taps, because every tap writes the absolute count (5 of 8, 12 of 13, 4 of 6 lost) |
| P3-TALLY-02 | critical | Tally `audits/03-apps/tally.md:191` | A tap during a slow or failed first load replaces the saved count (37 → 1) |
| P3-TALLY-05 | critical | Tally `audits/03-apps/tally.md:314` | Taps still queued when Tally closes are never sent by the shell, which reads synced; a later count on another device erases them (37 + 4 + 2 → 39). Platform cause in the shell (`index.html:458-459`) |
| P3-DOLLYWOOD-02 | critical | Build guide `audits/03-apps/dollywood.md:197` | Import progress replaces all progress with any JSON file (the hub's own Prayer export took 24 ticks to 0), with no check, confirm or undo |
| P3-DOLLYWOOD-LIVE-01 | critical | Park map `audits/03-apps/dollywood-live.md:147` | Security: a profile or guest name runs as script in everyone's park map; the admin's tokens can be read and replayed |
| P3-KIDVERSE-01 | critical | Kid Verse `audits/03-apps/kidverse.md:159` | Done ★ tapped during a slow or failed first load overwrites the kid's whole stars row; reconcile then re-credits paid stars (earned 16 → 8, balance 1 → 7) |
| P3-KIDVERSE-02 | critical | Kid Verse `audits/03-apps/kidverse.md:208` | A kid's second device with an older copy of the stars row erases a verse star earned on the first device |
| P3-KIDVERSE-03 | critical | Kid Verse `audits/03-apps/kidverse.md:252` | On a stalled or failed first load an adult sees "Week 1", and + writes week 2 over the family's real week (38 → 2) |
| P3-KIDVERSE-10 | critical | Kid Verse `audits/03-apps/kidverse.md:459` | "I heard it" on a kid's second device with an older copy erases the other device's heard day from the week's story row |
| P3-KIDVERSE-11 | critical | Kid Verse `audits/03-apps/kidverse.md:501` | "I heard it" tapped during a slow or failed first load replaces the week's story row, dropping earlier heard days |
| P3-VERSES-02 | critical | Verses `audits/03-apps/verses.md:170` | Two devices reviewing: one device's ratings and the day's review count are silently erased |
| P3-VERSES-03 | critical | Verses `audits/03-apps/verses.md:205` | A rating before Verses' own data arrives on a device replaces the whole review log (on a cold kid device, the whole schedule too) |
| P3-PRAYER-05 | high | Prayer `audits/03-apps/prayer.md:320` | On the family list one person's tick shows as everyone's, and a second adult's tap unticks it for the house |
| P3-PRAYER-06 | high | Prayer `audits/03-apps/prayer.md:346` | Security: stored XSS through a family prayer row's id runs in kids' and the admin's Prayer and can read session tokens (downgraded from critical: needs a hand-made API request) |
| P3-PRAYER-17 | high | Prayer `audits/03-apps/prayer.md:590` | Security: stored XSS through a family plan id in the Settings plan list, which never removes itself (downgraded from critical: needs a hand-made API request) |
| P3-DOLLYWOOD-LIVE-02 | high | Park map `audits/03-apps/dollywood-live.md:181` | Security (kids' privacy): the shipped UI lets a guest switch a child's location beacon on or off and overwrite the kids' heights |
| P3-F260-02 | medium | F260 `audits/03-apps/f260.md:191` | Undo after Done (or any untick) leaves "Read today ✓", adds a streak day and silences the 8 pm nudge |
| P3-F260-03 | medium | F260 `audits/03-apps/f260.md:220` | The day after two rest days, the streak reads 0 and "Start a new streak" until the person reads |
| P3-F260-14 | medium | F260 `audits/03-apps/f260.md:499` | Face ID unlock is one synced slot: other devices show a Face ID button that fails, and enabling it on a second device breaks the first |
| P3-F260-15 | medium | F260 `audits/03-apps/f260.md:523` | The Erase and Restore confirms say "this device", but both act on every device |
| P3-F260-16 | medium | F260 `audits/03-apps/f260.md:548` | Reset's confirm does not say it also deletes the Verses review schedule (`f260.recall`) |
| P3-F260-17 | medium | F260 `audits/03-apps/f260.md:573` | Tapping into an old HEAR entry or week note and away, without typing, re-dates it to today and adds a journal-streak day |
| P3-LEFTOVERS-02 | medium | Larder `audits/03-apps/leftovers.md:212` | Home, the Apps badge and the 8 am push word the fridge differently from the Larder ("use it up" for food the Larder calls "eat soon") |
| P3-LEFTOVERS-03 | medium | Larder `audits/03-apps/leftovers.md:259` | After the March DST change, every older item reads one day young in the Larder, on Home and in the badge (the push is right) |
| P3-LEFTOVERS-04 | medium | Larder `audits/03-apps/leftovers.md:300` | A dateLogged that is not YYYY-MM-DD shows "NaNd ago", stays Fresh forever and is never warned about (downgraded from high: needs the model or a hand-made write) |
| P3-PRAYER-07 | medium | Prayer `audits/03-apps/prayer.md:371` | On List, a tick or any remote change folds every open category shut |
| P3-PRAYER-08 | medium | Prayer `audits/03-apps/prayer.md:394` | "Send to family list" drops a weekly request's days, so the copy never shows on the family Today |
| P3-PRAYER-18 | medium | Prayer `audits/03-apps/prayer.md:622` | Security: "Send to family list" publishes the private request's For and category although its panel offers only the title; the push adds "(for …)" |
| P3-PRAYER-19 | medium | Prayer `audits/03-apps/prayer.md:651` | An open Kitchen view never refreshes: other people's adds and answers do not appear |
| P3-PRAYER-20 | medium | Prayer `audits/03-apps/prayer.md:676` | The Add form never says which list it adds to, so a private request can land on the family list |
| P3-TALLY-06 | medium | Tally `audits/03-apps/tally.md:355` | A guest who opens Tally first on a device receives the household's legacy `tally.count`; the next household adult gets 0. Platform cause (`apps/hub.js:400`), primary for every person-scope `hub.migrate` caller |
| P3-TALLY-07 | medium | Tally `audits/03-apps/tally.md:391` | On a slow or failed first load Tally shows 0 as the person's count, for up to about 30 s after a failure |
| P3-TIMER-01 | medium | Timer `audits/03-apps/timer.md:131` | While the page's first timer pull is slow or fails, the app shows an idle timer, and one Start tap replaces the person's running timer on every device |
| P3-DOLLYWOOD-03 | medium | Build guide `audits/03-apps/dollywood.md:229` | On phones the … menu opens out of the sheet: Export and Import cannot be reached, only an 8 px sliver of Reset can |
| P3-DOLLYWOOD-04 | medium | Build guide `audits/03-apps/dollywood.md:259` | On phones the pressed 3D button never returns to 2D, and nothing on screen names the way back |
| P3-DOLLYWOOD-05 | medium | Build guide `audits/03-apps/dollywood.md:287` | On phones with Upright on, every map jump frames the unrotated box: Fit cuts off half the park and a section chip can miss its section |
| P3-DOLLYWOOD-06 | medium | Build guide `audits/03-apps/dollywood.md:320` | The "up to N″" rider-height filter hides every listing with no height requirement (36″ shows 9 of 145); the park map ships the same template line |
| P3-DOLLYWOOD-07 | medium | Build guide `audits/03-apps/dollywood.md:347` | The step card's in-game line ignores the saved plot width after load and after every plot change |
| P3-DOLLYWOOD-16 | medium | Build guide `audits/03-apps/dollywood.md:544` | The keyboard shortcuts ignore Ctrl, Cmd and Alt: Ctrl/Cmd+D (bookmark) ticks or silently unticks the current step and posts a feed line; Ctrl/Cmd+P and page zoom are taken over |
| P3-DOLLYWOOD-LIVE-03 | medium | Park map `audits/03-apps/dollywood-live.md:206` | On a device's first open, the map says you are not sharing though Share my spot is on, and never locates you |
| P3-DOLLYWOOD-LIVE-04 | medium | Park map `audits/03-apps/dollywood-live.md:231` | After you locate yourself, the meeting-point bar has no walk time and no Go, and does not heal on its own |
| P3-DOLLYWOOD-LIVE-05 | medium | Park map `audits/03-apps/dollywood-live.md:256` | An adult cannot switch on a kid's beacon or set heights until someone else is already sharing |
| P3-DOLLYWOOD-LIVE-06 | medium | Park map `audits/03-apps/dollywood-live.md:280` | With Share my spot left on, opening the map away from the park publishes a home position, and Home says "At the park" |
| P3-DOLLYWOOD-LIVE-07 | medium | Park map `audits/03-apps/dollywood-live.md:304` | An old fix outside the map frame reads as a live position, with no "Last seen" and no Find me chip |
| P3-DOLLYWOOD-LIVE-08 | medium | Park map `audits/03-apps/dollywood-live.md:328` | Tapping a restroom, first-aid, AED or other amenity marker does nothing |
| P3-DOLLYWOOD-LIVE-09 | medium | Park map `audits/03-apps/dollywood-live.md:352` | Every tap of the compass jumps the view to the Entrance, and the first tap does not rotate anything (same code as P3-DOLLYWOOD-11) |
| P3-DOLLYWOOD-LIVE-10 | medium | Park map `audits/03-apps/dollywood-live.md:377` | On iPhone the pill cuts off the location-denied instructions before "or use Set my spot" |
| P3-DOLLYWOOD-LIVE-12 | medium | Park map `audits/03-apps/dollywood-live.md:429` | Switching a kid's beacon off while the kid's map is open does not hide the kid: the kid's phone republishes its spot and the last position stays |
| P3-DOLLYWOOD-LIVE-13 | medium | Park map `audits/03-apps/dollywood-live.md:455` | Switching a kid's beacon on does nothing on the kid's open map until it is reopened, while the parent's switch says it is sharing |
| P3-KIDVERSE-04 | medium | Kid Verse `audits/03-apps/kidverse.md:289` | The seven day dots and their "N of 7 days" label show verse days only, while ★N also counts story and prayed stars |
| P3-KIDVERSE-05 | medium | Kid Verse `audits/03-apps/kidverse.md:325` | After the week stepper the verse moves, but the story card stays on the old week while its speaker reads the new week's story |
| P3-KIDVERSE-12 | medium | Kid Verse `audits/03-apps/kidverse.md:538` | A Reset week that Kid Verse applies after the ISO week rolls over leaves that week's verse stars on the balance |
| P3-KIDVERSE-13 | medium | Kid Verse `audits/03-apps/kidverse.md:576` | A story or prayed day not yet credited when a parent resets the week is credited after the reset (★4 → ★3 → ★5) |
| P3-VERSES-04 | medium | Verses `audits/03-apps/verses.md:247` | Left open past midnight, Verses keeps saying "All done for today" / "Come back tomorrow!" while verses are due |
| P3-VERSES-05 | medium | Verses `audits/03-apps/verses.md:273` | The "Not yet" toast always says "again tomorrow", even when the verse returns in 2, 4 or 7 days |
| P3-VERSES-06 | medium | Verses `audits/03-apps/verses.md:298` | Read aloud disappears after Show, so the verse text can never be heard |
| P3-VERSES-11 | medium | Verses `audits/03-apps/verses.md:398` | A day with nothing due resets the day streak, while the screen says "come back tomorrow" and "keep it going today" |
| P3-F260-04 | low | F260 `audits/03-apps/f260.md:248` | After 260/260, unticking a reading keeps the plan "finished", which mutes the 8 pm and Sunday nudges |
| P3-F260-05 | low | F260 `audits/03-apps/f260.md:275` | Opening F260 once enrols a guest or Mea in the 8 pm and Sunday reading nudges |
| P3-F260-06 | low | F260 `audits/03-apps/f260.md:299` | A device in another time zone files the reading under its own date |
| P3-F260-07 | low | F260 `audits/03-apps/f260.md:323` | Done on next week's first reading starts that week, and Undo does not give the week back |
| P3-F260-08 | low | F260 `audits/03-apps/f260.md:346` | The heatmap's "today" cell takes the Today card's styles and breaks the grid |
| P3-F260-09 | low | F260 `audits/03-apps/f260.md:369` | Reading mode hides the "This week" reflections card it means to keep |
| P3-F260-10 | low | F260 `audits/03-apps/f260.md:392` | "100% complete" with one reading left, and "0%" after the first |
| P3-F260-11 | low | F260 `audits/03-apps/f260.md:415` | Pace reads "2 week behind" / "2 week ahead" |
| P3-F260-12 | low | F260 `audits/03-apps/f260.md:438` | The unlock dialog says "encrypted on this iPad" on every device |
| P3-F260-18 | low | F260 `audits/03-apps/f260.md:598` | A week read ahead on the plan list and started later reads "done in -1 days" and "started" after it was finished |
| P3-F260-19 | low | F260 `audits/03-apps/f260.md:623` | The − / + week stepper and the Week select stamp a start date on every week they land on, and stepping back never removes it |
| P3-F260-20 | low | F260 `audits/03-apps/f260.md:648` | Journal search breaks HTML entities: an entry with "&" shows "&amp;" for many ordinary queries |
| P3-LEFTOVERS-05 | low | Larder `audits/03-apps/leftovers.md:339` | A slow first open shows "0 in the fridge" and "Nothing logged yet." as "the last copy saved here" |
| P3-LEFTOVERS-06 | low | Larder `audits/03-apps/leftovers.md:381` | Tapping Log or pressing Enter before the app is ready reloads the page and loses the typed name |
| P3-LEFTOVERS-07 | low | Larder `audits/03-apps/leftovers.md:423` | A device in another time zone writes and reads its own local date ("-1d ago" on the New York iPad) |
| P3-LEFTOVERS-08 | low | Larder `audits/03-apps/leftovers.md:457` | The first item logged in the minute after midnight gets yesterday's date |
| P3-LEFTOVERS-09 | low | Larder `audits/03-apps/leftovers.md:492` | A future dateLogged is never clamped: it reads "-3d ago", files as Fresh and delays every warning |
| P3-LEFTOVERS-10 | low | Larder `audits/03-apps/leftovers.md:536` | "Copy failed — select manually" leaves nothing to select |
| P3-LEFTOVERS-11 | low | Larder `audits/03-apps/leftovers.md:564` | Long item names are cut to one line and cannot be read in the Larder |
| P3-LEFTOVERS-14 | low | Larder `audits/03-apps/leftovers.md:669` | After one Log in the minute after midnight, the next Log is refused with "must be yesterday or earlier" while the box shows today |
| P3-LEFTOVERS-15 | low | Larder `audits/03-apps/leftovers.md:703` | The add bar's 12 px error line is below AA in Hearth (4.22-4.41:1) |
| P3-PRAYER-09 | low | Prayer `audits/03-apps/prayer.md:417` | Undo after Mark answered does nothing if a remote change to either prayer scope lands within its 6 s |
| P3-PRAYER-10 | low | Prayer `audits/03-apps/prayer.md:441` | Taps before the data loads throw: the Mine/Family choice and screen changes are lost, and Record shows a stray + |
| P3-PRAYER-11 | low | Prayer `audits/03-apps/prayer.md:466` | A phone outside New York time files prayed marks under its own local date, so the TV leaves the person off |
| P3-PRAYER-12 | low | Prayer `audits/03-apps/prayer.md:490` | The "Needs attention" badge counts a request twice (8 for 6) |
| P3-PRAYER-13 | low | Prayer `audits/03-apps/prayer.md:510` | The gold streak cheer shows under "Nothing on the list today." |
| P3-PRAYER-14 | low | Prayer `audits/03-apps/prayer.md:530` | A category row's count (active only) disagrees with its Remove confirm (active and answered) |
| P3-PRAYER-15 | low | Prayer `audits/03-apps/prayer.md:550` | The family delete confirm says deletions do not sync, but they do |
| P3-PRAYER-16 | low | Prayer `audits/03-apps/prayer.md:570` | The headline says "to pray through this morning" at any hour |
| P3-PRAYER-21 | low | Prayer `audits/03-apps/prayer.md:701` | An undone tick still counts the day in the streak, month count and calendar |
| P3-PRAYER-22 | low | Prayer `audits/03-apps/prayer.md:726` | Every Sunday Today says "Some of the list has gone quiet" even when nothing has |
| P3-PRAYER-23 | low | Prayer `audits/03-apps/prayer.md:750` | Removing the category a "One category only" plan uses leaves the plan pointing at a deleted category |
| P3-PRAYER-24 | low | Prayer `audits/03-apps/prayer.md:774` | Family prayed marks are kept by display name: a guest who shares a household name is shown as that person |
| P3-PRAYER-25 | low | Prayer `audits/03-apps/prayer.md:799` | Editing a family request's wording makes the prayer push announce it as "New on the family list" |
| P3-PRAYER-26 | low | Prayer `audits/03-apps/prayer.md:824` | Escape closes only Pray mode; the sheet, More, Kitchen view and ask panels ignore it, and Enter submits nothing |
| P3-TALLY-04 | low | Tally `audits/03-apps/tally.md:285` | − at 0 is not disabled and gives no feedback, yet every tap writes and re-stamps the row |
| P3-TALLY-08 | low | Tally `audits/03-apps/tally.md:423` | Tally shows and counts from any value chat writes: −13 shows as -13 and + writes 0; 12.5 counts to 13.5; 1e21 stays 1e+21 |
| P3-TALLY-09 | low | Tally `audits/03-apps/tally.md:455` | Opened on the TV, Tally offers live-looking +, − and Reset, against CLAUDE.md's "check `hub.canWrite` before offering edits" |
| P3-TIMER-02 | low | Timer `audits/03-apps/timer.md:193` | At 0:00 the round dial stretches into a tall pill and the controls below jump 24 px |
| P3-TIMER-03 | low | Timer `audits/03-apps/timer.md:222` | Perf: every finish leaves a new `AudioContext` running; in the shell they pile up for the life of the page |
| P3-TIMER-04 | low | Timer `audits/03-apps/timer.md:250` | The "Timer done" notification is suppressed whenever the Timer app is open, even while the page is hidden, and the app has no notification of its own |
| P3-TIMER-05 | low | Timer `audits/03-apps/timer.md:283` | Every countdown reaches 0:00 and beeps 0.2-0.5 s early, and each digit changes about 0.5 s early, because `step()` rounds |
| P3-DOLLYWOOD-08 | low | Build guide `audits/03-apps/dollywood.md:381` | Perf: idle in 2D, the step highlight's infinite pulse keeps the main thread 15.8-27.7% busy (Chromium) |
| P3-DOLLYWOOD-09 | low | Build guide `audits/03-apps/dollywood.md:401` | Perf: after 3D is opened once, the render loop keeps requesting 60 frames a second in 2D until the guide is closed |
| P3-DOLLYWOOD-10 | low | Build guide `audits/03-apps/dollywood.md:421` | A dead "N" compass button sits over the iPad and desktop map, and over 3D |
| P3-DOLLYWOOD-11 | low | Build guide `audits/03-apps/dollywood.md:441` | Turning Upright on or off with "Whole park" pressed zooms to the last-selected section (same code as P3-DOLLYWOOD-LIVE-09) |
| P3-DOLLYWOOD-12 | low | Build guide `audits/03-apps/dollywood.md:462` | On phones the "?" popover opens off the left edge (48 of 267 px visible) |
| P3-DOLLYWOOD-13 | low | Build guide `audits/03-apps/dollywood.md:482` | On iPad portrait the View menu runs 26 px past the right edge (and adds a 26 px horizontal scroll) |
| P3-DOLLYWOOD-14 | low | Build guide `audits/03-apps/dollywood.md:502` | After 3D, touch devices get the mouse hint "Move over the map… scroll to zoom" |
| P3-DOLLYWOOD-15 | low | Build guide `audits/03-apps/dollywood.md:522` | The Scale tab refers to an "Info tab" that does not exist |
| P3-DOLLYWOOD-17 | low | Build guide `audits/03-apps/dollywood.md:583` | The arrow keys never scroll the page: they pan a map that is scrolled away, even while the person reads the step card |
| P3-DOLLYWOOD-18 | low | Build guide `audits/03-apps/dollywood.md:615` | Clearing the plot width does not reach another open device, and a legacy `dw-plot` key brings an old width back on every boot |
| P3-DOLLYWOOD-LIVE-11 | low | Park map `audits/03-apps/dollywood-live.md:405` | A waits-feed ride whose name differs from the listing (the Dollywood Express) silently shows no wait |
| P3-DOLLYWOOD-LIVE-15 | low | Park map `audits/03-apps/dollywood-live.md:507` | After the waits feed fails, a map left open keeps showing old waits as current on the chips, hero and directions bar, past the app's own 6 h limit |
| P3-DOLLYWOOD-LIVE-16 | low | Park map `audits/03-apps/dollywood-live.md:532` | A kid with his beacon on gets a Share my spot switch that snaps back on and republishes his spot |
| P3-DOLLYWOOD-LIVE-17 | low | Park map `audits/03-apps/dollywood-live.md:557` | On a location denial the error handler bypasses the designed "denied" state, so no Set my spot chip appears until the app is backgrounded |
| P3-DOLLYWOOD-LIVE-18 | low | Park map `audits/03-apps/dollywood-live.md:582` | While the map stays open, the meeting point never expires and its "set by … N min ago" age never updates |
| P3-KIDVERSE-06 | low | Kid Verse `audits/03-apps/kidverse.md:361` | The kid's stars card labels the cash-in balance "all time" |
| P3-KIDVERSE-07 | low | Kid Verse `audits/03-apps/kidverse.md:388` | Prayed stars are matched by display name, so a guest with a kid's name earns that kid a star (root cause in Prayer's writer, P3-PRAYER-24) |
| P3-KIDVERSE-08 | low | Kid Verse `audits/03-apps/kidverse.md:413` | "Today" is each device's local date, so a device in a western time zone can add a second verse star in one household day |
| P3-KIDVERSE-09 | low | Kid Verse `audits/03-apps/kidverse.md:437` | Perf: the stars row keeps every credited day forever, and every change uploads the whole row twice |
| P3-KIDVERSE-14 | low | Kid Verse `audits/03-apps/kidverse.md:615` | Done ★ and "I heard it" set `--accent` to gold but paint in the kid's own colour (teal for Ezra) |
| P3-VERSES-07 | low | Verses `audits/03-apps/verses.md:319` | On a slow first load Verses shows "all done / Nothing to train yet" and saves a zero summary |
| P3-VERSES-08 | low | Verses `audits/03-apps/verses.md:341` | "Practise one anyway" makes the chosen verse "1 due today" and lists it under Due today as "tomorrow" |
| P3-VERSES-09 | low | Verses `audits/03-apps/verses.md:359` | A device in another time zone files reviews under its own date, so other devices count the wrong day |
| P3-VERSES-10 | low | Verses `audits/03-apps/verses.md:380` | With keyboard focus on Read aloud, Enter or Space reveals the answer instead of reading |
| P3-VERSES-12 | low | Verses `audits/03-apps/verses.md:429` | On the iPhone a double tap on "Got it" reveals the next verse before it is recited |
| P3-VERSES-13 | low | Verses `audits/03-apps/verses.md:467` | The verse text veiled until Show is exposed to screen readers before Show |
| P3-VERSES-14 | low | Verses `audits/03-apps/verses.md:497` | The empty state says a newly memorised verse appears "on its review day", but it is due at once |

**Pointer IDs** (kept with their evidence, counted under the primary):
- **P3-VERSES-01** → P3-F260-01 (critical), `audits/03-apps/verses.md:138`. Same `f260.recall` overwrite seen from the Verses side; the code is `apps/f260.html:1915`.
- **P3-TALLY-03** → P2-SYNC-03 (critical), `audits/03-apps/tally.md:244`. Pre-hub `tally.count` replaced 37 with 5 with no tap; cause `hub.migrate`'s local-only check (`apps/hub.js:406-407`).
- **P3-DOLLYWOOD-01** → P2-SYNC-03 (critical), `audits/03-apps/dollywood.md:145`. Legacy build-guide progress over real progress (24 → 1) when the first pull is slow, fails or runs offline.
- **P3-DOLLYWOOD-LIVE-14** → P3-DOLLYWOOD-06 (medium), `audits/03-apps/dollywood-live.md:480`. The same template line (`../dollywood-build-project/scripts/template.html:1004`) ships in both exports.

**Counts per app** (primaries; pointers, refuted and unresolved listed separately):

| App | Critical | High | Medium | Low | Primaries | Pointers | Refuted | Unresolved | UX, VIS, GAP items | Rubric average |
|---|---|---|---|---|---|---|---|---|---|---|
| F260 | 2 | 0 | 6 | 12 | 20 | 0 | 0 | 0 | 31 | 4.6 |
| Larder Ledger | 3 | 0 | 3 | 9 | 15 | 0 | 0 | 0 | 21 | 4.3 |
| Prayer | 4 | 3 | 5 | 14 | 26 | 0 | 0 | 0 | 27 | 4.7 |
| Tally counter | 3 | 0 | 2 | 3 | 8 | 1 | 0 | 0 | 17 | 4.9 |
| Kitchen timer | 0 | 0 | 1 | 4 | 5 | 0 | 1 | 1 | 20 | 4.9 |
| Dollywood build guide | 1 | 0 | 6 | 10 | 17 | 1 | 1 | 0 | 33 | 3.9 |
| Dollywood park map | 1 | 1 | 10 | 5 | 17 | 1 | 0 | 0 | 24 | 5.6 |
| Kid Verse | 5 | 0 | 4 | 5 | 14 | 0 | 0 | 0 | 21 | 5.2 |
| Verses | 2 | 0 | 4 | 7 | 13 | 1 | 1 | 0 | 19 | 5.1 |
| **Total** | **21** | **4** | **41** | **69** | **135** | **4** | **3** | **1** | **213** | **4.8** |

Two primaries have platform causes and no Phase 2 owner, so they stay primary in Tally and the other reports carry pointers: **P3-TALLY-05** (the shell's channel list, `index.html:458-459`) and **P3-TALLY-06** (`hub.migrate` lets guests through, `apps/hub.js:400`). Their fixes belong in the shell and hub.js, not in Tally.

## Phase 2 defects seen in the apps

Each app report lists these under "Phase 2 defects that show up here" as pointers, not new findings; new facets were filed with a `p2Ref`. "By code" means the report argued it from the code and did not re-run it.

| P2 ID | P2 severity | Shows up in | How |
|---|---|---|---|
| P2-STAB-01 | critical | all nine apps | Reduce Motion blanks the shell, so no app can be reached from Home (Tally still renders standalone) |
| P2-SYNC-01 | critical | F260, Prayer, Tally, build guide, park map, Kid Verse, Verses | Whole-row last-write-wins; new facets P3-TALLY-01, P3-KIDVERSE-02, -10, P3-VERSES-02; the park map's keyboard D path writes `progress` (by code) |
| P2-SYNC-03 | critical | F260, Tally, build guide, Prayer, Larder | `hub.migrate` checks only the local cache; proven in Tally (37 → 5, pointer P3-TALLY-03) and the build guide (24 → 1, pointer P3-DOLLYWOOD-01); Prayer and Larder by code |
| P2-SYNC-17 | critical | F260, Larder, Prayer, Tally, Timer, Kid Verse, Verses | Same `hub.ready` 6 s / failed-pull window; new app triggers P3-TALLY-02, P3-KIDVERSE-01, -03, -11, P3-PRAYER-02, P3-VERSES-03, P3-TIMER-01 |
| P2-SYNC-05 | critical | F260, Prayer, Verses | `hub.ready` resolves before the app's own pull (root of P3-VERSES-07; related to P3-PRAYER-10) |
| P2-SYNC-18 | critical | F260, Tally, build guide, Kid Verse, Verses | `refreshScope` swaps the store without onChange (all by code; Tally has no stale write-back) |
| P2-SYNC-02 | critical | Prayer, park map | A first open resets the family prayer plan; the same global `seen` in `hub.ready` causes P3-DOLLYWOOD-LIVE-03's missed GPS resume |
| P2-SYNC-06 | critical | Larder, Prayer | Over 200 queued rows dropped; Prayer's under-200 import facet is P3-PRAYER-03 |
| P2-SYNC-07 | critical | Larder | A fridge item queued before a TV sign-in on the iPad is discarded |
| P2-SYNC-09 | critical | Prayer, Timer | A Switch race put Eli's private prayers into a guest's Prayer, and Eli's timer into Ezra's Home |
| P2-SYNC-19, P2-SYNC-20 | critical | F260 | Journal vault save failures; P3-F260-13 is a new cross-device trigger of -20, P3-F260-17 re-uploads the vault on every no-op focusout |
| P2-PROF-02 | critical | F260, Tally, build guide, Kid Verse, Verses | Offline person-scope writes stuck after Switch (the Switch trigger of P3-TALLY-05's cause) |
| P2-PROF-04 | critical | Verses | After a Reset PIN the claimer read David's Verses rows |
| P2-PROF-14 | critical | F260, Prayer, Tally, Kid Verse, Verses | Future-stamped writes outrank later edits; the Kid Verse week stepper was a shipped-UI chain |
| P2-PROF-19 | critical | Larder, Tally, build guide, Verses | "Forget this device" deletes queued writes (and re-arms the build guide's migration) |
| P2-STAB-03 | critical | Prayer | `TODAY` frozen at load; same toggle as P3-PRAYER-05 |
| P2-CHAT-03, P2-CHAT-09 | critical | Larder (both), Tally (-09) | Chat can finish the wrong food; a lost chat write still shows a success tick |
| P2-PWA-01 | critical | Prayer | "Prayed for" / "Answered:" feed lines leak private titles to Home and the TV |
| P2-HOME-02 | high | F260 | `f260.summary` carries no date; P3-F260-02 makes it wrong the same day |
| P2-PWA-02 | high | park map | The park-day stale-kid push barely fires |
| P2-PROF-05 | medium | Larder, Prayer, park map, Kid Verse | Kid limits only in the UI; the Larder's kid ✓ is now filed as P3-LEFTOVERS-13 (critical) because it is a shipped screen |
| P2-STAB-07 | medium | F260, Kid Verse, Verses | Open apps keep yesterday after midnight (reproduced in Verses as P3-VERSES-04) |
| P2-PROF-08, P2-STAB-13 | medium | Timer | Switch silences a running timer; a waking device clears a newer timer (also through the Timer app's own `finish()`) |
| P2-PROF-09 | medium | Prayer | The shared iPad never returns to the picker, leaving a private list or Kitchen view on the counter |
| P2-CHAT-01 | medium | Tally, Kid Verse | `set_data` rewrites any count or stars row; P3-TALLY-08 is the app-side facet |
| P2-CHAT-02 | medium | park map | A kid can rewrite the map's family rows through chat |
| P2-CHAT-04 | medium | F260 | `toggle_f260_reading` flips rather than sets |
| P2-PWA-03, P2-PWA-04 | medium | F260 (-03), Prayer (-04) | Push follows the device's subscriber; late family prayers never announced (P3-PRAYER-25 is the false-announcement side) |
| P2-PWA-06 (and pointer P2-SYNC-08) | medium | F260, Larder, Kid Verse | Offline feed lines post late under whoever acts next |
| P2-PWA-08 | medium | build guide | An always-open hub never runs a new deploy of the export |
| P2-PWA-18 | medium | park map | Rally cannot be reached; the Meet-here dialog still promises it |
| P2-VIS-03 | medium | F260, Tally, build guide, park map | Hearth on a dark OS paints Midnight with `data-scheme` light |
| Sync UX note (unnumbered, `audits/02-shell.md:2910`) | medium | F260, Tally, Kid Verse, Verses | No in-app sync or offline state; once an app closes the shell reads synced |
| P2-SYNC-15 (and pointer P2-HOME-04) | low | Larder, Tally, Timer, build guide, park map, Kid Verse, Verses | `hub.sync.state` starts offline; false empty wording on a cold load (Larder facet P3-LEFTOVERS-05, Verses P3-VERSES-07) |
| P2-SEC-02 | low | F260, Prayer, build guide, Kid Verse, Verses | `visibleTo` enforced only in the client (a kid can open F260 or the build guide by URL) |
| P2-PROF-15 | low | F260, Prayer, Verses | The previous person's cache stays after Switch |
| P2-PWA-13 | low | Larder (possibly), Prayer, Kid Verse | Overlapping `hub.activity` calls double feed lines |
| P2-HOME-06, P2-HOME-07 | low | Kid Verse (both), Verses (-06) | Name doubled in feed lines; the TV kid line never renders |
| P2-VIS-05, P2-VIS-07 (pointer to P2-SYNC-13) | low | Kid Verse | Kids card overflow; Me → Kids' rewards shows ★0 on a cold load |
| P2-STAB-08, P2-STAB-09 | low | Timer | A fast-clocked device's clear; no wake lock when the page starts in the Timer |
| P2-CHAT-07 | low | F260 | `get_data` sends the journal vault upstream |
| P2-PWA-10, P2-PWA-11 | low | Larder | The 8 am fridge push aborts on a keyless subscription, and a failed push counts as sent |
| P2-PWA-16 | low | build guide | An uncached offline open shows a bare 503 |

Phase 2 UX/GAP items (not in its register) that also show up: GAP-HOME-1, VIS-HOME-2 and PWA-GAP-1 in the Timer; GAP-HOME-2 in Verses (`verses.summary` has no reader); UX-HOME-7 in Kid Verse; UX-HOME-1 and PWA-UX-3 in the Larder.

**Phase 2 statements that Phase 3 contradicts.** Phase 2's report stays as written; these corrections apply from here on.
1. **"OK: no stored XSS"** (`audits/02-shell.md:2002`). Phase 2 tested the picker, Home, Me and the TV. The park map renders names unescaped (P3-DOLLYWOOD-LIVE-01, planted through the shipped Add-a-guest form), and Prayer puts row ids and plan ids into markup raw (P3-PRAYER-06, -17). The no-CSP gap (`audits/02-shell.md:2009`) and the unsandboxed iframe (`index.html:413`) are the shared amplifier.
2. **P2-PROF-05's "no shipped screen"** (`audits/02-shell.md:1269`). The Larder's ✓ is a shipped screen that lets a kid tombstone family items (P3-LEFTOVERS-13, critical). The park map's Family pane lets a guest flip a child's beacon (P3-DOLLYWOOD-LIVE-02, high). P2-PROF-05 keeps the API-only writes.
3. **P2-SYNC-15's "Larder cold open is safe"** (`audits/02-shell.md:2713`). When the first pull is slow, `hub.ready` gives up at 6 s and the Larder paints "0 in the fridge" as "the last copy saved here" (P3-LEFTOVERS-05).

## Cross-app themes

1. **Writes before the app's own first pull lands.** `hub.ready` waits for a pull only when no channel on the page has been pulled before, and then only up to 6 s (`apps/hub.js:334-337`); a failed pull or a cached sibling channel (the shell's warm `f260` cache, for Verses) ends the wait at once. Each app then paints a placeholder ("Week 1", 0, "all done", an idle 5:00) and enables its write controls, so "no data yet" is treated as "no data".
   - Apps: Tally, Kid Verse, Prayer, Verses, Timer, Larder, park map, F260.
   - IDs: P3-TALLY-02, -07; P3-KIDVERSE-01, -03, -11; P3-PRAYER-02, -10; P3-VERSES-03, -07; P3-TIMER-01; P3-LEFTOVERS-05, -06; P3-DOLLYWOOD-LIVE-03; Phase 2's P2-SYNC-17, -05, -02, -15.
   - Fix: one platform change (`hub.ready` waits for the calling app's own channels, or exposes a per-channel "pulled" flag) plus an app-side "disabled until pulled" state. Kid Verse already has a `pulled()` check to reuse (`audits/03-apps/kidverse.md:888`).
2. **`hub.migrate` compares against the local cache, not the server, and lets guests through.** The `!hub.has` checks (`apps/hub.js:406-407`) and the adult-only guard that admits guests (`apps/hub.js:400`).
   - Apps: Tally, build guide, F260, Prayer, Larder.
   - IDs: P2-SYNC-03 (primary, with pointers P3-TALLY-03 and P3-DOLLYWOOD-01), P3-TALLY-06 (primary for the guest trigger).
   - For channels the shell never pulls (`tally|person`, `dollywood|person`, `prayer|family`), P2-SYNC-03's safe case (the shell pulled first) never applies. By code, the guest trigger reaches F260 (`apps/f260.html:905`), the build guide (`apps/dollywood.html:1107`) and Prayer (`apps/prayer.html:649-650`). The Prayer facet would put a household adult's private legacy list into a guest's scope, a possible rule (b); it was not run (see Not verified).
3. **Whole-row last-write-wins on rows several devices write** (absolute counts, maps and arrays in one row).
   - Apps: Tally, Kid Verse, Verses, Prayer, F260, build guide.
   - IDs: P3-TALLY-01, P3-KIDVERSE-02, -10, P3-VERSES-02, P3-PRAYER-05, P3-F260-13, P2-SYNC-01; related shapes P3-PRAYER-01 (sequential ids) and P3-F260-01 (replace instead of merge).
   - Fix: per-item rows, as CLAUDE.md already prescribes for lists, or deltas and merges instead of whole-value writes.
4. **Queued writes stranded when their app closes.** The shell declares `reminders`, `f260`, `leftovers`, `prayer|person`, `hub`, `timer`, `dollywood-live|family` and `kidverse` (`index.html:458-459`), and flushes only those. Writes still queued in `tally|person`, `verses|person`, `dollywood|person`, `prayer|family` and `dollywood-live|person` wait until that app reopens on that device, while the sync dot reads "synced".
   - IDs: P3-TALLY-05 (primary, proven 37 + 4 + 2 → 39), with by-code pointers in Verses, the build guide, Prayer and the park map; P2-PROF-02 is the Switch trigger.
5. **Stored XSS through unescaped names or ids**, with no CSP and an unsandboxed app iframe (`index.html:413`).
   - IDs: P3-DOLLYWOOD-LIVE-01 (critical), P3-PRAYER-06, -17 (high). The Worker accepts unvalidated ids and values (P2-PROF-05).
6. **Kid, guest and kiosk limits enforced only by what the UI happens to hide.** There is no shared role helper (for example `hub.isHouseholdAdult`, or `hub.canWrite` per key) that apps can call.
   - IDs: P3-LEFTOVERS-13, P3-DOLLYWOOD-LIVE-02, -05, -16, P3-TALLY-09, P3-PRAYER-20, P2-PROF-05, P2-SEC-02.
7. **One template, two exports.** Dollywood defects are one fix each in `../dollywood-build-project/scripts/template.html`, then a rebuild, `verify.py` and an export.
   - The rider-height filter is merged (P3-DOLLYWOOD-06, pointer P3-DOLLYWOOD-LIVE-14). The Upright handler stays two IDs with different symptoms and severities, cross-referenced (P3-DOLLYWOOD-11 low, P3-DOLLYWOOD-LIVE-09 medium; handler at `apps/dollywood.html:1029` = `apps/dollywood-live.html:1029`). The modifier-key handler (P3-DOLLYWOOD-16) also ships in the park map (`apps/dollywood-live.html:852`).
8. **"Today" is the device's local date, and open apps never roll over.** Each app computes dates its own way; none uses a household (America/New_York) date helper or a day-change event from hub.js.
   - Apps: F260, Larder, Prayer, Kid Verse, Verses, park map.
   - IDs: P3-F260-06; P3-LEFTOVERS-03, -07, -08, -14; P3-PRAYER-11, -19; P3-KIDVERSE-08, -12; P3-VERSES-04, -09; P3-DOLLYWOOD-LIVE-15, -18; P2-STAB-07, P2-STAB-03.
   - Fix: a `hub.today()` plus a "day changed" notification would close most of these.
9. **Full re-render on every change, under the user's finger, with no double-tap guard.** `hub.onChange(render)` rebuilds the list, so a tap lands on another row or a collapsed group.
   - IDs: P3-LEFTOVERS-01, -12, P3-PRAYER-07, P3-VERSES-12.
   - Fix: keyed updates, or ignoring taps for about 400 ms after a re-render, plus an Undo toast.
10. **Destructive actions with no undo, confirm or honest wording.**
    - IDs: P3-PRAYER-04, -03, P3-DOLLYWOOD-02, P3-F260-15, -16, P3-LEFTOVERS-01, -13; also as UX items UX-TALLY-1, UX-F260-2, UX-VERSES-2 and the Timer's silent cancel on a preset tap (UX-TIMER-1).
    - Fix: a shared hub.js undo toast that keeps the previous value for about 6 s would serve every app.
11. **Undo or untick leaves derived state behind** (streaks, logs, summaries). Derived rows (`f260.log`, `prayerDays`, `f260.summary`) are appended on tick and never revisited on untick.
    - IDs: P3-F260-02, -07, P3-PRAYER-21, -09.
12. **Identity by display name instead of profile id.** Prayer stores names in `prayedBy` (`apps/prayer.html:1599-1602`); Kid Verse's star credit and the TV read them, and the Worker does not reject a guest who shares a household name.
    - IDs: P3-PRAYER-24 (root cause), P3-KIDVERSE-07 (star credit). One writer-side fix.
13. **Copy from the single-device era** ("this device", "this iPad", "deletions do not sync").
    - IDs: P3-F260-12, -15, P3-PRAYER-15, P3-LEFTOVERS-05. A copy pass across apps belongs in Phase 5.

## Top improvements across apps

Ranked by delight ÷ effort (S = 1, M = 2, L = 3). Many items tie at 4.0. Ties were broken by (1) whether the item closes a confirmed critical or high, then (2) how many apps it serves. None adds a kid routine or reward system or a shared grocery list. Prayer and F260 keep their layouts and ids, and Dollywood changes go through the template.

**Polish**

| # | Improvement | App (report) | Delight | Effort | Ratio | Closes |
|---|---|---|---|---|---|---|
| 1 | Escape every name and emoji in the Family pane, family card, own row and kids' heights (`hub.escape` or `textContent`) | Park map, `audits/03-apps/dollywood-live.md:840` | 5 | S | 5.0 | P3-DOLLYWOOD-LIVE-01 (critical) |
| 2 | Undo toast on ✓; ignore ✓ taps for about 400 ms after any re-render; animate the card out | [Larder](03-apps/leftovers.md), `audits/03-apps/leftovers.md:1026` | 5 | S | 5.0 | P3-LEFTOVERS-01, -12; softens -13 |
| 3 | Per-person done on the family prayer list: a tick reads and writes `prayedBy[TODAY]` for "me" | [Prayer](03-apps/prayer.md), `audits/03-apps/prayer.md:1058` | 5 | S | 5.0 | P3-PRAYER-05 (high) |
| 4 | Undo toast after Reset (and after −), keeping the previous value in the row | [Tally](03-apps/tally.md), `audits/03-apps/tally.md:738` | 5 | S | 5.0 | UX-TALLY-1 |
| 5 | Hold writes until the app's own first pull lands: a per-channel "pulled" signal in hub.js, and disabled controls with a skeleton in each app | Tally `audits/03-apps/tally.md:739`, Kid Verse `audits/03-apps/kidverse.md:888`, Verses `audits/03-apps/verses.md:684`, Timer `audits/03-apps/timer.md:549`, build guide `audits/03-apps/dollywood.md:941`, Larder `audits/03-apps/leftovers.md:1031`, F260 `audits/03-apps/f260.md:888` | 4 | S | 4.0 | P3-TALLY-02, -07, P3-KIDVERSE-01, -03, -11, P3-VERSES-03, -07, P3-TIMER-01, P3-LEFTOVERS-05, -06; with P2-SYNC-17 also P3-PRAYER-02 |
| 6 | Merge, don't replace, the `f260.recall` entry on a practice rating (`{...recall[id], s, t}`) | [F260](03-apps/f260.md) `audits/03-apps/f260.md:883`; [Verses](03-apps/verses.md) `audits/03-apps/verses.md:681` | 4 | S | 4.0 | P3-F260-01 (critical) and pointer P3-VERSES-01 |
| 7 | Collision-free ids (`hub.uid()` or `crypto.randomUUID()`) in `nextId()` and Send to family list | Prayer, `audits/03-apps/prayer.md:1059` | 4 | S | 4.0 | P3-PRAYER-01 (critical) |
| 8 | Validate and confirm Import ("Replace 24 ticks with 2?", or merge), with an undo toast for Reset and Import | [Build guide](03-apps/dollywood.md), `audits/03-apps/dollywood.md:940` | 4 | S | 4.0 | P3-DOLLYWOOD-02 (critical) |
| 9 | The shell flushes every queued channel of the signed-in person (on `online` and when the viewer closes), and the frame flushes on `pagehide` | Tally (a shell fix), `audits/03-apps/tally.md:742` | 4 | S | 4.0 | P3-TALLY-05 (critical) in five channels |
| 10 | Kids' beacons and heights for household adults only (`kind === 'adult' && !is_guest`), always rendered | [Park map](03-apps/dollywood-live.md), `audits/03-apps/dollywood-live.md:841` | 4 | S | 4.0 | P3-DOLLYWOOD-LIVE-02 (high), -05 |

**Missing features**

| # | Improvement | App (report) | Delight | Effort | Ratio | Closes |
|---|---|---|---|---|---|---|
| 11 | Unlock the chime inside the Start tap (one reused `AudioContext`) and ring until Stop or +1 min | [Timer](03-apps/timer.md), `audits/03-apps/timer.md:563` | 5 | S | 5.0 | U-1, GAP-TIMER-2 |
| 12 | Wire the Rally control that the Meet-here dialog already promises (`POST /api/dollywood/rally` exists) | Park map, `audits/03-apps/dollywood-live.md:862` | 4 | S | 4.0 | P2-PWA-18 |
| 13 | A Verses card on Home that reads the existing `verses.summary` ("3 verses due · 13-day streak") with a one-tap start | Verses, `audits/03-apps/verses.md:699` | 4 | S | 4.0 | UX-VERSES-3, GAP-HOME-2 |

**New ideas** (the best two in their class; no new idea scores above 3.0, so they rank below the items above)

| # | Improvement | App (report) | Delight | Effort | Ratio |
|---|---|---|---|---|---|
| 14 | A section-complete moment: a calm check and "Showstreet done — 21 steps" when a section fills (a completion cue, not a reward) | Build guide, `audits/03-apps/dollywood.md:964` | 3 | S | 3.0 |
| 15 | "Around the table" pass-the-iPad Pray now: each asker's face large, everyone at the table recorded with one tap each | Prayer, `audits/03-apps/prayer.md:1095` | 4 | M | 2.0 |

- **Also at 4.0, not listed:** Timer's clear "Time's up" moment, undo instead of a silent cancel, a bigger iPad dial and persisted pause; F260's un-log on Undo and the pending-today streak; Tally's rounded numerals and kid-safe Reset; the Larder's single set of words for "old"; the build guide's phone 3D toggle; the park map's GPS resume, denied state and a kid map that follows its beacon; Kid Verse's day strip and Done ★ on the first screen; undo for a Verses rating.
- **New ideas tied at 2.0:** answered-prayer anniversaries on the TV, a pictorial kid timer, starting a timer by voice, a past-weeks shelf in Kid Verse, and a shared "heading to X" in the park map.
- **Structural fixes that rank lower by ratio but remove whole families of criticals:**
  - Tally counting by delta (5/M, `audits/03-apps/tally.md:754`).
  - Per-item rows for Kid Verse stars and heard days (`audits/03-apps/kidverse.md:904`), Verses reviews and the build guide's steps.
  - A household `hub.today()`.

## App-specific checks at a glance

The constitution names checks for five apps (`audits/HUB-AUDIT-PROMPT.md:203-207`). The four discovered apps got their own checks from their investigators. Full tables: Timer `audits/03-apps/timer.md:582`, Tally `audits/03-apps/tally.md:764`, Larder `audits/03-apps/leftovers.md:1049`, F260 `audits/03-apps/f260.md:913`, Prayer `audits/03-apps/prayer.md:1101`, build guide `audits/03-apps/dollywood.md:968`, park map `audits/03-apps/dollywood-live.md:874`, Kid Verse `audits/03-apps/kidverse.md:914`, Verses `audits/03-apps/verses.md:714`.

| App | Check | Result | IDs |
|---|---|---|---|
| Timer | Accurate after backgrounding | **PASS.** 0 s error after 3-4 min hidden; a frozen page caught up (0:59 → 0:38, expected 38). Every finish lands 0.2-0.5 s early from rounding | OK-TIMER-1, P3-TIMER-05 |
| Timer | Keeps the screen awake | **PARTLY.** The app requests no wake lock (NOT FOUND IN CODE); the shell takes one only on a tap in its own document | P2-STAB-09 |
| Timer | Alert when not in the foreground | **FAIL / UNRESOLVED.** Page closed or asleep through the end: nothing. Notification suppressed while the Timer app is open, even when hidden. No server push exists (no timer code in `worker/src`). The iOS beep is likely silent | UX-TIMER-3, P3-TIMER-04, PWA-GAP-1, U-1 |
| Tally | Large targets | **PASS.** + 140 px (kid 168), − 96 px (kid 116), Reset 145×44 (kid 162×64); the kid Reset sits 24 px below + | UX-TALLY-1 |
| Tally | Undo | **FAIL.** NOT FOUND IN CODE; Reset writes 0 at once, with no confirm or undo | UX-TALLY-1 |
| Tally | Rapid repeated taps | **PASS** on one device: 100 taps exact in one POST, 60 on a slow link exact. **FAIL** across two devices of one person | OK-TALLY-1, P3-TALLY-01 |
| Larder | Date maths and time zone | **PASS** on ordinary days, at midnight and at the November DST change. **FAIL** after the March DST change, on another time zone, for non-ISO or future dates, and in the minute after midnight | P3-LEFTOVERS-03, -07, -04, -09, -08, -14 |
| Larder | Colourful, legible expiry states | **PARTLY.** Three states, each with stripe, chip, bar and heading; all text passes AA. Earth tones, not pastels; the warn bar is 2.69:1 and dark chip fills 1.01-1.08:1; states differ only by text | VIS-LEFTOVERS-2, -3, P3-LEFTOVERS-15 |
| F260 | Progress persistence across devices | **FAIL, owned by Phase 2** (phone → iPad Home in 29.3 s; losses under P2-SYNC-01/-03/-05/-17/-18/-19/-20, P2-PROF-02). New facets filed here | P3-F260-01, -02, -13, -15 |
| F260 | Catch-up for missed days | **PARTLY.** Pace works but reads "2 week behind"; a gap in an earlier week is offered only after 73 more readings; an unread today breaks the 2-rest-day streak | GAP-F260-1, P3-F260-11, -03 |
| Prayer | Two-list model | **PARTLY.** Scopes are right, but private titles leak through the feed, the Switch cache and a Switch race. Send to family list publishes For and category, and the Add form never names its list | P2-PWA-01, P2-PROF-15, P2-SYNC-09, P3-PRAYER-18, -20, -08 |
| Prayer | Answered-prayer history | **PARTLY.** Kept indefinitely with a note, and shown in Record, Today, anniversaries and print. "Put back on the list" erases the note, Undo can fail, and Record has no search or grouping | P3-PRAYER-04, -09, GAP-PRAYER-2 |
| Build guide | Progress, migration, visibility, 3D | Progress is in person scope through hub.js; the legacy migration is unsafe before the first pull (24 → 1); adults-only visibility holds in the UI; 3D builds in 412-575 ms, but idle 2D keeps the CPU busy | P2-SYNC-01, P3-DOLLYWOOD-01 → P2-SYNC-03, P2-SEC-02, P3-DOLLYWOOD-08, -09 |
| Park map | Names, kids' beacons, GPS, waits, meeting point | Names run as script. Beacon privacy fails five ways. GPS fails on first open and off site. Waits are right on a fresh open but go stale on a long failure. Rally is unreachable, and the meeting bar loses Go and never ages | P3-DOLLYWOOD-LIVE-01, -02, -05, -12, -13, -16, -03, -06, -07, -15, -11, -04, -18; P2-PWA-18 |
| Kid Verse | Stars rules, ledger, devices, pre-readers | One star per source per day and the 14-day look-back pass. The ledger applies once within a week but not across a week boundary or for uncredited days. First open and two devices lose stars. Pre-readers get partial support | P3-KIDVERSE-08, -12, -13, -01, -03, -11, -02, -10 |
| Verses | Leitner schedule, streaks, sharing, devices | Box moves, due dates and queue order pass. The streak resets on a day with nothing due. F260's practice dialog wipes the schedule. Two devices lose ratings. Midnight leaves it stale. The kid flow needs reading | P3-VERSES-11, P3-F260-01, P3-VERSES-02, -04, UX-VERSES-1 |

## Platform compliance at a glance

These are the **raw** counts from the shared counter, one method for every app (`node audits/tools/phase3/compliance.mjs` → `audits/evidence/p3/_compliance/_summary.json`, with every hit and its line in `audits/evidence/p3/_compliance/<app-id>.json`).
- **What is counted.** A literal is a value that does not come from `var(--…)`. A `color-mix()` of tokens is counted as derived, not hardcoded.
- **Raw, not corrected.** The counter is regex-based. Each report's §6 reviews the hits, corrects false positives and gives the corrected counts; where the two differ, §6 wins.
- **Report sections:** F260 `audits/03-apps/f260.md:835`, Larder `audits/03-apps/leftovers.md:981`, Prayer `audits/03-apps/prayer.md:1018`, Tally `audits/03-apps/tally.md:697`, Timer `audits/03-apps/timer.md:506`, build guide `audits/03-apps/dollywood.md:890`, park map `audits/03-apps/dollywood-live.md:802`, Kid Verse `audits/03-apps/kidverse.md:850`, Verses `audits/03-apps/verses.md:642`.

| App | Hex | rgb()/hsl() | Named colours | Font sizes | Radii | Spacing | Shadows | Durations | prefers-color-scheme | Unguarded :hover | confirm/alert/prompt | Direct localStorage | var(--…) refs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F260 | 0 | 0 | 12 | 128 | 39 | 234 | 10 | 23 | 0 | 1 | 1 | 3 | 469 |
| Larder Ledger | 0 | 1 | 0 | 16 | 1 | 36 | 3 | 2 | 0 | 0 | 0 | 0 | 105 |
| Prayer | 2 | 0 | 4 | 68 | 24 | 135 | 9 | 21 | 2 | 5 | 0 | 0 | 235 |
| Tally counter | 0 | 0 | 0 | 1 | 0 | 2 | 6 | 0 | 0 | 0 | 0 | 0 | 128 |
| Kitchen timer | 0 | 0 | 0 | 2 | 0 | 1 | 1 | 2 | 0 | 0 | 0 | 0 | 52 |
| Dollywood build guide | 262 | 41 | 14 | 143 | 96 | 269 | 30 | 21 | 0 | 7 | 5 | 18 | 568 |
| Dollywood park map | 225 | 35 | 14 | 143 | 96 | 269 | 30 | 21 | 0 | 7 | 5 | 18 | 567 |
| Kid Verse | 0 | 0 | 0 | 6 | 0 | 4 | 0 | 3 | 0 | 0 | 0 | 1 | 169 |
| Verses | 0 | 0 | 0 | 3 | 1 | 3 | 0 | 1 | 0 | 0 | 0 | 0 | 118 |

**Reading it.**
- **Colours.** Colour is tokenised everywhere except in the two Dollywood exports. Much of their hex is map colour, which `screens-apps.mjs` allows, and the two share one template, so each count is one fix upstream. F260's 12 named colours are its print stylesheet.
- **Sizes and spacing.** The large apps hardcode type, radius and spacing heavily: F260, Prayer and the Dollywood pair. The four small ds-based apps (Tally, Timer, Kid Verse, Verses) hardly do.
- **Phase 4.** It owns the full token-by-token comparison.

## Calibration notes

From the cross-app critic. Scores and severities are left as the reports set them; these notes are for the Phase 4 rescoring and the Phase 5 findings.

- **Colour & palette on the shared Hearth chrome** (the shell scored 4). F260, Larder, Prayer, Timer and the build guide anchor at 4 and cite the shell; Tally, Kid Verse and Verses give 5, and the park map 6 (map colours exempt). The evidence runs the other way.
  - The Timer got 4 although every text pair passes AA.
  - Verses got 5 with its most-tapped control, Got it, failing AA at 4.4:1 (`audits/03-apps/verses.md:580`).
  - Kid Verse got 5 with day letters at about 2.1:1 and a today ring at 1.70:1 (`audits/03-apps/kidverse.md:787`).

  Phase 4 should score the Hearth base once and deduct app-specific failures on top.
- **Dark mode.** Near-invisible non-text elements got anything from 4 to 7:
  - Kid Verse 4 (dots 1.14:1) and Tally 4 (discs 1.13-1.62:1);
  - F260 5 (empty cells 1.04:1) and the Larder 5 (chip fills 1.01-1.08:1);
  - Timer 6 (track 1.2:1) and Verses 6 (fills that nearly merge);
  - the park map 7, although its reason says dark text pairs were not measured (`audits/03-apps/dollywood-live.md:735`).

  P2-VIS-03 (Hearth on a dark OS) is also deducted by F260 and Tally but not by the build guide. It is a shell defect; Phase 4 should decide once whether apps deduct for it.
- **Iconography.** Mixed icon families scored 4 to 6. F260 got 4 for line SVGs plus emoji plus text glyphs. The park map got 6 while naming three families, and noted that the shell got its 6 with one set. Prayer got 5 and Verses 6, both "not one icon set".
- **Typography below the 11 px floor.** Only the build guide deducted for it (4). The park map kept 5 with a 9.5 px "MIN" and labels of about 8.7 px and 6 px; F260 kept 5 with a 9.5 px WEEK label; Kid Verse kept 5 with 10 px hints.
- **The two Dollywood exports share one template yet average 3.9 and 5.6**, and differ in every dimension. Part of the gap is real, because they show different surfaces. But the park map's reasons cite build-guide components it ships (serif 600 headings, the square chart, native checkboxes in glass sheets) without the build guide's deductions. Phase 4 should score the shared template components once.
- **Placeholder zeros on a slow first load.** P3-TALLY-07 is medium ("the app's one value is shown wrong"); P3-LEFTOVERS-05 and P3-VERSES-07 are low, following P2-SYNC-15 and P2-HOME-04. The reasons are stated but differ; Phase 5 should apply one rule.
- **One-tap destructive actions with no confirm and no undo.**
  - P3-PRAYER-04 (the answer note) and P3-LEFTOVERS-01 and -13 are critical under rule (a).
  - Tally's Reset (UX-TALLY-1: count wiped, beside +, shown to pre-readers) is a ux item at medium. The Tally report now says why: the label names the loss, and the counter is a single throwaway value. It also names a pre-reader's mis-tap on the adjacent button as the exposure the other two rated critical.

  Phase 5 should settle it.
- **Kids' location.** Both IDs use the same audience argument: the household already sees the dots.
  - P3-DOLLYWOOD-LIVE-02 (a guest flips a child's beacon) stays high.
  - P3-DOLLYWOOD-LIVE-12 is lowered to medium, also leaning on the P2-PROF-05 precedent. That precedent concerned hand-made requests, and the Larder report declined it for a shipped screen (P3-LEFTOVERS-13).

  The park-map report now states what separates them: in -02 a guest decides a child's sharing; in -12 a parent does, and the republish ends at the next pull. Phase 5 should confirm or merge.
- **The same template code at different severities.** P3-DOLLYWOOD-11 is low and P3-DOLLYWOOD-LIVE-09 medium, for the same Upright handler at :1029 in both exports. This is justified by frequency: every compass tap in the park map goes through it, against a secondary toggle in the guide. Both reports now say so.
- **Tie rules.** They were stated separately (Larder, F260, Timer, build guide; Kid Verse took the skeptics over the critic for -13) but agree in substance. The single rule is the one in "How to read this report".
- **Undo that leaves derived state behind.** P3-F260-02 is medium, because it also mutes the 8 pm nudge and Home. P3-PRAYER-21 and P3-PRAYER-09 are low, because only derived statistics are affected. The difference is justified by the push side effect.

## Not verified

Grouped. Each report's own list is the complete one: F260 `audits/03-apps/f260.md:957`, Larder `audits/03-apps/leftovers.md:1100`, Prayer `audits/03-apps/prayer.md:1146`, Tally `audits/03-apps/tally.md:794`, Timer `audits/03-apps/timer.md:627`, build guide `audits/03-apps/dollywood.md:1015`, park map `audits/03-apps/dollywood-live.md:926`, Kid Verse `audits/03-apps/kidverse.md:955`, Verses `audits/03-apps/verses.md:753`. The rig's limits are in `audits/01-capture.md` §3 and §4.

**Priority follow-ups (by code only, may raise a severity)**
- **P3-TALLY-06 in Prayer.** A guest who is first to open Prayer on a device holding the pre-profiles blob, with no `hub.migrated` mark, would take the previous adult's private personal list into the guest's own scope (`apps/prayer.html:640-651`, `apps/hub.js:400`). If it reproduces it is critical under rule (b). The same trigger in F260 (legacy reading history) and the build guide was also not run.
- **P2-SYNC-03 in the Larder and Prayer**: a legacy migration before the first pull could resurrect finished fridge items or set legacy prayer rows over the server's.
- **P3-TALLY-05's sibling channels** (`verses|person`, `dollywood|person`, `prayer|family`, `dollywood-live|person`): by code; only Tally was run.
- Phase 2 pointers not re-run in each app (listed per report), and the park map's keyboard D path writing `progress`.

**Real iOS rendering (every app).** SF Pro, SF Pro Rounded and New York fonts (the rig renders fallback fonts); Prayer's web fonts and their offline loss; real Liquid Glass and `backdrop-filter`; the white flash and rubber-band overscroll in the standalone PWA. Typography, Shape and Motion scores are provisional for this reason.

**Real touch.**
- iOS `:active` press states without a `touchstart` listener (Tally and others).
- Double-tap delivery and spacing (P3-LEFTOVERS-01, P3-VERSES-12), iOS double-tap zoom (Tally).
- The long-press callout on chrome and art.
- Swipes (F260 reading mode, Prayer's Pray mode), pinch, sheet drag and 3D orbit (build guide).

**Sound, speech and voice.**
- The Timer's finish beep on iPhone and iPad (U-1).
- Real `speechSynthesis` voices in Kid Verse and Verses (the rig stubs them).
- Real speech recognition for the Larder's voice add.

**Background, lock and power.**
- A locked iPhone at a timer's end.
- Screen Wake Lock on iPadOS (Timer, park map).
- Chromium's intensive throttling of a long-hidden tab.
- Live GPS "weak" and "searching" states and battery drain with the park map open all day.
- The 3D frame rate, texture release and idle ProMotion cost on a real iPad (build guide).

**Push through Apple's service.** The 8 am fridge push, the 8 pm and Sunday F260 nudges, and "Meet at <name>" (no UI calls it). Only the jobs' due lists were read.

**Platform features inside the viewer iframe.**
- The clipboard (Larder Copy, F260 backups).
- `window.print()` and AirPrint (F260, Prayer).
- `data:` and Blob downloads (build guide Export, Prayer Export) and `sms:` links (Prayer).
- The iOS date picker's `max` and validation (P3-LEFTOVERS-09, -14).
- Face ID / WebAuthn PRF on iOS (F260; tested only with a virtual authenticator).
- Focus zoom on 15 px fields.

**Household questions** (production was not read).
- How often a first pull is slow or fails on the household's networks; this sets the likelihood of the whole first-pull family.
- Whether any device still holds legacy keys (`tally.count`, `dollywood-build-progress-v2`, `prayer-data-v3`).
- How often one person uses two devices at once, or travels outside Eastern time.
- Real Queue-Times ride names.

## Reports

| App | Report | Confirmed primaries (c / h / m / l) | Rubric average |
|---|---|---|---|
| F260 Reading Plan | [03-apps/f260.md](03-apps/f260.md) (`audits/03-apps/f260.md`) | 20 (2 / 0 / 6 / 12) | 4.6 |
| Larder Ledger | [03-apps/leftovers.md](03-apps/leftovers.md) (`audits/03-apps/leftovers.md`) | 15 (3 / 0 / 3 / 9) | 4.3 |
| Prayer | [03-apps/prayer.md](03-apps/prayer.md) (`audits/03-apps/prayer.md`) | 26 (4 / 3 / 5 / 14) | 4.7 |
| Tally counter | [03-apps/tally.md](03-apps/tally.md) (`audits/03-apps/tally.md`) | 8 (3 / 0 / 2 / 3) + 1 pointer | 4.9 |
| Kitchen timer | [03-apps/timer.md](03-apps/timer.md) (`audits/03-apps/timer.md`) | 5 (0 / 0 / 1 / 4) | 4.9 |
| Dollywood build guide | [03-apps/dollywood.md](03-apps/dollywood.md) (`audits/03-apps/dollywood.md`) | 17 (1 / 0 / 6 / 10) + 1 pointer | 3.9 |
| Dollywood park map | [03-apps/dollywood-live.md](03-apps/dollywood-live.md) (`audits/03-apps/dollywood-live.md`) | 17 (1 / 1 / 10 / 5) + 1 pointer | 5.6 |
| Kid Verse | [03-apps/kidverse.md](03-apps/kidverse.md) (`audits/03-apps/kidverse.md`) | 14 (5 / 0 / 4 / 5) | 5.2 |
| Verses | [03-apps/verses.md](03-apps/verses.md) (`audits/03-apps/verses.md`) | 13 (2 / 0 / 4 / 7) + 1 pointer | 5.1 |
