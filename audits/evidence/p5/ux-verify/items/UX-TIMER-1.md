<!-- audits/03-apps/timer.md:315 · section "4. Issues and bugs" · area timer · kind UX · rated medium -->
- **UX-TIMER-1 — One tap on any preset chip cancels a running timer on every device, with no confirm and no undo** (medium).
  - The preset handler runs `stop(); write(null)` and loads the new preset (`apps/timer.html:121-125`). In `basics.mjs` the timer read 9:57 with Pause; one tap on "3 min" gave 3:00 with Start, and the server row became `timer.active: null`, so the pill vanished on every device of the person.
  - The chips stay live while running, for kids too, and their second row ends 16 px above Pause (`basics.json` `B_measure`).
  - Reset does the same (`apps/timer.html:120`).
  - Evidence: `audits/evidence/p3/timer/basics.json` (`C_presetWhileRunning`); `audits/evidence/p3/timer/audience-kid-running-iphone-pwa.png`. Run `node "audits/tools/phase3/timer/basics.mjs"`.
  - Expected: while a timer runs, a preset tap offers "Timer cancelled — Undo" (Apple favours undo over confirm), or adds a second timer.
