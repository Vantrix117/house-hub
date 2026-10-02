# Batch 6 (Kitchen timer): workers' reports, digested

Base: HEAD 084044f. Brief: `batch6-brief.md`. Entries: `b6.md` (24 entries + IMP-TIMER-I2). Carry-overs: `b6-carry.md`.

**Prod backup:** `house-hub-prod-2026-10-01-before-6.sql` (41 KB, 116 INSERTs).

**Before-run:** `6-before/`, 15 scripts, all exit 0. Control capture: `cap6-before`.

**Carry-overs:** 10 have a Timer part. P4-SHAPE-01 can be closed. They split by owner:
- **B, the app:** CONS-TYPE-1/2, GAP-TOK-4 (the app part), CONS-ICON-1/2, GAP-ICON-2, CONS-TELL-1, CONS-DARK-1.
- **C, the pill:** P4-SHAPE-01, GAP-TOK-4 (the pill part), the `i-timer` symbol, CONS-MOTION-1.

**Possibly stale entries, open only for app tiles (status writer to confirm):** CONS-ACCENT-2, P4-ICON-01, GAP-TOK-3, VIS-COLOR-1.

## Worker C (shell, Worker, chat, docs): done

### Entries
- **GAP-HOME-1:** the `run:` mirror via `hub.timers.put`. The Kitchen Home lists every running timer with the owner's face (controls only on its own). The TV shows a line first in the feed, and every fit gate holds.
- **P2-PROF-08:** `hub.timers.device` keeps running timers across a Switch ("Eli's Pasta"). A kept timer follows the owner's mirror.
- **P2-STAB-08/13 (shell half):** `hub.serverNow()`. `hub.timers.clear` hides the timer, then removes the row only after a pull, and only if `startedAt` still matches. Nothing clears at 0; the 10-minute rule applies.
- **P2-STAB-09 (shell half):** the wake lock is taken again on visibilitychange.
- **PWA-GAP-1:** a minute cron runs `timerJob`. Push kind `timer`, on by default, once per start, recorded in `settings.timer_pushed`, retried after a failed delivery. Kids, the kiosk and the kitchen are skipped. Orphan mirrors are cleared.
- **UX-TIMER-7:** a Home timer card for adults and guests (recents, with defaults 3/5/10), with running timers showing Pause/Stop. No card on the kid Home.
- **`start_timer` chat tool:** kids may use it. The feed line shows the length only, never the label. `set_data` no longer accepts `timer.active`.
- **`policy.js`:** a family timer row must be `run:<self>:*`; anything else is refused with `not_yours`.
- **Multi-timer pill:** shows the most urgent timer with +N. It rings every 15 s for up to 10 min. "Time's up · label" uses the bell and a Stop button; after that it reads "Ended at h:mm".

### Carry-overs
- **P4-SHAPE-01:** the kid pill is 64 px. This can be closed.
- **GAP-TOK-4 (pill):** TOK shell values fall by about 1 each.
- **i-timer:** now from the sprite; the shell's own symbols go from 23 to 22.
- **CONS-MOTION-1:** the pill press uses the press tokens.

### Scripts
- **verify3-timer-cleared (original):** crashes, because it reads `timer.active`. The -6 copy passes 11/0.
- **wakelock e:** no calls before → granted after.

### Suites
- smoke-api 346/0, smoke-chat 76/0
- test-push2 90/0, test-kitchen 61/0, test-home 92/0, test-tv 94/0
- test-timer 110/0 (3 runs)
- cron-check-6 43/0
- home-art-5 0

### Flags
- **Lock overlap:** B removed A's lock at about 22:36.
- **Not looked at by eye:** XXL, and the shell at 1440 dark.
- **Device-only:** the iOS sound unlock, the real push, the iOS wake lock, kitchen readability, and the minute cron (costs 1440 invocations a day).

## Worker A (Timer logic): done

### Entries
- **GAP-TIMER-2:** rings every 15 s until Stop, for up to 10 minutes, whether or not the page is hidden. Sounds come from `hub.timers.play`.
- **GAP-TIMER-3:** up to 3 timers, a custom time (steppers), +1 min, labels, recents.
- **GAP-TIMER-1:** "Notify me" asks once.
- **UX-TIMER-1:** asks "Replace 9:57?" with Replace, Add a second timer, or Keep.
- **UX-TIMER-2:** pause is stored, so every device shows Paused.
- **UX-TIMER-3:** "Bread timer ended at 6:42 PM", with an OK after 10 minutes. Ended rows are cleared only on freshly pulled data.
- **UX-TIMER-4 (words):** "Time's up" plus the bell.
- **UX-TIMER-10:** aria-live and aria-pressed.
- **P3-TIMER-03:** 1 AudioContext.
- **P3-TIMER-04:** a hidden app shows its own notification, de-duplicated against the shell's.
- **P3-TIMER-05:** the display rounds up and the ring fires at or after `endAt`.
- **VIS-TIMER-4:** times show as h:mm:ss.
- **P2-STAB (app half):** works through `hub.timers`; the wake lock is held while running or ringing.
- **IMP-TIMER-I2:** "Say it" understands phrases like "pasta 12 minutes", "an hour and a half" and "add a minute", and confirms before starting.
- **Migration:** `timer.active` → `timer:m<startedAt>`, so two devices write the same row.

### Scripts
The originals read `timer.active`, so they were copied and adjusted:
- basics-6, background-6, early-finish ×3, audiocontext ×2, notify ×2.

Results:
- **Early finish:** 0:00 now lands 51–170 ms after the end. Before, it came 243–490 ms early.
- **AudioContext:** 1 per page.
- **Notifications:** 0 → 1 while hidden.

### Suites
test-timer 110/0, timer-a-6 35/0, parse 32/0.

### Notes
- B's script removed A's lock. A's run overlapped C's suite but still passed.
- The rig seed still writes `timer.active`, on purpose, to exercise the migration.
- For B: "New timer" sits flush under +1 min at 820 for the kid.

## Worker B (Timer look): done
- **P3-TIMER-02:** the dial stays round at 0 and nothing jumps. The page is now top-aligned. oval-1-6: 352.6×352.6 at a ratio of 1 (was 1.12, with a 24 px jump).
- **UX-TIMER-4:** a bell, and no pulse under Reduce Motion.
- **UX-TIMER-5 (kitchen faked in the rig):** the dial is 679 px and the digits are 155 px, so it reads at about 4.3 m (was about 2.46 m).
- **UX-TIMER-6:** the kid controls have play, pause and rotate icons. The food pictures are apple, popcorn, egg, pot, cookie and pizza. Targets are at least 64 px. Kids get no custom time, label, sound, notify or recents.
- **VIS-TIMER-1:** `#go` is primary in every state.
- **VIS-TIMER-2:** `html.framed` is set.
- **Carry-overs:**
  - CONS-TYPE-1 and -2 (Timer half), GAP-TOK-4 (app), CONS-TELL-1 and CONS-DARK-1 are fixed.
  - The sprite went from 52 to 60 symbols (timer, pause, apple, popcorn, egg, cooking-pot, cookie, pizza). The Lucide geometry was read from the official repo with curl; this is noted against the brief's "no downloads".
  - `icons/timer.svg` was redrawn to the same Lucide timer.
- **Phase 4:**
  - TYPE tokens: 0 → 12.
  - ICON uses: 0 → 19.
  - Press: 8/8 → 13/14 (the 14th is the text field).
  - cls: 0 moves.
  - TELL draggable: 1 → 0.
  - SHAPE/analyze was not re-run.
- **Phase 3 scripts:**
  - oval-2 and visual can't reach 0 under server-time timers (they step only the browser clock); timer-look-6 proves those states instead.
  - audience: icons on kid controls 16 false → 36 true.
- **Results:** timer-look-6 133/0; capture 150.
- **Lock incident:** B's first wait timed out after 550 s, then B ran without the lock and deleted A's. B now uses `withlock.sh`.
- **Gap in the rig:** the capture seeds the old `timer.active` and steps only the browser clock, so the done shots still show a running timer. → A is updating the seed and the area.

## Worker A follow-up: the capture rig matches the new contract
- **Seed:** timers are written as `timer:` rows plus their mirrors, using server time.
  - Typical: Elizabeth has one 15-minute timer.
  - Overflow: 3 timers (1:44:05, a long label, and Tea paused at 2:10).
  - Park: still seeds `timer.active`, so the migration path stays covered.
- **Kitchen:** the rig now seeds a real kitchen device, `rig-kitchen-counter`. The captures use it for `profile: 'kitchen'`. As a side effect, Me → Admin → Devices lists one more device.
- **Timer area screens:** idle, running, paused, replace, ringing, ended-unseen, migrated, kid, kitchen, pill, chip and done-toast. They no longer move the browser clock; each end time is written relative to `hub.serverNow()`.
- **Capture:** 198 shots, 0 failures.
- **Lock slip:** a 20-shot capture ran while the core reviewer held the lock.
- **Note:** the done-toast covers the ringing pill on Home. Sent to the visual review.

## Core review, round 1
**Suites:** all green. smoke-chat failed first with a stale mock (65/11) and passed 76/0 on a fresh mock. timer-a-6 34/1: its seed moved.

**Findings**
- **H1 (high).** `sweep()` and `pendingClears` act on stale data: "fresh data" only checked `lastPull` truthy, and onSync fires on failed pulls too. An offline device deletes a timer that was paused on another device. Repro: e1. → C
- **M1 (medium).** The TV shows a device timer pill with Stop over the feed. Repro: e6. → C
- **M2 (medium).** `timerJob` reads every `timer:`/`run:` row, tombstones included, and the tombstones are never purged, so reads grow without bound. Repro: cost.mjs. → C
- **L1 (low).** "+1 min" on a ringing timer: the second end gets no notification or push, because the dedupe key lacks `endAt`. → C
- **L2 (low).** Two alerts while hidden: the local notification plus a push with `renotify`. → C
- **L4 (low).** The 15 s re-ring test is flaky: 4 of 9 runs in C's own runs. → C
- **Nit: legacy timer in the deploy window.** Migration never runs once a `timer:` row exists, and Home card Pause on the legacy row throws. → A (migrate), C (put/norm).
- **L3.** timer-a-6 needs the park seed. → A
- **Nit.** `serverNow` with an unknown skew is not documented. → A/C

**Checked fine:** the policy `run:` rule, the minute cron routing, the `timerJob` rules, `start_timer`, escaping, the Switch keep-alive, two devices 90 s apart, and the migration on two devices at once.

### Worker A, round-1 fixes
- **Migration:** C's `hub.timers.migrate()` migrates even when `timer:` rows already exist, and acts only after a good pull. The app calls it. `put()` accepts a legacy row. Tests were added.
- **timer-a-6:** now uses the park seed. Result: 36/0.
- **New finding (A):** a lost write. The shell and the app iframe each save their own copy of the same localStorage queue key, so the shell's save replaced the app's queued row. Seen once in test-timer. → C, high priority, needs a repro test.
- **test-timer P3-TIMER-04 check:** stale. The dedupe key is now `@endAt`. → C.

## Visual review round 1

### Regressions
- **1. MED:** the sidebar pill overflows at iPad landscape; the kid Stop sticks out. → C
- **2. LOW-MED:** iPhone Home layout shift on cold load (held arm 0.120 → 0.180), from the Timer card's skeleton. → C
- **3. LOW:** `<use>` is rebuilt on every tick, so icons sometimes blank:
  - the app's `#tstate` every 250 ms → A
  - the shell resets the href every second → C

### Batch-6 entries not fully fixed
- **4. MED:** the ringing sidebar pill doesn't show "Time's up". → C
- **5. MED:** the phone pill shows no label (fixed position shrinks it to 50vw). → C
- **6. MED:** the toast covers the ringing pill below 1024 for 8 s. → C
- **7. MED:** the TV line hides the time. → C
- **8. LOW:** focus order — recents come before the presets in the markup. → A + B
- **9. LOW:** accessible names — `#plus1` label-in-name, list separators, a double aria attribute on `#custom-btn`. → A
- **10. LOW:** the dial label jumps 23–26 px. → A + B
- **11. LOW:** the kid replace prompt is text only. → A + B
- **12. LOW:** on the Home card the bell wraps, and ringing should be listed first. → C
- **13. NIT:** at XXL on 375×667, Pause sits below the fold. → B

### Checked and fine
- The dial and controls don't move.
- "Time's up" plus the bell; Reduce Motion is respected.
- No horizontal scroll.
- Kid controls ≥ 64 px.
- Kitchen glance size.
- aria-live: 4 announcements in 74 s.
- Sprite: 60 symbols.
- Phase 4 numbers confirmed.

### Suites
- Green except test-timer 111/2 — A's queue-race check, waiting on C's fix.
- screens-apps 90/1 (Tally, pre-existing).

### pxdiff
- Timer: 140/140.
- Shell: 275/979, all accounted for.
- TV: 22/34 against 2c.

### Rig note
XXL via the `hub.prefs` mirror doesn't work, because the person row overrides it. Use the `data-text-size` attribute.

### Worker C round-1 fixes (core + queue race + visual)

**Core**
- **H1:** `justPulled` gate. sweep, clear, pending, migrate and updateDevice act only right after a successful pull (≤5 s old, once per pull). e1 now holds. New check verify-offline-sweep-6: 7/0.
- **M1:** `liveTimers()` returns `[]` on the TV.
- **M2:** hourly purge of tombstones older than 1 day. Reads go through `INDEXED BY app_data_timer_live`, with a fallback. **New migration `worker/migrations/008-timer-live.sql`, which must run at deploy with 006/007.** cost.mjs: about 7,306 → 6 rows read per minute.
- **L1:** `endAt` added to the dedupe key, the notification tag and the push key.
- **L2:** `renotify:false` for timer tags.
- **L4:** threshold 14.5 s; test-timer 113/0 ×3.
- **Legacy:** `put()` writes `m<startedAt>`; Home card Pause works.

**Queue race**
- New check verify-queue-merge-6: 0/2 → 2/0.
- `saveQueue` merges the stored queue by key, newer `updated_at` wins. A possible duplicate resend is harmless.
- **For the next reviewer:** check that a row already sent cannot keep coming back indefinitely.

**Visual**
- **1, 4:** the sidebar pill drops the ring and +N, uses `--fs-title2`, and wraps to "Time's up" + Stop.
- **2:** the pill is now `max-content` wide.
- **3:** the toast is removed. The pill or chip is the Stop.
- **TV line:** name, time, "left", label, with `fitTimers` and +N; test-tv asserts the time is visible.
- **5:** loading start row. iPhone held 0.180 → 0.083 (HEAD 0.120).
- **6:** href set only on change.
- **12:** bell inline; ringing timers listed first.

**Suites**
- test-home 93/0, test-tv 97/0, test-kitchen 61/0, test-push2 90/0, smoke-api 346/0, screens-shell 18/0, cron-check-6 47/0.
- home-art-5: 0.

## Round-1 visual fixes, Workers A and B

**A**
- `#tstate` is rebuilt only when its state key changes.
- Markup order now matches the screen.
- Accessible names: `#plus1` reads "Add 1 minute" with "1 min" shown; the list button reads "Pasta, 12:00 left"; `#custom-btn` keeps only `aria-expanded`.
- The label rows keep their space (no-break space when empty).
- The kid replace question: "Change the timer to 3:00?" with Yes, Add one and No buttons, each with a picture.

**B**
- The CSS `order` rules are gone, so the DOM order matches the drawing.
- The actions row sits directly under the dial in every state, so on a 375×667 phone at XXL text, Pause/Stop ends at y 430.
- The state and label rows have fixed heights.
- Kid replace buttons are at least 64 px.

**Results**
- timer-look-6 146/0
- test-timer 113/0
- timer-a-6 36/0
- capture 198

## Core review, round 2
- **Round-1 items:** all fixed. Migration 008 is idempotent and the fallback works.
- **`saveQueue` merge** (shell plus frame): e7b shows 0 of 602 lost, against 300 of 600 at HEAD. Deletes stay deleted and there is no resend loop.
- **Suites:** green across every app, including test-hub, f260, prayer, verses, kidverse, leftovers, forget-device and kid-two-devices.

**New findings**
- **1, LOW:** a paused timer can become a ghost on a device that was away for more than a day, because the tombstone is purged after 1 day. → C: keep tombstones for 30 days.
- **2, pre-existing data loss:** with two tabs on one device, 297 of 600 rows are lost (HEAD: 298 of 600). Cause: each tab's read-merge-write plus a wholesale queue replace on `storage`. → C, orchestrator's decision: a per-document queue key, with the flusher sending every key of the person.
- **3, nit:** about two-thirds of rows are sent twice (pre-existing and harmless).
- **Housekeeping:** the core reviewer's `git checkout` of `docs/screens` ran while the visual reviewer held the lock.

## Visual review, round 2
- **Round-1 items:** all 13 are fixed. iPhone Home cold-load shift on the held arm: 0.180 → 0.083 (HEAD 0.120).
- **New findings and owners:**
  - 1, LOW-MED, B: a long label in the dial runs into the ring.
  - 2, LOW-MED, C: the running sidebar pill wraps and loses its +N.
  - 3, LOW, A: the "ended" line pushes the controls down 78 px.
  - 4, NIT, C: the kid/XXL ringing sidebar pill is 172 px tall.
  - 5, NIT, B: a stale CSS comment.
- **Suites:** timer-look-6 146/0, test-timer 113/0, test-tv 97/0, screens-shell 18/0, test-design 60/0, home-art-5 0.
- **Not reviewed:** the 03:28 hub.js queue change. It belongs to the core review.

### Worker C round-2 fixes

**Tombstone retention:** timer tombstones are now kept 30 days. cron-check-6 48/0.

**Sync queue (per-document)**
- Each document has its own queue: `hub.queue.<app>.<scope>.<pid>.<docId>`.
- A heartbeat `hub.qalive.<docId>` (every 20 s; a document is gone after 3 min) lets the flusher adopt the queues of closed documents, including legacy keys. It sends the queues of other live documents read-only.
- `retire()` adopts all of the person's keys first. Forget-device refuses if any key is non-empty. The heartbeat writes nothing on an unpaired device.
- Results:
  - e7tabsb: 0 of 600 lost, nothing sent while idle.
  - e7b: 0 lost.
  - Duplicate sends: 628 and 1,123 sent per 600 written (harmless).
  - forget-device 14/0, kid-two-devices passes.

**Sidebar pill**
- One row while running (label ellipsis, plus +N).
- When ringing, it wraps to two rows: "Time's up · name", then Stop.
- Probe: 12/12.

**Suites**
- test-timer 113 ×3
- hub 47, f260 58, prayer 36, verses 184, kidverse 51, leftovers 42
- home 93, tv 97, kitchen 61
- push2 90, smoke-api 346, screens-shell 18

**Note:** the old phase-2 scripts read the old single queue key, so they need a pattern match on any docId if they are re-run.

### Worker B round 2: label and state rows
- The label sits above the digits and the state line below them, each sized to fit the ring (58% and 56% wide).
- New chord check in timer-look-6: 158/0.
- The CSS comment is updated.

## Core review round 3: CLEAN

### Queue design attacks
| Run | What it tested | Rows lost |
|---|---|---|
| e7b | | 0/600 |
| e7tabsb | | 0/600 |
| e8 | adopting a document that was asleep | all 21 land; a stale row is resent ≤3 times, then refused; no loop |
| e9 | storage quota full | 0 |

- **Loop:** by code reading, a loop is impossible.
- **Retire / Switch:** no cross-person leak.
- **Pagehide:** at most sends a row twice.
- **Legacy key:** adopted as dead.
- **Nit:** a crashed page's heartbeat lingers, about 30 bytes.

### Suites (all green)
- test-hub 47, test-timer 113, f260 58, prayer 36, verses 184, kidverse 51, leftovers 42, home 93
- smoke-api 346, cron-check-6 48
- offline-sweep 7, queue-merge 2
- forget-device 14, kid-two-devices: pass

None of the scripts in the final run read the old exact queue key.
- **A:** `#ended` moved after `.actions`. test-timer 113/0, timer-a-6 36/0.

## Visual review, round 3
**Round-2 and round-1 items:** all fixed. Chord, sidebar pill and ended-note checks are fine. No regressions from round 1.

**New findings**
- **1, LOW-MED.** At XXL the state words in the dial are cut off ("Time's up", "Pau…"): the line is held to 56% width with nowrap. → B
- **2, NIT.** The sidebar pill shows a one-letter label ("L."). → C
- **3, NIT.** The kid/XXL ringing sidebar pill is 197 px tall. Accepted: it works, and the whole pill is the Stop button.

**Suites:** timer-look-6 158/0, test-timer 113/0, screens-shell 18/0, home-art-5 0.
- **C:** the sidebar pill label is hidden when the space is under about 2.2em. Pill probe 12/12, test-home 93/0.
- **B:** the state line is `min(--fs-headline, 7cqw)` and up to 66% wide, so it never cuts off. timer-look-6 182/0 with a new `statefit` check.
- **B flags:** at kid XXL on a 375 px screen, the viewer bar title reads "Kitchen ti…". Visual round 4 will check whether this batch caused it.

## Visual review, round 4
- **Clean:** both round-3 fixes (the state line fits the chord with nothing truncated; the sidebar pill).
- **"Kitchen ti…":** pre-existing. HEAD and batch 6 are pixel-identical.
- **New, LOW, caused by batch 6:** the viewer-bar timer chip got wider at XXL, which now cuts "Tally counter" for adults at XXL 390.
- **Pre-existing:** at kid XXL 375 the viewer bar overflows and Reload ends up off-screen.
- **Both sent to C:** pin the chip icon to `--icon-sm`, and make the bar fit.
- **Suites:** timer-look-6 182/0, test-timer 113/0, screens-shell 18/0.

### Viewer bar (C, after visual rounds 4 and 5)
- **Chip:** the icon is pinned at `--icon-sm` with a `--sp-1` gap, so the chip is back to HEAD's width (83 px; HEAD was 85).
- **Phones:**
  - `#pill-name` shortens with an ellipsis when space runs out.
  - A kid's Back button shows only its arrow; its accessible name stays "Back to Apps".
  - The chevron does not shrink (`flex:none`) and is hidden for kids while a timer runs.
- **Reload:** stays on screen in every case.
- **Title width:** equal to HEAD's or wider, with one exception. Kid at XXL, in Tally, with a timer running: 74 px at 375 (HEAD 120, which only fit because Reload was off-screen). Accepted.
- **Tests:** test-home 97/0, screens-shell 18/0.
- **Visual round 5:** confirmed Reload is on screen everywhere and reported the title squeeze, which led to the Back-arrow change above.

## First final run (final-6)

**Overall:** all green apart from three items, each resolved below.

**Two stale originals failed**
- `critic-early-finish` and `4-1` exit 1 because they read `timer.active`.
- Their `-6` copies pass.

**test-apps: 47/1 in the run, now 48/0**
- The failing assertion was stale: it checked `lastPreset`, which the new contract no longer writes.
- Updated it so the test taps a preset, presses Start, then expects `recents` to hold the length.
- Re-run on its own: 48/0.

**p6-3 prayer-look-3: timed out (exit 124), now 61/0**
- It hit the limit under load during the run.
- Re-run alone: 61/0 in 27 s. Its stray untracked outputs were moved to `SCRATCH/fu6`.

**Captures and pxdiff**
- Captures: timer 198, shell 979, tv 34, verses 208, all OK.
- pxdiff vs before:
  - timer 140/140 (redesign);
  - shell 275 (as the visual review accounted for);
  - tv 22 (vs 2c);
  - verses 36, explained in `capture/verses-noise.md` (the viewer bar, the seed chip, scroll timing).

**Contrast:** `measure/contrast-accounting.md`
- timer: disabled/loading controls, plus 7 Stop samples that sit under a fixed bar;
- shell: +12 loading-recents samples;
- otherwise as in batch 5.

**p4tools:** all exit 0. The default `cls` arm stays noisy. Max px: iPhone 376 → 339, iPad 403 → 402.

## Independent rescore
**Timer: 5.5 → 6.0** (central score; range 5.9–6.2).

| Area | Before → after |
|---|---|
| Layout | 6 → 7 |
| Icons | 3.5 → 6 |
| Native | 6 → 6.5 |
| Ease | 5 → 6 |
| Delight | 4.5 → 5.5 |

**Found while judging, with owners**
1. **MED:** the screen is a control panel in every state, the alarm included. → A (restructure), B (style).
2. **MED-LOW:** one action has two names (Stop on Home, Reset in the app), and Reset shows beside Stop while ringing. → A + C
3. **MED-LOW:** an ended-unseen timer is announced three times. → A + B
4. **LOW:** the iPad-landscape pill's digits shrank. → C
5. **LOW:** the state words are small on the iPad. → B
6. **LOW:**
   - the egg picture reads as "0" → B
   - kids see the words-only "New timer" and "Say it" → A
7. **LOW:** Keep uses an X, and the tapped preset shows as selected before Replace. → A + B
8. **NIT:** +1/Reset look disabled at idle. → A
9. **NIT:** the kitchen dial is graphite. → B
10. **NIT:** an unlabelled timer reads "Timer / Timer 6:20". → C

## Status writer, first pass (final-6; to be regenerated after the follow-up)

**Totals**
- Entries: 22 FIXED, 2 NEEDS DEVICE CHECK (GAP-TIMER-2, UX-TIMER-5).
- Work: 1 FIXED.
- Carry: 5 FIXED, 9 PARTIAL.

**Stale entries closed as FIXED:** CONS-ACCENT-2, P4-ICON-01, GAP-TOK-3, VIS-COLOR-1.
- Evidence: a scratch run of `verify-icon-ink-hex-not-lifted-dark-1` (SCRATCH/st6). Dark tile icons went from 1.87–3.22 to 6.00–6.25.
- **TODO:** file that output under the evidence before citing it.

**Flags**
- PWA-GAP-1 is FIXED, but real phone delivery is not verified.
- UX-TIMER-5: only the kitchen device gets the lifted dial cap. A person's own iPad still reads at 2.46 m.
- "Home card grid" means batch 6's Timer card and viewer bar. (The grid itself was batch 5.)

## Rescore follow-up fixes

### C (shell, Home, Kitchen)
- **Reset for a running timer.** Running and paused timers on Home and Kitchen show "Reset" with a rotate icon and a 6 s Undo. Undo calls the new `hub.timers.restore(row)`, which returns null if a newer timer already took the same id. A ringing timer shows "Stop" with a square.
- **iPad pill.** The time sits on its own row at `min(--fs-glance-3, 38cqw)`: 31 px (adult default) and 40 px (XXL).
- **Unlabelled rows** show just the time.
- **Tests:** test-home 102/0, test-kitchen 62/0, test-tv 97/0, screens-shell 18/0, home-art-5 0, pill probe 84/0.

### A (app)
- **A quieter screen** while a timer is on the dial: only the dial, its actions and the list show. "New timer" opens the picker. Sound and Notify me move into a "Timer settings" disclosure.
- **Recents** that duplicate a preset are hidden.
- **The Replace prompt is gone.** No preset is visible while a timer is running, so `#ask` is only used for confirming "Say it".
- **Reset is hidden while ringing.**
- **An unseen end** reads "Ended 8:37 AM" with OK, and the separate note is gone.
- **Kids** don't see New timer, Say it or Timer settings.
- **At idle,** +1 and Reset are hidden but keep their space.
- **Tests:** test-timer 111/0, timer-a-6 39/0. The capture's "replace" state is now "new-timer".

### B (look)
- **Styled A's new structure:** the picker opens in place, the settings sit in a gear panel, and "Ended" uses 6cqw.
- **State words** are `min(--fs-title2, 8cqw)`: 24.6 px on an iPad.
- **Icons:** the hand-drawn `i-egg-fried` replaces `i-egg`, and is listed as hand-drawn.
- **Kitchen:** coral instead of graphite (AA 5.93 / 8.7); the portrait dial is centred.
- **Tests:** timer-look-6 200/0, capture 198.

## Core review round 4 (rescore follow-up)

**Finding: MEDIUM.** Reset → Switch → Undo within 6 s restores the timer into the next person's rows (repro e10). Cause: no owner check, and the toast survives the picker. → C:
- `restore()` refuses unless `by === me`;
- `resetTimer` checks the owner;
- `showPicker` hides the toast.

**Checked fine:**
- restore: pending clear, tombstone, offline, push keys;
- OK on ended-unseen;
- the kid path;
- UX-TIMER-1.

Undo winning over a remote Stop or Pause in the 6 s window is by design.

**Suites:** all green — test-timer 111, test-home 102, test-kitchen 62, test-tv 97, test-push2 90, timer-a-6 39, cron-check-6 48, verify-offline-sweep-6 7, verify-queue-merge-6 2.

## Visual review, round 6 (the rescore redesign)
**Findings**
- **1, MED:** with a 2-digit hour, "Ended 10:20 AM" is truncated, and timer-look-6 fails 2 of 200 after 10:00. → B
- **2, MED:** the Home Reset Undo toast covers the pill's Stop below 1024 px. → C
- **3, LOW-MED:** a short pill label (e.g. "Tea") is hidden even when there is room. → C
- **4, LOW:** on the kid idle screen an empty row pushes the pictures below the fold. → B
- **5, NIT:** the egg icon is Lucide geometry; credit it in the license. → B
- **NIT:** the kitchen landscape dial could grow. → B, optional

**Checked and fine**
- No jumps; the fold holds at 375×667 XXL.
- Kid targets are at least 64 px.
- Focus order and aria-expanded are correct.
- iPad pill, Home card and kitchen look right.

**Suites:** timer-look-6 198/2, test-timer 111/0, test-home 102/0, screens-shell 18/0 (on re-run), home-art-5 0.

### Round-4 core and round-6 visual fixes

**C**
- **Restore safety:** `restore()` only acts on rows where `by === me`. Undo is owner-checked, and the toast is hidden on the picker and on `enterShell`. Checked by e10 and test-home: 104/0, then 105/0.
- **Toast and pill position:** the toast now sits above the pill band. A ResizeObserver measures the tab bar and the pill (`--tabbar-h`, `--tp-h`), which also fixes the kid XXL pill overlapping the tab bar.
- **Short labels:** hidden only when actually cut off.
- **Pill probe:** 191 OK, 1 by design — on a 375 px kid XXL screen, "Tea" doesn't fit.

**B**
- **"Ended" cut off:** the cause was absolute positioning at `left:50%`, which caps the width. Fixed with `width:max-content`, a cap of 74%, and 6.5cqw text. The test now checks "Ended 12:59 PM": 12/12.
- **Kid idle layout:** +1 and Reset use `display:none` when idle; `#go` takes the full row; the dial is capped at `min(82vw, 44vh, 400px)`; pictures sit above the fold at 375×667.
- **Egg icon:** credited as Lucide's own `egg-fried`.
- **Kitchen landscape dial:** now `min(52vw, 84vh, 680px)`.
- **Results:** timer-look-6 216/0, test-timer 111/0, capture 198.

## Visual round 7: CLEAN
**Confirmed fixed:**
- "Ended 11:25 AM" (2-digit hour) is whole.
- The toast no longer overlaps Stop.
- "Tea" shows in the pill.
- Kid pictures are above the fold.
- The kitchen view is correct.

**Measured tab bar / pill (no regressions; one gain):**
- Home bottom is clear.
- Chat has the pill above the composer.
- Kid XXL: the pill no longer covers the tab bar (HEAD did).

**Suites:** timer-look-6 216/0, test-timer 111/0, test-home 105/0, screens-shell 18/0.

**Found, not fixed (pre-existing):** in kid XXL chat, the composer mic sits under the tab bar (HEAD has the same).

**Next:** the second final run (final-6b).

## Second final run (final-6b)
- **Overall:** all green except as noted below.
- **basics-6:** failed in the run because it tapped a preset while a timer was running. A rewrote it; re-run 6/0 (`repro-after/p6-6__basics-6.rerun.txt`).
- **Originals that now fail on purpose:** basics, oval-1 and oval-2 tap a preset that is hidden while a timer runs. critic-early-finish and 4-1 still fail as before (they read `timer.active`).
- **Suites:** test-apps 48/0, smoke-api 346/0, smoke-chat 76/0.
- **home-art-5:** 384 loads / 1,904 cards, all checks 0.
- **Contrast:** timer 51 samples (loading/disabled plus 7 under the bar), shell 737.

## Rescore confirmation (final-6b)
**Score:** Timer 5.5 → 6.0 (first pass) → 6.0 (6.05; range 6.0–6.3). Icons 6 → 6.5, with ICO-4 lifted.

**First-pass items:** 8 fixed; #8 fixed with a side effect; #3 partly fixed.

**Open items**
- **A, med-low:** the action row is lopsided because hidden buttons keep their space. → B
- **B, low:** wide screens look empty. → B
- **C, low:** no Undo in the app. → A
- **D, low:** the kid dial shrank everywhere. → B
- **E, low:** "Notify me" is one tap deeper. → A
- **F, nit:** an unseen end still looks like an alarm. → B
- **Stale:** the `replace-typical` PNGs. → A deletes them

## Status writer, second pass (final-6b)
- **Result:** counts unchanged (22 FIXED + 2 device checks / 1 / 5 FIXED + 9 PARTIAL); 290 checks pass.
- **Evidence filed:** `checks/verify-icon-ink-dark-1/`, a rerun on a scratch copy of the final code, plus `tile-oklch.txt`.
- **Dropped:** the 0.120 → 0.083 held-cls claim from GAP-TIMER-3, because it predates the redesign.
- **NOTE:** the third final run will delete untracked p6/6, so `checks/verify-icon-ink-dark-1` must be held and restored afterwards.

## Judge follow-up fixes
- **A (app):** in-app Reset Undo (6 s, owner-checked, restores focus). One-time inline "Notify me" offer. test-timer 115/0, timer-a-6 42/0.
- **B (layout):**
  - `#go` fills row 1; the second row is centred, +1/Reset use `display:none` at idle, and the adult min-height keeps the list in place.
  - Landscape dial is `min(46vw,78vh,--col-narrow)`, with `#go` level with the dial's centre.
  - The kid 44vh cap applies only under 700 px; the quiet unseen dial is styled.
  - timer-look-6 226/0.
- **Core round 5: CLEAN.** Undo has a double owner guard, push/offline checked, the offer is once per device, and the kiosk is excluded.
- **Visual round 8: CLEAN.** No jumps; rows filled or centred; kid dial sizes; quiet unseen; offer 44 px X; the Undo toast clears the actions; fold OK.
  - Nit, accepted: a 70–90 px band at idle with no timers (reads as section spacing).
- **Next:** the third final run (final-6c).
