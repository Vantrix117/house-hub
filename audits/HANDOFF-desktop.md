# Desktop hand-over: back from the cloud session (2026-10-06)

Read `CLAUDE.md` first, then this file. It replaces `audits/HANDOFF-cloud.md` as the current state; that file still holds the process, the lessons and the step details for batches 8-11.

The owner is not a coder: plain words, short, and don't involve them until everything is done. Never write a secret, PIN or pairing code into the repo, a file or the chat.

## Why the work came back
- The cloud session ran out of its weekly model allowance mid-batch. Three of the four batch 9+10 workers stopped part-way through.
- The cloud machine has 4 cores, so the suites, captures and workers fought for time (load average 20-30). `verify.py` and some Playwright clicks timed out from load alone.
- **The cloud rig could not download WebKit** (blocked host), so every cloud browser run was Chromium. Never mix those numbers or pictures with the Windows WebKit ones.

## Branches. Do this first
- The cloud could push only to **`audit-wip-pxwuhn`**. It is `audit-wip` plus the cloud's commits, so it fast-forwards:
  ```
  git fetch origin audit-wip-pxwuhn
  git checkout audit-wip
  git merge --ff-only origin/audit-wip-pxwuhn
  git push origin audit-wip
  ```
- After that, keep working on `audit-wip` as before. Draft PR #1 (`audit-wip-pxwuhn` → `audit-wip`) can then be closed.
- `main` is still the live site. Never push to it, and never deploy (no `wrangler deploy`, no D1 `--remote`).
- The last commit on the branch is a **WIP** commit (`wip(batch 9+10): …`). It holds unreviewed work. The batch's real `fix(batch 9+10)` commit comes after review and the final run; it's fine to leave the WIP commit in the history, as `batch8-wip` was.

## What the cloud finished
- **Step 1, batch 7's audit half:** `31eb01d`. That covers the status entries, `05` rebuilt, the `06` section, and the pixel-diff and contrast accounting (shell 36 changes from the rewards card, 11 proved noise by a cloud re-capture; TV 8 changes from the no-week line). Kid Verse is 5.6 → 6.1.
- **Step 2, batch 8 code:** `bcc5981` (the merge of `batch8-wip`, with hand-merged `CLAUDE.md`, `worker/README.md` and `icons/LICENSE-lucide.txt`), then `6688e17`. `sw.js` is `hub-v48`.
  - An independent Opus reviewer **confirmed P6, R1 and R2** with its own probes (numbers in the commit message).
  - That review found `larder-look-8` failing 3 checks. All three are fixed in `bcc5981`:
    - The kid card wrapped its name, 157 → 120 px at 430. The fix the batch claimed was never in the file.
    - The empty count's height and baseline moved when the list filled.
    - The script never required the filled state. It does now.
  - Results: `larder-look-8` 170/170, `larder-a-8` 81/81 (Chromium).
- **Rig changes** (committed):
  - `audits/tools/lib/local.mjs` and `phase4/tokens/browser-check.mjs` accept `HUB_CHROME`, a Chromium path.
  - Batch 9's worker B made `local.mjs` take `OVERLAY` from the environment (in the WIP commit).

## Batch 8: what is left
1. **The final run, on Windows (WebKit).** The cloud's partial run (Chromium measurements only) was not kept. Use `final-7.sh` as before, with these settings:
   - the areas `leftovers`, `shell`;
   - the scripts `handoff-cloud/scratch/b8-scripts.txt` plus `audits/tools/phase6/8/*`;
   - the pre-batch base `654b45a`.
2. **Correct three test counts** in the `CLAUDE.md` Tests table. The merge set them by adding batch 8's new checks to batch 7's: smoke-api 446, test-home 125, test-kitchen 65. Correct them to what the final run prints.
3. **Status entries, 05, 06 and the `audit(phase 6): batch 8, …` commit.**
   - The rescore is done: `handoff-cloud/scratch/rescore-8/rescore.md`, Larder 5.5 → 6.0.
   - The three Phase 3 threshold scripts' `-8` copies are the measure.

## Batches 9 + 10: the state of the WIP
- **The template work is NOT in the Dollywood repo.** The cloud could not push there. It is saved as a patch:
  - `audits/handoff-desktop/dollywood-wip.patch`, which covers `scripts/template.html`, `build_html.py`, `verify.py` and `README.md`, against the Dollywood repo's `master` at `6192e96`.
  - Apply it from a clean checkout:
    ```
    cd ../dollywood-build-project
    git apply ../App\ Hub/audits/handoff-desktop/dollywood-wip.patch
    ```
  - Then rebuild, verify and export as usual. `build/*.html` and the copied `icons/` are build outputs; the patch leaves them out.
- **Hub side:** the WIP commit holds:
  - `apps/dollywood*.html` (an export from mid-work: **stale**, re-export after rebuilding);
  - `index.html` (the Home Build guide card);
  - `worker/src/park.js` (new; the "on the property" box) plus `reminders.js`, `index.js` and `chat.js` (the meeting-point arrival push `arriveJob` on the minute trigger, the off-property rule);
  - `icons/sprite.svg` (about 30 new symbols, listed in `icons/LICENSE-lucide.txt`);
  - tests (`smoke-api.sh`, `test-dollywood*.mjs`, `test-home.mjs`, `test-park.mjs`, `test-push2.mjs`, `seed/dollywood.mjs`);
  - `CLAUDE.md` and `worker/README.md` docs;
  - the claims scripts `audits/tools/phase6/9/{look-a-9,guide-b-9}.mjs` and `phase6/10/{park-c-10,park-d-10,verify3-rally-unreachable-1-10}.mjs`;
  - Worker A's evidence in `audits/evidence/p6/9/`.
- **Inputs** (copied into `audits/handoff-desktop/scratch/`):
  - `batch910-brief.md`, the worker brief. Its paths are the cloud's Linux ones; translate them.
  - `b910-carry.md`, the 20 carry-overs plus 2 unfiled findings.
  - `b910-hooks.md`, the workers' coordination log: what each built, the test hooks and the open items. **Read it.**
  - The entries are still `handoff-cloud/scratch/b910.md`. The before-run outputs to use are the Windows ones, `handoff-cloud/before-910-windows/`, because the cloud before-run got only 23 of 86 scripts.
- **Per worker** (the brief's split):
  - **A, the shared map and look: DONE.**
    - `look-a-9` 144/144 on the exported pages (pre-batch 59 pass / 77 fail). test-dollywood 42, test-dollywood-sync 60 and the themes suite passed at that point.
    - Partial: CONS-ICON-1 and VIS-ICON-1 (the arithmetic glyphs `× − ±`, the ellipsis, and the map-art stroke widths stay).
    - Not run: GLASS/layers, TELL/tells-webkit and SHAPE/analyze, which need WebKit. Run them on Windows.
  - **B, the build guide: nearly done; it stopped while editing `test-dollywood-sync.mjs`.**
    - Its region is clean, and `verify.py` passed through the whole hub flavour.
    - Check that sync test runs, then run `guide-b-9.mjs`.
  - **C, the park map: code written, not proven.**
    - `park-c-10.mjs` (18 sections) was written but never ran to a clean result.
    - `verify.py`'s kids'-heights check still looks for the old stepper (`.lv-kid … button[data-d="1"]`). The stepper is now a number field (UX-DOLLYWOOD-LIVE-7), so update that check.
    - Then run test-dollywood, screens-apps and the Phase 3/4 scripts, and look at the captures.
  - **D, the Worker, shell and infrastructure: most of it done; it stopped mid-edit on the "waits core".**
    - Done: the build fix (`HUB_REPO` or a sibling `house-hub`; `"App Hub"` still works on Windows; UTF-8 everywhere; `verify.py` over http), the sprite, rally, meeting pin, waits, the 6 h drop, trends, the Home card, the arrival push, the off-property rule and the docs.
    - Re-read the waits code (`waitOf`, `wlive`, `wtrend`, `trendOf`, `wErrLine`) for a half-finished change first.
    - Then run `park-d-10.mjs`, smoke-api, test-park, test-push2 and test-home.
- **`verify.py` at the end of the cloud session:** see the last section below.
- **Then the rest of the batch process:**
  1. One combined Opus review.
  2. The workers fix what it finds, until a confirmation round finds nothing new.
  3. An Opus rescore.
  4. The final run.
  5. Status entries (home batch 9 or 10).
  6. 05, the 06 section, and commits in both repos.
  - The commits are `fix(batch 9+10)` and `audit(phase 6)` here, and the template's own commit on its `master`.
- **Deferred by the plan** (tell the owner plainly at the end; they had asked for the first two):
  - "Left the park" alerts. A web page cannot read location in the background, so only *arriving at the meeting point* is built.
  - Park hours, shows and dining data. There is no feed for it, so only a link to dollywood.com is built.
  - A sharper illustrated map. The full-size official sheet is already used.
  - Ride pictures for kid mode, because the batch adds no new images.

## Batch 11 (Tally)
Not started. See `HANDOFF-cloud.md` Step 4. It also owns the pre-existing `screens-apps` Tally page-background failure.

## For the deploy, later, from the PC with the owner
- Unchanged from `HANDOFF-cloud.md`:
  1. A prod D1 backup.
  2. Migrations 006, 007 and 008-timer-live.
  3. `wrangler deploy`.
  4. Merge to `main`.
  - Live Mae (`christian`) needs a set-up code.
- **Batch 10 adds no migration and no new cron trigger.** `arriveJob` rides the existing minute trigger and keeps its memory in `settings.park_arrive`.

## verify.py at hand-over
- **Run:** the cloud ran it once more after the restart, on an idle machine (Chromium), against the current template with the patch applied.
- **What passed:** every reference and hub-flavour section, 3D included (the step outline, Back to map, the render loop), and the park map's first live/family checks: the reload, the auto-fix, share off, hidden/visible.
- **Where it stopped:** `verify.py` line 308, the kids'-heights check. It still clicks the old stepper (`.lv-kid[data-k=kiara] button[data-d="1"]` is null), which is now a number field (UX-DOLLYWOOD-LIVE-7, worker C).
- **To do:** update that check to type into the field, then run on to the end.
