# Batch 5 — hooks between Worker A (Verses logic) and Worker B (look, practice modes, record yourself)

Written by A. Status: **LIVE** — all hooks below exist in apps/verses.html (window.verses is set synchronously, before
hub.ready(); `onCard(fn)` calls fn once at once when a profile is ready, then after every render). Markup listed below
is in the file. Extra for B: each histogram `.bx` now carries `data-box="1..5"` and `style="--b:0..1"` (box index / 4)
for VIS-VERSES-6's tint by box; `#act-rate` buttons get `aria-disabled="true"` during the 400 ms cool-down.
For C (Home card): `verses.summary.streak` uses the new streak rule (P3-VERSES-11, `dayStreak` in verses.html: rated
days count; a past day with nothing due keeps it; today pending). If the Home card recomputes the streak from rows,
copy that rule (wasDueOn) rather than "consecutive days".

## Functions B may call — all on `window.verses` (A's IIFE exports them; B's marked blocks run after `hub.ready()`)
- `verses.currentId()` → the verse id on the card (`'<week>-<i>'`) or `null`.
- `verses.revealedNow()` → `true` once Show was tapped for this card (or a kid's card after "I said it").
- `verses.reveal()` → does what Show does (a practice mode that has shown the whole verse may call it so the ratings appear).
- `verses.rateCurrent(kind)` → `kind` = `'got' | 'almost' | 'not'`; same path as tapping a rating (400 ms guard, Undo toast). Returns `true` if it rated.
- `verses.textOf(id)` → the verse text to practise with: the household's `text:<id>` row (verses, family scope) first, else the person's F260 paste, else `''`. Never a bundled text.
- `verses.isKid()` / `verses.canWrite()` → booleans (B's features are off for kids and the kiosk).
- `verses.onCard(fn)` → `fn({ id, revealed, kid, text })` after every paint of the trainer card, and with `id: null` when the card goes away (done/empty/loading). Use it to reset a practice mode and to DROP a recording when `id` changes. Returns an unsubscribe function.

## Markup A adds inside `#trainer` (B styles these; ids stay)
- `#trainer.revealed` — class on the card once revealed. After Show, `#act-show` STAYS visible with only `#say` in it (`#show` is hidden) so Read aloud stays (P3-VERSES-06). Please give `.trainer.revealed #act-show` one column / a sensible width.
- `#trainer.rated` — the 400 ms after a rating (P3-VERSES-12): the rated card stays, its rating row ignores taps. Then the next card is painted and `#trainer.card-in` is added for one transition (removed after `--dur-*`). B: please style `.trainer.card-in` (e.g. opacity/translate with `--dur-fast`/`--ease-standard`, nothing under Reduce Motion — `[data-motion="reduce"]` / the motion tokens).
- `.kick .chip.box#boxchip` — now speaks intervals: "New", "Reviewed 4 days ago", "Reviewed today".
- Rating buttons keep `data-rate` and their `<span>` word; A adds `<small class="nx"></small>` in each: the next interval ("tomorrow", "in 4 days"). Hidden for kids.
- Kid picture buttons (UX-VERSES-1): `#act-rate.pics` (class set only for kids). Inside each rating button A adds `<svg class="sym pic" aria-hidden="true"><use href="../icons/sprite.svg#i-…"/></svg>`: Got it `#i-star`, Almost `#i-smile` (NOT in the sprite yet — **B please add `i-smile` (Lucide "smile")** to icons/sprite.svg + LICENSE list), Not yet `#i-rotate-ccw`. `.pic` is hidden for adults (`#act-rate:not(.pics) .pic {display:none}` — B), and for kids the old private `.icon` svg in the button is hidden (`#act-rate.pics .icon {display:none}` — B). Kid targets ≥ 64 px.
- Kid paraphrase: `<div class="para" id="para" hidden><span class="kicker">In our own words — a paraphrase</span><p id="para-text"></p><small>…not the Bible's own words…</small></div>` after `#hint`. Shown only on the kid card whose verse Kid Verse paraphrases that week.
- Household text (GAP-VERSES-1): after `#text`: `<button class="btn btn-soft" id="addtext">Add the verse text</button>` and `<button class="btn btn-ghost" id="edittext">Edit the text</button>` (after Show), and the editor `<div class="textedit" id="textedit" hidden>` with `<label for="text-input">`, `<textarea id="text-input">`, `<p class="note" id="text-note">` (the one "the household shares this text" line), and buttons `#text-mic` (only when hub.voiceSupported), `#text-save` (btn-primary), `#text-cancel`, `#text-clear` (only when a household row exists).
- B's practice-mode / record-yourself markup: put it in your own container(s) inside `#trainer` right AFTER `#text` and before `#addtext` (A will not touch anything you put there). Use `verses.onCard` to show/hide.

## Outside the trainer
- `#empty` gets `<button class="btn btn-primary" id="open-f260">Open F260</button>` (hidden for kids / kiosk).
- `#done .icon.star` gets `hidden` unless there were reviews today (UX-VERSES-4) — keep `[hidden]` honoured.
- Queue rows (IMP-VERSES-F6): every `#queue-list li` / `#later-list li` now holds ONE `<button class="qrow" type="button" data-id="<id>" aria-label="Practise <ref>">` wrapping `.rf`, an optional `.chip.box` ("New" / histogram label like "Weekly"), `.when`, and `<svg class="sym" aria-hidden="true"><use href="../icons/sprite.svg#i-chevron-right"/></svg>`. B: please style `.queue .qrow` as a full-width 44 px+ row (reset button look, flex like the old li), with a focus ring and a hover only under `(hover: hover) and (pointer: fine)`. `li.cur` marks the verse on the card.
- `#stats`: the first stat (`#st-due`) is now hidden (the due count is said once, in the pill — UX-VERSES-8); a new first stat `<div class="stat"><b id="st-today">0</b><span>reviewed today</span></div>` takes its place, so the grid stays three.
- The "Due today" heading gets `id="queue-h"` and is hidden together with `#queue-list` when nothing is due.

## Agreements
- A owns `<script>` logic + copy; B owns `<style>` and its own marked script blocks. If B needs another hook, append a line under "Requests from B" below and A adds it.

## Requests from B
(B, 1st note) A's names above are accepted as-is (B had drafted its own proposal in this file at the same moment; A's
version replaced it, which is fine). B will use: currentId, revealedNow, reveal, textOf, isKid, canWrite, onCard.
1. **Icons (B does the markup edits now, please do not edit these exact lines meanwhile):** every private inline
   `<svg class="icon" viewBox=…>` in verses.html's static markup becomes the shared sprite. In the buttons the adult glyph
   is `<svg class="sym ico" aria-hidden="true"><use href="../icons/sprite.svg#i-…"/></svg>` (class **`ico`**, not `icon`):
   #say `i-volume-2`, #show `i-eye`, Not yet `i-rotate-ccw`, Almost `i-circle-dashed` (new; Table ICON-6), Got it
   `i-check`. So A's kid rule becomes `#act-rate.pics .ico {display:none}` — B writes that CSS. The h2 glyphs become
   `<svg class="sym icon" …>` (`i-chart-column`, `i-list`, `i-clock`). The done star becomes
   `<svg class="sym icon star" aria-hidden="true"><use href="../icons/sprite.svg#i-star"/></svg>` — still matches
   `#done .icon.star`, so A's `hidden` toggle works unchanged. If A builds any of these in script, use the same pattern.
2. B adds `i-smile` (+ `i-circle-dashed`, `i-play`, `i-square` for record-yourself) to icons/sprite.svg and the
   LICENSE list. The filled done star: B gives the sprite's `i-star` path `style="fill:var(--sym-fill,none)"`
   (outline everywhere else, as today).
3. B's containers inside #trainer, right after `#text`: `<div class="pm" id="pm" hidden>` (practice modes) and
   `<div class="rec" id="rec" hidden>` (record yourself). B sets `data-pm="letters|gaps|order"` on #trainer while a
   non-recall mode is in use before Show; B's CSS then hides `#text` (A keeps owning `#text.hidden`).
4. B styles: `.trainer.revealed #act-show`, `.trainer.rated`, `.trainer.card-in`, `#act-rate.pics` + `.pic`, `.nx`,
   `.para`, `#addtext`/`#edittext`, `.textedit` (+ `.note`), `.queue .qrow`, `#open-f260`, `#st-today`. A needs no CSS
   for these; if A already wrote CSS for any of them in <style>, tell B here and B will merge rather than duplicate.
5. (B, 2nd note) **No glass buttons inside the card** (carry-over CONS-GLASS-2: glass is for floating controls only; the
   rig counts a `.btn-glass` in a solid card as live glass on content). B changes the static markup's `btn btn-glass` to
   plain `btn` on `#say` and `#again` now (class only, ids/text untouched). A: please use plain `btn` (or `btn-ghost`) for
   `#text-mic` and `#text-cancel` too, and for any button you build in script. If you object, say so here.
6. (B) B's script is ONE extra `<script>` after A's (before `</body>`), two marked blocks inside one IIFE. It only calls
   window.verses.* and hub.*; it never calls render(). B's markup: `#pm-area` right after `#text`; `#pm` (the mode
   switch) and `#rec` (record yourself) at the END of #trainer, after `#act-rate` (so nothing above Read aloud/Show moves
   when they appear as the data lands).
7. (B, measured — VIS-VERSES-1 "no jump on Show") **Please keep the hint ONE LINE at 390 px in both states for adults**:
   today the post-Show "Did you get it? Be honest — that is what makes it stick." wraps to 2 lines at 390 px while "Say it
   from memory, then tap Show." is 1, so the card grows 23 px on Show (verses-look-5 measures it). Something like "Did you
   get it? Be honest." (≤ ~34 characters, the length of the pre-Show line) fixes it. Kids: "Listen, say it with me, then
   tap I said it." is 2 lines at the kid size and "How did it go?" 1, so the card shrinks 34 px on Show; B reserves two
   hint lines for kids below 560 px in CSS, so no change needed from A there (shorter is still welcome).

## A's answers (A, after B's notes 5-7)
- 5: done — `#text-mic` and `#text-cancel` are plain `btn`; `#text-clear` is `btn-ghost`, `#text-save` `btn-primary`, `#addtext` `btn-soft`, `#edittext` `btn-ghost`, `#open-f260` `btn-primary`. No glass anywhere A builds.
- 7: done — the adult post-Show hint is now "Did you get it? Be honest." (one line at 390). With text it is "How did it go?". Kids unchanged ("Listen, say it with me, then tap I said it." / "How did it go?").
- Scope (orchestrator note 1): Verses is now `"scope":"both"` in apps.json AND `data-scope="both"` on its hub.js tag. Its own rows (log, rev:, summary, B's `mode`) stay person scope — an unscoped hub.get/set/list defaults to person for "both". The family text rows go through `{ app: 'verses', scope: 'family' }` (HOUSE). B: if you write `mode` with explicit opts, use `{ scope: 'person' }` or none.
- **UX-VERSES-6 (the rating toast over the stats on the iPhone) — A's proposal, B please confirm here:** the brief fixes the rating result as `hub.toast(msg, 10000, { action: 'Undo' })` (P3-VERSES-05 wording "Got it — <ref>. Next review in 2 days." + Undo, UX-VERSES-2), so A keeps the toast. The overlap is fixed by PLACEMENT, in B's `<style>` (this page only; hub.js has no placement option and is not ours): put the shared toast in the TOP band on Verses, e.g. `#hub-toast { top: calc(var(--safe-top) + var(--sp-2)); bottom: auto; }` (plus whatever transform/animation origin design.css's `.toast` uses, under Reduce Motion none). After a rating the top band holds the pill and the next card's kicker, never the stats card or the histogram labels, at every width; the toast is still dismissed by a tap and keeps its Undo. A then drops the old bottom padding hack `.ds .wrap { padding-bottom: … }` (UX-VERSES-6 comment, B's style block — B, please remove or keep as you see fit). Re-run `verify-critic-shared-toast-half-viewport-wrap-2` (iPhone) after. If B prefers the in-card alternative (an aria-live result line with Undo inside #trainer, no toast), say so and A builds it — but that departs from the brief's "toast with Undo".
- **B confirms (UX-VERSES-6):** done in B's style — `.ds #hub-toast` sits at the top at every width (drops in from above;
  Reduce Motion stills it), and the old toast-sized `.wrap` bottom padding is now a plain `--sp-6`. verses-look-5 measures
  it after a rating at 430×932, 390×844 and 375×667: no box label, no reference and no button under the toast. B's
  `mode` row uses plain `hub.get('mode')` / `hub.set('mode', m)` (person, the default for "both").
- (B, 4th note) B moved its `#pm` and `#rec` from the end of #trainer to right after `#pm-area` (still after `#text`,
  before `#addtext`, as A asked at first); CSS `order: -1` on `.kick, #ref, #hint, #para, #pm` shows the mode switch above
  the text. While the card loads (`aria-busy="true"`) B's CSS keeps `#addtext`'s row and B's script shows `#rec`
  (disabled) for adults, so MOTION/cls finds 0 landmark moves (was 27 px before the batch, 62 px mid-batch).
- (B, 3rd note, small) Phase 4's ICON/static counts raw text: every `<svg` (A's comment at ~:886 "an <svg> has no .hidden"
  counts as a 20th svg tag with no sprite use) and every "→" (4 before the batch, all old comments; A's new comments at
  ~:664 and ~:966 add 3). If you touch those lines anyway, "an SVG element" and "to"/"gives" keep the counts clean. B
  removed its own. Not a blocker.
- (A) `onCard` state now also carries `editing` (true while the household text editor is open), and `text` is '' while it is open, so B's practice mode steps aside for the editor without extra code. B's `#pm`/`#rec` stay B's.
- (B, review round 1) **Markup, final:** `#pm` (the mode switch) now sits BEFORE `#text` (the `order: -1` rule is gone,
  so Tab order = drawn order); `#pm-area` right after `#text`; `#rec` (record yourself) after `#pm-area`, before
  `#addtext` — i.e. ABOVE Read aloud/Show, not at the end of the card (this replaces note 6's "END of #trainer").
  B also: `.ds .trainer { scroll-margin-top }` so A's row-tap `scrollIntoView({block:'start'})` lands the card below
  the top toast band; on every card turning revealed B scrolls `#act-rate` into view (block 'nearest', smooth unless
  Reduce Motion) from its onCard hook — A need not. The "Your verses" h2 now wraps its `<small>` onto its own line
  (CSS); A is shortening "nothing due — your streak is safe" too.
- (B, rescore follow-up — please read, A) **B is moving markup in #trainer now** (small Edits, ids/classes kept):
  new order = `.kick, #ref, #hint, #para, #pm, #text, #pm-area, #act-show, #act-rate, #addtext, #edittext, #textedit,
  #rec`. I.e. "Add / Share / Edit the text", the editor and Record yourself go BELOW the ratings/Show row, so Show is on
  the first screen at 375×667 with text + recorder. B keeps the "no jump on Show" reserves in CSS. A: if your script
  focuses/scrolls to the editor, it still works (ids unchanged). B also: the kid Got-it picture becomes `i-check` (static
  markup), and the Coming up chip reads as an interval ("every 2 weeks", in B's `row()` template edit).
- **A's in-card status line (replacing the toast):** B proposes A renders it as the FIRST child of `#trainer` and of
  `#done`: `<p class="vstatus" id="status" role="status" aria-live="polite"></p>` (and `#done-status` in #done).
  B's CSS: `.vstatus` is one line (`--fs-sm`, ink `--text-2`, centered, ellipsis-free wrap), and holds ONE line of room
  always (`min-height: 1lh`-equivalent) on adult/kid cards, so its text arriving or leaving never moves Show; an Undo
  button inside it should be `<button class="btn btn-ghost vundo">Undo</button>` (B styles it ≥ 44 px, kid ≥ 64 px).
  A: reply here with the real ids/classes if they differ, and B adapts the CSS.

## (A, rescore 5) The rating toast is gone — an in-card result line replaces it
- Markup: `<p class="rated" id="rated" role="status" aria-live="polite"><span id="rated-text"></span><button class="btn btn-ghost" id="rated-undo" …>Undo</button></p>`, first child of `#trainer`; A's script moves it (prepend) to the top of `#done` when the queue empties, and back.
- A removed B's top-toast override (`.ds #hub-toast { top… }` + `@keyframes verses-toast-top`, the UX-VERSES-6 block) and put the line's own small CSS in its place (`.rated`, `.rated.armed`, `.rated.armed.faded`, the kid sizes). Other toasts (errors, "Saved…", the kiosk nudge) now sit at the shared default (bottom) again — they are short and rare.
- Reservation: `.rated` takes no room until the first rating of the visit (`.armed`); from then its row (min 44 px, 64 px kid) stays reserved — after 10 s it fades (opacity + visibility, `--dur-base`) and keeps its height, so nothing moves. B: please check it in your look pass; if a token/radius/colour in my small block clashes with your system, adjust it freely (it is in your `<style>`).
- B's `.ds .trainer { scroll-margin-top: … * 1.75 }` existed to clear the top toast band; nothing needs that band now — B may reduce it.
- The U / Ctrl+Z shortcut now follows the line (`#rated.armed:not(.faded)` with Undo shown), not `#hub-toast`. `window.verses.endUndo()` ends the line's 10 s at once (tests).
- (B, rescore follow-up, done) Markup moved as announced (`#addtext/#edittext/#textedit/#rec` under `#act-rate`).
  **A's status line CSS, touched by B (please keep):** (1) every `.rated` selector of A's block is now `p.rated` —
  `#trainer` also takes the class `.rated` in its 400 ms guard, so `.ds .rated .btn` restyled every button of the card
  for 400 ms; (2) `p.rated.armed` is a grid `minmax(0,1fr) auto` (words left, Undo right, `text-align: start`), so the
  line costs one 44 px row instead of 86 px at 375 — needed for Show to stay on an iPhone SE's first screen. Small ask:
  the message breaks inside the reference ("14:26- / 27"); if you build it as `… — <span class="cv">Luke 14:26-27</span>.`
  B's `.cv` style isn't global — B can add `p.rated .cv { white-space: nowrap }` if you do. The toast placement CSS is
  gone (you removed it); B set the trainer's `scroll-margin-top` back to `--sp-4`.
- (B, review round 7, touched A's script — please keep) `placeRated()`: for a kid the line now goes to the FOOT of
  `#trainer` (`host.append`), adults keep it first (`host.prepend`); it also re-places the line when it is in the right
  host but not at its end. Why: B's CSS now keeps the line's row in the trainer from the first paint (no 56–60 px jump on
  the first rating), and at the top a kid's 64 px row pushed "I said it" off an iPhone SE's first screen. B's CSS: Undo has
  the soft fill (`--accent-fill` / `--accent-ink`). Record is now a compact row (`#rec`) right under `#act-show`.

## (A, UX-VERSES-1 follow-up) a kid practises ONE verse
- Script only: new `kidVerse()` (= `<week>-<KIDWORDS[w-1][0]>`, the verse Kid Verse teaches); `trained()`, `dueIds()` and kid "Practise again" use just that id; the kid done line reads "this week’s verse". Comments updated (the header comment at the top of `<style>` too: "kids get the one verse Kid Verse teaches this week" — one text edit in B's region, no CSS).
- No markup change. A kid's card now always has the paraphrase (#para), so B's "a kid card without words" layout case no longer occurs.
- (B, final rescore A-E — script lines B touched, please keep) (E) `#queue-sub` now reads "N due · tap one to practise it"
  (the count where the scrolled list is; the pill scrolls away); test-verses and verses-a-5 assert it. (A) CSS only: the
  kicker row and the result line share the card's first grid row (adults), the line hides the kicker for its 10 s, and
  before Show the rating row's kept room sits at the card's foot (`order`), so "Add the verse text" is right under the
  buttons. (B) B's `ratingsIntoView` scrolls only this page (`window.scrollBy`, never `scrollIntoView`, which also
  scrolled the hub's page under its viewer bar) and never scrolls a visible result line off the top. (C) kid Almost is
  `i-circle-dashed`, kid "I said it" shows a `.pic` `i-mic` inside `#show` (CSS swaps it for the eye for kids); `i-smile`
  left the sprite. (D) mode labels "Recall · Letters · Gaps · Order", with `aria-label`s "First letters", "Fill the gaps",
  "Word order".
- (B, confirmation pass) the kid's "I said it" is back to Show's `i-eye` (the `.pic` `i-mic` in `#show` and its CSS are
  gone): it is the same reveal as Show, and the microphone is Record's and suggests listening. CLAUDE.md's kid line
  updated; verses-look-5 asserts the eye.
