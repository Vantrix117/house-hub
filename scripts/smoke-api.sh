#!/usr/bin/env bash
# End-to-end smoke test of the House Hub API.
#   scripts/smoke-api.sh http://127.0.0.1:8787 <pairing-code> [house-key]
# Uses a throwaway PIN for the Niece profile and resets it again at the end (admin call),
# so it is safe to run against the live API once. Exits non-zero on the first failed expectation.
set -u
BASE=${1:?base url}; CODE=${2:?pairing code}
ORIGIN=${ORIGIN:-https://vantrix117.github.io}
pass=0; fail=0
j() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);const v=process.argv[1].split('.').reduce((a,k)=>a==null?a:a[k],o);console.log(typeof v==='object'?JSON.stringify(v):String(v))}catch(e){console.log('<not json>')}})" "$1"; }
call() { # call NAME METHOD PATH [BODY] [EXTRA-HEADERS...]
  local name=$1 method=$2 path=$3 body=${4:-}; shift 4 || shift $#
  local out; out=$(curl -s -w '\n%{http_code}' -X "$method" "$BASE$path" -H "Origin: $ORIGIN" -H 'Content-Type: application/json' "${@/#/-H}" ${body:+--data "$body"})
  STATUS=${out##*$'\n'}; BODY=${out%$'\n'*}
  printf '%-44s %s %s\n' "$name" "$STATUS" "$(echo "$BODY" | cut -c1-150)"
}
expect() { if [ "$STATUS" = "$1" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "   ^^^ EXPECTED $1"; fi; }

echo "### no auth"
call "health" GET /api/health; expect 200
call "profiles without device token" GET /api/profiles; expect 401
call "pair with wrong code" POST /api/pair '{"code":"nope"}'; expect 401
call "pair" POST /api/pair "{\"code\":\"$CODE\",\"name\":\"smoke A\"}"; expect 200
DT=$(echo "$BODY" | j device_token); DEVA=$(echo "$BODY" | j device_id)
call "pair second device" POST /api/pair "{\"code\":\"$CODE\",\"name\":\"smoke B\"}"; expect 200
DT2=$(echo "$BODY" | j device_token); DEVB=$(echo "$BODY" | j device_id)
D="X-Device-Token: $DT"

echo "### profiles + login"
call "profiles" GET /api/profiles '' "$D"; expect 200
echo "   $(echo "$BODY" | j profiles | cut -c1-400)"
call "login kid (no pin)" POST /api/login '{"profile_id":"ezra"}' "$D"; expect 200
KID=$(echo "$BODY" | j profile_token)
call "login kiosk (no pin)" POST /api/login '{"profile_id":"tv"}' "$D"; expect 200
TV=$(echo "$BODY" | j profile_token)
call "login adult w/o pin -> needs_pin_setup" POST /api/login '{"profile_id":"niece","pin":"1234"}' "$D"; expect 403
[ "$(echo "$BODY" | j error)" = needs_pin_setup ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=needs_pin_setup"; }
call "set pin for kid -> 400" POST /api/profiles/ezra/pin '{"pin":"1234"}' "$D"; expect 400
call "set pin bad format" POST /api/profiles/niece/pin '{"pin":"12"}' "$D"; expect 400
call "set pin (first time)" POST /api/profiles/niece/pin '{"pin":"2468"}' "$D"; expect 200
NIECE=$(echo "$BODY" | j profile_token)
call "set pin again -> 409" POST /api/profiles/niece/pin '{"pin":"1111"}' "$D"; expect 409
call "login wrong pin" POST /api/login '{"profile_id":"niece","pin":"0000"}' "$D"; expect 401
call "login right pin" POST /api/login '{"profile_id":"niece","pin":"2468"}' "$D"; expect 200
NIECE2=$(echo "$BODY" | j profile_token)
call "me" GET /api/me '' "$D" "X-Profile-Token: $NIECE2"; expect 200
call "profile token on other device -> 401" GET /api/me '' "X-Device-Token: $DT2" "X-Profile-Token: $NIECE2"; expect 401
call "logout" POST /api/logout '{}' "$D" "X-Profile-Token: $NIECE2"; expect 200
call "me after logout -> 401" GET /api/me '' "$D" "X-Profile-Token: $NIECE2"; expect 401

echo "### rate limit (5 wrong pins)"
for i in 1 2 3 4 5; do curl -s -o /dev/null -X POST "$BASE/api/login" -H "$D" -H 'Content-Type: application/json' --data '{"profile_id":"niece","pin":"9999"}'; done
call "6th wrong pin -> 429" POST /api/login '{"profile_id":"niece","pin":"9999"}' "$D"; expect 429
call "right pin still limited -> 429" POST /api/login '{"profile_id":"niece","pin":"2468"}' "$D"; expect 429

echo "### data"
P="X-Profile-Token: $NIECE"
call "put person" PUT "/api/data/tally/count?scope=person" '{"value":7,"updated_at":1000}' "$D" "$P"; expect 200
call "put older ts -> not applied" PUT "/api/data/tally/count?scope=person" '{"value":3,"updated_at":500}' "$D" "$P"; expect 200
[ "$(echo "$BODY" | j applied)" = false ] && [ "$(echo "$BODY" | j value)" = 7 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected applied=false value=7"; }
call "put newer ts -> applied" PUT "/api/data/tally/count?scope=person" '{"value":9,"updated_at":2000}' "$D" "$P"; expect 200
call "get person" GET "/api/data/tally?scope=person" '' "$D" "$P"; expect 200
call "get person single key" GET "/api/data/tally?scope=person&key=count" '' "$D" "$P"; expect 200
call "get person w/o profile -> 401" GET "/api/data/tally?scope=person" '' "$D"; expect 401
call "kid can't read niece's data (own scope empty)" GET "/api/data/tally?scope=person" '' "$D" "X-Profile-Token: $KID"; expect 200
[ "$(echo "$BODY" | j items)" = "[]" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected empty"; }
call "put family" PUT "/api/data/leftovers/item:abc?scope=family" '{"value":{"id":"abc","name":"Chili","size":"Large","dateLogged":"2026-09-15"},"updated_at":'$(date +%s000)'}' "$D" "$P"; expect 200
call "get family with device only" GET "/api/data/leftovers?scope=family&prefix=item:" '' "$D"; expect 200
echo "   $(echo "$BODY" | j items | cut -c1-300)"
call "kiosk write -> 403" PUT "/api/data/leftovers/item:zzz?scope=family" '{"value":{"id":"zzz"},"updated_at":1}' "$D" "X-Profile-Token: $TV"; expect 403
call "delete family item (tombstone)" DELETE "/api/data/leftovers/item:abc?scope=family" '' "$D" "$P"; expect 200
call "batch" POST "/api/data/f260/batch?scope=person" '{"items":[{"key":"done","value":{"1-1":true},"updated_at":5},{"key":"week","value":3,"updated_at":5}]}' "$D" "$P"; expect 200
call "since filter" GET "/api/data/f260?scope=person&since=4" '' "$D" "$P"; expect 200
call "bad scope -> 400" GET "/api/data/f260?scope=nope" '' "$D" "$P"; expect 400

echo "### activity"
call "post activity" POST /api/activity '{"app_id":"tally","text":"counted to 9"}' "$D" "$P"; expect 200
call "kiosk activity -> 403" POST /api/activity '{"app_id":"tally","text":"x"}' "$D" "X-Profile-Token: $TV"; expect 403
call "get activity" GET "/api/activity?limit=5" '' "$D"; expect 200

echo "### push"
call "subscribe" POST /api/push/subscribe '{"subscription":{"endpoint":"https://push.example/abc","keys":{"p256dh":"x","auth":"y"}}}' "$D" "$P"; expect 200
call "unsubscribe" DELETE /api/push/subscribe '' "$D" "$P"; expect 200

echo "### admin"
call "admin usage as non-admin -> 403" GET /api/admin/usage '' "$D" "$P"; expect 403
call "admin reset-pin as kid -> 403" POST /api/admin/profiles/niece/reset-pin '{}' "$D" "X-Profile-Token: $KID"; expect 403
call "admin as device-only -> 401" GET /api/admin/usage '' "$D"; expect 401
if [ -n "${ADMIN_PIN:-}" ]; then
  call "login eli" POST /api/login "{\"profile_id\":\"eli\",\"pin\":\"$ADMIN_PIN\"}" "$D"; expect 200
else
  call "set eli pin (first time, local only)" POST /api/profiles/eli/pin '{"pin":"1357"}' "$D"; expect 200
fi
A="X-Profile-Token: $(echo "$BODY" | j profile_token)"
call "admin usage" GET /api/admin/usage '' "$D" "$A"; expect 200
call "admin rename tv" PUT /api/admin/profiles/tv '{"name":"Downstairs TV","color":"#4C4C58","kind":"kiosk"}' "$D" "$A"; expect 200
call "admin bad color" PUT /api/admin/profiles/tv '{"color":"red"}' "$D" "$A"; expect 400
call "admin reset niece pin" POST /api/admin/profiles/niece/reset-pin '{}' "$D" "$A"; expect 200
call "niece needs_pin_setup again" POST /api/login '{"profile_id":"niece","pin":"2468"}' "$D"; expect 403
call "admin unpair device B" DELETE "/api/admin/devices/$DEVB" '' "$D" "$A"; expect 200
call "device B now unpaired" GET /api/profiles '' "X-Device-Token: $DT2"; expect 401
call "admin rotate code (keep same)" POST /api/admin/pairing-code/rotate "{\"code\":\"$CODE\"}" "$D" "$A"; expect 200
call "admin unpair self -> 400" DELETE "/api/admin/devices/$DEVA" '' "$D" "$A"; expect 400
call "admin unpair device A (cleanup, from B? no) skip" GET /api/health; expect 200

echo "### CORS"
out=$(curl -s -D - -o /dev/null -X OPTIONS "$BASE/api/profiles" -H "Origin: $ORIGIN" -H 'Access-Control-Request-Method: GET')
echo "$out" | grep -qi "access-control-allow-origin: $ORIGIN" && { pass=$((pass+1)); echo "preflight allows $ORIGIN"; } || { fail=$((fail+1)); echo "preflight MISSING allow-origin for $ORIGIN"; }
out=$(curl -s -D - -o /dev/null -X OPTIONS "$BASE/api/profiles" -H "Origin: https://evil.example" -H 'Access-Control-Request-Method: GET')
echo "$out" | grep -qi "access-control-allow-origin" && { fail=$((fail+1)); echo "preflight WRONGLY allows evil.example"; } || { pass=$((pass+1)); echo "preflight blocks evil.example"; }


echo; echo "PASS $pass  FAIL $fail"
[ "$fail" = 0 ]
