# Batch 8: every text-contrast sample below AA, accounted for (final run, code 6688e17)

Source: the per-area files `measure/failing-pairs/<area>.json` (the repo's `failing-pairs.json` keeps only the 8 worst groups per area and theme) and the run logs `run-<area>-<themes|devices|states>.txt` (all exit 0, `_exit.txt`). The final run re-measured two areas: the Larder (`leftovers`) and the shell. The other per-area files (Dollywood, park map, F260, Prayer, Timer, Verses, Kid Verse) were not re-measured in this batch; they are the earlier batches' runs, read back by the aggregate, and were accounted for there (Kid Verse and the shell's earlier groups in `p6/7/measure/contrast-accounting.md`, Timer in p6/6, Verses in p6/5). The TV was not re-measured either (batch 8 does not touch it).

## The Larder: 0 samples below AA

139 jobs, 0 failed (devices 54, states 22, themes 63; `coverage.json`). Every progress line of the three runs reads `belowAA=0` (for example `texts=41/59 belowAA=0` in light and dark, Hearth, Midnight, Forest, iPad portrait; `texts=43/62 belowAA=0` for the finished state; `texts=29/43 belowAA=0` for the kid view), no `failing-pairs/leftovers.json` was written, and `failing-pairs.json` has no `leftovers` area. Batch 1's after-run had no Larder sample either, so the batch moved nothing into this list.

What this covers: the new Log in the person's colour (Eli periwinkle, Mae peach: white on their `--accent-strong`, about 5.9:1 in `larder-look-8.json` `logColours`), the mic in `--accent-ink`, the faces, the freshness chips with their icons, the use-by line, the banner that now names the oldest item, the amber sync line with Retry, the edit sheet (open state is not in the measure rig's states; the sheet's own colours are tokens) and the kid view.
Not measured: the open edit sheet, the swipe actions and the "N new or changed in the fridge · Show" pill (no rig state shows them); their colours are the same tokens as the card (`--success-*`, `--warning-*`, `--danger-*`, `--accent-*`).

## The shell: 737 samples, the same total and the same groups as batch 7

Nothing batch 8 changed in the shell (Home's fridge card, its hero line, the Kitchen glance, the Apps badge's label) appears below: the new wording ("1 use it up · 2 eat soon", "Nothing to eat soon") is ordinary ink on a solid card and sampled clean in every Home job. I tallied the file by selector and text: 578 + 45 + 20 + 20 + 12 + 27 + 1 + 14 + 20 = 737, group by group identical to `p6/7/measure/contrast-accounting.md`.

**Disabled on purpose (exempt under WCAG 1.4.3): 117 samples.**
- the PIN sheet's `#pingo` Continue before a PIN is typed: 45;
- the locked PIN pad: 20;
- Me → Kids' rewards Cash in (20) and Reset week (20) at a zero balance, in the `me-*-empty` jobs: 40;
- the Home Timer card's recent-length buttons in `home-loading` / `home-lower-loading`: 12.

**Album captions over photos: 578.** `figure.album-item > figcaption` over the photo (white 12 px text; p10 1.36:1 over the lightest part of a photo, median 5.37:1), as in batches 5, 6 and 7. Not touched by batch 8.

**Offline picker edge samples: 27** (`#profiles .pcard` names), unchanged. **"Kind": 1** (p10 only).

**The kid Home hero text in dark: 14** (`.hero-sub` "3 stars this week — ready to p…" 11, `.hero-kicker` "Tuesday, September 22" 3, p10 only, 4.01-4.38:1 against a median of 4.89-5.15:1). Real, found in batch 5 and still open; it belongs to the shell and is not a Larder text (the kid Home has no fridge card).

Total 117 + 578 + 27 + 1 + 14 = 737.

**Real and resting, below AA, in this batch's areas: none.** The run's other counts (Timer's 4 and 14 failed jobs in `coverage.json`) are the Timer's earlier run read back, the same figures as batch 7.
