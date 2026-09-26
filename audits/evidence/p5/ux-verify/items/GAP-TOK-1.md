<!-- audits/04-design-system.md:661 · section "What design.css defines versus what the apps use (TOK)" · area system · kind GAP · rated medium -->
#### GAP-TOK-1 — The contrast gate checks 15 pair kinds; design.css's components paint 27 more, and 18 of those fail somewhere (medium)

- **Areas:** design.css, docs, the shell, Kid Verse, Dollywood, Verses.
- **What the gate checks.**
  - docs/design.html:285-307 builds 36 rows per theme: 7 neutral pairs, 4 chip ink-on-soft pairs, the opaque toast, and 3 accent pairs × 8 household colours.
  - scripts/test-design.mjs:47-53 and 101-112 asserts them for System light and dark, and per palette **only on a light-OS page**.
  - Every checked case passes: 0 fails in 12 runs of the guide's own `window.__contrast` (6 themes × light/dark OS), lowest 4.72 (Parchment, Kiara) (`guide-contrast.json`).
- **What it misses.** 27 further pair kinds that design.css's components paint (Table TOK-I). 18 of them fail somewhere, 229 of 486 cases:
  - text: the placeholder (2.49-2.79, all six scenarios);
  - text: `.badge` #fff on `--danger` in the dark palettes (2.55-2.61);
  - text: `--muted` on `--surface-2`, 4.37 in Parchment and 4.45 in Hearth. The token comment claims AA "on paper and cards" only (apps/design.css:47);
  - text: `--accent-deep` on `--accent-tint`, 4.23-4.30 for Kiara in the light palettes (the kid Home date kicker);
  - text: `--on-accent` on the hue mid-tones (gold 3.22, terra 4.41, olive 4.40);
  - large text: `--gold` as a large numeral, 2.96;
  - non-text: switch, focus, sync dots, bar and skeleton tracks, tint rings (13/60) and app-icon glyphs (32/60).
- **The gate also never runs:**
  - Hearth on a dark OS. The guide's `setTheme` copies hub.js, so on a dark-OS page `__setTheme('hearth')` paints exactly the Midnight numbers with `data-scheme="light"`. That is P2-VIS-03, invisible to the test.
  - The 2 guest-only swatches #8C4F7A and #4C7B6A (index.html:449, against the 8 at docs/design.html:253).
  - The 9 apps.json tile colours.
  - Every app's own pairs.
  - WebKit (the family's devices).
- **Caveat.** `.person-chip` (17/60) is used by no area today, and the tab-indicator row is not a failure by itself (U-TOK-1). The other 16 failing pairs are painted by shipped components.
- **Expected.** The gate enumerates every foreground/background pair the shared components render:
  - text 4.5, large 3, non-text 3;
  - in every palette, including Hearth on a dark OS;
  - for all 10 swatches;
  - in WebKit.
- **Why it matters.** CLAUDE.md tells future changes that the palette is proven AA ("WCAG AA on every text pair for all eight family colours in all five palettes"). The proof covers about a third of what is painted, so regressions in placeholders, badges, switches, rings and focus ship green.
- **Evidence:** `token-pairs.json` (summary and byPair), `guide-contrast.json` (12 runs; `dark-os/hearth` has `--bg` rgb(26,21,18) with scheme light), docs/design.html:253, 285-316.
- **Reproduction:** `node audits/tools/phase4/TOK/pairs.mjs && node audits/tools/phase4/TOK/guide-contrast.mjs`.
- **Related (not re-filed):**
  - P2-VIS-03;
  - P2-VIS-06;
  - VIS-VERSES-3;
  - Phase 2 UX, placeholder-only labels (`audits/02-shell.md:5803-5806`, 2.66/2.79);
  - Phase 2 VIS, dark skeletons (`audits/02-shell.md:5851`, 1.04 on bg);
  - the Phase 2 theme-card blurbs (4.45, measurement table).

