<!-- audits/03-apps/tally.md:501 · section "4. Issues and bugs" · area tally · kind UX · rated medium -->
- **UX-TALLY-3 — Counting takes 3 taps from Home, and Home never shows the count** (medium).
  - Home → Apps → Tally tile → + is 3 taps for Eli on iPhone and Ezra on iPad. Home has no Tally card or button.
  - The entry is tile `small`, with no widget (`apps.json:7`).
  - It misses the brief's target of 2 taps or fewer for the most frequent job.
  - Evidence: `audits/evidence/p3/tally/audiences.json` (`tapsHomeToCounted: 3`); `audits/evidence/p3/tally/kid-apps-grid-ipad-portrait.png`.
