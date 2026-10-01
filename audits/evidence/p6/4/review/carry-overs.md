# Batch 4 carry-over check (batch-1 PARTIAL/DEFERRED entries)

Sources: `audits/tools/phase6/status.mjs` (J1 notes; batch 3 touched only CONS-MOTION-3/SHAPE-5/TYPE-7/MOTION-2 via W3c), `audits/05-findings.md`, `audits/04-design-system.md` (migration table ~8673, ICON-5/6 ~2627). `apps/f260.html` last changed in 80af987 (batch 1), so every F260 number from batch 1 still holds.
Fresh measurements (tools run on a scratch copy of the repo, so nothing was written into audits/): TOK/literals, TYPE/code-scan, ICON/static. Prayer's SHAPE/analyze figures come from batch 3's filed after run (`audits/evidence/p6/3/tests/repro-after/phase4__SHAPE__analyze.txt`), and its Pray now move from `audits/evidence/p6/3/rescore.md:43`.

Current counts. TOK/literals, total (with an exact token):
- **F260:** spacing 211 (66), radius 34 (23), color-mix 1, colour 17 (all of them the bootstrap map).
- **Prayer:** spacing 170 (55), radius 18 (15), local literal `--size` 7, color-mix 1, colour 23 (bootstrap plus the JS THEME_BG map).

TYPE/code-scan:
- **F260:** 56 token, 68 clamp/calc, 6 other.
- **Prayer:** 87 token, 0 px, 0 calc, 5 other (print pt).

ICON/static:
- **F260:** 28 glyphs, 13 emoji, stroke widths 2 / 2.5 / 2.6 / 3.5.
- **Prayer:** stroke widths 1.75 / 2 / 2.2, no emoji.

---

## P4-ICON-01
1. **F260:** nothing. The finding is about the shell's tiles and its per-app card heads, which are shell code, not apps/f260.html. The note gives it to 2a.
2. **Prayer:** nothing.
3. **Status:** not a batch 4 item. 2a appears to have done the work: apps.json has `hue`, and the tiles and card heads carry `data-accent` (index.html:1527, 1960). The J1 entry was never re-verified, though. Re-run `ICON/verify-icon-ink-hex-not-lifted-dark-1.mjs`; if it passes, the entry can close as FIXED, independent of batch 4.

## CONS-ACCENT-4
1. **F260:** nothing. Batch 1 already put the person's colour on Done, the ring and the progress.
2. **Prayer:** nothing. It already carried the colour.
3. **Status:** stays PARTIAL. Only the Larder is left (batch 8).

## CONS-ICON-1
1. **F260** (the note assigns batch 4): adopt the one shared set.
   - Replace the private sprite (f260.html:557-568, 11 symbols).
   - One weight, `--icon-stroke` 1.75. Today it uses 2 (`.ico`, :59), 2.5 (`svg.il`, :60), 2.6 (the CHECK on a 20 grid, :1319) and 3.5.
   - Use the `--icon-*` sizes instead of the literal 18 / 20 px.
   - No shared Lucide sprite exists yet: `icons/` holds only LICENSE-lucide.txt, and the shell has its own 22 custom symbols. So batch 4 must create the sprite, or define F260's symbols from Lucide at 1.75.
2. **Prayer: not done.**
   - It keeps its own drawn family in four weights: 1.75 on the nav (:743-747); 2 on the + (:737), the speaker (:2151) and `icon()` (:2171); 2.2 on the check (:1169); 2.3 on the hands.
   - It does not use the shared set. The batch 3 rescore confirms ICO-1 is not earned.
3. **Status:** stays PARTIAL. Prayer, Kid Verse (7), the Larder (8), batches 9 and 10 and the shell still own parts.

## CONS-ICON-2
1. **F260** (the note assigns batch 4): draw each meaning once, per Table ICON-6.
   - Streak = a Lucide `flame` instead of the 🔥 emoji (f260.html:1359, 1362, 1653, 1729).
   - Journal streak ✎ (:2109) = `pen-line`.
   - First verse ♥ (:1357) = `heart`.
   - The flame collision only goes away when the shell's feed stops using `i-flame`. It still does (index.html:765, 2086), and that half belongs to 2a.
2. **Prayer:** the note does not name Prayer, but Table ICON-5 does. The circle-plus Add tab (prayer.html:746) still collides with the Tally tile, and the batch 3 rescore keeps ICO-4 for it. **Not done.**
3. **Status:** stays DEFERRED/PARTIAL: the shell flame (2a), Prayer's circle-plus, and the park map's heart/AED (10).

## CONS-MOTION-1
1. **F260** (the note assigns batch 4): 56 of 102 controls press today. Put `.pressable` (0.97 + `--press-dim`) on all 102.
   - No press at all: the Plan/Journal switch, the 43 `#jbar` buttons and `.cur`.
   - Scale 0.94 but no dim: `#ygrid`, `.mark`, `.mkm`.
   - Scale but no dim: `.btn` (:235).
   - Background change only: `.rf-hd` and `.tundo`.
   - The hover filters are literal `brightness(1.08 / 1.06 / .92)` (:506-513).
2. **Prayer: not done.** Prayer has no `.pressable` and no `--press-dim`. Instead:
   - `.mark` scales to .86 (:127), `.fab` to .94 (:338) and `.kid .prayed` to .96 (:521).
   - `button.act` and `#pray .ctrl` move by `translateY(1px)` (:247, :421).
3. **Status:** could become FIXED once F260 and Prayer both adopt it. Every other area adopted it in batch 1.

## CONS-MOTION-4
1. **F260** (the note assigns batch 4): the week stepper moves 317 px (iPad) / 514 px (iPhone) as data lands, with 9 landmark moves. The stepper is `.tools` (:232): `#jumpBtn`, `#wkMinus`, `#wkSel`, `#wkPlus`.
   - Under `body.f-loading`, reserve the height of everything above it: `#jbar`, `#ygrid` (52 cells), `#heat` (84), `#hero`, `#reflect`, `#miles`. Use skeletons or `--min-h-*`.
   - Target: MOTION/cls landmark moves 9 → 0.
2. **Prayer: partly.** Batch 3 added skeleton rows and stats (prayer.html:552-560). Pray now still moves about 65 px on the iPhone (about 14 px on iPad landscape; rescore.md:43).
3. **Status:** stays PARTIAL. Prayer's iPhone move remains, and nobody has re-run MOTION/cls since batch 1 for the shell's Home (313/418 px, 2a) or the TV (2c).

## CONS-SHAPE-1
1. **F260** (the note assigns batch 4): move `.hero` (:114, `--r` 16 px, pad 16/18), `.today` (:131, `--r-lg` 22, pad 18/18/16), `.reflect` (:192) and `.jcard` (:391) to the one content card: `--r-card`, `--pad-card`, `--material-solid-bg`, `--elev-card`. Today they use 1.5 px borders and `--lift` = e2.
2. **Prayer: not done.**
   - `.ledger` is `var(--r)` 16 px with padding 16/18 (:196).
   - The kid cards `.kid` are `--r-xl`, padding 22/24, `--lift` (:499).
   - `.ask` and `.prompt` are `var(--r)` (:278, :202).
   - None of them reads `--r-card`, `--pad-card` or `--elev-card`.
3. **Status:** stays PARTIAL. The Larder's row radius 12 belongs to batch 8.

## CONS-SHAPE-2
1. **F260: nothing left in code.** The note ("F260's 44rem/78rem unchanged") is stale:
   - `.wrap` already reads `--col-read` and `--col-wide` (f260.html:56, 475, since batch 1).
   - SHAPE/verify V2 spans 720 on the iPad and 1200 on the desktop.
   - Batch 4 only needs to re-measure and record it.
2. **Prayer: done in batch 3** (VIS-PRAYER-6/9/11): `.wrap`, `nav`, `.sheet` and Pray mode read `--col-narrow` (:68, :303, :344, :398). Small literal leftovers:
   - the kid `.wrap` is 40rem (:496);
   - `#kitchen .k-in` is 1180px (:436);
   - `#lock` is 19rem (:389).
3. **Status: can become FIXED** after batch 4's re-measure. Decide whether the kid 40rem stays or moves to `--col-read`.

## CONS-SHAPE-3
1. **F260** (the finding assigns each app's batch: F260 is batch 4): move spacing to `--sp-*`. The 4 px grid holds 36.8 % of macro spacing (SHAPE/analyze), with 211 spacing literals (66 of them have an exact token).
2. **Prayer: not done.** It holds 44.6 % on the grid (44.2 before batch 3), and its spacing literals rose from 142 to 170 with the new CSS (55 have an exact token).
3. **Status:** stays DEFERRED/PARTIAL: Prayer, the Larder (8), 9 and 10.

## CONS-SHAPE-4
1. **F260:** Done is already a capsule. Only its height is a literal `min-height:60px` (:158), which should read `--btn-h-lg`: a small change.
2. **Prayer: not done.** Pray now is `button.act`, with a `border-radius` of `var(--r-sm)` (12 px, :243) and a literal `min-height:60px` (:261). Pray mode's `.go` button (:~417) is also `--r-sm`. It is not a capsule and does not use `--btn-h-lg`.
3. **Status:** stays PARTIAL: the Larder's Log (8) and the build guide's tabs (9).

## CONS-SHAPE-6
1. **F260** (the note assigns batch 4): move the literal radii to `--r-*` roles:
   - 2 / 7 px on `.jbar` (:90, :93);
   - 4 px on `.ygrid` (:95);
   - 3 px on `.heat` (:105);
   - 6 / 8 px on the loading wells (:166-169);
   - 2 px on `.cf` (:288);
   - 6 px on `.refs a:active` (:309);
   - 3 px on `.jcard mark` (:401);
   - about 24 × `999px` → `--r-full` / `--r-button`.
2. **Prayer: partly.** The 26 px sheet now reads `--r-sheet` (CONS-SHAPE-5). Still literal:
   - `.cal span` 7px (:211);
   - `nav button` 18px (:346);
   - the new `.sk` 6px (:553).

   On SHAPE/analyze, 50.8 % of Prayer's large radii are on the scale (7 px: 2,820 hits, 18 px: 604).
3. **Status: can become FIXED** once F260 and Prayer's 7 / 18 / 6 are done. The template, the park map's kid scale and the Larder are already done.

## CONS-TELL-1
1. **F260** (the note assigns batch 4): 9 controls still compute `user-select: text`. They are links (`a.btn` `#heroOpen` :630, "Open passage" :2054, `.refs a`) and a label (`.wkpick label` :243 or the search label). Give them `user-select` and `touch-callout: none`.
2. **Prayer: not done.** The row bodies `div.body` (markup :1170, CSS :133) are tappable (cursor: pointer) but have no role and no `user-select: none`. There are 10 text-selectable controls.
3. **Status:** stays PARTIAL. Batches 9 and 10 own the rest, and a long-press on a real iPad is still needed.

## CONS-TOK-1
1. **F260** (batch 4, per the migration table): delete the alias block (f260.html:31-36) and `body.nt { --paper }` (:46), then retarget the reads:
   - `--paper` → `--bg`: 2 reads;
   - `--raised` → `--surface`: 19;
   - `--sunk` → `--surface-2`: 16;
   - `--ink` → `--text`: 18;
   - `--ink2` → `--text-2`: 20;
   - `--rule` → `--line`: 22;
   - `--rule-soft` → `--separator`: 6;
   - `--hover-base` → `--hover`;
   - `--lift` / `--lift-lg` → `--elev-card` / `--elev-float`: 13 / 1 (a value change: e2 becomes e1);
   - `--serif` → `--font-serif`: 6.
2. **Prayer: not done.** Its alias block (prayer.html:41-50) is still there: `--paper`, `--raised`, `--sunk`, `--ink`, `--ink2`, `--rule`, `--rule-soft`, `--dim` (0 reads), `--lift`, `--lift-lg`, about 63 reads in all. The migration plan (04:"Then one app per batch… deletes that app's local aliases") put this in batch 3.
3. **Status:** stays PARTIAL: the Larder (8).

## CONS-TOK-2
1. **F260** (the note assigns batch 4): F260 keeps its own `.btn` (about 54 references), `.row`, `.seg` (13), `.switch`, `.sheet` and `.toast`/`.toasts`, and has two segmented controls of its own (`.seg` and `.switch`). Move to the one segmented control and shared component names; layout and ids stay.
2. **Prayer: not done.** It still has `.chip` (23), `.small` (27), `.pill`, `.sheet`, `.switch` (its own segmented control, :83-86) and the `.toast`/`#toast` rules.
3. **Status:** stays DEFERRED/PARTIAL: Prayer, 9 and 10.

## CONS-TOK-3
1. **F260:** 1 recipe is left, the hidden text's text-shadow `color-mix(--ink 40%)` (f260.html:438). Move it to a token. The note does not assign this recipe to any batch, but it is F260's.
2. **Prayer:** 1 recipe is left, the `@supports not` fallback `color-mix(surface 96%)` (:373). Its nav/sheet glass also copies design.css's pickup recipe (:361) instead of reading `--glass-pickup-layer` / `--glass-bg-strong`. **Not done**, and not assigned either.
3. **Status:** stays PARTIAL. The template still has 25 recipes per export (9/10), the shell 2 (2a), Kid Verse and Verses 1 each.

## CONS-TYPE-1
1. **F260** (D6, the app's own batch): drop the in-viewer duplicate title h1 "F260 Reading Plan" (f260.html:577); the viewer bar already names it. Any title that remains takes the 34 bold large-title role; today's h1 is `calc(30px * --ts)` at 700 (:62).
2. **Prayer:** nothing assigned. Its h1s are view titles ("Everything on the list" …), not the app name.
3. **Status:** stays PARTIAL: "The Larder Ledger" (leftovers.html:174, batch 8) and "Kitchen timer" (timer.html:88, batch 6).

## CONS-TYPE-2
1. **F260** (the note assigns batch 4): 68 sizes are `calc(Npx * var(--ts))` instead of role tokens (code-scan clamp/calc 68). They include h1 30, `.sub` 14, the strip 14 / 21, the hero streak 13.5 / 18, the hero title 26, `.tdone` 18 and the week head 18 / 14.5. Move them to the `--fs-*` roles, as Prayer did in batch 3.
2. **Prayer: done in batch 3** (via CONS-TYPE-7): code-scan now reads 87 token, 0 px, 0 calc. The 5 "other" are print pt sizes.
3. **Status: likely FIXED** after batch 4. First confirm with code-scan that the template's 143 clamp/calc sizes are role-derived, as batch 1 claimed.

## GAP-ICON-2
1. **F260** (the note assigns "GAP-ICON-2 (set)" to batch 4): replace F260's Feather/Lucide-derived private sprite (:557-568) with the shared Lucide set. The shipped notice already names F260's sprite. This is the same work as CONS-ICON-1.
2. **Prayer:** not named.
3. **Status:** stays PARTIAL. The notice does not yet name the template's paths (9/10), and the shell's custom set is not replaced (2a).

## GAP-MOTION-1
1. **F260** (batch 4): the same 9 landmark moves as CONS-MOTION-4 (the stepper, 317 / 514 px). Fix them with stable heights while loading.
2. **Prayer:** not named.
3. **Status:** could become FIXED if F260 reaches 0 and the shell's Home moves (313 / 418 px, 2a) are gone. 2a never re-ran MOTION/cls, so re-run it to decide.

## GAP-MOTION-3
1. **F260:** nothing beyond CONS-MOTION-1. Once `.pressable` is in, the F260 week button should press at 0.97 with a dim; today it is 0.94 with no dim.
2. **Prayer:** not named.
3. **Status:** stays NEEDS DEVICE CHECK (a real iPhone and iPad).

## GAP-TOK-4
1. **F260** (the note assigns batch 4): spacing 211 literals (66 exact) and radius 34 (23 exact) move to tokens that scale by kind, through `--space-k` / `--shape-k`. The same code serves CONS-SHAPE-3/6; the type half is CONS-TYPE-2's 68 calc sizes.
2. **Prayer: partly.** Its sizes are now roles (batch 3). Still literal: spacing 170 (55 exact), and 7 local `--size` px avatar sizes (:146, 511, 526, 546, 582, 587, 589) that do not scale by kind.
3. **Status:** stays PARTIAL: the template (9/10).

## GAP-TOK-7
1. **F260:** nothing. Its 17 colour literals are the bootstrap map; the rest are print-only named colours (:522-547).
2. **Prayer:** nothing assigned. Besides the bootstrap and print-only colours (:464-475), it keeps a JS `THEME_BG` hex map (:2070) that duplicates hub.js; optional clean-up.
3. **Status:** stays PARTIAL. The open part is the lint: screens-apps.mjs checks only `#hex` in `<style>`, and no batch owns extending it.

## GAP-TYPE-3
1. **F260:** nothing (code-scan under-11: 0).
2. **Prayer:** nothing (under-11: 0).
3. **Status:** stays PARTIAL: the template's SVG labels (9), and the sub-floor lint, which no batch owns.

## VIS-ICON-1
1. **F260** (the note assigns batch 4): ICON/static finds 28 glyphs and 13 emoji. Replace them with Lucide per ICON-6:
   - the milestone icons ⛰ ♪ ◐ ✝ ★ ✎ ♥ ✓ 📖 🔥 💯 📓 🏁 (:1355-1368);
   - the 🔥 streak (:1653, :1729);
   - the ✎ journal streak (:2109);
   - the ↗ external link (:630, :2054);
   - 🎉 (:786, :1474, :1684, :1711; :2088 is copied text and can stay);
   - ✓ / ★ inside toasts (:1739, :2070): optional, text.
2. **Prayer:** not named, and effectively done in batch 3. There is no emoji or glyph used as an icon (rescore): the ✓ became a drawn check (:1228) and the 🙏 fallback is gone.
3. **Status:** stays PARTIAL: Kid Verse (7), the Larder (8), the shell (2a), 9 and 10.

## VIS-SHAPE-2
1. **F260** (the note assigns batch 4): on the iPhone the week stripes hang 12 px from the edge (`.weeks { margin-left: max(-13px, calc(12px - var(--margin-left))) }`, :258). They should sit at `--margin` (20 px).
2. **Prayer:** not named. Minor: its phone margin is a literal 22 px (`.wrap` padding, :68), not `--margin`.
3. **Status: can become FIXED** after batch 4; the shell and the build guide were done in batch 1.

## VIS-F260-16
1. **F260:** no code is required. The modal already uses `--material-chrome-bg` at 90 % (:413). Optional: make the modal card solid (`--material-solid-bg`). The rig can prove a solid card, which would retire the device check.
2. **Prayer:** not applicable.
3. **Status:** stays NEEDS DEVICE CHECK unless batch 4 makes the modal solid.

---

## Batch 4 must do for F260 (apps/f260.html)
1. **CONS-TOK-1:** delete the alias block (:31-36) and `body.nt --paper` (:46), and retarget about 123 reads to the role tokens (`--lift` → `--elev-card` / `--elev-float`, `--serif` → `--font-serif`, `--rule-soft` → `--separator`).
2. **CONS-TYPE-2 (+ GAP-TOK-4 type half):** move the 68 `calc(Npx * var(--ts))` sizes to `--fs-*` roles (code-scan clamp/calc 68 → 0).
3. **CONS-TYPE-1:** drop the in-viewer duplicate title "F260 Reading Plan" (:577, D6); any remaining title takes the 34 bold large-title role.
4. **CONS-MOTION-1:** `.pressable` (0.97 + `--press-dim`) on all 102 controls (56 today). Swap the literal hover `brightness()` filters (:506-513) for tokens.
5. **CONS-MOTION-4 + GAP-MOTION-1:** the week stepper (`.tools` :232) must stop dropping 317 / 514 px. Reserve `#jbar`, `#ygrid`, `#heat`, `#hero`, `#reflect` and `#miles` under `body.f-loading`, so MOTION/cls landmark moves go 9 → 0.
6. **CONS-SHAPE-1:** `.hero`, `.today`, `.reflect`, `.jcard` (:114, :131, :192, :391) → `--r-card`, `--pad-card`, `--material-solid-bg`, `--elev-card`.
7. **CONS-SHAPE-3 + GAP-TOK-4:** spacing → `--sp-*` (macro grid 36.8 %; 211 literals, 66 with an exact token).
8. **CONS-SHAPE-6:** literal radii → `--r-*`: 2 / 7 / 4 / 3 / 6 / 8 px (:90, 93, 95, 105, 166-169, 288, 309, 401) and about 24 × `999px` → `--r-full` / `--r-button`.
9. **CONS-SHAPE-4:** `.tdone` `min-height:60px` (:158) → `--btn-h-lg`.
10. **CONS-TELL-1:** the 9 text-selectable controls (`a.btn` links :630 / :2054, `.refs a`, and the week or search label :243) → `user-select` / `touch-callout: none`.
11. **CONS-TOK-2:** F260's own `.btn` / `.row` / `.seg` / `.switch` / `.sheet` / `.toast` → one segmented control and the shared component names (layouts and ids stay).
12. **CONS-TOK-3:** the last `color-mix()` (:438, the hidden-text shadow) → a token.
13. **CONS-ICON-1 + GAP-ICON-2:** the shared Lucide set replaces the private sprite (:557-568), at one weight (`--icon-stroke` 1.75; today 2 / 2.5 / 2.6 / 3.5) and `--icon-*` sizes. No shared sprite exists yet, so batch 4 has to create one.
14. **VIS-ICON-1 + CONS-ICON-2:** glyphs and emoji → Lucide per ICON-6: milestones (:1355-1368), the streak as a drawn flame (:1653, :1729), ✎ (:2109), ↗ (:630, :2054), 🎉 (:786, :1474, :1684, :1711). Target: ICON/static F260 glyphs 28 / emoji 13 → about 0.
15. **VIS-SHAPE-2:** the week stripes (`.weeks` :258) sit at `--margin` (20 px on the iPhone), not 12 px.
16. **CONS-SHAPE-2:** no code. Re-measure (720 / 1200 on `--col-read` / `--col-wide` since batch 1) and correct the stale J1 note.
17. **Optional:** VIS-F260-16, a solid modal card so the rig can close it (otherwise it stays a device check). GAP-MOTION-3 stays a device check either way.

## Prayer parts batch 3 missed (not done in the current apps/prayer.html)
1. **CONS-TOK-1:** the local alias block is still there (:41-50: `--paper`, `--raised`, `--sunk`, `--ink`, `--ink2`, `--rule`, `--rule-soft`, `--dim` (unused), `--lift`, `--lift-lg`; about 63 reads).
2. **CONS-MOTION-1:** no `.pressable` and no `--press-dim`. Presses are `.mark` .86 (:127), `.fab` .94 (:338), `.kid .prayed` .96 (:521), and `translateY(1px)` on `button.act` / `#pray .ctrl` (:247, :421).
3. **CONS-SHAPE-4:** Pray now is `button.act` with `--r-sm` (12 px) corners (:243) and a literal 60 px height (:261). Pray mode's `.go` is also `--r-sm`. It is not a capsule at `--btn-h-lg`.
4. **CONS-SHAPE-1:** `.ledger` is `var(--r)` 16 px with padding 16/18 (:196). The kid cards (`--r-xl`, padding 22/24, `--lift`, :499), `.ask` and `.prompt` (:278, :202) are not on `--r-card` / `--pad-card` / `--elev-card`.
5. **CONS-SHAPE-6:** literal radii remain: `.cal span` 7px (:211), `nav button` 18px (:346), `.sk` 6px (:553). Large radii on the scale: 50.8 %.
6. **CONS-SHAPE-3 / GAP-TOK-4:** macro spacing on the grid is 44.6 % (unchanged). Spacing literals are 170 (55 exact). The 7 local `--size` px avatar sizes do not scale by kind.
7. **CONS-TELL-1:** the row bodies `div.body` (:1170 / :133) are still text-selectable, 10 controls in all.
8. **CONS-TOK-2:** it still has `.chip`, `.small`, `.pill`, `.sheet`, `.toast`, and its own segmented `.switch` (:83-86).
9. **CONS-MOTION-4:** Pray now still moves about 65 px on the iPhone as data lands (rescore.md:43; about 14 px on iPad landscape).
10. **CONS-ICON-1:** its own icon family in four weights (1.75 / 2 / 2.2 / 2.3), not the shared set or `--icon-stroke`.
11. **Not assigned by the notes, but open in the code:**
    - CONS-TOK-3: the `color-mix()` at :373 and the copied glass-pickup recipe at :361; `--glass-pickup-layer` / `--glass-bg-strong` exist.
    - CONS-ICON-2: the circle-plus Add tab (:746) still collides with the Tally tile.
    - Literal columns: kid `.wrap` 40rem (:496), `#kitchen` 1180px (:436), `#lock` 19rem (:389).
    - A 22 px literal margin (:68).

Done in batch 3 (for the record):
- CONS-SHAPE-2 (`--col-narrow`);
- CONS-TYPE-2 (every size a role);
- the Prayer half of VIS-ICON-1 (no glyph or emoji icons);
- the sheet part of CONS-SHAPE-6 (26 px → `--r-sheet`).
