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

## Batch 0f — Tally and Kid Verse: counts and stars that add up across devices

| | |
|---|---|
| **Findings** | 3 entries, all critical primaries. All 3 FIXED (status per entry in `audits/05-findings.md`). |
| **Code commit** | `48e7b60` (2026-09-29) |
| **Files** | `apps/kidverse.html`, `apps/tally.html`, `index.html` (the kid's Home stars card), `worker/src/chat.js` (tally read and set), `scripts/test-kidverse.mjs`, `scripts/test-rewards.mjs`, `scripts/test-kidstory.mjs`, `scripts/test-apps.mjs`, `scripts/smoke-chat.sh`, `scripts/mock-anthropic.mjs`, `CLAUDE.md`, `worker/README.md`, `sw.js` (`hub-v32` → `hub-v33`) |
| **Schema / data** | No schema change and no data migration: new writes go to new keys, and the old whole rows (`stars`, `story`, `count`) stay as a read-only base. The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-29-before-0f.sql` (37 KB, 43 app_data rows). It holds no Kid Verse or Tally rows yet, so in production nothing old has to be carried over. Nothing was deployed. |
| **How it was built** | By the orchestrator. An independent review found 7 items (3 high, 3 medium, 1 test gap); all were fixed except one kept as a limit below. A second pass on the fixes found 2 new low items, and both were fixed. A third pass on the last fix, and a fourth that confirmed it, closed the loop. Every check was rerun on the final code. |

### The change

**Kid Verse: one row per fact (P3-KIDVERSE-02, P3-KIDVERSE-10).**
- **The cause.** A kid's stars, credited days, parents' actions, badges and heard story days all lived in two whole rows (`stars` and `story`). Every star rewrote the whole row from the device's own copy, and the newer stamp won. So a second device that had not pulled erased a star or a heard day made on the first.
- **Now** each fact is its own row in the kid's person scope:
  - `star:<verse|story|prayed>:<date>` holds `{at}`, the server-clock time it was earned.
  - `reset:<kind>:<date>` marks a star a parent's reset took.
  - `applied:<ledger key>` marks a parent's cash-in or reset as taken in.
  - `badge:<id>`.
  - `heard:<iso week>:<date>`.
  Two devices doing the same work write the same rows, so a star, a badge or a parent's action counts once.
- **`deriveStars()`** rebuilds the old stars object from those rows over the pre-0f `stars` row, replaying stars, cash-ins and resets in time order. The kid's device writes the result to the family mirror `stars:<kid>` (and the heard days to `story:<kid>`) only when it differs, with every map in sorted key order. Two devices with the same rows build the same mirror, so they never take turns rewriting it.
- **Readers.** Adults' Home, Me, the TV and the parents' F260 hero read the mirrors, as before. The kid's own Home now reads the mirror too, falling back to the old person row.
- **Parents' resets.** A reset takes every star earned before it, including one that arrives later from a device that was offline. A reset the pre-0f app already applied leaves that app's own stars as it left them, because their times are gone after 30 days, but still takes a new star earned before it. A star earned after a reset is never taken.

**Tally: a row per device (P3-TALLY-01).**
- **The cause.** Tally stored one absolute number (`count`). Each tap wrote "my copy + 1", so a device that had not pulled wrote over another device's taps.
- **Now** each device keeps `count:<device id>` = `{n, epoch}`, its own net taps since the reset named by `epoch`. Reset writes a `reset` row `{epoch, at}` with a new epoch, which starts every device at 0. The number shown is the sum over the current epoch. Before the first reset, the old `count` is the base.
- **Chat.** "What's my tally" reads that sum. "Set my tally to N" starts a new epoch at N (`reset` + `count:chat`).

**What the independent review changed.**
- **High.**
  - Two devices flapped the mirror (different key order, so each rewrote it).
  - `earned` counted pre-0f stars twice.
  - A reset missed a star that arrived after it was applied.
- **Medium.**
  - A star a reset had taken could still add to the total.
  - Chat's "set my tally" wrote the old absolute row, which the app no longer reads.
  - The tests compared the mirror with itself. This one became the new two-device check.
- **Kept as a limit.** A tally sum below zero shows 0 (see below).
- **Second pass (low).**
  - Re-walking old resets relabelled pre-0f story and prayed days. Fixed by the rule above.
  - Chat read the old tally row. Fixed with the summed read, plus a new smoke-chat check.
  - The third pass refined the first of these so that a new star earned before an old-applied reset is still taken; the fourth confirmed it.

### Each finding's reproduction, rerun

**How they were run.**
- The 9 scripts the entries name ran three at a time on the unchanged code (`git archive` of `cdf1cac`) and on the final code. Outputs and exit codes are in `audits/evidence/p6/0f/tests/repro-before/` and `repro-after/`. The changed evidence files were moved into `p6/0f/p3/`, and the Phase 3 baseline was restored (git shows it clean).
- **The scripts read the old rows.** They read the server's person `stars`, `story` and `count` rows, which after this batch are only the base. The after-run therefore used `audits/tools/phase6/0f/merged-view.mjs`, a Node preload that answers the scripts' own GETs of those keys with what the apps now show: Kid Verse's family mirrors, and Tally's summed count. The rig's server and the browsers are not touched.
- All 9 exit 0 before and after.

| Finding | Before | After |
|---|---|---|
| P3-KIDVERSE-02 (erases-star-1/2, stale-device) | a stale device's tap erases the other device's Done ★: the iPad after pull shows "Done ★", ★4, 19 ever (the control 5 / 20) | "Done today ★", ★5, 20 ever, like the control, online, offline and in the race |
| P3-KIDVERSE-10 (critic-heard-races, heard-2-1, heard-2-2) | the stale device drops a heard day: "Heard 1 day this week", 09-25 lost from person and family rows | both days kept, "Heard 2 days this week", like the control (2-2 did not reproduce before either; it matches the control before and after) |
| P3-TALLY-01 (two-devices, lww-1, lww-2) | taps lost: A 40 of 45, B 38 of 51, C 39 of 43 | A 45, B 51, C 43, with nothing lost; the controls unchanged |

**New check: `audits/tools/phase6/0f/kid-two-devices.mjs`** (`audits/evidence/p6/0f/kid-two-devices.json`).
- **A.** Ezra's phone goes offline and taps Done ★, and the iPad taps "I heard it". Both stars land: 3 → 5 on both devices and in the mirror.
- **B.** Both devices stay open for 75 s with pulls, and neither mirror is rewritten.
- **C.** The offline phone earns today's ★ (its total goes 3 → 4) before Eli resets the week. The iPad applies the reset first (total 0), and then the phone reconnects. The star is taken by the reset: the total stays 0, today's ★ stays spent, and both devices show 0.
- A, B and C all pass on the final code.

### Capture rig

- **The runs.** The areas whose code changed were recaptured: Kid Verse 240, Tally 60 and the shell 979 (the kid's Home stars card): 1279 captures, 0 failed (`audits/screens-after/0f/manifest.json`).
- **Against the last capture of each area** (`audits/evidence/p6/0f/capture/pxdiff-*.txt`; Kid Verse and Tally against batch 0d's, the shell against 0e's): Kid Verse 0 and Tally 0 changed beyond tolerance 48. The shell 9: the known flaky first-visit toast (4), and 2-pixel specks on PIN-create (4) and one Home overflow screen (1). A control recapture of those screens on the same code (`audits/screens-after/0f-control`, `pxdiff-0f-vs-0f-control-shell.txt`) differs from this run's in a first-visit toast, and the same 2-pixel boxes also flipped between batches 0d and 0e (`p6/0e/capture/pxdiff-0d-vs-0e-shell.txt`), so all 9 are run-to-run noise, not this batch.
- Nothing on screen was meant to change in this batch.

### Rubric rescore

- On screen: none.
- Underneath: whether a star, a heard day or a tap the person saw actually counted. The rubric scores this under **Ease of use** (error prevention).
- The orchestrator's rescore:

| Area | Ease of use | Why |
|---|---|---|
| Kid Verse | +0.5 | a kid's second device can no longer erase a star or a heard day |
| Tally | +0.5 | taps from two devices both count |

- These are the orchestrator's judgements, not a rerun of Phase 4's scoring.

### Repo tests

The pre-batch results are batch 0e's after-run of the same suites (`audits/evidence/p6/0f/tests/repo-before-is-0e-after.txt`); this batch's run is `repo-after.txt`.

| Suite | Before | After |
|---|---|---|
| test-hub | 36 / 1 | 36 / 1 (the stale "signed in as Niece"; batch 2a) |
| test-kidverse, test-rewards, test-kidstory | 51 / 0, 73 / 0, 50 / 0 | identical, after the three tests read the family mirrors `stars:ezra` / `story:ezra` instead of the old person rows, and clear the kid's new rows where they cleared the old row |
| test-apps | 48 / 0 | 48 / 0, after its Tally check sums the `count:` rows |
| every other suite, and test-kitchen | as before | identical |
| smoke-api.sh | 209 / 0 | 209 / 0 |
| smoke-chat.sh (mock model) | 38 / 1 on the unchanged code | 39 / 1 (one new check: chat reads the summed tally) |

- **smoke-chat's one miss is old.** It fails the same way on the unchanged code: "kid blocked from adult-only app" asks a kid to change the prayer app. Kids have used Prayer (the family list) since the prayer-with-faces work, so the check is stale, and the Worker's rules (batch 0d) decide what a kid may write there. It is left for the batch that owns chat.
- `node scripts/bump-sw.mjs --check`: 74 precached files present, 67 shipped files accounted for. The tests' screenshots in `docs/screens/` were restored.

### Not verified, and known limits

- **Nothing is deployed.** The pages and the Worker's chat change go together. Batch 0d's migration still has to run first.
- **Devices still on the old cached pages** (until their service worker updates) write the old whole rows, which now act only as the base. A star or tap made there shows up under the new rows. It is lost only if the same device later loses its copy before updating. This is a short overlap after a deploy.
- **Tally below zero.** The minus button is refused at a shown 0, and a sum below zero shows 0. Two devices each subtracting from 1 while offline can leave the sum at −1, which reads 0 until someone adds.
- **A tap on an old epoch is dropped.** A device that taps before it has pulled another device's reset writes on the old epoch, and that tap does not count.
- **Chat can still write a kid's star rows** through the general `set_data` (as before this batch, within the Worker's rules for kids).
- **Two kids' devices during a parent's cash-in** were not exercised separately. The ledger path is unchanged from before this batch and is covered by test-rewards.
- **Real devices** were not used: every two-device check ran in the rig's WebKit (iPhone and iPad profiles).

## Batch 0g — Prayer: no lost requests, notes or prayed days

| | |
|---|---|
| **Findings** | 7 entries, all primaries: 4 critical, 1 high, 2 low. All 7 FIXED (status per entry in `audits/05-findings.md`). |
| **Code commit** | `7d9c593` (2026-09-29) |
| **Files** | `apps/prayer.html` (data code and two lines of copy; layout and ids kept), `apps/kidverse.html` (prayed days by id), `index.html` (the TV's "who prayed today"), `worker/src/policy.js` (who prayed is merged for every writer), `worker/src/chat.js` (`mark_prayed` by id, `add_prayer` records its author), `scripts/test-apps.mjs`, `scripts/test-prayer-faces.mjs`, `scripts/test-rewards.mjs`, `scripts/smoke-api.sh`, `CLAUDE.md`, `worker/README.md`, `sw.js` (`hub-v33` → `hub-v34`) |
| **Schema / data** | No schema change and no data migration. New entries of `prayedBy` are profile ids; the names already stored stay and are still read (see below). New request ids are random; existing ids keep theirs. The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-29-before-0g.sql` (37 KB, 43 app_data rows, 14 of them Prayer). Nothing was deployed. |
| **How it was built** | By the orchestrator. An independent review found 11 items (3 medium, 1 low-medium, 7 low). All were fixed. Three more passes on the fixes followed: the second found 1 new medium (the kitchen) and 3 low, and the third 1 low (the untick signal could be stored). All were fixed. A fourth pass found 1 low in the last fix (an untick whose write was refused could be marked as sent); it was fixed and a fifth pass confirmed. Every check was rerun on the final code. |

### The change

**Who prayed is kept by profile id, and merged (P3-PRAYER-24, P3-KIDVERSE-07, P3-PRAYER-05).**
- **The cause.**
  - `prayedBy[date]` listed display names, so a guest who shares a household name was taken for that person: shown with their face, and credited with a Kid Verse star.
  - On the family list, "done" was the row's shared `lastPrayedAt`, so one person's tick showed as everyone's, and the next person's tap took it away for the house.
- **Now.**
  - Prayer, chat and the Worker write profile ids.
  - A family row is "done" for me when my id is in today's list. A tap adds or removes only me; everyone else shows as a face.
  - Names already stored still show. A name counts as a particular person only while no one else the house knows, guests included, has it. So an old "Kiara" never becomes Kiara once a guest called Kiara exists. An unknown id reads "Someone".
- **The house merges who prayed for every writer, not only kids (batch 0d).**
  - The request itself stays last-write-wins. Who prayed is merged: a writer changes only their own entry, added on the household's yesterday / today / tomorrow.
  - An entry is taken away only today, and only when the write says so. Prayer sends `unprayed` with an untick, and the Worker never stores it. So a copy of the row from before someone's tick cannot erase it: another adult's device that had not pulled, or the same person's other device.
  - The kitchen may add household members and never takes anyone away.
  - When the house changed the row, it is stored one millisecond newer than both copies, so the writer's next pull shows the merged row.
- **Kid Verse** credits a prayed day when the kid's id is on it, or their name while no one else has it.

**New ids (P3-PRAYER-01).** New requests get a random id (`p` / `s` + time + 8 random characters) instead of "the next number", which two devices picked at once.

**The date at each tap (P2-STAB-03).**
- Batch 0b's midnight event already moved Prayer to the new day, and this batch's before-run shows it: the 00:03 tap lands on the 28th.
- Prayer now also reads the house's date again at every tap, for a page whose midnight timer never ran.
- A tap never takes away an earlier day's mark: on my own list only today's mark can be undone; on the family list only today's own entry.

**"Put back on the list" (P3-PRAYER-04).** The answer and its date are kept as a dated update ("Was answered on …: …"). A toast offers Undo, which restores the request exactly. Both Undos find the request again by id, in case another device's change rebuilt the list meanwhile.

**Import (P3-PRAYER-03).**
- **What it does now.**
  - It merges and never deletes.
  - A request missing here comes back, and a newer copy in the backup is brought back. On the family list, this applies only to requests the importer added and still owns.
  - Everyone's prayed marks stay as the house has them.
  - Categories, plans and prayed days are added to, never replaced.
- **Reused ids.** A request whose id was reused after a delete (the same id with another start date) comes back under a new id instead of replacing the one there now.
- **Old backups.** A single-list (v2) backup touches only the importer's own list.
- **What it tells you.** The help text says what import does. The toast says what changed: "2 added; 9 family requests were left as the house has them (only requests you added are restored)".
- **A bug this uncovered, older than the batch.** Prayer remembered a row it had sent and skipped sending an identical copy even after the house had deleted the row. That memory now follows each reload.

**What the independent review changed.**
- **Medium.**
  - The Worker turned any stored "Kiara" into Kiara's id when she ticked, and the app deleted it. Both now touch a name only while no one else has it.
  - Adults still wrote whole rows under last-write-wins. The Worker now merges who prayed for every writer.
  - Import matched rows by id alone, and old ids were reused.
  - Second pass: the kitchen could take away ticks missing from its copy. It now only adds.
- **Low.**
  - Rows with no author could not be restored, and the toast blamed "someone else". Chat's new requests now record their author, and the toast is accurate.
  - A v2 backup added a plan and categories.
  - An unknown id showed as a raw id (guest ids are mixed case).
  - Undo held a stale object.
  - A request answered with no note lost its date.
  - Tests counted names only, and there was no id-path check (the new check below).
  - Stale comments.
  - Second pass:
    - A person's own un-pulled device could untick them. Untick is now explicit (`unprayed`).
    - The memory reset also forgot two settings.
  - Third pass: `unprayed` could be stored by a plain write (a new row, a restored row, chat). The Worker now strips it from every Prayer write, and the app sends it once.

### Each finding's reproduction, rerun

**How they were run.**
- The 19 scripts the entries name ran three at a time on the unchanged code (`git archive` of `1543b41`) and on the final code. Outputs and exit codes are in `audits/evidence/p6/0g/tests/repro-before/` and `repro-after/`. The changed evidence files were moved into `p6/0g/p2|p3/`, and the Phase 2/3 baseline was restored (git shows it clean).
- All 19 exit 0 before and after.
- **Scripts that look for names.** Several scripts look for a name ("Kiara") in `prayedBy`, and now find the id instead ("kiara"). Where that matters it is read as such below.

| Finding | Before | After |
|---|---|---|
| P2-STAB-03 (midnight) | fixed by batch 0b already: the 00:03 tap lands on 2026-09-28 | the same (the script's `kiaraOn` looks for the name, so it now reads [] while `prayedByKeys` shows the 28th and the TV shows Kiara); the missed-timer case is check B below |
| P3-PRAYER-01 (id-collision, verify-1/2) | both devices pick p012 (or p020, s012, p006): one request lost in every scenario | random ids, never equal; every request on the server and on both devices (A–D, V1–V2, S1–S3) |
| P3-PRAYER-03 (import-family, verify-1/2) | Import tombstones Mae's newer request and erases Kiara's mark for today; help says "replaces both lists" | 0 tombstones; Mae's request and Kiara's mark stay on the server and both devices; the toast says what changed |
| P3-PRAYER-04 (unanswer, verify-1/2) | one tap erases the answer note: nothing anywhere in the row, no toast | the note and its date become an update; "Back on the list. The answer is kept as an update." with Undo |
| P3-PRAYER-05 (family-tick, verify-1/2) | Eli's tap unticks Elizabeth's tick for the house; a row someone else prayed shows ticked for Eli | Eli's tap adds "eli" next to Elizabeth; his rows show his own ticks only (verify-2 stops at "no row ticked by someone else", which is the fix: none is shown ticked); a second tap takes away only his |
| P3-PRAYER-24 (critic-sweep, 8-1, 8-2) | a guest named David shows as David (his face); the guest's tap erases David's tick | the guest's own face and colour; both ticks kept (C: `["dad","guest-…"]`; D: `["dad","eli"]`); a guest named Ezra no longer makes Ezra's card read done |
| P3-KIDVERSE-07 (name-match-1/2, star-rules R6) | a guest named Kiara earns Kiara a prayed star | the guest's id is recorded; Kiara gets no star (`prayedCredited` 0, was 1) |

**New check: `audits/tools/phase6/0g/prayer-merge-check.mjs`** (`audits/evidence/p6/0g/prayer-merge-check.json`). It covers what the old scripts cannot see.
- **A.** Mom ticks a request, and Dad's un-pulled device ticks it seconds later; then Dad is offline, Mom ticks, and Dad reconnects. Both rows end with `["mom","dad"]`.
- **B.** Eli's page is held on yesterday (a missed midnight timer). His tap lands on today, and yesterday's mark stays.
- **C.** A guest named Kiara exists, and a row's yesterday holds the old name "Kiara". The real Kiara's tap adds `kiara` today, and the name is left alone. Her card does not read done from the guest's name.
- **D.** Kiara's tap earns `star:prayed:<today>` in Kid Verse.
- **E.** The TV shows one Eli face for `["Eli","eli"]`, and "Someone" for an unknown mixed-case guest id.
- **F.** "Put back" then Undo restores status, date, note and updates exactly.
- **G.** Import brings back Eli's deleted request and leaves Mae's deleted one deleted. The reused `s901` comes back under a new id, and the current `s901` is untouched.
- **H.** Eli's own un-pulled phone edits a request he just ticked on the iPad: the tick stays. His untick then removes it, and no `unprayed` is stored.
- All eight pass on the final code.

**The prayer check.**
- `handoff/prayer/check.js` is on the do-not-touch list, so it was left as it is. It now fails the two checks that assert names in `prayedBy`, and passes the other 47.
- `audits/tools/phase6/0g/check-ids.js` is an identical copy except that those two checks assert ids. It passes 49 of 49.
- **For the owner:** `check.js` should get the same two-line change; that needs your okay to touch `handoff/`.

### Capture rig

- **The runs.** The areas whose code changed were recaptured on the final code: Prayer 809, Kid Verse 240, the shell 979 and the TV 34 — 2062 captures, 0 failed (`audits/screens-after/0g/manifest.json`).
- **Against the last capture of each area** (`audits/evidence/p6/0g/capture/pxdiff-*.txt`; Prayer against batch 0d's, Kid Verse and the shell against 0f's, the TV against 0e's):
  - **Prayer: 97 changed, all family-list screens.** They are the intended change. "Done" on the family list now means the signed-in person prayed it, so the headline counts and the ticks differ (for example "5 to pray" → "8 to pray" behind the delete sheet, because other people's ticks no longer count as Eli's). The Import help text changed too. Also in this group: the known scroll-offset flake on long Prayer pages (kid-faces-overflow: the same cards, 4 px lower).
  - **Kid Verse: 0.**
  - **The shell: 6**, all run-to-run noise seen in earlier batches (first-visit toast, error-message animations, 1-pixel specks).
  - **The TV: 3** (the crossfading background photo, 1-pixel specks).

### Rubric rescore

- On screen: the family list now shows each person their own ticks, with everyone else's as faces; "Put back on the list" shows a toast with Undo; Import's help and toast say what happens.
- Underneath: whether a request, an answer or a prayed mark survives another device. The rubric scores both under **Ease of use** (error prevention, feedback).
- The orchestrator's rescore:

| Area | Ease of use | Why |
|---|---|---|
| Prayer | +1 | no lost requests, answers or ticks; "done" means mine on the family list; Import is safe and says what it did |
| Kid Verse | +0.5 | a prayed star can no longer be earned by someone else |

- These are the orchestrator's judgements, not a rerun of Phase 4's scoring.

### Repo tests

The pre-batch results are batch 0f's after-run of the same suites (`audits/evidence/p6/0g/tests/repo-before-is-0f-after.txt`); this batch's run is `repo-after.txt`.

| Suite | Before | After |
|---|---|---|
| test-hub | 36 / 1 | 36 / 1 (the stale "signed in as Niece"; batch 2a) |
| test-prayer, test-prayer-faces | 36 / 0, 41 / 0 | identical; test-prayer-faces now asserts Kiara's id joins prayedBy (it asserted her name) |
| test-apps | 48 / 0 | 48 / 0, after its two who-prayed checks assert the id |
| test-rewards, test-kidverse, test-kidstory, test-tv, test-home, test-kitchen | as before | identical (test-rewards also counts the id when it works out the expected prayed days; test-tv and test-kitchen still seed names, which are still read) |
| every other suite | as before | identical |
| smoke-api.sh | 209 / 0 | 209 / 0, after the kid-merge check expects the id (`[Kiara, ezra]`: the old-app name Ezra sent is recorded as his id) |
| smoke-chat.sh (mock model) | 39 / 1 | 39 / 1 (the same stale "kid blocked from adult-only app" miss as before this batch) |
| handoff/prayer/check.js | 49 / 0 | 47 / 2 (the two checks that assert names; see "The prayer check" above); the id copy 49 / 0 |

`node scripts/bump-sw.mjs --check`: 74 precached files present, 67 shipped files accounted for. The tests' screenshots in `docs/screens/` were restored.

**After the last change.** The fourth review pass found that an untick whose write was refused could be marked as sent and never retried; the fix (a few lines in `setPrayed`, and the kid merge dropping an old flag) came after the full run above. Rerun on that final code: the three family-tick scripts, prayer-merge-check (8 / 8), test-prayer, test-prayer-faces, test-apps, test-kitchen, test-rewards, test-tv, smoke-api, both prayer checks, and the capture below.

### Not verified, and known limits

- **Nothing is deployed.** The Worker's merge and the pages go together. Batch 0d's migration still has to run first.
- **Devices still on the old cached pages** (until their service worker updates, `hub-v34`):
  - They write names. The Worker turns a person's own name into their id while no one else has that name.
  - Their untick sends no `unprayed`, so the house keeps the tick until that person unticks from an updated device or the day ends. Kids never untick.
  - Their "done" reads by name, so an id tick shows undone there until the page updates.
- **An untick made offline and then an edit of the same request** on that device before it reconnects: the edit replaces the queued untick, which carries the untick signal, so the house keeps that person's tick for the day. Only the person's own tick is affected.
- **A name written before this batch** is still read as that person while their name is unique. Once a guest with the same name exists, such old entries show under the name with no face, and earn no star.
- **Other people's prayer history in a backup.** Import keeps the house's prayed marks. A backup's marks on days more than a day from today reach the house only for requests that are missing there and come back whole.
- **Family requests with no author** (added before authors were recorded) are not restored by Import. The toast says how many were left.
- **The kitchen's face-tap credit** (batch 2a) can add people but not take them away until that screen sends removals explicitly.
- **Real devices** were not used. Every two-device check ran in the rig's WebKit.

## Batch 0h — Larder and build guide: no one-tap loss

| | |
|---|---|
| **Findings** | 6 entries, all primaries: 4 critical, 2 medium. All 6 FIXED (status per entry in `audits/05-findings.md`). |
| **Code commit** | `16926a2` (2026-09-29); the build guide's part is committed in the sibling repo `../dollywood-build-project` as ``fa62844` (template) and `aa91474` (rebuilt outputs)` |
| **Files** | `apps/leftovers.html`, `apps/hub.js` (`hub.toast` takes an action; `hub.onLeave` / `hub.leaveNow`), `apps/design.css` (the toast's button), `index.html` (the app's leave hooks run before it is closed), `worker/src/chat.js` (`finish_leftover` keeps a finished row; `get_data` leaves them out), `apps/dollywood.html` + `apps/dollywood-live.html` (exported), `CLAUDE.md`, `worker/README.md`, `sw.js` (`hub-v34` → `hub-v35`) |
| **Schema / data** | No schema change and no data migration. Finished Larder items are new family rows `finished:<id>` (kept seven days); nothing existing changes shape. The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-29-before-0h.sql` (37 KB, 43 app_data rows, 1 of them Larder). Nothing was deployed. |
| **How it was built** | By the orchestrator; the build guide through its template, rebuilt with `build_html.py`, checked with `verify.py` (passed) and exported with `export_hub.py`. An independent review found 10 items (3 medium, 1 medium/low, 6 low), all fixed; a second pass found 1 partly fixed and 3 new low, all fixed; a third pass found 1 more place a row could move (Recently finished), fixed; a fourth found a row that could shrink, fixed; a fifth confirmed with no new issue. Every check was rerun on the final code. |

### The change

**One tap, one item, and it can be taken back (P3-LEFTOVERS-01, UX-LEFTOVERS-1).**
- **What a ✓ does now.**
  - The ✓ marks its own item "finishing": the card stays where it is, struck through, with a "Finished" chip and an Undo in place of the ✓.
  - A toast says "Finished the … · Undo".
  - The item leaves the house list only after six seconds, or when the app is left: the hub's Back, a Switch, or the app going into the background.
- **A double tap.** The second tap lands on that card's Undo, which ignores taps in its first 0.7 s. A double tap therefore finishes the one item, never the next.
- **Recently finished.** Finished items are kept seven days under "Recently finished" (`finished:<id>`: size, date, who logged and who finished it), with Put back. Chat's `finish_leftover` writes the same row.
- **Two hub additions.**
  - `hub.toast` takes an optional action button.
  - `hub.onLeave` / `hub.leaveNow` let an app queue its last writes before the SDK's send on pagehide. The shell runs them before it closes an app or signs a person out.

**A change from another device never moves a card (P3-LEFTOVERS-12).**
- **The cause.** The old list repainted from scratch on every change, so the card under a finger could become the next one. The Phase 3 scripts showed the change landing with no pointer activity at all, so no "wait while touching" rule could catch it.
- **Now the list is sorted and grouped only on these occasions:** when it opens, on this device's own Log or Put back, at midnight, when the app comes back into view, or on "Show".
- **Everything else updates cards where they stand, and only the cards that changed.**
  - An item finished elsewhere, or this device's own after its six seconds, stays in its slot, dimmed and marked Finished, with nothing to tap.
  - An item added elsewhere waits behind a floating "N new in the fridge · Show" pill.
  - Nothing in a card changes width (a fixed-width chip, a 48 px Undo, a 48 px empty slot where the ✓ was), so no card changes height. The new check measures every card before, during and after.

**Kids (P3-LEFTOVERS-13, UX-LEFTOVERS-2).**
- Batch 0d already made the house refuse a kid's Larder write and removed the ✓ for kids.
- Kids now get a picture view: a food picture, the name in big type and "N days in the fridge" with the freshness colour. There is no add bar, mic or Hearth block.

**The build guide's Import (P3-DOLLYWOOD-02).**
- It reads only a file that names steps of this guide; a wrong file or one with no known steps changes nothing and says so.
- It adds the steps the file has ticked and never unticks one.
- It asks first ("Add 1 ticked step from this file? The 24 steps ticked here stay ticked; nothing is unticked."), and a toast offers Undo. Undo takes back only ticks nobody has changed since.

**What the independent review changed.**
- **Medium.**
  - Put back of an item still finishing here was finished again.
  - Undo after the six seconds did nothing (it now puts the item back).
  - The kitchen's Put back could lose the item: the house refuses a credit to a guest.
  - Switch while an item was finishing left the finish and its feed line unsent (the leave hooks).
- **Low.**
  - The seven-day clean-up could act on an old cache.
  - Focus was lost when a card was rebuilt; dimming reached the Undo.
  - Chat's `get_data` listed finished rows as if still in the fridge.
  - The guide's Undo could untick a step ticked meanwhile.
  - A page back from the back/forward cache showed stale cards.
- **Second pass.**
  - The kitchen check read the wrong field name.
  - Every card was rebuilt on every sync (now only changed ones).
  - Focus fell to the page when a finishing card went grey.
  - An empty list now lays itself out.

### Each finding's reproduction, rerun

**How they were run.**
- The 12 scripts the entries name ran three at a time on the unchanged code (`git archive` of `f5099e2`) and on the final code. Outputs and exit codes are in `audits/evidence/p6/0h/tests/repro-before/` and `repro-after/`. The changed evidence files were moved into `p6/0h/p3/`, and the Phase 3 baseline was restored (git shows it clean).
- The build-guide scripts read the old `progress` row. They ran with batch 0e's `merged-view.mjs` preload, as in 0e.
- **`data-checks.mjs`** stops at its arm M2 before and after. There the first sync is made to fail, and since batch 0b the guide correctly shows "Loading" instead of a count, which the script waits for in vain. Its Import arms I1 and I2 were run on their own, before and after.
- **Scripts that exit 1.**
  - The three kid scripts stop at "no ✓ to tap", before and after: batch 0d removed the kid's ✓.
  - `verify-double-tap-removes-next-item-2-probe` stops after the fix because the finishing card has an Undo where it expects every card to have a ✓.
  - The new check covers both.

| Finding | Before | After |
|---|---|---|
| P3-LEFTOVERS-01 (double-tap-1, -2) | the second tap lands on the next item's ✓: both removed on the server in every arm (T350, DBL; double-lastInGroup, double-ipad, double-chromium) | the second tap lands on the same card's Undo (ignored in its first 0.7 s); nothing else is touched; larder-check A: after six seconds exactly the tapped item is gone, the next stays, and every card kept its position and height |
| P3-LEFTOVERS-12 (critic-remote-shift, rerender-1-1, 1-2) | after the other device's change the card under the aimed point is the next one ("Sunday pot roast", "Blueberry pancakes") and the tap finishes it | the aimed card stays under the point and receives the tap in every arm (A, B, SAME, SAMEMOUSE, C); larder-check F (finger down during the change) and G (the "1 new" pill) |
| P3-LEFTOVERS-13 (kid scripts) | stop at "no ✓" (batch 0d) | the same; larder-check E: no ✓, add bar or Hearth block for a kid, and the house refuses a kid's tombstone (403 not_allowed) |
| UX-LEFTOVERS-1 | no undo, no history | larder-check A–D and H: Undo on the card and the toast, Recently finished with Put back (size and date kept), leaving the app still finishes, the history never moves under a finger; after-screenshots `larder-finishing-iphone.png`, `larder-recently-finished-iphone.png` |
| UX-LEFTOVERS-2 (kid.mjs) | the full adult page | the picture view; after-screenshot `larder-kid-ipad.png` |
| P3-DOLLYWOOD-02 (import-any-json-1/2, data-checks I1/I2) | a prayer backup leaves "0 of 9 done"; an older export replaces 24 ticks with 2 | both leave "7 of 9 done" and the 24 ticks (the scripts dismiss the new confirm); guide-import-check W, X, E: a wrong file and a file with no steps change nothing and say so, an export adds its one new step and unticks nothing, and Undo takes it back |

**New checks.**
- `audits/tools/phase6/0h/larder-check.mjs` (A–H) passes 8 of 8 on the final code.
- `guide-import-check.mjs` passes 3 of 3.

### Capture rig

- **The runs.** The areas whose code changed were recaptured on the final code: the Larder 184, the build guide 432, the park map 722 (a new export of the same template) and the shell 979 (the leave hook) — 2317 captures, 0 failed (`audits/screens-after/0h/manifest.json`).
- **Against the last capture of each area** (`audits/evidence/p6/0h/capture/pxdiff-*.txt`: the Larder and the park map against batch 0d's, the build guide against 0e's, the shell against 0g's):
  - **The Larder: 162 changed, all intended.** Every card's status chip now has a fixed width (so a card never changes width when it turns "Finished"). The kid screens show the picture view, and "finished" shows the new history. After-screenshots of the new states are in `p6/0h/`.
  - **The build guide: 5**, 1–12-pixel specks.
  - **The shell: 11**, the known run-to-run noise (the guest-form and pairing error animations, 1–2-pixel specks).
  - **The park map: 7.**
    - 4 are 1-pixel specks.
    - "Nearby offline" and "search loading" changed by 2–9%. A control recapture on the final code matches this run exactly, and the same two screens captured on the unchanged code (`f5099e2`) match it too (`pxdiff-pre0h-vs-0h-dollywood-live.txt`, 0 changed). So they changed in an earlier batch (0e re-exported the park map without recapturing it), not in this one.

### Rubric rescore

- On screen:
  - The ✓ now leaves a "Finished" card with Undo and a toast.
  - "Recently finished" appears under the list.
  - A "N new" pill appears when another device adds something.
  - Kids get the picture view.
  - The build guide's Import asks and says what it did.
- The rubric scores these under **Ease of use** (error prevention, undo, feedback) and, for kids, **Kid fit**.
- The orchestrator's rescore:

| Area | Ease of use | Kid fit | Why |
|---|---|---|---|
| Larder | +1.5 | +1.5 | no one-tap loss, Undo and a history, a stable list; a picture view for kids |
| Build guide | +0.5 | — | Import cannot erase progress |

- These are the orchestrator's judgements, not a rerun of Phase 4's scoring.

### Repo tests

The pre-batch results are batch 0g's after-run of the same suites (`audits/evidence/p6/0h/tests/repo-before-is-0g-after.txt`); this batch's run is `repo-after.txt`.

| Suite | Before | After |
|---|---|---|
| test-hub | 36 / 1 | 36 / 1 (the stale "signed in as Niece"; batch 2a) |
| test-leftovers | 42 / 0 | 42 / 0 |
| test-dollywood-sync, test-dollywood | 32 / 0, 34 / 0 | identical |
| every other suite | as before | identical |
| smoke-api.sh | 209 / 0 | 209 / 0 |
| smoke-chat.sh (mock model) | 39 / 1 | 39 / 1 (the same stale miss) |

- The build guide's `verify.py` passed on the rebuilt template (`tests/build-guide-verify.txt`).
- `node scripts/bump-sw.mjs --check`: 74 precached files present, 67 shipped files accounted for.
- The tests' screenshots in `docs/screens/` were restored.

### Not verified, and known limits

- **Nothing is deployed.** The pages, the SDK change and the Worker's chat change go together. Batch 0d's migration still has to run first.
- **Leaving by closing the whole browser window within the six seconds** was not verified. In the rig the send from a page that is navigating away did not arrive (WebKit), while leaving through the hub (its Back, a Switch) did.
- **On a phone**, an app put in the background finishes and sends at once (`visibilitychange`). A real iPhone swipe-away was not exercised.
- **An item edited on another device** (its date changed) updates in its old slot under the old heading until the list is next laid out. No screen edits items; only chat's `set_data` could.
- **The group counts and the "N at a week or older" line** update on the next layout, not in place.
- **The food pictures** are chosen by keywords in the name. "Chili" gets a stew pot, but "Chicken alfredo" gets a drumstick and "Blueberry pancakes" a slice of cake. Names with no keyword get the default lunch box.
- **Real devices** were not used. Every check ran in the rig's WebKit and Chromium.

## Batch 0i — Chat: writes that do what was asked, and say when they did not

| | |
|---|---|
| **Findings** | 7 entries, all primaries: 2 critical, 4 medium, 1 low. All 7 FIXED (status per entry in `audits/05-findings.md`). |
| **Code commit** | `97c39a0` (2026-09-29) |
| **Files** | `worker/src/chat.js`, `worker/src/index.js` (`POST /api/chat/undo`), `worker/src/policy.js` (`bad_date`; the Undo store refused; `wantBefore`), `worker/src/reminders.js` (the 8 am push and unknown dates), `apps/leftovers.html` (unknown and future dates), `index.html` (the chip's Undo; Home's fridge card), `scripts/smoke-chat.sh` (39 → 53 checks), `scripts/mock-anthropic.mjs`, `scripts/smoke-api.sh` (209 → 215), `CLAUDE.md`, `worker/README.md`, `sw.js` (`hub-v35` → `hub-v36`) |
| **Schema / data** | No schema change and no migration. Chat's Undo records are `app_data(person, chatundo, <token>)` rows: the data API refuses them, and they are deleted after use or ten minutes. From now on the house refuses a Larder row whose date is not a real day or is later than tomorrow. Existing rows are untouched and are shown as "Check date". The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-29-before-0i.sql` (37 KB, 43 app_data rows). Nothing was deployed. |
| **How it was built** | By the orchestrator. The review loop ended before the final run this time. An independent review found 16 items (1 high, 3 medium, 12 low or nit); 15 were fixed and 1 nit left. A second pass found 1 gap and 3 new low, all fixed. A third pass found 1 medium and 1 low, both fixed. A fourth pass confirmed with no new issue. |

### The change

- **Finish a leftover (P2-CHAT-03).** Only an exact name or the item's id acts. Otherwise chat lists the likely items and asks which one; a shared word never picks one. Numbers are not words, so a stray run number never matches.
  - Prayers, which had the same loose matching (`mark_prayed`, `answer_prayer`), now follow the same rule.
- **"Not saved" means not saved (P2-CHAT-09).**
  - A write that another change beat under last-write-wins is no longer a ✓. The action's earlier writes are put back, and a red chip says "✗ Not saved — someone changed it just now".
  - Rows that only follow from the main one (the F260 log and summary, prayerDays, the Larder's finished row) are written best-effort, stamped as they are written, and never fail the action.
  - A family prayer tick the house already has is a success.
- **Undo (GAP-CHAT-02).**
  - Every chat action that wrote something carries an Undo token, and the Chat tab shows Undo on its chip for 30 seconds.
  - `POST /api/chat/undo` puts back what the action wrote, once, within 45 s, and only for the person who did it. It is all or nothing: if any main row was changed since (someone else's tick, a new day, taps on a reset tally), nothing is undone and chat says so.
  - A prayed day is never taken back out of prayerDays.
  - The feed gets "Undid: …" in the action's own feed wording, so a private prayer is never named. The chat history gets "↩ Undone: …".
- **The general "set" tool (P2-CHAT-01).** `set_data` now changes only three settings: the tally count, the running timer and the person's look. Anything else is refused ("That cannot be changed from chat") and is changed in its app or with its own tool.
- **Tick means tick (P2-CHAT-04).** `toggle_f260_reading` is now `set_f260_reading {week, day, done}`. Asking to tick a ticked reading changes nothing and says "was already checked off".
- **Larder dates (P3-LEFTOVERS-04, -09).**
  - Chat takes a real date, or today, yesterday or "N days ago". It refuses anything else and any future date.
  - The house refuses a Larder row whose date is not a real day or is later than tomorrow, from chat and the data API alike.
  - Rows already stored:
    - An unknown date shows as "Check date" among the oldest.
    - A future date reads as today.
    - Home's fridge card shows "date?".
    - The 8 am push says "check the date".
  - Put back and the one-time move of old items from the device's storage bring an unacceptable date back as the finish day or today.

**What the independent review changed.**
- **High.** The Undo's feed line repeated the chip, which can name a private prayer.
- **Medium.**
  - Undo could half-happen, or lose an item with an old-style date. It is now all or nothing.
  - A partial Undo left follow-on rows out of step.
  - Put back of an old-dated item was refused while the feed said it happened.
  - (Third pass) The "already there" shortcut must not apply to an answer.
- **Low.**
  - The date rule had no tolerance for a slightly fast clock.
  - Follow-on writes could fail the whole action.
  - The Undo store was reachable through the data API.
  - Rollback ran only on a lost write, not on any failure.
  - A tally Undo could drop taps.
  - The "before" read raced the write; an Undo after midnight.
  - The chat history kept a ✓ after an Undo.
  - Accessibility of the chip button; no chip for a lost write.
  - The push ignored unknown dates.
  - Prayer matching was still loose.
  - (Second and third passes)
    - Word dates were not normalised on Undo.
    - F260 Undos failed while the app was open (follow-on rows now left out of the check).
    - A false "Not saved" on a prayer tick.
    - "99 days old" in the push.
    - The chat wording when nothing was undone.
    - Undo removing a prayed day someone else also had.

### Each finding's reproduction, rerun

**How they were run.**
- The 11 scripts the entries name ran three at a time on the unchanged code (`git archive` of `c7ada90`) and on the final code. Outputs and exit codes are in `audits/evidence/p6/0i/tests/repro-before/` and `repro-after/`. The changed evidence files were moved into `p6/0i/p2|p3/`, and the Phase 2/3 baseline was restored (git shows it clean).
- **The old tool name.** The three F260 scripts script the old tool `toggle_f260_reading`, which is now refused as unknown; they show that nothing is unticked. The new behaviour is checked by smoke-chat.
- **Exit codes.** All 11 exit 0 before. After, 10 exit 0, and `verify-no-js-date-guard-2` times out waiting for a future-dated row that the house now refuses.

| Finding | Before | After |
|---|---|---|
| P2-CHAT-03 (finish-leftover-wrong-item-2) | a vague request finishes Chicken alfredo on a shared word; the 8 am list drops it | Chicken alfredo stays on the 8 am list; smoke-chat: "We ate the pasta …" asks and finishes nothing |
| P2-CHAT-09 (lww-lost-write-shows-tick-1) | "✓ Finished Chicken alfredo" while the item stays live, with a feed line | "✗ Not saved — someone changed it just now", ok false, item still there, no feed line; chat-check A, B |
| GAP-CHAT-02 | no confirm, no undo | chip Undo for 30 s, all-or-nothing Undo route; chat-check C, D, G, H, E (screenshots `chat-undo-chip-iphone.png`, `chat-undone-chip-iphone.png`) |
| P2-CHAT-01 (set-data-overwrites-any-row-2) | "✓ Saved bad key & symbols! in tally", "✓ Saved album:alb0016 in hub": any row written and posted | no chip, nothing stored, no feed line for them |
| P2-CHAT-04 (toggle-f260-unticks-1, rev3-chat-04-restore) | a tick request unticks 38-0 (weekDone 2 → 1) | the old tool is refused and nothing changes; smoke-chat: asking twice to tick answers "was already checked off" and never unticks |
| P3-LEFTOVERS-04 (non-iso-date-nan-1/2, entry) | "yesterday", "9/20/2026", "2026-09-20T18:00" stored as typed; "NaNd ago", Fresh, never warned | "yesterday" is stored as 2026-09-21, the others are refused; the bar reads "0.1 / 1 of 10 days"; a stored unreadable date shows "Check date" (chat-check F, `larder-check-date-iphone.png`) |
| P3-LEFTOVERS-09 (no-js-date-guard-1/2, future-date) | a typed 2026-09-30 is stored; a card reads "-3d ago", Fresh | typed future dates land as today; the API PUT is refused 403; guard-2 waits in vain for the refused row |

**New check.** `audits/tools/phase6/0i/chat-check.mjs` (A–H) passes 8 of 8 on the final code.

### Capture rig

- **The runs.** The areas whose code changed were recaptured on the final code: the Larder 184, the shell 979 (the chat chip, Home's fridge card) and the TV 34 — 1197 captures, 0 failed (`audits/screens-after/0i/manifest.json`).
- **Against the last capture of each area** (`audits/evidence/p6/0i/capture/pxdiff-*.txt`; the Larder and the shell against 0h's, the TV against 0g's):
  - **The Larder: 6**, all 2-pixel specks.
  - **The shell: 9**, the known run-to-run noise: the first-visit toast, the guest and pairing error animations, 1-pixel specks, and the profile picker's 2-pixel scroll offset.
  - **The TV: 2**, the crossfading background photo.
- The Undo chip and "Check date" appear only in states the capture does not seed. Their after-screenshots come from the new check.

### Rubric rescore

- On screen:
  - The chat chip carries Undo, and a lost write shows a red "Not saved".
  - The Larder shows "Check date" for an unreadable date.
- The rubric scores these under **Ease of use** (error prevention, undo, feedback).
- The orchestrator's rescore:

| Area | Ease of use | Why |
|---|---|---|
| Chat (shell) | +1 | an action does what was asked, says when it did not, and can be undone |
| Larder | +0.5 | no item hides under Fresh with a date nobody can read |

- These are the orchestrator's judgements, not a rerun of Phase 4's scoring.

### Repo tests

The pre-batch results are batch 0h's after-run of the same suites (`audits/evidence/p6/0i/tests/repo-before-is-0h-after.txt`); this batch's run is `repo-after.txt`.

| Suite | Before | After |
|---|---|---|
| test-hub | 36 / 1 | 36 / 1 (the stale "signed in as Niece"; batch 2a) |
| every other suite, and test-kitchen | as before | identical |
| smoke-api.sh | 209 / 0 | 215 / 0 (the kitchen's Larder fixture now carries a date; 6 new checks for the date rule) |
| smoke-chat.sh (mock model) | 39 / 1 | 53 / 0 (14 new checks: Undo, tick means tick, no guessing on a shared word, dates; the old stale kid check now asserts the set_data allowlist) |

`node scripts/bump-sw.mjs --check`: 74 precached files present, 67 shipped files accounted for. The tests' screenshots in `docs/screens/` were restored.

### Not verified, and known limits

- **Nothing is deployed.** The Worker (chat, the Undo route, the date rule, the push wording) and the pages go together. Batch 0d's migration still has to run first.
- **A real model was not used.** Every chat check ran against the mock (`scripts/mock-anthropic.mjs`) or the rig's scripted stand-in. Whether Claude itself asks "which one?" well is not measured.
- **Switching away from the Chat tab** redraws the chat from history, so a live Undo button (30 s) is gone after a tab switch. The action stays undoable through the API for 45 s, but not from the screen.
- **Undo is refused whenever a main row changed since**, even when the change was unrelated to the chat action (another field of the same request). That is the safe side.
- **An Undo after New York midnight** of a family prayer tick counts as changed, so it is not undone.
- **The Larder rows already stored with an unreadable date** are not rewritten; they show as "Check date" until someone edits or finishes them.
- **Real devices** were not used.

## Batch 1 — The v3 design tokens: one colour, type, glass and motion system in every app

| | |
|---|---|
| **Findings** | 150 entries: 1 high, 18 medium, 124 low, 7 info. **106 FIXED, 37 PARTIAL, 3 DEFERRED, 4 NEEDS DEVICE CHECK** (status and evidence per entry in `audits/05-findings.md`). Every PARTIAL and DEFERRED entry names the batch that owns the rest; most are app-local rows the migration table gives to the app's own batch, or shell rows it gives to batch 2. |
| **Code commit** | `80af987` (2026-09-29); the map template in the sibling repo `../dollywood-build-project`: `83d6fcd` (template, build script, verify.py) and `6192e96` (rebuilt outputs) |
| **Files** | `apps/design.css` (the token half replaced by `audits/tools/phase4/tokens/proposed-tokens.css`, byte for byte; the component half on the v3 roles), `apps/hub.js`, `index.html`, `docs/design.html`, every app (`f260`, `prayer`, `leftovers`, `tally`, `timer`, `kidverse`, `verses`, and the two Dollywood exports), `manifest.json`, `sw.js` (`hub-v36` → `hub-v38`), `icons/LICENSE-lucide.txt` (new), `worker/migrations/007-profile-hue.sql` (new), `worker/seed.sql`, `worker/src/index.js`, `worker/src/policy.js`, `worker/README.md`, `CLAUDE.md`, 19 test scripts under `scripts/` |
| **Schema / data** | No schema change (the `hue` column exists since 006). **Migration 007** fills `profiles.hue` where it is empty with the starting colours of decision D3 (Eli periwinkle, Mae peach, Elizabeth bubblegum, David mint, Mea butter, Ezra aqua, Kiara lavender, the TV and the kitchen graphite, guests sky); it is idempotent and needs 006 first. Neither 006 nor 007 has run on production. The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-29-before-1.sql` (37 KB). Nothing was deployed. |
| **How it was built** | A core worker landed the tokens, hub.js, the pre-paint bootstrap, the shell and the Worker's `hue`; six app workers (F260; Prayer; Larder; Tally and Timer; Kid Verse and Verses; the Dollywood template) then did each app's batch-1 rows and findings; a seventh did the shell's follow-ups from review. Three independent reviewers (core logic; screens and runtime; findings and the token file) ran four rounds; the loop ended on a verification with no new findings, before the final run. |

### The change

- **The tokens.** `apps/design.css` now opens with the v3 token set the owner approved (revision 6e): Dynamic Type roles scaled by the person's text size, the iPad tier and the kid scale; six palettes (Graphite is new, decision D2) plus System; nine person families and nine app families, each with its `-ink`, `-strong` + `-on`, `-graphic`, `-fill` and `-wash` roles; semantic families (success, warning, danger); elevation, radii, spacing and motion tokens; the four glass levels (D8). Legacy names still resolve, as AA inks. The component half now reads those roles: every content card is solid, glass is only the bars, sheets, pills and floating controls, one focus ring, `.pressable`, and Reduce Motion keeps only opacity and colour changes of 150 ms or less.
- **The person's colour is a family, not a hex.** Profiles carry `hue`; hub.js writes `data-accent` on `<html>` and on every face (`hub.avatarHtml`), and any element with `data-accent` re-derives every accent role for its subtree. A stored session without a hue maps its hex through the bootstrap's table; a guest defaults to sky. The admin's Edit sheet and Add a guest pick a family (the full 18-family picker is batch 2a); the feed's faces carry their author's family.
- **The pre-paint bootstrap** (`audits/tools/phase4/tokens/bootstrap.js`, one copy byte for byte in every page's `<head>`; hashed into the Dollywood CSP) paints the palette, scheme, accent, kind, preferences and the `theme-color` meta before the first paint. `data-theme` is always the resolved palette (Hearth stays Hearth on a dark phone, P2-VIS-03).
- **Preferences** (D11). Me → Appearance adds Text size (XS to XXL), Glass (Clear · Current · Frosted · Solid, where Solid is Reduce Transparency), Increase Contrast and Reduce Motion: one person-scope `hub` row each, so they follow the person to every device; the TV and the kitchen keep theirs on the device. F260's old Large moves once to the hub size (D17).
- **One confirm sheet** (`hub.confirm` / `hub.alert`) replaces every native `confirm()`/`alert()` in the shell, F260 and the map pages: a titled sheet, the destructive button in the danger colours, focus on Cancel, Enter presses the focused button, Escape and the backdrop cancel.
- **Per app** (each worker's full list is in the status entries):
  - **F260**: category colours on `--cat-*`, the New Testament paper on `--aqua-wash`, every labelled solid paired with its `-on`, no opacity on text, text size through `--ts`, fields ≥ 16 px, smooth scrolls respect Reduce Motion, the toast is the shared one. Contrast failures (its own script) 150/91/91/41/41/41/42 → 0 in all seven palettes.
  - **Prayer**: inks for text, the current tab and chips on the selection solid, the family list in aqua, faces from their family, no web fonts (D13), the FAB solid, the toast on the toast tokens, text size scaled with floors (fields ≥ 16 px, nothing under 11 px).
  - **Larder**: the freshness ramp and chips on the semantic families with a glyph each, fields on `--field-border`, kid targets ≥ 64 px, no layout jump while loading, names wrap at large text sizes, the Lucide licence notice.
  - **Tally and Timer**: solid discs and dial in the person's colour, the numeral face, the selection solid on the presets, the arc and track readable in dark, time's up without red.
  - **Kid Verse and Verses**: the ★ buttons in butter for both kids, readable day letters, rings and empty dots, badges and captions, 16 px kid floor, no glass on content cards, Got it on the success pair (no lightening on hover).
  - **The map pages**: one glass recipe, solid chrome, the ask() sheet, kid targets and type floors, thin themed scrollbars; cartography keeps its colours (D12).
- **The Worker**: `hue` on every profile it returns (the feed too), accepted on Add a guest (default sky) and the admin's edit.

**What the independent review changed** (four rounds; details in the reviewers' reports in the session record).
- **Round 1.** A duplicate function name from a review fix stopped the shell booting (caught before any run; every inline script is now parse-checked); feed faces ignored the family; the colour pickers changed nothing visible; the D17 fallback could not be undone and showed the wrong size; a setting changed in an app wrote a stray `theme` row; a renamed person's name did not redraw; one test compared a function with itself; Me overflowed at text size L on a 390 px phone; the Larder cut names to a few letters at XL; the kid Timer scrolled sideways at XXL; F260's week ring label spilled; Prayer ignored the text size; Prayer's toast was still a light slab in dark; ten native dialogs remained in the shell (CONS-TELL-2); the chat field had no boundary or label; the shell kept phone margins on the iPad.
- **Round 2.** Enter on the new confirm sheet confirmed with focus on Cancel (now Enter presses the focused button); a second device kept the old Large after Normal was chosen; stacked sheets both closed on one Escape; two earlier-batch checks still waited for native dialogs; Prayer's fields shrank under 16 px at XS; the TV faded names with opacity; the Glass control ran past the card at XXL; usage dates wrapped; Me → Appearance did not follow a change made elsewhere.
- **Round 3.** An app already open on the other device kept the old Large (the shell now tells the open app to re-apply). **Round 4** confirmed with no new findings.
- **From the final run and the rescore** (fixed after them, then re-run: the Kid Verse, Verses, rewards, kid story, guests, apps, F260 and prefs suites all pass): the kid's seven day dots wrapped at 390 px, the kid Verses card grew on Show, Got it's hover sheen lowered it to 4.34:1, F260's paper stopped short of the bottom of a short page, and two Me rows wrapped their switch or face under the text.

### Each finding's reproduction, rerun

- **How they were run.** The 113 scripts the entries name ran three at a time on the unchanged code (`git archive` of `d186850`) and on the final code. Outputs and exit codes are in `audits/evidence/p6/1/tests/repro-before/` and `repro-after/`; the files the scripts wrote on the final code are in `audits/evidence/p6/1/p2|p3|p4/`, and the Phase 2-4 baseline was restored (git shows it clean).
- **Before.** 105 exit 0, 6 exit 1, 2 hit the 10-minute cap. Re-run with the measurement rig's git-ignored raw data restored, the COLOR script's two parts run separately and a longer cap: all but `phase3/verses/visual.mjs` ran (it fails on the old code too: its save block no longer catches hub.js's saves).
- **After.** 114 runs (the COLOR script in two parts): 108 exit 0, 6 exit 1. Five crash because they parse the old design.css format (hex values, `rgba()` only): `phase3/leftovers/critic-err-contrast`, `phase4/COLOR/remeasure` (its token part; its `raw` and `live webkit` parts run and are filed: lowest rendered text 5.77:1), `COLOR/verify-mid-tone-semantic-as-ink-2`, `COLOR/verify-muted-on-wells-and-derived-surfaces-2`, `DARK/palette-dark`; the sixth is `verses/visual` as before. The entries that rest on them take their verdict from the token gate, the rendered measurements and the probes, and say so.
- **Other stale scripts.** Several Phase 4 scripts re-read committed Phase 4 data or samples and print the same before and after (listed in the status entries); `ACCENT/runtime` skips all 728 cases on the final code; `TOK/literals` counts the bootstrap's colour table. None of them is used as after-evidence.

### The token gates and the checks

| Check | Result |
|---|---|
| `audits/tools/phase4/tokens/contrast.mjs` | 2,369 check kinds, 202,134 evaluations, **0 failing**; 40 of 40 mutations caught |
| `browser-check.mjs` | OK in WebKit and Chromium: 15,372 values each, 0 mismatches |
| `apps/design.css` token half vs `proposed-tokens.css` | byte-identical (`cmp`) |
| `audits/tools/phase6/1/verify-1a.mjs` (new: preferences follow the person, the display keeps its own, a profile refresh, faces carry their own family, the theme-color meta, the sheen on the bars only, Prayer's one meta) | WebKit 26/0, Chromium 26/0 |
| Earlier batches' checks: `0c/forget-device` (answers the new sheet), `0f/kid-two-devices`, `0g/prayer-merge-check`, `0g/check-ids.js`, `0h/larder-check`, `0h/guide-import-check` (answers the new sheet), `0i/chat-check` | 14/0; A-C; A-H; 49/0; A-H; W, X, E; A-H — all pass |
| `handoff/prayer/check.js` (not edited: do-not-touch) | 47/2, the two name-format checks as since batch 0g |
| Every inline script parses (`node` `vm.Script` over every page) | 29 of 29 |

### The measurement rig (Phase 4), re-run on the final code

`node audits/tools/phase4/measure.mjs --run themes|devices|states` then `aggregate.mjs` (3,662 jobs, 0 failed); the summaries are in `audits/evidence/p6/1/measure/`, beside the committed pre-batch ones in `audits/evidence/p4/measure/`.

| Area | Text below AA: selectors, before → after | Occurrences, before → after |
|---|---|---|
| Shell (with the TV) | 132 → 33, TV 65 → 48 | 2,445 → 737, TV 467 → 104 |
| F260 | 688 → 115 | 25,250 → 142 |
| Prayer | 109 → 28 | 1,517 → 164 |
| Larder | 3 → 0 | 19 → 0 |
| Timer | 35 → 13 | 92 → 41 |
| Kid Verse | 39 → 6 | 1,774 → 12 |
| Verses | 1 → 5 | 14 → 10 |
| Build guide | 95 → 23 | 22,766 → 451 |
| Park map | 180 → 31 | 6,566 → 551 |
| **All** | **1,347 → 302** | **60,910 → 2,212 (−96 %)** |

What is left, checked group by group: controls disabled while an app loads or before a PIN is complete (exempt: WCAG 1.4.3 does not cover disabled controls; this is what Verses' and the Timer's new rows are), captions over the album's photos and the TV's hidden Me screen (batches 2a and 2c, fewer than before), feed names coloured inline (batch 2a: `data-accent` on every row), F260's done toast passing over two buttons for its 2.2 s, and rig artefacts where the sample missed the element (F260's Set passcode reads the page's own colour under a solid green button). Verses' desktop Got it at 4.34:1 was the hover sheen, since removed.

### Repo tests

The pre-batch results are batch 0i's after-run of the same suites.

| Suite | Before | After |
|---|---|---|
| test-design (not in batch 0i's run; 49 / 0 at batch 0a) | 49 / 0 | 60 / 0 (the new palette, the nine families in six palettes, `color-scheme`, Reduce Motion by `data-motion`) |
| test-hub | 36 / 1 | 36 / 1 (the stale "signed in as Niece"; batch 2a). The kid tap-target check now measures the resolved `--tap` |
| test-prefs | 17 / 0 | 35 / 0 (theme, text size, contrast, glass and motion follow the person; a stale mirror loses to the row; the display keeps its own; F260's Large moves once) |
| test-f260 | 52 / 0 | 58 / 0 |
| test-rewards, test-guests | 73 / 0, 50 / 0 | 73 / 0, 56 / 0 (they answer the new confirm sheet, and any native dialog now fails them; test-guests picks a colour family) |
| test-kidverse, test-kidstory, test-verses, test-prayer-faces | 51 / 0, 50 / 0, 80 / 0, 41 / 0 | 51 / 0, 50 / 0, 80 / 0, 41 / 0 (they read the app's `<style>` only for OS-scheme rules, the bootstrap reads it in JS; faces are checked against the seeded families) |
| every other suite and test-kitchen | as before | pass, identical counts |
| smoke-api.sh | 215 / 0 | 215 / 0 |
| smoke-chat.sh (mock model) | 53 / 0 | 53 / 0 |

`node scripts/bump-sw.mjs --check`: 74 precached files present, 67 shipped files accounted for. The tests' screenshots in `docs/screens/` were restored.

### Capture rig

- **The run.** Every area was recaptured on the final code: 4,447 captures, 0 failed (`audits/screens-after/1/manifest.json`; the PNGs are git-ignored like every capture set).
- **Against the Phase 1 baseline** (`audits/evidence/p6/1/capture/pxdiff-all.txt`): all 4,447 differ beyond the tolerance, as they must when every colour, type size and radius moves; the pixel diff therefore says nothing about any one screen. What the batch did to each screen was judged by eye instead: each per-app worker looked at 7-13 of its own screens, the screens reviewer at about 70 in its first round (before/after pairs across every area) and at new ones in each later round, across every theme, both schemes, iPhone and iPad and the new preferences (its findings and the fixes are above), and the rubric rescore below compares the scorecard's own screens.
- **The "before" set itself.** A mistyped command started a capture into `audits/screens/` and overwrote 144 park-map PNGs before it was stopped; each was restored from a byte-identical copy in an earlier batch's capture set, and all 4,447 now match the committed manifest's SHA-256 again.

### Rubric rescore

An independent judge rescored the Phase 4 scorecard (`audits/04-design-system.md`: the same eleven dimensions, anchors, shared bases and written calibration rules) from the final capture, the scorecard's own screens before and after (88 composites), the re-run measurement rig and the status entries. The judge's full record, with the rules behind every cell and the screenshots, is `audits/evidence/p6/1/rescore.md`.

| Area | Typ. | Colour | Layout | Shape | Icons | Motion | Dark | Native | Glance | Ease | Delight | **Average** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Shell (with the TV board) | 4.5 → 6 | 2.5 → 5 | 5 → 6 | 4 → 5.5 | 4 → 4.5 | 2.5 → 3 | 4 → 5.5 | 4 → 6 | 4 → 4.5 | 4 → 5 | 6.5 → 7 | 4.1 → **5.3** |
| F260 | 3 → 5 | 2 → 5 | 5 → 5.5 | 4.5 → 6 | 3 → 3.5 | 3.5 → 4.5 | 4.5 → 6.5 | 4 → 5 | 3 → 5.5 | 5.5 → 6.5 | 6 → 6.5 | 4.0 → **5.4** |
| Larder Ledger | 4 → 6 | 4.5 → 6.5 | 4 → 4.5 | 5.5 → 6.5 | 4.5 → 5 | 3 → 5 | 4.5 → 6.5 | 4 → 5.5 | 3 → 3.5 | 3 → 6 | 4 → 5.5 | 4.0 → **5.5** |
| Prayer | 4 → 5.5 | 2.5 → 5 | 4 → 5 | 4.5 → 6 | 4.5 → 5 | 4 → 5 | 4.5 → 6.5 | 5 → 6 | 3 → 3.5 | 4 → 5.5 | 6 → 6.5 | 4.2 → **5.4** |
| Tally counter | 4.5 → 7 | 5 → 6 | 5 → 5.5 | 4 → 5.5 | 4 → 5.5 | 4 → 4.5 | 5 → 6.5 | 5.5 → 6.5 | 6 → 6.5 | 4 → 5 | 4 → 4.5 | 4.6 → **5.7** |
| Kitchen timer | 6 → 7 | 4 → 6 | 5.5 → 6 | 3.5 → 5.5 | 3 → 3.5 | 4 → 4.5 | 5 → 6.5 | 5 → 6 | 5 → 5.5 | 3.5 → 5 | 4 → 4.5 | 4.4 → **5.5** |
| Dollywood build guide | 3 → 4 | 2 → 4.5 | 3 | 4 → 5 | 3 | 2.5 → 3.5 | 4.5 → 5 | 3 → 5 | 3 → 3.5 | 3 → 3.5 | 5 → 5.5 | 3.3 → **4.1** |
| Dollywood park map | 3 → 5 | 2 → 4 | 3.5 | 5 → 6 | 3.5 | 3.5 → 4.5 | 4.5 → 5 | 4 → 5 | 5 → 5.5 | 3 → 4.5 | 7 → 7.5 | 4.0 → **4.9** |
| Kid Verse | 3 → 6 | 2.5 → 6 | 4.5 → 5 | 4 → 5.5 | 4 → 4.5 | 4 → 5 | 4 → 6 | 5 → 6.5 | 5 → 5.5 | 5 → 6 | 5.5 → 6 | 4.2 → **5.6** |
| Verses | 5 → 6 | 3.5 → 4.5 | 5.5 → 6 | 4 → 5.5 | 6 → 6.5 | 4 → 4.5 | 4.5 → 6.5 | 5 → 6 | 4 → 5.5 | 4 → 5 | 5 → 5.5 | 4.6 → **5.6** |
| **Apps mean (9)** | 3.9 → 5.7 | 3.1 → 5.3 | 4.4 → 4.9 | 4.3 → 5.7 | 3.9 → 4.4 | 3.6 → 4.6 | 4.6 → 6.1 | 4.5 → 5.7 | 4.1 → 4.9 | 3.9 → 5.2 | 5.2 → 5.8 | 4.1 → **5.3** |

- **Reading it.** 106 of 110 cells rose, 4 held (the two map pages' Layout and Icons), none fell. Dark mode is now the strongest dimension (6.1) and Iconography the weakest (4.4): the shared icon set is each app's own batch.
- **How much is judgement.** About 0.75 of each Hearth row's gain comes from re-pricing the shared bases, raised only where a Phase 4 "against" item is FIXED and visible in the after-screens. Held at their Phase 4 values, with only the rules moving, the apps' mean is about **4.6** (shell 4.5). The honest range is **4.6-5.3**. The judge's four policy calls are stated in the record so they can be overruled: the 4 px spacing-grid rule is not charged for the kid ×1.25 scale (Kid Verse's grid share 98 → 51 %, Tally 100 → 74 %; applied literally Kid Verse's Layout would be 4 and Tally's 5); the type-count rule reads the code, not the iPad tier's multiplied sizes; glass on content is charged half where only a secondary glass button remains; F260's and Verses' glance gain rests on the key fact's size (64-72 px on the iPad), not a re-run.
- **What the judge found worse, and what happened to it.** F260's New Testament wash stopped part way down a short page in dark, leaving a black band: fixed after the rescore (the page fills the screen). Me → Notifications' switch and the kids' faces in Kids' rewards wrapped under their text on an iPhone: fixed (the text shrinks first; Me re-measured at 375/390/430 px and M/L/XXL with nothing past the screen). Verses' Got it at 4.34:1 on desktop was the hover sheen, removed before the rescore but after the rig ran. Left: the build guide's hero stat wraps to its own row on the iPad portrait (58 px taller; its batch 9), "Downstairs TV" wraps in the profile picker (batch 2a), the kid scale and the kiosk's ×1.5 radii are off the 4 px grid and the concentric radii by design, and the Larder's chips gained ✓ ! ✕ glyphs (GAP-ICON-2 wants them as icons, in its batch). The rig's heuristic non-text counts rose in Prayer and the shell (information graphics, control boundaries); not confirmed by eye.

### Not verified

- **A real iPhone and iPad.** The rig's WebKit paints no backdrop blur, so the four glass levels, Clear and Current's halo, and Solid are verified as computed styles and in the preview, not as rendered glass. The four NEEDS DEVICE CHECK entries: press feedback on a tap (GAP-MOTION-3, VIS-TALLY-7), rows under F260's practice sheet on an iPad (VIS-F260-16), and no callout when a kid long-presses the story art (VIS-KIDVERSE-10).
- **Production.** Migrations 006 and 007 have not run there; the Worker must not be deployed before them (006 first, then 007). Real push, the kitchen device with a real admin PIN, and the live Pages site were not exercised.
- **Stale scripts** (above): their findings rest on the gate, the rig and the probes.
- **Accepted deviations**, each judged by the findings reviewer: Prayer's family list takes aqua on the body except for kids (a kid is always on the family list); Prayer's extra category dots use `-fill-strong` (they sit beside the category name); F260's New Testament paper reads `--aqua-wash` directly so Done keeps the person's colour; the Timer's track is `--tint-fill-strong` because the spec's `--progress-track` measures only 1.07-1.47:1 on a light dial (a token note for the owner); the Larder's ✓ uses the success family; Tally's page lays the hero tokens over `--bg`.
- **Reduce Motion** now gives every element a 150 ms colour transition (the spec's rule), so a theme change fades rather than snaps, including the map's SVG; nothing moves.

## Batch 2a — The hub shell: Home, Apps, Me, Chat, the picker; the Kitchen device; the household's admin

| | |
|---|---|
| **Findings** | 56 entries (1 high, 7 medium, 36 low, 1 info, and 11 pointers to them) and one piece of household work (KITCHEN-2). **47 FIXED, 2 PARTIAL, 7 NEEDS DEVICE CHECK**; KITCHEN-2 done (status per entry in `audits/05-findings.md`). |
| **Code commit** | `65009df` (2026-09-29) |
| **Files** | `index.html` (most of the batch), `apps/hub.js` (`hub.whoDidThis`, `hub.lastSync`/`hub.lastSynced`, the error's `data`), `apps/prayer.html` and `apps/leftovers.html` (the kitchen's face sheet only), `apps/kidverse.html` (feed wording), `apps/design.css` (component half), `apps.json` (a `hue` per app, decision D5), `docs/design.html`, `sw.js` (`hub-v38` → `hub-v39`), `worker/src/index.js` (the household endpoints), `worker/src/policy.js` (the kitchen's Larder credit), `worker/src/chat.js` (feed wording, Graphite), `worker/README.md`, `CLAUDE.md`, the shell's tests and `scripts/smoke-api.sh` (215 → 275 checks), `scripts/test-kitchen.mjs` (both halves), `audits/tools/areas/shell.mjs` (the offline picker screens) |
| **Schema / data** | No schema change and no migration. The Worker keeps the ids of removed people in `settings` (`removed_profile_ids`) so an id is never handed out twice. The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-29-before-2a.sql` (37 KB). Nothing was deployed; migrations 006 and 007 are still not on production. |
| **How it was built** | Two workers shared `index.html` by region: one did the Kitchen device, the admin's household and colour picker, the Worker and Kid Verse's feed lines; the other every other shell entry plus the batch-2 app-icon rewrite carried from batch 1. Three independent reviewers (security and logic; screens and runtime; the entries) ran three rounds, and a fixer did round 1's 19 client items while the orchestrator did the Worker half; the loop ended on a verification with no new findings, before the final run. |

### The change

- **The Kitchen device (KITCHEN-2).** A kitchen device never shows the picker: at start and after any 401 the shell asks the house and signs in as the kitchen; offline it waits ("Waiting for the house"). Its Home is the calm, glanceable layout: the clock, the kitchen's running timer, food to eat soon, today's family prayers with faces, the reminders and the family album, at glance sizes. No Me or Chat tab; the Larder, Prayer, Timer and Tally only. Whoever acts is chosen on a face sheet (`hub.whoDidThis`): Prayed offers the household, kids included; the Larder's finish and the album's Add the adults. The admin marks a device as the kitchen in Me → Admin → Devices with their PIN, never from the kitchen itself.
- **The household's admin (GAP-PROF-a2, GAP-ACCENT-1).** Me → Admin → Household adds a person (adult or kid; an adult gets a one-time set-up code), removes one, adds an admin, hands the admin over or takes it away; each asks for the admin's PIN, and the house never ends with no admin. The colour picker offers all 18 families (the people's nine, then the nine app colours named after their app) and warns on a colour someone wears, an app's colour and a colour a colour-blind viewer would confuse with another person's; the admin decides.
- **Home** is built once per person and each card patched in place, so a half-typed reminder is never wiped by the 30-second pull (P2-HOME-01, high) and nothing flickers (P2-HOME-05, P4-MOTION-01). The feed refreshes itself (P2-PWA-05). A ticked reminder can be undone for 6 s (UX-HOME-8). On a phone the glance cards are a sideways pager with dots, the park card first on a park day, and Reminders on the first screen (UX-HOME-3); on the iPad the key numbers are at glance size (UX-HOME-1, partly); kids get picture tiles (UX-HOME-7).
- **The app colours** (decision D5, carried from batch 1): every app has a family in `apps.json`, and its tile, card head and icons wear it; the app icons are drawn with the v3 tile recipe (P4-ICON-01's rest, VIS-HOME-1, CONS-TOK-4). The shell's own cards (feed, reminders, album, guests) are graphite, never a person's colour.
- **The viewer** shows "Saving…" / "Offline · N waiting" over every app (UX-SYNC-a1), keeps a closed app for 60 s (UX-HOME-5, partly), goes back to where the app was opened and closes on Escape (UX-HOME-4), cannot be left blank by a tap during its exit (P4-MOTION-02), and its bar is solid (VIS-GLASS-2). The Switch sheet is a grid of app icons (UX-HOME-6).
- **Me**: the Sync card follows the dot and remembers "Last synced" per device (P2-SYNC-13, -14); a guest reads "Guest · until …" (P2-PROF-18); loading placeholders instead of false empties (P2-VIS-07).
- **Chat**: kids hear every reply and a spoken question sends itself (UX-CHAT-01, PWA-UX-4); a failed send offers Retry and a message sent offline waits on the device (UX-CHAT-02); refused writes get a red chip (UX-CHAT-03); the cap state is clear (UX-CHAT-04); only what the model still remembers is shown (UX-CHAT-05); the feed says what happened in words (UX-CHAT-06); times and day separators (UX-CHAT-07); the composer clears the side insets (P2-PWA-17).
- **Sign-in**: the picker's title is always in view (P2-PROF-12); expired guests are gone offline too (UX-PROF-a1); offline, the picker says it needs the house and waits (UX-PROF-a3, a deliberate change: signing in always needs the server); the PIN pad names the person (UX-PROF-a4) and counts down a lockout (UX-PROF-a5); kid controls are 64 px (UX-PROF-a9); the pairing-code sheet has labels and Cancel, and every sheet closes by dragging down (UX-PROF-a8). Kid Verse's feed lines no longer repeat the kid's name on the TV (P2-HOME-06).

**What the independent review changed.**
- **Round 1.** Security: the kitchen could credit a finished Larder item to a kid, a guest or the TV; a co-admin could reset another admin's PIN with no PIN; Add a person asked for no PIN; the last-admin rule could race; a removed person's id could be handed to a new person (inheriting their rows and app grants). The shell: Home crashed when the same person came back after the TV board; a failed chat message landed in the next person's composer after Switch; a reminder ✓ was committed as the next person after a session loss; the kitchen's reminder Undo lost a guest's reminder; half the colour picker (the app families) could not be saved; the feed repainted twice per pull; app cards wore people's colours; the viewer's sync note squeezed the app name away on a phone; the Me hero's name ran under Switch; the park card was the pager's fourth page; the kitchen kept an empty band; the new sheets let the page show through; the picker did not go offline live.
- **Round 2.** The Reminders and Guests cards still wore people's colours; the phone's short sync note was not read by VoiceOver; a queued chat message could be sent twice if the stream broke after the house answered. **Round 3** confirmed with no new findings.

### Each finding's reproduction, rerun

- **How they were run.** The 23 scripts the entries name ran three at a time on the unchanged code (`git archive` of `1aeef87`) and on the final code. Outputs and exit codes are in `audits/evidence/p6/2a/tests/repro-before/` and `repro-after/`; the files they wrote on the final code are in `audits/evidence/p6/2a/p2|p4/`, and the Phase 2-4 baseline was restored.
- **Exit codes.** Before: 22 exit 0, 1 exits 1. After: 20 exit 0, 3 exit 1, each explained: `verify-switch-lands-on-me-2` fails the same way before and after (its step waits for Me's Switch button on the Home the person already lands on); `verify-kids-chip-clipped-1` stops on the iPhone because the Kids card is now an off-screen page of the phone pager (the reviewer's copy that opens that page passes typical, long and 40-character names on all three devices, `review/kids-chip/`); `replay-shot` waits for a tile that dims, and none does any more.

| Finding | Before | After |
|---|---|---|
| P2-HOME-01 (draft-wiped-1, -2, leads) | the half-typed reminder emptied at 28.8 s, Home rebuilt 1× | Home rebuilt 0×, no keystroke lost, in WebKit and Chromium |
| P2-HOME-05 (rebuild-1, -2) | 2 rebuilds in 65 s; 0 of 465 nodes kept | 0 rebuilds; 471 of 471 nodes and 13 of 13 images kept; the feed replaced 0 times per pull |
| P2-HOME-03 (switch-lands-1) | already on Home since batch 0c | on Home in every case, now also after a 401 or a sign-out |
| P2-PWA-05 (feed-not-live-1) | Mom's line never showed | shows after the next pull |
| P2-HOME-06 (tv-kid-name-doubled-1, -2) | three TV lines read "Ezra Ezra …" | none |
| P2-PROF-12 (picker-title-hidden-2) | the title above the top (as high as −442 px) | the title in view, at 32 px |
| P2-PROF-18 (guest-hero-adult-2) | a guest's kicker read "Adult" | "Guest · until Sep 29" |
| P2-PWA-17 (composer-landscape-1) | 220 px of the composer under the side insets | 0 |
| P2-SYNC-13, -14 (me-sync-card-stale-2, last-checked-2) | the card disagreed with the dot; "Last checked: not yet" after an offline reopen | the card matches the dot at every step; "Last synced 3:25 PM" |
| UX-HOME-1 (glance) | iPad key numbers 2.7-3.5 mm, kid stars 5.2 mm | 6.0 mm, kid stars 10.4 mm (the rest partial) |
| P4-MOTION-01 (replay) | 18 tile pops as the grid re-rendered | 0 |
| P4-MOTION-02 (viewer) | a tap or a hash change during the exit left the viewer blank | both open the app |
| UX-SYNC-a1 (e7-sync-ui) | no sign over an app of changes waiting | "Offline · 3 waiting" over F260 (its part 3 reads inside the app's frame and still prints null) |

### Repo tests

| Suite | Before (batch 1's final run) | After |
|---|---|---|
| test-hub | 36 / 1 (the stale "Niece") | 37 / 0 |
| test-kitchen | 27 / 0 (server half only) | 55 / 0 (both halves: no picker, no Me or Chat, the four apps, the face sheets and their credits, the role with the admin PIN, a guest's reminder Undo) |
| test-home, test-apps, test-guests, test-timer, test-tv, test-prefs | 57 / 0, 48 / 0, 56 / 0, 45 / 0, 43 / 0, 35 / 0 | the same counts, all pass (their checks follow the new pager, sheets and viewer) |
| every other suite | pass | pass, identical counts |
| smoke-api.sh | 215 / 0 | 275 / 0 (the household endpoints and their refusals, the kitchen's Larder credit, the co-admin reset, id reuse) |
| smoke-chat.sh (mock model) | 53 / 0 | 53 / 0 |
| Earlier batches' checks (0c, 0f, 0g, 0h, 0i, verify-1a in both engines), the token gate, browser-check | pass | pass |
| `handoff/prayer/check.js` | 47 / 2 | 47 / 2 (the two name-format checks since batch 0g; not edited) |

`node scripts/bump-sw.mjs --check`: 74 precached files present, 67 shipped files accounted for; every inline script parses (29 of 29). The saved smoke-test outputs of this and earlier batches had the throwaway local test tokens and one-time codes blanked.

### Capture rig

- **The run.** The areas whose code changed were recaptured on the final code: the shell, the TV, Prayer, the Larder and Kid Verse, 2,246 captures, 0 failed (`audits/screens-after/2a/manifest.json`).
- **Against batch 1's final capture** (`audits/evidence/p6/2a/capture/pxdiff-*.txt`): shell 878 of 979 and the TV 33 of 34 changed, as the batch redesigned both (Home, the Apps grid, the viewer bar, the sheets, Chat, the picker). In the three apps, 1,224 of 1,233 captures changed, 963 of them only in the hub's viewer bar at the top (y ≤ 70: the solid bar, the back label, the sync note). The rest are the kid screens on the iPad in landscape and the desktop, where the kid's viewer bar is now 64 px tall and the app below slides down 24 px, the app itself unchanged (checked by eye: `leftovers/kid-typical-ipad-landscape-light.png` before and after); and 15 adult screens: 14 of Prayer's long pages whose content sits 1 px lower (the rig's known scroll wobble on Prayer's long pages; checked by eye on `prayer/today-family-faces-overflow-desktop-light.png` and `settings-categories-overflow-iphone-pwa-dark.png`) and one Larder screen in iPhone Safari.
- **The screens the batch is about** were looked at by the reviewers across three rounds (their final composites are in `audits/evidence/p6/2a/review/`).

### Not verified

- **A real iPhone and iPad** (the seven NEEDS DEVICE CHECK entries): a kid hearing replies read aloud and a spoken question sending itself (UX-CHAT-01, PWA-UX-4, PWA-UX-3), dictating a reminder (PWA-GAP-3), the phone pager's flick and snap (UX-HOME-3), dragging a sheet down (UX-PROF-a8), and "Dollywood" breaking between words at text size XXL, which depends on the device's hyphenation (VIS-HOME-1).
- **The Kitchen device in the capture rig**: the rig cannot set a device's role, so the kitchen is proven by `test-kitchen.mjs` (55/0) and the reviewers' probes (`audits/evidence/p6/2a/review/m-k390.png`, `m-k820.png`, `probes/`), not by rig captures.
- **The partial entries**: UX-HOME-1 (on the iPad the ring label, sub-lines, reminder text, bylines and feed are still small; the kitchen's Home is the calm layout) and UX-HOME-5 (app-to-app switching still reloads; no `hub.draft`). No later batch is named for the rest.
- **The colour-blind warnings** are measured on the families' graphic tone (people's colours never closer than ΔE 11 there); on the strong fill tones some people's and app colours come within ΔE 2 of each other for protan and deutan viewers (sky and cornflower, periwinkle and cornflower); the picker's warning list was not checked against those tones.
- **Production**: nothing deployed. Deploy order is unchanged: migrations 006, then 007, then the Worker.

## Batch 2b — The Worker: push, reminders, chat and the PWA

| | |
|---|---|
| **Findings** | 27 entries (1 high, 5 medium, 16 low, 1 info, and 4 pointers). **26 FIXED, 1 NEEDS DEVICE CHECK** (PWA-GAP-2: a real browser renewing a push subscription) (status per entry in `audits/05-findings.md`). |
| **Code commit** | `3944d37` (2026-09-29) |
| **Files** | `worker/src/reminders.js` (the cron, the park alert, prayer pushes, retries, the new praytime and prayedfor), `worker/src/index.js` (push subscribe / resubscribe / logout, chat history, stop), `worker/src/chat.js` (the atomic cap, the timeout and refunds, Stop, thinking replay, the prompt), `worker/src/push.js`, `worker/src/auth.js` (a sign-in takes over the device's push), `worker/wrangler.toml` (one `*/15 * * * *` cron), `sw.js` (`hub-v39` → `hub-v41`: fresh precache, the update flow, offline page, `pushsubscriptionchange`, the notification tap), `index.html` (Me → Notifications, Chat history, Stop, the update guards), `manifest.json`, `offline.html` (new), `icons/` (an opaque apple-touch-icon, a monochrome icon and a badge), `scripts/make-art.mjs`, `scripts/smoke-api.sh` (275 → 315 checks), `scripts/smoke-chat.sh` (53 → 64), `scripts/mock-anthropic.mjs`, `scripts/test-push2.mjs`, `scripts/test-park.mjs` (new), `scripts/test-guests.mjs`, `CLAUDE.md`, `worker/README.md` |
| **Schema / data** | No schema change and no migration. The chat counter uses `rate_limits`; the prayer and park memories use `settings`; push switches become one person row per switch (`push_pref:<kind>`) over the old `push_prefs` row, which stays a read-only base. The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-29-before-2b.sql` (39 KB). Nothing was deployed. **At deploy**: the Worker must be deployed for the new cron to run. |
| **How it was built** | One worker did the batch. Two independent reviewers (security and logic; the entries and the screens) ran three rounds: round 1 found 14 issues to fix (2 of them security), round 2 four in the round-1 fixes, round 3 confirmed with no new findings, before the final run. |

### The change

- **The park alert (P2-PWA-02, high).** The Worker's cron fires every 15 minutes and reads the New York time of each firing. A kid whose shared spot has not updated for 20 minutes, while an adult is at the park, is told once per quiet spell to each household adult; freshness is judged by the Worker's own clock, never the phone's. Before, the alert could fire in 5 of 15 scenarios; now in 15 of 15, within 25-35 minutes.
- **Push follows the person (P2-PWA-03, -12, P2-PROF-16, PWA-UX-1, PWA-UX-2).** A push subscription belongs to the person on that device: signing out, a sign-in by someone else, a PIN reset or a change of kind removes it. The test notification goes to this device only; the TV, kids and the kitchen cannot subscribe; household pushes skip guests. A tap on a notification meant for someone else says so instead of opening their app.
- **Pushes that are not lost (P2-PWA-04, -10, -11, P3-PRAYER-25).** A new family prayer is owed to each adult until a push to them is delivered, and an edit of its wording is never announced as new. A broken subscription no longer stops the day's jobs, and a failed push is retried within the hour.
- **Chat (P2-CHAT-05, -08, -10, -11, -12, -13, GAP-CHAT-01).** The Worker gives up on a silent upstream after 45 s and refunds the message; Stop really stops (no tool runs after it; a Stop before the model was asked costs nothing, after it counts one message); the daily cap is taken atomically; thinking is replayed whole; the prompt marks the admin and guests; usage counts New York days; Me → Chat history → Clear, and kids' chats go after 90 days.
- **The app itself (P2-PWA-08, -09, -15, -16, PWA-GAP-2, PWA-GAP-4, and the pointers P2-STAB-05, -10).** A new build is precached fresh and an always-open hub takes it at a quiet moment (never while something is typed, an app has unsaved input, a sheet is open or a reply is on its way); a first install shows no "updated" toast; offline, an uncached page shows a styled "Not saved on this device yet"; a changed push subscription is moved (with the device's token); the manifest and icons are complete.
- **GAP-PRAYER-1 (info)**: an optional daily "time to pray" (counts only, never a title) and "X prayed for your request" to the asker, each a switch in Me, off or on per person.

**What the independent review changed.**
- **Round 1.** Security: `POST /api/push/resubscribe` needed no sign-in, so anyone holding a subscription's address could move a person's pushes (including "Meet at …" park locations) to their own receiver — now it needs the device's token and moves only that device's rows; and a subscription outlived every way a session ends except Switch, so the next person on a shared iPad got the previous person's pushes — now any sign-in on the device, a PIN reset or a change of kind removes it. Also: the park alert trusted the kid phone's clock (false alarms every 15 min for a slow clock); Stop did not stop and Retry could repeat a write; a switch changed on one device could wipe the pray-at time set on another (now one row per switch); failed pushes were never retried by the cron; the update reload ignored typing when the page was hidden; a notification tap was lost when the hub was left inside an app; guests saw a catch-up they never got; the manifest's id changed existing installs; smaller push rules and wording.
- **Round 2.** Stop could buy model calls outside the daily cap; an untouched Larder, F260 or park map blocked the update forever (a prefilled date and hidden dialogs read as "busy"); after Stop the question came back even when the house had already acted; the Stopped note's style reached the chip. **Round 3** confirmed with no new findings.

### Each finding's reproduction, rerun

- **How they were run.** The 22 scripts the entries name ran three at a time on the unchanged code (`git archive` of `878868c`) and on the final code, and the worker's patched copies (filed in `audits/tools/phase6/2b/`) ran on the final code. Outputs and exit codes are in `audits/evidence/p6/2b/tests/repro-before/` and `repro-after/` (the patched copies are the `p6-2b__*` lines); the files they wrote on the final code are in `audits/evidence/p6/2b/p2|p3/`, and the Phase 2-4 baseline was restored.
- **Exit codes.** Before: 21 exit 0, 1 exits 1 (the park script: since batch 0d a kid's dot is refused unless an adult has switched the kid's beacon on, which it never does). After: 18 exit 0 and 4 exit 1, each explained: the park script fails the same way; `verify-deploy-invisible-within-max-age-2` stops because its own fix patch is already in the code; the shared-device and test-button scripts cannot reach the step they tap any more (the next person's switch now reads Off and the test button is hidden). Their patched copies all exit 0, as do the worker's shell check and cron check.

| Finding | Before | After |
|---|---|---|
| P2-PWA-02 (park, the patched copy with the beacon on) | 7 of 15 quiet spells told (5 of 15 at the old cron times, and a guest was pushed) | 15 of 15, each within 25-35 min; test-park 20/0 |
| P2-CHAT-05 (no-timeout-on-hang-2) | the tab released at 67 s with "Load failed", the message spent | the Worker ends it at 45.9 s and refunds (used 5 → 4) |
| P2-CHAT-08 (cap-check-not-atomic-1) | up to 7 over the cap (159 at worst) | 0 over (a burst of 100: 1 answered, 99 refused) |
| P2-CHAT-10 (failed-upstream-spends-cap-1) | 59 failures used up the day | 80 failures, the count stays 1 |
| P2-CHAT-11 (thinking-blocks-dropped-1) | 0 thinking blocks replayed | 1-2, each starting the turn |
| P2-CHAT-12 (prompt-admin-and-expired-guests-1) | an expired guest and the TV named, the admin unmarked | left out; the admin and guests marked |
| P2-CHAT-13 (usage-utc-vs-cap-1) | Dad's usage grouped by UTC day | by New York day, as the cap |
| P2-PWA-03 (push.mjs; the shared-device copy) | after Switch the device kept 2 subscriptions and the next person saw "On" | the row gone; "Off for you on this device" |
| P2-PWA-04 (prayer-push-lost-after-morning-1) | a prayer added after the 8 am push reached only Mom | reaches every adult at 8 pm |
| P3-PRAYER-25 (title-edit-announced-as-new-9-1, -2) | a wording edit announced as "New on the family list" | not announced |
| P2-PWA-08 (open-page-never-takes-new-build-2) | the iPad and the TV kept running the old build | take the new build |
| P2-PWA-09 (the deploy copy) | a new version precached the old files (A: old ×3) | the new files, cold opens run the new build |
| P2-PWA-10 (keyless-subscription-aborts-job-1) | one bad row made the morning job fail (500) | 200; the bad row removed |
| P2-PWA-11 (failed-send-blocks-day-1) | a push that failed at 8:00 blocked the day | retried and delivered at 8:30 |
| P2-PWA-12 (the test-button copy) | "Sent" reached Eli's phone too | this device only |
| P2-PWA-15 (first-visit-hub-updated-2) | "Hub updated" on 5 of 24 first installs | 0 of 24 |
| P2-PWA-16 (build-guide-offline-blank-1) | a bare "Offline" | a styled "Not saved on this device yet" |
| P2-PROF-16 (kiosk-push-allowed-2) | the TV could subscribe and send tests (200/200) | 403/403 |

### Repo tests

| Suite | Before (batch 2a's final run) | After |
|---|---|---|
| smoke-api.sh | 275 / 0 | 315 / 0 (push rules, resubscribe needs the device token, a sign-in takes over the device's push, chat stop and history, keyed subscriptions) |
| smoke-chat.sh (mock model) | 53 / 0 | 64 / 0 (timeout and refund, the cap, thinking replay, Stop) |
| test-push2 | not in batch 2a's run (broken since batch 0d) | 61 / 0 (repaired; the park rules moved to the new test-park) |
| test-park (new) | — | 20 / 0 (the park alert: quiet after 20 min, once per spell, the house's clock, guests) |
| test-push | pass | pass |
| every other suite (20) | pass | pass, identical counts |
| Earlier batches' checks, verify-1a, the token gate, browser-check | pass | pass (0c's Forget check re-run 14/0 after its setup was given valid-shaped keys, which the Worker now requires) |

`node scripts/bump-sw.mjs --check`: 74 precached files present, 69 shipped files accounted for; every inline script parses (29 of 29). The saved smoke outputs had the throwaway local test tokens and codes blanked.

### Capture rig

- **The run.** The shell, where this batch's screens live (Me → Notifications and Chat history, the chat's Stop, the first visit), was recaptured on the final code: 979 captures, 0 failed (`audits/screens-after/2b/manifest.json`).
- **Against batch 2a's final capture** (`audits/evidence/p6/2b/capture/pxdiff-shell.txt`): 190 of 979 changed. The Me screens (admin, rewards, usage, sync, notifications, album, appearance and the theme cards: 128) change below the new Notifications and Chat history cards, and the sheets opened over Me (pairing code, profile edit: 38) show that page faintly behind them; the chat (14: the sending state's Stop square and the composer); the iPad's first visit no longer shows the "Hub updated" toast (1); the eight iPhone Apps grids differ by 60 pixels, a sub-pixel shift of the "Kitchen timer" label (checked by eye); and one pairing screen (its error message's animation, the rig's known run-to-run noise). 128 + 38 + 14 + 1 + 8 + 1 = 190.
- The Notifications card's "on" states, the pray-at time, the Stop states and the offline page were looked at by the reviewers across three rounds (`audits/evidence/p6/2b/review/`).

### Not verified

- **A real iPhone, iPad and browser.** Push delivery to a Home Screen app; a browser renewing a subscription (`pushsubscriptionchange`, PWA-GAP-2, the one NEEDS DEVICE CHECK: after deploy, an iPhone's 8 am and 8 pm pushes should keep arriving for weeks, and Admin → Usage should show no failed sends for it); a real notification tap routed through iOS; the monochrome and maskable icons as Android draws them.
- **The deploy itself.** The 15-minute cron and `event.scheduledTime` on Cloudflare (in-process runs of the scheduled handler cover the logic: cron-check 18/18, test-park 20/0); the update-and-reload flow under GitHub Pages' real `max-age=600` (the hourly timer itself was not waited out: the check forced the update); the 45 s timeout against the real Anthropic API; whether Cloudflare drops the stream when a phone disconnects (Stop covers it either way).
- **A known gap in a patched copy.** The park copy's part B no longer tests anything (every dot reads 0 min old by the house's clock since the fix that stopped trusting the phone's clock); part A and test-park carry the entry.
- **Production.** Nothing deployed. Deploy order: migrations 006, then 007, then `npx wrangler deploy` (it brings the new cron), then the site.

## Batch 2c — The TV board at ten feet

| | |
|---|---|
| **Findings** | 14 entries: 3 medium, 9 low and 2 pointers. **14 FIXED.** Status per entry in `audits/05-findings.md`. |
| **Code commit** | `4d46316` (2026-09-30) |
| **Files** | <ul><li>`index.html`: the TV CSS rewritten; the kiosk board with `fit()`, the readers, the kid words, `stopBoard()`, the wake lock and the Switch sheet with Screen look; the display's `showTab`, `hashchange`, `renderMe` and `renderReminders` guards.</li><li>`apps/hub.js`: `data-tv-scale="10ft"` on the display.</li><li>`worker/src/index.js`: `GET /api/f260/readers`.</li><li>`sw.js`: `hub-v41` → `hub-v42`.</li><li>`scripts/test-tv.mjs`: 43 → 76 checks.</li><li>`scripts/smoke-api.sh`: 315 → 322 checks.</li><li>`CLAUDE.md`, `worker/README.md`.</li><li>`docs/screens/rm21-tv-*-busy.png` (new test-tv screens).</li></ul> |
| **Schema / data** | No schema change, no migration, no new rows. The TV keeps today's readers on the device (`localStorage` `hub.tv.readers`). The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-29-before-2c.sql` (39 KB). Nothing was deployed. **At deploy**: until the Worker is deployed, the live TV's "Reading today" uses its fallback (today's "Read week…" feed lines). |
| **How it was built** | <ul><li>One worker did the batch.</li><li>Two independent reviewers ran three rounds before the final run. One covered core logic, privacy and stability; the other covered the entries and the screens.</li><li>Round 1 found 8 issues to fix and round 2 found 5. In round 3 the reviewers raised nothing new; I found one low issue and fixed it.</li><li>The final run then found one more gap (who read today was lost on an offline reopen in the board's first second). It was fixed, and a third reviewer passed the fix in two rounds.</li></ul> |

### The change

- **Ten-foot type and one screen (VIS-TYPE-1, UX-HOME-2, P2-VIS-02, PWA-VIS-4; medium).**
  - The display turns on design.css's existing 10-foot scale; the token half is unchanged.
  - The board is a 12-column grid of three rows on solid panes: clock and verse; today (prayed, read, stars); then the feed and reminders.
  - After every paint and on every resize, `fit()` keeps each faces pane to one row with "+N more". The feed and reminders show only whole lines, and the reminders count the rest in the heading ("Reminders · +N more").
  - At 1920×1080 the smallest information text is 28 px (was 12). The feed and reminders are 32.3 px (the smallest before, now the largest body text). Names, times and ★ are 28.5 px (were 18).
  - A portrait iPad puts the clock and verse side by side, with the feed full width.
- **The screen stays on (P2-STAB-12; medium).**
  - The display asks for the wake lock by itself on load, on every return to the screen, and on any key or tap.
  - If the lock is refused, a quiet line says "Press any button or tap the screen to keep it on.", and the board refits at once.
- **The kid line (P2-HOME-07).** The TV carries Kid Verse's paraphrase table and shows the family week's line, labelled as a paraphrase. A line written on the week row still wins.
- **The board stays the board (P2-PROF-10, P2-CHAT-14).** On the display, any hash lands on Home. Me renders nothing, so its hidden controls cannot take a click, and no chat composer shows.
- **Switch (P2-STAB-11, P2-PROF-11).**
  - Switch opens two choices: Switch profile, or Screen look. Screen look is the display's own theme, contrast, motion and glass, kept on the device; it restores the only way to change the TV's look, which was the hash bug.
  - The sheet opens on Cancel, so a double OK on a remote never signs the TV out.
  - Switch profile stops the board completely: no tick, no fetch, the wake lock released, who read today forgotten.
- **Who read today (UX-SYNC-a2, UX-PROF-a2, P2-SYNC-12).**
  - New `GET /api/f260/readers`: the household adults whose F260 log has today's New York date, at most two indexed rows per adult. The TV asks when the board is built and then once a minute.
  - Guests are not listed.
  - The answer is kept on the device, so an offline reopen keeps the ✓.
  - An older Worker (404) falls back to the feed lines and asks again every 10 min.
- **P4-GLASS-04.** Already fixed by batch 1's tokens (no live blur on the board before or after). The Switch now sits on a solid pane.

**What the independent review changed.**

- **Round 1.**
  - The readers route scanned every F260 row of every person on each call, which could pass D1's free daily read allowance with one TV. It now reads indexed rows for household adults only, once a minute.
  - Every reminder ended in "…". Reminders now get two lines, with the name inline.
  - On an iPad rotation the stars pane showed no kid.
  - The display lost its only way to change its look; Screen look was added.
  - At 960×540 (some 1080p TV browsers) the bottom row collapsed.
  - Wake-lock requests piled up; there is now one at a time, released on Switch.
  - Switch now forgets who read today.
  - Smaller layout fixes on a portrait iPad.
- **Round 2.**
  - "Prayed today" showed no faces at 1024, 1280 and 960 wide.
  - A TV remote lost its place in the sheets. Focus now moves into the sheet, and Switch waits while a sheet is open.
  - The menu now opens on Cancel.
  - Screen look is a 4-column grid on a landscape TV.
  - Only the TV releases its wake lock (the kitchen keeps its own).
- **Round 3.** Nothing new from the reviewers. I found one low issue and fixed it: the board now refits when the wake hint appears, and a closed sheet gives focus back to the Switch.
- **After the final run.**
  - **The gap.** The patched e10 check lost Eli's ✓ on an offline reopen made about a second after the first load. The Worker was first asked only at the first tick, and the ✓ shown from the feed lines was not kept.
  - **The fix.** The TV now asks when the board is built, and keeps the feed's answer until the Worker's arrives, never over it.
  - **Its review.** A reviewer found one low issue: a late answer after Switch could write the kept readers again. A guard now blocks that, and the second round was clean.
  - **The re-runs:**
    - the e10 check keeps the ✓ in 8 of 8 runs;
    - test-tv, test-home, test-hub and test-kitchen pass;
    - the tv capture is identical to the one before the fix (`audits/evidence/p6/2c/followup/`, `review/followup-review.md`).

### Each finding's reproduction, rerun

- **How they were run.** The 11 scripts the entries name ran three at a time twice: on the unchanged code (`git archive` of `4a85f0e`) and on the final code. The patched copies filed in `audits/tools/phase6/2c/` ran on the final code.
  - Outputs and exit codes are in `audits/evidence/p6/2c/tests/repro-before/` and `repro-after/`; the patched copies are the `p6-2c__*` lines.
  - The files the scripts wrote are in `audits/evidence/p6/2c/p2|p4/`. The Phase 2-4 baseline was restored.
- **Exit codes.**
  - Before: 10 exit 0, and 1 exits 1. `verify-kiosk-hash-nav-2` stops on a Forget button the display never had.
  - After: 8 exit 0, and 3 exit 1, each explained:
    - `verify-kiosk-hash-nav-2` stops the same way;
    - `tvswitch` and `leads` tap Switch and wait for the picker, but Switch now opens its two-choice sheet first.
  - Their patched copies (`verify-kiosk-hash-nav-2c`, which also runs in Chromium; `tvswitch-2c`; `leads-2c`, which tap "Switch profile") and the two reading-cache copies all exit 0.

| Finding | Before | After |
|---|---|---|
| P2-STAB-12 (wakelock) | TV untouched 10 min, remote keys only: no request | the lock taken in both engines with no tap |
| P2-VIS-02 (tv-board-overflows-1080-1) | content hidden below the screen: 8 / 49 / 90 / 131 / 913 / 127 px | 0 px in all 11 measures |
| VIS-TYPE-1, UX-HOME-2 (leads L8, L11) | page 1,088 px on a 1,080 screen; kicker, faces, times 18 px; 15 reminders all off screen | 1,080 px; 28 / 28.5 / 28.5 px; nothing hidden |
| P2-HOME-07 (kid-line-dead-1, -2) | the kid line empty (0 px) | the week's paraphrase, following the stepper |
| P2-PROF-10, P2-CHAT-14 (kiosk-hash-nav; the 2c copy) | #me rendered Me under the board (page 2,149 px), a click changed the TV's theme | stays #home (1,080 px); no Me or chat controls; 0 upstream calls |
| P2-STAB-11, P2-PROF-11 (tvswitch; the 2c copy) | behind the picker for 6 min: the clock ticked, repainted, crossfaded, 1 feed fetch | nothing runs, 0 fetches |
| P2-SYNC-12 (30-rows-2c; e10-2c) | offline reopen: Eli's ✓ lost; a held reload brought it back after 3.1 s | kept (8 of 8 e10 runs after the follow-up); back after 0.8 s |
| UX-PROF-a2 (30-rows-2) | the guest listed as not read | not listed |
| P4-GLASS-04 (switch-live-blur-3) | no live blur; the Switch on a glass pane | no live blur; the Switch on a solid pane |

### Repo tests

| Suite | Before (batch 2b's final run) | After |
|---|---|---|
| test-tv | 43 / 0 | 76 / 0 (the 1920×1080 fit gate, 10-foot type, five screen sizes and a rotation, reminders counted, the hash guards, Switch stops the board, the wake lock, the readers route and its 404 fallback, the offline reopen, the Switch sheet by remote) |
| smoke-api.sh | 315 / 0 | 322 / 0 (the readers route: sign-in required, only household adults, an untick drops the reader) |
| smoke-chat.sh (mock model) | 64 / 0 | 64 / 0 |
| every other suite (22) | pass | pass, identical counts |
| Earlier batches' checks, verify-1a, the token gate, browser-check | pass | pass (prayer-check stays 47/2, as since batch 0g) |

`node scripts/bump-sw.mjs --check`: 74 precached files present, and all 69 shipped files are accounted for. Every inline script parses (29 of 29). The saved smoke outputs had the throwaway local test tokens and codes blanked.

### Capture rig

- **The run.** The tv area was recaptured on the final code: 34 captures, 0 failed (`audits/screens-after/2c/manifest.json`).
- **Against batch 2a's capture** (`audits/evidence/p6/2c/capture/pxdiff-tv.txt`): 32 of 34 changed. That is every board state at 1920 and on the iPad (28: the new layout), and the display's #me and #chat states (4), which now show the board. The two profile-picker screens are unchanged.
- **After the follow-up fix.** A second capture matched the first: 34 compared, 0 changed.
- **Checked by eye.** The board, the Screen look sheet, and the 960×540 to 3840×2160 sizes were looked at by the reviewers (`check-2c/`) and by me.

### Not verified

- **A real TV and iPad.**
  - Whether a TV browser or iPad Safari grants the wake lock without a tap (if not, the hint shows until a button is pressed).
  - Legibility from 3 m, and TV overscan.
  - A real remote's keys.
- **A 4K screen at 1×.** It keeps the 1920 sizes, because design.css's width tiers stop at 1920.
- **Glass.** This WebKit build paints no blur.
- **Production.** Nothing deployed; until the Worker is deployed, the TV reads who read from feed lines. Deploy order: migrations 006, then 007, then `npx wrangler deploy`, then the site.

## Batch 3 — Prayer

| | |
|---|---|
| **Findings** | 37 Prayer entries (6 medium, 30 low, 1 info; 1 of the low is a pointer), 4 carry-overs from batch 1 (Prayer's half only) and the 3 kept improvements IMP-PRAYER-I1-I3. **42 FIXED, 1 NEEDS DEVICE CHECK** (UX-PRAYER-3: the Kitchen view read from across a room), **1 PARTIAL** (CONS-MOTION-3: Prayer now uses the shared toast and the sheet tokens; no sheet or toast follows the finger or animates out, which no batch owns). Status per entry in `audits/05-findings.md`; the improvements in its "Improvements with no finding (prayer)" table, which now has a Status column. |
| **Code commit** | `da1dcbd` (2026-09-30) |
| **Files** | `apps/prayer.html` (the batch; every existing id and the layout kept, additions only), `apps/hub.js` (`hub.immersive`, `hub.isImmersive`), `index.html` (the viewer's full-screen mode, the TV's anniversary line, Home's "prayed for your request" line, Home's prayer count and streak), `sw.js` (`hub-v42` → `hub-v43`), `CLAUDE.md`, and the tests `scripts/test-hub.mjs` (37 → 47 checks), `test-home.mjs` (57 → 65), `test-tv.mjs` (76 → 85), with `test-prayer.mjs`, `test-prayer-faces.mjs` and `test-kitchen.mjs` changed on purpose (the toast is the shared one; the kid button reads Pray before and Prayed after) |
| **Schema / data** | No schema change, migration or new row kind. Prayer's rows keep their shape: a weekly request shared to the family keeps its days; an old family copy with none shows every day (a read-only rule, nothing rewritten); unticking takes today off the record only when nothing is left marked today, and on the family list only when no one's tick is left (the Worker's `prayedBy` merge and batch 0g's `unprayed` rule unchanged). The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-30-before-3.sql` (39 KB, 111 rows). Nothing was deployed. |
| **How it was built** | Three workers in parallel: A (Prayer's logic, data and copy), B (its look: kid cards, the Kitchen view, Pray mode, the shared toast, type and motion tokens) and C (the shell half). Two independent reviewers (core logic, privacy and data; the entries and the screens) ran three rounds to a clean verification before the final run. After it, the independent rescore and the status writer each found work (below), which was fixed, reviewed once more and followed by a second full final run on the final code. |

### The change

- **Nothing lost or folded away (P3-PRAYER-07, -08, -09, -21, -23).** Category groups remember whether they are open, so a tick or another person's change no longer folds them. "Send to family list" copies a weekly request's days. Unticking takes today off the record when nothing else was prayed today, never someone else's day, and a device that finds a request prayed today but today missing from the record puts it back once its sync has landed. Removing the category a "One category only" plan uses moves the plan to Personal. (P3-PRAYER-09's Undo already found the row by id.)
- **Honest words (P3-PRAYER-12, -13, -14, -15, -16, -20, -22; UX-PRAYER-4, -5, -6).** The Add screen says which list it adds to and switches between them; Settings names its list and asks before changing the family's; the "Needs attention" badge counts each request once; the cheer, the Sunday nudge and the headline ("this morning", "today", "this evening") say only what is true; a family delete says it reaches everyone; "More" is "Share & print"; a family request's sheet shows who asked and who prayed today.
- **Easier to use (P3-PRAYER-19, -26; UX-PRAYER-1, -10, -11, -12, -13, -14; GAP-PRAYER-2).** An open Kitchen view repaints when something changes and at midnight; Escape closes what is open and Enter moves through the Add form (its last field, or Ctrl/Cmd+Enter, saves); the Add button stays in view; rows still to pray come first; pasted titles are capitalised; a backup can be chosen as a file; one Pray now run posts one feed line (never a private title); a finished Today says "All prayed" and hides Pray now; Record → Answered can be searched and is grouped by year.
- **Kids and the Kitchen (UX-PRAYER-2, -3).** A kid's card reads "Pray" with drawn praying hands before the tap and shows their face, a drawn ✓ and "Prayed" after, in a clearly different colour (fills 1.0-1.1:1 apart → 4.7-5.6:1), and reads the request aloud. The Kitchen view is dark and calm, 44 px requests under a 64 px list name on the iPad, two columns on a landscape iPad with each category kept whole.
- **The look (UX-PRAYER-7, -9; VIS-PRAYER-2, -3, -5, -6, -8, -9, -11; P4-SHAPE-02, VIS-SHAPE-4; the carry-overs).** Drawn chevrons on the groups; Pray now full screen in the hub (`hub.immersive`) with a 44 px Close and its chrome in the centred column; nothing under the + at the end of the list; 44 px Rename/Remove; a calendar with its month, weekday letters on top and visible empty days; the page and the detail sheet in a centred column on wide screens, with a one-line header from 700 px; a stats strip without zeros; the shared toast with a 44 px Undo. Every text size is a design.css role (63 → 0 literal sizes) and every duration a token (35 → 0) — CONS-TYPE-7, CONS-MOTION-2 and CONS-SHAPE-5 are now fully fixed.
- **The kept improvements.** I1 "Around the table": on the Kitchen iPad, after "Who is praying?", everyone at the table taps their face once and every Prayed credits them all (a kid's star follows; no guest, TV or kitchen; nobody twice); a personal device credits only its person. I2: the TV shows "A year ago today · Answered: …" for a family request (never a private one). I3: the person who asked a family request sees, on their own Home, who prayed for it today.

**What the independent review changed.**
- **Round 1** (core): unticking on one device could erase a day really prayed on the person's other device (fixed: the record also counts each request's last prayed day, and repairs itself); one Pray now run could post several lines after leaving to Home and back; Home's prayer count lacked the every-day rule; a Settings panel left open skipped the family confirm; Escape discarded an edit without asking; "One category only" started with no category. (Screens): the pinned Add button hid the focused field (fixed with scroll padding: 54/54 px covered → 0); the two-column Kitchen view split a heading from its requests (fixed: category blocks in a row-by-row grid); the phone keyboard's return saved a half-filled request (fixed: Enter moves to the next field); the streak repeated under the strip.
- **Round 2** (core): the self-repair ran while a sync was only half applied and put back a day the person had just unticked (fixed: it waits for the whole sync, then re-checks). A shell Escape now also closes the Kitchen view and Pray mode; the Kitchen view opens at the top. (Screens): no new findings.
- **Round 3:** no new findings from either reviewer.
- **After the first final run:** the independent rescore found the batch had mixed icon families (an emoji, a text ✓, a CSS chevron; Icons 5 → 4), so all three became drawn icons in Prayer's own style; the status writer found six claims no filed output proved, so a new check `audits/tools/phase6/3/prayer-claims-3.mjs` proves them — and its claim 5 caught VIS-PRAYER-6 still failing (1 request above the nav on a landscape iPad with a long plan name), fixed with the one-line header (3 above the nav). A fourth screens review found nothing new; its nit about the drawn hands for a pre-reader gave them a soft fill. Then the whole final run was repeated on the final code; the rescore on it found the drawn chevron at 2.9:1 in the light palettes, so the chevron took the tertiary text ink, and Prayer's checks, suites and a full Prayer recapture were run once more on that (`audits/evidence/p6/3/followup/`).

### Each finding's reproduction, rerun

- **How they were run.** The 46 scripts the entries name ran three at a time on the unchanged code (`git archive` of `eb2384f`) and on the final code, with the 13 copies filed in `audits/tools/phase6/3/`. Outputs and exit codes are in `audits/evidence/p6/3/tests/repro-before/` and `repro-after/` (the copies are the `p6-3__*` lines); the files the scripts wrote are in `audits/evidence/p6/3/p3|p4/`, and the Phase 2-4 baseline was restored.
- **Exit codes.** Every one of the 59 exits 0 before and after — so the verdicts rest on what the outputs say, not on the exit codes. Seven originals no longer reach what they test, each because the screen changed on purpose: the three undo scripts wait for Prayer's own toast (now the shared one), critic-keys and the two no-enter-escape scripts tap a control that Escape already closed, and focus-7-2 meets the new family confirm. Their copies (`-3`) test the same things on the new screens and pass.

| Finding | Before | After |
|---|---|---|
| P3-PRAYER-07 (list-group-collapses-1, -2) | a tick or a pull folds every open group | groups stay open |
| P3-PRAYER-08 (share-drops-days-1, -2) | the family copy's days [] (shown on no day) | Sun, Tue, Thu; on Eli's, Mom's and Ezra's Today |
| P3-PRAYER-12 (review-double-count) | badge 8 for 6 requests | 6 for 6 |
| P3-PRAYER-13, -22 (cheer-at-zero, sunday-nudge) | a cheer and "gone quiet" on an empty day and every Sunday | none; the Sunday line only when something is quiet |
| P3-PRAYER-16 (morning-copy-evening) | "this morning" at 21:10 | "this evening"; "today" at 14:10 |
| P3-PRAYER-19 (kitchen-view-stale) | an open Kitchen view never shows a new request | shows it, drops the answered one, rolls at midnight |
| P3-PRAYER-20 (add-screen-no-list-name) | no list named on Add | "Add to the Family list" with a switch |
| P3-PRAYER-21 (untick-keeps-day) | an untick kept the day (streak 4) | the day goes on device and house (streak 3) |
| P3-PRAYER-26 (the -3 key copies) | Escape closed nothing; Enter added nothing | sheet, Share & print, Kitchen view and panels close; Enter adds (19 → 20) |
| P4-SHAPE-02 (undo-target-2; its copy -3) | Undo 35.8 × 44 px on the iPhone (no padding) | 63.6 × 44, one line, clear of the nav and the + |
| UX-PRAYER-1, VIS-PRAYER-2, -3, UX-PRAYER-9 (layout) | the Add button under the nav on 3 devices; Close 45 × 33; Rename 55 × 31; Pray now 48 px below the hub bar | visible on all 4; 71 × 44; 71 × 44; full screen (0) |
| UX-PRAYER-3 (layout) | Kitchen items 24-27 px, heading 36-40 px (read from 0.73 m) | 44 px and 64 px (1.19 m) |
| VIS-PRAYER-6 (prayer-claims-3) | 1 request above the nav, iPad landscape, long plan | 3 |
| CONS-TYPE-7, CONS-MOTION-2 (code-scan, literals) | 63 calc sizes; 35 literal durations | 0 and 0 |

### Repo tests

| Suite | Before (batch 2c's final run) | After |
|---|---|---|
| test-hub | 37 / 0 | 47 / 0 (`hub.immersive`: only the viewer's frame is obeyed; the bar comes back on close, reload, Escape and another app) |
| test-home | 57 / 0 | 65 / 0 (the "prayed for your request" line: only the asker's own Home, never a private title, patched in place) |
| test-tv | 76 / 0 | 85 / 0 (the anniversary line on every size, every batch 2c fit gate still holds) |
| test-prayer / test-prayer-faces / test-kitchen | 36 / 41 / 55 | 36 / 42 / 55 (the toast and the kid button read on purpose) |
| every other suite (17) | pass | pass, identical counts |
| smoke-api / smoke-chat (mock) | 322 / 64 | 322 / 64 |
| Earlier batches' checks, verify-1a, the token gate, browser-check | pass | pass; `handoff/prayer/check.js` 47/2 as since batch 0g, its copy `0g/check-ids.js` 49/49 |

`node scripts/bump-sw.mjs --check`: 74 precached files present, 69 shipped files accounted for; every inline script parses (29 of 29). The saved smoke outputs had the throwaway local test tokens and codes blanked.

### Measurement and the rescore

- **Contrast.** The measurement rig re-measured Prayer on the final code (themes 299, devices 255, states 95 jobs): text below AA is 707 (Phase 4) → 162 (batch 1) → 162, and every one of the 162 is a disabled control (Mark answered before anything is typed, Back on the first card, the controls while the list loads), which WCAG exempts (`audits/evidence/p6/3/measure/`).
- **Rescore** (`audits/evidence/p6/3/rescore.md`, an independent judge, the Phase 4 method, bases held): Prayer 5.4 → **5.6** (Typography 5.5 → 6.5: every size a role, 51 → 34 rendered sizes; Glanceability 3.5 → 4.5: the Kitchen view read from 1.19 m, its list name from 1.73 m; Ease 5.5 → 6: Undo, Rename/Remove and Close at 44 px; the other eight held, with reasons). The first judgement was 5.5 with Icons 5 → 4 for the mixed icon families; with the drawn icons Icons holds at 5. It also noted the Today headline on the iPad is smaller than before (34.7 → 31.4 px, the title role) and that the drawn chevron rendered at 2.9:1 in the light palettes; the chevron now uses the tertiary text ink (5.5-9.1:1 on a card in every palette). Two policy calls are named in the file (COL-1 held, GLA-3 lifted).

### Capture rig

- **The run.** Prayer, the shell and the TV were recaptured on the final code: 809, 979 and 34 captures, 0 failed (`audits/screens-after/3/manifest.json`).
- **Prayer against the pre-batch control** (`capture/pxdiff-prayer-vs-prebatch.txt`): 800 of 809 changed — the type roles, the centred column and the new controls touch nearly every screen; the 9 unchanged are the print pages. Against Phase 1: 809 of 809.
- **The shell against batch 2b's capture** (`capture/pxdiff-shell-vs-2b.txt`): 90 of 979 changed: 74 Home and 4 first-visit screens (the new "prayed for your request" lines, checked by eye), 6 Apps grids by 60 px and 5 chat screens by 1-24 px (the rig's known sub-pixel noise) and the pairing error's animation.
- **The TV against batch 2c's** (`capture/pxdiff-tv-vs-2c.txt`): 0 of 34 — the demo seed has no request answered a year ago; the line is proven by test-tv at every size.
- The reviewers looked at every changed screen family, light and dark, on iPhone, iPad and desktop, across four rounds.

### Not verified

- **A real iPhone and iPad.** Speech; the Files picker for a backup; the phone keyboard's next/done keys in the Add form and scroll padding with the keyboard up; `hub.immersive` in the installed app and its notch strip; the drawn icons and the blur on iOS; a hardware keyboard.
- **The Kitchen iPad** (UX-PRAYER-3, the one NEEDS DEVICE CHECK): the view from across the kitchen (1.19 m by the rig's estimate); Around the table passed round for real.
- **A real TV:** its font metrics (the anniversary line has about 4 px to spare in the verse pane, and falls back to the feed) and a remote's Escape.
- **At the largest text size (XXL)** a landscape iPad with a long plan name shows no request above the nav; the header fix holds at the standard sizes.
- **Found, not fixed (outside this batch):** a device that was offline, taps Prayed on a family request someone else has since deleted, brings it back when it syncs (last write wins; `verify-delete-copy-wrong-2`, `staleOfflineWriteResurrects: true`). It needs its own finding (a tombstone must win over an older edit).
- **Accepted small points:** a feed line posted when another app is opened mid-run arrives about 20 s late (never lost or doubled); a cut-off plan name cannot be read by tap on Today (it is in Settings); the "shared" pill sits under the + at the resting scroll (colours pass; nothing is covered at the list's end).
- **Production.** Nothing deployed. Deploy order: migrations 006, then 007, then `npx wrangler deploy`, then the site.

## Batch 4 — F260 Reading Plan (and the Prayer parts batch 3 missed)

| | |
|---|---|
| **Findings** | 38 F260 entries (6 medium, 32 low), the kept improvement IMP-F260-F4 and 21 batch-1 carry-overs. **36 FIXED and 2 PARTIAL** (UX-F260-6: the weeks open at the current week on wide screens only; VIS-F260-12: the year grid's cells cannot reach 44 px); **IMP-F260-F4 FIXED**; of the 21 carry-overs **4 now FIXED** (CONS-SHAPE-2, CONS-SHAPE-6, VIS-SHAPE-2, VIS-F260-16) and **17 stay PARTIAL**, each naming the later app batch that owns the rest. Status per entry in `audits/05-findings.md`; the carry-overs in batch 1's section, the improvement in "Improvements with no finding (f260)". |
| **Code commit** | `2a6bd05` (2026-10-01) |
| **Files** | <ul><li>`apps/f260.html` (the batch; every existing id and the layout kept, additions only)</li><li>`apps/prayer.html` (batch 1's leftovers that batch 3 missed)</li><li>`apps/design.css`, component half only (one segmented control `.ds .seg` / `.segmented` with `.seg-grid`; `svg.sym` scaled by the text size); the token half byte-identical</li><li>new `icons/sprite.svg` (49 Lucide-style symbols) and `icons/LICENSE-lucide.txt`</li><li>`index.html` (Me → Notifications reading time; Home's streak rule)</li><li>`worker/src/reminders.js` (the reading nudge at each person's time; the two-device day rule; `pruneRestored`), `worker/src/index.js` (`/api/f260/readers` on the same rule), `worker/src/chat.js` (chat's untick follows the app)</li><li>`sw.js` (`hub-v43` → `hub-v44`), `CLAUDE.md`, `worker/README.md`</li><li>tests: `scripts/test-push2.mjs` (61 → 70 checks), `scripts/smoke-api.sh` (322 → 325), `test-prayer.mjs` and `test-prayer-faces.mjs` read the new switch and kid button on purpose</li></ul> |
| **Schema / data** | No schema change and no migration. New person rows `app_data(person, hub, 'push_pref:readAt')` (the reading nudge's time) and `app_data(person, f260, 'restored:<date>:<uid>')` (what an Undo or a restore wrote back; pruned after a day). F260's rows keep their shape. The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-09-30-before-4.sql` (39 KB, 111 rows). Nothing was deployed. |
| **How it was built** | <ul><li>Before the batch, an agent sorted batch 1's 26 unfinished design entries that mention F260 or Prayer. This found that batch 3 had taken only 4 of its own, because the notes write it as "(F260 4, Prayer 3, …)" and the search matched only "Prayer's batch".</li><li>Three workers: A (F260's logic, copy and the reading time), B (F260's look, its carry-overs and the shared icon set) and P (Prayer's missed carry-overs).</li><li>Two independent reviewers ran 5 core rounds and 4 visual rounds before the review closed.</li><li>After the final run, the status writer and the independent rescore each found work (below). It was fixed, reviewed again and followed by a second full final run on the final code.</li></ul> |

### The change

**Reading that counts.**
- **Undo and the day (P3-F260-02, -04, -07).** Undo takes back what a tick did: today's day on the log (only when nothing else was read today), a best streak set today, a finished plan, a week the tick started.
- **The streak (P3-F260-03).** An unread today is pending, never a rest day, so two rest days keep the streak as the owner asked. The same rule holds in F260, on Home and in chat.
- **Week dates (P3-F260-18, -19).** A week's date is set by its first reading, never by stepping through weeks.
- **Missed readings (GAP-F260-1).** A reading missed in an earlier week shows on Today: "Missed: Week 30 · Day 3 — Malachi 2 · Catch up".

**Two devices, one day.**
- **An untick on one device never erases another device's day.** The app repairs it once a sync has landed. The Worker applies the same rule, so the evening nudge and the TV's "read today" stay right.
- **Readings written back by an Undo or a restore don't count as read today.** They are listed once in a row of their own, so an Undo can't mark today as read. A real re-tick still counts.
- **Reset (P3-F260-16, UX-F260-2).** It names everything it clears, including the Verses review schedule. It can be undone for 10 s, merging by value, so a change made on another device meanwhile is kept.

**Honest words and fewer taps.**
- "On all your devices", where it used to say "this device" (P3-F260-12, -15, UX-F260-1).
- Percentages that never read 100 % with a reading left or 0 % after one (P3-F260-10), and plurals that agree with their number (P3-F260-11).
- The journal saves only real changes (P3-F260-17), and search can't break on "&" (P3-F260-20).
- A Journal button on the Today card cuts writing today's entry from 6 taps to 2 plus the passcode (UX-F260-11).
- A settings gear in the header (UX-F260-8).
- "Read ahead" after today's tick (UX-F260-13).
- The journal's locked state is shown in place (UX-F260-3).
- The weeks column opens at the current week on wide screens (UX-F260-6, partly).

**The look.**
- **Loading and tokens.** Nothing jumps while data loads: 9 moving landmarks → 0, cold CLS 0.0463 → 0.0011 (VIS-F260-3). Every size, space, radius and duration is a design token.
- **Icons.** One shared icon set (`icons/sprite.svg`, one stroke weight, one drawing per meaning) replaces F260's private sprite, its emoji and its text glyphs.
- **One segmented control for every app.** It has a visible track and capsule items, and puts long choices in tidy equal cells on a phone.
- **Print (VIS-F260-7).** The printed plan has tick boxes, greys what was read, and keeps its subtitle legible.
- **Other entries.**
  - VIS-F260-4: disabled controls look disabled.
  - VIS-F260-5: the footers are styled.
  - VIS-F260-6: the search has one clear button.
  - VIS-F260-8: the hint is the footnote role.
  - VIS-F260-9: Undo stays on Done's row.
  - VIS-F260-13: the week header wraps cleanly.
  - VIS-F260-15: locked controls are disabled.
  - UX-F260-7: the practice chips fold into one "Practice N verses".

**The reading nudge's time (IMP-F260-F4).** Each person picks when the reading reminder comes (Me → Notifications). It is still once a day, and only when nothing was read.

**Prayer's missed carry-overs.**
- Its alias colour names are gone.
- The shared press feel; capsule primaries.
- Cards, radii and spacing on tokens (spacing on the grid 44.6 % → 92.3 %).
- The shared segmented control.
- Loading placeholders that hold the page still for kids.
- The shared icons, bolder for kids.
- Its own class names, so its sheet no longer restyles the hub's confirm sheet.

**What the independent review changed.**
- **Core round 1:** an untick erased a day another device had logged (fixed by the repair rule). Also Reset's Undo overwrote changes made in its window, chat's untick did not give back a best streak, and a stale summary.
- **Visual round 1:**
  - two segmented-control looks, one of them invisible on Hearth;
  - icons that did not grow with the text;
  - kid icons too thin;
  - Prayer's cold load moved (the adult shift that remains, a review prompt appearing, was accepted as data-driven);
  - a print border in dark mode;
  - a wrapped Journal button;
  - one drawing for two meanings.
- **Rounds 2-5:** each fix was attacked until nothing broke.
  - The Undo guard lost dates, so it now merges by value, not by time, because device clocks differ.
  - An Undo could mark today as read, so a synced per-Undo row was added.
  - That row hid a real re-tick, so it now records an `upTo` stamp.
  - The shared segmented control overlapped long labels, so it now wraps on whole words.
- **After the first final run:**
  - The independent rescore found reading mode's side card covering the week header on wide screens, a regression from P3-F260-09. It also found a sub-11-px streak note, untidy phone choices, references split across lines, invisible placeholders and draggable art. All were fixed and reviewed clean.
  - The status writer found 46 contrast samples nobody had examined, and that the Phase 4 measuring tools had not been re-run in the final run.
    - Every sample is accounted for (below). The one real one, the printed subtitle at 3.95:1 (there since before the batch), is now 5.5:1.
    - The tools were run on the final code and on the pre-batch archive.
  - Then the whole final run was repeated on the final code.

### Each finding's reproduction, rerun

- **How they were run.** The 42 scripts the entries name ran three at a time on the unchanged code (`git archive` of `d636fc2`) and on the final code. The copies in `audits/tools/phase6/4/` and `/3/` also ran.
  - Outputs and exit codes are in `audits/evidence/p6/4/tests/repro-before/` and `repro-after/`.
  - The files the scripts wrote are in `audits/evidence/p6/4/p3/` and `p6-3/`, and the baseline was restored.
- **Exit codes.** Five originals now fail, each because its screen changed on purpose:
  - journal and vis-unlock-1-1: the Journal tab shows its locked state in place;
  - layout and the two heatmap scripts: the today cell's class changed.
  - Their `-4` copies pass.
  - Some scripts stop at the same rig clock error before and after, after reaching the fix.
  - Verdicts rest on what the outputs say. f260-a-4 (32 checks) and cron-check-4 (31) cover the later steps.

| Finding | Before | After |
|---|---|---|
| P3-F260-02 (untick) | "Read today ✓" and a streak day stayed after Undo | the day comes off; streak [12, 13, 12] |
| P3-F260-03 (2 rest days) | "Start a new streak · 0" the day after two rest days | "11-day streak · read today to keep it" |
| P3-F260-07 (Done ahead, Undo) | Undo left the new week current and dated | back to week 37; week 38's start date removed |
| P3-F260-10 (percent) | 100 % with one left, 0 % after one | 99 % / 1 % |
| P3-F260-19 (stepper) | week starts stamped 38-41 | only week 38 |
| P3-F260-17 (HEAR focus) | re-dated and re-uploaded on focus | unchanged, nothing sent |
| Two devices (review probe p1) | the house's day erased, readers drop the person | the day kept, readers right |
| VIS-F260-3 (cold load) | CLS 0.0463, 9 landmarks move | 0.0011, 0 move |
| P3-F260-08 (heatmap) | the today cell broke the grid (8 rows) | 25 × 12 like the rest, 7 rows |
| UX-F260-7 (practice chips) | Day 1 340 px below | 56 px below, one 44 px chip |
| UX-F260-11 (journal today) | 6 taps, 1,100 px scroll | 2 taps + the passcode |
| VIS-F260-7 (print) | no ticks, curled rules | tick boxes, read in grey, straight rules, 3 pages |
| IMP-F260-F4 (cron-check-4) | — | 31/0: the chosen hour only, once a day, nothing when read |

**The Phase 4 measuring tools**, run on the pre-batch archive and on the final code (`audits/evidence/p6/4/p4tools/before/` and `out/`):

| Tool | F260 before → after | Prayer before → after |
|---|---|---|
| TOK/literals: literal spacing / radii / font sizes / colour mixes | 211 / 34 / 68 / 1 → 0 / 0 / 0 / 0 | 170 / 18 / 0 / 1 → 1 / 0 / 0 / 0 |
| TYPE/code-scan: sizes on roles vs computed | 56 roles + 68 calc → 120 roles, 0 calc | 87 → 88 roles (all already roles) |
| ICON/static: private symbols, stroke weights | 11 symbols, 5 weights (2, 2.5, 2.6, 3.5, 6) → 0 symbols (the shared sprite), the progress rings only (6, 3.5) | 3 weights (1.75, 2, 2.2) → the sprite (one weight) |
| MOTION/press: controls with press feedback | 56 / 102 → 105 / 105 at 0.97 | 12 / 19 → 19 / 19; kid 4 / 9 → 9 / 9 |
| MOTION/cls: landmarks that move as data lands | 9 (317 px iPad, 514 px iPhone) → 0 | 4 (13 / 60 px) → 4 (5 / 5 px) |
| SHAPE/analyze: macro spacing on the 4 px grid | 36.8 % → 93.3 % | 44.6 % → 92.3 % |
| SHAPE/verify: page margins (iPhone / iPad portrait / landscape) | 20 / 50 / 32 → the same | 22 / 152 / 332 → 20 / 130 / 310 (the `--col-narrow` column) |

SHAPE/analyze's "large radii on the scale" uses a hard-coded list older than the tokens (`analyze.mjs:12`), so its radius figure is not used; by design.css's `--r-*` roles every large radius in both apps is a role.

### Repo tests

| Suite | Before (batch 3's final run) | After |
|---|---|---|
| test-push2 | 61 / 0 | 70 / 0 (the reading nudge at the chosen time) |
| smoke-api.sh | 322 / 0 | 325 / 0 (the reading time's row) |
| test-f260 / test-prefs / test-kidstory / test-verses / test-home | 58 / 35 / 50 / 80 / 65 | the same, all 0 failed |
| test-prayer / test-prayer-faces / test-kitchen / test-rewards | 36 / 42 / 55 / 73 | the same |
| every other suite | pass | pass, identical counts |
| smoke-chat (mock) | 64 / 0 | 64 / 0 (chat's untick checked separately, 7/0) |
| Earlier batches' checks, verify-1a, the token gate, browser-check | pass | pass; `handoff/prayer/check.js` 47/2 as since batch 0g, `0g/check-ids.js` 49/49; Prayer's `prayer-claims-3` 6/6 |

-- `node scripts/bump-sw.mjs --check`: 75 precached files present, 70 shipped files accounted for. Every inline script parses (30 of 30). The saved smoke outputs had their throwaway local test tokens and codes blanked.
- `scripts/screens-apps.mjs`: 90/1 both before and after this batch. The one failure, Tally's page background, is pre-existing and is Tally's (batch 11).

### Measurement, captures and the rescore

**Contrast.** F260 and Prayer were re-measured on the final code (themes, devices and states).
- F260's text below AA: 1,809 (Phase 4) → 69 (batch 1) → 239. Every one is accounted for:
  - **201** are controls disabled on purpose in the measured state (the journal locked, a passcode not set): VIS-F260-4 and -15 made disabled controls look disabled, and WCAG exempts them.
  - **24** were sampled through the iPhone's floating glass Plan/Journal bar, over content scrolling under it.
  - **10** are edge samples whose median passes.
  - **4** are the milestone toast caught fading in (on screen it is white on its dark pill).
- Prayer: 162, all disabled controls, as before.

**Captures.** Three areas were recaptured on the final code: F260 629, Prayer 809, shell 979, 0 failed (`audits/screens-after/4/`).
- **F260:** 629 of 629 changed against the pre-batch control, from type, spacing, icons and the new controls.
- **Prayer:** 800 of 809 changed against batch 3's capture (its whole style pass); the 9 unchanged are the print pages.
- **The shell:** 79 of 979 changed, from the segmented controls in Me → Appearance, the guest and household sheets (checked by eye), plus the known 60 px Kitchen-timer label shift.

**Rescore** (`audits/evidence/p6/4/rescore.md`; an independent judge, the Phase 4 method, bases held):
- **F260: 5.4 → 6.0.**
  - Layout 5.5 → 6.5: spacing on the grid 36.8 → 93.3 %, the 20 px phone margin.
  - Colour 5 → 6.
  - Icons 3.5 → 4.5.
  - Motion 4.5 → 5.5.
  - Native 5 → 6.
  - Typography, Shape and Ease each +½.
- **Prayer: 5.6 → 5.9.**
  - Layout 5 → 6.
  - Shape and Icons each +½.
  - Colour 5 → 6 by a consistency ruling the file names.

### Not verified
- **A real iPhone and iPad:**
  - the reading nudge arriving at a chosen time through real push;
  - the shared icon file served offline in an installed app (checked offline in Chromium only);
  - press and long-press feel;
  - iOS select pickers and the keyboard when the Journal opens;
  - nested scrolling of the weeks column on an iPad in landscape;
  - Face ID;
  - Prayer's speech;
  - two real devices whose clocks differ by more than the rig's 4 s (the rules are by value or by each row's own stamp, and a 10-minute skew passed in the rig).
- **Left partly done:**
  - **UX-F260-6:** phones still open on Today, because scrolling the page there would push Done out of view.
  - **VIS-F260-12:** the year grid's cells cannot reach 44 px.
  - **17 carry-overs stay PARTIAL**, owned by the later app batches named in each.
- **Found, not fixed (outside this batch):**
  - Me → Add a guest's face grid is cut off at 390 px / text size XXL. It was the same before this batch; the owner is the shell.
  - The Tally page-background test failure.
- **Production.** Nothing deployed. Deploy order: migrations 006, then 007, then `npx wrangler deploy` (it brings the reading time and the two-device rule to the Worker), then the site.


## Batch 5 — Verses (the memory-verse trainer), its Home card and evening review

| | |
|---|---|
| **Findings** | 20 Verses entries (5 medium, 14 low, 1 info) and the 4 kept improvements IMP-VERSES-F6, -I1, -I2 and -I3. **All 20 FIXED; all 4 improvements FIXED.** Of the 11 earlier carry-overs with a Verses part, **1 is now FIXED** (UX-VERSES-6) and **10 stay PARTIAL**, each naming the later batch that owns the rest. Status per entry in `audits/05-findings.md`. |
| **Code commit** | `2f699c2` (2026-10-01) |
| **Files** | <ul><li>`apps/verses.html` (the batch; every existing id kept)</li><li>`index.html`: the Memory verses Home card; a Home card grid whose art never covers text; loading reservations; the verse review switch in Me → Notifications</li><li>`apps.json`: Verses' scope is now `both`</li><li>`apps/hub.js`: one attribute, `draggable="false"` on avatar photos</li><li>`icons/sprite.svg` (49 → 52 symbols: circle-dashed, play, square) and `icons/LICENSE-lucide.txt`</li><li>`worker/src/reminders.js` (`versesJob`, `versesDue`), `worker/src/policy.js` (Verses' household text rows only; narrower), `worker/src/index.js` (a comment)</li><li>`sw.js` (`hub-v44` → `hub-v45`), `CLAUDE.md`, `worker/README.md`</li><li>tests: `test-verses.mjs` rewritten (80 → 184 checks), `test-home.mjs` (65 → 80), `test-push2.mjs` (70 → 81), `smoke-api.sh` (325 → 330)</li></ul> |
| **Schema / data** | No schema change and no migration. New rows: `app_data(family, verses, 'text:<week>-<i>')` = `{text, by, at}` (the household's verse text; the Worker accepts only that key shape, text up to 4,000 characters, `by` = the writer, adults and guests only); `app_data(person, verses, 'mode')`; `app_data(person, hub, 'push_pref:verses')`. Recall rows gain `hist` (the replaced schedules, 30 days). The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-10-01-before-5.sql` (40 KB, 115 rows). Nothing was deployed. |
| **How it was built** | <ul><li>Before the batch, an agent sorted the earlier batches' unfinished entries with a Verses part (11).</li><li>Three workers: A (Verses logic, data and copy), B (its look, the carry-overs, practice modes and recording) and C (the Home card, the evening push, docs).</li><li>Two independent reviewers: 6 core rounds and 8 visual rounds.</li><li>Three full final runs. The first found a Home regression (below). After the first and second, the independent rescore found work, which was fixed and reviewed each time. A last icon change after the third run was checked in a focused follow-up.</li></ul> |

### The change

**The verse text, once for the household (GAP-VERSES-1).**
- "Add the verse text" on a card stores it once per verse for the whole house, so Show reveals it for everyone who trains that verse.
- It can be edited or removed. Sharing a private F260 paste asks first.
- Kids never get the editor, and the Worker refuses their writes.
- No Bible text is shipped in the app.

**A schedule that tells the truth.**
- Not yet sends a verse back to tomorrow (classic Leitner) (GAP-VERSES-2).
- Each rating button shows its next review, and the result says "Next review in 4 days" (P3-VERSES-05).
- No box numbers anywhere; the lists say "every 4 days" (UX-VERSES-9).

**A streak that keeps its promise (P3-VERSES-11).**
- A day with nothing due keeps the streak, and today is pending.
- A due day with no review breaks it, even after the overdue verse is reviewed later. Recall rows keep 30 days of replaced schedules, and a rating another device overwrote still counts.
- The Home card uses the same rule.

**Undo and the result in the card (UX-VERSES-2, UX-VERSES-6).**
- The rating toast is gone. The result and an Undo button sit in a line in the card's top slot, where the week label usually is, for 10 s. It covers nothing and moves nothing.
- Undo pulls first and restores by value, so a newer review from another device is kept.
- Undo is reachable by keyboard (U or Ctrl+Z).

**Bugs.**
- Read aloud stays after Show (P3-VERSES-06).
- Enter on a focused button presses that button (P3-VERSES-10).
- A double tap can't reveal the next verse (P3-VERSES-12).
- The hidden text is hidden from screen readers too (P3-VERSES-13).
- Extra practice is never counted as due (P3-VERSES-08).
- Honest empty and done states with an Open F260 button (P3-VERSES-14, GAP-VERSES-3, UX-VERSES-4, UX-VERSES-8).

**Kids (UX-VERSES-1).**
- A kid practises the one verse Kid Verse teaches that week. Its paraphrase is shown, labelled, and read aloud.
- Picture buttons at 64 px or more: a try-again arrow, the dashed circle and a check. The icons are the same as the adults', and none is the reward star.
- Everything fits the first screen of a small iPhone.

**The look (VIS-VERSES-1, -6).**
- The card is sized to its content and nothing jumps on Show.
- The histogram is tinted by box.
- Every icon comes from the shared sprite.
- Spacing, type and radii are tokens.

**Kept improvements.**
- **F6:** tap any listed verse to practise it.
- **I1:** "Record yourself", kept in memory on the device only.
- **I2:** an evening "N verses to review" push at 7 pm, off by default, counted on the server.
- **I3:** practice modes on verses with text (Letters, Gaps, Order).

**The Home card (GAP-HOME-2, UX-VERSES-3).**
- "3 to review · 13-day streak" with Review now. It is right before Verses is opened that day, and it shows for adults and guests only.

**What the reviews and runs changed.**
- **Core review.**
  - Undo could erase a newer review from another device that had not been pulled yet.
  - A missed day was forgiven once the overdue verse was reviewed (fixed in three steps: one replaced schedule, then a 30-day history, then the `rev:` rows for a rating another device overwrote).
  - A private paste reached the house with one Enter.
  - The trainer waited for the household channel when offline.
  - The Worker accepted any key.
  - The Undo shortcut outlived its line.
  - A kid's Practise again kept last week's verse.
- **Visual review.**
  - The kid's ratings were below the fold.
  - The toast covered the reference after a row tap.
  - Focus fell to the page.
  - Tab order, a 56–60 px jump on the first rating, the recorder floating, Word order jumping, the queue's chevron and hyphen wraps.
- **The first final run (found by the orchestrator).** The new Home card changed the grid pairs, and Today's reading art covered its text on the iPad. The Home card art had always lain under the text: 322 overlaps already in batch 4. Now:
  - every card has a footer row (button, then art) and art never covers text;
  - art under 48 px is hidden;
  - Kids takes a full row;
  - `home-art-5.mjs` checks 384 page loads and 1,616 cards: 0 overlaps, 0 wrapped labels, 0 cut names.
- **The independent rescore**, after the first run:
  - Show below the fold on a small iPhone;
  - the recorder missing from the rig;
  - the toast over the pill (now the in-card line);
  - a Frost AA miss;
  - icon collisions, radii, the dark ramp, labels.

  After the second run:
  - a top band;
  - the iPad Undo under the bar;
  - kid icons;
  - mode labels;
  - the due count.

  After the third run:
  - the kid's "I said it" shared the microphone with Record; it now uses Show's eye.
- **The status writer.** Home moved more as data landed (iPhone 33 → 43 moves). Fixed by reserving the loading cards: held arm iPhone 29 / 376 px (batch 4: 33 / 391), iPad 31 / 403 (unchanged).

### Each finding's reproduction, rerun

**How the scripts were run.**
- The 25 scripts the entries name ran three at a time on the unchanged code (`git archive` of `1ba5cec`) and on the final code, together with the copies and claims checks in `audits/tools/phase6/5/`.
- Outputs are in `audits/evidence/p6/5/tests/repro-before/` and `repro-after/`.

**Exit codes.**
- Four originals fail on BOTH the pre-batch and the final code because they are stale tooling: kid-flow reads the whole-map `f260.recall` that batch 0e replaced, and the three double-tap scripts never reset the rig household.
- Their `-5` copies are the measurement, and all pass.
- verify-read-aloud-gone-after-show-2 has a `-5` copy that waits out the new 400 ms guard.

| Finding | Before | After |
|---|---|---|
| P3-VERSES-05 (Not yet) | "again tomorrow" while Coming up said 7 days | Not yet is tomorrow; the line states the real interval |
| P3-VERSES-06 (Read aloud) | hidden after Show (all 4 cases) | visible, reads the text |
| P3-VERSES-11 (streak) | Wednesday with nothing due: 0 | 21; a missed due day still breaks it (e1/e3/e4 repros) |
| P3-VERSES-08 (practise anyway) | "1 to go", 1 due | "practice", 0 due |
| P3-VERSES-10 (Enter on Read aloud) | revealed, spoke 0 | read aloud, not revealed |
| P3-VERSES-12 (double tap) | the next card revealed | the second tap ignored for 400 ms (`-5` copies) |
| P3-VERSES-13 (veiled text) | in the accessibility tree | aria-hidden and inert |
| UX-VERSES-1 (kid) | Read aloud said only the reference | the paraphrase, labelled; picture buttons |
| UX-VERSES-2 (Undo) | none | 10 s in-card Undo, by value after a pull |
| IMP-VERSES-I2 (`cron-check-5`) | — | 32/0: the 7 pm hour, due > 0, once a day, off by default, guests their own, never kids |

**The Phase 4 measuring tools**, on the pre-batch archive and on the final code (`audits/evidence/p6/5/p4tools/before/` and `out/`):

| Tool | Verses before → after |
|---|---|
| TOK/literals: colour mixes / local literals / font sizes | 1 / 1 / 1 → 0 / 0 / 0 |
| TYPE/code-scan | 1 px literal, 18 role tokens → 0 px, 42 role tokens, none under 11 px |
| ICON/static | 9 private SVGs, stroke 1.25, 4 "→" → 20 sprite uses, no own stroke, no glyph icons |
| MOTION/press | 2 / 2 → 7 / 7 controls at 0.97 |
| MOTION/cls | the iPhone's 2 landmark moves (27 px) → 0; the iPad 0 → 0 |
| SHAPE/analyze: macro spacing on the 4 px grid | 93.9 % → 95.5 % |
| SHAPE/verify: column | 390 / 664 / 656 / 656, unchanged |
| TELL/tells-webkit: selectable controls | 16 of 18 → 0 of 31 |

**The shell Home's motion.** The default MOTION/cls arm's move count swings from run to run on the same code (10–40), so the held arm is the measure; see `p4tools/cls-home-note.md`.

### Repo tests

| Suite | Before (batch 4's final run) | After |
|---|---|---|
| test-verses | 80 / 0 | 184 / 0 (rewritten for every batch-5 rule) |
| test-home | 65 / 0 | 80 / 0 (the Verses card) |
| test-push2 | 70 / 0 | 81 / 0 (the evening review push) |
| smoke-api.sh | 325 / 0 | 330 / 0 |
| screens-shell | not in the final run | 18 / 0, Home layout shift 0.000 |
| every other suite | pass | pass, identical counts |
| smoke-chat (mock) | 64 / 0 | 64 / 0 |
| Earlier batches' checks | pass | pass. `handoff/prayer/check.js` 47/2 (as since 0g), `0g/check-ids.js` 49/49, the p6-3 and p6-4 copies, `prayer-claims-3` |

- **Batch-5 checks:** verses-a-5 24/0, verses-look-5 275/0, text-policy-5 26/0, cron-check-5 32/0, home-art-5 0 failures.
- **Service worker:** `bump-sw --check` finds 75 precached files present.
- **Scripts:** all 31 inline scripts parse.
- **screens-apps:** 90/1 before and after; the failure is Tally's page background, which predates this batch.

### Measurement, captures and the rescore

**Contrast** (`audits/evidence/p6/5/measure/contrast-accounting.md`).
- **Verses:** 12 samples below AA, all on Show, Read aloud and Record, which are disabled on purpose while the card loads. These are exempt.
- **The shell:** 725 samples, against 737 in batch 1.
  - New since batch 1 and not from this batch: a disabled PIN pad, and edge samples on the offline picker.
  - One real item: the kid Home's hero text over its art in dark mode measures 4.01–4.38:1. It is found, not fixed, and is shell work.

**Captures** on the final code, in `audits/screens-after/5/` (0 failed):
- **Verses, 208:** all of them changed, against both the pre-batch control and Phase 1.
- **Shell, 979:** 218 changed against batch 4. They are Home screens, apart from 7 Apps shots (60 px, anti-aliasing only) and 5 Chat shots (14–24 px).
- **F260, 629, and Prayer, 809:** a few shots changed (23 and 20), but a recapture of the pre-batch code shows a different set, and the opened pairs differ only in scroll position. See `capture/f260-prayer-noise.md`.

**Rescore** (`audits/evidence/p6/5/rescore.md`; an independent judge, the Phase 4 method, bases held):
- **Verses: 5.6 → 6.2.** The first pass gave 5.9; the second, on the second final run, 6.1; the confirmation after the last icon fix, 6.2.
  - Colour 4.5 → 6.5.
  - Shape 5.5 → 6.5.
  - Native 6 → 7.
  - Ease 5 → 6.
  - Delight 5.5 → 6.5.
  - Motion and Icons +½ each.
  - Layout held at 6: the 656 px column still leaves the wide screens empty.

### Not verified
- **On a real iPhone and iPad:**
  - recording (the microphone prompt, then record and play back in Safari; proven in Chromium with a stand-in microphone);
  - read-aloud voices;
  - the editor's dictation;
  - the 7 pm verses push arriving, and its tap;
  - the result line and the smooth scroll under the notch;
  - the kid picture buttons and the press feel;
  - VoiceOver announcing the status line.
- **Left partly done:**
  - 10 carry-overs stay PARTIAL, each owned by a later app batch or the shell.
  - GLASS/layers was not re-run (the rescore found no content glass in 356 Verses jobs).
- **Found, not fixed (outside this batch):**
  - The kid Home hero text in dark mode (4.01–4.38:1).
  - The Tally page-background test failure.
  - The F260 plan's own memory references "Psalm 1:1-7" and "Jeremiah 1:15" look odd (Psalm 1 has 6 verses). They match a church-published copy of the plan, so the app copies them as printed.
- **Production.** Nothing deployed. Deploy order: migrations 006, then 007, then `npx wrangler deploy` (this brings the evening review job and the Verses text rule to the Worker), then the site.

## Batch 6 — Kitchen timer, its pill, Home card, Kitchen and TV views, the "Timer done" push and per-page write queues

| | |
|---|---|
| **Findings** | 24 Timer entries (9 medium, 15 low) and the kept improvement IMP-TIMER-I2. **22 FIXED, 2 NEEDS DEVICE CHECK** (GAP-TIMER-2: the iOS sound unlock and ringing while locked; UX-TIMER-5: reading the Kitchen iPad across a room). **IMP-TIMER-I2 FIXED.** Of the 14 earlier carry-overs with a Timer part, **5 are now FIXED** (P4-SHAPE-01, CONS-ACCENT-2, P4-ICON-01, GAP-TOK-3, VIS-COLOR-1) and **9 stay PARTIAL**, each naming the later batch that owns the rest. Status per entry in `audits/05-findings.md`. |
| **Code commit** | `1484889` (2026-10-02) |
| **Files** | <ul><li>`apps/timer.html` (the batch)</li><li>`index.html`: the shell pill for up to three timers, the Timer Home card, the Kitchen Home's timers, the TV's timer line, the "Timer done" switch in Me → Notifications, Reset with Undo</li><li>`apps/hub.js`: `hub.timers` (fmt, device, restore), `hub.serverNow()`, per-page write queues with a heartbeat</li><li>`icons/sprite.svg` (52 → 60 symbols: timer, pause, bell, egg-fried, apple, popcorn, cooking-pot, cookie, pizza), `icons/timer.svg`, `icons/LICENSE-lucide.txt`</li><li>`worker/src/reminders.js` (`timerJob`, the tombstone purge), `worker/src/index.js` (the minute cron), `worker/src/policy.js` (`run:<self>:*` only), `worker/src/chat.js` (`start_timer`), `worker/wrangler.toml` (cron `* * * * *`), `worker/schema.sql`, `worker/migrations/008-timer-live.sql`</li><li>`sw.js` (`hub-v45` → `hub-v46`), `CLAUDE.md`, `worker/README.md`</li><li>tests: `test-timer.mjs` (45 → 115 checks), `test-home.mjs` (80 → 105), `test-kitchen.mjs` (55 → 62), `test-tv.mjs` (85 → 97), `test-push2.mjs` (81 → 90), `smoke-api.sh` (330 → 346), `smoke-chat.sh` (64 → 76), `test-apps.mjs` (one assertion moved to the new `recents` row), `mock-anthropic.mjs`</li></ul> |
| **Schema / data** | **New migration `008-timer-live.sql`**: a partial index for the minute job's read of live timer rows. It must run at deploy, after 006 and 007. New rows: `app_data(person, timer, 'timer:<id>')` = `{id, label, total, startedAt, endAt, pausedAt, remaining, by, ackAt}` in server ms, at most three; `recents` and `sound` in the same scope; the family mirror `app_data(family, timer, 'run:<owner>:<id>')` (the Worker accepts only the writer's own); `push_pref:timer` (on by default); `settings.timer_pushed`. The old `timer.active` row moves to `timer:m<startedAt>` once. Timer tombstones older than 30 days are purged hourly. The production D1 was exported first: `%LOCALAPPDATA%\house-hub-audit\backups\house-hub-prod-2026-10-01-before-6.sql` (41 KB, 116 rows). Nothing was deployed. |
| **How it was built** | <ul><li>Before the batch, an agent sorted the earlier batches' unfinished entries with a Timer part (14).</li><li>Three workers: A (the timer logic, data, Worker and push), B (its look, kid pictures and the carry-overs) and C (the pill, Home card, Kitchen and TV views, docs).</li><li>Two independent reviewers: 3 core rounds and 5 visual rounds.</li><li>Three full final runs. After the first, the independent rescore found a "control panel" screen, which was redesigned and reviewed; after the second, its ten items were fixed and checked; the third confirmed.</li></ul> |

### The change

**More than one timer (GAP-TIMER-3).**
- Up to three timers, one row each. New timer opens the lengths in place while the first runs.
- A custom time, +1 min, an optional label, and the last three lengths.

**A running timer is safe.**
- A preset can no longer cancel it: the presets hide while a timer runs (UX-TIMER-1).
- Pause is stored and shows as paused on every device (UX-TIMER-2).
- A Switch no longer silences it: the shell keeps counting and rings for timers started on that device (P2-PROF-08).
- Nothing clears a timer at 0. Stop removes it; a device clears a row only right after a good pull, for the start it saw end, or after 10 minutes (P2-STAB-13).
- Every time is server time, so a fast phone no longer ends a timer early (P2-STAB-08).

**An alarm you notice.**
- At 0 it rings every 15 s until Stop, for up to 10 minutes, with a choice of three sounds on one AudioContext (GAP-TIMER-2, P3-TIMER-03).
- "Time's up" in words with a bell; Stop is the only action (UX-TIMER-4).
- A timer that ended unseen says "Ended 8:37 AM" with OK (UX-TIMER-3).
- "Timer done" shows whichever app is open, once (P3-TIMER-04). The time no longer reaches 0:00 early (P3-TIMER-05).
- "Notify me when it ends" offered once, in context (GAP-TIMER-1).
- A server "Timer done" push, from a minute cron, once per start (PWA-GAP-1).
- The wake lock while a timer runs or rings (P2-STAB-09).

**The whole house sees it (GAP-HOME-1, UX-TIMER-5, UX-TIMER-7).**
- A Home card: "Start a timer" with three one-tap lengths, and each running timer with Pause and Reset.
- The Kitchen iPad lists every running timer with its owner's face, on a large dial.
- The TV shows one quiet line first in its feed.
- Reset has a 6 s Undo in the app, on Home and on the Kitchen.

**The look.**
- One primary button in every state (VIS-TIMER-1); no repeated title in the hub (VIS-TIMER-2); h:mm:ss for an hour or more (VIS-TIMER-4); the dial stays round at 0 (P3-TIMER-02).
- Kids get pictures and words: food pictures on the lengths (UX-TIMER-6).
- A calm screen while a timer runs; settings behind a gear.
- Screen readers hear the countdown each minute, at 10 s and at 0 (UX-TIMER-10).

**Kept improvement (IMP-TIMER-I2).** "Say it": "pasta 12 minutes" and similar phrases, confirmed before starting. Adults only, where speech recognition exists. Chat gained `start_timer`.

**Beyond the entries.**
- **The SDK's write queues are per page.** The shell, an app frame and a second tab each keep their own queue with a heartbeat; a page that died hands its queue to the next flusher. Before, one could overwrite another's unsent writes.
- **The Home card grid** was corrected for the new card.

**What the reviews and runs changed.**
- **Core review.**
  - An offline sweep deleted a paused timer (now gated on a good pull).
  - The minute job's reads were unbounded (an index and the purge).
  - A write was lost between the shell, a frame and a second tab (the per-page queues).
  - Undo after a Switch wrote into another person's rows (`hub.timers.restore` checks the owner).
  - The TV pill.
- **Visual review.** The pill overflowing with three timers, the toast over Stop, labels, "Ended 10:20" cut off, a lopsided action row, the kid dial shrinking.
- **The independent rescore.** After the first run: the running screen read as a control panel, so it became the calm screen, the "New timer" picker, the gear, no Replace prompt, Reset hidden while ringing and one Reset name everywhere. After the second run: ten items (the iPad pill's digits, state-word size and others), all fixed.
- **The final runs.**
  - test-apps checked the old `lastPreset` row; moved to `recents`, 48/0.
  - `prayer-look-3` timed out under load; alone 61/0 in 27 s.
  - `basics-6` hung after passing; it now closes its rig and exits.

### Each finding's reproduction, rerun

**How the scripts were run.**
- The scripts the entries name ran three at a time on the unchanged code (`git archive` of `084044f`) and on the final code, together with the copies and checks in `audits/tools/phase6/6/`.
- Outputs are in `audits/evidence/p6/6/tests/repro-before/` and `repro-after/`.

**Exit codes.** Five originals now fail on the final code only because the screen changed on purpose: `basics`, `critic-early-finish`, `verify-critic-early-finish-rounding-4-1`, `verify-done-dial-oval-1` and `-2` wait for a preset or a Start that a running timer now hides, or read the old row. Their `-6` copies measure the same thing on the new screen, and all pass.

| Finding | Before | After |
|---|---|---|
| UX-TIMER-1 (preset during a run) | one tap on 3 min reset a running 9:57 and nulled the row | presets hidden while running; New timer adds one |
| UX-TIMER-2 (pause) | the row null, reopened "3:00 Start" | paused with 175 s left, reopened still paused |
| P2-STAB-08 (clock skew) | a phone 86 s fast: 9:57 vs the iPad's 11:23; a 3-minute timer ended at 91 s | every device counts in server time |
| P2-STAB-13 (sleeping device) | woke 70 s late, 0 beeps, nulled the row | the `-6` copy 11/0: kept until Stop |
| P3-TIMER-02 (done dial) | iPhone 345.8 × 392.9, Start 24 px lower | 352.6 × 352.6, nothing moves |
| P3-TIMER-03 (AudioContext) | 1, 2, 3 contexts over three finishes | 1 in the app, 1 in the shell |
| P3-TIMER-05 (early finish) | 0:00 207–490 ms early | 108–172 ms after the end |
| GAP-TIMER-2 (ring) | one chime, never again | 15 rings in the first minute, until Stop |
| UX-TIMER-3 (ended unseen) | no beep, notification or pill | the pill's Stop, one notification, "Ended 8:37 AM" |
| UX-TIMER-6 (kid) | 0 of 8 controls with a picture | 7 of 7 |
| UX-TIMER-10 (screen readers) | 0 live regions, 0 `aria-pressed` | 1 and 10 |
| PWA-GAP-1 (`cron-check-6`) | no server push | "Timer done" once per start, retried, kids, TV and kitchen skipped |

**The Phase 4 measuring tools**, on the pre-batch archive and on the final code (`audits/evidence/p6/6/p4tools/before/` and `out/`, 8/8 exit 0 each):

| Tool | Timer before → after |
|---|---|
| TOK/literals: literals / ones with an exact token | 23 / 1 → 29 / 0 (more code, none that a token already names); colour mixes 0 → 0 |
| TYPE/code-scan | 1 local variable, 0 role tokens → 10 role tokens, none under 11 px |
| ICON/static | 1 private SVG, 0 sprite uses → 23 sprite uses, no emoji |
| MOTION/press | 8 of 8 controls → 10 of 11 (the 11th is the text field) at 0.97 |
| MOTION/cls | 0 moves → 0 moves, iPhone and iPad |
| SHAPE/analyze: macro spacing on the 4 px grid | 92.3 % → 90.2 % (the area now includes the TV and Kitchen jobs; the Timer's own reached 90.8 % in the rescore's reading) |
| SHAPE/verify: column | 398 / 560, unchanged; 984 at 1180 and 1440 |
| TELL/tells-webkit: selectable controls | 0 of 8 → 0 of 10 |

**The shell Home's motion, held arm** (`p4tools/held/`, two runs each): iPhone CLS 0.180 → 0.083, largest move 376 → 339 px; iPad CLS 0.016 / 0.043 → 0.050 / 0.043, moves 31 → 37 (the new card's landmarks; the largest 403 px both). See `p4tools/cls-home-note.md`.

### Repo tests

| Suite | Before (batch 5's final run) | After |
|---|---|---|
| test-timer | 45 / 0 | 115 / 0 |
| test-home | 80 / 0 | 105 / 0 (the Timer card) |
| test-kitchen | 55 / 0 | 62 / 0 (the Kitchen's timers) |
| test-tv | 85 / 0 | 97 / 0 (the timer line) |
| test-push2 | 81 / 0 | 90 / 0 (the "Timer done" push) |
| smoke-api.sh | 330 / 0 | 346 / 0 |
| smoke-chat (mock) | 64 / 0 | 76 / 0 (`start_timer`) |
| test-apps | 48 / 0 | 48 / 0 (one assertion moved to `recents`) |
| every other suite | pass | pass, identical counts |
| Earlier batches' checks | pass | pass. `handoff/prayer/check.js` 47/2 (as since 0g), `0g/check-ids.js` 49/49, the p6-3, p6-4 and p6-5 copies |

- **Batch-6 checks:** timer-a-6, timer-look-6, cron-check-6, basics-6, background-6, verify-offline-sweep-6, verify-queue-merge-6 and the `-6` copies, all exit 0.
- **Service worker:** `bump-sw --check` finds 75 precached files present.
- **Scripts:** all 32 inline scripts parse.
- **screens-apps:** the one failure is Tally's page background, which predates this batch.

### Measurement, captures and the rescore

**Contrast** (`audits/evidence/p6/6/measure/contrast-accounting.md`).
- **Timer:** 43 samples below AA (the first final run had 115, the second 51). 36 are controls disabled on purpose while the page loads; 7 are the Home card's ringing Stop read through the fixed bars. None is a reading failure.
- **The shell:** 737 samples, as in batch 5, plus 12 on the loading recents.
- **The TV:** 0.

**Captures** on the final code, in `audits/screens-after/6/` (0 failed): pixel diffs Timer 140 of 140 changed, the shell 275, the TV 22 (against batch 2c). Verses showed 37 changed shots; they are the viewer bar, the seed chip and scroll timing, see `capture/verses-noise.md`.

**Rescore** (`audits/evidence/p6/6/rescore.md`; an independent judge, the Phase 4 method, bases held):
- **Timer: 5.5 → 6.1.** First pass 6.0; the second, on the second final run, 6.05; the confirmation on the third, 6.1 (range 6.1–6.4).
  - Typography 7, Colour 6 (from 5 at the base), Layout 7, Icons 6.5, Glance 5.5.
  - Shape held at 5.5 (content glass from other apps in the area's jobs), Motion at 4.5, Dark and Native at 6.5.

### Not verified
- **On a real iPhone and iPad:**
  - the iOS sound unlock and the alarm ringing while the phone is locked (GAP-TIMER-2);
  - reading the Kitchen iPad from across the room (UX-TIMER-5; measured in the rig at about 4 m);
  - the "Timer done" push arriving on a phone, and its tap;
  - the wake lock keeping the screen on;
  - VoiceOver reading the countdown;
  - "Say it" with Safari's speech recognition.
- **Left partly done:** 9 carry-overs stay PARTIAL, each owned by a later app batch or the shell.
- **Found, not fixed (outside this batch):**
  - The kid Home hero text in dark mode (4.01–4.38:1).
  - The kid's chat microphone under the tab bar at XXL text (pre-existing).
  - The Tally page-background test failure (batch 11).
  - Accepted: the idle screen's empty band, the ended chip repeating "Ended".
- **Production.** Nothing deployed. Deploy order: migrations 006, 007, then **008-timer-live**, then `npx wrangler deploy` (this brings the minute cron, the timer push and the timer rules to the Worker), then the site.

## Batch 7 — Kid Verse: the stars, Reset week, the first screen, the grown-ups' panel, the Sunday week offer and a parent's voice

| | |
|---|---|
| **Findings** | 16 Kid Verse entries (5 medium, 11 low) and the three kept improvements IMP-KIDVERSE-F3, -I1 and -I2. **16 FIXED; F3, I1 and I2 FIXED.** Of the 9 earlier carry-overs with a Kid Verse part, Kid Verse's part is done in all 7 that other apps share (CONS-ICON-1, VIS-ICON-1, CONS-TOK-3, CONS-TYPE-2, GAP-TOK-4, CONS-GLASS-2, VIS-SHAPE-1), which **stay PARTIAL** for the batches that own the rest; **VIS-KIDVERSE-6** (the story art's dark form) was out of scope and **stays PARTIAL**; **VIS-KIDVERSE-10** (the iPad long-press) stays **NEEDS DEVICE CHECK**. Status per entry in `audits/05-findings.md`. |
| **Code commit** | `7a77c6b` (2026-10-04) |
| **Files** | <ul><li>`apps/kidverse.html` (the batch)</li><li>`index.html`: Me → Kids' rewards (whole items that wrap, dates with the year only when it is not this year, the ledger rules reading the 30-day mirror), the TV's no-week line</li><li>`icons/sprite.svg` (60 → 62 symbols: scroll-text, ear), `icons/LICENSE-lucide.txt`</li><li>`worker/src/index.js` and `worker/src/media.js` (the private voice routes, `POST`/`GET`/`DELETE /api/kidverse/voice/…`), `worker/src/policy.js` (`voice:` rows are the Worker's only)</li><li>`sw.js` (`hub-v46` → `hub-v47`), `CLAUDE.md`, `worker/README.md`</li><li>tests: `test-kidverse.mjs` (51 → 69 checks), `test-rewards.mjs` (73 → 88), `test-home.mjs` (105 → 109), `test-tv.mjs` (97 → 100), `smoke-api.sh` (346 → 422; 432 with `D1_PERSIST`), `test-kidstory.mjs` (50, its labels' words)</li><li>the batch's checks in `audits/tools/phase6/7/` (stars-a-7, kidverse-look-7, voice-7 and six date-pinned reset copies) and `audits/tools/areas/kidverse.mjs`, `audits/tools/lib/local.mjs` (optional browser flags), committed with the evidence (`654b45a`)</li></ul> |
| **Schema / data** | **No migration.** New rows: the family row `app_data(family, kidverse, 'voice:<week>')` = `{id, by, byName, at, mime, ms, bytes}`, written only by the Worker, with the audio in the media store under `voice/<week>/<random>` (private: a device token and a signed-in profile; never `/api/media/*`); the person row `moveoffer:<week>` (Not now); reset markers `reset:<kind>:<date>` now `{by, at}`; the family mirror `stars:<kid>` keeps 30 days of `days` and `credited.*`, with older ones folded into `creditedBase` and `appliedBefore`. The production D1 was exported before the batch on the owner's PC (`house-hub-prod-2026-10-03-before-7.sql`). Nothing was deployed. |
| **How it was built** | <ul><li>Before the batch, an agent sorted the earlier batches' unfinished entries with a Kid Verse part (9).</li><li>Three workers: A (the stars and week logic), B (the look, the first screen, the word highlight, the shelf and the carry-overs) and C (the recorded voice, the Worker, the TV and Home guards, the docs).</li><li>One combined independent reviewer (core and look): round 1 found 8 items, all fixed; a confirmation round found nothing new beyond one accepted cost and two nits, fixed.</li><li>An independent rescore, then one final run on the owner's PC.</li><li>The status entries, the 05 rebuild, the accounting of the pixel diffs and the contrast samples, and this section were finished in the cloud session.</li></ul> |

### The change

**Stars that add up (P3-KIDVERSE-04, -06, -09, UX-KIDVERSE-9).**
- Each day dot shows every star earned that day: a star for the verse, a book for the story, praying hands for prayed. The label counts what ★N counts ("4 stars this week").
- The balance reads "to cash in", never "all time"; "N ever" is the all-time count.
- The stars mirror is bounded: 30 days kept, older days folded into counters, every total equal to the exact derivation. One Done writes the mirror once.
- A date from an earlier year shows its year, in Kid Verse and in Me.

**Reset week that holds (P3-KIDVERSE-12, -13, UX-KIDVERSE-4).**
- A reset clears all three kinds of the days it lists, in whatever ISO week Kid Verse applies it. Me shows the reset on Monday before the kid opens Kid Verse.
- A story or prayed day heard but not yet credited is spent, never credited later.
- A star earned after the reset's time stays, whichever order the rows arrive in, on one device or two.
- After a reset the two cards agree ("Heard 1 day · no stars this week"), and Done says "Your star for today was reset — come back tomorrow!".

**The week (P3-KIDVERSE-05, GAP-KIDVERSE-1, UX-KIDVERSE-5).**
- A week change repaints the story card and its speaker at once and stops a reading in progress.
- Each real change posts one feed line, "Kid Verse is now week N: <ref>".
- From the first Sunday 5 pm New York more than 5 days after the week was set, a household adult is offered "Move to week N+1?" (Not now is remembered per adult; no push; never a weekday, never at week 52).
- With no family week ever set, a kid sees a picture and "A grown-up will pick this week's verse", and a grown-up "Pick this week's verse". **Owner decision:** with no week there is no verse or story star, but the star for praying on the family list still counts. The TV says the same line quietly; Home paints as usual.

**The screens (UX-KIDVERSE-1, -2, -10, VIS-KIDVERSE-5, -9, -11).**
- The kids' first screen is the art, the reference, the verse speaker and Done, side by side, at every device size; "I heard it" ends within 1.5 screens.
- Pictures, not reading: a scroll for the verse speaker, an open book for the story, an ear with a star for "I heard it", the star for Done; every toast a kid sees is spoken, never over a reading.
- For a grown-up the panel comes first (the offer, the kids' stars, the stepper, the recorder), then the kids' screen under "What the kids see". Each kid's name and count share a line, with the dots below.
- No ★, ✓ or text − / + in a label; the stepper uses the sprite's minus and plus. The rewards summary wraps as whole items.

**Kept improvements.**
- **IMP-KIDVERSE-F3:** the word being spoken is highlighted from the speech engine's boundary events (nothing where they never fire).
- **IMP-KIDVERSE-I1:** Earlier weeks, a read-only shelf ("Just for listening", no star), never on the TV.
- **IMP-KIDVERSE-I2:** a parent's recorded voice for the week's verse, played in place of the synthetic voice, private to signed-in devices.

**The carry-overs.** Kid Verse's icons are the shared sprite, its last `color-mix()`, px sizes and literal sizes are tokens, its "Read it to me" buttons and who-chip are solid, and its story picture is concentric.

**What the review changed.**
- **Round 1:**
  - the Move offer could appear on a weekday (now only the first Sunday 5 pm more than 5 days after);
  - a 56 px star covered the kid's ear;
  - a reset marker could take a star another device stamped after the reset (markers now carry `{by, at}`);
  - "I heard it" sat at 1.95 screens on a phone (the stars card moved below the story);
  - a week change from another device mid-reading left stale words;
  - "Record again" was glass;
  - the no-week prayer star became the owner decision above.
- **Confirmation:**
  - one accepted cost: with the stars card below the story, a kid no longer sees ★N change on screen after Done;
  - stopping the speech now stops only the verse or story it belongs to.

### Each finding's reproduction, rerun

**How the scripts were run.**
- The scripts the entries name ran on the unchanged code (`git archive` of `ac5f7e4`) and on the final code.
- Outputs are in `audits/evidence/p6/7/tests/repro-before/` and `repro-after/`; the date-pinned reset copies in `tests/reset-copies/reset-before|reset-after/`.

**Exit codes.**
- Five original reset scripts exit 1 both before and after, and a sixth exits 0 having proved nothing:
  - they never answer the confirm sheet, so no reset row is written;
  - the cross-week ones assume the week of 27 Sep 2026, so Reset week is disabled on any other date.
- Their `-7` copies (`audits/tools/phase6/7/`) press the sheet and pin the clock, and are the measure. The three "uncredited" copies use the real clock and must not run on a Monday.
- Every other script exits 0 before and after. Their outputs, not their exit codes, show the change.

| Finding | Before | After |
|---|---|---|
| P3-KIDVERSE-04 (day dots, verify-day-dots-vs-count-1/-2) | Ezra ★4 with 1 lit dot, "4 of 7 days"; ★13 read "13 of 7 days" | 3 marked dots, "4 stars this week"; 6 marked dots, "13 stars this week" |
| P3-KIDVERSE-05 (verify-story-card-stale-after-step-2) | after "+", the story card stayed on week 38 until a reload | week 39's story at once, after a pull and after a remote step back |
| P3-KIDVERSE-12 (critic-reset-crossweek-7, 1-1-7, 1-2-7) | Me on Monday before Kid Verse opens ★404; the kid's days {} | ★402; 21 and 27 Sep marked reset |
| P3-KIDVERSE-13 (critic-reset-uncredited-prayed-7, 4-1-7, 4-2-7) | Kiara's prayed day credited after the reset: count 1, total 2, earned 3; Me "★2 · 1 this week · 3 ever" | spent: count 0, total 1, earned 2; Me "★1 · 0 this week · 2 ever" |
| UX-KIDVERSE-2 (visual.mjs, 430 × 932) | Done at 922-1006 px, "I heard it" at 1886 px | Done at 484-593, "I heard it" at 1024 |
| P3-KIDVERSE-06 (verify-all-time-label-1/-2) | "6 stars this week · 422 all time" | "6 stars this week"; "422 to cash in", "871 ever" |
| P3-KIDVERSE-09 (verify-stars-row-growth-1/-2) | Ezra's mirror 14 400 B, one Done uploads 14 468 B; 150 / 150 old days kept | 3 778 B, one Done 3 846 B; 0 / 0 |
| UX-KIDVERSE-9 (rowsize) | badges "Aug 4" … "Aug 26" (2025); Me "on 2026-03-08" | "Aug 4, 2025" …; Me "on Mar 8" |
| VIS-KIDVERSE-5 (visual.mjs, the long-named household) | the counts end at 198 / 201 px under dots from 149 px | name rows above the dots, nothing covered |
| VIS-KIDVERSE-9 (ICON/static) | glyphs ★18 ✓1 −2 | ★12 (comments, speech text, the feed line), ✓0, −0 |

**The batch's own checks** (final run, all exit 0):
- **stars-a-7: 81/0.** Reset across weeks, uncredited days spent, stars after a reset kept (both orders), two devices identical, one and two years bounded and exact, the day marks, the Move offer over 224 instants, the week repaint, no week, years on dates, markers `{by, at}`.
- **kidverse-look-7: 148/0.** The first screen at five sizes, light and dark (and XXL from 820), the adult panel first, the iPhone kids panel, no horizontal scroll 375-1440, kid targets 64 px, pictures and one sprite, the word highlight, the shelf, no week, the ear's badge, a remote week change, the recorder solid, the Move offer.
- **voice-7: 52/0** (Chromium, fake microphone).

**The Phase 4 measuring tools**, on the pre-batch archive and on the final code (`audits/evidence/p6/7/p4tools/before/` and `out/`, 8/8 exit 0 each):

| Tool | Kid Verse before → after |
|---|---|
| TOK/literals | 41 → 18 (font sizes 2, line heights 8, targets 7, local literals 2, opacity 1 → 0; left: the 17 bootstrap colours every app has and the dark art dim `brightness(.82)`, a recorded exception); colour mixes 1 → 0 |
| TYPE/code-scan | 2 px sizes, 30 tokens → 0 px, 43 role tokens; none under 11 px |
| ICON/static | 7 hand-drawn SVGs, 0 sprite uses, stroke 1.5 → 0 hand-drawn, 8 sprite uses, no own stroke width; glyphs 26 → 17 |
| MOTION/press | kid 2 of 2, adult 1 of 1 → kid 4 of 4, adult 4 of 4, at 0.97 |
| MOTION/cls | 0 moves → 0 moves, iPhone and iPad |
| SHAPE/analyze | off-concentric pairs 1 → 0; macro 4 px grid 50.7 % → 48.4 % (the kid ×1.25 of the spacing tokens; TOK spacing 0) |
| SHAPE/verify | column 390 / 664 / 656 / 656, unchanged; the kid's Done, verse and story buttons 84 → 113 px tall |
| TELL/tells-webkit | 0 of 4 → 0 of 11 selectable controls; a double-click selects only the verse reference |

### Repo tests

| Suite | Before (batch 6's final run) | After |
|---|---|---|
| test-kidverse | 51 / 0 | 69 / 0 (the week line, the Sunday offer over 336 instants, no week) |
| test-rewards | 73 / 0 | 88 / 0 (reset across weeks, spent days, a year of facts, "to cash in" and years) |
| test-kidstory | 50 / 0 | 50 / 0 (its labels' words) |
| test-home | 105 / 0 | 109 / 0 (no family week) |
| test-tv | 97 / 0 | 100 / 0 (the no-week line) |
| test-kitchen | 62 / 0 | 62 / 0 |
| smoke-api.sh | 346 / 0 | 422 / 0 (the recorded voice; 432 with `D1_PERSIST`) |
| smoke-chat (mock) | 76 / 0 | 76 / 0 |
| every other suite | pass | pass, identical counts |
| Earlier batches' checks | pass | pass. `handoff/prayer/check.js` 47/2 (as since 0g; do-not-touch), `0g/check-ids.js` 49/49, the p6-3 to p6-6 copies |

- **test-park** printed 20 passed, 0 failed, then exited 127: a Windows libuv assertion while Node closed (`src\win\async.c`), after every check had passed.
- **Service worker:** `hub-v47`; `bump-sw --check` finds 75 precached files present and 70 shipped files accounted for.
- **Scripts:** all 33 inline scripts parse (the new `kv-voice` script is the 33rd).

### Measurement, captures and the rescore

**Contrast** (`audits/evidence/p6/7/measure/contrast-accounting.md`). Kid Verse, the shell and the TV were re-measured.
- **Kid Verse: 13 samples** (batch 1: 12).
  - 8 are the two "Read it to me" buttons, disabled on purpose while the family week loads.
  - 5 are transient, sampled under a toast (the star count "0" in the week-reset state; one shelf card under the cash-in toast).
  - None is a resting failure.
- **The shell: 737 samples,** the same groups as batch 6.
- **The TV: 0.**
- **Glass:** Kid Verse content glass in 0 of 214 jobs (`measure/glass.json`; batch 1: the two glass buttons in 186 of 186).

**Captures** on the final code (Windows, 0 failed): Kid Verse 240, the shell 979, the TV 34. Pixel diffs (`audits/evidence/p6/7/capture/`; accounted in `capture/pixel-diff-accounting.md`):
- **Kid Verse:** 240 of 240 changed, the batch.
- **The shell: 47 of 979 changed against batch 6.**
  - 36 are Me's rewards card: the date "on 2026-03-08" → "on Mar 8", and the whole-item wrap.
  - 11 are noise: the chat thread, the "Kitchen timer" tile label and one Home overflow shot.
  - A cloud re-capture of those screens on the pre-batch and the batch-7 code (Chromium, compared only with itself) shows them unchanged, and only the rewards card changing.
- **The TV: 8 of 34 changed,** all in the empty household: "A grown-up will pick this week's verse." replaces week 1's verse.

**Rescore** (`audits/evidence/p6/7/rescore.md`; an independent judge, the Phase 4 method, bases held): **Kid Verse 5.6 → 6.1** (range 5.95-6.36).
- Layout 6 (the first screen), Shape 6.5, Icons 6.5, Dark 6.5, Ease 7 (Done on the first screen and 114 px tall).
- Typography held at 6, Colour 6, Motion 5, Native 6.5, Glance 5.5, Delight 6.
- Shape's provisional SHP-2 stands: the final glass aggregate shows no Kid Verse content glass.

### Not verified
- **On a real iPhone and iPad:**
  - whether iOS speech sends the boundary events the word highlight needs (IMP-KIDVERSE-F3);
  - recording and playback of a parent's voice in Safari, and autoplay there (IMP-KIDVERSE-I2);
  - hearing the kid's spoken toasts (UX-KIDVERSE-1);
  - the iPad long-press on the story picture and the stars card (VIS-KIDVERSE-10);
  - the shelf sheet's focus on iOS;
  - a real midnight across two kid devices (the reset and star rules are proven with pinned clocks and two rig devices);
  - the Move offer on a real Sunday at 5 pm (proven on pinned clocks).
- **Left partly done:** 8 carry-overs stay PARTIAL: seven owned by the Larder, the Dollywood exports or the shell, and VIS-KIDVERSE-6.
- **Found, not fixed** (the rescore's list, for a later polish pass):
  - the verse art letterboxed in a full-width card;
  - no dark art, and the verse picture repeated as the story thumbnail;
  - day-dot marks 10-13 px when two or three share a dot;
  - one 656 px column on desktop and iPad landscape;
  - two loading tells (Done loses its fill; no skeleton for the reference);
  - wraps at 390-430 ("EZRA'S STORY THIS / WEEK", "Read it / to me", XXL "I heard / it");
  - kid section titles 24-26 px;
  - the no-week placeholder's speaker icon (a speaker, not the scroll).
  - Accepted: a kid no longer sees ★N change after Done (the cost of UX-KIDVERSE-2).
  - `icons/LICENSE-lucide.txt` lists "ear" twice.
- **Production.** Nothing deployed. Batch 7 adds no migration; it ships with the Worker (`npx wrangler deploy`: the voice routes and the `voice:` rule) and the site, in the order already set: migrations 006, 007, 008-timer-live, then the Worker, then the site.
