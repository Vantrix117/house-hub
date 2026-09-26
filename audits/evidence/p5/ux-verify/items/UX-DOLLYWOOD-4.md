<!-- audits/03-apps/dollywood.md:676 · section "4. Issues and bugs" · area dollywood · kind UX · rated medium -->
- **UX-DOLLYWOOD-4 — Below 1180 px, search results appear about 2,000 px from the search box, and a no-match search says only "0 of 145"** (medium).
  - Searching "zipline" on iPad portrait put the results list top at y=2506 (search box bottom 428, viewport 1132), with no empty-state message. A single match does fly to it and open its card ("thunder").
  - From the visual check: even where the results sit beside the field (desktop), a no-match search leaves the Listings panel blank apart from "0 of 145", with no message, suggestion or clear button.
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.searchNoMatch`, `ipad.searchOneMatch`); `audits/evidence/p3/dollywood/ipad-search-no-match.png`; `audits/screens/dollywood/search-none-typical-ipad-portrait-light.png`; `audits/screens/dollywood/search-none-typical-desktop-dark.png`.
