#!/bin/bash
# reviewer-7 runner: each repo test on a fresh D1 copy and its own wrangler on 8903 (only this script's processes are stopped, by PID tree)
SP="/c/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad"
ROOT="/c/Users/ex_bo/OneDrive/Claude Related/App Hub"
OUT="${OUTDIR:-$SP/rev7/suite}"; mkdir -p "$OUT"
CODE=$(head -1 "$SP/localcode")
RV=/c/Users/ex_bo/AppData/Local/Temp/rv7
export NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules"
export HUB_API=http://127.0.0.1:8903
WPID=
startw() {
  rm -rf "$RV/d1-run" && cp -r "$SP/d1-tmpl" "$RV/d1-run"
  (cd "$ROOT/worker" && npx wrangler d1 execute house-hub --local --persist-to 'C:\Users\ex_bo\AppData\Local\Temp\rv7\d1-run' --file migrations/008-timer-live.sql >/dev/null 2>&1)
  (cd "$ROOT/worker" && exec npx wrangler dev --port 8903 --inspector-port 9903 --persist-to 'C:\Users\ex_bo\AppData\Local\Temp\rv7\d1-run' > "$OUT/_wrangler-$1.log" 2>&1) &
  WPID=$!
  for i in $(seq 1 60); do curl -s -m 2 http://127.0.0.1:8903/api/health >/dev/null && break; sleep 2; done
}
stopw() { local wp; wp=$(cat /proc/$WPID/winpid 2>/dev/null); [ -n "$wp" ] && taskkill //PID $wp //T //F >/dev/null 2>&1; kill $WPID 2>/dev/null; sleep 2; }
for t in "$@"; do
  startw "$t"
  start=$(date +%s)
  case "$t" in
    smoke-api) (cd "$ROOT" && timeout 1500 bash scripts/smoke-api.sh http://127.0.0.1:8903 "$CODE" > "$OUT/$t.txt" 2>&1); e=$? ;;
    smoke-chat) (cd "$ROOT" && timeout 900 bash scripts/smoke-chat.sh http://127.0.0.1:8903 "$CODE" > "$OUT/$t.txt" 2>&1); e=$? ;;
    *) (cd "$ROOT" && timeout 1500 node "scripts/$t.mjs" "$CODE" > "$OUT/$t.txt" 2>&1); e=$? ;;
  esac
  echo "$e $(( $(date +%s)-start ))s $t :: $(grep -E 'PASS [0-9]+|passed, [0-9]+ failed|[0-9]+ passed|checks' "$OUT/$t.txt" | tail -1)" >> "$OUT/_summary.txt"
  stopw
done
echo DONE >> "$OUT/_summary.txt"
