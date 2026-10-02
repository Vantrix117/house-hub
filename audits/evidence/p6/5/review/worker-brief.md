# Batch 5 (Verses): brief for the workers

## Setup
- **Repo:** `C:\Users\ex_bo\OneDrive\Claude Related\App Hub`.
- **HEAD:** `1ba5cec`. Batches 0a-4 are done.
- **SCRATCH** = `C:\Users\ex_bo\AppData\Local\Temp\claude\C--Users-ex-bo-OneDrive-Claude-Related-App-Hub\af3dfdac-12ca-439a-9836-6c1cb19fda21\scratchpad`.
- Read `CLAUDE.md` first: it is current through batch 4.
  - Its "Memory verses" bullet covers this app.
  - It also covers the shared sprite `icons/sprite.svg`, used as `<svg class="sym"><use href="../icons/sprite.svg#i-…"/></svg>`.
  - And the shared segmented control `:is(.ds .seg,.segmented)` / `.seg-grid`, and `hub.toast(msg, ms, {action, onAction})`.

## The batch
- **`SCRATCH/b5.md`.** The 20 Verses entries, then the 4 kept improvements (IMP-VERSES-F6, -I1, -I2, -I3) at the end. The household kept all four, so they are part of the batch.
- **`SCRATCH/b5-carry.md`.** Batch 1's unfinished design-system entries that still have a Verses part. A classifier is writing it now; Worker B starts on the b5.md entries and picks this file up when it exists.
- **The Phase 3 report.** The report behind the entries is `audits/03-apps/verses.md`, and each entry cites its line. The design system spec is `audits/04-design-system.md`.
- **The app.** `apps/verses.html` is 475 lines. Its test is `scripts/test-verses.mjs`.

## Decisions already made (do not re-open)
- **GAP-VERSES-1, where the verse text comes from.** Use the proposed fix, not a bundled Bible.
  - Verses offers "Add the verse text" (paste or type, Enter/Escape, `hub.voiceInput` where supported) on a card that has none.
  - The text is stored ONCE PER VERSE FOR THE HOUSEHOLD: one family-scope row per verse in Verses' own app, `text:<week>-<i>` = `{text, by, at}`. Everyone who trains that verse sees it.
  - Reads: the family row wins over the person's F260 paste (`f260.verses` in F260 person scope, read-only here); fall back to F260's paste.
  - Who writes it: household adults and guests, if policy allows a guest to write family rows of an app they can open. Check `worker/src/policy.js`; do NOT widen policy for kids or the kiosk. Kids never get the paste UI. Editing and clearing the text is allowed.
  - Mention in the UI, once, that the household shares the text.
  - Do not ship verse text in the code, do not download any, and do not invent or quote Scripture anywhere: tests use obvious placeholder text.
  - The verse references in REFS stay exactly as they are. They match the published plan, including "Psalm 1:1-7" and "Jeremiah 1:15".
- **UX-VERSES-1, kid practice.** The kid's card shows and reads aloud Kid Verse's paraphrase for the family week, labelled a paraphrase, as Kid Verse and the TV do.
  - Copy that table from `apps/kidverse.html` (the `words` per week). This is the third copy, after index.html's TV board. Add a check that the copies agree, the way `scripts/test-tv.mjs` does for the TV.
  - Use big picture buttons: Got it a star, Almost a smile, Not yet a "try again" arrow, each with its word. Kid targets are 64 px or more, and no reading is needed to rate.
  - Kids still write only their own recall rows.
- **GAP-VERSES-2, the Leitner schedule.**
  - Not yet → box 1 (due tomorrow). Almost holds the box. Got it moves the box up, up to box 5.
  - Each rating button shows its next interval ("tomorrow", "in 4 days").
  - Every toast states the real next review (P3-VERSES-05).
  - No "box N" jargon on screen (UX-VERSES-9). Speak in intervals: "Next review in 4 days", "Reviewed 4 days ago", and the histogram's own labels.
- **P3-VERSES-11, the day streak.**
  - A day with nothing due keeps the streak. It breaks only on a day where something was due and nothing was rated.
  - Today is pending until the day ends, the same "pending, never a break" rule F260 uses since batch 4.
  - `dayStreak` must be computable from the rows: the recall rows' due/last history plus the `rev:` days. If a past "was anything due that day" cannot be known exactly, take the generous reading (keep the streak) and say so in a code comment.
  - The Home card, the summary and chat, if chat reports it, use the same rule. Chat's tools are in `worker/src/chat.js`; check whether any reports the verses streak.
- **UX-VERSES-2, Undo.** After each rating, a toast with Undo (`hub.toast` action, 10 s like F260's Reset) restores that verse's previous recall row by value and takes back the `rev:` count.
  - If a newer write landed meanwhile, Undo does not clobber it.
  - The card returns to that verse, revealed.
- **P3-VERSES-12, double tap.** Ignore taps on the rating row for 400 ms after a rating. The next card comes in with a short token transition: `--dur-*`, and none under Reduce Motion.
- **IMP-VERSES-F6.** Tapping a row in Due today or Coming up practises that verse now.
  - It is a button row: 44 px, keyboard reachable, aria-label "Practise <ref>".
  - It counts as practice, not as due (P3-VERSES-08's rule): the due count and the Due today list keep the real due set.
- **IMP-VERSES-I1, record yourself.** On a card with Show available, an adult can record a recitation (MediaRecorder) and play it back.
  - The recording stays in memory on this device only: never uploaded, never stored, gone when the card changes. Say so in the UI ("Stays on this phone").
  - The button is hidden where MediaRecorder or getUserMedia is missing. A refused microphone gives a calm toast, never an alert.
  - Not for kids or the kiosk.
- **IMP-VERSES-I2, evening review push.** "3 verses to review" each evening:
  - a per-person toggle `push_pref:verses`, default OFF;
  - a new Worker job `versesJob` following the `praytime`/`prayTimeJob` pattern in `worker/src/reminders.js`;
  - it computes the due count on the server from the person's F260 `mem:*`/`recall:*` rows (the server has `rowMap()` in `worker/src/data.js`), not from the client summary;
  - it sends once a day in the 7 pm New York hour, only when due > 0, never to kids, the kiosk or the kitchen (they cannot subscribe anyway);
  - it is added to `JOBS`/`jobsAt`, and to `POST /api/admin/cron/run`'s job list if that is a list;
  - the toggle goes in Me → Notifications (`renderNotif` in `index.html`);
  - update `worker/README.md` (Reminders), CLAUDE.md's Push bullet, `scripts/test-push2.mjs` and `scripts/smoke-api.sh`.
- **IMP-VERSES-I3, practice modes.** Only on verses that have text. A segmented control (the shared one) offers Recall (today's flow), First letters, Fill the gaps and Word order.
  - **First letters:** each word shown as its first letter; tap to reveal a word.
  - **Fill the gaps:** every 3rd-4th word blank; tap a blank to reveal it.
  - **Word order:** the words in chunks to tap in order; wrong taps shake (or flash under Reduce Motion) and do not count.
  - Each mode ends in the same three ratings, so the schedule stays one schedule.
  - Kids get none of this. Touch-first, 44 px, and it works from 375 to 1400 px.
  - The chosen mode is remembered per person: one person-scope row `mode`.
- **GAP-HOME-2 / UX-VERSES-3, the Home card.** A Verses card on Home from `verses.summary` (and the person's own rows, so it is not stale before Verses is opened that day), e.g. "3 verses to review · 12-day streak".
  - One tap opens the trainer. When nothing is due it says so calmly.
  - Shown to adults and guests who have memorised verses (`total > 0`); hidden otherwise.
  - Kids: only if it fits the kid Home's simplified rules. Your call; say what you chose.
  - It follows the shell's patch-in-place rules (batch 2a: built once, patched, no layout shift).
  - It uses the app's hue (pistachio) and its spot art if that fits the other cards.

## Hard rules (all workers)
- Every colour is a design.css token: no hex in `<style>`, and never `prefers-color-scheme` (use `[data-scheme="dark"]`).
- `apps/design.css`'s token half (lines 11-765) stays byte-identical to `git show 1ba5cec:apps/design.css | sed -n 11,765p`. The component half may change, but only if needed. Prefer local CSS in verses.html.
- The pre-paint bootstrap in each `<head>`: never edit it.
- `handoff/` stays untouched. `node handoff/prayer/check.js apps/prayer.html` stays 47/2, and `audits/tools/phase6/0g/check-ids.js` 49/49.
- `apps/f260.html` and `apps/prayer.html` are not edited in this batch.
- No build step and no network downloads. Keep line endings.
- Never write or print a secret, PIN, pairing code or token. The local code is in `SCRATCH/localcode`: pass it as an argument only (`"$(cat …)"` inside the command, never echoed).
- Do not commit, push or deploy. Do NOT run `SCRATCH/repo-tests.sh`, and never kill another worker's wrangler.
- Server rules stay: no widening of `worker/src/policy.js` beyond Verses' own family `text:` rows for household adults (plus guests only if the existing guest rule already allows it).
- The declined features stay out: no kid routines/stars app, no shared grocery list. Verses gives no stars.
- Every existing element id in verses.html stays (`#trainer`, `#ref`, `#text`, `#say`, `#show`, `#act-show`, `#act-rate`, `#done`, `#empty`, `#again`, `#stats`, `#queue`, `#queue-list`, `#later-list`, `#who`, …), because tests and the audit tools use them. `window.verses` keeps its members; you may add some.
- **Shared-file etiquette.** Workers A and B both edit `apps/verses.html`.
  - Make small `Edit`s with unique anchors and re-read before each one. Never rewrite the file or run a formatter.
  - **A owns** the `<script>` logic, the copy, and the markup its entries add.
  - **B owns** the `<style>` block, the icon markup, and the new practice-mode/recording features. B puts its script in its own clearly marked block (`// ── practice modes (IMP-VERSES-I3) ──`, `// ── record yourself (IMP-VERSES-I1) ──`) and hooks into A's flow through small, named functions. Agree the hooks via `SCRATCH/b5-hooks.md`: A writes there which functions B may call (`currentId()`, `revealedNow()`, `rateCurrent(kind)`, `textOf(id)`) as soon as they exist.
  - Worker C owns `index.html`, `worker/`, `scripts/test-push2.mjs`, `scripts/smoke-api.sh`, `worker/README.md`, CLAUDE.md and sw.js.
  - Touch another worker's region only as much as your entry needs, and say so in your report.

## Worker A: Verses logic, data and copy (`apps/verses.html` `<script>` + markup for its entries)
- **The main entries:** GAP-VERSES-1 (the household text), P3-VERSES-05, -06, -08, -10, -11, -12, -13, -14, GAP-VERSES-2, GAP-VERSES-3, UX-VERSES-1, -2, -4, -8, -9, and IMP-VERSES-F6.
- **P3-VERSES-06.** Read aloud stays after Show and reads the text: move `#say` out of `#act-show` or show it in both states, and keep the id.
- **P3-VERSES-10.** Enter or Space on a focused button activates that button. The Show shortcut applies only when focus is not on a button or field.
- **P3-VERSES-13.** The veiled text gets `aria-hidden="true"` (and `inert`) until Show.
- **UX-VERSES-4 / -8.** The pill says "all done" only after reviews today, otherwise "nothing due". The star shows only after reviews. The due count is said once (the pill). The empty message is said once.
- **GAP-VERSES-3 / P3-VERSES-14.** The empty state's copy is "…you can review it here straight away", with an "Open F260" button. Inside the hub, open F260 through the hub: find how other apps link to an app (search for `openApp`, `hub.open`, `#f260`, or a `postMessage` the shell understands). Standalone, use `f260.html`. Kids never see it.
- **`window.verses`.** Keep test hooks for your new logic.
- **Also extend:** `scripts/test-verses.mjs` with your behaviour (the household text from a second profile, Not yet → box 1, Undo, the streak rule, the double-tap guard, the Enter rule, aria-hidden, the kid paraphrase and picture buttons, F6), and a claims check `audits/tools/phase6/5/verses-a-5.mjs` (pattern: `audits/tools/phase6/4/f260-a-4.mjs`).

## Worker B: Verses look, the carry-overs, and the two practice features
- **Entries:** VIS-VERSES-1 (the card sized to its content; no fixed min-height after Show, without a jump on Show, so reserve only what Show adds), VIS-VERSES-6 (the histogram tinted by box, a ramp from the first to the fifth box, not by count), IMP-VERSES-I3, IMP-VERSES-I1, and every item in `SCRATCH/b5-carry.md` → "Batch 5 must do for Verses" (wait for the file; poll every few minutes; start with the entries above).
- **The icons.** Move the app's private inline SVGs onto the shared sprite at `--icon-stroke`. Add a missing glyph to `icons/sprite.svg` in Lucide's style, and list it in `icons/LICENSE-lucide.txt` if it is Lucide. One drawing per meaning (04-design-system.md Table ICON-6).
- **Kid buttons.** UX-VERSES-1's kid picture buttons (A's logic) get B's styling. Agree the class names in `b5-hooks.md`.
- **Also write:** `audits/tools/phase6/5/verses-look-5.mjs`, which measures the card's empty band before and after Show at 390/820/1180/1440, adult and kid, the histogram's tint order, and the practice modes at 390 and XXL text with no horizontal scroll.

## Worker C: Home card, evening push, docs (`index.html`, `worker/`, tests, docs)
- **Entries:** GAP-HOME-2 with UX-VERSES-3, and IMP-VERSES-I2 (see the decisions above).
- **Tests.**
  - Extend `scripts/test-home.mjs` with the Verses card: shown or hidden, patched in place, opens Verses, and correct before Verses is opened today.
  - Extend `scripts/test-push2.mjs` with versesJob: the 7 pm hour, due > 0 only, the toggle off by default, once a day, never for kids.
  - Extend `smoke-api.sh` for the new pref and the cron job name, and update the count everywhere it is written (CLAUDE.md's Tests table says 325).
  - Add `audits/tools/phase6/5/cron-check-5.mjs` (pattern: `audits/tools/phase6/4/cron-check-4.mjs`).
- **Docs.** Update `CLAUDE.md`: the Memory verses bullet (the household text rows, the Leitner rule change, practice modes, record-yourself on device only, Undo, the streak rule), the Home card, Push, and the Tests table counts. Update `worker/README.md` too.
- **Precache.** If any precached file is added, add it to `SHELL` in `sw.js` and run `node scripts/bump-sw.mjs` ONCE at the end, after A and B are done. Ask the orchestrator; don't guess.

## How to check (report the numbers)
- **Scripts.** Run from the repo root: `NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules" node "<script>"`.
  - The batch's Phase 3 scripts are listed in `SCRATCH/b5-scripts.txt`. Their before-run on the pre-batch code is in `SCRATCH/5-before/`.
  - Scripts write evidence into `audits/evidence/…`: leave it.
  - If a script now fails only because its UI changed on purpose (for example, it asserts "box 4" or the old Not yet rule), copy it to `audits/tools/phase6/5/<name>-5.mjs` with a header comment saying why, fix its relative imports, and report both results.
- **Your own Worker.**
  - Copy `SCRATCH/d1-tmpl` to a SHORT path: A `C:\Users\ex_bo\AppData\Local\Temp\b5a\d1`, B `…\b5b\d1`, C `…\b5c\d1`.
  - Run `cd worker && npx wrangler dev --port <A 8792 | B 8793 | C 8794> --persist-to <that>`.
  - Use a fresh D1 copy per suite run. Stop your wrangler and delete the copy afterwards.
  - The suites serve the site on :8765, so only one suite runs at a time machine-wide. If :8765 is busy, wait and retry; never kill someone else's process.
- **Suites.**
  - A: test-verses, test-kidverse, test-f260, test-home.
  - B: test-verses, test-design, screens-apps (verses rows), test-prefs.
  - C: test-home, test-push2, smoke-api (the local Worker only), test-push, test-tv (the paraphrase copy check, if you touch it), test-kitchen (Home did not change for the kitchen).
- **Look.**
  - Run the capture rig ALWAYS with your own `--out SCRATCH/b5<a|b|c>/cap`, e.g. `node audits/tools/capture.mjs --out … --area verses --no-sheets` (C: `--area shell`). There is no --help flag: without `--out` it overwrites the baseline.
  - LOOK in light and dark at 390, 820, 1180 and 1440, and at XXL text, for adult, kid and guest.
- **Gates.**
  - `node SCRATCH/parse-check.cjs` after every edit: 0 failed.
  - `node audits/tools/phase4/tokens/contrast.mjs` if design.css changed.
  - No hex in `<style>`.
  - `node scripts/bump-sw.mjs --check` at the end.
  - Run `git checkout -- docs/screens` after tests.

## Report (short, to the orchestrator)
- Each entry: done, partly done or not done, and why.
- The files and regions you changed.
- Each script, before → after, with the numbers.
- The suite counts, and what you looked at.
- What needs a real device: speech, the microphone, the push on an iPhone.

## Timing note
The orchestrator's before-run (the batch's scripts on a pre-batch copy, then a capture) is using the browser ports until `SCRATCH/before-5.log` contains a line starting `capture exit`. Until then do not run any suite, Phase 3 script or capture. Read, plan and edit first.

**Update: the before-run has FINISHED.** Ports are free; run one suite at a time on :8765.
- 22 of 25 scripts exit 0 on the pre-batch code. 3 fail there because the tooling is stale, not because of the app:
  - `kid-flow.mjs` reads the old whole-map `f260.recall`; it has been `recall:<id>` rows since batch 0e;
  - `critic-doubletap.mjs` and `verify-critic-double-tap-rating-reveals-next-card-iphone-2-1.mjs` never see `#show` visible.
- Worker A owns those 3: fix them as `-5` copies in `audits/tools/phase6/5/` with a header note.
- `SCRATCH/b5-carry.md` now exists (Worker B). Its UX-VERSES-6 is the rating toast covering the box labels on the iPhone. It overlaps A's toast wording (P3-VERSES-05) and Undo (UX-VERSES-2): A and B agree the fix in `b5-hooks.md`.
- **The Almost icon.** Table ICON-6 says Lucide `circle-dashed`, which the sprite does not have yet. Don't reuse `i-circle-half`: F260's Halfway milestone already uses it.
