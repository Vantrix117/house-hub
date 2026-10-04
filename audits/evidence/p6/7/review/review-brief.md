# Independent review of audit batch 7 (Kid Verse), House Hub — combined core + visual

## Where things are
- **Repo:** `C:\Users\ex_bo\OneDrive\Claude Related\App Hub`.
  - The uncommitted working tree is batch 7: `git diff HEAD` plus untracked files.
  - HEAD `ac5f7e4` is the pre-batch code.
  - Batch 8 lives in a separate worktree (`C:\Users\ex_bo\hub-b8`). Ignore it and don't touch it.
- **SCRATCH:** `C:\Users\ex_bo\AppData\Local\Temp\claude\C--Users-ex-bo-OneDrive-Claude-Related-App-Hub\af3dfdac-12ca-439a-9836-6c1cb19fda21\scratchpad`
- **Read `CLAUDE.md` first.** This batch changed its Kids, Stars & badges, TV, Who may write what, Photos/media and Tests parts. Check that they are TRUE.

## What batch 7 was meant to do
- **The plan:**
  - `SCRATCH/b7.md`: 16 entries plus IMP-KIDVERSE-F3, I1 and I2.
  - `SCRATCH/b7-carry.md`: the carry-overs. Item 8 (dark art) was declared out of scope.
  - `SCRATCH/batch7-brief.md`: the decisions. Do not re-open them. Review whether the code is right and whether anything broke.
- **What was done:** `SCRATCH/b7-report.md` (the digest) and `SCRATCH/b7-hooks.md`.
- **The batch's own checks:** `audits/tools/phase6/7/` (stars-a-7, kidverse-look-7, voice-7).
  - Worker A is writing date-pinned `-7` copies of the reset repro scripts right now. Don't wait for them.
- **The baseline:**
  - before-run: `SCRATCH/7-before/`;
  - pre-batch code: `SCRATCH/base7`;
  - pre-batch capture: `SCRATCH/cap7-before/`.

## Your focus: correctness AND the look, both
This is the hub's most fragile logic: kids' stars across two devices.

### Rules to hold
- **Kid Verse, signed in as that kid, is the ONLY writer** of the kid's star rows and of the family mirrors `stars:<kid>` / `story:<kid>`. Adults write only append-only `ledger:` rows.
- **Ledger rows.** Every ledger row is applied exactly once. A star earned while a parent's action is in flight adds on top. One star a day per kind holds, even after a reset.
- **Reset.** It clears its listed days for all three kinds, across an ISO-week rollover.
  - An uncredited story or prayed day is spent; a day with no event is never spent.
  - Check the stated rule "on the reset's own date an event counts as before the reset". Does it ever take away a star the kid earned after the parent's reset? It may take away the chance to earn one that day; that is accepted.
- **Pruning (KEEP_DAYS 30, creditedBase, appliedBefore).** Totals and badges are identical to the exact derivation in every case.
  - Hunt for the edge: a ledger row older than 90 days arriving late; a badge depending on a pruned count; two devices with different pruning moments writing the mirror.
  - One mirror write per change.
- **The shell's `effectiveStars`/`rewardRow`.** The Home Kids card, Me, and the TV stars pane agree with Kid Verse on the same rows, including a pending ledger row and an earlier-week mirror.
- **The Move offer.** The New York Sunday 5 pm window, the "set > 5 days ago" rule, Not now per adult per week, never for kids, and nothing at week 52. A week change posts exactly one feed line.
- **No week set.** Kids get no star and nothing written. The TV and Home are calm.
- **The voice (privacy is the point).**
  - The GET needs a session.
  - `/api/media/*` cannot fetch voice bytes.
  - Bytes of a replaced or removed recording are gone.
  - Only household adults upload; the type and size limits are enforced on the server.
  - A client cannot write `voice:` rows.
  - Try to break it with curl against your own Worker.
- **The highlight and the shelf.**
  - The shelf writes nothing.
  - The highlight never breaks speech.
  - Spoken toasts never talk over each other or over a reading.
- **The kids' first screen** at 390×844, 430×932, 820×1180, 1180×820 and 1440×900 inside the hub viewer.
  - Adults see their panel first.
  - Kid targets are ≥ 64 px.
  - No doubled icons; every icon comes from the sprite.
  - No hex in `<style>`, and never `prefers-color-scheme`.
  - The `apps/design.css` token half (lines 11-765) is byte-identical to `git show ac5f7e4:apps/design.css | sed -n 11,765p`.
  - Dark mode, and XXL.
  - LOOK at the captures yourself, for Ezra, Kiara, an adult and the TV.
- **No regressions:**
  - test-kidverse, test-rewards, test-kidstory, test-home, test-tv, test-kitchen, test-hub, test-verses, smoke-api, smoke-chat. smoke-chat needs the mock on 8791; start `node scripts/mock-anthropic.mjs` if nothing answers.
  - home-art-5 = 0.
  - The Kid Verse paraphrase table: the copies in `index.html` (TV) and `apps/verses.html` still agree (test-tv, test-verses).
  - `handoff/prayer/check.js` 47/2 and `audits/tools/phase6/0g/check-ids.js` 49/49 (unchanged).

## How
- **A real Worker.**
  - Copy `SCRATCH/d1-tmpl` to a SHORT path: `C:\Users\ex_bo\AppData\Local\Temp\rv7\d1`.
  - Apply `worker/migrations/008-timer-live.sql` to it once.
  - Run `cd worker && npx wrangler dev --port 8902 --inspector-port 9902 --persist-to <that>`.
  - Stop only what you started, and delete the copy afterwards.
  - Do NOT run `SCRATCH/repo-tests.sh`, and never kill processes by name.
- **The suite lock.** `SCRATCH/suite.lock` is machine-wide. A batch 8 reviewer and Worker A also use it.
  - Wait with NO time limit inside your turn.
  - Remove ONLY your own lock.
- **Scripts.** Set `NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules"`. The rig is `audits/tools/lib/local.mjs` (two devices, offline, clock control).
- **Captures.**
  - Run `node audits/tools/capture.mjs --area kidverse --out SCRATCH/rev7/cap`, plus `--area tv`/`--area shell` if needed.
  - Never `--help`.
  - The capture area's kid-award screen was just updated by the orchestrator to inject a week.
- **Gates.**
  - `node SCRATCH/parse-check.cjs` prints 0 failed.
  - Do not edit repo files, and do not commit.
  - Scratch goes under `SCRATCH/rev7/`.
  - Never write or print a secret, PIN, pairing code or token. `SCRATCH/localcode` is passed as argv only.

## Report (short, ranked)
- **For each finding:**
  - severity: high / medium / low / nit;
  - file:line;
  - what is wrong;
  - a concrete repro: what you ran and saw;
  - the smallest fix.
- **Two groups, kept apart:**
  - regressions this batch caused;
  - batch-7 entries not actually fixed.
- **Also say:**
  - what you checked and found fine;
  - what you did not check.
- At most about 20 findings.
