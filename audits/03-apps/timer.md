# Kitchen timer (`timer`) — Phase 3 deep dive

| | |
|---|---|
| **App code audited** | `fe6041d`, unchanged since the Phase 0 baseline. This phase changed no app code. |
| **File(s)** | `apps/timer.html` (141 lines). The shell half of the timer lives in `index.html` (1,716 lines): timer code `index.html:773-828`, pill CSS `index.html:343-361`. Shared code: `apps/hub.js` (500), `apps/design.css` (617). Registry entry: `apps.json:8`. |
| **Date** | 2026-09-24 |
| **Inputs** | `audits/00-inventory.md` §9b "timer — Kitchen timer" (lines 3870-3956) and the shell's timer rows (lines 1153-1162); 150 Phase 1 captures under `audits/screens/timer/`, the 9 sheets `audits/screens/_sheets/timer--*.jpg` and `audits/screens/_sheets/shell--home-timer.jpg`; `audits/01-leads.md` "Tally counter and Kitchen timer" (lines 210-255); Phase 2 IDs P2-PROF-08, P2-STAB-13, P2-STAB-08, P2-STAB-09, P2-SYNC-09, P2-SYNC-15, P2-SYNC-17, P2-STAB-01, and the investigator-only GAP-HOME-1, VIS-HOME-2 and PWA-GAP-1. |
| **Runtime** | Local instance with the demo household (typical seed; overflow seed for long timers and the chat pill), Playwright WebKit. Chromium wherever Web Audio or notifications had to run, because the rig's WebKit has no `AudioContext` and no `Notification`; the real clock where stated. No production data or endpoint was touched. |
| **Reproduce** | Scripts in `audits/tools/phase3/timer/`, evidence in `audits/evidence/p3/timer/`. Run each with `node "audits/tools/phase3/timer/<name>.mjs"`. |

**How to read this.** Every bug, security or perf finding went to two independent skeptics, who re-read the code and re-ran it with their own scripts; a third skeptic broke ties. A defect is **CONFIRMED** only when at least two skeptics reproduced it and more confirmed it than refuted it. Refuted findings go under "Checked and not a bug", and undecided ones under "Unresolved". UX, VIS, GAP and OK items describe the design, not malfunctions, so they were not adversarially verified. A separate agent re-checked every rubric score against the screenshots, and a judge settled the one gap of 2 points (Dark mode). A completeness critic then re-read the report and ran its own sweep (`audits/tools/phase3/timer/critic-*.mjs`). Its four new candidates went to two skeptics each, with a third where they split: two were confirmed as new defects and are marked "from the critic" (P3-TIMER-04, P3-TIMER-05); one was confirmed as a wider trigger of P3-TIMER-01 and added to that ID; one was refuted (see "Checked and not a bug"). Severity follows the rule at the top of `audits/02-shell.md` (lines 25-37).

**Severity splits.** One tie rule settles a 1-1 severity split: the severity rule's own text is applied to the skeptics' corrected claim, and the finding says which clause decided it. One finding split: P3-TIMER-04 (medium / low → low: the low clause's "edge case" fits, because it needs a hidden page with running JS and a granted permission, and the app's own beep still sounds).

## Summary

- **What it is.** A one-at-a-time preset countdown (1, 3, 5, 10, 15 or 30 min; `apps/timer.html:61-66`) stored as one person-scope record, `timer.active = {endAt, total, startedAt}` (`apps/timer.html:77-80`). The shell follows it with a pill on every tab and a chip over other apps, and beeps at 0 (`index.html:773-828`). Everyone but the kiosk sees it (`apps.json:8` has no `visibleTo`).
- **Confirmed defects: 5** (0 critical, 0 high, 1 medium, 4 low). **1 refuted**, **1 unresolved**.
  - The worst confirmed one is **P3-TIMER-01** (medium): while the page's first timer pull is slow or fails, the app shows an idle timer, and one Start tap replaces the person's running timer on every device (900 s → 300 s, and 900 s → 600 s with a warm cache, where Start is live at about 0.1 s).
  - The others: the dial turns into a tall pill at 0:00 (P3-TIMER-02); every finish leaves an `AudioContext` running (P3-TIMER-03); from the critic, the "Timer done" notification is suppressed whenever the Timer app is open, even in a hidden page (P3-TIMER-04), and every countdown reaches 0:00 and beeps 0.2-0.5 s early because it rounds (P3-TIMER-05).
  - **Refuted as a bug:** the critic's "nothing can ring on a locked iPhone" (high). The code facts hold (the Worker has no timer code), but local-only alerting is the documented design and Phase 2 already filed it as the gap PWA-GAP-1; it is now a note on that pointer.
  - **Unresolved and most important:** the finish beep is very likely silent on iPhone and iPad. Both beeps create a new `AudioContext` at 0, long after the Start tap (60 s later in the 1-minute test runs), outside any gesture, and never resume it. All three skeptics confirmed those code facts at runtime; one confirmed the silence from WebKit's source, two could not prove it without a device. All three rated it **high** if confirmed.
- **Rubric: final average 4.9 / 10** (investigator 5.3, checker 4.8). Typography, Layout and Dark mode score best at 6; Color, Iconography, Motion and Delight are weakest at 4.
- **Biggest usability gaps.**
  - One tap on any preset chip cancels a running timer on every device, with no undo (UX-TIMER-1).
  - Pause is not stored: the pill vanishes, a reopen shows the preset, and the person's other device resets to the full time (UX-TIMER-2).
  - The alert is one three-pip beep: no repeat, no notification while the Timer app is open, and nothing at all if the only device slept through the end. No server push exists for timers, so a locked phone has no path to ring (P3-TIMER-04, GAP-TIMER-2, UX-TIMER-3, the PWA-GAP-1 pointer).
  - "Time's up" is shown by colour and blinking only, and the digits read only to about 2.5 m on the Kitchen iPad (UX-TIMER-4, UX-TIMER-5).
- **Biggest visual gaps.** The dial deforms at 0 (P3-TIMER-02); the selected preset chip is the dimmest chip (VIS-TIMER-3); a running timer has no primary action (VIS-TIMER-1); in dark mode the adult accents go muddy and the ring track all but disappears at 1.2:1 (VIS-TIMER-7, from the visual check).
- **What works.** The countdown is computed from timestamps and stays exact (to within P3-TIMER-05's rounding) after backgrounding, after a truly frozen page, across midnight, across the DST change and in another time zone (OK-TIMER-1). Targets are large and in the thumb zone (OK-TIMER-2). The platform use is clean: no hub.js bypass and no hardcoded colour (OK-TIMER-3). The kiosk is safe (OK-TIMER-4).
- **Best-value improvement.** Unlock one `AudioContext` inside the Start tap and ring until Stop is tapped (delight 5, effort S). It removes the likely iOS silence whatever the device test shows, and closes GAP-TIMER-2.

## 1. Purpose and top jobs

The Kitchen timer is a single screen (`apps/timer.html:52-71`): a glass dial with a progress ring and the time, six preset chips, and Start/Pause plus Reset. The running countdown is a person-scope record, so it follows its owner across the hub and to their other devices within a pull (`apps/timer.html:77-79`). The last preset is remembered per person (`apps/timer.html:81, 124`).

There is no usage data, so the jobs are inferred from the app and the household:

| # | Job | Who | How often |
|---|---|---|---|
| 1 | Start a cooking countdown, usually with the last-used preset | Adults (Elizabeth, Mae, Eli), on the Kitchen iPad or a phone | Several times a day around meals |
| 2 | Glance at the time left while doing something else, through the Home pill or the dial on the Kitchen iPad from across the room | The owner | Many times per timer |
| 3 | Notice that time is up and clear the done state (the beep plays once, so there is nothing to silence) | The owner | Once per timer |

Secondary: pause, reset. Kids (Ezra, Kiara) and guests use it occasionally. The kiosk cannot reach it (OK-TIMER-4).

## 2. Features and gaps

**References.**
- **Apple first-party:** Clock → Timers, read from https://support.apple.com/guide/iphone/set-timers-iph8241d6b2a/ios on 2026-09-24 with curl (WebFetch could not read the page body). It offers Siri ("Set the timer for 3 minutes"), a custom duration, a Label, a When Timer Ends sound (and Stop Playing), a timer that keeps running while the iPhone sleeps, Recents, several timers at once, presets, a notification at the top of the screen in any app, Repeat or Stop from the Lock Screen, pause and resume, and remove.
- **Best in class:** generic product knowledge, not a named reference. No specific kitchen-timer app was consulted; the rows marked "kitchen-timer apps" (several named timers side by side, +1 min, an alarm that repeats until acknowledged) rest on that general knowledge only. Apple's own page backs several timers at once.
- **Platform:** MDN's Autoplay guide (https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) says Web Audio `start()` outside a user input event "is subject to autoplay rules".

| Capability | This app | Reference | Gap |
|---|---|---|---|
| Presets | Six fixed chips (`apps/timer.html:61-66`) | Apple presets (1, 5, 10 min) | None |
| Custom duration | NOT FOUND IN CODE | Apple duration wheel | Yes (GAP-TIMER-3) |
| +1 min while running | NOT FOUND IN CODE | Kitchen-timer apps (generic product knowledge, not a named reference) | Yes (GAP-TIMER-3) |
| Label ("Pasta") | NOT FOUND IN CODE | Apple Label | Yes (GAP-TIMER-3) |
| Several timers at once | No: one `timer.active` per person (`apps/timer.html:80`) | Apple (support page above) | Yes (GAP-TIMER-3) |
| Recents | NOT FOUND IN CODE | Apple Recents | Yes |
| Sound at the end | One fixed three-pip 880 Hz beep, once (`apps/timer.html:96-99`) | Apple: chosen sound that plays until Stop | Yes (GAP-TIMER-2); likely silent on iOS (Unresolved U-1) |
| Keeps running while the device sleeps | The countdown is exact on return (OK-TIMER-1), but nothing alerts after the fact (UX-TIMER-3) | Apple rings on the Lock Screen | Partly |
| Notification in any app | Local notification from the shell only when the Timer app is closed, permission is already granted and the end was under 60 s ago (`index.html:797-810`; P3-TIMER-04). No server push exists for timers: `grep -n -i timer worker/src/*.js` returns 0 lines, and the only reminder jobs are morning, evening, behind, prayer and park (`worker/src/reminders.js:240`). The local notification needs the page's JS running at 0, so a locked iPhone gets nothing; whether iOS suspends a locked Home Screen app's JS through 0 needs a device | Apple banner in any app, and on the Lock Screen | Partly (P3-TIMER-04, GAP-TIMER-1, PWA-GAP-1) |
| Repeat or Stop from the Lock Screen | None | Apple | Yes |
| Pause and resume | In one page's memory only (`apps/timer.html:114`) | Apple Pause/Resume | Partly (UX-TIMER-2) |
| Cancel | Reset, and any preset tap, with no undo (`apps/timer.html:120-125`) | Apple Cancel | Undo missing (UX-TIMER-1) |
| Countdown visible elsewhere | Pill on every tab and a chip over other apps (`index.html:813-823`) | Apple notification / Lock Screen | None for the owner; other people never see it (GAP-HOME-1) |
| Same timer on the person's other devices | Yes, within a 30 s pull (start seen after 26.4 s; `audits/evidence/p3/timer/sync2.json`) | Not offered by Apple | Better than the reference |
| Voice | None: `worker/src/chat.js` has no timer tool | Siri | Yes |
| Kid mode | Bigger targets and type through tokens, text-only controls | Not applicable | Partly (UX-TIMER-6) |

## 3. Ease of use

Taps measured with real clicks in `audits/tools/phase3/timer/basics.mjs` and `audits/tools/phase3/timer/audience.mjs`:

| Job | Profile | Path | Taps | Target ≤ 2 for the most frequent | Met? |
|---|---|---|---|---|---|
| Start the last-used preset (the most frequent job) | Eli, iPhone 430×932 | Home → Apps tab → Kitchen timer tile → Start | 3 | ≤ 2 | **No** |
| Start a different preset | Ezra (kid), iPhone and iPad portrait | Home → Apps → Kitchen timer → 1 min → Start | 4 | n/a | n/a |
| Start the default as a guest | Grandma Jo (guest), iPad portrait | Home → Apps → Kitchen timer → Start | 3 | n/a | n/a |
| See the time left | Eli, iPhone | Home, with the pill showing ("5:55") | 0 | n/a | Yes |

By code, not measured (no script tapped these paths):
- **Pause from Home:** Home → pill → Pause, 2 taps (`index.html:824` opens the app; `apps/timer.html:114` pauses).
- **Clear the done state (the beep has already stopped):** the beep is one-shot, 0.85 s (`apps/timer.html:96-99`), so nothing needs silencing; Reset or Start clears the blinking done state in 1 tap (`apps/timer.html:120`; Start through `run()`, `apps/timer.html:105, 115`).

Home has no timer card or widget (`basics.json` `homeTimerControls: 0`; tile `small`, `apps.json:8`). Once the app is open, the remembered last preset makes Start a single tap (visual checker's correction).

- **Discoverability.** Fine for adults inside the app: everything is on one screen and the pill opens the app (`index.html:824`). From Home, the timer is reachable only through the Apps grid (UX-TIMER-7).
- **Undo.** None. Reset and every preset chip clear the running record at once (`apps/timer.html:120-125`), on every device of the person (UX-TIMER-1). There is no `confirm()` either (`audits/evidence/p3/_compliance/timer.json`).
- **Error prevention.**
  - The six chips stay live while a timer runs; one tap cancels it (UX-TIMER-1).
  - While loading, the page shows an idle 5:00 with a live-looking Start; after `hub.ready` gives up, that Start overwrites a running timer (UX-TIMER-9, P3-TIMER-01). With a warm cache there is no wait at all: the app shows the last preset with a live Start at about 0.1 s, before its first timer pull has landed (P3-TIMER-01, warm-cache trigger).
  - Pause looks like "never started" and says Start (UX-TIMER-2).
- **One-handed phone use.** On a 430×932 iPhone, Start/Pause spans page y 734-794 at 193×60 px and the presets are 125×44 px in two rows just above, all in the bottom-middle thumb zone (`audits/evidence/p3/timer/basics.json` `B_measure`, frame top 48). The chips' second row ends 16 px above Pause, which is how a stray tap cancels a timer.
- **iPad glanceability at 2-3 m.** With the heuristic "character height ≥ distance / 200" and 1 CSS px ≈ 0.192 mm on an 11-inch iPad, the 64 px digits (12.3 mm) read to about 2.46 m, short of 3 m (UX-TIMER-5). "Done" differs from "running" by colour only (UX-TIMER-4). The Home pill is 16 px and shows only to the owner (GAP-HOME-1).
- **Pre-reader use (Ezra, Kiara).** Partly completable. The kid tokens make the chips 64 px and Start/Reset 84 px tall, but every control is a word. A 4-5-year-old can start the shown default by tapping the big filled button and can see the blinking red done state, but cannot choose a length or tell Pause from Reset (UX-TIMER-6).

## 4. Issues and bugs

### Register

| ID | Severity | Defect |
|---|---|---|
| P3-TIMER-01 | medium | While the page's first timer pull is slow or fails, the app shows an idle timer, and one Start tap replaces the person's running timer on every device |
| P3-TIMER-02 | low | At 0:00 the round dial stretches into a tall pill and the controls below jump 24 px |
| P3-TIMER-03 | low | Every finish leaves a new `AudioContext` running; in the shell they pile up for the life of the page |
| P3-TIMER-04 | low | From the critic: the "Timer done" notification is suppressed whenever the Timer app is open, even while the page is hidden, and the app has no notification of its own |
| P3-TIMER-05 | low | From the critic: every countdown reaches 0:00 and beeps 0.2-0.5 s early, and each digit changes about 0.5 s early, because `step()` rounds |

### Phase 2 defects that show up here

- **P2-SYNC-17** (critical). The same 6 s `hub.ready` race (`apps/hub.js:334-337`), proven for F260 in Phase 2. The Timer trigger is a new facet, filed as P3-TIMER-01. P3-TIMER-01 also has a warm-cache trigger that does not involve the race: there `hub.ready` does not wait by design, and the Timer reads its unconfirmed cache as "no timer running".
- **P2-PROF-08** (medium). `timer.active` is person scope (`apps/timer.html:80, 90`), so after Me → Switch on the Kitchen iPad the next person's shell does not tick or ring the previous person's timer.
- **P2-STAB-13** (medium). The Timer app's own `finish()` on wake is a trigger too (Phase 2 listed it as "by code, not run", `audits/02-shell.md:3547`). The completeness critic ran it on a truly frozen page (Chromium, the V8 debugger paused through CDP; the standalone Timer, so only the app acts): Eli's 1-minute timer ended while the page was frozen, and a 10-minute timer was written from another device. On thaw `finish()` (`apps/timer.html:102` → `:91`) posted a tombstone stamped 1790272669867, after the new timer's 1790272668809, so the server row became `timer.active: null` and the newer timer was deleted on every device. The waking phone showed the old timer's done state and beeped once, and 30 s later still showed nothing of the new timer. Run `node "audits/tools/phase3/timer/critic-frozen-wake.mjs"`; evidence `audits/evidence/p3/timer/critic-frozen-wake.json` (F2).
- **P2-SYNC-09** (critical). In Phase 2's run, a pull in flight during Switch put Eli's `timer.active` into Ezra's cache, and Ezra's Home showed Eli's timer pill (`audits/02-shell.md:2606`). Not re-run here.
- **P2-STAB-08** (low). The 1.2 s grace at `apps/timer.html:135` means a clear from a fast-clocked device makes the open Timer app reset to the full preset without a beep.
- **P2-STAB-09** (low). `apps/timer.html` has no wake-lock code (NOT FOUND IN CODE). A page whose life starts in `#timer` (a reload, or the notification click) holds no lock while the countdown runs.
- **P2-SYNC-15** (low). `hub.sync.state` is the only offline signal, and the Timer shows none (UX-TIMER-8).
- **P2-STAB-01** (critical). With Reduce Motion on, the whole hub is a blank page, so the Timer cannot be reached from Home either. Not re-run here.
- **GAP-HOME-1** (medium, Phase 2 investigator-only). Only the owner sees a running timer; the TV has no timer pane, and the pill is 16 px.
- **VIS-HOME-2** (low, Phase 2 investigator-only). The timer pill sits over the last band of Home content. This covers the Home-pill lead (`audits/01-leads.md:228`), which was not re-run here.
- **PWA-GAP-1** (medium gap, Phase 2 investigator-only). "Timer done" is a local notification only. Two facets from this app:
  - It never fires while the Timer app is open, even in a hidden page: now the confirmed defect P3-TIMER-04.
  - No alert can reach a locked iPhone. The critic filed this as a high bug; it was refuted as a new finding (1 confirmed, 2 refuted; see "Checked and not a bug") because it is the documented design and exactly this gap. What the three skeptics added: `worker/src/*.js` has 0 timer references and `POST /api/admin/cron/run {job:'timer'}` answers 400 `bad_job` (the jobs are morning, evening, behind, prayer and park, `worker/src/reminders.js:240`). In a modelled suspension (page hidden, clock moved 120 s with no timers fired), with the app closed the shell cleared the record silently on unlock (no beep, toast, notification or pill; `index.html:806-809`). With the Timer app open, it played its one beep about 2 min late on unlock, with no notification (`apps/timer.html:102`). Evidence: `audits/evidence/p3/timer/verify-critic-locked-phone-no-alert-2-1.json` (S1, S2), `audits/evidence/p3/timer/verify-critic-locked-phone-no-alert-2-3.json` (LOCK, LOCKO). Whether iOS runs any JS for a locked Home Screen app is Phase 2's device check #7 (`audits/02-shell.md:5276`).

### Confirmed defects

#### P3-TIMER-01 — While the page's first timer pull is slow or fails, the app shows an idle timer, and one Start tap replaces the person's running timer on every device

- **Severity: medium** (skeptics: medium / medium; unchanged from the investigator's rating; the warm-cache trigger's two skeptics also rated it medium / medium).
  - Not critical under (a): `timer.active` is a transient countdown record, not stored household history, and the harm is an alarm at the wrong time. Phase 2 rated the same record the same way (P2-STAB-13, P2-PROF-08, both medium).
  - Not high: starting a timer works in every normal open.
  - Medium: a secondary flow (opening the Timer while its first pull is slow) is broken and misleading, and the trigger is an ordinary one.
- **Exposure.** Any open of the Timer while that page's first timer pull is slow or fails. It is worst on a device with no cache (a 6 s wait, or at once on a 503). With a warm cache it hits any timer started on another device since the last pull, and Start is live at about 0.1 s (`audits/evidence/p3/timer/critic-warm-stale-start.json`). In practice the phone was locked or in the background when the other device started the timer (the shell pulls on becoming visible and every 30 s), and the first pull after opening is slower than the Start tap: a 3 s delay was enough. The replacement needs a Start tap on what looks like an idle timer; what makes it a defect is that the app shows "idle" for an unconfirmed state.
- **Related.** P2-SYNC-17 has the same root cause for the no-cache trigger (one `hub.ready` fix covers both). The warm-cache trigger is not that race: `hub.ready` returns at once by design so apps render from cache (`apps/hub.js:334-337`), and the defect is that the Timer reads an unconfirmed cache as "no timer running". P2-STAB-13 concerns the same record; UX-TIMER-9 is the placeholder that invites the tap.

**What happens now.** The markup ships "5:00" with a primary Start (`apps/timer.html:57, 63, 69`), and the handlers attach only after `hub.ready` (`apps/timer.html:76, 113`). On a device with no cache, `hub.ready` races the first pull against 6 s and resolves at once if the pull fails (`apps/hub.js:334-337`). The app then finds no `timer.active`, keeps the idle 5:00 (`apps/timer.html:81, 128-129`), and a Start tap writes a fresh record (`apps/timer.html:113-118`) stamped "now" (`apps/hub.js:236`). That stamp beats the server row, and when the held pull lands the local copy wins (`apps/hub.js:295-296`), so the real timer never comes back.

In the investigator's run, Elizabeth's new phone opened the Timer while `/api/data/timer` was held 9 s:
- at 1.5 s: 5:00 with a primary Start while her 15-minute timer was running; a tap then did nothing;
- after the 6 s race: one Start tap wrote a 5-minute timer;
- server before `{endAt:1790268020000, total:900}`, after `{endAt:1790267962986, total:300}`.

**Warm-cache trigger (from the completeness critic).** Eli's phone had pulled before (timer cache `since` > 0, keys `[lastPreset]`, no `timer.active`), so `hub.ready` did not wait at all (`apps/hub.js:334-337`). Eli then started a 15-minute timer on another device, and the phone opened the Kitchen timer while its timer pulls were held 9 s. The app showed his last preset, 10:00, with a primary Start, and the handler was live at 87 ms. One Start at 798 ms wrote a new record stamped now (`apps/timer.html:113-118`; `apps/hub.js:236`), and when the held pull landed the local copy won. Server `{endAt:1790273192005, total:900}` → `{endAt:1790272892811, total:600}`. The control run without a hold resumed 15:00 / Pause at 93 ms, and the server was unchanged (`audits/evidence/p3/timer/critic-warm-stale-start.json`).

**Expected.** Until this page's first timer pull has landed, the app shows a loading state and keeps Start disabled, whether or not the device has a cache. If it must start blind, it does not overwrite a newer running record.

**Why it matters to the household.** The person's real countdown (the oven) is silently replaced and now ends at the wrong time on all their devices, including the Kitchen iPad's pill and the Kitchen iPad's open Timer, where it was started.

**Evidence.**
- Code: `apps/timer.html:57, 63, 69, 76, 81, 113-118, 128-129`; `apps/hub.js:236, 285-301, 334-337`; `index.html:458, 820`.
- Runs: `audits/evidence/p3/timer/slowload.json`, `audits/evidence/p3/timer/verify-slowload-start-replaces-running-timer-1.json`, `audits/evidence/p3/timer/verify-slowload-start-replaces-running-timer-2.json`.
- Warm-cache runs: `audits/evidence/p3/timer/critic-warm-stale-start.json`, `audits/evidence/p3/timer/verify-critic-warm-cache-stale-start-replaces-timer-1-1.json`, `audits/evidence/p3/timer/verify-critic-warm-cache-stale-start-replaces-timer-1-2.json`; screenshots `audits/evidence/p3/timer/critic-warm-stale-hold-before-tap.png` (10:00 / Start while the 15-minute timer runs), `audits/evidence/p3/timer/critic-warm-stale-ctrl-before-tap.png` (control: 15:00 / Pause), `audits/evidence/p3/timer/verify-critic-warm-cache-stale-start-replaces-timer-1-2-lat3-phone-before-tap.png`, `audits/evidence/p3/timer/verify-critic-warm-cache-stale-start-replaces-timer-1-2-lat3-ipad-after.png` (the Kitchen iPad now shows the replacement).
- Screenshots:
  - `audits/evidence/p3/timer/slowload-at-2s-iphone.png` and `audits/evidence/p3/timer/verify-slowload-start-replaces-running-timer-2-B-early-iphone.png`: idle 5:00 / Start while her timer runs.
  - `audits/evidence/p3/timer/verify-slowload-start-replaces-running-timer-1-hold9-before-tap.png`.
  - `audits/evidence/p3/timer/verify-slowload-start-replaces-running-timer-2-B-kitchen-ipad-after.png`: the Kitchen iPad pill now shows the new 5-minute timer.
  - `audits/evidence/p3/timer/slowload-after-iphone.png`.
  - Phase 1: `audits/screens/timer/running-loading-iphone-pwa-light.png` (idle 5:00 / Start while a timer runs).

**Reproduction.**
- No cache: `node "audits/tools/phase3/timer/slowload.mjs"` (WebKit, typical seed, real clock). Compare `serverBefore['timer.active']` (total 900) with `serverAfter['timer.active']` (total 300).
- Warm cache: `node "audits/tools/phase3/timer/critic-warm-stale-start.mjs"` (WebKit, typical seed, real clock; a new paired phone for Eli warms its cache on `#home` for 4 s; an API write as Eli of `timer.active {endAt: now+900000, total: 900}`; the phone's `/api/data/timer` GETs held 9 s; `location.hash='#timer'`; one Start tap). Compare `hold.serverBefore['timer.active'].total` (900) with `hold.serverAfter` (600), and with `ctrl`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/timer/verify-slowload-start-replaces-running-timer-1.mjs"` (fresh instance, typical seed reset per scenario, WebKit, real clock, iPhone PWA, a newly paired device for Mom). It polls until `go.onclick` is attached, taps Start once, then reads the server:
  - hold9 (timer GET held 9 s): at 182 ms 5:00 with a primary Start and no handler; handler live at 6331 ms, still 5:00 / Start with an empty cache; one tap → 4:59 / Pause; server `{total:900, endAt:1790269460000}` → `{total:300, endAt:1790269444818}`.
  - lat8 (every `/api/*` request delayed 8 s): ready at 6280 ms on 5:00; one tap replaced 900 with 300. So it is not an artefact of holding only the GET.
  - fail (first two timer GETs answer 503): handler live at 183 ms on 5:00; one tap replaced 900 with 300.
  - ctrl: at 173 ms the app resumed the real timer (5:52, Pause, total 900); server unchanged.
- **Skeptic 2** ran `node "audits/tools/phase3/timer/verify-slowload-start-replaces-running-timer-2.mjs"` (WebKit, typical seed, real clock), with Elizabeth's Kitchen iPad open:
  - A (control): the new phone showed 5:41 / Pause with the 15 min preset lit, matching the server.
  - B (every data GET on the new phone held 9 s; 15 GETs held): at 1669 ms 5:00 / Start with no handler, and a tap changed nothing; handler at 6115 ms; a Start at 7895 ms → 4:59 / Pause; server `{endAt:1790269520000,total:900}` → `{endAt:1790269490548,total:300}`. The Kitchen iPad pill read 5:38 before and 3:26 (the new timer) after one pull.
  - C (first two timer GETs 503): handler at 169 ms on 5:00; one tap replaced 900 with 300.

**Warm-cache trigger verified: 2/2 skeptics confirmed** (medium / medium). Both ruled it the same defect as this ID, not a second one: the same code path (`apps/timer.html:113-118, 128-129` act on state the first pull has not confirmed) and the same fix. So it was added here instead of taking a new number.
- **Skeptic 1** ran `node "audits/tools/phase3/timer/verify-critic-warm-cache-stale-start-replaces-timer-1-1.mjs"` (WebKit, typical seed, real clock). The 15-minute timer was started through the UI on the rig's Kitchen iPad (15 min, then Start), not by an API write; Eli's newly paired phone warmed its cache on `#home` for 3 s.
  - hold (the phone's timer GETs delayed 9 s): cache `{since:1790273209278, keys:['lastPreset']}`; handler live at 70 ms on `{t:'10:00', go:'Start', primary:true}`; tap at 1006 ms → 9:59 / Pause. Only the page-open `GET /api/data/timer?scope=person&since=1790273209278` (31 ms) was held; the flush `POST /api/data/timer/batch` went out at 1259 ms. Server `{endAt:1790274114159, total:900}` → `{endAt:1790273815704, total:600}`. The Kitchen iPad's own open Timer went from 15:00 to 9:46 after its next pull.
  - ctrl (no delay): before the tap the phone already showed 15:00 / Pause at 71 ms; server unchanged; the iPad showed 14:56.
- **Skeptic 2** ran `node "audits/tools/phase3/timer/verify-critic-warm-cache-stale-start-replaces-timer-1-2.mjs"` (WebKit, typical seed, real clock; the Kitchen iPad starts the timer through the UI; the phone's timer GETs delayed 3 s instead of 9; a tap at human pace).
  - lat3: cache `{since:1790273214698, keys:['lastPreset']}`; handler live at 89 ms; at 1205 ms 10:00 with a primary Start and "10 min" selected (the stale last preset; the iPad had set 15 min); tap at 2222 ms → 9:59 / Pause. Server `{endAt:1790274120704, total:900}` → `{endAt:1790273825439, total:600}`. After its own pull the iPad showed 9:52 / Pause. `delayedRequests 1`, `replaced true`.
  - ctrl: handler live at 112 ms; before the tap 14:56 / Pause; server unchanged (total 900); the iPad 14:48.
  - Two details make the stale screen look normal: the phone shows its own last preset, not the iPad's 15 min, and the shell's pill and chip are hidden on `#timer` (both null before the tap), so nothing hints that a timer is running.

**Corrected claim.**
- **Wider trigger.** A failed first timer pull (one 503 or network error) shows the idle 5:00 with a live Start at about 0.2 s, with no 6 s wait. A uniformly slow network reproduces it too.
- **Not evidence.** "The shell showed no pill" is by design: the shell hides the pill and chip while the Timer app is open (`index.html:820`), and the control run shows none either.
- **Exposure** (the first two skeptics' reading) was: first open of the Timer on a device with no timer cache, while that first pull takes more than 6 s or fails. The completeness critic and the warm-cache skeptics widened it to the Exposure above. It needs no failure: a 3 s pull delay and a tap at about 2 s replaced a 15-minute timer started through the iPad UI. What matters is whether this page's first pull since the other device's Start has landed, not whether the device has a cache. On a fast network the window lasts only about 70 ms (the control runs).

#### P3-TIMER-02 — At 0:00 the round dial stretches into a tall pill and the controls below jump 24 px

- **Severity: low** (skeptics: low / low; unchanged). Cosmetic: the time still reads 0:00, and every control works.

**What happens now.** At 0, `show()` toggles the class `empty` on `#dial` (`apps/timer.html:87`), which the app means only to hide the ring's round-cap dot (`apps/timer.html:30`). The body is `class="ds"` (`apps/timer.html:51`), so design.css's empty-state rule `.ds .empty { padding: var(--sp-10) var(--sp-4) }` (`apps/design.css:545`) also applies. Its specificity (0,2,0) beats `.dial` (0,1,0), so the padding goes from 16 px to 40 px 16 px. The glass disc grows 48 px taller around a ring that stays round, and the presets and Start/Reset drop 24 px at the moment time is up.

| Device | Running | Done (0:00) | Buttons moved |
|---|---|---|---|
| iPhone PWA | 352.6×352.6 | 352.6×400.6 (ratio 1.136) | 24 px |
| iPad portrait | 400×400 | 400×448 (ratio 1.12) | 24 px |
| Desktop | 400×400 | 400×448 | 24 px |

**Expected.** The dial stays round at 0 and nothing below it moves.

**Why it matters to the household.** The one moment the timer has to look finished and calm, it deforms and the buttons jump under the finger.

**Evidence.**
- Code: `apps/timer.html:22-24, 30, 51, 87`; `apps/design.css:545`.
- Runs: `audits/evidence/p3/timer/basics.json` (`E_runningDial` 353×353 against `E_done.dial` 353×401, padding "40px 16px", classes "dial glass empty"), `audits/evidence/p3/timer/verify-done-dial-oval-1.json`, `audits/evidence/p3/timer/verify-done-dial-oval-2.json`.
- Screenshots: `audits/evidence/p3/timer/basics-done-iphone-light.png`, `audits/evidence/p3/timer/verify-done-dial-oval-1-iphone-done.png` (and `-iphone-reset.png`, round again), `audits/evidence/p3/timer/verify-done-dial-oval-2-done-ipad-portrait-dark.png`, `audits/screens/timer/done-typical-ipad-portrait-dark.png`.

**Reproduction.** `node "audits/tools/phase3/timer/basics.mjs"`; compare `E_runningDial.dial` with `E_done.dial`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/timer/verify-done-dial-oval-1.mjs"` (typical seed, real clock, WebKit; iPhone PWA as Eli and iPad portrait as Mom; real UI only: 1 min, Start, wait 62 s, Reset). iPhone: idle and running 352.6×352.6, padding 16px; done 352.6×400.6, padding "40px 16px", with both `.ds .empty` and `.dial` matching; Start's top moved 686 → 710; round again after Reset. iPad: 400×400 → 400×448, Start 806 → 830. The ring SVG stayed round (318.6 and 366 px).
- **Skeptic 2** ran `node "audits/tools/phase3/timer/verify-done-dial-oval-2.mjs"` (typical seed, real clock, WebKit, browser clock stepped 1 s at a time for 62 s) on iPhone PWA light, iPad portrait dark and desktop light. Done: 352.6×400.6, 400×448 and 400×448, padding "40px 16px", buttons moved 24 px on all three. Control (only the `empty` class removed): round, 16 px.

**Corrected claim.** None needed; the skeptics widened it: the shape change also happens on iPad and desktop, and everything below the dial jumps 24 px.

#### P3-TIMER-03 — Every finish leaves a new `AudioContext` running; in the shell they pile up for the life of the page

- **Severity: low** (skeptics: low / low; unchanged). A slow resource leak with no observed user-visible effect.

**What happens now.** `beep()` in the app (`apps/timer.html:95`) and `timerBeep()` in the shell (`index.html:790`) each construct a new `AudioContext` per finish and never call `close()`. Each stays in the `running` state after the 0.85 s chime.
- **In the app** the contexts last only while the Timer's viewer stays open: `closeViewer` sets the frame to `about:blank` (`index.html:732`), which releases them.
- **In the shell** they pile up, one per finish while the Timer app is closed, for as long as the shell page lives. On the always-open Kitchen iPad that is until a reload.

**Expected.** One shared context, unlocked at Start and reused, or `close()` after the chime.

**Why it matters to the household.** Only on the 24/7 iPad, as a slow accumulation. Whether iPadOS caps concurrent contexts, or whether live contexts cost battery, is not shown; if a cap exists, later beeps would fail silently inside the `try/catch` (`apps/timer.html:94, 100`; `index.html:789, 795`).

**Evidence.**
- Code: `apps/timer.html:93-102`; `index.html:788-796, 804-812, 729-735`.
- Runs: `audits/evidence/p3/timer/verify-audiocontext-never-closed-2.json` (shell: made 5, `close()` 0, all `running`), `audits/evidence/p3/timer/verify-audiocontext-never-closed-1.json`, `audits/evidence/p3/timer/background.json` (B3: closed 0). Supporting only: `audits/evidence/p3/timer/clocktz.json` (`A1_audio`: made 2, closed 0, 2 live), whose count of 2 is the quirk of that rig run described in the corrected claim.

**Reproduction.** `node "audits/tools/phase3/timer/verify-audiocontext-never-closed-2.mjs"` (Chromium, Kitchen iPad as Eli; 5 finishes on Home with the app closed, then 3 with the app open). Read the shell counts: made 5, `close()` 0, all `running`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/timer/verify-audiocontext-never-closed-1.mjs"` (Chromium, iPad portrait, Eli; an init script counts constructions and `close()` calls).
  - A, the Timer app standalone with a browser clock, three UI-driven 1-minute runs: made 1, 2, 3; `close()` 0; all three still `running` two minutes after the last finish.
  - B, the shell on Home with the app closed, three API-written timers: run 1 produced no beep (made 0), runs 2 and 3 each made one ("Timer done — 1:00 is up."), `close()` 0, all `running`. The missed first beep did not reproduce when the critic reran it (U-2, under "Checked and not a bug").
- **Skeptic 2** ran `node "audits/tools/phase3/timer/verify-audiocontext-never-closed-2.mjs"` (Chromium, Kitchen iPad as Eli): 5 finishes on Home with the app closed, then 3 with the app open, then `#home`.
  - Shell: made 5, `close()` 0, all 5 `running` with `currentTime` still advancing (38.62 … 26.19 s at the end).
  - App: made 3, `close()` 0, all `running`; after `#home` the Timer frame was `about:blank`, so its contexts were released.

**Corrected claim.** Each finish constructs a context that is never closed and stays `running`, but the ones that accumulate are the shell's (one per finish with the Timer app closed); the app's are freed when the viewer closes. The "engines cap contexts" consequence is not demonstrated. The investigator's `clocktz.json` A1 counted 2 contexts over its scripted finishes, a quirk of that rig run; the UI-driven runs give one per finish. On iOS a context made outside a gesture may start suspended (Unresolved U-1), so the cost there may be smaller.

#### P3-TIMER-04 — The "Timer done" notification is suppressed whenever the Timer app is open, even while the page is hidden, and the app has no notification of its own

From the critic, which reclassified the notification half of GAP-TIMER-1 as a bug.

- **Severity: low** (skeptics: medium / low; the critic filed medium). The split was settled by the tie rule ("How to read this"): the rule's low clause, "an edge case", fits the corrected claim.
  - In practice it needs a page that is hidden but still running JS at 0: a desktop browser tab. A hidden iPhone or iPad Home Screen app has its JS suspended, so there the shell cannot notify in either state (the PWA-GAP-1 pointer).
  - Notification permission must already be granted, and only the Me push switch asks for it (`index.html:1561`).
  - The app's own beep still plays in the hidden tab, so only the visual banner is lost.
  - Not medium: the core alert (the beep and the done state) works; skeptic 1 rated it medium as a secondary path of the "tell me when it's done" flow.
- **Exposure.** Notification permission already granted, the Timer app open, and the page hidden at 0 on a device where JS still runs (a desktop tab; an iPad or iPhone only before iOS suspends it).
- **Related.** PWA-GAP-1 (Phase 2 investigator-only gap, not a P2-* ID) mentions "not while the Timer app is open" in passing; GAP-TIMER-1 keeps the permission half.

**What happens now.** `finishTimer` computes `appOpen = !!current && current.id === 'timer'` (`index.html:807`). With the app open it skips the shell beep (`:808`) and both the toast and `timerNotify` (`:810`), and it never checks `document.hidden` or `visibilityState`. The design comment (`index.html:776-778`) limits the shell alert to "with the app closed" and gives one reason: no toast over the app's buttons. That reason does not cover a hidden page. `apps/timer.html` has no `Notification` or `showNotification` code (NOT FOUND IN CODE); its `finish()` (`apps/timer.html:102`) only stops, shows the done state, beeps and clears the record. So in the state right after Start, with the app still open, someone who switches to another tab gets no banner at 0. CLAUDE.md's Timer bullet says the shell "beeps and shows a local notification at 0", with no such condition.

**Expected.** At 0 a local notification is shown whenever the page is hidden, whichever app is open. Only the toast is skipped over the open Timer app.

**Why it matters to the household.** On Eli's desktop, the Timer left open after Start is the most common state, and that is exactly when the banner is lost; if the tab is muted or the speakers are off, nothing shows that time is up.

**Evidence.**
- Code: `index.html:776-778, 797-803, 807-810`; `apps/timer.html:93-111`; CLAUDE.md (Timer bullet).
- Runs: `audits/evidence/p3/timer/verify-critic-notify-suppressed-while-app-open-3-2.json` (A against C, the like-for-like pair), `audits/evidence/p3/timer/verify-critic-notify-suppressed-while-app-open-3-1.json`. The investigator's `audits/evidence/p3/timer/background.json` (B2 against B4) does not isolate the cause: B2 fast-forwarded 3 min while hidden, so the end was already more than 60 s old, and B4 was a visible page.

**Reproduction.** `node "audits/tools/phase3/timer/verify-critic-notify-suppressed-while-app-open-3-2.mjs"` (Chromium, desktop 1440×900, Eli, notifications stubbed as granted, the page emulated hidden, the clock stepped 1 s at a time). Compare `A_appOpen_hidden.notifications` (0) with `C_appClosed_hidden.notifications` (1).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/timer/verify-critic-notify-suppressed-while-app-open-3-1.mjs"` (Chromium, iPhone PWA as Eli, installClock, its own notification stub and toast spy; the 1-minute preset started through the real UI; hidden forced in every frame; `clock.runFor` in 2 s steps).
  - A, app open and hidden: `shellNotifications []`, `shellToasts []`; the app went "0:02 osc:0 | 0:00 done osc:3", so its own beep played; server `timer.active` null afterwards.
  - B, app closed on Home and hidden: `shellNotifications [{"t":"Timer done","body":"1:00 is up."}]`, toast "Timer done — 1:00 is up.".
  - C, app open and visible: no notification and no toast. In this run the app reset to "1:00" without a beep, most likely the rig's shell and frame clocks drifting apart under `runFor` (the "cleared elsewhere" branch, `apps/timer.html:135`); it does not affect the result, because the `appOpen` check does not depend on timing.
- **Skeptic 2** ran `node "audits/tools/phase3/timer/verify-critic-notify-suppressed-while-app-open-3-2.mjs"` (above). A, app open and hidden: notifications 0, beeps shell 0 / app 1, app `{t:'0:00', done:true}`. C, app closed and hidden: notifications 1 ("Timer done / 1:00 is up."), shell beep 1. V, app open and visible: notifications 0, app beep 1. A first attempt with one `runFor(62000)` left the app at "1:00", a rig artefact; `verify-critic-notify-suppressed-while-app-open-3-2-trace.mjs` shows a normal finish when the clock is stepped.

**Corrected claim.** The line references are `index.html:807` (`appOpen`), `:808` (the beep gate) and `:810` (the toast and notification gate). The suppression is deliberate as written, but its only stated reason does not cover a hidden page, and nothing replaces the lost banner. The app's own beep still plays in a hidden desktop tab, so the banner is the only alert lost, not "the one alert". The iPhone and iPad "checked in another app" case is not shown, because iOS suspends the page's JS in either state (PWA-GAP-1; needs a device).

#### P3-TIMER-05 — Every countdown reaches 0:00 and beeps 0.2-0.5 s early, and each digit changes about 0.5 s early, because `step()` rounds

From the critic's bug sweep.

- **Severity: low** (skeptics: low / low; the critic filed low). The timer is off by under a second; nothing is lost and no flow breaks.
- **Exposure.** Every timer, in the app. The error is under half a second, so it is barely noticeable.
- **Related.** Not P2-STAB-08 (a fast-clocked device's clear within the 1.2 s grace); the app's own early finish comes before any shell clear.

**What happens now.** `step()` computes `left = Math.max(0, Math.round((endAt - Date.now()) / 1000))` (`apps/timer.html:108`) and calls `finish()` when `left === 0` (`:109`); `finish()` sets the done state, beeps and clears `timer.active` in the same call (`:102`). So 0:00, the done state and the beep arrive once less than 0.5 s remains, and with the 250 ms interval (`:111`) they land 0.25-0.5 s before `endAt`. Every digit also changes about half a second early, so "1:00" shows for only about 0.5 s after Start. The shell pill rounds the same way (`index.html:816`, finish at `:821`) but ticks once a second, so its finish lands anywhere from about 0.5 s early to 0.5 s late depending on the tick's phase.

**Expected.** The display uses `Math.ceil`, as clocks do, and the finish fires at `endAt` (`endAt - Date.now() <= 0`), in both the app and the shell.

**Why it matters to the household.** Small, but a kitchen timer should not ring before its time, and "1:00" should not turn into "0:59" half a second after Start.

**Evidence.**
- Code: `apps/timer.html:102, 108-111`; `index.html:816, 821`.
- Runs: `audits/evidence/p3/timer/critic-early-finish.json` (clock stepped 50 ms: `done.msBeforeEndAt` 215, `first59.msAfterStart` 764; `lastRows` show 0:01 at 266 ms left, then 0:00 done at 215 ms), `audits/evidence/p3/timer/verify-critic-early-finish-rounding-4-1.json`, `audits/evidence/p3/timer/verify-critic-early-finish-rounding-4-2.json`.

**Reproduction.** `node "audits/tools/phase3/timer/verify-critic-early-finish-rounding-4-2.mjs"` (real browser clock, WebKit and Chromium, standalone Timer as Eli, 1 min, Start; MutationObservers stamp each change). Read `A[].done_msBeforeEnd` and `A[].first59_msAfterStart`. The critic's run is `node "audits/tools/phase3/timer/critic-early-finish.mjs"` (WebKit, installClock, the clock stepped 50 ms at a time).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/timer/verify-critic-early-finish-rounding-4-1.mjs"` (WebKit, iPhone PWA as Eli, installClock, standalone Timer, the clock stepped 10 ms at a time around the boundaries). 1 min: 1:00 → 0:59 at +755 ms; near the end 0:03 at 2989 ms before `endAt`, 0:02 at 2241, 0:01 at 1247, 0:00 done at 246, and `timer.active` already cleared. 3 min: 3:00 → 2:59 at +760 ms; 0:00 done at 236 ms before `endAt`. The beep could not be counted in WebKit (no `AudioContext`), but `beep()` runs inside `finish()` right after the done class is set, so the beep time is the done time.
- **Skeptic 2** ran `node "audits/tools/phase3/timer/verify-critic-early-finish-rounding-4-2.mjs"` on the real clock. WebKit: first 0:59 at 514 ms after Start, 0:00 and done 299 ms before `endAt`. Chromium: 0:59 at 516 ms, 0:00 and done 451 ms early, 3 oscillators at done. The shell pill (WebKit, a 6 s timer on `#home`): 0:01 at 948 ms before `endAt`, then 0:00, hidden and `hub.remove` 58 ms after `endAt`.

**Corrected claim.** In the app, 0:00, the done state and the beep land 0.25-0.5 s before `endAt` (299 ms in WebKit and 451 ms in Chromium on the real clock). Each digit changes about 0.5 s early; the critic's 764 ms for the first "0:59" came from stepping the clock 50 ms at a time. "The shell does the same" is only partly right: it rounds too, but its 1 s tick puts its finish anywhere from 0.5 s early to 0.5 s late (58 ms late in this run).

### Usability, visual and gap findings

These were not adversarially verified. Items marked "from the visual check" were added or corrected by the independent visual checker.

**UX**

- **UX-TIMER-1 — One tap on any preset chip cancels a running timer on every device, with no confirm and no undo** (medium).
  - The preset handler runs `stop(); write(null)` and loads the new preset (`apps/timer.html:121-125`). In `basics.mjs` the timer read 9:57 with Pause; one tap on "3 min" gave 3:00 with Start, and the server row became `timer.active: null`, so the pill vanished on every device of the person.
  - The chips stay live while running, for kids too, and their second row ends 16 px above Pause (`basics.json` `B_measure`).
  - Reset does the same (`apps/timer.html:120`).
  - Evidence: `audits/evidence/p3/timer/basics.json` (`C_presetWhileRunning`); `audits/evidence/p3/timer/audience-kid-running-iphone-pwa.png`. Run `node "audits/tools/phase3/timer/basics.mjs"`.
  - Expected: while a timer runs, a preset tap offers "Timer cancelled — Undo" (Apple favours undo over confirm), or adds a second timer.
- **UX-TIMER-2 — Pause exists only in one page's memory, and a paused timer looks exactly like an idle one** (medium).
  - Pause clears `timer.active` (`apps/timer.html:114`). Pausing at 2:55 left the server row and the Home pill null, and reopening showed 3:00 (`basics.json` `D_*`).
  - In `sync2.mjs` S2 the phone paused at 9:28, and 24 s later Eli's iPad Timer showed 10:00 / Start: it treats the clear as "cleared elsewhere" and resets (`apps/timer.html:135`).
  - From the visual check: after Pause the app shows the remaining time with a primary "Start", a full-colour ring and no "Paused" label, dimming or blink, styled exactly like an idle timer of that length; `stop()` resets the label to "Start" (`apps/timer.html:92`).
  - Evidence: `audits/evidence/p3/timer/basics.json`, `audits/evidence/p3/timer/sync2.json`, `audits/evidence/p3/timer/sync2-phone-paused.png`, `audits/evidence/p3/timer/sync2-ipad-after-phone-pause.png`, `audits/evidence/p3/timer/basics-paused-iphone-light.png`, `audits/screens/timer/paused-typical-ipad-portrait-light.png`, `audits/screens/timer/paused-typical-iphone-safari-dark.png`. Runs: `basics.mjs` (D) and `sync2.mjs` (S2, about 2.5 min).
  - Expected: store the pause (for example `{pausedLeft, total}`), show "Paused 9:28" in the app, the pill and other devices, and label the button "Resume".
- **UX-TIMER-3 — A timer that ends while the only device is asleep or closed leaves no trace** (medium).
  - B5: app closed, page hidden through the end, back 2 min later: no beep, toast or notification, and no pill. B6: the whole page closed with the Timer open, reopened on `#timer` 2 min after 0: "1:00 Start", not the done state.
  - The shell clears ended records silently after 60 s (`index.html:806, 809`), and the app ignores an ended record on open (`apps/timer.html:129`).
  - Tapping the "Timer done" notification opens the Timer on an idle preset, not the done state: the notification opens `#timer` (`index.html:801`; `sw.js:62-64`), but by then the shell has already removed the record (`index.html:809`), and the app shows the idle preset when there is no running record (`apps/timer.html:128-129`). By code, not run.
  - If the Timer app was open when a suspended page resumes, it plays its one beep late, on unlock, with no notification (about 2 min late in the critic's skeptics' modelled lock; `audits/evidence/p3/timer/verify-critic-locked-phone-no-alert-2-1.json` S2).
  - Phase 2 ruled the multi-device version by design and harmless when another device was awake (`audits/02-shell.md:3518`). This is the one-device case, which is the common one for a phone; filed as UX, not as a defect.
  - Evidence: `audits/evidence/p3/timer/background.json` (B5, B6). Run `node "audits/tools/phase3/timer/background.mjs"` (Chromium; hidden emulated by forcing `document.hidden`, then `clock.fastForward`).
  - Expected: on return, "Timer ended 2 min ago" in the app and a toast in the shell, like a missed-alarm notice.
- **UX-TIMER-4 — "Time's up" is shown only by colour and blinking: no words and no icon** (medium; corrected by the visual check).
  - At 0 the page text is only "Kitchen timer 0:00 1 min … Start Reset" (`basics.json` `E_done.dial.text`).
  - For Elizabeth, the done ring and digits (`--danger`) have a luminance ratio of 1.1 against her running ring (`--accent`) in Hearth, Parchment and Frost, and 1.9 in Midnight and Forest (`visual.json` V4).
  - Correction from the visual check: the done state also washes the whole page pink (`apps/timer.html:12`) and adds a 6 px danger halo (`apps/timer.html:36`), so it is not the ring alone. It is still colour-only: a colour-blind or across-the-room viewer has no non-colour cue during the blink's dim phase. If the beep is silent (U-1), this is the only signal.
  - Evidence: `audits/evidence/p3/timer/visual.json` (V4), `audits/evidence/p3/timer/visual-done-hearth-ipad.png`, `audits/screens/timer/running-typical-ipad-portrait-light.png`, `audits/screens/timer/done-typical-iphone-pwa-light.png`. Run `node "audits/tools/phase3/timer/visual.mjs"`.
- **UX-TIMER-5 — The digits read only to about 2.5 m on the Kitchen iPad, because the dial is capped at 400 px** (medium).
  - The digits render 64 px high (an 88 px font; canvas `actualBoundingBox`), 12.3 mm on an 11-inch iPad: readable to 2.46 m by h ≥ d/200. Reading at 3 m needs 15 mm.
  - `.dial` is `width: min(82vw, 52vh, 400px)` (`apps/timer.html:22`), so both iPad orientations get a 400 px dial.
  - Correction from the visual check: in iPad landscape the width beside the dial is unused but the height is well filled; in portrait the lowest ~290 px are empty. "Half empty" overstated it.
  - Evidence: `audits/evidence/p3/timer/visual.json` (V2, V3), `audits/screens/timer/idle-typical-ipad-landscape-light.png`, `audits/evidence/p3/timer/visual-idle-hearth-ipad.png`.
- **UX-TIMER-6 — Kid mode enlarges the controls, but every one is a word** (medium).
  - For Ezra the kid tokens make the chips 64 px and Start/Reset 84 px tall (`apps/design.css:280-284`), but no control has an icon (`hasIcon: false`). Labels are "1 min" … "30 min", Start, Pause and Reset (`apps/timer.html:60-71`).
  - A pre-reader can start the default and see the done state, but cannot choose a length; while running, Pause loses its fill (`apps/timer.html:106`) and looks like Reset.
  - Evidence: `audits/evidence/p3/timer/audience.json` (`K_iphone-pwa`, `K_ipad-portrait`), `audits/evidence/p3/timer/audience-kid-idle-iphone-pwa.png`, `audits/evidence/p3/timer/audience-kid-running-ipad-portrait.png`. Run `node "audits/tools/phase3/timer/audience.mjs"`.
- **UX-TIMER-7 — Starting a timer takes 3 taps from Home (4 for another length); Home has no timer card** (low).
  - Apps → tile → Start (`basics.json` `A_tapsToRunningLastPreset: 3`); Ezra's 1 min took 4 (`audience.json`). The tile is `small` with no widget (`apps.json:8`).
  - Correction from the visual check: from the open app it is 1 tap, because the last preset is remembered (`apps/timer.html:81`).
- **UX-TIMER-8 — Offline, the timer starts normally with no sign that the person's other devices will not see it** (low; related P2-SYNC-15).
  - With Eli's phone offline, Start showed 2:58 / Pause with `hub.sync.state` "offline"; neither the app nor the viewer bar ("Hub Kitchen timer") showed it. The server held no row, and his iPad showed no pill until the phone was back online (then 2:51).
  - Evidence: `audits/evidence/p3/timer/pillchat-offline.json` (O), `audits/evidence/p3/timer/offline-running-iphone.png`. Run `node "audits/tools/phase3/timer/pillchat-offline.mjs"`.
- **UX-TIMER-9 — Before data loads the app shows a fake idle 5:00 with a live-looking Start that ignores taps** (low; the entry point of P3-TIMER-01).
  - The markup ships 5:00 with a primary Start (`apps/timer.html:57, 63, 69`); handlers attach after `hub.ready` (`apps/timer.html:76, 113`). In `slowload.mjs` a tap at 1.5 s changed nothing while the real state (a running 15-minute timer) was unknown.
  - Evidence: `audits/evidence/p3/timer/slowload.json` (`at1_5s`, `tapBeforeReady`), `audits/evidence/p3/timer/slowload-at-2s-iphone.png`, `audits/screens/timer/running-loading-ipad-portrait-light.png`.
- **UX-TIMER-10 — VoiceOver hears neither the countdown nor the selected preset** (low).
  - No `aria-live` region and no `aria-pressed`; the selection is only the class `.on` (`apps/timer.html:57, 88`). Evidence: `basics.json` `B_measure` (`ariaLive: 0`, `ariaPressed: 0`).

**Visual**

- **VIS-TIMER-1 — While running, the screen has no primary control** (low; the visual check found it independently). `run()` removes `btn-primary` (`apps/timer.html:106`), so Pause becomes a plain secondary button next to a ghost Reset, and the emphasis drops away abruptly at Start. Apple's Clock keeps a coloured Pause. Evidence: `basics.json` `A_running.primary: false`; `audits/screens/timer/running-typical-iphone-pwa-light.png`, `audits/screens/timer/running-typical-desktop-dark.png`, `audits/evidence/p3/timer/audience-kid-running-iphone-pwa.png`.
- **VIS-TIMER-2 — "Kitchen timer" shows twice inside the hub, the second time in a serif** (low). The in-app header (`apps/timer.html:53`) sits under the viewer bar's 14 px title and hides only below 640 px viewport height (`apps/timer.html:19`); it showed on all four measured devices. The h1 is ui-serif 18 px 600 (`apps/timer.html:18`). Evidence: `visual.json` V2; `audits/screens/timer/running-typical-iphone-pwa-light.png`.
- **VIS-TIMER-3 — The selected preset chip is drawn at half its neighbours' contrast, so it reads as disabled** (low). `.on` is `--accent-deep` on `--accent-soft` (`apps/timer.html:44`): 5.76-7.79:1 against 14.16-14.68:1 for the unselected chips in all five palettes. It passes AA, but in dark mode it reads as a grey pill. Evidence: `audits/evidence/p3/timer/visual.json` (V1), `audits/evidence/p3/timer/visual-idle-midnight-ipad.png`, `audits/screens/timer/idle-typical-ipad-landscape-light.png`, `audits/screens/timer/idle-empty-iphone-pwa-dark.png`.
- **VIS-TIMER-4 — Times over an hour read as minutes ("104:05"), but the Timer UI cannot create one** (low; the visual checker rates it info). `fmt` (`apps/timer.html:83`) and `fmtLeft` (`index.html:783`) have no hours. The longest preset is 1800 s (`apps/timer.html:66`); only seeded rows, the raw API or chat `set_data` (`worker/src/chat.js:173-180`, unproven model behaviour) produce one. It still fits the ring at 430 and 1440. Evidence: `audits/screens/timer/running-overflow-iphone-pwa-light.png`, `audits/screens/timer/chip-overflow-iphone-pwa-light.png`.
- **VIS-TIMER-5 — On the Chat tab the pill overlaps the newest bubble by 9-21 px** (low). With the overflow chat scrolled to the bottom, overlap was 9 px on iPhone, 0 on iPad portrait and 21 px on desktop; the text stays readable. The pill lifts above the composer (`index.html:357-358`), but the log keeps no room for it. Evidence: `audits/evidence/p3/timer/pillchat-offline.json` (P), `audits/evidence/p3/timer/pillchat-iphone-pwa.png`, `audits/evidence/p3/timer/pillchat-desktop.png`.
- **VIS-TIMER-6 — The dial is a Liquid Glass pane, although it is content** (low). `#dial` carries `glass` (`apps/timer.html:54`), computed `backdrop-filter: blur(18px) saturate(1.4) brightness(1.02)`; the house style keeps glass for navigation and controls. The rig paints no blur, but the top sheen is visible (`audits/screens/timer/running-typical-desktop-dark.png`). Evidence: `visual.json` V2.
- **VIS-TIMER-7 — The ring track is nearly invisible: 1.4:1 in light and 1.2:1 in dark against the dial** (low; from the visual check). The unfilled part of the ring is `color-mix(accent 16%, surface-2)` (`apps/timer.html:28`); measured at 1.39:1 in Hearth and 1.2:1 in the dark palette, under the 3:1 minimum for graphics. In dark the ring reads as a floating arc, so the proportion left is hard to judge at a glance. Evidence: `audits/tools/phase3/timer/vischeck-track.mjs` → `audits/evidence/p3/timer/vischeck-track.json`; `audits/screens/timer/running-typical-desktop-dark.png`, `audits/screens/timer/running-offline-ipad-landscape-dark.png`.

**Gaps**

- **GAP-TIMER-1 — The Timer never offers the "Timer done" notification: the only permission prompt is the Me push switch** (low, narrowed from medium; related PWA-GAP-1).
  - **Reclassified by the critic.** The suppression half of this item (the shell skips its notification while the Timer app is open, even in a hidden page, and the app has no notification code) works against CLAUDE.md's stated intent, went to two skeptics and is now the confirmed defect **P3-TIMER-04**. What stays here is the gap.
  - The only `Notification.requestPermission` is the push switch in Me (`index.html:1561`); starting a timer never asks. A person who has not turned on push reminders never gets a "Timer done" banner, whichever app is open. With permission stubbed as granted, app closed on Home (B4) → 1 notification, "Timer done / 1:00 is up."
  - Evidence: `audits/evidence/p3/timer/background.json` (B4).
- **GAP-TIMER-2 — The alert is one 0.85 s three-pip beep that never repeats and needs no acknowledgement** (medium).
  - Three 250 ms notes at 880 Hz at 0, 0.3 and 0.6 s, once (`apps/timer.html:96-99`). A minute later the probe still counted 1 context and 3 oscillators (B3); the shell's toast lasts 4 s (`index.html:810`; B4 `oneMinuteLater.toast: null`). Only the blinking digits remain, and only in the app.
  - Evidence: `audits/evidence/p3/timer/background.json` (B3, B4).
  - Expected: as in Apple Clock, the sound repeats until a big Stop (or +1 min) is tapped.
- **GAP-TIMER-3 — Only six fixed presets: no custom time, +1 min, label, second timer or recents** (medium). Six chips (`apps/timer.html:61-66`) and one record per person (`apps/timer.html:80`); custom entry, +1 min, labels, multiple timers, recents and sound choice are NOT FOUND IN CODE. A 12-minute pizza plus an oven timer cannot be set.

**What works**

- **OK-TIMER-1 — The countdown is exact after backgrounding, across midnight, across DST and in another time zone** (info). The remaining time is computed from `endAt` on every tick (`apps/timer.html:107-111`; `index.html:816`).
  - B1: the app read 9:58, then 5:57 after 4 min hidden; the Home pill 5:55, then 2:53 after 3 min; the chip over Tally 2:52. B1 forced `document.hidden` while JS kept running.
  - Frozen page (from the critic: JS and timers suspended 20 s through CDP, standalone Timer): 0:59 → 0:38 on thaw, expected 38 (`audits/evidence/p3/timer/critic-frozen-wake.json` F1). The shell pill was not run frozen.
  - "Exact" means to within the rounding of P3-TIMER-05 (under half a second).
  - Midnight (23:58 → 00:03): 4:59 → 2:59 → 0:00 done, 1 beep. DST fall-back (01:55 EDT → 01:05 EST): 9:59 → 2:59 → 0:00 done. A Tokyo-zone device showed 14:56, the same as New York.
  - Evidence: `audits/evidence/p3/timer/background.json` (B1), `audits/evidence/p3/timer/clocktz.json` (Z1-Z3), `audits/evidence/p3/timer/background-chip-over-tally-iphone.png`.
- **OK-TIMER-2 — Controls sit in the thumb zone and meet 44/60 px (64/84 px for kids)** (info). Start/Pause 193×60 at page y 734-794 on a 430×932 iPhone; presets 125×44 just above; press scale .96 (`apps/design.css:359`). Evidence: `basics.json` `B_measure`, `audience.json` `K_iphone-pwa.measure`.
- **OK-TIMER-3 — Clean platform use** (info). 0 hub.js bypasses, 0 hardcoded colours, 0 hardcoded radii; the person's accent reaches the ring and digits (Eli #4F5D8C, Elizabeth #8A6A4B, Ezra #137F77); `write()` is guarded by `hub.canWrite` (`apps/timer.html:91`). Evidence: `audits/evidence/p3/_compliance/timer.json`, `basics.json` `F_accent`.
- **OK-TIMER-4 — The TV neither lists nor opens the timer; opened standalone it runs a local, write-free countdown** (info). 0 tiles, and `#timer` does not open the viewer. Standalone with `canWrite` false, a 3:00 countdown ran with an empty queue and no server rows, as the comment at `apps/timer.html:79` intends. Evidence: `audits/evidence/p3/timer/audience.json` (`T_kiosk`), `audits/evidence/p3/timer/audience-kiosk-standalone-tv.png`.

### Checked and not a bug

One bug was refuted, and one side observation did not reproduce:
- **"No server push exists for a kitchen timer, so nothing can ring or notify on a locked iPhone at 0" (from the critic, filed high): refuted, 1 confirmed / 2 refuted.**
  - All three skeptics reproduced the facts. `worker/src/*.js` has no timer code, `POST /api/admin/cron/run {job:'timer'}` answers 400 `bad_job`, and in a modelled lock the shell cleared the record silently on return.
  - Skeptic 1 (confirmed, high) ran `node "audits/tools/phase3/timer/verify-critic-locked-phone-no-alert-2-1.mjs"` (Chromium, iPhone PWA, the clock moved 120 s with no timers fired while hidden). It asked for the kind to be gap, not bug, with `p2Ref` PWA-GAP-1.
  - Skeptic 2 (refuted, medium) ran `node "audits/tools/phase3/timer/verify-critic-locked-phone-no-alert-2-2.mjs"`. R1, back 2 min after the end: nothing, the record cleared. R2, back within 60 s: a late toast, beep and notification. R3, visible: beep and notification (`audits/evidence/p3/timer/verify-critic-locked-phone-no-alert-2-2.json`, `audits/evidence/p3/timer/verify-critic-locked-phone-no-alert-2-2-R1-back-iphone.png`).
  - Skeptic 3 (tie-break, refuted, medium) ran `node "audits/tools/phase3/timer/verify-critic-locked-phone-no-alert-2-3.mjs"` (WebKit; CTRL, LOCK, LOCKO) with the same result.
  - Why refuted: local-only alerting is the documented design (CLAUDE.md's Timer bullet; the comments at `index.html:776` and `:797`), and Phase 2 already filed exactly this gap as PWA-GAP-1 (`audits/02-shell.md:4818-4823`), with the locked phone left to device check #7 (`audits/02-shell.md:5276`). A Web Push scheduled for `endAt` is a new feature, not a fix.
  - The new facets (the code fact, the late beep on unlock with the app open) are a note on the PWA-GAP-1 pointer. The feature is in §7 (Missing features, "Ring on a locked phone").
- **U-2 (the first API-written timer after the shell loaded produced no beep): not reproduced.** P3-TIMER-03's skeptic 1 saw it in passing (its run B1: made 0, while runs 2 and 3 beeped). The critic reran it twice with `node "audits/tools/phase3/timer/critic-u2-first-pull.mjs"`: the timer written 1.5 s after `hub.profile` (A, the skeptic's timing) and again after the first pull (B). The shell beeped and notified every time: beeps 1, notify 1, cached `timer.active` null (`audits/evidence/p3/timer/critic-u2-first-pull.json`). Most likely rig timing in skeptic 1's run B1. The ID U-2 is kept here so references stay stable.

Two rig artefacts were caught and set aside:
- **"No beep at midnight / DST" in an early in-hub, fake-clock run.** With `clock.runFor` the rig advanced the shell and the app iframe one after the other, so near 0 the shell's clear reached the app about 2 s early and it took the "cleared elsewhere" reset (`apps/timer.html:135`). Real-clock and standalone runs beep once (`audits/evidence/p3/timer/clocktz.json`). Skeptic 2 of P3-TIMER-02 hit the same artefact with a single 62 s jump and switched to 1 s steps.
- **The missing pill during the slow load.** The investigator cited it as a symptom, but the shell hides the pill by design while the Timer app is open (`index.html:820`), and the control run shows none either; see P3-TIMER-01's corrected claim.

### Unresolved — needs a device or more evidence

#### U-1 — The finish beep is expected to be silent on iPhone and iPad: the `AudioContext` is created at 0, long after the tap (60 s later in the 1-minute test runs), outside any gesture, and never resumed

- **Status: UNRESOLVED** (1 confirmed, 0 refuted, 2 unverifiable). A defect needs two skeptics who reproduced it; the rig's WebKit has no Web Audio, so none could play the beep on WebKit.
- **Severity if confirmed: high** (all three skeptics: high). Ringing is the kitchen timer's core job and the iPad and iPhones are the household's timer devices; not critical, because the countdown and the done state still work and nothing is lost. Investigator: high.
- **Code facts, confirmed at runtime in Chromium by all three skeptics.**
  - Both beeps construct a new context at 0 inside an interval callback: the app at `apps/timer.html:95` (from `finish()` at :102, via `step` on the 250 ms interval at :111); the shell at `index.html:790` (from `finishTimer` at :808, via `renderTimerPill` on the 1 s interval at :822).
  - The Start tap creates no context and unlocks nothing; nothing calls `resume()` or sets `navigator.audioSession` (grep of `apps/timer.html`, `index.html`, `apps/hub.js`).
  - Chromium plays the beep because it accepts sticky activation.
- **Votes.**
  - **Skeptic 1 (unverifiable)** ran `node "audits/tools/phase3/timer/verify-beep-silent-on-ios-1.mjs"`. WebKit: `{AudioContext:'undefined', webkitAudioContext:'undefined', audioSession:'undefined'}`. Chromium: 0 contexts after Start; at 0 (59,680 ms) the timer frame's context was `running`, sticky true, transient false, stack "beep (timer.html:95) | finish (timer.html:102) | step"; the iPad shell's context came from "timerBeep (index.html:790) | finishTimer (index.html:808)". Note: Playwright's `page.evaluate` gives the page user activation, so even a no-gesture control reads sticky.
  - **Skeptic 2 (unverifiable)** ran `node "audits/tools/phase3/timer/verify-beep-silent-on-ios-2.mjs"` on the real clock with real clicks. A (app open): 0 contexts and 0 `resume()` after the clicks; 1 context 59,561 ms after Start, transient false, `resume()` 0. B (Home): the shell made 1 context 60,037 ms after the tap, transient false, `resume()` 0; toast "Timer done — 1:00 is up.". Static: no `resume()`, no `audioSession`, no `<audio>`; `buzz()` at `index.html:454` only vibrates.
  - **Skeptic 3 (confirmed, tie-break)** ran `node "audits/tools/phase3/timer/verify-beep-silent-on-ios-3.mjs"` (same app-side result: 0 contexts at Start, 1 at 0 after 59,559 ms, transient false, no `resume()`) and read WebKit's source (`audits/evidence/p3/timer/verify-beep-silent-on-ios-3-webkit-source.txt`): on iOS-family platforms `RequiresUserGestureForAudioPlayback` defaults to true, `constructCommon()` then adds the user-gesture restriction, and `willBeginPlayback()` starts a context only with transient activation. So on iPhone and iPad these contexts never start. Remaining assumptions: Safari and Home Screen apps keep the embedder default, and the hub's origin is not on WebKit's quirk list.
- **Corrected claim.** The root cause is proven in code and at runtime; the symptom ("silent on iPhone and iPad") rests on WebKit's policy, shown from source but not on a device. The secondary claim, that the Ring/Silent switch also mutes Web Audio unless `navigator.audioSession.type` is `'playback'`, is not settled.
- **What would settle it.** On a real iPad and iPhone, from the Home Screen app: Apps → Kitchen timer → 1 min → Start, screen on, ringer on; then again in Silent mode; then again with the Timer app closed and Home showing. Optionally attach Safari Web Inspector and read the new context's `state` right after `apps/timer.html:95`: `'suspended'` confirms it.
- **Evidence.** `audits/evidence/p3/timer/verify-beep-silent-on-ios-1.json`, `audits/evidence/p3/timer/verify-beep-silent-on-ios-2.json`, `audits/evidence/p3/timer/verify-beep-silent-on-ios-3.json`, `audits/evidence/p3/timer/verify-beep-silent-on-ios-3-at-zero-ipad.png`; `audits/evidence/p3/timer/background.json` (B3: made 1 at 0, not at Start); `audits/02-shell.md:3546` (Phase 2 listed the beep as not examined).

U-2 (a missed first shell beep) was rerun by the critic and did not reproduce; it moved to "Checked and not a bug".

Device-only checks of unverified items (the locked iPhone, iOS wake lock, the long-press callout) are under "Not verified".

## 5. Visual fidelity

### Rubric scores

| Dimension | Investigator | Checker | Final | Provisional? | Reason | Evidence |
|---|---|---|---|---|---|---|
| Typography | 6 | 6 | **6** | Yes (the rig renders Segoe, not SF) | Big light tabular numerals (88 px on iPad, 76 px on iPhone, weight 300) feel Clock-like, with a clean numerals-chips-actions hierarchy. The title is an 18 px serif repeating the viewer bar's title; the 18 px action labels sit off the Dynamic Type scale. | `audits/screens/timer/running-typical-iphone-pwa-light.png`, `audits/screens/timer/idle-typical-ipad-landscape-light.png`, `audits/evidence/p3/timer/visual-idle-hearth-ipad.png` |
| Color & palette | 5 | 4 | **4** | No | The profile accent tints ring and digits and every text pair passes AA, but the look is earthy (Elizabeth's brown ring, a dark accent-deep Start with light ink), not vibrant pastel. The selected chip is the dimmest chip (7.79 against 14.68:1). Done differs from running by colour only, though the page wash and halo change too (checker's correction). | `audits/screens/timer/running-typical-ipad-portrait-light.png`, `audits/evidence/p3/timer/visual-done-hearth-ipad.png`, `audits/screens/timer/idle-typical-ipad-landscape-light.png`, `audits/evidence/p3/timer/visual-idle-midnight-ipad.png` |
| Layout & spacing | 6 | 6 | **6** | No | Centred, token spacing, 16 px phone margins, a clear order (dial, presets, actions); fits 430×740 to 1440. But the dial turns oval at 0, the title is duplicated, and the 400 px cap under-uses the iPad (landscape width; portrait's lowest ~290 px) and the TV. | `audits/screens/timer/done-typical-ipad-portrait-dark.png`, `audits/evidence/p3/timer/basics-done-iphone-light.png`, `audits/screens/timer/idle-typical-ipad-landscape-light.png`, `audits/screens/timer/running-typical-iphone-pwa-light.png` |
| Shape, depth & material | 5 | 5 | **5** | Yes (the rig paints no blur) | Soft disc and pill chips, but mixed corners (999 px chips beside 22 px buttons), glass on the content dial, and a circle that deforms at 0. | `audits/screens/timer/running-typical-ipad-portrait-light.png`, `audits/screens/timer/done-typical-ipad-portrait-dark.png`, `audits/evidence/p3/timer/visual-done-hearth-ipad.png` |
| Iconography | 4 | 4 | **4** | No | No icons on any control; the only glyph is the spot illustration used as a title mark. Text-only Start/Pause is Apple's own pattern for adults, but costs pre-readers. The shell chip's stopwatch shows; its duotone is not discernible at 16 px (checker). | `audits/screens/timer/kid-typical-iphone-pwa-light.png`, `audits/screens/timer/running-typical-iphone-pwa-light.png`, `audits/evidence/p3/timer/background-chip-over-tally-iphone.png` |
| Motion & feedback | 5 | 4 | **4** | Yes (motion not visible in stills) | Press scale .96 and an animated ring, but a hard 1 s `steps(2)` blink at 0, no Start→Pause transition (the gradient fill cannot interpolate), no motion or label for Paused, and one brief three-pip beep (not "a single chirp", checker's correction). | `audits/screens/timer/done-typical-iphone-pwa-light.png`, `audits/screens/timer/paused-typical-ipad-portrait-light.png`, `audits/evidence/p3/timer/basics-paused-iphone-light.png` |
| Dark mode | 7 | 5 | **6** | No | Complete and token-only, text passes AA, warm near-black surfaces. But Elizabeth's accent goes muddy tan-brown and Eli's a desaturated slate, the track nearly vanishes (1.2:1), and the selected chip reads as a disabled grey pill. The kid teal shows the design can glow (judge). | `audits/evidence/p3/timer/visual-idle-midnight-ipad.png`, `audits/screens/timer/running-typical-desktop-dark.png`, `audits/screens/timer/idle-empty-iphone-pwa-dark.png`, `audits/screens/timer/kid-typical-ipad-landscape-dark.png` |
| Native feel | 6 | 5 | **5** | Yes (real touch and iOS audio need a device) | No tap highlight, dialogs, tap focus rings or overscroll. But the cold-load placeholder is wrong data, an idle 5:00 / Start while a timer runs, and a Start there replaces it (P3-TIMER-01). No Lock Screen actions; the beep is likely silent on iOS (U-1; this counts only if U-1 is confirmed on a device, and without it the reason still supports 5 through P3-TIMER-01). | `audits/screens/timer/running-loading-iphone-pwa-light.png`, `audits/evidence/p3/timer/slowload-at-2s-iphone.png`, `audits/screens/timer/idle-typical-ipad-landscape-light.png` |
| Glanceability | 5 | 5 | **5** | No | The digits are the largest thing on screen and high-contrast, but read only to about 2.46 m on the iPad; done is colour-only; the arc's end is the only progress cue (track 1.4:1 / 1.2:1); a paused timer looks set, not paused. | `audits/screens/timer/running-typical-ipad-portrait-light.png`, `audits/evidence/p3/timer/visual-done-hearth-ipad.png`, `audits/screens/timer/paused-typical-ipad-portrait-light.png` |
| Ease of use | 5 | 5 | **5** | No | Simple, thumb-friendly controls with big targets. But 3 taps from Home (1 from the open app), no custom length, a preset tap silently cancels a running timer, pause is not kept, and pre-readers must read "5 min". | `audits/evidence/p3/timer/basics-idle-iphone-light.png`, `audits/evidence/p3/timer/audience-kid-running-iphone-pwa.png`, `audits/evidence/p3/timer/sync2-ipad-after-phone-pause.png` |
| Delight | 4 | 4 | **4** | No | The countdown that follows you across tabs is the one polished moment. Finishing is a pink wash, three pips and, on Home, a plain toast; no labels, no personality, and the dial warps. | `audits/screens/timer/done-typical-ipad-portrait-dark.png`, `audits/evidence/p3/timer/background-chip-over-tally-iphone.png`, `audits/screens/timer/done-toast-typical-iphone-pwa-light.png` |

Average: (6 + 4 + 6 + 5 + 4 + 4 + 6 + 5 + 5 + 5 + 4) / 11 = 54 / 11 = **4.9**. The investigator's average was 58 / 11 = 5.3 and the checker's 53 / 11 = 4.8.

**How the scores were checked.**
- **What the checker opened:** 45 screenshots, all 21 the investigator cited plus 24 more captures, and 3 contact sheets (`audits/screens/_sheets/timer--idle.jpg`, `audits/screens/_sheets/timer--done-toast.jpg`, `audits/screens/_sheets/timer--kid.jpg`). They cover iPad portrait and landscape, iPhone PWA and Safari, desktop and the TV evidence image, in light and dark, and the idle, running, paused, done, done-toast, pill, chip, overflow, loading, offline, empty and kid states. It also measured the ring track (`audits/tools/phase3/timer/vischeck-track.mjs`).
- **Agreed:** 7 of 11 dimensions.
- **Adjusted by one point:** 3 dimensions.
  - **Color & palette, 5 → 4:** calibrated to the shell's 4 for the same earthy palette; the selected chip is the dimmest, and Start is a dark gradient with light ink.
  - **Motion & feedback, 5 → 4:** the shell scored 3 for the same press "spring", and "a single chirp" was wrong (three pips, `apps/timer.html:96-99`).
  - **Native feel, 6 → 5:** the loading placeholder shows idle while a timer runs, the tell the shell was marked down for.
- **Judge:** ruled on 1 dimension. **Dark mode:** investigator 7, checker 5, final **6**. Nothing is broken or illegible, so it is clearly above the shell's 4, and the kid teal shows the palette can glow; but the muddy adult accents, the 1.2:1 track and the grey selected chip keep it below the 7 anchor.
- **Claims the checker corrected:** three pips, not one chirp; done also changes the page wash and adds a halo; the iPad is not "half empty"; 3 taps is from Home (1 from the open app); the chip's duotone is not visible at 16 px; in dark the Start is a pale fill with dark ink.

### Deviations from the house style

Each is marked with the visual checker's verdict.

| Area | Deviation | Checker | Evidence |
|---|---|---|---|
| Typography: font stack | The title uses `--font-display` = ui-serif, not system-ui. The whole UI inherits `--font-sans`, which starts with ui-rounded, while the house style keeps rounded for numerals and kid mode (the stack is design.css's, Phase 4). | Supported | `apps/timer.html:18`; `apps/design.css:18-20`; `audits/evidence/p3/timer/visual.json` (V2) |
| Typography: scale | Start/Reset labels 18 px, off the scale (Body 17 / Title 3 20). Presets 16 (Callout). Numerals 88 px weight 300 on iPad, 76 px on iPhone. Viewer bar title 14 px. | Supported | `audits/evidence/p3/timer/visual.json` (V2), `audits/evidence/p3/timer/basics.json` (`B_measure`) |
| Typography: hierarchy | The app name appears twice (viewer bar and in-app h1) | Supported | `apps/timer.html:15-19, 53`; `audits/screens/timer/running-typical-iphone-pwa-light.png` |
| Colour: pastel fill/ink | No house pastel pairs: in light the primary Start is a dark accent-deep gradient with light ink (`apps/design.css:361`), and the ring is the raw profile colour | Partly: true in light; in dark the Start is a pale fill with dark ink, closer to the house pairing; the ring stays raw accent | `audits/screens/timer/running-typical-ipad-portrait-light.png`, `audits/evidence/p3/timer/visual-idle-midnight-ipad.png` |
| Colour: selection state | The selected chip has half the contrast of the unselected ones (5.76-7.79 against 14.16-14.68:1) | Supported | `apps/timer.html:44`; `audits/evidence/p3/timer/visual.json` (V1) |
| Colour: semantic | "Finished" borrows `--danger`, the destructive colour, and is told from running by colour only | Partly: `--danger` borrowed, yes; the page wash and 6 px halo also change, but there is still no non-colour cue | `apps/timer.html:12, 36-38`; `audits/evidence/p3/timer/visual.json` (V4) |
| Profile accent without hue | Nothing names whose timer it is; only the accent hue identifies the owner | Supported | `apps/timer.html:52-71`; `audits/screens/timer/running-typical-ipad-portrait-light.png` |
| Shape: circle integrity | The dial becomes 353×401 at 0 (P3-TIMER-02) | Supported | `apps/design.css:545`; `audits/evidence/p3/timer/basics.json` (`E_done`) |
| Shape: corner language | Full-round chips beside 22 px (`--r-lg`) buttons in one control group | Supported | `audits/evidence/p3/timer/visual.json` (V2 radius) |
| Material: glass | The content dial is a glass pane (VIS-TIMER-6) | Supported | `apps/timer.html:54` |
| Layout: iPad | The dial is capped at 400 px, leaving iPad landscape's width and iPad portrait's lowest ~290 px unused | Partly: the portrait band, yes; landscape height is well used and the investigator's "45% of the width" is loose | `apps/timer.html:22`; `audits/evidence/p3/timer/visual-idle-hearth-ipad.png`, `audits/screens/timer/idle-typical-ipad-landscape-light.png` |
| Layout: hardcoded dimensions | 44 px img (17), 560/400/640 px widths (13, 22, 48), 640/720 px media queries (19, 48), a `0 2px 6px` drop-shadow (26), a 6 px done ring (36), `stroke-width: 3` (27), and a `clamp(56px,16vw,92px)` font overridden by `24cqw` (31) | Supported | `apps/timer.html:13, 17, 19, 22, 26, 27, 31, 36, 48` |
| Tap targets | None below 44 px: presets 44 (kid 64), actions 60 (kid 84). Compliant. | Supported | `audits/evidence/p3/timer/basics.json`, `audits/evidence/p3/timer/audience.json` |
| Iconography | Text-only controls; no play, pause or reset glyphs; the title mark is a spot illustration (`art/app/timer.svg`) | Supported | `apps/timer.html:53, 60-71` |
| Motion | The done blink is a 1 s `steps(2)` on/off, the ring `.5s linear`, no Start/Pause transition; hardcoded durations | Supported | `apps/timer.html:29, 38-39, 106` |
| Feedback | A destructive preset tap or Reset has no undo | Supported | `apps/timer.html:120-125` |
| Loading | A fake, live-looking placeholder instead of a skeleton; it shows idle 5:00 / Start while a timer runs | Supported (worse than "fake") | `audits/evidence/p3/timer/slowload-at-2s-iphone.png`, `audits/screens/timer/running-loading-iphone-pwa-light.png` |
| Dark-mode surfaces | The investigator found none material | Partly: the surfaces are fine, but the ring track is 1.2:1 and the adult accents read muddy | `audits/evidence/p3/timer/vischeck-track.json`, `audits/screens/timer/running-typical-desktop-dark.png` |
| Graphics contrast (from the checker) | The ring track is 1.39:1 (light) and 1.2:1 (dark) against the dial, under 3:1 (VIS-TIMER-7) | Checker's addition | `audits/evidence/p3/timer/vischeck-track.json` |

### Web tells

| Tell | Status | Evidence |
|---|---|---|
| Grey tap highlight | Absent | `-webkit-tap-highlight-color: transparent` on body and buttons (`apps/design.css:302, 312`) |
| Selection / callout on long-press | Partly | `user-select: none` on body (`apps/timer.html:10`); `-webkit-touch-callout` NOT FOUND IN CODE, so a long-press on the title image (`apps/timer.html:53`) may offer Save Image on iOS (needs a device) |
| Default form controls | Absent | No inputs; all buttons are `.btn` (`apps/timer.html:61-70`) |
| Focus rings on touch | Absent | `:focus-visible` only (`apps/design.css:314`) |
| Blue underlined links | n/a | No links in `apps/timer.html` |
| White flash on load | Needs a device | The dark first-paint captures are dark (`audits/screens/timer/idle-loading-ipad-portrait-dark.png`), but the rig cannot show the iframe's blank frame on a real iPad |
| Rubber-band overscroll mismatch | Absent | `overscroll-behavior: none` (`apps/design.css:304`); the page does not scroll at any captured size |
| Tap delays | Absent | `touch-action: manipulation` (`apps/design.css:303, 312`) |
| Visible scrollbars | Absent | The content fits from 430×740 to 1440×900 (`audits/screens/timer/idle-typical-iphone-safari-light.png`) |
| Layout shift as data loads | Partly | No box moves, but the digits and button swap from a placeholder 5:00 / Start to the real state after `hub.ready` (`audits/evidence/p3/timer/slowload.json`) |
| Spinners vs skeletons | Partly | Neither: a live-looking placeholder poses as real data (`audits/evidence/p3/timer/slowload-at-2s-iphone.png`) |
| `alert()` / `confirm()` / `prompt()` | Absent | `audits/evidence/p3/_compliance/timer.json` (bypass lists empty), and no undo either |

## 6. Platform compliance

**Data through hub.js.**
- **Calls used:** `hub.ready` (`apps/timer.html:76`), `hub.get` (`:81, 90`), `hub.set` / `hub.remove` / `hub.has` behind `hub.canWrite` (`:91, 124`) and `hub.onChange` (`:130`). The shell reads the same record through `hub.get('timer.active', TIMER)` (`index.html:786`).
- **Not used:** `hub.activity` (no feed lines), `hub.onSync` (no sync status, UX-TIMER-8).
- **Bypasses: 0.** localStorage, sessionStorage, IndexedDB, fetch, XHR, service worker, external URLs and native dialogs: NOT FOUND IN CODE (`audits/evidence/p3/_compliance/timer.json`). The only platform API used directly is `AudioContext` for the beep (`apps/timer.html:95`).
- **Where hub.js fails the Timer:** its 6 s first-load race is the root of P3-TIMER-01 (`apps/hub.js:334-337`).

**design.css tokens.** The `compliance.mjs` hits were reviewed by hand; the corrected counts:

| Category | Raw hits | Corrected | Notes |
|---|---|---|---|
| Hardcoded colours | 0 hex, 0 rgb/hsl, 0 named; 4 `colorDerived` | **0** | The 4 are `color-mix()` of tokens (`apps/timer.html:12, 28, 37, 44`) |
| Font sizes | 2 | **1** | `clamp(56px, 16vw, 92px)` (`apps/timer.html:31`), dead code overridden on the same line by `24cqw`, itself untokenised. Line 18 is a false positive (`--fs-lg`). |
| Radii | 0 | **0** | All `var(--r-full)`; the buttons take `--r-lg` from design.css |
| Spacing | 1 | **0** | Line 43 is a false positive (`padding: 0 var(--sp-3)`) |
| Shadows | 1 | **1** | Line 36 restates the glass recipe inline with a literal `0 0 0 6px` ring; the `drop-shadow(0 2px 6px …)` at line 26 is not counted by the script |
| Durations | 2 | **2** | `.5s linear` (`apps/timer.html:29`) and `1s steps(2)` (`apps/timer.html:38`) |
| z-index | 0 | **0** | |
| Fixed dimensions (not counted by the script) | n/a | **8 declarations** | `apps/timer.html:13, 17, 19, 22, 26, 27, 36, 48` |
| Undefined tokens | 0 | **0** | 2 local custom properties (`--tint`, `--p`) |
| Inline styles | 1 | **1, harmless** | `style="--p:1"` on the ring (`apps/timer.html:56`) |
| `prefers-color-scheme` / unguarded `:hover` / native dialogs | 0 / 0 / 0 | **0** | |

**Per-profile accent.** `--accent` reaches the app, set by hub.js on `<html>`: Eli #4F5D8C, Elizabeth #8A6A4B, Ezra #137F77 (`audits/evidence/p3/timer/basics.json` `F_accent`). The ring stroke follows `--accent` and the digits `--accent-strong` (`apps/timer.html:22, 29, 32`). Nothing else names the owner (no initial or avatar).

**Dark mode.**
- No `prefers-color-scheme` and no `[data-scheme]` rules in the app; none are needed, because every colour is a token that each `:root[data-theme]` block redefines.
- All five palettes were measured (`audits/evidence/p3/timer/visual.json` V1), and every text pair passes AA: light palettes, digits 7.6-9.2, selected chip 6.6-7.8, done digits 4.17 (large text); Midnight and Forest, digits 6.65-7.5, selected chip 5.76-6.27, done digits 6.38.
- The judge's reservations: muddy adult accents, a 1.2:1 track and a grey selected chip (§5).
- Reduced motion is honoured globally by design.css (`apps/design.css:611-613`), which also stops the done blink. Kid mode gets only the design.css kid tokens (64/84 px targets, 19/22 px type); the app has no `data-kind` rules.

## 7. Improvements

Ratio = delight ÷ effort, with S = 1, M = 2, L = 3. None adds a routine or reward system or a shopping list; the Timer is not on CLAUDE.md's "Do not touch" list.

**Polish**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | A clear "Time's up" moment: a label with a bell icon and a steady, high-contrast done state, so it reads by more than colour | 4 | S | 4.0 | UX-TIMER-4; `visual.json` V4 |
| 2 | Undo instead of silent cancel: a preset tap or Reset while running shows "Timer cancelled — Undo" for 5 s and restores `endAt` | 4 | S | 4.0 | UX-TIMER-1; `basics.json` C |
| 3 | A bigger dial on the iPad: size it from vmin and drop the 400 px cap, so the digits reach 15 mm for 3 m | 4 | S | 4.0 | UX-TIMER-5; `visual.json` V3 |
| 4 | A skeleton until ready: a dial without digits and a disabled Start until this page's first timer pull has landed, even with a warm cache; never start blind over an unknown record | 3 | S | 3.0 | P3-TIMER-01, UX-TIMER-9 |
| 5 | Keep the dial round at 0: rename the `empty` class (it collides with design.css's `.ds .empty`) | 3 | S | 3.0 | P3-TIMER-02 |
| 6 | Keep Pause strong and say Resume: a tinted Pause while running, "Resume" and "Paused" after pausing | 3 | S | 3.0 | VIS-TIMER-1, UX-TIMER-2 |
| 7 | Hide the in-app title when framed, and use the system font for it | 2 | S | 2.0 | VIS-TIMER-2 |
| 8 | Accessible state: `aria-pressed` on the chips and a polite live region at minute marks and "Time's up" | 2 | S | 2.0 | UX-TIMER-10 |
| 9 | Keep chat clear of the pill: pad the chat log by the pill's height while it shows | 2 | S | 2.0 | VIS-TIMER-5 |
| 10 | A visible ring track (at least 3:1 against the dial), from the visual check | 2 | S | 2.0 | VIS-TIMER-7; `vischeck-track.json` |
| 11 | Reuse one `AudioContext` (or close it after the chime) | 1 | S | 1.0 | P3-TIMER-03 |
| 12 | Count down like a clock: `Math.ceil` for the display and finish at `endAt` (`endAt - Date.now() <= 0`), in the app and the shell | 1 | S | 1.0 | P3-TIMER-05 |

**Missing features**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Unlock the chime on Start and ring until stopped: create or resume one `AudioContext` inside the Start tap (app and shell), repeat the chime until a big Stop / +1 min is tapped, and set `navigator.audioSession.type = 'playback'` where supported | 5 | S | 5.0 | U-1, GAP-TIMER-2; `apps/timer.html:93-111`; `index.html:788-822` |
| 2 | Persist pause across devices: `timer.active {pausedLeft, total}`, "Paused 9:28" everywhere, Resume continues | 4 | S | 4.0 | UX-TIMER-2; `sync2.json` S2 |
| 3 | Notify whenever the page is hidden at 0, whichever app is open, and offer "Alert me when it's done" (permission) on first Start | 4 | S | 4.0 | P3-TIMER-04, GAP-TIMER-1; `verify-critic-notify-suppressed-while-app-open-3-2.json` A against C |
| 4 | Missed-timer notice: "Timer ended 4 min ago" on return, in the app and as a shell toast | 4 | S | 4.0 | UX-TIMER-3; `background.json` B5/B6 |
| 5 | Several named timers: person rows `timer:<id> {label, endAt, total}` ("Pasta", "Oven") as small dials; the pill shows the soonest with a count | 5 | M | 2.5 | GAP-TIMER-3 |
| 6 | Ring on a locked phone: when a timer starts, schedule a Web Push for `endAt` to the owner's subscriptions (a Durable Object alarm, or a 1-minute cron that scans `timer.active` rows), through the existing push path and a new per-person toggle; from the critic | 5 | M | 2.5 | PWA-GAP-1 pointer; `worker/src/reminders.js:240` (no timer job); `verify-critic-locked-phone-no-alert-2-1.json` |
| 7 | Custom duration and +1 min: a minute/second wheel or keypad, +1 min while running, recents | 4 | M | 2.0 | GAP-TIMER-3; `apps/timer.html:61-66` |
| 8 | One-tap start from Home: a wide tile or Home card with the last preset and two favourites, and a large running countdown on the kitchen iPad | 4 | M | 2.0 | UX-TIMER-7; `apps.json:8` |

**New ideas**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | A pictorial kid timer: chips as filled discs (small, medium, big), play and pause glyphs, and a shrinking coloured disc a pre-reader can follow; no rewards or routines | 4 | M | 2.0 | UX-TIMER-6 |
| 2 | Say it: a `start_timer` chat tool, or `hub.voiceInput` on the Timer, so hands-busy cooks can start or add time by voice | 4 | M | 2.0 | `worker/src/chat.js` (no timer tool); Apple's Siri timers |
| 3 | Household-visible kitchen timers: an opt-in "show on the kitchen screens" flag so a cooking timer appears large on the TV board and the shared iPad for everyone | 4 | L | 1.3 | GAP-HOME-1; P2-PROF-08 |

Six improvements tie at 4.0 behind the chime (5.0). The top five used in the summary are the chime, the "Time's up" moment, undo, the bigger iPad dial and persisted pause.

## App-specific checks

| Check (from the brief, plus the investigator's) | Result | Evidence |
|---|---|---|
| Accurate after backgrounding (app, pill, chip) | **PASS.** Computed from `endAt` on every tick; 0 s error after 3-4 min hidden (forced `document.hidden`, JS running). Frozen page (from the critic: JS and timers suspended 20 s through CDP): 0:59 → 0:38 on thaw, expected 38; the shell pill was not run frozen. To within P3-TIMER-05's rounding. | `audits/evidence/p3/timer/background.json` (B1); `audits/evidence/p3/timer/critic-frozen-wake.json` (F1); `apps/timer.html:107-111`; `index.html:816` |
| Keeps the screen awake | **PARTLY.** `apps/timer.html` requests no wake lock (NOT FOUND IN CODE). The shell takes one on the first `pointerdown` on its own document (`index.html:1708-1712`), so a page whose life starts inside the Timer holds none (P2-STAB-09). iOS standalone behaviour needs a device. | `index.html:1708-1712`; `audits/02-shell.md:3297-3320` |
| Alert, app open and visible | One three-pip beep and a blinking done state; no repeat; no notification | `audits/evidence/p3/timer/background.json` (B3) |
| Alert, app open but page hidden | The app's own beep plays while JS runs (desktop); no notification (P3-TIMER-04) | `audits/evidence/p3/timer/verify-critic-notify-suppressed-while-app-open-3-2.json` (A); `index.html:807-810` |
| Alert, app closed (Home), awake | Shell beep, 4 s toast "Timer done — 1:00 is up.", local notification (stubbed permission) | `background.json` (B4) |
| Device hidden or page closed through the end, back after more than 60 s | **FAIL (UX).** Nothing: no beep, toast or notification; the pill is gone and the app reopens idle (UX-TIMER-3) | `background.json` (B5, B6); `index.html:806` |
| The real beep on iPhone and iPad; a locked iPhone | **UNRESOLVED.** The rig's WebKit has no Web Audio; by code and WebKit's source the beep is likely silent (U-1). No server push exists for timers: `worker/src` has 0 timer references, and the local notification needs the page's JS at 0, so a locked iPhone gets nothing; the iOS suspension itself needs a device (PWA-GAP-1 pointer; the high "bug" was refuted as that known gap) | `audits/evidence/p3/timer/verify-beep-silent-on-ios-3.json`; `apps/timer.html:95`; `index.html:797-810`; `audits/evidence/p3/timer/verify-critic-locked-phone-no-alert-2-1.json` |
| Early finish | **FAIL (low, P3-TIMER-05, from the critic).** 0:00 and the beep land 0.25-0.5 s before `endAt`; each digit changes about 0.5 s early | `audits/evidence/p3/timer/verify-critic-early-finish-rounding-4-2.json`; `apps/timer.html:108-109` |
| Repeated alerts | **FAIL (gap).** None; one beep per finish (GAP-TIMER-2) | `background.json` (B3 `oneMinuteLater`) |
| Midnight, DST on 2026-11-01, another time zone | **PASS.** Both runs finished with one beep; the Tokyo device matched New York (14:56) | `audits/evidence/p3/timer/clocktz.json` (Z1-Z3) |
| Presets, custom entry, +1 min, several timers, labels | Six presets only; the rest NOT FOUND IN CODE (GAP-TIMER-3) | `apps/timer.html:61-66, 80` |
| Pause and resume | Works in one page; not stored (UX-TIMER-2) | `basics.json` (D); `sync2.json` (S2) |
| Two devices of one person | Start seen after 26.4 s, pause after 24.1 s, reset after 26.2 s (the 30 s pull); the other device gets no notice | `audits/evidence/p3/timer/sync2.json` (S1-S3); `apps/hub.js:342` |
| Shell navigates / viewer closed | **PASS.** The pill (Home) and chip (other apps) continue correctly | `background.json` (B1); `audits/evidence/p3/timer/background-chip-over-tally-iphone.png` |
| Kid and pre-reader | **PARTLY.** Bigger targets through tokens; text-only controls (UX-TIMER-6) | `audits/evidence/p3/timer/audience.json` (`K_*`) |
| Kiosk | **PASS.** Not listed, `#timer` ignored; standalone, a local countdown with no writes (OK-TIMER-4) | `audience.json` (`T_kiosk`) |
| Guest | **PASS.** 3 taps; person-scope row written | `audience.json` (`G_guest`) |
| Opening the Timer while its first pull is slow or fails (new device, or a warm cache that missed a timer started elsewhere) | **FAIL (P3-TIMER-01).** An idle timer is shown (5:00, or the last preset with a warm cache); one Start replaces the running timer | `audits/evidence/p3/timer/slowload.json`; `audits/evidence/p3/timer/critic-warm-stale-start.json` |
| Offline | Runs locally with no sign; syncs when back online (UX-TIMER-8) | `audits/evidence/p3/timer/pillchat-offline.json` (O) |

## Leads from 01-leads.md

| Lead | Outcome | Where it went |
|---|---|---|
| A tap during a slow first load can overwrite the saved count, Timer part (`audits/01-leads.md:212`) | Widened: after the 6 s race, or at once on a failed pull, one Start replaced the running 15-minute timer on the server; the critic widened it again to a warm cache, where Start is live at about 0.1 s | P3-TIMER-01, UX-TIMER-9 |
| The timer dial stretches into a tall oval (`:214`) | Confirmed: 353×353 → 353×401 on iPhone, 400×400 → 400×448 on iPad and desktop; the buttons drop 24 px | P3-TIMER-02 |
| Pause is not kept, and a paused timer looks like a running one (`:216`) | Widened: the person's other open Timer resets to the full preset 24 s later; the paused screen looks idle and says Start | UX-TIMER-2 |
| A finished kitchen timer alerts only briefly (`:218`) | Confirmed: one beep, a 4 s toast; also no notification while the app is open (now a confirmed defect). No server push exists, so a locked phone has no path to ring (a known Phase 2 gap); the iOS suspension was not verified, and the beep itself is likely silent on iOS | GAP-TIMER-2, P3-TIMER-04, GAP-TIMER-1, PWA-GAP-1 pointer, U-1 |
| The done state is shown only by colour and blinking (`:220`) | Confirmed, narrowed by the visual check: the page wash and halo change too, but there is no non-colour cue | UX-TIMER-4 |
| Neither app shows offline or unsent changes, Timer part (`:224`) | Confirmed | UX-TIMER-8 (P2-SYNC-15 pointer) |
| No loading state, and taps do nothing until data loads, Timer part (`:226`) | Confirmed, and it leads into P3-TIMER-01 | UX-TIMER-9 |
| The floating timer pill covers Home content (`:228`) | Not checked: a shell Home layout lead owned by Phase 2 | VIS-HOME-2 (pointer) |
| On the Chat tab the timer pill covers the newest message (`:237`) | Narrowed: 9 px on iPhone, 21 px on desktop, 0 on iPad portrait; not half the bubble | VIS-TIMER-5 |
| Timer has no kid mode (`:239`) | Narrowed: the kid tokens enlarge targets to 64/84 px and type to 19/22 px; the controls are still text-only | UX-TIMER-6 |
| The selected preset chip looks disabled (`:243`) | Narrowed: it passes AA (5.76-7.79:1) at about half its neighbours' contrast | VIS-TIMER-3 |
| A running timer has no primary button (`:245`) | Confirmed (also found by the visual check) | VIS-TIMER-1 |
| Times over an hour are shown as minutes (`:249`) | Narrowed: unreachable from the Timer UI (maximum preset 1800 s) | VIS-TIMER-4 |
| Timer shows its title twice (`:251`) | Confirmed, and the second title is a serif | VIS-TIMER-2 |
| Seen in passing on the shell's desktop Home, Kids card (`:255`) | Not checked: a shell Home item | P2-VIS-05 (Phase 2) |
| Tally-only leads in the same section (`:222`, `:241`, `:247`, `:253`) | Not checked here | `audits/03-apps/tally.md` |

## Not verified

- **The real finish beep** on an iPhone and iPad, in the app and in the shell, with the ringer on and in Silent mode (U-1). The rig's WebKit has no `AudioContext`, and Chromium's sticky-activation rule differs from WebKit's.
- **A locked iPhone or iPad, or a backgrounded Home Screen app:** whether JS is suspended through 0 and whether the local notification ever shows. By code there is no other path: the Worker has no timer code (`grep -n -i timer worker/src/*.js` returns nothing), so if the page is suspended nothing can ring. The rig can only model suspension (the page hidden and the clock moved with no timers fired; `audits/evidence/p3/timer/verify-critic-locked-phone-no-alert-2-1.json`). Permission can be granted only from Me → push switch; on the rig, notifications were stubbed with a granted permission and a fake registration. To settle: on a Home Screen iPhone, start a 1-minute timer, lock the phone, wait 90 s, and note whether anything sounds or shows on the Lock Screen and whether a late beep plays on unlock (Phase 2 device check #7).
- **Screen Wake Lock** on iOS standalone (P2-STAB-09 owns it).
- **The real Liquid Glass look** of the dial and pill (the rig paints no `backdrop-filter`), and SF Pro / SF Pro Rounded rendering (the rig falls back to Segoe). Typography, Shape, Motion and Native feel are provisional.
- **Real touch press states and haptics**, and the iOS long-press callout on the title image.
- **Chromium's intensive timer throttling** after 5+ minutes in a genuinely hidden tab; hidden was emulated by forcing `document.hidden`.
- **The Phase 2 pointers** P2-PROF-08, P2-STAB-08, P2-SYNC-09 and P2-STAB-01 were not re-run for this app (P2-STAB-13's in-app variant was run by the critic, see its pointer); the Home-pill lead (VIS-HOME-2) and the desktop Kids card seen in passing were not re-run either.
- **How often a first timer pull is slow or fails** in the household; production was not touched (the same open question Phase 2 left for P2-SYNC-17).
- **The Apple support page** was read with curl, because WebFetch could not read its body; the kitchen-timer app features are generic product knowledge, not a named reference (no specific app was consulted).
- **The notification tap landing on an idle preset** (UX-TIMER-3) is by code, not run; so are "Pause from Home" and clearing the done state (§3).

## Scripts and evidence

**Investigator** (`audits/tools/phase3/timer/`): `_util.mjs`, `probe-env.mjs`, `basics.mjs`, `background.mjs`, `sync2.mjs`, `slowload.mjs`, `audience.mjs`, `visual.mjs`, `clocktz.mjs` and `pillchat-offline.mjs`. Platform counts: `node audits/tools/phase3/compliance.mjs timer` → `audits/evidence/p3/_compliance/timer.json`.

**Skeptics** (`audits/tools/phase3/timer/`):

| Finding | Scripts |
|---|---|
| P3-TIMER-01 | `verify-slowload-start-replaces-running-timer-1.mjs`, `verify-slowload-start-replaces-running-timer-2.mjs`; warm-cache trigger: `verify-critic-warm-cache-stale-start-replaces-timer-1-1.mjs`, `verify-critic-warm-cache-stale-start-replaces-timer-1-2.mjs` |
| P3-TIMER-02 | `verify-done-dial-oval-1.mjs`, `verify-done-dial-oval-2.mjs` |
| P3-TIMER-03 | `verify-audiocontext-never-closed-1.mjs`, `verify-audiocontext-never-closed-2.mjs` |
| P3-TIMER-04 | `verify-critic-notify-suppressed-while-app-open-3-1.mjs`, `verify-critic-notify-suppressed-while-app-open-3-2.mjs` (and its `-trace.mjs`) |
| P3-TIMER-05 | `verify-critic-early-finish-rounding-4-1.mjs`, `verify-critic-early-finish-rounding-4-2.mjs` |
| Locked phone (refuted) | `verify-critic-locked-phone-no-alert-2-1.mjs`, `verify-critic-locked-phone-no-alert-2-2.mjs`, `verify-critic-locked-phone-no-alert-2-3.mjs` |
| U-1 (unresolved) | `verify-beep-silent-on-ios-1.mjs`, `verify-beep-silent-on-ios-2.mjs`, `verify-beep-silent-on-ios-3.mjs` |

**Completeness critic** (`audits/tools/phase3/timer/`): `critic-warm-stale-start.mjs` (P3-TIMER-01's warm-cache trigger), `critic-early-finish.mjs` (P3-TIMER-05), `critic-frozen-wake.mjs` (OK-TIMER-1's frozen page and the P2-STAB-13 in-app variant), `critic-u2-first-pull.mjs` (U-2, not reproduced).

**Visual checker:** `audits/tools/phase3/timer/vischeck-track.mjs` → `audits/evidence/p3/timer/vischeck-track.json`, plus the 45 screenshots and 3 contact sheets listed in §5.

**Evidence** is in `audits/evidence/p3/timer/`:
- JSON: `audience.json`, `background.json`, `basics.json`, `clocktz.json`, `pillchat-offline.json`, `slowload.json`, `sync2.json`, `visual.json`, `vischeck-track.json`, the `critic-*.json` files, and the `verify-*.json` files (plus `verify-beep-silent-on-ios-3-webkit-source.txt`).
- PNGs at 1× CSS scale: the `audience-*`, `background-*`, `basics-*`, `critic-*`, `offline-*`, `pillchat-*`, `slowload-*`, `sync2-*`, `visual-*` and `verify-*` images.

The Phase 1 captures are under `audits/screens/timer/`.
