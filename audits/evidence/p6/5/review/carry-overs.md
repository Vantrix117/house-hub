# Batch 5 carry-over check (earlier-batch PARTIAL/DEFERRED entries with a Verses part)

Sources: `audits/tools/phase6/status.mjs` (every non-FIXED STATUS entry dumped, plus every note naming Verses / batch 5; J1 notes at :199-354, W4c at :531-595), `audits/05-findings.md`, `audits/04-design-system.md` (Table ICON-5/ICON-6 :2627-2700, migration table :8627-8734).
`git log --oneline -3 -- apps/verses.html` → 80af987 (batch 1), e72f6d0 (0e), d968db8 (0b). Verses has not changed since batch 1, so batch 4's after runs (`audits/evidence/p6/4/p4tools/out/*.txt`, JSON in `…/p4tools/p4/`, run on batch 4's final code) are its current numbers. TELL was not re-run in batch 4; its Verses row is batch 1's after run, and a static read confirms nothing in `apps/design.css` has changed it (the only `user-select` rules are :804 and :868, neither touches `.chip`). No tool was re-run for this check.
Every earlier-batch finding in 05-findings carries a status (none unstatused). The only Verses-area finding still open from an earlier batch is UX-VERSES-6 (batch 1, "the placement goes to the Verses batch (5)").

Current Verses counts:
- **TOK/literals:** colour 17 (all the bootstrap map, :9-10), color-mix 1 (:33), font size 1 (exact token), local literal 1, line height 2 (1 exact), shadow 4, blur 1, target size 6 (4 exact). Spacing 0, radius 0.
- **TYPE/code-scan:** 18 token, 1 px (`16px`), 0 clamp/calc, under-11 0.
- **ICON/static:** 9 inline `<svg>`, 0 sprite uses, own stroke width 1.25 ×1, glyphs 5 (… ×1, → ×4, all running text or comments), emoji 0.
- **MOTION/press:** 2/2 controls at 0.97 with a dim (Read aloud, Show; the ratings are `.ds .btn` and press through design.css:874).
- **MOTION/cls (150 ms):** iPad portrait 0 moves; iPhone 2 landmark moves, max 27 px.
- **SHAPE/analyze:** macro spacing on the 4 px grid 93.9 %; large radii 100 % on scale; 0 targets under 44.
- **TELL/tells-webkit (batch 1 after):** 18 controls, 16 compute `user-select: text`, all `span.chip.box`; 1 draggable image.

---

## CONS-TOK-3 (PARTIAL, batch 4)
1. **Verses:** 1 recipe, the page wash `color-mix(in srgb, var(--mint-fill) 60%, transparent)` (verses.html:33; TOK reports the declaration at :32). Replace it with a token. The simplest is `var(--mint-wash)`, which exists per hue and scheme (design.css:252). The alternative is one shared page-wash token that Kid Verse can reuse in batch 7. Target: TOK/literals verses mix 1 → 0.
2. **Others owe:** each Dollywood export 25 (9/10), the shell 2 (index.html, e.g. :606), and Kid Verse 1 (kidverse.html:32, the same butter pattern; batch 7).
3. **Status:** stays PARTIAL.

## CONS-TYPE-2 (PARTIAL, batch 4)
1. **Verses:** the one px literal is `.ds .top .pill .avatar { --size: 28px; font-size: 16px; }` (verses.html:47; code-scan `"16px": 1`). Drop the `font-size`, since design.css:1046 already sizes the emoji at `calc(var(--size) * .52)`, or move it to a role. Target: code-scan verses px 1 → 0.
2. **Others owe:** the Dollywood exports (143 clamp/calc plus 8 px each, 9/10) and Kid Verse 2 px (7).
3. **Status:** stays PARTIAL.

## GAP-TOK-4 (PARTIAL, batch 4)
1. **Verses** (not named in the note; found by TOK/literals): the same line, verses.html:47. The local `--size: 28px` (localLiteral 1) does not scale by kind. Use `--size: var(--icon-lg)` (28 × `--icon-k`), as Prayer did with its `--face-*` (prayer.html:53-58). Optional while there: `line-height: 1.1` (:99) → `--lh-tight`; `line-height: 1.2` (:123) has no token step. Target: TOK verses localLiteral 1 → 0, fontSize 1 → 0.
2. **Others owe:** the Dollywood exports' spacing 75 / 91 and font sizes 38 / 64 (9/10).
3. **Status:** stays PARTIAL.

## CONS-ICON-1 (PARTIAL, batch 4; the note lists "Verses (1.25)")
1. **Verses:** 9 hand-drawn inline SVGs, no sprite use. Replace each with `<svg class="sym" aria-hidden="true"><use href="../icons/sprite.svg#i-…"/></svg>`, mapping per Table ICON-6:
   - :153 speaker → `i-volume-2`
   - :154 eye → `i-eye`
   - :157 Not yet → `i-rotate-ccw`
   - :158 Almost → `circle-dashed` (not in the sprite yet; see CONS-ICON-2)
   - :159 Got it → `i-check`
   - :164 celebration star → `i-star`
   - :177 Your boxes → `i-chart-column`
   - :187 Due today → `i-list`
   - :189 Coming up → `i-clock`

   Two more changes:
   - **The star's 1.25 stroke** (:104): this is the 1.25 the note counts. Use `--icon-stroke` and keep the fill: `svg.sym` sets `fill: none`, so override it with `--star-fill` / `--star-stroke`.
   - **Literal sizes:** `.actions .btn .icon` 1.3em (:77), `.grown h2 .icon` 1.2em (:110) and the star 64 px (:104) move to the `--icon-*` sizes (`sym-md` / `sym-lg`; the star as a multiple of `--icon-xl`, so it scales by kind). The 64 px star is also a TOK targetSize row.

   Keep the Read aloud pulse working. Its selector `.ds .btn.say.on .icon` (:80) must follow the new class, and `speak()` (:339, :341) writes only the `<span>`, so it is unaffected.

   Target: ICON/static verses, uses 0 → 9, own stroke widths `{1.25:1}` → none.
2. **Others owe:** Kid Verse 1.5 (7), the Larder 2 (8), the Dollywood exports (15 widths, 9/10) and the shell's 22 own symbols.
3. **Status:** stays PARTIAL.

## CONS-ICON-2 (PARTIAL, batch 4)
1. **Verses** (from Table ICON-5, not the note):
   - **"Almost" is a minus** (verses.html:158; 04:2637, the Minus collision with subtract / zoom out / previous). ICON-6 maps it to Lucide `circle-dashed` (04:2662). The sprite has `i-circle-half`, but that is F260's "Halfway" milestone (f260.html:1463), so reusing it would make a new collision. Draw `circle-dashed` into `icons/sprite.svg` and add its name to `icons/LICENSE-lucide.txt`.
   - **The check and list paths** become the one `i-check` / `i-list` (04:2666, :2688; Prayer already uses `i-list`, prayer.html:788).
2. **Others owe:** the shell feed's `i-flame` (2a's half) and the park map's heart/AED (10).
3. **Status:** stays PARTIAL.

## CONS-MOTION-4 (PARTIAL, batch 4) and GAP-MOTION-1 (PARTIAL, batch 4)
1. **Verses** (not named in either note; found by MOTION/cls). On the iPhone, 2 landmark moves of 27 px as data lands: Read aloud 247 → 274 and Show 319 → 346. Batch 1 took them from 38 to 27 px, and the iPad from 13 to 0; batch 4's run has the same 27.

   The cause has not been measured. It is most likely the kicker row (`.trainer .kick`, :58, which reserves one 28 px row) wrapping to two rows on the phone once "Week 33 · verse 1 · 50 more after this" and the box chip "Box 3 · last 13d" arrive. Two rows come to about 18 + 8 + 28 = 54 px against 28 reserved, about +26 px.

   Fix it either way:
   - reserve the two-row height below 560 px; or
   - shorten the kicker so it fits one row. This batch's UX-VERSES-8 ("the same number three times") removes the "· N more after this" count anyway.

   Target: verses@iphone-pwa landmark moves 2 → 0.
2. **Others owe:** the shell's Home (33 moves, 391 px iPhone; 31, 403 px iPad), its Me (424 px) and the build guide (945 px, 9).
3. **Status:** both stay PARTIAL.

## CONS-TELL-1 (PARTIAL, batch 4)
1. **Verses** (not named in the note; from TELL/tells-webkit): 16 of 18 controls compute `user-select: text`, all `span.chip.box`. These are the queue's box chips (:430, :433) and `#boxchip` (:148), styled at :133.
   - Give `.ds .chip.box` `user-select: none` and `-webkit-touch-callout: none`. Alternatively, do it once on `.ds .chip` in design.css:1062.
   - The empty-state art (`<img>`, :171) has no `draggable="false"` or `-webkit-user-drag: none`. Batch 4 added both to F260 (:60, :683) and Prayer (:394).
   - TELL also counted 1 draggable image in the trainer state, most likely the pill's photo avatar from `hub.avatarHtml`. That is shared code, and this was not checked.

   Target: TELL verses text 16 → 0.
2. **Others owe:** two build-guide labels (9), one park-map link (10), and a long-press on a real iPad.
3. **Status:** stays PARTIAL.

## UX-VERSES-6 (PARTIAL, batch 1; the note gives the placement to batch 5)
1. **Verses:** the rating toast (`hub.toast`, verses.html:365, 2.2 s) still covers the box labels on the iPhone.
   - The bottom padding at :41-42 (whose comment claims UX-VERSES-6) only helps when the page is scrolled to its end.
   - `hub.toast` (hub.js:1072) has no placement option.

   Do one of these:
   - show the rating result in the trainer card itself, in an `aria-live` line, with no toast; or
   - make sure the stats card is not in the toast's band after a rating.

   It has to fit this batch's P3-VERSES-05 (the Not yet wording, :365) and UX-VERSES-2 (Undo for a mis-tapped rating, which would keep a toast up longer). Re-run `verify-critic-shared-toast-half-viewport-wrap-2` (iPhone).
2. **Others owe:** nothing; this is a Verses-only entry.
3. **Status:** **can become FIXED** in batch 5.

## CONS-GLASS-2 (PARTIAL, batch 1): optional Verses part
1. **Verses:** the note says the rig still counts "non-floating glass buttons (Read aloud …)" as content. Verses' content-live screens are 120, all the Read aloud glass button (VIS-VERSES-2 note).
   - Read aloud (:153) and Practise again (:167) are `.btn-glass`, with `--g: var(--glass-strong)` (:78), inside solid cards.
   - Making them a solid secondary button (plain `.btn` or `.btn-soft`) takes Verses' GLASS/layers count 120 → 0.
   - This is a judgement call: CLAUDE.md allows glass on "floating buttons", and these do not float.
2. **Others owe:** the chat's reply bubbles are still `bot glass-strong` (index.html:2624, shell), plus Kid Verse's Read it to me (kidverse.html:213, 226; 7) and the build guide's map controls (9).
3. **Status:** stays PARTIAL whatever Verses does.

## CONS-DARK-1 (PARTIAL, batch 1): optional Verses part
1. **Verses:** the finding's stopgap is "art sits on --art-plate meanwhile". Verses' empty-state art (`.ds .empty-art img`, :105 / :171; design.css:1102) is not on `--art-plate`; the Larder's is (leftovers.html:123). Add `background: var(--art-plate)` and a radius, here or once in design.css's `.ds .empty-art`.
2. **Others owe:** the art pipeline itself (`scripts/make-art.mjs` token fills, gap row DARK-10, no batch named).
3. **Status:** stays PARTIAL.

---

## Batch 5 must do for Verses (apps/verses.html)
1. **UX-VERSES-6:** the rating result must not cover the stats card on the iPhone. Show it in the card, or keep the stats out of the toast's band. Settle it together with P3-VERSES-05 (wording, :365) and UX-VERSES-2 (Undo).
2. **CONS-MOTION-4 + GAP-MOTION-1:** stop the iPhone's 27 px drop of Read aloud and Show. Reserve the two-row kicker below 560 px (:58), or shorten the kicker (with UX-VERSES-8). MOTION/cls verses@iphone-pwa moves 2 → 0.
3. **CONS-ICON-1:** the 9 inline SVGs (:153, 154, 157, 158, 159, 164, 177, 187, 189) become `svg.sym` sprite uses (`volume-2`, `eye`, `rotate-ccw`, `circle-dashed`, `check`, `star`, `chart-column`, `list`, `clock`).
   - The star (:104): `--icon-stroke`, not 1.25, filled with `--star-fill` / `--star-stroke`.
   - Sizes 1.3em / 1.2em / 64 px (:77, :110, :104) → `--icon-*`.
   - Update the pulse selector (:80).
4. **CONS-ICON-2:** Almost = Lucide `circle-dashed`, not minus and not `i-circle-half` (that is F260's Halfway). Add the symbol to `icons/sprite.svg` and its name to `icons/LICENSE-lucide.txt`.
5. **CONS-TOK-3:** the page wash at :33 → `var(--mint-wash)` (or a shared wash token). color-mix 1 → 0.
6. **CONS-TYPE-2 + GAP-TOK-4:** :47 → `--size: var(--icon-lg)`, with no `font-size: 16px`. code-scan px 1 → 0; TOK localLiteral 1 → 0. Optional: `line-height: 1.1` → `--lh-tight` (:99).
7. **CONS-TELL-1:** `.chip.box` (:133) unselectable, with no callout. Add `draggable="false"` and `-webkit-user-drag: none` to the empty art (:171). TELL verses text 16 → 0.
8. **Optional, CONS-GLASS-2:** Read aloud (:153) and Practise again (:167) become a solid secondary button instead of `.btn-glass` (:78).
9. **Optional, CONS-DARK-1:** the empty art on `--art-plate` (:105 / :171).
10. **Re-run** TOK/literals, TYPE/code-scan, ICON/static, MOTION/cls, MOTION/press and TELL/tells-webkit on Verses for the after column (on a scratch copy).
    - The ICON-6 "Read aloud" row is shared with Kid Verse (kidverse.html:159), which stays for batch 7.
    - Also run `node scripts/bump-sw.mjs --check`; no new file is expected, since the sprite is already precached.

## Not Verses
These entries were checked and have no Verses part:
- **P4-ICON-01, CONS-ACCENT-2, GAP-TOK-3, VIS-COLOR-1:** the app tiles and card heads, which are shell code.
- **CONS-ACCENT-4:** Verses already carries the person's colour (Show is `--accent-strong`); only the Larder is left (8).
- **CONS-MOTION-1:** Verses presses 2/2 at 0.97 with a dim; its ratings are `.ds .btn` (design.css:874). Left: the Larder, the build guide, the shell's Me and Chat.
- **CONS-MOTION-3:** the SDK's sheet and toast gestures; no batch owns it.
- **GAP-MOTION-3:** a device check (Tally, Home, F260).
- **CONS-SHAPE-1:** Verses' cards have been the one content card since batch 1 (SHAPE radii 28 ×387). The Larder is left.
- **CONS-SHAPE-3:** Verses' macro grid is 93.9 %. Its off-grid values (2, 10, 15) are design.css's `.stat` and the kid ×1.25 scale, not Verses literals (TOK spacing 0).
- **CONS-SHAPE-4:** Show and the ratings have been capsules at `--btn-h-lg` since batch 1 (:75). Left: the Larder and the build guide.
- **VIS-SHAPE-1:** Verses' off-concentric pairs went 4 → 0 in batch 1.
- **CONS-TOK-1:** Verses has no local aliases; a grep finds no legacy name, only a comment at :25. It does still read design.css's `--font-display` alias (:62, :99), which is design.css's own name, not a local alias.
- **CONS-TOK-2:** Verses has no own component or segmented-control classes. It uses design.css's `.btn`, `.card`, `.chip` and `.pill`.
- **CONS-TYPE-1:** Verses repeats no app title. Its h1 is the verse reference (:149).
- **VIS-ICON-1:** Verses has 0 emoji. Its 5 glyphs are running text ("Loading…", "Reading…") and comments (:114, :208, :321), not icons.
- **GAP-ICON-1:** the style guide's sprite inventory.
- **GAP-ICON-2:** Verses' icons are hand-drawn (04:2718), so no notice is owed. The only touch is the `circle-dashed` name, if batch 5 adds it (must-do 4).
- **GAP-TYPE-3:** Verses has 0 sizes under 11 px (code-scan).
- **GAP-TOK-1:** wiring `contrast.mjs` into `test-design`.
- **GAP-TOK-7:** the lint. Verses' 17 colours are the bootstrap map.
- **P4-SHAPE-01:** the shell sidebar.
- **Entries tied to other areas:** VIS-KIDVERSE-6/-10, VIS-LEFTOVERS-7, VIS-TALLY-7, the 2a/2b/3/4 NEEDS DEVICE CHECK items, UX-HOME-1, UX-HOME-5, UX-F260-6 and VIS-F260-12.
- **Verses-area entries from earlier batches that are FIXED:** P3-VERSES-01/02/03/04, UX-VERSES-5/7, VIS-VERSES-2/3/4/5/7, P3-F260-16.
- **Outside every carried entry:** TOK also lists 4 bespoke inset shadows (:89, :91-93), blur(9px) (:67) and the kid `max(64px, …)` heights (:76, :102). They have no open entry.

## Evidence for the status writer
- Verses unchanged since batch 1: `git log --oneline -3 -- apps/verses.html` → 80af987, e72f6d0, d968db8. HEAD is 1ba5cec.
- `audits/evidence/p6/4/p4tools/out/TOK_literals.txt:13` (verses row: colour 17, fontSize 1/1, lineHeight 2/1, shadow 4, blur 1, targetSize 6/4, localLiteral 1) and `:25` (verses mix 1).
- `audits/evidence/p6/4/p4tools/p4/TOK/literals-verses.json`: the mixRatio hit (line 32, `color-mix(in srgb, var(--mint-fill) 60%, transparent)`), localLiteral `--size: 28px` and fontSize `16px` (line 47, `.ds .top .pill .avatar`), lineHeight 1.1 (:99) / 1.2 (:123), blur (:67), shadows (:89, 91, 92, 93), and targetSize (:58, 76, 102, 104 ×2, 133).
- `audits/evidence/p6/4/p4tools/out/TYPE_code-scan.txt:9` (`{"px":1,"token":18}`, under11 0) and `…/p4/TYPE/code-scan.json:385-423` (`"16px": 1`).
- `audits/evidence/p6/4/p4tools/out/ICON_static.txt:12` (verses: svgTags 9, symbols 0, uses 0, strokeWidths `{"1.25":1}`, glyphs … ×1 → ×4, emoji 0).
- `audits/evidence/p6/4/p4tools/out/MOTION_press.txt:103` (verses 2/2 at 0.97, brightness 2).
- `audits/evidence/p6/4/p4tools/out/MOTION_cls.txt:20` (iPad portrait 0 moves) and `:37-38` (iPhone 2 moves, 27 px, Read aloud 247→274, Show 319→346). History: `audits/evidence/p6/1/tests/repro-before/phase4__MOTION__cls.txt:23-24, 44-45` (13 / 38 px) and `…/repro-after/phase4__MOTION__cls.txt:22, 41-42` (0 / 27 px).
- `audits/evidence/p6/4/p4tools/out/SHAPE_analyze.txt:147` (verses macro g4 0.939) and the lines after it (radii 28 ×387, largeOn 1, under44 0; off-grid 2/10/15).
- `audits/evidence/p6/1/tests/repro-after/phase4__TELL__tells-webkit.txt:11` (verses 18 controls, text 16) and `audits/evidence/p6/1/p4/TELL/tells-webkit.json` → areas.verses.probe.selectable (`span.chip.box` 15, `span#boxchip.chip.box` 1; imgsDraggable 1).
- status.mjs notes:
  - CONS-TOK-3: "Kid Verse 1, Verses 1"
  - CONS-TYPE-2: "Verses 1 px"
  - CONS-ICON-1: "Verses (1.25)"
  - UX-VERSES-6: "the placement goes to the Verses batch (5)"
  - CONS-GLASS-2: "non-floating glass buttons (Read aloud, Reset)"
  - VIS-VERSES-2: "content-live screens 159 → 120 … the Read aloud glass button"
- 04-design-system.md:
  - :2637 (ICON-5 Minus row, Verses' Almost)
  - :2657 (rotate-ccw)
  - :2662 (Almost → circle-dashed)
  - :2666 (check)
  - :2667 (star, fill)
  - :2687 (volume-2)
  - :2688 (eye, chart-column, list, clock)
  - :2718 (Verses' icons are one hand-drawn set)
- Sprite: `icons/sprite.svg` has `i-volume-2`, `i-eye`, `i-rotate-ccw`, `i-check`, `i-star`, `i-chart-column`, `i-list`, `i-clock` and `i-circle-half`, and no `circle-dashed`. `i-circle-half` is F260's Halfway (f260.html:1463).
- Shared hooks:
  - `svg.sym` / `sym-*`: design.css:820-824
  - `--icon-*` / `--icon-stroke`: design.css:167-169
  - `.ds .icon`: design.css:1173-1175
  - `.ds .avatar`: design.css:1045-1050
  - `.ds .chip`: design.css:1062
  - base chrome `user-select`: design.css:804
  - `--art-plate`: design.css:393, 416
  - `hub.toast` (no placement option): hub.js:1072-1083
  - the chat bubbles' glass: index.html:2624
