# Batch 6 (Kitchen timer): brief for the workers

## Setup
- Repo: `C:\Users\ex_bo\OneDrive\Claude Related\App Hub`. HEAD `084044f`; batches 0a-5 are done.
- SCRATCH = `C:\Users\ex_bo\AppData\Local\Temp\claude\C--Users-ex-bo-OneDrive-Claude-Related-App-Hub\af3dfdac-12ca-439a-9836-6c1cb19fda21\scratchpad`.
- Read `CLAUDE.md` first; it is current through batch 5. Relevant parts:
  - the Timer bullet;
  - the shell, the Kitchen device and the TV board;
  - Push;
  - the shared sprite (`icons/sprite.svg`, `svg.sym`), the segmented control (`.ds .seg` / `.seg-grid`), `hub.toast(msg, ms, {action, onAction})` and `hub.confirm`;
  - batch 5's in-card result line pattern in `apps/verses.html` (`#rated`).

## The batch
- **Entries:** `SCRATCH/b6.md`. 24 entries (8 of them in the shell or Worker) plus the kept improvement IMP-TIMER-I2 (start a timer by voice), at the end.
- **Carry-overs:** `SCRATCH/b6-carry.md`, the earlier batches' unfinished design entries with a Timer part. A classifier is writing it now; Worker B picks it up when it exists.
- **Phase 3 report:** `audits/03-apps/timer.md`; each entry cites its line.
- **The app:** `apps/timer.html` (202 lines; unchanged since batch 1).
- **The shell's timer pill:** `index.html` around :708 (CSS) and :1305-1345 (logic).

## The data contract (decided; all three workers build to it)
Person scope, app `timer`, one row per timer (the batch-0e rule: a whole map in one row loses entries):

### `timer:<id>`
```
{ id, label, total, startedAt, endAt, pausedAt, remaining, by, ackAt }
```
- **Time units.** Every time is in **server ms**: `Date.now() + hub.skew` when written, and the same base when read (P2-STAB-08). `total` and `remaining` are ms.
- **States:**
  - **running:** `endAt` set, `pausedAt` null.
  - **paused:** `pausedAt` set, `remaining` holds the ms left, `endAt` null (UX-TIMER-2).
  - **ringing / ended unseen:** `endAt <= serverNow` and no `ackAt` (UX-TIMER-3).
  - **acknowledged (Stop):** the row is removed.
- **A device clears a row ONLY when** the stored row's `startedAt` is the one it saw end. It never clears a newer timer (P2-STAB-13).
- **10-minute limit.** An ended, unacknowledged row older than 10 minutes is cleared by any device under that same `startedAt` rule. Until then it shows "Timer ended at 6:42" (UX-TIMER-3).
- **At most 3 timers** per person (GAP-TIMER-3 asks for a second one).

### `recents`
`[{total, label}]`: the last three distinct lengths, for the presets and the Home card (UX-TIMER-7).

### `timer.active` (legacy)
The single row before this batch. Read it as one running timer only when no `timer:` rows exist; never write it again. After a migration, remove it, under the same `startedAt` rule.

### Family scope, app `timer`: `run:<profileId>:<id>`
```
{ label, total, endAt, pausedAt, remaining, by, startedAt }
```
- A read-only mirror for the Kitchen iPad and the TV (GAP-HOME-1).
- It is written by the OWNER's device whenever its own timer row changes, and tombstoned when that row goes.
- Nobody else writes it. The Worker (policy.js) allows a family `run:<writerId>:*` row only from its own writer. That covers kids and the kitchen too, and it is the one narrow addition to policy.

### Sound
`sound` (person row): `'chime' | 'bell' | 'beep'`.

### Push (PWA-GAP-1), Worker side
- No new endpoint. Add a second cron `"* * * * *"` beside the existing `"*/15 * * * *"`. In `scheduled()`, the minute cron runs ONLY `timerJob`; the 15-minute one runs the existing jobs unchanged.
- `timerJob` reads person-scope `timer:` rows whose `endAt` fell in the last 10 minutes, with no `ackAt` and not yet pushed. It pushes "Timer done: <label>" to the owner's devices (kind `timer`; its switch `push_pref:timer` is ON by default — a timer is something you asked for). It records each push once in settings (`timer_pushed`), pruned after a day.
- Kids, the TV and the kitchen cannot subscribe, so their timers rely on the device's own alert (as now).
- The push says nothing private beyond the label.

## Decisions (do not re-open)
- **The alert (GAP-TIMER-2).**
  - It repeats every 15 s until Stop. Stop is a big primary button in the app and in the shell pill.
  - It gives up after 10 minutes, then shows "Timer ended at …".
  - Three sounds are generated with WebAudio (no audio files to download): chime (default), bell, beep. Choose in the Timer's settings.
  - One AudioContext, unlocked at Start and reused (P3-TIMER-03).
- **Presets (UX-TIMER-1).** A tap while a timer runs asks inline "Replace 9:57?" with "Add a second timer" beside it. Nothing is ever cancelled silently.
- **Custom time** (a number pad or stepper, minutes and seconds), **+1 min** on a running timer, an **optional label**, and **recents** (GAP-TIMER-3). Hours show as h:mm:ss (VIS-TIMER-4).
- **The display (P3-TIMER-05).** Display with `Math.ceil`, and fire at `endAt` (`endAt - serverNow <= 0`), in the app and the shell.
- **Voice (IMP-TIMER-I2).**
  - A "Say it" button on the Timer uses `hub.voiceInput`. It parses "ten minutes", "1 hour 5 minutes", "90 seconds", "pasta 12 minutes" (label + time) and "add a minute". It confirms before starting ("Start 12:00 for pasta?").
  - Hidden where speech recognition is missing.
  - Plus a chat tool `start_timer {minutes, seconds?, label?}` that writes a `timer:<id>` row for the person through `putOne()` (CLAUDE.md "Adding a chat tool"). Not for the kiosk; kids may use it.
- **"Time's up" (UX-TIMER-4).** The words "Time's up" plus a bell icon from the sprite. Not colour or blinking alone; blinking stops under Reduce Motion.
- **Pause as primary.** While running, Pause is the primary button (VIS-TIMER-1). The Timer has no in-app title inside the hub (VIS-TIMER-2: the viewer bar names it; standalone keeps it).
- **Kids (UX-TIMER-6).** Icons on every control (play, pause, reset), and preset pictures (egg, pasta, cookie…) drawn in Lucide style. Use sprite symbols, adding what is missing (Lucide "egg", "cookie" exist in Lucide; check the license list). 64 px or more.
- **Kitchen iPad.** The dial cap is lifted, and the digits use `--fs-glance-1` (UX-TIMER-5).
- **The Home timer card (UX-TIMER-7).** "Start a timer" with the last three lengths as one-tap buttons, plus Open Timer.
  - On adults' and guests' Home (and kids' if it fits the kid Home rules; say what you chose).
  - When a timer runs, the card shows it (with Pause/Stop) and the pill stays.
  - It follows batch 5's Home grid: the `.gfoot` footer, art never under text, the loading reservations, and `home-art-5.mjs` must stay at 0.
- **Notifications (GAP-TIMER-1, P3-TIMER-04).**
  - The Timer offers "Notify me when it ends", which asks notification permission in context, once.
  - At 0 a local notification is shown whenever the page is hidden, whichever app is open. Only the in-page alert is skipped when the Timer is visible.
- **Wake lock (P2-STAB-09).** The Timer app requests it itself while a timer runs (the iframe allows it). The shell re-requests it on every visibilitychange while any timer runs.
- **Switching people (P2-PROF-08).**
  - The shell keeps a per-device list of running timers in localStorage `hub.timers.device` (owner id + name + the row) for timers started on THIS device.
  - After a Switch it still counts down, rings and notifies for them, and the pill shows "Mae's timer · 3:12" with Stop.
  - Stop from another person removes it locally. The owner's row is cleared by the owner's next session, or by the Worker push job's 10-minute rule. Do not write another person's rows.
- **Kitchen and TV (GAP-HOME-1).**
  - The Kitchen Home shows every running family timer (the `run:` mirror), each with the owner's face, read-only unless it is the kitchen's own.
  - The TV board shows running timers in a quiet line. It must keep every test-tv fit gate at 1920×1080 and the other sizes; if a timer line cannot fit, it takes the place of the oldest feed line, the anniversary rule.
- **Accessibility (UX-TIMER-10).** `aria-live` on the countdown once a minute, and at 10 s and 0. `aria-pressed` on presets.
- **The dial (P3-TIMER-02).** It keeps `aspect-ratio: 1` at 0:00; nothing below moves.

## Hard rules (all workers)
- **Colour and CSS:**
  - Every colour is a design.css token: no hex in any `<style>`, and never `prefers-color-scheme`.
  - `apps/design.css`'s token half (lines 11-765) stays byte-identical to `git show 084044f:apps/design.css | sed -n 11,765p`. The component half may change only if needed.
- **Never touch:**
  - the pre-paint bootstraps;
  - `handoff/` (`check.js` stays 47/2, `0g/check-ids.js` 49/49);
  - `apps/f260.html`, `apps/prayer.html`, `apps/verses.html` (no reason to edit them).
- **Process:**
  - No build step and no downloads.
  - Keep line endings.
  - Never write or print a secret, PIN, code or token. The local code is in `SCRATCH/localcode`; pass it as an argument only.
  - Do not commit, push or deploy.
  - Do NOT run `SCRATCH/repo-tests.sh`, and never kill another worker's wrangler.
- **Server rules stay.** The only policy change is the narrow `run:<writerId>:*` family rule above. The declined features stay out: no kid routines/stars app, no grocery list.
- **Existing ids stay** in `apps/timer.html` and index.html's pill (tests use them). The test hooks stay; add new ones.
- **Shared-file etiquette.**
  - Small `Edit`s with unique anchors; re-read before each.
  - Workers A and B share `apps/timer.html`: **A owns the `<script>`, copy and markup for its entries; B owns `<style>`, icons and B's markup.**
  - Worker C owns `index.html`, `worker/`, `apps.json`, `sw.js`, `CLAUDE.md`, `worker/README.md`, `scripts/test-home.mjs`, `test-push2.mjs`, `smoke-api.sh`, `smoke-chat.sh`, `scripts/mock-anthropic.mjs`, `test-kitchen.mjs` and `test-tv.mjs`.
  - Agree hooks in `SCRATCH/b6-hooks.md`.
  - Workers A and C both implement the clear/skew rules: put them in ONE shared place. Prefer a small helper in `apps/hub.js`: `hub.serverNow()`, plus timer helpers if both need them (`hub.timers`?). C owns that `hub.js` edit; A asks C via b6-hooks.md.
- **Waiting on the lock.** SCRATCH/suite.lock is one suite at a time machine-wide. Wait for it in a sleep loop inside your turn. Do not hand back while waiting; if you truly must stop, say exactly what remains.

## Worker A: Timer logic, data and copy (`apps/timer.html` `<script>` + markup for its entries)
**Entries:**
- GAP-TIMER-2, -3, -1;
- UX-TIMER-1, -2, -3, -4 (words), -10;
- P3-TIMER-03, -04, -05;
- VIS-TIMER-4;
- the app half of P2-STAB-08, -13 and P2-STAB-09;
- IMP-TIMER-I2 (the Timer's "Say it");
- the migration from `timer.active`.

**Tests:**
- Extend `scripts/test-timer.mjs` to cover: the contract, two devices with skew, the clear rule, the alert repeats/Stop, pause stored, ended-unseen, replace or add, custom, +1 min, labels, recents, h:mm:ss, voice parsing (unit-test the parser), aria.
- Write a claims check, `audits/tools/phase6/5`-style, at `audits/tools/phase6/6/timer-a-6.mjs`.

## Worker B: Timer look, the carry-overs
**Entries:**
- P3-TIMER-02, UX-TIMER-4 (bell + no colour-only), UX-TIMER-5, UX-TIMER-6, VIS-TIMER-1, VIS-TIMER-2;
- the look of A's new controls: custom-time pad, +1 min, labels, recents, the second timer, the replace prompt, the sound choice, "Notify me", "Say it";
- every item in `SCRATCH/b6-carry.md` → "Batch 6 must do for Timer".

**Tools:**
- Icons from the sprite; add missing ones (bell, egg, cookie, pause, play, rotate-ccw if missing) in Lucide geometry, listed in LICENSE-lucide.
- One drawing per meaning (Table ICON-6).

**Checks:**
- Write `audits/tools/phase6/6/timer-look-6.mjs`. It measures:
  - the dial aspect at 0;
  - no jump at 0 or on start, pause or stop;
  - glance size on the iPad;
  - kid targets ≥ 64 px;
  - two timers at 375/390/820/1180/1440 and XXL with no horizontal scroll.

## Worker C: shell, Worker, chat, docs
**Entries:**
- GAP-HOME-1 (the `run:` mirror, the Kitchen Home, the TV line);
- P2-PROF-08 (per-device timers across a Switch);
- the shell halves of P2-STAB-08, -13 and -09;
- PWA-GAP-1 (the minute cron `timerJob`, `push_pref:timer`, the Me → Notifications switch);
- UX-TIMER-7 (the Home timer card);
- the `start_timer` chat tool (IMP-TIMER-I2's chat half);
- `hub.serverNow()` (+ any shared timer helpers);
- the policy rule;
- the multi-timer pill.

**Tests:**
- Extend test-timer (shell half; coordinate with A), test-home, test-kitchen, test-tv (fit gates with a running timer), test-push2 (timerJob), smoke-api (the policy rule, the cron job name) and smoke-chat with the mock (`start_timer`; teach the mock a trigger phrase). Update the counts in CLAUDE.md.
- Write `audits/tools/phase6/6/cron-check-6.mjs` (pattern: `phase6/5/cron-check-5.mjs`).

**Docs:**
- `CLAUDE.md`: the Timer bullet, the shell, the Kitchen, TV, Push and Chat, and the Tests table.
- `worker/README.md`.
- `wrangler.toml`: the crons.
- Precache: if a file is added, tell the orchestrator. The orchestrator runs `bump-sw` once at the end.

## How to check (report the numbers)
- **Scripts.** `NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules" node "<script>"` from the repo root.
  - The batch's Phase 2/3 scripts: `SCRATCH/b6-scripts.txt`. Their before-run on the pre-batch code: `SCRATCH/6-before/`.
  - If a script fails only because its UI or data contract changed on purpose (for example, it reads `timer.active`), copy it to `audits/tools/phase6/6/<name>-6.mjs` with a header comment saying why, and report both.
- **Your own Worker.** Copy `SCRATCH/d1-tmpl` to a SHORT path: A `C:\Users\ex_bo\AppData\Local\Temp\b6a\d1`, B `…\b6b\d1`, C `…\b6c\d1`. Run `cd worker && npx wrangler dev --port <A 8792 | B 8793 | C 8794> --persist-to <that>`. Use a fresh D1 per suite run, then stop it and delete the copy.
- **The lock.** One suite at a time machine-wide, via SCRATCH/suite.lock (write your name in it; delete it when done).
- **Capture.** ALWAYS pass your own `--out SCRATCH/b6<a|b|c>/cap` (`--area timer`; C also uses `--area shell` and `--area tv`). Never `--help`.
  - LOOK in light and dark at 390, 820, 1180 and 1440, and at XXL, for an adult, a kid, the kitchen and the TV.
- **Gates:**
  - `node SCRATCH/parse-check.cjs`: 0 failed.
  - No hex in `<style>`.
  - `home-art-5.mjs` stays at 0 (C).
  - `node scripts/bump-sw.mjs --check`.
  - `git checkout -- docs/screens` after tests.

## Report (short)
- Each entry: done, partly done or not done, and why.
- The files and regions you changed.
- Scripts before → after.
- Suite counts.
- What you looked at.
- What needs a real device.

## Timing note
The orchestrator's before-run is using the browser ports until `SCRATCH/before-6.log` contains a line starting `capture exit`. Until then, do not run any suite, script or capture; read, plan and edit first.
