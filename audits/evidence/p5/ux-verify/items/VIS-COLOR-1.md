<!-- audits/04-design-system.md:7309 · section "Contrast of every text/background pair in use (COLOR)" · area system · kind VIS · rated medium -->
#### VIS-COLOR-1 — The fills and tiles sit at about a third of the house chroma in all five palettes, two house hues are missing, and dark cards barely lift off the page (investigator rating: medium)

- **What happens** (Table COLOR-8):
  - **Soft fills.** They sit at the pastels' lightness (L 0.87-0.94, against 0.876-0.953) but at about a third of their chroma (C 0.008-0.070, against 0.057-0.093). Parchment's gold-soft, at 0.070, is the only exception. `--accent-soft` for the ten swatches is 0.004-0.047.
  - **Tiles.** They run pale to paler, a 22 % → 8 % tint over the surface (`apps/design.css:606-608`), instead of pastel to saturated. The icon ink is the raw app colour: Kid Verse's gold is 2.39-2.81 in light (new), and the Larder's and F260's are 1.95-2.33 in dark (P2).
  - **Hues.** Six earth families span hues 42-274°. Bubblegum (354°) and Lavender (303°) have no counterpart, and Sky (252°) and Periwinkle (278°) collapse into one slate.
  - **Other gradients.**
    - The hero runs within one hue, from 70 % white through the accent to `--accent-deep` (`apps/design.css:412`), and stays pale in dark (P2-VIS-06).
    - The page wash mixes two hues, the accent at 10 % and gold at 6 % (`:70-71`; the draft cited `:67-68`).
    - The `.bar` fill starts at 75 % tint + white (`:534`). That is why the bars read 2.27-2.99 against their tracks.
  - **Neutrals.**
    - Hearth's page is warm paper (H 77, C 0.011) at the lightness of iOS #F2F2F7 (H 286). Parchment is tan (L 0.89, C 0.039). Frost alone matches iOS.
    - In dark, the card-to-page step is 1.10-1.12, against iOS's 1.23, and the well is darker than the page (1.04).
- **Expected (house style).**
  - Pastel fills at C ≈ 0.055-0.095, with a deep ink of the same hue.
  - Tiles running pastel to saturated within one hue, with an AA ink.
  - All eight house hues available for profiles and chips.
  - Grouped grey with white cards in light; near-black with a card elevated 1.2:1 or more in dark.
- **Why it matters.** This is the house style's central colour rule, and the main reason every area scores 3-5 on Colour & palette.
- **Evidence:** `palette.json` (`themes.*.softChroma`, `houseFillChroma`, `neutrals`), `tiles.json`, `audits/evidence/p4/measure/nontext/shell.json` (`span.app-icon.ticon > svg.icon`), `audits/screens/shell/apps-typical-ipad-portrait-light.png`, `audits/screens/shell/home-typical-ipad-portrait-light.png`.
- **Reproduction:** `node audits/tools/phase4/COLOR/palette.mjs | grep 'soft C\|house fill chroma'; node audits/tools/phase4/COLOR/tiles.mjs`.
- **Related:** P2 VIS "The earthy Hearth palette, not the house pastels" (`audits/02-shell.md:5778-5785`), which measured Hearth and Midnight only. This extends it to Parchment, Frost and Forest and to the tiles.
  - **Merge note:** the ACCENT draft's ACC-10 covers the profile-colour side.

