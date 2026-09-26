<!-- audits/03-apps/dollywood.md:665 · section "4. Issues and bugs" · area dollywood · kind UX · rated medium -->
- **UX-DOLLYWOOD-1 — Ticking the step just built takes 3-4 taps plus a scroll, and Home has no build-guide card** (medium).
  - J1 is 4 taps on the iPhone (the sheet must be raised first) and 3 taps plus a scroll on the iPad and desktop. On iPad portrait the card title sits at y=1400 in a 1132 px viewport; on desktop the card starts at y=1441 in 852.
  - Home has no card for the build, so every path starts at the Apps tab (`index.html:458-459`).
  - Evidence: `audits/evidence/p3/dollywood/taps.json`; `audits/screens/dollywood/map-typical-ipad-portrait-light.png`; `audits/screens/dollywood/map-typical-desktop-light.png` (the checker notes `audits/screens/dollywood/steps-typical-desktop-light.png` is a scrolled capture, so this one shows the fold).
