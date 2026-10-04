# Batch 7 carry-over check (earlier-batch PARTIAL / NEEDS DEVICE CHECK entries with a Kid Verse part)

Sources:
- `audits/tools/phase6/status.mjs`, STATUS + WORK_STATUS merged (later wins). 496 entries: 450 FIXED, 32 PARTIAL, 14 NEEDS DEVICE CHECK, **0 DEFERRED**. The 46 open ones are dumped to `scratchpad/b7-open.txt` (made by `scratchpad/b7-dump.mjs`, the b6 script unchanged).
- A second pass over the FIXED entries (`scratchpad/b7-grep.mjs`: notes that name Kid Verse / batch 7 and say "left / still / unchanged") found no FIXED entry hiding a Kid Verse leftover. The two nearest are CONS-TYPE-7 ("Kid Verse's 2 [px]", the same 2 px as CONS-TYPE-2 below) and P4-DARK-02 (Kid Verse 71 → 0, done).
- `audits/05-findings.md` finding texts (VIS-KIDVERSE-6/-10, VIS-ICON-1, VIS-SHAPE-1, CONS-GLASS-2, CONS-SHAPE-3, GAP-TOK-4, CONS-TYPE-2, CONS-TOK-3, CONS-ICON-1, GAP-TYPE-3 and others read for the ruled-out list).
- `audits/04-design-system.md`: Table ICON-6 rows :2635-2699, ICON-7 :2717 (Kid Verse 6/5), gap row DARK-10 :8952, `--art-plate` :8212.

Code state: `apps/kidverse.html` last changed in 65009df (batch 2a). `git status` shows nothing modified under `apps/`, `index.html` or `icons/` (only untracked screenshots). HEAD is ac5f7e4. So **line numbers below are HEAD's, and the batch 6 after-run (`audits/evidence/p6/6/p4tools/out/*.txt`, JSON in `…/p4tools/p4/`) is the latest for every tool except TELL, GLASS and DARK**: batch 6 ran TELL for Timer only (its `TELL_tells-webkit.txt` has no kidverse line), and GLASS/layers and DARK/art-dark were last run in batch 1 (`audits/evidence/p6/1/tests/repro-after/phase4__GLASS__layers.txt`, `…__DARK__art-dark.txt`). Kid Verse's own numbers have not moved since batch 1 in any tool (SHAPE_analyze line for kidverse is byte-identical in the batch 1, 4, 5 and 6 runs).

Current Kid Verse counts (`apps/kidverse.html`, 900 lines):
- **TOK/literals** (`p6/6/p4tools/out/TOK_literals.txt:12`; hits in `…/p4/TOK/literals-kidverse.json`): colour 17 (the bootstrap map, :6-10), font size 2/2, line height 8, local literal 2, glass filter 1, opacity 1, target size 7/6, color-mix 1 (`:24`), 3 breakpoints (info). Spacing 0, radius 0, shadow 0, duration 0. Hit list:
  - local literal: `--size: 28px` (:46), `--size: 40px` (:148).
  - font size: `font-size: 16px` (:46), `22px` (:148).
  - glass-filter constant: `brightness(.82)` (:56).
  - line height: 1.35 (:69, :132, :175), 1 (:94, :116, :140), 1.2 (:126, :127).
  - target size: `max(64px, var(--btn-h-lg))` (:75, :179), `min-width: 30px` (:109), `min-height: 64px` (:123), `44px` (:124, width and height), `84px` (:168).
  - opacity `.6` (:193).
  - mix 60 % (:32).
- **TYPE/code-scan** (`TYPE_code-scan.txt:8`): `{"px":2,"token":30}`, under-11 0. The 2 px are `16px` and `22px`, the avatar font sizes (:46, :148). The 30 token sizes are mostly the migration aliases `--fs-xs/sm/lg/xl/2xl/3xl` (design.css:737-738) plus `--fs-display` and `--fs-caption2`.
- **ICON/static** (`ICON_static.txt:11`): 7 `<svg>` tags (all inline, `class="icon"`), 0 sprite symbols, 0 `<use>`, stroke widths `{"1.5":1}` (the CSS `.ds .icon.star { stroke-width: 1.5 }`, :78), glyphs `{"★":18,"→":4,"−":2,"…":1,"✓":1}` (26), emoji 0.
- **MOTION/press** (`MOTION_press.txt:95-101`): kid 2/2 (Read it to me, Done ★: 0.97 with a dim), adult 1/1. The rig probes only the first-screen controls, so the story's two buttons and the adult stepper are not in it.
- **MOTION/cls** (`MOTION_cls.txt:19, :36`): kid, iPad portrait and iPhone, 0 moves, CLS 0.
- **SHAPE/analyze** (`SHAPE_analyze.txt:46-60`):
  - macro 4 px grid **50.7 %** (g4 41.2 % overall). The off-grid values 10 / 5 / 15 are the kid ×1.25 of `--sp-2/-1/-3` (`.pill` padding, `.badges li` padding, `.actions` gap), so they come from tokens; TOK spacing is 0.
  - concentric checked 252, distinct 2, **bad 1**: `section#story.card.story R28 > img#story-art r12 inset28 want0` (66 occurrences, adult and kid, iPad both ways and desktop).
  - 0 targets under 44 adult, 0 under 64 kid.
- **SHAPE/verify** (`SHAPE_verify.txt:2, :42`): V1 `#story-say` inside `section#story` R28, inset 17, r 999 (a capsule, accepted per CSS comment :178); V2 margins 20/78/262/392 and spans 390/664/656/656 (`--col-read`); V4 kid `#done`, `#say`, `#story-say` all 84 px tall, r 999.
- **TELL** (batch 1 after, `p6/1/tests/repro-after/phase4__TELL__tells-webkit.txt:10`; JSON `p6/1/p4/TELL/tells-webkit.json` → areas.kidverse.probe): 4 controls all `user-select: none`, imgs 2, **imgsDraggable 0**, selectable chrome `[]`. A double-click on `h1#ref` selects the word "Acts" (the verse reference is not in the :47 no-select list; it is content, so probably intended).
- **GLASS/layers** (batch 1 after, `phase4__GLASS__layers.txt:4`): kidverse 186 jobs, contentLive 176 (95 %), own-glass 28, area share med 9.5 %.
- **DARK/art-dark** (batch 1 after, `phase4__DARK__art-dark.txt:27-38`): `story/*.svg` painted 1, opaque 1, glare vs the Midnight card **7.76-12.64 for 8 of the 12 scenes** (01, 02, 04-08, 10, 11, 12; 03 and 09 are dark skies at 1.55 and 2.43), `adapt 0` for all. Those are before the `--art-plate` + `brightness(.82)` stopgap and measure the SVG alone.

---

## Carry-overs with a Kid Verse part

Order: the ones one coherent edit of `apps/kidverse.html` closes first (icons, then tokens), then the glass and art ones, then the device check.

### 1. CONS-ICON-1 (PARTIAL, batch 6; note names "Kid Verse (1.5, batch 7)")
**Left for Kid Verse:** every icon in the app is a hand-drawn inline `<svg class="icon">` (7 tags, 0 sprite uses). Move them onto `icons/sprite.svg` as `svg.sym` + `<use href="../icons/sprite.svg#i-…">`, the way Verses (verses.html:403, :418, :437) and Timer do. The 7 sites:
- Read it to me speaker ×2: :213 and :226 → `i-volume-2` (Table ICON-6 :2687; the same drawing as Verses' say button).
- "I heard it" check: :227 → `i-check` (ICON-6 :2666).
- `STAR` const: :262 (used for Done ★ :214, the week's count, the day dots, the Rewards heads, the adult's panel head) → `i-star`.
- Badge glyphs, `GLYPH` :491: book → `i-book-open` (ICON-6 :2668, :2699), heart → `i-heart` (ICON-6 :2691, :2699). The numeral badges (7 / 10 / 50) are text numerals by design (ICON-7 :2717).
- The filled star needs the sprite's `--sym-fill` hook. Verses already does it: `.ds .done svg.star { --sym-fill: var(--star-fill); color: var(--star-stroke) }` (verses.html:218). That replaces `.ds .icon.star { fill: var(--star-fill); stroke: var(--star-stroke); stroke-width: 1.5 }` (:78) and the on-button / earned-badge override `.ds .btn .icon.star, .badges li.on .bicon .icon.star { fill: currentColor; stroke: none }` (:80). Those two rules are where the last stroke width (`{"1.5":1}`) lives; it goes with them.
- Sizes: the CSS sizes icons by `.icon` width/height rules (:76, :95, :103, :114, :117, :125, :138, :153, :180). Re-point at `svg.sym` plus `--icon-*` (they scale for kids by `--icon-k`).
- The sprite already has `i-volume-2`, `i-check`, `i-star` (with the fill hook), `i-book-open` and `i-heart` (checked in `icons/sprite.svg`). No sprite change and no new `LICENSE-lucide.txt` entry is needed. `sw.js` already precaches the sprite.
- Note: the unearned/earned "Prayer warrior" heart is filled today (`fill="currentColor"`, :491) but the rig computes it as an outline anyway (P4-ICON-05); the sprite heart is an outline, which is what it renders today.

Evidence: `ICON_static.txt:11`; ICON-6 :2635-:2699; ICON-7 :2717.
Targets (ICON/static kidverse): svgTags 7 → 0 (or only the sprite `<svg class="sym">` wrappers, as Verses shows `svgTags 19, uses 19`), uses 0 → about 7 source sites, stroke widths `{"1.5":1}` → `{}`.
**Others still owe:** the Larder (2, batch 8), the Dollywood exports (15 widths, 9/10), and the shell's other 22 own symbols. **Stays PARTIAL.**

### 2. VIS-ICON-1 (PARTIAL, batch 4; note names "Kid Verse ★ ×18 (batch 7)")
**Left for Kid Verse:** the text glyphs. ICON/static counts 18 ★, 4 →, 2 −, 1 …, 1 ✓. By line (current code):
- **User-visible ★, 6 occurrences:**
  - the button label `Done ★` (:214 static markup; JS rewrites it at :438 to `Done today ★` / `Done ★`, and :432 is `Getting your stars…`);
  - the adults' panel `<b>★${count}</b>` (:455);
  - the kid's rewards line "A star each day for the verse ★, …" (:679);
  - the feed line `hub.activity('Read the verse ★')` (:402).
- **Other visible glyphs:** `Heard it today ✓` (:876); the adult week stepper's `−` buttons (:451, :452; its `+` is plain text too); `Reading…`, `Getting your…` are ellipses in running text, which F260 kept (batch 4 accepted "→ and … in running text").
- **The other 12 ★ are in code comments** (:23, 83, 182, 188, 314, 427, 428, 481, 539, 558, 704, 706), as are the → at :356, :537, :572. The scanner counts comments, so reaching 0 means rewording them, or accepting a floor the way F260 accepted "★ ×1".

What to do (ICON-7: "'Done ★' repeats its icon"):
- Label becomes `Done` / `Done today` and the star icon stays as the button's icon.
- The adult list shows the star icon plus the count.
- The kid's line says "verse" with the icon, or no glyph.
- "Heard it today" gets a check icon (or none).
- The stepper uses `i-chevron-left` / `i-chevron-right` (ICON-6 :2652-:2653 name `kidverse.html:369`) or `i-minus` / `i-plus`. ICON-6 itself lists the stepper's −/+ in two rows (Minus :2637 and Back/Next :2652-:2653) and plus under Add (:2659), so pick one. Keep the existing aria-labels "Previous week" / "Next week".
- The feed line is free text in a stored row. Tests match `^Read the verse ★`, so change the line and the test together, or leave the feed text and say so.

**Tests that match these words and must change with them:**
- `scripts/test-kidverse.mjs:199` and `:231` (`'Done today ★'`), `:220` (feed `/^Read the verse ★/`), `:186`/`:243`/`:267` (names only, in messages).
- `scripts/test-rewards.mjs:316` (`!== 'Done ★'`).
- `scripts/test-kidstory.mjs:231` (`'Heard it today ✓'`).
- Phase 3/2 audit tools that match the labels (not repo gates, but used as repro): `audits/tools/areas/kidverse.mjs` (7 hits), `phase3/kidverse/{award-first-pull,dates,ledger-rules,offline,rowsize,stale-device,star-rules,taps}.mjs`, `phase2/{PROF,PWA,STAB,HOME}/…` verify scripts.

Targets (ICON/static kidverse): glyphs 26 → at most the comment ones (18 ★ → 12 if only visible ones go, → 0 if comments are reworded), ✓ 1 → 0, − 2 → 0.
**Others still owe:** the Larder ✓ ×7 (8), the shell's 48 emoji (2a, no later batch named), the Dollywood exports' 52-53 glyphs (9/10). **Stays PARTIAL.**

### 3. CONS-TOK-3 (PARTIAL, batch 5; note names "Kid Verse 1 (batch 7)")
**Left for Kid Verse:** the page wash is the last `color-mix()`: `radial-gradient(120% 70% at 30% -10%, color-mix(in srgb, var(--butter-fill) 60%, transparent), transparent 60%)` (:32). Verses fixed the same thing with the hue's own wash token: `radial-gradient(… var(--mint-wash), transparent 60%)` (verses.html:34, "not a mix (CONS-TOK-3)"). `--butter-wash` exists in design.css (:251 light, :278 dark, and `--accent-wash: var(--butter-wash)` for butter :433). Use `var(--butter-wash)`. One-line change.
Target: TOK/literals kidverse `mix 1 → 0` (`TOK_literals.txt:24`).
**Others still owe:** each Dollywood export 25 (9/10), the shell 2 (index.html:160, :652, 2a's half). **Stays PARTIAL.**

### 4. CONS-TYPE-2 (PARTIAL, batch 6; note names "Kid Verse 2 px (batch 7)")
**Left for Kid Verse:** the 2 px are the avatar font sizes `font-size: 16px` (:46, the "who" pill) and `font-size: 22px` (:148, the adults' kids list). Both sit beside a local `--size: 28px` / `40px`. design.css already derives the face from its size (`.ds .avatar { font-size: calc(var(--size) * .52) }`, design.css:1045-1046), so the cleanest fix is to drop both overrides and use the shared sizes (`avatar-sm` 32 px is what hub.js is asked for at :421 and :455), which also removes the 2 local `--size` literals (GAP-TOK-4). If the 28 / 40 sizes are wanted, read `--icon-*`-style tokens instead of literals and let the face scale (that changes the look by a few px).
Targets: TYPE/code-scan kidverse `{"px":2,"token":30}` → `{"token":30}`; TOK/literals kidverse fontSize 2/2 → 0.
Optional, owned by no entry: the 30 token sizes are mostly the migration aliases (`--fs-xs`, `--fs-sm`, `--fs-lg`, `--fs-xl`, `--fs-2xl`, `--fs-3xl`), which design.css:731-733 says to delete once nothing reads them. Retargeting them to roles (`--fs-caption1`, `--fs-subheadline`, `--fs-title3`, `--fs-title2`, `--fs-title1`, `--fs-large-title`) is the batch 6 Timer precedent ("role tokens 0 → 10"), but is not required to close this entry.
**Others still owe:** each Dollywood export 143 clamp/calc plus 8 px and 2 under 11 px (9/10). **Stays PARTIAL.**

### 5. GAP-TOK-4 (PARTIAL, batch 6; no Kid Verse name in the note, found by TOK/literals)
The entry is "kid and kiosk scale only the tokenised subset; every literal size escapes them". Kid Verse is not in the finding's area list, but TOK/literals shows these literals in it that do not scale by kind:
- **Targets (7, all in kid-visible UI):**
  - `min-height: max(64px, var(--btn-h-lg))` (:75, :179): the primary buttons. Kid `--tap-lg-base` is 84 (design.css:588), so `var(--btn-h-lg)` alone is already 84 for kids and 60 for adults; the `64px` floor exists so adults also get 64. Decide: keep the adult 64 (then it stays a documented exception) or use `var(--btn-h-lg)`.
  - `.badges li { min-height: 64px }` (:123) → `var(--tap)`.
  - `.badges li .bicon` `44px` (:124) → a token (there is already a kid rule `48px` at :133).
  - `.story-head img` `84px` (:168) → `var(--tap-lg)`.
  - `#mine .days span { min-width: 30px }` (:109): a decorative day dot, not a control; the tool counts it as under 44. Either make it a token or note it as the "one row on a phone" shrink (comment :106).
- **Line heights (8)** with no token step: 1.35 ×3 (:69, :132, :175), 1 ×3 (:94, :116, :140), 1.2 ×2 (:126, :127). `--lh-tight` is 1.1, `--lh-snug` exists (used at :67, :173). Move to tokens or accept 1 for numerals (Timer left its digits' `1` the same way).
- **Local literal (2):** `--size: 28px` / `40px` (see CONS-TYPE-2: removing the overrides closes both).
- **Opacity** `.6` (:193, the skeleton day dots, "no opacity tokens (gap)") and **glass-filter constant** `brightness(.82)` (:56, the dark art dim; no token exists, so a token or a recorded exception).
Targets: kidverse targetSize 7 → 0-2, lineHeight 8 → 0-3, localLiteral 2 → 0, fontSize 2 → 0. (Status writer: GAP-TOK-4 was graded on Timer and the pill in batch 6; Kid Verse's items are the same class.)
**Others still owe:** the Dollywood exports' spacing 75 / 91 and font sizes 38 / 64 (9/10), plus the Larder's spacing 44 (batch 8, TOK_literals row). **Stays PARTIAL.**

### 6. CONS-GLASS-2 (PARTIAL, batch 5; note names "Kid Verse's Read it to me (batch 7)")
**Left for Kid Verse:** "Read it to me" is `class="btn btn-glass say"` (:213) and `class="btn btn-glass story-say"` (:226), set to `--g: var(--glass-strong)` (:82, :181), so a live-blur glass button sits inside the solid cards' flow (it is not floating chrome). Verses' answer was a solid secondary button (`btn btn-soft`, verses.html:416-421, `.btn-soft` design.css:878). Do the same here (`btn btn-soft` or plain `.btn`), drop the two `--g` rules, and decide the "who" pill: `.top .pill` (:45, :421) is a static, non-sticky glass pill that scrolls with the page, described in CSS as "a control-layer look" (:43). It is not a control, so either keep it as the one accepted glass piece or make it a solid chip.
Evidence: GLASS/layers (batch 1 after) kidverse contentLive 176 of 186 jobs (95 %). It was not re-run in batches 2-6, and the batch 1 note already says the scene and story cards are solid (VIS-KIDVERSE-8), so the count is the buttons (and the pill if it is classed as content). Re-run GLASS/layers on the kidverse job after the change.
Press feel to keep: MOTION/press kid 2/2 at 0.97 with a dim (:95); `.btn-soft` presses the same through `.pressable`.
**Others still owe:** the chat's reply bubbles (still `glass-strong`, the shell, 2a) and the build guide's map controls (9). **Stays PARTIAL.**

### 7. VIS-SHAPE-1 (PARTIAL, batch 1; note: "Kid Verse 2 → 1")
**Left for Kid Verse:** one off-concentric pair: `section#story.card.story R28 > img#story-art r12 inset28 want0` (SHAPE_analyze.txt:55; 66 occurrences, adult and kid). The picture is `.story-head img` (:168), `border-radius: var(--r-control)` (12 px), in a `.story-head` that is `align-items: center` (:167) next to a taller text block, so the picture sits about 11 px below the card's top padding and the tool measures an inset of 28 where the card padding alone is 17. With `want = max(0, R − inset) = 0` and `|r − want| > max(3, 25 % R)` the 12 px corner is flagged. Hypothesis (not run): `align-items: start` on `.story-head` puts the picture at the card's padding corner (inset about 17, want about 11, r 12, passes); the alternative is a square-ish corner, which is uglier. Confirm by re-running SHAPE/analyze (kidverse).
The `#story-say` capsule (V1 `off 988`) is a capsule and was ruled acceptable in batch 1 (CSS comment :178), so it is not the count.
Target: SHAPE/analyze kidverse `conc bad 1 → 0`.
**Others still owe:** shell 4 (2a), park map 4 (10), the Larder 4 (8), the build guide 1 (9), the TV board 8 (2c). **Stays PARTIAL.**

### 8. VIS-KIDVERSE-6 (PARTIAL, batch 1) with CONS-DARK-1 (PARTIAL, batch 6; Timer's part done)
**Left for Kid Verse:** the stopgap is in (`background: var(--art-plate)` on `.scene img` :54 and `.story-head img` :168, plus `filter: brightness(.82)` in dark :56). The art itself is open: `scripts/make-art.mjs` writes each scene's full-bleed sky as a fixed fill (`story['01-creation'] = svg(240, 160, [sky(P.slateSoft), …` :204-210 and on), so 8 of the 12 story scenes still glare at 7.8-12.6:1 against the Midnight card before the dim (DARK/art-dark `story/*.svg adapt 0`). To close: make-art emits token-friendly fills or a dark variant for `art/story/*.svg`, which the page then swaps by scheme (the page picks the art at :419 and :860 via `'../art/story/' + scene + '.svg'`). This edits the build script and 12 generated SVGs (plus their precache entries, `node scripts/bump-sw.mjs`), not only kidverse.html, and DARK-10 names no batch (design.css `--art-plate` comment :416: "until scripts/make-art.mjs emits token fills"). Owner call: do it in batch 7 (the story art is Kid Verse's), or leave the stopgap and record the carry again.
Check: re-run DARK/art-dark and capture the Midnight and Forest kid screens (`audits/evidence/p6/1/p3/kidverse/visual-C-kid-midnight-top.png` is the before).
**Others still owe:** CONS-DARK-1 covers every art file (spot art `art/app/*`, the Larder's fridge art: VIS-LEFTOVERS-7, ambient art). **Both stay PARTIAL** unless make-art is made token-aware for all art.

### 9. VIS-KIDVERSE-10 (NEEDS DEVICE CHECK, batch 1)
**Left for Kid Verse:** nothing in the code that the rig can still prove. The code is in: `.ds .scene img, .story-head img { -webkit-touch-callout: none; -webkit-user-drag: none; user-select: none }` (:55), the no-select list for the chrome (:47), `draggable="false"` on both pictures (:201, :220). TELL (batch 1 after): imgsDraggable 0, selectable chrome `[]`, 4 controls `user-select: none`. What remains is the iPad long-press: press and hold the story picture and the stars card and check that no callout, loupe or selection appears.
Two things for the status writer to know (neither is a defect in the entry): (a) the TELL run is batch 1's; batch 6 re-ran TELL for Timer only, so a Kid Verse re-run is needed if batch 7 wants a current number; (b) the verse reference `h1#ref` and the paraphrase `.words p` are not in the no-select list, and a double-click selects "Acts" in the probe; they are content, so probably wanted, but it is a possible long-press selection on the iPad too.
**Others owe:** nothing (Kid Verse only). **Stays NEEDS DEVICE CHECK** (the user's iPad), even with the code unchanged.

---

## Ruled out (no Kid Verse part left)

One line each, with why.

- **GAP-TYPE-3 (PARTIAL):** Kid Verse's under-11 is now 0 (code-scan `under11: 0`; the note's "Kid Verse 2 → 0" and "4 → 0"). Left is the template's SVG labels and the sub-floor lint.
- **GAP-TOK-7 (PARTIAL):** Kid Verse's 17 colours are the bootstrap map (same as every file); the open part is the lint, no batch.
- **GAP-TOK-1 (PARTIAL):** the `test-design.mjs` wiring of contrast.mjs; no area.
- **GAP-ICON-1 (PARTIAL):** the style guide's sprite inventory; no area. (Kid Verse's inline icons are look-alikes of Lucide, so item 1 above also advances GAP-ICON-2's "replace look-alikes", but that note names only the Dollywood notice and the shell's 22 symbols, so no Kid Verse part is owed there.)
- **GAP-ICON-2 (PARTIAL):** see GAP-ICON-1; Kid Verse not named, no `LICENSE-lucide.txt` change is needed (all five icons already shipped).
- **CONS-ICON-2 (PARTIAL):** left items are the shell feed's flame and the park map's heart/AED. Kid Verse's heart badge is an ICON-6 row, but the entry is not waiting on it.
- **CONS-SHAPE-3 (PARTIAL):** the note lists the Larder, build guide and park map. SHAPE/analyze reads Kid Verse at macro 4 px grid **50.7 %**, but every off-grid value (10 / 5 / 15, 2.5) is the kid ×1.25 of `--sp-*` tokens (offgrid list `SHAPE_analyze.txt:48`); TOK spacing is 0, so nothing is hand-written. No work, but the status writer should know the number is not 98 % any more in the tool (the batch 1 "98.4 / 97.2" came from the re-measure's method).
- **CONS-SHAPE-1 (PARTIAL), CONS-SHAPE-4 (PARTIAL):** Kid Verse's cards are solid `--r-card` and its buttons capsules at `--btn-h-lg` (batch 1; SHAPE/verify V4 84 px, r 999). Left: the Larder (8) and build guide (9).
- **CONS-ACCENT-4 (PARTIAL):** only the Larder is left; Kid Verse carries the person's colour (the avatar/today ring `--today-ring`) and butter on its two primaries by design (CONS-ACCENT-3 FIXED).
- **CONS-MOTION-1 (PARTIAL):** named leftovers are the Larder, build guide, shell Me and Chat. Kid Verse 2/2 (kid) and 1/1 (adult) at 0.97 with a dim. The probe does not reach the story's two buttons or the stepper, but all are `.btn`.
- **CONS-MOTION-3 (PARTIAL):** the SDK's sheet and toast gestures; no batch owns it. Kid Verse's toasts are already `hub.toast` (UX-KIDVERSE-8).
- **CONS-MOTION-4, GAP-MOTION-1 (PARTIAL):** Kid Verse has been 0 moves since batch 1 and still is (`MOTION_cls.txt:19, :36`). Left: the shell's Home, Me, the build guide.
- **GAP-MOTION-3 (NEEDS DEVICE CHECK):** the iOS `:active` check names Tally, a Home card and an F260 button; Kid Verse's `.btn`s ride the same hub.js touchstart listener (apps/hub.js:1130), but the entry does not name it.
- **CONS-TELL-1 (PARTIAL):** left: two build-guide labels, a park-map link, the long-press on a real iPad. Kid Verse's images are not draggable and its controls unselectable (TELL batch 1). The long-press is VIS-KIDVERSE-10 above.
- **CONS-TOK-1 (PARTIAL):** the Larder's alias set only. Kid Verse defines no local alias (its `--tint`/`--p`/`--size`/`--g`/confetti `--x --c --d` are the "plumbing, used correctly" of 04:1121).
- **CONS-TOK-2 (PARTIAL):** the F260 part, build guide, park map; Kid Verse has no segmented control.
- **VIS-HOME-1, UX-HOME-1, UX-HOME-3, UX-HOME-5 (PARTIAL / device):** shell Home. (UX-HOME-1 mentions "kid star count 5.2 → 10.4 mm" on Home; that is the shell's Kids card, not Kid Verse.)
- **UX-CHAT-01, PWA-UX-4, PWA-UX-3, PWA-GAP-3 (device):** the kid's spoken chat and Home reminder dictation; all in the shell and the chat tab. Kid Verse has its own "Read it to me" speech but no entry waits on it.
- **UX-PROF-a8, PWA-GAP-2 (device):** the shell's PIN sheet and push resubscription.
- **UX-PRAYER-3, UX-F260-6, VIS-F260-12 (PARTIAL / device):** Prayer and F260.
- **VIS-LEFTOVERS-7, VIS-TALLY-7 (PARTIAL / device):** the Larder's art plate (CONS-DARK-1's other half) and Tally's press check.
- **GAP-TIMER-2, UX-TIMER-5 (NEEDS DEVICE CHECK, batch 6):** the Timer.
- **CONS-TYPE-1 (PARTIAL):** the one left is "The Larder Ledger" (8). Kid Verse's page has no repeated title: its `h1` is the verse reference, not the viewer's title (index viewer shows "Kid Verse").

## Batch 7 must do for Kid Verse (apps/kidverse.html)

1. **CONS-TOK-3:** `color-mix(…--butter-fill 60%…)` (:32) → `var(--butter-wash)` (as verses.html:34). TOK kidverse mix 1 → 0.
2. **CONS-TYPE-2 + GAP-TOK-4 (type):** drop the two avatar overrides (`--size: 28px; font-size: 16px` :46, `--size: 40px; font-size: 22px` :148) and use the shared avatar sizes. code-scan px 2 → 0; TOK fontSize 2 → 0, localLiteral 2 → 0.
3. **CONS-ICON-1 + VIS-ICON-1 (+ GAP-ICON-2 look-alikes):** the 7 inline icons → sprite uses (`i-volume-2`, `i-check`, `i-star` with `--sym-fill`, `i-book-open`, `i-heart`); remove `.ds .icon.star` stroke-width 1.5 (:78) and the `.icon` size rules; `Done ★` / `Done today ★` / `Heard it today ✓` / `★N` / the −/+ stepper → words plus icons; update the five tests and the feed line together. ICON/static kidverse: svgTags 7 → 0, uses 0 → ~7, strokeWidths → `{}`, glyphs 26 → ≤ comment ones.
4. **CONS-GLASS-2:** both Read-it-to-me buttons solid (`btn-soft`), drop the two `--g: var(--glass-strong)` rules (:82, :181), decide the "who" pill. Re-run GLASS/layers kidverse.
5. **VIS-SHAPE-1:** `.story-head` `align-items` (or the picture's corner) so the `#story-art` pair passes. SHAPE/analyze kidverse bad 1 → 0.
6. **GAP-TOK-4 (sizes):** targets (:75, :123, :124, :168, :179), line heights (8), `.6` opacity, `brightness(.82)`: tokens, or a recorded exception for each that has no token (numerals' `line-height: 1`, the day-dot shrink, the dark dim). TOK kidverse targetSize 7 → ≤ 2, lineHeight 8 → ≤ 3.
7. **VIS-KIDVERSE-6 / CONS-DARK-1 (owner call):** token-fill or dark variant of the 12 `art/story/*.svg` via `scripts/make-art.mjs` and a scheme swap in the page; otherwise record the stopgap again.
8. **VIS-KIDVERSE-10:** no code; leave NEEDS DEVICE CHECK. Optional: add `.ref`, `.words` to the no-select list only if the owner wants the verse text unselectable.
9. **Constraints when editing:**
   - `VERSES[].words` is copied to the TV (index.html's table) and Verses' `KIDWORDS`; `test-tv.mjs` and `test-verses.mjs` hold the three equal. Do not change the paraphrase table without the others.
   - Stars, ledger and heard rows are the batch 0f contract; none of the items above touches them.
   - Keep the 64 px kid targets (`scripts/test-kidverse.mjs:186`).
10. **Re-run on a scratch copy** for the after column: TOK/literals, TYPE/code-scan, ICON/static, MOTION/press, MOTION/cls (keep 0 moves), SHAPE/analyze, SHAPE/verify (V1, V4), TELL/tells-webkit (kidverse), GLASS/layers (kidverse), DARK/art-dark (if item 7), plus `node scripts/bump-sw.mjs` (no new file unless item 7 adds art).

## Evidence for the status writer
- **Kid Verse unchanged since batch 2a** (`git log --oneline -3 -- apps/kidverse.html`: 65009df, 80af987, 7d9c593; `git status` clean for apps/). HEAD ac5f7e4.
- **status.mjs notes** (line numbers in `audits/tools/phase6/status.mjs`):
  - CONS-ICON-1: "Kid Verse (1.5, batch 7)"
  - VIS-ICON-1: "Kid Verse ★ ×18 (batch 7)"
  - CONS-TOK-3: "Kid Verse 1 (batch 7)"
  - CONS-TYPE-2: "Kid Verse 2 px (batch 7)"
  - CONS-GLASS-2: "Kid Verse's Read it to me (batch 7)"
  - VIS-SHAPE-1: "Kid Verse 2 → 1"
  - VIS-KIDVERSE-6 / -10 and CONS-DARK-1 are Kid Verse's by area.
- **Tool files:** `audits/evidence/p6/6/p4tools/out/{TOK_literals,TYPE_code-scan,ICON_static,MOTION_press,MOTION_cls,SHAPE_analyze,SHAPE_verify}.txt` and `…/p4/**.json`; `audits/evidence/p6/1/tests/repro-after/phase4__{TELL__tells-webkit,GLASS__layers,DARK__art-dark}.txt`.
- **Sprite:** `icons/sprite.svg` has 60 symbols including `i-volume-2`, `i-check`, `i-star` (`style="fill:var(--sym-fill,none)"`), `i-book-open`, `i-heart`, `i-chevron-left/right`, `i-plus`, `i-minus`.
- **design.css hooks:** `--butter-wash` :251/:278; `--star-fill/--star-stroke` :394/:417; `--art-plate` :393/:416; `.avatar` font-size :1045; `svg.sym` :820; `.btn-soft` :878; `--tap-base/--tap-lg-base` :159 (kid :588); `--r-inset` :152; migration aliases :731-738.
