verify-icon-ink-dark-1: the batch 6 status writer's re-run of audits/tools/phase4/ICON/verify-icon-ink-hex-not-lifted-dark-1.mjs
on the final batch-6 working tree (after the second final run and the p4tools re-run), for the carry-overs CONS-ACCENT-2,
P4-ICON-01, GAP-TOK-3 and VIS-COLOR-1 (open since batch 1 only for the app tiles).

How it was run: a scratch copy (icon-ink-scratch-copy.mjs) that differs from the repo tool only in
  - importing audits/tools/lib/local.mjs by absolute URL,
  - writing its JSON and PNGs to the scratch folder (never into the repo), and
  - also recording, per icon, the nearest data-accent family ("fam") and the .app-icon computed background-image ("tileBg").
  NODE_PATH=%LOCALAPPDATA%/house-hub-audit/node_modules node icon-ink-scratch-copy.mjs midnight,forest,parchment
The outputs were then copied here unchanged. tile-oklch.txt is the OKLCH of the two --tile-bg stops read from those JSONs.

Batch 1's figures for the same tool (audits/evidence/p6/1/p4/ICON/): app tiles and per-app card heads 1.87-3.22 in Midnight
and Forest.
