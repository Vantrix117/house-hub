# Phase 4 scorecard: the Kitchen timer row, confirmation pass on the final code (final-6b)

**Independent judge, second pass.** The method, the bases and the reading of the rules are unchanged from the first pass (`rescore-6/rescore.md`). Typography and Shape stay provisional (no backdrop blur, fallback fonts).

## Evidence, all on the final code

**After captures:** `audits/screens-after/6/timer/*.png`, recaptured in final-6b (13:31-13:36). The 10 `replace-typical-*` files are stale (07:49): the state no longer exists and is now `new-timer-typical-*`.
- **22 before/after pairs** in `rescore-6/pairs-final/`:
  - iPhone: idle, running, ringing, paused, running-overflow, pill-overflow, done-toast, idle-loading;
  - iPad portrait: running (light), ringing (dark), done-toast;
  - iPad landscape: running (dark), ringing (light), paused (dark), running-overflow (dark), pill-overflow (dark);
  - desktop: running (light), idle-empty (light);
  - kid: iPhone light, iPad portrait dark, iPad landscape light, and kid-running on iPhone Safari dark.
- **Opened at full size:**
  - `ended-unseen-typical-iphone-pwa-light`, `new-timer-typical-iphone-pwa-light`;
  - `kitchen-typical-ipad-landscape-dark`, `kitchen-home-typical-ipad-landscape-light`;
  - `shell/home-timer-typical-desktop-light`, `shell/home-timer-typical-ipad-landscape-light`.
- **Crops:** `crops/pill-ipadL-final.png`, `crops/paused-ipadL-final.png`.

**Measurements:** `SCRATCH/final-6b/measure/agg/` against `p6/1/measure` (`cmp2b.cjs`, `cmp3b.cjs`) and `audits/evidence/p6/6/measure/contrast-accounting.md` (final-6b).

**Phase 4 tools:** `p4tools/out` (8/8 exit 0) against `before` (8/8 exit 0).
- Every `before` timer line matches the pre-batch numbers used in the first pass: ICON uses 0, press 8/8, cls 0 moves, macro grid 92.3 %, V2 span 560, TELL 8 controls.

**Not run:** the capture rig, any tool, a Tab walk.

## The row

| Dimension | Base | b1 | First pass | **Final** | Rules now applied |
|---|---|---|---|---|---|
| Typography* | 6 | 7 | 7 | **7** | TYP-4 |
| Colour | 5 | 6 | 6 | **6** | COL-1 |
| Layout | 6.5 | 6 | 7 | **7** | LAY-5 (LAY-2 lifted) |
| Shape* | 6 | 5.5 | 5.5 | **5.5** | SHP-1½ |
| Icons | 5.5 | 3.5 | 6 | **6.5** | ICO-1 (ICO-4 lifted) |
| Motion | 4.5 | 4.5 | 4.5 | **4.5** | none |
| Dark | 6.5 | 6.5 | 6.5 | **6.5** | none |
| Native | 6.5 | 6 | 6.5 | **6.5** | none |
| Glance | 4.5 | 5.5 | 5.5 | **5.5** | GLA-1 |
| Ease | 6 | 5 | 6 | **6** | none |
| Delight | 5.5 | 4.5 | 5.5 | **5.5** | none |
| **Average** | | **5.5** (5.50) | **6.0** (6.00) | **6.0** (66.5/11 = 6.05) | b1 → final **+0.5** |

## The one cell that changed: Icons 6 → 6.5 (ICO-4 lifted)

- **"Reset" with the rotate icon now means clearing a running or paused timer everywhere:**
  - the app (`running-typical-iphone-pwa-light`);
  - the Home card (`shell/home-timer-typical-desktop-light`: round pause and rotate buttons);
  - the kitchen Home (`kitchen-home-typical-ipad-landscape-light`: "Pause · Reset").
- **The square "Stop" now appears only on a ringing timer:**
  - the app's #go (`ringing-typical-iphone-pwa-light`);
  - the pill (`done-toast-typical-iphone-pwa-light`).
- **Reset is hidden while ringing**, so the two no longer sit side by side.
- **The X on "Keep" is gone** with the Replace prompt.
- **The new "Timer settings" gear** (`i-settings`) means settings only.
- **The OK check** on the ended-unseen state is a confirm, as the check means elsewhere in the area.
- **ICO-1 holds.** ICON/static: 21 sprite uses, stroke widths `{3:1}` (the ring), emoji 0. The two "glyphs" are a "×" in a CSS comment and the "…" of "Loading…" / "Listening…" (text, not icons).

## Held cells, re-checked on the final code

- **Typography 7.**
  - TYPE/code-scan: token 10, under-11 0.
  - "Paused" is about 20 px under the ~88 px digits on the iPad in landscape (`crops/paused-ipadL-final.png`), up from about 16.
- **Colour 6 (COL-1).** Timer's sub-AA text fell from 115 to 51 samples. Of these, 44 are loading-disabled controls and 7 are the Home card's ringing Stop read through the fixed bars (`contrast-accounting.md`). The idle Reset and +1 no longer sample.
- **Layout 7.**
  - SHAPE/verify V2 is unchanged: span 984 at 1180 and at 1440.
  - LAY-5's second column holds (`running-typical-ipad-landscape-dark`).
  - Macro 4 px grid: 88.2 → **90.8 %**. LAY-1 would not apply even literally now, so first-pass policy call 7 is gone.
  - MOTION/cls: 0 moves on the iPhone and the iPad.
  - A by-area reading of LAY-2 is new policy call 6 below.
- **Shape 5.5.** `glass.json` areas.timer.content is still only the shell's chat bubbles and pull-to-refresh plus Tally's Reset (15 of 178 jobs). The Timer's own surfaces are solid. Adult radii are 100 % on tokens (12, 28); kid 38.
- **Motion 4.5.**
  - MOT-5 is not earned in the app: its Reset still has no Undo; the Home card's Reset Undo is the shell's.
  - Press: 10/11 (the 11th is the text field).
- **Dark 6.5.** No dark-only failure. Kitchen dark landscape is coral (`kitchen-typical-ipad-landscape-dark`).
- **Native 6.5.**
  - TELL: 10 controls, all unselectable, imgs 0, draggable 0, no field under 16 px.
  - NAT-6 is still not earned: no Tab-walk evidence.
- **Glance 5.5.** The person's iPad still has the 400 px dial and ~88 px digits. The kitchen's landscape dial is now about 610 px.
- **Ease 6.**
  - Kid route: food pictures with the fried egg, Start across the full row, ≥ 64 px (`kid-typical-iphone-pwa-light`).
  - EOU-1 is still not met: the Home card is not on a first screen.
- **Delight 5.5.** Unchanged.

## Policy calls (stated so they can be overruled)

1. **SHP-1½ held** (cross-area glass). Excluded: row **6.14**.
2. *(Resolved: ICO-4 is lifted on the evidence.)*
3. **GLA-2 not given** for the kitchen-only reading. Given: **6.14**.
4. *(Mostly resolved: Home and the kitchen give Undo on Reset. The app's Reset has none; this is consistently not charged, see new issue C.)*
5. **DEL-2 not given.** Given: **6.14**.
6. **New: LAY-2 by area.** In the calm running and ringing states, the landscape and desktop right column holds one row of buttons, and about two thirds of the frame below the dial is empty (`running-typical-desktop-light`, `ringing-typical-ipad-landscape-light`). Read by area rather than width, LAY-2 returns: Layout 6.5, row **6.0** (6.00).

Range: **6.0-6.3**. Central: **6.0** (6.05).

## The first pass's 10 items

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Control panel in every state | **FIXED** | Running, paused and ringing now show only the dial, the actions and New timer (`running-typical-iphone-pwa-light`, `ringing-typical-ipad-portrait-dark`). The picker opens from New timer (`new-timer-typical-iphone-pwa-light`). Sound and Notify me sit behind "Timer settings". The duplicate recents are gone; only "12:00 · pasta" remains. |
| 2 | One action, two names; Stop + Reset while ringing | **FIXED** | Reset (rotate) on app, Home and kitchen; Stop (square) only while ringing; Reset hidden while ringing (`ringing-typical-iphone-pwa-light`, `shell/home-timer-typical-desktop-light`, `kitchen-home-typical-ipad-landscape-light`). |
| 3 | Unseen end said three times | **PARTLY** | One message now: "Ended 8:37 AM" in the dial with OK; the separate line is gone (`ended-unseen-typical-iphone-pwa-light`). But the dial keeps the full alarm dress (pink wash, outer ring, filled track, bell), and the list chip still says "bread Ended". It reads as a live alarm at a glance. |
| 4 | iPad-landscape pill digits shrank | **FIXED as specified** | One timer: the time has its own row, about 31 px (`shell/home-timer-typical-ipad-landscape-light`). With three timers the pill is still one row at about 18 px digit height (`crops/pill-ipadL-final.png`, from `pill-overflow-ipad-landscape-dark`); my fix asked only for the single-timer case. |
| 5 | State words small | **FIXED** | `min(--fs-title2, 8cqw)`: "Paused" about 20 px on the iPad in landscape, "Time's up" visibly larger on the iPhone (`crops/paused-ipadL-final.png`, `ringing-typical-iphone-pwa-light`). |
| 6 | Kid egg and word-only controls | **FIXED** | Fried egg (`kid-typical-iphone-pwa-light`, `kid-typical-ipad-portrait-dark`); kids see no New timer, Say it or settings (`kid-running-typical-iphone-safari-dark`). |
| 7 | Keep with an X; preset selected early | **FIXED** (removed) | The Replace prompt is gone: no preset shows while a timer runs. |
| 8 | Dead +1 and Reset at idle | **FIXED, with a side effect** | They are hidden (`idle-typical-iphone-pwa-light`), but they keep their space, so Start sits alone at the left of an empty row. See new issue A. |
| 9 | Graphite kitchen | **FIXED** | Coral (`kitchen-typical-ipad-landscape-dark`). |
| 10 | "Timer / Timer 6:20" | **FIXED on Home** | The Home card shows "6:20" alone (`shell/home-timer-typical-desktop-light`). In the app's list an unlabelled timer still reads "Timer 6:20" (`ended-unseen-typical-iphone-pwa-light`, `new-timer-typical-iphone-pwa-light`); acceptable, because there it names a chip. |

## New, ranked

**A. Medium-low: the action row is lopsided whenever a button is hidden.**
- **What is wrong:** +1 and Reset are `visibility:hidden`, so they still take their width (`timer.html:481`).
  - **Idle and New timer:** Start is a short capsule at the left with blank space to its right (`idle-typical-iphone-pwa-light`, `new-timer-typical-iphone-pwa-light`, `idle-empty-desktop-light`).
  - **Ringing:** Stop and +1 sit left of the dial's axis, about 75 px off centre on the iPad in portrait (`ringing-typical-ipad-portrait-dark`).
  - In every adult state the primary is now narrower than in the first pass: Pause is about 145 px on the iPhone, against about 245.
- **Smallest fix:** keep the row's height but not the widths. Use `display:none` on the hidden buttons with a `min-height` on `.actions`, and centre the row. Or make the hidden pair `position:absolute; visibility:hidden` so #go can grow with `flex: 1 1 100%`, as the kid row already does.

**B. Low: the calm states leave landscape and desktop mostly empty.**
- **What is wrong:** with only one action row and New timer, the right column is short and top-aligned beside a dial still capped at 400 px. About two thirds of the frame is blank (`running-typical-ipad-landscape-dark`, `ringing-typical-ipad-landscape-light`, `running-typical-desktop-light`). This is policy call 6.
- **Smallest fix:** in the calm states, centre the column against the dial (`align-self:center`) and lift the adult landscape cap to about `min(46vw, 78vh, 560px)`. That is the kitchen rule at a smaller size, and it also helps UX-TIMER-5 on the person's own iPad.

**C. Low: Undo on Reset exists on Home but not in the app.**
- **What is wrong:** the same action, with the same name and drawing, can be undone from the Home card and the kitchen but not from the Timer itself (`apps/timer.html` has no restore or Undo).
- **Smallest fix:** in `reset.onclick`, call `hub.toast('Timer reset', 6000, { action: 'Undo', onAction: () => T.restore(row) })` with the owner check the shell uses. This would also earn MOT-5 +½ (Motion 5, row 6.09).

**D. Low: the kid dial shrank on the iPhone and the iPad in landscape.**
- **What is wrong:** the new kid cap `min(82vw, 44vh, 400px)` applies on every kid device, not only at 375×667.
  - Kid iPhone dial: about 345 → 290 px (`kid-running-typical-iphone-safari-dark`).
  - Kid iPad landscape dial: about 385 → 325 px (`kid-typical-ipad-landscape-light`).
  - The digits shrink with it.
- **Smallest fix:** apply the 44vh cap only under `@media (max-height: 700px)`.

**E. Low: "Notify me when it ends" is one tap deeper again.**
- **What is wrong:** GAP-TIMER-1 asked for the permission offer in context; it now sits inside "Timer settings" (`idle-empty-desktop-light`).
- **Smallest fix:** show Notify me inline once, on the first Start when permission is still `default`, and keep it in settings afterwards.

**F. Nit: the ended-unseen dial dresses as a live alarm** (item 3's remainder).
- **Smallest fix:** while `ended` and past the ring window, drop the outer ring and the wash, keep the filled track, and draw the state without the bell (or with `i-check`).

## Not judged without a device

Blur and the system fonts; iOS presses; the pulse and the repeat ring; the sounds; Say it; the push; the wake lock; the kitchen from 4.3 m by eye; a Tab walk.


# Kitchen timer rescore: confirmation addendum (third final run, final-6c)

This adds to `rescore-final.md`. The method, the bases and the policy calls are unchanged. I did not run the capture rig or any tool.

## Evidence

**Captures:** `audits/screens-after/6/timer/` was recaptured at 17:15-17:20.

**Pairs:** 10 before/after pairs in `rescore-6/pairs-confirm/`:
- idle and running on the iPhone (light);
- ringing on the iPad portrait (dark);
- running on the iPad landscape (dark);
- running and idle-empty on the desktop (light);
- paused on the iPad landscape (dark);
- kid on the iPhone (light) and the iPad landscape (light);
- kid-running on iPhone Safari (dark).

**Also opened:** `ended-unseen-typical-iphone-pwa-light`.

**Tools:** `p4tools/out` against `before` (both 8/8 exit 0):
- Timer: ICON 23 sprite uses; strokes `{3:1}`; the "×" glyphs are both in CSS comments.
- Press 10/11.
- Layout shift: 0 moves on the iPhone and the iPad.
- Macro 4 px grid 90.2 %.
- TELL: 10 controls, 0 draggable.
- SHAPE/verify V2: span 1127 at 1180 and 1144 at 1440.

**Measurements:** final-6c `contrast-accounting.md`: Timer has 43 sub-AA samples. 36 are loading-disabled controls; 7 are the Home card's Stop read through the fixed bars. `glass.json` is unchanged: the only content glass in the Timer's screens is the shell's and Tally's.

## Final row

| Dimension | b1 | First pass | Final (6b) | **Confirm (6c)** | Rules |
|---|---|---|---|---|---|
| Typography* | 7 | 7 | 7 | **7** | TYP-4 |
| Colour | 6 | 6 | 6 | **6** | COL-1 |
| Layout | 6 | 7 | 7 | **7** | LAY-5 |
| Shape* | 5.5 | 5.5 | 5.5 | **5.5** | SHP-1½ |
| Icons | 3.5 | 6 | 6.5 | **6.5** | ICO-1 |
| Motion | 4.5 | 4.5 | 4.5 | **5** | MOT-5 +½ |
| Dark | 6.5 | 6.5 | 6.5 | **6.5** | none |
| Native | 6 | 6.5 | 6.5 | **6.5** | none |
| Glance | 5.5 | 5.5 | 5.5 | **5.5** | GLA-1 |
| Ease | 5 | 6 | 6 | **6** | none |
| Delight | 4.5 | 5.5 | 5.5 | **5.5** | none |
| **Average** | **5.5** | **6.0** | **6.0** (6.05) | **6.1** (67/11 = 6.09) | b1 → confirm **+0.6** |

## Cells that changed

**Motion 4.5 → 5: MOT-5 +½ earned.** The in-app Reset, the main destructive action, now gives a 6 s Undo toast:
- `apps/timer.html:594-596`: "Timer reset" / "<label> timer reset" with Undo;
- owner-checked;
- the same wording as the Home card and the kitchen card.

A ringing timer's Stop has no Undo; it silences the alarm (`:590`). No second ½: the state changes are fades and the done pulse, which existed at batch 1.

**Layout: held at 7, but policy call 6 is gone.** In landscape the dial is now about 540 px with #go level with its centre (`running-typical-ipad-landscape-dark`, `running-typical-desktop-light`, `idle-empty-desktop-light`). The frame is no longer mostly empty, so the by-area reading of LAY-2 no longer bites.

## A-F status

| Item | Status | Evidence |
|---|---|---|
| A: lopsided action row | **FIXED** | Start, Pause and Stop fill row 1; +1 and Reset share row 2 (`running-typical-iphone-pwa-light`, `ringing-typical-ipad-portrait-dark`, `kid-running-typical-iphone-safari-dark`); at idle Start is alone and full width (`idle-typical-iphone-pwa-light`). |
| B: empty landscape and desktop | **FIXED** | Dial about 540 px, actions centred on it (`running-typical-ipad-landscape-dark`, `running-typical-desktop-light`, `kid-typical-ipad-landscape-light`). |
| C: no Undo in the app | **FIXED** | Code at `timer.html:594-596`. No capture shows the toast; test-timer 115/0 is as reported. |
| D: kid dial shrank | **FIXED** | Full size on the iPhone PWA (`kid-typical-iphone-pwa-light`, about 350 px) and the iPad landscape (`kid-typical-ipad-landscape-light`). The cap still applies, as designed, in the shorter iPhone Safari frame (`kid-running-typical-iphone-safari-dark`, about 290 px). |
| E: Notify me buried | **FIXED by code; not seen** | A one-time inline offer after the first Start (`timer.html:190-193, 290, 692`). No capture shows it, as the rig does not reach that state. |
| F: the unseen dial looks live | **FIXED** | No wash, no outer ring, no pulse; "Ended 8:37 AM" with OK (`ended-unseen-typical-iphone-pwa-light`). The bell stays beside "Ended"; acceptable. |

## New, ranked

1. **Nit (accepted by the visual reviewer).** About 90 px of empty band under Start at idle on the iPhone (`idle-typical-iphone-pwa-light`); it is the reserved height of row 2. It reads as section spacing. Smallest fix, if wanted: reserve that height only when a timer exists.
2. **Nit.** The ended-unseen list chip still repeats the state ("bread Ended") right under the dial's "Ended 8:37 AM" (`ended-unseen-typical-iphone-pwa-light`). Harmless.

Nothing else is new.

## Policy calls

**Unchanged from rescore-final:**
- SHP-1½ held. Excluded: 6.18.
- GLA-2 not given. Given: 6.18. The case for it is stronger now: in landscape the person's iPad reads at about 4 m and the kitchen at about 4.3 m, but in portrait it is still a 400 px dial at about 2.5-2.7 m.
- DEL-2 not given. Given: 6.18.

**Range:** 6.1-6.4. **Central:** 6.1.

**Not judged without a device:** blur and the system fonts, iOS presses, the motion, the sounds, Say it, the push, the wake lock, the 4 m readings by eye, a Tab walk, the Undo toast and the Notify offer on screen.
