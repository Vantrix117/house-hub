#!/bin/bash
# repo-tests.sh <root> <out dir> <tests...>: each test on a fresh copy of the seeded local D1, its own wrangler dev on 8787
SP=/tmp/claude-0/-home-user-house-hub/cb8149f8-d9e8-5d60-902a-c782be42c8e1/scratchpad
ROOT=$1; OUT=$2; shift 2; mkdir -p "$OUT"
CODE=$(head -1 "$SP/localcode")
export HUB_AUDIT_HOME=$HOME/house-hub-audit NODE_PATH=$HOME/house-hub-audit/node_modules
LOCK="$SP/suite.lock"; while ! mkdir "$LOCK" 2>/dev/null; do sleep 10; done; trap 'rmdir "$LOCK"; [ -n "$WP" ] && kill -- -$WP 2>/dev/null' EXIT
for t in "$@"; do
  rm -rf "$SP/d1-run" && cp -r "$SP/d1-tmpl" "$SP/d1-run"
  (cd "$ROOT/worker" && exec setsid npx wrangler dev --port 8787 --persist-to "$SP/d1-run" > "$OUT/_wrangler-$t.log" 2>&1) & WP=$!
  for i in $(seq 1 60); do curl -s -m 2 http://127.0.0.1:8787/api/health >/dev/null && break; sleep 2; done
  start=$(date +%s)
  if [[ $t == *.sh ]]; then (cd "$ROOT" && timeout 1500 bash "scripts/$t" http://127.0.0.1:8787 "$CODE" > "$OUT/$t.txt" 2>&1); e=$?
  else (cd "$ROOT" && timeout 1500 node "scripts/$t.mjs" "$CODE" > "$OUT/$t.txt" 2>&1); e=$?; fi
  echo "$e $(( $(date +%s)-start ))s $t :: $(grep -E 'PASS [0-9]+|passed, [0-9]+ failed|[0-9]+ passed|[0-9]+ checks' "$OUT/$t.txt" | tail -1)" >> "$OUT/_summary.txt"
  kill -- -$WP 2>/dev/null; wait $WP 2>/dev/null; sleep 2; WP=
done
echo DONE
