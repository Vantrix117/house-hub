<!-- audits/04-design-system.md:5682 · section "Per-profile accent use (ACCENT)" · area system · kind VIS · rated medium -->
#### VIS-ACCENT-1 — The profile colours are neither pastel nor distinct enough as fills: the soft fills are near-grey, and 6 of 21 household pairs sit under ΔE00 5 as fills (investigator rating: medium)

- **The colours are mid-tones.** Every profile colour sits at OKLCH L 0.42-0.65: too dark to be a fill, too light and too grey to be an ink.
  - The house style's pastel fills are L 0.876-0.953 and C 0.057-0.093 (`audits/HUB-AUDIT-PROMPT.md:55-63`).
  - design.css's own `-soft` fills are only C 0.014-0.037 in Hearth (VIS-COLOR-1).
- **The derived `--accent-soft` is near-grey:** C 0.004-0.026 in Hearth (Eli's is #E6E6E9 at C 0.004), 0.005-0.019 in Frost, 0.024-0.047 in Parchment and 0.006-0.036 in Midnight (`tokens.json` `rows[].softChroma`).
- **The dark "glowing" ink is muddy.** `--accent-deep` in dark is C 0.031-0.086 (Elizabeth #BBA997 at 0.033, David #8E9F8E at 0.031); Timer's visual check saw the same (`audits/03-apps/timer.md:445`).
- **As fills, people run together.** 6/21 household pairs are under ΔE00 5 in Hearth even with normal vision (David / Mea 2.43, Mae / Elizabeth 4.1). Under colour-blindness the raw colours collide too: deuteranopia Elizabeth / Mea 2.1, protanopia Mae / Elizabeth 4.8 (Table ACCENT-7).
- **The picker offers only these ten mid-tones** (`index.html:449`).
- **Expected.** Each profile gets a distinct, vibrant pastel accent (fill + deep ink of one hue) that stays vibrant in dark (`audits/HUB-AUDIT-PROMPT.md:69-73`).
- **Evidence.** `tokens.json` (`lc`, `house`, `rows[].softChroma`, `pairs`), `cvd-strip.png`, `worker/seed.sql:4-11`.
- **Reproduction.** `node audits/tools/phase4/ACCENT/tokens.mjs` prints `lc` and the closest pairs; `node audits/tools/phase4/ACCENT/cvd-strip.mjs` draws the strip.
- **Related:** the P2 deviation "The earthy Hearth palette, not the house pastels" (`audits/02-shell.md:5778`), and VIS-COLOR-1 (the whole palette's chroma). This item is the person-colour facet.

