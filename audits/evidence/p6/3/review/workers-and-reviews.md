# Batch 3: the workers' reports (digest)

## Worker A — Prayer logic, data and copy (24 fixed, 1 already fixed)

- **P3-PRAYER-07** Category groups remember open/closed per screen and list (`catOpen`); a search opens all.
  - Scripts: list-collapse, verify-list-group-collapses-1/-2 went from folded to staying open.
- **P3-PRAYER-08** Share copies a weekly request's days, and the preview shows them. An old family weekly copy with no days
  now shows every day. This is a read-only rule in `todaySet`.
  - Scripts: share-drops-days-1/-2: days [] → Sun/Tue/Thu; the request shows on Eli's and Mom's family Today.
- **P3-PRAYER-09** Already fixed by an earlier batch (`byIdAny`).
  - The originals time out on `#toastAct`, because the toast is now hub.toast.
  - The copies in `audits/tools/phase6/3/` (undo-stale-3, verify-undo-stale-object-1-3/-2-3) show the row active again,
    3 runs.
- **P3-PRAYER-12** `reviewItems` lists each request once. The badge went from 8 for 6 requests to 6 for 6.
- **P3-PRAYER-13** The cheer shows only when a list was scheduled and is finished.
- **P3-PRAYER-14** The category row and its Remove confirm both count every request, answered ones included, and the
  confirm names the answered ones.
  - count-mismatch-1: row 1 vs confirm 2 → 2 vs 2.
  - count-mismatch-2 still lists rows, because it compares the row against the active count only.
- **P3-PRAYER-15** New family delete copy: "It comes off the family list for everyone in the house."
  - delete-copy-wrong-2 still reports `staleOfflineWriteResurrects: true`: a stale offline edit brings a deleted row back
    under last-write-wins, which is outside this batch.
- **P3-PRAYER-16** The headline says this morning before noon, today until 5 pm, and this evening after, by the device
  clock.
- **P3-PRAYER-19** `refreshKitchen()` repaints an open Kitchen view on remote changes and at the house's midnight, keeping
  its scroll.
  - kitchen-view-stale-3-1/-2: new request false → true; answered request still asked for true → false.
- **P3-PRAYER-20** Add says "Adding to" with a My list / Family list switch; the kitchen gets Family only. The button reads
  "Add to My list" or "Add to the Family list", with a line on who will see it.
- **P3-PRAYER-21** Unticking removes today when nothing is marked today. On the family list that happens only when no
  one's tick is left on any family row.
  - The streak, month count and calendar also count every day a family row has anyone's tick.
  - Kids still only add days; the `unprayed` rule is unchanged.
  - untick-keeps-day-5: streak 4 → 3, server 1 → 0.
- **P3-PRAYER-22** The Sunday nudge shows only if something has gone quiet or had no news. With only no-news items it
  reads "Some requests have had no news in a while."
- **P3-PRAYER-23** Remove repoints a "One category only" plan to Personal. Loading repairs an already broken plan.
  - focus-7-2: the original times out at the new family confirm; the -3 copy passes.
- **P3-PRAYER-26** Escape closes, in order: an inline panel, the sheet, the Kitchen view. Enter submits Add, one-line
  panels, edit and New category. Ctrl/Cmd+Enter submits textareas. IME typing is left alone.
  - The originals fail only on follow-up taps. The -3 copies pass in both engines (Enter adds 19 → 20; a plan 2 → 3).
- **UX-PRAYER-1** The Add button stays pinned above the tab bar and is visible at every size. layout: saveBottom 800 vs
  nav 807 on iPhone.
- **UX-PRAYER-4** Settings is titled "My list settings" / "Family list settings", with a note. The first family change
  asks `hub.confirm` ("Change the Family list?"); once per visit.
- **UX-PRAYER-5** "More" becomes "Share & print", in the button and the sheet title.
- **UX-PRAYER-6** The family detail sheet shows who asked and who prayed today.
- **UX-PRAYER-10** Undone rows come first, then prayed. Each part is in a fixed order (daily, weekly, rotation, then
  oldest), the same on every device.
- **UX-PRAYER-11** Pasted titles are capitalised in the preview and on save. `parsePaste` is unchanged because check.js
  expects its raw output, so leads L24, which calls the parser directly, still shows lower case.
- **UX-PRAYER-12** "Choose a backup file" (hidden `#f-importFile`) fills the text box; the person still taps Import.
- **UX-PRAYER-13** One feed line per Pray now run: "Prayed through N (family) requests", or the usual single line when
  only one was prayed. It never names a private title and is sent on `hub.onLeave` if the app closes mid-run.
- **UX-PRAYER-14** A finished Today leads with "All prayed ✓" and hides Pray now (the kitchen keeps it). One cheer, and no
  toast repeats it.
- **GAP-PRAYER-2** Record → Answered has a search box (from 2 answered) and year headings.
- **IMP-PRAYER-I1** "Around the table".
  - The family Pray now shows the asker's face at 88 px.
  - On the Kitchen device, after "Who is praying?", a household face row sits under the card: adults and kids, never
    guests, the kitchen or the TV; targets 60 px and up. Each person taps once to join, and every Prayed credits the whole
    table through `setPrayed(p, true, id)`, so a kid gets their star.
  - On a personal device there is no face row, only "Prayed marks you". No server rule changed.
  - `SCRATCH/b3a/table-check.mjs` 18/0.
- **Files and regions.**
  - `apps/prayer.html`, markup additions: `#f-ansSearch`, `.addto`, `#addListSwitch`, `#addListNote`, `id="moreTitle"`
    on the Settings h1, `#moreListNote`, `#f-importFile`, `#prayAsker`, `#prayTable`, and the `#moreBtn` label.
  - Many script functions.
  - B's regions touched: one line in `calendarHTML`, `renderTable(p)` in `renderPray`, `prayedNow()` in the
    prayNext/ArrowRight/Space handlers, `table`/`praySession` in `startPrayMode`/`closePray`, and one marked token CSS
    block at the end of the style.
- **Suites** (fresh D1): test-kitchen 55/0, test-prayer 36/0, test-prayer-faces 42/0, test-rewards 73/0.
  - A shared-D1 first run had failures caused by rows A itself had left behind; these pass on a fresh D1.
  - No test changed.
- **Gates:** parse-check 29/0; check.js 47/2; check-ids 49/49; no hex; bump-sw --check OK.
- **Needs a device:**
  - the iPad Files picker;
  - Around the table on the real kitchen iPad;
  - a hardware keyboard on the iPad;
  - the pinned Add with the iOS keyboard up;
  - the pagehide feed line.

## Worker B — Prayer look (all done)
- UX-PRAYER-2 kid cards:
  - Before: "Pray" 🙏 on the kid's solid colour.
  - After: a pale mint pill with a 3 px mint ring, the kid's face, a big ✓ in a solid circle and "Prayed"; the card is ringed too.
  - The title and a speaker button read the request aloud (speechSynthesis, rate 0.85; a second tap stops it; the speaker shows
    only where speech exists).
  - 64 px targets. State fills 1.00–1.10:1 → 4.69–5.60:1.
- UX-PRAYER-3 Kitchen view:
  - Calm dark: `--tv-panel` layered twice, `--tv-text` inks.
  - iPad: requests 44 px, list name 64 px; two columns on landscape; a 60 px Close.
  - Calls hub.immersive.
- UX-PRAYER-7: a CSS chevron on category groups.
- UX-PRAYER-9: Pray now calls hub.immersive (frameOffsetTop 48 → 0); Close a 44 px pill; Escape.
- VIS-PRAYER-2: body bottom padding 158 px (clears nav + FAB). Note: `contrast.mjs` still flags the "shared" pill 1.57–1.63:1 at the
  resting scroll, because the fixed + covers it there (colours fine; nothing covered at the list end).
- VIS-PRAYER-3: Rename/Remove 55×31 → 71×44; Pray Close 45×33 → 69×44.
- VIS-PRAYER-5 calendar:
  - month name; weekday letters above the grid;
  - empty days outlined in `--muted-decor`, 3.23–5.05:1 in all six themes;
  - future days fainter.
- VIS-PRAYER-6: page and nav on `--col-narrow`, centred; the + at the column edge from 760 px.
- VIS-PRAYER-8: the strip is 2×2 on a phone and one row from 700 px; no zeros when nothing is scheduled; "1 days" fixed.
- VIS-PRAYER-9: #sheet `--col-narrow`, centred on the iPad.
- VIS-PRAYER-11: Pray mode chrome in the centred column.
- P4-SHAPE-02 / VIS-SHAPE-4 / CONS-MOTION-3 toast:
  - `toast(msg, actionLabel, fn)` → hub.toast (6 s with an action, 3.5 s otherwise; #toast kept hidden as a fallback).
  - `#hub-toast` sits above the nav and the +.
  - Undo 63.6×44, a one-line toast. Drag/exit not done (no owner).
- CONS-SHAPE-5 / CONS-MOTION-3 sheet: `--r-sheet` 32 px, `--elev-overlay`, `--dur-gentle` / `--spring-gentle`.
- CONS-TYPE-7: 63 calc sizes + 2 inline → roles (code-scan 63 calc / 5 tokens → 0 calc / 88 tokens); kid roles for kids.
- CONS-MOTION-2: 35 literal durations → tokens (literals: fontSize 65 / duration 35 / easing 11 → 0 / 0 / 0); a
  `[data-motion="reduce"]` kill added.
- Files: prayer.html style (whole type/motion pass) plus script parts: `toast()`, `calendarHTML`, `kidCardHTML` + speech block,
  `immersive()`, `openKitchen`. In A's region: the strip lines in `renderToday`, two inline font sizes, the `kitchenShut` listener.
  No ids removed.
- Tests changed on purpose:
  - test-prayer-faces: kid button Pray / Prayed + ✓ + face;
  - test-prayer and test-kitchen: the toast is read from #hub-toast.
- New scripts: `audits/tools/phase6/3/verify-prayer-undo-target-3.mjs` (passes in WebKit iPhone and iPad, and Chromium) and
  `prayer-look-3.mjs` (61/0).
- Suites (fresh D1): test-prayer 36/0, test-prayer-faces 42/0, test-kitchen 55/0, test-rewards 73/0.
- Gates: parse 29/0, check.js 47/2, check-ids 49/49, no hex.
- Capture: 809/809, looked at in light and dark at 430, 820, 1180 and 1440.
- Needs a device:
  - speech on iOS;
  - real blur legibility of the dark sheet;
  - the Kitchen view from across the room;
  - hub.immersive in the installed app;
  - 🙏 rendering.
  - The Pray Close outline was changed after the capture, so it is checked by script only.

## Worker C — the shell half (all done)
- UX-PRAYER-9 (shell): `hub.immersive(on)` / `hub.isImmersive()` in hub.js.
  - In the viewer it hides the bar; standalone it is a no-op returning false.
  - The bar comes back on: immersive(false); an Escape the app does not preventDefault (the SDK passes it to the shell); a
    shell Escape (the first press restores the bar); closing the viewer; a frame reload or navigation; opening another app.
  - Only the viewer's frame is obeyed. The app gets `hub:immersive` {on:false} when the shell restores the bar.
  - layout.mjs: frameOffsetTop 48 → 0 on all 4 devices.
- IMP-PRAYER-I2 (TV): "A year ago today · Answered: <title>", family rows only, New York month/day in an earlier year, the latest
  year first; a 29 February answer shows on the 28th.
  - `placeAnniv()` puts it in the verse pane only if row 1 keeps its height; otherwise first in the feed (dropping the oldest
    lines but never the last one), or it is left out whole.
  - 1920: verse pane; the other sizes: the feed.
  - Trade-off: a wrapping title goes to the feed at 1920 too, so fewer than 5 feed lines that day (2c's "all five feed lines"
    gate does not hold then).
- IMP-PRAYER-I3 (Home): "Ezra and Elizabeth prayed today for Grandma Jo's visit".
  - Family rows where by = me, prayed today by someone else (not own ticks, TV or kitchen); an adult's or guest's own Home.
  - Up to 3 lines with faces, then "And N more…"; patched in place; opens Prayer.
  - `prayedForMe()` declares the family prayer rows on that Home.
- Files: hub.js (the immersive block); index.html (CSS `.tv-anniv*`, `.tv-out`, `#viewer.immersive`, `.prayedfor`; viewer JS; the
  kiosk `anniversary`/`placeAnniv`/fit; the Home slot); CLAUDE.md; sw.js hub-v43; tests test-tv (f), test-home (e), test-hub
  (immersive).
- Numbers (fresh D1): test-hub 37 → 47/0, test-home 57 → 65/0, test-tv 76 → 85/0; parse 29/0; bump-sw OK.
  - test-hub needs a fresh D1 each run (the first run sets Mea's PIN).
- Capture tv: 30/34 identical to 2c, 4 differ by clock-digit noise; the seed has no year-ago answer.
- Capture shell vs base3: 874/979 identical, 81 Home screens changed on purpose (the asker line), 24 noise plus the pairing
  animation.
- Needs a device: the notch strip in immersive; a remote's Escape on a real TV; real TV font metrics (about 4 px to spare in
  the verse pane).
- Flagged for B: closePray() calls immersive(false) even when the Kitchen view is still open underneath (bar returns over the
  Kitchen view). Suggested guard: `if(!el('kitchen').classList.contains('on'))`.

## Review round 1 — core (logic, privacy, data)
No leaks, no high.
1. MEDIUM regression (P3-PRAYER-21): on My list, `unmarkDay` drops today if this device's copy has no `lastPrayedAt === TODAY`, and
   writes the whole prayerDays row (LWW). The same person's other device praying another request moments earlier → today is erased
   for good (probe2: server prayerDays [] while B lastPrayedAt today; strip "0 days in a row"). recordDays() only compensates on
   Family. Home's prayerStreak() reads the same row. Fix: recordDays() (and index.html prayerStreak) also count My-list rows'
   lastPrayedAt; better, load() repairs: My-list row lastPrayedAt === TODAY and no today in prayerDays → markDay.
2. LOW (UX-PRAYER-13 partial): leaving mid-run via Home → onLeave posts and nulls praySession while Pray mode stays open in the kept
   frame; coming back within 60 s, each Prayed posts its own line (probe1: 3 lines). Fix: in onLeave, if pray is still on,
   post then `praySession = new Map()`.
3. nit: index.html prayerToday() lacks P3-PRAYER-08's "weekly with no days → every day" rule (Home's count differs from Today).
4. nit: an inline New/Rename plan panel survives leaving Settings while famSettingsOk resets → its Save is unguarded. Fix: closeAsk() in go() when leaving `more`.
5. nit: Escape in the edit sheet discards typing with no confirm.
6. nit: the frame load listener clears immersive if Pray now is tapped before load (harmless).
7. pre-existing: "One category only" leaves focusCategory '' → Today empty until one is picked; the repair skips ''.
Checked fine: suites 36/42/55/73/65/85/47, gates, 0g rules, share, add switch, Settings confirm, Undo, Enter/Escape, focus repair,
I1, immersive, I2, I3.

## Review round 1 — entries and screens
Every entry does what its fix says, except CONS-MOTION-3, which stays PARTIAL (the sheet and toast still vanish in one frame and cannot be dragged).
- Regression, MEDIUM-LOW: the pinned Add button hides the focused field. Category is covered 54 of 54 px and the How-often chips 45 of 45 px, on iPhone and desktop (before the batch: 0 and 10 px).
- Regression, LOW-MEDIUM: the Kitchen view's two columns (`column-count:2`) orphan the "Work and Job Search" heading. It sits at the foot of column 1 (y 1117) while its requests start column 2 (y 157), and the view reads down then back up.
- LOW: Enter in the Add form's title / for / phone fields saves at once. On an iPhone, the soft keyboard's return saves a half-filled request.
- nit: contrast.mjs's "shared" pill under the + at the resting scroll. Judged acceptable: the colours pass, and nothing is covered at the end of the list.
- nit: a finished Today repeats the streak, as the cheer and in the strip.
- P3-PRAYER-15: `staleOfflineWriteResurrects:true` remains. It is outside this batch and should be filed.
- UX-PRAYER-3: items now read from about 1.19 m (was 0.73). Whether that works across the room needs a device check.
- Checked fine:
  - all 46 scripts and the 10 copies; the logic before/after table;
  - the kid cards: a lightness step of 5 or more, plus a new shape and word; 64 px targets;
  - Pray mode in the hub, the toast (Undo 64×44), the calendar, the strip, the sheet (560 px, centred), wide screens and Settings;
  - the carry-overs: code-scan 0 calc, literals 0/0/0;
  - the Home line, and the TV line, where a private title never appears.
- Not checked: Around the table on the Kitchen device (the reviewer's rig could not open it), the full shell/tv capture, and the suites.

## Round 1 fixes, sent back
- To A: core 1, 2, 3, 4, 5 and 7; visual 3 (Enter moves to the next field on the Add form) and 5 (the cheer).
- To B: visual 1 (scroll-padding), 2 (a kitchen grid of category blocks) and 4 (recapture Pray Close).
- Accepted with no change: core 6 (immersive before load is harmless), the contrast pill, and CONS-MOTION-3 staying PARTIAL.

## Round 1 fixes — Worker A (all 8 done)
1. recordDays() counts My-list lastPrayedAt days; load() repairs a missing today, and so does index.html prayerStreak(). probe2 went from 3/2 (server [] and streak 0) to 5/0 (server today, streak 1). The untick checks still remove today when nothing else is prayed. Side effect: the typical seed's month count is 10 before and after an untick, because a seeded request's last-prayed day now counts.
2. onLeave while Pray mode is still on posts the line and starts a new session. probe1: 3 lines → 2.
3. index.html prayerToday() treats a weekly request with no days as every day.
4. go() closes Settings' inline panel when leaving.
5. Escape in the edit form asks "Discard your changes?" only after a change.
6. "One category only" defaults to Personal (or the first category), and the load repair fixes an empty one.
7. The Add form's Enter: title → for → Detail. Their number or Ctrl+Enter saves. enterkeyhint next/next/done. The three key copies (-3) were updated on purpose. The edit form's Enter still saves.
8. No bare streak cheer.

New check phase6/3/prayer-review1-3.mjs 8/0. Suites: kitchen 55, prayer 36, faces 42, rewards 73, home 65, table 18. parse 29/0, check.js 47/2, check-ids 49/49.

## Round 1 fixes — Worker B (all 4 done)
1. Add form focus:
   - html scroll-padding-bottom is 96 px + safe area, and 172 px + safe area while #s-add is on (`:has`); the #f-save halo 8 → 4 px.
   - iPhone: Category 54/54 → 0/54 px covered, chips 45/45 → 0/46.
   - Desktop: Category 0/54.
   - layout.mjs: hiddenUnderNav false on all 4 devices.
   - Not verified: iOS Safari honouring scroll-padding.
2. Kitchen view:
   - `section.k-group` per category (break-inside:avoid); on a landscape iPad (≥ 1000 px) a two-column grid reading row by row; portrait stays one column.
   - Orphans 1 → 0, and the pairs sit side by side.
   - Open point: in B's probe, an Escape pressed from the top page did not close the Kitchen view (the key probably never reached the frame; untested).
3. The "shared" pill: no change.
4. Pray Close: recaptured and looked at. 71×44 on iPhone, 76×44 on iPad.
- Re-runs: prayer-look-3 61/0, undo-target-3 PASS, layout, vischeck, test-prayer 36, faces 42, kitchen 55, parse 0, check.js 47/2, check-ids 49/49, capture 809/809.

## Review round 2 — core
All 7 round-1 items fixed (probe2 5/0; probe1 3 → 2 lines; Escape/edit-confirm/Add Enter/focus default verified by probe3).
NEW MEDIUM (from the round-1 repair): load()'s My-list day repair runs mid-pull (hub.js applies a pull row by row and Prayer's
onChange → load each time); prayerDays (today removed) lands before the request row still showing lastPrayedAt today, so the
repair re-adds and saves today → P3-PRAYER-21 undone whenever Prayer is open on a second device (probe6, twice). Fix sent to A:
run the repair after the whole pull (setTimeout / onSync) and re-check. Also optional sent to A: a shell Escape (hub:immersive off)
closes the Kitchen view. Escape inside the frame closes the Kitchen view and Pray now fine (probe3 R4). Suites 36/42/55/73/65/85/47.

## Review round 2 — entries and screens: NO NEW FINDINGS
The round-1 items are fixed:
- Add focus: 0 px covered on 4 devices.
- Kitchen grouping: 0 orphans, 2 columns reading row by row on landscape.
- Add form Enter: works as specified.
- Finished Today: no repeated line.
- The edit form's discard confirm works.

cap2 vs round 1: 228/809 changed, all explained:
- streak and month numbers +1, from A's record repair;
- the Add halo;
- scroll-padding resting positions;
- the kitchen grid;
- Pray Close 1–4 px;
- 1–2 px wobble.

All 57 scripts exit 0; prayer-review1-3 8/0, look-3 61/0.

Optional nits:
- the Kitchen view reopens mid-page (sent to A: scrollTop = 0 on open);
- a shell-focus Escape leaves the Kitchen view open (already sent to A).

## Round 2 fixes — Worker A
1. load() no longer writes; it schedules a debounced repairToday() 2 s after the last load(). That re-checks the house's rows (hub.get prayerDays, hub.list prayer:) and writes only if a My-list request has today as its last prayed day, today is missing, and the device agrees. It is skipped for a kid, the kitchen, read-only profiles, before the first pull, and while a repaint is pending. probe6: re-added today → 7/0 in both runs (the house keeps no today; the phone reads 0 days); probe2 still 5/0.
2. A hub:immersive {on:false} listener closes Pray mode (closePray(false)) and then the Kitchen view, never twice.
3. Opening the Kitchen view by hand sets scrollTop = 0; refreshKitchen keeps its place.
- New check phase6/3/prayer-review2-3.mjs 4/0; review1-3 8/0; untick scripts OK; prayer 36, faces 42, kitchen 55, rewards 73; parse 0; check.js 47/2; check-ids 49/49.

## Review round 3 — core: NO NEW FINDINGS
- probe6 7/0 twice; probe2 5/0; probe7: hub:immersive closes Pray mode with exactly one feed line (Home: "Prayed through 2 family requests"; shell Escape: one line); Kitchen view reopens at scrollTop 0.
- repairToday guards reviewed OK: a pull applies a scope's rows in one synchronous loop, so the 2 s debounce is ample; an app closed within 2 s waits for the next open, and recordDays shows the day meanwhile.
- Suites 36/42/55/73/65/85/47, table 18; gates OK.
- Nits, accepted with no change:
  (a) a mid-run feed line sent when another app is opened arrives about 20 s late. hub.js drainActivityFor takes hub.alock for 20 s in the dying frame; the line is never lost and never doubled.
  (b) a theoretical ms window: a second device reading inside one request's write loop could see a half-applied untick. Untriggerable. Reordering save() would not reliably change the wire order, because the queue keeps a key's first position.

## Review round 3 — entries and screens: NO NEW FINDINGS
- The Kitchen view reopens at the top.
- An Escape from the hub bar closes the Kitchen view and Pray mode; the bar comes back and the viewer stays; a second Escape closes the viewer.
- An Escape inside the app still works.
- cap3 vs cap2: 31/809 changed, all noise (1–3 px scroll wobble, one hover).
- All 58 scripts exit 0; review2-3 4/4, review1-3 8/8, look-3 passes.
- Gates OK.
LOOP CLOSED.

## After the first final run (follow-ups)
- **The rescore** (audits/evidence/p6/3/rescore.md) scored the Prayer row 5.4 → 5.5 (Icons 5 → 4 under ICO-2, mixed icon families).
  - B replaced the 🙏 emoji, the text ✓ and the CSS chevron with one drawn SVG family (the `icon()` helper; aria-hidden beside a word).
  - I gave the hands a duotone palm fill and a 2.3 stroke after the round-4 reviewer's pre-reader nit.
- **Status writer's unproven claims.** A wrote `audits/tools/phase6/3/prayer-claims-3.mjs` (6 claims). Claim 5 (VIS-PRAYER-6) FAILED: 1 request above the nav at 1180×772 with the overflow seed.
  - B fixed it: at ≥ 700 px, a one-line date/plan with an ellipsis (title attribute), a one-line headline, a nowrap stats row, and tighter header, meter and prompt card.
  - Result: 3 above the nav on iPad landscape (iPad portrait 6, desktop 4, iPhone 3). At text size xxl it is still 0–1.
- **Review round 4** (screens): no new findings.
  - Nits: the hands' clarity (fixed as above); a truncated plan name can't be read by tap on a touchscreen (it shows in Settings; accepted).
- **Full final re-run** (final-3b) on the final code: all green.
  - 59 lanes, including the claims check 6/6; checks as before; 23 suites; api 322; chat 64.
  - Measure: themes, devices and states all re-measured.
  - Prayer recapture 809/809.
