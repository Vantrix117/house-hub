<!-- audits/03-apps/kidverse.md:700 · section "4. Issues and bugs" · area kidverse · kind VIS · rated medium -->
- **VIS-KIDVERSE-1 — Day-dot letters, 10 px badge hints and the unearned "50" glyph fail text contrast** (medium).
  - Rendered contrast (lib-vis `contrastSweep`, 430 px, kid and adult): day letters (`--muted-decor` on `--surface-2`) 2.22:1 Hearth, 2.09:1 Parchment, 2.08:1 Frost, 3.18:1 Midnight, 3.11:1 Forest, at 12 px on the kid card and 10 px in the adult panel; badge hints 10 px at 4.37-4.45:1; the unearned "50" glyph (22 px) 2.49-2.79:1. All primary text passes.
  - The checker measured the dark day-letter glyph at 2.79:1 against the card (the investigator's 3.1 was against the dot fill).
  - Evidence: `audits/evidence/p3/kidverse/visual.json` C; `audits/evidence/p3/kidverse/vischeck-dark-dots.json`; `audits/screens/kidverse/kid-stars-typical-iphone-pwa-light.png`; `audits/evidence/p3/kidverse/visual-C-kid-forest-rewards.png`.
