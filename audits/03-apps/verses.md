# Verses (memory-verse trainer) (`verses`) — Phase 3 deep dive

| | |
|---|---|
| **App code audited** | `fe6041d`, unchanged since the Phase 0 baseline. This phase changed no app code. |
| **File(s)** | `apps/verses.html` (388 lines). Shared code it depends on: `apps/hub.js` (500), `apps/design.css` (617), `worker/src/data.js` (72). It also writes a row that `apps/f260.html` (2099) owns and reads, `f260.recall`. Registry entry: `apps.json:12`. |
| **Date** | 2026-09-24 |
| **Inputs** | `audits/00-inventory.md` §9a "verses — Verses" (lines 3287-3398); 208 Phase 1 captures under `audits/screens/verses/` and the 13 sheets `audits/screens/_sheets/verses--*.jpg`; `audits/01-leads.md` "Kid Verse and Verses" (lines 256-304) and line 88; Phase 2 IDs P2-SYNC-01, P2-SYNC-05, P2-SYNC-15, P2-SYNC-17, P2-SYNC-18, P2-STAB-01, P2-STAB-07, P2-HOME-06, P2-SEC-02, P2-PROF-02, P2-PROF-04, P2-PROF-14, P2-PROF-15, P2-PROF-19, GAP-HOME-2 (`audits/02-shell.md:660`) and the unnumbered Sync UX note (`audits/02-shell.md:2910`). |
| **Runtime** | Local instance with the demo household (typical seed: Eli has 64 memorised verses, 3 due, a 13-day streak; the family week is 38), Playwright WebKit. Chromium where stated (CLS; some skeptic runs). No production data or endpoint was touched. |
| **Reproduce** | Scripts in `audits/tools/phase3/verses/`, evidence in `audits/evidence/p3/verses/`. Run each with `node "audits/tools/phase3/verses/<name>.mjs"`. |

**How to read this.** Every bug, security or perf finding went to two independent skeptics, who re-read the code and re-ran it with their own scripts; a third broke ties. A defect is **CONFIRMED** only when at least two skeptics reproduced it and more confirmed it than refuted it. Refuted findings are under "Checked and not a bug", and undecided ones under "Unresolved". UX, VIS, GAP and OK items describe the design, not malfunctions, so they were not adversarially verified. A separate agent re-checked every rubric score against the screenshots, and a judge settled the one gap of 2 or more points (Color & palette). A completeness critic then swept the report on the local instance; the four defects it found (P3-VERSES-11 to -14) went through the same two-skeptic check. Severity follows the rule at the top of `audits/02-shell.md` (lines 25-37).

## Summary

- **What it is.** A Leitner-box trainer for the memory verses each adult has marked memorised in F260. You see a reference, recite it, tap Show and rate Got it / Almost / Not yet; the verse moves between five boxes reviewed every 1, 2, 4, 7 or 14 days (`apps/verses.html:9-12, 163-169, 193`). Kids Ezra and Kiara get only the family week's two verses. It writes its schedule into F260's own `f260.recall` row (`apps/verses.html:158-167`).
- **Confirmed defects: 13 primary (2 critical, 0 high, 4 medium, 7 low), plus P3-VERSES-01 as a pointer to P3-F260-01.** P3-VERSES-01 is the same defect as P3-F260-01 in the F260 report (the code is in F260), so P3-F260-01 is the primary ID and owns the severity (critical); the Phase 3 roll-up counts it once, there. One finding was refuted and none is unresolved. Four defects (P3-VERSES-11 to -14) were added after the completeness critic, each confirmed 2/2. The two criticals and the defect behind the pointer all silently erase review history:
  - **P3-VERSES-01, pointer to P3-F260-01 and the worst of the three**: one "Got it" or "Not yet" in F260's practice dialog wipes that verse's box, due date and streak, so a box-5 verse comes back as new. It needs no timing and no second device.
  - **P3-VERSES-02:** the same person rating on the phone and the Kitchen iPad within one 30 s poll window loses one device's ratings and the day's count (1 of 2, and 3 of 3 offline).
  - **P3-VERSES-03:** a rating on a device's first Verses open, before its own data arrives (offline or a slow link), replaced a 13-day review log with one day. On a cold kid device it also replaced the kid's whole schedule, rated on the wrong week.
- **Added after the critic.** A day with nothing due resets the day streak while the screen says "come back tomorrow" beside "keep it going today" (P3-VERSES-11, medium). On the iPhone a double tap on "Got it" reveals the next verse before it is recited (P3-VERSES-12, low). The veiled verse text is in the accessibility tree before Show (P3-VERSES-13, low). The empty state says a new verse appears "on its review day", but it is due at once (P3-VERSES-14, low).
- **Rubric: final average 5.1 / 10** (investigator 5.6). The checker lowered four dimensions by one point and the judge settled Color & palette at 5 (investigator 7). Layout, Iconography and Dark mode are best at 6; Motion & feedback and Glanceability are weakest at 4.
- **Biggest usability gaps.**
  - A pre-reader cannot practise: the kid card shows only a reference, and Read aloud says only the reference (UX-VERSES-1, high).
  - Show reveals nothing for about 9 in 10 cards, because verse text exists only where someone pasted it in F260 (GAP-VERSES-1).
  - No undo for a mis-tapped rating (UX-VERSES-2), and the daily review is 8 taps from Home (UX-VERSES-3).
- **Biggest visual gaps.** Hearth's earthy olive/terra/gold instead of vibrant pastels, with the light-mode primaries as deep fills with white text ("Got it" 4.4:1, VIS-VERSES-3, VIS-VERSES-4); live glass on the content card (VIS-VERSES-2); muddy rating fills in dark palettes (VIS-VERSES-7); a 78-110 px empty band in the card (VIS-VERSES-1).
- **What works.** Every rating follows the documented box rule and dates exactly, across both DST changes (OK-VERSES-1). All 104 references match F260 and are spoken naturally (OK-VERSES-2). No hardcoded colours, the person's accent throughout, no target under 44 px, CLS 0 (OK-VERSES-3).
- **Best-value improvement.** Keep the Leitner fields when F260 practises a verse (one line of F260's script, delight 4, effort S), then an Undo on the rating toast and a Verses card on Home. The structural fix is per-verse rows plus no rating before the first pull, which closes P3-VERSES-02 and -03.

## 1. Purpose and top jobs

Verses shows one card at a time: a kicker ("Week 33 · verse 1 · 2 more after this"), the reference in large serif type, a hint, the verse text veiled if F260 has it, then Read aloud and Show; after Show, Not yet / Almost / Got it (`apps/verses.html:103-117`). Adults also get a stats card (due today, day streak, memorised, a five-box histogram) and Due today / Coming up lists (`apps/verses.html:132-147`). It is listed for all seven household members but not the TV (`apps.json:12`).

There is no usage data, so the jobs are inferred from the app and CLAUDE.md:

| # | Job | Who | How often |
|---|---|---|---|
| 1 | Daily review: recite each due verse, Show, rate, until "All done for today" (0-9 due a day in the seed; Eli 3, Elizabeth 0) | Eli, Mae, Elizabeth, David | Daily, mostly on a phone |
| 2 | Glance at progress: boxes, day streak, Due today / Coming up | The same adults | Weekly, or after a review |
| 3 | Practise the family week's two verses | Ezra (5) and Kiara (4), usually with a parent, on the Kitchen iPad | A few times a week |

## 2. Features and gaps

**References.**
- **Apple first-party:** Apple has no flashcard or memorisation app. The nearest first-party patterns are the streak and daily-goal loops of Fitness and Books reading goals. The investigator fetched Apple's reading-goals support page, but its body did not render, so no Apple facts are taken from it.
- **Best in class:** Anki (https://docs.ankiweb.net/studying.html, read: four answer buttons each showing the next interval; "Again" restarts learning) and Remember Me, a Bible-memory app (https://remem.me/, read: spaced repetition, word puzzles, fill-in-the-gaps and typing, listening and recording yourself, images per verse, collections, statistics, sync). The "Verses" app (games, first-letter practice) and Anki's Undo are from general knowledge only.

| Capability | This app | Reference | Gap |
|---|---|---|---|
| Spaced-repetition schedule | Five boxes, 1/2/4/7/14 days (`apps/verses.html:193, 295-296`) | Anki; Remember Me | None: exact (OK-VERSES-1) |
| Due queue order | Never reviewed first, then oldest due, then plan order (`apps/verses.html:225-231`) | Anki | None |
| Next interval on each rating button | No (`apps/verses.html:113-115`) | Anki shows it on every button | Yes (GAP-VERSES-2) |
| A forgotten verse | Not yet drops one box only (`apps/verses.html:295`) | Anki "Again" relearns; classic Leitner goes to box 1 | Yes (GAP-VERSES-2) |
| Verse text to check against | Only if pasted in F260 (`apps/verses.html:215, 326`): Eli 7 of 64 | Remember Me shows the text | Yes (GAP-VERSES-1) |
| Hints and practice modes (first letters, gaps, puzzles, typing) | NOT FOUND IN CODE | Remember Me; the Verses app | Yes (§7 ideas) |
| Hear the verse | The reference only; the text branch cannot be reached (`apps/verses.html:272`, P3-VERSES-06) | Remember Me listens | Partly |
| Record yourself | No | Remember Me | Yes |
| Undo a rating | NOT FOUND IN CODE | Anki Undo | Yes (UX-VERSES-2) |
| Choose a verse to practise | Only "Practise one anyway", which takes the next scheduled one (`apps/verses.html:366-371`) | Anki browser; Remember Me collections | Yes |
| Streaks and statistics | Day streak, per-verse streak, histogram (`apps/verses.html:234-236, 339-355`) | Remember Me statistics; Fitness streaks | Small: nothing celebrates a streak, and a day with nothing due breaks it (P3-VERSES-11) |
| Sync across a person's devices | Through hub.js, but whole-map rows lose reviews (P3-VERSES-02) | Remember Me sync | Partly |
| Home presence or reminder | A summary "for the Home card" that nothing reads (`apps/verses.html:172`; GAP-HOME-2); no push | Apple goal nudges and widgets (product knowledge) | Yes (UX-VERSES-3) |
| Kid mode | The week's two, 84 px buttons, no words or picture of the verse (`apps/verses.html:222, 228`) | Kid Verse in this hub already has a kid paraphrase per week (`apps/kidverse.html:188`) | Yes (UX-VERSES-1) |
| Images per verse | No | Remember Me | Yes |

## 3. Ease of use

Taps measured with real clicks in `audits/tools/phase3/verses/taps.mjs` (evidence `audits/evidence/p3/verses/taps.json`):

| Job | Profile | Path | Taps | Target ≤ 2 for the most frequent | Met? |
|---|---|---|---|---|---|
| J1 Daily review, 3 due (the most frequent job) | Eli, iPhone PWA | Home → Apps tab → Verses tile → (Show → Got it) × 3 | 8 (4 for a single verse) | ≤ 2 | **No** |
| J2 Glance at due count, streak, boxes | Eli, iPad portrait | Home → Apps tab → Verses tile (stats card at y 474-737 of 1132, fully on the first screen) | 2 | n/a | n/a (2) |
| J3 Kid practises the week's two | Ezra, iPad portrait | Home → Apps tab → Verses tile → Show → Got it → Show → Got it | 6 | n/a | n/a |
| J4 Practise one when nothing is due | Elizabeth, iPhone PWA | Home → Apps tab → Verses tile → Practise one anyway → Show → Got it | 5 | n/a | n/a |

Home has no Verses card for anyone (`homeHasVersesCard: false`).

- **Discoverability.** Inside the app the one card and its two buttons are obvious. Outside it, Verses is reachable only from the Apps grid; the summary it writes for Home is never read (UX-VERSES-3). The empty state tells you to mark verses in F260 but has no button to go there (GAP-VERSES-3).
- **Undo.** None: a rating is written at once and the card advances; the 2.2 s toast has no action (`apps/verses.html:294-304`; `apps/hub.js:431-434`) (UX-VERSES-2).
- **Error prevention.**
  - On the phone Not yet, Almost and Got it are stacked 12 px apart (frame y 293-353, 365-425, 437-497 in `taps.json`), and a slip onto Not yet zeroes the verse's streak with no way back.
  - Nothing stops a rating before the app's own data has arrived (P3-VERSES-03), and a stalled load shows a confident false "all done" (P3-VERSES-07).
  - Keyboard: Enter or Space on a focused Read aloud reveals the answer (P3-VERSES-10).
  - On the iPhone a double tap on Got it reveals the next verse, and a third tap then rates that unrecited verse (P3-VERSES-12; `audits/evidence/p3/verses/critic-doubletap.json`). On the iPad, with the ratings in a row, a double tap does nothing more.
  - The veiled verse text is in the accessibility tree before Show (`audits/evidence/p3/verses/critic-veiled-a11y.json`), so a VoiceOver user would hear the answer before reciting it (P3-VERSES-13; a check on a real device is still to do).
  - On a day with nothing due the screen says "come back tomorrow" next to "keep it going today", and following it resets the day streak (P3-VERSES-11).
- **One-handed phone use.** Read aloud and Show sit at page y 319-451 and the ratings at 341-545 of 932 (frame coordinates plus the 48 px viewer bar). That is the middle band: reachable, but nothing is in the bottom third where the thumb rests.
- **iPad glanceability at 2-3 m.** Heuristic: legible when cap height ≥ distance / 200, at 0.192 mm per CSS px (`audits/evidence/p3/verses/glance-accent.json`). The 56 px reference has a 7.5 mm cap, legible to about 1.5 m (kid 8.6 mm, about 1.7 m). The stat numerals (3.8 mm) read to about 0.8 m; the pill, kicker and labels to under 0.5 m. So nothing is readable at 2-3 m; even the reference, the largest text, reaches only about 1.5 m (UX-VERSES-7).
- **Pre-reader use (Ezra, Kiara).** A 4-5-year-old can tap the eye icon and then the green check by icon, colour and position. But the card is only a reference, Read aloud says only "Acts, chapter 2, verse 42", Show reveals nothing, and after Show the hint is the adult "Did you get it? Be honest — that is what makes it stick." The kid cannot practise a verse they are never given (UX-VERSES-1).

## 4. Issues and bugs

### Register

| ID | Severity | Defect |
|---|---|---|
| P3-VERSES-01 | pointer → P3-F260-01 (critical) | Rating a verse in F260's practice dialog wipes its Verses schedule (box, due date, last review, streak). Same defect as P3-F260-01, counted there in the roll-up |
| P3-VERSES-02 | critical | Two devices reviewing: one device's ratings and the day's review count are silently erased |
| P3-VERSES-03 | critical | A rating before Verses' own data arrives on a device replaces the whole review log (on a cold kid device, the whole schedule too) |
| P3-VERSES-04 | medium | Left open past midnight, Verses keeps saying "All done for today" / "Come back tomorrow!" while verses are due |
| P3-VERSES-05 | medium | The "Not yet" toast always says "again tomorrow", even when the verse returns in 2, 4 or 7 days |
| P3-VERSES-06 | medium | Read aloud disappears after Show, so the verse text can never be heard |
| P3-VERSES-11 | medium | A day with nothing due resets the day streak, while the screen says "come back tomorrow" and "keep it going today" |
| P3-VERSES-07 | low | On a slow first load Verses shows "all done / Nothing to train yet" and saves a zero summary |
| P3-VERSES-08 | low | "Practise one anyway" makes the chosen verse "1 due today" and lists it under Due today as "tomorrow" |
| P3-VERSES-09 | low | A device in another time zone files reviews under its own date, so other devices count the wrong day |
| P3-VERSES-10 | low | With keyboard focus on Read aloud, Enter or Space reveals the answer instead of reading |
| P3-VERSES-12 | low | On the iPhone a double tap on "Got it" reveals the next verse before it is recited |
| P3-VERSES-13 | low | The verse text veiled until Show is exposed to screen readers before Show |
| P3-VERSES-14 | low | The empty state says a newly memorised verse appears "on its review day", but it is due at once |

The register is in severity order, so P3-VERSES-11 sits with the other medium defects. The defect sections below are in ID order.

### Phase 2 defects that show up here

- **P2-SYNC-01** (critical). The whole-map last-write-wins class. Verses adds a new writer and two new rows, `f260.recall` and `verses.log`, filed as P3-VERSES-02. F260 also writes the whole `f260.recall` map (`apps/f260.html:1915`), so a stale F260 copy on another device can overwrite Verses ratings the same way; not re-run. The window is wider than a poll. F260 folds in remote changes only when no modal is open and the journal is locked (`apps/f260.html:2086-2090`). The journal stays unlocked until 5, 15 or 30 minutes of idle time, or indefinitely with auto-lock set to "Never" (`apps/f260.html:668, 930, 2042`). Meanwhile a practice rating writes the recall map F260 last read, at boot or at the last merge before the journal was unlocked (`apps/f260.html:927, 2077, 1915`). That removes every Verses rating made on other devices since then. Not re-run; the deferral itself is noted in `audits/03-apps/f260.md:125`.
- **P2-SYNC-17** (critical). Write before the first pull. Verses is a new trigger: the shell's warm `f260` cache removes the 6 s wait altogether (`index.html:458`; `apps/hub.js:334-337`). Filed as P3-VERSES-03.
- **P2-SYNC-05** (critical). `hub.ready` resolves before the app's own first pull and the app treats "no data yet" as "no data": the root cause of P3-VERSES-07.
- **P2-SYNC-15** (low). False empty wording on a cold load; P3-VERSES-07 is the Verses surface of it.
- **P2-SYNC-18** (critical). Verses repaints only on `hub.onChange` (`apps/verses.html:380`), so a `refreshScope` swap without onChange can leave it painting, and then writing, a stale recall map. Not re-run.
- **P2-STAB-07** (medium). Midnight staleness, shown in Phase 2 for F260 and Kid Verse only. Verses reproduces it as P3-VERSES-04.
- **P2-STAB-01** (critical). With Reduce Motion on the whole hub is blank, Verses included. Not re-run in Verses.
- **P2-HOME-06** (low). `apps/verses.html:305` puts the name in the feed text; the stored line is "Ezra reviewed 2 memory verses" with `name: "Ezra"` returned beside it (`audits/evidence/p3/verses/kid-flow.json`, `feed`), the pattern that renders as "Ezra Ezra …". Phase 2 had this from code only (`audits/02-shell.md:467`).
- **P2-SEC-02** (low). Kids' ratings go to their own `f260/person` scope by design (`apps/verses.html:175`), although F260 is not listed for kids (`apps.json:4`); the server does not enforce `visibleTo`, so it accepts the writes. No harm observed.
- **P2-PROF-04** (critical). After a Reset PIN, the claimer read David's `verses` rows (`audits/02-shell.md:1251, 1263`).
- **P2-PROF-14** (critical). A fast-clocked device's stamp outranks later writes; it applies to the whole-map `f260.recall` and `log` rows alike. Not re-run.
- **P2-PROF-02** and **P2-PROF-19** (critical). Queued person-scope writes, Verses ratings included, stuck after Switch or deleted by "Forget this device". Not re-run.
- **P2-PROF-15** (low). After Switch, the previous person's `f260` and `verses` caches stay on the device.
- **GAP-HOME-2** (medium; `audits/02-shell.md:660`). `verses.summary` has no reader; this report measures its cost as 8 taps from Home (UX-VERSES-3).
- **Sync UX, "nobody is told when a change did not sync"** (medium, unnumbered; `audits/02-shell.md:2910`). The offline first-open run rated and queued with no indicator (`audits/evidence/p3/verses/first-open-log-offline-before-rating.png`), and the visual checker found the offline captures identical to the online ones (`audits/screens/verses/trainer-offline-iphone-pwa-light.png` against `audits/screens/verses/trainer-typical-iphone-pwa-light.png`). `apps/verses.html` never reads `hub.sync`.

From another app's Phase 3 report: P3-TALLY-05 (shell cause; `audits/03-apps/tally.md:314`). `verses|person` is not among the shell's channels (`index.html:457-458`). So a rating's `verses.log` write that is still queued when Verses closes (offline, or on a slow link) waits until Verses is reopened on that device. Whole-row last-write-wins can then discard it (P3-VERSES-02). `f260.recall` is in the declared `f260|person` channel, and the shell does send it. By code; not run.

### Confirmed defects

#### P3-VERSES-01 — Rating a verse in F260's practice dialog wipes its Verses schedule (box, due date, last review, streak) (pointer to P3-F260-01)

- **Pointer.** P3-F260-01 is the primary ID and owns the severity; the code is apps/f260.html:1915. The rest of this block is kept as Verses-side evidence.
- **Same defect as P3-F260-01** (`audits/03-apps/f260.md:148`). The code is in F260 (`apps/f260.html:1915`), so the roll-up counts it once, under P3-F260-01. This entry records how it shows in Verses. Both reports confirmed it 2/2 independently.
- **Severity: critical** (skeptics: critical / critical; unchanged). Rule (a): one normal tap in the shipped UI silently overwrites stored household data, the verse's Leitner box, due date, last review and per-verse streak. No dev tools, no second device and no timing are needed.
- **Exposure.** An adult opens a memorised verse in F260 (tapping it opens practice, `apps/f260.html:1651`) and rates it Got it or Not yet, for a verse Verses has scheduled. Both apps list the same verses, so this is ordinary use. F260 asks for the verse text to be pasted once before Reveal and the ratings appear.
- **Scope.** Only that verse's schedule is lost; the other recall entries, the verse text, `f260.mem` and Verses' own day log survive. Related: F260's "Reset progress…" deletes the whole `f260.recall` row, so every Verses box and due date goes, and its dialog does not say so (P3-F260-16, `audits/03-apps/f260.md:546`; UX-F260-2 at `audits/03-apps/f260.md:682` now keeps only 'cannot be undone').

**What happens now.** F260's practice dialog replaces the verse's whole entry with `{s, t}` (`apps/f260.html:1915`), dropping the `box`, `due`, `last` and `streak` that Verses writes (`apps/verses.html:296`). Verses then reads the row as box 1 with no due date: due now, and labelled "never reviewed" (`apps/verses.html:219, 229, 350`). In the run, Genesis 1:27 was tapped in F260 week 1, then Reveal, then Got it (toast "★ Got it — Genesis 1:27"):
- before: `{box:5, due:"2026-10-02", last:"2026-09-18", streak:4}`;
- after: the server holds `{s:"got", t:1790080803799}` only;
- Verses went from "Eli · 3 to go" to "Eli · 4 to go"; the card is Genesis 1:27 with a "Box 1" chip, and Due today lists "Genesis 1:27 Week 1 Box 1 never reviewed".

The "Got it" demoted a box-5 verse to box 1, and nothing said so.

**Expected.** F260's practice keeps the Leitner fields (`{...recall[id], s, t}`) or applies the same box rule. The change is in F260's script; its layout and element ids stay, as CLAUDE.md requires. The comment at `apps/verses.html:218` covers only pre-Leitner legacy rows; it does not make this intended.

**Why it matters to the household.** The spaced-repetition schedule is the trainer's whole value. Rebuilding box 5 takes weeks of reviews, and the verse the person just said they know comes back daily as if new.

**Evidence.**
- Code: `apps/f260.html:1651, 1915`; `apps/verses.html:219, 229, 296, 350`.
- Run: `audits/evidence/p3/verses/f260-practice-wipes-1-0.json`.
- Screenshots: `audits/evidence/p3/verses/f260-practice-wipes-1-0-ipad.png`, `audits/evidence/p3/verses/f260-practice-wipes-1-0-queue-ipad.png`, `audits/evidence/p3/verses/verify-f260-practice-wipes-leitner-2-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/verses/f260-practice-wipes.mjs"` (optional argument: the verse id, default `1-0`). It prints the row and Verses' pill and queue before and after.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** wrote an independent script and ran it on the iPhone PWA instead of the iPad: `node "audits/tools/phase3/verses/verify-f260-practice-wipes-leitner-1.mjs"`. `rowBefore {s:'got', t:1789731000000, box:5, due:'2026-10-02', last:'2026-09-18', streak:4}`; F260 toast "★ Got it — Genesis 1:27"; `rowAfter {s:'got', t:1790080804907}`; `lostFields [box, due, last, streak]`; the other 64 keys untouched. Verses: "Eli · 3 to go" → "Eli · 4 to go", boxchip "Box 1", first queue entry "Genesis 1:27 Week 1 Box 1 never reviewed". Evidence `audits/evidence/p3/verses/verify-f260-practice-wipes-leitner-1-1-0.json`, `audits/evidence/p3/verses/verify-f260-practice-wipes-leitner-1-1-0-iphone.png`.
- **Skeptic 2** did not rely on the seeded row: `node "audits/tools/phase3/verses/verify-f260-practice-wipes-leitner-2.mjs"` first rated Luke 14:26-27 Got it in Verses (toast "moves to box 4"; server `{box:4, due:'2026-09-29', last:'2026-09-22', streak:3}`), then in F260 pasted the text, Reveal, Got it. Server after: `{s:'got', t:1790080807884}`. Verses: "Eli · 2 to go" → "Eli · 3 to go", card Luke 14:26-27 "Box 1", "Luke 14:26-27 Week 33 Box 1 never reviewed". Run twice, same result. Evidence `audits/evidence/p3/verses/verify-f260-practice-wipes-leitner-2.json`.

**Corrected claim** (skeptic 2). Accurate as filed, with one precision: F260's practice needs that verse's text pasted in F260 once before Reveal and the ratings appear (it is then kept in `f260.verses`). F260's "Not yet" overwrites the entry the same way (the same line, `apps/f260.html:1915`). That path was not run in this report, but P3-F260-01's skeptic 2 reproduced it (`audits/03-apps/f260.md:178`; `audits/evidence/p3/f260/verify-recall-practice-wipes-verses-box-2.json`): 12-1 went from box 5 to `{s:"not", t}`, and Verses showed it as Box 1, due today. What is lost is that verse's box, due, last and per-verse streak; Verses' day log and the other verses survive.

#### P3-VERSES-02 — Two devices reviewing: one device's ratings and the day's review count are silently erased

- **Severity: critical** (skeptics: critical / critical; unchanged). Rule (a): plain taps on the household's normal pair of devices silently overwrite a person's review history and the day's count. No error, no toast; the state reads "synced".
- **Exposure.** The same person rates on two devices within one 30 s poll window (`apps/hub.js:342`), for example a phone and the Kitchen iPad, or one device rates offline and the other rates before it reconnects. F260's practice dialog writes the same row. The window is wider than a poll: F260 folds in remote changes only when no modal is open and the journal is locked (`apps/f260.html:2089`). With the journal unlocked, it waits until 5, 15 or 30 minutes of idle time, or never with auto-lock set to "Never" (`apps/f260.html:668, 930, 2042`). A practice rating in that time writes the recall map from before the journal was unlocked (`apps/f260.html:927, 2077, 1915`). Not re-run.
- **Related.** P2-SYNC-01 is the same mechanism for `f260.done`, `f260.log` and the build guide. This is a new writer (Verses) and two new rows; one fix (a row per entry, or a merge per entry) covers both.

**What happens now.** Every rating rewrites the whole `f260.recall` map and the whole `verses.log` map from the device's own cache (`{...recall()}`, `{...log()}`, `apps/verses.html:294-298`). `hub.set` stamps the whole row (`apps/hub.js:236`), and the newer stamp wins per row, on the device (`apps/hub.js:295-296`) and on the server (`worker/src/data.js:60`).
- **A, both online.** The phone rates Luke 14:26-27 and John 17:3 Got it; the server has John at box 2, due 09-24. The iPad has not polled; 5.4 s after opening it rates Luke Almost. Server afterwards: John is back to `{box 1, due 09-22, last 09-21}`, and `log[2026-09-22]` is 1 after 3 ratings. After the poll both devices show "Eli · 2 to go" with John due again.
- **B, offline.** The phone, offline, rates all three due verses ("Eli · all done"); the iPad rates Luke; the phone reconnects. All three of the phone's ratings are gone, and the log reads 1.

**Expected.** A device that has not seen another device's rating never removes it: one row per verse (`recall:<id>`) and per day, or a merge per entry.

**Why it matters to the household.** Verses already recited come back, the day's review count is wrong, and nobody is told. It is the "it didn't save on the phone" complaint in a new row.

**Evidence.**
- Code: `apps/verses.html:294-298`; `apps/hub.js:236, 295-296, 342`; `worker/src/data.js:60`.
- Runs: `audits/evidence/p3/verses/two-devices-A.json`, `audits/evidence/p3/verses/two-devices-B.json`.
- Screenshots: `audits/evidence/p3/verses/two-devices-A-phone-after-poll.png`, `audits/evidence/p3/verses/two-devices-B-phone-after-poll.png`.

**Reproduction.** `node "audits/tools/phase3/verses/two-devices.mjs" A` (about 50 s), then `… B`. Each prints serverAfterPhone, serverFinal, logFinal, both devices after the poll, and the lost ids. Observed: A lost `["36-1"]`, log 1; B lost `["33-0","36-1","37-0"]`, log 1.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-recall-log-whole-map-lww-1.mjs"` (a fresh instance per scenario; real clicks; explicit `hub.pull()` on both devices instead of waiting for the 30 s poll, which runs the same code).
  - A: the phone's ratings put 33-0 at box 4 and 36-1 at box 2, log 2. The iPad's cache was stale (33-0 box 3; 36-1 box 1). After the iPad rated 33-0 Almost, the server had 33-0 at box 3 due 09-26 and 36-1 back at box 1 due 09-22; `logFinal` 1 after 3 ratings; both devices "Eli · 2 to go".
  - B: offline the phone showed "Eli · all done" with a local log of 3. After the iPad's rating and the phone's reconnect, 33-0 is the iPad's box 3 and 36-1 and 37-0 are back at box 1; log 1; `lostPhoneRatings = [33-0, 36-1, 37-0]`. No errors logged.
  - Evidence `audits/evidence/p3/verses/verify-recall-log-whole-map-lww-1.json` and the `-A-` / `-B-phone-after-pull.png` screenshots.
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-recall-log-whole-map-lww-2.mjs"` with a control.
  - RUN: after the phone's ratings the iPad still showed "Eli · 3 to go" with Luke 14:26-27, which the phone had already rated. Server final: 36-1 back to the seed value, 33-0 at box 3 due 09-26; `logFinal` 1 after 3 ratings. The phone went "Eli · 1 to go" → "Eli · 2 to go" after its pull, with sync `{state:'synced', lastError:null}` and no toast.
  - CTRL (the iPad pulls before rating): 33-0 box 4, 36-1 box 2, log 3, nothing lost. So the stale whole-map write causes the loss, not the rig.
  - Evidence `audits/evidence/p3/verses/verify-recall-log-whole-map-lww-2.json`, `audits/evidence/p3/verses/verify-recall-log-whole-map-lww-2-RUN-phone-after-pull.png`, `audits/evidence/p3/verses/verify-recall-log-whole-map-lww-2-CTRL-phone-after-pull.png`. Scenario B was not re-run by this skeptic.

**Corrected claim.** Accurate, with two precisions:
- In A the stale iPad also re-rates the verse the phone has just rated. Its Almost is computed from the stale box 3, so Luke ends at box 3 due 09-26 instead of the phone's box 4 due 09-29; the phone's promotion is lost as well as John's rating.
- The log ends at 1 after 3 ratings in A and 1 after 4 ratings in B. In these runs that is an undercount of the day's reviews; a broken day streak would need the two writes on different days (from the code, not run).

#### P3-VERSES-03 — A rating before Verses' own data arrives on a device replaces the whole review log (on a cold kid device, the whole schedule too)

- **Severity: critical** (skeptics: critical / critical; unchanged). Rule (a): one "Got it" in the shipped UI permanently replaces the person's `verses.log` row, the only record of review days and the source of the streak shown everywhere. On a cold kid device it also replaces the whole `f260.recall` map. No hand-made request is needed.
- **Exposure.** The first Verses open for a person on a device (each phone, the shared iPad, or after "Forget this device"), with a rating before the `verses/person` GET returns. On a normal network that takes 50-100 ms, which nobody can beat (the controls stayed intact), so in practice the trigger is offline or a slow link; a uniform 2.5 s latency per request was enough. The kid variant needs a brand-new device and a first load slower than 6 s.
- **Related.** P2-SYNC-17 (write before the first pull). The adult path is a new facet: the shell has already pulled `f260/person`, so `hub.ready` does not wait at all. The kid path is P2-SYNC-17's own mechanism reached through a new app and new rows.

**What happens now.** The shell already caches the person's `f260` scope (`index.html:458`). On a first Verses open some channel therefore has `since > 0`, and `hub.ready` skips its wait (`apps/hub.js:334-337`). Verses paints its due cards within about 150-450 ms while its own `verses/person` channel is still empty, with a "0" day streak. A rating then writes `log = {today: 1}` with a fresh stamp (`apps/verses.html:297-298`). The flush wins on the server, and the later pull skips the older server row (`apps/hub.js:295`).
- **Offline:** the server log went from 13 days to `{"2026-09-22":1}`; the Kitchen iPad then shows a "1" day streak (it was 13).
- **Slow network** (verses GET delayed 4 s, rating at 2.4 s): the same.
- **Cold kid device** (no cache, every data GET 9 s): Ezra had rated both week-38 verses on the iPad. On a new phone the card showed "Week 1 · verse 1 / Genesis 1:27", because `familyWeek()` falls back to 1 (`apps/verses.html:217`). One Got it replaced his `f260.recall` with `{"1-0":…}` and his log with `{"2026-09-22":1}`; the iPad then shows "Ezra · 2 to go / Acts 2:42" again.

**Expected.** Verses offers no rating until its own channels' first pull has landed, or merges the log and recall per entry.

**Why it matters to the household.** The day-streak history is permanently replaced by one day. For a kid, the day's ratings are lost and the wrong week is practised.

**Evidence.**
- Code: `apps/hub.js:295, 334-337`; `apps/verses.html:217, 294-298`; `index.html:458`.
- Runs: `audits/evidence/p3/verses/first-open-log-offline.json`, `audits/evidence/p3/verses/first-open-log-slow.json`, `audits/evidence/p3/verses/stalled-load-kid.json`.
- Screenshots: `audits/evidence/p3/verses/first-open-log-offline-before-rating.png`, `audits/evidence/p3/verses/first-open-log-offline-ipad-after.png`, `audits/evidence/p3/verses/stalled-load-kid-iphone.png`, `audits/evidence/p3/verses/stalled-load-kid-ipad-after.png`.

**Reproduction.** `node "audits/tools/phase3/verses/first-open-log.mjs" offline`, then `… slow`: each prints `logBefore.days 13`, `logAfter {"2026-09-22":1}` and iPad streak "1". Kid: `node "audits/tools/phase3/verses/stalled-load.mjs" kid` prints `recallBefore [38-0, 38-1]`, stalled ref "Genesis 1:27" and `recallAfter {1-0}` only.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-first-open-wipes-log-1.mjs" offline|slow|control` and `node "audits/tools/phase3/verses/verify-first-open-wipes-log-1-kid.mjs"`. After Home the new phone had `hub.cache.f260.person.eli` with `since>0` and no verses cache.
  - Offline: painted 146 ms after the frame appeared, "Eli · 3 to go", streak "0", sync "offline"; the server log went from 13 days to `{"2026-09-22":1}`; the iPad shows streak "1".
  - Slow: rated at 2.2 s with sync "pending"; the same loss.
  - Control (rating after the pull): streak "13" before, all 14 days kept, iPad "14".
  - Kid: painted at 6.57 s showing "Week 1 · verse 1 / Genesis 1:27"; one Got it left `f260.recall = {"1-0":{…}}` and `log = {"2026-09-22":1}`; the iPad showed "🦖Ezra · 2 to go / Acts 2:42 / Week 38 · verse 1" after 10 s and after a reopen.
  - Evidence: `audits/evidence/p3/verses/verify-first-open-wipes-log-1-offline-result.json` (and `-slow-`, `-control-`, `-kid-result.json`) with their `-phone-before.png` / `-ipad-after.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-first-open-wipes-log-2.mjs" offline|latency|control|kid` (a fresh instance per run; a new iPad context after each).
  - Offline: log 13 days → `{"2026-09-22":1}`; recall stayed at 64 keys; iPad streak "1".
  - Latency (every API request delayed 2.5 s): at paint streak "0", sync "pending", verses cache `since 0`; rated at 1463 ms; the server log became `{"2026-09-22":1}`; iPad streak "1". A `verses/batch` POST also went out at 515 ms, before the tap: the boot summary with streak 0.
  - Control: the verses GET landed within about 50 ms, streak "13" at paint, log 13 → 14, nothing lost.
  - Kid: painted at 6595 ms showing "Ezra · 2 to go / Genesis 1:27 / Week 1 · verse 1"; after one rating `recall ["1-0"]` and `log {"2026-09-22":1}`; the iPad shows Acts 2:42 due again.
  - Evidence: `audits/evidence/p3/verses/verify-first-open-wipes-log-2-offline.json` (and `-latency`, `-control`, `-kid`), with `-at-paint.png` and `-ipad-after.png`.

**Corrected claim** (skeptic 2; skeptic 1 confirmed as filed).
- **Adult variant:** only the Verses `log` row (plus `summary`) is replaced. `f260.recall` survives (64 → 64 keys), because the shell's `f260` copy is current; the Leitner boxes and due dates stay intact. What is lost is the day-by-day review history and the streak.
- **The window** lasts as long as the first `verses|person` GET: 50-100 ms on a normal network, so the practical triggers are offline or a slow link (reproduced with 2.5 s uniform latency, not only with a GET-only hold).
- **Kid variant:** a cold device, `hub.ready` giving up after 6 s, and whole-map rows built from an empty cache. Verses writes F260's `f260.recall` and its own log, and `familyWeek()` falls back to week 1.
- First paint: skeptic 1 timed about 146 ms from the frame appearing, against the investigator's about 450 ms from another start point; this does not change the claim.

#### P3-VERSES-04 — Left open past midnight, Verses keeps saying "All done for today" / "Come back tomorrow!" while verses are due

- **Severity: medium** (skeptics: medium / medium; unchanged). The screen misleads: it shows yesterday's all-done state as today's. No data is lost: a tap computes the day afresh (`apps/verses.html:294`), and Verses awards no stars. Same tier and reasoning as P2-STAB-07.
- **Exposure.** Verses left on screen across midnight. Corrected by skeptic 2: the Kitchen iPad normally sits on Home, not inside a person's Verses, so this needs someone to leave Verses open; an iOS Home Screen app killed in the background reloads and heals.
- **Related.** P2-STAB-07, which covered F260 and Kid Verse only.

**What happens now.** "Today" is computed only inside `render()` (`apps/verses.html:310`). `render()` runs at load, after a tap and on `hub.onChange` (`apps/verses.html:380-381`); the app has no timer and no visibility handler (setInterval / setTimeout / visibilitychange in `apps/verses.html`: NOT FOUND IN CODE). A pull that brings no change does not fire onChange. Eli and Ezra finished their reviews at 23:57 on 22 Sep; both pages then ran 6 minutes with real pulls, plus a hide/show. At 00:06 on 23 Sep:
- Eli still read "All done for today · 3 reviews today. Next up Exodus 20:1-3 tomorrow." with 0 due, while `dueIds()` returned 9 ids;
- Ezra read "You practised this week's verses. Come back tomorrow!" while both week-38 verses were due.

Reopening shows "Eli · 9 to go".

**Expected.** The queue rolls over at midnight: a re-render on `visibilitychange` and a minute tick when the day key changes.

**Why it matters to the household.** The morning review looks finished, and a kid is told to come back tomorrow on a day he should practise.

**Evidence.** `apps/verses.html:310, 380-381`; `audits/evidence/p3/verses/midnight.json`; `audits/evidence/p3/verses/midnight-eli-ipad-after.png`; `audits/evidence/p3/verses/midnight-ezra-iphone-after.png`.

**Reproduction.** `node "audits/tools/phase3/verses/midnight.mjs"` prints before/after for both, `freshDueEli` (9 ids), `freshDueEzra [38-0, 38-1]` and the reopened state "Eli · 9 to go".

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-midnight-stale-all-done-1.mjs"`: real Show / Got it taps at 23:58, 8 minutes of page time with real 30 s pulls, then synthetic hide/show, focus and online events. At 00:07:13 Eli still read "Eli · all done … 3 reviews today. Next up Exodus 20:1-3 tomorrow." with st-due 0, while `dueIds()` returned `[8-0, 13-1, 23-0, 24-1, 27-0, 30-0, 32-1, 35-0, 36-0]`; Ezra read "Come back tomorrow!" with `dueIds() [38-0, 38-1]`. A control PUT to a scope Verses listens to repainted both pages about 40 s later ("Eli · 9 to go", "Ezra · 2 to go"). Evidence `audits/evidence/p3/verses/verify-midnight-stale-all-done-1.json`, `audits/evidence/p3/verses/verify-midnight-stale-all-done-1-eli-ipad-0006.png`, `audits/evidence/p3/verses/verify-midnight-stale-all-done-1-ezra-iphone-0006.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-midnight-stale-all-done-2.mjs"` (own script): at Wed 00:05:17, after pulls and a hide/show, both screens were unchanged with st-due "0", while `dueIds()` returned the same 9 ids for Eli and `['38-0','38-1']` for Ezra. A remote PUT (`applied:true`) made Eli's page re-render to "Eli · 9 to go" at 00:06:01. Evidence `audits/evidence/p3/verses/verify-midnight-stale-all-done-2.json`, `audits/evidence/p3/verses/verify-midnight-stale-all-done-2-eli-ipad.png`, `audits/evidence/p3/verses/verify-midnight-stale-all-done-2-ezra-iphone.png` ("Practise again" still visible).

**Corrected claim.** Accurate, with qualifiers: the stale view heals on the first remote change in any scope Verses listens to (its own person scope, `f260` person or `kidverse` family; `apps/verses.html:149, 197`) or on a reload. The kid still sees "Practise again" (`apps/verses.html:336`), and any tap records the right new day, so the screen misleads without stopping practice.

#### P3-VERSES-05 — The "Not yet" toast always says "again tomorrow", even when the verse returns in 2, 4 or 7 days

- **Severity: medium** (skeptics: medium / low; unchanged from the investigator's medium). The schedule is correct as designed (`apps/verses.html:168, 295-296`); the message is wrong. It is the one confirmation a rating gives, and it is wrong for every adult Not yet from box 3 up, which covers most verses: Eli has 60 of 64 in boxes 3-5 (`boxes [2,2,6,14,40]` in `audits/evidence/p3/verses/verify-stalled-load-zero-summary-1.json`). Skeptic 2 rated it low because the true date also appears in Coming up and the done card; under the rule a misleading message in the rating flow is medium.
- **Exposure.** Adults only. In the kid flow the queue ignores due dates (`apps/verses.html:228`), so the verse really does return tomorrow.

**What happens now.** The Not yet branch of the toast is fixed text, "again tomorrow" (`apps/verses.html:302`), while the Almost branch on the same line is built from `INTERVALS`. Not yet drops the verse one box only (`apps/verses.html:295`), so its next review is usually later:
- Genesis 50:20, box 5 → Not yet: toast "again tomorrow"; row box 4, due 2026-09-29 (7 days).
- Luke 14:26-27, box 3 → Not yet: toast "again tomorrow"; row box 2, due 2026-09-24.

A related wording slip: "Got it — Romans 8:28-30 moves to box 5" for a verse already in box 5.

**Expected.** The toast states the real next review ("again in 7 days"), and "stays in box 5" at the top box.

**Why it matters to the household.** Someone who just failed a verse is told it returns tomorrow, and it returns a week later. The app's own Coming up list on the same screen contradicts the toast.

**Evidence.** `apps/verses.html:295, 302`; `audits/evidence/p3/verses/leitner.json`; `audits/evidence/p3/verses/toast-not-yet.json`; `audits/evidence/p3/verses/toast-not-yet-box5-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/verses/toast-not-yet.mjs"` prints the toast "Not yet — Genesis 50:20 again tomorrow" and the row `{box:4, due:"2026-09-29"}`. The full box matrix: `node "audits/tools/phase3/verses/leitner.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-not-yet-toast-wrong-interval-1.mjs"` on different verses (every other verse pushed to 2026-12-31): box 5 Not yet → "again tomorrow", row box 4 due 09-29 (7 days); box 4 → box 3 due 09-26 (4 days); box 3 → box 2 due 09-24 (2 days); control box 2 → box 1 due 09-23 (correct); box 5 Got it → "Got it — Romans 4:20-22 moves to box 5". Evidence `audits/evidence/p3/verses/verify-not-yet-toast-wrong-interval-1.json`, `audits/evidence/p3/verses/verify-not-yet-toast-wrong-interval-1-box5-not-iphone.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-not-yet-toast-wrong-interval-2.mjs"` with verses seeded in boxes 1-5: boxes 1 and 2 correct (+1 day); box 3 +2, box 4 +4, box 5 +7 days, each toasted "again tomorrow". The Coming up list on the same screen read "Romans 4:20-22 Week 3 Box 4 in 7 days". Evidence `audits/evidence/p3/verses/verify-not-yet-toast-wrong-interval-2.json`, `audits/evidence/p3/verses/verify-not-yet-toast-wrong-interval-2-box3-iphone.png`, `audits/evidence/p3/verses/verify-not-yet-toast-wrong-interval-2-box5-iphone.png`.

**Corrected claim.** Slightly broader than filed: the toast is right only when the verse lands in box 1 (Not yet from box 1 or 2); from box 3, 4 or 5 the verse returns in 2, 4 or 7 days, as designed. The box-4 case was not in the investigator's run. The "moves to box 5" wording for a box-5 verse is low-severity copy.

#### P3-VERSES-06 — Read aloud disappears after Show, so the verse text can never be heard

- **Severity: medium** (skeptics: low / medium; raised from the investigator's low). A whole secondary feature, hearing the verse text read aloud (`apps/verses.html:272`), cannot be reached in the shipped UI, and after Show even the reference cannot be replayed. The rule rates a broken secondary flow medium. Rating still works and no data is lost, so it is not high.
- **Exposure.** Adults, on verses whose text is on file in F260: Eli 7 of 64, Mae 1 of 31, Elizabeth 4 of 75, David 0 of 11 (`audits/evidence/p3/verses/texts-count.json`). Kids have no verse text, so they would only ever hear the reference.

**What happens now.** `#say` sits inside `#act-show` (`apps/verses.html:108-111`), which is hidden once the card is revealed (`apps/verses.html:328`; `[hidden]{display:none !important}` at `apps/design.css:316`). The line that unhides `#say` (`apps/verses.html:330`) has no effect, because its parent stays hidden. `speak()` adds the verse text only when revealed (`apps/verses.html:272`), so that branch never runs. After Show, `isVisible(#say)` is false on iPad and iPhone.

**Expected.** After Show, Read aloud stays and reads the verse text when F260 has it, as line 272 intends.

**Why it matters to the household.** Hearing the verse is how a person checks a recitation without reading, and it is the only accessible way to get the text read out on a phone.

**Evidence.** `apps/verses.html:108-111, 272, 328-330`; `apps/design.css:316`; `audits/evidence/p3/verses/kid-flow.json`; `audits/evidence/p3/verses/vischeck-readaloud-after-show.png`.

**Reproduction.** `node "audits/tools/phase3/verses/kid-flow.mjs"` prints `said ["Acts, chapter 2, verse 42"]` and `readAloudVisibleAfterShow false` on both devices. The visual checker's `node "audits/tools/phase3/verses/vischeck-readaloud.mjs"` gives the same (`audits/evidence/p3/verses/vischeck-readaloud.json`: before Show the only utterance is "John, chapter 17, verse 3"; after Show `sayVisible false`).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-read-aloud-gone-after-show-1.mjs"` for Eli and Ezra on iPad and iPhone, with speech stubbed. Before Show: buttons ["Read aloud","Show"]. After Show: `actShowHidden true`, `#say` hidden attribute false but a 0×0 rect, buttons ["Not yet","Almost","Got it"], and a real click on `#say` timed out. A programmatic click on the hidden button for Eli spoke "John, chapter 17, verse 3. And this is life eternal, …", so the text branch works but the UI cannot reach it. Evidence `audits/evidence/p3/verses/verify-read-aloud-gone-after-show-1.json` and four PNGs (`-eli-ipad-portrait`, `-eli-iphone-pwa`, `-ezra-ipad-portrait`, `-ezra-iphone-pwa`).
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-read-aloud-gone-after-show-2.mjs"` in four runs, including Eli rated through his queue to John 17:3, a card with 109 characters of text. After Show the text was unveiled with only the three ratings under it; `#say` measured 0×0 under the hidden `act-show`. Only a forced script click spoke the text. Evidence `audits/evidence/p3/verses/verify-read-aloud-gone-after-show-2.json`, `audits/evidence/p3/verses/verify-read-aloud-gone-after-show-2-eli-with-text-iphone-pwa-revealed.png`.

**Corrected claim.** Confirmed, with two corrections. The kid part is not caused by this bug: kids have no `f260.verses` text, so a kid would hear only the reference anyway; the defect affects adults with pasted text (on Eli's John 17:3, Read aloud disappears at the moment the text it would read is revealed). `#say` itself is not hidden; its parent is (`apps/verses.html:328`).

#### P3-VERSES-07 — On a slow first load Verses shows "all done / Nothing to train yet" and saves a zero summary

- **Severity: low** (skeptics: low / low; unchanged). No household data is lost: the adult empty state has no buttons, the display corrects itself when the pulls land, and the zero summary is derived data that the next render recomputes. Nothing reads `verses.summary` yet (GAP-HOME-2); a future Home card would show the zeros.
- **Exposure.** A first open with no cache on a slow network (about 3 s or more per request; see the corrected claim).
- **Related.** P2-SYNC-05 and P2-SYNC-17 (the root cause), P2-SYNC-15 (false empty wording on a cold load).

**What happens now.** On a new device with every data GET delayed 9 s, `hub.ready` gives up after 6 s (`apps/hub.js:337`). At 6.6 s Eli sees "Eli · all done" over the empty state, although he has 64 memorised verses and 3 due. `render()` calls `writeSummary()` every time with no pull guard (`apps/verses.html:239-245, 356`); the server summary during the stall was `{due:0, streak:0, boxes:[0,0,0,0,0], total:0}`. It was corrected once the pulls landed, with the app still open.

**Expected.** A loading state until the first pull, and no summary write before it.

**Evidence.** `apps/verses.html:239-245, 316-320, 356`; `apps/hub.js:337`; `audits/evidence/p3/verses/stalled-load-adult.json`; `audits/evidence/p3/verses/stalled-load-adult-iphone.png`; `audits/screens/verses/trainer-stalled-loading-desktop-light.png`.

**Reproduction.** `node "audits/tools/phase3/verses/stalled-load.mjs" adult` prints stalled `["Eli · all done", empty true]` and `serverSummaryAtStall {total:0}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-stalled-load-zero-summary-1.mjs"` twice: at about 6.35 s "Eli · all done" with "Nothing to train yet"; at 6.4-6.8 s the server summary `{due:0, streak:0, boxes:[0,0,0,0,0], total:0, reviewedToday:0, week:null}`; at about 18.3 s the screen corrected to "Eli · 3 to go"; at about 22.3 s the summary was back to total 64 / due 3. Evidence `audits/evidence/p3/verses/verify-stalled-load-zero-summary-1.json`, `audits/evidence/p3/verses/verify-stalled-load-zero-summary-1-stall-iphone.png`, `audits/evidence/p3/verses/verify-stalled-load-zero-summary-1-after-iphone.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-stalled-load-zero-summary-2.mjs"` (and `… threshold`): with a 9 s hold the frame was blank for 6 s, then "all done / Nothing to train yet", and the summary went to all zeros, then `{streak 13, total 0}`. A 4 s hold reproduced the false empty view (at 6141 ms) and a partial summary; 2.5 s and 1.2 s holds did not. With `f260` already cached by the shell, the trainer painted at 111 ms with streak 0 and the summary briefly read streak 0. Evidence `audits/evidence/p3/verses/verify-stalled-load-zero-summary-2.json`, `audits/evidence/p3/verses/verify-stalled-load-zero-summary-2-threshold.json`, `audits/evidence/p3/verses/verify-stalled-load-zero-summary-2-hold9.png`, `audits/evidence/p3/verses/verify-stalled-load-zero-summary-2-hold4.png`, `audits/evidence/p3/verses/verify-stalled-load-zero-summary-2-warm.png`.

**Corrected claim.**
- The trigger is wider than "a network slower than 6 s". The frame pulls its channels one after another (`apps/hub.js:310`) and stops waiting at 6 s, so the false view appears whenever the `f260` pull has not landed by then: about 3 s or more per request (4 s reproduced it, 2.5 s did not). The frame is also blank for the whole wait.
- With every GET delayed 9 s the false state lasts from about 6.3 s to about 18.3 s, because the pulls chain. The summary is rewritten at each partial state and is corrected only if Verses stays open that long.

#### P3-VERSES-08 — "Practise one anyway" makes the chosen verse "1 due today" and lists it under Due today as "tomorrow"

- **Severity: low** (skeptics: low / low; unchanged). A display contradiction within one session: the stored `verses.summary` keeps `due: 0`, because `writeSummary` uses `dueIds` (`apps/verses.html:242`), and the display clears once the verse is rated.

**What happens now.** The #again handler sets the queue to the next scheduled verse (`apps/verses.html:366-371`), and `currentQueue()` returns it (`apps/verses.html:307`). The pill, the "due today" stat and the Due today list all draw from that queue (`apps/verses.html:316, 343, 348-350`), while Coming up is computed separately. After Elizabeth taps it: the pill reads "Elizabeth · 1 to go", the stats "1 due today", Due today lists "Exodus 20:1-3 Week 8 Box 5 tomorrow", and Coming up lists the same verse.

**Expected.** Extra practice is shown as practice: the due count and Due today list stay at the real due set.

**Evidence.** `apps/verses.html:242, 307, 316, 343, 348-350, 366-371`; `audits/evidence/p3/verses/misc.json`; `audits/evidence/p3/verses/practise-anyway-queue-iphone.png`; `audits/screens/verses/practise-anyway-typical-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/verses/misc.mjs"` prints `momAfterAnyway: who "🌷Elizabeth · 1 to go", stats.due "1", queue ["Exodus 20:1-3Week 8Box 5tomorrow"]`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-practise-anyway-counts-as-due-1.mjs"` as Elizabeth: before, "all done", st-due "0", `dueIds []`; after the tap, "1 to go", st-due "1", queue-sub "1 verse", Exodus 20:1-3 "tomorrow" under Due today and first under Coming up, while `dueIds()` stayed `[]` and the summary due 0; after Got it, back to "all done". Evidence `audits/evidence/p3/verses/verify-practise-anyway-counts-as-due-1.json`, `audits/evidence/p3/verses/verify-practise-anyway-counts-as-due-1-iphone.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-practise-anyway-counts-as-due-2.mjs"` (batch writes aborted): the same readings, `summaryDue 0`, and the screenshot shows "1 due today" above a Due today row labelled "tomorrow" that repeats under Coming up. Evidence `audits/evidence/p3/verses/verify-practise-anyway-counts-as-due-2.json`, `audits/evidence/p3/verses/verify-practise-anyway-counts-as-due-2-after-tap-iphone.png`.

**Corrected claim.** None needed. Skeptic 2 notes that "1 to go" in the pill is defensible for a one-card session; the defects are the "due today" stat (`apps/verses.html:343`) and the Due today list (`apps/verses.html:348-350`). Kids are not affected: their stats and queue are hidden (`apps/verses.html:340`).

#### P3-VERSES-09 — A device in another time zone files reviews under its own date, so other devices count the wrong day

- **Severity: low** (confirming skeptics: low / low; the refuting skeptic rated it info). No data is lost and nothing private is exposed; a streak or "reviewed today" reads a day off, a due date lands a day late, and a kid's week verse is offered again one day and skipped the next.
- **Exposure.** One person's data used on devices in two time zones within the same day: travel outside Eastern time, or a device set to the wrong zone. The Dollywood trip stays in Eastern time.
- **Context.** Every hub page uses the device's local day (`apps/verses.html:203`; `apps/kidverse.html:259`; `apps/f260.html:932`; `apps/prayer.html:711`; `index.html:834`); only the Worker uses America/New_York (`worker/src/reminders.js:13`; `worker/src/chat.js:322`). The fix belongs to a household-day rule across the platform, not to Verses alone.

**What happens now.** Eli rated on a phone set to Europe/London at 20:30 New York time (01:30 Wednesday in London). His row was stored with last 2026-09-23 and due 2026-09-30, under log key 2026-09-23. The New York iPad shows "13 day streak · keep it going today", so tonight's review does not count today. Ezra's London rating also stored last 2026-09-23, and the New York iPad shows "Ezra · 2 to go / Acts 2:42" again, because the kid filter compares `last` with today (`apps/verses.html:228`).

**Expected.** A review counts for the household's day, whichever device made it.

**Evidence.** `apps/verses.html:203, 228`; `audits/evidence/p3/verses/dst-tz-tz.json`; `audits/evidence/p3/verses/tz-ny-kid-ipad.png`.

**Reproduction.** `node "audits/tools/phase3/verses/dst-tz.mjs" tz` prints `londonToday 2026-09-23`, `stored33_0.last 2026-09-23`, `nyEli.stats.sub "keep it going today"` and `nyEzra "Ezra · 2 to go"`.

**Verified: 2 of 3 skeptics confirmed (one refuted; the third broke the tie).**
- **Skeptic 1 (confirmed, low)** ran `node "audits/tools/phase3/verses/verify-other-timezone-day-1.mjs"` with the server clock at 20:30 New York and a London-zone phone, plus a New York control. London: Eli's 33-0 stored `{box:4, due:'2026-09-30', last:'2026-09-23'}`, log key 09-23; Ezra's 38-0 last 09-23. New York iPad Tue 20:31: Eli "keep it going today", Ezra "2 to go" with Acts 2:42 and Show enabled. Wed 08:00: Eli streak 1 and "reviewed today"; Ezra "1 to go" with Acts 4:31, so Acts 2:42 is skipped. The control gave due 09-29, streak 14, and Acts 2:42 due on Wednesday. Evidence `audits/evidence/p3/verses/verify-other-timezone-day-1-result.json`, `audits/evidence/p3/verses/verify-other-timezone-day-1-ny-ezra-ipad.png`, `audits/evidence/p3/verses/verify-other-timezone-day-1-ny-eli-ipad.png`.
- **Skeptic 2 (refuted, info)** ran `node "audits/tools/phase3/verses/verify-other-timezone-day-2.mjs"` and reproduced the same rows and New York readings (`audits/evidence/p3/verses/verify-other-timezone-day-2.json`, `audits/evidence/p3/verses/verify-other-timezone-day-2-ny-ezra-ipad.png`). Reason for refuting: the traveller's own device is consistent; a kid can already rate a verse twice a day through "Practise again" (`apps/verses.html:288, 366-371`) and earns nothing; nobody else reads the verses rows; and every hub app uses the same device-local day.
- **Skeptic 3 (confirmed, low; tie-break)** ran `node "audits/tools/phase3/verses/verify-other-timezone-day-3.mjs"` and matched skeptic 1 exactly, including the Wednesday-morning streak reset to 1. Two true points from skeptic 2 do not make the cross-device result correct: the New York device presents tonight's verse as still due, and the next morning shows an unreviewed day as "reviewed today" with the streak broken. Evidence `audits/evidence/p3/verses/verify-other-timezone-day-3.json`, `audits/evidence/p3/verses/verify-other-timezone-day-3-ny-ezra-tue.png`.

**Corrected claim** (skeptic 3). A review made on a device in another zone is filed under that zone's date. A New York device then shows it as not done today (Eli "keep it going today"; Ezra's Acts 2:42 offered again), and the next New York morning shows "reviewed today" with the adult streak reset to 1 and the kid's Acts 2:42 skipped; the Leitner due date lands a day late (09-30, not 09-29). "A kid can re-rate" is not new in itself, since Practise again allows it; the new part is the verse shown as due, then skipped.

#### P3-VERSES-10 — With keyboard focus on Read aloud, Enter or Space reveals the answer instead of reading

- **Severity: low** (skeptics: low / low; unchanged). Hardware-keyboard users only (desktop, an iPad with a keyboard); touch and VoiceOver send a click and are unaffected. It spoils one recall attempt; no data is written.

**What happens now.** The document keydown handler calls `preventDefault` on Enter and Space while the card is unrevealed, whatever has focus (`apps/verses.html:373-378`), so the focused button's click never fires and the card is revealed. Measured `{revealed:true, spoke:0}`.

**Expected.** Enter and Space activate a focused button; the Show shortcut applies only when no button has focus.

**Evidence.** `apps/verses.html:108-111, 328, 373-378`; `audits/evidence/p3/verses/misc.json`.

**Reproduction.** `node "audits/tools/phase3/verses/misc.mjs"` prints `enterOnReadAloud {revealed:true, spoke:0}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-enter-on-read-aloud-reveals-1.mjs"` in WebKit and Chromium: the control click on `#say` spoke "Luke, chapter 14, verses 26 to 27" and did not reveal; with focus confirmed on `#say`, Enter and Space each gave `revealed true, spoke 0`, and focus fell to the body. Evidence `audits/evidence/p3/verses/verify-enter-on-read-aloud-reveals-1.json`, `audits/evidence/p3/verses/verify-enter-on-read-aloud-reveals-1-webkit.png`, `audits/evidence/p3/verses/verify-enter-on-read-aloud-reveals-1-chromium.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-enter-on-read-aloud-reveals-2.mjs"` with a capture-phase click counter: Enter and Space on `#say` gave `sayClicks 0, keydownPrevented true, revealed true`, focus BODY; a probe button whose keydown was stopped before the document did activate (`probeClicks 1`), so the lost click comes from the app. Evidence `audits/evidence/p3/verses/verify-enter-on-read-aloud-reveals-2.json` and its `-webkit` / `-chromium` PNGs.

**Corrected claim.** Slightly understated as filed: Space does the same as Enter, and because the reveal hides the whole `#act-show` row (`apps/verses.html:328`), focus drops to the body. A keyboard user cannot use Read aloud before the reveal at all.

#### P3-VERSES-11 — A day with nothing due resets the day streak, while the screen says "come back tomorrow" and "keep it going today"

- **Severity: medium** (skeptics: medium / medium; unchanged). It is a misleading secondary display: the headline day-streak number resets to 0 after a day the app itself called finished. No household data is lost (`verses.log`, `f260.recall` and the boxes are untouched), and the review flow still works, so it is not high. Kind: filed as a bug against the obvious user expectation; skeptic 2 would call it ux (misleading copy about a deliberate counting rule). The severity is the same either way.
- **Exposure.** Any adult on a day when none of their verses is due who does not tap "Practise one anyway". With a Leitner schedule such days come up for anyone whose verses sit in the 7- and 14-day boxes; Elizabeth has 60 of 75 there (`wedSummary.boxes [0,7,8,20,40]` in `audits/evidence/p3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-1.json`).
- **Related.** Not a Phase 2 duplicate: it is Verses' own logic. GAP-HOME-2 covers only the summary that Home never reads. Found by the completeness critic.

**What happens now.** The day streak counts consecutive days with at least one rating in `verses.log` (the data contract at `apps/verses.html:171`; `dayStreak` at `apps/verses.html:234-235`). Only `rate()` writes the log (`apps/verses.html:290-306`), and a rating needs a due verse or "Practise one anyway" (`apps/verses.html:366-371`). On a day with nothing due, one screen shows two opposite instructions. The done card says "Nothing due today" and "Next up … tomorrow", and the Due today list says "Nothing due — come back tomorrow." (`apps/verses.html:333-335, 351`). Beside them the stats card shows the streak with "keep it going today" (`apps/verses.html:344`). Following "come back tomorrow" breaks the streak. Elizabeth on the iPhone PWA:
- Tue 22 Sep: `dueIds []`, done card "Nothing due today", streak "21", sub-line "keep it going today"; the log's last day is 2026-09-21.
- Wed 23 Sep: "Elizabeth · 15 to go", streak "0", sub-line empty, summary streak 0.
- Thu 24 Sep: streak "0".

**Expected.** A day with nothing due does not break the streak (for example, count a day on which the queue was empty or cleared), or the done card says that one "Practise one anyway" keeps the streak.

**Why it matters to the household.** The day streak is the trainer's headline number and its only motivation loop. The app resets a 21-day streak for doing exactly what it told the person to do.

**Evidence.**
- Code: `apps/verses.html:171, 234-235, 290-306, 333-335, 344, 351, 366-371`.
- Run: `audits/evidence/p3/verses/critic-streak.json`.
- Screenshots: `audits/screens/verses/nothing-due-typical-ipad-portrait-light.png` ("Nothing due today", "come back tomorrow" and "21 day streak · keep it going today" on one screen); `audits/evidence/p3/verses/critic-streak-wed-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/verses/critic-streak.mjs"` (typical seed, demo clock, WebKit). It opens Verses as Elizabeth on Tue 22 Sep 08:40, rates nothing, then moves the server clock and opens new devices on Wed 23 and Thu 24 Sep. It prints Tue streak "21" with "keep it going today" and `dueIds []`, then Wed and Thu streak "0".

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-1.mjs"` on fresh instances with its own state reader.
  - Run A, nothing rated on Tuesday: doneBig "Nothing due today", doneSub "Next up Exodus 20:1-3 tomorrow.", st-due "0", st-streak "21", "keep it going today", queue "Nothing due — come back tomorrow."; the server log ends 2026-09-21. Wednesday: "Elizabeth · 15 to go", streak "0", summary streak 0. Thursday: streak "0".
  - Run B, the control on a second fresh instance: one "Practise one anyway" → Show → Got it on Tuesday gave streak "22" and log `{"2026-09-22":1}`. Wednesday: streak "22", "keep it going today".
  - Evidence: `audits/evidence/p3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-1.json`, `audits/evidence/p3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-1-A-tue-iphone.png`, `audits/evidence/p3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-1-A-wed-iphone.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-2.mjs"` with the same run and control, rewinding the server clock before `L.reset`. Tuesday: the same three texts and streak "21"; log ending 2026-09-21. Wednesday: "15 to go", streak "0", `window.verses.dayStreak()` 0. Control: Tuesday streak "22"; Wednesday "14 to go", streak "22". Evidence: `audits/evidence/p3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-2.json`, `audits/evidence/p3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-2-A-tue-iphone.png`, `audits/evidence/p3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-2-A-wed-iphone.png`.

**Corrected claim** (both skeptics). The counting rule is deliberate: `apps/verses.html:171` and the comment at `apps/verses.html:234` define the streak as consecutive days with a rating. "Practise one anyway" keeps it (control: Wednesday streak 22). The defect is the conflicting copy. "Nothing due today", "Next up … tomorrow" and "come back tomorrow" tell the person the day is done, and nothing links "Practise one anyway" to the streak. The Due today line reads "come back " plus the next due label (`apps/verses.html:351`), so when the next verse is "in N days" the same defect lasts longer.

#### P3-VERSES-12 — On the iPhone a double tap on "Got it" reveals the next verse before it is recited

- **Severity: low** (skeptics: low / low; unchanged). No household data is lost or exposed, and the daily flow still works. The worst outcome is one spoiled recall attempt, plus, after a third tap, a rating recorded on a verse the person never recited. The trigger is narrow (timing, phone width only), so it is an edge case under the rule.
- **Exposure.** iPhone and any width under 560 px, where the three ratings are stacked. Mostly "Got it", the bottom and most-used button.
- **Related.** Not a Phase 2 duplicate: the cause is Verses' own rating and render code. It replaces the iPad-only "not a bug" check the investigator recorded (see "Checked and not a bug"). Found by the completeness critic.

**What happens now.** Below 560 px the ratings are stacked in one column (`apps/verses.html:48-49`). `rate()` sets `cur = null` and re-renders at once (`apps/verses.html:303-304`), with no cooldown or in-flight guard. `render()` then swaps `#act-rate` for `#act-show` (Read aloud / Show) in the same card (`apps/verses.html:108-116, 328-329`). design.css sets `touch-action: manipulation` on the buttons (`apps/design.css:312`), so double-tap-to-zoom does not swallow the second tap. On Eli's iPhone PWA, two taps 90 ms apart on "Got it":
- The first tap rates Luke 14:26-27 and moves on to John 17:3.
- The second tap lands on the next card's Show, and John 17:3's pasted text is revealed unblurred.

A double tap on "Almost" lands on Read aloud, and one on "Not yet" on the hint paragraph. On the iPad the ratings sit in a row, and a second tap on any of the three does nothing.

**Expected.** A second tap within a few hundred milliseconds of a rating is ignored, or the next card arrives in a way that cannot take a stray tap (a short disabled period or a card transition).

**Why it matters to the household.** Grandparents and kids often double-tap. Seeing the next verse before reciting it spoils that recall attempt, and a further tap rates a verse the person never recited.

**Evidence.**
- Code: `apps/verses.html:48-49, 108-116, 303-304, 328-329`; `apps/design.css:312`.
- Run: `audits/evidence/p3/verses/critic-doubletap.json` (iPhone PWA "Got it": `secondTapLandedOn 'show'`, `nextCardRevealed true`, `textVeiledAfter900ms false`; "Almost": `'say'`; "Not yet": `'P'`; iPad portrait, all three: `nextCardRevealed false`).
- Screenshot: `audits/evidence/p3/verses/critic-doubletap-got-iphone.png` (John 17:3's text in full above the stacked ratings). For contrast, the investigator's iPad check: `audits/evidence/p3/verses/double-tap-ipad.png`.

**Reproduction.** `node "audits/tools/phase3/verses/critic-doubletap.mjs"` (typical seed, demo clock, WebKit; batch writes aborted so every run starts from the seed). For the iPhone PWA and iPad portrait, and for each rating, it opens Verses as Eli, taps Show, then clicks the rating's centre twice 90 ms apart. It prints where the second tap landed and whether the next card is revealed.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-1.mjs"` with both touch taps (`page.touchscreen.tap`) and mouse clicks, 90 ms apart, on the iPhone PWA and iPad portrait, plus a 250 ms gap and a third tap on the iPhone.
  - iPhone "Got it", touch and mouse, 90 ms and 250 ms: under the finger after the first tap was `show`; afterwards John 17:3 was revealed (`veiled false`, hint "How did it go?").
  - iPhone "Almost": the second tap landed on `say` (Read aloud), with no reveal. "Not yet": it landed on the text paragraph, with no effect.
  - iPad portrait, all six cases: the second tap landed on the text, and nothing was revealed.
  - After the reveal the finger was over "Almost", not "Got it", in every iPhone "Got it" case (`underFingerAfterSecond 'almost'`). A third tap moved on to Matthew 28:18-20 and changed John 17:3 (`36-1`) from `last 2026-09-21` to `last 2026-09-22` with the box unchanged: an Almost rating on an unrecited verse.
  - Evidence: `audits/evidence/p3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-1.json`, `audits/evidence/p3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-1-got-touch-iphone.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-2.mjs"` with touch taps only, in four runs:
  - iPhone PWA at 120 ms, and iPhone Safari at 120 ms: the element under the finger was `show`, and John 17:3 was revealed (`rateShown true`, `veiled false`).
  - iPhone PWA at 250 ms, plus a third tap: the same reveal. The element under the finger was then `almost`, and the third tap left `36-1 = {s:'not', box:1}`, the Almost write, moving on to Matthew 28:18-20 with "Eli · 1 to go".
  - iPad portrait at 120 ms: the second tap landed on the hint paragraph, with no reveal.
  - Evidence: `audits/evidence/p3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-2.json`, `audits/evidence/p3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-2-iphone-pwa-120.png`, `audits/evidence/p3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-2-iphone-pwa-250.png`, `audits/evidence/p3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-2-iphone-safari-120.png`. Its screenshots were taken 400 ms after the tap, while the blur was still fading, so the text still looks soft although the `veiled` class is gone. The critic's 900 ms screenshot shows the text fully revealed.

**Corrected claim** (both skeptics). The reveal is confirmed with real touch taps at 90, 120 and 250 ms, but one part of the filed claim was wrong. Which rating ends up under the finger depends on the height of the next card. With pasted text (John 17:3 in the seed), the revealed text pushes the ratings down, so the finger rests on "Almost", not "Got it". A third tap then records Almost on the unrecited verse: the box is unchanged, it is marked reviewed today, and it is due tomorrow. It does not promote the verse a box. A real iPhone could confirm how iOS delivers two taps 90 ms apart; nothing in the code ignores the second one.

#### P3-VERSES-13 — The verse text veiled until Show is exposed to screen readers before Show

- **Severity: low** (skeptics: low / low; unchanged). It is not a security or privacy hole, and no data is lost. It defeats the recall exercise only for a screen-reader user, and only on verses whose text was pasted in F260. No household member is known to use VoiceOver. It is an accessibility edge case.
- **Exposure.** Screen-reader users, on verses with pasted text: Eli 7 of 64, Mae 1 of 31, Elizabeth 4 of 75 in the seed (`audits/evidence/p3/verses/texts-count.json`).
- **Related.** Not a Phase 2 duplicate: `audits/02-shell.md` has no screen-reader or ARIA defect. Found by the completeness critic.

**What happens now.** When F260 has the verse text, Verses puts it in `#text` and hides it only with a CSS blur (`.veiled { filter: blur(9px); user-select: none }`, `apps/verses.html:43-44`; the element at `apps/verses.html:107`; the class toggle at `apps/verses.html:326`). Nothing sets `aria-hidden`, `hidden` or `inert` on it before Show. The app's own intent is that nobody gets the answer before Show: Read aloud adds the text only once the card is revealed (`apps/verses.html:272`). On Eli's John 17:3 card, unrevealed (hint "Say it from memory, then tap Show."), `#text` has `ariaHidden null`, visibility visible and display block. The card's ARIA snapshot reads, in order: the heading "John 17:3", the hint, then the whole verse ("paragraph: And this is life eternal, …"), then the "Read aloud" and "Show" buttons.

**Expected.** Until Show the veiled text is hidden from the accessibility tree (`aria-hidden="true"`, removed on reveal), or it is rendered only after Show, so a screen-reader user can recite before hearing the answer.

**Why it matters to the household.** A VoiceOver user swiping through the card hears the answer before being asked to recall it, which defeats the trainer. A sighted user correctly sees only a blur.

**Evidence.**
- Code: `apps/verses.html:43-44, 107, 272, 326`.
- Run: `audits/evidence/p3/verses/critic-veiled-a11y.json` (`textEl {veiled:true, filter:'blur(9px)', ariaHidden:null, chars:109}`, `snapshotContainsText true`).

**Reproduction.** `node "audits/tools/phase3/verses/critic-veiled-a11y.mjs"` (typical seed, demo clock, WebKit, iPhone PWA, Eli; batch writes aborted). It rates the first card (Luke 14:26-27) Got it, leaving John 17:3 unrevealed, then prints `#text`'s computed state and Playwright's ARIA snapshot of `#trainer`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-1.mjs"`: in WebKit, Playwright's ARIA snapshot, and in Chromium on desktop, the engine's own accessibility tree through CDP (`Accessibility.getFullAXTree` on the verses frame).
  - WebKit, before Show: `#text {veiled:true, filter:'blur(9px)', display:'block', visibility:'visible', ariaHidden:null, inert:false, hiddenAncestor:null, chars:109}`. The snapshot has the verse paragraph before `button "Read aloud"` and `button "Show"`.
  - Chromium, before Show: 2 nodes that are not ignored (StaticText, InlineTextBox) carry the verse text; 0 ignored nodes contain it.
  - Evidence: `audits/evidence/p3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-1.json`, `audits/evidence/p3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-1-webkit.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-2.mjs"` in WebKit and Chromium on the iPhone PWA, with real taps to reach the card.
  - Both engines: John 17:3, `#text` present, veiled, `ariaHidden null`, `hiddenOrInertAncestors []`, and `textBeforeShowButtonInSnapshot true`.
  - Chromium's CDP tree: the text in a StaticText and an InlineTextBox node, neither ignored.
  - Evidence: `audits/evidence/p3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-2.json`, `audits/evidence/p3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-2-webkit-before.png`, `audits/evidence/p3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-2-chromium-before.png`.

**Corrected claim.** None. Both skeptics note that a CSS filter never removes content from the accessibility tree, so iOS VoiceOver should read the text too; a device check would confirm the swipe order but is not needed to confirm the defect. In both runs the after-Show filter briefly still read `blur(9px)` only because the veil fades out on a CSS transition; the `veiled` class was already removed.

#### P3-VERSES-14 — The empty state says a newly memorised verse appears "on its review day", but it is due at once

- **Severity: low** (skeptics: low / low; unchanged). Only first-run guidance is misleading: no data is lost, no flow breaks, and the verse turns up sooner than promised, which does no harm. Kind: filed as a bug (copy that states the wrong behaviour as fact); skeptic 2 would call it ux/copy. The severity is the same either way.
- **Exposure.** Every adult or guest who opens Verses with nothing memorised: the empty state appears only then (`apps/verses.html:320`). Kids never see it, because `trained()` always returns the family week's two for them.
- **Related.** Split out of GAP-VERSES-3 at the critic's request; the missing button to F260 stays there. Not a Phase 2 duplicate.

**What happens now.** The empty state reads "Mark a memory verse as memorised in F260 and it will show up here on its review day." (`apps/verses.html:129`). But F260's memorised tap writes only `f260.mem`, never a recall row (`apps/f260.html:1651-1653`), and Verses treats a memorised verse with no recall row as box 1, due now (`apps/verses.html:218-219, 229`). Mea, with nothing memorised, saw the empty-state copy. After she tapped Genesis 1:27's memorised button in F260, Verses at once showed "Mea · 1 to go", the Genesis 1:27 card ("Week 1 · verse 1 · last one"), "1 due today", and under Due today "Genesis 1:27 Week 1 New never reviewed".

**Expected.** The copy matches the behaviour, for example "Mark a memory verse as memorised in F260 and you can start reviewing it here straight away."

**Why it matters to the household.** It is the only guidance a new person gets, and first-run copy that contradicts what then happens makes the trainer's schedule harder to trust.

**Evidence.**
- Code: `apps/verses.html:129, 218-219, 229, 320`; `apps/f260.html:1651-1653`.
- Run: `audits/evidence/p3/verses/critic-empty-copy.json` (before `{who:'Mea · all done', empty:true}`; `memAfter {"1-0":true}`; after `{who:'Mea · 1 to go', ref:'Genesis 1:27', stats.due '1', queue ['Genesis 1:27Week 1Newnever reviewed']}`).
- Screenshots: `audits/screens/verses/trainer-empty-iphone-pwa-light.png` (the copy); `audits/evidence/p3/verses/critic-empty-copy-after-iphone.png` (the verse due the same day).

**Reproduction.** `node "audits/tools/phase3/verses/critic-empty-copy.mjs"` (typical seed, demo clock, WebKit, iPhone PWA, Mea). Device 1 reads the empty-state copy. Device 2 opens F260 and taps the memorised control of Genesis 1:27 (`[data-mem="1-0"]`). Device 3 opens Verses and prints the pill, the card and the Due today list.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/verses/verify-critic-empty-state-copy-review-day-wrong-4-1.mjs"` on one device going Verses → Home → F260 (the Plan tab, week 1, a real tap on the `[data-mem="1-0"]` button) and a fresh device for the final Verses open. Before: "Mea · all done", the empty-state copy, no `f260` rows on the server. After the tap the server's only row was `f260.mem {"1-0":true}`, with no recall key. Verses the same day (08:41): "Mea · 1 to go", Genesis 1:27, "Week 1 · verse 1 · last one", due "1", queue "Genesis 1:27 Week 1 New never reviewed", Coming up "Nothing scheduled yet.". Evidence: `audits/evidence/p3/verses/verify-critic-empty-state-copy-review-day-wrong-4-1.json`, `audits/evidence/p3/verses/verify-critic-empty-state-copy-review-day-wrong-4-1-before-iphone.png`, `audits/evidence/p3/verses/verify-critic-empty-state-copy-review-day-wrong-4-1-after-iphone.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/verses/verify-critic-empty-state-copy-review-day-wrong-4-2.mjs"`, writing the same `f260.mem {"1-0":true}` row through the local API instead of the UI tap, as an independent path. The write returned 200 `applied:true`; a fresh device 60 s later, the same demo day, showed "Mea · 1 to go", Genesis 1:27, due "1", queue "Genesis 1:27 Week 1 New never reviewed", with no recall row. Evidence: `audits/evidence/p3/verses/verify-critic-empty-state-copy-review-day-wrong-4-2.json`, `audits/evidence/p3/verses/verify-critic-empty-state-copy-review-day-wrong-4-2-before.png`, `audits/evidence/p3/verses/verify-critic-empty-state-copy-review-day-wrong-4-2-after.png`.

**Corrected claim** (skeptic 2). By the app's own definition (`apps/verses.html:225, 229`) a never-reviewed verse is due now, so its "review day" is technically today. The copy is misleading rather than strictly false, because most readers take "on its review day" to mean a later day. Low stands.

### Usability, visual and gap findings

These were not adversarially verified. Items marked "from the visual check" were added by the independent visual checker.

**UX**

- **UX-VERSES-1 — A pre-reader cannot practise: no verse words, the reference is the only thing read aloud, and every prompt is text** (high).
  - Ezra's card is a serif reference ("Acts 2:42") with the hint "Say the verse out loud, then tap Show." Read aloud says only "Acts, chapter 2, verse 42". Kids have no verse text (`textShown` false before and after Show), so Show reveals nothing; after Show the hint is the adult line "Did you get it? Be honest — that is what makes it stick." (`apps/verses.html:222, 228, 326-327`).
  - A 4-5-year-old can tap the eye and then the green ✓ by icon, colour and position (the visual checker's "partly"), but cannot practise a verse they are never given. Kid Verse already holds a kid paraphrase for every week (`apps/kidverse.html:188` onward, `VERSES[].words`) that Verses never uses.
  - High: the kid job (job 3) cannot be done without a reading adult, and the app is listed for both kids (`apps.json:12`).
  - Evidence: `audits/evidence/p3/verses/kid-flow.json`; `audits/evidence/p3/verses/kid-flow-revealed-iphone-pwa.png`; `audits/evidence/p3/verses/kid-flow-revealed-ipad-portrait.png`; `audits/screens/verses/kid-revealed-typical-iphone-pwa-light.png`. Run `node "audits/tools/phase3/verses/kid-flow.mjs"`.
- **UX-VERSES-2 — A mis-tapped rating cannot be undone** (medium). `rate()` writes the new box, due date and streak and advances (`apps/verses.html:294-304`); the previous values are not kept, and the toast (`apps/hub.js:431-434`, 2.2 s) has no action. A thumb on Not yet instead of Got it demotes the verse and zeroes its streak; on the phone the buttons are 12 px apart. Evidence: `audits/screens/verses/rated-typical-iphone-pwa-light.png`; `audits/evidence/p3/verses/kid-flow-revealed-iphone-pwa.png`.
- **UX-VERSES-3 — The daily review is 8 taps from Home; there is no Verses card although a summary is written for one** (medium). J1 took 8 taps with `homeHasVersesCard: false`. `verses.summary {due, streak, …}` is written "for the Home card" (`apps/verses.html:172, 238-245`) that `index.html` never reads (its channels at `index.html:458` have no `verses`). The same gap as GAP-HOME-2, measured here. Evidence: `audits/evidence/p3/verses/taps.json`.
- **UX-VERSES-4 — The pill says "all done" when nothing was done, and "Nothing due today" shows the celebration star** (low). `apps/verses.html:316` prints "all done" whenever the queue is empty: "Eli · all done" over "Nothing to train yet"; "Grandma Jo · all done" for a guest; "Elizabeth · all done" over "Nothing due today" with 0 reviews, under the gold star (`apps/verses.html:119-121, 333`). Evidence: `audits/screens/verses/trainer-empty-iphone-pwa-light.png`; `audits/screens/verses/nothing-due-typical-iphone-pwa-light.png`; `audits/evidence/p3/verses/guest-iphone.png`.
- **UX-VERSES-5 — While loading, Verses is a blank page with an empty pill** (low). `#trainer`, `#done` and `#empty` all start hidden until `render()` (`apps/verses.html:103, 119, 126`); no skeleton, no spinner. Evidence: `audits/screens/verses/trainer-loading-iphone-pwa-light.png`.
- **UX-VERSES-6 — The rating toast sits over the stats card on phones** (low). The 2.2 s toast covers the "4 days" and "Weekly" box labels and the Due today header, and cannot be dismissed. Evidence: `audits/screens/verses/rated-typical-iphone-pwa-light.png`; `audits/evidence/p3/verses/toast-not-yet-box5-iphone.png`.
- **UX-VERSES-7 — On the Kitchen iPad only the reference is readable past about 1.5 m** (low). Reference cap 7.5 mm (about 1.5 m; kid 8.6 mm, about 1.7 m); stat numerals 3.8 mm (about 0.8 m); pill, kicker and labels under 0.5 m. Evidence: `audits/evidence/p3/verses/glance-accent.json`; `audits/screens/verses/trainer-typical-ipad-portrait-light.png`.
- **UX-VERSES-8 — The same number three times, and the empty message twice** (low; from the visual check). One screen shows the pill "3 to go", the stat "3 due today" and the list header "3 verses"; the done state repeats "Nothing due" in the hero and in the Due today card. Evidence: `audits/screens/verses/trainer-typical-ipad-portrait-light.png`; `audits/screens/verses/done-typical-iphone-pwa-light.png`; `audits/screens/verses/nothing-due-typical-iphone-pwa-light.png`.
- **UX-VERSES-9 — Leitner jargon: "Box 3 · last 4d ago", "moves to box 4"** (low; from the visual check). The chip, the queue rows and the toasts speak in box numbers that nothing on screen explains, while the histogram labels the same boxes "Daily / 2 days / Weekly" (`apps/verses.html:194, 302, 324`). Evidence: `audits/screens/verses/trainer-typical-iphone-pwa-light.png`; `audits/screens/verses/rated-typical-iphone-pwa-light.png`; `audits/screens/verses/overdue-typical-ipad-portrait-light.png`.

**Visual**

- **VIS-VERSES-1 — The trainer card reserves 78-110 px of empty glass; on iPad and desktop it stays after Show** (low). Fixed `min-height` 448 px (phone), 520 px (kid phone), 380 px (560 px and wider) (`apps/verses.html:33-35`). Empty band before Show: iPhone 99 px (adult) and 110 px (kid); iPad and desktop 109 px (adult) and 78 px (kid). On iPad and desktop nothing grows on Show, so 109 px stays. The checker measured about 120 px under the rating row on iPad landscape. Evidence: `audits/evidence/p3/verses/layout.json`; `audits/screens/verses/trainer-typical-iphone-pwa-light.png`; `audits/screens/verses/kid-typical-ipad-portrait-light.png`; `audits/screens/verses/revealed-overflow-ipad-landscape-light.png`. Run `node "audits/tools/phase3/verses/layout.mjs"`.
- **VIS-VERSES-2 — The trainer and done cards are live glass on content, outside the perf guard** (low). `#trainer` and `#done` are `.card.glass-strong` (`apps/verses.html:103, 119`), computed `backdrop-filter: blur(18px) saturate(1.4) brightness(1.02)` in every theme; the scroll-page guard strips blur only from `.card.glass` (`apps/design.css:388, 400`). The checker saw the sheen gradient in the captures; the blur itself is from code (rig limit). Evidence: `audits/evidence/p3/verses/visual.json`; `audits/evidence/p3/verses/visual-hearth-iphone.png`; `audits/screens/verses/kid-offline-ipad-portrait-dark.png`.
- **VIS-VERSES-3 — "Got it" fails AA in Hearth (4.4:1)** (low). White 18 px / 600 text on `var(--olive)` (`apps/verses.html:59`); 18 px at 600 is not large text. The other four palettes pass (minimum 4.96). Evidence: `audits/evidence/p3/verses/visual.json` (`hearth.fails`); `audits/evidence/p3/verses/visual-hearth-iphone.png`. Run `node "audits/tools/phase3/verses/visual.mjs"`.
- **VIS-VERSES-4 — Light-mode primaries invert the house fill/ink rule** (low; from the visual check). In light mode Show is a deep fill in the person's accent with white text (navy for Eli, brown for Elizabeth, dark teal for Ezra), and Got it is olive with white text (`apps/verses.html:59, 110`). Dark mode already does the house thing (pastel periwinkle or aqua with dark ink), so the two modes disagree. Evidence: `audits/screens/verses/trainer-typical-iphone-pwa-light.png`; `audits/screens/verses/practise-anyway-typical-iphone-pwa-light.png`; `audits/screens/verses/kid-typical-ipad-portrait-light.png`; `audits/screens/verses/trainer-typical-ipad-landscape-dark.png`.
- **VIS-VERSES-5 — Two weights of the display face on one card** (low; from the visual check). The reference is serif at weight 400 (`apps/verses.html:38`); "All done for today" and "Nothing to train yet" use the same face at a similar size but inherit bold from the `h2` rule (`apps/verses.html:64`; `apps/design.css:306`). Evidence: `audits/screens/verses/trainer-typical-iphone-pwa-light.png`; `audits/screens/verses/done-typical-iphone-pwa-light.png`; `audits/screens/verses/trainer-empty-iphone-pwa-light.png`.
- **VIS-VERSES-6 — The histogram's tint follows the count, not the box** (info; from the visual check). Bar colour is `color-mix` by the same `--p` as the height (`apps/verses.html:82`), so in overflow data the "4 days" bar (8) is the palest and "2 days" (22) darker than "Weekly" (20); the ramp does not show box progression. Evidence: `audits/screens/verses/revealed-overflow-ipad-landscape-light.png`; `audits/screens/verses/trainer-overflow-iphone-pwa-light.png`.
- **VIS-VERSES-7 — In dark palettes the Not yet and Almost fills turn muddy and the low-box bars nearly vanish** (low). The soft terra and gold fills become dark browns that almost merge with the card; the Daily and 2-day bars and the box chips are dark on dark. The checker supported this in Midnight and Forest. Evidence: `audits/evidence/p3/verses/visual-midnight-iphone.png`; `audits/evidence/p3/verses/visual-forest-iphone.png`; `audits/screens/verses/kid-revealed-typical-ipad-landscape-dark.png`; `audits/screens/verses/trainer-typical-ipad-landscape-dark.png`.

**Gaps**

- **GAP-VERSES-1 — For most cards Show reveals nothing, because the only text source is a paste in F260** (medium). The veiled text exists only when F260 has pasted text for that verse (`apps/verses.html:215, 326`). Share with text in the seed: Eli 7/64, Mae 1/31, Elizabeth 4/75, David 0/11. Without text, Show only swaps the buttons and asks "Did you get it?", so the person must check the verse elsewhere. Verses has no paste or hint flow of its own; Remember Me shows the text and offers puzzles, gaps and typing. Evidence: `audits/evidence/p3/verses/texts-count.json`; `audits/screens/verses/revealed-typical-iphone-pwa-light.png`. Run `node "audits/tools/phase3/verses/texts-count.mjs"`.
- **GAP-VERSES-2 — Not yet drops a verse only one box, and the buttons do not show the next interval** (low). Not yet → max(1, box − 1) (`apps/verses.html:295`), so a forgotten box-5 verse returns in 7 days. Anki's "Again" restarts learning and every Anki button shows its interval; classic Leitner sends a miss to box 1. Evidence: `audits/evidence/p3/verses/leitner.json` (box 5 Not yet → box 4, due 2026-09-29).
- **GAP-VERSES-3 — The empty state has no way to go and mark verses in F260** (low). "Nothing to train yet … Mark a memory verse as memorised in F260" has no button or link to F260 (`apps/verses.html:126-130`), so a new person has to leave, find F260 in the Apps grid, and come back. Its wrong "on its review day" copy was moved out of this gap at the critic's request and verified as a bug: P3-VERSES-14. Evidence: `audits/screens/verses/trainer-empty-iphone-pwa-light.png`.

**What works**

- **OK-VERSES-1 — The box rule and due dates are exactly as documented, across DST** (info). All 9 real-UI ratings match: box ±1 or held, due = today + 1/2/4/7/14, last = today, per-verse streak +1 / held / 0, `s` got or not; `log[today]` went 0 → 9, the summary read `reviewedToday 9` and streak 14, and untouched rows were unchanged. On 2026-10-31, 2026-11-01, 2027-03-13 and 2027-03-14 all 20 due dates and "in N days" labels equal calendar arithmetic. Evidence: `audits/evidence/p3/verses/leitner.json`; `audits/evidence/p3/verses/dst-tz-dst.json`. Runs: `node "audits/tools/phase3/verses/leitner.mjs"`; `node "audits/tools/phase3/verses/dst-tz.mjs" dst`.
- **OK-VERSES-2 — References match F260 and every one is spoken naturally** (info). `REFS` equals F260's `PLAN[].m` for all 104 entries (`refsMatchPlan true`), and `sayRef` turns every one into words ("Second Corinthians, chapter 4, verses 7 to 10"; "Psalm 19, verse 14") with 0 unparsed (`apps/verses.html:177-192, 260-265`). Evidence: `audits/evidence/p3/verses/misc.json`.
- **OK-VERSES-3 — Token-clean colours, the person's accent throughout, big targets, no layout shift** (info). 0 hex or colour literals; `--accent` differs per profile (Eli #4F5D8C, Elizabeth #8A6A4B, Ezra #137F77, Kiara #B4861B) and reaches the Show fill and the page wash; the pill pairs an avatar or emoji with the name, so identity does not rely on hue. No target under 44 px, kid buttons 84 px; CLS 0 cold and warm (Chromium). The kiosk reached by URL writes nothing (`apps/verses.html:240, 292`). Evidence: `audits/evidence/p3/_compliance/verses.json`; `audits/evidence/p3/verses/glance-accent.json`; `audits/evidence/p3/verses/kid-flow.json`; `audits/evidence/p3/verses/tv-standalone.png`.

### Checked and not a bug

- **Two odd memory-verse references, "Psalm 1:1-7" and "Jeremiah 1:15"** (investigator: low bug; refuted 2 of 3). Skeptic 1 confirmed the display. Skeptics 2 and 3 refuted it: both published F260 plans print exactly these references ("Memorize: Psalm 1:1-7 … Proverbs 29:18 Jeremiah 1:15"; `audits/evidence/p3/verses/verify-odd-references-2.json`, `audits/evidence/p3/verses/verify-odd-references-3.json`), and the app copies the plan as intended (`apps/verses.html:177`; `index.html:986`). Psalm 1 having six verses is an upstream typo; Jeremiah 1:15 is a real verse, and "meant 1:5" is a guess. Changing either would be the household's own departure from the printed plan, and would need five copies changed together: `apps/f260.html:806, 812`, `apps/verses.html:183-184`, `apps/kidverse.html:205, 211`, `index.html:1005, 1011`, `worker/src/chat.js:74, 80`.
- **Investigator's own check (not sent to skeptics), iPad only: a double tap on a rating does nothing more.** On the iPad the three ratings sit in a row, and a second tap on Got it neither skips nor reveals the next card (`audits/evidence/p3/verses/double-tap-ipad.png`). The critic's run found the same for all three ratings on the iPad (`audits/evidence/p3/verses/critic-doubletap.json`). On the iPhone it does do something more: the next card is revealed, filed as P3-VERSES-12.

### Unresolved — needs a device or more evidence

No verified finding is unresolved. Items that need a device are under "Not verified".

## 5. Visual fidelity

### Rubric scores

| Dimension | Investigator | Checker | Final | Provisional? | Reason | Evidence |
|---|---|---|---|---|---|---|
| Typography | 6 | 5 | **5** | Yes (fallback fonts in the rig) | The serif reference is handsome and scales (38.7 px phone, 56 px iPad, 64 px kid). But all adult UI text is ui-rounded, the display face is 400 for the reference and bold for the done/empty headings, and the 14 px labels are off Dynamic Type. The 12 px kicker and chips are Caption 1, on the scale (checker's correction). Level with the shell's 5. | `audits/evidence/p3/verses/visual-hearth-iphone.png`, `audits/screens/verses/trainer-typical-iphone-pwa-light.png`, `audits/screens/verses/done-typical-iphone-pwa-light.png` |
| Color & palette | 7 | 5 | **5** (judge) | No | Not yet and Almost are real soft fill / deep ink pairs, and dark mode flips Show and Got it to pastel with dark ink. But the hues are Hearth's low-chroma earth tones, not vibrant pastels; in light mode Show is a deep navy fill and Got it mid-olive, both with white text, Got it failing AA at 4.4:1 on the most-tapped control; the dark Not yet and Almost fills go muddy. | `audits/screens/verses/kid-revealed-typical-iphone-pwa-light.png`, `audits/evidence/p3/verses/visual-hearth-iphone.png`, `audits/evidence/p3/verses/visual-midnight-iphone.png`, `audits/screens/verses/trainer-typical-ipad-landscape-dark.png` |
| Layout & spacing | 6 | 6 | **6** | No | 16 px phone gutter and the 4/8 rhythm hold, all tokenised. But an empty band of about 100-120 px in the card; the kid iPad is about 55-60% blank below a 380 px card; landscape and desktop put a 690 px column in 1180-1440 px. The adult iPad in portrait uses about 84% of the width (checker's correction). | `audits/screens/verses/trainer-typical-iphone-pwa-light.png`, `audits/screens/verses/kid-typical-ipad-portrait-light.png`, `audits/screens/verses/revealed-overflow-ipad-landscape-light.png` |
| Shape, depth & material | 6 | 5 | **5** | Yes (real blur not visible in the rig) | Large radii and soft shadows. But the content card is glass-strong (sheen visible, blur from code), and the pill buttons are not concentric with the card (r 28 at a 25 px inset in R 36; concentric is 11). The faults the shell scored 5 for. | `audits/evidence/p3/verses/visual-hearth-iphone.png`, `audits/screens/verses/kid-offline-ipad-portrait-dark.png`, `audits/screens/verses/trainer-typical-ipad-portrait-light.png` |
| Iconography | 6 | 6 | **6** | No | Clean, round-capped line icons (speaker, eye, rotate, minus, check, bars, list, clock). Hand-drawn inline paths with mixed strokes (1.75 / 2 / 2.25, from code; not visible at 1×) and one filled star; not one icon set. | `audits/screens/verses/revealed-typical-iphone-pwa-light.png`, `audits/evidence/p3/verses/kid-flow-revealed-iphone-pwa.png`, `audits/screens/verses/done-typical-iphone-pwa-light.png` |
| Motion & feedback | 5 | 4 | **4** | Yes (motion not visible in stills) | Press spring, veil fade and bar animation exist in code. But the next verse replaces the rated one instantly, the only feedback is a toast that covers content, there is no undo, and the Not yet toast states the wrong interval. Above the shell's 3 (no confirm() here). | `audits/screens/verses/rated-typical-iphone-pwa-light.png`, `audits/evidence/p3/verses/toast-not-yet-box5-iphone.png`, `audits/screens/verses/rated-typical-desktop-dark.png` |
| Dark mode | 7 | 6 | **6** | No | Tokens follow every theme and all text passes (minimum 5.1). But the Not yet and Almost fills are dark browns that nearly merge with the card, the low-box bars are barely visible, and the box chips are dark green on dark. | `audits/evidence/p3/verses/visual-midnight-iphone.png`, `audits/evidence/p3/verses/visual-forest-iphone.png`, `audits/screens/verses/kid-revealed-typical-ipad-landscape-dark.png`, `audits/screens/verses/trainer-typical-ipad-landscape-dark.png` |
| Native feel | 5 | 5 | **5** | Yes (touch press states need a device) | No confirm(), no layout shift, `:focus-visible` only. But loading is a blank page with an empty pill, a stalled load shows a confident false empty state, toasts cover content, and offline looks the same as online. | `audits/screens/verses/trainer-loading-iphone-pwa-light.png`, `audits/screens/verses/trainer-stalled-loading-iphone-pwa-light.png`, `audits/screens/verses/trainer-offline-iphone-pwa-light.png` |
| Glanceability | 4 | 4 | **4** | No | Only the 56 px reference carries across a room on the iPad (about 1.5 m); stats read to about 0.8 m, labels and chips at arm's length, and nothing reaches Home. | `audits/screens/verses/trainer-typical-ipad-portrait-light.png`, `audits/screens/verses/kid-typical-ipad-portrait-light.png`, `audits/screens/verses/overdue-typical-ipad-portrait-light.png` |
| Ease of use | 5 | 5 | **5** | No | One card and two taps a verse. But 8 taps from Home for a normal day, no undo, Show reveals nothing on most cards, Read aloud is gone after Show, "Practise one anyway" and "all done" mislead, and a pre-reader can tap by icon and colour but never sees or hears the verse. | `audits/evidence/p3/verses/practise-anyway-queue-iphone.png`, `audits/evidence/p3/verses/kid-flow-revealed-iphone-pwa.png`, `audits/screens/verses/nothing-due-typical-iphone-pwa-light.png`, `audits/evidence/p3/verses/vischeck-readaloud-after-show.png` |
| Delight | 5 | 5 | **5** | No | Spot art in the empty state, the gold star and a tidy histogram. The done card says only "3 reviews today", nothing celebrates a streak, there are no practice modes, and the kid done screen is a star and two sentences. | `audits/screens/verses/done-typical-iphone-pwa-light.png`, `audits/screens/verses/trainer-empty-iphone-pwa-light.png`, `audits/screens/verses/kid-done-typical-iphone-pwa-light.png` |

Average: (5 + 5 + 6 + 5 + 6 + 4 + 6 + 5 + 4 + 5 + 5) / 11 = 56 / 11 = **5.1**. The investigator's average was 5.6; the shell's in Phase 2 was 4.9.

**How the scores were checked.**
- **What the checker opened:** 41 screenshots: all 19 the investigator cited, 20 more captures across iPad portrait and landscape, iPhone PWA and Safari and desktop, light and dark, in the empty, typical, overflow, loading, stalled, offline, overdue and kid states, and the contact sheets `audits/screens/_sheets/verses--trainer.jpg` and `audits/screens/_sheets/verses--kid.jpg`. It also ran `audits/tools/phase3/verses/vischeck-readaloud.mjs`.
- **Agreed:** 6 of 11 dimensions (Layout, Iconography, Native feel, Glanceability, Ease of use, Delight).
- **Adjusted by one point:** 4 dimensions.
  - **Typography, 6 → 5:** body text ui-rounded everywhere, inconsistent display weights, 14 px off-scale labels; calibrated to the shell's 5 for the same deviations.
  - **Shape, depth & material, 6 → 5:** glass on the content card and non-concentric buttons, the faults the shell was scored 5 for.
  - **Motion & feedback, 5 → 4:** a toast is the only feedback, it covers content and misstates the interval, and there is no undo.
  - **Dark mode, 7 → 6:** the house rule says pastels never go muddy in dark; the rating fills, low bars and chips do.
- **Judge:** ruled on 1 dimension. **Color & palette, 7 → 5** (a 2-point gap): the screenshots support the investigator's observations but not a 7. The hues are the same Hearth earth tones the shell scored 4; both light-mode primaries break the fill/ink rule, one failing AA; the dark rating fills go muddy. One notch above the shell for the real fill/ink rating pairs and the correct dark-mode flip on the primaries.
- **Claims the checker corrected:** 12 px is Caption 1 (on the iOS scale); the adult iPad in portrait is not phone-width; the filled star shows on the done screen, and stroke-width differences are code-only; the kid flow is completable by icon and colour, so "cannot use" is too strong ("cannot practise" stands).

### Deviations from the house style

Each is marked with the visual checker's verdict; corrected ones are stated as corrected.

| Area | Deviation | Checker | Evidence |
|---|---|---|---|
| Type scale | 14 px for the pill, stat labels, box subtitles and "when" labels (Subheadline is 15, Footnote 13). The reference is a vw clamp (38.7 px phone, 56 px iPad, 64 px kid), not a Large Title step. | Partly: corrected to drop the 12 px claim (12 px is Caption 1) | `audits/evidence/p3/verses/visual.json`; `apps/verses.html:38-39, 84, 89-90` |
| Font stacks | ui-rounded for all adult UI text (kicker, pill, stat labels, queue rows), inherited from design.css; the house style keeps rounded for numerals and kid mode | Supported (computed; not visible with rig fallback fonts) | `audits/evidence/p3/verses/visual.json` |
| Display weight (from the checker) | The display face at 400 for the reference and bold for the done/empty headings | Checker's addition (VIS-VERSES-5) | `apps/verses.html:38, 64` |
| Palette and contrast | "Got it" white on olive 4.4:1 in Hearth; light-mode Show is also a deep fill with white text | Supported, with the Show addition (VIS-VERSES-3, VIS-VERSES-4) | `audits/evidence/p3/verses/visual-hearth-iphone.png`; `apps/verses.html:56-59` |
| Semantic colours | Terra / gold / olive as red / amber / green, each with an icon: clear. But they are Hearth earth tones, not the pastel family, and light Got it is white on a saturated fill | Partly | `audits/screens/verses/kid-revealed-typical-iphone-pwa-light.png` |
| Glass on content | `#trainer` and `#done` are `.glass-strong` with a live backdrop blur; the guard covers `.card.glass` only | Supported (sheen visible; blur code-only) | `apps/verses.html:103, 119`; `apps/design.css:400` |
| Concentric corners | Rating buttons r 28 at a 25 px inset in a card of R 36; concentric would be 11 | Supported | `audits/evidence/p3/verses/visual.json` (`radiiOff`) |
| Icon set | Inline hand-drawn SVGs, strokes 1.75 / 2 / 2.25, one filled star; not one set shared with the shell's sprite | Partly (star visible; strokes code-only) | `apps/verses.html:109-115, 120, 133, 143-145` |
| Spacing and layout | A 78-110 px empty band; kid screens, iPad landscape and desktop use a phone-width column | Partly: corrected, the adult iPad in portrait uses about 690 of 820 px | `audits/evidence/p3/verses/layout.json`; `audits/screens/verses/kid-typical-ipad-portrait-light.png` |
| Tap targets | None under 44 px; kid buttons 84 px | Supported (about 83 px in the capture) | `audits/evidence/p3/verses/kid-flow.json` |
| Motion | No transition when the next verse replaces the rated one; an infinite 1.1 s pulse on the speaker while speaking; no undo | Partly (no undo visible; transitions and pulse code-only) | `audits/evidence/p3/verses/layout.json`; `apps/verses.html:54-55` |
| Dark surfaces | Surfaces follow the tokens; the rating fills, low-box bars and box chips go dim or muddy | Partly: widened to the bars and chips (VIS-VERSES-7) | `audits/evidence/p3/verses/visual.json`; `audits/evidence/p3/verses/visual-midnight-iphone.png` |
| Histogram (from the checker) | Tint follows the count, not the box | Checker's addition (VIS-VERSES-6) | `audits/screens/verses/revealed-overflow-ipad-landscape-light.png` |
| Loading | A blank page with an empty pill instead of a skeleton | Supported | `audits/screens/verses/trainer-loading-iphone-pwa-light.png` |

### Web tells

| Tell | Status | Evidence |
|---|---|---|
| Grey tap highlight | Absent | The app sets none; design.css sets `-webkit-tap-highlight-color: transparent` (`apps/design.css:302, 312`). Confirm on a device. |
| Long-press callout or selection on chrome | Partly | Buttons are `user-select: none` (`glance-accent.json` `tells.userSelectBtn`), but the `#who` pill and `#kick` kicker are selectable text. Needs a device to see the callout. |
| Default form controls | n/a | No inputs; buttons only (`apps/verses.html:109-123`) |
| Focus rings on touch | Absent | `:focus-visible` only (`apps/design.css:314`) |
| Blue underlined links | Absent | No links in the app |
| White flash on load | Needs a device | `hub.js` loads at the end of body (`apps/verses.html:149`) and applies the theme synchronously; not measurable in the rig |
| Rubber-band overscroll mismatch | Needs a device | Explicit `var(--bg)` with a fixed wash (`apps/verses.html:14-19`) |
| Tap delays | Absent | `width=device-width` viewport (`apps/verses.html:5`), `touch-action: manipulation` (`apps/design.css:303`); real touch not tested |
| Visible scrollbars on chrome | Absent | No inner scrollers; the document scrolls |
| Layout shift as data loads | Absent | CLS 0 cold and warm (`audits/evidence/p3/verses/glance-accent.json`, Chromium) |
| Spinners vs skeletons | Present | Neither: a blank page until render (`audits/screens/verses/trainer-loading-iphone-pwa-light.png`) |
| `alert()` / `confirm()` / `prompt()` | Absent | `audits/evidence/p3/_compliance/verses.json` (`bypass` all 0) |

## 6. Platform compliance

**Data through hub.js.**
- Everything goes through hub.js. The app's own person scope holds `log` and `summary`; the person's `f260` scope is read and written through `hub.use('f260','person')`, and the family `kidverse` week is read through `hub.use('kidverse','family')` (`apps/verses.html:197, 213-217, 243, 298`).
- **Bypasses: 0.** localStorage, sessionStorage, IndexedDB, fetch, XHR and native dialogs: NOT FOUND IN CODE (`audits/evidence/p3/_compliance/verses.json`, `bypass`). The only platform API is `speechSynthesis` (`apps/verses.html:248-282`).
- **Design caveat.** Verses writes another app's whole-map row, `f260.recall`, and F260 writes it too with a different shape. That shared row is the source of P3-VERSES-01 and part of P3-VERSES-02.
- **Not used:** `hub.onSync`, so there is no sync status in the app (the P2 Sync UX pointer).

**design.css tokens.** The `compliance.mjs` hits were reviewed by hand; the corrected counts:

| Category | Raw hits | Corrected | Notes |
|---|---|---|---|
| Hardcoded colours | 0 hex, 0 rgb/hsl, 0 named; 2 `colorDerived` | **0** | Both are `color-mix()` over tokens (`apps/verses.html:16-18, 82`) |
| Font sizes | 3 | **3** | `16px` on the avatar (`apps/verses.html:28`); `clamp(34px, 9vw, 56px)` (`:38`); `clamp(40px, 11vw, 64px)` (`:39`) |
| Radii | 1 | **0** | `var(--r-sm) var(--r-sm) 0 0` (`apps/verses.html:82`) is tokens plus 0 |
| Spacing | 3 | **0** | `0 auto`, `0 auto var(--sp-2)`, `var(--sp-2) 0` (`apps/verses.html:23, 69, 86`) |
| Shadows | 0 | **0** | |
| Durations | 1 | **1** | `pulse 1.1s` (`apps/verses.html:54`) |
| z-index | 0 | **0** | |
| Other px dimensions (not counted by the script) | n/a | **about 13** | `min-height` 448/520/380 (`apps/verses.html:33-35`); `blur(9px)` (`:44`); `64px` ×3 (`:51, 67, 68`); `200px` (`:69`); bar sizes 72/68/4 px (`:81-82`); `28px` (`:28, 94`); the 560 px breakpoint (`:35, 49`) |
| Undefined tokens | 0 | **0** | 118 token references across 52 tokens |
| Inline styles / JS colour writes | 0 / 0 | **0** | One inline custom property per bar, `--p` (`apps/verses.html:346`), sizes only |

**Per-profile accent.** `--accent` is set per profile by hub.js (`apps/hub.js:80`) and reaches the app: Eli #4F5D8C, Elizabeth #8A6A4B, Ezra #137F77, Kiara #B4861B (`audits/evidence/p3/verses/glance-accent.json`). It paints the Show fill (through `--accent-deep`) and the page wash (`apps/verses.html:18`). The rating buttons override it on purpose (`apps/verses.html:56-58`), so Got it is olive for everyone.

**Dark mode.**
- No `prefers-color-scheme`, `[data-scheme]` or `[data-theme]` selectors in the app; it is fully token-driven, so all five palettes follow.
- Rendered contrast of all 89 text items per theme (p10): Hearth 4.4 (fails on Got it), Parchment 5.38, Frost 4.96, Midnight 5.29, Forest 5.1 (`audits/evidence/p3/verses/visual.json`).
- The dark rating fills and low-box bars go muddy (VIS-VERSES-7).
- `prefers-reduced-motion` is honoured (`apps/verses.html:96`). `prefers-reduced-transparency` and `prefers-contrast`: NOT FOUND IN CODE.

## 7. Improvements

Ratio = delight ÷ effort, with S = 1, M = 2, L = 3. None adds a reward or routine system (Verses' "no new stars" is kept), and none touches F260's or Prayer's layout or ids; the F260 change is one line of its script.

**Polish**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Keep the Leitner fields when F260 practises a verse: write `{...recall[id], s, t}` at `apps/f260.html:1915`, or apply the same box rule (the same fix as P3-F260-01's) | 4 | S | 4.0 | P3-VERSES-01 (= P3-F260-01); `audits/evidence/p3/verses/f260-practice-wipes-1-0.json` |
| 2 | Undo the last rating: keep the previous row for about 5 s and put an Undo action on the toast | 4 | S | 4.0 | UX-VERSES-2; `apps/verses.html:294-304` |
| 3 | Say the real next review in the toast ("again in 7 days"; "stays in box 5" at the top box) | 3 | S | 3.0 | P3-VERSES-05; `audits/evidence/p3/verses/toast-not-yet.json` |
| 4 | Hold the rating buttons behind a skeleton card until the first pull of verses / f260 / kidverse lands, and never write the summary before it | 3 | S | 3.0 | P3-VERSES-03, P3-VERSES-07, UX-VERSES-5 |
| 5 | Roll over at midnight: re-render on `visibilitychange` and on a minute tick when the day key changes | 3 | S | 3.0 | P3-VERSES-04; `audits/evidence/p3/verses/midnight.json` |
| 6 | Keep Read aloud after Show (move `#say` out of `#act-show`) so the revealed text can be heard | 3 | S | 3.0 | P3-VERSES-06; `audits/evidence/p3/verses/kid-flow.json` |
| 7 | Count a day with nothing due as kept, or say "Practise one to keep your streak" on the done card | 3 | S | 3.0 | P3-VERSES-11; `audits/evidence/p3/verses/critic-streak.json` |
| 8 | Honest copy: "Nothing due" / "No verses yet" instead of "all done", no gold star when nothing was reviewed, Practise-anyway not counted as due, a button to F260 in the empty state and "you can start reviewing it here straight away" instead of "on its review day" | 2 | S | 2.0 | UX-VERSES-4, P3-VERSES-08, GAP-VERSES-3, P3-VERSES-14 |
| 9 | Solid trainer card, concentric buttons, content height instead of a fixed `min-height`, pastel fill with deep ink for Show and Got it in light mode (fixing the 4.4:1), clearer dark rating fills | 2 | S | 2.0 | VIS-VERSES-1, -2, -3, -4, -7 |
| 10 | Plain schedule words ("every week") instead of box numbers, and one count per screen | 2 | S | 2.0 | UX-VERSES-8, UX-VERSES-9 (from the visual check) |
| 11 | Ignore taps on the card for about 400 ms after a rating, or slide the next card in, so a double tap cannot reveal the next verse | 2 | S | 2.0 | P3-VERSES-12; `audits/evidence/p3/verses/critic-doubletap.json` |
| 12 | Let Enter and Space activate a focused button; keep the Show shortcut for when nothing is focused | 1 | S | 1.0 | P3-VERSES-10 |
| 13 | `aria-hidden="true"` on `#text` until Show | 1 | S | 1.0 | P3-VERSES-13; `audits/evidence/p3/verses/critic-veiled-a11y.json` |

**Missing features**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | A Verses card on Home that reads the existing `verses.summary` ("3 verses due · 13-day streak") with a one-tap start: 1 tap plus 2 per verse | 4 | S | 4.0 | UX-VERSES-3; GAP-HOME-2; `audits/evidence/p3/verses/taps.json` |
| 2 | Show the next interval on each rating button ("Not yet · tomorrow", "Almost · 4 days", "Got it · 2 weeks"), as Anki does | 3 | S | 3.0 | GAP-VERSES-2 |
| 3 | A kid mode a pre-reader can do: speak Kid Verse's own paraphrase for the week (`VERSES[].words`) and show that week's scene art, with picture-only prompts; no new rewards | 5 | M | 2.5 | UX-VERSES-1; `apps/kidverse.html:188` |
| 4 | Per-verse rows (`recall:<id>`, `log:<day>`) so two devices never erase each other's reviews; F260 reads the same map (`apps/f260.html:893, 1363`), so both apps change together | 4 | M | 2.0 | P3-VERSES-02; `audits/evidence/p3/verses/two-devices-A.json` |
| 5 | Verse text and hints inside Verses: paste or edit the text (writing `f260.verses` as F260 does) and a first-letter hint before Show | 4 | M | 2.0 | GAP-VERSES-1; `audits/evidence/p3/verses/texts-count.json` |
| 6 | Choose a verse to practise by tapping any row in Due today or Coming up | 3 | M | 1.5 | `apps/verses.html:366-371` |

**New ideas**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Record yourself reciting and play it back, as Remember Me does | 3 | M | 1.5 | https://remem.me/ |
| 2 | An evening "3 verses to review" push, a per-person toggle using the existing push jobs and the summary row | 3 | M | 1.5 | CLAUDE.md Push; `apps/verses.html:239-245` |
| 3 | Practice modes on verses that have text: word scramble, fill-in-the-gaps, type the first letters | 4 | L | 1.3 | https://remem.me/ |

## App-specific checks

| Check | Result | Evidence |
|---|---|---|
| Leitner box moves for Got it / Almost / Not yet | **PASS.** All 9 real-UI ratings: box +1 (max 5), held, −1 (min 1) | `audits/evidence/p3/verses/leitner.json` |
| Due dates 1/2/4/7/14 days | **PASS.** due = today + the new box's interval; last = today | `audits/evidence/p3/verses/leitner.json` |
| Due-today queue order | **PASS**: never reviewed first, then oldest due, then plan order. "Practise one anyway" wrongly shows as due (P3-VERSES-08) | `audits/evidence/p3/verses/leitner.json`; `audits/evidence/p3/verses/misc.json` |
| Streaks and reviewedToday | **FAIL** (P3-VERSES-11, medium). Per-verse streak (+1 / held / 0), the day streak on review days (13 → 14) and summary `reviewedToday 9` are correct. But the day streak resets after a day with nothing due, while the app says "come back tomorrow" and "keep it going today". The log is also lost by a first-open rating (P3-VERSES-03) and undercounted by two devices (P3-VERSES-02) | `audits/evidence/p3/verses/leitner.json`; `audits/evidence/p3/verses/critic-streak.json`; `audits/screens/verses/nothing-due-typical-ipad-portrait-light.png`; `audits/evidence/p3/verses/first-open-log-offline.json` |
| Midnight rollover while open | **FAIL** (P3-VERSES-04): "All done for today" and "Come back tomorrow!" at 00:06 with 9 and 2 due | `audits/evidence/p3/verses/midnight.json` |
| DST, 2026-11-01 and 2027-03-14 | **PASS**: all due dates and labels correct | `audits/evidence/p3/verses/dst-tz-dst.json` |
| A device in another time zone | **FAIL, low** (P3-VERSES-09): London dates the review Wednesday; New York does not count it today, then skips the kid's verse | `audits/evidence/p3/verses/dst-tz-tz.json` |
| `f260.recall` shared with F260's practice dialog | **FAIL, critical** (P3-VERSES-01): F260 replaces the entry with `{s,t}`; the verse becomes box 1, "never reviewed" | `audits/evidence/p3/verses/f260-practice-wipes-1-0.json` |
| Two devices reviewing (whole-map last-write-wins) | **FAIL, critical** (P3-VERSES-02): online, 1 of 2 phone ratings lost; offline, 3 of 3; the day's count overwritten | `audits/evidence/p3/verses/two-devices-A.json`; `audits/evidence/p3/verses/two-devices-B.json` |
| `verses.summary` row | Written correctly after ratings; all zeros during a stalled load (P3-VERSES-07); nothing reads it (GAP-HOME-2) | `audits/evidence/p3/verses/leitner.json`; `audits/evidence/p3/verses/stalled-load-adult.json` |
| Kid flow: only the family week's two, big buttons, pre-reader usable | Week-38 pair only and 84 px buttons: **PASS**. Pre-reader: **FAIL** (UX-VERSES-1). Cold device: shows week 1 (P3-VERSES-03). With no family `week` row, kids train week 1 with no notice (`apps/verses.html:208, 217`; from code, not run): the Verses side of lead `audits/01-leads.md:286` | `audits/evidence/p3/verses/kid-flow.json`; `audits/evidence/p3/verses/stalled-load-kid.json` |
| Kid "Practise again" | **Info.** It re-rates and re-promotes the week's two on the same day (boxes 2 → 3, the day's log at 4 after two rounds) and posts the feed line "Ezra reviewed 2 memory verses" a second time (investigator run). No schedule effect for kids, because their queue ignores due dates (`apps/verses.html:228`); the extra feed line is a log entry, not household data | `audits/evidence/p3/verses/kid-flow.json` (`recallAfterAgain`, `logAfterAgain`, `feed`) |
| Memory-verse references | All 104 match F260's plan and the published F260 plan; two upstream oddities are not an app defect (Checked and not a bug) | `audits/evidence/p3/verses/misc.json`; `audits/evidence/p3/verses/verify-odd-references-3.json` |
| Empty state (no memorised verses) | Art and copy shown, but the pill says "all done" (UX-VERSES-4), there is no button to F260 (GAP-VERSES-3), and "on its review day" is wrong: the verse is due at once (P3-VERSES-14); a guest sees the same | `audits/screens/verses/trainer-empty-iphone-pwa-light.png`; `audits/evidence/p3/verses/guest-iphone.png` |
| Kiosk read-only | **PASS.** Not in `visibleTo`; by URL the TV sees the empty state with "Downstairs TV · all done" and writes nothing (`apps/verses.html:240, 292`) | `audits/evidence/p3/verses/misc.json`; `audits/evidence/p3/verses/tv-standalone.png` |

## Leads from 01-leads.md

| Lead | Outcome | Where it went |
|---|---|---|
| Rating a verse in F260 wipes its Verses trainer progress (`audits/01-leads.md:88`; also in the brief) | Confirmed; the same defect as P3-F260-01 | P3-VERSES-01 |
| `f260.recall` is one whole-map row under last-write-wins: two devices reviewing lose reviews (the brief) | Confirmed; `verses.log` loses counts too | P3-VERSES-02 |
| Verses shows a false empty state on a slow first load and writes a zero summary (`audits/01-leads.md:262`) | Confirmed and widened: 4 s per request is enough; a kid on a cold device rates week 1 and replaces the schedule | P3-VERSES-07, P3-VERSES-03 |
| Guests … Verses has no guest handling, so a guest sees its empty state (`audits/01-leads.md:266`, Verses part) | Confirmed; benign apart from the copy ("Grandma Jo · all done") | UX-VERSES-4 |
| The kid flow in Verses assumes the child can read (`audits/01-leads.md:280`) | Confirmed | UX-VERSES-1 |
| "Practise one anyway" counts the practice verse as due (`audits/01-leads.md:282`) | Confirmed (display only; the summary stays correct) | P3-VERSES-08 |
| The Verses pill says "all done" when nothing was done; gold star on Nothing due (`audits/01-leads.md:284`) | Confirmed | UX-VERSES-4 |
| Loading shows a blank page in Verses (`audits/01-leads.md:288`, Verses part) | Confirmed | UX-VERSES-5 |
| Offline is invisible (`audits/01-leads.md:290`, Verses part) | Confirmed; Phase 2 owns the mechanism | P2 Sync UX pointer |
| The trainer card leaves a large empty band before Show (`audits/01-leads.md:292`) | Widened: on iPad and desktop the 109 px band stays after Show | VIS-VERSES-1 |
| Toasts cover content and cannot be dismissed (`audits/01-leads.md:302`, Verses part) | Confirmed | UX-VERSES-6 |
| `apps/verses.html:305` doubles names in feed lines (`audits/02-shell.md:467`, code only in Phase 2) | Confirmed at runtime: stored text "Ezra reviewed 2 memory verses" with the name returned separately | P2-HOME-06 pointer |
| With no family week set, Kid Verse silently shows week 1 (`audits/01-leads.md:286`) | Same fallback in Verses' kid mode (from code: `apps/verses.html:208, 217`) | Kid-flow check |
| Kid Verse-only leads in the same section | Not checked here | Kid Verse report |

## Not verified

- Real speech output and voice choice: the rig stubs `speechSynthesis`, and Playwright WebKit on Windows has none, so `pickVoice` (`apps/verses.html:250-257`) is untested.
- True Liquid Glass and backdrop rendering, and SF Pro / SF Pro Rounded / New York on iOS; the rig uses fallback fonts, so Typography and Shape are provisional.
- Real touch: press states, the long-press callout and selection on the pill and kicker, tap delay, rubber-band overscroll.
- White flash on load in dark themes.
- Reduce Motion inside Verses specifically (P2-STAB-01 covers the whole hub).
- How often the first-pull window of P3-VERSES-03 is hit on real cellular networks.
- P3-VERSES-02 scenario B was re-run by one skeptic only; the streak-break variant (two writes on different days) is argued from code.
- P3-VERSES-01 via F260's "Not yet": not run in this report, but reproduced by P3-F260-01's skeptic 2 (`audits/03-apps/f260.md:178`; `audits/evidence/p3/f260/verify-recall-practice-wipes-verses-box-2.json`): 12-1 went from box 5 to `{s:"not", t}` and Verses showed it as Box 1, due today.
- The wider P3-VERSES-02 / P2-SYNC-01 window while F260's journal is unlocked (`apps/f260.html:2089`) is argued from code, not run.
- P3-VERSES-12 on a real iPhone: how iOS delivers two taps 90-250 ms apart. WebKit touch emulation fires both, and nothing in the code ignores the second.
- P3-VERSES-13 with VoiceOver on a real device (the swipe order). Both WebKit's snapshot and Chromium's own accessibility tree expose the text.
- The kids' week-1 fallback with no family `week` row: from code only.
- P3-TALLY-05 in Verses (by code; not run): `verses|person` is not a shell channel (`index.html:457-458`), so a queued `verses.log` write waits until Verses is reopened on that device, and whole-row last-write-wins can then discard it (P3-VERSES-02). `f260.recall` goes through the shell's `f260|person` channel.
- P2-SYNC-18, P2-PROF-02, P2-PROF-14, P2-PROF-19 and P2-STAB-01 in Verses: inherited from Phase 2, not re-run.
- Apple's reading-goals page (the fetch returned no body); Anki's Undo and the "Verses" app are from general knowledge.
- Behaviour with the household's real data volumes; only the seed was used.

## Scripts and evidence

**Investigator** (`audits/tools/phase3/verses/`): `_lib.mjs` (shared helpers), `probe.mjs`, `leitner.mjs`, `f260-practice-wipes.mjs`, `two-devices.mjs`, `first-open-log.mjs`, `stalled-load.mjs`, `midnight.mjs`, `dst-tz.mjs`, `kid-flow.mjs`, `taps.mjs`, `visual.mjs`, `glance-accent.mjs`, `layout.mjs`, `misc.mjs`, `texts-count.mjs` and `toast-not-yet.mjs`. Platform counts: `node audits/tools/phase3/compliance.mjs verses` → `audits/evidence/p3/_compliance/verses.json`.

**Skeptics** (`audits/tools/phase3/verses/`):

| Finding | Scripts |
|---|---|
| P3-VERSES-01 | `verify-f260-practice-wipes-leitner-1.mjs`, `verify-f260-practice-wipes-leitner-2.mjs` |
| P3-VERSES-02 | `verify-recall-log-whole-map-lww-1.mjs`, `verify-recall-log-whole-map-lww-2.mjs` |
| P3-VERSES-03 | `verify-first-open-wipes-log-1.mjs`, `verify-first-open-wipes-log-1-kid.mjs`, `verify-first-open-wipes-log-2.mjs` |
| P3-VERSES-04 | `verify-midnight-stale-all-done-1.mjs`, `verify-midnight-stale-all-done-2.mjs` |
| P3-VERSES-05 | `verify-not-yet-toast-wrong-interval-1.mjs`, `verify-not-yet-toast-wrong-interval-2.mjs` |
| P3-VERSES-06 | `verify-read-aloud-gone-after-show-1.mjs`, `verify-read-aloud-gone-after-show-2.mjs` |
| P3-VERSES-07 | `verify-stalled-load-zero-summary-1.mjs`, `verify-stalled-load-zero-summary-2.mjs` |
| P3-VERSES-08 | `verify-practise-anyway-counts-as-due-1.mjs`, `verify-practise-anyway-counts-as-due-2.mjs` |
| P3-VERSES-09 | `verify-other-timezone-day-1.mjs`, `verify-other-timezone-day-2.mjs`, `verify-other-timezone-day-3.mjs` |
| P3-VERSES-10 | `verify-enter-on-read-aloud-reveals-1.mjs`, `verify-enter-on-read-aloud-reveals-2.mjs` |
| P3-VERSES-11 | `verify-critic-streak-breaks-on-nothing-due-day-1-1.mjs`, `verify-critic-streak-breaks-on-nothing-due-day-1-2.mjs` |
| P3-VERSES-12 | `verify-critic-double-tap-rating-reveals-next-card-iphone-2-1.mjs`, `verify-critic-double-tap-rating-reveals-next-card-iphone-2-2.mjs` |
| P3-VERSES-13 | `verify-critic-veiled-text-exposed-to-screen-readers-3-1.mjs`, `verify-critic-veiled-text-exposed-to-screen-readers-3-2.mjs` |
| P3-VERSES-14 | `verify-critic-empty-state-copy-review-day-wrong-4-1.mjs`, `verify-critic-empty-state-copy-review-day-wrong-4-2.mjs` |
| Refuted: odd references | `verify-odd-references-1.mjs`, `verify-odd-references-2.mjs`, `verify-odd-references-3.mjs` |

**Completeness critic** (`audits/tools/phase3/verses/`): `critic-streak.mjs` → `audits/evidence/p3/verses/critic-streak.json`, `audits/evidence/p3/verses/critic-streak-wed-iphone.png`; `critic-doubletap.mjs` → `audits/evidence/p3/verses/critic-doubletap.json`, `audits/evidence/p3/verses/critic-doubletap-got-iphone.png`; `critic-veiled-a11y.mjs` → `audits/evidence/p3/verses/critic-veiled-a11y.json`; `critic-empty-copy.mjs` → `audits/evidence/p3/verses/critic-empty-copy.json`, `audits/evidence/p3/verses/critic-empty-copy-after-iphone.png`. These are the investigation runs behind P3-VERSES-11 to -14.

**Visual checker.** `audits/tools/phase3/verses/vischeck-readaloud.mjs` → `audits/evidence/p3/verses/vischeck-readaloud.json`, `audits/evidence/p3/verses/vischeck-readaloud-after-show.png`; otherwise it re-read the investigator's JSON and opened the 41 screenshots listed in §5.

**Evidence** is in `audits/evidence/p3/verses/`:
- Investigator JSON: `leitner.json`, `f260-practice-wipes-1-0.json`, `two-devices-A.json`, `two-devices-B.json`, `first-open-log-offline.json`, `first-open-log-slow.json`, `stalled-load-adult.json`, `stalled-load-kid.json`, `midnight.json`, `dst-tz-dst.json`, `dst-tz-tz.json`, `kid-flow.json`, `taps.json`, `visual.json`, `glance-accent.json`, `layout.json`, `misc.json`, `texts-count.json`, `toast-not-yet.json`.
- PNGs at 1× CSS scale: the `f260-practice-wipes-*`, `two-devices-*`, `first-open-log-*`, `stalled-load-*`, `midnight-*`, `tz-ny-kid-ipad`, `kid-flow-*`, `visual-*`, `practise-anyway-queue-iphone`, `toast-not-yet-box5-iphone`, `guest-iphone`, `tv-standalone`, `overflow-kid-iphone` and `double-tap-ipad` images.
- Critic: the `critic-*.json` and `critic-*.png` files.
- Skeptics: the `verify-*.json` and `verify-*.png` files.

The Phase 1 captures are under `audits/screens/verses/`.
