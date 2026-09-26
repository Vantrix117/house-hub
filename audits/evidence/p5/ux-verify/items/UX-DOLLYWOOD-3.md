<!-- audits/03-apps/dollywood.md:673 · section "4. Issues and bugs" · area dollywood · kind UX · rated medium -->
- **UX-DOLLYWOOD-3 — A phone's first screen is header, chips and parking lots; the park sits under the peeking sheet** (medium).
  - The map starts at y=470 and the sheet at 766 (viewport 884). 56 of 68 markers are under the sheet and 11 are in view. The chips wrap to 2 rows, and only 2 of 13 are fully visible.
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`phone.firstScreen`); `audits/evidence/p3/dollywood/phone-first-screen.png`; `audits/screens/dollywood/map-typical-iphone-pwa-light.png`. The checker agreed, noting that the park is mostly, not wholly, hidden.
