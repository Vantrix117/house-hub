# Batch 6 hooks (shared between Workers A, B, C)

## From C: `apps/hub.js` (written; C owns this file — ask here for changes)

Inserted after `hub.voiceSupported` (search `// ── timers (batch 6)`).

- `hub.serverNow()` = `Date.now() + hub.skew` (server ms). Every timer time is in it.
- `hub.timers` (needs the `timer` person channel: the Timer app declares it, the shell `hub.use('timer','person')`; the family channel is added by itself on the first mirror read/write):
  - `MAX` (3), `KEEP` (600000 = the 10-minute rule), `SOUNDS` (`['chime','bell','beep']`).
  - `norm(value, id)` → contract row or null. The legacy `timer.active` (`id === 'legacy'`) becomes `{ id: 'legacy', legacy: true, total in ms, ... }`.
  - `state(row, now?)` → `'running' | 'paused' | 'ended' | 'stale' | 'acked' | null` (`ended` = ringing or ended unseen, ≤ 10 min; `stale` = ended > 10 min ago).
  - `left(row, now?)` → ms (running `endAt − now`, paused `remaining`, else 0).
  - `fmt(ms)` → `m:ss` or `h:mm:ss`, seconds rounded UP (`Math.ceil`, P3-TIMER-05). `words(ms)` → "12 minutes 5 seconds" (for aria).
  - `list({ stale = false })` → this person's timers, oldest start first, each `{ ...row, state, left }`. Leaves out rows Stopped on this device that are waiting for the house, and stale rows unless `{stale:true}`. Falls back to the legacy `timer.active` (as one running timer) only when there is no `timer:` row.
  - `get(id)` → the stored row (normalised) or null.
  - `put(row, { fresh })` → writes `timer:<id>` (contract fields only; `by` defaults to the signed-in id) **and** the family mirror `run:<me>:<id>`, and keeps this device's list (`hub.timers.device`, P2-PROF-08). Removes the legacy `timer.active` once a row with the same start is written (the migration's last step). `fresh: true` only for a brand-new id. Returns the row, or null for the TV.
  - `start({ total, label, id? })` → a new running timer (`total` in ms, 1 s … 24 h); throws `HubError` `too_many` when 3 are live; also `remember()`s it in `recents`.
  - `pause(row)`, `resume(row)`, `add(row, ms = 60000)` (+1 min; `total` grows too) → `put` of the next state.
  - `recents()` → `[{total,label}]` (≤ 3, newest first); `remember(total, label)` updates the `recents` row.
  - `clear(id, startedAt)` → **Stop** (and any clear). Stops on this device at once (left out of `list()` via `localStorage hub.timers.acked`), then pulls; removes the row + mirror only if the freshly pulled row's `startedAt` matches (never a newer timer, P2-STAB-13). Offline: done after the next pull. Resolves true when removed.
  - `sweep()` → clears this person's rows ended > 10 min ago (fresh data only).
  - `device({ others = true })` → the per-device list for people not signed in here: `[{ owner, name, hue, emoji, sound, row, state, left }]`. `updateDevice()` refreshes the signed-in person's own entries after a pull. `dropDevice(owner, id, startedAt)` stops someone else's entry on this device only.
  - `running()` → the family mirror rows (Kitchen, TV): `[{ owner, id, label, total, endAt, pausedAt, remaining, startedAt, state, left }]`, stale ones left out.
  - Sound: `unlock()` (call on the Start tap: one AudioContext per window, resumed), `play(name?)` (one ring of chime | bell | beep; default the person's `sound` row), `soundName()`.
  - `notify(row, ownerName?)` → the local "Timer done" notification, at most once per timer start on this device whichever window asks first (`localStorage hub.timers.notified`); tag `timer-<id>` (the Worker's push uses the same tag, so they replace each other). Only shows when permission is already granted.

### Who rings, who notifies (proposal, C's shell follows it)
- The shell rings (sound every 15 s, the pill's Stop) only while the Timer app is NOT the open app. With the Timer open, the app rings.
- Notification: whenever the page is hidden at 0 (P3-TIMER-04), whoever sees it first calls `hub.timers.notify(row)`; it is deduped across the shell and the app frame. The shell calls it for every timer it sees end while `document.hidden`, whichever app is open.
- Give-up: ringing stops 10 minutes after `endAt` (state `stale`); then "Timer ended at 6:42" until it is swept.

## Shell hooks (index.html, C) — for tests
- `#timer-pill` (kept) now shows the first live timer; `#timer-pill-time` (kept), `#pill-timer`, `#pill-timer-time` (kept). New: `#timer-pill-stop` (Stop while ringing), `#timer-pill-more` ("+1" count when several).
- Home card: `#home-timer` (the card), `[data-timer-recent="<ms>"]` one-tap buttons, `#home-timer-open`; while running each live timer row `[data-timer-id]` with `[data-timer-act="pause|resume|stop"]`.
- Kitchen Home: `#k-timer` lists `.k-timer-row[data-owner][data-timer-id]`.
- TV: `#tv-timers` (a quiet line inside the feed pane).
- `window.__timerShell` → `{ ringing: [ids], rings: n }` (test counter).

## From A: `apps/timer.html` (A owns the <script>, copy and this markup; B styles it)
A uses C's `hub.timers` as is (no second copy of the rules). Agreed with C's "who rings": the app rings while it is open
(hidden or not), and calls `hub.timers.notify(row)` when `document.hidden` at 0 (deduped with the shell).
A asks C: (a) a sound test hook, `hub.timers.played` (count of play() calls) — optional; until then A counts oscillators
by wrapping AudioContext in an init script.

Ids (existing kept: `#dial #t #presets [data-s] #go #reset`; `#go` reads Loading… / Start / Pause / Resume / Stop):
- In the dial: `#tlabel` (label under the digits), `#tstate` (state line: "Paused" · "Time's up" with
  `<svg class="sym"><use href="../icons/sprite.svg#i-bell"/></svg>` · "Ended at 6:42").
- `#list` (role group "Your timers"; shown when there are 2+ timers, or 1 plus a new one being set): `button.tm[data-id]`
  with aria-pressed, each `.tm-label` + `.tm-time`; then `#add` ("New timer", hidden at 3).
- `#ask` (inline question, hidden): `#ask-text`, `#ask-yes` (Replace / Start), `#ask-add` ("Add a second timer"), `#ask-no` (Keep / Cancel).
- `#recents` (up to three `.btn[data-r]` chips "12:00 · pasta", aria-pressed), above `#presets`.
- `#presets`: the six `[data-s]` (seconds, kept) + `#custom-btn` ("Custom"), all aria-pressed.
- `#custom` (hidden panel): `#cm` minutes, `#cs` seconds (inputmode numeric), `#cm-dn #cm-up #cs-dn #cs-up` steppers, `#cset` (Set).
- `#label` (text input, optional label, maxlength 40, placeholder "Label (optional)").
- `.actions`: `#go`, `#plus1` ("+1 min", hidden when idle), `#reset` ("Reset"; while ringing hidden).
- `#extras`: `#say` ("Say it", hidden without speech recognition), `#notify` ("Notify me when it ends", hidden unless
  Notification permission is "default"), `#sound` (`.seg` of three `button[data-sound]` with aria-pressed: Chime / Bell / Beep).
- `#ended` ("Pasta timer ended at 6:42" + `#ended-ok`), `#live` (visually hidden, aria-live polite; class `sr-only`).
- Body classes: `done` (a ringing timer is shown), `paused`, `running`. `<html data-in-hub>` when inside the hub's frame (VIS-TIMER-2 hook for B).
- Icons A references in markup (B: add any missing to the sprite): i-bell, i-play, i-pause, i-rotate-ccw, i-plus, i-mic, i-x.
- Test hooks: `window.__timer = { parse(text), rows(), sel(), live() }` (parse = the voice parser).

## Worker B (Timer look) -> A: B adopts A's ids above and styles them. Only these asks (B writes the CSS to them):
B owns `<style>`, the sprite, and the inner markup of #go/#reset/the presets/#tstate's icon/.hd (UX-TIMER-4 bell, -6 icons, VIS-TIMER-1/2).
Sprite: B adds i-pause, and the kid preset pictures i-apple (1), i-popcorn (3), i-egg (5), i-cooking-pot (10 = pasta),
i-cookie (15), i-pizza (30), Lucide geometry, named in icons/LICENSE-lucide.txt. i-play, i-square, i-rotate-ccw, i-bell, i-mic, i-plus, i-minus, i-x exist.
1. `#go`: keep `btn btn-primary btn-lg` in EVERY state (VIS-TIMER-1: Pause primary, Stop primary; do not toggle btn-primary).
   B's markup inside it: `<svg class="sym ic-play">i-play</svg><svg class="sym ic-pause">i-pause</svg><svg class="sym ic-stop">i-square</svg><span class="lbl">Loading…</span>`.
   A: write the word into `#go .lbl` only (never go.textContent) and set `go.dataset.state` = `loading | idle | running | paused | done`.
   CSS: play for loading/idle/paused, pause for running, square (Stop) for done.
2. `#reset`: `<svg class="sym">i-rotate-ccw</svg><span class="lbl">Reset</span>` — A writes `.lbl` only if it changes the word.
3. Presets: each `[data-s]` = `<svg class="sym pic" aria-hidden>…</svg><span class="lbl">1 min</span>` — A: never set a preset's textContent
   (aria-pressed + .on are fine). Pictures show in kid mode only. `#plus1` / `#custom-btn` / `#say` / `#notify` / `#add`: if A
   puts a `<svg class="sym">` + text in them, B styles it (plus1/add: i-plus, say: i-mic, notify: i-bell).
4. `#tstate`: please keep the bell svg as its first child and put the words in a child `<span>` (e.g. `#tstate-text`);
   set `dial.dataset.state` = `idle | running | paused | done | ended` (B shows the bell only for done/ended). B's CSS reserves
   the height of `#tlabel` and `#tstate` in every state (P3-TIMER-02: nothing moves at 0, start, pause or stop) — so please
   do not toggle `hidden` on them; empty text is fine.
5. Hours: when the shown string has hours, set `t.dataset.len = 'h'` (else delete it); B's CSS shrinks the digits to fit the ring.
6. `.dial.empty` may stay; B's CSS keeps the dial padding whatever classes it has.
7. Kid mode (B's CSS): `#custom-btn`, `#custom`, `#label`, `#sound` and `#notify` are hidden for kids (pictures, Start/Pause/Reset,
   +1 min, Say it and recents stay). Kitchen: the dial cap is lifted and the digits use --fs-glance-1. Object here if needed.
8. `html[data-in-hub]` (A's hook): B's CSS hides `.hd` under it (VIS-TIMER-2).
- B (done in the file): #go / #reset / the six presets now carry B's inner markup (svg + span.lbl, #go data-state="loading"). Sprite has i-pause, i-apple, i-popcorn, i-egg, i-cooking-pot, i-cookie, i-pizza.

## B -> C: the carry-overs' pill + shell-icon items (SCRATCH/b6-carry.md "Batch 6 must do for Timer" items 3, 5, 7) are in index.html (yours)
B has added Lucide `i-timer` to icons/sprite.svg (and `timer`, `pause` to LICENSE-lucide). Please apply these while you rewrite
the pill (or reply here "B may edit lines X-Y" and B will do it with small Edits after you say the pill is settled):
- CONS-ICON-1/-2, GAP-ICON-2: the pill (old :781), the viewer-bar chip (:788), the feed's `FEED_SYMBOLS.timer` (:1604) and the
  kitchen card's `icon('timer')` (:1656/:1659) use `icons/sprite.svg#i-timer`; delete the inline `<symbol id="i-timer">` (:815).
  Target ICON/static shell symbols 23 -> 22.
- P4-SHAPE-01 + GAP-TOK-4: `#timer-pill { min-height: var(--tap) }` (was 44px; kid 64), `font-weight: var(--fw-semibold)` (was 600),
  `.tp-time` `font-variant-numeric: var(--numeral-features); letter-spacing: var(--ls-numeral)` (was tabular-nums/.01em),
  `z-index: var(--z-fab)` (was 25), `#pill-timer gap: var(--sp-1)` or `--sp-2` (was 6px), the icon 20 px / ring 22 px / glance 30 px
  -> `--icon-sm` / `--icon-md`(ish) / `--icon-xl` sizes. New rings: track `--tint-fill-strong`, never `--progress-track`.
- CONS-MOTION-1: `#timer-pill:active { transform: translateX(-50%) scale(var(--press-scale)); filter: var(--press-dim) }` (:717) and
  the desktop rule (:721) the same without the translate; release on --dur-snappy / --spring-snappy.
B measures them in timer-look-6.mjs (kid pill >= 64 px at 390/820, the forced :active scale 0.97 + dim) once they are in.
- B (sprite ids, final list): i-timer, i-pause, i-apple, i-popcorn, i-egg, i-cooking-pot, i-cookie, i-pizza added (60 symbols);
  i-play, i-bell, i-square, i-rotate-ccw, i-mic, i-plus, i-minus, i-x were there. The tile icons/timer.svg is redrawn to the same
  Lucide `timer` geometry (duo layer kept), so the timer has one drawing. Use `../icons/sprite.svg#i-timer` from apps, `icons/sprite.svg#i-timer` from index.html.
- B -> A: B adds `<script>` (f260.html:658 pattern) right after `<body class="ds">` that sets `html.framed` before the first paint;
  CSS keys off `.framed` (your `data-in-hub` can stay or go).

### A → B (written into apps/timer.html, 22:40)
- `#go` uses B's markup: A sets `go.dataset.state` = loading | start | pause | resume | stop and the `.lbl` text (Loading… / Start / Pause / Resume / Stop). It is always `btn-primary`.
- `#plus1` (+ icon, `.lbl` "1 min", aria-label "Add one minute") sits between #go and #reset; both are only disabled (never hidden) when no timer is on the dial, so nothing moves.
- At 0 A toggles `#dial.at-zero` (NOT `.empty` any more): please move `.dial.empty .ring .fg` to `.dial.at-zero .ring .fg` (P3-TIMER-02).
- `#tstate` holds an icon + `<span>`: bell + "Time's up", pause + "Paused". `#tlabel` the label. Both sit in `.tinfo` inside `.ringwrap`, under `#t` (please position them absolutely so the dial never grows).
- New blocks after .actions: `#list` (`.tm` buttons + `#add`), `#extras` (`#say`, `#notify`, `.sound` > `.seg#sound`). Before the presets: `#ended`, `#ask`, `#recents`. After presets: `#custom` (`.cfield` > label + `.cstep` [btn, input, btn]), `.lab` > `#label`.
- `#custom-btn` is the 7th child of `#presets` (please give it its own full row, or wherever it reads best).

### A → C
- The legacy `timer.active` is migrated ONLY by the Timer app (on its first live render: `put({...legacy, id: 'm'+startedAt})`, a deterministic id so two devices write the same row). Please do not migrate in the shell (two windows would make two ids); showing it via `list()` is fine.
- `hub.timers.notify()` uses `icon: 'icons/icon-192.png'` (relative): from `apps/timer.html` that resolves to `apps/icons/…` (404). Suggest `new URL('../icons/icon-192.png', …)` or an absolute `location.origin + <base path>`; your call.
- The app rings while open (hidden or not), so with `current.id === 'timer'` the shell should play nothing and toast nothing; it may still `notify()` when hidden (deduped).

### scripts/test-timer.mjs (A ↔ C)
- A is moving the file to the new contract NOW (every `timer.active` read becomes `hub.timers.list()`; the app sections grow:
  contract, skew, clear rule, alert/Stop, pause, ended-unseen, replace/add, custom, +1, labels, recents, h:mm:ss, voice parser, aria).
- A leaves a marker `// ── shell half (Worker C) ──` near the end of the main try-block; C, please add the shell sections
  (multi-timer pill, Switch keeps the timer P2-PROF-08, notify when hidden with the app open, wake lock re-request) there,
  after A says "test-timer: A done" in this file. Shared helpers in the file (pillState, flushed, signIn…) stay; add, don't rename.
- A → C (22:50): in `ringTimers`, `appOpen = … && !document.hidden` makes BOTH ring when the page is hidden with the Timer
  open (the app rings hidden or not, as agreed above). Please drop `&& !document.hidden` there (the notification part stays
  as is). The app plays its own sound every 15 s for every ended timer of the signed-in person, from its first render.
- B -> A (after reading your render()): B's CSS now follows your states: `#go[data-state="loading|start|pause|resume|stop"]`
  (play for loading/start/resume, pause for pause, square for stop), `.dial.at-zero`, `body.done|paused|running`, `.tm.on`.
  Two small asks: (1) hours: please set `t.dataset.len = 'h'` when `txt` has two colons (else `delete t.dataset.len`), next to
  `t.textContent = txt` — without it "1:05:00" overflows the ring at 390. (2) on each `.tm` in #list, `b.dataset.state = x.state`
  (B rings a ringing one with --timer-done). B's style is in apps/timer.html `<style>` now (whole block rewritten; please don't edit it,
  tell me here). Also B added the pre-paint `html.framed` script after `<body class="ds">` and `draggable="false"` on the header img.

### C answers (22:5x)
- notify(): the icon is now absolute (the hub folder from hub.js's own src), and data.to carries the owner (a device-kept timer says whose it was). Signature notify(row, ownerName?, ownerId?).
- ringTimers: appOpen no longer checks document.hidden: with the Timer open the shell plays and toasts nothing for the signed-in person's timers (it still rings device-kept timers of people not signed in, which the app does not show); notify() when hidden stays.
- The shell never migrates timer.active; it only shows it through list().
- B (22:37): apology — B's 22:2x lock wait fell through after 550 s and B's script then removed SCRATCH/suite.lock at its end (~22:36), which may have been A's "Worker A test-timer 22:22:24" lock. B now waits without a time-out and removes only its own lock. A: if your test-timer run overlapped a B run (~22:27-22:36), re-run it.
- B -> A: layout via CSS order (no markup move needed): presets, then #ask (opens UNDER the tapped presets, so they do not move), custom, label, actions, then #recents, #list, #extras. Kids: #recents hidden too (words a pre-reader cannot read). Body is top-aligned now (centring made the dial jump 22 px when #list appeared).
- C (22:5x): C took SCRATCH/suite.lock at 22:36:01 when it was free (after B's removal); C's suites ran 22:36-22:50 on ports 8794/8765/8790/8913/8981 and home-art-5 since. A: if your test-timer was still running then, re-run it. C keeps the lock until its runs end and deletes only its own.

### A (23:10)
- A → B: done: `#t[data-len="h"]` when the time has hours; `.tm[data-state]` = running | paused | ended; also `#dial[data-state]` =
  idle | running | paused | ended. `#tstate` / `#tlabel` still toggle `hidden` (your `.tinfo > [hidden]` handles it; they are
  absolute, so nothing moves). `html[data-in-hub]` stays alongside your `html.framed`.
- A → C: **test-timer: A done.** The file runs 92/0 against A's Worker (8792). The marker `// ── shell half (Worker C) ──` is
  before the kiosk section. The old sections (pill on every tab, chip, desktop/820 chat clearance, Switch hides the pill,
  kiosk) are kept and moved to the new rows; "it reaches 0 with the app closed" now expects the ring + the Stop pill + a tap
  on the pill to stop it (your shell's behaviour). The old "Me → Switch takes the pill off the picker" section is gone from
  A's part (your P2-PROF-08 changes what the picker shows: please add the Switch section in your half).
- A's claims check: `audits/tools/phase6/6/timer-a-6.mjs` (rig, WebKit + Chromium) 35/0. Copies of the Phase 2/3 timer scripts
  that read/write timer.active: `audits/tools/phase6/6/*-6.mjs` + `_t6.mjs` (evidence under audits/evidence/p6/6).

### A → C: the Timer app, for CLAUDE.md's Timer bullet (your words; facts only)
- apps/timer.html uses only hub.timers. Up to 3 timers; New timer (#add) sets another while the others run. A preset, a recent or
  a custom time with a timer on the dial asks inline "Replace 9:57?" (or "Stop bread and start 3:00?" when it is ringing) with
  Replace / Add a second timer (hidden at 3) / Keep; with none it only sets the length. Replace starts the new length at once.
- Running: Pause (primary), +1 min, Reset. Paused: Resume (stored row, every device shows Paused). Ringing: Stop (primary), +1 min.
- Custom: minutes (0-1439) and seconds (0-59) with steppers (±1 min, ±5 s), Enter sets, Escape closes; times from an hour read h:mm:ss.
- Label field: names the new timer, or renames the one on the dial (Enter / change). Recents: up to three chips (length · label).
- At 0 the open app rings the person's sound every 15 s (hidden or not) until Stop, for 10 minutes; "Time's up" with the bell;
  aria-live once a minute, at 10 s and at 0. A row first seen more than 5 s after its end shows "Bread timer ended at 6:42 PM"
  (also after the 10-minute give-up, with OK). The app sweeps rows over 10 minutes old on fresh data.
- Notify me when it ends: asks the browser once per device (localStorage hub.timer.notifyAsked), shown only while permission is
  "default". Sound: Chime / Bell / Beep (person row `sound`), a tap plays it. Say it (hub.voiceInput; hidden without speech
  recognition): "ten minutes", "1 hour 5 minutes", "90 seconds", "pasta 12 minutes", "half an hour", "an hour and a half",
  "add a minute" (adds to the timer on the dial, no question); a start asks "Start 12:00 for pasta?" first, never replaces.
- The app takes the screen wake lock itself while a timer runs or rings (re-asked every 5 s and on visibilitychange).
- Migration: the app's first live render turns a legacy timer.active into timer:m<startedAt> (put removes timer.active).
- Test hooks: window.__timer = { parse, rows, sel, composing, live, awake, isLive }.
- A (23:55): waiting on suite.lock ("Worker C suite 22:36:01"). A needs ~15 min: a look capture + re-runs of test-timer and verify3-6. Please release between your suites when you can.
- C (00:2x): C's suites are done and SCRATCH/suite.lock is released. Final: smoke-api 346/0, smoke-chat 76/0, test-push2 90/0, test-kitchen 61/0, test-home 92/0, test-tv 94/0, test-timer 110/0 (x3; C's shell half added at the marker; the 15 s re-ring threshold is 14.5 s on the 1 s tick), cron-check-6 43/0, home-art-5 0 overlaps.
- B (00:40): B is done. timer-look-6 133/0 (final, all sections incl. C's pill: kid pill 64/72 px, :active press tokens). B's last CSS edits: .ds .list.list margin, .sound order -1 (MOTION/cls 0 moves), no '−' glyph in a comment. SCRATCH/suite.lock released.

### A: the capture rig on the batch 6 contract (coordinator's follow-up)
- `audits/tools/seed/timer.mjs`: typical = Elizabeth's one running timer:rigoven (6:20) + recents; overflow = three timers
  (2 h with 1:44:05 left, a long-labelled 20:00, a paused Tea at 2:10) + long recents; every row has its family mirror
  run:mom:<id> (so the TV and Kitchen captures now show her timer). **park = the migration variant** (the old timer.active).
- `audits/tools/seed.mjs` + `capture.mjs`: a second rig device `rig-kitchen-counter` ("Kitchen counter", role 'kitchen')
  holds the kitchen profile's session; a screen with `profile: 'kitchen'` uses it. Side effect: Me → Admin → Devices
  captures list one more device.
- `audits/tools/areas/timer.mjs`: idle, running (typical/overflow), paused, replace, ringing, ended-unseen, migrated (park),
  kid, kid-running, kitchen, kitchen-home (iPads), pill, pill-chat, chip, done-toast. No clockTo: ends are written relative
  to hub.serverNow(). The shell area's timer screens needed no change.

### Review round 1: A ↔ C on the legacy timer (item 1) and serverNow (item 3)
A proposes ONE migration in hub.js (C's file), used by both the app and the shell:
- `hub.timers.migrate()`: if `timer.active` holds a timer and the person can write (on loaded data): id = `'m' + Math.round(startedAt)`;
  if `timer:<id>` already exists → just remove `timer.active` (another device moved it); else if stale → remove it
  (clear('legacy', startedAt)); else `put({...legacy, id}, {fresh: true})` (put already removes timer.active). Runs whether or not
  other `timer:` rows exist. Deterministic id → two devices write the same row. Returns the new row or null.
- `list()`: show the legacy row whenever `timer.active` holds one and no `timer:m<startedAt>` exists (not only when no timer:
  rows exist), so a legacy timer still rings in the deploy window even before anyone migrates it.
- Shell: call `hub.timers.migrate()` after each pull (signed-in person, canWrite), and before a Home-card action on a row with
  `legacy: true` (then act on the returned row), so Pause/Resume never throw "Not a timer.".
- The app (A) calls `hub.timers.migrate()` when it goes live and after each pull. Until C lands it, the app has a local copy of
  exactly this rule (`migrateLocal`), used only when `hub.timers.migrate` is missing; A deletes it once C confirms here.
- Item 3: C please document in hub.js next to `hub.serverNow` that with no skew known yet (a device's first-ever start, offline)
  it is the device's own clock (hub.skew 0), corrected on the first Worker reply. A adds nothing in timer.html for it.

### C → A (core review round 1, hub.js)
- `hub.timers.migrate()` now exists (your migrateLocal's rule, the one copy): legacy → `timer:m<startedAt>` via put (fresh), removes
  timer.active when the copy exists, clears a stale legacy once; it acts only right after a pull that just succeeded. Your
  `migrate()` already prefers `T.migrate` when present — nothing else needed. The shell calls it after each good pull too.
- `list()` shows the legacy row beside timer: rows until its `m<startedAt>` copy exists (was: only when there was no timer: row).
- `put()` accepts a legacy row (`row.legacy` or id 'legacy'): it writes it as `m<startedAt>` (fresh), so Pause / +1 / Resume on an
  unmigrated legacy timer no longer throw "Not a timer.".
- H1: `sweep()`, `clear()` and the pending-clear handler act only right after a pull that just SUCCEEDED (`justPulled`: lastPull
  newer than the last one acted on, no lastError, state not offline/error, ≤ 5 s old). Your `T.sweep()` calls in onSync are fine
  as they are (sweep gates itself and runs once per pull).
- L1/L2: the notification key and tag carry endAt: `timer-<id>-<endAt>`, `renotify: false` (the Worker's push uses the same tag),
  so +1 min after a ring is told again and the local + push pair alerts once.
- A → C: thanks; A's migrateLocal is deleted, the app calls only hub.timers.migrate(). A adds deploy-window checks in test-timer (migration section) and timer-a-6.
- A → C (review round 1): test-timer's P3-TIMER-04 check (line ~537) expects the notified mark /^[a-z0-9]+@\d+$/ but your new key is id@startedAt@endAt (marks ["…@1790917673990@1790917676990"]): please update the regex (your section).
- A → C (finding, hub.js, not fixed by A): a row the Timer FRAME had just written (timer:<id> via hub.timers.start) never reached
  the server when the SHELL wrote another row of the same channel (timer person) within ~250 ms (before the frame's flush):
  the server had no timer:<id> at all and the frame's copy later read null. Likely: both windows saveQueue() to the same
  localStorage key hub.queue.timer.person.eli from their own in-memory queue, so the shell's write replaced the frame's queued
  row. Seen in test-timer when the shell wrote timer.active right after the app's Start; A's test now writes the legacy row from
  device B (the realistic old device), so it no longer depends on it. Real-life exposure: the shell (Home card / pill / migrate)
  and the open Timer writing within the flush delay. Your call whether to merge the stored queue before saving.
- A (review round 1 done): test-timer 110/1 (the 1 = your P3-TIMER-04 mark regex, line ~538); timer-a-6 36/0; parse-check 32/0. suite.lock released.

### B -> A (visual review round 1, Timer layout) — proposal, please confirm here
Item 3 (Pause/Stop below the fold at 375×667 XXL) without any jump on Start/Stop: the actions row goes right under the dial
in EVERY state (DOM and visual), so Pause/Stop is always on the first screen and never moves. With item 1 (recents after the
actions for focus order) B proposes this ONE DOM order, so B can drop every CSS `order` rule (DOM = visual = focus):
  header · #dial · #ended · .actions (#go #plus1 #reset) · #recents · #presets · #ask · #custom · .lab · #list · #extras · #live
(#ask after #presets: it opens under the tapped preset, so the presets never move; #ended stays near the dial.)
A: please move the markup to that order (or tell me "B may move the blocks" and I will, with one anchored Edit per block).
Item 2 (kid Replace/Keep pictures): B suggests Replace = i-play (start this new length), Keep = i-timer (keep the running timer),
"Add a second timer" = i-plus — all already in the sprite, so nothing new is drawn. Tell me if you pick other names.
Item 4: B's CSS reserves both dial lines (#tstate, #tlabel) whether empty or hidden: visibility, not display, and a fixed row height.

### Visual review round 1: A ↔ B (apps/timer.html)
- A moved the markup to the on-screen order: dial, #ended, #presets, **#ask**, #custom, .lab, .actions, **#recents**, #list, #extras, #live.
  B: please drop the CSS `order` line (`#presets { order: 1; } … #live { order: 9; }`), it is no longer needed; Tab/VoiceOver now follow the DOM.
- #tstate and #tlabel are never `hidden` now: an empty one holds a no-break space, so the label row never moves when "Paused" /
  "Time's up" appear. #tstate is rebuilt only when the state changes (`#tstate[data-key]` = '' | paused | ended).
  B: if an empty state row (text only) is shorter than one with the icon, please give `.tstate` a min-height of the icon row.
- The question's buttons now carry pictures: #ask-yes = `i-check` + .lbl, #ask-no = `i-x` + .lbl, #ask-add = `i-plus` + .lbl (all in the
  sprite already). Kids get the short question "Change the timer to 3:00?" with Yes / No / Add one. B: style the pictures (kid size
  >= 64 px), show them for adults too or hide them there, your call.
- #plus1's visible text is "+1 min" (name "Add 1 minute"). The .tm buttons carry aria-label "Pasta, 12:00 left" / "Tea, paused, 2:10 left" / "bread, time's up".
- B -> A (round 1): thanks — B dropped the CSS `order` block (DOM = visual now). One left: inside #extras B draws the Sound row
  FIRST (`.sound { order: -1 }`), so Say it / Notify me, which appear after load, move nothing (MOTION/cls). Please move the
  `.sound` div before `#say` in the markup; B then drops that order too. Ask pictures: B shows them for everyone, kid size >= 64.
- B -> A (round 1, item 3, needs ONE more markup move): at 375×667 XXL (--ts-user 1.5) the column is dial 307 + presets 4×66
  + label 66 + gaps before #go: #go's bottom lands near y 815 in a ~600 px frame. No CSS-only fix keeps "no jump on Start/Stop"
  (collapsing the presets while running moves #go). So the actions row goes right under the dial, in every state, as in
  Apple's Clock (picker, then Cancel/Start, then the rest):
     dial · #ended · .actions · #presets · #ask · #custom · .lab · #recents · #list · #extras (.sound first) · #live
  Please move `<div class="actions">…</div>` to just after `#ended` (and `.sound` before `#say`). #recents stays after .lab,
  i.e. still after the actions. B updates the CSS margins for it and re-runs timer-look. Reply "done" or "B may move it".
- B (02:10): no reply in 10 min, so B moved the two blocks itself (one atomic edit, no content changed): `.actions` now sits right after #ended (before #presets), and `.sound` is the first child of #extras (before #say). Order now: dial · #ended · .actions · #presets · #ask · #custom · .lab · #recents · #list · #extras · #live. B dropped every CSS `order`. A: re-read before your next Edit there.
- C (visual review round 1): the shell no longer toasts at 0 (the toast covered the ringing pill); test-timer's 'A: toast' check (your section, ~line 386) now asserts the pill label says "Time's up" and no toast shows. C edited that one line.
- A (02:35): B, fine — the actions move and .sound first are accepted (A's script does not depend on the order). A is waiting on suite.lock ("Worker C review1 01:41:23") to run test-timer, timer-a-6 and timer-look-6.
- B -> A (02:52): #plus1 now draws the sprite plus AND the text "+1 min", so it reads "+ +1 min" (seen at 375 XXL). The sprite plus is the icon (no text glyph as an icon, VIS-ICON-1), so please make the visible word "1 min" again (aria-label "Add 1 minute" stays). B leaves the icon in.
- A (visual round 1 done): test-timer 113/0, timer-a-6 36/0, timer-look-6 146/0, parse-check 32/0; lock released. #plus1 shows the plus icon + "1 min" (a visible "+1 min" doubled the plus with the icon); its name is "Add 1 minute", which contains the visible words.
- B (visual round 1 done): timer-look-6 146/0 (adds: Pause/Stop on screen at 375×667 XXL, adult y 430/619, kid 474/595; the label rows never move; DOM = drawn order, no CSS order; kid question pictures >= 64 px), test-timer 113/0 on B's own Worker (8793, stopped, D1 copy deleted), capture --area timer 198 ok, parse-check 32/0, no hex. Lock released.
- A → B (visual round 2): #ended moved below .actions. Markup/screen order now: dial · .actions · #ended · #presets · #ask · #custom · .lab · #recents · #list · #extras (.sound first) · #live.
- B (visual round 2 done): the label sits above the digits and the state below, each absolute with a chord-safe max-width (58 % / 56 %); timer-look-6 158/0 (new 'chord' section: inside the inner circle at 375/390/820, default + XXL), test-timer 113/0, parse-check 32/0, no hex; the CSS comment now gives the markup order (dial, actions, ended, presets, ask, custom, label, recents, list, extras).
- A (visual round 2 done): test-timer 113/0, timer-a-6 36/0, parse-check 32/0; lock released.
- B (visual round 3 done): state line font min(--fs-headline, 7cqw), max-width 66 %; never cut. timer-look-6 182/0 (new 'statefit' section), test-timer 113/0, parse-check 32/0.

### Rescore (Timer 5.5 -> 6.0): B -> A, the hooks B will style (tell me your names if different)
- Collapsed picker: wrap presets + #ask + #custom + .lab in ONE element, e.g. `<div class="picker" id="picker">`, and set
  `hidden` on it while a timer runs or rings (unless "New timer" opened it); "New timer" (`#add`) gets `aria-expanded`/`aria-controls="picker"`.
  B's CSS keeps the dial and .actions where they are (the picker is below the actions, so opening/closing it moves nothing above).
- Settings disclosure: `<details class="settings" id="settings"><summary>…Sound &amp; alerts</summary> .sound + #notify </details>`
  (a native details: no script needed to open it). B styles the summary as a 44 px row with a chevron-down (i-chevron-down, rotates when open).
- Idle +1/Reset: please toggle `body.idle` (no timer on the dial); B's CSS does `visibility: hidden` on #plus1/#reset then (the row keeps its height).
  Reset while ringing: `hidden` is fine (B already lays the row out with wrap).
- Unified ended-unseen: #tstate's words "Ended 8:37 AM" (+ data-key="unseen" or similar) and #go "OK" (`data-state="ok"`?). Tell me the
  data-state value: B shows the check icon (i-check) on #go for it, and the bell in the state line.
- Keep (replace question): B suggests `i-timer` (keep the running timer), as the rescore says; it is in the sprite. Please swap `i-x` -> `i-timer` on #ask-no.
- Kids: B hides "New timer" and Say it for kids only if you prefer; otherwise B gives them the picture-above-word layout (plus / mic). Default: picture layout.

### Rescore 6 (A's plan, writing it now in apps/timer.html; B CSS, C Home/Kitchen)
Markup/screen order becomes: dial · .actions · #list · #presets · #ask · #custom · .lab · #recents · #extras (#say, #tsettings-btn, #tsettings[.sound, #notify]) · #live.
- **While a timer is on the dial (running, paused, ringing, ended)**: A sets `hidden` on #presets, #ask, #custom, .lab, #recents, #say,
  #tsettings-btn and #tsettings. Only dial, .actions and #list (2+ timers, or "New timer" with one) stay. **New timer** (#add) = the
  picker in place (composing). **Idle** (no timer): the picker as today. B: `hidden` must win over your display rules
  (.presets is display:grid). A adds ONE line at the top of <style>: `main [hidden] { display: none !important; }` — B, keep or replace it.
- **#ended is gone.** An ended-unseen timer: the dial reads bell + "Ended 8:37 AM" (#tstate), and #go reads **OK**
  (`go.dataset.state = 'ok'`, it acknowledges and clears). B: please add `<svg class="sym ic-ok">` (i-check) to #go and show it only
  for `[data-state="ok"]` (today 'ok' would show the play icon). A live ringing timer stays "Time's up" + Stop (square).
- **Reset**: `visibility: hidden` (space kept, A sets it inline) while ringing/ended and while idle; +1 min `visibility: hidden` while idle.
- **List chip**: "Ended" for an ended-unseen timer, "Time's up" for a live ring.
- **Kids**: no #add (New timer), no #say.
- **The replace prompt is gone**: with the picker hidden while a timer is on the dial, no preset can be tapped then, so nothing is ever
  replaced (UX-TIMER-1 still holds). #ask remains only for Say it's "Start 12:00 for pasta?" with #ask-yes (check + Start/Yes) and
  #ask-no (NO icon, Cancel/No). #ask-add is removed.
- **Timer settings**: `<button id="tsettings-btn" aria-expanded aria-controls="tsettings">` (i-settings? B decides the icon, or none)
  + `<div id="tsettings" hidden>` holding .sound and #notify. Idle only; hidden for kids.
- **Recents**: a recent equal to a preset with no label is not shown.
- A → C (item 2 wording): in the app, running → "Reset" (rotate-ccw) cancels; ringing → "Stop" (square) silences and clears; an
  ended-unseen timer → "OK" (check). Reset is not offered while ringing. Please match on Home/Kitchen.
- B -> A (rescore): agreed on all. B adds the ic-ok (i-check) svg into #go itself and styles [data-state="ok"]. #tsettings-btn: please give it `<svg class="sym"><use href="../icons/sprite.svg#i-settings"/></svg><span class="lbl">Sound &amp; alerts</span>` (the gear is Settings in Table ICON-6). design.css already has `[hidden] { display: none !important }`, so your extra line is harmless; B leaves it. Tell me "rescore markup done" and B styles + measures.

### C -> A (rescore round, ICO-4: one action, one name) — the shell's wording; please use the same in the app, or tell me yours
- Running or paused: **Reset**, icon `i-rotate-ccw`. Home card: icon-only round button, aria-label "Reset Pasta timer" / "Reset timer" (no label);
  Kitchen Home: icon + the word "Reset", same aria-label. Ringing: **Stop**, icon `i-square` + the word, aria-label "Stop Pasta timer".
- Reset shows `hub.toast('Pasta timer reset' | 'Timer reset', 6000, { action: 'Undo', onAction })`.
- Undo = NEW `hub.timers.restore(row)` (hub.js, C): cancels the pending clear, forgets the local stop (acked), and put()s the row back by
  value (same startedAt/endAt or pausedAt/remaining, so a running timer kept counting during the 6 s). Returns the row, or null when a
  newer timer stands under that id (the shell then toasts "A newer timer took its place."). Pass the row you had before clear().
- A (rescore 6, written): the markup/script above is in apps/timer.html (look: SCRATCH/b6a/look/r6-*.png). B, two asks from the shots:
  (1) #go[data-state="ok"] shows the PLAY icon today: please add `ic-ok` (i-check) and show only it for "ok".
  (2) "Ended 8:45 AM" is cut to "Ended 8:4…" in #tstate at 390: let it wrap or size it to fit (it is the only place the time is said now).
  Also: idle, +1 min / Reset are `visibility:hidden` (space kept), so at 390 Start sits alone on row one and an empty band shows
  where they wrap; your call whether to keep that band (no-jump) or place them differently. timer-look-6 will need its states
  updated (no #ended, no replace prompt; picker hidden while a timer is on the dial; #tsettings).
- A (rescore 6 done): test-timer 111/0, timer-a-6 39/0, timer-look-6 200/0, parse-check 32/0; lock released. Capture area: 'replace' screen → 'new-timer'; ended-unseen waits for #go[data-state=ok].
- B (rescore done): ic-ok on #go, unseen state min(title2, 6cqw), state words min(title2, 8cqw), i-egg-fried (hand-drawn, Lucide style), kitchen in coral (AA 5.93 / 8.7), Timer settings (gear) pinned right, empty extras hidden, idle actions on one row at 390 (kids wrap), kitchen dial centred. timer-look-6 200/0, test-timer 111/0, capture 198 ok, parse-check 32/0. Lock released.
- B (review round 6 done): unseen line max-content (an absolute box at left 50% had shrunk to 50%), 6.5cqw, 74%; kid idle: 1 min/Reset display:none, kid #go full row, kid dial min(82vw,44vh,400px); egg-fried listed as Lucide; kitchen landscape dial min(52vw,84vh,680px). timer-look-6 216/0 (incl. 'Ended 12:59 PM' at 375/390/820 x default/XXL x adult/kid), test-timer 111/0, capture 198 ok, parse-check 32/0.

### Judge round (A): Undo after Reset in the app; the inline Notify me
- The app's Reset now toasts C's words "Pasta timer reset" / "Timer reset" (6 s, Undo) and Undo = `hub.timers.restore(was)`; back on
  the dial with focus on #go. A ringing timer's Stop has no Undo.
- NEW markup after #list: `<p class="notify-offer" id="notify-offer" hidden>` with `#notify-offer-yes` (i-bell + "Notify me when it ends")
  and `#notify-offer-no` (i-x, aria-label "Not now"). Shown once per device (localStorage hub.timer.notifyOffered) on the first Start
  while permission is "default"; never for kids, the kitchen or the TV. It sits below the list, so #go and the dial never move.
  B: please style it (a row, centred, the X a 44 px ghost) — today it has only .btn defaults.
- A (judge round done): test-timer 115/0, timer-a-6 42/0, parse-check 32/0; lock released; the 10 stale screens-after/6/timer/replace-typical-*.png deleted.
- B (judge round done): action row = #go full row + 1 min/Reset centred row 2 (display:none at idle/New timer; Reset also ringing/OK), adult .actions min-height 2 rows; landscape: dial min(46vw,78vh,--col-narrow), #go level with the dial centre (margin), kid 44vh dial only under max-height 700; unseen (#go ok) quiet; #notify-offer styled. timer-look-6 226/0, test-timer 115/0, capture 198 ok, parse-check 32/0.
