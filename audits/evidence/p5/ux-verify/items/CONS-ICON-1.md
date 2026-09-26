<!-- audits/04-design-system.md:2979 · section "Icons (ICON)" · area system · kind CONS · rated medium -->
#### CONS-ICON-1 — Eleven icon families; no app uses the shell's own set (investigator rating: medium)

- The shell (F1-F3) is one custom 1.75 recipe. Each app brings its own:
  - F260: Feather/Lucide-derived paths at 2 on 18 px, a 20-grid tick at 2.6, colour emoji, text glyphs and CSS chevrons.
  - The Larder: inlined Lucide at 2-2.4.
  - Prayer: hand drawn at 1.75-2.4.
  - Kid Verse and Verses: hand drawn, computing 1.75.
  - The Dollywood template: hand drawn at 2-2.6, plus text glyphs and emoji.
  - Tally and Timer: none.
- `<use href="#i-…">` appears only in `index.html` (30 uses of a 21-symbol sprite) and in F260's private 11-symbol sprite (`static.json`; the re-measure's static check).
- The same meaning is drawn in several ways (Table ICON-4):
  - "Done": 5 SVG paths at 5 computed weights, plus a text ✓ in 5 areas.
  - "Star": 4 ways. The SVG star head and the text ★ chips sit in the same Kids card (`index.html:913-916`).
  - "Add": 4 ways.
  - "Previous / next": chevrons and text −/+ inside F260 (`apps/f260.html:617-620` vs `:692-694`).
  - "Book": 5 drawings; "timer" 3; "map pin" 3.
- Rendered stroke for icons of the same job (14-26 px) runs 1.02-2.86 px. The shell renders 11 sizes (Table ICON-2).
- **Expected (house style):** "One open-source icon set … consistent stroke weight and optical size in every app."
- **Evidence:**
  - `static.json`, `rollup.json`, Tables ICON-2 and ICON-4.
  - `audits/screens/f260/milestones-typical-iphone-pwa-light.png`: colour emoji, text ✎ and ♥, stroked printer and gear, text − and +, CSS chevrons and SVG ticks on one screen.
  - `shot-home-heads-midnight-ipad.png`: an SVG star head beside text ★ chips.
- **Reproduction:** `node audits/tools/phase4/ICON/static.mjs && node audits/tools/phase4/ICON/report.mjs`, then compare `strokeWidthsVbUnits`, `strokePxMin`/`strokePxMax` and `renderedSizesPx` per area.
- **Related (per-app mixes already noted, not re-filed):**
  - VIS-F260-12 and the F260 rubric row (`audits/03-apps/f260.md:775`).
  - VIS-KIDVERSE-9.
  - VIS-DOLLYWOOD-8.
  - The park map's icon-set row (`audits/03-apps/dollywood-live.md:778`).
  - Prayer (`audits/03-apps/prayer.md:953`) and Verses (`audits/03-apps/verses.md:617`).
  - P2 "Glyphs" (`audits/02-shell.md:5889`).

  New here: the cross-area count and the meaning-level duplicates.

