#!/usr/bin/env bash
# Walks /api/chat through every tool and guard. Prints the SSE stream of each call.
#   scripts/smoke-chat.sh http://127.0.0.1:8787 <pairing-code>          (local, against scripts/mock-anthropic.mjs or a real key)
#   scripts/smoke-chat.sh https://house-hub-api.… <pairing-code> <eli-pin>   (live; needs an adult PIN to sign in)
set -u
BASE=${1:?base}; CODE=${2:?pairing code}; PIN=${3:-}; P=${PROFILE:-eli}   # PROFILE=niece to use another adult
J() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a==null?a:a[k],o))})" "$1"; }
APPS='[{"id":"f260","name":"F260","scope":"person","visibleTo":["eli","christian","mom","dad","niece"]},{"id":"leftovers","name":"Larder Ledger","scope":"family"},{"id":"prayer","name":"Prayer","scope":"both","visibleTo":["eli","christian","mom","dad","niece"]},{"id":"tally","name":"Tally","scope":"person"},{"id":"timer","name":"Timer","scope":"person"}]'
chat() { # chat TOKEN "message"
  printf '\n>>> %s\n' "$2"
  curl -s -N -X POST "$BASE/api/chat" -H "X-Device-Token: $DT" -H "X-Profile-Token: $1" -H 'Content-Type: application/json' \
    --data "$(node -e 'console.log(JSON.stringify({message: process.argv[1], apps: JSON.parse(process.argv[2])}))' "$2" "$APPS")" | grep -E "^(event|data):" | sed 's/^/    /' | cut -c1-220
}
DT=$(curl -s -X POST $BASE/api/pair -H 'Content-Type: application/json' --data "{\"code\":\"$CODE\",\"name\":\"chat smoke\"}" | J device_token)
if [ -n "$PIN" ]; then A=$(curl -s -X POST $BASE/api/login -H "X-Device-Token: $DT" -H 'Content-Type: application/json' --data "{\"profile_id\":\"$P\",\"pin\":\"$PIN\"}" | J profile_token)
else A=$(curl -s -X POST $BASE/api/profiles/$P/pin -H "X-Device-Token: $DT" -H 'Content-Type: application/json' --data '{"pin":"1357"}' | J profile_token); fi
K=$(curl -s -X POST $BASE/api/login -H "X-Device-Token: $DT" -H 'Content-Type: application/json' --data '{"profile_id":"ezra"}' | J profile_token)
TV=$(curl -s -X POST $BASE/api/login -H "X-Device-Token: $DT" -H 'Content-Type: application/json' --data '{"profile_id":"tv"}' | J profile_token)

echo "### $P (adult)"
chat "$A" "Which apps can I use?"
chat "$A" "What's in the fridge?"
chat "$A" "Add milk to the leftovers"
chat "$A" "Remind everyone to take the bins out tonight"
chat "$A" "I read week 2 day 1 of F260"
chat "$A" "Please pray for Grandma's knee on the family list"
chat "$A" "Set my tally to 42"
echo; echo "### Ezra (kid): adult-only app blocked, reminders blocked, kid-safe prompt"
chat "$K" "Set my tally to 3"
chat "$K" "Change the prayer app for me"
chat "$K" "Remind everyone to buy cake"
chat "$K" "Hello!"
echo; echo "### Kiosk profile has no chat:"
curl -s -X POST "$BASE/api/chat" -H "X-Device-Token: $DT" -H "X-Profile-Token: $TV" -H 'Content-Type: application/json' --data '{"message":"hi"}'; echo
echo; echo "### History (rolling window) for $P:"
curl -s "$BASE/api/chat/history" -H "X-Device-Token: $DT" -H "X-Profile-Token: $A" | cut -c1-300; echo
