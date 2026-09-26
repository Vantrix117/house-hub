<!-- audits/02-shell.md:566 · section "Home and launcher" · area shell · kind GAP · rated medium -->
**GAP-HOME-1 (medium; investigator only) — A running kitchen timer is visible only to its owner.**
- The pill reads `timer.active` from the signed-in person's own scope (`index.html:780, 786, 814`). The TV board has no timer pane (`index.html:1119-1128`).
- Elizabeth's 6:20 timer: `tv:tv: pill hidden | ipad-portrait:eli: pill hidden | ipad-portrait:mom: pill 6:20` (`leads-tvtimer.json`). Where it does show, it is 16 px (2.3 mm).
- **Same root cause as P2-PROF-08** (see Profiles), which owns the defect: switching people silences a running kitchen timer, confirmed 2/2. This GAP adds two things: the TV has no timer pane at all, and the pill is too small to read across the room.
- Expected: a running household timer is visible on the shared screens (the TV and the kitchen iPad), at a size that reads across the room.
- Reproduce: `leads.mjs tvtimer`.

