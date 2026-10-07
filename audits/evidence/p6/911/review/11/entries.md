# Batch 11 — Tally: 15 entries

### Batch 11 — Tally counter (15)

#### UX-TALLY-1 — Reset to zero wipes the count in one tap, with no confirm and no undo, and pre-readers are shown it

- **Area** tally · **Type** usability · **Severity** medium · **Effort** S · **Batch** 11
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: Minor: "three identical-material buttons" is not exact. Only + and Reset share the glass-strong fill. The minus button uses the lighter --glass and reads darker, and Reset is a pill, not a disc. The substance still holds: nothing about Reset (no icon, no colour) signals that it destroys the count.
- **Evidence.** `audits/03-apps/tally.md:486`; `apps/tally.html:155`, `apps/tally.html:140`; `audits/evidence/p3/tally/kid-after-reset-ipad-portrait.png`, `audits/screens/tally/kid-typical-iphone-pwa-light.png`
- **What happens now.** Reset calls `set(0)` at once (`apps/tally.html:155`). As Ezra the count went 13 → 0 with no dialog, no toast and no undo (`audiences.json` kid: `dialogs:[]`, `toast:null`).
- **Why it matters.** One tap wipes the count, and pre-readers are shown it.
- **Proposed fix.** Reset shows an Undo toast ("Reset from 37 · Undo") and moves away from + as a smaller ↺ icon; kids get the same undo. (Phase 3: IMP-TALLY-P1, IMP-TALLY-P4)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/audiences.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 11's checks.

#### GAP-TALLY-1 — One counter per person, with no history, step size or feedback sound

- **Area** tally · **Type** feature gap · **Severity** low · **Effort** M · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:574`; `apps/tally.html:150`, `apps/tally.html:150-155`
- **What happens now.** There is a single `count` key (`apps/tally.html:150`), and no record of past counts or resets.
- **Why it matters.** Counter apps offer more than one counter.
- **Proposed fix.** Several named counters per person (item: rows) with a short list of recent resets; no routine or reward system. (Phase 3: IMP-TALLY-F3)
- **How it will be verified.** recapture its screens (capture area tally) and compare; plus batch 11's checks.

#### P3-TALLY-04 — − at 0 is not disabled and gives no feedback, yet every tap writes and re-stamps the row

- **Area** tally · **Type** bug · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:285`; `apps/tally.html:152`, `apps/hub.js:236-241`, `apps/tally.html:155`, `worker/src/data.js:60`; `audits/evidence/p3/tally/verify-minus-at-zero-silent-write-1.png`
- **What happens now.** `set(Math.max(0, -1))` writes 0 (`apps/tally.html:152`). `hub.set` always queues and re-stamps, and never compares with the current value (`apps/hub.js:236-241`). Three taps sent 3 batch POSTs of value 0. The button stays enabled, and nothing tells a child why nothing happened. Reset at 0 behaves the same way (`apps/tally.html:155`;
- **Why it matters.** A child pressing − at 0 gets no response. On a device that has not pulled yet, a − that visibly did nothing can wipe the count someone just made on another device.
- **Proposed fix.** Disable − at 0 and send no write when the value does not change. (Phase 3: IMP-TALLY-P10)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/verify-minus-at-zero-silent-write-1.mjs"`, `node "audits/tools/phase3/tally/verify-minus-at-zero-silent-write-2.mjs"`, `node "audits/tools/phase3/tally/rapid.mjs"` — the defect must no longer reproduce; plus batch 11's checks.

#### P3-TALLY-08 — Tally shows and counts from any value chat writes: −13, 12.5 and 1e21 are shown as-is

- **Area** tally · **Type** bug · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:423`; `worker/src/chat.js:52`, `apps/tally.html:150`, `worker/src/chat.js:29-30`, `apps/tally.html:150-152`; `audits/evidence/p3/tally/critic-chat-values-minus13-after-plus-ipad.png`, `audits/evidence/p3/tally/verify-critic-count-not-sanitised-3-2-minus13-ipad.png`
- **What happens now.** `n()` is `Number(value) || 0`, with no rounding, clamping or finite check (`apps/tally.html:150`). `show()` prints it raw (`:151`), and `set()` clamps only on write with `Math.max(0, v)` (`:152`). `set_data`'s value schema is `{}`, and the handler stores `input.value` unchecked (`worker/src/chat.js:29-30, 173-179`).
- **Why it matters.** A kid who asks chat to "take 50 off my tally" could end up with a negative count, and pressing + then wipes it to 0. It is odd and confusing rather than destructive.
- **Proposed fix.** n() rounds, clamps at 0 and rejects non-finite values; set_data validates Tally's value. (Phase 3: IMP-TALLY-P10)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/critic-chat-values.mjs"`, `node "audits/tools/phase3/tally/verify-critic-count-not-sanitised-3-1.mjs"`, `node "audits/tools/phase3/tally/verify-critic-count-not-sanitised-3-2.mjs"` — the defect must no longer reproduce; plus batch 11's checks.

#### P3-TALLY-09 — Opened on the TV, Tally offers live-looking +, − and Reset

- **Area** tally · **Type** bug · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:455`; `apps/tally.html:152`, `apps/hub.js:234`, `index.html:626`, `index.html:642`; `audits/evidence/p3/tally/kiosk-standalone-tv.png`, `audits/evidence/p3/tally/verify-critic-kiosk-offers-edit-controls-4-2-tv-after-tap.png`
- **What happens now.** The shell does not open Tally for the kiosk. On boot a kiosk always goes to Home (`index.html:626`), and `showTab` rewrites the hash to `#home` (`index.html:642`) with no toast.
- **Why it matters.** On the 10-foot TV a family member sees tappable-looking buttons that answer only with a toast.
- **Proposed fix.** When !hub.canWrite, hide the controls and show the pill as view-only. (Phase 3: IMP-TALLY-P10)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/verify-critic-kiosk-offers-edit-controls-4-1.mjs"`, `node "audits/tools/phase3/tally/verify-critic-kiosk-offers-edit-controls-4-2.mjs"`, `node "audits/tools/phase3/tally/audiences.mjs"` — the defect must no longer reproduce; plus batch 11's checks.

#### P4-GLASS-05 — Tally's five content-glass layers add 8-31 % to a burst of + taps, for a blur nobody can see

- **Area** design system (Tally) · **Type** bug · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/04-design-system.md:3478`; `apps/tally.html:45-51`
- **What happens now.** The layers. Tally's dial, +, −, Reset and the who kicker are all live glass (`apps/tally.html:45-51, 73-79, 98-104`), plus the shell's viewer bar: 6 visible layers, all `blur(18px) saturate(1.4) brightness(1.02)`. The author accepted it on purpose: "Not inside a scroller, so backdrop-filter is fine" (`:95-97`). The backdrop.
- **Why it matters.** Kids tap + fast. On the iPad each tap pays to re-blur a flat wash that looks the same with or without the blur.
- **Proposed fix.** Tally's dial and pill become solid; glass stays on + and −.
- **How it will be verified.** Rerun `node "audits/tools/phase4/GLASS/verify-tally-taps-glass-cost-2.mjs"` — the defect must no longer reproduce; plus batch 11's checks.

#### UX-TALLY-3 — Counting takes 3 taps from Home, and Home never shows the count

- **Area** tally · **Type** usability · **Severity** low · **Effort** M · **Batch** 11
- **Verified (step 3).** was medium; skeptics low (partly) and low. Correction: The item says counting 'misses the brief's target' as if this were a defect. EOU-1 (04-design-system.md:193) is a +1 bonus criterion, and the penalty rule EOU-5 only fires at 4 or more taps, so 3 taps is neutral under the house rubric.
- **Evidence.** `audits/03-apps/tally.md:501`; `apps.json:7`; `audits/evidence/p3/tally/kid-apps-grid-ipad-portrait.png`
- **What happens now.** Home → Apps → Tally tile → + is 3 taps for Eli on iPhone and Ezra on iPad. Home has no Tally card or button.
- **Why it matters.** Counting takes 3 taps and Home never shows the count.
- **Proposed fix.** A wide Home widget with the count and a + button (1 tap to count). (Phase 3: IMP-TALLY-F2)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### UX-TALLY-4 — VoiceOver hears "Add one" but never the new count

- **Area** tally · **Type** usability · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:506`; `apps/tally.html:134-140`
- **What happens now.** VoiceOver hears "Add one" but never the new count (low). `#n` has no `aria-live` and no `role=status`. Reset has no `aria-label` and relies on its text. Evidence: `apps/tally.html:134-140`; `audiences.json` `kid.ui.liveRegion: false`.
- **Why it matters.** VoiceOver never hears the count.
- **Proposed fix.** aria-live="polite" on the count; aria-label on Reset. (Phase 3: IMP-TALLY-P9)
- **How it will be verified.** recapture its screens (capture area tally) and compare; plus batch 11's checks.

#### UX-TALLY-5 — On a phone turned sideways, + is below the fold and the pill overlaps the dial

- **Area** tally · **Type** usability · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:507`; `apps/tally.html:40`; `audits/evidence/p3/tally/landscape-phone-eli.png`
- **What happens now.** At 932×430 the frame is 382 px tall, but the dial stays 360 px (Eli) or 400 px (Ezra), because its size depends on width only (`apps/tally.html:40, 124`).
- **Why it matters.** + is below the fold sideways.
- **Proposed fix.** Size the dial with min(vw, vh) so + fits on a phone in landscape. (Phase 3: IMP-TALLY-P8)
- **How it will be verified.** Rerun `node "audits/tools/phase3/tally/landscape-phone.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 11's checks.

#### VIS-TALLY-2 — In kid mode the name pill overlaps the top of the dial on iPad landscape and iPhone Safari

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:527`; `apps/tally.html:124`; `audits/evidence/p3/tally/layout-typical-ezra-ipad-landscape-light.png`, `audits/evidence/p3/tally/layout-typical-ezra-iphone-safari-light.png`
- **What happens now.** The kid dial is sized from the width only (`clamp(260px, 80vw, 400px)`, `apps/tally.html:124`), and the pill is fixed at the top (`:117`).
- **Why it matters.** The pill overlaps the dial.
- **Proposed fix.** Kid dial sized from min(vw, vh); the pill never overlaps it. (Phase 3: IMP-TALLY-P8)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### VIS-TALLY-4 — The − disc is lighter glass than +, so it reads as secondary or disabled

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:536`; `apps/tally.html:69`; `audits/screens/tally/main-typical-ipad-portrait-light.png`, `audits/screens/tally/kid-typical-iphone-pwa-light.png`
- **What happens now.** − uses `--glass` and + uses `--glass-strong` (`apps/tally.html:69, 84`).
- **Why it matters.** − looks disabled.
- **Proposed fix.** − and + share the same material; − is distinguished by its glyph only. (Phase 3: IMP-TALLY-P6)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### VIS-TALLY-6 — Large counts are not grouped

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:546`; `apps/tally.html:151`; `audits/screens/tally/main-overflow-iphone-pwa-dark.png`, `audits/screens/tally/main-overflow-ipad-portrait-light.png`
- **What happens now.** `textContent = v` (`apps/tally.html:151`) shows "1284750" and "250000".
- **Why it matters.** Large counts are hard to read.
- **Proposed fix.** Group digits with toLocaleString. (Phase 3: IMP-TALLY-P3)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### VIS-TALLY-8 — Whose counter it is shows only as the wash hue and a 12 px caps pill, with no avatar

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:555`; `apps/design.css:333`, `apps/design.css:280-283`, `apps/hub.js:459-462`, `apps/tally.html:130`; `audits/screens/tally/main-typical-ipad-portrait-light.png`
- **What happens now.** The pill is "ELI'S COUNTER": 12 px, weight 700, uppercase (`.kicker`, `apps/design.css:333`).
- **Why it matters.** Whose counter it is shows only as a hue.
- **Proposed fix.** The pill carries the person's face (hub.avatarHtml) and scales in kid mode. (Phase 3: IMP-TALLY-P8)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### VIS-TALLY-10 — The dial's tick ring shows in some themes only

- **Area** tally · **Type** visual · **Severity** low · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:565`; `apps/tally.html:54`; `audits/screens/tally/main-typical-iphone-pwa-light.png`, `audits/evidence/p3/tally/theme-parchment-lightos-eli.png`
- **What happens now.** The dashed ring (`apps/tally.html:54`) is nearly invisible on the white dial in light Hearth and Frost, and clearly drawn in dark and in Parchment.
- **Why it matters.** The ring shows in some themes only.
- **Proposed fix.** The tick ring reads --track-info so it shows in every theme.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 11's checks.

#### UX-TALLY-6 — Moved to P3-TALLY-09

- **Area** tally · **Type** usability · **Severity** low (pointer) · **Effort** S · **Batch** 11
- **Evidence.** `audits/03-apps/tally.md:513`
- **Proposed fix.** Pointer to P3-TALLY-09.

#### Improvements with no finding (tally)

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). The household kept all of them (`audits/05-decisions.md`, "Features kept or cut"), so each app batch carries its own.

| ID | Improvement | Kind | Delight | Effort | Source | Status |
|---|---|---|---|---|---|---|
| IMP-TALLY-I1 | Across-the-room mode on the iPad: when idle, hide Reset and enlarge the count (for example a kids' game score on the Kitchen iPad) | idea | 3 | M | `audits/03-apps/tally.md:762` | open |
