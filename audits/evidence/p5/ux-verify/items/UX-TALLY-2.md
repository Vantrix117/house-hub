<!-- audits/03-apps/tally.md:493 · section "4. Issues and bugs" · area tally · kind UX · rated medium -->
- **UX-TALLY-2 — While loading there is no skeleton or busy state, and taps first do nothing** (medium). The display half of this item, the 0 shown as the count, was reclassified as a bug by the completeness critic, confirmed 2/2 and is now **P3-TALLY-07**; this ID keeps the missing loading state and the dead taps.
  - Until `hub.ready` resolves, the markup shows 0 and an empty pill, and the buttons have no handlers (`apps/tally.html:130, 134, 145-157`). Three taps at 1.5-2.8 s left the count at 0 with an empty queue: someone counting during a slow load loses those taps without a sign.
  - At 6.1 s the pill filled in and the buttons went live with the count still 0. From then until the held pull landed, a tap overwrites the real count (P3-TALLY-02).
  - The GET was held 9 s, and the 10.5 s sample read 37 (`loading.json` afterPullLanded `ms: 10503`).
  - There is no skeleton, no disabled state and no `aria-busy`.
  - Evidence: `audits/evidence/p3/tally/loading.json`; `audits/evidence/p3/tally/loading-at-1500ms-iphone.png`; `audits/screens/tally/main-loading-ipad-portrait-light.png`.
  - Run: `node "audits/tools/phase3/tally/loading.mjs"`.
  - Corrected by the visual check: the investigator wrote "up to 6 s" and "about 9 s"; the 0 lasts until the pull lands, and the buttons are live from 6.1 s.
