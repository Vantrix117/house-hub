# Batch 7: every text-contrast sample below AA, accounted for (final run, final-7)

Source: the per-area files `measure/failing-pairs/<area>.json` (the repo's `failing-pairs.json` keeps only the 8 worst groups per area and theme). The final run re-measured three areas: Kid Verse, the shell and the TV (`run-<area>-<themes|devices|states>.txt`, all exit 0). The other per-area files in `failing-pairs/` (Dollywood 451, park map 551, F260 239, Prayer 163, Timer 43, Verses 12 samples) were not re-measured in this batch: they are the earlier batches' runs, read back by the aggregate, and were accounted for there (Timer in `p6/6/measure/contrast-accounting.md`, Verses in p6/5).

## Kid Verse: 13 samples, 10 rows (batch 1 after-run: 12 samples, 6 rows)

**Disabled on purpose (exempt under WCAG 1.4.3): 8 samples.** In the loading states (`kid-loading`, `kid-stalled-loading`, `adult-stalled-loading`, iPad portrait) both "Read it to me" buttons (`#say`, `#story-say`) are disabled until the family week has arrived (`setBusy(say, !wkOk)`, `apps/kidverse.html:662` and `:1184`; the same rule as before the batch). Batch 7 made them solid `btn-soft` (CONS-GLASS-2), so they now sample as the disabled soft fill: 6 in system-light (2.0-2.16:1), 2 in system-dark (3.13 and 3.32:1).
- Before the batch the same disabled buttons sampled as glass (`p6/1/measure/failing-pairs/kidverse.json`: 9 "Read it to me" samples), plus 3 on the stepper's text "−" / "+" (disabled until the week pulls). The stepper is now drawn with sprite icons, so its 3 samples are gone.

**Transient, sampled under a toast: 5 samples, all `p10Only` and flagged `suspect` by the tool.**
- `b#star-count` "0" in `kid-week-reset-typical-ipad-portrait` (system-light, Hearth dark, Parchment, Frost): 4 samples. p10 1.11-1.19:1 against `#2B2B2D` (the toast's dark fill fading in over the stars card), median 14.75-16.85:1. The resting capture shows the count in the card's normal ink (`audits/evidence/p6/7/rescore.md`, Colour). New in batch 7 only in that the week-reset state now speaks and shows "Your star for today was reset" as a toast over the card; the count's own colours are unchanged.
- `#shelf-grid .shelf-card .rf` "Luke 23:34" in `kid-cashed-in-typical-iphone-pwa` (system-light): 1 sample. p10 1.85:1 against `#48484A`, median 13.91:1: the cash-in toast over the new earlier-weeks shelf (IMP-KIDVERSE-I1). Resting, it is ink on the solid card.

**Real and resting: none.**

## TV: none.

No `failing-pairs/tv.json` was written: every TV job measured 0 texts below AA (`run-tv-themes.txt`, e.g. "texts=51/51 belowAA=0"), including the new no-week line "A grown-up will pick this week's verse."

## Shell: 737 samples, the same total and the same groups as batch 6

Nothing batch 7 changed in the shell (the Me rewards card's line and date, the TV verse pane) appears below.

**Disabled on purpose (exempt): 117 samples.**
- the PIN sheet's `#pingo` Continue before a PIN is typed: 45;
- the locked PIN pad: 20;
- the Me → Kids' rewards Cash in (20) and Reset week (20) at a zero balance, in the `me-*-empty` jobs: 40. These sit in the card batch 7 edited, but only the text line changed; the buttons and their disabled look are as before;
- the Home Timer card's recent-length buttons in `home-loading` / `home-lower-loading`: 12.

**Album captions over photos: 578.** `figure.album-item > figcaption` over the photo, as in batches 5 and 6.

**Offline picker edge samples: 27** (`#profiles .pcard` names), and **"Kind": 1** (p10 only).

**The kid Home hero text in dark: 14** (`.hero-sub`, `.hero-kicker`, p10 only, 4.01-4.38:1 against a median of 4.89-5.15:1). Real, found in batch 5 and not fixed; it belongs to the shell.

Total 117 + 578 + 27 + 1 + 14 = 737.
