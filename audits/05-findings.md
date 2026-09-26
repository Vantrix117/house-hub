# House Hub audit, Phase 5: findings, plan and design preview

| | |
|---|---|
| **App code audited** | `fe6041d`, unchanged since the Phase 0 baseline. Phase 5 changed no app code; it wrote only under `audits/`. Phase 6 has since changed app code in batch 0a (`ae274a6`); each entry's Status line says what closed, and `audits/06-implementation.md` holds each batch's record. |
| **Date** | 2026-09-25; rebuilt 2026-09-26 with the household's answers (`audits/05-decisions.md`), the step 3 severities and the step 4 plan changes (the Kitchen device, the cut) |
| **Inputs** | Every file in `audits/`: the constitution (`audits/HUB-AUDIT-PROMPT.md`), `00-inventory.md`, `01-capture.md`, `01-leads.md`, `02-shell.md`, `03-apps.md` and `03-apps/*.md`, `04-design-system.md`, and the tools and evidence behind them. |
| **Outputs** | This file; `audits/design-preview.html` (the design preview) and its captures in `audits/screens-preview/` (contact sheets in `audits/screens-preview/_sheets/`). |
| **Reproduce** | `node audits/tools/phase5/catalog.mjs` (every finding of Phases 2-4 → `audits/evidence/p5/catalog.json`), `node audits/tools/phase5/remedies.mjs` (the remedies Phases 3-4 proposed), `node audits/tools/phase5/build-findings.mjs` (this file, from `fixes-*.mjs` and `plan-batches.mjs`; it fails if any finding has no fix). |

## How to read this report

- **One entry per finding.** Every finding Phases 2-4 filed is here once, with its original ID: the adversarially verified defects (`P2-*`, `P3-*`, `P4-*`) and the usability, visual, consistency and gap items (`UX-*`, `VIS-*`, `CONS-*`, `GAP-*`). Positive items (`OK-*`), refuted claims and unresolved questions are not findings; they are counted under "What this report does not list".
- **Entry fields**, as the constitution asks: ID · Title · Area · Type · Severity · Evidence · What happens now · Why it matters · Proposed fix · Effort · How it will be verified. "Batch" says which Phase 6 commit carries the fix.
- **Type.** Defects are *bug* (with *security* or *perf* when the finding was filed as such). `UX-*` items are *usability*, `VIS-*` *visual*, `CONS-*` *visual (consistency)*, `GAP-*` *feature gap*. The constitution's fifth type, *improvement*, is the Phase 3 improvement tables: each fix below names the improvement that proposed it (`IMP-<APP>-P|F|I<rank>`), and the 15 improvements that fix no finding are listed as their own entries at the end of their app batch.
- **Severity.** Defects carry the severity their report confirmed (the registers in `audits/02-shell.md:117-217`, `audits/03-apps.md` and `audits/04-design-system.md` are authoritative), under the rule in `audits/02-shell.md:25-37`: critical = household data lost or silently overwritten through the shipped UI, an account or private content exposed, or an app unusable on the iPad, iPhone or TV. Usability, visual, consistency and gap items that their investigator rated high or medium (71) were each checked by two independent skeptics, with a tie-breaker where they disagreed (step 3, `audits/evidence/p5/ux-verify/verdicts.md`). The severity is the verdict's, and the entry's "Verified" line gives the earlier rating and each vote; 0 refuted items left the list. Items rated low or info keep their investigator's rating, as the household decided (`audits/05-decisions.md`, "Other items").
- **Household work** (KITCHEN-1, KITCHEN-2): work the household's answers add that no finding filed. Each opens its batch, with the same fields less Severity, and is not in the finding counts.
- **Pointers.** A finding filed twice keeps both IDs; the pointer's fix says "Pointer to <primary>" and it is not counted again.
- **Evidence** gives the report entry (`audits/…md:line`, which holds the full evidence, reproduction and verification record), then up to four code lines and two screenshots taken from that entry.
- **"How it will be verified"** names the entry's own reproduction scripts, which Phase 6 reruns after the fix: the defect's printed observation must flip. The batch adds its capture-rig recapture, measurement rerun and repo tests (section "The plan").

## Summary

- **622 findings** (576 counted once, 46 pointers): 41 critical, 10 high, 105 medium, 407 low, 13 info. By type: 237 bug, 4 bug (perf), 113 usability, 50 feature gap, 120 visual, 14 bug (security), 38 visual (consistency).
- **Every critical defect is pulled forward.** The 41 critical findings sit in the nine 0x batches, ahead of the design work. Most share a few root causes in the SDK: writes before the app's own first load (0b), queued writes dropped or stranded (0c), and whole-map rows under last-write-wins (0e, 0f, 0g).
- **Then the design system (batch 1)**: the Phase 4 token proposal (`audits/tools/phase4/tokens/proposed-tokens.css`, verified over six rounds: 0 failing pairs, 26/26 planted faults caught, 17 minor issues open), with the shared components every app needs (undo toast, confirm sheet, loading state, pressable, focus ring). It closes most visual and consistency items at once.
- **Then the shell (2a-2c) and one app per batch** (3-11), in the order the household confirmed (`audits/05-decisions.md`, "App batch order"): 3 Prayer, 4 F260 Reading Plan, 5 Verses, 6 Kitchen timer, 7 Kid Verse, 8 Larder Ledger, 9 Dollywood build guide, 10 Dollywood park map, 11 Tally counter.
- **The design preview** (`audits/design-preview.html`) renders the proposed token set live: the house pastels with their computed contrast in light and dark, the type scale, glass over busy content, tiles at phone and iPad density, the household's accents side by side, and a before/after of Prayer, the most-used app. Its captures are in `audits/screens-preview/`.
- **The household has answered every decision** (D1-D18 from Phase 4, P5-D1-P5-D9 below; `audits/05-decisions.md`, 2026-09-25, and admin-assigned colours, 2026-09-26). Where an answer differs from a recommendation, the answer wins and this plan follows it: the D3 colour set as the starting colours with the admin free to assign any of the 18 families, guests sky by default (D4), nine separate app hues (D5), four glass levels with Frosted the default (D8), the TV's 10-foot scale on in 2c (D16), and the Kitchen device in place of an idle return (P5-D5).
- **The Kitchen device** (P5-D5 as answered) is new work: KITCHEN-1 in batch 0d, KITCHEN-2 in batch 2a. It closes P2-PROF-09. Three points the answer left open are settled in the plan and go to the owner with the preview (`audits/05-decisions.md`, "Plan notes from step 4"): widening the profile kinds needs a rebuild of the `profiles` table, the plan's one non-additive schema step (`worker/schema.sql:9`); Timer and Tally store per person today, so the kitchen keeps its own Timer and Tally rows until batch 6; and the face sheet for finishing a food or adding a photo shows the adults only, while Prayed shows everyone.
- **Cut by the household:** GAP-DOLLYWOOD-2 (`audits/05-decisions.md`, "Features kept or cut"). It is not planned.
- **The preview is approved** (2026-09-26), with one change: Forest's text is gold, token revision 6e (`audits/05-decisions.md`, "Preview approved"). Phase 6 begins with batch 0a. The owner's device checks (item 6 of "Before Phase 6 can start") are still to do; they need no batch.
- **Phase 6 so far:** batch 0a (`ae274a6`, 2026-09-26) done; 2 entries FIXED, 0 PARTIAL, 0 DEFERRED, 0 NEEDS DEVICE CHECK (pointers included). The "Status" column of the plan and each entry's Status line track it; `audits/06-implementation.md` has each batch's reruns, captures, tests and what was not verified.

## The plan

One batch per commit (constitution). Critical defects are pulled forward into the 0x batches; then batch 1 = design tokens, design.css and shared components; batch 2 = the hub shell (split into the shell UI, the Worker, and the TV board); then one app per batch.

| Order | Batch | What | Findings (crit / high / med / low / info) | Effort | Needs | Status |
|---|---|---|---|---|---|---|
| 1 | **0a** | The hub boots with Reduce Motion on | 1 (1 / 0 / 0 / 0 / 0) | S | — | 1/1 fixed, `ae274a6` |
| 2 | **0b** | SDK: no write before the first load, safe migration, one household day | 36 (10 / 1 / 7 / 18 / 0) | L | — | open |
| 3 | **0c** | SDK and shell: queued writes are never dropped, switching is clean | 19 (8 / 1 / 2 / 8 / 0) | L | — | open |
| 4 | **0d** | Security: accounts, private content, stored script, kid safety; the Kitchen device's server rules | 15 (3 / 4 / 3 / 5 / 0) + KITCHEN-1 | M | — | open |
| 5 | **0e** | F260 and Verses: rows that cannot erase each other, a journal that cannot corrupt | 7 (6 / 0 / 1 / 0 / 0) | L | 0b, 0c | open |
| 6 | **0f** | Tally and Kid Verse: counts and stars that add up across devices | 3 (3 / 0 / 0 / 0 / 0) | L | 0b, 0c | open |
| 7 | **0g** | Prayer: no lost requests, notes or prayed days | 7 (4 / 1 / 0 / 2 / 0) | M | 0b | open |
| 8 | **0h** | Larder and build guide: no one-tap loss | 6 (4 / 0 / 2 / 0 / 0) | M | 0b | open |
| 9 | **0i** | Chat: writes that do what was asked, and say when they did not | 7 (2 / 0 / 4 / 1 / 0) | M | — | open |
| 10 | **1** | Design tokens, design.css and shared components | 143 (0 / 1 / 14 / 121 / 7) | L | — | open |
| 11 | **2a** | Hub shell: Home, Apps, Me, Chat, profiles; the Kitchen device | 45 (0 / 1 / 7 / 36 / 1) + KITCHEN-2 | L | 1, 0d (KITCHEN-1) | open |
| 12 | **2b** | Worker: push, reminders, chat and PWA | 23 (0 / 1 / 5 / 16 / 1) | M | 0c | open |
| 13 | **2c** | The TV board | 12 (0 / 0 / 3 / 9 / 0) | M | 1 | open |
| 14 | **3** | Prayer | 36 (0 / 0 / 6 / 29 / 1) | L | 1, 2a | open |
| 15 | **4** | F260 Reading Plan | 38 (0 / 0 / 6 / 32 / 0) | L | 1, 2a | open |
| 16 | **5** | Verses | 19 (0 / 0 / 5 / 13 / 1) | M | 1, 2a | open |
| 17 | **6** | Kitchen timer | 24 (0 / 0 / 9 / 15 / 0) | M | 1, 2a | open |
| 18 | **7** | Kid Verse | 16 (0 / 0 / 5 / 11 / 0) | M | 1, 2a | open |
| 19 | **8** | Larder Ledger | 16 (0 / 0 / 2 / 14 / 0) | M | 1, 2a | open |
| 20 | **9** | Dollywood build guide | 47 (0 / 0 / 10 / 36 / 1) | L | 1, 2a | open |
| 21 | **10** | Dollywood park map | 42 (0 / 0 / 13 / 28 / 1) | L | 1, 2a | open |
| 22 | **11** | Tally counter | 14 (0 / 0 / 1 / 13 / 0) | M | 1, 2a | open |

**Why the app batches are in this order.** No app has usage data (every Phase 3 report says so), so daily use is estimated from each report's jobs table (§1): people × sessions a day. Gap is the weight of the app's open findings after the critical batches (critical 8, high 4, medium 2, low 1). The household confirmed this order (`audits/05-decisions.md`, "App batch order"), and the plan keeps it; with the step 3 severities the scores alone would give Prayer → F260 Reading Plan → Kitchen timer → Verses → Kid Verse → Larder Ledger → Dollywood build guide → Dollywood park map → Tally counter.

| Batch | App | Use (sessions/day) | Basis | Open findings | Gap weight | Use × gap |
|---|---|---|---|---|---|---|
| 3 | Prayer | 7 | every adult daily plus Ezra and Kiara daily (prayer.md §1) | 36 | 41 | 287 |
| 4 | F260 Reading Plan | 4 | four adult readers, daily (f260.md §1) | 38 | 44 | 176 |
| 5 | Verses | 4 | four adults daily, kids a few times a week (verses.md §1) | 19 | 23 | 92 |
| 6 | Kitchen timer | 3 | several times a day around meals (timer.md §1) | 24 | 33 | 99 |
| 7 | Kid Verse | 2 | both kids daily (kidverse.md §1) | 16 | 21 | 42 |
| 8 | Larder Ledger | 2 | about one log and one finish a day in the app; the Home card carries the glances (leftovers.md §1) | 16 | 18 | 36 |
| 9 | Dollywood build guide | 0.4 | Eli, a few build sessions a week (dollywood.md §1) | 47 | 56 | 22.4 |
| 10 | Dollywood park map | 0.2 | park days only, then heavily (dollywood-live.md §1) | 42 | 54 | 10.8 |
| 11 | Tally counter | 0.5 | occasional bursts (tally.md §1) | 14 | 15 | 7.5 |

### Batch details

#### Batch 0a — The hub boots with Reduce Motion on

- **Why now.** Any family device with Reduce Motion on (iOS Settings → Accessibility → Motion) gets a blank page today, the pairing screen included. It is a one-line fix and has been live since 2026-09-17.
- **Files.** apps/hub.js, index.html
- **Verification.** node "audits/tools/phase2/VIS/verify-reduced-motion-blank-shell-2.mjs" (every Reduce Motion case must print shell.hidden=false); node "audits/tools/phase2/VIS/density-motion.mjs" (last block); scripts/test-design.mjs (reduced motion case). Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 0b — SDK: no write before the first load, safe migration, one household day

- **Why now.** Ten critical data losses share one cause: hub.ready resolves before the app's own data has arrived (apps/hub.js:334-337), so a tap or an automatic save writes from an empty state over the real row. The same batch gives every app one "today" in New York time with a midnight event, because the apps disagree about the date today.
- **Files.** apps/hub.js; guards in each app that writes on open or on a tap (F260, Prayer, Tally, Timer, Kid Verse, Verses, Larder, both Dollywood exports via the sibling template)
- **Backup.** Export the production D1 (npx wrangler d1 export house-hub --remote --output …) before deploying; the batch changes no schema but guards writes to existing rows.
- **Verification.** each entry's reproduction script (listed per finding) must stop reproducing; node "audits/tools/phase2/SYNC/critic-done-during-stall.mjs" (the history must survive a held first pull); capture rig loading states: node audits/tools/capture.mjs --state loading --out audits/screens-after/… (one folder per batch), then node audits/tools/lib/pxdiff.mjs against audits/screens; scripts/test-hub.mjs, test-f260.mjs, test-prayer.mjs, test-kidverse.mjs, test-rewards.mjs, test-verses.mjs, test-leftovers.mjs, test-timer.mjs. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 0c — SDK and shell: queued writes are never dropped, switching is clean

- **Why now.** Writes the device already accepted and showed are thrown away when an app closes, when the TV signs in, on "Forget this device", above 200 queued rows, or after a Switch; a fast clock reverts other people's edits; a pull in flight during Switch shows one person's private prayers to the next.
- **Files.** apps/hub.js, index.html, worker/src/data.js, worker/src/index.js
- **Backup.** Export the production D1 first (the Worker starts clamping future timestamps).
- **Verification.** each entry's reproduction script; node "audits/tools/phase2/SYNC/verify-batch-over-200-dropped-1.mjs"; scripts/test-hub.mjs (offline write → flush, kiosk read-only); scripts/smoke-api.sh against the local Worker (120 checks). Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 0d — Security: accounts, private content, stored script, kid safety; the Kitchen device's server rules

- **Why now.** An account (the admin's included) can be taken over after any Reset PIN or by brute force with the pairing code; a guest name can run script in everyone's park map and replay the admin's tokens; private prayer titles reach the family feed and the TV; a guest can switch a child's location beacon. The Kitchen device's server rules (KITCHEN-1) belong here too: which kind may write what is a security rule.
- **Household work.** KITCHEN-1 (first under this batch in "Findings, by batch").
- **Files.** worker/src/index.js, worker/src/auth.js, worker/src/data.js, worker/src/chat.js, worker/migrations/ (PIN claim, kitchen), worker/schema.sql, worker/seed.sql, scripts/smoke-api.sh and a new kitchen test in scripts/ (KITCHEN-1), CLAUDE.md, apps/hub.js, index.html, apps/prayer.html (escaping only; layout and ids stay), ../dollywood-build-project/scripts/template.html → both exports
- **Backup.** Export the production D1 before the migrations: the PIN claim (a table or column; per-profile rate-limit keys, additive) and the kitchen one (KITCHEN-1: an additive device role, and a rebuild of `profiles` to widen its kind CHECK). They take the next free numbers from 006.
- **Verification.** each entry's reproduction script (the XSS scripts must find no live node; the takeover and brute-force scripts must be refused); scripts/smoke-api.sh (PIN flows, rate limits, admin 403s, guests, rally); scripts/test-guests.mjs, test-prayer-faces.mjs; test-kitchen.mjs (new, KITCHEN-1). Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 0e — F260 and Verses: rows that cannot erase each other, a journal that cannot corrupt

- **Why now.** F260 is the household's original bug report ("progress not saving on the phone"). Whole-map rows let one device erase another's tick, a practice rating wipes the Verses schedule, and the encrypted journal can stop saving silently or become unreadable.
- **Files.** apps/f260.html (data code only; layout and ids stay), apps/verses.html
- **Needs first.** 0b, 0c.
- **Backup.** Export the production D1 first: the batch splits f260.done / f260.log / f260.recall into per-item rows (additive keys; the old map rows are kept read-only until every device has migrated).
- **Verification.** each entry's reproduction script; node "audits/tools/phase2/SYNC/verify-whole-map-lww-loses-ticks-1.mjs" and the P2-SYNC-19/-20 scripts; scripts/test-f260.mjs, test-verses.mjs, test-prefs.mjs; print check: the PDF route in audits/03-apps/f260.md (3 pages, 52 weeks). Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 0f — Tally and Kid Verse: counts and stars that add up across devices

- **Why now.** Two devices of one person lose each other's taps; a kid's second device erases a star or a heard day. These are the kids' own records.
- **Files.** apps/tally.html, apps/kidverse.html
- **Needs first.** 0b, 0c.
- **Backup.** Export the production D1 first (stars and heard-days move to per-day rows; the mirror row is derived).
- **Verification.** each entry's reproduction script; scripts/test-rewards.mjs, test-kidverse.mjs, test-kidstory.mjs. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 0g — Prayer: no lost requests, notes or prayed days

- **Why now.** Prayer is the most-used app (every adult and both kids, daily). Two devices can pick the same id and lose a request, Import can erase other people's newer requests, "Put back on the list" erases the answer note, and an iPad left open past midnight files prayers under yesterday.
- **Files.** apps/prayer.html (data code only; layout and ids stay)
- **Needs first.** 0b.
- **Backup.** Export the production D1 first (ids of new rows change shape; existing rows keep theirs).
- **Verification.** each entry's reproduction script; node handoff/prayer/check.js apps/prayer.html (49 checks); scripts/test-prayer.mjs, test-prayer-faces.mjs. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 0h — Larder and build guide: no one-tap loss

- **Why now.** A double-tap, a remote change under the finger or a kid's tap removes family food for everyone with no undo; the build guide's Import replaces all progress with any JSON file.
- **Files.** apps/leftovers.html, ../dollywood-build-project/scripts/template.html → apps/dollywood.html (+ the park map export)
- **Needs first.** 0b.
- **Verification.** each entry's reproduction script; scripts/test-leftovers.mjs, test-dollywood-sync.mjs; the sibling repo's verify.py before export. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 0i — Chat: writes that do what was asked, and say when they did not

- **Why now.** finish_leftover can remove a different food; a write that lost last-write-wins still shows ✓.
- **Files.** worker/src/chat.js
- **Verification.** each entry's reproduction script (scripted upstream via L.anthropic); node scripts/mock-anthropic.mjs + scripts/smoke-chat.sh (39 checks). Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 1 — Design tokens, design.css and shared components

- **Why now.** Most visual findings share causes in the token layer: mid-tone hues used as text, one light-theme hex per person, no iPad type tier, glass without Reduce Transparency, focus rings that vanish. Phase 4 measured them across 3,662 screen x theme x device jobs and proposed one verified token set.
- **Files.** apps/design.css (token half replaced by audits/tools/phase4/tokens/proposed-tokens.css; component half moved onto roles), apps/hub.js (theme, accent, preferences, bootstrap), a new additive migration, `<n>-profile-hue.sql` under worker/migrations/ (Phase 4 named it 006; batch 0d's migrations land first, so it takes the next free number), the tests that hard-code page colours; the Phase 4 batch-1a pre-pass rows in every app
- **Backup.** Export the production D1 before the profile-hue migration (additive column).
- **Verification.** node audits/tools/phase4/tokens/contrast.mjs (0 failing) and browser-check.mjs; the measurement rig after the change: node audits/tools/phase4/measure.mjs --run themes|devices|states --out … then aggregate.mjs, compared with the committed audits/evidence/p4/measure/*.json; capture rig, all areas: node audits/tools/capture.mjs --out audits/screens-after/… (one folder per batch), then pxdiff against audits/screens; scripts/test-design.mjs, screens-themes.mjs, screens-apps.mjs, screens-shell.mjs, test-prefs.mjs; rescore the rubric for every row (the Phase 4 scorecard method). Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 2a — Hub shell: Home, Apps, Me, Chat, profiles; the Kitchen device

- **Why now.** The shell is what every household member sees first, many times a day, on the always-on Kitchen iPad.
- **Household work.** KITCHEN-2 (first under this batch in "Findings, by batch").
- **Files.** index.html, apps/hub.js; for the Kitchen face sheet (KITCHEN-2), the calls in apps/prayer.html (data code only; layout and ids stay) and apps/leftovers.html, the kitchen test's UI half, CLAUDE.md
- **Needs first.** 1, 0d (KITCHEN-1).
- **Verification.** each entry's reproduction script; capture rig: --area shell --out audits/screens-after/… + pxdiff; scripts/test-hub.mjs, test-home.mjs, test-apps.mjs, test-guests.mjs, test-photos.mjs, test-timer.mjs, test-kitchen.mjs, screens-shell.mjs. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 2b — Worker: push, reminders, chat and PWA

- **Why now.** Reminders and pushes are how the hub reaches people who are not looking at it.
- **Files.** worker/src/*.js, sw.js, manifest.json, index.html (push and install UI)
- **Needs first.** 0c.
- **Verification.** each entry's reproduction script; scripts/test-push.mjs, test-push2.mjs (with scripts/push-receiver.mjs), smoke-chat.sh, smoke-api.sh; node scripts/bump-sw.mjs --check. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 2c — The TV board

- **Why now.** The downstairs TV runs 24/7 and is read from the sofa; today it hides reminders and uses phone-sized text.
- **Files.** index.html (the .tv grid), apps/design.css (kiosk tier)
- **Needs first.** 1.
- **Verification.** scripts/test-tv.mjs (200 crossfades, constant nodes, fits 1920x1080); capture rig: --area tv --out audits/screens-after/… + pxdiff; audits/tools/phase4/tokens/rev2-runtime.mjs fit check with data-tv-scale="10ft". Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 3 — Prayer

- **Why now.** Prayer is used every adult daily plus Ezra and Kiara daily (prayer.md §1); 36 open findings remain after the critical batches.
- **Files.** apps/prayer.html (restyle through tokens only; layout and ids stay)
- **Needs first.** 1, 2a.
- **Verification.** each entry's reproduction script; capture rig: node audits/tools/capture.mjs --area prayer --out audits/screens-after/… (one folder per batch), then pxdiff against audits/screens; the measurement rig for this area: node audits/tools/phase4/measure.mjs --area prayer --run themes (then aggregate.mjs) and compare with audits/evidence/p4/measure/; node handoff/prayer/check.js apps/prayer.html; scripts/test-prayer.mjs, test-prayer-faces.mjs; rescore this app's rubric row (the Phase 4 scorecard method) and record the change. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 4 — F260 Reading Plan

- **Why now.** F260 Reading Plan is used four adult readers, daily (f260.md §1); 38 open findings remain after the critical batches.
- **Files.** apps/f260.html (restyle through tokens only; layout and ids stay)
- **Needs first.** 1, 2a.
- **Verification.** each entry's reproduction script; capture rig: node audits/tools/capture.mjs --area f260 --out audits/screens-after/… (one folder per batch), then pxdiff against audits/screens; the measurement rig for this area: node audits/tools/phase4/measure.mjs --area f260 --run themes (then aggregate.mjs) and compare with audits/evidence/p4/measure/; scripts/test-f260.mjs, test-prefs.mjs, test-kidstory.mjs; the PDF print check; rescore this app's rubric row (the Phase 4 scorecard method) and record the change. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 5 — Verses

- **Why now.** Verses is used four adults daily, kids a few times a week (verses.md §1); 19 open findings remain after the critical batches.
- **Files.** apps/verses.html
- **Needs first.** 1, 2a.
- **Verification.** each entry's reproduction script; capture rig: node audits/tools/capture.mjs --area verses --out audits/screens-after/… (one folder per batch), then pxdiff against audits/screens; the measurement rig for this area: node audits/tools/phase4/measure.mjs --area verses --run themes (then aggregate.mjs) and compare with audits/evidence/p4/measure/; scripts/test-verses.mjs; rescore this app's rubric row (the Phase 4 scorecard method) and record the change. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 6 — Kitchen timer

- **Why now.** Kitchen timer is used several times a day around meals (timer.md §1); 24 open findings remain after the critical batches.
- **Files.** apps/timer.html, index.html (timer pill)
- **Needs first.** 1, 2a.
- **Verification.** each entry's reproduction script; capture rig: node audits/tools/capture.mjs --area timer --out audits/screens-after/… (one folder per batch), then pxdiff against audits/screens; the measurement rig for this area: node audits/tools/phase4/measure.mjs --area timer --run themes (then aggregate.mjs) and compare with audits/evidence/p4/measure/; scripts/test-timer.mjs; rescore this app's rubric row (the Phase 4 scorecard method) and record the change. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 7 — Kid Verse

- **Why now.** Kid Verse is used both kids daily (kidverse.md §1); 16 open findings remain after the critical batches.
- **Files.** apps/kidverse.html
- **Needs first.** 1, 2a.
- **Verification.** each entry's reproduction script; capture rig: node audits/tools/capture.mjs --area kidverse --out audits/screens-after/… (one folder per batch), then pxdiff against audits/screens; the measurement rig for this area: node audits/tools/phase4/measure.mjs --area kidverse --run themes (then aggregate.mjs) and compare with audits/evidence/p4/measure/; scripts/test-kidverse.mjs, test-rewards.mjs, test-kidstory.mjs; rescore this app's rubric row (the Phase 4 scorecard method) and record the change. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 8 — Larder Ledger

- **Why now.** Larder Ledger is used about one log and one finish a day in the app; the Home card carries the glances (leftovers.md §1); 16 open findings remain after the critical batches.
- **Files.** apps/leftovers.html
- **Needs first.** 1, 2a.
- **Verification.** each entry's reproduction script; capture rig: node audits/tools/capture.mjs --area leftovers --out audits/screens-after/… (one folder per batch), then pxdiff against audits/screens; the measurement rig for this area: node audits/tools/phase4/measure.mjs --area leftovers --run themes (then aggregate.mjs) and compare with audits/evidence/p4/measure/; scripts/test-leftovers.mjs; rescore this app's rubric row (the Phase 4 scorecard method) and record the change. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 9 — Dollywood build guide

- **Why now.** Dollywood build guide is used Eli, a few build sessions a week (dollywood.md §1); 47 open findings remain after the critical batches.
- **Files.** ../dollywood-build-project/scripts/template.html → apps/dollywood.html
- **Needs first.** 1, 2a.
- **Verification.** each entry's reproduction script; capture rig: node audits/tools/capture.mjs --area dollywood --out audits/screens-after/… (one folder per batch), then pxdiff against audits/screens; the measurement rig for this area: node audits/tools/phase4/measure.mjs --area dollywood --run themes (then aggregate.mjs) and compare with audits/evidence/p4/measure/; scripts/test-dollywood-sync.mjs; the sibling repo's verify.py; rescore this app's rubric row (the Phase 4 scorecard method) and record the change. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 10 — Dollywood park map

- **Why now.** Dollywood park map is used park days only, then heavily (dollywood-live.md §1); 42 open findings remain after the critical batches.
- **Files.** ../dollywood-build-project/scripts/template.html → apps/dollywood-live.html
- **Needs first.** 1, 2a.
- **Verification.** each entry's reproduction script; capture rig: node audits/tools/capture.mjs --area dollywood-live --out audits/screens-after/… (one folder per batch), then pxdiff against audits/screens; the measurement rig for this area: node audits/tools/phase4/measure.mjs --area dollywood-live --run themes (then aggregate.mjs) and compare with audits/evidence/p4/measure/; scripts/smoke-api.sh (waits, rally); the sibling repo's verify.py; rescore this app's rubric row (the Phase 4 scorecard method) and record the change. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

#### Batch 11 — Tally counter

- **Why now.** Tally counter is used occasional bursts (tally.md §1); 14 open findings remain after the critical batches.
- **Files.** apps/tally.html
- **Needs first.** 1, 2a.
- **Verification.** each entry's reproduction script; capture rig: node audits/tools/capture.mjs --area tally --out audits/screens-after/… (one folder per batch), then pxdiff against audits/screens; the measurement rig for this area: node audits/tools/phase4/measure.mjs --area tally --run themes (then aggregate.mjs) and compare with audits/evidence/p4/measure/; scripts/test-apps.mjs (Tally cases); rescore this app's rubric row (the Phase 4 scorecard method) and record the change. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).

### Rules that hold in every batch

- **Backups and migrations.** Before any batch that changes stored data shape or schema (0b, 0c, 0d, 0e, 0f, 0g, 1), export the production D1 (`npx wrangler d1 export house-hub --remote --output <file>`, pre-approved by the household), check the file and keep it local and git-ignored. Migrations are additive (`worker/migrations/`, `schema.sql` kept in sync), with one exception: KITCHEN-1 rebuilds `profiles` to widen its kind CHECK, verified row for row against the export. Row reshaping (per-item rows in 0e-0g) is done by the client on first open after the fix, and the old rows stay readable until every device has moved.
- **Protected files.** `apps/prayer.html` and `apps/f260.html` keep their layouts and element ids; their fixes are data code, copy and token restyling (CLAUDE.md). The Dollywood pair is changed only in `../dollywood-build-project/scripts/template.html`, rebuilt, checked with `verify.py`, then exported. No build step, bundler or framework.
- **After each batch** (constitution, Phase 6): rerun the capture rig for every affected screen into an after-run folder (`audits/screens-after/…`, git-ignored like the baseline) and compare with the Phase 1 baseline (`audits/tools/lib/pxdiff.mjs`); rescore the rubric for what changed; rerun the repo tests; update this file's entries with FIXED / PARTIAL / DEFERRED / NEEDS DEVICE CHECK and the commit hash.
- **Declined features** stay out: no kid routines/stars app and no shared grocery list; the Kid Verse and Tally fixes add no reward or routine system, and the Larder fixes do not make it a shopping list.

## Decisions for the household

**All answered.** The owner answered D1-D18 (`audits/04-design-system.md`, "Decisions for the household") and the nine below on 2026-09-25, and amended D3 and D4 on 2026-09-26 (the admin assigns every profile's colour). The answers, and what each changes in the plan, are in `audits/05-decisions.md`; they override this report's recommendations. The rebuilt design preview shows the colour, type and glass answers.

| # | Decision | Recommendation | Alternative | Answer |
|---|---|---|---|---|
| P5-D1 | Base of the token proposal. The judges' totals were migration 142, fidelity 140, access 133; because of an orchestration error the synthesis was built on fidelity with migration's compatibility layer grafted on (`audits/04-design-system.md`, "How the set was assembled"). | Keep the synthesis as built: it already carries every migration strength the judges named, and it is the version verified over six rounds. | Rebuild on the migration proposal (then re-verify from round 1). | Keep the synthesis |
| P5-D2 | Kids in the Larder (P3-LEFTOVERS-13, UX-LEFTOVERS-2). | A read-only picture view for kids (food cards with art and freshness colour, no ✓, no add bar). | Hide the Larder from kids (add a visibleTo without ezra and kiara). | Read-only picture view; the server refuses kid writes |
| P5-D3 | Chat writes (GAP-CHAT-02, P2-CHAT-01). | Act at once with an Undo on the chip for 30 s (as iOS does). | Confirm every write before it happens. | Act at once, Undo for 30 s |
| P5-D4 | How a reset PIN is reclaimed (P2-PROF-04). | The admin's Reset shows a one-time code, valid 24 h, that the person enters before choosing a new PIN. | The admin sets a temporary PIN that must be changed on first use. | One-time code, 24 h |
| P5-D5 | Idle return on the shared Kitchen iPad (P2-PROF-09). | Back to the picker after 10 minutes without a touch; the TV is exempt. | 30 minutes, or off. | **Replaced:** a shared Kitchen mode for that iPad with no personal sign-ins (KITCHEN-1, KITCHEN-2) |
| P5-D6 | Tally's Reset (UX-TALLY-1). | Undo toast, no confirm; a smaller ↺ away from +. | A confirm sheet. | Undo toast |
| P5-D7 | Notifications for kids (P2-PROF-16). | Off: kids cannot subscribe. | Allowed, for the Kid Verse reminder only. | Off |
| P5-D8 | Guests' rights (P3-DOLLYWOOD-LIVE-02, UX-KIDVERSE-3, PWA-UX-2). | Guests use the apps but cannot switch kids' beacons, step the family week or receive household pushes. | Treat guests as adults everywhere. | Apps, not household |
| P5-D9 | A "Timer done" alert on a locked phone (PWA-GAP-1). | A server-scheduled push at endAt (a Worker alarm); the one new moving part in the plan. | Keep local-only alerts and say so in the Timer. | Server push at endAt |

## Findings, by batch

### Batch 0a — The hub boots with Reduce Motion on (2)

#### P2-STAB-01 — With Reduce Motion on, the whole hub is a blank page

- **Area** shell / platform · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0a · **Status** FIXED (`ae274a6`)
- **Phase 6 (FIXED).** hub.js defines hub.sheenFrom before its reduced-motion return (apps/hub.js:442); index.html:662 calls it only if it is a function. With Reduce Motion on, all 11 skeptic cases and all 6 STAB cases boot (shell or gate shown, 0 page errors) in WebKit and Chromium, and the render matches Reduce Motion off (4 pairs, 0 pixels over tolerance). After: `audits/evidence/p6/0a/VIS/verify-rm2.json`, `audits/evidence/p6/0a/STAB/reduced-motion.json`, `audits/evidence/p6/0a/VIS/verify-rm2-webkit-iphone-eli-reduce.png`, `audits/evidence/p6/0a/VIS/verify-rm2-webkit-ipad-unpaired-reduce.png`.
- **Evidence.** `audits/02-shell.md:3097`; `apps/hub.js:442`, `apps/hub.js:447`, `index.html:662`, `index.html:1703-1705`
- **What happens now.** Under `prefers-reduced-motion: reduce`, hub.js leaves its sheen block early (apps/hub.js:442), before it assigns `hub.sheenFrom` (apps/hub.js:447). The shell then calls `hub.sheenFrom(views)` without a guard (index.html:662). The call sits inside the boot IIFE, before the boot routing at index.html:1703-1705.
- **Why it matters.** Any family device with Reduce Motion on shows an empty page with nothing to tap. On iOS the setting is Settings → Accessibility → Motion → Reduce Motion. On Windows, Chrome and Edge report it when "Animation effects" is off.
- **Proposed fix.** hub.js assigns `hub.sheenFrom = () => {}` before its reduced-motion early return (apps/hub.js:442-447), and index.html:662 calls it only if it is a function.
- **How it will be verified.** Rerun `node "audits/tools/phase2/STAB/reduced-motion.mjs"` — the defect must no longer reproduce; plus batch 0a's checks.

#### P2-VIS-01 — With Reduce Motion on, the hub is a blank page on every device

- **Area** shell / platform · **Type** bug · **Severity** critical (pointer) · **Effort** S · **Batch** 0a · **Status** FIXED (`ae274a6`)
- **Phase 6 (FIXED).** Pointer to P2-STAB-01; its own check (density-motion.mjs, last block) now prints shellHidden=false under reduce. After: `audits/evidence/p6/0a/VIS/density-motion.json`, `audits/evidence/p6/0a/VIS/reduced-motion-reduce-webkit-ipad.png`.
- **Evidence.** `audits/02-shell.md:5435`; `apps/hub.js:442`, `apps/hub.js:447`, `index.html:662`, `index.html:442`
- **Proposed fix.** Pointer to P2-STAB-01.

### Batch 0b — SDK: no write before the first load, safe migration, one household day (45)

#### P2-SYNC-02 — The first open of Prayer on a device overwrites the family list's settings and wipes the family's prayed-days history

- **Area** shell / platform (Prayer) · **Type** bug · **Severity** critical · **Effort** M · **Batch** 0b
- **Evidence.** `audits/02-shell.md:2391`; `apps/hub.js:334`, `index.html:457-458`, `apps/prayer.html:624-627`, `apps/hub.js:236`
- **What happens now.** 1. `seen` is true when any channel on the page has `since > 0` (apps/hub.js:334). The shell's channel list declares `prayer|person` but not `prayer|family` (index.html:457-458), so Prayer's `hub.ready` resolves before its first family pull. 2.
- **Why it matters.** the family streak, longest streak, month count and calendar (apps/prayer.html:732-760) reset for everyone. The family plan's settings are lost. Nothing can be rebuilt, because last-write-wins keeps no history.
- **Proposed fix.** Prayer writes list settings and prayed-days only after its channels have pulled (hub.loaded); its migrate() never rewrites a row it has not read from the server.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-ready-seen-global-resets-family-prayer-1.mjs"`, `node "audits/tools/phase2/SYNC/e8-ready-seen.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P2-SYNC-03 — A device with pre-hub F260 data migrates its old copy over the person's real progress when F260's first pull has not landed

- **Area** shell / platform (F260) · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0b
- **Evidence.** `audits/02-shell.md:2421`; `index.html:1287`, `apps/hub.js:391-392`, `apps/f260.html:905`, `sw.js:62-68`
- **What happens now.** The comment on `hub.migrate` says a key moves "only if that key is still empty on the server" (apps/hub.js:391-392). The actual check is `!hub.has(...)` on the local cache (:406-407). F260 migrates every `f260.*` legacy key straight after `hub.ready` (apps/f260.html:905). Every other device of Eli's adopts the newer rows.
- **Why it matters.** a year of readings, the streak and memorised verses are replaced on every device of that person, from one open.
- **Proposed fix.** hub.migrate runs only after a successful pull shows the key absent on the server (as apps/hub.js:391-392 promises), and never for guests. (Phase 3: IMP-DOLLYWOOD-P3)
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-migrate-race-overwrites-history-1.mjs"`, `node "audits/tools/phase2/SYNC/e2h-migrate-race.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P2-SYNC-05 — A first F260 open without data overwrites the whole week-start history

- **Area** shell / platform (F260) · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0b
- **Evidence.** `audits/02-shell.md:2491`; `apps/hub.js:337`, `apps/f260.html:909`, `apps/f260.html:938`, `apps/f260.html:1327`
- **What happens now.** With GET `/api/data/f260` held for 8 s on a new phone, `hub.ready` gave up at 6 s (apps/hub.js:337). F260 rendered Week 1 "Genesis 1-2". At about 6.4 s it POSTed `f260.weekStart = {"1":"2026-09-24"}` and a week-1 summary (apps/f260.html:909, 938, 1509). The summary healed when the data arrived. The 38-week start history did not.
- **Why it matters.** the plan's pace, the "started" date and the per-week "took N days" figures (apps/f260.html:1327) go permanently wrong on every device.
- **Proposed fix.** F260 writes weekStart only when a week really starts (first tick), never on a first open without data (apps/f260.html:909, 938). (Phase 3: IMP-F260-P6)
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-slow-first-pull-weekstart-2.mjs"`, `node "audits/tools/phase2/SYNC/e2d-slow-first-pull.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P2-SYNC-17 — Tapping Done in F260 during a slow or failed first pull wipes the person's whole reading history on the server

- **Area** shell / platform (F260) · **Type** bug · **Severity** critical · **Effort** M · **Batch** 0b
- **Evidence.** `audits/02-shell.md:2753`; `index.html:458`, `apps/hub.js:334-337`, `apps/f260.html:908-924`, `apps/hub.js:236-239`
- **What happens now.** `hub.ready` races the first pull against 6 s only when no channel has a cache (apps/hub.js:334-337). When the pull fails it resolves at once. F260 builds its state from the empty cache (apps/f260.html:908-924).
- **Why it matters.** It is the most destructive route found to the household's "F260 progress not saving" report. The reset-looking screen invites exactly the tap that makes the loss permanent. Undo only toggles the one tick in the empty map.
- **Proposed fix.** The F260 Done tap is refused (button disabled, "Loading your progress…") until the f260 channel has pulled once; with the per-tick rows of 0e a stale tap could no longer erase history anyway. (Phase 3: IMP-F260-P6)
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/critic-done-during-stall.mjs"`, `node "audits/tools/phase2/SYNC/verify2-done-during-stalled-pull-2.mjs"`, `node "audits/tools/phase2/SYNC/verify2-done-during-stalled-pull-1.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-KIDVERSE-01 — Done ★ tapped during a slow or failed first load overwrites the kid's whole stars row; reconcile then re-credits paid stars

- **Area** kidverse · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/kidverse.md:159`; `index.html:458-459`, `apps/kidverse.html:323-335`, `apps/hub.js:334-337`, `worker/src/data.js:60-62`; `audits/evidence/p3/kidverse/award-first-pull-hold-phone-after-tap.png`, `audits/evidence/p3/kidverse/award-first-pull-fail-ipad-after.png`
- **What happens now.** `award()` writes `myStars() + 1` with no `pulled()` guard (`apps/kidverse.html:323-335`). `reconcile()` has the guard, and its comment says why: a fresh row from an empty cache "would out-date the kid's real stars (last write wins)" (`:465-469`). `hub.ready` resolves after 6 s, or at once when the pull fails (`apps/hub.js:334-337`).
- **Why it matters.** It erases a child's earned history, badges and payout bookkeeping, and it inflates a balance a parent already paid out. Adults and the TV read the same overwritten mirror.
- **Proposed fix.** Done ★ stays disabled (with a spinner-free "Getting your stars…" state) until the kidverse channels have pulled once; reconcile never runs on an unloaded row. (Phase 3: IMP-KIDVERSE-P1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/verify-award-first-pull-wipes-stars-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-award-first-pull-wipes-stars-2.mjs"`, `node "audits/tools/phase3/kidverse/award-first-pull.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-KIDVERSE-03 — On a stalled or failed first load an adult sees "Week 1", and + writes week 2 over the family's real week

- **Area** kidverse · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/kidverse.md:252`; `index.html:459`, `apps/kidverse.html:370`, `apps/hub.js:337`, `apps/hub.js:295`; `audits/evidence/p3/kidverse/adult-week-C-stalled-stepper.png`, `audits/evidence/p3/kidverse/verify-week-stepper-stalled-overwrite-1-V1-held-9s-at-tap.png`
- **What happens now.** `familyWeek()` falls back to 1 when there is no row (`apps/kidverse.html:253, 276`). The stepper shows "Week 1 · the family is on" with + enabled (`:369`), and `setWeek` has no pull guard (`:336-340`). At 7.0 s into a held pull the adult saw Genesis 1:27 / Week 1 and tapped +.
- **Why it matters.** A setting that decides what every child hears this week is silently reset, and each kid device shows the wrong verse and story until an adult notices.
- **Proposed fix.** The week stepper stays disabled until the family scope has pulled. (Phase 3: IMP-KIDVERSE-P1, IMP-KIDVERSE-F1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/verify-week-stepper-stalled-overwrite-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-week-stepper-stalled-overwrite-2.mjs"`, `node "audits/tools/phase3/kidverse/adult-week.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-KIDVERSE-11 — "I heard it" tapped during a slow or failed first load replaces the week's story row, dropping earlier heard days

- **Area** kidverse · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/kidverse.md:501`; `apps/kidverse.html:631-639`, `apps/hub.js:334-337`, `apps/hub.js:295-296`, `apps/kidverse.html:599-604`; `audits/evidence/p3/kidverse/critic-heard-first2-phone-after.png`, `audits/evidence/p3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-2-A-phone-after.png`
- **What happens now.** `heard()` has no `pulled()` check (`apps/kidverse.html:631-639`), unlike `reconcile()` (`:467-469`). On an empty cache `normStory` returns `{week, days: {}}` (`:599-604`), and the button is enabled for any kid whatever the pull state. `hub.ready` resolves after 6 s (`apps/hub.js:334-337`).
- **Why it matters.** The week's heard days that the story card and the parents' F260 line show are silently cut back. The kid is also shown, and taps under, a placeholder week-1 story nobody read to them.
- **Proposed fix.** "I heard it" is disabled until the story rows have pulled once. (Phase 3: IMP-KIDVERSE-P1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/critic-heard-first2.mjs"`, `node "audits/tools/phase3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-critic-heard-first-load-overwrites-story-row-3-2.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-PRAYER-02 — A slow or failed first pull on a new device overwrites the person's prayed-days history and plans

- **Area** prayer · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/prayer.md:222`; `apps/hub.js:334-337`, `apps/prayer.html:624-639`, `apps/prayer.html:826-833`, `apps/prayer.html:685-695`; `audits/evidence/p3/prayer/slow-start-hold9s-first-paint.png`, `audits/evidence/p3/prayer/slow-start-control-first-paint.png`
- **What happens now.** On a device with no cache for the app's channels, `hub.ready` races the first pull against 6 s, and resolves at once if the pull fails (`apps/hub.js:334-337`). Prayer then builds its lists from the empty cache (`apps/prayer.html:624-639`) and paints "Nothing on the list today." with all-zero stats.
- **Why it matters.** Months of "days in a row", the month count, the Record calendar and a person's named plans are replaced for good by a cellular hiccup on a new phone, and the family list's plan and streak with them.
- **Proposed fix.** Prayer writes prayed-days and plans only after its channels have pulled (hub.loaded).
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-slow-start-person-wipe-1.mjs"`, `node "audits/tools/phase3/prayer/verify-slow-start-person-wipe-2.mjs"`, `node "audits/tools/phase3/prayer/slow-start.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-TALLY-02 — A tap during a slow or failed first load replaces the saved count

- **Area** tally · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/tally.md:191`; `apps/hub.js:334-337`, `index.html:458`, `apps/tally.html:145-157`, `apps/hub.js:252-253`; `audits/evidence/p3/tally/first-load-hold-at-tap.png`, `audits/evidence/p3/tally/verify-first-load-tap-overwrites-count-2-hold10-at-tap.png`
- **What happens now.** On a device with no tally cache, `hub.ready` races the first pull against 6 s, and resolves at once if the pull fails (`apps/hub.js:334-337`). The shell does not sync the tally channel (`index.html:458`), so the app frame's own pull is the only one. Tally then paints 0 and wires + and − (`apps/tally.html:145-157`).
- **Why it matters.** The count is replaced for good. The screen already shows 0, as if the count had been wiped, which invites exactly the tap that makes the loss permanent. Kids, Tally's likeliest users, are hit the same way (Ezra 12 → 1).
- **Proposed fix.** + and − are disabled until the count has arrived; no write before the first pull. (Phase 3: IMP-TALLY-P2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/verify-first-load-tap-overwrites-count-1.mjs"`, `node "audits/tools/phase3/tally/verify-first-load-tap-overwrites-count-2.mjs"`, `node "audits/tools/phase3/tally/first-load.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-VERSES-03 — A rating before Verses' own data arrives on a device replaces the whole review log (on a cold kid device, the whole schedule too)

- **Area** verses · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/verses.md:205`; `index.html:458`, `apps/hub.js:334-337`, `apps/verses.html:297-298`, `apps/hub.js:295`; `audits/evidence/p3/verses/first-open-log-offline-before-rating.png`, `audits/evidence/p3/verses/first-open-log-offline-ipad-after.png`
- **What happens now.** The shell already caches the person's `f260` scope (`index.html:458`). On a first Verses open some channel therefore has `since > 0`, and `hub.ready` skips its wait (`apps/hub.js:334-337`). Verses paints its due cards within about 150-450 ms while its own `verses/person` channel is still empty, with a "0" day streak.
- **Why it matters.** The day-streak history is permanently replaced by one day. For a kid, the day's ratings are lost and the wrong week is practised.
- **Proposed fix.** No rating until the f260 and verses channels have pulled once (buttons disabled, skeleton card). (Phase 3: IMP-VERSES-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/verify-first-open-wipes-log-1.mjs"`, `node "audits/tools/phase3/verses/verify-first-open-wipes-log-1-kid.mjs"`, `node "audits/tools/phase3/verses/verify-first-open-wipes-log-2.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P2-HOME-02 — "Today's reading" shows yesterday's reading as done until F260 is opened

- **Area** shell / platform (F260) · **Type** bug · **Severity** high · **Effort** S · **Batch** 0b
- **Evidence.** `audits/02-shell.md:303`; `apps/f260.html:1504-1509`, `index.html:732`, `index.html:1161-1169`, `worker/src/chat.js:299`
- **What happens now.** F260 writes `f260.summary = {week, weekDone, total, streak, readToday: !!log[today], next, finished}` with no date field (`apps/f260.html:1504-1509`). It does so only while F260 is open. Closing the viewer blanks the frame (`index.html:732`). Home uses `f.readToday` and `f.streak` as they are (`index.html:1161-1169`).
- **Why it matters.** Every morning, the main glance card tells an adult who read yesterday that today's reading is done. The streak is frozen the same way. Someone who trusts Home for about 3 days loses the streak while Home still shows it.
- **Proposed fix.** F260 writes the date into its summary (`readOn: hub.today()`), and Home, the TV, chat and the 8 pm job read "done today" only when that date is today (apps/f260.html:1506-1509; index.html:1164; worker/src/reminders.js:88-96).
- **How it will be verified.** Rerun `node "audits/tools/phase2/HOME/verify-home-reading-stale-next-morning-1.mjs"`, `node "audits/tools/phase2/HOME/verify-home-reading-stale-next-morning-2.mjs"`, `node "audits/tools/phase2/HOME/leads.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P2-STAB-07 — F260 and Kid Verse left open keep showing yesterday after midnight

- **Area** shell / platform (F260, Kid Verse) · **Type** bug · **Severity** medium · **Effort** S · **Batch** 0b
- **Evidence.** `audits/02-shell.md:3234`; `apps/f260.html:1556-1561`, `apps/kidverse.html:343-361`, `apps/kidverse.html:327-329`
- **What happens now.** F260 still showed "READ TODAY ✓ / Tue, Sep 22" at Wed 00:02, after 3 minutes of real pulls and a hide/show cycle (`verify-stale-midnight-1.json`, `verify-open-apps-stale-2-A-f260-wed-0003.png`). Kid Verse, at Mon 00:02. The main card still said "4 stars this week", Sunday was highlighted, and "Done today ★" was still pressed.
- **Why it matters.** A reader sees "Read today ✓" on a new day. A pre-reader sees a pressed "Done today ★" and may not tap, and the verse star can only be earned for today (apps/kidverse.html:327-329).
- **Proposed fix.** F260 and Kid Verse re-render on hub.onDay (the midnight event from 0b) and on visibilitychange when the day key changed.
- **How it will be verified.** Rerun `node "audits/tools/phase2/STAB/midnight.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-LEFTOVERS-03 — After the March DST change, every older item reads one day young in the Larder and on Home

- **Area** leftovers · **Type** bug · **Severity** medium · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/leftovers.md:259`; `apps/leftovers.html:167`, `index.html:679`, `worker/src/reminders.js:19`, `index.html:699`; `audits/evidence/p3/leftovers/dates-spring-forward-2027-larder.png`, `audits/evidence/p3/leftovers/verify-dst-spring-forward-off-by-one-1-sat20-2100-larder.png`
- **What happens now.** `daysBetween` floors (local midnight today − local midnight of `dateLogged`) / 86400000 (`apps/leftovers.html:167`), and Home's `ageDays` uses the same formula (`index.html:679`). A span that crosses spring-forward is one hour short, so it floors a day low.
- **Why it matters.** The Larder's main signal, the week-old warning, arrives a day late for a whole week's worth of food, and the app, Home and the lock screen disagree about the same dish.
- **Proposed fix.** Ages are calendar-day differences in New York time (as worker/src/reminders.js:19), not millisecond divisions. (Phase 3: IMP-LEFTOVERS-P3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-dst-spring-forward-off-by-one-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-dst-spring-forward-off-by-one-2.mjs"`, `node "audits/tools/phase3/leftovers/dates.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-TALLY-06 — A guest who opens Tally first on a device receives the household's legacy count; the next household adult gets 0

- **Area** tally · **Type** bug · **Severity** medium · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/tally.md:355`; `apps/hub.js:392`, `apps/hub.js:400`, `apps/f260.html:905`, `apps/dollywood.html:1107`; `audits/evidence/p3/tally/verify-critic-guest-gets-legacy-migration-2-2-guest.png`, `audits/evidence/p3/tally/verify-critic-guest-gets-legacy-migration-2-2-mom.png`
- **What happens now.** `hub.migrate` gives person-scope legacy data to any profile whose kind is `'adult'` (`apps/hub.js:400`). Guests are created with kind `'adult'` and `is_guest` 1 (`worker/src/index.js:170, 197-198`), and `publicProfile` drops `is_guest` (`apps/hub.js:60-62`), so `hub.profile` cannot tell a guest from a household adult.
- **Why it matters.** The household's pre-profile count lands in a temporary visitor's profile and is later purged, and the adult who should have received it sees 0.
- **Proposed fix.** hub.migrate skips guests and leaves the migrated mark unset for them (apps/hub.js:400). (Phase 3: IMP-TALLY-P11)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/critic-guest-migrate.mjs"`, `node "audits/tools/phase3/tally/verify-critic-guest-gets-legacy-migration-2-1.mjs"`, `node "audits/tools/phase3/tally/verify-critic-guest-gets-legacy-migration-2-2.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-TALLY-07 — On a slow or failed first load Tally shows 0 as the person's count

- **Area** tally · **Type** bug · **Severity** medium · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/tally.md:391`; `apps/tally.html:134`, `apps/hub.js:334-337`, `apps/tally.html:145-157`, `apps/hub.js:342`; `audits/evidence/p3/tally/verify-critic-fake-zero-while-loading-5-1-fail-zero.png`, `audits/evidence/p3/tally/verify-critic-fake-zero-while-loading-5-2-abort-zero.png`
- **What happens now.** The markup's placeholder 0 (`apps/tally.html:134`) is painted as the count. `hub.ready` waits for the first pull only when no channel has a cache, caps the wait at 6 s, and resolves at once if the pull fails (`apps/hub.js:334-337`).
- **Why it matters.** The screen says the count was wiped. That invites exactly the tap that makes the wipe permanent (P3-TALLY-02), and on a kid's device it looks as if their count is gone.
- **Proposed fix.** A skeleton dial until the count has arrived; never a placeholder 0. (Phase 3: IMP-TALLY-P2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/verify-critic-fake-zero-while-loading-5-1.mjs"`, `node "audits/tools/phase3/tally/verify-critic-fake-zero-while-loading-5-2.mjs"`, `node "audits/tools/phase3/tally/first-load.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-TIMER-01 — While the page's first timer pull is slow or fails, the app shows an idle timer, and one Start tap replaces the person's running timer on every device

- **Area** timer · **Type** bug · **Severity** medium · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/timer.md:131`; `apps/hub.js:334-337`, `apps/timer.html:57`, `apps/timer.html:76`, `apps/timer.html:81`; `audits/evidence/p3/timer/critic-warm-stale-hold-before-tap.png`, `audits/evidence/p3/timer/critic-warm-stale-ctrl-before-tap.png`
- **What happens now.** The markup ships "5:00" with a primary Start (`apps/timer.html:57, 63, 69`), and the handlers attach only after `hub.ready` (`apps/timer.html:76, 113`). On a device with no cache, `hub.ready` races the first pull against 6 s and resolves at once if the pull fails (`apps/hub.js:334-337`).
- **Why it matters.** The person's real countdown (the oven) is silently replaced and now ends at the wrong time on all their devices, including the Kitchen iPad's pill and the Kitchen iPad's open Timer, where it was started.
- **Proposed fix.** Start is disabled until the timer channel has pulled, so a slow load never replaces a running timer. (Phase 3: IMP-TIMER-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/timer/critic-warm-stale-start.mjs"`, `node "audits/tools/phase3/timer/verify-slowload-start-replaces-running-timer-1.mjs"`, `node "audits/tools/phase3/timer/verify-slowload-start-replaces-running-timer-2.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-VERSES-04 — Left open past midnight, Verses keeps saying "All done for today" / "Come back tomorrow!" while verses are due

- **Area** verses · **Type** bug · **Severity** medium · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/verses.md:247`; `apps/verses.html:294`, `apps/verses.html:310`, `apps/verses.html:380-381`, `apps/verses.html:149`; `audits/evidence/p3/verses/midnight-eli-ipad-after.png`, `audits/evidence/p3/verses/midnight-ezra-iphone-after.png`
- **What happens now.** "Today" is computed only inside `render()` (`apps/verses.html:310`). `render()` runs at load, after a tap and on `hub.onChange` (`apps/verses.html:380-381`); the app has no timer and no visibility handler (setInterval / setTimeout / visibilitychange in `apps/verses.html`: NOT FOUND IN CODE).
- **Why it matters.** The morning review looks finished, and a kid is told to come back tomorrow on a day he should practise.
- **Proposed fix.** Re-render on hub.onDay and on visibilitychange when the day changed. (Phase 3: IMP-VERSES-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/verify-midnight-stale-all-done-1.mjs"`, `node "audits/tools/phase3/verses/verify-midnight-stale-all-done-2.mjs"`, `node "audits/tools/phase3/verses/midnight.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### UX-DOLLYWOOD-5 — While the first pull loads, the guide looks like a first-time user and Mark done is live

- **Area** dollywood · **Type** usability · **Severity** medium · **Effort** S · **Batch** 0b
- **Verified (step 3).** was medium; skeptics medium and medium.
- **Evidence.** `audits/03-apps/dollywood.md:680`; `audits/evidence/p3/dollywood/first-open-loading.png`, `audits/screens/dollywood/steps-loading-iphone-pwa-light.png`
- **What happens now.** On a fresh device with the pull held 5 s: "0 of 9 done", every chip 0/N, an enabled Mark done and no loading cue (L1). After the pull: "7 of 9 done". A tick in that window replaced the server row, 24 → 1 (L2).
- **Why it matters.** It looks like a first-time user and accepts ticks that erase progress.
- **Proposed fix.** While the first pull loads, show "Loading your progress…" and disable Mark done. (Phase 3: IMP-DOLLYWOOD-P3)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 0b's checks.

#### P2-SYNC-15 — `hub.sync.state` starts as "offline" while the device is online, so apps show false offline wording and Home shows final "empty" wording

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/02-shell.md:2699`; `apps/hub.js:51`, `apps/hub.js:334-337`, `index.html:1158`
- **What happens now.** the state is `'offline'` from script load until the first pull ends (apps/hub.js:51, 311), and `onSync` fires at once with it (:125).
- **Why it matters.** false alarms teach the family to ignore the real ones. This is also the root cause of the "final empty wording instead of skeletons" lead.
- **Proposed fix.** hub.sync.state starts as "pending" (not "offline") until the first pull answers; apps and Home show loading states, not "empty", until then.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-initial-state-offline-2.mjs"`, `node "audits/tools/phase2/SYNC/verify-initial-state-offline-2-counterfactual.mjs"`, `node "audits/tools/phase2/SYNC/e11-initial-offline-state.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-F260-05 — Opening F260 once enrols a guest or Mea in the 8 pm and Sunday reading nudges

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/f260.md:275`; `apps/f260.html:938`, `apps/f260.html:1506-1509`, `worker/src/reminders.js:82-99`, `worker/src/reminders.js:56`; `audits/evidence/p3/f260/guest-guest-grandmajo-first-open-ipad.png`, `audits/evidence/p3/f260/verify-first-open-enrols-guest-2-guest-grandmajo-home-after-ipad.png`
- **What happens now.** With no start date for the current week, boot writes `weekStart[curWeek] = today` (`apps/f260.html:938`), and the first render saves `f260.summary` (`apps/f260.html:1506-1509`).
- **Why it matters.** A grandparent who peeks at the plan once starts getting "No reading checked off today yet" every evening, and "N readings behind" on Sundays.
- **Proposed fix.** Viewing the plan writes nothing: weekStart and the summary are written on the first tick or setting change, never on open. (Phase 3: IMP-F260-P6)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-first-open-enrols-guest-1.mjs"`, `node "audits/tools/phase3/f260/verify-first-open-enrols-guest-2.mjs"`, `node "audits/tools/phase3/f260/guest.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-F260-06 — A device in another time zone files the reading under its own date

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/f260.md:299`; `apps/f260.html:932`, `apps/f260.html:1662`, `worker/src/reminders.js:13`, `worker/wrangler.toml:25`; `audits/evidence/p3/f260/verify-other-timezone-logs-next-day-1-london-after-iphone.png`, `audits/evidence/p3/f260/verify-other-timezone-logs-next-day-1-ny-tue-ipad.png`
- **What happens now.** `dayKey` uses the device's local date (`apps/f260.html:932`), and a tick sets `log[dayKey()]` (`apps/f260.html:1662`). The Worker works in America/New_York (`worker/src/reminders.js:13, 89-96`). Eli's phone set to Europe/London taps Done on a New York Tuesday evening: the log gets 2026-09-23, not 22.
- **Why it matters.** Two devices show a different "read today" for the same row at the same moment, and a nudge can be wrong in both directions.
- **Proposed fix.** The day key is hub.today() (America/New_York), so a device in another zone files the household's date.
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-other-timezone-logs-next-day-1.mjs"`, `node "audits/tools/phase3/f260/verify-other-timezone-logs-next-day-2.mjs"`, `node "audits/tools/phase3/f260/time.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-KIDVERSE-08 — "Today" is each device's local date, so a device in a western time zone can add a second verse star in one household day

- **Area** kidverse · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/kidverse.md:413`; `apps/kidverse.html:259`, `worker/src/reminders.js:13-18`, `worker/src/chat.js:112`, `index.html:834`; `audits/evidence/p3/kidverse/dates-Z-ny-ipad-after-second-star.png`, `audits/evidence/p3/kidverse/verify-device-local-day-1-B-ny-ipad-after.png`
- **What happens now.** `dayKey` uses the device's local date (`apps/kidverse.html:259`; the story module's copy at `:592`), and `award()` allows one star per `dayKey()` (`:327-329`). A phone set to America/Los_Angeles at 22:30 PT on Wed 23 Sep stored `days['2026-09-23']`.
- **Why it matters.** It breaks the one-star-a-day rule, in the kid's favour.
- **Proposed fix.** One star per household day via hub.today().
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/verify-device-local-day-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-device-local-day-2.mjs"`, `node "audits/tools/phase3/kidverse/dates.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-LEFTOVERS-06 — Tapping Log or pressing Enter before the app is ready reloads the page and loses the typed name

- **Area** leftovers · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/leftovers.md:381`; `index.html:458`, `apps/leftovers.html:120-131`, `apps/leftovers.html:172`, `apps/hub.js:334-337`; `audits/evidence/p3/leftovers/before-ready-A-typed-iphone.png`, `audits/evidence/p3/leftovers/verify-submit-before-ready-reloads-2-A-after-tap-iphone.png`
- **What happens now.** The form is live from first paint (`apps/leftovers.html:120-131`). It has no `action`, and its inputs have no `name`. `form.onsubmit` is attached only after `await hub.ready()` (`apps/leftovers.html:172, 289`), which on a cold cache waits up to 6 s (`apps/hub.js:334-337`).
- **Why it matters.** The cook types tonight's dish, taps Log, and the page blanks. The item never reaches the list or the 8 am push.
- **Proposed fix.** preventDefault from the first byte; an entry made before ready is kept and submitted once ready.
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-submit-before-ready-reloads-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-submit-before-ready-reloads-2.mjs"`, `node "audits/tools/phase3/leftovers/before-ready.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-LEFTOVERS-07 — A device in another time zone writes and reads its own local date

- **Area** leftovers · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/leftovers.md:423`; `apps/leftovers.html:166-167`, `apps/leftovers.html:191-193`, `apps/leftovers.html:295`, `worker/src/reminders.js:14-19`; `audits/evidence/p3/leftovers/tz-london-ipad.png`, `audits/evidence/p3/leftovers/verify-other-timezone-ages-2-london-ipad.png`
- **What happens now.** `todayStr()` and `daysBetween()` use the device's own zone (`apps/leftovers.html:166-167`). The date box's default and `max` come from `todayStr()` (`apps/leftovers.html:191-193`), and `dateLogged` is a bare date with no zone (`apps/leftovers.html:295`). The Worker uses New York dates throughout (`worker/src/reminders.js:14-19`;
- **Why it matters.** A traveller's new item shows a negative or one-day age at home, and the traveller sees every other item a day older or younger than the kitchen does.
- **Proposed fix.** Household dates in New York time via hub.today().
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-other-timezone-ages-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-other-timezone-ages-2.mjs"`, `node "audits/tools/phase3/leftovers/timezone.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-LEFTOVERS-08 — The first item logged in the minute after midnight gets yesterday's date

- **Area** leftovers · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/leftovers.md:457`; `apps/leftovers.html:295`, `apps/leftovers.html:364-375`, `apps/leftovers.html:166`, `apps/leftovers.html:300`; `audits/evidence/p3/leftovers/midnight-after-tick-ipad.png`, `audits/evidence/p3/leftovers/verify-midnight-first-minute-yesterday-1.png`
- **What happens now.** Submit takes the date box's value (`apps/leftovers.html:295`). The box moves to the new day only on the 60 s rollover tick or on `visibilitychange` (`apps/leftovers.html:364-375`). So "Midnight popcorn", logged at 00:00:11 on Wednesday, was stored as 2026-09-22 and read "1d ago" at once.
- **Why it matters.** A late snack put away just after midnight starts life a day old.
- **Proposed fix.** Submit re-checks the day (hub.today()) before reading the date box.
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-midnight-first-minute-yesterday-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-midnight-first-minute-yesterday-2.mjs"`, `node "audits/tools/phase3/leftovers/midnight.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-LEFTOVERS-14 — After one Log in the minute after midnight, the next Log is refused with "must be yesterday or earlier" while the box shows today (from the critic)

- **Area** leftovers · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/leftovers.md:669`; `apps/leftovers.html:191-193`, `apps/leftovers.html:364-375`, `apps/leftovers.html:300`, `apps/leftovers.html:120`; `audits/evidence/p3/leftovers/critic-midnight-second-log-chromium-ipad.png`, `audits/evidence/p3/leftovers/verify-critic-midnight-second-log-blocked-2-1-chromium-ipad-portrait-click.png`
- **What happens now.** `max` is set once at load (`apps/leftovers.html:191-193`) and moved only by `rollover()`, on the 60 s tick or `visibilitychange` (`apps/leftovers.html:364-375`). Submit resets the date box to `todayStr()` without touching `max` (`apps/leftovers.html:300`), and the form has no `novalidate` (`apps/leftovers.html:120`).
- **Why it matters.** Right after midnight the cook's second dish will not save, and the only message blames the date that the box shows as today.
- **Proposed fix.** Submit re-keys the day before it reads or resets the date box; value and max always agree.
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/critic-midnight-second-log.mjs"`, `node "audits/tools/phase3/leftovers/verify-critic-midnight-second-log-blocked-2-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-critic-midnight-second-log-blocked-2-2.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-PRAYER-10 — Taps before the data loads throw; the Mine/Family choice and screen changes are lost

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/prayer.md:441`; `index.html:458`, `apps/prayer.html:611`, `apps/hub.js:334-337`, `apps/prayer.html:1267`; `audits/evidence/p3/prayer/verify-tap-before-ready-1-A-record-before-load.png`, `audits/evidence/p3/prayer/verify-tap-before-ready-2-hold4s-during-window.png`
- **What happens now.** The document click handler is live before `load()` sets `D` (`apps/prayer.html:611, 1230-1231`; boot at `:1752-1758`). With the Prayer pulls held 4 s on a new device, the Family tap threw "undefined is not an object (evaluating 'D.activeList = t.dataset.list')" and the Record tap threw on `D.lists`.
- **Why it matters.** On a new phone the first taps silently do nothing, and the page jumps back to Today.
- **Proposed fix.** Controls are disabled (aria-busy) until the data has loaded.
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-tap-before-ready-1.mjs"`, `node "audits/tools/phase3/prayer/verify-tap-before-ready-2.mjs"`, `node "audits/tools/phase3/prayer/leads.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-PRAYER-11 — A phone outside New York time files prayed marks under its own local date

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/prayer.md:466`; `apps/prayer.html:711-712`, `index.html:834`, `worker/src/chat.js:112`, `worker/src/chat.js:244-246`; `audits/evidence/p3/prayer/verify-other-timezone-date-1-tv.png`, `audits/evidence/p3/prayer/verify-other-timezone-date-2-tv-east.png`
- **What happens now.** `TODAY` is the device's local date (`apps/prayer.html:711-712`) and `setPrayed` writes `prayedBy[TODAY]` (`:1598-1602`). The New York TV reads `prayedBy[today]` with its own local date (`index.html:834, 1058-1059`). David's phone in Los Angeles at Tue 22:30 PDT (Wed 01:30 New York) filed his tap under 2026-09-22, and the TV omitted him.
- **Why it matters.** A travelling parent's prayer is missing from the TV board, and the app and chat disagree about which day a mark belongs to.
- **Proposed fix.** Prayed marks use hub.today() (New York).
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-other-timezone-date-1.mjs"`, `node "audits/tools/phase3/prayer/verify-other-timezone-date-2.mjs"`, `node "audits/tools/phase3/prayer/dates.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-VERSES-07 — On a slow first load Verses shows "all done / Nothing to train yet" and saves a zero summary

- **Area** verses · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/verses.md:319`; `apps/hub.js:337`, `apps/verses.html:239-245`, `apps/hub.js:310`; `audits/evidence/p3/verses/stalled-load-adult-iphone.png`, `audits/screens/verses/trainer-stalled-loading-desktop-light.png`
- **What happens now.** On a new device with every data GET delayed 9 s, `hub.ready` gives up after 6 s (`apps/hub.js:337`). At 6.6 s Eli sees "Eli · all done" over the empty state, although he has 64 memorised verses and 3 due. `render()` calls `writeSummary()` every time with no pull guard (`apps/verses.html:239-245, 356`);
- **Why it matters.** Ten critical data losses share one cause: hub.ready resolves before the app's own data has arrived (apps/hub.js:334-337), so a tap or an automatic save writes from an empty state over the real row. The same batch gives every app one "today" in New York time with a midnight event, because the apps disagree about the date today.
- **Proposed fix.** A loading state until the first pull, and no summary write before it. (Phase 3: IMP-VERSES-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/verify-stalled-load-zero-summary-1.mjs"`, `node "audits/tools/phase3/verses/verify-stalled-load-zero-summary-2.mjs"`, `node "audits/tools/phase3/verses/stalled-load.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### P3-VERSES-09 — A device in another time zone files reviews under its own date, so other devices count the wrong day

- **Area** verses · **Type** bug · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/verses.md:359`; `apps/verses.html:203`, `apps/kidverse.html:259`, `apps/f260.html:932`, `apps/prayer.html:711`; `audits/evidence/p3/verses/tz-ny-kid-ipad.png`, `audits/evidence/p3/verses/verify-other-timezone-day-1-ny-ezra-ipad.png`
- **What happens now.** Eli rated on a phone set to Europe/London at 20:30 New York time (01:30 Wednesday in London). His row was stored with last 2026-09-23 and due 2026-09-30, under log key 2026-09-23. The New York iPad shows "13 day streak · keep it going today", so tonight's review does not count today.
- **Why it matters.** Ten critical data losses share one cause: hub.ready resolves before the app's own data has arrived (apps/hub.js:334-337), so a tap or an automatic save writes from an empty state over the real row. The same batch gives every app one "today" in New York time with a midnight event, because the apps disagree about the date today.
- **Proposed fix.** Reviews use hub.today() (New York).
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/verify-other-timezone-day-1.mjs"`, `node "audits/tools/phase3/verses/verify-other-timezone-day-2.mjs"`, `node "audits/tools/phase3/verses/verify-other-timezone-day-3.mjs"` — the defect must no longer reproduce; plus batch 0b's checks.

#### UX-DOLLYWOOD-LIVE-3 — While the data loads, the map says you are offline and not sharing

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/dollywood-live.md:621`; `apps/dollywood-live.html:1298`, `apps/dollywood-live.html:1269`; `audits/evidence/p3/dollywood-live/loading-family-ipad-dark.png`
- **What happens now.** With the family pull in flight, the Family header reads "offline — showing last known" (`apps/dollywood-live.html:1298`), Share my spot shows "Off", and the pill says "Only you see your dot until you switch on Share my spot" (`apps/dollywood-live.html:1269`), because `share` and `hub.sync` are read before the first …
- **Why it matters.** The map says you are offline and not sharing while it loads.
- **Proposed fix.** While the family pull is in flight the Family header says "Loading…", not "offline", and Share shows its real state once loaded. (Phase 3: IMP-DOLLYWOOD-LIVE-P3)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 0b's checks.

#### UX-F260-5 — While data loads, a live-looking green Done does nothing and "0 of 0 chapters" shows

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/f260.md:690`; `apps/f260.html:562-576`; `audits/evidence/p3/f260/layout-loading-iphone.png`, `audits/screens/f260/today-loading-iphone-pwa-light.png`
- **What happens now.** While data loads, a live-looking green Done does nothing and "0 of 0 chapters" shows (low). With the first pull held for 5 s, the static page shows "Done" with no `aria-disabled`, a tap gives no feedback, the title is empty and the strip reads "0 of 260 readings 0 of 0 chapters 1 current week"; there is no skeleton. After the 6 s fallback a tap wipes history (P2-SYNC-17). Evidence: `apps/f260.html:562-576, 580-586`; `layout.json` `loading`; `audits/evidence/p3/f260/layout-loading-iphone.png`; `audits/screens/f260/today-loading-iphone-pwa-light.png`.
- **Why it matters.** A live-looking Done does nothing.
- **Proposed fix.** Until the first pull, Done is disabled with "Loading…", and the stats show skeletons. (Phase 3: IMP-F260-P6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 0b's checks.

#### UX-KIDVERSE-6 — On a cold load: "…" placeholders and the week-1 art for about 4.7 s, then a 368 px jump

- **Area** kidverse · **Type** usability · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/kidverse.md:678`; `apps/kidverse.html:147`; `audits/screens/kidverse/kid-loading-iphone-pwa-light.png`, `audits/screens/kidverse/kid-loading-ipad-portrait-dark.png`
- **What happens now.** On a new phone with every GET held 1.5 s: at 87 ms the frame showed "…" for the reference and paraphrase, the hard-coded 01-creation art (`apps/kidverse.html:147, 166`), no Done ★ and the story card top at 770 px.
- **Why it matters.** Placeholders then a 368 px jump.
- **Proposed fix.** Skeleton art and text of the loaded size until the week arrives.
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/webtells.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 0b's checks.

#### UX-PRAYER-8 — No loading state; the kid page is blank while loading

- **Area** prayer · **Type** usability · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/prayer.md:874`; `audits/screens/prayer/today-loading-iphone-pwa-light.png`, `audits/screens/prayer/kid-loading-ipad-portrait-light.png`
- **What happens now.** No skeleton or spinner exists (NOT FOUND IN CODE). The adult loading page shows Pray now and More over nothing, then the content arrives; the kid page is empty. On a slow first open the empty state "Nothing on the list today." poses as real data (P3-PRAYER-02).
- **Why it matters.** A blank kid page while loading.
- **Proposed fix.** A loading state on both the adult and the kid page until the lists have pulled.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 0b's checks.

#### UX-VERSES-5 — While loading, Verses is a blank page with an empty pill

- **Area** verses · **Type** usability · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/verses.md:536`; `apps/verses.html:103`; `audits/screens/verses/trainer-loading-iphone-pwa-light.png`
- **What happens now.** While loading, Verses is a blank page with an empty pill (low). `#trainer`, `#done` and `#empty` all start hidden until `render()` (`apps/verses.html:103, 119, 126`); no skeleton, no spinner. Evidence: `audits/screens/verses/trainer-loading-iphone-pwa-light.png`.
- **Why it matters.** A blank page with an empty pill.
- **Proposed fix.** Show the skeleton card while loading. (Phase 3: IMP-VERSES-P4)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 0b's checks.

#### VIS-LEFTOVERS-1 — While loading, the Log and Copy buttons are empty boxes and the size and date fields are blank

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/leftovers.md:805`; `apps/leftovers.html:189-196`; `audits/screens/leftovers/main-loading-iphone-pwa-light.png`
- **What happens now.** Labels and options are filled in only after `hub.ready` (`apps/leftovers.html:189-196, 349-359`). There is no skeleton.
- **Why it matters.** Empty boxes while loading.
- **Proposed fix.** Buttons and fields render their labels from the start; a skeleton list while loading. (Phase 3: IMP-LEFTOVERS-P6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 0b's checks.

#### P3-DOLLYWOOD-01 — Legacy build-guide progress migrates over the person's real progress when the first pull is slow, fails or runs offline (pointer to P2-SYNC-03)

- **Area** dollywood · **Type** bug · **Severity** critical (pointer) · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/dollywood.md:145`; `apps/hub.js:406-407`, `apps/dollywood.html:1062`, `index.html:458-459`, `apps/hub.js:324-337`; `audits/evidence/p3/dollywood/migration-race-after.png`, `audits/evidence/p3/dollywood/verify-migrate-race-overwrites-progress-1-B-phone.png`
- **Proposed fix.** Pointer to P2-SYNC-03 (safe migration after a successful pull); the shell also declares the dollywood person channel. (Phase 3: IMP-DOLLYWOOD-P3)

#### P3-TALLY-03 — Pre-hub Tally data on a device migrates over the real count when the first pull has not landed (pointer to P2-SYNC-03)

- **Area** tally · **Type** bug · **Severity** critical (pointer) · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/tally.md:244`; `apps/hub.js:406-407`, `index.html:457-458`, `apps/tally.html:147`, `apps/hub.js:393-411`; `audits/evidence/p3/tally/verify-legacy-migrate-overwrites-count-1-hold9.png`, `audits/evidence/p3/tally/verify-legacy-migrate-overwrites-count-2-ipad.png`
- **Proposed fix.** Pointer to P2-SYNC-03 (safe migration after a successful pull).

#### P2-STAB-04 — Home says "reading done / read today ✓" every morning after a reading day (pointer → P2-HOME-02, high)

- **Area** shell / platform · **Type** bug · **Severity** high (pointer) · **Effort** S · **Batch** 0b
- **Evidence.** `audits/02-shell.md:3177`; `apps/f260.html:1506-1509`, `index.html:1164`, `worker/src/chat.js:299`, `worker/src/reminders.js:88-96`
- **Proposed fix.** Pointer to P2-HOME-02.

#### GAP-TELL-1 — No app uses a skeleton, and `hub.js` gives apps no "pulled" signal to know when to show one

- **Area** design system, all areas · **Type** feature gap · **Severity** low (pointer) · **Effort** S · **Batch** 0b
- **Evidence.** `audits/04-design-system.md:6397`; `apps/design.css:539-544`, `index.html:76-77`, `apps/dollywood-live.html:406-407`
- **Proposed fix.** Pointer to CONS-MOTION-4: hub.loaded gives apps the "pulled" signal the skeletons need. (Phase 4 gap row TELL-9)

#### P2-HOME-04 — A first load with nothing cached shows final "nothing here" wording and ★0 instead of loading states

- **Area** shell / platform · **Type** bug · **Severity** low (pointer) · **Effort** S · **Batch** 0b
- **Evidence.** `audits/02-shell.md:374`; `index.html:1158`, `index.html:888-889`, `index.html:1146-1156`, `index.html:1053-1071`; `audits/screens/shell/home-loading-ipad-portrait-light.png`
- **Proposed fix.** Pointer to P2-SYNC-15: closed by the first-load signal (Home shows skeletons until each card's channel has pulled once).

#### P2-VIS-04 — On a cold cache, Home and the TV show false "empty" facts, then jump

- **Area** shell / platform (TV) · **Type** bug · **Severity** low (pointer) · **Effort** S · **Batch** 0b
- **Evidence.** `audits/02-shell.md:5533`; `apps/hub.js:51`, `index.html:1158`, `index.html:1221`, `index.html:911-917`; `audits/evidence/p2/HOME/verify1-switch-guest-pending.png`
- **Proposed fix.** Pointer to P2-SYNC-15.

#### P3-LEFTOVERS-05 — A slow first open shows "0 in the fridge" and "Nothing logged yet." as "the last copy saved here" (from the visual check)

- **Area** leftovers · **Type** bug · **Severity** low (pointer) · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/leftovers.md:339`; `index.html:458`, `apps/hub.js:51`, `apps/hub.js:337`, `apps/hub.js:334-337`; `audits/screens/leftovers/stalled-loading-ipad-landscape-dark.png`, `audits/evidence/p3/leftovers/before-ready-B-stalled-7s-iphone.png`
- **Proposed fix.** Pointer to P2-SYNC-15: a loading state until the first pull; "Nothing logged yet" only after it.

#### UX-TALLY-2 — While loading there is no skeleton or busy state, and taps first do nothing

- **Area** tally · **Type** usability · **Severity** low (pointer) · **Effort** S · **Batch** 0b
- **Verified (step 3).** was medium; skeptics low (partly) and low. Correction: "Taps first do nothing" holds only on the first open of Tally on a device (no tally cache) with a slow first pull. On a normal network the dead window is about 0.2 s, and on any later open it is about 0.1 s even with a 9 s held pull.
- **Evidence.** `audits/03-apps/tally.md:493`; `apps/tally.html:130`; `audits/evidence/p3/tally/loading-at-1500ms-iphone.png`, `audits/screens/tally/main-loading-ipad-portrait-light.png`
- **Proposed fix.** Pointer to P3-TALLY-07 for the display; buttons disabled with aria-busy while loading. (Phase 3: IMP-TALLY-P2)

#### UX-TIMER-9 — Before data loads the app shows a fake idle 5:00 with a live-looking Start that ignores taps

- **Area** timer · **Type** usability · **Severity** low (pointer) · **Effort** S · **Batch** 0b
- **Evidence.** `audits/03-apps/timer.md:355`; `apps/timer.html:57`, `apps/timer.html:76`; `audits/evidence/p3/timer/slowload-at-2s-iphone.png`, `audits/screens/timer/running-loading-ipad-portrait-light.png`
- **Proposed fix.** Pointer to P3-TIMER-01 (disabled until loaded, a skeleton dial). (Phase 3: IMP-TIMER-P4)

### Batch 0c — SDK and shell: queued writes are never dropped, switching is clean (24)

#### P2-PROF-02 — Offline person-scope writes are stuck on the shared iPad after Switch; an F260 tick was permanently lost

- **Area** shell / platform (F260) · **Type** bug · **Severity** critical · **Effort** M · **Batch** 0c
- **Evidence.** `audits/02-shell.md:1181`; `index.html:729-733`, `index.html:1275`
- **What happens now.** Writes wait in `hub.queue.<app>.person.<id>`. Flush walks only the signed-in person's channels (hub.js:183-187, 253-257). signOut does not flush (hub.js:175-178), and with no app open closeViewer does not either (index.html:729-733). The writes flush only when the same person signs in again on the same device.
- **Why it matters.** this is the household's original complaint. F260 progress made on the shared iPad does not appear on the person's phone, and can be lost. Sync's F260 causes table lists it as "PROVEN in Profiles".
- **Proposed fix.** Queues are keyed per profile and flushed with that profile's session before and after a Switch; a stranded queue is flushed the next time that person signs in on the device, never dropped (apps/hub.js:30, index.html:729-733).
- **How it will be verified.** Rerun `node "audits/tools/phase2/PROF/verify-person-writes-stranded-after-switch-2.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-PROF-14 — A fast-clocked device's write before its first pull: the next stale edit by someone else reverts, and a clock over 5 min fast stops that device seeing later edits, which its next edit overwrites

- **Area** shell / platform · **Type** bug (security) · **Severity** critical · **Effort** M · **Batch** 0c
- **Evidence.** `audits/02-shell.md:1467`; `apps/hub.js:236`, `worker/src/data.js:41`, `apps/hub.js:244`, `apps/leftovers.html:281`
- **What happens now.** (apps/hub.js:236, 276, 296, 300; worker/src/data.js:41, 60)
- **Why it matters.** Writes the device already accepted and showed are thrown away when an app closes, when the TV signs in, on "Forget this device", above 200 queued rows, or after a Switch; a fast clock reverts other people's edits; a pull in flight during Switch shows one person's private prayers to the next.
- **Proposed fix.** The Worker never stores an updated_at more than 30 s ahead of its own clock (clamp to server now), and hub.js stamps writes with `Date.now() - hub.skew`; a clock more than 5 min out shows a warning in Me.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PROF/verify4-p2-prof-14-2.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-PROF-19 — "Forget this device" deletes unsent queued writes, and any profile, kids included, can tap it

- **Area** shell / platform · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:1590`; `apps/hub.js:267-269`, `index.html:1273-1279`, `index.html:1285-1289`, `apps/hub.js:30`
- **What happens now.** The Sync card, with Forget, is rendered for every profile with no kind check (index.html:1273-1279; the button at :1278). By contrast, Notifications (:1262) and Admin (:1280) are gated.
- **Why it matters.** the loss is permanent and hidden. It is reachable by any profile on the shared iPad, at exactly the moment sync is misbehaving.
- **Proposed fix.** "Forget this device" flushes queued writes first (or refuses while offline with "3 changes not yet saved"), and is shown to adults only.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PROF/verify2-forget-device-drops-queue-2.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-SYNC-06 — More than 200 queued rows in one channel are all dropped (400 `bad_batch`); the device keeps showing them

- **Area** shell / platform · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:2523`; `apps/hub.js:257-264`, `worker/src/index.js:314`, `apps/hub.js:268`, `index.html:769`
- **What happens now.** `flush` sends the whole channel queue in one POST (apps/hub.js:257-264). The Worker rejects more than 200 items (worker/src/index.js:314), and hub.js clears the whole queue (apps/hub.js:268: "bad request: drop rather than retry forever"). Measured, 201 offline reminders: server 0 of 201; the phone still lists 201 after a reload;
- **Why it matters.** data the person saw saved never reaches the family, with no lasting sign. The Prayer import even confirms "Backup restored.".
- **Proposed fix.** flush() sends at most 200 rows per request and loops until the queue is empty; a 4xx on one row drops only that row and says so (apps/hub.js:257-264); Prayer's import reports the server's answer, not "Backup restored."
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-batch-over-200-dropped-1.mjs"`, `node "audits/tools/phase2/SYNC/verify-batch-over-200-dropped-2.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-SYNC-07 — A family-scope write queued by an adult is discarded if the next sign-in on that device is the kiosk profile

- **Area** shell / platform (TV) · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:2554`; `apps/hub.js:30`, `apps/hub.js:254`, `worker/src/auth.js:110`, `apps/hub.js:266`
- **What happens now.** Family queue keys have no person (apps/hub.js:30), and the queue survives the picker because `flush` needs a session (apps/hub.js:254). The kiosk's first flush gets 403 `read_only` (worker/src/auth.js:110). hub.js clears the queue (apps/hub.js:266), then sets 'synced' (:280).
- **Why it matters.** the Kitchen iPad can double as the display. A reminder or leftover logged just before switching to it vanishes, while the iPad itself still shows it, so its author has no reason to enter it again.
- **Proposed fix.** Before the kiosk signs in on a device, flush the previous adult's family queue with their session (or keep it for their next sign-in); the kiosk never inherits or empties another person's queue.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-kiosk-drops-family-queue-2.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-SYNC-09 — A pull in flight during Switch saves the previous person's rows into the next person's cache

- **Area** shell / platform · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:2595`; `apps/hub.js:305`
- **What happens now.** `hub.reset()` does not cancel the in-flight pull (apps/hub.js:305, 370), and the next `hub.ready()` reuses it. When the old response arrives, `pullScope` re-reads under the new `pid()` (`refreshScope`, :190-195, 291). It then saves the old person's rows and advances `since` under the new person's key (:297-301). Timer.
- **Why it matters.** on the shared iPad, one person's data, including private prayer requests, can appear in another person's cache and on their screen. The new person also misses their own updates on that channel.
- **Proposed fix.** hub.reset() aborts in-flight pulls (AbortController) and pull() discards any response whose session token is not the current one before saving it (apps/hub.js:305).
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-switch-race-cross-profile-cache-1.mjs"`, `node "audits/tools/phase2/SYNC/e6-switch-race.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-SYNC-18 — `refreshScope` swaps in the other window's store without `onChange`, so an open app keeps painting, and later writes back, a stale map

- **Area** shell / platform · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:2798`; `apps/hub.js:190-195`, `apps/f260.html:2073`, `apps/hub.js:276`
- **What happens now.** `refreshScope` (apps/hub.js:190-195) reloads store and queue from localStorage after the await in `pullScope` (:291) and `flush` (:272), without emitting. The pull loop then skips the key (:295-296). When the storage event arrives, its diff (:355-359) compares against the already-replaced store, so it emits nothing either.
- **Why it matters.** Writes the device already accepted and showed are thrown away when an app closes, when the TV signs in, on "Forget this device", above 200 queued rows, or after a Switch; a fast clock reverts other people's edits; a pull in flight during Switch shows one person's private prayers to the next.
- **Proposed fix.** refreshScope fires onChange for every key whose value changed when it adopts another window's store (apps/hub.js:190-195).
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify2-refreshscope-no-onchange-2.mjs"`, `node "audits/tools/phase2/SYNC/verify-whole-map-lww-loses-ticks-1-b2probe.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P3-TALLY-05 — Taps still queued when Tally closes are never sent by the shell; it reads synced, and a later count on another device erases them

- **Area** tally · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0c
- **Evidence.** `audits/03-apps/tally.md:314`; `index.html:457-458`, `apps/hub.js:183-187`, `index.html:634-635`, `apps/hub.js:339-342`; `audits/evidence/p3/tally/verify-critic-stranded-queue-on-close-1-2-A-me-sync.png`
- **What happens now.** Only the Tally frame's own hub.js sends the tally queue. The shell's `hub.use` list has no tally channel (`index.html:457-458`), and `flush()` walks only the channels its own window declared (`apps/hub.js:183-187, 253-257`).
- **Why it matters.** Counting offline (in the car, at the park) and then going back to Home is ordinary use. The count never reaches the person's other devices, and if they keep counting there, the phone's taps are overwritten.
- **Proposed fix.** The shell flushes every queued channel of the person (not only the channels it declares, index.html:457-458), and the app flushes on pagehide with keepalive. (Phase 3: IMP-TALLY-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/critic-stranded.mjs"`, `node "audits/tools/phase3/tally/critic-stranded-online.mjs"`, `node "audits/tools/phase3/tally/verify-critic-stranded-queue-on-close-1-1.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-SYNC-04 — After any in-page profile switch the shell stops polling; the Kitchen iPad and the TV board go stale

- **Area** shell / platform (TV) · **Type** bug · **Severity** high · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:2451`; `apps/hub.js:252`, `index.html:623`, `apps/hub.js:370`, `apps/hub.js:57`
- **What happens now.** `enterShell()` runs `hub.reset(); hub.ready()` on every sign-in (index.html:623). `hub.reset()` clears the interval (apps/hub.js:370), but `hub.ready()` re-arms it only when `!wired`, and `wired` is never reset (apps/hub.js:57, 338-342). Measured: iPad 20 GETs per 61 s before → 0 in 75 s after; TV 22 → 0 (e1d).
- **Why it matters.** the shared Kitchen iPad is switched between people all day, and the TV is the 24/7 glance screen. After one switch the data stops updating and nothing shows it.
- **Proposed fix.** hub.reset() clears `wired` (or re-creates the 30 s interval and the visibility listener) so polling resumes after every in-page switch (apps/hub.js:338-342, 370).
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-poll-dies-after-profile-switch-1.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-PROF-13 — "Forget this device" leaves the device, its sessions and its push subscriptions live on the server

- **Area** shell / platform · **Type** bug (security) · **Severity** medium · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:1445`; `worker/src/reminders.js:76`, `index.html:1285-1289`, `sw.js:53-60`
- **What happens now.** Forget makes no API call, not even /api/logout (index.html:1285-1289). Afterwards:
- **Why it matters.** ghost devices pile up in the admin list. A phone that was forgotten, for example before being given away, probably keeps getting that person's notifications.
- **Proposed fix.** "Forget this device" first flushes, then calls a new POST /api/device/forget that deletes the device, its sessions and its push subscriptions, then clears local storage.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PROF/verify-forget-leaves-server-rows-2.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-PWA-06 — Offline feed lines post late, under whoever acts next on the device

- **Area** shell / platform · **Type** bug · **Severity** medium · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:4963`; `apps/hub.js:28`, `apps/hub.js:375`, `apps/hub.js:376-386`, `apps/hub.js:339-340`
- **What happens now.** One device-wide queue key is used (apps/hub.js:28), whereas the data queues are per profile. Queue entries store no profile (apps/hub.js:375). The queue is drained only inside `hub.activity()` (apps/hub.js:376-386). It is not drained on `online`, `visibilitychange`, pull or reload (apps/hub.js:339-340).
- **Why it matters.** On the shared iPad the feed credits the wrong person, whether a guest or a kid, and shows the line as just now.
- **Proposed fix.** The activity queue is per profile (hub.aqueue.<pid>), stamped with the author and time at queue time, and drained by that person's session only.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-offline-activity-misattributed-2.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### GAP-SYNC-a1 — Unsent changes and the device pairing live only in localStorage, and no persistent-storage request is made

- **Area** shell / platform · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:2924`; `apps/hub.js:26-31`
- **What happens now.** The queue, cache, device token and session are localStorage only (apps/hub.js:26-31).
- **Why it matters.** A Safari tab can lose queued writes and its pairing after 7 days without a visit.
- **Proposed fix.** Call navigator.storage.persist() after pairing, and tell Safari-tab users on iPhone to add the hub to the Home Screen.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 0c's checks.

#### P2-PROF-15 — Switch leaves the previous person's private data cached on the device

- **Area** shell / platform · **Type** bug (security) · **Severity** low · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:1524`; `index.html:458`, `index.html:1287`
- **What happens now.** After an online Me → Switch → Ezra, localStorage still holds `hub.cache.{kidverse,prayer,timer,f260,hub}.person.eli` (hub.js:29, 105-110, 175-178). These include 19 private prayer rows, for example "Wisdom about buying a minivan". Eli does not need to open Prayer: the shell itself syncs those channels (index.html:458).
- **Why it matters.** Writes the device already accepted and showed are thrown away when an app closes, when the TV signs in, on "Forget this device", above 200 queued rows, or after a Switch; a fast clock reverts other people's edits; a pull in flight during Switch shows one person's private prayers to the next.
- **Proposed fix.** On Switch, remove the previous person's person-scope caches from localStorage after their queue has flushed.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PROF/verify-switch-leaves-private-caches-2.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-PWA-13 — Overlapping `hub.activity()` calls post feed lines twice

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:5000`; `apps/hub.js:373-386`, `apps/kidverse.html:332`
- **What happens now.** Each call pushes onto the stored queue and starts `drainActivity()`. That drain posts from its own copy and writes the queue back only at the end (apps/hub.js:373-386). There is no in-flight guard. A call made while an earlier drain is still posting re-posts the earlier lines, so N quick actions produce N(N+1)/2 lines.
- **Why it matters.** It clutters the shared feed and the TV's five lines. In Kid Verse it happens on every star that earns a badge, with no network delay needed: `award()` posts the verse line (apps/kidverse.html:332), and `reconcile()` posts the badge line (:481) from the same click.
- **Proposed fix.** One drain at a time (a promise lock around the activity flush).
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-double-post-activity-1.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-PWA-14 — The head queued feed line is dropped on a 401

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:5023`; `apps/hub.js:382`, `apps/hub.js:268`, `worker/src/index.js:445-450`
- **What happens now.** `drainActivity` drops the head line on any status below 500 other than 429, including 401 (apps/hub.js:382). The data queue deliberately keeps writes on 401 (apps/hub.js:268).
- **Why it matters.** Sessions can be revoked while the device is online: an admin Reset PIN deletes sessions (worker/src/index.js:445-450), and so do an unpair and a guest's expiry. After that, the person's next action keeps its data but loses its feed line for good.
- **Proposed fix.** On a 401 keep the queued line and retry after the next sign-in; discard it only when its author signs out.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-activity-dropped-on-401-1.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-SEC-03 — Switch while offline leaves the session valid on the server

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:1875`; `apps/hub.js:175-178`, `sw.js:31-35`, `index.html:1282`, `index.html:1285-1288`
- **What happens now.** `hub.signOut()` wraps `POST /api/logout` in `try { … } catch {}` and then clears the local session regardless (apps/hub.js:175-178). Any failure of that request is swallowed the same way: being offline, a request that runs past hub.request's 12 s timeout, or a server error.
- **Why it matters.** The person believes they signed out. The leftover token is no longer on the device. Only someone who had already copied `hub.device` and `hub.session` out of localStorage can use it, and the session is bound to that device.
- **Proposed fix.** A Switch made offline queues the logout and sends it on reconnect; the old token is refused once a new session exists for that device.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SEC/verify4-p2-sec-03-1.mjs"`, `node "audits/tools/phase2/SEC/verify4-p2-sec-03-2.mjs"`, `node "audits/tools/phase2/SEC/verify-session-lifetime-no-revoke-3.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-SYNC-11 — A slow request from the previous session signs the next person straight back out after Switch

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:2635`; `apps/hub.js:142`, `index.html:771`, `apps/hub.js:289`, `apps/hub.js:305`
- **What happens now.** `handleAuthLoss` (apps/hub.js:142, 147-155) signs out whoever is current, without checking which token the failing request carried. index.html:771 then shows the picker.
- **Why it matters.** a pre-reader who has just tapped his face is thrown back to the picker with a text message he cannot read.
- **Proposed fix.** A 401 for a token that is no longer current is ignored (compare the request's token with hub.session before signing out).
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-switch-race-bounces-next-person-1.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### P2-SYNC-16 — When localStorage is full, the queue write fails silently

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:2727`; `apps/hub.js:33`
- **What happens now.** `lsSet` swallows every error (apps/hub.js:33), and `saveStore` and `saveQueue` use it (:196-197). With storage full, an offline tick leaves the writes pending in memory and `[]` in the persisted queue, with no error and no message.
- **Why it matters.** it leaves an invisible divergence between the device and the house.
- **Proposed fix.** A failed queue write (QuotaExceededError) shows a toast and keeps the change in memory; hub.js trims the oldest caches of other people first.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-quota-errors-swallowed-2.mjs"` — the defect must no longer reproduce; plus batch 0c's checks.

#### UX-PROF-a6 — The next person inherits the previous person's theme and sync counters (hub.js:27, 90, 98, 105-110, 310; index.html:625-628, 642)

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:1032`; `index.html:625-628`; `audits/screens/shell/me-loading-iphone-pwa-light.png`
- **What happens now.** The theme is one key per device. The picker and Ezra's first paint used Eli's Forest (`switch-theme-ezra-inherits-forest.png`).
- **Why it matters.** The next person gets the previous person's look and counters.
- **Proposed fix.** A switch resets the theme to the next person's own (their cached hub/theme row, or System) and clears the sync counters; the next person lands on Home.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 0c's checks.

#### P2-PROF-01 — Signing the display profile in deletes the previous person's unsent family writes (pointer)

- **Area** shell / platform · **Type** bug · **Severity** critical (pointer) · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:1160`; `index.html:458`, `index.html:1042`, `apps/hub.js:370`
- **Proposed fix.** Pointer to P2-SYNC-07: closed by flushing (never discarding) the previous person's family queue before the kiosk signs in.

#### P2-PROF-03 — After an in-page switch the shell never polls again (pointer)

- **Area** shell / platform · **Type** bug · **Severity** high (pointer) · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:1209`; `index.html:1133`, `index.html:733`, `index.html:1115`, `index.html:1711`
- **Proposed fix.** Pointer to P2-SYNC-04: closed by re-arming the poll in hub.reset().

#### P2-STAB-02 — After an in-page profile switch, the shell never polls again (pointer → P2-SYNC-04, high)

- **Area** shell / platform · **Type** bug · **Severity** high (pointer) · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:3124`; `apps/hub.js:338-342`, `apps/hub.js:370`, `index.html:623`, `index.html:1236-1243`
- **Proposed fix.** Pointer to P2-SYNC-04.

#### P2-PROF-07 — Queued activity lines post under whoever is signed in next (pointer)

- **Area** shell / platform · **Type** bug · **Severity** medium (pointer) · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:1318`
- **Proposed fix.** Pointer to P2-PWA-06: closed by the per-profile activity queue.

#### P2-SYNC-08 — Offline feed lines stay queued after reconnecting and are posted later under whoever logs activity next

- **Area** shell / platform · **Type** bug · **Severity** medium (pointer) · **Effort** S · **Batch** 0c
- **Evidence.** `audits/02-shell.md:2584`; `index.html:1063`, `apps/hub.js:381`, `worker/src/index.js:398-400`
- **Proposed fix.** Pointer to P2-PWA-06.

### Batch 0d — Security: accounts, private content, stored script, kid safety; the Kitchen device's server rules (17 + 1 household work)

#### KITCHEN-1 — Kitchen device, data and server half: a device role, a kitchen profile kind, and server rules for what a kitchen session may write

- **Area** shell / platform (Kitchen device) · **Type** household work (P5-D5 as answered) · **Effort** M · **Batch** 0d
- **Evidence.** `audits/05-decisions.md:42`; `worker/schema.sql:9`, `worker/src/auth.js:110`, `worker/src/index.js:231`, `worker/src/index.js:470`
- **What happens now.** The only shared kinds are adult, kid and kiosk (`worker/schema.sql:9`); the kiosk cannot write at all (`worker/src/auth.js:110`), so the Kitchen iPad today is signed in as a person, and whoever picks it up inherits that person (P2-PROF-09). A paired device has no role (the `devices` table in `worker/schema.sql`), and `POST /api/login` lets any paired device sign in as any profile (`worker/src/index.js:231`).
- **Why it matters.** The household chose a shared Kitchen mode for the counter iPad instead of an idle return (P5-D5 as answered): family apps with no personal sign-ins. Only the server can make that hold; a client-only mode is one crafted request away from a personal session.
- **Proposed fix.**
  - A migration, with the D1 export first: `devices.role` (NULL or `'kitchen'`, `ADD COLUMN`, additive), and `'kitchen'` added to the profile kinds, plus one seeded kitchen profile. SQLite cannot alter a CHECK constraint, so widening `kind IN ('adult','kid','kiosk')` (`worker/schema.sql:9`) means SQLite's table rebuild of `profiles` (new table, copy, drop, rename, in one batch). It is the plan's one non-additive schema step; it is checked by row counts and a column-by-column compare before and after, and `schema.sql` follows. `sessions.profile_id` has no foreign key, so sessions survive it.
  - Login: a device whose role is kitchen can sign in only as the kitchen profile, with no PIN; the kitchen profile can sign in only from such a device (`worker/src/index.js:231`). Nobody picks a person there.
  - Writes: a kitchen session may write family scope (Larder, the family prayer list, family reminders, the album), and person scope only under its own profile id and only for Timer and Tally, which store `scope: person` today (`apps.json`), until batch 6's family timers channel (GAP-HOME-1). It can read no one's person scope. Chat and admin refuse it, as they refuse the kiosk (`worker/src/chat.js:391`, `requireAdmin` in `worker/src/auth.js`); push subscription refuses it too, a new rule, since today it checks only for a profile (`worker/src/index.js:410-412`).
  - The kitchen profile is not a person: `GET /api/profiles` marks it so every picker leaves it out (the server refuses its sign-in there anyway), `hub.people()` and the face sheet skip it, the admin's Reset PIN refuses it, and Edit accepts only its colour (the admin assigns every profile's colour, `audits/05-decisions.md`, "Admin-assigned colours"), not its name, kind or PIN.
  - The device learns its role: `GET /api/device` (device token only) returns `{ role }`. The shell asks at boot and after any 401; on a kitchen device it signs in as the kitchen profile instead of showing the picker. So a device whose role is set while it holds a personal session moves to the kitchen on its next request.
  - Attribution: a write from a kitchen session that credits someone (a name added to a family prayer's `prayedBy[date]`, `apps/prayer.html:1599-1601`; the person an activity line such as "Finished the soup" is filed under, `apps/leftovers.html:308-309`, which the Worker today takes from the session; the `by` of an album photo, `worker/src/index.js:361-369`, where only adults may add today) must name a household profile (not a guest, not the kitchen or the TV); the Worker checks it against `profiles` and refuses anything else, and refuses a kid named on a Larder write (P5-D2: kids are read-only there). Kid Verse's prayer credit already reads those names (`apps/kidverse.html:426-430`), so a kid who taps their face earns that day's prayer star with no Kid Verse change.
  - Role changes: `PUT /api/admin/devices/:id/role`, from the admin's own session on another device, with a fresh admin PIN check. Setting kitchen ends that device's other sessions; clearing it ends the device's kitchen session, and the Worker also refuses a kitchen session on any request from a device that is no longer a kitchen. So the next request gets a 401, `GET /api/device` answers no role, and the shell shows the picker. The admin's kind editor (`worker/src/index.js:470`) does not offer kitchen: a profile becomes the kitchen only through the seed.
  - CLAUDE.md in the same commit: the kitchen profile in "Profiles", the kitchen rules in "How the hub works", and `test-kitchen.mjs` in the Tests table.
- **How it will be verified.** a new kitchen test, `test-kitchen.mjs` in the repo scripts folder, in the style of `test-hub.mjs`: the kitchen device writes family data; it cannot read or write any person's scope; it cannot sign in as a person, and no other device can sign in as the kitchen; a face tap on Prayed credits the tapped person (Ezra's prayer star appears after Kid Verse opens); a name outside the household is refused; new `scripts/smoke-api.sh` cases: the role endpoint is admin only and needs the PIN; kitchen chat, push and admin calls get 403; the kitchen is absent from `GET /api/profiles`' picker list; a kid named on a Larder write is refused; after the role is cleared, the old kitchen session gets 401; the migration on a copy of the production export: same row count and same values in every `profiles` column before and after; plus batch 0d's checks.

#### P2-PROF-04 — After any Reset PIN, any paired device can create that adult's PIN and take over the account, admin included

- **Area** shell / platform · **Type** bug (security) · **Severity** critical · **Effort** M · **Batch** 0d
- **Evidence.** `audits/02-shell.md:1231`
- **What happens now.** POST /api/profiles/:id/pin resolves only the device (index.js:252). It sets the PIN of any non-guest adult whose `pin_hash` is NULL, whoever is signed in on that device, and returns that adult's session. It writes no feed line (index.js:250-268). The claimer can read and write that adult's person-scope data and chat history.
- **Why it matters.** A forgotten-PIN reset, the documented recovery (CLAUDE.md:90), opens that adult's person-scope data and chat history to whoever taps first on any paired device. The skeptics read David's F260 and verses rows and his chat history. His private prayer list lives in the same scope.
- **Proposed fix.** Reset PIN no longer leaves an open claim: the admin's reset issues a one-time code (shown once to the admin, expiring in 24 h) that the person must enter before creating a new PIN; the admin's own reset needs the admin's current PIN. Server-side in worker/src/auth.js and index.js.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PROF/verify-pin-claim-any-device-2.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### P2-PWA-01 — Praying for or answering a private request posts its title to the family feed and the TV

- **Area** shell / platform (TV) · **Type** bug (security) · **Severity** critical · **Effort** S · **Batch** 0d
- **Evidence.** `audits/02-shell.md:4881`; `worker/src/index.js:214`, `apps/prayer.html:1606`, `apps/prayer.html:1329`, `apps/hub.js:387`
- **What happens now.** On the Mine list, ticking a request posts "Prayed for <title>" (apps/prayer.html:1606). That line checks the list only to add " (family list)" to shared rows. "Mark answered" posts "Answered: <title>" with no list check at all (apps/prayer.html:1329).
- **Why it matters.** The Prayer spec keeps these requests private on purpose. A request copied to the family list gets a new title, because "the private wording is often not the wording you want on a shared screen" (handoff/prayer/SPEC.md:35-38).
- **Proposed fix.** Praying for or answering a private request posts no title: "Prayed for a private request" or no line at all (apps/prayer.html:1606, 1329); the Worker refuses activity text for person-scope prayer rows.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-private-prayer-titles-on-family-feed-1.mjs"`, `node "audits/tools/phase2/PWA/rescale-1x.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### P3-DOLLYWOOD-LIVE-01 — A profile or guest name runs as script in everyone's park map; the admin's tokens can be read and replayed

- **Area** dollywood-live · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0d
- **Evidence.** `audits/03-apps/dollywood-live.md:147`; `index.html:1396`, `index.html:413`, `apps/dollywood-live.html:1253`, `worker/src/index.js:178-179`; `audits/evidence/p3/dollywood-live/xss-guest-eli-family-ipad.png`, `audits/evidence/p3/dollywood-live/verify-xss-family-name-unescaped-1-eli-family-ipad.png`
- **What happens now.** `publish()` writes the person's name into the family row `loc:<id>` (`apps/dollywood-live.html:1253`). The server stores any name, only trimmed and cut to 40 characters (`worker/src/index.js:178-179`).
- **Why it matters.** A guest's name, typed in good faith or not, can hand whoever planted it the admin's account the next time Eli opens the map on a park day. The admin can reset PINs, rotate the pairing code and unpair devices. The kids' pages run the same script.
- **Proposed fix.** Escape every name and emoji the park map interpolates (hub.escape, or textContent) in renderFam, showFamily, the sharer's row and renderKids (template :1430, :1434, :1444, :1674-1675); the Worker also rejects "<" and ">" in profile and guest names; add a Content-Security-Policy without 'unsafe-inline' event handlers as defence in depth. (Phase 3: IMP-DOLLYWOOD-LIVE-P1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-xss-family-name-unescaped-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-xss-family-name-unescaped-1.mjs"`, `node "audits/tools/phase3/dollywood-live/xss-guest-name.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### P2-SEC-01 — An adult PIN, including the admin's, can be brute-forced by pairing many devices

- **Area** shell / platform · **Type** bug · **Severity** high · **Effort** M · **Batch** 0d
- **Evidence.** `audits/02-shell.md:1743`; `worker/src/index.js:240`, `worker/src/index.js:142-157`; `audits/evidence/p2/SEC/ui-route-multi-pair-window1-locked.png`, `audits/evidence/p2/SEC/ui-route-multi-pair-window3-admin.png`
- **What happens now.** The wrong-PIN limit is keyed on `login:${p.id}:${device.id}` (worker/src/index.js:240), with 5 attempts per 15 minutes (index.js:241-243). Every newly paired device therefore gets its own 5 guesses against the same profile.
- **Why it matters.** The PIN is all that separates a paired device from an adult's account and from the admin's. Admin rights cover rotating the pairing code, resetting PINs, unpairing devices and editing profiles.
- **Proposed fix.** Rate-limit wrong PINs per profile across all devices (e.g. 10 per hour, then exponential back-off, then admin unlock), in addition to per device; alert the admin by push after repeated failures.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SEC/verify-pin-brute-via-multi-pairing-1.mjs"`, `node "audits/tools/phase2/SEC/verify-pin-brute-via-multi-pairing-2.mjs"`, `node "audits/tools/phase2/SEC/rate-limits.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### P3-DOLLYWOOD-LIVE-02 — The shipped UI lets a guest switch a child's location beacon on or off and overwrite the kids' heights

- **Area** dollywood-live · **Type** bug · **Severity** high · **Effort** S · **Batch** 0d
- **Evidence.** `audits/03-apps/dollywood-live.md:181`; `apps/dollywood-live.html:1307`, `apps/dollywood-live.html:1546`, `apps/dollywood-live.html:1308`, `apps/dollywood-live.html:1548`; `audits/evidence/p3/dollywood-live/rally-guest-family-iphone.png`, `audits/evidence/p3/dollywood-live/verify-guest-can-flip-kid-beacon-1-guest-family-iphone.png`
- **What happens now.** The Kids' beacons block is gated only on `hub.profile.kind==='adult'&&hub.canWrite` (`apps/dollywood-live.html:1307`), and the heights stepper hides only when `kind!=='adult'` (`apps/dollywood-live.html:1546`). Guests are kind `adult` with `is_guest` set, so they get both.
- **Why it matters.** A visitor can start broadcasting a 4- or 5-year-old's live position that the parents left off, or switch off a beacon a parent turned on. Switching off removes `loc:<kid>`, so the parents lose the child's live marker;
- **Proposed fix.** Only household adults (kind adult and not a guest) see and use the beacon and height controls (template :1307, :1546-1548), and the Worker refuses kidshare:/kid: writes from guests and kids. (Phase 3: IMP-DOLLYWOOD-LIVE-P2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-guest-can-flip-kid-beacon-1.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-guest-can-flip-kid-beacon-2.mjs"`, `node "audits/tools/phase3/dollywood-live/rally-guest-loading.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### P3-PRAYER-06 — Stored XSS through a family prayer row's id

- **Area** prayer · **Type** bug (security) · **Severity** high · **Effort** S · **Batch** 0d
- **Evidence.** `audits/03-apps/prayer.md:346`; `index.html:413`, `apps/prayer.html:1184`, `apps/prayer.html:717`, `apps/hub.js:235`; `audits/evidence/p3/prayer/verify-xss-row-id-1-eli-after-tick.png`
- **What happens now.** Titles and notes go through `esc()` (`apps/prayer.html:717`), but the row id is concatenated raw into attributes: `data-pray` and `data-open` (`:845, 847`), the kid card's `data-kpray` (`:1587`), anniversaries (`:925`), the answered list (`:935`) and the sheet buttons (`:1007-1017`).
- **Why it matters.** Script in the hub origin can read both tokens in localStorage, including the admin's, and could send them anywhere.
- **Proposed fix.** esc() every id placed in markup (row and plan ids), and drop rows whose id fails /^[A-Za-z0-9_-]+$/ on load. (Phase 3: IMP-PRAYER-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-xss-row-id-1.mjs"`, `node "audits/tools/phase3/prayer/verify-xss-row-id-2.mjs"`, `node "audits/tools/phase3/prayer/xss-id.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### P3-PRAYER-17 — Stored XSS through a family plan id: the Settings plan list puts it into markup raw (from the critic)

- **Area** prayer · **Type** bug (security) · **Severity** high · **Effort** S · **Batch** 0d
- **Evidence.** `audits/03-apps/prayer.md:590`; `apps/prayer.html:599-600`, `worker/src/index.js:280-318`, `apps/prayer.html:638`, `apps/prayer.html:1181-1184`; `audits/evidence/p3/prayer/critic-planxss-kiara.png`, `audits/evidence/p3/prayer/verify-critic-plan-id-xss-1-1-kiara.png`
- **What happens now.** `renderPlans()` builds the Settings "Active plan" list as `'<option value="' + p.id + '"' …` with no `esc()`, while plan names are escaped (`apps/prayer.html:1181-1184`).
- **Why it matters.** Script in the hub origin can read `hub.session` and `hub.device`, the admin's included, on every kid device and every adult device that shows the family list, and it stays planted.
- **Proposed fix.** esc() plan ids in the Settings plan list and drop invalid plan ids in migrate(). (Phase 3: IMP-PRAYER-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/critic-sweep.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-plan-id-xss-1-1.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-plan-id-xss-1-2.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### P2-CHAT-02 — A kid can rewrite the park map's adult-only rows through chat

- **Area** shell / platform (park map) · **Type** bug · **Severity** medium · **Effort** S · **Batch** 0d
- **Evidence.** `audits/02-shell.md:3802`; `apps/dollywood-live.html:693`, `worker/src/chat.js:52`, `worker/src/index.js:90-93`, `worker/src/auth.js:108-111`; `audits/evidence/p2/CHAT/verify-kid-meet-on-adult-map-iphone-light.png`
- **What happens now.** The kid guard on `set_data` (chat.js:174) refuses only apps that have `visibleTo` (chat.js:119). `dollywood-live` has none (apps.json). As Ezra, with the real apps array, each of these came back "✓ Saved <key> in dollywood-live":
- **Why it matters.** At the park, a child can move the family meeting point or a parent's marker just by talking. Adults' maps then show the pill "Meet at Candy shop (Ezra) · set by Ezra just now · kid set this" (audits/evidence/p2/CHAT/verify-kid-meet-on-adult-map-iphone-light.png).
- **Proposed fix.** Chat enforces kid limits on the server: for a kid session, set_data and add_list_item are refused on the park map's adult rows and every adult-only app.
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-kid-chat-writes-adult-only-rows-1.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### P2-PROF-05 — Only the UI enforces kid limits on family data

- **Area** shell / platform · **Type** bug (security) · **Severity** medium · **Effort** M · **Batch** 0d
- **Evidence.** `audits/02-shell.md:1267`; `apps/kidverse.html:442-465`, `index.html:1272`
- **What happens now.** /api/data PUT, DELETE and batch (index.js:280-318) check only "not the kiosk" (auth.js:108-112). There is no key, app or author check. Any paired device can open a kid session without a PIN (index.js:238). As Ezra, the server accepted all of these: a parent-style cash-in ledger row against Kiara.
- **Why it matters.** a sibling can wipe another child's stars, switch on a location beacon, or clear shared lists. Kiosk limits are server-enforced; kid limits are not.
- **Proposed fix.** The Worker enforces kid limits on family data: a kid session may write only the rows its apps write (prayer prayedBy marks, kidverse stars/story, its own person scope), never tombstones family rows of other apps (worker/src/data.js).
- **How it will be verified.** Rerun `node "audits/tools/phase2/PROF/verify-kid-family-writes-server-2.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### P3-PRAYER-18 — "Send to family list" publishes the private request's For and category although its panel offers only the title, and the push adds "(for …)" (from the critic)

- **Area** prayer · **Type** bug (security) · **Severity** medium · **Effort** S · **Batch** 0d
- **Evidence.** `audits/03-apps/prayer.md:622`; `apps/prayer.html:1308-1309`, `worker/src/reminders.js:196-201`, `apps/prayer.html:996`, `apps/prayer.html:1580-1582`; `audits/evidence/p3/prayer/critic-share-panel.png`, `audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-1-panel.png`
- **What happens now.** The share panel has one field, the title, with the help line "Everyone in the house can see it." (`apps/prayer.html:1308-1309`). The family copy blanks `phone` and `detail` but copies `for` and `category` (`:1314-1315`), and adds the category to the family list (`:1311`).
- **Why it matters.** The adult rewrote the title precisely to hide who and what the request is about; the app publishes both anyway, to other adults, guests and lock screens.
- **Proposed fix.** The share panel shows what will be published (title, For, category), each removable, and by default shares only the title; the push carries only what was shared. (Phase 3: IMP-PRAYER-P12)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/critic-push-share.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-share-copies-for-and-category-2-1.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-share-copies-for-and-category-2-2.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### GAP-PROF-a1 — No self-service "change my PIN"

- **Area** shell / platform · **Type** feature gap · **Severity** low · **Effort** M · **Batch** 0d
- **Evidence.** `audits/02-shell.md:987`
- **What happens now.** The only route to a new PIN is the admin's Reset PIN, which opens the claim window of P2-PROF-04.
- **Why it matters.** The only way to change a PIN opens an account takeover window.
- **Proposed fix.** Me → Change my PIN (current PIN, then new PIN twice), server-verified; this also replaces the claim window that Reset PIN opens (P2-PROF-04).
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 0d's checks.

#### P2-CHAT-07 — `get_data` by key sends the encrypted journal vault upstream

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 0d
- **Evidence.** `audits/02-shell.md:4014`; `apps/f260.html:1160`, `worker/src/chat.js:19`, `apps/f260.html:986-1033`
- **What happens now.** The listing filters `.vault` keys (chat.js:169), and `set_data` refuses them (chat.js:176). But `get_data` with an explicit key (chat.js:168) returns the value as a `tool_result` with no `.vault` check.
- **Why it matters.** The ciphertext and salt of a private journal leave the house for no purpose. Anyone holding the request log could brute-force a short passcode. The key reaches the model only if the person names it, the model guesses it, or a prompt injection in household data steers it there.
- **Proposed fix.** get_data refuses `.vault` keys by name as the listing already hides them (worker/src/chat.js).
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-vault-readable-by-key-1.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### P2-SEC-02 — `visibleTo` is a client-side filter; the server does not enforce it for data or, reliably, for chat

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 0d
- **Evidence.** `audits/02-shell.md:1816`; `worker/src/data.js:15`, `index.html:1041-1042`
- **What happens now.** The data API has no per-app gate. `/api/data` checks only three things (index.js:280-318 via `dataArgs`; auth.js:104-112): the scope; that a profile exists, for person-scope reads and for writes; that the kiosk cannot write. The Worker never loads `apps.json`. Person scope is always keyed to the caller (`owner()`, worker/src/data.js:15).
- **Why it matters.** `visibleTo` looks like access control but is only presentation. Nothing leaks today. The only apps hidden from kids (f260, dollywood) are person-scoped and hold 0 family-scope rows.
- **Proposed fix.** The data API enforces visibleTo (apps.json read at build into the Worker, or a server copy): a profile cannot read or write rows of an app it cannot open; chat takes app visibility from the server copy, never from the request.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SEC/verify-visibleto-not-server-enforced-2.mjs"`, `node "audits/tools/phase2/SEC/verify-visibleto-not-server-enforced-1.mjs"` — the defect must no longer reproduce; plus batch 0d's checks.

#### UX-KIDVERSE-3 — Guests can step the household's memory-verse week

- **Area** kidverse · **Type** usability · **Severity** low · **Effort** S · **Batch** 0d
- **Evidence.** `audits/03-apps/kidverse.md:668`; `worker/src/index.js:196-198`, `apps/kidverse.html:337`; `audits/evidence/p3/kidverse/adult-week-B-guest-stepper.png`, `audits/screens/kidverse/adult-guest-typical-iphone-pwa-light.png`
- **What happens now.** Guests are kind "adult" (`worker/src/index.js:196-198`), and the stepper checks only `kind === 'adult'` and `canWrite` (`apps/kidverse.html:337, 369`). When Grandma Jo tapped +, the row became `{week:39, by:'guest-grandmajo'}`.
- **Why it matters.** Guests can change the household's week.
- **Proposed fix.** Only household adults step the family week (the Worker refuses guests). (Phase 3: IMP-KIDVERSE-F1)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 0d's checks.

#### UX-PROF-a7 — Ten wrong codes block pairing for the whole household for 15 minutes

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 0d
- **Evidence.** `audits/02-shell.md:1052`; `index.html:1278`
- **What happens now.** The limit key is `pair:<CF-Connecting-IP>` (index.js:46, 142-150). The code allows 10 wrong codes, then answers 429. The rig's "401 ×9" came from one earlier wrong code from the same IP (see Measurements).
- **Why it matters.** Ten wrong codes lock every home device out of pairing for 15 minutes.
- **Proposed fix.** Pairing failures are limited per device fingerprint and per IP with a lower ceiling for the IP, so one bad actor cannot block the household (keep P2-SEC-01's per-profile limit).
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 0d's checks.

#### P2-PROF-06 — The admin's own Reset PIN leaves the admin profile claimable (pointer)

- **Area** shell / platform · **Type** bug · **Severity** critical (pointer) · **Effort** S · **Batch** 0d
- **Evidence.** `audits/02-shell.md:1299`; `index.html:1599`, `index.html:611`
- **Proposed fix.** Pointer to P2-PROF-04: the admin's own reset requires the current PIN.

#### P2-CHAT-06 — Chat takes app visibility and names from the request body

- **Area** shell / platform · **Type** bug (security) · **Severity** low (pointer) · **Effort** S · **Batch** 0d
- **Evidence.** `audits/02-shell.md:3984`; `worker/src/chat.js:118-119`, `index.html:1494`, `worker/src/index.js:231-249`
- **Proposed fix.** Pointer to P2-SEC-02: chat takes visibility and names from the server.

### Batch 0e — F260 and Verses: rows that cannot erase each other, a journal that cannot corrupt (8)

#### P2-SYNC-01 — F260 and the build guide keep all ticks in one row; a device with an older copy silently erases another device's tick

- **Area** shell / platform (F260, build guide) · **Type** bug · **Severity** critical · **Effort** L · **Batch** 0e
- **Evidence.** `audits/02-shell.md:2350`; `apps/f260.html:2089`, `apps/f260.html:1659-1662`, `apps/hub.js:236`, `worker/src/data.js:39-64`
- **What happens now.** F260 rewrites the whole `f260.done` and `f260.log` maps on every tap (apps/f260.html:1659-1662). hub.js and the Worker resolve per row, last write wins (apps/hub.js:236, 276, 293-299; worker/src/data.js:39-64). The phone ticked Acts 6, which was on the server in 526–745 ms. The iPad, not yet pulled, ticked Acts 7.
- **Why it matters.** this matches the household's original report ("does not save on the phone"). It is silent on the primary devices and breaks `weekDone`, the Today card and build-guide progress.
- **Proposed fix.** F260 and the build guide store one row per tick (`done:<week>-<i>`, `step:<id>`) instead of whole maps, as CLAUDE.md prescribes for lists; a one-time client migration splits the old map row and keeps it read-only. (Phase 3: IMP-DOLLYWOOD-F5)
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-whole-map-lww-loses-ticks-2.mjs"`, `node "audits/tools/phase2/SYNC/e2a-stale-overwrite.mjs"` — the defect must no longer reproduce; plus batch 0e's checks.

#### P2-SYNC-19 — Past a journal size limit, every F260 journal save fails silently while the panel says "Saved"

- **Area** shell / platform (F260) · **Type** bug · **Severity** critical · **Effort** M · **Batch** 0e
- **Evidence.** `audits/02-shell.md:2835`; `apps/f260.html:993`
- **What happens now.** `b64 = a => btoa(String.fromCharCode.apply(null, new Uint8Array(a)))` (apps/f260.html:993) throws `RangeError: Maximum call stack size exceeded` past the limit. `persistJournal` (1015-1024) swallows that error with `.catch(() => {})` (1023).
- **Why it matters.** the person's most private writing is lost behind a false "Saved" confirmation, with no sign anywhere.
- **Proposed fix.** Encode the journal ciphertext with a chunked base64 (no String.fromCharCode.apply), check the save succeeded before saying "Saved", and say "Not saved — …" on failure.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify2-journal-silently-stops-saving-2.mjs"`, `node "audits/tools/phase2/SYNC/verify-413-drops-whole-channel-1-real.mjs"` — the defect must no longer reproduce; plus batch 0e's checks.

#### P2-SYNC-20 — A failed journal save stores a new `iv` with the old ciphertext; the right passcode then says "Wrong passcode." (on every device if it happened offline)

- **Area** shell / platform · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0e
- **Evidence.** `audits/02-shell.md:2868`; `apps/f260.html:1020`, `apps/hub.js:220-222`, `apps/hub.js:238-239`, `apps/hub.js:296`
- **What happens now.** `persistJournal` runs `const blob = vaultBlob() || {}; blob.v = 2; blob.iv = b64(iv); blob.ct = b64(ct);` (apps/f260.html:1020). `vaultBlob()` returns the live object the hub.js store holds (f260.html:998, 901; apps/hub.js:220-222). So the new `iv` is written into it before `b64(ct)` throws.
- **Why it matters.** The whole encrypted HEAR journal becomes undecryptable, not just the newest entry. The only matching `iv` is gone, and `app_data` keeps no history. The app blames the passcode, and its dialog offers erasing the journal as the only remedy (f260.html:1136).
- **Proposed fix.** Build the new vault object as a copy and replace the stored one only after encryption and encoding succeed, so iv and ciphertext always change together.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify2-journal-vault-iv-mismatch-2.mjs"`, `node "audits/tools/phase2/SYNC/verify-413-drops-whole-channel-3-ivmix.mjs"` — the defect must no longer reproduce; plus batch 0e's checks.

#### P3-F260-01 — Rating a verse in F260's practice dialog erases its schedule in the Verses trainer

- **Area** f260 · **Type** bug · **Severity** critical · **Effort** M · **Batch** 0e
- **Evidence.** `audits/03-apps/f260.md:150`; `apps/f260.html:1648-1650`, `apps/f260.html:1343-1346`, `apps.json:4`, `apps.json:12`; `audits/evidence/p3/f260/recall-practice-reveal-ipad.png`, `audits/evidence/p3/f260/recall-verses-after-ipad.png`
- **What happens now.** F260's "Got it" and "Not yet" both write `recall[prId] = { s, t: Date.now() }` (`apps/f260.html:1915`), a new object that never reads the previous entry, and save the whole map through `hub.set` (`apps/f260.html:902`).
- **Why it matters.** Spaced repetition is weeks of reviews. A well-learned verse silently drops back to daily review with its streak at 0, and the F260 "Got it" is not even counted as a review in Verses.
- **Proposed fix.** One row per verse (`recall:<id>`) that both apps merge field by field: F260's practice rating writes only {s, t} into the verse's row and never replaces box/due/last/streak (apps/f260.html:1915 → merge; apps/verses.html:296). (Phase 3: IMP-F260-P1, IMP-VERSES-P1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-recall-practice-wipes-verses-box-1.mjs"`, `node "audits/tools/phase3/f260/verify-recall-practice-wipes-verses-box-2.mjs"`, `node "audits/tools/phase3/f260/recall.mjs"` — the defect must no longer reproduce; plus batch 0e's checks.

#### P3-F260-13 — A device with the journal still unlocked overwrites a vault that another device erased or re-created; the journal then opens nowhere (from the critic)

- **Area** f260 · **Type** bug · **Severity** critical · **Effort** M · **Batch** 0e
- **Evidence.** `audits/03-apps/f260.md:462`; `apps/f260.html:920`, `apps/f260.html:1015-1022`, `apps/f260.html:2089`, `apps/hub.js:342`; `audits/evidence/p3/f260/critic-vault-stale-E1-phone-unlock.png`, `audits/evidence/p3/f260/critic-vault-stale-E2-phone-unlock.png`
- **What happens now.** `persistJournal()` encrypts the journal with the data key it holds in memory and writes `iv` and `ct` into whatever vault row the hub cache holds at that moment (`const blob = vaultBlob() || {}`, `apps/f260.html:1015-1022`). It never checks that the row still carries the key wrap it unlocked.
- **Why it matters.** The whole journal becomes unopenable on every device, and the entries written after starting over are gone. The only message is a raw JavaScript error, and the only way forward is another Erase.
- **Proposed fix.** The vault carries a version (a random id per erase/re-create); a device holding an older version refuses to write and asks to unlock again, so an erased or re-created vault is never overwritten. (Phase 3: IMP-F260-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/critic-vault-stale-device.mjs"`, `node "audits/tools/phase3/f260/verify-critic-vault-stale-device-overwrites-1-1.mjs"`, `node "audits/tools/phase3/f260/verify-critic-vault-stale-device-overwrites-1-2.mjs"` — the defect must no longer reproduce; plus batch 0e's checks.

#### P3-VERSES-02 — Two devices reviewing: one device's ratings and the day's review count are silently erased

- **Area** verses · **Type** bug · **Severity** critical · **Effort** M · **Batch** 0e
- **Evidence.** `audits/03-apps/verses.md:170`; `apps/hub.js:342`, `apps/f260.html:2089`, `apps/f260.html:668`, `apps/f260.html:927`; `audits/evidence/p3/verses/two-devices-A-phone-after-poll.png`, `audits/evidence/p3/verses/two-devices-B-phone-after-poll.png`
- **What happens now.** Every rating rewrites the whole `f260.recall` map and the whole `verses.log` map from the device's own cache (`{...recall()}`, `{...log()}`, `apps/verses.html:294-298`). `hub.set` stamps the whole row (`apps/hub.js:236`), and the newer stamp wins per row, on the device (`apps/hub.js:295-296`) and on the server (`worker/src/data.js:60`).
- **Why it matters.** Verses already recited come back, the day's review count is wrong, and nobody is told. It is the "it didn't save on the phone" complaint in a new row.
- **Proposed fix.** One row per verse (`recall:<id>`) and a per-day review count row, so two devices' ratings both survive. (Phase 3: IMP-VERSES-F4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/verify-recall-log-whole-map-lww-1.mjs"`, `node "audits/tools/phase3/verses/verify-recall-log-whole-map-lww-2.mjs"`, `node "audits/tools/phase3/verses/two-devices.mjs"` — the defect must no longer reproduce; plus batch 0e's checks.

#### P3-F260-14 — Face ID unlock is one synced slot: other devices show a Face ID button that fails, and enabling it on a second device breaks the first (from the critic)

- **Area** f260 · **Type** bug · **Severity** medium · **Effort** S · **Batch** 0e
- **Evidence.** `audits/03-apps/f260.md:499`; `apps/f260.html:1076`, `apps/f260.html:1083`, `apps/f260.html:902`, `apps/f260.html:1060`
- **What happens now.** `enableBio()` creates a platform credential (`authenticatorAttachment: 'platform'`, `apps/f260.html:1076`) and stores its wrap of the data key as `blob.bio`, one slot inside the vault row (`apps/f260.html:1083`), which syncs through `hub.set` (`apps/f260.html:902`).
- **Why it matters.** The Unlock dialog offers a button that fails on every device but one, Settings says "On." where it is not, and setting up the second device silently breaks the first.
- **Proposed fix.** Face ID wraps are per device (`vault.prf[<deviceId>]`), so each device enables its own and other devices hide the button. (Phase 3: IMP-F260-P12)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/critic-faceid.mjs"`, `node "audits/tools/phase3/f260/verify-critic-faceid-wrap-synced-single-slot-2-1.mjs"`, `node "audits/tools/phase3/f260/verify-critic-faceid-wrap-synced-single-slot-2-2.mjs"` — the defect must no longer reproduce; plus batch 0e's checks.

#### P3-VERSES-01 — Rating a verse in F260's practice dialog wipes its Verses schedule (box, due date, last review, streak) (pointer to P3-F260-01)

- **Area** verses · **Type** bug · **Severity** critical (pointer) · **Effort** S · **Batch** 0e
- **Evidence.** `audits/03-apps/verses.md:138`; `apps/f260.html:1915`, `apps/f260.html:1651`, `apps/verses.html:296`, `apps/verses.html:219`; `audits/evidence/p3/verses/f260-practice-wipes-1-0-ipad.png`, `audits/evidence/p3/verses/f260-practice-wipes-1-0-queue-ipad.png`
- **Proposed fix.** Pointer to P3-F260-01 (per-verse merged recall rows). (Phase 3: IMP-VERSES-P1)

### Batch 0f — Tally and Kid Verse: counts and stars that add up across devices (3)

#### P3-KIDVERSE-02 — A kid's second device with an older copy of the stars row erases a verse star earned on the first device

- **Area** kidverse · **Type** bug · **Severity** critical · **Effort** L · **Batch** 0f
- **Evidence.** `audits/03-apps/kidverse.md:208`; `apps/hub.js:342`, `apps/kidverse.html:330-331`, `apps/hub.js:236-239`, `worker/src/data.js:60-62`; `audits/evidence/p3/kidverse/stale-device-offline-ipad-after-pull.png`, `audits/evidence/p3/kidverse/verify-stale-device-erases-star-1-A-ipad-after-pull.png`
- **What happens now.** `award()` and `reconcile()` write the whole stars object, as person row and family mirror (`apps/kidverse.html:330-331, 478`). Each row is last-write-wins on the writer's stamp (`apps/hub.js:236-239`; `worker/src/data.js:60-62`). `pulled()` checks only that the cache has been pulled once (`:467`), so any warm cache passes.
- **Why it matters.** A pre-reader loses a star silently: the pressed button they remember turns back into "Done ★", and the balance parents cash in is short. A star lost from an earlier day cannot be earned again.
- **Proposed fix.** One row per earned star (`star:verse:<date>`, `star:story:<date>`, `star:prayed:<date>`), with count, total and badges derived; the family mirror is recomputed from them, so two devices' stars add up. (Phase 3: IMP-KIDVERSE-F4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/verify-stale-device-erases-star-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-stale-device-erases-star-2.mjs"`, `node "audits/tools/phase3/kidverse/stale-device.mjs"` — the defect must no longer reproduce; plus batch 0f's checks.

#### P3-KIDVERSE-10 — "I heard it" on a kid's second device with an older copy erases the other device's heard day from the week's story row

- **Area** kidverse · **Type** bug · **Severity** critical · **Effort** M · **Batch** 0f
- **Evidence.** `audits/03-apps/kidverse.md:459`; `apps/f260.html:1611-1613`, `apps/kidverse.html:599-604`, `apps/hub.js:236-239`, `worker/src/data.js:60-62`; `audits/evidence/p3/kidverse/critic-heard-stale-ipad-after-pull.png`, `audits/evidence/p3/kidverse/critic-heard-control-ipad-after-pull.png`
- **What happens now.** `heard()` rebuilds the story row from the local copy (`normStory` / `myStory`, `apps/kidverse.html:599-604`) and writes it whole to person `story` and family `story:<kid>` (`:631-646`; the writes at `:638-639`). Each row is last-write-wins on the writer's stamp (`apps/hub.js:236-239`; `worker/src/data.js:60-62`).
- **Why it matters.** The week's heard days that the kid and the parents see silently lose a day, and the story star can go with it.
- **Proposed fix.** One row per heard day (`heard:<week>:<date>`), so two devices never erase each other's heard days. (Phase 3: IMP-KIDVERSE-F4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/critic-heard-races.mjs"`, `node "audits/tools/phase3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-2.mjs"` — the defect must no longer reproduce; plus batch 0f's checks.

#### P3-TALLY-01 — Two devices of the same person lose each other's taps: every tap writes the absolute count

- **Area** tally · **Type** bug · **Severity** critical · **Effort** M · **Batch** 0f
- **Evidence.** `audits/03-apps/tally.md:146`; `apps/hub.js:342`, `apps/tally.html:150-154`, `apps/hub.js:231-243`, `worker/src/data.js:39-64`; `audits/evidence/p3/tally/verify-lww-absolute-count-loses-increments-2-A-phone.png`
- **What happens now.** Each tap writes `n() + 1`, computed from this device's own copy (`apps/tally.html:150-154`). `hub.set` stamps it with the current time (`apps/hub.js:231-243`), and the Worker keeps the newest stamp and no history (`worker/src/data.js:39-64`). Any taps the other device made since this one last pulled are overwritten, and nothing is shown.
- **Why it matters.** The count is the app's only data. It silently goes down after it was counted up, and neither device says so; the phone's sync state still reads "synced".
- **Proposed fix.** Each device keeps its own count row (`count:<deviceId>`) plus a reset epoch; the display is the sum since the last reset, so taps from every device add up. (Phase 3: IMP-TALLY-F1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/verify-lww-absolute-count-loses-increments-1.mjs"`, `node "audits/tools/phase3/tally/verify-lww-absolute-count-loses-increments-2.mjs"`, `node "audits/tools/phase3/tally/two-devices.mjs"` — the defect must no longer reproduce; plus batch 0f's checks.

### Batch 0g — Prayer: no lost requests, notes or prayed days (7)

#### P2-STAB-03 — Prayer left open past midnight records prayers on yesterday's date, and an adult's tap can delete yesterday's record

- **Area** shell / platform (Prayer) · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0g
- **Evidence.** `audits/02-shell.md:3143`; `apps/prayer.html:712`, `apps/prayer.html:1593-1604`, `index.html:724`, `apps/leftovers.html:361-375`
- **What happens now.** The investigator's run. Kiara tapped Prayed at Mon 00:03:21. The tap was stored as `prayedBy['2026-09-27']` and `lastPrayedAt '2026-09-27'`. The TV still read "No one yet today." (`midnight.json` prayerTap). Skeptic 1 got the same at Mon 00:02:48, with no `2026-09-28` key. A fresh Kid Verse showed week 2026-W40 with count 0.
- **Why it matters.** This happens on the 24/7 iPad, or on an iPhone PWA left in memory. The morning's prayers go to yesterday, and the TV shows that nobody prayed. A kid's prayer star lands on the wrong day. Across Sunday→Monday that day is in last week, so this week reads ★0.
- **Proposed fix.** Prayer computes TODAY from hub.today() at each tap and on the midnight event (apps/prayer.html:712), and an adult's tap never removes a mark dated yesterday.
- **How it will be verified.** Rerun `node "audits/tools/phase2/STAB/midnight.mjs"` — the defect must no longer reproduce; plus batch 0g's checks.

#### P3-PRAYER-01 — Two devices adding a request pick the same id; one request is silently lost

- **Area** prayer · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0g
- **Evidence.** `audits/03-apps/prayer.md:177`; `apps/hub.js:342`, `apps/prayer.html:719-721`, `apps/prayer.html:1312-1314`, `apps/prayer.html:685-695`; `audits/evidence/p3/prayer/id-collision-A-eli-phone-after.png`, `audits/evidence/p3/prayer/verify-id-collision-2-S1-mom-phone.png`
- **What happens now.** New ids are counted per device:
- **Why it matters.** A prayer request someone took the time to type vanishes for everyone, nobody is told, and nothing can bring it back.
- **Proposed fix.** New requests get collision-free ids (hub.uid() or crypto.randomUUID()), never the next sequential number (apps/prayer.html:719-721). (Phase 3: IMP-PRAYER-P2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-id-collision-1.mjs"`, `node "audits/tools/phase3/prayer/verify-id-collision-2.mjs"`, `node "audits/tools/phase3/prayer/id-collision.mjs"` — the defect must no longer reproduce; plus batch 0g's checks.

#### P3-PRAYER-03 — Import a backup tombstones other people's newer family requests and erases today's prayed marks

- **Area** prayer · **Type** bug · **Severity** critical · **Effort** M · **Batch** 0g
- **Evidence.** `audits/03-apps/prayer.md:261`; `apps/prayer.html:1520`, `apps/prayer.html:1524`, `apps/prayer.html:692`, `apps/prayer.html:1518-1526`; `audits/evidence/p3/prayer/import-family-mae-phone-after.png`, `audits/evidence/p3/prayer/verify-import-wipes-family-2-mae-after.png`
- **What happens now.** The import panel says "This replaces both lists on this device." (`apps/prayer.html:1520`). On Import it runs `D = readBackup(txt); migrate(); save()` (`apps/prayer.html:1524`).
- **Why it matters.** Other people's prayer requests and today's prayed marks vanish. The kid's mark may feed her star. The copy tells the adult the opposite of what happens.
- **Proposed fix.** Import restores only rows the importer owns, merges by updated_at instead of tombstoning, never touches other people's family rows or today's marks, and says exactly what changed. (Phase 3: IMP-PRAYER-F3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-import-wipes-family-1.mjs"`, `node "audits/tools/phase3/prayer/verify-import-wipes-family-2.mjs"`, `node "audits/tools/phase3/prayer/import-family.mjs"` — the defect must no longer reproduce; plus batch 0g's checks.

#### P3-PRAYER-04 — "Put back on the list" erases the answer note with one tap, no confirm and no undo

- **Area** prayer · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0g
- **Evidence.** `audits/03-apps/prayer.md:296`; `apps/prayer.html:1327`, `apps/prayer.html:1013`, `apps/prayer.html:1335-1338`; `audits/evidence/p3/prayer/verify-unanswer-erases-note-2-sheet.png`, `audits/evidence/p3/prayer/verify-unanswer-erases-note-1-ipad-after.png`
- **What happens now.** An answered request's sheet shows Done, Put back on the list, Edit and Delete (`apps/prayer.html:1013`). One tap sets `status` to active and `answeredAt` and `answerNote` to null, saves and jumps to Today (`apps/prayer.html:1335-1338`), with no `ask()` and no toast.
- **Why it matters.** The answered-prayer journal is the app's most treasured record. One mis-tap destroys an entry for the whole family.
- **Proposed fix.** "Put back on the list" keeps the answer note and date as a dated update and offers the same Undo toast Mark answered uses. (Phase 3: IMP-PRAYER-P3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-unanswer-erases-note-1.mjs"`, `node "audits/tools/phase3/prayer/verify-unanswer-erases-note-2.mjs"`, `node "audits/tools/phase3/prayer/unanswer.mjs"` — the defect must no longer reproduce; plus batch 0g's checks.

#### P3-PRAYER-05 — On the family list one person's tick shows as everyone's, and a second adult's tap unticks it for the house

- **Area** prayer · **Type** bug · **Severity** high · **Effort** S · **Batch** 0g
- **Evidence.** `audits/03-apps/prayer.md:320`; `apps/prayer.html:1595`, `apps/prayer.html:841`, `apps/prayer.html:729`, `apps/prayer.html:999`; `audits/evidence/p3/prayer/family-tick-1-eli-before.png`, `audits/evidence/p3/prayer/family-tick-3-elizabeth-phone.png`
- **What happens now.** An adult family row's done state is the one shared `lastPrayedAt` (`apps/prayer.html:841, 884`), and Pray now skips rows anyone has prayed (`:1613`). `setPrayed` toggles: `on = lastPrayedAt !== TODAY` (`:1595`).
- **Why it matters.** Adults cannot see what they themselves have prayed, and praying "undoes" someone else's mark on every device.
- **Proposed fix.** On the family list, done means "I prayed this today" (my id in prayedBy[today]); a tap adds or removes only me (handoff/prayer/SPEC.md:221-225). (Phase 3: IMP-PRAYER-P1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-family-tick-shared-1.mjs"`, `node "audits/tools/phase3/prayer/verify-family-tick-shared-2.mjs"`, `node "audits/tools/phase3/prayer/family-tick.mjs"` — the defect must no longer reproduce; plus batch 0g's checks.

#### P3-KIDVERSE-07 — Prayed stars are matched by display name, so a guest with a kid's name earns that kid a star

- **Area** kidverse · **Type** bug · **Severity** low · **Effort** S · **Batch** 0g
- **Evidence.** `audits/03-apps/kidverse.md:388`; `index.html:1408-1418`, `worker/src/index.js:174-203`, `apps/prayer.html:1599-1602`, `apps/kidverse.html:427-434`; `audits/evidence/p3/kidverse/verify-prayed-name-match-1-kiara-after.png`
- **What happens now.** Prayer writes `hub.profile.name` into `prayedBy[date]` (`apps/prayer.html:1598-1602`). Kid Verse credits a prayed day when that list includes the kid's name (`apps/kidverse.html:427-434`, called with `p.name` at `:474`). Mom added a guest named "Kiara"; the guest tapped Prayed on the family list;
- **Why it matters.** Stars and the Prayer warrior badge can be earned by someone else.
- **Proposed fix.** Prayer records prayedBy as profile ids (names drawn at render), and Kid Verse matches by id (with P3-PRAYER-24). (Phase 3: IMP-KIDVERSE-F4, IMP-PRAYER-P15)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/verify-prayed-name-match-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-prayed-name-match-2.mjs"`, `node "audits/tools/phase3/kidverse/star-rules.mjs"` — the defect must no longer reproduce; plus batch 0g's checks.

#### P3-PRAYER-24 — Family prayed marks are kept by display name: a guest who shares a household name is shown as that person (from the critic)

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 0g
- **Evidence.** `audits/03-apps/prayer.md:774`; `worker/src/index.js:174-201`, `apps/kidverse.html:426-434`, `apps/prayer.html:1599-1602`, `index.html:1057-1061`; `audits/evidence/p3/prayer/critic-guest-samename-mom.png`, `audits/evidence/p3/prayer/verify-critic-prayedby-keyed-by-name-8-1-mom.png`
- **What happens now.** `setPrayed` stores `hub.profile.name` in `prayedBy[TODAY]` (`apps/prayer.html:1599-1602`). Every reader matches by name: the kid card's done state (`mePrayed`, `:728-729`), the faces on family rows (`:1557-1566`), the TV's "who prayed today" (`index.html:1057-1061`) and chat's `mark_prayed` (`worker/src/chat.js:244-246`).
- **Why it matters.** The family list, the TV and a kid's own card credit the wrong person.
- **Proposed fix.** prayedBy records profile ids; names and faces are drawn at render (data change only; layout and ids stay). (Phase 3: IMP-PRAYER-P15)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/critic-sweep.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-prayedby-keyed-by-name-8-1.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-prayedby-keyed-by-name-8-2.mjs"` — the defect must no longer reproduce; plus batch 0g's checks.

### Batch 0h — Larder and build guide: no one-tap loss (6)

#### P3-DOLLYWOOD-02 — Import progress replaces all progress with any JSON file, with no check, confirm or undo

- **Area** dollywood · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0h
- **Evidence.** `audits/03-apps/dollywood.md:197`; `apps/dollywood.html:648`, `apps/prayer.html:1500-1505`, `apps/dollywood.html:1101`, `apps/dollywood.html:1098`; `audits/evidence/p3/dollywood/import-wrong-file-after.png`, `audits/evidence/p3/dollywood/verify-import-accepts-any-json-1-A-after.png`
- **What happens now.** The import handler runs `JSON.parse`, then `doneMap = j.done || j; save(); renderStep()` (`apps/dollywood.html:1101`). The only error path is `alert('Not a progress file')` for text that does not parse. Reset asks `confirm()` first (`apps/dollywood.html:1098`); Import asks nothing. The investigator's runs:
- **Why it matters.** One wrong file in the picker erases the whole build history on every device, with no way back unless an export was made first.
- **Proposed fix.** Import validates the file (known step ids required), says what will change ("Replace 24 ticks with 2?"), merges by default, and offers Undo (template :1101). (Phase 3: IMP-DOLLYWOOD-P2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-import-accepts-any-json-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-import-accepts-any-json-2.mjs"`, `node "audits/tools/phase3/dollywood/data-checks.mjs"` — the defect must no longer reproduce; plus batch 0h's checks.

#### P3-LEFTOVERS-01 — A double-tap on one ✓ removes that item and the next one, for everyone, with no undo

- **Area** leftovers · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0h
- **Evidence.** `audits/03-apps/leftovers.md:166`; `apps/leftovers.html:378`, `apps/leftovers.html:281`, `apps/leftovers.html:306-311`, `apps/leftovers.html:203-246`; `audits/evidence/p3/leftovers/doubletap-A-touch-fresh-iphone-pwa.png`, `audits/evidence/p3/leftovers/verify-double-tap-removes-next-item-1-DBL-desktop.png`
- **What happens now.** The ✓ handler (`apps/leftovers.html:281`) calls `removeItem`. It tombstones the row, posts "Finished the …" and calls `render()` in the same call (`apps/leftovers.html:306-311`). `render()` empties and rebuilds the whole list (`apps/leftovers.html:203-246`).
- **Why it matters.** A food that is still in the fridge silently leaves the family list, and its 8 am "use it up" push stops. Nobody chose it, and nothing on screen says a second item went.
- **Proposed fix.** Each ✓ acts on its own item id once (disable it on the first tap), and removing shows an Undo toast for 6 s before the tombstone is sent. (Phase 3: IMP-LEFTOVERS-P1, IMP-LEFTOVERS-F2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-double-tap-removes-next-item-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-double-tap-removes-next-item-2.mjs"`, `node "audits/tools/phase3/leftovers/verify-double-tap-removes-next-item-2-probe.mjs"` — the defect must no longer reproduce; plus batch 0h's checks.

#### P3-LEFTOVERS-12 — A change from another device re-renders the open Larder under the finger, and a single tap removes a different item (from the critic)

- **Area** leftovers · **Type** bug · **Severity** critical · **Effort** M · **Batch** 0h
- **Evidence.** `audits/03-apps/leftovers.md:596`; `apps/leftovers.html:306-311`, `apps/leftovers.html:378`, `apps/leftovers.html:217`, `apps/leftovers.html:203-246`; `audits/evidence/p3/leftovers/critic-remote-shift-B-iphone.png`, `audits/evidence/p3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-1-SAME-iphone.png`
- **What happens now.** `hub.onChange(render)` (`apps/leftovers.html:378`) runs `render()`, which empties the list (`apps/leftovers.html:217`) and rebuilds every group and card with no animation (`apps/leftovers.html:203-246`).
- **Why it matters.** A dish that is still in the fridge silently leaves the family list, and its 8 am warning stops. Nobody chose it, and the item the person meant to finish is still listed.
- **Proposed fix.** Remote changes never re-render the list under a finger: defer the re-render while a pointer is down and for 500 ms after, and key every ✓ by item id. (Phase 3: IMP-LEFTOVERS-P1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/critic-remote-shift.mjs"`, `node "audits/tools/phase3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-2.mjs"` — the defect must no longer reproduce; plus batch 0h's checks.

#### P3-LEFTOVERS-13 — A kid's tap on a ✓ removes a family fridge item for everyone, with no undo (from the critic)

- **Area** leftovers · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0h
- **Evidence.** `audits/03-apps/leftovers.md:633`; `worker/src/chat.js:52`, `apps.json:5`, `apps/leftovers.html:180`, `apps/hub.js:115`; `audits/evidence/p3/leftovers/kid-ezra-larder-ipad.png`, `audits/evidence/p3/leftovers/verify-critic-kid-check-removes-family-item-3-2-kiara-iphone-pwa-before.png`
- **What happens now.** The Larder has no `visibleTo` (`apps.json:5`), so it is on every kid's launcher, and CLAUDE.md lists it among the kids' apps with no read-only rule (`CLAUDE.md:18`).
- **Why it matters.** A pre-reader cannot read which dish a ✓ belongs to. One tap drops food that is still in the fridge from the family list and from the 8 am warning, for everyone.
- **Proposed fix.** Kids see the Larder read-only (no ✓, no add bar; decision P5-D2), and the Worker refuses kid tombstones on leftovers rows. (Phase 3: IMP-LEFTOVERS-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-critic-kid-check-removes-family-item-3-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-critic-kid-check-removes-family-item-3-2.mjs"`, `node "audits/tools/phase3/leftovers/kid.mjs"` — the defect must no longer reproduce; plus batch 0h's checks.

#### UX-LEFTOVERS-1 — One tap on ✓ deletes a family item for everyone, with no undo, no confirm and no completed history

- **Area** leftovers · **Type** usability · **Severity** medium · **Effort** S · **Batch** 0h
- **Verified (step 3).** was high; skeptics high and medium; tie-break medium. Correction: The facts are right. The rating should be medium, not high. One detail should be added: the tombstone and the feed line keep no size or date, so re-logging cannot restore those fields exactly.
- **Evidence.** `audits/03-apps/leftovers.md:738`; `apps/leftovers.html:306-311`, `apps/leftovers.html:275-283`; `audits/screens/leftovers/finished-typical-iphone-pwa-light.png`
- **What happens now.** `removeItem` writes a tombstone and posts "Finished the X" (`apps/leftovers.html:306-311`). There is no toast, no undo and no "Show completed".
- **Why it matters.** One tap deletes a family item for everyone.
- **Proposed fix.** Undo toast after every ✓, and a "Recently finished" list for 7 days. (Phase 3: IMP-LEFTOVERS-P1, IMP-LEFTOVERS-F2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 0h's checks.

#### UX-LEFTOVERS-2 — Kids get the full adult page: a ✓ on every family item, the add bar, the mic and the Hearth block, in small type with nothing to recognise

- **Area** leftovers · **Type** usability · **Severity** medium · **Effort** S · **Batch** 0h
- **Verified (step 3).** was high; skeptics high and medium; tie-break medium. Correction: "Only the card radius changes" is too narrow. Kid mode also rounds the alert, ✓, name box, Log and mic from 12 px to 16 px (--r-sm), and the add bar from 16 px to 22 px (--r). No text size changes.
- **Evidence.** `audits/03-apps/leftovers.md:744`; `apps/leftovers.html:18`, `apps/leftovers.html:180`, `apps/design.css:283`, `worker/src/chat.js:52`; `audits/evidence/p3/leftovers/kid-ezra-larder-ipad.png`, `audits/screens/leftovers/kid-typical-ipad-portrait-light.png`
- **What happens now.** The app has no `data-kind="kid"` rules (only kiosk ones, `apps/leftovers.html:18, 96`), and `canEdit = hub.canWrite` (`apps/leftovers.html:180`), which is true for kids.
- **Why it matters.** Kids get the full adult page with the ✓ buttons.
- **Proposed fix.** Kids get a picture view: food cards with art and freshness colour, no controls (decision P5-D2). (Phase 3: IMP-LEFTOVERS-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/kid.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 0h's checks.

### Batch 0i — Chat: writes that do what was asked, and say when they did not (7)

#### P2-CHAT-03 — `finish_leftover` removes a different food on one shared word

- **Area** shell / platform (Larder) · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0i
- **Evidence.** `audits/02-shell.md:3855`; `worker/src/reminders.js:66-79`, `worker/src/chat.js:41`, `apps/leftovers.html:306-311`, `apps/leftovers.html:294-295`; `audits/screens/shell/chat-overflow-iphone-pwa-light.png`
- **What happens now.** When there is no exact or substring match, the tool accepts any query word of 3+ letters that appears as a substring of an item name (chat.js:274, `qw.some`). It then tombstones a single hit (chat.js:278-280). The prayer matcher's fallback requires every word to match (chat.js:139, `qw.every`).
- **Why it matters.** The removed food is still in the fridge, so the 8 am "eat it or toss it" push stops warning about it. With the morning job forced, the due list went from `["Chicken alfredo (8d)","Beef and bean chili (5d)"]` to `["Beef and bean chili (5d)"]` (worker/src/reminders.js:66-79).
- **Proposed fix.** finish_leftover matches an item only by exact name (case-insensitive) or asks which one when several match; it never picks by a shared word. (Phase 3: IMP-LEFTOVERS-F2)
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-finish-leftover-wrong-item-2.mjs"` — the defect must no longer reproduce; plus batch 0i's checks.

#### P2-CHAT-09 — A chat write that lost last-write-wins still shows ✓

- **Area** shell / platform · **Type** bug · **Severity** critical · **Effort** S · **Batch** 0i
- **Evidence.** `audits/02-shell.md:4094`; `worker/src/data.js:37-41`, `worker/src/chat.js:177-279`, `apps/hub.js:50`; `audits/evidence/p2/CHAT/verify-lww-lost-write-chat-iphone-light.png`
- **What happens now.** `putOne` accepts client timestamps up to 5 min ahead of the server (data.js:41). It returns `applied:false` when a write loses (data.js:60-64), and its doc comment says the caller "should adopt that" (data.js:37-39).
- **Why it matters.** The person is told a reading or a removal was saved when it was not. The window lasts until the server's clock passes the fast timestamp, which takes at most 5 min. SYNC's table of F260 causes lists it (see Sync).
- **Proposed fix.** After putOne, compare the stored row with the written value; if last-write-wins kept a newer row, return ok:false with "Someone else changed it just now" and no ✓.
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-lww-lost-write-shows-tick-1.mjs"` — the defect must no longer reproduce; plus batch 0i's checks.

#### GAP-CHAT-02 — Chat actions are neither confirmed nor undoable

- **Area** shell / platform · **Type** feature gap · **Severity** medium · **Effort** M · **Batch** 0i
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: 'None of the 12 tools is an undo' is true only in the sense that no tool restores a previous state. The evidence for it (`undoLikeTools: []`) is a tool-name regex. toggle_f260_reading can reverse itself, and finish_leftover or add_list_item can counter each other, though lossily.
- **Evidence.** `audits/02-shell.md:4399`; `apps/leftovers.html:306-311`
- **What happens now.** The SSE protocol has no confirm step (chat.js:4-9).
- **Why it matters.** Chat acts at once with no way back.
- **Proposed fix.** Every chat write returns an undo token; the chip carries Undo for 30 s (an "undo_last" path in chat.js that restores the previous row).
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 0i's checks.

#### P2-CHAT-01 — `set_data` writes any row of any listed app, with no confirmation, undo or key check

- **Area** shell / platform · **Type** bug (security) · **Severity** medium · **Effort** M · **Batch** 0i
- **Evidence.** `audits/02-shell.md:3755`; `apps/f260.html:1763`, `worker/src/chat.js:173-179`, `worker/src/data.js:11-15`, `worker/src/index.js:90-110`
- **What happens now.** `set_data` (chat.js:173-179) writes any key and any value into the signed-in person's own scope or into family scope. That covers any app in the client-supplied list, plus `hub` and `reminders` for everyone but kids. It never calls `checkKey` (data.js:11-14). In one call each:
- **Why it matters.** One misheard sentence can wipe a year of reading or unlist someone else's photo, and nothing in chat or the apps undoes it.
- **Proposed fix.** set_data may write only keys of the calling app's own documented shapes (a server allowlist per app), never tombstones or overwrites family rows wholesale; every write returns an undo token the chip offers.
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-set-data-overwrites-any-row-2.mjs"` — the defect must no longer reproduce; plus batch 0i's checks.

#### P2-CHAT-04 — `toggle_f260_reading` unticks when asked to tick

- **Area** shell / platform · **Type** bug · **Severity** medium · **Effort** S · **Batch** 0i
- **Evidence.** `audits/02-shell.md:3900`; `apps/f260.html:1385`, `apps/f260.html:1670`, `worker/src/chat.js:33-34`, `apps/f260.html:1659-1662`; `audits/evidence/p2/CHAT/04-toggle-unchecked-iphone-light.png`
- **What happens now.** The tool takes only `week` and `day`, and its description is "Mark (or unmark)" (chat.js:33-34). The handler flips the flag (chat.js:209), while the prompt says it "checks a reading off" (chat.js:333).
- **Why it matters.** F260 progress not sticking was the hub's original bug, and chat can undo a reading that was just logged.
- **Proposed fix.** toggle_f260_reading becomes set_f260_reading {done: true|false}; asking to tick a ticked reading is a no-op that says so.
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-toggle-f260-unticks-on-tick-request-1.mjs"`, `node "audits/tools/phase2/CHAT/rev3-chat-04-restore.mjs"` — the defect must no longer reproduce; plus batch 0i's checks.

#### P3-LEFTOVERS-04 — A dateLogged that is not YYYY-MM-DD shows "NaNd ago", stays Fresh forever and is never warned about

- **Area** leftovers · **Type** bug · **Severity** medium · **Effort** S · **Batch** 0i
- **Evidence.** `audits/03-apps/leftovers.md:300`; `worker/src/chat.js:32`, `worker/src/chat.js:31-32`, `apps/leftovers.html:167-170`, `index.html:679-681`; `audits/evidence/p3/leftovers/entry-chat-bad-date-ipad.png`, `audits/evidence/p3/leftovers/verify-non-iso-date-nan-1-larder-ipad.png`
- **What happens now.** `add_list_item` stores `input.item.dateLogged` without a format check (`worker/src/chat.js:31-32, 187`). The app never validates a row's date (`apps/leftovers.html:167-170, 250-268`): `new Date('yesterday' + 'T00:00:00')` is invalid, so the age is NaN.
- **Why it matters.** A leftover that chat logged can sit in the fridge for weeks marked Fresh, with no banner and no 8 am warning.
- **Proposed fix.** The Worker rejects or normalises a non-ISO dateLogged (chat and API), and the app shows an unparseable date as "date unknown", not Fresh. (Phase 3: IMP-LEFTOVERS-P6)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-non-iso-date-nan-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-non-iso-date-nan-2.mjs"`, `node "audits/tools/phase3/leftovers/entry.mjs"` — the defect must no longer reproduce; plus batch 0i's checks.

#### P3-LEFTOVERS-09 — A future dateLogged is never clamped: it reads "-3d ago", files as Fresh and delays every warning

- **Area** leftovers · **Type** bug · **Severity** low · **Effort** S · **Batch** 0i
- **Evidence.** `audits/03-apps/leftovers.md:492`; `apps/leftovers.html:193`, `apps/leftovers.html:289-297`, `apps/leftovers.html:167`, `apps/leftovers.html:265`; `audits/evidence/p3/leftovers/verify-no-js-date-guard-1-chromium-future-card.png`, `audits/evidence/p3/leftovers/verify-no-js-date-guard-2-future-row-chromium.png`
- **What happens now.** As filed, only the date box's `max` (`apps/leftovers.html:193`) stops a future date; the submit handler never checks it (`apps/leftovers.html:289-297`).
- **Why it matters.** A future-dated dish shows "-3d ago", sits under Fresh, and its "use it up" warning in the app, on Home and in the push comes three days late.
- **Proposed fix.** The Worker rejects a future dateLogged; the app shows it as today.
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-no-js-date-guard-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-no-js-date-guard-2.mjs"`, `node "audits/tools/phase3/leftovers/future-date.mjs"` — the defect must no longer reproduce; plus batch 0i's checks.

### Batch 1 — Design tokens, design.css and shared components (150)

#### P2-VIS-06 — In every dark palette the Home hero's text fails contrast (kicker and summary about 1.5–3:1)

- **Area** shell / platform · **Type** bug · **Severity** high · **Effort** S · **Batch** 1
- **Evidence.** `audits/02-shell.md:5599`; `apps/design.css:409-414`, `apps/design.css:170`, `apps/design.css:428`, `apps/design.css:417`; `audits/screens/shell/home-typical-ipad-portrait-dark.png`
- **What happens now.** `.ds .hero` paints `radial-gradient(color-mix(accent 70%, white) 0%, var(--accent) 45%, var(--accent-deep) 100%)` from the top right (`apps/design.css:409-414`, gradient at `:412`).
- **Why it matters.** Most visual findings share causes in the token layer: mid-tone hues used as text, one light-theme hex per person, no iPad type tier, glass without Reduce Transparency, focus rings that vanish. Phase 4 measured them across 3,662 screen x theme x device jobs and proposed one verified token set.
- **Proposed fix.** The dark hero becomes a deep tint with the glowing ink (`--hero-bg` + `--accent-ink`, Phase 4 batch-1a row for .ds .hero), gated at 4.5:1 for every person in every palette.
- **How it will be verified.** Rerun `node "audits/tools/phase2/VIS/verify3-dark-hero-contrast-2.mjs"`, `node "audits/tools/phase2/VIS/verify3-dark-hero-contrast-1.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### GAP-TOK-2 — Only `--accent-deep` has an "on" colour; every other filled surface picks white or `--on-accent` by hand

- **Area** design system, all areas · **Type** feature gap · **Severity** medium · **Effort** S · **Batch** 1
- **Verified (step 3).** was medium; skeptics medium (partly) and medium. Correction: 'A household member cannot read it' is overstated. At 2.61 the 12 px bold digit is hard to read but not invisible, and the badge disc itself stays highly visible, so the 'food to eat' cue survives.
- **Evidence.** `audits/04-design-system.md:699`; `apps/design.css:92`, `index.html:703`, `apps/f260.html:26`, `apps/verses.html:59`
- **What happens now.** `--on-accent` is the only "on" token (apps/design.css:92), and it is tuned for `--accent-deep`. Everything else is hand-picked:
- **Why it matters.** The badge is the Apps grid's at-a-glance cue, on the Larder tile, that food must be eaten. In the dark palettes, and in System at night, a household member cannot read it. This meets the rule's "text a household member needs … on a primary surface": at least medium.
- **Proposed fix.** An -on token for every fill (--X-on, --accent-on, --badge-ink) and the pairing lint (no white on a fill). (Phase 4 gap row TOK-1)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TOK/pairs.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-TYPE-1 — No iPad type tier: body, secondary, button and tab text is the same size on the 820 px iPad as on the 430 px iPhone, in every area

- **Area** design system, all areas · **Type** feature gap · **Severity** medium · **Effort** S · **Batch** 1
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: Minor: I count F260 as 172/181 same-size selectors, not 173/181. Otherwise the numbers and the design.css claim check out.
- **Evidence.** `audits/04-design-system.md:1379`; `apps/design.css:573`, `apps/design.css:22-24`; `audits/screens/shell/home-typical-ipad-portrait-light.png`, `audits/screens/shell/home-typical-iphone-pwa-light.png`
- **What happens now.** Of the selectors seen on both devices, the same size on both: shell 160/163, F260 173/181, Prayer 131/132, Larder 31/31, park map 146/146, Verses 51/53, Kid Verse 55/57, Tally 8/10, Timer 10/12, build guide 107/113. Table TYPE-4 lists what grows.
- **Why it matters.** The iPad is read from 2-3 m, yet reminders, Larder meta, prayer rows and captions stay at 12-16 px.
- **Proposed fix.** The iPad type tier (--ts-width 1.12 on touch devices ≥ 744 px). (Phase 4 gap row TYPE-8)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TYPE/report.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### GAP-TYPE-2 — No text-size preference and no Dynamic Type hook; F260's page zoom is the only control, and it leaves its 9.5 px label at 10.92 px

- **Area** design system (F260) · **Type** feature gap · **Severity** medium · **Effort** M · **Batch** 1
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: The item says F260's page zoom is 'the only control'. Pinch zoom (no user-scalable=no in any viewport meta), iOS Display Zoom or Accessibility Zoom, and desktop browser zoom also enlarge the hub. They are clumsy, which supports medium, but they are workarounds the item should name.
- **Evidence.** `audits/04-design-system.md:1393`; `apps/design.css:293`, `apps/f260.html:44`, `apps/prayer.html:50`, `apps/f260.html:50`
- **What happens now.** Every size is a px literal or a px token, and `html` sets `text-size-adjust: 100%` (`apps/design.css:293`). NOT FOUND IN CODE, in `index.html`, `apps/*.html`, `apps/design.css` and the template: `font: -apple-system-body` or any `-apple-system-*` text style, `rem`-based font sizes (F260 and Prayer use `rem` only for max-widths, …
- **Why it matters.** A grandparent who needs larger text cannot get it outside F260, and inside F260 some text is still below the floor.
- **Proposed fix.** A person text-size preference (data-text-size xs-xxl; Me → Appearance), F260's Large mapped to it (decision D17).
- **How it will be verified.** Rerun `node "audits/tools/phase4/TYPE/hidden-text.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### P2-VIS-03 — Choosing Hearth on a dark-mode device still paints Midnight

- **Area** shell / platform · **Type** bug · **Severity** medium · **Effort** S · **Batch** 1
- **Evidence.** `audits/02-shell.md:5501`; `apps/hub.js:77`, `apps/design.css:176-195`, `apps/hub.js:79`, `index.html:202-203`; `audits/evidence/p2/PWA/verify-hearth-os-dark-1-hearth-dark-me.png`, `audits/evidence/p2/PWA/verify-hearth-os-dark-1-hearth-dark-f260.png`
- **What happens now.** `apps/hub.js:77` deletes `data-theme` for both `system` and `hearth`. So `@media (prefers-color-scheme: dark) :root:not([data-theme])` (`apps/design.css:176-195`) applies the Midnight tokens. There is no `:root[data-theme="hearth"]` rule. Meanwhile `apps/hub.js:79` sets `data-scheme="light"`, taken from `hub.THEMES`.
- **Why it matters.** a household member who picks the warm paper look cannot get it on any dark-mode device, including iOS Automatic appearance after sunset. F260's primary button also drops below AA.
- **Proposed fix.** Hearth sets data-theme="hearth" (the bootstrap always writes the resolved palette, apps/hub.js:77), so only System follows the OS.
- **How it will be verified.** Rerun `node "audits/tools/phase2/VIS/verify-hearth-ignored-on-dark-os-2.mjs"`, `node "audits/tools/phase2/PWA/verify-hearth-turns-dark-in-os-dark-1.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-ACCENT-01 — The selected tab, Prayer nav item and Timer preset are marked only by a 1.0-1.35:1 fill and a shift in hue: for David in the dark palettes and Kiara in the light ones, the selected tab's label differs from its neighbours by 1.02-1.08:1

- **Area** design system (Prayer, Timer) · **Type** bug · **Severity** medium · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:5306`; `index.html:640`, `index.html:78`, `apps/design.css:559-560`, `index.html:396-399`
- **What happens now.** In each component, selection changes only the ink hue and adds an `--accent-soft` fill:
- **Why it matters.** The tab bar is the navigation on every screen for every person. A colour-blind adult, someone reading the kitchen iPad across the room, or a pre-reader relying on shape cannot tell which tab is current.
- **Proposed fix.** Selection uses --sel-fill-strong / --sel-ink-strong (≥ 3:1) plus --sel-weight, a non-colour cue. (Phase 4 gap row ACCENT-3)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ACCENT/verify-selection-by-hue-only-1.mjs"`, `node "audits/tools/phase4/ACCENT/verify-selection-by-hue-only-2.mjs"`, `node "audits/tools/phase4/ACCENT/tokens.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-COLOR-01 — In the light palettes, apps ink text and icons with the mid-tone hues and the semantic aliases, not the `-ink` tokens: gold text at 2.03-3.47:1, olive, terra and teal text at 3.6-4.45:1, and today rings, the F260 chapter bar and the earned star at 2.48-2.96:1

- **Area** design system (F260) · **Type** bug · **Severity** medium · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:6891`; `apps/design.css:80-83`, `apps/f260.html:11-12`, `apps/prayer.html:106`, `apps/leftovers.html:63`; `audits/screens/dollywood/aerial-mix-typical-desktop-light.png`, `audits/screens/f260/behind-typical-desktop-light.png`
- **What happens now.** The system's rule. Each hue family has a mid tone, a `-soft` fill and an `-ink`. The `-ink` pairs pass everywhere, at 5.37-10.35:1 on their fill. The style guide states the rule: "Text always uses the `-ink` variant on a soft background" (`docs/design.html:95`). The aliases point the wrong way.
- **Why it matters.** This one token confusion is behind most of the light-theme failures in F260, Prayer, the build guide and the park map (Table COLOR-2: 57.9 %, 6.7 %, 28.4 % and 40.5 % in Hearth).
- **Proposed fix.** The batch-1a pre-pass: text and icons read -ink tokens, fills -fill/-strong, marks -graphic (legacy hue names alias the inks). (Phase 4 gap row COLOR-2)
- **How it will be verified.** Rerun `node "audits/tools/phase4/COLOR/verify-mid-tone-semantic-as-ink-2.mjs"`, `node "audits/tools/phase4/COLOR/palette.mjs"`, `node "audits/tools/phase4/COLOR/spot.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-COLOR-02 — Six rules ink with the raw profile colour where the AA-safe `--accent-deep` already exists: Prayer's kitchen headings are 2.83:1 in every dark palette, the park map's walk times and distances 1.79-2.57:1 in dark, and in light the same text fails for Mae, Mea, Elizabeth and Kiara

- **Area** design system (Prayer, park map) · **Type** bug · **Severity** medium · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:6969`; `apps/prayer.html:39`, `apps/hub.js:80`, `apps/design.css:89`, `apps/prayer.html:334`
- **What happens now.** The raw hex. `apps/hub.js:80` sets `--accent` to the raw profile hex in every scheme. The safe ink already exists. `design.css` derives `--accent-deep` per scheme: 72 % + black in light, commented "filled buttons, text on soft — AA on paper for every family colour" (`apps/design.css:89`), and 58 % + white in dark (`:170, 191, 212`).
- **Why it matters.** The Kitchen view is the counter display, often read in dark mode. On the park map, the walk times and the selected tab are how a parent navigates a crowded park on a phone at dusk.
- **Proposed fix.** The six rules that ink with the raw profile colour read --accent-ink. (Phase 4 gap row COLOR-3)
- **How it will be verified.** Rerun `node "audits/tools/phase4/COLOR/verify-raw-accent-ink-no-dark-lift-1.mjs"`, `node "audits/tools/phase4/COLOR/spot.mjs"`, `node "audits/tools/phase4/COLOR/remeasure.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-COLOR-03 — Me → Switch is pale ink on a white pill in every dark scheme: 1.76-2.48:1 for every household profile and the guest, the kids included

- **Area** design system, all areas · **Type** bug · **Severity** medium · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:7037`; `index.html:1282`, `apps/design.css:176-177`, `apps/design.css:423`, `index.html:1252-1253`; `audits/screens/shell/me-empty-ipad-portrait-dark.png`
- **What happens now.** The rule. `.ds .hero .btn-primary { background: rgba(255,255,255,.92); color: var(--accent-deep) }` (`apps/design.css:423`). In light, `--accent-deep` is 72 % + black and passes. In dark it becomes 58 % + white (`:170, 191, 212`), a pale tint, while the fill stays near-white. Where it renders.
- **Why it matters.** Switch is how the shared iPad changes hands. The worst case is a kid's own colour: Kiara's label is 1.76:1.
- **Proposed fix.** The Me hero Switch reads --hero-btn-bg / --hero-btn-ink (the revision-5 batch-1a row; open issue 19 covers its dark edge).
- **How it will be verified.** Rerun `node "audits/tools/phase4/COLOR/verify-hero-primary-button-inverts-dark-2.mjs"`, `node "audits/tools/phase4/COLOR/spot.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-DARK-02 — Hearth on a dark OS, app by app (a cross-area facet of P2-VIS-03): the park map's inactive pane tabs fall to 2.6-3.3:1 when the sheet is open, the build guide's labels to 3.4-3.9:1, and F260's Reset and "Replace and restore" to 2.61:1

- **Area** design system (F260, build guide, park map) · **Type** bug · **Severity** medium · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4644`; `apps/hub.js:77`, `apps/design.css:176-177`, `apps/hub.js:66`, `apps/f260.html:28`; `audits/evidence/p4/SCORE/shots/hearth/f260/reset-confirm-typical-ipad-portrait-dark.png`, `audits/screens/dollywood-live/family-typical-ipad-portrait-dark.png`
- **What happens now.** hub.js deletes `data-theme` for Hearth (`apps/hub.js:77`). On a dark OS, `@media (prefers-color-scheme: dark) :root:not([data-theme])` then applies the Midnight tokens (`apps/design.css:176-177`), while hub.js sets `data-scheme="light"` from `hub.THEMES` (`apps/hub.js:66, 79`).
- **Why it matters.** Someone who picks Hearth and opens the park map on a dark-mode phone cannot read the tabs that switch between Nearby, Search, Family and Style. F260's two irreversible confirmations drop below AA exactly where the words matter.
- **Proposed fix.** Hearth always writes data-theme (P2-VIS-03 fix), which removes the app-by-app failures. (Phase 4 gap row DARK-2)
- **How it will be verified.** Rerun `node "audits/tools/phase4/DARK/verify-hearth-dark-os-per-app-1.mjs"`, `node "audits/tools/phase4/DARK/hearth-dark-os.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-ICON-01 — Icon inks taken from `apps.json` or profile hex are never lifted for dark: kid tiles, Home card heads and accent icons fall under 3:1

- **Area** design system, all areas · **Type** bug · **Severity** medium · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2724`; `index.html:700`, `index.html:1165`, `apps/design.css:606-608`, `apps/design.css:93`; `audits/screens/shell/apps-typical-ipad-portrait-dark.png`
- **What happens now.** The inks are raw hex values set inline, and no palette can change them:
- **Why it matters.** At night the pre-readers find their apps by the tile picture, and four of their seven pictures are below the non-text minimum. Adults lose the card-head cue on Home, though they keep the text.
- **Proposed fix.** Tiles and card heads read --accent-ink under a data-accent scope (lifted for dark); no raw apps.json or profile hex as ink. (Phase 4 gap row ICON-4)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ICON/verify-icon-ink-hex-not-lifted-dark-1.mjs"`, `node "audits/tools/phase4/ICON/measure.mjs"`, `node "audits/tools/phase4/ICON/report.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-TELL-01 — Keyboard focus is invisible on every `.ds .btn`: 26 of 26 Tab stops change 0 pixels in the shell, TV, Tally, Timer, Kid Verse and Verses

- **Area** design system (Tally, Timer, Kid Verse, Verses, TV) · **Type** bug · **Severity** medium · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:6034`; `apps/design.css:313-314`, `apps/tally.html:83`, `apps/design.css:102`
- **What happens now.** Tabbing onto any `.ds .btn` makes it `:focus-visible`, and nothing changes on screen: the computed outline and box-shadow are the same focused and blurred. Every such stop, per area: shell: 10 (Open F260, Open the ledger, Open prayer, 4 round Done, Add, Refresh, Show more); TV: `#kiosk-switch`; Tally: Reset;
- **Why it matters.** On a desktop, or an iPad with a keyboard, you cannot see where focus is in Timer, Kid Verse and Verses at all, and not on any of the shell's card buttons. One shared rule in `design.css` fixes every area.
- **Proposed fix.** .ds .btn focus is an outline (--focus-ring), so component box-shadows cannot hide it. (Phase 4 gap row TELL-2)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TELL/verify-keyboard-ring.mjs"`, `node "audits/tools/phase4/TELL/verify-ds-btn-keyboard-focus-invisible-cross-area-1.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-TELL-07 — Keyboard focus is invisible on every Apps-grid tile and every profile-picker card, and the chat composer removes its own ring (added after the completeness critic)

- **Area** design system, all areas · **Type** bug · **Severity** medium · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:6305`; `index.html:541`, `index.html:47`, `apps/design.css:314`, `index.html:221-224`
- **What happens now.** A real Tab walk on the desktop (1440×900) reaches all 9 `.tile` buttons on the Apps grid and all 9 `.pcard` cards on the picker. Every one matches `:focus-visible`, but its computed box-shadow and outline are the same focused and blurred, and its box plus 8 px changes 0 pixels.
- **Why it matters.** On a desktop, or an iPad with a keyboard, you cannot see which profile you are about to open or which app, at the two places every session starts.
- **Proposed fix.** Apps-grid tiles, picker cards and the chat composer keep a visible outline focus (--focus-ring, outline not shadow).
- **How it will be verified.** Rerun `node "audits/tools/phase4/CRIT/verify-critic-focus-invisible-tiles-picker-cards-chat-1-1.mjs"`, `node "audits/tools/phase4/CRIT/verify-critic-focus-invisible-tiles-picker-cards-chat-1-2.mjs"`, `node "audits/tools/phase4/CRITIC/focus-other-components.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### VIS-F260-1 — Much of F260's secondary text fails AA in every palette

- **Area** f260 · **Type** visual · **Severity** medium · **Effort** M · **Batch** 1
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: Minor points. (1) Hearth's 4.49 muted captions, and so most of its 150 failures, only occur in New Testament weeks 31-52: body.nt (apps/f260.html:26-30, toggled at 1499) tints the paper with teal. In weeks 1-30 the same text is 4.90 and passes, and gold is 2.96 rather than 2.71.
- **Evidence.** `audits/03-apps/f260.md:703`; `apps/f260.html:235`, `apps/f260.html:71`, `apps/f260.html:193`; `audits/evidence/p3/f260/contrast-hearth-light-iphone.png`, `audits/evidence/p3/f260/contrast-midnight-light-iphone.png`
- **What happens now.** Rendered 10th-percentile contrast of 203 text items on the Plan page at 430 px. Failing: Hearth 150, Parchment 91, Frost 91, Midnight 41, Forest 41, System-dark 41, Hearth on a dark OS 42.
- **Why it matters.** Much of F260's secondary text fails AA.
- **Proposed fix.** Secondary text reads --text-2/--text-3 and hue text reads -ink tokens (batch-1a pre-pass rows for F260), no opacity dimming. (Phase 3: IMP-F260-P11)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/contrast.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-PRAYER-1 — Gold labels, the "shared" pill, done titles and dark nav labels fail contrast

- **Area** prayer · **Type** visual · **Severity** medium · **Effort** S · **Batch** 1
- **Verified (step 3).** was medium; skeptics medium (partly) and medium (partly). Correction: The Midnight/Forest/System-dark failures are wrong. Done row titles measure about 6.0-6.2:1, not 3.24-3.27, and the 'Record' nav label measures about 5.5-5.7:1, not 3.40-3.56. They pass AA, and the p3 p10 values were sampling artifacts (the p3 medians were 6.21/6.08).
- **Evidence.** `audits/03-apps/prayer.md:886`; `apps/prayer.html:107-108`; `audits/screens/prayer/today-typical-iphone-pwa-light.png`, `audits/screens/prayer/record-typical-ipad-portrait-dark.png`
- **What happens now.** "Answered recently" (13 px gold on gold-soft): 2.78 Hearth, 3.11 Parchment, 3.30 Frost.
- **Why it matters.** Labels and done titles fail contrast.
- **Proposed fix.** Gold, teal and terra text move to their -ink tokens; done titles use --text-2 without opacity (batch-1a pre-pass rows for Prayer). (Phase 3: IMP-PRAYER-P11)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/contrast.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-ACCENT-1 — Signed out, the accent falls back to Elizabeth's colour, so every PIN pad fills its dots and Continue in #8A6A4B (Midnight #CBA77E), whoever is signing in

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:5637`; `index.html:58`, `apps/hub.js:81`, `apps/design.css:86`, `index.html:553`
- **What happens now.** The rule. `.pin-dots i.on` is painted with `--accent` (`index.html:58`). hub.js removes `--accent` while nobody is signed in (`apps/hub.js:81`), so `--accent: var(--mocha)` applies (`apps/design.css:86`). That is Elizabeth's exact hex.
- **Why it matters.** Every PIN pad looks like Elizabeth's.
- **Proposed fix.** Signed out, the accent is graphite (the neutral default), not Elizabeth's colour. (Phase 4 gap row ACCENT-6)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ACCENT/runtime.mjs"`, `node "audits/tools/phase4/ACCENT/remeasure.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-ACCENT-2 — One hue means a person, an app and a status at once: 5 of 9 app colours are a household member's exact colour, and Mae's running Timer ring is `--danger`

- **Area** design system (Timer) · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:5646`; `index.html:700`, `apps/design.css:77`, `apps/timer.html:22`, `worker/seed.sql:4-11`
- **What happens now.** App colours. They are painted through the same `--tint` as people (`index.html:700, 1165-1188`); see Table ACCENT-8.
- **Why it matters.** One hue means a person, an app and a status.
- **Proposed fix.** App tiles keep their own hues (D5); a person is always ring + face and a tile always glyph + name, so neither is read by colour alone, even when the admin gives a person an app's colour (household answer 2026-09-26); the Timer's running ring uses the owner's colour, never --danger. (Phase 4 gap row ACCENT-7)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ACCENT/app-vs-person.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-ACCENT-3 — A local accent override does not re-derive the tokens that paint: Kid Verse and Prayer's Family list get it wrong, Verses gets it right

- **Area** design system (Prayer, Kid Verse, Verses) · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:5660`; `apps/design.css:87-89`, `apps/kidverse.html:55`, `apps/prayer.html:39`, `apps/verses.html:56-58`
- **What happens now.** Kid Verse sets only `--accent: var(--gold)` (`apps/kidverse.html:55, 137`), so Done ★ keeps the kid's deep (P3-KIDVERSE-14).
- **Why it matters.** Overrides do not re-derive.
- **Proposed fix.** A local accent override is a data-accent scope, which re-derives every role. (Phase 4 gap row ACCENT-5)
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-ACCENT-4 — Three apps never put the person's colour on their content and Tally uses it only as a wash, while Prayer, Timer, Verses and the park map carry it on primaries and selection

- **Area** design system (Prayer, Tally, Timer, Verses, park map) · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:5669`; `apps/f260.html:208`, `apps/leftovers.html:39`
- **What happens now.** The runtime pass covered every profile.
- **Why it matters.** Some apps never show the person's colour.
- **Proposed fix.** Each app carries the person's colour on its primary action, selection and progress (a per-app row).
- **How it will be verified.** Rerun `node "audits/tools/phase4/ACCENT/recount.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-COLOR-1 — "Past", "done" and "not yet" are shown by dimming text with opacity, differently in every app: 1.46-3.5:1

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:7240`; `apps/f260.html:235`, `apps/f260.html:193`, `apps/dollywood.html:101`, `apps/timer.html:38-39`; `audits/screens/dollywood-live/waits-kid-typical-desktop-light.png`, `audits/screens/f260/behind-typical-desktop-light.png`
- **What happens now.** There is no AA-safe tertiary or "done" ink, so each app dims text with its own opacity:
- **Why it matters.** Dimmed states are most of the hub's failing text occurrences (F260's past weeks alone are 16,277), and each app picked its own value.
- **Proposed fix.** Past, done and not-yet states use --text-2/--text-3 plus a glyph, never opacity on text. (Phase 4 gap row COLOR-5)
- **How it will be verified.** Rerun `node "audits/tools/phase4/COLOR/components.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-COLOR-2 — "Today" is a ring in three apps, drawn three ways; it is below 3:1 in Hearth in all three, and in every theme in Kid Verse

- **Area** design system (Kid Verse) · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:7260`; `apps/prayer.html:165`, `apps/kidverse.html:69`
- **What happens now.** | App | Recipe | Hearth | Parchment | Frost | Dark | |---|---|---|---|---|---| | F260 heatmap | gold ring | 2.62-2.71 | 2.83 | 3.09 | 8.45-9.55 | | Prayer calendar | gold 2 px box-shadow (`apps/prayer.html:165`) | 2.96 | 3.24 | 3.47 | 9.0-9.2 | | Kid Verse | `--focus` ring (`apps/kidverse.html:69`) | 1.29-1.86 in every theme | | | |
- **Why it matters.** "Today" anchors every progress strip, and for pre-readers it is the only cue.
- **Proposed fix.** One today ring (--today-ring, ≥ 3:1) drawn one way. (Phase 4 gap row COLOR-7)
- **How it will be verified.** Rerun `node "audits/tools/phase4/COLOR/nontext-summary.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-COLOR-3 — The person's colour becomes ink through four recipes, and only `--accent-deep` is guaranteed

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:7277`; `index.html:955`
- **What happens now.** (Table COLOR-6): Raw `--accent` / `--tint` fails in both schemes: 1.49-2.93 in dark, and 2.25-4.41 in light for four colours (P4-COLOR-02; P2 for the shell). `--accent-deep` passes on every surface, and fails only on the hero's fixed white fill (P4-COLOR-03).
- **Why it matters.** Profile colours are editable in the admin panel, and guests pick from swatches. Only an ink derived with a contrast floor can guarantee that a new colour passes. Today, whether a colour passes depends on which recipe an area happened to use.
- **Proposed fix.** Only --accent-ink (and --accent-on on a solid) become ink.
- **How it will be verified.** Rerun `node "audits/tools/phase4/COLOR/palette.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-COLOR-4 — Semantic colours are neither consistent between areas nor unmistakable

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:7289`; `apps/design.css:80-83`, `apps/f260.html:11-12`, `apps/prayer.html:106`, `apps/timer.html:36-38`
- **What happens now.** (Table COLOR-7): The aliases reach four files only: the shell, the Larder, the Timer (`--danger` only) and the Dollywood template (`--ok`, `--danger`). The draft's "only the Larder and the shell" was corrected by a grep. F260 and Prayer map meaning to hue families their own way.
- **Why it matters.** The house style requires semantic colours that stay unmistakable. Today their meaning changes from app to app, and red against green is carried by hue alone.
- **Proposed fix.** Semantic families (success, warning, danger) with glyphs, ≥ 10 ΔE00 from every person colour (gated). (Phase 4 gap row COLOR-10)
- **How it will be verified.** Rerun `node "audits/tools/phase4/COLOR/semantic.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-DARK-1 — The illustration set has no dark form, and each area improvises

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4913`; `index.html:203`
- **What happens now.** None of the 38 SVGs in `art/` uses `currentColor`, CSS variables or `prefers-color-scheme`. The re-measure's static scan agrees. Story scenes: 10 of 12 are opaque light panels (mean luminance 0.53-0.77, 55-94% pale pixels), 7.8-12.6:1 against the Midnight card. `03-promise` and `09-nativity` are dark slabs in light mode.
- **Why it matters.** In the evening the kids' story panel is the brightest thing on the iPad, and empty states look pasted in from the light theme.
- **Proposed fix.** Art with a dark form: scripts/make-art.mjs emits token fills, and art sits on --art-plate meanwhile. (Phase 4 gap row DARK-10)
- **How it will be verified.** Rerun `node "audits/tools/phase4/DARK/art-dark.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-GLASS-1 — The glass recipe is re-typed 17 times in 5 source files, in three filter variants

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:3509`; `apps/f260.html:58`, `apps/tally.html:46`, `apps/prayer.html:285-297`, `apps/leftovers.html:38`
- **What happens now.** Only the shell, Kid Verse, Verses and Timer use the shared classes. The gradient is copied by F260 3 times (`apps/f260.html:58, 385, 422`), Tally 3 (`apps/tally.html:46, 74, 99`), Prayer 1 block (`apps/prayer.html:285-297`), the Larder 1 (`apps/leftovers.html:38`) and the Dollywood template 9 per export (`template.html:215, 287, 290, …
- **Why it matters.** The next recipe change (reduced transparency, contrast, the sheen fix) has to be made in about 17 places, and the variants already disagree.
- **Proposed fix.** One glass recipe via --glass-filter and --glass-bg*, replacing 17 re-typed copies. (Phase 4 gap row GLASS-3)
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-GLASS-2 — Five areas put live glass on content in most screens, four keep it on the control layer, and Phase 3 scored both groups the same

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:3520`
- **What happens now.** (Table GLASS-1, share of each area's screens with a visible live blur on content): Tally 100 % (dial, +, −, Reset), Kid Verse 100 % (scene card, Read buttons), Verses 89 % (trainer and done cards), Timer 87 % (the dial), the build guide 48 % (exaggeration control, north button). F260, the Larder, Prayer and the park map: 0 %.
- **Why it matters.** In four apps glass means "this floats and controls"; in five it means "anything", so it stops telling the family what can be tapped.
- **Proposed fix.** Glass on the navigation layer only, in every area (content glass rows per app; open issue 15). (Phase 4 gap row GLASS-12)
- **How it will be verified.** Rerun `node "audits/tools/phase4/GLASS/layers.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-ICON-1 — Eleven icon families; no app uses the shell's own set

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** L · **Batch** 1
- **Verified (step 3).** was medium; skeptics low (partly) and low. Correction: The count 'eleven icon families' does not match the report's own Table ICON-1: it lists 12 families (F1-F8 plus glyphs, emoji, CSS chevrons and art-as-icon), or 10 distinct recipes if F1-F3 count as the one shell recipe as the item states.
- **Evidence.** `audits/04-design-system.md:2979`; `index.html:913-916`, `apps/f260.html:617-620`; `audits/screens/f260/milestones-typical-iphone-pwa-light.png`
- **What happens now.** The shell (F1-F3) is one custom 1.75 recipe. Each app brings its own: F260: Feather/Lucide-derived paths at 2 on 18 px, a 20-grid tick at 2.6, colour emoji, text glyphs and CSS chevrons.
- **Why it matters.** Eleven icon families.
- **Proposed fix.** One icon set: a Lucide (ISC) sprite with the licence notice, one weight, --icon-* sizes; apps adopt it in their batches (glyph-by-glyph map in 04 ICON).
- **How it will be verified.** Rerun `node "audits/tools/phase4/ICON/static.mjs"`, `node "audits/tools/phase4/ICON/report.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-ICON-2 — One drawing, several meanings

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:3012`; `audits/screens/dollywood-live/amenity-tap-typical-iphone-pwa-light.png`
- **What happens now.** Several drawings carry more than one meaning (Table ICON-5): Flame = the activity feed in the shell, but a streak in F260.
- **Why it matters.** grandparents and pre-readers read icons literally.
- **Proposed fix.** One drawing per meaning (the ICON meaning map).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-MOTION-1 — Press feedback is complete in the `.ds` areas, partial or absent elsewhere, with nine scales and no brightness shift anywhere

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4090`; `apps/prayer.html:196`, `apps/dollywood-live.html:409-411`, `apps/design.css:359`, `index.html:45`
- **What happens now.** Complete in the `.ds` areas: Tally 3/3, Timer 8/8, Kid Verse 2/2, Verses 2/2, the kid Home 6/6, and the shell 65/68 (86-100 % per surface).
- **Why it matters.** Taps with no visible response invite double taps, as with Prayer's main button and every build-guide control. Several apps punish double taps (P3-LEFTOVERS-01, P3-VERSES-12).
- **Proposed fix.** The global .pressable (scale 0.97 + dim) adopted in every area.
- **How it will be verified.** Rerun `node "audits/tools/phase4/MOTION/press.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-MOTION-3 — Four sheet implementations and three toast systems; none follows the finger, and only one animates out

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4122`; `apps/design.css:587`, `apps/hub.js:431-435`, `apps/f260.html:416-418`, `apps/prayer.html:254-259`; `audits/screens/prayer/mark-answered-typical-iphone-pwa-light.png`, `audits/screens/f260/done-toast-typical-ipad-portrait-light.png`
- **What happens now.** The shell's `.ds .sheet` rises 24 px over 360 ms and is removed in one frame.
- **Why it matters.** Grabbers that do nothing and dialogs that blink away are web tells. Every other app would have to build its own toast to offer undo.
- **Proposed fix.** One sheet and one toast component (slide up, animate out, drag to dismiss) shared by all areas.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-MOTION-4 — No shared loading state: skeletons only in the shell; a slow first pull shows blanks, false zeros or finished-looking pages

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4144`; `index.html:888-889`, `apps/design.css:539-544`; `audits/screens/prayer/kid-loading-iphone-pwa-light.png`, `audits/screens/verses/trainer-loading-iphone-pwa-light.png`
- **What happens now.** What shows (Table MOTION-5), 1.2 s into a cold load with the first pull held: Skeletons appear only in the shell: 1 on Home, 1 on Me. There are none in any app or on the TV.
- **Why it matters.** The false values are the visible face of the data-loss defects on a slow first load (P3-TALLY-02, P3-KIDVERSE-01 and -03, P3-VERSES-03, P2-SYNC-17). The screen invites a tap on wrong data.
- **Proposed fix.** One loading primitive: hub.loaded + a skeleton class sized to the loaded box (--sk-line, --min-h-*), used by every app.
- **How it will be verified.** Rerun `node "audits/tools/phase4/MOTION/cls.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-SHAPE-1 — The content card is built six ways: radii from 12 to 36, five paddings, three border widths, three elevations

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2189`; `apps/design.css:381-383`, `apps/kidverse.html:41`, `apps/verses.html:72`, `apps/leftovers.html:71`; `audits/evidence/p4/SHAPE/sheet-cards.png`
- **What happens now.** The same role, a solid content card, is drawn as follows (Table SHAPE-4):
- **Why it matters.** Moving between apps, the same kind of surface changes its corner, weight and depth. The hub reads as separate web pages rather than one system.
- **Proposed fix.** One content card (--r-card, --pad-card, --material-solid-bg, --elev-card) adopted per app.
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/cards.mjs"`, `node "audits/tools/phase4/SHAPE/cards-summary.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-SHAPE-2 — Nine content column widths, and only two apps use a layout token

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2234`; `apps/design.css:341-342`, `index.html:68`, `apps/f260.html:44`, `apps/leftovers.html:19`; `audits/screens/kidverse/kid-typical-ipad-landscape-light.png`
- **What happens now.** Content columns are 360 (Tally's dial), 484-528 (Prayer, 33rem), 560 (Larder), 608 (Timer), 660 or 704 and then 1204 (F260, 44rem / 78rem), 688 (Kid Verse and Verses, the only users of `--max-read`), 788-880 and then 1200 (the shell), 1400 (the build guide) and full bleed (the park map) (Table SHAPE-3).
- **Why it matters.** On the always-on iPad the family flips between apps constantly. A jumping content edge and phone-width columns on a landscape iPad look unplanned.
- **Proposed fix.** Three column tokens (--col-narrow / --col-read / --col-wide) adopted per app.
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/verify.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-SHAPE-3 — The spacing rhythm splits the system in two: `.ds` areas are 98-100 % on the 4 px grid, own-CSS areas 34-84 %

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2259`; `apps/prayer.html:50`
- **What happens now.** Macro spacing on the 4 px grid (rig / re-measure): shell 99.7 / 99.7 %, TV 100 / 100, Tally 100 / 100, Timer 100 / 100, Kid Verse 98.4 / 97.2, Verses 98.6 / 96.9. Against those: build guide 83.6 / 74.9, park map 65.5 / 54.5, Larder 46.9 / 45.5, Prayer 44.3 / 40.9, F260 36.4 / 34.1.
- **Why it matters.** Uneven gaps make the large apps feel hand-assembled next to the small ones, and literal spacing is out of reach of any future iPad or kid spacing tier.
- **Proposed fix.** Own-CSS areas adopt the 4 pt spacing tokens in their batches (lint row).
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/analyze.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-SHAPE-4 — The main action of a screen has six corner shapes and heights from 44 to 60

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2274`; `apps/design.css:352`, `apps/verses.html:50`, `apps/kidverse.html:50`, `apps/prayer.html:192-194`; `audits/evidence/p4/SHAPE/sheet-buttons.png`
- **What happens now.** The main actions are (Table SHAPE-6):
- **Why it matters.** The one control each screen wants tapped looks different in every app, so pre-readers and grandparents get no learned "this is the button" shape.
- **Proposed fix.** The primary action is a capsule at --btn-h-lg everywhere. (Phase 4 gap row SHAPE-12)
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/crops.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-SHAPE-5 — Sheets and modals use four corner radii (five with the Dollywood popover) and three elevations

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2292`; `apps/design.css:582`, `apps/prayer.html:239`, `apps/f260.html:385`
- **What happens now.** (Table SHAPE-7.) The shell's `.sheet` is 36 at the top (44 for kids), at `--e4`. Prayer's `#sheet` is 26 at the top. The park map's sheet and the build guide's phone sheet are 24 at the top, with the literal upward shadow `0 -10px 40px -8px`. F260's modal card is 16 (`--r`), at `--e4`.
- **Why it matters.** Sheets are the Liquid Glass surface the house style names, and four shapes make the same gesture feel different in each app.
- **Proposed fix.** One sheet (--r-sheet, --elev-overlay) shared by every area.
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/analyze.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-SHAPE-6 — The own-CSS areas use literal radii off the scale, and the kid radius scale misses the park map

- **Area** design system (park map) · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2321`; `apps/design.css:606`, `apps/design.css:283`, `apps/design.css:31`, `apps/prayer.html:239`
- **What happens now.** Share of large non-pill radii on the `--r-*` scale: Kid Verse, Verses, Timer and the Larder 100 %; F260 94.8 %; shell 87.5 %; TV kiosk 63.6 %; build guide 55.0 %; Prayer 50.1 %; park map 42.4 %. The park map in kid mode is 10.8 %. The literals in use: Prayer: 7 (calendar), 18 (nav buttons), 26 (sheet);
- **Why it matters.** Kids get rounder shapes in every app except the park map, and a later radius change would miss half the surfaces.
- **Proposed fix.** Own-CSS radii move to --r-* roles; the kid radius scale reaches the park map.
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/analyze.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-TELL-1 — Selectable chrome and callout suppression follow the `.ds` boundary exactly

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:6349`; `apps/design.css:355`, `apps/tally.html:22`, `apps/timer.html:10`
- **What happens now.** Controls computing `-webkit-user-select: text` on the main screen (WebKit, iPad portrait): F260 all 190 (re-measure 192), Larder all 9 (15), Prayer all 29 (19), build guide all 54 (57), park map all 13 (15). The shell's 4 of 14 are the tab bar.
- **Why it matters.** On an iPad or iPhone, a long press on a Done, week or chip button can raise the selection loupe or an image callout (needs a device). It happens exactly in the apps that keep their own CSS.
- **Proposed fix.** Base chrome rules (user-select, touch-callout) apply globally, not only inside .ds. (Phase 4 gap row TELL-3)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TELL/tells-webkit.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-TELL-2 — Three confirmation idioms; 14 of 20 native dialog call sites are reachable in the shell and the Dollywood pair

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:6365`; `apps/f260.html:1756`, `apps/prayer.html:1089`
- **What happens now.** 20 native call sites (Table TELL-6). 14 are reachable in the shipped UI: shell 9, build guide 2, park map 3. A run in WebKit raised and dismissed 9 of them. F260 confirms in an in-app modal (`confirmModal`, `apps/f260.html:1756`), and Prayer in an inline `ask()` panel (`apps/prayer.html:1089`).
- **Why it matters.** `alert()` and `confirm()` are a named web tell. The alternatives already exist in two apps but are not shared, so each area improvises.
- **Proposed fix.** One confirm sheet and undo toasts replace the 20 native dialog call sites (14 reachable). (Phase 4 gap row TELL-10)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TELL/dialogs.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-TOK-1 — Four local token vocabularies, in which "ink" means four different things

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:841`; `apps/f260.html:16-20`, `apps/prayer.html:24-34`, `apps/dollywood.html:212`, `apps/leftovers.html:14`
- **What happens now.** The duplicated alias sets. F260 and Prayer each define the same nine aliases for design tokens (apps/f260.html:16-20; apps/prayer.html:24-34).
- **Why it matters.** The same word points to opposite roles, so a change made by name lands on the wrong surface.
- **Proposed fix.** App-local vocabularies (F260, Prayer, the Larder, the template) retarget to role tokens in each app's batch (migration table). (Phase 4 gap row TOK-8, TOK-20)
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-TOK-2 — The non-`.ds` apps reuse design.css class names for different components, and the segmented control exists four ways

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:853`; `apps/design.css:465-468`, `apps/f260.html:60`, `apps/prayer.html:66`, `apps/dollywood.html:25`
- **What happens now.** The names collide. F260 (`.btn` ×35, `.row` ×10, `.seg` ×8, `.switch`, `.sheet`, `.toast`), Prayer (`.chip` ×10, `.small` ×25, `.pill`, `.sheet`, `.toast`, `.switch`) and the Dollywood template (`.btn`, `.badge`, `.pill`, `.stat`) have no `body.ds`.
- **Why it matters.** It blocks a gradual move to `.ds`, and the same control looks different from app to app.
- **Proposed fix.** One segmented control and one set of component names; non-.ds apps adopt them in their batches.
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-TOK-3 — 168 `color-mix()` recipes, with the person colour mixed at 27 different ratios

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:871`; `apps/tally.html:47`
- **What happens now.** Counts. 168 occurrences and 99 distinct recipes (re-measure): design.css 55;
- **Why it matters.** Tints drift from app to app and cannot be re-tuned per theme in one place.
- **Proposed fix.** Replace the 168 color-mix() recipes with role tokens (--tint-*, --sel-*, --glass-*). (Phase 4 gap row TOK-4)
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-TYPE-1 — Ten areas, eight large-title treatments, none 34 bold with tight tracking; three apps repeat the viewer bar's title

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:1422`; `apps/design.css:331-332`, `apps/dollywood.html:223`, `index.html:335`; `audits/evidence/p4/TYPE/titles-ipad-portrait.png`
- **What happens now.** Titles by area (iPad portrait, re-measured live): shell: view h1 36/400 ui-serif, tracking normal; Home hero 44/400 serif;
- **Why it matters.** The one element that should identify a screen changes face, weight and size in every app, so moving between apps feels like moving between websites.
- **Proposed fix.** One large-title role (34 bold, tight tracking) everywhere; apps inside the viewer drop their duplicate title (decision D6).
- **How it will be verified.** Rerun `node "audits/tools/phase4/TYPE/report.mjs"`, `node "audits/tools/phase4/TYPE/montage.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-TYPE-2 — The same role is set differently in every area: section headers seven ways, buttons 13-18 px at weights 400-700, body 14.5-22 px

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:1440`; `apps/design.css:306-309`, `apps/f260.html:55-125`
- **What happens now.** Section headers: shell 18/700; F260 15/700; Larder 13/700 caps; Prayer 19/600; Verses and Kid Verse 18/700; build guide 16/400 serif; park map 15/600 generic serif.
- **Why it matters.** Hierarchy has to be relearned in each app, and a heading of the same kind means something different in each.
- **Proposed fix.** Every role from the Dynamic Type tokens (--text-*), adopted per app.
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-TYPE-3 — Big numerals in four faces; tabular figures missing in F260, Prayer and Kid Verse

- **Area** design system (F260, Prayer, Kid Verse) · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:1451`; `index.html:197`, `apps/dollywood.html:14-15`, `apps/tally.html:58`, `apps/kidverse.html:62`
- **What happens now.** ui-rounded 700-900: the TV clock, the Verses stats and the shell's star counts;
- **Why it matters.** Counts are the most glanced-at text in the hub, and one numeral face would tie the apps together.
- **Proposed fix.** Numerals read --font-numeral with tabular figures in every area.
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-TYPE-4 — The kid type scale reaches five of the eight kid-visible areas, and `--fs-xs` never scales, so kickers, tab labels and captions stay 12 px for kids

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:1464`; `apps/design.css:280-284`; `audits/screens/kidverse/kid-rewards-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/kid-typical-ipad-portrait-dark.png`
- **What happens now.** Shared selectors that grow in kid mode (the re-measure's full sets): shell 36/42, Tally 4/5, Timer 4/5 (not the digits), Verses 12/13, Kid Verse 10/16. None grow in the Larder (0/15) or the park map (0/43), because both set sizes in literal px. Prayer builds its own kid layout (2/4 shared selectors grow; its kid minimum is 14 px).
- **Why it matters.** Kid mode is meant to be one consistent, larger world. In two apps it is simply the adult page.
- **Proposed fix.** The kid block scales every role including captions (--fs-floor 16).
- **How it will be verified.** Rerun `node "audits/tools/phase4/TYPE/report.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-TYPE-5 — Kid display type is serif in every kid-visible area except Prayer

- **Area** design system (Prayer) · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:1477`; `apps/design.css:18`, `apps/design.css:19-20`, `apps/kidverse.html:36`, `apps/tally.html:58`
- **What happens now.** The largest kid text is ui-serif, which is New York on Apple devices:
- **Why it matters.** The pre-reader's big type (their stars, their verse) is exactly where the friendly rounded face matters most.
- **Proposed fix.** Kid mode is rounded everywhere (decision D6).
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-TYPE-7 — Five of nine apps size text in literal px and bypass the tokens: F260 122, the Dollywood template 149, Prayer 64, the Larder 16, against a fully tokenised shell

- **Area** design system (F260, Prayer, Larder) · **Type** visual (consistency) · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:1514`
- **What happens now.** Declared sizes, token against literal: design.css 29/0 and `index.html` 51/0 (bare px; six `clamp()` declarations carry px bounds). Verses 15/1, Kid Verse 27/4; Tally and Timer use tokens plus a clamp.
- **Why it matters.** Every hub-wide type change (kid mode, an iPad tier, larger text) silently skips F260, Prayer, the Larder and both Dollywood exports. Table TYPE-4 shows it already happens for kids in the Larder and the park map.
- **Proposed fix.** Literal px sizes move to roles app by app (the lint row per app batch).
- **How it will be verified.** Rerun `node "audits/tools/phase4/TYPE/code-scan.mjs"`, `node "audits/tools/phase4/TYPE/report.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-DARK-1 — Dark soft fills sit 1.01-1.22:1 from the card, so every soft-filled state goes muddy or vanishes; one token choice explains six per-app Phase 3 findings

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: The measured token contrasts are right, but the causal claim is wrong. The -soft tokens do not explain VIS-TALLY-1 (glass discs), VIS-KIDVERSE-3 (the 1.14/1.15 figures are surface-2 against surface), the Prayer kid fills (accent-deep against olive) or VIS-F260-2 (--sunk).
- **Evidence.** `audits/04-design-system.md:4848`; `apps/design.css:163-168`, `apps/design.css:169`; `audits/evidence/p4/SCORE/shots/forest/tally/main-typical-ipad-portrait-light.png`, `audits/evidence/p4/SCORE/shots/midnight/leftovers/main-typical-ipad-portrait-light.png`
- **What happens now.** In Midnight the semantic `-soft` tokens (`apps/design.css:163-168`) against `--surface` #241E19 measure: mocha 1.10, gold 1.08, olive 1.07, teal 1.02, terra 1.01, slate 1.11; Forest 1.02-1.10. `--accent-soft` (`color-mix(accent 14%, surface)`, `apps/design.css:169`) measures 1.08-1.22 (Forest 1.08-1.21).
- **Why it matters.** Expiry states, rating choices, the tally buttons and the kids' progress dots all rely on the soft fill. For pre-readers the fill is the state cue. Under System, the always-on iPad runs dark every evening.
- **Proposed fix.** Dark fills sit ≥ 1.5:1 from the card (deep pastel tints in the proposal). (Phase 4 gap row DARK-4)
- **How it will be verified.** Rerun `node "audits/tools/phase4/DARK/palette-dark.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### GAP-DARK-2 — The dark depth ladder is flat and "sunken" goes darker, so wells, tracks and skeletons read as holes

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4870`; `apps/design.css:157`, `apps/f260.html:16`, `apps/prayer.html:24`, `apps/timer.html:28`
- **What happens now.** Card against page is 1.10:1 in Midnight and 1.12:1 in Forest. `--surface-2` is darker than the card (1.14:1 in Midnight, 1.16:1 in Forest; `apps/design.css:157`), and it backs every well, track and skeleton: F260 and Prayer map `--sunk` to it (`apps/f260.html:16`, `apps/prayer.html:24`); the Larder's ✓ wells;
- **Why it matters.** Progress tracks, empty cells and input wells lose their shape in dark in every app that uses them.
- **Proposed fix.** A lifted depth ladder (wells lighter than cards, raised surfaces lighter still). (Phase 4 gap row DARK-5, DARK-6)
- **How it will be verified.** Rerun `node "audits/tools/phase4/DARK/palette-dark.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-GLASS-1 — No glass surface responds to Reduce Transparency or Increase Contrast, in any area, and there is no in-app toggle

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:3555`; `index.html:1258`
- **What happens now.** `prefers-reduced-transparency`, `prefers-contrast` and `forced-colors` occur 0 times in `index.html`, `apps/design.css`, `apps/hub.js` and the nine apps. Me → Appearance offers only theme cards (`index.html:1258`).
- **Why it matters.** The house style requires it, and a household member who turns on Reduce Transparency still gets the translucent composer, sheets and tab bar.
- **Proposed fix.** Reduce Transparency and Increase Contrast blocks (attribute + media mirror) and the Me → Appearance switches (decision D11). (Phase 4 gap row GLASS-1, GLASS-2)
- **How it will be verified.** Rerun `node "audits/tools/phase4/GLASS/prefs.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-ICON-1 — The design system has no icon tokens, size scale, weight rule, ink rule or shared sprite, and the style guide shows one glyph

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Verified (step 3).** was medium; skeptics low and low (partly). Correction: Minor points only. The style guide has three #i-plus copies on hex --tint tiles plus one bare icon-lg, not four each on a hex tint. F260 carries its own 11-symbol sprite, so index.html is not the only inline sprite; what is true is that no shared, loadable sprite exists.
- **Evidence.** `audits/04-design-system.md:3052`; `apps/design.css:602-603`
- **What happens now.** `.icon` at 24 / 32 px with a 1.75 stroke (`apps/design.css:602-603`);
- **Why it matters.** No icon system.
- **Proposed fix.** Icon tokens, size scale, weight and ink rules, and a sprite shown in docs/design.html.
- **How it will be verified.** Rerun `node "audits/tools/phase4/ICON/report.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-ICON-2 — A custom shell set rather than one open-source set; Lucide and Feather paths ship without their licence notice

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:3074`; `apps/leftovers.html:148`, `apps/f260.html:531-541`, `apps/dollywood.html:1744-1746`
- **What happens now.** The shell set is custom. The shell and tile icons are hand drawn, not Lucide or Phosphor.
- **Why it matters.** Lucide and Feather paths ship without their licence.
- **Proposed fix.** Ship the Lucide licence notice (ISC) with the sprite; replace custom look-alikes. (Phase 4 gap row ICON-5)
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-MOTION-1 — Cold-load layout shift: CLS reads near zero where views are rebuilt with `innerHTML` while blocks move hundreds of pixels, and F260, the Larder and Kid Verse fail CLS outright

- **Area** design system (F260, Larder, Kid Verse) · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4179`; `audits/screens/kidverse/kid-loading-ipad-portrait-dark.png`, `audits/screens/f260/today-loading-iphone-pwa-light.png`
- **What happens now.** Undercounted by CLS (first pull held 2.5 s, Table MOTION-6): Shell Home: CLS 0.025 / 0 while "Around the house" moves 218 / 348 px (iPad / iPhone; 260 / 435 px at 150 ms latency, at CLS 0).
- **Why it matters.** The primary buttons (Pray now, Kid Verse's action row with Say, the F260 stepper) move under the finger as data lands.
- **Proposed fix.** Stable heights while loading (--min-h-*), and CLS measured per app in the Phase 6 rerun.
- **How it will be verified.** Rerun `node "audits/tools/phase4/MOTION/cls.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### GAP-MOTION-3 — Press states may never show on iPhone or iPad in most areas: few documents register the touch listener iOS needs for `:active`

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4215`; `index.html:664`, `apps/f260.html:2040`, `apps/prayer.html:1716`, `index.html:366`
- **What happens now.** The quirk. iOS Safari applies `:active` on touch only when a touch event listener exists on the element or an ancestor. Each app runs in its own iframe document, so each needs its own listener.
- **Why it matters.** If the quirk holds, every press scale measured in this audit is invisible on the family's primary devices.
- **Proposed fix.** hub.js adds a passive touchstart listener so :active shows on iOS in every document. (Phase 4 gap row MOTION-11)
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-SHAPE-1 — Elevation has no role tokens and no upward level, so each role gets a different depth and the bars use literals

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2307`; `apps/design.css:558`, `apps/design.css:413`, `apps/tally.html:50`
- **What happens now.** (Table SHAPE-10.) Content cards use none, `--e1` or `--e2`; buttons none, `--e1` or `--e2`; floating glass controls `--e2` or `--e3`. The bottom-anchored bars use two literal upward shadows: `0 -1px 0` + `0 -12px 40px -24px`, on the shell's tab bar (`apps/design.css:558`), copied into Prayer's nav;
- **Why it matters.** Without roles each app picks its own depth. The token proposal needs the roles to make depth consistent.
- **Proposed fix.** Elevation role tokens (--elev-card/-control/-float/-overlay/-toast/-bar-up). (Phase 4 gap row SHAPE-7)
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/analyze.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-TOK-1 — The contrast gate checks 15 pair kinds; design.css's components paint 27 more, and 18 of those fail somewhere

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** M · **Batch** 1
- **Verified (step 3).** was medium; skeptics low (partly) and low. Correction: The claim that the gate never running Hearth on a dark OS makes P2-VIS-03 'invisible to the test' is misleading. Hearth on a dark OS paints the same token values as Midnight, and the System-dark run already checks those.
- **Evidence.** `audits/04-design-system.md:661`; `scripts/test-design.mjs:47-53`, `apps/design.css:47`, `index.html:449`
- **What happens now.** Areas: design.css, docs, the shell, Kid Verse, Dollywood, Verses.
- **Why it matters.** CLAUDE.md tells future changes that the palette is proven AA ("WCAG AA on every text pair for all eight family colours in all five palettes"). The proof covers about a third of what is painted, so regressions in placeholders, badges, switches, rings and focus ship green.
- **Proposed fix.** contrast.mjs becomes the design gate: every component pair design.css paints (42 kinds) is gated, not only the 15 token pairs; scripts/test-design.mjs runs it. (Phase 4 gap row TOK-5, TOK-6)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TOK/pairs.mjs"`, `node "audits/tools/phase4/TOK/guide-contrast.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-TOK-3 — Profile and app colours are single light-theme hex values that never re-tune; as foregrounds in Midnight and Forest, 17 of 19 fall under 3:1

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** M · **Batch** 1
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: 'The TV and the dark palettes lose the per-person colour cue' is overstated. The hues remain distinguishable and the rings and glyphs remain visible, only dimmer (1.9-3.0). As rendered, 6 of 9 app glyphs (adult grid) and 3 of 7 (kid grid) fall under 3:1, not the 8 of 9 from the 22%-stop worst case.
- **Evidence.** `audits/04-design-system.md:717`; `worker/seed.sql:4-11`, `index.html:449`, `apps/hub.js:461`, `index.html:450`; `audits/screens/shell/apps-typical-ipad-portrait-dark.png`
- **What happens now.** design.css re-tunes every hue family per palette (for example `--olive` #5B8143 → #9DC183 in Midnight). The person and app colours, though, are each one hex, stored in:
- **Why it matters.** Pre-readers find apps by icon and colour, and System goes dark every night. The TV and the dark palettes lose the per-person colour cue.
- **Proposed fix.** People and apps carry a hue family name (data-accent, apps.json "hue", the profile hue column), re-tuned per scheme. (Phase 4 gap row TOK-2, ACCENT-1)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TOK/tokens.mjs"`, `node "audits/tools/phase4/TOK/appcolours.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### GAP-TOK-4 — Kid and kiosk scale only the tokenised subset; every literal size escapes them

- **Area** design system (TV) · **Type** feature gap · **Severity** low · **Effort** M · **Batch** 1
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: The shell citations are wrong: index.html:60 is the adult PIN pad, :124 is a kiosk rule, and :188 is an icon size. None of them is a [data-kind=kid] rule restating 64/84px, and the kid CTA already uses var(--tap-lg).
- **Evidence.** `audits/04-design-system.md:741`; `apps/design.css:280-289`, `index.html:60`
- **What happens now.** Areas: design.css, the shell, F260, the Larder, Prayer, the park map.
- **Why it matters.** Kid mode and the 10-foot TV depend on the kind scale, but the Larder and the park map keep adult type for pre-readers.
- **Proposed fix.** Kid and kiosk scale every role through --ts-kind / --space-k / --shape-k; literal sizes move to roles app by app (lint row). (Phase 4 gap row TOK-10, TOK-11)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TOK/usage.mjs"`, `node "audits/tools/phase4/TOK/literals.mjs"`, `node "audits/tools/phase4/TOK/adoption.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-TOK-5 — There are no weight, z-index, opacity, breakpoint, press-scale, fluid-type or composite-glass tokens, so each area invents its own

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: The counts hold (25 saturate copies, 16/18 breakpoints). The 'why it matters' overstates the risk. Overlays from different areas cannot collide, because apps live in separate iframe documents with their own stacking contexts. The hand-copied glass has not diverged.
- **Evidence.** `audits/04-design-system.md:765`; `index.html:261`, `apps/dollywood.html:215`
- **What happens now.** What each area invents (Table TOK-F): Weights: literal weights in all 11 areas: design.css 20 (600 ×10, 700 ×7, 400 ×3), shell 26, F260 87 (800 ×16), Prayer 52, park map 40, Kid Verse 16.
- **Why it matters.** Without shared layers, overlays from different areas can collide; without shared weights, hierarchy drifts from app to app. Hand-copied glass diverges from the recipe the moment the recipe changes.
- **Proposed fix.** Weight, z-index, opacity, press-scale and composite glass tokens (proposal §1). (Phase 4 gap row TOK-9, TOK-13)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TOK/literals.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-TOK-6 — design.css cannot scope the accent to one component, because the derived accent tokens resolve once on `:root`

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:783`; `apps/design.css:86-102`, `apps/verses.html:56-58`, `apps/kidverse.html:55`, `apps/prayer.html:39`
- **What happens now.** `--accent-soft/-tint/-deep/-glow`, `--glow-accent` and `--focus` are declared on `:root` (apps/design.css:86-102) and inherit as computed values. A component that sets `--accent` therefore has to restate each derived token by hand. Three areas tried:
- **Why it matters.** Two of the three attempts in the codebase got it wrong, and every future per-component colour will hit the same trap.
- **Proposed fix.** data-accent on any element re-derives every accent role for its subtree. (Phase 4 gap row TOK-3)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TOK/verify-accent-repoint.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-TOK-7 — The "every colour is a token" rule fails only on `#hex` in the first `<style>`

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:801`; `scripts/screens-apps.mjs:41-49`, `scripts/screens-shell.mjs:114-115`, `apps/dollywood-live.html:496-508`, `apps/prayer.html:1537`
- **What happens now.** Areas: the shell, design.css, F260, the Larder, Prayer, both Dollywood files.
- **Why it matters.** CLAUDE.md's "every colour in every app is a token" is enforced for one syntax only.
- **Proposed fix.** The lint checks every <style> and inline style for hex, rgb() and named colours (screens-apps.mjs extended). (Phase 4 gap row TOK-7)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TOK/literals.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-TOK-8 — Each dark palette is stored two or three times in design.css

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:815`; `apps/design.css:156-175`
- **What happens now.** Midnight's 47 values are byte-identical in three places: `:root[data-theme=midnight]` (apps/design.css:156-175), the `@media` dark `:root:not([data-theme])` block (:176-197) and `.tp-half` (:257-276).
- **Why it matters.** A palette fix has to be made in two or three places, or the System-dark and swatch copies drift.
- **Proposed fix.** One block per palette; the .tp[data-preview] copies go (data-theme-preview). (Phase 4 gap row TOK-18)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TOK/tokens.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-TYPE-3 — The system has no 11 px floor and nothing checks for one: 10 components in 4 areas go below

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:1490`
- **What happens now.** Table TYPE-5 lists the components: the compass N in both exports, the park map's MIN, F260's WEEK, Kid Verse's day letters and badge dates, the build guide's toolbar captions, and its four groups of SVG labels.
- **Why it matters.** Sub-floor text keeps reappearing, app by app, because nothing in the system forbids it.
- **Proposed fix.** An 11 px floor in every role (--fs-floor) and a lint for literal sizes below it.
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### P3-KIDVERSE-14 — Done ★ and "I heard it" set `--accent` to gold but paint in the kid's own colour (teal for Ezra)

- **Area** kidverse · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/kidverse.md:615`; `apps/kidverse.html:55`, `apps/design.css:361`, `apps/design.css:89`, `apps/verses.html:56-58`; `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-1-ezra-hearth-done.png`, `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-1-ezra-midnight-done.png`
- **What happens now.** The app sets `--accent: var(--gold)` on `.btn.done` and `.btn.story-heard` (`apps/kidverse.html:55, 137`). Both are `btn btn-primary` (`:160, 173`), and `.btn-primary` paints from `--accent-deep` (`apps/design.css:361`).
- **Why it matters.** For pre-readers, colour carries meaning: the star button changes colour with whoever is signed in, and the code does not do what it says.
- **Proposed fix.** The star buttons paint from --star-fill / --star-stroke (the butter family) for every kid. (Phase 3: IMP-KIDVERSE-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/verify-critic-star-buttons-not-gold-5-1.mjs"`, `node "audits/tools/phase3/kidverse/verify-critic-star-buttons-not-gold-5-2.mjs"`, `node "audits/tools/phase3/kidverse/visual.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P3-LEFTOVERS-15 — The add bar's 12 px error line is below AA in Hearth (from the critic)

- **Area** leftovers · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/leftovers.md:703`; `apps/leftovers.html:322`, `apps/leftovers.html:293`, `apps/leftovers.html:96`, `apps/leftovers.html:63`; `audits/evidence/p3/leftovers/critic-err-contrast-hearth-iphone.png`, `audits/evidence/p3/leftovers/verify-critic-err-line-below-aa-hearth-4-1-hearth-bar.png`
- **What happens now.** `.err` is 12 px in `var(--danger)` (`apps/leftovers.html:63`), which is the terra tone, not `--danger-ink` (`apps/design.css:82`). It sits at the bottom of the glass add bar (`apps/leftovers.html:33-45, 130`).
- **Why it matters.** The one line that says why a voice entry failed is the hardest text in the app to read, at the bottom of a translucent bar.
- **Proposed fix.** The error line uses --danger-ink at footnote size (7.11:1 measured). (Phase 3: IMP-LEFTOVERS-P7)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/critic-err-contrast.mjs"`, `node "audits/tools/phase3/leftovers/verify-critic-err-line-below-aa-hearth-4-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-critic-err-line-below-aa-hearth-4-2.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-ACCENT-04 — Person-coloured rings in the apps are never lifted for the scheme: the Timer dial is 2.09-2.64:1 for David and Eli in dark, and Kiara's gold rings fall to 2.32-2.69:1 in Parchment

- **Area** design system (Timer) · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:5482`; `apps/design.css:496-498`, `apps/timer.html:22`, `index.html:351`, `apps/prayer.html:416-419`
- **What happens now.** The rules. `--accent` and `--tint` are painted as stroke and ring colours with no per-scheme value: the avatar rings (`apps/design.css:496-498`); the ring arc (`:528`); the Timer dial, `.dial { --tint: var(--accent) }` with `.ring .fg { stroke: var(--tint) }` (`apps/timer.html:22, 29`); the timer pill (`index.html:351`);
- **Why it matters.** Rings carry the time remaining, and the avatar ring is how a person's colour is seen next to their face. A kid's own rings fade on a light theme her parents may pick.
- **Proposed fix.** Person-coloured rings read --accent-graphic (≥ 3:1 per scheme).
- **How it will be verified.** Rerun `node "audits/tools/phase4/ACCENT/verify-raw-accent-graphics-light-and-apps-2.mjs"`, `node "audits/tools/phase4/ACCENT/remeasure.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-ACCENT-05 — An admin recolour never reaches a person who is already signed in: their chrome and every open app keep the old colour until they next sign in

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:5547`; `apps/hub.js:80`, `index.html:1684`, `worker/src/index.js:270`, `apps/hub.js:286-320`
- **What happens now.** Where the colour comes from. `--accent` is `hub.profile.color` (`apps/hub.js:80`). `hub.profile` is read only from the stored session (`:105-111`). What refreshes the session: login and createPin (`:169, 173`); a photo change (`:482, 488`); an admin editing their own profile on the same device (`index.html:1684`). What does not.
- **Why it matters.** The person's own chrome, hero and buttons show a colour the rest of the household no longer associates with them. After a reload, the feed on the same page already shows the new one.
- **Proposed fix.** The session profile refreshes on pull, so an admin recolour reaches signed-in people (ACCENT-9, hub.js). (Phase 4 gap row ACCENT-9)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ACCENT/verify-recolour-not-propagated-1.mjs"`, `node "audits/tools/phase4/ACCENT/verify-recolour-not-propagated-2.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-COLOR-04 — The chosen theme never sets `color-scheme`, so UA-painted controls follow the OS: F260's week-note Copy button reads 1.01-1.12:1 with a dark palette on a light-OS device, and 1.11-2.92:1 the other way round

- **Area** design system (F260) · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:7087`; `apps/hub.js:96-104`, `index.html:1667`, `apps/design.css:448`, `apps/design.css:15`
- **What happens now.** The cause. `apps/design.css:15` fixes `color-scheme: light dark` on `:root`, and it is the only `color-scheme` declaration. `applyTheme` sets `data-theme` and `data-scheme` but never `style.colorScheme` (`apps/hub.js:74-82`).
- **Why it matters.** Someone who picks Midnight on the kitchen iPad left in light Appearance gets a blank Copy in F260, and, if the select facet holds on iOS, blank pickers in the Larder and the build guide.
- **Proposed fix.** color-scheme follows the chosen palette (every palette block and the bootstrap), so UA controls follow the theme. (Phase 4 gap row COLOR-1)
- **How it will be verified.** Rerun `node "audits/tools/phase4/COLOR/verify-native-controls-ignore-theme-1.mjs"`, `node "audits/tools/phase4/COLOR/native-controls.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-COLOR-05 — The Home reminder and Chat fields are identified only by a 2.5-2.8:1 placeholder and a 1.1-1.45:1 boundary in every theme, and each app draws placeholders in a different ink

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:7137`; `index.html:1204`, `apps/design.css:445`, `index.html:263`, `apps/leftovers.html:50`; `audits/screens/shell/home-typical-ipad-portrait-light.png`
- **What happens now.** Three shell fields have no label or aria-label: `#remtext` (`index.html:1204`), `#chat-in` (`:387`) and `#rotcode` (`:1649`). The `.ds` placeholder colour is `--muted-decor` (`apps/design.css:445`), which the token's comment reserves for "placeholders, dividers, decorative only" (`:48`).
- **Why it matters.** The reminder and Chat fields are daily controls. For grandparents and in glare they read as blank bars. The same role is drawn in three different inks across the hub.
- **Proposed fix.** Fields get a ≥ 3:1 boundary (--field-border) and placeholders read --placeholder (≥ 4.5:1), one global ::placeholder rule. (Phase 4 gap row COLOR-6)
- **How it will be verified.** Rerun `node "audits/tools/phase4/COLOR/verify-unlabelled-fields-unidentifiable-2.mjs"`, `node "audits/tools/phase4/COLOR/verify-unlabelled-fields-unidentifiable-1.mjs"`, `node "audits/tools/phase4/COLOR/spot.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-COLOR-06 — `--muted` is validated only on paper and cards: 4.45:1 on Hearth wells, 4.37 on Parchment wells, 4.49 on F260's New Testament paper, and about 4.0-4.2 on its New Testament wells

- **Area** design system (F260) · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:7188`; `apps/design.css:47`, `scripts/test-design.mjs:109-110`, `apps/f260.html:30-33`, `apps/kidverse.html:13-18`; `audits/screens/f260/behind-pace-typical-desktop-light.png`, `audits/screens/kidverse/kid-reading-typical-desktop-light.png`
- **What happens now.** The token and its validation. `--muted` is annotated "AA on paper and cards (4.9:1)" (`apps/design.css:47`). The system itself puts it on `--surface-2`, documented as "sunken wells, inputs" (`:43`). The style guide's check misses these pairs.
- **Why it matters.** Each instance is small, but it is one token pair repeated across five areas. On F260 in Hearth it is the single largest cause of failing captions.
- **Proposed fix.** --muted aliases --text-3, validated on wells and every paper as well as cards. (Phase 4 gap row COLOR-4)
- **How it will be verified.** Rerun `node "audits/tools/phase4/COLOR/verify-muted-on-wells-and-derived-surfaces-2.mjs"`, `node "audits/tools/phase4/COLOR/palette.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-DARK-04 — The `theme-color` meta goes stale whenever a pull, not a tap, changes the theme

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4790`; `index.html:656-658`, `apps/hub.js:97-105`, `apps/hub.js:35`, `index.html:655`
- **What happens now.** `syncThemeColor()` copies `--bg` into both theme-color metas (`index.html:656-658`). Its only callers are: enterShell (`:624`); a frame's `hub:theme` message (`:767`); a theme tap in Me (`:1283`); boot and an OS scheme change (`:1702-1703`).
- **Why it matters.** In Safari the toolbar tint, and on the Home Screen app possibly the status-bar strip (Unresolved 3), shows paper over a dark page, or dark over paper. The seam stays at the top of every screen until a reload, an OS appearance change or a theme tap.
- **Proposed fix.** applyTheme updates every theme-color meta on every call, including after a pull. (Phase 4 gap row DARK-9)
- **How it will be verified.** Rerun `node "audits/tools/phase4/DARK/verify-theme-color-stale-after-server-theme-1.mjs"`, `node "audits/tools/phase4/DARK/theme-color.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-GLASS-01 — The `--sheen-x` drift restyles the whole document on every scroll step; it costs more than the blur, and F260 drops frames for it

- **Area** design system (F260) · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:3366`; `index.html:662`, `apps/hub.js:442`, `apps/hub.js:448`, `apps/design.css:392`
- **What happens now.** The write. A scroll listener (`apps/hub.js:448`) and `hub.sheenFrom` (`:447`) schedule a rAF that computes `x` from the scroll fraction and, whenever the rounded value changes, calls `root.style.setProperty('--sheen-x', x + '%')` on `<html>` (`:445`).
- **Why it matters.** Scrolling is the most common gesture on the 24/7 iPad. The drift that makes the glass shimmer is the largest glass cost the rig found, and F260, the daily reading app, drops frames for it even on a fast desktop. The iPad's budget is tighter.
- **Proposed fix.** --sheen-x is written on the two bars only and read by their ::after transform (GLASS-7 component rule), never on :root. (Phase 4 gap row GLASS-7)
- **How it will be verified.** Rerun `node "audits/tools/phase4/GLASS/verify-sheen-restyles-whole-document-1.mjs"`, `node "audits/tools/phase4/GLASS/perf.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-GLASS-02 — The perf guard keys on the class pair `.card.glass`, so `.card.glass-strong` keeps a live blur in a scrolling page, and `.glass-lite` is used nowhere

- **Area** design system, all areas · **Type** bug (perf) · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:3397`; `apps/design.css:400`, `apps/verses.html:103`, `index.html:501`, `index.html:553`
- **What happens now.** The guard. `.ds .card.glass { backdrop-filter: none }` (`apps/design.css:400`), commented "in-page cards paint the look without blurring what scrolls under them (blur in a scroller is what makes iPad glass stutter)" (`:399`).
- **Why it matters.** The rule that should keep content cheap is one class name away from failing, and it fails on the Verses card. Every future card that picks `glass-strong` for its denser fill silently gets a live blur.
- **Proposed fix.** Content cards use --material-solid-bg; the perf guard keys on the material role, not the class pair. (Phase 4 gap row GLASS-6)
- **How it will be verified.** Rerun `node "audits/tools/phase4/GLASS/verify-guard-misses-glass-strong-3.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-GLASS-03 — Three live blurs sit under fills that hide them: Prayer's FAB, the park map's north button and the build guide's steps sheet

- **Area** design system (Prayer, build guide, park map) · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:3425`; `apps/prayer.html:285-297`
- **What happens now.** Prayer's FAB. It shares the copied recipe selector `nav,.sheet,.fab,#kitchen .close` (`apps/prayer.html:285-297`), so it gets `blur(18px) saturate(1.4) brightness(1.02)`, but `.fab { --g: var(--accent-deep) }` (`:300`) makes the fill opaque (light `color(srgb .223 .263 .395)`, dark `.600 .632 .738`, alpha 1).
- **Why it matters.** Pure cost with no look, and the steps sheet is the largest glass layer on the iPhone build guide. The north button also looks different from the glass buttons next to it for a reason nobody chose.
- **Proposed fix.** Remove live blurs under opaque fills (Prayer's FAB, the park map's north button, the steps sheet) in their batches. (Phase 4 gap row GLASS-8)
- **How it will be verified.** Rerun `node "audits/tools/phase4/GLASS/verify-opaque-fill-under-blur-1.mjs"`, `node "audits/tools/phase4/GLASS/opaque-blur.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-ICON-02 — The 20 % duotone never renders on sprite icons (`<use>`), so the one icon recipe renders two ways

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2780`; `apps/design.css:605`, `index.html:416-438`, `index.html:886-887`
- **What happens now.** Why the selector misses. `.ds .icon .duo { fill: var(--tint); fill-opacity: .2; stroke: none }` (`apps/design.css:605`; the comment at `:604` states the intent) needs the `.duo` path to be a descendant of `.icon`. In the sprite, the `.duo` paths sit inside `<symbol>` in an unclassed hidden `<svg>` (`index.html:416-438`;
- **Why it matters.** It corrects two earlier statements:
- **Proposed fix.** The duotone fill is set on the <svg> and inherited through <use> (--icon-duo, --icon-duo-opacity). (Phase 4 gap row ICON-6)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ICON/duo-sprite.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-ICON-03 — `--gold` is used as icon ink on gold tints: six icons at 2.76-2.78:1 in Hearth, while the shell's `--gold-ink` override covers only two heads

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2831`; `apps/design.css:606-608`, `index.html:1203`, `apps/kidverse.html:68`, `apps/f260.html:196`
- **What happens now.** Two recipes paint the base hue `--gold` (`#B4861B` in Hearth) on a gold tint.
- **Why it matters.** One ink repeats on the gold icons across the shell, the TV, Kid Verse and F260. The shell's own fix is applied in one place.
- **Proposed fix.** Icons on gold tints read --butter-ink (the -ink rule). (Phase 4 gap row ICON-3)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ICON/measure.mjs"`, `node "audits/tools/phase4/ICON/report.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-ICON-05 — In the `.ds` apps every icon's own `stroke-width` and `fill` attribute is dead: all compute 1.75, and the "filled" Prayer-warrior heart renders as an outline

- **Area** design system (Prayer) · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2931`; `apps/kidverse.html:144`, `apps/verses.html:99`, `apps/design.css:602`, `apps/verses.html:113-115`
- **What happens now.** Why the attributes lose. Any author CSS rule beats an SVG presentation attribute, and `.ds .icon { fill: none; stroke-width: 1.75 }` (`apps/design.css:602`) is such a rule. Stroke weights.
- **Why it matters.** It corrects P3 Verses' "strokes 1.75 / 2 / 2.25 … mixed" (`audits/03-apps/verses.md:583, 617`). The rendered weights are uniform, and only the markup differs. The badge row pairs a filled star with an outline heart, against the code's intent.
- **Proposed fix.** The .ds icon rule stops overriding stroke-width and fill attributes (vector-effect: non-scaling-stroke with --icon-stroke). (Phase 4 gap row ICON-7)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ICON/facets.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-MOTION-04 — JS smooth scrolls still animate under Reduce Motion: F260 ×8, the build guide ×2, the park map ×1

- **Area** design system (F260, build guide, park map) · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4043`; `apps/design.css:611-613`, `apps/f260.html:476`, `apps/f260.html:1474`, `apps/dollywood.html:1127`
- **What happens now.** The CSS Reduce Motion rules cover transitions and animations only (`apps/design.css:611-613`, `apps/f260.html:476`, `apps/dollywood*.html:139`).
- **Why it matters.** Long animated scrolls are the motion most likely to trouble someone who turned Reduce Motion on, and F260 runs them on every week jump.
- **Proposed fix.** JS smooth scrolls read the reduce-motion state (behavior: "auto" under reduce) in F260, the build guide and the park map.
- **How it will be verified.** Rerun `node "audits/tools/phase4/MOTION/rm-smooth.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-SHAPE-01 — Kid mode keeps adult-sized controls wherever a control is sized in fixed px: the Larder (7 selectors at 44-52 px), the park map (every default-view control under 64, four under 44) and the shell's sidebar tab (195×48 on the iPad landscape and desktop)

- **Area** design system (Larder, park map) · **Type** bug · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2002`; `apps/design.css:281`, `apps/leftovers.html:47`, `apps/design.css:560`, `apps/prayer.html:421`; `audits/screens/leftovers/kid-typical-ipad-portrait-light.png`, `audits/screens/dollywood-live/kid-family-typical-ipad-portrait-light.png`
- **What happens now.** The cause. For kids, design.css sets `--tap: 64px; --tap-lg: 84px` (`apps/design.css:281`, under the comment "Kids: bigger targets", `:279`). Only rules that read `var(--tap)`, or that carry their own kid rule, change. Anything sized in literal px keeps the adult size.
- **Why it matters.** The kids are 4-5 years old. The kid scale was built for them, but it stops at the apps that size in px, and on the Larder the smallest kid target is also the one that changes family data.
- **Proposed fix.** Kid minimum targets outside .ds: a global kid rule sized from var(--tap) for the Larder and the park map (proposal SHAPE-9; open issue 8 names the owner here). (Phase 4 gap row SHAPE-9)
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/verify.mjs"`, `node "audits/tools/phase4/SHAPE/verify-kid-targets-own-css-1.mjs"`, `node "audits/tools/phase4/SHAPE/analyze.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-SHAPE-04 — The shared `hub.toast` is capped at half the viewport, so ordinary messages wrap to two or three lines on the iPhone in the shell, Kid Verse and Verses (added after the completeness critic)

- **Area** design system (Kid Verse, Verses) · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2153`; `apps/hub.js:431-434`, `apps/design.css:588-591`, `index.html:715`, `index.html:340-341`; `audits/evidence/p4/CRITIC/toast-shell-iphone-pwa.png`
- **What happens now.** `hub.toast` (`apps/hub.js:431-434`) builds a `.ds > .toast#hub-toast` in whichever document calls it. `.ds .toast` is `position: fixed; left: 50%; transform: translateX(-50%); … max-width: calc(100% - 32px)` (`apps/design.css:588-591`).
- **Why it matters.** Toasts are the hub's only confirmation surface, and the iPhone is the device the family carries. A narrow two- or three-line pill near the tab bar is harder to read at a glance, and for a kid it covers the next button.
- **Proposed fix.** The shared toast sizes to its content up to --col-narrow, with side margins, not half the viewport. (Phase 4 gap row SHAPE-14)
- **How it will be verified.** Rerun `node "audits/tools/phase4/CRIT/verify-critic-shared-toast-half-viewport-wrap-2-1.mjs"`, `node "audits/tools/phase4/CRIT/verify-critic-shared-toast-half-viewport-wrap-2-2.mjs"`, `node "audits/tools/phase4/CRITIC/toast-wrap.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-TELL-02 — Twelve reachable form fields are under 16 px (build guide 6, park map 3, Larder 2, F260 1), so iOS zooms the page when they take focus

- **Area** design system (F260, Larder, build guide, park map) · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:6083`; `apps/f260.html:399`, `apps/leftovers.html:52-53`, `apps/design.css:293`
- **What happens now.** iOS zooms the page when a text field or select under 16 px takes focus. The viewport correctly leaves zoom enabled: `width=device-width, initial-scale=1, viewport-fit=cover`, with no maximum-scale. The fields:
- **Why it matters.** Searching the park map or setting a rider height on an iPhone at the park zooms the page, and the user has to pinch back before the sheet fits again.
- **Proposed fix.** Every field at --fs-field (≥ 16 px), so iOS never zooms on focus. (Phase 4 gap row TELL-5)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TELL/verify-fields-under-16px-ios-zoom-1.mjs"`, `node "audits/tools/phase4/TELL/tells-chromium.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-TELL-03 — With a named dark theme on a light-OS device, every Hearth-based document paints paper-white Hearth until `hub.js` runs; the flash lasts as long as `hub.js` is late

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:6123`; `apps/hub.js:59`, `sw.js:10`, `index.html:440`, `apps/dollywood.html:2`
- **What happens now.** Setup: light OS, and Midnight stored both in `localStorage` `hub.theme` and in the person row. While `hub.js` has not run, `<html>` has no `data-theme` and no `data-scheme`, so `design.css` resolves the Hearth `:root` tokens. The body is `rgb(247, 242, 235)` (`--bg` `#F7F2EB`). The shell and the TV show a full paper-white screen.
- **Why it matters.** A family member who picked a dark palette for the evening gets a full-screen paper-white frame whenever `hub.js` is slow to arrive.
- **Proposed fix.** The inline <head> bootstrap sets theme, scheme and color-scheme before first paint (bootstrap.js). (Phase 4 gap row TELL-1)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TELL/verify-named-theme-cold-load-flash-1.mjs"`, `node "audits/tools/phase4/TELL/verify-named-theme-cold-load-flash-2.mjs"`, `node "audits/tools/phase4/TELL/flash.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-TELL-04 — On a desktop with classic scrollbars, grey OS bars paint on the hub's scrollers (15 px on `#views` and each app document, 10 px on F260's side column and the build guide's chip strip), and under Midnight on a light OS the track is a white stripe

- **Area** design system (F260, build guide) · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:6175`; `apps/f260.html:450`, `apps/dollywood.html:240-241`, `apps/design.css:15`, `index.html:66`
- **What happens now.** With Chromium's classic scrollbars (Playwright's `--hide-scrollbars` removed):
- **Why it matters.** On a Windows PC, or a Mac with a mouse, the hub shows grey OS scrollbars on its navigation layer, and a white stripe under the dark palettes. Earlier phases passed this tell because the rig hid every bar.
- **Proposed fix.** Thin themed scrollbars (--scrollbar-thumb) on the hub's scrollers; hidden on chrome. (Phase 4 gap row TELL-6)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TELL/verify-classic-scrollbars-on-chrome-2.mjs"`, `node "audits/tools/phase4/TELL/scrollbars.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-TELL-06 — The design system's only overscroll reset is set on `body`, where it has no effect, in every document

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:6266`; `index.html:66`, `apps/design.css:304`, `index.html:21`, `apps/design.css:293`
- **What happens now.** `apps/design.css:304` sets `overscroll-behavior: none` on `body`. The `html` rule (`:293`) sets none. In the rig-v2 raw data, all 3,625 documents where the rig read the value show `html` auto and `body` none. `body` is never a scroll container. In the apps, `html` overflow is visible, so body's overflow propagates to the viewport.
- **Why it matters.** P2 passed this tell "in code" on the strength of this declaration, and six P3 app reports cited it as working. The declaration guards nothing.
- **Proposed fix.** overscroll-behavior on html (base chrome rules), with the page background on html. (Phase 4 gap row TELL-4)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TELL/verify-overscroll-body.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-TOK-01 — The `--focus` ring is under 3:1 in every palette for every profile colour

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:559`; `apps/design.css:102`, `apps/prayer.html:426`, `apps/dollywood.html:226`, `apps/dollywood-live.html:226`
- **What happens now.** `--focus` is `0 0 0 3px color-mix(in srgb, var(--accent) 38%, transparent)` (apps/design.css:102). It is the only focus indicator: `:focus { outline: none }` (:313), then `:focus-visible { box-shadow: var(--focus) }` (:314).
- **Why it matters.** Anyone on a keyboard cannot see where focus is: on the tab bar, the Prayer kid button, the park-map buttons, and (faintly) the inputs.
- **Proposed fix.** Focus becomes an outline in --focus-ring-color (the person's -graphic, ≥ 3:1) with a surface gap (proposal §2.5, TOK row). (Phase 4 gap row TOK-5)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TOK/verify-tok-focus-ring-1.mjs"`, `node "audits/tools/phase4/TOK/verify-tok-focus-ring-2.mjs"`, `node "audits/tools/phase4/TOK/pairs.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### P4-TOK-02 — The on/off `.switch` nearly vanishes when off in the light palettes, and its knob is about 2:1 when on in the dark ones

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:605`; `index.html:1262-1269`, `apps/design.css:462`, `apps/design.css:455-462`, `index.html:1262`
- **What happens now.** The track is `var(--line)` when off and `var(--ok)` when on; the knob is a hardcoded `#fff` (apps/design.css:455-462). The switch sits on a `.card.glass` (index.html:1262), not on `--surface`. The two skeptics' pixel measurements against that card:
- **Why it matters.** This is the control that turns push reminders on. In Hearth, the default, a switched-off switch is barely visible as a control. In the dark palettes the "on" knob fades, though the green track still shows the state.
- **Proposed fix.** The switch reads --switch-off / --switch-off-ring / --switch-knob (≥ 3:1 off and on, both schemes).
- **How it will be verified.** Rerun `node "audits/tools/phase4/TOK/verify-tok-switch-state-1.mjs"`, `node "audits/tools/phase4/TOK/verify-tok-switch-state-2.mjs"`, `node "audits/tools/phase4/TOK/pairs.mjs"` — the defect must no longer reproduce; plus batch 1's checks.

#### UX-DOLLYWOOD-10 — Reset progress is a native `confirm()` that clears all 13 sections, with no undo

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/dollywood.md:696`; `apps/dollywood.html:1098`; `audits/screens/dollywood/progress-menu-typical-desktop-light.png`
- **What happens now.** The dialog reads "Clear all saved progress?". On OK the server's 24 ticks went to 0 and no undo was offered (`apps/dollywood.html:1098`). Reset is styled like Export and Import.
- **Why it matters.** A native confirm and no undo.
- **Proposed fix.** Reset progress uses the shared confirm sheet, styled as destructive, followed by an Undo toast (keep the previous rows for 30 s). (Phase 3: IMP-DOLLYWOOD-P2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### UX-F260-12 — Nothing in F260 is legible across the kitchen

- **Area** f260 · **Type** usability · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/03-apps/f260.md:697`; `audits/screens/f260/today-typical-ipad-portrait-light.png`
- **What happens now.** Nothing in F260 is legible across the kitchen (low). On iPad portrait the largest text reads to about 0.8 m (numbers in §3). Evidence: `layout.json` `devices.ipad-portrait.glance`; `audits/screens/f260/today-typical-ipad-portrait-light.png`.
- **Why it matters.** Nothing in F260 reads across the kitchen.
- **Proposed fix.** The Today card uses the glance roles on the iPad (today's reading at --fs-glance-2). (Phase 3: IMP-F260-I2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### UX-KIDVERSE-8 — Text-only toasts about 96 px tall cover the story card and cannot be dismissed

- **Area** kidverse · **Type** usability · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/kidverse.md:688`; `audits/evidence/p3/kidverse/webtells-toast-over-content.png`, `audits/evidence/p3/kidverse/star-rules-R5-kiara-prayer-warrior.png`
- **What happens now.** The "already" toast sat at 764-859 px (viewport 884) over `#story-kick` and the story head. The "New badge" toast covers the Prayer warrior date and the footnote (from the visual check).
- **Why it matters.** Toasts cover the story card.
- **Proposed fix.** The shared toast (bottom, dismissible) replaces the tall text toasts.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### UX-VERSES-6 — The rating toast sits over the stats card on phones

- **Area** verses · **Type** usability · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/verses.md:537`; `audits/screens/verses/rated-typical-iphone-pwa-light.png`, `audits/evidence/p3/verses/toast-not-yet-box5-iphone.png`
- **What happens now.** The rating toast sits over the stats card on phones (low). The 2.2 s toast covers the "4 days" and "Weekly" box labels and the Due today header, and cannot be dismissed. Evidence: `audits/screens/verses/rated-typical-iphone-pwa-light.png`; `audits/evidence/p3/verses/toast-not-yet-box5-iphone.png`.
- **Why it matters.** The toast covers labels.
- **Proposed fix.** The shared toast sits above the tab bar and never over the stats card.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### UX-VERSES-7 — On the Kitchen iPad only the reference is readable past about 1.5 m

- **Area** verses · **Type** usability · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/verses.md:538`; `audits/screens/verses/trainer-typical-ipad-portrait-light.png`
- **What happens now.** On the Kitchen iPad only the reference is readable past about 1.5 m (low). Reference cap 7.5 mm (about 1.5 m; kid 8.6 mm, about 1.7 m); stat numerals 3.8 mm (about 0.8 m); pill, kicker and labels under 0.5 m. Evidence: `audits/evidence/p3/verses/glance-accent.json`; `audits/screens/verses/trainer-typical-ipad-portrait-light.png`.
- **Why it matters.** Only the reference reads past 1.5 m.
- **Proposed fix.** Glance roles for the reference and counts on the Kitchen iPad.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-ACCENT-1 — The profile colours are neither pastel nor distinct enough as fills: the soft fills are near-grey, and 6 of 21 household pairs sit under ΔE00 5 as fills

- **Area** design system, all areas · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: 'As fills, people run together' is true only of the 14% accent-soft, which is never shown side by side for different people.
- **Evidence.** `audits/04-design-system.md:5682`; `index.html:449`, `worker/seed.sql:4-11`
- **What happens now.** The colours are mid-tones. Every profile colour sits at OKLCH L 0.42-0.65: too dark to be a fill, too light and too grey to be an ink.
- **Why it matters.** Profile colours are near-grey and too close.
- **Proposed fix.** Each person starts with a distinct house pastel family (decision D3); the nine people's colours are CVD-separated (gated ΔE00). The admin may assign any of the 18 (household answer 2026-09-26); an app colour is not CVD-separated from the people's, so the picker's CVD check (GAP-ACCENT-1) warns. (Phase 4 gap row ACCENT-8)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ACCENT/tokens.mjs"`, `node "audits/tools/phase4/ACCENT/cvd-strip.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### VIS-COLOR-1 — The fills and tiles sit at about a third of the house chroma in all five palettes, two house hues are missing, and dark cards barely lift off the page

- **Area** design system, all areas · **Type** visual · **Severity** low · **Effort** M · **Batch** 1
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: The rating is inflated: the item shows no effect on use beyond cosmetic, so it is low, not medium. The bar figure '2.27-2.99' covers only the start stop in the light palettes. Recomputed from tokens it is 1.83-2.98, with gold (the warn fridge bar) lowest at 1.83-1.93.
- **Evidence.** `audits/04-design-system.md:7309`; `apps/design.css:606-608`, `apps/design.css:412`; `audits/screens/shell/apps-typical-ipad-portrait-light.png`, `audits/screens/shell/home-typical-ipad-portrait-light.png`
- **What happens now.** (Table COLOR-8): Soft fills. They sit at the pastels' lightness (L 0.87-0.94, against 0.876-0.953) but at about a third of their chroma (C 0.008-0.070, against 0.057-0.093). Parchment's gold-soft, at 0.070, is the only exception. `--accent-soft` for the ten swatches is 0.004-0.047. Tiles.
- **Why it matters.** This is the house style's central colour rule, and the main reason every area scores 3-5 on Colour & palette.
- **Proposed fix.** The house pastels at full chroma for fills and tiles (pastel-to-saturated tile gradients), both missing hues added, dark cards lifted. (Phase 4 gap row COLOR-8, COLOR-9)
- **How it will be verified.** Rerun `node "audits/tools/phase4/COLOR/palette.mjs"`, `node "audits/tools/phase4/COLOR/tiles.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-DARK-1 — Toasts invert to a light slab in dark, the brightest object on a dark screen

- **Area** design system, all areas · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4903`; `apps/design.css:588-589`, `apps/prayer.html:254-260`
- **What happens now.** The shared toast is `color-mix(var(--text) 90%, transparent)` with `color: var(--bg)` (`apps/design.css:588-589`). In Midnight it renders as a cream #DFD9D1 pill (luminance 0.70) in the shell, Timer, Kid Verse and Verses. Prayer's own toast does the same with `background: var(--dim);
- **Why it matters.** Every confirmation flashes a bright slab at night on the always-on iPad.
- **Proposed fix.** Dark toasts on --toast-bg (a raised dark slab), not an inverted light one. (Phase 4 gap row GLASS-5, DARK-8)
- **How it will be verified.** Rerun `node "audits/tools/phase4/DARK/summary.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### VIS-DOLLYWOOD-3 — The type departs from the house style

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/dollywood.md:722`; `apps/dollywood.html:223`, `apps/design.css:19-20`, `apps/design.css:18`; `audits/screens/dollywood/map-typical-ipad-portrait-light.png`, `audits/screens/dollywood/steps-typical-desktop-dark.png`
- **What happens now.** The h1, stat numbers and card and step titles (28, 17 and 22 px) use `--font-display`, a serif (`apps/dollywood.html:223, 306`; `apps/design.css:19-20`).
- **Why it matters.** Serif titles and rounded body text depart from the house style.
- **Proposed fix.** The template reads the role tokens (large title bold system, numerals rounded) through batch 1's migration aliases, then its own rows.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-DOLLYWOOD-5 — The "step N of M" pill is just under AA in the light palettes

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/dollywood.md:729`; `audits/evidence/p3/dollywood/phone-sheet-half-hearth.png`
- **What happens now.** 11 px text at 4.45:1 in Hearth and 4.37:1 in Parchment; Frost, Midnight and Forest pass.
- **Why it matters.** Just under AA in light palettes.
- **Proposed fix.** The step pill moves to --text-2 on --surface (≥ 4.5:1 in every palette) through the token change.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-DOLLYWOOD-7 — Inner radii are not concentric

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/dollywood.md:736`
- **What happens now.** The basemap select (radius 12) sits in the toolbar (16) at an 11 px inset; the … button (12) sits in the build card (20) at a 15 px inset. Each should be about 5. The checker could not see this at 1× and relied on the JSON.
- **Why it matters.** Inner radii are not concentric.
- **Proposed fix.** Concentric radii through --r-inset / --r-control.
- **How it will be verified.** recapture its screens (capture area dollywood) and compare; plus batch 1's checks.

#### VIS-DOLLYWOOD-12 — The card link buttons keep the 3 px web radius

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/dollywood.md:751`; `apps/dollywood.html:77`, `apps/dollywood.html:79`; `audits/screens/dollywood/coaster-typical-desktop-light.png`, `audits/screens/dollywood/listing-typical-ipad-landscape-dark.png`
- **What happens now.** Web ↗, Photos ↗, Videos ↗ and dollywood.com ↗ are square-cornered grey boxes, beside the 20 px card and the rounded "Zoom to it". The rules `.pop a.btn` and `.info a.btn` set 3 px (`apps/dollywood.html:77, 123-124`) and the coaster track picture too (`apps/dollywood.html:79`); no hub-flavour rule overrides them.
- **Why it matters.** Square web corners beside rounded cards.
- **Proposed fix.** Link buttons take --r-control through the token change.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-DOLLYWOOD-LIVE-7 — The family-marker fallback colour is Elizabeth's colour

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/dollywood-live.md:664`; `apps/dollywood-live.html:1213-1214`, `worker/seed.sql:8`
- **What happens now.** The fallback `#8A6A4B` (`apps/dollywood-live.html:1213-1214, 1302, 1306, 1316, 1547`) is exactly Elizabeth's seed colour (`worker/seed.sql:8`), so a marker with no colour looks like hers. Code only: no capture shows the fallback (checker: "not visible").
- **Why it matters.** An unknown marker looks like Elizabeth.
- **Proposed fix.** The family-marker fallback becomes graphite (the token default), not Elizabeth's colour.
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 1's checks.

#### VIS-F260-2 — Empty progress cells are almost invisible: 1.04:1 in dark, 1.10:1 in light

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Verified (step 3).** was medium; skeptics low and low. Correction: The measurements and the dark-mode description are accurate. The medium rating is inflated: nothing is hidden that the adjacent text does not state, the done state stays well above 3:1, and in light palettes (1.09-1.14) the empty cells are still visible on screen.
- **Evidence.** `audits/03-apps/f260.md:710`; `apps/f260.html:16`; `audits/evidence/p3/f260/vischeck-empty-cells-ipad-landscape-dark.png`, `audits/screens/f260/today-timeout-loading-ipad-landscape-dark.png`
- **What happens now.** Empty progress cells are almost invisible: 1.04:1 in dark, 1.10:1 in light (medium; from the visual check). Unread year-grid weeks, empty heatmap days, unread book-bar segments and the meter track all fill with `--sunk` (`apps/f260.html:16, 65, 77, 83, 92`). Against the page they measure 1.04:1 in System/Midnight dark and 1.10:1 in Hearth light, far below 3:1 for meaningful graphics. On an empty or early plan in dark, the 52-week grid, the heatmap and the book bar read as a blank area. Evidence: `audits/evidence/p3/f260/vischeck-empty-cells.json`; `audits/evidence/p3/f260/vischeck-empty-cells-ipad-landscape-dark.png`; `audits/screens/f260/today-timeout-loading-ipad-landscape-dark.png`; `audits/screens/f260/finished-hero-overflow-ipad-portrait-dark.png`. Run: `node "audits/tools/phase3/f260/vischeck-empty-cells.mjs"`.
- **Why it matters.** Empty progress is invisible.
- **Proposed fix.** Empty cells use --cell-empty (a ≥ 3:1 ring) in every palette. (Phase 3: IMP-F260-P11)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/vischeck-empty-cells.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-F260-10 — Large text wraps the Today meta line on a 430 px iPhone

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/f260.md:718`; `apps/f260.html:50`; `audits/evidence/p3/f260/layout-large-text-iphone.png`
- **What happens now.** Large text wraps the Today meta line on a 430 px iPhone (low). `body.big` (zoom 1.15; `apps/f260.html:50, 2034`) takes "Week 38 · Day 3 · 1 chapter · ~4 min" from 1 line to 2. Evidence: `layout.json` `devices.iphone-pwa.largeText`; `audits/evidence/p3/f260/layout-large-text-iphone.png`.
- **Why it matters.** Large text wraps the meta line.
- **Proposed fix.** Large text becomes the hub text size (decision D17) through --ts-user instead of zoom, so lines reflow.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-F260-11 — The person's accent never reaches F260's content

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/f260.md:719`; `apps/f260.html:58`; `audits/screens/f260/today-typical-iphone-pwa-light.png`
- **What happens now.** The person's accent never reaches F260's content (low). `--accent` differs (Eli #4F5D8C, Mae #BC5A38, Mom #8A6A4B), but Done, the ring and progress are olive rgb(91,129,67) for all three; the accent is only the glass tint on the switch, modal and reading bar (`apps/f260.html:58, 385, 422`). Evidence: `layout.json` `accent`; `audits/screens/f260/today-typical-iphone-pwa-light.png`.
- **Why it matters.** The person's accent never reaches F260.
- **Proposed fix.** Done, the ring and progress read --accent-strong / --progress-fill (the person's colour).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-F260-14 — The Done toast lands on the page title

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/f260.md:727`; `apps/f260.html:416`; `audits/screens/f260/done-toast-typical-ipad-portrait-light.png`
- **What happens now.** The Done toast lands on the page title (low; from the visual check). The dark toast "✓ Acts 6 · next: Acts 7" appears at the top (`apps/f260.html:416`) and covers "F260 Reading Plan" on the iPad. Evidence: `audits/screens/f260/done-toast-typical-ipad-portrait-light.png`.
- **Why it matters.** The toast covers the title.
- **Proposed fix.** The Done toast uses the shared bottom toast.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-GLASS-1 — Glass on glass: the park map's ride card nests three live blurs, and Prayer's sheet blurs over a blurred full-screen veil

- **Area** design system (Prayer, park map) · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:3538`; `apps/prayer.html:234-235`
- **What happens now.** The park map's ride and coaster card `.pop` is live glass (`template.html:451`), and its sticky `.pop-head` and `.pop-act` are each live glass inside it (`:483`, `:486`): three nested layers (`perf.json` `scenes.dlive-ride-card.layers`: `#pop` 796×364, `pop-head` 794×70, `pop-act` 794×62).
- **Why it matters.** Nested blurs muddy what is under them and multiply the cost on the screens families use at the park and in prayer.
- **Proposed fix.** No glass over glass: nested panels inside a glass sheet are solid. (Phase 4 gap row GLASS-11)
- **How it will be verified.** Rerun `node "audits/tools/phase4/GLASS/layers.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### VIS-ICON-1 — Text glyphs and colour emoji stand in for icons in six areas

- **Area** design system, all areas · **Type** visual · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:3031`; `index.html:916`, `apps/f260.html:603-620`, `apps/tally.html:137-140`, `apps/kidverse.html:160`; `audits/screens/f260/milestones-typical-iphone-pwa-light.png`
- **What happens now.** Glyphs render in the OS text font and emoji in the platform's colour set, so they take no token colour, weight or dark variant. Even the split between glyph and emoji depends on the platform: in the rig's WebKit, ⛰ and ✝ render as colour emoji, and repainting them changes 0 px (skeptic 1 of P4-ICON-03).
- **Why it matters.** Glyphs stand in for icons.
- **Proposed fix.** Text glyphs and emoji used as icons become Lucide icons (emoji stay only as people's faces). (Phase 4 gap row ICON-8)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ICON/static.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-KIDVERSE-1 — Day-dot letters, 10 px badge hints and the unearned "50" glyph fail text contrast

- **Area** kidverse · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Verified (step 3).** was medium; skeptics low and low (partly). Correction: The note that 'the checker measured the dark day-letter glyph at 2.79:1 against the card' uses the wrong background. The letter sits on its own dot (--surface-2), so 3.18:1 in Midnight is the correct pair.
- **Evidence.** `audits/03-apps/kidverse.md:700`; `audits/screens/kidverse/kid-stars-typical-iphone-pwa-light.png`, `audits/evidence/p3/kidverse/visual-C-kid-forest-rewards.png`
- **What happens now.** Rendered contrast (lib-vis `contrastSweep`, 430 px, kid and adult): day letters (`--muted-decor` on `--surface-2`) 2.22:1 Hearth, 2.09:1 Parchment, 2.08:1 Frost, 3.18:1 Midnight, 3.11:1 Forest, at 12 px on the kid card and 10 px in the adult panel; badge hints 10 px at 4.37-4.45:1;
- **Why it matters.** They fail text contrast.
- **Proposed fix.** Day letters, badge hints and the unearned glyph read --text-3 on --surface-2 (≥ 4.5:1), at --fs-caption2 minimum. (Phase 3: IMP-KIDVERSE-P2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-KIDVERSE-2 — The today ring and the empty day dots are under 3:1 in both schemes

- **Area** kidverse · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/kidverse.md:704`; `apps/kidverse.html:69`; `audits/screens/kidverse/kid-stars-typical-ipad-landscape-dark.png`, `audits/screens/kidverse/kid-stars-typical-ipad-landscape-light.png`
- **What happens now.** The only cue for today is the `var(--focus)` ring (`apps/kidverse.html:69`): 1.70:1 against the card in light, 1.51:1 in dark. Empty dot discs (`:66`) are 1.20:1 (light) and 1.14:1 (dark). Earned stars float in a mostly invisible strip.
- **Why it matters.** The day strip is nearly invisible.
- **Proposed fix.** The today ring reads --today-ring and empty dots --cell-empty (≥ 3:1). (Phase 3: IMP-KIDVERSE-P2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/kidverse/vischeck-dark-dots.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-KIDVERSE-3 — Unearned badges are near-black blanks in dark mode

- **Area** kidverse · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/kidverse.md:707`; `audits/screens/kidverse/kid-rewards-empty-ipad-portrait-dark.png`, `audits/evidence/p3/kidverse/visual-C-kid-forest-rewards.png`
- **What happens now.** An unearned badge disc is 1.15:1 against its tile and its glyph barely shows, so the rewards card reads as six dark tiles with no visible goal.
- **Why it matters.** Black blanks in dark mode.
- **Proposed fix.** Unearned badges get a ≥ 3:1 outline and a visible glyph in dark.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-KIDVERSE-6 — The story art's background is fixed: a pale panel on dark pages, and two dark slabs on light pages

- **Area** kidverse · **Type** visual · **Severity** low · **Effort** M · **Batch** 1
- **Evidence.** `audits/03-apps/kidverse.md:716`; `audits/screens/kidverse/kid-typical-desktop-dark.png`, `audits/evidence/p3/kidverse/visual-C-kid-midnight-top.png`
- **What happens now.** The scene SVGs carry their own full-bleed background (for example `art/story/12-church.svg:2`, `#DCECEA`). Loaded as `<img>`, no theme token reaches them, and the pale block glares on Midnight and Forest (688 px wide on desktop and iPad).
- **Why it matters.** A pale panel glares on dark pages.
- **Proposed fix.** Story art sits on --art-plate; scripts/make-art.mjs emits token-friendly fills (a dark variant). (Phase 3: IMP-KIDVERSE-F5)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-KIDVERSE-7 — 10 px text, adult-sized 12 px captions in kid mode, and serif big numerals

- **Area** kidverse · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/kidverse.md:720`; `apps/kidverse.html:86`, `apps/design.css:280-284`, `apps/kidverse.html:62`, `apps/design.css:19-20`; `audits/screens/kidverse/kid-rewards-typical-iphone-pwa-light.png`, `audits/screens/kidverse/kid-stars-overflow-ipad-portrait-light.png`
- **What happens now.** Badge hints (`apps/kidverse.html:86`) and adult panel dot letters (`:110`) are 10 px, below the 11 px floor.
- **Why it matters.** 10 px text and serif numerals in kid mode.
- **Proposed fix.** Kid mode reaches every role (--fs-floor 16) and numerals are rounded.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-KIDVERSE-8 — Glass is used on content, and the story buttons are not concentric

- **Area** kidverse · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/kidverse.md:725`; `apps/kidverse.html:147`; `audits/screens/kidverse/kid-typical-ipad-portrait-light.png`, `audits/screens/kidverse/adult-typical-iphone-pwa-light.png`
- **What happens now.** Backdrop blur(18px) on `.scene.glass-strong` (a 398×274 content card, `apps/kidverse.html:147`), the static `#who` pill (`:146`) and the non-floating `#say` / `#story-say` `.btn-glass` buttons (`:159, 172`).
- **Why it matters.** Glass on content.
- **Proposed fix.** Scene and story cards become solid material; radii concentric.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-KIDVERSE-10 — No touch-callout suppression on the story art, and card chrome text is selectable

- **Area** kidverse · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/kidverse.md:732`
- **What happens now.** `#art` has no `-webkit-touch-callout` and is draggable; the pill, stars card and badges are `user-select: text`; only `.btn` is `none`.
- **Why it matters.** Long-press menus on the art.
- **Proposed fix.** -webkit-touch-callout: none and user-select: none on the art and chrome (batch-1b base chrome rules).
- **How it will be verified.** recapture its screens (capture area kidverse) and compare; plus batch 1's checks.

#### VIS-LEFTOVERS-2 — The amber freshness bar is under 3:1 against its track in Hearth and Parchment; the state tints are close under colour-blindness

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/leftovers.md:809`; `apps/leftovers.html:80`, `apps/leftovers.html:78-80`; `audits/evidence/p3/leftovers/visual-hearth-ipad.png`, `audits/evidence/p3/leftovers/visual-parchment-ipad.png`
- **What happens now.** Bar tint against track (non-text): warn 2.69 (Hearth), 2.83 (Parchment), 3.19 (Frost); urgent and fresh 3.56-3.99 in the light palettes.
- **Why it matters.** The warn bar is under 3:1.
- **Proposed fix.** The freshness ramp reads --fresh / --aging / --use-soon (graphic roles, ≥ 3:1), with a glyph per state for colour-blind viewers. (Phase 3: IMP-LEFTOVERS-P7)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-LEFTOVERS-3 — In the dark palettes the status chips lose their pill: the fill stands 1.01-1.08:1 from the card

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/leftovers.md:817`; `apps/leftovers.html:82`; `audits/evidence/p3/leftovers/visual-midnight-ipad.png`, `audits/screens/leftovers/main-typical-ipad-portrait-dark.png`
- **What happens now.** The chip fills are `*-soft` tokens that are near-black in Midnight and Forest, so "Use it up" reads as loose pink text rather than a glowing pastel pill. That breaks the house "never muddy" rule.
- **Why it matters.** Chips lose their pill in dark.
- **Proposed fix.** Chips on --X-fill with -ink labels (dark fills ≥ 1.5:1 from the card).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-LEFTOVERS-7 — The empty-state fridge art is a pale hard-coded SVG that stands out in dark mode

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/leftovers.md:838`; `apps/leftovers.html:224`; `audits/screens/leftovers/main-empty-ipad-portrait-dark.png`
- **What happens now.** `art/empty/fridge.svg` is loaded as an `<img>` (`apps/leftovers.html:224`), so tokens cannot reach its pale fills (`art/empty/fridge.svg:2, 6`).
- **Why it matters.** Pale art glares in dark.
- **Proposed fix.** Empty-state art sits on --art-plate (token-friendly art from make-art.mjs).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-LEFTOVERS-10 — In dark mode the ✓ buttons are black recessed wells

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/leftovers.md:852`; `apps/leftovers.html:83`; `audits/screens/leftovers/main-typical-ipad-portrait-dark.png`, `audits/evidence/p3/leftovers/visual-forest-ipad.png`
- **What happens now.** The ✓ uses `--surface-2` (`apps/leftovers.html:83`), which is darker than the card in the dark palettes, so the main action looks like a hole rather than a glowing control.
- **Why it matters.** Dark wells.
- **Proposed fix.** The ✓ uses --accent-fill with the ink glyph in dark (a lit control, not a well).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-PRAYER-4 — Family mode only half re-themes

- **Area** prayer · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/prayer.md:903`; `apps/prayer.html:39`; `audits/screens/prayer/today-family-typical-iphone-pwa-light.png`
- **What happens now.** Family mode only half re-themes (low). `body.shared` rebinds `--accent` and `--accent-soft` to teal but not `--accent-deep` (`apps/prayer.html:39`), so the switch and nav turn teal while Pray now, the + and the chips keep the person's colour. Evidence: `audits/evidence/p3/prayer/contrast.json` (`accents.eliFamilyMode`); `audits/screens/prayer/today-family-typical-iphone-pwa-light.png`.
- **Why it matters.** Family mode half re-themes.
- **Proposed fix.** Family mode sets data-accent="aqua" on the page, re-deriving every accent role. (Phase 3: IMP-PRAYER-P10)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-PRAYER-7 — Offline, Prayer loses its typeface

- **Area** prayer · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/prayer.md:906`; `apps/prayer.html:12-14`, `sw.js:36`; `audits/screens/prayer/kid-offline-ipad-portrait-light.png`, `audits/screens/prayer/today-offline-iphone-pwa-light.png`
- **What happens now.** Offline, Prayer loses its typeface (low). Manrope and Instrument Serif load from Google Fonts (`apps/prayer.html:12-14`), and the service worker skips cross-origin requests (`sw.js:36`). The visual checker saw the fallback face in the offline captures. Evidence: `audits/screens/prayer/kid-offline-ipad-portrait-light.png`; `audits/screens/prayer/today-offline-iphone-pwa-light.png`.
- **Why it matters.** Offline Prayer loses its fonts.
- **Proposed fix.** Move to the system stack (decision D13) so offline keeps the typeface.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-PRAYER-10 — Delete in the detail sheet is not styled as destructive

- **Area** prayer · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/prayer.md:909`; `audits/screens/prayer/detail-typical-ipad-portrait-light.png`, `audits/screens/prayer/ask-delete-typical-iphone-pwa-light.png`
- **What happens now.** Delete in the detail sheet is not styled as destructive (low; from the visual check). "Delete" is the same flat outlined button as "Edit"; terra appears only on the follow-up confirm. Evidence: `audits/screens/prayer/detail-typical-ipad-portrait-light.png`; `audits/screens/prayer/ask-delete-typical-iphone-pwa-light.png`.
- **Why it matters.** Delete looks like Edit.
- **Proposed fix.** Delete uses the destructive button role (--danger-ink).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-PROF-a1 — The PIN dots are mocha, not the person's colour

- **Area** shell / platform · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/02-shell.md:978`; `index.html:58`; `audits/evidence/p2/VIS/leads-pin-dots-mae.png`
- **What happens now.** Filled dots render as rgb(138,106,75) for Mea, whose colour is #5B8143.
- **Why it matters.** The pad does not say whose it is.
- **Proposed fix.** The PIN dots fill with the chosen person's `--accent-strong` (data-accent on the pad), not the signed-out fallback.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-SHAPE-1 — Concentric corners are impossible by construction; at least 58 of 99 container/child pairs are off

- **Area** design system, all areas · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2208`; `apps/design.css:381-383`; `audits/evidence/p4/SHAPE/sheet-concentric.png`
- **What happens now.** The root cause is in design.css. `.card` is R22 with 20 px padding and a 1 px border, an inset of 21 (`apps/design.css:381-383`), and `.btn` is r16 (`:352`). Concentric would need r1, so every button in a card is 15 px off.
- **Why it matters.** Mismatched nested corners are one of the clearest tells between the hub and first-party iPadOS surfaces, and design.css produces them by default.
- **Proposed fix.** Concentric by construction (--r-card = --r-control + --pad-card; --r-inset). (Phase 4 gap row SHAPE-5)
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/verify.mjs"`, `node "audits/tools/phase4/measure/page-lib.mjs"`, `node "audits/tools/phase4/SHAPE/remeasure.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-SHAPE-2 — The shell and the build guide keep the phone's 16 px margins on the iPad; F260 drops to 22 px in landscape, and its week stripes paint 7 px from the iPhone edge

- **Area** design system (F260, build guide) · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:2245`; `index.html:66-67`, `apps/f260.html:466`; `audits/evidence/p4/SHAPE/verify-margins-shell-ipad-portrait.png`, `audits/screens/dollywood/map-typical-ipad-portrait-light.png`
- **What happens now.** The shell. `#views` pads with `--sp-4` at every width below 1024 px (`index.html:66-67`), so Home, Apps and Me sit 16 px from the edge of an 820 px iPad. Inside the same shell, the apps sit 66-230 px in. The build guide also sits at 16 px on the iPad portrait and landscape.
- **Why it matters.** On the primary device the shell looks like a stretched phone layout, while the apps inside it are inset. On the phone, F260's stripes nearly touch the screen edge.
- **Proposed fix.** Margins by size class (16/20/28/32) from --margin with safe areas.
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/verify.mjs"`, `node "audits/tools/phase4/SHAPE/remeasure.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-TALLY-1 — In every dark palette the dial and the +/− buttons barely stand out from the page

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: The item presents 3:1 as the target the disc fill fails. But the + and − glyphs identify the buttons at 11-14:1, so the fill-to-wash ratio is not the WCAG 1.4.11 measure, and the buttons do not 'barely stand out' in practice. They are plainly visible as discs, only low in luminance contrast.
- **Evidence.** `audits/03-apps/tally.md:517`; `apps/tally.html:26-31`; `audits/evidence/p3/tally/theme-system-darkos-eli.png`, `audits/screens/tally/main-typical-ipad-portrait-dark.png`
- **What happens now.** The glass discs are near-black brown on a dark accent wash. The button fill measures: − against the wash: 1.13-1.45:1 (Midnight, System-dark, Forest);
- **Why it matters.** The dial and buttons vanish in dark.
- **Proposed fix.** Discs tinted from the accent family in dark (≥ 3:1 against the wash). (Phase 3: IMP-TALLY-P6)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/themes.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-TALLY-3 — The count is in the serif display face, not ui-rounded, in adult and kid mode

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/tally.md:532`; `apps/tally.html:58`, `apps/design.css:19-20`; `audits/screens/tally/main-typical-iphone-pwa-light.png`, `audits/screens/tally/kid-typical-iphone-pwa-light.png`
- **What happens now.** `.count` uses `var(--font-display)` (`apps/tally.html:58`), which is `var(--font-serif)` (`apps/design.css:19-20`).
- **Why it matters.** A serif count.
- **Proposed fix.** The count reads --font-numeral (rounded) with tabular figures. (Phase 3: IMP-TALLY-P3)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-TALLY-5 — In light mode several control discs fall under 3:1 against the wash

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/tally.md:541`; `audits/screens/tally/kid-typical-ipad-portrait-light.png`
- **What happens now.** The − disc is 2.24-2.85:1 for Mae, Mom, Mea, Ezra and Kiara in System light, and 2.24-2.33 for Kiara across Parchment, System and Frost.
- **Why it matters.** Discs fade into the wash.
- **Proposed fix.** Light discs reach 3:1 against the wash (--accent-fill-strong edge). (Phase 3: IMP-TALLY-P6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-TALLY-7 — The press states may never show on iPhone or iPad

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/tally.md:550`; `apps/tally.html:82`, `apps/tally.html:80-82`
- **What happens now.** The only tap feedback is the `:active` scale of .94 and .96 (`apps/tally.html:82, 108`). iOS Safari applies `:active` to a tap only when the page has a `touchstart` listener, and `grep -n "touchstart\|pointerdown" apps/tally.html apps/hub.js` finds none.
- **Why it matters.** Press states may never show on iPhone or iPad.
- **Proposed fix.** The global .pressable press state works on iOS (a passive touchstart listener in hub.js). (Phase 3: IMP-TALLY-P7)
- **How it will be verified.** recapture its screens (capture area tally) and compare; plus batch 1's checks.

#### VIS-TALLY-9 — Glass is on the content dial as well as the controls: five backdrop-filter layers

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/tally.md:561`; `apps/tally.html:51`, `apps/tally.html:45-51`, `apps/design.css:388-403`; `audits/screens/tally/main-typical-iphone-pwa-light.png`
- **What happens now.** `.dial`, both `.tbtn` buttons, `.who` and `.btn.reset` each carry `backdrop-filter: blur(var(--blur)) saturate(1.4)` (`apps/tally.html:51, 79, 104`). There is nothing to blur behind the dial except the gradient wash.
- **Why it matters.** Five glass layers on content.
- **Proposed fix.** The dial becomes solid material; glass stays on the controls.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-TIMER-3 — The selected preset chip is drawn at half its neighbours' contrast, so it reads as disabled

- **Area** timer · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/timer.md:365`; `apps/timer.html:44`; `audits/evidence/p3/timer/visual-idle-midnight-ipad.png`, `audits/screens/timer/idle-typical-ipad-landscape-light.png`
- **What happens now.** The selected preset chip is drawn at half its neighbours' contrast, so it reads as disabled (low). `.on` is `--accent-deep` on `--accent-soft` (`apps/timer.html:44`): 5.76-7.79:1 against 14.16-14.68:1 for the unselected chips in all five palettes. It passes AA, but in dark mode it reads as a grey pill. Evidence: `audits/evidence/p3/timer/visual.json` (V1), `audits/evidence/p3/timer/visual-idle-midnight-ipad.png`, `audits/screens/timer/idle-typical-ipad-landscape-light.png`, `audits/screens/timer/idle-empty-iphone-pwa-dark.png`.
- **Why it matters.** The selected chip reads as disabled.
- **Proposed fix.** Selected preset uses --sel-fill-strong / --sel-ink-strong (≥ 3:1) plus weight.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-TIMER-6 — The dial is a Liquid Glass pane, although it is content

- **Area** timer · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/timer.md:368`; `apps/timer.html:54`; `audits/screens/timer/running-typical-desktop-dark.png`
- **What happens now.** The dial is a Liquid Glass pane, although it is content (low). `#dial` carries `glass` (`apps/timer.html:54`), computed `backdrop-filter: blur(18px) saturate(1.4) brightness(1.02)`; the house style keeps glass for navigation and controls. The rig paints no blur, but the top sheen is visible (`audits/screens/timer/running-typical-desktop-dark.png`). Evidence: `visual.json` V2.
- **Why it matters.** Glass on content.
- **Proposed fix.** The dial becomes solid material.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-TIMER-7 — The ring track is nearly invisible: 1.4:1 in light and 1.2:1 in dark against the dial

- **Area** timer · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/timer.md:369`; `apps/timer.html:28`; `audits/screens/timer/running-typical-desktop-dark.png`, `audits/screens/timer/running-offline-ipad-landscape-dark.png`
- **What happens now.** The ring track is nearly invisible: 1.4:1 in light and 1.2:1 in dark against the dial (low; from the visual check). The unfilled part of the ring is `color-mix(accent 16%, surface-2)` (`apps/timer.html:28`); measured at 1.39:1 in Hearth and 1.2:1 in the dark palette, under the 3:1 minimum for graphics. In dark the ring reads as a floating arc, so the proportion left is hard to judge at a glance. Evidence: `audits/tools/phase3/timer/vischeck-track.mjs` → `audits/evidence/p3/timer/vischeck-track.json`; `audits/screens/timer/running-typical-desktop-dark.png`, `audits/screens/timer/running-offline-ipad-landscape-dark.png`.
- **Why it matters.** The track is nearly invisible.
- **Proposed fix.** The ring track reads --progress-track (≥ 1.5:1 visible) and the arc --progress-fill. (Phase 3: IMP-TIMER-P10)
- **How it will be verified.** Rerun `node "audits/tools/phase3/timer/vischeck-track.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-VERSES-2 — The trainer and done cards are live glass on content, outside the perf guard

- **Area** verses · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/verses.md:545`; `apps/verses.html:103`, `apps/design.css:388`; `audits/evidence/p3/verses/visual-hearth-iphone.png`, `audits/screens/verses/kid-offline-ipad-portrait-dark.png`
- **What happens now.** The trainer and done cards are live glass on content, outside the perf guard (low). `#trainer` and `#done` are `.card.glass-strong` (`apps/verses.html:103, 119`), computed `backdrop-filter: blur(18px) saturate(1.4) brightness(1.02)` in every theme; the scroll-page guard strips blur only from `.card.glass` (`apps/design.css:388, 400`). The checker saw the sheen gradient in the captures; the blur itself is from code (rig limit). Evidence: `audits/evidence/p3/verses/visual.json`; `audits/evidence/p3/verses/visual-hearth-iphone.png`; `audits/screens/verses/kid-offline-ipad-portrait-dark.png`.
- **Why it matters.** Live glass on content in a scroller.
- **Proposed fix.** The trainer and done cards become solid material (--material-solid-bg).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-VERSES-3 — "Got it" fails AA in Hearth (4.4:1)

- **Area** verses · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/verses.md:546`; `apps/verses.html:59`; `audits/evidence/p3/verses/visual-hearth-iphone.png`
- **What happens now.** "Got it" fails AA in Hearth (4.4:1) (low). White 18 px / 600 text on `var(--olive)` (`apps/verses.html:59`); 18 px at 600 is not large text. The other four palettes pass (minimum 4.96). Evidence: `audits/evidence/p3/verses/visual.json` (`hearth.fails`); `audits/evidence/p3/verses/visual-hearth-iphone.png`. Run `node "audits/tools/phase3/verses/visual.mjs"`.
- **Why it matters.** The most-tapped control fails AA in Hearth.
- **Proposed fix.** "Got it" becomes --success-strong with its -on label (≥ 4.76:1) in every palette.
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/visual.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-VERSES-4 — Light-mode primaries invert the house fill/ink rule

- **Area** verses · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/verses.md:547`; `apps/verses.html:59`; `audits/screens/verses/trainer-typical-iphone-pwa-light.png`, `audits/screens/verses/practise-anyway-typical-iphone-pwa-light.png`
- **What happens now.** Light-mode primaries invert the house fill/ink rule (low; from the visual check). In light mode Show is a deep fill in the person's accent with white text (navy for Eli, brown for Elizabeth, dark teal for Ezra), and Got it is olive with white text (`apps/verses.html:59, 110`). Dark mode already does the house thing (pastel periwinkle or aqua with dark ink), so the two modes disagree. Evidence: `audits/screens/verses/trainer-typical-iphone-pwa-light.png`; `audits/screens/verses/practise-anyway-typical-iphone-pwa-light.png`; `audits/screens/verses/kid-typical-ipad-portrait-light.png`; `audits/screens/verses/trainer-typical-ipad-landscape-dark.png`.
- **Why it matters.** Inverted fill/ink.
- **Proposed fix.** Light primaries follow the pairing rule (--accent-strong / --accent-on) (decision D15).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-VERSES-5 — Two weights of the display face on one card

- **Area** verses · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/verses.md:548`; `apps/verses.html:38`, `apps/verses.html:64`, `apps/design.css:306`; `audits/screens/verses/trainer-typical-iphone-pwa-light.png`, `audits/screens/verses/done-typical-iphone-pwa-light.png`
- **What happens now.** Two weights of the display face on one card (low; from the visual check). The reference is serif at weight 400 (`apps/verses.html:38`); "All done for today" and "Nothing to train yet" use the same face at a similar size but inherit bold from the `h2` rule (`apps/verses.html:64`; `apps/design.css:306`). Evidence: `audits/screens/verses/trainer-typical-iphone-pwa-light.png`; `audits/screens/verses/done-typical-iphone-pwa-light.png`; `audits/screens/verses/trainer-empty-iphone-pwa-light.png`.
- **Why it matters.** Two weights of the serif.
- **Proposed fix.** One display weight (the bold system title) per card.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-VERSES-7 — In dark palettes the Not yet and Almost fills turn muddy and the low-box bars nearly vanish

- **Area** verses · **Type** visual · **Severity** low · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/verses.md:550`; `audits/evidence/p3/verses/visual-midnight-iphone.png`, `audits/evidence/p3/verses/visual-forest-iphone.png`
- **What happens now.** In dark palettes the Not yet and Almost fills turn muddy and the low-box bars nearly vanish (low). The soft terra and gold fills become dark browns that almost merge with the card; the Daily and 2-day bars and the box chips are dark on dark. The checker supported this in Midnight and Forest. Evidence: `audits/evidence/p3/verses/visual-midnight-iphone.png`; `audits/evidence/p3/verses/visual-forest-iphone.png`; `audits/screens/verses/kid-revealed-typical-ipad-landscape-dark.png`; `audits/screens/verses/trainer-typical-ipad-landscape-dark.png`.
- **Why it matters.** Muddy dark fills.
- **Proposed fix.** Dark fills from the pastel family (deep tints, not browns) through the token change.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### CONS-GLASS-3 — The sheen's tilt drift never runs on iPad or iPhone

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** info · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:3531`; `apps/hub.js:449`, `apps/hub.js:449-451`
- **What happens now.** hub.js registers the `deviceorientation` listener only when `DeviceOrientationEvent.requestPermission` is not a function (`apps/hub.js:449`). iOS and iPadOS Safari define that function, so on the target devices the sheen follows scroll only. CLAUDE.md says the sheen "drifts with scroll/tilt".
- **Why it matters.** Minor, but the documented behaviour is not what the family's devices do. If the drift is kept, P4-GLASS-01 should be fixed first.
- **Proposed fix.** The tilt drift is removed (it never runs on iPad or iPhone) (info).
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-MOTION-2 — F260, Prayer, the Dollywood template, Kid Verse and the Larder use no duration tokens: 93 literal durations, two different overshoot "springs"

- **Area** design system (F260, Prayer, Larder, Kid Verse) · **Type** visual (consistency) · **Severity** info · **Effort** M · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4108`; `index.html:328`, `apps/design.css:105-109`
- **What happens now.** Token share of durations (Table MOTION-1; exact in the re-measure): Token areas: design.css 21/24, shell 19/23, Tally 5/5, Timer 5/7, Verses 2/3.
- **Why it matters.** The same gesture feels different app to app, and a retune of the tokens would reach only five areas.
- **Proposed fix.** Literal durations move to the --dur-*/--spring-* tokens app by app (lint row) (info).
- **How it will be verified.** Rerun `node "audits/tools/phase4/MOTION/static-motion.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### CONS-MOTION-5 — Reduce Motion is handled five ways and converges only because design.css's rule is global

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** info · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4161`; `apps/design.css:611-613`, `apps/f260.html:476`, `apps/prayer.html:384`, `apps/hub.js:442`
- **What happens now.** design.css has a global rule: `*, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition: none !important; }` (`apps/design.css:611-613`). Every file links design.css (`apps/*.html`, `<link rel="stylesheet" href="design.css">`; the Dollywood exports at `:683`).
- **Why it matters.** Five copies drift. The next app that does not link design.css, or scopes its rule, loses Reduce Motion silently, and JS motion is already missed (P4-MOTION-04).
- **Proposed fix.** Reduce Motion handled once (data-motion + mirror + the re-keyed global rule) (info).
- **How it will be verified.** Rerun `node "audits/tools/phase4/MOTION/reduced-motion.mjs"`, `node "audits/tools/phase4/MOTION/park-live.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-MOTION-2 — There are no springs: every curve is a fixed-duration bezier, and keyframe entrances restart when interrupted

- **Area** design system, all areas · **Type** feature gap · **Severity** info · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4200`; `index.html:327-330`, `apps/design.css:567`, `apps/design.css:105-109`
- **What happens now.** The curves. All 11 bezier curves in use are fixed-duration (Table MOTION-2). `--spring` overshoots 5.3 % and reaches 90 % at 34.4 % of its time; F260 and Prayer's (.3,1.6,.5,1) overshoots 11 %.
- **Why it matters.** It is the most visible "web page" tell in motion. Apple's sheets and zooms follow the finger and reverse mid-flight.
- **Proposed fix.** Spring curves as linear() tokens (--spring-snappy/-gentle/-bouncy) (info).
- **How it will be verified.** Rerun `node "audits/tools/phase4/MOTION/curves.mjs"`, `node "audits/tools/phase4/MOTION/interrupt.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### GAP-TOK-9 — 3 tokens are unused, 3 are used only by the style guide, and 5 are exact aliases

- **Area** design system, all areas · **Type** feature gap · **Severity** info · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:828`; `apps/dollywood.html:213`, `apps/design.css:41`
- **What happens now.** Unused anywhere: `--info`, `--shadow-sm`, `--dur`.
- **Why it matters.** Dead tokens.
- **Proposed fix.** Retire the three unused tokens and the exact aliases once the lint finds no reader (info). (Phase 4 gap row TOK-21)
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 1's checks.

#### VIS-F260-16 — The glass modal is transparent enough that rows beneath collide with its buttons

- **Area** f260 · **Type** visual · **Severity** info · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/f260.md:729`; `audits/screens/f260/practice-overflow-desktop-light.png`, `audits/screens/f260/reset-confirm-typical-iphone-pwa-dark.png`
- **What happens now.** The glass modal is transparent enough that rows beneath collide with its buttons (info, provisional; from the visual check). In the practice modal, "DAY 2 Revelation 2-3" and a check disc show through beside "Close". The rig paints no backdrop blur, so a device may differ. Evidence: `audits/screens/f260/practice-overflow-desktop-light.png`; `audits/screens/f260/reset-confirm-typical-iphone-pwa-dark.png`.
- **Why it matters.** Rows show through the modal.
- **Proposed fix.** Modals use --material-chrome-bg at the proposed 90 % alpha (info).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### VIS-TALLY-11 — The chosen theme barely reaches Tally

- **Area** tally · **Type** visual · **Severity** info · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/tally.md:568`; `audits/evidence/p3/tally/theme-forest-lightos-eli.png`, `audits/evidence/p3/tally/theme-midnight-lightos-eli.png`
- **What happens now.** The wash is always the person's colour, so Forest (deep green, gold ink) renders almost exactly like Midnight: a navy wash, cream ink and a slight green-grey tint on the discs.
- **Why it matters.** The theme barely reaches Tally.
- **Proposed fix.** The wash follows the palette (Forest's gold radial) as well as the person (info).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 1's checks.

#### P2-PWA-07 — Hearth paints Midnight on a device in dark mode — pointer

- **Area** shell / platform · **Type** bug · **Severity** medium (pointer) · **Effort** S · **Batch** 1
- **Evidence.** `audits/02-shell.md:5065`; `index.html:203`, `apps/hub.js:74`
- **Proposed fix.** Pointer to P2-VIS-03.

#### P4-ACCENT-02 — The raw profile colour is used as small text in Prayer's Kitchen headings and the park map's walk times and distances; no single hex can pass in both schemes, so it fails for every adult in one scheme or the other

- **Area** design system (Prayer, park map) · **Type** bug · **Severity** medium (pointer) · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:5369`; `apps/prayer.html:39`, `apps/hub.js:80`, `apps/prayer.html:359`, `apps/prayer.html:1551-1555`
- **Proposed fix.** Pointer to P4-COLOR-02. (Phase 4 gap row ACCENT-2)

#### P4-ACCENT-03 — Me → Switch is pale ink on a white pill in every dark scheme: 1.99-2.49:1 for every adult (1.76-2.56 over all household colours)

- **Area** design system, all areas · **Type** bug · **Severity** medium (pointer) · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:5441`; `apps/design.css:176-177`, `apps/design.css:423`, `index.html:1252-1253`, `apps/design.css:170`
- **Proposed fix.** Pointer to P4-COLOR-03. (Phase 4 gap row ACCENT-4)

#### P4-DARK-01 — The raw profile colour is painted as text and as the Timer arc in dark: Prayer's Kitchen headings 2.83:1 and the park map's walk time 2.14-2.57:1 for Eli and David; the Timer arc 2.1-2.7:1

- **Area** design system (Prayer, Timer, park map) · **Type** bug · **Severity** medium (pointer) · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4571`; `apps/hub.js:80`, `apps/design.css:86`, `apps/design.css:170`, `apps/prayer.html:359`
- **Proposed fix.** Pointer to P4-COLOR-02 (text) and P4-ACCENT-04 (the Timer arc). (Phase 4 gap row DARK-3)

#### GAP-DARK-3 — The focus-ring token is below 3:1 in every theme

- **Area** design system, all areas · **Type** feature gap · **Severity** low (pointer) · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4886`; `apps/design.css:102`, `apps/prayer.html:96`
- **Proposed fix.** Pointer to P4-TOK-01. (Phase 4 gap row DARK-7)

#### P4-DARK-03 — Native controls take their colours from the OS, not the chosen theme: F260's week-note Copy button reads 1.01-1.08:1 in Midnight or Forest on a light OS, and 2.58-2.92:1 in Parchment or Frost on a dark OS

- **Area** design system (F260) · **Type** bug · **Severity** low (pointer) · **Effort** S · **Batch** 1
- **Evidence.** `audits/04-design-system.md:4720`; `apps/design.css:15`, `apps/f260.html:1297`, `apps/f260.html:45`
- **Proposed fix.** Pointer to P4-COLOR-04. (Phase 4 gap row DARK-1)

#### VIS-KIDVERSE-4 — Moved to P3-KIDVERSE-14

- **Area** kidverse · **Type** visual · **Severity** low (pointer) · **Effort** S · **Batch** 1
- **Evidence.** `audits/03-apps/kidverse.md:710`; `apps/kidverse.html:55`, `apps/design.css:89`; `audits/evidence/p3/kidverse/verify-critic-star-buttons-not-gold-5-1-ezra-hearth-done.png`, `audits/evidence/p3/kidverse/visual-C-kid-midnight-top.png`
- **Proposed fix.** Pointer to P3-KIDVERSE-14. (Phase 3: IMP-KIDVERSE-P4)

### Batch 2a — Hub shell: Home, Apps, Me, Chat, profiles; the Kitchen device (56 + 1 household work)

#### KITCHEN-2 — Kitchen device, shell half: no picker, no Me tab, the family apps only, and a face-tap sheet for credit

- **Area** shell / platform (Kitchen device) · **Type** household work (P5-D5 as answered) · **Effort** M · **Batch** 2a
- **Evidence.** `audits/05-decisions.md:42`; `index.html:478-481`, `index.html:1704-1706`, `apps/prayer.html:1599-1601`, `worker/src/index.js:549`
- **What happens now.** A paired device with no stored session opens on the profile picker (`index.html:1704-1706`), and Switch returns any device to it; the Apps list is per person, with the kiosk seeing none (`index.html:478-481`). An action that credits someone credits the signed-in person: Prayed adds `hub.profile.name` (`apps/prayer.html:1599-1601`). Admin → Devices can only unpair (`worker/src/index.js:549`).
- **Why it matters.** This is what the family sees on the counter iPad all day. It replaces the idle return that P2-PROF-09 proposed: with no personal sign-in on the Kitchen iPad, there is nothing to time out.
- **Proposed fix.**
  - A kitchen device never shows the picker: at boot and after any 401 the shell asks `GET /api/device` (KITCHEN-1) and, on a kitchen device, signs in as the kitchen. It opens on a kitchen Home (the calm, glanceable layout of UX-HOME-1: the running timer, food to eat soon, today's family prayers, reminders) with no Me tab and no Chat tab.
  - Its Apps list is fixed: Larder, Prayer (the family list only, adult-sized: no private lists), Timer and Tally. `visibleApps` gets a kitchen branch next to the kiosk's (`index.html:478-481`). The family album is a Home card with an Add button.
  - `hub.whoDidThis()`: a sheet with a row of the household's faces, no PIN, returning the chosen profile. Prayer's Prayed shows everyone in the household, kids included; the Larder's finish and the album's Add show the adults only (P5-D2; the album admits adults today). They send the chosen person instead of `hub.profile`. It is attribution, not a sign-in: nothing else changes hands. Prayer changes only in data code (its layout and ids stay, CLAUDE.md); the sheet is the SDK's overlay.
  - Admin → Devices gains "Kitchen" per device, set and cleared only from the admin panel on Eli's own devices, confirmed with the admin PIN (KITCHEN-1's endpoint). The kitchen device itself has no way in to admin, as the decision says.
  - CLAUDE.md in the same commit: the kitchen shell in "How the hub works" and the kitchen device in "Admin operations".
- **How it will be verified.** `test-kitchen.mjs` (UI half): no picker and no Me or Chat tab at 390, 820 and 1280; only the four apps; Prayed, finish and the album's Add open the face sheet, and the chosen person shows on another device's list and in the feed; the Larder's sheet has no kids; the kitchen is in no other device's picker; the role set while the iPad holds Eli's session moves it to the kitchen Home on its next request, with no picker; clearing the role puts it on the picker on its next request, and it can no longer act as the kitchen; setting and clearing the role from Admin → Devices refuses a wrong PIN; capture rig: a kitchen state for the shell area (`--area shell`), into the batch 2a after-run folder; plus batch 2a's checks.

#### P2-HOME-01 — A half-typed family reminder is erased by the routine 30 s pull

- **Area** shell / platform · **Type** bug · **Severity** high · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:264`; `apps/hub.js:342`, `apps/hub.js:311`, `index.html:1243`, `index.html:1200-1207`
- **What happens now.** Every successful pull sets `lastPull: Date.now()`, whether or not any row changed (`apps/hub.js:311`). The shell's `onSync` handler then calls `renderHome()` whenever `lastPull` is new (`index.html:1243`). `renderHome()` rebuilds `#view-home` with `innerHTML` (`index.html:1200-1207`), including the `#remtext` input (`index.html:1204`).
- **Why it matters.** This is the only input on Home, and every adult and guest uses it on the shared kitchen iPad. The 30 s timer is fixed and typing does not delay it. So a reminder that takes T seconds to type is wiped with probability min(1, T/30): about 1 in 3 to 2 in 3 for 10–20 s of typing.
- **Proposed fix.** Home re-renders only the cards whose data changed, and never replaces a focused input: skip the reminders card while #rem-in has focus or text, and keep the draft in memory across renders.
- **How it will be verified.** Rerun `node "audits/tools/phase2/HOME/verify-reminder-draft-wiped-by-pull-1.mjs"`, `node "audits/tools/phase2/HOME/verify-reminder-draft-wiped-by-pull-2.mjs"`, `node "audits/tools/phase2/HOME/leads.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### P2-HOME-03 — After Me → Switch, the next person lands on Me, not Home

- **Area** shell / platform · **Type** bug · **Severity** medium · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:343`; `index.html:1253`, `apps/hub.js:175-178`, `index.html:625-628`, `scripts/test-home.mjs:322`; `audits/evidence/p2/PROF/switch-3a-ezra-lands-on.png`
- **What happens now.** Switch exists only on Me (`index.html:1253`). It runs `closeViewer(); await hub.signOut(); showPicker();` (`:1282`) and never resets `location.hash`. `hub.signOut` does not reset it either (`apps/hub.js:175-178`). After sign-in, `enterShell` routes by the leftover hash (`index.html:625-628`), so the next person opens on `#me`.
- **Why it matters.** Every hand-over on the shared iPad starts on the previous person's settings page. A pre-reader lands on the Sync card's "Forget this device".
- **Proposed fix.** After Switch, the next person lands on Home: showTab("home") when a new session starts, never the previous tab.
- **How it will be verified.** Rerun `node "audits/tools/phase2/HOME/verify-switch-lands-on-me-1.mjs"`, `node "audits/tools/phase2/HOME/verify-switch-lands-on-me-2.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### P2-PROF-09 — The shared iPad never returns to the picker when idle, even for the admin

- **Area** shell / platform · **Type** bug (security) · **Severity** medium · **Effort** M · **Batch** 2a
- **Evidence.** `audits/02-shell.md:1361`; `index.html:1704-1706`, `index.html:1282`, `index.html:1711`, `apps/f260.html:2038-2049`
- **What happens now.** At boot, a stored session goes straight to the shell (index.html:1704-1706). The only exits are the manual Switch (index.html:1282), a 401, the kiosk's Switch (1133) and a guest's expiry. The session survives a PWA relaunch.
- **Why it matters.** whoever picks up the kitchen iPad inherits an adult's unrestricted chat and private prayer list and, for Eli, the admin panel.
- **Proposed fix.** Closed by the Kitchen device (KITCHEN-1 in 0d, KITCHEN-2 in 2a), which replaces the idle return this entry first proposed (P5-D5 as answered, `audits/05-decisions.md:42`): the Kitchen iPad signs in only as the kitchen, the server refuses a personal sign-in there, and whoever picks it up gets the family apps, never an adult's chat, private prayers or admin panel. No idle timer; the TV is unchanged.
- **How it will be verified.** The Phase 2 script `audits/tools/phase2/PROF/verify-no-idle-signout-2.mjs` signs Eli in on an ordinary device and keeps the session for 12 h; with no idle timer it will still do so, so it is not the check. The check is the kitchen test (KITCHEN-1, KITCHEN-2): the kitchen device cannot sign in as any person (Eli included), and its session gets 403 on chat, private prayer rows and admin; plus batch 2a's checks.

#### P2-PWA-05 — "Around the house" loads once per page session

- **Area** shell / platform · **Type** bug · **Severity** medium · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:4934`; `index.html:925`, `index.html:1216`, `index.html:1243`, `index.html:672-675`
- **What happens now.** `loadFeed()` returns early once `feedFresh` is true (index.html:925), and nothing resets it (declared at :921; set true at :927 and :1108). `renderHome` calls `loadFeed()` without force (index.html:1216). Home re-renders on every pull (index.html:1243), but the feed makes no request.
- **Why it matters.** A Home left open on the iPad or desktop looks live, but it shows the feed as it was at first load.
- **Proposed fix.** loadFeed refreshes on every pull (reset feedFresh on hub.onSync) and on becoming visible.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-feed-not-live-1.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### UX-CHAT-01 — Kid chat has to be read; only the verse is spoken

- **Area** shell / platform · **Type** usability · **Severity** medium · **Effort** S · **Batch** 2a
- **Verified (step 3).** was medium; skeptics medium and medium.
- **Evidence.** `audits/02-shell.md:4370`; `index.html:1456-1459`; `audits/evidence/p2/CHAT/04-kid-refused-tool-ipad-light.png`, `audits/screens/shell/chat-kid-typical-iphone-pwa-light.png`
- **What happens now.** `speakForKid` runs only for tool events with `speak:true`, which means only `read_todays_verse` (index.html:1456-1459, 1497).
- **Why it matters.** Pre-readers cannot read chat replies.
- **Proposed fix.** For kids, every chat reply is spoken (speakForKid on each message) and a speaker button replays it.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2a's checks.

#### UX-HOME-1 — Key numbers on the 24/7 iPad Home are 2.3–3.1 mm tall

- **Area** shell / platform · **Type** usability · **Severity** medium · **Effort** M · **Batch** 2a
- **Verified (step 3).** was high; skeptics medium and medium. Correction: The headline range '2.3-3.1 mm' leaves out the smallest key information the constitution names, leftovers expiring. The fridge item names and 'Nd' days are 12 px, 1.6-1.7 mm, so the key-information range is about 1.6-3.1 mm.
- **Evidence.** `audits/02-shell.md:546`; `apps/design.css:22-24`
- **What happens now.** Only the greeting reaches H2 at 2 m, and nothing reaches H1.
- **Why it matters.** The Kitchen iPad is read from across the room; today its key numbers are 2-3 mm tall.
- **Proposed fix.** Glance roles from the proposed tokens (`--fs-glance-1/2/3`, 44-96 px) for Home's key numbers on the iPad, and a calm "kitchen" layout when idle: today's reading, the running timer, food to eat soon. On the Kitchen device that layout is its Home (KITCHEN-2).
- **How it will be verified.** Rerun `node "audits/tools/phase2/HOME/glance.mjs"` — the defect must no longer reproduce; recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-HOME-8 — One tap on ✓ deletes a household reminder, with no undo

- **Area** shell / platform · **Type** usability · **Severity** medium · **Effort** S · **Batch** 2a
- **Verified (step 3).** was medium; skeptics medium and low; tie-break medium. Correction: No stated fact is wrong. One detail is incomplete: the feed line, the 'only trace', does not reach the tapping device's own Home feed until someone refreshes by hand (loadFeed returns early once feedFresh is set, index.html:925).
- **Evidence.** `audits/02-shell.md:673`; `index.html:1224-1226`, `index.html:1228-1235`
- **What happens now.** The ✓ is 44×44 px and appears for every adult-kind profile, guests included (`index.html:1224-1226`).
- **Why it matters.** One mis-tap deletes a household reminder for everyone.
- **Proposed fix.** Finishing a household reminder shows an Undo toast for 6 s (the shared undo toast from batch 1) instead of deleting at once.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-SYNC-a1 — Nobody is told when a change did not sync

- **Area** shell / platform · **Type** usability · **Severity** medium · **Effort** M · **Batch** 2a
- **Verified (step 3).** was medium; skeptics medium and medium (partly). Correction: Minor: 'nobody is told' is slightly broad. Larder, and the Dollywood pair, do tell an offline user that changes are waiting.
- **Evidence.** `audits/02-shell.md:2910`; `index.html:769`, `index.html:326`, `apps/hub.js:311`
- **What happens now.** The tab-bar dot (index.html:769) is covered by the full-screen viewer while any app is open (index.html:326). In e7 the element on top of `#syncdot` was the app `frame`, and F260 showed no sync wording with 3 writes waiting offline (e7-phone-f260-offline-pending.png).
- **Why it matters.** Nobody knows when a change did not sync.
- **Proposed fix.** Every app shows the shared sync status (hub.onSync) in the viewer bar: a small "Saving…" / "Offline — 3 changes waiting" line visible over the app, not only under it.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/e7-sync-ui.mjs"` — the defect must no longer reproduce; recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### GAP-ACCENT-1 — The colour picker cannot keep people apart: swatches are named by hex, duplicates are allowed, and nothing checks lightness, contrast or colour-blind distance

- **Area** design system, all areas · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/04-design-system.md:5696`; `index.html:1398`, `index.html:308`, `index.html:1393`, `worker/src/index.js:183`
- **What happens now.** The swatches are unnamed. Each carries `aria-label="#4F5D8C"` and so on (`index.html:1398, 1666`). The selected swatch is shown only by a `--text` border and a scale (`index.html:308`).
- **Why it matters.** The picker cannot keep people apart.
- **Proposed fix.** The admin colour picker (Me → Admin → Edit, for every profile, guests included) offers all 18 named families: the nine people's colours first, then the nine app colours, each labelled with the app that uses it. It warns on a duplicate, on a colour an app uses and on a colour a colour-blind viewer would confuse with another person's (the CVD check); the admin decides (household answer 2026-09-26). The Worker accepts only the 18 names.
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 2a's checks.

#### GAP-PROF-a2 — The admin panel cannot manage the household (index.html:1599, 1620, 1627, 1633, 1638, 1643, 1666-1667, 1681; index.js:453-480; `admin-panel.mjs`; `admin-edit-guest-kind.png`)

- **Area** shell / platform · **Type** feature gap · **Severity** low · **Effort** M · **Batch** 2a
- **Evidence.** `audits/02-shell.md:1129`; `index.html:1599`
- **What happens now.** There is no control to add or remove a household person. Only guests can be removed (index.js:206-227, 490-500).
- **Why it matters.** The household cannot be managed from the hub; a second admin is impossible.
- **Proposed fix.** Admin → Household: add or remove a household person, transfer or add an admin (server-checked), set a person's kind and hue (any of the 18 families, guests included; GAP-ACCENT-1).
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### P2-HOME-05 — Every successful pull rebuilds all of adult Home, even when nothing changed

- **Area** shell / platform · **Type** bug (perf) · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:404`; `index.html:1243`, `index.html:977-983`, `apps/hub.js:342`, `index.html:1711`
- **What happens now.** `index.html:1243` calls `renderHome()`, which replaces the whole view (`:1200`). The 15 re-created images are 5 SVG art files and 10 avatar JPEGs, from 7 distinct URLs. The rebuild also runs behind an app opened from a Home card, because the shell's tab stays `'home'`.
- **Why it matters.** it is the root cause of P2-HOME-01, and needless work on the always-on iPad. The cost of each pull is small.
- **Proposed fix.** Render each Home card from its own channel and skip the rebuild when the pull changed nothing (compare the channel's `since`).
- **How it will be verified.** Rerun `node "audits/tools/phase2/HOME/verify-home-full-rebuild-every-pull-1.mjs"`, `node "audits/tools/phase2/HOME/verify-home-full-rebuild-every-pull-2.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### P2-HOME-06 — Kid Verse writes the kid's name into its feed lines, so the TV reads "Ezra Ezra read the verse ★"

- **Area** shell / platform (Kid Verse, TV) · **Type** bug · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:438`; `apps/kidverse.html:332`, `worker/src/index.js:321-328`, `index.html:1070`, `index.html:955-957`; `audits/screens/tv/board-overflow-tv-light.png`
- **What happens now.** Kid Verse puts the person's name inside the activity text: `apps/kidverse.html:332`: `hub.activity(hub.profile.name + ' read the verse ★')` `:481`: `hub.activity(p.name + ' earned the ' + b.name + ' badge')` `:640`: `hub.activity(hub.profile.name + " heard this week's story")` The Worker stores the text as sent and returns the name …
- **Why it matters.** The TV's feed pane is five lines on the family's shared screen, and the doubled name reads as a glitch. With long names it pushes the text into the ellipsis.
- **Proposed fix.** Kid Verse stops putting the kid's name into the activity text (apps/kidverse.html:332, 481, 640); the TV keeps its byline. A one-off cleanup is not needed: feed lines age out.
- **How it will be verified.** Rerun `node "audits/tools/phase2/HOME/verify2-tv-kid-name-doubled-1.mjs"`, `node "audits/tools/phase2/HOME/verify2-tv-kid-name-doubled-2.mjs"`, `node "audits/tools/phase2/HOME/rescale-1x.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### P2-PROF-12 — The picker opens with its title off the top on iPhone, with 9+ profiles or in a Safari tab

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:1427`; `index.html:29`
- **What happens now.** `#gate` is a centred flex column with `overflow:auto` (index.html:29). When the cards are taller than the screen, the overflow is split above and below the panel. With the typical seed (9 cards), the h1 opens at −31 px (iPhone PWA), −127 px (Safari) and −75 px (390×844 PWA).
- **Why it matters.** once a guest is added, the first screen on the Home Screen iPhone app looks cut off.
- **Proposed fix.** The picker opens scrolled to the top with its title below the safe area (scrollTop 0 on show, `--safe-top` padding).
- **How it will be verified.** Rerun `node "audits/tools/phase2/PROF/verify-picker-title-hidden-iphone-2.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### P2-PROF-18 — A guest's Me hero reads "Adult"

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:1575`; `index.html:1249`, `index.html:535`, `worker/src/index.js:170`, `index.html:1252`; `audits/screens/shell/me-guest-typical-iphone-pwa-light.png`
- **What happens now.** `kindLabel` ignores `is_guest` (index.html:1249). A fresh guest and Grandma Jo both show the kicker "Adult". Their picker cards say "Guest · until Sep 29" and "Guest · until Sep 28", and the guest list and admin panel say "Guest" too (index.html:535, 1389, 1595).
- **Why it matters.** The shell is what every household member sees first, many times a day, on the always-on Kitchen iPad.
- **Proposed fix.** kindLabel shows "Guest · until <date>" for guests (index.html:1249).
- **How it will be verified.** Rerun `node "audits/tools/phase2/PROF/verify-guest-hero-adult-2.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### P2-PWA-17 — In iPhone landscape the chat composer ignores the side safe-area insets

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:5193`; `index.html:259-261`, `index.html:67`, `apps/design.css:553`, `apps/design.css:557`
- **What happens now.** `.chat-form` is `position:fixed; left:0; right:0; … width:min(100% - 2*var(--sp-4), 880px); margin:0 auto` (index.html:259-261). It uses `--safe-bottom` but never `--safe-left` or `--safe-right`.
- **Why it matters.** It breaks the house rule for edge-anchored controls (CLAUDE.md, Adding an app §6), which the rest of the shell follows. On the 852×393 class of Dynamic Island iPhones (14 Pro, 15, 15 Pro, 16, 16 Pro), part of the mic or Send button sits under the island.
- **Proposed fix.** The chat composer uses the side safe-area insets (margin-left/right: max(var(--margin), env(safe-area-inset-*))).
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify2-chat-composer-under-sensor-landscape-1.mjs"`, `node "audits/tools/phase2/PWA/standalone.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### P2-SYNC-13 — The Me → Sync card is painted once and goes stale, contradicting the tab-bar dot beside it

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:2669`; `index.html:1248`, `index.html:399`
- **What happens now.** the card is a one-time snapshot of `hub.sync` inside `renderMe` (index.html:1248, 1273-1279). `renderMe` runs only on tab entry and a few actions (:624, 644, 675, 1283, 1284…). `hub.onSync` repaints only Home, Apps and the tab-bar dot (:770, 1243).
- **Why it matters.** the only place that reports sync status in words contradicts the tab-bar dot until the person leaves Me.
- **Proposed fix.** Me's Sync card (and the album and rewards) re-render on hub.onSync / onChange, like the tab-bar dot.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-me-sync-card-stale-2.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### P2-SYNC-14 — After reopening offline, Sync says "Last checked: not yet" although the device synced minutes earlier

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:2685`; `apps/hub.js:51`, `index.html:1276`, `apps/hub.js:300`, `index.html:832`
- **What happens now.** `lastPull` lives only in memory (apps/hub.js:51, 311). The card reads only that value (index.html:1276), while the per-channel `since` is persisted (apps/hub.js:300, 196).
- **Why it matters.** offline, the family cannot tell how old what they see is.
- **Proposed fix.** Keep `hub.sync.lastPull` per device in localStorage and show it with its date ("Last synced 8:41 am").
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-last-checked-not-persisted-2.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### P2-VIS-05 — Long kid names push the star and badge counts out of the Kids card

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:5575`; `index.html:205`, `index.html:110`, `index.html:911-918`, `worker/src/index.js:458`
- **What happens now.** `.kid-chip { white-space: nowrap }` (`index.html:205`) sits inside a `.gcard` with `overflow: hidden` (`index.html:110`), with no ellipsis and no `min-width: 0` on the name. The chip text is the name, then ★N, then the badges (`index.html:911-918`).
- **Why it matters.** for the current household (short names) this is an edge case. Any long name an admin enters hides that kid's stars on the adults' Home, and the stars are what the card exists to show.
- **Proposed fix.** The Kids card truncates the name with an ellipsis and keeps ★ and badge counts visible.
- **How it will be verified.** Rerun `node "audits/tools/phase2/VIS/verify-kids-chip-clipped-1.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### P4-MOTION-01 — The Apps grid blanks and pops back in every 30 s while it is on screen

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/04-design-system.md:3904`; `index.html:380`, `apps/design.css:595-599`, `apps/hub.js:311`, `apps/hub.js:342`
- **What happens now.** The entrance. `#grid` is a `.stagger` container (`index.html:380`). `.ds .stagger > *` runs `hub-pop` from opacity 0 and scale .96 / translateY 8 px over 360 ms `--spring`, with delays of 40-200 ms (`apps/design.css:595-599`). The trigger.
- **Why it matters.** The iPad sits open all day. A grid that empties and refills twice a minute reads as a glitch and draws the eye from across the room.
- **Proposed fix.** The Apps grid re-renders only when the app list changed, and never replays its entrance on a pull. (Phase 4 gap row MOTION-10)
- **How it will be verified.** Rerun `node "audits/tools/phase4/MOTION/replay.mjs"`, `node "audits/tools/phase4/MOTION/replay-shot.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### P4-MOTION-02 — Closing an app cannot be interrupted: a tap in the 220 ms exit opens nothing, and an app opened in that window is hidden again

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/04-design-system.md:3946`; `index.html:729-733`, `index.html:326-328`, `index.html:721`, `index.html:650-652`
- **What happens now.** Taps are lost. `closeViewer()` adds `.closing` (`viewer-out`, 220 ms) and schedules a 220 ms `setTimeout` that removes `on` and sets the frame to `about:blank` (`index.html:729-733`). Until then the fading viewer is still `display: flex` at z-index 30 (`index.html:326-328`) and still takes pointer events.
- **Why it matters.** A quick tap on the next app right after leaving one does nothing. A notification tapped just as an app closes shows the grid instead of the app it named.
- **Proposed fix.** The viewer exit is interruptible: a tap during the 220 ms exit is honoured and an app opened then stays open.
- **How it will be verified.** Rerun `node "audits/tools/phase4/MOTION/viewer.mjs"` — the defect must no longer reproduce; plus batch 2a's checks.

#### PWA-GAP-3 — No mic on Home "Add a reminder for the house" (gap, low). index.html:1204; voice-run.txt:4 (`micButtonsInHome: 0`)

- **Area** shell / platform · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:4861`; `index.html:1204`
- **What happens now.** No mic on Home "Add a reminder for the house" (gap, low). index.html:1204; voice-run.txt:4 (`micButtonsInHome: 0`).
- **Why it matters.** Voice add is missing where hands are busy.
- **Proposed fix.** Add the mic (hub.voiceInput) to Home's "Add a reminder" field.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### PWA-UX-4 — A kid's spoken question waits for a Send tap

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:4862`; `index.html:388`
- **What happens now.** Ezra's transcript "what is my verse" filled `#chat-in` and made no request (voice-run.txt:100, `sentToChat: 0`; voice-chat-kid-filled-ipad-portrait-light.png).
- **Why it matters.** A pre-reader cannot check the text or find Send.
- **Proposed fix.** A kid's spoken question sends itself when speech ends.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-CHAT-02 — Offline and error sends show raw text, clear what was typed, and vanish on reload

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:4376`; `index.html:1489`, `index.html:1516`
- **What happens now.** The bubbles read "Load failed" (offline), "The assistant is unavailable right now (Internal server error)." and a bare "Overloaded" (chat.js:353, 380).
- **Why it matters.** People lose what they typed and see raw errors.
- **Proposed fix.** Failed sends keep the typed text, show a plain-English error with Retry, and queue offline messages until online.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-CHAT-03 — Failed or refused tools show nothing

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:4381`; `index.html:1497`, `index.html:1498`
- **What happens now.** Every failure path returns `chip:null` (chat.js:161-311), and the client drops tool events that have no chip (index.html:1497).
- **Why it matters.** Silent failures look like success.
- **Proposed fix.** Failed or refused tools show a red chip ("Couldn't add milk: …"); the client renders chips with ok:false.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-CHAT-04 — At the cap, Send looks active, the counter has scrolled away and the placeholder is clipped

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:4386`; `index.html:1460-1463`
- **What happens now.** At the cap, Send looks active, the counter has scrolled away and the placeholder is clipped (low). `setCap` disables only the input (index.html:1460-1463). The rig recorded `sendDisabled:false`, `capCounterInViewport:false` and the placeholder "Back tomorrow — that is enough f…" (04-cap-reached-iphone-light.png).
- **Why it matters.** The cap is invisible until a send fails.
- **Proposed fix.** At the cap, Send is disabled, the counter is pinned above the composer and the placeholder says "Back tomorrow".
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-CHAT-05 — The tab shows messages the model no longer has

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:4388`
- **What happens now.** History returns the newest 20 rows of any age (chat.js:455), but the model gets only rows from the last 36 h (chat.js:397).
- **Why it matters.** The tab implies Claude remembers what it does not.
- **Proposed fix.** The Chat tab shows only the messages the model still has (the 36 h window), with a divider "Earlier messages are not remembered".
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-CHAT-06 — `set_data` chips and feed lines print raw storage keys

- **Area** shell / platform (TV) · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:4393`
- **What happens now.** `set_data` chips and feed lines print raw storage keys (low). Examples: "✓ Saved album:alb0014 in hub" and "Changed stars:kiara in kidverse (via chat)", which show on Home and the TV (chat.js:178-179; 01-tools-adult.json, step 10b).
- **Why it matters.** Raw keys show on Home and the TV.
- **Proposed fix.** set_data chips and feed lines use human names ("Saved a photo to the album"), never storage keys.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-CHAT-07 — No timestamps or day separators in the log

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:4395`; `index.html:1439-1448`
- **What happens now.** No timestamps or day separators in the log (low). `bubble()` renders no time (index.html:1439-1448), although history carries `created_at`.
- **Why it matters.** Old answers read as current.
- **Proposed fix.** Day separators and times in the chat log.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-HOME-3 — On iPhone, Home is 4.7 screens tall

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** M · **Batch** 2a
- **Verified (step 3).** was medium; skeptics low and low. Correction: The facts are right. Still, '4.7 screens tall' mostly measures the 30-row activity feed, a naturally long log at the bottom (2513 of 4415 px). The dashboard content above it is about 2 phone screens. The medium rating is inflated.
- **Evidence.** `audits/02-shell.md:593`; `index.html:105-107`; `audits/screens/shell/home-typical-iphone-pwa-light.png`
- **What happens now.** Home is four full-width cards of 398×196–288 px, in one column below 720 px (`index.html:105-107`).
- **Why it matters.** The phone Home is 4.7 screens tall; reminders and the feed are never seen.
- **Proposed fix.** On iPhone, Home becomes a short glance: a compact hero and horizontally paged cards (or a two-column small-card grid), with reminders reachable in one screen.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2a's checks.

#### UX-HOME-4 — The viewer's "Hub" button always goes to Apps, and Escape does nothing

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:615`; `index.html:736`, `index.html:326`, `index.html:743-749`
- **What happens now.** The button calls `showTab('apps')` (`index.html:736`), even from an app opened on a Home card (`back.json`).
- **Why it matters.** People lose their place when they close an app.
- **Proposed fix.** The viewer's back button returns to where the app was opened from (Home or Apps), and Escape closes the viewer.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-HOME-5 — Every switch reloads the app, so unsaved input is lost

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** M · **Batch** 2a
- **Evidence.** `audits/02-shell.md:620`; `index.html:724`
- **What happens now.** On close, the iframe is set to `about:blank` (`index.html:724, 732`).
- **Why it matters.** Half-typed input is lost on a switch.
- **Proposed fix.** Keep the last app document alive (hide, do not blank) for a short time when switching, or ask apps to save drafts through `hub.draft(key)`.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-HOME-6 — The Switch sheet is text only. 0 of 8 entries have an icon or colour (`index.html:738-742`; `switching.json` switchSheet.items[].hasIcon; `audits/screens/shell/switch-app-typical-ipad-portrait-light.png`)

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:624`; `index.html:738-742`; `audits/screens/shell/switch-app-typical-ipad-portrait-light.png`
- **What happens now.** (low; investigator only) — The Switch sheet is text only. 0 of 8 entries have an icon or colour (`index.html:738-742`; `switching.json` switchSheet.items[].hasIcon; `audits/screens/shell/switch-app-typical-ipad-portrait-light.png`).
- **Why it matters.** Pre-readers cannot use a text-only list.
- **Proposed fix.** The Switch-app sheet shows each app's tile icon and colour beside its name, in a grid kids can use.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2a's checks.

#### UX-HOME-7 — Kid Home is text-heavy

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** M · **Batch** 2a
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: 'The only one-tap entry is a text button' is true only for launching an app directly. The large CTA has a 64 px icon tile and leads in one tap to an all-icon Apps grid, so the kid flow is completable without reading.
- **Evidence.** `audits/02-shell.md:665`; `index.html:1146-1156`
- **What happens now.** The only one-tap entry is a text button (`index.html:1146-1156, 902-910`).
- **Why it matters.** Ezra and Kiara cannot read the text-heavy Home.
- **Proposed fix.** Kid Home becomes picture-first: big tiles for Kid Verse, Prayer, Timer and Tally with the art, stars shown as stars, and no adult reminders block.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-PROF-a1 — An offline picker still offers a guest whose stay has ended

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:936`; `index.html:525-536`
- **What happens now.** Pastor Tim was cached while still staying. Reopened offline after his stay ended, he still shows "Guest · until Sep 24" (index.html:525-536; `guests.mjs`).
- **Why it matters.** A guest whose stay ended is still offered offline.
- **Proposed fix.** The picker drops guests whose expires_at has passed, from the cached list too.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-PROF-a3 — An offline or failed picker gives no sign until someone taps (index.html:516-530; `picker-pin.mjs` §1b; `picker-offline-after-tap-iphone.png`)

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:950`; `index.html:516-530`, `index.html:535`
- **What happens now.** The offline picker looks identical to the online one.
- **Why it matters.** People type a PIN that cannot work.
- **Proposed fix.** The picker shows "Offline — you can still sign in as someone who has used this device" before anyone taps, and disables people it cannot sign in.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### UX-PROF-a4 — The Create-PIN pad never names the person, and nothing has focus

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:973`; `index.html:554`; `audits/screens/shell/pin-create-typical-iphone-pwa-dark.png`
- **What happens now.** The title "Create your PIN" replaces the name; "Mea" appears nowhere on the gate (index.html:554, 606).
- **Why it matters.** On a shared iPad, nobody can tell whose PIN is being created.
- **Proposed fix.** The Create-PIN pad names the person ("Create Mea's PIN") with their face, and puts focus on the pad.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2a's checks.

#### UX-PROF-a5 — After the lockout the pad stays live, with no countdown

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:1000`; `index.html:571-575`, `index.html:566-590`; `audits/evidence/p2/SEC/verify-lockout-dos-1-ui.png`, `audits/evidence/p2/SEC/verify-lockout-dos-2-ui.png`
- **What happens now.** Five wrong PINs each give "Wrong PIN."
- **Why it matters.** The pad looks usable while it refuses every PIN.
- **Proposed fix.** After a lockout the pad disables itself and counts down ("Try again in 14 min").
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2a's checks.

#### UX-PROF-a8 — The "Choose a pairing code" sheet has no Cancel button and placeholder-only fields

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:1063`; `index.html:1649`; `audits/screens/shell/pairing-code-typical-iphone-pwa-light.png`
- **What happens now.** The placeholders are "6 to 64 characters" and "Type it again" (index.html:1649; `audits/screens/shell/pairing-code-typical-iphone-pwa-light.png`).
- **Why it matters.** The sheet can only be left by tapping the backdrop.
- **Proposed fix.** The "Choose a pairing code" sheet gets Cancel and real labels, and uses the shared sheet (Escape and drag to close).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2a's checks.

#### UX-PROF-a9 — Kid-mode shell controls are below the 64 px kid size, and several kid controls are text-only (`kid-targets.mjs`; `kid-targets.json`; index.html:909, 1253, 1278)

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** M · **Batch** 2a
- **Evidence.** `audits/02-shell.md:1084`; `index.html:909`; `audits/screens/shell/app-blocked-typical-ipad-portrait-light.png`, `audits/screens/shell/apps-kid-typical-iphone-pwa-light.png`
- **What happens now.** Below 64 px: tab bar buttons 104×56 (iPhone) and 140×56 (iPad); the viewer top bar (‹ Hub, app name, reload) at 44 px; the Notifications switch, shown to kids, at 52×32.
- **Why it matters.** Pre-readers need big, picture-labelled controls.
- **Proposed fix.** Kid-mode shell controls reach 64 px (`--tap` kid base) and carry icons: the tab bar, the viewer bar, Me's buttons; hide Notifications and Forget this device for kids.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2a's checks.

#### VIS-GLASS-2 — The app viewer's bar is live glass in every app, but nothing ever passes beneath it

- **Area** design system, all areas · **Type** visual · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/04-design-system.md:3548`; `index.html:407`, `index.html:326`, `index.html:333`, `index.html:83`
- **What happens now.** `#pill.topbar` (`index.html:407`) is the bar above every app: 1440×48 on desktop, live blur on every app screen (`layers.json`: page `div#pill.topbar` in every app area).
- **Why it matters.** It is the one piece of glass seen in every app, and it reads as a flat strip, not floating glass, while paying for a blur.
- **Proposed fix.** The viewer bar becomes solid material (nothing passes beneath it). (Phase 4 gap row GLASS-10)
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 2a's checks.

#### VIS-HOME-1 — The Apps grid uses one size everywhere: 48 px icon, 29 px glyph, 12 px label

- **Area** shell / platform · **Type** visual · **Severity** low · **Effort** M · **Batch** 2a
- **Verified (step 3).** was medium; skeptics low (partly) and low. Correction: Two details are off. First, 'a 29 px glyph, about half the size of an iOS icon' compares the glyph with a whole iOS icon. The comparable element is the 48 px icon plate, which is about 80% of a 60 pt iOS icon.
- **Evidence.** `audits/02-shell.md:587`; `index.html:217`, `index.html:218-229`
- **What happens now.** On the phone, 4 columns at a 103 px pitch matches iOS density, so "tiles too big on the phone" is refuted for this grid in pitch terms. What looks big is the card chrome around a 29 px glyph, about half the size of an iOS icon.
- **Why it matters.** The grid looks like a web page of cards, not a home screen.
- **Proposed fix.** Apps grid density per size class: iOS-sized icons (60 px on iPhone, 76 px on iPad) with the house tile gradient, labels at caption size, 4 columns on phone and 6-8 on iPad.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### VIS-HOME-2 — The timer pill sits on content

- **Area** shell / platform (Timer) · **Type** visual · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:683`; `index.html:344`, `index.html:67`
- **What happens now.** At 1024 px and wider it sits at the left of the content column (`index.html:344, 354`).
- **Why it matters.** It covers headings and reminders.
- **Proposed fix.** The timer pill reserves its own space (padding on #views while it shows) and sits in the bar area, never on content.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2a's checks.

#### VIS-HOME-3 — Grid gaps, an early hero wrap and clipped chips (`layout.json`)

- **Area** shell / platform · **Type** visual · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:690`; `apps/design.css:419`, `index.html:91`, `apps/design.css:410`; `audits/screens/shell/home-overflow-ipad-portrait-light.png`
- **What happens now.** At 1024 px and wider, the Kids card sits alone with 2 empty cells. In the overflow variant it stretches to 521 px beside the park card.
- **Why it matters.** Visible layout rough edges on the iPad and desktop.
- **Proposed fix.** Fix the grid gaps and orphaned Kids card at 1024+ px, drop the 34ch cap on the hero summary, and let chips truncate with an ellipsis.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2a's checks.

#### VIS-TIMER-5 — On the Chat tab the pill overlaps the newest bubble by 9-21 px

- **Area** timer · **Type** visual · **Severity** low · **Effort** S · **Batch** 2a
- **Evidence.** `audits/03-apps/timer.md:367`; `index.html:357-358`; `audits/evidence/p3/timer/pillchat-iphone-pwa.png`, `audits/evidence/p3/timer/pillchat-desktop.png`
- **What happens now.** On the Chat tab the pill overlaps the newest bubble by 9-21 px (low). With the overflow chat scrolled to the bottom, overlap was 9 px on iPhone, 0 on iPad portrait and 21 px on desktop; the text stays readable. The pill lifts above the composer (`index.html:357-358`), but the log keeps no room for it. Evidence: `audits/evidence/p3/timer/pillchat-offline.json` (P), `audits/evidence/p3/timer/pillchat-iphone-pwa.png`, `audits/evidence/p3/timer/pillchat-desktop.png`.
- **Why it matters.** The pill overlaps chat bubbles.
- **Proposed fix.** The pill reserves space above the chat composer. (Phase 3: IMP-TIMER-P9)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2a's checks.

#### CONS-TOK-4 — The shell's eight off-scale radii are one ratio (size × 0.32) typed eight times

- **Area** design system, all areas · **Type** visual (consistency) · **Severity** info · **Effort** S · **Batch** 2a
- **Evidence.** `audits/04-design-system.md:886`; `index.html:109`, `apps/design.css:606`
- **What happens now.** The app-icon radii are 13/14/11/20/15/28/10/18 px, for sizes 40/44/36/64/48/88/30/56 px (index.html:109, 139, 167, 188, 226, 240, 247; apps/design.css:606). Each is round(size × 0.32).
- **Why it matters.** One ratio typed eight times.
- **Proposed fix.** The shell's eight off-scale radii become calc(var(--icon-box) * var(--r-icon-ratio)) (info). (Phase 4 gap row TOK-12)
- **How it will be verified.** recapture its screens (capture area every area) and compare; plus batch 2a's checks.

#### P2-STAB-06 — The adult Home's "Around the house" feed loads once and never refreshes (pointer → P2-PWA-05, medium)

- **Area** shell / platform · **Type** bug · **Severity** medium (pointer) · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:3217`; `index.html:925`, `scripts/test-guests.mjs:120`, `scripts/test-photos.mjs:106`
- **Proposed fix.** Pointer to P2-PWA-05.

#### P2-SYNC-10 — Home's "Around the house" feed loads once and never refreshes on its own

- **Area** shell / platform · **Type** bug · **Severity** medium (pointer) · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:2624`; `index.html:1216`
- **Proposed fix.** Pointer to P2-PWA-05.

#### P2-VIS-07 — On a cold load Me paints final empty states, and Kids' rewards stays at ★0 until Me is re-entered

- **Area** shell / platform · **Type** bug · **Severity** low (pointer) · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:5657`; `index.html:1349-1356`, `index.html:1426-1433`, `index.html:1237`, `index.html:1236-1241`; `audits/screens/shell/me-loading-iphone-pwa-light.png`
- **Proposed fix.** Pointer to P2-SYNC-13.

#### PWA-UX-3 — , PWA-UX-4, P2-PWA-17 (Notifications, voice add, activity feed, PWA install; critic G3, G5):

- **Area** shell / platform · **Type** usability · **Severity** low (pointer) · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:4430`; `index.html:1524`, `index.html:259-260`, `index.html:387`
- **Proposed fix.** Pointer to PWA-UX-4 and P2-PWA-17 (the composer items).

#### PWA-VIS-1 — Kids' names appear twice in feed lines → same defect as P2-HOME-06 (Home), which owns it at low (confirmed 2/2) and records the adult-Home facet too. The Phase 1 capture audits/screens/shell/home-bottom-typical-ipad-portrait-light.png shows the adult-Home facet

- **Area** shell / platform · **Type** visual · **Severity** low (pointer) · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:5043`; `audits/screens/shell/home-bottom-typical-ipad-portrait-light.png`
- **Proposed fix.** Pointer to P2-HOME-06.

#### PWA-VIS-2 — Chat composer under the side insets in landscape → now P2-PWA-17. Same defect, confirmed 2/2 as P2-PWA-17

- **Area** shell / platform · **Type** visual · **Severity** low (pointer) · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:5232`
- **Proposed fix.** Pointer to P2-PWA-17.

#### PWA-VIS-3 — The picker can open mid-scroll → same defect as P2-PROF-12 (see Profiles, kid mode, kiosk and admin), which owns it at low

- **Area** shell / platform (TV) · **Type** visual · **Severity** low (pointer) · **Effort** S · **Batch** 2a
- **Evidence.** `audits/02-shell.md:5233`; `index.html:326`, `apps/f260.html:41`, `apps/prayer.html:47`, `apps/f260.html:603`
- **Proposed fix.** Pointer to P2-PROF-12.

#### UX-DOLLYWOOD-6 — A tick made offline looks exactly like a synced one

- **Area** dollywood · **Type** usability · **Severity** low (pointer) · **Effort** S · **Batch** 2a
- **Verified (step 3).** was medium; skeptics medium and low; tie-break low. Correction: The facts are right. The rating is too high: it should be low, not medium. The report does not say that the offline tick reliably reaches the server on reconnect (its own evidence shows 25).
- **Evidence.** `audits/03-apps/dollywood.md:683`; `audits/evidence/p3/dollywood/offline-before-tick-online.png`, `audits/evidence/p3/dollywood/offline-after-tick.png`
- **Proposed fix.** Pointer to UX-SYNC-a1: the shared sync status in the viewer bar shows pending offline ticks. (Phase 3: IMP-DOLLYWOOD-F1)

#### UX-KIDVERSE-7 — Offline, a star shows as earned with no sign that it has not been saved

- **Area** kidverse · **Type** usability · **Severity** low (pointer) · **Effort** S · **Batch** 2a
- **Evidence.** `audits/03-apps/kidverse.md:683`; `audits/evidence/p3/kidverse/offline-kid-after-done.png`, `audits/screens/kidverse/kid-offline-iphone-pwa-light.png`
- **Proposed fix.** Pointer to UX-SYNC-a1 (the shared pending state in the viewer bar).

#### UX-LEFTOVERS-7 — An item logged or finished offline looks exactly like a synced one; the only cue is a 12 px amber line

- **Area** leftovers · **Type** usability · **Severity** low (pointer) · **Effort** S · **Batch** 2a
- **Evidence.** `audits/03-apps/leftovers.md:788`; `apps/leftovers.html:249-287`, `apps/leftovers.html:26-27`; `audits/evidence/p3/leftovers/sync-offline-queued-iphone.png`
- **Proposed fix.** Pointer to UX-SYNC-a1 (shared pending state).

#### UX-TIMER-8 — Offline, the timer starts normally with no sign that the person's other devices will not see it

- **Area** timer · **Type** usability · **Severity** low (pointer) · **Effort** S · **Batch** 2a
- **Evidence.** `audits/03-apps/timer.md:352`; `audits/evidence/p3/timer/offline-running-iphone.png`
- **Proposed fix.** Pointer to UX-SYNC-a1 (the shared pending state).

### Batch 2b — Worker: push, reminders, chat and PWA (27)

#### P2-PWA-02 — The park "child's spot went quiet" alert cannot fire for most of a park day

- **Area** shell / platform (park map) · **Type** bug · **Severity** high · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4579`; `worker/wrangler.toml:25`, `index.html:1269`, `scripts/test-push2.mjs:197-226`
- **What happens now.** `parkJob` runs only on the scheduled 8 am and 8 pm New York runs (reminders.js:253-255). The 9 am and 9 pm UTC firings in `worker/wrangler.toml:25` are dropped by the hour check. A kid counts as stale only when their marker is more than 30 min and less than 4 h old.
- **Why it matters.** The Me switch promises "Park day: a child's spot goes quiet" (index.html:1269), and CLAUDE.md lists this alert. Parents who turn it on are falsely reassured for most of the day.
- **Proposed fix.** parkJob runs on every cron firing (every 15 min on park days, a new cron entry) and treats a kid as stale after 20 min without an update. (Phase 3: IMP-DOLLYWOOD-LIVE-F3)
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-park-alert-misses-park-day-2.mjs"`, `node "audits/tools/phase2/PWA/push.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-CHAT-05 — No timeout on a hung upstream; the Chat tab freezes with no cancel

- **Area** shell / platform · **Type** bug · **Severity** medium · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:3943`; `index.html:1502`, `index.html:385-389`, `index.html:1488`, `index.html:1498`; `audits/evidence/p2/CHAT/04-hang-30s-iphone-light.png`
- **What happens now.** Neither the Worker's fetch to Anthropic (chat.js:345-349) nor the client's fetch (index.html:1502) has a timeout or an `AbortSignal`. There is no `AbortController` anywhere in index.html.
- **Why it matters.** On a phone the Chat tab looks dead. Desktop Chrome stays stuck for as long as the upstream does.
- **Proposed fix.** The Worker times out a silent upstream after 45 s and the Chat tab offers Cancel while a reply streams.
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-no-timeout-on-hang-2.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-PWA-03 — On a shared device, push stays with whoever subscribed; the next person sees "On"

- **Area** shell / platform · **Type** bug · **Severity** medium · **Effort** M · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4606`; `index.html:1282`, `apps/hub.js:175-177`, `worker/src/index.js:272-277`, `index.html:1551-1554`
- **What happens now.** Me → Switch (index.html:1282 → apps/hub.js:175-177) calls `POST /api/logout`, which deletes only the session row (worker/src/index.js:272-277). The subscription row stays, and `pushTo` sends by `profile_id` alone (reminders.js:34-48). The switch is painted from the browser-wide `pushManager.getSubscription()` (index.html:1551-1554).
- **Why it matters.** The shared iPad is a primary device. A signed-out adult's personal nudges keep landing there ("No reading checked off today yet…"), and the next person is misled about their own reminders.
- **Proposed fix.** Push subscriptions are per person per device: Switch unsubscribes (or re-keys) the previous person, and Me shows the switch for the signed-in person only.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-shared-device-push-follows-device-2.mjs"`, `node "audits/tools/phase2/PWA/standalone.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-PWA-04 — Family prayers added after an 8 am prayer push are never announced to those adults

- **Area** shell / platform (Prayer) · **Type** bug · **Severity** medium · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4642`
- **What happens now.** `prayerJob` compares against a single household-wide watermark. Each run advances it past every new prayer, whether or not each adult was told (reminders.js:180-182). `notify`'s once-a-day gate (reminders.js:50-54, 61) then skips every adult who got a prayer push that morning. Nothing records what they missed.
- **Why it matters.** On any day with a morning prayer push, the day's later family requests reach almost nobody by push.
- **Proposed fix.** The prayer announcement keeps a per-adult "last announced" stamp and announces every row newer than it at the next run, instead of once a day.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-prayer-push-lost-after-morning-1.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-PWA-08 — An always-open hub never runs a new deploy

- **Area** shell / platform · **Type** bug · **Severity** medium · **Effort** M · **Batch** 2b
- **Evidence.** `audits/02-shell.md:5078`; `index.html:1691-1697`, `index.html:1288`, `sw.js:22`, `sw.js:4-5`
- **What happens now.** The page only shows a toast on `installed` (index.html:1691-1697). There is no `controllerchange` listener, no `reg.update()`, and no reload except "Forget this device" (index.html:1288). sw.js:22 and :25 call `skipWaiting` and `clients.claim`.
- **Why it matters.** Fixes do not reach the 24/7 devices until someone relaunches the app, including the fix for P2-STAB-01 (STAB GAP). On the TV the toast's "next time it opens" never happens.
- **Proposed fix.** An always-open hub checks for a new service worker on visibility and hourly, and applies it at an idle moment (no input focused, no app open) with a reload that restores the tab.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-open-page-never-takes-new-build-2.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-PWA-09 — Within `max-age=600`, a VERSION bump precaches the old files

- **Area** shell / platform · **Type** bug · **Severity** medium · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:5104`; `sw.js:22`, `sw.js:47`
- **What happens now.** The precache `c.add(u)` (sw.js:22) and the revalidate `fetch(req)` (sw.js:47) use the default cache mode, and the live site sends `Cache-Control: max-age=600` (manifest-run.json → live). Suppose a device fetched the shell files less than 600 s before the update check.
- **Why it matters.** Right after a push, the toast is wrong and on-device checks show the old build. The likeliest device to hit this is the deployer's own phone, checking the fix (P2-STAB-05).
- **Proposed fix.** Precache and revalidate with `cache: "reload"` so a VERSION bump never stores the HTTP-cached old files (sw.js:22, 47).
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-deploy-invisible-within-max-age-2.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### GAP-CHAT-01 — Chat history, kids' included, is kept forever with no way to clear it

- **Area** shell / platform · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4397`; `worker/schema.sql:87-94`
- **What happens now.** Chat history, kids' included, is kept forever with no way to clear it (low). `chat_log` rows are deleted only when a guest is purged (index.js:212; worker/schema.sql:87-94). A "clear my chat" route or button: NOT FOUND IN CODE.
- **Why it matters.** Kids' chat history is kept forever.
- **Proposed fix.** Me → Chat history → Clear (and a 90-day retention for kids' chat).
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2b's checks.

#### P2-CHAT-08 — The daily cap check is read-then-insert

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4054`; `worker/src/chat.js:113-117`, `worker/src/index.js:429-441`, `index.html:1488-1489`
- **What happens now.** `usedToday` is read at chat.js:399 (via chat.js:113-117), and the user row is inserted later, at chat.js:411. There is no transaction, conditional insert or counter row.
- **Why it matters.** The cap is the only spend control, and the server itself puts no bound on the overshoot. `/api/chat` has no `rateCheck` (index.js:429-441).
- **Proposed fix.** Make the cap check atomic (INSERT … WHERE (SELECT count(*) …) < cap, or a counter row updated in one statement).
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-cap-check-not-atomic-1.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-CHAT-10 — A failed upstream still spends a daily message

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4144`; `index.html:1498`, `index.html:1499`, `worker/src/chat.js:113-117`, `index.html:1498-1499`
- **What happens now.** The user row is inserted at chat.js:411, before the model is called. The catch at chat.js:441-442 only sends an `error` event and refunds nothing.
- **Why it matters.** During an Anthropic outage, retries use up the day's allowance.
- **Proposed fix.** Count a message against the cap only when the upstream answered (insert the usage row after a successful first event).
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-failed-upstream-spends-cap-1.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-CHAT-11 — Thinking blocks are dropped when a tool loop continues

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4179`; `worker/src/chat.js:14`
- **What happens now.** `assistantTurn` marks every block other than `text` and `tool_use` as skipped (chat.js:373) and filters them out (chat.js:382), although its docstring says it "returns the full content blocks" (chat.js:368).
- **Why it matters.** This goes against Anthropic's documented rule for tool use. The Thinking page's "Preserving thinking blocks" section says: "Required: within a tool-use turn, pass thinking blocks back." The model therefore continues each tool turn without its own earlier reasoning.
- **Proposed fix.** Keep thinking blocks (with their signatures) in the tool-loop message history as the API requires.
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-thinking-blocks-dropped-on-tool-replay-1.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-CHAT-12 — System prompt: admin not marked; expired guests named

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4217`; `worker/src/chat.js:317`, `worker/src/auth.js:86-101`, `worker/src/index.js:166`
- **What happens now.** System prompt: admin not marked; expired guests named
- **Why it matters.** Departed visitors' names leave the house with every message until the 30-day purge. The model also gets a slightly wrong picture of who is signed in.
- **Proposed fix.** The system prompt marks the admin and omits expired guests.
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-prompt-admin-and-expired-guests-1.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-CHAT-13 — Admin → Usage counts UTC days; the cap counts New York days

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4254`; `worker/src/index.js:522-524`, `index.html:1609`, `worker/src/index.js:519-529`, `worker/src/chat.js:112-117`; `audits/evidence/p2/CHAT/verify-usage-utc-vs-cap-1-admin-1x.png`
- **What happens now.** Usage groups rows by `date(created_at / 1000, 'unixepoch')`, which is the UTC date. That applies to the chat half (worker/src/index.js:522-524) and to the push half (index.js:525-526). The cap counts New York dates (chat.js:113-117). The shell prints the raw date with no time zone (index.html:1609, 1612).
- **Why it matters.** The admin's numbers disagree with the counter people see, and late-evening rows carry a date that has not started yet for the family.
- **Proposed fix.** Admin → Usage groups chat and push by New York day, the same day the cap uses.
- **How it will be verified.** Rerun `node "audits/tools/phase2/CHAT/verify-usage-utc-vs-cap-1.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-PROF-16 — The display profile can register and test push subscriptions

- **Area** shell / platform · **Type** bug (security) · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:1543`; `index.html:1262`
- **What happens now.** with the TV session, POST /api/push/subscribe returns 200, POST /api/push/test delivers one push, and DELETE returns 200. These routes use `requireProfile`, not `requireWriter` (index.js:410-426, 534-539).
- **Why it matters.** Reminders and pushes are how the hub reaches people who are not looking at it.
- **Proposed fix.** The Worker refuses push subscribe and test for the kiosk (403 read_only) and for kids unless the household allows kid notifications; the Me switch is hidden for them.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PROF/verify-kiosk-push-allowed-2.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-PWA-10 — One subscription row with no keys aborts the reminder jobs every day

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4666`; `worker/src/index.js:414`, `index.html:1565-1566`, `worker/src/index.js:121-128`
- **What happens now.** Subscribe validates only `subscription.endpoint` (worker/src/index.js:414). For a row without keys, `encrypt()` throws (push.js:19-20). That call is at push.js:58, outside the `try` at :60. The throw leaves `pushTo` before the 404/410 cleanup and the `push_log` insert (reminders.js:41-46).
- **Why it matters.** A single bad row silently stops the house's fridge and prayer reminders.
- **Proposed fix.** Subscribe validates keys, and pushTo wraps encrypt() in the per-row try so one bad row is skipped and deleted, not fatal to the job.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-keyless-subscription-aborts-job-1.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-PWA-11 — A failed push counts as "sent today"

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4698`
- **What happens now.** `pushTo` writes a `push_log` row with `ok 0` when every device fails (reminders.js:46). `alreadySentToday` ignores `ok` (reminders.js:50-54), and `notify` skips on it (reminders.js:61). A failed attempt therefore uses up that kind for the person's New York day.
- **Why it matters.** A transient push-service error costs that person any later same-kind push that day.
- **Proposed fix.** Only a 2xx from the push service counts toward the daily gate.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-failed-send-blocks-day-1.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-PWA-12 — "Send a test notification" can confirm the wrong device

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4718`; `worker/src/index.js:534-538`, `index.html:1546`, `index.html:1553`
- **What happens now.** `/api/push/test` pushes to every subscription of the caller's profile (worker/src/index.js:534-538 → reminders.js:37). The UI says "Sent — it should appear in a moment." if any one of them succeeds (index.html:1546), and the push body says "Notifications are working on this device."
- **Why it matters.** The one tool for checking a device can confirm a different device.
- **Proposed fix.** The test sends to this device's subscription endpoint only (the client sends its endpoint with the request).
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-test-button-counts-all-devices-2.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-PWA-15 — A brand-new install often shows "Hub updated"

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:5137`; `index.html:1695`, `sw.js:25`, `index.html:510`; `audits/screens/shell/first-visit-typical-iphone-pwa-light.png`
- **What happens now.** The guard `installed && controller` (index.html:1695) passes on a first install in WebKit. `clients.claim` (sw.js:25, after `skipWaiting` at :22) sets the controller before the queued `installed` statechange runs.
- **Why it matters.** The first thing a new device says is an update message. That weakens the toast that matters on real updates.
- **Proposed fix.** Show "Hub updated" only when a previous controller existed before this page load (not on the first install).
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-first-visit-hub-updated-2.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P2-PWA-16 — Offline, an uncached build guide shows a bare 503 "Offline"

- **Area** shell / platform (build guide) · **Type** bug · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:5160`; `sw.js:16`, `scripts/bump-sw.mjs:18`, `sw.js:25`, `sw.js:48`
- **What happens now.** apps/dollywood.html is deliberately not precached (sw.js:16; scripts/bump-sw.mjs:18). Activation deletes every older cache (sw.js:25), so a cached copy is lost at each VERSION bump. Offline, the service worker returns `new Response('Offline', {status: 503})` (sw.js:48), shown as `text/plain` inside the dark viewer.
- **Why it matters.** It reads as a broken app, with no hint that one online visit fixes it.
- **Proposed fix.** Serve a styled offline page (in the hub's tokens) for uncached documents, with "Open this app once online to keep it offline".
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify-build-guide-offline-blank-1.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### P3-PRAYER-25 — Editing a family request's wording makes the prayer push announce it as "New on the family list" (from the critic)

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/03-apps/prayer.md:799`; `worker/src/reminders.js:50-63`, `worker/src/reminders.js:157`, `apps/prayer.html:1058`, `worker/src/reminders.js:195-203`; `audits/evidence/p3/prayer/verify-critic-title-edit-announced-as-new-9-1-after-save.png`, `audits/evidence/p3/prayer/verify-critic-title-edit-announced-as-new-9-2-edited-sheet.png`
- **What happens now.** The prayer job fingerprints each family row as `createdAt|title` (`worker/src/reminders.js:157`) and treats any changed fingerprint as new (`:181`). Its comment assumes the app never changes either field after creation (`:143-147`), but the Edit sheet rewrites the title (`apps/prayer.html:1058`).
- **Why it matters.** False "New on the family list" alerts teach the house to ignore the prayer push, and they use up the day's one prayer push, so a truly new request later that day is not pushed.
- **Proposed fix.** The prayer push announces only rows it has never seen (compare keys or createdAt, not titles). (Phase 3: IMP-PRAYER-P16)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/critic-push-share.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-title-edit-announced-as-new-9-1.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-title-edit-announced-as-new-9-2.mjs"` — the defect must no longer reproduce; plus batch 2b's checks.

#### PWA-GAP-2 — No `pushsubscriptionchange` handler

- **Area** shell / platform · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4824`; `sw.js:21`, `index.html:1552-1555`
- **What happens now.** sw.js listens only for install, activate, fetch, push and notificationclick (sw.js:21, 24, 31, 53, 62).
- **Why it matters.** Rotated subscriptions silently stop receiving.
- **Proposed fix.** Handle pushsubscriptionchange in sw.js by re-subscribing and posting the new subscription.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2b's checks.

#### PWA-GAP-4 — Manifest and icons are incomplete (gap, low). Evidence: manifest.json:1-17; manifest-run.json

- **Area** shell / platform · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:5058`; `manifest.json:1-17`, `index.html:12`
- **What happens now.** The manifest has no `id`, `display_override`, `shortcuts`, `screenshots`, `lang` or monochrome icon.
- **Why it matters.** Install quality on iOS and Android.
- **Proposed fix.** Complete the manifest: id, display_override, lang, shortcuts, a maskable and a monochrome icon, an opaque apple-touch-icon, and theme colours that follow the bootstrap.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2b's checks.

#### PWA-UX-2 — Guests get household pushes that rally excludes

- **Area** shell / platform · **Type** usability · **Severity** low · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4829`; `worker/src/index.js:116`, `index.html:1532`; `audits/screens/shell/me-notifications-typical-iphone-pwa-light.png`
- **What happens now.** `adultIds` selects `kind = 'adult'` with no `is_guest` filter (reminders.js:56).
- **Why it matters.** Guests get household nudges.
- **Proposed fix.** Household pushes (leftovers, prayer, park) exclude guests unless the household opts in.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2b's checks.

#### GAP-PRAYER-1 — No reminder to pray at a chosen time, and no word to the asker when someone prayed

- **Area** prayer · **Type** feature gap · **Severity** info · **Effort** M · **Batch** 2b
- **Evidence.** `audits/03-apps/prayer.md:914`; `worker/src/reminders.js:174`
- **What happens now.** No reminder to pray at a chosen time, and no word to the asker when someone prayed (info). Push has only the "new family prayer" kind for Prayer (CLAUDE.md, Push; `worker/src/reminders.js:174`). Echo Prayer offers per-prayer and group reminders at chosen times, and Reminders alerts on add and complete (https://www.echoprayer.com/; https://support.apple.com/en-us/105124). Family rows record `prayedBy`, but the asker is never told.
- **Why it matters.** Prayer apps remind and encourage.
- **Proposed fix.** Optional reminder to pray at a chosen time (a push kind, per person), and "Elizabeth prayed for your request" to the asker (info). (Phase 3: IMP-PRAYER-F5)
- **How it will be verified.** recapture its screens (capture area prayer) and compare; plus batch 2b's checks.

#### P2-STAB-05 — Under GitHub Pages' max-age=600, a new version can precache the old files, and the "Hub updated" toast is untrue (pointer → P2-PWA-09, medium)

- **Area** shell / platform · **Type** bug · **Severity** medium (pointer) · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:3199`; `sw.js:22`, `sw.js:5`, `index.html:1695`
- **Proposed fix.** Pointer to P2-PWA-09.

#### P2-PROF-17 — Admin → Usage groups chat by UTC day; the cap uses New York days (pointer)

- **Area** shell / platform · **Type** bug · **Severity** low (pointer) · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:1559`; `audits/screens/shell/me-admin-usage-typical-ipad-portrait-light.png`
- **Proposed fix.** Pointer to P2-CHAT-13: Admin → Usage groups by New York day.

#### P2-STAB-10 — A brand-new install says "Hub updated" in WebKit (pointer → P2-PWA-15, low)

- **Area** shell / platform · **Type** bug · **Severity** low (pointer) · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:3322`; `index.html:1695`, `sw.js:22`, `sw.js:25`
- **Proposed fix.** Pointer to P2-PWA-15.

#### PWA-UX-1 — Kids and the kiosk can subscribe → same issue as P2-PROF-16 (Profiles), which owns it at low and covers both the kiosk and a kid (Ezra 200/200). What this dimension adds: the kid Me shows the switch although no job targets kids (audits/screens/shell/me-kid-typical-ipad-portrait-light.png), and its "on" help text names only fridge and reading nudges (index.html:1554). The rig runs are in push-run.txt:5, 596 and 615

- **Area** shell / platform (TV) · **Type** usability · **Severity** low (pointer) · **Effort** S · **Batch** 2b
- **Evidence.** `audits/02-shell.md:4828`; `index.html:1554`; `audits/screens/shell/me-kid-typical-ipad-portrait-light.png`
- **Proposed fix.** Pointer to P2-PROF-16.

### Batch 2c — The TV board (14)

#### P2-STAB-12 — The TV kiosk takes a Screen Wake Lock only on a page load where someone taps it with a pointer, so after a reload, a restart or a remote-only setup the ambient board holds no lock

- **Area** shell / platform (TV) · **Type** bug · **Severity** medium · **Effort** S · **Batch** 2c
- **Evidence.** `audits/02-shell.md:3369`; `index.html:1710-1711`, `index.html:1708`, `index.html:1712`, `index.html:1710`
- **What happens now.** WebKit and Chromium gave the same results in both skeptics' runs.
- **Why it matters.** CLAUDE.md describes the TV as an ambient board that nobody touches. Its normal state is a page load that opens straight into the board after a power cycle, a browser restart or a reload, or one driven only by a remote. On such a load the shell never asks for a lock.
- **Proposed fix.** The kiosk requests the wake lock on load and on every visibilitychange, and shows a one-time "Tap to keep the screen on" hint only if the request is refused.
- **How it will be verified.** Rerun `node "audits/tools/phase2/STAB/wakelock.mjs"` — the defect must no longer reproduce; plus batch 2c's checks.

#### P2-VIS-02 — The TV board drops reminders off a 1080p screen, with no cue

- **Area** shell / platform (TV) · **Type** bug · **Severity** medium · **Effort** M · **Batch** 2c
- **Evidence.** `audits/02-shell.md:5462`; `index.html:1218-1225`, `index.html:1059-1061`, `index.html:1069`, `index.html:174`; `audits/screens/tv/board-overflow-tv-light.png`
- **What happens now.** The kiosk board renders every family reminder with no cap, sorted oldest first (`index.html:1218-1225`, sort at `:1220`). It also renders every face under Prayed today with no cap (`index.html:1059-1061`). Only the feed is capped, at 5 (`index.html:1069`). Because the list runs oldest first, the newest reminders are the ones pushed off.
- **Why it matters.** the room display hides the family's newest reminders on ordinary days (6 reminders, or everyone prayed), not only in stress data. Adults still see every reminder on their own Home.
- **Proposed fix.** The TV shows as many reminders as fit and a "+3 more" line; the list is newest first; the prayed-today faces wrap into a fixed-height row.
- **How it will be verified.** Rerun `node "audits/tools/phase2/VIS/verify-tv-board-overflows-1080-1.mjs"`, `node "audits/tools/phase2/VIS/leads.mjs"` — the defect must no longer reproduce; plus batch 2c's checks.

#### VIS-TYPE-1 — TV board: the kiosk block uses its phone-sized steps for information text; names, star counts, times and bylines are 18 px and the date 12 px

- **Area** design system (TV) · **Type** visual · **Severity** medium · **Effort** M · **Batch** 2c
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: Small detail: 'names … are 18 px' applies to the face captions under avatars. The names in the 'Around the house' feed lines (.who) inherit the line size, 26 px (22 px under 1050 px height).
- **Evidence.** `audits/04-design-system.md:1408`; `apps/design.css:286-289`, `index.html:153`, `apps/design.css:417`, `index.html:175`; `audits/screens/tv/board-typical-tv-light.png`
- **What happens now.** Re-measured live in System and Midnight, as eight size tiers (Table TYPE-6). Only the clock, verse refs and greeting are 10-foot sizes.
- **Why it matters.** The kids look for their stars and the parents look for who prayed, from across the room.
- **Proposed fix.** The TV's information text on the 10-foot scale with the re-laid-out grid (decision D16).
- **How it will be verified.** Rerun `node "audits/tools/phase4/TYPE/report.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 2c's checks.

#### P2-HOME-07 — The TV verse pane's kid line can never render: no writer supplies it

- **Area** shell / platform (TV) · **Type** bug · **Severity** low · **Effort** S · **Batch** 2c
- **Evidence.** `audits/02-shell.md:477`; `apps/kidverse.html:338`, `index.html:1056`, `apps/verses.html:217`, `apps/kidverse.html:276`
- **What happens now.** The TV reads `String(wk.line || wk.kid || wk.text || '')` (`index.html:1056`), under the comment "one kid line if the row carries it" (`:1052`). It hides the element when it is empty (`:147`). The only writer is Kid Verse's `setWeek`, reached only through the stepper buttons (`apps/kidverse.html:338`, `:374-376`).
- **Why it matters.** The roadmap asked for this line: "plus the kid line when the row carries one" (`scripts/test-tv.mjs:5-6`). The family TV never shows it, and the test fixture hides the gap. Nothing is lost or broken. The pane still shows the right week and both references.
- **Proposed fix.** Either Kid Verse writes the week's kid line (`line`) into the family week row when the week is set, or the TV derives it from the week number; remove the dead read otherwise (index.html:1056). (Phase 3: IMP-KIDVERSE-F1)
- **How it will be verified.** Rerun `node "audits/tools/phase2/HOME/verify2-tv-verse-kid-line-dead-1.mjs"`, `node "audits/tools/phase2/HOME/verify2-tv-verse-kid-line-dead-2.mjs"` — the defect must no longer reproduce; plus batch 2c's checks.

#### P2-PROF-10 — On the TV, a live hash change to #me / #chat / #apps renders under the board, and the hidden Me controls still take clicks

- **Area** shell / platform (TV) · **Type** bug · **Severity** low · **Effort** S · **Batch** 2c
- **Evidence.** `audits/02-shell.md:1389`; `index.html:650-654`, `index.html:626`, `index.html:129`, `index.html:1437`
- **What happens now.** after a same-document hash change on the kiosk (index.html:650-654 has no kiosk guard; enterShell forces Home only at start, index.html:626):
- **Why it matters.** there are invisible live controls on the TV.
- **Proposed fix.** On the kiosk, a hash change to #me, #chat or #apps is ignored (showTab refuses them) and the hidden Me controls are removed, not hidden.
- **How it will be verified.** Rerun `node "audits/tools/phase2/PROF/verify-kiosk-hash-nav-2.mjs"` — the defect must no longer reproduce; plus batch 2c's checks.

#### P2-STAB-11 — After the TV's Switch, the hidden board keeps running behind the picker

- **Area** shell / platform (TV) · **Type** bug (perf) · **Severity** low · **Effort** S · **Batch** 2c
- **Evidence.** `audits/02-shell.md:3340`; `index.html:1133`, `index.html:516-517`, `index.html:496`, `index.html:1110-1116`
- **What happens now.** Over 6 simulated minutes with the picker up, the board kept working:
- **Why it matters.** Rendering and image traffic are wasted on an always-on device while the picker waits.
- **Proposed fix.** The TV's Switch stops the board's intervals and crossfade loop before showing the picker, and logs the kiosk session out.
- **How it will be verified.** Rerun `node "audits/tools/phase2/STAB/tvswitch.mjs"` — the defect must no longer reproduce; plus batch 2c's checks.

#### P2-SYNC-12 — After an offline reopen the TV marks readers as not read (only 30 of 100 feed lines are cached)

- **Area** shell / platform (TV) · **Type** bug · **Severity** low · **Effort** S · **Batch** 2c
- **Evidence.** `audits/02-shell.md:2653`; `index.html:1108`, `index.html:1135`, `sw.js:9-10`
- **What happens now.** the board reads 100 feed lines but caches only the first 30 (index.html:1108), and a fresh page paints from that cache (:922).
- **Why it matters.** readers lose their ✓ on the family TV after it reopens during an outage, for up to 5 minutes after the network returns.
- **Proposed fix.** The TV caches the day's reading state it needs (the F260 family summaries), not the last 30 feed lines, so an offline reopen still knows who read.
- **How it will be verified.** Rerun `node "audits/tools/phase2/SYNC/verify-tv-reading-cache-30-rows-2.mjs"`, `node "audits/tools/phase2/SYNC/e10-tv-reading-cache.mjs"` — the defect must no longer reproduce; plus batch 2c's checks.

#### P4-GLASS-04 — The TV board's only on-screen live blur is the Switch button, against the board's own no-blur rule

- **Area** design system (TV) · **Type** bug · **Severity** low · **Effort** S · **Batch** 2c
- **Evidence.** `audits/04-design-system.md:3450`; `index.html:125-127`, `index.html:1121`, `apps/design.css:285-288`, `index.html:104`
- **What happens now.** The rule. The board's panes drop `backdrop-filter` on purpose: "the panes keep the glass recipe but drop backdrop-filter (the photo is already blurred, and a display runs 24 h)" (`index.html:125-127`, `:137`). The exception.
- **Why it matters.** The TV runs all day. One small button is the only thing on the board keeping a live blur recomputed as the clock ticks beside it, against a rule the same file states.
- **Proposed fix.** The TV's Switch uses the look without a live blur (the kiosk sets --glass-filter none; open issue 14 moves its literal recipe). (Phase 4 gap row GLASS-9)
- **How it will be verified.** Rerun `node "audits/tools/phase4/GLASS/verify-tv-switch-live-blur-3.mjs"` — the defect must no longer reproduce; plus batch 2c's checks.

#### PWA-VIS-4 — On a portrait kiosk iPad the feed shows only 2–3 words per line → owned by VIS, "The kiosk board on an iPad"

- **Area** shell / platform (TV) · **Type** visual · **Severity** low · **Effort** S · **Batch** 2c
- **Evidence.** `audits/02-shell.md:5044`; `audits/screens/tv/board-ipad-typical-ipad-portrait-light.png`
- **What happens now.** On a portrait kiosk iPad the feed shows only 2–3 words per line → owned by VIS, "The kiosk board on an iPad" (low; VIS has the only measurement: 19–45 % of each line visible at 820×1180). The Phase 1 capture is audits/screens/tv/board-ipad-typical-ipad-portrait-light.png.
- **Why it matters.** Feed lines show 2-3 words.
- **Proposed fix.** On a portrait kiosk iPad the board stacks panes in one column so each feed line has the full width.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2c's checks.

#### UX-HOME-2 — On the TV the board's news is its smallest text

- **Area** shell / platform (TV) · **Type** usability · **Severity** low · **Effort** M · **Batch** 2c
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: The headline 'the board's news is its smallest text' is misleading. The feed's news lines themselves are 26 px (11.6 mm on 55 inches) and pass H2.
- **Evidence.** `audits/02-shell.md:556`; `apps/design.css:417`, `index.html:136`
- **What happens now.** The date kicker (`.hero-kicker` stays at `--fs-xs`, `apps/design.css:417`), face labels, ★ counts, feed times and bylines all fail H2 at 3 m on a 55" TV.
- **Why it matters.** The TV is read from the sofa at 3 m; its newest facts are its smallest text.
- **Proposed fix.** On the TV, news lines and names use the 10-foot scale (`data-tv-scale="10ft"`, decision D16) with the re-laid-out grid.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2c's checks.

#### UX-PROF-a2 — The TV lists guests under "Reading today" as not read

- **Area** shell / platform (TV) · **Type** usability · **Severity** low · **Effort** S · **Batch** 2c
- **Evidence.** `audits/02-shell.md:939`; `index.html:1064`, `worker/src/index.js:170`, `index.html:1063`; `audits/screens/tv/board-typical-tv-light.png`, `audits/evidence/p2/VIS/rev-critic-gaps-A-kiosk-feed-ipad-portrait.png`
- **What happens now.** The pane lists every profile of kind `adult` (index.html:1064). A guest is always stored as kind `adult` (worker/src/index.js:170).
- **Why it matters.** Grandma Jo sits dimmed beside the family as if she had not read.
- **Proposed fix.** The TV's "Reading today" pane lists household readers only (not guests), or marks a guest as a guest.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 2c's checks.

#### UX-SYNC-a2 — The TV's "Reading today" lags up to 5 minutes and is built from feed lines rather than F260 data

- **Area** shell / platform (F260, TV) · **Type** usability · **Severity** low · **Effort** S · **Batch** 2c
- **Evidence.** `audits/02-shell.md:2918`; `index.html:1063`
- **What happens now.** Readers are the profiles with a "Read week…" feed line dated today (index.html:1063), re-read every 5 minutes (:1115). Eli's ✓ appeared 178.9 s after his tick (e5; e5-tv-after-reading-shows.png).
- **Why it matters.** The TV lags five minutes and can credit the wrong person.
- **Proposed fix.** The TV's "Reading today" reads the F260 family summaries (readOn === today) instead of feed lines, and refreshes on the normal pull.
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 2c's checks.

#### P2-CHAT-14 — Kiosk: a hash change to `#chat` shows a live composer over the TV board

- **Area** shell / platform (TV) · **Type** bug · **Severity** low (pointer) · **Effort** S · **Batch** 2c
- **Evidence.** `audits/02-shell.md:4281`; `index.html:129`, `index.html:68`, `index.html:130`, `index.html:78`
- **Proposed fix.** Pointer to P2-PROF-10.

#### P2-PROF-11 — TV Switch leaves the board running; the board's Switch leaves a server session (pointer)

- **Area** shell / platform (TV) · **Type** bug (perf) · **Severity** low (pointer) · **Effort** S · **Batch** 2c
- **Evidence.** `audits/02-shell.md:1414`; `index.html:1133`
- **Proposed fix.** Pointer to P2-STAB-11: the TV's Switch stops the board's timers and logs the kiosk session out on the server.

### Batch 3 — Prayer (37)

#### P3-PRAYER-07 — On List, a tick or any remote change folds every open category shut

- **Area** prayer · **Type** bug · **Severity** medium · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:371`; `apps/prayer.html:1265`, `apps/prayer.html:699-705`; `audits/evidence/p3/prayer/list-collapse-1-open.png`, `audits/evidence/p3/prayer/list-collapse-2-after-tick.png`
- **What happens now.** A tick on List calls `renderAll()` (`apps/prayer.html:1265`), and `groupedHTML` opens groups only while there is a search term (`:950`). Every remote change runs `absorbRemote` → `renderAllScreens` (`:699-705`), which does the same; `absorbRemote` waits only while a sheet, Pray now or a focused input is open (`:701-703`).
- **Why it matters.** Praying down a category means reopening it after every tick, and on the 24/7 Kitchen iPad it folds whenever anyone else prays or edits.
- **Proposed fix.** Remember which categories are open and keep them open across re-renders. (Phase 3: IMP-PRAYER-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-list-group-collapses-1.mjs"`, `node "audits/tools/phase3/prayer/verify-list-group-collapses-2.mjs"`, `node "audits/tools/phase3/prayer/list-collapse.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-08 — "Send to family list" drops a weekly request's days

- **Area** prayer · **Type** bug · **Severity** medium · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:394`; `apps/prayer.html:1314-1315`, `apps/prayer.html:809-835`, `apps/prayer.html:813-818`; `audits/evidence/p3/prayer/verify-share-drops-days-2-eli-family-today.png`, `audits/evidence/p3/prayer/verify-share-drops-days-2-mom-copy-edit.png`
- **What happens now.** The family copy keeps `cadence` but is written with `days:[]` (`apps/prayer.html:1314-1315`), and the weekly filter needs a day (`:822`). The add and edit forms both refuse a weekly request with no days ("Pick at least one day.", `:1435, 1056`); the share path is the only writer that creates one.
- **Why it matters.** A request someone deliberately shared with the family never comes up for anyone, kids included, and the sender is not told.
- **Proposed fix.** "Send to family list" copies the weekly days with the cadence.
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-share-drops-days-1.mjs"`, `node "audits/tools/phase3/prayer/verify-share-drops-days-2.mjs"`, `node "audits/tools/phase3/prayer/leads.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-19 — An open Kitchen view never refreshes: other people's adds and answers do not appear (from the critic)

- **Area** prayer · **Type** bug · **Severity** medium · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:651`; `apps/prayer.html:555`, `apps/prayer.html:712`; `audits/evidence/p3/prayer/critic-kitchen-stale-ipad.png`, `audits/evidence/p3/prayer/verify-critic-kitchen-view-stale-3-1-ipad.png`
- **What happens now.** `openKitchen()` is the only code that writes `#kitchenBody` (`apps/prayer.html:555, 1645-1656`). A remote change runs `absorbRemote` → `load()` and `renderAllScreens()` (`:699-705, 1152`), which never rebuild it, and the Kitchen overlay is not in the busy test (`:701-702`), so the repaint runs underneath.
- **Why it matters.** The counter display drifts from the real list with no sign: a new request is missing and an answered one is still asked for.
- **Proposed fix.** Kitchen view re-renders on remote changes and at the day rollover. (Phase 3: IMP-PRAYER-P13)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/critic-sweep.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-kitchen-view-stale-3-1.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-kitchen-view-stale-3-2.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-20 — The Add form never says which list it adds to, so a private request can land on the family list (from the critic)

- **Area** prayer · **Type** bug · **Severity** medium · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:676`; `apps/prayer.html:633`, `apps/prayer.html:707`, `apps/prayer.html:479-501`, `worker/src/reminders.js:174-204`; `audits/evidence/p3/prayer/critic-add-on-family.png`, `audits/evidence/p3/prayer/verify-critic-add-screen-no-list-name-4-1-add-screen.png`
- **What happens now.** Add pushes to `L()`, the list last chosen on Today (`apps/prayer.html:707, 1436`). The screen reads "Add a request / What are you praying for? / Who is it for? / Detail / Their number… / Category / How often / Add to the list" (`:479-501`), with no list name and no switch; Category defaults to "Personal".
- **Why it matters.** A request an adult meant to keep private goes to the kids' cards, guests and other adults' lock screens with no warning.
- **Proposed fix.** The Add screen names its target ("Add to My list" / "Add to the Family list") and offers the switch. (Phase 3: IMP-PRAYER-P6)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/critic-add-focus.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-add-screen-no-list-name-4-1.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-add-screen-no-list-name-4-2.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### UX-PRAYER-2 — Kid cards: prayed and not-prayed look almost the same, the untapped button already says "Prayed", and nothing tells a pre-reader what a request is

- **Area** prayer · **Type** usability · **Severity** medium · **Effort** M · **Batch** 3
- **Verified (step 3).** was medium; skeptics medium (partly) and medium (partly). Correction: 'A 4-5-year-old or a colour-blind viewer cannot tell done from not done' is overstated. For colour-typical vision the two fills differ clearly in hue (dE 26-36); only the luminance ratio is low (1.06-1.75). The near-invisible case is simulated protanopia on Kiara's dark palette (dE 4.2).
- **Evidence.** `audits/03-apps/prayer.md:859`; `apps/prayer.html:1587-1588`, `apps/prayer.html:427`; `audits/evidence/p3/prayer/vischeck-kid-states-ezra-dark.png`, `audits/screens/prayer/kid-typical-ipad-portrait-light.png`
- **What happens now.** Every kid button reads "✓ Prayed", with the same check and label before and after the tap (`apps/prayer.html:1587-1588`). Only the fill changes, from the profile colour to olive (`:427`), plus a faded title.
- **Why it matters.** A pre-reader cannot tell prayed from not prayed.
- **Proposed fix.** Kid cards: "Pray" (hands icon) before, a big ✓ and the kid's face after, a clear colour change, and each request read aloud on tap. (Phase 3: IMP-PRAYER-P7)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### UX-PRAYER-4 — Settings never says which list it edits, and silently edits the family plan

- **Area** prayer · **Type** usability · **Severity** medium · **Effort** S · **Batch** 3
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: The report understates one point: the list choice carries across devices, because activeList is a person-scope row, not just 'the list last chosen on Today' on that device. It also leaves out that Paste writes to the family list in the same way.
- **Evidence.** `audits/03-apps/prayer.md:868`; `apps/prayer.html:707-708`, `apps/prayer.html:503-532`; `audits/screens/prayer/settings-typical-iphone-pwa-light.png`
- **What happens now.** Plans, categories and paste all act on the list last chosen on Today (`apps/prayer.html:707-708, 1171-1227`). The headings are "Settings, Prayer plan, Paste a list, Categories, Backup" and never name "My list" or "Family". On Family, a plan change rewrites the house's plan row.
- **Why it matters.** Family plans change silently.
- **Proposed fix.** Settings names the list it edits ("Family list settings") and warns before a family change. (Phase 3: IMP-PRAYER-P6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### P3-PRAYER-09 — Undo after Mark answered does nothing if a remote change lands within its 6 s

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:417`; `apps/prayer.html:1331`, `apps/prayer.html:630-639`, `apps/hub.js:286-302`, `apps/prayer.html:1760`; `audits/evidence/p3/prayer/verify-undo-stale-object-2-remote-after-undo.png`
- **What happens now.** The Undo closure holds the old row object (`apps/prayer.html:1331`). A remote change runs `absorbRemote` → `load()` (`:699-705`), which rebuilds every row as a new object; its busy test ignores the toast.
- **Why it matters.** Undo is the one safety net after "Mark answered", and it silently fails.
- **Proposed fix.** Undo finds the row again by id after a remote change.
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-undo-stale-object-1.mjs"`, `node "audits/tools/phase3/prayer/verify-undo-stale-object-2.mjs"`, `node "audits/tools/phase3/prayer/undo-stale.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-12 — The "Needs attention" badge counts a request twice

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:490`; `apps/prayer.html:803-806`, `apps/prayer.html:797-799`, `apps/prayer.html:981`; `audits/evidence/p3/prayer/verify-review-double-count-2-iphone.png`, `audits/screens/prayer/record-review-typical-iphone-pwa-light.png`
- **What happens now.** The "Gone quiet" and "No news in a while" filters overlap (`apps/prayer.html:797-799`), and the badge adds all three lists (`:981`). It shows 8 for 6 distinct requests; "Believers facing persecution" and "Wisdom for the city council" each appear under both headings.
- **Why it matters.** The number overstates what needs attention, and the repeated rows look like a glitch.
- **Proposed fix.** The "Needs attention" badge counts distinct requests. (Phase 3: IMP-PRAYER-P9)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-review-double-count-1.mjs"`, `node "audits/tools/phase3/prayer/verify-review-double-count-2.mjs"`, `node "audits/tools/phase3/prayer/leads.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-13 — The gold streak cheer shows under "Nothing on the list today."

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:510`; `apps/prayer.html:885`, `apps/prayer.html:734-739`; `audits/evidence/p3/prayer/verify-cheer-at-zero-2-mae-iphone.png`, `audits/screens/prayer/today-unscheduled-typical-iphone-pwa-light.png`
- **What happens now.** `left = set.length - done` is 0 when nothing is scheduled (`apps/prayer.html:885`), and the cheer is gated only on `left === 0` (`:909`). Mae's page (by-day plan, nothing scheduled on Tuesday) reads "Nothing on the list today." with the gold cheer "3 days in a row." and the strip "0/0 today", although she has not prayed today.
- **Why it matters.** It congratulates a finished list that never existed, and repeats the strip's text.
- **Proposed fix.** No cheer when nothing was scheduled.
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-cheer-at-zero-1.mjs"`, `node "audits/tools/phase3/prayer/verify-cheer-at-zero-2.mjs"`, `node "audits/tools/phase3/prayer/leads.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-14 — A category row's count disagrees with its Remove confirm

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:530`; `apps/prayer.html:1171-1175`, `apps/prayer.html:1171-1180`; `audits/evidence/p3/prayer/verify-category-count-mismatch-1-confirm.png`, `audits/screens/prayer/settings-delcat-typical-iphone-pwa-light.png`
- **What happens now.** The row counts active requests (`apps/prayer.html:1171-1175`), while the Remove confirm counts active and answered (`:1357`), and Remove moves both to Personal (`:1362`). "Health Needs 1" sits above "2 requests are in "Health Needs"…".
- **Why it matters.** A row showing 0 invites a Remove that then says a request will be moved.
- **Proposed fix.** The category row and its Remove confirm count the same set.
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-category-count-mismatch-1.mjs"`, `node "audits/tools/phase3/prayer/verify-category-count-mismatch-2.mjs"`, `node "audits/tools/phase3/prayer/leads.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-15 — The family delete confirm says deletions do not sync, but they do

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:550`; `apps/prayer.html:1258-1259`, `apps/hub.js:244`, `apps/prayer.html:692`; `audits/evidence/p3/prayer/verify-delete-copy-wrong-1-confirm.png`, `audits/screens/prayer/ask-delete-typical-iphone-pwa-light.png`
- **What happens now.** On the family list the confirm reads "Sync does not carry deletions, so it can come back from another device." (`apps/prayer.html:1258-1259`), but `save()` sends a tombstone through `hub.remove` (`:692`; `apps/hub.js:244`), and other devices drop the row on their next pull.
- **Why it matters.** It may make an adult hesitate or delete twice; the result is correct.
- **Proposed fix.** The family delete confirm says the delete reaches everyone.
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-delete-copy-wrong-1.mjs"`, `node "audits/tools/phase3/prayer/verify-delete-copy-wrong-2.mjs"`, `node "audits/tools/phase3/prayer/leads.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-16 — The headline says "to pray through this morning" at any hour

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:570`; `apps/prayer.html:890`, `apps/prayer.html:884-897`, `apps/prayer.html:600`, `apps/prayer.html:1287`; `audits/evidence/p3/prayer/verify-morning-copy-evening-2-eli-2110.png`
- **What happens now.** The adult headline hard-codes "this morning." (`apps/prayer.html:890`). At 21:10 the page reads "6 to pray through this morning." Kids get "Pray with the family" instead (`:891-897`).
- **Why it matters.** The family also prays in the evening (the hub's 8 pm nudge is for F260); the wording reads as a mistake.
- **Proposed fix.** Time-aware headline ("to pray through today", "this evening").
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/verify-morning-copy-evening-1.mjs"`, `node "audits/tools/phase3/prayer/verify-morning-copy-evening-2.mjs"`, `node "audits/tools/phase3/prayer/leads.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-21 — An undone tick still counts the day in the streak, month count and calendar (from the critic)

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:701`; `apps/prayer.html:1604`, `apps/prayer.html:732-739`; `audits/evidence/p3/prayer/critic-untick-record.png`, `audits/evidence/p3/prayer/verify-critic-untick-keeps-day-5-1-record.png`
- **What happens now.** `setPrayed` calls `markDay()` when a request is marked (`apps/prayer.html:1604`), and `markDay()` only adds (`:732-733`). Nothing removes `TODAY` from `prayerDays` on an un-tick; the only other writers are import (`:1513`) and the unused `mergeShared` (`:1700`).
- **Why it matters.** The streak and the Record calendar credit a day on which the person did not pray, and the Today strip contradicts itself ("0/1 today" beside "1 day in a row").
- **Proposed fix.** An untick that leaves nothing marked today removes today from prayerDays (family list: only when no one marked today). (Phase 3: IMP-PRAYER-P14)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/critic-sweep.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-untick-keeps-day-5-1.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-untick-keeps-day-5-2.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-22 — Every Sunday Today says "Some of the list has gone quiet" even when nothing has (from the critic)

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:726`; `apps/prayer.html:604`, `apps/prayer.html:803-806`, `apps/prayer.html:396`, `apps/prayer.html:912`; `audits/evidence/p3/prayer/critic-sunday-christian-today.png`, `audits/evidence/p3/prayer/critic-sunday-niece-today.png`
- **What happens now.** `reviewDue()` is true on any Sunday without reading the review lists (`apps/prayer.html:803-806`), and Today then shows "Some of the list has gone quiet." with "See what" (`:911-913`). On Sun 27 Sep, Mae and Mea both had cold 0, silent 0 and fresh 0 and still saw the prompt. See what opened Record, which said "Nothing needs attention.
- **Why it matters.** The app contradicts itself one tap later and adds guilt copy on the day the family sets aside.
- **Proposed fix.** On Sundays with nothing gone quiet, show a neutral review line or nothing.
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/critic-sweep.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-1.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-2.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-23 — Removing the category a "One category only" plan uses leaves the plan pointing at a deleted category (from the critic)

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:750`; `apps/prayer.html:1348-1350`, `apps/prayer.html:813-815`, `apps/prayer.html:1410`; `audits/evidence/p3/prayer/critic-focus-settings-after-remove.png`, `audits/evidence/p3/prayer/critic-focus-today-after-remove.png`
- **What happens now.** Rename fixes each plan's `dayMap` and its `focusCategory` (`apps/prayer.html:1348-1350`); Remove fixes only `dayMap` (`:1363-1364`). In focus mode `todaySet` keeps only requests in `focusCategory` (`:813-815`), and the Settings select marks an option selected only when it equals `focusCategory` (`:1196-1199`).
- **Why it matters.** Settings shows one category while Today filters by one that no longer exists. The list empties with no reason given, and on the family list it empties for everyone.
- **Proposed fix.** Removing a category re-points a "One category only" plan to Personal. (Phase 3: IMP-PRAYER-P14)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/critic-add-focus.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-focus-plan-deleted-category-7-1.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-focus-plan-deleted-category-7-2.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P3-PRAYER-26 — Escape closes only Pray mode; the sheet, More, Kitchen view and ask panels ignore it, and Enter submits nothing (from the critic)

- **Area** prayer · **Type** bug · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:824`; `apps/prayer.html:1079-1083`, `apps/prayer.html:1709-1714`, `apps/prayer.html:481-482`; `audits/evidence/p3/prayer/verify-critic-no-enter-escape-10-1-sheet-after-escape.png`
- **What happens now.** The only keydown listener is Pray mode's, and it returns unless Pray mode is open (`apps/prayer.html:1709-1714`). `ask()` wires Save and Cancel to clicks only (`:1089-1126`). `#f-title` is not inside a `<form>`, and `#f-save` is a plain button wired to click (`:481-482, 499, 1429`).
- **Why it matters.** On the desktop, keyboard users must reach for the mouse, or Tab to a button, to dismiss every overlay and submit every form.
- **Proposed fix.** Escape closes the sheet, Kitchen view and ask panels; Enter submits the Add form and single-line fields. (Phase 3: IMP-PRAYER-P17)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/critic-keys.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-no-enter-escape-10-1.mjs"`, `node "audits/tools/phase3/prayer/verify-critic-no-enter-escape-10-2.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### P4-SHAPE-02 — Prayer's toast action is a 36×22 target: Undo after "Mark answered" and "Open it" after an add, offered for 6 seconds

- **Area** design system (Prayer) · **Type** bug · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/04-design-system.md:2060`; `apps/prayer.html:563`, `apps/prayer.html:46`, `apps/hub.js:431`; `audits/screens/prayer/mark-answered-typical-iphone-pwa-light.png`
- **What happens now.** The toast is one element for every message (`apps/prayer.html:563`). Its button is styled `.toast button{background:none;border:none;…font-size:14px;font-weight:700;cursor:pointer;padding:0}` (`:260-261`), with no minimum size.
- **Why it matters.** A grandparent who marks the wrong request answered has 6 seconds to hit a 22 px word.
- **Proposed fix.** Prayer's toast action at var(--tap) (use the shared toast).
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/verify-prayer-undo-target-2.mjs"`, `node "audits/tools/phase4/SHAPE/verify.mjs"` — the defect must no longer reproduce; plus batch 3's checks.

#### UX-PRAYER-1 — The Add form's main button starts hidden under the tab bar

- **Area** prayer · **Type** usability · **Severity** low · **Effort** S · **Batch** 3
- **Verified (step 3).** was medium; skeptics low and low (partly). Correction: The facts are correct. The item also applies to iPhone Safari (save at 846 against a nav at 615) and to the + button path. The rating is inflated: medium should be low, because a single scroll reveals the button and the flow is occasional.
- **Evidence.** `audits/03-apps/prayer.md:855`; `apps/prayer.html:479-501`; `audits/evidence/p3/prayer/layout-add-iphone.png`, `audits/screens/prayer/add-typical-iphone-pwa-light.png`
- **What happens now.** When Add opens, "Add to the list" sits at y 846-904 while the nav starts at y 807 on the iPhone PWA and at 695 on iPad landscape; on desktop it is at y 843 with the nav at 775. It is visible on iPad portrait.
- **Why it matters.** The main button starts hidden.
- **Proposed fix.** Scroll the Add button into view (or pin it above the tab bar) when Add opens. (Phase 3: IMP-PRAYER-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/prayer/layout.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 3's checks.

#### UX-PRAYER-3 — Nothing in Prayer is legible from across the room, including "Kitchen view — Big type for the counter"

- **Area** prayer · **Type** usability · **Severity** low · **Effort** M · **Batch** 3
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: The '2-3 m needs roughly 90-130 px type' figure is wrong under the report's own heuristic: about 69-104 px (comfortable) or 40-61 px (minimum).
- **Evidence.** `audits/03-apps/prayer.md:865`; `apps/prayer.html:357-362`; `audits/screens/prayer/kitchen-typical-ipad-landscape-light.png`
- **What happens now.** Measured readable distances on the iPad: h1 0.88 m, row titles 0.50 m, meta 0.38 m, nav 0.35 m, kid titles 0.96 m, Kitchen items (24 px) 0.69 m and its heading 1.0 m. 2-3 m needs roughly 90-130 px type.
- **Why it matters.** "Big type for the counter" is not legible from across the room.
- **Proposed fix.** Kitchen view uses the glance roles (titles ≥ 44 px) and a dark calm layout for the counter. (Phase 3: IMP-PRAYER-F1)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### UX-PRAYER-5 — Two different controls are both called "More"

- **Area** prayer · **Type** usability · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:871`; `apps/prayer.html:453`; `audits/screens/prayer/today-typical-iphone-pwa-light.png`
- **What happens now.** Two different controls are both called "More" (low). Today's "··· More" opens Kitchen view, Copy and Print (`apps/prayer.html:453, 1725-1735`); the tab bar's "More" opens Settings (`:570`). Evidence: `audits/evidence/p3/prayer/leads.json` (twoMores); `audits/screens/prayer/today-typical-iphone-pwa-light.png`.
- **Why it matters.** Two controls called More.
- **Proposed fix.** Rename Today's "More" to "Share & print". (Phase 3: IMP-PRAYER-P6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### UX-PRAYER-6 — A family request's detail sheet hides who asked and who prayed today

- **Area** prayer · **Type** usability · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:872`; `apps/prayer.html:985-1019`; `audits/screens/prayer/detail-family-typical-iphone-pwa-light.png`
- **What happens now.** A family request's detail sheet hides who asked and who prayed today (low). The row shows "X asked" and the faces; the sheet shows neither (`apps/prayer.html:985-1019`). Evidence: `audits/evidence/p3/prayer/leads.json` (L21-familyDetail); `audits/screens/prayer/detail-family-typical-iphone-pwa-light.png`.
- **Why it matters.** The sheet hides context the row shows.
- **Proposed fix.** The detail sheet shows who asked and who prayed today. (Phase 3: IMP-PRAYER-F2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### UX-PRAYER-7 — List category groups give no sign that they open

- **Area** prayer · **Type** usability · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:873`; `apps/prayer.html:127-130`; `audits/screens/prayer/list-typical-iphone-pwa-light.png`
- **What happens now.** List category groups give no sign that they open (low). The `<summary>` marker is hidden and there is no chevron (`apps/prayer.html:127-130`). Evidence: `audits/evidence/p3/prayer/leads.json` (L23-detailsChevron); `audits/screens/prayer/list-typical-iphone-pwa-light.png`.
- **Why it matters.** Groups give no sign they open.
- **Proposed fix.** A chevron on each category group.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### UX-PRAYER-9 — Pray now is not full-screen inside the hub, and its Close is a small text link

- **Area** prayer · **Type** usability · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:877`; `apps/prayer.html:324-331`; `audits/evidence/p3/prayer/layout-pray-iphone.png`, `audits/screens/prayer/pray-mode-typical-iphone-pwa-light.png`
- **What happens now.** Pray now is not full-screen inside the hub, and its Close is a small text link (low). The overlay fills the frame, but the shell's 48 px top bar stays above it; Close is 13.5 px text in a 49×33 box (`apps/prayer.html:324-331`). Evidence: `audits/evidence/p3/prayer/layout.json` (`pray.frameOffsetTop` 48); `audits/evidence/p3/prayer/layout-pray-iphone.png`; `audits/screens/prayer/pray-mode-typical-iphone-pwa-light.png`.
- **Why it matters.** Pray now is not full-screen.
- **Proposed fix.** Pray now hides the shell viewer bar (full screen) and gets a 44 px Close.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### UX-PRAYER-10 — Rows are not sorted, so prayed rows sit mid-list

- **Area** prayer · **Type** usability · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:878`; `apps/prayer.html:835`, `apps/hub.js:225-229`
- **What happens now.** Rows are not sorted, so prayed rows sit mid-list (low). Today is built daily, then weekly, then rotation (`apps/prayer.html:835`), each group in `hub.list` cache order (`apps/hub.js:225-229`): `p003, p004, p001✓, p002✓, p005✓, p006, …`. Order can differ by device. Evidence: `audits/evidence/p3/prayer/leads.json` (L15-rowOrder).
- **Why it matters.** Prayed rows sit mid-list.
- **Proposed fix.** Sort prayed rows to the end of Today.
- **How it will be verified.** recapture its screens (capture area prayer) and compare; plus batch 3's checks.

#### UX-PRAYER-11 — The paste parser keeps "Name - request" titles lower-case

- **Area** prayer · **Type** usability · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:879`; `apps/prayer.html:1466-1469`; `audits/screens/prayer/settings-paste-typical-iphone-pwa-light.png`
- **What happens now.** The paste parser keeps "Name - request" titles lower-case (low). Titles come out as "recovery after surgery" and "settling in Kenya" (`apps/prayer.html:1466-1469`). Evidence: `audits/evidence/p3/prayer/leads.json` (L24-paste); `audits/screens/prayer/settings-paste-typical-iphone-pwa-light.png`.
- **Why it matters.** Lower-case titles.
- **Proposed fix.** The paste parser capitalises titles.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### UX-PRAYER-12 — Backup import needs the whole JSON file pasted into a textarea

- **Area** prayer · **Type** usability · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:880`; `apps/prayer.html:1500-1506`; `audits/screens/prayer/settings-import-typical-iphone-pwa-light.png`
- **What happens now.** Backup import needs the whole JSON file pasted into a textarea (low). Export downloads `prayers-<date>.json` (26 KB in the rig; `apps/prayer.html:1500-1506`); import is paste-only with no file picker (`:1518-1522`), which is impractical on an iPad. Evidence: `audits/evidence/p3/prayer/import-family.json` (export via download event, 26361 bytes); `audits/screens/prayer/settings-import-typical-iphone-pwa-light.png`.
- **Why it matters.** Pasting a 26 KB JSON is impractical on a phone.
- **Proposed fix.** Import accepts the exported file through a file picker as well as paste. (Phase 3: IMP-PRAYER-F3)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### UX-PRAYER-13 — Every Prayed tap, including each Pray now step, posts its own feed line

- **Area** prayer · **Type** usability · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:881`; `apps/prayer.html:1606`
- **What happens now.** Every Prayed tap, including each Pray now step, posts its own feed line (low; related P2-PWA-01, P2-PWA-13). `setPrayed` calls `hub.activity('Prayed for …')` on every mark (`apps/prayer.html:1606`), and each Pray now step goes through it (`:1706`), so one run of 6 posts 6 lines to "Around the house". For private requests those lines include the titles (P2-PWA-01 owns the leak).
- **Why it matters.** A feed line per tap.
- **Proposed fix.** One feed line per Pray now session ("Prayed through 6 requests").
- **How it will be verified.** recapture its screens (capture area prayer) and compare; plus batch 3's checks.

#### UX-PRAYER-14 — A finished Today still leads with Pray now and shows the cheer twice

- **Area** prayer · **Type** usability · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:882`; `audits/screens/prayer/today-done-typical-iphone-safari-light.png`
- **What happens now.** A finished Today still leads with Pray now and shows the cheer twice (low; from the visual check). With 9/9 done, the full-width "Pray now" remains the main action, and the streak cheer appears both as gold inline text and as a toast with the same words ("9 days in a row."). Evidence: `audits/screens/prayer/today-done-typical-iphone-safari-light.png`.
- **Why it matters.** A finished list still leads with Pray now.
- **Proposed fix.** When Today is finished, lead with "All prayed ✓" and hide Pray now; one cheer.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### VIS-PRAYER-2 — The + button covers the last content on iPhone, on Today and List

- **Area** prayer · **Type** visual · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:897`; `apps/prayer.html:47`; `audits/evidence/p3/prayer/layout-today-bottom-iphone.png`, `audits/evidence/p3/prayer/vischeck-fab-list-iphone-pwa.png`
- **What happens now.** The body's bottom padding (96 px) clears the nav but not the + (`apps/prayer.html:47, 264-266`).
- **Why it matters.** The + covers content.
- **Proposed fix.** Bottom padding clears the + FAB as well as the nav. (Phase 3: IMP-PRAYER-P5)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### VIS-PRAYER-3 — Category Rename/Remove and the Pray-mode Close are under 44 pt

- **Area** prayer · **Type** visual · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:902`; `apps/prayer.html:217-218`; `audits/screens/prayer/settings-categories-typical-iphone-pwa-light.png`
- **What happens now.** Category Rename/Remove and the Pray-mode Close are under 44 pt (low). Rename 59×31, Remove 57×31 (padding 5px 3px, `apps/prayer.html:217-218`), Pray-mode Close 49×33 (`:330-331`); long names stack the two buttons into a column. Evidence: `audits/evidence/p3/prayer/layout.json` (`smallTargets`, `pray.close`); `audits/screens/prayer/settings-categories-typical-iphone-pwa-light.png`.
- **Why it matters.** Targets under 44 pt.
- **Proposed fix.** Rename/Remove and the Pray-mode Close at var(--tap).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### VIS-PRAYER-5 — The Record calendar has no month name, its weekday letters sit under the grid, and empty days vanish in dark mode

- **Area** prayer · **Type** visual · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:904`; `apps/prayer.html:762-763`, `apps/prayer.html:752-764`; `audits/screens/prayer/record-typical-ipad-portrait-dark.png`, `audits/screens/prayer/record-empty-ipad-portrait-dark.png`
- **What happens now.** The Record calendar has no month name, its weekday letters sit under the grid, and empty days vanish in dark mode (low). The weekday row is emitted after the grid (`apps/prayer.html:762-763`); empty cells use `--sunk`. Evidence: `apps/prayer.html:752-764`; `audits/evidence/p3/prayer/leads.json` (L22-calendar); `audits/screens/prayer/record-typical-ipad-portrait-dark.png`; `audits/screens/prayer/record-empty-ipad-portrait-dark.png`.
- **Why it matters.** An unlabelled calendar.
- **Proposed fix.** The Record calendar gets a month name, weekday letters above the grid and ≥ 3:1 empty days.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### VIS-PRAYER-6 — On desktop and iPad landscape the page is a 33rem column with the + pinned far right

- **Area** prayer · **Type** visual · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:905`; `apps/prayer.html:50`; `audits/screens/prayer/today-typical-ipad-landscape-light.png`, `audits/screens/prayer/today-typical-desktop-light.png`
- **What happens now.** On desktop and iPad landscape the page is a 33rem column with the + pinned far right (low). `.wrap{max-width:33rem}` (`apps/prayer.html:50`) centres the page at 528 px, while the + sits at x 1362 of 1440 (desktop) and 1102 of 1180 (iPad landscape). On iPad landscape with a long plan name (overflow seed), the header, the meter, the wrapped stats strip, the actions and the review nudge fill y 0-580 of 820, so one request shows above the nav (added after the critic). Evidence: `audits/evidence/p3/prayer/layout.json` (`targets.fab`); `audits/screens/prayer/today-typical-ipad-landscape-light.png`; `audits/screens/prayer/today-typical-desktop-light.png`; `audits/screens/prayer/today-overflow-ipad-landscape-light.png`.
- **Why it matters.** The + is pinned far from the content.
- **Proposed fix.** On wide screens the column is --col-narrow centred with the + at its edge (restyle only).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### VIS-PRAYER-8 — The stats strip wraps on phones and shows a row of zeros when nothing is scheduled

- **Area** prayer · **Type** visual · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:907`; `apps/prayer.html:75-78`; `audits/screens/prayer/today-empty-iphone-pwa-light.png`
- **What happens now.** The stats strip wraps on phones and shows a row of zeros when nothing is scheduled (low). On the iPhone "5 answered" drops to y 279 while the others sit at y 229 (`apps/prayer.html:75-78, 904-908`); empty and unscheduled states show "0/0 today …". Evidence: `audits/evidence/p3/prayer/leads.json` (L25-stripWrap); `audits/screens/prayer/today-empty-iphone-pwa-light.png`.
- **Why it matters.** A ragged strip of zeros.
- **Proposed fix.** The stats strip wraps as two rows of two and hides zeros when nothing is scheduled.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### VIS-PRAYER-9 — The detail sheet runs edge to edge across the iPad and over the app's own nav

- **Area** prayer · **Type** visual · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:908`; `audits/screens/prayer/detail-typical-ipad-portrait-light.png`, `audits/screens/prayer/detail-typical-iphone-pwa-dark.png`
- **What happens now.** The detail sheet runs edge to edge across the iPad and over the app's own nav (low; from the visual check). On iPad portrait (820 px) the sheet spans the full width with its content in a 33rem column; iPadOS would show a centred, inset sheet. In the dark iPhone capture the translucent sheet lets the rows behind compete with its text (the rig paints no blur, so judge legibility on a device). Evidence: `audits/screens/prayer/detail-typical-ipad-portrait-light.png`; `audits/screens/prayer/detail-typical-iphone-pwa-dark.png`.
- **Why it matters.** Edge-to-edge sheet on the iPad.
- **Proposed fix.** The detail sheet is --col-narrow wide and centred on the iPad.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### VIS-PRAYER-11 — Pray mode on iPad landscape spreads its chrome to the corners

- **Area** prayer · **Type** visual · **Severity** low · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:910`; `audits/screens/prayer/pray-mode-last-typical-ipad-landscape-dark.png`
- **What happens now.** Pray mode on iPad landscape spreads its chrome to the corners (low; from the visual check). The progress bar spans 26-1154 px over a centred column of about 500 px, and "6 of 6" and the text "Close" are pinned to the far corners, away from Back / Prayed / Skip. Evidence: `audits/screens/prayer/pray-mode-last-typical-ipad-landscape-dark.png`.
- **Why it matters.** Chrome spread to the corners.
- **Proposed fix.** Pray mode on iPad landscape keeps its chrome inside the centred column.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### GAP-PRAYER-2 — The answered record cannot be searched, filtered or grouped inside Record

- **Area** prayer · **Type** feature gap · **Severity** info · **Effort** S · **Batch** 3
- **Evidence.** `audits/03-apps/prayer.md:915`; `apps/prayer.html:967-969`; `audits/screens/prayer/record-answered-typical-iphone-pwa-light.png`
- **What happens now.** The answered record cannot be searched, filtered or grouped inside Record (info). Record → Answered is one newest-first list with no year grouping (`apps/prayer.html:967-969`); search lives only in List, which shows answered prayers only while searching (`:946-952`); Print covers the last 90 days (`:1662`). Answered rows are kept forever. Evidence: `audits/screens/prayer/record-answered-typical-iphone-pwa-light.png`.
- **Why it matters.** The answered history cannot be searched.
- **Proposed fix.** Record → Answered: search and year grouping (info). (Phase 3: IMP-PRAYER-F4)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 3's checks.

#### VIS-SHAPE-4 — Prayer's toast wraps a short message onto two lines on the iPhone, because its centring caps it at half the viewport

- **Area** design system (Prayer) · **Type** visual · **Severity** low (pointer) · **Effort** S · **Batch** 3
- **Evidence.** `audits/04-design-system.md:2343`; `apps/prayer.html:254-257`, `apps/design.css:588`
- **Proposed fix.** Pointer to P4-SHAPE-04 (Prayer adopts the shared toast). (Phase 4 gap row SHAPE-14)

#### Improvements with no finding (prayer)

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). They are optional; Phase 6 carries them only if the household wants them.

| ID | Improvement | Kind | Delight | Effort | Source |
|---|---|---|---|---|---|
| IMP-PRAYER-I1 | "Around the table" pass-the-iPad Pray now: a family Pray now that shows each asker's face large and records everyone at the table with one tap each | idea | 4 | M | `audits/03-apps/prayer.md:1095` |
| IMP-PRAYER-I2 | Answered-prayer anniversaries on the TV: "A year ago today: <family answered prayer>", family list only, never private titles | idea | 4 | M | `audits/03-apps/prayer.md:1096` |
| IMP-PRAYER-I3 | Tell the asker, gently: a quiet line on the asker's Home ("Ezra and Mom prayed for Grandma Jo's visit"); not a push and not a reward | idea | 3 | M | `audits/03-apps/prayer.md:1097` |

### Batch 4 — F260 Reading Plan (38)

#### GAP-F260-1 — A reading missed in an earlier week is not offered again until the rest of the plan is read

- **Area** f260 · **Type** feature gap · **Severity** medium · **Effort** M · **Batch** 4
- **Verified (step 3).** was medium; skeptics medium (partly) and low (partly); tie-break medium (partly). Correction: Two things in the report are wrong. First, it says 'The only cue before that is a half-filled 26×20 grid cell'. In fact the plan's week list also keeps Week 30's header undimmed with a 4-of-5 ring, and the Malachi book bar reads 75%. The grid cell is also a tap target that jumps to week 30.
- **Evidence.** `audits/03-apps/f260.md:733`; `apps/f260.html:1480-1489`; `audits/screens/f260/behind-pace-typical-iphone-safari-light.png`, `audits/screens/f260/behind-typical-iphone-pwa-light.png`
- **What happens now.** A reading missed in an earlier week is not offered again until the rest of the plan is read (medium). `nextReading` orders weeks `curWeek..52` first and earlier weeks last (`apps/f260.html:1480-1489`). With 30-2 unticked and the plan at week 38, the Today card offers "Acts 6" and nothing mentions week 30; ticking forward, 30-2 came up only after 73 more readings, labelled "· catching up". The only cue before that is a half-filled 26×20 grid cell. Being behind overall is surfaced (pace, "Pick up where you left off"; `audits/screens/f260/behind-pace-typical-iphone-safari-light.png`), but not the specific missed reading. YouVersion surfaces missed days and offers to catch up. Evidence: `audits/evidence/p3/f260/logic.json` (`gap`, `readingsBefore30_2Offered: 73`); `audits/screens/f260/behind-typical-iphone-pwa-light.png`. Run: `node "audits/tools/phase3/f260/logic.mjs" gap`.
- **Why it matters.** A missed reading is not offered for 73 readings.
- **Proposed fix.** Catch-up: "Missed: Day 2 of Week 31" offered first, and a "Catch up" row in the Today card when an earlier week has gaps. (Phase 3: IMP-F260-F1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/logic.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 4's checks.

#### P3-F260-02 — Undo after Done (or any untick) leaves "Read today ✓", adds a streak day and silences the 8 pm nudge

- **Area** f260 · **Type** bug · **Severity** medium · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:191`; `apps/f260.html:1662`, `apps/f260.html:917`, `apps/f260.html:1597-1600`, `apps/f260.html:1507`; `audits/evidence/p3/f260/logic-undo-after-iphone.png`, `audits/evidence/p3/f260/logic-undo-home-iphone.png`
- **What happens now.** Ticking a day sets `log[dayKey()] = true` (`apps/f260.html:1662`). Nothing clears it on an untick, although the code defines `log` as "days with at least one reading checked" (`apps/f260.html:917`). Undo only clicks the reading's mark again (`apps/f260.html:1597-1600`).
- **Why it matters.** A mis-tap followed by the Undo the app offers credits a day with no reading and switches off that evening's reminder, so the streak stops being trustworthy.
- **Proposed fix.** After an untick, remove log[today] when no reading ticked today remains, and let the summary and the 8 pm nudge follow. (Phase 3: IMP-F260-P2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-undo-keeps-read-today-1.mjs"`, `node "audits/tools/phase3/f260/verify-undo-keeps-read-today-2.mjs"`, `node "audits/tools/phase3/f260/logic.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-03 — The day after two rest days, the streak reads 0 and "Start a new streak" until the person reads

- **Area** f260 · **Type** bug · **Severity** medium · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:220`; `apps/f260.html:1386`, `apps/f260.html:1392`, `apps/f260.html:1530`, `index.html:1169`; `audits/evidence/p3/f260/logic-streak-before-read-iphone.png`, `audits/evidence/p3/f260/logic-streak-after-read-iphone.png`
- **What happens now.** `streakInfo` starts its walk at today (`apps/f260.html:1386`), so an unread today adds to the gap. Read Saturday, rest Sunday and Monday, open on Tuesday: the gap reaches 3, the walk stops before Saturday, and the streak is set to 0 (`apps/f260.html:1392`).
- **Why it matters.** The owner asked that waiting a day or two not reset the streak, and the heatmap label promises it: "2 rest days between readings keep the streak" (`apps/f260.html:594`). The rule holds only after the person reads; until then every surface, Home included, tells them it is gone.
- **Proposed fix.** Treat an unread today as pending: the streak walk starts from yesterday when today is unread (as index.html:837-844 already does for prayer). (Phase 3: IMP-F260-P3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-streak-today-counted-missed-1.mjs"`, `node "audits/tools/phase3/f260/verify-streak-today-counted-missed-2.mjs"`, `node "audits/tools/phase3/f260/logic.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-15 — The Erase and Restore confirms say "this device", but both act on every device (from the critic; was half of UX-F260-1)

- **Area** f260 · **Type** bug · **Severity** medium · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:523`; `apps/f260.html:1136`, `apps/f260.html:1769`, `apps/f260.html:1056`, `apps/f260.html:903`; `audits/evidence/p3/f260/verify-critic-erase-dialog-misstates-scope-7-1-erase-dialog-ipad.png`, `audits/evidence/p3/f260/verify-critic-erase-dialog-misstates-scope-7-1-phone-after-erase.png`
- **What happens now.** The Erase confirm reads "Every HEAR entry and the passcode will be deleted from this device. Reading progress stays. This can't be undone" (`apps/f260.html:1769`). `eraseJournal()` drops the vault row (`apps/f260.html:1056`) through `hub.remove` (`apps/f260.html:903`);
- **Why it matters.** Someone clearing the shared iPad, or giving up on a forgotten passcode "on this device", loses the journal everywhere, having been told otherwise at the moment of consent.
- **Proposed fix.** The Erase and Restore confirms say "on all your devices". (Phase 3: IMP-F260-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-critic-erase-dialog-misstates-scope-7-1.mjs"`, `node "audits/tools/phase3/f260/verify-critic-erase-dialog-misstates-scope-7-2.mjs"`, `node "audits/tools/phase3/f260/journal.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-16 — Reset's confirm does not say it also deletes the Verses review schedule (`f260.recall`) (from the critic; was half of UX-F260-2)

- **Area** f260 · **Type** bug · **Severity** medium · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:548`; `apps/f260.html:1765-1766`, `apps/verses.html:155-169`, `apps/f260.html:1764`, `apps/verses.html:221-223`; `audits/screens/f260/reset-confirm-typical-iphone-pwa-light.png`, `audits/evidence/p3/f260/verify-critic-reset-silently-wipes-verses-schedule-8-1-dialog-iphone.png`
- **What happens now.** Reset tombstones `f260.done`, `mem`, `log`, `weekStart`, `weekDone`, `best`, `miles`, `recall` and `finished` (`apps/f260.html:1765-1766`). `f260.recall` is F260's own practice key, and Verses keeps each verse's Leitner `box`, `due`, `last` and `streak` in the same rows (`apps/verses.html:155-169, 292-298`).
- **Why it matters.** Months of spaced-repetition progress on each verse are deleted without being mentioned at the moment of consent, and a well-learned verse comes back as a daily review.
- **Proposed fix.** Reset keeps the Verses schedule (box/due/last/streak) or names it in the confirm, with the Undo proposed in F260 §7. (Phase 3: IMP-F260-F5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-critic-reset-silently-wipes-verses-schedule-8-1.mjs"`, `node "audits/tools/phase3/f260/verify-critic-reset-silently-wipes-verses-schedule-8-2.mjs"`, `node "audits/tools/phase3/f260/recall.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-17 — Tapping into an old HEAR entry or week note and away, without typing, re-dates it to today and adds a journal-streak day (from the critic)

- **Area** f260 · **Type** bug · **Severity** medium · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:573`; `apps/f260.html:1864-1868`, `apps/f260.html:1828`, `apps/f260.html:1829`, `apps/f260.html:1818`; `audits/evidence/p3/f260/critic-dates-A-redated-iphone.png`, `audits/evidence/p3/f260/verify-critic-hear-focus-redates-entry-3-1-journal-iphone.png`
- **What happens now.** The focusout handler saves whenever a HEAR field or week note loses focus, without checking whether its value changed (`apps/f260.html:1864-1868`). `saveJournal` stamps `j.t = Date.now()` whenever the entry has any text (`apps/f260.html:1828`) and re-encrypts and uploads the vault (`apps/f260.html:1829`);
- **Why it matters.** The date is the record of when a reflection was written. It is silently overwritten, "Newest first" reorders by the false date, and the journal streak counts days with no writing.
- **Proposed fix.** Save a HEAR entry or week note only when its text changed; keep the date of an unchanged entry.
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/critic-dates.mjs"`, `node "audits/tools/phase3/f260/verify-critic-hear-focus-redates-entry-3-1.mjs"`, `node "audits/tools/phase3/f260/verify-critic-hear-focus-redates-entry-3-2.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-04 — After 260/260, unticking a reading keeps the plan "finished", which mutes the 8 pm and Sunday nudges

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:248`; `apps/f260.html:1672`, `apps/f260.html:1673`, `apps/f260.html:1508`, `apps/f260.html:1765`; `audits/evidence/p3/f260/logic-plan-complete-ipad.png`, `audits/evidence/p3/f260/verify-finished-flag-sticks-1-after-untick-ipad.png`
- **What happens now.** The 260th tick sets `finished = dayKey()` and shows the "Plan complete" modal (`apps/f260.html:1672`). The untick branch (`apps/f260.html:1673`) never clears it, and the summary writes `finished: !!finished` whatever the total (`apps/f260.html:1508`). Only Reset (`apps/f260.html:1765`) or a restore (`apps/f260.html:1119`) clears it.
- **Why it matters.** A reader with an unread reading gets no evening nudge and no Sunday catch-up, and the finish date shown later stays the date of the first finish.
- **Proposed fix.** When the total drops below 260, clear finished and summary.finished so the nudges resume. (Phase 3: IMP-F260-P9)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-finished-flag-sticks-1.mjs"`, `node "audits/tools/phase3/f260/verify-finished-flag-sticks-2.mjs"`, `node "audits/tools/phase3/f260/logic.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-07 — Done on next week's first reading starts that week, and Undo does not give the week back

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:323`; `apps/f260.html:1592`, `apps/f260.html:1684-1689`, `apps/f260.html:1597-1600`, `apps/f260.html:1327`; `audits/evidence/p3/f260/verify-ahead-undo-keeps-week-1-before-iphone.png`, `audits/evidence/p3/f260/verify-ahead-undo-keeps-week-1-after-undo-iphone.png`
- **What happens now.** Done on a reading in a later week calls `setCurrent(w)` (`apps/f260.html:1592`; the comment there says this is intended), which writes `weekStart[w]` when empty (`apps/f260.html:1684-1689`). Undo only clicks the reading's mark (`apps/f260.html:1597-1600`). Mae's week 37 was complete;
- **Why it matters.** Mae's plan says she started week 38 today when she has not, and when she really starts it, its "started" date and "done in N days" count from the mistaken tap.
- **Proposed fix.** Undo restores the previous current week and removes the start date the Done just created.
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-ahead-undo-keeps-week-1.mjs"`, `node "audits/tools/phase3/f260/verify-ahead-undo-keeps-week-2.mjs"`, `node "audits/tools/phase3/f260/logic.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-08 — The heatmap's "today" cell takes the Today card's styles and breaks the grid

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:346`; `apps/f260.html:1515`, `apps/f260.html:117`, `apps/f260.html:95`, `apps/f260.html:92-96`; `audits/evidence/p3/f260/layout-heat-today-desktop.png`, `audits/evidence/p3/f260/layout-heat-today-iphone-pwa.png`
- **What happens now.** Today's heatmap cell gets the class `today` (`apps/f260.html:1515`), so it also matches the Today card's unscoped `.today` rules (`apps/f260.html:117, 153, 156`), where only a gold ring was meant (`apps/f260.html:95`). On the phone it is 35×33 with 16 px padding and a border, against 25×12 for the other cells.
- **Why it matters.** On the Kitchen iPad in landscape and on desktop, the 12-week history is misdrawn: days shift and some disappear.
- **Proposed fix.** Rename the heatmap's today class (e.g. .heat .is-today) so it no longer matches the Today card's rules. (Phase 3: IMP-F260-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-heatmap-today-class-collision-1.mjs"`, `node "audits/tools/phase3/f260/verify-heatmap-today-class-collision-2.mjs"`, `node "audits/tools/phase3/f260/layout.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-09 — Reading mode hides the "This week" reflections card it means to keep

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:369`; `apps/f260.html:184-186`, `apps/f260.html:427`, `apps/f260.html:577`; `audits/evidence/p3/f260/journal-reading-mode-two-done-iphone.png`, `audits/evidence/p3/f260/verify-reading-mode-hides-reflections-2-iphone-readmode.png`
- **What happens now.** `.readmode .side{display:block}` and `.readmode .side > :not(#reflect){display:none}` (`apps/f260.html:184-186`) exist to keep `#reflect` visible.
- **Why it matters.** The reader loses the week's Apply and Respond notes at the moment they are reading.
- **Proposed fix.** Reading mode keeps #reflect visible (fix the rule order so `.readmode .side` hides only the other children). (Phase 3: IMP-F260-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-reading-mode-hides-reflections-1.mjs"`, `node "audits/tools/phase3/f260/verify-reading-mode-hides-reflections-2.mjs"`, `node "audits/tools/phase3/f260/journal.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-10 — "100% complete" with one reading left, and "0%" after the first

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:392`; `apps/f260.html:1672`, `apps/f260.html:1494`, `apps/f260.html:1214`, `apps/f260.html:1524`; `audits/evidence/p3/f260/logic-259-of-260-ipad.png`, `audits/evidence/p3/f260/verify-percent-rounds-to-100-2-259-of-260-ipad.png`
- **What happens now.** `Math.round(n / 260 * 100)` (`apps/f260.html:1494`) gives "100% complete" at 259 readings, while the Today card still offers "Revelation 20-22" with its Done button, and "0% complete" beside "1 of 260 readings".
- **Why it matters.** "100%" with a reading left looks like the plan is done, and "0%" after the first reading looks like it was not counted.
- **Proposed fix.** Floor the percentage and cap it at 99 below 260; show at least 1 % once one reading is done.
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-percent-rounds-to-100-1.mjs"`, `node "audits/tools/phase3/f260/verify-percent-rounds-to-100-2.mjs"`, `node "audits/tools/phase3/f260/logic.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-11 — Pace reads "2 week behind" / "2 week ahead"

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:415`; `apps/f260.html:1403`, `apps/f260.html:599`; `audits/evidence/p3/f260/logic-pace-2-week-behind-iphone.png`, `audits/evidence/p3/f260/verify-pace-week-plural-1-iphone.png`
- **What happens now.** The plural is chosen from the raw difference in days (≥ 14), but the number shown is `Math.round(diff / 7)` (`apps/f260.html:1403, 1405`). Between 10.5 and 14 days ahead or behind, the Next up hero's pace line (`#heroPace`, `apps/f260.html:599`) pairs "2" with "week": "2 week behind · projected finish Jan 2027".
- **Why it matters.** A visible grammar slip in the line that tells a reader how far behind they are, shown to anyone 1.5 to 2 weeks off pace.
- **Proposed fix.** Choose "week"/"weeks" from the rounded number.
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-pace-week-plural-1.mjs"`, `node "audits/tools/phase3/f260/verify-pace-week-plural-2.mjs"`, `node "audits/tools/phase3/f260/logic.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-12 — The unlock dialog says "encrypted on this iPad" on every device (from the visual check)

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:438`; `apps/f260.html:1133-1134`, `apps/f260.html:902`, `apps/f260.html:1787`, `apps/f260.html:1136`; `audits/screens/f260/journal-unlock-typical-iphone-pwa-dark.png`, `audits/evidence/p3/f260/verify-vis-unlock-dialog-says-encrypted-on-this-ipad-on-an--1-1-iphone-pwa.png`
- **What happens now.** The unlock text is a constant (`apps/f260.html:1133-1134`): "Your HEAR journal is encrypted on this iPad. Enter your passcode to read or write it." It shows on the iPhone and on desktop too.
- **Why it matters.** People act on this copy when deciding what Erase or a lost device means (P3-F260-15, UX-F260-1).
- **Proposed fix.** Unlock copy that is true everywhere: "Encrypted with your passcode. It follows you to your devices; the passcode never leaves this one." (Phase 3: IMP-F260-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/verify-vis-unlock-dialog-says-encrypted-on-this-ipad-on-an--1-1.mjs"`, `node "audits/tools/phase3/f260/verify-vis-unlock-dialog-says-encrypted-on-this-ipad-on-an--1-2.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-18 — A week read ahead on the plan list and started later reads "done in -1 days" and "started" after it was finished (from the critic)

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:598`; `apps/f260.html:1592`, `apps/f260.html:1670`, `apps/f260.html:1686`, `apps/f260.html:1327-1329`; `audits/evidence/p3/f260/critic-dates-B-negative-days-iphone.png`, `audits/evidence/p3/f260/verify-critic-week-ahead-negative-days-4-1-iphone.png`
- **What happens now.** Ticking all five readings of a later week on the plan list sets `weekDone[w]` to today (`apps/f260.html:1670`) but never sets `weekStart[w]`. When the person later starts that week, `setCurrent` stamps `weekStart[w]` with that later day (`apps/f260.html:1686`).
- **Why it matters.** A visible nonsense figure in the week summary and in the text a reader copies to share, and a false start date in the header.
- **Proposed fix.** Set weekStart when a week's first reading is ticked; clamp the shown duration to at least 1 day.
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/critic-dates.mjs"`, `node "audits/tools/phase3/f260/verify-critic-week-ahead-negative-days-4-1.mjs"`, `node "audits/tools/phase3/f260/verify-critic-week-ahead-negative-days-4-2.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-19 — The − / + week stepper and the Week select stamp a start date on every week they land on, and stepping back never removes it (from the critic)

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:623`; `apps/f260.html:1397`, `apps/f260.html:616`, `apps/f260.html:1707-1711`, `apps/f260.html:1684-1689`; `audits/evidence/p3/f260/verify-critic-week-stepper-stamps-start-dates-5-2-peek-iphone.png`
- **What happens now.** The picker is labelled "Set current week" (`apps/f260.html:616`), and each − / + tap or Week choice calls `setCurrent` (`apps/f260.html:1707-1711`). `setCurrent` stamps `weekStart` on the week it lands on when that week has none, and never removes a stamp when the person moves away (`apps/f260.html:1684-1689`).
- **Why it matters.** The week history (start dates and "done in N days") becomes false for every week passed on the way.
- **Proposed fix.** Browsing weeks records no start date; a start is written only when a week is begun.
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/critic-dates.mjs"`, `node "audits/tools/phase3/f260/verify-critic-week-stepper-stamps-start-dates-5-1.mjs"`, `node "audits/tools/phase3/f260/verify-critic-week-stepper-stamps-start-dates-5-2.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### P3-F260-20 — Journal search breaks HTML entities: an entry with "&" shows "&amp;" for many ordinary queries (from the critic)

- **Area** f260 · **Type** bug · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:648`; `apps/f260.html:1988`, `apps/f260.html:1948`, `apps/f260.html:1964`, `apps/f260.html:1971`; `audits/evidence/p3/f260/critic-search-amp-iphone.png`, `audits/evidence/p3/f260/verify-critic-journal-search-breaks-entities-6-1-amp-iphone.png`
- **What happens now.** `hl()` escapes the text first and then wraps every match of the raw query in `<mark>` inside the escaped string (`apps/f260.html:1948`), while the filter matches on the raw text (`apps/f260.html:1964`). A query "amp" selects an entry containing "camp", and `hl()` then also matches inside `&amp;`: the card shows "Summer camp &amp;
- **Why it matters.** The result shows garbled text for the very thing just searched for.
- **Proposed fix.** Search highlights by matching the raw text and escaping each piece separately before joining with <mark>.
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/critic-search.mjs"`, `node "audits/tools/phase3/f260/verify-critic-journal-search-breaks-entities-6-1.mjs"`, `node "audits/tools/phase3/f260/verify-critic-journal-search-breaks-entities-6-2.mjs"` — the defect must no longer reproduce; plus batch 4's checks.

#### UX-F260-1 — The footer, the Restore sheet and the journal's empty state say "this device", but progress and the journal follow the person to every device

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:679`; `apps/f260.html:713`, `apps/f260.html:746`, `apps/f260.html:1959`, `apps/f260.html:897`; `audits/screens/f260/journal-unlock-typical-iphone-pwa-dark.png`
- **What happens now.** The footer says progress and entries are "saved on this device" and warns "so it isn't lost with the device" (`apps/f260.html:713`). The Restore sheet says a backup "replaces the journal and reading progress on this device" (`apps/f260.html:746`).
- **Why it matters.** The copy tells people to fear losing data that is synced.
- **Proposed fix.** Replace every "this device" in the footer, Restore sheet and journal empty state with what is true: it follows you to every device. (Phase 3: IMP-F260-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/journal.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 4's checks.

#### UX-F260-2 — "Reset progress…" cannot be undone; only a backup made beforehand brings the progress back

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:684`; `apps/f260.html:1763-1767`, `apps/f260.html:1098`; `audits/screens/f260/reset-confirm-typical-iphone-pwa-light.png`
- **What happens now.** Reset drops `f260.done`, `mem`, `log`, `weekStart`, `weekDone`, `best`, `miles`, `recall` and `finished` (`apps/f260.html:1763-1767`). Before: recall 65, mem 65, done 187; after: all deleted. The dialog ends "This can't be undone." and there is no snapshot or undo toast;
- **Why it matters.** Reset cannot be undone.
- **Proposed fix.** Reset keeps a 30-day snapshot and offers Undo. (Phase 3: IMP-F260-F5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/recall.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 4's checks.

#### UX-F260-3 — The Journal tab and every HEAR button open the passcode dialog at once; the in-panel locked state is never seen

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:688`; `apps/f260.html:1796-1799`; `audits/screens/f260/journal-typical-iphone-pwa-light.png`
- **What happens now.** The Journal tab and every HEAR button open the passcode dialog at once; the in-panel locked state is never seen (low). With no passcode, the Journal tab opens "Set a journal passcode" immediately; when locked, HEAR opens "Unlock journal" before the panel draws (`panelOn:false`). Evidence: `apps/f260.html:1796-1799, 1999`; `journal.json` `journalTabFirst`, `lockedHear`; `audits/screens/f260/journal-typical-iphone-pwa-light.png`.
- **Why it matters.** The dialog pops up every time.
- **Proposed fix.** The Journal tab shows its locked state with an Unlock button instead of opening the passcode dialog at once.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### UX-F260-4 — Reading mode shows two "Done" buttons that do different things

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:689`; `apps/f260.html:573`; `audits/evidence/p3/f260/journal-reading-mode-two-done-iphone.png`, `audits/screens/f260/reading-mode-typical-ipad-landscape-dark.png`
- **What happens now.** Reading mode shows two "Done" buttons that do different things (low). `#todayDone` ("Done", 363×60 at y 339) ticks the reading; `#readExit` ("Done", 76×52 at y 437) leaves reading mode. Evidence: `apps/f260.html:573, 695`; `journal.json` `readingMode`; `audits/evidence/p3/f260/journal-reading-mode-two-done-iphone.png`; `audits/screens/f260/reading-mode-typical-ipad-landscape-dark.png`.
- **Why it matters.** Two different Done buttons.
- **Proposed fix.** Reading mode's exit button reads "Close" (with an icon), so only the Today card says Done.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### UX-F260-6 — The weeks pane opens at Week 1; the current week is 2,800-4,100 px down on every device

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:691`; `apps/f260.html:1693`; `audits/screens/f260/today-typical-desktop-light.png`, `audits/screens/f260/today-typical-ipad-landscape-dark.png`
- **What happens now.** The weeks pane opens at Week 1; the current week is 2,800-4,100 px down on every device (low). Week 38 sits at y 4,072 of 5,772 on the iPhone, 3,889 on iPad portrait, 2,795 on iPad landscape and 2,794 on desktop, never in view on open. A scroll-to-week exists for other paths (`apps/f260.html:1693`). Evidence: `layout.json` `devices.*.weeks`; `audits/screens/f260/today-typical-desktop-light.png`; `audits/screens/f260/today-typical-ipad-landscape-dark.png`.
- **Why it matters.** The current week is 2,800-4,100 px down.
- **Proposed fix.** Open the weeks pane scrolled to the current week. (Phase 3: IMP-F260-P7)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### UX-F260-7 — "Practice again" chips are 40 px tall and can fill 340 px above Day 1

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:692`; `apps/f260.html:302`; `audits/evidence/p3/f260/layout-practice-chips-overflow-iphone.png`
- **What happens now.** "Practice again" chips are 40 px tall and can fill 340 px above Day 1 (low). In the overflow household the current week shows 14 chips at 40 px (below 44), in a 340 px row. Evidence: `apps/f260.html:302, 1343-1346`; `layout.json` `chips`; `audits/evidence/p3/f260/layout-practice-chips-overflow-iphone.png`.
- **Why it matters.** Small chips push Day 1 below the fold.
- **Proposed fix.** "Practice again" chips at var(--tap), collapsed to "Practise 14 verses" when there are more than three.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### UX-F260-8 — Settings sits about 1,600 px down on the phone

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:693`; `apps/f260.html:614-624`; `audits/screens/f260/settings-typical-iphone-pwa-light.png`
- **What happens now.** Settings sits about 1,600 px down on the phone (low). `#settingsBtn` is at y 1,602 on a 430×932 iPhone, below the grids, heatmap, hero, reflections and milestones. Evidence: `apps/f260.html:614-624`; `taps.json` `reach`; `audits/screens/f260/settings-typical-iphone-pwa-light.png`.
- **Why it matters.** Settings is 1,600 px down on the phone.
- **Proposed fix.** A settings button in the page header (restyle only; the #settingsBtn id stays).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### UX-F260-9 — The "Pick up where you left off" hero says "last read" twice

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:694`; `apps/f260.html:1510`; `audits/screens/f260/behind-pace-typical-iphone-pwa-light.png`
- **What happens now.** The "Pick up where you left off" hero says "last read" twice (low). "Last read Sep 14 · best streak 40", then the meta "About 4 minutes · last read Sep 14 · Week 31 · Day 2 · 1 chapter · started Sep 14". Evidence: `apps/f260.html:1510, 1536`; `logic.json` `quiet`; `audits/screens/f260/behind-pace-typical-iphone-pwa-light.png`.
- **Why it matters.** Repetition.
- **Proposed fix.** Say "last read" once in the hero. (Phase 3: IMP-F260-P9)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### UX-F260-10 — The journal sort button always says "Newest first" and shows no pressed state

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:695`; `apps/f260.html:1990`, `apps/f260.html:1953`, `apps/f260.html:705`; `audits/evidence/p3/f260/journal-search-two-clears-iphone.png`
- **What happens now.** The journal sort button always says "Newest first" and shows no pressed state (low). The click only toggles `jNewest` (`apps/f260.html:1990`), and render sets only `aria-pressed` (`apps/f260.html:1953`); `.btn` has no `[aria-pressed]` style, so only the small stat line ("· in plan order") tells the order. Evidence: `apps/f260.html:705`; `audits/evidence/p3/f260/journal-search-two-clears-iphone.png`.
- **Why it matters.** The label never changes.
- **Proposed fix.** The sort button toggles its label ("Oldest first") and aria-pressed.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### UX-F260-11 — Writing today's HEAR entry takes 6 taps, a passcode and a 1,100 px scroll; the Today card has no journal control

- **Area** f260 · **Type** usability · **Severity** low · **Effort** M · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:696`; `audits/evidence/p3/f260/taps-hear-iphone.png`, `audits/screens/f260/hear-open-typical-iphone-pwa-light.png`
- **What happens now.** Writing today's HEAR entry takes 6 taps, a passcode and a 1,100 px scroll; the Today card has no journal control (low). Evidence: `taps.json` `jobs[1]`; `audits/evidence/p3/f260/taps-hear-iphone.png`; `audits/screens/f260/hear-open-typical-iphone-pwa-light.png`.
- **Why it matters.** Six taps and a long scroll to write today's entry.
- **Proposed fix.** A "Journal" action on the Today card that opens today's HEAR entry after unlock. (Phase 3: IMP-F260-F2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### UX-F260-13 — After today's tick the primary button still reads "Done" under the next reading

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:698`; `audits/evidence/p3/f260/taps-after-done-iphone.png`, `audits/evidence/p3/f260/layout-undo-desktop.png`
- **What happens now.** After today's tick the primary button still reads "Done" under the next reading (low; from the visual check). The kicker turns gold "READ TODAY ✓", the title moves on to Acts 7, and the same full-width green "Done" stays; it reads as a status and invites a second tap that reads ahead. Evidence: `audits/evidence/p3/f260/taps-after-done-iphone.png`; `audits/evidence/p3/f260/layout-undo-desktop.png`; `audits/screens/f260/done-toast-typical-ipad-portrait-light.png`.
- **Why it matters.** Done under the next reading invites a second tick.
- **Proposed fix.** After today's tick the primary button reads "Read ahead" (or hides), with "Read today ✓" as the state. (Phase 3: IMP-F260-P10)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### UX-F260-14 — The Today card and the Next up hero repeat the same reading one screen apart

- **Area** f260 · **Type** usability · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:699`; `audits/screens/f260/today-typical-ipad-portrait-light.png`, `audits/screens/f260/today-empty-ipad-portrait-light.png`
- **What happens now.** The Today card and the Next up hero repeat the same reading one screen apart (low; from the visual check). Both show "Acts 6 / Week 38 · Day 3 / 12-day streak", adding height to a 5,772 px phone page. Evidence: `audits/screens/f260/today-typical-ipad-portrait-light.png`; `audits/screens/f260/today-empty-ipad-portrait-light.png`.
- **Why it matters.** The same reading twice on one screen.
- **Proposed fix.** Hide the Next up hero when it repeats the Today card.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### VIS-F260-3 — A cold open shifts the page by CLS 0.24 when the data arrives

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:711`; `audits/screens/f260/today-loading-iphone-pwa-light.png`
- **What happens now.** A cold open shifts the page by CLS 0.24 when the data arrives (low). On a cold iPhone with a 1.5 s first pull (Chromium layout-shift entries), one shift of 0.2403 at 3.18 s moved `.side`, `.hero`, `.tc` and `#reflect`, above the 0.1 "good" limit. Evidence: `audits/evidence/p3/f260/webtells.json` (`cls-cold-1500ms`); `audits/screens/f260/today-loading-iphone-pwa-light.png`. Run: `node "audits/tools/phase3/f260/webtells.mjs"`.
- **Why it matters.** CLS 0.24 on a cold open.
- **Proposed fix.** Reserve the loaded heights (--min-h-* tokens) so the data arriving does not shift the page.
- **How it will be verified.** Rerun `node "audits/tools/phase3/f260/webtells.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 4's checks.

#### VIS-F260-4 — Disabled settings buttons look exactly like enabled ones

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:712`; `apps/f260.html:211`; `audits/evidence/p3/f260/journal-settings-locked-iphone.png`, `audits/screens/f260/settings-more-typical-ipad-portrait-light.png`
- **What happens now.** Disabled settings buttons look exactly like enabled ones (low). Once locked, Lock now, Change passcode and Face ID Enable are disabled, but opacity 1, colour and cursor pointer match the enabled state; only `.btn[disabled]` is styled (`apps/f260.html:211, 219-227`). The visual checker saw the same on the Face ID buttons beside "Not available in this browser". Evidence: `journal.json` `settings`; `audits/evidence/p3/f260/journal-settings-locked-iphone.png`; `audits/screens/f260/settings-more-typical-ipad-portrait-light.png`.
- **Why it matters.** Disabled buttons look enabled.
- **Proposed fix.** Disabled .seg buttons get --op-disabled and cursor default. (Phase 3: IMP-F260-P8)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### VIS-F260-5 — The week-note footer and its Copy button are unstyled

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:713`; `apps/f260.html:332-333`; `audits/evidence/p3/f260/journal-week-note-footer-iphone.png`
- **What happens now.** The week-note footer and its Copy button are unstyled (low). The HEAR footer is 13 px flex with a 44 px Copy; the week-note footer is 17 px block, and its Copy is a default 55×35 grey button (rgb(192,192,192)), jammed against "Saved". The `.jft` rules exist only as `.jr .jft` (`apps/f260.html:332-333, 1297`). Evidence: `journal.json` `footers`; `audits/evidence/p3/f260/journal-week-note-footer-iphone.png`.
- **Why it matters.** An unstyled footer.
- **Proposed fix.** Style the week-note footer like the HEAR footer (13 px, 44 px Copy).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### VIS-F260-6 — Journal search shows WebKit's clear glyph next to the app's ×, and the focus ring sits on the inner input

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:714`; `apps/f260.html:704`; `audits/evidence/p3/f260/journal-search-two-clears-iphone.png`, `audits/screens/f260/journal-search-typical-iphone-pwa-light.png`
- **What happens now.** Journal search shows WebKit's clear glyph next to the app's ×, and the focus ring sits on the inner input (low). `type=search` keeps WebKit's cancel button beside `#jClear` (`apps/f260.html:704`); the pseudo-element's computed style is not readable in the rig, but both show in the screenshot. Evidence: `audits/evidence/p3/f260/journal-search-two-clears-iphone.png`; `audits/screens/f260/journal-search-typical-iphone-pwa-light.png`.
- **Why it matters.** Two clear buttons.
- **Proposed fix.** Hide WebKit's search cancel glyph (appearance: none on ::-webkit-search-cancel-button) and ring the pill with :focus-within.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### VIS-F260-7 — The printed plan shows no ticks or read state, and each week's header rule curls up

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:715`; `apps/f260.html:499`, `apps/f260.html:237`; `audits/evidence/p3/f260/print-media-page1.png`, `audits/evidence/p3/f260/print-media-wkhead-zoom.png`
- **What happens now.** The printed plan shows no ticks or read state, and each week's header rule curls up (low). Print hides `.mark` (`apps/f260.html:499`), read and unread links print identically (black, no decoration), and the week header keeps its 12 px radius over a 1 px bottom border (`apps/f260.html:237, 510`). Evidence: `audits/evidence/p3/f260/print.json`; `audits/evidence/p3/f260/print-media-page1.png`; `audits/evidence/p3/f260/print-media-wkhead-zoom.png`; `audits/screens/f260/print-typical-desktop-light.png`.
- **Why it matters.** The printed plan shows no progress.
- **Proposed fix.** Print read state (a ✓ per read reading) and give week headers a straight rule. (Phase 3: IMP-F260-F3)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### VIS-F260-8 — The theme hint renders at 17 px body ink

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:716`; `apps/f260.html:644`, `apps/design.css:454`; `audits/screens/f260/settings-typical-iphone-pwa-light.png`
- **What happens now.** The theme hint renders at 17 px body ink (low). `<p class="help">` (`apps/f260.html:644`) is styled only as `.ds .help` (`apps/design.css:454`), and F260 does not use `.ds`; the neighbouring hints are 13.5 px muted. Evidence: `journal.json` `settings.themeHint`; `audits/screens/f260/settings-typical-iphone-pwa-light.png`.
- **Why it matters.** The hint renders as body text.
- **Proposed fix.** Style .help locally (footnote size, --text-3).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### VIS-F260-9 — Undo drops onto its own line below Done at 1180 and 1440 px

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:717`; `apps/f260.html:143`; `audits/evidence/p3/f260/layout-undo-desktop.png`, `audits/evidence/p3/f260/layout-undo-ipad-landscape.png`
- **What happens now.** Undo drops onto its own line below Done at 1180 and 1440 px (low). Done y 232, Undo y 302 at both widths (`apps/f260.html:143, 153`). Evidence: `layout.json` `devices.desktop.undo`; `audits/evidence/p3/f260/layout-undo-desktop.png`; `audits/evidence/p3/f260/layout-undo-ipad-landscape.png`.
- **Why it matters.** Undo wraps.
- **Proposed fix.** Keep Undo beside Done at 1180 and 1440 px.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### VIS-F260-12 — Web tells: selectable chrome, a native checkbox, emoji as icons, 109 targets under 44 px per page

- **Area** f260 · **Type** visual · **Severity** low · **Effort** M · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:720`; `apps/f260.html:734`, `apps/f260.html:1219-1232`, `apps/f260.html:77`; `audits/screens/f260/milestones-typical-iphone-pwa-light.png`
- **What happens now.** Done, the week headers, the marks and the switch compute `-webkit-user-select: text`.
- **Why it matters.** Web tells.
- **Proposed fix.** user-select: none on chrome, the shared switch for "Show passcode", Lucide icons for milestones, targets to var(--tap). (Phase 3: IMP-F260-I1)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### VIS-F260-13 — The current week's header truncates its start date on the phone

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:726`; `audits/evidence/p3/f260/journal-week-note-footer-iphone.png`, `audits/screens/f260/hear-open-empty-iphone-pwa-light.png`
- **What happens now.** The current week's header truncates its start date on the phone (low; from the visual check). With the note badge and ring on the row, the subtitle cuts to "Acts · started Se…". Evidence: `audits/evidence/p3/f260/journal-week-note-footer-iphone.png`; `audits/screens/f260/hear-open-empty-iphone-pwa-light.png`; `audits/screens/f260/hear-open-typical-iphone-safari-dark.png`.
- **Why it matters.** The start date is cut off.
- **Proposed fix.** Let the current week's subtitle wrap under the badges on the phone.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### VIS-F260-15 — A locked or empty journal keeps Search, Newest first and Copy all live-looking, and "Set passcode" crowds its caption

- **Area** f260 · **Type** visual · **Severity** low · **Effort** S · **Batch** 4
- **Evidence.** `audits/03-apps/f260.md:728`; `audits/screens/f260/journal-locked-typical-desktop-dark.png`
- **What happens now.** A locked or empty journal keeps Search, Newest first and Copy all live-looking, and "Set passcode" crowds its caption (low; from the visual check). Evidence: `audits/screens/f260/journal-locked-typical-desktop-dark.png`.
- **Why it matters.** Dead controls look live.
- **Proposed fix.** Disable Search, sort and Copy all while the journal is locked or empty; give "Set passcode" room.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 4's checks.

#### Improvements with no finding (f260)

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). They are optional; Phase 6 carries them only if the household wants them.

| ID | Improvement | Kind | Delight | Effort | Source |
|---|---|---|---|---|---|
| IMP-F260-F4 | Choose the reading-reminder time per person (as Books and Journal do); the toggle already lives in Me, the hour goes in `push_prefs` | feature | 3 | M | `audits/03-apps/f260.md:903` |

### Batch 5 — Verses (20)

#### GAP-VERSES-1 — For most cards Show reveals nothing, because the only text source is a paste in F260

- **Area** verses · **Type** feature gap · **Severity** medium · **Effort** M · **Batch** 5
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: The shares come from the audit's own synthetic seed (audits/tools/seed/f260.mjs), not measured household data, so 'most cards' is the seeded story. It is structurally likely, though, because no bulk text source exists.
- **Evidence.** `audits/03-apps/verses.md:554`; `apps/verses.html:215`; `audits/screens/verses/revealed-typical-iphone-pwa-light.png`
- **What happens now.** For most cards Show reveals nothing, because the only text source is a paste in F260 (medium). The veiled text exists only when F260 has pasted text for that verse (`apps/verses.html:215, 326`). Share with text in the seed: Eli 7/64, Mae 1/31, Elizabeth 4/75, David 0/11. Without text, Show only swaps the buttons and asks "Did you get it?", so the person must check the verse elsewhere. Verses has no paste or hint flow of its own; Remember Me shows the text and offers puzzles, gaps and typing. Evidence: `audits/evidence/p3/verses/texts-count.json`; `audits/screens/verses/revealed-typical-iphone-pwa-light.png`. Run `node "audits/tools/phase3/verses/texts-count.mjs"`.
- **Why it matters.** Show reveals nothing for most cards.
- **Proposed fix.** Verse text available for every memorised verse (store the pasted text once per verse in the family scope, or offer paste inside Verses). (Phase 3: IMP-VERSES-F5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/texts-count.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 5's checks.

#### P3-VERSES-05 — The "Not yet" toast always says "again tomorrow", even when the verse returns in 2, 4 or 7 days

- **Area** verses · **Type** bug · **Severity** medium · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:273`; `apps/verses.html:168`, `apps/verses.html:228`, `apps/verses.html:302`, `apps/verses.html:295`; `audits/evidence/p3/verses/toast-not-yet-box5-iphone.png`, `audits/evidence/p3/verses/verify-not-yet-toast-wrong-interval-1-box5-not-iphone.png`
- **What happens now.** The Not yet branch of the toast is fixed text, "again tomorrow" (`apps/verses.html:302`), while the Almost branch on the same line is built from `INTERVALS`. Not yet drops the verse one box only (`apps/verses.html:295`), so its next review is usually later:
- **Why it matters.** Someone who just failed a verse is told it returns tomorrow, and it returns a week later. The app's own Coming up list on the same screen contradicts the toast.
- **Proposed fix.** The Not yet toast states the real next review ("again in 2 days"). (Phase 3: IMP-VERSES-P3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/verify-not-yet-toast-wrong-interval-1.mjs"`, `node "audits/tools/phase3/verses/verify-not-yet-toast-wrong-interval-2.mjs"`, `node "audits/tools/phase3/verses/toast-not-yet.mjs"` — the defect must no longer reproduce; plus batch 5's checks.

#### P3-VERSES-06 — Read aloud disappears after Show, so the verse text can never be heard

- **Area** verses · **Type** bug · **Severity** medium · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:298`; `apps/verses.html:272`, `apps/verses.html:108-111`, `apps/verses.html:328`, `apps/design.css:316`; `audits/evidence/p3/verses/vischeck-readaloud-after-show.png`, `audits/evidence/p3/verses/verify-read-aloud-gone-after-show-2-eli-with-text-iphone-pwa-revealed.png`
- **What happens now.** `#say` sits inside `#act-show` (`apps/verses.html:108-111`), which is hidden once the card is revealed (`apps/verses.html:328`; `[hidden]{display:none !important}` at `apps/design.css:316`). The line that unhides `#say` (`apps/verses.html:330`) has no effect, because its parent stays hidden.
- **Why it matters.** Hearing the verse is how a person checks a recitation without reading, and it is the only accessible way to get the text read out on a phone.
- **Proposed fix.** Read aloud stays after Show and reads the verse text when F260 has it. (Phase 3: IMP-VERSES-P6)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/verify-read-aloud-gone-after-show-1.mjs"`, `node "audits/tools/phase3/verses/verify-read-aloud-gone-after-show-2.mjs"`, `node "audits/tools/phase3/verses/kid-flow.mjs"` — the defect must no longer reproduce; plus batch 5's checks.

#### P3-VERSES-11 — A day with nothing due resets the day streak, while the screen says "come back tomorrow" and "keep it going today"

- **Area** verses · **Type** bug · **Severity** medium · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:398`; `apps/verses.html:171`, `apps/verses.html:234-235`, `apps/verses.html:290-306`, `apps/verses.html:366-371`; `audits/screens/verses/nothing-due-typical-ipad-portrait-light.png`, `audits/evidence/p3/verses/critic-streak-wed-iphone.png`
- **What happens now.** The day streak counts consecutive days with at least one rating in `verses.log` (the data contract at `apps/verses.html:171`; `dayStreak` at `apps/verses.html:234-235`). Only `rate()` writes the log (`apps/verses.html:290-306`), and a rating needs a due verse or "Practise one anyway" (`apps/verses.html:366-371`).
- **Why it matters.** The day streak is the trainer's headline number and its only motivation loop. The app resets a 21-day streak for doing exactly what it told the person to do.
- **Proposed fix.** A day with nothing due keeps the streak. (Phase 3: IMP-VERSES-P7)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/critic-streak.mjs"`, `node "audits/tools/phase3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-1.mjs"`, `node "audits/tools/phase3/verses/verify-critic-streak-breaks-on-nothing-due-day-1-2.mjs"` — the defect must no longer reproduce; plus batch 5's checks.

#### UX-VERSES-1 — A pre-reader cannot practise: no verse words, the reference is the only thing read aloud, and every prompt is text

- **Area** verses · **Type** usability · **Severity** medium · **Effort** M · **Batch** 5
- **Verified (step 3).** was high; skeptics medium (partly) and medium (partly). Correction: Severity is inflated: high needs a broken core daily flow, but job 3 is secondary ('a few times a week', usually with a parent), and Kid Verse already delivers the week's verse to kids with words and read-aloud.
- **Evidence.** `audits/03-apps/verses.md:528`; `apps/verses.html:222`, `apps/kidverse.html:188`, `apps.json:12`; `audits/evidence/p3/verses/kid-flow-revealed-iphone-pwa.png`, `audits/evidence/p3/verses/kid-flow-revealed-ipad-portrait.png`
- **What happens now.** Ezra's card is a serif reference ("Acts 2:42") with the hint "Say the verse out loud, then tap Show." Read aloud says only "Acts, chapter 2, verse 42". Kids have no verse text (`textShown` false before and after Show), so Show reveals nothing;
- **Why it matters.** A pre-reader cannot practise at all.
- **Proposed fix.** Kid practice: the paraphrase from Kid Verse is read aloud, big picture buttons (a star for "Got it", a smile for "Almost"), no reading needed. (Phase 3: IMP-VERSES-F3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/kid-flow.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 5's checks.

#### GAP-HOME-2 — Verses writes a summary "for the Home card" that Home never reads

- **Area** shell / platform (Verses) · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 5
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: 'Timer has no Home presence' is only partly true. A running timer shows a pill on Home and on every tab, and the investigator's metric counted only cards and entry buttons. The adult Kids card also shows Kid Verse data, without a link.
- **Evidence.** `audits/02-shell.md:660`; `apps/verses.html:172`
- **What happens now.** `apps/verses.html:172, 238-243` writes `verses.summary {due, streak, boxes, …}`.
- **Why it matters.** The daily review is 8 taps away though the data for a card exists.
- **Proposed fix.** Add the Verses Home card the app already writes a summary for ("3 verses to review · 12-day streak"), one tap to the trainer. (Phase 3: IMP-VERSES-F1)
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 5's checks.

#### GAP-VERSES-2 — Not yet drops a verse only one box, and the buttons do not show the next interval

- **Area** verses · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:555`; `apps/verses.html:295`
- **What happens now.** Not yet drops a verse only one box, and the buttons do not show the next interval (low). Not yet → max(1, box − 1) (`apps/verses.html:295`), so a forgotten box-5 verse returns in 7 days. Anki's "Again" restarts learning and every Anki button shows its interval; classic Leitner sends a miss to box 1. Evidence: `audits/evidence/p3/verses/leitner.json` (box 5 Not yet → box 4, due 2026-09-29).
- **Why it matters.** Forgotten verses stay near the top box.
- **Proposed fix.** Not yet sends a verse back to box 1 (standard Leitner) and each button shows its next interval. (Phase 3: IMP-VERSES-F2)
- **How it will be verified.** recapture its screens (capture area verses) and compare; plus batch 5's checks.

#### GAP-VERSES-3 — The empty state has no way to go and mark verses in F260

- **Area** verses · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:556`; `apps/verses.html:126-130`; `audits/screens/verses/trainer-empty-iphone-pwa-light.png`
- **What happens now.** The empty state has no way to go and mark verses in F260 (low). "Nothing to train yet … Mark a memory verse as memorised in F260" has no button or link to F260 (`apps/verses.html:126-130`), so a new person has to leave, find F260 in the Apps grid, and come back. Its wrong "on its review day" copy was moved out of this gap at the critic's request and verified as a bug: P3-VERSES-14. Evidence: `audits/screens/verses/trainer-empty-iphone-pwa-light.png`.
- **Why it matters.** No way forward from the empty state.
- **Proposed fix.** The empty state gets an "Open F260" button. (Phase 3: IMP-VERSES-P8)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 5's checks.

#### P3-VERSES-08 — "Practise one anyway" makes the chosen verse "1 due today" and lists it under Due today as "tomorrow"

- **Area** verses · **Type** bug · **Severity** low · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:341`; `apps/verses.html:242`, `apps/verses.html:366-371`, `apps/verses.html:307`, `apps/verses.html:316`; `audits/evidence/p3/verses/practise-anyway-queue-iphone.png`, `audits/screens/verses/practise-anyway-typical-iphone-pwa-light.png`
- **What happens now.** The #again handler sets the queue to the next scheduled verse (`apps/verses.html:366-371`), and `currentQueue()` returns it (`apps/verses.html:307`). The pill, the "due today" stat and the Due today list all draw from that queue (`apps/verses.html:316, 343, 348-350`), while Coming up is computed separately.
- **Why it matters.** Verses is used four adults daily, kids a few times a week (verses.md §1); 19 open findings remain after the critical batches.
- **Proposed fix.** Extra practice shows as practice; the due count and Due today list keep the real due set. (Phase 3: IMP-VERSES-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/verify-practise-anyway-counts-as-due-1.mjs"`, `node "audits/tools/phase3/verses/verify-practise-anyway-counts-as-due-2.mjs"`, `node "audits/tools/phase3/verses/misc.mjs"` — the defect must no longer reproduce; plus batch 5's checks.

#### P3-VERSES-10 — With keyboard focus on Read aloud, Enter or Space reveals the answer instead of reading

- **Area** verses · **Type** bug · **Severity** low · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:380`; `apps/verses.html:373-378`, `apps/verses.html:108-111`, `apps/verses.html:328`; `audits/evidence/p3/verses/verify-enter-on-read-aloud-reveals-1-webkit.png`, `audits/evidence/p3/verses/verify-enter-on-read-aloud-reveals-1-chromium.png`
- **What happens now.** The document keydown handler calls `preventDefault` on Enter and Space while the card is unrevealed, whatever has focus (`apps/verses.html:373-378`), so the focused button's click never fires and the card is revealed. Measured `{revealed:true, spoke:0}`.
- **Why it matters.** Verses is used four adults daily, kids a few times a week (verses.md §1); 19 open findings remain after the critical batches.
- **Proposed fix.** The Show shortcut applies only when no button has focus; Enter/Space activate the focused button. (Phase 3: IMP-VERSES-P12)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/verify-enter-on-read-aloud-reveals-1.mjs"`, `node "audits/tools/phase3/verses/verify-enter-on-read-aloud-reveals-2.mjs"`, `node "audits/tools/phase3/verses/misc.mjs"` — the defect must no longer reproduce; plus batch 5's checks.

#### P3-VERSES-12 — On the iPhone a double tap on "Got it" reveals the next verse before it is recited

- **Area** verses · **Type** bug · **Severity** low · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:429`; `apps/verses.html:48-49`, `apps/verses.html:303-304`, `apps/verses.html:108-116`, `apps/design.css:312`; `audits/evidence/p3/verses/critic-doubletap-got-iphone.png`, `audits/evidence/p3/verses/double-tap-ipad.png`
- **What happens now.** Below 560 px the ratings are stacked in one column (`apps/verses.html:48-49`). `rate()` sets `cur = null` and re-renders at once (`apps/verses.html:303-304`), with no cooldown or in-flight guard. `render()` then swaps `#act-rate` for `#act-show` (Read aloud / Show) in the same card (`apps/verses.html:108-116, 328-329`).
- **Why it matters.** Grandparents and kids often double-tap. Seeing the next verse before reciting it spoils that recall attempt, and a further tap rates a verse the person never recited.
- **Proposed fix.** Ignore a second tap within 400 ms of a rating; the next card arrives with a short transition. (Phase 3: IMP-VERSES-P11)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/critic-doubletap.mjs"`, `node "audits/tools/phase3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-1.mjs"`, `node "audits/tools/phase3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-2.mjs"` — the defect must no longer reproduce; plus batch 5's checks.

#### P3-VERSES-13 — The verse text veiled until Show is exposed to screen readers before Show

- **Area** verses · **Type** bug (security) · **Severity** low · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:467`; `apps/verses.html:43-44`, `apps/verses.html:107`, `apps/verses.html:326`, `apps/verses.html:272`; `audits/evidence/p3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-1-webkit.png`, `audits/evidence/p3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-2-webkit-before.png`
- **What happens now.** When F260 has the verse text, Verses puts it in `#text` and hides it only with a CSS blur (`.veiled { filter: blur(9px); user-select: none }`, `apps/verses.html:43-44`; the element at `apps/verses.html:107`; the class toggle at `apps/verses.html:326`). Nothing sets `aria-hidden`, `hidden` or `inert` on it before Show.
- **Why it matters.** A VoiceOver user swiping through the card hears the answer before being asked to recall it, which defeats the trainer. A sighted user correctly sees only a blur.
- **Proposed fix.** aria-hidden on the veiled text until Show. (Phase 3: IMP-VERSES-P13)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/critic-veiled-a11y.mjs"`, `node "audits/tools/phase3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-1.mjs"`, `node "audits/tools/phase3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-2.mjs"` — the defect must no longer reproduce; plus batch 5's checks.

#### P3-VERSES-14 — The empty state says a newly memorised verse appears "on its review day", but it is due at once

- **Area** verses · **Type** bug · **Severity** low · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:497`; `apps/verses.html:320`, `apps/verses.html:129`, `apps/f260.html:1651-1653`, `apps/verses.html:218-219`; `audits/screens/verses/trainer-empty-iphone-pwa-light.png`, `audits/evidence/p3/verses/critic-empty-copy-after-iphone.png`
- **What happens now.** The empty state reads "Mark a memory verse as memorised in F260 and it will show up here on its review day." (`apps/verses.html:129`).
- **Why it matters.** It is the only guidance a new person gets, and first-run copy that contradicts what then happens makes the trainer's schedule harder to trust.
- **Proposed fix.** Empty-state copy: "Mark a memory verse as memorised in F260 and you can review it here straight away", with a button to F260. (Phase 3: IMP-VERSES-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/critic-empty-copy.mjs"`, `node "audits/tools/phase3/verses/verify-critic-empty-state-copy-review-day-wrong-4-1.mjs"`, `node "audits/tools/phase3/verses/verify-critic-empty-state-copy-review-day-wrong-4-2.mjs"` — the defect must no longer reproduce; plus batch 5's checks.

#### UX-VERSES-2 — A mis-tapped rating cannot be undone

- **Area** verses · **Type** usability · **Severity** low · **Effort** S · **Batch** 5
- **Verified (step 3).** was medium; skeptics low (partly) and low. Correction: 'A thumb on Not yet instead of Got it' is not the adjacent slip: Almost sits between them on both the phone (stacked, 84 px apart) and the iPad (row).
- **Evidence.** `audits/03-apps/verses.md:533`; `apps/verses.html:294-304`, `apps/hub.js:431-434`; `audits/screens/verses/rated-typical-iphone-pwa-light.png`, `audits/evidence/p3/verses/kid-flow-revealed-iphone-pwa.png`
- **What happens now.** A mis-tapped rating cannot be undone (medium). `rate()` writes the new box, due date and streak and advances (`apps/verses.html:294-304`); the previous values are not kept, and the toast (`apps/hub.js:431-434`, 2.2 s) has no action. A thumb on Not yet instead of Got it demotes the verse and zeroes its streak; on the phone the buttons are 12 px apart. Evidence: `audits/screens/verses/rated-typical-iphone-pwa-light.png`; `audits/evidence/p3/verses/kid-flow-revealed-iphone-pwa.png`.
- **Why it matters.** A mis-tap cannot be undone.
- **Proposed fix.** An Undo toast after each rating restores the previous box, due date and streak. (Phase 3: IMP-VERSES-P2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 5's checks.

#### UX-VERSES-4 — The pill says "all done" when nothing was done, and "Nothing due today" shows the celebration star

- **Area** verses · **Type** usability · **Severity** low · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:535`; `apps/verses.html:316`, `apps/verses.html:119-121`; `audits/screens/verses/trainer-empty-iphone-pwa-light.png`, `audits/screens/verses/nothing-due-typical-iphone-pwa-light.png`
- **What happens now.** The pill says "all done" when nothing was done, and "Nothing due today" shows the celebration star (low). `apps/verses.html:316` prints "all done" whenever the queue is empty: "Eli · all done" over "Nothing to train yet"; "Grandma Jo · all done" for a guest; "Elizabeth · all done" over "Nothing due today" with 0 reviews, under the gold star (`apps/verses.html:119-121, 333`). Evidence: `audits/screens/verses/trainer-empty-iphone-pwa-light.png`; `audits/screens/verses/nothing-due-typical-iphone-pwa-light.png`; `audits/evidence/p3/verses/guest-iphone.png`.
- **Why it matters.** Wrong celebration.
- **Proposed fix.** Say "Nothing due today" without the celebration star, and "all done" only after reviews. (Phase 3: IMP-VERSES-P8)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 5's checks.

#### UX-VERSES-8 — The same number three times, and the empty message twice

- **Area** verses · **Type** usability · **Severity** low · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:539`; `audits/screens/verses/trainer-typical-ipad-portrait-light.png`, `audits/screens/verses/done-typical-iphone-pwa-light.png`
- **What happens now.** The same number three times, and the empty message twice (low; from the visual check). One screen shows the pill "3 to go", the stat "3 due today" and the list header "3 verses"; the done state repeats "Nothing due" in the hero and in the Due today card. Evidence: `audits/screens/verses/trainer-typical-ipad-portrait-light.png`; `audits/screens/verses/done-typical-iphone-pwa-light.png`; `audits/screens/verses/nothing-due-typical-iphone-pwa-light.png`.
- **Why it matters.** Repetition.
- **Proposed fix.** Say the due count once (the pill), not three times. (Phase 3: IMP-VERSES-P10)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 5's checks.

#### UX-VERSES-9 — Leitner jargon: "Box 3 · last 4d ago", "moves to box 4"

- **Area** verses · **Type** usability · **Severity** low · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:540`; `apps/verses.html:194`; `audits/screens/verses/trainer-typical-iphone-pwa-light.png`, `audits/screens/verses/rated-typical-iphone-pwa-light.png`
- **What happens now.** Leitner jargon: "Box 3 · last 4d ago", "moves to box 4" (low; from the visual check). The chip, the queue rows and the toasts speak in box numbers that nothing on screen explains, while the histogram labels the same boxes "Daily / 2 days / Weekly" (`apps/verses.html:194, 302, 324`). Evidence: `audits/screens/verses/trainer-typical-iphone-pwa-light.png`; `audits/screens/verses/rated-typical-iphone-pwa-light.png`; `audits/screens/verses/overdue-typical-ipad-portrait-light.png`.
- **Why it matters.** Leitner jargon.
- **Proposed fix.** Replace box jargon with intervals ("Next review in 4 days"). (Phase 3: IMP-VERSES-P10)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 5's checks.

#### VIS-VERSES-1 — The trainer card reserves 78-110 px of empty glass; on iPad and desktop it stays after Show

- **Area** verses · **Type** visual · **Severity** low · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:544`; `apps/verses.html:33-35`; `audits/screens/verses/trainer-typical-iphone-pwa-light.png`, `audits/screens/verses/kid-typical-ipad-portrait-light.png`
- **What happens now.** The trainer card reserves 78-110 px of empty glass; on iPad and desktop it stays after Show (low). Fixed `min-height` 448 px (phone), 520 px (kid phone), 380 px (560 px and wider) (`apps/verses.html:33-35`). Empty band before Show: iPhone 99 px (adult) and 110 px (kid); iPad and desktop 109 px (adult) and 78 px (kid). On iPad and desktop nothing grows on Show, so 109 px stays. The checker measured about 120 px under the rating row on iPad landscape. Evidence: `audits/evidence/p3/verses/layout.json`; `audits/screens/verses/trainer-typical-iphone-pwa-light.png`; `audits/screens/verses/kid-typical-ipad-portrait-light.png`; `audits/screens/verses/revealed-overflow-ipad-landscape-light.png`. Run `node "audits/tools/phase3/verses/layout.mjs"`.
- **Why it matters.** Empty glass.
- **Proposed fix.** Size the trainer card to its content; no fixed min-height after Show. (Phase 3: IMP-VERSES-P9)
- **How it will be verified.** Rerun `node "audits/tools/phase3/verses/layout.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 5's checks.

#### VIS-VERSES-6 — The histogram's tint follows the count, not the box

- **Area** verses · **Type** visual · **Severity** info · **Effort** S · **Batch** 5
- **Evidence.** `audits/03-apps/verses.md:549`; `apps/verses.html:82`; `audits/screens/verses/revealed-overflow-ipad-landscape-light.png`, `audits/screens/verses/trainer-overflow-iphone-pwa-light.png`
- **What happens now.** The histogram's tint follows the count, not the box (info; from the visual check). Bar colour is `color-mix` by the same `--p` as the height (`apps/verses.html:82`), so in overflow data the "4 days" bar (8) is the palest and "2 days" (22) darker than "Weekly" (20); the ramp does not show box progression. Evidence: `audits/screens/verses/revealed-overflow-ipad-landscape-light.png`; `audits/screens/verses/trainer-overflow-iphone-pwa-light.png`.
- **Why it matters.** The tint encodes the wrong thing.
- **Proposed fix.** Tint the histogram by box, not by count (info).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 5's checks.

#### UX-VERSES-3 — The daily review is 8 taps from Home; there is no Verses card although a summary is written for one

- **Area** verses · **Type** usability · **Severity** low (pointer) · **Effort** S · **Batch** 5
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: '8 taps from Home' overstates the gap. It is 2 taps to open the app (Apps tab, then the Verses tile); the other 6 are the Show and Got it taps for 3 due cards, which any design needs. A Home card would cut 2 taps to 1.
- **Evidence.** `audits/03-apps/verses.md:534`; `apps/verses.html:172`, `index.html:458`
- **Proposed fix.** Pointer to GAP-HOME-2: the Home card built from verses.summary brings the review to one tap. (Phase 3: IMP-VERSES-F1)

#### Improvements with no finding (verses)

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). They are optional; Phase 6 carries them only if the household wants them.

| ID | Improvement | Kind | Delight | Effort | Source |
|---|---|---|---|---|---|
| IMP-VERSES-F6 | Choose a verse to practise by tapping any row in Due today or Coming up | feature | 3 | M | `audits/03-apps/verses.md:704` |
| IMP-VERSES-I1 | Record yourself reciting and play it back, as Remember Me does | idea | 3 | M | `audits/03-apps/verses.md:710` |
| IMP-VERSES-I2 | An evening "3 verses to review" push, a per-person toggle using the existing push jobs and the summary row | idea | 3 | M | `audits/03-apps/verses.md:711` |
| IMP-VERSES-I3 | Practice modes on verses that have text: word scramble, fill-in-the-gaps, type the first letters | idea | 4 | L | `audits/03-apps/verses.md:712` |

### Batch 6 — Kitchen timer (24)

#### GAP-HOME-1 — A running kitchen timer is visible only to its owner

- **Area** shell / platform (Timer) · **Type** feature gap · **Severity** medium · **Effort** M · **Batch** 6
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: Nothing stated is wrong. The item leaves out that the owner already has a room-readable surface: the Timer app's own countdown is 88 px / 12.1 mm on the iPad (passes H1 at 2 m). The 'too small to read across the room' point applies to the Home pill only.
- **Evidence.** `audits/02-shell.md:566`; `index.html:780`, `index.html:1119-1128`
- **What happens now.** The pill reads `timer.active` from the signed-in person's own scope (`index.html:780, 786, 814`). The TV board has no timer pane (`index.html:1119-1128`).
- **Why it matters.** Whoever is in the kitchen needs to see a timer someone else started.
- **Proposed fix.** A running timer shows for everyone on the Kitchen iPad and the TV (a family `timers` channel mirrored from the person's timer.active, read-only for others), labelled with the owner's face. (Phase 3: IMP-TIMER-I3)
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 6's checks.

#### GAP-TIMER-2 — The alert is one 0.85 s three-pip beep that never repeats and needs no acknowledgement

- **Area** timer · **Type** feature gap · **Severity** medium · **Effort** S · **Batch** 6
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: Small caveat: 'needs no acknowledgement' holds for the sound only. The in-app done state (red wash, blinking digits) does wait for a tap.
- **Evidence.** `audits/03-apps/timer.md:377`; `apps/timer.html:96-99`, `index.html:810`
- **What happens now.** Three 250 ms notes at 880 Hz at 0, 0.3 and 0.6 s, once (`apps/timer.html:96-99`). A minute later the probe still counted 1 context and 3 oscillators (B3); the shell's toast lasts 4 s (`index.html:810`; B4 `oneMinuteLater.toast: null`). Only the blinking digits remain, and only in the app.
- **Why it matters.** One short beep is easy to miss.
- **Proposed fix.** The alert repeats every 15 s until acknowledged (a Stop button), with a choice of sound. (Phase 3: IMP-TIMER-F1)
- **How it will be verified.** recapture its screens (capture area timer) and compare; plus batch 6's checks.

#### GAP-TIMER-3 — Only six fixed presets: no custom time, +1 min, label, second timer or recents

- **Area** timer · **Type** feature gap · **Severity** medium · **Effort** M · **Batch** 6
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: One minor nuance: the app does remember one last-used preset per person (lastPreset, apps/timer.html:81,124), which is a one-item 'recent'. A second concurrent timer is possible, but only under another person's profile, because the record is per person. Neither changes the substance.
- **Evidence.** `audits/03-apps/timer.md:381`; `apps/timer.html:61-66`, `apps/timer.html:80`
- **What happens now.** Only six fixed presets: no custom time, +1 min, label, second timer or recents (medium). Six chips (`apps/timer.html:61-66`) and one record per person (`apps/timer.html:80`); custom entry, +1 min, labels, multiple timers, recents and sound choice are NOT FOUND IN CODE. A 12-minute pizza plus an oven timer cannot be set.
- **Why it matters.** Clock's timers do all of these.
- **Proposed fix.** Custom time, +1 min, labels, recents and a second concurrent timer (item: rows per timer). (Phase 3: IMP-TIMER-F5, IMP-TIMER-F7)
- **How it will be verified.** recapture its screens (capture area timer) and compare; plus batch 6's checks.

#### P2-PROF-08 — Switching people silences a running kitchen timer

- **Area** shell / platform (Timer) · **Type** bug · **Severity** medium · **Effort** S · **Batch** 6
- **Evidence.** `audits/02-shell.md:1334`; `index.html:785`, `index.html:806-810`, `index.html:806`
- **What happens now.** `timer.active` is person scope, and the shell reads only the signed-in person's cache (hub.js:29, 181-186; index.html:785, 814). After Me → Switch, the pill disappears. At 0 the iPad neither beeps nor shows a toast. The server row stays set.
- **Why it matters.** the Kitchen iPad is where oven timers are set, and it changes hands often.
- **Proposed fix.** A Switch keeps the previous person's running timer alive on the device (the shell keeps a per-device list of running timers and still beeps and notifies for them), and the new person sees "Mae's timer: 3:12" in the pill. (Phase 3: IMP-TIMER-I3)
- **How it will be verified.** plus batch 6's checks.

#### P2-STAB-13 — A device that wakes or reopens after a timer ended clears it from its stale cache, deleting a newer running timer on all the person's devices with no alert anywhere

- **Area** shell / platform (Timer) · **Type** bug · **Severity** medium · **Effort** S · **Batch** 6
- **Evidence.** `audits/02-shell.md:3410`; `index.html:828`, `index.html:623`, `apps/hub.js:334-337`, `apps/hub.js:339`
- **What happens now.** The candidate as written, which is harmless (both skeptics, phase 1). The awake devices beeped, toasted ("Timer done — 1:00 is up.") and notified at 0, and cleared the row. The device that slept woke 66–70 s after the end with 0 beeps, toasts and notifications. It wrote a second tombstone over the first.
- **Why it matters.** The kitchen timer is the thing that must ring. Two or more devices on one profile is ordinary use: a phone asleep with the hub open, or a laptop reopened later. A timer the person is relying on is cancelled with no sign on any device, and the food is not taken out.
- **Proposed fix.** A device clears timer.active only if the stored record is the one it saw end (same startedAt), using server time; a newer timer is never cleared.
- **How it will be verified.** Rerun `node "audits/tools/phase2/STAB/verify3-timer-cleared-by-sleeping-device-1.mjs"` — the defect must no longer reproduce; plus batch 6's checks.

#### PWA-GAP-1 — "Timer done" is a local notification only

- **Area** shell / platform (Timer) · **Type** feature gap · **Severity** medium · **Effort** M · **Batch** 6
- **Verified (step 3).** was medium; skeptics medium and medium.
- **Evidence.** `audits/02-shell.md:4818`; `index.html:797-803`, `index.html:804-810`, `index.html:1561`
- **What happens now.** `timerNotify` calls `showNotification` only if permission is already `granted` (index.html:797-803).
- **Why it matters.** A timer that ends while the phone is locked is silent.
- **Proposed fix.** A server-scheduled "Timer done" push: the Timer posts endAt to the Worker (POST /api/timer), and a cron or Durable alarm pushes at the end to the owner's devices. (Phase 3: IMP-TIMER-F6)
- **How it will be verified.** recapture its screens (capture area shell, tv) and compare; plus batch 6's checks.

#### UX-TIMER-1 — One tap on any preset chip cancels a running timer on every device, with no confirm and no undo

- **Area** timer · **Type** usability · **Severity** medium · **Effort** S · **Batch** 6
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: No factual error. One framing note: Reset clearing the timer without a confirm is expected, because Reset is an explicit cancel control. The real problem is only the preset chips.
- **Evidence.** `audits/03-apps/timer.md:315`; `apps/timer.html:121-125`, `apps/timer.html:120`; `audits/evidence/p3/timer/audience-kid-running-iphone-pwa.png`
- **What happens now.** The preset handler runs `stop(); write(null)` and loads the new preset (`apps/timer.html:121-125`). In `basics.mjs` the timer read 9:57 with Pause; one tap on "3 min" gave 3:00 with Start, and the server row became `timer.active: null`, so the pill vanished on every device of the person.
- **Why it matters.** One tap cancels a running timer on every device.
- **Proposed fix.** A preset tap while running asks inline ("Replace 9:57?") or adds a second timer; never cancels silently. (Phase 3: IMP-TIMER-P2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/timer/basics.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 6's checks.

#### UX-TIMER-2 — Pause exists only in one page's memory, and a paused timer looks exactly like an idle one

- **Area** timer · **Type** usability · **Severity** medium · **Effort** S · **Batch** 6
- **Verified (step 3).** was medium; skeptics medium (partly) and medium (partly). Correction: 'Styled exactly like an idle timer of that length' is slightly overstated. The paused ring keeps its partial progress (--p = left/total, 0.9833 at 9:50 of 10:00), while an idle dial's ring is always full.
- **Evidence.** `audits/03-apps/timer.md:321`; `apps/timer.html:114`, `apps/timer.html:135`, `apps/timer.html:92`; `audits/evidence/p3/timer/sync2-phone-paused.png`, `audits/evidence/p3/timer/sync2-ipad-after-phone-pause.png`
- **What happens now.** Pause clears `timer.active` (`apps/timer.html:114`). Pausing at 2:55 left the server row and the Home pill null, and reopening showed 3:00 (`basics.json` `D_*`).
- **Why it matters.** A paused timer looks idle.
- **Proposed fix.** Pause is stored (timer.active {pausedAt, remaining}) and shown everywhere as paused. (Phase 3: IMP-TIMER-P6, IMP-TIMER-F2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 6's checks.

#### UX-TIMER-3 — A timer that ends while the only device is asleep or closed leaves no trace

- **Area** timer · **Type** usability · **Severity** medium · **Effort** S · **Batch** 6
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: No substantive error. A precision note: the shell does not clear every ended record silently. A record seen within 60 s of its end still gets the beep, toast and notification (index.html:806-810), so 'no trace' applies only to a return more than 60 s after the end.
- **Evidence.** `audits/03-apps/timer.md:327`; `index.html:806`, `apps/timer.html:129`, `index.html:801`, `sw.js:62-64`
- **What happens now.** B5: app closed, page hidden through the end, back 2 min later: no beep, toast or notification, and no pill. B6: the whole page closed with the Timer open, reopened on `#timer` 2 min after 0: "1:00 Start", not the done state.
- **Why it matters.** A timer ending while the device sleeps leaves no trace.
- **Proposed fix.** A timer that ended unseen shows "Timer ended at 6:42" on the next open and in the pill for 10 min. (Phase 3: IMP-TIMER-F4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/timer/background.mjs"` — the defect must no longer reproduce; recapture its screens (capture area timer) and compare; plus batch 6's checks.

#### GAP-TIMER-1 — The Timer never offers the "Timer done" notification: the only permission prompt is the Me push switch

- **Area** timer · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 6
- **Evidence.** `audits/03-apps/timer.md:373`; `index.html:1561`
- **What happens now.** Reclassified by the critic. The suppression half of this item (the shell skips its notification while the Timer app is open, even in a hidden page, and the app has no notification code) works against CLAUDE.md's stated intent, went to two skeptics and is now the confirmed defect P3-TIMER-04. What stays here is the gap.
- **Why it matters.** The only permission prompt is buried in Me.
- **Proposed fix.** The Timer offers "Notify me when it ends" (asks notification permission in context). (Phase 3: IMP-TIMER-F3)
- **How it will be verified.** recapture its screens (capture area timer) and compare; plus batch 6's checks.

#### P2-STAB-08 — A shared timer counts down against each device's own clock, and a fast device silently cancels it on the others

- **Area** shell / platform (Timer) · **Type** bug · **Severity** low · **Effort** S · **Batch** 6
- **Evidence.** `audits/02-shell.md:3260`; `apps/timer.html:116`, `apps/timer.html:108`, `index.html:816`, `apps/hub.js:290`
- **What happens now.** The investigator's run. A phone 86 s fast showed 9:57 while the iPad pill showed 11:23 (`skew.json`). Skeptic 1 (90 s fast). The two devices showed 9:18 and 10:47. On a 3-minute timer started on the iPad: the phone toasted "Timer done — 3:00 is up." at 91 s, and the server row became null;
- **Why it matters.** Only one person's devices share `timer.active`. A PC, a second iPad or a phone signed in as the same person, whose clock is more than about a second fast, would cancel the kitchen timer on the device that started it, with no beep.
- **Proposed fix.** Store the timer's endAt in server time (Date.now() - hub.skew when writing, + hub.skew when reading) so every device counts down to the same instant; a device only clears a timer it has seen end in server time.
- **How it will be verified.** plus batch 6's checks.

#### P2-STAB-09 — The shell takes the wake lock only from taps on its own document, so a page that starts inside an app runs without one

- **Area** shell / platform · **Type** bug · **Severity** low · **Effort** S · **Batch** 6
- **Evidence.** `audits/02-shell.md:3297`; `index.html:1711`, `index.html:413`, `apps/dollywood.html:1530`, `sw.js:62-69`
- **What happens now.** A page loaded straight into `#timer`, with Start tapped inside the app, made 0 requests in both engines while the countdown ran (`wakelock.json` e; `verify-wake-lock-not-taken-from-app-iframe-1.json` A: 9:55; `-2.json` B: 9:56 → 9:54). The app frame could take a lock itself: `granted`.
- **Why it matters.** On that route the iPad can auto-lock mid-countdown. JavaScript then stops, so the timer does not beep. Whether iOS standalone honours the lock at all is under Unresolved.
- **Proposed fix.** The Timer app requests the wake lock itself while a timer runs (the iframe is allowed screen-wake-lock) and the shell re-requests on any visibilitychange while one runs.
- **How it will be verified.** Rerun `node "audits/tools/phase2/STAB/wakelock.mjs"` — the defect must no longer reproduce; plus batch 6's checks.

#### P3-TIMER-02 — At 0:00 the round dial stretches into a tall pill and the controls below jump 24 px

- **Area** timer · **Type** bug · **Severity** low · **Effort** S · **Batch** 6
- **Evidence.** `audits/03-apps/timer.md:193`; `apps/timer.html:87`, `apps/timer.html:30`, `apps/timer.html:51`, `apps/design.css:545`; `audits/evidence/p3/timer/basics-done-iphone-light.png`, `audits/evidence/p3/timer/verify-done-dial-oval-1-iphone-done.png`
- **What happens now.** At 0, `show()` toggles the class `empty` on `#dial` (`apps/timer.html:87`), which the app means only to hide the ring's round-cap dot (`apps/timer.html:30`). The body is `class="ds"` (`apps/timer.html:51`), so design.css's empty-state rule `.ds .empty { padding: var(--sp-10) var(--sp-4) }` (`apps/design.css:545`) also applies.
- **Why it matters.** The one moment the timer has to look finished and calm, it deforms and the buttons jump under the finger.
- **Proposed fix.** The dial keeps its aspect ratio at 0 (aspect-ratio: 1) and nothing below moves. (Phase 3: IMP-TIMER-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/timer/verify-done-dial-oval-1.mjs"`, `node "audits/tools/phase3/timer/verify-done-dial-oval-2.mjs"`, `node "audits/tools/phase3/timer/basics.mjs"` — the defect must no longer reproduce; plus batch 6's checks.

#### P3-TIMER-03 — Every finish leaves a new `AudioContext` running; in the shell they pile up for the life of the page

- **Area** timer · **Type** bug · **Severity** low · **Effort** S · **Batch** 6
- **Evidence.** `audits/03-apps/timer.md:222`; `apps/timer.html:95`, `index.html:790`, `index.html:732`, `apps/timer.html:94`
- **What happens now.** `beep()` in the app (`apps/timer.html:95`) and `timerBeep()` in the shell (`index.html:790`) each construct a new `AudioContext` per finish and never call `close()`. Each stays in the `running` state after the 0.85 s chime.
- **Why it matters.** Only on the 24/7 iPad, as a slow accumulation. Whether iPadOS caps concurrent contexts, or whether live contexts cost battery, is not shown; if a cap exists, later beeps would fail silently inside the `try/catch` (`apps/timer.html:94, 100`; `index.html:789, 795`).
- **Proposed fix.** One AudioContext, unlocked at Start and reused (or closed after the chime). (Phase 3: IMP-TIMER-P11)
- **How it will be verified.** Rerun `node "audits/tools/phase3/timer/verify-audiocontext-never-closed-2.mjs"`, `node "audits/tools/phase3/timer/verify-audiocontext-never-closed-1.mjs"` — the defect must no longer reproduce; plus batch 6's checks.

#### P3-TIMER-04 — The "Timer done" notification is suppressed whenever the Timer app is open, even while the page is hidden, and the app has no notification of its own

- **Area** timer · **Type** bug · **Severity** low · **Effort** S · **Batch** 6
- **Evidence.** `audits/03-apps/timer.md:250`; `index.html:1561`, `index.html:807`, `index.html:776-778`, `apps/timer.html:102`
- **What happens now.** `finishTimer` computes `appOpen = !!current && current.id === 'timer'` (`index.html:807`). With the app open it skips the shell beep (`:808`) and both the toast and `timerNotify` (`:810`), and it never checks `document.hidden` or `visibilityState`.
- **Why it matters.** On Eli's desktop, the Timer left open after Start is the most common state, and that is exactly when the banner is lost; if the tab is muted or the speakers are off, nothing shows that time is up.
- **Proposed fix.** At 0 a local notification is shown whenever the page is hidden, whichever app is open; only the toast is skipped when the Timer is visible. (Phase 3: IMP-TIMER-F3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/timer/verify-critic-notify-suppressed-while-app-open-3-2.mjs"`, `node "audits/tools/phase3/timer/verify-critic-notify-suppressed-while-app-open-3-1.mjs"` — the defect must no longer reproduce; plus batch 6's checks.

#### P3-TIMER-05 — Every countdown reaches 0:00 and beeps 0.2-0.5 s early, and each digit changes about 0.5 s early, because `step()` rounds

- **Area** timer · **Type** bug · **Severity** low · **Effort** S · **Batch** 6
- **Evidence.** `audits/03-apps/timer.md:283`; `apps/timer.html:108`, `index.html:816`, `apps/timer.html:102`
- **What happens now.** `step()` computes `left = Math.max(0, Math.round((endAt - Date.now()) / 1000))` (`apps/timer.html:108`) and calls `finish()` when `left === 0` (`:109`); `finish()` sets the done state, beeps and clears `timer.active` in the same call (`:102`).
- **Why it matters.** Small, but a kitchen timer should not ring before its time, and "1:00" should not turn into "0:59" half a second after Start.
- **Proposed fix.** Display with Math.ceil and fire at endAt (endAt - now <= 0), in the app and the shell. (Phase 3: IMP-TIMER-P12)
- **How it will be verified.** Rerun `node "audits/tools/phase3/timer/verify-critic-early-finish-rounding-4-2.mjs"`, `node "audits/tools/phase3/timer/critic-early-finish.mjs"`, `node "audits/tools/phase3/timer/verify-critic-early-finish-rounding-4-1.mjs"` — the defect must no longer reproduce; plus batch 6's checks.

#### UX-TIMER-4 — "Time's up" is shown only by colour and blinking: no words and no icon

- **Area** timer · **Type** usability · **Severity** low · **Effort** S · **Batch** 6
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: 'Only by colour' is wrong: the blink (a luminance/opacity change), the full ring in place of the progress arc (a shape change), 0:00, and Start returning as the primary button are all non-colour cues.
- **Evidence.** `audits/03-apps/timer.md:335`; `apps/timer.html:12`, `apps/timer.html:36`; `audits/evidence/p3/timer/visual-done-hearth-ipad.png`, `audits/screens/timer/running-typical-ipad-portrait-light.png`
- **What happens now.** At 0 the page text is only "Kitchen timer 0:00 1 min … Start Reset" (`basics.json` `E_done.dial.text`).
- **Why it matters.** The done state relies on colour.
- **Proposed fix.** "Time's up" in words with a bell icon, not only colour and blinking. (Phase 3: IMP-TIMER-P1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/timer/visual.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 6's checks.

#### UX-TIMER-5 — The digits read only to about 2.5 m on the Kitchen iPad, because the dial is capped at 400 px

- **Area** timer · **Type** usability · **Severity** low · **Effort** S · **Batch** 6
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: 'Both iPad orientations get a 400 px dial because of the cap' is wrong for landscape: 52vh of the 772 px viewer frame is 401 px, so the height limits the dial there and removing the cap changes nothing. The cap binds only in portrait, where the uncapped dial would be 589 px (digits about 18 mm).
- **Evidence.** `audits/03-apps/timer.md:340`; `apps/timer.html:22`; `audits/screens/timer/idle-typical-ipad-landscape-light.png`, `audits/evidence/p3/timer/visual-idle-hearth-ipad.png`
- **What happens now.** The digits render 64 px high (an 88 px font; canvas `actualBoundingBox`), 12.3 mm on an 11-inch iPad: readable to 2.46 m by h ≥ d/200. Reading at 3 m needs 15 mm.
- **Why it matters.** Digits read only to 2.5 m.
- **Proposed fix.** Lift the 400 px dial cap on the iPad (digits at --fs-glance-1). (Phase 3: IMP-TIMER-P3)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 6's checks.

#### UX-TIMER-6 — Kid mode enlarges the controls, but every one is a word

- **Area** timer · **Type** usability · **Severity** low · **Effort** S · **Batch** 6
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: 'While running, Pause loses its fill and looks like Reset' is wrong: Pause loses only the accent gradient and keeps a filled, bordered, shadowed button, while Reset is bare text (measured in both devices and visible in audience-kid-running-ipad-portrait.png).
- **Evidence.** `audits/03-apps/timer.md:345`; `apps/design.css:280-284`, `apps/timer.html:60-71`, `apps/timer.html:106`; `audits/evidence/p3/timer/audience-kid-idle-iphone-pwa.png`, `audits/evidence/p3/timer/audience-kid-running-ipad-portrait.png`
- **What happens now.** For Ezra the kid tokens make the chips 64 px and Start/Reset 84 px tall (`apps/design.css:280-284`), but no control has an icon (`hasIcon: false`). Labels are "1 min" … "30 min", Start, Pause and Reset (`apps/timer.html:60-71`).
- **Why it matters.** Every kid control is a word.
- **Proposed fix.** Kid controls get icons (play, pause, reset) and preset pictures (egg, pasta). (Phase 3: IMP-TIMER-I1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/timer/audience.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 6's checks.

#### UX-TIMER-7 — Starting a timer takes 3 taps from Home (4 for another length); Home has no timer card

- **Area** timer · **Type** usability · **Severity** low · **Effort** M · **Batch** 6
- **Evidence.** `audits/03-apps/timer.md:349`; `apps.json:8`, `apps/timer.html:81`
- **What happens now.** Apps → tile → Start (`basics.json` `A_tapsToRunningLastPreset: 3`); Ezra's 1 min took 4 (`audience.json`). The tile is `small` with no widget (`apps.json:8`).
- **Why it matters.** Three taps to start.
- **Proposed fix.** A Home timer card with the last three lengths (1 tap to start). (Phase 3: IMP-TIMER-F8)
- **How it will be verified.** recapture its screens (capture area timer) and compare; plus batch 6's checks.

#### UX-TIMER-10 — VoiceOver hears neither the countdown nor the selected preset

- **Area** timer · **Type** usability · **Severity** low · **Effort** S · **Batch** 6
- **Evidence.** `audits/03-apps/timer.md:358`; `apps/timer.html:57`
- **What happens now.** No `aria-live` region and no `aria-pressed`; the selection is only the class `.on` (`apps/timer.html:57, 88`). Evidence: `basics.json` `B_measure` (`ariaLive: 0`, `ariaPressed: 0`).
- **Why it matters.** VoiceOver hears nothing.
- **Proposed fix.** aria-live for the countdown each minute and aria-pressed on presets. (Phase 3: IMP-TIMER-P8)
- **How it will be verified.** recapture its screens (capture area timer) and compare; plus batch 6's checks.

#### VIS-TIMER-1 — While running, the screen has no primary control

- **Area** timer · **Type** visual · **Severity** low · **Effort** S · **Batch** 6
- **Evidence.** `audits/03-apps/timer.md:363`; `apps/timer.html:106`; `audits/screens/timer/running-typical-iphone-pwa-light.png`, `audits/screens/timer/running-typical-desktop-dark.png`
- **What happens now.** While running, the screen has no primary control (low; the visual check found it independently). `run()` removes `btn-primary` (`apps/timer.html:106`), so Pause becomes a plain secondary button next to a ghost Reset, and the emphasis drops away abruptly at Start. Apple's Clock keeps a coloured Pause. Evidence: `basics.json` `A_running.primary: false`; `audits/screens/timer/running-typical-iphone-pwa-light.png`, `audits/screens/timer/running-typical-desktop-dark.png`, `audits/evidence/p3/timer/audience-kid-running-iphone-pwa.png`.
- **Why it matters.** No primary control while running.
- **Proposed fix.** While running, Pause is the primary button. (Phase 3: IMP-TIMER-P6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 6's checks.

#### VIS-TIMER-2 — "Kitchen timer" shows twice inside the hub, the second time in a serif

- **Area** timer · **Type** visual · **Severity** low · **Effort** S · **Batch** 6
- **Evidence.** `audits/03-apps/timer.md:364`; `apps/timer.html:53`, `apps/timer.html:19`, `apps/timer.html:18`; `audits/screens/timer/running-typical-iphone-pwa-light.png`
- **What happens now.** "Kitchen timer" shows twice inside the hub, the second time in a serif (low). The in-app header (`apps/timer.html:53`) sits under the viewer bar's 14 px title and hides only below 640 px viewport height (`apps/timer.html:19`); it showed on all four measured devices. The h1 is ui-serif 18 px 600 (`apps/timer.html:18`). Evidence: `visual.json` V2; `audits/screens/timer/running-typical-iphone-pwa-light.png`.
- **Why it matters.** The title shows twice.
- **Proposed fix.** Drop the in-app title inside the hub (the viewer bar names the app). (Phase 3: IMP-TIMER-P7)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 6's checks.

#### VIS-TIMER-4 — Times over an hour read as minutes ("104:05"), but the Timer UI cannot create one

- **Area** timer · **Type** visual · **Severity** low · **Effort** S · **Batch** 6
- **Evidence.** `audits/03-apps/timer.md:366`; `apps/timer.html:83`, `index.html:783`, `apps/timer.html:66`, `worker/src/chat.js:173-180`; `audits/screens/timer/running-overflow-iphone-pwa-light.png`, `audits/screens/timer/chip-overflow-iphone-pwa-light.png`
- **What happens now.** Times over an hour read as minutes ("104:05"), but the Timer UI cannot create one (low; the visual checker rates it info). `fmt` (`apps/timer.html:83`) and `fmtLeft` (`index.html:783`) have no hours. The longest preset is 1800 s (`apps/timer.html:66`); only seeded rows, the raw API or chat `set_data` (`worker/src/chat.js:173-180`, unproven model behaviour) produce one. It still fits the ring at 430 and 1440. Evidence: `audits/screens/timer/running-overflow-iphone-pwa-light.png`, `audits/screens/timer/chip-overflow-iphone-pwa-light.png`.
- **Why it matters.** "104:05".
- **Proposed fix.** Format hours as h:mm:ss.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 6's checks.

#### Improvements with no finding (timer)

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). They are optional; Phase 6 carries them only if the household wants them.

| ID | Improvement | Kind | Delight | Effort | Source |
|---|---|---|---|---|---|
| IMP-TIMER-I2 | Say it: a `start_timer` chat tool, or `hub.voiceInput` on the Timer, so hands-busy cooks can start or add time by voice | idea | 4 | M | `audits/03-apps/timer.md:577` |

### Batch 7 — Kid Verse (16)

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

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). They are optional; Phase 6 carries them only if the household wants them.

| ID | Improvement | Kind | Delight | Effort | Source |
|---|---|---|---|---|---|
| IMP-KIDVERSE-F3 | Highlight each word of the paraphrase and story as it is read, from `SpeechSynthesisUtterance` boundary events | feature | 5 | M | `audits/03-apps/kidverse.md:903` |
| IMP-KIDVERSE-I1 | Past weeks shelf: earlier weeks' scene cards a kid can tap to hear an old verse or story again (read-only, no new stars) | idea | 4 | M | `audits/03-apps/kidverse.md:911` |
| IMP-KIDVERSE-I2 | Record a parent's voice: an adult records the verse once a week (the media store), and "Read it to me" plays Mom's or Dad's voice instead of the synthetic one | idea | 5 | L | `audits/03-apps/kidverse.md:912` |

### Batch 8 — Larder Ledger (16)

#### GAP-LEFTOVERS-1 — No way to fix a mistake or give a food its own use-by: no edit and no per-item expiry

- **Area** leftovers · **Type** feature gap · **Severity** medium · **Effort** M · **Batch** 8
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: "Loses logged by" is true only when someone other than the original logger fixes the item; the same person re-logging keeps their own name. The report leaves out two things. The ✓-and-re-log fix also posts a false "Finished the <item>" line to the family feed, which strengthens the item.
- **Evidence.** `audits/03-apps/leftovers.md:862`; `apps/leftovers.html:137`, `apps/leftovers.html:249-311`
- **What happens now.** Items can only be added or removed. A wrong date or size needs delete and re-add, which loses "logged by".
- **Why it matters.** Mistakes need delete and re-add.
- **Proposed fix.** Tap a card to edit name, size, date and an optional use-by; the ramp uses the use-by when set. (Phase 3: IMP-LEFTOVERS-F1, IMP-LEFTOVERS-I2)
- **How it will be verified.** recapture its screens (capture area leftovers) and compare; plus batch 8's checks.

#### P3-LEFTOVERS-02 — Home, the Apps badge and the 8 am push word the fridge differently from the Larder

- **Area** leftovers · **Type** bug · **Severity** medium · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:212`; `apps/leftovers.html:137`, `apps/leftovers.html:146`, `index.html:679-681`, `index.html:1175`; `audits/evidence/p3/leftovers/thresholds-home-ipad.png`, `audits/evidence/p3/leftovers/verify-thresholds-disagree-1-home-iphone.png`
- **What happens now.** As filed, the investigator found three rules:
- **Why it matters.** The lock screen says a 5-day chili must be used up, the app calls it "eat soon", and Home calls an 8-day dish "to eat this week" while the app says "a week or older". People learn to ignore one of the three.
- **Proposed fix.** One freshness rule shared by the Larder, Home, the Apps badge and the 8 am push ("eat soon" 4-6 days, "use it up" 7+), from one function. (Phase 3: IMP-LEFTOVERS-P2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-thresholds-disagree-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-thresholds-disagree-2.mjs"`, `node "audits/tools/phase3/leftovers/thresholds.mjs"` — the defect must no longer reproduce; plus batch 8's checks.

#### P3-LEFTOVERS-10 — "Copy failed — select manually" leaves nothing to select (from the visual check)

- **Area** leftovers · **Type** bug · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:536`; `apps/leftovers.html:341`, `apps/leftovers.html:339-347`, `apps/leftovers.html:350-358`, `apps/leftovers.html:114`; `audits/screens/leftovers/copy-error-iphone-safari-dark.png`, `audits/evidence/p3/leftovers/verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-1-failed.png`
- **What happens now.** `copyText` tries the async clipboard and then a selection copy from a textarea that is invisible (`opacity:0`) and removed straight after `execCommand` (`apps/leftovers.html:339-347`). On failure the label reads "Copy failed — select manually" for 2 s and then reverts (`apps/leftovers.html:350-358`).
- **Why it matters.** The one fallback the app offers tells the person to do something the page makes impossible.
- **Proposed fix.** On copy failure show the text in a pre-selected box (or the share sheet). (Phase 3: IMP-LEFTOVERS-F3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-2.mjs"`, `node "audits/tools/phase3/leftovers/verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-1.mjs"` — the defect must no longer reproduce; plus batch 8's checks.

#### P3-LEFTOVERS-11 — Long item names are cut to one line and cannot be read in the Larder (from the visual check)

- **Area** leftovers · **Type** bug · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:564`; `apps/leftovers.html:75`, `apps/leftovers.html:254-286`, `apps/leftovers.html:122`, `index.html:1175`; `audits/screens/leftovers/main-overflow-iphone-pwa-light.png`, `audits/screens/leftovers/main-overflow-ipad-portrait-dark.png`
- **What happens now.** `.nm` is one line with `nowrap`, `overflow: hidden` and an ellipsis (`apps/leftovers.html:75`). The card has no title, no tap handler and no detail view; its only control is the ✓, which deletes (`apps/leftovers.html:254-286`). On iPhone "Forgotten jar of homemade c…" keeps 37% of its name.
- **Why it matters.** "Church potluck baked ziti (th…" and "Vegetable fried rice with scra…" hide the part that says which dish it is.
- **Proposed fix.** Names wrap to two lines; a tap opens the edit sheet with the full name. (Phase 3: IMP-LEFTOVERS-F1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-2.mjs"`, `node "audits/tools/phase3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-1.mjs"`, `node "audits/tools/phase3/leftovers/entry.mjs"` — the defect must no longer reproduce; plus batch 8's checks.

#### UX-LEFTOVERS-3 — Nothing in the Larder can be read from 2 m on the Kitchen iPad

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** M · **Batch** 8
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: Cap millimetres come from WebKit's integer-rounded actualBoundingBoxAscent, so they overstate slightly (item names about 2.2 mm, not 2.31; chips about 1.6 mm, not 1.73).
- **Evidence.** `audits/03-apps/leftovers.md:753`; `apps/leftovers.html:213`, `apps/leftovers.html:23`; `audits/screens/leftovers/main-typical-ipad-portrait-light.png`
- **What happens now.** Cap heights on the 11" iPad (0.1924 mm per CSS px, canvas `measureText('H')`), against Phase 2's H1 (cap ≥ distance/200: 10 mm at 2 m) and H2 (≥ distance/344: 5.8 mm at 2 m), `audits/02-shell.md:519-520`: the 28 px title: 3.85 mm;
- **Why it matters.** Nothing reads from 2 m.
- **Proposed fix.** Glance roles on the Kitchen iPad: the oldest item and its age at --fs-glance-3. (Phase 3: IMP-LEFTOVERS-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/visual.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 8's checks.

#### UX-LEFTOVERS-4 — "Copy list for Hearth" tells people to ask Claude for something the hub's Claude cannot do

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** S · **Batch** 8
- **Verified (step 3).** was medium; skeptics medium and low (partly); tie-break low (partly). Correction: The report says "The hub's Chat tab is Claude". That is true only in the code, not in anything a household member sees, so the "tell Claude" instruction does not clearly point at the hub assistant.
- **Evidence.** `audits/03-apps/leftovers.md:764`; `apps/leftovers.html:114-115`, `apps/leftovers.html:152`, `apps/leftovers.html:331`, `apps/leftovers.html:113-117`; `audits/evidence/p3/leftovers/roles-hearth-copied-iphone.png`, `audits/screens/leftovers/copy-typical-iphone-pwa-light.png`
- **What happens now.** The block says to copy, then tell Claude "push my leftovers to Hearth", and that "it'll add them straight to the Hearth Calendar" (`apps/leftovers.html:114-115`). The hub's Chat tab is Claude, but the Worker has no Hearth tool: 0 occurrences of "hearth" in `worker/src`.
- **Why it matters.** It tells people to ask Claude for something it cannot do.
- **Proposed fix.** Remove the Hearth instructions, or add a real Hearth path (a chat tool) before telling people to use it. (Phase 3: IMP-LEFTOVERS-F3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/roles.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 8's checks.

#### UX-LEFTOVERS-5 — Log with an empty name does nothing, with no message and no focus

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:773`; `apps/leftovers.html:291-292`
- **What happens now.** `if (!name) return;` (`apps/leftovers.html:291-292`), and the input has no `required`.
- **Why it matters.** Nothing happens.
- **Proposed fix.** Log with an empty name shows "Type what it is" and focuses the field.
- **How it will be verified.** recapture its screens (capture area leftovers) and compare; plus batch 8's checks.

#### UX-LEFTOVERS-6 — After Log there is no confirmation, and the new card can land under the add bar

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:776`; `apps/leftovers.html:298-303`; `audits/screens/leftovers/queued-offline-ipad-landscape-light.png`, `audits/evidence/p3/leftovers/taps-logged-iphone-pwa.png`
- **What happens now.** The field clears and the count changes, but there is no toast and no scroll (`apps/leftovers.html:298-303`).
- **Why it matters.** The new card lands under the bar.
- **Proposed fix.** After Log, a toast "Logged Taco soup" and scroll the new card into view above the bar.
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/critic-followups.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 8's checks.

#### UX-LEFTOVERS-8 — The sync error line shows a raw server code ("internal.") with no retry

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:794`; `apps/leftovers.html:185`; `audits/screens/leftovers/main-error-iphone-pwa-light.png`
- **What happens now.** `'The house list had a problem: ' + lastError` (`apps/leftovers.html:185`) renders "The house list had a problem: internal." in 12 px amber, quieter than the red banner below it.
- **Why it matters.** A raw server code.
- **Proposed fix.** Plain-language sync error with Retry.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.

#### UX-LEFTOVERS-9 — The red banner names no item and cannot be tapped

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:798`; `apps/leftovers.html:207-215`; `audits/screens/leftovers/main-overflow-iphone-pwa-light.png`
- **What happens now.** It is plain text, "N items at a week or older" (`apps/leftovers.html:207-215`). A 63-day-old jar and an 8-day-old dish get the same line.
- **Why it matters.** The banner says nothing useful.
- **Proposed fix.** The banner names the oldest item and scrolls to it on tap.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-4 — The person's colour reaches only the add bar's glass tint; a card shows who logged it only as a name

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:821`; `apps/leftovers.html:39`, `apps/leftovers.html:265`; `audits/evidence/p3/leftovers/accent-eli-ipad.png`, `audits/evidence/p3/leftovers/accent-mae-ipad.png`
- **What happens now.** `--accent` differs by profile (Eli #4F5D8C, Mae #BC5A38), but `form#add` is the only element whose paint differs: the glass pickup (`apps/leftovers.html:39`).
- **Why it matters.** The person's colour barely appears.
- **Proposed fix.** Show who logged it with hub.avatarHtml, not only a name.
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/accent.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-5 — Default form controls in the glass bar: a native grey select and raw ISO dates

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:826`; `apps/leftovers.html:52-53`, `apps/leftovers.html:265`; `audits/screens/leftovers/add-typical-iphone-pwa-light.png`, `audits/screens/leftovers/main-typical-ipad-portrait-dark.png`
- **What happens now.** The select keeps `appearance: auto` (`apps/leftovers.html:52-53`), so it shows a native grey control that does not match its siblings, and is lighter in dark mode.
- **Why it matters.** Native controls and raw ISO dates.
- **Proposed fix.** A styled size select and friendly dates ("Mon 14 Sep · 8 days"). (Phase 3: IMP-LEFTOVERS-P3)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-6 — The fixed add bar covers cards and the Hearth block, and the list is read through it

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:831`; `apps/leftovers.html:33-45`, `apps/leftovers.html:19`; `audits/screens/leftovers/main-typical-ipad-landscape-light.png`, `audits/screens/leftovers/add-typical-ipad-landscape-dark.png`
- **What happens now.** The bar is about 130 px of fixed `glass-strong` (`apps/leftovers.html:33-45`).
- **Why it matters.** The bar covers cards.
- **Proposed fix.** Bottom padding equals the bar height; the bar is solid material over the list.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-8 — No press scale, spring, toast or sheet: every action is an instant re-render

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:843`; `apps/leftovers.html:57`, `apps/leftovers.html:80`, `apps/leftovers.html:203-246`, `apps/leftovers.html:61`
- **What happens now.** The `:active` rules change the background only (`apps/leftovers.html:57, 85, 95`). The ✓ has transition 0s and transform none.
- **Why it matters.** No press feedback or motion.
- **Proposed fix.** .pressable on the ✓ and Log, and a finished card animates out.
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/critic-bar-motion.mjs"` — the defect must no longer reproduce; recapture its screens (capture area leftovers) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-9 — Two identical refresh glyphs on one screen do different things

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:849`; `apps/leftovers.html:152`; `audits/screens/leftovers/main-typical-ipad-portrait-light.png`, `audits/screens/leftovers/main-empty-iphone-pwa-light.png`
- **What happens now.** The shell top bar's reload and the Larder's Copy button both use the circular-arrows glyph (`apps/leftovers.html:152, 352`).
- **Why it matters.** Two identical glyphs do different things.
- **Proposed fix.** Copy uses a copy icon, not the refresh glyph.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-11 — The name field shrinks by 60 px when the mic appears after ready

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:855`; `apps/leftovers.html:123`, `apps/leftovers.html:315-316`; `audits/screens/leftovers/main-loading-iphone-pwa-light.png`, `audits/screens/leftovers/main-typical-iphone-pwa-light.png`
- **What happens now.** While loading the mic is hidden (`apps/leftovers.html:123`). After ready it appears (`apps/leftovers.html:315-316`), the name field narrows, and the iPhone placeholder is cut to "Chicken alf".
- **Why it matters.** The field shrinks after load.
- **Proposed fix.** Reserve the mic's space from the start.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.

#### Improvements with no finding (leftovers)

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). They are optional; Phase 6 carries them only if the household wants them.

| ID | Improvement | Kind | Delight | Effort | Source |
|---|---|---|---|---|---|
| IMP-LEFTOVERS-I1 | Swipe to finish, plus "someone ate some": an iOS-style trailing swipe (keeping the ✓ for grandparents) and a "half left" state instead of all-or-nothing | idea | 3 | M | `audits/03-apps/leftovers.md:1046` |

### Batch 9 — Dollywood build guide (48)

#### P3-DOLLYWOOD-03 — On phones the … menu opens out of the sheet: Export and Import cannot be reached, and only a sliver of Reset can

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:229`; `apps/dollywood.html:313`, `apps/dollywood.html:371`, `apps/dollywood.html:359`; `audits/evidence/p3/dollywood/phone-progress-menu-clipped.png`, `audits/evidence/p3/dollywood/verify-progress-menu-clipped-phone-1-half.png`
- **What happens now.** Inside the `@media (max-width:699px)` block that opens at `apps/dollywood.html:313`, the menu is set to open upward (`bottom: calc(100% + 6px)`, `apps/dollywood.html:371`). It hangs off the sheet's top row, and the sheet is `position: fixed` with `overflow: hidden` (`apps/dollywood.html:359`), so almost all of it is clipped.
- **Why it matters.** On a phone there is no way to make a backup (Export), which is the only recovery from P3-DOLLYWOOD-01 and -02, or to restore one.
- **Proposed fix.** On phones the … menu opens downward inside the sheet (or as its own sheet) so Export, Import and Reset are reachable. (Phase 3: IMP-DOLLYWOOD-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-progress-menu-clipped-phone-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-progress-menu-clipped-phone-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-04 — On phones the pressed 3D button never returns to 2D, and nothing on screen names the way back

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:259`; `apps/dollywood.html:333`, `apps/dollywood.html:1156`, `apps/dollywood.html:856`, `apps/dollywood.html:821`; `audits/evidence/p3/dollywood/phone-3d-after-second-tap.png`, `audits/evidence/p3/dollywood/verify-phone-3d-no-exit-2-phone.png`
- **What happens now.** Below 700 px the 2D button is hidden (`apps/dollywood.html:333`, inside the block at `:313`), and the 3D button's handler always calls `setMode('3d')` (`apps/dollywood.html:1156`). The T key toggles (`apps/dollywood.html:856`), but a phone has no keyboard.
- **Why it matters.** On a phone the 3D view is mostly sky (VIS-DOLLYWOOD-16). The person who opened it has to guess a way out, and the only control worded like one ("Reset view") just resets the camera.
- **Proposed fix.** The 3D button toggles back to 2D (aria-pressed), and a "Map" control shows while in 3D. (Phase 3: IMP-DOLLYWOOD-P1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-phone-3d-no-exit-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-phone-3d-no-exit-2.mjs"`, `node "audits/tools/phase3/dollywood/repro-new.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-05 — On phones with Upright on, every map jump frames the unrotated box: Fit cuts off half the park and a section chip can miss its section

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:287`; `apps/dollywood.html:1088`, `apps/dollywood.html:1143-1146`, `apps/dollywood.html:809`; `audits/evidence/p3/dollywood/phone-upright-fit.png`, `audits/evidence/p3/dollywood/verify-upright-fit-phone-2-iphone-pwa-chip.png`
- **What happens now.** `fitTarget` sends every phone fit to `fitBoxPhone` (`apps/dollywood.html:1088`), which builds the view from the unrotated box (`apps/dollywood.html:1143-1146`). `fitBox`, used on wider screens, first rotates the box corners by `ROT` (`apps/dollywood.html:809`). With `ROT` −98.71°, the phone's Fit produces exactly the north-up view.
- **Why it matters.** Turning Upright on on a phone shows parking lots and hills, and every jump (a section, a search result, a step) lands somewhere else.
- **Proposed fix.** The phone fit rotates the target box as fitBox does when Upright is on. (Phase 3: IMP-DOLLYWOOD-P7)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-upright-fit-phone-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-upright-fit-phone-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-06 — The "up to N″" rider-height filter hides every listing with no height requirement

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:320`; `apps/dollywood-live.html:1007`, `apps/dollywood.html:1007`, `apps/dollywood.html:1671`; `audits/screens/dollywood/listings-height-typical-ipad-portrait-light.png`, `audits/evidence/p3/dollywood/verify-height-filter-drops-no-requirement-2-upto36.png`
- **What happens now.** `listItems` keeps `hf === 'none' ? !o.height_in : (o.height_in && o.height_in <= +hf)` (`apps/dollywood.html:1007`). So "up to 36″" shows 9 of 145, "up to 42″" 18 and "up to 48″" 23, although 120 listings have no requirement at all. The same file's park-map rule `fits()` treats no requirement as rideable (`apps/dollywood.html:1671`).
- **Why it matters.** A parent planning for a small child sees 9 rides, and none of the 43 attractions with no requirement, such as the Village Carousel, the Amazing Flying Elephants and Lil' Pilots Playground.
- **Proposed fix.** "Up to N″" keeps listings with no height requirement (!o.height_in || o.height_in <= N), shared template code for both exports (template :1004). (Phase 3: IMP-DOLLYWOOD-LIVE-P11, IMP-DOLLYWOOD-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-height-filter-drops-no-requirement-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-height-filter-drops-no-requirement-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-07 — The step card's in-game line ignores the saved plot width after load and after every plot change

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:347`; `apps/dollywood.html:1057`, `apps/dollywood.html:1109`, `apps/dollywood.html:1110`, `apps/dollywood.html:1049-1052`; `audits/screens/dollywood/steps-full-overflow-iphone-pwa-light.png`, `audits/screens/dollywood/scale-overflow-iphone-pwa-light.png`
- **What happens now.** `adopt()` renders the step (`apps/dollywood.html:1109`) before it applies `plot` (`apps/dollywood.html:1110`), and `updScale()` sets the factor but never re-renders (`apps/dollywood.html:1049-1052`).
- **Why it matters.** Eli builds to the numbers on the card. Unscaled or stale game metres mean pieces built at the wrong size.
- **Proposed fix.** Re-render the step card when the plot width changes (after load, an edit and a synced change).
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-plot-card-stale-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-plot-card-stale-2.mjs"`, `node "audits/tools/phase3/dollywood/data-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-16 — The keyboard shortcuts ignore Ctrl, Cmd and Alt: Ctrl/Cmd+D (bookmark) ticks or silently unticks the current step, and Ctrl/Cmd+P and page zoom are taken over

- **Area** dollywood · **Type** bug · **Severity** medium · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:544`; `apps/dollywood.html:852`, `apps/dollywood-live.html:852`, `apps/dollywood.html:853-857`, `apps/dollywood.html:1086`; `audits/evidence/p3/dollywood/critic-ctrl-d-desktop.png`, `audits/evidence/p3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-1-webkit.png`
- **What happens now.** The document keydown handler returns early only for inputs and for keys the 3D view handles (`apps/dollywood.html:852`). It then maps bare `e.key` values (`+` / `=`, `-`, `0`, the arrows, `v`, `s`, `m`, `t`, `n`, `p`, `d`, Escape) to actions, and calls `preventDefault()` for each (`apps/dollywood.html:853-857`).
- **Why it matters.** Eli builds at the PC beside the game. Pressing Ctrl+D to bookmark the guide, or Ctrl+P to print a step, marks a step done that he has not built and tells the family feed he built it, or quietly unticks one he has built.
- **Proposed fix.** The keyboard shortcuts ignore events with Ctrl, Cmd or Alt held (template :849), so browser shortcuts never tick or untick a step.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/critic-keys-plot.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-2.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### UX-DOLLYWOOD-2 — On iPad and desktop, the card's Next and Show on map move a map the person cannot see

- **Area** dollywood · **Type** usability · **Severity** medium · **Effort** S · **Batch** 9
- **Verified (step 3).** was medium; skeptics medium (partly) and medium (partly). Correction: The claim is wrong for iPad portrait. At the natural scroll that brings the card's buttons into view, 694 of the 738 px map is on screen together with the card, and the target Next frames is visible. The '261 px' figure is an artefact of centring the card.
- **Evidence.** `audits/03-apps/dollywood.md:669`; `apps/dollywood.html:1140`; `audits/screens/dollywood/step-on-map-typical-ipad-portrait-light.png`
- **What happens now.** `mapIntoView` returns early unless on a phone (`apps/dollywood.html:1140`).
- **Why it matters.** The map moves out of sight.
- **Proposed fix.** On iPad and desktop, Next and Show on map scroll the map into view (mapIntoView for every size).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-4 — Below 1180 px, search results appear about 2,000 px from the search box, and a no-match search says only "0 of 145"

- **Area** dollywood · **Type** usability · **Severity** medium · **Effort** S · **Batch** 9
- **Verified (step 3).** was medium; skeptics medium and medium (partly). Correction: The limit is 'at or below 1180 px', not 'below 1180 px'. iPad landscape (exactly 1180 wide) is affected too, with a 2,264 px gap. The visual-check line saying there is no clear button is wrong: the search field is type=search and shows a native clear glyph in every capture.
- **Evidence.** `audits/03-apps/dollywood.md:676`; `audits/evidence/p3/dollywood/ipad-search-no-match.png`, `audits/screens/dollywood/search-none-typical-ipad-portrait-light.png`
- **What happens now.** Searching "zipline" on iPad portrait put the results list top at y=2506 (search box bottom 428, viewport 1132), with no empty-state message. A single match does fly to it and open its card ("thunder").
- **Why it matters.** Results appear 2,000 px away.
- **Proposed fix.** Show search results directly under the search box (a popover list) with a "No match for zipline" empty state. (Phase 3: IMP-DOLLYWOOD-F4)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-1 — Completed steps are struck through at 2.2:1 (light) and 3.5:1 (dark)

- **Area** dollywood · **Type** visual · **Severity** medium · **Effort** S · **Batch** 9
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: 'Barely legible' overstates it. At 2.2:1 in bold the rows are faint but readable in both the iPad capture and my own. The Midnight figure depends on which background is used (3.62 against the card, about 3.75 against the page).
- **Evidence.** `audits/03-apps/dollywood.md:714`; `apps/dollywood.html:100-101`; `audits/evidence/p3/dollywood/ipad-card-hearth.png`, `audits/evidence/p3/dollywood/ipad-card-midnight.png`
- **What happens now.** `.bitem.ok` combines the dim colour, opacity .55 and a line-through (`apps/dollywood.html:100-101`). Rendered contrast of the 13 px text: Hearth 2.23, Parchment 2.31, Frost 2.26, Midnight 3.62, Forest 3.49 (AA needs 4.5). The checker confirmed the rows are barely legible.
- **Why it matters.** Done steps fail contrast at 2.2:1.
- **Proposed fix.** Completed steps: a check glyph and --text-2 at full opacity, no strike-through (CONS-COLOR-1 rule: never dim text with opacity). (Phase 3: IMP-DOLLYWOOD-P6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-2 — 35 tap targets under 44 px on the phone, 15 on the iPad

- **Area** dollywood · **Type** visual · **Severity** medium · **Effort** M · **Batch** 9
- **Verified (step 3).** was medium; skeptics medium and medium (partly). Correction: Minor details only. The phone list in the report adds up to 34 items; the 35th is the Basemap select (42x42), which is counted but not named. The card link buttons measure 35 px tall, not about 33.
- **Evidence.** `audits/03-apps/dollywood.md:717`; `apps/dollywood.html:1148`, `apps/dollywood.html:300`
- **What happens now.** Phone: the 13 section chips (36 px tall), six tool and zoom buttons (32 px wide), nine coaster-legend items (17 px tall, tappable, `apps/dollywood.html:1148`), "?" (32×32), the sheet handle (22 px tall), Next unfinished (40 px), … (44×40), Compare (36 px), the exaggeration slider (20 px).
- **Why it matters.** 35 targets under 44 px on the phone.
- **Proposed fix.** Every control to var(--tap): chips, tool and zoom buttons, legend items, "?", handle, Next unfinished, …, Compare. (Phase 3: IMP-DOLLYWOOD-P9)
- **How it will be verified.** recapture its screens (capture area dollywood) and compare; plus batch 9's checks.

#### CONS-TYPE-6 — The park map's pane headings fall back to the generic serif (Times on Apple devices), and the Dollywood badges and marker numbers to generic sans, because the template names faces it never loads

- **Area** design system (park map) · **Type** visual (consistency) · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:1501`; `apps/dollywood.html:223`, `apps/dollywood-live.html:223`, `apps/dollywood.html:281`, `apps/dollywood-live.html:544`; `audits/screens/dollywood-live/search-typical-iphone-pwa-light.png`
- **What happens now.** The pane headings. The hub flavour remaps `.tabbody h2` to `--font-display` (`apps/dollywood.html:223`). The live flavour remaps only `.pop h2` (`apps/dollywood-live.html:223`).
- **Why it matters.** One export shows Times headings next to SF Pro Rounded, and the two exports of one template disagree.
- **Proposed fix.** The template names real stacks (--font-serif / --font-text) instead of generic families.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### GAP-DOLLYWOOD-1 — The 3D view never shows the current step

- **Area** dollywood · **Type** feature gap · **Severity** low · **Effort** L · **Batch** 9
- **Verified (step 3).** was medium; skeptics low and low. Correction: The code claim is correct. The report misses that Previous, Next, Mark done and Show on map all force the view back to 2D (apps/dollywood.html:1085-1087). The 2D map is therefore the app's designated view for a step, and the 3D view is not simply a place where the step is missing.
- **Evidence.** `audits/03-apps/dollywood.md:772`; `apps/dollywood.html:1157`, `apps/dollywood.html:1153`; `audits/screens/dollywood/view-3d-typical-ipad-portrait-light.png`
- **What happens now.** LEGO Builder's core is a step you can zoom and spin. Here the 3D code never reads the current section or step: no `curSec`, `curIdx`, `stepTarget` or `highlight` between `apps/dollywood.html:1157` and `:1290` (NOT FOUND IN CODE), and entering 3D hides the 2D map that carries the step highlight …
- **Why it matters.** The one 3D view never shows what to build.
- **Proposed fix.** The 3D view highlights and frames the current step (read curSec/curIdx), like LEGO Builder's step view. (Phase 3: IMP-DOLLYWOOD-I2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### P3-DOLLYWOOD-08 — Sitting idle in 2D, the step highlight's infinite pulse keeps the main thread busy (15.8-27.7% in Chromium)

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:381`; `apps/dollywood.html:282-283`, `apps/design.css:611-613`
- **What happens now.** The current step's target carries `#hl .hl-ring { animation: hlring 2.2s ease-in-out infinite }`, which animates `stroke-opacity` (`apps/dollywood.html:282-283`; the class is set at `:907-913`), on a 2,783-node SVG map. `stroke-opacity` is not a compositor-only property, so the map is repainted every frame.
- **Why it matters.** An iPad or PC left open on the guide keeps repainting the whole map sixty times a second: battery drain and heat for nothing.
- **Proposed fix.** The step highlight pulses three times (--ambient-iterations) on transform/opacity, then rests. (Phase 3: IMP-DOLLYWOOD-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-idle-pulse-cpu-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-idle-pulse-cpu-2.mjs"`, `node "audits/tools/phase3/dollywood/perf-idle.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-09 — After 3D has been opened once, the render loop keeps requesting 60 frames a second in 2D until the guide is closed

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:401`; `apps/dollywood.html:1269`, `apps/dollywood.html:1152-1156`, `index.html:729-733`, `index.html:732`
- **What happens now.** The 3D render loop reschedules `requestAnimationFrame` on every frame and renders only in 3D: `(function loop(){ if (mode==='3d') {…render…} requestAnimationFrame(loop) })()` (`apps/dollywood.html:1269`). Nothing cancels it; `setMode('2d')` does not stop it (`apps/dollywood.html:1152-1156`).
- **Why it matters.** A small, needless wake-up of the page sixty times a second while the guide sits open in 2D.
- **Proposed fix.** Stop the 3D render loop (cancelAnimationFrame) when leaving 3D.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-raf-loop-after-3d-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-raf-loop-after-3d-2.mjs"`, `node "audits/tools/phase3/dollywood/perf-3d.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-10 — A dead "N" compass button sits over the iPad and desktop map, and over 3D

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:421`; `apps/dollywood.html:352`, `apps/dollywood.html:565`, `apps/dollywood.html:1597`, `apps/dollywood.html:1740`; `audits/evidence/p3/dollywood/verify-dead-north-button-1-ipad-3d.png`, `audits/screens/dollywood/view-3d-typical-ipad-portrait-light.png`
- **What happens now.** `.lv-northwrap` is hidden only below 700 px (`apps/dollywood.html:352`, inside the block at `:313`). The rule that hides the park map's other chrome outside the live flavour (`apps/dollywood.html:565`) leaves it out.
- **Why it matters.** A compass that does nothing over the map and over 3D teaches that the controls cannot be trusted.
- **Proposed fix.** Hide the dead N button outside the park map (or wire it to Upright).
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-dead-north-button-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-dead-north-button-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-11 — Turning Upright on or off with "Whole park" pressed zooms to the last-selected section

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:441`; `apps/dollywood.html:1029`, `apps/dollywood-live.html:1029`, `apps/dollywood.html:1121`, `apps/dollywood-live.html:1121`; `audits/evidence/p3/dollywood/ipad-upright-whole-park.png`, `audits/evidence/p3/dollywood/verify-upright-whole-park-zooms-entrance-1-A-first-open-upright-on.png`
- **What happens now.** `curSec` starts as `'entrance'` (`apps/dollywood.html:1062`) and `selectSection('all')` never sets it (`apps/dollywood.html:1121`). The Upright handler fits `SEC[curSec]` unless `curSec === 'all'` (`apps/dollywood.html:1029`), so that guard never fires from the Whole park chip.
- **Why it matters.** Upright is the way to see the park the way the game shows it; turning it on zooms somewhere unexpected.
- **Proposed fix.** With Whole park pressed, Upright fits the whole park (template :1029, shared).
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-upright-whole-park-zooms-entrance-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-upright-whole-park-zooms-entrance-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-12 — On phones the "?" popover opens off the left edge (48 of 267 px visible)

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:462`; `apps/dollywood.html:358`, `apps/dollywood.html:174-176`; `audits/evidence/p3/dollywood/phone-help-popover.png`, `audits/evidence/p3/dollywood/verify-help-popover-offscreen-phone-2-iphone-pwa-chromium.png`
- **What happens now.** Below 700 px the hint text fills the first line, so the "?" wraps to the start of the next line at x=16. The phone rule `right: 0` (`apps/dollywood.html:358`) then makes the 267 px, no-wrap popover grow leftwards from x=48, so it starts at x=−219 (`apps/dollywood.html:174-176, 640-641`).
- **Why it matters.** A visible control opens a panel that cannot be read.
- **Proposed fix.** Clamp the "?" popover inside the viewport on phones.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-help-popover-offscreen-phone-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-help-popover-offscreen-phone-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-13 — On iPad portrait the View ▾ menu runs 26 px past the right edge

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:482`; `apps/dollywood.html:164`, `apps/dollywood.html:1034`, `apps/dollywood.html:343`; `audits/evidence/p3/dollywood/ipad-view-menu.png`, `audits/evidence/p3/dollywood/verify-view-menu-offscreen-ipad-2-webkit.png`
- **What happens now.** `.vmenu` is `left: 0` with `min-width: 250px` (`apps/dollywood.html:164`), anchored to a View button whose left edge is at x=596, so its right edge lands at 846 in an 820 px viewport. The menu holds the contour-interval select and the Steepness switch (the theme row is removed, `apps/dollywood.html:1034`).
- **Why it matters.** The contour select and the steepness checkbox are cut at the edge, and the page gains a sideways scroll while the menu is open.
- **Proposed fix.** Anchor the View ▾ menu to the right edge (or clamp it) on iPad portrait.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-view-menu-offscreen-ipad-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-view-menu-offscreen-ipad-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-14 — After 3D, touch devices get the mouse hint "Move over the map… scroll to zoom"

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:502`; `apps/dollywood.html:1154`, `apps/dollywood.html:607`, `apps/dollywood.html:824`; `audits/evidence/p3/dollywood/verify-readout-mouse-copy-touch-1-iphone-pwa.png`
- **What happens now.** `setMode` writes the mouse text for 2D with no coarse-pointer check (`apps/dollywood.html:1154`). At boot (`apps/dollywood.html:607`) and in `setTool` (`apps/dollywood.html:824`) the app picks the touch text, "Tap anything for details · pinch to zoom", on coarse pointers.
- **Why it matters.** The one line of help on the map tells an iPad user to hover and scroll.
- **Proposed fix.** Keep the touch hint after leaving 3D on coarse pointers.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-readout-mouse-copy-touch-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-readout-mouse-copy-touch-2.mjs"`, `node "audits/tools/phase3/dollywood/layout-checks.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-15 — The Scale tab refers to an "Info tab" that does not exist (also found by the visual check)

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:522`; `apps/dollywood.html:672`, `apps/dollywood.html:660`, `apps/dollywood.html:958`, `apps/dollywood.html:973-974`; `audits/screens/dollywood/scale-empty-ipad-portrait-light.png`, `audits/evidence/p3/dollywood/verify-scale-copy-info-tab-2-scale-tab.png`
- **What happens now.** The Scale tab says every dimension "shown in the Info tab will also be shown in game metres" (`apps/dollywood.html:672`). The tabs are Listings, Layers and Scale (`apps/dollywood.html:660`; `showTab` toggles only those three, `apps/dollywood.html:958`).
- **Why it matters.** A reader looks for a tab that is not there and cannot tell where the converted numbers show.
- **Proposed fix.** The Scale copy says where the numbers appear ("on the step card and the listing cards").
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/verify-scale-copy-info-tab-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-scale-copy-info-tab-2.mjs"`, `node "audits/tools/phase3/dollywood/verify-vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1-1.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-17 — The arrow keys never scroll the page: they pan a map that is scrolled away, even while the person reads the step card

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:583`; `apps/dollywood.html:854`, `apps/dollywood.html:857`, `apps/dollywood.html:852`, `apps/dollywood.html:641`; `audits/evidence/p3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-1-webkit-after-arrowdown.png`, `audits/evidence/p3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-1-chromium-after-arrowdown.png`
- **What happens now.** The global handler binds ArrowLeft, ArrowRight, ArrowUp and ArrowDown to panning the map (`apps/dollywood.html:854`) and calls `preventDefault()` (`apps/dollywood.html:857`) wherever focus is, except in an input, select or textarea (`apps/dollywood.html:852`).
- **Why it matters.** On the PC Eli reads the step card below the map. The standard keyboard way down the page does nothing he can see, and it pans a map he cannot see, which he finds moved when he scrolls back up.
- **Proposed fix.** Arrow keys pan the map only when it has focus or is mostly on screen.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/critic-arrows.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-2.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P3-DOLLYWOOD-18 — Clearing the plot width does not reach another open device, and a legacy `dw-plot` key brings an old width back on every boot

- **Area** dollywood · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:615`; `apps/dollywood.html:1055`, `apps/dollywood.html:1110`, `apps/dollywood.html:1057`, `apps/hub.js:392`; `audits/evidence/p3/dollywood/verify-critic-critic-plot-clear-not-synced-2-2-phone-after-pull.png`, `audits/evidence/p3/dollywood/verify-critic-critic-plot-clear-not-synced-2-2-legacy-after-reload.png`
- **What happens now.** Clearing `#sc-plot` runs `savePlot`, which writes `hub.set('plot', v || null)` (`apps/dollywood.html:1055`), so the server row becomes null. `adopt()` applies a remote plot only when `v != null` (`apps/dollywood.html:1110`).
- **Why it matters.** The step card and the listing cards convert every measurement by this factor. When two devices disagree about the plot width, Eli builds to different in-game sizes depending on which device he reads.
- **Proposed fix.** adopt() applies a null plot width like any value; once signed in, the legacy dw-plot key is removed after migration.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood/critic-keys-plot.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-plot-clear-not-synced-2-1.mjs"`, `node "audits/tools/phase3/dollywood/verify-critic-critic-plot-clear-not-synced-2-2.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P4-TELL-05 — The build guide first paints an empty section-chip strip, then its map drops 44-48 px when the chips arrive (CLS 0.119-0.128 on a cold open through the hub)

- **Area** design system (build guide) · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:6223`; `apps/dollywood.html:578`, `apps/dollywood.html:684`, `apps/dollywood.html:2`, `index.html:327-329`
- **What happens now.** The section-chip row is an empty `<div id="chips">` in the exported HTML (`apps/dollywood.html:578` = template `:578`). The main inline script fills it (template `:1120`), and that script runs after the multi-megabyte payload (template `:682`) and the parser-blocking external `hub.js` (`apps/dollywood.html:684`).
- **Why it matters.** The map, which is the point of the page, jumps as the guide opens. That is a tell the house style bans.
- **Proposed fix.** Reserve the chip strip's height (--min-h-chips) before the chips arrive. (Phase 4 gap row TELL-8)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TELL/verify-build-guide-cls-in-viewer-2.mjs"`, `node "audits/tools/phase4/TELL/loading.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### P4-TYPE-01 — Build guide map labels render below 11 px at the default whole-park view: section names 6.1 px on the iPhone (5.5 px in Safari), listing numbers 6.8 px on every device, contour heights 9.5 px at every zoom

- **Area** design system (build guide) · **Type** bug · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:1330`; `apps/dollywood-live.html:526`, `apps/dollywood.html:802-805`, `apps/dollywood.html:281`, `apps/dollywood.html:111`; `audits/evidence/p4/TYPE/verify-build-guide-svg-labels-under-11-1-iphone-pwa.png`, `audits/screens/dollywood/map-typical-iphone-pwa-light.png`
- **What happens now.** The cause is the template's `apply()`, which runs after every pan and zoom (`../dollywood-build-project/scripts/template.html:799-802`, exported to `apps/dollywood.html:802-805`). `k` is metres per CSS px (`mpp()`, `template.html:788`), so the map's own drawing scale is 1/k.
- **Why it matters.** On a phone the section names and listing numbers are how the map is read, and at 5.5-6.8 px they cannot be read.
- **Proposed fix.** Map labels in screen px with an 11 px floor (--fs-caption2), independent of the map scale. (Phase 4 gap row TYPE-11)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TYPE/verify-build-guide-svg-labels-under-11-1.mjs"`, `node "audits/tools/phase4/TYPE/hidden-text.mjs"` — the defect must no longer reproduce; plus batch 9's checks.

#### UX-DOLLYWOOD-1 — Ticking the step just built takes 3-4 taps plus a scroll, and Home has no build-guide card

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** M · **Batch** 9
- **Verified (step 3).** was medium; skeptics low (partly) and low. Correction: The report frames it as the cost of every tick ('Ticking the step just built takes 3-4 taps plus a scroll'). In fact it is the cold-start cost per session: within a session each tick is 1 tap, and the card stays in view and advances by itself.
- **Evidence.** `audits/03-apps/dollywood.md:665`; `index.html:458-459`; `audits/screens/dollywood/map-typical-ipad-portrait-light.png`, `audits/screens/dollywood/map-typical-desktop-light.png`
- **What happens now.** J1 is 4 taps on the iPhone (the sheet must be raised first) and 3 taps plus a scroll on the iPad and desktop. On iPad portrait the card title sits at y=1400 in a 1132 px viewport; on desktop the card starts at y=1441 in 852.
- **Why it matters.** Ticking the step just built takes 3-4 taps and a scroll.
- **Proposed fix.** A sticky "Mark done" on the step card, the card scrolled into view on open, and a build-guide Home card ("Next: Blueprint the section · 7 of 9"). (Phase 3: IMP-DOLLYWOOD-F3, IMP-DOLLYWOOD-F6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-3 — A phone's first screen is header, chips and parking lots; the park sits under the peeking sheet

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** M · **Batch** 9
- **Verified (step 3).** was medium; skeptics low and low.
- **Evidence.** `audits/03-apps/dollywood.md:673`; `audits/evidence/p3/dollywood/phone-first-screen.png`, `audits/screens/dollywood/map-typical-iphone-pwa-light.png`
- **What happens now.** The map starts at y=470 and the sheet at 766 (viewport 884). 56 of 68 markers are under the sheet and 11 are in view. The chips wrap to 2 rows, and only 2 of 13 are fully visible.
- **Why it matters.** The first screen is header and parking lots.
- **Proposed fix.** On phones, open on the map with the sheet peeking below the park, and one row of scrollable chips.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-7 — On phones, Next unfinished from the peeking sheet leaves the new step hidden

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:687`; `audits/screens/dollywood/next-unfinished-overflow-iphone-pwa-light.png`
- **What happens now.** The sheet stays at peek; the new title "Blueprint the section" sits at y=928, below the 884 px viewport. Only the header changes.
- **Why it matters.** The new step is hidden.
- **Proposed fix.** Next unfinished raises the sheet so the new step shows.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-8 — After a cut, the profile is about 1,000 px below and the map still says "Tap two points"

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:690`; `apps/dollywood.html:824`; `audits/evidence/p3/dollywood/ipad-cross-section-cut.png`
- **What happens now.** On iPad portrait the profile top was at y=2101 (viewport 1132). The map pill still read "Tap two points", and the readout repeated the instruction (`apps/dollywood.html:824, 826`).
- **Why it matters.** The result is 1,000 px away and the hint is stale.
- **Proposed fix.** After a cut, scroll to the profile and change the pill to "Profile ready". (Phase 3: IMP-DOLLYWOOD-F2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-9 — Map cards run off-screen

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:693`; `apps/dollywood.html:961-963`; `audits/evidence/p3/dollywood/ipad-listing-card-low-marker.png`, `audits/screens/dollywood/coaster-typical-desktop-light.png`
- **What happens now.** `openPop` keeps the card inside the map box, not the viewport (`apps/dollywood.html:961-963`). On iPad portrait a listing card opened on a low marker ended at y=1176 in a 1132 px viewport. On desktop the coaster card is 926 px tall in an 852 px viewport (bottom 1331).
- **Why it matters.** Cards run off screen.
- **Proposed fix.** openPop keeps cards inside the viewport, not only the map box; tall cards become a sheet.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-11 — Every tick posts a family-feed line; an untick leaves it, and a re-tick doubles it

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:699`; `apps/dollywood.html:1086`
- **What happens now.** Five Mark done taps on the last Entrance steps (tick, tick, untick, tick, untick) posted 3 lines to the family feed that Home and the TV read, including "Ticked Blueprint the section" twice, although that step ended unticked (`apps/dollywood.html:1086`).
- **Why it matters.** The feed fills with ticks and unticks.
- **Proposed fix.** Post one feed line per session summary ("Built 3 steps in the Entrance") instead of one per tick; an untick within a minute cancels its line.
- **How it will be verified.** recapture its screens (capture area dollywood) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-12 — The plot width accepts implausible values without comment

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:702`; `apps/dollywood.html:673`; `audits/screens/dollywood/scale-overflow-iphone-pwa-light.png`
- **What happens now.** 12,500 m reads "1363% of real size (13.631×)". The input has only `min=50`, which typing does not enforce (`apps/dollywood.html:673, 1049-1052`).
- **Why it matters.** Implausible values are accepted.
- **Proposed fix.** Validate the plot width (50-2,000 m) with an inline message.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-13 — The "Unlisted structure" card offers web search with an empty query

- **Area** dollywood · **Type** usability · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:705`; `apps/dollywood.html:987`; `audits/screens/dollywood/building-typical-iphone-pwa-light.png`
- **What happens now.** `srch(t.name || '')` (`apps/dollywood.html:987`) leaves the search box empty next to Web / Photos / Videos / dollywood.com buttons.
- **Why it matters.** Web search opens empty.
- **Proposed fix.** Fill the search query with the structure's kind and section.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-4 — Profile axis labels render at 5.7 px on the phone

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:726`; `apps/dollywood.html:936`; `audits/screens/dollywood/cross-section-typical-iphone-pwa-light.png`
- **What happens now.** `font-size` 12 inside a 1000-wide viewBox (`apps/dollywood.html:936`), drawn 372 px wide. The checker saw illegible smudges.
- **Why it matters.** 5.7 px labels on the phone.
- **Proposed fix.** Profile axis labels in screen px (vector-effect or HTML labels) at --fs-caption2 minimum.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-6 — The glass look sits on content (header, side panel), and cards read through to the map

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:732`; `apps/dollywood.html:234`; `audits/screens/dollywood/listing-typical-ipad-landscape-dark.png`, `audits/screens/dollywood/coaster-typical-desktop-light.png`
- **What happens now.** The header, toolbar and side panel carry the specular glass gradient (`apps/dollywood.html:234, 245, 249`) with no backdrop blur. On the iPad only the readout and the dead N button have blur; on the phone the sticky toolbar and the sheet do.
- **Why it matters.** Glass on content.
- **Proposed fix.** Header and side panel become solid material (--material-solid-bg); glass stays on the toolbar and sheet only.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-8 — Default form controls, `confirm()` / `alert()` and text-glyph buttons

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** M · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:739`; `apps/dollywood.html:1098`, `apps/dollywood.html:1101`; `audits/screens/dollywood/layers-typical-ipad-portrait-light.png`, `audits/screens/dollywood/scale-typical-ipad-portrait-dark.png`
- **What happens now.** Native selects (`#bmap`, `#cint`, `#hf`), checkboxes, range and number inputs with spinners, and a search field with the browser's clear glyph. `confirm()` at `apps/dollywood.html:1098` and `alert()` at `apps/dollywood.html:1101`. Buttons drawn as glyphs: …, ?, ×, ↗, ▾; the iPad and desktop toolbar is all text.
- **Why it matters.** Default controls and native dialogs.
- **Proposed fix.** Styled selects (the --select-chevron mask), the shared switch, the shared confirm sheet and toast, and Lucide icons instead of text glyphs.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-9 — Flat green bands where a basemap does not fill the frame

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:742`; `apps/dollywood.html:284`; `audits/screens/dollywood/aerial-typical-iphone-pwa-dark.png`, `audits/screens/dollywood/upright-typical-desktop-light.png`
- **What happens now.** The phone map box is taller than the map's aspect ratio, so its `#4F6A48` background (`apps/dollywood.html:284, 348`) shows as a band under the aerial, illustrated and steepness basemaps, and as wedges with Upright on. From the visual check: on the phone, Upright also shows a diagonal raster edge over the band.
- **Why it matters.** Flat green bands.
- **Proposed fix.** Size the map box to the basemap's aspect ratio on phones, or fill with the basemap's edge colour.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-10 — The header wraps badly on iPad landscape

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:745`; `audits/evidence/p3/dollywood/ipad-landscape-header.png`, `audits/screens/dollywood/map-loading-ipad-landscape-light.png`
- **What happens now.** The hero art ends at x=171 and the title starts at x=690, a 519 px gap; the stats wrap below; the header is 213 px tall.
- **Why it matters.** A 519 px gap and a wrapped header.
- **Proposed fix.** On iPad landscape the header puts art, title and stats in one row.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-11 — The 3D gesture hint is truncated on phones and lists keyboard keys

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:748`; `audits/screens/dollywood/view-3d-typical-iphone-pwa-light.png`
- **What happens now.** The readout has a scroll width of 570 in 274 px on a coarse pointer, and it mentions "arrows or WASD" and "Q/E".
- **Why it matters.** A truncated hint that lists WASD.
- **Proposed fix.** Touch devices get a short gesture hint without keyboard keys.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-13 — Layer legend swatches vanish on the light panel

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:754`; `apps/dollywood.html:664`; `audits/screens/dollywood/layers-typical-ipad-portrait-light.png`, `audits/screens/dollywood/about-typical-ipad-portrait-light.png`
- **What happens now.** In Layers, the Section names swatch is an inline `#FFF8E6` (`apps/dollywood.html:664`) on a cream panel, about 1:1. Official listings looks the same, and the Contours, Dollywood Express and Guest paths swatches are pale yellow. Below the 3:1 floor for non-text.
- **Why it matters.** Swatches vanish.
- **Proposed fix.** Legend swatches get a --field-border ring so pale swatches show on the light panel.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-14 — The measure label is thin, small and unhaloed over the map

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:757`; `audits/screens/dollywood/measure-typical-ipad-landscape-light.png`
- **What happens now.** "555 m · 242 m in game" is small regular text straight on the terrain, with no pill or halo; the section labels get heavy haloed caps.
- **Why it matters.** Thin, small, unhaloed text on the map.
- **Proposed fix.** The measure label becomes a haloed pill like section labels.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-15 — Listing labels collide with markers and each other at section zoom

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:760`; `audits/screens/dollywood/section-typical-ipad-landscape-light.png`
- **What happens now.** In the Showstreet view, "Ride Accessibility Center" is drawn over marker 8, "TimeSaver & Special Experiences Reservation Center" runs across two buildings, and "126 Dreamsong Theater" overlaps its neighbour.
- **Why it matters.** Labels collide at section zoom.
- **Proposed fix.** Listing labels use the same collision pass as section labels.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-16 — The phone 3D view is mostly sky

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:763`; `audits/screens/dollywood/view-3d-typical-iphone-pwa-light.png`, `audits/evidence/p3/dollywood/phone-3d-after-second-tap.png`
- **What happens now.** The camera frames the park in the lower third; about 40% is empty sky, and the nearest terrain disappears under the sheet. It is also the screen P3-DOLLYWOOD-04 leaves the person on.
- **Why it matters.** Mostly sky.
- **Proposed fix.** Frame the phone 3D camera on the terrain above the sheet.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-DOLLYWOOD-17 — The desktop toolbar wraps Search onto a near-empty second row

- **Area** dollywood · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:766`; `audits/screens/dollywood/map-typical-desktop-light.png`, `audits/screens/dollywood/search-none-typical-desktop-dark.png`
- **What happens now.** At 1440 px the first row ends with about 100 px of space after Terrain, and Search sits alone on a second row with about 800 px of space. Its "SEARCH" label touches the field's focus ring when focused.
- **Why it matters.** Search alone on a second row.
- **Proposed fix.** Let the toolbar's search flex into the first row at 1440 px.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-SHAPE-3 — The build guide's Listings / Layers / Scale switcher is square underline tabs

- **Area** design system (build guide) · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:2335`; `apps/design.css:465-468`; `audits/evidence/p4/SHAPE/sheet-buttons.png`
- **What happens now.** The side-panel tabs are 262×52 buttons with `border-radius: 0` and a 2 px underline, a Material and web idiom, inside an R20 panel (`template.html:55-57, 250`). The shell uses a rounded `.seg` segmented control (`apps/design.css:465-468`), and F260 a glass pill switch, for the same job.
- **Why it matters.** A web tell, on the app that already scores lowest for layout.
- **Proposed fix.** The Listings/Layers/Scale switcher becomes the shared segmented control.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 9's checks.

#### VIS-TELL-1 — Light themes open the build guide on a near-black frame

- **Area** design system (build guide) · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:6384`; `apps.json:9-10`, `index.html:722`, `index.html:331`, `apps/dollywood.html:2`
- **What happens now.** With a light OS and the System theme, and `hub.js` immediate (scenario C), the build guide shows about 240 ms of dark frames (mean luminance 0.23-0.30) before it settles light (0.545).
- **Why it matters.** It is a flash in the other direction: a black frame in a light house.
- **Proposed fix.** The viewer's loading background follows the theme (--viewer-loading-bg), not a dark frame, for the build guide. (Phase 4 gap row TELL-7)
- **How it will be verified.** Rerun `node "audits/tools/phase4/TELL/flash.mjs"` — the defect must no longer reproduce; recapture its screens (capture area every area) and compare; plus batch 9's checks.

#### VIS-TYPE-2 — The Dollywood template tells labels from values by ink alone (dt and dd both 13/400; profile stats 12.5/700), and the difference shrinks to 1.62:1 in Midnight

- **Area** design system, all areas · **Type** visual · **Severity** low · **Effort** S · **Batch** 9
- **Evidence.** `audits/04-design-system.md:1526`; `audits/screens/dollywood/cross-section-typical-ipad-portrait-light.png`
- **What happens now.** Sibling texts with the same family, size, weight and transform differ only in ink: 14 pairs in the build guide and 1 in the park map (Table TYPE-8). The clearest is the key/value list: `dl.kv dt` and `dd` are both 13/400 ui-rounded, with ink `--dim` against `--text`.
- **Why it matters.** Low-vision readers, and anyone in bright park sunlight, lose a distinction carried only by grey levels. In dark palettes it nearly disappears.
- **Proposed fix.** Key/value pairs use --text-label / --text-value (weight and size, not ink alone).
- **How it will be verified.** Rerun `node "audits/tools/phase4/TYPE/colour-only.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 9's checks.

#### UX-DOLLYWOOD-14 — If the display profile loads the file by URL, it is offered Mark done, Reset and Import

- **Area** dollywood · **Type** usability · **Severity** info · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood.md:708`
- **What happens now.** A tap gives the toast "This screen only looks — sign in on a phone to change things." and writes 0 rows. The kiosk has no tile, and `#dollywood` gives a toast, so it cannot normally get here.
- **Why it matters.** The kiosk is offered actions it cannot take.
- **Proposed fix.** Hide Mark done, Reset and Import when !hub.canWrite (info).
- **How it will be verified.** recapture its screens (capture area dollywood) and compare; plus batch 9's checks.

#### P3-DOLLYWOOD-LIVE-14 — Search's "rider height: up to N" filter hides every listing with no height requirement (carousel, train, playgrounds) (from the completeness critic) (pointer to P3-DOLLYWOOD-06)

- **Area** dollywood-live · **Type** bug · **Severity** medium (pointer) · **Effort** S · **Batch** 9
- **Evidence.** `audits/03-apps/dollywood-live.md:480`; `apps/dollywood-live.html:1541`, `apps/dollywood.html:1007`, `apps/dollywood-live.html:1007`, `apps/dollywood-live.html:1012`; `audits/evidence/p3/dollywood-live/critic-search-height-36-iphone.png`, `audits/evidence/p3/dollywood-live/verify-critic-search-height-filter-hides-no-requirement-3-1-36-iphone.png`
- **Proposed fix.** Pointer to P3-DOLLYWOOD-06 (one template fix, both exports). (Phase 3: IMP-DOLLYWOOD-LIVE-P11)

#### Improvements with no finding (dollywood)

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). They are optional; Phase 6 carries them only if the household wants them.

| ID | Improvement | Kind | Delight | Effort | Source |
|---|---|---|---|---|---|
| IMP-DOLLYWOOD-I1 | A section-complete moment: a calm check and "Showstreet done — 21 steps" when a section fills (a completion cue for the builder, not a reward system) | idea | 3 | S | `audits/03-apps/dollywood.md:964` |

### Batch 10 — Dollywood park map (42)

#### GAP-DOLLYWOOD-LIVE-1 — No Find-My-style arrival or leave alerts

- **Area** dollywood-live · **Type** feature gap · **Severity** medium · **Effort** M · **Batch** 10
- **Verified (step 3).** was medium; skeptics low and medium; tie-break medium. Correction: The claims are accurate. Only the rating is too high: medium should be low, since checking the live map or Family pane is a reasonable workaround and the related defects are filed and rated on their own.
- **Evidence.** `audits/03-apps/dollywood-live.md:687`
- **What happens now.** No Find-My-style arrival or leave alerts (medium). Nothing tells a parent "Mae reached the meeting point" or "Ezra's phone left the park". The only proximity signal is the server's stale-kid push, which barely fires (P2-PWA-02), and the "Meet at <name>" push cannot be sent (P2-PWA-18).
- **Why it matters.** Find My's most useful family feature is missing on park days.
- **Proposed fix.** Arrival and leave alerts for adults: "Mae reached the meeting point", "Ezra's phone left the park" (a push kind on the park-day switch, per-person toggle). (Phase 3: IMP-DOLLYWOOD-LIVE-F3)
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.

#### P2-PWA-18 — "Rally the family" (the "Meet at <name>" push) cannot be triggered from any UI

- **Area** shell / platform · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/02-shell.md:4738`; `apps/dollywood-live.html:1589`, `apps/dollywood.html:1719`, `apps/dollywood-live.html:1440`, `worker/src/index.js:132-139`
- **What happens now.** `rally()` is defined at apps/dollywood-live.html:1589 and apps/dollywood.html:1719. It posts to `POST /api/dollywood/rally`, but nothing calls it. The other "rally" matches in each file are a comment (:1577 / :1707) and the confirm text (:1591 / :1721).
- **Why it matters.** CLAUDE.md ("Rally the family"; Push: "on demand 'Meet at <name>' when an adult rallies the family from the park map") documents the push as working. So does the map repo's README.md:182.
- **Proposed fix.** Add the "Rally the family here" action to the meeting-point bar and the ride card (adults only), calling the existing rally(). (Phase 3: IMP-DOLLYWOOD-LIVE-F1)
- **How it will be verified.** Rerun `node "audits/tools/phase2/PWA/verify3-rally-unreachable-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-03 — On a device's first open, the map says you are not sharing though Share my spot is on, and never locates you

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:206`; `apps/dollywood-live.html:1486`, `index.html:459`, `apps/hub.js:334`, `apps/hub.js:334-337`; `audits/evidence/p3/dollywood-live/geo-first-open-iphone.png`, `audits/evidence/p3/dollywood-live/verify-first-open-gps-not-resumed-1-A-first-open.png`
- **What happens now.** `hub.ready` resolves at once because another channel has already been pulled (`apps/hub.js:334-337`). `liveInit` then runs `if(shareOn())startGps()` (`apps/dollywood-live.html:1486`) before the person-scope `share` row arrives, so `shareOn()` is false.
- **Why it matters.** A parent who switched on sharing is told, on the phone they just opened at the park, that only they can see their dot, and the family cannot see them until they tap Find me.
- **Proposed fix.** After the person pull lands, re-check shareOn() and start GPS; the pill never says "not sharing" while Share is on. (Phase 3: IMP-DOLLYWOOD-LIVE-P3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-first-open-gps-not-resumed-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-first-open-gps-not-resumed-1.mjs"`, `node "audits/tools/phase3/dollywood-live/geo.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-04 — After you locate yourself, the meeting-point bar has no walk time and no Go, and does not heal on its own

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:231`; `apps/dollywood-live.html:1484`, `apps/dollywood-live.html:1245`, `apps/dollywood-live.html:1579`, `apps/dollywood-live.html:1256`; `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-1-A-after-place.png`, `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-1-B-after-45s-idle.png`
- **What happens now.** `setMe()` calls `drawMe`, `updLoc`, `renderNear`, `renderFam` and `publish`, but not `renderMeet` (`apps/dollywood-live.html:1245`). `renderMeet` is called only from `loadMeet`, `setMeet` and `clearMeet` (`apps/dollywood-live.html:1579, 1587, 1588`).
- **Why it matters.** The moment after "where am I?" is when a parent wants "how far to the meeting point, and Go". The bar gives neither, with no hint why.
- **Proposed fix.** Re-render the meeting bar on every fix and on placing yourself: walk time and Go at once. (Phase 3: IMP-DOLLYWOOD-LIVE-P6)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-meet-bar-stale-after-place-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-meet-bar-stale-after-place-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-05 — An adult cannot switch on a kid's beacon or set heights until someone else is already sharing

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:256`; `apps/dollywood-live.html:1254`, `apps/dollywood-live.html:1304`, `apps/dollywood-live.html:1307`, `apps/dollywood-live.html:1309`; `audits/screens/dollywood-live/family-kids-empty-ipad-portrait-light.png`, `audits/evidence/p3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-1-A-eli-family-ipad.png`
- **What happens now.** `renderFam()` returns right after the "No one else is sharing right now…" line when there are no other rows (`apps/dollywood-live.html:1304`), before the Kids' beacons block (`apps/dollywood-live.html:1307`) and before `renderKids()` (`apps/dollywood-live.html:1309`), which is its only call site.
- **Why it matters.** The natural time to set up a child's beacon and enter heights is before the family sets off, exactly when nobody is sharing yet. On an ordinary day the seeded heights (43" and 40") cannot be seen or corrected from the map.
- **Proposed fix.** Render the adult beacon and height controls whether or not anyone else is sharing.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-06 — With Share my spot left on, opening the map away from the park publishes a home position, and Home says "At the park"

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:280`; `apps/dollywood-live.html:1486`, `apps/dollywood-live.html:1475`, `apps/dollywood-live.html:1250`, `apps/dollywood-live.html:1170`; `audits/evidence/p3/dollywood-live/geo-far-mom-home-ipad.png`, `audits/evidence/p3/dollywood-live/verify-publish-off-site-1-mom-home-ipad.png`
- **What happens now.** `publish()` writes `loc:<id>` for any GPS fix under 150 m accuracy and never checks `onProperty()` (`apps/dollywood-live.html:1250`, `onProperty` at `apps/dollywood-live.html:1170`). Home's `atPark()` counts every `loc:` row under 4 h old, with no position test (`index.html:872-877`).
- **Why it matters.** For up to 4 hours every Home in the house, the Kitchen iPad included, says a person is "At Dollywood · last seen just now" while they are at home.
- **Proposed fix.** Publish a fix only when it is on the park property (the map's bounds plus a margin); Home's park card ignores off-property rows. (Phase 3: IMP-DOLLYWOOD-LIVE-P9)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-publish-off-site-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-publish-off-site-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-07 — An old fix outside the map frame reads as a live position, with no "Last seen" and no Find me chip

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:304`; `apps/dollywood-live.html:1250`, `apps/dollywood-live.html:1478`, `apps/dollywood-live.html:1270-1274`, `apps/dollywood-live.html:1264`; `audits/evidence/p3/dollywood-live/states-arriving.png`, `audits/evidence/p3/dollywood-live/states-far.png`
- **What happens now.** In `updLoc()`, the "arriving" and "far" branches (`apps/dollywood-live.html:1270-1274`) never consult the computed `stale` flag (`apps/dollywood-live.html:1264`); only the in-frame branch does (`apps/dollywood-live.html:1279`).
- **Why it matters.** Reopening the map the next morning, a parent sees "At Dollywood — the parking lots" with a precise "± 30 ft", as if they were arriving now.
- **Proposed fix.** Give an old fix outside the frame the same stale treatment as inside: "Last seen N ago" and a Find me chip. (Phase 3: IMP-DOLLYWOOD-LIVE-P7)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-out-of-frame-stale-reads-live-1.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-out-of-frame-stale-reads-live-2.mjs"`, `node "audits/tools/phase3/dollywood-live/states.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-08 — Tapping a restroom, first-aid, AED or other amenity marker does nothing

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:328`; `apps/dollywood-live.html:1571-1573`, `apps/dollywood-live.html:1566`, `apps/dollywood-live.html:844`, `apps/dollywood-live.html:1574`; `audits/evidence/p3/dollywood-live/verify-amenity-tap-dead-1-after-tap.png`, `audits/evidence/p3/dollywood-live/verify-amenity-tap-dead-1-control-showAmen.png`
- **What happens now.** `drawAmen` writes `data-pick="a:<kind>:<x>:<y>"`. `pick()` splits it with a two-part destructure, `const [k,v]=elm.dataset.pick.split(':')` (`apps/dollywood-live.html:844`), so `v` is only the kind and x and y come out undefined; no amenity matches, and `showAmen` (`apps/dollywood-live.html:1574`) is never reached.
- **Why it matters.** A parent tapping the restroom or first-aid marker nearest a child gets nothing, and an AED location can only be seen, not opened.
- **Proposed fix.** Pass the full kind:x:y id to showAmen so amenity markers open their card. (Phase 3: IMP-DOLLYWOOD-LIVE-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-amenity-tap-dead-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-amenity-tap-dead-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-09 — Every tap of the compass jumps the view to the Entrance, and the first tap does not rotate anything

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:352`; `apps/dollywood-live.html:1246`, `apps/dollywood-live.html:1398`, `apps/dollywood-live.html:1029`, `apps/dollywood.html:1029`; `audits/evidence/p3/dollywood-live/functional-compass-after.png`, `audits/evidence/p3/dollywood-live/measure-after-compass-ipad.png`
- **What happens now.** `#lv-north` toggles the hidden `#l-upright` checkbox and fires its change handler (`apps/dollywood-live.html:1467`), which sets the rotation and then fits `SEC[curSec]` (`apps/dollywood-live.html:1029`).
- **Why it matters.** A parent tapping the compass to get their bearings is thrown to the entrance and parking area, away from where they were looking and from the family's markers.
- **Proposed fix.** The compass re-orients the current view in place (template :1029 upright handler) and never jumps to the Entrance.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-compass-jumps-to-entrance-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-compass-jumps-to-entrance-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-10 — On iPhone the pill cuts off the location-denied instructions before "or use Set my spot" (from the visual check)

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:377`; `apps/dollywood-live.html:399`, `apps/dollywood-live.html:516-517`, `apps/dollywood-live.html:613`, `apps/dollywood-live.html:1404-1405`; `audits/evidence/p3/dollywood-live/denied-adult-iphone.png`, `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png`
- **What happens now.** The pill title and subtitle are single lines with an ellipsis (`apps/dollywood-live.html:399`), and so are the meeting bar's name and meta (`apps/dollywood-live.html:516-517`). There is no title attribute and no way to expand either (`apps/dollywood-live.html:613, 621`). On a 430 px iPhone:
- **Why it matters.** At the moment location fails in the park, a parent reads half an instruction and sees no way forward, and the "or use Set my spot" escape route is never shown.
- **Proposed fix.** The denied pill wraps to two lines on phones (or opens a short sheet) and keeps the Set my spot action visible. (Phase 3: IMP-DOLLYWOOD-LIVE-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-12 — Switching a kid's beacon off while the kid's map is open does not hide the kid: the kid's phone republishes its spot and the last position stays (from the completeness critic)

- **Area** dollywood-live · **Type** bug (security) · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:429`; `apps/hub.js:342`, `apps/dollywood-live.html:1308`, `apps/dollywood-live.html:694`, `apps/dollywood-live.html:1483`; `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-off-republished-1-2-A-mom-family-ipad.png`
- **What happens now.** The parent's switch writes `kidshare:<kid> = false` and tombstones `loc:<kid>` (`apps/dollywood-live.html:1308`). The kid's page still has `kidshare` true in its cache until its next pull, so `publish()`, which checks only `shareOn()` (`apps/dollywood-live.html:694, 1250-1253`), writes a fresh `loc:<kid>` on the next fix, and that later …
- **Why it matters.** A parent's deliberate choice to stop showing a 4- or 5-year-old's position is undone without any sign: the switch reads off while the child's last spot stays on every phone, the Kitchen iPad's Home card and chat for hours.
- **Proposed fix.** When kidshare:<kid> turns false, the kid's open map stops watchPosition and publishes a tombstone for loc:<kid>; the parent's map drops the marker at once. (Phase 3: IMP-DOLLYWOOD-LIVE-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/critic-kid-beacon.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-off-republished-1-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-off-republished-1-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-13 — Switching a kid's beacon on does nothing on the kid's open map until it is closed and reopened, while the parent's switch says it is sharing (from the completeness critic)

- **Area** dollywood-live · **Type** bug · **Severity** medium · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:455`; `apps/dollywood-live.html:1307`, `apps/dollywood-live.html:693-694`, `apps/dollywood-live.html:1486`, `apps/dollywood-live.html:1485`; `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1-kiara-open.png`, `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1-kiara-reopened.png`
- **What happens now.** `VIEW_ONLY()` and `shareOn()` read `kidshare` live (`apps/dollywood-live.html:693-694`), so after the pull the kid's page is no longer view-only and `shareOn()` is true.
- **Why it matters.** At the park, a parent switches the beacon on for a child who already has the map open and expects the child's dot; nothing appears, and both switches say it is sharing.
- **Proposed fix.** When kidshare:<kid> turns true, the kid's open map starts locating and publishing on the next onChange.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1.mjs"`, `node "audits/tools/phase3/dollywood-live/critic-kid-beacon.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-2.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-1 — Family marker labels pile into an unreadable stack with long names

- **Area** dollywood-live · **Type** visual · **Severity** medium · **Effort** M · **Batch** 10
- **Verified (step 3).** was medium; skeptics medium (partly) and medium (partly). Correction: The title and text blame long names, but the collision also happens with the real short names. In the park seed Ezra's marker hides Elizabeth's label and marker on iPad and iPhone, so exposure is wider than stated.
- **Evidence.** `audits/03-apps/dollywood-live.md:644`; `apps/dollywood-live.html:1219-1221`; `audits/screens/dollywood-live/map-overflow-ipad-portrait-light.png`, `audits/screens/dollywood-live/meet-overflow-iphone-pwa-light.png`
- **What happens now.** `drawFam` draws each name pill with no collision handling (`apps/dollywood-live.html:1219-1221`), unlike the ride labels. In the overflow seed 4-5 long-name pills stack around Thunderhead and the Great Tree Swing ("Kiara Seraphina Josephine" covers "Ezra Bartholomew Anderson"), and a guest's label is clipped at the …
- **Why it matters.** Long names pile into an unreadable stack.
- **Proposed fix.** Family marker labels collide-avoid like ride labels, and collapse to initials when they overlap. (Phase 3: IMP-DOLLYWOOD-LIVE-P15)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### GAP-DOLLYWOOD-LIVE-2 — No wait-time history or trend

- **Area** dollywood-live · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:688`; `apps/dollywood-live.html:1502`
- **What happens now.** No wait-time history or trend (low). Thrill-Data shows whether a line is growing; here each wait is a single number (`apps/dollywood-live.html:1502`).
- **Why it matters.** Whether a line is growing decides where to go next.
- **Proposed fix.** Show a trend arrow per ride from the last few waits the Worker already fetches (60 s cache). (Phase 3: IMP-DOLLYWOOD-LIVE-F4)
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.

#### GAP-DOLLYWOOD-LIVE-4 — Offline is the precached page and rasters plus the last pull

- **Area** dollywood-live · **Type** feature gap · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:690`; `sw.js:16`, `apps/dollywood-live.html:696`, `sw.js:15`, `scripts/bump-sw.mjs:18`
- **What happens now.** Offline is the precached page and rasters plus the last pull (low). The page and four rasters (relief, relief_soft, slope, illustrated_lo) are precached (`sw.js:16`); the Satellite style's `aerial.jpg` (`apps/dollywood-live.html:696`) is not, by design (`sw.js:15`, `scripts/bump-sw.mjs:18`), so Satellite has no image offline unless it was opened online earlier (not tested). Family positions are whatever the last pull brought, and there are no wider tiles.
- **Why it matters.** Signal is patchy in the park.
- **Proposed fix.** Say what works offline in the park ("Map and last waits available offline; live waits need signal").
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-11 — A waits-feed ride whose name differs from the listing (the Dollywood Express) silently shows no wait

- **Area** dollywood-live · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:405`; `apps/dollywood-live.html:1493`, `apps/dollywood-live.html:1501-1502`, `apps/dollywood-live.html:1494`, `apps/dollywood-live.html:1493-1494`; `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/evidence/p3/dollywood-live/verify-waits-name-match-drops-1-seeded-waits-iphone.png`
- **What happens now.** `loadWaits` attaches a feed ride only when its normalised name (`wnorm`, `apps/dollywood-live.html:1493`) equals an attraction listing's exactly (`apps/dollywood-live.html:1501-1502`), and the alias table `WALIAS` is empty (`apps/dollywood-live.html:1494`).
- **Why it matters.** The family's train ride shows no posted wait, with no sign that one exists.
- **Proposed fix.** Alias the waits feed's renamed rides (the Dollywood Express) in the name table and log unmatched feed names to the console once. (Phase 3: IMP-DOLLYWOOD-LIVE-F2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-waits-name-match-drops-1.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-waits-name-match-drops-2.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-15 — After the waits feed fails, a map left open keeps showing the last waits as current, past the app's own 6 h limit (from the completeness critic)

- **Area** dollywood-live · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:507`; `apps/dollywood-live.html:1400`, `apps/dollywood-live.html:1504`, `apps/dollywood-live.html:1507-1510`, `apps/dollywood-live.html:1554-1560`; `audits/evidence/p3/dollywood-live/critic-waits-stale-7h-iphone.png`, `audits/evidence/p3/dollywood-live/verify-critic-waits-stale-while-open-4-1-A-fresh.png`
- **What happens now.** `loadWaits` applies the 6 h cache limit only inside `if(!WAITS.at)` (`apps/dollywood-live.html:1504`), that is, only when nothing has loaded since the map opened. After one success, each failure sets `WAITS.err` and keeps `WAITS.by`, however old.
- **Why it matters.** On a patchy park network, the Next-ride hero can steer the family to a ride using the morning's waits.
- **Proposed fix.** Waits older than 6 h are dropped everywhere (chips, hero, Nearby rows, directions bar), not only in the list; the 60 s retry keeps running while open. (Phase 3: IMP-DOLLYWOOD-LIVE-P13)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-critic-waits-stale-while-open-4-1.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-waits-stale-while-open-4-2.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-16 — A kid with his beacon on gets a "Share my spot" switch that cannot be switched off: it snaps back on and his spot is republished (from the completeness critic)

- **Area** dollywood-live · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:532`; `apps/dollywood-live.html:1300-1301`, `apps/dollywood-live.html:693`, `apps/dollywood-live.html:1310-1313`, `apps/dollywood-live.html:694`; `audits/evidence/p3/dollywood-live/critic-kid-share-switch-ezra-iphone.png`, `audits/evidence/p3/dollywood-live/verify-critic-kid-share-switch-noop-5-1-b-after-untick.png`
- **What happens now.** `renderFam` shows the Share switch to any writer who is not view-only (`canShare`, `apps/dollywood-live.html:1300-1301`), and a kid whose beacon is on is not view-only (`apps/dollywood-live.html:693`). Unticking runs `setShare(false)`: it writes person `share=false` and tombstones `loc:<kid>` (`apps/dollywood-live.html:1310-1313`).
- **Why it matters.** The switch looks as if the child can stop sharing, briefly deletes his marker for the parents, then quietly republishes it.
- **Proposed fix.** For a kid the beacon is the parent's control: hide the Share switch and show "Your beacon is on — a grown-up can switch it off".
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-critic-kid-share-switch-noop-5-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-kid-share-switch-noop-5-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-17 — On a location denial the error handler bypasses the app's designed "denied" state, so no Set my spot chip appears until the app is backgrounded (from the completeness critic)

- **Area** dollywood-live · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:557`; `apps/dollywood-live.html:1404-1405`, `apps/dollywood-live.html:1408`, `apps/dollywood-live.html:1267`, `apps/dollywood-live.html:1257-1258`; `audits/evidence/p3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-1-eli-iphone-pwa-denied.png`, `audits/evidence/p3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-1-eli-iphone-pwa-after-visibility.png`
- **What happens now.** For error code 1 the `watchPosition` handler writes "Location is off for this site" and the long Settings hint into `#loc-sec` and `#loc-acc`, then returns without calling `updLoc()` (`apps/dollywood-live.html:1404-1405`).
- **Why it matters.** At the moment location fails in the park, the pill offers no action, although the app has a designed state for exactly this. On an iPhone the Nearby pane's Set my spot button sits just below the fold of the peek sheet.
- **Proposed fix.** The geolocation error path sets gpsErr and calls updLoc(), so the designed denied state and its Set my spot chip show at once. (Phase 3: IMP-DOLLYWOOD-LIVE-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P3-DOLLYWOOD-LIVE-18 — While the map stays open, the meeting point never expires and its "set by … N min ago" age never updates (from the completeness critic)

- **Area** dollywood-live · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:582`; `apps/hub.js:292-298`, `apps/dollywood-live.html:1475-1476`, `apps/dollywood-live.html:1579`, `apps/dollywood-live.html:1256`; `audits/evidence/p3/dollywood-live/critic-meet-expiry-iphone.png`, `audits/evidence/p3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-1-C-plus2h10.png`
- **What happens now.** `loadMeet` applies the 2 h expiry and calls `renderMeet`, which computes the age with `agoOf` (`apps/dollywood-live.html:1579, 1583-1584`). Both run only at start and from `loadFam` when another device changes a family row (`apps/dollywood-live.html:1256, 1483`).
- **Why it matters.** "12 min ago" on a 2-hour-old meeting point can send a parent to a place the family left long ago.
- **Proposed fix.** Re-run loadMeet() on the 30 s timer and on becoming visible, so the age updates and the pin drops at 2 h.
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-2.mjs"`, `node "audits/tools/phase3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P4-ACCENT-06 — With north-up pressed, the compass fills with the person's `--accent-deep`: its 9 px red "N" drops to 1.0-2.45:1 for every profile, and its red needle to 1.0-1.5:1 in dark

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/04-design-system.md:5591`
- **What happens now.** The fill wins on specificity. `[data-flavor=live] button[aria-pressed=true]{background:var(--accent-deep)}` (template `:225`, specificity 0,2,1) beats `.lv-north`'s glass (`:417`, 0,1,0) once the button is pressed (`:1595`). The glyphs are fixed red.
- **Why it matters.** North-up is the orientation aid on a rotated park map. When it is switched on, its own label all but vanishes.
- **Proposed fix.** The pressed compass keeps its needle and "N" at ≥ 3:1 (a --map-north mark on a neutral fill).
- **How it will be verified.** Rerun `node "audits/tools/phase4/ACCENT/verify-park-north-n-on-accent-2.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P4-ICON-04 — The map compass's north needle is a fixed `#FF6B4A`: 2.24-2.75:1 in the three light palettes

- **Area** design system, all areas · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/04-design-system.md:2878`; `apps/dollywood-live.html:620`, `apps/dollywood.html:620`, `apps/dollywood.html:313`; `audits/screens/dollywood-live/amenity-tap-typical-iphone-pwa-light.png`
- **What happens now.** The markup. The north half of `#lv-north` is `fill="#FF6B4A"` as a literal attribute (`apps/dollywood-live.html:620`; identical at `apps/dollywood.html:620`, from `template.html:620`). It sits on the cream glass button (`var(--lv-glass-soft)`, `:417`). Measured:
- **Why it matters.** It is the colour cue for north on a rotated map, and it fails in the normal daylight themes. CLAUDE.md allows hex only for map colours, and this is control chrome.
- **Proposed fix.** The compass needle reads --map-north (danger graphic, ≥ 3:1). (Phase 4 gap row ICON-10)
- **How it will be verified.** Rerun `node "audits/tools/phase4/ICON/measure.mjs"`, `node "audits/tools/phase4/ICON/report.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P4-MOTION-03 — Park map on a park day: four infinite pulses keep the main thread 17-28 % busy while the map sits open; the two `box-shadow` rings drive it

- **Area** design system (park map) · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/04-design-system.md:3994`; `apps/dollywood-live.html:1475`, `apps/dollywood-live.html:400-401`, `apps/design.css:611-613`
- **What happens now.** Four infinite animations run while the person is located and sharing:
- **Why it matters.** On a park day the map is open on phones for hours, with the screen held on. A constant 17-28 % main-thread load drains batteries when the family most needs them.
- **Proposed fix.** Park-map pulses stop after three cycles (--ambient-iterations) and animate transform/opacity, not box-shadow. (Phase 4 gap row MOTION-9)
- **How it will be verified.** Rerun `node "audits/tools/phase4/MOTION/park-live.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### P4-SHAPE-03 — Park map: five control rules under 44 px beyond the five P3 recorded, namely the sheet handle (22), About the data (29), the layer-toggle rows (29), the kids' height stepper (40×40) and the directions-bar buttons (40)

- **Area** design system (park map) · **Type** bug · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/04-design-system.md:2107`; `apps/dollywood-live.html:1473`, `apps/dollywood-live.html:1301`; `audits/screens/dollywood-live/meet-overflow-iphone-pwa-light.png`
- **What happens now.** The investigator's count. The rig found 18 interactive selectors under 44 in the park map's own document, 19 with an inline link, measured by element box.
- **Why it matters.** The park map is used one-handed while walking, and the small controls are the ones most often missed. The handle is how the sheet is opened.
- **Proposed fix.** The five further park-map controls (handle, About, layer rows, heights, …) at var(--tap). (Phase 4 gap row SHAPE-10)
- **How it will be verified.** Rerun `node "audits/tools/phase4/SHAPE/verify-parkmap-targets-18-1.mjs"` — the defect must no longer reproduce; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-1 — The location-denied state is incomplete, and a kid gets adult "Settings › Safari" wording

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** S · **Batch** 10
- **Verified (step 3).** was medium; skeptics low and low. Correction: The facts are right, but medium is inflated. The wording is correct and actionable for the adult who is always with a 5-year-old at the park. A pre-reader is not helped by any wording, and nothing is broken or misleading, so the rating should be low.
- **Evidence.** `audits/03-apps/dollywood-live.md:613`; `apps/dollywood-live.html:1404-1405`, `apps/dollywood-live.html:1267`; `audits/evidence/p3/dollywood-live/denied-adult-iphone.png`, `audits/evidence/p3/dollywood-live/denied-kid-iphone.png`
- **What happens now.** The missing designed state and its Set my spot chip were filed here first; the completeness critic reclassified that part as a bug against the code's own design, and it is now P3-DOLLYWOOD-LIVE-17 (confirmed 2/2). What stays here is the wording.
- **Why it matters.** A kid gets adult Settings instructions.
- **Proposed fix.** Kid-appropriate denied wording ("Ask a grown-up to turn on location") with a picture; adults get the steps. (Phase 3: IMP-DOLLYWOOD-LIVE-P4)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-2 — A view-only kid is told to tap a button that is hidden for her

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:618`; `apps/dollywood-live.html:1290`, `apps/dollywood-live.html:1485`, `apps/dollywood-live.html:1250`; `audits/evidence/p3/dollywood-live/states-kid-nearby.png`, `audits/screens/dollywood-live/kid-nearby-typical-desktop-light.png`
- **What happens now.** Nearby's empty text reads "Find yourself first: tap ◎, or use Set my spot." (`apps/dollywood-live.html:1290`), but ◎ is hidden for view-only users (`apps/dollywood-live.html:1485`). Set my spot is still offered to her;
- **Why it matters.** The kid is told to tap a hidden button.
- **Proposed fix.** View-only kids get "A grown-up can show where you are" instead of "tap ◎".
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-4 — The build guide's engineering panels leak into the family park map

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** M · **Batch** 10
- **Verified (step 3).** was medium; skeptics low and low. Correction: The facts are right, but the severity is inflated. The only misleading element, the height select, is P3-DOLLYWOOD-LIVE-14. What remains is clutter in an optional card and in secondary panes, so it is low.
- **Evidence.** `audits/03-apps/dollywood-live.md:625`; `apps/dollywood-live.html:1464`, `apps/dollywood-live.html:936`; `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png`, `audits/screens/dollywood-live/search-query-typical-iphone-safari-dark.png`
- **What happens now.** The ride card's Track button opens the guide's coaster survey card: "Mapped track 936 m" (metric beside feet elsewhere), "Ground under track 1053–1098 ft", "In Planet Coaster 2: Wooden coaster; keep the station fly-through", an OpenStreetMap disclaimer and an elevation chart.
- **Why it matters.** Engineering detail crowds the family map.
- **Proposed fix.** The park map hides the build guide's engineering panels (coaster survey, OSM disclaimer, metric track data); Track shows a family-friendly ride card. (Phase 3: IMP-DOLLYWOOD-LIVE-P11, IMP-DOLLYWOOD-LIVE-P16)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-5 — Kid mode needs reading

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** M · **Batch** 10
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: Waits rows are not left without a reason: each one prints the ride's height requirement in its subline ('55"', '48"'). What is missing is only the 'needs N"' chip that Nearby and Search show. The fade is not kid mode either.
- **Evidence.** `audits/03-apps/dollywood-live.md:630`; `apps/dollywood-live.html:1532`; `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/kid-typical-ipad-portrait-dark.png`
- **What happens now.** A pre-reader's pill shows "Location is off for this site / Allow Location …" (beacon on) or "Rides and the family, live / Kiara · just looking".
- **Why it matters.** Kids cannot use the map without reading.
- **Proposed fix.** Kid mode: picture-first pill and Waits (ride art, a height badge "too short" with an icon), no reading needed. (Phase 3: IMP-DOLLYWOOD-LIVE-P10)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-6 — The waits error state says the same thing twice

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:635`; `apps/dollywood-live.html:1526`, `apps/dollywood-live.html:1522`; `audits/screens/dollywood-live/waits-error-iphone-pwa-light.png`, `audits/evidence/p3/dollywood-live/waits-error-iphone.png`
- **What happens now.** Under the illustrated pin the pane says "Could not reach the wait-time feed. It retries every minute." (`apps/dollywood-live.html:1526`) and further down "Wait times are not available right now." (`apps/dollywood-live.html:1522`).
- **Why it matters.** The same message twice.
- **Proposed fix.** One waits error line, with when it last worked.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### UX-DOLLYWOOD-LIVE-7 — Kids' heights take one tap per inch from 36

- **Area** dollywood-live · **Type** usability · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:638`; `apps/dollywood-live.html:1547-1548`
- **What happens now.** With no stored height the stepper starts from 36 and moves one inch per tap, with one family write per tap (`apps/dollywood-live.html:1547-1548`). Entering Ezra's measured 43" is 7 taps and 7 writes; 48" is 12. At the park that is a parent holding a child with one hand. A number field or a picker would take one entry.
- **Why it matters.** Seven taps and seven writes for one height.
- **Proposed fix.** Heights: a number field (or a ruler slider) that starts at the kid's last value, one write when done. (Phase 3: IMP-DOLLYWOOD-LIVE-P14)
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-2 — The meeting-point label collides with pucks and is clipped

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:647`; `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png`
- **What happens now.** "Meet · The Wildwood Tree" is overdrawn by the Ezra, Elizabeth and Mae pucks and cut to "Meet · The Wildw…ree" on iPhone; a long name runs off the right edge under the buttons ("Meet · TimeSaver & Special Experiences Res").
- **Why it matters.** The label is overdrawn and clipped.
- **Proposed fix.** The meeting-point label gets collision handling and a max width with ellipsis. (Phase 3: IMP-DOLLYWOOD-LIVE-I1)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-3 — The ride card's ABOUT is often empty, and Track opens the raw survey card

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:650`; `apps/dollywood-live.html:1447`, `apps/dollywood-live.html:936`, `apps/dollywood-live.html:113-114`, `apps/dollywood-live.html:984`; `audits/screens/dollywood-live/ride-card-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/coaster-card-typical-desktop-dark.png`
- **What happens now.** The park-day ride card folds bookkeeping into an About section (`apps/dollywood-live.html:1447`) that often holds only the dollywood.com link. Track reuses the build guide's coaster card with no sticky head or action row; on phones the ride card covers the lower map, including Whole park and Find me.
- **Why it matters.** Empty sections and a raw survey card.
- **Proposed fix.** Hide an empty ABOUT section; Track opens a sticky-headed card. (Phase 3: IMP-DOLLYWOOD-LIVE-P16)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-4 — On iPad portrait the coaster card covers the meeting bar and runs over the search field

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:654`; `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png`
- **What happens now.** The card's top edge hides "set by Mae 12 min ago" and half of Done; its "Zoom to it" area runs into the Search input behind it.
- **Why it matters.** The card covers the meeting bar.
- **Proposed fix.** On iPad portrait the coaster card is a sheet below the meeting bar, never over it or the search field.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-5 — Five control rules are under the 44 px minimum

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:657`; `apps/dollywood-live.html:432`, `apps/dollywood-live.html:517`, `apps/dollywood-live.html:522`, `apps/dollywood-live.html:503`; `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/screens/dollywood-live/meet-overflow-iphone-pwa-light.png`
- **What happens now.** Measured: Set my spot 96×36 (`measure.json` `B_targets`). The checker estimated from 1× captures the meeting bar's Done at about 33 px, the Nearby / Waits segment at about 32 and the filter chips at about 36.
- **Why it matters.** Small targets outdoors, one-handed, in the sun.
- **Proposed fix.** All ten controls under 44 px move to var(--tap) (Set my spot, Done, the segment, chips, handle, About, layer rows, heights). (Phase 3: IMP-DOLLYWOOD-LIVE-P12)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-6 — Seven :hover rules are not behind a fine-pointer query

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:661`; `apps/dollywood-live.html:25`
- **What happens now.** `button`, `.oi`, `.info a.btn`, `.bitem`, `.pop a.btn`, `.offm` and `.used a` hover rules at `apps/dollywood-live.html:25, 65, 77, 100, 124, 134, 192`; `hoverGuarded 0`. On touch a tapped button can keep its hover look.
- **Why it matters.** Tapped buttons keep a hover look on touch.
- **Proposed fix.** Put the seven :hover rules behind @media (hover: hover) and (pointer: fine).
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-8 — The wait tiles' "MIN" label is 9.5 px white on saturated bands, failing 4.5:1 on green and amber

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:667`; `apps/dollywood-live.html:500`, `apps/dollywood-live.html:501`; `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/screens/dollywood-live/waits-typical-desktop-dark.png`
- **What happens now.** `.wtile small` is 9.5 px (`apps/dollywood-live.html:500`), below the 11 px floor. White on the short band `#1E8A4C` is 4.38:1 and on the mid band `#C77A00` 3.38:1 (`apps/dollywood-live.html:501`); the 20 px numerals pass 3:1 on every band. The bands are saturated literals, not house pastels with a deep ink.
- **Why it matters.** The label fails contrast in the sun.
- **Proposed fix.** Wait tiles: the MIN label at --fs-caption2 (11 px) in --wait-*-ink on the pastel wait fills (--wait-short/-medium/-long), gated at 4.5:1. (Phase 3: IMP-DOLLYWOOD-LIVE-P17)
- **How it will be verified.** Rerun `node "audits/tools/phase3/dollywood-live/vischeck-contrast.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-9 — An underlined text link on the ride card

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:670`; `apps/dollywood-live.html:491`; `audits/screens/dollywood-live/ride-card-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/ride-card-typical-ipad-landscape-dark.png`
- **What happens now.** "dollywood.com ↗" is underlined in light and dark; `.lv-link` sets no `text-decoration` (`apps/dollywood-live.html:491`).
- **Why it matters.** A web-style link.
- **Proposed fix.** The ride card's link becomes a button-styled row (no underline) with an external-link icon.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-10 — Desktop and iPad-landscape layout: 1,400 px rows and a visible edge to the map art

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:673`; `audits/screens/dollywood-live/waits-typical-desktop-dark.png`, `audits/screens/dollywood-live/map-typical-desktop-light.png`
- **What happens now.** At 1440 px the Waits rows and the meeting bar span the full width, with the facts at opposite edges. The illustrated art ends in a hard vertical edge at about x 160 on desktop and x 82 on iPad landscape, with flat green beyond.
- **Why it matters.** Stretched rows and a hard edge to the art.
- **Proposed fix.** Cap row widths at --col-narrow on wide screens and fill the map edge with the terrain colour (or crop the art).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-11 — Placing mode shows a cut-off sliver of sheet buttons under the tabs

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:676`; `audits/screens/dollywood-live/placing-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/placing-typical-iphone-safari-dark.png`
- **What happens now.** Evidence: `audits/screens/dollywood-live/placing-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/placing-typical-iphone-safari-dark.png`, `audits/screens/dollywood-live/placing-typical-ipad-portrait-light.png`.
- **Why it matters.** A cut-off row of buttons.
- **Proposed fix.** In placing mode hide the sheet completely instead of leaving a sliver.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-12 — The illustrated map is one low-resolution raster that goes soft at ride zoom

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** M · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:678`; `audits/screens/dollywood-live/ride-card-typical-ipad-landscape-dark.png`, `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png`
- **What happens now.** The only illustrated asset is `apps/dollywood/illustrated_lo.jpg` (403,725 bytes; no higher-resolution illustrated file in `apps/dollywood/`). Zoomed on a ride on iPad landscape, the art is visibly blurred beside the crisp vector chips.
- **Why it matters.** The art goes soft when zoomed.
- **Proposed fix.** Export a 2x illustrated raster (or tiles) for ride zoom, within the precache size limit (scripts/bump-sw.mjs skip list if large).
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### VIS-DOLLYWOOD-LIVE-13 — Whole park on iPhone leaves the park small, and the full-height sheet ghosts over the meeting bar

- **Area** dollywood-live · **Type** visual · **Severity** low · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:681`; `audits/screens/dollywood-live/whole-park-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/map-loading-iphone-pwa-light.png`
- **What happens now.** Whole park leaves empty green bands above and below the park (about 150 px under the meeting bar, per the checker). At full height, the sheet slides over the meeting bar, which shows through.
- **Why it matters.** The park is small and the bar ghosts through.
- **Proposed fix.** Whole park fits the park to the visible area above the sheet on iPhone; the full sheet hides the meeting bar behind a solid material.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 10's checks.

#### GAP-DOLLYWOOD-LIVE-3 — No park hours, showtimes or dining

- **Area** dollywood-live · **Type** feature gap · **Severity** info · **Effort** S · **Batch** 10
- **Evidence.** `audits/03-apps/dollywood-live.md:689`
- **What happens now.** No park hours, showtimes or dining (info). NOT FOUND IN CODE; reasonably out of scope for a family hub.
- **Why it matters.** Info only.
- **Proposed fix.** Out of scope (info): link to dollywood.com for hours and shows; no change planned. (Phase 3: IMP-DOLLYWOOD-LIVE-I2)
- **How it will be verified.** recapture its screens (capture area dollywood-live) and compare; plus batch 10's checks.

### Batch 11 — Tally counter (15)

#### UX-TALLY-1 — Reset to zero wipes the count in one tap, with no confirm and no undo, and pre-readers are shown it

- **Area** tally · **Type** usability · **Severity** medium · **Effort** S · **Batch** 11
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: Minor: "three identical-material buttons" is not exact. Only + and Reset share the glass-strong fill. The minus button uses the lighter --glass and reads darker, and Reset is a pill, not a disc. The substance still holds: nothing about Reset (no icon, no colour) signals that it destroys the count.
- **Evidence.** `audits/03-apps/tally.md:486`; `apps/tally.html:155`, `apps/tally.html:140`; `audits/evidence/p3/tally/kid-after-reset-ipad-portrait.png`, `audits/screens/tally/kid-typical-iphone-pwa-light.png`
- **What happens now.** Reset calls `set(0)` at once (`apps/tally.html:155`). As Ezra the count went 13 → 0 with no dialog, no toast and no undo (`audiences.json` kid: `dialogs:[]`, `toast:null`).
- **Why it matters.** One tap wipes the count, and pre-readers are shown it.
- **Proposed fix.** Reset shows an Undo toast ("Reset from 37 · Undo") and moves away from + as a smaller ↺ icon; kids get the same undo. (Phase 3: IMP-TALLY-P1, IMP-TALLY-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/audiences.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 11's checks.

#### GAP-TALLY-1 — One counter per person, with no history, step size or feedback sound

- **Area** tally · **Type** feature gap · **Severity** low · **Effort** M · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:574`; `apps/tally.html:150`, `apps/tally.html:150-155`
- **What happens now.** There is a single `count` key (`apps/tally.html:150`), and no record of past counts or resets.
- **Why it matters.** Counter apps offer more than one counter.
- **Proposed fix.** Several named counters per person (item: rows) with a short list of recent resets; no routine or reward system. (Phase 3: IMP-TALLY-F3)
- **How it will be verified.** recapture its screens (capture area tally) and compare; plus batch 11's checks.

#### P3-TALLY-04 — − at 0 is not disabled and gives no feedback, yet every tap writes and re-stamps the row

- **Area** tally · **Type** bug · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:285`; `apps/tally.html:152`, `apps/hub.js:236-241`, `apps/tally.html:155`, `worker/src/data.js:60`; `audits/evidence/p3/tally/verify-minus-at-zero-silent-write-1.png`
- **What happens now.** `set(Math.max(0, -1))` writes 0 (`apps/tally.html:152`). `hub.set` always queues and re-stamps, and never compares with the current value (`apps/hub.js:236-241`). Three taps sent 3 batch POSTs of value 0. The button stays enabled, and nothing tells a child why nothing happened. Reset at 0 behaves the same way (`apps/tally.html:155`;
- **Why it matters.** A child pressing − at 0 gets no response. On a device that has not pulled yet, a − that visibly did nothing can wipe the count someone just made on another device.
- **Proposed fix.** Disable − at 0 and send no write when the value does not change. (Phase 3: IMP-TALLY-P10)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/verify-minus-at-zero-silent-write-1.mjs"`, `node "audits/tools/phase3/tally/verify-minus-at-zero-silent-write-2.mjs"`, `node "audits/tools/phase3/tally/rapid.mjs"` — the defect must no longer reproduce; plus batch 11's checks.

#### P3-TALLY-08 — Tally shows and counts from any value chat writes: −13, 12.5 and 1e21 are shown as-is

- **Area** tally · **Type** bug · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:423`; `worker/src/chat.js:52`, `apps/tally.html:150`, `worker/src/chat.js:29-30`, `apps/tally.html:150-152`; `audits/evidence/p3/tally/critic-chat-values-minus13-after-plus-ipad.png`, `audits/evidence/p3/tally/verify-critic-count-not-sanitised-3-2-minus13-ipad.png`
- **What happens now.** `n()` is `Number(value) || 0`, with no rounding, clamping or finite check (`apps/tally.html:150`). `show()` prints it raw (`:151`), and `set()` clamps only on write with `Math.max(0, v)` (`:152`). `set_data`'s value schema is `{}`, and the handler stores `input.value` unchecked (`worker/src/chat.js:29-30, 173-179`).
- **Why it matters.** A kid who asks chat to "take 50 off my tally" could end up with a negative count, and pressing + then wipes it to 0. It is odd and confusing rather than destructive.
- **Proposed fix.** n() rounds, clamps at 0 and rejects non-finite values; set_data validates Tally's value. (Phase 3: IMP-TALLY-P10)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/critic-chat-values.mjs"`, `node "audits/tools/phase3/tally/verify-critic-count-not-sanitised-3-1.mjs"`, `node "audits/tools/phase3/tally/verify-critic-count-not-sanitised-3-2.mjs"` — the defect must no longer reproduce; plus batch 11's checks.

#### P3-TALLY-09 — Opened on the TV, Tally offers live-looking +, − and Reset

- **Area** tally · **Type** bug · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:455`; `apps/tally.html:152`, `apps/hub.js:234`, `index.html:626`, `index.html:642`; `audits/evidence/p3/tally/kiosk-standalone-tv.png`, `audits/evidence/p3/tally/verify-critic-kiosk-offers-edit-controls-4-2-tv-after-tap.png`
- **What happens now.** The shell does not open Tally for the kiosk. On boot a kiosk always goes to Home (`index.html:626`), and `showTab` rewrites the hash to `#home` (`index.html:642`) with no toast.
- **Why it matters.** On the 10-foot TV a family member sees tappable-looking buttons that answer only with a toast.
- **Proposed fix.** When !hub.canWrite, hide the controls and show the pill as view-only. (Phase 3: IMP-TALLY-P10)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/verify-critic-kiosk-offers-edit-controls-4-1.mjs"`, `node "audits/tools/phase3/tally/verify-critic-kiosk-offers-edit-controls-4-2.mjs"`, `node "audits/tools/phase3/tally/audiences.mjs"` — the defect must no longer reproduce; plus batch 11's checks.

#### P4-GLASS-05 — Tally's five content-glass layers add 8-31 % to a burst of + taps, for a blur nobody can see

- **Area** design system (Tally) · **Type** bug · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/04-design-system.md:3478`; `apps/tally.html:45-51`
- **What happens now.** The layers. Tally's dial, +, −, Reset and the who kicker are all live glass (`apps/tally.html:45-51, 73-79, 98-104`), plus the shell's viewer bar: 6 visible layers, all `blur(18px) saturate(1.4) brightness(1.02)`. The author accepted it on purpose: "Not inside a scroller, so backdrop-filter is fine" (`:95-97`). The backdrop.
- **Why it matters.** Kids tap + fast. On the iPad each tap pays to re-blur a flat wash that looks the same with or without the blur.
- **Proposed fix.** Tally's dial and pill become solid; glass stays on + and −.
- **How it will be verified.** Rerun `node "audits/tools/phase4/GLASS/verify-tally-taps-glass-cost-2.mjs"` — the defect must no longer reproduce; plus batch 11's checks.

#### UX-TALLY-3 — Counting takes 3 taps from Home, and Home never shows the count

- **Area** tally · **Type** usability · **Severity** low · **Effort** M · **Batch** 11
- **Verified (step 3).** was medium; skeptics low (partly) and low. Correction: The item says counting 'misses the brief's target' as if this were a defect. EOU-1 (04-design-system.md:193) is a +1 bonus criterion, and the penalty rule EOU-5 only fires at 4 or more taps, so 3 taps is neutral under the house rubric.
- **Evidence.** `audits/03-apps/tally.md:501`; `apps.json:7`; `audits/evidence/p3/tally/kid-apps-grid-ipad-portrait.png`
- **What happens now.** Home → Apps → Tally tile → + is 3 taps for Eli on iPhone and Ezra on iPad. Home has no Tally card or button.
- **Why it matters.** Counting takes 3 taps and Home never shows the count.
- **Proposed fix.** A wide Home widget with the count and a + button (1 tap to count). (Phase 3: IMP-TALLY-F2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### UX-TALLY-4 — VoiceOver hears "Add one" but never the new count

- **Area** tally · **Type** usability · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:506`; `apps/tally.html:134-140`
- **What happens now.** VoiceOver hears "Add one" but never the new count (low). `#n` has no `aria-live` and no `role=status`. Reset has no `aria-label` and relies on its text. Evidence: `apps/tally.html:134-140`; `audiences.json` `kid.ui.liveRegion: false`.
- **Why it matters.** VoiceOver never hears the count.
- **Proposed fix.** aria-live="polite" on the count; aria-label on Reset. (Phase 3: IMP-TALLY-P9)
- **How it will be verified.** recapture its screens (capture area tally) and compare; plus batch 11's checks.

#### UX-TALLY-5 — On a phone turned sideways, + is below the fold and the pill overlaps the dial

- **Area** tally · **Type** usability · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:507`; `apps/tally.html:40`; `audits/evidence/p3/tally/landscape-phone-eli.png`
- **What happens now.** At 932×430 the frame is 382 px tall, but the dial stays 360 px (Eli) or 400 px (Ezra), because its size depends on width only (`apps/tally.html:40, 124`).
- **Why it matters.** + is below the fold sideways.
- **Proposed fix.** Size the dial with min(vw, vh) so + fits on a phone in landscape. (Phase 3: IMP-TALLY-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/landscape-phone.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 11's checks.

#### VIS-TALLY-2 — In kid mode the name pill overlaps the top of the dial on iPad landscape and iPhone Safari

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:527`; `apps/tally.html:124`; `audits/evidence/p3/tally/layout-typical-ezra-ipad-landscape-light.png`, `audits/evidence/p3/tally/layout-typical-ezra-iphone-safari-light.png`
- **What happens now.** The kid dial is sized from the width only (`clamp(260px, 80vw, 400px)`, `apps/tally.html:124`), and the pill is fixed at the top (`:117`).
- **Why it matters.** The pill overlaps the dial.
- **Proposed fix.** Kid dial sized from min(vw, vh); the pill never overlaps it. (Phase 3: IMP-TALLY-P8)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### VIS-TALLY-4 — The − disc is lighter glass than +, so it reads as secondary or disabled

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:536`; `apps/tally.html:69`; `audits/screens/tally/main-typical-ipad-portrait-light.png`, `audits/screens/tally/kid-typical-iphone-pwa-light.png`
- **What happens now.** − uses `--glass` and + uses `--glass-strong` (`apps/tally.html:69, 84`).
- **Why it matters.** − looks disabled.
- **Proposed fix.** − and + share the same material; − is distinguished by its glyph only. (Phase 3: IMP-TALLY-P6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### VIS-TALLY-6 — Large counts are not grouped

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:546`; `apps/tally.html:151`; `audits/screens/tally/main-overflow-iphone-pwa-dark.png`, `audits/screens/tally/main-overflow-ipad-portrait-light.png`
- **What happens now.** `textContent = v` (`apps/tally.html:151`) shows "1284750" and "250000".
- **Why it matters.** Large counts are hard to read.
- **Proposed fix.** Group digits with toLocaleString. (Phase 3: IMP-TALLY-P3)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### VIS-TALLY-8 — Whose counter it is shows only as the wash hue and a 12 px caps pill, with no avatar

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:555`; `apps/design.css:333`, `apps/design.css:280-283`, `apps/hub.js:459-462`, `apps/tally.html:130`; `audits/screens/tally/main-typical-ipad-portrait-light.png`
- **What happens now.** The pill is "ELI'S COUNTER": 12 px, weight 700, uppercase (`.kicker`, `apps/design.css:333`).
- **Why it matters.** Whose counter it is shows only as a hue.
- **Proposed fix.** The pill carries the person's face (hub.avatarHtml) and scales in kid mode. (Phase 3: IMP-TALLY-P8)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### VIS-TALLY-10 — The dial's tick ring shows in some themes only

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:565`; `apps/tally.html:54`; `audits/screens/tally/main-typical-iphone-pwa-light.png`, `audits/evidence/p3/tally/theme-parchment-lightos-eli.png`
- **What happens now.** The dashed ring (`apps/tally.html:54`) is nearly invisible on the white dial in light Hearth and Frost, and clearly drawn in dark and in Parchment.
- **Why it matters.** The ring shows in some themes only.
- **Proposed fix.** The tick ring reads --track-info so it shows in every theme.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### UX-TALLY-6 — Moved to P3-TALLY-09

- **Area** tally · **Type** usability · **Severity** low (pointer) · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:513`
- **Proposed fix.** Pointer to P3-TALLY-09.

#### Improvements with no finding (tally)

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). They are optional; Phase 6 carries them only if the household wants them.

| ID | Improvement | Kind | Delight | Effort | Source |
|---|---|---|---|---|---|
| IMP-TALLY-I1 | Across-the-room mode on the iPad: when idle, hide Reset and enlarge the count (for example a kids' game score on the Kitchen iPad) | idea | 3 | M | `audits/03-apps/tally.md:762` |

## The design preview

`audits/design-preview.html` renders the Phase 4 proposal (`audits/tools/phase4/tokens/proposed-tokens.css`) as the constitution asks. Open it from the repo root with any static server (the project's `.claude/launch.json` "hub" config serves it at `/audits/design-preview.html`); `?section=<id>` shows one section.

| Section | What it shows |
|---|---|
| `palette` | The eight house pastels plus Graphite and the three semantic families, light and dark: ink on fill, the label on the strong fill, ink on the card, the graphic mark and the tile glyph, each with its computed ratio; and the constitution's eight starting pairs from their literal hex. |
| `neutrals` | Page, card, well, text, secondary, tertiary and field border for Hearth, Parchment, Frost, Midnight, Forest and the proposed Graphite. |
| `type` | The Dynamic Type roles, their sizes for the phone, the iPad tier, kid mode, the TV today and the TV 10-foot scale, the rounded numerals and the glance roles. |
| `glass` | The four glass levels of D8 (Clear, Current, Frosted the default, Solid), each a stage that loads this page in `?stage=glass` mode so the real `:root[data-glass]` rules paint it, light and dark: a bar, a pill, a floating button, a sheet and a tab bar over busy art, with the outline halo on Clear and Current. |
| `tiles` | App tiles at iPhone density (60 px, 4 columns) and iPad density (76 px, 6 columns), light and dark, each app in its own hue (D5), and the tiles on all six palettes. |
| `accents` | The starting colours of D3 (the household, the TV) and a guest in sky (D4) as avatar ring, selected chip, primary button and progress, light and dark, plus a colour-vision-deficiency simulation. The admin can give any profile any of the 18 families (2026-09-26). |
| `prayer` | Prayer → Today before (the Phase 1 capture) and after (the same layout, order and controls on the proposed tokens, as CLAUDE.md requires for Prayer), light and dark. Prayer is the most-used app by the estimate above. |

- **Verified.** Every ratio on the page is computed from the rendered colours (WCAG 2), not typed in. `node audits/tools/phase5/preview-check.mjs` loads the page in the audit's WebKit and in Chromium at 390, 820 and 1440 px in light and dark and also checks the people, guest and app colour maps and the glass stages: 280 of 280 pairs pass their threshold in all 12 runs, with no map or stage issue, no horizontal scroll and no page error (`audits/evidence/p5/preview-check.json`).
- **Captured with the rig.** `node audits/tools/capture.mjs --area preview --out audits/screens-preview` took 70 captures (7 sections × 5 devices × light and dark, whole page), 0 failed; `audits/screens-preview/manifest.json` lists them with their SHA-256. Contact sheets (JPEG, committed): `audits/screens-preview/_sheets/preview--palette.jpg`, `preview--neutrals.jpg`, `preview--type.jpg`, `preview--glass.jpg`, `preview--tiles.jpg`, `preview--accents.jpg`, `preview--prayer.jpg`. The full-size PNGs stay on disk and out of git, like the Phase 1 set.
- **Rig changes.** Two opt-in screen flags were added to the capture rig for this: `fullPage` (capture the whole document) and `optIn` (an area that runs only when named with `--area`). A default `node audits/tools/capture.mjs` still plans the same 4,447 Phase 1 captures, and `audits/tools/phase4/measure.mjs` skips opt-in areas, so the baseline and the Phase 4 measurements are unchanged.
- **Not shown by the screenshots.** This WebKit paints no backdrop blur and uses Windows fallback fonts, so glass reads flatter and type slightly wider than on an iPad or iPhone (`audits/01-capture.md:103`). The ratios do not depend on either. Seeing the preview on the Kitchen iPad, an iPhone and the TV is the first device check of batch 1.

## Index

Every ID and its batch, sorted by ID.

| ID | Severity | Batch | ID | Severity | Batch | ID | Severity | Batch |
|---|---|---|---|---|---|---|---|---|
| CONS-ACCENT-1 | low | 1 | CONS-ACCENT-2 | low | 1 | CONS-ACCENT-3 | low | 1 |
| CONS-ACCENT-4 | low | 1 | CONS-COLOR-1 | low | 1 | CONS-COLOR-2 | low | 1 |
| CONS-COLOR-3 | low | 1 | CONS-COLOR-4 | low | 1 | CONS-DARK-1 | low | 1 |
| CONS-GLASS-1 | low | 1 | CONS-GLASS-2 | low | 1 | CONS-GLASS-3 | info | 1 |
| CONS-ICON-1 | low | 1 | CONS-ICON-2 | low | 1 | CONS-MOTION-1 | low | 1 |
| CONS-MOTION-2 | info | 1 | CONS-MOTION-3 | low | 1 | CONS-MOTION-4 | low | 1 |
| CONS-MOTION-5 | info | 1 | CONS-SHAPE-1 | low | 1 | CONS-SHAPE-2 | low | 1 |
| CONS-SHAPE-3 | low | 1 | CONS-SHAPE-4 | low | 1 | CONS-SHAPE-5 | low | 1 |
| CONS-SHAPE-6 | low | 1 | CONS-TELL-1 | low | 1 | CONS-TELL-2 | low | 1 |
| CONS-TOK-1 | low | 1 | CONS-TOK-2 | low | 1 | CONS-TOK-3 | low | 1 |
| CONS-TOK-4 | info | 2a | CONS-TYPE-1 | low | 1 | CONS-TYPE-2 | low | 1 |
| CONS-TYPE-3 | low | 1 | CONS-TYPE-4 | low | 1 | CONS-TYPE-5 | low | 1 |
| CONS-TYPE-6 | low | 9 | CONS-TYPE-7 | low | 1 | GAP-ACCENT-1 | low | 2a |
| GAP-CHAT-01 | low | 2b | GAP-CHAT-02 | medium | 0i | GAP-DARK-1 | low | 1 |
| GAP-DARK-2 | low | 1 | GAP-DARK-3 | low (ptr) | 1 | GAP-DOLLYWOOD-1 | low | 9 |
| GAP-DOLLYWOOD-LIVE-1 | medium | 10 | GAP-DOLLYWOOD-LIVE-2 | low | 10 | GAP-DOLLYWOOD-LIVE-3 | info | 10 |
| GAP-DOLLYWOOD-LIVE-4 | low | 10 | GAP-F260-1 | medium | 4 | GAP-GLASS-1 | low | 1 |
| GAP-HOME-1 | medium | 6 | GAP-HOME-2 | low | 5 | GAP-ICON-1 | low | 1 |
| GAP-ICON-2 | low | 1 | GAP-KIDVERSE-1 | low | 7 | GAP-LEFTOVERS-1 | medium | 8 |
| GAP-MOTION-1 | low | 1 | GAP-MOTION-2 | info | 1 | GAP-MOTION-3 | low | 1 |
| GAP-PRAYER-1 | info | 2b | GAP-PRAYER-2 | info | 3 | GAP-PROF-a1 | low | 0d |
| GAP-PROF-a2 | low | 2a | GAP-SHAPE-1 | low | 1 | GAP-SYNC-a1 | low | 0c |
| GAP-TALLY-1 | low | 11 | GAP-TELL-1 | low (ptr) | 0b | GAP-TIMER-1 | low | 6 |
| GAP-TIMER-2 | medium | 6 | GAP-TIMER-3 | medium | 6 | GAP-TOK-1 | low | 1 |
| GAP-TOK-2 | medium | 1 | GAP-TOK-3 | low | 1 | GAP-TOK-4 | low | 1 |
| GAP-TOK-5 | low | 1 | GAP-TOK-6 | low | 1 | GAP-TOK-7 | low | 1 |
| GAP-TOK-8 | low | 1 | GAP-TOK-9 | info | 1 | GAP-TYPE-1 | medium | 1 |
| GAP-TYPE-2 | medium | 1 | GAP-TYPE-3 | low | 1 | GAP-VERSES-1 | medium | 5 |
| GAP-VERSES-2 | low | 5 | GAP-VERSES-3 | low | 5 | P2-CHAT-01 | medium | 0i |
| P2-CHAT-02 | medium | 0d | P2-CHAT-03 | critical | 0i | P2-CHAT-04 | medium | 0i |
| P2-CHAT-05 | medium | 2b | P2-CHAT-06 | low (ptr) | 0d | P2-CHAT-07 | low | 0d |
| P2-CHAT-08 | low | 2b | P2-CHAT-09 | critical | 0i | P2-CHAT-10 | low | 2b |
| P2-CHAT-11 | low | 2b | P2-CHAT-12 | low | 2b | P2-CHAT-13 | low | 2b |
| P2-CHAT-14 | low (ptr) | 2c | P2-HOME-01 | high | 2a | P2-HOME-02 | high | 0b |
| P2-HOME-03 | medium | 2a | P2-HOME-04 | low (ptr) | 0b | P2-HOME-05 | low | 2a |
| P2-HOME-06 | low | 2a | P2-HOME-07 | low | 2c | P2-PROF-01 | critical (ptr) | 0c |
| P2-PROF-02 | critical | 0c | P2-PROF-03 | high (ptr) | 0c | P2-PROF-04 | critical | 0d |
| P2-PROF-05 | medium | 0d | P2-PROF-06 | critical (ptr) | 0d | P2-PROF-07 | medium (ptr) | 0c |
| P2-PROF-08 | medium | 6 | P2-PROF-09 | medium | 2a | P2-PROF-10 | low | 2c |
| P2-PROF-11 | low (ptr) | 2c | P2-PROF-12 | low | 2a | P2-PROF-13 | medium | 0c |
| P2-PROF-14 | critical | 0c | P2-PROF-15 | low | 0c | P2-PROF-16 | low | 2b |
| P2-PROF-17 | low (ptr) | 2b | P2-PROF-18 | low | 2a | P2-PROF-19 | critical | 0c |
| P2-PWA-01 | critical | 0d | P2-PWA-02 | high | 2b | P2-PWA-03 | medium | 2b |
| P2-PWA-04 | medium | 2b | P2-PWA-05 | medium | 2a | P2-PWA-06 | medium | 0c |
| P2-PWA-07 | medium (ptr) | 1 | P2-PWA-08 | medium | 2b | P2-PWA-09 | medium | 2b |
| P2-PWA-10 | low | 2b | P2-PWA-11 | low | 2b | P2-PWA-12 | low | 2b |
| P2-PWA-13 | low | 0c | P2-PWA-14 | low | 0c | P2-PWA-15 | low | 2b |
| P2-PWA-16 | low | 2b | P2-PWA-17 | low | 2a | P2-PWA-18 | medium | 10 |
| P2-SEC-01 | high | 0d | P2-SEC-02 | low | 0d | P2-SEC-03 | low | 0c |
| P2-STAB-01 | critical | 0a | P2-STAB-02 | high (ptr) | 0c | P2-STAB-03 | critical | 0g |
| P2-STAB-04 | high (ptr) | 0b | P2-STAB-05 | medium (ptr) | 2b | P2-STAB-06 | medium (ptr) | 2a |
| P2-STAB-07 | medium | 0b | P2-STAB-08 | low | 6 | P2-STAB-09 | low | 6 |
| P2-STAB-10 | low (ptr) | 2b | P2-STAB-11 | low | 2c | P2-STAB-12 | medium | 2c |
| P2-STAB-13 | medium | 6 | P2-SYNC-01 | critical | 0e | P2-SYNC-02 | critical | 0b |
| P2-SYNC-03 | critical | 0b | P2-SYNC-04 | high | 0c | P2-SYNC-05 | critical | 0b |
| P2-SYNC-06 | critical | 0c | P2-SYNC-07 | critical | 0c | P2-SYNC-08 | medium (ptr) | 0c |
| P2-SYNC-09 | critical | 0c | P2-SYNC-10 | medium (ptr) | 2a | P2-SYNC-11 | low | 0c |
| P2-SYNC-12 | low | 2c | P2-SYNC-13 | low | 2a | P2-SYNC-14 | low | 2a |
| P2-SYNC-15 | low | 0b | P2-SYNC-16 | low | 0c | P2-SYNC-17 | critical | 0b |
| P2-SYNC-18 | critical | 0c | P2-SYNC-19 | critical | 0e | P2-SYNC-20 | critical | 0e |
| P2-VIS-01 | critical (ptr) | 0a | P2-VIS-02 | medium | 2c | P2-VIS-03 | medium | 1 |
| P2-VIS-04 | low (ptr) | 0b | P2-VIS-05 | low | 2a | P2-VIS-06 | high | 1 |
| P2-VIS-07 | low (ptr) | 2a | P3-DOLLYWOOD-01 | critical (ptr) | 0b | P3-DOLLYWOOD-02 | critical | 0h |
| P3-DOLLYWOOD-03 | medium | 9 | P3-DOLLYWOOD-04 | medium | 9 | P3-DOLLYWOOD-05 | medium | 9 |
| P3-DOLLYWOOD-06 | medium | 9 | P3-DOLLYWOOD-07 | medium | 9 | P3-DOLLYWOOD-08 | low | 9 |
| P3-DOLLYWOOD-09 | low | 9 | P3-DOLLYWOOD-10 | low | 9 | P3-DOLLYWOOD-11 | low | 9 |
| P3-DOLLYWOOD-12 | low | 9 | P3-DOLLYWOOD-13 | low | 9 | P3-DOLLYWOOD-14 | low | 9 |
| P3-DOLLYWOOD-15 | low | 9 | P3-DOLLYWOOD-16 | medium | 9 | P3-DOLLYWOOD-17 | low | 9 |
| P3-DOLLYWOOD-18 | low | 9 | P3-DOLLYWOOD-LIVE-01 | critical | 0d | P3-DOLLYWOOD-LIVE-02 | high | 0d |
| P3-DOLLYWOOD-LIVE-03 | medium | 10 | P3-DOLLYWOOD-LIVE-04 | medium | 10 | P3-DOLLYWOOD-LIVE-05 | medium | 10 |
| P3-DOLLYWOOD-LIVE-06 | medium | 10 | P3-DOLLYWOOD-LIVE-07 | medium | 10 | P3-DOLLYWOOD-LIVE-08 | medium | 10 |
| P3-DOLLYWOOD-LIVE-09 | medium | 10 | P3-DOLLYWOOD-LIVE-10 | medium | 10 | P3-DOLLYWOOD-LIVE-11 | low | 10 |
| P3-DOLLYWOOD-LIVE-12 | medium | 10 | P3-DOLLYWOOD-LIVE-13 | medium | 10 | P3-DOLLYWOOD-LIVE-14 | medium (ptr) | 9 |
| P3-DOLLYWOOD-LIVE-15 | low | 10 | P3-DOLLYWOOD-LIVE-16 | low | 10 | P3-DOLLYWOOD-LIVE-17 | low | 10 |
| P3-DOLLYWOOD-LIVE-18 | low | 10 | P3-F260-01 | critical | 0e | P3-F260-02 | medium | 4 |
| P3-F260-03 | medium | 4 | P3-F260-04 | low | 4 | P3-F260-05 | low | 0b |
| P3-F260-06 | low | 0b | P3-F260-07 | low | 4 | P3-F260-08 | low | 4 |
| P3-F260-09 | low | 4 | P3-F260-10 | low | 4 | P3-F260-11 | low | 4 |
| P3-F260-12 | low | 4 | P3-F260-13 | critical | 0e | P3-F260-14 | medium | 0e |
| P3-F260-15 | medium | 4 | P3-F260-16 | medium | 4 | P3-F260-17 | medium | 4 |
| P3-F260-18 | low | 4 | P3-F260-19 | low | 4 | P3-F260-20 | low | 4 |
| P3-KIDVERSE-01 | critical | 0b | P3-KIDVERSE-02 | critical | 0f | P3-KIDVERSE-03 | critical | 0b |
| P3-KIDVERSE-04 | medium | 7 | P3-KIDVERSE-05 | medium | 7 | P3-KIDVERSE-06 | low | 7 |
| P3-KIDVERSE-07 | low | 0g | P3-KIDVERSE-08 | low | 0b | P3-KIDVERSE-09 | low | 7 |
| P3-KIDVERSE-10 | critical | 0f | P3-KIDVERSE-11 | critical | 0b | P3-KIDVERSE-12 | medium | 7 |
| P3-KIDVERSE-13 | medium | 7 | P3-KIDVERSE-14 | low | 1 | P3-LEFTOVERS-01 | critical | 0h |
| P3-LEFTOVERS-02 | medium | 8 | P3-LEFTOVERS-03 | medium | 0b | P3-LEFTOVERS-04 | medium | 0i |
| P3-LEFTOVERS-05 | low (ptr) | 0b | P3-LEFTOVERS-06 | low | 0b | P3-LEFTOVERS-07 | low | 0b |
| P3-LEFTOVERS-08 | low | 0b | P3-LEFTOVERS-09 | low | 0i | P3-LEFTOVERS-10 | low | 8 |
| P3-LEFTOVERS-11 | low | 8 | P3-LEFTOVERS-12 | critical | 0h | P3-LEFTOVERS-13 | critical | 0h |
| P3-LEFTOVERS-14 | low | 0b | P3-LEFTOVERS-15 | low | 1 | P3-PRAYER-01 | critical | 0g |
| P3-PRAYER-02 | critical | 0b | P3-PRAYER-03 | critical | 0g | P3-PRAYER-04 | critical | 0g |
| P3-PRAYER-05 | high | 0g | P3-PRAYER-06 | high | 0d | P3-PRAYER-07 | medium | 3 |
| P3-PRAYER-08 | medium | 3 | P3-PRAYER-09 | low | 3 | P3-PRAYER-10 | low | 0b |
| P3-PRAYER-11 | low | 0b | P3-PRAYER-12 | low | 3 | P3-PRAYER-13 | low | 3 |
| P3-PRAYER-14 | low | 3 | P3-PRAYER-15 | low | 3 | P3-PRAYER-16 | low | 3 |
| P3-PRAYER-17 | high | 0d | P3-PRAYER-18 | medium | 0d | P3-PRAYER-19 | medium | 3 |
| P3-PRAYER-20 | medium | 3 | P3-PRAYER-21 | low | 3 | P3-PRAYER-22 | low | 3 |
| P3-PRAYER-23 | low | 3 | P3-PRAYER-24 | low | 0g | P3-PRAYER-25 | low | 2b |
| P3-PRAYER-26 | low | 3 | P3-TALLY-01 | critical | 0f | P3-TALLY-02 | critical | 0b |
| P3-TALLY-03 | critical (ptr) | 0b | P3-TALLY-04 | low | 11 | P3-TALLY-05 | critical | 0c |
| P3-TALLY-06 | medium | 0b | P3-TALLY-07 | medium | 0b | P3-TALLY-08 | low | 11 |
| P3-TALLY-09 | low | 11 | P3-TIMER-01 | medium | 0b | P3-TIMER-02 | low | 6 |
| P3-TIMER-03 | low | 6 | P3-TIMER-04 | low | 6 | P3-TIMER-05 | low | 6 |
| P3-VERSES-01 | critical (ptr) | 0e | P3-VERSES-02 | critical | 0e | P3-VERSES-03 | critical | 0b |
| P3-VERSES-04 | medium | 0b | P3-VERSES-05 | medium | 5 | P3-VERSES-06 | medium | 5 |
| P3-VERSES-07 | low | 0b | P3-VERSES-08 | low | 5 | P3-VERSES-09 | low | 0b |
| P3-VERSES-10 | low | 5 | P3-VERSES-11 | medium | 5 | P3-VERSES-12 | low | 5 |
| P3-VERSES-13 | low | 5 | P3-VERSES-14 | low | 5 | P4-ACCENT-01 | medium | 1 |
| P4-ACCENT-02 | medium (ptr) | 1 | P4-ACCENT-03 | medium (ptr) | 1 | P4-ACCENT-04 | low | 1 |
| P4-ACCENT-05 | low | 1 | P4-ACCENT-06 | low | 10 | P4-COLOR-01 | medium | 1 |
| P4-COLOR-02 | medium | 1 | P4-COLOR-03 | medium | 1 | P4-COLOR-04 | low | 1 |
| P4-COLOR-05 | low | 1 | P4-COLOR-06 | low | 1 | P4-DARK-01 | medium (ptr) | 1 |
| P4-DARK-02 | medium | 1 | P4-DARK-03 | low (ptr) | 1 | P4-DARK-04 | low | 1 |
| P4-GLASS-01 | low | 1 | P4-GLASS-02 | low | 1 | P4-GLASS-03 | low | 1 |
| P4-GLASS-04 | low | 2c | P4-GLASS-05 | low | 11 | P4-ICON-01 | medium | 1 |
| P4-ICON-02 | low | 1 | P4-ICON-03 | low | 1 | P4-ICON-04 | low | 10 |
| P4-ICON-05 | low | 1 | P4-MOTION-01 | low | 2a | P4-MOTION-02 | low | 2a |
| P4-MOTION-03 | low | 10 | P4-MOTION-04 | low | 1 | P4-SHAPE-01 | low | 1 |
| P4-SHAPE-02 | low | 3 | P4-SHAPE-03 | low | 10 | P4-SHAPE-04 | low | 1 |
| P4-TELL-01 | medium | 1 | P4-TELL-02 | low | 1 | P4-TELL-03 | low | 1 |
| P4-TELL-04 | low | 1 | P4-TELL-05 | low | 9 | P4-TELL-06 | low | 1 |
| P4-TELL-07 | medium | 1 | P4-TOK-01 | low | 1 | P4-TOK-02 | low | 1 |
| P4-TYPE-01 | low | 9 | PWA-GAP-1 | medium | 6 | PWA-GAP-2 | low | 2b |
| PWA-GAP-3 | low | 2a | PWA-GAP-4 | low | 2b | PWA-UX-1 | low (ptr) | 2b |
| PWA-UX-2 | low | 2b | PWA-UX-3 | low (ptr) | 2a | PWA-UX-4 | low | 2a |
| PWA-VIS-1 | low (ptr) | 2a | PWA-VIS-2 | low (ptr) | 2a | PWA-VIS-3 | low (ptr) | 2a |
| PWA-VIS-4 | low | 2c | UX-CHAT-01 | medium | 2a | UX-CHAT-02 | low | 2a |
| UX-CHAT-03 | low | 2a | UX-CHAT-04 | low | 2a | UX-CHAT-05 | low | 2a |
| UX-CHAT-06 | low | 2a | UX-CHAT-07 | low | 2a | UX-DOLLYWOOD-1 | low | 9 |
| UX-DOLLYWOOD-2 | medium | 9 | UX-DOLLYWOOD-3 | low | 9 | UX-DOLLYWOOD-4 | medium | 9 |
| UX-DOLLYWOOD-5 | medium | 0b | UX-DOLLYWOOD-6 | low (ptr) | 2a | UX-DOLLYWOOD-7 | low | 9 |
| UX-DOLLYWOOD-8 | low | 9 | UX-DOLLYWOOD-9 | low | 9 | UX-DOLLYWOOD-10 | low | 1 |
| UX-DOLLYWOOD-11 | low | 9 | UX-DOLLYWOOD-12 | low | 9 | UX-DOLLYWOOD-13 | low | 9 |
| UX-DOLLYWOOD-14 | info | 9 | UX-DOLLYWOOD-LIVE-1 | low | 10 | UX-DOLLYWOOD-LIVE-2 | low | 10 |
| UX-DOLLYWOOD-LIVE-3 | low | 0b | UX-DOLLYWOOD-LIVE-4 | low | 10 | UX-DOLLYWOOD-LIVE-5 | low | 10 |
| UX-DOLLYWOOD-LIVE-6 | low | 10 | UX-DOLLYWOOD-LIVE-7 | low | 10 | UX-F260-1 | low | 4 |
| UX-F260-2 | low | 4 | UX-F260-3 | low | 4 | UX-F260-4 | low | 4 |
| UX-F260-5 | low | 0b | UX-F260-6 | low | 4 | UX-F260-7 | low | 4 |
| UX-F260-8 | low | 4 | UX-F260-9 | low | 4 | UX-F260-10 | low | 4 |
| UX-F260-11 | low | 4 | UX-F260-12 | low | 1 | UX-F260-13 | low | 4 |
| UX-F260-14 | low | 4 | UX-HOME-1 | medium | 2a | UX-HOME-2 | low | 2c |
| UX-HOME-3 | low | 2a | UX-HOME-4 | low | 2a | UX-HOME-5 | low | 2a |
| UX-HOME-6 | low | 2a | UX-HOME-7 | low | 2a | UX-HOME-8 | medium | 2a |
| UX-KIDVERSE-1 | low | 7 | UX-KIDVERSE-2 | medium | 7 | UX-KIDVERSE-3 | low | 0d |
| UX-KIDVERSE-4 | low | 7 | UX-KIDVERSE-5 | low | 7 | UX-KIDVERSE-6 | low | 0b |
| UX-KIDVERSE-7 | low (ptr) | 2a | UX-KIDVERSE-8 | low | 1 | UX-KIDVERSE-9 | low | 7 |
| UX-KIDVERSE-10 | low | 7 | UX-LEFTOVERS-1 | medium | 0h | UX-LEFTOVERS-2 | medium | 0h |
| UX-LEFTOVERS-3 | low | 8 | UX-LEFTOVERS-4 | low | 8 | UX-LEFTOVERS-5 | low | 8 |
| UX-LEFTOVERS-6 | low | 8 | UX-LEFTOVERS-7 | low (ptr) | 2a | UX-LEFTOVERS-8 | low | 8 |
| UX-LEFTOVERS-9 | low | 8 | UX-PRAYER-1 | low | 3 | UX-PRAYER-2 | medium | 3 |
| UX-PRAYER-3 | low | 3 | UX-PRAYER-4 | medium | 3 | UX-PRAYER-5 | low | 3 |
| UX-PRAYER-6 | low | 3 | UX-PRAYER-7 | low | 3 | UX-PRAYER-8 | low | 0b |
| UX-PRAYER-9 | low | 3 | UX-PRAYER-10 | low | 3 | UX-PRAYER-11 | low | 3 |
| UX-PRAYER-12 | low | 3 | UX-PRAYER-13 | low | 3 | UX-PRAYER-14 | low | 3 |
| UX-PROF-a1 | low | 2a | UX-PROF-a2 | low | 2c | UX-PROF-a3 | low | 2a |
| UX-PROF-a4 | low | 2a | UX-PROF-a5 | low | 2a | UX-PROF-a6 | low | 0c |
| UX-PROF-a7 | low | 0d | UX-PROF-a8 | low | 2a | UX-PROF-a9 | low | 2a |
| UX-SYNC-a1 | medium | 2a | UX-SYNC-a2 | low | 2c | UX-TALLY-1 | medium | 11 |
| UX-TALLY-2 | low (ptr) | 0b | UX-TALLY-3 | low | 11 | UX-TALLY-4 | low | 11 |
| UX-TALLY-5 | low | 11 | UX-TALLY-6 | low (ptr) | 11 | UX-TIMER-1 | medium | 6 |
| UX-TIMER-2 | medium | 6 | UX-TIMER-3 | medium | 6 | UX-TIMER-4 | low | 6 |
| UX-TIMER-5 | low | 6 | UX-TIMER-6 | low | 6 | UX-TIMER-7 | low | 6 |
| UX-TIMER-8 | low (ptr) | 2a | UX-TIMER-9 | low (ptr) | 0b | UX-TIMER-10 | low | 6 |
| UX-VERSES-1 | medium | 5 | UX-VERSES-2 | low | 5 | UX-VERSES-3 | low (ptr) | 5 |
| UX-VERSES-4 | low | 5 | UX-VERSES-5 | low | 0b | UX-VERSES-6 | low | 1 |
| UX-VERSES-7 | low | 1 | UX-VERSES-8 | low | 5 | UX-VERSES-9 | low | 5 |
| VIS-ACCENT-1 | low | 1 | VIS-COLOR-1 | low | 1 | VIS-DARK-1 | low | 1 |
| VIS-DOLLYWOOD-1 | medium | 9 | VIS-DOLLYWOOD-2 | medium | 9 | VIS-DOLLYWOOD-3 | low | 1 |
| VIS-DOLLYWOOD-4 | low | 9 | VIS-DOLLYWOOD-5 | low | 1 | VIS-DOLLYWOOD-6 | low | 9 |
| VIS-DOLLYWOOD-7 | low | 1 | VIS-DOLLYWOOD-8 | low | 9 | VIS-DOLLYWOOD-9 | low | 9 |
| VIS-DOLLYWOOD-10 | low | 9 | VIS-DOLLYWOOD-11 | low | 9 | VIS-DOLLYWOOD-12 | low | 1 |
| VIS-DOLLYWOOD-13 | low | 9 | VIS-DOLLYWOOD-14 | low | 9 | VIS-DOLLYWOOD-15 | low | 9 |
| VIS-DOLLYWOOD-16 | low | 9 | VIS-DOLLYWOOD-17 | low | 9 | VIS-DOLLYWOOD-LIVE-1 | medium | 10 |
| VIS-DOLLYWOOD-LIVE-2 | low | 10 | VIS-DOLLYWOOD-LIVE-3 | low | 10 | VIS-DOLLYWOOD-LIVE-4 | low | 10 |
| VIS-DOLLYWOOD-LIVE-5 | low | 10 | VIS-DOLLYWOOD-LIVE-6 | low | 10 | VIS-DOLLYWOOD-LIVE-7 | low | 1 |
| VIS-DOLLYWOOD-LIVE-8 | low | 10 | VIS-DOLLYWOOD-LIVE-9 | low | 10 | VIS-DOLLYWOOD-LIVE-10 | low | 10 |
| VIS-DOLLYWOOD-LIVE-11 | low | 10 | VIS-DOLLYWOOD-LIVE-12 | low | 10 | VIS-DOLLYWOOD-LIVE-13 | low | 10 |
| VIS-F260-1 | medium | 1 | VIS-F260-2 | low | 1 | VIS-F260-3 | low | 4 |
| VIS-F260-4 | low | 4 | VIS-F260-5 | low | 4 | VIS-F260-6 | low | 4 |
| VIS-F260-7 | low | 4 | VIS-F260-8 | low | 4 | VIS-F260-9 | low | 4 |
| VIS-F260-10 | low | 1 | VIS-F260-11 | low | 1 | VIS-F260-12 | low | 4 |
| VIS-F260-13 | low | 4 | VIS-F260-14 | low | 1 | VIS-F260-15 | low | 4 |
| VIS-F260-16 | info | 1 | VIS-GLASS-1 | low | 1 | VIS-GLASS-2 | low | 2a |
| VIS-HOME-1 | low | 2a | VIS-HOME-2 | low | 2a | VIS-HOME-3 | low | 2a |
| VIS-ICON-1 | low | 1 | VIS-KIDVERSE-1 | low | 1 | VIS-KIDVERSE-2 | low | 1 |
| VIS-KIDVERSE-3 | low | 1 | VIS-KIDVERSE-4 | low (ptr) | 1 | VIS-KIDVERSE-5 | low | 7 |
| VIS-KIDVERSE-6 | low | 1 | VIS-KIDVERSE-7 | low | 1 | VIS-KIDVERSE-8 | low | 1 |
| VIS-KIDVERSE-9 | low | 7 | VIS-KIDVERSE-10 | low | 1 | VIS-KIDVERSE-11 | low | 7 |
| VIS-LEFTOVERS-1 | low | 0b | VIS-LEFTOVERS-2 | low | 1 | VIS-LEFTOVERS-3 | low | 1 |
| VIS-LEFTOVERS-4 | low | 8 | VIS-LEFTOVERS-5 | low | 8 | VIS-LEFTOVERS-6 | low | 8 |
| VIS-LEFTOVERS-7 | low | 1 | VIS-LEFTOVERS-8 | low | 8 | VIS-LEFTOVERS-9 | low | 8 |
| VIS-LEFTOVERS-10 | low | 1 | VIS-LEFTOVERS-11 | low | 8 | VIS-PRAYER-1 | medium | 1 |
| VIS-PRAYER-2 | low | 3 | VIS-PRAYER-3 | low | 3 | VIS-PRAYER-4 | low | 1 |
| VIS-PRAYER-5 | low | 3 | VIS-PRAYER-6 | low | 3 | VIS-PRAYER-7 | low | 1 |
| VIS-PRAYER-8 | low | 3 | VIS-PRAYER-9 | low | 3 | VIS-PRAYER-10 | low | 1 |
| VIS-PRAYER-11 | low | 3 | VIS-PROF-a1 | low | 1 | VIS-SHAPE-1 | low | 1 |
| VIS-SHAPE-2 | low | 1 | VIS-SHAPE-3 | low | 9 | VIS-SHAPE-4 | low (ptr) | 3 |
| VIS-TALLY-1 | low | 1 | VIS-TALLY-2 | low | 11 | VIS-TALLY-3 | low | 1 |
| VIS-TALLY-4 | low | 11 | VIS-TALLY-5 | low | 1 | VIS-TALLY-6 | low | 11 |
| VIS-TALLY-7 | low | 1 | VIS-TALLY-8 | low | 11 | VIS-TALLY-9 | low | 1 |
| VIS-TALLY-10 | low | 11 | VIS-TALLY-11 | info | 1 | VIS-TELL-1 | low | 9 |
| VIS-TIMER-1 | low | 6 | VIS-TIMER-2 | low | 6 | VIS-TIMER-3 | low | 1 |
| VIS-TIMER-4 | low | 6 | VIS-TIMER-5 | low | 2a | VIS-TIMER-6 | low | 1 |
| VIS-TIMER-7 | low | 1 | VIS-TYPE-1 | medium | 2c | VIS-TYPE-2 | low | 9 |
| VIS-VERSES-1 | low | 5 | VIS-VERSES-2 | low | 1 | VIS-VERSES-3 | low | 1 |
| VIS-VERSES-4 | low | 1 | VIS-VERSES-5 | low | 1 | VIS-VERSES-6 | info | 5 |
| VIS-VERSES-7 | low | 1 |  | |  |  | |  |

Household work: KITCHEN-1 → 0d, KITCHEN-2 → 2a.

## What this report does not list

- **89 positive items** (`OK-*`): what works, kept in their reports as the baseline Phase 6 must not break.
- **1 item the household cut**: GAP-DOLLYWOOD-2, No shared, read-only view of a build (`audits/03-apps/dollywood.md:775`; cut at `audits/05-decisions.md:95`). Not planned; not to be proposed again.
- **Refuted claims** (each report's "Checked and not a bug") and **unresolved questions** (each report's "Unresolved"): they are not findings. The unresolved ones are device checks or data questions; they are gathered under "Device checks" below.
- **The Phase 2 shell deviation tables** (`audits/02-shell.md:5747`, "Deviations from the house style") carry no IDs; Phase 4 measured the same deviations system-wide and filed them as the `P4-*`, `VIS-*`, `CONS-*` and `GAP-*` entries of batch 1, which close them.
- **The Phase 1 leads** (`audits/01-leads.md`) were all confirmed, refuted or narrowed in Phases 2 and 3 (each report's "Leads" table); a confirmed lead is a finding above under its Phase 2 or 3 ID.

## Device checks

The local rig cannot show real Liquid Glass blur, SF Pro and SF Pro Rounded, touch and long-press, Home Screen chrome and safe areas, push through Apple's service, wake lock on iPadOS, real speech, or iOS audio policy (`audits/01-capture.md:103`, §3; the manual checks at `audits/01-capture.md:122`, §4). Each report's "Not verified" or "Unresolved" section names its own: `audits/02-shell.md` per section, `audits/03-apps/<id>.md` "Not verified", `audits/04-design-system.md` "Not verified". Phase 6 marks any fix that depends on one of them NEEDS DEVICE CHECK until it has been seen on the Kitchen iPad, an iPhone and the TV.

## Scripts and evidence

- `audits/tools/phase5/catalog.mjs` → `audits/evidence/p5/catalog.json` (712 items: every finding and positive of Phases 2-4, with its source line).
- `audits/tools/phase5/remedies.mjs` → `audits/evidence/p5/remedies.json` (172 Phase 3 improvements, 127 Phase 4 gap rows, with the IDs each names).
- `audits/evidence/p5/registers.json` (the three registers' severities, parsed).
- `audits/tools/phase5/fixes-shell.mjs`, `fixes-reading.mjs`, `fixes-home-apps.mjs`, `fixes-dollywood.mjs`, `fixes-system.mjs` (the fix, effort and batch of every finding) and `plan-batches.mjs` (the batches, the household work `WORK` and the cut list `CUT`).
- `audits/tools/phase5/build-findings.mjs` (this file).
- Step 3: `audits/tools/phase5/ux-verify/targets.mjs` (the high and medium UX/VIS/CONS/GAP items → `audits/evidence/p5/ux-verify/targets.json` and `items/<ID>.md`), `ux-verify/verdicts.mjs` (the workflow result → `verdicts.json` and `verdicts.md`), the skeptics' scripts in `audits/tools/phase5/ux-verify/<ID>/` and their outputs in `audits/evidence/p5/ux-verify/<ID>/`.
- The design preview: `audits/design-preview.html` (its before images in `audits/design-preview-assets/`, made by `audits/tools/phase5/preview-assets.mjs`), its capture area `audits/tools/areas/preview.mjs`, the captures in `audits/screens-preview/`, `audits/tools/phase5/preview-sheets.mjs` (contact sheets without touching `audits/01-capture.md`) and `audits/tools/phase5/preview-check.mjs` (the two-engine check).
