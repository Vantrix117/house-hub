#!/bin/bash
# final-7.sh: batch 7's closing reruns on the final code. Results in $SP/final-7/.
#  1 the measurement rig for prayer (themes) on the final code → aggregate into $O/measure (the committed p4/measure untouched)
#  2 the batch's repro scripts (3 lanes) + the patched copies in audits/tools/phase6/3/, evidence copied out, baseline restored
#  3 the phase 6 checks (incl. handoff/prayer/check.js and 0g/check-ids.js), the token gates
#  4 repo suites, smoke-api, smoke-chat (mock), bump-sw, parse-check
SP="/c/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad"
cd "/c/Users/ex_bo/OneDrive/Claude Related/App Hub"
export NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules"
O="$SP/final-7"; rm -rf "$O"; mkdir -p "$O/ev" "$O/checks" "$O/v1a" "$O/measure" "$O/checks-ev" "$O/suites-ev" "$O/pre"
EV="audits/evidence/p2 audits/evidence/p3 audits/evidence/p4 audits/evidence/p6"
save_changed() {   # copy every changed or new (not ignored) evidence file to $1, then restore the committed baseline
  mkdir -p "$1"
  { git status --porcelain $EV | awk '$1!="??"{print $2}'; git ls-files --others --exclude-standard $EV; } > "$1/_changed.txt"
  while read f; do [ -f "$f" ] && mkdir -p "$1/$(dirname "$f")" && cp "$f" "$1/$f"; done < "$1/_changed.txt"
  git checkout -- $EV; git ls-files --others --exclude-standard $EV | while read f; do rm -f "$f"; done
}
save_changed "$O/pre"          # what the workers and reviewers left behind, kept, then a clean baseline

# 1 measurement: verses and shell (the Home card), all three sets, on the final code (raw/ is git-ignored; those areas are replaced)
RAWBAK="$LOCALAPPDATA/house-hub-audit/p4-measure-raw-before-7"; [ -d "$RAWBAK" ] || cp -r audits/evidence/p4/measure/raw "$RAWBAK"
for a in kidverse shell tv; do for r in themes devices states; do timeout 5400 node audits/tools/phase4/measure.mjs --run $r --area $a --force --parallel 6 > "$O/measure/run-$a-$r.txt" 2>&1; echo "$? $a-$r" >> "$O/measure/_exit.txt"; done; done
node audits/tools/phase4/aggregate.mjs --out "$O/measure/agg" > "$O/measure/aggregate.txt" 2>&1; echo "$? aggregate" >> "$O/measure/_exit.txt"
git checkout -- audits/evidence/p4/measure 2>/dev/null

# 2 repro scripts + the patched copies
bash "$SP/run-lanes.sh" "$SP/b7-scripts.txt" "$O/repro" 3 > /dev/null 2>&1
p() { n=$1; shift; timeout 1500 node "$@" > "$O/repro/$n.txt" 2>&1; echo "$? 0s $n" >> "$O/repro/_exit.txt"; }
for d in 7 6 5 4 3; do for s in audits/tools/phase6/$d/*.mjs; do [ "$(basename "$s")" = prayer-claims-3.mjs ] && continue; [ "$(basename "$s")" = voice-7.mjs ] && continue; case "$(basename "$s")" in _*) continue;; esac; [ -f "$s" ] && p "p6-${d}__$(basename "$s" .mjs)" "$s"; done; done
save_changed "$O/ev"

# 3 checks
c() { n=$1; shift; timeout 1200 node "$@" > "$O/checks/$n.txt" 2>&1; echo "$? $n" >> "$O/checks/_exit.txt"; }
c verify-1a-webkit audits/tools/phase6/1/verify-1a.mjs "$O/v1a" webkit
c verify-1a-chromium audits/tools/phase6/1/verify-1a.mjs "$O/v1a" chromium
c contrast audits/tools/phase4/tokens/contrast.mjs
c browser-check audits/tools/phase4/tokens/browser-check.mjs
c check-ids audits/tools/phase6/0g/check-ids.js
c prayer-check handoff/prayer/check.js apps/prayer.html
for s in 0c/forget-device 0f/kid-two-devices 0g/prayer-merge-check 0h/larder-check 0h/guide-import-check 0i/chat-check; do c "$(basename $s)" "audits/tools/phase6/$s.mjs"; done
save_changed "$O/checks-ev"

# 4 repo suites, smoke, service worker
bash "$SP/repo-tests.sh" after "$O/suites" test-design test-hub test-kitchen test-push test-push2 test-park test-f260 test-prayer test-prayer-faces test-kidverse test-kidstory test-rewards test-verses test-leftovers test-timer test-home test-tv test-prefs test-guests test-dollywood-sync test-dollywood test-photos test-apps screens-shell > /dev/null 2>&1
bash "$SP/dev3.sh" 8788 d1-api "$PWD" > /dev/null && timeout 1200 bash scripts/smoke-api.sh http://127.0.0.1:8788 "$(head -1 "$SP/localcode")" > "$O/smoke-api.txt" 2>&1
curl -s -m 2 -o /dev/null http://127.0.0.1:8791/ || { (node scripts/mock-anthropic.mjs > "$SP/mock.log" 2>&1 &); sleep 2; }   # reuse a running mock (another agent may be using it)
bash "$SP/dev3.sh" 8788 d1-ca "$PWD" > /dev/null && timeout 900 bash scripts/smoke-chat.sh http://127.0.0.1:8788 "$(head -1 "$SP/localcode")" > "$O/smoke-chat.txt" 2>&1
bash "$SP/dev3.sh" 8788 d1-cl "$PWD" > /dev/null && HUB_API=http://127.0.0.1:8788 timeout 1500 node audits/tools/phase6/3/prayer-claims-3.mjs "$(head -1 "$SP/localcode")" > "$O/repro/p6-3__prayer-claims-3.txt" 2>&1; echo "$? 0s p6-3__prayer-claims-3" >> "$O/repro/_exit.txt"
bash "$SP/dev3.sh" 8788 d1-v7 "$PWD" > /dev/null && HUB_API=http://127.0.0.1:8788 timeout 1500 node audits/tools/phase6/7/voice-7.mjs "$(head -1 "$SP/localcode")" > "$O/repro/p6-7__voice-7.txt" 2>&1; echo "$? 0s p6-7__voice-7" >> "$O/repro/_exit.txt"
powershell -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$SP/kill8788.ps1")" >/dev/null 2>&1
node "$SP/redact.cjs" "$O/smoke-api.txt" "$O/smoke-chat.txt" > "$O/redact.txt" 2>&1   # throwaway local test tokens and codes never go in the repo
node scripts/bump-sw.mjs --check > "$O/bump-sw.txt" 2>&1
node "$SP/parse-check.cjs" > "$O/parse.txt" 2>&1
git checkout -- docs/screens; save_changed "$O/suites-ev"

echo MEASURE; cat "$O/measure/_exit.txt"
echo LANES; sort -k3 "$O/repro/_exit.txt" | awk '$1!=0{print $1,$3}'; echo "lanes total $(wc -l < "$O/repro/_exit.txt"), nonzero $(awk '$1!=0' "$O/repro/_exit.txt" | wc -l)"
echo "EVIDENCE FILES $(wc -l < "$O/ev/_changed.txt")"
echo CHECKS; cat "$O/checks/_exit.txt"; tail -1 "$O/checks/prayer-check.txt"; tail -1 "$O/checks/check-ids.txt"
echo SUITES; cat "$O/suites/_summary.txt"; echo "API $(tail -1 "$O/smoke-api.txt")"; grep '\^\^\^' "$O/smoke-api.txt"
echo "CHAT $(tail -1 "$O/smoke-chat.txt")"; grep MISS "$O/smoke-chat.txt"; echo "SW $(tail -1 "$O/bump-sw.txt")"; cat "$O/parse.txt"
for a in kidverse shell tv; do timeout 5400 node audits/tools/capture.mjs --area $a --out audits/screens-after/7 --no-sheets > "$O/capture-$a.txt" 2>&1; echo "CAPTURE $a $(tail -1 "$O/capture-$a.txt")"; done
