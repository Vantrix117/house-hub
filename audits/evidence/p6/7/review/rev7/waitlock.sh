#!/bin/bash
S="/c/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad"
set -o noclobber
until { echo "reviewer-7 (batch 7 independent review) $(date)" > "$S/suite.lock"; } 2>/dev/null; do sleep 15; done
echo "LOCK TAKEN $(date)"
