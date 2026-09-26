<!-- audits/03-apps/timer.md:327 · section "4. Issues and bugs" · area timer · kind UX · rated medium -->
- **UX-TIMER-3 — A timer that ends while the only device is asleep or closed leaves no trace** (medium).
  - B5: app closed, page hidden through the end, back 2 min later: no beep, toast or notification, and no pill. B6: the whole page closed with the Timer open, reopened on `#timer` 2 min after 0: "1:00 Start", not the done state.
  - The shell clears ended records silently after 60 s (`index.html:806, 809`), and the app ignores an ended record on open (`apps/timer.html:129`).
  - Tapping the "Timer done" notification opens the Timer on an idle preset, not the done state: the notification opens `#timer` (`index.html:801`; `sw.js:62-64`), but by then the shell has already removed the record (`index.html:809`), and the app shows the idle preset when there is no running record (`apps/timer.html:128-129`). By code, not run.
  - If the Timer app was open when a suspended page resumes, it plays its one beep late, on unlock, with no notification (about 2 min late in the critic's skeptics' modelled lock; `audits/evidence/p3/timer/verify-critic-locked-phone-no-alert-2-1.json` S2).
  - Phase 2 ruled the multi-device version by design and harmless when another device was awake (`audits/02-shell.md:3518`). This is the one-device case, which is the common one for a phone; filed as UX, not as a defect.
  - Evidence: `audits/evidence/p3/timer/background.json` (B5, B6). Run `node "audits/tools/phase3/timer/background.mjs"` (Chromium; hidden emulated by forcing `document.hidden`, then `clock.fastForward`).
  - Expected: on return, "Timer ended 2 min ago" in the app and a toast in the shell, like a missed-alarm notice.
