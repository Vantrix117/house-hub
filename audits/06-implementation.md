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

## Batch 0c — SDK and shell: queued writes are never dropped, switching is clean

| | |
|---|---|
| **Findings** | 24 entries (19 primaries + 5 pointers): 8 critical, 1 high, 2 medium, 8 low primaries. All 24 FIXED (status per entry in `audits/05-findings.md`). |
| **Code commit** | `e9e5f59` (2026-09-26) |
| **Files** | `apps/hub.js`, `index.html`, `apps/prayer.html` (the restore message only), `worker/src/data.js`, `worker/src/index.js`, `worker/README.md`, `CLAUDE.md`, `sw.js` (`hub-v29` → `hub-v30`) |
| **Schema / data** | No schema change. The production D1 was exported first, as the plan asks: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-26-before-0c.sql` (35 KB, 11 tables, 43 app_data rows). No row is stamped in the future, so the new 30 s clamp meets no existing row. The file is kept outside the repo because it holds session tokens. Nothing was deployed, so production was not written. |
| **How it was built** | By the orchestrator. An independent review of the whole diff found 1 high, 1 medium and 4 low issues; all were real and all were fixed (below). Every check was then rerun on the final code. |

### The change

**Queues (P2-PROF-02, P2-SYNC-07, P2-PROF-01, P3-TALLY-05, P2-SYNC-06).**
- **Every write queue belongs to the person who wrote it**, family scope included: `hub.queue.<app>.<scope>.<profile>`.
  - Only that person's own session ever sends it. So the display can neither send nor empty an adult's queue.
  - A queue in the old unowned form (`hub.queue.<app>.family`) is taken over by the next household writer, never by the display.
- **`flush()` sends every queue of the signed-in person found on the device**, not only the channels its own window syncs. So the shell sends Tally's taps after Tally closes.
- **Every page also hands its queue to a `keepalive` request on `pagehide`.** The queue stays until an answer is seen, so the next flush confirms it.
- **Requests carry at most 200 rows** and loop until the queue is empty.
- **A request the Worker refuses because of a row** (`bad_key`, `value_too_large`, `bad_batch`) is retried row by row.
  - Only the refused row is dropped, with a toast: "1 change could not be saved to the house …".
  - Every other refusal keeps the queue and retries.
- **Prayer's restore now reports what the house answered**, not "Backup restored.".

**Switch (P2-PROF-02, P2-SEC-03, P2-PROF-15, P2-SYNC-09, P2-SYNC-11, P2-SYNC-04, UX-PROF-a6).**
- **Sign-out.** `hub.signOut()` keeps the person's token in `hub.retiring` and sends their queues and feed lines with it:
  - at once if online;
  - otherwise on reconnect, on the next `ready()` or before the next flush.
  - Only then does it `POST /api/logout`.
  - If the token was already ended, what is left waits under the person's id for their next sign-in on this device.
- **The person's person-scope caches leave the device at once.**
- **`hub.reset()`:**
  - bumps a generation and aborts every request in flight;
  - clears the pull and flush promises;
  - stops the poll, which the next `ready()` re-arms;
  - resets the sync counters.
- **A pull answer for a previous generation or token is discarded.**
- **A 401 signs out only when the failing request carried the current device or profile token.**
- **Themes.** The picker shows the device look (System). Each sign-in applies the person's own theme, taken from the first of:
  - their device mirror `hub.theme.<profile>`;
  - their cached `hub/theme` row;
  - System.
- **Me → Switch lands the next person on Home.**
- **The display's own Switch button now signs the display out too.**

**Clock (P2-PROF-14).**
- **The Worker stores no `updated_at` more than 30 s ahead of its own clock** (`MAX_AHEAD_MS`, was 5 min). It answers with the stamp it stored.
- **hub.js keeps the last server skew (`hub.skew`) across reloads.** A write made offline on a wrong clock is therefore still stamped in server time.
- **After a flush, hub.js adopts the server's stamp.** The server's row also wins over a cached stamp that is ahead of the server's own clock.
- **Me → Sync warns when the clock is more than 5 min out.**

**Feed lines (P2-PWA-06, P2-PWA-13, P2-PWA-14, P2-PROF-07, P2-SYNC-08).**
- **Lines wait in `hub.aqueue.<author>`**, stamped with the time they happened. Only the author's session posts them.
- **The Worker accepts `at`** and files the line at that time. The time is clamped to the past week and never ahead.
- **One drain runs at a time per window.** A claim on the author's queue is respected by both the shell and an app frame. Each line is removed by id once posted.
- **A 401 keeps the line** for the author's next sign-in.
- **A signed-out author's lines are posted before their logout**, which waits for them.

**Forget this device (P2-PROF-19, P2-PROF-13).**
- **Shown to household adults only.**
- **It sends everything first.** While anything is still waiting, it refuses and names whose changes they are:
  - "Not forgotten: 2 changes not yet saved (2 of yours). Try again when this device is online."
  - For a signed-out person's changes the device cannot send: "… Sign in as them once while online, then try again."
- **Otherwise the new `POST /api/device/forget`** (household adults) deletes the device, its sessions and its push subscriptions. The local push subscription is then dropped, and only then is local storage cleared.

**Storage (P2-SYNC-16, GAP-SYNC-a1).**
- **`lsSet` reports a full device.** Other people's caches and the feed copy are removed first.
- **A queue that still cannot be stored stays in memory** and is sent, with a toast.
- **While a queue is memory-only, the stored cache keeps each unsent key's previous value.** A reload therefore never shows an unsent change as if it were saved.
- **The shell calls `navigator.storage.persist()`** after pairing, and once on devices that were paired before.
- **Me → Sync tells an iPhone or iPad Safari tab** to add the hub to the Home Screen.

**One old race, made visible.**
- **The cause.** The shell's `renderGrid` builds its tiles after awaiting the icons, so an older render could finish last and paint the loading grid over the loaded one.
- **Why it matters now.** The new timing made that frequent in the rig: 5 of 8 Apps captures.
- **The fix.** A render now paints only if it is still the newest one (`index.html`). The loaded grid then showed in 4 of 4 debug runs.

**What the independent review changed.**
- **High.** After Switch cleared a person's cache, their unsent value could be missing from the store on their next sign-in. An app could then write its default over it.
  - Queued values are now laid over the store (`loadScope`, `refreshScope`).
  - A flush answer writes the value into a cache that lacks it.
- **Medium.** `retire()` could log a person out while their feed lines were still posting.
  - The logout now waits until the lines are gone.
  - `hub.unsent()` counts feed lines.
  - The drain claim is per window.
- **Low:**
  - `retire()` and `hub.flush()` now pick up work added while they run.
  - Only the Worker's own row errors drop a row.
  - A flush's answer is adopted through `refreshScope`, so the app hears about every change.
  - Prayer's restore waits for a flush that is already running.

**Rig (`audits/tools/capture.mjs`).**
- **The problem.** hub.js now sends on `pagehide`, and the rig closes every capture's page.
  - Some screens keep their writes on the device (F260 `noWrites`, Verses `keepOnDevice`). Those writes landed on the shared rig server when the page closed.
  - The next capture of the group then started from changed data.
  - The first full recapture failed 106 captures that way; 28 of them failed deterministically when rerun.
- **The fix.** The rig now stops that one `pagehide` hand-off in its captures (an init script). Nothing on screen is affected, because a page only hides when the capture closes.
- **The result.** The failing screens then passed (28/28), and the whole matrix was recaptured.

### Each finding's reproduction, rerun

**How they were run.**
- The 24 scripts the entries name, plus 3 new checks in `audits/tools/phase6/0c/`, were run on both:
  - the unchanged code (`git archive` of `2b0d6bd`);
  - the final code.
- Three at a time, 27 runs on each.
- Outputs are in `audits/evidence/p6/0c/`. The scripts write into `audits/evidence/p2|p3/`; the changed files were moved into `p6/0c/p2|p3/` and the Phase 2/3 baseline was restored byte for byte.
- Exit codes: `audits/evidence/p6/0c/tests/repro-exit-codes*.txt`.
- Each entry's Status line in `05-findings.md` quotes the observation that flipped.

**The new checks.**
- **`switch-flush.mjs` (19/19):**
  - Offline writes of four kinds plus a feed line, then Switch, then the TV signs in: all arrive under Eli's token, the old session is ended, and no private cache is left.
  - 201 rows go in two requests.
  - A refused row is dropped alone.
  - The TV keeps polling.
  - The next person lands on Home after Switch.
  - Three overlapping feed lines each post once.
- **`forget-device.mjs` (14/14):**
  - Offline, Forget refuses and keeps the queue.
  - Online, it sends both rows first; then the device, the session and the push subscription are gone.
  - Kids and the display have no button.
- **`prof-14-fastclock.mjs`:** the Phase 2 clock script with one instrumentation change. The original reads the family queue under its old key (`hub.queue.<app>.family`), so it saw an empty queue at once and read the server before the flush.

**Script caveats.**
- **Two Phase 2 scripts stop early now.** One of them already stopped early before this batch.
  - `verify2-forget-device-drops-queue-2` writes the instant the shell shows, which batch 0b refuses until the data has loaded.
  - `verify-forget-leaves-server-rows-2` runs Forget as Ezra, who no longer has the button.
  - `forget-device.mjs` covers both.
- **Two scripts read other old key names** (`hub.activityQueue`, `hub.queue.<app>.family`) in side fields, which now show `queuedAt` 1970 and `queued 0`. Their outcome fields (what reached the server, and under whom) do not depend on it.
- **`verify4-p2-sec-03-2` now really forgets the rig's shared device in its S5b step**, so its later admin calls through that device get 401 (S4b). Those revocations are also measured in `sec-03-1` K, which runs as before.
- **The clock script on the unchanged code** reproduced both halves: Dad's phone kept "David" only, and his update note set the server back to `["David"]`. In the first before-run it hit the lanes' 600 s cap, so it was run again with a longer cap.

### Capture rig

**The runs.**
- Full matrix on the final `hub.js`: `node audits/tools/capture.mjs --out audits/screens-after/0c --parallel 2` → 4447 ok, 0 failed.
- The shell area was recaptured into the same folder after the two last shell fixes (the grid race, the hint's wording): 979 ok, 0 failed.
- The PNGs are git-ignored like the baseline's; the manifest is committed.

**Against the Phase 1 baseline.**
- 3846 of 4447 are byte-identical.
- `lib/pxdiff.mjs` finds 452 changed beyond tolerance 48 (`audits/evidence/p6/0c/capture/pxdiff-baseline-vs-0c.txt`). Almost all of them are batch 0b's loading states and its known flaky screens.

**Against batch 0b's after-capture** (the fair comparison for this batch):
- 100 files changed (`pxdiff-0b-vs-0c*.txt`). This is with 0b's own late shell fixes (`0b-shell`) laid over it.
- A control recapture on the pre-batch code sorts them: every screen-state involved, 412 captures, in `audits/screens-after/0c-control/`.
- **Flaky, not this batch:** 50 of the files and 12 of the screen-states change under the pre-batch code too. These are batch 0a's flaky list (Prayer's long pages; F260 week-complete, reflections and journal; the park map's search sheet; the first-visit toast) plus antialiasing.
- **Changed by design:**
  - The kid's Me screen no longer has "Forget this device".
  - The iPhone Safari Me screens (sync, admin, usage, rewards) show the Home Screen hint (`audits/evidence/p6/0c/me-sync-typical-iphone-safari-light.png`).
  - Home's lower loading screen now shows the placeholders batch 0b fixed after its capture: a ring without "0/5", and no "Log leftovers…".
- **Checked, and not caused by the batch:**
  - The pairing screens: the input's focus ring, which is on 0a's flaky list.
  - The add-guest sheet: a 1 px scroll offset.
  - Prayer's category settings and the park map's search sheet: long-page and sheet scroll, both on 0a's flaky list.
  - 1-2 px of antialiasing on the PIN and Me overflow screens.
- The Apps grid differences from the first run are gone after the grid fix.

### Rubric rescore

- **What changed on screen is small:**
  - the Sync card, and who sees Forget;
  - the Home Screen hint;
  - the person's own theme after Switch;
  - Home as the landing tab.
- **What changed underneath** is whether a change the person saw saved actually reaches the house. The rubric scores that under **Ease of use** (error prevention, Phase 3 §3).
- The orchestrator's rescore:

| Area | Ease of use | Why |
|---|---|---|
| Shell (with the TV) | 4 → 4.5 | Forget can no longer throw away unsent changes and is gone from kid and TV screens; Switch gives the next person their own look and Home; the TV and Kitchen iPad keep updating after a Switch |

- Every other cell is unchanged, and the shell's average moves from 4.2 to 4.25.
- These are the orchestrator's own judgements, not a rerun of Phase 4's two-reviewer scoring.

### Repo tests

Every suite that needs a local Worker was run twice:
- on the pre-batch code (`git archive` of `2b0d6bd`);
- on the batch.

Each run had its own fresh copy of a seeded local D1 and its own `wrangler dev`. Results are in `audits/evidence/p6/0c/tests/`.

| Suite | Before | After |
|---|---|---|
| test-hub | 36 / 1 | 36 / 1 (the same stale "signed in as Niece"; fixed in 2a) |
| test-f260 | 52 / 0 | 52 / 0 |
| test-prayer | 36 / 0 | 36 / 0 |
| test-prayer-faces | 41 / 0 | 41 / 0 |
| test-kidverse | 51 / 0 | 51 / 0 |
| test-kidstory | 50 / 0 | 50 / 0 |
| test-rewards | 73 / 0 | 73 / 0 |
| test-verses | 80 / 0 | 80 / 0 |
| test-leftovers | 42 / 0 | 42 / 0 |
| test-timer | 45 / 0 | 45 / 0 |
| test-home | 57 / 0 | 57 / 0 |
| test-tv | 43 / 0 | 43 / 0 |
| test-prefs | 17 / 0 | 17 / 0 |
| test-guests | 50 / 0 | 50 / 0 |
| test-dollywood-sync | 32 / 0 | 32 / 0 |
| test-dollywood | 34 / 0 | 34 / 0 |
| test-dollywood-themes | — (the harness passed the pairing code as its port) | all checks passed (run with its port) |
| test-photos | 27 / 1 | 28 / 0 (the same flaky check as in 0b's baseline) |
| test-apps | 48 / 0 | 48 / 0 |
| smoke-api.sh | 120 / 0 | 120 / 0 |

- **Rerun after the last shell fixes:** test-hub, test-home, test-apps, test-tv, test-prefs and test-guests gave the same results (`repo-final-shell.txt`).
- **Static checks:**
  - `node handoff/prayer/check.js apps/prayer.html`: 49 passed, 0 failed.
  - `node scripts/bump-sw.mjs --check`: 74 precached files present, 67 shipped files accounted for.
- The tests overwrite tracked screenshots in `docs/screens/`; those were restored.

### Not verified, and known limits

- **Real devices.** Everything ran in Playwright WebKit and Chromium, with the network, clock and storage emulated. Not seen on a real device:
  - `keepalive` when an iPhone closes the PWA;
  - `navigator.storage.persist()` (headless WebKit grants nothing visible);
  - the Safari-tab hint on a real iPad;
  - a real device clock set 10 minutes fast.
- **The live site and the live Worker.** Nothing is pushed or deployed.
  - The Worker's clamp, `at` and `/api/device/forget` reach the family only when the Worker is deployed.
  - Until then, a new `hub.js` against the old Worker still works: it sends at most 200 rows, and the old Worker ignores `at`.
  - But Forget would fail with a 404 and leave the device paired.
- **A reload on a full device while offline** loses the change the device could not store. The toast says so at the time, and after the reload the device shows what the house has.
- **A Switch whose logout request hangs** leaves the old token valid until the next reconnect, refocus or sign-in retries it (`sec-03-2` S5a).
- **The plan's server rule was not added.** The rule was "the old token is refused once a new session exists for that device". `scripts/smoke-api.sh` and the capture rig hold several sessions on one device, so the rule would break them. The client-side logout on reconnect closes the offline-Switch case instead.
- **Forget can be blocked** by a signed-out person's unsent changes until that person signs in once while online. The message names them.
- **Whole-row races between two people** (P2-SYNC-01) belong to batches 0e-0g. The b2probe's lost tick is that race, not one of this batch's findings.

## Batch 0d — Security: accounts, private content, stored script, kid safety; the Kitchen device's server rules

| | |
|---|---|
| **Findings** | 17 entries (15 primaries + 2 pointers): 3 critical, 4 high, 3 medium, 5 low primaries. All 17 FIXED (status per entry in `audits/05-findings.md`), plus the household work KITCHEN-1 (server half) done. |
| **Code commit** | `d5e46b6` (2026-09-28); the park-map template change is committed in the sibling repo `../dollywood-build-project` as `1b23abf` |
| **Files** | `worker/src/policy.js` (new), `worker/src/index.js`, `worker/src/auth.js`, `worker/src/chat.js`, `worker/src/data.js`, `worker/migrations/006-kitchen.sql` (new), `worker/schema.sql`, `worker/seed.sql`, `worker/README.md`, `apps/hub.js`, `index.html`, `apps/prayer.html` (data code, copy and two chip rules; layout and ids kept), `apps/kidverse.html`, `apps/leftovers.html`, `apps/dollywood.html` + `apps/dollywood-live.html` (exported), `scripts/test-kitchen.mjs` (new), `scripts/smoke-api.sh`, three suites' fixtures (`test-home`, `test-rewards`, `test-dollywood`), `CLAUDE.md`, `sw.js` (`hub-v30` → `hub-v31`) |
| **Schema / data** | One migration, `006-kitchen.sql`: `devices.role` (added column), then the planned rebuild of `profiles` to widen its kind CHECK, with `hue`, `pin_reset_hash`, `pin_reset_expires` and the seeded kitchen profile. The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-28-before-0d.sql` (35 KB, 8 profiles, 43 app_data rows; outside the repo, it holds hashes). `audits/tools/phase6/0d/migration-check.mjs` ran the migration on a copy of that export: profiles 8 → 9 (the kitchen), 96 of 96 values identical column by column, the new columns NULL, `devices.role` NULL on all 8, every other table untouched, the kind CHECK still refuses an unknown kind, and a second run fails on its first statement and changes nothing (`audits/evidence/p6/0d/migration-check.json`). The migration was also applied through D1 itself (`wrangler d1 execute --local`) to the seeded test database. **Nothing was deployed, and the migration has not been run on production.** It must run before the new Worker is deployed (the Worker reads `devices.role` and writes the new columns). |
| **How it was built** | The Worker, SDK, shell, Kid Verse, Larder and tests by the orchestrator; the Prayer fixes and the park-map template by one agent each against written briefs; an independent review of the whole diff (1 high, 3 medium, 7 low), every finding fixed; the same reviewer verified the fixes (3 follow-ups, fixed) and then the follow-ups (all hold). Every check below was rerun on the final code. |

### The change

**Who may write what, on the server (`worker/src/policy.js`, new; P2-PROF-05, P2-SEC-02, P2-CHAT-02, P2-CHAT-06, P3-DOLLYWOOD-LIVE-02, UX-KIDVERSE-3).**
- **One rule book for every write.** `PUT`, `DELETE` and `batch` on `/api/data`, and every chat tool that writes, go through `guardedPut()`: it reads the stored row, asks `writeError()`, and only then runs the usual last-write-wins `putOne()`.
- **A refused row is answered, not dropped silently.** A single write gets `403 not_allowed {rejected, key, value, updated_at}`. In a batch the refused row comes back as `{key, rejected, value, updated_at}` with the house's copy and the other rows still save, so one refused row never blocks a queue.
- **App visibility is the server's.** The Worker imports `apps.json` (`with { type: 'json' }`, so both wrangler and the audit rig's Node server load it). `canOpen()` mirrors the shell: `visibleTo`, a guest sees what any household adult sees, the kitchen its four apps, the TV none.
  - Family rows of an app the profile cannot open are refused for reading (`403 app_hidden`) and writing.
  - Person rows of such an app are refused for writing, with one cross-app row: Verses keeps `f260.recall` in the person's F260 scope, and kids use Verses though F260 is hidden from them.
  - Person-scope reads stay open: they only ever return the caller's own rows, and the shell reads its own F260, prayer and timer rows for every profile.
- **Kids** (P5-D2 and P2-PROF-05) write only:
  - their own person rows;
  - on the family prayer list, a tick under their own name. It is **merged**, not taken whole: the stored row, with only the kid's own name added on the household's yesterday, today or tomorrow (removed on today only), plus `lastPrayedAt` and `updatedAt`, stamped just after both the kid's write and the stored row. So an older copy on the kid's device can neither undo someone else's tick nor change the request, a tick cannot be backdated to mint Kid Verse stars, and an offline tick is not lost to a later write. `prayerDays` only gains the kid's dates among those three days;
  - their own Kid Verse `stars:<id>` and `story:<id>`;
  - their own park-map dot, only while an adult has their beacon on (`kidshare:<id> === true`), and a dot more than a day old (the map's clean-up).
  - Everything else in family scope is `kid_readonly`: the meeting point, Larder rows, reminders, ledger rows, a sibling's stars, any tombstone of another app's row.
- **Household-only rows.** Kid Verse `week` and `ledger:*`, and the park map's `kidshare:*` and `kid:*`, need a household adult (kind adult, not a guest).
- **One person's rows.** Nobody writes someone else's `stars:`/`story:` or places someone else's `loc:` dot; clearing another person's fresh dot is for household adults (switching a kid's beacon off). Prefixes are matched in any letter case, and `listData`'s prefix reads are now exact (`substr`), so `LOC:ezra` is no way round.
- **Chat** (`worker/src/chat.js`): the app list comes from `appsFor()`, never from the request (the guest hack in `index.js` is gone); every tool write goes through `guardedPut()`; `get_data` refuses a `.vault` key asked for by name (P2-CHAT-07); `mark_prayed` / `answer_prayer` on the private list post "Prayed for a private request" / "Answered a private request" (the chip, seen only by the person, keeps the title).

**Accounts (P2-PROF-04, P2-PROF-06, P2-SEC-01, GAP-PROF-a1, UX-PROF-a7).**
- **Reset PIN gives a one-time code** (P5-D4). For a household adult the admin's reset stores a hashed 6-digit code valid 24 h (`profiles.pin_reset_hash`, `pin_reset_expires`), ends the person's sessions and shows the code once. `POST /api/profiles/:id/pin` then needs that code (`403 needs_code`, `401 wrong_code`, `403 code_expired`). A guest's reset still clears the PIN (tap to open).
- **The admin's own PIN** (P2-PROF-06): the admin's own row offers **Change PIN** (current PIN first), not a reset, because a self-reset would sign the only admin out everywhere with nothing but a code to get back in. The Worker still accepts a self-reset, only with the admin's current PIN (`403 wrong_admin_pin`).
- **Set-up codes.** An adult who never had a PIN still creates it on first tap (the documented flow and every repo test depend on it), but the admin can close that too: the same button reads "Set-up code" on a profile with no PIN. A household profile the admin turns into an adult comes back with a set-up code.
- **Wrong PINs and codes are counted per profile across every device** (`pinCheck` / `pinFail` / `pinClear` in `worker/src/auth.js`). Every attempt is counted before it is checked, with an atomic upsert, so parallel guesses cannot slip past the count. Limits: 5 per device per 15 min (as before), 20 per device per day, 10 per profile per hour. The 10th wrong one pauses the profile for 1 h, then 2 h, 4 h … up to 24 h within a week, and pushes the admin (kind `security`); only one request can start a pause. A device the person has signed in on before (`pintrust:<profile>:<device>`, a year) is held only by its own limits, so nobody can lock a person, the admin included, out of their own phone. A right answer takes its attempt back off the counts. The admin's reset lifts a pause.
- **Change my PIN**: `POST /api/me/pin {current, pin}`, household adults; Me → PIN card in the shell. A wrong current PIN counts like a wrong sign-in and answers 403 so the shell stays signed in.
- **Pairing**: hub.js sends a random install id (`hub.fp`); wrong codes are limited to 5 per install id and 20 per IP (backstop) per 15 min, so one device cannot block the house. A page without `fp` keeps the old 10 per IP. The install id is the client's to choose, so an attacker can rotate it: the per-IP 20 is the real ceiling for one address (was 10).
- **Names**: the Worker refuses `<` and `>` in profile and guest names and emoji (`400 bad_name` / `bad_emoji`).
- **Colour families**: `profiles.hue`, admin only, one of the 18 names (`05-decisions.md`, "Admin-assigned colours"); a new guest gets `sky`.

**The Kitchen device, server half (KITCHEN-1; `worker/migrations/006-kitchen.sql`).**
- **Schema.** `devices.role` (added column), then the `profiles` rebuild that widens `kind` to take `'kitchen'` and adds `hue`, `pin_reset_hash`, `pin_reset_expires`; the seeded `kitchen` profile. `schema.sql` and `seed.sql` follow. The migration fails on its first statement if run twice, before anything changes.
- **Sign-in.** A kitchen device signs in only as the kitchen, with no PIN; the kitchen only on a kitchen device. `authenticate()` also refuses a session whose profile and device role no longer match, so a role change reaches a device on its next request.
- **Role.** `PUT /api/admin/devices/:id/role {role, admin_pin}`: admin only, from another device, the admin PIN typed again. Setting it ends the device's personal sessions and push subscriptions; clearing it ends the kitchen session. `GET /api/device` tells the device its role.
- **What it writes.** Family rows of the Larder, the family prayer list and reminders; person rows of its own Timer and Tally, and its own theme. No chat, push or admin; the Me tab hides the notifications card for it.
- **Credit.** A `by` / `byName` it writes (checked only when it changes: a row someone else wrote keeps its author), and any name it adds to a prayer's `prayedBy`, must be a household member (never a guest, the TV or itself); a kid is never named on a Larder row. `POST /api/activity {…, as}` and `POST /api/album {…, as}` file the line or the photo under the household member whose face was tapped (adults only for the Larder and the album).
- **Not a person.** It is listed with kind `kitchen`, which the pickers and `hub.people()` leave out; the admin's reset refuses it; the admin's edit takes only its colour.
- **The shell.** At boot and after any 401 the picker first asks `GET /api/device`; on a kitchen device it signs in as the kitchen instead. Its Apps list is Larder, Prayer, Timer and Tally. The kitchen Home, the face sheet and the admin's switch are KITCHEN-2 (batch 2a).

**Private prayers (P2-PWA-01, P3-PRAYER-18) and stored script (P3-PRAYER-06, P3-PRAYER-17, P3-DOLLYWOOD-LIVE-01).**
- **Prayer** (`apps/prayer.html`, data code and copy only; layout and ids kept):
  - praying for or answering a private request posts "Prayed for a private request" / "Answered a private request"; the Worker refuses a prayer line that names anything but a family-list title;
  - "Send to family list" shows For and Category as chips, off by default, and a preview of what the family will see; the family copy carries only what was chosen, so the new-prayer push has no "(for …)" unless chosen;
  - every row and plan id is escaped in markup; rows and plans whose id fails `/^[A-Za-z0-9_-]+$/` are dropped on load (a household adult also removes the row);
  - a kid's save writes only their own ticks, rebuilt from the house's row, and new prayer days; the kitchen writes the family list only.
- **Park map** (template in `../dollywood-build-project`, commit `1b23abf`, rebuilt, `verify.py` passed, exported): every stored name, emoji, id, colour, note and wait is escaped or validated; the Kids' beacons and the height stepper are for household adults only; a Content-Security-Policy with per-script hashes (`build_html.py add_csp()`) blocks inline handlers.
- **Kid Verse**: the week stepper is for household adults; a guest sees "The family is on week N."
- **Larder**: read-only for kids (the server refuses their writes; the picture view is batch 8).

**hub.js.**
- A refused row comes back with the house's value, which the flush puts back in the cache, unless a newer change to the row is waiting or a pull has meanwhile brought a newer copy; the toast says "That is not something <name> can change, so it was put back."
- `hub.dropPersonCaches(keep)`: the kitchen sign-in drops everyone else's person-scope caches, so a session the role change ended leaves no private rows on the counter.
- `hub.activity(text, app, { as })` (kitchen only), `hub.isKitchen`, `hub.isHouseholdAdult`, `hub.deviceRole()`, `hub.createPin(id, pin, code)`, `hub.changePin(current, pin)`; `hub.pair` sends the install id; `hub.people()` leaves the kitchen out.
- `sw.js` `hub-v30` → `hub-v31`.

**What the independent review changed.**
- **High.** The first shell let the admin reset their own PIN, which signed the only admin out everywhere with nothing but a code on the picker. The admin's own row now offers Change PIN.
- **Medium.** A kid's tick was refused whenever the kid's copy of the row was out of date (someone else ticked in the last 30 s); ticks are now merged onto the stored row. The kitchen's credit check tested authors it had not changed. PIN attempts were checked before they were counted, so a burst could race the limit, and anyone could pause the admin; attempts are now counted atomically first, and trusted devices are exempt from the pause.
- **Low.** Upper-case keys (`LOC:ezra`) got round the prefix rules; the refused-row put-back could overwrite a newer copy; a kid could backdate a tick to mint stars; the per-IP pairing backstop was 30 (now 20); the kitchen saw a notifications card and could not keep its theme; a session ended by a role change left private caches on the counter.
- **Follow-ups on the fixes.** The merged tick is stamped just after both the kid's write and the stored row (so an offline tick is not lost and the kid's next pull shows the merge); a kid's name is removed only on today; trusted devices keep a 20-a-day cap.
- **Kept as known limits:** device-only family reads (below) and the deploy order.

### Each finding's reproduction, rerun

**How they were run.** The 29 scripts the entries name ran on both the unchanged code (`git archive` of `6cd989f`) and the final code, three at a time; outputs and exit codes are in `audits/evidence/p6/0d/tests/repro-before/` and `repro-after/`. The scripts write into `audits/evidence/p2|p3/`; the changed files were moved into `p6/0d/p2|p3/` and the Phase 2/3 baseline restored (git shows it clean). Each entry's Status line in `05-findings.md` quotes the observation that flipped.

| Finding | Before | After |
|---|---|---|
| P2-PROF-04 (verify-pin-claim-2, step 3) | the TV device claims David after a reset: 200 and a session; reads his F260 (10 rows), writes his scope | 403 needs_code; reads and writes 401; David's own device is asked for the code |
| P2-PROF-06 (verify-admin-self-reset-1/2) | "Reset PIN" on Eli's own row; after it Eli is claimable | the row reads "Change PIN", Eli keeps his PIN and session; the scripts then wait for a picker that never comes (exit 1, the fix holding) |
| P2-PWA-01 (verify-private-prayer-titles-1) | "Prayed for Audit-secret 7Q biopsy result" on every token's feed, Mae's Home and the TV | the title appears nowhere |
| P3-DOLLYWOOD-LIVE-01 (xss-family-name-1/2, xss-guest-name) | the guest name runs as script in Eli's map (pwnSet true) | the guest cannot be created (400 bad_name; xss-guest-name exits 1 at that step). The forced check `phase6/0d/park-xss-planted.mjs` plants the payload straight into a guest's own loc row, the meeting point and a kid's height: shown as text, 0 live `img[onerror]`, nothing runs |
| P2-SEC-01 (verify-pin-brute-1/2, rate-limits) | 40 devices from one IP: 200 guesses reach PIN verification in 15 min; the admin route is reachable | 10 guesses; admin route not reachable; claims B/C and D no longer hold |
| P3-DOLLYWOOD-LIVE-02 (guest-can-flip-kid-beacon-1/2, rally-guest-loading) | the guest sees 2 beacon switches and 4 height steppers | 0 and 0 |
| P3-PRAYER-06 / -17 (xss-id, verify-xss-row-id-1/2, critic-sweep, plan-id-xss-1-1/1-2) | row-id and plan-id payloads run for Kiara and Eli | xss 0, px 0; the kid's plant is refused by the Worker; `phase6/0d/supp-0d-prayer.mjs` plants them as an adult: not rendered, xss 0, px 0 |
| P2-CHAT-02 (verify-kid-chat-writes-1) | as Ezra, chat saves meet, kidshare:kiara, loc:eli, kid:ezra and tombstones a Larder row | every one refused ("Only a household grown-up can change that." / "That belongs to someone else."), the Larder row stays |
| P2-PROF-05 (verify-kid-family-writes-2) | every one of Ezra's family writes 200 (meet, album rows, kidshare, loc:mom, reminders, week, f260 family); a forged cash-in against Kiara applied | every one 403; "tombstone all 11 family prayers" leaves 11 of 11; the forged ledger row refused |
| P3-PRAYER-18 (critic-push-share, share-copies-2-1/2-2) | the family copy carries For "Uncle Ray" and the category; the push says "(for Uncle Ray)" | For "" and "Personal"; the push has no "(for …)" |
| P2-CHAT-07 (verify-vault-readable-by-key-1) | get_data by key returns the whole 1384-2552-char vault | "The private journal is locked; it cannot be read from chat." |
| P2-SEC-02 (verify-visibleto-1/2) | the kid reads and writes f260 and dollywood family rows (200) | 403 |
| P2-CHAT-06 (verify-chat-trusts-client-app-list-1/2) | a 40 × 50 000-char app list grows the system prompt to 2 003 376 chars; Ezra's writes to stars:kiara and a family prayer 200 | 2764 chars; both 403 |
| GAP-PROF-a1, UX-KIDVERSE-3, UX-PROF-a7 | (screens and API) | `scripts/smoke-api.sh` cases below, and the recapture |

**New checks.**
- **`scripts/test-kitchen.mjs` (27/27).** A kitchen iPad signed in as Mea becomes the kitchen on its next request once the admin sets the role (a wrong admin PIN is refused), with no picker; its Apps are the Larder, Prayer, Timer and Tally; it writes the Larder through hub.js and another device sees it; it reads no one's person rows and cannot write F260 or a private prayer; nobody signs in as a person there and no other device as the kitchen; it has no chat; a Prayed credited to Ezra is saved, its feed line filed under Ezra, and Ezra's prayer star for today appears once Kid Verse opens; a name outside the household is refused; a refused row is put back on the device; clearing the role returns the picker and the device can no longer act as the kitchen.
- **`scripts/smoke-api.sh` (209/0, was 120).** One-time codes (no code 403, wrong 401, right 200), the admin's own reset, Change my PIN, names with markup, colour families, kid and guest limits on family rows (including key casing and a stale kid tick merged), a refused batch row next to a saved one, private prayer lines, the per-profile PIN pause across 4 devices with a trusted device still signing in, pairing per install id, and every kitchen rule.
- **`audits/tools/phase6/0d/migration-check.mjs`**, **`park-xss-planted.mjs`** and **`supp-0d-prayer.mjs`** (above).

### Capture rig

- **The runs.** Full matrix on the final code: `node audits/tools/capture.mjs --out audits/screens-after/0d --parallel 2` → 4437 ok, 10 failed. The 10 were Kid Verse's `adult-guest` state, whose script taps the week stepper a guest no longer has (UX-KIDVERSE-3); `audits/tools/areas/kidverse.mjs` now taps only if the stepper is there, and the 10 were recaptured (10 ok). Prayer's share panel was recaptured after the chip fix below. The manifest is committed; the PNGs are git-ignored like the baseline's.
- **Against batch 0c's after-capture**: 251 files changed beyond tolerance 48 (`audits/evidence/p6/0d/capture/pxdiff-0c-vs-0d.txt`). Against the Phase 1 baseline: 625 (`pxdiff-baseline-vs-0d.txt`).
- **A control recapture** on the pre-batch code of every ambiguous screen (456 captures, `audits/screens-after/0d-control/`; `pxdiff-0c-vs-control.txt`, `pxdiff-control-vs-0d.txt`) sorts them:
  - **Changed by design:** Me gains the PIN card (every adult Me screen: sync, admin, notifications, rewards, appearance, themes, album, overflow); the admin panel lists the Kitchen, says "Change PIN" on Eli's own row and "Set-up code" for Mea; the pairing-code and profile-edit sheets differ only in that admin page behind them; Prayer's share panel shows the For / Category chips and the preview; the kid's Larder has no add bar or ✓ buttons; the guest's Kid Verse has no stepper; the guest's park-map Family pane has no beacons or heights.
  - **Flaky, not this batch:** every other screen-state also changed between 0c and the pre-batch control (batch 0a's list: Prayer's long pages, the kids' prayer faces overflow, F260's week-complete / reflections / journal, the park map's search sheet, the first-visit toast, the timer toast), or is the same content at a different moment: the park map's nearby panel scrolled 11 px further, the TV board's crossfading background photo, 1-4 px of antialiasing (PIN pad, kid Me, Verses trainer, build-guide map).
- **One fix came out of the review of the screens.** The share panel's "For" chip was the panel's own colour, so it did not read as a button; the chips are now outlined (`--raised` on `--rule`, the pressed state kept) and the screen was recaptured (`prayer/ask-share-*`).

### Rubric rescore

- On screen the batch is small: the PIN card and Change PIN sheet, the admin's code sheet and set-up codes, the share panel's chips and preview, the kid Larder without edit controls, guest views without household controls.
- The substance is server rules the rubric does not score directly. The orchestrator's rescore, under **Ease of use** (error prevention and trust, Phase 3 §3):

| Area | Ease of use | Why |
|---|---|---|
| Shell | 4.5 → 4.5 | Change my PIN and the code flow add steps where they protect an account; no loss elsewhere |
| Prayer | +0.5 | "Send to family list" now shows exactly what the family will see and shares only the title unless asked |
| Park map, Kid Verse, Larder | unchanged | the controls that disappeared were never the viewer's to use |

- These are the orchestrator's own judgements, not a rerun of Phase 4's two-reviewer scoring.

### Repo tests

Each suite ran on its own fresh copy of a seeded local D1 and its own `wrangler dev`, once on the pre-batch code and once on the batch (`audits/evidence/p6/0d/tests/repo-before.txt`, `repo-after.txt`, `repo-after-fixtures.txt`).

| Suite | Before | After |
|---|---|---|
| test-hub | 36 / 1 | 36 / 1 (the same stale "signed in as Niece"; batch 2a) |
| test-f260, test-prayer, test-prayer-faces, test-kidverse, test-kidstory, test-verses, test-leftovers, test-timer, test-tv, test-prefs, test-guests, test-dollywood-sync, test-apps | 52, 36, 41, 51, 50, 80, 42, 45, 43, 17, 50, 32, 48 / 0 | identical |
| test-home | 57 / 0 | 57 / 0 after its fixture fix (first run 5 / 5) |
| test-rewards | 73 / 0 | 73 / 0 after its fixture fix (first run crashed) |
| test-dollywood | 34 / 0 | 34 / 0 after its fixture fix (first run 32 / 2) |
| test-photos | 27 / 1 | 28 / 0 (the known flaky check) |
| test-kitchen (new) | — | 27 / 0 |
| test-dollywood-themes | all checks passed | all checks passed |
| smoke-api.sh | 120 / 0 | 209 / 0 |

- **The three fixture fixes are the batch's rule working.** test-home, test-rewards and test-dollywood seeded other people's rows as one adult (Ezra's and Kiara's park dots and stars written by David; Ezra's story row by Eli; Mom's and David's dots by Eli's map). The Worker now refuses exactly that, so the fixtures write each row as its owner (a kid's dot after David switches the beacon on). The assertions did not change.
- **Static checks:** `node handoff/prayer/check.js apps/prayer.html` 49 / 0; `node scripts/test-design.mjs` 49 / 0; `node scripts/bump-sw.mjs --check`: 74 precached files present, 67 shipped files accounted for; the park-map export's `verify.py` passed.
- The tests overwrite tracked screenshots in `docs/screens/`; those were restored.

### Not verified, and known limits

- **Nothing is deployed, and the migration has not run on production.** Order when the household deploys: export the D1, run `006-kitchen.sql` on `--remote`, then `wrangler deploy`, then push the site. The new `hub.js` works against the old Worker except Change my PIN, reset codes and the kitchen sign-in; the new Worker must not run before the migration.
- **Production has an adult with no PIN: Mae.** A household adult who never set a PIN still creates it on first tap from any paired device, as documented; the verify-pin-claim script still claims Mea that way on the test data. Until Mae sets her PIN, Eli can close it with Me → Admin → "Set-up code" once this batch is deployed.
- **Device-only family reads** (no profile token, as the TV uses) are not checked against app visibility; the apps hidden from anyone today (F260, the build guide) hold no family rows.
- **The kitchen is only half-built** until batch 2a (KITCHEN-2): no Admin switch (the role is set through the API), no face sheet (Prayed on the kitchen names "Kitchen", which the Worker refuses and puts back), the ordinary Home, and the Chat tab shows but answers 403. A person whose session a role change ended keeps their unsent queue on that device; their private caches are dropped.
- **Real devices.** Everything ran in Playwright WebKit and Chromium against local Workers. Not seen: the park map's CSP inside the hub's iframe on the real GitHub Pages origin and on iOS Safari (checked in Chromium on a local origin, and the rig's WebKit loads the exported page with the CSP and runs normally); the security push to the admin on a real phone; a real iPad as the kitchen.
- **The admin's own reset** is still accepted by the Worker with the admin's PIN, although the shell no longer offers it.
- **A merged kid tick is stamped just after the stored row;** if the stored row carries a stamp up to 30 s in the future (a fast device clock), the Worker's clamp can make the tick lose that one write. It self-heals on the next tick.

## Batch 0e — F260 and Verses: rows that cannot erase each other, a journal that cannot corrupt

| | |
|---|---|
| **Findings** | 8 entries (7 primaries + 1 pointer): 6 critical, 1 medium primaries. All 8 FIXED (status per entry in `audits/05-findings.md`). |
| **Code commit** | `e72f6d0` (2026-09-29); the build guide's part is committed in the sibling repo `../dollywood-build-project` as `0d3fb7a` |
| **Files** | `apps/f260.html` (data code only; layout and ids kept), `apps/verses.html`, `apps/hub.js` (`hub.rowMap`), `index.html` (Home's F260 log), `worker/src/data.js` (`rowMap`), `worker/src/chat.js`, `worker/src/reminders.js`, `worker/src/policy.js`, `apps/dollywood.html` + `apps/dollywood-live.html` (exported), `scripts/test-f260.mjs`, `scripts/test-verses.mjs`, `scripts/test-apps.mjs`, `scripts/test-dollywood-sync.mjs`, `CLAUDE.md`, `worker/README.md`, `sw.js` (`hub-v31` → `hub-v32`) |
| **Schema / data** | No schema change and no data migration: new writes go to new keys, and the old whole-map rows stay as a read-only base. The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-28-before-0e.sql` (37 KB, 43 app_data rows; two people have F260 data, one an encrypted journal). Nothing was deployed. |
| **How it was built** | F260, Verses, the SDK, Home, chat and the reminder job by the orchestrator; the build guide by an agent against the same data contract; an independent review (1 high, 4 medium, 6 low) with every finding fixed, a second pass on the fixes (1 new medium, fixed; 4 low kept as limits below). Every check was rerun on the final code. |

### The change

**One row per entry (P2-SYNC-01, P3-VERSES-02, P3-F260-01).**
- **The cause.** F260 kept every tick in one row (`f260.done`), and likewise the log, the memorised verses and the practice ratings; the build guide kept every step in `progress`; Verses kept its day counts in `log`. Every tap rewrote the whole row from the device's own copy, and the newer stamp won, so a device that had not pulled erased another device's tick.
- **Now** each entry is its own row: F260 `done:<week>-<i>`, `mem:<week>-<i>`, `log:<date>`, `recall:<week>-<i>`; the build guide `step:<id>`; Verses `rev:<date>:<id>:<device>` (a count per verse per day per device, so two devices reviewing the same day both count). A tick writes only its own row.
- **Nothing migrates.** The old whole-map row stays as a read-only base; each row overrides its entry (`false` = off). `hub.rowMap(prefix, legacyKey, opts)` in hub.js and `rowMap()` in `worker/src/data.js` do the same merge. Every reader uses it: F260, Verses, Home's "read today" and streak, chat's `toggle_f260_reading` and `f260_status`, and the 8 pm job.
- **Restore** writes a row only for each entry that differs from the map as stored now, keeping the base; **Reset** drops the base and turns off only the rows that are on.
- **F260's practice rating** merges `s` and `t` into the verse's own row, read at write time, so Verses' box, due date, last review and streak stay (P3-F260-01).
- The Worker lets kids write their own `recall:<id>` rows (they train through Verses, which keeps them in the F260 scope).

**The journal vault (P2-SYNC-19, P2-SYNC-20, P3-F260-13, P3-F260-14).**
- **Encoding.** The ciphertext is base64-encoded in 32 KB slices. `String.fromCharCode.apply` over the whole buffer overflowed the call stack at about 124 KB of journal, and the error was swallowed behind "Saved".
- **Whole writes.** `vaultBlob()` returns a copy, and a new vault is written only whole: iv and ciphertext together, and on first setup the passcode wrap with them. A failed save can no longer leave a new iv with the old ciphertext.
- **Honest status.** The panel says "Saving…", then "Saved" only when the write took, or "Not saved — …" with the reason. A vault over 850 KB is refused before it is sent (the Worker's row limit is 900 KB).
- **Versions.** The vault carries a version (`vid`; a vault from before versions is known by its passcode salt, so every device derives the same one without writing). A device writes only while the stored vault is the version it unlocked. If not, it stops saving, keeps the journal on screen (nothing typed is lost; it can be copied) and says so once. The Worker also refuses a vault of another version unless the write names it as replaced (`prev`), so a queue sent much later cannot write over a re-created journal. Erase, restore (a new version) and first setup handle this explicitly. Setting a passcode first pulls, and refuses if another device has just set one; the plaintext journal leaves the device only once the house has the encrypted one.
- **Face ID** wraps are per device (`vault.prf[<device id>]`). The old single slot is offered until a device unlocks with it, which files a copy under that device; the old slot stays, because a synced passkey may open it on another device too. Turning Face ID off works while locked.

**What the independent review changed.**
- **High.** Restore dropped the old base row after writing rows only for changed entries, which would have wiped every tick that lived only in the base (all production data today). Restore now keeps the base and diffs against the stored map.
- **Medium.**
  - Reset wrote hundreds of rows; it now writes only the rows that are on.
  - Two devices unlocking an old vault each gave it a different random version, so one would wrongly lock mid-typing. The version is now derived, and a stale device no longer locks.
  - The version check was client-only; the Worker now enforces it.
  - First setup wrote the vault in two parts; it is now one write.
- **Low.**
  - Adopting the old Face ID slot now keeps it.
  - The practice rating reads the stored row at write time.
  - A restored vault gets a fresh version.
  - Verses counts per device.
  - `test-apps` read the old map.
  - Second pass: Face ID could not be turned off while locked; and a passcode set while another device had just set one could drop the plaintext journal.

### Each finding's reproduction, rerun

**How they were run.**
- The 19 scripts the entries name ran on the unchanged code (`git archive` of `97ed267`) and on the final code, three at a time. Outputs and exit codes are in `audits/evidence/p6/0e/tests/repro-before/` and `repro-after/`; the changed evidence files were moved into `p6/0e/p2|p3/` and the Phase 2/3 baseline restored (git shows it clean).
- **The scripts read the old storage.** They check what the server's `f260.done`, `f260.recall`, `log` or `progress` rows hold, which after this batch is only the read-only base. So an unpatched script cannot see a tick made after the fix and calls it lost (the first after-run did exactly that). The after-run therefore used:
  - `audits/tools/phase6/0e/merged-view.mjs`, a Node preload that answers the script's own GETs of those keys with the merged view (base plus rows) the apps show. The rig's server and the browsers are not touched.
  - For the four scripts that also read inside the page, copies from `audits/tools/phase6/0e/make-merged-copies.mjs` with those in-page reads replaced by `hub.rowMap`. Nothing else in them changes.
- All 19 exit 0 before and after.

| Finding | Before | After |
|---|---|---|
| P2-SYNC-01 (verify-whole-map-lww-2, e2a) | the phone's 38-2 is erased by the iPad's 38-3, online and offline; the build guide likewise | both ticks survive, online and offline; the build guide keeps 26 of 26 steps; e2a: 38-2 present after the iPad's tick |
| P2-SYNC-19 (journal-silently-stops-saving-2, 413-1) | above about 124 KB the save throws RangeError behind "Saved"; 4 × 40 000 chars leave the server at the 216-char empty vault | the save reaches the server and decrypts with the new day; 213 645 chars stored; 4 × 184 320 says "Not saved — the journal is too large to sync" |
| P2-SYNC-20 (vault-iv-mismatch-2, 413-3) | a failed save stores a new iv with the old ciphertext: OperationError, "Wrong passcode." on both devices | the stored vault decrypts (261 entries); the ivmix state no longer occurs |
| P3-F260-01 / P3-VERSES-01 (recall, recall-practice-1/2) | F260's "Got it" resets the Verses row to {s, t}: box 1, due now | box, due, last and streak kept; Verses unchanged |
| P3-F260-13 (vault-stale-1-1/1-2, critic-vault-stale) | the stale phone overwrites an erased or re-created vault: a raw error, then "Wrong passcode." for the old and new passcodes | after an erase the phone is offered "Set a journal passcode"; after a re-create the new passcode opens the journal |
| P3-VERSES-02 (lww-1/2, two-devices) | a device's ratings and the day's count are erased: lostPhoneRatings ["33-0","36-1"], day count 1 | the phone's 36-1 survives; day counts 3 and 4; the remaining "lost" 33-0 is the same verse the iPad rated later, whose newer rating correctly wins |
| P3-F260-14 (critic-faceid, single-slot-2-1/2-2) | the phone shows a Face ID button for the iPad's wrap, which fails; Settings say "On." | no button on the phone; Settings say "Unlock the journal with your passcode first" |

**Print check** (the plan's verification): `node audits/tools/phase3/f260/print.mjs` → a 3-page PDF with all 52 weeks and no UI text (`audits/evidence/p6/0e/p3/f260/print.json`).

### Capture rig

- **The runs.** The areas whose code changed were recaptured: F260 629, Verses 208, the build guide 432, the shell 979 (Home's F260 card) and the TV 34 — 2282 captures, 0 failed (`audits/screens-after/0e/manifest.json`). The other areas load only the new `hub.rowMap` function, which they never call.
- **Against batch 0d's after-capture** (`audits/evidence/p6/0e/capture/pxdiff-0d-vs-0e-*.txt`): 38 files changed beyond tolerance 48.
  - Verses: 0.
  - Known flaky screens: F260's week-complete (6) and journal entries (3); the shell's first-visit toast (2) and pairing focus ring (2); the TV board's crossfading background photo (2).
  - Antialiasing of 1-178 px: F260's HEAR panel on the italic prompt line (10; identical to the eye), the build guide (6), and a few shell and TV pixels.
- Nothing on screen was meant to change in this batch except the journal's "Saving…" / "Not saved — …" line, which appears only while a save is in flight or has failed.

### Rubric rescore

- On screen: none.
- Underneath: whether a tick, a rating or a journal entry the person saw actually saved. The rubric scores this under **Ease of use** (error prevention).
- The orchestrator's rescore:

| Area | Ease of use | Why |
|---|---|---|
| F260 | +1 | ticks, ratings and the journal no longer vanish silently, and the journal panel tells the truth about saving |
| Verses | +0.5 | two devices' ratings both count |
| Build guide | +0.5 | two devices' steps both count |

- These are the orchestrator's judgements, not a rerun of Phase 4's scoring.

### Repo tests

The pre-batch results are batch 0d's after-run of the same suites (`audits/evidence/p6/0e/tests/repo-before-is-0d-after.txt`); this batch's run is `repo-after.txt`.

| Suite | Before | After |
|---|---|---|
| test-hub | 36 / 1 | 36 / 1 (the stale "signed in as Niece"; batch 2a) |
| test-f260, test-verses | 52 / 0, 80 / 0 | identical, after both tests were changed to read the merged rows instead of the old maps (on their first run test-f260 stopped at its own read of `f260.done` and test-verses failed 9 checks, every one a read of `f260.recall`, `f260.mem` or `log`) |
| test-apps | 48 / 0 | 48 / 0, after its F260 check reads `done:1-0` |
| test-dollywood-sync | 32 / 0 | 32 / 0, after it reads the merged steps (and clears step rows at the start) |
| every other suite, and test-kitchen | as before | identical |
| test-dollywood-themes | all checks passed | all checks passed |
| smoke-api.sh | 209 / 0 | 209 / 0 |

`node scripts/bump-sw.mjs --check`: 74 precached files present, 67 shipped files accounted for. The build guide's `verify.py` passed. The tests' screenshots in `docs/screens/` were restored.

### Not verified, and known limits

- **Nothing is deployed.** The new Worker (rowMap in chat and the 8 pm job, the vault rule, kids' recall rows) must go out with or before the new pages. Batch 0d's migration still has to run first.
- **Devices still on the old cached pages** (until their service worker updates) write the old whole maps. A tick made there is merged under any rows; an untick there of an entry that has a row is lost to the row. This is a short overlap after a deploy.
- **The whole vault row is still last-write-wins.** Two devices changing the passcode or Face ID at the same moment can undo one another's change: the old passcode keeps working, and nobody is locked out.
- **"Saved" reflects this device's write.** A later refusal by the Worker (another device replaced the journal meanwhile) puts the house's copy back and the device then stops saving, but it has already said "Saved" once.
- **An erased journal can come back** if an offline device still holding its key saves after the erase and before anyone sets a new passcode. Writes over a deleted vault are allowed so that a first setup is never blocked.
- **Real devices.** Face ID / PRF, iCloud-synced passkeys and a real iPhone's storage limits were not exercised. The Face ID checks ran with the rig's WebAuthn stand-in.
- `weekStart`, `weekDone`, `best`, `miles`, `jstats` and `verses` (pasted verse text) are still whole-map rows. They are derived or rarely edited, and not ticks, so they are out of this batch's findings.
