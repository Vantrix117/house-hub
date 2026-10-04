#!/bin/bash
# before-910.sh: batches 9+10's scripts on the pre-batch code (git archive of ac5f7e4; the Dollywood files are unchanged by 7 and 8)
SP="/c/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad"
REPO="/c/Users/ex_bo/OneDrive/Claude Related/App Hub"
export NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules"
rm -rf "$SP/base910"; mkdir -p "$SP/base910"
( cd "$REPO" && git archive ac5f7e4 ) | tar -x -C "$SP/base910"
mkdir -p "$SP/base910/audits/evidence/p4/measure"; cp -r "$REPO/audits/evidence/p4/measure/raw" "$SP/base910/audits/evidence/p4/measure/raw"
cd "$SP/base910"
bash "$SP/run-lanes.sh" "$SP/b910-scripts.txt" "$SP/910-before" 2
for a in dollywood dollywood-live; do
  timeout 5400 node audits/tools/capture.mjs --area $a --out "$SP/cap910-before" --no-sheets > "$SP/cap910-before-$a.log" 2>&1
  echo "capture $a exit $?"
done
echo "capture exit done"
