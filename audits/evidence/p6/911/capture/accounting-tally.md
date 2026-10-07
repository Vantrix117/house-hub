# Batch 11 (Tally): pixel-diff and contrast accounting (final run, code b346916)

Sources: `audits/evidence/p6/911/capture/pxdiff-tally-vs-prebatch.txt` and `pxdiff-shell-vs-8.txt` (tolerance 48 per channel), the final captures under `audits/screens-after/11/` (git-ignored, on disk at `C:/Users/ex_bo/OneDrive/Claude Related/App Hub/audits/screens-after/11`), the pre-batch Tally set in the session scratchpad (`cap11-before/tally/`) and batch 8's shell set (`audits/screens-after/8/shell/`). Contrast: `audits/evidence/p6/911/measure/failing-pairs/tally.json`, `failing-pairs/shell.json`, `nontext/tally.json`, `nontext/shell.json`, `glass.json`, `checks/contrast.txt`. Pairs I made to look at them are in `C:/Users/ex_bo/b11/status/pairs/` (before left, after right; not in the repo).

## 1. Tally pixels: 60 of 60 changed, which is the batch

`60 compared, 60 changed beyond tolerance 48.` Every shot moved because the page was rebuilt (dial and controls, name pill with a face, Reset, New counter, art plate), so there is no "unchanged" class and no noise question here. Share of pixels changed per shot:

| Family (shots) | Changed pixels |
|---|---|
| main-typical (10) | 7.6 % to 20.3 % |
| main-empty, main-loading, main-offline, main-overflow (8 each) | 5.6 % to 21.9 % |
| kid-typical (10) | 7.7 % to 28.1 % |
| kid-overflow (8) | 8.2 % to 28.6 % |

The largest changes are the landscape iPad and the desktop, where the dial grew from 360 px to about 543 px and the controls moved into a second column (SHAPE/verify V2 span 360 → 831 and 832 px).

What I opened myself, before and after: kid-typical-iphone-safari-light (the pill was on the dial's top edge, now a face and "Ezra's counter" clear above it; Reset a soft pill with the rotate icon, the dial smaller and the dashed ring visible; − and + one material), main-typical-ipad-landscape-dark (dial and controls side by side, the face pill, "New counter" under the controls, the art plate), viewer-timer-typical-ipad-portrait-light and switch-app-typical-iphone-pwa-light (the same page inside the hub's viewer). The independent rescore opened about a dozen more, on the code of its second pass (`rescore/tally.md`); four late changes came after it (see 06-section, "what the review changed"), so those are the shots I could not have it vouch for.

Not seen by anyone: the Undo toast, the counter list sheet, the multi-counter and room-mode states on a capture (the rig captures only the five fixed states per device); they are covered by `test-tally` and `tally-claims-11`, not by a picture.

## 2. Shell: 293 of 979 changed against batch 8

`979 compared, 293 changed beyond tolerance 48`, 629 identical, 57 "noise" (bytes differ, no pixel over the tolerance, so not a change by this rule). The 293 by group (each group's rows share a box or a pixel count across devices and schemes):

| Group | Shots | What it is | Opened |
|---|---|---|---|
| apps-* and app-blocked | 72 | the Tally tile's icon, a 36 to 42 px box (476 to 1042 changed pixels): the circle-plus redrawn as the hash glyph | yes, apps-kid-typical-iphone-pwa-light |
| viewer-typical, viewer-timer | 20 | Tally inside the hub's viewer (the "timer" jobs open "Tally counter"), 7 to 20 % of the pixels | yes, viewer-timer-typical-ipad-portrait-light |
| switch-app | 18 | the Tally frame behind the Switch-app sheet; the sheet itself is the same | yes, switch-app-typical-iphone-pwa-light |
| home-typical, home-guest, home-empty, home-loading, home-offline, home-overflow, home-park, home-timer, home-pull, first-visit (79) | 79 | the new Tally card on an adult's Home: Eli's phone carousel goes from 6 to 7 dots (the 172 to 180 px strips on the iPhone), a card beside the Timer on the iPad and desktop | yes, home-typical-iphone-pwa-light, home-typical-ipad-portrait-light, home-lower-empty-desktop-light |
| home-lower, home-bottom, home-rem (46) | 46 | the same card moving everything below it (the pair shows a text row 1 px higher, 8 800 to 10 600 changed pixels in the iPad groups; desktop 4 900 to 82 000 where the row of cards re-flows) | yes, home-lower-typical-ipad-portrait-light |
| home-kid (58) | 58 | a kid's Tally tile wears the count as a badge ("12"); the rows below move down about 2 px (12 627 px in each of the typical, lower, empty and offline shots) | yes, home-kid-typical-iphone-pwa-light |
| **Total** | **293** | | |

Check of the arithmetic: 72 + 20 + 18 + 79 + 46 + 58 = 293 (the home-* family and first-visit together are 183 = 79 + 46 + 58).

Judgement:
- **Every group I opened is Tally's.** I did not open each of the 293. The rest are held by group: identical boxes and pixel counts across the states of one device (for example the kid Home's 12 627 px in four states), which is what one deterministic change looks like; I found nothing in the file that is not one of the six groups above.
- **The Dollywood Build guide card is not in this diff.** Eli's Home carousel shows 7 dots, not 8: the capture fixture seeds no `dollywood` summary row, so the card does not render, and its pixels are not part of the 293. Whoever writes up batch 9 should not count it here.
- **"Noise" 57** is the tool's own class (no pixel over 48); I did not open those and do not claim they are the same 57 as batch 8's. Batch 8 recorded 12 of them.
- Not proven again: that the 293 would be the same on a second Windows run of this tree (there is no second capture of it).

## 3. Contrast: every sample below AA in the Tally and shell areas

Run: the three measure runs per area exited 0 (`measure/_exit.txt`); `contrast.mjs` (the palette gate) passes, 0 failing evaluations (`checks/contrast.txt`, `_exit.txt`).

### Tally: 4 text occurrences, 1 selector, all a disabled control

`failing-pairs/tally.json`: one selector per scheme (system light and system dark), 2 occurrences each, jobs `states/tally/main-empty-ipad-portrait` and `main-loading-ipad-portrait`:

| Selector | Text | Measured | Colours | Why |
|---|---|---|---|---|
| `button#reset.btn.btn-soft.reset > span`, light | "Reset" | 1.90:1 | #3440A8 on #D7DDFF | Reset is aria-disabled and dimmed to 0.4 at a count of 0 (empty) and while loading |
| the same, dark | "Reset" | 2.58:1 | #CAD3FF on #31365D | the same |

Disabled on purpose, so exempt from the 4.5:1 rule (WCAG 1.4.3, inactive components). At full strength the same token pair is 5.86:1 in light (#3440A8 on #CCD3FF, the declared fill) and 7.02:1 in dark (#CAD3FF on #373D69), computed by me from the declared colours. No Tally text sample fails while the control is live. Every other Tally text (the count, the pill, "New counter", "Counters · N", the Recent resets rows, "View only") sampled clean in all 36 jobs per run.

Non-text (`nontext/tally.json`: 267 icons, 17 below the threshold; 288 controls, 8 flagged; 2 graphics, 0 failing): all in the same off states.

| Group | Measured | Where |
|---|---|---|
| Reset's rotate icon on its soft fill | 1.83:1 light, 2.48:1 dark | count 0 or loading (off) |
| − glyph on the disc | 1.92:1 light, 2.66:1 dark | count 0 or loading (off) |
| + glyph on the disc | 1.91:1 light, 2.66:1 dark | loading, and the 999,999 overflow shot (off) |
| − and + discs against the page (boundary) | 1.05 to 1.18 | the same off states; the disc's fill, not its border, carries it |
| the kid pill's dinosaur emoji | 2.62:1 light, 2.91:1 Parchment | an emoji avatar's own colours beside the name |

The identified live icons are clean; the batch-1 disc fix (the person's strong tone with a light ink) holds. The tick ring is measured by the claims script, not this rig: 3.67 to 4.09:1 in all six palettes.

### Shell: 750 samples, 13 more than batch 8's 737, all Tally

`failing-pairs/shell.json`: 40 groups, 750 occurrences. Batch 8 had 737. The difference is exactly 13 occurrences of the same Tally selector, `frame:tally button#reset … > span` "Reset" (1.97:1 light on #FFC8DD, 2.55:1 dark on #613146), in the `viewer-timer-typical` jobs: those open Tally on Elizabeth's counter at 0, so Reset is off. Same disabled-on-purpose case as above.

The other 737 are batch 8's groups unchanged (the disabled PIN sheet and pad, Kids' rewards at a zero balance, the Timer card's recent-length buttons while loading, album captions over photos, the offline picker's edge samples, "Kind", the kid Home hero in dark); nothing this batch changed adds to them. I did not re-tally them group by group the way batch 8's accounting did; the arithmetic (737 + 13 = 750) is the check.

Shell non-text: the Home Tally card's + (`div#home-tally … button.btn-primary.btn-round`, 60 px) appears in 7 control groups (13 occurrences) in the loading shots, the 999,999 overflow shots and five theme-sweep shots. In the live state the identified measurement is clean: icon on fill 16.85:1 light and 14.72:1 dark (`iconIdentified`, overflow-count jobs). The flagged ones read a boundary of 1.00 to 1.01 and a fill ratio of 1.01 to 2.49; the theme-sweep ones have an icon ratio of 0 (the glyph was not painted at the sample), so I read them as samples taken before the card painted or while it was off, not as a finished card. I did not re-capture the card in those states to prove it.

### Conclusion

Real, resting, below AA in the Tally or Tally-on-Home areas: none found. Everything below the line is a control in its off state, an emoji avatar, or a sample taken before first paint.
