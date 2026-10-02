# Phase 4 scorecard: the Kitchen timer row rescored after audit batch 6

**Independent judge.** Method: `audits/04-design-system.md` lines 24-241 (shared bases + rules TYP-1 … DEL-4; net adjustment per dimension clamped to ±2; cells 1-10 in 0.5 steps; row = mean of 11). Bases are `hearth-shared` as re-priced in `audits/evidence/p6/1/rescore.md`, not re-priced here; only the row's rules change. "Before" is batch 1's Timer row (`p6/1/rescore.md:52`). Typography and Shape stay provisional (the rig paints no blur and uses fallback fonts).

## Evidence

**Pairs opened: 30 before/after** (composites in `rescore-6/pairs/`, built from `SCRATCH/cap6-before/timer` against `audits/screens-after/6/timer`), plus **10 after-only shots** and 2 crops (`rescore-6/crops/`).
- iPhone: idle-typical (light), running-typical (light), running-typical Safari (dark), ringing ← done-typical (light), paused-typical (light), running-overflow (light), idle-overflow (dark), idle-loading (light), pill-overflow (light), chip-overflow (light), pill-chat (light), done-toast (light).
- iPad portrait: running-typical (light), ringing (dark), idle-offline (dark), done-toast (light).
- iPad landscape: running-typical (dark), ringing (light), paused (dark), running-overflow (dark), pill-overflow (dark), chip-overflow (dark).
- Desktop: running-typical (light), ringing (dark), idle-empty (light).
- Kid: kid-typical iPhone (light), iPad portrait (dark), iPad landscape (light); kid-running ← kid-typical on iPhone Safari (dark) and iPad portrait (light).
- After only: kitchen-typical iPad portrait (light) and landscape (dark), kitchen-home landscape (light), replace iPhone, ended-unseen iPhone, migrated iPhone, `shell/home-timer` iPad portrait and desktop, `shell/viewer-timer` iPhone dark, `tv/board-typical-tv-light`.
- The pre-batch "done" shots do show 0:00 on the oval dial (P3-TIMER-02), so they are a fair before for "ringing".

**Measurements:** `SCRATCH/final-6/measure/agg/*.json` (areas.timer) against `audits/evidence/p6/1/measure/*.json`, compared with `rescore-6/cmp2.cjs` and `cmp3.cjs`; `audits/evidence/p6/6/measure/contrast-accounting.md`; Phase 4 tools `audits/evidence/p6/6/p4tools/before` vs `out` (TOK, TYPE, ICON, MOTION press/cls, SHAPE analyze/verify, TELL).

**Not run by me:** the capture rig, any Phase 4 tool, a Tab walk, a device.

## The row

| Dimension | Base | Before (b1) | **After** | Rules now applied |
|---|---|---|---|---|
| Typography* | 6 | 7 | **7** | TYP-4 |
| Colour | 5 | 6 | **6** | COL-1 |
| Layout | 6.5 | 6 | **7** | LAY-5 (LAY-2 lifted) |
| Shape* | 6 | 5.5 | **5.5** | SHP-1½ |
| Icons | 5.5 | 3.5 | **6** | ICO-1, ICO-4 (ICO-3b lifted) |
| Motion | 4.5 | 4.5 | **4.5** | none |
| Dark | 6.5 | 6.5 | **6.5** | none |
| Native | 6.5 | 6 | **6.5** | none (NAT-2 lifted) |
| Glance | 4.5 | 5.5 | **5.5** | GLA-1 |
| Ease | 6 | 5 | **6** | none (EOU-3 lifted) |
| Delight | 5.5 | 4.5 | **5.5** | none (DEL-3 lifted) |
| **Average** | | **5.5** (60.5/11 = 5.50) | **6.0** (66/11 = 6.00) | **+0.5** |

## Changed cells

**Layout 6 → 7: LAY-2 lifted, LAY-5 earned.**
- From 960 px in landscape the dial sits beside the controls (`timer.html:215-221`). SHAPE/verify V2: iPad landscape span 560 → **984** of 1180 (left 310 → 98); desktop 560 → **984** of 1440 (left 440 → 228). Neither leaves over half the width empty (`running-typical-ipad-landscape-dark`, `running-typical-desktop-light`, `ringing-typical-ipad-landscape-light`).
- A second column for the device = LAY-5 (+½). iPad portrait keeps the 560 column with 129/130 margins (no jump, not phone margins).
- LAY-3 not met: the primary sits right under the dial in every state (Start/Pause/Stop at y≈460-520 on the iPhone; the reviewers' XXL 375×667 check ends Pause at y 430).
- LAY-4 not met: long labels ellipsize in the dial, the recents and the list (`running-overflow-iphone-pwa-light`, `running-overflow-ipad-landscape-dark`); the pre-batch sidebar pill whose ring and icon spilled outside its capsule is fixed (`pill-overflow-ipad-landscape-dark`).
- LAY-1 kept off by batch 1's policy: macro 4 px grid 92.3 → **88.2 %**, every off-grid value being the kid ×1.25 steps (presets padding 10, gap 5, #go gap 10) or the visually-hidden h1's `margin:-1` (SHAPE/analyze `out`).

**Icons 3.5 → 6: ICO-3b lifted, ICO-1 earned, ICO-4 applied.**
- ICON/static timer: sprite uses **0 → 21**, stroke widths only `{3:1}` (the dial ring), emoji 0. The one glyph counted (`×`) is in a CSS comment (`timer.html:35`, "375×667"), not on screen.
- Every action carries a sprite icon beside its word: play/pause/square on #go, plus on +1 min, rotate-ccw on Reset, bell on "Time's up" and Notify me, mic on Say it, the steppers, the replace choices; kid presets get food pictures (`kid-typical-ipad-portrait-dark`). One family (Lucide), one stroke token → ICO-1 (+1).
- **ICO-4 (−½):** clearing a timer has two drawings and two names. In the app it is **Reset** with `i-rotate-ccw` (`apps/timer.html:246, 537-541`, `stopRow`); on the Home card and the kitchen Home the same action on a *running* timer is **Stop** with `i-square` (`index.html:2507, 1896` → `stopTimer` → `TM.clear`), and in the app `i-square` "Stop" is the alarm's silence. Shots: `shell/home-timer-typical-desktop-light` (round square button next to Pause), `timer/kitchen-home-typical-ipad-landscape-light` (Pause / Stop under "Kitchen · Rice 20:00"), `timer/ringing-typical-iphone-pwa-light` (Stop and Reset side by side, both `stopRow`). Policy call 2.

**Native 6 → 6.5: NAT-2 lifted.** TELL `tells-webkit` timer: controls 8 → 14, all `user-select: none`; imgs 1 → **0**, imgsDraggable 1 → **0** (in the hub the art mark is not drawn; standalone it is `draggable="false"` + `-webkit-user-drag:none`). The only field is the label input at 19 px (no iOS zoom). NAT-4 stays off: skeleton digits, "Loading…" on a disabled Start, every control off (`idle-loading-iphone-pwa-light`). NAT-6 not earned: no Tab-walk evidence for the 14 controls (the list capsules and inputs use a border colour on `:focus`, not verified as a ring).

**Ease 5 → 6: EOU-3 lifted.** Kid controls are pictures and words, ≥ 64 px: food-picture presets (apple, popcorn, egg, pot, cookie, pizza) at `--tap + --sp-6`, play/pause/rotate icons on the actions, a picture-answer replace question; kids get no custom, label, sound, notify or recents (`kid-typical-iphone-pwa-light`, `kid-typical-ipad-landscape-light`, `kid-running-typical-iphone-safari-dark`). SHAPE kid under-44: 0 of 245. EOU-1 still not earned: the Home card's one-tap recents are on no first screen (a later slide of the iPhone carousel; below the fold on the iPad portrait, `shell/home-timer-typical-ipad-portrait-light`; no card on the kid Home), and the app route is still Apps → Timer → Start. EOU-6 not applied (policy call 4).

**Delight 4.5 → 5.5: DEL-3 lifted.** Completion is now marked beyond a number: "Time's up" in words with the bell inside the ring, the ring filling in the owner's colour with the outer ring and pulse, a chosen sound repeating every 15 s until Stop, the Home pill turning into "Time's up · Stop" (`ringing-typical-iphone-pwa-light`, `ringing-typical-ipad-portrait-dark`, `done-toast-typical-iphone-pwa-light`). DEL-1 / DEL-2 not earned (policy call 5).

## Held cells

- **Typography 7 (TYP-4).** Digits are `min(--fs-numeral-l, 24cqw)`, the rounded numeral face, tabular, light, `--ls-numeral`; about 88 px on the adult iPad (unchanged), 155 px on the kitchen. TYPE/code-scan timer: token **0 → 10**, localVar/other gone, under-11 0. Rendered sizes in timer jobs 25 → 27 distinct (the ×1.12 iPad tier and the text-size preference; TYP-2 read from the code, as in batch 1). No new deduction.
- **Colour 6 (COL-1).** Per `contrast-accounting.md`: Timer's 115 sub-AA samples are loading (`idle-loading`, `stalled-loading`), the idle-disabled Reset and +1 min, and 7 samples of the Home card's ringing Stop read through the fixed pill and tab bar (the visible Stop in the pill is white on coral). Same exemption class as F260, Prayer and Verses. COL-5 was available at batch 1 (the same `-ink`/`--sel-ink-strong` pattern) and was not given; nothing changed it, so not added.
- **Shape 5.5 (SHP-1½).** The Timer's own surfaces have **no** content glass (dial, ask, ended line, custom panel, list are all `--material-solid-bg` or `--surface`). The area's 15 of 178 content-glass jobs are the shell's chat bubbles and pull-to-refresh and Tally's Reset in `chip-overflow` (`glass.json` areas.timer.content). That is the same picture batch 1 halved, unchanged by this batch, so I hold it (policy call 1). Radii: adult large radii 100 % on tokens (12 control, 28 card); kid 38 is the kid `--r-card`. No SHP-4.
- **Motion 4.5.** MOTION/cls: 0 moves on iPhone and iPad, before and after; press 8/8 → 13/14 (the 14th is the text field). The ring's dash transition and the done pulse existed at batch 1 with no MOT-5; Replace is an inline confirm and Reset/Stop have no Undo, so MOT-5 is still not earned.
- **Dark 6.5.** No dark-only failure in timer jobs; the kitchen dark landscape, ringing dark and kid dark all hold (`kitchen-typical-ipad-landscape-dark`, `ringing-typical-desktop-dark`, `kid-typical-ipad-portrait-dark`).
- **Glance 5.5 (GLA-1).** The person's iPad still caps the dial at 400 px with ~88 px digits (~2.5 m), portrait and landscape (`running-typical-ipad-portrait-light`, `crops/paused-ipadL.png`). The 4.3 m reading is the kitchen kind only (`kitchen-typical-ipad-portrait-light`, 679 px dial, 155 px digits). Policy call 3.

## Policy calls (stated so they can be overruled)

1. **SHP-1½ held** (cross-area glass counted, as batch 1 did). Excluding it: SHP-1 lifts and SHP-2 earns → Shape 6.5, row **6.09**.
2. **ICO-4 applied** for Reset (rotate-ccw) vs Stop (square) on one action. Dropped: Icons 6.5, row **6.05**.
3. **GLA-2 not given** for the kitchen-only 4.3 m. Given: Glance 6.5, row **6.09**.
4. **EOU-6 not applied**: Phase 4 and batch 1 never charged the app's one-tap Reset; the Home card's icon-only Stop next to Pause (no Undo, `home-timer-typical-desktop-light`) is the same action. Applied: Ease 5, row **5.91**.
5. **DEL-2 not given**: voice entry already exists on Home ("Say it instead"); the kid food pictures are a touch, not a signature experience. Given: Delight 6.5, row **6.09**.
6. **LAY-5 earned** on the landscape second column. Withheld: Layout 6.5, row **5.95**.
7. **LAY-1 kept off** on the kid ×1.25 grid (batch 1's policy). Applied as a half (88.2 %): Layout 6.5, row **5.95**.

**Range 5.9-6.2. Central 6.0.**

## Found while judging, ranked

1. **Medium: the screen is now a control panel in every state, the alarm included.**
   - Under the dial, at all times: 7 presets, Custom, the label field, up to 3 recents, New timer, the Sound control, Say it, Notify me. The ringing state keeps all of it (`ringing-typical-iphone-pwa-light`, `ringing-typical-ipad-portrait-dark`). The recents repeat presets ("15:00" under "15 min", "3:00" under "3 min", `running-typical-iphone-pwa-light`). In `running-overflow-ipad-landscape-dark` the same long label shows four times (dial, field, recent, list).
   - Smallest fix: while a timer runs or rings, collapse presets, Custom and the label behind the existing "New timer"; put Sound and Notify me in one "Sound & alerts" disclosure; drop a recent that equals a preset with no label.
2. **Medium-low: one action, two names and two drawings (ICO-4); a redundant pair while ringing.**
   - Ringing shows Stop and Reset side by side and both run `stopRow` (`ringing-typical-iphone-pwa-light`). Home and the kitchen call clearing a running timer "Stop" (square, icon-only on Home, no Undo) while the app calls it "Reset" (rotate-ccw) (`shell/home-timer-typical-desktop-light`, `kitchen-home-typical-ipad-landscape-light`).
   - Smallest fix: hide Reset while ringing; on Home and the kitchen use rotate-ccw "Reset" (or "Cancel") for a running timer and keep the square only for silencing an alarm; give that Home action the 6 s Undo toast.
3. **Medium-low: an unseen end is said three times and looks like a live alarm.**
   - `ended-unseen-typical-iphone-pwa-light`: the dial says "Time's up" with Stop, the line says "Bread timer ended at 8:37 AM · OK", and the list chip says "bread Time's up". The label also reads "bread" in the dial and "Bread" in the line.
   - Smallest fix: when the end was unseen, the dial's state line reads "Ended 8:37 AM", #go reads OK, and the separate line is dropped (or the line is kept and the dial is quiet). Capitalise the label the same way in both.
4. **Low: the iPad-landscape sidebar pill's digits shrank by about a third.**
   - Digit height about 28 px before, about 18 px after (`crops/pill-ipadL-before.png`, `crops/pill-ipadL-after.png`, from `pill-overflow-ipad-landscape-dark`). The old pill overflowed its capsule, so the fit is better; but this is the only timer readout on Home in landscape.
   - Smallest fix: with one timer that is not ringing, size the time at `min(var(--fs-glance-3), 11cqw)` of the sidebar; keep `--fs-title2` for the two-row ringing pill.
5. **Low: the state words are small next to the digits.** "Paused" and "Time's up" render about 16-19 px under about 88 px digits on the adult iPad (`crops/paused-ipadL.png`, `ringing-typical-ipad-landscape-light`), so from across the room the done state rests on colour, pulse and sound. Smallest fix: `min(var(--fs-title2), 8cqw)` on the adult iPad, as the kitchen already does.
6. **Low: kid pictures and words.** The egg is a bare oval that reads as "0" or "O" at kid size (`kid-typical-iphone-pwa-light`, `kid-typical-ipad-portrait-dark`). "New timer" and "Say it" reach the kid as words only (`kid-running-typical-ipad-portrait-light`). Smallest fix: a fried-egg or cracked-egg drawing in the sprite; hide New timer and Say it for kids, or give them the picture-above-word layout.
7. **Low: "Keep" carries an X.** In the replace question, X reads as close or delete, the opposite of keeping the running timer (`replace-typical-iphone-pwa-light`). The tapped "3 min" also shows as selected while the dial still reads 6:20. Smallest fix: no icon (or `i-timer`) on Keep; set `aria-pressed` on the preset only after Replace.
8. **Nit: two dead buttons beside Start at idle.** "+1 min" and Reset sit disabled at full size on the first screen (`idle-typical-iphone-pwa-light`, `kid-typical-iphone-pwa-light`). Smallest fix: `visibility:hidden` until a timer exists (keeps the row height, nothing moves).
9. **Nit: the kitchen's timer is the dullest state in the app.** Graphite ring and grey Pause (`kitchen-typical-ipad-portrait-light`). It is the kitchen's chosen colour, so admin can change it; consider defaulting the kitchen to the Timer's coral.
10. **Nit: "Timer / Timer 6:20".** An unlabelled timer on the Home card repeats the card title (`shell/home-timer-typical-desktop-light`). Smallest fix: show "6:20 left" or the owner's name in that slot.

Positive checks: the dial stays round at 0:00 with nothing moving (`ringing-*` vs the oval `done-*`); Pause is the primary while running; time over an hour reads h:mm:ss (`running-overflow-ipad-landscape-dark`: "1:44:06"); the TV shows "Elizabeth 6:21 left" in the feed (`tv/board-typical-tv-light`).

## Not judged without a device

Real blur and SF faces; iOS `:active`; the pulse, ring transition and repeat ring (stills only); the sounds; Say it on iOS; the push at the end; the wake lock; the kitchen iPad's 4.3 m reading by eye; a keyboard Tab walk (NAT-6).
