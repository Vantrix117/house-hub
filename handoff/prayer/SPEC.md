# Prayer app — spec

One self-contained HTML file, two lists. No build step, no dependencies, no backend.

- Lives at `apps/prayer.html`
- **Two entries in `apps.json`**, both pointing at the same file:
  `prayer.html` (private) and `prayer.html?list=shared` (family)
- Data shape: see `prayers.json` — that is a real export, not a mockup
- Working prototype: `prayer.html`. Build from it rather than from scratch.

---

## Storage

`localStorage`, key `prayer-data-v3`, holding both lists in one object.

The prototype's script opens with `USE_LOCAL_STORAGE = false`. **Set it to true.**
That is the only change required to make it persist on GitHub Pages.

Export and Import are non-negotiable. iPad Safari can evict localStorage after
about a week of not visiting the site. Export writes both lists; import accepts
either a v3 backup or an older single-list one.

---

## Two lists

`D.lists.personal` and `D.lists.shared`, each with its own categories, prayers,
plans, and prayer-day history. `D.activeList` decides which is live. The `?list=`
URL parameter overrides it at load, which is how one file serves two hub tiles.

The family list uses a blue accent instead of pine, so it is impossible to
mistake which list is open.

**Sending to the family list copies, it does not move.** The original stays
private, the copy gets a fresh id prefixed `s`, `sharedFrom` pointing back at the
source, and a title the user can rewrite before it goes over — the private
wording is often not the wording you want on a shared screen.

### PIN
Optional, on the private list only. It is not encryption and the app says so
in plain words on both the lock screen and the settings page. Anyone who can
open the browser's storage can read everything. It exists to keep the list off
a screen in a shared room, and nothing more. Do not present it as security.

---

## Plans

A plan decides what Today shows and how it looks. Each list has its own set;
`activePlan` names the live one. Three modes:

- **everything** — all `daily` requests, any `weekly` request matching today,
  plus N `rotation` picks.
- **byDay** — a set of categories per weekday, optionally always including the
  every-day requests. This is the classic prayer-plan pattern.
- **focus** — a single category.

Plus per-plan display switches: group by category, progress bar, streak strip,
recently answered, anniversaries, review nudge.

**Rotation is frozen per day.** Picks are chosen once (coldest `lastPrayedAt`
first) and cached in `rotationFor {date, size, key, ids}`. Without this, marking
one prayed re-sorts the list and pulls in a fresh entry, so the list never ends.
The cache invalidates on date, size, or plan change.

---

## Screens

**Today** — the day's list under the active plan, with the list switcher, an
optional progress meter and stats strip, a review nudge when things have gone
quiet, anniversaries, and a recently-answered ledger.

**List** — search plus every active request in collapsible category sections.

**Record** — streak, best run, days this month, total answered, a month dot
calendar, then answered prayers with their notes.

**Add** — title required, everything else optional. Plain inputs so iOS keyboard
dictation works. Phone number is optional and only used for "tell them".

**Review** — what has gone quiet (not prayed in 30+ days), what has had no news
(90+ days without an update), and what was added this week. Surfaces itself on
Today on Sundays or whenever three or more requests have gone cold.

**More** — plan editor, paste box, category management, PIN, backup.

---

## Behaviours worth preserving

- **Answered requires an answer note.** Not skippable. That text is the app.
- Marking answered shows an Undo toast; it is easy to fat-finger.
- Answered entries can be put back on the list.
- **Tell them you prayed** drafts a short message, opens Messages if a number is
  stored, otherwise copies to the clipboard — and logs an update on the request
  so you can see when you last reached out.
- **Anniversaries** fire on the month-day of `createdAt` and `answeredAt` in any
  prior year.
- **Paste parser** — a line ending in a colon sets the category for the lines
  beneath it, matching an existing category case-insensitively or creating a new
  one. "Name - request" splits into who and what. Leading bullets are stripped.
  Keep individually or Keep all.
- Renaming a category rewrites every request and every plan that references it.
  Removing one moves its requests to Personal after a confirm.
- A request whose category was deleted still renders under its old name.

---

## Encouragement, deliberately restrained

Progress meter, current streak, best run, days this month, total answered, month
dot-grid, and one milestone line shown only when the day's list is finished.

**A missed day is never called out.** No "streak lost", no red, no
notifications, no guilt copy. The streak just reads smaller. Streak mechanics
are good at getting people to show up and bad at what happens when they break,
and the failure mode here is quitting after missing three days, not missing one.

`prayerDays` is an array of ISO dates on which at least one request was marked.
Streaks are derived, never stored.

---

## Design

iPad-first, modern, light brown. Airy rather than cosy; no texture, no vintage
cues, no dark-academia leanings.

**Palette — sand and mocha.** Warm off-white paper, mocha ink, hairline rules in
oat. Dark mode is a soft warm charcoal, not a near-black. Four saturated accents,
each with exactly one job and used for nothing else:

| Colour | Means |
|---|---|
| Gold | answered prayers, anniversaries, milestones |
| Olive | progress and the prayed mark |
| Teal | the family list — the whole app retints when it is open |
| Terracotta | wants attention: gone cold, sync failed |

`--accent` swaps from mocha to teal via `body.shared`, so every control follows
the active list without a second set of rules.

**Type.** Manrope throughout — 400 for body, 500 for row titles, 600 for
headings and labels, with negative tracking that tightens as size grows. The one
exception is **Instrument Serif in italic**, used in exactly two places: the
answer note on an answered prayer, and the latest update inside prayer mode. It
marks the two moments that are somebody's words rather than interface, and it
should not spread beyond them.

**Surfaces.** Flat and tinted rather than shadowed. Depth comes from three
background tiers — paper, raised, sunk — plus hairline rules. Shadows appear
only on the sheet and the toast, where something genuinely floats. Radii are 10px
on inputs and buttons, 14px on panels, 26px on the sheet, full round on chips,
pills, nav items and the switcher.

**Prayer mode and the kitchen view follow the theme** — full-bleed paper, no
chrome, the request set at 44px. They are quiet, not dark.

**Motion is four things:** a 6px rise on screen change, a spring on the check
mark, the sheet sliding up, bars easing. `prefers-reduced-motion` disables all of
it.

---|---|
| Amber | answered prayers, anniversaries, milestones |
| Sage | progress and the prayed mark |
| Teal | the family list (the whole app retints when it is open) |
| Plum | something wants attention — gone cold, sync failed |

`--accent` swaps from walnut to teal via `body.shared`, so every control
follows the active list without duplicated rules.

**Type.** Fraunces for display — headings, the prayer-mode line, answered
titles, the big numerals in the stats strip. Newsreader for reading text. Small
labels are uppercase Newsreader at 11–13px with wide tracking, which is what
carries most of the polish. Two families, no more.

**Texture and depth.** A fixed SVG grain overlay at very low opacity over the
whole page. Warm-toned shadows rather than grey. Inset shadows on inputs and the
list switcher; raised shadows on the sheet, toast, chips, and primary buttons.
4px radii everywhere except the sheet at 22px and pills at full round.

**Prayer mode and the kitchen view are always dark**, regardless of system
setting. Entering prayer mode should feel like the room dimming — that contrast
is the point, so do not make them follow the light theme.

**Motion is minimal and purposeful:** a 5px rise on screen change, a spring on
the check mark, the sheet sliding up, the progress bar easing. Nothing else
moves. `prefers-reduced-motion` disables all of it.

---

## Prayer mode

The primary way to pray through the list, not a checklist. Full screen, one
request at a time, large light type, no chrome. Opens from the button on Today.

- Starts with whatever has not been prayed today; if everything is done, it
  walks the whole list again.
- Prayed advances and marks; Skip advances without marking; Back steps
  backwards. Swipe left and right do the same. Right arrow or space marks and
  advances, left arrow goes back, Escape closes.
- A thin bar tracks position. The last button reads "Prayed, finish".
- Finishing closes the overlay and surfaces the milestone line, if there is one.

## Kitchen view

Large-type, no-chrome, scrollable rendering of whichever list is active, grouped
by category. For casting to a screen or leaving open on a counter. Read-only by
design — nothing is tappable, so it cannot be disturbed by a passing child.

## Printing

A print button builds `#printArea` and calls `window.print()`. The print
stylesheet hides the entire app and shows only that: title, date, request count,
then categories with a tick box against each request, plus answered prayers from
the last 90 days. Designed for a paper list at a prayer meeting.

## Who prayed

`D.me` holds the name of whoever is using this device, set under More. On the
**family list only**, marking something prayed adds that name to
`prayedBy[TODAY]` and the row shows initials. Unmarking removes just that
person's name. The private list ignores this entirely.

## Family list sync

Optional, off by default, and it only ever touches the family list. The private
list never leaves the device.

The shared list lives as a JSON file in a GitHub repo:

- **Reading is unauthenticated** — every device pulls
  `raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` on load, on tab
  focus, and every 90 seconds.
- **Writing needs a fine-grained token with contents:write on that repo only.**
  The token is entered per device and kept in `localStorage` under
  `prayer-sync-token`. It is never written into the page, never committed, and
  never exported in a backup. A device with no token is read-only and says so.
- Changes push on a 2.5 second debounce after any edit to the shared list.

**Merge is per-request, not whole-file.** Union by id; the newer `updatedAt`
wins the fields; `updates` are unioned and de-duplicated on date plus text;
`prayedBy` is unioned per date so two people marking the same request on the
same day both show; `lastPrayedAt` takes the later of the two; categories and
`prayerDays` are unioned. Deletions do not propagate — that is deliberate, since
last-write-wins deletion across devices loses data quietly.

**Say this plainly to whoever sets it up:** anything in a public repo is public.
Names and situations on the family list will be readable by anyone who finds the
URL. Use a private repo, or keep the family list to things you would not mind a
stranger reading. Every request also stamps `updatedAt`, which is what makes
merging work — do not remove it.

---

## Out of scope for v1

Accounts, notifications, Bible verse lookup, photos on requests.

## Possible v2

- Read/write a JSON file in the repo via the GitHub API so data survives Safari
  eviction and an Apple Shortcut can append by voice from the Watch. Design v1
  so this is a swap of the storage layer only.
- Photos on requests. Seeing a face changes how you pray for someone. Wants the
  repo-backed storage first, since images against localStorage make eviction
  much more likely.
- An Apple Shortcut that appends to the synced JSON by voice from the Watch.
  The sync layer already writes that file, so this is mostly Shortcut work.
