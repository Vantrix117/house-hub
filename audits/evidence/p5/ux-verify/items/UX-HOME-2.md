<!-- audits/02-shell.md:556 · section "Home and launcher" · area shell · kind UX · rated medium -->
**UX-HOME-2 (medium; investigator only) — On the TV the board's news is its smallest text.**
- The date kicker (`.hero-kicker` stays at `--fs-xs`, `apps/design.css:417`), face labels, ★ counts, feed times and bylines all fail H2 at 3 m on a 55" TV.
- The Visual section lists the same finding ("TV text is below 10-foot sizes", medium) and calls it the same as this item. This item owns it.
- **Kiosk iPad in portrait, feed cut to 2–3 words:** owned by the Visual section ("The kiosk board on an iPad", low), which measured how much of each line shows. HOME's `glance.json` (kiosk-ipad-portrait: feed text 26 px, 3.7 mm) and `glance-kiosk-ipad-portrait.png` are extra evidence for it.
- **Height, corrected by P2-VIS-02** (see Visual, which owns the overflow defect):
  - The typical board is 1088 px on a 1080 px screen, but the 8 px over is bottom padding only; content ends at y=1064.
  - Reminders start to drop off the bottom with 5–6 reminders, or on a day when everyone prays, with no "+N more" cue.
  - On the kiosk iPad the board is 1271 px (landscape) or 1419 px (portrait).
- Evidence: `glance.json` (kiosk-tv, kiosk-tv43, kiosk-tv65, kiosk-ipad-*), `glance-kiosk-tv.png`, `glance-kiosk-ipad-landscape.png`, `glance-kiosk-ipad-portrait.png`, `index.html:136, 153, 161-165, 171-172`.

