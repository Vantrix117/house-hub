<!-- audits/03-apps/dollywood.md:669 · section "4. Issues and bugs" · area dollywood · kind UX · rated medium -->
- **UX-DOLLYWOOD-2 — On iPad and desktop, the card's Next and Show on map move a map the person cannot see** (medium).
  - `mapIntoView` returns early unless on a phone (`apps/dollywood.html:1140`).
  - On iPad portrait, with the card read at mid-screen, only the bottom 261 px of the 738 px map is on screen when Next changes the view; the page does not scroll (`scrollY` stays 924). On desktop the map is fully above the viewport while the card is read.
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.nextFromCard`, `desktop.buildCard`); `audits/screens/dollywood/step-on-map-typical-ipad-portrait-light.png`.
