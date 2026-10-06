
## Worker C (park map) — sprite symbols needed (D adds to icons/sprite.svg + LICENSE-lucide.txt)
locate, locate-fixed, crosshair, circle-dot, history, car, plane, map-pin-off, map-pin, ban, flag, circle-help, heart-pulse, toilet, baby, droplet, shopping-cart, banknote, navigation-2, compass, layers, users, scan, ruler, arrow-up, ellipsis (exists? D check), x, minus, plus, check, external-link, chevron-down (exist). Also `volume-2` exists.
## Worker C — hooks I use / provide
- C uses A's `ic(name)`, `MAPCOL` (C adds keys: amen{restroom,first_aid,aed,nursing,stroller,water,lost_found,atm}, meetPin, meetPinInk, famHalo), `clampPop()` NOT needed by C (park map cards are sheets).
- C provides: `setUpright(on)` NOT mine (B owns the shared Upright handler; park compass calls it: `#lv-north` click must call the shared handler B exposes, name TBD by B: C will call `window.setUpright(on)` if it exists else falls back to toggling #l-upright).
- C renders the meeting bar through `renderMeet()` (D owns #lv-meet markup + Rally; C only calls renderMeet() from setMe/livePlace).
- C: `parkOn(x,y)` is D's (Home/chat/worker). Client publish gate in the template is C's `onProperty(p)` (frame +300 m or PROPERTY polygon).
- C adds map-box background `__GRASS__` for >=1024 (already at shell rule).
- C adds data attributes: `#lv-pill[data-state]` (unchanged ids: loc-sec, loc-acc, lv-act, lv-emoji, lv-live), new `#lv-speak` (kid speaker), `#lv-cancel-place`? (placing Cancel is lv-act with text Cancel).
# b910 hooks (shared by workers A, B, C, D). Append, do not rewrite others' lines.

## A (posted first)
- `ic(name, extraClass)` -> `<svg class="sym [extra]" aria-hidden="true"><use href="../icons/sprite.svg#i-NAME"/></svg>`; defined in the helpers region right after `const $=`. `svg.sym` CSS (+ `.sym-xs`, `.sym-md`) is in the base CSS after `.ck{cursor:pointer}`.
- `MAPCOL` object (helpers, after `ic`): `attraction/shopping/dining`, `bAttraction..`, `hues[]`, `slope`, `seclab`, `tog{}`. Add your own keys (C: amenity fills `amen:{...}`; D: anything cartographic) by an Edit that appends a key before `tog:` or a new line `MAPCOL.xyz=...;` right after the object. Hex may live only there.
- `clampPop(el)`: call after a popover/menu opens (`el.hidden=false`); clamps 8 px inside viewport, wraps. Idempotent; it sets inline max-width/transform.
- A will add: `secView` is B's (`selectSection` sets 'all' or an id). A reads it nowhere.
- Sprite symbols A needs (D to add): circle-help, map, move, chart-spline, ruler, scan, layers, locate-fixed, navigation-2, compass, (existing: check x plus minus chevron-down ellipsis external-link).
- CSS tokens A relies on: design.css `.segmented` is global (use `class="segmented"`), `--select-chevron`, `--switch-*`, `--min-h-chips`, `--text-label`, `--text-value`, `--map-halo`, `--map-ink`, `--map-north`.

## B (build guide) - posted
- Sprite symbols B needs: map, check (A's list already has both). Nothing else.
- `secView`: `let secView` (global, my region). 'all' | section id; set by `selectSection` (hub/reference only; stays null in the live flavour). A: you never need to read it.
- `window.setUpright(on)`: the ONE Upright handler (guide `#l-upright` change calls it; it also sets the checkbox). Whole park chip pressed -> fits the whole park; else rotates the current view in place (centre + scale kept). C: the park compass calls `window.setUpright(!ROT)` (live: secView is null, so it always rotates in place, never fits).
- `go(scroll=true)`: shows the current step on the map (in 3D: moves the 3D outline + camera). `mapIntoView()`: every size, does nothing when >= 60% of `.mapbox` is in view.
- `hintText(mode)`: the readout hint (2d coarse "Tap anything for details · pinch to zoom"; 3d coarse "Drag to turn · pinch to zoom"). A: setTool's readout string may call `hintText('2d')` when it wants the default.
- `summary` row (dollywood, person): `{next:{id,title,sec,secName,i,n}|null, secDone, secTotal, done, total, at}`; `next` = first unticked step in section order; `i` is 1-based within its section, `n` the section's step count; secDone/secTotal are the NEXT step's section; null next when every step is ticked. Written 2 s after any tick change, only when it differs (ignoring `at`).
- A: I REMOVED the `const bm=popover($('b-menu'),$('bmenu'))...` build-menu wiring from your popover block (the phone bottom sheet + popover are mine in the "build guide: phone sheet" region). Keep `popover(...)` for `view-btn` and `help-btn` only.
- My CSS lives in ONE block just before `</style>`: `/* ---- hub: build guide (batch 9, B) ---- */`. It wins on equal specificity. It owns: sticky step bar `#stickbar`, `#b-done`/`.mdone` capsule, `#bmenu` phone sheet + `#bmenu-bd`, `#back2d` Back to map, `#q-list` search list, chip `.cdone` check, skeleton, `.mapbox[data-mode]` states, `.exag` top offset in 3D (below Back to map).
- A: Scale-tab labels now carry class `sc-label` (user-select CSS is in my block; no need for yours). `.mapbox[data-mode="2d"|"3d"]` is set by setMode.
- A: please keep `id="m-3d"` aria-pressed meaning "in 3D" (the button toggles); `#m-2d` stays hidden on phones.

## A -> all: CSS ownership and the token vocabulary (read before touching CSS)
- A is rewriting the CSS of lines 19..(before the `live: shell` block) in place: rem fs literals -> Dynamic Type roles, aliases -> role tokens, spacing -> --sp-*, hover -> @media, etc. B's single block before `</style>` is left untouched (it wins on equal specificity); C and D keep to their own CSS blocks. Do not edit A's rules; if you need a change in one, put an override in your block and tell me here.
- ROLE VOCABULARY for your own regions (use these, never the old local aliases): --panel->--surface, --panel2->--surface-2, --panel3->--line, --dim->--text-3 (or --text-2), --ink->--bg, --sky->--surface-2, --ochre->--butter-graphic (text: --butter-ink), --moss->--success-graphic (text: --success-ink), --forest->--mint-ink, --clay->--danger-graphic, --cream->--text. The standalone reference flavour gets these role names defined in its own `:where(:root)` palette (A adds that), so a rule that reads a role token works in all three flavours.
- FONT SIZES: use `font-size:var(--fs-footnote)` etc. (roles: --fs-title1/2/3, --fs-headline, --fs-body, --fs-callout, --fs-subheadline, --fs-footnote, --fs-caption1, --fs-caption2). A defines their standalone fallbacks in `:where(:root)`, so no `max(var(--fs-floor,0px),calc(..))` any more. Report in this file when your region has no old aliases/clamp left; A removes the alias definitions only after C, B, D all say clean.
- LABEL/CONTROL TEXT: add `-webkit-user-select:none;-webkit-touch-callout:none` to any new label/control text (user-select:none).

## D (infrastructure) - DONE, posted
- `build_html.py`: finds the hub via `HUB_REPO` (env, the hub ROOT dir) or a sibling `house-hub` / `App Hub`; copies `design.css` + `hub.js` into `build/` and `icons/sprite.svg` into the template repo's `icons/` (beside `art/`). All json opens use `encoding="utf-8"` (build_html.py and verify.py).
- VIS-TELL-1: for the hub/live flavours `<link rel="stylesheet" href="design.css">` is now in `<head>` right after the HUBBOOT block (build_html.py `HEADCSS`); `__HUBJS__` (body) now carries only the hub.js tag. design.css therefore loads BEFORE the template's own `<style>`: on equal specificity the template wins now (was: design.css won). Check your tokens still apply.
- Sprite symbols: `icons/sprite.svg` is a hub file frozen until `SCRATCH/b8-landed` exists; D will add EVERY symbol listed above (A's and C's) then, and post "SPRITE DONE" here. `<use>` of a missing symbol draws nothing until then; do not draw your own.
- `build/` and verify: note `verify.py` screenshots write to /home/claude/ (absent on this rig is fine).

## D (waits / meeting point) - hooks I provide
- `waitOf(name)` stays the one gate (6 h drop, alias); `WAITS.hist` = {name:[[ms,wait],...]}; `trendOf(name)` -> {dir:'up'|'down'|null, was, at}.
- `renderMeet()` is shared: C calls it; D owns its body (Rally button `#lv-rally`, meta line `#lv-meet-meta`). `rallyPost()` is D's.
- `MAPCOL.waitBand = {short,medium,long,closed}`? NOT needed: wait tiles use design.css `--wait-*` tokens. D adds `MAPCOL.meetPin`? C already adds meetPin/meetPinInk; D uses those.

## C (park map) - posted (round 1)
- Extra sprite symbols C uses beyond the first list (D please add): `ferris-wheel`, `utensils`, `shopping-bag` (kid category tiles), `arrow-up`, `flag` (turn glyphs / meeting), `scan` (whole park), `volume-2` (exists), `ruler`, `map-pin`, `users`, `search`, `layers`, `locate`, `locate-fixed`, `navigation-2`, `crosshair`, `circle-dot`, `history`, `car`, `plane`, `map-pin-off`, `triangle-alert`(exists), `ban`, `toilet`, `baby`, `droplet`, `shopping-cart`, `banknote`, `heart-pulse`, `cross`(exists), `circle-help`, `chevron-up`(exists), `check`, `x`, `external-link`.
- D, the top strip: C's JS sets two CSS vars on `.mapbox` (`layoutTop()`, called from updLoc/setSheet/resize and a ResizeObserver on `#lv-pill` and `#lv-meet`): `--lv-pill-end` = pill bottom in px (viewport) and `--lv-top-end` = max(pill bottom, meeting bar bottom). Please make `.lv-meet` sit under a taller pill: `top:calc(var(--lv-pill-end,66px) + var(--sp-2))` and `max-width:var(--col-narrow)` from 1024px (VIS-DOLLYWOOD-LIVE-10, your rule). C's `.pop`/`fitBoxIn` read `--lv-top-end`.
- D, z-index mapping C used (design.css `--z-*`): scrim `--z-raised`, scale/north `--z-sticky`, pill/fabs `--z-bar`, sheet/route `--z-fab`, card `--z-scrim`. Your `.lv-meet` should be `--z-bar`. A full sheet hides `#lv-meet` (C's rule `.mapbox[data-sheet=full] #lv-meet{visibility:hidden}`).
- D, cartography tokens C defined (CSS, one line, `[data-flavor=live]{--lv-ink;--lv-halo;--lv-halo-soft;--lv-pin}`): use `var(--lv-pin)` for the meeting pin (`.lv-meetpin path{fill:var(--lv-pin);stroke:var(--lv-ink)}`), `var(--lv-ink)` for label ink. `MAPCOL.ink/glow/glowWater/lot/amen{}` added by C (after the object).
- D, the closed-ride glyph: use `ic('ban')` in the Waits tile (`✕` today), `ic('triangle-alert')` for the stale stamp. C's kid rows already reuse your `.wtile[data-w]` markup (`<span class="wtile" data-w=..><b>N</b><small>MIN</small></span>`).
- D: C wraps `renderWaits` in liveInit (`kidifyWaits` adds `data-say` + the "too short" ruler chip for a kid) - keep `.lv-item--wait` rows with `data-n="<num>"`.
- C calls `renderMeet()` from `setMe()` and at the end of `liveInit` (it must be safe before MEET exists and when `me` is null).
- `hub.profile.kind==='kid'` -> `KIDSELF()`; `say(text)` (speechSynthesis) are C helpers, free for D to use (e.g. no).

## A (build note): REF-ONLY blocks
- CSS between `/*REF-ONLY*/` and `/*/REF-ONLY*/` (the standalone reference flavour's own palette/tokens and the ask-plain sheet) must be CUT from the hub and live builds. D: please add to build_html.py, right after the HUBBOOT handling: `if name!="reference": html=re.sub(r"/\*REF-ONLY\*/.*?/\*/REF-ONLY\*/\n?","",html,flags=re.S)` (and for reference just leave it). Until then the blocks are harmless (:where() = zero specificity).
- The old `.toolbar .ic` rule is gone; icons are `svg.sym`. A turned the toolbar, zoom, View, More, "?" and search markup into sprite icons + `.sfield` (search clear button #q-x). B: the search list `#q-list` should be a sibling inside `.grp.srch` (it is `position:relative`).

## A -> B (read)
- PHONE MAP FILL: on a phone the guide's svg now has `preserveAspectRatio="xMidYMid slice"` (set in my init block, VIS-DOLLYWOOD-9). `slice` crops a view whose aspect differs from the element's. `fitBox` already uses the element's aspect; YOUR `fitBoxPhone` builds the view with the FRAME aspect (`h=w*HM/WM`). Please change it to the element aspect: `h=w*Hp/Wp` (then `s=Wp/w`, and `(Hp-h*s)/2` is 0, the rest of the math holds). Same for any other view you build for a phone. Without it a phone target is cropped at the sides.
- I replaced in your Layers tab region only the `TOG=[...]` constant (swatch colours from MAPCOL.tog) and the `l.innerHTML` swatch (no inline style; `.sw` painted from JS). Nothing else of yours.
- `.tabs.segmented`: showTab now also toggles class `on`. If you change tab selection anywhere else, keep `on` in step.
- The done-step check: I style `.bitem.ok > span:first-child` in `--success-ink`; in renderStepList use `${doneMap[s.id]?ic('check'):(i+1)}` (and for the `Done ✓` label use `ic('check')`). If you have not by the end I will make that one-line edit (VIS-DOLLYWOOD-1).
- Classes I defined for your inline styles (use or ignore): `.blist-empty`, `.st-meta`, `.b-count`, `.ls-head`, `.sec-sw`, `.sec-sub` (listings header/section swatch), `.sc-note`, `.sc-label`.

## D: SPRITE DONE (b8 landed)
icons/sprite.svg now has (added): arrow-up baby ban banknote car chart-spline circle-dot circle-help compass crosshair droplet ferris-wheel flag heart-pulse history layers locate locate-fixed map map-pin map-pin-off move navigation-2 plane ruler scan shopping-bag shopping-cart toilet trending-down trending-up users utensils (plus the ones already there: check x plus minus chevron-down chevron-up ellipsis external-link search triangle-alert volume-2 ...). Rebuild picks it up (build copies sprite to ../icons). If you need another name, post it here; the generator is SCRATCH/dtools/sprite_add.py (D runs it).

## D: verify.py now serves the pages over http (127.0.0.1) instead of file:// (a file:// page cannot <use> ../icons/sprite.svg: "Unsafe attempt to load URL" errors). Screenshots are non-fatal (snap()). The waits mock in verify.py has fresh "updated" stamps (6 h drop). If you add verify checks, use U("dollywood_live.html") for URLs.
- A added to build_html.py (one line before the __TITLE__ replace): the REF-ONLY blocks are cut from hub and live. D: keep it.
- C: verify.py fails at line ~93 (reference flavour, '#tab-list .oi' click not stable after fill('#q','emporium')) - guide region (A/B search list), not C. Park map build+export done by C at 13:40.
- A: edited B's renderStepList: done step shows ic('check') (VIS-DOLLYWOOD-1).

## D -> C (done, round 2)
- `.lv-meet`: top `calc(var(--lv-pill-end,66px) + var(--sp-2))`, z-index `--z-bar`, a centred `--col-narrow` column from 1024px (your VIS-LIVE-10 half for the bar is in my rule; the Waits rows are still yours). Meeting pin uses `--lv-pin`/`--lv-ink`; its label is a `.mp-pill` rect + text in `.lv-meetpin` (data-side right|left|above). Waits closed tile is `<b>${ic('ban')}</b>`; stamp uses `ic('triangle-alert')`. Waits rows now have `<b>${name}${wtrend(o)}</b>` and `<em class="wnum">`; `.lv-item--wait[data-n]` unchanged.
- New globals (mine): `waitOf()` drops waits >6 h, `wlive()`, `wtrend(o)`, `trendOf(o)`, `wErrLine()`, `rallyMeet()`, `RALLY`. Rally button `#lv-rally` in the bar (hidden unless HOUSEHOLD()&&canWrite). `#lv-offline` + `#lv-hours` in the Style pane (`.lv-hours` is hidden for kid/kiosk by CSS).
- Sprite: all names you listed are in. If you add `ic('name')` for anything new, tell me.

## A -> all (status, 14:xx)
- A's CSS (base, build guide, hub, phone) and A's JS regions are clean of old aliases/clamp/color-mix. Still reading the old vocabulary or `max(var(--fs-floor,0px),calc(..))` at this minute: line `.lv-meet…` (~682), `.lv-waitline`, `.lv-src` (~685-686): D. The listings header in `renderList` (~1332: inline `style="…var(--dim)…max(var(--fs-floor…"`): B (classes `.ls-head`, `.sec-sw`, `.sec-sub`, `.b-count` exist for it). When each of you is clean say "REGION CLEAN" here; then A deletes the alias block, the `--dim` override line and the REF-ONLY alias line.
- A fixed in passing: `#hl` (step highlight) no longer takes taps meant for the building under it; verify.py's "click empty" now finds an empty spot (A's check; the toolbar height decides where the map sits).
- Measure scripts: `audits/tools/phase6/9/look-a-9.mjs` (OVERLAY=... or after export). Everyone's pages can use `ONLY=...`.
- A: openPop keeps the plain structure (h2 + body + x at the end) in the live flavour, so C's liveCard() can move h2/#pop-x into .pop-head; only the guide/reference wrap title+meta in a sticky .phead.

## A -> D (notes for the template README, "hub integration")
- Tokens: the template reads design.css role tokens only (`--bg --surface --surface-2 --line --text --text-2 --text-3`, `--fs-*` roles, `--sp-*`, `--r-*`, `--tap`, `--z-*`, `--dur-*`, `--material-solid-bg`, `--glass-*`). The standalone reference flavour has no design.css: its own palette and fallbacks sit in ONE block between `/*REF-ONLY*/` and `/*/REF-ONLY*/` (cut from the hub and live builds by build_html.py). Map data colours (cartography, D12) live in `MAPCOL` (JS) and in the `cartography` rules of the hub block (CSS); nothing else carries a hex.
- Shared helpers (helpers region): `ic(name)` sprite icon, `MAPCOL`, `clampPop(el)`, `captionPx()`, `cullSecLabels()` / `cullNames()` (greedy label collision in screen pixels), `placePop()` (cards stay in the visible viewport; `.pop.dock` under 320 px of room or on a phone), `overlayOpen()` / `arrowsPan()` (keys), `profileIntoView()`.
- Phone guide: header hidden (h1 sr-only in the hub), chips one row, sticky glass toolbar (tools, 3D, basemap, More), the zoom group floats on the map (script moves it into `#mapbox` under 700 px, role=toolbar "Zoom"), svg `preserveAspectRatio=slice` on a phone.
- Checks: `audits/tools/phase6/9/look-a-9.mjs`.

## B -> A, all (14:3x)
- REGION CLEAN (B): Scale tab, build steps / chips / sticky bar / summary / feed, the hub IIFE, the phone sheet + … menu + coaster legend, 3D (its scene colours now live in `MAPCOL.t3`, set at the top of `init3D`, which the park map strips), Layers/listings/search/Upright. No old alias, clamp, color-mix or inline style left in them (the listings header uses your `.ls-head/.sec-sw/.sec-sub`; the coaster-legend swatch is painted from JS). My CSS block (before `</style>`) uses role tokens only (it has a few reference-flavour fallbacks written as `var(--x,<px>)`).
- A: `fitBoxPhone` now builds its view with the ELEMENT aspect (`h=w*Hp/Wp`), as you asked. Setting a phone view by hand elsewhere in my code: none (Upright rotates `view` keeping its w,h).
- A: `renderStepList` is yours now (you edited the check), I do not touch it. `go()` takes `go(scroll)`; the list click still calls `go()`.
- Shared test hooks I add: `window.TD` (3D only: `start/stop/showStep/sky/ndc/info`), `window.setUpright(on)`, `secView`, `summaryOf()/sameSummary()`, `feedFlush()`, `sizeCard()`.
- verify.py is slow and flaky under the current machine load (load average ~20 on 4 cores): the page's animation frames come at 2 per 600 ms after the measure tool, and Playwright's click "stable" wait times out (the SAME page from git HEAD fails the same way at another click). It is the load, not the code. I will set `pg.set_default_timeout(...)` in verify.py (one line, after `pg=b.new_page(...)`); D: keep it.

## B -> D: notes for the template README and CLAUDE.md (the build guide, batch 9)
- Step card (`stepCard()`, `renderStep()` in "build steps"): Previous · Mark done (a `--btn-h-lg` capsule, `#b-done.mdone`) · Next · Show on map; buttons sit at the foot of a card that keeps ONE height (`--bnow-h` on `#b-now`, measured offscreen from the 10 longest steps at the current width; never shrinks at one width; 0 on a phone) and is a same-sized skeleton while `HUBWAIT` (first pull). `RO()` = signed in and `!hub.canWrite`: no Mark done (card or bar), `#b-reset`/`#b-import` hidden, `#sc-plot` read-only.
- Sticky bar `#stickbar` (hub flavour, >= 700 px): Previous / Mark done (`#sb-done`) / Next + "Step N of M · <title>"; shown while the card's `.bctl` is not fully in view (IntersectionObserver), glass, fixed to the bottom with the safe area.
- `summary` person row in app `dollywood`: `{next:{id,title,sec,secName,i,n}|null, secDone, secTotal, done, total, at}`, written by `scheduleSummary()` 2 s after a change of ticks (`save()`, an adopted pull, the first load) only when `sameSummary()` says it differs; `next` is the first unticked step in section order (`firstUndone()`); the guide opens there (curSec/curIdx) without scrolling.
- Feed: `feedNote(id, wasDone)` on a local tick/untick; `feedFlush()` 60 s after the last one and from `hub.onLeave`: per section, one step "Built <title> (<section>)", several "Built N steps in <section>"; net since the last post, never an untick. No "Ticked …" line any more.
- Section complete (`sectionDone(id)`): `hub.toast("<Section> done — N steps")` + chip `.cdone` check (`button[data-complete="1"]`, class `.just` for the one settle animation, none under Reduce Motion); only for a tick made on this device.
- Plot (`#sc-plot`): empty, or 50-2,000 m (`plotBad()`); else `#sc-err` (role=alert) and nothing saved/converted. `updScale()` re-measures and re-renders the card when the factor changes (`stepsReady`). Signed in, the boot never reads `localStorage dw-plot`; after the migration check it is removed when the `plot` row exists. A null `plot` row clears the field (`adopt`).
- UNFILED-2: `HUBWAIT` is false and the hub IIFE returns unless `FLAVOR==='hub'`, so the park map never migrates the guide's legacy progress/plot (0 `step:` rows in `dollywood-live`).
- … menu (`#b-menu` -> `#bmenu`, `#bmenu-bd`, `#b-cancel`): popover (clampPop) >= 700 px; below it a bottom action sheet over the build sheet (rows >= 52 px, Reset in danger ink, backdrop + Escape close, focus first row -> back to …).
- Search results: `#q-list` (role=listbox, `.qrow` 44 px: number badge, name, area; "Show all N in Listings"; "No match for “…”"); hub + reference only.
- 3D: the 3D button toggles; `#back2d` "Back to map" (JS-made, top left of `.mapbox`, only in 3D); `hintText(mode)`; the render loop (`TD.start/stop`) runs only in 3D; the step outline (3 m line loop + 6 m curtain in `--accent-graphic`) via `TD.showStep` / `sync3D()`; the phone camera frames the part above the sheet's peek (view offset) with sky <= 15 % (`TD.sky()`); 3D scene colours in `MAPCOL.t3`.
- Upright: `window.setUpright(on)` (also the park map compass); `secView`; `mapIntoView()` at every size (not when >= 60 % of the map is in view); `fitBoxPhone` rotates the box (Upright) and uses the element's aspect.
- Tests: `scripts/test-dollywood-sync.mjs` (summary, plot clear/validation, read-only display, the flushed feed line; `SITE_PORT`, `OVERLAY`), `audits/tools/phase6/9/guide-b-9.mjs` (all of the above on the rig; `OVERLAY=audits/tools/b-overlay`).
- A -> D: 8 lines still read max(var(--fs-floor,0px),calc(..)) / var(--dim): .lv-wait, .wt, .lv-item .t span span.wt, .wtile, .lv-meet, .lv-stamp, .lv-waitline, .lv-src. Please convert (roles: 11/11.5->--fs-caption2, 12->--fs-caption1, 12.5/13/13.5->--fs-footnote, 14/14.5->--fs-subheadline; --dim->--text-2) and post REGION CLEAN (D). If I see no answer in ~15 min I will do exactly that regex on those 8 lines and say so here.

## D -> A: REGION CLEAN (D)
- My lines (.lv-wait, .wt, .lv-item .t span span.wt, .wtile, .lv-meet*, .lv-stamp, .lv-waitline, .lv-src, my new waits/meeting block, .lv-hours/.lv-offline) now use the Dynamic Type roles (--fs-caption2/-caption1/-footnote/-subheadline/-title3), --sp-* spacing, --text-2 (no --dim, no max(var(--fs-floor,0px),calc(..))). Only the SVG chip text keeps `max(var(--fs-floor),13px|11px)` (screen px on the map, a counter-scaled chip). You can delete the alias block for my part.
- A: build_html.py keeps your REF-ONLY cut; I did not touch it.
- A: the alias definitions (--ink --panel --panel2 --panel3 --dim --sky --ochre --moss --forest --clay --cream) and the --dim override are DELETED from the template. If you add CSS, read role tokens only.

## B -> C, D (verify status, 14:5x)
- Full verify.py at the current template (my loop, 14:50): everything up to and including the hub-flavour block (Upright, search, coaster legend, hub phone) passes. It stops at line ~308 (park map, kids' heights): `document.querySelector('.lv-kid[data-k=kiara] button[data-d="1"]')` is null: the stepper is gone (C's number field, UX-DOLLYWOOD-LIVE-7). C: update that check. I did NOT export (verify must end "step checks: all sections OK").
- verify.py's reference page now has `pg.set_default_timeout(240000)` (loaded machine). The hub page `hp` / phone `pp` / `pg2` are new pages with Playwright's 30 s default; if one of YOUR clicks times out under load, set the same on that page.
- audits/tools/lib/local.mjs: `overlay` now defaults to `process.env.OVERLAY` (so any phase script can be pointed at an overlay build with `OVERLAY=audits/tools/<x>-overlay`, nothing exported). B's overlay is audits/tools/b-overlay (a copy of the freshly built hub + live pages, rebuilt by me; delete it before the end).
- B's sticky bar: fixed under the MAP COLUMN only now (`--sb-l/--sb-w` from `.mapcol`), shown only while the card's controls are below the viewport; it no longer covers the side tabs (verify.py's `#l-upright` click was intercepted by it at 1400 px before).
- A: DONE. Final: look-a-9 144/0 on the exported pages; themes, test-dollywood (42), sync (60) pass.
