# Dollywood build guide (`dollywood`) — Phase 3 deep dive

| | |
|---|---|
| **App code audited** | `fe6041d`, unchanged since the Phase 0 baseline. This phase changed no app code. |
| **File(s)** | `apps/dollywood.html` (2,797 lines; lines 1748-2796 are the inlined three.js r128 and OrbitControls). It is a generated file: `../dollywood-build-project/scripts/template.html` (1,743 lines) is rendered by `build_html.py` and copied in by `export_hub.py`, so every fix belongs in the template, followed by an export. Export-to-template line map: `audits/00-inventory.md:3962-3975` (export 1-682 = template 1-682; 697-1033 = template −3; 1035-1742 = template −2). Shared code it depends on: `apps/hub.js` (500), `apps/design.css` (617), `index.html` (1716; the viewer only, there is no Home card). Registry entry: `apps.json:9`. |
| **Date** | 2026-09-24 |
| **Inputs** | `audits/00-inventory.md` §9c "Apps — Dollywood build guide and park map (generated)" (lines 3958-4243; the build guide is lines 4005-4243); the 432 Phase 1 captures under `audits/screens/dollywood/` and the 29 sheets `audits/screens/_sheets/dollywood--*.jpg`; `audits/01-leads.md` "Dollywood build guide and park map" (lines 305-352; 27 build-guide leads); Phase 2 IDs P2-SYNC-01, P2-SYNC-03, P2-SYNC-15, P2-SYNC-18, P2-PROF-02, P2-PROF-19, P2-STAB-01, P2-PWA-08, P2-PWA-16, P2-VIS-03 and P2-SEC-02; P3-TALLY-05 and P3-TALLY-06 from the Tally report (`audits/03-apps/tally.md:314-330, 356-372`); P3-DOLLYWOOD-LIVE-09 and -14 from the park map report (`audits/03-apps/dollywood-live.md`). |
| **Runtime** | Local instance with the demo household (typical seed unless stated; overflow and empty seeds where stated), Playwright WebKit. Chromium where stated (the 3D, idle-CPU and rAF measurements, which need CDP, and cross-engine checks). Demo clock Tue 22 Sep 2026 08:40 New York; the migration and plot runs used the real browser clock. No production data or endpoint was touched. |
| **Reproduce** | Scripts in `audits/tools/phase3/dollywood/`, evidence in `audits/evidence/p3/dollywood/`. Run each with `node "audits/tools/phase3/dollywood/<name>.mjs"`. |

**How to read this.** Every bug, security or perf finding went to two independent skeptics. Each re-read the code and re-ran the finding with their own script; a third skeptic broke a tie (one finding needed it). A defect is **CONFIRMED** only when at least two skeptics reproduced it and more confirmed it than refuted it. Refuted findings go under "Checked and not a bug", and undecided ones under "Unresolved". UX, VIS, GAP and OK items describe the design, not malfunctions, so they were not adversarially verified. A separate agent re-checked every rubric score against the screenshots; a judge would have settled any gap of 2 or more points, but none arose. The visual checker also filed one bug of its own (the "Info tab" copy); its two skeptics confirmed it, and it is merged into P3-DOLLYWOOD-15, which the investigator had filed too. A completeness critic then re-read the report against the brief and ran its own sweep; its three new defects (P3-DOLLYWOOD-16 to -18) each went to two skeptics in the same way, and both confirmed all three. Severity follows the rule at the top of `audits/02-shell.md` (lines 25-37). **Pointers.** A finding that turns out to be the same defect as one in another report keeps its ID and its evidence, but becomes a pointer and is counted in that report: P3-DOLLYWOOD-01 points to P2-SYNC-03. **Severity splits.** On a split severity, the lead applies the severity rule to the corrected claim, and the finding says which clause decided it. One finding split: P3-DOLLYWOOD-07 (low / medium → medium: a secondary flow, the scale conversion, misleads after load, after an edit and after a synced change).

## Summary

- **What it is.** Eli's desk reference for rebuilding Dollywood in Planet Coaster 2. It lays USGS terrain, OpenStreetMap geometry and the 145 official 2026 listings on one map, with 242 build steps in 13 sections, per-person progress and a 3D terrain view (`apps/dollywood.html:570`, `:1060-1112`). The five household adults can open it (`apps.json:9`); in practice only Eli uses it.
- **Confirmed defects: 17 primary (1 critical, 0 high, 6 medium, 10 low), plus P3-DOLLYWOOD-01 as a pointer to P2-SYNC-03.** Three of the primaries (-16 to -18) come from the completeness critic's sweep. 1 was refuted (a claimed 3D texture leak) and none is unresolved.
  - The worst is **P3-DOLLYWOOD-02 (critical)**, a way to lose the whole build history: Import progress accepts any JSON file, including the hub's own Prayer backup, and replaces all progress with no check, confirm or undo (24 → 0). A second way is P2-SYNC-03 (critical), counted in Phase 2 and kept here as the pointer **P3-DOLLYWOOD-01**: opening the guide on a device that still holds the pre-hub progress key, while the first pull is slow (over 6 s), fails or runs offline, replaces the person's real progress on every device (24 ticks → 1).
  - The mediums: on phones the … menu (Export / Import / Reset) opens out of the sheet and cannot be used (-03); on phones the pressed 3D button never goes back to 2D (-04); with Upright on, every map jump on a phone frames the wrong place (-05, raised from low); the "up to N″" height filter hides every listing with no height requirement (-06); the step card's in-game metres ignore the saved plot width after load and after every change (-07, raised from low); on desktop, or an iPad with a keyboard, browser shortcuts such as Ctrl/Cmd+D (bookmark) tick or silently untick the current step and post a feed line, and Ctrl/Cmd+P, Ctrl/Cmd+= / − / 0 are taken over (-16).
  - The critic's two lows: the arrow keys pan an off-screen map instead of scrolling the page (-17); clearing the plot width does not reach another open device, and a leftover `dw-plot` key brings an old width back on every boot (-18).
- **Rubric: final average 3.9 / 10** (investigator 4.0). The visual checker lowered Colour & palette and Motion & feedback by one point and raised Glanceability by one. Layout & spacing, Motion, Native feel, Glanceability and Ease of use are weakest at 3.
- **Biggest usability gaps.** Ticking the step just built takes 3-4 taps plus a scroll, and Home has no build-guide card (UX-DOLLYWOOD-1). On iPad and desktop the map and the step card are never on screen together, so Next and Show on map move a map the person cannot see (UX-DOLLYWOOD-2). A phone's first screen is header, chips and parking lots (UX-DOLLYWOOD-3). Search results land about 2,000 px from the search box (UX-DOLLYWOOD-4). While the first pull loads, the guide looks like a first-time user with Mark done live (UX-DOLLYWOOD-5).
- **Biggest visual gaps.** Completed steps are struck through at 2.2:1 (VIS-DOLLYWOOD-1); 35 targets under 44 px on the phone (VIS-DOLLYWOOD-2); a serif display face with off-scale half sizes and 10.5 px caps (VIS-DOLLYWOOD-3); native selects, checkboxes, number spinners, `confirm()` / `alert()` and text-glyph buttons (VIS-DOLLYWOOD-8); a text-only toolbar on iPad and desktop.
- **What works.** Kids and the TV really cannot reach it through the hub or chat (OK-DOLLYWOOD-1). A tick on the phone reaches an open iPad in place (OK-DOLLYWOOD-2). The theme follows the person, with 0 `prefers-color-scheme` rules and 0 chrome hex in the CSS (OK-DOLLYWOOD-3). The accent reaches the chips and tools (OK-DOLLYWOOD-4). The 3D model builds in about half a second, with a lighter build on touch devices (OK-DOLLYWOOD-5). The map, the lit 3D model and the coaster cards earn Delight 6, the app's highest score.
- **Best-value improvements** (delight ÷ effort 4.0 each): hold writes until the first pull lands, with `hub.migrate` run only after a successful pull (closes P2-SYNC-03, which P3-DOLLYWOOD-01 points to, and the first-open wipe); validate and confirm Import, with undo for Import and Reset (closes P3-DOLLYWOOD-02); make the phone 3D button a toggle (-04).

## 1. Purpose and top jobs

The page is one long column (`apps/dollywood.html:566-680`): a header with hero art and four stats; the section chips with per-section progress bars; a toolbar (tools, zoom, 2D/3D, basemap, View ▾, search); the map; the build-steps card (a bottom sheet on phones); the cross-section profile; and a side panel with Listings / Layers / Scale tabs. The 3D view replaces the map in place.

There is no usage data. The seed gives progress only to Eli (`audits/tools/seed/dollywood.mjs`), which matches the household: Eli is building the park in the game.

| # | Job | Who | How often |
|---|---|---|---|
| J1 | Tick the step just built ("Mark done") | Eli, on the iPad or PC beside the game | Several times per build session (evenings, a few sessions a week) |
| J2 | Read what to build next: the step card's title, body and measurements converted to game metres | Eli | Every session |
| J3 | Look up a listing, coaster or building: ground height, footprint, facts, track | Eli | Many times per session |
| J4 | Terrain tools: cross-section, measure, 3D | Eli | Occasional |

## 2. Features and gaps

**References.**
- **LEGO Builder app** (https://www.lego.com/en-us/builder-app, read by the investigator): step-by-step 3D instructions that can be zoomed and spun around, progress saved as you go, and Build Together across devices.
- **Apple Maps** (https://support.apple.com/guide/iphone/view-maps-iph10d6e8a2c/ios, read): pinch zoom, rotate, tilt, a compass that reorients north, and a 2D / 3D switch.
- **Terrain tools:** Google Earth (measure) and CalTopo / Gaia GPS (elevation profiles). Product knowledge; these pages were not fetched.

| Capability | This app | Reference | Gap |
|---|---|---|---|
| Step-by-step instructions | 242 steps in 13 sections: phase pill, body, measurement and in-game metres, Prev / Next / Mark done / Show on map, Next unfinished, a step list (`apps/dollywood.html:1077-1086`) | LEGO Builder's step view | Mark done takes 3-4 taps plus a scroll; no Home surface (UX-DOLLYWOOD-1) |
| Progress saved and synced | One person-scope `progress` row through hub.js (`apps/dollywood.html:1062, 1105-1112`); chips show per-section bars (`apps/dollywood.html:1075-1076`) | LEGO Builder saves as you go | Whole-map row under last-write-wins (P2-SYNC-01); the migration race (P2-SYNC-03, pointer P3-DOLLYWOOD-01) |
| 3D view of the step | Lit 3D terrain with orbit, exaggeration and tap-to-pick (`apps/dollywood.html:1157-1290`) | LEGO Builder: zoom in and spin the step's model | The 3D view never shows the current step (GAP-DOLLYWOOD-1) |
| Undo | Mark done toggles; Reset uses `confirm()`; Import has nothing (`apps/dollywood.html:1086, 1098, 1101`) | Step back in LEGO Builder | No undo for Reset or Import (UX-DOLLYWOOD-10, P3-DOLLYWOOD-02) |
| Build together | None: progress is one person's row | LEGO Build Together | GAP-DOLLYWOOD-2 |
| Map navigation | Pan, zoom, Fit, Upright rotation in Layers, minimap (`apps/dollywood.html:809, 821, 1029`) | Apple Maps: pinch, rotate, compass tap to reorient north | The N compass is dead (P3-DOLLYWOOD-10); Upright fits wrong on phones (P3-DOLLYWOOD-05, -11); the arrow keys pan the map even when it is scrolled away (P3-DOLLYWOOD-17) |
| 2D / 3D switch | 2D and 3D buttons; on phones only 3D (`apps/dollywood.html:333, 587`) | Apple Maps' map-mode picker | The phone 3D button does not toggle (P3-DOLLYWOOD-04) |
| Search | `#q` filters the Listings tab; a single match flies to it and opens its card (`apps/dollywood.html:1007-1015`) | Apple Maps: a results card under the field | Results about 2,000 px away; no "no results" state (UX-DOLLYWOOD-4) |
| Place cards | Listing, building and coaster cards with facts, "Used in step N" and web search (`apps/dollywood.html:961-1002`) | Apple Maps place card | Cards run off-screen (UX-DOLLYWOOD-9); the "Unlisted structure" card offers an empty search (UX-DOLLYWOOD-13) |
| Rider-height filter | One select: any / no requirement / up to 36-55″ (`apps/dollywood.html:1007`) | The same file's park-map rule `fits()` (`apps/dollywood.html:1671`) | Wrong meaning (P3-DOLLYWOOD-06) |
| Measure | Two taps; shows metres and game metres (`apps/dollywood.html:875`) | Google Earth measure | Label hard to read over the map (VIS-DOLLYWOOD-14) |
| Elevation profile | Cross-section with a compare ghost (`apps/dollywood.html:951`) | CalTopo / Gaia profiles | The profile is 1,000 px below the map (UX-DOLLYWOOD-8); axis labels 5.7 px on phones (VIS-DOLLYWOOD-4) |
| Back up and restore | Export as a `data:` URL download, Import through `FileReader` (`apps/dollywood.html:1099-1101`) | LEGO Builder's account save | Import unchecked (P3-DOLLYWOOD-02); unreachable on phones (P3-DOLLYWOOD-03) |
| Scale to the game | Scale tab: plot width → compression factor (`apps/dollywood.html:1049-1052`) | None (game-specific) | Card ignores the factor (P3-DOLLYWOOD-07); "Info tab" copy (P3-DOLLYWOOD-15); implausible widths accepted (UX-DOLLYWOOD-12); a cleared width does not sync, and a legacy `dw-plot` key brings an old one back (P3-DOLLYWOOD-18) |

## 3. Ease of use

Taps were measured with real pointer clicks at element centres in `audits/tools/phase3/dollywood/taps.mjs` (evidence `audits/evidence/p3/dollywood/taps.json`); the server progress going 24 → 25 confirmed each Mark done.

| Job | Profile | Path | Taps | Target ≤ 2 for the most frequent | Met? |
|---|---|---|---|---|---|
| J1 Mark done (the most frequent) | Eli, iPhone PWA | Apps tab → Build guide tile → sheet handle (peek → half) → Mark done | 4 | ≤ 2 | **No** |
| J1 Mark done | Eli, iPad portrait | Apps tab → tile → scroll (card title at y=1400 in a 1132 px viewport) → Mark done | 3 + a scroll | ≤ 2 | **No** |
| J1 Mark done | Eli, desktop | Apps tab → tile → scroll (card top at y=1441 in 852) → Mark done | 3 + a scroll | ≤ 2 | **No** |
| J2 Read the next step | Eli, iPhone PWA | Apps tab → tile → sheet handle | 3 | ≤ 2 | **No** |
| J2 Read the next step | Eli, iPad portrait | Apps tab → tile, then a scroll | 2 + a scroll | ≤ 2 | **Partly**: 2 taps, but not on screen without scrolling |
| J3 Look up Thunderhead | Eli, iPhone PWA | Apps tab → tile → More → type "thunder" (a single match flies and opens the card) | 3 + typing | ≤ 2 | **No** |
| J3 Look up Thunderhead | Eli, iPad portrait | Apps tab → tile → type "thunder" | 2 + typing | ≤ 2 | **No** (the investigator counts the typed entry as a step) |
| J4 Cross-section | Eli, iPad portrait | Apps tab → tile → Cross-section → map point → map point, then a scroll to the profile at y=2101 | 5 + a scroll | n/a (occasional) | n/a |

Home has no build-guide card: `index.html` has no `data-open="dollywood"`, and the shell never loads `dollywood|person` (`index.html:458-459`). Every path starts at the Apps tab.

- **Discoverability.**
  - Mark done is below the fold on iPad and desktop, and inside a peeking sheet on phones (UX-DOLLYWOOD-1).
  - On iPad and desktop, Next and Show on map move a map that is scrolled away (UX-DOLLYWOOD-2).
  - Search and the cross-section give their result far from the control, with no pointer to it (UX-DOLLYWOOD-4, -8).
  - The Scale tab points to an "Info tab" that does not exist (P3-DOLLYWOOD-15).
  - On phones, nothing names a way out of 3D (P3-DOLLYWOOD-04).
- **Undo.** Mark done toggles, so a wrong tick can be taken back by tapping again, though the card has already moved on to the next step (`apps/dollywood.html:1086`). Reset is a native `confirm()` with no undo (UX-DOLLYWOOD-10). Import has neither (P3-DOLLYWOOD-02). `grep -n undo apps/dollywood.html` finds nothing.
- **Error prevention.**
  - Import accepts any parseable JSON (P3-DOLLYWOOD-02).
  - Mark done and Import are live while the first pull is still loading (UX-DOLLYWOOD-5; the loss itself is P2-SYNC-01).
  - The plot width accepts 12,500 m without comment (UX-DOLLYWOOD-12).
  - Reset looks the same as Export and Import (VIS-DOLLYWOOD-8).
  - Ctrl/Cmd+D, the browser's bookmark shortcut, toggles the current step: it ticks it (with a feed line) or silently unticks it. Ctrl/Cmd+P steps back, and the page takes over the browser's own shortcut in both cases (P3-DOLLYWOOD-16).
- **One-handed phone use.** The step controls sit in the bottom sheet, in the thumb zone, but need an expand tap first. The toolbar with tools, zoom, 3D and More sits near the top (about y=480). The sheet handle is 22 px tall (VIS-DOLLYWOOD-2). The … menu cannot be used at all (P3-DOLLYWOOD-03).
- **Desktop and hardware keyboards.** The single-key shortcuts (N, P, D, T, S, M, V, +, −, 0, the arrows) work anywhere outside an input, with no check for Ctrl, Cmd or Alt (`apps/dollywood.html:852-857`). Browser shortcuts therefore write progress or move the map (P3-DOLLYWOOD-16). The arrow keys pan an off-screen map instead of scrolling the page while the person reads the step card below it (P3-DOLLYWOOD-17); Space and PageUp / PageDown still scroll.
- **iPad glanceability at 2-3 m.** The investigator's heuristic is character height ≥ distance / 200 (2.5 m needs 12.5 mm, about 65 CSS px at 0.192 mm per px on an 11-inch iPad). The largest text, the 28 px title and stats (5.4 mm), reads to about 1.1 m; the 22 px step title to 0.84 m; the 14.5 px body to 0.56 m. The checker notes that the chips' progress bars and "N of M done" give some status at a glance. It is a desk tool, so this matters less than elsewhere.
- **Pre-readers (Ezra, Kiara).** They cannot open it: no tile, no Home card, `#dollywood` gives the toast "That app is not available for this profile.", and chat refuses both reads and writes (OK-DOLLYWOOD-1). Only by typing the file URL can a kid load it (P2-SEC-02).
- **Grandparents and guests.** Guests see it (adult apps rule) and can tick into their own person scope (`audits/evidence/p3/dollywood/visibility.json` `guest.tick`). They can take a household adult's legacy progress on a not-yet-migrated device (P3-TALLY-06; see §4), and nothing is written for a first-time visitor.

## 4. Issues and bugs

### Register

| ID | Severity | Defect |
|---|---|---|
| P3-DOLLYWOOD-01 | pointer → P2-SYNC-03 (critical) | Legacy build-guide progress migrates over the person's real progress when the first pull is slow, fails or runs offline |
| P3-DOLLYWOOD-02 | critical | Import progress replaces all progress with any JSON file, with no check, confirm or undo |
| P3-DOLLYWOOD-03 | medium | On phones the … menu opens out of the sheet: Export and Import cannot be reached, and only a sliver of Reset can |
| P3-DOLLYWOOD-04 | medium | On phones the pressed 3D button never returns to 2D, and nothing on screen names the way back |
| P3-DOLLYWOOD-05 | medium | On phones with Upright on, every map jump frames the unrotated box: Fit cuts off half the park and a section chip can miss its section |
| P3-DOLLYWOOD-06 | medium | The "up to N″" rider-height filter hides every listing with no height requirement |
| P3-DOLLYWOOD-07 | medium | The step card's in-game line ignores the saved plot width after load and after every plot change |
| P3-DOLLYWOOD-08 | low | Sitting idle in 2D, the step highlight's infinite pulse keeps the main thread busy (15.8-27.7% in Chromium) |
| P3-DOLLYWOOD-09 | low | After 3D has been opened once, the render loop keeps requesting 60 frames a second in 2D until the guide is closed |
| P3-DOLLYWOOD-10 | low | A dead "N" compass button sits over the iPad and desktop map, and over 3D |
| P3-DOLLYWOOD-11 | low | Turning Upright on or off with "Whole park" pressed zooms to the last-selected section |
| P3-DOLLYWOOD-12 | low | On phones the "?" popover opens off the left edge (48 of 267 px visible) |
| P3-DOLLYWOOD-13 | low | On iPad portrait the View ▾ menu runs 26 px past the right edge |
| P3-DOLLYWOOD-14 | low | After 3D, touch devices get the mouse hint "Move over the map… scroll to zoom" |
| P3-DOLLYWOOD-15 | low | The Scale tab refers to an "Info tab" that does not exist (also found by the visual check) |
| P3-DOLLYWOOD-16 | medium | The keyboard shortcuts ignore Ctrl, Cmd and Alt: Ctrl/Cmd+D (bookmark) ticks or silently unticks the current step and posts a feed line; Ctrl/Cmd+P and page zoom are taken over (from the completeness critic) |
| P3-DOLLYWOOD-17 | low | The arrow keys never scroll the page: they pan a map that is scrolled away, even while the person reads the step card (from the completeness critic) |
| P3-DOLLYWOOD-18 | low | Clearing the plot width does not reach another open device, and a legacy `dw-plot` key brings an old width back on every boot (from the completeness critic) |

### Phase 2 defects that show up here

- **P2-SYNC-01** (critical). Progress is one whole-map row, `hub.set('progress', Object.assign({}, doneMap))` (`apps/dollywood.html:1062`). A tick on a device that has not pulled replaces the row. Seen again here as a tick during a first open's load: server 24 → 1 (`audits/evidence/p3/dollywood/data-checks.json` `L2.tickDuringLoad`). The missing loading state is UX-DOLLYWOOD-5.
- **P2-SYNC-03** (critical). Same root cause as P3-DOLLYWOOD-01: `hub.migrate` trusts the local cache (`apps/hub.js:406-407`). Phase 2 left the Dollywood caller untested (`audits/02-shell.md:2975`). P3-DOLLYWOOD-01 keeps its ID as a pointer to this defect and is counted here, not in this report's totals. It adds this app's runs (24 ticks → 1 with the first pull held over 6 s, failed or offline) and two exposures: the shell never pulls `dollywood|person` first, and the page keeps writing the legacy key whenever it runs without a session (`apps/dollywood.html:1062`). The fix belongs in `apps/hub.js`.
- **P2-SYNC-18** (critical). The open `doneMap` is replaced only through `onChange` (`apps/dollywood.html:1108-1112`). A `refreshScope` swap without `onChange` would leave a stale map that the next tick writes back. Not re-run.
- **P2-PROF-02** (critical). Build-guide ticks are person scope, so offline ticks made before a Switch on the shared iPad get stuck the same way. Not re-run.
- **P2-PROF-19** (critical). "Forget this device" also deletes queued build-guide ticks (`hub.queue.dollywood.person.*`). It clears `hub.migrated` too, which re-arms P3-DOLLYWOOD-01 (`audits/02-shell.md:1627`). Not re-run.
- **P2-STAB-01** (critical). With Reduce Motion on, the shell is blank, so the build guide cannot be reached from the hub. Opened standalone, the app honours reduced motion (a skeptic of P3-DOLLYWOOD-08 had to measure it that way).
- **P2-PWA-08** (medium). An always-open hub never runs a new deploy, and the build guide is a generated export that changes on every re-export.
- **P2-VIS-03** (medium). Hearth on a dark-OS iPad paints the Midnight body while `data-scheme` stays `light`, so the app's dark-scheme rule (`apps/dollywood.html:219`: denser glass, `--dim` → `--text-2`) does not apply (`audits/evidence/p3/dollywood/theme-hearth-dark-os.json`; `audits/evidence/p3/dollywood/hearth-on-dark-os.png`). The checker saw a coherent dark screen; the mix shows only in the JSON.
- **P2-SEC-02** (low). `visibleTo` is client-only. Ezra loading `apps/dollywood.html` by URL wrote `progress={"entrance-01":true}` into his own row (`audits/evidence/p3/dollywood/visibility.json` `ezra.byUrl`).
- **P2-SYNC-15** (low). During a first open's load `hub.sync.state` reads `offline` although the device is online (`data-checks.json` `L1.duringLoad`). The app shows no sync wording of its own.
- **P2-PWA-16** (low). `apps/dollywood.html` is on the precache skip list (`scripts/bump-sw.mjs:18`) and not in `SHELL` (`sw.js:16`). Offline, a device that has not opened it online since the last `VERSION` bump gets the bare 503.

**From another app's Phase 3 report:**
- **P3-TALLY-06** (hub.js; `audits/03-apps/tally.md:356-372`). `hub.migrate` treats a guest as an adult (`apps/hub.js:400`). On a device that still holds `dollywood-build-progress-v2` (or `dw-plot`) and has no `hub.migrated` mark for `dollywood.person`, a guest who opens the guide first receives the legacy progress and plot in their own person scope (`apps/dollywood.html:1107`), and the device is marked migrated. The household adult who owns that progress never gets it, and the guest's copy is purged 30 days after the guest expires. The fix is shared: skip `is_guest` in `hub.migrate`. By code reading; not re-run in this app.
- **P3-TALLY-05** (shell cause; `audits/03-apps/tally.md:314-330`). `dollywood|person` is not a shell channel (`index.html:457-458`). So ticks still queued when the guide closes (offline or on a slow link) wait until it reopens on that device, and P2-SYNC-01's whole-map `progress` row can then discard them. By code; not run.

### Confirmed defects

#### P3-DOLLYWOOD-01 — Legacy build-guide progress migrates over the person's real progress when the first pull is slow, fails or runs offline (pointer to P2-SYNC-03)

**Pointer.** Same defect as P2-SYNC-03 (cause `apps/hub.js:406-407`); the roll-up counts it there. Kept as build-guide evidence. Extra exposure for P2-SYNC-03: the shell never pulls `dollywood|person`, and the page itself keeps writing the legacy key without a session (`apps/dollywood.html:1062`).

- **Severity: critical, counted under P2-SYNC-03** (skeptics: critical / critical; unchanged from the investigator's rating). Rule (a): opening the app in the shipped UI silently replaces a person's whole build progress, on every one of their devices. No hand-made request is needed, only a slow, failed or offline first pull. A narrow precondition goes in Exposure and does not lower the severity.
- **Exposure.** The device's localStorage holds `dollywood-build-progress-v2` and has no `hub.migrated` mark for `dollywood.person`. That key is not only a pre-hub leftover: the page still writes it whenever it runs without a hub session (`apps/dollywood.html:1062`), and "Forget this device" clears the mark (`audits/02-shell.md:1627`). The first `dollywood` person-scope pull must then take longer than 6 s, fail, or happen offline. The shell never pulls `dollywood|person` (`index.html:458-459`), so unlike F260 there is no safe case where the shell pulled first.
- **Related.** P2-SYNC-03 (same root cause). The fix is shared with it and belongs in `apps/hub.js`; the template needs no change for this.

**What happens now.**
1. On a device with no pulled scope, `hub.ready({optional:true})` races the first pull against 6 s (`apps/hub.js:324-337`). A failed pull resolves at once, because `hub.pull` catches every error (`apps/hub.js:315-318`).
2. The build guide calls `hub.migrate` straight afterwards (`apps/dollywood.html:1105-1107`).
3. `hub.migrate` checks only the local cache with `hub.has` (`apps/hub.js:224, 406-407`), although its own comment says a key moves "only if that key is still empty on the server" (`apps/hub.js:391-392`).
4. `hub.set` stamps the legacy map with the current time, so it wins last-write-wins on the server, and every other device of that person adopts it on its next pull.

The investigator's runs (`data-checks.json`):
- M0, normal pull: 24 ticks kept; the UI read "7 of 9 done".
- M1, pull held 8 s: server 24 → 1 (`entrance-01`); the UI read "1 of 9 done" with sync `synced`.
- M2, pull aborted: 24 → 1.

**Expected.** Migration runs only after a successful first pull of this app's person scope, as hub.js's comment promises, or asks before replacing anything.

**Why it matters to the household.** Months of build progress on every one of that person's devices are replaced by an old copy from one open on a slow connection, and nothing on screen says so. The only way back is an earlier "Export progress" file.

**Evidence.**
- Code: `apps/dollywood.html:1062, 1105-1107` (template `../dollywood-build-project/scripts/template.html:1060, 1103-1105`); `apps/hub.js:224, 315-318, 324-337, 391-392, 406-407`; `index.html:458-459`.
- Runs: `audits/evidence/p3/dollywood/data-checks.json` (`M0.migration`, `M1.migration`, `M2.migration`), `audits/evidence/p3/dollywood/verify-migrate-race-overwrites-progress-1.json`, `audits/evidence/p3/dollywood/verify-migrate-race-overwrites-progress-2.json`.
- Screenshots: `audits/evidence/p3/dollywood/migration-race-after.png`, `audits/evidence/p3/dollywood/verify-migrate-race-overwrites-progress-1-B-phone.png` (a second phone that never held the key shows "1 of 9 done"), `audits/evidence/p3/dollywood/verify-migrate-race-overwrites-progress-2-H7-ipad.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/data-checks.mjs" M0 M1 M2` (about 1 minute). Each arm resets the typical seed (Eli, 24 ticks), opens the guide on a fresh iPad context whose localStorage holds `dollywood-build-progress-v2={"entrance-01":true}`, and routes `GET /api/data/dollywood?scope=person` unchanged (M0), held 8 s (M1) or aborted (M2). Observed: `M0 server.ticks 24`; `M1 {pull:"held 8 s", server:{ticks:1, sample:["entrance-01"]}, ui.count:"1 of 9 done", sync:"synced"}`; `M2 {pull:"fails", server:{ticks:1}}`. Run with these arguments, the script writes `data-checks-M0-M1-M2.json` in the evidence folder; the cited `data-checks.json` is the full run with no arguments (`node "audits/tools/phase3/dollywood/data-checks.mjs"`, every arm).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-migrate-race-overwrites-progress-1.mjs"` (fresh WebKit instance, typical seed, legacy key `{"entrance-02":true}` on a fresh iPad context, only the first person-scope pull routed):
  - A, untouched: 24 → 24, "7 of 9 done".
  - B, held 8 s: 24 → 1 (`["entrance-02"]`), the iPad "1 of 9 done" and `synced`. A second, clean Eli phone then opened the guide and showed "1 of 9 done".
  - C, aborted: 24 → 1.
  - D, held 5 s: 24 kept.
  - E, opened offline and back online after 8 s: 24 → 1; the queued migration write won on reconnect.
  - `hub.migrated` was marked in every arm, and nothing on screen said anything had been replaced.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-migrate-race-overwrites-progress-2.mjs"` (WebKit, real clock, a fresh reset per arm, legacy key `{"entrance-01":true}`):
  - C, normal pull: 24 → 24.
  - H5, held 5 s: 24 → 24.
  - H7, held 7 s: 24 → 1 (`["entrance-01"]`), `updated_at` changed, the iPad "1 of 9 done", `synced`, `hub.migrated` set. Eli's phone, which has no legacy key, then showed "1 of 9 done".
  - F, aborted: 24 → 1.
  - Also checked that the service worker cannot mitigate it: it returns early for cross-origin requests (`sw.js:28, 36`).

**Corrected claim.** Accurate, and the trigger is wider than filed:
1. The cut-off is `hub.ready`'s 6 s race: a 5 s hold is safe, a 7 s hold overwrites.
2. A failed pull overwrites at once, and an offline open overwrites on reconnect.
3. The whole `progress` map is replaced, not merged, and every other device adopts it.
4. The legacy key keeps being written whenever the page runs without a hub session (`apps/dollywood.html:1062`), and "Forget this device" re-arms the migration.
5. The second migrate entry (`dw-plot` → `plot`, `apps/dollywood.html:1107`; template `../dollywood-build-project/scripts/template.html:1105`) passes the same local-only check, so a legacy plot width replaces the synced plot under the same trigger (by code reading; not separately run). The step card then converts every measurement by the legacy width.

#### P3-DOLLYWOOD-02 — Import progress replaces all progress with any JSON file, with no check, confirm or undo

- **Severity: critical** (skeptics: critical / critical; unchanged). Rule (a): the shipped UI (… → Import progress → one file) permanently replaces the person's whole progress row. There is no dialog, no undo and no server history, and the loss syncs to every device. No dev tools are needed.
- **Exposure.** Someone picks the wrong `.json` file, or an older export, in the picker. The input accepts only JSON (`apps/dollywood.html:648`), and the hub's own Prayer export, `prayers-<date>.json` (`apps/prayer.html:1500-1505`), is exactly such a file and can sit in the same Downloads or Files folder. iPad and desktop only: on phones the menu cannot be reached (P3-DOLLYWOOD-03).

**What happens now.** The import handler runs `JSON.parse`, then `doneMap = j.done || j; save(); renderStep()` (`apps/dollywood.html:1101`). The only error path is `alert('Not a progress file')` for text that does not parse. Reset asks `confirm()` first (`apps/dollywood.html:1098`); Import asks nothing. The investigator's runs:
- I1, a Prayer-style backup: the server's `progress` row became the foreign object (keys `app`, `version`, `exported`, `items`), ticks 24 → 0, every chip read 0/N, no dialog.
- I2, an older build-guide export with 2 ticks: 24 → 2, no dialog.

**Expected.** Reject a file whose done map holds no known step ids. The `|| j` fallback deliberately accepts a bare map (the legacy localStorage shape), so the check should be for known step ids, not for a `version` field. Say what will change ("Replace 24 ticks with 2?") or merge the two, and offer undo.

**Why it matters to the household.** One wrong file in the picker erases the whole build history on every device, with no way back unless an export was made first.

**Evidence.**
- Code: `apps/dollywood.html:648, 1098-1101` (template `../dollywood-build-project/scripts/template.html:1096-1099`); `apps/prayer.html:1500-1505`. `grep -n undo apps/dollywood.html`: 0 hits.
- Runs: `audits/evidence/p3/dollywood/data-checks.json` (`I1.import`, `I2.import`), `audits/evidence/p3/dollywood/verify-import-accepts-any-json-1.json`, `audits/evidence/p3/dollywood/verify-import-accepts-any-json-2.json`.
- Screenshots: `audits/evidence/p3/dollywood/import-wrong-file-after.png`, `audits/evidence/p3/dollywood/verify-import-accepts-any-json-1-A-after.png` ("0 of 9 done"), `audits/evidence/p3/dollywood/verify-import-accepts-any-json-2-A-ipad.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/data-checks.mjs" I1 I2`. As Eli on the iPad (typical seed), it sets a non-export JSON file (I1) and an older export (I2) on `#b-file`, then reads `GET /api/data/dollywood?scope=person`. Observed: `I1 before {ui:"7 of 9 done", ticks:24} after {ui:"0 of 9 done", ticks:0}`; `I2 after {ui:"2 of 9 done"}`; no dialogs. Run with these arguments, the script writes `data-checks-I1-I2.json` in the evidence folder; the cited `data-checks.json` is the full run with no arguments.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-import-accepts-any-json-1.mjs"` on a fresh rig through the real path: a tap on `#b-menu`, a tap on `#b-import`, then Playwright's file chooser.
  - A, `prayers-2026-09-01.json` shaped like a Prayer export: "7 of 9 done" and 24 ticks before; afterwards "0 of 9 done", the server row `{ticks:0, keys:["version","lastExport","prayers","settings"]}`, sync `synced`, dialogs `[]`. Reopened on a fresh device: "0 of 9 done".
  - B, an older export with 2 ticks: 24 → 2, dialogs `[]`; the reopened app showed "2 of 9 done".
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-import-accepts-any-json-2.mjs"` (the same real UI path on the Kitchen iPad, then a second paired phone):
  - A: "7 of 9 done" → "0 of 9 done"; server keys `["prayers","cats","lastExport"]`, 0 ticks; no dialog and no undo control; the phone showed "0 of 9 done".
  - B: 24 → 2 ticks, no dialog; the phone showed "2 of 9 done".

**Corrected claim.** The core holds, with two refinements from the skeptics:
1. The most realistic wrong file is the hub's own Prayer export, which the picker offers because of `accept=application/json`.
2. With an older build-guide export, replacing progress is what Import is for; the defect there is only the missing confirm and undo that Reset has. Arm A, a foreign file silently wiping everything, is the bug proper.

#### P3-DOLLYWOOD-03 — On phones the … menu opens out of the sheet: Export and Import cannot be reached, and only a sliver of Reset can

- **Severity: medium** (skeptics: medium / medium; unchanged). Export, Import and Reset form a secondary flow, since daily progress syncs through hub.js. On the phone layout it is broken in every sheet state, and there is no other route to these actions. No data is lost, because Reset still asks `confirm()`.
- **Exposure.** Widths under 700 px (the hub flavour's phone layout). iPhone landscape (932 px), the iPad and desktop open the menu downward, and it works there.

**What happens now.** Inside the `@media (max-width:699px)` block that opens at `apps/dollywood.html:313`, the menu is set to open upward (`bottom: calc(100% + 6px)`, `apps/dollywood.html:371`). It hangs off the sheet's top row, and the sheet is `position: fixed` with `overflow: hidden` (`apps/dollywood.html:359`), so almost all of it is clipped. The investigator measured 17 px of the 158 px menu visible (menu top 625, sheet top 766); the centre of Reset hit the map.

**Expected.** The menu opens downward inside the sheet (the default `top: calc(100% + 6px)` before `:371` overrides it), or opens as its own sheet.

**Why it matters to the household.** On a phone there is no way to make a backup (Export), which is the only recovery from P3-DOLLYWOOD-01 and -02, or to restore one.

**Evidence.**
- Code: `apps/dollywood.html:313, 359, 371, 645-648` (the same lines in `../dollywood-build-project/scripts/template.html:359, 371`).
- Runs: `audits/evidence/p3/dollywood/layout-checks.json` (`phone.progressMenu {menuTop:625, menuH:158, sheetTop:766, visiblePx:17, buildOverflow:"hidden"}`), `audits/evidence/p3/dollywood/verify-progress-menu-clipped-phone-1.json`, `audits/evidence/p3/dollywood/verify-progress-menu-clipped-phone-2.json`.
- Screenshots: `audits/evidence/p3/dollywood/phone-progress-menu-clipped.png`, `audits/evidence/p3/dollywood/verify-progress-menu-clipped-phone-1-half.png`, `audits/evidence/p3/dollywood/verify-progress-menu-clipped-phone-1-ipad.png` (the iPad control), `audits/screens/dollywood/progress-menu-typical-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/layout-checks.mjs"` (the iPhone section).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-progress-menu-clipped-phone-1.mjs"` (WebKit, Eli, iPhone PWA in the shell; iPad portrait as control):
  - Peek: sheet top 766, menu top 625, 17 px visible. Visible px per item: Export 0, Import 0, Reset 8. Every item centre hit the map.
  - Half (sheet top 424) and full (sheet top 60, menu top −81): 17 px visible each time; the centres hit the chips, the toolbar or nothing.
  - Real taps at every item centre, in every state, fired no download, no file chooser and no dialog. A tap on the 8 px sliver of Reset (y=770) did raise "Clear all saved progress?".
  - iPad control: the menu opens downward (top 50 px), all 158 px visible, and every centre hits its own item.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-progress-menu-clipped-phone-2.mjs"` on iPhone PWA and iPhone Safari:
  - iPhone PWA peek (menu 625-783), half (283-441) and full (−81 to 77, partly above the viewport): 17 px visible in each; all three items outside the sheet; a tap at Reset's centre raised no confirm.
  - iPhone Safari peek (sheet top 574), half (332) and full (60): the same 17 px.

**Corrected claim.** Wider than filed. The clipping happens in every sheet state (peek, half and full), not only at peek, on both iPhone PWA and Safari. Export and Import cannot be reached at all. Reset keeps an 8 px sliver that does raise its confirm, so the destructive item is the only one that can be hit.

#### P3-DOLLYWOOD-04 — On phones the pressed 3D button never returns to 2D, and nothing on screen names the way back

- **Severity: medium** (skeptics: medium / medium; unchanged). A secondary flow is misleading: the control that looks like a toggle does not toggle, and nothing names a way back. It is not high, because the person is not truly locked in: the section chips and Next unfinished stay visible and leave 3D, and the shell's Hub button closes the app. Skeptic 1 noted it could arguably be low.
- **Exposure.** Phones only (under 700 px). At 820 px the iPad shows the 2D button.

**What happens now.** Below 700 px the 2D button is hidden (`apps/dollywood.html:333`, inside the block at `:313`), and the 3D button's handler always calls `setMode('3d')` (`apps/dollywood.html:1156`). The T key toggles (`apps/dollywood.html:856`), but a phone has no keyboard. Fit (`apps/dollywood.html:821`) and "Reset view" (`apps/dollywood.html:1283`, titled "Back to the home view (0)") keep the view in 3D. The ways out are a section chip (`apps/dollywood.html:1119`) and Next unfinished, the step list or the coaster legend (`go()` at `apps/dollywood.html:1087`, `:1149`). The investigator's run: after two more taps on 3D the mode was still `3d` with `aria-pressed` true, no visible exit buttons, and a Showstreet chip returned to 2D.

**Expected.** The 3D button toggles, or a 2D / Map control shows while in 3D.

**Why it matters to the household.** On a phone the 3D view is mostly sky (VIS-DOLLYWOOD-16). The person who opened it has to guess a way out, and the only control worded like one ("Reset view") just resets the camera.

**Evidence.**
- Code: `apps/dollywood.html:333, 587, 821, 856, 1087, 1119, 1152-1156, 1283` (template `../dollywood-build-project/scripts/template.html:333, 1150-1154`).
- Runs: `audits/evidence/p3/dollywood/repro-new.json` (`3d-exit`), `audits/evidence/p3/dollywood/verify-phone-3d-no-exit-1.json`, `audits/evidence/p3/dollywood/verify-phone-3d-no-exit-2.json`.
- Screenshots: `audits/evidence/p3/dollywood/phone-3d-after-second-tap.png`, `audits/evidence/p3/dollywood/verify-phone-3d-no-exit-2-phone.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/repro-new.mjs" 3d-exit` (iPhone PWA, real clicks on `#m-3d` three times, then a Showstreet chip). Observed: `afterSecondTap {mode:"3d", m2d:{display:"none"}}`, `visibleExitButtons []`, `afterSectionChip {mode:"2d"}`. Run with this argument, the script writes `repro-new-3d-exit.json` in the evidence folder; the cited `repro-new.json` is the full run with no arguments (`node "audits/tools/phase3/dollywood/repro-new.mjs"`: 3D exit, feed and Reset).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-phone-3d-no-exit-1.mjs"` (WebKit, iPhone PWA at 430 px, real clicks; iPad portrait as control):
  - Phone: in 3D `{mode:"3d", pressed:"true"}`; the second and third taps left it in 3D; Fit left it in 3D. The readout only lists orbit gestures. No visible control is labelled 2D or Map. The Entrance chip returned to 2D. "Show on map" was below the viewport at peek (top 1111 in 884).
  - iPad: `#m-2d` displayed, and it returned to 2D.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-phone-3d-no-exit-2.mjs"`:
  - Phone: 3D after the first, second and third taps. In view while in 3D: 4 chips and Fit; Next and Show on map not in view. Fit park and Next left the mode at `3d` (Next is inside the peeking sheet and could not be reached).
  - iPad: the 2D button is shown, so the gap is phone-only.

**Corrected claim.** Accurate in substance. "Show on map" and Previous / Next sit in the peeking sheet, off screen, so they are not the visible exits. The visible exits are the section chips (including Whole park), Next unfinished and the shell's Hub button.

#### P3-DOLLYWOOD-05 — On phones with Upright on, every map jump frames the unrotated box: Fit cuts off half the park and a section chip can miss its section

- **Severity: medium** (skeptics: medium / medium; **raised** from the investigator's low). Upright is opt-in, not remembered between opens, and the view can be panned back, so this is not high. But with it on, every fit on a phone lands in the wrong place (Fit, key 0, search and list results, a step's Show on map, the section chips, the coaster legend), and in one test 0 of 12 targets ended up in view. That is a broken secondary flow, not a cosmetic edge case.
- **Exposure.** Phones (under 700 px) with Layers → Upright on. The iPad and desktop use a different, correct path.

**What happens now.** `fitTarget` sends every phone fit to `fitBoxPhone` (`apps/dollywood.html:1088`), which builds the view from the unrotated box (`apps/dollywood.html:1143-1146`). `fitBox`, used on wider screens, first rotates the box corners by `ROT` (`apps/dollywood.html:809`). With `ROT` −98.71°, the phone's Fit produces exactly the north-up view. The investigator counted 34 of 68 markers off the right edge (rightmost marker at x=565, map right edge at 413).

**Expected.** The phone fit rotates the target box the way `fitBox` does.

**Why it matters to the household.** Turning Upright on on a phone shows parking lots and hills, and every jump (a section, a search result, a step) lands somewhere else.

**Evidence.**
- Code: `apps/dollywood.html:809, 821, 853, 1008, 1087, 1088, 1119, 1143-1146, 1149` (template `../dollywood-build-project/scripts/template.html:806, 1141`).
- Runs: `audits/evidence/p3/dollywood/layout-checks.json` (`phone.uprightFit`), `audits/evidence/p3/dollywood/verify-upright-fit-phone-1.json`, `audits/evidence/p3/dollywood/verify-upright-fit-phone-2.json`.
- Screenshots: `audits/evidence/p3/dollywood/phone-upright-fit.png`, `audits/evidence/p3/dollywood/verify-upright-fit-phone-2-iphone-pwa-chip.png` (the Timber Canyon chip shows parking lots), `audits/evidence/p3/dollywood/verify-upright-fit-phone-2-ipad-portrait-chip.png` (control), `audits/screens/dollywood/upright-typical-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/layout-checks.mjs"` (the phone Upright section).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-upright-fit-phone-1.mjs"` (WebKit, Eli, iPhone PWA and iPad portrait; a real tap on Fit):
  - Phone, Upright off, Fit: all 68 marker centres inside the map.
  - Phone, Upright on, Fit: `{ROT:-98.71, centreOffRight:37, centreInsideMap:31, rightmost:565, map.r:413}`.
  - iPad, Upright on, Fit: 68 of 68 inside.
  - `fitTarget` on 140 m boxes around 12 markers: phone Upright off 12 of 12 visible, phone Upright on **0 of 12**, iPad Upright on 12 of 12.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-upright-fit-phone-2.mjs"` in WebKit and Chromium (identical results):
  - Phone, Fit north-up: view `[208,770,1064,1533]`, 68 of 68 visible.
  - Phone, Upright then Fit: the same view `[208,770,1064,1533]`, so the rotation is ignored; 31 of 68 visible, 37 off the right.
  - iPad control: 68 of 68.
  - Phone, Upright then the Timber Canyon chip: the section's centre lands at (481, 55), outside the visible map; the screen shows parking lots. iPad: (410, 816), inside.
  - Upright is not saved: no localStorage key.

**Corrected claim.** Wider than filed: every `fitTarget` jump on a phone is affected, not only Fit, and a section chip can miss its section entirely. The counts differ because the investigator counted 34 by marker left edges and the skeptics 37 by centres; both show about half the park cut off. Severity medium, not low.

#### P3-DOLLYWOOD-06 — The "up to N″" rider-height filter hides every listing with no height requirement

- **Severity: medium** (skeptics: medium / medium; unchanged). A secondary flow (the Listings tab's rider-height filter) gives a misleading answer. No data is involved, and the core build-step flow is untouched. A separate "no requirement" option and the per-row height tags soften it, so it is not high.
- **Related.** The park map ships the same template line (template `../dollywood-build-project/scripts/template.html:1004`; `apps/dollywood-live.html:1007`). P3-DOLLYWOOD-LIVE-14 is now a pointer to this ID; one template fix covers both exports.

**What happens now.** `listItems` keeps `hf === 'none' ? !o.height_in : (o.height_in && o.height_in <= +hf)` (`apps/dollywood.html:1007`). So "up to 36″" shows 9 of 145, "up to 42″" 18 and "up to 48″" 23, although 120 listings have no requirement at all. The same file's park-map rule `fits()` treats no requirement as rideable (`apps/dollywood.html:1671`).

**Expected.** "Up to 36″" means everything a 36″ rider can do: no requirement, or a requirement at or below 36″.

**Why it matters to the household.** A parent planning for a small child sees 9 rides, and none of the 43 attractions with no requirement, such as the Village Carousel, the Amazing Flying Elephants and Lil' Pilots Playground.

**Evidence.**
- Code: `apps/dollywood.html:1007, 1671` (template `../dollywood-build-project/scripts/template.html:1004`).
- Runs: `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.heightFilter {counts:{36:"9",42:"18",48:"23",none:"120"}, listingsWithNoRequirement:120}`), `audits/evidence/p3/dollywood/verify-height-filter-drops-no-requirement-1.json`, `audits/evidence/p3/dollywood/verify-height-filter-drops-no-requirement-2.json`.
- Screenshots: `audits/screens/dollywood/listings-height-typical-ipad-portrait-light.png`, `audits/evidence/p3/dollywood/verify-height-filter-drops-no-requirement-2-upto36.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/layout-checks.mjs"` (the iPad section sets `#hf` to each value and reads "N of 145").

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-height-filter-drops-no-requirement-1.mjs"` (WebKit, iPad portrait, Eli; a real Listings tab tap and `selectOption` on `#hf`):
  - Data: 145 listings; 120 with no requirement (43 attractions, 33 shopping, 44 dining); 25 attractions with one.
  - Counts: up to 36″ 9, 39″ 13, 42″ 18, 48″ 23, 55″ 25; any 145; no requirement 120. Every "up to" value showed 0 rows without a requirement.
  - At 36″ it hides Village Carousel (81), The Amazing Flying Elephants (95), Lil' Pilots Playground (78), Imagination Playhouse (80), Country Fair Splash and Play (87) and the Dollywood Express Train Depot (79).
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-height-filter-drops-no-requirement-2.mjs"`: `countsViaSelect {any:145, none:120, 36:9, 39:13, 42:18, 48:23, 55:25}`. Even "up to 55″" shows only rides that have a requirement; Frogs & Fireflies (133) is hidden too.

**Corrected claim.** Accurate. The template line is `../dollywood-build-project/scripts/template.html:1004`, not 1005. Of the 120 listings with no requirement, 43 are attractions (a few are services such as ECV Rentals and Lost & Found); the other 77 are shops and dining.

#### P3-DOLLYWOOD-07 — The step card's in-game line ignores the saved plot width after load and after every plot change

- **Severity: medium** (skeptics: low / medium; **raised** from the investigator's low). The split was settled by the tie rule ("How to read this"): the corrected claim (stale after load, after an edit and after a synced change, with wrong metres on 46-48 steps) fits the medium clause, "a secondary flow broken or misleading", not the low clause's "edge case". The Scale tab exists to convert the card's numbers into game metres. After load, after typing a new width and after a synced change, the card shows 1:1 or the previous factor, and on 46-48 of the 135 steps with a measurement line (the two skeptics counted differently) the horizontal metres themselves are wrong, not only the label. That makes the scale conversion, a secondary flow, misleading. It is not high: no data is lost, and any Next, Prev, tick or step-list tap re-renders it correctly. Skeptic 1 rated it low because in their run only the first card was affected.
- **Exposure.** Devices signed in to the hub without a legacy `dw-plot` key (the input is pre-filled from that key at `apps/dollywood.html:1057`), whenever the open step has a measurement line.

**What happens now.** `adopt()` renders the step (`apps/dollywood.html:1109`) before it applies `plot` (`apps/dollywood.html:1110`), and `updScale()` sets the factor but never re-renders (`apps/dollywood.html:1049-1052`). `gameLine` then uses `scale.fac || 1` and the label "at 1:1 — set a plot width in the Scale tab to convert" (`apps/dollywood.html:1067-1074`). The investigator's run (overflow seed, plot 12,500): step `entrance-01` read "…at 1:1 — set a plot width in the Scale tab to convert" while the Scale input held 12500 and the factor was 13.63; after Next and Prev it read "…at 1363% scale".

**Expected.** The card re-renders whenever the plot width changes: after load, after an edit and after a synced change.

**Why it matters to the household.** Eli builds to the numbers on the card. Unscaled or stale game metres mean pieces built at the wrong size.

**Evidence.**
- Code: `apps/dollywood.html:1049-1052, 1057, 1067-1074, 1081, 1108-1110` (template `../dollywood-build-project/scripts/template.html:1108`).
- Runs: `audits/evidence/p3/dollywood/data-checks.json` (`P1.plotOnCard`), `audits/evidence/p3/dollywood/verify-plot-card-stale-1.json`, `audits/evidence/p3/dollywood/verify-plot-card-stale-2.json`.
- Screenshots: `audits/screens/dollywood/steps-full-overflow-iphone-pwa-light.png` (next to `audits/screens/dollywood/scale-overflow-iphone-pwa-light.png`), `audits/evidence/p3/dollywood/verify-plot-card-stale-1-overflow.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/data-checks.mjs" P1`. Observed: `afterLoad {step:"entrance-01", gameLine:"… at 1:1 — set a plot width in the Scale tab to convert", plotInput:"12500", scaleFac:13.63}`; `afterNextPrev {gameLine:"… at 1363% scale (Scale tab), relief kept true"}`. Run with this argument, the script writes `data-checks-P1.json` in the evidence folder; the cited `data-checks.json` is the full run with no arguments.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-plot-card-stale-1.mjs"` (WebKit, iPad portrait, Eli; typical, then `L.reset('overflow')`):
  - Overflow, after load: the 1:1 label on `entrance-01` with plot input 12500, factor 13.63 and no change events.
  - After 35 s (a periodic pull): identical, because no `onChange` fired.
  - After Next and Prev: "…at 1363% scale".
  - The typical seed opens on `entrance-08`, which has no measurement line, so it does not show the bug. 48 of the 135 measurement lines contain metre sizes that `gameLine` multiplies by the factor.
  - Rated it low.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-plot-card-stale-2.mjs"` (typical seed, plot 400, iPhone PWA):
  - A2, progress cleared so the card opens on `entrance-01`: the 1:1 label with factor 0.436; after Next and Prev, "…at 44% scale".
  - B: 46 of the 135 steps with a measurement line have horizontal numbers that depend on the factor (`dpx-01` reads "75 m across" at 1:1 and "33 m across" at 44%).
  - C, typing 800 in the Scale tab (factor 0.872): the card still read "33 m across (75 m real) at 44% scale".
  - D, a remote plot of 1600 through the batch API and the 30 s pull: the card still read "65 m across … at 87% scale".
  - Rated it medium.

**Corrected claim.** Wider than filed. Only `renderStep()` writes the in-game line, and neither `updScale()` nor the plot branch of `adopt()` calls it. So the card is stale after load, after a plot edit on this device and after a synced plot change, and on 46-48 of the 135 measured steps its metres are wrong, not only its label. The typical seed's realistic 400 m plot shows it as well as the overflow seed's 12,500 m.

#### P3-DOLLYWOOD-08 — Sitting idle in 2D, the step highlight's infinite pulse keeps the main thread busy (15.8-27.7% in Chromium)

- **Severity: low** (skeptics: low / low; unchanged). A performance and battery cost only, while the guide is left open on a step. It stops when the viewer closes and under reduced motion.

**What happens now.** The current step's target carries `#hl .hl-ring { animation: hlring 2.2s ease-in-out infinite }`, which animates `stroke-opacity` (`apps/dollywood.html:282-283`; the class is set at `:907-913`), on a 2,783-node SVG map. `stroke-opacity` is not a compositor-only property, so the map is repainted every frame. The investigator measured 15.8% main-thread busy and 60 style recalcs a second at iPad size (9.6% on desktop), and 0% with the pulse off. Reduced motion stops it through `apps/design.css:611-613`.

**Expected.** A pulse that stops after a few cycles, or an opacity or transform animation on its own layer.

**Why it matters to the household.** An iPad or PC left open on the guide keeps repainting the whole map sixty times a second: battery drain and heat for nothing.

**Evidence.** Code `apps/dollywood.html:282-283, 907-913` (template `../dollywood-build-project/scripts/template.html:282-283, 904-910`); `apps/design.css:611-613`. Runs `audits/evidence/p3/dollywood/perf-idle.json` (`ipad-portrait A_asShipped {busyPct:15.8, stylePerSec:60.1}`, `B_pulseOff {busyPct:0}`), `audits/evidence/p3/dollywood/verify-idle-pulse-cpu-1.json`, `audits/evidence/p3/dollywood/verify-idle-pulse-cpu-2.json`.

**Reproduction.** `node "audits/tools/phase3/dollywood/perf-idle.mjs"` (Chromium, CDP task duration over 10 s idle).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-idle-pulse-cpu-1.mjs"` (Chromium, iPad portrait, 8 s idle windows): standalone as shipped 18.7% busy, 60 style recalcs a second, one pulsing element; pulse off 0%; reduced motion 0% (no running animation); inside the shell 22%; inside the shell with the pulse off 0%; a control page with one pulsing circle 2.2%.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-idle-pulse-cpu-2.mjs"` (Chromium in the shell, then WebKit): shell Home alone 0%; as shipped 27.7% (17.6% on an earlier run), of which style recalc only 0.5%; pulse off 0.8%; after closing the viewer 0%; reduced motion 0%. In WebKit the same infinite animation runs (its `currentTime` advanced 3,011 ms).

**Corrected claim.** The cost is higher than filed: 17.6-27.7% inside the shell. The time goes on repainting the large map SVG, not on the animation or style recalc (the one-circle control costs 2.2%). The figures come from headless Chromium on a Windows desktop; the cost on a real iPad was not measured.

#### P3-DOLLYWOOD-09 — After 3D has been opened once, the render loop keeps requesting 60 frames a second in 2D until the guide is closed

- **Severity: low** (skeptics: low / low; unchanged). No data, flow or visual effect. In 2D the loop costs about 1 ms of script per second and draws nothing, and it lasts only while the guide stays open.

**What happens now.** The 3D render loop reschedules `requestAnimationFrame` on every frame and renders only in 3D: `(function loop(){ if (mode==='3d') {…render…} requestAnimationFrame(loop) })()` (`apps/dollywood.html:1269`). Nothing cancels it; `setMode('2d')` does not stop it (`apps/dollywood.html:1152-1156`). The investigator measured 0 frames a second in 2D before 3D was opened and 60 after.

**Expected.** The loop runs only while in 3D.

**Why it matters to the household.** A small, needless wake-up of the page sixty times a second while the guide sits open in 2D.

**Evidence.** Code `apps/dollywood.html:1152-1156, 1269` (template `../dollywood-build-project/scripts/template.html:1150-1154, 1267`); `index.html:729-733` (closing the viewer sets the frame to `about:blank`). Runs `audits/evidence/p3/dollywood/perf-3d.json` (`raf2dBefore 0`, `raf2dAfter3d 60`), `audits/evidence/p3/dollywood/verify-raf-loop-after-3d-1-chromium.json`, `audits/evidence/p3/dollywood/verify-raf-loop-after-3d-1-webkit.json`, `audits/evidence/p3/dollywood/verify-raf-loop-after-3d-2.json`.

**Reproduction.** `node "audits/tools/phase3/dollywood/perf-3d.mjs" ipad-portrait` (Chromium). With a device argument the script rewrites `perf-3d.json` with that device only; the cited file is the no-argument run, which covers iPad portrait and desktop (the desktop build times in "App-specific checks" come from it).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-raf-loop-after-3d-1.mjs"` with `chromium` and `webkit` (the Kitchen iPad, the guide opened in the shell viewer): Chromium 0 frames a second in 2D before 3D; 60 in 3D (144.87 ms of callback time a second); 60 in 2D just after 3D (0.8 ms a second) and still 60 ten seconds later; after going to `#home`, no guide frame left. Headless WebKit throttles rAF (0, 15, 3 and 3 a second) but shows the same pattern.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-raf-loop-after-3d-2.mjs"` (Chromium, counting only the `loop` callback): standalone 2D before 3D 0; 3D with no input 60 a second, 209.8 ms of script a second and 55,145 draw calls a second; 2D after 3D 60 a second, 1.57 ms a second, 0 draw calls; in the shell 60 a second, 0.87 ms; after going back to the hub the frame is `about:blank` and the loop is gone.

**Corrected claim.** Not "forever": the loop stops when the shell closes the viewer (`index.html:732`) and pauses in a hidden page. Skeptic 2 noted a larger cost of the same loop that was not filed separately: in 3D it re-renders the whole scene every frame even when nothing moves (about 919 draw calls a frame under software GL).

#### P3-DOLLYWOOD-10 — A dead "N" compass button sits over the iPad and desktop map, and over 3D

- **Severity: low** (skeptics: low / low; unchanged). A visible control that does nothing. The same rotation works from Layers → Upright, so no feature is lost.

**What happens now.** `.lv-northwrap` is hidden only below 700 px (`apps/dollywood.html:352`, inside the block at `:313`). The rule that hides the park map's other chrome outside the live flavour (`apps/dollywood.html:565`) leaves it out. Its only click handler is inside `liveInit` (`apps/dollywood.html:1597`, in the function that starts at `:1555`), which runs only when `FLAVOR === 'live'` (`apps/dollywood.html:1740`); here `FLAVOR` is `'hub'` (`apps/dollywood.html:688`). The investigator found the button shown at 44×44; after a tap `ROT` stayed 0 and `aria-pressed` stayed false.

**Expected.** Hidden outside the park map, or wired to the Upright toggle.

**Why it matters to the household.** A compass that does nothing over the map and over 3D teaches that the controls cannot be trusted.

**Evidence.** Code `apps/dollywood.html:313, 352, 565, 620, 688, 1555, 1597, 1740` (template `../dollywood-build-project/scripts/template.html:313, 352, 565, 620, 686, 1553, 1595, 1738`). Runs `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.northButton`), `audits/evidence/p3/dollywood/verify-dead-north-button-1.json`, `audits/evidence/p3/dollywood/verify-dead-north-button-2.json`. Screenshots `audits/evidence/p3/dollywood/verify-dead-north-button-1-ipad-3d.png` (the N over the 3D terrain), `audits/screens/dollywood/view-3d-typical-ipad-portrait-light.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/layout-checks.mjs"` (the iPad north-button section).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-dead-north-button-1.mjs"` (WebKit): iPad portrait, button displayed, 44×44 at (31, 573) with the map scrolled into view, hit test on the button, `onclick` null; before and after a real tap `ROT` 0 and `aria-pressed` false. The control, `#l-upright`, gives `ROT` −98.71. In 3D it stays displayed and tappable. Desktop: displayed at (51, 783), a tap does nothing. iPhone PWA: hidden. The 9 px label's computed colours are rgb(188,90,56) on rgb(255,252,248), about 4.4:1.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-dead-north-button-2.mjs"` (WebKit and Chromium): iPad box `[31,1020,44,44]`, `onclick` null; taps in 2D and in 3D change nothing. Desktop box at y≈1175, below the 900 px viewport until the page scrolls. iPhone PWA hidden.

**Corrected claim.** Accurate. The on-screen position depends on the scroll. For the 9 px "N" label, the computed-colour ratio is about 4.4:1 (skeptic 1) against the investigator's pixel-sampled 3.06:1; both are under 4.5:1.

#### P3-DOLLYWOOD-11 — Turning Upright on or off with "Whole park" pressed zooms to the last-selected section

- **Severity: low** (skeptics: low / low; unchanged). A mis-zoom from a secondary map toggle; Fit or any chip corrects it at once.
- **Related.** Same code as P3-DOLLYWOOD-LIVE-09. The Upright change handler fits `SEC[curSec]` (`apps/dollywood.html:1029` = `apps/dollywood-live.html:1029`), and `selectSection('all')` never sets `curSec` (`apps/dollywood.html:1121` = `apps/dollywood-live.html:1121`). In the park map every compass tap goes through it, so it is filed there at medium. One template fix covers both.

**What happens now.** `curSec` starts as `'entrance'` (`apps/dollywood.html:1062`) and `selectSection('all')` never sets it (`apps/dollywood.html:1121`). The Upright handler fits `SEC[curSec]` unless `curSec === 'all'` (`apps/dollywood.html:1029`), so that guard never fires from the Whole park chip. The investigator measured the view width at 0.26 of the whole-park width after turning Upright on.

**Expected.** With Whole park pressed, Upright fits the whole park.

**Why it matters to the household.** Upright is the way to see the park the way the game shows it; turning it on zooms somewhere unexpected.

**Evidence.** Code `apps/dollywood.html:1029, 1062, 1121, 1132` (template `../dollywood-build-project/scripts/template.html:1026, 1119`). Runs `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.uprightWholePark`), `audits/evidence/p3/dollywood/verify-upright-whole-park-zooms-entrance-1.json`, `audits/evidence/p3/dollywood/verify-upright-whole-park-zooms-entrance-2.json`. Screenshots `audits/evidence/p3/dollywood/ipad-upright-whole-park.png`, `audits/evidence/p3/dollywood/verify-upright-whole-park-zooms-entrance-1-A-first-open-upright-on.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/layout-checks.mjs"` (the iPad Upright section).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-upright-whole-park-zooms-entrance-1.mjs"` (WebKit, iPad portrait, real taps): first open, Whole park pressed and `curSec` `'entrance'`, view 1.214 of the whole-park width; Upright on 0.26; Whole park tapped again while upright 1.273; Upright off 0.218. After Showstreet then Whole park, Upright on gave 0.31 and fitted Showstreet's box.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-upright-whole-park-zooms-entrance-2.mjs"` (WebKit, iPad portrait and desktop): fresh 1.21 → Upright on 0.26 → off 0.22; Showstreet → Whole park → Upright on 0.31; Fit 1.27. Desktop identical.

**Corrected claim.** It fits the last-selected section, not always Entrance & Plaza: Entrance on first open, otherwise the last chip picked. Turning Upright off mis-zooms the same way. On iPad portrait the Upright switch sits in the Layers tab below the map, so the wrong zoom is only seen after scrolling back up.

#### P3-DOLLYWOOD-12 — On phones the "?" popover opens off the left edge (48 of 267 px visible)

- **Severity: low** (skeptics: low / low; unchanged). Cosmetic; the popover lists only keyboard shortcuts, which a phone user cannot use anyway.

**What happens now.** Below 700 px the hint text fills the first line, so the "?" wraps to the start of the next line at x=16. The phone rule `right: 0` (`apps/dollywood.html:358`) then makes the 267 px, no-wrap popover grow leftwards from x=48, so it starts at x=−219 (`apps/dollywood.html:174-176, 640-641`).

**Expected.** The popover opens inside the screen, or is not offered on touch devices.

**Why it matters to the household.** A visible control opens a panel that cannot be read.

**Evidence.** Code `apps/dollywood.html:174-176, 358, 640-641` (template `../dollywood-build-project/scripts/template.html:174-176, 358, 640-641`, the same lines). Runs `audits/evidence/p3/dollywood/layout-checks.json` (`phone.helpPopover {x:-219, w:267, r:48}`), `audits/evidence/p3/dollywood/verify-help-popover-offscreen-phone-1.json`, `audits/evidence/p3/dollywood/verify-help-popover-offscreen-phone-2.json`. Screenshots `audits/evidence/p3/dollywood/phone-help-popover.png`, `audits/evidence/p3/dollywood/verify-help-popover-offscreen-phone-2-iphone-pwa-chromium.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/layout-checks.mjs"` (the phone help section).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-help-popover-offscreen-phone-1.mjs"` (WebKit, a real tap on "?"): iPhone PWA and iPhone Safari both `{x:-219, w:267, right:48}`, 48 px visible; the iPad portrait control at x=404, fully visible.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-help-popover-offscreen-phone-2.mjs"` (WebKit and Chromium): computed `left` −235.48 px, popover x=−219 to 48; it cannot be scrolled into view (`scrollLeft` stays 0); the first line reads "Keyboard shortcuts" on a coarse, no-hover pointer. Chromium gives the same numbers, so it is not a WebKit artefact.

**Corrected claim.** None; reproduced exactly as filed.

#### P3-DOLLYWOOD-13 — On iPad portrait the View ▾ menu runs 26 px past the right edge

- **Severity: low** (skeptics: low / low; unchanged). Cosmetic on one layout; both controls still work.

**What happens now.** `.vmenu` is `left: 0` with `min-width: 250px` (`apps/dollywood.html:164`), anchored to a View button whose left edge is at x=596, so its right edge lands at 846 in an 820 px viewport. The menu holds the contour-interval select and the Steepness switch (the theme row is removed, `apps/dollywood.html:1034`). Wider screens and phones (`apps/dollywood.html:343`) are fine.

**Expected.** The menu opens inside the screen (anchored right, or clamped).

**Why it matters to the household.** The contour select and the steepness checkbox are cut at the edge, and the page gains a sideways scroll while the menu is open.

**Evidence.** Code `apps/dollywood.html:164, 343, 1034` (template `../dollywood-build-project/scripts/template.html:164, 343`, the same lines; export line 1034 replaces the template's theme toggle at `:1031-1032`). Runs `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.viewMenu {r:846, vw:820}`), `audits/evidence/p3/dollywood/verify-view-menu-offscreen-ipad-1.json`, `audits/evidence/p3/dollywood/verify-view-menu-offscreen-ipad-2.json`. Screenshots `audits/evidence/p3/dollywood/ipad-view-menu.png`, `audits/evidence/p3/dollywood/verify-view-menu-offscreen-ipad-2-webkit.png`, `audits/screens/dollywood/view-menu-typical-ipad-portrait-light.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/layout-checks.mjs"` (the iPad View-menu section).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-view-menu-offscreen-ipad-1.mjs"` (a real tap after scrolling View into view): menu x=596 to 846 in 820; `#cint` 13 px off-screen; `#v-slope` 5 of 18 px visible; the document scroll width 846 against 820 while the menu is open; Chromium identical; iPad landscape and desktop fine; a tap on the visible sliver still toggles the switch.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-view-menu-offscreen-ipad-2.mjs"` (WebKit and Chromium): overflow 26 px; the select shows 70 of 83 px (its chevron cut); the checkbox shows 5 of 18 px with its centre off-screen; a tap on the label text still toggles it and its Layers twin.

**Corrected claim.** Accurate, with one new facet: while the menu is open the page scrolls sideways by 26 px, which CLAUDE.md's touch rules forbid ("no horizontal scroll", `CLAUDE.md:63`). The controls are clipped, not lost.

#### P3-DOLLYWOOD-14 — After 3D, touch devices get the mouse hint "Move over the map… scroll to zoom"

- **Severity: low** (skeptics: low / low; unchanged). Only the hint text is wrong; touch still works.

**What happens now.** `setMode` writes the mouse text for 2D with no coarse-pointer check (`apps/dollywood.html:1154`). At boot (`apps/dollywood.html:607`) and in `setTool` (`apps/dollywood.html:824`) the app picks the touch text, "Tap anything for details · pinch to zoom", on coarse pointers. A tap gives no hover, so the elevation readout never replaces the wrong hint.

**Expected.** Touch devices keep the touch hint after leaving 3D.

**Why it matters to the household.** The one line of help on the map tells an iPad user to hover and scroll.

**Evidence.** Code `apps/dollywood.html:607, 824, 1154` (template `../dollywood-build-project/scripts/template.html:607, 821, 1152`). Runs `audits/evidence/p3/dollywood/layout-checks.json` (`phone.after2d {readout:"Move over the map for elevation · scroll to zoom · drag to pan", coarse:true}`), `audits/evidence/p3/dollywood/verify-readout-mouse-copy-touch-1.json`, `audits/evidence/p3/dollywood/verify-readout-mouse-copy-touch-2.json`. Screenshot `audits/evidence/p3/dollywood/verify-readout-mouse-copy-touch-1-iphone-pwa.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/layout-checks.mjs"` (the phone 3D section).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-readout-mouse-copy-touch-1.mjs"` (WebKit, real taps only): iPhone PWA boot "Tap anything for details · pinch to zoom"; 3D; a tap on the Tennessee Tornado legend chip returned to 2D with the mouse text and `coarse: true`; a map tap left it. The iPad showed the same sequence.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-readout-mouse-copy-touch-2.mjs"`: iPad 3D then 2D gave the mouse text with `coarse: true`; desktop is correct. New facet: with Cross-section on, 3D then 2D replaced "Tap two points, or drag, to cut a cross-section" with the pan text while the tool stayed on section (on every device; the map pill still says "Tap two points"). On the phone the rig's emulated click wrote an elevation over the hint, a rig artefact.

**Corrected claim.** It affects the iPad as well as the phone, through every path out of 3D (a chip, a search result, a card's Zoom, a step's Show on map, the coaster legend). With Cross-section or Measure on, leaving 3D also replaces the tool's instruction with the generic pan text, on every device.

#### P3-DOLLYWOOD-15 — The Scale tab refers to an "Info tab" that does not exist (also found by the visual check)

- **Severity: low** (all four skeptics: low; unchanged). Stale copy: the conversion works and the converted values do appear.

**What happens now.** The Scale tab says every dimension "shown in the Info tab will also be shown in game metres" (`apps/dollywood.html:672`). The tabs are Listings, Layers and Scale (`apps/dollywood.html:660`; `showTab` toggles only those three, `apps/dollywood.html:958`). The converted metres actually appear in the listing, building and coaster cards (`apps/dollywood.html:973-974, 993`), the measure label (`apps/dollywood.html:875`), the profile length (`apps/dollywood.html:951`) and the step card's "In game" line (`apps/dollywood.html:1067-1081`).

**Expected.** The copy names where the numbers appear, for example "on the step card and the listing cards".

**Why it matters to the household.** A reader looks for a tab that is not there and cannot tell where the converted numbers show.

**Evidence.** Code `apps/dollywood.html:660, 672, 958` (template `../dollywood-build-project/scripts/template.html:672`, identical). Runs `audits/evidence/p3/dollywood/verify-scale-copy-info-tab-1.json`, `audits/evidence/p3/dollywood/verify-scale-copy-info-tab-2.json`, `audits/evidence/p3/dollywood/verify-vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1-1.json`, `audits/evidence/p3/dollywood/verify-vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1-2.json`. Screenshots `audits/screens/dollywood/scale-empty-ipad-portrait-light.png`, `audits/evidence/p3/dollywood/verify-scale-copy-info-tab-2-scale-tab.png`.

**Reproduction.** `grep -n "Info tab" apps/dollywood.html | cut -c1-200`.

**Verified: 4/4 skeptics confirmed** (two on the investigator's finding, two on the visual checker's).
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-scale-copy-info-tab-1.mjs"` (WebKit, iPad portrait): tabs `["Listings","Layers","Scale"]`; the park map's tabs `["Nearby","Family","Search","Style"]`; no element labelled Info.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-scale-copy-info-tab-2.mjs"`: the same three tabs; with a 400 m plot, DP's Celebrity Theater's card shows "Footprint 77 × 76 m (34 in game)".
- **Visual-check skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1-1.mjs"` (iPad portrait and iPhone PWA): no control or id containing "info"; the Scale factor reads "44% of real size (0.436×)".
- **Visual-check skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1-2.mjs"`: the card shows "(34 in game)" outside any tab; the template has the same text and no Info tab in any flavour.

**Corrected claim.** No flavour has an Info tab (the template has the same single tab list), so this is not an export omission. The fix goes in `../dollywood-build-project/scripts/template.html:672`.

#### P3-DOLLYWOOD-16 — The keyboard shortcuts ignore Ctrl, Cmd and Alt: Ctrl/Cmd+D (bookmark) ticks or silently unticks the current step, and Ctrl/Cmd+P and page zoom are taken over

- **Severity: medium** (skeptics: medium / medium; the completeness critic filed medium). A browser shortcut writes the person's synced progress: it ticks a step that was not built, with a feed line saying it was, or silently unticks one that was. "Next unfinished" then skips or revisits the wrong step. That is a secondary path giving a misleading result. It is not critical under (a), because one step changes, the count shows it and a tap flips it back, and the daily tap-to-tick flow is untouched.
- **Exposure.** Desktop, or an iPad with a hardware keyboard. Focus must be in the guide but not in an input, select or textarea, and the view in 2D (in 3D `three.key()` takes some keys first, `apps/dollywood.html:852`). Both rig engines deliver Ctrl/Cmd+D to the page, and the progress write happens before any browser action. Whether Safari on macOS or iPadOS delivers Cmd+D to the page before opening its own bookmark sheet was not checked on a device.
- **Related.** No P2 ID covers keyboard shortcuts. The park map export carries the same handler (`apps/dollywood-live.html:852`); the park map report lists it as a pointer to this ID.

**What happens now.** The document keydown handler returns early only for inputs and for keys the 3D view handles (`apps/dollywood.html:852`). It then maps bare `e.key` values (`+` / `=`, `-`, `0`, the arrows, `v`, `s`, `m`, `t`, `n`, `p`, `d`, Escape) to actions, and calls `preventDefault()` for each (`apps/dollywood.html:853-857`). It never tests `ctrlKey`, `metaKey` or `altKey`. So:
- Ctrl+D, Cmd+D and Alt+D run `stepDone()`, which toggles the current step in the synced `progress` row, posts "Ticked <title>" when the step becomes done, and moves the card on (`apps/dollywood.html:1086`). On a step that is already done it unticks it, with no feed line. Ctrl/Cmd+D is the bookmark shortcut; Alt+D is the Windows Chrome and Edge address-bar shortcut.
- Ctrl/Cmd+P (print) runs `stepNav(-1)` (`apps/dollywood.html:1085`).
- Ctrl/Cmd+=, − and 0 (page zoom) zoom or fit the map instead. By code, Ctrl/Cmd+S switches to the cross-section tool and Ctrl/Cmd+arrows pan the map.
- The critic's run (desktop, WebKit): Ctrl+D took the server from 24 to 25 ticks and the card from "7 of 9 done" to "8 of 9 done". Cmd+D took it to 26 and "9 of 9 done". Ctrl+P went back a step, and Ctrl+= zoomed the map (view width 157 → 112). Every one of these keydowns was `defaultPrevented`, and two feed lines appeared: "Ticked Blueprint the section" and "Ticked Planting, banners and signage".

**Expected.** The single-key shortcuts fire only when no Ctrl, Cmd or Alt is held, for example `if (e.ctrlKey || e.metaKey || e.altKey) return;` at the top of the handler (template `../dollywood-build-project/scripts/template.html:849`). The browser's bookmark, print and page-zoom shortcuts keep working.

**Why it matters to the household.** Eli builds at the PC beside the game. Pressing Ctrl+D to bookmark the guide, or Ctrl+P to print a step, marks a step done that he has not built and tells the family feed he built it, or quietly unticks one he has built. Page zoom, which a grandparent at the PC relies on, is blocked while the guide has focus.

**Evidence.**
- Code: `apps/dollywood.html:640-641` (the "?" popover documents D = mark the step done), `:852-857`, `:1085-1086` (template `../dollywood-build-project/scripts/template.html:640-641, 849-854, 1083-1084`); `apps/dollywood-live.html:852`.
- Runs: `audits/evidence/p3/dollywood/critic-keys-plot-keys.json`, `audits/evidence/p3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-1-webkit.json`, `audits/evidence/p3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-1-chromium.json`, `audits/evidence/p3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-2.json`.
- Screenshots: `audits/evidence/p3/dollywood/critic-ctrl-d-desktop.png` (after the shortcuts: the Entrance & Plaza chip reads 9/9, and the map is zoomed in on the plaza), `audits/evidence/p3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-1-webkit.png`, `audits/evidence/p3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-2-webkit-desktop.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/critic-keys-plot.mjs" keys` (typical seed, WebKit, desktop 1440×900, Eli, the guide in the shell viewer). It clicks the h1, presses Control+d, Meta+d, Control+p and Control+Equal, and after each reads the step, `#b-count`, the view, the server progress row and any new feed lines. It writes `critic-keys-plot-keys.json`. Observed: `before {count:"7 of 9 done", server.trueTicks:24}`; `afterCtrlD {count:"8 of 9 done", trueTicks:25}`; `afterMetaD {count:"9 of 9 done", trueTicks:26}`; `afterCtrlP {step:7}` (from 8); `afterCtrlEqual {view:[459,1250,112,105]}` (from `[437,1229,157,147]`); `prevented:true` on every modified key.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-1.mjs" webkit`, and again with `chromium` (a fresh instance each, typical seed, desktop, Eli). The results were identical on both engines:
  - Control+d: step 7 → 8, "8 of 9 done", ticks 24 → 25.
  - Meta+d: "9 of 9 done", 26.
  - Control+p: step 8 → 7. Control+Equal: view width 157 → 112.
  - Alt+d: "9 of 9" → "8 of 9", ticks 26 → 25, a silent untick with no feed line.
  - Every one of these keydowns was `defaultPrevented`. Rated medium.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-critic-critic-modifier-shortcuts-write-progress-1-2.mjs"` on both engines, with an unbound key as the control:
  - x changed nothing and was not prevented.
  - Control+d: 24 → 25. Meta+d: 26. Control+p: back a step.
  - Control+d again, now on a done step: "8 of 9 done", server 26 → 25, no feed line.
  - Control+Minus zoomed the map out, Control+0 fitted the park, and Alt+d ticked a step (26).
  - Rated medium.

**Corrected claim.** Slightly understated as filed. Ctrl/Cmd+D toggles, so on a done step it silently unticks it (26 → 25 observed, no feed line). Alt+D, Ctrl/Cmd+− and Ctrl/Cmd+0 are taken over too, and by code Ctrl/Cmd+S and Ctrl/Cmd+arrows. The park map export has the same handler.

#### P3-DOLLYWOOD-17 — The arrow keys never scroll the page: they pan a map that is scrolled away, even while the person reads the step card

- **Severity: low** (skeptics: low / low; the completeness critic filed low). Only keyboard scrolling of the page on desktop, or with a hardware keyboard, is affected. Space, PageUp / PageDown, the scrollbar and touch still scroll. No data is involved and no core flow is blocked.
- **Exposure.** Desktop, or an iPad with a hardware keyboard, with focus in the guide outside an input: on plain text, or on a button in the card such as `#b-prev`.
- **Related.** UX-DOLLYWOOD-1 and -2 (on desktop the step card sits below the map). No P2 ID covers this app's key handler.

**What happens now.** The global handler binds ArrowLeft, ArrowRight, ArrowUp and ArrowDown to panning the map (`apps/dollywood.html:854`) and calls `preventDefault()` (`apps/dollywood.html:857`) wherever focus is, except in an input, select or textarea (`apps/dollywood.html:852`). The "?" popover documents "arrows pan" (`apps/dollywood.html:641`), so the binding itself is intended, but nothing limits it to when the map has focus or is on screen. On desktop the build card sits below the map, so a person reading it has the map scrolled above the viewport. The critic's run: the page at `scrollY` 1283, only the map's last 56 px at the top of the screen, the card top at 226. Five ArrowDown presses left `scrollY` at 1283 and moved the view's y from 935 to 1695; five ArrowUp moved it back to 935. PageUp scrolled to 601.

**Expected.** The arrows pan the map only when the map has focus or is mostly on screen; otherwise the page scrolls as usual.

**Why it matters to the household.** On the PC Eli reads the step card below the map. The standard keyboard way down the page does nothing he can see, and it pans a map he cannot see, which he finds moved when he scrolls back up.

**Evidence.**
- Code: `apps/dollywood.html:641, 852, 854, 857` (template `../dollywood-build-project/scripts/template.html:641, 849, 851, 854`).
- Runs: `audits/evidence/p3/dollywood/critic-arrows.json`, `audits/evidence/p3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-1.json`, `audits/evidence/p3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-2-webkit.json`, `audits/evidence/p3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-2-chromium.json`.
- Screenshots: `audits/evidence/p3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-1-webkit-after-arrowdown.png` (after five ArrowDown presses the page has not moved: the card is on screen and only the map's bottom edge shows at the top), `audits/evidence/p3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-1-chromium-after-arrowdown.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood/critic-arrows.mjs"` (typical seed, WebKit, desktop 1440×900, Eli, the guide in the shell viewer). It scrolls `#b-now` to the middle, clicks the step title (plain text, not an input), presses ArrowDown five times and ArrowUp five times, and reads the frame's `scrollY` and the map's view. It writes `critic-arrows.json`. Observed: `before {scrollY:1283, view[1]:935, mapBottom:56, cardTop:226}`; `afterDown {scrollY:1283, view[1]:1695}`; `afterUp {scrollY:1283, view[1]:935}`; the PageUp control scrolled to 601.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-1.mjs"` on WebKit and Chromium (a fresh instance each, typical seed, desktop, Eli):
  - Focus on the body: `scrollY` 1308 → 1308, view y 870 → 1767, all five ArrowDown keydowns prevented. Space scrolled to 1596.
  - Focus on the card's `#b-prev` button: `scrollY` 1296 → 1296, view y 1767 → 2306.
  - Causal control: with a capture listener stopping the arrows before the app's handler, ArrowDown scrolled the page 400 → 600.
  - Chromium gave the same results. Rated low.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-2.mjs" webkit`, then with `chromium`:
  - WebKit: `scrollY` stayed at 1283 while view y went 935 → 1695, and all 10 ArrowDown keydowns logged `prevented:true` on the body. The PageDown control was not prevented and scrolled 1283 → 1596.
  - Chromium: `scrollY` stayed at 1279 while view y went 935 → 1695; PageDown scrolled 1279 → 1592.
  - Rated low.

**Corrected claim.** Widened by skeptic 1: a focused button in the card, such as `#b-prev`, loses its arrow keys too, not only plain text. The control with the handler bypassed shows the app's handler is the cause, not the rig. A side observation, not filed: on desktop the mouse wheel over the map zooms the map and does not scroll the page.

#### P3-DOLLYWOOD-18 — Clearing the plot width does not reach another open device, and a legacy `dw-plot` key brings an old width back on every boot

- **Severity: low** (skeptics: low / low; the completeness critic filed low). No data is lost or overwritten: the server row stays null, and neither stale device writes it back unless the person edits the field. The effect is a wrong width and factor on a secondary tab, which the step card and listing cards then use, in two edge cases.
- **Exposure.**
  1. A person clears the plot width while the guide is open on another of their devices. That device keeps the old width until it reopens the guide.
  2. A device still holds the pre-hub `dw-plot` key, which only devices that used the guide before the hub migration do. Whenever the person's hub plot is empty, every boot on that device shows and computes with the legacy width.
- **Related.** P3-DOLLYWOOD-07 (the card is not re-rendered when the plot changes) and P3-DOLLYWOOD-01, corrected claim item 5 (the same `dw-plot` key migrating over a synced plot). Different mechanisms, so not duplicates. P2-SYNC-03: see Corrected claim.

**What happens now.**
- Clearing `#sc-plot` runs `savePlot`, which writes `hub.set('plot', v || null)` (`apps/dollywood.html:1055`), so the server row becomes null.
- `adopt()` applies a remote plot only when `v != null` (`apps/dollywood.html:1110`). Another open device therefore keeps its old width and factor after its pull, and neither the 30 s pull nor `onChange` clears it.
- Separately, the boot code pre-fills the input from the legacy `dw-plot` key before `hub.ready`, even when signed in (`apps/dollywood.html:1057`). `adopt()` never overrides that while the hub plot is null.
- The key survives because `hub.migrate` leaves originals in place (`apps/hub.js:392`) and a signed-in `savePlot` never writes it.
- The critic's run: before, the server held "400" and both devices showed 400. After clearing on the iPad, the server held null, and the iPad showed an empty field and no factor. After a pull, the phone still showed 400 and "44% of real size (0.436×)" while `hub.get('plot')` was null. A third device with `dw-plot = '1000'` showed 1000 and "109% of real size (1.091×)" while the server held null.

**Expected.** A cleared plot clears the input and factor on every device: `adopt()` applies null like any other value. Once signed in, the legacy `dw-plot` key does not pre-fill the input, or it is removed after migration.

**Why it matters to the household.** The step card and the listing cards convert every measurement by this factor. When two devices disagree about the plot width, Eli builds to different in-game sizes depending on which device he reads.

**Evidence.**
- Code: `apps/dollywood.html:1055, 1057, 1107, 1110` (template `../dollywood-build-project/scripts/template.html:1053, 1055, 1105, 1108`); `apps/hub.js:224, 244, 392`.
- Runs: `audits/evidence/p3/dollywood/critic-keys-plot-plot.json`, `audits/evidence/p3/dollywood/verify-critic-critic-plot-clear-not-synced-2-1.json`, `audits/evidence/p3/dollywood/verify-critic-critic-plot-clear-not-synced-2-2.json`.
- Screenshots: `audits/evidence/p3/dollywood/verify-critic-critic-plot-clear-not-synced-2-2-phone-after-pull.png` (the phone still converting at 44% after the clear), `audits/evidence/p3/dollywood/verify-critic-critic-plot-clear-not-synced-2-2-legacy-after-reload.png` (the legacy device at 109%).

**Reproduction.** `node "audits/tools/phase3/dollywood/critic-keys-plot.mjs" plot` (typical seed, WebKit, Eli's plot 400). The guide is open on the rig iPad and on a second paired Eli phone (`L.newDevice`). On the iPad the script opens the Scale tab, triple-clicks `#sc-plot`, presses Backspace and Tab, and waits 3 s. It then runs `hub.pull()` on the phone and reads `#sc-plot`, `scale.fac` and `hub.get('plot')`. Finally it opens a third iPad context with `dw-plot='1000'` and a `hub.migrated` mark for `dollywood.person`. It writes `critic-keys-plot-plot.json`. Observed: `afterClearIpad {server:null, ipad.plotInput:"", fac:null}`; `phoneAfterPull {plotInput:"400", facText:"44% of real size (0.436×)", hubPlot:null}`; `legacyDevice {plotInput:"1000", facText:"109% of real size (1.091×)", hubPlot:null, server:null}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood/verify-critic-critic-plot-clear-not-synced-2-1.mjs"` (WebKit). iPad A was seeded with `dw-plot='1000'` and no hand-set mark, so the migration ran on its own; phone B was a second paired Eli device.
  - Before: server "400"; A showed 400, because `adopt` overrode the legacy 1000; B showed 400.
  - After clearing on A: server null; A showed an empty field and no factor, but `dw-plot` was still "1000" in its localStorage.
  - B after a pull: 400 and "44% of real size (0.436×)", with the hub plot null.
  - A after a reload: 1000 and "109% of real size (1.091×)", with the hub plot and the server null.
  - B after a reload (the control, no legacy key): an empty field.
  - Rated low.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood/verify-critic-critic-plot-clear-not-synced-2-2.mjs"` (WebKit; the iPad, a second phone, and a third iPad-landscape context seeded only with `dw-plot='1000'`).
  - Before: all three showed 400. The legacy device's migration marked itself done and moved nothing, because the hub already had 400.
  - After the clear: server null.
  - Phone after a pull: 400 and 44%, hub plot null. After a reload: an empty field, so a reload fixes a device without the key.
  - Legacy device after a pull: 400. After a reload: 1000 and 109%.
  - Server at the end: null, so neither stale device writes back.
  - Rated low.

**Corrected claim.** Accurate, with two scope notes. The first facet lasts only until that device reopens the guide. The second arises without any hand-set migration mark, and also on the same device that cleared the width: the migration runs, finds the hub already has a plot, marks itself done and leaves `dw-plot` behind. Every later boot with an empty hub plot then shows the legacy width. Not run, from skeptic 2's code reading: `hub.has` is false for a null row (`apps/hub.js:224`), so a device that holds `dw-plot`, has no migration mark and first opens the guide after the clear would migrate the legacy width onto the server. That is the P2-SYNC-03 / P3-DOLLYWOOD-01 pattern, so it is recorded here, not filed separately.

### Usability, visual and gap findings

These were not adversarially verified. Items marked "from the visual check" were added by the independent visual checker.

**UX**

- **UX-DOLLYWOOD-1 — Ticking the step just built takes 3-4 taps plus a scroll, and Home has no build-guide card** (medium).
  - J1 is 4 taps on the iPhone (the sheet must be raised first) and 3 taps plus a scroll on the iPad and desktop. On iPad portrait the card title sits at y=1400 in a 1132 px viewport; on desktop the card starts at y=1441 in 852.
  - Home has no card for the build, so every path starts at the Apps tab (`index.html:458-459`).
  - Evidence: `audits/evidence/p3/dollywood/taps.json`; `audits/screens/dollywood/map-typical-ipad-portrait-light.png`; `audits/screens/dollywood/map-typical-desktop-light.png` (the checker notes `audits/screens/dollywood/steps-typical-desktop-light.png` is a scrolled capture, so this one shows the fold).
- **UX-DOLLYWOOD-2 — On iPad and desktop, the card's Next and Show on map move a map the person cannot see** (medium).
  - `mapIntoView` returns early unless on a phone (`apps/dollywood.html:1140`).
  - On iPad portrait, with the card read at mid-screen, only the bottom 261 px of the 738 px map is on screen when Next changes the view; the page does not scroll (`scrollY` stays 924). On desktop the map is fully above the viewport while the card is read.
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.nextFromCard`, `desktop.buildCard`); `audits/screens/dollywood/step-on-map-typical-ipad-portrait-light.png`.
- **UX-DOLLYWOOD-3 — A phone's first screen is header, chips and parking lots; the park sits under the peeking sheet** (medium).
  - The map starts at y=470 and the sheet at 766 (viewport 884). 56 of 68 markers are under the sheet and 11 are in view. The chips wrap to 2 rows, and only 2 of 13 are fully visible.
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`phone.firstScreen`); `audits/evidence/p3/dollywood/phone-first-screen.png`; `audits/screens/dollywood/map-typical-iphone-pwa-light.png`. The checker agreed, noting that the park is mostly, not wholly, hidden.
- **UX-DOLLYWOOD-4 — Below 1180 px, search results appear about 2,000 px from the search box, and a no-match search says only "0 of 145"** (medium).
  - Searching "zipline" on iPad portrait put the results list top at y=2506 (search box bottom 428, viewport 1132), with no empty-state message. A single match does fly to it and open its card ("thunder").
  - From the visual check: even where the results sit beside the field (desktop), a no-match search leaves the Listings panel blank apart from "0 of 145", with no message, suggestion or clear button.
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.searchNoMatch`, `ipad.searchOneMatch`); `audits/evidence/p3/dollywood/ipad-search-no-match.png`; `audits/screens/dollywood/search-none-typical-ipad-portrait-light.png`; `audits/screens/dollywood/search-none-typical-desktop-dark.png`.
- **UX-DOLLYWOOD-5 — While the first pull loads, the guide looks like a first-time user and Mark done is live** (medium; the data loss is P2-SYNC-01).
  - On a fresh device with the pull held 5 s: "0 of 9 done", every chip 0/N, an enabled Mark done and no loading cue (L1). After the pull: "7 of 9 done". A tick in that window replaced the server row, 24 → 1 (L2).
  - Evidence: `audits/evidence/p3/dollywood/data-checks.json` (`L1.duringLoad`, `L1.afterLoad`, `L2.tickDuringLoad`); `audits/evidence/p3/dollywood/first-open-loading.png`; `audits/screens/dollywood/steps-loading-iphone-pwa-light.png`.
- **UX-DOLLYWOOD-6 — A tick made offline looks exactly like a synced one** (medium).
  - Offline, Mark done moved the count to "8 of 9 done" while `hub.sync` was `{state:"offline", pending:1}`. No word on screen mentioned offline, pending or sync, and no toast appeared. On reconnect the server reached 25. The shell's sync dot is hidden behind the viewer.
  - From the visual check: the offline captures match the online ones in the chrome.
  - Evidence: `audits/evidence/p3/dollywood/data-checks.json` (`O1.offlineTick`, `O1.afterReconnect`); `audits/evidence/p3/dollywood/offline-before-tick-online.png`; `audits/evidence/p3/dollywood/offline-after-tick.png`; `audits/screens/dollywood/map-offline-iphone-pwa-dark.png`.
- **UX-DOLLYWOOD-7 — On phones, Next unfinished from the peeking sheet leaves the new step hidden** (low).
  - The sheet stays at peek; the new title "Blueprint the section" sits at y=928, below the 884 px viewport. Only the header changes.
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`phone.nextUnfinishedAtPeek`); `audits/screens/dollywood/next-unfinished-overflow-iphone-pwa-light.png`.
- **UX-DOLLYWOOD-8 — After a cut, the profile is about 1,000 px below and the map still says "Tap two points"** (low).
  - On iPad portrait the profile top was at y=2101 (viewport 1132). The map pill still read "Tap two points", and the readout repeated the instruction (`apps/dollywood.html:824, 826`).
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.crossSectionResult`); `audits/evidence/p3/dollywood/ipad-cross-section-cut.png`.
- **UX-DOLLYWOOD-9 — Map cards run off-screen** (low).
  - `openPop` keeps the card inside the map box, not the viewport (`apps/dollywood.html:961-963`). On iPad portrait a listing card opened on a low marker ended at y=1176 in a 1132 px viewport. On desktop the coaster card is 926 px tall in an 852 px viewport (bottom 1331).
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.listingCardLowMarker`, `desktop.coasterCard`); `audits/evidence/p3/dollywood/ipad-listing-card-low-marker.png`; `audits/screens/dollywood/coaster-typical-desktop-light.png`.
- **UX-DOLLYWOOD-10 — Reset progress is a native `confirm()` that clears all 13 sections, with no undo** (low).
  - The dialog reads "Clear all saved progress?". On OK the server's 24 ticks went to 0 and no undo was offered (`apps/dollywood.html:1098`). Reset is styled like Export and Import.
  - Evidence: `audits/evidence/p3/dollywood/repro-new.json` (`reset {dialogs:["confirm: Clear all saved progress?"], serverTicksAfter:0, undoOffered:false}`); `audits/screens/dollywood/progress-menu-typical-desktop-light.png`.
- **UX-DOLLYWOOD-11 — Every tick posts a family-feed line; an untick leaves it, and a re-tick doubles it** (low; feed lines are a log, not household data).
  - Five Mark done taps on the last Entrance steps (tick, tick, untick, tick, untick) posted 3 lines to the family feed that Home and the TV read, including "Ticked Blueprint the section" twice, although that step ended unticked (`apps/dollywood.html:1086`).
  - Evidence: `audits/evidence/p3/dollywood/repro-new.json` (`feed {newFeedLines:3}`).
- **UX-DOLLYWOOD-12 — The plot width accepts implausible values without comment** (low).
  - 12,500 m reads "1363% of real size (13.631×)". The input has only `min=50`, which typing does not enforce (`apps/dollywood.html:673, 1049-1052`).
  - Evidence: `audits/screens/dollywood/scale-overflow-iphone-pwa-light.png`; `audits/evidence/p3/dollywood/data-checks.json` (`P1.plotOnCard` factor 13.63).
- **UX-DOLLYWOOD-13 — The "Unlisted structure" card offers web search with an empty query** (low).
  - `srch(t.name || '')` (`apps/dollywood.html:987`) leaves the search box empty next to Web / Photos / Videos / dollywood.com buttons.
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.unlistedBuilding {searchValue:""}`); `audits/screens/dollywood/building-typical-iphone-pwa-light.png`.
- **UX-DOLLYWOOD-14 — If the display profile loads the file by URL, it is offered Mark done, Reset and Import** (info).
  - A tap gives the toast "This screen only looks — sign in on a phone to change things." and writes 0 rows. The kiosk has no tile, and `#dollywood` gives a toast, so it cannot normally get here.
  - Evidence: `audits/evidence/p3/dollywood/visibility.json` (`tv.byUrl`, `tv.shell`).

**Visual**

- **VIS-DOLLYWOOD-1 — Completed steps are struck through at 2.2:1 (light) and 3.5:1 (dark)** (medium).
  - `.bitem.ok` combines the dim colour, opacity .55 and a line-through (`apps/dollywood.html:100-101`). Rendered contrast of the 13 px text: Hearth 2.23, Parchment 2.31, Frost 2.26, Midnight 3.62, Forest 3.49 (AA needs 4.5). The checker confirmed the rows are barely legible.
  - Evidence: `audits/evidence/p3/dollywood/visual-measure.json` (`ipad.<theme>.card.failing`); `audits/evidence/p3/dollywood/ipad-card-hearth.png`; `audits/evidence/p3/dollywood/ipad-card-midnight.png`; `audits/screens/dollywood/steps-overflow-desktop-light.png`.
- **VIS-DOLLYWOOD-2 — 35 tap targets under 44 px on the phone, 15 on the iPad** (medium).
  - Phone: the 13 section chips (36 px tall), six tool and zoom buttons (32 px wide), nine coaster-legend items (17 px tall, tappable, `apps/dollywood.html:1148`), "?" (32×32), the sheet handle (22 px tall), Next unfinished (40 px), … (44×40), Compare (36 px), the exaggeration slider (20 px).
  - iPad: − and + (40 px wide), the legend items (17 px), "?" (32×32), … (37 px wide), Compare (36 px).
  - From the visual check: the card link buttons (Web ↗, Photos ↗…) are about 33 px tall and were not in the count, because it was taken with no card open.
  - Evidence: `audits/evidence/p3/dollywood/visual-measure.json` (`iphone-pwa.targetsUnder44`, `ipad-portrait.targetsUnder44`); `apps/dollywood.html:300, 302, 318, 328, 362`.
- **VIS-DOLLYWOOD-3 — The type departs from the house style** (low).
  - The h1, stat numbers and card and step titles (28, 17 and 22 px) use `--font-display`, a serif (`apps/dollywood.html:223, 306`; `apps/design.css:19-20`). All other text uses `--font-sans`, which starts with ui-rounded (`apps/design.css:18`), so rounded is everywhere, not only on numerals, and the stat numerals are serif.
  - Off-scale sizes 12.5, 13.5 and 14.5 px; toolbar group labels 10.5 px caps (below 11); pills, phase heads and listing meta 11 px. The checker confirmed the serif and the tiny caps in the captures; the rounded face cannot be seen in the rig's fallback fonts.
  - Evidence: `audits/evidence/p3/dollywood/visual-measure.json` (`iphone-pwa.typeScale`, `ipad-portrait.typeScale`); `audits/screens/dollywood/map-typical-ipad-portrait-light.png`; `audits/screens/dollywood/steps-typical-desktop-dark.png`.
- **VIS-DOLLYWOOD-4 — Profile axis labels render at 5.7 px on the phone** (low).
  - `font-size` 12 inside a 1000-wide viewBox (`apps/dollywood.html:936`), drawn 372 px wide. The checker saw illegible smudges.
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`phone.profileAxisLabels`); `audits/screens/dollywood/cross-section-typical-iphone-pwa-light.png`.
- **VIS-DOLLYWOOD-5 — The "step N of M" pill is just under AA in the light palettes** (low).
  - 11 px text at 4.45:1 in Hearth and 4.37:1 in Parchment; Frost, Midnight and Forest pass.
  - Evidence: `audits/evidence/p3/dollywood/visual-measure.json` (`ipad.hearth.card.failing`, `ipad.parchment.card.failing`); `audits/evidence/p3/dollywood/phone-sheet-half-hearth.png`.
- **VIS-DOLLYWOOD-6 — The glass look sits on content (header, side panel), and cards read through to the map** (low; provisional, the rig may not render blur).
  - The header, toolbar and side panel carry the specular glass gradient (`apps/dollywood.html:234, 245, 249`) with no backdrop blur. On the iPad only the readout and the dead N button have blur; on the phone the sticky toolbar and the sheet do.
  - The checker confirmed that markers 133, 138, 140 and 144 show through the Thunderhead card's text.
  - Evidence: `audits/evidence/p3/dollywood/visual-measure.json` (`ipad.glass`, `phone.glass`); `audits/screens/dollywood/listing-typical-ipad-landscape-dark.png`; `audits/screens/dollywood/coaster-typical-desktop-light.png`.
- **VIS-DOLLYWOOD-7 — Inner radii are not concentric** (low).
  - The basemap select (radius 12) sits in the toolbar (16) at an 11 px inset; the … button (12) sits in the build card (20) at a 15 px inset. Each should be about 5. The checker could not see this at 1× and relied on the JSON.
  - Evidence: `audits/evidence/p3/dollywood/visual-measure.json` (`ipad.radii`).
- **VIS-DOLLYWOOD-8 — Default form controls, `confirm()` / `alert()` and text-glyph buttons** (low).
  - Native selects (`#bmap`, `#cint`, `#hf`), checkboxes, range and number inputs with spinners, and a search field with the browser's clear glyph. `confirm()` at `apps/dollywood.html:1098` and `alert()` at `apps/dollywood.html:1101`. Buttons drawn as glyphs: …, ?, ×, ↗, ▾; the iPad and desktop toolbar is all text.
  - Evidence: `audits/screens/dollywood/layers-typical-ipad-portrait-light.png`; `audits/screens/dollywood/scale-typical-ipad-portrait-dark.png`; `audits/screens/dollywood/view-menu-typical-ipad-portrait-light.png`.
- **VIS-DOLLYWOOD-9 — Flat green bands where a basemap does not fill the frame** (low).
  - The phone map box is taller than the map's aspect ratio, so its `#4F6A48` background (`apps/dollywood.html:284, 348`) shows as a band under the aerial, illustrated and steepness basemaps, and as wedges with Upright on. From the visual check: on the phone, Upright also shows a diagonal raster edge over the band.
  - Evidence: `audits/screens/dollywood/aerial-typical-iphone-pwa-dark.png`; `audits/screens/dollywood/upright-typical-desktop-light.png`; `audits/screens/dollywood/upright-typical-iphone-pwa-dark.png`.
- **VIS-DOLLYWOOD-10 — The header wraps badly on iPad landscape** (low).
  - The hero art ends at x=171 and the title starts at x=690, a 519 px gap; the stats wrap below; the header is 213 px tall.
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`ipadL.header`); `audits/evidence/p3/dollywood/ipad-landscape-header.png`; `audits/screens/dollywood/map-loading-ipad-landscape-light.png`.
- **VIS-DOLLYWOOD-11 — The 3D gesture hint is truncated on phones and lists keyboard keys** (low).
  - The readout has a scroll width of 570 in 274 px on a coarse pointer, and it mentions "arrows or WASD" and "Q/E".
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`phone.3dReadout`); `audits/screens/dollywood/view-3d-typical-iphone-pwa-light.png`.
- **VIS-DOLLYWOOD-12 — The card link buttons keep the 3 px web radius** (low; from the visual check).
  - Web ↗, Photos ↗, Videos ↗ and dollywood.com ↗ are square-cornered grey boxes, beside the 20 px card and the rounded "Zoom to it". The rules `.pop a.btn` and `.info a.btn` set 3 px (`apps/dollywood.html:77, 123-124`) and the coaster track picture too (`apps/dollywood.html:79`); no hub-flavour rule overrides them.
  - Evidence: `audits/screens/dollywood/coaster-typical-desktop-light.png`; `audits/screens/dollywood/listing-typical-ipad-landscape-dark.png`; `audits/screens/dollywood/building-typical-iphone-pwa-dark.png`.
- **VIS-DOLLYWOOD-13 — Layer legend swatches vanish on the light panel** (low; from the visual check).
  - In Layers, the Section names swatch is an inline `#FFF8E6` (`apps/dollywood.html:664`) on a cream panel, about 1:1. Official listings looks the same, and the Contours, Dollywood Express and Guest paths swatches are pale yellow. Below the 3:1 floor for non-text.
  - Evidence: `audits/screens/dollywood/layers-typical-ipad-portrait-light.png`; `audits/screens/dollywood/about-typical-ipad-portrait-light.png`.
- **VIS-DOLLYWOOD-14 — The measure label is thin, small and unhaloed over the map** (low; from the visual check).
  - "555 m · 242 m in game" is small regular text straight on the terrain, with no pill or halo; the section labels get heavy haloed caps.
  - Evidence: `audits/screens/dollywood/measure-typical-ipad-landscape-light.png`.
- **VIS-DOLLYWOOD-15 — Listing labels collide with markers and each other at section zoom** (low; from the visual check).
  - In the Showstreet view, "Ride Accessibility Center" is drawn over marker 8, "TimeSaver & Special Experiences Reservation Center" runs across two buildings, and "126 Dreamsong Theater" overlaps its neighbour.
  - Evidence: `audits/screens/dollywood/section-typical-ipad-landscape-light.png`.
- **VIS-DOLLYWOOD-16 — The phone 3D view is mostly sky** (low; from the visual check).
  - The camera frames the park in the lower third; about 40% is empty sky, and the nearest terrain disappears under the sheet. It is also the screen P3-DOLLYWOOD-04 leaves the person on.
  - Evidence: `audits/screens/dollywood/view-3d-typical-iphone-pwa-light.png`; `audits/evidence/p3/dollywood/phone-3d-after-second-tap.png`.
- **VIS-DOLLYWOOD-17 — The desktop toolbar wraps Search onto a near-empty second row** (low; from the visual check).
  - At 1440 px the first row ends with about 100 px of space after Terrain, and Search sits alone on a second row with about 800 px of space. Its "SEARCH" label touches the field's focus ring when focused.
  - Evidence: `audits/screens/dollywood/map-typical-desktop-light.png`; `audits/screens/dollywood/search-none-typical-desktop-dark.png`.

**Gaps**

- **GAP-DOLLYWOOD-1 — The 3D view never shows the current step** (medium).
  - LEGO Builder's core is a step you can zoom and spin. Here the 3D code never reads the current section or step: no `curSec`, `curIdx`, `stepTarget` or `highlight` between `apps/dollywood.html:1157` and `:1290` (NOT FOUND IN CODE), and entering 3D hides the 2D map that carries the step highlight (`apps/dollywood.html:1153`).
  - Evidence: `audits/screens/dollywood/view-3d-typical-ipad-portrait-light.png`; reference https://www.lego.com/en-us/builder-app.
- **GAP-DOLLYWOOD-2 — No shared, read-only view of a build** (low).
  - Progress is one person's row (`apps.json:9` scope `person`; `apps/dollywood.html:1062`), so another adult cannot follow Eli's build, as LEGO's Build Together allows.
  - Evidence: `apps.json:9`; `apps/dollywood.html:1062, 1105-1112`.

**Positive**

- **OK-DOLLYWOOD-1 — Kids and the kiosk really cannot open the build guide from Home, Apps, a deep link or chat** (info).
  - Ezra and Kiara: no tile, no Home card; `#dollywood` gives "That app is not available for this profile."; chat `get_data` gives "This person cannot use that app." and `set_data` "Kids cannot change that app." The TV gets no tile and the same toast. Only typing the file URL loads it (P2-SEC-02).
  - Evidence: `audits/tools/phase3/dollywood/visibility.mjs` → `audits/evidence/p3/dollywood/visibility.json` (`ezra.shell`, `kiara.shell`, `ezra.chat.get_data`, `ezra.chat.set_data`, `tv.shell`, `ezra.byUrl`).
- **OK-DOLLYWOOD-2 — A tick on the phone reaches an open iPad in place, without a reload** (info).
  - After the iPad's pull, "7 of 9 done" became "8 of 9 done", the open step flipped to "Done ✓", and the step did not jump (`apps/dollywood.html:1108-1112`).
  - Evidence: `audits/evidence/p3/dollywood/data-checks.json` (`S2.liveRefresh`).
- **OK-DOLLYWOOD-3 — No private theme toggle: the theme follows the person, and the CSS keys off `data-scheme`** (info).
  - `#theme-row` is removed (`apps/dollywood.html:1034`; the reference flavour's toggle is stripped by `../dollywood-build-project/scripts/build_html.py:90-92`). `prefers-color-scheme` appears 0 times. All five palettes render the chrome.
  - Evidence: `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.viewMenu.contents`); `audits/evidence/p3/dollywood/ipad-card-forest.png`; `audits/evidence/p3/dollywood/ipad-card-frost.png`.
- **OK-DOLLYWOOD-4 — The signed-in person's accent reaches the selected chip, the tool buttons and the focus ring** (info).
  - Eli (#4F5D8C) and Mae (#BC5A38) get different pressed-chip and Pan fills and focus rings. The progress bars (olive) and the step highlight (gold) do not follow the accent (see §5).
  - Evidence: `audits/evidence/p3/dollywood/visual-measure.json` (`accent`); `audits/evidence/p3/dollywood/ipad-top-eli.png`; `audits/evidence/p3/dollywood/ipad-top-christian.png`.
- **OK-DOLLYWOOD-5 — The 3D view builds quickly, uses a lighter build on touch devices, and frees its geometry** (info).
  - Built in 506-575 ms in Chromium on software GL. Coarse pointers get a 2048 texture and shadow map, a 1.5 DPR cap and fewer trees (`apps/dollywood.html:1161-1195`). Geometry buffers are freed on rebuild (7,810 of 8,628 deleted). Reduced motion stops the pulse through design.css.
  - Evidence: `audits/evidence/p3/dollywood/perf-3d.json` (`ipad-portrait buildMs 506`, `liveBuf 818`); `audits/evidence/p3/dollywood/visual-measure.json` (`reducedMotion`).

### Checked and not a bug

- **"Each vertical-exaggeration change rebuilds the 3D scene and leaks about 157 GPU textures (~16.5 MB)"** (the investigator's medium perf finding). **Refuted** 2-0, with one skeptic undecided and the third breaking the tie.
  - The skeptics re-created the investigator's raw numbers exactly (1,731 textures created, `deleteTexture` called 0 times, 244.3 MB uploaded), but those are running totals, not memory held. Every texture a rebuild replaces becomes unreachable and is garbage-collected, and the browser frees the GL texture with it.
  - Skeptic 1 (`node "audits/tools/phase3/dollywood/verify-3d-rebuild-texture-leak-1.mjs" ipad-portrait`, Chromium, a FinalizationRegistry on every texture): live textures stayed at 161 (55.6 MB) across 20 rebuilds, briefly 318 before a natural GC (`audits/evidence/p3/dollywood/verify-3d-rebuild-texture-leak-1.json`, `-1-nogc.json`).
  - Skeptic 2 (`verify-3d-rebuild-texture-leak-2.mjs`, Chromium and WebKit) was undecided: Chromium freed everything without help, but in WebKit 3,140 replaced textures were still held after 30 rebuilds and a mild pressure round (`audits/evidence/p3/dollywood/verify-3d-rebuild-texture-leak-2-webkit.json`).
  - Skeptic 3 (`verify-3d-rebuild-texture-leak-3.mjs`, both engines, stronger memory pressure) broke the tie: all 4,710 replaced textures, CanvasTextures and SpriteMaterials were finalised in both engines, and live counts returned to 161 / 158 / 157; the context was never lost (`audits/evidence/p3/dollywood/verify-3d-rebuild-texture-leak-3-chromium.json`, `-3-webkit.json`).
  - What remains is a low tidy-up, not a defect: each slider step redraws and re-uploads about 17 MB of tag and label textures that do not depend on exaggeration, and relies on GC to free the old ones (`apps/dollywood.html:1225-1232, 1261, 1264, 1274`). The app has no `webglcontextlost` handler of its own; the inlined three.js registers one (`apps/dollywood.html:1748`). It is folded into Polish row 8 in §7.
- **"Switching basemap on a phone re-fits to the whole frame instead of keeping the phone fit"** (a sub-claim of lead `audits/01-leads.md:345`, never filed as a finding). **Not reproduced** by the completeness critic: on the iPhone PWA in WebKit the view read `[208,770,1064,1533]` at boot and stayed the same after Aerial, Mix, Official and Relief, and the `#bmap` change handler has no fit call (`apps/dollywood.html:1032`; template `../dollywood-build-project/scripts/template.html:1029`). Evidence: `audits/tools/phase3/dollywood/critic-basemap.mjs` → `audits/evidence/p3/dollywood/critic-basemap.json`. It had no skeptics because it was never a candidate, so it is not counted in "Refuted".

Two confirmed claims were narrowed rather than refuted: P3-DOLLYWOOD-04 (the chips stay visible as exits, so it is misleading rather than a trap) and P3-DOLLYWOOD-09 (the loop stops when the viewer closes). Two were widened: P3-DOLLYWOOD-05 and -07, both raised to medium. The critic's P3-DOLLYWOOD-16 and -17 were widened by their skeptics without a severity change: Ctrl/Cmd+D also silently unticks a done step, and a focused card button loses its arrow keys too.

### Unresolved — needs a device or more evidence

No verified finding is unresolved. Open questions:
- **WebKit's texture pile-up on a real iPad** (from the refuted finding). WebKit can hold replaced 3D textures until a full GC (skeptic 2 saw 3,140 still held after 30 rebuilds). Whether that ever costs the WebGL context on a real iPad is unknown; with no app-level context-loss handler the 3D view would stay blank. To settle it: Safari Web Inspector's Memory timeline on an iPad, the exaggeration slider dragged 30 or more times, and a check that memory drops back and the canvas never goes blank.
- **How often a first pull exceeds 6 s or fails** on cellular or a cold Worker. This decides how likely P3-DOLLYWOOD-01 is, as it does for P2-SYNC-03 (`audits/02-shell.md:2968`). It also needs a household check of whether any device still holds `dollywood-build-progress-v2` (production data was not read).
- **The idle cost on a real iPad** (P3-DOLLYWOOD-08, -09). The percentages come from headless Chromium on Windows; a Safari timeline or battery drain over an hour on the Kitchen iPad would settle the size.
- **Glass transparency** (VIS-DOLLYWOOD-6, lead `audits/01-leads.md:342`). The rig may not render backdrop blur.

## 5. Visual fidelity

### Rubric scores

| Dimension | Investigator | Checker | Final | Provisional? | Reason | Evidence |
|---|---|---|---|---|---|---|
| Typography | 4 | 4 | **4** | Yes (fallback fonts in the rig) | Serif display for the title, stats and card and step titles; ui-rounded for everything else. Half sizes 12.5 / 13.5 / 14.5, 10.5 px caps, a 9 px N, and 5.7 px axis labels on phones. Hierarchy by size and weight is clear. The checker agreed: one below the shell's 5 because of the sub-11 px text. | `audits/screens/dollywood/map-typical-ipad-portrait-light.png`, `audits/screens/dollywood/steps-typical-desktop-dark.png`, `audits/screens/dollywood/steps-full-typical-iphone-pwa-light.png`, `audits/screens/dollywood/cross-section-typical-iphone-pwa-light.png` |
| Color & palette | 5 | 4 | **4** | No | Warm, token-driven chrome; the accent reaches the chips and tools; the phase pills are soft fill with ink. But done rows are 2.2:1, progress bars are olive for everyone, and several layer swatches vanish on the cream panel (`#FFF8E6`, `apps/dollywood.html:664`). The checker lowered it to match the shell's 4 for the same Hearth chrome; the map's vivid colour is content, not palette. | `audits/evidence/p3/dollywood/ipad-card-hearth.png`, `audits/evidence/p3/dollywood/ipad-top-christian.png`, `audits/screens/dollywood/layers-typical-ipad-portrait-light.png`, `audits/screens/dollywood/map-typical-ipad-portrait-light.png` |
| Layout & spacing | 3 | 3 | **3** | No | The step card is below the fold on iPad and desktop; a phone's first screen is header, chips and parking; popovers open off-screen; a 519 px header gap on iPad landscape; green bands under the basemaps. The checker added label collisions at section zoom, Search alone on a second desktop toolbar row, and the phone Upright framing. | `audits/evidence/p3/dollywood/phone-first-screen.png`, `audits/screens/dollywood/map-typical-desktop-light.png`, `audits/evidence/p3/dollywood/ipad-landscape-header.png`, `audits/evidence/p3/dollywood/phone-help-popover.png`, `audits/screens/dollywood/section-typical-ipad-landscape-light.png` |
| Shape, depth & material | 5 | 5 | **5** | Yes (real blur not visible in the rig) | Large 16-24 px radii on cards and buttons and a real glass recipe with sheen and edge ring. But the card link buttons and the track picture keep 3 px (checker), the glass is painted on content while the iPad control layer has no blur, cards read through to the map, and inner radii are not concentric. | `audits/screens/dollywood/coaster-typical-desktop-light.png`, `audits/screens/dollywood/listing-typical-ipad-landscape-dark.png`, `audits/screens/dollywood/view-3d-typical-ipad-portrait-light.png` |
| Iconography | 4 | 4 | **4** | No | Only the phone toolbar has a consistent stroke set (pan, cross-section, measure, −/+, fit, layers). The iPad and desktop toolbar is all text. The rest are glyphs: …, ?, ×, ↗, ▾, the native disclosure triangle and a ◌ in listing rows. The N compass is dead. | `audits/screens/dollywood/map-typical-iphone-pwa-light.png`, `audits/screens/dollywood/map-typical-ipad-portrait-light.png`, `audits/screens/dollywood/progress-menu-typical-desktop-light.png` |
| Motion & feedback | 4 | 3 | **3** | Yes (motion is code-only in stills) | A 300 ms sheet and 360 ms map tweens, skipped under reduced motion (code). No `:active` press state at all, an infinite pulse (P3-DOLLYWOOD-08), `confirm()` / `alert()` with no undo, Reset styled like Export, Next unfinished that hides its step at peek, and a first paint of 0/9 that jumps to 7/9. The checker lowered it to the shell's 3, which at least has press states. | `audits/screens/dollywood/progress-menu-typical-desktop-light.png`, `audits/screens/dollywood/next-unfinished-overflow-iphone-pwa-light.png`, `audits/evidence/p3/dollywood/phone-3d-after-second-tap.png`, `audits/screens/dollywood/map-loading-ipad-portrait-light.png` |
| Dark mode | 5 | 5 | **5** | No | The chrome follows every palette through `data-scheme`, with denser dark glass. The map and 3D sky stay daylight; done rows reach only 3.5:1. Checker's correction: the profile gradient reads olive to deep green on dark cards, not bright; Hearth on a dark OS paints a coherent dark screen, and the rule mix (P2-VIS-03) shows only in the JSON. | `audits/screens/dollywood/map-typical-iphone-pwa-dark.png`, `audits/screens/dollywood/steps-typical-desktop-dark.png`, `audits/evidence/p3/dollywood/ipad-card-forest.png`, `audits/evidence/p3/dollywood/ipad-card-midnight.png` |
| Native feel | 3 | 3 | **3** | No | Native selects, checkboxes, number spinners, the disclosure triangle and 3 px link buttons; `confirm()` and `alert()`; a keyboard-shortcut popover and a WASD hint on touch devices; mouse wording after 3D (P3-DOLLYWOOD-14); a dead N. Tap highlight is suppressed and focus rings are keyboard-only (code). | `audits/screens/dollywood/layers-typical-ipad-portrait-light.png`, `audits/screens/dollywood/scale-typical-ipad-portrait-dark.png`, `audits/screens/dollywood/view-3d-typical-ipad-portrait-light.png`, `audits/screens/dollywood/help-typical-iphone-pwa-light.png` |
| Glanceability | 2 | 3 | **3** | No | The largest text is 28 px (5.4 mm, readable to about 1.1 m); the step title reads to 0.84 m; the current step is off the first iPad screen. The checker raised it one point: the chips carry per-section bars with x/N counts, the phone's peek always shows the section, "N of M done" and a bar, and section names are bold haloed caps. Still well below the shell's 4. | `audits/screens/dollywood/map-typical-ipad-portrait-light.png`, `audits/screens/dollywood/steps-typical-ipad-portrait-light.png`, `audits/screens/dollywood/map-typical-iphone-pwa-light.png` |
| Ease of use | 3 | 3 | **3** | No | Mark done takes 3-4 taps plus a scroll; the phone … menu cannot be used; the phone 3D button does not toggle; the height filter is wrong; search and profile results are far from their controls on iPad (beside the field on desktop); a no-match search gives only "0 of 145"; Import replaces progress without checking. | `audits/evidence/p3/dollywood/phone-progress-menu-clipped.png`, `audits/evidence/p3/dollywood/phone-3d-after-second-tap.png`, `audits/evidence/p3/dollywood/ipad-search-no-match.png`, `audits/screens/dollywood/search-none-typical-desktop-dark.png` |
| Delight | 6 | 6 | **6** | No | A handsome survey map and aerial, a lit 3D model with trees, coaster cards with track and profile, "Used in step N" links, ghost-compare profiles, hero art and per-section chip bars. Held back by a flat 9/9 finish and the mostly-sky phone 3D framing. | `audits/screens/dollywood/view-3d-typical-ipad-portrait-light.png`, `audits/screens/dollywood/coaster-typical-desktop-light.png`, `audits/screens/dollywood/cross-section-compare-typical-ipad-landscape-light.png`, `audits/screens/dollywood/aerial-typical-desktop-dark.png` |

Average: (4 + 4 + 3 + 5 + 4 + 3 + 5 + 3 + 3 + 3 + 6) / 11 = 43 / 11 = **3.9**. The investigator's average was 44 / 11 = 4.0; the checker's was the same as the final, 3.9.

**How the scores were checked.**
- **What the checker opened:** 44 screenshots. That is all 25 the investigator cited, plus 19 more across iPad portrait and landscape, iPhone PWA and Safari and desktop, light and dark, in the typical, empty, loading, offline and overflow states, and two contact sheets (steps, upright). It wrote no script; the new radius and swatch findings cite code lines.
- **Agreed:** 8 of 11 dimensions.
- **Adjusted by one point:** 3 dimensions.
  - **Colour & palette, 5 → 4:** the same earthy Hearth chrome the shell scored 4; done rows at 2.2:1; olive progress for every profile; invisible legend swatches.
  - **Motion & feedback, 4 → 3:** calibrated to the shell's 3 for `confirm()` without undo; this app also has no press states, and the sheet and tween timings cannot be seen in stills.
  - **Glanceability, 2 → 3:** the chips and the phone peek carry progress at a glance.
- **Judge:** ruled on 0 dimensions; no gap reached 2 points.
- **Claims the checker corrected:**
  - The base 3 px radii are not all overridden in the hub flavour: `.pop a.btn`, `.info a.btn` and `svg.trk` keep 3 px (`apps/dollywood.html:77, 79, 124`).
  - The profile gradient reads dark on the dark palettes, not "daylight bright".
  - `audits/screens/dollywood/steps-typical-desktop-light.png` is a scrolled capture; `audits/screens/dollywood/map-typical-desktop-light.png` shows the fold.
  - The axis-label rule is at `apps/dollywood.html:936` (the checker cited 935).

### Deviations from the house style

Each is marked with the visual checker's verdict.

| Area | Deviation | Checker | Evidence |
|---|---|---|---|
| Type scale | 12.5 px (phone chips, card count, listing rows, profile controls, iPad readout), 13.5 px (intro), 14.5 px (step body, approx note): off the Dynamic Type scale. 10.5 px caps toolbar labels, below 11. 11 px phase pill, phase heads and listing meta. No Large Title: h1 is 28 px. | Supported | `audits/evidence/p3/dollywood/visual-measure.json` (`typeScale`); `apps/dollywood.html:156, 242, 307, 318` |
| Font stacks | Display text (h1, stat numbers, card, step and side titles) is `--font-display` = ui-serif (`apps/dollywood.html:223, 306`; `apps/design.css:19-20`). Body text is `--font-sans`, starting with ui-rounded (`apps/design.css:18`), so rounded is everywhere, not only on numerals; stat numerals are serif. 3D canvas labels are system-ui 800 (`apps/dollywood.html:1225-1229`). | Supported (the rounded face is confirmed by the JSON; the rig uses fallback fonts) | `audits/evidence/p3/dollywood/visual-measure.json` (`typeScale`); `apps/dollywood.html:222-223, 306` |
| Palette pairs and contrast | Done rows 2.18-2.31:1 light, 3.49-3.62:1 dark. The 11 px step pill 4.45:1 (Hearth) and 4.37:1 (Parchment). The 9 px N label 3.06:1 by pixel sampling (about 4.4:1 by computed colour, P3-DOLLYWOOD-10). Everything else measured passes. | Supported | `audits/evidence/p3/dollywood/visual-measure.json` (`ipad.<theme>`); `audits/evidence/p3/dollywood/ipad-card-parchment.png` |
| Per-profile accent | The accent reaches the selected chip, tool buttons and focus ring. Progress bars stay olive (`apps/dollywood.html:243`) and the step highlight gold (`apps/dollywood.html:907-912`), so progress is never in the person's colour. No profile chip or avatar. | Supported | `audits/evidence/p3/dollywood/visual-measure.json` (`accent`); `audits/evidence/p3/dollywood/ipad-top-eli.png` |
| Semantic colours | "Done ✓" uses olive soft / ink (`apps/dollywood.html:227`). Reset has no destructive styling (`apps/dollywood.html:648`). The steepness legend uses its own `#E8683A` swatch (`apps/dollywood.html:664`). | Partly: Reset and the swatch confirmed; no "Done ✓" state was in the images opened | `audits/screens/dollywood/progress-menu-typical-desktop-light.png`; `audits/screens/dollywood/layers-typical-ipad-portrait-light.png` |
| Radii and concentric corners | The basemap select (12) in the toolbar (16) at an 11 px inset, and the … button (12) in the build card (20) at 15 px; each should be about 5. Corrected by the checker: the base 3 px radius survives in the hub flavour on the card link buttons and the track picture (`apps/dollywood.html:77, 79, 123-124`). | Partly: concentricity from the JSON; the "all overridden" claim was wrong and is corrected here | `audits/evidence/p3/dollywood/visual-measure.json` (`ipad.radii`); `audits/screens/dollywood/coaster-typical-desktop-light.png` |
| Glass placement | The glass recipe (sheen plus accent pickup) is painted on content: the header (`apps/dollywood.html:234`), the side panel (`:249`) and the toolbar (`:245`, the control layer, but with no blur on the iPad). Real blur only on the readout and the dead N on the iPad, and on the sticky toolbar and sheet on phones. The card over the map is translucent enough for labels to show through. | Supported | `audits/evidence/p3/dollywood/visual-measure.json` (`ipad.glass`, `phone.glass`); `audits/screens/dollywood/listing-typical-ipad-landscape-dark.png` |
| Icon set | Stroke icons only in the phone toolbar (`apps/dollywood.html:583-596`); the iPad and desktop toolbar is text; glyph buttons …, ?, ×, ↗, ▾; no icon set shared with design.css or the shell. | Supported | `audits/screens/dollywood/map-typical-iphone-pwa-light.png` vs `audits/screens/dollywood/map-typical-ipad-portrait-light.png` |
| Spacing rhythm | 165 hard-coded chrome spacing values, off the 4/8 rhythm in places (`padding: 7px 16px 6px` at `apps/dollywood.html:242`; 6 px 14 px; 11 px 14 px; 2 px 2 px 8 px). No `--sp-*` token is used. | Not checkable in stills (from the compliance JSON) | `audits/evidence/p3/dollywood/compliance-corrected.json` (`css.spacing`) |
| Tap targets | 35 targets under 44 px on the phone and 15 on the iPad (VIS-DOLLYWOOD-2). The checker adds the about 33 px card link buttons, which the count missed. | Supported | `audits/evidence/p3/dollywood/visual-measure.json` (`targetsUnder44`) |
| Motion | No `:active` press states; the infinite pulse (`apps/dollywood.html:282`); 300 ms chip bars (`:151`); smooth scrolls at `apps/dollywood.html:1127` and `:1140` are not gated by reduced motion (design.css zeroes animations and transitions only). | Not checkable in stills (code) | `apps/dollywood.html:151, 282, 1127, 1140`; `apps/design.css:611-613` |
| Sheets | The phone sheet has peek / half / full detents on a 300 ms ease-out, but its … menu is clipped (P3-DOLLYWOOD-03) and Next unfinished leaves the new step hidden at peek (UX-DOLLYWOOD-7). | Supported | `audits/evidence/p3/dollywood/phone-progress-menu-clipped.png`; `audits/screens/dollywood/next-unfinished-overflow-iphone-pwa-light.png` |
| Dark-mode surfaces | The chrome flips, but the map and the 3D sky stay daylight bright. Corrected by the checker: the profile gradient (`#E0C45A` → `#3A7C40`, `apps/dollywood.html:937`) reads olive to deep green on Midnight and Forest because of its 0.35 bottom opacity. Hearth on a dark OS looks coherent; the rule mix is JSON-only (P2-VIS-03). | Partly (corrected as stated) | `audits/screens/dollywood/map-typical-iphone-pwa-dark.png`; `audits/evidence/p3/dollywood/ipad-card-midnight.png`; `audits/evidence/p3/dollywood/hearth-on-dark-os.png` |
| Label legibility over the map (checker's addition) | The measure label has no pill or halo, and listing labels collide at section zoom (VIS-DOLLYWOOD-14, -15). | Checker's addition | `audits/screens/dollywood/measure-typical-ipad-landscape-light.png`; `audits/screens/dollywood/section-typical-ipad-landscape-light.png` |
| Legend swatches (checker's addition) | Several Layers swatches are invisible on the light panel (VIS-DOLLYWOOD-13). | Checker's addition | `audits/screens/dollywood/layers-typical-ipad-portrait-light.png` |

### Web tells

| Tell | Status | Evidence |
|---|---|---|
| Grey tap highlight | Absent | `-webkit-tap-highlight-color: transparent` on the body (inherited), on buttons and inputs, and on the map (`apps/dollywood.html:42, 222, 224`) |
| Long-press callout or selection on chrome | Needs a device | `user-select: none` only on the map (`apps/dollywood.html:42`). No `-webkit-user-select` and no `-webkit-touch-callout` anywhere, so the `role=button` step rows, listing rows and chip labels may select on a long press in iOS |
| Default form controls | Present | Native selects `#bmap`, `#cint`, `#hf`; checkboxes; range inputs; number inputs (`apps/dollywood.html:673`); a search field with the browser's clear glyph; `audits/screens/dollywood/layers-typical-ipad-portrait-light.png` |
| Focus rings on touch | Absent | Only `:focus-visible` rules (`apps/dollywood.html:27, 187, 226`) |
| Blue underlined links | Absent | "Used in step" links are ochre with a dotted underline (`apps/dollywood.html:192`); the link buttons have no underline (`apps/dollywood.html:77, 124`) |
| White flash on load | Needs a device | `apps.json:9` has `"dark": true`, which turns the viewer near-black while the 2.2 MB page loads (`index.html:331, 722`). The rig loaded in under 250 ms and 240 ms sampling saw no dark frame (`audits/evidence/p3/dollywood/visual-measure.json` `darkFlash`) |
| Rubber-band overscroll background | Needs a device | The html and body background is the page token (`apps/dollywood.html:14, 212`); no `overscroll-behavior` on html or body; only the sheet body has `contain` (`apps/dollywood.html:372`) |
| Tap delays | Absent | `touch-action: manipulation` on the body and buttons (`apps/dollywood.html:222, 224`) |
| Visible scrollbars on chrome | Partly | The chip strip shows a thin 6 px scrollbar on iPad and desktop (`apps/dollywood.html:240-241`); hidden on phones (`apps/dollywood.html:316`) |
| Layout shift as data loads | Present | A first open paints 0/N chips and step 1, then flips to 7/9 and step 8 when the pull lands; chip label lengths change (`audits/evidence/p3/dollywood/data-checks.json` `L1`) |
| Spinners vs skeletons | Partly | Neither: the stats show "—" (`apps/dollywood.html:572-575`) and 3D shows "Building the 3D model…" (`apps/dollywood.html:1155`). Progress has no loading state (UX-DOLLYWOOD-5) |
| `alert()` / `confirm()` / `prompt()` | Present | `confirm('Clear all saved progress?')` at `apps/dollywood.html:1098`; `alert('Not a progress file')` at `apps/dollywood.html:1101`; `audits/evidence/p3/dollywood/repro-new.json` (`reset.dialogs`) |

## 6. Platform compliance

**Data through hub.js.**
- **Calls used:** progress and the plot width are person-scope rows through `hub.ready({optional:true})`, `hub.get`, `hub.set`, `hub.onChange` and `hub.migrate` (`apps/dollywood.html:1055, 1062, 1105-1112`). The feed line goes through `hub.activity` (`apps/dollywood.html:1086`). The kiosk guard is `hub.canWrite` / `hub.kioskNudge` (`apps/dollywood.html:1053-1054`).
- **Bypasses** (`audits/evidence/p3/_compliance/dollywood.json` `bypass`, reviewed by hand; the other park-map-only localStorage, `fetch` and `confirm` hits run only from `liveInit`, which the build guide never calls):
  - `dw-plot` in localStorage: written when there is no session (`apps/dollywood.html:1055`), and read at boot even when signed in (`apps/dollywood.html:1057`).
  - The legacy `dollywood-build-progress-v2` key (`KEY`): read for the first paint even when signed in (`apps/dollywood.html:1061`), and written whenever there is no session (`apps/dollywood.html:1062`), which keeps re-arming P3-DOLLYWOOD-01.
  - `dollywood.live.trails`: a top-level read that runs in this flavour too (`apps/dollywood.html:1727`).
  - Export as a `data:` URL download (`apps/dollywood.html:1099`) and Import through `FileReader` (`apps/dollywood.html:1101`), with no validation (P3-DOLLYWOOD-02).
  - Every localStorage access is inside `try/catch`.
- **Where hub.js itself fails the guide:** `hub.migrate`'s local-only check and the 6 s `hub.ready` race (`apps/hub.js:337, 406-407`) are the root of P3-DOLLYWOOD-01; the whole-map row is P2-SYNC-01.

**design.css tokens.** The `compliance.mjs` hits were split by hand into chrome, map cartography, reference-palette remaps and park-map-only rules (`audits/tools/phase3/dollywood/compliance-review.mjs` → `audits/evidence/p3/dollywood/compliance-corrected.json`). Only chrome hits count against the house style.

| Category | Raw hits | Corrected (chrome) | Notes |
|---|---|---|---|
| Hardcoded colours, CSS hex | 115 | **0** | 22 reference-palette values remapped to tokens at `apps/dollywood.html:212`, 41 map cartography, 52 park-map-only |
| Hardcoded colours, JS hex | 147 | **2** | The profile gradient `#E0C45A` / `#3A7C40` (`apps/dollywood.html:937`); the rest are 13 data, 99 map and 3D, 33 park-map-only |
| Hardcoded colours, markup | 4 | **1 chrome + 3 legend swatches** | The N button's inline `#FF6B4A` (`apps/dollywood.html:620`), shown in the hub although dead (P3-DOLLYWOOD-10); the legend swatches `#E8683A`, `#FFF8E6` and `#72964e` (`apps/dollywood.html:664`), the pale one invisible on the light panel (VIS-DOLLYWOOD-13) |
| `rgba()` and other colour functions | 35 | **6** | Base-rule shadows (`apps/dollywood.html:113, 150, 164, 176, 183, 196`), overridden by `var(--e*)` in the hub rules |
| Font sizes | 143 | **69 CSS + 5 JS + 4 inline** | 52 in the base rules (lines 13-207, partly overridden) and 17 in the hub rules; no `--fs-*` token is used |
| Radii | 96 | **50** | 27 base, 23 hub; no `--r-*` token is used. The 3 px link-button radius survives (VIS-DOLLYWOOD-12) |
| Spacing | 269 | **165** | 113 base, 52 hub; no `--sp-*` token is used |
| Shadows | 30 | **11** | Base rules, mostly overridden by `var(--e*)` |
| Durations | 21 | **3** | No `--dur-*` or `--spring` |
| z-index | 24 | **11** | |
| Inline style declarations | 24 | **21** | Plus 23 chrome style writes from JS |
| Undefined tokens | 0 | **0** | 67 local custom properties are defined in the file; 77 distinct tokens are used, all colour, glass, shadow or font-family |

`class="ds"` is not on the body, and the kid and kiosk scales never reach the app because it uses no size tokens. `scripts/screens-apps.mjs` checks only line 212 of this file for hex (`audits/00-inventory.md` §4).

**Per-profile accent.** `--accent` is set by hub.js and reaches the pressed chip, the tool buttons and the focus ring: Eli #4F5D8C against Mae #BC5A38 (`audits/evidence/p3/dollywood/visual-measure.json` `accent`). The progress bars (olive, `apps/dollywood.html:243`) and the step highlight (gold) are fixed.

**Dark mode.**
- The CSS keys only off `data-scheme` (`apps/dollywood.html:10, 219`); `prefers-color-scheme` appears 0 times.
- `data-theme="dark"` is hard-set on `<html>` (`apps/dollywood.html:2`) until hub.js applies the person's theme.
- All five palettes render the chrome (`audits/evidence/p3/dollywood/ipad-card-hearth.png`, `ipad-card-parchment.png`, `ipad-card-frost.png`, `ipad-card-midnight.png`, `ipad-card-forest.png`).
- Hearth on a dark OS mixes Midnight surfaces with light-scheme rules (P2-VIS-03).
- There is no private theme toggle: `#theme-row` is removed (`apps/dollywood.html:1034`).
- Reduced motion is honoured through design.css (`apps/design.css:611-613`), except the two smooth scrolls (`apps/dollywood.html:1127, 1140`).

## 7. Improvements

Ratio = delight ÷ effort, with S = 1, M = 2 and L = 3. The build guide is a generated file, so every change below goes in `../dollywood-build-project/scripts/template.html`, then a rebuild, `verify.py` and an export (CLAUDE.md); the exception is the migration fix, which belongs in `apps/hub.js` with P2-SYNC-03. None adds a kid reward or routine system or a shopping list.

**Polish**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Make the phone 3D button a toggle, or show a 2D / Map button while in 3D (template `:333` and the handler at `:1154`) | 4 | S | 4.0 | P3-DOLLYWOOD-04; `audits/evidence/p3/dollywood/repro-new.json` |
| 2 | Validate and confirm Import: require a done map of known step ids and say "Replace 24 ticks with 2?" (or merge); replace Reset's `confirm()` with a 10 s undo toast, and give Import the same | 4 | S | 4.0 | P3-DOLLYWOOD-02, UX-DOLLYWOOD-10 |
| 3 | Hold writes until the first pull lands: in hub.js, migrate only after a successful first pull of that scope; in the guide, show "Loading your progress…" and disable Mark done and Import until then | 4 | S | 4.0 | P2-SYNC-03 (pointer P3-DOLLYWOOD-01), UX-DOLLYWOOD-5; `data-checks.json` M1, M2, L1, L2 |
| 4 | Open the … menu downward inside the phone sheet, or as its own sheet | 3 | S | 3.0 | P3-DOLLYWOOD-03; `audits/evidence/p3/dollywood/phone-progress-menu-clipped.png` |
| 5 | Fix the rider-height filter: no requirement, or a requirement at or below N | 3 | S | 3.0 | P3-DOLLYWOOD-06 |
| 6 | Full-contrast done rows: keep the tick in olive ink and drop the .55 opacity | 3 | S | 3.0 | VIS-DOLLYWOOD-1 |
| 7 | Small correctness fixes: rotate the box in `fitBoxPhone`; fit the whole park when Whole park is pressed; re-render the step after the plot changes, and apply a cleared plot in `adopt()` without pre-filling from `dw-plot` once signed in; keep the touch hint in `setMode`; anchor "?" and View ▾ inside the screen; hide `.lv-northwrap` outside the park map; fix the "Info tab" copy; ignore Ctrl, Cmd and Alt in the shortcut handler, and pan with the arrows only when the map is on screen | 2 | S | 2.0 | P3-DOLLYWOOD-05, -07, -10 to -18 |
| 8 | Calm the idle page: run the rAF loop only in 3D (and render only on camera change); pulse the highlight three times, then hold; reuse the tag and label textures across exaggeration rebuilds | 2 | S | 2.0 | P3-DOLLYWOOD-08, -09; "Checked and not a bug" |
| 9 | Move the type to the house scale (system-ui titles, Dynamic Type sizes, rounded numerals only) and the chips, tools, legend and link buttons to 44 px | 3 | M | 1.5 | VIS-DOLLYWOOD-2, -3, -12 |

**Missing features**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | An in-app pending / offline cue: "Saved on this device — will sync" under the card while `hub.sync` is offline or pending | 3 | S | 3.0 | UX-DOLLYWOOD-6; `data-checks.json` O1 |
| 2 | Show the profile next to the cut: scroll to it or show it over the map, and clear the "Tap two points" pill | 3 | S | 3.0 | UX-DOLLYWOOD-8 |
| 3 | A Home card for the person's build ("Entrance 7/9 · next: Planting…" with Mark done), so ticking takes 1-2 taps from Home | 5 | M | 2.5 | UX-DOLLYWOOD-1; `audits/evidence/p3/dollywood/taps.json` |
| 4 | Search results under the field (tap to fly) and a "No matches" state | 4 | M | 2.0 | UX-DOLLYWOOD-4; `audits/evidence/p3/dollywood/ipad-search-no-match.png` |
| 5 | Per-step rows (`step:<id>`) instead of one whole-map row, with a one-time conversion, so two devices never erase each other | 4 | M | 2.0 | P2-SYNC-01; `data-checks.json` L2 |
| 6 | A map-and-card layout on iPad landscape and desktop: a sticky map beside the step card, like LEGO Builder's step pane | 5 | L | 1.7 | UX-DOLLYWOOD-1, -2 |

**New ideas**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | A section-complete moment: a calm check and "Showstreet done — 21 steps" when a section fills (a completion cue for the builder, not a reward system) | 3 | S | 3.0 | Chip progress (`apps/dollywood.html:1075-1076`); the checker's "flat 9/9 finish" |
| 2 | "Show in 3D" for the current step: fly the orbit camera to the step's target | 4 | M | 2.0 | GAP-DOLLYWOOD-1 |
| 3 | A read-only "build together" view so another adult can follow the build without writing the builder's row | 2 | L | 0.7 | GAP-DOLLYWOOD-2 |

## App-specific checks

| Check | Result | Evidence |
|---|---|---|
| Progress and plot in the person's scope through hub.js | Yes: rows `progress` (`{stepId:true}`) and `plot` (a string) in `dollywood`/person (`apps/dollywood.html:1055, 1062, 1109-1110`). The seed and server hold 24 ticks and plot 400. Whole-map last-write-wins is P2-SYNC-01. A second device's tick arrives in place (OK-DOLLYWOOD-2); a cleared plot does not (P3-DOLLYWOOD-18). Browser shortcuts can write progress on desktop (P3-DOLLYWOOD-16). | `audits/evidence/p3/dollywood/data-checks.json` (`seed.eliProgress`, `S2.liveRefresh`); `apps/dollywood.html:1105-1112` |
| One-time localStorage migration | Runs once per device through `hub.migrate`, adults only (`apps/dollywood.html:1107`). Unsafe when the first pull has not landed: 24 → 1 with the pull held over 6 s, failing or offline (P3-DOLLYWOOD-01, a pointer to P2-SYNC-03). Safe when the pull lands. The legacy key is never removed and paints the first frame (`apps/dollywood.html:1061`); the legacy `dw-plot` key keeps pre-filling the plot whenever the hub plot is empty (P3-DOLLYWOOD-18). A guest counts as an adult, so a guest who opens the guide first takes the legacy data (P3-TALLY-06). | `data-checks.json` M0-M2; `apps/hub.js:391-411` |
| No private theme toggle | Confirmed (OK-DOLLYWOOD-3). | `audits/evidence/p3/dollywood/layout-checks.json` (`ipad.viewMenu.contents`) |
| 3D performance and memory (Chromium CDP) | The model builds in 506-575 ms (lite build, iPad size) and 412-474 ms (full, desktop). Opening 3D took the JS heap from 5.2 to 9.7 MB and DOM nodes from 5,608 to 5,770; 161 live textures (78.7 MB uploaded on the lite build, 193 MB on desktop). Exaggeration rebuilds re-create and re-upload about 17 MB of textures each, but these are garbage-collected, so live textures stay at one build's worth; the claimed leak was refuted (see "Checked and not a bug"). The rAF loop keeps running in 2D after 3D (P3-DOLLYWOOD-09). Frame rate is not representative (software GL). | `audits/evidence/p3/dollywood/perf-3d.json`; `audits/evidence/p3/dollywood/verify-3d-rebuild-texture-leak-3-webkit.json` |
| Offline | A tick made offline is queued and syncs on reconnect, with no cue on screen (UX-DOLLYWOOD-6). The uncached-file 503 is P2-PWA-16. | `data-checks.json` O1; `scripts/bump-sw.mjs:18`; `sw.js:16` |
| Every view and menu | Steps work; the phone … menu is clipped (P3-DOLLYWOOD-03); Next unfinished stays at peek (UX-DOLLYWOOD-7). Search works for a single match; results are far away with no empty state (UX-DOLLYWOOD-4). Measure works. Cross-section works; the result is off-screen (UX-DOLLYWOOD-8). Layer toggles work; Upright has two fit bugs (P3-DOLLYWOOD-05, -11). View ▾ is 26 px off-screen on iPad portrait (-13); "?" is off-screen on phones (-12). 3D works, with no exit from its own button on phones (-04). Scale: a stale card (-07) and an "Info tab" reference (-15). | `audits/evidence/p3/dollywood/layout-checks.json`; `audits/screens/dollywood/measure-typical-ipad-portrait-light.png` |
| Adults-only visibility (`visibleTo`) | Kids and the TV get no tile and no Home card; `#dollywood` gives a toast; chat reads and writes are refused. Guests and adults see it. By URL a kid can load it and write their own row (P2-SEC-02). | `audits/evidence/p3/dollywood/visibility.json` |
| Export lines mapped to template lines | Export 1-682 = template 1-682; 697-1033 = template −3; 1035-1742 = template −2. For example: save `:1062` = template `:1060`; import `:1101` = `:1099`; migrate `:1107` = `:1105`; the 3D handler `:1156` = `:1154`; `listItems` `:1007` = `:1004`; the phone CSS `:333`, `:359`, `:371` are the same line numbers in the template. | `audits/00-inventory.md:3962-3975`; `../dollywood-build-project/scripts/template.html:1004, 1060, 1099, 1105, 1154` |
| Date and time (midnight, DST on 1 Nov 2026, another time zone) | Not applicable: the app has no date logic. The only `Date` use is the export stamp (`apps/dollywood.html:1099`); writes are stamped by hub.js with the server skew. | `apps/dollywood.html:1099` |

## Leads from 01-leads.md

| Lead | Outcome | Where it went |
|---|---|---|
| Saved progress can be wiped by one tick on another device (`audits/01-leads.md:307`) | Confirmed; owned by Phase 2 | P2-SYNC-01 pointer (a tick during a first open's load: 24 → 1); the loading state is UX-DOLLYWOOD-5 |
| On phones the … menu cannot be used (`:312`) | Confirmed, wider (every sheet state) | P3-DOLLYWOOD-03 |
| Offline opening depends on a prior online visit (`:319`) | Confirmed | The 503 is P2-PWA-16; "no cue that ticks are queued" is UX-DOLLYWOOD-6 |
| While loading, it looks like a first-time user (`:320`) | Confirmed | UX-DOLLYWOOD-5 |
| After load, the step card ignores the saved plot width (`:321`) | Confirmed, wider (also after every change) | P3-DOLLYWOOD-07 |
| The "up to 36″" height filter hides no-requirement listings (`:322`) | Confirmed; the park map's Search runs the same line, and P3-DOLLYWOOD-LIVE-14 is a pointer here | P3-DOLLYWOOD-06 |
| On phones the "?" popover opens off the left edge (`:323`) | Confirmed | P3-DOLLYWOOD-12 |
| On iPad portrait View ▾ runs past the right edge (`:324`) | Confirmed | P3-DOLLYWOOD-13 |
| On phones, Upright then Fit leaves the park half off the right (`:325`) | Confirmed, wider (every jump) | P3-DOLLYWOOD-05 |
| Upright with Whole park zooms to Entrance & Plaza (`:326`) | Confirmed, corrected (the last-selected section) | P3-DOLLYWOOD-11 |
| A dead "N" north button on iPad and desktop (`:327`) | Confirmed | P3-DOLLYWOOD-10 |
| Show on map and Next zoom a map scrolled off-screen (`:328`) | Narrowed: on iPad portrait 261 of 738 px of the map stays visible; on desktop it is fully off-screen | UX-DOLLYWOOD-2 |
| On phones, Next unfinished leaves the sheet at peek (`:329`) | Confirmed | UX-DOLLYWOOD-7 |
| A phone's first screen shows mostly parking and hills (`:330`) | Confirmed | UX-DOLLYWOOD-3 |
| On desktop and iPad the build card is below the fold (`:331`) | Confirmed | UX-DOLLYWOOD-1 |
| Map cards run off-screen or under the sheet (`:332`) | Narrowed: iPad listing card 44 px off-screen, desktop coaster card taller than the viewport; the phone "under the sheet" part was not re-measured | UX-DOLLYWOOD-9 |
| Below 1180 px, search results appear far from the box (`:339`) | Confirmed | UX-DOLLYWOOD-4 |
| Below 1180 px the cross-section result is hard to find (`:340`) | Confirmed | UX-DOLLYWOOD-8 |
| Profile axis labels unreadable on phones (`:341`) | Confirmed (5.7 px) | VIS-DOLLYWOOD-4 |
| Glass cards and sheet too transparent over the map (`:342`) | Not checked at runtime (the rig cannot show real blur); the layers were measured | VIS-DOLLYWOOD-6 (provisional) |
| Completed steps struck through in pale grey (`:343`) | Confirmed (2.2:1 light, 3.5:1 dark) | VIS-DOLLYWOOD-1 |
| Flat green bands where the basemap does not fill the frame (`:345`) | Bands confirmed in the captures, not measured. The sub-claim that a basemap switch re-fits the phone view is refuted: the view stays `[208,770,1064,1533]` across all four basemaps (`audits/evidence/p3/dollywood/critic-basemap.json`, from the completeness critic's `critic-basemap.mjs`; the handler at `apps/dollywood.html:1032` has no fit call) | VIS-DOLLYWOOD-9 |
| The header wraps badly on iPad landscape (`:348`) | Confirmed | VIS-DOLLYWOOD-10 |
| The Scale tab refers to an "Info tab" (`:349`) | Confirmed (also by the visual check) | P3-DOLLYWOOD-15 |
| Plot width accepts implausible values (`:350`) | Confirmed | UX-DOLLYWOOD-12 |
| The "Unlisted structure" card offers an empty search (`:351`) | Confirmed | UX-DOLLYWOOD-13 |
| The 3D gesture hint is truncated on phones (`:352`) | Confirmed | VIS-DOLLYWOOD-11 |
| Park map: the compass jumps the view to the Entrance (`:315`) | Not checked here: filed in the park map's report as P3-DOLLYWOOD-LIVE-09 (medium); its build-guide cause is confirmed | P3-DOLLYWOOD-11 |

## Not verified

- Whether WebKit's GC-timed release of replaced 3D textures can cost the WebGL context on a real iPad; the counts and bytes were measured only in the rig (see Unresolved).
- 3D frame rate on a real iPad (the rig renders GL in software).
- The idle cost of the pulse and the rAF loop on a real iPad, including 120 Hz ProMotion screens.
- Real backdrop blur and glass transparency (the WebKit rig).
- iOS long-press text selection or callout on step rows, listing rows and chips.
- The Export `data:` URL download inside the installed iOS PWA.
- How long the dark viewer flash lasts on a real network (the rig loads in under 250 ms).
- SF Pro, New York and SF Rounded rendering (fallback fonts in the rig).
- Real touch gestures: pinch, sheet drag, 3D orbit.
- The phone "card under the sheet" variant of the map-cards lead (not re-measured).
- Whether any household device still holds the legacy `dollywood-build-progress-v2` key (production data was not read).
- P3-TALLY-05 in this app: build-guide ticks still queued when the guide closes (offline or on a slow link) are not sent by the shell, because `dollywood|person` is not a shell channel (`index.html:457-458`); they wait until the guide reopens on that device, and P2-SYNC-01's whole-map `progress` row can then discard them. By code; not run.
- The park-map leads (the `dollywood-live` report).

## Scripts and evidence

**Investigator** (`audits/tools/phase3/dollywood/`):
- `smoke.mjs` — opens the guide and checks it boots.
- `compliance-review.mjs` — splits the compliance hits into chrome, map, reference and park-map-only → `audits/evidence/p3/dollywood/compliance-corrected.json`.
- `layout-checks.mjs` — phone, iPad, iPad-landscape and desktop geometry: menus, popovers, Upright, search, cross-section, cards, header → `layout-checks.json`.
- `data-checks.mjs` — arms M0-M2 (migration), I1-I2 (import), L1-L2 (loading), O1 (offline), S2 (live refresh), P1 (plot) → `data-checks.json`.
- `visibility.mjs` — kids, the TV, a guest and chat → `visibility.json`.
- `perf-3d.mjs` — Chromium CDP 3D build, WebGL counts and rAF → `perf-3d.json`.
- `perf-idle.mjs` — idle main-thread cost → `perf-idle.json`.
- `visual-measure.mjs` — type scale, targets, contrast per palette, glass, radii, accent, reduced motion → `visual-measure.json`.
- `taps.mjs` — taps per job → `taps.json`.
- `repro-new.mjs` — 3D exit, feed noise, Reset → `repro-new.json`.
- `theme-hearth-dark-os.mjs` — P2-VIS-03 in this app → `theme-hearth-dark-os.json`.
- Platform counts: `node audits/tools/phase3/compliance.mjs dollywood` → `audits/evidence/p3/_compliance/dollywood.json`.

**Skeptics** (`audits/tools/phase3/dollywood/verify-<finding>-<n>.mjs`, 41 scripts, each writing `audits/evidence/p3/dollywood/verify-<finding>-<n>*.json` and the PNGs cited above):
- `verify-migrate-race-overwrites-progress-1.mjs`, `-2.mjs`
- `verify-import-accepts-any-json-1.mjs`, `-2.mjs`
- `verify-progress-menu-clipped-phone-1.mjs`, `-2.mjs`
- `verify-phone-3d-no-exit-1.mjs`, `-2.mjs`
- `verify-upright-fit-phone-1.mjs`, `-2.mjs`
- `verify-height-filter-drops-no-requirement-1.mjs`, `-2.mjs`
- `verify-plot-card-stale-1.mjs`, `-2.mjs`
- `verify-idle-pulse-cpu-1.mjs`, `-2.mjs`
- `verify-raf-loop-after-3d-1.mjs`, `-2.mjs`
- `verify-dead-north-button-1.mjs`, `-2.mjs`
- `verify-upright-whole-park-zooms-entrance-1.mjs`, `-2.mjs`
- `verify-help-popover-offscreen-phone-1.mjs`, `-2.mjs`
- `verify-view-menu-offscreen-ipad-1.mjs`, `-2.mjs`
- `verify-readout-mouse-copy-touch-1.mjs`, `-2.mjs`
- `verify-scale-copy-info-tab-1.mjs`, `-2.mjs`
- `verify-vis-scale-tab-copy-points-to-an-info-tab-that-does-n-1-1.mjs`, `-1-2.mjs` (the visual checker's copy of P3-DOLLYWOOD-15)
- `verify-3d-rebuild-texture-leak-1.mjs`, `-2.mjs`, `-3.mjs` (the refuted finding; `-3` was the tie-break)
- `verify-critic-critic-modifier-shortcuts-write-progress-1-1.mjs`, `-1-2.mjs` (P3-DOLLYWOOD-16)
- `verify-critic-critic-arrow-keys-block-page-scroll-3-1.mjs`, `-3-2.mjs` (P3-DOLLYWOOD-17)
- `verify-critic-critic-plot-clear-not-synced-2-1.mjs`, `-2-2.mjs` (P3-DOLLYWOOD-18)

**Completeness critic** (`audits/tools/phase3/dollywood/`): `critic-keys-plot.mjs` (arms `keys` and `plot`), `critic-arrows.mjs` and `critic-basemap.mjs`, with evidence in `audits/evidence/p3/dollywood/critic-keys-plot-keys.json`, `critic-keys-plot-plot.json`, `critic-arrows.json`, `critic-basemap.json` and `critic-ctrl-d-desktop.png`.

**Visual checker.** No script. It opened 44 screenshots (the Phase 1 captures under `audits/screens/dollywood/` and the investigator's PNGs) and read the investigator's JSON; its record is in the session scratchpad (`p3/vis/dollywood-check.json`), outside the repo.

**Evidence folder.** `audits/evidence/p3/dollywood/` (JSON and 1× PNGs, each under 1 MB) and `audits/evidence/p3/_compliance/dollywood.json`.
