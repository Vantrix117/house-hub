<!-- audits/04-design-system.md:1408 · section "Type (TYPE)" · area system · kind VIS · rated medium -->
#### VIS-TYPE-1 — TV board: the kiosk block uses its phone-sized steps for information text; names, star counts, times and bylines are 18 px and the date 12 px (investigator rating: medium; extends P2's UX-HOME-2, not re-filed)

- **Owner.** Phase 2 already recorded the defect: UX-HOME-2 ("On the TV the board's news is its smallest text", medium, investigator only; `audits/02-shell.md:556-558`) and the VIS note "TV text is below 10-foot sizes" (`:5973-5977`). This item adds measurements and the token-level cause. It is not a second defect.
- **New facts.**
  - Re-measured live in System and Midnight, as eight size tiers (Table TYPE-6). Only the clock, verse refs and greeting are 10-foot sizes.
  - As iPad equivalents at 3 m on a 55-inch set: 18 px reads like 7.9 px on an iPad at 40 cm (9.35 px on a 65-inch), the 26 px feed lines like 11.4 px, the 22 px reminders like 9.7 px, and the 12 px date like 5.3 px.
  - The cause is the kiosk block (`apps/design.css:286-289`). It sets `--fs-sm` to 18, which the board uses for its information text (`index.html:153, 163`), and it does not re-map `--fs-xs` at all (`apps/design.css:417`). On a kiosk viewport 1050 px tall or less, the feed lines shrink further, to 22 px (`index.html:175`).
  - P2's own glance heuristic found that on a 65-inch set everything except the date reaches its bare-threshold test (H2), while on a 55-inch set the date and the 18 px text fail it (`audits/02-shell.md:543, 557`). The severity therefore depends on the set, which is not known (Not verified).
- **Expected (house style).** The kiosk is a 10-foot UI. Its smallest information text should subtend at least what the iPad floor does at arm's length, about 28-32 px at 1080p, and the date and names should never use the 12 and 18 px steps.
- **Why it matters.** The kids look for their stars and the parents look for who prayed, from across the room.
- **Evidence:** `remeasure-live-tv-board.json`; `remeasure-tvmath.json`; `report.mjs tv`; `audits/screens/tv/board-typical-tv-light.png`; `index.html:142-163, 175`; `apps/design.css:286-289, 417`.
- **Reproduction:** `node audits/tools/phase4/TYPE/report.mjs tv`.
- **Related:** UX-HOME-2 (owner), P2-VIS-02 (the board's overflow; must be solved by layout, not by smaller type).

