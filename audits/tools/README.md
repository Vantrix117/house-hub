# Capture rig (audit Phase 1)

One command captures every screen of the hub and every app, across the device matrix, in light and dark, in each state:

```bash
node audits/tools/capture.mjs
```

The output is `audits/screens/<area>/<screen>-<state>-<device>-<mode>.png`. The same run writes `audits/screens/manifest.json` (one entry per file, with capture errors and the page's console errors), the contact sheets in `audits/screens/_sheets/`, and the index section of `audits/01-capture.md`.

## What it runs against

- **Local server.** `lib/server.mjs` serves the repo as GitHub Pages would. It also runs the real Worker source (`worker/src/index.js`) in Node, against an in-memory SQLite database. D1 is SQLite, so a small shim is enough: `lib/d1.mjs`.
- **Demo data.** Every capture starts from a freshly seeded demo household (`seed.mjs`).
- **Demo clock.** Tuesday 22 Sep 2026, 8:40 am New York (`DEMO_TIME` in `seed/story.mjs`).
  - The seed stamps everything relative to that instant.
  - The browser clock is fixed 0.5 s after it, so a "5 min ago" label never lands on a rounding boundary.
  - The Worker's clock restarts at the demo instant on every reset and then runs 1000× slower than real time, so it keeps its order for last-write-wins and pull cursors without drifting.
- **No production traffic.** The Worker's outbound fetches are stubbed: queue-times goes to `seed/waits.mjs` and Anthropic goes to `lib/anthropic-mock.mjs`. Every other outbound fetch is refused. The production API host is also blocked in the browser.
- **Nothing installed in the repo.** Playwright (`playwright-core` 1.63.0 and its WebKit build) installs itself on first run into `%LOCALAPPDATA%\house-hub-audit`, or `$HUB_AUDIT_HOME` if set.

## Options

| Flag | Meaning |
|---|---|
| `--area a,b` `--file f` `--screen x,y` `--state s` `--device d` `--mode light,dark` | Filter the plan. `--file` names an `areas/<f>.mjs` file, for when two files share an area. |
| `--quick` | iPad portrait and iPhone PWA, light mode only. A screen with its own device list, such as the TV, falls back to its first device. |
| `--list` | Print the planned files and exit |
| `--out <dir>` | Write to another folder (trial runs). This skips the sheets and the index. |
| `--no-sheets` | Skip the contact sheets and the index |
| `--parallel N` | Number of browser contexts at once (default 4) |
| `--scale css\|device` | `css` (default) writes 1 image pixel per CSS pixel. `device` writes at the device pixel ratio (2× iPad, 3× iPhone). |
| `--serve [--variant v]` | Only run the seeded local instance, for poking around by hand |
| `node audits/tools/seed.mjs <variant>` | Print what a variant seeds |

## Storage and comparing runs

- **Storage.** `audits/screens/.gitignore` keeps the full-size PNGs out of git: the whole matrix is about 1.2 GB, and GitHub Pages refuses sites over 1 GB. `manifest.json` (with the SHA-256 and byte count of every PNG) and the JPEG contact sheets are committed. The rig regenerates any capture.
- **Exact comparison.** `node audits/tools/lib/compare.mjs <before manifest.json> <after manifest.json>` counts byte-identical captures and lists the rest.
- **Pixel comparison.** `node audits/tools/lib/pxdiff.mjs <before-dir> <after-dir> [--area a] [--tolerance 48] [--only-changed]` reports pixel changes beyond a tolerance, with a bounding box. Use this for Phase 6 before/after: resampled photos can differ by a few levels between identical runs, so SHA-256 alone over-reports.
- **Before/after layout.** Keep the Phase 1 set in `audits/screens/` as the baseline, and write an after run with `--out audits/screens-after/<batch>` (git-ignore it the same way).
- **Known limit.** `node audits/tools/lib/check-backdrop-filter.mjs` shows that this WebKit build paints no `backdrop-filter` blur.

## States

| State | How it is made |
|---|---|
| `empty` | Database variant `empty`: profiles, PINs and one device. No app data. |
| `typical` | Variant `typical`: a realistic Tuesday morning. |
| `overflow` | Variant `overflow`: long names and many items. |
| `loading` | The typical data, but the browser has no local cache and the data, profile, feed and chat-history API calls never answer. The capture is taken after 1.2 s, or after the screen's `loadingWait`. |
| `offline` | The typical data. After a warm load, the API and every external host become unreachable and `navigator.onLine` is false. The screen is then opened again from the local cache. The site's own files are still served in place of the service-worker cache; see 01-capture.md for why. |
| `error` | A screen-specific failure the screen script causes, such as a wrong pairing code or a wrong PIN. |

The database variant `park` is the typical data plus a park day. A screen asks for it with `variant: { typical: 'park' }`.

## Devices

These are defined in `lib/devices.mjs`.

| Name | Viewport | Notes |
|---|---|---|
| `ipad-portrait` | 820×1180 @2 | Home Screen app |
| `ipad-landscape` | 1180×820 @2 | Home Screen app |
| `iphone-pwa` | 430×932 @3 | iPhone Pro Max, Home Screen app |
| `iphone-safari` | 430×740 @3 | Safari tab. Captured only for the `typical` and `error` states. |
| `desktop` | 1440×900 @1 | |
| `tv` | 1920×1080 @1 | Kiosk only |

## Adding or changing a screen: `areas/<file>.mjs`

```js
export const area = 'leftovers';            // folder under audits/screens (defaults to the file name)
export const screens = [
  {
    screen: 'main',                          // file name part; unique within the area
    profile: 'eli',                          // who is signed in: a profile id, null = signed out (picker), 'unpaired' = no device
    states: ['empty', 'typical', 'overflow', 'loading', 'offline'],
    devices: ['tv'],                         // optional; defaults to the five non-TV devices
    variant: { typical: 'park' },            // optional state → database variant override
    note: 'One line shown in the index.',    // optional
    sw: false,                               // true = allow the service worker (default blocked)
    localStorage: { 'some.key': 'value' },   // optional extra localStorage (JSON-encoded unless it is already a string)
    loadingWait: 1200, settle: 350,          // optional timings (ms)
    modes: ['light'],                        // optional; defaults to light and dark
    lastProfile: 'tv',                       // optional hub.lastProfile for the picker (defaults to the signed-in profile)
    isolate: true,                           // fresh database for every capture of this screen (screens whose taps write); error states are always isolated
    animations: 'allow',                     // keep CSS animations running in the shot (default: finished), e.g. to catch a toast mid-display
    async go(t) {                            // get the screen into the state to capture; the rig then settles and shoots
      const f = await t.openApp('leftovers', { wait: '.card' });   // opens index.html#leftovers, returns the app's Frame
      if (t.loading) return;                 // loading: data never arrives, so do not wait for it
      await f.locator('text=Aging').first().scrollIntoViewIfNeeded();
    },
    async after(t) {},                       // optional: runs after settle, just before the shot (re-scroll, move the clock)
  },
];
```

**The `t` helpers** available inside `go`:

| Helper | What it does |
|---|---|
| `t.goto('#home')` | Open the shell at a hash |
| `t.openApp(id, { wait })` | Open an app in the shell's viewer and return its Frame |
| `t.page`, `t.ctx`, `t.frame()` | The page, the browser context, and a FrameLocator for `#frame` |
| `t.appFrame(id)` | The app's Frame, after `openApp` |
| `t.site`, `t.api` | The local site and API origins |
| `t.tap(selectorOrLocator)` | Tap on touch devices, click otherwise |
| `t.tapIn(frameOrLocator, selector, { force })` | The same inside a frame. `force` skips Playwright's actionability waits, which are slow on SVG-heavy pages. |
| `t.hold(match)` | Leave matching requests unanswered. `settle` does not wait for them. |
| `t.answer(match, { status, body, contentType, headers })` | Fulfil matching API requests with a canned response. CORS headers for the site are added. |
| `t.failApi(match, { status, error, message })` | Fail matching API requests the way the Worker does: `{ error, message }` with a status. |
| `t.clockTo(msOrDate)` | Move the fixed browser clock |
| `t.scroll(selector, y, where)` | Scroll a container |
| `t.sleep(ms)`, `t.settle()` | Wait |
| `t.state`, `t.loading`, `t.offline`, `t.error`, `t.reopened` | The current state. `t.reopened` is true on the offline second pass. |
| `t.device`, `t.dev`, `t.touch`, `t.mode`, `t.profile`, `t.variant` | The device and context |

`match` can be an `/api/…` path prefix, a RegExp, or `(url) => bool`. A request that a screen holds, whether through `t.hold` or the loading state, never answers, and `settle` does not wait for it.

Screens must never change app code. They navigate, tap and type. They may also emulate the edge of the page: API answers and failures, the clock, and a browser API stub through `t.ctx.addInitScript`.

Every context gets an inert `webkitSpeechRecognition` when the engine has none. Safari has it, so the hub's mic buttons show on a real iPad; the stub makes them show in captures too. It never hears anything.

## Adding data: `seed/<app>.mjs`

Each file default-exports `function (h)`. `seed.mjs` runs them in `SEED_ORDER`, after it has created the profiles, PINs, guests, devices, sessions and photos. The household story that every seed reads is `seed/story.mjs`.

The helpers passed as `h`:

| Helper | What it does |
|---|---|
| `h.variant`, `h.base`, `h.empty`, `h.typical`, `h.overflow`, `h.park` | Which variant is being seeded |
| `h.now`, `h.day(offset)`, `h.time(offset, 'HH:MM')`, `h.ago(mins)`, `h.isoWeek(offset)` | Dates, in New York local time |
| `h.person(pid, app, key, value, at)`, `h.family(app, key, value, at)`, `h.put(scope, pid, app, key, value, at)` | Write an `app_data` row |
| `h.get(scope, pid, app, key)`, `h.list(scope, pid, app, prefix)` | Read what an earlier module wrote |
| `h.activity(pid, app, text, at)` | Add a family-feed line |
| `h.chat(pid, role, content, at)` | Add a chat-log row |
| `h.push(pid, kind, ok, at)` | Add a push-log row (what Admin → Usage counts) |
| `h.media(key, bytes)`, `h.asset(name)`, `h.assetNames()` | Photos. The rendered assets are `photo-a`, `photo-b` and `album-1` to `album-12`, each at `-256.jpg` and `-1024.jpg`. |
| `h.uid(prefix)` | Deterministic ids |
| `h.profiles()`, `h.name(id)` | Profile rows |

All seeded content is invented. PINs and the pairing code are random on every run and are never printed.

## Experiments (Phase 2 and later): `lib/local.mjs`

The capture rig takes pictures. The harness runs behaviour against the same local instance: two devices at once, offline and online, clock control, scripted chat, push to a local receiver, and Chromium for heap and service-worker tests. Experiment scripts live in `audits/tools/phase2/<topic>/*.mjs`; run each one with `node`. Their evidence goes to `audits/evidence/p2/<topic>/`.

```js
import { local, sleep, DEMO } from '../../lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });   // or engine: 'chromium' (installed Chrome)
const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });              // a second paired device
const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
const f = await phone.openApp('f260');                                               // the app's Frame
await phone.setOffline(true);  /* … */  await phone.setOffline(false);
await L.apiAs('ezra', '/api/data/leftovers?scope=family');                          // raw API as a profile
await L.anthropic([{ text: 'Done.', tools: [{ name: 'add_prayer', input: { … } }] }]); await L.anthropicLog();
await L.close();
```

**The server behind it** (`lib/server.mjs`) adds rig-only endpoints and options. The capture rig uses none of them, so its captures stay reproducible:

| Endpoint or option | What it does |
|---|---|
| `/__rig/device` | A second paired device with sessions |
| `/__rig/pairing-code` | A known throwaway pairing code |
| `/__rig/clock` | Moves the Worker's demo clock |
| `/__rig/anthropic` | The chat upstream script and its request log |
| `/__rig/overlay` | Serves files from a folder under `audits/` over the repo, to simulate a deploy |
| `--clock real` | The Worker runs on the real clock |
| `--site-cache-control` | Sets the site's Cache-Control header |
| `HUB_RIG_VAPID_*` | Enables push to a local receiver such as `scripts/push-receiver.mjs` |

## Phase 3 tools: `phase3/`

Experiment and verification scripts for each app live in `phase3/<app-id>/`: the investigator's, the skeptics' (`verify-*`), the visual checker's (`vischeck-*`) and the critic's (`critic-*`). Their evidence goes to `audits/evidence/p3/<app-id>/`. There are also three shared tools, which only read files:

| Command | What it does |
|---|---|
| `node audits/tools/phase3/compliance.mjs [app-id …]` | Counts, per app, the hardcoded colours, font sizes, radii, spacing, shadows, durations and z-indexes. It also counts inline styles, undefined tokens, `prefers-color-scheme` use, hub.js bypasses, native dialogs and unguarded `:hover` rules. Every hit is listed with its line in `audits/evidence/p3/_compliance/<app-id>.json`, and the roll-up is `_summary.json`. It is regex-based, so review the hits. |
| `node audits/tools/phase3/check-citations.mjs [report.md …]` | Checks that every repo path cited in the Phase 3 reports exists and that every `file:line` is inside its file. It exits 1 if any citation is broken. |
| `node audits/tools/phase3/cited-evidence.mjs` | Rewrites `audits/evidence/p3/.gitignore` so that evidence PNGs no report cites stay on disk but out of git. Rerun it after editing a report. |

## Phase 5 tools: `phase5/`

| Command | What it does |
|---|---|
| `node audits/tools/phase5/catalog.mjs` | Every finding and positive of Phases 2-4 → `audits/evidence/p5/catalog.json` |
| `node audits/tools/phase5/remedies.mjs` | The Phase 3 improvements and Phase 4 gap rows, with the IDs each names → `audits/evidence/p5/remedies.json` |
| `node audits/tools/phase5/build-findings.mjs` | Writes `audits/05-findings.md` from the catalogue, the registers, `fixes-*.mjs` and `plan-batches.mjs`; exits 1 if a finding has no fix |
| `node audits/tools/capture.mjs --area preview --out audits/screens-preview` | Captures `audits/design-preview.html` (the `preview` area is opt-in: default runs skip it) |
| `node audits/tools/phase5/preview-sheets.mjs` | Contact sheets for those captures, without touching `audits/01-capture.md` |
| `node audits/tools/phase5/preview-check.mjs` | The preview in WebKit and Chromium at three widths and both schemes: every computed ratio passes, no horizontal scroll |
| `node audits/tools/phase5/preview-assets.mjs` | The preview's "before" JPEGs from the Phase 1 Prayer captures |

Two opt-in screen flags were added to `capture.mjs` for the preview: `fullPage` (capture the whole document) and `optIn` (run only when named with `--area`; `phase4/measure.mjs` skips such areas too). A default run still plans the 4,447 Phase 1 captures.
