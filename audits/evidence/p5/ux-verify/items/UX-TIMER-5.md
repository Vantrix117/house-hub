<!-- audits/03-apps/timer.md:340 · section "4. Issues and bugs" · area timer · kind UX · rated medium -->
- **UX-TIMER-5 — The digits read only to about 2.5 m on the Kitchen iPad, because the dial is capped at 400 px** (medium).
  - The digits render 64 px high (an 88 px font; canvas `actualBoundingBox`), 12.3 mm on an 11-inch iPad: readable to 2.46 m by h ≥ d/200. Reading at 3 m needs 15 mm.
  - `.dial` is `width: min(82vw, 52vh, 400px)` (`apps/timer.html:22`), so both iPad orientations get a 400 px dial.
  - Correction from the visual check: in iPad landscape the width beside the dial is unused but the height is well filled; in portrait the lowest ~290 px are empty. "Half empty" overstated it.
  - Evidence: `audits/evidence/p3/timer/visual.json` (V2, V3), `audits/screens/timer/idle-typical-ipad-landscape-light.png`, `audits/evidence/p3/timer/visual-idle-hearth-ipad.png`.
