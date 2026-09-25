# Phase 4 measurement rig

Phase 1 took pictures. This rig **measures** the same screens. It runs every screen definition in `audits/tools/areas/*.mjs`, with the same states and the same `t` helpers that `capture.mjs` gives them. After each screen's `go()`, settle and `after()`, it measures the shell page and every same-origin frame (the app iframe `#frame`, offset into page coordinates). It writes one JSON per job. `aggregate.mjs` turns those files into small committed summaries.

```bash
# measure, in chunks that fit a 9-minute call (resumable: rerun until it prints "nothing left to measure")
timeout 540 node audits/tools/phase4/measure.mjs --run themes,states,devices --parallel 8 --max-minutes 7.5
# summarise (--out DIR writes the summaries elsewhere, as a dry run)
node audits/tools/phase4/aggregate.mjs
```

**Rig version.** Each raw file carries `v`. Version 2 (2026-09-24, after the independent rig check `rigcheck-1.mjs`) adds three changes:
- the text occlusion grid;
- `nontext.graphics[]`;
- in `aggregate.mjs`, icon-only controls with a passing icon are no longer counted as boundary failures.

`measure.mjs` treats a raw file of an older version as still to do and overwrites it in place, so readers never see a gap. `aggregate.mjs` skips such files and lists them in `coverage.json → stale`.

| File | Role |
|---|---|
| `measure.mjs` | The job planner and runner. The harness is copied from `capture.mjs`: the local server, sessions, the init script, the loading/offline/error handling and the `t` API. It imports `lib/devices.mjs`, `lib/local.mjs` (Playwright) and `seed/story.mjs` read-only. |
| `measure/page-lib.mjs` | The in-page library (`window.__m4`), installed in every document. It is derived from `phase2/VIS/lib-vis.mjs`. |
| `measure/server-guard.mjs` | Runs `lib/server.mjs` unchanged in-process and exits when its parent dies, so a killed lane leaves no server behind. |
| `aggregate.mjs` | `raw/` → the summaries in `audits/evidence/p4/measure/*.json` |

## Options (`measure.mjs`)

| Option | Meaning |
|---|---|
| `--run themes,devices,states` | Which matrix (default `themes`) |
| `--area`, `--file`, `--screen`, `--state`, `--device`, `--mode`, `--theme` | Filters. Each takes a comma-separated list. |
| `--parallel N` | Number of lanes. Each lane has its own `lib/server.mjs` and its own WebKit. Default 4; 8 used. |
| `--max-minutes N` | Stop taking new jobs after N minutes. Jobs already running finish; each has a hard 150 s timeout (`--job-timeout`). |
| `--list`, `--plan-json` | Print the jobs still to do, or the whole plan as JSON |
| `--retry-failed`, `--force` | Rerun failed jobs, or rerun everything. By default a failed job is retried once. |
| `--verbose` | Log every job |

## The matrix (3,662 jobs)

| Run | State | Device | Themes |
|---|---|---|---|
| `themes` (1,721) | typical | iPad portrait. A screen that does not list iPad portrait uses its first device: the TV board uses `tv`, `steps-full` uses `iphone-pwa`. | system × light OS, system × dark OS, parchment, frost, midnight, forest (light OS), hearth × dark OS (the P2-VIS-03 case) |
| `devices` (1,424) | typical | iphone-pwa, ipad-landscape, desktop, and tv where the screen lists it (minus the device the themes run used) | system × light, dark |
| `states` (517) | empty, overflow, loading, offline, error (as each screen lists them) | as the themes run | system × light, dark |

Screens restricted to one mode (`modes: ['light']`, e.g. the print views) skip the other mode. The `me-theme-*` screens pick a theme by tapping, so they run in the system theme only.

**How a theme is applied.** Every job starts from a freshly reset database. For a named theme, every non-kiosk profile gets `app_data(person,'hub','theme')` through `PUT /api/data/hub/theme?scope=person` as that profile, and the browser starts with `localStorage['hub.theme'] = JSON.stringify(theme)`. The server row wins after the first pull (`apps/hub.js:96-104`). The kiosk keeps its local theme. The result is in `themeRows`. What actually applied is in each document's `meta` (`data-theme`, `data-scheme`, `data-kind`, `hub.theme()`), and `coverage.json → themeApplied` shows it next to the resolved `--bg`. Hearth on a dark OS reports `scheme=light`, but `--bg` resolves to `#1A1512`: that is P2-VIS-03, reproduced.

## Output

- **Per job:** `audits/evidence/p4/measure/raw/<run>/<area>/<screen>-<state>-<device>-<mode>-<theme>.json` (git-ignored, about 0.5 GB in all).
- **Stylesheets:** `raw/_css/<document>.json` holds each document's declared transitions, animations and keyframes, once per document.
- **Screenshots:** the named themes also get a 1× CSS screenshot at `audits/evidence/p4/measure/shots/<theme>/<area>/<screen>-<state>-<device>-<mode>.png` (git-ignored), because Phase 1 captured only System. The mode in the file name is the OS mode; `hearth` is always `-dark`.
  - The satellite and park maps can exceed 1 MB. Before citing one as evidence, copy or crop it below 1 MB into `audits/evidence/p4/<DIM>/`.

### Fields in each job's JSON

**Top level:** `run`, `area`, `screen`, `state`, `device`, `mode`, `theme`, `variant`, `profile`, `ok`, `error`, `goError`, `ms`, `themeRows`, `console`, `sweep`, `stacks`, `attempts`.
- `goError`: the screen script threw, but the screen was measured anyway, as `capture.mjs` still shot it.
- `sweep`: `{steps, scrollers[], truncated, docsVisible}`.
- `stacks`: the font-family stacks, which `text[].stack` indexes.

**`docs[]`:** one entry per document, `page` or `frame:<app>`.

| Field | Contents |
|---|---|
| `offset` | Iframe content-box offset, size, visibility and scale |
| `meta` | `theme`, `scheme`, `kind`, `hubTheme`, `lsTheme`, `profile`, `accent`, `vw`, `vh`, `dsBody` |
| `tokens.design` | Every custom property named in `apps/design.css`, resolved on `:root`: `{raw, rgba?, px?, ms?}`. Colours are probed through `color: var(--x)`, lengths through `margin-left`, times through `transition-duration`. |
| `tokens.local` | The document's own custom properties |
| `boxes.radii` | Painted elements with a radius: radius, pill flag, size, padding, and the nearest rounded painted ancestor's radius and padding |
| `boxes.concentric` | Child and parent corner pairs: inset, wanted radius, offset, ok |
| `boxes.shadows` | Distinct `box-shadow` values with example selectors |
| `boxes.spacing` | Padding, margin and gap values with counts |
| `margins` | Left and right side margins of the outermost non-full-bleed, uncovered content. In an app job the page's margins are those of the shell pill. |
| `glass` | Every element with a `backdrop-filter` or a glass recipe class: `bf`, area, `occluded` (no part painted on top at 5 sample points), visible area (0 when occluded), position, chrome flag and `why` |
| `motion` | Computed transitions and animations, plus keyframes |
| `targets` | Every interactive element: size, effective size including an absolute `::before`/`::after`, `small`, `inline`, `disabled`, `onscreen`, `visible` (on screen and not covered) |
| `tells` | Histograms of tap highlight, `user-select`, touch callout and `touch-action` on interactive chrome, with offenders; `root` (html/body overscroll and backgrounds); `scrollers` (overscroll, `vbar`/`hbar` px); `forms` (appearance); `links` |
| `declRules` | The number of source rules parsed for the properties this build does not compute |

**`text[]`:** one entry per text box in any document: every element that directly holds text, plus input values and placeholders.

| Field | Contents |
|---|---|
| `doc`, `kind`, `sel`, `text` | Document, kind, selector, and the first 60 characters |
| `tag`, `role`, `ia`, `iaSel` | Tag, role, whether it is interactive, and the interactive ancestor |
| `ff`, `ffr`, `stack` | The declared first family, the first family this browser has, and the stack index |
| `fs`, `fw`, `lh`, `ls`, `tt`, `fvn` | Size, weight, line height, letter spacing, text transform, numeric variant |
| `color`, `op`, `tok` | Colour as rgba, ancestor opacity, and the tokens whose resolved value equals the colour |
| `bg` | The nearest declared background, with its tokens |
| `glass`, `large`, `rect`, `lines` | Inside glass, large text, the first line box and the line count |
| `measured`, `step` | Whether the sweep measured it, and at which step |
| `cover`, `cols` | Rig v2. The share of the text's in-viewport occlusion-grid columns that something else covered when it was measured (0 = fully on top), and the number of columns. An unmeasured text that was on screen but more than half covered at every step has `occluded: true` and its lowest `cover`. |
| `p10`, `med`, `bgP10`, `bgMed`, `alpha` | Rendered contrast and backgrounds |
| `req`, `aa`, `aaMed` | The required ratio, and whether p10 and the median meet it |

**`nontext.icons[]`:** svg icons up to 64 px (96 px inside a control), `<img>` inside controls, and emoji used as icons inside controls, tiles or chips. `ratio` is the p90 contrast of the icon's own pixels against the pixels under them; `ratioMed`, `ink` (pixel share), `inkRgb`, `bgMed` and `pass` (≥ 3) follow.

**`nontext.controls[]`:** buttons, `[role]` controls, inputs, selects, switches, chips and `.btn`. Each has `kind` (button, field, toggle, chip), `bw`/`bc` (border), `fill`, `hasText`, and:
- `fillRatio`: sampled 2 px inside against 3 px outside the edges.
- `borderRatio` (computed) and `borderRendered` (sampled).
- `boundary`: the maximum of these.

**`nontext.graphics[]`** (rig v2): information-bearing shapes that are neither icons nor controls (WCAG 1.4.11). Each has `kind`, `sel`, `rect`, `paint` (computed rgba) and `alpha` (paint alpha × ancestor opacity), `per` (each adjacent group: its median pixel `adj` and `ratio`, plus `best`/`worst` for gradients), `ratio` (the best group), `ratioMin` (the worst group) and `pass` (`ratio` ≥ 3).

| Kind | What | Compared with |
|---|---|---|
| `ring` | A solid spread `box-shadow` (no blur, no offset, spread ≥ 1.5 px) or an outline on a small hinted or repeated shape: `.days span.today`, `.ygrid .cur`, `.heat .today` | Pixels 3 px outside the ring on each side; `ratioInside` = against the shape it rings |
| `bar` | A painted fill inside a painted track that is ≤ 24 px thin: `.bar > i`, `.jbar i`, `#meterFill` | The visible part of the track, or the surround 3 px outside the track when the fill is full; `fillShare`; `trackVsSurround` = track against the surround |
| `dot` | A small painted shape (≤ 64 px, or ≤ 8 px thin), with at most 3 characters of text, hinted by its class, its parent's class, `--p` or a role, or one of ≥ 5 same-tag siblings: day dots, grid cells, heat squares, stripes, `--p` columns, swatches | Pixels 3 px outside each side. `shadow` keeps any box-shadow (e.g. an inset ring). A track that holds a painted fill is reported through its `bar`. |
| `stroke` | A stroked svg circle, ellipse or path in a ring, dial, gauge, progress, meter, chart, donut or spark graphic, or one with a role of img, progressbar or meter. Maps are excluded (svg > 420 px on its short side, or more than 60 shapes), and so are glyph paths in svgs under 40 px. | For circles, 12 points 3 px outside and 3 px inside the stroke band (`outer`, `inner`); for other shapes, 3 px outside the box. `vsTrack` = an arc against the track circle under it; `drawn` = the share of the arc drawn (dash offset) |

Gradient paints (`gradient: true`) are read from the screenshot: `ratio` is the median over the paint pixels, `ratioBest` the most contrasting pixel, and `paintDark`/`paintLight` are the ends. A graphic counts once it is on screen and its centre hit-test returns it (for a stroke, any of 8 points on the circle inside its svg or the svg's wrapper). For a graphic in a frame, the page hit-test at its centre must also return the iframe.

## How the measurements are made

- **Sweep.**
  - The first step measures the screen as the screen script leaves it.
  - Then each document's scrollers are scrolled from the top in steps of 80 % of their height: at most 3 scrollers per document, each covering at least 20 % of the viewport and not covered by something else, at most 10 steps each and 24 steps in all. `sweep.truncated` flags a job that hit a cap.
  - An icon or control counts once it is inside the viewport and its centre hit-test returns it. For frame content, the page hit-test at that point must also return the iframe, so nothing under a shell sheet or pill counts.
  - **Text (rig v2 occlusion grid).** Every line box is hit-tested in columns: at most 64 per text, at least 4 px wide, at 30 % and 70 % of the line height. A column is uncovered when both hits return the text element, a descendant, an ancestor or its `<label>`. For frame text, each uncovered column is also hit-tested in the page and must return the iframe. `cover` is the covered share of the in-viewport columns.
    - Only uncovered columns are sampled. A toast, pill or sticky bar over part of a line no longer blends into that line's background.
    - A text is accepted when `cover` ≤ 0.5. A fully uncovered text is done. A partly covered one stays eligible, and a later step that shows more of it re-measures it.
    - A text more than half covered at every step stays `measured: false` with `occluded: true`.
  - Scroll positions are restored afterwards.
- **Rendered contrast** (as in `lib-vis`):
  - Text and marked icons are made transparent in every document, and the page is captured at 1× CSS with animations finished.
  - The pixels under each line box are sampled, and the text colour, with alpha × ancestor opacity, is blended over each pixel.
  - `p10` is the 10th percentile of the per-pixel ratio. `aa` uses p10 against 4.5 (3 for large text: ≥ 24 px, or ≥ 18.66 px and bold).
  - For solid backgrounds, p10 = median.
- **Icons.** A shown capture and a hidden capture are compared. Pixels that change by more than 24 levels are ink.
- **Tokens.** A text colour's `tok` lists every design.css token (or `local:` token) whose probe-resolved rgba is identical. An empty `tok` means the colour is not a token value in that document.
- **Properties this WebKit build does not compute.** It does not compute `-webkit-tap-highlight-color`, `-webkit-touch-callout` or `overscroll-behavior`; it drops them at parse time. For these the rig parses the **source** of every stylesheet in the document (linked sheets are fetched, inline `<style>` is read as text) and takes the last matching rule.
  - The two inheriting properties walk up the ancestors. `overscroll-behavior` is read on the element itself.
  - `declared:(UA default)` means no rule matches, which on iOS means the grey tap highlight or the long-press callout.
  - This is an approximate cascade: document order, `!important` wins, no specificity.

## Summaries (`aggregate.mjs` → `audits/evidence/p4/measure/`)

Every summary carries a `note` that defines its fields.

| File | Contents |
|---|---|
| `coverage.json` | Planned, ok, failed and missing jobs per run and area; failures; screen-script errors; `stale` (raw files of an older rig version, not aggregated); the theme actually applied; truncated sweeps; the unmeasured-text share; `occlusion` per area (texts measured with some columns covered, texts never measured because covered) |
| `pairs.json` + `pairs/<area>.json` | Per area and theme: unique (text colour, rendered background bucket at 16 levels per channel, size class) with the minimum p10, the median of medians, count, failing count, example selectors and job ids |
| `failing-pairs.json` + `failing-pairs/<area>.json` | Every text below AA, grouped by area → theme → document, selector and colour. The index keeps the 8 worst groups per area and theme; the per-area files keep every group. Each group has these flags: `medAlsoFails`; `partlyCovered` (occurrences sampled with masked columns); `p10Only` (no occurrence fails at the median); `bgImage`; and `suspect` (`p10Only` on a solid declared background). Check a `suspect` group against its screenshot before filing it. The index ranks non-suspect groups first. |
| `nontext.json` + `nontext/<area>.json` | Icons below 3:1. Control boundaries below 3:1 where WCAG 1.4.11 asks for one: fields, toggles, and buttons or chips with no text label and no icon inside them that reaches 3:1 (`controlNeedsBoundary`, `controlFail`). An icon-only control whose icon passes is identified by that icon: it is counted in `iconIdentified`, and its low boundaries are listed apart (per-area file → `iconIdentified`), not as failures. Graphics (rig v2) below 3:1, by kind (`graphicsByKind`, `graphicFailByKind`, `graphics` groups with paint, adjacent pixels, `ratioInside`, `vsTrack`, `trackVsSurround`, `drawn`). The index keeps counts and the 20 worst svg-icon, control and graphic groups per area; the per-area files keep every group, including img and emoji. |
| `type.json` | Per area: distinct family, size, weight, line-height, tracking and transform combinations; the size histogram; the share of boxes exactly on an iOS Dynamic Type size; everything under 11 px; declared stacks and resolved families |
| `radii.json` | Distinct non-pill radii per area, pill count, concentricity violations |
| `shadows.json` | Distinct `box-shadow` values per area, with the themes each was seen in |
| `spacing.json` | Per area and property: distinct values, share on the 4 px and 8 px grid, and values off the grid. Side margins per device, for the page and the frame. |
| `glass.json` | Per area: maximum and median visible backdrop-filter layers, maximum visible-area share, jobs with content glass, backdrop values, chrome and content lists, the heaviest jobs |
| `motion.json` | Distinct computed transition and animation duration/easing combinations per area, flagged outside 200–350 ms; declared motion per document |
| `targets.json` | Interactive elements under 44 px per area: minimum effective size, devices, kid mode, inline links |
| `tells.json` | Per area: tap highlight, `user-select`, touch callout and `touch-action` histograms with offenders; overscroll; root backgrounds per theme; scrollers with visible scrollbar px; native-looking form controls; blue underlined links |
| `tokens-resolved.json` | Every design.css token per theme for the adult shell page (Eli's accent); what differs for kid and kiosk profiles; tokens an app document resolves differently from the shell; app-local custom properties |

## Limits

- **Blur.** The WebKit build (Playwright 1.63 on Windows) computes `backdrop-filter` but paints no blur (`lib/check-backdrop-filter.mjs`). Contrast over glass is measured against an unblurred, translucent fill: roughly right for a flat backdrop, optimistic or pessimistic over busy content. `glass.json` counts layers and area; it is not a frame-rate measurement.
- **Fonts.** Fonts fall back to Windows faces.
  - `ui-rounded`, `-apple-system`, `system-ui` → Segoe UI.
  - `ui-serif`/"New York" → Palatino Linotype, or the next installed face.
  - `ffr` is the resolved Windows face. Glyph widths, and so line wraps and ellipses, differ from an iPad.
- **Backgrounds.** Gradients, photos and art under text are sampled as rendered at 1× CSS. p10 reflects the worst 10 % of pixels under the line box, so a busy photo lowers it.
- **Icons at 1×.** Icon strokes are sampled at 1× CSS, so thin 1.5–2 px strokes antialias lighter than on a 2×/3× screen. `ratio` (p90) is the fairer number; `ratioMed` is pessimistic.
- **Computed styles only.** Text colours are the computed colours. Anything painted by `::before`/`::after` content, SVG `<text>` or canvas is not a text box, and emoji-only text is excluded (and listed under icons when it sits in a control).
- **Not covered by the sweep.** Text never on screen (rows past the step cap, content behind the app viewer, closed `<details>`) is recorded with `measured: false`: it is in the type inventory but not in the contrast data. Horizontal scrollers are not swept.
- **What computed style cannot see.** Hover, active and focus states are not measured. The declared rules for them are in `raw/_css` and `motion.json → declared`.
- **Approximate cascade.** Tap highlight, touch callout and overscroll come from the stylesheet source, not the engine.
- **Occlusion grid.** Hits are taken in columns at two heights, so an overlay thinner than a line in both places is not seen. Icons, controls and graphics are still gated by a single centre hit, so one partly under a toast or bar is sampled as rendered.
- **Graphics are heuristic.** They are found by class and role hints and by repeated small siblings, so a state shape with an unhinted class and fewer than 5 siblings is missed, and a decorative hinted shape is included. Read groups by selector.
  - `ratio` is the best adjacent side: lenient for a stripe on a card edge, where one neighbour is the page.
  - The 3 px outside sample includes any glow or drop-shadow (the Timer ring's `drop-shadow` makes its track read 1.24–1.26 against the glow, where 1.40 is the figure against the flat dial).
  - A ring track is reported even where its arc covers it completely (`drawn` = 1 on the arc).
  - Adjacent same-colour segments (F260's journey bar) compare a fill with its neighbour.
- **Inset rings** (`box-shadow: inset …`, e.g. F260 `.heat span.rest`) are not measured as rings. The dot's `shadow` field shows them.
- **Real devices.** Everything else Phase 1 listed as manual checks still applies (`audits/01-capture.md` §3): real touch, standalone chrome, safe areas, Dynamic Type, reduced transparency.

## Last full run (rig v2, 2026-09-24/25)

- **Jobs.** 3,662 planned, 3,662 ok, 0 failed, 0 screen-script errors (themes 1,721, devices 1,424, states 517). Every v1 raw file was re-measured in place, and `coverage.json → stale` is empty.
- **Time.** 10 chunks of up to 7.5 minutes each with 8 lanes, about 64 minutes (23:16-00:20 UTC).
- **Size.** 637 MB of raw JSON and 425 MB of screenshots, both git-ignored.
- **Theme check.** Every job's documents carried the expected `data-theme`/`data-scheme`, except the 12 `me-theme-*` jobs, which switch the theme themselves by design.
- **Truncated sweeps.** 336 jobs hit a step cap, mostly the Dollywood listings and F260's long plan.
- **What v2 changed** (against the v1 summaries):
  - **Failing text.** 1,441 groups / 61,182 occurrences became 1,347 / 60,910. Groups failing only at p10 fell from 160 (544 occurrences) to 94 (365), 53 of them flagged `suspect`.
  - **Occlusion artefacts.** Shell `span.ftxt` (first-visit, Parchment) and Timer `rem-text` (done-toast) no longer fail; they now read 6.82 and 11.21. The texts under the "Hub updated" toast are `occluded`. The measured-text share is unchanged within 0.7 points per area.
  - **Control-boundary failures.** 23,647 became 16,066, with 9,600 icon-only controls now `iconIdentified`. Larder fell from 1,607 to 390, which are now its fields plus 2 one-off rows.
  - **New graphics pass.** 88,726 graphics measured, 36,004 of them below 3:1. Known values match earlier phases:
    - Kid Verse today ring: 1.50-1.69 (P3 1.70).
    - Larder freshness fill against track: 2.28-2.99 median over the gradient (P3 2.69 at the fill end).
    - Timer pill ring track: 1.38-1.43 (P3 1.39). The large dial's track reads 1.24-1.25 against its drop-shadow glow.
    - F260 empty year cell in Midnight: 1.04-1.05 (VIS-F260-2 1.04).
