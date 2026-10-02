# Batch 5: every text-contrast sample below AA, accounted for (third and final run, final-5c, all three sets)

Source: `failing-pairs.json` and the per-area files `SCRATCH/final-5c/measure/agg/failing-pairs/<area>.json`. The repo's list is capped, so the per-area files were read.

## Verses: 12 samples (3 pairs × light and dark)
- Show, Read aloud and Record, each in `states/verses/trainer-loading-*` and `trainer-stalled-loading-*` (iPad portrait, light and dark).
- While the card loads, `paintLoading(true)` disables every trainer button on purpose (P3-VERSES-07: nothing can be rated before the data has landed).
- WCAG 1.4.3 exempts disabled controls.
- Nothing fails in a resting state.

## Shell: 31 pair rows, 725 samples (batch 1: 33 rows, 737 samples)

### Seen in batch 1's measurement
These are unchanged by this batch:
- The album captions over photos.
- `#pingo` Continue, which is disabled until the PIN is complete.
- The kid rewards card's Cash in and Reset week, disabled at a zero balance in the empty states.

### Not in batch 1's list
None of these is a style batch 5 changed. Batch 5's `index.html` diff touches only the Home card footers (`.gfoot`), the Verses card, the Notifications switch and the streak functions; the hero, PIN pad, picker and profile form are untouched. They come from shell work after batch 1 (batches 2a-2c), measured again here for the first time since batch 1.
- **`#pad.pin-pad.locked` buttons (light and dark, 20 samples).** The pad is locked after wrong PINs, so the buttons are disabled. Exempt.
- **The picker's profile cards while offline (27 samples, minP10 2.83).** The ink is `#221C17` on a median `#FEFEFD` card, about 16:1. The low figure is the 10th-percentile edge sample of the glass over the art, so the median passes. These are edge samples.
- **Profile edit "Kind" label (1 sample, minP10 3.63).** The median background is `#FEFEFE`. An edge sample.
- **The kid Home's hero text over the hero art in dark (14 samples).**
  - `.hero-sub`: 4.14:1 (system dark) and 4.01:1 (Forest).
  - `.hero-kicker`: 4.38:1 (system dark).
  - These are real, slightly under 4.5:1, and from batch 2a's kid Home hero, which batch 5 did not change.
  - **Found, not fixed:** it belongs to the shell. The fix is a scrim token under the hero text in dark.

Shell counts in final-5c are identical to the second run: 31 rows, 725 samples, the same selectors.
- Album captions: 578.
- `#pingo`: 45.
- Locked PIN pad: 20.
- Rewards buttons: 40.
- Offline picker cards: 27.
- "Kind": 1.
- Kid hero: 14.

The other shell captures that changed against batch 4: Apps 7 (60 px each, "Kitchen timer" anti-aliasing) and Chat 5 (14-24 px, timestamps). Every other change is a Home screen.
