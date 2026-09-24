# Kid Verse (`kidverse`) — Phase 3 deep dive

| | |
|---|---|
| **App code audited** | `fe6041d`, unchanged since the Phase 0 baseline. This phase changed no app code. |
| **File(s)** | `apps/kidverse.html` (683 lines). Shared code it depends on: `apps/hub.js` (500), `apps/design.css` (617), `worker/src/data.js` (72), the shell's Me → Kids' rewards (`index.html:1330-1375`) and the 12 scene SVGs in `art/story/`. Registry entry: `apps.json:11`. |
| **Date** | 2026-09-24 |
| **Inputs** | `audits/00-inventory.md` §9a "kidverse — Kid Verse" (lines 3399-3533); 240 Phase 1 captures under `audits/screens/kidverse/` and 15 contact sheets `audits/screens/_sheets/kidverse--*.jpg`; `audits/01-leads.md` "Kid Verse and Verses" (lines 256-304); Phase 2 IDs P2-SYNC-17, P2-SYNC-01, P2-SYNC-18, P2-SYNC-15, P2-PROF-02, P2-PROF-05, P2-PROF-14, P2-STAB-01, P2-STAB-07, P2-HOME-06, P2-HOME-07, P2-PWA-06, P2-PWA-13, P2-VIS-05, P2-VIS-07, P2-SEC-02, P2-CHAT-01, the unnumbered Sync UX note (`audits/02-shell.md:2910`) and UX-HOME-7. |
| **Runtime** | Local instance with the demo household (typical seed unless stated; real clock, with the seed relative to Thu 2026-09-24, unless stated), Playwright WebKit. Chromium was not needed. No production data or endpoint was touched. |
| **Reproduce** | Scripts in `audits/tools/phase3/kidverse/`, evidence in `audits/evidence/p3/kidverse/`. Run each with `node "audits/tools/phase3/kidverse/<name>.mjs"`. |

**How to read this.** Every bug, security or perf finding went to two independent skeptics. Each re-read the code and re-ran the finding with their own script; a third skeptic would have broken a tie. A defect is **CONFIRMED** only when at least two skeptics reproduced it and more confirmed it than refuted it. Refuted findings go under "Checked and not a bug", and undecided ones under "Unresolved". UX, VIS, GAP and OK items describe the design, not malfunctions, so they were not adversarially verified. A separate agent re-checked every rubric score against the screenshots, and a judge settled every gap of 2 or more points (one arose: Motion & feedback). A completeness critic then read the report against the brief, ran five more candidates, and sent them through the same two-skeptic verification; all five were confirmed and are filed as P3-KIDVERSE-10 to -14 (one of them, -14, is the former VIS-KIDVERSE-4, reclassified as a bug). Severity follows the rule at the top of `audits/02-shell.md` (lines 25-37).

## Summary

- **What it is.** The family's weekly F260 memory verse and a two-sentence story, made for the pre-readers Ezra (5) and Kiara (4): scene art, the reference in big type, a one-sentence paraphrase, read-aloud, one ★ a day for the verse, "I heard it" for the story, and a rewards card with 6 badges and a balance. Adults step the family week and see every kid's stars. The TV reads the stars mirror but cannot open the app (`apps.json:11`).
- **Confirmed defects: 14** (5 critical, 0 high, 4 medium, 5 low). None were refuted or left unresolved. Nine came from the investigator and five (P3-KIDVERSE-10 to -14) from the completeness critic, all verified 2/2. The worst is **P3-KIDVERSE-01**: one tap on Done ★ during a slow or failed first load overwrote Ezra's stars row, and the reconcile that followed left it at earned 16 → 8, badges 4 → 1 and a paid-out balance of 1 → 7. The other four criticals:
  - **P3-KIDVERSE-02:** a kid's second device holding an older copy of the row erases a verse star earned on the first device.
  - **P3-KIDVERSE-03:** on a stalled or failed first load an adult sees "Week 1", and one + sets the whole family to week 2 (38 → 2).
  - **P3-KIDVERSE-10:** "I heard it" on a kid's second device holding an older copy erases the other device's heard day from the week's story row, which the story card and the parents' F260 line "Kids: Ezra N/5" read.
  - **P3-KIDVERSE-11:** "I heard it" tapped during a stalled or failed first load replaces the week's story row with today alone.

  All five are new Kid Verse triggers of hub.js mechanisms Phase 2 proved for F260 (P2-SYNC-17, P2-SYNC-01).
- **The parent's Reset week misses stars in two cases** (both medium). Applied by Kid Verse after the ISO week has rolled over, it leaves that week's verse stars on the balance (P3-KIDVERSE-12: 418 expected, 420 kept). A story or prayed day the kid earned but Kid Verse had not yet credited is credited after the reset (P3-KIDVERSE-13: balance 4 → 3 → 5).
- **Rubric: final average 5.2 / 10** (investigator 5.8, checker 5.1). The checker lowered six dimensions by one point; the judge set Motion & feedback at 5. Iconography, Ease of use and Delight are best at 6; Dark mode is weakest at 4.
- **Biggest usability gaps.**
  - A pre-reader still needs an adult: the verse and story have identical "Read it to me" buttons, "I heard it" is explained only in text, and every toast is text that is never spoken (UX-KIDVERSE-1).
  - Done ★ is below the first screen on iPhone, iPad landscape and desktop (UX-KIDVERSE-2).
  - The day dots contradict the ★ count (P3-KIDVERSE-04).
- **Biggest visual gaps.**
  - Day letters are 2.08-2.22:1 in light palettes, badge hints are 10 px (VIS-KIDVERSE-1), and the today ring and empty dots are under 3:1 (VIS-KIDVERSE-2).
  - Done ★ and "I heard it" ask for gold in the app's own CSS but paint in the kid's own colour, teal for Ezra (P3-KIDVERSE-14, low; formerly VIS-KIDVERSE-4, reclassified as a bug).
  - The story art is a fixed pale panel on dark pages, and two scenes are dark slabs on light pages (VIS-KIDVERSE-6).
- **What works.** The parent ledger within one ISO week (cash-in and reset, including a star earned while either is in flight; the exceptions are P3-KIDVERSE-12 and -13), the one-star-per-source-per-day rule, the 14-day look-back, ISO-week and DST rollovers, 84 px kid targets and a read-aloud that stops cleanly (OK-KIDVERSE-1 to 3).
- **Best-value improvement.** Keep Done ★, "I heard it" and the week stepper disabled until both kidverse scopes have been pulled, reusing the `pulled()` check the app already has (delight 4, effort S). It closes P3-KIDVERSE-01, -03 and -11. The highest-delight addition is spoken prompts and feedback for pre-readers (delight 5, effort M).

## 1. Purpose and top jobs

Kid Verse shows the family week's memory verse and story (`apps/kidverse.html:145-178`):
- scene art (`#art`, one of 12 SVGs chosen by week, `:251-252`);
- the reference, the other reference of the week, and a paraphrase labelled as not the Bible's words (`:148-157`);
- "Read it to me" and, for kids, "Done ★" (`:158-161`);
- the kid's week of stars (`#mine`), the story card with its own "Read it to me" and "I heard it" (`:164-176`), and "My rewards" (`:177`);
- for adults, the week stepper and every kid's stars (`#grown`, `:365-377`).

| # | Job | Who | How often |
|---|---|---|---|
| 1 | Hear the verse and earn today's star: Home "Open Kid Verse" → Done ★ | Ezra, Kiara | Daily |
| 2 | Hear the week's story and tap "I heard it" | Kids, usually with a parent at bedtime | Most days |
| 3 | Step the family week (with F260, Sunday evening) | Adults | Weekly |
| 4 | Glance at the kids' stars | Adults | Daily, mostly on the Home Kids card; Kid Verse's own panel is secondary |

The TV board reads the family mirror `stars:<kid>` and the week row (`index.html:1047-1077`), but `tv` is not in `visibleTo` (`apps.json:11`).

## 2. Features and gaps

**References** (product knowledge; Apple's support pages returned only their navigation shell through WebFetch, so no article text is cited): Bible App for Kids (YouVersion/OneHope), Khan Academy Kids, and Apple Books Read Aloud / iOS Speak Screen with Highlight Content.

| Capability | This app | Reference | Gap |
|---|---|---|---|
| The week's verse with a child's paraphrase | Yes: 52 references and paraphrases (`apps/kidverse.html:187-240`) | Bible App for Kids | None |
| The week's story | A two-sentence retelling of the adults' F260 reading (`:536-589`), 12 static scenes for 52 weeks (`:251`) | Bible App for Kids: animated, interactive stories | Yes (static, repeating art) |
| Read-aloud | speechSynthesis at rate 0.85 with an English voice preference (`:280-313, 608-628`) | Books Read Aloud; Speak Screen | None for the voice itself |
| Words highlighted as they are read | NOT FOUND IN CODE | Books read-aloud; Speak Screen's Highlight Content | Yes |
| Spoken instructions and feedback | No: every toast is text (`:301, 328, 480, 484, 636, 641`) | Khan Academy Kids speaks every prompt | Yes (UX-KIDVERSE-1) |
| Earlier weeks' verses and stories | Only the family week: `VERSES[w - 1]`, `STORIES[w - 1]` (`:345, 650`) | Bible App for Kids library | Yes |
| A memory game for the verse | None for kids here (Verses is an adult trainer) | Bible App for Kids games | Yes |
| Stars and badges | One star per source per day, 6 badges, balance, parent ledger (`:323-335, 441-501`) | Khan Kids rewards | None. No new reward system is proposed (the household declined one). |
| The family week follows the calendar, and changing it tells anyone | No: ±1 stepper, no feed line (`:336-340`) | n/a (household-specific) | Yes (GAP-KIDVERSE-1) |
| Kiosk read-only, kids-only earning | Yes (`:325-326, 633-634`) | n/a | None |

## 3. Ease of use

Taps measured with real clicks in `audits/tools/phase3/kidverse/taps.mjs` (evidence `audits/evidence/p3/kidverse/taps.json`), iphone-pwa unless stated:

| Job | Profile | Path | Taps | Target ≤ 2 for the most frequent | Met? |
|---|---|---|---|---|---|
| Earn today's verse star (the most frequent job) | Ezra, iPhone | Home "Open Kid Verse" → scroll → Done ★ | 2 + 1 scroll | ≤ 2 | Yes (the scroll is needed: `doneAboveFold: false`) |
| Earn today's verse star | Ezra, iPad portrait | Home "Open Kid Verse" → Done ★ | 2 | ≤ 2 | Yes (no scroll) |
| Earn today's verse star via the Apps tab | Ezra | Apps → Kid Verse tile → scroll → Done ★ | 3 + 1 scroll | ≤ 2 | No (the Home path meets it) |
| Hear the verse | Ezra | Home "Open Kid Verse" → Read it to me | 2 | ≤ 2 | Yes |
| Hear the story and mark it heard | Kiara | Home "Open Kid Verse" → scroll → story Read it to me → I heard it | 3 + 1 scroll | ≤ 2 | **No** |
| See the kids' stars | Mom | Home → scroll to the Kids card ("Ezra ★4 · 4 badges / Kiara ★2 · 1 badge · 7 to cash in") | 0 + 1 scroll | ≤ 2 | Yes |
| See the kids' stars in Kid Verse | Mom | Apps → Kid Verse → scroll to Kids' stars | 2 + 1 scroll | ≤ 2 | Yes |
| Step the family week +1 | Mom | Apps → Kid Verse → scroll → + (server `{week:39, by:'mom'}`) | 3 + 1 scroll | n/a (weekly) | n/a. No direct entry: undoing a jump from 38 to 2 takes 36 taps. |
| Cash in a kid's stars | Mom | Me → scroll → Cash in → `confirm()` OK | 3 + 1 scroll | n/a (occasional) | n/a. A native dialog in the shell, no undo. |

- **Discoverability.**
  - Kids reach the app from a text-only Home button, "Open Kid Verse" (Phase 2 UX-HOME-7), or the Apps grid.
  - On iPhone, Done ★ only peeks in at the bottom edge, and "I heard it" is two screens down (UX-KIDVERSE-2).
  - For adults, the stepper and the Kids' stars panel sit two or more screens below the kid content (UX-KIDVERSE-10). The "Use week N" hint (`apps/kidverse.html:370`) is a good shortcut when the adult's F260 week differs.
- **Undo.**
  - Done ★ and "I heard it" are once a day by design and cannot be undone.
  - The stepper is its own undo, one week per tap.
  - After week 52 there is no wrap: + is disabled at 52 (`apps/kidverse.html:369`), so going back to week 1 for a new F260 year is 51 taps on −, unless the adult's own F260 plan is already on week 1 and offers "Use week 1" (`:370`). Mom or a guest who does not use F260 has no shortcut (GAP-KIDVERSE-1).
  - Cash in and Reset week live in the shell and use `confirm()` with no undo (`index.html:1367, 1373`).
- **Error prevention.**
  - Good: one star per source per day, the kiosk cannot award, and guests never see Me's rewards card (OK-KIDVERSE-1).
  - Missing: no write waits for the first pull (P3-KIDVERSE-01, -03, -11); guests can step the household's week (UX-KIDVERSE-3); a device's own time zone decides "today" (P3-KIDVERSE-08).
- **One-handed phone use.** Every kid control is a full-width 84 px button (`audits/evidence/p3/kidverse/visual.json` G targets). Done ★ spans 851-935 px standalone at 430×932, so it lands at the bottom edge once scrolled; "I heard it" is at 1713 px on a 2304 px page (`visual.json` P).
- **iPad glanceability at 2-3 m.** Heuristic: legible when cap height (0.7 × font size, 0.192 mm per CSS px) ≥ distance / 200 (`visual.json` K).
  - Kid reference 64 px → 8.6 mm → about 1.7 m; star count 44 px → about 1.2 m; paraphrase 34 px → about 0.9 m; story text 26 px → about 0.7 m. Adult reference 56 px → about 1.5 m.
  - On iPad portrait the reference, Done ★, the star count and "3 stars this week" are on the first screen; only the dots are cut off (checker, `audits/evidence/p3/kidverse/visual-K-kid-ipad-portrait-first-screen.png`).
  - Nothing but the reference reads at 2-3 m. This is a hands-on screen; the TV board and Home carry the glance duty.
- **Pre-reader use (Ezra, Kiara).**
  - The verse flow works by icon and position: speaker, then star. Nothing tells the child to listen first, and on iPhone the star needs a scroll.
  - The story repeats the same speaker button and label. "I heard it" is a check icon whose meaning is only in the text "Tap “I heard it” after someone reads it to you" (`apps/kidverse.html:665`).
  - Every outcome is a text toast: "You already have today’s star — come back tomorrow!", "New badge: …", "Cashed in …", "Your week starts over.", "This device cannot read aloud." (`:301, 328, 480, 484`). None is spoken.
  - The rewards card is text apart from the gold or grey badge state and the numerals 7/10/50.
  - Details in UX-KIDVERSE-1.

## 4. Issues and bugs

### Register

| ID | Severity | Defect |
|---|---|---|
| P3-KIDVERSE-01 | critical | Done ★ tapped during a slow or failed first load overwrites the kid's whole stars row; the reconcile that follows re-credits paid stars (earned 16 → 8, badges 4 → 1, balance 1 → 7) |
| P3-KIDVERSE-02 | critical | A kid's second device with an older copy of the stars row erases a verse star earned on the first device |
| P3-KIDVERSE-03 | critical | On a stalled or failed first load an adult sees "Week 1", and + writes week 2 over the family's real week (38 → 2) |
| P3-KIDVERSE-10 | critical | "I heard it" on a kid's second device with an older copy erases the other device's heard day from the week's story row |
| P3-KIDVERSE-11 | critical | "I heard it" tapped during a slow or failed first load replaces the week's story row, dropping earlier heard days |
| P3-KIDVERSE-04 | medium | The seven day dots and their "N of 7 days" label show verse days only, while ★N also counts story and prayed stars |
| P3-KIDVERSE-05 | medium | After the week stepper the verse moves, but the story card stays on the old week while its speaker reads the new week's story |
| P3-KIDVERSE-12 | medium | A Reset week that Kid Verse applies after the ISO week rolls over leaves that week's verse stars on the balance |
| P3-KIDVERSE-13 | medium | A story or prayed day not yet credited when a parent resets the week is credited after the reset |
| P3-KIDVERSE-06 | low | The kid's stars card labels the cash-in balance "all time" |
| P3-KIDVERSE-07 | low | Prayed stars are matched by display name, so a guest with a kid's name earns that kid a star |
| P3-KIDVERSE-08 | low | "Today" is each device's local date, so a device in a western time zone can add a second verse star in one household day |
| P3-KIDVERSE-09 | low (perf) | The stars row keeps every credited day forever, and every change uploads the whole row twice |
| P3-KIDVERSE-14 | low | Done ★ and "I heard it" set `--accent` to gold but paint in the kid's own colour (teal for Ezra); formerly VIS-KIDVERSE-4 |

The register is in severity order. IDs 10-14 were added after the completeness critic, so their numbers follow the original nine.

### Phase 2 defects that show up here

- **P2-SYNC-17** (critical). The same `hub.ready` window (6 s, or at once on a failed pull; `apps/hub.js:334-337`). Phase 2 proved it for F260 and left Kid Verse unrun (`audits/02-shell.md:2996`). Proven here for the stars row (P3-KIDVERSE-01), the family week row (P3-KIDVERSE-03) and the story rows (P3-KIDVERSE-11), all filed as new facets.
- **P2-SYNC-01** (critical). The whole-row last-write-wins class. Kid Verse's stars row is a new instance, filed as P3-KIDVERSE-02, and its story rows are another, filed as P3-KIDVERSE-10.
- **P2-SYNC-18** (critical). Kid Verse repaints only on `onChange` (`apps/kidverse.html:503, 519, 676`), so a missed `onChange` leaves it painting, and later writing, a stale stars row. Not re-run.
- **P2-PROF-02** (critical). On the shared iPad, an offline star followed by Switch can leave the person-scope stars row stuck in that kid's queue. Not re-run.
- **P2-PROF-14** (critical). Kid Verse's week stepper was one of the two shipped-UI chains Phase 2 used to prove future-stamped writes (`audits/02-shell.md:814`).
- **P2-STAB-01** (critical). With Reduce Motion on, the whole hub, Kid Verse included, is blank. The app's own reduced-motion handling (`apps/kidverse.html:119, 141, 317`) is correct.
- **P2-STAB-07** (medium). An open Kid Verse after midnight still shows "Done today ★", the old count and Sunday's ring. A tap stores the new day correctly (`audits/evidence/p3/kidverse/dates.json` W_openAfterMidnight, W_afterMon). Related but distinct: P3-KIDVERSE-12, where the rollover drops last week's verse days before a pending parent reset is applied.
- **P2-PROF-05** (medium). `applyLedger` never checks who wrote a ledger row (`apps/kidverse.html:442-464`), so a forged cash-in row from a kid session zeroed a sibling's stars through her own Kid Verse (`audits/02-shell.md:1275`).
- **P2-CHAT-01** (medium). Chat's `set_data` can rewrite `stars:<kid>` and the week row, although Kid Verse signed in as the kid is meant to be the only writer of the stars rows.
- **P2-PWA-06** (medium). Offline Kid Verse feed lines post late, under whoever acts next on the device.
- **P2 Sync UX, "nobody is told when a change did not sync"** (medium, unnumbered; `audits/02-shell.md:2910`). Kid Verse's facet is UX-KIDVERSE-7.
- **UX-HOME-7** (medium; Phase 2 UX item, not adversarially verified). Kid Home's way in is the text-only button "Open Kid Verse" (`index.html:909`).
- **P2-HOME-06** (low). Feed lines read "Ezra: Ezra heard this week's story" and "Ezra: Ezra read the verse ★" (`apps/kidverse.html:332, 481, 640`; `audits/evidence/p3/kidverse/star-rules.json` feedAfterEzra).
- **P2-HOME-07** (low). `setWeek` stores `{week, by, at}` only (`apps/kidverse.html:338`), so the TV's kid line never renders.
- **P2-PWA-13** (low). A star that earns a badge can post the verse line twice at a short round trip (`award()` at `:332` and `reconcile()` at `:481`, from the same click, `:505, 516`).
- **P2-VIS-05** (low). The shell's Kids card overflow. The Kid Verse panel's own overlap is VIS-KIDVERSE-5.
- **P2-VIS-07** (low; a pointer to P2-SYNC-13). Me → Kids' rewards paints once: `ledger-rules.mjs` had to open Home and then Me before Cash in was enabled, and a skeptic saw "Ezra ★0 to cash in" on a fresh device opened straight to `#me` while the mirror held 424.
- **P2-SYNC-15** (low). On a stalled load the state reads "offline" before any request failed (`award-first-pull.json` hold atTap `state:'offline'`), and the grown-ups panel shows every kid at ★0 (`audits/evidence/p3/kidverse/verify-week-stepper-stalled-overwrite-1-V1-held-9s-at-tap.png`).
- **P2-SEC-02** (low). Kid Verse's `visibleTo` (`apps.json:11`) is enforced only by the client.

### Confirmed defects

#### P3-KIDVERSE-01 — Done ★ tapped during a slow or failed first load overwrites the kid's whole stars row; reconcile then re-credits paid stars

- **Severity: critical** (skeptics: critical / critical; unchanged from the investigator's rating). This is rule (a): one tap on Done ★ in the shipped UI permanently overwrites the kid's stars row on the server, in person scope and in the family mirror, with no dev tools.
- **Exposure.** Two conditions:
  1. The first open of Kid Verse for that kid on a device whose kidverse caches are empty: a new or re-paired device, the first sign-in on the shared iPad, or cleared storage.
  2. Every first kidverse pull on that device is slow (over 6 s) or fails: the shell's own pull of both kidverse scopes (`index.html:458-459`) and the app's. A brief outage or a slow network does it. A lone failed request is not enough when the shell's pull lands (skeptic 1's single-503 arm, below).

  One tap is enough.
- **Related.** P2-SYNC-17 has the same root cause in F260. The new facet here is that `reconcile()` then re-credits stars that were already counted and paid. P3-KIDVERSE-11 is the same missing guard in `heard()`, on the story rows.

**What happens now.** `award()` writes `myStars() + 1` with no `pulled()` guard (`apps/kidverse.html:323-335`). `reconcile()` has the guard, and its comment says why: a fresh row from an empty cache "would out-date the kid's real stars (last write wins)" (`:465-469`). `hub.ready` resolves after 6 s, or at once when the pull fails (`apps/hub.js:334-337`).
- At the tap the kid sees "Ezra · Week 1", Genesis 1:27 and "No stars yet this week".
- The tap POSTs `stars` and `stars:ezra` as `{total 1, earned 1, badges 0, applied 0}`. The Worker keeps the newer stamp (`worker/src/data.js:60-62`), and `pullScope` then skips the older server rows (`apps/hub.js:295-296`).
- When the pull lands, `reconcile()` starts from `applied = {}` (`:470-478`). It re-applies the old cash-in row (floored at 0, so harmless on its own) and re-credits every story and prayed day in the 14-day look-back, including days already counted and cashed in.
- The server row ends at total 1 → 7, earned 16 → 8, badges 4 → 1 (Ten stars, Full week and Story lover gone), credited story days 5 → 3, and Monday's verse day (2026-09-21) gone from `days`. The kid gets a "New badge: First star!" toast.
- Control (no hold): earned 16 → 17, badges 4.

**Expected.** Kid Verse writes nothing, and keeps Done ★ and "I heard it" disabled, until both kidverse scopes have been pulled: the guard `reconcile()` already uses.

**Why it matters to the household.** It erases a child's earned history, badges and payout bookkeeping, and it inflates a balance a parent already paid out. Adults and the TV read the same overwritten mirror.

**Evidence.**
- Code: `apps/kidverse.html:323-335` (no guard) vs `apps/kidverse.html:465-469`; `apps/kidverse.html:441-464, 470-478`; `apps/hub.js:236, 295-296, 334-337`; `index.html:458-459`; `worker/src/data.js:60-62`.
- Run: `audits/evidence/p3/kidverse/award-first-pull.json`.
- Screenshots: `audits/evidence/p3/kidverse/award-first-pull-hold-phone-after-tap.png`, `audits/evidence/p3/kidverse/award-first-pull-fail-ipad-after.png`, `audits/evidence/p3/kidverse/verify-award-first-pull-wipes-stars-2-latency-phone-at-tap.png`, `audits/screens/kidverse/kid-stalled-loading-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/award-first-pull.mjs"` (scenarios hold | fail | control; about 1 minute). Observed:
- hold (every GET held): at tap `{ms:7011, lastPull:0, starCount:"0", who:"Ezra · Week 1"}`; POSTs `stars (total 1, earned 1, badges 0, applied 0)` at 7695 ms, then `stars (total 7, earned 8, badges 1, applied 1)` at 10174 ms; after `{total:7, earned:8, badges:1, storyCredited:3, days:{"2026-09-24":true}}`.
- fail (every GET answers 503 for 8 s): at tap `{ms:1686, state:"error"}`; after `{total:1, earned:1, badges:0}`; the iPad later showed the reconciled 7 / "8 ever" / 1 badge.
- control: after `{total:2, earned:17, badges:4}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read `apps/kidverse.html:323-335, 441-471`, `apps/hub.js:295-296, 334-337` and `index.html:459`, and ran `node "audits/tools/phase3/kidverse/verify-award-first-pull-wipes-stars-1.mjs"` (slow, fail, control) and again with the argument `outage`, each on a fresh typical instance with a newly paired phone:
  - slow (every GET delayed 9 s, tap at 6.8 s): at the tap `{ms:6819, sync:'offline', lastPull:0, who:'Ezra · Week 1', ref:'Genesis 1:27', mine:'No stars yet this week'}`. POSTs at 7617/7624 ms `{total:1, earned:1, badges:[], payouts:0, applied:0}`; after the held pull, POSTs at 9198/9215 ms `{total:7, earned:8, badges:[first], story:3}`; toast "New badge: First star!".
  - outage (every GET 503 for 4 s, tap at 1.5 s): at the tap `sync:'error', lastPull:0`; the server held `{total:1, earned:1, badges:[]}` right after; the SDK's own 30 s pull re-POSTed `{total:7, earned:8, badges:[first]}` at 30213 ms.
  - fail (a single 503 on the kidverse person GET): **not reproduced**. The shell's pull had filled the cache ("Week 38", balance 1), and the result `{total:2, earned:17, badges:4}` matched control.
  - Evidence: `audits/evidence/p3/kidverse/verify-award-first-pull-wipes-stars-1.json`, `audits/evidence/p3/kidverse/verify-award-first-pull-wipes-stars-1-outage.json`, `audits/evidence/p3/kidverse/verify-award-first-pull-wipes-stars-1-slow-phone-after-tap.png`.
- **Skeptic 2** re-read the same code plus `apps/hub.js:327-337, 350-363`, and ran `node "audits/tools/phase3/kidverse/verify-award-first-pull-wipes-stars-2.mjs"`:
  - latency (every request, GET and POST, delayed 10 s): the page painted at 6121 ms with "Ezra · Week 1"; tap at 7145 ms; POST `{total:1, earned:1, badges:[], applied:0}`. At 35 s the server's person row and mirror were `{count:1, total:1, earned:1, badges:[], payouts:0, story:0, prayed:0}`, with the reconciled write still queued.
  - blip (only the first two kidverse person GETs, the shell's and the app's, aborted): tap at 1187 ms; first POST `{total:1, earned:1}`; the 30 s poll POSTed `{total:7, earned:8, badges:[first], applied:1}`; the server ended at `{count:3, total:7, earned:8, badges:[first], payouts:1, story:3, prayed:4}`; toast "New badge: First star!".
  - control: `{total:2, earned:17, badges:4, story:5, prayed:4}`.
  - A draft that took a screenshot before tapping delayed the tap past the pull, and nothing was lost: the loss needs the tap to land before the first pull.
  - Evidence: `audits/evidence/p3/kidverse/verify-award-first-pull-wipes-stars-2.json`, `audits/evidence/p3/kidverse/verify-award-first-pull-wipes-stars-2-blip-phone-final.png`.

**Corrected claim.**
- **Narrowed trigger.** "A single 503 opens the window at once" holds only when every first kidverse pull on the device fails or stalls, the shell's included (`index.html:458-459`). When the shell's pull lands first, the cache is filled and the tap writes correctly.
- **Wider trigger.** Uniform latency on every request also reproduces it, with no GET-only hold.
- **Mechanism of the inflated balance.** The re-applied cash-in is harmless on its own (floored at 0 and applied before the credits). The balance goes 1 → 7 because story and prayed days inside the 14-day look-back that had already been counted and paid are credited again. Story credits older than 14 days and three of four badges are lost for good.

#### P3-KIDVERSE-02 — A kid's second device with an older copy of the stars row erases a verse star earned on the first device

- **Severity: critical** (skeptics: critical / critical; unchanged). This is rule (a): a verse star, part of the balance parents cash in, is silently overwritten through the shipped UI, with no toast and the sync state reading "synced".
- **Exposure.** The kid uses two devices, for example the Kitchen iPad and a parent's phone. The second device holds an older copy of the row and writes before it pulls: it is offline (car, park), or it has Kid Verse already open and acts inside its 30 s poll window (`apps/hub.js:342`). Online the window is narrow, because opening Kid Verse pulls first. Any star, story tap or reconcile on that device rewrites the whole row, and the stale write must carry the later stamp.
- **Related.** P2-SYNC-01 is the same whole-row mechanism, but names only F260 and the build guide. P3-KIDVERSE-10 is the same race on the story rows.

**What happens now.** `award()` and `reconcile()` write the whole stars object, as person row and family mirror (`apps/kidverse.html:330-331, 478`). Each row is last-write-wins on the writer's stamp (`apps/hub.js:236-239`; `worker/src/data.js:60-62`). `pulled()` checks only that the cache has been pulled once (`:467`), so any warm cache passes.
1. On the iPad Ezra taps Done ★. The server holds `days["2026-09-24"]=true`, total 2, earned 17.
2. On the phone, whose copy predates that star, Ezra taps "I heard it". `heard()` writes the story rows and calls `reconcile()` (`:631-646`), which writes the stars row built from the phone's copy.
3. The phone flushes. The server row, and the mirror, lose `days["2026-09-24"]` and read total 2 / earned 17 instead of 3 / 18.

After its next pull the iPad shows "Done ★" unpressed again, with ★4 instead of ★5. The online run inside the 30 s window gave the same result.

**Expected.** Two devices of the same kid cannot erase each other's stars, for example one row per earned star (`verse:<date>`, `story:<date>`) with totals derived from them, as the parent ledger already does, or a merge on write.

**Why it matters to the household.** A pre-reader loses a star silently: the pressed button they remember turns back into "Done ★", and the balance parents cash in is short. A star lost from an earlier day cannot be earned again.

**Evidence.**
- Code: `apps/kidverse.html:327-331, 465-478, 631-646`; `apps/hub.js:236-239, 342`; `worker/src/data.js:60-62`.
- Run: `audits/evidence/p3/kidverse/stale-device.json`: `[offline] iPad Done ★ server {total:2, earned:17, verseToday:true}`, `phone flushed server {total:2, earned:17, verseToday:false, storyCredited:6}`, `iPad after pull {done:"Done ★", doneToday:false, starCount:"4"}`; the `[online]` run gives the same.
- Screenshots: `audits/evidence/p3/kidverse/stale-device-offline-ipad-after-pull.png`, `audits/evidence/p3/kidverse/verify-stale-device-erases-star-1-A-ipad-after-pull.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/stale-device.mjs"` (offline | online; about 25 s). It prints the server row after each step and the iPad's UI after its next pull.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read `apps/kidverse.html:265-275, 322-334, 465-484, 631-645`, `apps/hub.js:236-239, 274-276, 293-298` and `worker/src/data.js:39-64`, and ran `node "audits/tools/phase3/kidverse/verify-stale-device-erases-star-1.mjs"` (typical, real clock, Ezra on a second iphone-pwa and the rig's iPad):
  - A, phone offline: start `{total:1, earned:16}`; after the iPad's Done ★ `{total:2, earned:17, verseToday:true}` (mirror the same); after the phone flushed, 4152 ms after its tap, `{total:2, earned:17, verseToday:false, storyToday:true}`, mirror also `verseToday:false`; the iPad then showed `{done:'Done ★', pressed:'false', star:'4', rwTotal:'2', rwEarned:'17 ever', sync:'synced'}` and no error.
  - B, both online: the same loss.
  - C, control (the phone pulls before tapping): `{total:3, earned:18, verseToday:true, storyToday:true}`; the iPad showed "Done today ★" and ★5.
  - After the loss, a same-day re-tap on the iPad restored `{total:3, earned:18}`.
  - Evidence: `audits/evidence/p3/kidverse/verify-stale-device-erases-star-1.json`, `audits/evidence/p3/kidverse/verify-stale-device-erases-star-1-A-ipad-after-pull.png` ("Done ★" unpressed, ★4, Thursday's dot unlit).
- **Skeptic 2** re-read `apps/kidverse.html:322-334, 457-478, 630-645`, `apps/hub.js:231-243` and `worker/src/data.js:39-66`, confirmed no P2 ID covers the Kid Verse stars rows, and ran `node "audits/tools/phase3/kidverse/verify-stale-device-erases-star-2.mjs"`:
  - race (both online; the phone taps 3.2 s after a pull that came before the iPad's star): person row and mirror `{total:2, earned:17, count:4, verseToday:null, storyToday:true}`; the iPad showed `{done:'Done ★', pressed:'false', starCount:'4', rwTotal:'2', rwEarned:'17 ever'}`.
  - offline: the same numbers at every step.
  - control: `{total:3, earned:18, count:5, verseToday:true}`; "Done today ★", ★5.
  - A re-tap after the loss awarded the star again (`{total:3, earned:18}`).
  - Evidence: `audits/evidence/p3/kidverse/verify-stale-device-erases-star-2.json`, `audits/evidence/p3/kidverse/verify-stale-device-erases-star-2-race-ipad-after-pull.png`.

**Corrected claim.**
- The verse ★ can be lost for good. A story credit comes back only while the family `story:<kid>` row still holds that day: the next `reconcile()` credits story days from that row within 14 days (`apps/kidverse.html:472-474`). A stale "I heard it" rewrites that row too and drops the other device's heard day (`audits/evidence/p3/kidverse/critic-heard-races.json` stale vs control), so the credit survives only when `reconcile()` runs before the family row is replaced. That is filed as P3-KIDVERSE-10. Prayed credits come back from the prayer rows within 14 days, and unapplied ledger rows are re-applied.
- A verse star lost on the day it was earned can be earned again that day, because the button turns back into "Done ★" (reproduced by both skeptics). The loss is permanent if nobody re-taps before midnight, or if the stale copy predates an earlier day's star: `award()` writes only today's key (`:327-329`) and `reconcile()` never rebuilds verse days (from the code; not run).
- The family mirror `stars:<kid>` is overwritten too, so adults and the TV lose the star as well.
- `heard()` also writes the story rows whole (`:638-639`), so the same race drops a heard day. The skeptics did not test it; the completeness critic did afterwards, and two more skeptics confirmed it: P3-KIDVERSE-10.

#### P3-KIDVERSE-03 — On a stalled or failed first load an adult sees "Week 1", and + writes week 2 over the family's real week

- **Severity: critical** (skeptics: critical / high; unchanged from the investigator's rating). Rule (a): the shipped stepper silently overwrites a family-scope household row with a value built from an empty cache, and every kid device follows it. Skeptic 2 argued for high because the lost value is one number that can be set again. The rule allows a downgrade from critical only when the trigger needs hand-made requests or unproven model behaviour; recoverability is not a ground, so critical stands.
- **Exposure.** An adult opens Kid Verse on a device with no kidverse family cache (a new device, cleared storage, or a deep link before the shell's pull) and every first kidverse pull on it is slow (over 6 s) or fails; a failed pull shows the "Week 1" stepper within 0.2 s. Then one tap on +. The shell pulls kidverse on Home (`index.html:459`), so any device where one pull has succeeded is safe.
- **Recovery.** 36 taps on + (week 2 → 38), or, once the pull lands, the one-tap "Use week 38", which appears only when the adult's own F260 plan is on week 38 (the family's real week), since the hint shows whenever the F260 week differs from the family week (`apps/kidverse.html:370, 376`). `setWeek` posts no feed line (`:338`), so no other adult is told.
- **Related.** P2-SYNC-17 (the same `hub.ready` race, `apps/hub.js:337`), plus a pending local write outranking the pulled row (`apps/hub.js:295`). Here the row is family scope, so every kid's verse, story and art change.

**What happens now.** `familyWeek()` falls back to 1 when there is no row (`apps/kidverse.html:253, 276`). The stepper shows "Week 1 · the family is on" with + enabled (`:369`), and `setWeek` has no pull guard (`:336-340`). At 7.0 s into a held pull the adult saw Genesis 1:27 / Week 1 and tapped +. The server row went from `{week:38, by:'eli'}` to `{week:2, by:'eli'}`. The late pull did not repair it, and every kid then saw week 2 (Hebrews 11:6; the story "Job listens, Abram goes").

**Expected.** The stepper stays disabled, or shows a loading state, until the family scope has been pulled.

**Why it matters to the household.** A setting that decides what every child hears this week is silently reset, and each kid device shows the wrong verse and story until an adult notices.

**Evidence.**
- Code: `apps/kidverse.html:253, 276, 336-340, 369-376`; `apps/hub.js:295, 334-337`; `index.html:459`.
- Run: `audits/evidence/p3/kidverse/adult-week.json`: `C_week0 {"week":38,"by":"eli"}`, `C_atTap {"ms":7012, "ref":"Genesis 1:27", "weekNow":"Week 1the family is on"}`, `C_server {"week":2,"by":"eli"}`.
- Screenshots: `audits/evidence/p3/kidverse/adult-week-C-stalled-stepper.png`, `audits/evidence/p3/kidverse/verify-week-stepper-stalled-overwrite-1-V1-held-9s-at-tap.png`, `audits/screens/kidverse/adult-stalled-loading-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/adult-week.mjs"` (scenario C; the whole script takes about 35 s).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read `apps/kidverse.html:253, 276, 336-340, 369, 375, 465-469` and `apps/hub.js:324-337`, and ran `node "audits/tools/phase3/kidverse/verify-week-stepper-stalled-overwrite-1.mjs"` (typical, real clock; each arm resets the week to 38, pairs a new phone for Eli, deep-links `#kidverse` and taps `#week-up` once):
  - V0 control: at the tap "Acts 2:42", "Week 38"; the server went 38 → 39; Ezra's iPad showed week 39.
  - V1 (every GET held 9 s): the stepper painted at 6568 ms; at the tap (7002 ms) "Genesis 1:27", "Week 1 the family is on", + enabled, family cache `since=0`, `lastPull=0`. The server went 38 → `{week:2, by:'eli'}`. After the held pull landed the phone showed "Hebrews 11:6 / Week 2"; Ezra's iPad showed "Hebrews 11:6", "Ezra · Week 2" and the week-2 story.
  - V2 (503 for 8 s): the stepper painted at 165 ms showing Week 1, sync "error"; server 38 → 2; Ezra showed week 2.
  - Evidence: `audits/evidence/p3/kidverse/verify-week-stepper-stalled-overwrite-1.json`, `audits/evidence/p3/kidverse/verify-week-stepper-stalled-overwrite-1-V1-held-9s-at-tap.png` (Week 1 stepper, + enabled, kids at ★0).
- **Skeptic 2** re-read `apps/kidverse.html:253, 276, 336-340, 343-375, 512-520`, `apps/hub.js:286-300, 327-337` and `index.html:458-459`, and ran `node "audits/tools/phase3/kidverse/verify-week-stepper-stalled-overwrite-2.mjs"`:
  - CTRL: the stepper at 185 ms showing "Week 38", Acts 2:42.
  - HOLD (every GET held 10 s): the stepper painted at 6134 ms showing "Week 1" and Genesis 1:27, + enabled, sync "offline", `lastPull 0`. Tap at 7825 ms; the server right after: `{week:2, by:'eli'}`, still week 2 after release and a pull. The hint then read "Your F260 plan is on week 38. Use week 38". Ezra saw "Ezra · Week 2", Hebrews 11:6 and "Job listens, Abram goes".
  - FAIL (every GET 503 until released): the stepper painted at 161 ms showing "Week 1", sync "error"; tap at 1892 ms; the server held `{week:2, by:'eli'}` and still did after release.
  - Evidence: `audits/evidence/p3/kidverse/verify-week-stepper-stalled-overwrite-2.json`, `audits/evidence/p3/kidverse/verify-week-stepper-stalled-overwrite-2-HOLD-before-tap.png`, `audits/evidence/p3/kidverse/verify-week-stepper-stalled-overwrite-2-FAIL-after-release.png`.

**Corrected claim.**
- A failed first pull opens the window at once (165 ms and 161 ms). The "over 6 s" threshold applies only to a pull that is slow but has not failed.
- The pull that lands after the tap does not repair the value: the local write carries a newer stamp, so week 2 stays on the server and on every device.
- Recovery is 36 taps on + (not −), or the one-tap "Use week 38" when the adult's own F260 plan is on week 38.

#### P3-KIDVERSE-04 — The seven day dots and their "N of 7 days" label show verse days only, while ★N also counts story and prayed stars

- **Severity: medium** (skeptics: medium / medium; unchanged). A misleading progress display on the kid's main card and in the grown-ups panel. The count, the balance and the stored rows are all correct, so no data is lost.

**What happens now.** `daysHtml` lights a dot only where `s.days[d] === true`, a verse star (`apps/kidverse.html:277`). `weekCount` adds `credited.story` and `credited.prayed` (`:414`), and item 20 widened the count this way (`:269`) without changing the dots. Both the kid card (`:361`) and the grown-ups panel (`:372`) use them.
- In typical data Ezra reads ★3 over 1 lit dot: Monday's verse, plus prayed stars on Tuesday and today, neither lit.
- After his verse and story today the card read ★5 over 2 lit dots, with the aria-label "5 of 7 days". Mom's panel showed the same.
- The aria-label prints the count unguarded (`:277`), so it can pass 7: a fixture read "10 of 7 days", and a full week of all three sources reaches 21.

**Expected.** The dot row and its label agree with the count: either each day shows every star earned that day (for example star, book and heart marks), or the row is clearly the verse row and its label counts the lit days.

**Why it matters to the household.** For a pre-reader the dot row is the picture of their progress. It contradicts the number, hides two of the three ways to earn, and VoiceOver reads an impossible "N of 7 days".

**Evidence.**
- Code: `apps/kidverse.html:60, 269, 277, 361, 372, 414`.
- Runs: `audits/evidence/p3/kidverse/star-rules.json` R2 (`starCount '5', litDots 2`); `audits/evidence/p3/kidverse/verify-day-dots-vs-count-1.json`; `audits/evidence/p3/kidverse/verify-day-dots-vs-count-2.json`.
- Screenshots: `audits/evidence/p3/kidverse/verify-day-dots-vs-count-1-mom-kids-panel.png`, `audits/evidence/p3/kidverse/verify-day-dots-vs-count-2-ezra-after-verse-and-story.png`, `audits/evidence/p3/kidverse/verify-day-dots-vs-count-2-fixture-late-week.png`, `audits/screens/kidverse/kid-stars-typical-iphone-pwa-light.png`, `audits/screens/kidverse/adult-overflow-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/star-rules.mjs"` (R2 prints `starCount` and `litDots`).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read `apps/kidverse.html:277, 361, 372, 404-414` and ran `node "audits/tools/phase3/kidverse/verify-day-dots-vs-count-1.mjs"`:
  - Typical, real clock (Thu 2026-09-24), Ezra: on open ★3, 1 lit, aria "3 of 7 days" (`days` has 09-21 only; `credited.prayed` has 09-22 and 09-24, both unlit). After Done ★: 4, 2 lit. After "I heard it": 5, 2 lit, "5 of 7 days".
  - Mom's panel: Ezra ★5 with 2 lit; Kiara ★1 with 1 lit.
  - Overflow, Mom's panel: Ezra ★6, 2 lit, "6 of 7 days"; Kiara ★4, 2 lit, "4 of 7 days".
  - Evidence: `audits/evidence/p3/kidverse/verify-day-dots-vs-count-1.json`, `audits/evidence/p3/kidverse/verify-day-dots-vs-count-1-mom-kids-panel.png`.
- **Skeptic 2** re-read `apps/kidverse.html:60, 266-277, 329, 361, 372, 412-414` and ran `node "audits/tools/phase3/kidverse/verify-day-dots-vs-count-2.mjs"`:
  - V1, shipped UI only: the same readings (3 / 1 lit; 4 / 2; 5 / 2, "5 of 7 days"); Mom's panel Ezra ★5 over 2 lit dots, Kiara ★1 over 1.
  - V2, a fixture written as Ezra to his own row, crediting story and prayed for every day from Monday to today: ★10, aria "10 of 7 days", 2 lit dots.
  - Evidence: `audits/evidence/p3/kidverse/verify-day-dots-vs-count-2.json`, `audits/evidence/p3/kidverse/verify-day-dots-vs-count-2-fixture-late-week.png`.

**Corrected claim.**
- In typical data Ezra's ★3 is one verse day plus two prayed days (Tuesday and today), and both prayed days are unlit, not only today.
- "9 of 7 days" was not observed. The runs showed "5 of 7 days" over 2 lit dots and, with a fixture, "10 of 7 days".
- Skeptic 2 notes the dot row predates item 20 (the comment at `apps/kidverse.html:60`; CLAUDE.md's Reset week turns "dots off"), so a verse-only row may once have been deliberate. The contradiction with the widened count and the wrong label hold either way.

#### P3-KIDVERSE-05 — After the week stepper the verse moves, but the story card stays on the old week while its speaker reads the new week's story

- **Severity: medium** (skeptics: medium / medium; unchanged). The weekly set-week flow is misleading on the adult's own open page. The row is written correctly and other devices repaint, so no data is lost.

**What happens now.** `setWeek` calls only `render()` (`apps/kidverse.html:336-340`), which never touches the story card (`:343-377`). `renderStory` runs at boot and on `hub.onChange` (`:676`), and hub.js fires `onChange` only for remote changes (`apps/hub.js:206-210`): `hub.set` never emits (`:231-243`), and a pull skips a row whose local stamp is as new, so the device's own write never re-emits (`:293-298`).
- After + the page showed "James 1:2-4" and "Week 39" above a story card still reading "Week 38 · Wind, fire and a bright light".
- The story's "Read it to me" reads `familyWeek()` when tapped (`:672`), so it speaks week 39's story, "Good news for everyone", while the card prints week 38's.
- 30 s pulls do not fix it. A reload, or any remote kidverse change, does.

**Expected.** A week change repaints the story card, so the verse, the story text and the speaker agree.

**Why it matters to the household.** The adult who just set the week sees a mismatched story. Reading the card aloud gives last week's story; tapping the speaker gives a different story from the one on screen.

**Evidence.**
- Code: `apps/kidverse.html:336-340, 343-377, 648-668, 672, 676`; `apps/hub.js:206-210, 231-243, 293-298`.
- Run: `audits/evidence/p3/kidverse/adult-week.json` A_after `{ref:'James 1:2-4', storySpan:'Week 38 · the grown-ups are reading Acts 2–9'}`, A_afterReload `{storyTitle:'Good news for everyone'}`.
- Screenshots: `audits/evidence/p3/kidverse/adult-week-A-after-plus-story-card.png`, `audits/evidence/p3/kidverse/verify-story-card-stale-after-step-2-after-plus-story.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/adult-week.mjs"` (scenario A).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read the code above and ran `node "audits/tools/phase3/kidverse/verify-story-card-stale-after-step-1.mjs"` twice (typical, real clock, Eli on iphone-pwa):
  - Before: "Acts 2:42", "Eli · Week 38", story "Wind, fire and a bright light", "Week 38 · the grown-ups are reading Acts 2–9".
  - After + (flushed; server `{week:39, by:'eli'}`): verse "James 1:2-4", "Eli · Week 39"; the story card, and the speaker's aria-label "Read the story to me: Wind, fire and a bright light", still on week 38. Unchanged after 35 s, which included a 30 s pull.
  - The story speaker, with speechSynthesis stubbed to record, spoke "This week's story: Good news for everyone. …" (week 39).
  - Control: after Mae's remote PUT of week 40 was pulled, the card repainted to "Singing in prison" / "Week 40". A reload was consistent.
  - Evidence: `audits/evidence/p3/kidverse/verify-story-card-stale-after-step-1.json`, `audits/evidence/p3/kidverse/verify-story-card-stale-after-step-1-after-plus.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/kidverse/verify-story-card-stale-after-step-2.mjs"` (Eli on the Kitchen iPad, inside the shell):
  - After + and after one full 30 s pull: verse week 39, story card still week 38.
  - The speaker's text, rebuilt from its click handler (the rig's WebKit has no speechSynthesis), is week 39's story.
  - After a reload: "Good news for everyone" / "Week 39 · the grown-ups are reading Acts 10–14 · James 1–5".
  - Weeks 38 and 39 share the scene 12-church, so the art gives no hint.
  - Evidence: `audits/evidence/p3/kidverse/verify-story-card-stale-after-step-2.json`, `audits/evidence/p3/kidverse/verify-story-card-stale-after-step-2-after-plus-story.png`.

**Corrected claim.** The card's title, week line, text and aria-label stay on the old week, but the speaker is not stale: it reads the new week's story (`apps/kidverse.html:672`). The "Use week N" button goes through `setWeek` too. It clears on a reload or any remote kidverse change, not on the periodic pull. Other household devices show the new week correctly.

#### P3-KIDVERSE-06 — The kid's stars card labels the cash-in balance "all time"

- **Severity: low** (skeptics: low / low; unchanged). Misleading copy on a secondary figure; the stored values and the rewards card are right.

**What happens now.** The stars card prints `s.total`, the balance a cash-in resets, as "N all time" (`apps/kidverse.html:361`). The code's own comment (`:381-384`) and CLAUDE.md define `total` as the cash-in balance and `earned` as all-time; "My rewards" on the same page prints `s.earned` as "N ever" (`:497`). In overflow data the page reads "6 stars this week · 424 all time" above "424 stars to cash in · 6 this week · 869 ever".

**Expected.** The stars card shows `earned` ("869 ever") or no all-time figure.

**Why it matters to the household.** Two contradictory totals sit on one screen, and a parent looking at the kid's device misreads the balance.

**Evidence.**
- Code: `apps/kidverse.html:361` vs `apps/kidverse.html:497`; `apps/kidverse.html:381-384`.
- Runs: `audits/evidence/p3/kidverse/rowsize.json` (`ui.mineSub '6 stars this week · 424 all time'`, `row.earned 869`), `audits/evidence/p3/kidverse/verify-all-time-label-1.json`, `audits/evidence/p3/kidverse/verify-all-time-label-2.json`.
- Screenshots: `audits/evidence/p3/kidverse/verify-all-time-label-2-A-before-cashin.png`, `audits/screens/kidverse/kid-stars-overflow-ipad-portrait-light.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/rowsize.mjs"` (overflow).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/kidverse/verify-all-time-label-1.mjs"` (overflow, real clock, Ezra on iPad portrait; Mom cashes in through Me → Kids' rewards with `confirm()` accepted):
  - Before: row `{count:6, total:424, earned:869, payouts:29}`; UI "6 stars this week · 424 all time", balance "424", "869 ever".
  - The dialog read "Cash in Ezra Bartholomew Anderson's 424 stars? The balance goes back to 0; badges stay."
  - After: "6 stars this week", balance "0", "869 ever", "Last cashed in: 424 stars on Sep 24."; row `{total:0, earned:869, payouts:30}`.
  - Evidence: `audits/evidence/p3/kidverse/verify-all-time-label-1.json`, `audits/evidence/p3/kidverse/verify-all-time-label-1-before-ipad.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/kidverse/verify-all-time-label-2.mjs"` with the same steps: before, `#mine .sub` "6 stars this week · 424 all time" and `#rw-bank` "424 stars to cash in · 6 this week · 869 ever"; after, "6 stars this week" and "0 stars to cash in · 6 this week · 869 ever". Evidence: `audits/evidence/p3/kidverse/verify-all-time-label-2.json`, `audits/evidence/p3/kidverse/verify-all-time-label-2-B-after-cashin.png`.

**Corrected claim.** The stars card renders only for kid profiles (`apps/kidverse.html:355-362`), so its reader is the kid, or a parent looking at the kid's device. The figure shows only while `total > count`: after a cash-in a number labelled "all time" drops from 424 to nothing, which shows it is the balance. The "424 stars to cash in · 869 ever" line is on the rewards card lower on the same page.

#### P3-KIDVERSE-07 — Prayed stars are matched by display name, so a guest with a kid's name earns that kid a star

- **Severity: low** (skeptics: low / low; unchanged). One unearned star a day and progress toward the Prayer warrior badge; nothing lost or exposed; an unusual precondition.
- **Exposure.** An adult adds a guest whose name equals a kid's. Neither Me → Add a guest nor `POST /api/profiles` rejects a duplicate name (`index.html:1408-1418`; `worker/src/index.js:174-203`).
- **Related.** P3-PRAYER-24 (Prayer report) is the same name-keyed `prayedBy` as seen in Prayer's faces, kid cards and the TV. The root cause and the fix are in Prayer's writer (`apps/prayer.html:1599-1602`: store profile ids beside names). This ID owns only the star credit (`apps/kidverse.html:427-434, 474`). Not a Phase 2 duplicate.

**What happens now.** Prayer writes `hub.profile.name` into `prayedBy[date]` (`apps/prayer.html:1598-1602`). Kid Verse credits a prayed day when that list includes the kid's name (`apps/kidverse.html:427-434`, called with `p.name` at `:474`). Mom added a guest named "Kiara"; the guest tapped Prayed on the family list; when the real Kiara opened Kid Verse, it credited her prayed star for today (total 4 → 5). Kiara had not prayed.

**Expected.** Prayed days are matched by profile id: Prayer stores ids next to the names (a data change only; Prayer's layout and ids stay, per CLAUDE.md).

**Why it matters to the household.** Stars and the Prayer warrior badge can be earned by someone else.

**Evidence.**
- Code: `apps/kidverse.html:427-434, 474`; `apps/prayer.html:1598-1602`.
- Runs: `audits/evidence/p3/kidverse/star-rules.json` R6 (guest `{name:'Kiara'}`, `prayedByToday ['Kiara']`, total 4 → 5, `creditedToday true`); `audits/evidence/p3/kidverse/verify-prayed-name-match-1.json`; `audits/evidence/p3/kidverse/verify-prayed-name-match-2.json`.
- Screenshot: `audits/evidence/p3/kidverse/verify-prayed-name-match-1-kiara-after.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/star-rules.mjs"` (R6 runs on a fresh instance).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/kidverse/verify-prayed-name-match-1.mjs"` with a control step first (the real Kiara opens Kid Verse so pending credits are used up): control `{total:4, earned:4, prayedToday:null}`; no prayer row listed "Kiara" today. Mom POSTed a guest `{name:'Kiara'}` (200, `kind:'adult'`); the guest tapped Prayed in the shipped Prayer UI (`prayer:s004` today `['Kiara']`). Kiara, who never opened Prayer, reopened Kid Verse: `{total:5, earned:5, prayedToday:true}`, the mirror the same.
- **Skeptic 2** ran `node "audits/tools/phase3/kidverse/verify-prayed-name-match-2.mjs"`. Case A reproduced the same result (control total 4; after the guest's tap, Kiara 4 → 5, mirror `credited.prayed[today]` true). Case B, an admin rename of Kiara to "Kiki": the kid's device kept the name from its login session, so Prayer still wrote "Kiara" and Kid Verse still credited the day (4 → 5).

**Corrected claim.** The main claim holds. The investigator's side claim that renaming a kid breaks the match is not shown: each device keeps the profile name from its login session (`apps/hub.js:105-111, 169`), so Prayer and Kid Verse on the kid's device switch names together after a re-login. At most, older-name days inside the 14-day look-back would be missed. From the code only (not run): because `prayedBy[date]` is a set of names, a guest named "Kiara" who un-taps Prayed deletes the real kid's mark on that card (`apps/prayer.html:1601`). The same name matching puts faces on "who prayed today" (`index.html:1057-1059`), and chat's `mark_prayed` writes `profile.name` too (`worker/src/chat.js:246`).

#### P3-KIDVERSE-08 — "Today" is each device's local date, so a device in a western time zone can add a second verse star in one household day

- **Severity: low** (skeptics: low / low; unchanged). An edge case: one extra verse star when devices sit in different time zones. Nothing is lost or exposed.
- **Exposure.** A kid device set to a western time zone (travel, or a wrong setting) used between New York midnight and its own local midnight.

**What happens now.** `dayKey` uses the device's local date (`apps/kidverse.html:259`; the story module's copy at `:592`), and `award()` allows one star per `dayKey()` (`:327-329`). A phone set to America/Los_Angeles at 22:30 PT on Wed 23 Sep stored `days['2026-09-23']`. One minute later (01:31 ET on Thursday) the New York iPad offered Done ★ again and stored `days['2026-09-24']`: two verse stars within a minute, in one New York day.

**Expected.** One verse star per household day. The Worker already treats New York as the household's day (`worker/src/reminders.js:13-18`; `worker/src/chat.js:112`), while every client app uses the device's local date (`apps/kidverse.html:259`, `index.html:834`, `apps/f260.html:932`, `apps/prayer.html:711`), so which day counts should be decided once, platform-wide.

**Why it matters to the household.** It breaks the one-star-a-day rule, in the kid's favour.

**Evidence.**
- Code: `apps/kidverse.html:259, 327-329, 592`.
- Runs: `audits/evidence/p3/kidverse/dates.json` (Z_afterLA `days {…'2026-09-23':true}`, Z_ny `done 'Done ★'`, Z_afterNY `days {…'2026-09-23':true, '2026-09-24':true}`); `audits/evidence/p3/kidverse/verify-device-local-day-1.json`; `audits/evidence/p3/kidverse/verify-device-local-day-2.json`.
- Screenshots: `audits/evidence/p3/kidverse/dates-Z-ny-ipad-after-second-star.png`, `audits/evidence/p3/kidverse/verify-device-local-day-1-B-ny-ipad-after.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/dates.mjs"` (scenario Z).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/kidverse/verify-device-local-day-1.mjs"`: A, an LA-zone phone ("Wed Sep 23 2026 22:30:01 GMT-0700") tapped Done → `days {'2026-09-21','2026-09-23'}`, total 2. B, 60 s later, the NY iPad ("Thu Sep 24 2026 01:31:01 GMT-0400"), after a pull, showed "Done ★" and ★4; after its tap, "Done today ★", ★5, `days {…,'2026-09-24'}`, total 3, earned 18, the mirror the same.
- **Skeptic 2** ran `node "audits/tools/phase3/kidverse/verify-device-local-day-2.mjs"`: A, the same two stars (total 3); B, control with both devices in New York, the second tap got "You already have today’s star — come back tomorrow!" and `days` stayed `{21, 24}`; C, one phone in LA tapped at Wed 22:30 PT and again at Thu 06:00 PT → `days {21, 23, 24}`, total 3.

**Corrected claim.** Kid Verse allows one verse star per calendar date on the tapping device, not per New York household day. No date ever holds two stars, but a western-zone device can still claim a date the household has left. A single travelling phone does the same (scenario C), which from the kid's local view is arguably right. CLAUDE.md does not say which zone "one per day" uses, so the expected behaviour is a platform-wide decision.

#### P3-KIDVERSE-09 — The stars row keeps every credited day forever, and every change uploads the whole row twice

- **Severity: low (perf)** (skeptics: low / low; investigator rated it low perf, narrowed from the lead). No data is lost; the 900 KB value cap (`worker/src/data.js:4`) is about 70 years away. The cost is bandwidth and cache size.

**What happens now.** `rewardsExtra` keeps every date key in `credited.story` and `credited.prayed` (`apps/kidverse.html:405, 411`) and trims only `earnedAt`, to 30 days (`:410`). `applied` is never pruned either (`:409`); `payouts` is capped at 50 (`:407, 449`). After about 14 months (the overflow seed) Ezra's row is 15,077 bytes, 10,357 of them `credited` (255 story and 318 prayed keys from 2025-07-28). Every write that changes the row, including a reconcile on open, POSTs it whole twice: person `stars` and family `stars:<kid>` (`:330-331, 478`; `apps/hub.js:264`).

**Expected.** Credited days older than the 14-day look-back are folded into counters and dropped, keeping the story and prayer badge counts, which `creditedCount` reads from every credited day (`:413`).

**Why it matters to the household.** Each star uploads about 15 KB twice after a year, and every device keeps and re-downloads it.

**Evidence.**
- Code: `apps/kidverse.html:402-413, 473-478`; `apps/hub.js:264`; `worker/src/data.js:4`.
- Runs: `audits/evidence/p3/kidverse/rowsize.json` (`row.bytes 15077`, `byteShare.credited 10357`, `keys {story:255, prayed:318}`); `audits/evidence/p3/kidverse/verify-stars-row-growth-1.json`; `audits/evidence/p3/kidverse/verify-stars-row-growth-2.json`.

**Reproduction.** `node "audits/tools/phase3/kidverse/rowsize.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/kidverse/verify-stars-row-growth-1.mjs"` (overflow; a browser clock one day ahead so a fresh star could be earned): Ezra's row 15,077 bytes before; one tap sent `POST …/batch?scope=person` of 15,124 bytes and `…?scope=family` of 15,129 bytes; after the app's own write the row still held 255 story and 318 prayed keys back to 2025-07-28, while `earnedAt` went from 59 to 58 keys (trimmed). Kiara: 7,591 bytes, two POSTs of 7,638 and 7,644 bytes, every credited key kept.
- **Skeptic 2** ran `node "audits/tools/phase3/kidverse/verify-stars-row-growth-2.mjs"` (typical, demo clock): planted 150 story and 150 prayed days dated 2025 in Ezra's own row (1,097 → 6,497 bytes); the reconcile on open POSTed 6,582 + 6,587 bytes and the Done tap 6,633 + 6,638 bytes; all 300 old keys survived in the person row and the mirror, and `earnedAt` was trimmed to 19 keys. Evidence also `audits/evidence/p3/kidverse/verify-stars-row-growth-2-after-tap.png`.

**Corrected claim.** The whole row goes up twice on every write that changes it, not only on a star (the reconcile on open did too). `applied` also grows by one key per ledger row. Growth is at most about 13-14 KB a year. Any pruning must keep the badge counts.

#### P3-KIDVERSE-10 — "I heard it" on a kid's second device with an older copy erases the other device's heard day from the week's story row

- **Severity: critical** (skeptics: critical / critical; unchanged from the critic's rating). Rule (a): one ordinary "I heard it" tap in the shipped UI silently and permanently replaces the kid's person `story` row and the family `story:<kid>` mirror. Those are household rows: the kid's story card and the parents' F260 line "Kids: Ezra N/5" read them (`apps/f260.html:1611-1613`). No hand-made request is needed, and skeptic 1 reproduced it with correct device clocks.
- **Exposure.** The kid uses two devices, and the second one still holds a copy of the story row from before the first device's tap when it taps "I heard it" on a later day. Realistically that means it is offline (car, park). Online, the app pulls on open, on becoming visible and every 30 s, so the tap would have to fall just after midnight inside that window (skeptic 2).
- **Related.** P3-KIDVERSE-02 is the same whole-row mechanism on the stars row, and skeptic 2 suggested filing this as a wider facet of it. It is kept as its own ID, as P3-KIDVERSE-01 and -03 are, because the victim row, the function (`heard()`) and the fix differ. P2-SYNC-01 names only the F260 and build-guide rows.
- **Found by** the completeness critic, from the "Not verified" note on `heard()` and P3-KIDVERSE-02's corrected claim.

**What happens now.** `heard()` rebuilds the story row from the local copy (`normStory` / `myStory`, `apps/kidverse.html:599-604`) and writes it whole to person `story` and family `story:<kid>` (`:631-646`; the writes at `:638-639`). Each row is last-write-wins on the writer's stamp (`apps/hub.js:236-239`; `worker/src/data.js:60-62`). `reconcile()` credits story stars only from `story:<kid>` (`:473`), and nothing ever rebuilds story days.
1. Ezra's phone opens Kid Verse on Thu 24 Sep and goes offline.
2. On Fri 25 the Kitchen iPad taps "I heard it". The server's story rows become `{W39, days [25]}`, and the stars row credits story 25 (total 2).
3. On Sat 26 the offline phone taps "I heard it" and flushes `{days [26]}`. Friday is gone from both story rows.
4. It stays gone after the iPad's pull and after a reopen: the story card reads "Heard 1 day this week". Control (the phone pulls before tapping): `[25, 26]`, "Heard 2 days this week".

The phone's own reconcile also wrote a stars row without Friday's story credit (server total 2, `creditedStory [26]`). The iPad's next reconcile put it back (total 3) only because it ran while the iPad's cached `story:ezra` still held Friday. Whether the star survives depends on the order of the pulls; the heard day is lost every time. Mom's F260 then read "Kids: Ezra 1/5 · Kiara 0/5" (control "Ezra 2/5").

**Expected.** Two devices of one kid cannot erase each other's heard days: one row per heard day, or a merge of `days` on write, in the same direction as the fix for P3-KIDVERSE-02.

**Why it matters to the household.** The week's heard days that the kid and the parents see silently lose a day, and the story star can go with it.

**Evidence.**
- Code: `apps/kidverse.html:599-604, 631-646, 473`; `apps/hub.js:236-239`; `worker/src/data.js:60-62`; `apps/f260.html:1611-1613`.
- Run: `audits/evidence/p3/kidverse/critic-heard-races.json`, arm stale: story days `['2026-09-25']` after the iPad's Friday tap, `['2026-09-26']` after the phone's Saturday flush (stars total 2, `creditedStory ['2026-09-26']`), still `['2026-09-26']` after the iPad's pull and a reopen, with the iPad reading "Heard 1 day this week". Arm control: `['2026-09-25','2026-09-26']`, "Heard 2 days this week".
- Screenshots: `audits/evidence/p3/kidverse/critic-heard-stale-ipad-after-pull.png`, `audits/evidence/p3/kidverse/critic-heard-control-ipad-after-pull.png`, `audits/evidence/p3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-2-stale-ipad-after-pull.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/critic-heard-races.mjs" stale` and `node "audits/tools/phase3/kidverse/critic-heard-races.mjs" control` (typical, real server clock; the phone is a second paired device with a browser clock at Thu 24 Sep 18:00 New York, fast-forwarded 48 h while offline; the iPad's clock is Fri 25 Sep 18:00; about 20 s each). Compare the story days after the iPad's pull between the arms.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read `apps/kidverse.html:599-603, 631-646, 472`, `apps/hub.js:236-239`, `worker/src/data.js:41, 60` and `apps/f260.html:1606-1616`. It ran `node "audits/tools/phase3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-1.mjs"` without the critic's 48 h fast-forward, which stamps writes ahead and meets the Worker's now+5 min clamp. The phone booted at Sat 26 Sep 18:00, warmed its cache and went offline; the iPad tapped at Fri 25 Sep 18:00.
  - Stale arm: after the iPad's tap, story days `['2026-09-25']` and stars total 2 with `creditedStory ['2026-09-25']`. The phone's cached row was the previous week's (`W38`, 16/18/20 Sep). After the phone's tap, story days `['2026-09-26']` and stars total 2 with `creditedStory ['2026-09-26']`. After the iPad's pull, still `['2026-09-26']` and "Heard 1 day this week"; stars back to total 3 with `creditedStory` 25 and 26.
  - Control: `['2026-09-25','2026-09-26']`, "Heard 2 days this week", total 3.
  - Evidence: `audits/evidence/p3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-1.json`, `audits/evidence/p3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-1-stale-ipad.png`.
- **Skeptic 2** re-read `apps/kidverse.html:457-478, 599-603, 631-646`, `apps/hub.js:231-243, 286-295, 339-342`, `worker/src/data.js:39-64` and `apps/f260.html:1602-1620`. It ran `node "audits/tools/phase3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-2.mjs"`: the phone pulled at Thu 24 Sep 17:00 and went offline; the iPad tapped at Fri 25 17:00; the phone's clock was set (not fast-forwarded) to Sat 26 17:00 and it tapped offline, then reconnected; the iPad pulled; Mom opened F260 at Sat 19:00.
  - Stale arm: after the phone's flush, person and family story days `['2026-09-26']` and stars `{total 2, earned 17, creditedStory ['2026-09-26']}`. After the iPad's pull, still `['2026-09-26']`, "Heard 1 day this week", stars back to `{total 3, earned 18}`. Mom's F260 read "Kids: Ezra 1/5 · Kiara 0/5".
  - Control: `['2026-09-25','2026-09-26']`, "Heard 2 days this week", "Kids: Ezra 2/5 · Kiara 0/5".
  - Evidence: `audits/evidence/p3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-2.json`, `audits/evidence/p3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-2-stale-ipad-after-pull.png`, `audits/evidence/p3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-2-control-ipad-after-pull.png`.

**Corrected claim.**
- It reproduces with correct clocks, not only with the critic's fast-forward, and with a stale copy from the previous ISO week as well as the same week.
- The stale device's own reconcile also erases the other day's story credit for a while (server total 2). The star survives only when the other device's reconcile runs while its cache still holds the lost day.
- Skeptic 2 would fold this into P3-KIDVERSE-02 to avoid counting one mechanism twice; see Related for why it has its own ID.
- Rig note: the iPad keeps its fixed Friday clock after the pull, so it offers "I heard it" for Friday again. On real devices both would read Saturday, so the lost day cannot be marked again.

#### P3-KIDVERSE-11 — "I heard it" tapped during a slow or failed first load replaces the week's story row, dropping earlier heard days

- **Severity: critical** (skeptics: critical / critical; unchanged from the critic's rating). Rule (a): one tap in the shipped UI replaces the kid's story rows in both scopes with today alone, and the earlier heard days are lost on the server. Both skeptics reproduced it with no future-dated clocks. The loss is bounded: at most the current ISO week's other heard days (six). The stars row and story credits stay intact because `reconcile()` is guarded.
- **Exposure.** All three must hold: (1) the kid's first open of Kid Verse on a device with empty kidverse caches; (2) every first kidverse pull on that device, the shell's included, is slower than 6 s or fails; (3) the kid already has heard days this ISO week from another device. Then one tap. Conditions (1) and (2) are P3-KIDVERSE-01's exposure.
- **Related.** P2-SYNC-17 (the `hub.ready` 6 s window; Phase 2 proved it for F260 only) and P3-KIDVERSE-01 (the same missing guard in `award()`, on the stars row). Both skeptics note it could be a facet of P3-KIDVERSE-01, since the same fix closes it. It is kept as its own ID because the victim row and the function differ; Polish rank 1 closes all three of -01, -03 and -11.
- **Found by** the completeness critic.

**What happens now.** `heard()` has no `pulled()` check (`apps/kidverse.html:631-639`), unlike `reconcile()` (`:467-469`). On an empty cache `normStory` returns `{week, days: {}}` (`:599-604`), and the button is enabled for any kid whatever the pull state. `hub.ready` resolves after 6 s (`apps/hub.js:334-337`).
1. The Kitchen iPad (Ezra, Thu 24 Sep) taps "I heard it". The story rows become `{W39, days [24]}`.
2. A newly paired phone signed in as Ezra (clock Fri 25 Sep) opens Kid Verse with every GET held 10 s.
3. At 7003 ms (`lastPull 0`) the page shows "Ezra · Week 1", the week-1 story "Creation and the flood" and an enabled "I heard it". Ezra taps.
4. The phone POSTs `story` and `story:ezra` as `{days {25}}` at 7893 and 7909 ms, before the pull. That write carries the newer stamp, so the held pull does not bring Thursday back (`apps/hub.js:295-296`).
5. The server ends with only `[25]` in both rows, and the phone reads "Heard 1 day this week". The stars row is intact (total 3, story 24 and 25 credited), because `reconcile()` waited for the pull.

**Expected.** "I heard it" stays disabled until both kidverse scopes have been pulled: the guard `reconcile()` already has (Polish rank 1).

**Why it matters to the household.** The week's heard days that the story card and the parents' F260 line show are silently cut back. The kid is also shown, and taps under, a placeholder week-1 story nobody read to them.

**Evidence.**
- Code: `apps/kidverse.html:599-604, 631-646, 467-469`; `apps/hub.js:231-236, 295-296, 334-337`.
- Runs: `audits/evidence/p3/kidverse/critic-heard-first2.json` (`s1_afterThu` story days `['2026-09-24']`; `atTap {ms:7003, lastPull:0}` with "Ezra · Week 1"; `s2_after` person and family `['2026-09-25']`, stars total 3 with `creditedStory` 24 and 25); `audits/evidence/p3/kidverse/critic-heard-races.json` arm first (POSTs of `story` and `story:ezra` at 7893 and 7909 ms, before the pull; `stars` only at 10192 ms).
- Screenshots: `audits/evidence/p3/kidverse/critic-heard-first2-phone-after.png`, `audits/evidence/p3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-2-A-phone-after.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/critic-heard-first2.mjs"` (typical, real server clock; about 40 s). It prints the story rows after the iPad's Thursday tap and after the phone's held-load Friday tap.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read `apps/kidverse.html:276, 465-469, 595, 599-603, 631-646, 660-666`, `apps/hub.js:231-236, 286-301, 334-337`, and ran `node "audits/tools/phase3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-1.mjs"` with no future clocks (the iPad 24 h behind real time, the phone on real time, so write order matches tap order and the Worker's clamp never applies).
  - Held arm: after the iPad's Wednesday tap, story days `['2026-09-23']`, stars total 2. At the phone's tap `{ms 7002, lastPull 0}`, "Ezra · Week 1", "I heard it". The kidverse batch POSTs (person 8074 ms, family 8089 ms) went out before the held GETs (10122 and 10139 ms). After: person and family `['2026-09-24']`, Wednesday gone; stars total 3, earned 18, story 23 and 24 credited. The phone then read "Heard 1 day this week" on Week 38.
  - Control: `['2026-09-23','2026-09-24']`, "Heard 2 days this week".
  - Evidence: `audits/evidence/p3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-1.json`, `audits/evidence/p3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-1-phone-after.png`.
- **Skeptic 2** re-read `apps/kidverse.html:462-465, 596-604, 629-646`, `apps/hub.js:286-300, 334-337` and `worker/src/data.js:41, 60`, and ran `node "audits/tools/phase3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-2.mjs"` (the iPad one day back in the same ISO week, new phones on the real clock).
  - Arm A (Ezra, every GET held 10 s): at the tap `{ms 6575, lastPull 0}`, "Ezra · Week 1", "Creation and the flood". After the tap and the pull: person and family `['2026-09-24']`, Wednesday gone; stars total 3, earned 18. The phone showed "Week 38 · Wind, fire and a bright light", "Heard it today ✓", "Heard 1 day this week".
  - Control B (Kiara, tapping after the pull): `['2026-09-23','2026-09-24']`, "Heard 2 days this week".
  - Evidence: `audits/evidence/p3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-2.json`, `audits/evidence/p3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-2-A-phone-after.png`.

**Corrected claim.** It reproduces with realistic clocks. The critic's "and marks Week 1's story" describes only what the kid is shown: the story row stores the ISO week and days, not the F260 week, so nothing on the server records week 1. After the pull the card shows the family's real week, already marked heard. That part is a UX facet, not data. No stars or story credits are lost; the loss is the current ISO week's earlier heard days.

#### P3-KIDVERSE-12 — A Reset week that Kid Verse applies after the ISO week rolls over leaves that week's verse stars on the balance

- **Severity: medium** (skeptics: medium / medium; unchanged from the critic's rating). A secondary parent flow gives a wrong result that contradicts its own confirm text ("This week's 6 stars come off the balance"), and Me's balance goes back up overnight with nobody acting. Not (a): no stars are erased; the kid keeps stars rather than losing them. Not high: the kid's daily flow works. Up to 7 verse stars (one a day) stay on the balance.
- **Exposure.** The kid's Kid Verse does not open between the parent's Reset week and the following Sunday midnight. The natural case is a Sunday-evening reset after bedtime; any reset the kid's device does not apply before that Sunday midnight does it.
- **Related.** P2-STAB-07 (an open page stale after midnight) is a different defect. This one is the ledger's reset semantics across the ISO-week boundary.
- **Found by** the completeness critic, crossing the ledger check with the ISO-week rollover check.

**What happens now.** The reset row lists this ISO week's days up to today (`index.html:1374`). `normStars` rebuilds a row from an earlier ISO week with `days: {}` (`apps/kidverse.html:270`), and the shell's `rewardRow` does the same (`index.html:1326`). `applyLedger` resets a verse day only where `s.days[d] === true` (`apps/kidverse.html:456`; the shell's copy at `index.html:1341`), so after the rollover the listed verse days are no longer there to reset. The credited story and prayed days survive the rollover in `rewardsExtra` and are reset correctly (`:457`).
- Overflow data, Ezra. On Sunday 27 Sep at 20:00 Mom taps Reset week. The confirm reads "This week's 6 stars come off the balance; badges stay.", and Me then reads "★418 to cash in · 0 this week".
- On Monday at 07:00, before Ezra opens Kid Verse, Me reads "★420 to cash in · 0 this week".
- Ezra opens Kid Verse on Monday at 07:30. The server row ends at `{week 2026-W40, total 420, days {}}`, with story and prayed on the 21st and 24th marked `'reset'`. The two verse stars (Mon 21 and Thu 24) stay on the balance.
- Control (Ezra opens Kid Verse on Sunday at 20:30): total 418, `days {21:'reset', 24:'reset'}`.

**Expected.** A reset takes off every star it lists, whenever the kid's device applies it: the reset row carries the verse days it removes and `applyLedger` honours them after `days` has been rebuilt for a new week, or last week's verse days are kept until any pending reset is applied. Me does not change the balance by itself at midnight.

**Why it matters to the household.** The parent was told "This week's 6 stars come off the balance". Up to 7 verse stars stay payable, and the balance in Me silently goes back up overnight.

**Evidence.**
- Code: `apps/kidverse.html:270, 456-457`; `index.html:1326, 1341, 1374`.
- Run: `audits/evidence/p3/kidverse/critic-reset-crossweek.json`: arm same ends at `{total:418, days:{'2026-09-21':'reset','2026-09-24':'reset'}}`; arm next reads "★420 to cash in · 0 this week" in Me on Monday, then ends at `{week:'2026-W40', total:420, days:{}}` with story and prayed on the 21st and 24th `'reset'`.
- Screenshots: `audits/evidence/p3/kidverse/critic-reset-crossweek-next-kid-after.png`, `audits/evidence/p3/kidverse/critic-reset-crossweek-same-kid-after.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/critic-reset-crossweek.mjs"` (arms same | next; overflow, real server clock, browser clocks at Sun 27 Sep 20:00 / 20:30 and Mon 28 Sep 07:00 / 07:30 New York; about 1 minute). Compare the totals after Kid Verse applies the reset (418 vs 420), and read "[next] Me on Monday before Kid Verse opens".

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read `apps/kidverse.html:265-272, 442-465` and `index.html:1323-1344, 1360-1364`, and ran `node "audits/tools/phase3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-1.mjs"` on two fresh overflow instances (real server clock, WebKit). Mom on iphone-pwa, browser clock Sun 27 Sep 20:00 New York, reset Ezra's week and accepted the confirm.
  - Both arms before the reset: `{week 2026-W39, count 6, total 424, days {21, 24}}`, story and prayed credited on the 21st and 24th. After it, Me read "★418 to cash in · 0 this week"; the ledger row was `{kind reset, date 2026-09-27, days 21-27}`.
  - Control (Ezra opens at Sun 20:30 on the Kitchen iPad): total 418, `days {21:'reset', 24:'reset'}`.
  - Late (Me read again at Mon 07:00, Ezra opens at 07:30): Me "★420 to cash in · 0 this week" before the kid opened; Kid Verse "420 stars to cash in"; server `{week W40, total 420, days {}, applied 31}`.
  - Evidence: `audits/evidence/p3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-1.json`, `audits/evidence/p3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-1-control-kid.png`, `audits/evidence/p3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-1-late-kid.png`.
- **Skeptic 2** re-read `apps/kidverse.html:265-273, 402-413, 445-466` and `index.html:1323-1348, 1370-1376`, and ran `node "audits/tools/phase3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-2.mjs"` with different times: the reset at Sun 21:15; arm sun, Ezra opens at Sun 23:40; arm mon, Me at Mon 00:05, Ezra at 00:20, Me again at 00:40.
  - Both before: total 424, W39, `days {21, 24}`; the verse `earnedAt` stamps older than the reset's `at`. Me after the reset: "★418 to cash in · 0 this week".
  - sun: total 418, `days {21:'reset', 24:'reset'}`.
  - mon: Me at 00:05 "★420 to cash in · 0 this week"; Kid Verse 420; server and mirror `{total 420, week W40, days {}}`; Me at 00:40 still ★420.
  - Evidence: `audits/evidence/p3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-2.json`, `audits/evidence/p3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-2-sun-kid.png`, `audits/evidence/p3/kidverse/verify-critic-reset-crossweek-keeps-verse-stars-1-2-mon-kid.png`.

**Corrected claim.** Confirmed as stated, with one line fix: the shell's verse check is at `index.html:1341`, not 1340. Only verse stars leak (up to 7); story and prayed credits survive the rollover in `rewardsExtra` and are reset. The trigger is not limited to Sunday evening. Nothing can be re-earned, because last week's days cannot get a new verse ★, so the only effect is the inflated balance.

#### P3-KIDVERSE-13 — A story or prayed day not yet credited when a parent resets the week is credited after the reset

- **Severity: medium** (skeptics: medium / medium; raised from the critic's low). The parent's Reset week misleads: the week reads 0, then goes back up, and the balance can end above where it was before the reset (★4 → ★3 → ★5). Nothing is lost or exposed, so not critical or high. The trigger is ordinary, which is why both skeptics rejected "low: an edge case".
- **Exposure.** The kid prays on the family list (or has a story day marked) during the week and does not open Kid Verse before a parent resets the week. Prayer records `prayedBy` but does not credit stars; only opening Kid Verse does.
- **Found by** the completeness critic.

**What happens now.** `applyLedger` marks `'reset'` only the story and prayed days already credited `=== true` (`apps/kidverse.html:457`). `reconcile()` applies the ledger first (`:471`), then credits every uncredited story and prayed day in the 14-day look-back with a fresh `earnedAt` (`:473-474`), which is later than the reset's `at`, so the `before()` check (`:453`) never catches them. The shell's confirm text and Me line are computed only from the mirror plus the ledger (`index.html:1348, 1363, 1373`), so the parent is never told about uncredited days.
- Typical data, Kiara. She opens Kid Verse (count 1, total 4, no prayed credit today) and closes it, then taps Prayed on a family card (`prayer:s004` `prayedBy[today] = ['Kiara']`).
- Mom taps Reset week. The confirm reads "This week's 1 star comes off the balance", and Me reads "★3 to cash in · 0 this week".
- Kiara opens Kid Verse. The reset is applied (Monday's verse `'reset'`, total 3), then today's prayed day is credited, stamped after the reset (`earnedAt` 1790272810540 > `at` 1790272809372): count 1, total 4, "1 star this week".
- With a second prayed mark on an earlier day of the same week, both skeptics saw both days credited: count 2, total 5, "2 stars this week · 5 all time", and Me later "★5 to cash in · 2 this week · 6 ever".

**Expected.** A reset clears the week so far (CLAUDE.md: "Reset week clears this week so far … so nothing is re-earned or re-credited that day"). A story or prayed mark dated before the reset's date is marked `'reset'`, not credited. For the reset's own date a fix needs a time on the mark: `prayedBy[date]` carries none, and a prayer made after the reset that day should still earn.

**Why it matters to the household.** The parent sees the week cleared; then the kid's card shows stars for that same week and the balance goes back up, even above its pre-reset figure.

**Evidence.**
- Code: `apps/kidverse.html:453-457, 471-474`; `index.html:1341, 1348, 1370-1374`; `apps/prayer.html:1598-1602`.
- Run: `audits/evidence/p3/kidverse/critic-reset-uncredited-prayed.json` (`s0 {count:1, total:4, prayedToday:null}`; prayer `prayedByToday ['Kiara']`; `meAfter` "★3 to cash in · 0 this week"; `s2_afterKidVerse {count:1, total:4, earned:5, prayedToday:true, earnedAtPrayedToday:1790272810540}`; ledger `at` 1790272809372).
- Screenshots: `audits/evidence/p3/kidverse/critic-reset-uncredited-prayed-kiara-after.png`, `audits/evidence/p3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-2-kiara-after.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/critic-reset-uncredited-prayed.mjs"` (typical, real clock; Kiara prays through the kid Prayer view's `[data-kpray]` button; Mom resets through Home → Me with the confirm accepted; about 15 s).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read `apps/kidverse.html:447-462, 469-474` and `index.html:1340-1375`, and ran `node "audits/tools/phase3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-1.mjs"` on a fresh typical instance (real clock, WebKit). Mark A: Kiara taps Prayed today in the kid Prayer view. Mark B, as setup standing in for a Tuesday tap: `prayedBy['2026-09-22'] = ['Kiara']` on a second family card through the batch API (status 200).
  - Me before "★4 to cash in · 1 this week"; after the reset "★3 to cash in · 0 this week · 4 ever". Reset row `{date 2026-09-24, days 21-24, at 1790273171209}`.
  - After Kiara opens Kid Verse: `{count 2, total 5, earned 6, days {21:'reset'}, prayed {24, 22}}`, both `earnedAt` 1790273172422, later than `at`. Kiara sees "2 stars this week · 5 all time"; Me later "★5 to cash in · 2 this week · 6 ever".
  - Evidence: `audits/evidence/p3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-1.json`, `audits/evidence/p3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-1-kiara-after.png`.
- **Skeptic 2** re-read `apps/kidverse.html:442-477` and `index.html:1330-1376`, checked `audits/02-shell.md` for a duplicate (none), and ran `node "audits/tools/phase3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-2.mjs"`. Mark A: today's UI tap. Mark B: `prayedBy['2026-09-21'] = ['Kiara']` written as Kiara in the shape Prayer writes (`apps/prayer.html:1598-1602`).
  - Reset row `{date 2026-09-24, days 21-24, at 1790273193945}`; Me after "★3 to cash in · 0 this week · 4 ever".
  - After Kiara reopens Kid Verse: `{count 2, total 5, earned 6, prayed {21, 24}}`, both stamps 1790273195120. Me later "Kiara ★5 to cash in · 2 this week · 6 ever".
  - Evidence: `audits/evidence/p3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-2.json`, `audits/evidence/p3/kidverse/verify-critic-reset-misses-uncredited-prayed-days-4-2-kiara-after.png`.

**Corrected claim.**
- Broader than the critic stated: it is not only a same-day race. Every story or prayed mark in the week that Kid Verse has not yet credited escapes the reset, including days the reset row lists (Monday 21 and Tuesday 22 reproduced), so the balance can end above its pre-reset figure. Severity medium, not low.
- The earlier-day marks were written through the API as setup, because Prayer's UI writes only today. The trigger itself, the reset and the kid opening Kid Verse, ran through the shipped UI.
- Story days take the same code path (`apps/kidverse.html:473`); not run.
- The same-day case is ambiguous: `prayedBy[date]` records no time of day.

#### P3-KIDVERSE-14 — Done ★ and "I heard it" set `--accent` to gold but paint in the kid's own colour (teal for Ezra)

- **Severity: low** (skeptics: low / low; unchanged from the critic's rating). Cosmetic: both buttons work and stay readable; only the colour the app asks for is lost. No data, flow or privacy impact.
- **Related.** Formerly VIS-KIDVERSE-4. The completeness critic reclassified it as a bug, since the app's own CSS says what it means and does not achieve it. It is not a Phase 2 duplicate: `audits/02-shell.md` covers the pale dark `--accent-deep` on the hero, a contrast problem.

**What happens now.** The app sets `--accent: var(--gold)` on `.btn.done` and `.btn.story-heard` (`apps/kidverse.html:55, 137`). Both are `btn btn-primary` (`:160, 173`), and `.btn-primary` paints from `--accent-deep` (`apps/design.css:361`). design.css declares `--accent-deep` on `:root` as `color-mix(in srgb, var(--accent) 72%, black)` (`apps/design.css:89`; 58% white in the dark palette at `:170`), so it resolves there, and the buttons inherit the resolved person colour; the glow (`:101`) too.
- Ezra (`#137F77`): a dark teal Done ★ in Hearth, pale teal with dark ink in Midnight.
- Kiara (`#B4861B`): her colour is the same value as Hearth's `--gold`, so her buttons are already gold in Hearth, and a slightly different gold in the other palettes.
- The earned `.today` state paints `--gold-soft` directly and is right.
- The fix pattern is already in the repo: `apps/verses.html:56-58` overrides `--accent-deep` together with `--accent`.

**Expected.** The star buttons are gold for every kid, as the override intends: redeclare `--accent-deep` (and the glow) on them, or paint them from `--gold` / `--gold-ink` directly.

**Why it matters to the household.** For pre-readers, colour carries meaning: the star button changes colour with whoever is signed in, and the code does not do what it says.

**Evidence.**
- Code: `apps/kidverse.html:55, 137, 160, 173`; `apps/design.css:89, 101, 170, 361`; `apps/verses.html:56-58`.
- Runs: `audits/evidence/p3/kidverse/visual.json` A (element `--accent` `#B4861B` vs `--accent-deep` from `#137F77`); `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-1.json`; `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-2.json`.
- Screenshots: `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-1-ezra-hearth-done.png`, `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-1-ezra-midnight-done.png`, `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-1-kiara-hearth-done.png`, `audits/screens/kidverse/kid-typical-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/kidverse/visual.mjs"` (section A prints the computed `--accent`, `--accent-deep` and background of `#done` for Ezra and Kiara).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** read `apps/kidverse.html:55, 137, 160, 173` and `apps/design.css:89, 101, 130, 150, 170, 361`, and ran `node "audits/tools/phase3/kidverse/verify-critic-star-buttons-not-gold-5-1.mjs"` (typical, WebKit iphone-pwa 430, standalone, Ezra and Kiara in Hearth and Midnight, with a probe `.btn-primary` that redeclares `--accent-deep` from `--gold`).
  - Ezra, Hearth: on `#done` the element `--accent` is `#B4861B` (the override applies) but `--accent-deep` is `color-mix(in srgb, #137F77 72%, black)`; the fill runs from `color(srgb 0.167 0.436 0.416)` to `(0.054 0.359 0.336)`, teal. `#story-heard` is identical. The gold probe runs `(0.567 0.453 0.187)` to `(0.508 0.378 0.076)`.
  - Ezra, Midnight: pale teal `(0.528 0.744 0.728)` with ink `rgb(23,18,14)`.
  - Kiara, Hearth: identical to the gold probe. Kiara, Midnight: `(0.850 0.758 0.544)`, derived from `#B4861B` rather than Midnight's `--gold` `#E0B25A`.
  - Evidence: `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-1.json`, `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-1-ezra-hearth-done.png`.
- **Skeptic 2** read the same lines plus `apps/hub.js:80` and `apps/verses.html:56-58`, and ran `node "audits/tools/phase3/kidverse/verify-critic-star-buttons-not-gold-5-2.mjs"` with a control that re-derives `--accent-deep` on the button itself.
  - Ezra, Hearth: paints `(0.0536 0.3586 0.336)`, teal; re-derived it would be `(0.5082 0.3784 0.0762)`, gold. Midnight: `(0.463 0.709 0.691)` vs `(0.929 0.825 0.625)`.
  - Kiara, Hearth: painted and re-derived are identical. Midnight: `(0.829 0.725 0.481)` vs `(0.929 0.825 0.625)`, both gold.
  - Evidence: `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-2.json`, `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-2-ezra-hearth-done.png`.

**Corrected claim.** The mechanism is right. The earlier text (VIS-KIDVERSE-4) called Kiara's buttons "ochre" as if that were not gold: her family colour `#B4861B` is Hearth's `--gold`, so in Hearth her buttons are the intended gold. The visible mismatch is Ezra's teal in every palette, and Kiara's only in the palettes whose `--gold` differs from `#B4861B` (Parchment, Frost, Midnight, Forest), where hers is a slightly different gold.

### Usability, visual and gap findings

These were not adversarially verified. Items marked "from the visual check" were added or widened by the independent visual checker.

**UX**

- **UX-KIDVERSE-1 — Several kid steps need reading: identical "Read it to me" buttons, the "I heard it" check, and text-only toasts** (medium).
  - Verse: speaker, then star, works by icon and position, but Done ★ is off the first iPhone screen and nothing tells the child to listen first.
  - Story: the second card repeats the same speaker button and label, so the two differ only by position (also from the visual check). "I heard it" is a check whose meaning is only in text (`apps/kidverse.html:665`).
  - Every toast is text and none is spoken: already, badge, cash-in, reset, cannot read aloud (`:301, 328, 480, 484, 636, 641`). The spoken text gives no next step.
  - After a reset or past midnight a pressed "Done today ★" can show beside 0 stars.
  - The house style asks that kid flows be completable by icon, colour and position alone.
  - Evidence: `audits/evidence/p3/kidverse/taps.json` (`doneAboveFold: false` on iphone-pwa); `audits/evidence/p3/kidverse/webtells-toast-over-content.png`; `audits/screens/kidverse/kid-story-typical-iphone-pwa-light.png`; `audits/screens/kidverse/kid-rewards-typical-iphone-pwa-light.png`; `audits/screens/kidverse/kid-week-reset-typical-iphone-safari-light.png`.
- **UX-KIDVERSE-2 — Done ★ is below the first screen on iPhone, iPad landscape and desktop; "I heard it" is two screens down** (medium).
  - Standalone at 430×932 the scene art takes 274 px; Done ★ spans 851-935 px, so in the shell (48 px viewer bar) only its top edge shows; the stars card starts at 951 px, "I heard it" at 1713 px, on a 2304 px page.
  - iPad portrait shows Done ★ and the star count on the first screen (`taps.json` `doneAboveFold: true`).
  - Evidence: `audits/evidence/p3/kidverse/visual.json` P; `audits/evidence/p3/kidverse/visual-P-kid-iphone-first-screen.png`; `audits/screens/kidverse/kid-typical-iphone-pwa-light.png`; `audits/screens/kidverse/kid-typical-ipad-landscape-light.png`; `audits/screens/kidverse/kid-typical-desktop-light.png`.
  - Run: `node "audits/tools/phase3/kidverse/visual.mjs"` (P) and `taps.mjs`.
- **UX-KIDVERSE-3 — Guests can step the household's memory-verse week** (low).
  - Guests are kind "adult" (`worker/src/index.js:196-198`), and the stepper checks only `kind === 'adult'` and `canWrite` (`apps/kidverse.html:337, 369`). When Grandma Jo tapped +, the row became `{week:39, by:'guest-grandmajo'}`.
  - CLAUDE.md lets guests use every adult app, so this is not a bug; but it puts a household setting in a visitor's hands, while Me's Kids' rewards card is household-adults only.
  - Evidence: `audits/evidence/p3/kidverse/adult-week.json` B_server; `audits/evidence/p3/kidverse/adult-week-B-guest-stepper.png`; `audits/screens/kidverse/adult-guest-typical-iphone-pwa-light.png`.
- **UX-KIDVERSE-4 — After a parent's Reset week, the stars card says "No stars yet" while the story card says "Heard 1 day this week"** (low).
  - A reset marks credited days "reset" in the stars row (`apps/kidverse.html:451-458`); the story card counts the separate story row (`:661-665`), which a reset does not touch. After a reset of today, Done ★ stays pressed ("Done today ★") beside 0: correct under the one-a-day rule, but it looks like an error to a child.
  - Evidence: `audits/evidence/p3/kidverse/ledger-rules.json` L4 `{done:'Done today ★', starCount:'0', mineSub:'No stars yet this week'}`; `audits/evidence/p3/kidverse/ledger-L4-after-reset-today-spent.png`; `audits/screens/kidverse/kid-week-reset-typical-ipad-portrait-light.png`.
- **UX-KIDVERSE-5 — With no family week set, Kid Verse silently shows week 1** (low).
  - `clampWeek(undefined)` is 1 (`apps/kidverse.html:253, 276`). An empty household sees Genesis 1:27 and the creation art as if an adult had chosen it, with no prompt to pick a week.
  - Evidence: `audits/screens/kidverse/kid-empty-iphone-pwa-light.png`; `audits/screens/kidverse/adult-empty-iphone-pwa-light.png`.
- **UX-KIDVERSE-6 — On a cold load: "…" placeholders and the week-1 art for about 4.7 s, then a 368 px jump** (low).
  - On a new phone with every GET held 1.5 s: at 87 ms the frame showed "…" for the reference and paraphrase, the hard-coded 01-creation art (`apps/kidverse.html:147, 166`), no Done ★ and the story card top at 770 px. At about 4.67 s the art switched to 12-church, Done ★ appeared at 851 px and the story card moved to 1138 px. No skeleton.
  - From the visual check: while loading, the action row holds a lone half-width "Read it to me" and the who pill is an empty glass capsule; both change size when the data lands.
  - Evidence: `audits/evidence/p3/kidverse/webtells.json` (load.first → load.last); `audits/screens/kidverse/kid-loading-iphone-pwa-light.png`; `audits/screens/kidverse/kid-loading-ipad-portrait-dark.png`.
  - Run: `node "audits/tools/phase3/kidverse/webtells.mjs"`.
- **UX-KIDVERSE-7 — Offline, a star shows as earned with no sign that it has not been saved** (low).
  - Offline, Done ★ painted "Done today ★" and ★4 with the write only queued (`stars` in the queue). The frame has no offline or pending wording, and the viewer bar has none. Back online, the write landed.
  - The mechanism is Phase 2's unnumbered Sync UX note (`audits/02-shell.md:2910`), which confirmed this lead by mechanism (`audits/02-shell.md:2916`).
  - Evidence: `audits/evidence/p3/kidverse/offline.json`; `audits/evidence/p3/kidverse/offline-kid-after-done.png`; `audits/screens/kidverse/kid-offline-iphone-pwa-light.png`.
  - Run: `node "audits/tools/phase3/kidverse/offline.mjs"`.
- **UX-KIDVERSE-8 — Text-only toasts about 96 px tall cover the story card and cannot be dismissed** (low).
  - The "already" toast sat at 764-859 px (viewport 884) over `#story-kick` and the story head. The "New badge" toast covers the Prayer warrior date and the footnote (from the visual check).
  - Evidence: `audits/evidence/p3/kidverse/webtells.json` toast; `audits/evidence/p3/kidverse/webtells-toast-over-content.png`; `audits/evidence/p3/kidverse/star-rules-R5-kiara-prayer-warrior.png`; `audits/screens/kidverse/kid-award-empty-iphone-pwa-light.png`.
- **UX-KIDVERSE-9 — Badge and payout dates have no year** (low).
  - `fmtDay` formats month and day only (`apps/kidverse.html:490, 498-499`). Overflow Ezra's badges from 2025 read "Jul 28" and "Jul 30"; "Last cashed in: 13 stars on Mar 1."
  - Evidence: `audits/evidence/p3/kidverse/rowsize.json`; `audits/evidence/p3/kidverse/rowsize-overflow-ezra-rewards.png`.
- **UX-KIDVERSE-10 — For adults, their own panel is two or more screens below the kid art** (low; from the visual check).
  - Adults get the full kid layout first: the scene, the reference and two cards. The Kids' stars panel and the week stepper, the adult's job here, sit two or more screens down on desktop, iPad and iPhone.
  - Evidence: `audits/screens/kidverse/adult-verse-typical-desktop-light.png`; `audits/screens/kidverse/adult-empty-ipad-portrait-light.png`; `audits/screens/kidverse/adult-typical-iphone-pwa-light.png`.

**Visual**

- **VIS-KIDVERSE-1 — Day-dot letters, 10 px badge hints and the unearned "50" glyph fail text contrast** (medium).
  - Rendered contrast (lib-vis `contrastSweep`, 430 px, kid and adult): day letters (`--muted-decor` on `--surface-2`) 2.22:1 Hearth, 2.09:1 Parchment, 2.08:1 Frost, 3.18:1 Midnight, 3.11:1 Forest, at 12 px on the kid card and 10 px in the adult panel; badge hints 10 px at 4.37-4.45:1; the unearned "50" glyph (22 px) 2.49-2.79:1. All primary text passes.
  - The checker measured the dark day-letter glyph at 2.79:1 against the card (the investigator's 3.1 was against the dot fill).
  - Evidence: `audits/evidence/p3/kidverse/visual.json` C; `audits/evidence/p3/kidverse/vischeck-dark-dots.json`; `audits/screens/kidverse/kid-stars-typical-iphone-pwa-light.png`; `audits/evidence/p3/kidverse/visual-C-kid-forest-rewards.png`.
- **VIS-KIDVERSE-2 — The today ring and the empty day dots are under 3:1 in both schemes** (low; from the visual check).
  - The only cue for today is the `var(--focus)` ring (`apps/kidverse.html:69`): 1.70:1 against the card in light, 1.51:1 in dark. Empty dot discs (`:66`) are 1.20:1 (light) and 1.14:1 (dark). Earned stars float in a mostly invisible strip.
  - Evidence: `audits/tools/phase3/kidverse/vischeck-dark-dots.mjs`; `audits/evidence/p3/kidverse/vischeck-dark-dots.json`; `audits/screens/kidverse/kid-stars-typical-ipad-landscape-dark.png`; `audits/screens/kidverse/kid-stars-typical-ipad-landscape-light.png`.
- **VIS-KIDVERSE-3 — Unearned badges are near-black blanks in dark mode** (low; from the visual check).
  - An unearned badge disc is 1.15:1 against its tile and its glyph barely shows, so the rewards card reads as six dark tiles with no visible goal.
  - Evidence: `audits/screens/kidverse/kid-rewards-empty-ipad-portrait-dark.png`; `audits/evidence/p3/kidverse/visual-C-kid-forest-rewards.png`; `audits/evidence/p3/kidverse/vischeck-dark-dots.json`.
- **VIS-KIDVERSE-4 — moved to P3-KIDVERSE-14** (low). Kept here as a pointer. The completeness critic reclassified it as a bug, because the app's own CSS (`apps/kidverse.html:55, 137`) asks for gold and does not get it, and two skeptics confirmed it. The star buttons paint the kid's `--accent-deep` (`apps/design.css:89, 361`): teal for Ezra in every palette. Kiara's colour equals Hearth's gold, so hers differ only in the other palettes (the earlier "ochre" was wrong).
  - Evidence: `audits/evidence/p3/kidverse/visual.json` A; `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-1-ezra-hearth-done.png`; `audits/evidence/p3/kidverse/visual-C-kid-midnight-top.png`.
- **VIS-KIDVERSE-5 — In the grown-ups panel on iPhone the day dots cover each kid's ★ count** (low; related to P2-VIS-05, which is the shell's Kids card).
  - `.kn` is `flex:1; min-width:0` beside a `flex:0 0 auto` `.days` (`apps/kidverse.html:104-111`), so the name box is 48 px wide: "Ezra ★3" count right edge 151 px vs dots from 149 px; "Kiara ★1" 157 vs 149, so the "1" is hidden. In overflow, "Ezra Bartholomew Anderson ★6" wraps into three lines under the dots.
  - Widened by the visual check: it happens with ordinary names and one-digit counts in normal states: "Kiara ★1" (typical), "Ezra ★0" and "Kiara ★0" (stalled), "Kiara ★" (guest).
  - Evidence: `audits/evidence/p3/kidverse/visual.json` G.kidsOverlap; `audits/evidence/p3/kidverse/visual-G-adult-kids-panel-overflow-430.png`; `audits/screens/kidverse/adult-typical-iphone-pwa-light.png`; `audits/screens/kidverse/adult-stalled-loading-iphone-pwa-dark.png`; `audits/screens/kidverse/adult-guest-typical-iphone-pwa-dark.png`.
- **VIS-KIDVERSE-6 — The story art's background is fixed: a pale panel on dark pages, and two dark slabs on light pages** (low).
  - The scene SVGs carry their own full-bleed background (for example `art/story/12-church.svg:2`, `#DCECEA`). Loaded as `<img>`, no theme token reaches them, and the pale block glares on Midnight and Forest (688 px wide on desktop and iPad).
  - Widened by the visual check: 10 of 12 scenes are pale; `art/story/03-promise.svg:2` and `art/story/09-nativity.svg:2` paint `#2A2F4A`, a dark slab in light themes.
  - Evidence: `audits/screens/kidverse/kid-typical-desktop-dark.png`; `audits/evidence/p3/kidverse/visual-C-kid-midnight-top.png`.
- **VIS-KIDVERSE-7 — 10 px text, adult-sized 12 px captions in kid mode, and serif big numerals** (low).
  - Badge hints (`apps/kidverse.html:86`) and adult panel dot letters (`:110`) are 10 px, below the 11 px floor.
  - In kid mode the kicker, disclaimer, story span, badge names and how-to line stay at 12 px, because `--fs-xs` is not in the kid block (`apps/design.css:280-284`).
  - The big numerals (star count 44 px, balance 44 px, week 28 px) are `--font-display` = ui-serif (`apps/kidverse.html:62, 78, 99`; `apps/design.css:19-20`), not ui-rounded.
  - Evidence: `audits/evidence/p3/kidverse/visual.json` T; `audits/screens/kidverse/kid-rewards-typical-iphone-pwa-light.png`; `audits/screens/kidverse/kid-stars-overflow-ipad-portrait-light.png`.
- **VIS-KIDVERSE-8 — Glass is used on content, and the story buttons are not concentric** (low).
  - Backdrop blur(18px) on `.scene.glass-strong` (a 398×274 content card, `apps/kidverse.html:147`), the static `#who` pill (`:146`) and the non-floating `#say` / `#story-say` `.btn-glass` buttons (`:159, 172`).
  - `#story-say` has radius 28 inside the story card's 28 at a 21 px inset (want 7) for adults.
  - Evidence: `audits/evidence/p3/kidverse/visual.json` G.ezra.glass, G.eli.radii; `audits/screens/kidverse/kid-typical-ipad-portrait-light.png`; `audits/screens/kidverse/adult-typical-iphone-pwa-light.png`.
- **VIS-KIDVERSE-9 — Button labels repeat their own icon, and the stepper uses text − and +** (low).
  - A star SVG beside "Done ★" / "Done today ★" (`apps/kidverse.html:160, 359`), a check SVG beside "Heard it today ✓" (`:173, 663`); the stepper's − and + are text glyphs (`:369`); three badges use the numerals 7, 10 and 50 as glyphs.
  - Evidence: `audits/screens/kidverse/kid-stars-overflow-ipad-portrait-light.png`; `audits/screens/kidverse/adult-typical-iphone-pwa-light.png`.
- **VIS-KIDVERSE-10 — No touch-callout suppression on the story art, and card chrome text is selectable** (low; the iOS image menu needs a device).
  - `#art` has no `-webkit-touch-callout` and is draggable; the pill, stars card and badges are `user-select: text`; only `.btn` is `none`.
  - Evidence: `audits/evidence/p3/kidverse/webtells.json` css.
- **VIS-KIDVERSE-11 — The rewards summary wraps with a dangling separator** (low; from the visual check).
  - With a large balance at 430 px, "· 6 this week ·" ends line 1 with a dot and "867 ever" sits alone on line 2.
  - Evidence: `audits/screens/kidverse/kid-rewards-overflow-iphone-pwa-dark.png`; `audits/screens/kidverse/kid-story-overflow-iphone-pwa-light.png`.

**Gap**

- **GAP-KIDVERSE-1 — The family week never advances by itself, and changing it tells nobody** (low).
  - `setWeek` writes only `{week, by, at}` (`apps/kidverse.html:338`), with no `hub.activity` line. Nothing advances the week with the calendar or F260; the only link is the adult's own "Use week N" hint (`:370`). This also leaves the TV's kid line empty (P2-HOME-07).
  - The year does not wrap either: after week 52 there is no way forward (+ is disabled at 52, `:369`), so returning to week 1 is 51 taps on −, unless the adult's F260 plan is on week 1 and offers "Use week 1" (`:370`). Mom or a guest who does not use F260 has no shortcut.
  - Evidence: `apps/kidverse.html:336-340, 368-370`; `audits/screens/kidverse/adult-f260-hint-typical-iphone-pwa-light.png`.

**What works**

- **OK-KIDVERSE-1 — Within one ISO week, the parent ledger and star rules work as CLAUDE.md states, including cash-ins and resets that race a new star** (info).
  - Cash-in applied once: total 2 → 0, payouts 1 → 2, applied 1 → 2; a second open changed nothing.
  - Cash-in in flight: Kiara, balance 5, ledger amount 4, ended with 1.
  - Reset in flight: Monday's star reset, today's star earned after the reset's timestamp kept (count 1).
  - Reset of today: `days[today]='reset'` and a second Done ★ refused.
  - One star per source per day; the 14-day look-back (day −13 credited, −15 not); badges once with one feed line; mirror identical to the person row; `earnedAt` on the server clock (1790267874848 against server now 1790267877782); the kiosk cannot award or mark heard.
  - The exception is P3-KIDVERSE-01, which wipes `applied` and lets old rows be re-applied.
  - Two more exceptions, found by the completeness critic and confirmed 2/2: a reset applied after the week rolls over keeps the verse stars (P3-KIDVERSE-12, `audits/evidence/p3/kidverse/critic-reset-crossweek.json`), and a story or prayed day not yet credited is credited after a reset (P3-KIDVERSE-13, `audits/evidence/p3/kidverse/critic-reset-uncredited-prayed.json`).
  - Evidence: `audits/evidence/p3/kidverse/ledger-rules.json`; `audits/evidence/p3/kidverse/star-rules.json`; `audits/evidence/p3/kidverse/ledger-L3-after-reset-in-flight.png`.
- **OK-KIDVERSE-2 — ISO-week rollover and the DST change on 2026-11-01 are handled** (info).
  - A Sunday 23:58 star went to 2026-W39; Monday 00:01 gave `{week:'2026-W40', count:1, days:{'2026-09-28':true}}` with the total kept. The DST week's dots ran Oct 26 – Nov 1, and Monday Nov 2 00:10 started 2026-W45. Only an open page stays stale after midnight (P2-STAB-07). This holds for the stars row itself; a parent's reset still pending at the rollover is P3-KIDVERSE-12.
  - Evidence: `audits/evidence/p3/kidverse/dates.json` (W_afterMon, D_sun, D_mon, D_afterMon).
- **OK-KIDVERSE-3 — Big kid targets; read-aloud stops cleanly; confetti honours reduced motion** (info).
  - Every kid control is 356-398 × 84 px; adult controls are at least 60 px.
  - With a stand-in voice: rate 0.85, en-US voice; stops on a second tap, on Escape and when the other read-aloud starts; leaving through "Hub" or `#home` fired `pagehide` → cancel; all 52 references parse to spoken form ("First Samuel, chapter 17, verses 46 to 47").
  - Confetti and the pulse are off under reduced motion (`apps/kidverse.html:119, 141, 317`).
  - Evidence: `audits/evidence/p3/kidverse/visual.json` G targets; `audits/evidence/p3/kidverse/speech.json`; `audits/evidence/p3/kidverse/speech-leave.json`.

### Checked and not a bug

None. No bug, security or perf finding was refuted: all fourteen sent to skeptics (nine from the investigator, five from the completeness critic) were confirmed 2/2. Narrower claims inside confirmed findings that did not hold are corrected in place:
- P3-KIDVERSE-01: a single failed request does not open the window when the shell's own kidverse pull lands (skeptic 1's single-503 arm matched control).
- P3-KIDVERSE-07: renaming a kid does not break the match on the kid's device, which keeps its login-session name (skeptic 2's case B).
- P3-KIDVERSE-11: the tap does not "mark Week 1's story" on the server; the story row stores no F260 week. The week-1 story is only what the kid is shown while the pull is held.
- P3-KIDVERSE-14: Kiara's buttons are not a separate ochre; her colour is Hearth's gold, so the mismatch shows for her only in the other palettes.

### Unresolved — needs a device or more evidence

No verified finding is unresolved. Unverified items that depend on a device:
- **VIS-KIDVERSE-10 (the iOS long-press image menu on the story art).** Settle by long-pressing the scene art on a real iPhone and iPad, in the Home Screen app and inside the hub viewer.
- **Read-aloud on iOS (OK-KIDVERSE-3).** Settle by playing the verse and story on a real iPhone and iPad: the chosen voice, cancel-then-speak, and whether speech stops when the viewer closes.

## 5. Visual fidelity

### Rubric scores

| Dimension | Investigator | Checker | Final | Provisional? | Reason | Evidence |
|---|---|---|---|---|---|---|
| Typography | 6 | 5 | **5** | Yes (fallback fonts in the rig) | A clear kid hierarchy (64 px reference, 34 px paraphrase, 22 px buttons). Against: 10 px badge hints and adult dot letters (under the 11 px floor, which the shell never broke), kid captions left at 12 px, weight-400 serif titles, and serif big numerals where the house style asks for ui-rounded. | `audits/screens/kidverse/kid-typical-ipad-portrait-light.png`, `audits/screens/kidverse/kid-rewards-typical-iphone-pwa-light.png`, `audits/screens/kidverse/adult-typical-iphone-pwa-light.png`, `audits/screens/kidverse/kid-stars-overflow-ipad-portrait-light.png` |
| Color & palette | 6 | 5 | **5** | No | A warm gold wash and gold-soft chips, every colour a token. Against: the same earthy Hearth base the shell scored 4 for; Done ★ in each kid's accent instead of gold (P3-KIDVERSE-14); day letters about 2.1:1; the today ring 1.70:1 and empty dots 1.20:1 in light (checker); fixed art panels. | `audits/screens/kidverse/kid-typical-iphone-pwa-light.png`, `audits/screens/kidverse/kid-stars-typical-iphone-pwa-light.png`, `audits/evidence/p3/kidverse/visual-A-kiara-done-button.png`, `audits/screens/kidverse/kid-stars-typical-ipad-landscape-dark.png` |
| Layout & spacing | 6 | 5 | **5** | No | A generous 4/8 rhythm and 16 px margins in one readable column. Against: on iPhone Done ★ only peeks in at the bottom edge and on iPad landscape it is fully below the fold (checker's correction); the story card is two screens down; the grown-ups panel hides counts with ordinary data ("Kiara ★1", "Ezra ★0"); the adult's own panel is 2+ screens below the kid art. | `audits/screens/kidverse/kid-typical-iphone-pwa-light.png`, `audits/screens/kidverse/adult-typical-iphone-pwa-light.png`, `audits/evidence/p3/kidverse/visual-G-adult-kids-panel-overflow-430.png`, `audits/screens/kidverse/adult-stalled-loading-iphone-pwa-dark.png`, `audits/screens/kidverse/kid-typical-ipad-landscape-light.png` |
| Shape, depth & material | 6 | 5 | **5** | Yes (real blur not visible in the rig) | Large continuous radii and soft cards. Against: a thick glass bezel around the art, a glass static pill and glass non-floating buttons, and story buttons not concentric with their card: the same pattern the shell scored 5 for. | `audits/screens/kidverse/kid-typical-ipad-portrait-light.png`, `audits/screens/kidverse/kid-stars-overflow-ipad-portrait-light.png`, `audits/screens/kidverse/kid-typical-desktop-dark.png` |
| Iconography | 6 | 6 | **6** | No | A consistent rounded-stroke set (speaker, star, check, book, heart). Against: labels repeat their icon ("★ Done today ★"), text −/+, and numerals 7/10/50 as badge glyphs. | `audits/screens/kidverse/kid-rewards-typical-iphone-pwa-light.png`, `audits/screens/kidverse/kid-stars-overflow-ipad-portrait-light.png`, `audits/screens/kidverse/adult-typical-iphone-pwa-light.png` |
| Motion & feedback | 6 | 4 | **5** (judge) | Yes (motion not visible in stills) | The award tap does more than toast: the button turns into the tan "Done today ★", the day's dot fills and the count moves; press scale .96 (`apps/design.css:359`); the pulse runs only while reading; a calm 1.2 s confetti; both off under reduced motion. Against: text-only toasts over content, the cold-load "…" and wrong art with a 368 px jump, and no spring or interruptible transitions of its own. The shell's cash-in `confirm()` and P2-STAB-01 are not counted against the app. | `audits/screens/kidverse/kid-award-empty-iphone-pwa-light.png`, `audits/evidence/p3/kidverse/webtells-toast-over-content.png`, `audits/evidence/p3/kidverse/star-rules-R5-kiara-prayer-warrior.png`, `audits/screens/kidverse/kid-loading-ipad-portrait-dark.png` |
| Dark mode | 5 | 4 | **4** | No | Tokens flip in Midnight and Forest. Against: a large pale art panel glares; Done ★ turns pale teal with dark ink; the day-letter glyph is 2.79:1 and the dot discs 1.14:1 against the card, the today ring 1.51:1, and unearned badge discs 1.15:1, so the week strip and unearned badges almost vanish. | `audits/screens/kidverse/kid-typical-desktop-dark.png`, `audits/evidence/p3/kidverse/visual-C-kid-midnight-top.png`, `audits/evidence/p3/kidverse/visual-C-kid-forest-rewards.png`, `audits/screens/kidverse/kid-stars-typical-ipad-landscape-dark.png`, `audits/screens/kidverse/kid-rewards-empty-ipad-portrait-dark.png` |
| Native feel | 5 | 5 | **5** | Yes (iOS callout needs a device) | No tap highlight, no in-app dialogs, focus rings on keyboard only, no tap delay. Against: the loading state ("…", the week-1 art for everyone, an empty glass pill, a half-width orphan Read button); art that can be long-pressed and dragged; selectable chrome text. | `audits/screens/kidverse/kid-loading-iphone-pwa-light.png`, `audits/screens/kidverse/kid-loading-ipad-portrait-dark.png`, `audits/evidence/p3/kidverse/webtells-toast-over-content.png` |
| Glanceability | 5 | 5 | **5** | No | The reference, 64 px on the kid iPad, reads to about 1.7 m; the star count to about 1.2 m; everything else under 1 m. On iPad portrait the star count and "3 stars this week" are on the first screen, only the dots cut off (checker's correction); below the fold elsewhere. A hands-on screen, so 5 against the shell's 4. | `audits/evidence/p3/kidverse/visual-K-kid-ipad-portrait-first-screen.png`, `audits/screens/kidverse/kid-typical-ipad-landscape-light.png` |
| Ease of use | 6 | 6 | **6** | No | Two taps to today's star; Done ★ and "I heard it" carry an icon, a colour and an 84 px target. Against: a scroll on iPhone, two identical "Read it to me" buttons, all feedback in text, a ±1 stepper, and cash-in through the shell's `confirm()`. | `audits/evidence/p3/kidverse/taps-K1-iphone-after-done.png`, `audits/screens/kidverse/kid-typical-iphone-pwa-light.png`, `audits/screens/kidverse/kid-story-typical-iphone-pwa-light.png`, `audits/screens/kidverse/kid-week-reset-typical-iphone-safari-light.png` |
| Delight | 7 | 6 | **6** | No | Story art, the kid's own name in the kicker, read-aloud, confetti and gold badges that fill in. Against: 12 flat scenes serve 52 weeks, so the art repeats about every four weeks; no confetti frame is visible in any capture; in dark mode the art glares and unearned badges turn to blanks. Level with the shell's 6. | `audits/screens/kidverse/kid-stars-overflow-ipad-portrait-light.png`, `audits/evidence/p3/kidverse/star-rules-R5-kiara-prayer-warrior.png`, `audits/screens/kidverse/kid-rewards-typical-iphone-pwa-light.png`, `audits/screens/kidverse/kid-rewards-empty-ipad-portrait-dark.png` |

Average: (5 + 5 + 5 + 5 + 6 + 5 + 4 + 5 + 5 + 6 + 6) / 11 = 57 / 11 = **5.2**. The investigator's average was 5.8 (64 / 11) and the checker's 5.1 (56 / 11); the shell's in Phase 2 was 4.9.

**How the scores were checked.**
- **What the checker opened:** 41 screenshots: all 19 the investigator cited, 20 more captures across iPad portrait and landscape, iPhone PWA and Safari and desktop, light and dark, in the empty, typical, overflow, loading, stalled, offline, reset and cash-in states, and the `kidverse--kid` and `kidverse--adult` contact sheets. It also pixel-sampled three captures with `audits/tools/phase3/kidverse/vischeck-dark-dots.mjs`.
- **Agreed:** 4 of 11 dimensions (Iconography, Native feel, Glanceability, Ease of use).
- **Adjusted by one point:** 6 dimensions, mainly to calibrate against the shell's Phase 2 scores for the same shared patterns.
  - **Typography 6 → 5:** 10 px text (the shell had nothing under 12 px), the weight-400 serif titles the shell was docked for, serif numerals.
  - **Color & palette 6 → 5:** the same earthy Hearth tokens the shell scored 4 for; the today ring and empty dots under 3:1; the star colour changing with the kid.
  - **Layout & spacing 6 → 5:** the panel overlap happens with ordinary data, not only long names; the adult panel is far down.
  - **Shape, depth & material 6 → 5:** the same glass-on-content and non-concentric pattern as the shell's 5.
  - **Dark mode 5 → 4:** the dot discs, today ring and unearned badges nearly vanish; the pale panel glares.
  - **Delight 7 → 6:** 12 scenes for 52 weeks; no visible confetti; dark-mode blanks.
- **Judge:** ruled on 1 dimension. **Motion & feedback:** investigator 6, checker 4 (the same kind of cold-load jump and text-only toasts that got the shell a 3). The judge set **5**: the award tap gives more than a toast (`audits/screens/kidverse/kid-award-empty-iphone-pwa-light.png`), the press scale, the pulse and the confetti are real and honour reduced motion (`apps/kidverse.html:114-119, 316-317`; `apps/design.css:359`), while the cash-in `confirm()` and P2-STAB-01 belong to the shell. The toasts over content and the cold-load swap keep it well short of polished.
- **Claims the checker corrected:** on iPhone PWA Done ★ peeks in at the bottom edge (not fully hidden); on iPad portrait the star count is on the first screen; the dark day-letter glyph is 2.79:1 against the card; 10 of 12 scenes are pale and two are dark; the art serves 52 weeks with 12 scenes.

### Deviations from the house style

Each is marked with the visual checker's verdict.

| Area | Deviation | Checker | Evidence |
|---|---|---|---|
| Type scale | Badge hints and adult panel day letters 10 px (under 11). Kid captions (kicker, disclaimer, story span, badge names, how-to) stay 12 px because `--fs-xs` is not raised for kids. The adult body is 18 px, not Dynamic Type 17. The kid reference is `clamp(40px, 11vw, 64px)`, a literal. | Supported | `apps/kidverse.html:37, 86, 110`; `apps/design.css:280-284`; `audits/evidence/p3/kidverse/visual.json` T |
| Font stacks | `--font-sans` starts with ui-rounded for everyone, adult text included. The big numerals (star count, balance, week) are ui-serif, not ui-rounded. | Supported (rounded vs system cannot be seen in the rig) | `apps/design.css:18-20`; `apps/kidverse.html:62, 78, 99` |
| Palette / contrast | Day letters 2.08-2.22:1 light and 3.11-3.18:1 dark (against the dot fill); 10 px hints 4.37-4.45:1; unearned "50" 2.49-2.79:1. Checker's addition: the today ring 1.70 light / 1.51 dark, dot discs 1.14-1.20 against the card. | Supported, with the checker's addition | `audits/evidence/p3/kidverse/visual.json` C; `audits/evidence/p3/kidverse/vischeck-dark-dots.json` |
| Accent / semantic | The gold star buttons paint the person's `--accent-deep` (teal for Ezra; Kiara's colour equals Hearth's gold, so hers differ only in the other palettes), so the star colour depends on who is signed in. Filed as a bug, P3-KIDVERSE-14 (formerly VIS-KIDVERSE-4). Profiles are told apart by avatar plus name, which is good. | Supported | `audits/evidence/p3/kidverse/visual.json` A; `apps/design.css:89, 361`; `audits/evidence/p3/kidverse/visual-A-kiara-done-button.png` |
| Radii | `#story-say` r28 inside the story card's R28 at a 21 px inset (want 7) | Supported | `audits/evidence/p3/kidverse/visual.json` G.eli.radii; `audits/screens/kidverse/adult-typical-iphone-pwa-light.png` |
| Glass | Glass on content: the scene art card (`.glass-strong`, 398×274), the static who pill, non-floating `.btn-glass` buttons | Supported | `apps/kidverse.html:147, 159, 172`; `audits/evidence/p3/kidverse/visual.json` G.ezra.glass |
| Icons | Icons repeated in labels; text − and + on the stepper; numerals as badge glyphs | Supported | `apps/kidverse.html:160, 359, 369, 663`; `audits/screens/kidverse/kid-stars-overflow-ipad-portrait-light.png` |
| Spacing | Off-grid gaps of 6 px (kid dots) and 2 px (story head); 28 px adult dots and 44/48 px badge icons as literals | Supported | `apps/kidverse.html:70, 83, 92, 110, 125`; `audits/evidence/p3/_compliance/kidverse.json` |
| Tap targets | None under 44; kid controls 84 px; the adult stepper 60 px; the 28 px adult dots are not interactive | Partly (consistent with the captures; rests on the measurement) | `audits/evidence/p3/kidverse/visual.json` G targets |
| Motion | A 1.1 s pulse and 1.2 s confetti (ambient, outside 200-350 ms); toasts of 2.2-3.2 s that cannot be dismissed; a 368 px cold-load jump; no sheets | Partly (the toasts over content are visible; timings and the jump rest on code and `webtells.json`) | `apps/kidverse.html:57, 117, 139, 480, 484`; `audits/evidence/p3/kidverse/webtells.json` |
| Dark surfaces | The story art's fixed pale panel glares on dark pages; Done ★ becomes pale teal with dark ink. Wider than stated: 03-promise and 09-nativity are fixed dark slabs on light pages. | Supported, widened | `art/story/12-church.svg:2`; `art/story/03-promise.svg:2`; `art/story/09-nativity.svg:2`; `audits/screens/kidverse/kid-typical-desktop-dark.png` |
| Loading (checker's addition) | A half-width orphan "Read it to me" and an empty glass pill before data lands | Checker's addition | `audits/screens/kidverse/kid-loading-ipad-portrait-dark.png` |
| Wrapping (checker's addition) | The rewards summary breaks after a "·" separator with a large balance | Checker's addition | `audits/screens/kidverse/kid-rewards-overflow-iphone-pwa-dark.png` |

### Web tells

| Tell | Status | Evidence |
|---|---|---|
| Grey tap highlight | Absent | `-webkit-tap-highlight-color: transparent` (`apps/design.css:302, 312`) |
| Long-press callout or selection on chrome | Partly | `.btn` is `user-select: none`; the pill, stars card and badges are `text`; `#art` has no `-webkit-touch-callout` and is draggable (`audits/evidence/p3/kidverse/webtells.json`); the iOS image menu needs a device |
| Default form controls | Absent | No inputs (`webtells.json` inputs 0) |
| Focus rings on touch | Absent | After a tap `focusVisible:false`; after Tab `true` (`webtells.json` focusAfterTap); `apps/design.css:313-314` |
| Blue underlined links | n/a | No links (`webtells.json` links `[]`) |
| White flash on load | Absent | Phase 2 web-tells check; body background `var(--bg)` (`apps/kidverse.html:14`) |
| Rubber-band overscroll mismatch | Needs a device | `overscroll-behavior: none` (`apps/design.css:304`); `background-attachment: fixed` (`apps/kidverse.html:18`) is ignored on iOS |
| Tap delays | Absent | `touch-action: manipulation` on buttons (`apps/design.css:312`; `webtells.json` touchActionBtn) |
| Visible scrollbars on chrome | Absent | `webtells.json` scrollbarWidth 0 |
| Layout shift as data loads | Present | Story card 770 → 1138 px and Done ★ appearing at about 4.7 s on a cold device (`webtells.json` load; UX-KIDVERSE-6) |
| Spinners vs skeletons | Partly | No spinner, but "…" placeholders and the hard-coded week-1 art stand in for a skeleton (`apps/kidverse.html:147, 150, 155, 166, 169`; `audits/screens/kidverse/kid-loading-iphone-pwa-light.png`) |
| `alert()` / `confirm()` / `prompt()` | Absent in the app | `audits/evidence/p3/_compliance/kidverse.json` (bypass lists empty); the shell's Cash in and Reset week use `confirm()` (`index.html:1367, 1373`) |

## 6. Platform compliance

**Data through hub.js.**
- **Calls used:** `hub.ready` (`apps/kidverse.html:514, 671`), `hub.use` (`:512-513`), `hub.get` / `hub.set` / `hub.list`, `hub.onChange` (`:503, 519, 676`), `hub.onSync` (`:504`), `hub.activity` (`:332, 481, 640`), `hub.toast`, `hub.people` (`:367`), `hub.avatarHtml` (`:348`), `hub.canWrite` / `hub.kioskNudge` (`:325, 337, 633`) and `hub.skew` (`:416`).
- **Bypasses: 1.** `localStorage.getItem('hub.cache.kidverse.<scope>[.<pid>]')` at `apps/kidverse.html:467` reads hub.js's private cache format (`apps/hub.js:29`) to test whether a scope has been pulled. `hub.skew` (`:416`) is outside the SDK's documented API. No fetch, XHR, IndexedDB, sessionStorage, external URL or native dialog (`audits/evidence/p3/_compliance/kidverse.json`).
- **Where hub.js itself fails Kid Verse:** `hub.ready` cannot tell "no data yet" from "no data", and every row is whole-value last-write-wins: the roots of P3-KIDVERSE-01 to -03, -10 and -11 (`apps/hub.js:236, 295-296, 334-337`).

**design.css tokens.** The `compliance.mjs` hits were reviewed by hand; the corrected counts:

| Category | Raw hits | Corrected | Notes |
|---|---|---|---|
| Hardcoded colours | 0 hex, 0 rgb/hsl, 0 named; 1 `colorDerived` | **0** | The derived hit is a `color-mix()` of tokens (`apps/kidverse.html:15-17`) |
| Font sizes | 6 | **6** | 16 px `:27`, `clamp(34px, 9vw, 56px)` `:36`, `clamp(40px, 11vw, 64px)` `:37`, 10 px `:86`, 22 px `:106`, 10 px `:110` |
| Radii | 0 | **0** | All 16 uses are tokens |
| Spacing | 4 | **2** | `gap: 6px` (`:70`) and `gap: 2px` (`:125`); `margin: 0 auto` (`:22`) and `padding: 0 var(--sp-2)` (`:34`) are false positives |
| Shadows | 0 | **0** | Token shadows only (`--e1`, `--focus`) |
| Durations | 3 | **3 in CSS, plus 3 in JS** | 1.1 s pulse ×2 (`:57, 139`), 1.2 s confetti (`:117`); JS 1500 ms (`:321`), 2600 ms (`:484`), 3200 ms (`:480`) |
| z-index | 1 | **1** | 50 on the confetti layer (`:115`) |
| Fixed dimensions (not counted by the script) | n/a | **about 41 px literals** | Day dots 36/38/28, icons 20/24/44/48, 64 px minimums, 84 px story art, 560 px breakpoints |
| Undefined tokens | 0 | **0** | 6 local custom properties are defined in the file |
| Inline styles | 1 | **2, both token-based** | Confetti `--x/--c/--d` (`:320`); the scanner missed `--tint` on each kid row (`:372`), which carries the kid's profile colour into the design.css per-person token (`apps/design.css:93`) |
| `prefers-color-scheme` / `:hover` | 0 / 0 | **0 / 0** | |

**Per-profile accent.** `--accent` reaches the app and differs per profile: Ezra `#137F77`, Kiara `#B4861B`, Eli `#4F5D8C` (`audits/evidence/p3/kidverse/visual.json` A). The app's local override `--accent: var(--gold)` on Done ★ and "I heard it" (`apps/kidverse.html:55, 137`) does not work, because `--accent-deep` is resolved on `:root` (`apps/design.css:89`) and `.btn-primary` paints from it (`apps/design.css:361`) (P3-KIDVERSE-14, formerly VIS-KIDVERSE-4).

**Dark mode.**
- No `prefers-color-scheme` and no `data-scheme` selectors; every colour is a token, so all five palettes flip (contrast sweeps in `visual.json` C).
- What does not flip: the story art's fixed backgrounds (VIS-KIDVERSE-6) and the Done ★ fill, which follows the person's `--accent-deep` (P3-KIDVERSE-14). The dots, ring and unearned badges nearly vanish (VIS-KIDVERSE-2, -3).
- Reduced motion is honoured (`apps/kidverse.html:119, 141, 317`). `prefers-reduced-transparency` and `prefers-contrast`: NOT FOUND IN CODE.

## 7. Improvements

Ratio = delight ÷ effort, with S = 1, M = 2, L = 3. None of these adds a routine or reward system (the household declined one; Kid Verse's existing stars are only repaired or clarified), and none touches Prayer's or F260's layouts or ids.

**Polish**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Guard every write until the first pull lands: keep Done ★, "I heard it" and the week stepper disabled (with a skeleton) until both kidverse scopes are pulled, reusing the existing `pulled()` check in `award()`, `heard()` and `setWeek()` | 4 | S | 4.0 | P3-KIDVERSE-01, P3-KIDVERSE-03, P3-KIDVERSE-11; `award-first-pull.json`; `adult-week.json` C; `critic-heard-first2.json` |
| 2 | A day strip that adds up: a mark per source on each day (star, book, heart), an aria-label that counts what is shown, day letters at 4.5:1 and the today ring and empty dots at 3:1 | 4 | S | 4.0 | P3-KIDVERSE-04; VIS-KIDVERSE-1, VIS-KIDVERSE-2 |
| 3 | Done ★ on the first screen: smaller scene art on phones and landscape, or "Read it to me" and Done ★ beside the art | 4 | S | 4.0 | UX-KIDVERSE-2; `visual.json` P |
| 4 | Paint the star buttons gold with the gold fill and ink tokens directly (or redeclare `--accent-deep` on them, as `apps/verses.html:56-58` does), so the star means the same for every kid | 3 | S | 3.0 | P3-KIDVERSE-14 (formerly VIS-KIDVERSE-4); `verify-critic-star-buttons-not-gold-5-1-ezra-hearth-done.png` |
| 5 | Repaint the story card on a week step; show `earned` ("869 ever") or nothing instead of "all time"; add the year to older dates | 2 | S | 2.0 | P3-KIDVERSE-05, P3-KIDVERSE-06, UX-KIDVERSE-9 |
| 6 | Grown-ups panel on iPhone: each kid's count before the dots or on its own line, long names wrapping above the dots | 2 | S | 2.0 | VIS-KIDVERSE-5 |
| 7 | For adults, put the week stepper and Kids' stars first, above the kid art | 2 | S | 2.0 | UX-KIDVERSE-10 |
| 8 | A Reset week that holds: `applyLedger` resets the verse days a reset row lists even after `days` is rebuilt for a new week, and marks story or prayed days dated before the reset `'reset'` instead of crediting them later | 2 | S | 2.0 | P3-KIDVERSE-12, P3-KIDVERSE-13; `critic-reset-crossweek.json`; `critic-reset-uncredited-prayed.json` |

**Missing features**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Pick a week directly (or "Follow my F260 week"), household adults only, with a feed line "This week's verse: James 1:2-4" that also fills the TV's kid line; it also removes the 51 taps back to week 1 at the year's end, since the stepper does not wrap after 52 (`apps/kidverse.html:369-370`) | 3 | S | 3.0 | P3-KIDVERSE-03; UX-KIDVERSE-3; GAP-KIDVERSE-1; P2-HOME-07 |
| 2 | Spoken feedback and instructions for pre-readers ("Tap the star when you are done", "You already have your star today", "New badge: Story lover"), and story buttons that look different from the verse's | 5 | M | 2.5 | UX-KIDVERSE-1; `speech.json` |
| 3 | Highlight each word of the paraphrase and story as it is read, from `SpeechSynthesisUtterance` boundary events | 5 | M | 2.5 | §2 (Books read-aloud, Speak Screen); `speech.json` |
| 4 | Stars and heard days stored so two devices cannot erase each other: one row per earned star (`verse:<date>`, `story:<date>`, `prayed:<date>`) and per heard day, with totals derived, as the ledger does for parents, or a merge on write; prayed days matched by profile id | 3 | M | 1.5 | P3-KIDVERSE-02, P3-KIDVERSE-07, P3-KIDVERSE-10; `stale-device.json`; `critic-heard-races.json` |
| 5 | Story art that follows the theme: dark variants of the pale scenes and light variants of 03 and 09, or a transparent background over a token panel, via `scripts/make-art.mjs` | 3 | M | 1.5 | VIS-KIDVERSE-6 |

**New ideas**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Past weeks shelf: earlier weeks' scene cards a kid can tap to hear an old verse or story again (read-only, no new stars) | 4 | M | 2.0 | §2; only `VERSES[w - 1]` is reachable (`apps/kidverse.html:345`) |
| 2 | Record a parent's voice: an adult records the verse once a week (the media store), and "Read it to me" plays Mom's or Dad's voice instead of the synthetic one | 5 | L | 1.7 | `speech.json`; `worker/src/media.js` |

## App-specific checks

| Check | Result | Evidence |
|---|---|---|
| Pre-reader usability (Ezra, Kiara): each kid flow walked by icon, colour and position | **PARTLY.** The verse flow works by icon and position (speaker, then star). Needs reading: Done ★ below the fold on iPhone, two identical "Read it to me" buttons, "I heard it" explained only in text, every toast, the rewards card beyond the gold/grey state, and the kid Home entry (UX-HOME-7). | `audits/evidence/p3/kidverse/taps.json`; `audits/screens/kidverse/kid-story-typical-iphone-pwa-light.png`; `audits/evidence/p3/kidverse/webtells-toast-over-content.png` (UX-KIDVERSE-1) |
| One star per source per day (verse, story, prayed) | **PASS.** A second Done ★ or "I heard it" the same day gets the "already" toast and writes nothing; a prayed day is credited once across two opens. Exception: a device in a western time zone (P3-KIDVERSE-08). | `audits/evidence/p3/kidverse/star-rules.json` R1-R3 |
| 14-day look-back | **PASS.** Day −13 credited, −15 not. | `audits/evidence/p3/kidverse/star-rules.json` R4 |
| Badges once, with toast and feed line | **PASS.** Prayer warrior awarded once with the single line "Kiara earned the Prayer warrior badge"; a second open shows no toast. Exception: after P3-KIDVERSE-01's overwrite, "First star" is awarded again. | `audits/evidence/p3/kidverse/star-rules.json` R4, R5; `audits/evidence/p3/kidverse/award-first-pull.json` |
| `earnedAt` on the server clock; mirror identical to the person row | **PASS.** `earnedAt` 1790267874848 against server now 1790267877782; `mirrorEqualsPerson` true. | `audits/evidence/p3/kidverse/star-rules.json` R1 |
| Ledger rows applied exactly once; cash-in and reset, including in-flight stars | **PASS within one ISO week** (cash-in 2 → 0 once; in-flight cash-in 5 − 4 = 1; an in-flight reset keeps a later star; a reset of today refuses a second star). **FAIL across a week boundary** (P3-KIDVERSE-12: a reset applied after Sunday midnight keeps the verse stars, 420 instead of 418) **and for story or prayed days not yet credited** (P3-KIDVERSE-13: credited after the reset, ★4 → ★3 → ★5). **FAIL** after P3-KIDVERSE-01: `applied` is wiped and old stars are re-credited. | `audits/evidence/p3/kidverse/ledger-rules.json`; `audits/evidence/p3/kidverse/critic-reset-crossweek.json`; `audits/evidence/p3/kidverse/critic-reset-uncredited-prayed.json`; `audits/evidence/p3/kidverse/award-first-pull.json` |
| Two devices of one kid | **FAIL (critical, P3-KIDVERSE-02, -10).** A stale device erases a verse star, and a stale "I heard it" erases the other device's heard day. | `audits/evidence/p3/kidverse/stale-device.json`; `audits/evidence/p3/kidverse/critic-heard-races.json` |
| First open on a new device | **FAIL (critical, P3-KIDVERSE-01, -03, -11).** A tap during a slow or failed first load overwrites the stars row, the family week or the story rows. | `audits/evidence/p3/kidverse/award-first-pull.json`; `audits/evidence/p3/kidverse/adult-week.json` C; `audits/evidence/p3/kidverse/critic-heard-first2.json` |
| Midnight and ISO-week rollover; DST 2026-11-01; another time zone | **PASS** on a fresh render (W39 → W40; the DST week → W45). The open page is stale after midnight (P2-STAB-07). Another time zone allows a second star in one household day (P3-KIDVERSE-08). A reset applied after Sunday midnight cannot see last week's verse days, because `normStars` drops them (`apps/kidverse.html:270`; `index.html:1326`): P3-KIDVERSE-12. | `audits/evidence/p3/kidverse/dates.json`; `audits/evidence/p3/kidverse/critic-reset-crossweek.json` |
| Kiosk cannot award; guests never see the card | **PASS** for the kiosk: no Done ★ or "I heard it"; `award()` and `heard()` return false; nothing written. Guests: Me's Kids' rewards card is shell-owned and hidden from them; in Kid Verse a guest sees every kid's ★ and can step the family week (UX-KIDVERSE-3). | `audits/evidence/p3/kidverse/star-rules.json` R7; `audits/evidence/p3/kidverse/star-rules-R7-tv-standalone.png`; `audits/evidence/p3/kidverse/adult-week.json` B |
| Read-aloud (speechSynthesis) | **PASS with a stand-in voice** (the rig's WebKit has none): the right text, rate 0.85, en-US, cross-cancel, Escape, cancel on leaving; all 52 references parse. Real iOS voices not verified. | `audits/evidence/p3/kidverse/speech.json`; `audits/evidence/p3/kidverse/speech-leave.json` |
| Adult "set the family week" | **PARTLY.** Works in 3 taps plus a scroll. The story card stays stale (P3-KIDVERSE-05), a stalled first load overwrites the week (P3-KIDVERSE-03), guests can change it (UX-KIDVERSE-3), and nothing posts to the feed (GAP-KIDVERSE-1). | `audits/evidence/p3/kidverse/adult-week.json`; `audits/evidence/p3/kidverse/taps.json` |

## Leads from 01-leads.md

| Lead | Outcome | Where it went |
|---|---|---|
| A kid's first tap on a slow first load can wipe their stars (`audits/01-leads.md:258`) | Confirmed and widened: the reconcile that follows re-credits paid stars and drops three badges; uniform latency also triggers it. Narrowed: the window needs every first kidverse pull on the device, the shell's included, to stall or fail. | P3-KIDVERSE-01 |
| Week stepper on a slow first load can reset the whole family's week (`:260`) | Confirmed; a failed pull opens the window at once | P3-KIDVERSE-03 |
| After the week stepper, the story card stays on the old week (`:264`) | Confirmed; the story speaker reads the new week | P3-KIDVERSE-05 |
| Guests can change the family's memory-verse week (`:266`) | Confirmed; rated UX low, since CLAUDE.md lets guests use adult apps | UX-KIDVERSE-3 |
| Day dots disagree with the star count (`:268`) | Confirmed | P3-KIDVERSE-04 |
| The stars card calls the cash-in balance "all time" (`:270`) | Confirmed | P3-KIDVERSE-06 |
| After a parent's Reset week, the stars card and story card disagree (`:272`) | Confirmed | UX-KIDVERSE-4 |
| Done ★ and I heard it paint in the kid's own colour, not gold (`:274`) | Confirmed; reclassified as a bug by the completeness critic and verified 2/2 (Kiara's colour turned out to be Hearth's gold) | P3-KIDVERSE-14 (formerly VIS-KIDVERSE-4) |
| Grown-ups panel on iPhone: dots cover counts and long names (`:276`) | Confirmed and widened: ordinary one-digit counts too | VIS-KIDVERSE-5 |
| The kid's main action is below the fold on most devices (`:278`) | Narrowed: iPhone, iPad landscape and desktop; iPad portrait shows Done ★ | UX-KIDVERSE-2 |
| With no family week set, Kid Verse silently shows week 1 (`:286`) | Confirmed | UX-KIDVERSE-5 |
| Loading shows the wrong picture, no skeleton, Kid Verse part (`:288`) | Confirmed, plus a 368 px jump when data lands | UX-KIDVERSE-6 |
| Offline is invisible, Kid Verse part (`:290`) | Confirmed; Phase 2 owns the mechanism | UX-KIDVERSE-7; P2 Sync UX pointer |
| Story art stays a pale panel in dark themes (`:294`) | Confirmed and widened: two scenes are dark slabs in light themes | VIS-KIDVERSE-6 |
| Button labels repeat their own icon (`:296`) | Confirmed | VIS-KIDVERSE-9 |
| Badge and payout dates have no year (`:298`) | Confirmed | UX-KIDVERSE-9 |
| The stars row grows without limit (`:300`) | Confirmed, narrowed to low perf (15 KB after 14 months; far below the 900 KB cap) | P3-KIDVERSE-09 |
| Toasts cover content and cannot be dismissed, Kid Verse part (`:302`) | Confirmed | UX-KIDVERSE-8 |
| Verses-only leads (`:262, 280, 282, 284, 292`) | Not checked here | Verses report |

## Not verified

- Real iOS speechSynthesis: voices, cancel-then-speak, and whether speech continues after the viewer closes. Only a stand-in voice was used.
- The iOS long-press image menu on the story art (VIS-KIDVERSE-10) and `background-attachment: fixed` on iOS.
- Real Liquid Glass (backdrop blur) and SF Pro, SF Rounded and New York; the rig uses fallback fonts, so Typography, Shape and Native feel are provisional.
- Real touch, and whether a child actually taps within a stalled first load on real networks; how often the online 30 s two-device race happens in household use. Production was not touched.
- `heard()` writing the story rows whole with no pull guard (`apps/kidverse.html:635-639`) is now verified: the completeness critic ran it (`critic-heard-first2.mjs` and `critic-heard-races.mjs`), and two skeptics each confirmed both races. They are filed in §4 as P3-KIDVERSE-10 (stale second device) and P3-KIDVERSE-11 (first load).
- The Prayer-side effects of name matching: a same-named guest un-tapping Prayed, the "who prayed today" faces and chat's `mark_prayed` (P3-KIDVERSE-07). From the code only.
- The badge feed line after P3-KIDVERSE-01's overwrite: skeptic 1's feed check matched nothing, possibly a regex mismatch; `reconcile()` posts it by the code (`apps/kidverse.html:481`).
- P2-PROF-02 and P2-SYNC-18 in Kid Verse: not re-run.
- Contrast was swept at 430 px only; the iPad and desktop layouts were not swept.
- Whether "Use week N" works after a stalled load, and how the TV board reads a stale mirror week.
- The reference apps' behaviour is from product knowledge; Apple's support pages returned no article text.

## Scripts and evidence

**Investigator** (`audits/tools/phase3/kidverse/`):
- `_kv.mjs` (shared helpers), `award-first-pull.mjs`, `stale-device.mjs`, `adult-week.mjs`, `star-rules.mjs`, `ledger-rules.mjs`, `dates.mjs`, `speech.mjs`, `speech-leave.mjs`, `visual.mjs`, `webtells.mjs`, `taps.mjs`, `rowsize.mjs` and `offline.mjs`.
- Platform counts: `node audits/tools/phase3/compliance.mjs kidverse` → `audits/evidence/p3/_compliance/kidverse.json`.

**Skeptics** (`audits/tools/phase3/kidverse/`):

| Finding | Scripts |
|---|---|
| P3-KIDVERSE-01 | `verify-award-first-pull-wipes-stars-1.mjs`, `verify-award-first-pull-wipes-stars-2.mjs` |
| P3-KIDVERSE-02 | `verify-stale-device-erases-star-1.mjs`, `verify-stale-device-erases-star-2.mjs` |
| P3-KIDVERSE-03 | `verify-week-stepper-stalled-overwrite-1.mjs`, `verify-week-stepper-stalled-overwrite-2.mjs` |
| P3-KIDVERSE-04 | `verify-day-dots-vs-count-1.mjs`, `verify-day-dots-vs-count-2.mjs` |
| P3-KIDVERSE-05 | `verify-story-card-stale-after-step-1.mjs`, `verify-story-card-stale-after-step-2.mjs` |
| P3-KIDVERSE-06 | `verify-all-time-label-1.mjs`, `verify-all-time-label-2.mjs` |
| P3-KIDVERSE-07 | `verify-prayed-name-match-1.mjs`, `verify-prayed-name-match-2.mjs` |
| P3-KIDVERSE-08 | `verify-device-local-day-1.mjs`, `verify-device-local-day-2.mjs` |
| P3-KIDVERSE-09 | `verify-stars-row-growth-1.mjs`, `verify-stars-row-growth-2.mjs` |
| P3-KIDVERSE-10 | `verify-critic-heard-stale-device-drops-heard-day-2-1.mjs`, `verify-critic-heard-stale-device-drops-heard-day-2-2.mjs` |
| P3-KIDVERSE-11 | `verify-critic-heard-first-load-overwrites-story-row-3-1.mjs`, `verify-critic-heard-first-load-overwrites-story-row-3-2.mjs` |
| P3-KIDVERSE-12 | `verify-critic-reset-crossweek-keeps-verse-stars-1-1.mjs`, `verify-critic-reset-crossweek-keeps-verse-stars-1-2.mjs` |
| P3-KIDVERSE-13 | `verify-critic-reset-misses-uncredited-prayed-days-4-1.mjs`, `verify-critic-reset-misses-uncredited-prayed-days-4-2.mjs` |
| P3-KIDVERSE-14 | `verify-critic-star-buttons-not-gold-5-1.mjs`, `verify-critic-star-buttons-not-gold-5-2.mjs` |

**Completeness critic** (`audits/tools/phase3/kidverse/`): `critic-heard-races.mjs` (arms first | stale | control; P3-KIDVERSE-10, -11), `critic-heard-first2.mjs` (P3-KIDVERSE-11), `critic-reset-crossweek.mjs` (P3-KIDVERSE-12) and `critic-reset-uncredited-prayed.mjs` (P3-KIDVERSE-13). P3-KIDVERSE-14 reuses the investigator's `visual.mjs` section A.

**Visual checker.** `vischeck-dark-dots.mjs` (pixel sampling of existing captures; no server) → `audits/evidence/p3/kidverse/vischeck-dark-dots.json`. It opened the 41 screenshots listed in §5.

**Evidence** is in `audits/evidence/p3/kidverse/`: the investigator's JSON (`award-first-pull.json`, `stale-device.json`, `adult-week.json`, `star-rules.json`, `ledger-rules.json`, `dates.json`, `speech.json`, `speech-leave.json`, `visual.json`, `webtells.json`, `taps.json`, `rowsize.json`, `offline.json`) and PNGs, each skeptic's `verify-*.json` and PNGs, the critic's `critic-*.json` and PNGs (`critic-heard-races.json`, `critic-heard-first2.json`, `critic-reset-crossweek.json`, `critic-reset-uncredited-prayed.json`), and the checker's `vischeck-dark-dots.json`.
