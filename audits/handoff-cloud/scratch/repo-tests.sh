#!/bin/bash
# repo-tests.sh <variant: base|after> <out dir> <tests...>: each test on a fresh copy of the seeded local D1, its own wrangler dev
SP="/c/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad"
V=$1; OUT=$2; shift 2; mkdir -p "$OUT"
if [ "$V" = base ]; then ROOT="$SP/base"; else ROOT="/c/Users/ex_bo/OneDrive/Claude Related/App Hub"; fi
CODE=$(head -1 "$SP/localcode")
killw() { powershell -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$SP/kill8787.ps1")" >/dev/null 2>&1; }   # only the harness's own Worker on 8787 (never other agents')
LOCK="$SP/suite.lock"; while [ -e "$LOCK" ]; do sleep 15; done; echo "repo-tests-harness" > "$LOCK"; trap 'grep -q "repo-tests-harness" "$LOCK" 2>/dev/null && rm -f "$LOCK"' EXIT
for t in "$@"; do
  killw; sleep 2
  rm -rf "$SP/d1-run" && cp -r "$SP/d1-tmpl" "$SP/d1-run"   # since batch 0e the pre-batch code (0d) needs migration 006 too
  (cd "$ROOT/worker" && npx wrangler dev --port 8787 --persist-to "$SP/d1-run" > "$OUT/_wrangler-$t.log" 2>&1 &)
  for i in $(seq 1 60); do curl -s -m 2 http://127.0.0.1:8787/api/health >/dev/null && break; sleep 2; done
  start=$(date +%s)
  (cd "$ROOT" && NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules" timeout 900 node "scripts/$t.mjs" "$CODE" > "$OUT/$t.txt" 2>&1); e=$?
  echo "$e $(( $(date +%s)-start ))s $t :: $(grep -E 'PASS [0-9]+|passed, [0-9]+ failed|[0-9]+ passed' "$OUT/$t.txt" | tail -1)" >> "$OUT/_summary.txt"
done
killw; echo DONE
