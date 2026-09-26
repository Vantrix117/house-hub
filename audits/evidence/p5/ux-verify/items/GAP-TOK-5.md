<!-- audits/04-design-system.md:765 · section "What design.css defines versus what the apps use (TOK)" · area system · kind GAP · rated medium -->
#### GAP-TOK-5 — There are no weight, z-index, opacity, breakpoint, press-scale, fluid-type or composite-glass tokens, so each area invents its own (medium)

- **Areas:** all 11.
- **What each area invents** (Table TOK-F):
  - **Weights:** literal weights in all 11 areas: design.css 20 (600 ×10, 700 ×7, 400 ×3), shell 26, F260 87 (800 ×16), Prayer 52, park map 40, Kid Verse 16.
  - **z-index:** nine unrelated ladders, from design.css 1/20/50/60 to Prayer 10-40.
  - **Breakpoints:** **16 distinct values**, or 18 counting min/max direction; none is shared by every area.
  - **Fluid display sizes:** one-off `clamp()`s (shell ×6, Tally, Timer, Kid Verse, Verses); nothing beyond `--fs-hero`.
  - **Press scales:** .86 to 1.06 across areas.
  - **Glass filter:** `saturate(1.4)` is retyped 25 times outside design.css (F260 6, Tally 6, Larder 2, Prayer 2, the Dollywood template 9).
  - **Glass shadow:** its five-part box-shadow is restated in the shell (index.html:261), Timer (:36), Prayer (:283-300), the Larder (:32-45) and Tally ×3.
  - Only the Dollywood template has composite glass tokens (`--lv-glass*`, apps/dollywood.html:215).
- **Expected.** design.css defines weight, layer, opacity, breakpoint, press and fluid display scales plus composite glass tokens, and the areas reference them.
- **Why it matters.** Without shared layers, overlays from different areas can collide; without shared weights, hierarchy drifts from app to app. Hand-copied glass diverges from the recipe the moment the recipe changes.
- **Evidence:** `literals-summary.json`, `literals-<area>.json` (fontWeight, zIndex, glassFilter hits with lines), `tokens-inventory.json` → `byCategory`, `remeasure.json` → `breakpoints`, `saturate14`.
- **Reproduction:** `node audits/tools/phase4/TOK/literals.mjs`.
- **Corrected** from the investigator's "21 distinct breakpoints". Its own list and its own `literals-summary.json` give 16 values (18 with direction); no reading gives 21.

