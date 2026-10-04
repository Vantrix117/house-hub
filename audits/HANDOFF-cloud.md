# Cloud hand-over: Phase 6 audit, from batch 7's write-up on

Written 2026-10-04 by the desktop session. The owner moved the audit here to use cloud credit. Read `CLAUDE.md` first, then this file.

The owner is not a coder: explain in plain words, keep it short, and don't involve them until everything is done. Never write a secret, PIN or pairing code into the repo, a file or the chat.

## Branches. Read before any git command
- **`audit-wip`** (this branch) holds every finished batch, 0a-7. `main` is the LIVE site: GitHub Pages deploys `main`.
  - **Never push to main and never deploy anything** (no `wrangler deploy`, no D1 `--remote`).
  - Commit to `audit-wip` and push only that branch.
  - Deploying is done later, from the owner's PC, with them.
- **`batch8-wip`** holds batch 8 (the Larder), built and reviewed in a separate worktree off `ac5f7e4` and committed there as one WIP commit. It still needs merging (step 2).
- **The Dollywood template** is the private repo `github.com/Vantrix117/dollywood-build-project`, branch `master`.
  - Clone it next to this repo as `../dollywood-build-project`. CLAUDE.md's Dollywood note explains the build/verify/export loop.
  - Its own commits go to its `master`. Nothing is deployed from it.

## Where the audit stands
- **The plan.** `audits/05-findings.md` holds every finding by batch. `audits/tools/phase6/status.mjs` holds every entry's status, and `node audits/tools/phase5/build-findings.mjs` rebuilds 05 from it. `audits/06-implementation.md` has one section per batch; copy batch 6's section as the model.
- **Batches done and committed:** 0a-0i, 1, 2a-2c, 3 Prayer, 4 F260, 5 Verses, 6 Timer, and **7 Kid Verse code** (`7a77c6b`, branch `audit-wip`).
- **Batch 7's audit half is NOT done yet.** That is the status entries, the 05 rebuild, the 06 section and the `audit(phase 6): batch 7, …` commit (step 1).
- **Batch 8:** built, reviewed, rescored (5.5 → 6.0), and its review fixes are in. One last short confirmation is still needed (step 2).
- **Left:** batches 9 + 10 (combined), then 11. The owner may later add a new app as batches 12 and 13; they will say what it is for.
- **Production.** Nothing is deployed since 2026-09-20 (live site `hub-v27`). Deploy order, done later from the PC: prod D1 backup, then migrations 006, 007 and 008-timer-live, then `wrangler deploy`, then merge to main. Live Mae (id `christian`) has no PIN; the admin gives her a set-up code.

## The process
The owner authorised speed, "as long as the actual fixes are made and verified". Per batch:
1. **Extract the entries** (`handoff-cloud/scratch/extract-b7.cjs` is the model; `b910.md` and `b910-scripts.txt` are already extracted).
2. **Sort carry-overs.** A Sonnet agent lists earlier batches' non-FIXED entries with a part for this app (`b7-carry.md` is the model).
3. **Before-run.** Run the batch's repro scripts plus a capture of the area on the pre-batch code (`git archive`). See `before-910.sh`.
4. **Workers.** Sonnet workers, by region of the file; each has a brief (`batch7-brief.md` and `batch8-brief.md` are the models).
5. **One combined Opus reviewer** (core plus look). The workers fix what it finds, and the loop continues until a confirmation round finds nothing new.
6. **Independent Opus rescore**, on the workers' captures, BEFORE the final run (`rescore-7`, `rescore-8`, and `audits/evidence/p6/6/rescore.md` as the model).
7. **One final run** (`final-7.sh`): measure the areas, run the repro lanes and the phase6 copies, the checks, all repo suites, smoke-api, smoke-chat, bump-sw and parse. Then the Phase 4 tools before and after (`p4tools-7.sh`), then capture into `audits/screens-after/<n>` and assemble (`assemble-7.sh`).
8. **Status entries.** A Sonnet writer works from `status6-brief.md`, `status-6-check.cjs` and `status-6-apply.cjs`. Carry-overs keep their home batch (`W6c`-style).
9. **Rebuild 05, append the 06 section, and make two commits:** `fix(batch N): …` (code), then `audit(phase 6): batch N, …`. Each ends with the attribution line the system gives you.

## Lessons, to avoid repeating mistakes
- **Read the actual output, not exit codes.** Copies of repro scripts can exit 0 while reporting the defect.
- **Stale scripts.** When a Phase 2/3 script fails only because the UI or data contract changed on purpose, write a `-N` copy in `audits/tools/phase6/N/` with a header saying why, and run it on both the pre-batch archive and the final code.
- **Date-dependent scripts prove nothing.** Pin the clock; see batch 7's `*reset*-7.mjs`. The three "uncredited" reset copies must not run on a Monday.
- **Never run `capture.mjs --help`.** It starts a full capture into the baseline. Always pass `--out`.
- **One suite at a time.** Suites serve the repo on `localhost:8765`, so only one may run at once. Use a lock file, and never kill other agents' processes by name.
- **Restore evidence after tests.** `git checkout -- docs/screens`, and restore `audits/evidence/p2|p3|p4` after scripts rewrite them. Copy the after-run out first.
- **Redact.** Run `handoff-cloud/scratch/redact.cjs` on smoke outputs before committing (it blanks throwaway local tokens).
- **Look at the captures yourself.** Reviewers have missed cross-app regressions.
- **Desktop history.** The desktop session's full lessons list is `handoff-cloud/desktop-memory-hub-audit-progress.md`. Its file paths refer to the owner's Windows PC.

## Setting up the rig on Linux (prove it first)
The audit rig lives in the repo: `audits/tools/capture.mjs`, `areas/`, `seed/`, `lib/local.mjs` and `lib/server.mjs`. The last one runs the real Worker on an in-memory D1, so no wrangler is needed for the rig.
- **Playwright.** `capture.mjs` installs `playwright-core` plus WebKit on first run into `$HUB_AUDIT_HOME` (default `~/house-hub-audit`).
  - Set `NODE_PATH=$HUB_AUDIT_HOME/node_modules` for the scripts.
  - Do NOT add a `package.json` to the repo.
- **Chromium.** `lib/local.mjs:38` looks only for Windows Chrome/Edge paths. On Linux, install a Chromium (e.g. `npx playwright install chromium` into `HUB_AUDIT_HOME`) and make that line also accept an env var such as `HUB_CHROME`. That is a small, safe change; commit it with the batch.
- **No baseline screenshots.** `audits/screens/` (the Phase 1 baseline, about 1.2 GB) is git-ignored and is not here. Compare the cloud's own before capture with its after capture. Never mix Windows and Linux screenshots, because fonts render differently.
- **No measure raw data.** `audits/evidence/p4/measure/raw` (about 1.4 GB) is git-ignored. Run `measure.mjs --run themes|devices|states --area <a> --force` for the batch's areas before aggregating, and say that other areas are absent.
- **Repo suites** (`scripts/test-*.mjs`, `smoke-api.sh`, `smoke-chat.sh`) need a local Worker:
  - Run `cd worker && npx wrangler dev --port 8787 --persist-to <dir>`, on a local D1 built from `worker/schema.sql`, `worker/seed.sql` and migrations 006/007/008.
  - Set a local pairing code with `node scripts/set-pairing-code.mjs --local`. Choose any throwaway code, keep it in an ignored file outside the repo, and pass it as argv only.
  - smoke-chat needs `node scripts/mock-anthropic.mjs` and `ANTHROPIC_BASE_URL=http://127.0.0.1:8791` in `worker/.dev.vars`, which is git-ignored. Never commit it.
- **Windows-only scripts.** The PowerShell kill scripts in `handoff-cloud/scratch/` are Windows-only. On Linux, stop servers by the PIDs you started.
- **Prove the rig before batch 8's final run.** Capture one area (`--area tally --out /tmp/cap-test`) and run one suite. If the rig cannot be made to work, stop and tell the owner plainly. Do not skip the screenshots silently.
- **Production backups need Cloudflare login, which this environment does not have.** Skip them. The desktop session took one before batch 7 (`house-hub-prod-2026-10-03-before-7.sql` on the PC), and another is taken at deploy.

## Step 1: finish batch 7's audit half
- **Evidence.** Everything is in `audits/evidence/p6/7/`:
  - the final-run summary: `tests/final-run-summary.txt`;
  - the repro before and after;
  - the six date-pinned reset copies: `tests/reset-copies/`;
  - suites, measurements, the Phase 4 tools: `p4tools/out` vs `before`;
  - pixel diffs: `capture/`;
  - the review digest: `review/workers-and-reviews.md`, which holds every worker report, both review rounds and the decisions;
  - the rescore: `rescore.md`, Kid Verse 5.6 → 6.1.
- **The final run was clean:**
  - Every repo suite passed: test-kidverse 69, test-rewards 88, test-kidstory 50, test-home 109, test-tv 100, test-kitchen 62.
  - smoke-api 422/0. It runs 432 when `D1_PERSIST` counts stored bytes.
  - smoke-chat 76; parse 33/0; bump-sw ok (`hub-v47`).
  - Captures: kidverse 240, shell 979, tv 34, with 0 failed.
- **Expected failures:**
  - The 5 ORIGINAL reset scripts are date-dependent; their `-7` copies are the measure.
  - `handoff/prayer/check.js` is 47/2 as since 0g. It is do-not-touch; editing it needs the owner's OK.
- **Pixel diffs:** kidverse 240/240 changed (expected); shell 47 of 979 vs batch 6; tv 8 of 34. Account for the shell and tv changes: the rewards card and Home Kids card in Me, and the TV no-week line. If any are noise, prove it as batch 5 did (`capture/verses-noise.md` in p6/5).
- **Contrast.** Account for every sub-AA sample per area from `measure/failing-pairs*`, as batch 6 did (`p6/6/measure/contrast-accounting.md`).
- **The 16 entries plus the 3 improvements** (IMP-KIDVERSE-F3 word highlight, I1 earlier-weeks shelf, I2 a parent's voice) are in `review/entries.md`. The 9 carry-overs are in `review/carry-overs.md`.
- **Carry-over status:**
  - Item 8 (dark story art) is out of scope and stays PARTIAL.
  - Item 9 is a device check.
- **Owner decision.** With no family week, prayer stars still count; verse and story stars do not.
- **Not done, for a later polish pass** (record them as found-not-fixed): the rescore's list in `rescore.md`, which includes:
  - the art letterboxed in a full-width card;
  - no dark art, and the art repeated as the story thumbnail;
  - day-dot marks 10-13 px;
  - one 656 px column on wide screens;
  - loading tells;
  - wraps at 390-430;
  - kid titles 24-26 px;
  - the no-week speaker icon.
  
  Also: a kid no longer sees ★N change after Done (it is below the story now; accepted as the cost of UX-KIDVERSE-2).
- **Device checks to list:**
  - iOS speech boundary events;
  - Safari MediaRecorder recording and playback, and autoplay;
  - the iPad long-press (VIS-KIDVERSE-10);
  - spoken toasts;
  - a real midnight across two kid devices.
- **Commit:** `audit(phase 6): batch 7, Kid Verse (7a77c6b): …`.

## Step 2: batch 8 (the Larder)
1. **Merge `batch8-wip` into `audit-wip`.** Hand-merge the files both batches touched: `CLAUDE.md`, `worker/README.md`, `scripts/smoke-api.sh`, `icons/LICENSE-lucide.txt` and `icons/sprite.svg`.
   - Batch 8 added no sprite symbols.
   - LICENSE: keep both batches' lines and drop the stale "Larder's icons … inlined" sentence.
   - Add to CLAUDE.md's Larder bullet: a remote change replaces a card only when the new card is the same height; otherwise it waits behind the pill "N new or changed in the fridge · Show".
   - Then bump `sw.js` (`node scripts/bump-sw.mjs`).
2. **One short independent Opus confirmation** of the last three fixes. The probes are in `handoff-cloud/scratch/b8-report.md` and the reviewer's scripts are described there.
   - **P6:** focus returns to the card's name button after a keyboard Save.
   - **R1:** the Larder's toast is back at the shared position and never covers a finishing card's Undo or "Select and copy".
   - **R2:** a remote two-line rename or a remote "Some left" never moves another card, in one column (390) or two (1440).
3. **Final run, then status, 05, 06 and the two commits.** The rescore is already done: `handoff-cloud/scratch/rescore-8/rescore.md`.
   - The three Phase 3 threshold scripts crash on an id removed long ago. Their `-8` copies (`audits/tools/phase6/8/thresholds-8.mjs` etc.) are the measure; their before-runs went 4/10 → 10/10, 4/10 → 10/10 and 5/11 → 11/11.

## Step 3: batches 9 + 10 together (Dollywood build guide + park map)
- **One template builds both apps.** `scripts/template.html` in the Dollywood repo is about 1,900 lines; `build_html.py` makes the reference, hub and live flavours.
- **Never edit `apps/dollywood*.html` here.** Change the template, rebuild, run `verify.py`, export with `export_hub.py`, then commit in both repos.
- **The entries.** `handoff-cloud/scratch/b910.md` has 90 entries plus IMP-DOLLYWOOD-I1; `b910-scripts.txt` lists 86 scripts.
- **Before-run outputs.** The Windows before-run outputs are in `handoff-cloud/before-910-windows/`, as text only. Re-run the before captures in the cloud.
- **Workers.** About 4, by template region: the shared map and look, guide-only, live-only, and the Worker's waits/rally routes.
- **Status entries** keep their home batch, 9 or 10.

## Step 4: batch 11 (Tally)
Batch 11 also owns the pre-existing `screens-apps` failure, the Tally page background.

## When everything is done
Tell the owner in plain words what was done and what is left for the deploy, and list the device checks. Stop there; the deploy happens from their PC.
