<!-- audits/04-design-system.md:699 · section "What design.css defines versus what the apps use (TOK)" · area system · kind GAP · rated medium -->
#### GAP-TOK-2 — Only `--accent-deep` has an "on" colour; every other filled surface picks white or `--on-accent` by hand (medium)

- **Areas:** design.css, the shell, F260, Verses, the park map.
- **What happens.** `--on-accent` is the only "on" token (apps/design.css:92), and it is tuned for `--accent-deep`. Everything else is hand-picked:
  - **The badge.** `.ds .badge` paints `#fff` on `var(--danger)` (:515-516). But `--danger` (= `--terra`) is re-tuned light in the dark palettes. So the Larder "N to eat this week" badge on the Apps grid (index.html:703; 12 px bold) is 4.51 in Hearth, 5.66 Parchment and 4.94 Frost, but **2.61 in Midnight, 2.55 in Forest and 2.61 for Hearth on a dark OS**.
  - **The switch knob** is `#fff` on `--ok`: 1.97-2.02 in dark (P4-TOK-02).
  - **F260** defines `--on-solid: white` (apps/f260.html:26). It uses it on `--olive` for the daily Done (:144; 4.50 in Hearth, exactly at the edge) and on `--terra` (:392).
  - **Verses** pairs `--on-accent` with `--olive` for "Got it" (apps/verses.html:59; 4.40, VIS-VERSES-3).
  - **The park map** puts white on its wait tiles (apps/dollywood-live.html:500-501).
  - **Across the light palettes**, `--on-accent` on the hue mid-tones is: gold 3.22 / 4.27 / 3.96, terra 4.41, olive 4.40, teal 4.74.
- **Expected.** Each fill token has a paired, theme-tuned "on" token that passes 4.5:1 in every palette, and no component hardcodes `#fff`.
- **Why it matters.** The badge is the Apps grid's at-a-glance cue, on the Larder tile, that food must be eaten. In the dark palettes, and in System at night, a household member cannot read it. This meets the rule's "text a household member needs … on a primary surface": at least medium.
- **Evidence:** `token-pairs.json` pairs "#fff on --danger", "#fff knob vs --ok track" and "on-accent on --olive/--gold/--terra/--teal"; apps/design.css:459-460, 515-516; apps/f260.html:26, 144, 392; apps/verses.html:59; index.html:703.
- **Reproduction:** `node audits/tools/phase4/TOK/pairs.mjs`.
- **Related (not re-filed):**
  - Phase 2's unnumbered VIS item "The accent and tile icons are not lifted for dark" (medium; `audits/02-shell.md:5840-5846`) recorded the badge at 2.61. New here: Forest 2.55, Hearth on a dark OS, and the missing token as the root cause.
  - VIS-VERSES-3.

