<!-- audits/04-design-system.md:741 · section "What design.css defines versus what the apps use (TOK)" · area system · kind GAP · rated medium -->
#### GAP-TOK-4 — Kid and kiosk scale only the tokenised subset; every literal size escapes them (medium)

- **Areas:** design.css, the shell, F260, the Larder, Prayer, the park map.
- **What the kind blocks scale** (apps/design.css:280-289):
  - kid overrides `--tap`/`--tap-lg`, `--fs-sm`…`--fs-hero` and five radii;
  - kiosk overrides only `--fs-*` and `--blur`.
- **What they miss:**
  - `--fs-xs` stays 12 px for both;
  - spacing and line-height never scale;
  - the TV keeps 44 px targets.
- **Everything literal escapes as well** (Table TOK-D):
  - font sizes: F260 0/122, Larder 0/16 (kid-visible), Prayer 5/65 (its kid block), park map 0/72 plus 45 base-rule literals (kid-visible);
  - target sizes: shell 17, F260 50, park map 30, Prayer 14;
  - the shell's `[data-kind=kid]` rules restate 64/84 px by hand instead of using `--tap`/`--tap-lg` (index.html:60, 124, 188).
- **Expected.** Every size a kid or the TV sees comes from a token that the kind blocks scale: type including `--fs-xs`, targets, spacing and radii.
- **Why it matters.** Kid mode and the 10-foot TV depend on the kind scale, but the Larder and the park map keep adult type for pre-readers.
- **Evidence:** `adoption.json`, `literals-shell.json` (cat targetSize), `tokens-inventory.json`, apps/design.css:280-289.
- **Reproduction:** `node audits/tools/phase4/TOK/usage.mjs && node audits/tools/phase4/TOK/literals.mjs && node audits/tools/phase4/TOK/adoption.mjs`.
- **Related (not re-filed):**
  - Phase 2 VIS, `--fs-xs` stays 12 in kid and kiosk (`audits/02-shell.md:5771-5773`);
  - `audits/03-apps/leftovers.md:995`;
  - `audits/03-apps/dollywood-live.md:817`.
  - New here: the cross-area measure, and the kiosk's missing target, spacing and radius scaling.

