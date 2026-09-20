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
| `seed.sql` | The eight household profiles (`INSERT OR IGNORE`, never overwrites admin edits) |
| `src/index.js` | Routes |
| `src/auth.js` | PBKDF2 hashing, tokens, sessions, rate limits |
| `src/data.js` | `app_data` last-write-wins upsert, listing, tombstones |
| `src/push.js` | Web Push encryption (RFC 8291) + VAPID, WebCrypto only |
| `src/reminders.js` | the reminder jobs (morning, evening, behind, prayer, park) and `pushTo()` |
| `src/chat.js` | `/api/chat`: Claude tool loop, guards, streaming |
| `migrations/` | one-off schema migrations already applied to the live DB |
| `../scripts/set-pairing-code.mjs` | Prompts for the pairing code and stores **only its hash** |
| `../scripts/smoke-api.sh` | Curl walk-through of every endpoint (`smoke-api.sh <url> <pairing-code>`) |

## Auth model

1. **Pair the device** once: `POST /api/pair {code}` → `device_token`. Send it as `X-Device-Token` on every request.
   The code is hashed in `settings.pairing_code_hash`; 10 wrong tries per IP per 15 min.
2. **Sign in as a profile**: `POST /api/login {profile_id, pin?}` → `profile_token`, sent as `X-Profile-Token`.
   - kids and the kiosk: no PIN
   - adult with no PIN yet → `403 needs_pin_setup` → `POST /api/profiles/:id/pin {pin}` (4–8 digits, only while unset) signs them in
   - 5 wrong PINs per profile per device → `429` for 15 min
   - sessions last a year and are bound to the device that created them
3. Person-scope reads, every write, and `/api/admin/*` need the profile token. Family-scope reads need only the device token (the kiosk uses this). Kiosk profiles cannot write (`403 read_only`).

## Endpoints

```
GET  /api/health
POST /api/pair                          {code, name?}
GET  /api/profiles                      (no hashes; has_pin flag)
POST /api/login                         {profile_id, pin?}
POST /api/profiles/:id/pin              {pin}
GET  /api/me            POST /api/logout

GET  /api/data/:appId?scope=person|family[&since=ms][&prefix=][&key=]
PUT  /api/data/:appId/:key?scope=       {value, updated_at}   → {value, updated_at, applied}
DELETE /api/data/:appId/:key?scope=     (writes a tombstone)
POST /api/data/:appId/batch?scope=      {items:[{key,value,updated_at}]}

GET  /api/activity?limit=30             POST /api/activity {app_id, text}

GET  /api/push/config                   {public_key, enabled}
POST /api/push/subscribe {subscription} DELETE /api/push/subscribe
POST /api/push/test                     sends a test notification to the caller's devices

PUT  /api/profiles/:id/photo            {sm, lg} base64 JPEGs (256 px ≤ 80 KB, 1024 px ≤ 420 KB) — own profile (adults) or any (admin)
DELETE /api/profiles/:id/photo
POST /api/album {sm, lg, caption?}      adults; the row lands in app_data (family, 'hub', 'album:<id>') so it syncs like a list
DELETE /api/album/:id                   the person who added it, or the admin
GET  /api/media/photos/:id/<token>-256.jpg | -1024.jpg,  GET /api/media/album/<id>-256.jpg | -1024.jpg
                                        public, immutable, unguessable keys; bytes in R2 when a MEDIA bucket is bound, else the D1 `media` table (src/media.js)

POST /api/chat {message, apps}          text/event-stream: text | tool | done | error events (see src/chat.js)
GET  /api/chat/history                  last 20 messages, used/cap for today

Admin (is_admin profile token):
POST /api/admin/profiles/:id/reset-pin
PUT  /api/admin/profiles/:id            {name?, emoji?, color?, kind?, sort_order?}
POST /api/admin/pairing-code/rotate     {code?}  (omit code → one is generated and returned once)
GET  /api/admin/usage                   chat messages / push sends per profile per day, devices
DELETE /api/admin/devices/:id
POST /api/admin/cron/run                {job: 'morning' | 'evening' | 'behind' | 'prayer' | 'park'}  run one reminder job now, ignoring the clock

Cron (wrangler.toml [triggers]): 8:00 am and 8:00 pm New York — see src/reminders.js.
```

### Reminders (src/reminders.js)

The cron fires at both possible UTC hours for 8 am and 8 pm New York; `runCron()` checks the local hour and runs:

| Job | When | Who | Rule |
|---|---|---|---|
| `morning` (kind `leftovers`) | 8 am | adults | any family leftover logged 5+ days ago |
| `evening` (kind `f260`) | 8 pm | each person with F260 rows | no reading ticked today (`f260.log[today]`) and the plan is not finished |
| `behind` | Sunday 8 pm | adults with F260 rows | from `f260.summary` + `f260.weekStart`: if the current week was started more than 3 days ago, behind = 5 − weekDone; pushed when behind ≥ 2 ("You are N readings behind — <next ref> is next.") |
| `prayer` | every run | adults except the author | live family-list `prayer:*` rows that were not live at the last run, or whose fingerprint (`createdAt|title`) changed since — the snapshot lives in `settings.last_prayer_push_at` (`{at, seen: {key: fingerprint}}`). That catches a prayer added under a key the app re-used after a delete (same `app_data` row, so the row id cannot be the watermark); praying, updates and answers never re-announce a row; the first run only seeds the snapshot. The author is the row's `by` (the prayer app writes `by: <profile id>` on every row it creates — add form, share, paste-import — so a prayer typed straight into the family list needs no activity line); rows without it (older app versions, the chat tool) fall back to the profile behind the matching "…family list: <title>" / "Added a family prayer request: <title>" activity line; unknown → everyone |
| `park` | every run | adults | park day = any family `dollywood-live` `loc:*` marker fresher than 4 h; alert when a kid's marker is 30 min–4 h old while at least one adult's is ≤ 30 min old ("Ezra's spot has not updated for 35 min.") |

Every kind sends at most once per person per day (`push_log`), honours `app_data(person, hub, push_prefs).<kind>`
(default on; the switches are in Me → Notifications) and can be forced with `POST /api/admin/cron/run {job}` as the admin
(the forced call returns that one job's result; a scheduled run returns `{nyHour, weekday, ran: [...]}`).
`scripts/test-push2.mjs <code>` proves the three round-2 kinds end to end against `scripts/push-receiver.mjs`.

Errors are `{error: 'snake_code', message: 'plain English'}` with a matching HTTP status.

### Chat tools (src/chat.js)

`POST /api/chat` runs Claude with these tools. The client sends its `apps` list (id, scope, `visibleTo`) and every
tool re-checks it server-side: a kid can only touch apps whose `visibleTo` includes them, and the kiosk never reaches
chat at all. Writes go through `putOne()` (normal sync rules) and log an `activity` row; the `tool` SSE event
carries a human `chip` for anything that changed data (`null` for reads).

| Tool | Who | Does |
|---|---|---|
| `list_apps` | all | the apps this person can use |
| `get_data {app_id, scope, key?}` | all (own apps) | read an app's rows; `*.vault` rows and values over 4 KB are withheld |
| `set_data {app_id, scope, key, value}` | all (own apps; kids not on adult-only apps) | write one value |
| `add_list_item {app_id: leftovers \| reminders, item}` | leftovers: all; reminders: adults | add a fridge item or a house reminder |
| `toggle_f260_reading {week, day}` | F260 users | tick/untick one reading, keeps `f260.log`/`f260.summary` in step |
| `add_prayer {list, text, for?}` | prayer users | new request on the private (person) or family list |
| `mark_prayed {list, prayer_id}` | adults | prayed today: `lastPrayedAt` = today, name under `prayedBy[today]` on the family list, today added to that list's `prayerDays` (the same shape `apps/prayer.html` writes). `prayer_id` may be the id or the title; ambiguous titles come back as a question |
| `answer_prayer {list, prayer_id, note?}` | adults | `status: answered`, `answeredAt` = today, `answerNote` |
| `finish_leftover {item_id? \| name?}` | adults | tombstones the family `leftovers` row; loose name match, asks when several fit |
| `where_is_family {}` | adults, read-only | family `dollywood-live` `loc:*` markers fresher than 4 h: who, x/y, minutes ago |
| `f260_status {}` | adults, read-only | this person's `f260.summary` (week, weekDone, next, streak, readToday) + the week's memory-verse references |
| `read_todays_verse {}` | **kids only**, read-only | the family's memory verses for the week (max `f260.summary.week` across adults, else week 1) with a kid-sized gist of each; the `tool` event also carries `speak: true, text` and the shell reads it aloud (rate 0.9, kid profiles, visible tab only) |

Adult-only tools answer a kid with a plain "grown-up tool" result (never an error thrown); the model is told to say a
parent can help. `scripts/mock-anthropic.mjs` knows a trigger phrase for each tool and `scripts/smoke-chat.sh`
asserts every chip and refusal against a local Worker.


### Data semantics

- `updated_at` is milliseconds from the **writer's** clock. A `PUT` with an older `updated_at` than the stored row is
  ignored and the server's row comes back with `applied: false`; clients adopt it.
- Deleting writes `value: null` (a tombstone) so other devices learn about the delete on their next pull.
  `GET …?since=<last pull>` returns only rows changed after that, tombstones included.
- Values up to 900 KB. Keys: `[A-Za-z0-9_.:-/]`, up to 200 chars. Lists are stored one row per item (`item:<id>`)
  so two people editing at once never overwrite each other's items.

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
| `profile_session_invalid` | Session expired, PIN was reset, or token from another device — pick the profile again |
| `no such table` | Run `schema.sql` against `--remote` |
| CORS error in the browser | Origin not in `ALLOWED_ORIGINS` in `wrangler.toml`; redeploy after editing |
