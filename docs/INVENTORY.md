# App inventory (Phase 0 discovery, 2026-09-16)

## Hosting

| | |
|---|---|
| Site | **GitHub Pages**, legacy build from `main` / root — https://vantrix117.github.io/house-hub/ (HTTP 200) |
| Repo | https://github.com/Vantrix117/house-hub |
| Backend | Standalone **Cloudflare Worker + D1** (not Pages Functions). Account `catalystfarm1@gmail.com`, id `2cdbdcb87ea8e8a0923395ef07d76d71` |
| Existing worker | `house-hub-api` → `https://house-hub-api.catalystfarm1.workers.dev` (leftovers only; `/items` returns 401 without `X-House-Key`). Source: `worker/leftovers-worker.js`, config `worker/wrangler.toml`. Secret `HOUSE_KEY` set. |
| Existing D1 | `house-hub` (`c5410eee-9095-4092-84b0-dc534aded0d8`). Tables: `leftovers` (1 row), `_cf_KV`. |
| No `wrangler.toml` at repo root, no `functions/`, no Pages projects | → backend stays a Worker; CORS must be locked to `https://vantrix117.github.io`. |

## Apps

### `tally` — Tally counter (`apps/tally.html`, 2 KB)
Single counter with +/−/reset.
- localStorage **`tally.count`** — number (stored as string).
- No URL params, no network.
- Migration target: person scope, key `count`.

### `timer` — Kitchen timer (`apps/timer.html`, 3 KB)
Preset countdown with WebAudio beep.
- **No storage at all.** No URL params, no network.
- Migration target: nothing to migrate; person scope reserved for a future "last preset".

### `leftovers` — Larder Ledger (`apps/leftovers.html`, 18 KB)
Fridge/leftovers list with age-based warnings (`WARN_DAYS = 7`, `AGING_DAYS = 4`).
- localStorage **`leftovers.items`** — `[{id, name, size, dateLogged}]`; offline cache when API is set.
- localStorage **`house.key`** — household passphrase (hub-wide).
- Network: `GET/POST /items`, `DELETE /items/:id` on `house-hub-api.catalystfarm1.workers.dev`, header `X-House-Key`; polls every 20 s + on `visibilitychange`; 401 clears `house.key` and shows unlock screen.
- No URL params.
- Migration target: **family scope** (obviously shared). Existing D1 `leftovers` rows (1) must be carried into `app_data`.

### `prayer` / `prayer-family` — Prayer (`apps/prayer.html`, 100 KB, two tiles)
Prayer list app: Today / All / Answered / Add / More screens, prayer mode, kitchen view, Sunday review, print, plans/rotation, streak, anniversaries. Fonts: Google Fonts (Manrope, Instrument Serif) — the one external fetch besides sync.
- localStorage **`prayer-data-v3`** — one object `{version:3, activeList:'personal'|'shared', pin, lastExport, me, theme, sync:{mode,owner,repo,path,branch,sha}, lists:{personal:{label,categories,prayers[],prayerDays[],plans[],activePlan,rotationFor}, shared:{…same}}}`. Each prayer: `{id,title,for,phone,detail,category,cadence,days,status,createdAt,lastPrayedAt,answeredAt,answerNote,updates[],sharedFrom,prayedBy:{date:[initials]},updatedAt}`.
- localStorage **`prayer-sync-token`** — GitHub PAT (plaintext).
- **URL param `?list=personal|shared`** selects which list opens (both apps.json tiles point at the same file).
- App-local PIN: `D.pin` stored **plaintext** inside `prayer-data-v3`; gates the personal list.
- `D.me` — free-text initials used for "who prayed".
- Network: GitHub sync (`raw.githubusercontent.com` read, `api.github.com/repos/…/contents` PUT) for the shared list, pull every 90 s + on visibility.
- Test harness: `handoff/prayer/check.js` (`node handoff/prayer/check.js apps/prayer.html`).
- Migration target: `lists.personal` → **person scope**; `lists.shared` → **family scope**; drop `pin`, `sync`, `me`, token, URL-param mode.

### `f260` — F260 Reading Plan (`apps/f260.html`, 147 KB)
52-week Bible reading plan with journal vault, streaks, milestones, memory verses.
- localStorage keys (all `f260.*`):
  - `f260.done` `{ "week-day": true }` — readings checked (core progress)
  - `f260.week` current week; `f260.open` open weeks; `f260.view` `'plan'|'journal'`; `f260.read` reading mode
  - `f260.source` translation/source `'gateway'|'youversion'|'esv'` (the "translation preference")
  - `f260.mem` memorized verses; `f260.verses` pasted verse text; `f260.recall` recall results
  - `f260.log` `{ "YYYY-MM-DD": true }` days with a reading; `f260.best` best streak; `f260.weekStart`, `f260.weekDone`, `f260.finished`, `f260.miles` milestones
  - `f260.jstats` journal activity counts (no content)
  - `f260.autolock`, `f260.big`, `f260.theme` — device prefs
  - `f260.journal.vault` — HEAR journal, **AES-256-GCM encrypted**, passcode-derived key (PBKDF2) + optional WebAuthn PRF wrap. `f260.journal` is the legacy plaintext key (upgraded then dropped).
- Backup/restore string format prefix `F260BACKUP1.`.
- No URL params, no network. Uses WebAuthn (`navigator.credentials`) for Face ID unlock.
- Migration target: **person scope**, every key above except device prefs (`autolock`, `big`, `theme`) which stay local. The vault blob syncs as-is (opaque ciphertext).

## Hub shell (`index.html`)
- localStorage **`hub.recent`** — `{appId: timestamp}` for tile ordering.
- Deep link `#<appId>`; reload appends `?r=<ts>` to the app file URL.
- Loads `apps.json?ts=…` with `cache: no-store`. Apps run in an `<iframe>`.
- Wake lock on first tap. `manifest.json` (standalone, SVG icon only — no 180 px PNG apple-touch-icon).

## Storage key summary

| Key | App | Scope after migration |
|---|---|---|
| `tally.count` | tally | person |
| `leftovers.items` | leftovers | family |
| `house.key` | leftovers (hub-wide) | replaced by device token |
| `prayer-data-v3` | prayer | split: person + family |
| `prayer-sync-token` | prayer | removed |
| `f260.*` (21 keys) | f260 | person (3 device prefs stay local) |
| `hub.recent` | hub | local |

## Untracked / non-app files in the repo root
`christian-app-game-plan.html`, `prompt-generator.html`, `files/` (prayer handoff zip + a personal list) are untracked and not part of the hub. `handoff/prayer/` is tracked reference material for the prayer app.
