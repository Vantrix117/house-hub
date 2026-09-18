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
| `src/reminders.js` | the 8 am / 8 pm reminder jobs and `pushTo()` |
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
POST /api/admin/cron/run                {job: 'morning' | 'evening'}  run a reminder job now

Cron (wrangler.toml [triggers]): 8:00 am and 8:00 pm New York — see src/reminders.js.
```

Errors are `{error: 'snake_code', message: 'plain English'}` with a matching HTTP status.

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
