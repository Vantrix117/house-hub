# Verification report — roadmap complete (2026-09-20)

All 23 roadmap items (plus the Sprint 1b additions 24–27) are built, verified and live:
site https://vantrix117.github.io/house-hub/ (service worker `hub-v18`), API https://house-hub-api.catalystfarm1.workers.dev
(migrations 001–005 applied to the live D1, Worker deployed at version `51c90faa`).

## How it was built and checked

Items 1–8 and 24–26 were built directly. Items 27 and 9–23 were built by one agent per item and then handed to an
independent adversarial reviewer with a fix loop (up to two rounds); a reviewer's "ok" required every acceptance
criterion exercised for real in headless Chrome or against the local Worker, the item's own test script read and run,
and the regression suites green. Reviewers pushed back on: tally/prayer/f260/park-map contrast in dark themes (27),
the timer pill covering the chat composer (9), F260's next-reading logic for readers who tick ahead (10), a guest PIN
hijack and expired guests still receiving push (23), and Kid Verse re-offering the ★ after a parent's reset (20 — fixed
by the orchestrator after three rounds). Every change then went through the full serial run below on a fresh local D1.

## What is verified (automated, all green at `a61f9a2`)

| Suite | Checks | Proves |
|---|---|---|
| `smoke-api.sh` | 99 | every endpoint incl. guests, rate limits, LWW, admin 403s, CORS |
| `test-hub.mjs` | 37 | two devices, offline → flush, PIN flows, kiosk read-only, kid visibility, migration |
| `test-apps.mjs` | 48 | apps on hub.js, Home dashboard, widgets, admin, legacy migration |
| `test-prefs.mjs` | 17 | theme follows the person, F260 prefs, kiosk toasts |
| `test-timer.mjs` | 45 | timer survives navigation, pill, beep, second device |
| `test-f260.mjs` | 51 | opens on Today, Done above the fold, in-place merge |
| `test-prayer.mjs` / `test-prayer-faces.mjs` / `check.js` | 36 / 41 / 49 | Pray now, More sheet, faces, kid family-only mode, app logic |
| `test-leftovers.mjs` | 42 | list-first, sticky glass bar, midnight rollover |
| `test-home.mjs` | 57 | prayer/park/stars/feed cards, cache-first render |
| `test-kidverse.mjs` / `test-kidstory.mjs` / `test-rewards.mjs` | 51 / 50 / 73 | kid verse, story, stars & badges, ledger, one-★-a-day |
| `test-verses.mjs` | 80 | Leitner trainer, `f260.recall`, kid flow |
| `test-guests.mjs` | 50 | guests end to end incl. expiry and purge |
| `test-tv.mjs` | 43 | TV board: constant nodes/timers over simulated 24 h, nothing editable |
| `test-dollywood.mjs` / `test-dollywood-sync.mjs` | 34 / 32 | park map privacy + offline, build guide on hub.js |
| `test-push.mjs` / `test-push2.mjs` | RFC vector / 64 | Web Push encryption; all five reminder kinds via the stand-in receiver, opt-outs |
| `test-photos.mjs` | 28 | photo upload/crop, faces everywhere, guards |
| `smoke-chat.sh` (mock) | 39 | every chat tool + kid/kiosk guards |
| `test-art.mjs` / `test-design.mjs` | 20 / 49 | art set, WCAG AA in all five themes for all family colours, glass, reduced motion |
| `screens-shell.mjs` / `screens-apps.mjs` / `screens-themes.mjs` | 18 / 82 / 27 | every surface and app in every theme; layout shift < 0.1; tokens only |

Lighthouse (mobile, gzip static): shell 93 / 100 / 100 / 100. Screenshots for every item are in `docs/screens/`.

## What is NOT verified (needs a real device or a real day)

- **Real iPhone/iPad**: Home Screen install, Safari rendering of the glass (backdrop-filter) and the theme picker, the
  camera/file picker for photo upload, SpeechSynthesis voices for Kid Verse / the verse trainer / spoken chat, haptics,
  device-tilt sheen (only scroll-driven sheen was exercised).
- **Real push delivery**: the encryption and every job were proven against the stand-in receiver; an actual
  notification arriving on a phone has not been observed (headless Chrome cannot register with FCM).
- **Crons on the live schedule**: 8 am / 8 pm / Sunday jobs were forced via `/api/admin/cron/run`; a naturally timed
  run has not been watched.
- **The TV on a TV**: the board was held for a simulated 24 h in headless Chrome, not on an Apple TV / Safari kiosk.
- **Chat with the real model**: verified live once as Mea (Phase 5); the round-2 tools were proven against the mock only.
- **The Dollywood apps on the day**: GPS sharing between two phones in the park.
- **R2**: not enabled on the account; photos live in the D1 `media` table until a `MEDIA` bucket is bound.

## Housekeeping notes

- The local test loop needs `wrangler dev` on 8787 and `playwright-core` on `NODE_PATH`; the 8765 suites must run one
  at a time; `reset-local-db.js` (scratchpad) resets the local D1 and applies migrations 002/005 when missing.
- `sw.js` is at `hub-v18`; `node scripts/bump-sw.mjs --check` verifies the precache list.
