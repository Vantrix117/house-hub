<!-- audits/03-apps/timer.md:377 · section "4. Issues and bugs" · area timer · kind GAP · rated medium -->
- **GAP-TIMER-2 — The alert is one 0.85 s three-pip beep that never repeats and needs no acknowledgement** (medium).
  - Three 250 ms notes at 880 Hz at 0, 0.3 and 0.6 s, once (`apps/timer.html:96-99`). A minute later the probe still counted 1 context and 3 oscillators (B3); the shell's toast lasts 4 s (`index.html:810`; B4 `oneMinuteLater.toast: null`). Only the blinking digits remain, and only in the app.
  - Evidence: `audits/evidence/p3/timer/background.json` (B3, B4).
  - Expected: as in Apple Clock, the sound repeats until a big Stop (or +1 min) is tapped.
