# Batch 6: every text-contrast sample below AA, accounted for (third and final run, final-6c)

Source: the per-area files `SCRATCH/final-6c/measure/agg/failing-pairs/<area>.json` (the repo's `failing-pairs.json` list is capped). The earlier runs' figures are in `tests/first-final-run/` and `tests/second-final-run/`.

## Timer: 43 samples, 16 rows (first run 115, second run 51)

**Disabled on purpose (exempt under WCAG 1.4.3): 36 samples.** In the loading state (`idle-loading`, `stalled-loading`) every control is disabled until the data has landed:
- "Loading…" on `#go`: 4
- the label field: 4
- the presets: 24
- Custom: 4

After the redesign, +1 min and Reset are taken out of the layout at idle, so they no longer sample.

**Covered by fixed bars: 7 samples.** The Home Timer card's ringing-row Stop (`span.tm-acts > button.btn-primary`) in `done-toast-typical-ipad-portrait-*`.
- The row is below the fold, under the floating ringing pill and the tab bar.
- The sampler read the page through those bars (measured background = the page colour, not the button's coral-strong).
- The capture shows the visible Stop, in the pill, as white on coral.

## TV: none.

## Shell: 737 samples

**Home Timer card's recent-length buttons in `home-loading`: 12.** Disabled on purpose while loading; exempt.

**The rest is as in batch 5** (`audits/evidence/p6/5/measure/contrast-accounting.md`):
- album captions over photos: 578
- `#pingo` disabled: 45
- locked PIN pad: 20
- rewards buttons at a zero balance: 40
- offline picker edge samples: 27
- "Kind" edge sample: 1
- the kid Home hero text in dark: 14 — real, found in batch 5 and not fixed; it belongs to the shell.
