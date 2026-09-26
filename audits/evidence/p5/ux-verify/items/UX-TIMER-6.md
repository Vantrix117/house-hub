<!-- audits/03-apps/timer.md:345 · section "4. Issues and bugs" · area timer · kind UX · rated medium -->
- **UX-TIMER-6 — Kid mode enlarges the controls, but every one is a word** (medium).
  - For Ezra the kid tokens make the chips 64 px and Start/Reset 84 px tall (`apps/design.css:280-284`), but no control has an icon (`hasIcon: false`). Labels are "1 min" … "30 min", Start, Pause and Reset (`apps/timer.html:60-71`).
  - A pre-reader can start the default and see the done state, but cannot choose a length; while running, Pause loses its fill (`apps/timer.html:106`) and looks like Reset.
  - Evidence: `audits/evidence/p3/timer/audience.json` (`K_iphone-pwa`, `K_ipad-portrait`), `audits/evidence/p3/timer/audience-kid-idle-iphone-pwa.png`, `audits/evidence/p3/timer/audience-kid-running-ipad-portrait.png`. Run `node "audits/tools/phase3/timer/audience.mjs"`.
