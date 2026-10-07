# Batches 9 + 10 on the Windows PC — read this BEFORE batch910-brief.md (it overrides the brief's paths)

The cloud session ran out of allowance; the work is back on the owner's Windows PC. The brief (`batch910-brief.md`) still holds every decision and rule; only its paths and environment change:

| Brief says | On this PC |
|---|---|
| `/home/user/house-hub` (hub repo) | `C:/Users/ex_bo/hub-audit` (branch `audit-wip`, a git worktree). **Never** touch `C:/Users/ex_bo/OneDrive/Claude Related/App Hub` (that checkout is `main`, the live site) or `C:/Users/ex_bo/hub-f8` / `C:/Users/ex_bo/hub-b8`. |
| `/home/user/dollywood-build-project` | `C:/Users/ex_bo/OneDrive/Claude Related/dollywood-build-project` (branch `master`; the cloud's WIP patch is already applied in the working tree) |
| SCRATCH | `C:/Users/ex_bo/b910` (this folder). `b8-landed` exists: batch 8 is merged, every hub file may be edited. |
| `python3` | `py` (Python 3.13; `python` is the Store stub) |
| Env | Git Bash: `export NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules"` (playwright-core + **WebKit** are installed there; WebKit runs here, so use it where a script says WebKit). No `HUB_CHROME` needed (Chrome is installed). |
| local pairing code | file `C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/localcode` (first line). Pass it only as an argument via `$(head -1 <file>)`; never print it, never write it anywhere. |

## The build loop on this PC
```
cd "C:/Users/ex_bo/OneDrive/Claude Related/dollywood-build-project/scripts"
until mkdir C:/Users/ex_bo/b910/b910-build.lock 2>/dev/null; do sleep 5; done
HUB_REPO=C:/Users/ex_bo/hub-audit py build_html.py && py verify.py && py export_hub.py C:/Users/ex_bo/hub-audit
rmdir C:/Users/ex_bo/b910/b910-build.lock
```
**Always pass `HUB_REPO=C:/Users/ex_bo/hub-audit` and the export target `C:/Users/ex_bo/hub-audit`.** The defaults point at the `main` checkout ("App Hub"), which must never change. If you see `apps/dollywood*` modified in `C:/Users/ex_bo/OneDrive/Claude Related/App Hub`, stop and say so.

## Repo suites (scripts/test-*.mjs) need a local Worker on 8787 and the site port 8765, shared with another long run on this PC
Use only the harness, which waits for the shared lock and starts a fresh local Worker per suite:
```
bash /c/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/repo-tests-r.sh /c/Users/ex_bo/hub-audit <out dir under C:/Users/ex_bo/b910/runs/...> test-dollywood test-dollywood-sync
```
It prints a summary into `<out>/_summary.txt`. It may wait a long time for the lock: that is the other run; be patient. For `smoke-api.sh`, `test-park`, `test-push2` (need a Worker): use your own Worker (section below). Phase 6 claims scripts (`audits/tools/phase6/9|10/*.mjs`) and `verify.py` start their own servers on free ports, so they need no lock.
- Never kill processes by name (other agents and a long run share this PC). Never run `audits/tools/capture.mjs` without `--out` (and never `--help`).
- After any repo suite: `git -C C:/Users/ex_bo/hub-audit checkout -- docs/screens` (suites rewrite those PNGs). If a script rewrote anything under `audits/evidence/p2|p3|p4`, copy what you need into `C:/Users/ex_bo/b910/runs/` and `git checkout --` it back.
- Bash quirks here: never put backticks or apostrophes inside a single-quoted `node -e`; use the Write/Edit tools for file edits. Files may have CRLF line ends: Edit handles them.

## Coordination
Append to `C:/Users/ex_bo/b910/b910-hooks.md` (never rewrite others' lines). No commits, no pushes, no deploy, in either repo.

## Your own local Worker (for HUB_API-style tests: smoke-api, test-park, test-push2, test-home with HUB_API)
Ports: B 8796, C 8797, D 8798 (inspector port = port + 1000). Recipe (Git Bash), with a fresh D1 copy per run:
```
T="/c/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/d1-tmpl"
rm -rf C:/Users/ex_bo/b910/w<you>/d1 && mkdir -p C:/Users/ex_bo/b910/w<you> && cp -r "$T" C:/Users/ex_bo/b910/w<you>/d1
(cd C:/Users/ex_bo/hub-audit/worker && npx wrangler dev --port <port> --inspector-port <port+1000> --persist-to C:/Users/ex_bo/b910/w<you>/d1 > C:/Users/ex_bo/b910/w<you>/wrangler.log 2>&1 &)
for i in $(seq 1 60); do curl -s -m 2 http://127.0.0.1:<port>/api/health >/dev/null && break; sleep 2; done
```
Stop ONLY your own port: `powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort <port> -EA SilentlyContinue | % { Stop-Process -Id \$_.OwningProcess -Force }"`.
Keep the persist path short (long paths make local D1 fail with "internal error"). smoke-api: `bash scripts/smoke-api.sh http://127.0.0.1:<port> "$(head -1 <localcode file>)"`; its rally section allows one rally per adult per minute: wait 60 s between runs. Tests that also serve the site on 8765 still need the lock harness.

## Before-run outputs (pre-batch code) on this PC
- Scripts: `C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/910-before/` (also in the repo: `audits/handoff-cloud/before-910-windows/`).
- Captures: same scratchpad, `cap910-before/` (WebKit). The pre-batch code archive: `base910/`. There is no "BEFORE done" wait on this PC.
- Script list: `C:/Users/ex_bo/hub-audit/audits/handoff-cloud/scratch/b910-scripts.txt`.
