#!/usr/bin/env bash
# End-to-end smoke test of the House Hub API.
#   scripts/smoke-api.sh http://127.0.0.1:8787 <pairing-code> [house-key]
# Uses a throwaway PIN for the Niece profile and resets it again at the end (admin call). Since batch 0d a reset leaves
# Niece waiting for a one-time code (printed by the last reset), so run it against a local Worker, not the live one.
# D1_PERSIST: the local Worker's --persist-to folder; with it the batch 7 voice checks also count the stored recordings in D1 (without it they say so and skip that count).
# ADMIN_PIN: Eli's PIN when Eli already has one (the kitchen-role checks need it). Reports every expectation, then exits
# non-zero if any failed.
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

echo "### who read today (the TV's Reading today, batch 2c)"
NYDAY=$(node -e "const p={};for(const x of new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()))p[x.type]=x.value;console.log(p.year+'-'+p.month+'-'+p.day)")
call "readers with device only -> 401" GET /api/f260/readers '' "$D"; expect 401
call "tick today in F260 (person log row)" PUT "/api/data/f260/log:$NYDAY?scope=person" "{\"value\":true,\"updated_at\":$(node -e 'console.log(Date.now())')}" "$D" "$P"; expect 200
call "readers as the display" GET /api/f260/readers '' "$D" "X-Profile-Token: $TV"; expect 200
[ "$(echo "$BODY" | j date)" = "$NYDAY" ] && echo "$BODY" | grep -q '"niece"' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected today's date and niece among the readers"; }
call "untick today (log row false)" PUT "/api/data/f260/log:$NYDAY?scope=person" "{\"value\":false,\"updated_at\":$(node -e 'console.log(Date.now())')}" "$D" "$P"; expect 200
call "readers after the untick" GET /api/f260/readers '' "$D" "X-Profile-Token: $KID"; expect 200
echo "$BODY" | grep -q '"niece"' && { fail=$((fail+1)); echo "   ^^^ expected niece gone after the untick"; } || pass=$((pass+1))
# IMP-F260-F4 (batch 4): the reading nudge comes at the person's own time, one row push_pref:readAt ("HH:MM", unset = 8 pm)
call "choose a reading-nudge time (push_pref:readAt)" PUT "/api/data/hub/push_pref:readAt?scope=person" "{\"value\":\"06:30\",\"updated_at\":$(node -e 'console.log(Date.now())')}" "$D" "$P"; expect 200
# IMP-VERSES-I2 (batch 5): the evening verse review starts off; one row push_pref:verses turns it on. A memorised verse with
# no review row is due (the job counts from the F260 rows, never the app's summary)
call "memorise a verse (F260 mem:1-0)" PUT "/api/data/f260/mem:1-0?scope=person" "{\"value\":true,\"updated_at\":$(node -e 'console.log(Date.now())')}" "$D" "$P"; expect 200
call "turn the verse review on (push_pref:verses)" PUT "/api/data/hub/push_pref:verses?scope=person" "{\"value\":true,\"updated_at\":$(node -e 'console.log(Date.now())')}" "$D" "$P"; expect 200

echo "### rally the family (park map) — one rally per adult per minute, so wait 60 s between runs"
call "rally with device only -> 401" POST /api/dollywood/rally '{"name":"Gazebo","x":1,"y":2}' "$D"; expect 401
call "rally as kid -> 403" POST /api/dollywood/rally '{"name":"Gazebo","x":1,"y":2}' "$D" "X-Profile-Token: $KID"; expect 403
[ "$(echo "$BODY" | j error)" = adults_only ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=adults_only"; }
call "rally as kiosk -> 403" POST /api/dollywood/rally '{"name":"Gazebo","x":1,"y":2}' "$D" "X-Profile-Token: $TV"; expect 403
call "rally without a name -> 400" POST /api/dollywood/rally '{"x":1,"y":2}' "$D" "$P"; expect 400
call "rally with x as a string -> 400" POST /api/dollywood/rally '{"name":"Gazebo","x":"1","y":2}' "$D" "$P"; expect 400
call "rally" POST /api/dollywood/rally '{"name":"  The gazebo  ","x":1234.5,"y":678,"note":"bring the stroller"}' "$D" "$P"; expect 200
[ "$(echo "$BODY" | j ok)" = true ] && [ "$(echo "$BODY" | j meet.name)" = "The gazebo" ] && [ "$(echo "$BODY" | j meet.by)" = niece ] && [ "$(echo "$BODY" | j pushed)" != undefined ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected ok, meet.name trimmed, meet.by niece, pushed"; }
MEET_AT=$(echo "$BODY" | j updated_at)
call "rally again within a minute -> 429" POST /api/dollywood/rally '{"name":"Again","x":1,"y":2}' "$D" "$P"; expect 429
call "family pull (device only) has the meet row" GET "/api/data/dollywood-live?scope=family&key=meet" '' "$D"; expect 200
[ "$(echo "$BODY" | j item.value.name)" = "The gazebo" ] && [ "$(echo "$BODY" | j item.value.note)" = "bring the stroller" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected the meet row"; }
call "feed has the line" GET "/api/activity?limit=3" '' "$D"; expect 200
echo "$BODY" | grep -q '"Set a meeting point: The gazebo"' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected 'Set a meeting point: The gazebo' in the feed"; }
call "clear the rally as kid -> 403" DELETE /api/dollywood/rally '' "$D" "X-Profile-Token: $KID"; expect 403
call "clear the rally" DELETE /api/dollywood/rally '' "$D" "$P"; expect 200
[ "$(echo "$BODY" | j cleared)" = true ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected cleared=true"; }
call "clear again (idempotent)" DELETE /api/dollywood/rally '' "$D" "$P"; expect 200
call "since-pull carries the tombstone" GET "/api/data/dollywood-live?scope=family&since=$((MEET_AT-1))" '' "$D"; expect 200
echo "$BODY" | grep -q '"key":"meet","value":null' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected a meet tombstone"; }

echo "### push"
# batch 2b: a subscription needs real keys (P2-PWA-10); the display and kids get none (P2-PROF-16); the test goes to this
# device only (P2-PWA-12); the switch is read from the house (P2-PWA-03); a replaced subscription moves by its old endpoint (PWA-GAP-2)
PK='"keys":{"p256dh":"BAs4RP9Yj3z2JqDewCCTSUp2dDJMC99wBfNLo-T7DFhWxN0KFmDf7FhGnPClKyd-ZepBq3duamj7guuxJeqEPtc","auth":"x8uzNVqHuD2tBwWiY58quw"}'
call "subscribe without keys -> 400" POST /api/push/subscribe '{"subscription":{"endpoint":"https://push.example/abc"}}' "$D" "$P"; expect 400
call "subscribe with keys that are not keys -> 400" POST /api/push/subscribe '{"subscription":{"endpoint":"https://push.example/abc","keys":{"p256dh":"x","auth":"y"}}}' "$D" "$P"; expect 400
call "subscribe" POST /api/push/subscribe "{\"subscription\":{\"endpoint\":\"https://push.example/abc\",$PK}}" "$D" "$P"; expect 200
call "my subscription on this device" GET /api/push/subscribe '' "$D" "$P"; expect 200
[ "$(echo "$BODY" | j subscribed)" = true ] && [ "$(echo "$BODY" | j endpoint)" = https://push.example/abc ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected subscribed=true, endpoint .../abc"; }
call "the display cannot subscribe -> 403" POST /api/push/subscribe "{\"subscription\":{\"endpoint\":\"https://push.example/tv\",$PK}}" "$D" "X-Profile-Token: $TV"; expect 403
[ "$(echo "$BODY" | j error)" = read_only ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=read_only"; }
call "a kid cannot subscribe -> 403" POST /api/push/subscribe "{\"subscription\":{\"endpoint\":\"https://push.example/kid\",$PK}}" "$D" "X-Profile-Token: $KID"; expect 403
call "the display cannot send a test -> 403" POST /api/push/test '{}' "$D" "X-Profile-Token: $TV"; expect 403
call "a kid cannot send a test -> 403" POST /api/push/test '{}' "$D" "X-Profile-Token: $KID"; expect 403
call "test goes to this device's subscription" POST /api/push/test '{}' "$D" "$P"; expect 200
[ "$(echo "$BODY" | j device)" = true ] && [ "$(echo "$BODY" | j sent)" = 1 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected device=true, sent=1 (this device only)"; }
call "resubscribe without a device token -> 401" POST /api/push/resubscribe "{\"old_endpoint\":\"https://push.example/abc\",\"subscription\":{\"endpoint\":\"https://push.example/evil\",$PK}}"; expect 401
call "resubscribe from another device moves nothing -> 404" POST /api/push/resubscribe "{\"old_endpoint\":\"https://push.example/abc\",\"subscription\":{\"endpoint\":\"https://push.example/evil\",$PK}}" "X-Device-Token: $DT2"; expect 404
call "resubscribe by the old endpoint (this device's token)" POST /api/push/resubscribe "{\"old_endpoint\":\"https://push.example/abc\",\"subscription\":{\"endpoint\":\"https://push.example/abc2\",$PK}}" "$D"; expect 200
[ "$(echo "$BODY" | j moved)" = 1 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected moved=1"; }
call "the house now has the new endpoint" GET /api/push/subscribe '' "$D" "$P"; expect 200
[ "$(echo "$BODY" | j endpoint)" = https://push.example/abc2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected endpoint .../abc2"; }
call "resubscribe an unknown endpoint -> 404" POST /api/push/resubscribe "{\"old_endpoint\":\"https://push.example/nobody\",\"subscription\":{\"endpoint\":\"https://push.example/x\",$PK}}" "$D"; expect 404
call "an http endpoint off this machine -> 400" POST /api/push/subscribe "{\"subscription\":{\"endpoint\":\"http://push.example/plain\",$PK}}" "$D" "$P"; expect 400
call "unsubscribe" DELETE /api/push/subscribe '' "$D" "$P"; expect 200
call "the switch reads off" GET /api/push/subscribe '' "$D" "$P"; expect 200
[ "$(echo "$BODY" | j subscribed)" = false ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected subscribed=false"; }

echo "### chat history (GAP-CHAT-01)"
call "clear my chat history" DELETE /api/chat/history '' "$D" "$P"; expect 200
[ "$(echo "$BODY" | j ok)" = true ] && [ "$(echo "$BODY" | j cap)" = 60 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected ok, cap 60"; }
call "the display cannot clear a chat -> 403" DELETE /api/chat/history '' "$D" "X-Profile-Token: $TV"; expect 403

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
RCODE=$(echo "$BODY" | j code)
echo "$RCODE" | grep -qE '^[0-9]{6}$' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected a 6-digit one-time code"; }
call "niece needs_pin_setup again" POST /api/login '{"profile_id":"niece","pin":"2468"}' "$D"; expect 403
# P2-PROF-04: after a reset nobody can claim the account without the admin's one-time code
call "claim niece without the code -> 403" POST /api/profiles/niece/pin '{"pin":"1111"}' "$D"; expect 403
[ "$(echo "$BODY" | j error)" = needs_code ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=needs_code"; }
call "claim niece with a wrong code -> 401" POST /api/profiles/niece/pin '{"pin":"1111","code":"000000"}' "$D"; expect 401
call "admin unpair device B" DELETE "/api/admin/devices/$DEVB" '' "$D" "$A"; expect 200
call "device B now unpaired" GET /api/profiles '' "X-Device-Token: $DT2"; expect 401
call "admin rotate code (keep same)" POST /api/admin/pairing-code/rotate "{\"code\":\"$CODE\"}" "$D" "$A"; expect 200
call "admin unpair self -> 400" DELETE "/api/admin/devices/$DEVA" '' "$D" "$A"; expect 400
call "admin unpair device A (cleanup, from B? no) skip" GET /api/health; expect 200

echo "### guests (roadmap 23)"
call "niece sets a pin again (with the code)" POST /api/profiles/niece/pin "{\"pin\":\"2468\",\"code\":\"$RCODE\"}" "$D"; expect 200
G="X-Profile-Token: $(echo "$BODY" | j profile_token)"
call "add guest as kid -> 403" POST /api/profiles '{"name":"Nope"}' "$D" "X-Profile-Token: $KID"; expect 403
call "add guest as kiosk -> 403" POST /api/profiles '{"name":"Nope"}' "$D" "X-Profile-Token: $TV"; expect 403
call "add guest w/o name -> 400" POST /api/profiles '{"emoji":"🌻"}' "$D" "$G"; expect 400
call "add guest bad pin -> 400" POST /api/profiles '{"name":"Sue","pin":"12"}' "$D" "$G"; expect 400
call "add guest as adult" POST /api/profiles "{\"name\":\"Aunt Sue\",\"emoji\":\"\ud83c\udf3b\",\"color\":\"#137F77\",\"expires_at\":$(( $(date +%s) * 1000 + 86400000 ))}" "$D" "$G"; expect 200
GID=$(echo "$BODY" | j profile.id)
[ "$(echo "$BODY" | j profile.is_guest)" = true ] && [ "$(echo "$BODY" | j profile.kind)" = adult ] && [ "$(echo "$BODY" | j profile.is_admin)" = false ] && [ "$(echo "$BODY" | j profile.created_by)" = niece ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected is_guest adult, not admin, created_by niece"; }
call "guest logs in without a pin" POST /api/login "{\"profile_id\":\"$GID\"}" "$D"; expect 200
GT="X-Profile-Token: $(echo "$BODY" | j profile_token)"
call "guest writes person data" PUT "/api/data/f260/week?scope=person" '{"value":2,"updated_at":'$(date +%s000)'}' "$D" "$GT"; expect 200
call "guest cannot add a guest -> 403" POST /api/profiles '{"name":"Nested"}' "$D" "$GT"; expect 403
call "guest cannot rally the family -> 403" POST /api/dollywood/rally '{"name":"Gazebo","x":1,"y":2}' "$D" "$GT"; expect 403
[ "$(echo "$BODY" | j error)" = adults_only ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=adults_only"; }
# a guest's PIN is fixed at creation: no paired device can "create" one on a tap-to-open guest (hijack / lockout)
call "set a PIN on a guest from a paired device -> 403" POST "/api/profiles/$GID/pin" '{"pin":"9999"}' "$D"; expect 403
[ "$(echo "$BODY" | j error)" = guest_pin_fixed ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=guest_pin_fixed"; }
call "guest still signs in on tap" POST /api/login "{\"profile_id\":\"$GID\"}" "$D"; expect 200
GT2="X-Profile-Token: $(echo "$BODY" | j profile_token)"
# P2-PWA-03: signing out (Me → Switch) ends the person's subscription on this device with the session
call "guest subscribes on a second session" POST /api/push/subscribe "{\"subscription\":{\"endpoint\":\"https://push.example/guest2\",$PK}}" "$D" "$GT2"; expect 200
call "guest signs out (Switch)" POST /api/logout '{}' "$D" "$GT2"; expect 200
call "guest subscribes again, then someone else signs in here" POST /api/push/subscribe "{\"subscription\":{\"endpoint\":\"https://push.example/guest3\",$PK}}" "$D" "$GT"; expect 200
call "the kid signs in on this device" POST /api/login '{"profile_id":"ezra"}' "$D"; expect 200
call "the guest's subscription here ended with it" GET /api/push/subscribe '' "$D" "$GT"; expect 200
[ "$(echo "$BODY" | j subscribed)" = false ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected subscribed=false after another sign-in on the device"; }
call "stop a reply (unknown id is fine)" POST /api/chat/stop '{"rid":"smoke-rid-12345"}' "$D" "$A"; expect 200
call "stop without an id -> 400" POST /api/chat/stop '{}' "$D" "$A"; expect 400
call "their subscription here is gone" GET /api/push/subscribe '' "$D" "$GT"; expect 200
[ "$(echo "$BODY" | j subscribed)" = false ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected subscribed=false after sign-out"; }
# PWA-UX-2: the household's pushes never go to a guest
call "forced prayer job" POST /api/admin/cron/run '{"job":"prayer"}' "$D" "$A"; expect 200
echo "$BODY" | grep -q "\"$GID\"" && { fail=$((fail+1)); echo "   ^^^ expected the guest absent from the household prayer job"; } || pass=$((pass+1))
call "forced prayedfor job (GAP-PRAYER-1)" POST /api/admin/cron/run '{"job":"prayedfor"}' "$D" "$A"; expect 200
call "forced praytime job (GAP-PRAYER-1)" POST /api/admin/cron/run '{"job":"praytime"}' "$D" "$A"; expect 200
call "forced evening job (the reading nudge, IMP-F260-F4)" POST /api/admin/cron/run '{"job":"evening"}' "$D" "$A"; expect 200
echo "$BODY" | grep -q '"profile":"niece","readToday":false,"at":"06:30"' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected the niece checked at her own time, 06:30"; }
call "forced verses job (IMP-VERSES-I2)" POST /api/admin/cron/run '{"job":"verses"}' "$D" "$A"; expect 200
echo "$BODY" | grep -q '"profile":"niece","due":[1-9]' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected the niece (switch on) checked with a verse due"; }
echo "$BODY" | grep -Eq '"(ezra|kiara|tv|kitchen)"' && { fail=$((fail+1)); echo "   ^^^ expected no kid, display or kitchen in the verses job"; } || pass=$((pass+1))
# batch 6 (PWA-GAP-1): the "Timer done" push is its own job on the minute trigger, forceable from Admin
call "forced timer job (PWA-GAP-1)" POST /api/admin/cron/run '{"job":"timer"}' "$D" "$A"; expect 200
[ "$(echo "$BODY" | j job)" = timer ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected job=timer"; }
call "an unknown job names the timer job" POST /api/admin/cron/run '{"job":"nope"}' "$D" "$A"; expect 400
echo "$BODY" | grep -q "'timer'" && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected 'timer' among the jobs"; }
call "admin usage counts New York days" GET /api/admin/usage '' "$D" "$A"; expect 200
[ "$(echo "$BODY" | j tz)" = America/New_York ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected tz America/New_York"; }
# an expired guest stops receiving push: ending the stay drops their sessions and subscriptions
call "guest subscribes to push" POST /api/push/subscribe "{\"subscription\":{\"endpoint\":\"https://push.example/guest\",$PK}}" "$D" "$GT"; expect 200
call "admin ends the guest's stay" PUT "/api/admin/profiles/$GID" '{"expires_at":1000}' "$D" "$A"; expect 200
call "expired guest session -> 401" GET /api/me '' "$D" "$GT"; expect 401
call "admin usage" GET /api/admin/usage '' "$D" "$A"; expect 200
echo "$BODY" | j push_subscriptions | grep -q "\"$GID\"" && { fail=$((fail+1)); echo "   ^^^ expected no push subscription left for the expired guest"; } || pass=$((pass+1))
call "forced morning job never lists the expired guest" POST /api/admin/cron/run '{"job":"morning"}' "$D" "$A"; expect 200
echo "$BODY" | grep -q "\"$GID\"" && { fail=$((fail+1)); echo "   ^^^ expected the expired guest absent from the job output"; } || pass=$((pass+1))
call "admin reopens the stay (a week)" PUT "/api/admin/profiles/$GID" "{\"expires_at\":$(( $(date +%s) * 1000 + 7 * 86400000 ))}" "$D" "$A"; expect 200
call "add guest with pin, already expired" POST /api/profiles '{"name":"Old Guest","pin":"4321","expires_at":1000}' "$D" "$G"; expect 200
GOLD=$(echo "$BODY" | j profile.id)
call "expired guest cannot log in -> 403" POST /api/login "{\"profile_id\":\"$GOLD\",\"pin\":\"4321\"}" "$D"; expect 403
[ "$(echo "$BODY" | j error)" = guest_expired ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=guest_expired"; }
call "profiles (device only) hide the expired guest" GET /api/profiles '' "$D"; expect 200
echo "$BODY" | grep -q "\"$GID\"" && ! echo "$BODY" | grep -q "\"$GOLD\"" && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected $GID listed and $GOLD hidden"; }
call "profiles (admin) include the expired guest" GET /api/profiles '' "$D" "$A"; expect 200
echo "$BODY" | grep -q "\"$GOLD\"" && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected $GOLD listed for the admin"; }
call "purge a live guest -> 400" POST "/api/admin/profiles/$GID/purge" '{}' "$D" "$A"; expect 400
call "purge the expired guest" POST "/api/admin/profiles/$GOLD/purge" '{}' "$D" "$A"; expect 200
call "delete a household profile -> 400" DELETE /api/admin/profiles/ezra '' "$D" "$A"; expect 400
call "delete guest as non-admin -> 403" DELETE "/api/admin/profiles/$GID" '' "$D" "$G"; expect 403
call "admin extends the guest's stay" PUT "/api/admin/profiles/$GID" '{"expires_at":null}' "$D" "$A"; expect 200
[ "$(echo "$BODY" | j profile.expires_at)" = null ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected expires_at null"; }
call "admin cannot make a guest a kid -> 400" PUT "/api/admin/profiles/$GID" '{"kind":"kid"}' "$D" "$A"; expect 400
call "delete the guest" DELETE "/api/admin/profiles/$GID" '' "$D" "$A"; expect 200
call "guest session gone -> 401" GET /api/me '' "$D" "$GT"; expect 401
call "guest profile gone -> 404" POST /api/login "{\"profile_id\":\"$GID\"}" "$D"; expect 404
call "guest cleanup runs" POST /api/admin/guests/purge '{}' "$D" "$A"; expect 200
echo "### batch 0d: accounts, kid limits, the kitchen device"
NIECE3=$(curl -s -X POST "$BASE/api/login" -H "$D" -H 'Content-Type: application/json' --data '{"profile_id":"niece","pin":"2468"}' | j profile_token); N="X-Profile-Token: $NIECE3"
AP=${ADMIN_PIN:-1357}
# P2-PROF-06: the admin's own reset needs the admin's PIN
call "admin resets own pin without pin -> 403" POST /api/admin/profiles/eli/reset-pin '{}' "$D" "$A"; expect 403
[ "$(echo "$BODY" | j error)" = wrong_admin_pin ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=wrong_admin_pin"; }
# GAP-PROF-a1: change my PIN
call "change my pin, wrong current -> 403" POST /api/me/pin '{"current":"0000","pin":"8642"}' "$D" "$N"; expect 403
call "change my pin" POST /api/me/pin '{"current":"2468","pin":"8642"}' "$D" "$N"; expect 200
call "old pin no longer works" POST /api/login '{"profile_id":"niece","pin":"2468"}' "$D"; expect 401
call "new pin works" POST /api/login '{"profile_id":"niece","pin":"8642"}' "$D"; expect 200
call "change pin back" POST /api/me/pin '{"current":"8642","pin":"2468"}' "$D" "$N"; expect 200
call "kid cannot change a pin -> 403" POST /api/me/pin '{"current":"1","pin":"1234"}' "$D" "X-Profile-Token: $KID"; expect 403
# P3-DOLLYWOOD-LIVE-01: no markup in names
call "guest named with markup -> 400" POST /api/profiles '{"name":"<img src=x onerror=alert(1)>"}' "$D" "$N"; expect 400
call "admin renames with markup -> 400" PUT /api/admin/profiles/ezra '{"name":"Ezra<b>"}' "$D" "$A"; expect 400
call "admin sets a colour family" PUT /api/admin/profiles/ezra '{"hue":"mint"}' "$D" "$A"; expect 200
[ "$(echo "$BODY" | j profile.hue)" = mint ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected hue=mint"; }
call "admin sets an unknown colour family -> 400" PUT /api/admin/profiles/ezra '{"hue":"neon"}' "$D" "$A"; expect 400
call "admin clears the colour family" PUT /api/admin/profiles/ezra '{"hue":null}' "$D" "$A"; expect 200
# P2-PROF-05 / P2-CHAT-02 / P3-DOLLYWOOD-LIVE-02 / UX-KIDVERSE-3: kid and guest limits on family rows, enforced by the Worker
K="X-Profile-Token: $KID"; NOW=$(date +%s000)
call "kid writes the meeting point -> 403" PUT "/api/data/dollywood-live/meet?scope=family" '{"value":{"x":1,"y":2,"name":"Candy"}}' "$D" "$K"; expect 403
call "kid writes a leftovers row -> 403" PUT "/api/data/leftovers/item:kid1?scope=family" '{"value":{"id":"kid1","name":"x"}}' "$D" "$K"; expect 403
call "kid cash-in ledger vs a sibling -> 403" PUT "/api/data/kidverse/ledger:kiara:x?scope=family" '{"value":{"kind":"cashin","amount":9}}' "$D" "$K"; expect 403
call "kid overwrites a sibling's stars -> 403" PUT "/api/data/kidverse/stars:kiara?scope=family" '{"value":{"count":0}}' "$D" "$K"; expect 403
call "kid writes own stars mirror" PUT "/api/data/kidverse/stars:ezra?scope=family" "{\"value\":{\"count\":1},\"updated_at\":$NOW}" "$D" "$K"; expect 200
call "kid switches own beacon on -> 403" PUT "/api/data/dollywood-live/kidshare:ezra?scope=family" '{"value":true}' "$D" "$K"; expect 403
call "kid places own dot, beacon off -> 403" PUT "/api/data/dollywood-live/loc:ezra?scope=family" '{"value":{"x":1,"y":2,"t":1}}' "$D" "$K"; expect 403
call "kid reads a hidden app's family rows -> 403" GET "/api/data/f260?scope=family" '' "$D" "$K"; expect 403
call "kid writes a hidden app's person rows -> 403" PUT "/api/data/f260/week?scope=person" '{"value":3}' "$D" "$K"; expect 403
# batch 6 (GAP-HOME-1): the Timer's family mirror run:<writer>:<id> is written only by its own writer — a kid too
call "kid writes its own timer mirror" PUT "/api/data/timer/run:ezra:smk?scope=family" "{\"value\":{\"total\":60000,\"endAt\":$((NOW+60000)),\"startedAt\":$NOW},\"updated_at\":$NOW}" "$D" "$K"; expect 200
call "kid writes a sibling's timer mirror -> 403" PUT "/api/data/timer/run:kiara:smk?scope=family" '{"value":{"total":1}}' "$D" "$K"; expect 403
call "adult writes a kid's timer mirror -> 403" PUT "/api/data/timer/run:ezra:smk2?scope=family" '{"value":{"total":1}}' "$D" "$A"; expect 403
call "any other family timer row -> 403" PUT "/api/data/timer/active?scope=family" '{"value":1}' "$D" "$A"; expect 403
call "casing is no way round: RUN:kiara by a kid -> 403" PUT "/api/data/timer/RUN:kiara:x?scope=family" '{"value":{"total":1}}' "$D" "$K"; expect 403
call "the TV reads the timers' mirror" GET "/api/data/timer?scope=family" '' "$D" "X-Profile-Token: $TV"; expect 200
echo "$BODY" | grep -q '"run:ezra:smk"' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected run:ezra:smk on the TV"; }
call "the TV writes no mirror -> 403" PUT "/api/data/timer/run:tv:x?scope=family" '{"value":{"total":1}}' "$D" "X-Profile-Token: $TV"; expect 403
call "kid clears its own timer mirror" DELETE "/api/data/timer/run:ezra:smk?scope=family" '' "$D" "$K"; expect 200
call "key casing is no way round: LOC:kiara by a kid -> 403" PUT "/api/data/dollywood-live/LOC:kiara?scope=family" '{"value":{"x":1,"y":2,"t":1}}' "$D" "$K"; expect 403
TODAY=$(TZ=America/New_York date +%F); OLD=$(TZ=America/New_York date -d '-10 days' +%F)
call "an adult adds a family prayer Kiara prayed" PUT "/api/data/prayer/prayer:smk1?scope=family" "{\"value\":{\"id\":\"smk1\",\"title\":\"Smoke\",\"status\":\"active\",\"prayedBy\":{\"$TODAY\":[\"Kiara\"]}},\"updated_at\":$NOW}" "$D" "$N"; expect 200
call "kid's stale tick (no Kiara, new title, backdated day) is merged" PUT "/api/data/prayer/prayer:smk1?scope=family" "{\"value\":{\"id\":\"smk1\",\"title\":\"Hacked\",\"status\":\"active\",\"prayedBy\":{\"$TODAY\":[\"Ezra\"],\"$OLD\":[\"Ezra\"]}},\"updated_at\":$((NOW+1))}" "$D" "$K"; expect 200
call "the house keeps Kiara and the title, Ezra (by id) today only" GET "/api/data/prayer?scope=family&key=prayer:smk1" '' "$D" "$N"; expect 200
[ "$(echo "$BODY" | j item.value.title)" = Smoke ] && echo "$BODY" | grep -q "\"$TODAY\":\[\"Kiara\",\"ezra\"\]" && ! echo "$BODY" | grep -q "\"$OLD\"" && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected title Smoke, today [Kiara, ezra], no backdated day"; }
call "tidy the smoke prayer" DELETE "/api/data/prayer/prayer:smk1?scope=family" '' "$D" "$N"; expect 200
call "kid keeps Verses recall in the F260 scope" PUT "/api/data/f260/f260.recall?scope=person" '{"value":{}}' "$D" "$K"; expect 200
call "batch: a refused row comes back, the rest saves" POST "/api/data/kidverse/batch?scope=family" "{\"items\":[{\"key\":\"stars:ezra\",\"value\":{\"count\":2},\"updated_at\":$((NOW+1))},{\"key\":\"week\",\"value\":{\"week\":9},\"updated_at\":$((NOW+1))}]}" "$D" "$K"; expect 200
[ "$(echo "$BODY" | j results.0.applied)" = true ] && [ "$(echo "$BODY" | j results.1.rejected)" = household_only ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected row 0 applied, row 1 rejected household_only"; }
call "an adult adds a guest to test with" POST /api/profiles '{"name":"Visitor"}' "$D" "$N"; expect 200
VID=$(echo "$BODY" | j profile.id)
VT="X-Profile-Token: $(curl -s -X POST "$BASE/api/login" -H "$D" -H 'Content-Type: application/json' --data "{\"profile_id\":\"$VID\"}" | j profile_token)"
call "guest steps the family week -> 403" PUT "/api/data/kidverse/week?scope=family" '{"value":{"week":9}}' "$D" "$VT"; expect 403
call "guest switches a kid's beacon -> 403" PUT "/api/data/dollywood-live/kidshare:ezra?scope=family" '{"value":true}' "$D" "$VT"; expect 403
call "guest sets a kid's height -> 403" PUT "/api/data/dollywood-live/kid:ezra?scope=family" '{"value":{"h":44}}' "$D" "$VT"; expect 403
call "household adult switches the beacon on" PUT "/api/data/dollywood-live/kidshare:ezra?scope=family" "{\"value\":true,\"updated_at\":$NOW}" "$D" "$N"; expect 200
call "kid places own dot, beacon on" PUT "/api/data/dollywood-live/loc:ezra?scope=family" "{\"value\":{\"x\":1,\"y\":2,\"t\":$NOW},\"updated_at\":$NOW}" "$D" "$K"; expect 200
call "guest clears the kid's fresh dot -> 403" DELETE "/api/data/dollywood-live/loc:ezra?scope=family" '' "$D" "$VT"; expect 403
call "household adult switches the beacon off" PUT "/api/data/dollywood-live/kidshare:ezra?scope=family" "{\"value\":false,\"updated_at\":$((NOW+5))}" "$D" "$N"; expect 200
call "household adult clears the kid's dot" DELETE "/api/data/dollywood-live/loc:ezra?scope=family" '' "$D" "$N"; expect 200
call "remove the test guest" DELETE "/api/admin/profiles/$VID" '' "$D" "$A"; expect 200
# P2-PWA-01: a private prayer title never reaches the family feed
call "feed line naming a private request -> 400" POST /api/activity '{"app_id":"prayer","text":"Prayed for my secret"}' "$D" "$N"; expect 400
call "feed line without the title" POST /api/activity '{"app_id":"prayer","text":"Prayed for a private request"}' "$D" "$N"; expect 200
# P2-SEC-01: wrong PINs are limited per profile across devices, not only per device
call "a guest with a PIN to test with" POST /api/profiles '{"name":"Lock Test","pin":"4321"}' "$D" "$N"; expect 200
LID=$(echo "$BODY" | j profile.id)
call "the guest signs in once here (this device is now trusted)" POST /api/login "{\"profile_id\":\"$LID\",\"pin\":\"4321\"}" "$D"; expect 200
for i in 1 2 3 4; do
  LDT=$(curl -s -X POST "$BASE/api/pair" -H 'Content-Type: application/json' --data "{\"code\":\"$CODE\",\"name\":\"lock $i\"}" | j device_token)
  for k in 1 2 3; do curl -s -o /dev/null -X POST "$BASE/api/login" -H "X-Device-Token: $LDT" -H 'Content-Type: application/json' --data "{\"profile_id\":\"$LID\",\"pin\":\"000$k\"}"; done
done
LDT=$(curl -s -X POST "$BASE/api/pair" -H 'Content-Type: application/json' --data "{\"code\":\"$CODE\",\"name\":\"lock 5\"}" | j device_token)
call "12 wrong PINs on 4 devices: a 5th device -> 429" POST /api/login "{\"profile_id\":\"$LID\",\"pin\":\"4321\"}" "X-Device-Token: $LDT"; expect 429
call "…while a device it used before still signs in" POST /api/login "{\"profile_id\":\"$LID\",\"pin\":\"4321\"}" "$D"; expect 200
call "admin reset lifts the pause" POST "/api/admin/profiles/$LID/reset-pin" '{}' "$D" "$A"; expect 200
call "the guest signs in on tap again" POST /api/login "{\"profile_id\":\"$LID\"}" "X-Device-Token: $LDT"; expect 200
call "remove the lock-test guest" DELETE "/api/admin/profiles/$LID" '' "$D" "$A"; expect 200
# UX-PROF-a7: wrong pairing codes are limited per device, so one device cannot block the house
FP="smoke$(date +%s)$RANDOM"
for i in 1 2 3 4 5; do curl -s -o /dev/null -X POST "$BASE/api/pair" -H 'Content-Type: application/json' --data "{\"code\":\"nope\",\"fp\":\"$FP\"}"; done
call "6th wrong code from one device -> 429" POST /api/pair "{\"code\":\"nope\",\"fp\":\"$FP\"}"; expect 429
call "another device can still pair" POST /api/pair "{\"code\":\"$CODE\",\"name\":\"smoke C\",\"fp\":\"other$FP\"}"; expect 200
# KITCHEN-1
DK=$(curl -s -X POST "$BASE/api/pair" -H 'Content-Type: application/json' --data "{\"code\":\"$CODE\",\"name\":\"smoke kitchen\"}"); DKT=$(echo "$DK" | j device_token); DKID=$(echo "$DK" | j device_id); DKH="X-Device-Token: $DKT"
call "kitchen sign-in on an ordinary device -> 403" POST /api/login '{"profile_id":"kitchen"}' "$D"; expect 403
call "kitchen is marked in the profile list" GET /api/profiles '' "$D"; expect 200
echo "$BODY" | grep -q '"id":"kitchen","name":"Kitchen","emoji":"[^"]*","color":"[^"]*","kind":"kitchen"' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected the kitchen profile with kind kitchen"; }
call "role change by a non-admin -> 403" PUT "/api/admin/devices/$DKID/role" '{"role":"kitchen","admin_pin":"2468"}' "$D" "$N"; expect 403
call "role change without the admin PIN -> 403" PUT "/api/admin/devices/$DKID/role" '{"role":"kitchen"}' "$D" "$A"; expect 403
call "role change of this device -> 400" PUT "/api/admin/devices/$DEVA/role" "{\"role\":\"kitchen\",\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 400
call "admin makes it the kitchen" PUT "/api/admin/devices/$DKID/role" "{\"role\":\"kitchen\",\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
call "the device learns its role" GET /api/device '' "$DKH"; expect 200
[ "$(echo "$BODY" | j role)" = kitchen ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected role=kitchen"; }
call "a person on the kitchen device -> 403" POST /api/login '{"profile_id":"niece","pin":"2468"}' "$DKH"; expect 403
call "the kitchen signs in, no PIN" POST /api/login '{"profile_id":"kitchen"}' "$DKH"; expect 200
KT="X-Profile-Token: $(echo "$BODY" | j profile_token)"
call "kitchen writes the Larder" PUT "/api/data/leftovers/item:kt1?scope=family" "{\"value\":{\"id\":\"kt1\",\"name\":\"Soup\",\"dateLogged\":\"$TODAY\",\"by\":\"kitchen\"}}" "$DKH" "$KT"; expect 200
call "kitchen names a kid on a Larder row -> 403" PUT "/api/data/leftovers/item:kt2?scope=family" "{\"value\":{\"id\":\"kt2\",\"name\":\"Soup\",\"dateLogged\":\"$TODAY\",\"by\":\"ezra\",\"byName\":\"Ezra\"}}" "$DKH" "$KT"; expect 403
echo "$BODY" | grep -q '"rejected":"bad_credit"' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected rejected bad_credit"; }
# the Larder's finished row credits an adult of the household only (review of batch 2a: finishedBy is checked like by)
call "a guest for the credit checks" POST /api/profiles '{"name":"Smoke Credit","emoji":"🙂","color":"#4C4C58","hue":"sky"}' "$D" "$N"; expect 200
KGID=$(echo "$BODY" | j profile.id)
for W in "ezra:Ezra" "$KGID:Smoke Credit" "tv:Downstairs TV"; do
  call "kitchen finishes it for ${W%%:*} -> 403" PUT "/api/data/leftovers/finished:ktf?scope=family" "{\"value\":{\"id\":\"ktf\",\"name\":\"Soup\",\"finishedAt\":\"$TODAY\",\"finishedBy\":\"${W%%:*}\",\"finishedByName\":\"${W#*:}\"}}" "$DKH" "$KT"; expect 403
  echo "$BODY" | grep -q '"rejected":"bad_credit"' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected rejected bad_credit"; }
done
call "kitchen finishes it for an adult (Mea)" PUT "/api/data/leftovers/finished:ktf?scope=family" "{\"value\":{\"id\":\"ktf\",\"name\":\"Soup\",\"finishedAt\":\"$TODAY\",\"finishedBy\":\"niece\",\"finishedByName\":\"Mea\"}}" "$DKH" "$KT"; expect 200
call "…under the wrong name -> 403" PUT "/api/data/leftovers/finished:ktf?scope=family" "{\"value\":{\"id\":\"ktf\",\"name\":\"Soup\",\"finishedAt\":\"$TODAY\",\"finishedBy\":\"dad\",\"finishedByName\":\"Mea\"}}" "$DKH" "$KT"; expect 403
call "tidy the finished row" DELETE "/api/data/leftovers/finished:ktf?scope=family" '' "$D" "$N"; expect 200
call "remove the credit-check guest" DELETE "/api/admin/profiles/$KGID" '' "$D" "$A"; expect 200
# a Larder row's date is a real day, not after today (batch 0i, P3-LEFTOVERS-04, -09)
call "a Larder row dated 'yesterday' -> 403" PUT "/api/data/leftovers/item:bd1?scope=family" '{"value":{"id":"bd1","name":"Stew","dateLogged":"yesterday"}}' "$D" "$N"; expect 403
echo "$BODY" | grep -q '"rejected":"bad_date"' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected rejected bad_date"; }
call "a Larder row dated 2099-01-01 -> 403" PUT "/api/data/leftovers/item:bd2?scope=family" '{"value":{"id":"bd2","name":"Stew","dateLogged":"2099-01-01"}}' "$D" "$N"; expect 403
call "a Larder row dated today -> 200" PUT "/api/data/leftovers/item:bd3?scope=family" "{\"value\":{\"id\":\"bd3\",\"name\":\"Stew\",\"dateLogged\":\"$TODAY\"}}" "$D" "$N"; expect 200
call "tidy the dated row" DELETE "/api/data/leftovers/item:bd3?scope=family" '' "$D" "$N"; expect 200
# an edited Larder item (batch 8, GAP-LEFTOVERS-1, IMP-LEFTOVERS-I1): useBy is a real day (any day, a future one included), portion is only 'some', editedBy is the writer's own id
call "a Larder row with a future use-by -> 200" PUT "/api/data/leftovers/item:ub1?scope=family" "{\"value\":{\"id\":\"ub1\",\"name\":\"Stew\",\"dateLogged\":\"$TODAY\",\"useBy\":\"2099-01-01\",\"portion\":\"some\",\"by\":\"niece\",\"editedBy\":\"niece\",\"editedByName\":\"Mea\",\"editedAt\":1790000000000}}" "$D" "$N"; expect 200
call "a Larder row with a past use-by -> 200" PUT "/api/data/leftovers/item:ub1?scope=family" "{\"value\":{\"id\":\"ub1\",\"name\":\"Stew\",\"dateLogged\":\"$TODAY\",\"useBy\":\"$OLD\"}}" "$D" "$N"; expect 200
call "a use-by that is not a day -> 403" PUT "/api/data/leftovers/item:ub2?scope=family" "{\"value\":{\"id\":\"ub2\",\"name\":\"Stew\",\"dateLogged\":\"$TODAY\",\"useBy\":\"soon\"}}" "$D" "$N"; expect 403
echo "$BODY" | grep -q '"rejected":"bad_date"' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected rejected bad_date"; }
call "a use-by of 2026-02-30 -> 403" PUT "/api/data/leftovers/item:ub2?scope=family" "{\"value\":{\"id\":\"ub2\",\"name\":\"Stew\",\"dateLogged\":\"$TODAY\",\"useBy\":\"2026-02-30\"}}" "$D" "$N"; expect 403
call "portion 'half' -> 403" PUT "/api/data/leftovers/item:ub2?scope=family" "{\"value\":{\"id\":\"ub2\",\"name\":\"Stew\",\"dateLogged\":\"$TODAY\",\"portion\":\"half\"}}" "$D" "$N"; expect 403
echo "$BODY" | grep -q '"rejected":"bad_value"' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected rejected bad_value"; }
call "editedBy someone else -> 403" PUT "/api/data/leftovers/item:ub2?scope=family" "{\"value\":{\"id\":\"ub2\",\"name\":\"Stew\",\"dateLogged\":\"$TODAY\",\"editedBy\":\"eli\",\"editedAt\":1790000000000}}" "$D" "$N"; expect 403
call "editedAt that is not a time -> 403" PUT "/api/data/leftovers/item:ub2?scope=family" "{\"value\":{\"id\":\"ub2\",\"name\":\"Stew\",\"dateLogged\":\"$TODAY\",\"editedBy\":\"niece\",\"editedAt\":\"yesterday\"}}" "$D" "$N"; expect 403
call "the kitchen edits an item and keeps its logger -> 200" PUT "/api/data/leftovers/item:ub1?scope=family" "{\"value\":{\"id\":\"ub1\",\"name\":\"Stew (big)\",\"dateLogged\":\"$TODAY\",\"by\":\"niece\",\"byName\":\"Mea\",\"portion\":\"some\",\"editedBy\":\"kitchen\",\"editedByName\":\"Kitchen\",\"editedAt\":1790000000001}}" "$DKH" "$KT"; expect 200
call "an Undo written as its own editor over someone else's edit -> 200" PUT "/api/data/leftovers/item:ub1?scope=family" "{\"value\":{\"id\":\"ub1\",\"name\":\"Stew (big)\",\"dateLogged\":\"$TODAY\",\"by\":\"niece\",\"byName\":\"Mea\",\"editedBy\":\"niece\",\"editedByName\":\"Mea\",\"editedAt\":1790000000002}}" "$D" "$N"; expect 200
call "a Larder row that still names someone else as editor -> 403" PUT "/api/data/leftovers/item:ub1?scope=family" "{\"value\":{\"id\":\"ub1\",\"name\":\"Stew\",\"dateLogged\":\"$TODAY\",\"by\":\"niece\",\"editedBy\":\"kitchen\",\"editedAt\":1790000000003}}" "$D" "$N"; expect 403
call "a kid cannot edit a Larder item -> 403" PUT "/api/data/leftovers/item:ub1?scope=family" "{\"value\":{\"id\":\"ub1\",\"name\":\"x\",\"dateLogged\":\"$TODAY\"}}" "$D" "$K"; expect 403
call "tidy the edited row" DELETE "/api/data/leftovers/item:ub1?scope=family" '' "$D" "$N"; expect 200
call "kitchen feed line for a kid on the Larder -> 403" POST /api/activity '{"app_id":"leftovers","text":"Finished soup","as":"ezra"}' "$DKH" "$KT"; expect 403
call "kitchen feed line for an adult" POST /api/activity '{"app_id":"leftovers","text":"Finished soup","as":"niece"}' "$DKH" "$KT"; expect 200
[ "$(echo "$BODY" | j profile_id)" = niece ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected the line filed under niece"; }
call "kitchen credits the TV -> 403" POST /api/activity '{"app_id":"prayer","text":"x","as":"tv"}' "$DKH" "$KT"; expect 403
call "kitchen writes its own timer" PUT "/api/data/timer/timer.active?scope=person" '{"value":{"endAt":1}}' "$DKH" "$KT"; expect 200
call "kitchen writes a person app -> 403" PUT "/api/data/f260/week?scope=person" '{"value":3}' "$DKH" "$KT"; expect 403
call "kitchen writes its own timer mirror (batch 6)" PUT "/api/data/timer/run:kitchen:k1?scope=family" '{"value":{"total":60000,"endAt":1,"startedAt":1}}' "$DKH" "$KT"; expect 200
call "kitchen writes a person's timer mirror -> 403" PUT "/api/data/timer/run:niece:k1?scope=family" '{"value":{"total":1}}' "$DKH" "$KT"; expect 403
call "kitchen clears its own timer mirror" DELETE "/api/data/timer/run:kitchen:k1?scope=family" '' "$DKH" "$KT"; expect 200
call "kitchen chat -> 403" POST /api/chat '{"message":"hi"}' "$DKH" "$KT"; expect 403
call "kitchen push subscription -> 403" POST /api/push/subscribe '{"subscription":{"endpoint":"https://push.example/k"}}' "$DKH" "$KT"; expect 403
call "kitchen admin call -> 403" GET /api/admin/usage '' "$DKH" "$KT"; expect 403
call "reset PIN refuses the kitchen -> 400" POST /api/admin/profiles/kitchen/reset-pin '{}' "$D" "$A"; expect 400
call "admin renames the kitchen -> 400" PUT /api/admin/profiles/kitchen '{"name":"Cook"}' "$D" "$A"; expect 400
call "admin recolours the kitchen" PUT /api/admin/profiles/kitchen '{"color":"#5E7A6E","hue":"seafoam"}' "$D" "$A"; expect 200
call "admin makes a profile the kitchen -> 400" PUT /api/admin/profiles/niece '{"kind":"kitchen"}' "$D" "$A"; expect 400
call "admin clears the role" PUT "/api/admin/devices/$DKID/role" "{\"role\":null,\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
call "the old kitchen session -> 401" GET "/api/data/leftovers?scope=family" '' "$DKH" "$KT"; expect 401
call "the device has no role now" GET /api/device '' "$DKH"; expect 200
[ "$(echo "$BODY" | j role)" = null ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected role=null"; }
call "unpair the test kitchen device" DELETE "/api/admin/devices/$DKID" '' "$D" "$A"; expect 200
call "tidy the kitchen's row" DELETE "/api/data/leftovers/item:kt1?scope=family" '' "$D" "$N"; expect 200

echo "### batch 7: a parent's recorded voice (IMP-KIDVERSE-I2) — private audio, adults only, bytes deleted with the recording"
# D1_PERSIST (optional): the --persist-to folder of the local Worker; with it the media table is read to prove the bytes are gone
VD=$(mktemp -d); trap 'rm -rf "$VD"' EXIT
{ printf '\x1a\x45\xdf\xa3'; head -c 4000 /dev/zero; } > "$VD/ok.webm"
{ printf '\x00\x00\x00\x18ftypmp42'; head -c 3000 /dev/zero; } > "$VD/ok.mp4"
{ printf 'OggS'; head -c 2000 /dev/zero; } > "$VD/ok.ogg"
{ printf 'ID3'; head -c 2000 /dev/zero; } > "$VD/ok.mp3"
echo "this is not audio at all" > "$VD/fake.webm"
{ printf '\x1a\x45\xdf\xa3'; head -c 1048572 /dev/zero; } > "$VD/limit.webm"     # exactly 1 MB (1048576 bytes)
{ printf '\x1a\x45\xdf\xa3'; head -c 1048573 /dev/zero; } > "$VD/over.webm"      # one byte over
vcall() { # vcall NAME METHOD PATH CONTENT-TYPE FILE [HEADERS...]
  local name=$1 method=$2 path=$3 ctype=$4 file=$5; shift 5
  local out; out=$(curl -s -w '\n%{http_code}' -X "$method" "$BASE$path" -H "Origin: $ORIGIN" -H "Content-Type: $ctype" "${@/#/-H}" --data-binary @"$file")
  STATUS=${out##*$'\n'}; BODY=${out%$'\n'*}
  printf '%-44s %s %s\n' "$name" "$STATUS" "$(echo "$BODY" | cut -c1-150)"
}
voice_bytes() { # voice_bytes WEEK -> how many stored recordings are left under voice/WEEK/ (needs D1_PERSIST), or "?"
  [ -n "${D1_PERSIST:-}" ] || { echo '?'; return; }
  ( cd "$(dirname "$0")/../worker" && npx wrangler d1 execute house-hub --local --persist-to "$D1_PERSIST" --json --command "SELECT COUNT(*) AS n FROM media WHERE key LIKE 'voice/$1/%'" 2>/dev/null | j 0.results.0.n )
}
expect_bytes() { local got; got=$(voice_bytes "$1"); if [ "$got" = '?' ]; then echo "   (D1_PERSIST not set: stored bytes not counted)"; elif [ "$got" = "$2" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "   ^^^ expected $2 stored recording(s) for week $1, found $got"; fi; }
# a guest, the kitchen device, and the kid and TV tokens from above
call "a guest to test with" POST /api/profiles '{"name":"Voice Guest"}' "$D" "$N"; expect 200
VGID=$(echo "$BODY" | j profile.id)
VG="X-Profile-Token: $(curl -s -X POST "$BASE/api/login" -H "$D" -H 'Content-Type: application/json' --data "{\"profile_id\":\"$VGID\"}" | j profile_token)"
VDK=$(curl -s -X POST "$BASE/api/pair" -H 'Content-Type: application/json' --data "{\"code\":\"$CODE\",\"name\":\"smoke voice kitchen\"}"); VDKT=$(echo "$VDK" | j device_token); VDKID=$(echo "$VDK" | j device_id); VKH="X-Device-Token: $VDKT"
call "admin makes a device the kitchen" PUT "/api/admin/devices/$VDKID/role" "{\"role\":\"kitchen\",\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
call "the kitchen signs in" POST /api/login '{"profile_id":"kitchen"}' "$VKH"; expect 200
VKT="X-Profile-Token: $(echo "$BODY" | j profile_token)"
vcall "no profile uploads -> 401" POST "/api/kidverse/voice/38?ms=4000" audio/webm "$VD/ok.webm" "$D"; expect 401
vcall "a kid uploads -> 403" POST "/api/kidverse/voice/38?ms=4000" audio/webm "$VD/ok.webm" "$D" "$K"; expect 403
[ "$(echo "$BODY" | j error)" = adults_only ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=adults_only"; }
vcall "the TV uploads -> 403" POST "/api/kidverse/voice/38?ms=4000" audio/webm "$VD/ok.webm" "$D" "X-Profile-Token: $TV"; expect 403
vcall "a guest uploads -> 403" POST "/api/kidverse/voice/38?ms=4000" audio/webm "$VD/ok.webm" "$D" "$VG"; expect 403
[ "$(echo "$BODY" | j error)" = adults_only ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=adults_only"; }
vcall "the kitchen uploads -> 403" POST "/api/kidverse/voice/38?ms=4000" audio/webm "$VD/ok.webm" "$VKH" "$VKT"; expect 403
expect_bytes 38 0
vcall "week 0 -> 400" POST "/api/kidverse/voice/0?ms=4000" audio/webm "$VD/ok.webm" "$D" "$N"; expect 400
vcall "week 53 -> 400" POST "/api/kidverse/voice/53?ms=4000" audio/webm "$VD/ok.webm" "$D" "$N"; expect 400
vcall "week abc -> 400" POST "/api/kidverse/voice/abc?ms=4000" audio/webm "$VD/ok.webm" "$D" "$N"; expect 400
vcall "week 038 (not a plain number) -> 400" POST "/api/kidverse/voice/038?ms=4000" audio/webm "$VD/ok.webm" "$D" "$N"; expect 400
vcall "a text type -> 415" POST "/api/kidverse/voice/38?ms=4000" text/plain "$VD/ok.webm" "$D" "$N"; expect 415
vcall "audio/wav -> 415" POST "/api/kidverse/voice/38?ms=4000" audio/wav "$VD/ok.webm" "$D" "$N"; expect 415
vcall "audio/webm that is not audio -> 415" POST "/api/kidverse/voice/38?ms=4000" audio/webm "$VD/fake.webm" "$D" "$N"; expect 415
vcall "mp4 type over webm bytes -> 415" POST "/api/kidverse/voice/38?ms=4000" audio/mp4 "$VD/ok.webm" "$D" "$N"; expect 415
vcall "no length -> 400" POST "/api/kidverse/voice/38" audio/webm "$VD/ok.webm" "$D" "$N"; expect 400
vcall "91 seconds -> 413" POST "/api/kidverse/voice/38?ms=91000" audio/webm "$VD/ok.webm" "$D" "$N"; expect 413
vcall "one byte over 1 MB -> 413" POST "/api/kidverse/voice/38?ms=60000" audio/webm "$VD/over.webm" "$D" "$N"; expect 413
expect_bytes 38 0
vcall "exactly 1 MB and 90 s is fine" POST "/api/kidverse/voice/41?ms=90000" "audio/webm;codecs=opus" "$VD/limit.webm" "$D" "$N"; expect 200
expect_bytes 41 1
call "tidy the 1 MB recording" DELETE /api/kidverse/voice/41 '' "$D" "$N"; expect 200
expect_bytes 41 0
vcall "an adult records week 38 (codecs allowed)" POST "/api/kidverse/voice/38?ms=4200" "audio/webm;codecs=opus" "$VD/ok.webm" "$D" "$N"; expect 200
V1=$(echo "$BODY" | j voice.id)
[ "$(echo "$BODY" | j voice.by)" = niece ] && [ "$(echo "$BODY" | j voice.mime)" = audio/webm ] && [ "$(echo "$BODY" | j voice.ms)" = 4200 ] && [ "$(echo "$BODY" | j voice.bytes)" = 4004 ] && [ "$(echo "$BODY" | j replaced)" = null ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected by=niece mime=audio/webm ms=4200 bytes=4004 replaced=null"; }
expect_bytes 38 1
# the family row is the Worker's; it says who recorded it and carries no URL
call "the row is there for the house" GET "/api/data/kidverse?scope=family&key=voice:38" '' "$D" "$K"; expect 200
[ "$(echo "$BODY" | j item.value.id)" = "$V1" ] && ! echo "$BODY" | grep -qi 'http\|/api/media' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected the row with the id and no URL"; }
# it is private: a signed-in profile of any kind may hear it, nobody else may
get_voice() { curl -s -D "$VD/h.txt" -o "$VD/got.bin" -w '%{http_code}' "$BASE/api/kidverse/voice/$1/$2" -H "Origin: $ORIGIN" "${@:3}"; }
for W in "a kid|$K" "the TV|X-Profile-Token: $TV" "a guest|$VG" "an adult|$N"; do
  [ "$(get_voice 38 "$V1" -H "$D" -H "${W#*|}")" = 200 ] && cmp -s "$VD/got.bin" "$VD/ok.webm" && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected ${W%%|*} to get the 4004 bytes back"; }
done
[ "$(get_voice 38 "$V1" -H "$VKH" -H "$VKT")" = 200 ] && cmp -s "$VD/got.bin" "$VD/ok.webm" && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected the kitchen to hear it"; }
grep -qi '^content-type: audio/webm' "$VD/h.txt" && grep -qi '^cache-control: private, no-store' "$VD/h.txt" && ! grep -qi '^access-control-allow-origin: \*' "$VD/h.txt" && grep -qi "^access-control-allow-origin: $ORIGIN" "$VD/h.txt" && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected audio/webm, private no-store, and CORS only for the caller's origin"; }
[ "$(get_voice 38 "$V1" -H "$D")" = 401 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ a paired device with no profile must not hear it (expected 401)"; }
[ "$(get_voice 38 "$V1")" = 401 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ no tokens at all must not hear it (expected 401)"; }
[ "$(get_voice 38 "$V1" -H "X-Device-Token: $DT2" -H "$N")" = 401 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ a session token on another device must not hear it (expected 401)"; }
[ "$(get_voice 38 wrongid -H "$D" -H "$K")" = 404 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ a wrong id should be 404"; }
[ "$(get_voice 39 "$V1" -H "$D" -H "$K")" = 404 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ the id under another week should be 404"; }
# unlike photos, the public media route never serves it
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/media/voice/38/$V1")" = 404 ] && [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/media/voice/38/$V1.webm")" = 404 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ GET /api/media/voice/… must be 404 with no tokens"; }
# a client can never write, change or clear the row (policy.js: the Worker alone writes voice:<week>)
call "an adult writes voice:38 -> 403" PUT "/api/data/kidverse/voice:38?scope=family" '{"value":{"id":"x","by":"niece"}}' "$D" "$N"; expect 403
echo "$BODY" | grep -q '"rejected":"worker_only"' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected rejected worker_only"; }
call "the admin writes voice:39 -> 403" PUT "/api/data/kidverse/voice:39?scope=family" '{"value":{"id":"x","by":"eli"}}' "$D" "$A"; expect 403
call "casing is no way round: VOICE:38 -> 403" PUT "/api/data/kidverse/VOICE:38?scope=family" '{"value":{"id":"x"}}' "$D" "$N"; expect 403
call "clearing the row through the data API -> 403" DELETE "/api/data/kidverse/voice:38?scope=family" '' "$D" "$N"; expect 403
call "a batch's voice row comes back refused" POST "/api/data/kidverse/batch?scope=family" '{"items":[{"key":"voice:38","value":null,"updated_at":'$(date +%s000)'}]}' "$D" "$N"; expect 200
[ "$(echo "$BODY" | j results.0.rejected)" = worker_only ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected results.0.rejected=worker_only"; }
call "a kid writes a voice row -> 403" PUT "/api/data/kidverse/voice:38?scope=family" '{"value":{"id":"x"}}' "$D" "$K"; expect 403
call "the row is untouched" GET "/api/data/kidverse?scope=family&key=voice:38" '' "$D" "$K"; expect 200
[ "$(echo "$BODY" | j item.value.id)" = "$V1" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected the recording to be intact"; }
# one recording per week: saving over it replaces it, and the old bytes are deleted
vcall "another adult replaces it (mp4)" POST "/api/kidverse/voice/38?ms=3000" audio/mp4 "$VD/ok.mp4" "$D" "$A"; expect 200
V2=$(echo "$BODY" | j voice.id)
[ "$V2" != "$V1" ] && [ "$(echo "$BODY" | j replaced.by)" = niece ] && [ "$(echo "$BODY" | j voice.by)" = eli ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected a new id, by eli, replaced.by niece"; }
expect_bytes 38 1
[ "$(get_voice 38 "$V1" -H "$D" -H "$K")" = 404 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ the replaced recording must be gone (404)"; }
[ "$(get_voice 38 "$V2" -H "$D" -H "$K")" = 200 ] && grep -qi '^content-type: audio/mp4' "$VD/h.txt" && cmp -s "$VD/got.bin" "$VD/ok.mp4" && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected the new mp4 recording"; }
vcall "ogg is accepted (week 39)" POST "/api/kidverse/voice/39?ms=2000" audio/ogg "$VD/ok.ogg" "$D" "$N"; expect 200
vcall "mp3 is accepted (week 40)" POST "/api/kidverse/voice/40?ms=2000" audio/mpeg "$VD/ok.mp3" "$D" "$N"; expect 200
call "tidy week 39" DELETE /api/kidverse/voice/39 '' "$D" "$N"; expect 200
call "tidy week 40" DELETE /api/kidverse/voice/40 '' "$D" "$N"; expect 200
# removing
call "a kid removes it -> 403" DELETE /api/kidverse/voice/38 '' "$D" "$K"; expect 403
call "the TV removes it -> 403" DELETE /api/kidverse/voice/38 '' "$D" "X-Profile-Token: $TV"; expect 403
call "a guest removes it -> 403" DELETE /api/kidverse/voice/38 '' "$D" "$VG"; expect 403
call "the kitchen removes it -> 403" DELETE /api/kidverse/voice/38 '' "$VKH" "$VKT"; expect 403
call "no profile removes it -> 401" DELETE /api/kidverse/voice/38 '' "$D"; expect 401
expect_bytes 38 1
call "an adult removes it" DELETE /api/kidverse/voice/38 '' "$D" "$N"; expect 200
expect_bytes 38 0
call "removing it again -> 404" DELETE /api/kidverse/voice/38 '' "$D" "$N"; expect 404
[ "$(get_voice 38 "$V2" -H "$D" -H "$K")" = 404 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ a removed recording must be gone (404)"; }
call "the row is a tombstone for every device" GET "/api/data/kidverse?scope=family&prefix=voice:" '' "$D" "$K"; expect 200
echo "$BODY" | grep -q '"key":"voice:38","value":null' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected voice:38 with value null"; }
# a person who is removed takes their recordings with them
call "admin adds an adult to record" POST /api/admin/profiles "{\"name\":\"Voice Temp\",\"kind\":\"adult\",\"hue\":\"coral\",\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
VTID=$(echo "$BODY" | j profile.id); VTCODE=$(echo "$BODY" | j setup_code)
call "…creates a PIN with the set-up code" POST "/api/profiles/$VTID/pin" "{\"pin\":\"3579\",\"code\":\"$VTCODE\"}" "$D"; expect 200
VTT="X-Profile-Token: $(echo "$BODY" | j profile_token)"
vcall "…and records week 42" POST "/api/kidverse/voice/42?ms=2500" audio/webm "$VD/ok.webm" "$D" "$VTT"; expect 200
expect_bytes 42 1
call "admin removes that person" POST "/api/admin/profiles/$VTID/remove" "{\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
expect_bytes 42 0
call "their recording's row is cleared" GET "/api/data/kidverse?scope=family&key=voice:42" '' "$D" "$K"; expect 200
[ "$(echo "$BODY" | j item.value)" = null ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected voice:42 cleared with its person"; }
call "remove the voice guest" DELETE "/api/admin/profiles/$VGID" '' "$D" "$A"; expect 200
call "admin clears the voice kitchen" PUT "/api/admin/devices/$VDKID/role" "{\"role\":null,\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
call "unpair the voice kitchen device" DELETE "/api/admin/devices/$VDKID" '' "$D" "$A"; expect 200

echo "### batch 2a: Admin → Household (GAP-PROF-a2) and the 18 colour families (GAP-ACCENT-1)"
call "a non-admin adds a person -> 403" POST /api/admin/profiles '{"name":"Nope","kind":"adult","hue":"mint"}' "$D" "$N"; expect 403
call "add a person with an unknown family -> 400" POST /api/admin/profiles '{"name":"Nope","kind":"adult","hue":"neon"}' "$D" "$A"; expect 400
call "add a person as a display -> 400" POST /api/admin/profiles '{"name":"Nope","kind":"kiosk","hue":"mint"}' "$D" "$A"; expect 400
call "add a person with markup -> 400" POST /api/admin/profiles '{"name":"<b>x</b>","kind":"adult","hue":"mint"}' "$D" "$A"; expect 400
call "add a person without the admin PIN -> 403" POST /api/admin/profiles '{"name":"Smoke Person","kind":"adult","hue":"coral"}' "$D" "$A"; expect 403
[ "$(echo "$BODY" | j error)" = wrong_admin_pin ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=wrong_admin_pin"; }
call "add a person with a wrong admin PIN -> 403" POST /api/admin/profiles '{"name":"Smoke Person","kind":"adult","hue":"coral","admin_pin":"0000"}' "$D" "$A"; expect 403
call "admin adds an adult (an app colour)" POST /api/admin/profiles "{\"name\":\"Smoke Person\",\"kind\":\"adult\",\"hue\":\"coral\",\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
HP=$(echo "$BODY" | j profile.id)
[ "$HP" = smoke-person ] && [ "$(echo "$BODY" | j profile.hue)" = coral ] && echo "$BODY" | j setup_code | grep -Eq '^[0-9]{6}$' && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected id smoke-person, hue coral and a six-digit set-up code"; }
call "the new adult cannot create a PIN without the code -> 403" POST "/api/profiles/$HP/pin" '{"pin":"1122"}' "$D"; expect 403
call "admin adds a kid" POST /api/admin/profiles "{\"name\":\"Smoke Kid\",\"kind\":\"kid\",\"hue\":\"honey\",\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
HK=$(echo "$BODY" | j profile.id)
[ "$(echo "$BODY" | j setup_code)" = undefined ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ a kid gets no set-up code"; }
call "the new kid signs in on tap" POST /api/login "{\"profile_id\":\"$HK\"}" "$D"; expect 200
HKT="X-Profile-Token: $(echo "$BODY" | j profile_token)"
call "a kid cannot be an admin -> 400" PUT "/api/admin/profiles/$HK/admin" "{\"is_admin\":true,\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 400
call "an adult with no PIN cannot be an admin -> 400" PUT "/api/admin/profiles/$HP/admin" "{\"is_admin\":true,\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 400
[ "$(echo "$BODY" | j error)" = needs_pin ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=needs_pin"; }
call "make Mea an admin, wrong PIN -> 403" PUT /api/admin/profiles/niece/admin '{"is_admin":true,"admin_pin":"0000"}' "$D" "$A"; expect 403
call "make Mea an admin" PUT /api/admin/profiles/niece/admin "{\"is_admin\":true,\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
call "Mea now reaches the admin API" GET /api/admin/usage '' "$D" "$N"; expect 200
call "reset a co-admin's PIN without the admin PIN -> 403" POST /api/admin/profiles/niece/reset-pin '{}' "$D" "$A"; expect 403
[ "$(echo "$BODY" | j error)" = wrong_admin_pin ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=wrong_admin_pin"; }
call "…with a wrong admin PIN -> 403" POST /api/admin/profiles/niece/reset-pin '{"admin_pin":"0000"}' "$D" "$A"; expect 403
call "Mea still signs in (nothing was reset)" POST /api/login '{"profile_id":"niece","pin":"2468"}' "$D"; expect 200
call "removing an admin -> 400" POST /api/admin/profiles/niece/remove "{\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 400
call "take Mea's admin away" PUT /api/admin/profiles/niece/admin "{\"is_admin\":false,\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
call "Mea is refused the admin API again" GET /api/admin/usage '' "$D" "$N"; expect 403
call "the last admin cannot drop it -> 400" PUT /api/admin/profiles/eli/admin "{\"is_admin\":false,\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 400
[ "$(echo "$BODY" | j error)" = last_admin ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected error=last_admin"; }
call "Eli hands his admin to Mea" PUT /api/admin/profiles/niece/admin "{\"is_admin\":true,\"transfer\":true,\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
call "Eli is refused the admin API now" GET /api/admin/usage '' "$D" "$A"; expect 403
call "Mea hands it back (her own PIN)" PUT /api/admin/profiles/eli/admin '{"is_admin":true,"transfer":true,"admin_pin":"2468"}' "$D" "$N"; expect 200
call "Eli is the admin again" GET /api/admin/usage '' "$D" "$A"; expect 200
call "Mea is not" GET /api/admin/usage '' "$D" "$N"; expect 403
call "a non-admin removes a person -> 403" POST "/api/admin/profiles/$HK/remove" '{"admin_pin":"2468"}' "$D" "$N"; expect 403
call "the admin removes himself -> 400" POST /api/admin/profiles/eli/remove "{\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 400
call "remove the TV -> 400" POST /api/admin/profiles/tv/remove "{\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 400
call "remove the kitchen -> 400" POST /api/admin/profiles/kitchen/remove "{\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 400
call "remove the new kid, wrong PIN -> 403" POST "/api/admin/profiles/$HK/remove" '{"admin_pin":"0000"}' "$D" "$A"; expect 403
call "remove the new kid" POST "/api/admin/profiles/$HK/remove" "{\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
call "add the same name again" POST /api/admin/profiles "{\"name\":\"Smoke Kid\",\"kind\":\"kid\",\"hue\":\"honey\",\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
HK2=$(echo "$BODY" | j profile.id)
[ -n "$HK2" ] && [ "$HK2" != "$HK" ] && [ "$HK2" != undefined ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected a new id, not $HK (a removed person's id is never reused)"; }
call "remove the re-added kid" POST "/api/admin/profiles/$HK2/remove" "{\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
call "a taken name gets a new id (a second Ezra)" POST /api/admin/profiles "{\"name\":\"Ezra\",\"kind\":\"kid\",\"hue\":\"honey\",\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
HK3=$(echo "$BODY" | j profile.id)
[ "$HK3" != ezra ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected an id other than ezra"; }
call "remove the second Ezra" POST "/api/admin/profiles/$HK3/remove" "{\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
call "the removed kid's session -> 401" GET /api/me '' "$D" "$HKT"; expect 401
call "remove the new adult" POST "/api/admin/profiles/$HP/remove" "{\"admin_pin\":\"$AP\"}" "$D" "$A"; expect 200
call "both are gone from the list" GET /api/profiles '' "$D" "$A"; expect 200
! echo "$BODY" | grep -q "\"$HK\"\|\"$HP\"" && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected neither $HK nor $HP"; }

call "admin reset niece pin (cleanup)" POST /api/admin/profiles/niece/reset-pin '{}' "$D" "$A"; expect 200

echo "### CORS"
out=$(curl -s -D - -o /dev/null -X OPTIONS "$BASE/api/profiles" -H "Origin: $ORIGIN" -H 'Access-Control-Request-Method: GET')
echo "$out" | grep -qi "access-control-allow-origin: $ORIGIN" && { pass=$((pass+1)); echo "preflight allows $ORIGIN"; } || { fail=$((fail+1)); echo "preflight MISSING allow-origin for $ORIGIN"; }
out=$(curl -s -D - -o /dev/null -X OPTIONS "$BASE/api/profiles" -H "Origin: https://evil.example" -H 'Access-Control-Request-Method: GET')
echo "$out" | grep -qi "access-control-allow-origin" && { fail=$((fail+1)); echo "preflight WRONGLY allows evil.example"; } || { pass=$((pass+1)); echo "preflight blocks evil.example"; }


echo; echo "PASS $pass  FAIL $fail"
[ "$fail" = 0 ]
