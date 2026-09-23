# House Hub — Experience & Visual Fidelity Audit Constitution

Read at the start of every phase. Each phase is launched by its own kickoff prompt.

## GOAL
Make the hub and every app in it feel like first-party Apple software dressed in a vibrant
pastel palette: delightful, fast, glanceable on an iPad that stays open 24/7, and effortless
for everyone in the household, from pre-readers to grandparents. Audit features, ease of use,
issues, visual fidelity, and improvements for the hub shell and every app, then fix.

## GROUND RULES
1. Evidence only. Code claims cite file:line; visual claims cite a screenshot path. If
   something isn't there, write "NOT FOUND IN CODE."
2. Phases 0-5 change no app code. Write only to audits/ (tooling goes in audits/tools/).
3. Never report something fixed or verified without re-running the check (re-capturing
   screenshots for visual changes) and reporting that second result. Name what you did not
   verify.
4. Never touch real family data. Screenshots and tests run against a local dev instance with a
   seeded demo household. Before any schema change in Phase 6, export a backup of the
   production database and tell me where it is.
5. Flag anything that exists only locally (uncommitted files, local secrets, dev-only config)
   that would be lost or break on deploy.
6. Hosting is unconfirmed: I believe Cloudflare, but it may be GitHub Pages. Confirm from
   config in Phase 0 before assuming anything about deploys.
7. Do not re-propose features I have declined: a kid routines/stars app and a shared grocery
   list.
8. End every phase by writing its output, then commit only the files under audits/ with the
   message 'audit(phase N): <one-line summary>'. Do not push. Then stop and summarize for me.
   Do not roll into the next phase.

## THE HOUSE STYLE — the bar every screen is graded against

Direction: Apple first-party software of the iOS/iPadOS 26 Liquid Glass era, with vibrant
pastels in place of Apple's default blue and gray. Apple's own apps re-skinned in candy
colors — not a pastel "theme" on a generic web page.

References (fetch and read these):
- Liquid Glass overview: https://developer.apple.com/documentation/technologyoverviews/liquid-glass
- WWDC25 "Meet Liquid Glass": https://developer.apple.com/videos/play/wwdc2025/219/

Typography
- font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
  This renders SF Pro on Apple devices legitimately. Never embed SF Pro as a web font —
  Apple's license does not allow it.
- Use ui-rounded (SF Pro Rounded) for big numerals (timer, tally, progress counts) and
  throughout kid mode.
- Base on the iOS Dynamic Type scale: Large Title 34 bold, Title 1 28, Title 2 22, Title 3 20,
  Headline 17 semibold, Body 17, Callout 16, Subheadline 15, Footnote 13, Caption 12/11.
  Scale up for across-the-room reading on iPad; never below 11.
- Hierarchy through weight and size, not color alone. Tight tracking on large titles.

Color — vibrant pastel
- Pastels for fills, tiles, chips, and card backgrounds; a deep ink of the same hue for text
  and icons placed on them. Never white text on a pastel.
- Starting palette (fill / ink). Verify every pair at >= 4.5:1 for text and >= 3:1 for large
  text and icons. If a pair fails, darken the ink — never dull the fill.
    Bubblegum   #FFC8DD / #A3134F
    Peach       #FFD6B8 / #9A3F0A
    Butter      #FFF1A8 / #735A00
    Mint        #B9F2D0 / #0E6B3B
    Aqua        #B5EEF0 / #0B6468
    Sky         #BFDDFF / #1A4F9C
    Periwinkle  #CCD3FF / #3440A8
    Lavender    #E0CCFF / #5E2BAE
- Vibrancy comes from gradients and saturation, never from gray: app tiles use a
  pastel-to-saturated gradient within one hue, the way iOS app icons do.
- Neutral surfaces: iOS-style grouped background (around #F2F2F7) with white cards in light
  mode; near-black background with elevated dark cards in dark mode.
- Dark mode flips roles: deep tinted surfaces with the pastel as the glowing foreground and
  accent. Pastels must stay vibrant in dark mode, never muddy.
- Each profile gets a distinct pastel accent, applied consistently (profile chip, selection
  states, progress, activity feed). Never rely on hue alone to tell profiles apart — pair it
  with an initial or avatar, so it works for color-blind viewers.
- Semantic colors (success, warning, destructive) come from the pastel family but must stay
  unmistakable.

Shape, depth, material
- Large, continuous-feeling corner radii. Concentric corners: an inner element's radius =
  outer radius minus padding.
- Liquid Glass for the navigation and control layer only — tab bars, toolbars, floating
  buttons, sheets, the profile switcher — floating above content. Content cards stay solid.
  Web approximation: translucent fill + backdrop-filter blur and saturate + 1px inner
  highlight + soft shadow, with content visibly scrolling beneath.
- Honor prefers-reduced-transparency where supported (frostier or solid fallback) plus an
  in-app toggle; honor prefers-contrast: more and prefers-reduced-motion.
- backdrop-filter is expensive and the iPad runs 24/7: keep glass layers few, and measure
  frame rate and CPU.

Layout and spacing
- 4/8pt spacing rhythm; 16-20pt margins on phone, wider on iPad. Whitespace does the
  hierarchy work.
- 44x44pt minimum tap targets; larger in kid mode.
- The Home tile grid must be responsive. Tiles are currently too big on the phone — target
  iOS home-screen density on phone and larger glanceable widgets on iPad.
- Safe areas respected in standalone PWA mode on iPad and iPhone.

Iconography
- One open-source icon set with SF Symbols-like weight and rounded terminals (e.g. Lucide or
  Phosphor), consistent stroke weight and optical size in every app. Never ship SF Symbols —
  Apple's license restricts them to software running on Apple platforms, not websites.

Motion and feedback
- Spring-based transitions, quick (200-350ms) and interruptible. Press states scale to about
  0.97 with a slight brightness shift. Sheets slide up. Content never jumps (no layout shift).
- Every tap gets immediate visual feedback. Prefer undo over confirm dialogs for destructive
  actions, the way Apple does.

Native feel — eliminate every web tell
Gray tap highlight; text selection or callout on long-press of UI chrome; default form
controls; browser focus rings on touch (use :focus-visible); blue underlined links; white
flash on load or navigation; rubber-band overscroll revealing a mismatched background; tap
delays; visible scrollbars on chrome; layout shift as data loads; spinners where skeletons
belong; alert() / confirm() / prompt().

Glanceability and audiences
- The iPad sits open 24/7 and is read from across the room: key information (today's reading,
  running timers, leftovers expiring) must be legible at 2-3 meters.
- Kid profiles are used by pre-readers (ages 4-5): every kid-mode flow must be completable
  using icons, color, and position alone, with no reading required.
- The kiosk profile runs on a TV: a 10-foot, read-only UI at 1920x1080.
- Adults include grandparents: nothing important hidden behind gestures alone or small type.

## SCORING RUBRIC — apply to the shell and every app
Score 1-10 per dimension, citing screenshots:
Typography / Color & palette / Layout & spacing / Shape, depth & material / Iconography /
Motion & feedback / Dark mode / Native feel / Glanceability / Ease of use / Delight
Anchors: 10 = could pass for a first-party Apple app in the house palette; 7 = polished App
Store-quality third-party app; 4 = clean but obviously a web page; 1 = default browser styling.

## DEVICE MATRIX
- iPad (primary): portrait and landscape, installed as a home-screen PWA, open 24/7
- iPhone Pro Max: installed PWA and Safari tab
- TV kiosk: 1920x1080 landscape
- Desktop browser: 1440 wide
Light and dark mode on each.

## PHASES

### Phase 0 — Inventory and baseline -> audits/00-inventory.md
Record the current git commit hash at the top as the baseline. Confirm hosting from config
(wrangler.toml, Pages config, GitHub Actions, CNAME) and the live URL. Map index.html,
apps.json (every entry), apps/ (every file, including any not registered), the hub.js SDK API
surface, design.css, the database schema, every Worker and route (sync, auth/PIN, pairing,
chatbot, push), the PWA manifest, service worker, and icons.
For each planned feature, state EXISTS / PARTIAL / NOT FOUND with file:line: profile picker;
PIN created on first tap for adults; device pairing code; kid mode; kiosk profile; admin
panel; glanceable Home with widget tiles; per-profile accent color and shared design.css;
skeleton loading; pull-to-refresh; push notifications; voice add; family activity feed; hub
chatbot with actions and a per-profile daily cap; cross-device sync.
List every place an app bypasses hub.js or design.css.

### Phase 1 — Visual capture -> audits/screens/ + audits/01-capture.md
Build a rerunnable capture rig under audits/tools/:
- A seed script that creates a demo household covering every profile type, with realistic
  data.
- A Playwright script (WebKit engine, the closest to Safari) that captures every screen of the
  hub and every app across the device matrix, in light and dark, in each state: empty,
  typical, overflowing (long names, many items), loading, offline/error.
Name files audits/screens/<area>/<screen>-<state>-<device>-<mode>.png and write a
contact-sheet index in 01-capture.md. The rig must run with one command — Phase 6 depends on
it for before/after proof.
List what Playwright WebKit cannot show (true Liquid Glass rendering, standalone PWA chrome,
notifications, real touch behavior) as manual checks for the real iPad and iPhone.

### Phase 2 — Hub shell and platform -> audits/02-shell.md
With screenshots and file:line, audit:
- Home and launcher: widget glanceability from across the room, tile density per device,
  taps and time to switch apps.
- Profiles: picker, first-tap PIN creation, PIN entry, switching profiles on the shared iPad,
  device pairing, kid mode, kiosk mode (read-only enforced server-side, not just hidden),
  admin panel.
- Sync: does data persist and appear on another device (the original bug was F260 progress
  not saving on the phone); conflicts when two devices edit; offline queue versus silent loss;
  live refresh when another device changes data.
- 24/7 stability: memory growth over hours; timers computed from timestamps rather than
  intervals (iOS throttles background tabs); Screen Wake Lock for kiosk and timer; midnight
  rollover of "today"; how a PWA that never closes picks up a new deploy.
- Chatbot: entry UX and clarity about what it did; actions confirmed or undoable; kid-profile
  restrictions; API key server-side only; daily cap enforced server-side; graceful behavior
  when the cap is hit or the API is down. Report what family data is sent to the API.
- Notifications, voice add, activity feed, PWA install and standalone behavior.
- PIN security proportionate to a family hub: hashed, verified server-side, rate-limited, not
  bypassable from browser dev tools.

### Phase 3 — Every app, deep dive -> audits/03-apps/<app-id>.md + audits/03-apps.md
One agent per app: every app in apps.json and apps/ — at minimum the F260 reading plan,
leftovers tracker, prayer app (two lists), tally counter, and timer; discover the rest.
For each app:
1. Purpose and the top 3 jobs a household member uses it for.
2. Features present, and gaps versus its closest Apple first-party equivalent and best-in-class
   alternatives (e.g. timer -> Clock timers; prayer lists -> Reminders; leftovers -> Reminders
   with dates; F260 -> Fitness-style progress and streaks). Name the reference used.
3. Ease of use: taps from Home to complete each top job (target <= 2 for the most frequent),
   discoverability, undo, error prevention, one-handed phone use, iPad glanceability, and
   pre-reader usability where the app is kid-accessible.
4. Issues and bugs with file:line: correctness, date/time logic, data loss, sync, edge cases.
5. Visual fidelity: full rubric scores with screenshot references, and a concrete list of
   every deviation from the house style.
6. Platform compliance: data through hub.js; design.css tokens (count hardcoded colors, sizes,
   radii); per-profile accent; dark mode.
7. Improvements ranked by delight divided by effort, split into polish, missing features, and
   new ideas.
App-specific checks: timer — accurate after backgrounding, keeps the screen awake, alert
behavior when not in the foreground. Tally — large targets, undo, rapid repeated taps.
Leftovers — date math, timezone, colorful and legible expiry states. F260 — progress
persistence across devices, catch-up for missed days. Prayer — the two-list model and an
answered-prayer history.

### Phase 4 — Design system and consistency -> audits/04-design-system.md
Across the shell and every app: what design.css defines versus what apps actually use; every
hardcoded value that should be a token; inconsistencies in type, spacing, radius, icons,
shadow, glass, and motion between apps; dark mode completeness; per-profile accent use; the
web-tells list checked everywhere; contrast of every text/background pair actually in use.
Produce one scorecard table — rows: shell plus each app; columns: rubric dimensions plus an
overall average. Propose the complete token set (color, type, spacing, radius, shadow, glass,
motion) that closes the gaps.

### Phase 5 — Findings, plan, and design preview -> audits/05-findings.md + audits/design-preview.html
One entry per finding:
ID / Title / Area (shell or app id) / Type (bug, usability, visual, feature gap, improvement) /
Severity (Critical = data loss, a security hole, or an app unusable on a primary device) /
Evidence (file:line and/or screenshot) / What happens now / Why it matters to the household /
Proposed fix / Effort S|M|L / How it will be verified (which screenshots get recaptured,
which checks rerun).
Plan in batches, one commit each: batch 1 = design tokens, design.css, and shared components;
batch 2 = hub shell; then one app per batch, ordered by daily use times gap size. Pull
Critical bugs forward.
Build audits/design-preview.html: the full palette as swatches in light and dark with the
computed contrast ratio shown on each fill/ink pair; the type scale; glass samples over busy
content; tiles at phone and iPad density; profile accents side by side; and a before/after
mock of the most-used app in the new style. Run it through the capture rig so I can review
screenshots too.
Stop. Write no app code.

### Phase 6 — Implement (only after I approve the plan and the design preview)
One batch per commit. After each batch: rerun the capture rig for every affected screen,
compare against the Phase 1 baseline, rescore the rubric for what changed, rerun the build and
any tests, and report those second results with screenshot paths. Name anything not verified.
Back up the database before any migration, and keep migrations additive. Update
audits/05-findings.md with status (FIXED / PARTIAL / DEFERRED / NEEDS DEVICE CHECK) and the
commit hash. Never mark a visual finding fixed without an after-screenshot.
