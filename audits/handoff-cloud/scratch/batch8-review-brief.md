# Independent review of audit batch 8 (Larder), House Hub — combined core + visual

## Where to look
- **Code under review.** It lives in the git worktree `C:\Users\ex_bo\hub-b8`, branch `batch8-wip`. The uncommitted changes there (`git -C C:/Users/ex_bo/hub-b8 diff`, plus the untracked files) are batch 8. `ac5f7e4` is the pre-batch code.
- **Do NOT touch the main checkout** `C:\Users\ex_bo\OneDrive\Claude Related\App Hub`: batch 7 is in progress there. Run everything from the worktree.
- **SCRATCH** = `C:\Users\ex_bo\AppData\Local\Temp\claude\C--Users-ex-bo-OneDrive-Claude-Related-App-Hub\af3dfdac-12ca-439a-9836-6c1cb19fda21\scratchpad`
- **Read `CLAUDE.md` (in the worktree) first.** This batch changed its Larder, Kitchen, Kids, Push and Tests parts. Check that they are TRUE.

## What batch 8 was meant to do
- **The plan:**
  - `SCRATCH/b8.md`: 16 entries and IMP-LEFTOVERS-I1.
  - `SCRATCH/b8-carry.md`: carry-overs.
  - `SCRATCH/batch8-brief.md`: the decisions. Do not re-open them. Review whether the code is right and whether anything broke.
- **What the workers did:**
  - `SCRATCH/b8-report.md`: the digest.
  - `SCRATCH/b8-hooks.md`.
- **The batch's own checks:** `audits/tools/phase6/8/` (larder-a-8, larder-look-8, the threshold -8 copies).
- **The baseline:**
  - before-run: `SCRATCH/8-before/`;
  - pre-batch code: `SCRATCH/base8`;
  - pre-batch capture: `SCRATCH/cap8-before/`.

## Your focus: correctness AND the look, both

### Rules to hold
- **Batch 0h's stable layout.**
  - A remote change never moves a card.
  - ✓ and a full swipe finish in place with the 6 s Undo through ONE path.
  - Finished items are `finished:<id>` rows for 7 days, with Put back restoring every field (useBy, portion).
  - New items wait behind the "N new" pill.
  - `audits/tools/phase6/0h/larder-check.mjs` must pass.
  - A finished card no longer collapses, by decision.
- **The edit sheet.**
  - It keeps `by`, and posts no feed line.
  - Two devices editing the same item: last-write-wins per row is accepted, but nothing may be lost silently beyond that rule. Check what happens when one device finishes an item while another edits it.
  - The kitchen may edit. Kids and the TV cannot, and the Worker enforces that (policy.js).
  - A useBy in the future is accepted, while the date-made rule (`bad_date`) still holds.
- **One freshness rule.**
  - `hub.larder.fresh` and `worker/src/larder.js` must agree on every input: day boundaries in New York time, a use-by today, a use-by in the past, no date, a bad date, some-left.
  - Home, the Apps badge, the Kitchen Home and the 8 am push use the same words.
  - The push still goes once per person per day and to household adults only.
- **Swipe.**
  - It never breaks vertical scroll.
  - The vertical-drag-is-not-a-tap rule must not swallow real taps (small finger jitter).
  - Keyboard and screen-reader users still have the ✓ and the edit.
- **Kids' picture view and the TV.** Unchanged: no controls, targets of 64 px or more.
- **The Kitchen.**
  - Glance sizes for names and ages.
  - The adults' face sheet on ✓ and swipe.
- **Copy.** No claim that the hub's assistant can push to Hearth. On failure the text can be selected.
- **Look.**
  - No card or block under the add bar from 375 to 1440, and at XXL.
  - Two-line names.
  - Avatars in the person's colour.
  - No hex in `<style>`, never `prefers-color-scheme`.
  - Every icon from the sprite, with no doubled icons.
  - Press feedback.
  - Dark mode.
  - The sheet in light and dark.
  - LOOK at the captures yourself.
- **Docs.** CLAUDE.md, worker/README.md and the new "The Larder" bullet must match the code.
- **No regressions elsewhere:**
  - test-leftovers, test-home, test-kitchen, test-push2, test-apps, test-hub, smoke-api;
  - smoke-chat, which the worker did NOT re-run after a one-line chat.js change: run it, with the mock on 8791 (start `node scripts/mock-anthropic.mjs` yourself if nothing answers there);
  - home-art-5;
  - screens-apps (its Tally background failure predates this batch).

## How

### A real Worker
- Copy `SCRATCH/d1-tmpl` to a SHORT path: `C:\Users\ex_bo\AppData\Local\Temp\rv8\d1`.
- Apply `worker/migrations/008-timer-live.sql` to it once.
- Run `cd C:/Users/ex_bo/hub-b8/worker && npx wrangler dev --port 8901 --inspector-port 9901 --persist-to <that>`.
- Stop it afterwards (only what you started) and delete the copy.
- Do NOT run `SCRATCH/repo-tests.sh`.
- Never kill processes by name.

### The suite lock
Suites serve on localhost:8765, so only one runs at a time, machine-wide. Batch 7 agents run suites from the main checkout and share the lock.
- Use `SCRATCH/suite.lock`.
- Wait for it with NO time limit inside your turn.
- Remove ONLY your own lock.

### Setup for scripts
- `NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules"`.
- The rig: `audits/tools/lib/local.mjs` (two devices, offline, clock control).

### Captures
- `node audits/tools/capture.mjs --area leftovers --out SCRATCH/rev8/cap`.
- Never `--help`.

### Ground rules
- Parse every inline script: adapt `SCRATCH/parse-check.cjs` to the worktree.
- Do not edit repo files, and do not commit.
- Keep scratch files under `SCRATCH/rev8/`.
- Never write or print a secret, PIN, pairing code or token. `SCRATCH/localcode` is passed as argv only.

## Report (short, ranked)
- **For each finding:**
  - severity: high / medium / low / nit;
  - file:line;
  - what is wrong;
  - a concrete repro: what you ran and saw;
  - the smallest fix.
- **Keep two groups apart:**
  - regressions this batch caused;
  - batch-8 entries not actually fixed.
- **Also say:**
  - what you checked and found fine;
  - what you did not check.
- At most about 20 findings.
