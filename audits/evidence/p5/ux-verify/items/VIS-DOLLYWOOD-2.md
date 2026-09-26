<!-- audits/03-apps/dollywood.md:717 · section "4. Issues and bugs" · area dollywood · kind VIS · rated medium -->
- **VIS-DOLLYWOOD-2 — 35 tap targets under 44 px on the phone, 15 on the iPad** (medium).
  - Phone: the 13 section chips (36 px tall), six tool and zoom buttons (32 px wide), nine coaster-legend items (17 px tall, tappable, `apps/dollywood.html:1148`), "?" (32×32), the sheet handle (22 px tall), Next unfinished (40 px), … (44×40), Compare (36 px), the exaggeration slider (20 px).
  - iPad: − and + (40 px wide), the legend items (17 px), "?" (32×32), … (37 px wide), Compare (36 px).
  - From the visual check: the card link buttons (Web ↗, Photos ↗…) are about 33 px tall and were not in the count, because it was taken with no card open.
  - Evidence: `audits/evidence/p3/dollywood/visual-measure.json` (`iphone-pwa.targetsUnder44`, `ipad-portrait.targetsUnder44`); `apps/dollywood.html:300, 302, 318, 328, 362`.
