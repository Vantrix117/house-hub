#!/bin/bash
# assemble-7.sh: file batch 7's final-run evidence under audits/evidence/p6/7/
SP="/c/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad"
cd "/c/Users/ex_bo/OneDrive/Claude Related/App Hub"
export NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules"
O="$SP/final-7"; E=audits/evidence/p6/7
P4=$(mktemp -d); [ -d "$E/p4tools" ] && cp -r "$E/p4tools" "$P4/"
rm -rf "$E"; mkdir -p "$E/capture" "$E/checks/v1a" "$E/review" "$E/tests" "$E/measure" "$E/workers"
[ -d "$P4/p4tools" ] && cp -r "$P4/p4tools" "$E/"; rm -rf "$P4"
for d in pre ev checks-ev suites-ev; do [ -d "$O/$d/audits/evidence/p6/7" ] && cp -r "$O/$d/audits/evidence/p6/7/." "$E/workers/"; done
for p in p2 p3 p4; do [ -d "$O/ev/audits/evidence/$p" ] && cp -r "$O/ev/audits/evidence/$p" "$E/"; done
for b in 3 4 5 6; do [ -d "$O/ev/audits/evidence/p6/$b" ] && mkdir -p "$E/p6-$b" && cp -r "$O/ev/audits/evidence/p6/$b/." "$E/p6-$b/"; done
cp "$O/ev/_changed.txt" "$E/tests/evidence-changed.txt"
cp "$O"/checks/*.txt "$E/checks/"; cp "$O"/v1a/*.png "$E/checks/v1a/" 2>/dev/null
cp -r "$O/repro" "$E/tests/repro-after"; cp -r "$SP/7-before" "$E/tests/repro-before"
mkdir -p "$E/tests/reset-copies"; cp -r "$SP/b7a/reset-before" "$SP/b7a/reset-after" "$E/tests/reset-copies/" 2>/dev/null
cp -r "$O/suites" "$E/tests/suites"; rm -f "$E"/tests/suites/_wrangler-*.log
cp "$O"/smoke-api.txt "$O"/smoke-chat.txt "$O"/bump-sw.txt "$O"/parse.txt "$E/tests/"; cp "$SP/final-7.log" "$E/tests/final-run-summary.txt"
cp "$O"/measure/*.txt "$E/measure/"; for f in failing-pairs coverage nontext targets type motion radii glass; do cp -r "$O/measure/agg/$f.json" "$O/measure/agg/$f" "$E/measure/" 2>/dev/null; done
node audits/tools/lib/pxdiff.mjs "$SP/cap7-before" audits/screens-after/7 --area kidverse > "$E/capture/pxdiff-kidverse-vs-prebatch.txt" 2>&1
node audits/tools/lib/pxdiff.mjs audits/screens audits/screens-after/7 --area kidverse > "$E/capture/pxdiff-kidverse-vs-phase1.txt" 2>&1
node audits/tools/lib/pxdiff.mjs audits/screens-after/6 audits/screens-after/7 --area shell > "$E/capture/pxdiff-shell-vs-6.txt" 2>&1
node audits/tools/lib/pxdiff.mjs audits/screens-after/6 audits/screens-after/7 --area tv > "$E/capture/pxdiff-tv-vs-6.txt" 2>&1
cp "$SP/b7-report.md" "$E/review/workers-and-reviews.md"; cp "$SP/b7-carry.md" "$E/review/carry-overs.md"; cp "$SP/b7-hooks.md" "$E/review/worker-hooks.md"; cp "$SP/batch7-brief.md" "$E/review/worker-brief.md"; cp "$SP/batch7-review-brief.md" "$E/review/review-brief.md"; cp "$SP/b7.md" "$E/review/entries.md"
cp "$SP/rescore-7/rescore.md" "$E/rescore.md"
mkdir -p "$E/review/rev7"; find "$SP/rev7" -maxdepth 1 -type f \( -name '*.mjs' -o -name '*.cjs' -o -name '*.sh' \) -size -400k -exec cp {} "$E/review/rev7/" \;
node "$SP/redact.cjs" $(grep -rlE '"(device_token|profile_token|token|session_token|undo|code|setup_code)"' "$E" --include=*.txt --include=*.json) 2>&1 | tail -1
C="$(head -1 "$SP/localcode")"; echo "pairing code hits: $(grep -rlF -- "$C" "$E" | wc -l)"
grep -rnE '"(device_token|profile_token|setup_code)": *"[A-Za-z0-9_-]{8,}' "$E" | head -3
echo "files $(find "$E" -type f | wc -l)  size $(du -sh "$E" | cut -f1)"
for f in "$E"/capture/*.txt; do echo "$(basename $f): $(tail -1 $f)"; done
