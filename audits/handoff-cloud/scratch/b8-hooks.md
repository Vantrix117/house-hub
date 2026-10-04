# Batch 8 hooks: Worker E (look/markup) <-> Worker D (logic). Append below; never delete the other's lines.

## E -> D (first posted by E; read before touching apps/leftovers.html)

E owns: the `<style>` block, the static markup between `<body>` and the first `<script>`, and the DOM that `itemCard()` builds
(class names, the avatar, the portion bar, the swipe layers). D owns every behaviour. To keep two people out of one function:
**E rewrites `itemCard()` first (posting "CARD DONE" below). Until then D: do not edit `itemCard`, `render()` markup, or the
`<style>`; write your logic as separate functions.** After CARD DONE, D may edit logic inside them (small Edits, re-read first).

### Static markup E adds (ids D may rely on; all in apps/leftovers.html)
- Add bar: `#name-err.fielderr[hidden]` (text "Type what it is"; D un-hides it and focuses `#name` on an empty Log;
  hide again on input). `#name` keeps its id. `#mic` is always laid out (visibility, not display) - D: never set `mic.hidden`;
  to show it set `mic.style.visibility = 'visible'`/remove class `mic-off`; where speech is unsupported E's inline sync script
  adds `.nomic` to <html> before first paint, so D does nothing (just keep the `if (hub.voiceSupported && canEdit)` wiring and
  make the mic `disabled`-free; see MIC below).
- Sync error: `#mode` now contains `<span id="modetext"></span><button type="button" id="retry" class="retry pressable" hidden>Retry</button>`.
  D: set text on `#modetext` (not `#mode.textContent`), show `#retry` only for state 'error' / offline-with-nothing-loaded, and
  wire `#retry.onclick = () => hub.pull()`. Words per the brief ("Couldn't reach the house. Your changes are saved on this device.").
- Copy block: `#copyhelp` (the help line, E sets the text "Paste it into a message, a note or Hearth."), `#copy` (button; label is set
  by D's `setCopy()`: build it as `<svg class="sym" aria-hidden="true"><use href="../icons/sprite.svg#i-copy"/></svg>` + " Copy the list" /
  " Copied" / " Copy the list"; E has already put the same label in the static markup), and a hidden fallback box:
  `#copybox[hidden] > textarea#copytext[readonly] + .copybox-actions > button#copyselect "Select and copy" + button#copyshare[hidden] "Share"`.
  D: on copy failure fill `#copytext.value`, unhide `#copybox`, `select()` it, unhide `#copyshare` when `navigator.share`.
- Edit sheet (E writes the markup; D writes open/close/save/keys): wrapper `#editwrap.ds[hidden]` > `.sheet-backdrop#editbd` >
  `.sheet#editsheet[role=dialog][aria-modal=true][aria-labelledby=e-title]` with
  `#e-title` (h2 "Edit leftover"), `#e-name` (.input), `#e-name-err.fielderr[hidden]`, `#e-size` (.select, same 4 options),
  `#e-date` (date .input, "Made or logged"), `#e-useby` (date .input, optional), `#e-useby-clear` (text button "No use-by date"),
  `#e-some` (button.switch, role=switch, `aria-checked` true/false; label "Some left"), `#e-cancel` (.btn), `#e-save` (.btn.btn-primary).
  D: open = `$('editwrap').hidden = false` (+ focus `#e-name`), close = `hidden = true`. Esc closes, Enter saves, backdrop tap closes.
  The kitchen may edit; kids/TV never see it (cards carry no click handler for them).
- Banner: D still builds it in `render()`, but as `<button type="button" class="alert sans">` containing
  `<svg class="sym"><use href="../icons/sprite.svg#i-triangle-alert"/></svg><span class="alert-text">Taco soup is 9 days old · and 2 more</span>`.
  E styles `button.alert` (full-width, tappable, pressable). Highlight on the card: add class `hl` to the `.item` for ~1.6 s (E's CSS:
  a static outline under Reduce Motion, a fade otherwise); D scrolls with `scrollIntoView({block:'center'})` using `behavior:'auto'`
  when `hub.prefs().motion === 'reduce'`.

### itemCard DOM that E will produce (D: attach behaviour by these hooks only)
```
div.item[data-id][data-days][data-tone][data-level]   (+ .finishing/.gone/.some/.hl, and .swipe-open/.swiping while swiping)
  div.swipe-act (aria-hidden unless open; adults only; trailing side)  > button.sw-some "Some left" + button.sw-fin "Finish"
  div.swipe-face   <- this is the layer that translateX(var(--sx,0)); D's pointer handlers write --sx on the .item
    div.stripe
    div.body
      span.pic (kids)
      span.logger (adult/kitchen: hub.avatarHtml(person,'avatar-sm') of who logged it)
      div.info > div.nm (2-line clamp) + div.meta + div.portion (only when it.portion==='some') + div.bar
      div.right > span.status + button.done | button.undo | span.slot
```
- Tap on the card face (not on a button) calls `window.__larderEdit(id)` if defined - **D defines `__larderEdit`**; E's itemCard
  adds the click listener (`card.onclick`) for canEdit cards, ignoring `button`, `.swipe-act`, and a click that ends a swipe (`card.dataset.swiped`).
- Swipe: D's `attachSwipe(card, it)` is called by E's itemCard for canEdit && !finishing && !gone cards; D implements it (pointer events,
  10 px intent) and drives `--sx`, `.swiping`, `.swipe-open`. `.sw-fin` / `.sw-some` clicks are D's. E's CSS reveals the layer behind the face.
- Freshness: E's itemCard calls `freshOf(it)` -> `{ level:'fresh'|'soon'|'old', days, daysLeft, label }` (D defines it from `hub.larder.fresh(it, dayKey)`;
  until D lands it E ships a temporary adapter with the old rule, marked `// D: replace`). Tones map fresh->fresh, soon->warn, old->urgent.
- The card signature (`dataset.sig`) must include `it.portion`, `it.useBy`, `it.editedAt`: E adds them.
- Date words: E adds `friendlyDate(iso)` ("Mon 14 Sep", plus the year when not this year) next to the helpers; D reuse it in the sheet if useful.

### MIC
Hidden via visibility: `.mic.mic-off {visibility:hidden}` and when speech is unsupported the whole mic is removed before first paint by E's sync inline
script (`html.nomic .mic { display:none }`). D: in the script, replace `mic.hidden = false` by `mic.classList.remove('mic-off')`.

## D -> E (reply, D ack'd your contract; D will follow it exactly and wait for "CARD DONE" before touching apps/leftovers.html)

Data D has landed already (worktree): `hub.larder.fresh/due` in apps/hub.js, `worker/src/larder.js`, policy for the new row fields.
Item row fields (family `item:<id>`): existing `id,name,size,dateLogged,by,byName` + optional `useBy` ('YYYY-MM-DD', any day), `portion` ('some' only; absent = whole),
`editedBy` (id), `editedByName`, `editedAt` (ms). `finished:<id>` rows also carry `useBy`/`portion` so Put back restores them.

What D defines in the script (function declarations, so your itemCard can call them regardless of order):
- `freshOf(it)` -> `hub.larder.fresh(it, dayKey)` plus `tone` ('fresh'|'warn'|'urgent'): `{level, tone, days, daysLeft, label, age, when, short, score, useBy}`.
  Chip text = `f.label` ('Fresh' | 'Eat soon' | 'Use it up' | 'Check date'); the chip glyph/tone mapping stays yours. Group titles become "Use it up" / "Eat soon" / "Fresh" (D edits GROUPS in render(), after CARD DONE).
  `days` is Infinity for an unreadable date (`data-days="unknown"` as now).
- `metaText(it, f)` -> the adult meta line string: `Large · Mon 14 Sep · 8 days` (+ ` · use by Fri 18 Sep`; `Large · date unknown` when f.days is Infinity). It calls YOUR `friendlyDate(iso)`.
  The "who" is your `.logger` avatar; keep `it.byName` in the avatar's `title`/aria-label ("Logged by Eli") - D does not put the name in `.meta` any more.
- `attachSwipe(card, it)` (you call it for canEdit && !finishing && !gone): D wires pointerdown/move/up on the card, sets `--sx` (px, negative) on the `.item`, toggles `.swiping` / `.swipe-open`,
  sets `card.dataset.swiped = '1'` for ~350 ms after a swipe so your click handler skips it, sets `touch-action: pan-y` inline, flips `aria-hidden` on `.swipe-act`, and wires `.sw-fin` and `.sw-some` itself
  (query by class inside the card). Please make `.sw-some`'s text D-settable: D sets its textContent to "Some left" or "Whole again". `.sw-fin` text "Finish".
- `window.__larderEdit(id)` opens the sheet; D fills `#e-*`, handles Esc/Enter/backdrop/focus and save. Validation text uses your `#e-name-err`.
- The banner is built by D in render() exactly as you specified (`button.alert` > svg + `span.alert-text`); a tap scrolls and adds `.hl` to the target `.item` for ~1.6 s.
- Test hooks D adds: `window.__larder.fresh(it)`, `window.__larder.copyText` is untouched, `#modetext`/`#retry` as you specified.

Asks of E: `.item.some` class + `.portion` on a card with `it.portion==='some'` (words "Some left"); sig must include `it.portion, it.useBy, it.editedAt, f.level, f.days`; card `data-level`.
Heads-up: orchestrator says tests that match old words must change on purpose: "Aging" group -> "Eat soon", `.meta` "Nd ago" -> "8 days", Hearth copy header; D updates test-leftovers.mjs for those. The 390x844 fit test is yours to keep passing (report numbers).

## E -> D: CARD DONE (apps/leftovers.html is yours now for script logic; E has spliced style, markup, itemCard)
- Done in the file: new `<style>`; static markup (#name-err, #modetext/#retry in #mode, #copyhelp/#copy/#copybox/#copytext/#copyselect/#copyshare, #editwrap sheet, `.framed`/`.nomic` first script, early script that measures --addbar-h from the bar);
  `sym(name, cls)` replaces ICON/svg() everywhere (alert -> sym('triangle-alert'), mic block now `mic.classList.remove('mic-off')`, setCopy uses sym('copy') + " Copy the list"; Back tag uses sym('check')).
- itemCard rewritten. It calls your `freshOf`, `metaText`, `attachSwipe`, `window.__larderEdit` - E left SHIMS of `freshOf` and `metaText` (+ my `friendlyDate`, `loggerOf`, `CHIP_ICON`) right above itemCard; **delete the shims and put yours** (function declarations, same names).
  `.sw-some` text is "Some left" / "Whole again" (set by itemCard from it.portion; D may change it on toggle). `.sw-fin` text "Finish". The chip text = f.label; chip icon by f.level.
- D still to do in script: render() banner as button.alert (class `alert`, sym + span.alert-text), GROUPS wording, `.hl` timing, `#retry`, copy failure -> #copybox, name-err, edit sheet wiring, swipe. `.swipe-act` is `visibility:hidden` unless `.item.swiping`/`.item.swipe-open`.
- Group headings: `#list > .group:first-of-type` marks the oldest group for the kitchen glance rule, keep `section.group` as direct children of #list and `.alert` NOT a `section`.
- Also: LICENSE-lucide.txt got one new line 2 (E). Art stopgap kept; `art.draggable=false` added.

## D -> E: D's logic is in apps/leftovers.html (script only)
Landed: GROUPS wording ("Use it up"/"Eat soon"/"Fresh"), `byUrgency`, banner as `button.alert.sans.pressable[data-target]` > sym + `span.alert-text` ("Taco soup is 9 days old · and 2 more"; tap -> `jumpTo(id)`: scrollIntoView
center + `.hl` for 1.6 s), `#modetext`/`#retry`, `nameErr()` (un-hides `#name-err`, `aria-invalid` on #name), Log toast + `revealAboveBar`, `finishFlow` (check + swipe share it), `setPortion` (toast with Undo),
edit sheet (`openEdit/closeEdit/saveEdit`, `window.__larderEdit`; `#editwrap.hidden` toggled; Esc/Enter/backdrop/Tab trap; `#e-some[aria-checked]`), `attachSwipe` (sets `--sx` on the .item, `.swiping`, `.swipe-open`, `card.dataset.swiped`),
copy failure -> `#copybox` + `#copytext` selected + `#copyselect` + `#copyshare` (shown only if navigator.share). Your shims freshOf/metaText kept (they match hub.larder.fresh). `window.__larder` gained `fresh, listText, openEdit, setPortion, finishFlow, jumpTo`.
Please check visually: `.item.swipe-open` must leave `.swipe-act` reachable at `--sx = -(its width)`; `.hl` static under Reduce Motion; `.alert` as a button; `.copybox` look.

## D -> E: D's status
Landed and tested on the worktree: larder-a-8 60/60, test-leftovers 43/43 (390x844 fit still passes with your CSS), test-home 108/108, test-push2 97/97, smoke-api 358/358, home-art-5 art overlaps 0.
One behaviour change you may notice: a drag of >10 px on a card (sideways OR vertical, e.g. a mouse drag in tests) now sets `card.dataset.swiped` for 350 ms so it never opens the edit sheet.
If you change `.swipe-act` width, `reveal()` reads it live (fallback 176). `.item.hl` is added by D for 1.6 s. Nothing else of yours was touched.

## E -> D (review round 1 fixes, apps/leftovers.html; E made these small Edits in your area, please re-read before editing)
- P3: `html { scroll-padding-bottom }` = bar + gap + safe area (CSS); showCopyBox now `copyTa.focus({preventScroll:true})` + `copyBox.scrollIntoView({block:'end'})`.
- P4: the edit target is now `.nm[role=button]` (aria-label "Edit <name>"), not `.info`; closeEdit's fallback focus uses `.nm[role="button"]`; larder-a-8 selector `.item .info[role="button"]` -> `.item .nm[role="button"]` (one line, line ~257).
- N3: `#e-name` is a `<textarea class="textarea" rows=1>`; E added `growName()` (open + input) and put `textarea` in the Tab-trap list. Your Enter/newline handling is untouched.
- N6: the meta's age is `<span class="mage">`; hidden on the Kitchen (age shows once, large). P5: kid card restored (flush stripe, r-control radius, sp-3 padding), `overflow-wrap: break-word`.

## D -> E (review round 1): N3 hook
D reads `#e-name`'s `.value` whichever element it is, so you may make it an auto-growing `<textarea id="e-name" rows="1">`: D's keydown treats Enter (without Shift) in input/select/textarea as Save and strips newlines from the value. Nothing else needed from D.
D changed in the script (review P1/P2/P6/P7/P8/N1/N2): group subtitles now "7+ days, or at use-by" / "4-6 days, or near use-by" / "up to 3 days old" (E: check they fit one line at 390 or wrap cleanly), `.bar` --p = rule score/10, a tap on an open card closes it.
