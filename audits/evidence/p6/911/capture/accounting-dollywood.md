# Batches 9 and 10: pixel-diff and contrast accounting

Final run on the Windows PC (Playwright WebKit), code `b346916`. Sources: `audits/evidence/p6/911/capture/pxdiff-*.txt`, `audits/evidence/p6/911/measure/failing-pairs/`, `measure/aggregate.txt`. After captures are on disk at `C:/Users/ex_bo/OneDrive/Claude Related/App Hub/audits/screens-after/910/` (guide, park map) and `/11/` (the shell, Tally); batch 8's shell set is `audits/screens-after/8/shell/`; the pre-batch Dollywood sets are in the pre-batch scratchpad `cap910-before/`.

## Pixel diffs

### Build guide: 432 of 432 changed; park map: 722 of 722 changed (against the pre-batch captures)
That is the batch itself. Both exports were redrawn from one template (header, toolbar, chips, sheet, sticky bar, cards, tabs, icons, tokens), so no state can match. I opened the final captures for the entries' own claims (steps and map on the iPhone and iPad, layers, 3D, ride and coaster cards, the park map's meeting bar, denied pill and whole park), not each of the 1,154.

### The shell: 293 of 979 changed against batch 8
Method: `pxdiff-shell-vs-8.txt` lists 293 files; I clustered each file's changed pixels into boxes (24 px cells, 2-cell bridging, a session script), grouped them by screen, and opened before and after crops of one or two members of each cause. Within each group the boxes and pixel counts agree across the devices of the group, which is what one cause on one fixed layout looks like. Total 125 + 58 + 72 + 38 = 293.

| Cause | Shots | Groups | What the pairs show |
|---|---|---|---|
| **Adult Home: the Build guide card and the Tally card inserted** (a re-flow of everything after them, the At the park card moved) | 125 | home-typical 10, home-timer 10, home-park 10, home-guest 10, home-offline 8, home-loading 8, home-empty 8, home-pull 6, home-lower-typical 6, -overflow 6, -offline 6, -empty 8, -loading 8, home-bottom-overflow 6, home-bottom-typical 4, home-overflow 5, first-visit 4, home-rem-add-overflow 2 | `home-typical-desktop-light`: a Tally card (37, "Your count", Open Tally) beside Timer, then a full-width **Build guide** card ("Next: Planting, banners and signage · Entrance & Plaza · 7 of 9 done") where the feed started; `home-park-typical-desktop-light`: the Build guide card now sits between Timer and At the park, which moves right; `home-lower-typical-desktop-light`: the lower half is identical text shifted about 5 px; `home-typical-iphone-pwa-light`: the pager has 7 dots against 6 (the changed boxes are the dots at y 504-528); `home-overflow-iphone-pwa-dark` (17 px) and `home-overflow-ipad-portrait` (690 / 602 px): the extra pager dot behind the tab bar and the card read through the glass, "At the park" → "Tally". Nothing else on those screens differs. The Build guide card is the batch's (Dollywood: UX-DOLLYWOOD-1); the Tally card is batch 11's. |
| **Kid Home: the Tally tile's count badge** (Tally: kid tile) | 58 | home-kid-typical 10, -lower-typical 10, -empty 8, -offline 8, -overflow 8, -lower-overflow 8, -kid-park 6 | `home-kid-typical-iphone-pwa-light` (0,480 to 430,932): the Tally tile shows a "12" badge and its label moves up a few px; the Timer tile is unchanged. A kid's Home has no Build guide card (by design), so none of these is the guide. The overflow screens carry the same change over more rows. |
| **Apps grid and the blocked-app screen: the Tally tile** | 72 | apps-typical 10, -guest 10, -empty 8, -loading 8, -offline 8, -overflow 8, apps-kid 10, app-blocked 10 | `apps-typical-iphone-pwa-light` (box 240,216 to 288,264): the Tally tile's glyph changes from a circled plus to a hash mark; the Larder badge "3" and the other tiles are unchanged. The kid grid and blocked screen box (72,336 to 144,408) is the same tile. No Dollywood tile is among them (the guide and park map tiles did not change). |
| **The viewer and app switcher showing Tally** | 38 | viewer-typical 10, viewer-timer 10, switch-app 10, switch-app-kid 8 | `viewer-typical-iphone-pwa-light` and `switch-app-typical-iphone-pwa-light`: the open app is the redesigned Tally (a larger counter, a profile chip "Eli's counter", Reset and New counter). batch 11's. |

- **At the park card** (the batch's own change, P3-DOLLYWOOD-LIVE-06): its wording did not change in these shots (the rig's park seed is on the property); what moved is its place, from the Build guide card above it. `home-park-typical-iphone-pwa-*` changed 172-176 px, the pager dots only.
- **I called nothing noise.** There is no second Windows capture of this tree, so run-to-run noise could not be proven for any shot, and none of the 293 needed it: every one fell into a cause above by its box and, for the members I opened, by its pair. **Not opened:** the individual members of each group beyond the ones named (about 20 of 293 pairs seen); the assignment of the other members rests on identical boxes and pixel counts inside the group. The Kitchen Home is not in the capture rig.

## Contrast: every sub-AA group in my areas

`measure/failing-pairs/dollywood.json` and `dollywood-live.json`: text samples below their required ratio, at the 10th percentile of the sampled background (p10) and, where it says so, at the median too. Before (batch 8's final run on the pre-batch template, system light / dark / Frost): guide **143 / 142 / 27-53 in the named palettes**, park map **184 / 182 / 37**. After:

### Build guide: system light 54 occurrences in 14 groups, system dark 59 in 17; the named palettes 0

| Group | Samples light / dark | Ratio (p10; median) | Why it is not a defect |
|---|---|---|---|
| Loading screens (`map-loading`, `steps-loading`): the step list rows (`.bitem` number and title, 13 + 13), phase heads (8), Previous, Next, Show on map, Next unfinished, Mark done, the current row (2 each) | 48 / 48 | light 2.08-2.48, dark 2.76-3.50 (the median fails as well) | The loading state shows the controls disabled and dimmed on purpose, for a moment, with no data; the real screens do not. Transient and disabled. |
| Listing number badge `span.n` (91, 114, 62) over the map art | 3 / 3 | p10 1.63 light, 1.72 dark; median 6.47 / 11.43 | p10 only: the badge sits on the map art in the building, coaster and listing cards; the median reads fine. |
| `span.k` ("shopping") and a listing name over the same card | 2 / 4 | p10 2.44 and 4.17; median 9.6-16.6 | p10 only, same card. |
| OSM note `p.fact` in the coaster card | 1 / 1 | p10 2.35; median 9.85 | p10 only. |
| Selected Listings tab in the segmented control (`button.on`) | 0 / 2 | p10 1.02; one median 7.1 | A dark indigo label on a periwinkle selection, flagged where a translucent fill sat under a sample; a sampling artefact in the cross-section and search captures, to be re-read on a device. |
| Search card Mark done (`#sb-done`) | 0 / 1 | p10 | the hidden, fading sticky-bar button; the card's own button reads at full contrast in the same shot. |

Named palettes: Hearth light and dark are the two columns above; Parchment, Frost, Midnight and Forest show **0** failing text for the guide (the rescore had Forest 1). The batch 1 figure (27-53 per named palette) is gone.

### Park map: system light 35 in 2 groups, system dark 38 in 4, Frost 4 in 2, Midnight 1, Forest 1

| Group | Samples | Ratio | Why |
|---|---|---|---|
| `button#lv-rally > span.bl` ("Rally") | 34 light, 32 + 2 dark (iPhone only: 4 jobs each) | p10 1.02-1.08, median 1.11-1.14 | Not visible: below 600 px the label is a 1 px clipped span (`position:absolute; width:1px; height:1px; clip:rect(0 0 0 0)`) and the button is icon-only; the rig samples a background under a clipped box and reads 1.1:1. On the iPad and desktop the worded label is not flagged. A rig artefact, but a screen reader reads it. |
| Ride number badge `span.badge` / `span.n` on the orange `#FF6B4A` pill (137, 134, 143, 139) | 1 light; 3 + 1 dark; Midnight 1, Forest 1 | p10 1.31-2.48; median 6.31 on 137 | p10-only in the pop head; the number on orange (ink `#1C1714`) reads at the median. The `near-list` rows in Midnight and Forest read 1.35 and 1.40 at the median too (one sample each). Not changed. |
| Frost hero card captions ("Next ride · door to seat", "then") | 4 | p10 4.34 and 4.48, median 4.55 and 4.52 | Within 0.2 of 4.5 at p10 and above it at the median; p10 only. |

Information graphics and non-text under 3:1 (`measure/nontext/dollywood-live.json`): the directions step tiles (`.lv-step > span.g`, 1.25-1.33 against the row; the arrow and the words carry the turn), people's emoji marks (1.4-2.9, the faces carry the identity), and the `lv-who` ticks. The compass needle and N pass in all six palettes (park-c-10 section 11: N 7.54-11.42, needle 6.0-9.55) and the MIN label passes on all four bands (park-d-10 section 7). 0 text under 11 px in either area (guide 409 jobs, park map 642, none failed).

**Not measured:** contrast for household profiles other than Eli and the kids (accent colours on Rally, Set my spot and the selected tab); real backdrop blur (the rig has none, so glass-over-art samples are p10 pessimistic); the guide in dark palettes beyond Midnight and Forest's 0.
