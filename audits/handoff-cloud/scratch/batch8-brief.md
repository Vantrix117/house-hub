# Batch 8 (Larder): brief for the workers

## Setup: READ CAREFULLY

### Where to work
- **You work in a separate git worktree:** `C:\Users\ex_bo\hub-b8`, branch `batch8-wip` at `ac5f7e4`. Batches 0a-6 are done.
- **Edit ONLY files under `C:\Users\ex_bo\hub-b8`.**
- **Never touch the main checkout** `C:\Users\ex_bo\OneDrive\Claude Related\App Hub`. Batch 7 is being built there right now by other agents.
- Run every script, suite and capture from `C:\Users\ex_bo\hub-b8`.
- Do not commit. The orchestrator merges your changes after batch 7 is committed.

### Shared resources
- **SCRATCH** = `C:\Users\ex_bo\AppData\Local\Temp\claude\C--Users-ex-bo-OneDrive-Claude-Related-App-Hub\af3dfdac-12ca-439a-9836-6c1cb19fda21\scratchpad` (shared with batch 7).
- **SCRATCH/suite.lock** is machine-wide and shared with batch 7's workers.
  - Any repo suite (anything that serves the repo on localhost:8765) needs the lock.
  - Write your name in it and delete it when done.
  - Wait for it in a sleep loop inside your turn, with no limit. Never remove another's lock.

### Read first
- **`CLAUDE.md`** (in the worktree), the parts that apply here:
  - the Kitchen device (the Larder's ✓ credits an adult through `hub.whoDidThis`);
  - the Kids bullet (the Larder's read-only picture view);
  - Push (the 8 am fridge job);
  - the shell;
  - the shared sprite, `hub.toast`, `hub.confirm` and the segmented control;
  - the Tests table (test-leftovers; the ✓ behaviour is checked by `audits/tools/phase6/0h/larder-check.mjs`).

## The batch
- **Entries:** `SCRATCH/b8.md`. There are 16 entries, plus IMP-LEFTOVERS-I1 at the end.
- **Carry-overs:** `SCRATCH/b8-carry.md` lists the earlier batches' unfinished entries with a Larder part. A classifier is writing it now. Worker E picks it up when it exists.
- **Phase 3 report:** `audits/03-apps/leftovers.md`.
- **App:** `apps/leftovers.html`.
- **Batch 0h rules (keep them all):**
  - ✓ finishes in place for 6 s with Undo.
  - Finished items are kept as `finished:<id>` rows for 7 days under "Recently finished", with Put back.
  - STABLE LAYOUT: a remote change never moves a card. New items wait behind a "N new · Show" pill.

## Decisions (do not re-open)

### Freshness
- **One freshness rule (P3-LEFTOVERS-02).**
  - Without a use-by: 0-3 days is fresh, 4-6 days is "eat soon", 7 or more is "use it up".
  - With a use-by (GAP-LEFTOVERS-1): "use it up" from the use-by day, "eat soon" in the 2 days before it.
- **One place for the rule.** Add it to `apps/hub.js` as `hub.larder.fresh(item, today)`, returning `{ level: 'fresh'|'soon'|'old', days, daysLeft, label }`, with the labels shared ("Eat soon", "Use it up", "3 days").
- **Who uses it:**
  - the Larder;
  - Home's fridge card and the Apps badge (`index.html`);
  - the 8 am push.
- **The Worker's copy.** The Worker cannot import hub.js, so it gets one small copy in `worker/src/larder.js`. `morningJob` in `worker/src/reminders.js` uses that copy.
  - The push says "Use it up: chili (8 days) · Eat soon: soup" in the same words.
  - It is sent when anything is soon or old, replacing the old 5+ day rule.
  - A table test runs both copies over the same items and asserts they agree.

### Editing items
- **Edit (GAP-LEFTOVERS-1, P3-LEFTOVERS-11).**
  - Tapping a card's body (not the ✓) opens an edit sheet: name, size, the date it was made/logged, and an optional use-by date.
  - Save keeps `by` (logged by) and adds `editedBy`/`editedAt`. No feed line for an edit.
  - Kids (the picture view), the TV and the kitchen's adult rule are unchanged: the kitchen may edit (it is a family write); kids and the TV cannot.
  - Names wrap to 2 lines on the card. The sheet shows the full name.
  - Enter saves and Escape closes.
- **Validation (UX-LEFTOVERS-5).** An empty name shows "Type what it is" under the field and focuses it.
- **After Log (UX-LEFTOVERS-6).** Toast "Logged Taco soup", and the new card scrolls into view above the bar.

### Errors and banners
- **Copy (P3-LEFTOVERS-10, UX-LEFTOVERS-4, VIS-LEFTOVERS-9).**
  - Rename "Copy list for Hearth" to "Copy the list", and REMOVE the instruction to tell Claude to push to Hearth. It must make no claim that the hub's assistant can do it.
  - Neutral help text instead: "Paste it into a message, a note or Hearth."
  - On copy failure, show the text in a pre-selected read-only box with "Select and copy", and offer `navigator.share` where it exists.
  - The Copy button uses a copy icon from the sprite, never the refresh glyph.
- **Sync error (UX-LEFTOVERS-8).** Plain words ("Couldn't reach the house. Your changes are saved on this device.") with a Retry button that pulls. Never a raw server code.
- **The red banner (UX-LEFTOVERS-9).** It names the oldest item ("Taco soup is 9 days old · and 2 more"). A tap scrolls to that card and highlights it briefly; the highlight is static under Reduce Motion.

### Look
- **Who logged it (VIS-LEFTOVERS-4).** Each card shows who logged it with `hub.avatarHtml` (small) beside the name/line, so the person's colour shows.
- **Form controls (VIS-LEFTOVERS-5).**
  - The size select is styled like its siblings, with no native grey.
  - Dates are friendly: "Mon 14 Sep · 8 days". An earlier year shows the year.
- **The add bar (VIS-LEFTOVERS-6).**
  - The list's bottom padding equals the bar's measured height plus the safe area, so no card and no block ends under the bar.
  - The bar stays glass: the house rule is that floating toolbars are glass, and Solid glass makes it opaque.
- **Motion (VIS-LEFTOVERS-8).**
  - The ✓ and Log use the shared `.pressable` press.
  - A finished card collapses out with a motion token. Under Reduce Motion it fades only, or nothing.
  - Toasts use `hub.toast`.
- **The mic (VIS-LEFTOVERS-11).** Its space is reserved from first paint (hidden with visibility, not display), so the field never shrinks. Where speech is not supported at all it is removed before first paint, from a synchronous feature check.
- **The Kitchen iPad (UX-LEFTOVERS-3).** On the Kitchen device (`data-kind="kitchen"`) the oldest item's name and age use `--fs-glance-3`. Card names use a glance role too, readable from 2 m. Measure the cap height in mm on the 11" iPad (0.1924 mm per CSS px) and report it.

### Swipe and portions (IMP-LEFTOVERS-I1)
- **Swipe to finish.**
  - An iOS-style trailing swipe on a card reveals Finish. A full swipe finishes it through the same 6 s Undo path as ✓.
  - Pointer events, with the horizontal intent decided after 10 px so vertical scroll never breaks.
  - The ✓ stays for grandparents.
  - Kitchen: the swipe opens the adults' face sheet like ✓.
  - Kids and the TV: no swipe.
- **Some left.**
  - The edit sheet and the swipe offer "Some left", which sets `portion: 'some'` on the row.
  - The card shows a half-filled bar or icon plus the words "Some left". Undo works.
  - Old rows have no `portion` and mean full.
  - The Home card and the push count a "some left" item like any other.

## Hard rules
- **Colours and CSS.**
  - Every colour is a design.css token. No hex in `<style>`, and never `prefers-color-scheme`.
  - `apps/design.css` lines 11-765 stay byte-identical to `git show ac5f7e4:apps/design.css | sed -n 11,765p`.
- **Files you must not touch:**
  - the pre-paint bootstraps;
  - `handoff/`;
  - the other apps' html files.
- **Process.**
  - No build step, no downloads. Keep line endings.
  - Never write or print a secret, PIN, code or token. The local code is in `SCRATCH/localcode`; pass it only as an argument.
  - No commit, push or deploy.
  - Do NOT run `SCRATCH/repo-tests.sh`. Never kill another agent's wrangler, and never kill processes by name.
- **Ids and test hooks.** Existing ids and test hooks stay; add new ones. When visible words change, update the tests that match them (`test-leftovers.mjs`, `larder-check.mjs` — the latter by a copy in `audits/tools/phase6/8/` if its contract changed on purpose, with a header saying why).
- **Server rules stay.** The policy for leftovers rows: check that `portion`, `useBy`, `editedBy` and `editedAt` pass `worker/src/policy.js`'s leftovers rules (the 0i `bad_date` rule applies to the date; decide whether a future `useBy` is allowed — it must be). Change only what is needed.
- **Who owns what in the worktree.**
  - **Worker D:** the `<script>` logic in `apps/leftovers.html`, `apps/hub.js`, `index.html`, `worker/`, the tests and the docs.
  - **Worker E:** `<style>`, the markup, icons and layout.
  - Agree hooks in `SCRATCH/b8-hooks.md`.
  - Make small Edits with unique anchors, and re-read before each.

## Worker D: logic, the shared rule, the shell and the Worker (Sonnet)
- **Entries:**
  - P3-LEFTOVERS-02;
  - GAP-LEFTOVERS-1 (the data and sheet logic);
  - P3-LEFTOVERS-10, P3-LEFTOVERS-11 (the tap logic);
  - UX-LEFTOVERS-4 (the words), UX-LEFTOVERS-5, -6, -8, -9;
  - IMP-LEFTOVERS-I1 (swipe and portion logic).
- **Tests:**
  - Extend `scripts/test-leftovers.mjs`, `scripts/test-home.mjs` (the fridge card wording) and `scripts/test-push2.mjs` (the morning push wording and rule).
  - Extend `scripts/smoke-api.sh` if policy changes.
  - Write `audits/tools/phase6/8/larder-a-8.mjs`, a claims check. It proves the shared rule agrees in all four places, plus edit, use-by, copy failure, the banner tap, the sync error, swipe and some-left.
- **Docs:** update `CLAUDE.md` (the Kitchen and Kids notes on the Larder, Push's fridge line, the Tests table counts) and `worker/README.md`.

## Worker E: the look, the Kitchen glance, the carry-overs (Sonnet)
- **Entries:**
  - VIS-LEFTOVERS-4, -5, -6, -8, -9, -11;
  - UX-LEFTOVERS-3;
  - the look of D's sheet, banner, error, copy box, swipe and some-left;
  - every item in `SCRATCH/b8-carry.md` under "Batch 8 must do for the Larder" (Larder parts only).
- **Icons:** take them from the sprite, adding what is missing in Lucide geometry, listed in `icons/LICENSE-lucide.txt`. One drawing per meaning.
- **Check:** write `audits/tools/phase6/8/larder-look-8.mjs`. It measures:
  - no card or block under the add bar;
  - two-line names;
  - no field shrink after ready;
  - the Kitchen glance cap height;
  - avatars;
  - no horizontal scroll from 375 to 1440 and at XXL;
  - kid view unchanged.

## How to check (report the numbers)
- **Scripts.** Run from the worktree root: `NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules" node "<script>"`.
  - Phase 3 scripts: `SCRATCH/b8-scripts.txt`.
  - The before-run (pre-batch code) is in `SCRATCH/8-before/`. It is still running until `SCRATCH/before-8.log` has a `capture exit` line; until then run nothing heavy, but read and edit.
  - Read the actual output, not only the exit code. If a script fails only because its contract changed on purpose, copy it to `audits/tools/phase6/8/<name>-8.mjs` with a header comment.
- **Your own Worker.**
  - Copy `SCRATCH/d1-tmpl` to `C:\Users\ex_bo\AppData\Local\Temp\b8d\d1` (D) or `…\b8e\d1` (E).
  - Apply `worker/migrations/008-timer-live.sql` to the copy once (`npx wrangler d1 execute house-hub --local --persist-to <copy> --file migrations/008-timer-live.sql`; it is idempotent).
  - Then run `cd worker && npx wrangler dev --port <D 8795 | E 8796> --persist-to <copy>`.
  - Use a fresh copy per suite run, then delete it.
- **Capture.** Always pass `--out SCRATCH/b8<d|e>/cap --area leftovers`. Never `--help`.
  - LOOK at the PNGs: light and dark at 390, 820, 1180 and 1440 and at XXL; adult, kid, the Kitchen iPad.
- **Gates.**
  - `node SCRATCH/parse-check.cjs`. It checks the main repo by default: read it and point it at the worktree, or copy and adjust it.
  - No hex in `<style>`.
  - `node scripts/bump-sw.mjs --check`.
  - `audits/tools/phase6/5/home-art-5.mjs` stays at 0 if Home changes.
  - Run `git checkout -- docs/screens` in the worktree after tests.

## Report (short)
- Each entry: done, partly done or not done, with why.
- Files and regions changed.
- Scripts before → after.
- Suite counts.
- What you looked at.
- What needs a real device.
