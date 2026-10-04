#!/bin/bash
# p4tools-7.sh: the Phase 4 measuring tools on batch 7's final code, filed under audits/evidence/p6/7/p4tools/ (before = 5-before / base7 runs)
SP="/c/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad"
cd "/c/Users/ex_bo/OneDrive/Claude Related/App Hub"
export NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules"
E=audits/evidence/p6/7/p4tools; mkdir -p "$E/out" "$E/before"
TOOLS="TOK/literals TYPE/code-scan ICON/static MOTION/press MOTION/cls SHAPE/analyze SHAPE/verify"
for t in $TOOLS; do n=$(echo $t | tr / _); timeout 2400 node audits/tools/phase4/$t.mjs > "$E/out/$n.txt" 2>&1; echo "$? $t" >> "$E/out/_exit.txt"; done
timeout 2400 node audits/tools/phase4/TELL/tells-webkit.mjs kidverse > "$E/out/TELL_tells-webkit.txt" 2>&1; echo "$? TELL/tells-webkit kidverse" >> "$E/out/_exit.txt"
# the evidence the tools wrote into p4 (committed baseline) → copy, then restore the baseline
{ git status --porcelain audits/evidence/p4 | awk '$1!="??"{print $2}'; git ls-files --others --exclude-standard audits/evidence/p4; } > "$E/changed.txt"
while read f; do [ -f "$f" ] && mkdir -p "$E/p4/$(dirname "${f#audits/evidence/p4/}")" && cp "$f" "$E/p4/${f#audits/evidence/p4/}"; done < "$E/changed.txt"
git checkout -- audits/evidence/p4; git ls-files --others --exclude-standard audits/evidence/p4 | while read f; do rm -f "$f"; done
# the same tools on the pre-batch archive, for the before column
cd "$SP/base7"; for t in $TOOLS; do n=$(echo $t | tr / _); timeout 2400 node audits/tools/phase4/$t.mjs > "/c/Users/ex_bo/OneDrive/Claude Related/App Hub/$E/before/$n.txt" 2>&1; echo "$? $t" >> "/c/Users/ex_bo/OneDrive/Claude Related/App Hub/$E/before/_exit.txt"; done
timeout 2400 node audits/tools/phase4/TELL/tells-webkit.mjs kidverse > "/c/Users/ex_bo/OneDrive/Claude Related/App Hub/$E/before/TELL_tells-webkit.txt" 2>&1; echo "$? TELL/tells-webkit kidverse" >> "/c/Users/ex_bo/OneDrive/Claude Related/App Hub/$E/before/_exit.txt"
cp audits/evidence/p4/TELL/tells-webkit.json "/c/Users/ex_bo/OneDrive/Claude Related/App Hub/$E/before/tells-webkit.json" 2>/dev/null
cd "/c/Users/ex_bo/OneDrive/Claude Related/App Hub"; git checkout -- docs/screens 2>/dev/null
echo AFTER; cat "$E/out/_exit.txt"; echo BEFORE; cat "$E/before/_exit.txt"; echo "changed p4 files $(wc -l < "$E/changed.txt")"
