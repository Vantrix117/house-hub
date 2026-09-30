# Batch 2c follow-up: who read today, kept from the first second (independent review)

The final run's patched check `e10-tv-reading-cache-2c` lost Eli's ✓ after an offline reopen made within about a second
of the board's first load. The first answer from `GET /api/f260/readers` came only at the first tick, and the ✓ the board
showed online came from the feed lines, which were not kept (`tests/repro-after/p6-2c__e10-tv-reading-cache-2c.txt`,
`p2/SYNC/e10-tv-offline-reopen-2c.png`).

Fix (index.html, the kiosk branch of `renderHome`):
1. `refreshFeed()` keeps the feed-derived readers for today (src `feed`) unless today's Worker answer (src `f260`) is
   already kept.
2. The board asks `fetchReaders(true)` as soon as it is built.
3. (Review round 1) `saveReaders` does nothing once the board is stopped, so a late answer after Switch cannot write
   `hub.tv.readers` again for the next session.

Round 1 (code reading): one LOW finding, the late answer after Switch (3 above), which was the only case it did not clear.
Clean on:
- either order of the feed and F260 answers, and the 5-minute and 1-minute refetches;
- midnight: yesterday's F260 answer fails the date check;
- a 404 Worker;
- the kitchen and non-kiosk Homes, which the change does not touch;
- network cost: no extra call, since the first tick skips its own fetch.

Round 2 (code reading): CLEAN. `saveReaders` is the only writer, and all three callers go through the guard. `tv.stopped`
is reset before any board code runs, so a rebuilt board still saves. A late answer after the next board has started is the
same household's data for the same day and is overwritten at once.

Re-runs on the final code (`followup/`):
- e10 copy 3/3 keep the ✓ (5/5 in `round1/`, before the guard);
- 30-rows copy: the offline reopen keeps the ✓;
- tvswitch copy: 0 fetches behind the picker;
- test-tv 76/0, test-home 57/0, test-hub 37/0, test-kitchen 55/0; parse-check 29/0;
- the tv capture on the final code is identical to the first 2c capture: 34 compared, 0 changed.
