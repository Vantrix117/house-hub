#!/bin/bash
# run-lanes.sh <list> <outdir> <lanes>: run each script (node) with a 10 min cap, N at a time; log exit codes
LIST=$1; OUT=$2; N=${3:-3}; mkdir -p "$OUT"; : > "$OUT/_exit.txt"
run() { s=$1; n=$(echo "$s" | sed 's#audits/tools/##;s#/#__#g;s#\.mjs$##'); start=$(date +%s); timeout 600 node "$s" > "$OUT/$n.txt" 2>&1; e=$?; echo "$e $(( $(date +%s)-start ))s $s" >> "$OUT/_exit.txt"; }
export -f run; export OUT
cat "$LIST" | xargs -P "$N" -I{} bash -c 'run "$@"; sleep 2' _ {}
echo DONE
