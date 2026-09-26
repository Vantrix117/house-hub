<!-- audits/03-apps/dollywood.md:714 · section "4. Issues and bugs" · area dollywood · kind VIS · rated medium -->
- **VIS-DOLLYWOOD-1 — Completed steps are struck through at 2.2:1 (light) and 3.5:1 (dark)** (medium).
  - `.bitem.ok` combines the dim colour, opacity .55 and a line-through (`apps/dollywood.html:100-101`). Rendered contrast of the 13 px text: Hearth 2.23, Parchment 2.31, Frost 2.26, Midnight 3.62, Forest 3.49 (AA needs 4.5). The checker confirmed the rows are barely legible.
  - Evidence: `audits/evidence/p3/dollywood/visual-measure.json` (`ipad.<theme>.card.failing`); `audits/evidence/p3/dollywood/ipad-card-hearth.png`; `audits/evidence/p3/dollywood/ipad-card-midnight.png`; `audits/screens/dollywood/steps-overflow-desktop-light.png`.
