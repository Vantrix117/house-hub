<!-- audits/03-apps/kidverse.md:663 · section "4. Issues and bugs" · area kidverse · kind UX · rated medium -->
- **UX-KIDVERSE-2 — Done ★ is below the first screen on iPhone, iPad landscape and desktop; "I heard it" is two screens down** (medium).
  - Standalone at 430×932 the scene art takes 274 px; Done ★ spans 851-935 px, so in the shell (48 px viewer bar) only its top edge shows; the stars card starts at 951 px, "I heard it" at 1713 px, on a 2304 px page.
  - iPad portrait shows Done ★ and the star count on the first screen (`taps.json` `doneAboveFold: true`).
  - Evidence: `audits/evidence/p3/kidverse/visual.json` P; `audits/evidence/p3/kidverse/visual-P-kid-iphone-first-screen.png`; `audits/screens/kidverse/kid-typical-iphone-pwa-light.png`; `audits/screens/kidverse/kid-typical-ipad-landscape-light.png`; `audits/screens/kidverse/kid-typical-desktop-light.png`.
  - Run: `node "audits/tools/phase3/kidverse/visual.mjs"` (P) and `taps.mjs`.
