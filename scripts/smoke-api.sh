#!/usr/bin/env bash
# End-to-end smoke test of the House Hub API.
#   scripts/smoke-api.sh http://127.0.0.1:8787 <pairing-code> [house-key]
# Uses a throwaway PIN for the Niece profile and resets it again at the end (admin call). Since batch 0d a reset leaves
# Niece waiting for a one-time code (printed by the last reset), so run it against a local Worker, not the live one.
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
# an expired guest stops receiving push: ending the stay drops their sessions and subscriptions
call "guest subscribes to push" POST /api/push/subscribe '{"subscription":{"endpoint":"https://push.example/guest","keys":{"p256dh":"x","auth":"y"}}}' "$D" "$GT"; expect 200
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
call "key casing is no way round: LOC:kiara by a kid -> 403" PUT "/api/data/dollywood-live/LOC:kiara?scope=family" '{"value":{"x":1,"y":2,"t":1}}' "$D" "$K"; expect 403
TODAY=$(TZ=America/New_York date +%F); OLD=$(TZ=America/New_York date -d '-10 days' +%F)
call "an adult adds a family prayer Kiara prayed" PUT "/api/data/prayer/prayer:smk1?scope=family" "{\"value\":{\"id\":\"smk1\",\"title\":\"Smoke\",\"status\":\"active\",\"prayedBy\":{\"$TODAY\":[\"Kiara\"]}},\"updated_at\":$NOW}" "$D" "$N"; expect 200
call "kid's stale tick (no Kiara, new title, backdated day) is merged" PUT "/api/data/prayer/prayer:smk1?scope=family" "{\"value\":{\"id\":\"smk1\",\"title\":\"Hacked\",\"status\":\"active\",\"prayedBy\":{\"$TODAY\":[\"Ezra\"],\"$OLD\":[\"Ezra\"]}},\"updated_at\":$((NOW+1))}" "$D" "$K"; expect 200
call "the house keeps Kiara and the title, Ezra today only" GET "/api/data/prayer?scope=family&key=prayer:smk1" '' "$D" "$N"; expect 200
[ "$(echo "$BODY" | j item.value.title)" = Smoke ] && echo "$BODY" | grep -q "\"$TODAY\":\[\"Kiara\",\"Ezra\"\]" && ! echo "$BODY" | grep -q "\"$OLD\"" && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected title Smoke, today [Kiara, Ezra], no backdated day"; }
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
call "kitchen writes the Larder" PUT "/api/data/leftovers/item:kt1?scope=family" '{"value":{"id":"kt1","name":"Soup","by":"kitchen"}}' "$DKH" "$KT"; expect 200
call "kitchen names a kid on a Larder row -> 403" PUT "/api/data/leftovers/item:kt2?scope=family" '{"value":{"id":"kt2","name":"Soup","by":"ezra","byName":"Ezra"}}' "$DKH" "$KT"; expect 403
call "kitchen feed line for a kid on the Larder -> 403" POST /api/activity '{"app_id":"leftovers","text":"Finished soup","as":"ezra"}' "$DKH" "$KT"; expect 403
call "kitchen feed line for an adult" POST /api/activity '{"app_id":"leftovers","text":"Finished soup","as":"niece"}' "$DKH" "$KT"; expect 200
[ "$(echo "$BODY" | j profile_id)" = niece ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "   ^^^ expected the line filed under niece"; }
call "kitchen credits the TV -> 403" POST /api/activity '{"app_id":"prayer","text":"x","as":"tv"}' "$DKH" "$KT"; expect 403
call "kitchen writes its own timer" PUT "/api/data/timer/timer.active?scope=person" '{"value":{"endAt":1}}' "$DKH" "$KT"; expect 200
call "kitchen writes a person app -> 403" PUT "/api/data/f260/week?scope=person" '{"value":3}' "$DKH" "$KT"; expect 403
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

call "admin reset niece pin (cleanup)" POST /api/admin/profiles/niece/reset-pin '{}' "$D" "$A"; expect 200

echo "### CORS"
out=$(curl -s -D - -o /dev/null -X OPTIONS "$BASE/api/profiles" -H "Origin: $ORIGIN" -H 'Access-Control-Request-Method: GET')
echo "$out" | grep -qi "access-control-allow-origin: $ORIGIN" && { pass=$((pass+1)); echo "preflight allows $ORIGIN"; } || { fail=$((fail+1)); echo "preflight MISSING allow-origin for $ORIGIN"; }
out=$(curl -s -D - -o /dev/null -X OPTIONS "$BASE/api/profiles" -H "Origin: https://evil.example" -H 'Access-Control-Request-Method: GET')
echo "$out" | grep -qi "access-control-allow-origin" && { fail=$((fail+1)); echo "preflight WRONGLY allows evil.example"; } || { pass=$((pass+1)); echo "preflight blocks evil.example"; }


echo; echo "PASS $pass  FAIL $fail"
[ "$fail" = 0 ]
