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
