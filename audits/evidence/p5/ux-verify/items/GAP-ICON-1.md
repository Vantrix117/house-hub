<!-- audits/04-design-system.md:3052 · section "Icons (ICON)" · area system · kind GAP · rated medium -->
#### GAP-ICON-1 — The design system has no icon tokens, size scale, weight rule, ink rule or shared sprite, and the style guide shows one glyph (investigator rating: medium)

What `design.css` has:
- `.icon` at 24 / 32 px with a 1.75 stroke (`apps/design.css:602-603`);
- the `.duo` fill (`:605`, broken through `<use>`, P4-ICON-02);
- `.app-icon` (`:606-609`);
- `.btn .icon` at 1.25em (`:371`), `.tab .icon` at 26 px (`:563`) and `.empty .icon` at 48 px (`:546`).

What is missing:
- **A size scale.** The shell renders 14-53 px in 11 sizes; F260 renders 16-64 px.
- **A stroke rule.** Nothing keeps the rendered stroke constant: it runs 1.02-3.85 px in the shell.
- **An ink rule for icons on a tint.** `.app-icon` paints the base `--tint` (P4-ICON-01, -03).
- **Dark values for app and person colours.**
- **Kid and TV icon sizes.** The kid tab icons stay at 26 px.
- **A sprite apps can load.** The sprite lives inline in `index.html` only.
- **A themed select chevron.** The chevron is `#7D6F62` in a data URI (`:449`). It passes at 3.34-4.75 but never follows the theme.

The style guide's Icons section is four copies of `#i-plus`, each on a hex `--tint` (`docs/design.html:241-247`).

- **Evidence:** the cited lines; `rollup.json` `renderedSizesPx`, `strokePxMin`/`strokePxMax`.
- **Reproduction:** `grep -n "icon" apps/design.css`; `sed -n 241,247p docs/design.html`; `node audits/tools/phase4/ICON/report.mjs`.

