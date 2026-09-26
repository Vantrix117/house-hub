<!-- audits/04-design-system.md:717 · section "What design.css defines versus what the apps use (TOK)" · area system · kind GAP · rated medium -->
#### GAP-TOK-3 — Profile and app colours are single light-theme hex values that never re-tune; as foregrounds in Midnight and Forest, 17 of 19 fall under 3:1 (medium)

- **Areas:** the shell, design.css, hub.js, the park map, the build guide.
- **What happens.** design.css re-tunes every hue family per palette (for example `--olive` #5B8143 → #9DC183 in Midnight). The person and app colours, though, are each one hex, stored in:
  - the profile row (worker/seed.sql:4-11);
  - the 10 guest swatches (`SWATCHES`, index.html:449);
  - the 9 apps.json tile colours;
  - the fallbacks `#8A6A4B` (apps/hub.js:461; index.html:450; ×9 in the park map's JS).

  hub.js writes the colour inline as `--accent` (apps/hub.js:80).

  As a foreground (tile glyph, ring, avatar ring, timer ring) it sinks in the dark palettes (Table TOK-J):
  - glyph on its own tile under 3:1 for 17/19 in Midnight and Forest, 8 of 9 app tiles;
  - ring on `--surface` under 3:1 for 7/19 (Eli 2.57, David 2.14, TV 1.95).

  9 of the 19 entries use one of 7 hex values that are not design.css values at all.
- **Expected.** Profiles and apps reference a hue family or a person-palette token whose fill, ink and foreground values are defined per theme. The accent then lifts in the dark palettes the way the hue tokens do.
- **Why it matters.** Pre-readers find apps by icon and colour, and System goes dark every night. The TV and the dark palettes lose the per-person colour cue.
- **Evidence:** `appcolours.json`, `tokens-resolved.json` (the default `--accent` is the theme's `--mocha`; a profile's accent is fixed), apps/hub.js:80, 461; index.html:449-450; `audits/screens/shell/apps-typical-ipad-portrait-dark.png`.
- **Reproduction:** `node audits/tools/phase4/TOK/tokens.mjs && node audits/tools/phase4/TOK/appcolours.mjs`.
- **Re-measure.** The counts agree exactly. They use the tile gradient's 22 % stop, its worst case (apps/design.css:607). At the 15 % mid-tone the counts are 13/19 in Midnight and Forest and 3/19 in Parchment.
- **Related (not re-filed):** the Phase 2 unnumbered VIS item (`audits/02-shell.md:5840-5846`), which covers the rings and 6 of 9 tile icons at 1.95-2.93.
  - New here: all 19 colours × 5 palettes, including Forest; 8 of 9 tiles at token level; the 7 hex values (9 of 19 entries) outside design.css; and the data-model root cause (a hex per person and per app).

