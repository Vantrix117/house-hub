#!/bin/bash
# dev3.sh <port> <persist-dir-name> <root>: a separate local Worker from any checkout, on a fresh copy of d1-tmpl
SP="/c/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad"
PORT=$1; DIR=$2; ROOT=$3
[ "$PORT" = 8788 ] && powershell -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$SP/kill8788.ps1")" >/dev/null 2>&1 && sleep 2
rm -rf "$SP/$DIR" 2>/dev/null; cp -r "$SP/d1-tmpl" "$SP/$DIR"
(cd "$ROOT/worker" && npx wrangler dev --port $PORT --inspector-port $((PORT+1000)) --persist-to "$SP/$DIR" > "$SP/wrangler-$PORT.log" 2>&1 &)
for i in $(seq 1 60); do curl -s -m 2 http://127.0.0.1:$PORT/api/health >/dev/null && echo UP && exit 0; sleep 2; done; echo FAIL; tail -20 "$SP/wrangler-$PORT.log"
