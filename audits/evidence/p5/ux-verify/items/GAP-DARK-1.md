<!-- audits/04-design-system.md:4848 · section "Dark mode completeness (DARK)" · area system · kind GAP · rated medium -->
#### GAP-DARK-1 — Dark soft fills sit 1.01-1.22:1 from the card, so every soft-filled state goes muddy or vanishes; one token choice explains six per-app Phase 3 findings (investigator rating: medium)

- **What happens.**
  - In Midnight the semantic `-soft` tokens (`apps/design.css:163-168`) against `--surface` #241E19 measure:
    - mocha 1.10, gold 1.08, olive 1.07, teal 1.02, terra 1.01, slate 1.11;
    - Forest 1.02-1.10.
  - `--accent-soft` (`color-mix(accent 14%, surface)`, `apps/design.css:169`) measures 1.08-1.22 (Forest 1.08-1.21).
  - Every chip, disc, dot, rating fill and state pill built on these tokens fades into the card. Table DARK-3 maps the six Phase 3 findings this explains:
    - VIS-LEFTOVERS-3: chips 1.01-1.08;
    - VIS-VERSES-7: Not yet and Almost;
    - VIS-TALLY-1: discs 1.13-1.62;
    - VIS-KIDVERSE-3: badge discs 1.15, and the dots at 1.14;
    - Prayer's kid prayed and unprayed fills 1.06-1.16 (`audits/03-apps/prayer.md:955`);
    - VIS-F260-2, through `--sunk` (see GAP-DARK-2).
  - **Correction (re-measure):** low chroma is not specific to dark. Hearth's own soft fills are just as achromatic (C 0.014-0.037, against the house pastels' 0.057-0.093), so chroma is a palette-wide COLOR issue. What is dark-specific is the luminance step: 1.01-1.11 in Midnight against 1.16-1.21 in Hearth.
  - The inks meanwhile do glow as the house style asks: L 0.81-0.87, 8.9-10.4:1 on their fills.
- **Expected (house style).** Dark mode flips roles: the pastel glows and never goes muddy. Soft fills should read as tints, at about 1.4:1 or more from the card. State shapes that carry meaning should reach 3:1.
- **Why it matters.** Expiry states, rating choices, the tally buttons and the kids' progress dots all rely on the soft fill. For pre-readers the fill is the state cue. Under System, the always-on iPad runs dark every evening.
- **Evidence:** `palette-dark.json` (`semantics.midnight`, `semantics.forest`, `accents.*`, `house`); `remeasure-static.json` (`pal`); `audits/evidence/p4/SCORE/shots/forest/tally/main-typical-ipad-portrait-light.png`; `audits/evidence/p4/SCORE/shots/midnight/leftovers/main-typical-ipad-portrait-light.png`.
- **Reproduction:** `node audits/tools/phase4/DARK/palette-dark.mjs`. It prints `## midnight semantics` with teal 1.02 and terra 1.01, and accent soft 1.08-1.22.
- **Related (not re-filed):** VIS-LEFTOVERS-3, VIS-VERSES-7, VIS-TALLY-1, VIS-KIDVERSE-3, VIS-PRAYER-5 (empty calendar days), VIS-F260-2.

