# House Hub API (Cloudflare Worker + D1)

> **Live:** `https://house-hub-api.catalystfarm1.workers.dev`
> D1: `house-hub` (`c5410eee-9095-4092-84b0-dc534aded0d8`) · account `catalystfarm1@gmail.com`
> Deploy: `npx wrangler deploy` **from this folder**. Editing files here changes nothing until you deploy.

Free tier throughout. One Worker serves every app; data is scoped per person or per family.

## Layout

| File | Purpose |
|---|---|
| `wrangler.toml` | Worker name, D1 binding (`DB`), `ALLOWED_ORIGINS` (CORS allow-list) |
| `schema.sql` | Tables. Idempotent — `npx wrangler d1 execute house-hub --remote --file schema.sql` |
| `seed.sql` | The household profiles, the TV and the kitchen (`INSERT OR IGNORE`, never overwrites admin edits) |
| `src/index.js` | Routes |
| `src/auth.js` | PBKDF2 hashing, tokens, sessions, rate limits |
| `src/data.js` | `app_data` last-write-wins upsert, listing, tombstones |
| `src/policy.js` | Who may read and write which rows (kids, guests, the kitchen, app visibility from `../apps.json`); every data and chat write goes through `guardedPut()` |
| `src/push.js` | Web Push encryption (RFC 8291) + VAPID, WebCrypto only |
| `src/reminders.js` | the reminder jobs (morning, evening, behind, prayer, prayedfor, park, praytime), `jobsAt()` (what a 15-min cron firing runs) and `pushTo()` |
| `src/chat.js` | `/api/chat`: Claude tool loop, guards, streaming |
| `migrations/` | one-off schema migrations already applied to the live DB |
| `../scripts/set-pairing-code.mjs` | Prompts for the pairing code and stores **only its hash** |
| `../scripts/smoke-api.sh` | Curl walk-through of every endpoint (`smoke-api.sh <url> <pairing-code>`) |

## Auth model

1. **Pair the device** once: `POST /api/pair {code, name?, fp?}` → `device_token`. Send it as `X-Device-Token` on every request.
   The code is hashed in `settings.pairing_code_hash`. Wrong codes: 5 per install id (`fp`, a random id hub.js keeps in
   `hub.fp`) per 15 min and 20 per IP as a backstop, so one device cannot block the house; a page without `fp` gets 10 per IP.
2. **Sign in as a profile**: `POST /api/login {profile_id, pin?}` → `profile_token`, sent as `X-Profile-Token`.
   - kids and the kiosk: no PIN
   - a guest without a PIN: no PIN either (signs in on tap); a guest whose stay has ended → `403 guest_expired`, and their existing sessions stop with `401 profile_session_invalid`
   - adult with no PIN yet → `403 needs_pin_setup` (with `pin_reset: true` after an admin reset) → `POST /api/profiles/:id/pin {pin, code?}`
     (4–8 digits, only while unset) signs them in. After an admin reset it also needs the one-time `code` the admin was shown
     (`403 needs_code`, `401 wrong_code`, `403 code_expired` after 24 h). A household adult who never had a PIN still creates it
     on first tap; the admin's "Set-up code" closes that too.
     Never for a guest (`403 guest_pin_fixed`): a guest's PIN is chosen when they are added, and the admin's Reset PIN
     ("Clear PIN" on a guest row) turns them into a tap-to-open guest — so no paired device can lock a guest out or take the profile
   - the kitchen (kind `kitchen`, KITCHEN-1): only on a device whose `role` is `kitchen`, no PIN; a kitchen device signs in as nothing
     else (`403 kitchen_device` / `403 not_kitchen_device`), and a session whose profile and device role no longer match gets `401`
   - wrong PINs and codes (each attempt counted before it is checked): 5 per profile per device per 15 min, 20 per device a day,
     and 10 per profile per hour across every device; the 10th pauses that profile's sign-ins for 1 h, then 2 h, 4 h … up to
     24 h for each further pause within a week, and pushes the admin (kind `security`). A device the person has signed in on
     before is held only by its own limits, never by the pause. The admin's reset-pin lifts the pause → `429 too_many_attempts`
   - sessions last a year and are bound to the device that created them
3. Person-scope reads, every write, and `/api/admin/*` need the profile token. Family-scope reads need only the device token (the kiosk uses this). Kiosk profiles cannot write (`403 read_only`).
4. **Who may write which rows** (`src/policy.js`, batch 0d). Family rows of an app the profile cannot open (apps.json `visibleTo`; a guest opens what any household adult opens) are refused for reading and writing (`403 app_hidden`); person rows of such an app too, except Verses' `f260.recall` in the F260 scope. A **kid** writes only their own person rows; on the family prayer list a tick under their own profile id (`prayedBy`, `lastPrayedAt`, `updatedAt`, nothing else; since batch 0g an older app's name tick is replaced by the id) and new `prayerDays` dates; their own Kid Verse `stars:<id>` / `story:<id>`; their own park-map `loc:<id>` while `kidshare:<id>` is `true`, and a dot more than a day old. **Only a household adult** (not a guest) writes Kid Verse `week` and `ledger:*` and the park map's `kidshare:*` and `kid:*`. Nobody writes someone else's `stars:`/`story:` or places someone else's `loc:`; clearing another's fresh dot is for household adults. The **kitchen** writes family rows of leftovers, prayer and reminders and person rows of its own timer and tally only, and every `by` / new `prayedBy` name it writes must be a household member (never a kid on the Larder). A refused single write answers `403 not_allowed {rejected, key, value, updated_at}`; in a batch the refused row comes back as `{key, rejected, value, updated_at}` (the house's copy, which hub.js puts back) and the others still save.

## Endpoints

```
GET  /api/health
GET  /api/dollywood/waits               Dollywood posted wait times via queue-times.com (60 s edge cache, no auth):
                                        {ok, at, updated, source, rides:[{name, land, open, wait (min|null), updated}]}
POST /api/dollywood/rally               {name, x, y, note?}  "Rally the family" from the park map. Household adults only (kids, the display
                                        and guests → 403 adults_only); one rally per adult per 60 s (429 too_many_attempts, retry_after).
                                        name ≤ 60 chars (400 bad_name), x/y JSON numbers — map positions like the loc:* markers (400 bad_point),
                                        note ≤ 140. Writes app_data(family, 'dollywood-live', 'meet') = {x, y, name, note, by, byName, at}
                                        through putOne (every phone's hub.js sees it on its next pull), logs "Set a meeting point: <name>" on
                                        Home, then pushes every OTHER household adult whose park switch is on: {title 'Meet at <name>',
                                        body '<Name> is gathering the family — open the park map', url '#dollywood-live', tag 'rally'},
                                        TTL 30 min, urgency high, logged as kind 'rally'. Dead subscriptions never fail the call.
                                        → {ok:true, pushed (adults reached on ≥1 device), meet, updated_at, notified:[{profile, devices}],
                                           skipped:[{profile, why: pref_off | no_subscription | delivery_failed | push_error}]}
DELETE /api/dollywood/rally             tombstones the meet row (household adults only, same 403s; no push, no rate limit) and logs
                                        "Cleared the meeting point: <name>" → {ok:true, cleared (there was one), updated_at}
POST /api/pair                          {code, name?, fp?}
GET  /api/profiles                      (no hashes; has_pin, pin_reset, hue, is_guest, expires_at, created_by) — guests whose expires_at has
                                        passed are left out unless the caller is the admin; the kitchen is listed with kind 'kitchen', which
                                        every picker leaves out
POST /api/profiles                      {name, emoji?|icon?, color?, hue?, pin?, expires_at?}  household adults only (kids, the display and
                                        guests → 403): a guest profile, kind adult, is_guest 1, id 'guest-<random>', never admin;
                                        expires_at ms since epoch or null = keep; hue one of the 18 families (default 'sky', else 400 bad_hue); logs "Added a guest: <name>" on Home.
                                        Names and emoji with < or > → 400 bad_name / bad_emoji (also on the admin's edit)
POST /api/login                         {profile_id, pin?}
POST /api/profiles/:id/pin              {pin, code?}  PIN creation while unset, household adults only (guests → 403 guest_pin_fixed);
                                        after an admin reset the one-time code is required
GET  /api/me            POST /api/logout
POST /api/me/pin                        {current, pin}  Change my PIN (household adults; a wrong current PIN → 403 wrong_pin, counted)
GET  /api/device                        (device token) → {id, name, role: null|'kitchen', kitchen_profile}: the shell asks at boot and
                                        after a 401, and on a kitchen device signs in as the kitchen instead of showing the picker
POST /api/device/forget                 household adults: deletes this device, its sessions and its push subscriptions (Me → Forget)

GET  /api/data/:appId?scope=person|family[&since=ms][&prefix=][&key=]
PUT  /api/data/:appId/:key?scope=       {value, updated_at}   → {value, updated_at, applied}
DELETE /api/data/:appId/:key?scope=     (writes a tombstone)
POST /api/data/:appId/batch?scope=      {items:[{key,value,updated_at}]}  at most 200 items; a bad row (bad_key, value_too_large) fails the request;
                                        a row the policy refuses comes back as {key, rejected, value, updated_at} and the others still save

GET  /api/activity?limit=30 (each line carries its author's name, emoji, color, hue, is_guest, photo)   POST /api/activity {app_id, text, at?, as?}  (at: when it happened, ms; kept if within the past week,
                                        never ahead; as: the kitchen files the line under the household member whose face was tapped,
                                        403 bad_credit otherwise; ignored for everyone else). A prayer line "Prayed for …" / "Answered: …"
                                        must name a family-list request or say "a private request" (400 private_title)
GET  /api/f260/readers                  → {date, readers: [profile ids]}: the household adults (no guests) whose F260 log has today's
                                        New York date as true (log:<date> rows over the old f260.log map; false = unticked). Any
                                        signed-in profile; the TV board's "Reading today" asks once a minute (batch 2c, UX-SYNC-a2). Reads the
                                        adults, then at most two rows each through the app_data_uq index, never a scan of the F260 rows

GET  /api/push/config                   {public_key, enabled}
GET  /api/push/subscribe                → {subscribed, endpoint}: this person's subscription on this device (Me → Notifications paints
                                        its switch from it, never from the browser's, P2-PWA-03)
POST /api/push/subscribe {subscription} one per person per device. subscription = {endpoint (https; http only for 127.0.0.1 / localhost), keys: {p256dh (a 65-byte P-256
                                        point), auth (16 bytes)}} base64url, else 400 bad_subscription (P2-PWA-10). The display → 403
                                        read_only, the kitchen and kids → 403 no_push (P2-PROF-16)
DELETE /api/push/subscribe              this person's subscription on this device (anyone, so an old row can always be removed)
POST /api/push/resubscribe              {old_endpoint, subscription}  the device token only (the service worker's pushsubscriptionchange,
                                        PWA-GAP-2; 401 without it). Moves THIS device's rows holding old_endpoint to the new subscription →
                                        {ok, moved}; 404 no_such_subscription (wrong endpoints are rate-limited per device, 20 per 15 min)
POST /api/push/test                     {profile_id?}  a test to the caller's subscription on THIS device only → {sent, ok, details, device:
                                        true} (P2-PWA-12); the admin with profile_id: every device of that profile. The display and kids → 403
POST /api/logout                        also removes the person's push subscription on this device (a Switch on a shared iPad, P2-PWA-03).
                                        A sign-in on a device removes any OTHER person's subscription there, a session that ran out takes its
                                        person's subscription on that device with it, and Reset PIN or a new kind removes the person's
                                        subscriptions everywhere; pushTo never sends to a kid, the display or the kitchen (and drops such rows)

PUT  /api/profiles/:id/photo            {sm, lg} base64 JPEGs (256 px ≤ 80 KB, 1024 px ≤ 420 KB) — own profile (adults) or any (admin)
DELETE /api/profiles/:id/photo
POST /api/album {sm, lg, caption?, as?} adults, or the kitchen for the household adult in as; the row lands in app_data (family, 'hub',
                                        'album:<id>') so it syncs like a list
DELETE /api/album/:id                   the person who added it, or the admin
GET  /api/media/photos/:id/<token>-256.jpg | -1024.jpg,  GET /api/media/album/<id>-256.jpg | -1024.jpg
                                        public, immutable, unguessable keys; bytes in R2 when a MEDIA bucket is bound, else the D1 `media` table (src/media.js)

POST /api/chat {message}                text/event-stream: text | tool | done | error events (see src/chat.js). The apps the person can use
                                        come from the Worker's copy of apps.json (policy.js), never the request; the kiosk and the kitchen → 403.
                                        60 a New York day (429 daily_cap): the day's counter row (rate_limits 'chat:<profile>:<date>') is taken in
                                        one statement before the call and given back if the upstream fails or times out before any reply (the
                                        error event then carries refunded: true, used, cap); the message joins chat_log once the model answers.
                                        An upstream silent for 45 s (env CHAT_TIMEOUT_MS) → error upstream_timeout. Thinking blocks (with their
                                        signatures) and redacted_thinking are replayed whole in the tool loop; only text and tools reach the tab.
                                        The system prompt names the household and guests whose stay has not ended (never the TV or the kitchen),
                                        marking the admin and guests
POST /api/chat/stop {rid}               the person tapped Stop on the send whose body carried that rid: the running reply sees it within 3 s,
                                        aborts the model call and runs no further tool → {ok, ran} (ran = tools already started; 0 = nothing
                                        was done). The message is given back only when the Stop came before the model was asked; the upstream
                                        failing or timing out still refunds. While a reply
                                        is on its way the stream carries a ': ping' comment every 15 s
GET  /api/chat/history                  last 20 messages, used/cap for today
DELETE /api/chat/history                the person's own chat history (and pending Undo records); today's count stays (GAP-CHAT-01). The display → 403.
                                        A kid's chat is also deleted after 90 days by the 8 am / 8 pm cron
POST /api/chat/undo {token}             undo one chat action (the chip's token, 45 s, once, the person's own): puts back the rows it wrote where nobody has changed them since; 410 gone after

Admin (is_admin profile token):
POST /api/admin/profiles/:id/reset-pin  {admin_pin?}  household adult → {code, expires_at}: a one-time 6-digit code, shown once, good for
                                        24 h, that they type before choosing a new PIN (resetting any admin — yourself or a co-admin —
                                        needs admin_pin, 403 wrong_admin_pin); on a guest: the PIN is cleared and they sign in on tap. Ends the profile's sessions
                                        and lifts its wrong-PIN pause. Only adults (400 no_pin_for_kind)
PUT  /api/admin/profiles/:id            {name?, emoji?, color?, hue?, kind?, sort_order?, expires_at?}  (expires_at: guests only — extend or end
                                        a stay; ending it deletes the guest's sessions and push subscriptions at once). hue: one of the 18
                                        colour families or null. A household profile made an adult comes back with {setup_code}. A new kind
                                        ends the profile's sessions. The kitchen: colour only (400 kitchen_fixed); nobody becomes the kitchen
PUT  /api/admin/devices/:id/role        {role: 'kitchen'|null, admin_pin}  from another device (400 cannot_change_self), the admin's PIN
                                        typed again (403 wrong_admin_pin). Setting it ends that device's personal sessions and push
                                        subscriptions; clearing it ends its kitchen session
DELETE /api/admin/profiles/:id          guests only (400 not_a_guest otherwise): the profile, its person-scope app_data, sessions, push
                                        subscriptions, chat log, activity and photos are deleted
POST /api/admin/profiles/:id/purge      the same for a guest whose stay has ended (400 not_expired otherwise)
POST /api/admin/profiles                {name, kind: 'adult'|'kid', hue, admin_pin, emoji?, color?}  Admin → Household (GAP-PROF-a2): a
                                        household person, with the admin's PIN typed again (403 wrong_admin_pin). hue must be one of the 18
                                        families (400 bad_hue); color, when sent, a #rrggbb (400 bad_color). id = the name in lower case when
                                        free (else plus a short tail); an id once used by a removed person, or named in apps.json
                                        visibleTo, is never handed out again. An adult comes back with {setup_code, code_expires_at}: a one-time code (24 h) they
                                        type before creating their PIN. apps.json visibleTo lists name people, so a new person sees the
                                        apps open to everyone until apps.json names them
POST /api/admin/profiles/:id/remove     {admin_pin}  a household adult or kid, never yourself (400 cannot_remove_self), an admin
                                        (400 is_admin), a guest (400 is_guest) or the TV / kitchen (400 not_a_person); deleted as above
PUT  /api/admin/profiles/:id/admin      {is_admin, transfer?, admin_pin}  make a household adult with a PIN of their own an admin (400
                                        needs_pin / admin_must_be_household_adult), take it away (never from the last admin: 400
                                        last_admin), or transfer: true hands the caller's admin over in the same step
POST /api/admin/guests/purge            run the guest cleanup now: every expired guest loses sessions + push subscriptions ("silenced"),
                                        every guest expired more than 30 days ago is deleted as above
POST /api/admin/pairing-code/rotate     {code?}  (omit code → one is generated and returned once)
GET  /api/admin/usage                   chat messages / push sends per profile per New York day (the chat limit's day; tz: 'America/New_York'),
                                        devices (with role)
DELETE /api/admin/devices/:id
POST /api/admin/cron/run                {job: 'morning' | 'evening' | 'behind' | 'prayer' | 'prayedfor' | 'park' | 'praytime'}  run one reminder job now, ignoring the clock (evening: everyone's reading time too)
                                        (expired guests are silenced first, so a forced job cannot reach them either)

Cron (wrangler.toml [triggers]): every 15 minutes; what runs is read off the New York time of the firing — see src/reminders.js
jobsAt(). Before the jobs run, every guest whose stay has ended loses their sessions and push subscriptions (silenceExpiredGuests
in src/auth.js); after the 8 am / 8 pm jobs, guests expired more than 30 days ago are purged (purgeExpiredGuests in
src/index.js) and kids' chat older than 90 days is deleted (pruneKidChat in src/chat.js).
```

### Guests (roadmap 23, migrations/005-guests.sql)

A guest is an ordinary adult profile with `is_guest = 1`, `created_by` (who added them) and `expires_at` (ms, NULL = keep).
Any household adult creates one from the Me tab; the picker on every device shows it on its next `GET /api/profiles`
("Guest · until <date>"). Guests can never be the admin or become a kid/kiosk (`400 guest_must_be_adult`), and cannot
add other guests. Because `apps.json`'s `visibleTo` lists household ids, a guest sees every app that is open to everyone
or to at least one household adult — the shell applies that rule in `visibleApps()`, and the Worker applies the same rule
(`canOpen()` in `src/policy.js`) to data and chat. Guests use the apps but not the household's controls: no kids' beacons
or heights, no family memory-verse week, no rewards ledger (P5-D8). Once `expires_at` passes the guest
disappears from the picker (the admin still sees them, with Purge), cannot sign in, and their sessions and push
subscriptions are deleted (on the admin's `PUT {expires_at}`, on the first request with a stale token, and before every
cron run — so the household reminders never reach a departed visitor's phone); their person-scope rows stay 30 days so
the admin can extend the stay (`PUT … {expires_at}`), then the cron purge deletes them. A guest's PIN is fixed when they
are added: `POST /api/profiles/:id/pin` refuses guests (`403 guest_pin_fixed`), so a tap-to-open guest cannot be locked
out or taken over from another paired device; the admin's reset-pin ("Clear PIN") makes a guest tap-to-open again.

### Reminders (src/reminders.js)

The cron fires every 15 minutes (batch 2b; one trigger). `jobsAt()` reads the New York time of the firing and runs the
8 am jobs at every firing of the 8 o'clock hour and the 8 pm jobs at every firing of the 20 o'clock hour (a failed push is tried
again at :15, :30 and :45; the once-a-day gate and the prayer memory keep anyone from being told twice); `evening`, `park`
and `praytime` run at every firing and pick whom it concerns:

| Job | When | Who | Rule |
|---|---|---|---|
| `morning` (kind `leftovers`) | 8 am | household adults | any family leftover logged 5+ days ago |
| `evening` (kind `f260`) | every run (15 min): the person's own time | each person with F260 rows | no reading ticked today (`f260.log[today]`) and the plan is not finished, at the time the person chose in Me → Notifications (`push_pref:readAt`, or the old `push_prefs.readAt`; "HH:MM", New York, on the half hour; unset = 8 pm, IMP-F260-F4): the firing falls in that time's hour. A firing in no one's hour reads nothing more (`quiet`); a forced run ignores the times. Once a day |
| `behind` | Sunday 8 pm | adults (guests too: their own reading) with F260 rows | from `f260.summary` + `f260.weekStart`: if the current week was started more than 3 days ago, behind = 5 − weekDone; pushed when behind ≥ 2 ("You are N readings behind — <next ref> is next.") |
| `prayer` | 8 am and 8 pm | household adults except the author | live family-list `prayer:*` rows that were not live at the last run, or whose fingerprint (the request's own `id` and `createdAt`, never the title: a wording edit is not new, P3-PRAYER-25) changed since — the snapshot lives in `settings.last_prayer_push_at` (`{v: 2, at, seen: {key: fingerprint}, owed: {profile: [keys]}}`). That catches a different request under a key an older app re-used after a delete; praying, updates and answers never re-announce a row; the first run only seeds the snapshot. Each new row is owed to each adult until a push to them is delivered (no once-a-day gate, P2-PWA-04: a prayer added after the morning push goes at 8 pm; a failed delivery is retried at the next run); switch off or no device → dropped. The author is the row's `by` (the prayer app writes `by: <profile id>` on every row it creates — add form, share, paste-import — so a prayer typed straight into the family list needs no activity line); rows without it (older app versions, the chat tool) fall back to the profile behind the matching "…family list: <title>" / "Added a family prayer request: <title>" activity line; unknown → everyone |
| `prayedfor` | 8 pm | whoever added a family request (`by`) | someone else's id (or name) under today's `prayedBy` on it: "Elizabeth prayed for your request today: Grandma's surgery."; several requests name each one's own people ("Prayed for your requests today: Grandma's surgery (Eli and Ezra); Sam's job (Mae)."). Once a day (GAP-PRAYER-1) |
| `park` | every run (15 min) | household adults | park day = any family `dollywood-live` `loc:*` marker fresher than 4 h; alert when the house last heard from a kid's marker 20 min–12 h ago while at least one household adult's (never a guest's) is ≤ 30 min old ("Ezra's spot has not updated for 35 min."). Ages are the Worker's own clock (the row's `synced_at`), never the phone's `t`, so a phone with a slow clock that keeps publishing is never "quiet". Each quiet spell (the kid's marker as last heard) is told once per adult, remembered in `settings.park_alerts` (`{kid: {t, told}}`); a failed push or a late subscriber is told at the next run (P2-PWA-02). `scripts/test-park.mjs` proves it in process |
| `praytime` | every run (15 min) | the person | `push_pref:prayAt` (or the old `push_prefs.prayAt`; "HH:MM", New York, on the half hour in Me): the firing falls in that time's hour: "Time to pray — 3 on your list, 5 on the family list." (no private titles). Once a day (GAP-PRAYER-1) |

Morning, evening, behind, prayedfor and praytime send at most once per person per day (`push_log`, counting only a push some
device took, P2-PWA-11); prayer and park use their own memory (above). Every kind honours the person's switch: one row per kind,
`app_data(person, hub, 'push_pref:<kind>')`, over the old whole row `push_prefs` (read-only base; default on; `prayAt` unset = no
reminder; `readAt` unset = the reading nudge at 8 pm; the switches and both times are in Me → Notifications), and can be forced with
`POST /api/admin/cron/run {job}` as the admin (the forced call returns that one job's result, the reading nudge whatever anyone's time; a scheduled run returns
`{nyHour, nyMinute, weekday, main, ran: [...]}`). The household kinds (morning, prayer, park) never go to a guest (PWA-UX-2).
`pushTo()` skips and deletes a subscription it cannot encrypt for (P2-PWA-10), and puts `to: <profile>` in every payload.
`scripts/test-push2.mjs <code>` proves the three round-2 kinds end to end against `scripts/push-receiver.mjs`.

"Read today" for the evening job and `GET /api/f260/readers` is the person's `log:<date>` row, or — when that row is an
untick another device's earlier tick outlived — a reading still ticked that day (`f260UntickOutlived`). Readings a Reset's
Undo or a restore wrote back are not counted: the app records each such write-back as `f260 restored:<date>:<uid>` =
`{ ids, upTo }` (a done: row of a listed id stamped at or before `upTo`; a later real tick counts), read by
`f260RecentTicks` and chat's untick alike. The first 8 am / 8 pm firing deletes `restored:*` rows older than yesterday
(`pruneRestored`, batch 4).

One push is not a job: `POST /api/dollywood/rally` (above) sends "Meet at <name>" to the other household adults on demand.
It rides on the same park-day switch (`push_pref:park`) but is logged as kind `rally`, so a rally is never taken for
the `park` alert and has no daily cap of its own — the 60 s per-adult rate limit is the only brake.

Errors are `{error: 'snake_code', message: 'plain English'}` with a matching HTTP status.

### Chat tools (src/chat.js)

`POST /api/chat` runs Claude with these tools. The client sends its `apps` list (id, scope, `visibleTo`) and every
tool re-checks it server-side: a kid can only touch apps whose `visibleTo` includes them, and the kiosk never reaches
chat at all. Writes go through `putOne()` (normal sync rules) and log an `activity` row; the `tool` SSE event
carries a human `chip` for anything that changed data (`null` for reads), and, when it wrote something, an `undo` token (batch 0i): the Chat tab shows Undo on the chip for 30 s, and `POST /api/chat/undo` puts back what the action wrote. The rows as they were are kept for the undo in `app_data(person, chatundo, <token>)`, an app no client syncs and the data API refuses to read or write, deleted after use or 10 minutes; an Undo is all or nothing (nothing is changed if any row was changed since). A write that another change beat under last-write-wins is "Not saved" (no ✓), and the action's earlier writes are put back. A Larder item's `dateLogged` must be a real `YYYY-MM-DD` and not after today, from chat and the data API alike (`bad_date`; chat also takes today / yesterday / "N days ago").

| Tool | Who | Does |
|---|---|---|
| `list_apps` | all | the apps this person can use |
| `get_data {app_id, scope, key?}` | all (own apps) | read an app's rows; `*.vault` rows (listed or asked for by key) and values over 4 KB are withheld |
| `set_data {app_id, scope, key, value}` | all (every chat write meets the same rules as the data API, `src/policy.js`) | only `tally` `count`, `timer` `timer.active` and `hub` `theme`, all person scope, with value checks (batch 0i); anything else is refused |
| `add_list_item {app_id: leftovers \| reminders, item}` | leftovers: all; reminders: adults | add a fridge item or a house reminder |
| `set_f260_reading {week, day, done}` | F260 users | tick (done true) or untick one reading, keeps the log and `f260.summary` in step; already in that state is a no-op that says so (batch 0i) |
| `add_prayer {list, text, for?}` | prayer users | new request on the private (person) or family list |
| `mark_prayed {list, prayer_id}` | adults | prayed today: `lastPrayedAt` = today, the person's profile id under `prayedBy[today]` on the family list (ids since batch 0g; the person's old name entry is replaced), today added to that list's `prayerDays` (the same shape `apps/prayer.html` writes). `prayer_id` may be the id or the title; ambiguous titles come back as a question |
| `answer_prayer {list, prayer_id, note?}` | adults | `status: answered`, `answeredAt` = today, `answerNote` |
| `finish_leftover {item_id? \| name?}` | adults | tombstones the family `leftovers` row and keeps it seven days as `finished:<id>` (the app's "Recently finished", where it can be put back); an exact name or the id only — otherwise it lists the likely items and the model asks (batch 0i) |
| `where_is_family {}` | adults, read-only | family `dollywood-live` `loc:*` markers fresher than 4 h: who, x/y, minutes ago |
| `f260_status {}` | adults, read-only | this person's `f260.summary` (week, weekDone, next, streak, readToday) + the week's memory-verse references |
| `read_todays_verse {}` | **kids only**, read-only | the family's memory verses for the week (max `f260.summary.week` across adults, else week 1) with a kid-sized gist of each; the `tool` event also carries `speak: true, text` and the shell reads it aloud (rate 0.9, kid profiles, visible tab only) |

Adult-only tools answer a kid with a plain "grown-up tool" result (never an error thrown); the model is told to say a
parent can help. `scripts/mock-anthropic.mjs` knows a trigger phrase for each tool and `scripts/smoke-chat.sh`
asserts every chip and refusal against a local Worker.


### Data semantics

- `updated_at` is milliseconds from the **writer's** clock, which hub.js corrects by the last server skew it saw. The
  Worker stores at most 30 s ahead of its own clock (`MAX_AHEAD_MS`) and answers with the stamp it stored. A `PUT` with an
  older `updated_at` than the stored row is ignored and the server's row comes back with `applied: false`; clients adopt it.
- Deleting writes `value: null` (a tombstone) so other devices learn about the delete on their next pull.
  `GET …?since=<last pull>` returns only rows changed after that, tombstones included.
- Values up to 900 KB. Keys: `[A-Za-z0-9_.:-/]`, up to 200 chars. Lists are stored one row per item (`item:<id>`)
  so two people editing at once never overwrite each other's items.
- **Maps kept one row per entry** (batch 0e): F260's ticks, memorised verses, reading log and practice ratings
  (`done:<week>-<i>`, `mem:<week>-<i>`, `log:<date>`, `recall:<week>-<i>` in the person's f260 scope), Verses' review counts
  (`rev:<date>:<id>:<device>`) and the build guide's steps (`step:<id>`). Each row overrides the same entry of the old
  whole-map row (`f260.done`, `f260.mem`, `f260.log`, `f260.recall`, `progress`), which stays as a read-only base;
  `false` means off. `rowMap()` in `src/data.js` (and `hub.rowMap` in hub.js) does the merge; chat's F260 tools and the 8 pm
  job read it. Prefix reads (`?prefix=`) are exact-case.
- **Kid Verse and Tally** (batch 0f): a kid's stars, parents' actions taken in, badges and heard story days are one row each in the kid's person scope (`star:`, `reset:`, `applied:`, `badge:`, `heard:`), and the kid's device writes the derived totals to the family mirrors `stars:<kid>` / `story:<kid>`. Tally keeps `count:<device>` = `{n, epoch}` per device and a `reset` row `{epoch, at}`; the count is the sum on the current epoch (the old absolute `count` row is the base until the first reset). In chat, `get_data` on tally `count` returns that sum and `set_data` on it starts a new epoch at the number (`reset` + `count:chat`).
- **The F260 journal vault** (`f260.journal.vault`) carries a version (`vid`, or `p:<passcode salt>` for one written before
  versions). A vault with a different version is refused (`vault_changed`) unless it names the stored one as `prev`, so a
  device still holding an erased, re-created or restored journal's key cannot write over the new one.

## Secrets

Never in this repo. Set with `npx wrangler secret put NAME` from this folder:

| Secret | Used by |
|---|---|
| `VAPID_PRIVATE_KEY` | push notifications (`src/push.js`) |
| `ANTHROPIC_API_KEY` | chat (`src/chat.js`); until it is set the Chat tab says the assistant is not set up |

The pairing code is not a secret binding — it is a hash in D1, rotated with `scripts/set-pairing-code.mjs` or the admin endpoint.

## Local development

```bash
cd worker
npx wrangler d1 execute house-hub --local --file schema.sql
npx wrangler d1 execute house-hub --local --file seed.sql
node ../scripts/set-pairing-code.mjs --local
npx wrangler dev --port 8787
../scripts/smoke-api.sh http://127.0.0.1:8787 <the code you typed>
```

Local state lives in `.wrangler/` (git-ignored). Local-only secrets go in `.dev.vars` (git-ignored): a throwaway VAPID pair, and `ANTHROPIC_BASE_URL="http://127.0.0.1:8791"` + any `ANTHROPIC_API_KEY` to talk to `scripts/mock-anthropic.mjs` instead of the real API.

## If something's wrong

| What you see | Cause |
|---|---|
| `device_not_paired` | Device token missing/revoked — the hub shows the pairing screen |
| `pairing_not_configured` (503) | Run `scripts/set-pairing-code.mjs` |
| `profile_session_invalid` | Session expired, PIN was reset, token from another device, or a guest's stay ended — pick the profile again |
| `guest_expired` (403) | That guest's `expires_at` has passed; the admin can extend it (`PUT /api/admin/profiles/:id {expires_at}`) |
| `guest_pin_fixed` (403) | `POST /api/profiles/:id/pin` on a guest — their PIN was set when they were added; the admin clears it with reset-pin |
| `needs_code` / `wrong_code` / `code_expired` | PIN creation after an admin reset: type the one-time code the admin was shown (24 h); the admin can issue a new one |
| `too_many_attempts` (429) on sign-in | 10 wrong PINs or codes for that profile within the hour (any devices) paused it; the admin was pushed; Reset PIN lifts it |
| `not_allowed` (403) / `rejected` in a batch | The profile may not write that row (`src/policy.js`): a kid, a guest or the kitchen outside its rows, or an app it cannot open |
| `kitchen_device` / `not_kitchen_device` (403) | Sign-in mixing the kitchen device and a person; the admin sets or clears the role (`PUT /api/admin/devices/:id/role`) |
| `no such table` | Run `schema.sql` against `--remote` |
| CORS error in the browser | Origin not in `ALLOWED_ORIGINS` in `wrangler.toml`; redeploy after editing |
