# Batch 6 (Kitchen timer): write the status entries

- **Repo:** `C:\Users\ex_bo\OneDrive\Claude Related\App Hub`.
- **SCRATCH:** `C:\Users\ex_bo\AppData\Local\Temp\claude\C--Users-ex-bo-OneDrive-Claude-Related-App-Hub\af3dfdac-12ca-439a-9836-6c1cb19fda21\scratchpad`.
- **Limits:**
  - Do not edit repo files; your one output is the file below.
  - Never print or write a token, code or PIN.

## Inputs
- **`SCRATCH/b6.md`:** the 24 entries (the `#### <ID>` headings) and the kept improvement IMP-TIMER-I2 in the table at the end.
- **`SCRATCH/b6-carry.md`:** the earlier batches' leftovers with a Timer part.
  - Read each id's current note in `audits/tools/phase6/status.mjs`: search `J1("<id>"`, `W4c("<id>"` and `W5c("<id>"`. The latest one wins.
  - That tells you what other apps still owe.
- **`SCRATCH/b6-report.md`:** the workers' reports, every review round (core 1-3, visual 1-5) and every fix.
- **`SCRATCH/batch6-brief.md`:** the data contract and the decisions.
- **The final run, filed under `audits/evidence/p6/6/`:**
  - `tests/repro-before/` and `tests/repro-after/`: every script's console output.
    - `p6-6__*` are the batch's copies and checks: timer-a-6, timer-look-6, cron-check-6, verify-offline-sweep-6, verify-queue-merge-6, verify-done-dial-oval-1-6, verify3-…-6, basics-6, background-6, the early-finish, audiocontext and notify copies.
    - `p6-5__/p6-4__/p6-3__` are earlier batches' copies, kept as regression checks.
  - `workers/`: those scripts' own evidence.
  - `p2/`, `p3/`, `p4/`.
  - `checks/`.
  - `tests/suites/`, `tests/smoke-*.txt`.
  - `measure/`: the timer, shell and tv re-measured; `measure/contrast-accounting.md`.
  - `p4tools/out` vs `p4tools/before`: the Phase 4 tools, plus TELL tells-webkit for the timer.
  - `capture/pxdiff-*.txt` and `capture/verses-noise.md`.
  - `review/`.
- **Final-run notes:**
  - test-apps failed 47/1 in the final run on a stale assertion (the old `lastPreset` row). It was updated to the new `recents` contract and re-run: 48/0 (`tests/suites/test-apps.rerun.txt`).
  - `p6-3__prayer-look-3` hit the 25-minute limit under load. Re-run alone: 61/0 in 27 s (`tests/repro-after/p6-3__prayer-look-3.rerun.txt`).
- **The after captures:** `audits/screens-after/6/<area>/*.png` (git-ignored). Cite at most one PNG per entry, and only when a visual entry needs it.

## Output
Write `SCRATCH/status-6.json` as `{ "entries": [[id, status, note, after[]], ...], "work": [[id, status, note, after[]]], "carry": [[id, status, note, after[]], ...] }`.

- **`entries`:** exactly the 24 ids, in b6.md order.
- **`work`:** IMP-TIMER-I2.
- **`carry`, in this order:** CONS-TYPE-1, CONS-TYPE-2, GAP-TOK-4, P4-SHAPE-01, CONS-ICON-1, CONS-ICON-2, GAP-ICON-2, CONS-TELL-1, CONS-MOTION-1, CONS-DARK-1, CONS-ACCENT-2, P4-ICON-01, GAP-TOK-3, VIS-COLOR-1.
  - The last four were flagged as possibly stale: they were open only for the app TILES, which batch 2a may have finished.
  - Verify each against the code (`index.html` tiles carry `data-accent` from `apps.json` `hue`; `design.css` ~554) and against the tool evidence. Mark FIXED only with evidence. A tool you need can run on a scratch copy only.
- **Status:** one of FIXED, PARTIAL, DEFERRED or NEEDS DEVICE CHECK.
  - A carry-over is FIXED only if no app's part remains anywhere.
  - P4-SHAPE-01: the reviewers measured the kid pill at 64 px.
  - **The 24 entries:**
    - PWA-GAP-1: the real push is proven in process (cron-check-6, test-push2). Real delivery to a phone is not verified; say so.
    - UX-TIMER-5: the Kitchen iPad glance is measured in the rig, with a real kitchen device seeded. Reading distance across a room needs a device.
    - GAP-TIMER-2: the iOS sound unlock and ringing while locked need a device.
    - Use NEEDS DEVICE CHECK only where the claim is provable only on a device.
  - **Two improvements beyond the entries.** Record them in the most fitting entry's note (P2-STAB-13 or GAP-TIMER-3), not as new ids:
    - the shared SDK's per-document write queues (fixing a lost write between the shell and an app frame, and between two tabs);
    - the Home card grid fixes.
  - **Pre-existing failure:** the Tally "page background" failure in screens-apps is pre-existing; mention it only if relevant.
- **Note:** plain English, at most 700 characters.
  - Say what changed, then concrete before → after numbers taken from the files. Read the actual outputs: a script can exit 0 while it still reports the defect.
  - Name anything not verified.
  - Say when an original script now fails only because the UI or data contract changed on purpose and its -6 copy passes.
  - No key-like strings of 24 or more characters.
- **`after`:** 1-4 repo-relative paths that EXIST, under `audits/evidence/p6/6/`, or one `audits/screens-after/6/...` PNG.
- **Model:** follow the style of the batch 5 entries in `audits/tools/phase6/status.mjs` (search `W5(` and `W5c(`).

## When done
1. Run `node SCRATCH/status-6-check.cjs`. It must print "all … checks pass".
2. Reply with:
   - the counts per status, per section;
   - any entry you were unsure about.
