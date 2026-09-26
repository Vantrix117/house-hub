<!-- audits/03-apps/dollywood-live.md:613 · section "4. Issues and bugs" · area dollywood-live · kind UX · rated medium -->
- **UX-DOLLYWOOD-LIVE-1 — The location-denied state is incomplete, and a kid gets adult "Settings › Safari" wording** (medium).
  - The missing designed state and its Set my spot chip were filed here first; the completeness critic reclassified that part as a bug against the code's own design, and it is now **P3-DOLLYWOOD-LIVE-17** (confirmed 2/2). What stays here is the wording.
  - Ezra, a kid whose beacon is on (so not view-only), gets the identical adult wording, "Location is off for this site / Allow Location for the Hub in Settings › Safari …" (`apps/dollywood-live.html:1404-1405`), which a 4- or 5-year-old cannot read or act on. The designed state's wording (`apps/dollywood-live.html:1267`) is adult too.
  - The truncation of this text on iPhone is P3-DOLLYWOOD-LIVE-10.
  - Evidence: `audits/evidence/p3/dollywood-live/theme-denied.json` (`C_deniedAdult`, `D_ezraDenied`); `audits/evidence/p3/dollywood-live/denied-adult-iphone.png`, `audits/evidence/p3/dollywood-live/denied-kid-iphone.png`. Lead `audits/01-leads.md:317`.
