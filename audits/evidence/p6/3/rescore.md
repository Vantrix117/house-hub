# Phase 4 scorecard, Prayer row rescored after audit batch 3

Independent judge. Method: `audits/04-design-system.md` lines 24-241 (shared bases + written rules TYP-1 … DEL-4, net adjustment per dimension clamped to ±2, cells 1-10 in 0.5 steps, row = mean of 11). The bases are `hearth-shared` **as re-priced in `audits/evidence/p6/1/rescore.md`** and are not re-priced here (other rows share them); only Prayer's own rule adjustments change. Typography and Shape stay provisional: the rig paints no backdrop blur and renders fallback fonts.

**History.** First judgement (on the first batch-3 capture): 5.4 → **5.5** (5.55), with Icons 5 → 4 for ICO-2 (🙏 emoji, text ✓, CSS chevron). After it, `apps/prayer.html` changed twice: those three were redrawn as one family of inline SVGs, and the Today header was tightened at ≥ 700 px. The whole final run was redone and all 809 Prayer screens were recaptured. **Final judgement below: 5.4 → 5.6.**

"Before" = batch 1's published Prayer row (5.4), checked against the pre-batch control `SCRATCH/cap3-before/prayer/*.png` (code after batches 1-2c). "After" = the final recapture `audits/screens-after/3/prayer/*.png` (809). Pairs opened: 33 against the first capture (Today, List, Record, Settings, Add, detail sheet, Share & print, Pray mode, Kitchen view and kid cards; light and dark; iPhone, iPad and desktop), then 18 against the final capture for the changed code: Today typical (iPhone, iPad landscape, iPad portrait dark, desktop), Today overflow iPad landscape, Today done (iPhone, iPad landscape dark), Today loading (iPhone, iPad landscape), unscheduled, family, List open (iPhone, desktop dark), Record, and kid (iPad light, iPhone dark, all prayed dark, empty). Composites are in `SCRATCH/rescore-3/` and `SCRATCH/rescore-3/final/`, outside the repo. Also used: `claims/6-kitchen-table.png` and `claims/5-today-overflow-ipad-landscape-*.png`. Measurements: `audits/evidence/p6/3/measure/*.json` against `audits/evidence/p6/1/measure/*.json`, `tests/repro-before` against `tests/repro-after` (layout, code-scan, literals, SHAPE/analyze, static-motion), and `claims/prayer-claims-3.json`.

## The row (final)

| Dimension | Base | Before (batch 1) | First judgement | **Final** | Rules (final) |
|---|---|---|---|---|---|
| Typography* | 6 | 5.5 | 6.5 | **6.5** | TYP-5 (TYP-2 lifted) |
| Colour | 5 | 5 | 5 | **5** | none (see policy call 1) |
| Layout | 6.5 | 5 | 5 | **5** | LAY-1, LAY-2 (LAY-3½ lifted) |
| Shape* | 6 | 6 | 6 | **6** | SHP-2, SHP-4 |
| Icons | 5.5 | 5 | 4 | **5** | ICO-4 (ICO-2 lifted again) |
| Motion | 4.5 | 5 | 5 | **5** | MOT-2½, MOT-5 (+1) |
| Dark | 6.5 | 6.5 | 6.5 | **6.5** | none |
| Native | 6.5 | 6 | 6 | **6** | NAT-2, NAT-3½, NAT-6 |
| Glance | 4.5 | 3.5 | 4.5 | **4.5** | none (GLA-3 lifted) |
| Ease | 6 | 5.5 | 6 | **6** | EOU-1, EOU-6 (EOU-2½ lifted) |
| Delight | 5.5 | 6.5 | 6.5 | **6.5** | DEL-1 |
| **Average** | | **5.4** (5.41) | 5.5 (5.55) | **5.6** (5.64) | +0.2 |

## Changed cells (batch 1 → final)

- **Typography 5.5 → 6.5: TYP-2 lifted.** Every font size is now a role. In the code, 63 calc sizes and 5 tokens became 87 tokens with 0 calc and 0 literal sizes (`tests/repro-after/phase4__TYPE__code-scan.txt`). Rendered distinct sizes fell from 51 to 34, and the share on a Dynamic Type size rose from 5.1 % to 24.3 % (`measure/type.json`). That is level with the shell (34, 25.9 %) and the Larder (22, 24.1 %), and neither is charged. TYP-5 holds: kid titles are 33.6-37.6 px (`phase3__prayer__layout.txt`).
- **Icons 5 → 4 → 5: ICO-2 lifted again in the final code.** In the first capture the kid Pray button carried a colour emoji 🙏, "All prayed" a text ✓, and the category groups a CSS border chevron (three families beside the strokes). In the final code, `icon()` (`apps/prayer.html:2163-2173`) draws the hands, the check and the chevron as 24-unit, round-cap, `currentColor` SVGs, and each is aria-hidden beside a word:
  - the hands on the kid Pray button, with a soft palm fill (`final/kid-typical-ipad-portrait-light`);
  - the drawn check after "All prayed" (`final/today-done-typical-ipad-landscape-dark`);
  - the drawn chevron on the category groups (`final/list-open-typical-iphone-pwa-light`).

  A scan of the file finds no emoji or text glyph outside comments; the kid-card 🙏 fallback avatar is gone too. So Icons returns to its batch-1 value: base 5.5 with ICO-4 (the ⊕ Add tab against the Tally tile). ICO-1 is not earned: computed weights are still 1.75 on the nav, 2, 2.2 on the check and 2.3 on the hands, and Phase 4 withdrew ICO-1 from Prayer for four weights.
- **Glanceability 3.5 → 4.5: GLA-3 lifted.** On the iPad the Kitchen view now shows 44 px requests and a 64 px list name, readable from 1.19 m and 1.73 m (was 0.73 m and 1.08 m; `phase3__prayer__layout.txt` readable m), in two columns on landscape. Something now clearly reads beyond about 1 m. GLA-1 is not earned (it needs 2-3 m by measured distance).
- **Ease of use 5.5 → 6: EOU-2½ lifted.** Toast Undo went from 36×44 to 64×44, category Rename/Remove from 55×31 to 71×44, and Pray Close from 45×33 to 71×44 (`measure/targets.json`: small selectors 12 → 10; the rest are labels, not controls). The rotation chip at 42×45 remains, but Phase 4 already ruled it a 1 px width miss that does not drive the rule. EOU-1 holds (Pray now is 60 px on the first screen). EOU-6 is kept as in batch 1: its Phase 4 reason is not recorded per area, and no fix names it.

## The Today header change (VIS-PRAYER-6), re-judged

- **What changed.** At ≥ 700 px the date/plan line is now one line with an ellipsis, the headline is one line, and the stats are one row. On iPad landscape with the overflow seed, 3 requests now sit fully above the nav, against 1 before the batch (claim 5: `claims/5-today-overflow-ipad-landscape-light.png`, `final/today-overflow-ipad-landscape-light`). The typical seed shows 4 rows on the iPad, and on desktop the list starts at about y 245 instead of 297 (`final/today-typical-desktop-light`). Pray now sits at y 236 instead of 291 on the iPad and 228 on desktop (layout.mjs).
- **Layout holds at 5.** LAY-3 was already lifted, so the extra rows move no rule. LAY-1 stays (macro spacing on the 4 px grid is 44.6 %). LAY-2 stays: the page is still a centred 552 px column that leaves over half of iPad landscape and desktop empty. The ellipsis on a long plan name ("Everything, every sin…") is a designed truncation, and the full name stays in Settings, so it is not charged as LAY-4 overflow.
- **Typography and Glance hold.** The headline size did not change: 31.4 px on the iPad (readable 0.84 m) and 28 px on the iPhone and desktop. It only no longer wraps at ≥ 700 px. It is still smaller than before the batch (34.7 px, 0.96 m on the iPad).
- **Motion holds at 5.** Pray now's move from the loading state fell to about 14 px on iPad landscape (`final/today-loading-ipad-landscape-light`). On the iPhone it is still about 65 px (`final/today-loading-iphone-pwa-light`), so MOT-2½ stays.

## Cells that held, and why

- **Colour 5.** Below-AA text is 162 occurrences, the same selectors as batch 1, and none is a resting pair. They are the disabled Mark answered, the disabled Back on Pray mode's first card, and the list-loading dim of the tab bar, the Mine/Family switch, Pray now and Share & print (`measure/failing-pairs.json`).
- **Shape 6.** No glass on content, so SHP-2 holds. Large corners on tokens are 50.8 %, so SHP-4 holds.
- **Dark 6.5.** No new dark-only failure.
- **Native 6.** Native selects remain: Active plan, Category, and the by-day multi-select listbox (NAT-3½).
- **Delight 6.5.** DEL-1 holds and is richer:
  - asker faces on family rows and in the detail sheet;
  - the kid's own face on its Prayed pill;
  - "Around the table" on the Kitchen device: a face row with a solid ring when joined and a dashed ring when not, not hue alone (`claims/6-kitchen-table.png`).

  DEL-2 is not awarded, because the Kitchen's "who did this" face sheet in the shell is an equivalent.

## Policy calls (stated so they can be overruled)

1. **COL-1 not awarded.** On its text Prayer meets COL-1, both in batch 1 and now: every resting pair passes in all seven theme keys, and the rest is disabled or loading dim, the exemption Kid Verse got in batch 1. Batch 1 did not award it, and batch 3 did not change the text data, so I hold it rather than re-open batch 1 here. Awarded, Colour → 6 and the row → 5.7 (5.73).
2. **GLA-3 lifted at 1.19 m / 1.73 m.** If "about 1 m" is read as covering the 1.19 m requests, GLA-3 stays and the row is 5.5 (5.55).

## Worse in batch 3 (final code)

- **The drawn category chevron is 2.91-2.96:1 in the light palettes** (`measure/nontext.json`, `svg.chev`); the CSS chevron it replaced was on `--muted-decor` (≥ 3:1). It is not the only carrier of open/closed (the rows show or hide), so COL-4 does not fire. It is a 0.1 fix to the ink. Prayer's icon-contrast count rose from 502 to 736 of 6,333 → 7,103 icons (heuristic).
- **The Today headline is smaller on the iPad than before the batch:** 34.7 → 31.4 px, readable from 0.96 → 0.84 m.
- **The pinned Add button sits over the lower form (Category, How often) at rest.** Scroll-padding keeps a focused field clear, so it is not scored.
- **By design, not scored:**
  - the finished Today no longer shows the gold streak cheer;
  - the Kitchen view is dark in the light theme too;
  - long plan names are ellipsised on the Today header at ≥ 700 px.

## Not judged without a device

- real blur on the sheet, the pills and Close;
- the SF faces;
- read-aloud on iOS;
- how the drawn hands read to a pre-reader at arm's length;
- "Around the table" on the real Kitchen iPad (seen only in the claim shot);
- the Kitchen view read from across the room (1.19 m is inferred from px);
- `hub.immersive` in the installed app, and the notch;
- iOS Safari honouring scroll-padding with the keyboard up;
- press states, springs and exits (the evidence is stills only).
