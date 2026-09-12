# Prayer app — tasks for Claude Code

Work through these in order. Each has an acceptance check. After every task,
run `node handoff/prayer/check.js apps/prayer.html` — it must stay at 0 failed.
If you rename a function the checks call, update `check.js` in the same commit.

Constraints that hold for every task:
- One self-contained HTML file. No build step, no npm, no external JS.
  Google Fonts is the only external request.
- Do not change the data shape in `prayers.json` except where a task says so.
  Storage key stays `prayer-data-v3`. Add a `migrate()` step for any new field.
- Keep the palette to the four accents in SPEC.md. Do not add colours.
- Every routine action must work without a keyboard on an iPad.

---

## A. Ship it

**A1. Install into the hub.**
Copy `handoff/prayer/prayer.html` to `apps/prayer.html`. Set
`USE_LOCAL_STORAGE = true`. Add two entries to `apps.json`:
- id `prayer`, name "Prayer", file `apps/prayer.html`
- id `prayer-family`, name "Family prayer", file `apps/prayer.html?list=shared`
Use the existing entries as the template for `color` and `icon`.
Check: both tiles open, the second lands on the teal family list.

**A2. Home-screen icon.**
Generate `apps/prayer-icon.png` at 180×180 — sand background `#F7F2EB`, a simple
mocha `#8A6A4B` mark (a rounded check, or a circle). Add
`<link rel="apple-touch-icon" href="prayer-icon.png">` in the head. Also add a
512×512 for good measure and reference it with `sizes`.
Check: Add to Home Screen on iPad shows the icon, not a screenshot.

---

## B. Fix first

**B1. Replace every native dialog.**
There are 21 `prompt()`, `alert()`, and `confirm()` call sites (`grep -c` confirms the number). Replace all with
in-page UI. Build one reusable inline form component: a panel that opens where
the triggering button was, with a text field or textarea, optional helper text,
Save and Cancel. Use it for:
- Add an update (textarea)
- Mark answered (textarea, required — Save disabled while empty)
- Change category (a `<select>`, not free text)
- Send to family list (text field prefilled with the title)
- Tell them you prayed (textarea prefilled with the draft)
- Rename category / rename plan / new plan name (text field)
- Remove category / delete plan (a confirm panel: one line, Cancel, Remove)
- Set PIN (password field) and the lock screen error (inline text, not alert)
- Import backup (textarea)
- The three validation alerts on Add and category-add become inline messages
  under the field.
Check: `grep -c "prompt(\|alert(\|confirm(" apps/prayer.html` returns 0.

**B2. Edit and delete a request.**
On the detail sheet add Edit, which turns the sheet into a form for title, for,
phone, detail, category (select), cadence (daily / weekly / rotation), and for
weekly a row of seven day chips writing to `days`. Save stamps `updatedAt` and
queues sync. Add Delete with a confirm panel. Deleting a private request that
was sent to the family list leaves the family copy alone.
Check: edit a title, confirm it changes on Today; delete one, confirm it's gone
from Today, List, and the category count.

**B3. Five tabs.**
Remove the Review tab. Move the review content to the top of Record as a
collapsible "Needs attention" section that is open when `reviewDue()` is true.
The nudge on Today links to Record. Tabs become Today · List · Record · Add · More.
Check: nav has five buttons; the review sections still render on Record.

---

## C. Visual

**C1. Nav icons.** Inline SVG line icons, 20px, 1.75 stroke, `currentColor`,
above each label. Suggested: sun (Today), list (List), bookmark or medal
(Record), plus-circle (Add), sliders (More).

**C2. Category dots.** On List and on category chips, a 6px dot before the name,
tinted from a fixed set of 8 mocha/teal/olive/gold tints derived from the
category's index. No new hues.

**C3. Empty states.** Every empty state gets one sentence and the one button that
fixes it. Today with nothing scheduled → "Change the plan" (goes to More). List
empty → "Add a request". Record empty → "Nothing answered yet — it will come."

**C4. Today header.** Move the list switcher to the top-right of the header, in
line with the date. Headline stays as the hero. The switcher shrinks to two
short labels: "Mine" / "Family".

**C5. Theme toggle.** Under More: System / Light / Dark. Store as `D.theme`.
Apply by setting `data-theme` on `<html>`. The dark palette currently lives
only inside `@media (prefers-color-scheme: dark)` — duplicate it under
`:root[data-theme="dark"]`, and wrap the media block so it only applies when
`data-theme` is absent or `system`.
Check: switching to Dark in a light room changes the app; reload keeps it.

**C6. Floating add.** A round + button, 56px, bottom-right above the nav, on
Today and List only. Opens Add. Hidden while a sheet or overlay is open.

---

## D. Functional

**D1. Search includes answered.** Results show active first under their
categories, then an "Answered" group. Match on title, for, detail, answer note.

**D2. Weekly cadence on Add.** Third chip "On certain days"; when chosen, show
seven day chips. Validate at least one day.

**D3. Detail field on Add.** A textarea under "Who is it for", optional.

**D4. Share as text.** On Today and on each List category: a "Copy as text"
action that writes a plain-text list to the clipboard — heading, then one line
per request, `• title — for`. Toast on success.

**D5. Migrate.** Any new field added above (theme, days already exists) gets a
`migrate()` default so existing saved data loads without errors.

---

## E. Before you say it's done

- `node handoff/prayer/check.js apps/prayer.html` → 0 failed.
- `grep -c "prompt(\|alert(\|confirm(" apps/prayer.html` → 0.
- Open on the actual iPad in Safari: light and dark, both lists, prayer mode,
  kitchen view, one print to PDF, one export, one import of that export.
- Set a PIN, reload, confirm the lock screen appears and the family list is
  still reachable from it.
- Report which of these you actually did on a device and which you could not.
