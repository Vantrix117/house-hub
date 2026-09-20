#!/usr/bin/env bash
# Walks /api/chat through every tool and guard. Prints the SSE stream of each call and asserts the expected
# chip / refusal appears in it; exits non-zero on any miss.
#   scripts/smoke-chat.sh http://127.0.0.1:8787 <pairing-code>          (local, against scripts/mock-anthropic.mjs or a real key)
#   scripts/smoke-chat.sh https://house-hub-api.… <pairing-code> <eli-pin>   (live; needs an adult PIN to sign in)
# The trigger phrases below are the ones scripts/mock-anthropic.mjs understands; a real model gets the same messages.
set -u
BASE=${1:?base}; CODE=${2:?pairing code}; PIN=${3:-}; P=${PROFILE:-eli}   # PROFILE=niece to use another adult
J() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a==null?a:a[k],o))})" "$1"; }
APPS='[{"id":"f260","name":"F260","scope":"person","visibleTo":["eli","christian","mom","dad","niece"]},{"id":"leftovers","name":"Larder Ledger","scope":"family"},{"id":"prayer","name":"Prayer","scope":"both","visibleTo":["eli","christian","mom","dad","niece"]},{"id":"tally","name":"Tally","scope":"person"},{"id":"timer","name":"Timer","scope":"person"},{"id":"dollywood-live","name":"Dollywood Live","scope":"both"}]'
RUN=$(date +%s | tail -c 6)           # unique suffix so re-runs against a used database never hit ambiguous matches
OUT=$(mktemp); FAIL=0; PASS=0
tok() { case "$1" in ezra) echo "$K";; tv) echo "$TV";; *) echo "$A";; esac; }
post() { curl -s -N -X POST "$BASE/api/chat" -H "X-Device-Token: $DT" -H "X-Profile-Token: $(tok "$1")" -H 'Content-Type: application/json' \
    --data "$(node -e 'console.log(JSON.stringify({message: process.argv[1], apps: JSON.parse(process.argv[2])}))' "$2" "$APPS")" > "$OUT"; }
chat() { # chat PROFILE_ID "message"   → prints the stream, keeps the full stream in $OUT for expect
  printf '\n>>> %s\n' "$2"
  post "$1" "$2"
  if grep -qE 'device_not_paired|profile_session_invalid' "$OUT"; then echo "    (session lost — the local database was reset under us; re-pairing and retrying once)"; signin; post "$1" "$2"; fi
  grep -vE "^(event|data):|^$" "$OUT" | sed 's/^/    http: /' | cut -c1-220
  # the reply is streamed a word at a time; append it reassembled as one "reply:" line so expect can grep whole phrases
  node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");let t="";for(const l of s.split("\n"))if(l.startsWith("data:")){try{const d=JSON.parse(l.slice(5));if(typeof d.text==="string")t+=d.text}catch{}}require("fs").appendFileSync(process.argv[1],"\nreply: "+t.replace(/\s+/g," ").trim()+"\n")' "$OUT"
  grep -E "^(event|data|reply):" "$OUT" | sed 's/^/    /' | cut -c1-220
}
expect() { # expect "description" "grep -E pattern"   (against the last stream)
  if grep -qiE -- "$2" "$OUT"; then PASS=$((PASS+1)); printf '    ok   %s\n' "$1"; else FAIL=$((FAIL+1)); printf '    MISS %s  (wanted /%s/)\n' "$1" "$2"; fi
}
reject() { # reject "description" "grep -E pattern"   (must NOT appear in the last stream)
  if grep -qiE -- "$2" "$OUT"; then FAIL=$((FAIL+1)); printf '    MISS %s  (found /%s/)\n' "$1" "$2"; else PASS=$((PASS+1)); printf '    ok   %s\n' "$1"; fi
}
put() { # put PROFILE_ID app scope key json-value   (seed a row the way an app would)
  curl -s -X PUT "$BASE/api/data/$2/$4?scope=$3" -H "X-Device-Token: $DT" -H "X-Profile-Token: $(tok "$1")" -H 'Content-Type: application/json' \
    --data "{\"value\":$5,\"updated_at\":$(date +%s)000}" > "$OUT"
  if grep -qE 'device_not_paired|profile_session_invalid' "$OUT"; then signin; curl -s -X PUT "$BASE/api/data/$2/$4?scope=$3" -H "X-Device-Token: $DT" -H "X-Profile-Token: $(tok "$1")" -H 'Content-Type: application/json' --data "{\"value\":$5,\"updated_at\":$(date +%s)000}" > /dev/null; fi
}
signin() { # pair this run's device and sign in the adult, the kid and the kiosk
  DT=$(curl -s -X POST $BASE/api/pair -H 'Content-Type: application/json' --data "{\"code\":\"$CODE\",\"name\":\"chat smoke\"}" | J device_token)
  if [ -n "$PIN" ]; then A=$(curl -s -X POST $BASE/api/login -H "X-Device-Token: $DT" -H 'Content-Type: application/json' --data "{\"profile_id\":\"$P\",\"pin\":\"$PIN\"}" | J profile_token)
  else A=$(curl -s -X POST $BASE/api/profiles/$P/pin -H "X-Device-Token: $DT" -H 'Content-Type: application/json' --data '{"pin":"1357"}' | J profile_token)   # first tap creates the PIN…
    [ "$A" = "undefined" ] && A=$(curl -s -X POST $BASE/api/login -H "X-Device-Token: $DT" -H 'Content-Type: application/json' --data "{\"profile_id\":\"$P\",\"pin\":\"1357\"}" | J profile_token); fi   # …or it exists already
  K=$(curl -s -X POST $BASE/api/login -H "X-Device-Token: $DT" -H 'Content-Type: application/json' --data '{"profile_id":"ezra"}' | J profile_token)
  TV=$(curl -s -X POST $BASE/api/login -H "X-Device-Token: $DT" -H 'Content-Type: application/json' --data '{"profile_id":"tv"}' | J profile_token)
}
signin

echo "### $P (adult)"
chat "$P" "Which apps can I use?";                                 expect "list_apps ran" '"name":"list_apps".*"ok":true'
chat "$P" "What's in the fridge?";                                 expect "get_data ran" '"name":"get_data".*"ok":true'
chat "$P" "Add milk to the leftovers";                             expect "leftover chip" 'Added Milk to leftovers'
chat "$P" "Remind everyone to take the bins out tonight";          expect "reminder chip" 'Added reminder: Take the bins out tonight'
chat "$P" "I read week 2 day 1 of F260";                           expect "f260 chip" 'Week 2 day 1 (checked off|unchecked)'
chat "$P" "Please pray for Grandma's knee on the family list";     expect "prayer chip" "prayer list: Grandma's knee"
chat "$P" "Set my tally to 42";                                    expect "set_data chip" 'Saved count in tally'

echo; echo "### $P (adult): round-2 tools — prayers, fridge clean-up, map, F260 status"
chat "$P" "Please pray for Uncle Bob's trip $RUN on the family list";                 expect "family prayer added" "prayer list: Uncle Bob's trip $RUN"
chat "$P" "I prayed for Uncle Bob's trip $RUN on the family list";                    expect "mark_prayed chip (family)" "Prayed for Uncle Bob's trip $RUN"
chat "$P" "Please pray for a calm week $RUN";                                         expect "private prayer added" "prayer list: A calm week $RUN"
chat "$P" "I prayed for a calm week $RUN";                                            expect "mark_prayed chip (private)" "Prayed for A calm week $RUN"
chat "$P" "Uncle Bob's trip $RUN was answered on the family list: he got home safe";  expect "answer_prayer chip" "Answered: Uncle Bob's trip $RUN"
chat "$P" "Uncle Bob's trip $RUN was answered on the family list";                    expect "answer twice refused" 'already marked answered'
chat "$P" "I prayed for nothing-like-this-$RUN";                                      expect "unknown prayer refused" 'No prayer on the private list matches'
chat "$P" "Add tuna bake $RUN to the fridge";                                         expect "tuna logged" "Added Tuna bake $RUN to leftovers"
chat "$P" "We finished the tuna bake $RUN from the fridge";                           expect "finish_leftover chip" "Finished Tuna bake $RUN"
chat "$P" "We finished the tuna bake $RUN from the fridge";                           expect "finish twice: nothing matches" 'Nothing in the fridge list matches'
chat "$P" "Add pasta $RUN red to the fridge";                                         expect "pasta a logged" "Added Pasta $RUN red"
chat "$P" "Add pasta $RUN green to the fridge";                                       expect "pasta b logged" "Added Pasta $RUN green"
chat "$P" "We ate the pasta $RUN";                                                    expect "ambiguous leftover asks" 'More than one item matches'
put "$P" dollywood-live family "loc:$P" "{\"x\":412,\"y\":198,\"acc\":9,\"hdg\":null,\"t\":$(date +%s)000,\"name\":\"Eli\",\"emoji\":\"🧭\",\"color\":\"#4F5D8C\"}"
put "$P" dollywood-live family "loc:stale-$RUN" "{\"x\":1,\"y\":1,\"acc\":null,\"hdg\":null,\"t\":$(( $(date +%s) - 5*3600 ))000,\"name\":\"Stale\"}"
chat "$P" "Where is everyone?";                                                       expect "where_is_family ran" '"name":"where_is_family".*"ok":true'
                                                                                      expect "fresh position reported" 'people'
                                                                                      reject "stale (5 h) position dropped" 'Stale'
put "$P" f260 person f260.summary '{"week":3,"weekDone":2,"total":12,"streak":4,"readToday":false,"next":{"week":3,"day":3,"ref":"Genesis 22"},"finished":false}'
chat "$P" "Where am I in my reading?";                                                expect "f260_status ran" '"name":"f260_status".*"ok":true'
                                                                                      expect "week + next reading" 'week.{1,4}3'
chat "$P" "What's today's verse?";                                                    expect "verse tool is kids-only for adults" "for the kids"

echo; echo "### Ezra (kid): adult-only app blocked, reminders blocked, kid-safe prompt"
chat ezra "Set my tally to 3";                      expect "kid may write own tally" 'Saved count in tally'
chat ezra "Change the prayer app for me";           expect "kid blocked from adult-only app" 'Kids cannot change that app'
chat ezra "Remind everyone to buy cake";            expect "kid blocked from reminders" 'Kids cannot add reminders'
chat ezra "Hello!";                                 expect "kid prompt in play" 'KID|event: done'
echo; echo "### Ezra (kid): round-2 guards — grown-up tools refuse, the verse speaks"
chat ezra "I prayed for a calm week $RUN";          expect "kid: mark_prayed refused" 'grown-up tool'
chat ezra "A calm week $RUN was answered";          expect "kid: answer_prayer refused" 'grown-up tool'
chat ezra "We ate the milk";                        expect "kid: finish_leftover refused" 'grown-up tool'
chat ezra "Where is everyone?";                     expect "kid: where_is_family refused" 'grown-up tool'
chat ezra "Where am I in my reading?";              expect "kid: f260_status refused" 'grown-up tool'
chat ezra "What's today's verse?";                  expect "kid: read_todays_verse ran" '"name":"read_todays_verse".*"ok":true'
                                                    expect "kid: tool event carries speak + text" '"speak":true,"text":"[^"]*[A-Za-z]+ [0-9]+:[0-9]+'
                                                    expect "kid: no chip on a read-only tool" '"name":"read_todays_verse","input":\{\},"chip":null'
echo; echo "### Kiosk profile has no chat:"
curl -s -X POST "$BASE/api/chat" -H "X-Device-Token: $DT" -H "X-Profile-Token: $TV" -H 'Content-Type: application/json' --data '{"message":"hi"}' > "$OUT"
if grep -qE 'device_not_paired|profile_session_invalid' "$OUT"; then signin; curl -s -X POST "$BASE/api/chat" -H "X-Device-Token: $DT" -H "X-Profile-Token: $TV" -H 'Content-Type: application/json' --data '{"message":"hi"}' > "$OUT"; fi
cat "$OUT"; echo
expect "kiosk gets no_chat" 'no_chat'
echo; echo "### History (rolling window) for $P:"
curl -s "$BASE/api/chat/history" -H "X-Device-Token: $DT" -H "X-Profile-Token: $A" | cut -c1-300; echo
rm -f "$OUT"
echo; echo "smoke-chat: $PASS ok, $FAIL missed"
[ "$FAIL" -eq 0 ]
