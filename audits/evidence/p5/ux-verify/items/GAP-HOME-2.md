<!-- audits/02-shell.md:660 · section "Home and launcher" · area shell · kind GAP · rated medium -->
**GAP-HOME-2 (medium; investigator only) — Verses writes a summary "for the Home card" that Home never reads.**
- `apps/verses.html:172, 238-243` writes `verses.summary {due, streak, boxes, …}`.
- `index.html` declares no `verses` channel (`:458-459`) and has no Verses card: NOT FOUND IN CODE.
- For adults, 6 of 9 apps have no Home presence: Tally, Timer, the build guide, the park map (except on park days), Kid Verse and Verses. For kids, 6 of 7 have none (`ia.json` noHomePresence).

