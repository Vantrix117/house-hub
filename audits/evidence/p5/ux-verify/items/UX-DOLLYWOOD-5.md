<!-- audits/03-apps/dollywood.md:680 · section "4. Issues and bugs" · area dollywood · kind UX · rated medium -->
- **UX-DOLLYWOOD-5 — While the first pull loads, the guide looks like a first-time user and Mark done is live** (medium; the data loss is P2-SYNC-01).
  - On a fresh device with the pull held 5 s: "0 of 9 done", every chip 0/N, an enabled Mark done and no loading cue (L1). After the pull: "7 of 9 done". A tick in that window replaced the server row, 24 → 1 (L2).
  - Evidence: `audits/evidence/p3/dollywood/data-checks.json` (`L1.duringLoad`, `L1.afterLoad`, `L2.tickDuringLoad`); `audits/evidence/p3/dollywood/first-open-loading.png`; `audits/screens/dollywood/steps-loading-iphone-pwa-light.png`.
