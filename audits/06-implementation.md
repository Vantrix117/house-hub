# House Hub audit, Phase 6: implementation record

One section per batch, in the order of the plan (`audits/05-findings.md`, "The plan"). Each section gives the change, the commit, the reruns of each finding's own reproduction, the capture-rig recapture against the Phase 1 baseline, the rubric rescore, the repo tests, and what was not verified (constitution, Phase 6). The status of every finding is carried into `audits/05-findings.md` from `audits/tools/phase6/status.mjs` by `node audits/tools/phase5/build-findings.mjs`.

Nothing is pushed: the batches sit on `main` locally until the household says to deploy, so none of them is live on https://vantrix117.github.io/house-hub/ yet.

## Batch 0a — The hub boots with Reduce Motion on

| | |
|---|---|
| **Findings** | P2-STAB-01 (critical) and its pointer P2-VIS-01: both FIXED |
| **Code commit** | `ae274a6` (2026-09-26) |
| **Files** | `apps/hub.js:442` (one line added), `index.html:662` (one line changed), `sw.js` (VERSION `hub-v27` → `hub-v28` by `node scripts/bump-sw.mjs`, so installed PWAs pick up the new shell) |
| **Schema / data** | None. No backup was needed; the production database was not touched. |

### The change

Under `prefers-reduced-motion: reduce`, hub.js left its sheen block before it defined `hub.sheenFrom`, and the shell's boot called `hub.sheenFrom(views)` unguarded, so the boot threw and every device with Reduce Motion on showed a blank page, the pairing screen included (`audits/02-shell.md:3097`).

- `apps/hub.js:442`: `hub.sheenFrom = () => {};` now runs first in the sheen block, before the reduced-motion return. With motion allowed, line 448 replaces it with the real function exactly as before.
- `index.html:662`: `if (typeof hub.sheenFrom === 'function') hub.sheenFrom(views);`, so an older cached hub.js cannot blank the shell either.

### Each finding's reproduction, rerun

The baseline evidence in `audits/evidence/p2/` is left as it was (the scripts write there; their outputs were moved to `audits/evidence/p6/0a/` and the Phase 2 files restored).

| Script | Before (Phase 2) | After |
|---|---|---|
| `node audits/tools/phase2/STAB/reduced-motion.mjs` | reduce: `shellHidden=true`, gate hidden, `sheenFrom` undefined, a TypeError, on iPad, TV and iPhone | reduce: iPad (Eli) and TV (kiosk) show the shell, iPhone (signed out) shows the picker; `sheenFrom=function`, 0 errors, all 6 cases → `audits/evidence/p6/0a/STAB/reduced-motion.json` |
| `node audits/tools/phase2/VIS/verify-reduced-motion-blank-shell-2.mjs` (the batch's named check) | all 7 cases with the setting on at load were blank (shell and gate both hidden, one `TypeError: hub.sheenFrom is not a function` each); the setting switched on after load, Tally on its own and the controls were fine | all 11 cases boot: WebKit iPad/iPhone Eli, Ezra (kid), TV kiosk → shell shown; signed out and unpaired iPad → gate shown with the picker / pairing form; Reduce Motion switched on after load; Tally opened on its own; Chromium desktop, reduce and control; 0 page errors in any → `audits/evidence/p6/0a/VIS/verify-rm2.json` |
| `node audits/tools/phase2/VIS/density-motion.mjs` (last block) | `Reduce Motion reduce: shellHidden true` | `{"gateHidden":true,"shellHidden":false,"sheenFrom":"function","matches":true,"errors":[]}` → `audits/evidence/p6/0a/VIS/density-motion.json`; the density figures above it are unchanged |

After-screenshots: `audits/evidence/p6/0a/VIS/verify-rm2-webkit-iphone-eli-reduce.png` (Home on the iPhone), `verify-rm2-webkit-ipad-unpaired-reduce.png` (the pairing form), `verify-rm2-webkit-tv-kiosk-reduce.png` (the TV board), `verify-rm2-webkit-ipad-ezra-reduce.png` (kid Home), and the rest of `audits/evidence/p6/0a/`.

**Same page with the setting on or off.** `node audits/tools/lib/pxdiff.mjs` over four pairs of after-screenshots (Reduce Motion off vs on: the STAB iPad pair, the skeptic's WebKit iPad and Chromium desktop pairs, the density iPad pair): 4 compared, 0 changed beyond tolerance 48. The only difference the setting makes now is the sheen that no longer drifts, which the tolerance absorbs.

### Capture rig

hub.js and index.html load on every screen, so the whole matrix was recaptured: `node audits/tools/capture.mjs --out audits/screens-after/0a` → 4447 ok, 0 failed (`audits/screens-after/0a/manifest.json`; the PNGs are git-ignored like the baseline's).

- **Against the Phase 1 baseline** (`audits/screens/`): 4302 of 4447 byte-identical (`lib/compare.mjs`); `lib/pxdiff.mjs` finds 71 changed beyond tolerance 48, 34 of them under 200 pixels (`audits/evidence/p6/0a/capture/compare-baseline-after.txt`, `pxdiff-baseline-after.txt`).
- **Why none of the 71 comes from this batch.** The rig renders with `reducedMotion: 'no-preference'` (`audits/tools/lib/devices.mjs:33`), and on that path the batch changes nothing that runs: `hub.sheenFrom` is set to a no-op and then, as before, to the real function, and the new guard at `index.html:662` is always true. To test it, the 452 captures of the 7 areas' screens behind the 71 (28 screen-states, every state, device and mode) were taken again with the fix stashed, the pre-batch code (`audits/screens-after/0a-control/`). That control differs from the baseline in 57 of 452 (`pxdiff-baseline-control.txt`) and from the fixed run in 39 (`pxdiff-control-after.txt`), on the same screens and with different files flipping each run. So these screens do not capture the same way twice, whatever the code. Of the 71, 48 also changed under the pre-batch code, and 18 more are other devices or modes of screens that flipped under it. The last 5 captures (2 screens) were taken a third time with the fix (`audits/screens-after/0a-repeat/`, `pxdiff-baseline-repeat.txt`): `shell/pin-create-typical` now matches the baseline, and `prayer/today-lower-overflow` is the same list scrolled 25 px further, the same scroll-settling flake as Prayer's other overflow screens.
- **What the flakes are**, from the images: Prayer's long pages (faces, record review, lower Today) captured at a different scroll offset; the pairing-form input with or without its focus ring (autofocus timing); F260's week-complete and reflections at a different moment of their entrance; the park map's search sheet mid-transition; a few pixels of text antialiasing. The rig is deterministic for 4302+ captures, not for these 28 screen-states; later batches should compare them against a second baseline run rather than read their diffs as changes.
- **Reduce Motion captures.** The rig has no Reduce Motion state, so the fixed screens themselves are shown by the reruns above, not by the rig.

### Rubric rescore

The Phase 2-4 rubric scores were taken with Reduce Motion off, the rig's default, so no captured score depended on this bug. With Reduce Motion on, the shell scored nothing before (a blank page, unusable on every device) and now renders the same as with it off (the pixel comparison above), so it takes the shell's existing scores (`audits/04-design-system.md`, scorecard: shell 4.1). No other score changes in this batch.

### Repo tests

| Test | Result |
|---|---|
| `node scripts/test-design.mjs` (includes the reduced-motion case) | 49 passed, 0 failed |
| `node scripts/test-hub.mjs <local code>` against a fresh local D1 (schema + seed, a throwaway local pairing code) | 19 passed, 3 failed, **identical to the baseline**: the same test on the pre-batch code (HEAD `3cad8d8`, its own fresh D1) gives the same 19/3 line for line. The 3 failures predate this batch and are stale test expectations: `signed in as Niece` (the profile is now named Mea), `reminder shows on A at once` and the kiosk reminder wait that follows it. They are not fixed here; they belong with the shell's tests in batch 2a. |
| `node scripts/bump-sw.mjs --check` | 74 precached files present, 67 shipped files accounted for |

There is no build step (CLAUDE.md). The test runs overwrite tracked screenshots in `docs/screens/`; those were restored, so the batch commit carries none of them.

### Not verified

- **A real device with Reduce Motion on.** The fix was proved in Playwright WebKit and Chromium with `prefers-reduced-motion` emulated. It was not seen on the Kitchen iPad, an iPhone or the TV with the iOS setting on; that is a device check, and the fix does not depend on anything the emulation cannot show.
- **The live site.** Nothing is pushed, so production still has the bug until the household deploys. After a push, the service worker's new VERSION (`hub-v28`) is what makes an installed PWA fetch the fixed shell.
- **Other callers.** `hub.sheenFrom` has no other callers in the repo (`index.html:662` is the only one outside hub.js), so nothing else needed the guard. The Dollywood exports were not rebuilt and do not call it.

## Batch 0b — SDK: no write before the first load, safe migration, one household day

| | |
|---|---|
| **Findings** | 45 entries (36 counted once + 9 pointers): 10 critical, 1 high, 7 medium, 18 low primaries. All 45 FIXED (status per entry in `audits/05-findings.md`). |
| **Code commit** | `d968db8` (2026-09-26); the Dollywood template change is committed in the sibling repo `../dollywood-build-project` as `67cafc5` |
| **Files** | `apps/hub.js`, `index.html`, `worker/src/chat.js`, `apps/f260.html`, `apps/prayer.html`, `apps/kidverse.html`, `apps/verses.html`, `apps/tally.html`, `apps/timer.html`, `apps/leftovers.html`, `apps/dollywood.html` + `apps/dollywood-live.html` (exported from `../dollywood-build-project/scripts/template.html`: rebuilt with `build_html.py hub` / `live`, `verify.py` passed, `export_hub.py`), `sw.js` (`hub-v28` → `hub-v29`) |
| **Schema / data** | No schema change. Production D1 exported first, as the plan asks: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-26-before-0b.sql` (35 KB, 11 tables, 43 app_data rows; outside the repo, as it holds session tokens). Nothing was deployed, so production was not written. |
| **How it was built** | The SDK, shell and Worker by the orchestrator; one agent per app (Prayer, F260, Kid Verse, Verses, Tally + Timer, Larder, the Dollywood template) against a shared brief; an independent review of the whole diff (no high findings; its real ones were fixed, below); then every check rerun by the orchestrator on the final code. |

### The change

**The SDK (`apps/hub.js`).**
- `hub.isLoaded(app?, scope?)` / `hub.loaded()`: a channel is loaded once a pull of it has completed on this device (its cache carries the server's `since`); the shell's pull counts for an app frame (shared localStorage). `hub.ready()` now waits (up to 6 s, as before) on the app's *own* channels, not on whatever channel the shell happened to cache (the root of P2-SYNC-02).
- `hub.set` / `hub.remove` on a channel that has not loaded throw `not_loaded` with a "Still loading" toast: a value computed from an empty cache can no longer overwrite the real row under last-write-wins. `{ unloaded: true }` bypasses it for values that depend on nothing stored (the theme choice uses it).
- `hub.migrate` is async: it waits for the scope to load and then a fresh successful pull, writes only keys the server lacks, skips guests (`hub.profile.isGuest`, which the SDK used to drop) and non-adults, and fires a change event so the app repaints.
- `hub.today()` (America/New_York, as the Worker and the 8 am / 8 pm jobs), `hub.daysBetween`, `hub.addDays` (calendar days, DST-proof), `hub.onDay(fn)` (the household midnight: checked every 20 s, on focus, visibility and pageshow).
- `hub.sync.state` starts `pending`, not `offline`.
- Channels pull in parallel, so a slow network no longer multiplies every loading state by the number of channels; a channel declared mid-pull (the TV's family prayer list) is pulled in the same round.

**The shell (`index.html`).** Every household date is New York's (prayer streak and today, the TV's "who prayed" and "who read", the kids' stars week, leftover ages). Home reads "read today" and the F260 streak from the synced `f260.log` with F260's own two-rest-day rule, not from a summary that may be days old. Home cards, the kids' star cards and the TV panes show skeletons or "Loading…" until their channel has pulled — never "Nothing here", "No one yet" or ★0. Home re-renders at the household midnight (not the TV, which repaints its own day each tick). A notification switch flips back if the save is refused.

**The Worker (`worker/src/chat.js`).** `f260_status` reads "read today" and the streak from the log for today's New York date; the chat tick writes `readOn` and the streak computed from the log. (`worker/src/reminders.js` already used the log.) Not deployed: live chat keeps the old behaviour until the Worker is deployed.

**The apps.** Each disables every write until its channels have loaded, shows a loading state instead of fake data, files dates under `hub.today()`, and repaints on `hub.onDay` where the finding asks:
- Prayer: loading state on the adult and kid pages, controls disabled and a capture-phase tap guard until the data exists, writes only after load, legacy migration awaited (capped at 8 s so an offline device still opens from its cache).
- F260: Done disabled "Loading your progress…", stats skeletons; weekStart written only when a week starts; nothing written on open for someone with no F260 data; `readOn` in the summary; the journal vault cannot be re-created over the real one before load; midnight repaint.
- Kid Verse: Done ★, the adult week stepper and "I heard it" disabled until loaded; skeleton art and text of the loaded size (the 368 px jump is 0 for the measured week); household day and an ISO week identical to the shell's; midnight repaint.
- Verses: a skeleton trainer card; ratings and the summary refused until the verses and f260 (and, for kids, kidverse family) channels have pulled; household day; midnight repaint.
- Tally: a skeleton pill instead of 0; +, − and Reset disabled; a 5 s retry after a failed first pull.
- Timer: a skeleton dial instead of "5:00"; Start, Reset and the presets disabled until this page's own pull succeeds — or the device is truly offline with a pulled cache, or the server has been unreachable for 8 s with a pulled cache (a cooking timer must work offline).
- Larder: an entry typed before ready is held and logged once loaded (no reload); labels in the markup; placeholder cards; calendar-day ages; submit re-keys the day; the date box's value and max always agree.
- Build guide / park map (template): "Loading your progress…" with Mark done disabled; the park map says "Loading…", not "offline", and keeps Share and the kids' switches disabled until loaded; migration only after the first load.

**Capture rig (`audits/tools/capture.mjs`).** In the loading state a rig tap is now forced with a 3 s cap, as a finger taps a disabled control; Playwright's actionability wait would otherwise sit on the now-disabled buttons until it timed out. No other state is affected.

### Each finding's reproduction, rerun

All 82 scripts the entries name, plus 7 new checks in `audits/tools/phase6/0b/` (the old scripts click with Playwright's auto-wait, which now waits for the button to be enabled, so the new ones tap with force, like a finger), were rerun by the orchestrator on the final code: 93 runs, three at a time on the local rig, then the 10 shell and TV scripts again after the last SDK change. Outputs: `audits/evidence/p6/0b/` (the scripts write into `audits/evidence/p2|p3/`; those files were moved here and the Phase 2/3 baseline restored byte for byte). Each entry's Status line in `05-findings.md` quotes the observation that flipped.

Seven runs exit non-zero, all for one reason: the script waits to click a control that the fix now keeps disabled until the data arrives, and its hold outlasts Playwright's timeout.
- `phase2/SYNC/verify2-done-during-stalled-pull-1` (stall arm: `#todayDone` disabled "Loading your progress…"), `phase3/kidverse/verify-week-stepper-stalled-overwrite-2` (fail arm: `#week-up` disabled), `phase3/verses/verify-first-open-wipes-log-1`, `-1-kid` and `-2` (offline and kid arms: `#show` disabled), `phase3/dollywood/data-checks` M2 (every pull aborted: the count stays "Loading your progress…"). Each of these modes is covered by a forced-tap check instead — `f260-loading`, `kidverse-first-load` B, `verses-first-open` A/B, `dollywood-first-load` — and all pass.
- `phase2/SYNC/verify-initial-state-offline-2-counterfactual` stops at once by design: it patches the old `hub.js` line 51 back in and refuses when that line has changed.

### Capture rig

The whole matrix was recaptured, because hub.js and index.html load on every screen: `node audits/tools/capture.mjs --out audits/screens-after/0b --parallel 2` → 4447 ok, 0 failed. Home's and the TV's screens were taken again after the last two shell fixes (below) into `audits/screens-after/0b-shell/` (50 captures, 0 failed). The PNGs are git-ignored like the baseline's; the manifests are committed.

- **Against the Phase 1 baseline:** 3873 of 4447 byte-identical; `lib/pxdiff.mjs` finds 433 changed beyond tolerance 48 (`audits/evidence/p6/0b/capture/`).
- **261 are loading states, and they are the point of the batch:** shell 56, Prayer 56, the park map 35, Kid Verse 24, F260 16, Larder 16, Timer 16, Verses 16, the build guide 16, Tally 8, the TV 2, …. Seen after-screens: Prayer adult and kid, Home, Timer, F260, Kid Verse, the TV (all skeletons or "Loading…" with every write control disabled, nothing that looks like real data). The last look caught two leftovers, fixed and recaptured: Home's reading ring said "0/5" and the fridge card said "Log leftovers…" under its skeleton; the TV board said "Verse of the week · Week 1" and "Nothing has happened yet." while loading. Both now read as loading (`audits/screens-after/0b-shell/shell/home-loading-*.png`, `…/tv/board-loading-*.png`); the same shell screens' loaded states are unchanged against the baseline (the 18 differences in that folder are all loading states), and test-home and test-tv pass on that final shell.
- **172 are not loading states**, in 41 screen-states. A control recapture of those screen-states on the pre-batch code (`audits/screens-after/0b-control/`, 562 captures, run from the `git archive` of `ca58373`) sorts them:
  - 54 changed under the pre-batch code too (the same file): the flaky screens batch 0a found (Prayer's long pages, F260 week-complete and reflections, the park map's search sheet, a few pixels of antialiasing). A further 45 are other devices or modes of screen-states that flipped in the control. The remaining 73 are in 15 screen-states, each looked at:
  - Changed by the batch, by design: **Prayer family-reset** — the rig's screen for P2-SYNC-02 — now keeps the family plan "Around the table", 16 days in a row, 20 this month (the baseline showed the reset: "Everything", 0 and 0). **F260's empty and guest screens** no longer say "started Sep 22 · On pace": opening the plan no longer writes a start date (P2-SYNC-05, P3-F260-05). **Larder slow-sync** no longer says "Can't reach the house list" while the pull is merely slow (P2-SYNC-15). **The Apps grid (overflow)**: the F260 tile's streak now comes from the reading log for today.
  - Checked and not the batch: Verses "rated" (desktop; the queue position depends on rig state shared between captures; two fresh captures of it on the batch match the baseline exactly), the first-visit "Hub updated" toast (a documented race in the rig: one fresh capture shows it, another never does), and 1-3 px differences on the pairing, PIN, TV and park-map layer screens (all on batch 0a's flaky list or antialiasing).
- **The rig in the loading state** now forces its taps (above); with that change all 4447 captures succeed, including the loading states that tap a control.

### Rubric rescore

The Phase 3/4 scores rest mostly on the typical state, and the typical screens did not change in this batch (above). What changed is the loading state and what a tap during it can do, which the rubric scores under **Motion & feedback** (does the screen say what is happening) and **Ease of use** (error prevention: Phase 3 §3). The orchestrator's rescore, from the after-captures:

| Area | Motion & feedback | Ease of use | Why |
|---|---|---|---|
| Shell (with the TV) | 2.5 → 3 | 4 → 4 | Home, the kids' cards and the TV show skeletons or "Loading…" instead of false facts; no destructive shell control was exposed before |
| F260 | 3.5 → 4 | 5.5 → 6 | skeleton stats and a disabled "Loading your progress…" Done instead of a live Done over an empty plan that wiped history |
| Larder Ledger | 3 → 3.5 | 3 → 3.5 | placeholder cards and real labels from the first paint; a Log before ready is held, not lost to a reload |
| Prayer | 4 → 4.5 | 4 → 4.5 | a loading state on both pages; the taps that threw or wiped prayed days are disabled until load |
| Tally counter | 4 → 4.5 | 4 → 4.5 | a skeleton pill instead of a fake 0; +/− cannot replace the count |
| Kitchen timer | 4 → 4.5 | 3.5 → 4 | a skeleton dial instead of a fake idle 5:00; Start cannot replace a running timer |
| Dollywood build guide | 2.5 → 3 | 3 → 3.5 | "Loading your progress…" and a disabled Mark done instead of a first-time-user look |
| Dollywood park map | 3.5 → 3.5 | 3 → 3 | "Loading…" instead of "offline" in one header: too small to move a whole score |
| Kid Verse | 4 → 4.5 | 5 → 5.5 | skeletons of the loaded size (no 368 px jump); Done ★, the week stepper and "I heard it" wait for load |
| Verses | 4 → 4.5 | 4 → 4.5 | a skeleton card instead of a blank page; ratings wait for the data |

Averages move accordingly (shell 4.1 → 4.2; apps mean 4.1 → about 4.2); every other dimension is unchanged. These are the orchestrator's own judgements from the after-screens, not a re-run of Phase 4's two-reviewer scoring; the full rescore belongs to batch 1, which changes the visual system itself.

### Repo tests

Every suite that takes a local Worker was run twice, on the pre-batch code (HEAD `ca58373`, exported with `git archive`) and on the batch, each suite on its own fresh copy of a seeded local D1 (schema + seed + a throwaway local pairing code) and its own `wrangler dev`.

| Suite | Before | After |
|---|---|---|
| test-hub | 19 passed, 3 failed (crashes at the reminders step) | 36 passed, 1 failed: the stale "signed in as Niece" (the profile is now named Mea); the reminders steps that crashed before now pass |
| test-f260 | 51 / 0 | 52 / 0 (updated, below) |
| test-prayer | 36 / 0 | 36 / 0 |
| test-prayer-faces | 41 / 0 | 41 / 0 |
| test-kidverse | 51 / 0 | 51 / 0 |
| test-kidstory | 50 / 0 | 50 / 0 |
| test-rewards | 73 / 0 | 73 / 0 |
| test-verses | 80 / 0 | 80 / 0 |
| test-leftovers | 42 / 0 | 42 / 0 |
| test-timer | 45 / 0 | 45 / 0 (a first run failed at sign-in while the capture rig was also running; alone it passes) |
| test-home | 57 / 0 | 57 / 0 (updated, below) |
| test-tv | 43 / 0 | 43 / 0 (node and timer counts constant over 24 h) |
| test-prefs | 17 / 0 | 17 / 0 |
| test-guests | 50 / 0 | 50 / 0 |
| test-dollywood-sync | 32 / 0 | 32 / 0 (after a template fix, below) |
| test-dollywood | 34 / 0 | 34 / 0 |
| test-dollywood-themes | all checks passed | all checks passed |
| test-photos | 27 passed, 1 failed | 28 / 0 |
| test-apps | 48 / 0 | 48 / 0 |

Static checks on the batch: `node scripts/test-design.mjs` was run in 0a and nothing it reads changed; `node handoff/prayer/check.js apps/prayer.html` 49 passed, 0 failed; `node scripts/bump-sw.mjs --check` 74 precached files present, 67 shipped files accounted for; `py verify.py` in the Dollywood repo "JS errors: none", "step checks: all sections OK".

**What the tests caught, and what changed because of them.**
- **test-dollywood-sync found a real regression** (6 failures). The legacy migration now lands after the first paint, so the build guide stayed on the step the migration had just ticked, and "Mark done" there unticked it. The template now moves to the first undone step when a migration ticks the step on screen, as a first open does; rebuilt, `verify.py` clean, exported; the suite passes 32/0 and the Dollywood reproductions were rerun on the new export.
- **test-f260 and test-home asserted the old behaviour** and were updated to the fixed one. test-f260 expected a summary to be written by merely opening the plan (exactly what P3-F260-05 removes): it now asserts no summary on open, the plan's first reading in the hero, and `readOn` = today after the first tick. test-home read Kiara's star card the instant she signed in on a new device, which now correctly shows a skeleton until her row has arrived (P2-HOME-04): it now waits for `hub.isLoaded('kidverse', 'person')`. Both files are in `scripts/`, changed in the code commit.
- The tests overwrite tracked screenshots in `docs/screens/`; those were restored.

### Not verified, and known limits

- **Real devices.** Loading states, the midnight repaint on a sleeping iPad, and the skeletons under Reduce Motion were seen only in Playwright WebKit and Chromium with emulated clocks, zones and network holds.
- **The live site and the live Worker.** Nothing is pushed or deployed; the fixes reach the family only when the batches are deployed.
- **Loading waits for the network.** After a failed first pull an app stays on its loading state until the next pull (the SDK's 30 s poll or a refocus; Tally and Timer retry after 5 s). That is the trade this batch makes: honest waiting instead of an empty screen that invites a destructive tap.
- **A tap in the moment before a legacy migration.** Migration now waits for one fresh pull after load; a write the person makes in that second or two (a tick in F260, a new passcode) makes the migration see the key as present and skip it. Only devices that still hold pre-profiles data and have never migrated are exposed.
- **An offline Timer start from a stale cache** replaces a timer started meanwhile on another device when the queue flushes (UX-TIMER-8, batch 6).
- **Found, not in this batch.** The park map flavour also runs the build guide's legacy migration, so it could copy old build progress into `dollywood-live` person scope (pre-existing; offered as a separate task). P3-PRAYER-05 (the shared `lastPrayedAt` toggle) shows in `verify-other-timezone-date-2`'s east arm and stays in batch 0g.
