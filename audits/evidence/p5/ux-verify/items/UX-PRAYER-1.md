<!-- audits/03-apps/prayer.md:855 · section "4. Issues and bugs" · area prayer · kind UX · rated medium -->
- **UX-PRAYER-1 — The Add form's main button starts hidden under the tab bar** (medium).
  - When Add opens, "Add to the list" sits at y 846-904 while the nav starts at y 807 on the iPhone PWA and at 695 on iPad landscape; on desktop it is at y 843 with the nav at 775. It is visible on iPad portrait.
  - The person has to scroll to find the button that finishes the job.
  - Evidence: `audits/evidence/p3/prayer/layout.json` (`add.hiddenUnderNav` true on iphone-pwa, ipad-landscape and desktop); `audits/evidence/p3/prayer/layout-add-iphone.png`; `audits/screens/prayer/add-typical-iphone-pwa-light.png`; `apps/prayer.html:479-501`. Run `node "audits/tools/phase3/prayer/layout.mjs"`.
