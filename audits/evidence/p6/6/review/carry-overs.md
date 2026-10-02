# Batch 6 carry-over check (earlier-batch PARTIAL/DEFERRED/NEEDS DEVICE CHECK entries with a Timer part)

Sources:
- `audits/tools/phase6/status.mjs`. Every non-FIXED entry was dumped by importing STATUS + WORK_STATUS: 49 open entries (`scratchpad/b6-open.txt`, made by `scratchpad/b6-dump.mjs`). The J1 notes are at :199-354, W4c at :575-591 and W5c at :630-639.
- `audits/05-findings.md`: the open entries' finding texts and the batch 6 section (:4887-5120).
- `audits/04-design-system.md`:
  - Table ICON-6: the Timer row :2674 and the Timer/Tally controls row :2700.
  - Table ICON-7: Timer :2714.
  - The migration table: Timer :8708, numerals :8732.
  - CONS-TOK-2's "four ways" table: :853-865.

`git log --oneline -3 -- apps/timer.html` gives 80af987 (batch 1), d968db8 (0b) and 59fdc0e (the roadmap). Timer has not changed since batch 1.

`git diff --stat 2f699c2 084044f -- index.html apps/ icons/` is empty. Batch 5's after runs (`audits/evidence/p6/5/p4tools/out/*.txt`, JSON in `…/p4tools/p4/`) are therefore the current numbers for Timer and for the shell's pill.

TELL was run for Verses only in batch 5. Timer's TELL row is batch 1's after run, and a static read confirms that nothing in `apps/design.css` changes it (design.css:804 sets user-select and callout on `img[alt=""]`, never `draggable`). No tool was re-run for this check.

Working tree note: `git status` shows uncommitted edits in `apps/hub.js` and `worker/src/{index,policy,reminders}.js` plus `worker/wrangler.toml`, probably another session's work. `apps/timer.html`, `index.html`, `apps/design.css` and `icons/` are unmodified, so the line numbers below are HEAD's.

Current Timer counts (`apps/timer.html`):
- **TOK/literals:**
  - colour 17 (all the bootstrap map, :9-10);
  - color-mix 0;
  - font size 1 (`clamp(56px, 16vw, 92px)`, :54);
  - line height 1 (`1`, :54);
  - shadow 3 (:44, :47, :61);
  - target size 1/1 (`.hd img` 44px, :33);
  - spacing 0, radius 0, local literal 0.
- **TYPE/code-scan:**
  - `{"localVar":1,"clamp/calc":1,"other":1}`, token 0, under-11 0.
  - localVar is the h1's font shorthand at :34. The scanner takes the first `var()` it meets, here the weight `--fw-semibold`; the size itself is the alias `--fs-lg`.
  - clamp is :54.
  - "other" is `24cqw`, :54.
- **ICON/static:** 1 `<svg>` (the dial ring), 0 sprite uses, stroke widths `{3:1}` (the ring, :48), glyphs 0, emoji 0.
- **MOTION/press:** 8/8 controls at 0.97 with a dim (6 presets, Start, Reset).
- **MOTION/cls (150 ms):** 0 moves on the iPad portrait and 0 on the iPhone.
- **SHAPE/analyze:** macro 4 px grid 92.3 %. The off-grid values 10, 15 and 30 are the kid ×1.25 of `--sp-2/-3/-6`, not literals (TOK spacing 0). 0 targets under 44, and nothing checked for concentric corners.
- **TELL/tells-webkit (batch 1 after):** 8 controls, all `user-select: none`; 1 image, 1 draggable (`.hd img`).

Current shell timer-pill counts (`index.html`):
- **ICON/static shell:** symbols 23 (including `i-timer`, :815), stroke widths `{7:1}` (the pill ring, :716).
- **TOK/literals shell hits on the pill lines:**
  - `min-height: 44px` (:710);
  - 72px at glance (:467);
  - `font-weight: 600` (:710);
  - `.01em` (:715);
  - `z-index: 25` (:709);
  - `--tp-room: 64px / 92px` (:722, 2 local literals);
  - spacing 80/92 (:725, :732);
  - `gap: 6px` (:735).
  - TOK does not count the icon sizes 20/22/30 px (:714, :716, :469).
- **MOTION/press** never probes the pill: no timer runs in its surfaces.

---

## CONS-TYPE-1 (PARTIAL, batch 4; the note names "Kitchen timer" (batch 6))
1. **Timer:** "Kitchen timer" still shows twice inside the hub.
   - The in-app header `<header class="hd">…<h1>Kitchen timer</h1>` (timer.html:88) hides only below 640 px of height (:35). VIS-TIMER-2 (batch 6's own finding) measured it on all four devices.
   - Its h1 is the title-3 role, not the large title: `font: var(--fw-semibold) var(--fs-lg)/var(--lh-title3) var(--font-display)` (:34). `--fs-lg` is the migration alias of `--fs-title3` (design.css:737).

   Do what F260 did:
   - In the hub, set `html.framed` before the first paint, with the same one-liner as f260.html:658.
   - Keep the h1 for VoiceOver only (visually hidden, as f260.html:74), and drop the art mark there too.
   - Standalone, the h1 takes the large-title role: `--fs-large-title`, `--fw-large-title`, `--lh-large-title` and `--ls-large-title` (design.css:74), written as longhands.

   This closes VIS-TIMER-2 at the same time.
   - Check: in the hub at 390 / 820 / 1280 there is no visible h1 and nothing below it moves. Standalone, the h1 is 34 px bold.
   - TYPE/report.mjs and montage.mjs are stale, so this needs batch 6's own layout check, as F260's layout-4 was.
2. **Others owe:** "The Larder Ledger" (batch 8).
3. **Status:** stays PARTIAL. The Timer half can be FIXED.

## CONS-TYPE-2 (PARTIAL, batch 5; not named in the note; found by TYPE/code-scan)
1. **Timer:** none of Timer's 3 size declarations reads a role (code-scan token 0).
   - The digits (:54) set `font-size: clamp(56px, 16vw, 92px); font-size: 24cqw`. The clamp is a dead fallback, overridden by `24cqw` on the same rule. Yet design.css:109 names `--fs-numeral-l` as the "Timer digits, Tally count" role.
   - Use `font-size: min(var(--fs-numeral-l), 24cqw)`. That reads the role and still fits the dial, and the dead clamp goes. Settle it together with UX-TIMER-5 (batch 6's own: digits at `--fs-glance-1` on the iPad).
   - Write the h1 as longhands on the large-title role (CONS-TYPE-1), which also removes the scanner's localVar artefact.

   Target: code-scan timer token 0 → 2, localVar 1 → 0, other 1 → 0, clamp/calc stays 1 (`min()`), px 0.
2. **Others owe:** each Dollywood export 143 clamp/calc plus 8 px (9/10) and Kid Verse 2 px (7).
3. **Status:** stays PARTIAL.

## GAP-TOK-4 (PARTIAL, batch 5; not named in the note; found by TOK/literals). Its kid-target half is also P4-SHAPE-01, below.
1. **Timer, two parts.**
   - **App:**
     - `.hd img { height: 44px }` (:33, TOK targetSize, exact `--tap`, does not scale by kind). Use `var(--tap)`, or the rule goes with the header in the hub (CONS-TYPE-1).
     - The digits' line-height `1` (:54) has no token step (`--lh-tight` is 1.1). Leave it, or record the exception.
   - **Pill (index.html):**
     - `min-height: 44px` (:710) → `var(--tap)` (64 px for a kid; see P4-SHAPE-01);
     - `font-weight: 600` (:710) → `--fw-semibold`;
     - `.tp-time` `tabular-nums` / `.01em` (:715) → `--numeral-features` / `--ls-numeral`;
     - `z-index: 25` (:709) → `--z-fab` (30, design.css:179: above the tab bar at 20, below the scrim at 40 and the toast at 70);
     - `#pill-timer` `gap: 6px` (:735) → `--sp-1` or `--sp-2`;
     - the icon 20 px (:714), ring 22 px (:716) and glance 30 px (:469) → the `--icon-*` sizes, so they scale for a kid and the TV;
     - optional: `--tp-room: 64px / 92px` (:722) derived from the pill's own height.

   Targets:
   - TOK timer: targetSize 1 → 0 (or 0 rows, if the header goes).
   - TOK shell: the pill lines :709/:710/:715/:735 leave the hit list (shell local literals 30 → 28 if `--tp-room` is derived).
2. **Others owe:** the Dollywood exports' spacing 75 / 91 and font sizes 38 / 64 (9/10).
3. **Status:** stays PARTIAL.

## P4-SHAPE-01 (PARTIAL, batch 1; not named in the note; found by a code read)
1. **Timer pill:** the entry is "kid mode keeps adult-sized controls wherever a control is sized in fixed px".
   - `#timer-pill { min-height: 44px }` (index.html:710) has no kid rule. A kid sees the pill whenever their timer runs (Timer is a kid tile, index.html:2206), and kid `--tap` is 64 (design.css:588).
   - Fix: `min-height: var(--tap)`. The pill is the shell's, but it is in batch 6's files.
   - No tool measures it: SHAPE/verify V4 probes only the tab bar, and no timer runs in the rig's kid jobs. It needs a batch-6 kid probe, with Ezra at 390 and 820 and a timer running, measuring a height of 64 or more.
2. **Others owe:** nothing measured. The note's open part, "the shell's sidebar tab stays 48 px high for kids", now measures 64:
   - SHAPE/verify V4, `p6/5/p4tools/before` and `out`: `#tabbar .tab` 189×64 (iPad landscape) and 140×64 (portrait).
   - Batch 1 after: 189×48 and 140×56.

   The park map is 64 or more since batch 1, and the Larder's kid view has no controls since 0h.
3. **Status:** **can become FIXED** in batch 6, with the pill on `var(--tap)`, the kid probe, and the V4 rows cited for the sidebar.

## CONS-ICON-1 (PARTIAL, batch 5; the note lists "the shell's own symbols, now 23")
1. **Timer:**
   - **Pill and shell:** the running timer is drawn with the shell's private symbol `<symbol id="i-timer">` (index.html:815), used by:
     - the pill (:781);
     - the viewer-bar chip (:788);
     - the feed (`FEED_SYMBOLS.timer`, :1604);
     - the kitchen Home's Timer card (`icon('timer', …)` :1659, helper :1656).

     The shared sprite has no `i-timer`. Do this:
     - Add Lucide `timer` to `icons/sprite.svg` and point all four uses at `icons/sprite.svg#i-timer`. This is the shell's first sprite use; the sprite is already precached (sw.js:17).
     - Delete the inline symbol.

     Target: ICON/static shell symbols 23 → 22.
   - **App:** 0 icons (ICON/static timer uses 0). The icons batch 6's own entries ask for must be sprite uses beside a visible word, never glyphs or emoji:
     - UX-TIMER-4's "Time's up" bell → `i-bell`;
     - UX-TIMER-6's controls → `i-play`, a new `i-pause`, `i-rotate-ccw` (Table ICON-6, 04:2700);
     - GAP-TIMER-2's alarm Stop → `i-square`, already in the sprite as Verses' stop.

     Target: ICON/static timer uses 0 → N. Stroke widths stay only `{3:1}`, the dial ring (a progress ring, not an icon, as F260's rings 3.5/6 were accepted).
   - The pill's ring `stroke-width: 7` (:716) is the shell's `{7:1}`, also a ring.
2. **Others owe:** Kid Verse 1.5 (7), the Larder 2 (8), the Dollywood exports' 15 widths (9/10) and the shell's other 22 symbols.
3. **Status:** stays PARTIAL.

## CONS-ICON-2 (PARTIAL, batch 5)
1. **Timer** (from Table ICON-6, not the note).
   - **Three different drawings mean "timer"** (04:2674): the shell's `i-timer` (index.html:815, r 7 with a crown), the tile `icons/timer.svg` (r 8, crown and a side button) and the art title mark (timer.html:88). ICON-6 maps all of them to Lucide `timer`.
     - The pill, chip, feed and kitchen card get that one drawing through CONS-ICON-1.
     - Redraw `icons/timer.svg` to the same Lucide geometry, keeping its `class="duo"` layer. This is optional but needed for "one drawing".
     - The art mark leaves the hub with CONS-TYPE-1.
   - **The controls** (04:2700): play, pause, rotate-ccw.
     - `rotate-ccw` is already Verses' "Not yet". ICON-6 assigns it to both Retry/Not yet (04:2657) and Reset, so this is the table's call, not a new collision.
     - Do not use `i-clock` for the timer: `i-clock` is Verses' "Coming up".
2. **Others owe:** the shell feed's flame (2a's half) and the park map's heart/AED (10).
3. **Status:** stays PARTIAL.

## GAP-ICON-2 (PARTIAL, batch 4)
1. **Timer:** the shell's `i-timer` is one of "the shell's 22 [now 23] custom symbols … not replaced". Replacing it with the sprite's Lucide `timer` (CONS-ICON-1) takes one.
   - Add `timer` to the list of shipped icons in `icons/LICENSE-lucide.txt` (:2), and `pause` too if UX-TIMER-6 adds it.
   - Optional: `icons/timer.svg` (the tile) is a hand-drawn look-alike of Lucide `timer`/`alarm-clock`, which is the "replace custom look-alikes" half.
2. **Others owe:** the Dollywood template's Lucide/Feather paths in the notice (9/10) and the shell's other custom symbols.
3. **Status:** stays PARTIAL.

## CONS-TELL-1 (PARTIAL, batch 5; not named in the note; found by TELL/tells-webkit)
1. **Timer:**
   - Its 8 controls are already unselectable (body `user-select: none`, :24).
   - The header art `<img src="../art/app/timer.svg" alt="">` (:88) can be dragged: the batch 1 after run counts `imgs 1, imgsDraggable 1` (`p6/1/p4/TELL/tells-webkit.json` → areas.timer.probe). Batch 4 fixed the same thing in F260 and Prayer, and batch 5 in Verses.
   - Fix: add `draggable="false"` and `-webkit-user-drag: none`, or the image leaves the hub with CONS-TYPE-1 (standalone still needs the attributes).

   Target: TELL timer imgsDraggable 1 → 0. Re-run TELL for timer on a scratch copy.
2. **Others owe:** two build-guide labels (9), one park-map link (10), and a long-press on a real iPad.
3. **Status:** stays PARTIAL.

## CONS-MOTION-1 (PARTIAL, batch 4; not named in the note; found by a code read, not measured)
1. **Timer pill:** the app is done (MOTION/press timer 8/8 at 0.97 with a dim, MOTION_press.txt:74). The pill is not:
   - `#timer-pill:active { transform: translateX(-50%) scale(.96) }` (index.html:717), with no `--press-dim`;
   - the same on the desktop (:721);
   - the literal ignores Reduce Motion, which sets `--press-scale: 1` (design.css:718).

   Use `transform: translateX(-50%) scale(var(--press-scale)); filter: var(--press-dim)` on :717, and `scale(var(--press-scale))` plus the dim on :721, releasing on `--dur-snappy` / `--spring-snappy`. The class `.pressable` cannot be used as is, because the pill's transform carries its translate.

   Optional: the timer chip in the viewer bar shares `#pill button:active { scale(.94) }` (:690). That rule styles every viewer-bar button (shell-wide), so changing it is a shell call.

   MOTION/press does not probe the pill, so batch 6 needs its own forced-`:active` probe with a timer running.
2. **Others owe:** the Larder 9/12 (8), the build guide 14/16 (9), the shell's Me 26/27 and Chat 6/7, and the press feel on a real iPhone and iPad.
3. **Status:** stays PARTIAL.

## CONS-DARK-1 (PARTIAL, batch 5): optional Timer part
1. **Timer:** the stopgap is "art sits on --art-plate meanwhile". The 44 px title mark (`.hd img`, :33 / :88) is `art/app/timer.svg`, with fixed fills including a pale `#F7E3DA` disc, sitting straight on the page in dark.
   - Fix: `background: var(--art-plate)` and a radius, as the Larder (leftovers.html:123) and Verses (verses.html:220) do. Or, once the header leaves the hub (CONS-TYPE-1), this applies only standalone.
2. **Others owe:** the art pipeline itself (`scripts/make-art.mjs` token fills, gap row DARK-10, no batch named).
3. **Status:** stays PARTIAL.

---

## Batch 6 must do for Timer (apps/timer.html, the pill in index.html)
1. **CONS-TYPE-1 + VIS-TIMER-2:** add `html.framed` before the first paint (f260.html:658 pattern). In the hub, the h1 "Kitchen timer" is visually hidden (kept for VoiceOver) and the art mark does not show. Standalone, the h1 takes the large-title role (`--fs/--fw/--lh/--ls-large-title`, longhands; :34). Check at 390 / 820 / 1280 in the hub and standalone.
2. **CONS-TYPE-2:** the digits (:54) use `min(var(--fs-numeral-l), 24cqw)` and drop the dead `clamp(56px, 16vw, 92px)`; settle the size with UX-TIMER-5. code-scan timer: token 0 → 2, other 1 → 0, localVar 1 → 0.
3. **P4-SHAPE-01 + GAP-TOK-4 (pill):** `#timer-pill` `min-height: var(--tap)` (:710).
   - `--fw-semibold` (:710); `--numeral-features` and `--ls-numeral` (:715); `--z-fab` (:709); `--sp-*` for `gap: 6px` (:735); `--icon-*` for 20 / 22 / 30 px (:714, :716, :469).
   - Kid probe: pill height of 64 or more. This brings P4-SHAPE-01 to FIXED, together with SHAPE/verify V4's 64 px sidebar tab.
4. **GAP-TOK-4 (app):** `.hd img` `height: var(--tap)` (:33), or remove it with item 1. TOK timer targetSize 1 → 0.
5. **CONS-ICON-1 + CONS-ICON-2 + GAP-ICON-2:**
   - Add Lucide `timer` (and `pause`, if item 9 needs it) to `icons/sprite.svg`, and the names to `icons/LICENSE-lucide.txt`.
   - The pill (:781), chip (:788), feed (:1604) and kitchen card (:1656/:1659) use `icons/sprite.svg#i-timer`; delete the inline `<symbol id="i-timer">` (:815). ICON/static shell symbols 23 → 22.
   - Optional: redraw `icons/timer.svg` to the same geometry, so the timer has one drawing.
6. **CONS-TELL-1:** the header art gets `draggable="false"` and `-webkit-user-drag: none` (:88). TELL timer imgsDraggable 1 → 0.
7. **CONS-MOTION-1:** the pill press reads `--press-scale` and `--press-dim` (:717, :721), so it is 0.97 with a dim and still under Reduce Motion. Check with a forced `:active` probe on the pill.
8. **Optional, CONS-DARK-1:** the title mark on `--art-plate` with a radius (standalone).
9. **Wherever batch 6's own entries add icons** (UX-TIMER-4 bell, UX-TIMER-6 play / pause / reset, GAP-TIMER-2 Stop): use `svg.sym` sprite uses beside a word (`i-bell`, `i-play`, `i-pause`, `i-rotate-ccw`, `i-square`). Never use a glyph or emoji (VIS-ICON-1 stays at 0 for Timer) and never `i-clock` (Verses' Coming up).
10. **Re-run on a scratch copy** for the after column:
    - TOK/literals, TYPE/code-scan, ICON/static, MOTION/press, MOTION/cls (keep 0 moves) and TELL/tells-webkit (timer);
    - SHAPE/analyze;
    - batch 6's own pill probes (kid height, press), which no Phase 4 tool covers;
    - `node scripts/bump-sw.mjs`. The sprite is already precached, so no new file is expected.

## Not Timer
These entries were checked and have no Timer part.
- **CONS-ACCENT-2:** the Timer half has been FIXED since batch 1: the running ring is the owner's colour, and time's up is `--timer-done` (timer.html:26, 58-63; design.css:488). What is left is the app tiles.
- **P4-ICON-01, GAP-TOK-3, VIS-COLOR-1:** the same tile half (shell). All four of these (CONS-ACCENT-2 included) look stale. Since 2a the tiles carry `data-accent="${appHue(a)}"` (index.html:1173, kid tiles :2233), apps.json has `hue` (Timer coral, apps.json:8), and `--tile-bg` is the fill-to-fill-strong gradient (design.css:554). None was re-measured or re-statused here; that is for the status writer, not Timer.
- **CONS-ACCENT-4:** Timer carries the person's colour (arc `--progress-fill`, presets `--sel-*`, Start). Only the Larder is left (8).
- **CONS-GLASS-2:** the dial has been solid since batch 1 (VIS-TIMER-6 FIXED). The Timer area's 17 content-glass jobs in batch 1's GLASS/layers are the shell chat bubbles in the `pill-chat` jobs and Tally's Reset in a frame (`p6/1/p4/GLASS/layers.json` → areas.timer.elements). The pill is floating chrome, where glass is allowed. Left: the chat bubbles (shell), Kid Verse (7) and the build guide (9).
- **CONS-MOTION-3:** the SDK's sheet and toast gestures; no batch owns it. The shell's "Timer done" toast is `hub.toast`.
- **CONS-MOTION-4 and GAP-MOTION-1:** Timer moves 0 on both devices (MOTION_cls.txt:15, :32) and has had a skeleton since 0b. The 24 px jump at 0:00 is batch 6's own P3-TIMER-02, not a load shift.
- **CONS-SHAPE-1:** the dial is a solid disc on `--material-solid-bg` with `--elev-card`. The Larder is left.
- **CONS-SHAPE-3:** Timer's 92.3 % comes from the kid ×1.25 steps (10 / 15 / 30 px from `--sp-2/-3/-6`), not literals (TOK spacing 0).
- **CONS-SHAPE-4:** Start has been a capsule at `--btn-h-lg` since batch 1.
- **VIS-SHAPE-1:** Timer has no nested corners (conc checked 0).
- **CONS-TOK-1:** Timer defines no local alias. It does read design.css migration aliases:
  - Timer: `--fs-lg` (:34; item 1 removes it).
  - The pill: `--fs-md`, `--accent`, `--accent-deep`, `--tint`, `--dur-3`, `--spring` (index.html:710-736).

  Retargeting these is optional clean-up that no entry owns (design.css:731-733: "delete each alias once the Phase 6 lint finds no reader").
- **CONS-TOK-2:** Timer is a `.ds` app with no name collision, and its presets are not one of the "four ways" (04:853-865). Optional: the presets copy the `.seg` selected recipe by hand (:71-72, the 2/3/6-column rules :68, :70, :77). They could become `.ds .seg.seg-grid`, with `aria-pressed` for UX-TIMER-10. That would change the look (a visible track), so it is a judgement call.
- **CONS-TOK-3:** Timer has had 0 mixes since batch 1. The shell's 2 (index.html:160, :652) are not the pill.
- **GAP-TOK-1, GAP-TOK-7, GAP-ICON-1:** the gate wiring, the lint and the style guide. Timer's 17 colours are the bootstrap map.
- **GAP-TYPE-3:** Timer has 0 sizes under 11 px.
- **VIS-ICON-1:** Timer has 0 glyphs and 0 emoji. Keep it so (must-do 9).
- **GAP-MOTION-3:** a device check on Tally, a Home card and F260.
- **UX-HOME-1:** the pill already reads 6.0 mm. What is left is the ring label, the sub-line, reminders, bylines and the feed.
- **UX-HOME-5:** the Timer frame is dropped at once on close (index.html:1209, 1221). Caution: if batch 6 adds a typed field (GAP-TIMER-3 custom time or label), a half-typed value would be lost on close. Revisit that exception then.
- **Device checks tied to other areas:**
  - UX-CHAT-01, PWA-GAP-3, PWA-UX-4, PWA-UX-3, UX-HOME-3, UX-PROF-a8, VIS-HOME-1, UX-PRAYER-3.
  - PWA-GAP-2: subscription rotation. Batch 6's own PWA-GAP-1, the server "Timer done" push, will ride on the same push path.
- **Entries tied to other areas:** VIS-KIDVERSE-6/-10, VIS-LEFTOVERS-7, VIS-TALLY-7, UX-F260-6, VIS-F260-12.
- **Timer entries from earlier batches that are FIXED:** P3-TIMER-01, UX-TIMER-9 (0b), VIS-TIMER-3/-6/-7 (1), UX-TIMER-8, VIS-TIMER-5 (2a), and P2-CHAT-01's timer half (0i).
- **The batch 1 Timer track token note (VIS-TIMER-7, FIXED):** `--progress-track` (`= --accent-fill`, design.css:489) measures only 1.07-1.47 on a light dial, so Timer reads `--tint-fill-strong` (:49). It is not a carry-over.
  - Any new ring batch 6 adds (UX-TIMER-7's Home timer card, GAP-HOME-1's kitchen or TV timer) should use `--tint-fill-strong`, not `--progress-track`.
  - The pill's own ring track is design.css's `.ds .ring .bg` mix at 18 % (design.css:1082), never measured on glass.
- **Outside every carried entry:**
  - TOK's 3 bespoke shadows (the dial :44, the ring's drop-shadow :47, the done ring :61);
  - the digits' line-height 1 (:54);
  - the dial cap `min(82vw, 52vh, 400px)` (:41), which is UX-TIMER-5's subject.
- **Batch 6's own work** (not carry-over): 24 unstatused findings in 05 (:4889-5114) plus IMP-TIMER-I2. Overlaps:
  - VIS-TIMER-2 is CONS-TYPE-1's Timer half.
  - UX-TIMER-4 and -6 add the icons in must-do 9.
  - UX-TIMER-10's `aria-pressed` fits the `.seg` selector.
  - UX-TIMER-1 can use the result-line + Undo pattern (Verses, batch 5) instead of a confirm.

## Evidence for the status writer
- **Timer unchanged since batch 1:**
  - `git log --oneline -3 -- apps/timer.html` gives 80af987, d968db8 and 59fdc0e. HEAD is 084044f.
  - `git diff --stat 2f699c2 084044f -- index.html apps/ icons/` is empty.
- **TOK/literals:**
  - `audits/evidence/p6/5/p4tools/out/TOK_literals.txt:9`: timer colour 17, fontSize 1/0, lineHeight 1/0, shadow 3/0, targetSize 1/1.
  - `:21`: timer mix 0.
  - `…/p4tools/p4/TOK/literals-timer.json` hits:
    - targetSize 44px `.hd img` line 33;
    - shadows 44, 47, 61;
    - fontSize `clamp(56px, 16vw, 92px)` and lineHeight `1`, both line 54;
    - colours 9-10, the bootstrap map.
  - `…/p4/TOK/literals-shell.json` hits on the pill:
    - 709 zIndex 25;
    - 710 targetSize 44px and fontWeight 600;
    - 715 letterSpacing .01em;
    - 722 localLiteral 64px / 92px;
    - 725 / 732 spacing 80 / 92;
    - 735 spacing 6;
    - 467 targetSize 72px;
    - 468 lineHeight 1.
- **TYPE/code-scan:**
  - `…/out/TYPE_code-scan.txt:7`: timer `{"localVar":1,"clamp/calc":1,"other":1}`, under11 0.
  - `…/p4/TYPE/code-scan.json` → files["apps/timer.html"]: families `var(--fs-lg)/var(--lh-title3) var(--font-display)`, fsTokens `{}`.
  - The localVar artefact comes from `audits/tools/phase4/TYPE/code-scan.mjs:29`, the shorthand regex taking the first `var()`.
- **ICON/static:**
  - `…/out/ICON_static.txt:8`: timer svgTags 1, uses 0, strokeWidths `{"3":1}`, glyphs 0, emoji 0.
  - `:1`: shell symbols 23, strokeWidths `{"7":1}`.
- **MOTION:**
  - `…/out/MOTION_press.txt:74`: timer 8/8, scales [0.97], brightness 3. The pill is not in any surface.
  - `…/out/MOTION_cls.txt:15, :32`: timer 0 moves on the iPad portrait and the iPhone.
- **SHAPE:**
  - `…/out/SHAPE_analyze.txt:120-130`: timer macro g4 0.923, off-grid 10 / 15 / 30, conc checked 0, under44 0.
  - `…/out/SHAPE_verify.txt:39-40` (also `…/before/SHAPE_verify.txt`): V4 kid `#tabbar .tab` 189×64 and 140×64.
  - Against that, `audits/evidence/p6/1/tests/repro-after/phase4__SHAPE__verify.txt`: 189×48 and 140×56.
- **TELL:**
  - `audits/evidence/p6/1/tests/repro-after/phase4__TELL__tells-webkit.txt:7`: timer 8 controls, all none.
  - `audits/evidence/p6/1/p4/TELL/tells-webkit.json` → areas.timer.probe: imgs 1, imgsDraggable 1.
- **GLASS:** `audits/evidence/p6/1/tests/repro-after/phase4__GLASS__layers.txt:9` (timer contentLive 17 jobs, 15 %) and `audits/evidence/p6/1/p4/GLASS/layers.json` → areas.timer.elements:
  - `div.mrow.bot > div.msg.bot.glass-strong`;
  - `button#reset … frame:tally`;
  - `button#timer-pill.pill` chrome.
- **status.mjs notes:**
  - CONS-TYPE-1 (:577): "Left: … "Kitchen timer" (batch 6)"
  - CONS-ICON-1 (:632): "the shell's own symbols, now 23 (22 before)"
  - GAP-ICON-2 (:591): "the shell's 22 custom symbols are not replaced"
  - P4-SHAPE-01 (:280): "The shell's sidebar tab stays 48 px high for kids"
  - CONS-MOTION-1 (:580): "the shell's Me 26/27 and Chat 6/7"
  - CONS-ACCENT-2 (:217): "The app half is not in: tiles still carry the apps.json hex"
  - CONS-GLASS-2 (:226): "non-floating glass buttons (Read aloud, Reset)". This Reset is Tally's.
  - VIS-TIMER-7 (:331): "--progress-track … a token note for the owner"
- **04-design-system.md:**
  - :2674 (ICON-6 Timer row: S `i-timer`, T timer, art title mark → `timer`);
  - :2700 (Timer / Tally controls → `play`, `pause`, `rotate-ccw`);
  - :2657 (rotate-ccw = Retry / not yet);
  - :2714 (ICON-7 Timer: zero icons);
  - :853-865 (CONS-TOK-2's four segmented controls, no Timer);
  - :8708 (migration: Timer ring → `--accent-graphic` / `--timer-done`, done);
  - :8732 (numerals: the timer pill → `--font-numeral`, done at index.html:715).
- **Sprite:** `icons/sprite.svg` has 52 symbols, including `i-play`, `i-square`, `i-rotate-ccw`, `i-bell`, `i-clock` and `i-circle-dashed`. It has no `i-timer` and no `i-pause`. `icons/LICENSE-lucide.txt:2` is the shipped-icon list. The sprite is precached at sw.js:17.
- **Shell hooks:**
  - pill CSS: index.html:708-736;
  - pill markup: :781;
  - chip: :788;
  - `i-timer`: :815;
  - feed symbols: :1604;
  - kitchen icon helper: :1656, card :1659;
  - frame drop: :1209, 1221;
  - pill JS: :1304-1359;
  - viewer-bar press: :690.
- **design.css hooks:**
  - large-title role: :74;
  - `--fs-numeral-l` "Timer digits": :109;
  - `--tap` / kid `--tap`: :160 / :588;
  - `--icon-*`: :167-169;
  - `--z-*`: :179;
  - `--press-scale` / Reduce Motion 1: :214 / :718;
  - `--sel-*`: :483;
  - `--timer-done`: :488;
  - `--progress-*`: :489;
  - migration aliases: :730-765;
  - base chrome: :804;
  - `svg.sym`: :820-824;
  - `.pressable`: :828-830;
  - `.seg` / `.seg-grid`: :1007-1017;
  - `.ds .ring`: :1079-1084;
  - `--art-plate`: :393, :416.
- **F260's framed-title precedent:** f260.html:74 (the visually-hidden h1) and :658 (the pre-paint `framed` class).
