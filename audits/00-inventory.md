# House Hub audit, Phase 0: inventory and baseline

| | |
|---|---|
| **Baseline commit** | `fe6041d0eabcea96da19fe9a973ab21b5031e6d2` on `main`. It equals `origin/main` and is the commit GitHub Pages last built. |
| **Date** | 2026-09-23 |
| **Scope** | Read-only inventory. No app code was changed. Files were written only under `audits/`. |
| **Method** | Twelve read-only mappers each covered one area. Twelve adversarial verifiers re-opened 2,998 citations and made 277 corrections. A cross-section critic then checked the sections against each other. The lead reviewed every section and ran the runtime checks in §0.2. See §12. |

Conventions: `file:line` is repo-relative. `dw:` means `apps/dollywood.html` and `dwl:` means `apps/dollywood-live.html`. "NOT FOUND IN CODE." means the search named next to it found nothing.

## Contents

- [0. Baseline, hosting and deploy](#0-baseline-hosting-and-deploy)
- [At a glance: feature status and headline facts](#at-a-glance)
- [1a. Planned features: identity and roles](#1a-planned-features--identity-and-roles)
- [1b. Planned features: experience and platform](#1b-planned-features--experience-and-platform)
- [2. Bypasses of hub.js and design.css](#2-bypasses-of-hubjs-and-designcss-cross-cutting-sweep)
- [3. Hub shell: index.html](#3-hub-shell--indexhtml)
- [4. The hub.js SDK](#4-the-hubjs-sdk-appshubjs)
- [5. Design system: design.css](#5-design-system--appsdesigncss)
- [6. Worker: routes, auth, data, media](#6-cloudflare-worker-routes-auth-data-media)
- [7. Worker: chat, push, reminders, database](#7-cloudflare-worker--chat-push-reminders-database)
- [8. PWA, assets, app registry and repo layout](#8-pwa-assets-app-registry-and-repo-layout)
- [9a. Apps: F260, Verses, Kid Verse](#9a-apps--f260-reading-plan-verses-kid-verse)
- [9b. Apps: Prayer, Larder, Tally, Timer](#9b-apps--prayer-larder-ledger-tally-kitchen-timer)
- [9c. Apps: Dollywood build guide and park map](#9c-apps--dollywood-build-guide-and-park-map-generated)
- [10. Cross-section reconciliation](#10-cross-section-reconciliation)
- [11. What Phase 0 did not verify](#11-what-phase-0-did-not-verify)
- [12. Method](#12-method)

## 0. Baseline, hosting and deploy

### 0.1 Hosting (confirmed from config and the GitHub and Cloudflare endpoints)

The constitution's working belief was "Cloudflare, but it may be GitHub Pages". In fact both are used: GitHub Pages hosts the static site, and Cloudflare hosts the API, database and cron.

| Piece | Host | Evidence |
|---|---|---|
| Static site: `index.html`, `apps/`, `apps.json`, `sw.js`, `manifest.json`, `icons/`, `art/` | **GitHub Pages**, legacy "deploy from a branch" build from `main`, path `/`. HTTPS is enforced and there is no custom domain. | `gh api repos/Vantrix117/house-hub/pages` returns `build_type: legacy`, `source: {branch: main, path: /}`, `cname: null`, `https_enforced: true` and `public: true`. `pages/builds/latest` returns `status: built` and `commit: fe6041d…`, updated `2026-09-21T01:51:37Z`. The repo has no `CNAME` file and no `.github/` folder. The only Actions workflow is GitHub's own `pages-build-deployment`. `.nojekyll` is present (0 bytes). |
| API | **Cloudflare Worker `house-hub-api`** on `workers.dev`, with no route or custom domain | worker/wrangler.toml:1-4 (`name`, `main = src/index.js`, `compatibility_date = 2026-09-05`, `workers_dev = true`) |
| Database | **Cloudflare D1 `house-hub`**, binding `DB` | worker/wrangler.toml:17-20 |
| Scheduled jobs | Four UTC cron triggers (8 am and 8 pm New York across daylight saving) | worker/wrangler.toml:24-25; worker/src/reminders.js:247-261 |
| Media | The D1 `media` table. wrangler.toml has no R2 binding. | worker/wrangler.toml (no `[[r2_buckets]]`); worker/src/media.js:24-42 |
| Secrets | `VAPID_PRIVATE_KEY` and `ANTHROPIC_API_KEY` are Worker secrets and are not in the repo | Read at worker/src/reminders.js:21-22 and worker/src/chat.js:347. Whether they are set in production is NOT VERIFIED. |
| CORS allow-list | `https://vantrix117.github.io`, `http://localhost:8765`, `http://127.0.0.1:8765` | worker/wrangler.toml:8 |

**Live checks (2026-09-23, unauthenticated GETs only):**

| URL | Result |
|---|---|
| https://vantrix117.github.io/house-hub/ | 200 `text/html`, `server: GitHub.com` |
| `…/index.html`, `…/apps.json`, `…/sw.js`, `…/manifest.json` | 200 each |
| https://house-hub-api.catalystfarm1.workers.dev/api/health | 200 `application/json`, `server: cloudflare`, body `{"ok":true,…}` |
| Live `apps.json` compared with the local file | Identical (empty `diff`) |
| Live `sw.js` VERSION | `hub-v27`, the same as sw.js:7 |

**How each piece deploys:**
- **Site:** `git push` to `main`, and Pages rebuilds. There is no CI.
- **Worker:** `cd worker && npx wrangler deploy`, run by hand from a logged-in machine. `wrangler` is not installed globally on this machine (`npx --no-install wrangler` refused to run).
- **Status:** the deployed Worker has not been compared with `worker/src`. See §11.

### 0.2 Runtime checks the lead ran

**1. The shell does not boot when Reduce Motion is on. Confirmed, and live since 2026-09-17.**

- **Setup:** headless Chrome ran against the repo served locally and then against the live site, with the production API hostname mapped to a dead port so no request reached it. The only difference between the two runs was `--force-prefers-reduced-motion`.
- **With the flag:**
  - Console: `Uncaught (in promise) TypeError: hub.sheenFrom is not a function` at index.html:662.
  - `#gate` and `#shell` are both `hidden`, and the page is blank.
  - Screenshot: `audits/evidence/p0-reduced-shell-1280-chromium.png`
- **Without the flag:** the pairing screen renders. The screenshot `audits/evidence/p0-control-shell-1280-chromium.png` was taken during the entrance fade.
- **Same result on the live site:** `https://vantrix117.github.io/house-hub/index.html`, error at line 662.
- **Cause:**
  - apps/hub.js:442 returns early under `prefers-reduced-motion: reduce`, before `hub.sheenFrom` is assigned at apps/hub.js:447.
  - index.html:662 calls it with no guard, at the top level of the shell's async IIFE.
  - Boot routing never runs (index.html:1701-1706).
- **Introduced in:** `ddd6d42` (2026-09-17), per `git blame` of both lines.
- **Engine:** these runs used Chromium, not WebKit. They were not repeated on an iPad or iPhone. Nothing in this code path depends on the engine, and iOS reports `prefers-reduced-motion: reduce` when Settings → Accessibility → Motion → Reduce Motion is on.
- **Severity:** this meets the constitution's Critical bar (unusable on a primary device) for any family device with Reduce Motion turned on.

**2. "Rally the family" has no UI caller.**

- In apps/dollywood-live.html, `rally` appears only at:
  - 1577 (a comment)
  - 1589 (the definition of `async function rally(…)`)
  - 1591 (the confirm text "Tap Rally afterwards…")
- The source template has the same pattern (`../dollywood-build-project/scripts/template.html`: 1705, 1717, 1719).
- `POST` and `DELETE /api/dollywood/rally` exist on the Worker (worker/src/index.js:97-139), but nothing in the shipped UI reaches them. CLAUDE.md describes this feature as working.

**3. GitHub Pages publicly serves every tracked file, not only the site.**

- These returned 200: `CLAUDE.md`, `worker/seed.sql`, `worker/wrangler.toml`, `worker/src/auth.js`, `scripts/smoke-api.sh`, `docs/design.html` and `handoff/prayer/README.md`, all under `https://vantrix117.github.io/house-hub/`.
- None of them holds a secret:
  - The seed has no hashes (worker/seed.sql:2-11).
  - wrangler.toml holds the VAPID *public* key, a `mailto:` subject and the D1 database id.
- They do publish the household's profile names (children included) and the full server source.
- The GitHub repo itself is public as well (`public: true`).

### 0.3 Things that exist only on this machine, or would be lost or break on deploy (ground rule 5)

| Item | State | Why it matters |
|---|---|---|
| `../dollywood-build-project`, the sibling repo | A git repo with **no remote** (`git remote -v` prints nothing). Its working tree is clean at HEAD `0baf94d`. | This is the only copy of the template and build scripts that generate `apps/dollywood.html` and `apps/dollywood-live.html` (3.4 MB). If this machine is lost, those apps can be edited only by hand, and every hand edit is overwritten by the next export. **This is the largest local-only risk.** |
| `docs/screens/*.png`: 17 tracked files modified and not committed | `rm1-map-adult`, `rm1-map-kid`, `rm22-ipad`, `rm22-pc`, `rm22-pc-parchment`, and 12 × `rm27-dollywood-*` | Newer screenshots from the last Dollywood session. They do not affect the deploy, but a reset would lose them. This phase did not commit them. |
| `worker/.dev.vars` (git-ignored) | Holds 6 keys: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `HOUSE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`. Only the key names were read. | For local `wrangler dev` only. `HOUSE_KEY` is read nowhere in `worker/src`: the only `env.*` reads are `ALLOWED_ORIGINS`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `DB`, `MEDIA` and the three `VAPID_*` keys. Its only other trace is the optional `[house-key]` argument in scripts/smoke-api.sh:3, so it looks stale. `ANTHROPIC_BASE_URL` points chat at the mock, so it must never be set in production. |
| `worker/.wrangler/` (git-ignored) | Local D1, KV and cache state for `wrangler dev` | Local test data only |
| `worker/dev.log` (git-ignored) | Local log | Not deployed |
| `.claude/launch.json` (git-ignored) | Preview server: `npx -y http-server . -p 8765 -c-1 --silent` | Dev only. Port 8765 is in the Worker's CORS list, and the headless tests depend on it. |
| `files/` (git-ignored): `PROMPT.md`, `my-real-list.txt`, `prayer-handoff.zip` | Personal files | Not deployed. The contents were not read. |
| `christian-app-game-plan.html`, `prompt-generator.html` (git-ignored) | Loose personal pages beside the repo | Not deployed |
| `playwright-core` | Not installed. An earlier session put it in a scratchpad folder that no longer exists. | The 26 browser test scripts need it on `NODE_PATH`, and Phase 1 will too. |
| Worker deploys | Run by hand from a local `wrangler` login, with no CI | Any `worker/` edit does nothing until someone deploys it. The deployed code has not been compared with the repo. |

<a id="at-a-glance"></a>
## At a glance: feature status and headline facts

### Planned features

> **Every feature below depends on reduced motion being off.** With Reduce Motion on, the shell stays blank (§0.2).

| # | Feature | Status | Key evidence | What is missing or partial |
|---|---|---|---|---|
| 1 | Profile picker | **EXISTS** | index.html:516-550; worker/src/index.js:161-167 | The offline list can still show a guest whose stay has ended. The kiosk card appears on every paired device. |
| 2 | PIN created on first tap (adults) | **EXISTS** | index.html:549, 604-615; worker/src/index.js:252-268; worker/src/auth.js:4-38 | No self-service PIN change. The create-PIN route has no rate limit. Sessions last 365 days, and the shell has no auto-lock. |
| 3 | Device pairing code | **EXISTS** | index.html:498-513; worker/src/index.js:142-157, 507-517, 549-558 | "Forget this device" leaves the device row and push subscriptions on the server. Rotating the code does not unpair existing devices. |
| 4 | Kid mode | **PARTIAL** | apps/hub.js:80-81; apps/design.css:280-284; index.html:478-483, 1146-1157; worker/src/chat.js:52, 161 | `visibleTo` and kid limits are enforced only in the client for `/api/data`. Several kid-visible controls are text only. Larder, Timer and the park map have no kid rules. |
| 5 | Kiosk profile | **EXISTS** | worker/src/auth.js:108-112 (server read-only); index.html:78-79, 977-1143 | The server does not block kiosk push subscription. `#chat` and `#me` can be reached by URL hash. The TV's Switch button does not revoke the session. |
| 6 | Admin panel | **EXISTS** | index.html:1579-1688; worker/src/auth.js:113-117 | No UI for profile order or guest expiry. Household profiles cannot be added or removed, and admin rights cannot be moved. |
| 7 | Glanceable Home with widget tiles | **PARTIAL** | index.html:1158-1207, 685-707 | Widget tiles are on the Apps tab, not Home, and only F260 has one. Home re-renders on every 30 s pull, which wipes a half-typed reminder. |
| 8 | Per-profile accent and shared design.css | **PARTIAL** | apps/hub.js:74-82; apps/design.css:86-93 | All 9 apps link design.css, but only 4 apps and the shell use `.ds`. A colour change does not reach other devices' sessions or an open app iframe. |
| 9 | Skeleton loading | **PARTIAL** | apps/design.css:539-544; index.html:522, 948, 1158-1159, 1221-1222 | Shell only. No mini-app has any loading state, although the first pull can take up to 6 s. |
| 10 | Pull-to-refresh | **PARTIAL** | index.html:664-676 | Shell only and touch only. It is off while an app is open, and the indicator does not follow the finger. |
| 11 | Push notifications | **PARTIAL** | index.html:1534-1572; sw.js:53-70; worker/src/push.js; worker/src/reminders.js | Prayer and park jobs run only at 8 am and 8 pm, and prayers added between runs can go unannounced. Rally cannot be reached from the UI. Subscriptions follow the device, not the person. No `pushsubscriptionchange` handler. |
| 12 | Voice add | **PARTIAL** | apps/hub.js:415-427; index.html:1519-1527; apps/leftovers.html:313-326; apps/prayer.html:1763-1774 | Only Chat, Larder and Prayer have a mic. None on Home reminders. Where speech input is unsupported, the mic is hidden without explanation. |
| 13 | Family activity feed | **PARTIAL** | apps/hub.js:373-387; worker/src/index.js:321-329, 393-403; index.html:921-964 | Loaded once per session, with no live refresh. No retention policy. The offline queue is not per profile and can post a line twice. |
| 14 | Hub chatbot with actions and a per-profile daily cap | **PARTIAL** | worker/src/chat.js:14-18, 25-49, 112-117, 399-400 | Which apps are visible comes from the client. Kids can `set_data` on apps without `visibleTo`, including the park map's family rows. The failed-action chip never shows. The cap check is not atomic. |
| 15 | Cross-device sync | **PARTIAL** | apps/hub.js:231-321; worker/src/data.js:35-67 | 30 s polling only, and the poll stops after an in-page profile switch. One bad item drops the whole channel queue. Family-scope queues flush under whoever signs in next. |

EXISTS 5 · PARTIAL 10 · NOT FOUND 0.

### Headline facts

- **Registry:**
  - 9 apps (apps.json:4-12) and 16 tracked files in `apps/`. No page is unregistered and no registered page is missing (§8.3).
  - Visibility (index.html:478-483): adults and guests see 9 apps, kids 7, and the kiosk 0.
- **SDK** (§4):
  - 54 public members.
  - Sync is a localStorage write queue plus a 30 s poll (apps/hub.js:342). There is no server push for data.
  - The poll is not re-created after an in-page profile switch (apps/hub.js:338, 370; index.html:623).
- **Worker** (§6-§7):
  - 38 routes (worker/src/index.js:56-549) plus a `scheduled` handler (593-601).
  - 11 D1 tables with no foreign keys (worker/schema.sql).
  - 5 migrations, 3 of which cannot be run twice.
  - 4 cron triggers.
- **Enforcement:**
  - Kiosk read-only is enforced on the server (worker/src/auth.js:108-112).
  - `visibleTo` and kid limits are not enforced on `/api/data/*` (worker/src/index.js:280-284).
  - Chat takes app visibility from the list the client sends (worker/src/chat.js:395).
- **Chat:**
  - 12 tools (worker/src/chat.js:25-49), capped at 60 user messages per profile per New York day (chat.js:16, 112-117, 399-400).
  - The client streams through a raw `fetch`, which skips `hub.request`'s timeout and 401 handling (index.html:1502).
- **Push:**
  - 7 logged kinds: leftovers, f260, behind, prayer, park, rally, test.
  - `rally` has a route but no UI caller (§0.2).
- **design.css adoption:**
  - `class="ds"` is on only 5 of 10 pages: index.html:364, tally:129, timer:51, verses:99, kidverse:144.
  - Prayer, F260, Larder and both Dollywood exports keep their own component CSS.
  - Prayer loads Google Fonts (apps/prayer.html:12-14), the only external asset.
- **The largest bypasses are the Dollywood exports.** Each has 18 localStorage lines and a raw waits `fetch` with a hard-coded Worker URL (dw:1629-1630, dwl:1499-1500). They hold 294 and 257 hex literals, plus 59 in the payload. Each has 5 native dialogs. Both name Archivo and Fraunces but never load them.
- **Other bypasses:**
  - The shell and Kid Verse read hub.js's private `hub.cache.*` keys (index.html:889; apps/kidverse.html:467).
  - F260 keeps the legacy `f260.journal` in raw localStorage (apps/f260.html:897-900).
- **Native dialogs:** 20 `confirm()`/`alert()` call sites:
  - index.html: 9
  - apps/f260.html:1131: 1
  - each Dollywood export: 5
  - `prompt()`: none anywhere.
- **Loading and refresh:**
  - Skeletons exist only in the shell.
  - Pull-to-refresh is shell-only, touch-only, and off while an app is open.
- **Theme bug:** choosing Hearth explicitly still goes dark when the OS is in dark mode, while `data-scheme` stays `light`. hub.js:77 removes `data-theme` for both `hearth` and `system`, and design.css:176-177 applies the Midnight tokens to `:root:not([data-theme])`. This was found by reading the code. The rendered result is not verified.
- **PWA:**
  - The manifest has 4 icons and no `id` or `shortcuts`.
  - The service worker is `hub-v27` with 70 precached entries. It uses `skipWaiting` and `clients.claim`, and no page listens for `controllerchange`, so a TV that never closes keeps the old shell code until it is relaunched.
  - `apps/dollywood.html` and `apps/dollywood/aerial.jpg` are not precached.
- **Tests:**
  - 33 scripts in `scripts/`. All 26 browser scripts drive Chromium (Chrome or Edge).
  - There is no WebKit test anywhere.
  - docs/VERIFICATION.md:45 and :52 already list Safari as unverified.

## 1a. Planned features — identity and roles

### 1. Profile picker
**Status: EXISTS**

| What | Evidence |
|---|---|
| Boot routing: no device leads to pairing, no session leads to the picker, otherwise the shell opens | index.html:1704-1706 |
| `showPicker()` clears the session and shows the "Who's this?" gate with 8 skeleton cards | index.html:516-522 |
| Profiles come from `hub.profiles()` → `GET /api/profiles`. It is sent with `profile: false`, so only the device token goes | apps/hub.js:164; worker/src/index.js:161-167; worker/src/auth.js:74-77 |
| Server order is `sort_order, name` | worker/src/index.js:165 |
| Expired guests are hidden unless the caller is admin. The picker never sends a profile token, so the admin bypass applies only to the admin panel's own call | worker/src/index.js:163-166; worker/src/auth.js:45; apps/hub.js:164; index.html:1582-1583 |
| An expired guest's login is refused on the server | worker/src/index.js:236 |
| Faces: `avatar(p,'avatar-lg')` → `hub.avatarHtml` (photo if set, otherwise emoji on the person's colour) | index.html:455, 534; apps/hub.js:457-462; worker/src/auth.js:69 |
| Per-kind subtitle, first match wins: Guest (· PIN · until/ended date), then Welcome back (last profile), Tap to start (kid), Display (kiosk), PIN / Create your PIN (adult) | index.html:535 |
| Last profile gets a ring and focus | index.html:47-48, 533, 541 |
| Tap routing: kid, kiosk and PIN-less guest sign in on tap; an adult goes to the PIN pad or PIN creation | index.html:543-550 |
| Offline fallback to cached `hub.profiles` | index.html:523-530 |
| Layout: 2, 3 or 4 column grid; card min-height 156px | index.html:38-42 |
| Server login: only `kind==='adult'` (except a PIN-less guest) needs a PIN | worker/src/index.js:238 |

Gaps:
- `:root[data-kind="kid"] .pcard, :root[data-kind="kiosk"] .pcard` (index.html:51) never matches in the picker. `showPicker` calls `hub.setSession(null)` (index.html:517), and `applyTheme` then deletes `data-kind` (apps/hub.js:81). It would change nothing anyway, because it repeats the base `min-height: 156px` (index.html:42).
- The offline fallback renders the list cached at the last successful fetch, which the server had already filtered (index.html:525; apps/hub.js:164). There is no client-side expiry filter (index.html:527, 532-536), so a guest whose stay ended after that fetch still shows while offline. Their login fails on the server (worker/src/index.js:236).
- The kiosk profile ("Downstairs TV", seed sort 8) appears in the picker on every paired device (worker/seed.sql:11; index.html:532-536). There is no device-to-profile restriction.
- On the last-used card, "Welcome back" replaces the kind/PIN hint (index.html:535).

### 2. PIN created on first tap (adults)
**Status: EXISTS**

| What | Evidence |
|---|---|
| Card hint "Create your PIN" for an adult with `has_pin` false | index.html:535; worker/src/auth.js:66 |
| Client routing: `has_pin` goes to `showPinPad`, otherwise `showCreatePin` | index.html:549 |
| Create flow: choose 4–8 digits, type again to confirm, a mismatch resets | index.html:604-608 |
| Create calls `hub.createPin`; on `pin_already_set` it falls back to the PIN pad | index.html:609-614; apps/hub.js:171-174 |
| PIN pad calls `hub.login`; `needs_pin_setup` falls back to create | index.html:598-603; apps/hub.js:167-170 |
| Keypad: 0–9 buttons (min-height 64px), 4–8 digits, Continue disabled under 4, keyboard digits/Backspace/Enter/Escape | index.html:551-566, 567-597, 60 |
| Server create (`POST /api/profiles/:id/pin`): adults only, guests refused (`guest_pin_fixed`), only while `pin_hash` is NULL, conditional UPDATE (race-safe), `PIN_RE` 4–8 digits, returns a session | worker/src/index.js:23, 251-268 |
| Server login: adult with NULL PIN → `needs_pin_setup`; wrong PIN → 401; rate limit 5 per 15 min per profile+device | worker/src/index.js:231-249 |
| Hashing: PBKDF2-SHA256, random 16-byte salt, 10,000 iterations; constant-time compare | worker/src/auth.js:4-5, 14-24, 26-38 |
| Schema: `pin_hash` NULL means no PIN yet; seed adults start NULL | worker/schema.sql:10; worker/seed.sql:2-11 |
| Admin reset sets the PIN to NULL and deletes that profile's sessions, so the next tap creates a new PIN | worker/src/index.js:445-451 |

Gaps:
- No self-service "change my PIN". NOT FOUND IN CODE. Searched `change.{0,10}pin|new pin|pin/change|changePin|change-pin|forgot` (case-insensitive) in index.html, apps/hub.js and worker/src/*.js. The only route to a new PIN is an admin reset.
- No client handling of the 429 `retry_after` value on PIN attempts. NOT FOUND IN CODE. Searched `retry_after|too_many|429` in index.html and apps/hub.js. The only 429 handling is the chat daily cap (index.html:1503) and the activity queue (apps/hub.js:382). The PIN pad shows only the server's message text (worker/src/auth.js:133 → index.html:575).
- `POST /api/profiles/:id/pin` has no rate limit and needs only a device token (worker/src/index.js:252-253). Any paired device can claim an adult whose `pin_hash` is NULL.
- No automatic sign-out or lock after inactivity in the shell. NOT FOUND IN CODE. Searched `autolock|idle|inactiv|lockAfter|auto-lock` in index.html and apps/hub.js. Sessions last 365 days (worker/src/auth.js:6).
- The PBKDF2 iteration count is a deliberate low value (worker/src/auth.js:4-5).

### 3. Device pairing code
**Status: EXISTS**

| What | Evidence |
|---|---|
| Pairing gate: code field (`type=password`, minlength 6) and "Name this device" (default from the user agent) | index.html:498-513, 445-448 |
| `hub.pair` stores `{id, token, name}` in `localStorage['hub.device']` | apps/hub.js:27, 159-163 |
| `POST /api/pair`: IP rate limit (10 fails per 15 min), verify against `settings.pairing_code_hash`, 503 if unset | worker/src/index.js:142-152 |
| Device token stored as SHA-256 only | worker/src/index.js:153-155; worker/src/auth.js:12, 76; worker/schema.sql:44-50 |
| Every authenticated `/api` route requires the device token. `/api/health`, `/api/dollywood/waits`, `/api/pair` and `/api/media/*` never call `c.auth()` | worker/src/auth.js:74-77; apps/hub.js:130; worker/src/index.js:56, 63-78, 142, 384-391 |
| Profile sessions are bound to the device that created them | worker/src/auth.js:91; worker/schema.sql:52-59 |
| Code stored hashed: the CLI prompts (hidden, typed twice) and writes only a PBKDF2 hash | scripts/set-pairing-code.mjs:7-9, 36-45; worker/schema.sql:97-100 |
| Rotate (admin): `POST /api/admin/pairing-code/rotate`, a chosen code (6–64 characters) or a generated 8-character one returned once; stored via `hashSecret` | worker/src/index.js:507-517 |
| Rotate UI: "Choose a new code" (typed twice) or "Generate one" (shown once in a sheet) | index.html:1600-1602, 1642-1657 |
| Unpair (admin): deletes the device's sessions, push subscriptions and device row; refuses its own device | worker/src/index.js:549-558 |
| Unpair UI: device list (name, paired, last seen, "this device") with an Unpair button | index.html:1603-1605, 1637-1640; worker/src/index.js:528 |
| An unpaired device clears `hub.device` and shows pairing again ("This device was unpaired.") | apps/hub.js:147-150; index.html:766, 771 |
| "Forget this device" (Me → Sync) | index.html:1278, 1285-1289 |

Gaps:
- "Forget this device" only removes the `hub.*` localStorage keys (index.html:1287). It makes no `/api/logout` or device call, so the device row, its sessions and push subscriptions stay on the server. The only server unpair is admin-only and refuses the calling device (worker/src/index.js:550-551).
- Rotating the code does not unpair existing devices (worker/src/index.js:514-516; UI text at index.html:1601; scripts/set-pairing-code.mjs:53).
- Device rows never expire. The only `DELETE FROM devices` is the admin unpair (worker/src/index.js:555).

### 4. Kid mode
**Status: PARTIAL**

| What | Evidence |
|---|---|
| `<html data-kind>` set from `profile.kind` on every page that loads hub.js | apps/hub.js:80-81; `hub.isKid` at apps/hub.js:113 |
| Kid tokens: `--tap` 64 / `--tap-lg` 84, larger type scale, rounder radii | apps/design.css:280-284 |
| `.ds .btn` uses `min-height: var(--tap)`, so kid sizing reaches any `class="ds"` page | apps/design.css:351, 366 |
| Kid grid and tiles: 2/3/4 columns, 88px tile icon | index.html:236-240 |
| Kid chat bubble font | index.html:268 |
| App filter (client): `!a.visibleTo \|\| a.visibleTo.includes(p.id)`; `openApp` refuses unseen apps | index.html:478-483, 715; apps.json:4-12 |
| Kid login needs no PIN (client and server) | index.html:544; worker/src/index.js:238 |
| Simplified Home: greeting hero, "Let's play — open your apps" CTA, Stars card, park card on park days, read-only Reminders (Done only for adults) | index.html:1146-1157, 1224 |
| Kid-safe chat: kid system-prompt block | worker/src/chat.js:336-340 |
| Kid-safe chat: tool allow-list `KID_TOOLS` | worker/src/chat.js:52, 161 |
| Kid-safe chat: `set_data` guard, reminders refusal | worker/src/chat.js:174, 193 |
| Kid-safe chat: `read_todays_verse` (kid only, `speak`) | worker/src/chat.js:302-307 |
| Kid-safe chat: the shell speaks the verse and shows a kid greeting | index.html:1456-1459, 1497, 1474 |
| Other server kid refusals: photo, adding guests, album, rally | worker/src/index.js:336, 176, 363, 92 |
| Per-app kid handling: Prayer (family list only, one screen, adult controls hidden, 64px Prayed button) | apps/prayer.html:395-402, 421, 638, 1154, 1578-1590 |
| Per-app kid handling: Kid Verse | apps/kidverse.html:37-130, 349-366, 654-660 |
| Per-app kid handling: Verses (this week's two verses plus any with a recall row, 64px buttons) | apps/verses.html:34-67, 222, 228 |
| Per-app kid handling: Tally (116/168px buttons) | apps/tally.html:121-124 |
| Per-app kid handling: park map (JS only: a kid's device stays view-only unless an adult has switched on that kid's beacon) | apps/dollywood-live.html:1538, 1601 |

#### Kid flows without reading (code level)

| Control (kid-visible) | Icon/face | Text | Evidence |
|---|---|---|---|
| Picker card | avatar/photo | name | index.html:533-535 |
| Tab bar Home/Apps/Chat/Me | icon | label | index.html:396-399 |
| App tile | icon | name label (a wide tile shows a widget and an `aria-label`) | index.html:700-702 |
| Viewer pill: "Hub" / app name / reload | back icon + text / text + chevron / icon only | mixed | index.html:408-411 |
| "Switch app" sheet (from the pill) | **none** | text-only app, Home and Me buttons | index.html:738-741 |
| Kid Home CTA "Let's play…" | sparkle icon | yes | index.html:1151 |
| Stars card count | star icon + number | yes | index.html:906 |
| Stars card "Open Kid Verse" | **none** | text only | index.html:909 |
| Park card "Open the map" (kid Home, park days) | **none** (card has faces) | text only | index.html:900, 1148 |
| Kid Home Reminders rows | **none** | text only | index.html:1225 |
| Kid Verse "Read it to me", "Done ★", "I heard it" | icon | yes, read-aloud exists | apps/kidverse.html:159-160, 172-173 |
| Verses "Not yet / Almost / Got it" | icon | yes | apps/verses.html:113-115 |
| Prayer kid card request title | asker face or 🙏 | title is **text only** | apps/prayer.html:1581-1582, 1585 |
| Prayer "Prayed" button | check icon | yes | apps/prayer.html:1587-1588 |
| Me "Switch" | **none** | text only | index.html:1253 |
| Me Appearance theme cards | swatch preview | name + blurb | index.html:1258-1261 |
| Me Notifications switch / "Send a test notification" | switch / **none** | text label / text only | index.html:1262-1270 |
| Me "Check now" / "Forget this device" (with `confirm()`) | **none** | text only; shown to kids | index.html:1278, 1286 |
| Chat composer | mic only if SpeechRecognition exists | text input; replies spoken only for `read_todays_verse` | index.html:386-388, 1521, 1497; apps/hub.js:427 |
| Larder add form | mic only if voice is supported | text input + select + date | apps/leftovers.html:120-131, 314-316 |

Gaps:
- **Visibility is client-only (data).** The server does not enforce `visibleTo` or kid limits on `/api/data`. `dataArgs` checks only scope and writer (worker/src/index.js:280-284), so a kid session can write any family-scope row (worker/src/index.js:298-318). A family-scope GET needs only the device token (`auth.profile` may be null, worker/src/index.js:282). Searched `'kid'|"kid"|visibleTo|apps.json` in worker/src/index.js, data.js and auth.js. The only hits are the guest chat rewrite (433-436) and kind validation (470). Kid write limits exist only in chat (worker/src/chat.js:174, 193) and in the UI (index.html:1224).
- **Visibility is client-only (chat).** Chat visibility comes from the `apps` list the client sends (index.html:1494, 1502 → worker/src/chat.js:395, 118-119).
- Apps with no `visibleTo` (Larder, Tally, Timer, park map: apps.json:5, 7, 8, 10) are shown to kids (index.html:481). This differs from the "only apps whose visibleTo lists them" wording.
- Larder has no kid rules, no `ds` class on body (apps/leftovers.html:100) and no `var(--tap)` (0 grep hits). It uses fixed px sizes (for example apps/leftovers.html:47-55). The park map has no `var(--tap)` and no `data-kind` CSS rules (grep of apps/dollywood-live.html). Timer has no kid rules either (0 hits for `data-kind|isKid|--tap` in apps/timer.html), but its `body.ds` (apps/timer.html:51) picks up `--tap` through `.ds .btn` (apps/design.css:351).
- The text-only kid controls listed in the table above: index.html:740-741, 900, 909, 1225, 1253, 1270, 1278; apps/prayer.html:1585.

### 5. Kiosk profile
**Status: EXISTS**

| What | Evidence |
|---|---|
| No PIN: picker shows "Display", signs in on tap; server requires a PIN only for adults; seed kiosk `pin_hash` NULL | index.html:535, 544; worker/src/index.js:238; worker/seed.sql:11 |
| **Server read-only check**: `requireWriter` → `if (p.kind === 'kiosk') throw new HttpError(403, 'read_only', …)` | worker/src/auth.js:108-112 |
| `requireWriter` used by data PUT/DELETE/batch via `dataArgs(…, true)` | worker/src/index.js:282, 298-318 |
| `requireWriter` also used by POST /api/profiles, photo PUT/DELETE (via `canEditPhoto`), album POST/DELETE, POST /api/activity | worker/src/index.js:175, 334 (339-359), 362, 374, 394 |
| Chat refused for kiosk (`no_chat`) | worker/src/index.js:431; worker/src/chat.js:391 |
| Rally refused for kiosk (`kind !== 'adult'`) | worker/src/index.js:92 |
| Client read-only: `canWrite` false; `hub.set` throws `read_only` with a toast; flush drops the queue on a 403 `read_only` | apps/hub.js:114-115, 231-234, 247-249, 266 |
| No tab bar (CSS only) | index.html:78-79 |
| Forced to Home on shell entry | index.html:626 |
| No apps | index.html:479 |
| No chat | index.html:1465 |
| No Notifications card | index.html:1262, 1291 |
| Home reminders have no Done button (adults only) | index.html:1224 |
| TV board: blurred album crossfade, clock, verse, prayed today, stars, reading today, feed, reminders pane hidden when empty; one Switch button | index.html:977-1143 (markup 1119-1128; reminders hide 1074) |
| Self-refresh: 1 s tick, repaint each minute, feed every 5 min | index.html:1110-1116, 1142 |
| Kiosk type scale | apps/design.css:286-289 |
| Kiosk board CSS | index.html:101-104, 123-175, 355 |
| Kiosk theme is device-local: `adoptTheme` skips the kiosk; `setTheme` writes the server only when `canWrite` | apps/hub.js:84-85, 91, 98 |

Gaps:
- `POST /api/push/subscribe`, `DELETE /api/push/subscribe` and `POST /api/push/test` use only `requireProfile`, not `requireWriter` (worker/src/index.js:410-426, 534-539). A kiosk token can subscribe to push on the server. The UI hides this for the kiosk (index.html:1262).
- The `hashchange` handler has no kiosk guard (index.html:650-654). `#apps`, `#chat` and `#me` can be reached by URL. `showTab('chat')` un-hides the composer (index.html:636); `openChat` returns early for the kiosk (index.html:1465), but `chatEnabled` defaults to true (index.html:1437), so a send reaches the server and gets a 403 (worker/src/index.js:431). `#me` shows Appearance, Switch, "Check now" and "Forget this device" (index.html:1253, 1258, 1278).
- The TV "Switch" calls `showPicker()` (index.html:1133), which only clears the local session (index.html:517). The kiosk's server session is not revoked, and sessions last 365 days (worker/src/auth.js:6). By contrast, Me → Switch calls `hub.signOut()` → `/api/logout` (index.html:1282; apps/hub.js:175-178; worker/src/index.js:272-277).

### 6. Admin panel
**Status: EXISTS**

| What | Evidence |
|---|---|
| Admin card only when `p.isAdmin`, in Me | index.html:1280, 1290 |
| `isAdmin` comes from `is_admin` (seed: eli) | apps/hub.js:61; worker/seed.sql:4 |
| Loads profiles (with the profile token, so expired guests show) and usage | index.html:1579-1585 |
| Profiles list: kind, PIN state, guest details; Edit, Reset PIN (adults with a PIN), Clear PIN / Remove / Purge for guests | index.html:1593-1599, 1615-1636 |
| `confirm()` on Reset/Clear PIN, Remove, Purge, Unpair and Generate code. Edit and "Choose a new code" have none | index.html:1620, 1627, 1633, 1638, 1643 |
| Edit sheet: name, emoji, photo, colour swatches, kind (disabled for the admin) | index.html:1659-1688 |
| Server edit: validation; admin must stay adult; guest must stay adult; PIN cleared when kind is not adult | worker/src/index.js:453-479 |
| Reset PIN | worker/src/index.js:445-451 |
| Remove/purge guest, purge all expired guests | worker/src/index.js:483-505 |
| Rotate pairing code (UI and server) | index.html:1600-1602, 1642-1657; worker/src/index.js:507-517 |
| Devices and unpair (UI and server) | index.html:1603-1605, 1637-1640; worker/src/index.js:549-558 |
| Usage (30 days) in the UI: chat messages per person per day, push ok/sent per kind | index.html:1606-1613; worker/src/index.js:519-531 |
| **Server admin checks**: `requireAdmin` → `if (!p.is_admin) throw 403 'admin_only'` | worker/src/auth.js:113-117 |
| `requireAdmin` used on every `/api/admin/*` route and for a push test to another profile | worker/src/index.js:446, 454, 484 (`guestFor`, used at 491, 496), 503, 509, 520, 537, 542, 550 |
| Admin may edit anyone's photo (server and edit sheet) | worker/src/index.js:335; index.html:1665, 1672-1678 |

Gaps:
- The server accepts `sort_order` and a guest's `expires_at` (extend or end a stay) (worker/src/index.js:462-467), but the edit sheet sends only `name, emoji, color, kind` (index.html:1681). Reordering profiles and changing a guest's expiry are not reachable from the UI.
- For a guest, the Kind select still offers Kid and Display (only disabled for the admin, index.html:1667). The server rejects them (`guest_must_be_adult`, worker/src/index.js:472).
- Colour swatches are labelled with hex strings (`aria-label="${c}"`, index.html:1666).
- The usage tables show at most 30 rows each (index.html:1589). The server's `push_subscriptions` counts (worker/src/index.js:529-530) are never rendered (0 hits for `push_subscriptions` in index.html).
- Admin endpoints with no UI caller: `POST /api/admin/guests/purge` (worker/src/index.js:502-505), `POST /api/admin/cron/run` (worker/src/index.js:541-547), and a push test to another profile (worker/src/index.js:537). The UI sends `{}` (index.html:1546). Searched `guests/purge|cron/run` in index.html: 0 hits.
- No way to add or delete a household (non-guest) profile. The only `INSERT INTO profiles` outside seed.sql is guest creation (worker/src/index.js:196-198). Delete and purge are guest-only (worker/src/index.js:216, 487).
- No way to move admin rights: `is_admin` is not an editable field in `PUT /api/admin/profiles/:id` (worker/src/index.js:458-462, 474).

## 1b. Planned features — experience and platform

### 7. Glanceable Home with widget tiles
**Status: PARTIAL.** Home is built from glance cards. The tile grid with wide-tile widgets is on the Apps tab, not on Home, and only one app (F260) has a widget.

| What | Evidence |
|---|---|
| Home view is empty until `renderHome()` fills it; the Apps tab holds `#grid` | index.html:377-380 |
| Adult Home: hero plus a summary line (`bits`), glance cards, then Reminders and "Around the house" in `.two-col` | index.html:1158-1207 |
| Card: Today's reading (F260 ring, next ref, streak) | index.html:1162-1171 |
| Card: In the fridge (count ≥4 days old, top 3 freshness bars) | index.html:1172-1182, 680-681 |
| Card: Prayer (due/done, streak; person scope only) | index.html:1183-1194, 837-869 |
| Card: At the park (only when a `loc:*` row is under 4 h old) | index.html:1195, 870-878, 891-901 |
| Card: Kids (stars and badges per kid; adults) | index.html:1196, 911-919 |
| Kid Home: Stars card, optional park card, Reminders | index.html:1146-1156, 902-910 |
| Kiosk Home: TV board | index.html:977-1143 |
| Cards paint from cache before the first pull (`cached()`) | index.html:888-889, 1158-1159 |
| Home repaints on `onChange` (any non-reminders row) and on every new `lastPull` | index.html:1236-1243 |
| Apps registry: only `f260` is `"tile":"wide"`; the other 8 are `small` | apps.json:4, 5-12 |
| `widgetHtml()` has only an `f260` branch; every other app gets just its label | index.html:685-692 |
| `renderGrid()` puts `twidget` in wide tiles; the Larder small tile shows a count badge | index.html:693-707 (699, 702-703) |
| Grid re-renders on f260/leftovers changes and on each pull | index.html:1240, 1243 |

Grid CSS and columns:

| Container | <700 / <720 px (phone 390) | ≥700 / ≥720 px (iPad 820) | ≥1024 px (iPad landscape, desktop 1280) | Evidence |
|---|---|---|---|---|
| `.grid` app tiles (adult) | 4 cols | 6 cols (≥700) | 8 cols | index.html:218-220 |
| `.tile.wide` span | 4 (full row) | 3 | 3 | index.html:229-230 |
| `.grid` kid | 2 cols | 3 cols | 4 cols | index.html:236-238 |
| `.glance` Home cards | 1 col | 2 cols (≥720) | 3 cols (`.two` → 2) | index.html:105-107 |
| `.two-col` reminders/feed | 1 col | 1 col | `3fr 2fr` | index.html:189-190 |
| `.view` width | max 880 px | max 880 px | `var(--max)` = 1200 px, plus the 220 px sidebar | index.html:68, 82-84; apps/design.css:33 |
| Kiosk `.tv` | 2 cols | 2 cols | 2 cols up to 1199 px; 3 cols (`5fr 4fr 4fr`) at ≥1200 | index.html:134-136 |

Gaps:
- Home has no tiles or wide widgets. `widgetHtml` output appears only in the Apps grid (index.html:702, inside `#grid`, index.html:380).
- Only F260 has a tile widget (index.html:685-692). Tally, Timer (only the shell pill, index.html:813-823), the Dollywood build guide and Verses have no widget and no Home card. Searching index.html for `verses\.summary|'verses'|tally|'dollywood'` found nothing, so Home never reads `verses.summary`.
- Every successful pull re-renders the whole of Home. `lastPull` changes on each pull (apps/hub.js:311), so the `onSync` handler calls `renderHome()` every 30 s while Home is open (index.html:1243). `renderHome()` replaces `#view-home` via `innerHTML` (index.html:1200-1207), which rebuilds the `#remtext` reminder input (index.html:1204) and loses anything half-typed in it. No code saves or restores that value.
- Latent layout conflict: `.tile.wide` spans 4 (index.html:229) inside the 2-column kid grid (index.html:236). It does not show today because F260's `visibleTo` excludes the kids (apps.json:4).
- The fridge thresholds differ. The Home badge and card count items ≥4 days old (index.html:681); the push job uses ≥5 days (worker/src/reminders.js:69).

### 8. Per-profile accent colour and shared design.css
**Status: PARTIAL.** `--accent` is set from the profile and every app links design.css. A colour change made on another device reaches an existing session only after sign-out and sign-in, and an open app iframe does not pick up a change at all.

| What | Evidence |
|---|---|
| `applyTheme()` sets `--accent` inline on `<html>` from `hub.profile.color` and removes it when signed out | apps/hub.js:74-82 (80-81) |
| `color` comes from the session profile | apps/hub.js:60-62, 105-111 |
| Default `--accent: var(--mocha)` plus the derived `--accent-soft/-tint/-deep/-strong/-glow`, `--on-accent`, `--tint` | apps/design.css:86-93 |
| Per-theme redefinitions of the derived accent tokens | apps/design.css:129-131, 149-151, 169-171, 190-192, 211-213, 231-233, 251-253, 270-272 |
| Accent caught in glass (`--glass-pickup`) | apps/design.css:66, 392 |
| `.ds` components paint from the accent (`.btn-primary`, `.btn-soft`, `.tab.on`, `.hero`) | apps/design.css:361-362, 564, 412 |
| Shell links design.css; its body is `.ds` | index.html:17, 364 |

Apps linking design.css, and their use of `var(--accent…)`:

| App | Links design.css | `class="ds"` on body | Lines with `var(--accent` | Sample use |
|---|---|---|---|---|
| index.html (shell) | index.html:17 | index.html:364 | 17 | — |
| tally | apps/tally.html:7 | apps/tally.html:129 | 10 | apps/tally.html:14-16, 47 |
| timer | apps/timer.html:7 | apps/timer.html:51 | 3 | apps/timer.html:22, 32, 44 |
| verses | apps/verses.html:7 | apps/verses.html:99 | 1 (+ `.btn-primary` "Show", apps/verses.html:110) | apps/verses.html:18 |
| kidverse | apps/kidverse.html:7 | apps/kidverse.html:144 | 2 | apps/kidverse.html:17, 372 |
| leftovers | apps/leftovers.html:7 | no (apps/leftovers.html:100) | 1 (add-bar glass pickup) | apps/leftovers.html:39 |
| prayer | apps/prayer.html:10 | no (apps/prayer.html:433) | 23 | apps/prayer.html:96, 115 |
| f260 | apps/f260.html:6 | no (apps/f260.html:529) | 3 | apps/f260.html:58, 385 |
| dollywood-live | apps/dollywood-live.html:683 (inside `<body>`, after `</head>` at :566) | no (apps/dollywood-live.html:566) | 47 | apps/dollywood-live.html:211, 214 (comments), 215 (first use) |
| dollywood | apps/dollywood.html:683 (inside `<body>`, after `</head>` at :566) | no (apps/dollywood.html:566) | 47 | apps/dollywood.html:211 (comment) |
| design.css itself | — | — | 51 | — |

All 9 apps load hub.js, which applies `--accent`: apps/f260.html:777, apps/verses.html:149, apps/timer.html:73, apps/tally.html:142, apps/prayer.html:573, apps/leftovers.html:133, apps/kidverse.html:180, apps/dollywood.html:684, apps/dollywood-live.html:684.

Gaps:
- The session profile, and with it `--accent`, is updated only by login/createPin (apps/hub.js:169, 173), a photo change (apps/hub.js:482, 488) or an admin edit of their own profile on the same device (index.html:1684). `GET /api/me` exists (worker/src/index.js:270), but no client calls it (searched `api/me` across index.html, apps/hub.js and apps/*.html). An admin recolour therefore does not reach other devices' open sessions.
- An open app iframe keeps its old accent even after a same-device edit. Its `storage` listener handles only the theme, cache and queue keys, not `hub.session` (apps/hub.js:350-364).
- Leftovers does not use `.ds`. Its one accent use is the add-bar glass tint (apps/leftovers.html:39); its controls use their own CSS. Prayer and F260 also skip `.ds`, so design.css's accent-driven component classes do not apply to them (apps/design.css:319-321).
- Verses overrides the accent on its rating buttons (`.not/.almost/.got` redeclare `--accent`, `--accent-soft` and `--accent-deep`, apps/verses.html:56-58). Only "Show" keeps the person's colour (apps/verses.html:110).
- Kid Verse sets `--accent: var(--gold)` on `.btn.done` and `.btn.story-heard` (apps/kidverse.html:55, 137) but does not redeclare `--accent-deep`. `.btn-primary` paints from `--accent-deep` (apps/design.css:361), which is computed on `:root` (apps/design.css:89), so these buttons probably still render in the person's colour (needs a runtime check).

### 9. Skeleton loading
**Status: PARTIAL.** A shimmer skeleton exists and is used across the shell. No mini-app has a skeleton or spinner; the only mini-app busy state is one line of text in F260's vault dialog.

| Loading state | Kind | Evidence |
|---|---|---|
| `.ds .skeleton` + `hub-shimmer` keyframes | shimmer skeleton (definition) | apps/design.css:539-544 |
| Reduced motion collapses animations | a11y | apps/design.css:611-613 |
| Profile picker: 8 `pcard skeleton` | skeleton | index.html:50, 522 |
| F260 wide tile subline shows "loading" until the first pull | skeleton | index.html:688 |
| Home cards `sk` (F260, fridge, prayer) when neither pulled nor cached | skeleton | index.html:1158-1159, 1168, 1179, 1191-1192 |
| Home hero subline blank until pulled/cached | blank | index.html:1199 |
| Reminders list: 2 skeleton rows | skeleton | index.html:1221-1222 |
| Feed: 4 skeleton rows (avatar + 2 lines) | skeleton | index.html:948 |
| Feed "Show more" → button text "Loading…" | text | index.html:959 |
| Admin panel: 120 px skeleton | skeleton | index.html:1280 |
| Chat history: skeleton bubble | skeleton | index.html:1468 |
| Chat reply: typing dots | animated dots | index.html:255-258, 1492 |
| Pull-to-refresh `#ptr.busy` spin | spinner | index.html:76-77, 673-675 |
| Notifications help "Checking…" | text | index.html:1263 |
| Photo upload toast "Uploading…" | toast | index.html:1304, 1676 |
| Kiosk hides skeletons in the reminders pane | — | index.html:173 |
| F260 vault dialog "Unlocking…" / "Encrypting…" | text | apps/f260.html:1163 |
| Dollywood waits "Loading wait times…" | text | apps/dollywood-live.html:1526; apps/dollywood.html:1656 |

Gaps:
- Mini-apps: searched `skeleton|shimmer|spinner|Loading|loading…|aria-busy` (case-insensitive) in tally, timer, leftovers, prayer, f260, verses and kidverse. NOT FOUND IN CODE. A search for `[A-Z][a-z]+ing…` found only the F260 vault text above and "Reading…", which is the text-to-speech button label in Verses and Kid Verse (apps/verses.html:279; apps/kidverse.html:310, 625), not a loading state.
- `hub.ready()` waits up to 6 s on a device that has never pulled (apps/hub.js:334-337). The apps above show no loading state during that wait.
- Kid Home Stars card has no loading state. It shows 0 / "No stars yet" before the first pull (index.html:1147, 907).
- App viewer iframe has no load indicator. `openApp` only sets `frame.src` (index.html:724); `#frame` has no loading styles (index.html:332); `#viewer.dark` only changes the background (index.html:331). Searching index.html for `frame.addEventListener|onload|'load'` found only the TV image loads (index.html:1090, 1100).
- The Dollywood `skeleton`/`spinner` hits are three.js internals (apps/dollywood.html:1748) and ride descriptions ("spinner" rides, apps/dollywood-live.html:682), not UI.

### 10. Pull-to-refresh
**Status: PARTIAL.** Shell only, touch only, and off while an app is open.

| What | Evidence |
|---|---|
| Indicator `#ptr` markup + CSS (arm rotates, busy spins) | index.html:376, 72-77 |
| `touchstart` arms only when `#views.scrollTop <= 0 && !current` | index.html:664 |
| `touchmove` threshold 70 px, haptic `buzz()` | index.html:665-670 |
| `touchend` → `refreshAll()` | index.html:671 |
| `refreshAll`: `hub.pull()` + `hub.flush()` + `loadFeed(true)`, then re-renders Home/Me | index.html:672-676 |
| `#views` `overscroll-behavior: contain`; body `overscroll-behavior: none` | index.html:66; apps/design.css:294, 304 |
| Other manual refresh: feed refresh button (runs `refreshAll`) | index.html:1206, 1215 |
| Other manual refresh: Me → Sync "Check now" | index.html:1278, 1284 |
| Other manual refresh: viewer reload button | index.html:411, 737 |

Gaps:
- Touch Events only. There is no pointer or mouse path (index.html:664-671); desktop relies on the buttons above.
- Disabled while an app is open (`!current`, index.html:664). No mini-app has its own pull-to-refresh: searching `touchstart|touchmove|touchend|pointerdown|pointermove|overscroll|refresh` in the 7 hub apps found only swipe and idle handlers (apps/f260.html:1742-1743, 2040; apps/prayer.html:1716-1717) and unrelated `refreshWeek`/icon names.
- The indicator jumps to a fixed armed position. It does not follow the drag distance (index.html:75, 668).
- `refreshAll` re-renders only Home and Me (index.html:675). Chat is not reloaded; the Apps grid refreshes through `onSync` (index.html:1243).
- apps/hub.js handles a shell `hub:pull` message (apps/hub.js:343-347), but index.html never sends it. Its only `hubshell` message is `hub:theme` (index.html:1283, handled at apps/hub.js:346).

### 11. Push notifications
**Status: PARTIAL.** Subscribe, service-worker display, server send, prefs and six kinds all exist. There are gaps in delivery timing, the rally toggle and behaviour on shared devices.

| What | Evidence |
|---|---|
| Me → Notifications card (non-kiosk): device toggle, per-kind switches, test button | index.html:1262-1271 |
| Support check; iOS Home Screen guidance; denied state | index.html:1530-1532, 1549-1550 |
| Subscribe: `requestPermission` → `/api/push/config` → `pushManager.subscribe` → `POST /api/push/subscribe`; unsubscribe + DELETE | index.html:1556-1571 |
| Prefs saved as `app_data(person, hub, push_prefs)` | index.html:1536-1542 |
| SW `push` → `showNotification` (tag/renotify, url) | sw.js:53-61 |
| SW `notificationclick` → focus + `postMessage`, or `openWindow` | sw.js:62-70 |
| Shell handles the `hubsw` open message → hash / openApp | index.html:1573-1576 |
| Server config/subscribe/unsubscribe (UNIQUE profile+device) | worker/src/index.js:406-426; worker/schema.sql:70-77 |
| RFC 8291 aes128gcm + VAPID, TTL/Urgency, 404/410 = gone | worker/src/push.js:2, 29-38, 42-50, 57-66 |
| `pushTo`: every subscription of a profile, dead ones deleted, a `push_log` row | worker/src/reminders.js:34-48 |
| Opt-in + once-per-NY-day gate (`notify`) | worker/src/reminders.js:50-64 |
| `PREF_DEFAULTS` all on (client defaults match) | worker/src/reminders.js:25; index.html:1536 |
| Cron at both UTC hours; `runCron` picks jobs by NY hour; expired guests silenced first | worker/wrangler.toml:24-25; worker/src/reminders.js:247-261; worker/src/index.js:593-601 |
| Test push; admin forced job | worker/src/index.js:534-539, 541-547 |
| Timer "done" is a local SW notification, not push | index.html:797-803 |

| Kind | Trigger / audience | Pref switch shown | Evidence |
|---|---|---|---|
| `leftovers` | 8 am, items ≥5 days → every `kind='adult'` profile, including unexpired guests (`adultIds` has no `is_guest` filter) | adult | worker/src/reminders.js:56, 66-79; index.html:1265 |
| `f260` | 8 pm, no reading today → every profile with F260 rows | if F260 is visible | worker/src/reminders.js:89-101; index.html:1266 |
| `behind` | Sun 8 pm, ≥2 behind → adults | adult + F260 | worker/src/reminders.js:112-136, 253; index.html:1267 |
| `prayer` | new family-list prayer since the last run → other adults | adult + prayer | worker/src/reminders.js:174-206; index.html:1268 |
| `park` | kid marker stale >30 min while an adult's is fresh → adults | adult + park map | worker/src/reminders.js:214-238; index.html:1269 |
| `rally` | on demand, `POST /api/dollywood/rally` → other household adults, guests excluded (1/min, no daily gate). **No UI calls it:** `rally()` is defined at apps/dollywood-live.html:1589 and never called (see 9c) | uses the `park` switch | worker/src/index.js:97-131 (99-100, 116, 120-122) |
| `test` | Me button → every device of the caller's profile | — | worker/src/index.js:534-539 |

Gaps:
- `prayer` and `park` only run in the 8 am / 8 pm slots (worker/src/reminders.js:253-255; worker/wrangler.toml:25). A new family prayer waits up to about 12 h. A kid marker that goes quiet mid-day is not checked until the next slot.
- Prayers added between the two daily runs can be lost. `prayerJob` advances its watermark before sending (worker/src/reminders.js:182). `notify` then skips any adult who already got a `prayer` push that NY day (`already_today`, worker/src/reminders.js:61). Prayers first seen by the 8 pm run are therefore never announced to adults notified at 8 am.
- Rally has no switch of its own. It follows `push_prefs.park` (worker/src/index.js:85-86, 120), and the Me UI has no rally row (index.html:1265-1269).
- The on-state help text mentions only fridge and reading nudges (index.html:1554).
- The leftover threshold is described inconsistently: the header comment says "within two days" (worker/src/reminders.js:2), but the code uses ≥5 days (worker/src/reminders.js:69).
- Shared devices: `POST /api/logout` deletes only the session, not push subscriptions (worker/src/index.js:272-277). The toggle state comes from the browser-wide `pushManager.getSubscription()`, not from the signed-in profile (index.html:1552-1554). After a profile switch the device keeps getting the previous profile's pushes, and the next person sees "On" without a server row of their own.
- The test button reports on the whole profile, not this device. `pushTo` sends to every subscription of the profile (worker/src/reminders.js:37), but the client message says "No subscription on the server for this device yet" when `sent` is 0 (index.html:1546).
- No `pushsubscriptionchange` handler. sw.js registers only install/activate/fetch/push/notificationclick (sw.js:21, 24, 31, 53, 62). A rotated subscription is noticed only when a send returns 404/410 (worker/src/reminders.js:43), and the device is not resubscribed.
- Kids get the notifications card (index.html:1262), but every per-kind switch requires an adult or F260 visibility (index.html:1265-1269, apps.json:4), and no job targets kids. A kid can switch notifications on but receives only test pushes.

### 12. Voice add
**Status: PARTIAL.** The SDK and three mic surfaces exist. Other add inputs have no mic.

| What | Evidence |
|---|---|
| `hub.voiceInput` (SpeechRecognition / webkitSpeechRecognition, `lang` option defaulting to `en-US`, single final result, returns null if unsupported) | apps/hub.js:415-426 |
| `hub.voiceSupported` | apps/hub.js:427 |
| App iframe allows the microphone | index.html:413 |
| Chat composer mic (hidden unless supported; fills the input, does not send) | index.html:386, 1519-1527 |
| Larder: mic beside the name field (writers only) | apps/leftovers.html:122-123, 180, 313-326 |
| Prayer: mic in the add form (writers only) | apps/prayer.html:482, 1763-1774 |
| Voice *output* (TTS, not input): Verses, Kid Verse, kid chat verse | apps/verses.html:248-280; apps/kidverse.html:280-311, 608-626; index.html:1456-1459 |

Gaps:
- No mic on Home "Add a reminder" (index.html:1204) or on any input in tally, timer, f260, verses or kidverse. Searching `voiceInput|voiceSupported|SpeechRecognition` in apps/*.html and index.html found only the three surfaces above.
- No caller passes `lang`, so every surface uses `en-US` (apps/hub.js:415; index.html:1524; apps/leftovers.html:320-323; apps/prayer.html:1769-1771). Transcripts are never auto-submitted (index.html:1524; apps/leftovers.html:320; apps/prayer.html:1769).
- Where the browser lacks SpeechRecognition, the mic is simply hidden with no message (index.html:1521; apps/leftovers.html:315; apps/prayer.html:1765).
- When recognition fails, Chat only resets the button and says nothing (index.html:1524). Larder and Prayer show "Couldn't hear that" (apps/leftovers.html:322; apps/prayer.html:1771).
- Dollywood apps: no match for `SpeechRecognition|voiceInput|voiceSupported`.

### 13. Family activity feed
**Status: PARTIAL.** Writing, storage, rendering, grouping and Show more exist. There is no live refresh and no retention, and the offline queue is weak.

| What | Evidence |
|---|---|
| `hub.activity(text, app)`: no-op without write rights (kiosk/no profile), localStorage queue (last 50), drain | apps/hub.js:373-386 |
| Client callers: shell reminders + album, Larder, F260, Verses, Kid Verse, Prayer, both Dollywood apps (none in Tally/Timer) | index.html:1212, 1233, 1370, 1375; apps/leftovers.html:302, 309; apps/f260.html:1661; apps/verses.html:305; apps/kidverse.html:332, 481, 640; apps/prayer.html:1318, 1329, 1606; apps/dollywood-live.html:1086, 1587; apps/dollywood.html:1086, 1717 |
| `hub.activityFeed(limit)` (device token only) | apps/hub.js:387 |
| `POST /api/activity` (`requireWriter`, text ≤200) | worker/src/index.js:393-403 |
| `GET /api/activity` (limit 1-100, joins name/emoji/color/photo) | worker/src/index.js:321-329 |
| Server-side lines: chat tools, rally set/clear, guest added | worker/src/chat.js:122-124, 178, 189, 197, 220, 232, 253, 259, 280; worker/src/index.js:113, 137, 199-200 |
| Table `activity` + `created_at DESC` index | worker/schema.sql:61-68 |
| Home card "Around the house" + refresh button | index.html:1206, 1215-1216 |
| Cached first paint (`hub.feed`, 30 rows) | index.html:921-922, 927 |
| Grouped by consecutive same person, with a per-app icon | index.html:950-958, 935-945 |
| "Show more" in pages of 30, capped at 100 | index.html:954, 959 |
| Empty state and skeleton | index.html:948-949 |
| TV: last 5 lines, fetches 100 rows, refreshes every 5 min | index.html:1069-1070, 1106-1115, 1135 |
| Guest purge deletes their lines | worker/src/index.js:214 |

Gaps:
- Adult Home loads the feed once per page session. `feedFresh` stays true and `loadFeed()` without `force` returns early (index.html:923-925, 1216). The feed updates only on pull-to-refresh, the refresh button or Show more, never on the 30 s pull. A local `hub.activity` is not added to the list straight away.
- Kid Home has no feed (index.html:1146-1156).
- Show more re-fetches the whole list with a bigger `limit`. There is no cursor, and the server caps at 100 (index.html:959; worker/src/index.js:323).
- No retention: searching worker/ for `FROM activity` found only the guest delete (worker/src/index.js:214) and reads.
- The queue drains only inside `hub.activity()`, not on `online` or `ready`; `drainActivity` has no other caller (apps/hub.js:376). The queue key `hub.activityQueue` is not per-profile (apps/hub.js:28, 375), so lines queued by one person post under whoever writes next. Any 4xx other than 429 (including 401) drops the in-flight line (apps/hub.js:382).
- There is no in-flight guard. Two `hub.activity()` calls within one POST round-trip each start `drainActivity` over the same stored queue, so a line can post twice (apps/hub.js:375-385).
- Grouping merges only adjacent rows from the same person (index.html:953).

### 14. Hub chatbot with actions and a per-profile daily cap
**Status: PARTIAL.** Tools, chips, a server-side cap and kid rules exist. App visibility comes from the client.

| What | Evidence |
|---|---|
| `POST /api/chat` (kiosk 403; guests get adult apps) and `GET /api/chat/history` | worker/src/index.js:429-442 |
| Model, max tokens, `DAILY_CAP = 60`, history 20, 6 tool turns | worker/src/chat.js:14-18 |
| TOOLS: list_apps, get_data, set_data, add_list_item, toggle_f260_reading, add_prayer, mark_prayed, answer_prayer, finish_leftover, where_is_family, f260_status, read_todays_verse | worker/src/chat.js:25-49 |
| Writing tools use `putOne` + `activity()` and return a chip | worker/src/chat.js:173-282 |
| Read-only tools return `chip: null` | worker/src/chat.js:163, 168-170, 284-308 |
| Cap: user rows per profile per New York date, checked before the call → 429 `daily_cap` with `{used, cap}` | worker/src/chat.js:112-117, 397-400; worker/src/index.js:584 |
| SSE events text/tool/done/error | worker/src/chat.js:4-9, 413-450 |
| Kid rules: `KID_TOOLS`, refusal, set_data guard, no reminders, kid-only verse tool, kid prompt | worker/src/chat.js:52, 161, 174, 193, 303, 336-340 |
| Vault: excluded from key listing, blocked for set_data | worker/src/chat.js:169, 176 |
| Client: cap label; input disabled at the cap | index.html:383, 1460-1463, 1503 |
| Client: chips (ok/danger), `hub.pull()` after each chip, kid read-aloud | index.html:1497, 1456-1459 |
| Client: history reload re-splits `✓` chip lines | index.html:1475-1481; worker/src/chat.js:444-445 |

Gaps:
- App visibility and the kid/adult rules depend on the `apps` array the client sends (worker/src/chat.js:395, 118-119, 158; index.html:1494). The server does not read apps.json.
- The cap check is read-then-insert and not atomic (worker/src/chat.js:399, 411). The user row is stored before the model call, so an upstream failure still uses up a message (worker/src/chat.js:411 vs 441-442).
- Failed tools send `chip: null` and the client ignores chip-less tool events (worker/src/chat.js:161-311; index.html:1497), so the `chip-danger` style never shows.
- `set_data` can overwrite any key in any visible app with no confirmation step (worker/src/chat.js:173-179).
- `get_data` with an explicit key does not block `.vault` keys. Only the key-less listing filters them (worker/src/chat.js:168 vs 169).
- Kids may call `set_data` and `add_list_item` (worker/src/chat.js:52). The kid guard only blocks apps that have a `visibleTo` (worker/src/chat.js:119, 174). Larder, Tally, Timer and the park map have none (apps.json:5, 7, 8, 10). Kids can therefore add fridge items and write any key in those apps, including `dollywood-live` family rows such as `meet` or `kidshare:*`.
- No offline queue for chat. The send path is a direct `fetch` (index.html:1502).

### 15. Cross-device sync
**Status: PARTIAL.** The queue, flush, pull, server-side last-write-wins and shell/iframe storage sync exist. Live refresh is 30 s polling only, and that polling stops in the shell after a profile switch. Several failure paths drop writes.

| What | Evidence |
|---|---|
| Per-app/scope cache and queue in localStorage (person keys carry the profile id) | apps/hub.js:26-31, 183-197 |
| `hub.set`: applies locally, queues, 250 ms debounced flush, corrects for clock skew | apps/hub.js:231-243, 252 |
| `flush()`: one batch POST per channel. 403 `read_only` drops; other 4xx (not 401) drops the channel queue; 5xx/network retries in 30 s/5 s; the first error ends the pass for all channels | apps/hub.js:253-283 |
| Server batch ≤200 items, `requireWriter`, applied item by item | worker/src/index.js:310-318 |
| Server last-write-wins upsert: `applied:false` returns the newer row, future timestamps clamped to +5 min, tombstones | worker/src/data.js:35-67 |
| Incremental pull by `since` on `synced_at` (server `now` taken before the query) | apps/hub.js:286-303; worker/src/index.js:286-296; worker/src/data.js:17-26 |
| Pull triggers: ready, visibilitychange, online, every 30 s while visible | apps/hub.js:336-342 |
| First open waits up to 6 s for the pull | apps/hub.js:334-337 |
| `onChange` fires per row changed remotely | apps/hub.js:206-210, 297-298 |
| Shell ↔ iframe: `storage` events reload cache/queue and fire a bulk `onChange` | apps/hub.js:348-364 |
| Re-read after awaits (`refreshScope`) | apps/hub.js:188-195, 272, 291 |
| Shell subscribes to other apps' channels (`hub.use`) | index.html:458-459, 1042 |
| Shell re-renders on change/pull; closing the viewer flushes + pulls | index.html:1236-1243, 733 |
| Every app registers `hub.onChange` | apps/f260.html:1621, 2073; apps/verses.html:380; apps/prayer.html:1760; apps/timer.html:130; apps/kidverse.html:503, 519, 676; apps/tally.html:156; apps/leftovers.html:378; apps/dollywood-live.html:1112, 1483; apps/dollywood.html:1112, 1613 |
| Sync status: tab-bar dot, Me Sync card | index.html:399, 769-770, 1273-1279 |
| Session life 365 days; 401 codes | worker/src/auth.js:6, 75, 92, 97, 105 |

Gaps:
- No server push for data. Searching for `WebSocket|EventSource|text/event-stream|BroadcastChannel|SyncManager` found only chat's SSE (worker/src/chat.js:450). Other devices see changes on the next 30 s poll, and only while visible (apps/hub.js:342). There is no Background Sync in sw.js either (sw.js:21-70).
- After a profile switch without a page reload (Switch → picker → sign-in → `enterShell`, index.html:1282, 623), the shell's 30 s poll stops. `hub.reset()` clears `pullTimer` (apps/hub.js:370), but `hub.ready()` restarts the interval only when `!wired` (apps/hub.js:338, 342), and `wired` is never reset. The shell then pulls only on visibility change, reconnect or a manual refresh. This includes the TV board if it switches profile.
- A queue over 200 items in one channel is sent whole (apps/hub.js:259-264). The server answers 400 (worker/src/index.js:314) and the client drops the whole channel queue (apps/hub.js:268).
- One bad item (413 `value_too_large` from worker/src/data.js:43, or 400 `bad_key` from worker/src/data.js:12) fails the batch mid-loop. Earlier items are already written (worker/src/index.js:316), and the client drops every pending write in that channel (apps/hub.js:268).
- Queued writes when a session expires: a 401 clears the session (apps/hub.js:142, 147-156). The queue is kept and retried in 30 s (apps/hub.js:268-269), but `flush` exits while there is no session (apps/hub.js:254).
  - Person-scope queues stay keyed to that person. They load and flush only after that person signs in again (index.html:623; apps/hub.js:30, 186, 312).
  - Family-scope queues and the activity queue are not per-profile (apps/hub.js:28, 30), so they flush under whoever signs in next. If that is the kiosk, `read_only` drops them (apps/hub.js:266).
  - `hub.set` with no profile throws `profile_required` (apps/hub.js:233).
- The shell never sends the iframe the `hub:pull` message it listens for (apps/hub.js:343-347; the only `hubshell` post is `hub:theme` at index.html:1283). An open app refreshes only on its own 30 s timer or a visibility change.

## 2. Bypasses of hub.js and design.css (cross-cutting sweep)

Scope: `index.html` and every file in `apps/`. When `apps/dollywood.html` and `apps/dollywood-live.html` run the same code, a row shows both as "dw:N · dwl:M" (dw = `apps/dollywood.html`, dwl = `apps/dollywood-live.html`).

**How the two Dollywood files line up:**
- Lines 1-1151 have the same numbers in both files. Their content differs only at lines 2, 5, 587, 605, 611, 684, 688 and 696.
- dw:1152-1284 is `setMode` plus the 3D block. In dwl it shrinks to 1152-1154 (`function init3D(){}`).
- From dw:1285 onward, dwl = dw − 130.

**Left out of every scan (not app code):**
- The JSON payload at dw:682 and dwl:682.
- Vendored three.js in dw only: dw:1743-1749, the licence plus the minified library at 1748.
- Vendored OrbitControls/MapControls in dw only: dw:1750-2795.

### 2.1 Direct storage (localStorage / sessionStorage / indexedDB / caches / document.cookie)

#### hub.js's own storage (for comparison)
| file:line | snippet | note |
|---|---|---|
| apps/hub.js:26-31 | `const LS = { device: 'hub.device', session: 'hub.session', last: 'hub.lastProfile', api: 'hub.api', theme: 'hub.theme', … cache: …, queue: … }` | The SDK's keys: `hub.device`, `hub.session`, `hub.lastProfile`, `hub.api`, `hub.theme`, `hub.migrated`, `hub.activityQueue`, `hub.profiles`, `hub.cache.<app>.<scope>[.<pid>]`, `hub.queue.<app>.<scope>[.<pid>]` |
| apps/hub.js:32-33 | `lsGet` / `lsSet` (try/catch) | All SDK storage goes through these two |
| apps/hub.js:402 | `raw = localStorage.getItem(e.from)` | `hub.migrate` reads an app's old keys. It does not delete them (391-392) |
| apps/hub.js:350-364 | `window.addEventListener('storage', …)` | Keeps the shell and the iframe in step on cache, queue and theme |

#### Bypasses
| file:line | snippet | note |
|---|---|---|
| index.html:466 | `localStorage.setItem('hub.registry', JSON.stringify(registry))` | A shell key in the `hub.*` namespace that is not in hub.js `LS` |
| index.html:468 | `JSON.parse(localStorage.getItem('hub.registry'))` | Offline fallback for apps.json |
| index.html:525 | `localStorage.setItem('hub.profiles', JSON.stringify(profiles))` | Writes hub.js's own key `LS.profiles` (hub.js:28). `hub.profiles()` already writes it (hub.js:164) |
| index.html:527 | `JSON.parse(localStorage.getItem('hub.profiles'))` | Reads that key directly instead of calling `hub.people()` (hub.js:166). The shell uses `hub.people()` elsewhere (476, 873, 885, 1043, 1387) |
| index.html:889 | `localStorage.getItem('hub.cache.' + app + '.' + scope + …)` | Reads the SDK's private cache format to check `since > 0` |
| index.html:922 | `JSON.parse(localStorage.getItem('hub.feed'))` | The shell's own feed cache, used for the first paint |
| index.html:927 | `localStorage.setItem('hub.feed', JSON.stringify(feed.slice(0, 30)))` | Runs after `hub.activityFeed` |
| index.html:1108 | `localStorage.setItem('hub.feed', JSON.stringify(rows.slice(0, 30)))` | TV board refresh |
| index.html:1287 | `for (const k of Object.keys(localStorage)) if (k.startsWith('hub.')) localStorage.removeItem(k)` | "Forget this device". Deletes the SDK's tokens, caches and unsent queues |
| apps/kidverse.html:467 | `localStorage.getItem('hub.cache.kidverse.' + sc + …)` | Reads the SDK's private cache for both scopes before `reconcile()` (469) |
| apps/f260.html:898-900 | `lsLoad` / `lsSave` / `lsDrop` → `localStorage.getItem/setItem/removeItem` | The app's own wrappers |
| apps/f260.html:897 | `const LOCAL = new Set([K.legacy])` | Only `f260.journal` (894) stays in localStorage. Every other key goes through hub (901-903) |
| dw:1055 · dwl:1055 | `localStorage.setItem('dw-plot', v)` | Only when there is no hub profile (`hubOnline`, 1053) |
| dw:1057 · dwl:1057 | `localStorage.getItem('dw-plot')` | First paint |
| dw:1061 · dwl:1061 | `JSON.parse(localStorage.getItem(KEY)…)` | `KEY='dollywood-build-progress-v2'` (1060). Replaced by the hub copy at 1111 |
| dw:1062 · dwl:1062 | `localStorage.setItem(KEY, JSON.stringify(doneMap))` | Standalone path only |
| dw:1374 · dwl:1244 | `localStorage.setItem(LIVE_KEY, JSON.stringify(me))` | `LIVE_KEY='dollywood.live.last'` (dw:1292 · dwl:1162) holds the device's own last position fix |
| dw:1608 · dwl:1478 | `JSON.parse(localStorage.getItem(LIVE_KEY)…)` | Restored if younger than 12 h, then marked `stale` |
| dw:1532 · dwl:1402 | `localStorage.setItem(TRACK_KEY(),'1')` | `'dollywood.live.track:'+(profile id or 'solo')` (dw:1308 · dwl:1178) |
| dw:1534 · dwl:1404 | `localStorage.removeItem(TRACK_KEY())` | When geolocation is denied |
| dw:1599 · dwl:1469 | `localStorage.removeItem(TRACK_KEY())` | Entering place mode |
| dw:1617 · dwl:1487 | `localStorage.getItem(TRACK_KEY())==='1'` | Resumes GPS |
| dw:1546 · dwl:1416 | `localStorage.setItem('dollywood.live.style',v)` | Basemap choice |
| dw:1609 · dwl:1479 | `localStorage.getItem('dollywood.live.style')` | |
| dw:1591 · dwl:1461 | `localStorage.getItem('dollywood.live.who')` | "Who" filter chip |
| dw:1673 · dwl:1543 | `localStorage.setItem('dollywood.live.who',WHO…)` | |
| dw:1633 · dwl:1503 | `localStorage.setItem('dollywood.live.waits',…)` | Ride-wait cache |
| dw:1634 · dwl:1504 | `localStorage.getItem('dollywood.live.waits')` | Used if the fetch fails and the cache is younger than 6 h |
| dw:1726 · dwl:1596 | `localStorage.setItem(TRAIL_KEY,JSON.stringify(TRAILS))` | `TRAIL_KEY='dollywood.live.trails'` (dw:1725 · dwl:1595) |
| dw:1727 · dwl:1597 | `JSON.parse(localStorage.getItem(TRAIL_KEY)…)` | |

- **Through `hub.migrate` only (not direct):**
  - `apps/prayer.html:584`, `:649-650` (`'prayer-data-v3'`). The only other mention is a comment at :640.
  - `apps/leftovers.html:174` (`'leftovers.items'`).
  - `apps/tally.html:147` (`'tally.count'`).
  - `apps/f260.html:905`.
  - dw:1107 · dwl:1107.
- **No direct storage:** `apps/tally.html`, `apps/timer.html`, `apps/leftovers.html`, `apps/verses.html`, `apps/prayer.html`.
- **sessionStorage / indexedDB / `caches.` / document.cookie:** NOT FOUND IN CODE. Searched `sessionStorage|indexedDB|caches\.|document\.cookie` in `index.html` and all of `apps/`, including both Dollywood files and the vendored three.js.

### 2.2 Direct network (outside apps/hub.js)
| file:line | snippet | note |
|---|---|---|
| index.html:464 | `fetch('apps.json?ts=' + Date.now(), { cache: 'no-store' })` | Same-origin registry. Cached to `hub.registry` (466) |
| index.html:487 | `fetch(ic)` | Icon SVG path from apps.json, same origin. Kept in the in-memory `svgCache` (453) |
| index.html:1502 | `fetch(hub.api… + '/api/chat', { method: 'POST', headers: { 'X-Device-Token': hub.device.token, 'X-Profile-Token': hub.session.token } …})` | The reply stream is parsed by hand (1504-1515). This skips `hub.request`, so there is no timeout (hub.js:128, 132) and a 401 never reaches `handleAuthLoss` (hub.js:142). The code only throws (1503) and prints the message in the bubble (1516) |
| dw:1630 · dwl:1500 | `fetch(base.replace(/\/$/,'')+'/api/dollywood/waits',{cache:'no-store'})` | `base` is `hub.api`, or else a hard-coded `'https://house-hub-api.catalystfarm1.workers.dev'` (dw:1629 · dwl:1499) that duplicates hub.js:25 `DEFAULT_API`. Sends no tokens. Returns early unless `FLAVOR==='live'` (FLAVOR is `'hub'` at dw:688 and `'live'` at dwl:688). Polled every 60 s (dw:1585 · dwl:1455) |
| apps/prayer.html:12-14 | `<link rel="preconnect" href="https://fonts.googleapis.com">` … `css2?family=Manrope…&family=Instrument+Serif…` | External stylesheet, not a `fetch` |

Calls that go through the SDK, listed for completeness (not bypasses):

| file:line | snippet | note |
|---|---|---|
| apps/hub.js:135 | `fetch(hub.api.replace(/\/$/, '') + path, …)` | The SDK's only fetch |
| index.html:1418, 1470, 1546, 1559, 1563, 1566, 1583 (×2), 1621, 1628, 1634, 1639, 1644, 1654, 1683 | `hub.request(…)` | Paths: `/api/profiles`, `/api/chat/history`, `/api/push/test`, `/api/push/subscribe`, `/api/push/config`, `/api/admin/usage`, `/api/admin/profiles/${id}/reset-pin`, `/api/admin/profiles/${id}`, `/api/admin/profiles/${id}/purge`, `/api/admin/devices/${id}`, `/api/admin/pairing-code/rotate` |
| dw:1719 · dwl:1589 | `hub.request('/api/dollywood/rally',{method:'POST',…})` | Inside `rally()`, which nothing calls (see 9c) |
| apps/prayer.html:1762 | `hub.profiles()` | |

**Other loads that are not fetch or XHR (for completeness):**
- index.html:724: app iframe `frame.src = a.file`.
- index.html:1102: TV album `img.src`.
- index.html:1565: `pushManager.subscribe`.
- index.html:1692: `serviceWorker.register('sw.js')`.
- dw:696 · dwl:696: basemap image URLs, loaded through SVG `href` (e.g. dw:744) and `new Image()` in dw's 3D block (dw:1195, 1213).
- Outbound links (navigation only):
  - apps/f260.html:971-984 (biblegateway, esv.org, bible.com).
  - dw:977 · dwl:977 (Google and YouTube search).
  - dw:1652 · dwl:1522 (queue-times.com credit).

**XMLHttpRequest / EventSource / WebSocket / navigator.sendBeacon / importScripts:** NOT FOUND IN CODE in `index.html` or the app code in `apps/`. The only hits are in the vendored three.js at dw:1748 (`XMLHttpRequest` ×1 and `fetch(` ×2, from the library's loaders). The app code never calls a `THREE.*Loader`: searched `THREE\.[A-Za-z]*Loader` in dw.

### 2.3 Own sync or data layers
| file:line | snippet | note |
|---|---|---|
| index.html:462-471 | `loadRegistry()`: fetch → `hub.registry` → fallback | Registry cache kept outside the SDK |
| index.html:523-530 | `profiles = await hub.profiles(); … localStorage.setItem('hub.profiles', …)` | A second copy of the profile list alongside `hub.people()` |
| index.html:921-934, 1107-1108 | `feed`, `feedFresh`, `feedLimit`, `feedSeq` + `hub.feed` cache | The activity feed has no SDK cache: `hub.activityFeed` is a plain request (hub.js:387) |
| index.html:453, 487 | `const svgCache = {}` | In-memory icon cache |
| index.html:889 | `const cached = (app, scope) => …` | Reads SDK cache internals to decide whether to show skeletons |
| index.html:1330-1348 | `ledgerRows` / `applyLedger` / `effectiveStars` | A copy of Kid Verse's ledger rules ("on a copy, for display", 1334). Layers unapplied ledger rows over the `stars:<kid>` mirror |
| apps/kidverse.html:441-442 | `ledgerRows` / `applyLedger(s, rows)` | The app's own copy of the same rules, which it applies and writes |
| apps/kidverse.html:330-331, 478, 638-639 | `hub.set('stars', s, {scope:'person'}); hub.set('stars:'+id, s, {scope:'family'})`; the same pattern for `story` | App-level mirror: every write duplicates the person row into the family scope |
| apps/kidverse.html:467-469 | `const pulled = () => …`; `if (… !pulled()) return false` | Reads SDK cache internals to gate star reconciliation |
| apps/prayer.html:611, 623-639 | `let D;` · `const SNAP = { person:{}, family:{} }` · `listFromHub()` / `load()` | The whole prayer model is rebuilt from hub into its own `D` object |
| apps/prayer.html:652-656, 685-696 | `put()` compares `JSON.stringify(v)` with `SNAP`; `save()` walks every list and removes `prayer:*` keys that have disappeared | Its own write-diff layer on top of `hub.set` |
| apps/prayer.html:698-705 | `absorbRemote()`: waits while a sheet or input is busy (4 s retry), then calls `load()` | Its own remote merge |
| apps/prayer.html:583 | `const USE_LOCAL_STORAGE = true;` | Flag that gates all hub reads (631) and writes (686). The name is misleading: the storage is hub (576-582) |
| apps/prayer.html:1500-1506, 1507-1517, 1518-1526 | Export is a `new Blob([JSON.stringify(D…)])` download. `readBackup()` accepts v3 or v2. Import replaces `D`, then calls `save()` (1524) | Its own backup format |
| apps/f260.html:901-903 | `load` / `save` / `drop` (LOCAL keys → localStorage, everything else → hub) | Storage router |
| apps/f260.html:908-929 | Module copies: `done`, `curWeek`, `source`, `mem`, `log`, `weekStart`, `weekDone`, `best`, `miles`, `jstats`, `verses`, `recall`, `finished` … | In-memory mirror of every key |
| apps/f260.html:2072-2095 | `hub.onChange` → `mergeRemote()` (200 ms debounce, 5 s retry while busy) → `readState()` | Its own remote merge |
| apps/f260.html:1014-1025 | `let persistChain = Promise.resolve(); function persistJournal()` | Serialises writes of the encrypted vault |
| apps/f260.html:1093-1124 | `backupText` / `parseBackup` / `restoreBackup` (`'F260BACKUP1.'` clipboard text) | Its own backup format |
| dw:1053-1062 · dwl same | `doneMap`; `save()` goes to hub when a profile is present, otherwise to localStorage | Two storage modes |
| dw:1099-1101 · dwl same | `b-export` (download as a `data:` URL) / `b-file` (FileReader import) | Its own progress file |
| dw:1105-1112 · dwl same | `adopt()` copies hub `progress` / `plot` into `doneMap` on `hub.onChange` | Mirror |
| dw:1292, 1384-1386 · dwl:1162, 1254-1256 | `const FAM={}`; `loadFam()` rebuilds it from `hub.list('loc:')` and removes rows older than 24 h | Mirror of family positions |
| dw:1380-1383 · dwl:1250-1253 | `publish()`: skips a write if the last one was under 2.5 s ago (or under 8 s with less than 8 m of movement), then `hub.set('loc:'+id,…)` | Its own write throttle on top of `hub.set` |
| dw:1622, 1629-1634, 1585 · dwl:1492, 1499-1504, 1455 | `const WAITS={by:{},at:0,…}` + localStorage cache (6 h) + 60 s `setInterval` | Cache and poll kept outside hub |
| dw:1374, 1608 · dwl:1244, 1478 | `LIVE_KEY` last fix (12 h) | Device-local |
| dw:1724-1727 · dwl:1594-1597 | `const TRAILS={}`: last 20 points per id | Device-local |
| dw:1708-1709 · dwl:1578-1579 | `let MEET=null; function loadMeet()` (2 h expiry) | Copy of the family `meet` row |

No own layer: `apps/tally.html` reads at render (150), as do `apps/timer.html` (90), `apps/leftovers.html` (176) and `apps/verses.html` (213-217).

### 2.4 Not using design.css (summary)

**Counting method:**
- Hex: `#` followed by 3, 4, 6 or 8 hex digits, and not followed by a word character or hyphen. Id selectors that happen to match were removed by hand: `#feed` (index.html:947, 962) and `#add` (leftovers.html:195).
- rgb/hsl: every `rgb(`, `rgba(`, `hsl(` and `hsla(`.
- "Other": hex outside `<style>` and `<script>` (meta tags, markup, the JSON payload).
- Vendored regions are excluded, as set out in the scope note.

| file | links design.css | `ds` class | keeps own component CSS | hex `<style>` | hex JS | hex other | rgb/hsl `<style>` | rgb/hsl JS | note |
|---|---|---|---|---|---|---|---|---|---|
| index.html | :17 (`apps/design.css`) | `<body class="ds">` :364 | Yes. Shell CSS 18-362, with overrides such as `.pin-pad .btn` :60, `.card h2` :108, `.gcard .btn` :116 | 0 | 11 (:449 `SWATCHES` ×10, :450 `FALLBACK`) | 2 (:8, :9 meta theme-color) | 4 (:95, :96, :272, :281) | 0 | Named colours inside color-mix at :249 (`white`) and :331 (`black`) |
| apps/tally.html | :7 | :129 | Small `.ds` overrides (`.ds .who, .ds .btn.reset` 95-113) | 0 | 0 | 0 | 0 | 0 | |
| apps/timer.html | :7 | :51 | Small overrides (`.presets .btn` 43-44, `.actions .btn-lg` 47) | 0 | 0 | 0 | 0 | 0 | |
| apps/leftovers.html | :7 | no (`<body>` :100) | Yes. Own ledger CSS 8-98 (form add bar 33-45, `.log` 54, `.mic` 58, `.group` 66) | 0 | 0 | 0 | 0 | 0 | `white` inside color-mix at :80 |
| apps/prayer.html | :10 | no (:433) | Yes. Full own set 15-431 (`.pill` 107, `.chip` 187, `.toast` 260, `nav` 276) | 0 | 2 (:1537) | 1 (:9 meta) | 0 | 0 | Print CSS (367-382) uses named colours: `white`/`black` :370, `dimgray` :375, :381, `silver` :377, `black` :379 |
| apps/f260.html | :6 | no (:529) | Yes. Full own set 10-527 (`.btn` 205-209) | 0 | 0 | 0 | 0 | 0 | `--on-solid:white` :26; the print block (493-525) uses white/black/gray/lightgray |
| apps/verses.html | :7 | :99 | `.ds` plus overrides (`.ds .top .pill` 27, `.ds .actions .btn` 50-52) | 0 | 0 | 0 | 0 | 0 | |
| apps/kidverse.html | :7 | :144 | `.ds` plus overrides (26-55) | 0 | 0 | 0 | 0 | 0 | |
| apps/hub.js | n/a | Wraps its toast in a `ds` div (:433) | n/a | n/a | 1 (:461 `'#8A6A4B'` avatar fallback) | n/a | n/a | 0 | |
| apps/design.css | Source of the tokens | Defines the `.ds` components | Token source | 275 | n/a | n/a | 155 | n/a | |
| apps/dollywood.html | :683, loaded after its own `<style>` (6-566) | no (`<body>` :566) | Yes, 6-566. Own palette 7-12. Flavour overrides 208-565: token map 212-217, dark variant 219 | 144 | 146 (app script 685-1742) | 4 (:620 ×1, :664 ×3) + 59 in the JSON payload (:682) | 35 | 6 (plus 1 in the vendored three.js :1748) | Map category colours are pinned on purpose ("cartography", 216-217) |
| apps/dollywood-live.html | :683 | no (:566) | Same as dollywood.html (lines 1-566 are identical except 2 and 5) | 144 | 109 (685-1612) | 4 (:620, :664) + 59 (:682) | 35 | 0 | |

### 2.5 Colour-scheme bypasses
| file:line | snippet | note |
|---|---|---|
| apps/design.css:176-177 | `@media (prefers-color-scheme: dark) { :root:not([data-theme]) {` | The platform's System theme (for comparison) |
| apps/hub.js:73, 83 (used at 79, 95) | `prefersDark = () => … matchMedia('(prefers-color-scheme: dark)')` and its change listener → `root.dataset.scheme` | Platform resolution (for comparison) |
| index.html:8 | `<meta name="theme-color" content="#F7F2EB" media="(prefers-color-scheme: light)">` | Keyed on the OS scheme, with a hard-coded hex. `syncThemeColor` later overwrites it with `--bg` (656-657) |
| index.html:9 | `<meta name="theme-color" content="#1A1512" media="(prefers-color-scheme: dark)">` | Same |
| index.html:1703 | `window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeColor)` | Listener keyed on the OS. The value itself comes from a token |
| index.html:331, 722 | `#viewer.dark { background: color-mix(in srgb, var(--slate) 12%, black); }` · `viewer.classList.toggle('dark', !!a.dark)` | A near-black viewer backdrop for apps flagged `"dark": true` (apps.json:9-10, both Dollywood apps). It applies whatever the theme or scheme |
| apps/prayer.html:9 | `<meta name="theme-color" id="themeColor" content="#F7F2EB">` | Hard-coded hex |
| apps/prayer.html:1531-1537 | `const dark = t === 'dark' or (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)`; fallback `'#1C1714'` / `'#F7F2EB'` | Its own scheme check. `hub.theme()` never returns `'dark'` (hub.js:72, 94). The fallback applies only when `--bg` is empty |
| apps/prayer.html:1539-1540 | `const darkMQ = window.matchMedia('(prefers-color-scheme: dark)'); … addEventListener('change', applyTheme)` | Listener keyed on the OS |
| dw:2 · dwl:2 | `<html lang="en" data-theme="dark" data-flavor="…">` | Hard-coded. hub.js `applyTheme` (hub.js:77) rewrites or removes it once hub.js loads at :684 |
| dw:7-9 · dwl:7-9 | `:where(:root){--ink:#0E0D0B;--panel:#1A1713;…}` | Own palette that defaults to dark (reference flavour) |
| dw:11-12 · dwl:11-12 | `:where([data-theme=light]){--ink:#F5F1EA;…}` | Own light palette, keyed on `data-theme=light` rather than `[data-scheme]`. hub.js never sets `data-theme="light"`: `'light'` maps to hearth and the attribute is removed (hub.js:72, 77) |
| dw:591, 1033-1034 · dwl same | `<div class="vrow" id="theme-row">…<button id="theme" title="Light / dark">`, then `{const t=$('theme-row');if(t)t.remove()}` | Own light/dark toggle. Removed at runtime without any condition |

- **Already keyed on `[data-scheme]` (for reference):** index.html:203, apps/tally.html:26, apps/f260.html:28, dw:10 · dwl:10, dw:219 · dwl:219, apps/design.css:428.
- **f260 print block:** apps/f260.html:495 forces print colours on `:root,:root[data-scheme]` inside `@media print` (493).
- **Not present:** `prefers-color-scheme` does not appear in tally, timer, leftovers, f260, verses, kidverse or either Dollywood file. `color-scheme` is set only at apps/design.css:15.

### 2.6 Fonts
| file:line | declaration | note |
|---|---|---|
| apps/design.css:18-21 | `--font-sans: ui-rounded, -apple-system, system-ui, "Segoe UI Variable", …` · `--font-serif: ui-serif, "New York", "Iowan Old Style", "Palatino Linotype", Georgia, …` · `--font-display: var(--font-serif)` · `--font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | Token stacks, system fonts only |
| apps/design.css:296, 331, 332, 418 | `var(--font-sans)` / `var(--font-serif)` / `var(--font-display)` | `font: inherit` at 311, 466, 483, 561 |
| index.html:35, 55, 71, 85, 143, 145 | `font-family: var(--font-display)` | `font: inherit` at 43, 186, 223, 290, 311, 335, 345 |
| index.html:1645 | `style="font-family:var(--font-mono);…"` (inside a JS template) | |
| apps/tally.html:58 | `font-family: var(--font-display)` | `font: inherit` at 72 |
| apps/timer.html:18, 32 | `font: 600 var(--fs-lg) var(--font-display)` · `font-family: var(--font-sans)` | |
| apps/leftovers.html:16, 20, 24, 69 | `var(--font-display)` (body) · `var(--font-sans)` · `var(--font-mono)` ×2 | |
| apps/prayer.html:12-14 | Google Fonts: `family=Manrope:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1` | External font URL |
| apps/prayer.html:45 | `font-family:"Manrope",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif` | Not a design.css token |
| apps/prayer.html:148, 338 | `font-family:"Instrument Serif",Georgia,serif` | Not a design.css token |
| apps/prayer.html:66, 138, 174, 187, 192, 217, 247, 260, 276, 330, 345, 421 | `font-family:inherit` | |
| apps/f260.html:21 | `--serif:"New York",var(--font-serif)` | Own serif alias, used at 160, 178, 187, 321, 371, 409 |
| apps/f260.html:39, 161, 162, 179, 188, 322 | `font-family:var(--font-sans)` | `font-family:inherit` at 45. `font:inherit` at 180, 216, 330, 350, 358, 394, 399 |
| apps/verses.html:38, 64, 43 | `var(--font-display)` ×2 · `var(--font-serif)` | |
| apps/kidverse.html:36, 62, 78, 99, 127, 100 | `var(--font-display)` ×5 · `var(--font-sans)` | |
| dw:14 · dwl:14 | `font-family:Archivo,system-ui,sans-serif` | The font is never loaded (see below) |
| dw:19, 111 · dwl same | `font-family:Fraunces,Georgia,serif` | Never loaded |
| dw:22, 59, 84, 93, 105, 116 · dwl same | `font-family:Fraunces,serif` | Never loaded |
| dw:117, 131 · dwl same | `font-family:Archivo,sans-serif` | Never loaded |
| dw:24 · dwl:24 | `button,select,input{font:inherit` | |
| dw:222, 277, 494, 518, 539, 545, 550, 551, 564 · dwl same | `font-family:var(--font-sans)` | Hub-flavour overrides |
| dw:223, 306 · dwl same | `font-family:var(--font-display)` | |
| dw:1226, 1228 | Canvas `x.font='800 50px system-ui,Segoe UI,Roboto,sans-serif'` / `'800 84px …'` | 3D labels, in dollywood.html only (the 3D block) |

- **@font-face / font files:** NOT FOUND IN CODE. Searched `@font-face`, `fonts.g`, `.woff`, `.ttf`, `.otf`, `FontFace`, `@import` in `index.html` and `apps/`. The only external font URL is apps/prayer.html:12-14. Archivo and Fraunces are named but never loaded.
- **No font declarations:** apps/hub.js.

### 2.7 Native dialogs
| file:line | snippet | note |
|---|---|---|
| index.html:1286 | `confirm('Forget this device? …')` | Me → sync card |
| index.html:1367 | ``confirm(`Cash in ${kid.name}'s ${r.total} …`)`` | Kids' rewards |
| index.html:1373 | ``confirm(`Reset ${kid.name}'s stars for this week? …`)`` | Kids' rewards |
| index.html:1432 | `confirm('Remove this photo from the album?')` | Album |
| index.html:1620 | ``confirm(q.is_guest ? `Clear ${q.name}'s PIN? …` : `Reset ${q.name}'s PIN? …`)`` | Admin |
| index.html:1627 | ``confirm(`Remove ${q.name}? …`)`` | Admin, guest |
| index.html:1633 | ``confirm(`Purge ${q.name}'s data now? …`)`` | Admin, guest |
| index.html:1638 | `confirm('Unpair this device? …')` | Admin |
| index.html:1643 | `confirm('Generate a new pairing code? …')` | Admin |
| apps/f260.html:1131 | `alert('This browser cannot encrypt the journal (needs a secure https page).')` | Otherwise f260 uses its own `confirmModal` (1756; used at 1763, 1768, 2021) |
| dw:1098 · dwl:1098 | `confirm('Clear all saved progress?')` | Build guide |
| dw:1101 · dwl:1101 | `alert('Not a progress file')` | Import |
| dw:1587 · dwl:1457 | `confirm('Clear the meeting point for everyone?')` | |
| dw:1590 · dwl:1460 | ``confirm(`Set the family meeting point ${nm}?`)`` | Long-press on the map |
| dw:1721 · dwl:1591 | ``confirm(`Meet at ${nm}?\n\nOK sets the pin for everyone. …`)`` | "Meet here" |

- **No native dialogs:** tally, timer, leftovers, prayer, verses, kidverse, hub.js. Searched `(^|[^.\w$])(alert|confirm|prompt)\s*\(` and `window\.(alert|confirm|prompt)\(`.
- **`prompt(`:** NOT FOUND IN CODE.

### 2.8 Other platform bypasses
| file:line | snippet | note |
|---|---|---|
| index.html:475 | `hub.session && hub.session.profile && hub.session.profile.is_guest` | Reads the raw session because `hub.profile` drops `is_guest` (hub.js:60-62) |
| index.html:525, 527 | `'hub.profiles'` read/write | hub.js's own key (hub.js:28) |
| index.html:889 · apps/kidverse.html:467 | `'hub.cache.' + app + '.' + scope + …` | Depends on hub.js's private key format (hub.js:29) |
| index.html:1287 | Removes every `hub.*` key | No SDK API exists for this |
| index.html:1502 | `hub.device.token`, `hub.session.token` in hand-built headers | Skips `hub.request` (see 2.2) |
| index.html:1364 · apps/kidverse.html:416 | `Date.now() + (Number(hub.skew) or 0)` | Reads the SDK's clock skew (declared at hub.js:50, set at hub.js:290). Not in the SDK's documented API (hub.js:1-21) |
| index.html:688, 1158, 1221 | `hub.sync.lastPull` | An undocumented sync field (declared hub.js:51, set hub.js:311). The header documents only `hub.sync.state` (hub.js:13) |
| index.html:1684 | `hub.setSession({ token: hub.session.token, profile: { ...hub.session.profile, ...r.profile } })` | The shell edits the session directly after an admin edit. hub.js uses the same pattern internally (482, 488) |
| index.html:498-615 | Pairing form, profile picker, PIN keypad (`hub.pair` / `hub.login` / `hub.createPin`, hub.js:159-174) | Owner of auth (expected). Also reads `hub.device` directly at 528, 1277, 1590, 1704 |
| apps/f260.html:2025-2031 | `hub.THEMES.map(…)` into `#themeSeg` (643); a click calls `hub.setTheme(…)` | A second theme picker besides Me (index.html:1259, 1283). It writes through the SDK |
| apps/f260.html:988-1128 | Journal passcode (PBKDF2 1004-1005), WebAuthn unlock (1059-1071), `askPasscode` (1128), autolock key `f260.autolock` (891) | Its own lock, separate from the hub profile PIN |
| apps/prayer.html:1531-1540 | Its own `applyTheme()`, which only updates the theme-color meta | See 2.5 |
| dw:591, 1034 · dwl same | Own light/dark toggle, removed at runtime | See 2.5 |
| dw:692 · dwl:692 | `const roleOf=()=>(window.hub&&hub.profile)?hub.profile.kind:'guest'` | Its own role when there is no hub profile |
| dw:693 · dwl:693 | `VIEW_ONLY` = kid or kiosk, unless the family `kidshare:<id>` row is true | Its own permission rule |
| dw:1053, 1105, 1611 · dwl:1053, 1105, 1481 | `hubOnline()`; `hub.ready({optional:true})` | Runs without a session and falls back to localStorage (hub.js:327 skips the redirect when `optional`) |
| dw:1629 · dwl:1499 | `(window.hub&&hub.api)` or a hard-coded Worker URL | Duplicates hub.js:25 |
| apps/prayer.html:1142 · apps/f260.html:1250 | `function toast(…)` | Own toasts instead of `hub.toast` (hub.js:431-435) |
| index.html:1456-1459 · apps/verses.html:248-282 · apps/kidverse.html:280-313, 608-628 | `speechSynthesis.speak(u)` | Read-aloud is built four times. hub.js has no text-to-speech helper: NOT FOUND IN CODE (searched `speechSynthesis` in apps/hub.js) |
| index.html:449-450 · apps/hub.js:461 · dw:1343 (+8 more) · dwl:1213 (+8 more) | `FALLBACK = '#8A6A4B'   // … (the mocha token)` | The token value (`--mocha`, apps/design.css:73) copied as a hex literal |

### 2.9 Per-file summary
| file | storage bypasses | network bypasses | own CSS | hex count | native dialogs |
|---|---|---|---|---|---|
| index.html | 9 lines (466, 468, 525, 527, 889, 922, 927, 1108, 1287) | 3 (464, 487, 1502) | Yes (shell, on `.ds`) | 13 (11 JS + 2 meta) | 9 confirm |
| apps/hub.js | Platform (`lsGet`/`lsSet` 32-33; 402) | Platform (135) | n/a | 1 | 0 |
| apps/design.css | n/a | n/a | Token source | 275 | n/a |
| apps/tally.html | 0 | 0 | Minor `.ds` overrides | 0 | 0 |
| apps/timer.html | 0 | 0 | Minor `.ds` overrides | 0 | 0 |
| apps/leftovers.html | 0 (old data via `hub.migrate` 174) | 0 | Yes (no `.ds`) | 0 | 0 |
| apps/prayer.html | 0 (old data via `hub.migrate` 649-650) | 0 fetch; Google Fonts (12-14) | Yes, full set (no `.ds`) | 3 (2 JS + 1 meta) | 0 |
| apps/f260.html | 3 helper lines (898-900), used for one key, `f260.journal` | 0 | Yes, full set (no `.ds`) | 0 | 1 alert |
| apps/verses.html | 0 | 0 | `.ds` plus overrides | 0 | 0 |
| apps/kidverse.html | 1 (467, reads the SDK cache) | 0 | `.ds` plus overrides | 0 | 0 |
| apps/dollywood.html | 18 lines (see 2.1) | 1 (1630) | Yes (6-566; flavour overrides 208-565) | 294 (144 style + 146 JS + 4 markup), plus 59 in the payload | 5 (4 confirm, 1 alert) |
| apps/dollywood-live.html | 18 lines (see 2.1) | 1 (1500) | Yes (same) | 257 (144 + 109 + 4), plus 59 in the payload | 5 (4 confirm, 1 alert) |

## 3. Hub shell — index.html

index.html has 1716 lines. It has one inline `<style>` (index.html:18-362), one external script (index.html:440) and one inline `<script>` (index.html:441-1714). That script holds an async IIFE at index.html:442-1713.

### 3.1 Head and boot

#### Head elements
| Line | Element | Value |
|---|---|---|
| index.html:2 | `<html lang>` | `en` |
| index.html:4 | meta charset | `utf-8` |
| index.html:5 | meta viewport | `width=device-width, initial-scale=1, viewport-fit=cover`. There is no `maximum-scale` or `user-scalable` |
| index.html:6 | `<title>` | "Anderson House". At runtime it is replaced by `registry.title` (index.html:470) |
| index.html:7 | meta description | the family hub blurb |
| index.html:8 | meta theme-color | `#F7F2EB`, `media="(prefers-color-scheme: light)"` |
| index.html:9 | meta theme-color | `#1A1512`, `media="(prefers-color-scheme: dark)"` |
| index.html:10 | apple-mobile-web-app-capable | `yes` |
| index.html:11 | mobile-web-app-capable | `yes` |
| index.html:12 | apple-mobile-web-app-status-bar-style | `default`. No JS changes it |
| index.html:13 | apple-mobile-web-app-title | `Hub` |
| index.html:14 | link manifest | `manifest.json` |
| index.html:15 | link icon | `icon.svg` (`image/svg+xml`) |
| index.html:16 | apple-touch-icon | `180x180` `icons/apple-touch-icon.png` |
| index.html:17 | stylesheet | `apps/design.css`, the only external stylesheet |
| index.html:18-362 | inline `<style>` | shell CSS |
| — | apple-touch-startup-image, preload/preconnect, `<noscript>`, meta `color-scheme`, meta `format-detection` | NOT FOUND IN CODE. The head (1-17) was read in full, and `apple-touch-startup`, `noscript`, `preload`, `preconnect` were each searched: 0 hits |

- **Runtime theme-color:** `syncThemeColor()` (index.html:656-658) writes the computed `--bg` into both theme-color metas and leaves their `media` attributes as they are.
  - It is called at index.html:624, 767, 1283 and 1702.
  - It also runs on a `prefers-color-scheme` change (index.html:1703).

#### Body scaffold
| Line | Element |
|---|---|
| index.html:364 | `<body class="ds">` |
| index.html:366-372 | `#gate`, hidden at load: `.welcome-art` (inline wave SVG, index.html:367-370) and `#gate-panel` (index.html:371) |
| index.html:374-402 | `#shell`, hidden at load. `main#views` (375-392) holds `#ptr` (376) and four `section.view`: home (377), apps (378-381), chat (382-390) and me (391). `nav#tabbar.tabbar.sidebar` is at 393-401 |
| index.html:404 | `button#timer-pill.pill`, hidden at load |
| index.html:406-414 | `#viewer`: bar `#pill.topbar` (407-412) and `iframe#frame`. The iframe has a static `title="App"` and `allow="microphone; camera; web-share; geolocation; screen-wake-lock"` (413) |
| index.html:416-438 | Inline SVG sprite with 21 `<symbol>`s (417-437): i-home, i-apps, i-chat, i-me, i-chev, i-refresh, i-arrow, i-plus, i-x, i-check, i-camera, i-back, i-bell, i-book, i-bowl, i-pray, i-flame, i-mic, i-send, i-timer, i-sparkle |
| — | These are created at runtime and appended to `body`: `#hub-toast` in a `div.ds` (apps/hub.js:433) and each `.sheet-backdrop` (index.html:744-746) |

#### Scripts
| Line | Script |
|---|---|
| index.html:440 | `<script src="apps/hub.js" data-app="hub" data-scope="family">`. A classic script at the end of the body, with no `defer` and no `module` |
| index.html:441-1714 | Inline `<script>` holding `(async function () { … })()` (442-1713), which is the whole shell |
| — | Any other script: NOT FOUND IN CODE (`<script` has 2 hits: 440, 441) |

#### Boot sequence
| # | Step | Lines |
|---|---|---|
| 0 | hub.js runs first. It reads `hub.device` and `hub.session` from localStorage. `applyTheme()` sets `data-theme` (it is removed for system/hearth), `data-scheme`, `data-kind` and `--accent` on `<html>`. It also adds its own `prefers-color-scheme` change listener | apps/hub.js:48-49, 74-83, 111-112 |
| 1 | Helper consts are declared, then `hub.use()` declares the synced channels: reminders/family, f260/person, leftovers/family, prayer/person, hub/person, timer/person, dollywood-live/family and kidverse/both. The script tag adds hub/family (index.html:440, apps/hub.js:37-43). The kiosk branch adds prayer/family at index.html:1042 | helpers index.html:443-455; `hub.use` 458-459; apps/hub.js:212-218 |
| 2 | Listeners are attached while the IIFE body runs | see 3.6 |
| 2a | `hub.sheenFrom(views)` is called with no guard. `hub.sheenFrom` is defined only inside `sheen()`, which returns early under `prefers-reduced-motion: reduce`. When reduced motion is on, `hub.sheenFrom` is undefined when line 662 runs, the IIFE throws and the page stays blank (runtime-confirmed in §0.2) | index.html:662; apps/hub.js:441-447 |
| 3 | The service worker is registered only on `https:` or `localhost`, with `register('sw.js')`. On `updatefound`, when the installing worker reaches `installed` and a controller exists, the page toasts "Hub updated — it will use the new version next time it opens." (4000 ms). Registration errors are swallowed (`.catch(() => {})`) | index.html:1691-1698 |
| 4 | `await loadRegistry()` fetches `apps.json?ts=<ms>` with `cache: 'no-store'` and no timeout. On any failure it falls back to localStorage `hub.registry`, then sets `document.title`. The SW serves `apps.json` network-first with a cached fallback | index.html:1701, 462-471 (fetch 464); sw.js:38-41 |
| 5 | `syncThemeColor()` runs and a `prefers-color-scheme` change listener is added | index.html:1702-1703 |
| 6 | Routing: no `hub.device` → `showPairing()`; no `hub.session` → `showPicker()`; otherwise `enterShell()`. `#gate` and `#shell` stay hidden until then | index.html:1704-1706, 366, 374 |
| 7 | `enterShell()` unhides the shell, resets chat state and calls `hub.reset()`. It then calls `hub.ready().then(renderGrid; renderHome if on home; renderTimerPill)` and runs `renderBrand`/`renderMe`/`renderGrid`/`syncThemeColor` synchronously. Last it routes by hash | index.html:620-629 |
| 8 | Wake Lock is attached to the first `pointerdown`. This only happens after the `await loadRegistry()` at 1701 has settled | index.html:1709-1712 |

- **`hub.ready`:**
  - When no channel has been cached, it waits up to 6 s for the first pull (apps/hub.js:334-337).
  - The first time it runs, it wires visibility/online/offline/message/storage and the 30 s poll inside a one-time `wired` block (apps/hub.js:338-365).
- **Update handling:**
  - The page posts no skip-waiting message and has no `controllerchange` reload. Both are NOT FOUND IN CODE: 0 hits for `controllerchange` and `skipWaiting` in index.html.
  - The worker calls `self.skipWaiting()` on install (sw.js:22) and `clients.claim()` on activate (sw.js:25).
  - Precached files are served stale-while-revalidate (sw.js:44-49).

### 3.2 Screens and surfaces

| Surface | How shown | Lines |
|---|---|---|
| Gate wrapper (full-bleed, welcome wave art) | `showGate(html)` hides `#shell`, unhides `#gate`, fills `#gate-panel` and re-runs `renderTimerPill` | index.html:366-372, CSS 28-37, fn 496 |
| Pairing screen: title, "First time on this <device>?", `#paircode` (password, minlength 6, autofocus), `#pairname` (defaults to DEVICE_NAME, maxlength 40), `#pairmsg`, "Pair this device" | Shown at boot with no device (1704), when the profile fetch fails with no device (528), and on reauth or auth loss with no device (766, 771). Submit → `hub.pair` → `showPicker`; an error goes to `#pairmsg` (511) | index.html:498-513 |
| Profile picker: "Who's this?", 8 skeleton `.pcard`s, then one `.pcard.glass-strong` per profile. The last profile gets a `.last` ring. Sub-labels: Guest [· PIN] [· until/ended], Welcome back, Tap to start, Display, PIN, Create your PIN. Focus moves to the `.last` card, or else the first card (541). Errors show in `#pickmsg` | Shown at boot with no session (1705), after pairing (510), from Me → Switch (1282), from the TV's Switch (1133), from the keypad's Back/Escape (582, 590) and on reauth (766, 771). It always runs `hub.setSession(null)` first (517) | index.html:516-542, CSS 38-51 |
| Tap-to-enter for kid, kiosk and PIN-less guest | `pick()` → `hub.login(id)` → `enterShell` | index.html:543-548 |
| PIN entry pad: avatar and name, hint, dots (at least 4, `aria-live="polite"`, 556), a 3×4 pad (1-9, Back, 0, Delete), `#pinmsg`, "Continue" (disabled under 4 digits). Maximum 8 digits. Keys: digits, Backspace, Enter, Escape | Adult with a PIN (549) | `showPinPad` 598-603, `keypad` 567-597, `padHtml` 551-566, CSS 53-62 |
| PIN create: the same pad titled "Create your PIN", typed twice, with a mismatch message. `pin_already_set` switches to the PIN pad (611); `needs_pin_setup` from login switches here (601) | Adult without a PIN (549) | index.html:604-615 |
| Shell frame | `enterShell()` | index.html:374-402, 620-629, CSS 64-88 |
| Tab bar: 4 tabs (Home, Apps, Chat, Me). A `.tab-ind` slides via `--i`. At ≥1024 px it becomes a 220 px sidebar (design.css:569-575) with a brand (avatar and title) | Always in the shell; hidden for the kiosk (CSS index.html:78) | index.html:393-401, `renderBrand` 630-633, CSS 82-88 |
| Pull-to-refresh `#ptr`: arms after 70 px, then a busy spinner | Touch on `#views` at scrollTop 0 with no app open (664) | index.html:376, CSS 72-77, JS 661-676 |
| Home hero: date kicker, "Good morning/afternoon/evening, <name>.", summary sub-line (or "All quiet in the house."), time-of-day light, art `art/hero/<tod>.svg` (kid: `play`) | Every `renderHome` except the kiosk | `heroHtml` index.html:965-973, 1199-1200, CSS 90-100 |
| Home card "Today's reading" (F260): ring (weekDone/5), next ref, "Plan complete" or "Start with Genesis 1-2", week/day/read ✓/streak (or "Week 1 of 52"), "Open F260" | `canSee('f260')` | index.html:1161-1171 |
| Home card "In the fridge": "N to eat this week" or "Nothing aging", up to 3 freshness bars (`.stale` at ≥7 d), "Open the ledger" | Always on the adult/guest Home; the button only when `canSee('leftovers')` | index.html:1172-1182, `fridgeDue` 680-681, CSS 117-120 |
| Home card "Prayer": avatar, "N to pray · M done" or "Nothing on the list today", streak sub-line, "Open prayer" | `canSee('prayer')` | index.html:1183-1194, 837-869 |
| Home card "At the park": names, "At Dollywood · last seen", face list, "Open the map" (only when `canSee('dollywood-live')`, 900) | Any `loc:*` row under 4 h old; adult/guest and kid Home | `parkCardHtml` index.html:891-901, `atPark` 871-878, 1195, 1148 |
| Home card "Kids": a chip per kid with ★ this week and badges; "N stars this week · N to cash in" | Any kid profile in `hub.people()`; adult and guest Home (no guest check at 1196) | `kidsCardHtml` index.html:911-919, 1196 |
| `.glance` card grid (1/2/3 columns; `.two` when there are 2 cards) | Adult/guest and kid Home | index.html:1201, 1152, CSS 105-107 |
| Reminders card with an add form (`#remtext`: placeholder only, maxlength 140; + button). Rows have a Done ✓ button when `profile.kind === 'adult'` (1224) | Adult/guest Home | index.html:1203-1205, `renderReminders` 1218-1227, submit 1208-1214, done 1230-1234 |
| "Around the house" feed: grouped per person, an icon per line, time ago, a refresh button, "Show more" (30 per page, up to 100) | Adult/guest Home | index.html:1206, `renderFeed` 946-964, `loadFeed` 923-934 |
| Kid-mode Home: hero (sub "N stars this week — ready to play?" or "Ready to play?", `play` art), `.kid-cta` "Let's play — open your apps" (→ Apps), Stars card ("Open Kid Verse" only when `canSee('kidverse')`, 903, 909), optional park card, read-only Reminders (no form, no Done) | `p.kind === 'kid'` | index.html:1146-1157, `starsCardHtml` 902-910, CSS 185-188, 197-206 |
| TV/kiosk board, built once and repainted in place. Panes: blurred crossfading backdrop (2 imgs and a scrim); hero pane (date, clock, greeting, Switch); Verse of the week (week from the family kidverse `week` row, refs from the embedded `MEMORY` table, optional kid line); Prayed today (faces from family prayer `prayedBy[today]`); Stars this week; Around the house (5 lines); Reading today (adults with a "Read week…" feed line today, others dimmed `.off`); Reminders (hidden when empty) | `p.kind === 'kiosk'` | index.html:977-1144, DOM 1119-1128, `MEMORY` 987-1040, paint 1047-1077, CSS 125-175 |
| Apps tab tile grid: 4/6/8 columns (kid 2/3/4). Square `.tile` buttons with icon, label and `aria-label="Open <name>"`. Leftovers gets a badge with the `fridgeDue` count. Empty state | `showTab('apps')` | index.html:378-381, `renderGrid` 693-707, CSS 216-240 |
| Wide tile widget (`widgetHtml`): F260 gets a ring and "Week N · next: ref · streak" (or "Start week 1" / a loading skeleton). Every other app shows only its label. F260 is the only `"tile":"wide"` entry of the 9 in apps.json (apps.json:4) | A `tile: "wide"` entry | index.html:685-692, CSS 229-234 |
| App viewer: a fixed full-screen layer that scales from the tapped element (`--ox`/`--oy`), with a `.dark` variant when `a.dark`. Slim bar: "Hub" back, app name (opens the Switch app sheet), timer chip, reload. `iframe.src = a.file` only when the id changes (724) | `openApp` from: a tile (708); a Home `[data-open]` (1229); a sheet (752); `hub:open` (765); the timer pill or chip (824-825); the hash (627, 652); a service-worker open (1575) | index.html:406-414, CSS 325-339, 712-728 |
| Viewer close: `.closing` animation, then after 220 ms the iframe goes to `about:blank`; it also flushes and pulls. Escape does not close it (the only keydown listeners are 594 and 749) | `showTab` without keepViewer (635), the Hub button (736), reauth (766, 771), Switch (1282) | `closeViewer` index.html:729-735 |
| "That app is not available for this profile." toast | `openApp` when `!canSee` | index.html:715 |
| Chat tab: title, cap "N/M today" (`#chat-cap`), log (`aria-live="polite"`), fixed glass composer. The composer has a mic (only when `hub.voiceSupported`, 1521), an input (placeholder only, no label or aria-label; maxlength 2000; `enterkeyhint="send"`) and Send | `showTab('chat')` → `openChat`, which loads once per sign-in (`chatLoaded` is reset at 622). The composer is shown only on chat (636) and is hidden by `openApp` (714) | index.html:382-390, CSS 242-268, 1464-1485 |
| Chat bubbles: user (avatar, right) and bot (sparkle icon, left); ✓ chips (`chip-ok`; the `chip-danger` style never renders, because failed tools send `chip: null`, see 1b §14); typing dots; error bubble `.err` | Sending and history | `bubble` index.html:1439-1448, 1492, 1495-1500, 1516, CSS 244-258 |
| Chat notes: "not set up yet", a kid or adult greeting with `chat` art, "Could not load the chat: …" | `openChat` results | `chatNote` index.html:1449-1453, 1473-1474, 1483 |
| Daily cap reached: the input is disabled with the placeholder "Back tomorrow — that is enough for today." The Send button is not disabled by `setCap` | `setCap` (also on a 429, 1503) | index.html:1460-1463 |
| Kid read-aloud (`speechSynthesis`, rate 0.9, en-US, 600 chars): kid profile only, visible tab only | Tool event with `speak: true` | index.html:1456-1459, 1497 |
| Me hero: photo button (camera badge; disabled unless `kind === 'adult'` or admin), kind label, name, Switch | `renderMe` | index.html:1251-1253, CSS 271-277, 284-285 |
| "Your photo" sheet: Choose a photo, Remove photo (if one is set), Cancel. Hidden `#photo-file` input | Photo button | index.html:1254, 1293-1309 |
| Guests card: help text, guest rows ("until…" or "No end date"; "PIN" or "taps to sign in"), "Add a guest" | `kind === 'adult' && !isGuest()` | index.html:1256, `renderGuests` 1384-1390 |
| Add a guest sheet: Name (focused on open, 1407), Face (24-emoji grid, `role="group"`), Colour (10 swatches), PIN (optional, 4-8 digits), Stays until (Tonight / A week (default) / Keep), message, Cancel / Add guest | "Add a guest"; the kiosk gets `hub.kioskNudge()` instead (1392) | `addGuestSheet` index.html:1391-1425, CSS 309-315 |
| Family album card: grid of squares (min 96 px) with an uploader caption. A delete × (with a confirm) appears for your own photos or for the admin. "Add a photo". Empty state | `kind === 'adult'` (guests included) | index.html:1257, `renderAlbum` 1426-1433, CSS 278-283 |
| Appearance: one theme card per `hub.THEMES` entry (6: apps/hub.js:64-71), each a painted swatch (`data-preview`; System is half and half), `aria-pressed` | Every profile kind | index.html:1258-1261, click 1283, CSS 288-304 |
| Notifications: a device switch (`role="switch"`, disabled until checked). Help states: unsupported / iOS "add to Home Screen" (1549), blocked (1550), on/off (1554), not allowed (1562), no push keys (1564), "Could not turn notifications on…" (1569). Per-kind switches: leftovers (adult), f260 (canSee f260), behind (adult + f260), prayer (adult + prayer), park (adult + dollywood-live). "Send a test notification". The per-kind block and the test button are hidden until subscribed (1553) | Not the kiosk | index.html:1262-1271, `renderNotif` 1534-1572 |
| Kids' rewards: per kid, avatar, ★total to cash in, this week, "ever" (when earned > total), badges, last cash-in. Cash in and Reset week each have a confirm and are disabled at 0 | `kind === 'adult' && !isGuest()` | index.html:1272, `renderRewards` 1349-1379 |
| Sync card: status dot, state and lastError, Waiting to send, Last checked, This device; "Check now"; "Forget this device" (confirm → remove `hub.*` keys → reload) | Every profile | index.html:1273-1279, 1284-1289 |
| Admin card sub-panels. **Profiles:** Edit, plus Reset PIN (adult with a PIN). Guests get Edit, Clear PIN (if set), Remove, and Purge (once expired). **Pairing code:** "Choose a new code" sheet (6-64 chars, typed twice), or "Generate one" (confirm, then a one-time code sheet). **Devices:** paired/seen dates, "this device", Unpair (not for this device). **Usage (30 days):** chat and push tables (30 rows each). Load error: "Could not load admin data: …" (1584) | `p.isAdmin`; a skeleton shows while loading | index.html:1280, `renderAdmin` 1579-1658 |
| Edit profile sheet: name, emoji (text input, maxlength 8), photo (choose/remove), colour swatches, kind select (disabled for an admin), `#pmsg`, Cancel / Save | Admin → Edit | `editProfile` index.html:1659-1688 |
| Timer pill: fixed glass pill at the bottom centre with time and ring. At ≥1024 px it is offset by the sidebar. On the Chat tab it lifts above the composer via `--chat-h`, which is measured from `offsetHeight` in `showTab` (639). Inside the viewer it becomes a chip in the bar, hidden when the Timer app is open | `timer.active` set, gate hidden and a profile present (814) | index.html:404, 410, CSS 343-361, 813-823 |
| Toasts: hub.js creates `#hub-toast.toast` with `role="status"` inside a `div.ds` (default 2200 ms). The shell moves it above the tab bar, or right of the sidebar. `hideToast` runs on `openApp` | `hub.toast(...)` throughout | apps/hub.js:431-434, CSS index.html:340-341, 784 |
| Sheets: `.sheet-backdrop > .sheet[role=dialog]`. They close by tapping the backdrop, Escape or `[data-close]`; `[data-open]`/`[data-open-tab]` close and navigate. `aria-modal` and focus-on-open in `sheet()` are NOT FOUND IN CODE: `aria-modal` has 0 hits, and the `.focus()` hits are 541, 1407, 1517, 1524, of which only 1407 (`#gname`) is in a sheet. Instances: Switch app (740-741), Your photo (1297-1298), Add a guest (1394-1403), New pairing code (1645), Choose a pairing code (1649), Edit profile (1661-1670) | `sheet()` | index.html:743-758 |
| Native `confirm()` dialogs (9) | Forget device (1286), cash in (1367), reset week (1373), remove album photo (1432), reset/clear PIN (1620), remove guest (1627), purge (1633), unpair (1638), generate code (1643) | same lines |
| Sync dot `#syncdot` on the Me tab: class `dot-<state>`, title "Sync: <state>". Initial class `dot-offline` | `hub.onSync` (770) and `hub:sync` from the iframe (764) | index.html:399, `setDot` 769 |
| Service-worker update toast | New worker installed | index.html:1695 |

#### Empty states
| Where | Text / art | Line |
|---|---|---|
| Apps grid | "No apps for this profile yet." + `art/empty/list.svg` | index.html:696 |
| Feed | "Nothing has happened yet. Check off a reading…" + `art/empty/feed.svg` | index.html:949 |
| Reminders | "Nothing to remember right now." + `art/empty/list.svg` | index.html:1223 |
| Album | "Photos of the family for the TV…" + `art/empty/feed.svg` | index.html:1430 |
| Chat | Greeting + `art/empty/chat.svg` | index.html:1474 |
| TV panes | "No one yet today." / "No readers yet." / "No stars yet." / "Nothing has happened yet." The reminders pane is hidden when empty | index.html:1061, 1065, 1068, 1071, 1074 |
| Home cards | "Nothing aging", "Nothing on the list today", "No stars yet", "No stars yet this week." | index.html:1179, 1186, 907, 917 |
| Me/Admin | "No kid profiles yet.", "No guests right now.", "No paired devices.", "No chat yet.", "No pushes yet." | index.html:1353, 1388, 1605, 1609, 1612 |

#### Error states
| Where | Form | Line |
|---|---|---|
| Pairing | `e.message` in `#pairmsg` | index.html:511 |
| Picker | `e.message` in `#pickmsg` | index.html:529, 546 |
| PIN pad | `e.message` in `#pinmsg`; pin cleared | index.html:575 |
| Chat | "Could not load the chat: …" note; `.err` bubble | index.html:1483, 1499, 1516 |
| Feed "Show more" | Toast "Could not load more right now." | index.html:931 |
| Admin | "Could not load admin data: …" | index.html:1584 |
| Guest / pairing-code / edit sheets | Message in `#gmsg` / `#rotmsg` / `#pmsg` | index.html:1412-1413, 1423, 1653, 1655, 1686 |

#### Loading states
| Where | Form | Line |
|---|---|---|
| Picker | 8 `.pcard.skeleton` | index.html:522 |
| F260 wide tile | `<span class="skeleton">loading</span>` | index.html:688 |
| Home cards | `sk` skeleton when there is no pull and no cache (`cached()`); the hero sub-line stays empty | index.html:1158-1159, 1168, 1179, 1191, 1199 |
| Reminders | 2 skeleton rows | index.html:1221-1222 |
| Feed | 4 skeleton rows; "Loading…" on Show more | index.html:948, 959 |
| Chat | Skeleton bubble | index.html:1468 |
| Admin | 120 px skeleton | index.html:1280 |
| Notifications | "Checking…" with the switch disabled | index.html:1263 |
| Uploads | Toast "Uploading…" for 60 s | index.html:1304, 1676 |
| Pull-to-refresh | `.busy` spin | index.html:76, 673 |
| Buttons disabled while in flight | Pair, Continue, Add guest, Send, test notification, notification switch | index.html:509, 574, 1416, 1489, 1545, 1557 |

### 3.3 Functions index

#### Globals and helpers
| Name | Line | Purpose |
|---|---|---|
| `$` | index.html:443 | `document.querySelector` shorthand |
| `esc` | index.html:444 | Alias of `hub.escape` |
| `DEVICE_NAME` | index.html:445-448 | UA → iPad / iPhone / Android / Mac / Windows PC / Device |
| `SWATCHES` | index.html:449 | 10 profile/guest colour hexes |
| `FALLBACK` | index.html:450 | Default tint `#8A6A4B` |
| `registry`, `current`, `svgCache` | index.html:451-453 | apps.json state, the open app, fetched icon text |
| `buzz` | index.html:454 | `navigator.vibrate(8)` haptic |
| `avatar` | index.html:455 | Wraps `hub.avatarHtml` |
| `loadRegistry` | index.html:462-471 | Fetches apps.json into the cache (or reads the cache); sets the title |
| `appById` | index.html:472 | Registry lookup |
| `isGuest` | index.html:475 | Session `profile.is_guest` |
| `householdAdultIds` | index.html:476 | Non-guest adult ids |
| `guestUntil` | index.html:477 | "until/ended <date>" label |
| `visibleApps` | index.html:478-482 | Kiosk: none. Guest: apps open to any household adult. Otherwise `visibleTo` |
| `canSee` | index.html:483 | id is in `visibleApps` |
| `iconHtml` | index.html:484-492 | Fetches and caches an icon SVG, or an inline SVG, or the emoji/initial |

#### Gate
| Name | Line | Purpose |
|---|---|---|
| `gate`, `panel`, `shell` | index.html:495 | Gate/shell elements |
| `showGate` | index.html:496 | Swaps to the gate with the given HTML |
| `showPairing` | index.html:498-513 | Pairing form → `hub.pair` → picker |
| `profiles` | index.html:515 | Last picker list |
| `showPicker` | index.html:516-542 | Clears the session, renders profile cards, click → `pick` |
| `pick` | index.html:543-550 | Tap login, or PIN pad / create PIN |
| `padHtml` | index.html:551-566 | PIN pad markup |
| `keypad` | index.html:567-597 | PIN pad controller (inner `draw`, `submit`, `onKey`, `stop`); returns `{setMessage, reset, stop, setHint}` |
| `showPinPad` | index.html:598-603 | PIN login |
| `showCreatePin` | index.html:604-615 | Two-pass PIN creation |

#### Shell, navigation, grid, viewer
| Name | Line | Purpose |
|---|---|---|
| `TABS`, `tab` | index.html:618-619 | Tab ids and the current tab |
| `enterShell` | index.html:620-629 | Shell boot after sign-in; hash routing |
| `renderBrand` | index.html:630-633 | Sidebar brand |
| `showTab` | index.html:634-648 | Tab switch (see 3.7) |
| `syncThemeColor` | index.html:656-658 | theme-color metas ← `--bg` |
| `views`, `ptr`, `ptrY`/`ptrArmed`/`refreshing` | index.html:661-663 | Pull-to-refresh state |
| `refreshAll` | index.html:672-676 | pull + flush + forced feed load, then re-render home/me |
| `ageDays` | index.html:679 | Days since a date |
| `fridgeDue` | index.html:680-681 | Leftovers ≥4 days old, oldest first |
| `ringHtml` | index.html:682-684 | Progress ring SVG |
| `widgetHtml` | index.html:685-692 | Wide-tile widget |
| `renderGrid` | index.html:693-707 | Apps grid |
| `viewer`, `frame` | index.html:711 | Viewer elements |
| `openApp` | index.html:712-728 | Opens an app in the iframe |
| `closeViewer` | index.html:729-735 | Closes the viewer |
| `sheet` | index.html:743-758 | Generic sheet; returns `{close, el}` |
| `setDot` | index.html:769 | Sync dot |

#### Timer
| Name | Line | Purpose |
|---|---|---|
| `TIMER`, `tpill`, `tchip`, `timerTick`, `timerDone` | index.html:780-782 | Channel and state |
| `fmtLeft` | index.html:783 | `m:ss` |
| `hideToast` | index.html:784 | Hides `#hub-toast` |
| `timerActive` | index.html:785-787 | Valid, unfinished `timer.active` |
| `timerBeep` | index.html:788-796 | Three 880 Hz WebAudio beeps |
| `timerNotify` | index.html:797-803 | Local SW notification "Timer done", `data.url` `#timer` |
| `finishTimer` | index.html:804-812 | Runs once per `endAt`. If it ended under 60 s ago and the Timer app is closed: beep (writers only, 808), toast (4000 ms) and notify. Removes `timer.active` when `hub.canWrite` |
| `renderTimerPill` | index.html:813-823 | Pill and chip update; starts/stops the 1 s tick |

#### Home
| Name | Line | Purpose |
|---|---|---|
| `fmtDate`, `fmtTime`, `ago`, `dayKey`, `timeOfDay`, `greeting` | index.html:831-836 | Formatting |
| `prayerStreak` | index.html:837-844 | Consecutive `prayerDays` |
| `prayerToday` | index.html:848-869 | Read-only port of Prayer's `todaySet()` → `{total, done, due}` |
| `PARK_FRESH`, `atPark` | index.html:871-878 | `loc:*` rows fresher than 4 h |
| `isoWeek`, `starsOf`, `rewardsOf`, `kidStars` | index.html:881-885 | Kids' stars and rewards via `effectiveStars` |
| `ICON_STAR`, `ICON_PIN` | index.html:886-887 | Inline SVG strings |
| `cached` | index.html:889 | Channel pulled before (`since > 0`) |
| `agoText` | index.html:890 | "Nm ago" |
| `parkCardHtml`, `starsCardHtml`, `kidsCardHtml` | index.html:891-919 | Card markup |
| Feed state vars | index.html:921-922 | `clockTimer`, `feed`, `feedLimit`, …, and the cache read |
| `loadFeed` | index.html:923-934 | Fetches the feed (limit 30-100); caches the first 30 |
| `FEED_SYMBOLS`, `feedSymbol` | index.html:935-936 | Sprite fallback icons |
| `feedIconSync` | index.html:938-945 | Cached app icon, or `null` if not fetched yet |
| `renderFeed` | index.html:946-964 | Grouped feed, Show more, icon back-fill |
| `heroHtml` | index.html:965-973 | Home hero |
| `renderHome` | index.html:974-1217 | Kiosk / kid / adult Home |
| Kiosk-local (inside `renderHome`) | index.html:984-1129 | `tv` 984, `stats` 985, `MEMORY` 987-1040, `FAM_PRAYER`/`KV` 1041, `people` 1043, `ambientOf` 1044, `faceHtml` 1045, `photoList` 1046, `paint` 1047-1077, `crossfade` 1080-1105 (inner `done` 1089-1097), `refreshFeed` 1107-1109, `tick` 1110-1116, `icon` 1118, `q` 1129 |
| `renderReminders` | index.html:1218-1227 | Reminder rows |
| `lastPullSeen` | index.html:1242 | Re-render guard |

#### Me, rewards, guests, album
| Name | Line | Purpose |
|---|---|---|
| `renderMe` | index.html:1246-1314 | Me tab (nested `fileIn`/`fileFor` 1293, `pickFile` 1294) |
| `BADGE_NAMES` | index.html:1321 | Badge labels |
| `weekDayKeys` | index.html:1322 | Mon–Sun date keys for this week |
| `rewardRow` | index.html:1323-1329 | Normalises a stars row |
| `KV` | index.html:1330 | `{kidverse, family}` |
| `isDay` | index.html:1331 | YYYY-MM-DD test |
| `ledgerRows` | index.html:1332 | `ledger:<kid>:*` rows, sorted by `at` |
| `weekCountOf` | index.html:1333 | This week's star count |
| `applyLedger` | index.html:1335-1347 | Applies unapplied cash-in/reset rows to a copy |
| `effectiveStars` | index.html:1348 | Mirror row + ledger |
| `renderRewards` | index.html:1349-1379 | Rewards card; Cash in / Reset week write ledger rows |
| `GUEST_EMOJI` | index.html:1383 | 24 faces |
| `renderGuests` | index.html:1384-1390 | Active guests list |
| `addGuestSheet` | index.html:1391-1425 | Add-guest sheet → POST /api/profiles |
| `renderAlbum` | index.html:1426-1433 | Album grid and delete |

#### Chat, push, admin, wake lock
| Name | Line | Purpose |
|---|---|---|
| `chatLog`, `chatIn`, `chatForm`, `chatCap`; `chatLoaded`/`chatBusy`/`chatEnabled` | index.html:1436-1437 | Chat state |
| `scrollChat` | index.html:1438 | Scrolls `#views` to the bottom |
| `bubble` | index.html:1439-1448 | Message row |
| `chatNote` | index.html:1449-1453 | Centred note with optional art |
| `speakForKid` | index.html:1456-1459 | Kid-only TTS |
| `setCap` | index.html:1460-1463 | Cap label and disable |
| `openChat` | index.html:1464-1485 | Loads history once |
| Chat submit handler (inner `handle`) | index.html:1486-1518 (1495-1500) | Streams POST /api/chat and parses SSE (1504-1515) |
| Mic block | index.html:1519-1527 | `hub.voiceInput` toggle |
| `IOS`, `standalone`, `pushSupported`, `b64ToBytes` | index.html:1530-1533 | Push helpers |
| `renderNotif` | index.html:1534-1572 | Notifications card logic (nested `paint` 1553) |
| `renderAdmin` | index.html:1579-1658 | Admin panel (nested `kindLbl` 1586, `day` 1587, `nameOf` 1588) |
| `editProfile` | index.html:1659-1688 | Admin edit sheet |
| `lock`, `wake` | index.html:1709-1710 | Screen Wake Lock |
| `window.__tvStats`, `window.__tv` | index.html:985, 1137 | Test hooks for scripts/test-tv.mjs |

### 3.4 Network calls
| Method | Path | Line (index.html) | Via | Purpose |
|---|---|---|---|---|
| GET | `apps.json?ts=<ms>` (`cache: 'no-store'`) | index.html:464 | `fetch` | App registry |
| GET | `a.icon`, e.g. `icons/<id>.svg` | index.html:487 (feed back-fill via 962) | `fetch`, memoised in `svgCache` | Inline icon SVG |
| GET (iframe) | `a.file`; reload adds `?r=<ms>`; `about:blank` on close | index.html:724, 737, 732 | `iframe.src` | App page |
| POST | `<hub.api>/api/chat` | index.html:1502 | Direct `fetch` with `X-Device-Token`/`X-Profile-Token`, body `{message, apps}`, no timeout. A 401 is not routed to `handleAuthLoss` (1503) | Chat; the SSE stream is read at 1504-1515 |
| GET | `sw.js` | index.html:1692 | `serviceWorker.register` | Service worker |
| POST | `/api/pair` | index.html:510 | `hub.pair` (apps/hub.js:160) | Pair a device |
| GET | `/api/profiles` (no profile token) | index.html:524, 1421, 1628, 1634; also after a photo upload/remove (apps/hub.js:483, 489) | `hub.profiles` (apps/hub.js:164) | Picker list; refreshes `hub.people` |
| POST | `/api/login` | index.html:545, 600 | `hub.login` (apps/hub.js:168) | Sign in |
| POST | `/api/profiles/:id/pin` | index.html:609 | `hub.createPin` (apps/hub.js:172) | Create a PIN |
| POST | `/api/logout` | index.html:1282 (Me → Switch only) | `hub.signOut` (apps/hub.js:176) | Sign out. The TV Switch (1133) and every `showPicker` call only clear the session locally (`hub.setSession(null)`, 517) |
| GET | `/api/data/:app?scope=&since=` | index.html:623 (via `hub.ready`, apps/hub.js:336), 674, 733, 1136, 1284, 1497 | `hub.pull` (apps/hub.js:289). Also every 30 s (apps/hub.js:342), on visibility/online (apps/hub.js:339-340), and after album add/remove (apps/hub.js:495, 497) | Sync pull |
| POST | `/api/data/:app/batch?scope=` | index.html:674, 733, 1284. Writes are queued by `hub.set`/`hub.remove` at 809, 1211, 1232, 1369, 1374, 1541 and by `hub.setTheme` at 767, 1283 (apps/hub.js:91) | `hub.flush` (apps/hub.js:264) | Sync push |
| POST | `/api/activity` | index.html:1212, 1233, 1370, 1375 | `hub.activity` (apps/hub.js:373-381) | Feed lines |
| GET | `/api/activity?limit=N` (no profile token) | index.html:927 (30→100), 1108 (100) | `hub.activityFeed` (apps/hub.js:387) | Feed |
| PUT | `/api/profiles/:id/photo` | index.html:1307, 1676 | `hub.uploadPhoto` (apps/hub.js:481, 60 s timeout) | Profile photo |
| DELETE | `/api/profiles/:id/photo` | index.html:1299, 1674 | `hub.removePhoto` (apps/hub.js:487) | Remove photo |
| POST | `/api/album` | index.html:1306 | `hub.addAlbumPhoto` (apps/hub.js:494, 60 s timeout) | Album add |
| DELETE | `/api/album/:id` | index.html:1432 | `hub.removeAlbumPhoto` (apps/hub.js:497) | Album remove |
| POST | `/api/profiles` | index.html:1418 | `hub.request` | Add a guest |
| GET | `/api/chat/history` | index.html:1470 | `hub.request` | History, enabled flag, used/cap |
| POST | `/api/push/test` | index.html:1546 | `hub.request` | Test notification |
| GET | `/api/push/config` | index.html:1563 | `hub.request` | Enabled flag and VAPID public key |
| POST | `/api/push/subscribe` | index.html:1566 | `hub.request` | Save a subscription |
| DELETE | `/api/push/subscribe` | index.html:1559 | `hub.request` | Drop a subscription |
| GET | `/api/profiles` (with profile token) | index.html:1583 | `hub.request` | Admin list, including expired guests |
| GET | `/api/admin/usage` | index.html:1583 | `hub.request` | Devices, chat and push usage |
| POST | `/api/admin/profiles/:id/reset-pin` | index.html:1621 | `hub.request` | Reset or clear a PIN |
| DELETE | `/api/admin/profiles/:id` | index.html:1628 | `hub.request` | Remove a guest |
| POST | `/api/admin/profiles/:id/purge` | index.html:1634 | `hub.request` | Purge a guest |
| DELETE | `/api/admin/devices/:id` | index.html:1639 | `hub.request` | Unpair |
| POST | `/api/admin/pairing-code/rotate` `{}` / `{code}` | index.html:1644 / 1654 | `hub.request` | Generate / choose a pairing code |
| PUT | `/api/admin/profiles/:id` | index.html:1683 | `hub.request` | Edit a profile |
| — | Browser push service | index.html:1565 (`pushManager.subscribe`), 1559 (`unsubscribe`) | Push API | Subscription |
| GET (img) | Worker photo URLs via `hub.photoUrl` (apps/hub.js:457) | index.html:1046 (TV backdrop `lg`), 1431 (album `sm`); avatars via 455 | `<img>` | Photos |
| GET (img) | `art/hero/*`, `art/app/*`, `art/empty/*`, `art/ambient/{night,dawn,day,dusk}.svg` | index.html:971, 894, 904, 913, 1165, 1176, 1188, 696, 949, 1223, 1430, 1451, 1084 | `<img>` | Static art |

- **`hub.request`** (apps/hub.js:128-156):
  - The base URL is `hub.api`: the localStorage `hub.api` override, else the `DEFAULT_API` constant (apps/hub.js:25, 48).
  - It sends `X-Device-Token`/`X-Profile-Token` headers with `cache: 'no-store'`.
  - The timeout is 12 s by default (60 s for photo/album uploads).
  - A 401 goes to `handleAuthLoss`.

### 3.5 Client storage
| Key | Access | Line | Purpose |
|---|---|---|---|
| `hub.registry` | Write / read | index.html:466 / 468 | Offline copy of apps.json |
| `hub.profiles` | Write / read | index.html:525 / 527 | Offline picker list. Same key as hub.js `LS.profiles` (apps/hub.js:28), written by `hub.profiles()` (apps/hub.js:164) and read by `hub.people()` (apps/hub.js:166) |
| `hub.cache.<app>.<scope>[.<profileId>]` | Read | index.html:889 | `cached()`: has the channel been pulled (skeleton or not). Key format at apps/hub.js:29 |
| `hub.feed` | Read / write | index.html:922 / 927, 1108 | First 30 feed rows for an instant paint |
| Every key starting `hub.` | Remove | index.html:1287 | "Forget this device", then `location.reload()` (1288) |
| Indirect, through hub.js calls | — | apps/hub.js:26-30 | `hub.device` (pair). `hub.session` (login/createPin/signOut/`setSession` at 517, 1684). `hub.lastProfile` (read via `hub.lastProfile()` at 518; written at apps/hub.js:108). `hub.theme` (`hub.setTheme` at 767, 1283; apps/hub.js:90, 103). `hub.cache.*`/`hub.queue.*` (set/remove/pull). `hub.activityQueue` (apps/hub.js:375). `hub.api` (read only, apps/hub.js:48). `hub.migrated` |
| sessionStorage | — | — | NOT FOUND IN CODE (`sessionStorage`: 0 hits) |
| IndexedDB | — | — | NOT FOUND IN CODE (`indexedDB`: 0 hits) |

- **Error handling:** every direct `localStorage` access in index.html is inside `try/catch` (466, 468, 525, 527, 889, 922, 927, 1108, 1287).

### 3.6 Event listeners and timers

#### Listeners in index.html
| Event | Target | Line | Purpose |
|---|---|---|---|
| submit | `#pairform` | index.html:507 | Pair |
| click | `#profiles` (delegated) | index.html:537 | Pick a profile |
| click | `#pad`, `#pingo` | index.html:577, 584 | PIN digits, delete, back; submit |
| keydown | document (while the keypad is shown; ignored when the gate is hidden, 586) | index.html:585-595 | Digits, Backspace, Enter, Escape; removed by `stop()` (595) |
| click | `#tabbar` | index.html:649 | `showTab` |
| hashchange | window | index.html:650-654 | Routing |
| touchstart / touchmove / touchend (passive) | `#views` | index.html:664-671 | Pull-to-refresh, 70 px threshold (668) |
| scroll (passive) | `#views` via `hub.sheenFrom` | index.html:662 → apps/hub.js:447 | Glass sheen drift (defined only without reduced motion, apps/hub.js:442) |
| click | `#grid` | index.html:708 | Open app |
| click | `#pill-home`, `#pill-reload`, `#pill-name` | index.html:736, 737, 738-742 | Viewer bar |
| keydown | document (while a sheet is open) | index.html:747-749 | Escape closes |
| click | `.sheet-backdrop` | index.html:750-756 | Backdrop, `data-open`, `data-open-tab`, `data-close` |
| message | window | index.html:761-768 | iframe → shell. Filters on same origin and `source: 'hub'` only (no `ev.source` check). `hub:sync` → dot, `hub:open` → `openApp`, `hub:reauth` → close + picker or pairing, `hub:theme` → `setTheme` + `syncThemeColor` |
| `hub.onSync` | — | index.html:770, 827, 1243 | Dot; timer; re-render on a new `lastPull` |
| `hub.onAuthLoss` | — | index.html:771 | Picker or pairing |
| `hub.onChange` | — | index.html:826, 1236-1241 | Timer; album, reminders, home, grid |
| click | `#timer-pill`, `#pill-timer` | index.html:824, 825 | Open Timer |
| visibilitychange | document | index.html:828 | `renderTimerPill` when visible |
| load / error (`onload`/`onerror` properties) | TV backdrop `<img>` | index.html:1100 (reset at 1090) | Crossfade completion |
| click | `#kiosk-switch`, `#kid-apps` | index.html:1133, 1155 | Picker; Apps tab |
| submit / click | `#remform`, `#feed-refresh`, `#feed-more`, `#view-home` (delegated `data-open`/`data-done`) | index.html:1208, 1215, 959, 1228-1235 | Home actions |
| click | `#switch`, `#theme`, `#syncnow`, `#forget`, `#photo-btn`, `#album-add`, `#guest-add` | index.html:1282, 1283, 1284, 1285, 1295, 1301, 1311 | Me actions |
| change | `#photo-file` (`onchange`) | index.html:1302 | Upload |
| click | `#rewards-body` (`onclick`) | index.html:1360 | Cash in / reset |
| click / submit | `#gemoji`, `#gswatches`, `#gexp`, `#gform` | index.html:1404, 1405, 1406, 1408 | Guest sheet |
| click | `#album-grid` (`onclick`) | index.html:1432 | Delete photo |
| submit / click | `#chat-form`, `#chat-mic` | index.html:1486, 1522 | Chat |
| click | `#notif-prefs`, `#notif-test`, `#notif-toggle` (`onclick`) | index.html:1538, 1544, 1556 | Push |
| message | `navigator.serviceWorker` | index.html:1573-1576 | `source: 'hubsw'`, `type: 'open'` → hash, `openApp` or `showTab` (sender sw.js:67) |
| click / submit | `#admin-body`, `#rotate-gen`, `#rotate-choose`, `#rotform` | index.html:1615, 1642, 1648, 1650 | Admin |
| click / change / submit | Edit sheet `#swatches`, `[data-photo]`, file input, `#pform` | index.html:1671, 1672, 1676, 1679 | Edit profile |
| updatefound / statechange | SW registration / installing worker | index.html:1693, 1695 | Update toast |
| change | `matchMedia('(prefers-color-scheme: dark)')` | index.html:1703 | `syncThemeColor` |
| pointerdown (`once`) | document | index.html:1711 | Wake lock |
| visibilitychange | document | index.html:1712 | Re-request the wake lock if one was held |

#### Not in index.html, or provided by hub.js
| Item | Status |
|---|---|
| online / offline | NOT FOUND IN CODE in index.html (`online` has 0 hits; the 3 `offline` hits are sync-state strings). hub.js wires them in the shell context (apps/hub.js:340-341) |
| storage | NOT FOUND IN CODE in index.html. hub.js handles it (apps/hub.js:350-364) |
| visibilitychange pull + flush | apps/hub.js:339 |
| prefers-color-scheme change → `applyTheme` | apps/hub.js:83 |
| window scroll (passive) → sheen | apps/hub.js:448 (without reduced motion only) |
| deviceorientation (passive) → sheen tilt | apps/hub.js:449-451 (only where no permission prompt is needed; without reduced motion only) |
| resize / orientationchange / ResizeObserver / IntersectionObserver / MutationObserver | NOT FOUND IN CODE (0 hits each in index.html) |
| Shell → iframe postMessage | index.html:1283 `{source: 'hubshell', type: 'hub:theme'}`, received at apps/hub.js:343-347. The shell never posts `hub:pull`, although hub.js listens for it (apps/hub.js:345): 0 hits in index.html |
| iframe → shell senders | `tell()` at apps/hub.js:35: `hub:sync` (apps/hub.js:123), `hub:reauth` (apps/hub.js:152, 177, 328), `hub:theme` (apps/hub.js:92, 103), `hub:open` (apps/hub.js:430) |
| DOMContentLoaded / load / pagehide / pageshow / beforeunload | NOT FOUND IN CODE (0 hits each) |

#### Timers and loops
| Kind | Interval | Line | Purpose | Cleared |
|---|---|---|---|---|
| setTimeout | 220 ms | index.html:732 | After the close animation: hide the viewer, iframe → `about:blank` | — |
| setInterval | 1000 ms | index.html:822 | Timer pill tick | index.html:815 |
| setInterval | 1000 ms (kiosk only) | index.html:1142 | TV `tick()` clock | index.html:976 |
| In `tick` | ≥45 000 ms | index.html:1113 | Backdrop crossfade | — |
| In `tick` | ≥60 000 ms | index.html:1114 | Board repaint from the cache | — |
| In `tick` | ≥300 000 ms | index.html:1115 | `refreshFeed` (limit 100) | — |
| setTimeout | 2700 ms | index.html:1094 | Drop the old backdrop after the fade | — |
| setTimeout | 20 000 ms | index.html:1101 | Crossfade image-load guard | index.html:1090 |
| clearTimeout | — | index.html:784 | Cancel the toast hide timer | — |
| hub.js setInterval | 30 000 ms | apps/hub.js:342 | Pull while visible. It is created only inside the one-time `wired` block (apps/hub.js:338-365), while `hub.reset()` clears it (apps/hub.js:370) and `enterShell` calls `hub.reset()` on every sign-in (index.html:623). After a second sign-in in the same page load, no code path re-creates it | apps/hub.js:342, 370 |
| hub.js setTimeout | 6000 ms | apps/hub.js:337 | `hub.ready` first-pull race (only when nothing is cached) | — |
| hub.js setTimeout | 250 ms default; 0 / 500 ms; retry 5 s (offline) / 30 s (error) | apps/hub.js:252, 269, 312, 339-340, 362 | `scheduleFlush` | apps/hub.js:252, 284 |
| hub.js setTimeout | 2200 ms default | apps/hub.js:434 | Toast hide | apps/hub.js:434 |
| hub.js setTimeout | 12 000 ms (60 000 for uploads) | apps/hub.js:132 | Request abort | apps/hub.js:138 |
| requestAnimationFrame | — | NOT FOUND IN CODE in index.html. hub.js uses it for the sheen (apps/hub.js:446) | — | — |
| CSS animations | TV fade 2.5 s (131); typing blink 1.2 s infinite (256-258); `#ptr` spin 1 s infinite (76-77); mic pulse 1 s infinite (265-266); viewer-in/out (327-330); tp-in (346-347); hub-fade (69, defined at design.css:592) | index.html lines as listed | — | — |

#### Device APIs
| API | Line |
|---|---|
| Wake Lock: `navigator.wakeLock.request('screen')` on the first `pointerdown`; re-requested on becoming visible only if a lock was held. Applies to every profile kind. `lock.release()` is NOT FOUND IN CODE (`release(`: 0 hits). The iframe is granted `screen-wake-lock` | index.html:1709-1712, 413 |
| Vibrate | index.html:454 |
| AudioContext / webkitAudioContext | index.html:790 |
| speechSynthesis | index.html:1457-1458 |
| Notification permission | index.html:799, 1550, 1561 |
| `serviceWorker.getRegistration` + `showNotification` | index.html:800-801 |
| `serviceWorker.ready`, `pushManager.getSubscription` / `subscribe` | index.html:1551, 1552, 1565 |
| `matchMedia('(display-mode: standalone)')`, `navigator.standalone` | index.html:1531 |
| `hub.voiceSupported` / `hub.voiceInput` (SpeechRecognition, apps/hub.js:415-427) | index.html:1521-1524 |

### 3.7 Tabs, navigation and routing
| Aspect | Behaviour | Lines |
|---|---|---|
| Tabs | `TABS = ['home','apps','chat','me']`; `.tabs` style `--tabs:4;--i:0` | index.html:618, 395 |
| `showTab(t, keepViewer)` | 1. Closes the viewer unless `keepViewer`. 2. Shows the chat form only on chat. 3. Sets `<html data-tab>`. 4. Toggles `.view.on`, `.tab.on` and `aria-current` (`page`/`false`). 5. Sets `--chat-h` on the pill (chat only). 6. Updates the `--i` indicator. 7. `history.replaceState('#'+t)`, skipped when `keepViewer` or when the hash already matches. 8. Renders home/me/grid/chat. 9. Resets `#views` scrollTop to 0 | index.html:634-648 |
| Tab bar click | `buzz()` + `showTab` | index.html:649 |
| Hash on shell entry | Kiosk → home. App id → Apps tab (`keepViewer`) + `openApp`. Tab name → that tab. Otherwise home | index.html:625-628 |
| `hashchange` | App id → `openApp` if not already open. Tab → `showTab` if the viewer is open or the tab differs | index.html:650-654 |
| Opening an app | `history.replaceState('#<id>')` | index.html:726 |
| History API | Only `replaceState` (index.html:642, 726). `pushState` and `popstate` are NOT FOUND IN CODE (0 hits). `location.hash = h` is assigned only for a service-worker "open" message | index.html:1575 |
| In-app back | Viewer "Hub" → `showTab('apps')`. Keypad Back button / Escape → picker. Sheet: Escape, backdrop or `[data-close]`. Escape in the viewer: no handler | index.html:736, 582, 590, 747-754 |
| Hardware/browser Back | No handler. NOT FOUND IN CODE (`popstate`: 0 hits) | — |
| Other entry points | Kid CTA → Apps (1155). Sheet `data-open`/`data-open-tab` (752-753). Home `[data-open]` (1229). Timer pill/chip → `openApp('timer')` (824-825). iframe `hub:open` (765). Switch app sheet (738-742) | index.html lines as listed |
| Deep links from outside | Redirects to the shell: a standalone app with no profile → `../index.html#<appId>` (apps/hub.js:329); `hub.open` outside a frame → `../index.html#<id>` (apps/hub.js:430); auth loss in a standalone app → `../index.html` (apps/hub.js:154). Notification clicks: `index.html<data.url>` (sw.js:64) → `postMessage` to an open client (sw.js:67 → index.html:1575), or `openWindow` (sw.js:68). The timer notification carries `data.url '#timer'` (index.html:801) | as listed |
| Kiosk | Tab bar hidden; entry forced to home | CSS index.html:78; 626 |
| Document title | `registry.title` | index.html:470 |

### 3.8 Shell CSS
| Item | Finding | Lines |
|---|---|---|
| Links design.css | Yes, `apps/design.css` | index.html:17 |
| Uses class `ds` | `<body class="ds">`. Shell rules also target `.ds .stars-card`/`.ds .kids-card` (201) and `.ds .toast` (340-341) | index.html:364 |
| Hex colours inside `<style>` (18-362) | **0**. The regex found no `#[0-9A-Fa-f]{3,8}` in 18-362 | grep of index.html |
| Hex colours elsewhere in index.html | 2 in meta theme-color (8-9), 10 in JS `SWATCHES` (449), 1 in `FALLBACK` (450). SWATCHES are used as inline `style="background:${c}"` at 1398 and 1666. The `#feed` matches at 947, 959, 962 and 1215 are selectors, not colours | index.html lines as listed |
| Other raw colour literals in `<style>` | `rgba()` at index.html:95, 96, 272, 281 (4 in all). Keywords inside `color-mix`: `white` (249), `black` (331) | as listed |
| font-family | Only `var(--font-display)` (35, 55, 71, 85, 143, 145) and an inline `var(--font-mono)` (1645). `font: inherit` at 43, 186, 223, 290, 311, 335, 345. No literal font names | index.html lines as listed |
| Media queries: min-width | 560 (39), 700 (219, 230, 237), 720 (106), 900 (40), 1024 (82, 107, 190, 220, 238, 262, 287, 319, 341, 354, 358), 1200 (136) | index.html lines as listed |
| Media queries: max-width / max-height | `max-width: 719px` (115); `max-height: 1100px` (174) and `1050px` (175), both kiosk only | index.html lines as listed |
| Media queries: hover | `(hover: hover) and (pointer: fine)` at 49, 235, 339, 353 | index.html lines as listed |
| JS media queries | `(prefers-color-scheme: dark)` (1703); `(display-mode: standalone)` (1531) | index.html lines as listed |
| prefers-color-scheme | Not in `<style>`. Only on the meta `media` attributes (8-9) and JS `matchMedia` (1703) | index.html lines as listed |
| prefers-reduced-motion | NOT FOUND IN CODE in index.html (0 hits). The linked design.css has a global rule: animations .01 ms, transitions none (design.css:611-613). hub.js skips the sheen, including the `hub.sheenFrom` definition (apps/hub.js:442) | — |
| State selectors | `:root[data-kind="kid"]` 51, 236-240, 268. `:root[data-kind="kiosk"]` 51, 78-79, 101-103, 123-124, 128-175, 355. `:root[data-scheme="dark"]` 203. `:root[data-tab="chat"]` 357-358 | index.html lines as listed |
| -webkit-tap-highlight-color | NOT FOUND IN CODE in index.html. Set in design.css:302 (the `body` rule, with `touch-action: manipulation` at 303) and design.css:312 (`button`, with `touch-action: manipulation`) | — |
| user-select | NOT FOUND IN CODE in index.html. design.css:355 (`.ds .btn`: `user-select: none; -webkit-user-select: none`) | — |
| overscroll-behavior | `#views { overscroll-behavior: contain; -webkit-overflow-scrolling: touch }` (index.html:66). design.css:304 sets `none` on `body` | index.html:66 |
| :focus-visible | NOT FOUND IN CODE in index.html. design.css:313 sets `:focus { outline: none }` and design.css:314 sets `:focus-visible { box-shadow: var(--focus) }`. The shell removes the chat input's focus ring: `.chat-form .input:focus { box-shadow: none; }` (index.html:264) | — |
| Page scroll model | `body { position: fixed; inset: 0; overflow: hidden; min-height: 100dvh }`. `#views` is the scroller | index.html:21, 66-67 |
| Safe-area insets | `var(--safe-top/right/bottom/left)` at 30, 67, 75-77, 79, 83, 128, 259, 340, 344, 355, 357. The tokens map to `env(safe-area-*)` at design.css:34-37 | index.html lines as listed |
| Widths | `.view` max 880px (68), then `var(--max)` at ≥1024 (84). The 220px sidebar offset is at 83, 262 and 354; the toast is centred with `calc(50% + 110px)` (341) | index.html lines as listed |
| z-index | Shell: `#ptr` 5 (72), `.kiosk-switch` 2 (104), `.tv-scrim` 3 (133), `.chat-form` 19 (259), `#timer-pill` 25 (344), `#viewer` 30 (326). design.css: `.topbar` 20 (552), `.tabbar` 20 (556), `.sheet-backdrop` 50 (579), `.toast` 60 (590) | as listed |
| backdrop-filter removed | `.pcard.skeleton` (50), `.tv-pane` (137) | index.html lines as listed |
| Keyframes defined in the shell | `spin` 77, `blink` 258, `pulse` 266, `viewer-in` 329, `viewer-out` 330, `tp-in` 347 | index.html lines as listed |

#### Control sizes set in the shell CSS
| Selector | Size | Line |
|---|---|---|
| `.pcard` | min-height 156px | index.html:42, 50-51 |
| `.pin-pad .btn` | min-height 64px | index.html:60 |
| `#ptr span` | 40×40 | index.html:73 |
| `.view-title` | min-height 44px | index.html:70 |
| `.kid-cta` | min-height `var(--tap-lg)`; icon 64px | index.html:186, 188 |
| `.tile` | aspect-ratio 1 in a 4/6/8-column grid (kid 2/3/4); icon 48px (kid 88px) | index.html:218-226, 236-240 |
| `.tile.wide` | min-height 112px | index.html:229 |
| `.msg .chips .chip` | min-height 28px | index.html:254 |
| `.chat-form .input` | min-height `var(--tap)` | index.html:263 |
| `.album-item .album-del` | 32×32 | index.html:282 |
| `.theme-swatch` | height 76px | index.html:293 |
| `.swatch` | 44×44 | index.html:307 |
| `.emoji-grid button` | min-height 48px | index.html:311 |
| `#pill` bar | min-height 48px; buttons min 44×44 | index.html:334-335 |
| `#timer-pill` | min-height 44px | index.html:345 |
| `:root[data-kind="kiosk"] .rem-row` | min-height 84px | index.html:124 |

## 4. The hub.js SDK (apps/hub.js)

`apps/hub.js` is 500 lines and 32,428 bytes. It is one IIFE in strict mode (apps/hub.js:22-23, :500) and is precached by the service worker (sw.js:10). Every claim below comes from reading the code. Nothing was run.

### 4.1 Loading

| Item | Detail | Lines |
|---|---|---|
| Script element | `document.currentScript` is captured at load time. No tag that loads hub.js uses `async`, `defer` or `type="module"` (all 10 tags are listed below) | apps/hub.js:24 |
| `data-app` | App id. If missing, it is taken from the URL `/apps/<id>.html`, then falls back to `'hub'` | apps/hub.js:37 |
| `data-scope` | `person` (default), `family` or `both`. `both` becomes `['person','family']` | apps/hub.js:38-39 |
| Other attributes | None read. Only `dataset.app` and `dataset.scope` | apps/hub.js:37-38 |
| Channels | `CH` Map `'app\|scope' → {app, scope}`, seeded from the declared scopes. `hub.use()` adds more | apps/hub.js:41-43, :212-218 |
| Iframe detection | `inFrame = window.parent !== window`. If that access throws, it is treated as `true` | apps/hub.js:34 |
| Shell detection | `appId === 'hub'`. The shell loads with `data-app="hub" data-scope="family"` | index.html:440; apps/hub.js:154, :329 |
| Standalone detection | `!inFrame && appId !== 'hub'` at :154 and :329, used to redirect to `../index.html`. `hub.open` (:430) checks only `!inFrame`, so the top-level shell would also navigate to `../index.html#id`. No caller of `hub.open(` was found in index.html or apps/*.html | apps/hub.js:154, :329, :430 |
| Globals | Only `window.hub`. `HubError` is reachable as `hub.HubError` | apps/hub.js:499, :45, :52 |
| Default API | `https://house-hub-api.catalystfarm1.workers.dev`, overridden by localStorage `hub.api`. Only test scripts write `hub.api` (e.g. scripts/test-apps.mjs:40, scripts/screens-shell.mjs:39). There is no in-app UI for it | apps/hub.js:25, :48 |
| Runs at load (before `ready`) | Tokens read (:49). Channels seeded (:43). Profile read from the cached session (:111). `applyTheme()` (:112). OS-scheme listener (:83). Sheen IIFE (:441-453) | — |

**Pages that load hub.js**

| Page | Tag | data-app | data-scope | Extra `hub.use` | `ready` call |
|---|---|---|---|---|---|
| Shell | index.html:440 | hub | family | reminders/family, f260/person, leftovers/family, prayer/person, hub/person, timer/person, dollywood-live/family, kidverse/both (index.html:458-459); prayer/family on the TV (index.html:1042) | index.html:623 (after `hub.reset()`) |
| F260 | apps/f260.html:777 | f260 | person | kidverse/family (apps/f260.html:779) | apps/f260.html:780 |
| Kid Verse | apps/kidverse.html:180 | kidverse | both | prayer/family **only when the profile is a kid** (:512); f260/person **only when the profile is an adult** (:513) | apps/kidverse.html:514, :671 |
| Larder | apps/leftovers.html:133 | leftovers | family | — | apps/leftovers.html:172 |
| Prayer | apps/prayer.html:573 | prayer | both | — | apps/prayer.html:1753, gated by `if(USE_LOCAL_STORAGE)` (const `true` at apps/prayer.html:583) |
| Tally | apps/tally.html:142 | tally | person | — | apps/tally.html:145 |
| Timer | apps/timer.html:73 | timer | person | — | apps/timer.html:76 |
| Verses | apps/verses.html:149 | verses | person | f260/person **and kidverse/family** (apps/verses.html:197) | apps/verses.html:362 |
| Build guide | apps/dollywood.html:684 | dollywood | person | — | `ready({optional:true})` apps/dollywood.html:1105 (:1611 is inside `liveInit`, which runs only in the park-map flavour, so it never runs here); returns early if `!hub.profile` (:1106) |
| Park map | apps/dollywood-live.html:684 | dollywood-live | both | — | `ready({optional:true})` apps/dollywood-live.html:1105, :1481; returns early if `!hub.profile` (:1106) |

docs/design.html does not load hub.js. It copies `applyTheme` in its own code (docs/design.html:311).

**postMessage protocol**

| Direction | `source` | Types | Lines |
|---|---|---|---|
| hub.js → parent | `'hub'`, targetOrigin `location.origin`, only when `inFrame` | `hub:theme` (:92, :103), `hub:sync` (:123), `hub:reauth` (:152, :177, :328), `hub:open` (:430) | apps/hub.js:35 |
| Shell receives | origin and `source === 'hub'` checked | `hub:sync` → `setDot`; `hub:open` → `openApp`; `hub:reauth` → close viewer, then picker if `hub.device` else pairing; `hub:theme` → `hub.setTheme` + `syncThemeColor` | index.html:761-768 |
| hub.js receives | origin and `source === 'hubshell'` checked | `hub:pull` → `hub.pull()`; `hub:theme` → `applyTheme()` | apps/hub.js:343-347 |
| Shell → iframe | `'hubshell'` | `hub:theme` only, with no theme field (the iframe re-reads localStorage) | index.html:1283 |
| `hub:pull` sender | NOT FOUND IN CODE. Searched "hub:pull" in *.html, *.js and *.mjs: the only hit is the listener at apps/hub.js:345 | — | — |

### 4.2 Public API surface

| Member | Kind | Signature | Line | Behaviour |
|---|---|---|---|---|
| `appId` | property | string | apps/hub.js:48 | App id resolved in 4.1 |
| `api` | property | string | apps/hub.js:48 | API base URL (localStorage `hub.api` or the default) |
| `device` | property | `{id, token, name}` or null | apps/hub.js:49, :161 | Read from localStorage at load. Set by `pair`. Cleared on `device_not_paired` (:148) |
| `session` | property | `{token, profile}` or null | apps/hub.js:49, :106 | Read from localStorage at load. Replaced by `setSession`. `session.profile` is the server row, which keeps `is_guest`, `expires_at`, `created_by` and `sort_order` (worker/src/auth.js:64-70) |
| `profile` | property | `{id, name, kind, isAdmin, color, emoji, hasPin, photo}` or null | apps/hub.js:50, :61, :107, :111 | `publicProfile()` of the session profile. Has 8 fields (CLAUDE.md and the header comment at :7 list 6). Drops `is_guest`. Guests are `kind: 'adult'` (worker/src/index.js:170) |
| `skew` | property | number (ms) | apps/hub.js:50, :290 | `server now − Date.now()`, set on every channel pull |
| `sync` | property | `{state, pending, lastError, lastPull}` | apps/hub.js:51 | `state` starts as `'offline'`. `pending` is recomputed on every `setSync` (:120) |
| `HubError` | constant (class) | `new HubError(status, error, message)` | apps/hub.js:45, :52 | Error with `.status` and `.error` code |
| `THEMES` | constant | array of `{id, name, scheme, blurb}` | apps/hub.js:64-71 | system, hearth, parchment, frost, midnight, forest |
| `setTheme` | method | `(t)` | apps/hub.js:88-93 | Normalises t, writes localStorage, applies, writes person pref `hub/theme` when allowed, posts `hub:theme` |
| `theme` | method | `() → id` | apps/hub.js:94 | Normalised localStorage `hub.theme`, default `'system'` |
| `scheme` | method | `() → 'light'\|'dark'` | apps/hub.js:95 | `<html data-scheme>`, else OS preference |
| `setSession` | method | `(s)` | apps/hub.js:105-110 | Stores the session, rebuilds `profile`, records `hub.lastProfile`, re-applies theme, kind and accent |
| `isKid` | property (getter) | boolean | apps/hub.js:113 | `profile.kind === 'kid'` |
| `isKiosk` | property (getter) | boolean | apps/hub.js:114 | `profile.kind === 'kiosk'` |
| `canWrite` | property (getter) | boolean | apps/hub.js:115 | Profile exists and kind is not `kiosk` |
| `onSync` | event | `(cb) → unsubscribe` | apps/hub.js:125 | Calls cb at once with a copy of `sync` (not wrapped in `try`), then on every `setSync` |
| `onAuthLoss` | event | `(cb) → unsubscribe` | apps/hub.js:126 | cb(errorCode) when `handleAuthLoss` fires (:153) |
| `request` | method | `(path, {method='GET', body, profile=true, device=true, timeout=12000}) → data` | apps/hub.js:128-146 | fetch with JSON, tokens, `cache:'no-store'` and abort timeout. Returns parsed JSON (or null). Throws `HubError` |
| `pair` | method | `(code, name) → device` | apps/hub.js:159-163 | `POST /api/pair`, saves `hub.device` |
| `profiles` | method | `() → Promise<profile[]>` | apps/hub.js:164 | `GET /api/profiles`, caches the server rows in `hub.profiles` |
| `people` | method | `() → profile[]` | apps/hub.js:166 | Reads localStorage `hub.profiles` on every call (so it sees the other window's refresh), or `[]` |
| `login` | method | `(profileId, pin) → profile` | apps/hub.js:167-170 | `POST /api/login`, then `setSession` |
| `createPin` | method | `(profileId, pin) → profile` | apps/hub.js:171-174 | `POST /api/profiles/:id/pin`, then `setSession` |
| `signOut` | method | `async ()` | apps/hub.js:175-178 | Best-effort `POST /api/logout`, `setSession(null)`, posts `hub:reauth` `'signed_out'` |
| `lastProfile` | method | `() → id\|null` | apps/hub.js:179 | localStorage `hub.lastProfile` |
| `use` | method | `(app, scopes='person') → hub` (chainable) | apps/hub.js:212-218 | Adds channels. Loads their cache at once if `ready()` has been called. Does not pull them until the next pull |
| `get` | method | `(key, {app, scope, default})` | apps/hub.js:220-223 | Cached value. A tombstone (null) or missing key returns `default` |
| `has` | method | `(key, opts) → boolean` | apps/hub.js:224 | True when the key exists and is not a tombstone |
| `list` | method | `(prefix='', opts) → [{key, value, updated_at}]` | apps/hub.js:225-230 | Live rows by prefix. Tombstones excluded. Unsorted |
| `set` | method | `(key, value, opts) → value` | apps/hub.js:231-243 | Validates, stamps, applies locally, queues, schedules a flush |
| `remove` | method | `(key, opts)` | apps/hub.js:244 | `set(key, null)`, i.e. a tombstone |
| `onChange` | event | `(cb) → unsubscribe` | apps/hub.js:245 | cb `{app, scope, key, value, updated_at, remote:true}` (:209), or `{app, scope, key:null, value:null, updated_at:0, remote:true, bulk:true}` from a storage event (:360). Never fires for this window's own `set` |
| `kioskNudge` | method | `()` | apps/hub.js:247-249 | Toast "This screen only looks — sign in on a phone…" for 2600 ms, at most once per 2500 ms |
| `flush` | method | `() → Promise` | apps/hub.js:284 | Cancels the pending timer and flushes now |
| `pull` | method | `() → Promise<boolean>` | apps/hub.js:304-321 | Single-flight pull of every channel. Resolves `true` if anything changed |
| `ready` | method | `({optional=false}) → Promise<hub>` | apps/hub.js:324-369 | Memoised. Loads caches, adopts theme, first pull, wires listeners once |
| `reset` | method | `()` | apps/hub.js:370 | Clears the ready promise, in-memory stores and queues, and the pull interval. Does not reset `wired`, `flushTimer` or `pulling` |
| `activity` | method | `(text, app=appId)` | apps/hub.js:373-377 | Queues a feed line (localStorage) and drains it. Does nothing if `!canWrite` or `!text` |
| `activityFeed` | method | `(limit=30) → Promise<rows>` | apps/hub.js:387 | `GET /api/activity?limit=` |
| `migrate` | method | `(entries) → movedKeys[]` | apps/hub.js:393-412 | One-time copy from legacy localStorage keys (see 4.7) |
| `voiceInput` | method | `(onResult, {lang='en-US', onEnd, onError}) → {stop, abort}\|null` | apps/hub.js:415-426 | Web Speech, single final result |
| `voiceSupported` | property | boolean | apps/hub.js:427 | `SpeechRecognition` or `webkitSpeechRecognition` present |
| `open` | method | `(id)` | apps/hub.js:430 | Posts `hub:open`. When not in a frame: navigates to `../index.html#id` |
| `toast` | method | `(msg, ms=2200)` | apps/hub.js:431-435 | Creates `.ds > #hub-toast.toast[role=status]` on first use |
| `escape` | method | `(s) → string` | apps/hub.js:436 | HTML-escapes `& < > " '` |
| `uid` | method | `() → string` | apps/hub.js:437 | Base-36 time plus up to 5 random characters |
| `sheenFrom` | method | `(el)` | apps/hub.js:447 | Makes `el` the scroll source for `--sheen-x`. Only assigned when reduced motion is off (:442) |
| `photoUrl` | method | `(p, size='sm') → url\|null` | apps/hub.js:457 | Accepts `p.photo` as a string or `{sm, lg}`, or `p` itself when it has `sm`. Relative paths get the API base prepended |
| `avatarHtml` | method | `(p, cls='', size='sm') → html` | apps/hub.js:459-462 | `<span class="avatar" style="--tint:…">` holding a lazy `<img alt="">` or the emoji. Fallback tint `#8A6A4B`, fallback glyph `·` |
| `uploadPhoto` | method | `async (file, profileId=self)` | apps/hub.js:480-485 | Makes a 256 px and a 1024 px JPEG, `PUT …/photo`, merges into the session if it is your own profile, refreshes profiles |
| `removePhoto` | method | `async (profileId=self)` | apps/hub.js:486-491 | `DELETE …/photo`, merges into the session if it is your own profile, refreshes profiles |
| `addAlbumPhoto` | method | `async (file, caption='')` | apps/hub.js:493-496 | `POST /api/album`, then `pull()` |
| `removeAlbumPhoto` | method | `async (id)` | apps/hub.js:497 | `DELETE /api/album/:id`, then `pull()` |

The index.html grep also hits `hub.feed`, `hub.registry` and `hub.cache`. These are localStorage key strings, not SDK members (index.html:466, :889, :922).

Internal, not exported: `LS` :26-31, `lsGet` :32, `lsSet` :33, `tell` :35, `chKey` :42, state `listeners`/`store`/`queue`/timers/flags :54-57, `publicProfile` :60, `themeId` :72, `prefersDark` :73, `applyTheme` :74, `PREFS` :86, `hasPrefs` :87, `adoptTheme` :97, `setSync` :118, `handleAuthLoss` :147, `pid` :182, `loadScope` :183, `refreshScope` :190, `saveStore`/`saveQueue` :196-197, `scopeOf` :198, `emit` :206, `scheduleFlush` :252, `flush` :253, `pullScope` :286, `drainActivity` :378, `sheen` IIFE :441, `squareJpeg` :464, `twoSizes` :474.

### 4.3 Sync engine

#### 4.3.1 localStorage keys

| Key | Value | Written | Read |
|---|---|---|---|
| `hub.device` | `{id, token, name}` | apps/hub.js:161; cleared :148 | :49 |
| `hub.session` | `{token, profile}` | :106 | :49 |
| `hub.lastProfile` | profile id | :108 | :179 |
| `hub.api` | URL string | tests only | :48 |
| `hub.theme` | theme id. Removed when `system` | :90, :103 | :76, :94; storage event :352 |
| `hub.migrated` | `{"<app>.<scope>": ms}` | :409-410 | :394 |
| `hub.activityQueue` | `[{app_id, text, at}]`, last 50 kept | :375, :385 | :375, :379 |
| `hub.profiles` | server profile rows | :164; also index.html:525 | :166; index.html:527 |
| `hub.cache.<app>.<scope>[.<pid>]` | `{items: {key: {v, t}}, since}` | :196 | :185, :192, :358; also read directly by index.html:889 and apps/kidverse.html:467 |
| `hub.queue.<app>.<scope>[.<pid>]` | `{key: {value, updated_at}}` | :197 | :186, :192, :362 |
| `hub.registry` (shell only) | apps.json copy | index.html:466 | index.html:468 |
| `hub.feed` (shell only) | last 30 activity rows | index.html:927, :1108 | index.html:922 |

The key pattern is defined at apps/hub.js:29-30. The `.<pid>` suffix is added only for person scope. `pid` is `'nobody'` when no profile is signed in (:182). The only code that deletes these keys wholesale is the shell's "Forget this device" (every `hub.*` key, then reload; index.html:1285-1288).

#### 4.3.2 Write path (`hub.set`, apps/hub.js:231-243)
1. `scopeOf(opts)` resolves the channel and throws if it is not declared (:198-205). This runs first (:232), before any profile check.
2. No profile → `HubError(401,'profile_required')` (:233). Kiosk → `kioskNudge()` and `HubError(403,'read_only')` (:234). Bad key → `Error` (:235).
3. Timestamp: `t = max(Date.now()+skew, previous t + 1)`, so it always increases per key (:236). `undefined` becomes `null` (:237).
4. The cache item `{v, t}` is written and saved (:238). The queue entry for the key is overwritten, so only the latest value per key is kept (:239).
5. `setSync` → `offline` if `navigator.onLine === false`, else `pending` (:240). Then `scheduleFlush()` with a 250 ms debounce (:241, :252).

#### 4.3.3 Flush (apps/hub.js:252-284)

| Aspect | Detail | Lines |
|---|---|---|
| Guard | Skips if already flushing, if there is no `hub.session`, or if `navigator.onLine === false` | :254 |
| Batching | Channels are flushed one after another. Each sends its whole queue snapshot in one `POST /api/data/<app>/batch?scope=`. No client-side chunking. The server rejects more than 200 items with 400 `bad_batch` (worker/src/index.js:314) | :257-264 |
| Ack | After `refreshScope`, a queue entry is deleted only if its `updated_at` still matches the snapshot | :272-274 |
| Server newer or equal | If `applied:false` and the local `t` is not strictly greater, the server row is adopted and `emit` fires (so an equal `t` also emits) | :276; server: worker/src/data.js:60-64 |
| Success | `setSync({state:'synced'})`. If new items were queued meanwhile, `scheduleFlush()` again | :280-281 |
| Triggers | `hub.set` (250 ms, :241); leftovers after a flush (250 ms, :281); after a pull with pending items (0 ms, :312); tab visible (0 ms, :339); `online` (0 ms, :340); queue key changed in another window (500 ms, :362); retry timers (:269); manual `hub.flush()` (:284) from index.html:674, :733, :1284 | — |

#### 4.3.4 Pull (apps/hub.js:286-321)

| Aspect | Detail | Lines |
|---|---|---|
| Single flight | Concurrent calls share the in-flight `pulling` promise | :305 |
| Guards | Returns `false` with no device. Person channels are skipped with no session. No `navigator.onLine` check | :307, :310 |
| Request | `GET /api/data/<app>?scope=&since=<store.since>`, incremental. The server filters on `synced_at > since` (worker/src/data.js:22) and takes `now = Date.now() - 1` before the query (worker/src/index.js:292-293) | :289 |
| Clock | `hub.skew = res.now − Date.now()` | :290 |
| Cursor | `store.since = res.now` | :300 |
| Triggers | `ready()` (:336); tab visible (:339); `online` (:340); every **30000 ms** while `!document.hidden` (:342); `hub:pull` message (:345, no sender found); after an album add or remove (:495, :497); shell calls at index.html:674, :733, :1284 | — |
| First open | If no channel has ever been pulled (`since > 0` false everywhere), `ready` waits up to 6000 ms for the first pull. Otherwise it resolves from cache | :334, :337 |
| Afterwards | `setSync` → `pending` or `synced` with `lastPull = Date.now()`. Flushes if anything is pending, then runs `adoptTheme()` | :311-313 |

#### 4.3.5 Reconcile rule (last write wins)

| Case | Rule | Lines |
|---|---|---|
| Remote row during pull | Skipped if the local queued write has `updated_at ≥ remote`, or the cached `t ≥ remote` (ties keep local). Otherwise adopted and `emit` fires | apps/hub.js:293-299 |
| Batch result `applied:false` | Server row adopted unless the cached `t` is strictly newer (ties adopt the server row, the opposite of the pull rule) | :276 |
| Tombstones | `value null` is stored as `{v:null}`. Hidden by `get`, `has` and `list` (:222, :224, :228). Kept in the localStorage cache indefinitely: no purge in hub.js (searched "delete store"; `reset` at :370 only drops the in-memory copies). Only "Forget this device" clears them (index.html:1287) | — |
| Server clamp | `updated_at` is capped at server now + 5 min | worker/src/data.js:41 |
| Theme row | `emit` for `hub/person/theme` runs `adoptTheme()` | :208 |

#### 4.3.6 `sync.state` transitions

| Where | Trigger | State |
|---|---|---|
| apps/hub.js:51 | Script load | `offline` |
| :121 | Any `setSync` while `pending > 0` and state is `synced` | `pending` |
| :151 | Auth loss (3 error codes, see 4.4) | `error` |
| :240 | `hub.set` | `offline` if `navigator.onLine === false`, else `pending` |
| :266 | Flush gets 403 `read_only` | `error` (overwritten by :280 if the loop finishes) |
| :267 | Other flush failure | `error` if an HTTP status came back, `offline` if not |
| :280 | Flush loop finished | `synced` (`lastError` null), or `pending` via :121 if entries remain. Also reached when every queue was empty and no request was made, so a 0 ms flush (:339, :340) can replace an `error`/`offline` left by a failed pull |
| :311 | Pull succeeded | `pending` if any queue is non-empty, else `synced` |
| :316 | Pull failed | `error` or `offline` |
| :335 | `ready()` while offline | `offline` |
| :340 / :341 | `online` / `offline` events | `pending` (even with nothing queued) / `offline` |
| :362 | Queue key changed in another window | Pending count recomputed; `synced` flips to `pending` via :121 if the count is non-zero |

Shell display: the `#syncdot` class is `dot-<state>` (index.html:769). It is fed by the shell's own `onSync` (index.html:770) and by the iframe's `hub:sync` messages (index.html:764).

#### 4.3.7 Retry and backoff

| Failure | Queue | Next attempt | Lines |
|---|---|---|---|
| Flush network error or timeout (status 0) | Kept | `scheduleFlush(5000)` | apps/hub.js:269 |
| Flush 5xx | Kept | `scheduleFlush(30000)` | :269 |
| Flush 401 | Kept (excluded from the drop) | 30000 ms. For the 3 auth-loss codes `flush` then returns at :254 because the session is cleared. Any other 401 code is retried every 30 s with no limit | :268-269 |
| Flush 403 `read_only` | That channel's queue cleared | Continues with the next channel | :266 |
| Flush other 4xx (e.g. 400 `bad_batch`/`bad_key`/`bad_scope`, 413 `value_too_large` from worker/src/data.js:43) | **Whole channel queue cleared** | Loop returns, so later channels wait for the next trigger | :268, :270 |
| Local copy after a drop (both rows above) | The cache (`store`) is not rolled back: the dropped values stay visible on this device and never reach the server | :266, :268 (queue only) |
| Pull failure | — | No scheduled retry; the next trigger, including the 30 s interval | :315-317, :342 |
| Activity 4xx other than 429 | Item dropped | — | :382 |
| Activity 429, 5xx or network | Items kept, loop stops | Only on the next `hub.activity()` call (its only caller is :376) | :380-382 |

Delays are fixed. There is no exponential backoff (:269).

#### 4.3.8 Two copies (shell plus app iframe)

| Mechanism | Detail | Lines |
|---|---|---|
| Shared storage | Both copies read and write the same `hub.cache.*` and `hub.queue.*` keys | apps/hub.js:29-30 |
| Re-read after await | `refreshScope(ch)` reloads cache and queue from localStorage after the network await, in both flush and pull | :190-195, :272, :291 |
| `storage` listener | Wired once in `ready`. Keys without the `hub.` prefix are ignored. `hub.theme` → `applyTheme`. A cache key it holds → reload the store and fire a bulk `onChange` if the signature (keys, `t`, `v`) changed. A queue key it holds → reload the queue, recompute pending, `scheduleFlush(500)` | :350-364 |
| Flush lock | `flushing` is per window (:57, :254). No cross-window lock (searched "locks" and "BroadcastChannel" in hub.js: NOT FOUND IN CODE). A duplicate POST of the same `updated_at` comes back `applied:false` from the server (worker/src/data.js:60-64), and the tie rule at :276 then re-adopts it and fires `emit` | — |
| Tokens | `hub.device` and `hub.session` are not re-read on storage events (:350-364 handle theme, cache and queue only). After an iframe clears them (:148, :106), the shell keeps its in-memory copies; index.html:766 then tests the shell's stale `hub.device` | — |

#### 4.3.9 401, 403 and read_only
See 4.4 for 401. Client-side kiosk block: apps/hub.js:234. Server-side `read_only` comes from worker/src/auth.js:110 and is handled by flush at apps/hub.js:266.

### 4.4 Auth

| Item | Detail | Lines |
|---|---|---|
| Token source | `localStorage` `hub.device` and `hub.session`, read once at script load | apps/hub.js:49 |
| Headers | `Content-Type: application/json`. `X-Device-Token: device.token` when `device` is true and a device exists. `X-Profile-Token: session.token` when `profile` is true and a session exists | :129-131 |
| Token-less calls | `pair` (no device, no profile). `profiles`, `login`, `createPin`, `activityFeed` (no profile token) | :160, :164, :168, :172, :387 |
| Pull scope rule | `profile: scope === 'person' \|\| !!hub.session` | :289 |
| Any 401 | Goes to `handleAuthLoss(err)` | :142 |
| `device_not_paired` | Clears `hub.device` and its localStorage key | :148 |
| `device_not_paired`, `profile_session_invalid`, `profile_required` | `setSession(null)` (clears session, profile, `data-kind`, `--accent`), sync `error`, posts `hub:reauth`, runs `onAuthLoss` callbacks. Standalone app → `location.replace('../index.html')` | :149-155 |
| Other 401s (`wrong_pin` worker/src/index.js:244, `bad_pairing_code` worker/src/index.js:150) | Not matched at :149, so the session is kept | — |
| Session expiry | Server TTL is 365 days (worker/src/auth.js:6, :124). An expired, foreign-device or ended-guest session returns 401 `profile_session_invalid` (worker/src/auth.js:91-97). The client has no expiry check of its own (searched "expires" in hub.js: NOT FOUND IN CODE) and reacts only to the 401 | — |
| Queue after auth loss | Stays in localStorage under the old pid's key (:30). `flush` does nothing without a session (:254) | — |
| Shell reaction | `onAuthLoss` → close the viewer, then the picker if a device exists, else pairing (index.html:771). The same happens for iframe `hub:reauth` messages (index.html:766) | — |
| `ready()` with no profile | Posts `hub:reauth` `no_profile`. Standalone app → `location.replace('../index.html#<appId>')` and never resolves. In an iframe → never resolves. Top-level shell (`appId 'hub'`) → carries on and loads caches. Skipped with `{optional:true}` | apps/hub.js:327-331 |
| Shell boot | No `hub.device` → pairing. No `hub.session` → picker. Otherwise `enterShell` | index.html:1704-1706 |
| Switch profile | `#switch` → `closeViewer`, `hub.signOut()`, picker (index.html:1282); a new login calls `enterShell` without a reload (index.html:600) | — |
| Forget device | Removes every `hub.*` localStorage key and reloads. No server call (the device stays paired server-side) | index.html:1285-1288 |
| Bypass | Chat streams through a raw `fetch` that sets both headers by hand, so a 401 there does not reach `handleAuthLoss` | index.html:1502 |

### 4.5 Theme, accent and scheme

| Output | Set by | Rule | Lines |
|---|---|---|---|
| `<html data-theme>` | `applyTheme` | Removed for `system` **and** `hearth`, otherwise the theme id | apps/hub.js:77 |
| `<html data-scheme>` | `applyTheme` | The theme's `scheme` (`light`/`dark`). For `system`, the OS `prefers-color-scheme` | apps/hub.js:79, :65-70, :73 |
| `<html data-kind>` | `applyTheme` | `profile.kind`, removed with no profile. CSS scales in design.css:280 (kid) and :286 (kiosk) | apps/hub.js:80-81 |
| `--accent` | `applyTheme` | Inline on `<html>` = `profile.color`, removed with no profile. The CSS default is `var(--mocha)` (design.css:86). `-soft`, `-tint`, `-deep`, `-strong`, `-glow` and `--on-accent` are derived in CSS (design.css:87-92 and each theme block) | apps/hub.js:80-81 |
| `--glass-pickup` | Not set by hub.js (searched "glass-pickup" in hub.js: NOT FOUND IN CODE) | CSS token: design.css:66 (root/Hearth), :132 (Parchment), :152 (Frost), :172 (Midnight), :193 (System under OS dark), :214 (Forest); `.tp` preview copies at :234 and :273. Mixed with `--accent` at design.css:392 | — |
| `theme-color` meta | Not set by hub.js (searched "theme-color" in hub.js: NOT FOUND IN CODE) | The shell has two static metas (index.html:8-9). `syncThemeColor` copies the computed `--bg` into both (index.html:656-658). Called from index.html:624, :767, :1283, :1702, and on OS scheme change (:1703). Prayer has its own meta (apps/prayer.html:9, :1534). The Dollywood exports have none (grep count 0) | — |
| `--sheen-x` | Sheen IIFE | `round(20 + scrollProgress×50 + tilt)%`, throttled by rAF. The scroll source is `hub.sheenFrom(el)` or the root scroller. Tilt = `gamma/3` clamped to ±15, only where `DeviceOrientationEvent.requestPermission` is not a function. Passive listeners | apps/hub.js:441-453 |

| Rule | Detail | Lines |
|---|---|---|
| Aliases | `light` → `hearth`, `dark` → `midnight`, unknown → `system` | apps/hub.js:72 |
| System "day/night" | Follows the OS appearance, not the clock (searched "getHours" in hub.js: NOT FOUND IN CODE), although the `THEMES` blurb and comment say "Hearth by day, Midnight at night" (:63, :65). CSS applies dark tokens to `:root:not([data-theme])` under `prefers-color-scheme: dark` | apps/hub.js:73, :79; design.css:176-197 |
| Explicit Hearth | Also leaves no `data-theme` (apps/hub.js:77), so under OS dark it gets the design.css:176-177 dark tokens while `data-scheme` is set to `light` (apps/hub.js:66, :79) | — |
| Re-apply triggers | Script load (:112), OS scheme change (:83), `setSession` (:109), `setTheme` (:90), `adoptTheme` (:103), storage `hub.theme` (:352), `hubshell` `hub:theme` (:346) | — |
| Person preference | `setTheme` writes `app_data(person, hub, theme)` only when channel `hub\|person` is declared and loaded, `canWrite`, and the value changed (:87, :91). Only the shell declares it (index.html:458), so an iframe's `setTheme` writes localStorage and posts `hub:theme`, and the shell then re-runs `hub.setTheme` (index.html:767) | — |
| Adopt from server | `adoptTheme`: only where `hub\|person` is declared (so only the shell), not for the kiosk. The server value wins. If none is set and the channel has been pulled before, `system` is used. Called at `ready` (:333), after a pull (:313), and on emit of the theme key (:208) | apps/hub.js:97-104 |
| Shell theme-color after adopt | `adoptTheme`'s `tell()` does nothing outside a frame (:35, :103). No `syncThemeColor` call is tied to a theme change that arrives by pull: the callers are listed above, and the shell's `onChange` at index.html:1236-1241 does not call it. An open iframe follows only through the `hub.theme` storage event (:352) | — |
| Reduced motion | Checked once at load with `matchMedia('(prefers-reduced-motion: reduce)')`. If it matches, the sheen IIFE returns before any listener and before `hub.sheenFrom` is assigned. There is no change listener. The CSS side is design.css:611-613 (animations and transitions only) | apps/hub.js:442, :447 |

### 4.6 API endpoints called

| Method | Path | Tokens | Timeout | hub.js line | Worker route |
|---|---|---|---|---|---|
| POST | `/api/pair` | none | 12 s | apps/hub.js:160 | worker/src/index.js:142 |
| GET | `/api/profiles` | device | 12 s | :164 | worker/src/index.js:161 |
| POST | `/api/login` | device | 12 s | :168 | worker/src/index.js:231 |
| POST | `/api/profiles/:id/pin` | device | 12 s | :172 | worker/src/index.js:252 |
| POST | `/api/logout` | device + profile | 12 s | :176 | worker/src/index.js:272 |
| POST | `/api/data/:app/batch?scope=` | device + profile | 12 s | :264 | worker/src/index.js:310 |
| GET | `/api/data/:app?scope=&since=` | device (+ profile) | 12 s | :289 | worker/src/index.js:286 |
| POST | `/api/activity` | device + profile | 12 s | :381 | worker/src/index.js:393 |
| GET | `/api/activity?limit=` | device | 12 s | :387 | worker/src/index.js:321 |
| PUT | `/api/profiles/:id/photo` | device + profile | 60 s | :481 | worker/src/index.js:339 |
| DELETE | `/api/profiles/:id/photo` | device + profile | 12 s | :487 | worker/src/index.js:352 |
| POST | `/api/album` | device + profile | 60 s | :494 | worker/src/index.js:361 |
| DELETE | `/api/album/:id` | device + profile | 12 s | :497 | worker/src/index.js:373 |
| GET | `/api/media/photos/…` (from the profile's `photo` paths, worker/src/auth.js:69) | none (`<img src>`) | — | :457, :461 | — |

Paths called through the generic `hub.request` by pages:
- index.html: `/api/profiles` POST (:1418), `/api/chat/history` (:1470), `/api/push/test` (:1546), `/api/push/subscribe` DELETE and POST (:1559, :1566), `/api/push/config` (:1563), `/api/profiles` and `/api/admin/usage` (:1583), `/api/admin/profiles/:id/reset-pin` (:1621), `/api/admin/profiles/:id` DELETE and PUT (:1628, :1683), `/api/admin/profiles/:id/purge` (:1634), `/api/admin/devices/:id` DELETE (:1639), `/api/admin/pairing-code/rotate` (:1644, :1654).
- Dollywood apps: `/api/dollywood/rally` POST (apps/dollywood.html:1719, apps/dollywood-live.html:1589). Both lines are the body of `rally()`, which nothing calls (see 9c).
- Raw `fetch` to `/api/chat`: index.html:1502.

### 4.7 Errors and edge cases handled

| Case | Handling | Lines |
|---|---|---|
| localStorage read | `try`. A parse or access failure returns the default | apps/hub.js:32 |
| localStorage write, quota | `try` with an empty `catch`: failures (quota, private mode) are silent. No quota detection (searched "quota" in hub.js: NOT FOUND IN CODE). The in-memory store and queue are still updated | :33, :238-239 |
| Parent frame access | `try`. Throwing means `inFrame = true`. postMessage is wrapped in `try` | :34-35 |
| Key validation | `/^[A-Za-z0-9_.:\-\/]{1,200}$/` in `set`/`remove` only, throwing a plain `Error`. `get`, `has` and `list` are not validated. The server regex is identical (worker/src/data.js:5, :12) | :235 |
| Value | `undefined` → `null`. No client size check. The server caps the JSON string length at 900 × 1024 and returns 413, which clears the whole channel queue (worker/src/data.js:4, :43; apps/hub.js:268) | :237 |
| Undeclared channel | `Error("hub: scope '…' not declared…")`, also from `get`/`has`/`list` | :202 |
| No profile on write | `HubError(401,'profile_required')` | :233 |
| Kiosk write | `kioskNudge()` + `HubError(403,'read_only')` | :234, :248 |
| Offline | `navigator.onLine === false` checked in `set`, `flush`, `ready` and `drainActivity`. `online` and `offline` listeners | :240, :254, :335, :380, :340-341 |
| Network or timeout | `HubError(0,'network')`, message "The house server took too long." (abort) or "No connection." | :137 |
| Non-JSON response | Tolerated (`data = null`), error code `http_<status>` | :139, :141 |
| Listener exceptions | Each callback wrapped in `try`/`console.error` (except the immediate `onSync` call at :125) | :122, :153, :209, :360 |
| Flush sweep | The first failing channel ends the sweep; later channels wait for the next trigger | :270 |
| 403 `read_only` then success | `error` at :266 is overwritten by `synced` at :280 if the loop finishes | :266, :280 |
| Reset / ready interval | `hub.reset()` clears `pullTimer` (:370). The 30 s `setInterval` is only created inside `if (!wired)` (:338, :342), and `wired` is never reset. The shell runs `hub.reset(); hub.ready()` on every `enterShell` (index.html:623), including after a profile switch without reload (index.html:1282, :600) | — |
| Reduced motion vs `sheenFrom` | `hub.sheenFrom` is never assigned under reduced motion (:442 returns before :447). index.html:662 calls `hub.sheenFrom(views)` with no guard, at the top level of the shell's async IIFE (index.html:442), before boot (index.html:1701-1706) | — |
| Profile and data shown at page start | `sync.state` is `offline` until the first pull (:51). The shell's `onSync` paints the dot at once (index.html:770) | — |
| Activity queue | Capped at the last 50, text sliced to 200 characters. `at` is stored but not sent (only `app_id` and `text` go out). Drained only from `hub.activity()`. `drainActivity` has no single-flight guard: two quick calls both read the queue head and can POST it twice | :375, :381, :376, :378-386 |
| Migration | Runs once per device per `<app>.<scope>` (`hub.migrated`). Needs `canWrite`. Person scope needs `profile.kind === 'adult'`; guests are `kind 'adult'` (worker/src/index.js:170) and `publicProfile` drops `is_guest`, so a guest passes this check. The legacy read is wrapped in `try`. Parse failure → the raw string is used. `null` skipped. Only keys that are still empty (`!hub.has`) are written | :393-412, :61 |
| Voice | Returns `null` when unsupported, when the constructor throws, or when `start` throws (`onError('start_failed')`). `stop` and `abort` are wrapped in `try` | :417, :419, :424-425 |
| Photos | `createImageBitmap` with `imageOrientation:'from-image'`, falling back to plain. Large image: JPEG quality from .82 down by .1 while the decoded size is over 400 KB and quality is above .5. Small image: quality .85. 60 s timeout | :465, :475-477, :481, :494 |
| Callers of `ready({optional:true})` | `pid()` is `'nobody'`, so caches go under `…person.nobody`. Writes throw `profile_required` | :182, :233 |

## 5. Design system — apps/design.css

`apps/design.css` has 617 lines and 48,412 bytes, with CRLF line endings. It has no `@font-face`, no `@import` and no network URL. The only `url(` is an inline data-URI at apps/design.css:449; its `http://www.w3.org/2000/svg` is an SVG namespace, not a fetch.

### 5.1 Structure

| Block | Lines |
|---|---|
| Header comment: usage, direction, `.ds` scoping rule | apps/design.css:1-12 |
| `:root` base tokens (these are the Hearth defaults) | apps/design.css:14-110 |
| ↳ `color-scheme: light dark` | apps/design.css:15 |
| ↳ type | apps/design.css:17-26 |
| ↳ spacing, radii, targets, max widths, safe-area | apps/design.css:28-37 |
| ↳ light neutrals | apps/design.css:39-52 |
| ↳ glass and liquid-glass v3 | apps/design.css:54-67 |
| ↳ `--wash` | apps/design.css:69-71 |
| ↳ hue families | apps/design.css:73-78 |
| ↳ semantic aliases | apps/design.css:80-83 |
| ↳ accent | apps/design.css:85-93 |
| ↳ elevation, focus | apps/design.css:95-102 |
| ↳ motion | apps/design.css:104-109 |
| Themes comment | apps/design.css:112-115 |
| Parchment (+ `.tp` swatch) | apps/design.css:116-135 |
| Frost (+ `.tp`) | apps/design.css:136-155 |
| Midnight / `dark` alias (+ `.tp`) | apps/design.css:156-175 |
| `@media (prefers-color-scheme: dark)` → `:root:not([data-theme])` (a copy of Midnight) | apps/design.css:176-197 |
| Forest | apps/design.css:198-217 |
| `.tp[data-preview="forest"]` (duplicate of Forest) | apps/design.css:218-237 |
| `.tp[data-preview="hearth"]`, `.tp[data-preview="system"]` | apps/design.css:238-256 |
| `.tp[data-preview="system"] .tp-half` (a copy of Midnight) | apps/design.css:257-276 |
| Kind expressions: kid | apps/design.css:278-284 |
| Kind expressions: kiosk | apps/design.css:285-289 |
| Base element resets (not scoped) | apps/design.css:291-317 |
| Components intro comment (`.ds` only) | apps/design.css:319-321 |
| Page wash `body.ds` | apps/design.css:323-324 |
| Text and layout utilities | apps/design.css:326-346 |
| Buttons | apps/design.css:348-378 |
| Surfaces: card, glass recipe, well, divider, hero, card-art | apps/design.css:380-435 |
| ↳ glass recipe, perf guard and `@supports` fallback | apps/design.css:387-404 |
| Inputs, switch, segmented control | apps/design.css:437-468 |
| Lists, rows, key-values | apps/design.css:470-488 |
| People: avatars, chips, stacks | apps/design.css:490-505 |
| Chips, badges, pills, dots | apps/design.css:507-521 |
| Stats: rings, bars, stat | apps/design.css:523-537 |
| Skeletons, empty states | apps/design.css:539-549 |
| Glass navigation: topbar, tabbar, sidebar | apps/design.css:551-576 |
| Overlays: sheet, toast, keyframes, pop and stagger | apps/design.css:578-599 |
| Icons, app-icon | apps/design.css:601-609 |
| `prefers-reduced-motion` | apps/design.css:611-613 |
| `print` | apps/design.css:614-617 |

### 5.2 Tokens

The "uses" counts below are `var(--x)` references inside design.css only. Other files are not counted. For example, `--font-mono`, `--fs-3xl`, `--sp-12`, `--sp-16`, `--bg-2` and `--glass-line` are used in docs/design.html at :26, :19, :18, :11, :54 and :58.

#### Typography

| Token | Value | Line |
|---|---|---|
| `--font-sans` | `ui-rounded, -apple-system, system-ui, "Segoe UI Variable", "Segoe UI", Roboto, "Helvetica Neue", sans-serif`. **`ui-rounded`: yes. `-apple-system`: yes. `system-ui`: yes.** | apps/design.css:18 |
| `--font-serif` | `ui-serif, "New York", "Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif` | apps/design.css:19 |
| `--font-display` | `var(--font-serif)` | apps/design.css:20 |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` (0 uses) | apps/design.css:21 |
| `--fs-xs` / `-sm` / `-md` / `-lg` | 12px / 14px / 16px / 18px | apps/design.css:22 |
| `--fs-xl` / `-2xl` / `-3xl` / `-4xl` | 22px / 28px / 36px / 48px (`3xl` and `4xl`: 0 uses) | apps/design.css:23 |
| `--fs-hero` | `clamp(34px, 7.5vw, 46px)` | apps/design.css:24 |
| `--lh-tight` / `--lh-snug` / `--lh` | 1.1 / 1.25 (0 uses) / 1.45 | apps/design.css:25 |
| `--ls-tight` / `--ls-caps` | -0.02em / .08em | apps/design.css:26 |
| Weight tokens | NOT FOUND IN CODE. Searched `--fw`, `--weight`, `--font-weight` and `font-weight: var`. Literals are used instead: 700 at apps/design.css:306,333,417,516,531,536,555; 600 at apps/design.css:354,451,466,479,488,501,509,518,561,590; 400 at apps/design.css:331,332,418. | — |
| Literal line-heights / tracking | Line-height `1.2` at apps/design.css:354; `1` at apps/design.css:492,516,536. Letter-spacing `-.01em` at apps/design.css:306; `0` at apps/design.css:331,332,418. | — |
| Other type features | `text-wrap: balance` on h1–h4 (apps/design.css:306). `font-variant-numeric: tabular-nums` on `.ring-lbl` and `.stat b` (apps/design.css:531,536). | — |
| Base type | body uses `--font-sans` / `--fs-md` / `--lh` (apps/design.css:296-298). h1–h4 use weight 700 and `--lh-tight` (apps/design.css:306). h1/h2/h3 are 2xl/xl/lg (apps/design.css:307-309). | — |

#### Spacing, targets, layout

| Token | Value | Line |
|---|---|---|
| `--sp-1…--sp-5` | 4 / 8 / 12 / 16 / 20px | apps/design.css:29 |
| `--sp-6, -8, -10, -12, -16` | 24 / 32 / 40 / 48 / 64px (`-12` and `-16`: 0 uses) | apps/design.css:30 |
| `--tap` / `--tap-lg` | 44px / 60px | apps/design.css:32 |
| `--max` / `--max-read` | 1200px / 720px | apps/design.css:33 |
| `--safe-top/-bottom/-left/-right` | `env(safe-area-inset-*, 0px)` | apps/design.css:34-37 |

#### Radii

| Token | Value | Line |
|---|---|---|
| `--r-sm` / `--r` / `--r-lg` / `--r-xl` / `--r-2xl` / `--r-full` | 12 / 16 / 22 / 28 / 36 / 999px | apps/design.css:31 |

#### Shadows / elevation (Hearth, ink `rgba(58,46,36,…)`)

| Token | Value | Line |
|---|---|---|
| `--e1` | `0 1px 2px rgba(58,46,36,.06), 0 1px 1px rgba(58,46,36,.04)` | apps/design.css:96 |
| `--e2` | `0 1px 2px …/.05, 0 6px 18px -8px …/.16` | apps/design.css:97 |
| `--e3` | `0 2px 6px …/.06, 0 18px 40px -16px …/.26` | apps/design.css:98 |
| `--e4` | `0 4px 12px …/.08, 0 32px 72px -24px …/.36` | apps/design.css:99 |
| `--shadow-sm` / `--shadow` / `--shadow-lg` | aliases of e1 / e2 / e3 (0 uses) | apps/design.css:100 |
| `--glow-accent` | `0 8px 24px -8px var(--accent-glow)` | apps/design.css:101 |
| `--focus` | `0 0 0 3px color-mix(in srgb, var(--accent) 38%, transparent)` | apps/design.css:102 |

#### Motion

| Token | Value | Line |
|---|---|---|
| `--ease` | `cubic-bezier(.2,.7,.2,1)` | apps/design.css:105 |
| `--ease-out` | same value as `--ease` (2 uses: apps/design.css:528,534) | apps/design.css:106 |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` (0 uses) | apps/design.css:107 |
| `--spring` | `cubic-bezier(.34,1.4,.64,1)` | apps/design.css:108 |
| `--dur` / `--dur-1` / `--dur-2` / `--dur-3` | 220ms (0 uses) / 120ms / 220ms / 360ms | apps/design.css:109 |
| Keyframes | `hub-shimmer` apps/design.css:544, `hub-fade` :592, `hub-rise` :593, `hub-toast` :594, `hub-pop` :595 | — |

#### Z-index

Z-index tokens: NOT FOUND IN CODE. Searched `--z`, `--zi`, `--layer` and `z-index: var`.

| Value | Where | Line |
|---|---|---|
| 0 | `.hero-art`, `.tab-ind` | apps/design.css:420, 567 |
| 1 | `.hero > *`, `.tab` | apps/design.css:416, 560 |
| 20 | `.topbar`, `.tabbar` | apps/design.css:552, 556 |
| 50 | `.sheet-backdrop` | apps/design.css:579 |
| 60 | `.toast` | apps/design.css:590 |

#### Colour tokens: default (Hearth, `:root`)

| Token | Value | Line |
|---|---|---|
| `--bg` | `#F7F2EB` | apps/design.css:40 |
| `--bg-2` | `#EFE7DC` (0 uses) | apps/design.css:41 |
| `--surface` | `#FFFCF8` | apps/design.css:42 |
| `--surface-2` | `#EFE7DC` | apps/design.css:43 |
| `--hover` | `#F2EADF` | apps/design.css:44 |
| `--text` | `#2E251D` | apps/design.css:45 |
| `--text-2` | `#6A5B4E` | apps/design.css:46 |
| `--muted` | `#75675B` (comment: "AA … 4.9:1") | apps/design.css:47 |
| `--muted-decor` | `#A79B8E` | apps/design.css:48 |
| `--line` | `#E6DCCE` | apps/design.css:49 |
| `--line-soft` | `#F0E8DC` | apps/design.css:50 |
| `--hairline` | `rgba(255,255,255,.6)` | apps/design.css:51 |
| `--scrim` | `rgba(42,35,28,.45)` | apps/design.css:52 |
| `--wash` | two radial gradients: accent 10%, gold 6% | apps/design.css:70-71 |
| `--mocha` / `-soft` / `-ink` | `#8A6A4B` / `#F0E6D9` / `#5E4630` | apps/design.css:73 |
| `--gold` / `-soft` / `-ink` | `#B4861B` / `#F6EBD0` / `#7A5A0F` | apps/design.css:74 |
| `--olive` / `-soft` / `-ink` | `#5B8143` / `#E6EEDD` / `#3E5C2C` | apps/design.css:75 |
| `--teal` / `-soft` / `-ink` | `#137F77` / `#DCECEA` / `#0E5F59` | apps/design.css:76 |
| `--terra` / `-soft` / `-ink` | `#BC5A38` / `#F7E3DA` / `#8E3E22` | apps/design.css:77 |
| `--slate` / `-soft` / `-ink` | `#4F5D8C` / `#E4E7F1` / `#3A4569` | apps/design.css:78 |
| `--ok` / `-soft` / `-ink` | → olive | apps/design.css:80 |
| `--warn` / `-soft` / `-ink` | → gold | apps/design.css:81 |
| `--danger` / `-soft` / `-ink` | → terra | apps/design.css:82 |
| `--info` / `-soft` / `-ink` | → teal (`--info`: 0 uses) | apps/design.css:83 |
| `--accent` | `var(--mocha)`. hub.js overrides it inline (apps/hub.js:80). | apps/design.css:86 |
| `--accent-soft` | `color-mix(accent 14%, surface)` | apps/design.css:87 |
| `--accent-tint` | `color-mix(accent 26%, surface)` | apps/design.css:88 |
| `--accent-deep` | `color-mix(accent 72%, black)` | apps/design.css:89 |
| `--accent-strong` | `var(--accent-deep)` (0 uses in design.css; used at index.html:350) | apps/design.css:90 |
| `--accent-glow` | `color-mix(accent 35%, transparent)` | apps/design.css:91 |
| `--on-accent` | `#FFFCF8` | apps/design.css:92 |
| `--tint` | `var(--accent)` (15 uses) | apps/design.css:93 |

#### Glass tokens

| Token | Value | Line |
|---|---|---|
| `--glass` | `rgba(255,252,248,.66)` | apps/design.css:55 |
| `--glass-strong` | `rgba(255,252,248,.84)` | apps/design.css:56 |
| `--glass-line` | `rgba(255,255,255,.55)`. 0 uses in design.css; used at docs/design.html:58. | apps/design.css:57 |
| `--blur` | 18px | apps/design.css:58 |
| `--glass-spec` | `rgba(255,255,255,.62)` | apps/design.css:62 |
| `--glass-edge` | `rgba(58,46,36,.10)` | apps/design.css:63 |
| `--glass-ring` | `rgba(255,255,255,.55)` | apps/design.css:64 |
| `--glass-inner` | `rgba(58,46,36,.10)` | apps/design.css:65 |
| `--glass-pickup` | 12% | apps/design.css:66 |
| `--sheen-x` | 30%. No theme overrides it. hub.js writes it on `<html>` from scroll/tilt (apps/hub.js:440-447). docs/design.html:275 sets it from a slider. | apps/design.css:67 |
| `--g` (local) | recipe fill: `--glass` / `--glass-strong` / surface mix / fallback | apps/design.css:389, 398, 400, 403 |

#### Kid and kiosk overrides

| Kind | Overrides | Not overridden | Lines |
|---|---|---|---|
| `:root[data-kind="kid"]` | `--tap` 64px and `--tap-lg` 84px. Type: `--fs-sm` 16, `-md` 19, `-lg` 22, `-xl` 26, `-2xl` 34, `-3xl` 44, `-4xl` 60, `--fs-hero` `clamp(38px, 9vw, 54px)`. Radii: `--r-sm` 16, `--r` 22, `--r-lg` 28, `--r-xl` 36, `--r-2xl` 44. | `--fs-xs`, `--r-full`, spacing, line-heights, `--blur` | apps/design.css:280-284 |
| `:root[data-kind="kiosk"]` | Type: `--fs-sm` 18, `-md` 22, `-lg` 26, `-xl` 32, `-2xl` 40, `-3xl` 56, `-4xl` 84, `--fs-hero` `clamp(56px, 8vw, 96px)`. `--blur` 28px. | `--tap`, `--tap-lg`, radii, `--fs-xs`, spacing | apps/design.css:286-289 |

### 5.3 Themes

Every `data-theme` block, and the dark-scheme block, overrides the same token set:

- **Neutrals:** `--bg`, `--bg-2`, `--surface`, `--surface-2`, `--hover`, `--text`, `--text-2`, `--muted`, `--muted-decor`, `--line`, `--line-soft`, `--hairline`, `--scrim`.
- **Glass fills:** `--glass`, `--glass-strong`, `--glass-line`.
- **`--wash`.**
- **Hues:** all 18 hue tokens (mocha, gold, olive, teal, terra and slate, each with `-soft` and `-ink`).
- **Accent:** `--accent-soft`, `--accent-deep`, `--on-accent`.
- **Glass edges:** `--glass-spec`, `--glass-edge`, `--glass-ring`, `--glass-inner`, `--glass-pickup`.
- **Elevation:** `--e1` to `--e4`.

No theme block overrides any of these:

- type, spacing or radii
- `--blur` or `--sheen-x`
- `--accent-tint`, `--accent-glow` or `--focus`
- `--shadow-*`
- motion

`color-scheme` is set only once, at apps/design.css:15. No theme sets it.

| Theme | Selector(s) | Lines | `--accent-deep` | `--on-accent` | `--glass-pickup` | `--wash` accent% / gold% |
|---|---|---|---|---|---|---|
| Hearth | `:root`. There is no `[data-theme="hearth"]` selector; hub.js removes `data-theme` for hearth and system (apps/hub.js:77). | apps/design.css:14-110 | 72% black | `#FFFCF8` | 12% | 10 / 6 |
| Parchment | `:root[data-theme="parchment"]`, `.tp[data-preview="parchment"]` | apps/design.css:116-135 | 66% black | `#FFF8EC` | 12% | 12 / 10 |
| Frost | `:root[data-theme="frost"]`, `.tp[data-preview="frost"]` | apps/design.css:136-155 | 72% black | `#FFFFFF` | 10% | 10 / 0 |
| Midnight | `:root[data-theme="midnight"]`, `:root[data-theme="dark"]`, `.tp[data-preview="midnight"]` | apps/design.css:156-175 | 58% white | `#17120E` | 16% | 16 / 7 |
| System (dark half) | `@media (prefers-color-scheme: dark) { :root:not([data-theme]) }`, an exact copy of Midnight | apps/design.css:176-197 | 58% white | `#17120E` | 16% | 16 / 7 |
| Forest | `:root[data-theme="forest"]` | apps/design.css:198-217 | 58% white | `#0E1412` | 16% | 14 / 10 |
| `light` alias | No selector; it falls through to `:root`. hub.js maps `light` to hearth (apps/hub.js:72); the style guide does the same (docs/design.html:314). | apps/design.css:115 (comment) | — | — | — | — |

**How System works:**

- **What the comments say:** "Hearth by day and Midnight at night" (apps/design.css:113-115, apps/hub.js:63,65).
- **What the code does:** it switches on the OS `prefers-color-scheme`, not on the clock (apps/design.css:176, apps/hub.js:73,79). hub.js re-applies the theme when that preference changes (apps/hub.js:83).
- **Hearth and System are handled the same way:** hub.js deletes `data-theme` for both (apps/hub.js:77).
- **So an explicitly chosen Hearth still goes dark on a dark OS.** The `:root:not([data-theme])` block at apps/design.css:177 applies the Midnight tokens. Meanwhile `data-scheme` is set to `"light"` from `THEMES` (apps/hub.js:66,79).
- **The style guide:** its `setTheme` follows the same path (docs/design.html:315-316). Unlike hub.js, it has no listener for `prefers-color-scheme` changes; `matchMedia` appears only at docs/design.html:316.

**Swatch copies (`.tp[data-preview=…]`)**

| Preview | Where | Notes |
|---|---|---|
| parchment, frost, midnight | Share the theme selector at apps/design.css:116, 136, 156 | — |
| forest | A separate duplicate block, apps/design.css:218-237 | Same values as apps/design.css:198-217 |
| hearth, system | apps/design.css:238-256 | Hearth values. It does not redeclare `--glass-spec/-edge/-ring/-inner/-pickup`. |
| system night half (`.tp-half`) | apps/design.css:257-276 | Midnight values, including glass |

- **Consumers:**
  - index.html:295-304 (Me theme-card geometry and the `.tp-half` for System) and index.html:1260 (markup).
  - docs/design.html:43-50 (swatch geometry) and docs/design.html:270, which renders hearth through forest with no system swatch.
  - scripts/test-design.mjs:116 asserts that the 5 guide previews paint 5 distinct backgrounds.
- **Tokens the swatches inherit:** no `.tp` block redeclares `--accent-tint`, `--accent-glow`, `--focus` or `--shadow-*`, so a swatch uses the page's computed values for those.
- **Duplication:**
  - Midnight values appear 3 times (apps/design.css:157-174, 178-195, 258-275).
  - Forest values appear 2 times.
  - Hearth values appear 2 times (apps/design.css:40-99 and 239-255).

### 5.4 Components

From apps/design.css:324 to apps/design.css:609, every rule's selector begins with `.ds ` or `body.ds`, inside or outside `@media`/`@supports`. The one exception is apps/design.css:428, `:root[data-scheme="dark"] .ds …`. The `@keyframes` names are global, not scoped: `hub-shimmer` at apps/design.css:544 and `hub-fade`/`hub-rise`/`hub-toast`/`hub-pop` at apps/design.css:592-595.

The rules that are not scoped to `.ds` are:

- the element resets at apps/design.css:292-317
- the theme and kind blocks
- reduced motion at apps/design.css:611-613
- print `body` at apps/design.css:615

| Class | Line | Description |
|---|---|---|
| `body.ds` | apps/design.css:324 | Page background: `--wash` over `--bg`, `background-attachment: fixed` |
| `.muted` `.text-2` `.small` `.xs` | apps/design.css:327-330 | Colour and size helpers |
| `.serif` `.display` | apps/design.css:331-332 | Serif / display face, weight 400 |
| `.kicker` | apps/design.css:333 | xs, 700, caps tracking, uppercase, muted |
| `.accent` | apps/design.css:334 | `--accent-deep` text |
| `.sr-only` | apps/design.css:335 | Visually hidden |
| `.stack` `.stack-lg` `.hstack` `.grow` | apps/design.css:336-339 | Flex helpers |
| `.wrap` | apps/design.css:340 | Padding that respects the left/right safe areas |
| `.container` `.container-wide` | apps/design.css:341-342 | Centred at `--max-read` / `--max` |
| `.grid-2` `.grid-3` | apps/design.css:343-346 | 1 column → 2 at 700px → 3 at 1024px (`.grid-3` only) |
| `.btn` | apps/design.css:349-360 | Min size `--tap`. Surface fill, line border, e1. Active: scale .96. Disabled: opacity .45. |
| `.btn-primary` | apps/design.css:361 | `--accent-deep` gradient with an inset white highlight, `--on-accent` text, glow |
| `.btn-soft` `.btn-ghost` `.btn-danger` | apps/design.css:362-364 | Soft tint / transparent / danger-soft |
| `.btn-glass` | apps/design.css:365 (+388) | Sets the text colour; the look comes from the glass recipe |
| `.btn-lg` `.btn-xl` | apps/design.css:366-367 | `--tap-lg` / literal 76px |
| `.btn-block` `.btn-round` | apps/design.css:368-370 | Full width / circular |
| `.btn .icon` | apps/design.css:371 | 1.25em icon |
| Button hovers | apps/design.css:372-378 | Only under `hover: hover` and `pointer: fine` |
| `.card` `.card-flat` `.card-lift` | apps/design.css:381-386 | Solid surface, `--r-lg`, e2 / none / e3 |
| `.glass` `.card.glass` `.glass-strong` `.btn-glass` `.pill` `.topbar` `.tabbar` `.sheet` | apps/design.css:388-397 | The shared liquid-glass recipe: specular gradient, accent pickup at `--sheen-x`, edge border, 3 inset shadows plus a ring plus e2, and `blur(var(--blur)) saturate(1.4) brightness(1.02)` |
| Strong glass group | apps/design.css:398 | `.glass-strong`, `.topbar`, `.tabbar` and `.sheet` use `--glass-strong` |
| `.card.glass` | apps/design.css:400 | No backdrop-filter; fill is a surface/bg mix (the scroll perf guard) |
| `.glass-lite` | apps/design.css:401 | Removes backdrop-filter only |
| `@supports not (backdrop-filter)` | apps/design.css:402-404 | Near-opaque surface fallback. `.card.glass` is not in its list. |
| `.well` `.divider` | apps/design.css:405-406 | Sunken well / 1px rule |
| `.hero` (+`::after`, `> *`, `-kicker`, `-title`, `-sub`, `-art`, `.btn`, `.btn-primary`) | apps/design.css:409-423 | Accent radial-gradient block with `--on-accent` text and an art slot on the right |
| `.hero-soft` | apps/design.css:424-427 | Tinted paper hero |
| Hero in the dark scheme | apps/design.css:428 | Text becomes `--text` under `data-scheme="dark"` |
| `.hero .on-dark` | apps/design.css:429 | Literal `#FFFCF8` |
| `.card-art` (`.art`, `.body`) | apps/design.css:432-435 | 120px illustration band |
| `.input` `.select` `.textarea` | apps/design.css:438-447 | Min height `--tap`. On `:focus`: accent border plus `--focus`. |
| `.select` chevron | apps/design.css:448-450 | `appearance:none` plus an inline SVG chevron |
| `.label` `.field` `.help` | apps/design.css:451-454 | Form layout |
| `.switch` | apps/design.css:455-462 | 52×32 track. `::before` adds a -6px vertical inset, giving a 44px hit area. 26px white knob. Checked uses `--ok`. |
| `.seg` (`button`, `.on`, `[aria-pressed]`) | apps/design.css:465-468 | Segmented control; buttons have min height `--tap` |
| `.list` | apps/design.css:471 | Surface list container |
| `.row` (`-main`, `-title`, `-sub`, `-lead`, `-art`) | apps/design.css:472-482 | Row with min height `--tap-lg`; the lead/art tile is `--tap` square |
| `button.row` | apps/design.css:483-485 | Pressable row: `:active`, plus hover on fine pointers |
| `.kv` | apps/design.css:486-488 | Key/value line |
| `.avatar` (`-sm` 32, `-lg` 64, `-xl` 96, `-plain`) | apps/design.css:491-499 | Tint gradient with a double ring; 44px by default |
| `.person-chip` | apps/design.css:500-502 | Tinted pill with an avatar (30px); min height 36px |
| `.people` | apps/design.css:503-505 | Overlapping stack of 32px faces, -8px overlap |
| `.chip` (`-accent/-ok/-warn/-danger/-info`) | apps/design.css:508-514 | Min height 32px, ink on soft |
| `.badge` | apps/design.css:515-516 | 22px danger count with `#fff` text |
| `.pill` | apps/design.css:517-518 | 40px glass pill |
| `.dot` (`-synced/-pending/-offline/-error`) | apps/design.css:519-521 | 10px sync-status dots |
| `.ringwrap` `.ring` `.ring-lg` `.ring-lbl` | apps/design.css:524-532 | SVG progress ring driven by `--p`; dasharray hard-coded at 138 |
| `.bar` | apps/design.css:533-534 | 8px progress bar driven by `--p` |
| `.stat` | apps/design.css:535-537 | Big number plus label |
| `.skeleton` | apps/design.css:540-544 | Shimmer placeholder |
| `.empty` `.empty-art` | apps/design.css:545-549 | Empty state |
| `.topbar` (`.title`) | apps/design.css:552-555 | Sticky glass bar, safe-top padding, min height 52px |
| `.tabbar` `.tabs` | apps/design.css:556-559 | Fixed bottom glass bar with safe-bottom padding; `.tabs` max width 560px |
| `.tab` (`.icon`, `.on`, `.dot`) | apps/design.css:560-565 | Min height 56px. Active: scale .94. `.on` uses `--accent-deep`. |
| `.tab-ind` | apps/design.css:566-567 | Sliding indicator driven by `--tabs` / `--i` |
| `.tabbar.sidebar` | apps/design.css:569-576 | At 1024px and wider: a 220px left sidebar with 48px rows |
| `.sheet-backdrop` | apps/design.css:579 | Scrim, content aligned to the bottom, z-index 50 |
| `.sheet` (`::before`, `h2`, `[data-snap]`) | apps/design.css:580-587 | Bottom sheet with a grabber. Peek 30dvh / half 55dvh. Centred at 720px and wider. |
| `.toast` | apps/design.css:588-591 | Inverted pill (`--text` at 90%) with its own `blur(10px)`, z-index 60; not part of the glass recipe |
| `.pop-in` `.stagger` | apps/design.css:596-599 | Arrival animations |
| `.icon` `.icon-lg` `.icon .duo` | apps/design.css:602-605 | 24 / 32px stroke icon; duotone fill at 20% tint |
| `.app-icon` | apps/design.css:606-609 | 56px tinted tile, radius 18px |

### 5.5 Media queries and preferences

| Query | Line | What it changes |
|---|---|---|
| `prefers-color-scheme: dark` | apps/design.css:176-197 | Midnight tokens on `:root:not([data-theme])`, which covers both System and Hearth |
| `min-width: 700px` | apps/design.css:345 | `.grid-2` / `.grid-3` → 2 columns |
| `min-width: 1024px` | apps/design.css:346 | `.grid-3` → 3 columns |
| `hover: hover and pointer: fine` | apps/design.css:372-378 | Button hover states |
| `hover: hover and pointer: fine` | apps/design.css:485 | `button.row` hover |
| `min-width: 1024px` | apps/design.css:569-576 | `.tabbar.sidebar` becomes a vertical sidebar |
| `min-width: 720px` | apps/design.css:587 | Sheet centred and fully rounded, with no grabber |
| `prefers-reduced-motion: reduce` | apps/design.css:611-613 | Global (not scoped): animation-duration .01ms, 1 iteration, `transition: none`. hub.js also turns the sheen drift off (comment at apps/hub.js:440). |
| `print` | apps/design.css:614-617 | White/black body; hides `.btn`, the sheet backdrop, toast, tabbar and topbar |
| `@supports not (backdrop-filter…)` | apps/design.css:402-404 | Opaque glass fallback |
| `prefers-reduced-transparency` | — | NOT FOUND IN CODE. Searched `prefers-` (the only hits in design.css are :176 and :611) and `reduced-transparency` across the repo (the only hit is audits/HUB-AUDIT-PROMPT.md, which is not code). |
| `prefers-contrast` | — | NOT FOUND IN CODE. Same searches. |
| `forced-colors` | — | NOT FOUND IN CODE. Searched `forced-colors` across the repo. |
| `max-width` breakpoints | — | NOT FOUND IN CODE. Every width query is `min-width`. |

### 5.6 Web-tell resets

| Item | Status |
|---|---|
| `-webkit-tap-highlight-color: transparent` | body apps/design.css:302; button apps/design.css:312 |
| `touch-action: manipulation` | body apps/design.css:303; button apps/design.css:312 |
| `user-select: none` (+ `-webkit-`) | `.ds .btn` only, apps/design.css:355. Not on `.tab`, `.seg button`, `button.row`, `.chip` or `.switch`. |
| `-webkit-touch-callout` | NOT FOUND IN CODE (searched `touch-callout`) |
| `:focus` / `:focus-visible` | See the three rows below. |
| ↳ global rules | `:focus { outline: none }` is global (apps/design.css:313). `:focus-visible { box-shadow: var(--focus); border-radius: var(--r-sm) }` (apps/design.css:314). Inputs use `:focus` (apps/design.css:446). |
| ↳ no component rules | No component-level `:focus-visible` rule exists. The only focus hits are :102, :313, :314 and :446. |
| ↳ specificity | The global `:focus-visible` has specificity (0,1,0). Any `.ds …` rule that sets `box-shadow` (0,2,0 or higher) overrides its ring: `.btn` apps/design.css:356, the glass recipe :395 (`.btn-glass`, `.pill`), `.switch` :456 and `.seg button.on` :467. |
| `overscroll-behavior` | `none` on body, apps/design.css:304. Not set on `.sheet`, which has `overflow: auto` at apps/design.css:580. |
| Scrollbar styling (`::-webkit-scrollbar`, `scrollbar-width/-color/-gutter`) | NOT FOUND IN CODE (searched `scrollbar`) |
| `appearance: none` | `.select` only, apps/design.css:448. A button/input appearance reset is NOT FOUND IN CODE; they only get `font: inherit; color: inherit` (apps/design.css:311). |
| `text-size-adjust: 100%` (+ `-webkit-`) | apps/design.css:293 |
| `-webkit-font-smoothing: antialiased` | apps/design.css:301. `-moz-osx-font-smoothing`: NOT FOUND IN CODE (searched `-moz`). |
| `box-sizing: border-box` | apps/design.css:292 |
| `::selection` | apps/design.css:315 (`--accent-tint`) |
| `[hidden]` / `img, svg { display:block }` | apps/design.css:316-317 |
| `-webkit-user-drag` | NOT FOUND IN CODE. The only `-webkit-` hits are apps/design.css:293, 301, 302, 312, 355, 396, 400, 401, 402, 448 and 591. |
| `cursor` | `pointer` at apps/design.css:355, 456, 466, 483, 561; `default` at 360, 462 |

### 5.7 Hardcoded values

**Hex literals**

- 275 in the whole file.
- 270 sit inside the token and theme blocks (apps/design.css:14-276): exactly 30 in each of the 9 blocks (:root, parchment, frost, midnight, dark-scheme, forest, .tp forest, .tp hearth/system, .tp-half).
- 5 sit outside the token definitions:

| Line | Literal | Context |
|---|---|---|
| apps/design.css:429 | `#FFFCF8` | `.hero .on-dark` |
| apps/design.css:459 | `#fff` | switch knob |
| apps/design.css:516 | `#fff` | badge text |
| apps/design.css:615 | `#fff`, `#000` | print |

- There is also one URL-encoded hex: `%237D6F62`, the select chevron stroke at apps/design.css:449. It is the only occurrence of `7D6F62` in the file, so it matches no token value, and it is the same in every theme.

**Other colour literals outside tokens**

- **`rgba()` literals:** 11, on apps/design.css:361, 374, 413, 415 (×2), 423, 442, 456, 459, 589 (×2). One of them is the Hearth ink `rgba(58,46,36,.04)` in the input inset at apps/design.css:442, which applies in every theme.
- **Named `white` / `black` inside `color-mix`, in token definitions:** apps/design.css:89, 130, 150, 170, 191, 212, 232, 252, 271.
- **The same in components:** apps/design.css:361, 412, 534.

**Literal shadows outside the `--e*` tokens**

| Line | Where | Shadow |
|---|---|---|
| apps/design.css:374 | `btn-primary:hover` | `0 12px 28px -10px` |
| apps/design.css:413 | hero | `0 20px 48px -20px` |
| apps/design.css:442 | input | inset `0 1px 2px` |
| apps/design.css:456 | switch track | inset `0 1px 2px` |
| apps/design.css:459 | switch knob | `0 1px 3px` |
| apps/design.css:494, 496, 498, 504 | avatar rings | 2px / 2.5px / 3.5px / 4px / 5px / 8px |
| apps/design.css:516 | badge ring | 2px |

**Raw `px` in apps/design.css:291-617**

There are 136 `px` literals:

- 29 are `1px`, and another 4 are `-1px`, at apps/design.css:395, 554, 558, 571.
- 4 are breakpoints, at apps/design.css:345, 346, 569, 587.

The dimensions that do not come from a token:

| Value | Where | Line |
|---|---|---|
| 76px | `.btn-xl` | apps/design.css:367 |
| 52×32px | switch track | apps/design.css:455 |
| -6px | switch hit-area inset | apps/design.css:457 |
| 26px, inset 3px | switch knob | apps/design.css:458 |
| 20px | switch knob travel | apps/design.css:461 |
| 4px | seg padding and gap | apps/design.css:465 |
| 44 / 32 / 64 / 96px | avatar sizes | apps/design.css:491, 496-498 |
| 36px, avatar 30px | person-chip | apps/design.css:500, 502 |
| 32px, -8px overlap | `.people` avatars | apps/design.css:504 |
| 32px | chip | apps/design.css:508 |
| 22px, padding 6px | badge | apps/design.css:515 |
| 40px | pill | apps/design.css:517 |
| 10px | dot | apps/design.css:519 |
| 56 / 96px | ring | apps/design.css:525, 529 |
| 8px | bar | apps/design.css:533 |
| 52px | topbar | apps/design.css:552 |
| 560px | tabbar `.tabs` and sheet max width | apps/design.css:559, 580 |
| 56px | tab min height | apps/design.css:560 |
| 26px | tab icon | apps/design.css:563 |
| 9px, top 8px, offset 22px | tab dot | apps/design.css:565 |
| 4px | tab-ind top/bottom | apps/design.css:566 |
| 220px | sidebar | apps/design.css:570 |
| 48px | sidebar tab | apps/design.css:573, 575 |
| 24px | sheet top gap (`100dvh - safe-top - 24px`) | apps/design.css:580 |
| 40×5px | sheet grabber | apps/design.css:584 |
| 24 / 32px | `.icon` / `.icon-lg` | apps/design.css:602-603 |
| 56px, radius 18px | app-icon | apps/design.css:606 |
| 120px | card-art band | apps/design.css:433 |
| 260px | hero-art max | apps/design.css:420 |
| 48px | empty icon | apps/design.css:546 |
| 220px | empty-art | apps/design.css:547 |
| blur 10px | toast | apps/design.css:591 |
| `100% - 32px` | toast max width | apps/design.css:590 |
| 24 / 16 / 8px | keyframe start offsets (rise / toast / pop) | apps/design.css:593-595 |

The kid and kiosk overrides (apps/design.css:280-289) scale none of these literals.

**Other literals**

- Durations: `.8s` (apps/design.css:528, 534), `1.4s` (apps/design.css:543), 40 / 80 / 120 / 160 / 200ms stagger delays (apps/design.css:598-599), `.01ms` (apps/design.css:612). One transition has no easing: `color var(--dur-1)` at apps/design.css:466.
- Radii: `calc(var(--r) - 4px)` at apps/design.css:466, `18px` at apps/design.css:606, `3px` at apps/design.css:584, `50%` at apps/design.css:458, 491, 519.
- Opacity: `.45` at :360, `.4` at :462, `.85` at :417, `.9` at :419, `.95` at :420, `.6` at :546 and :584, `fill-opacity: .2` at :605 (all apps/design.css).
- Press scales: `.96` at :359, `.97` at :468, `.94` at :562.
- Weights, line-heights, tracking and z-index literals are listed in 5.2.

### 5.8 docs/design.html

The page is 325 lines. It loads `../apps/design.css` (docs/design.html:9) and has `<body class="ds">` (docs/design.html:71). Its own `<style>` is docs/design.html:10-69.

| Part | Lines | Covers |
|---|---|---|
| Sticky glass control bar | docs/design.html:73-77 (sticky, z-index 30 at :12) | Theme segment: System, Hearth, Parchment, Frost, Midnight, Forest (docs/design.html:74). Kind: Adult / Kid / Kiosk, which sets `data-kind` (docs/design.html:75, 256). 8 accent swatches from `PEOPLE` that set `--accent` (docs/design.html:76, 253, 257-258). |
| Hero demo | docs/design.html:79-85 | `.hero`, `.hero-art`, `.btn-primary`, `.pop-in` |
| Themes | docs/design.html:87-91, 270 | `.tp` swatches for hearth, parchment, frost, midnight and forest. No system swatch and no `.tp-half`. |
| Colour + contrast | docs/design.html:93-100, 260-264, 281-309 | See the next four rows. |
| ↳ swatches | docs/design.html:260-264 | 11 neutrals, 6 hues with soft/ink, accent, accent-deep, accent-soft, glass |
| ↳ live WCAG table | docs/design.html:292-305 | 36 rows, all checked against 4.5. |
| ↳ table rows | docs/design.html:292-305 | 7 neutral pairs (:292-294), 4 chip ink-on-soft pairs (:295), the toast pair (:296), and 3 accent pairs × 8 family colours (:298-305). |
| ↳ exposed as | docs/design.html:307 | `window.__contrast` |
| Type | docs/design.html:102-113 | hero, 3xl, 2xl, xl, lg, md, sm, kicker. No `--fs-4xl` or `--fs-xs` row. |
| Spacing, radii, elevation | docs/design.html:115-121, 265-266 | sp-1 to sp-12 (no sp-16); r-sm to r-2xl (no r-full); e1 to e4 plus glass |
| Motion | docs/design.html:123-127, 277 | `hub-pop`, `.stagger`, replay button |
| Buttons | docs/design.html:129-133 | All variants, including round and disabled |
| Surfaces | docs/design.html:135-146 | card, card.glass, card-lift, hero-soft, card-art, well |
| Liquid glass | docs/design.html:148-158, 275 | v2 vs v3 stage, pill, btn-glass, `--sheen-x` slider |
| Inputs | docs/design.html:160-174 | input, select, textarea, switch, seg, help |
| Lists | docs/design.html:176-186 | row, row-art, row-lead, button.row, kv |
| People, status, progress, empty | docs/design.html:188-217 | avatars, person-chip, people, chips, badge, pill, dots, ring, bar, stat, skeleton, empty |
| Navigation + overlays | docs/design.html:219-224, 278-279 | tabbar with tab-ind, sheet (with `.btn-block`), toast |
| Illustrations | docs/design.html:226-239, 272-274 | art/hero ×5, app ×10, empty ×5, story ×12, ambient ×4. The app list omits `kidverse` and `verses`, although art/app/kidverse.svg and art/app/verses.svg exist. |
| Icons | docs/design.html:241-244, 247 | app-icon, icon-lg, one `#i-plus` duotone symbol |
| `setTheme` | docs/design.html:311-321 | Mirrors hub.js `applyTheme` (comment at :311). Deletes `data-theme` for system and hearth (:315). Sets `data-scheme` (:316). Exposes `window.__setTheme` (:321). The initial theme is system (:320). |
| design.css pieces not demonstrated | — | These classes do not appear in the page's markup or script:<br>• `.topbar`<br>• `.tabbar.sidebar` (named only in the lede at :221)<br>• `.glass-lite`, `.avatar-plain`, `.hero .on-dark`, `.divider`<br>• `.sheet[data-snap]`<br>• `.container`/`-wide`, `.stack-lg`, `.wrap`, `.sr-only` |

**Used by scripts:**

- scripts/test-design.mjs:35-116 runs the guide as follows:
  - **light and dark OS schemes, at 390 and 1280:**
    - `__contrast` must have 30 or more rows, all passing
    - no horizontal scroll
    - glass must use backdrop-filter, with the v3 layers present
    - the `.card.glass` perf guard must hold
    - `--sheen-x` must move
    - controls must be 36px or taller
    - kid mode must scale
    - `.grid-3` must be three columns on desktop
  - **reduced motion (:86-99):** animations and transitions are off, and the midnight and `dark` aliases apply.
  - **per theme:** `__setTheme` for each of the 5 themes, with background, AA and `data-scheme` checks (:101-112), and the check that the 5 previews differ (:116).
- scripts/test-prefs.mjs:102-103
- scripts/test-art.mjs:59

**Hardcoded values in the page:**

- **Hex literals:** 16, at docs/design.html:84 (×3), 182, 243 (×3), 253 (×8, the family colours hard-coded in `PEOPLE`) and 267.
- **`rgba()` in the page's own `<style>`:** docs/design.html:55, 60.
- **Raw small type in the page's own `<style>`:** 11px at docs/design.html:26, 60, 67; 12px at docs/design.html:28; 10px inline at docs/design.html:265.
- **Control sizes below `--tap`:**
  - `.controls .seg button` has `min-height: 40px` (docs/design.html:14).
  - `.swatch` is 36px (docs/design.html:16).

## 6. Cloudflare Worker: routes, auth, data, media

### 6.1 Entry and config

#### Handlers and dispatcher
| Item | Where | Behaviour |
|---|---|---|
| `fetch` | worker/src/index.js:590-591 | Calls `handle()` (index.js:561-588). |
| `scheduled` | worker/src/index.js:593-601 | Runs `silenceExpiredGuests` (596), then `runCron` (597; reminders.js:247-261), then `console.log('cron', …)` (598), then `purgeExpiredGuests` (599; index.js:223-229). Only the two guest steps have their own try/catch (596, 599-600). `runCron` (597) is not wrapped, but it catches each job's error itself (reminders.js:258). |
| `runCron` gating | worker/src/reminders.js:247-261 | Uses the New York hour (248). At 8 it runs `morning`. At 20 it runs `evening`, plus `behind` on Sundays (253). `prayer` and `park` run with both (255). Any other hour returns `{job:null, skipped:true, nyHour}` (254). `force` runs one named job (249-252); an unknown name returns `{error:'bad_job'}` (250). |
| Route table | worker/src/index.js:50-54 | A linear array. `:name` becomes `(?<name>[^/]+)` and a trailing `/` is optional (53). |
| Matching | worker/src/index.js:572-582 | The first route whose regex and method both match wins. A path match with a different method sets `methodMatched`, which gives 405 (576, 581). No match gives 404 (582). |
| Params | worker/src/index.js:577 | `decodeURIComponent` runs on each group inside the try, so malformed percent-encoding ends up as 500 `internal` (585-586). |
| Lazy auth | worker/src/index.js:565, 569 | `c.auth()` is memoised per request. A route that never calls it needs no token. |
| Lazy body | worker/src/index.js:568, 42-45 | `c.body()` parses JSON on demand. |
| Response wrap | worker/src/index.js:579 | A plain object goes through `json(out, 200, cors)`. A `Response` is returned unchanged. |
| `json()` helper | worker/src/index.js:39-40 | Sets `Content-Type: application/json` and `Cache-Control: no-store`. `extra` headers are spread last, so they can override these. |

#### CORS
| Aspect | Where | Value |
|---|---|---|
| Allowed origins | index.js:29; wrangler.toml:8 | `env.ALLOWED_ORIGINS`, comma-split: `https://vantrix117.github.io`, `http://localhost:8765`, `http://127.0.0.1:8765` |
| Allow-Origin | index.js:36 | Echoes the request `Origin` (read at 28) only on an exact match. Otherwise the header is omitted. |
| Origin rejection | index.js:27-38, 561-588 | NOT FOUND IN CODE. There is no Origin-based refusal: requests from other origins still run and only lack the ACAO header (searched `corsHeaders`, `handle`, `Origin`). |
| Methods | index.js:31 | `GET,POST,PUT,DELETE,OPTIONS` |
| Headers | index.js:32 | `Content-Type, X-Device-Token, X-Profile-Token` |
| Max-Age / Vary | index.js:33-34 | `86400` / `Origin` |
| Preflight | index.js:563 | Every `OPTIONS` on any path returns 204 with the headers above, before routing or auth. |
| Allow-Credentials / Expose-Headers | index.js:27-38 | NOT FOUND IN CODE (searched worker/src for `Allow-Credentials` and `Expose-Headers`). |
| Exceptions | index.js:390; index.js:77; chat.js:450 | Media sets `Access-Control-Allow-Origin: *` with no Vary. The waits response and the chat SSE response merge `c.cors`. Errors from any route get `cors` (584, 586). |

#### `env.*`, request headers and runtime globals read
| Name | Kind | Read at |
|---|---|---|
| `env.DB` | D1 binding | auth.js:57-59,76,81,87,122,130,138,145; data.js:20,29,46,51,61; media.js:26,33,41; index.js (throughout); chat.js; reminders.js |
| `env.ALLOWED_ORIGINS` | var | index.js:29 |
| `env.VAPID_PUBLIC_KEY` | var | index.js:408; reminders.js:21-22 |
| `env.VAPID_SUBJECT` | var | reminders.js:22 (fallback `mailto:hub@example.com`) |
| `env.VAPID_PRIVATE_KEY` | secret | reminders.js:21-22 |
| `env.ANTHROPIC_API_KEY` | secret | chat.js:347, 390, 456 |
| `env.ANTHROPIC_BASE_URL` | optional var (dev mock) | chat.js:345 (default `https://api.anthropic.com`) |
| `env.MEDIA` | optional R2 binding | media.js:25, 32, 40 |
| `caches.default` | Cache API | index.js:64 |
| global `fetch` (outbound) | runtime | index.js:67 (queue-times); chat.js:345 (Anthropic) |
| `ctx.waitUntil` | runtime | auth.js:81, 96; index.js:70, 349; chat.js:449 |
| Request headers | n/a | `Origin` index.js:28; `CF-Connecting-IP` index.js:46; `X-Device-Token` auth.js:74; `X-Profile-Token` auth.js:85, index.js:274 |

#### wrangler.toml
| Key | Line | Value |
|---|---|---|
| `name` | 1 | `house-hub-api` |
| `main` | 2 | `src/index.js` |
| `compatibility_date` | 3 | `2026-09-05` |
| `workers_dev` | 4 | `true` (no `routes` or custom domain in the file) |
| `[vars]` | 6-11 | `ALLOWED_ORIGINS` (8), `VAPID_PUBLIC_KEY` (10, a public key, value not reproduced), `VAPID_SUBJECT` (11, a `mailto:` address, not reproduced) |
| `[observability]` | 13-14 | `enabled = true` |
| `[[d1_databases]]` | 17-20 | `binding = "DB"` (18), `database_name = "house-hub"` (19), `database_id` set (20) |
| `[triggers] crons` | 24-25 | `["0 12,13 * * *", "0 0,1 * * *"]` |
| R2 / KV / compatibility_flags / limits | 1-25 | NOT FOUND IN CODE. There is no `[[r2_buckets]]`, so the file binds no `env.MEDIA` and media.js takes its D1 branch. |

### 6.2 Route table

**Auth levels:**
- **none:** the handler never calls `c.auth()`.
- **device:** needs a valid `X-Device-Token` (auth.js:74-77). If an `X-Profile-Token` is also sent, it must be valid or the request gets 401 (auth.js:85-98).
- **session:** `requireProfile` (auth.js:104-107).
- **writer:** session and not kiosk (auth.js:108-112).
- **admin:** session and `is_admin` (auth.js:113-117).
- **hh-adult:** session, `kind==='adult'` and not a guest (index.js:90-94).

| # | Method | Path | Auth | Handler | What it does | Rate limit |
|---|---|---|---|---|---|---|
| 1 | GET | /api/health | none | index.js:56 | `{ok, time}` | none |
| 2 | GET | /api/dollywood/waits | none | index.js:63-78 | Proxies queue-times park 55 (62) through a 60 s edge cache, normalises rides (73-76) and returns `Cache-Control: public, max-age=60` (77). An upstream non-OK status gives 502 (68). | 60 s cache (69-70) |
| 3 | POST | /api/dollywood/rally | hh-adult | index.js:97-131 | Name trimmed and cut to 60 chars and required (103-104). Note cut to 140 (108). x/y must be finite numbers (105-107). Writes family `dollywood-live`/`meet` through `putOne` with a winning timestamp (96, 111), logs activity (113), and pushes kind `rally` to the other household adults whose `park` pref is on (115-129). | 1 per adult per 60 s: key `rally:<id>`. `rateCheck(…,1)` runs before the body is read (99-100); `rateHit(…,MIN)` runs only after the write (112). |
| 4 | DELETE | /api/dollywood/rally | hh-adult | index.js:132-139 | Tombstones `meet` with a winning timestamp (136) and logs activity if a point existed (137). | none |
| 5 | POST | /api/pair | none | index.js:142-157 | Checks the pairing code and creates a device. See 6.3. | 10 failures per IP per 15 min (144, 149); cleared on success (152) |
| 6 | GET | /api/profiles | device | index.js:161-167 | Lists all profiles through `publicProfile`. Expired guests are hidden unless the caller is admin (163-166). | none |
| 7 | POST | /api/profiles | writer, adult, not guest | index.js:174-203 | Adds a guest. Name cut to 40 and required (179-180). Emoji cut to 8 (181). Colour must be `#rrggbb` (182-183). Optional 4–8 digit PIN (185-188). Optional `expires_at` (189-193). Id is `guest-<randomId>` (194). Logs activity (199-200). | none |
| 8 | POST | /api/login | device | index.js:231-249 | Profile sign-in. An expired guest gets 403 (236). Checks the PIN for adults (238-247). Returns `profile_token`. | 5 failures per (profile, device) per 15 min (240-243); cleared on success (246) |
| 9 | POST | /api/profiles/:id/pin | device | index.js:252-268 | First-time PIN creation; returns `profile_token`. | none |
| 10 | GET | /api/me | session | index.js:270 | Current profile | none |
| 11 | POST | /api/logout | device | index.js:272-277 | Deletes the session row for the sent `X-Profile-Token` (275) | none |
| 12 | GET | /api/data/:appId | device; session for `scope=person` | index.js:286-296 (args 280-284) | Pull: `?scope`, `?since`, `?prefix`, or `?key` for a single row. Returns `now`. | none |
| 13 | PUT | /api/data/:appId/:key | writer | index.js:298-302 | LWW upsert of one row | none |
| 14 | DELETE | /api/data/:appId/:key | writer | index.js:304-307 | Tombstone stamped with the server's `Date.now()` | none |
| 15 | POST | /api/data/:appId/batch | writer | index.js:310-318 | Up to 200 `putOne` calls, run one after another | none |
| 16 | GET | /api/activity | device | index.js:321-329 | Feed of the last `limit` rows (1–100, default 30), joined with profile name, emoji, colour and photo (sm URL only, 328) | none |
| 17 | PUT | /api/profiles/:id/photo | writer; own adult profile or admin (333-338) | index.js:339-351 | Stores the 256 px and 1024 px JPEGs under a new token, sets `profiles.photo`, and deletes the old files in the background (349) | none |
| 18 | DELETE | /api/profiles/:id/photo | same as 17 | index.js:352-359 | Clears `photo` and deletes the `photos/<id>/` prefix | none |
| 19 | POST | /api/album | writer, kind adult (guests allowed) | index.js:361-372 | Stores 2 JPEGs and writes family row `hub`/`album:<id>`. Caption cut to 140 (369). | none |
| 20 | DELETE | /api/album/:id | writer; uploader (`by`) or admin | index.js:373-383 | Tombstones the row and deletes the `album/<id>-` media. `:id` is not run through `checkKey` (375-381). | none |
| 21 | GET | /api/media/:folder/:a/:b | none | index.js:384, 386-391 | Serves a profile photo | none |
| 22 | GET | /api/media/:folder/:a | none | index.js:385, 386-391 | Serves an album photo | none |
| 23 | POST | /api/activity | writer | index.js:393-403 | Adds a feed line. Text cut to 200 and required (396-397). `app_id` is key-validated (399). | none |
| 24 | GET | /api/push/config | device | index.js:406-409 | `{public_key, enabled}` | none |
| 25 | POST | /api/push/subscribe | session (kiosk allowed) | index.js:410-420 | Upserts the subscription per (profile, device) | none |
| 26 | DELETE | /api/push/subscribe | session | index.js:421-426 | Deletes the subscription for (profile, device) | none |
| 27 | POST | /api/chat | session, not kiosk (431; chat.js:391) | index.js:429-441, then chat.js:388-451 | Streams Claude chat over SSE. The message is cut to 2000 chars (chat.js:393) and the client `apps` list to 40 (chat.js:395). For guests, adds the guest's id to the `visibleTo` of every app a household adult can see (432-439). | 60 user messages per profile per New York day (chat.js:16, 113-117, 399-400) |
| 28 | GET | /api/chat/history | session | index.js:442, chat.js:454-457 | Last 20 messages (`HISTORY`, chat.js:17) plus `used`, `cap`, `enabled` | none |
| 29 | POST | /api/admin/profiles/:id/reset-pin | admin | index.js:445-451 | Sets `pin_hash = NULL` and deletes the profile's sessions. There is no kind or guest guard. | none |
| 30 | PUT | /api/admin/profiles/:id | admin | index.js:453-479 | Edits name, emoji, colour, kind and sort_order, plus `expires_at` for guests | none |
| 31 | DELETE | /api/admin/profiles/:id | admin, guest target | index.js:490-494 (`guestFor` 483-489) | `deleteGuest` (206-218) | none |
| 32 | POST | /api/admin/profiles/:id/purge | admin, expired guest | index.js:495-500 | `deleteGuest` | none |
| 33 | POST | /api/admin/guests/purge | admin | index.js:502-505 | `purgeExpiredGuests` | none |
| 34 | POST | /api/admin/pairing-code/rotate | admin | index.js:508-517 | Stores the hash of a chosen code (6–64 chars) or of a generated 8-char code, which is returned once | none |
| 35 | GET | /api/admin/usage | admin | index.js:519-531 | Over 30 days: chat user messages per profile per day, push sends per profile, kind and day, all devices, and push subscription counts | none |
| 36 | POST | /api/push/test | session; admin to target another profile (537) | index.js:534-539 | `pushTo(target,'test',…)` | none |
| 37 | POST | /api/admin/cron/run | admin | index.js:541-547 | Validates `job` against `JOBS` (544), silences expired guests (545), then runs `runCron(…, job)` | none |
| 38 | DELETE | /api/admin/devices/:id | admin | index.js:549-558 | Deletes the device's sessions, push subscriptions and device row. Refuses the caller's own device (551). | none |

**Routing notes:**
- Routes 13, 14 and 15 share the shape `/api/data/:appId/<x>`. A POST to `…/batch` reaches route 15 because the method mismatch on 13 and 14 makes the dispatcher continue (index.js:576).
- A key containing `/` (allowed by data.js:5) can reach routes 13 and 14 only percent-encoded, because params are `[^/]+` (53) and decoded at 577. apps/hub.js writes only through the batch body (apps/hub.js:264).

#### Requested routes that do not exist
| Asked for | Result |
|---|---|
| Push prefs endpoint | NOT FOUND IN CODE (searched `route(` for `prefs`). Prefs are the ordinary data row `app_data(person,'hub','push_prefs')`, written through routes 13–15 and read by `prefsFor` (reminders.js:28-31). |
| Admin devices list | NOT FOUND IN CODE as its own route. The device list is part of `GET /api/admin/usage` (index.js:528). |
| Change own PIN / list sessions / self-unpair | NOT FOUND IN CODE (searched `route(` for `pin`, `sessions`, `devices`). |

### 6.3 Pairing and devices
| Aspect | Where | Detail |
|---|---|---|
| Hash storage | index.js:146; schema.sql:97-100 | D1 `settings` row `key='pairing_code_hash'` |
| Hash format | auth.js:20-24 | `pbkdf2:<iter>:<salt>:<hash>`. PBKDF2-SHA-256 (auth.js:17), `PBKDF2_ITER = 10000` (auth.js:4), 16-byte random salt (auth.js:22), 256-bit output (auth.js:17). |
| Other writer | scripts/set-pairing-code.mjs:8, 12, 18, 37, 43-45 | Node `pbkdf2Sync` with the same format, 10000 iterations, 16-byte salt, the same table, and the 6–64 char rule (37) |
| Check | index.js:148; auth.js:26-38 | `verifySecret(String(code \|\| ''))`. It uses the iteration count stored in the hash (auth.js:28-30) and compares in constant time (auth.js:33-38). |
| Not configured | index.js:147 | 503 `pairing_not_configured` |
| Brute-force guard | index.js:143-152; auth.js:129-145 | Key `pair:<CF-Connecting-IP or 'local'>` (46, 143). Blocked once 10 failures fall inside a fixed 15-minute window that starts at the first failure (auth.js:136-144). Returns 429 with `retry_after` in seconds. |
| Rotation | index.js:508-517 | Admin only. A chosen code must be 6–64 chars (513). A generated code is `randomToken(6)` with `-`/`_` replaced by `x`, sliced to 8 chars (512), and returned once (516). Existing devices are untouched: only `settings` is written (514-515). |
| Device token | index.js:153; auth.js:8-10 | `randomToken()` = 32 random bytes, base64url without padding, 43 chars |
| Device id | auth.js:11; index.js:153 | `randomId()` = 9 bytes, 12 chars |
| Server storage | index.js:154-155; schema.sql:44-50 | `devices(id, name cut to 80, token_hash = SHA-256 base64url (auth.js:12), paired_at, last_seen)`. Only the hash is stored. |
| Client storage | apps/hub.js:27, 130, 161 | `localStorage` key `hub.device`, sent as `X-Device-Token` |
| Lookup | auth.js:74-77 | By `sha256(token)`. A missing or unknown token gives 401 `device_not_paired`. |
| Expiry | auth.js:73-102; schema.sql:44-50 | NOT FOUND IN CODE. There is no device expiry column and no expiry check. |
| last_seen | auth.js:79-82 | Updated in `waitUntil` when more than 5 min stale |
| Unpair | index.js:549-558 | Admin only. Batch-deletes sessions, push subscriptions and the device row. The caller's own device cannot be unpaired (551). |

### 6.4 PINs and sessions
| Aspect | Where | Detail |
|---|---|---|
| PIN rule | index.js:23 | `/^\d{4,8}$/`, enforced at first-tap creation (262) and guest creation (186). Login does not check the format; it runs `verifySecret(String(pin ?? ''))` (242). |
| Hash | auth.js:4-5, 14-24 | Same PBKDF2-SHA-256 format as the pairing code: 10,000 iterations and a 16-byte salt. The comment cites the Workers CPU budget and treats rate limiting as the real defence. |
| Where verified | index.js:238-247 | Only for `kind==='adult'`, except a PIN-less guest (238) |
| No PIN yet | index.js:239 | 403 `needs_pin_setup` |
| Kid / kiosk sign-in | index.js:238, 248 | No PIN branch: a session is issued on tap from any paired device |
| Lockout | index.js:240-246; auth.js:129-145 | Key `login:<profileId>:<deviceId>`. `rateCheck` max 5 (241), so the 6th attempt inside the window gets 429 `too_many_attempts` with `retry_after`. The fixed 15-min window starts at the first failure (auth.js:136-144). Success clears it (246). The limit is per device, not per IP or global. |
| Stale rate-limit rows | auth.js:145; index.js:215 | Removed only by `rateClear` or guest delete. A periodic sweep is NOT FOUND IN CODE (searched `DELETE FROM rate_limits`). |
| Session token | auth.js:119-126 | `randomToken()` = 32 bytes, 43 chars. Stored as SHA-256 in `sessions.token_hash` together with `profile_id`, `device_id`, `created_at` and `expires_at` (schema.sql:53-59). |
| Lifetime | auth.js:6, 124 | `SESSION_MS = 365 days`, fixed. Sliding renewal: NOT FOUND IN CODE (searched `UPDATE sessions`). |
| Validation | auth.js:85-99 | Header `X-Profile-Token`. The row must exist, be unexpired and be bound to the same device (91). An expired guest's token is rejected, and their sessions and subscriptions are purged in the background (94-97). |
| Role freshness | auth.js:87-90 | The profile row is joined on every request, so kind or admin changes apply to live sessions at once. |
| Client storage | apps/hub.js:27, 106, 131 | `localStorage` `hub.session`, sent as `X-Profile-Token` |
| Session removal | index.js:275 (logout), 449 (admin reset-pin), 553 (unpair), 210 (guest delete), 477 (admin ends a guest stay); auth.js:59, 96 (expired guest) | A sweep of expired sessions is NOT FOUND IN CODE (searched `DELETE FROM sessions`). |
| First-tap PIN | index.js:252-268 | Needs the device token only, no session. The target must be `kind==='adult'` (257), not a guest (260), and have `pin_hash IS NULL` (261). A conditional `UPDATE … AND pin_hash IS NULL` handles races (263-265). Returns a session (267). There is no rate limit on this route. |
| After admin reset | index.js:445-451, 252-268 | `pin_hash` becomes NULL and sessions are dropped. Any paired device can then create the next PIN through route 9. |
| Guest PIN | index.js:184-188, 238, 260, 445-451, 473 | Optional at creation (4–8 digits). It cannot be set later through `/pin` (403 `guest_pin_fixed`). Admin reset-pin can clear it, which makes the guest tap-in (238). |
| Kind change and PIN | index.js:473-475 | A change to a non-adult kind nulls `pin_hash`. The route does not delete the profile's sessions (only a guest-expiry change does, 477). |

#### Escalation guards
| Guard | Where |
|---|---|
| `is_admin` is not writable through any route: admin PUT reads only name, emoji, colour, kind, sort_order and `expires_at` | index.js:458-467, 474; no `SET is_admin` or `is_admin =` in worker/src |
| Guests are inserted with `is_admin = 0` and kind `adult` | index.js:197-198 |
| The admin must stay an adult; a guest must stay an adult | index.js:471-472 |
| Only adults have PINs | index.js:257 |
| Kids and kiosk cannot add guests; guests cannot invite | index.js:175-177 |
| A session is bound to its device | auth.js:91 |
| Person scope is always the caller's own `profile.id` | data.js:15 |
| `publicProfile` exposes `has_pin`, never `pin_hash` | auth.js:64-70 |

### 6.5 Read-only and role enforcement server-side
| Rule | Enforced at | Covers |
|---|---|---|
| Kiosk cannot write (`read_only` 403) | auth.js:108-112 (`requireWriter`) | POST /api/profiles (index.js:175); data PUT, DELETE and batch through `dataArgs(…, true)` (282; 301, 306, 312); photo PUT/DELETE (334); album POST (362) and DELETE (374); POST /api/activity (394) |
| Kiosk has no chat | index.js:431; chat.js:391 | POST /api/chat |
| Kiosk, kids and guests cannot rally | index.js:90-94 | POST and DELETE /api/dollywood/rally |
| Kiosk not blocked | index.js:412, 423, 535, 442, 272-277 | Push subscribe/unsubscribe, push test, chat history and logout use only `requireProfile` or `c.auth()` |
| Kid: no guests | index.js:176 | POST /api/profiles |
| Kid: no own photo | index.js:336 | Photo PUT/DELETE |
| Kid: no album upload | index.js:363 | POST /api/album |
| Kid: chat tool whitelist | chat.js:52, 161 | `list_apps`, `get_data`, `set_data`, `add_list_item`, `read_todays_verse` only |
| Kid: `set_data` limited to visible, non-restricted apps | chat.js:174 | Chat |
| Kid: no house reminders | chat.js:193 | Chat (`add_list_item` on `reminders`) |
| `read_todays_verse` kids only | chat.js:303 | Chat |
| Chat app visibility | chat.js:395, 118-119, 158, 166, 175 | Computed from the client-sent `body.apps` list (its `visibleTo`), capped at 40 apps. `get_data`/`set_data` also allow `reminders` and `hub` regardless (166, 175). |
| Kid or `visibleTo` restrictions on `/api/data/*` | index.js:280-318; data.js | NOT FOUND IN CODE (searched index.js and data.js for `kid` and `visibleTo`). Any non-kiosk session can read and write any `app_id` in family scope and in its own person scope. |
| Family-scope reads with no session | index.js:282 | With `scope=family` and no writer requirement, `auth.profile` may be null, so a device token alone can read family rows |
| Guest restrictions | index.js:177, 92, 260, 472, 236; auth.js:94-97; index.js:163-166 | No inviting, no rally, fixed PIN, always adult, expired guests cannot log in or keep sessions, and they are hidden from non-admins |
| Admin-only | auth.js:113-117, called at index.js:446, 454, 484 (routes 31–32), 503, 509, 520, 537 (conditional), 542, 550 | All `/api/admin/*` routes and push-test to another profile |
| Admin overrides | index.js:163, 335-336, 379 | Sees expired guests; edits anyone's photo, a kid's included; deletes anyone's album photo |

### 6.6 Data sync server side
| Aspect | Where | Detail |
|---|---|---|
| Table | schema.sql:30-42 | `app_data(id, scope, profile_id, app_id, key, value TEXT JSON or NULL, updated_at, synced_at)`. Unique index `(scope, IFNULL(profile_id,''), app_id, key)` (41); pull index (42). |
| Scope check | data.js:7-10; index.js:281 | `person` or `family`, default `person` |
| Owner | data.js:15 | Person scope uses the caller's `profile.id`; family uses NULL. The SQL uses `profile_id IS ?` (data.js:22, 30, 47). |
| Key rule | data.js:5, 11-14 | `/^[A-Za-z0-9_.:\-\/]{1,200}$/`, applied to `appId` (index.js:283), `key` (301, 306, 316, 294) and activity `app_id` (399) |
| Pull cursor | data.js:17-26; index.js:289, 293 | `since` compares against `synced_at` (server clock, `synced_at > ?`), ordered by `synced_at, id`. The response `now = Date.now() - 1` is taken before the query (293) and becomes the next `since`. |
| Prefix filter | data.js:24; index.js:290 | `LIKE prefix%` with `\ % _` escaped |
| Pull paging | data.js:18-26 | NOT FOUND IN CODE. `listData` has no LIMIT. |
| Single get | index.js:294; data.js:28-33 | `?key=` returns `{item, now}` and ignores `since` |
| Value | data.js:42; index.js:300-301 | Any JSON. A missing or `null` `value` in a PUT body is stored as a tombstone. |
| Value size | data.js:4, 42-43 | `MAX_VALUE_BYTES = 900*1024`, measured on the JSON string's `.length`. Over it gives 413 `value_too_large`. |
| Batch | index.js:310-318 | `items` must be an array of at most 200 (314). Each item is a separate `putOne`, run in sequence (316) with no transaction. A bad key or an oversize value in one item throws and aborts the rest, and earlier items stay written. Returns `{results, now}`. |
| LWW timestamp | data.js:41 | The client `updated_at`, clamped to at most now + 5 min. An invalid or ≤0 value falls back to server now. |
| LWW compare | data.js:60-64 | Writes only if `ts > cur.updated_at` (strict). A tie or an older write returns the server row with `applied:false`. |
| Insert race | data.js:45-59, 66 | On a UNIQUE failure it re-reads. After 2 attempts it returns 500 `write_conflict`. |
| `synced_at` | data.js:53, 61 | Set to server `Date.now()` on every applied write |
| Tombstones | data.js:1, 42; index.js:306 | A `null` or `undefined` value is stored as NULL and returned in pulls as `value:null` (data.js:25). DELETE stamps server now. |
| Tombstone GC | worker/src | NOT FOUND IN CODE. The only `DELETE FROM app_data` is the guest person-scope purge (index.js:209). |
| Rate limits on data routes | index.js:286-318 | NOT FOUND IN CODE |
| Activity writes | index.js:393-403; chat.js:122-124; index.js:199-200 | POST /api/activity (text cut to 200), plus the server helper `activity()` (cut to 200) used by rally (113, 137) and chat tools (e.g. chat.js:178, 189, 197). Guest creation inserts directly. |
| Activity reads | index.js:321-329 | Every profile's rows, `created_at DESC, id DESC`, limit 1–100 |
| Activity pruning | worker/src | NOT FOUND IN CODE, apart from the guest purge (index.js:214) |

### 6.7 Media
| Aspect | Where | Detail |
|---|---|---|
| Backend choice | media.js:24-28, 30-37, 39-42 | R2 when `env.MEDIA` is bound; otherwise the D1 `media` table (schema.sql:20-26). wrangler.toml has no R2 binding, so D1 is the configured path. |
| Photo keys | index.js:345-348 | `photos/<profileId>/<token>-256.jpg` and `-1024.jpg`. `token = randomId()` (9 bytes, 12 chars) is stored in `profiles.photo`. |
| Album keys | index.js:366-369 | `album/<id>-256.jpg` and `-1024.jpg`, with `id = randomId()`. The metadata row is `app_data(family,'hub','album:<id>')` (370). |
| Public URLs | auth.js:69; index.js:328, 369 | `/api/media/photos/<id>/<token>-256.jpg` and the like, plus the album `sm`/`lg` paths. `photoUrls` (media.js:45) is exported but not imported (index.js:21). |
| Size limits | media.js:11-12, 19 | The 256 px image may be at most `80*1024` bytes and the 1024 px image at most `420*1024` bytes, measured after decoding. Over the limit gives 413 `image_too_large`. |
| Type check | media.js:14-21 | Needs a non-empty base64 string (15), with any `data:` prefix stripped (16). It must decode (18) and start with the JPEG magic bytes `FF D8` (20). The stored mime is always the default `image/jpeg` (24). |
| Serve path check | index.js:387 | `/^(photos\|album)\/[\w-]+(\/[\w-]+)?\.jpg$/`; anything else gives 404 |
| Serve headers | index.js:390 | `Content-Type` from the store, `Cache-Control: public, max-age=31536000, immutable`, `Access-Control-Allow-Origin: *`. There is no auth (the comments at media.js:5-7 and index.js:332 rely on unguessable keys). |
| Replace / delete | index.js:349, 357, 380-381 | A new photo deletes the old `photos/<id>/<old>-` prefix in `waitUntil`. DELETE removes the whole `photos/<id>/`. Album delete tombstones the row and removes `album/<id>-`. |
| Guest purge | index.js:207 | Deletes `photos/<guestId>/`. Album files and family album rows the guest uploaded are not removed by `deleteGuest` (206-218). |
| Prefix delete | media.js:39-42 | R2 list plus delete, or D1 `LIKE` with escaping |

### 6.8 Error handling
| Aspect | Where | Detail |
|---|---|---|
| Error type | auth.js:40-42 | `HttpError(status, error, message, extra)` |
| JSON shape | index.js:584 | `{error, message, ...extra}` with the HttpError status, CORS headers and `Cache-Control: no-store` (40) |
| Unhandled | index.js:585-586 | `console.error('unhandled', stack)`, then 500 `{error:'internal', message:'Something went wrong on the server.'}`. This also covers bad percent-encoding (577) and a non-JSON upstream waits body (72). |
| Bad JSON body | index.js:42-45 | 400 `bad_json`. A JSON `null` body becomes `{}`. |
| Retry hint | auth.js:133; chat.js:400 | `retry_after` (seconds), or `used`/`cap`, in the body. An HTTP `Retry-After` header is NOT FOUND IN CODE (searched worker/src). |
| Chat after stream start | chat.js:413-450, 441-442 | The Anthropic call runs only inside `run()` (418-448), which starts through `waitUntil` (449) after the SSE `Response` is built (450). So the HTTP status is already 200, and every failure there (Anthropic non-OK at 350-353, a stream `error` event at 380, anything else) arrives as `event: error` `{error, message}`. `error` is `upstream` for those HttpErrors, otherwise `chat_failed` (442). |
| Push results not errors | reminders.js:36; index.js:118-129 | `pushTo` returns 200 `{sent:0, ok:0, error:'vapid_not_configured'}` when VAPID is unset. Rally reports push failures under `skipped`, never as a 500. |
| Logging | index.js:127, 585, 596, 598-600; chat.js:352 | `console.error` for rally push, unhandled errors, cron and Anthropic errors. `console.log` for cron results and purged guests. `[observability] enabled` (wrangler.toml:13-14). Per-request access logging is NOT FOUND IN CODE. |

#### Status codes and error codes
| Status | `error` codes (file:line) |
|---|---|
| 400 | `bad_json` index.js:44; `bad_scope` data.js:8; `bad_key` data.js:12; `bad_image` media.js:15,18,20; `bad_name` index.js:104,180,468; `bad_point` 106; `bad_color` 183,469; `bad_pin` 186,262; `bad_expiry` 192,466; `no_pin_for_kind` 257; `bad_batch` 314; `bad_text` 397; `bad_subscription` 414; `bad_kind` 470; `admin_must_be_adult` 471; `guest_must_be_adult` 472; `not_a_guest` 487; `not_expired` 497; `bad_code` 513; `bad_job` 544; `cannot_unpair_self` 551; `bad_message` chat.js:394 |
| 401 | `device_not_paired` auth.js:75,77; `profile_session_invalid` auth.js:92,97; `profile_required` auth.js:105; `bad_pairing_code` index.js:150; `wrong_pin` index.js:244 |
| 403 | `read_only` auth.js:110; `admin_only` auth.js:115; `adults_only` index.js:92,176,336,363; `guests_cannot_invite` 177; `guest_expired` 236; `needs_pin_setup` 239; `guest_pin_fixed` 260; `not_yours` 335,379; `no_chat` 431, chat.js:391 |
| 404 | `no_such_profile` index.js:235,256,342,355,448,457,486; `no_such_photo` 377; `not_found` 387,389,582 |
| 405 | `method_not_allowed` index.js:581 |
| 409 | `pin_already_set` index.js:261,265 |
| 413 | `value_too_large` data.js:43; `image_too_large` media.js:19 |
| 429 | `too_many_attempts` auth.js:133; `daily_cap` chat.js:400 |
| 500 | `write_conflict` data.js:66; `internal` index.js:586 |
| 502 | `upstream` index.js:68 |
| 503 | `pairing_not_configured` index.js:147; `chat_not_configured` chat.js:390 |
| SSE `event: error` (HTTP 200) | `upstream` chat.js:353 (Anthropic non-OK, including 429), chat.js:380 (stream error); `chat_failed` chat.js:442 (any other throw) |

## 7. Cloudflare Worker — chat, push, reminders, database

### 7.1 Chatbot (chat.js)

#### Configuration and key

| Item | Value | Evidence |
|---|---|---|
| Model id | `'claude-sonnet-5'` (constant `MODEL`) | worker/src/chat.js:14; used at worker/src/chat.js:421 |
| Other request params | `max_tokens: 800` (`MAX_TOKENS`), `thinking: {type:'adaptive'}`, `output_config: {effort:'low'}`, `anthropic-version: 2023-06-01` | worker/src/chat.js:15, 421, 347 |
| Endpoint | `env.ANTHROPIC_BASE_URL` or `https://api.anthropic.com`, trailing slash stripped, then `/v1/messages` | worker/src/chat.js:345. `ANTHROPIC_BASE_URL` is not among the wrangler vars (worker/wrangler.toml:6-11) |
| API key source | `env.ANTHROPIC_API_KEY` only, sent as the `x-api-key` header from the Worker | worker/src/chat.js:347 |
| Missing key | HTTP 503 `chat_not_configured` before any stream starts. The message names the secret, not its value | worker/src/chat.js:390 |
| Client exposure | Only a boolean `enabled: !!c.env.ANTHROPIC_API_KEY` reaches the client (worker/src/chat.js:456). The client shows "The assistant is not set up yet…" (index.html:1473) and blocks sending while `!chatEnabled` (index.html:1488). A repo search for `ANTHROPIC_API_KEY\|x-api-key\|sk-ant\|api.anthropic.com` (excluding `.dev.vars`) matches only CLAUDE.md, worker/README.md, worker/src/chat.js and scripts/mock-anthropic.mjs. Nothing in index.html, apps/ or sw.js | — |
| Upstream error text to client | Anthropic's error message (≤300 chars) is embedded in the user-facing error: "The assistant is unavailable right now (<msg>)." | worker/src/chat.js:351-353, 442; index.html:1499 |
| Route guards | `requireProfile`, then kiosk gets 403 `no_chat` | worker/src/index.js:430-431; worker/src/chat.js:391 |
| History route guard | `GET /api/chat/history` only calls `requireProfile`, so the kiosk is not blocked on the server. The client skips opening chat for the kiosk | worker/src/index.js:442; index.html:1465 |
| Guest handling | For a guest, the route adds the guest's id to `visibleTo` on every client-sent app whose `visibleTo` names any household adult (`kind='adult' AND is_guest=0`) | worker/src/index.js:432-439 |

#### Daily cap

| Aspect | Detail | Evidence |
|---|---|---|
| Value | `DAILY_CAP = 60` | worker/src/chat.js:16 |
| Scope | Per `profile_id`: `role='user'` rows in `chat_log` whose New York date is today. The scan window is the last 36 h | worker/src/chat.js:112-117 |
| Enforced | On the server, before the user row is inserted. `used >= DAILY_CAP` returns HTTP 429 `daily_cap` with extra `{used, cap}`, which the dispatcher spreads into the JSON body | worker/src/chat.js:399-400; worker/src/auth.js:41; worker/src/index.js:584 |
| Counted when | The user message is written to `chat_log` before the model call, so a message whose upstream call fails still counts | worker/src/chat.js:411 |
| Server message | "That's 60 messages for today — the assistant is resting until tomorrow." | worker/src/chat.js:400 |
| What the user sees | On a 429 the client calls `setCap(j.used, j.cap)` and throws. The message then appears in an error-styled bot bubble (`.msg.bot.err`, `--danger` border and ink) | index.html:1503, 1516, 251 |
| Counter and lockout | The counter reads "N/60 today". At the cap the input is disabled with the placeholder "Back tomorrow — that is enough for today." It is set from history on open, from `done.used` after each reply (so it locks straight after the 60th reply) and from the 429 body | index.html:1460-1463, 1482, 1498, 1503 |
| Per-minute rate limit on chat | NOT FOUND IN CODE. Searched worker/src/chat.js and the `/api/chat` route (worker/src/index.js:429-441) for `rateCheck`; neither calls it. The only throttle is on the client: `chatBusy` allows one request in flight per tab (index.html:1488-1489, 1517) | — |

#### Streaming

| Leg | Mechanism | Evidence |
|---|---|---|
| Worker → Anthropic | `fetch` with `stream: true`. The SSE body is parsed by hand: split on `\n\n`, then each `data:` line goes through `JSON.parse` (bad lines are skipped) | worker/src/chat.js:344-366 |
| Event handling | `text_delta` is forwarded at once. `input_json_delta` is accumulated. Thinking and other block types are marked `skip`, dropped from `content`, and not re-sent in the next turn. Other event types, such as `ping`, are ignored | worker/src/chat.js:371-383, 428 |
| Worker → client | A `TransformStream` carries SSE. The events are `text {text}`, `tool {name,input,chip,ok,speak?,text?}`, `done {usage:{input,output},stop_reason,used,cap}` and `error {error,message}`. The header comment lists `done` as `{usage, stop_reason}` only | worker/src/chat.js:4-9 (comment), 413-415, 433, 440, 442 |
| Response | Headers are `text/event-stream`, `no-store` and `X-Accel-Buffering: no`, plus CORS. The work runs in `c.exec.waitUntil(run())` | worker/src/chat.js:449-450 |
| Tool loop | At most `MAX_TURNS = 6` model round-trips per message. If the 6th turn still ends in `tool_use`, its tools are executed (writes happen) but the loop exits without sending the results back to the model, and `done` carries `stop_reason: 'tool_use'` | worker/src/chat.js:18, 422-440 |
| Client reader | `fetch` then `getReader()`, with the same `\n\n` split, parsing `event:` and `data:` lines | index.html:1502-1515 |
| Keep-alive or heartbeat events | NOT FOUND IN CODE. Searched worker/src for `ping\|heartbeat\|keep-alive`; the Worker sends only text, tool, done and error | — |

#### Upstream errors and timeouts

| Case | Behaviour | Evidence |
|---|---|---|
| Non-2xx from Anthropic | The upstream message (≤300 chars) is logged with `console.error`. The Worker throws `HttpError(429→503, else 502, 'upstream', 'The assistant is unavailable right now (<msg>).')` | worker/src/chat.js:350-353 |
| An `error` event in the stream | `HttpError(502,'upstream', msg)` | worker/src/chat.js:380 |
| Any throw inside `run()` | Becomes an SSE `error` event with `message`. The HTTP status is already 200. The client adds the `err` class and appends the message | worker/src/chat.js:441-442, 450; index.html:1499 |
| `stop_reason === 'max_tokens'` | Appends `' …'` | worker/src/chat.js:439 |
| Invalid tool JSON | The tool result becomes `'tool input was not valid JSON'`, with `is_error` | worker/src/chat.js:385, 431, 434 |
| Timeout or abort on the upstream fetch | NOT FOUND IN CODE. Searched worker/src for `timeout\|AbortSignal\|AbortController\|signal` | — |
| Retry or backoff | NOT FOUND IN CODE. Searched worker/src for `retry\|backoff`; the only hit is the rate limiter's `retry_after` (worker/src/auth.js:132-133) | — |
| Partial reply on error | Whatever text streamed before the error is still saved to `chat_log` in `finally` | worker/src/chat.js:443-445 |

#### TOOLS

Every tool is defined in `TOOLS` (worker/src/chat.js:25-49). The kid allow-list is `KID_TOOLS = ['list_apps','get_data','set_data','add_list_item','read_todays_verse']` (worker/src/chat.js:52). No tool is reachable by the kiosk, because the route returns 403 (worker/src/index.js:431; worker/src/chat.js:391).

| Tool | Def line / handler | What it does | Writes? | Kid allowed? | Kiosk? |
|---|---|---|---|---|---|
| `list_apps` | 26 / 163 | Lists visible apps as `{id,name,scope}` | No | Yes | No |
| `get_data` | 27-28 / 165-171 | Reads one key, or lists up to 60 live rows of an app in person (own) or family scope. `*.vault` keys are dropped from listings (169) but not from single-key reads (168). Values over 4000 chars are replaced by a size note (19, 159) | No | Yes: visible apps plus `reminders` and `hub` (166) | No |
| `set_data` | 29-30 / 173-180 | Writes any key and value (except `*.vault`), then the activity line "Changed <key> in <app> (via chat)" | Yes | Only for apps that are in the client list and have no `visibleTo` (174; `adultOnly` at 119). Today those are leftovers, tally, timer and dollywood-live (apps.json:5, 7, 8, 10). `reminders` and `hub` are not apps.json ids, so they are refused for kids | No |
| `add_list_item` | 31-32 / 182-201 | Leftovers: `item:<id>` `{id,name,size,dateLogged,by,byName}`. Reminders: `item:<id>` `{id,text,by,byName,createdAt}`. Both family scope | Yes | Leftovers yes, if the kid can see leftovers (185). Reminders refused (193) | No |
| `toggle_f260_reading` | 33-34 / 203-222 | Toggles `f260.done["week-(day-1)"]`. When checked, adds today to `f260.log`. Patches `f260.summary` if that row exists | Yes | No (161) | No |
| `add_prayer` | 35-36 / 224-234 | New `prayer:c<rid>` row, private (person) or family. Sets no `by` field (229-230) | Yes | No | No |
| `mark_prayed` | 37-38 / 236-255 | Sets `lastPrayedAt`. On the family list only, adds the name to `prayedBy[today]`. On either list, adds today to that list's `prayerDays` row. Active prayers only (243) | Yes | No | No |
| `answer_prayer` | 39-40 / 236-241, 256-260 | `status='answered'`, `answeredAt`, `answerNote` (≤1000 chars). Refuses if already answered (256); does not require `active` | Yes | No | No |
| `finish_leftover` | 41-42 / 263-282 | Loose name or id match, then a tombstone (`value: null`). With no match it returns the whole fridge list (276) | Yes | No | No |
| `where_is_family` | 43-44 / 284-291 | `dollywood-live` `loc:*` rows fresher than 4 h: name, x/y, minutesAgo, ISO time, `accuracyM`. No `canUse` check | No | No | No |
| `f260_status` | 45-46 / 293-300 | The person's `f260.summary`: week, weekDone, total, streak, readToday, next, finished and the memory-verse refs | No | No | No |
| `read_todays_verse` | 47-48 / 302-308 | The family week (furthest adult `f260.summary.week`, 148-153), with refs and gists from the `MV` table (56-109, via `versesFor` 110). Returns `speak`, which the client reads aloud for kids only (433; index.html:1456-1459, 1497) | No | Kids only; adults are refused (303) | No |

#### runTool validation and permission checks

| Check | Evidence |
|---|---|
| Kid gate: any tool outside `KID_TOOLS` returns a refusal string and never throws | worker/src/chat.js:161 |
| App visibility `canUse` comes from the client-supplied `body.apps` (≤40 entries, each with `visibleTo`) through `visibleApps()`. The client builds that list from `registry.apps` | worker/src/chat.js:118, 158, 395; index.html:1494 |
| `get_data` and `set_data` exempt `reminders` and `hub` from the visibility check (for kids, `set_data` still requires `canUse`, 174) | worker/src/chat.js:166, 174-175 |
| `set_data` refuses keys ending in `.vault` | worker/src/chat.js:176 |
| `set_data` key format (`KEY_RE`, worker/src/data.js:5): chat.js never calls `checkKey`. It is called only in index.js routes (worker/src/index.js:283, 294, 301, 306, 316, 399) | worker/src/chat.js:173-180 |
| Scope: `putOne` does not call `checkScope`, so scope relies on the tool-schema enum and the DB CHECK (worker/schema.sql:32). A failure is caught as "Tool failed: …" | worker/src/data.js:15, 39-67; worker/src/chat.js:310-311 |
| Value size: `putOne` rejects JSON over 900 KB with 413 `value_too_large`, surfaced as "Tool failed: …" | worker/src/data.js:4, 43 |
| LWW outcome: `putOne` returns `applied:false` when the stored row is newer. No chat tool checks it, so each reports success anyway | worker/src/data.js:60-64; worker/src/chat.js:177-179, 188-190, 210, 248, 258-260, 279-281 |
| Server-side JSON-schema validation of tool input: NOT FOUND IN CODE (searched chat.js for `validate\|ajv`). Inputs are used directly, e.g. week and day at 205 and size at 187 | — |
| Required fields: leftovers name (186), reminder text (194), prayer text (226), prayer id or title (130), leftover id or name (271) | worker/src/chat.js |
| No match: the tool returns the list of candidates (prayers ≤30, or every leftover) | worker/src/chat.js:142, 276 |
| Ambiguity: several matches return the list and ask the model to pick one | worker/src/chat.js:143, 277 |
| All writes go through `putOne` with `updated_at: Date.now()` and are followed by `activity(... '(via chat)')` | worker/src/chat.js:177-178, 188-189, 196-197, 210-220, 231-232, 248-253, 258-259, 279-280 |
| Exceptions become `{ok:false, result:'Tool failed: …'}` | worker/src/chat.js:310-311 |

#### systemPrompt(): data sent with every request

| Included | Content | Evidence |
|---|---|---|
| Household | Every row of `profiles` (`SELECT name, kind, is_admin … ORDER BY sort_order`, no WHERE), rendered as `Name (kind[, admin])`. This includes the kiosk, guests and expired guests; `is_guest` is not selected | worker/src/chat.js:402, 317, 320 |
| Signed-in person | `profile.name`, `profile.kind` and `profile.isAdmin`. The auth profile is the raw DB row (`SELECT p.*`), which has `is_admin` but no `isAdmin`, so ", admin" never prints on this line | worker/src/chat.js:321; worker/src/auth.js:87-99 |
| Date | Today in America/New_York | worker/src/chat.js:322 |
| Apps | Visible apps as `- id: name [scope data]` | worker/src/chat.js:318, 324-325 |
| Conventions | Row-key conventions for leftovers, reminders, prayers and F260 | worker/src/chat.js:326 |
| Behaviour rules | Short replies, tool usage hints, and `where_is_family` "only while the family is at the park" | worker/src/chat.js:328-335 |
| Kid addendum | Simple, warm, safe language; no medical, legal or financial advice; how to use `read_todays_verse`; grown-up tools refuse | worker/src/chat.js:336-340 |
| Not in the prompt | Lists, prayers, locations, F260 progress, photos and colours are not in the system prompt. They reach the model only through tool results (e.g. worker/src/chat.js:142, 169-170, 276, 287-290) | — |

#### History and message limits

| Limit | Value | Evidence |
|---|---|---|
| User message | Trimmed and cut to 2000 chars. Empty gives 400 `bad_message` | worker/src/chat.js:393-394 |
| Apps from client | ≤40 entries | worker/src/chat.js:395 |
| History sent to the model | Up to 200 rows from the last 36 h, then the newest `HISTORY = 20` of those, oldest first. It is trimmed to start with a user turn, consecutive same-role turns are merged and a trailing user turn is dropped | worker/src/chat.js:17, 398, 403-408 |
| History shown in the Chat tab | The last 20 rows with no age limit (`GET /api/chat/history`). Lines starting with ✓ become chips | worker/src/chat.js:454-457; index.html:1475-1480 |
| Stored assistant row | Final text (or the joined chips) is cut to 4000 chars, then a chips line is appended after the cut, so a row can exceed 4000. Tool-use and tool-result blocks are not stored | worker/src/chat.js:444-445 |
| Tool round-trips | 6 | worker/src/chat.js:18 |
| Large values | Values over 4000 chars are summarised | worker/src/chat.js:19, 159 |
| Activity text | ≤200 chars | worker/src/chat.js:123 |

#### Chat usage logging

| What | Evidence |
|---|---|
| A `chat_log` row per user message (before the call) and per assistant reply (in `finally`, errors swallowed) | worker/src/chat.js:411, 445 |
| Token usage is sent to the client in `done` only. Persisted usage is NOT FOUND IN CODE (searched chat.js for `usage`) | worker/src/chat.js:440 |
| `console.error('anthropic error', status, msg)` | worker/src/chat.js:352 |
| Admin usage: `chat_log` user rows per profile per UTC day (`date(created_at/1000,'unixepoch')`), last 30 days. The cap counts by New York date (worker/src/chat.js:112-116) | worker/src/index.js:519-524 |
| `chat_log` is deleted only when a guest is deleted; there is no age-based pruning (grep `chat_log` in worker/) | worker/src/index.js:212 |
| Workers observability is enabled | worker/wrangler.toml:13-14 |

### 7.2 Push (push.js)

| Aspect | Detail | Evidence |
|---|---|---|
| Crypto | WebCrypto only; no npm dependencies | worker/src/push.js:1-3 |
| RFC 8291 ECDH | Ephemeral P-256 key pair; `deriveBits` against the subscription's `p256dh` | worker/src/push.js:20-25 |
| RFC 8291 key derivation | `ikm = HKDF(salt=auth, ikm=shared, "WebPush: info\0"‖ua_pub‖as_pub, 256)`. The salt is 16 random bytes. CEK is `HKDF(salt, ikm, "Content-Encoding: aes128gcm\0", 128)`. The nonce is `HKDF(..., "Content-Encoding: nonce\0", 96)` | worker/src/push.js:10-13, 27-30 |
| Record | A single record: payload plus the `0x02` delimiter, no padding, AES-GCM. Header = salt‖rs=4096‖idlen‖as_pub | worker/src/push.js:32-37 |
| Payload size check | NOT FOUND IN CODE. Searched push.js for a length or size guard | — |
| Headers | `Content-Encoding: aes128gcm` and `Content-Type: application/octet-stream` | worker/src/push.js:38 |
| VAPID (RFC 8292) | The private `d` is imported as a JWK with x/y taken from the public key. ES256 JWT with `aud` = endpoint origin, `exp` = now + 12 h, `sub` = subject. Signed afresh for every send, with no caching | worker/src/push.js:42-49, 59 |
| Authorization header | `vapid t=<jwt>, k=<publicKey>` | worker/src/push.js:50 |
| Key sources | `VAPID_PRIVATE_KEY` (a secret) and `VAPID_PUBLIC_KEY`. `VAPID_SUBJECT` is set in wrangler.toml:11 and falls back to `mailto:hub@example.com`. Without keys, `pushTo` returns `vapid_not_configured` | worker/src/reminders.js:21-22, 35-36; worker/wrangler.toml:9-11 |
| TTL / Urgency | Defaults are `ttl = 86400` and `urgency = 'normal'`, sent as the `TTL` and `Urgency` headers. Per-kind overrides are in 7.3 | worker/src/push.js:57, 62 |
| Result | `{ok: 2xx, status, gone: 404\|410, error: body ≤200 chars}`. A network error gives `{status:0, gone:false}` | worker/src/push.js:61-66 |
| Exceptions | `encrypt()` and `vapidHeader()` run outside the try (push.js:58-59). A bad `keys` object or endpoint throws out of `pushTo`, which has no catch. In cron this aborts the rest of that job (worker/src/reminders.js:258). Rally catches it per recipient (worker/src/index.js:121-128). `/api/push/test` returns a 500 `internal` (worker/src/index.js:585-586) | worker/src/push.js:57-66; worker/src/reminders.js:41 |
| Dead subscriptions | Rows marked `gone` are deleted. A row whose JSON does not parse or has no `endpoint` is treated as gone and deleted | worker/src/reminders.js:40-43 |
| Fan-out | `pushTo` sends to every `push_subscriptions` row of the profile, one per device | worker/src/reminders.js:34-48 |
| `push_log` | One row per `pushTo` call, only if the profile has at least one subscription. `ok` = 1 if any device succeeded, else 0. Admin usage groups it by profile, kind and UTC day | worker/src/reminders.js:46; worker/src/index.js:525-527 |
| Subscribe / unsubscribe | Upsert on `(profile_id, device_id)`; `requireProfile`. Only `subscription.endpoint` is validated (a string); `keys` is not. Delete is scoped to this device | worker/src/index.js:410-426, 414; worker/schema.sql:76 |
| Config endpoint | Returns `{public_key, enabled}` | worker/src/index.js:406-409 |
| Other deletions | Unpairing a device deletes its subscriptions (worker/src/index.js:554). Expired guests' subscriptions are deleted before each cron run, on use of an expired guest session, and when the admin ends a stay (worker/src/auth.js:53-61, 94-96; worker/src/index.js:477, 596). A guest delete removes them too (worker/src/index.js:211) | — |

### 7.3 Reminders (reminders.js)

#### runCron gating

| Aspect | Detail | Evidence |
|---|---|---|
| Triggers | `["0 12,13 * * *", "0 0,1 * * *"]` (UTC): four invocations a day | worker/wrangler.toml:24-25 |
| Timezone | `Intl.DateTimeFormat` with `America/New_York` supplies date, hour and weekday | worker/src/reminders.js:13-18 |
| Hour 8 NY | `['morning']` | worker/src/reminders.js:253 |
| Hour 20 NY | `['evening']`, plus `'behind'` if the weekday is `'Sun'` | worker/src/reminders.js:253 |
| Any other hour | Returns `{job:null, skipped:true, nyHour}` | worker/src/reminders.js:254 |
| Always added on the 8 and 20 runs | `'prayer'` and `'park'` | worker/src/reminders.js:255 |
| Error isolation | Each job is wrapped in try/catch and `{job, error}` is pushed onto the results | worker/src/reminders.js:256-259 |
| Force | `POST /api/admin/cron/run {job}` (admin only) validates the name, silences expired guests, then runs one of `morning\|evening\|behind\|prayer\|park` whatever the clock says | worker/src/reminders.js:240, 249-252; worker/src/index.js:541-547 |
| Before and after every invocation | `silenceExpiredGuests` runs before `runCron`. `purgeExpiredGuests` (which silences again, then deletes guests expired more than 30 days) runs after, on every invocation whatever the hour | worker/src/index.js:593-601, 173, 223-229 |
| Logging | `console.log('cron', event.cron, JSON.stringify(out))` | worker/src/index.js:598 |

#### Shared gate: `notify()`

| Rule | Evidence |
|---|---|
| Prefs: `app_data(person,'hub','push_prefs')` merged over `PREF_DEFAULTS = {leftovers, f260, behind, prayer, park}`, all true. Off means `skipped: pref_off` | worker/src/reminders.js:25-31, 60 |
| Dedupe: the latest `push_log` row for the same (profile, kind) in the last 24 h, with the same New York date, means `skipped: already_today`. `push_log` is also written when every device fails (ok=0), so a failed send counts as sent for the day | worker/src/reminders.js:50-54, 61, 46 |
| `adultIds`: every `kind='adult'` profile, with no `is_guest` or expiry filter, so guests are included. Expired guests have had their subscriptions removed (worker/src/index.js:596) | worker/src/reminders.js:56 |
| The Me-tab toggles write the same five keys | index.html:1536-1541 |
| Visibility of the toggles: leftovers (adults), f260 (anyone who can see f260), behind (adults who can see f260), prayer (adults who can see prayer), park (adults who can see dollywood-live) | index.html:1265-1269 |

#### Jobs

| Job | Trigger | Audience | Content (title / body / url / tag) | TTL / urgency | Dedupe | Pref key | Lines |
|---|---|---|---|---|---|---|---|
| `morningJob` | 8 am NY | `adultIds` (all adults, including guests) | "Larder Ledger". One item: "`<name>` is N days old — use it up." Several: "N to use up: a (Nd), …" (first 4, then an ellipsis). `#leftovers`, tag `leftovers` | 6 h / normal | notify, kind `leftovers` | `leftovers` | worker/src/reminders.js:66-79. The filter is `days >= 5` (69); the header comment says "within two days" (2) |
| `eveningJob` | 8 pm NY | Every profile with an `f260.log`, `f260.summary` or `f260.weekStart` person row (no kind filter), unless it read today or `finished` | "F260". "No reading checked off today yet. `<ref>` is next (week W, day D)." or "…Your next reading is waiting." `#f260`, tag `f260` | 3 h / normal | notify, kind `f260` | `f260` | worker/src/reminders.js:82-101 |
| `behindJob` | 8 pm NY on Sundays | Adults only (`adultIds`) with F260 rows | "F260 · weekly catch-up". "You are N readings behind — `<ref>` is next." Sent only when behind ≥ 2 and the current week started more than 3 days ago. `#f260`, tag `behind` | 12 h / normal | notify, kind `behind` | `behind` | worker/src/reminders.js:103-136 |
| `prayerJob` | Both the 8 am and 8 pm runs | Every adult except the author. The author comes from `by`, `addedBy`, `author` or `createdBy`, or else from a matching activity line since the last run minus 1 h. An unknown author means everyone. Chat's `add_prayer` sets no `by` (worker/src/chat.js:229-230), but its activity text matches (worker/src/chat.js:232 ↔ worker/src/reminders.js:189) | "Prayer". "New on the family list: `<title>` (for X)." or "N new on the family list: a, b, c…." `#prayer`, tag `prayer` | 12 h / normal | Watermark `settings.last_prayer_push_at = {at, seen:{key: createdAt\|title}}`, advanced before sending (182). The first run only seeds it (180). Plus notify, kind `prayer`, so an adult pushed at 8 am is skipped `already_today` at 8 pm, and those later prayers are never announced | `prayer` | worker/src/reminders.js:138-206 |
| `parkJob` | Both the 8 am and 8 pm runs only | All adults (`adultIds`), when it is a park day (any `loc:<profileId>` marker of a known profile under 4 h), an adult marker is ≤30 min old and a kid marker is between 30 min and 4 h old. Age uses the row's `t` capped at now, else `updated_at` | "Dollywood park map". "`<Kid>`'s spot has not updated for N min." or "A's spot and B's spot have not updated (…)." `#dollywood-live`, tag `park` | 1800 s / high | notify, kind `park` | `park` | worker/src/reminders.js:208-238 |
| Rally | `POST /api/dollywood/rally` (on demand) | Household adults except the sender (`kind='adult' AND is_guest=0 AND id != me`) | "Meet at `<name>`". "`<Me>` is gathering the family — open the park map" (no final period). `#dollywood-live`, tag `rally` | 1800 s / high | No daily dedupe (does not use `notify()`). Rate limit is 1 per adult per minute (`rateCheck` 1, `rateHit` MIN). Logged as kind `rally`. Push errors are caught per recipient | `park` (checked directly, 120) | worker/src/index.js:80-131 |
| Test | `POST /api/push/test` | The caller, or any profile when the admin asks | "Anderson House". "Notifications are working on this device." `#me`, tag `test` | 600 s / high | None | None | worker/src/index.js:533-539 |

### 7.4 Database schema

#### Tables (worker/schema.sql)

| Table | Columns (name type constraints) | Indexes | Lines |
|---|---|---|---|
| `profiles` | `id TEXT PK`; `name TEXT NOT NULL`; `emoji TEXT NOT NULL DEFAULT '🙂'`; `color TEXT NOT NULL DEFAULT '#5B6FA8'`; `kind TEXT NOT NULL CHECK IN ('adult','kid','kiosk')`; `pin_hash TEXT`; `is_admin INTEGER NOT NULL DEFAULT 0`; `sort_order INTEGER NOT NULL DEFAULT 0`; `photo TEXT`; `is_guest INTEGER NOT NULL DEFAULT 0`; `created_by TEXT`; `expires_at INTEGER` | PK only | 4-17 |
| `media` | `key TEXT PK`; `mime TEXT NOT NULL DEFAULT 'image/jpeg'`; `bytes BLOB NOT NULL`; `size INTEGER NOT NULL`; `created_at INTEGER NOT NULL` | PK only | 19-26 |
| `app_data` | `id INTEGER PK AUTOINCREMENT`; `scope TEXT NOT NULL CHECK IN ('person','family')`; `profile_id TEXT` (NULL for family); `app_id TEXT NOT NULL`; `key TEXT NOT NULL`; `value TEXT` (NULL = tombstone); `updated_at INTEGER NOT NULL`; `synced_at INTEGER NOT NULL DEFAULT 0` | `app_data_uq` UNIQUE `(scope, IFNULL(profile_id,''), app_id, key)` (41); `app_data_pull` `(app_id, scope, profile_id, synced_at)` (42) | 28-42 |
| `devices` | `id TEXT PK`; `name TEXT NOT NULL DEFAULT ''`; `token_hash TEXT NOT NULL UNIQUE`; `paired_at INTEGER NOT NULL`; `last_seen INTEGER NOT NULL` | Implicit UNIQUE on `token_hash` | 44-50 |
| `sessions` | `token_hash TEXT PK`; `profile_id TEXT NOT NULL`; `device_id TEXT NOT NULL`; `created_at INTEGER NOT NULL`; `expires_at INTEGER NOT NULL` | PK only | 52-59 |
| `activity` | `id INTEGER PK AUTOINCREMENT`; `profile_id TEXT`; `app_id TEXT NOT NULL`; `text TEXT NOT NULL`; `created_at INTEGER NOT NULL` | `activity_created (created_at DESC)` (68) | 61-68 |
| `push_subscriptions` | `id INTEGER PK AUTOINCREMENT`; `profile_id TEXT NOT NULL`; `device_id TEXT NOT NULL`; `subscription TEXT NOT NULL`; `created_at INTEGER NOT NULL`; `UNIQUE (profile_id, device_id)` | Implicit UNIQUE | 70-77 |
| `push_log` | `id INTEGER PK AUTOINCREMENT`; `profile_id TEXT`; `kind TEXT NOT NULL`; `ok INTEGER NOT NULL DEFAULT 1`; `created_at INTEGER NOT NULL` | None | 79-85 |
| `chat_log` | `id INTEGER PK AUTOINCREMENT`; `profile_id TEXT NOT NULL`; `role TEXT NOT NULL`; `content TEXT NOT NULL`; `created_at INTEGER NOT NULL` | `chat_log_profile (profile_id, created_at)` (94) | 87-94 |
| `settings` | `key TEXT PK`; `value TEXT NOT NULL` | PK only | 97-100 (96 is a comment) |
| `rate_limits` | `key TEXT PK`; `count INTEGER NOT NULL`; `reset_at INTEGER NOT NULL` | PK only | 102-106 |

There are no foreign keys: no `REFERENCES` anywhere in worker/schema.sql. Every CREATE uses `IF NOT EXISTS`, and the header says "Idempotent: safe to re-run" (worker/schema.sql:1).

#### Migrations

| File | Change | Idempotent? |
|---|---|---|
| worker/migrations/001-synced-at.sql | Adds `app_data.synced_at INTEGER NOT NULL DEFAULT 0` (3), backfills it from `updated_at` (4), recreates `app_data_pull` (5-6). The header says it is already applied live (2) | No. The `ALTER TABLE ADD COLUMN` (3) fails on a second run, or on a DB built from schema.sql. Lines 4-6 are safe to repeat |
| worker/migrations/002-media.sql | Adds `profiles.photo TEXT` (4) and creates `media` (5-11) | No, because of the ALTER (4); the CREATE uses IF NOT EXISTS |
| worker/migrations/003-drop-legacy.sql | `DROP TABLE IF EXISTS leftovers` (3) | Yes |
| worker/migrations/004-rename-mae.sql | `UPDATE profiles SET name='Mae' WHERE id='christian' AND name='Christian'` (3) | Yes |
| worker/migrations/005-guests.sql | Adds `profiles.is_guest INTEGER NOT NULL DEFAULT 0`, `created_by TEXT` and `expires_at INTEGER` (7-9) | No. The file says so itself: a second run fails with "duplicate column name" (5). The guard it mentions, "scripts guard on `PRAGMA table_info(profiles)`" (6), is NOT FOUND IN CODE: searched scripts/ for `PRAGMA\|005-guests\|duplicate column` and the repo for `table_info` |

#### Drift between schema.sql and migrations

| Item | Evidence |
|---|---|
| The columns added by 001, 002 and 005 match schema.sql in name, type, default and order | worker/schema.sql:13-16, 38; worker/migrations/001-synced-at.sql:3; worker/migrations/002-media.sql:4; worker/migrations/005-guests.sql:7-9 |
| The `media` definition is identical in both | worker/schema.sql:20-26 ↔ worker/migrations/002-media.sql:5-11 |
| The `leftovers` table dropped by 003 has no CREATE in schema.sql | worker/migrations/003-drop-legacy.sql:3 |
| No baseline migration exists. Ten tables (`profiles` and `app_data` before their added columns, `devices`, `sessions`, `activity`, `push_subscriptions`, `push_log`, `chat_log`, `settings`, `rate_limits`) exist only in schema.sql | worker/schema.sql:1-2 |
| The `settings` comment lists `vapid_public_key`, but nothing reads it: VAPID comes from Worker vars and secrets. The settings keys actually used are `pairing_code_hash` and `last_prayer_push_at` | worker/schema.sql:96; worker/wrangler.toml:10; worker/src/reminders.js:21-22, 156-164; worker/src/index.js:146, 514; scripts/set-pairing-code.mjs:45 |
| The `pin_hash` comment "NULL = adult has not created a PIN yet" does not cover PIN-less guests, who also have NULL and sign in on tap | worker/schema.sql:10; worker/src/index.js:237-238 |
| Guests are `kind='adult'` plus `is_guest=1`; the kind CHECK has no guest value | worker/schema.sql:9, 14 |

### 7.5 Seed (worker/seed.sql)

The seed uses `INSERT OR IGNORE`, so a re-run never overwrites admin-panel edits (worker/seed.sql:1, 3). `pin_hash` is `NULL` for every profile, so no hash is present in the seed (worker/seed.sql:2, 4-11).

| id | Display name | kind | is_admin | colour | emoji | sort_order | Line |
|---|---|---|---|---|---|---|---|
| `eli` | Eli | adult | 1 | `#4F5D8C` | 🧭 | 1 | 4 |
| `christian` | Mae | adult | 0 | `#BC5A38` | 🌸 | 2 | 5 |
| `ezra` | Ezra | kid | 0 | `#137F77` | 🦖 | 3 | 6 |
| `kiara` | Kiara | kid | 0 | `#B4861B` | 🦄 | 4 | 7 |
| `mom` | Elizabeth | adult | 0 | `#8A6A4B` | 🌷 | 5 | 8 |
| `dad` | David | adult | 0 | `#3D5A3D` | 🎣 | 6 | 9 |
| `niece` | Mea | adult | 0 | `#5B8143` | 🌻 | 7 | 10 |
| `tv` | Downstairs TV | kiosk | 0 | `#4C4C58` | 📺 | 8 | 11 |

- **Settings rows:** worker/seed.sql has none. It holds only lines 1-11, a single `profiles` INSERT. The pairing-code hash is written by `scripts/set-pairing-code.mjs` (scripts/set-pairing-code.mjs:45, referenced at worker/src/index.js:11) or by the admin rotate route (worker/src/index.js:508-517). `last_prayer_push_at` is written by the first prayer-job run (worker/src/reminders.js:162-164, 180).
- **Columns left to defaults:** `photo`, `is_guest`, `created_by` and `expires_at` are not in the seed column list (worker/seed.sql:3).

## 8. PWA, assets, app registry and repo layout

### 8.1 manifest.json

| Field | Value | Line |
|---|---|---|
| name | `Anderson House Hub` | manifest.json:2 |
| short_name | `Hub` | manifest.json:3 |
| description | "The family's one-stop shop: reading plan, fridge list, prayers and reminders." | manifest.json:4 |
| start_url | `./index.html` | manifest.json:5 |
| scope | `./` | manifest.json:6 |
| display | `standalone` | manifest.json:7 |
| orientation | `any` | manifest.json:8 |
| background_color | `#F7F2EB` (same as Hearth `--bg`, apps/design.css:40) | manifest.json:9 |
| theme_color | `#F7F2EB` | manifest.json:10 |
| icons[0] | `icons/icon-192.png`, 192x192, png, purpose `any` | manifest.json:12 |
| icons[1] | `icons/icon-512.png`, 512x512, png, purpose `any` | manifest.json:13 |
| icons[2] | `icons/icon-512-maskable.png`, 512x512, png, purpose `maskable` | manifest.json:14 |
| icons[3] | `icon.svg`, sizes `any`, svg+xml, no `purpose` (so it defaults to any) | manifest.json:15 |

**Fields missing from the manifest:** `id`, `lang`, `dir`, `categories`, `screenshots`, `shortcuts`, `display_override`, `launch_handler`, `prefer_related_applications` / `related_applications`, `share_target`, `protocol_handlers`, `file_handlers`, `handle_links`, `scope_extensions`, `edge_side_panel`, `widgets`, `iarc_rating_id`. A Grep of manifest.json for each of these keys found nothing. There is no `monochrome`-purpose icon. The only raster sizes are 192 and 512 (no 96, 144 or 1024).

**iOS and other head tags (index.html):**

| Tag | Value | Line |
|---|---|---|
| html lang | `en` | index.html:2 |
| viewport | `width=device-width, initial-scale=1, viewport-fit=cover` | index.html:5 |
| description | "The Anderson family hub: …" | index.html:7 |
| theme-color (light) | `#F7F2EB`, media `(prefers-color-scheme: light)` | index.html:8 |
| theme-color (dark) | `#1A1512`, media `(prefers-color-scheme: dark)` (same as Midnight `--bg`, apps/design.css:157) | index.html:9 |
| apple-mobile-web-app-capable / mobile-web-app-capable | `yes` | index.html:10-11 |
| apple-mobile-web-app-status-bar-style | `default` | index.html:12 |
| apple-mobile-web-app-title | `Hub` | index.html:13 |
| manifest link | `manifest.json` | index.html:14 |
| icon | `icon.svg` (`image/svg+xml`) | index.html:15 |
| apple-touch-icon | `icons/apple-touch-icon.png`, sizes 180x180 | index.html:16 |
| apple-touch-startup-image | NOT FOUND IN CODE. Searched `apple-touch-startup-image` and `startup-image` across the repo. | — |

- **Theme colour at runtime.** `syncThemeColor()` sets both theme-color metas to the current `--bg` (index.html:656-658). It is called:
  - in `enterShell()` (index.html:624)
  - when an app iframe posts `hub:theme` (index.html:767)
  - when the theme is picked in Me (index.html:1283)
  - at boot (index.html:1702)
  - when the OS scheme changes (index.html:1703)

  The manifest colours are static.
- **Per-app head tags:**
  - prayer.html:6-9: capable, status-bar `default`, title `Prayer`, and `theme-color` with id `themeColor` set to `#F7F2EB`. `applyTheme()` rewrites that meta to `--bg` (prayer.html:1531-1537).
  - f260.html:7-8: capable, title `F260`.
  - dollywood.html:4 and dollywood-live.html:4: `apple-mobile-web-app-capable` and `mobile-web-app-capable`.
  - No app links the manifest; only index.html:14 does.

### 8.2 Service worker sw.js

- **VERSION:** `hub-v27` (sw.js:7). docs/VERIFICATION.md still cites `hub-v18` at :4 and :61.
- **Header comment** (sw.js:1-6): the precache is served stale-while-revalidate, so "an edit shows up on the second open". Bumping VERSION forces a clean cache.
- **SHELL precache:** 70 entries (sw.js:8-19), 4,328,201 B on disk (not counting `./`), no duplicate strings.

| Group | Count | Entries (line) |
|---|---|---|
| Root | 5 | `./`, `index.html`, `manifest.json`, `icon.svg`, `sw.js` (:9) |
| apps/ shared | 2 | `apps/design.css`, `apps/hub.js` (:10) |
| apps/ pages | 7 | f260, leftovers, prayer, tally, timer, kidverse, verses `.html` (:11) |
| icons/ svg | 9 | f260, leftovers, prayer, tally, timer (:12); dollywood, dollywood-live, kidverse, verses (:13) |
| icons/ png | 4 | apple-touch-icon, icon-192, icon-512, icon-512-maskable (:14) |
| Park map | 5 | `apps/dollywood-live.html`, `apps/dollywood/relief.jpg`, `slope.png`, `relief_soft.jpg`, `illustrated_lo.jpg` (:16). Comment at :15: "the park map must work in the park" |
| art/ | 38 | every SVG in ambient (4), app (12), empty (5), hero (5), story (12) (:18) |

- **Basemaps.** `relief_soft.jpg` and `illustrated_lo.jpg` are the build guide's layers, not the park map's (`IMG=` and `ILL=` at apps/dollywood.html:696), even though the comment at :15 groups them under the park map. The build guide page itself is not precached.
- **The park map** uses `IMG='dollywood/relief.jpg'` and `SLOPE='dollywood/slope.png'`. Its `ILL` is a 1x1 GIF data URI (apps/dollywood-live.html:696).
- `AER='dollywood/aerial.jpg'` appears in both pages (:696).

**Handlers**

| Handler | Behaviour | Line |
|---|---|---|
| install | `caches.open(VERSION)` then `Promise.allSettled(SHELL.map(u => c.add(u)))`, so a missing file does not fail the install. Then `self.skipWaiting()`. | sw.js:21-23 |
| activate | Deletes every cache whose key is not VERSION, then `self.clients.claim()`. | sw.js:24-26 |
| fetch | See the strategy table below. | sw.js:31-50 |
| push | Parses JSON, falling back to text. Title defaults to `'Anderson House'`. `icon` and `badge` are both `icons/icon-192.png`. `tag` defaults to `'hub'`; `renotify: !!data.tag`; `data.url` defaults to `'#home'`. | sw.js:53-61 |
| notificationclick | Closes the notification and builds `index.html` + hash against the scope. It uses `matchAll({type:'window', includeUncontrolled:true})`. If a client is open it posts `{source:'hubsw', type:'open', url}` and focuses it; otherwise it calls `clients.openWindow`. | sw.js:62-70 |
| Shell side of notificationclick | The `message` listener sets `location.hash`, or calls `openApp` / `showTab` if the hash is unchanged. | index.html:1573-1576 |
| Local timer notification | `reg.showNotification('Timer done', {icon/badge icon-192, tag 'timer', renotify, data.url '#timer'})`. Sent from the shell with no server push. | index.html:797-803 |

**Caching strategy by request type**

| Request | Strategy | Line |
|---|---|---|
| Non-GET | Not intercepted | sw.js:33 |
| Worker API (`/api/` in the path, or a `*.workers.dev` host), including `/api/media/*` and `/api/dollywood/waits` | Not intercepted; the comment says "never serve API responses from cache". hub.js fetches with `cache: 'no-store'` (apps/hub.js:135). | sw.js:28, 35 |
| Cross-origin (Google Fonts etc.) | Not intercepted, so only the HTTP cache applies | sw.js:36 |
| `apps.json` (`pathname.endsWith('/apps.json')`) | Network-first. It `put`s a copy under key `apps.json` in VERSION with no `r.ok` check; offline it returns `caches.match('apps.json')`. `apps.json` is not in SHELL, so it is cached only after the first online fetch. The shell fetches `apps.json?ts=<now>` with `cache:'no-store'` and falls back to localStorage `hub.registry` (index.html:462-471). `loadRegistry()` runs only at boot (index.html:1701). | sw.js:29, 38-41 |
| All other same-origin GETs, navigations included | Cache-first with a background revalidate. Key = pathname with the `/house-hub/` prefix and the query stripped (`./` for a directory). Lookup is `c.match(key) \|\| c.match(req, {ignoreSearch:true})`. A network fetch always fires and `put`s on `r.ok`. Returns the cached copy, else the network, else `503 'Offline'`. Any same-origin file (e.g. apps/dollywood.html, aerial.jpg) is runtime-cached on its first successful fetch. There is no navigation-specific branch: `req.mode === 'navigate'` is NOT FOUND IN CODE. | sw.js:43-49 |

**How an always-open PWA picks up a new deploy (from the code)**

1. **Registration and the only update UI.** index.html registers `sw.js` only on `https:` or hostname `localhost` (index.html:1691-1692). On `updatefound`, once the new worker is `installed` and a controller exists, it toasts "Hub updated — it will use the new version next time it opens." for 4 s (index.html:1693-1695). That toast is the only update UI.
2. **The new worker takes over at once.** It calls `skipWaiting()` (sw.js:22), then deletes the old caches and runs `clients.claim()` (sw.js:25). The open page switches to the new worker, but the shell HTML, JS and CSS already in memory keep running.
3. **App iframes pick up the new version when opened.** `closeViewer` blanks the frame (index.html:732), and `openApp` sets `frame.src = a.file` (index.html:724), so apps opened afterwards come from the new VERSION cache that was filled at install.
4. **No forced reload or polling.** In index.html and apps/hub.js there is no `controllerchange` listener, no `reg.update()` call and no reload on update. The only `location.reload()` is "Forget this device" (index.html:1288). A Grep of all of apps/ for `serviceWorker`, the Dollywood exports included, found nothing. The `location.replace` / `location.href` calls in hub.js (:154, :329, :430) are standalone-app redirects, not update handling. An always-open kiosk or TV therefore keeps its loaded shell code until it is relaunched.
5. **Without a VERSION bump,** stale-while-revalidate serves the old copy on the first open after a deploy and the new one on the next (sw.js:4-5, 45-48).
6. **The per-app reload button** (`#pill-reload`, index.html:411) sets `frame.src = current.file + ('?'|'&') + 'r=' + Date.now()` (index.html:737). The worker keys on pathname only (sw.js:43-46), so it still returns the cached copy first.

**Shipped but NOT precached**

This compares git-tracked apps/, icons/, art/, index.html, manifest.json, icon.svg, apps.json and sw.js (68 files under apps/icons/art, all tracked, none untracked) with SHELL.

| File | Size | Why |
|---|---|---|
| `apps.json` | 1,719 B | Network-first, runtime-cached (sw.js:38-41) |
| `apps/dollywood.html` | 2,243,914 B | On the bump-sw skip list |
| `apps/dollywood/aerial.jpg` | 1,665,156 B | On the bump-sw skip list; the comment at sw.js:15 says "cached on first use" |
| `art/README.md` | 1,049 B | Not an asset (bump-sw only walks html/js/css/svg/png/jpg, scripts/bump-sw.mjs:20) |

Other tracked paths are not precached either: docs/ (including docs/design.html, which Pages serves), handoff/, scripts/, worker/, README.md, CLAUDE.md and .nojekyll. bump-sw only walks `apps`, `icons` and `art` (scripts/bump-sw.mjs:20).

**scripts/bump-sw.mjs**

- **Skip list:** `new Set(['apps/dollywood.html', 'apps/dollywood/aerial.jpg'])`, commented "multi-megabyte, cached on first use instead" (scripts/bump-sw.mjs:18).
- **How it reads the precache list** (scripts/bump-sw.mjs:15). It takes every `'…'` match in sw.js that ends in html/js/css/json/svg/png/jpg, or is `./`.
  - Replaying that regex read-only gives 74 matches: the 70 SHELL entries plus `'/apps.json'` (:29), `'apps.json'` ×2 (:39-40) and `'./'` (:44).
  - `'icons/icon-192.png'` (:58) and `'index.html'` (:64) are not matched, because the quote pairing shifts after the empty strings on :44.
- **Checks:**
  - every listed file exists (:16-17)
  - every shipped file is precached or skipped (:21-22)
  - then it bumps VERSION unless `--check` is passed (:24-27)

### 8.3 apps.json

The top-level `"title": "Anderson House"` (apps.json:2) is used for `document.title` (index.html:470) and the brand label (index.html:632).

| id | name | file | color | icon | scope | tile | visibleTo | dark | line |
|---|---|---|---|---|---|---|---|---|---|
| f260 | F260 Reading Plan | apps/f260.html | #4F5D8C | icons/f260.svg | person | wide | eli, christian, mom, dad, niece | — | 4 |
| leftovers | Larder Ledger | apps/leftovers.html | #3D5A3D | icons/leftovers.svg | family | small | (all) | — | 5 |
| prayer | Prayer | apps/prayer.html | #8A6A4B | icons/prayer.svg | both | small | eli, christian, mom, dad, niece, ezra, kiara | — | 6 |
| tally | Tally counter | apps/tally.html | #4C7B6A | icons/tally.svg | person | small | (all) | — | 7 |
| timer | Kitchen timer | apps/timer.html | #B8623A | icons/timer.svg | person | small | (all) | — | 8 |
| dollywood | Dollywood build guide | apps/dollywood.html | #7A4FA3 | icons/dollywood.svg | person | small | eli, christian, mom, dad, niece | true | 9 |
| dollywood-live | Dollywood park map | apps/dollywood-live.html | #1F6FB2 | icons/dollywood-live.svg | both | small | (all) | true | 10 |
| kidverse | Kid Verse | apps/kidverse.html | #B4861B | icons/kidverse.svg | both | small | ezra, kiara, eli, christian, mom, dad, niece | — | 11 |
| verses | Verses | apps/verses.html | #5B8143 | icons/verses.svg | person | small | eli, christian, mom, dad, niece, ezra, kiara | — | 12 |

- **`dark`** toggles `#viewer.dark` (index.html:722; CSS at index.html:331).
- **`tile: wide`** (f260 only) renders `widgetHtml(a)` in the tile (index.html:685-692, 698-702).
- **`data-scope` matches `scope` for all nine apps:** f260.html:777, leftovers.html:133, prayer.html:573, tally.html:142, timer.html:73, kidverse.html:180, verses.html:149, dollywood.html:684, dollywood-live.html:684.

**Cross-check of apps/ on disk (16 files, all git-tracked)**

| File | Bytes | Status | Precached |
|---|---|---|---|
| apps/f260.html | 165,200 | Registered (f260) | yes |
| apps/leftovers.html | 21,764 | Registered | yes |
| apps/prayer.html | 104,830 | Registered | yes |
| apps/tally.html | 9,856 | Registered | yes |
| apps/timer.html | 8,676 | Registered | yes |
| apps/kidverse.html | 72,269 | Registered | yes |
| apps/verses.html | 33,299 | Registered | yes |
| apps/dollywood.html | 2,243,914 | Registered (generated export) | no (skip list) |
| apps/dollywood-live.html | 1,160,570 | Registered (generated export) | yes |
| apps/hub.js | 32,428 | Shared asset (SDK) | yes |
| apps/design.css | 48,412 | Shared asset (tokens and components) | yes |
| apps/dollywood/relief.jpg | 1,133,324 | Shared asset: park map `IMG` (dollywood-live.html:696) | yes |
| apps/dollywood/relief_soft.jpg | 666,582 | Shared asset: build guide `IMG` (dollywood.html:696) | yes |
| apps/dollywood/illustrated_lo.jpg | 403,725 | Shared asset: build guide `ILL` (dollywood.html:696) | yes |
| apps/dollywood/slope.png | 101,368 | Shared asset: `SLOPE`, both pages (:696) | yes |
| apps/dollywood/aerial.jpg | 1,665,156 | Shared asset: `AER`, both pages (:696) | no (skip list) |

- **Unregistered HTML in apps/:** none.
- **Registered but missing:** none.
- **Icon paths:** all 9 exist in icons/.
- **Spot art:** all 9 `art/app/<id>.svg` exist. The extra art/app files `chat`, `feed` and `reminders` are not apps.

### 8.4 Icons

| File | Format | Bytes | Referenced by |
|---|---|---|---|
| icon.svg | SVG, viewBox 180, gradient `#A88461`→`#6B4F35`, rx 40, house strokes width 11 (icon.svg:1-11) | 941 | manifest.json:15; index.html:15 (`rel=icon`); sw.js:9. Generated by scripts/make-art.mjs:234-243 |
| icons/apple-touch-icon.png | PNG 180×180, 8-bit RGBA (IHDR colour type 6) | 15,803 | index.html:16; sw.js:14. Rendered with `omitBackground: !pad` and pad 0, so everything outside the rx=40 rounded rect is transparent (scripts/make-art.mjs:275-276, 279) |
| icons/icon-192.png | PNG 192×192 RGBA | 17,227 | manifest.json:12; sw.js:14; push icon and badge (sw.js:58); timer notification icon and badge (index.html:801) |
| icons/icon-512.png | PNG 512×512 RGBA | 85,213 | manifest.json:13; sw.js:14 |
| icons/icon-512-maskable.png | PNG 512×512 RGB, opaque (colour type 2) | 45,173 | manifest.json:14; sw.js:14. 64 px pad on `#8A6A4B` (scripts/make-art.mjs:275, 279) |
| icons/f260.svg | SVG 24 | 471 | apps.json:4; sw.js:12 |
| icons/leftovers.svg | SVG 24 | 364 | apps.json:5; sw.js:12 |
| icons/prayer.svg | SVG 24 | 357 | apps.json:6; sw.js:12 |
| icons/tally.svg | SVG 24 | 287 | apps.json:7; sw.js:12 |
| icons/timer.svg | SVG 24 | 336 | apps.json:8; sw.js:12 |
| icons/dollywood.svg | SVG 24 | 372 | apps.json:9; sw.js:13 |
| icons/dollywood-live.svg | SVG 24 | 356 | apps.json:10; sw.js:13 |
| icons/kidverse.svg | SVG 24 | 453 | apps.json:11; sw.js:13 |
| icons/verses.svg | SVG 24 | 451 | apps.json:12; sw.js:13 |

- **How the shell loads app icons.** It fetches `icons/<app>.svg` at runtime into `svgCache` and injects it with `class="icon"` (index.html:453, 484-491). The feed uses the cached copy, or a sprite fallback (index.html:935-945).
- **PNGs.** Only the PNGs are generated (make-art `--png`, scripts/make-art.mjs:266-281). No script writes `icons/*.svg`: a Grep of scripts/ for writes to `icons` finds only make-art.mjs:276 (the PNG screenshot).

**Icon style**

- **App tile icons** (icons/*.svg:1, all 9): `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, round caps and joins, `aria-hidden="true"`.
  - The first element has `class="duo"` and is a copy of the main shape. In dollywood.svg the duo is a closed version of the outline; in verses.svg it covers the left page only.
  - The duo fill (`fill: var(--tint); fill-opacity: .2`) and the `.icon` stroke recipe apply only inside `.ds` (apps/design.css:602, 604-605).
- **Shell sprite:** a hidden `<svg>` with 21 `<symbol>`s, i-home … i-sparkle (index.html:416-438). 13 of them carry a `class="duo"` path. There are no inline stroke attributes; styling comes from apps/design.css:602.
- **Other apps use their own inline sets:**

| File | Icons | Stroke widths |
|---|---|---|
| apps/f260.html | 11-symbol hidden sprite (:530-542) | `.ico` 2 (:48), `svg.il` 2.5 (:49), check 2.6 (:1183) |
| apps/leftovers.html | 5 Lucide glyphs inlined in `ICON`, commented "Lucide glyphs, inlined — no icon library on a static host." (:148-155) | default 2 (:160) |
| apps/prayer.html | inline SVGs | 1.75 (from :566), 2 (from :482), 2.2 (:846), 2.4 (:1588) |
| apps/kidverse.html | inline SVGs | 1.75 (from :159), 2.2 (:173), 1.9 (:400) |
| apps/verses.html | inline SVGs | 1.75 (from :109), 2 (from :113), 2.25 (:115) |
| apps/tally.html | no inline SVG | — |
| apps/timer.html | progress ring only (:56) | 3 (:27) |
| apps/dollywood-live.html | inline SVG/CSS, no sprite | 15 distinct values from .7 (:262) to 9 (:285) |

- **Third-party icon library:** none is loaded (no package, no CDN). The only third-party glyphs are the Lucide paths copied into leftovers.html:148-155. `lucide|phosphor|heroicons|feather|material|fontawesome|ionicons|tabler` match nothing else in shipped files.
- **SF Pro / SF Symbols / SF Compact:** NOT FOUND IN CODE. Searched index.html, apps/, docs/design.html, art/ and icons/. The only SF name is `SFMono-Regular` in the `--font-mono` stack (apps/design.css:21). It is a system-font name; no font file is involved.
- **`@font-face`, `.woff`, `.ttf`, `.otf` in shipped files:** NOT FOUND IN CODE. The only `.woff2` is a MIME map entry in scripts/test-dollywood-themes.mjs:19.
- **Font stacks** (all system names or Google Fonts; no embedded fonts):
  - apps/design.css:18: `ui-rounded, -apple-system, system-ui, "Segoe UI Variable", …`
  - apps/design.css:19: `ui-serif, "New York", "Iowan Old Style", …`
  - apps/design.css:21: `ui-monospace, SFMono-Regular, Menlo, …`
  - apps/f260.html:21: `--serif:"New York",var(--font-serif)`
  - apps/prayer.html:45: `"Manrope",-apple-system,BlinkMacSystemFont,…`; prayer.html:148 and 338 use `"Instrument Serif"`. Both are loaded from Google Fonts (prayer.html:12-14).
  - apps/dollywood.html:14 and apps/dollywood-live.html:14: `Archivo,system-ui,sans-serif`; :19 and others: `Fraunces,Georgia,serif`. Neither export has a font file or font URL.

### 8.5 Illustration art

| Folder | SVGs | Bytes | Size (art/README.md:8-12) | Used by |
|---|---|---|---|---|
| art/hero/ | 5 (morning, afternoon, evening, night, play) | 5,645 | 300×200 | Home hero `art/hero/${art \|\| tod}.svg` (index.html:971). `timeOfDay()` returns only morning, afternoon or evening (index.html:835). `art:'play'` on kid Home (index.html:1149). The Stars and Kids cards use `hero/play.svg` (index.html:904, 913). `hero/night.svg` has no surface reference; it appears only in docs/design.html:272 and sw.js:18. |
| art/app/ | 12 (9 app ids + chat, feed, reminders) | 13,378 | 200×160 | Home card spots: dollywood-live (index.html:894), f260 (:1165), leftovers (:1176), prayer (:1188). App heroes and empty states: f260.html:566, 1966; timer.html:53; tally.html:132; verses.html:127. `../art/app/dollywood-live.svg` as a CSS background (dollywood.html:442, dollywood-live.html:442). `../art/app/dollywood.svg` as `<img class="hero-art">` (dollywood.html:568, dollywood-live.html:568). No surface references `app/chat`, `app/feed`, `app/reminders` or `app/kidverse`: the first three appear only in docs/design.html:272 and sw.js:18; kidverse only in sw.js:18 and scripts/test-kidverse.mjs:156. |
| art/empty/ | 5 (fridge, list, chat, feed, prayers) | 4,017 | 220×140 | list: index.html:696 (Apps grid), :1223 (reminders). feed: :949 (feed), :1430 (album). chat: `chatNote(…, 'chat')` (index.html:1449-1451, 1474). fridge: leftovers.html:224. prayers: prayer.html:920, 954. |
| art/story/ | 12 (01-creation … 12-church) | 13,059 | 240×160 | Kid Verse scene and story art (kidverse.html:147, 166, 346, 651; comment at :241) |
| art/ambient/ | 4 (dawn, day, dusk, night) | 3,679 | 1600×900 | TV board backdrop when the album is empty: `ambientOf()` (index.html:1044), used at index.html:1084 |

- **Totals:** 38 SVGs, 39,778 B, plus README.md at 1,049 B. art/README.md:4 says "38 files, 39 KB. All precached by `sw.js`."
- **Style guide:** docs/design.html:272-274 renders every folder from an `ART` list. Its app list omits `kidverse` and `verses`.
- **scripts/make-art.mjs** (281 lines) generates the set; the files are its output (header :2-5).
  - Its palette constant mirrors the design.css light tokens (:13-17).
  - `write()` writes into art/ (:28): hero (:61), app (:163), empty (:199), story (:216), ambient (:231).
  - It builds and writes icon.svg (:234-243).
  - It regenerates art/README.md with the counts (:245-262).
  - `--png` renders the four PNGs from icon.svg through playwright-core Chromium (:266-281).
- **scripts/test-art.mjs** (header :2-4) checks that:
  - every SVG parses and renders
  - every app in apps.json has `art/app/<id>.svg` (:40-41) and an SVG tile icon (:42-43)
  - everything is precached (:44-45)
  - the set is ≤ 600 KB (:39)

### 8.6 External network dependencies

| URL | file:line | Purpose |
|---|---|---|
| `https://house-hub-api.catalystfarm1.workers.dev` | apps/hub.js:25 | `DEFAULT_API`, the Worker API base. localStorage `hub.api` can override it (apps/hub.js:27, 48). All requests go through `fetch(hub.api + path, {cache:'no-store'})` (:135); photo URLs are built from the same base (:457). |
| `https://house-hub-api.catalystfarm1.workers.dev` | apps/dollywood.html:1629; apps/dollywood-live.html:1499 | Fallback base for `GET /api/dollywood/waits` (dollywood.html:1630, dollywood-live.html:1500). `loadWaits()` returns at once unless `FLAVOR==='live'`. The build guide sets `FLAVOR='hub'` (dollywood.html:688) and the park map sets `FLAVOR='live'` (dollywood-live.html:688), so only the park map fetches waits. `POST /api/dollywood/rally` goes through `hub.request` (dollywood.html:1719, dollywood-live.html:1589). |
| `https://queue-times.com/parks/55` | apps/dollywood.html:1652; apps/dollywood-live.html:1522 | Attribution link, `target=_blank`. The Worker fetches `https://queue-times.com/parks/55/queue_times.json` (worker/src/index.js:62). |
| `https://www.google.com/search?q=`, `https://www.google.com/search?tbm=isch&q=`, `https://www.youtube.com/results?search_query=` | apps/dollywood.html:977; apps/dollywood-live.html:977 | Outbound search links set by `wireSearch()` on the ride pop-up anchors `pop-web`, `pop-img`, `pop-vid` and `pop-off` (anchors at :976). `pop-off` is a Google `site:dollywood.com` search. |
| `https://fonts.googleapis.com` (preconnect) | apps/prayer.html:12 | Fonts |
| `https://fonts.gstatic.com` (preconnect, crossorigin) | apps/prayer.html:13 | Fonts |
| `https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap` | apps/prayer.html:14 | Manrope and Instrument Serif stylesheet. Cross-origin, so the service worker does not cache it (sw.js:36). |
| `https://www.biblegateway.com/passage/?search=…&version=ESV` | apps/f260.html:971 | Outbound Bible reading link (source "gateway") |
| `https://www.esv.org/…/` | apps/f260.html:977 | Outbound Bible reading link (source "esv") |
| `https://www.bible.com/search/bible?query=` | apps/f260.html:979 | YouVersion fallback link |
| `https://www.bible.com/bible/59/<BOOK>.<ch>[.v].ESV` | apps/f260.html:984 | YouVersion deep link |
| `http://www.w3.org/2000/svg` and `http://www.w3.org/1999/xhtml` | apps/design.css:449; apps/leftovers.html:157; icon.svg:1; icons/*.svg:1; docs/design.html:267; apps/dollywood*.html:697 (+ xhtml at dollywood.html:1748) | XML namespaces only; no network |

- **No external URLs at all in:** index.html, sw.js, manifest.json, apps.json, apps/tally.html, apps/timer.html, apps/kidverse.html, apps/verses.html.
- **Every `<script src>` / `<link href>` is local** (design.css, hub.js, manifest, icons), except prayer.html:12-14.
- **No CDN:** `unpkg|jsdelivr|cdnjs|cdn.` match nothing in index.html, sw.js, apps/ or docs/design.html.
- **Worker-side** (not shipped to the client): `https://api.anthropic.com`, overridable by `ANTHROPIC_BASE_URL` (worker/src/chat.js:345).
- **CORS allow-list:** `https://vantrix117.github.io`, `http://localhost:8765`, `http://127.0.0.1:8765` (worker/wrangler.toml:8).

### 8.7 Repo layout and tooling

| Path | Tracked | What it is |
|---|---|---|
| index.html | yes | The shell (152,510 B, 1,716 lines) |
| apps.json, manifest.json, sw.js, icon.svg, .nojekyll | yes | Registry, manifest, service worker, master icon, Pages flag |
| apps/ | yes | App pages, hub.js, design.css, dollywood/ basemaps (see 8.3) |
| icons/ | yes | 9 tile SVGs and 4 PNGs |
| art/ | yes | 38 SVGs and README.md |
| docs/ | yes | design.html (style guide, 325 lines, `<title>Hub design system</title>` at :6); ROADMAP.md (119 lines); VERIFICATION.md (61 lines); screens/ (385 PNGs, all tracked; some modified per git status) |
| handoff/prayer/ | yes | Reference kit for building the prayer app: PROMPT.md, README.md, SPEC.md, TASKS.md, check.js, prayer.html (78,805 B), prayers.json. README.md:3: "Everything Claude Code needs to build the prayer app into the hub". README.md:12 says check.js has "31 behaviour checks"; CLAUDE.md's test table says 49. |
| scripts/ | yes | 33 files: 31 `.mjs` and 2 `.sh` (table below) |
| worker/ | yes | README.md, wrangler.toml, schema.sql, seed.sql, migrations/001-005, src/ (auth, chat, data, index, media, push, reminders). Git-ignored on disk: `dev.log` (.gitignore:9), `.wrangler/` (.gitignore:2), `.dev.vars` (.gitignore:5, not opened). |
| audits/ | no (untracked per git status) | HUB-AUDIT-PROMPT.md (15,235 B), the audit constitution (heading at :1) |
| files/ | git-ignored (.gitignore:8) | Personal scratch: PROMPT.md, my-real-list.txt, prayer-handoff.zip |
| .claude/ | git-ignored (.gitignore:7) | launch.json: `npx -y http-server . -p 8765 -c-1 --silent` (.claude/launch.json:4); scheduled_tasks.lock |
| christian-app-game-plan.html, prompt-generator.html | git-ignored (.gitignore:10-11) | Loose personal pages beside the repo |
| CLAUDE.md, README.md, .gitignore | yes | Maintainer map, user guide, ignore list |

- **README.md** (49 lines) is a user-facing guide:
  - pairing and profiles (:7-15)
  - Add to Home Screen per platform, including the kiosk iPad (:17-25)
  - notifications, listing two reminder kinds (:27-34)
  - the four tabs (:36-45): the Apps row (:41) omits Kid Verse and Verses, and Me is described as "Switch profile, light/dark, notifications, sync status" (:43)
  - pointers to CLAUDE.md and worker/README.md (:47-49)
- **docs/ROADMAP.md:** the roadmap agreed 2026-09-17 (:3). It covers Sprints 0, 1, 1b, 2 and 3, then Parked and Verification (:12, 23, 56, 78, 94, 115, 118). The status line says every item is built, verified and live (:5).
- **docs/VERIFICATION.md:** the 2026-09-20 verification report for items 1-27. It cites service worker `hub-v18` (:4, :61). Sections:
  - how it was built (:7)
  - what is verified (:17)
  - what is NOT verified and needs a real device (:43), including Safari rendering on a real iPhone/iPad (:45) and the TV on a real Safari kiosk (:52)
  - housekeeping (:57)

**Scripts**

Key to the Needs column:
- **PW:** playwright-core resolved from NODE_PATH via `createRequire`
- **C/E:** Chrome, else Edge (`msedge`), from a hard-coded executable list
- **W:** local Worker at 127.0.0.1:8787 (`wrangler dev`)
- **code:** pairing code as argv
- **proxy:** serves the repo on its own port and proxies `/api` to the Worker

The Emu column is the line where the script sets `isMobile`/`hasTouch` on its browser context. No `package.json` or `node_modules` exists in the repo or in worker/.

| Script | Purpose (header) | Needs | Engine | Emu |
|---|---|---|---|---|
| bump-sw.mjs | Bump VERSION and check the precache list (:2-5) | Node | — | — |
| make-art.mjs | Generate art/** and icon.svg; `--png` renders the PNG icons (:2-5) | Node; `--png`: PW + Chrome only (:269-270) | Chromium (:271) | — |
| mock-anthropic.mjs | Stand-in Messages API for /api/chat (:2-5) | Node, port 8791 | — | — |
| push-receiver.mjs | Stand-in push service; verifies VAPID and decrypts (:2-5) | Node, port 8790 | — | — |
| screens-apps.mjs | Every app × theme at 390/1024; no hex; no OS-scheme CSS (:2-5) | PW, C/E, W, code | Chromium (:68) | :76 (390 only) |
| screens-shell.mjs | Every hub surface at 390/1024/1440, light and dark, adult/kid/kiosk; CLS and token checks (:2-6) | PW, C/E, W, code | Chromium (:62) | :38 |
| screens-themes.mjs | Home/Apps/Me in every theme at 390/1440 (:2-5) | PW, C/E, W, code | Chromium (:58) | :37 |
| set-pairing-code.mjs | Set or rotate the pairing code hash (:2-10) | Node + `npx wrangler d1 execute` (:49) | — | — |
| smoke-api.sh | End-to-end API smoke test; optional house-key argument (:2-5) | bash, curl, node (:10), base URL, code | — | — |
| smoke-chat.sh | Every chat tool and guard over SSE (:2-6) | bash, curl, node, W + mock or key, code (live: adult PIN) | — | — |
| test-apps.mjs | Migrated apps, Home, widgets, kid/kiosk, migration (:2-5) | PW, C/E, W, code | Chromium (:79) | :38 |
| test-art.mjs | Illustration set checks and contact sheets (:2-4) | PW, C/E | Chromium (:56) | — |
| test-design.mjs | Style guide, WCAG AA, reduced motion (:2-5) | PW, C/E | Chromium (:32) | — |
| test-dollywood-sync.mjs | Build guide on hub.js: two-device sync, migration; "private Light/Dark button is gone" (:2-9) | PW, C/E, W, code, proxy :8982 | Chromium (:83) | :119 (iPad context) |
| test-dollywood-themes.mjs | Build guide render in every theme, no h-scroll, `--bg`; also flips "the page's own Light/Dark toggle" (:1-7). No shebang, no exec bit. | PW, Chrome only (`CHROME` env or default path, :18). Sets `hub.api` to :8787 (:49); no code argument. | Chromium (:42) | — |
| test-dollywood.mjs | Park-map privacy for kid/kiosk/adult (:2-5) | PW, C/E, W, code | Chromium (:57) | :29 |
| test-f260.mjs | F260 opens on Today; Done; merge in place; reading mode (:2-13) | PW, C/E, W, code | Chromium (:103) | :58 |
| test-guests.mjs | Guest profiles (:2-9) | PW, C/E, W (migration 005), code, proxy :9023 | Chromium (:95) | :54 (<800 px) |
| test-home.mjs | Home widgets round 2 (:2-14) | PW, C/E, W, code, proxy :8913 | Chromium (:196) | :139 (<700 px) |
| test-hub.mjs | Shell + hub.js: two devices, offline, PIN, kiosk (:2-8; needs stated at :7) | PW, C/E, W, code | Chromium (:76; exe list :75) | :44 |
| test-kidstory.mjs | Kid F260 companion story (:2-14) | PW, C/E, W, code, proxy :9017 | Chromium (:158) | :97 (<700 px) |
| test-kidverse.mjs | Kid Verse flow and stars (:2-15) | PW, C/E, W, code, proxy :8976 | Chromium (:151) | :95 (<700 px) |
| test-leftovers.mjs | Larder list-first, midnight rollover (:2-9) | PW, C/E, W, code, proxy :8852 | Chromium (:77) | :53 |
| test-photos.mjs | Profile photos and album (:2-6) | PW, C/E, W (migration 002), code | Chromium (:72) | :40 |
| test-prayer-faces.mjs | Family prayer with faces, kid flow (:2-10) | PW, C/E, W, code, proxy :8978 | Chromium (:108) | :73 (<700 px) |
| test-prayer.mjs | Pray now above the fold, More sheet, empty state (:2-8) | PW, C/E, W, code, proxy :8851 (:7) | Chromium (:99) | :69 |
| test-prefs.mjs | Preferences follow the person (:2-6) | PW, C/E, W, code | Chromium (:71) | :39 |
| test-push.mjs | RFC 8291 known-answer test and VAPID (:2-3); imports worker/src/push.js (:6) | Node | — | — |
| test-push2.mjs | Push round 2 via the stand-in receiver and the Me switches (:2-9) | PW, C/E, W, code, push-receiver | Chromium (:245) | :247 |
| test-rewards.mjs | Stars, badges, ledger cash-in and reset, races (:2-21) | PW, C/E, W, code, proxy :9020 | Chromium (:174) | :131 (<700 px) |
| test-timer.mjs | Timer survives navigation (:2-8) | PW, C/E, W, code | Chromium (:110) | :52 (desktop context :251) |
| test-tv.mjs | TV board (:2-17) | PW, C/E, W, code, proxy :8981 | Chromium (:202) | :135 (`hasTouch` only) |
| test-verses.mjs | Leitner verse trainer (:2-19) | PW, C/E, W, code, proxy :9019 | Chromium (:176) | :112 (<700 px) |

- **Engines:** all 26 browser-driving scripts call `chromium.launch({ executablePath })` against a locally installed Chrome or Edge.
- **Emulation:** 23 of the 26 set `isMobile`/`hasTouch` on the context. The exceptions are make-art, test-art, test-design and test-dollywood-themes (test-tv sets `hasTouch` only). No script sets a `userAgent`.
- **Playwright WebKit test infrastructure: none exists.**
  - No script calls `webkit.launch` or imports `webkit`, and there is no Playwright config file.
  - The only `webkit` matches in scripts are property reads: `webkitBackdropFilter` in screens-shell.mjs:97, test-design.mjs:55, 57 and 60, test-leftovers.mjs:89 and test-prayer.mjs:151, and `webkitAudioContext` in test-timer.mjs:57.
  - docs/VERIFICATION.md:45 and :52 record Safari as unverified.
- **Scripts missing from CLAUDE.md:** test-dollywood.mjs and test-dollywood-themes.mjs are not named anywhere in CLAUDE.md. The only Dollywood test it names is test-dollywood-sync.mjs (CLAUDE.md:120).

## 9a. Apps — F260 Reading Plan, Verses, Kid Verse

### f260 — F260 Reading Plan (apps/f260.html)

#### 1. File facts
| Fact | Value | Evidence |
|---|---|---|
| Size / lines | 165,200 bytes / 2,099 lines | `wc` on apps/f260.html |
| apps.json entry | `"scope":"person"`, `"tile":"wide"`, `"visibleTo":["eli","christian","mom","dad","niece"]`, `"color":"#4F5D8C"`, `"icon":"icons/f260.svg"`. There is no `dark` key | apps.json:4 |
| hub.js tag | `<script src="hub.js" data-app="f260" data-scope="person">` | apps/f260.html:777 |
| Scope match | Yes (person = person) | apps.json:4, apps/f260.html:777 |
| Precached | html sw.js:11, icon sw.js:12, art `art/app/f260.svg` sw.js:18 | sw.js:11, 12, 18 |
| Structure | `<style>` 10-527, body 529-2098, app script 778-2097. `hub.use` runs before ready (779); everything else is inside `hub.ready().then(() => {…})` (780-2096) | apps/f260.html:10, 527, 779, 780, 2096 |

#### 2. Purpose and views
Purpose: a 52-week Bible reading plan (5 readings and 2 memory verses a week) with a streak, milestones, an encrypted HEAR journal, verse practice, backup, print and a reading mode.

| View / sheet | Lines (apps/f260.html) |
|---|---|
| Header with a Plan/Journal switch (`role="tablist"`, buttons use `aria-pressed`). The switch becomes a fixed bottom bar at ≤600px | 545-558; CSS 456-463 |
| Today hero (next reading, ring, streak, Done/Undo) | 562-576; JS 1556-1600 |
| Kids' story line in the Today hero ("Kids: Ezra 2/5") | 570; JS 1604-1622 |
| Side column: meters/strip, book journey bar, 52-week grid, 12-week heatmap | 577-594; JS 1490-1527 |
| "Next up" hero (pace, reflection line, actions) | 595-607; JS 1528-1548 |
| This week's reflections | 608-611; JS 1424-1475 |
| Milestones | 612-613; JS 1218-1249 |
| Toolbar (jump, week stepper/select, print, settings) | 614-624 |
| Settings sheet, an inline expanding div (sources, weeks/reset, theme, text size, passcode, auto-lock, Face ID, backup) | 625-688; CSS 219-227 |
| Reading-mode bar and week list | 691-697; JS 1348-1368, 1726-1752; CSS 420-442 |
| Journal view (search, sort, copy all, lock, cards) | 702-711; JS 1949-1991 |
| Footer copy | 713 |
| Modals: confirm, passcode, restore, plan complete, verse practice | 716-725, 727-741, 743-754, 756-767, 769-775 |
| Print layout | CSS 491-526 |

#### 3. hub.js usage
| Call | Lines (apps/f260.html) |
|---|---|
| hub.use('kidverse','family') | 779 |
| hub.ready | 780 |
| hub.get | 901 (every `load()`), 1611, 2067 |
| hub.set | 902 (every `save()`) |
| hub.remove | 903 (every `drop()`), 2067 |
| hub.canWrite | 902, 903, 1573, 1574, 1591, 1658, 2067 (defined as `profile.kind !== 'kiosk'`, apps/hub.js:115) |
| hub.kioskNudge | 902, 903, 1591, 1658 (throttled to one toast per 2.5 s, apps/hub.js:248) |
| hub.migrate | 905 (every K key except `f260.journal`) |
| hub.theme / hub.THEMES / hub.setTheme | 922, 2026 / 2028 / 2031 (897 mentions setTheme only in a comment) |
| hub.people | 1610 |
| hub.onChange | 1621 (kidverse rows only), 2073 (all → mergeRemote) |
| hub.activity | 1661 |
| Not used | hub.list, hub.profile, hub.avatarHtml, hub.toast (own toast at 1250), hub.voiceInput, hub.sync/onSync, hub.isKid |

| Key | App / scope | Read | Write |
|---|---|---|---|
| f260.done `{ "w-d": true }` (d is 0-based) | f260 / person | 908, 2075 | 1660, 1120; drop 1766 |
| f260.week | f260 / person | 909, 2080 | 1685, 1120, 1767 |
| f260.source | f260 / person | 910, 2081 | 1722 |
| f260.open | f260 / person | 911, 2082 | 1682, 1714, 1715, 1122 |
| f260.mem | f260 / person | 916, 2075 | 1653, 1120; drop 1766 |
| f260.log `{date:true}` | f260 / person | 917, 2075 | 1662, 1120; drop 1766 |
| f260.weekStart / f260.weekDone | f260 / person | 918-919, 2076 | 938, 1686, 1767, 1120 / 1670, 1673, 1121; both dropped 1766 |
| f260.autolock / f260.big | f260 / person | 920, 921, 2083-2084 | 2051 / 2035 |
| f260.best / f260.miles / f260.jstats | f260 / person | 923-925, 2077-2078 | 1503, 1121 / 1245, 1121 / 1770, 1820, 1121; best and miles dropped 1766 |
| f260.verses / f260.recall | f260 / person | 926-927, 2077 | 1913, 1121 / 1915, 1121; recall dropped 1766 |
| f260.finished | f260 / person | 928, 2079 | 1672, 1121; drop 1121, 1766 |
| f260.read (reading mode) | f260 / person | 929 only (not re-read in `readState` 2074-2085) | 1735 |
| f260.journal.vault (encrypted) | f260 / person (via hub) | 998 | 1022, 1031, 1047, 1053, 1083, 1091, 1110; drop 1056, 1110 |
| f260.journal (legacy plaintext) | localStorage only | 999 | drop 1033, 1056, 1111 |
| f260.summary | f260 / person | 1509 | 1509 |
| f260.view (legacy) | f260 / person | 2067 | remove 2067 |
| story:<kid> | kidverse / family | 1611 | — |
| theme | through hub.theme/setTheme | 922, 2026 | 2031 |

#### 4. design.css usage
| Item | Finding |
|---|---|
| design.css linked | Yes, apps/f260.html:6 |
| `class="ds"` on body | No: `<body>` at apps/f260.html:529. The app keeps its own component CSS (`.btn` 205-211, `.modal` 383-413, `.sheet` 219-227, `.switch` 57-62, toast 416-418). Local aliases map to tokens at 14-27 |
| Hex literals | 0 in `<style>`, 0 in JS/inline (grep `#[0-9a-f]{3,8}`) |
| rgb()/rgba()/hsl() | 0 in `<style>`, 0 in JS |
| Named colours | 1 outside print: `--on-solid:white` (26). About 25 inside `@media print` (495, 496, 504, 510, 511, 518-523, 525) |
| px font-sizes | 122 px and 6 pt in `<style>`. 0 use `var(--fs-*)`. Examples: body 17px (40), h1 30px (55), 15px (60), 26px (109), 28px (124), 9.5px (133), 22px (213); print 9pt/16pt (496, 503) |
| Radii | 23× `999px` (e.g. 57, 65, 104), 7× `50%` (e.g. 179, 272, 285), small literals 2-7px (81, 83, 92, 281, 373). Tokens: `var(--r)` 9, `var(--r-sm)` 15, `var(--r-lg)` 1 |
| Spacing | About 225 padding/margin/gap declarations with px, e.g. 44 `padding:0 22px`, 53, 100, 117. No `var(--sp-*)` used (0 matches). 676 px literals in `<style>` overall. 33 `letter-spacing` declarations, 28 of them literal em values. 23 literal transition/animation durations; 0 `var(--dur…)`/`var(--ease…)` |
| Media queries | prefers-reduced-motion 476 (kills every transition and animation with `!important`); hover 477-489; print 493; widths 88, 151, 152, 156, 338, 446, 456, 464. prefers-color-scheme / prefers-contrast / prefers-reduced-transparency: NOT FOUND IN CODE (searched `prefers-`) |
| font-family | `--serif:"New York",var(--font-serif)` (21); body `var(--font-sans)` (39); `var(--serif)` at 160, 178, 187, 321, 371, 409; `var(--font-sans)` at 161, 162, 179, 188, 322; `font:inherit` at 180, 216, 330, 350, 358, 394, 399; button `inherit` (45) |
| [data-scheme] | `:root[data-scheme="dark"]{--on-solid:var(--on-accent)}` (28); print (495) |
| [data-theme] / [data-kind] | `[data-theme]` only as a JS selector for theme buttons (2028, 2031). [data-kind]: NOT FOUND IN CODE (searched `data-kind`) |
| var(--accent) | 3, all in the copied glass recipe: 58, 385, 422 |
| Other | `.help` at 644 is defined only as `.ds .help` (apps/design.css:454), so it does not apply here. HTML inline styles: 530, 644 `margin-top:6px`, 771. JS inline styles: confetti `--dx/--dy/background` (1321-1322), textarea heights (1434, 1465, 1806), meter widths (1495, 1497), `style="--p…"` / `--n/--p/--gc` (1519, 1525), ring stroke (1577-1582), fallback-copy textarea (1884), view display (1996) |

#### 5. Bypasses of hub.js
| Kind | Lines (apps/f260.html) |
|---|---|
| localStorage | 898-900 (`lsLoad`/`lsSave`/`lsDrop`), used only for `LOCAL = {'f260.journal'}` (897) |
| sessionStorage / indexedDB / cookie | NOT FOUND IN CODE (searched those identifiers) |
| fetch / XHR / WebSocket / EventSource | NOT FOUND IN CODE |
| Other browser APIs | WebAuthn `navigator.credentials.get` 1062, `.create` 1071; `navigator.clipboard.writeText` 1879; `document.execCommand('copy')` 1885; `window.print` 1712; `crypto.subtle` 991 |
| External URLs (links, `target=_blank`) | biblegateway.com 971; esv.org 977; bible.com 979, 984; anchors 603 (href set at 1538), 1257, 1901 |
| Own sync/cache logic | `mergeRemote` defers remote merges while the vault is open, a modal or sheet is open, or an input is focused, and retries every 5 s (2072-2095). Serialised vault writes via `persistChain` (1014-1025). 300 ms debounced journal saves (1466, 1858, 1861) flushed on `pagehide` (1869). log/jstats trimmed to 400 keys (1662, 1819) |
| Own UI infrastructure | toast 1250 (not hub.toast); div-based modals 716-775 |

#### 6. Web tells
| Tell | Finding (apps/f260.html) |
|---|---|
| alert() | 1131 (browser without crypto) |
| confirm() / prompt() | NOT FOUND IN CODE. A custom `confirmModal` is used instead (1756-1762) |
| -webkit-tap-highlight-color | Not set in the app. Inherited transparent from apps/design.css:302 (body), 312 (button) |
| user-select / -webkit-touch-callout | `user-select:none` on hidden practice text (410). -webkit-touch-callout: NOT FOUND IN CODE (app and design.css) |
| :focus vs :focus-visible | `:focus-visible` outline at 46. `:focus{outline:none}` with a border swap at 181, 331, 351, 395, 400. design.css base `:focus{outline:none}` / `:focus-visible` (apps/design.css:313-314) |
| Native controls | `<select id="wkSel">` 619 (appearance reset 216, options 1710); `input type=search` 704; `type=password` 731-732; native checkbox 734 (22px, 398); textareas 747, 1286, 1296, 1417, 1900. `-webkit-appearance:none` at 78, 83, 180, 216, 330, 350, 358, 394, 399 |
| overscroll-behavior | Not in the app. Body `none` from apps/design.css:304. Horizontal `.miles` scroller with a hidden scrollbar at 191-192 |
| Spinners / skeletons | None. Status text instead: "Unlocking…/Encrypting…" 1163, "Waiting for Face ID…" 1149 |
| Emoji as UI glyphs | milestones 1219-1232; 🔥 1510, 1586; 🎉 759, 1338, 1541, 1568; ✓ 1443, 1560, 1595 |
| Press feedback / hover | `:active` scale at 87, 147, 207, 273, 293; hover gated to `(hover:hover) and (pointer:fine)` (477-489); `cursor:pointer` at 45, 78, 83, 160 |
| Hover-only info | `title` tooltips on heatmap days (1515), book-bar segments (1525), HEAR letters (1976), kids line (1619) |
| Small tap targets | Year-grid buttons 18px tall (83), 20px at ≤600px (88); book-bar buttons 14px tall, min-width 3px (76-77); `.mkm` 36px (292); `.recallrow` buttons min-height 40px (302) |
| Dialog behaviour | `role="dialog" aria-modal` divs (716, 727, 743, 756, 769); Escape closes them (2053-2060); first input focused after 50 ms (1143, 1902, 2013). Focus trap / `inert`: NOT FOUND IN CODE (searched `inert`, `'Tab'`) |

#### 7. Audience handling
| Audience | Finding |
|---|---|
| Kid mode | NOT FOUND IN CODE (searched `data-kind`, `isKid`, `kind === 'kid'`). The only kid reference lists kid profiles for the "Kids:" story line (1610). Kids are excluded by `visibleTo` (apps.json:4) |
| Kiosk / read-only | The kiosk profile `tv` (worker/seed.sql:11) is not in `visibleTo` (apps.json:4). Writes route through `save`/`drop`, which call `kioskNudge` (902-903). Done gets `aria-disabled` (1573); Undo is hidden (1574); Done click nudges (1591); day toggle nudges (1658); legacy cleanup is guarded (2067). No `canWrite` check before local state and UI change in: the memory-verse toggle (1648-1655), week stepper/select (1684-1689, 1707-1711), week expand/collapse (1678-1683, 1714-1715), source (1722), reading mode (1735), practice save/rating (1913, 1915), text size (2035), auto-lock (2051). Saves that run on their own at boot/render also reach `save()`: 938 (weekStart), 1245 (miles), 1503 (best), 1509 (summary) |
| Guest | NOT FOUND IN CODE (searched `guest`). Guests are `kind:'adult'` (index.html:544) and see apps open to any household adult (index.html:480), so F260 is open to them |

#### 8. Timers / loops
| Timer | Lines | Timestamp-based? |
|---|---|---|
| `setInterval(idleCheck, 15000)` plus a check on `visibilitychange` | 2048-2049 | Yes: `Date.now() - lastActive` (2043) |
| mergeRemote 200 ms debounce, then 5 s retries while busy | 2073, 2090 | n/a (a repeating setTimeout chain while the vault is open) |
| 300 ms save debounces | 1466, 1858, 1861 | n/a |
| One-shots (focus, toast removal, celebrate, confetti, complete, scroll, copy label) | 1143, 1250, 1316, 1322, 1672, 1700, 1878, 1902, 1985, 2013 | n/a |
| Double requestAnimationFrame for the ring intro (one-shot) | 1579 | n/a |
| CSS animations | pop 259, cf 261, flash 270, rise 271, toast 418 | — |
| Midnight rollover timer | NOT FOUND IN CODE (searched setInterval/setTimeout/visibilitychange; the only visibilitychange handler runs `idleCheck`, 2049). "Today" is recomputed only when `render`/`updateStats` runs | — |

#### 9. F260 specifics
| Topic | Finding (apps/f260.html) |
|---|---|
| Progress storage | `done` map `"week-day"→true` (908, 1659-1660); `log` of dates read (917, 1662); `weekStart`/`weekDone` (918-919, 1670, 1673, 1686). All person-scope hub rows (897, 902). `f260.summary {week, weekDone, total, streak, readToday, next, finished}` for Home (1506-1509) |
| Current week | Set by hand in `f260.week` (909, 913): −/+/select (1707-1711), "Start week N" (1340, 1703), or Today Done on a week ahead (1592). It is not derived from the calendar |
| "Today" / day index | `dayKey` uses the device's local date (932). `shiftDay`/`daysBetween` use local Date plus `Math.round` (933-934). Next reading = first unticked day from curWeek to 52, then 1 to curWeek−1 (1480-1489). ISO week is used only for the kids' line (1607). Heatmap is Monday-start (1512-1515) |
| Streak | `streakInfo` walks back from today up to 400 days; more than 2 missed days in a row breaks it; rest days are shaded (1385-1395, 94, 1515; label 594). Best streak at 1503. Journal streak uses the same rule over `jstats.days` (1954). "Quiet" state when the streak is 0 and the last read was 3 or more days ago (1530, 1558) |
| Pace / catch-up | `paceInfo`: earliest weekStart; covered = readings×7/5 days vs days elapsed; `|diff| < 2` days is "On pace"; projected finish (1396-1410). Today meta shows "· catching up" / "· starts week N" (1565). No automatic advance by date |
| Text size | `f260.big` (person) → `body.big{zoom:1.15}` (50, 2034-2035) |
| Auto-lock | `f260.autolock` ∈ {0, 5, 15, 30}, default 15 (920, 930, 2051). Activity listeners at 2040. Lock clears the in-memory data key (997, 1055, 2045) |
| Vault | The `f260.journal.vault` blob is written through hub (902, 1022; not in LOCAL 897). v2 layout at 987-990. AES-GCM-256 data key (1002, 1007) wrapped by a PBKDF2-SHA256 key: 200,000 iterations, 16-byte salt (996, 1003-1005, 1027); 12-byte IVs (1008, 1018). v1 upgrade at 1042-1049. Passcode minimum 4 characters (1160). Change passcode re-wraps only (1051-1054). WebAuthn PRF biometric wrap (1059-1091), removed from backups (1097). Legacy plaintext is folded in at first passcode (1029-1033). Stats hold counts only (1814-1821) |
| Backup | `F260BACKUP1.` + base64 JSON of the vault and progress, copied to the clipboard (1094-1100, 2012); restore at 1101-1124, 2016-2024. Not included: source, open weeks, auto-lock, text size, reading mode (1098) |
| Copy vs storage | Footer says "saved on this device" (713); "encrypted on this iPad" (1134); "never leaves this device" (1136); "deleted from this device" (1769); "encrypted on this device" (1959). The vault is written via `hub.set` (902, 1022) |
| Verse practice (a second trainer) | Modal 769-775, JS 1888-1917. Writes `f260.recall[id] = {s, t}` (1915), replacing the whole object and so dropping the `box/due/last/streak` fields that Verses writes (apps/verses.html:296) |

### verses — Verses (apps/verses.html)

#### 1. File facts
| Fact | Value | Evidence |
|---|---|---|
| Size / lines | 33,299 bytes / 388 lines | `wc` on apps/verses.html |
| apps.json entry | `"scope":"person"`, `"tile":"small"`, `"visibleTo":["eli","christian","mom","dad","niece","ezra","kiara"]`, `"color":"#5B8143"`, `"icon":"icons/verses.svg"`. There is no `dark` key | apps.json:12 |
| hub.js tag | `<script src="hub.js" data-app="verses" data-scope="person">` | apps/verses.html:149 |
| Scope match | Yes (person = person) | apps.json:12, apps/verses.html:149 |
| Precached | sw.js:11 (html), sw.js:13 (icon), sw.js:18 (`art/app/verses.svg`) | sw.js:11, 13, 18 |
| Embedded data | 52 weeks of memory-verse refs copied from F260's PLAN (178-192) | apps/verses.html:177-192 |

#### 2. Purpose and views
Purpose: a Leitner-box memory-verse trainer over the person's F260 memorised verses. Kids get only the family week's two verses.

| View | Lines (apps/verses.html) |
|---|---|
| Who pill (avatar, "N to go") | 101; JS 316 |
| Trainer card (kicker, box chip, reference, hint, veiled text, Read aloud/Show, Not yet/Almost/Got it) | 103-117; JS 321-330 |
| Done card ("All done for today", Practise again) | 119-124; JS 331-338 |
| Empty state (art) | 126-130 |
| Adults: stats and Leitner histogram | 132-140; JS 341-346 |
| Adults: Due today / Coming up queues | 142-147; JS 347-354 |

#### 3. hub.js usage
| Call | Lines (apps/verses.html) |
|---|---|
| hub.use('f260','person').use('kidverse','family') | 197 (154 is a comment) |
| hub.ready | 362 |
| hub.get | 213-217, 243 |
| hub.set | 243, 298 (×2) |
| hub.isKid | 222, 228, 242, 276, 311, 369 (getter at apps/hub.js:113) |
| hub.canWrite | 240, 292, 311, 367, 375 |
| hub.kioskNudge | 292, 367 |
| hub.toast | 270, 281, 298, 302 |
| hub.activity | 305 |
| hub.profile / hub.avatarHtml | 305, 316 / 316 |
| hub.onChange | 380 |
| Not used | remove, list, migrate, people, voiceInput, setTheme, sync |

| Key | App / scope | Read | Write |
|---|---|---|---|
| f260.mem | f260 / person | 213 | — |
| f260.recall `{box,due,last,streak,s,t}` | f260 / person | 214 | 298 |
| f260.verses | f260 / person | 215 | — |
| log `{date:n}` | verses / person | 216 | 298 |
| summary `{due,streak,boxes,total,reviewedToday,week,at}` | verses / person | 243 | 243 |
| week | kidverse / family | 217 | — |

#### 4. design.css usage
| Item | Finding |
|---|---|
| design.css linked / `.ds` | Yes, 7 / `<body class="ds">` at 99. Uses `.btn` (`btn-glass`, `btn-primary`, `btn-soft`), `.card`, `.pill`, `.chip`, `.glass-strong`, `.stat`, `.kicker`, `.avatar` plus local rules 13-96 |
| Hex / rgb / hsl / named colours | 0 / 0 / 0 in `<style>` and JS |
| px font-sizes | 1 (28: `16px`, avatar); clamp(34px…56px) and clamp(40px…64px) at 38-39; 15 declarations use `var(--fs-*)` |
| Other px literals | 23 in `<style>`: card min-heights 448/520/380px (33-35); `blur(9px)` (44); 64px (51, 67, 68); 200px (69); 72/68/4px bars (81-82); 28px (28, 94); breakpoints 560px (35, 49) |
| Radii / spacing | All tokens: 8 `var(--r-*)` radii and 23 `var(--sp-*)` spacing declarations; 0 px spacing |
| Media queries | prefers-reduced-motion 96. prefers-color-scheme / prefers-contrast / prefers-reduced-transparency: NOT FOUND IN CODE (searched `prefers-`) |
| font-family | `var(--font-display)` 38, 64; `var(--font-serif)` 43 |
| [data-kind] / [data-scheme] / [data-theme] | `[data-kind="kid"]` 34, 35, 39, 41, 51, 67. [data-scheme]/[data-theme]: NOT FOUND IN CODE |
| var(--accent) | 1 use (18); `--accent`/`-soft`/`-deep` are overridden per rating button (56-58) |
| Other | Inline `style="--p:…"` on histogram bars (346); `background-attachment: fixed` (19); safe-area padding tokens (20) |

#### 5. Bypasses of hub.js
| Kind | Finding |
|---|---|
| localStorage / sessionStorage / indexedDB / cookie | NOT FOUND IN CODE (searched those identifiers) |
| fetch / XHR / WebSocket / EventSource | NOT FOUND IN CODE |
| External resources | NOT FOUND IN CODE. Local only: design.css 7, `../art/app/verses.svg` 127, hub.js 149 |
| Other APIs | speechSynthesis 248-282 |
| Own sync logic | None. Reads F260's scope through `hub.use` (197) |

#### 6. Web tells
| Tell | Finding (apps/verses.html) |
|---|---|
| alert / confirm / prompt | NOT FOUND IN CODE |
| tap highlight / touch-callout | Not set in the app (apps/design.css:302, 312 apply). -webkit-touch-callout: NOT FOUND IN CODE |
| user-select | `none` on veiled text (44); `.ds .btn` also `none` (apps/design.css:355) |
| :focus / :focus-visible | None in the app. Relies on apps/design.css:313-314 |
| Native controls | None; buttons only (109-115, 123) |
| overscroll-behavior | Not in the app (apps/design.css:304) |
| Spinners / skeletons | None. `…` placeholder in the reference (105); "Reading…" label (279) |
| Hover-only info | `title` on histogram boxes (346) |
| Keyboard | Enter/Space reveals; 1/2/3 rate; Escape stops speech (373-378) |

#### 7. Audience handling
| Audience | Lines (apps/verses.html) |
|---|---|
| Kid | `hub.isKid`: the week's pair plus previously rated verses (222); due = not rated today, ignoring Leitner `due` (228); no "N more" in the kicker (323); speech rate 0.85 (276); no box chip or stats (324, 340); kid copy (327, 334); Practise again always offered and reopens the pair (336, 369); kid CSS 34-67 |
| Kiosk | `tv` is not in `visibleTo` (apps.json:12). Summary is not written (240); rate → kioskNudge (292); "This screen only looks…" hint and actions hidden (327-329); Again button hidden/nudges (336, 367); keys ignored (375) |
| Guest | NOT FOUND IN CODE (searched `guest`); guests are `kind:'adult'` (index.html:544) and see Verses (index.html:480) |

#### 8. Timers / loops
| Item | Finding |
|---|---|
| setInterval / setTimeout / requestAnimationFrame | NOT FOUND IN CODE (searched all three) |
| CSS | `pulse` infinite while speaking (54-55); transitions on veiled text and bars (43, 82); all turned off under reduced motion (96) |
| Midnight rollover | NOT FOUND IN CODE. "Today" is recomputed only on render: load (381), actions, and `hub.onChange` (380) |

#### 9. Verses specifics (Leitner)
| Topic | Finding (apps/verses.html) |
|---|---|
| Intervals | `[1, 2, 4, 7, 14]` days by box (193); labels at 194 |
| Box moves | Got it → min(5, box+1); Not yet → max(1, box−1); Almost → unchanged (295) |
| Due date | `due = shiftDay(today, INTERVALS[newBox−1])`, `last = today`; per-verse streak +1 / hold / 0; `s` is 'got' or 'not' (Almost counts as 'not') (296) |
| Legacy rows | Rows without Leitner fields become box 1 with `due` null, so they are due now (219, 229) |
| Date maths | Local `dayKey` (203); `shiftDay` via local Date (205); `daysBetween` with `Math.round` (206); due compared as `YYYY-MM-DD` strings (229, 233) |
| Queue order | Never reviewed first, then oldest due, then plan order (225-231). "Coming up" shows at most 12 (353). Labels from `whenLabel` (358) |
| Day streak | Consecutive days with at least one rating, ending today (or yesterday if today has none) (235) |
| Read aloud | Reference spoken as "chapter/verse" words (260-265), plus the verse text after Show if F260 stored it (272). Rate 0.95 adults / 0.85 kids (276). One voice picked once (250-257) |
| Feed line | Posted once the queue empties (305) |

### kidverse — Kid Verse (apps/kidverse.html)

#### 1. File facts
| Fact | Value | Evidence |
|---|---|---|
| Size / lines | 72,269 bytes / 683 lines | `wc` on apps/kidverse.html |
| apps.json entry | `"scope":"both"`, `"tile":"small"`, `"visibleTo":["ezra","kiara","eli","christian","mom","dad","niece"]`, `"color":"#B4861B"`, `"icon":"icons/kidverse.svg"`. There is no `dark` key | apps.json:11 |
| hub.js tag | `<script src="hub.js" data-app="kidverse" data-scope="both">` | apps/kidverse.html:180 |
| Scope match | Yes (both = both) | apps.json:11, apps/kidverse.html:180 |
| Scripts | Verse, stars and rewards IIFE 181-525; story IIFE 526-681 | apps/kidverse.html:181, 526 |
| Embedded data | 52 verse refs + paraphrases (187-240); 52 stories (536-589) | apps/kidverse.html:187, 536 |
| Precached | sw.js:11 (html), sw.js:13 (icon), sw.js:18 (`art/app/kidverse.svg` and `art/story/*.svg`) | sw.js:11, 13, 18 |

#### 2. Purpose and views
Purpose: the family's weekly F260 memory verse and story for pre-readers (art, a paraphrase, read-aloud), one star a day, badges, and an adult week stepper.

| View | Lines (apps/kidverse.html) |
|---|---|
| Who pill | 146; JS 348 |
| Scene art | 147; JS 346-347 |
| Reference and "Also this week" | 148-152; JS 349-351 |
| "In our own words" paraphrase card | 153-157; JS 352 |
| Read it to me / Done ★ | 158-161; JS 353-363 |
| My stars this week (kids) | 162; JS 356-361 |
| Story card (art, title, readings, text, Read it to me / I heard it) | 164-176; JS 648-668 |
| My rewards (kids) | 177; JS 491-501 |
| Grown-ups: week stepper and every kid's stars | 178; JS 365-376 |
| Confetti overlay | CSS 114-119; JS 316-322 |

#### 3. hub.js usage
| Call | Lines (apps/kidverse.html) |
|---|---|
| hub.use (conditional, before ready: prayer/family for kids, f260/person for adults) | 512, 513 |
| hub.ready | 514, 671 |
| hub.get | 274, 275, 276, 368, 419, 595, 604 |
| hub.set | 330, 331, 338, 478 (×2), 638, 639 |
| hub.list | 429, 441 |
| hub.onChange / hub.onSync | 503, 519, 676 / 504 |
| hub.profile | 324, 326, 331, 332, 337, 338, 344, 467, 469, 492, 512, 513, 632, 634, 639, 640, 649 |
| hub.canWrite / hub.kioskNudge | 325, 337, 469, 633 / 325, 337, 633 |
| hub.toast | 301, 312, 326, 328, 480, 484, 617, 627, 634, 636, 641 |
| hub.activity | 332, 481, 640 |
| hub.avatarHtml / hub.people / hub.skew | 348, 372 / 367 / 416 |
| Not used | remove, migrate, voiceInput, setTheme, isKid (uses `profile.kind`) |

| Key | App / scope | Read | Write |
|---|---|---|---|
| stars | kidverse / person | 274 | 330, 478 |
| stars:<kid> (mirror) | kidverse / family | 275 | 331, 478 |
| week `{week,by,at}` | kidverse / family | 276, 595 | 338 |
| ledger:<kid>:* | kidverse / family | 441 | — (written by the shell, index.html:1364) |
| story | kidverse / person | 604 | 638 |
| story:<kid> | kidverse / family | 419 | 639 |
| prayer:* (`prayedBy`) | prayer / family | 429 | — |
| f260.summary (week) | f260 / person | 368 | — |

#### 4. design.css usage
| Item | Finding |
|---|---|
| design.css linked / `.ds` | Yes, 7 / `<body class="ds">` at 144. Uses `.btn`, `.card`, `.pill`, `.glass-strong`, `.avatar`, `.kicker` plus local rules 12-141 |
| Hex / rgb / hsl / named colours | 0 / 0 / 0 in `<style>` and JS. Runtime `--tint` comes from profile data (372) |
| px font-sizes | 4: 16px (27), 10px (86), 22px (106), 10px (110). clamp at 36-37. 27 declarations use `var(--fs-*)` |
| Other px literals | 41 in `<style>`: day dots 36/38px (66, 71); 20px (68); badge icons 44/48px (83, 92); 24px (84); 64px minimum targets (50, 82, 134); 84px story art (124); 28px (27, 110); 40px avatar (106); 12px confetti (116); `gap:6px` (70), `gap:2px` (125); breakpoints 560px (49, 81, 133) |
| Radii / spacing | All radii tokens (16). 32 token spacing declarations, 2 px (70, 125) |
| Media queries | prefers-reduced-motion 119, 141, and in JS `matchMedia` 317. prefers-color-scheme / prefers-contrast / prefers-reduced-transparency: NOT FOUND IN CODE (searched `prefers-`) |
| font-family | `var(--font-display)` 36, 62, 78, 99, 127; `var(--font-sans)` 100 |
| [data-kind] / [data-scheme] / [data-theme] | `[data-kind="kid"]` 37, 44, 70, 71, 92, 130. Others: NOT FOUND IN CODE |
| var(--accent) | 17, 372 (JS fallback); `--accent` overridden at 55, 137 |
| Other | JS inline styles: confetti `--x/--c/--d` (320), `--tint` (372) |

#### 5. Bypasses of hub.js
| Kind | Finding |
|---|---|
| localStorage | `localStorage.getItem('hub.cache.kidverse.<scope>[.<pid>]')` (467) reads hub.js's private cache key directly (format at apps/hub.js:29) to check `since > 0` |
| sessionStorage / indexedDB / cookie | NOT FOUND IN CODE |
| fetch / XHR / WebSocket / EventSource | NOT FOUND IN CODE |
| External resources | NOT FOUND IN CODE. Local art `../art/story/*.svg` (147, 166, 346, 651) |
| Other APIs | speechSynthesis 280-313, 608-628; `matchMedia` 317 |
| Own sync logic | `reconcile` guard and reconciliation (465-489); runs after every pull via `onSync` (504) |

#### 6. Web tells
| Tell | Finding (apps/kidverse.html) |
|---|---|
| alert / confirm / prompt | NOT FOUND IN CODE (the parent Cash in / Reset week use `confirm()` in the shell, index.html:1367, 1373) |
| tap highlight / touch-callout / user-select | Not set in the app (apps/design.css:302, 312, 355 apply). -webkit-touch-callout: NOT FOUND IN CODE |
| :focus / :focus-visible | None in the app. Relies on apps/design.css:313-314. `.days span.today` uses `var(--focus)` ring (69) |
| Native controls | None; buttons only (159-160, 172-173, 369) |
| overscroll-behavior | Not in the app (apps/design.css:304) |
| Spinners / skeletons | None. `…` placeholders at 150, 155, 167, 169; "Reading…" label at 310, 625 |
| Hover-only info | `title` on day dots (date, 277) and badges (hint / earned date, 498) |
| Keyboard | Escape stops speech only (517, 674) |

#### 7. Audience handling
| Audience | Lines (apps/kidverse.html) |
|---|---|
| Kid | Done ★ only for kids (326, 356-361); kid kicker (349, 654); rewards card for kids only (493); reconcile only for kids (469); "I heard it" for kids only (634, 660-666); `hub.use('prayer')` for kids (512); kid CSS 37, 44, 70, 71, 92, 130 |
| Adult | Week stepper and "Use week N" (337, 369-376); `hub.use('f260')` (513) |
| Non-kid (adult, kiosk, guest) | Grown-ups panel with every kid's stars (365-376) |
| Kiosk | `tv` is not in `visibleTo` (apps.json:11). `award` (325), `setWeek` (337), `reconcile` (469) and `heard` (633) are blocked by `canWrite`. Non-adult setWeek, including kids, gets `kioskNudge` (337) |
| Guest | NOT FOUND IN CODE (searched `guest`). Guests are `kind:'adult'` (index.html:544) and see Kid Verse (index.html:480), so they get the week stepper (369) and can change the family week (337-338) |

#### 8. Timers / loops
| Item | Finding |
|---|---|
| setTimeout | Confetti removal after 1500 ms (321) |
| setInterval / requestAnimationFrame | NOT FOUND IN CODE |
| Pull-driven | `hub.onSync` whenever `lastPull` changes (504); hub pulls every 30 s while visible (apps/hub.js:342) |
| CSS | `pulse` infinite while speaking (57, 139); `fall` 1.2 s confetti (116-118) |
| Midnight rollover | NOT FOUND IN CODE as a timer. `dayKey`/`isoWeek` recompute on each render/reconcile (259, 261) |

#### 9. Kid Verse specifics
| Topic | Finding (apps/kidverse.html) |
|---|---|
| Week | Family `week` row, default 1 (253, 276). Scene per week (251-252). Local date (259); ISO week via UTC date maths (261); Monday-start week (262) |
| Stars row | `{week,count,days,total,earned,credited,badges,payouts,applied,earnedAt}` (381, 266-273, 402-412). A stale ISO week resets `count`/`days` and keeps `total` (270) |
| Verse ★ | Kid only, one per day (326, 328); `earnedAt` stamped with `hub.skew` (416); writes the person row and the family mirror (330-331); feed line (332); confetti (333) |
| Credits | Story days from family `story:<kid>` (418-425); prayed days from `prayer:*` `prayedBy[date]` name match (427-434). 14-day lookback (472); `earnedAt` kept 30 days (410) |
| weekCount | Verse days + credited story days + credited prayed days in the ISO week (414) |
| Ledger | Rows sorted by `at` then key (441). `applyLedger`: cash-in `total = max(0, total − amount)` and the payout recorded (last 50) (447-450); reset marks days up to `date` with `earnedAt ≤ at` as `'reset'`, one star off each (451-458); unknown kinds skipped (459); applied once via `applied[key]` (445, 460) |
| Badges | first / week / ten / story / prayer / fifty (392-399); awarded in reconcile (476-477); toast + confetti + feed (479-481) |
| Reconcile guard | Only after both kidverse scopes have been pulled (465-467); writes only on change (478) |
| Read-aloud | Verse: "This week's verse is <ref>. In our own words: <paraphrase>" at rate 0.85 (303, 307). Story: "This week's story: <title>. <story>" at 0.85 (621-622). Voice preference list (286, 613; the story IIFE re-picks on every call). Escape/pagehide cancel (517-518, 674-675). Two separate `speaking` flags (298, 609) |

| Kid-flow element | Text | Icon / visual | Spoken? |
|---|---|---|---|
| Reference h1 (150, 350) | Yes | — | Yes (303) |
| Paraphrase (155, 352) and disclaimer (156) | Yes | — | Paraphrase yes; disclaimer no |
| Read it to me (159) / Done ★ (160, 359) | Label | Speaker / star SVG | — |
| Stars card (361) | Count + sentence | Star; day dots show letters M-S or a star (263, 277) | No |
| Story title, readings, text (655-657); I heard it (173, 663); sub-line (665) | Yes | Check SVG | Title and story yes (621); readings and sub-line no |
| Rewards (496-500) | Heading, balance, badge names/hints, payout, how-to copy | Star/book/heart glyphs; numerals "7", "10", "50" as text (394-400) | No |
| Toasts (301, 312, 326, 328, 480, 484, 617, 627, 634, 636, 641) | Text only | — | No |
| Scene / story art (147, 166) | `alt=""` | Decorative | — |
| Confetti (316-322) | — | Visual only; off under reduced motion (317, 119) | — |

## 9b. Apps — Prayer, Larder Ledger, Tally, Kitchen timer

Shared base that applies to all four files because each links `design.css`. These rules are not scoped to `.ds`:
- `body`: `-webkit-tap-highlight-color:transparent`, `touch-action:manipulation`, `overscroll-behavior:none` (apps/design.css:302-304).
- `button`: tap highlight off and `touch-action:manipulation` (apps/design.css:312).
- `:focus{outline:none}` and `:focus-visible{box-shadow:var(--focus)}` (apps/design.css:313-314).
- Reduced motion: `animation-duration:.01ms; transition:none` (apps/design.css:611-613).

The shell lists no apps at all for the kiosk profile (`if (!p || p.kind === 'kiosk') return [];`, index.html:479). Each app's kiosk code therefore runs only when its file is opened directly.

### prayer — Prayer (apps/prayer.html)

#### 1. File facts
| Fact | Value |
|---|---|
| Size / lines | 104,830 bytes / 1,782 lines |
| apps.json entry | apps.json:6: `"scope":"both"`, `"tile":"small"`, `"visibleTo":["eli","christian","mom","dad","niece","ezra","kiara"]`, `dark` absent, `"color":"#8A6A4B"`, `"icon":"icons/prayer.svg"`. The kiosk id `tv` (worker/seed.sql:11) is not listed. |
| hub.js tag | apps/prayer.html:573 `<script src="hub.js" data-app="prayer" data-scope="both">` |
| data-scope matches apps.json scope | Yes (both / both) |
| Extra head meta | apple-mobile-web-app-* at apps/prayer.html:6-8; `<meta name="theme-color" id="themeColor" content="#F7F2EB">` at apps/prayer.html:9 |

#### 2. Purpose and views
Purpose: a personal list and a family prayer list, with a daily plan, a guided "Pray now" mode, a record of answered prayers, and kitchen, print and copy outputs.

| View / surface | Lines |
|---|---|
| Today screen `#s-today`: date + Mine/Family switch, headline, meter, stats strip, "Pray now" + More, cheer, review prompt, list, anniversaries, answered recently | apps/prayer.html:438-460 (render 874-932) |
| List screen `#s-all` (search + grouped list; answered prayers show only when searching) | 462-467 (render 941-956; rule at 946-948) |
| Record screen `#s-answered` (Needs attention, streak/calendar, Answered) | 469-477 (render 958-982) |
| Add screen `#s-add` (title + mic, for, detail, phone, category, cadence chips, days) | 479-501 (save 1429-1443) |
| Settings `#s-more` (plans, paste parser, categories, backup) | 503-532 (plans 1181-1227, paste 1456-1497, export/import 1500-1527) |
| Prayer mode overlay `#pray` | markup 537-551; CSS 323-351; logic 1610-1642 |
| Kitchen view overlay `#kitchen` | markup 553-556; CSS 353-364; logic 1645-1656 |
| Print area `#printArea` | markup 558; CSS 366-383; logic 1659-1674 |
| FAB / veil / sheet / toast | 560-563 |
| Detail sheet / edit sheet / More sheet | 985-1019 / 1026-1049 / 1725-1735 |
| Inline "ask" panel (stands in for native dialogs) | 1079-1126; CSS 221-231 |
| Bottom nav (Today, List, Record, Add, More) | 565-571; CSS 273-281 |
| Kid card list | 1578-1592; CSS 393-430 |
| `#lock` screen | CSS only, at 316-321 and 369. NOT FOUND IN CODE as markup (searched `id="lock"`, `'lock'`, `el('lock`). |

#### 3. hub.js usage
| Call | Lines |
|---|---|
| hub.ready | 1753 |
| hub.get | 626, 633, 634 |
| hub.list | 627 |
| hub.set (only via `put()`) | 655 |
| hub.remove | 692 |
| hub.migrate | 649-650 |
| hub.onChange | 1760 |
| hub.activity | 1318, 1329, 1606 |
| hub.canWrite | 686, 1765, 1775 |
| hub.profile | 725, 728, 1599 |
| hub.isKid | 727 (getter at apps/hub.js:113) |
| hub.people | 1549 |
| hub.avatarHtml | 1552-1553 |
| hub.profiles | 1762 |
| hub.voiceSupported / hub.voiceInput | 1765 / 1769 |
| hub.theme | 1532 |
| hub.kioskNudge, hub.onSync, hub.setTheme, hub.sync, hub.uid, hub.has | NOT FOUND IN CODE (searched `hub\.[A-Za-z_]+`) |

| Data key | Scope | Read | Write |
|---|---|---|---|
| `label`, `categories`, `prayerDays`, `plans`, `activePlan`, `rotationFor` (LIST_KEYS, 585) | person for the personal list, family for the shared list (SCOPE map, 586) | 626 | 689 → 655 |
| `prayer:<id>` (one row per request) | person and family | 627 | 691 → 655; removed at 692 |
| `activeList` | person | 633 | 694 (skipped for kids) |
| `lastExport` | person | 634 | 695 |
| Legacy `prayer-data-v3` (LEGACY_KEY, 584) | migrated to person (personal list) and family (shared list) | 649-650 | — |

- Row shape from Add: `{id,title,for,phone,detail,category,cadence,days,status,createdAt,lastPrayedAt,answeredAt,answerNote,updates[],sharedFrom,prayedBy{},by,updatedAt}` (1436-1439). Rows from the paste parser omit `prayedBy` and `updatedAt` (1486-1488).
- Ids are sequential per list: `p001…` from `nextId()` (719-721) and `s001…` for family shares (1312-1314). hub.uid is not used. Plan ids use `Math.random` (600).

#### 4. design.css usage
| Item | Finding |
|---|---|
| design.css linked | 10 |
| `class="ds"` on body | No: `<body>` at 433 |
| Own component CSS | Yes, all of 15-431. Tokens are mapped to local names at 22-36. The glass recipe is copied onto `nav`, `.sheet`, `.fab` and `#kitchen .close` at 283-305 (selector at 285). |
| Hex in `<style>` | 0 |
| Hex outside `<style>` | 3: HTML meta at 9 (`#F7F2EB`); JS at 1537 (`#1C1714`, `#F7F2EB`) |
| rgb/rgba/hsl | 0 in `<style>`, 0 in JS |
| Named colours | 6, all in `@media print`: `white` and `black` at 370, `dimgray` at 375 and 381, `silver` at 377, `black` at 379 |
| Inline style colours | Tokens only: 1002 (`var(--gold)`), 1174 and 1206 (`var(--muted)`) |
| px font-size | 62 in `<style>` (e.g. 46 `17px`, 53 `31px`, 55 `19px`, 66 `13.5px`, 102 `17.5px`). 2 in JS inline styles (1002 `14px`, 1174 `15px`). 5 `pt` sizes in print (370, 374, 375, 376, 378). 5 use tokens (402, 406, 408, 422, 428). One clamp at 335. |
| Radii | 25 literals: `999px` ×14 (e.g. 65, 67, 72, 107), `50%` ×6 (e.g. 87, 91), `26px 26px 0 0` (239), `18px` (277), `7px` (163), `0` (296), `2pt` (380). 8 use `var(--r…)` (e.g. 151, 175, 222). |
| Spacing | 124 padding/margin/gap declarations with px in `<style>` (e.g. 47, 50, 53, 61, 83); none use `var(--sp-*)`. 14 inline `margin-top:<n>px` in HTML/JS (e.g. 510, 513, 546, 962, 1483). |
| prefers-* media | `prefers-reduced-motion` at 384 (global `*{transition:none!important;animation:none!important}`). `prefers-color-scheme` is read in JS at 1533 and 1539-1540 (`matchMedia`, for the theme-color meta). `hub.theme()` never returns `'dark'` (apps/hub.js:72, 94), so the `t === 'dark'` test at 1533 never matches. The hex fallback at 1537 is used only when the computed `--bg` is empty. |
| font-family | 45: `"Manrope",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`. 148 and 338: `"Instrument Serif",Georgia,serif`. `inherit` at 66, 138, 174, 187, 192, 217, 247, 260, 276, 330, 345, 421. |
| [data-scheme] / [data-theme] | NOT FOUND IN CODE (only the comment at 37 mentions the resolved scheme) |
| [data-kind] | kiosk at 391; kid at 395-402 |
| var(--accent) | 13 (96, 115, 118, 140, 141, 184, 198, 201, 219, 289, 359, 387, 416). Also `--accent-deep` ×10 and `--accent-soft` ×4. Line 39 rebinds `--accent` to `var(--teal)` under `body.shared`, which is toggled at 875. |

#### 5. Bypasses of hub.js
| Item | Finding |
|---|---|
| localStorage / sessionStorage / indexedDB / cookie | No direct use. The only mention is the comment at 640; the legacy blob goes through hub.migrate (649-650). |
| fetch / XHR / WebSocket / EventSource | NOT FOUND IN CODE |
| External resources | Google Fonts (the grandfathered exception): preconnect to `https://fonts.googleapis.com` at 12 and `https://fonts.gstatic.com` at 13; stylesheet at 14. Local art: `../art/empty/prayers.svg` (920, 954). |
| Own sync/cache logic | `SNAP` records the last-written value per scope/key, and `put()` skips unchanged values (622-629, 652-656). `save()` rewrites every list key and row, and removes rows that are gone from memory (685-696). `absorbRemote()` defers a remote rebuild while a sheet, pray mode or an input is active, retrying every 4 s (697-705). `mergePrayer`/`mergeShared` (1677-1701) are dead code: `mergeShared(` appears only at its definition (1689), and `mergePrayer` is called only from inside it (1697). |
| Other device APIs | Clipboard `navigator.clipboard.writeText` (1133); `sms:` URL through `location.href` (1291); Blob download for export (1500-1506); `window.print()` (1738) |
| Copy about sync | The family-list delete confirm says "Sync does not carry deletions, so it can come back from another device." (1258-1259). The code does call `hub.remove` for rows that are gone (692). |

#### 6. Web tells
| Item | Finding |
|---|---|
| alert / confirm / prompt | None. The inline `ask()` replaces them; the comment at 1079-1083 gives iPad Safari in an iframe as the reason. |
| -webkit-tap-highlight-color | `transparent` on `*` (41) |
| user-select / -webkit-touch-callout | NOT FOUND IN CODE |
| Focus | `:focus-visible` at 95-96, 141, 201, 426. `:focus` on inputs/textarea/select at 184 (`outline:none` + accent border and ring). |
| Hover | Unguarded `:hover` at 93, 140, 190, 198, 219. No `@media (hover:hover)` in the file. |
| Native controls | Single `<select>` restyled with `appearance:none` + a gradient chevron (173-182); instances at 491, 508, 516, 1036, 1096, 1197. Native `<select multiple size="9">` at 1207 ("tap to toggle", 1206). `type=tel` at 489 and 1034. `type=password` ask branch at 1098 (no caller passes `kind:'password'`). Native `<details>/<summary>` disclosures at 471, 867, 951, with the marker hidden (130). |
| overscroll-behavior | NOT FOUND IN CODE in this file. It inherits `overscroll-behavior:none` from the design.css body (302-304). `touch-action:pan-y` is set on `#pray` (325). |
| Spinners / skeletons | NOT FOUND IN CODE |
| Toast | Auto-hides after 6 s (1142-1150). Undo after Mark answered (1331); "Open it" after sharing (1319). |

#### 7. Audience handling
| Audience | Lines |
|---|---|
| Kid | `KID()` = `hub.isKid` (727).<br>• Forced to the family list (638). Every route goes to Today (1154). The list switch is ignored (1272). `activeList` is not written (694).<br>• Kid headline (891-897). Kid cards (916, 1578-1592).<br>• `data-kpray` always sets prayed and never toggles off (1270).<br>• CSS hides nav, FAB, switch, actions, strip and the other screens (393-402). The Prayed button is at least 64 px (421). |
| Kiosk / read-only | CSS hides the FAB and Add (391). `save()` returns early when `!hub.canWrite` (686). The mic shows only when the profile can write (1765). Read-only toast (1775).<br>`setPrayed` (1265, 1593-1607) still changes in-memory state. Its `hub.activity` call has no app-level canWrite check, but `hub.activity` itself returns early for non-writers (apps/hub.js:374).<br>The shell never lists Prayer for the kiosk (apps.json:6 visibleTo; index.html:479). |

#### 8. Timers and loops
| Timer | Line | Timestamp-based? |
|---|---|---|
| `setTimeout(absorbRemote, 4000)` retry while busy | 703 | n/a |
| Toast hide `setTimeout(…, 6000)` | 1149 | n/a |
| CSS animations: rise, fade, slide, micpulse | 59-60, 236-242, 389-390 | — |
| `TODAY = iso(new Date())`, evaluated once | 712 | Midnight rollover: NOT FOUND IN CODE (no interval or visibility refresh). The day of week is recomputed from `new Date()` on each call (805, 811, 1185, 1412), while `TODAY` stays frozen. |
| Date maths: `dObj` uses `T12:00:00`; `daysSince` uses `Math.round` | 713-714 | — |

#### Prayer extras
| Topic | Finding |
|---|---|
| Two-list model | `lists.personal` maps to person scope and `lists.shared` to family scope (comment 575-582; SCOPE 586; load 630-639). Mine/Family switch at 442-445.<br>Family rows record `prayedBy[TODAY]` as a list of profile names, not ids (1597-1603). `by` is the author's profile id (725, 1317, 1439, 1488).<br>`lastPrayedAt` is a single field on the row (1596). Adult done-state and the meter read it (841, 884), so on a family row it reflects whoever prayed; kid cards read `prayedBy` by name (729, 1579).<br>"Send to family list" copies a personal request into the shared list with `sharedFrom` (1306-1323). |
| Answered history | Stored on the row: `status:'answered'`, `answeredAt`, `answerNote` (1329). History notes go in `updates[]` (1280, 1293). |
| Where answered prayers show | Today "Answered recently", last 30 days (928-931). Record → Answered, newest first (967-969). List search results (947-952). Detail sheet (1001-1003). Anniversaries (785-788). Milestones (766, 771-772). Print, last 90 days (1662, 1671-1673). "Put back on the list" (1335-1339). |
| "Pray now" | Button at 452. `startPrayMode` takes today's set not yet prayed, falling back to all of it (1611-1617). Controls: Back / Prayed / Skip (547-549, 1704-1708). Keys: Esc closes; → or Space marks; ← goes back (1709-1714). A swipe of ±60 px moves without marking (1715-1720). Progress bar (1628). Finish toast (1641). |
| Print / copy / kitchen | Behind More (451-454, 1725-1747).<br>• Kitchen: big type, all active requests by category (1645-1656).<br>• Print: `buildPrint` + `window.print()` (1659-1674, 1738), with print CSS at 367-382.<br>• Copy: today's set as bullet text (1128-1130, 1739-1746); per-category Copy inside `<summary>` (868, 1234-1240). If the clipboard fails, a "Copy this yourself" textarea panel opens (1132-1139). |
| Google Fonts exception | apps/prayer.html:14 `https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap` (preconnects at 12-13) |

### leftovers — Larder Ledger (apps/leftovers.html)

#### 1. File facts
| Fact | Value |
|---|---|
| Size / lines | 21,764 bytes / 383 lines |
| apps.json entry | apps.json:5: `"scope":"family"`, `"tile":"small"`, `visibleTo` absent, `dark` absent, `"color":"#3D5A3D"`, `"icon":"icons/leftovers.svg"` |
| hub.js tag | apps/leftovers.html:133 `<script src="hub.js" data-app="leftovers" data-scope="family">` |
| data-scope matches | Yes (family / family) |
| Title | `<title>The Larder Ledger</title>` at 6; the apps.json name is "Larder Ledger" |

#### 2. Purpose and views
Purpose: a shared fridge log. Each leftover is logged with a size and date, grouped by age, and crossed off when finished.

| View | Lines |
|---|---|
| Header: h1 + "N in the fridge" tally, lede, sync-status line | 102-107 (render 205) |
| Warning banner (items a week or older) | 109 (render 207-215) |
| Grouped list (Use it up / Aging / Fresh) | 111 (render 203-247; card 249-287) |
| Empty state with `../art/empty/fridge.svg` | 218-228 |
| Hearth copy section | 113-117 (logic 328-359) |
| Fixed glass add bar: name, mic, Log, size select, date | 120-131; CSS 32-63; submit 289-304 |

#### 3. hub.js usage
| Call | Lines |
|---|---|
| hub.ready | 172 |
| hub.migrate | 174 |
| hub.list | 176 |
| hub.canWrite | 180 |
| hub.onSync | 183-187 |
| hub.uid | 295 |
| hub.profile (id, name) | 296 |
| hub.set | 301 |
| hub.activity | 302, 309 |
| hub.get | 307 |
| hub.remove | 308 |
| hub.voiceSupported / hub.voiceInput | 315 / 320 |
| hub.kioskNudge | 293 |
| hub.onChange | 378 |

| Data key | Scope | Lines |
|---|---|---|
| `item:<id>` = `{id,name,size,dateLogged,by,byName}` | family | written 294-297 and 301; listed 176; read 307; removed 308 |
| Legacy `leftovers.items` array → `item:<id>` rows | family | 174 |

#### 4. design.css usage
| Item | Finding |
|---|---|
| design.css linked | 7 |
| `class="ds"` on body | No: `<body>` at 100 (the comment at 77 says "body has no .ds") |
| Own component CSS | Yes (8-98). The glass recipe is copied onto the form (32-45). |
| Hex | 0. `#add` at 195 is a JS selector. Line 96 writes the form id as an attribute selector to avoid the hex lint. |
| rgb/rgba/hsl | 0 |
| Named colours | 1: `white` inside `color-mix` at 80 (the other `white` matches at 24, 75 and 82 are `white-space`; `green` at 10 is in a comment) |
| JS colours | TONES use tokens only (138-142) |
| px font-size | 16, none via tokens (e.g. 23 `28px`, 24 `12px`, 47 `17px`, 55 `16px`, 76 `12.5px`) |
| Radii | 1 literal (`999px` at 82); 10 `var(--r…)` (e.g. 30, 41, 47); `inherit` at 79 |
| Spacing | About 34 px declarations, none via `var(--sp-*)` (e.g. 17 `32px`/`16px`, 22 `gap:12px`, 41 `padding:12px`, 66 `18px`) |
| prefers-* | `prefers-reduced-motion` at 97 |
| font-family | 16 `var(--font-display)`; 20 `var(--font-sans)`; 24 and 69 `var(--font-mono)` |
| [data-scheme] / [data-theme] | NOT FOUND IN CODE |
| [data-kind] | kiosk only, at 18 and 96 |
| var(--accent) | 1 (39, the glass pickup) |

#### 5. Bypasses of hub.js
| Item | Finding |
|---|---|
| localStorage / sessionStorage / indexedDB / cookie | NOT FOUND IN CODE |
| fetch / XHR / WebSocket / EventSource | NOT FOUND IN CODE |
| External URLs | Only the SVG namespace `http://www.w3.org/2000/svg` (157). Icons are inlined Lucide paths (149-155). |
| Own sync/cache logic | None. The sync banner reads hub.onSync (183-187). |
| Clipboard | `navigator.clipboard.writeText`, falling back to a hidden textarea + `document.execCommand('copy')` (339-347) |
| Test hook | `window.__larder` (376) |

#### 6. Web tells
| Item | Finding |
|---|---|
| alert / confirm / prompt | NOT FOUND IN CODE. Finish (✓) removes the item at once, with no confirm or undo (281, 306-311). |
| -webkit-tap-highlight-color | NOT FOUND IN CODE in this file; inherited from design.css (body 302, button 312) |
| user-select / -webkit-touch-callout | NOT FOUND IN CODE |
| Focus | `#name:focus` (49) with `outline:none` (48). No `:focus-visible` in the file; the select and date input get the design.css `:focus-visible` ring (apps/design.css:313-314). |
| Hover | None; `:active` at 57, 85, 95 |
| Native controls | `<select id="size">` at 127 and `<input type="date" id="date">` at 128, styled only for border, padding and height (52-53). The text input at 122 has `enterkeyhint="done"`. |
| overscroll-behavior | NOT FOUND IN CODE in this file; inherits `none` from design.css body (304) |
| Spinners / skeletons | NOT FOUND IN CODE |
| Layout | A ResizeObserver keeps `--addbar-h` in step with the bar height (199-201) |

#### 7. Audience handling
| Audience | Lines |
|---|---|
| Kid | NOT FOUND IN CODE (no `data-kind="kid"`, `isKid` or `kind` check). The app has no `visibleTo`, so kids see it (index.html:481). |
| Kiosk / read-only | `canEdit = hub.canWrite` (180).<br>• Kiosk CSS hides the Hearth section and the form (96) and shrinks the bottom padding (18).<br>• The ✓ button renders only for writers (275).<br>• Submit guard: `kioskNudge` + message (293).<br>• Mic and ResizeObserver only for writers (199, 315).<br>The shell lists no apps for the kiosk (index.html:479). |

#### 8. Timers and loops
| Timer | Line | Timestamp-based? |
|---|---|---|
| `setInterval(rollover, 60000)` | 374 | Yes: compares `todayStr()` to `dayKey` (364-373) |
| `visibilitychange` → `rollover()` | 375 | Yes |
| Copy-label reset `setTimeout(…, 2000)` | 357 | n/a |
| Mic pulse animation / bar width transition | 61-62 / 80 | — |

#### Larder extras
| Topic | Finding |
|---|---|
| Date maths | `todayStr()`: local date via the `getTimezoneOffset` shift (166). `daysBetween()`: `new Date(s+'T00:00:00')` compared with local midnight today, then `Math.floor(…/86400000)` (167). Because it floors over local midnights, a span that crosses a spring-forward DST change comes out one hour short of whole days and reads one day low. The date box defaults to today, with `max` = today (191-193). |
| Expiry | NOT FOUND IN CODE (no expiry field; age comes only from `dateLogged`) |
| Midnight rollover | Recomputes the day key and the date box's max/default, then re-renders (361-375) |
| Thresholds | `WARN_DAYS=7`, `AGING_DAYS=4`, `FULL_BAR_DAYS=10` (137) |
| Freshness states and colours | `statusFor`: 7+ days → "Use it up"/urgent; 4+ → "Aging"/warn; else "Fresh"/fresh (168-170).<br>TONES (138-142):<br>• fresh = `--ok` / `--ok-soft` / `--ok-ink`<br>• warn = `--warn` / `--warn-soft` / `--warn-ink`<br>• urgent = `--danger` / `--danger-soft` / `--danger-ink` |
| How the states show | Stripe, chip and bar tint set per card (256-258). Group heading ink (236). Bar `--p = days/10` (267). Groups listed oldest first (143-147, 204). |
| Copy for Hearth | `buildHearthText` lists items 4+ days old, marked "use it up" or "eat soon" (328-337). Button label states: idle / Copied / failed (350-354). Section copy at 114-115. |

### tally — Tally counter (apps/tally.html)

#### 1. File facts
| Fact | Value |
|---|---|
| Size / lines | 9,856 bytes / 161 lines |
| apps.json entry | apps.json:7: `"scope":"person"`, `"tile":"small"`, `visibleTo` absent, `dark` absent, `"color":"#4C7B6A"`, `"icon":"icons/tally.svg"` |
| hub.js tag | apps/tally.html:142 `<script src="hub.js" data-app="tally" data-scope="person">` |
| data-scope matches | Yes (person / person) |

#### 2. Purpose and views
Purpose: one personal tap counter. The page is a single view:
- "<name>'s counter" pill (130)
- watermark art (132)
- glass dial with the count (133-135)
- − and + buttons (136-139)
- "Reset to zero" (140)

#### 3. hub.js usage
| Call | Lines |
|---|---|
| hub.ready | 145 |
| hub.migrate | 147 |
| hub.profile.name | 149 |
| hub.get | 150 |
| hub.canWrite / hub.kioskNudge / hub.set | 152 |
| hub.onChange | 156 |

| Data key | Scope | Lines |
|---|---|---|
| `count` (number, clamped to 0 or more) | person | read 150; write 152 |
| Legacy `tally.count` → `count` | person | 147 |

#### 4. design.css usage
| Item | Finding |
|---|---|
| design.css linked | 7 |
| `class="ds"` on body | Yes (129) |
| Own component CSS | Yes: `.dial` and `.tbtn` use the glass recipe (38-87). Reset uses the design.css `.btn .btn-ghost` (140), restyled at 95-114. |
| Hex / rgb / hsl / named colours | 0 / 0 / 0 / 0 (the `white` match at 119 is `white-space`) |
| px font-size | 0 literals. The count uses `clamp(96px, 26vw, 168px)` inside a `min()` (60); the buttons use `var(--fs-3xl)` / `var(--fs-4xl)` (72, 84). |
| Hardcoded px sizes | `.tbtn` 96×96 (70); `.big` 140×140 (84); kid sizes 116 and 168 (122-123); dial `clamp(240px,74vw,360px)` (40) and the kid dial (124); `.art` `clamp(110px,18vw,200px)` (36); `inset:10px` (54); shadow `0 30px 70px -30px` (50); focus outline `3px` / offset `3px` (83) |
| Radii | All `var(--r-full)` (43, 70, 106, 118); `inherit` at 54 |
| Spacing | All `var(--sp-*)` (6 declarations, e.g. 32, 64, 106) |
| prefers-* | `prefers-reduced-motion` at 126 |
| font-family | 58 `var(--font-display)`; `font: inherit` at 72 |
| Selectors | `[data-scheme="dark"]` at 26; `[data-kind="kid"]` at 122-124 |
| var(--accent) | 8 (14, 15, 27, 28, 29, 47, 75, 100); plus `--accent-deep` (16) and `--accent-glow` (50) |

#### 5. Bypasses of hub.js
None. localStorage, fetch and external URLs: NOT FOUND IN CODE. The art loads locally from `../art/app/tally.svg` (132).

#### 6. Web tells
| Item | Finding |
|---|---|
| alert / confirm / prompt | NOT FOUND IN CODE |
| -webkit-tap-highlight-color | NOT FOUND IN CODE in this file; inherited from design.css (body 302, button 312) |
| user-select | `none` on body (22) and `.art` (36) |
| -webkit-touch-callout | NOT FOUND IN CODE |
| Focus | `:focus-visible` on `.tbtn` (83) |
| Hover | Guarded by `@media (hover:hover) and (pointer:fine)` (88-90, 109-111); `:active` at 82 and 108 |
| Native controls | NOT FOUND IN CODE |
| touch-action / overscroll-behavior | NOT FOUND IN CODE in this file. Inherited from design.css: `touch-action:manipulation` on body and buttons (303, 312) and `overscroll-behavior:none` on body (304). |
| Spinners / skeletons | NOT FOUND IN CODE |

#### 7. Audience handling
| Audience | Lines |
|---|---|
| Kid | CSS only: bigger buttons and dial (122-124). No `visibleTo`, so kids see it (index.html:481). |
| Kiosk / read-only | `if (!hub.canWrite) { hub.kioskNudge(); return; }` (152). The shell lists no apps for the kiosk (index.html:479). |

#### 8. Timers and loops
NOT FOUND IN CODE. The only motion is CSS transitions (61, 80, 107).

#### Tally extras
| Topic | Finding |
|---|---|
| Tap targets | + is 140 px and − is 96 px, with `min-width/height: var(--tap)` (70, 84). Kids get 168 / 116 px (122-123). |
| Undo | NOT FOUND IN CODE. Reset sets 0 at once with no confirm (155). |
| Rapid taps | Each click reads `hub.get('count')` and writes +1 synchronously, with no debounce or throttle (150-154). Double-tap zoom is suppressed only by the inherited `touch-action:manipulation` (apps/design.css:312). Haptics (`navigator.vibrate`): NOT FOUND IN CODE. |
| Multiple counters | No: one `count` key per person (150-152) |

### timer — Kitchen timer (apps/timer.html)

#### 1. File facts
| Fact | Value |
|---|---|
| Size / lines | 8,676 bytes / 141 lines |
| apps.json entry | apps.json:8: `"scope":"person"`, `"tile":"small"`, `visibleTo` absent, `dark` absent, `"color":"#B8623A"`, `"icon":"icons/timer.svg"` |
| hub.js tag | apps/timer.html:73 `<script src="hub.js" data-app="timer" data-scope="person">` |
| data-scope matches | Yes (person / person) |

#### 2. Purpose and views
Purpose: a preset countdown that keeps running across the hub. The page is a single view:
- Title mark (53), hidden below 640 px viewport height (19).
- Glass dial with a progress ring and the time (54-59).
- Six preset chips (60-67).
- Start/Pause and Reset (68-71).
- Done state: danger-coloured ring and blinking digits (12, 35-39).

#### 3. hub.js usage
| Call | Lines |
|---|---|
| hub.ready | 76 |
| hub.get | 81, 90 |
| hub.canWrite | 91, 124 |
| hub.set | 91, 124 |
| hub.has / hub.remove | 91 |
| hub.onChange (filtered to `ch.app === 'timer'`) | 130-137 |
| hub.profile, hub.kioskNudge, hub.activity | NOT FOUND IN CODE |

| Data key | Scope | Lines |
|---|---|---|
| `timer.active` = `{endAt, total, startedAt}` | person | Key at 80; read at 90; written on Start at 117. Cleared through `write(null)` (91) on pause (114), reset (120), preset (123) and finish (102). |
| `lastPreset` (seconds) | person | read 81; write 124 |

#### 4. design.css usage
| Item | Finding |
|---|---|
| design.css linked | 7 |
| `class="ds"` on body | Yes (51) |
| design.css classes used | `.glass` (54), `.ringwrap.lg` / `.ring.ring-lg` (55-56), `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-lg` (61-70) |
| Own CSS | Dial, time, presets and done state (9-48) |
| Hex / rgb / hsl / named colours | 0 / 0 / 0 / 0 (the `white` match at 43 is `white-space`) |
| px values | Time `clamp(56px,16vw,92px)`, then overridden by `24cqw` (31; container at 23). `.hd img height:44px` (17). `drop-shadow(0 2px 6px …)` (26). Done ring `0 0 0 6px` (36). `stroke-width:3` (27). Widths `560px` (13), `400px` (22), `640px` (48). Media queries at `640px` (19) and `720px` (48). |
| Radii | All `var(--r-full)` (22, 43) |
| Spacing | All `var(--sp-*)` (9 declarations, e.g. 13, 42, 46) |
| prefers-* | NOT FOUND IN CODE in this file. The blink (38) and transitions are covered by the global rule at apps/design.css:611-613. |
| font-family | 32 `var(--font-sans)`; `font: 600 var(--fs-lg) var(--font-display)` at 18 |
| [data-scheme] / [data-theme] / [data-kind] | NOT FOUND IN CODE |
| var(--accent) | 2 (22, 44); plus `--accent-strong` (32), `--accent-soft` (44) and `--accent-deep` (44) |

#### 5. Bypasses of hub.js
None. localStorage, fetch and external URLs: NOT FOUND IN CODE. The art is local, `../art/app/timer.svg` (53). `AudioContext` is used for the beep (93-101).

#### 6. Web tells
| Item | Finding |
|---|---|
| alert / confirm / prompt | NOT FOUND IN CODE |
| -webkit-tap-highlight-color | NOT FOUND IN CODE in this file; inherited from design.css (body 302, button 312) |
| user-select | `none` on body (10) |
| Focus / hover styles | NOT FOUND IN CODE in this file. Comes from design.css: the `:focus-visible` ring (apps/design.css:314) and `.ds .btn:hover` under `@media (hover:hover) and (pointer:fine)` (apps/design.css:372-373). |
| Preset state | Class `on` only (88); `aria-pressed` NOT FOUND |
| Native controls / custom duration input | NOT FOUND IN CODE (the six fixed presets at 61-66 are the only durations) |
| overscroll-behavior | NOT FOUND IN CODE in this file; inherits `none` from design.css body (304) |
| Spinners / skeletons | NOT FOUND IN CODE |

#### 7. Audience handling
| Audience | Lines |
|---|---|
| Kid | NOT FOUND IN CODE. No `visibleTo`, so kids see it (index.html:481). |
| Kiosk / read-only | `write()` is a no-op without `hub.canWrite` (91). The comment at 79 says the display profile runs only a local timer. `lastPreset` is written only for writers (124). No kioskNudge. The shell lists no apps for the kiosk (index.html:479). |

#### 8. Timers and loops
| Timer | Line | Timestamp-based? |
|---|---|---|
| `setInterval(step, 250)` | 111 | Yes: `left = max(0, round((endAt − Date.now())/1000))` (108) |
| `clearInterval` on stop and at the start of `run` | 92, 104 | — |
| Ring `stroke-dashoffset .5s linear` transition | 29 | — |
| Done blink `animation: blink 1s steps(2) infinite` | 38-39 | — |

#### Timer extras
| Topic | Finding |
|---|---|
| Remaining time | Computed from `endAt` on every tick (107-111), not by counting ticks. On open, the app resumes a record whose `endAt` is still in the future (127-129).<br>Remote changes (130-137): a new `endAt` is adopted. If the record is cleared elsewhere, the app finishes when 1.2 s or less was left, and otherwise stops. |
| Alert while the app is open | Three 880 Hz Web Audio beeps (93-101) + done class (102) |
| Alert when backgrounded (Notification) | NOT FOUND IN CODE in timer.html. The shell handles it (index.html:773-828).<br>• Ticks the pill every second from its own page `setInterval` (index.html:822), and re-checks on onChange, pull and visibilitychange (index.html:826-828).<br>• `finishTimer` (index.html:804-812) beeps only if the profile can write (808). It shows a local service-worker notification only if permission is `granted` and a registration exists (index.html:797-803).<br>• Both happen only when the Timer app is not open and the timer ended less than 60 s ago (index.html:806-810); otherwise the record is just cleared (809).<br>• No push and no scheduled notification: NOT FOUND IN CODE. |
| Wake Lock | NOT FOUND IN CODE in timer.html. The shell requests `navigator.wakeLock` on the first pointerdown, app-wide. It re-requests on visibility only if a lock was obtained before (index.html:1708-1712). |
| Multiple timers | No: one `timer.active` record per person (80) |

## 9c. Apps — Dollywood build guide and park map (generated)

Both files come from one template, `../dollywood-build-project/scripts/template.html` (1,743 lines). `build_html.py` renders it in the `hub` and `live` flavours (build_html.py:40-42), and `export_hub.py` copies the results here (export_hub.py:35-39). `git status` shows no change to `apps/` since baseline fe6041d. Both exports use CRLF line endings. Byte figures below count LF but not CR.

### Shared: source-to-export line map

| Export lines | template.html lines | What changed |
|---|---|---|
| 1–682 (both files) | 1–682 | Placeholders only: `__FLAVOR__` 2, `__TITLE__` 5, `__FONTS__` 6 (empty for hub/live, build_html.py:93), `__GRASS__` 388/664 → `#72964e`, `__DATA__` 682. In the park map, 587, 605 and 611 are also blanked (STRIP3D). |
| 683–685 | 683 (`__HUBJS__<script>`) | design.css link, hub.js tag (build_html.py:27-28), then `<script>` |
| 686–694 | 684–692 | Offset +2. Line 688 `const FLAVOR='hub'\|'live'` comes from `__FLAVOR__` at template 686. |
| 695–696 | 693 | Basemap constants rewritten to point at files beside the page (build_html.py:34-35, 98) |
| 697–1033 | 694–1030 | Offset +3 |
| 1034 | 1031–1032 | Reference-only Light/Dark toggle and its `dw-theme` localStorage removed (build_html.py:90-92) |
| dollywood.html 1035–1742 | 1033–1740 | Offset +2 |
| dollywood.html 1743–1749 / 1750–2795 / 2796 | 1741 `__THREE__` / 1742 `__ORBIT__` / 1743 | three.js r128 and OrbitControls inlined (build_html.py:78, 103) |
| dollywood-live.html 1152 / 1153 / 1154 | 1150–1153 / 1154 / 1155–1282 | `setMode(m){mode='2d'}` stub, then the unchanged `if($('m-2d'))` line, then the `init3D(){}` stub (build_html.py:67-70) |
| dollywood-live.html 1155–1612 | 1283–1740 | Offset −128 |
| dollywood-live.html 1613 / 1614 | 1741–1742 / 1743 | three.js/OrbitControls scripts stripped, leaving a blank line (build_html.py:39, 102) / `</body></html>` |

- **Park-map line numbers:** identical to the build guide through line 1151. From build-guide line 1285 (park-map 1155) onward, park-map line = build-guide line − 130.
- **Markup removed from the park map:** lines 587, 605 and 611 are blank there (the 2D/3D toggle, `#view3d`, the exaggeration slider; STRIP3D build_html.py:36-39, 101-102).
- **Both files carry all the 2D, build-guide and park-map code.** The park map drops only the `setMode` body, `init3D` and three.js. Both branch at runtime on `const FLAVOR` (688) and `html[data-flavor]` (2). Line numbers in these bullets are build-guide lines.
  - `FLAVOR==='live'` gates `liveInit()` (1740), `loadWaits` (1629) and `drawAmen` (1696).
  - `FLAVOR!=='live'` gates:
    - the popovers and More button (1042-1045)
    - the phone build sheet and legend (1135-1149)
    - `liveDefs()`, the SVG filters, which run in the build guide (1736)

### Shared: apps/dollywood/ assets

| File | Bytes | Used by | Loaded when | Precached |
|---|---|---|---|---|
| relief_soft.jpg | 666,582 | Build guide `IMG` (696) | Boot `<image>` 744, minimap 865, coaster card 998, 3D texture 1213 | sw.js:16 |
| illustrated_lo.jpg | 403,725 | Build guide `ILL` (696) | "Park map (illustrated)" basemap (596 → 1032, also the minimap there), 3D texture 1213 | sw.js:16 |
| relief.jpg (the illustrated park sheet, from `basemap_illustrated.jpg`, build_html.py:32) | 1,133,324 | Park map `IMG` (live 696) | Boot 744, minimap 865, card 998 | sw.js:16 |
| aerial.jpg | 1,665,156 | Both, `AER` | Aerial/mix basemap (1032); build-guide 3D texture (1213); park map "Satellite" (635 → `setStyle` live 1415) | Skipped (bump-sw.mjs:18) |
| slope.png | 101,368 | Both, `SLOPE` | Steepness toggle (1027; in the park map it is reached through the Style pane, live 1464) | sw.js:16 |

Other assets:
- `../art/app/dollywood.svg`: header art, line 568. The header is hidden in the park map (CSS 386).
- `../art/app/dollywood-live.svg`: `.lv-empty::before`, CSS 442.
- `apps/dollywood.html` itself is on the precache skip list (bump-sw.mjs:18); `apps/dollywood-live.html` is precached (sw.js:16).
- Embedded images: the only `data:image` URI in either file is the park map's 1×1 GIF for `ILL` (live 696, build_html.py:76). A grep for `data:image` in dollywood.html returns 0.

---

### dollywood — Dollywood build guide (apps/dollywood.html)

#### 1. File facts

| Fact | Value |
|---|---|
| Size / lines | 2,243,914 bytes / 2,796 lines |
| apps.json | apps.json:9 — `"scope":"person"`, `"tile":"small"`, `"visibleTo":["eli","christian","mom","dad","niece"]`, `"dark":true`, `"color":"#7A4FA3"`, `"icon":"icons/dollywood.svg"` |
| hub.js tag | 684 `<script src="hub.js" data-app="dollywood" data-scope="person">`. Matches apps.json scope. |
| Source default entry | export_hub.py:17 has `"icon":"🎢"` and no visibleTo. The export never overwrites an existing entry (export_hub.py:26). |
| `<html>` / title | `<html lang="en" data-theme="dark" data-flavor="hub">` 2; `<title>` 5; no `theme-color` meta (meta tags at 2-4 only) |
| Weight | Payload JSON 682 = 1,369,159 B; three.js 1743-1749 = 603,463 B; OrbitControls 1750-2795 = 26,393 B. Together about 89% of the file. `<style>` 6-566 ≈ 72 KB; app JS 685-1742 ≈ 154 KB, of which the 3D block 1151-1284 ≈ 19 KB. |
| Payload keys (JSON chars) | grid 520,965 · contours 487,829 (10/20/50/100 ft) · layers 178,295 · steps 117,643 (242) · official 27,091 (145) · sections 8,235 (13) · amen 4,225 (63) · facts 3,594 |

#### 2. Purpose and views

Purpose: a reference for rebuilding the park in Planet Coaster 2. It overlays USGS terrain, OpenStreetMap geometry and the 145 official 2026 listings on one frame, and tracks each person's progress through 242 build steps in 13 sections (570).

| View / surface | Markup | CSS | JS |
|---|---|---|---|
| Header: hero art, title, 4 stats | 567-577 | 17-23, 233-238 | 735-738 |
| Section chips with per-section done bars | 578 | 143-153, 239-244, 293-296, 316-321 | 1075-1076, 1115-1127 |
| Toolbar (Navigate / View menu / Terrain / Search / More) | 581-602 | 34-37, 154-167, 245-247, 322-347 | 819-827, 1030-1045 |
| 2D map, readout, map hint, minimap | 603-609 | 38-53, 196-197, 259-292 | 741-868 |
| Popup card (listing / building / coaster) | 610 | 113-129, 290-292 | 956-1003 |
| 3D terrain and exaggeration slider (plus a JS-made "Reset view" button, 1283) | 605, 611 | 43-46, 51-52, 350, 354-355 | 1151-1284 |
| Coaster legend and "?" shortcuts popover | 639-641 | 168-179 | 1148-1149 |
| Build steps (card on desktop; bottom sheet peek/half/full below 700 px) | 643-650 | 82-102, 180-190, 253-254, 303-307, 359-377 | 1059-1101, 1129-1147 |
| Cross-section profile | 652-656 | 103-109, 198-200 | 919-954 |
| Side tabs: Listings / Layers / Scale | 659-678 | 54-81, 248-252 | 957-959, 1005-1057 |
| Footer credits | 680 | 137; hidden by 255 | — |
| Park-map overlays, present but hidden | 612-637 | hidden by 565 | 1286-1735, run only via `liveInit` |

Park-map helpers also run here. `apply()` calls them without a flavour check (808), and one more runs at load:
- `drawMe` (exported at 1735)
- `scheduleNames` (1318) → `drawNames` (1353-1364), which also toggles `.mk` marker display (1356)
- `drawAmen` (returns early, 1696) and `drawMeet`
- `liveDefs()` (1736), run because it is gated on `FLAVOR!=='live'`

#### 3. hub.js usage

| Call | Lines |
|---|---|
| `hub.ready({optional:true})` | 1105 (the park-map call at 1611 does not run here) |
| `hub.profile` | 692, 693, 694, 1053, 1106 (the rest, 1308-1731, are park-map code) |
| `hub.get` | 693 (family `kidshare:<id>`), 694 (person `share`), 1109, 1111 (`progress`), 1110 (`plot`); park-map code: 1437, 1669, 1709, 1731 |
| `hub.set` | 1055 (`plot`), 1062 (`progress`); park-map code: 1383, 1438, 1440, 1678, 1717 |
| `hub.remove` / `hub.list` | Park-map code only: 1385, 1438, 1442, 1718 / 1384 |
| `hub.onChange` | 1112 (`adopt` reloads progress/plot); 1613 (park map) |
| `hub.onSync` | 1613 (park map) |
| `hub.activity` | 1086 (`'Ticked '+now.title`); 1717 (park map) |
| `hub.migrate` | 1107: `dollywood-build-progress-v2` → `progress`, `dw-plot` → `plot` (1103 is a comment) |
| `hub.canWrite` | 694, 1054, 1055, 1062; park-map code: 1385, 1430, 1437, 1570, 1589, 1678, 1715, 1716 |
| `hub.kioskNudge` | 1054, 1062; 1678 (park map) |
| `hub.people` / `hub.photoUrl` / `hub.sync` / `hub.api` / `hub.request` | Park-map code only: 1668, 1730 / 1346 / 1428 / 1629 / 1719 |
| `hub.avatarHtml`, `hub.voiceInput`, `hub.setTheme`, `hub.sheenFrom`, `hub.toast` | NOT FOUND IN CODE (searched `hub\.<name>`) |

| Key | Scope | Read | Write |
|---|---|---|---|
| `progress` — `{stepId:true}` | person | 1109, 1111 | 1062 (save); migrated 1107 |
| `plot` — plot width string | person | 1110 | 1055; migrated 1107 |

- This file declares only the person scope (684). hub.js throws for an undeclared scope (hub.js:198-202).
- Family-scope calls still sit in shared code (693, 1383-1442, 1669-1718, 1731). Each is inside try/catch.
- `hub.migrate` marks a migration done per app and scope (hub.js:398) and does not remove the legacy key (hub.js:402-407).

#### 4. design.css usage

- **design.css link:** line 683, inside `<body>`, after the page's own `<style>` in `<head>` (6-566).
- **`class="ds"` on body:** no (566 `<body>`). design.css component classes are scoped to `.ds` (design.css:349, 388), so none apply.
- **Own component CSS:** yes, all of it (`.pop`, `.chips`, `.toolbar`, `.build`, `.pill` 90-92, `a.btn` 77/124).
  - design.css tokens come in through a flavour remap (212-220): `--ink:var(--bg)`, `--panel:var(--surface)`, `--dim:var(--muted)`, `--ochre:var(--gold)` and so on.
  - The liquid-glass recipe is copied inline rather than taken from `.glass` classes (215, 234, 245, 249, 287, 290).

| Colour literals | Hex | rgb()/rgba() | hsl() | Other |
|---|---|---|---|---|
| `<style>` 6-566 | 144 on 50 lines (84 unique; `#fff` ×15) | 35 | 0 | 56 `color-mix()` |
| Markup 567-681 | 4 (620, 664 ×3) | 0 | 0 | — |
| JS 685-1742 | 146 on 82 lines (37 in 3D block 1151-1284) | 6 (3D canvas: 1203, 1204, 1206, 1207, 1225, 1229) | 0 | `0xffffff` 1184 |

Examples:
- `<style>` hex: 7 (reference palette), 217 (`--cat-attr:#FF6B4A`), 270 (building fills), 495 (wait-band fills), 517 (`.lv-meet .f`).
- `<style>` rgba: 111, 113, 393, 420, 534.
- JS hex: 733-734 (`MKCOL`/`BCOL`), 748-754, 775 (`HUES`), 1025 (`TOG`), 1694 (`AMEN`).

Hardcoded sizes in `<style>` (no `--fs-*`, `--sp-*`, `--r`/`--r-*` or `--tap` token is used anywhere):
- `font-size` in px: 141. Most common: 13px ×25, 12.5px ×25, 12px ×14, 15px ×11. Two `clamp()` (19, 237).
- `border-radius` in px: 78 declarations, including `999px` ×15; plus `50%` ×18 and `0` ×7. Examples: 25 (3px), 164, 422 (24px 24px 0 0).
- Padding px: 112. Margin px: 81. Gap px: 73. Examples: 16, 224 (`min-height:44px`), 233.
- Because of this, the kid and kiosk token scales (design.css:280-289) do not reach this app. The one exception is `--blur`, used through `--lv-blur` (215) and directly in `backdrop-filter` at 287, 290, 298, 299, 322.

Hardcoded sizes in JS and markup:
- 5 fixed `font-size` values in JS: 936, 987, 995, 1012 ×2. Park-map code adds a fixed 11/12px at 1698.
- Zoom-scaled font sizes in JS:
  - 8 in template strings (`font-size:${…*k}px`): 874, 1331, 1332, 1339, 1341, 1348, 1351, 1712
  - 3 through `style.fontSize=`: 804, 805, 1364
- Inline `font-size` in markup: 645, 672, 673, 676.

Media queries:
- `prefers-reduced-motion` at 139 disables transitions only. JS 813 also skips map tweens under reduced motion.
- `prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-transparency`: NOT FOUND IN CODE (searched `prefers-`).
- Other CSS queries: `max-width` 33, 88, 129, 236, 257, 313; `pointer:coarse` 130; `print` 138.
- JS `matchMedia`: `pointer:coarse` 607, 824, 1161; `max-width:699px` 689 (`PHONE()`, hub flavour only) and 1178.

`font-family` declarations:
- Archivo, system-ui, sans-serif: 14.
- Fraunces, Georgia, serif: 19, 111.
- Fraunces, serif: 22, 59, 84, 93, 105, 116.
- Archivo, sans-serif: 117, 131.
- `var(--font-sans)`: 222, 277, 494, 518, 539, 545, 550, 551, 564.
- `var(--font-display)`: 223, 306.
- Canvas: `800 50px system-ui,Segoe UI,Roboto,sans-serif` at 1226, `800 84px …` at 1228.
- Archivo and Fraunces are never loaded in the hub or live flavours; web fonts load only in the reference flavour (build_html.py:22-23, 93).

Theme and audience selectors:
- `[data-scheme=light]` 10; `:root[data-scheme=dark][data-flavor=…]` 219.
- `:where([data-theme=light])` 11. No hub theme has the id `light` (hub.js:64-71), and hub.js maps `light` to hearth.
- `data-theme="dark"` is hard-set on `<html>` (2). design.css:156 maps it to Midnight until hub.js:77 replaces or deletes it.
- `[data-kind]`: NOT FOUND IN CODE.
- 309 `data-flavor` selectors.

`var(--accent)`:
- 44 in `<style>` (43 plain plus 1 `var(--accent,#2F80ED)` at 551; e.g. 215, 290, 428, 504, 529), plus `var(--accent-deep)` ×14 (225, 244, 329, 453, 458).
- 10 in JS, all written as `var(--accent,#2F80ED)` (1320, 1321, 1510, 1513, 1551, 1553, 1554).

Map-colour hex exemption:
- scripts/screens-apps.mjs:42-47 exempts `dollywood*` from the hex rule. It only checks that the rule starting `[data-flavor=hub],[data-flavor=live]{` has no hex, and it slices to the first newline (screens-apps.mjs:45). So it reads line 212 only. The same rule's hex values sit on line 217 (`--cat-*`, commented "cartography" at 216).
- Hex also appears in rules that are not map drawing:
  - Wait chips `.lv-wait` / `.wt` / `.wtile`: 494-501, 508
  - Amenity chip icons `.lv-amen button i`: 512
  - `.lv-meet .f`: 517
  - `.lv-stamp`: 519
  - Weak GPS dot: 548
  - `.lv-txt b.warn` fallback: 552
  - Pill states: 554
  - `.lv-cross`: 559-560
  - `.cbar b` fallback: 152
  - Hub mapbox background: 284

#### 5. Bypasses of hub.js

| localStorage key | Lines | Purpose |
|---|---|---|
| `dollywood-build-progress-v2` (`KEY` 1060) | get 1061, set 1062 | Progress on first paint and when there is no session |
| `dw-plot` | set 1055, get 1057 (read at boot even with a session) | Plot width |
| `dollywood.live.trails` (`TRAIL_KEY` 1725) | get 1727 (top level, runs here too), set 1726 | Family breadcrumb trails |
| `dollywood.live.last` / `.track:<id\|solo>` / `.style` / `.who` / `.waits` | 1374, 1608 / 1308, 1532, 1534, 1599, 1617 / 1546, 1609 / 1591, 1673 / 1633, 1634 | Park-map code; runs only via `liveInit` |

- Every localStorage access is inside try/catch.
- `sessionStorage`, `indexedDB`, `document.cookie`: NOT FOUND IN CODE.
- `fetch` at 1630 is park-map-only (returns early at 1629).
- `XMLHttpRequest`, `WebSocket`, `EventSource`: NOT FOUND in app code. The minified three.js on line 1748 contains 2 `fetch(` and 1 `XMLHttpRequest` in its loaders; no loader is used.

Own sync and file handling:
- Progress export as a `data:application/json` link with `a.download` (1099).
- Import through `FileReader` (1101).
- First-paint localStorage copy, then the hub copy once ready (1061 → 1111).

External resources and links:
- Google and YouTube search links plus `window.open`: 977. Hidden for view-only users (975).
- `<img src=o.image_url>` at 982: 0 of 145 listings have `image_url`.
- No external scripts, styles or fonts. design.css and hub.js are relative (683-684).
- Worker URL fallback (1629) and `queue-times.com/parks/55` (1652) are park-map code.

#### 6. Web tells in the code

- **Dialogs:** `alert('Not a progress file')` 1101. `confirm('Clear all saved progress?')` 1098. Park-map-only confirms at 1587, 1590, 1721. `prompt()`: NOT FOUND IN CODE.
- **`-webkit-tap-highlight-color:transparent`:** 42 (`svg#map`), 222 (body), 224 (buttons, selects, inputs), 416 (`.lv-north`).
- **`user-select:none`:** only on `svg#map` (42), unprefixed; no `-webkit-user-select`. `-webkit-touch-callout`: NOT FOUND IN CODE.
- **Focus:** `:focus-visible` at 27, 187, 226 (`outline:none` plus `box-shadow:var(--focus)`). Bare `:focus`: NOT FOUND IN CODE.
- **Hover:**
  - `:hover` rules are unguarded: 26, 66, 78, 101, 125, 134, 193. `(hover: hover)`: NOT FOUND IN CODE.
  - Hover-driven behaviour: elevation readout (836; text 606, swapped on coarse pointers 607/824); step-list preview (1096-1097, also on focus); `cursor:help` on `.mapdot` (194).
  - Tooltip-only hints via `title`: 583-584, 609 ("Click to jump"), 646-648.
- **Native controls:**
  - `<select>`: `#cint` 590, `#bmap` 596 (on phones an `opacity:0` select laid over an icon, 335-337), `#hf` 1012.
  - Checkboxes: 592, 664 ×3, plus generated toggles at 1026.
  - `type=search`: `#q` 599 (inline `width:190px`), `#pop-q` 975.
  - `type=range`: `#exag-r` 611, `#vx` 653 (`accent-color` 52, 107; checkboxes 62, 167).
  - `type=number`: 673, 676.
  - `type=file` (hidden): 648.
  - `<details>`: 665.
- **Scrolling:**
  - `overscroll-behavior:contain` only on the phone sheet body (372) and the park-map card (451); not on html or body.
  - `-webkit-overflow-scrolling:touch`: 240, 372, 430, 451, 467.
  - Wheel over the map calls `preventDefault` (818, `passive:false`).
  - Smooth scrolls not gated by reduced motion: 1127, 1140.
- **`touch-action`:** `none` at 42, 43, 359, 422 and 483, and in JS on the 3D canvas (1165); `manipulation` 222, 224; `pan-y` 372, 430, 451, 467.
- **Loading states:**
  - Text placeholders: stats `—` (572-575), "Building the 3D model…" (1155), "3D library failed to load." (1157).
  - Skeletons: NOT FOUND IN CODE.
- **Keyboard:** global shortcuts 852-857; 3D keys 1275-1282; popovers close on Escape or an outside click (1037-1041).

#### 7. Audience handling

- **Visibility:** kids and the kiosk are excluded by `visibleTo` (apps.json:9).
- **Kid mode in CSS:** `[data-kind]` selectors NOT FOUND IN CODE. hub.js sets the attribute (hub.js:80).
- **View-only:** `roleOf` (692; returns `'guest'` when there is no hub profile) and `VIEW_ONLY` (kid or kiosk; 693) remove web search from cards (975).
- **Kiosk / read-only:** `hubGuard` (1053-1054) calls `kioskNudge` when `!hub.canWrite`. It guards `stepDone` (1086), Reset (1098) and Import (1101). `save` checks at 1062; `savePlot` skips silently at 1055. Mark done, Reset and Import are shown to everyone; the guard runs on click.
- **Guests:** a guest flag check is NOT FOUND IN CODE (searched `isGuest`, `is_guest`, `guest`). Guests are adult profiles (worker/migrations/005-guests.sql:2).
- **No profile:** works standalone on localStorage (1053, 1105-1106).

#### 8. Timers, intervals and animation loops

| Line | Mechanism | Purpose | Uses timestamps? |
|---|---|---|---|
| 799 | `setTimeout` 140 ms | Commit the viewBox once a gesture settles | Debounce |
| 813-815 | `requestAnimationFrame` tween, 360 ms | `setView` | Yes, `performance.now()` delta; skipped under reduced motion |
| 850, 1147 | `setTimeout` 0 | Reset `dragged`; initial phone fit | — |
| 1044 | `setTimeout` 50 | Focus search after More | — |
| 1155 | Double `requestAnimationFrame` | Build 3D after the tap paints | — |
| 1269 | Perpetual `requestAnimationFrame` loop | 3D render. Renders only while `mode==='3d'` but keeps scheduling frames in 2D once 3D has been opened. | No delta time; OrbitControls damping runs per frame |
| 1274 | `setTimeout` 120 ms | Debounce 3D rebuild on exaggeration change | — |
| 1318 | `setTimeout` 120 ms | Debounce place-name layout | — |

- CSS infinite animation: `hlring` (282-283).
- `setInterval` at 1585, 1607 and 1614 are inside `liveInit` and do not run here.
- `clearInterval` and `removeEventListener`: NOT FOUND IN CODE. The `resize` listeners at 1125, 1268 and 1741 are never removed.

#### Extras: 3D

The 3D view exists only in this file. It uses WebGL through three.js r128, inlined on line 1748 (`const e="128"`), plus OrbitControls (1750-2794; `THREE.OrbitControls` 2792).

| Part | Lines |
|---|---|
| `init3D` | 1157-1284 |
| `WebGLRenderer` and shadows | 1162-1164, 1185-1186 |
| Sky shader | 1169-1171 |
| Bicubic terrain | 1189-1193, 1233-1234 |
| Canvas texture of the map layers | 1195-1213 |
| Instanced trees | 1244-1252 |
| Coaster tubes | 1255-1258 |
| Listing sprites | 1260-1265 |
| Raycast picking | 1270-1273 |
| "Reset view" button | 1283 |
| Lighter build on coarse pointers | 1161, 1186, 1190, 1195, 1246 |

---

### dollywood-live — Dollywood park map (apps/dollywood-live.html)

All line numbers below are park-map line numbers. The `<style>` block (6-566) is byte-identical to the build guide's.

#### 1. File facts

| Fact | Value |
|---|---|
| Size / lines | 1,160,570 bytes / 1,614 lines |
| apps.json | apps.json:10 — `"scope":"both"`, `"tile":"small"`, `visibleTo` absent (everyone, including kids and kiosk), `"dark":true`, `"color":"#1F6FB2"`, `"icon":"icons/dollywood-live.svg"` |
| hub.js tag | 684 `<script src="hub.js" data-app="dollywood-live" data-scope="both">`. Matches apps.json. `both` resolves to `['person','family']`, person first (hub.js:39). |
| Source drift | export_hub.py:19 default entry says `"scope":"family"` and `"icon":"📍"`. It is not applied because the entry already exists (export_hub.py:26). build_html.py:28 emits `both`. |
| `<html>` / title | `data-flavor="live"` 2; `<title>` 5; `document.title` set again at 1425 |
| Weight | Payload 682 = 936,160 B (81% of the file); no three.js. The 10 ft and 20 ft contours are emptied for this flavour (build_html.py:65), so contours are 66,824 chars. |

#### 2. Purpose and views

Purpose: the map for a park day. It shows:
- the illustrated park sheet or satellite imagery, with a GPS dot
- nearby rides and live waits, with walking directions
- nearby amenities
- family positions and a meeting point
- which rides each kid is tall enough for

| View | Markup | CSS | JS |
|---|---|---|---|
| Full-bleed map; build-guide chrome hidden | 603-604 | 383-391 (hide list 386), 525-545 | `liveInit` 1425-1489 (rotation 1427, 26-unit tap targets 1427, parking lots 1429) |
| Status pill (idle, placing, searching, good, weak, stale, arriving, far, denied) with action chip `#lv-act` | 613 | 396-401, 552-557 | `updLoc` 1259-1287 |
| Buttons: Find me / Whole park | 614-617 | 402-414 | 1397, 1401-1410, 1466 |
| Crosshair, scale bar, north / upright | 618-620 | 415-421, 558-560 | 1235, 1467 |
| "Set my spot" manual placement (crosshair plus "I'm here") | 632 (`#loc-place`) | 558-560 | 1266, 1399, 1468-1470 |
| Meeting-point bar | 621 | 516-518 | 1579-1591 |
| Directions bar and steps | 622 | 453-478 | 1319-1395 |
| Bottom sheet: Nearby (Nearby / Waits), Family, Search, Style | 623-637 | 422-452, 502-512, 519-524 | 1288-1313, 1411-1416, 1463-1474, 1490-1550 |
| Amenities: map markers, Nearby chips, card | — | 512-513 | 1563-1575 |
| Listing card, restyled (sticky head, action row, wait + walk, About) | 610 | 451-452, 479-493 | 1432-1450; family card 1314-1317; amenity card 1574-1575 |

#### 3. hub.js usage

| Call | Lines |
|---|---|
| `hub.ready({optional:true})` | 1105, 1481 |
| `hub.profile` | 692, 693, 694, 1053, 1106, 1178, 1182, 1190, 1199, 1253, 1254, 1259, 1285, 1297, 1302, 1307, 1312, 1440, 1459, 1482, 1546, 1548, 1585, 1586, 1589, 1590, 1601 |
| `hub.get` | 693, 694, 1109, 1110, 1111, 1307, 1539, 1579, 1601 |
| `hub.set` | 1055, 1062, 1253, 1308, 1310, 1548, 1587 |
| `hub.remove` | 1255, 1308, 1312, 1588 |
| `hub.list` | 1254 (`'loc:'`, family) |
| `hub.onChange` | 1112; 1483 (family `loc:*`, `meet` or `kid*` → `loadFam`; `kid*` also → `renderNear`) |
| `hub.onSync` | 1483 |
| `hub.activity` | 1086, 1587 (`Meeting point: <name>`) |
| `hub.migrate` | 1107 |
| `hub.canWrite` | 694, 1054, 1055, 1062, 1255, 1300, 1307, 1440, 1459, 1548, 1585, 1586 |
| `hub.kioskNudge` | 1054, 1062, 1548 |
| `hub.people` | 1538, 1600 |
| `hub.photoUrl` | 1216 |
| `hub.sync.state` | 1298 |
| `hub.api` | 1499 |
| `hub.request` | 1589 |
| `hub.avatarHtml`, `hub.voiceInput`, `hub.setTheme`, `hub.sheenFrom`, `hub.toast` | NOT FOUND IN CODE |

| Key | Scope | Read | Write / remove |
|---|---|---|---|
| `share` (bool) | person | 694 | set 1310 |
| `progress`, `plot` (build-guide code, still wired here) | person | 1109-1111 | 1062, 1055; migrate 1107 |
| `loc:<profileId>` `{x,y,acc,hdg,t,name,emoji,color}` | family | list 1254 | set 1253; remove 1255 (older than 24 h), 1308 (kid beacon turned off), 1312 (sharing turned off) |
| `kidshare:<kidId>` (bool) | family | 693, 1307, 1601 | set 1308 |
| `kid:<kidId>` `{height_in,at,by}` | family | 1539 | set 1548 |
| `meet` `{x,y,name,note,by,byName,at}` | family | 1579 (shown only if under 2 h old) | set 1587; remove 1588 |

Build-guide code that still runs here:
- The IIFE at 1105-1112 migrates `dollywood-build-progress-v2` and `dw-plot` into this app's person scope. The migration is marked per app (hub.js:398) and the legacy key is not deleted (hub.js:402-407), so the same legacy progress is copied into both apps.
- The keydown handler (852-857) is not flavour-gated except for `T`. Pressing `D` calls `stepDone` (1086), which runs `hub.set('progress')` (1062) in `dollywood-live`.

Family locations:

| Stage | Lines | Detail |
|---|---|---|
| Publish | 1250-1253 | Only a fresh GPS fix under 150 m accuracy. At most every 2.5 s, or every 8 s if moved less than 8 m. |
| Load | 1254-1256 | Skips your own row. Deletes rows older than 24 h if `canWrite` and not view-only. Also calls `loadMeet`. |
| Draw | 1212-1221 | Hidden after 4 h, faded after 45 min. Photo from `hub.photoUrl` or the profile emoji. |
| Off-frame markers | 1205-1211 | Shown at the frame edge for anyone on the property but outside the map |
| Trails | 1593-1599 | Breadcrumbs kept in localStorage (last 20 points), drawn when under 10 min old |
| Pill line | 1603-1604 | Nearest family members, when under 20 min old |
| Family pane | 1295-1309 | Share-my-spot switch 1301, kids' beacons 1307-1308 |
| Refresh | 1484 | Every 30 s |

Kids' heights: 1535-1550. "Who can ride" row: 1549-1550. Faint markers for rides the chosen kid is too short for: 1544.

Rally the family:
- `rally()` at 1589 does `hub.request('/api/dollywood/rally',{method:'POST',body:{name,x,y}})`.
- **Nothing calls it**, in either export or in template.html (defined at 1717, never called; searched `rally` case-insensitively). There is no Rally control in the markup (566-681).
- The "Meet here" confirm text at 1591 still says "Tap Rally afterwards".
- `DELETE /api/dollywood/rally`: NOT FOUND IN CODE, although the Worker has the route (worker/src/index.js:132). Clearing uses `hub.remove('meet')` (1588) after a confirm (1457).

Geolocation:

| Item | Lines |
|---|---|
| `navigator.geolocation.watchPosition`, options `{enableHighAccuracy:true, maximumAge:5000, timeout:15000}` | 1403, 1408 |
| `clearWatch` | 1404 (permission denied), 1469 (place mode), 1475 (page hidden) |
| `getCurrentPosition` | NOT FOUND IN CODE |
| Wake lock: request / release | 1400 / 1475 |
| Heading source | `coords.heading` (1403); DeviceOrientation NOT FOUND IN CODE |
| Projection | Equirectangular `toXY` 1165 using payload `geo` (`GEO` 1161) |
| Rough-fix filter; area change needs two fixes | 1240, 1243 |
| When GPS starts | Find-me tap (1466), turning on Share my spot (1311), sharing already on at load (1486), or a stored intent (1487-1488). Blocked for view-only users (1401). |

Live waits:
- `loadWaits` (1499-1505) calls `fetch(base+'/api/dollywood/waits',{cache:'no-store'})`. `base` is `hub.api` or the hard-coded fallback `https://house-hub-api.catalystfarm1.workers.dev` (1499). This is a raw `fetch`, not `hub.request`.
- Rides are matched to listings by normalised name (`wnorm` 1493, `WALIAS` 1494 is empty).
- Where waits show:
  - Marker chips: 1507-1515
  - Card: 1518-1520
  - Waits pane: 1524-1533
  - Queue-Times credit link: 1521-1522
  - Directions-bar meta: 1534
  - "Next ride" hero card: 1554-1561

3D: no three.js or WebGL. `setMode` and `init3D` are stubs (1152, 1154). `three` stays null, and its references at 852 and 1032 are guarded.

#### 4. design.css usage

- **Link, `ds` class, own CSS:** same as the build guide. design.css at 683; no `class="ds"` (566); own component CSS throughout.
- **`<style>` counts:** identical to the build guide.
  - Colour literals: 144 hex (84 unique), 35 rgb/rgba, 0 hsl.
  - Sizes: 141 px font sizes; 78 px radii (including 999px ×15); 112/81/73 px padding/margin/gap.
  - Tokens: 0 references to `--fs-*`, `--sp-*`, `--r*` or `--tap`; `--blur` at 215, 287, 290, 298, 299, 322.
- **Same as the build guide:** `prefers-reduced-motion` 139 only; `font-family` lines; `[data-scheme]` 10, 219; `[data-theme=light]` 11; no `[data-kind]`.
- **Markup:** 4 hex (620, 664 ×3).
- **JS 685-1612:** 109 hex on 63 lines, 0 rgb, 0 `0x`. Examples: 1190-1191 (`var(--accent,#2F80ED)`), 1213 (`#8A6A4B` fallback), 1418-1424 (SVG filter colours), 1564 (`AMEN`).
- **`var(--accent)`:** 44 in `<style>`, 10 in JS.
- **Park-map-only CSS:**
  - Rules 382-564; 565 hides the overlays in the other flavours.
  - Basemap switch through `html[data-bm]`: 389, 395, 526-538 (set in JS at 1415).
  - Dark-scheme glass: 219-220.
  - The hex exemption and the non-map hex rules listed in the build-guide section apply here unchanged.

#### 5. Bypasses of hub.js

| localStorage key | Lines | Purpose |
|---|---|---|
| `dollywood.live.last` (`LIVE_KEY` 1162) | set 1244, get 1478 | Your last fix, restored as stale if under 12 h old |
| `dollywood.live.track:<id\|solo>` (`TRACK_KEY` 1178) | set 1402, remove 1404, 1469, get 1487 | Resume GPS without a tap |
| `dollywood.live.style` | set 1416, get 1479 | Basemap style |
| `dollywood.live.who` | get 1461, set 1543 | Kid height filter |
| `dollywood.live.waits` | set 1503, get 1504 | Waits cache, used as a fallback for up to 6 h |
| `dollywood.live.trails` (`TRAIL_KEY` 1595) | set 1596, get 1597 | Trails |
| `dollywood-build-progress-v2`, `dw-plot` | 1061-1062, 1055, 1057 | Build-guide code |

- Every access is inside try/catch.
- `sessionStorage`, `indexedDB`, `document.cookie`, `XMLHttpRequest`, `WebSocket`, `EventSource`: NOT FOUND IN CODE.
- Direct network: `fetch` at 1500 (waits).

Own sync and cache logic:
- Publish throttle: 1250-1252.
- Client-side deletion of stale rows: 1255.
- Waits cache and 60 s refresh: 1455, 1503-1504.
- Trails: 1593-1599.
- "Next ride" memo, 30 s: 1555.
- Restoring the last fix: 1478.

External links:
- Card search is cut down to one link (1449): `#pop-off`, a Google `site:dollywood.com` search built at 977. The web/photos/videos search row is removed.
- `queue-times.com/parks/55` 1522.
- Worker URL fallback 1499.

#### 6. Web tells in the code

- **Dialogs:** `confirm` at 1457 ("Clear the meeting point for everyone?"), 1460 (set the meeting point after a long press), 1591 ("Meet at …?"). `confirm` 1098 and `alert` 1101 belong to the hidden build UI. `prompt()`: NOT FOUND IN CODE.
- **Tap highlight, user-select, focus, `:hover`:** same lines as the build guide (42, 222, 224, 416; 42; 27, 187, 226; 26-193).
- **Native controls moved into the sheet:**
  - `#q` and the listings go into Search (1463).
  - `#cint` goes into Style as "Contour interval (satellite)" (1464). It has no visible effect: CSS 531 hides every `#contour > g` on satellite, 526 hides `#contour` on the illustrated style, and the 10/20 ft sets are empty (build_html.py:65).
  - Layers tab, including the steepness checkbox, appended to Style (1464).
  - Share and beacon checkboxes are restyled as switches with `appearance:none` (435-437; used at 1301, 1307).
  - `<details class="lv-about">`: 1447.
  - Height `−`/`+` steppers: 1547.
- **Gestures:**
  - Long press (550 ms) to set a meeting point: 1459-1460.
  - Sheet drag: 1473-1474.
  - Card drag-down to close: 1450.
- **Scrolling:** `overscroll-behavior:contain` on `.pop` (451). The body gets `overflow:hidden` (383), but the `[data-flavor=live] html` part of that selector cannot match, because `data-flavor` is on `<html>` itself.
- **Loading:** "Finding you…" 613; spinners 406-407 and 555; "Loading wait times…" 1526. Skeletons: NOT FOUND IN CODE.

#### 7. Audience handling

- **Visibility:** visible to everyone (apps.json:10). `[data-kind]` CSS: NOT FOUND IN CODE.
- **View-only (`VIEW_ONLY` 693):** a kid is view-only unless an adult has set family `kidshare:<id>` to true; the kiosk always is. Effects:
  - `startGps` returns immediately (1401).
  - Find-me button hidden (1485).
  - Idle pill copy changes (1269).
  - Web search removed from cards (975).
  - No stale-row deletion (1255).
  - No share row (1300).
- **Kid beacon:** `kidBeaconOn` (1601) → `shareOn` (694) → publish.
- **Adult-only (`kind==='adult'`):**
  - Kids' beacons: 1307
  - Meet here: 1440, 1590
  - Long-press meeting point: 1459
  - `setMeet`: 1586
  - Meet Done button: 1585
  - Kids' heights: 1546
  - `rally`: 1589
- **`hub.canWrite`:** 694, 1255, 1300, 1307, 1440, 1459, 1548 (with `kioskNudge`), 1585, 1586.
- **Guests:** a guest flag check is NOT FOUND IN CODE.

#### 8. Timers, intervals and animation loops

| Line | Mechanism | Purpose | Uses timestamps? |
|---|---|---|---|
| 799, 813-815, 850, 1188 | Same as build-guide 799, 813-815, 850, 1318 | Gesture commit, tween, drag reset, name layout | Tween yes |
| 1385 | `setTimeout` 2.5 s | Restore the pill after "Find yourself first" | — |
| 1414 | `setTimeout` 50 ms | Focus the search pane | — |
| 1455 | `setInterval` 60 s, plus `visibilitychange` | `loadWaits`. Skipped while hidden; refetches on return if `Date.now()-WAITS.at>60000`. | Yes on return |
| 1459 | `setTimeout` 550 ms | Long press | — |
| 1475-1476 | `visibilitychange` | Pause or resume `watchPosition` and the wake lock | — |
| 1477 | `setInterval` 15 s | `updLoc` / `drawMe` while a fix exists and the page is visible | Yes, `fixAge` (1172) |
| 1484 | `setInterval` 30 s | `drawFam` + `renderFam` | Yes, from `f.t` (1181, 1212, 1214) |
| 1283 | `Date.now()/6000` parity | Alternates the pill subtitle; re-evaluated only when `updLoc` runs | Yes |
| 1555 | 30 s memo | "Next ride" rows | Yes |

- CSS infinite animations: `lvlive` 400-401, `lvspin` 406-407 and 555, `fabring` 413-414, `mepulse` 546 and 561-562.
- `routein` (463) is one-shot; its class is added at 1381. `lvmarch` (477-478) is defined but its class is never used.
- Reduced motion (CSS 139) removes transitions only; these animations keep running.
- `clearInterval` and `removeEventListener`: NOT FOUND IN CODE.

## 10. Cross-section reconciliation

A completeness critic compared every section against the others and against the code. The lead has already applied the line-number corrections below to the sections above.

### 10.1 Contradictions resolved against the code

| # | Sections | Conflict | Resolved fact (code) |
|---|---|---|---|
| 1 | 3.1 step 2a and 4.7, against 1a/1b | 3.1 and 4.7 say `hub.sheenFrom` is undefined under reduced motion. 1a/1b still mark picker, PIN, pairing, kiosk and admin EXISTS with no condition. | The shell does not boot when `prefers-reduced-motion: reduce` is on.<br>• index.html:662 calls `hub.sheenFrom(views);` with no guard, at the top level of the async IIFE (index.html:442-1713).<br>• `hub.sheenFrom` is assigned only at apps/hub.js:447, which sits after the early `return` at apps/hub.js:442. The call therefore throws a TypeError and the IIFE rejects.<br>• Nothing after line 662 runs: pull-to-refresh listeners (664-671), SW registration (1691-1698), `loadRegistry` and routing (1701-1706). `#gate` and `#shell` stay `hidden` (index.html:366, 374).<br>• There is no global handler: 0 hits for `unhandledrejection` or `window.onerror` in index.html and apps/hub.js.<br>• The only reduced-motion test loads `/docs/design.html`, not the shell (scripts/test-design.mjs:87-89).<br>• So every shell feature in 1a/1b is EXISTS/PARTIAL only while reduced motion is off.<br>**Runtime-confirmed by the lead (§0.2).** |
| 2 | 1b §11 and 4.6, against 9c | 1b lists `rally` as a working push kind. 4.6 lists apps/dollywood.html:1719 and apps/dollywood-live.html:1589 as callers. 9c says nothing calls it. | 9c is right. Those two lines are the definition `async function rally(name,x,y)`. A grep for `rally(` in both exports returns only those definitions, and no markup control exists. `POST /api/dollywood/rally` (worker/src/index.js:97-131) and `DELETE` (132-139) have no client caller, so the `rally` push kind cannot be reached from the shipped UI. The "Meet here" confirm still says "Tap Rally afterwards…" (apps/dollywood-live.html:1591). |
| 3 | 4.1 against 9c | 4.1 lists build-guide `hub.ready` calls at apps/dollywood.html:1105 and :1611. 9c says 1611 does not run. | 9c is right. dw:1611 is inside `liveInit` (starts at dw:1555). `liveInit` runs only when `if(FLAVOR==='live')` (dw:1740), and FLAVOR is `'hub'` (dw:688). The only call that runs in the build guide is dw:1105. |
| 4 | 3.2 against 1b §14 | 3.2 lists `chip-danger` as a rendered chat chip state. 1b says it never shows. | 1b is right. index.html:1497 returns when `!data.chip`. Every `ok:false` result in worker/src/chat.js carries `chip: null` (e.g. 161, 166, 174-176, 193, 311, 431). Chips exist only on success paths (179, 190, 198, 221, 233, 254, 260, 281). |
| 5 | 3.1/4.5 against 8.1 | `syncThemeColor` cited as index.html:656-658 in 3.1/4.5 and as 655-658 in 8.1. | The function is at index.html:656-658. Line 655 is a comment. |
| 6 | 9a against 3.4 | Ledger writes cited as "index.html:1364" in 9a and as 1369/1374 in 3.4. | Both refer to real lines. The key is built at index.html:1364. The `hub.set` calls are at 1369 (cash-in) and 1374 (reset). |
| 7 | 1b §8 against 9c | Dollywood accent use: "47 lines" in 1b against "44 in `<style>` + 10 JS" in 9c. | Both are correct in different units. In each export, 47 lines contain `var(--accent`. In `<style>` (6-566) there are 44 `var(--accent)`/`var(--accent,` plus 14 `var(--accent-deep`. The JS has 10. |
| 8 | 2.9 against 9c | 2.9 counts "18 lines" of storage bypass in apps/dollywood.html. 9c says most of them are park-map code. | All 18 lines exist, but the build guide executes only 1055, 1057, 1061, 1062 and 1727. Line 1727 is the top-level `TRAIL_KEY` read. The rest sit in `liveInit` or GPS paths (e.g. dw:1591 is inside `liveInit` 1555+). |
| 9 | 1a §3 against 4.3.8 | 1a says an unpaired device "shows pairing again" (index.html:766, 771). 4.3.8 says the shell keeps a stale `hub.device`. | The path depends on where the error lands.<br>• If the shell's own request gets `device_not_paired`, apps/hub.js:148 clears the shell's copy, and index.html:771 shows pairing.<br>• If an app iframe gets it, apps/hub.js:148 clears only the iframe's `hub`. index.html:766 then sees the shell's in-memory `hub.device` and calls `showPicker`. Pairing appears only after the picker's `hub.profiles()` (index.html:524) fails in turn (index.html:528, 771). |
| 10 | 6.3/7.4 | `settings` cited as worker/schema.sql:96-100. | The `CREATE TABLE settings` is at worker/schema.sql:97-100. Line 96 is the comment that lists the unused `vapid_public_key`. |

### 10.2 Gaps filled

| Gap | Fact |
|---|---|
| Completeness cross-check | Nothing is missing from these areas:<br>• Worker routes: 38 `route(` calls (worker/src/index.js:56-549), all in 6.2.<br>• Worker source: 7 files (auth, chat, data, index, media, push, reminders).<br>• Migrations: 5 (worker/migrations/001-005).<br>• Tables: 11 `CREATE TABLE` (worker/schema.sql:4-102), all in 7.4.<br>• apps/: 16 tracked files, matching 8.3.<br>• icons/: 13 tracked files, matching 8.4.<br>• TOOLS: 12 names (worker/src/chat.js:25-49). |
| SDK member count (not stated anywhere) | 54 public members:<br>• 8 in the object literal (apps/hub.js:47-53)<br>• 3 `defineProperty` getters (113-115)<br>• 43 assignments (64-497)<br>One of them, `sheenFrom` (447), exists only when reduced motion is off (442). |
| Shell inline styles (missing from 2.4/3.8) | index.html has 73 inline `style="` attributes. Most use tokens.<br>• Literal values: `max-width:440px` (501), `margin-top:6px` (948), `height:120px` (1280), `width:120px` (1223, 1430), `margin-right:6px` (1274), `min-width:160px` (1358).<br>• Swatch hex applied as `background:${c}` (1398).<br>• The shell `<style>` (18-362) has 0 px font sizes and 48 `var(--fs-*)` uses. |
| Helpers that duplicate hub.js | • Own `esc` in apps/f260.html:1182 and apps/prayer.html:717. Both omit `'`, which `hub.escape` escapes (apps/hub.js:436).<br>• Own `esc` in apps/kidverse.html:256 and apps/verses.html:200.<br>• Own `dayKey`: index.html:834, apps/f260.html:932, apps/kidverse.html:259 and 592, apps/verses.html:203. Leftovers has `todayStr` at apps/leftovers.html:166.<br>• Own `isoWeek`: index.html:881, apps/kidverse.html:261 and 593.<br>• Random ids made with `Math.random().toString(36)` instead of `hub.uid`: apps/prayer.html:600, dw/dwl:937. |
| Duplicated data tables | The 52-week memory-verse table exists in 5 copies: apps/f260.html:788 (`PLAN`), index.html:987 (`MEMORY`), apps/kidverse.html:187 (`VERSES`), apps/verses.html:177 (`REFS`) and worker/src/chat.js:56 (`MV`). |
| Data written with no reader | Verses writes `verses.summary` (apps/verses.html:243). The shell declares no `verses` channel (index.html:458-459), and the only `verses` hit in index.html is a comment (986). The comment at apps/verses.html:172 and CLAUDE.md both say the Home card reads it. |
| Viewport meta across pages | All 10 pages and docs/design.html set `width=device-width, initial-scale=1, viewport-fit=cover`, with no `maximum-scale` or `user-scalable`: index.html:5, apps/*.html:5, dollywood exports :3, docs/design.html:5. |
| Tracked non-app files under the Pages root | `git ls-files` shows these tracked next to the site files:<br>• worker/ (16 files, including schema.sql, seed.sql, wrangler.toml, src/*)<br>• scripts/ (33)<br>• handoff/ (7)<br>• docs/ (388)<br>• CLAUDE.md and README.md<br>`.nojekyll` is 0 bytes. Whether these are served was not checked live. |

## 11. What Phase 0 did not verify

Everything in §1-§9 comes from reading the code. The only runtime checks were the ones in §0.1 and §0.2.

**Deployment state** (needs Cloudflare access; none was used):
- Whether the deployed Worker matches `worker/src` at the baseline commit.
- Whether the Worker secrets are set:
  - `VAPID_PRIVATE_KEY` controls whether push works or returns `vapid_not_configured`.
  - `ANTHROPIC_API_KEY` controls whether chat works or returns 503 `chat_not_configured`.
  - `ANTHROPIC_BASE_URL` must be absent in production.
- Whether production D1 matches `schema.sql` (which migrations were applied) and whether `settings` holds `pairing_code_hash`.
- Whether live profiles still match `seed.sql`. The seed uses `INSERT OR IGNORE`, so admin edits made later override it.
- Whether production has an R2 binding. wrangler.toml declares none.
- Whether the cron triggers fire at the expected hours.
- Whether observability captures the Worker logs.

**Rendering** (Phase 1's capture rig covers these):
- Actual tap-target sizes, grid columns and tile sizes at phone, iPad and desktop widths.
- Contrast of every pair in all five palettes.
- Whether choosing Hearth under an OS dark scheme renders dark (§5.3).
- Whether the global `:focus-visible` ring is hidden by component box-shadows (§5.6).
- Whether Kid Verse's gold override on `.btn.done` actually paints (§1b-8).
- How the Dollywood hex colours look in each theme.
- Which fonts actually resolve on each device: `ui-rounded`, "New York", and the Archivo and Fraunces faces that are named but never loaded.
- Whether the Dollywood pages flash dark before hub.js runs.

**Runtime behaviour inferred from code** (needs a live session):
- The 30 s poll stopping after an in-page profile switch.
- The Home re-render wiping a half-typed reminder.
- Duplicate activity posts.
- The chat-cap race.
- Prayer pushes lost between the 8 am and 8 pm runs.
- A queue over 200 items, or a value over 900 KB, dropping a whole channel.
- Whether the "Hub updated" toast ever appears, given `skipWaiting`.
- Whether the service worker's install fetches bypass GitHub Pages' HTTP cache.
- The cost of the perpetual 3D animation loop and of F260's 5 s merge-retry loop.

**Device-only** (real iPad, iPhone and TV):
- Safari/WebKit rendering and true Liquid Glass.
- Standalone PWA chrome and safe areas.
- Push delivery through Apple's push service.
- Screen Wake Lock in the PWA and in the iframe.
- `SpeechRecognition` inside the iframe, and the `speechSynthesis` voices.
- WebAuthn PRF unlock in F260.
- GPS accuracy and heading.
- Clipboard and `sms:` links inside the iframe.
- Whether runtime `theme-color` changes recolour the status bar.
- The apple-touch-icon's transparent corners.
- localStorage quota and private-mode behaviour.
- Whether `DeviceOrientationEvent.requestPermission` exists (it turns tilt sheen off).
- Timer notifications while the app is backgrounded.
- `background-attachment: fixed` on iOS.
- The long-press callout on the park map.

**Outside services:**
- Whether the Anthropic API accepts model `claude-sonnet-5` with `thinking:{type:'adaptive'}` and `output_config:{effort:'low'}`, and a follow-up tool turn that drops the thinking blocks (worker/src/chat.js:373, 382, 428).
- The shape of the queue-times.com response.
- How Prayer's Google Fonts behave offline.

**Resolved by the lead** (and no longer open):
- The reduced-motion boot failure: runtime-confirmed in Chromium, locally and live (§0.2).
- Pages builds the baseline commit, and the live `apps.json` and SW VERSION match the repo (§0.1).
- `GET /api/dollywood/waits` needs no token: route 2 in §6.2 never calls `c.auth()`.

## 12. Method

- **Isolation.** Everything was read-only. No server was started against real data, and the only production request was an unauthenticated `GET /api/health`. The headless-Chrome checks in §0.2 mapped `house-hub-api.catalystfarm1.workers.dev` to a dead local port, so no request reached the API and no family data was touched. No app code, test or config was changed.
- **Agents.**
  - One mapper per area wrote each section with `file:line` citations: shell, SDK, design.css, the two Worker halves, PWA, three app groups, two feature groups, and a cross-cutting bypass sweep.
  - An adversarial verifier then re-opened every citation it could. It tried to refute every NOT FOUND and PARTIAL, filled gaps in scope, and returned a corrected section. Totals: 2,998 citations checked and 277 corrections.
  - A completeness critic compared all the sections, resolved 10 contradictions against the code, and filled 8 gaps (§10). The lead applied the critic's line-number corrections to the sections.
- **Lead checks.**
  - Hosting: `gh api` for the Pages config and build, the live URLs, and a `diff` of the live `apps.json`.
  - The two runtime reproductions in §0.2.
  - A grep of the Worker's `env.*` reads.
  - The sibling repo's remote and status.
  - A secret-pattern scan of this document: there are no tokens, hashes or private keys in it.
- **Screenshots.** Phase 0 captured only the two files in `audits/evidence/`. A trial capture at 390 px in headless Chrome on Windows came out clipped: the page laid out wider than the image. Both evidence shots are therefore 1280×800. Phase 1 builds the proper WebKit rig.
