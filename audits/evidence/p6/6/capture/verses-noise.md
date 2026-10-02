# Verses: why 37 shots differ from batch 5, though batch 6 did not edit `apps/verses.html`

Verses runs inside the hub's viewer and shows its bar. Batch 6 changed that bar and the timer rig seed. The 37 changed shots (`pxdiff-verses-vs-5.txt`) split into three groups:

- **14 kid iPhone shots** (kid, kid-revealed), in the bar band at the top. On phones, a kid's Back now shows only its arrow (the batch-6 viewer-bar fix).
- **20 nothing-due and practise-anyway shots,** in the bar band, 500-640 px each. Elizabeth's seeded timer uses the new contract, so the bar's timer chip shows a different time than in batch 5.
- **3 shots (2 done, 1 text-revealed).** The page is scrolled differently and the content is identical, opened and compared in the first final run (`tests/first-final-run/`). This is capture timing, as in `audits/evidence/p6/5/capture/f260-prayer-noise.md`.

None of these is a change to Verses itself.
