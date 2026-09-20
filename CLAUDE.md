# House Hub — instructions for Claude

The Anderson family's one-stop app, used on iPad, iPhone and desktop. This file is the map; read it before touching anything.

## Where things run

| Piece | Where | How it deploys |
|---|---|---|
| Site (`index.html`, `apps/`, `sw.js`, `icons/`) | **GitHub Pages**, `main` branch, repo root → https://vantrix117.github.io/house-hub/ | `git push` — Pages rebuilds in 30–90 s. Always confirm the live file returns 200 before saying it is live. |
| API + database | **Cloudflare Worker `house-hub-api`** + **D1 `house-hub`** → https://house-hub-api.catalystfarm1.workers.dev | `cd worker && npx wrangler deploy`. Editing `worker/` changes nothing until you deploy. Full reference: [`worker/README.md`](worker/README.md). |
| Secrets | Cloudflare Worker secrets: `VAPID_PRIVATE_KEY`, `ANTHROPIC_API_KEY` | `npx wrangler secret put NAME` from `worker/` — it prompts. **Never write a secret, a PIN or the pairing code into this repo, a `.dev.vars` you commit, or a chat transcript.** |

There is no build step, bundler, framework or `package.json` anywhere. Do not add one. The Worker is plain ESM that wrangler bundles; it has no npm dependencies.

## How the hub works

- **Pairing + profiles.** A device is paired once with the household pairing code (hash in D1 `settings`). Then each person picks their profile: kids and the kiosk open on tap, adults create a 4–8 digit PIN on first tap and use it afterwards. Tokens live in `localStorage` (`hub.device`, `hub.session`) and are shared by every app on the origin.
- **Profiles** (`worker/seed.sql`): Eli (admin), Mae (id `christian`), Elizabeth (Mom), David (Dad), Mea (niece) — adults, Ezra, Kiara (kids), Downstairs TV (kiosk, read-only). The admin panel (Me tab, Eli only) edits name/emoji/colour/kind, resets PINs, rotates the pairing code, unpairs devices and shows usage.
- **Data model.** Everything an app stores is a row in `app_data`: `(scope 'person'|'family', profile_id, app_id, key, value JSON, updated_at)`. Person scope is one person's own data; family scope is shared by the house. Last write wins by `updated_at`; deletes are tombstones. Lists are one row per item (`item:<id>`, `prayer:<id>`) so two people never overwrite each other.
- **`apps/hub.js`** is the SDK every app loads. It keeps a per-app, per-scope `localStorage` cache and write queue, applies writes locally at once, flushes in batches when online, pulls on open / visibility / reconnect / every 30 s, and reconciles by `updated_at`. `hub.sync.state` is `synced | pending | offline | error`. Two copies (the shell and an app iframe) share one `localStorage`; `storage` events keep them in step.
- **Themes** (`apps/design.css`): named palettes — Hearth (default warm paper), Parchment (soft tan reading paper), Frost (cool pale glass), Midnight (warm dark), Forest (deep green, gold ink) — plus System (Hearth by day, Midnight at night). Each is a complete token block under `:root[data-theme=…]`; hub.js also sets `data-scheme="light|dark"` (the resolved scheme) so an app with its own dark CSS keys off `[data-scheme="dark"]`, never `prefers-color-scheme`. `hub.THEMES` lists them; picked in Me (theme cards) or F260's settings; `docs/design.html` previews and contrast-checks every one. Adding a theme = one token block in design.css (+ a `.tp[data-preview=…]` copy for the swatch) + an entry in `hub.THEMES`.
- **Preferences** live in person scope so they follow the person: the theme is `app_data(person, 'hub', 'theme')` (hub.js mirrors it in `localStorage` so the first paint is right; `hub.setTheme()` writes both), F260 keeps text size and autolock in its own person scope. The display profile can never write — `hub.set` throws `read_only` and shows a toast (`hub.kioskNudge()`); apps check `hub.canWrite` before changing their own UI.
- **Liquid glass** (`apps/design.css`): every glass surface (`.glass`, `.glass-strong`, `.btn-glass`, `.pill`, `.topbar`, `.tabbar`, `.sheet`) shares one recipe — specular sheen along the top, a darker refracted edge inside and a lighter ring outside, an inner shadow at the bottom, a little of the person's colour caught in the pane (`--glass-pickup`), and a saturated blur of what is behind. `--sheen-x` drifts with scroll/tilt (hub.js; `hub.sheenFrom(el)` for a custom scroller; off under reduced motion). Perf guard: `.card.glass` inside a scrolling page paints the look without `backdrop-filter`; use `.glass-lite` for the same on anything else. Each theme sets `--glass-spec/-edge/-ring/-inner`.
- **`apps/design.css`** holds the tokens (type, spacing, radii, shadows, light + dark palettes, kid/kiosk scales). `--accent` is the signed-in person's colour, set by hub.js. Component classes (`.btn`, `.card`, `.row`, …) apply only inside an element with class `ds` — put `class="ds"` on `<body>` to use them, or leave it off and keep your own component CSS (F260, Prayer, Larder and the Dollywood pair do that — but every colour in every app is a token; `screens-apps.mjs` fails on a hex).
- **Kid mode** (`<html data-kind="kid">`): bigger targets and type, only apps whose `visibleTo` includes the kid, simplified Home, kid-safe chat. **Kiosk mode**: no PIN, no tab bar, cannot write; Home shows the clock and the family reminders and refreshes itself.
- **Chat** (Chat tab): `POST /api/chat` → Claude (`claude-sonnet-5`) with tools that read and write `app_data` (list/get/set, add_list_item, add_prayer, mark_prayed, answer_prayer, finish_leftover, toggle_f260_reading, f260_status, where_is_family, and the kids-only read_todays_verse, which the shell speaks aloud); 60 messages per person per day. Full table in `worker/README.md`.
- **Photos** (Me tab): adults set their own photo (admin: anyone's) and add to the family album; the device makes a 256 px and a 1024 px square JPEG, the Worker stores them under an unguessable key (`worker/src/media.js`: R2 if a `MEDIA` bucket is bound, otherwise the D1 `media` table — R2 is not enabled on the account yet) and serves them from `/api/media/*` as immutable. `hub.avatarHtml(p)` renders photo-or-emoji; `hub.people()` gives apps everyone's faces; album rows are `app_data(family, 'hub', 'album:<id>')`.
- **Timer** runs in the shell: the Timer app writes `timer.active {endAt,total,startedAt}` in its person scope; `index.html` shows a glass pill on every tab while one is running, beeps and shows a local notification at 0, then clears it. The app resumes from `timer.active` if reopened.
- **Push** (Me tab): Web Push with VAPID; 8 am fridge warnings to adults, 8 pm F260 nudge, Sunday 8 pm "N readings behind", a new family prayer → the other adults, a stale kid marker on a park day → adults; per-person toggles for each kind. iPhone/iPad only from the Home Screen app. Rules in `worker/README.md` → Reminders.

## Adding an app

1. **Write `apps/<id>.html`, self-contained.** All CSS in `<style>`, all JS in `<script>`, no external scripts, no CDN, no fonts fetched over the network (Prayer's Google Fonts are the one grandfathered exception). Must open standalone *and* inside the hub's iframe.
2. **Import the shared pieces:**
   ```html
   <link rel="stylesheet" href="design.css">
   <script src="hub.js" data-app="<id>" data-scope="person"></script>   <!-- person | family | both -->
   <script>
   (async () => {
     await hub.ready();                                 // profile + cached data are ready; pulls in the background
     const n = hub.get('count', { default: 0 });        // hub.set(key, value) · hub.remove(key) · hub.list('item:')
     hub.onChange(render);                              // another device changed something
     hub.activity('Counted to ' + n);                   // shows in the family feed on Home
     hub.migrate([{ from: 'oldLocalStorageKey', to: 'count' }]);   // optional, once per device, adults only
   })();
   </script>
   ```
   Keys: `[A-Za-z0-9_.:-/]`, ≤ 200 chars. For lists use `item:<id>` rows and `hub.list('item:')`. Check `hub.canWrite` (false for the kiosk) before offering edits. `hub.voiceInput(text => …)` gives speech-to-text where the browser supports it. `hub.profile` is `{id, name, kind, isAdmin, color, emoji}`.
3. **Register it in `apps.json`** — one entry, valid JSON, no trailing commas:
   ```json
   { "id": "chores", "name": "Chore board", "file": "apps/chores.html", "color": "#5B6FA8", "icon": "icons/chores.svg", "scope": "family", "tile": "small", "visibleTo": ["eli", "christian"] }
   ```
   `scope` must match `data-scope`. `tile` is `small` or `wide` (wide tiles can render a widget in `index.html` → `widgetHtml`). `visibleTo` (profile ids) hides the app from everyone else — omit it for all. `icon` is an SVG file in `icons/` (duotone: a `class="duo"` path plus stroke paths, `currentColor`), or an emoji if you must. `"dark": true` darkens the viewer while loading.
4. **Give it art.** Add a spot illustration `art/app/<id>.svg` (200×160) in `scripts/make-art.mjs` and re-run it — the Home cards, empty states and the style guide pick it up from there; `scripts/test-art.mjs` fails until every app has one. See [`art/README.md`](art/README.md).
5. **Precache it** by adding the file, its icon and its art to the `SHELL` list in `sw.js`, then `node scripts/bump-sw.mjs` (bumps `VERSION` and checks the list). Skip precaching anything multi-megabyte (add it to the skip list in that script).
6. **Touch-first, all devices.** 44×44 px minimum targets (60 px+ for primary actions), no hover-only or right-click-only affordances (hover styles only under `@media (hover: hover) and (pointer: fine)`), Enter/Escape on inputs and dialogs, works from ~375 px to ~1400 px wide with no horizontal scroll, `viewport-fit=cover` with safe-area insets on edge-anchored controls, `localStorage` reads/writes in `try/catch`.
7. **Commit, push, verify live:** `git add apps/<id>.html apps.json icons/<id>.svg sw.js && git commit && git push`, then poll `https://vantrix117.github.io/house-hub/apps/<id>.html` until it returns 200 and confirm `apps.json` on the live site has the entry. Report that result, not just "pushed".

Legacy `localStorage` data goes to the **first adult** who opens the app on a device; kids never receive migrated data.

## Adding a chat tool

All in [`worker/src/chat.js`](worker/src/chat.js):

1. Add the tool definition to `TOOLS` (`name`, `description`, JSON-Schema `input_schema` with `additionalProperties: false`). Keep descriptions short and concrete — the model reads them.
2. Handle it in `runTool()`: validate the input yourself, respect `profile.kind` (kids: nothing on adult-only apps; kiosk never reaches chat), write through `putOne()` from `data.js` so the normal sync rules apply, call `activity()` so it appears on Home, and return `{ ok, result, chip }`. `result` goes back to the model (keep it small); `chip` is the human line shown in the Chat tab (`"✓ Added milk to leftovers"`) — `null` for read-only tools.
3. Mention the new capability in `systemPrompt()` if the model needs a hint about when to use it.
4. Test without a key: `node scripts/mock-anthropic.mjs` + `ANTHROPIC_BASE_URL="http://127.0.0.1:8791"` in `worker/.dev.vars` (git-ignored), teach the mock a trigger phrase, then `scripts/smoke-chat.sh http://127.0.0.1:8787 <local-code>`. Deploy with `npx wrangler deploy`.

## Push reminders

- Keys: `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` are vars in `worker/wrangler.toml`; `VAPID_PRIVATE_KEY` is a secret. Regenerate the pair with `web-push`'s `generateVAPIDKeys()` if it ever leaks (everyone must re-enable notifications afterwards).
- Schedule: `[triggers] crons = ["0 12,13 * * *", "0 0,1 * * *"]` — both possible UTC hours for 8:00 am and 8:00 pm New York; `runCron()` in [`worker/src/reminders.js`](worker/src/reminders.js) checks the local hour and runs `morningJob` (leftovers 5+ days old → adults) or `eveningJob` (no F260 reading logged today → that person). One notification per kind per person per day; dead subscriptions are deleted; per-person toggles come from `app_data(person, hub, push_prefs)`.
- To add a reminder type: write a `xJob(env, now)` next to the others, gate it in `runCron`, add a toggle in the Me tab (`renderNotif` in `index.html`) that writes `push_prefs.x`, and log with `pushTo(env, profileId, 'x', payload)`.
- Test: `npx wrangler dev --test-scheduled` and `curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=0+12,13+*+*+*"` (gated by the real clock), or force a job with `POST /api/admin/cron/run {"job":"morning"}` as the admin. `scripts/push-receiver.mjs` stands in for the push service and decrypts what the Worker sent. `scripts/test-push.mjs` checks the encryption against the RFC 8291 test vector.

## Admin operations

| Task | How |
|---|---|
| New device | Open the site, enter the pairing code once |
| Change the pairing code | Me → Admin → Pairing code, or `node scripts/set-pairing-code.mjs` (prompts; only the hash is stored) |
| Someone forgot their PIN | Me → Admin → Reset PIN (they create a new one on their next tap) |
| Rename / recolour / change kind | Me → Admin → Edit |
| Unpair a lost device | Me → Admin → Devices → Unpair |
| Chat/push usage | Me → Admin → Usage (30 days), or `GET /api/admin/usage` |
| Schema changes | Add an idempotent migration under `worker/migrations/`, run it with `npx wrangler d1 execute house-hub --remote --file …`, keep `schema.sql` in sync |
| Everything broken | Curl `/api/health`; `npx wrangler tail` for live logs; the SDK falls back to its local cache and shows a grey/red dot in the tab bar |

## Tests

| Script | What it proves |
|---|---|
| `scripts/smoke-api.sh <url> <pairing-code>` | Every endpoint: pairing, PIN flows, rate limits, scoped data, LWW, admin 403s, CORS |
| `scripts/test-hub.mjs <code>` | Headless Chrome: two devices on one profile, offline write → flush, first-tap PIN, kiosk read-only, kid visibility, migration |
| `scripts/test-apps.mjs <code>` | Migrated apps on hub.js, Home dashboard, widgets, admin panel, legacy migration counts, screenshots into `docs/screens/` |
| `scripts/test-push.mjs` | RFC 8291 known-answer test + VAPID signature |
| `scripts/test-design.mjs` | The style guide (`docs/design.html`) in every theme, kid/desktop; WCAG AA on every text pair for all eight family colours in all five palettes; reduced motion |
| `scripts/screens-themes.mjs <code>` | Home/Apps/Me in every theme at 390 and 1440 → `docs/screens/rm25-*.png`; theme-color meta follows; F260 follows `data-scheme` |
| `scripts/test-prefs.mjs <code>` | Preferences follow the person: theme set on one device shows on another, per person; F260 text size/autolock in person scope; the display profile gets a toast, not a crash |
| `scripts/test-photos.mjs <code>` | Profile photos + family album: upload/crop/size, second device sees the face (picker, feed, chat), kid/owner guards, delete |
| `node scripts/bump-sw.mjs [--check]` | Bumps `sw.js` VERSION and checks every precached file exists and every shipped app/icon/art file is precached (or on its skip list) |
| `scripts/test-art.mjs` | The `art/` illustration set: every SVG parses and renders, every app has a tile icon + spot art, all precached, ≤ 600 KB; contact sheets → `docs/screens/rm5-art-*.png` |
| `scripts/test-timer.mjs <code>` | Timer survives navigation: `timer.active` in person scope, shell pill on every tab (never over the chat composer), beep + local notification + toast at 0, second device sees it |
| `scripts/test-f260.mjs <code>` | F260 opens on Today: Done above the fold at 390, ticks the reading and publishes the summary, view is session-only, remote changes merge in place (no reload) |
| `scripts/test-prayer.mjs <code>` | Prayer: "Pray now" is the one primary action above the fold, Print/Copy/Kitchen in the More sheet, illustrated empty state |
| `scripts/test-leftovers.mjs <code>` | Larder list-first: oldest item + chip + sticky glass add bar all visible at 390×844, freshness bars, midnight rollover, Copy for Hearth |
| `scripts/test-home.mjs <code>` | Home widgets 2: prayer "N to pray · M done", the At-the-park card on park days, kids' stars (kid + adult Home), grouped feed with Show more; cards render from cache before the first pull |
| `scripts/test-push2.mjs <code>` | Push round 2 end to end against the stand-in receiver: weekly behind (Sun 8 pm), new family prayer → other adults, stale kid marker on a park day; opt-outs honoured; the three switches in Me |
| `scripts/screens-apps.mjs <code>` | Every app signed in, in every theme at 390/1024 → `docs/screens/rm27-*.png`; no hex in any app's `<style>` (Dollywood: map colours only), no OS-scheme selectors, page background follows the theme |
| `scripts/screens-shell.mjs <code>` | Every hub surface at 390/1024/1440, light + dark, adult/kid/kiosk → `docs/screens/rm4-*.png`; layout shift < 0.1; no hex in the shell's `<style>` |
| `scripts/smoke-chat.sh <url> <code>` | Every chat tool + guards, streamed; asserts the expected chip/refusal per call (39 checks with the mock) |
| `node handoff/prayer/check.js apps/prayer.html` | Prayer app logic (30 checks; the fixture the app used to seed now lives in the check) |

Local loop: `cd worker && npx wrangler dev --port 8787` with a seeded local D1 (`schema.sql`, `seed.sql`, `node ../scripts/set-pairing-code.mjs --local`), then the tests above against `http://127.0.0.1:8787`. The headless tests need `playwright-core` on `NODE_PATH` and Chrome or Edge installed; they serve the repo on `localhost:8765`, which is in the Worker's CORS allow-list.

## Do not touch

- `.nojekyll` — keeps GitHub Pages from running Jekyll and dropping files.
- `apps/prayer.html` and `apps/f260.html` layouts — they keep their own component CSS on purpose; restyle only through tokens (every colour a `design.css` token, never a hex, never `prefers-color-scheme`), layouts and ids stay.
- `handoff/` — reference material for the prayer app.
- The `DB` binding name in `worker/wrangler.toml` and the `app_data` unique index (`IFNULL(profile_id,'')` — SQLite treats NULLs as distinct).
