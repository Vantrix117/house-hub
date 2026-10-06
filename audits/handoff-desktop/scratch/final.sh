#!/bin/bash
# final.sh <N> <ROOT> <BASE_COMMIT> <scripts-list> <areas (comma)> <tell-area|-> [skip-before]
# Linux cloud final run for batch N: before-run on BASE (git archive), then the final run on ROOT. Results in $SP/final-N/.
SP=/tmp/claude-0/-home-user-house-hub/cb8149f8-d9e8-5d60-902a-c782be42c8e1/scratchpad
N=$1; ROOT=$2; BASE=$3; LIST=$4; AREAS=$(echo "$5" | tr , ' '); TELLA=$6; SKIPB=$7
export HUB_AUDIT_HOME=$HOME/house-hub-audit NODE_PATH=$HOME/house-hub-audit/node_modules HUB_CHROME=/opt/pw-browsers/chromium
O="$SP/final-$N"; B="$SP/base$N"; BO="$SP/$N-before"
CODE=$(head -1 "$SP/localcode")
EV="audits/evidence/p2 audits/evidence/p3 audits/evidence/p4 audits/evidence/p6"
lock() { until mkdir "$SP/suite.lock" 2>/dev/null; do sleep 10; done; }
unlock() { rmdir "$SP/suite.lock" 2>/dev/null; }
save_changed() {
  mkdir -p "$1"
  { git status --porcelain $EV | awk '$1!="??"{print $2}'; git ls-files --others --exclude-standard $EV; } > "$1/_changed.txt"
  while read f; do [ -f "$f" ] && mkdir -p "$1/$(dirname "$f")" && cp "$f" "$1/$f"; done < "$1/_changed.txt"
  git checkout -- $EV; git ls-files --others --exclude-standard $EV | while read f; do rm -f "$f"; done
}
lanes() {  # lanes <root> <list> <out>
  ( cd "$1" && mkdir -p "$3" && : > "$3/_exit.txt"
    while read s; do [ -z "$s" ] && continue; n=$(echo "$s" | sed 's#audits/tools/##;s#/#__#g;s#\.mjs$##'); start=$(date +%s)
      timeout 900 node "$s" > "$3/$n.txt" 2>&1; echo "$? $(( $(date +%s)-start ))s $s" >> "$3/_exit.txt"; done < "$2" )
}
copies() { for d in $(seq $N -1 3); do for s in audits/tools/phase6/$d/*.mjs; do [ -f "$s" ] || continue; b=$(basename "$s" .mjs)
  case "$b" in _*|prayer-claims-3|voice-7) continue;; esac; echo "$s"; done; done; }
w8788() {  # a fresh local Worker on 8788 from <root>, on a copy of the template D1
  [ -n "$W8" ] && kill -- -$W8 2>/dev/null; sleep 2
  rm -rf "$SP/d1-8788" && cp -r "$SP/d1-tmpl" "$SP/d1-8788"
  (cd "$1/worker" && exec setsid npx wrangler dev --port 8788 --persist-to "$SP/d1-8788" > "$SP/wrangler-8788.log" 2>&1) & W8=$!
  for i in $(seq 1 60); do curl -s -m 2 http://127.0.0.1:8788/api/health >/dev/null && return 0; sleep 2; done; echo "8788 FAIL"; }

mkdir -p "$O"
# ---------- 0 before: the pre-batch code ----------
if [ -z "$SKIPB" ]; then
  rm -rf "$B" "$BO"; mkdir -p "$B" "$BO"; git -C "$ROOT" archive "$BASE" | tar -x -C "$B"
  cp "$SP/dev.vars" "$B/worker/.dev.vars"
  mkdir -p "$B/audits/tools/phase6/$N"; cp -r "$ROOT/audits/tools/phase6/$N/." "$B/audits/tools/phase6/$N/"   # the batch's copies, run on the old code
  cp "$ROOT/audits/tools/lib/local.mjs" "$B/audits/tools/lib/local.mjs"
  { cat "$ROOT/$LIST"; ls "$B/audits/tools/phase6/$N"/*.mjs | sed "s#$B/##" | grep -v '/_'; } > "$BO/_list.txt"
  lanes "$B" "$BO/_list.txt" "$BO/repro"
  lock; for a in $AREAS; do (cd "$B" && timeout 5400 node audits/tools/capture.mjs --area $a --out "$SP/cap$N-before" --no-sheets > "$BO/capture-$a.txt" 2>&1); done; unlock
  echo "BEFORE done $(date)" >> "$O/_progress.txt"
fi

while [ ! -e "$SP/go-$N" ]; do sleep 30; done   # the after-run waits for the go-ahead (fixes confirmed)
cd "$ROOT"
cp "$SP/dev.vars" worker/.dev.vars
rm -rf "$O/ev" "$O/checks" "$O/v1a" "$O/measure" "$O/checks-ev" "$O/suites-ev" "$O/pre" "$O/repro" "$O/suites"
mkdir -p "$O/ev" "$O/checks" "$O/v1a" "$O/measure" "$O/checks-ev" "$O/suites-ev" "$O/pre"
save_changed "$O/pre"
# ---------- 1 measure the batch's areas ----------
for a in $AREAS; do for r in themes devices states; do timeout 5400 node audits/tools/phase4/measure.mjs --run $r --area $a --force --parallel 4 > "$O/measure/run-$a-$r.txt" 2>&1; echo "$? $a-$r" >> "$O/measure/_exit.txt"; done; done
node audits/tools/phase4/aggregate.mjs --out "$O/measure/agg" > "$O/measure/aggregate.txt" 2>&1; echo "$? aggregate" >> "$O/measure/_exit.txt"
git checkout -- audits/evidence/p4/measure 2>/dev/null
echo "MEASURE done $(date)" >> "$O/_progress.txt"
# ---------- 2 repro + copies ----------
{ cat "$LIST"; copies; } > "$O/_list.txt"
lanes "$ROOT" "$O/_list.txt" "$O/repro"
save_changed "$O/ev"
echo "LANES done $(date)" >> "$O/_progress.txt"
# ---------- 3 checks ----------
c() { n=$1; shift; timeout 1200 node "$@" > "$O/checks/$n.txt" 2>&1; echo "$? $n" >> "$O/checks/_exit.txt"; }
c verify-1a-chromium audits/tools/phase6/1/verify-1a.mjs "$O/v1a" chromium
c contrast audits/tools/phase4/tokens/contrast.mjs
c check-ids audits/tools/phase6/0g/check-ids.js
c prayer-check handoff/prayer/check.js apps/prayer.html
for s in 0c/forget-device 0f/kid-two-devices 0g/prayer-merge-check 0h/larder-check 0h/guide-import-check 0i/chat-check; do c "$(basename $s)" "audits/tools/phase6/$s.mjs"; done
save_changed "$O/checks-ev"
echo "CHECKS done $(date)" >> "$O/_progress.txt"
# ---------- 4 suites, smoke, sw ----------
curl -s -m 2 -o /dev/null http://127.0.0.1:8791/ || { (setsid node scripts/mock-anthropic.mjs > "$SP/mock.log" 2>&1 &); sleep 2; }
"$SP/repo-tests.sh" "$ROOT" "$O/suites" test-design test-hub test-kitchen test-push test-push2 test-park test-f260 test-prayer test-prayer-faces test-kidverse test-kidstory test-rewards test-verses test-leftovers test-timer test-home test-tv test-prefs test-guests test-dollywood-sync test-dollywood test-photos test-apps test-art screens-shell screens-apps > /dev/null 2>&1
lock
w8788 "$ROOT"; D1_PERSIST="$SP/d1-8788" timeout 1500 bash scripts/smoke-api.sh http://127.0.0.1:8788 "$CODE" > "$O/smoke-api.txt" 2>&1
w8788 "$ROOT"; timeout 1200 bash scripts/smoke-chat.sh http://127.0.0.1:8788 "$CODE" > "$O/smoke-chat.txt" 2>&1
w8788 "$ROOT"; HUB_API=http://127.0.0.1:8788 timeout 1500 node audits/tools/phase6/3/prayer-claims-3.mjs "$CODE" > "$O/repro/p6-3__prayer-claims-3.txt" 2>&1; echo "$? 0s p6-3__prayer-claims-3" >> "$O/repro/_exit.txt"
w8788 "$ROOT"; HUB_API=http://127.0.0.1:8788 timeout 1500 node audits/tools/phase6/7/voice-7.mjs "$CODE" > "$O/repro/p6-7__voice-7.txt" 2>&1; echo "$? 0s p6-7__voice-7" >> "$O/repro/_exit.txt"
kill -- -$W8 2>/dev/null; unlock
node "$ROOT/audits/handoff-cloud/scratch/redact.cjs" "$O/smoke-api.txt" "$O/smoke-chat.txt" > "$O/redact.txt" 2>&1
node scripts/bump-sw.mjs --check > "$O/bump-sw.txt" 2>&1
node "$SP/parse-check.cjs" "$ROOT" > "$O/parse.txt" 2>&1
git checkout -- docs/screens; save_changed "$O/suites-ev"
echo "SUITES done $(date)" >> "$O/_progress.txt"
# ---------- 5 captures ----------
lock; for a in $AREAS; do timeout 5400 node audits/tools/capture.mjs --area $a --out audits/screens-after/$N --no-sheets > "$O/capture-$a.txt" 2>&1; done; unlock
for a in $AREAS; do node audits/tools/lib/pxdiff.mjs "$SP/cap$N-before" audits/screens-after/$N --area $a > "$O/pxdiff-$a-vs-prebatch.txt" 2>&1; done
# ---------- 6 phase 4 tools after / before ----------
TOOLS="TOK/literals TYPE/code-scan ICON/static MOTION/press MOTION/cls SHAPE/analyze SHAPE/verify"
P="$O/p4tools"; mkdir -p "$P/out" "$P/before"; : > "$P/out/_exit.txt"; : > "$P/before/_exit.txt"
for t in $TOOLS; do n=$(echo $t | tr / _); timeout 2400 node audits/tools/phase4/$t.mjs > "$P/out/$n.txt" 2>&1; echo "$? $t" >> "$P/out/_exit.txt"; done
[ "$TELLA" != "-" ] && { timeout 2400 node audits/tools/phase4/TELL/tells-webkit.mjs $TELLA > "$P/out/TELL_tells-webkit.txt" 2>&1; echo "$? TELL $TELLA" >> "$P/out/_exit.txt"; }
{ git status --porcelain audits/evidence/p4 | awk '$1!="??"{print $2}'; git ls-files --others --exclude-standard audits/evidence/p4; } > "$P/changed.txt"
while read f; do [ -f "$f" ] && mkdir -p "$P/p4/$(dirname "${f#audits/evidence/p4/}")" && cp "$f" "$P/p4/${f#audits/evidence/p4/}"; done < "$P/changed.txt"
git checkout -- audits/evidence/p4 docs/screens; git ls-files --others --exclude-standard audits/evidence/p4 | while read f; do rm -f "$f"; done
( cd "$B" && for t in $TOOLS; do n=$(echo $t | tr / _); timeout 2400 node audits/tools/phase4/$t.mjs > "$P/before/$n.txt" 2>&1; echo "$? $t" >> "$P/before/_exit.txt"; done
  [ "$TELLA" != "-" ] && { timeout 2400 node audits/tools/phase4/TELL/tells-webkit.mjs $TELLA > "$P/before/TELL_tells-webkit.txt" 2>&1; echo "$? TELL $TELLA" >> "$P/before/_exit.txt"; } )
echo "P4 done $(date)" >> "$O/_progress.txt"

# ---------- summary ----------
{
echo "FINAL RUN batch $N  root $ROOT  base $BASE  $(date)  (cloud rig: Chromium for every engine)"
echo BEFORE-LANES; awk '$1!=0{print $1,$3}' "$BO/repro/_exit.txt"; echo "before total $(wc -l < "$BO/repro/_exit.txt"), nonzero $(awk '$1!=0' "$BO/repro/_exit.txt" | wc -l)"
echo MEASURE; cat "$O/measure/_exit.txt"
echo LANES; awk '$1!=0{print $1,$3}' "$O/repro/_exit.txt"; echo "lanes total $(wc -l < "$O/repro/_exit.txt"), nonzero $(awk '$1!=0' "$O/repro/_exit.txt" | wc -l)"
echo "EVIDENCE FILES $(wc -l < "$O/ev/_changed.txt")"
echo CHECKS; cat "$O/checks/_exit.txt"; tail -1 "$O/checks/prayer-check.txt"; tail -1 "$O/checks/check-ids.txt"; tail -2 "$O/checks/contrast.txt"
echo SUITES; cat "$O/suites/_summary.txt"; echo "API $(tail -1 "$O/smoke-api.txt")"; grep '\^\^\^' "$O/smoke-api.txt"
echo "CHAT $(tail -1 "$O/smoke-chat.txt")"; grep MISS "$O/smoke-chat.txt"; echo "SW $(tail -1 "$O/bump-sw.txt")"; cat "$O/parse.txt"
for a in $AREAS; do echo "CAPTURE-before $a $(tail -1 "$BO/capture-$a.txt" 2>/dev/null)"; echo "CAPTURE $a $(tail -1 "$O/capture-$a.txt")"; echo "PXDIFF $a $(tail -1 "$O/pxdiff-$a-vs-prebatch.txt")"; done
echo P4-AFTER; cat "$P/out/_exit.txt"; echo P4-BEFORE; cat "$P/before/_exit.txt"
} > "$O/summary.txt" 2>&1
echo ALLDONE >> "$O/_progress.txt"
