#!/bin/bash
SP=/tmp/claude-0/-home-user-house-hub/cb8149f8-d9e8-5d60-902a-c782be42c8e1/scratchpad
export HUB_AUDIT_HOME=$HOME/house-hub-audit NODE_PATH=$HOME/house-hub-audit/node_modules HUB_CHROME=/opt/pw-browsers/chromium
until grep -q "BEFORE done" $SP/final-8/_progress.txt 2>/dev/null; do sleep 30; done
B=$SP/base8; O=$SP/910-before; rm -rf $O; mkdir -p $O/repro; : > $O/repro/_exit.txt
cd $B
while read s; do [ -z "$s" ] && continue; n=$(echo "$s" | sed 's#audits/tools/##;s#/#__#g;s#\.mjs$##'); st=$(date +%s)
  timeout 900 node "$s" > "$O/repro/$n.txt" 2>&1; echo "$? $(( $(date +%s)-st ))s $s" >> "$O/repro/_exit.txt"; done < /home/user/house-hub/audits/handoff-cloud/scratch/b910-scripts.txt
until mkdir $SP/suite.lock 2>/dev/null; do sleep 10; done
for a in dollywood dollywood-live; do timeout 5400 node audits/tools/capture.mjs --area $a --out $SP/cap910-before --no-sheets > $O/capture-$a.txt 2>&1; echo "capture $a exit $?" >> $O/_done.txt; done
rmdir $SP/suite.lock; echo "capture exit done" >> $O/_done.txt
