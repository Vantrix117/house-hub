# Prayer (`prayer`) — Phase 3 deep dive

| | |
|---|---|
| **App code audited** | `fe6041d`, unchanged since the Phase 0 baseline. This phase changed no app code. |
| **File(s)** | `apps/prayer.html` (1,782 lines). Shared code it depends on: `apps/hub.js` (500), `apps/design.css` (617), `worker/src/data.js` (72); the Home card and the TV's "who prayed today" faces in `index.html` (1,716). Registry entry: `apps.json:6`. Reference material: `handoff/prayer/SPEC.md`, `handoff/prayer/prayer.html`, `handoff/prayer/check.js`. |
| **Date** | 2026-09-24 |
| **Inputs** | `audits/00-inventory.md` §9b "prayer — Prayer" (lines 3544-3674); 809 Phase 1 captures under `audits/screens/prayer/` and 46 contact sheets `audits/screens/_sheets/prayer--*.jpg`; `audits/01-leads.md` "Prayer" (lines 155-209, 27 leads); Phase 2 IDs P2-SYNC-01, P2-SYNC-02, P2-SYNC-03, P2-SYNC-05, P2-SYNC-06, P2-SYNC-09, P2-SYNC-17, P2-STAB-01, P2-STAB-03, P2-PWA-01, P2-PWA-04, P2-PWA-13, P2-PROF-05, P2-PROF-09, P2-PROF-14, P2-PROF-15, P2-SEC-02; from other apps' Phase 3 reports, P3-TALLY-05, P3-TALLY-06 and P3-DOLLYWOOD-LIVE-01. |
| **Runtime** | Local instance with the demo household (typical seed; demo clock Tue 22 Sep 2026 08:40 New York unless stated), Playwright WebKit. Chromium and the real clock where stated. No production data or endpoint was touched. |
| **Reproduce** | Scripts in `audits/tools/phase3/prayer/`, evidence in `audits/evidence/p3/prayer/`. Run each with `node "audits/tools/phase3/prayer/<name>.mjs"`. Screenshots are rewritten at 1× CSS scale by `node audits/tools/phase3/prayer/to1x.mjs`. |

**How to read this.** Every bug, security or perf finding went to two independent skeptics. Each re-read the code and re-ran the finding with their own script; a third skeptic would have broken a tie, but none was needed. A defect is **CONFIRMED** only when at least two skeptics reproduced it and more confirmed it than refuted it. Refuted findings go under "Checked and not a bug", and undecided ones under "Unresolved". UX, VIS, GAP and OK items describe the design, not malfunctions, so they were not adversarially verified. A separate agent re-checked every rubric score against the screenshots; a judge would have settled any gap of 2 or more points, but none arose. A completeness critic then read the report against the brief, ran ten more candidates, and sent them through the same two-skeptic verification; all ten were confirmed and are filed as P3-PRAYER-17 to -26 (one of them, -24, was a code-only note in the §5 deviations table before). Severity follows the rule at the top of `audits/02-shell.md` (lines 25-37).

## Summary

- **What it is.** Two prayer lists in one app: a private list (person scope) and a family list (family scope), with a daily plan, a guided "Pray now", an answered-prayer record, and Kitchen, Print and Copy outputs. Every adult uses it daily. Ezra and Kiara see only the family list, as big "Prayed" cards. The TV never opens it but shows the family list's "who prayed today" faces (`index.html:1058-1059`).
- **Confirmed defects: 26** (4 critical, 3 high, 5 medium, 14 low). None was refuted or left unresolved. Sixteen came from the investigator and ten (P3-PRAYER-17 to -26) from the completeness critic, all verified 2/2. The four criticals all lose household data through the shipped UI:
  - **P3-PRAYER-01 (the worst):** two devices adding a request pick the same sequential id, and one typed request silently disappears for the whole house. It reproduced in 6 of 6 runs across the investigator and both skeptics.
  - **P3-PRAYER-02:** a slow or failed first pull on a new device replaces the person's prayed-days history (41 → 0) and plans, and the family list's too.
  - **P3-PRAYER-03:** Import a backup ("replaces both lists on this device") tombstones other people's newer family requests and today's prayed marks.
  - **P3-PRAYER-04:** "Put back on the list" erases an answered prayer's note with one tap, no confirm and no undo (raised from medium by both skeptics).
- **High:** on the family list one person's tick shows as everyone's, and a second adult's tap unticks it for the house (P3-PRAYER-05); a crafted family row id runs script in other people's Prayer, including the admin's, and can read their session tokens (P3-PRAYER-06, security; downgraded from critical because planting it needs a hand-made API request); a crafted family plan id does the same through the Settings plan list, and unlike -06 it never removes itself (P3-PRAYER-17, from the critic; the same downgrade).
- **Added after the completeness critic.**
  - Medium: "Send to family list" copies the private request's For and category although its panel offers only the title, and the push adds "(for …)" (P3-PRAYER-18); an open Kitchen view never picks up other people's changes (P3-PRAYER-19); the Add form never names the list it adds to, so a private request can land on the family list (P3-PRAYER-20).
  - Low: an undone tick still counts the day in the streak (P3-PRAYER-21); every Sunday says "Some of the list has gone quiet" even when nothing has (P3-PRAYER-22); removing a focus plan's category leaves the plan pointing at nothing (P3-PRAYER-23); family prayed marks are kept by display name, so a guest named David shows with Dad's face (P3-PRAYER-24); a title edit is pushed as "New on the family list" (P3-PRAYER-25); Escape and Enter do nothing outside Pray mode (P3-PRAYER-26).
- **Cross-app pointers (not filed as Prayer defects, by code, not run).**
  - P2-SYNC-03: the legacy blob could overwrite the server's rows in both scopes on a slow first pull.
  - P3-TALLY-06: a guest could take the previous adult's private list through `hub.migrate`. That would be rule (b), critical, if confirmed; it is the priority follow-up under "Not verified".
  - P3-TALLY-05: family-list writes queued when Prayer closes wait until it reopens.
  - P3-DOLLYWOOD-LIVE-01: a third stored-XSS sink, with the same amplifier as P3-PRAYER-06 and -17.
- **Rubric: final average 4.7 / 10** (investigator 5.2). The visual checker lowered Color, Shape, Motion, Dark mode and Ease of use by one point each. Delight is best at 6; Glanceability is worst at 3.
- **Biggest usability gaps.** Pre-readers cannot tell prayed from not prayed (the untapped button already says "✓ Prayed") or one request from another (UX-PRAYER-2). Nothing, not even "Kitchen view", is legible beyond about 1 m (UX-PRAYER-3). The Add form's button starts under the tab bar (UX-PRAYER-1). Neither Settings nor Add says which list it acts on (UX-PRAYER-4, P3-PRAYER-20).
- **Biggest visual gaps.** Gold labels and dates fail contrast at 2.78-3.47 and several other pairs fall under 4.5 (VIS-PRAYER-1); web fonts, an off-scale type ramp and 107 of 167 spacing values off the 4-pt grid; no loading state (UX-PRAYER-8).
- **What works.** The daily tick is 2 taps from Home, Pray now is calm and well made, the answered record with serif notes and anniversaries is the app's heart, date maths is DST-safe, there are no native dialogs, glass stays on the navigation layer, and kid mode keeps kids on the family list with 64 px buttons (OK-PRAYER-1 to 4; `handoff/prayer/check.js` 49/49).
- **Best-value improvement.** Per-person done on the family list (delight 5, effort S), which fixes P3-PRAYER-05. The most urgent fixes are the four data-loss criticals: collision-free ids (`hub.uid` already exists, `apps/hub.js:437`), no writes of list settings before the first pull has landed (shared with P2-SYNC-02/-17), a restore that never deletes other people's rows, and keeping the answer note on "Put back on the list". The two stored-XSS sinks (P3-PRAYER-06, -17) share one fix: `esc()` on every id placed in markup.

## 1. Purpose and top jobs

Prayer keeps two lists (`apps/prayer.html:576-586`): `lists.personal` in the signed-in person's scope and `lists.shared` in the family scope. Around them it adds plans (daily, weekly days, rotation; by-day categories; one category), a guided Pray now (Back / Prayed / Skip), prayed-today faces and "X asked" on family rows, an answered record (Record → Answered, "Answered recently", anniversaries, milestones), "Tell them you prayed", "Send to family list", a paste parser, Kitchen view, Print, Copy, and JSON export and paste import. `apps.json:6` makes it visible to the five adults and both kids, not the TV.

| # | Job | Who | How often |
|---|---|---|---|
| 1 | Pray through today's list: tick circles or step through Pray now | Every adult | Daily, mostly mornings; 6-9 requests a day in the seed |
| 2 | Pray for the family list | Adults via the Mine/Family switch; Ezra and Kiara as big "Prayed" cards (the only list they see) | Daily |
| 3 | Add a request, or record an answer | Adults: +, Add, Mark answered, Send to family list | Add a few times a week; answer a few times a month |

## 2. Features and gaps

**References.**
- **Apple first-party: Reminders shared lists.** https://support.apple.com/en-us/105124 was read: members of a shared list can add, delete and complete items, a reminder can be assigned to a person, and alerts can fire when someone adds or completes an item. The guide page https://support.apple.com/guide/iphone/share-and-collaborate-iph2a8f9121e/ios returned only navigation.
- **Best in class: Echo Prayer** (https://www.echoprayer.com/ and its App Store listing, from search snippets): categories, mark as answered, reminders for single prayers, groups and feeds at chosen times, private sharing with people or groups, and Pray Now with a timer. **PrayerMate** (product knowledge, not fetched): rotates a few subjects per category each day and reminds at a set time.

| Capability | This app | Reference | Gap |
|---|---|---|---|
| Private and shared lists | Yes: person and family scope with a Mine/Family switch (`apps/prayer.html:585-586, 1271-1274`) | Reminders: separate lists, any of them shared | None, but neither Settings nor Add says which one it acts on (UX-PRAYER-4, P3-PRAYER-20) |
| Add, edit, delete | Yes; delete confirms inline (`apps/prayer.html:1255-1261`) | Reminders: members add, delete and complete | Adds from two devices collide (P3-PRAYER-01); the family delete copy is wrong (P3-PRAYER-15) |
| Mark prayed today | Circles and Pray now; family rows show faces (`apps/prayer.html:1593-1607`) | Reminders: complete; Echo: Pray Now | Family done state is house-wide, not per person (P3-PRAYER-05); faces are matched by display name (P3-PRAYER-24); an un-tick keeps the day in the streak (P3-PRAYER-21) |
| Rotation, cadences and plans | Daily, weekly days, rotation; three plan modes (`apps/prayer.html:809-835`) | PrayerMate daily rotation | Matches or beats |
| Guided prayer | Pray now with Back / Prayed / Skip, swipe and keys | Echo Pray Now with a timer | No timer (minor); not full-screen in the hub (UX-PRAYER-9) |
| Answered record | Status, date and a required note; Record, "Answered recently" (30 days), anniversaries, milestones, print (90 days) (`apps/prayer.html:1323-1331`) | Echo: mark as answered | Beats it, but "Put back on the list" erases the note (P3-PRAYER-04) and Record has no search or grouping (GAP-PRAYER-2) |
| Reminder at a chosen time | No; only the "new family prayer" push (`worker/src/reminders.js:174`) | Echo per-prayer and group reminders; Reminders alerts | Yes (GAP-PRAYER-1) |
| Telling the asker someone prayed | Manual only: "Tell them you prayed" (sms: or copy) | Reminders alerts on completion | Yes (GAP-PRAYER-1) |
| Assign to a person | "For" is free text; family rows record who asked | Reminders: assign | Yes |
| Undo | Only after Mark answered (`apps/prayer.html:1331`), and it fails if a pull lands in its 6 s (P3-PRAYER-09) | Reminders: undo (product knowledge) | Yes |
| Sharing | "Send to family list" copies the request (`apps/prayer.html:1306-1323`) | Echo: private sharing with groups | Weekly days are dropped (P3-PRAYER-08); For and category are copied although only the title is offered (P3-PRAYER-18) |
| Backup | Export downloads JSON; import is paste-only (`apps/prayer.html:1500-1527`) | — | Import deletes others' rows (P3-PRAYER-03); no file picker (UX-PRAYER-12) |
| Pre-reader use | Big cards, the asker's face, one 64 px Prayed button (`apps/prayer.html:1577-1591`) | — | No picture or read-aloud; state by colour only (UX-PRAYER-2) |
| Kitchen, Print, Copy | Yes, behind Today's "··· More" (`apps/prayer.html:1725-1747`) | — | Kitchen view is not room-scale (UX-PRAYER-3) and never refreshes while open (P3-PRAYER-19) |

## 3. Ease of use

Taps measured with real clicks in `audits/tools/phase3/prayer/taps.mjs` (iPhone PWA, demo clock, typical seed; evidence `audits/evidence/p3/prayer/taps.json`):

| Job | Profile | Path | Taps | Target ≤ 2 for the most frequent | Met? |
|---|---|---|---|---|---|
| Mark one of today's requests prayed (most frequent) | Eli (adult) | Home Prayer card "Open prayer" → circle | 2 | ≤ 2 | **Yes** |
| Pray through today's list with Pray now (6 requests) | Eli | Open prayer → Pray now → Prayed × 6 | 8 | n/a | n/a |
| Mark a family request prayed (last list was Mine) | Eli | Open prayer → Family → circle | 3 | ≤ 2 (daily job) | **No** |
| Add a request to my list | Eli | Open prayer → + → type the title → scroll ("Add to the list" starts under the nav) → Add to the list | 3, plus typing and a scroll | n/a | n/a |
| Mark answered (request on Today) | Eli | Open prayer → row → Mark answered → type the note → Mark answered | 4, plus typing | n/a | n/a |
| Mark answered (request not on Today) | Eli | Open prayer → List → open category → row → Mark answered → type → save | 6, plus typing | n/a | n/a |
| Say "I prayed" for a family request | Kiara (kid) | Home "Let's play — open your apps" → Apps: Prayer tile → Prayed | 3 | ≤ 2 (daily job) | **No** (kid Home has no Prayer entry) |

- **Discoverability.** Today's actions are visible, but:
  - two different controls are both called "More" (UX-PRAYER-5);
  - List's category groups give no sign that they open (UX-PRAYER-7);
  - Settings never names the list it edits (UX-PRAYER-4), and neither does the Add form (P3-PRAYER-20);
  - a family request's detail sheet hides who asked and who prayed (UX-PRAYER-6);
  - on a keyboard, Escape closes only Pray mode and Enter submits nothing (P3-PRAYER-26).
- **Undo.**
  - Mark answered has an Undo toast (`apps/prayer.html:1331`), which silently does nothing if a remote change lands within its 6 s (P3-PRAYER-09).
  - "Put back on the list" erases the answer note with no confirm and no undo (P3-PRAYER-04).
  - An un-tick has no undo, and on the family list it clears the tick for the house (P3-PRAYER-05). An un-tick also leaves the day counted in the streak and calendar (P3-PRAYER-21).
  - Delete confirms inline.
- **Error prevention.** A title and an answer note are required, and a weekly request needs at least one day (`apps/prayer.html:1435, 1056`). But Import replaces the family list for everyone while saying "on this device" (P3-PRAYER-03), taps before the data has loaded throw and are lost (P3-PRAYER-10), Add saves to whichever list Today last showed without naming it (P3-PRAYER-20), and Send to family list copies the For and category without offering them (P3-PRAYER-18).
- **One-handed phone use (430×932).** Pray now sits in the top third (y 334-394). The + is bottom right (352, 742, 56×56) and the nav starts at y 807. The Add form's main button opens at y 846, under the nav (UX-PRAYER-1). The + covers the last content on Today and List (VIS-PRAYER-2). Evidence: `audits/evidence/p3/prayer/layout.json`.
- **iPad glanceability at 2-3 m.** Using the heuristic "readable when cap height ≥ distance / 200" at 0.192 mm per CSS px (11-inch iPad):

  | Element | Readable to |
  |---|---|
  | Page title (h1, 31 px) | 0.88 m |
  | Row titles (17.5 px) | 0.50 m |
  | Meta and date | 0.38 m |
  | Nav labels (12 px) | 0.35 m |
  | Kid card titles (34 px) | 0.96 m |
  | "Kitchen view — Big type for the counter": items (24 px) | 0.69 m |
  | Kitchen view heading | 1.0 m |

  Nothing reaches 2-3 m, which needs roughly 90-130 px type (UX-PRAYER-3; `audits/evidence/p3/prayer/layout.json` `readableAtMetres`).
- **Pre-reader use (Ezra, Kiara).**
  - Each card is the request as text (unreadable at 4-5), the asker's face with "Mae asked", and one 64 px button.
  - The button reads "✓ Prayed" before it is tapped and after; only the fill changes, from the profile colour to olive (UX-PRAYER-2).
  - After a tap the kid's own face appears under "prayed today", which is the one non-reading cue.
  - There is no picture, no read-aloud and no undo; a second tap keeps the mark.
  - The path from kid Home is 3 taps.

## 4. Issues and bugs

### Register

| ID | Severity | Defect |
|---|---|---|
| P3-PRAYER-01 | critical | Two devices adding a request pick the same sequential id; one request is silently lost for the whole house |
| P3-PRAYER-02 | critical | A slow or failed first pull on a new device overwrites the person's prayed-days history and plans (and the family list's) |
| P3-PRAYER-03 | critical | Import a backup tombstones other people's newer family requests and erases today's prayed marks |
| P3-PRAYER-04 | critical | "Put back on the list" erases the answer note with one tap, no confirm and no undo |
| P3-PRAYER-05 | high | On the family list one person's tick shows as everyone's, and a second adult's tap unticks it for the house |
| P3-PRAYER-06 | high | Stored XSS through a family prayer row's id: script runs in kids' and the admin's Prayer and can read session tokens |
| P3-PRAYER-17 | high | Stored XSS through a family plan id in the Settings plan list: runs in kids' and the admin's Prayer and never removes itself (from the critic) |
| P3-PRAYER-07 | medium | On List, a tick or any remote change folds every open category shut |
| P3-PRAYER-08 | medium | "Send to family list" drops a weekly request's days, so the copy never shows on the family Today |
| P3-PRAYER-18 | medium | "Send to family list" publishes the private request's For and category although its panel offers only the title; the push adds "(for …)" (from the critic) |
| P3-PRAYER-19 | medium | An open Kitchen view never refreshes: other people's adds and answers do not appear (from the critic) |
| P3-PRAYER-20 | medium | The Add form never says which list it adds to, so a private request can land on the family list (from the critic) |
| P3-PRAYER-09 | low | Undo after Mark answered does nothing if a remote change lands within its 6 s |
| P3-PRAYER-10 | low | Taps before the data loads throw: the Mine/Family choice and screen changes are lost, and Record shows a stray + |
| P3-PRAYER-11 | low | A phone outside New York time files prayed marks under its own local date, so the TV leaves the person off |
| P3-PRAYER-12 | low | The "Needs attention" badge counts a request twice (8 for 6) |
| P3-PRAYER-13 | low | The gold streak cheer shows under "Nothing on the list today." |
| P3-PRAYER-14 | low | A category row's count (active only) disagrees with its Remove confirm (active and answered) |
| P3-PRAYER-15 | low | The family delete confirm says deletions do not sync, but they do |
| P3-PRAYER-16 | low | The headline says "to pray through this morning" at any hour |
| P3-PRAYER-21 | low | An undone tick still counts the day in the streak, month count and calendar (from the critic) |
| P3-PRAYER-22 | low | Every Sunday Today says "Some of the list has gone quiet" even when nothing has (from the critic) |
| P3-PRAYER-23 | low | Removing the category a "One category only" plan uses leaves the plan pointing at a deleted category (from the critic) |
| P3-PRAYER-24 | low | Family prayed marks are kept by display name: a guest who shares a household name is shown as that person (from the critic) |
| P3-PRAYER-25 | low | Editing a family request's wording makes the prayer push announce it as "New on the family list" (from the critic) |
| P3-PRAYER-26 | low | Escape closes only Pray mode; the sheet, More, Kitchen view and ask panels ignore it, and Enter submits nothing (from the critic) |

The register is in severity order. IDs 17-26 were added after the completeness critic, so their numbers follow the original sixteen.

### Phase 2 defects that show up here

- **P2-SYNC-02** (critical). A kid's, or an adult-on-Family, first open resets the family plan, streak and calendar for the house. Seen again: Kiara's fresh page header read "Tuesday, September 22 · Everything" instead of "Around the table" (`audits/evidence/p3/prayer/leads.json` L9-kidHeader). P3-PRAYER-02 widens it: the same wipe reaches the family list when an adult on the personal list opens Prayer on a new device over a slow or failed pull, which P2-SYNC-02's corrected claim had called safe.
- **P2-SYNC-17** and **P2-SYNC-05** (critical, proven on F260). The same root cause: `hub.ready` resolves before the app's first pull, and the app treats "no data yet" as "no data" (`apps/hub.js:334-337`). In Prayer it shows as P3-PRAYER-02 and P3-PRAYER-10.
- **P2-SYNC-03** (critical), by code, not run. `migrateLegacy()` (`apps/prayer.html:640-651`) passes the pre-profiles blob through `hub.migrate`, whose check is the local-only `!hub.has` (`apps/hub.js:406-407`). On a device that holds the legacy blob with no `hub.migrated` mark, and whose first pull has not landed, legacy list keys and `prayer:*` rows would be set over the server's in both scopes. The family scope is not a shell channel, so the shell cannot pull it first.
- **P2-SYNC-06** (critical). An import of more than 200 rows is dropped whole while the app says "Backup restored.". The under-200 deletion of other people's rows is the separate facet P3-PRAYER-03.
- **P2-SYNC-09** (critical). A pull in flight during Switch put three of Eli's private prayer rows into guest Grandma Jo's Prayer.
- **P2-SYNC-01** (critical). `prayedBy` lives inside the one `prayer:<id>` row, so a stale device's Prayed tap or edit erases another person's mark on the same family request; plans, categories and `prayerDays` are whole-array rows under last-write-wins. A delete can also be undone by a stale offline device's write (seen by the P3-PRAYER-15 skeptic, `audits/evidence/p3/prayer/verify-delete-copy-wrong-2.json` test B).
- **P2-PROF-14** (critical). A device with a fast clock made Mom's Prayer edit and Kiara's Prayed tap revert silently. Related to P3-PRAYER-01 (a different mechanism on the same rows).
- **P2-STAB-03** (critical). TODAY is frozen at load (`apps/prayer.html:712`), so after midnight taps file under yesterday and an adult's toggle deletes yesterday's mark. Not re-run. P3-PRAYER-05 is the same-day trigger of the same toggle.
- **P2-PWA-01** (critical). "Prayed for <title>" and "Answered: <title>" are posted for private requests (`apps/prayer.html:1606, 1329`) and reach the Home feed and the TV; the chat tools `mark_prayed` and `answer_prayer` share the path.
- **P2-STAB-01** (critical). With Reduce Motion on the whole hub, and so Prayer, is blank. Prayer's own reduced-motion rule (`apps/prayer.html:384`) is fine.
- **P2-PWA-04** (medium). Family requests added after the 8 am prayer push are never pushed to adults who already got one. P3-PRAYER-25 is the other side and makes it likelier: a title edit is pushed as new and uses up that day's one prayer push.
- **P2-PROF-05** (medium). A kid's hand-made batch tombstoned 8 of 11 family prayers. The same unchecked write path carries the XSS row id (P3-PRAYER-06) and the XSS plan id (P3-PRAYER-17).
- **P2-PROF-09** (medium). The shared iPad never returns to the picker, so an adult's private list, or an open Kitchen view of "My list", stays on the counter. An open Kitchen view also never refreshes (P3-PRAYER-19).
- **P2-PROF-15** (low). After Switch, localStorage keeps `hub.cache.prayer.person.eli` (19 private rows) on the shared iPad.
- **P2-PWA-13** (low). Overlapping `hub.activity` calls can double feed lines; Prayer posts one per tap and one per Pray-now step (UX-PRAYER-13).
- **P2-SEC-02** (low). Prayer's `visibleTo` is enforced only in the client.

**From another app's Phase 3 report:**
- **P3-TALLY-06** (hub.js cause, `apps/hub.js:400`; `audits/03-apps/tally.md`). `hub.migrate` treats a guest as an adult. A guest who is first to open Prayer on a device holding the legacy blob would take the blob's *personal* list, the previous adult's private requests, into the guest's own person scope and see it. That would be rule (b) if confirmed. By code; not run. It is a priority follow-up under "Not verified".
- **P3-TALLY-05** (shell cause; `audits/03-apps/tally.md`). `prayer|family` is not a shell channel (`index.html:457-458`, as P2-SYNC-02 also notes). Family-list writes still queued when Prayer closes (Prayed taps, new or answered family requests) wait until Prayer reopens on that device. By code; not run.

### Confirmed defects

#### P3-PRAYER-01 — Two devices adding a request pick the same id; one request is silently lost

- **Severity: critical** (skeptics: critical / critical; unchanged). Rule (a): a request someone typed through the shipped UI (nav Add, then "Add to the list") disappears for the whole house with no message, and no dev tools are needed.
- **Exposure.** Two devices add to the same list before either has pulled the other's row. Online that is within one 30 s poll (`apps/hub.js:342`), for example two adults on a busy morning. With one device offline it is any time, for example a phone at church. It also happens to one person using a phone and the iPad on their private list.
- **Related.** P2-PROF-14 (last-write-wins on existing rows); this is two new requests landing on one key, which no P2 ID covers.

**What happens now.** New ids are counted per device:
- `nextId()` is `'p' + (rows this device holds + 1)`, skipping only ids this device already has (`apps/prayer.html:719-721`). Add (`:1436`) and the paste parser (`:1486`) use it.
- "Send to family list" uses `'s' + (family rows + 1)` (`apps/prayer.html:1312-1314`).
- `save()` writes each request as the row `prayer:<id>` (`apps/prayer.html:685-695`); `hub.set` stamps it with the current time (`apps/hub.js:231-243`); the pull and the Worker keep only the newer copy (`apps/hub.js:295`; `worker/src/data.js:39-64`).

The investigator lost one of two requests in all four variants:
- **A** (family list, both online, adds 3 s apart): both `p012`; Eli's request gone from the server and both devices.
- **B** (family list, Mae's iPad offline): both `p012`; Mae's request gone.
- **C** (Eli's private list, phone offline and the kitchen iPad): both `p020`; one private request gone.
- **D** (two "Send to family list" taps by Eli and Elizabeth): both `s012`; Eli's gone.

**Expected.** Collision-free ids (`hub.uid()`, `apps/hub.js:437`, or `crypto.randomUUID()`), as CLAUDE.md promises ("Lists are one row per item … so two people never overwrite each other") and as the app's own storage comment says (`apps/prayer.html:579-580`).

**Why it matters to the household.** A prayer request someone took the time to type vanishes for everyone, nobody is told, and nothing can bring it back.

**Evidence.**
- Code: `apps/prayer.html:719-721, 1312-1314, 1436, 1486, 685-695`; `apps/hub.js:231-243, 295, 437`; `worker/src/data.js:39-64`.
- Runs: `audits/evidence/p3/prayer/id-collision.json`, `audits/evidence/p3/prayer/id-collision-D.json`, `audits/evidence/p3/prayer/verify-id-collision-1.json`, `audits/evidence/p3/prayer/verify-id-collision-2.json`.
- Screenshots: `audits/evidence/p3/prayer/id-collision-A-eli-phone-after.png`, `audits/evidence/p3/prayer/verify-id-collision-2-S1-mom-phone.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/id-collision.mjs"` (about 4 minutes; pass A, B, C or D for one variant). It prints:
- A `{idA:p012, idB:p012, familyRowsAfter:12, 'Eli: rides for Grandma Jo' onServer:false, phoneShows [false,true]}`
- B Mae's request `onServer:false`
- C `{idA:p020, idB:p020, 'Private: courage…' onServer:false}`
- D `{idA:s012, idB:s012, "Eli asks: Dad's knee recovery" onServer:false}`

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read `apps/prayer.html:719-721, 1311-1314, 1436, 1486, 685-692` and `apps/hub.js:231-242, 295-299`, and ran `node "audits/tools/phase3/prayer/verify-id-collision-1.mjs"` (real clock, WebKit, UI only):
  - V1 (Eli's iPhone and Mae's kitchen iPad, family list, online, 3 s apart): `{idA:'p012', idB:'p012', familyRowsAfter:12, onServer:{'V1 Eli: new job for Sam':false, 'V1 Mae: safe travel for Aunt Ruth':true}}`; Eli's request was gone from the server and from his own phone.
  - V2 (Eli's phone offline and the iPad as Eli, private list): `{idA:'p020', idB:'p020', personRowsAfter:20, onServer:{phone's:false, iPad's:true}}`; the phone still showed its own request while the server and the iPad held the other one.
- **Skeptic 2** used other people and devices and ran `node "audits/tools/phase3/prayer/verify-id-collision-2.mjs"` (real clock, WebKit):
  - S1 (Elizabeth's new phone and David on the iPad, family list, online, 2 s apart): `{idA:'p012', idB:'p012', onServer:{'Mom: safe travel for Aunt Ruth':false, 'Dad: the roof estimate':true}, momPhoneState:{sync:'synced', toast:''}}`.
  - S2 (Mae's private list, phone offline): both `p006`; the request typed first, on the offline phone, was lost, and both devices read `synced` with no toast.
  - S3 control (adds after both devices had pulled): `p013`, both titles on the server. Ids collide only when neither device has seen the other's row.

**Corrected claim.** Confirmed as filed, with two details:
- Offline, the request typed first is the one lost. The reconnecting device's older stamp is rejected, and the flush overwrites its local copy with the server's row (`apps/hub.js:253-284`), so it then reads "synced" (skeptic 2). In skeptic 1's V2 run the phone kept showing its own text until its next pull, so for a while the devices disagree about what `prayer:p020` is.
- The skeptics re-ran A and C; B and D were run by the investigator only. D uses the same count-based pattern (`apps/prayer.html:1312-1314`).

#### P3-PRAYER-02 — A slow or failed first pull on a new device overwrites the person's prayed-days history and plans

- **Severity: critical** (skeptics: critical / critical; unchanged). Rule (a): a plain open, with no tap, permanently replaces the person's saved streak history and plans on the server, and the family list's too. Last-write-wins keeps no history to restore from.
- **Exposure.** Prayer's first open for a profile on a device with no Prayer cache (a new phone, a re-pair, "Forget this device", a first sign-in on the shared iPad), when the first `prayer/person` pull takes more than 6 s **or fails at all**. A single failed request is enough and opens the window within about 0.5 s.
- **Related.** P2-SYNC-02 (family-scope reset on first open), P2-SYNC-05 and P2-SYNC-17 (the same `hub.ready` root cause on F260). This is the person-scope facet with a new trigger, and it also rewrites the family list for an adult on the personal list.

**What happens now.** On a device with no cache for the app's channels, `hub.ready` races the first pull against 6 s, and resolves at once if the pull fails (`apps/hub.js:334-337`). Prayer then builds its lists from the empty cache (`apps/prayer.html:624-639`) and paints "Nothing on the list today." with all-zero stats. With the default "everything" plan, `todaySet()` freezes a rotation and calls `save()` on first paint (`apps/prayer.html:826-833`), and `save()` writes every list key it never read from the server (`apps/prayer.html:685-695`, `put()` at `:652-656`). When the real rows arrive, `pullScope` skips them because the queued writes are newer (`apps/hub.js:295`).

Investigator run (person GET held 9 s): first paint at 6383 ms, then one POST of 8 person keys (`label, categories, prayerDays, plans, activePlan, rotationFor, activeList, lastExport`) and one of 6 family keys. On the server Eli's `prayerDays` went 41 → 0 and `plans` went `['Morning','Sunday missions']` → `['Everything']`; after 20 s the page read "0 days in a row". Control (no hold): first paint at 264 ms, no POSTs.

**Expected.** Write nothing that was not read from the server. `hub.ready` (or the app) waits for the first pull of the channels it reads, or defers list-setting writes until then.

**Why it matters to the household.** Months of "days in a row", the month count, the Record calendar and a person's named plans are replaced for good by a cellular hiccup on a new phone, and the family list's plan and streak with them.

**Evidence.**
- Code: `apps/hub.js:295, 316-319, 334-337`; `apps/prayer.html:624-639, 652-656, 685-695, 826-833`.
- Runs: `audits/evidence/p3/prayer/slow-start.json`, `audits/evidence/p3/prayer/verify-slow-start-person-wipe-1.json`, `audits/evidence/p3/prayer/verify-slow-start-person-wipe-2.json`.
- Screenshots: `audits/evidence/p3/prayer/slow-start-hold9s-first-paint.png`, `audits/evidence/p3/prayer/slow-start-control-first-paint.png`, `audits/evidence/p3/prayer/verify-slow-start-person-wipe-1-fail503-first-paint.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/slow-start.mjs"`. It prints hold9s `firstPaint {ms:6383, headline:'Nothing on the list today.'}`, `posts [person 8 keys, family 6 keys]`, `after {prayerDays:0, plans:['Everything']}` against `before {prayerDays:41, plans:['Morning','Sunday missions']}`; control `posts []`, unchanged.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-slow-start-person-wipe-1.mjs"` (real clock, WebKit, a new iPhone for Eli per arm):
  - control: first paint 256 ms, "6 to pray through this morning.", no POSTs; server unchanged (person `prayerDays` 41, family 29).
  - latency (the server answers at once but the response is held 9 s, so the real rows exist before any POST): first paint 6387 ms empty; POST person at 6734 ms and family at 6755 ms; after: person `prayerDays` 0, family `prayerDays` 0, both `plans [Everything]`; `prayer:*` rows unchanged (19 → 19, 11 → 11); after 20 s "3/6 today0 days in a row".
  - fail503 (first person GET returns 503 for 5 s): first paint 317 ms empty; the same two POSTs at 639 and 658 ms; the same wipe; still "Nothing on the list today." after 20 s.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-slow-start-person-wipe-2.mjs"` (real clock, WebKit):
  - A control: first paint 251 ms, "9 days in a row, 18 days this month", no POSTs.
  - B hold 9 s: first paint 6271 ms "0/0 today, 0 days in a row"; POST person (8 keys) at 6573 ms and family (6 keys) at 6590 ms; server after `prayerDays 0, plans [Everything]`, family `0 days, plans [Everything]`; screen after 25 s "3/6 today, 0 days in a row", sync state "synced".
  - C network error for 15 s: first paint 222 ms; POSTs at 480 and 503 ms; the same wipe; the screen stayed empty.
  - The seeded row stamps were all in the past (-7 h to -329 h), so the future-stamp effect of P2-PROF-14 does not apply.

**Corrected claim.** The claim holds, and the trigger is wider:
- A failed first pull (503 or a network error) triggers it within about 0.3-0.5 s, because `hub.pull` swallows the error and `hub.ready` resolves at once (`apps/hub.js:316-319, 337`).
- It is not an artefact of holding the request: when the server has already answered, the wipe is the same.
- The same `save()` wipes the family list's `prayerDays` (29 → 0) and plans for an adult on the personal list.
- The request rows (`prayer:*`) survive. What is lost is the list settings and history: `prayerDays` (streak, month count, calendar), `plans`, `activePlan`, `rotationFor`, plus any custom `categories` or `label`.
- Not tested: a first sign-in on a device whose Prayer cache is already filled for another profile, where `hub.ready` would not wait at all.

#### P3-PRAYER-03 — Import a backup tombstones other people's newer family requests and erases today's prayed marks

- **Severity: critical** (skeptics: critical / critical; unchanged). Rule (a): More → Import a backup, an adult-facing control, deletes another person's family request for the whole house and erases a kid's prayed mark, with no undo, while the copy says the import only affects "this device".
- **Exposure.** An adult restores a backup made before someone else's latest change to the family list.
- **Related.** P2-SYNC-06 owns the import of more than 200 rows that is dropped whole. This import was 11 family rows, accepted by the server ("synced").

**What happens now.** The import panel says "This replaces both lists on this device." (`apps/prayer.html:1520`). On Import it runs `D = readBackup(txt); migrate(); save()` (`apps/prayer.html:1524`). `save()` rewrites every family row that differs from the backup with a new stamp, and tombstones every family `prayer:` row this device has loaded that is not in the backup (`apps/prayer.html:692`). Investigator run:
1. Eli exported through the real download (`prayers-2026-09-24.json`, 26,361 bytes).
2. Mae added a family request (`prayer:p012`).
3. Kiara tapped Prayed on `s004`.
4. Eli imported his backup. The toast read "Backup restored."

The server then held a tombstone for `prayer:p012`, Kiara's `prayedBy['2026-09-24']` was gone from `s004`, and Mae's phone lost her request on its next pull.

**Expected.** Import restores only what the importing person owns, or it warns that it replaces the family list for everyone and merges instead of deleting or overwriting newer rows.

**Why it matters to the household.** Other people's prayer requests and today's prayed marks vanish. The kid's mark may feed her star. The copy tells the adult the opposite of what happens.

**Evidence.**
- Code: `apps/prayer.html:1518-1526, 652-656, 685-696`.
- Runs: `audits/evidence/p3/prayer/import-family.json`, `audits/evidence/p3/prayer/verify-import-wipes-family-1.json`, `audits/evidence/p3/prayer/verify-import-wipes-family-2.json`.
- Screenshots: `audits/evidence/p3/prayer/import-family-mae-phone-after.png`, `audits/evidence/p3/prayer/verify-import-wipes-family-2-mae-after.png`, `audits/evidence/p3/prayer/verify-import-wipes-family-2-kiara-after.png`; the panel `audits/screens/prayer/settings-import-typical-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/import-family.mjs"`. It prints `beforeImport {maeRow:true, kiaraMark includes '2026-09-24':['Kiara']}`, `helpText 'This replaces both lists on this device.'`, `toast 'Backup restored.'`, `afterImport {tombstones:['prayer:p012'], maeRow:false, kiaraMark without 2026-09-24}`, `maePhoneStillShows:false`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-import-wipes-family-1.mjs"` (real clock, WebKit). A fresh Eli context opened Prayer normally after Mae's add and Kiara's tap (no forced pull), saw both (`eliSeesBeforeImport {mae:true, kiara:['Kiara']}`), then imported. Server after: `{live:11, tombstones:['prayer:p012'], kiaraMarkToday:null}`; Mae's phone no longer showed her request; Kiara's card read `aria-pressed 'false'`.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-import-wipes-family-2.mjs"` (real clock, WebKit), with Eli re-opening Prayer from Home rather than pulling by hand. The panel read in full "Paste the contents of a backup file / This replaces both lists on this device. / Import / Cancel". After import: toast "Backup restored.", sync "synced", server `{tombstones:['prayer:p012'], kiaraMarkOnServer:[]}`; after their 30 s pull Mae's phone had lost the request and Kiara's iPad showed the card unprayed.

**Corrected claim.** Accurate, with the mechanism narrowed:
- `save()` does not re-stamp every family row: `put()` skips a row whose JSON matches what the device last read (`apps/prayer.html:654`). Only rows changed since the backup are rewritten, with the backup's older value, so the backup's `prayedBy` wins over anyone's newer marks, not only a kid's.
- Tombstones hit only family rows this device has already loaded. A row added after the importing device's last pull survives; in normal use the app pulls on open, on visibility and every 30 s, so nearly all newer rows are loaded.
- A v2 (single-list) backup is worse (added after the critic; code only, not run). `readBackup` reads it into `freshData()` with an empty family list (`apps/prayer.html:614-619, 1510-1514`), so importing one would tombstone every family request this device has loaded (`:692, 1524`) and reset the family plans and `prayerDays`, not only rows newer than the backup.
- Not tested: whether Kiara's Kid Verse star for that day survives (Kid Verse credits a prayed day once).

#### P3-PRAYER-04 — "Put back on the list" erases the answer note with one tap, no confirm and no undo

- **Severity: critical** (skeptics: critical / critical; **raised** from the investigator's medium). Rule (a): the answer note is household data (an `app_data` row), and one tap on a shipped button whose label only says "Put back on the list" erases it on every device, with no message, no confirm and no Undo. No copy survives anywhere. Reading a deliberate un-answer as consent to delete the note is not supported: the label gives no hint of it, and the app calls the note "the part worth keeping" (`apps/prayer.html:1327`).
- **Exposure.** Someone opens an answered request and taps "Put back on the list", the first action button after Done, by mistake or because the answer fell through. Each tap loses one entry, on the personal or the family list.

**What happens now.** An answered request's sheet shows Done, Put back on the list, Edit and Delete (`apps/prayer.html:1013`). One tap sets `status` to active and `answeredAt` and `answerNote` to null, saves and jumps to Today (`apps/prayer.html:1335-1338`), with no `ask()` and no toast. Mark answered has an Undo toast (`:1331`) and Delete has a confirm (`:1255-1261`); this path has neither. For "A job for Luke" the server note ("Luke starts at the county hospital in October…") became null, and marking it answered again starts from an empty field.

**Expected.** Keep the answer note and date (or move them into `updates[]` as a dated entry), and offer the same Undo toast Mark answered uses.

**Why it matters to the household.** The answered-prayer journal is the app's most treasured record. One mis-tap destroys an entry for the whole family.

**Evidence.**
- Code: `apps/prayer.html:1013, 1255-1261, 1323-1338`; `handoff/prayer/SPEC.md:93-95`.
- Runs: `audits/evidence/p3/prayer/unanswer.json`, `audits/evidence/p3/prayer/verify-unanswer-erases-note-1.json`, `audits/evidence/p3/prayer/verify-unanswer-erases-note-2.json`.
- Screenshots: `audits/evidence/p3/prayer/verify-unanswer-erases-note-2-sheet.png` (Put back is the first action), `audits/evidence/p3/prayer/verify-unanswer-erases-note-1-ipad-after.png` (Today straight after the tap, no toast), `audits/evidence/p3/prayer/verify-unanswer-erases-note-1-phone-after.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/unanswer.mjs"`. It prints `sheetButtons ['Put back on the list','Edit','Delete']`, `afterOneTap server {status:'active', answeredAt:null, answerNote:null}`, `toast null`, `reAnswerPrefill ''`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-unanswer-erases-note-1.mjs"` (WebKit, demo clock; Eli on the Kitchen iPad and a second iPhone as Eli). Before: `p015` answered with its note, sheet buttons `['Done','Put back on the list','Edit','Delete']`. After one tap: for 3 s `{toast:null, askOpen:false, screen:'s-today'}`, 0 native dialogs; server `{status:'active', answeredAt:null, answerNote:null, updates:[]}`; the note text was in neither device's localStorage; the second phone, which had cached the note, lost it after reopening; re-answer prefill `''`.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-unanswer-erases-note-2.mjs"` in **Chromium** on a new iPhone and the Kitchen iPad. After one tap: `{askOpen:false, toastOn:false}`, no dialogs; server note null; `iPad {htmlHasNote:false, lsHasNote:false}`, `feedHasNote false`, `anyPrayerRowHasNote false`, re-answer prefill `''`. By contrast, Mark answered shows `{msg:'Moved to the record.', act:'Undo'}`.

**Corrected claim.** Accurate, with three corrections: the sheet has four buttons (Done plus the three actions); the note survives nowhere (not in the row, `updates[]`, the feed or another device's cache after its pull); and the severity is critical. The null-out was inherited from the handoff reference (`handoff/prayer/prayer.html:1022`), whose own spec only asks that answered entries "can be put back on the list" and calls the note "the app" (`handoff/prayer/SPEC.md:93-95`).

#### P3-PRAYER-05 — On the family list one person's tick shows as everyone's, and a second adult's tap unticks it for the house

- **Severity: high** (skeptics: high / high; unchanged). A core daily flow, praying the family list, is wrong for every adult: the tick, the "N to pray" headline, the "x/8 today" meter and the Pray now queue all show whether *anyone* prayed, not whether *I* did. Not critical: the per-person record (`prayedBy` names) keeps every other name, because a tap only removes the tapper's own name; what is overwritten is the derived `lastPrayedAt`.
- **Related.** P2-STAB-03 is the midnight facet of the same toggle (`apps/prayer.html:1595`); this is the same-day trigger in normal use.

**What happens now.** An adult family row's done state is the one shared `lastPrayedAt` (`apps/prayer.html:841, 884`), and Pray now skips rows anyone has prayed (`:1613`). `setPrayed` toggles: `on = lastPrayedAt !== TODAY` (`:1595`). So an adult who taps a row someone else prayed turns it *off* for the house (`lastPrayedAt = null`), and removes only their own name from `prayedBy[TODAY]`, which was not there (`:1599-1602`). Kid cards use per-person `prayedBy` (`:729`), so adults and kids disagree.

Investigator run: Eli, who had prayed nothing, saw "3/8 today" and "5 to pray". He tapped "Grandma Jo's visit this week" (prayed by Elizabeth only): on the server `lastPrayedAt` became null and `prayedBy` stayed `['Elizabeth']`. Elizabeth's phone then showed her own prayer unticked and "6 to pray through this morning." Only a second tap added Eli.

**Expected.** Done means "I prayed this today" (`prayedBy[TODAY]` includes me), as in kid mode; a tap adds or removes only me. The reference spec says the same: "Unmarking removes just that person's name" (`handoff/prayer/SPEC.md:221-225`).

**Why it matters to the household.** Adults cannot see what they themselves have prayed, and praying "undoes" someone else's mark on every device.

**Evidence.**
- Code: `apps/prayer.html:729, 841, 884, 999, 1265, 1593-1607, 1613`; `handoff/prayer/SPEC.md:221-225, 245-247`.
- Runs: `audits/evidence/p3/prayer/family-tick.json`, `audits/evidence/p3/prayer/verify-family-tick-shared-1.json`, `audits/evidence/p3/prayer/verify-family-tick-shared-2.json`.
- Screenshots: `audits/evidence/p3/prayer/family-tick-1-eli-before.png`, `audits/evidence/p3/prayer/family-tick-3-elizabeth-phone.png`, `audits/evidence/p3/prayer/verify-family-tick-shared-2-eli-after-one-tap.png` (Grandma Jo's circle empty next to Elizabeth's face), `audits/screens/prayer/today-family-typical-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/family-tick.mjs"`. It prints `BEFORE strip '3/8 today', Grandma Jo ticked:true prayedBy ['Elizabeth']`; `AFTER TAP 1 {lastPrayedAt:null, prayedByToday:['Elizabeth']}`; `ELIZABETH SEES ticked:false, '6 to pray through this morning.'`; `AFTER TAP 2 prayedByToday ['Elizabeth','Eli']`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-family-tick-shared-1.mjs"` (WebKit, demo clock; Eli on a new iPhone, Elizabeth on the Kitchen iPad, Ezra on a new device). Before: "5 to pray", `s002`, `s001`, `s003` ticked though Eli prayed none; Pray now queue `s004, s007, s005, s008, s006`. After one tap each on `s002` and `s001`: both `lastPrayedAt:null`, Eli not added; Elizabeth's iPad read "7 to pray" and "1/8 today" with her own face next to an empty circle; Ezra's kid view still showed `s001` done. A second tap on `s002` gave `prayedBy ['Elizabeth','Eli']`.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-family-tick-shared-2.mjs"` in **Chromium** with Mae as the second viewer. Before: "TICKED BUT NOT ME [s002,s001,s003]", detail sheet "Last prayed September 22, 2026". After one tap: `s002 ticked:false, lastPrayedAt:null, prayedByToday ['Elizabeth']`, "6 to pray"; the detail sheet read "Not prayed through yet"; Mae's iPad showed `s002` unticked beside "Prayed today: Elizabeth".

**Corrected claim.** Confirmed, with one more consequence: the tap also erases the row's "Last prayed" line (`apps/prayer.html:999` shows "Not prayed through yet") and sorts a rotation row as the coldest (`:830`). The shared done state is inherited from the handoff prototype, but its own spec says unmarking removes only that person's name and that two people marking the same day both show (`handoff/prayer/SPEC.md:221-225, 245-247`). Kids (`force=true`, `apps/prayer.html:1270`) and Pray now's Next only set the flag; the adult row tap (`:1265`) is the only trigger.

#### P3-PRAYER-06 — Stored XSS through a family prayer row's id

- **Severity: high, security** (skeptics: high / high; unchanged). Script planted by any paired, non-kiosk profile runs in other people's Prayer, the admin's included, and can read `hub.session` and `hub.device`: that is an account takeover under (b). **Downgraded from critical** because planting the row needs a hand-made API request: the UI cannot produce such an id (`nextId()` makes `p001`-style ids, titles are escaped, and a pasted backup's bad key is rejected by `hub.set`). This matches the P2-SEC-01 precedent.
- **Exposure.** Anyone with a paired device and any non-kiosk session (an adult, a kid or a guest) sends one crafted `POST /api/data/prayer/batch?scope=family`. It then runs on every device that renders the row until an adult's second family save tombstones it; nothing on the server stops it being planted again. There is no CSP, and the app iframe is not sandboxed (`index.html:413`).
- **Related.** P2-PROF-05 (the Worker's unchecked write path). Phase 2's XSS sweep stored payloads in titles and viewed Home, Me and the TV, never an id inside Prayer. **P3-PRAYER-17** (from the critic) is a second, independent sink: the family plan id in the Settings plan list (`apps/prayer.html:1184`). It is filed on its own because it does not remove itself and the row-id fix below would not cover it. **P3-DOLLYWOOD-LIVE-01** (critical, planted through the shipped Add-a-guest name; `audits/03-apps/dollywood-live.md`) is the third stored-XSS sink in Phase 3, with the same no-CSP, unsandboxed-iframe amplifier (`index.html:413`).

**What happens now.** Titles and notes go through `esc()` (`apps/prayer.html:717`), but the row id is concatenated raw into attributes: `data-pray` and `data-open` (`:845, 847`), the kid card's `data-kpray` (`:1587`), anniversaries (`:925`), the answered list (`:935`) and the sheet buttons (`:1007-1017`). The family plan id reaches markup raw too, in the Settings `<option value>` (`:1184`; P3-PRAYER-17). A family row whose `value.id` breaks out of the attribute, written as Ezra, returned 200. It ran 3 times in Kiara's Prayer on open and 4 times in Eli's (admin) after a repaint, with `hub.session` readable. Eli's tap on Family threw `hub.set: bad key prayer:zz1"><img…` (`apps/hub.js:235`), so the screen did not repaint.

**Expected.** `esc()` every id (row ids and plan ids) placed in markup; drop or normalise rows whose id is not the key suffix, or fails the key pattern, and plans whose id fails `/^[A-Za-z0-9_-]+$/`, when loading.

**Why it matters to the household.** Script in the hub origin can read both tokens in localStorage, including the admin's, and could send them anywhere.

**Evidence.**
- Code: `apps/prayer.html:652-656, 692, 717, 845-847, 925, 935, 1007-1017, 1184, 1587`; `apps/hub.js:235`; `index.html:413`.
- Runs: `audits/evidence/p3/prayer/xss-id.json`, `audits/evidence/p3/prayer/verify-xss-row-id-1.json`, `audits/evidence/p3/prayer/verify-xss-row-id-2.json`; for the plan-id sink, `audits/evidence/p3/prayer/critic-sweep-planxss.json` and `audits/evidence/p3/prayer/critic-sweep-planxss-chromium.json` (P3-PRAYER-17).
- Screenshot: `audits/evidence/p3/prayer/verify-xss-row-id-1-eli-after-tick.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/xss-id.mjs"`. It prints `write as ezra → 200`; `kiara on open {xss:3, saw:'string'}`; `eli right after tapping Family {xss:0, pageErrors:['hub.set: bad key prayer:zz1"><img…']}`; `after tapping nav Today {xss:4, saw:'string'}`. The payloads record only the token's type or length.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-xss-row-id-1.mjs"` (WebKit, real clock) with a payload written as Ezra, plus a control with a plain id. Payload run: Kiara on open `exec 3, sessLen 235`; her tick on `s004` threw the bad-key error and the card stayed unpressed, yet the server recorded the tick; Eli after Family: the same error and no repaint; after nav Today `exec 4, sessLen 325`; Eli's later tick on `s007` saved with no error. Control: `exec 0` throughout and every tap repainted.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-xss-row-id-2.mjs"` in **Chromium** with the seeded **guest** Grandma Jo as the writer (200). Kiara on open `{runs:3, sessionLen:235, deviceLen:82}`; Eli after nav Today `{runs:4, sessionLen:325, deviceLen:82}`; Eli's tick on `s008` saved with no error; the crafted row was then a tombstone on the server, and a fresh Kiara device ran it 0 times.

**Corrected claim.** Confirmed as a stored XSS that any non-kiosk session, guests included, can plant; it runs in a kid's Prayer on open and in the admin's on the first repaint of the family list. The side effect was overstated: the row does **not** break every later save. `put()` records the key before `hub.set` throws (`apps/prayer.html:655`), so only the first save per page load throws, that one interaction does not repaint, and later saves skip the row. The removal loop (`:692`) then tombstones the real key, because `'prayer:' + id` never matches it, so the payload deletes itself after the second family save on any device.

#### P3-PRAYER-07 — On List, a tick or any remote change folds every open category shut

- **Severity: medium** (skeptics: medium / medium; unchanged). A secondary flow, praying down a category from List, works but misleads: each tick hides its own confirmation and forces a reopen among 14 groups. No data is lost.

**What happens now.** A tick on List calls `renderAll()` (`apps/prayer.html:1265`), and `groupedHTML` opens groups only while there is a search term (`:950`). Every remote change runs `absorbRemote` → `renderAllScreens` (`:699-705`), which does the same; `absorbRemote` waits only while a sheet, Pray now or a focused input is open (`:701-703`). Investigator: open [Health Needs] → after the tick [] (tick stored); opened again → after a remote write and pull [].

**Expected.** Open groups stay open across re-renders.

**Why it matters to the household.** Praying down a category means reopening it after every tick, and on the 24/7 Kitchen iPad it folds whenever anyone else prays or edits.

**Evidence.**
- Code: `apps/prayer.html:699-705, 862-872, 941-955, 1265`.
- Runs: `audits/evidence/p3/prayer/list-collapse.json`, `audits/evidence/p3/prayer/verify-list-group-collapses-1.json`, `audits/evidence/p3/prayer/verify-list-group-collapses-2.json`.
- Screenshots: `audits/evidence/p3/prayer/list-collapse-1-open.png`, `audits/evidence/p3/prayer/list-collapse-2-after-tick.png`, `audits/evidence/p3/prayer/verify-list-group-collapses-2-webkit-2-after-tick.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/list-collapse.mjs"`. It prints `open before tick [{Health Needs, open:true}] | after tick [] | tick stored true` and `open before remote [{Health Needs}] | after remote []`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-list-group-collapses-1.mjs"` (Kitchen iPad as Eli): one tick with ["Personal"] open gave []; with ["Personal","Coworkers"] open, a tick in Coworkers gave []; Mae's family-scope write while Eli viewed his personal List gave [] after the pull; control with a search term: 14 open before and after.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-list-group-collapses-2.mjs"` in WebKit and Chromium: a real-pointer tick in "Expecting and New Parents" folded it; idling 35 s with no changes left it open; Mae's family edit folded Eli's personal List after the pull. Both engines agreed.

**Corrected claim.** Confirmed, and wider: one tick folds **every** open group, not only the ticked one, and any pull that brings a changed row folds them too, even a change to the list not on screen. It folds on re-render only, not on a timer. The handoff reference has the same behaviour (`handoff/prayer/prayer.html:739, 956`), and nothing marks it as intended.

#### P3-PRAYER-08 — "Send to family list" drops a weekly request's days

- **Severity: medium** (skeptics: medium / medium; unchanged). A secondary flow gives a misleading result: the shared copy syncs and is listed under All, but under the default plan it never reaches anyone's family Today. Nothing is lost, and an adult can fix the copy by editing it.

**What happens now.** The family copy keeps `cadence` but is written with `days:[]` (`apps/prayer.html:1314-1315`), and the weekly filter needs a day (`:822`). The add and edit forms both refuse a weekly request with no days ("Pick at least one day.", `:1435, 1056`); the share path is the only writer that creates one. Eli's `p006` (weekly Sun/Tue/Thu) shared on a Tuesday became `s012 {cadence:'weekly', days:[]}` and was not on the family Today under the "everything" plan. The seed comment `audits/tools/seed/prayer.mjs:198` assumes the share copies the cadence; its own example (`s007`) is daily, so the demo data never shows this.

**Expected.** Copy `days` with the cadence (or fall back to daily).

**Why it matters to the household.** A request someone deliberately shared with the family never comes up for anyone, kids included, and the sender is not told.

**Evidence.**
- Code: `apps/prayer.html:809-835, 1041-1060, 1306-1323, 1435`.
- Runs: `audits/evidence/p3/prayer/leads.json` (L5-shareWeekly), `audits/evidence/p3/prayer/verify-share-drops-days-1.json`, `audits/evidence/p3/prayer/verify-share-drops-days-2.json`.
- Screenshots: `audits/evidence/p3/prayer/verify-share-drops-days-2-eli-family-today.png`, `audits/evidence/p3/prayer/verify-share-drops-days-2-mom-copy-edit.png`, `audits/evidence/p3/prayer/verify-share-drops-days-2-ezra-today.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/leads.mjs"` prints `L5-shareWeekly → {sourceDays:[Sun,Tue,Thu], copy:{id:s012, cadence:weekly, days:[]}, familyPlanMode:everything, copyOnFamilyTodayOnTuesday:false, dow:Tue}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-share-drops-days-1.mjs"` through the UI (All → search → sheet → Send to family list → Send): `copyLocal {id:s012, cadence:weekly, days:[]}`; Eli's family Today `copyShown:false` while the seeded weekly `s005` (Tue/Fri) did show; server row `days:[]`; Elizabeth's family Today `copyShown:false`; `copyOnAnyDow []`.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-share-drops-days-2.mjs"`: Elizabeth's copy listed under All (`true`) but not on Today; its Edit sheet showed weekly with no day chip on; Ezra's kid Today `copyShown false`.

**Corrected claim.** Confirmed, with a narrower scope: only weekly requests are affected; the copy is hidden on every day of the week, not only the day it was shared; it is missing from Pray now, Kitchen, Copy and the kids' cards too (all read `todaySet`); under a by-day or focus plan it can still appear through its category (`apps/prayer.html:813-818`).

#### P3-PRAYER-09 — Undo after Mark answered does nothing if a remote change lands within its 6 s

- **Severity: low** (skeptics: low / low; unchanged). An edge-case race in a secondary control. The answer and its note are saved as entered, and the request can be reopened from Record.
- **Exposure.** A remote change to **either** prayer scope arrives (the app's 30 s poll, a visibility pull, or the shell's pull via the storage event) within 6 s of Mark answered.

**What happens now.** The Undo closure holds the old row object (`apps/prayer.html:1331`). A remote change runs `absorbRemote` → `load()` (`:699-705`), which rebuilds every row as a new object; its busy test ignores the toast. Undo then edits a detached object, `put()` sees no change (`:654`), and nothing is written, while the screen jumps to Today as if it worked.

**Expected.** Undo finds the row again by id (or `absorbRemote` treats an open Undo toast as busy).

**Why it matters to the household.** Undo is the one safety net after "Mark answered", and it silently fails.

**Evidence.**
- Code: `apps/prayer.html:630-639, 652-656, 699-705, 1142-1150, 1331, 1760`; `apps/hub.js:286-302, 342, 350-362`.
- Runs: `audits/evidence/p3/prayer/undo-stale.json`, `audits/evidence/p3/prayer/verify-undo-stale-object-1.json`, `audits/evidence/p3/prayer/verify-undo-stale-object-2.json`.
- Screenshot: `audits/evidence/p3/prayer/verify-undo-stale-object-2-remote-after-undo.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/undo-stale.mjs"` prints `control {memStatus:'active', serverStatus:'active'}` and `remote-change-inside-6s {toastStillOfferedUndo:'Undo', memStatus:'answered', serverStatus:'answered'}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-undo-stale-object-1.mjs"` using the app's natural poll timers (no hand-called pull): control and "poll with no remote change" both left the request `active`; with another Eli device's edit landing first, Undo at +5165 ms left memory and server `answered`, and the request was gone from Today.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-undo-stale-object-2.mjs"`: control `{onChangeEventsDuringWindow:0, memStatus:'active', serverStatus:'active'}`; with Mom editing **family** request `s010`, Eli's Undo on **personal** `p004` gave `{onChangeEventsDuringWindow:1, memStatus:'answered', serverStatus:'answered', hubCacheStatus:'answered'}`.

**Corrected claim.** Confirmed and widened: any remote change to either scope breaks it, not only the same scope (skeptic 2 reproduced a family edit breaking a personal Undo; `apps/prayer.html:1760` subscribes with no filter). A poll that only echoes the person's own write does not break it. The "Answered: <title>" feed line is never taken back, even when Undo works (a log line, not data).

#### P3-PRAYER-10 — Taps before the data loads throw; the Mine/Family choice and screen changes are lost

- **Severity: low** (skeptics: low / low; unchanged). Nothing is written or lost; the effect lasts at most about 6 s on a first open and clears by itself.
- **Exposure.** The first open of Prayer on a device with no cached Prayer data (effectively a new device, since the shell caches `prayer|person`, `index.html:458`) over a slow network.
- **Related.** P2-SYNC-05 (the same first-open wait).

**What happens now.** The document click handler is live before `load()` sets `D` (`apps/prayer.html:611, 1230-1231`; boot at `:1752-1758`). With the Prayer pulls held 4 s on a new device, the Family tap threw "undefined is not an object (evaluating 'D.activeList = t.dataset.list')" and the Record tap threw on `D.lists`. Record then showed the + button, which a loaded Record never shows.

**Expected.** Taps are ignored or queued (and the controls look disabled) until the data has loaded.

**Why it matters to the household.** On a new phone the first taps silently do nothing, and the page jumps back to Today.

**Evidence.**
- Code: `apps/prayer.html:611, 803-806, 1070-1077, 1153-1162, 1230-1231, 1267, 1271-1274, 1752-1758`; `apps/hub.js:334-337`.
- Runs: `audits/evidence/p3/prayer/leads.json` (L6-tapBeforeReady), `audits/evidence/p3/prayer/verify-tap-before-ready-1.json`, `audits/evidence/p3/prayer/verify-tap-before-ready-2.json`.
- Screenshots: `audits/evidence/p3/prayer/verify-tap-before-ready-1-A-record-before-load.png`, `audits/evidence/p3/prayer/verify-tap-before-ready-2-hold4s-during-window.png`, `audits/screens/prayer/record-loading-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/leads.mjs"` prints `L6 {pageErrors:[…D.activeList…, …D.lists…], recordShowsFab:true, screen:'s-answered'}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-tap-before-ready-1.mjs"`: with the pulls held 4 s, both errors appeared, Record showed `fabOn true`, and at 8.5 s `activeList` was still `personal` and the screen was back on Today. Control (no hold): Family and Record worked with no errors.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-tap-before-ready-2.mjs" webkit` with holds of 4 s and 8 s and a control: both errors, `fabOn:true` on Record, `readyAfterMs` 6235 and 6307 (the 6 s cap); after ready both the Family choice and the Record navigation were discarded; a Family tap after ready worked.

**Corrected claim.** Accurate, with detail: the stray + comes from `shutSheet()` → `updateFab()` running while `screenName` is still `'today'`, because `go()` throws inside `reviewDue()` (`apps/prayer.html:1267, 1071-1077, 1153-1162, 803-806`); when boot finishes, `go('today')` (`:1758`) also discards the Record tap; the same unguarded handler covers every `data-*` action.

#### P3-PRAYER-11 — A phone outside New York time files prayed marks under its own local date

- **Severity: low** (skeptics: low / low; unchanged). The mark is saved, but under the wrong household day for a few hours, so the TV's "who prayed today" leaves the person off.
- **Exposure.** An adult travelling outside the Eastern time zone who prays in the hours when their local date differs from New York's (for Los Angeles 21:00-24:00 local; for London 00:00-05:00 local).

**What happens now.** `TODAY` is the device's local date (`apps/prayer.html:711-712`) and `setPrayed` writes `prayedBy[TODAY]` (`:1598-1602`). The New York TV reads `prayedBy[today]` with its own local date (`index.html:834, 1058-1059`). David's phone in Los Angeles at Tue 22:30 PDT (Wed 01:30 New York) filed his tap under 2026-09-22, and the TV omitted him.

**Expected.** One household day for everyone (New York), as the Worker's chat tool already uses (`worker/src/chat.js:112, 244-246`).

**Why it matters to the household.** A travelling parent's prayer is missing from the TV board, and the app and chat disagree about which day a mark belongs to.

**Evidence.**
- Code: `apps/prayer.html:711-712, 1593-1603`; `index.html:834, 1058-1059`; `worker/src/chat.js:112, 244-246`.
- Runs: `audits/evidence/p3/prayer/dates.json` (timezone), `audits/evidence/p3/prayer/verify-other-timezone-date-1.json`, `audits/evidence/p3/prayer/verify-other-timezone-date-2.json`.
- Screenshots: `audits/evidence/p3/prayer/verify-other-timezone-date-1-tv.png`, `audits/evidence/p3/prayer/verify-other-timezone-date-2-tv-east.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/dates.mjs"` prints `TZ {phone TODAY:'2026-09-22', newYorkDate:'2026-09-23', keysWithDavid:['2026-09-22'], onNewYorkTodayList:false}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-other-timezone-date-1.mjs"` at Wed 01:30 New York: David in Los Angeles filed under `2026-09-22`; the control, Elizabeth in New York at the same instant, filed under `2026-09-23`; the TV showed "🌷 Elizabeth" only.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-other-timezone-date-2.mjs"` with Mea, who has no seeded marks: west (Los Angeles, 22:30 PDT) filed under `2026-09-22` and the TV read "No one yet today."; east (London, 03:00 BST = 22:00 New York) filed under `2026-09-23`, and the TV listed four others without Mea.

**Corrected claim.** Confirmed in both directions. The traveller's date is also written into the shared row's `lastPrayedAt`. Chat's `mark_prayed` deliberately files the same action under the New York date (`worker/src/chat.js:244-246`, commented "Same shape as apps/prayer.html setPrayed()"), which shows New York is the intended household day.

#### P3-PRAYER-12 — The "Needs attention" badge counts a request twice

- **Severity: low** (skeptics: low / low; unchanged). A misleading count on a secondary surface; no data or flow is affected (`reviewDue()` uses only the cold list, `apps/prayer.html:803-806`).

**What happens now.** The "Gone quiet" and "No news in a while" filters overlap (`apps/prayer.html:797-799`), and the badge adds all three lists (`:981`). It shows 8 for 6 distinct requests; "Believers facing persecution" and "Wisdom for the city council" each appear under both headings.

**Expected.** The badge counts distinct requests.

**Why it matters to the household.** The number overstates what needs attention, and the repeated rows look like a glitch.

**Evidence.** `apps/prayer.html:797-799, 981`; `handoff/prayer/SPEC.md:83-85`; `audits/evidence/p3/prayer/leads.json` (L12-needsAttention); `audits/evidence/p3/prayer/verify-review-double-count-1.json`; `audits/evidence/p3/prayer/verify-review-double-count-2-iphone.png`; `audits/screens/prayer/record-review-typical-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/leads.mjs"` prints `L12 {badge:8, distinct:6, inBoth:['Believers facing persecution','Wisdom for the city council']}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-review-double-count-1.mjs"` and read the rendered DOM: badge "8"; Gone quiet `[p014, p011]`, No news `[p014, p011, p008, p006, p005]`, Added recently `[p002]`; 8 rows, 6 distinct.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-review-double-count-2.mjs"`: the same badge 8, rows 8, distinct 6, `listedTwice p014, p011`.

**Corrected claim.** Listing a request under both headings follows the reference spec, since each heading suggests a different action (`handoff/prayer/SPEC.md:83-85`; `handoff/prayer/prayer.html:676-677`). The defect is the hub-added badge (`apps/prayer.html:981`), which sums the lists.

#### P3-PRAYER-13 — The gold streak cheer shows under "Nothing on the list today."

- **Severity: low** (skeptics: low / low; unchanged). Cosmetic copy.

**What happens now.** `left = set.length - done` is 0 when nothing is scheduled (`apps/prayer.html:885`), and the cheer is gated only on `left === 0` (`:909`). Mae's page (by-day plan, nothing scheduled on Tuesday) reads "Nothing on the list today." with the gold cheer "3 days in a row." and the strip "0/0 today", although she has not prayed today.

**Expected.** No cheer when nothing was scheduled (`set.length && left === 0`).

**Why it matters to the household.** It congratulates a finished list that never existed, and repeats the strip's text.

**Evidence.** `apps/prayer.html:734-739, 765-775, 884-909`; `audits/evidence/p3/prayer/leads.json` (L11-unscheduledCheer); `audits/evidence/p3/prayer/verify-cheer-at-zero-1.json`; `audits/evidence/p3/prayer/verify-cheer-at-zero-2-mae-iphone.png`; `audits/screens/prayer/today-unscheduled-typical-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/leads.mjs"` prints `L11 {headline:'Nothing on the list today.', cheer:'3 days in a row.', set:0}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-cheer-at-zero-1.mjs"`: Mae `{plan:'Weekday categories', planMode:'byDay', setLen:0, left:0, prayedToday:false, streak:3, cheer:'3 days in a row.'}`; control Eli (9 set, 6 left) cheer `''`.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-cheer-at-zero-2.mjs"`: the same for Mae; a control with her 4 active requests unprayed gave "4 to pray…" and no cheer.

**Corrected claim.** Accurate. It also fires when the person has not prayed today, because the streak counts back from yesterday (`apps/prayer.html:734-739`), and the same gate would show milestone lines such as "A full week of showing up." on an empty day. The headline also sits above a second empty message ("Nothing scheduled for today under this plan.").

#### P3-PRAYER-14 — A category row's count disagrees with its Remove confirm

- **Severity: low** (skeptics: low / low; unchanged). A copy inconsistency in Settings; the confirm's number is the true one.

**What happens now.** The row counts active requests (`apps/prayer.html:1171-1175`), while the Remove confirm counts active and answered (`:1357`), and Remove moves both to Personal (`:1362`). "Health Needs 1" sits above "2 requests are in "Health Needs"…".

**Expected.** Both count the same set, or the row says "N active".

**Why it matters to the household.** A row showing 0 invites a Remove that then says a request will be moved.

**Evidence.** `apps/prayer.html:1171-1180, 1355-1368`; `audits/evidence/p3/prayer/leads.json` (L17-categoryCount); `audits/evidence/p3/prayer/verify-category-count-mismatch-1-confirm.png`; `audits/screens/prayer/settings-delcat-typical-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/leads.mjs"` prints `L17 {row:'Health Needs 1RenameRemove', confirm:'2 requests are in "Health Needs"…'}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-category-count-mismatch-1.mjs"`: 5 rows disagree (Friends, Health Needs, Work and Job Search, Neighbors 1 vs 2; Wisdom and Decisions 0 vs 1); the Friends confirm read "2 requests are in "Friends""; Cancel changed nothing.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-category-count-mismatch-2.mjs"`: the same 5 of 28 rows; the Health Needs extra is the answered `p018` "Healing for my shoulder".

**Corrected claim.** Broader than Health Needs: 5 of 28 categories disagree in the typical seed. The unlabelled row count is the misleading one. The logic is inherited from the handoff (`handoff/prayer/prayer.html:896, 1038`).

#### P3-PRAYER-15 — The family delete confirm says deletions do not sync, but they do

- **Severity: low** (skeptics: low / low; unchanged). The warning text is wrong; the delete itself works.

**What happens now.** On the family list the confirm reads "Sync does not carry deletions, so it can come back from another device." (`apps/prayer.html:1258-1259`), but `save()` sends a tombstone through `hub.remove` (`:692`; `apps/hub.js:244`), and other devices drop the row on their next pull.

**Expected.** The confirm says the delete reaches everyone.

**Why it matters to the household.** It may make an adult hesitate or delete twice; the result is correct.

**Evidence.** `apps/prayer.html:692, 1253-1261`; `apps/hub.js:244`; `handoff/prayer/SPEC.md:245-248`; `audits/evidence/p3/prayer/leads.json` (L13-deleteCopy); `audits/evidence/p3/prayer/verify-delete-copy-wrong-1-confirm.png`; `audits/screens/prayer/ask-delete-typical-iphone-pwa-light.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/leads.mjs"` prints `L13 "Delete \"Grandpa's knee to heal\"? Sync does not carry deletions…"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-delete-copy-wrong-1.mjs"`: after Eli confirmed, the server row was a tombstone; Elizabeth's iPad dropped it on its pull and did not bring it back on its next save; both devices' reopen `inData:false`.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-delete-copy-wrong-2.mjs"`: test A, Mae's phone dropped the deleted `s002` after a pull and a reopen; test B, Mom's offline iPad tapped Prayed on the deleted `s001` and on reconnect brought it back for everyone (`tombstone:false`).

**Corrected claim.** The line is left over from the retired GitHub-JSON sync (`handoff/prayer/SPEC.md:245-248`). "It can come back" is true only through an ordinary last-write-wins race (a stale or offline device writing the old row), which is generic hub.js behaviour under P2-SYNC-01, not what the copy says.

#### P3-PRAYER-16 — The headline says "to pray through this morning" at any hour

- **Severity: low** (skeptics: low / low; unchanged). Cosmetic copy; the count and actions are right.

**What happens now.** The adult headline hard-codes "this morning." (`apps/prayer.html:890`). At 21:10 the page reads "6 to pray through this morning." Kids get "Pray with the family" instead (`:891-897`).

**Expected.** Time-neutral or time-aware copy.

**Why it matters to the household.** The family also prays in the evening (the hub's 8 pm nudge is for F260); the wording reads as a mistake.

**Evidence.** `apps/prayer.html:884-897, 1287`; `audits/tools/seed/prayer.mjs:134`; `audits/evidence/p3/prayer/leads.json` (eveningCopy); `audits/evidence/p3/prayer/verify-morning-copy-evening-2-eli-2110.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/leads.mjs"` prints `eveningCopy {now:'Tue Sep 22 2026 21:10', headline:'6 to pray through this morning.'}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-morning-copy-evening-1.mjs"`: the same headline at 06:10, 08:40, 14:10 and 21:10 New York; Ezra at 21:10 saw "Pray with the family".
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-morning-copy-evening-2.mjs"`: the same at 08:40, 15:00 and 21:10.

**Corrected claim.** The seed names Eli's plan "Morning" (`audits/tools/seed/prayer.mjs:134`), which makes the phrase look deliberate in the captures, but the shipped default plan is "Everything" (`apps/prayer.html:600, 608`). Adults see it only with 2 or more left. The same hard-coded phrase is in the "Tell them you prayed" draft, "just prayed for you this morning." (`apps/prayer.html:1287`).

#### P3-PRAYER-17 — Stored XSS through a family plan id: the Settings plan list puts it into markup raw (from the critic)

- **Severity: high, security** (skeptics: high / high; the critic's high). Script planted in the family `plans` row runs in a kid's Prayer after an ordinary pull and in the admin's as soon as he views the family list, and can read `hub.session`: an account takeover under (b). **Downgraded from critical**, as P3-PRAYER-06 and P2-SEC-01 were, because planting it needs a hand-made API request: the UI makes plan ids as `'pl'` plus 6 base-36 characters (`apps/prayer.html:599-600`).
- **Exposure.** Any paired non-kiosk session (adult, kid or guest) sends one crafted `POST /api/data/prayer/batch?scope=family` with a `plans` and `activePlan` pair; the Worker checks the key, not the value (`worker/src/index.js:280-318`). It then runs on every kid device at each Prayer open and after each pull (a kid is always on the family list, `apps/prayer.html:638`), and for any adult who views the family list. Nothing in normal use removes it. On iPad and iPhone it depends on Safari's select parser (see Corrected claim and Unresolved).
- **Related.** P3-PRAYER-06 is the same class through a different sink (prayer row ids). Its payload deletes itself after a second family save; this one does not, and P3-PRAYER-06's row-id fix would not cover it. p2Ref **P2-PROF-05** owns only the unchecked write path.

**What happens now.** `renderPlans()` builds the Settings "Active plan" list as `'<option value="' + p.id + '"' …` with no `esc()`, while plan names are escaped (`apps/prayer.html:1181-1184`). It runs at boot (`:1758`), on every remote change through `absorbRemote` (`:704`) and on the Mine/Family switch (`:1274`), so the payload runs without anyone opening Settings. `migrate()` keeps any plan id (`:663-673`). Both engines keep an `<img>` inside `select.innerHTML` and fire its `onerror` (WebKit "Version/26.6 Safari" and HeadlessChrome 154: `imgKept:true, fired:true`). In the critic's run Ezra (a kid) wrote the crafted pair and got 200. Kiara's page ran it after her own poll (about 25 s), with `hub.session` readable as a string. Eli's did not run it while he was on his personal list, and did as soon as he tapped Family.

**Expected.** `esc()` every id (row ids and plan ids) placed in markup, and drop plans whose id fails `/^[A-Za-z0-9_-]+$/` on load in `migrate()` (`apps/prayer.html:663-673`).

**Why it matters to the household.** Script in the hub origin can read `hub.session` and `hub.device`, the admin's included, on every kid device and every adult device that shows the family list, and it stays planted.

**Evidence.**
- Code: `apps/prayer.html:599-600, 638, 663-673, 704, 1181-1184, 1274, 1758`; `worker/src/index.js:280-318`.
- Runs: `audits/evidence/p3/prayer/critic-sweep-planxss.json`, `audits/evidence/p3/prayer/critic-sweep-planxss-chromium.json`, `audits/evidence/p3/prayer/verify-critic-plan-id-xss-1-1.json`, `audits/evidence/p3/prayer/verify-critic-plan-id-xss-1-1-chromium.json`, `audits/evidence/p3/prayer/verify-critic-plan-id-xss-1-2.json`.
- Screenshots (nothing visible; the payload only counts): `audits/evidence/p3/prayer/critic-planxss-kiara.png`, `audits/evidence/p3/prayer/verify-critic-plan-id-xss-1-1-kiara.png`, `audits/evidence/p3/prayer/verify-critic-plan-id-xss-1-2-kiara.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/critic-sweep.mjs" planxss` (add `chromium` as a further argument for Chromium). The script opens Kiara (iPad) and Eli (iPhone) first, writes family `plans` and `activePlan` with a crafted id as Ezra through `/api/data/prayer/batch?scope=family`, waits for each page's own poll, then taps Family and More on Eli's page. The payload only increments a counter. Observed in WebKit: `kiara {pulled:true, afterMs:25247, px:1, imgInSelect:1, sessionReadable:'string'}`; `eli {pxOnPersonal:0, pxAfterFamily:1, pxOnFamilySettings:1, pageErrors:[]}`; `selectParser {imgKept:true, fired:true}`. Chromium gave the same.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-critic-plan-id-xss-1-1.mjs" webkit` and again with `chromium` (fresh typical instance, real clock; Kiara on iPad portrait and Eli on iPhone PWA open Prayer first, then Ezra writes the pair):
  - WebKit: `writeAsEzra 200`; `kiaraAfterPoll {pulled:true, afterMs:24450, runs:1, sess:'string', imgInSelect:1}`; `eliPersonalAfterPoll {runs:0}`; `eliAfterTapFamily {runs:1}`.
  - After Eli ticked `s004` (an ordinary family save) the server still held the payload in `plans` and `activePlan`.
  - A fresh browser opening Prayer as Kiara ran it 0 times and replaced the row (`plansIdIsPayload:false`) through P2-SYNC-02's first-open reset.
  - Chromium 154 gave the same values (Kiara's poll at 24424 ms).
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-critic-plan-id-xss-1-2.mjs"` (fresh typical instance, WebKit, real clock):
  - `kiaraAfterPoll {pulled:true, afterMs:25471, runs:1, imgInSelect:1, sessionType:'string'}`; Eli `onPersonal {runs:0}`, `afterFamily {runs:1}`, no page errors.
  - After Eli's family tick the server still held the payload in both keys; Kiara reopening Prayer ran it again (`runs:3`).
  - A new paired device for Mae ran it on its first open (`runs:1`), and the server row still held it afterwards.

**Corrected claim.** Confirmed as filed, except the persistence caveat. The critic said a fresh device's first open clears the payload through P2-SYNC-02. That happens only when the fresh device resets the family plan, as a kid's first open does (skeptic 1). An adult's fresh device on the personal list ran the payload and left it in place (skeptic 2). So nothing in normal use removes it, and the one path that does is itself a data-loss bug. On iPad and iPhone the script runs only if shipping Safari's select parser keeps an `<img>` inside `select.innerHTML`, as the rig's WebKit 26.6 and Chrome 154 do; with the older parser the `<img>` is dropped and this sink cannot run script. Desktop Chrome is confirmed.

#### P3-PRAYER-18 — "Send to family list" publishes the private request's For and category although its panel offers only the title, and the push adds "(for …)" (from the critic)

- **Severity: medium, security** (skeptics: medium / medium; the critic's medium). A secondary flow misleads, with a privacy cost. Not critical under (b): the owner chooses to share, "For Uncle Ray" is printed on the sheet just above the panel, the copy stays inside the household, the phone and detail are already stripped, and the author can edit the copy's For before the next 8 am / 8 pm push. Not high: kids never see the For or the category in their UI.
- **Exposure.** An adult shares a private request that has a For or a sensitive category and rewrites the title to be discreet. Other adults and guests see the For and category; other subscribed adults get the push body with "(for …)" when the share is their only new family request.
- **Related.** P3-PRAYER-08 (the same share drops weekly days). P2-PWA-01 (private titles in the feed) is a different leak. No Phase 2 ID covers which fields the share copy carries.

**What happens now.** The share panel has one field, the title, with the help line "Everyone in the house can see it." (`apps/prayer.html:1308-1309`). The family copy blanks `phone` and `detail` but copies `for` and `category` (`:1314-1315`), and adds the category to the family list (`:1311`). Eli shared `p009` "Uncle Ray to come to faith" (For "Uncle Ray", category "Those Who Are Lost - Family") and rewrote the title to "A hard season for a friend". The family row kept `for:'Uncle Ray'` and `category:'Those Who Are Lost - Family'`. Other adults see "For Uncle Ray" in the detail sheet (`:996`), Pray now (`:1624`), Kitchen view (`:1653`) and Copy (`:1129`), and the category as a heading. The next prayer job listed the copy as new, and its push body is "New on the family list: A hard season for a friend (for Uncle Ray)." (`worker/src/reminders.js:196-201`).

**Expected.** The share panel shows what will be published (title, For, category), each editable or removable, and by default the copy carries only what the adult confirmed.

**Why it matters to the household.** The adult rewrote the title precisely to hide who and what the request is about; the app publishes both anyway, to other adults, guests and lock screens.

**Evidence.**
- Code: `apps/prayer.html:996, 1129, 1306-1323, 1580-1582, 1624, 1653`; `worker/src/reminders.js:196-201`; `handoff/prayer/SPEC.md:35-38`; `handoff/prayer/prayer.html:1001`.
- Runs: `audits/evidence/p3/prayer/critic-push-share.json`, `audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-1.json`, `audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-2.json`.
- Screenshots: `audits/evidence/p3/prayer/critic-share-panel.png`, `audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-1-panel.png` ("For Uncle Ray" above a panel that offers only the title), `audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-2-panel.png`, `audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-1-mom-sheet.png`, `audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-2-mom-sheet.png`, `audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-1-kid.png`, `audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-2-kid.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/critic-push-share.mjs"` (second half; demo clock, WebKit). As Eli on My list: List → search → open `p009` → Send to family list → replace the title with "A hard season for a friend" → Send; then read `/api/data/prayer?scope=family` and force `POST /api/admin/cron/run {job:'prayer'}`. Observed: `sharePanel {fields:['askIn=Uncle Ray to come to faith']}`; `familyCopyOnServer {title:'A hard season for a friend', for:'Uncle Ray', category:'Those Who Are Lost - Family'}`; `job3 new [{title:'A hard season for a friend', by:'eli'}]`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-critic-share-copies-for-and-category-2-1.mjs"` (demo clock, WebKit, a throwaway VAPID pair, and `scripts/push-receiver.mjs` as the push service; Mom, Dad, Mae and Mea subscribed):
  - The family row `{title:'A hard season for a friend', for:'Uncle Ray', category:'Those Who Are Lost - Family', by:'eli'}`.
  - The Wed 8 am job notified christian, mom, dad and niece and skipped Eli as the author; every decrypted push read "New on the family list: A hard season for a friend (for Uncle Ray)."
  - Mom's detail sheet read "… For Uncle Ray", and her Copy line "• A hard season for a friend — Uncle Ray".
  - Kiara's page mentioned neither (`pageMentionsFor:false, pageMentionsCategory:false`).
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-critic-share-copies-for-and-category-2-2.mjs"` (demo clock, WebKit): the panel had one input; the copy read through the API kept For and category with `phone:''` and `detail:''`; the job listed it as new; Mom's detail sheet and All list showed the For and the category; the kid view on Kiara's iPad showed neither.

**Corrected claim.** Confirmed for adults, the push, and guests (guests get the same detail sheet code path; not driven). Kids are not shown the For or the category: a shared copy always has `by`, so the kid card shows "<asker> asked" (`apps/prayer.html:1580-1582`), and a kid can read the For only through the raw API. "Silently" overstates it: the sheet around the panel shows "For Uncle Ray", but nothing says it will be copied. The "(for …)" suffix appears only when the share is the recipient's only new request (`worker/src/reminders.js:199-201`). Copying `for` comes from the reference build (`handoff/prayer/prayer.html:1001`), but its spec gives the reason the title can be rewritten: private wording is often not what belongs on a shared screen (`handoff/prayer/SPEC.md:35-38`).

#### P3-PRAYER-19 — An open Kitchen view never refreshes: other people's adds and answers do not appear (from the critic)

- **Severity: medium** (skeptics: medium / medium; the critic's medium). A secondary display shows a wrong list: requests added elsewhere are missing and answered ones stay. No data is lost or exposed; the app's data, Today and the server are right, and Close then reopen fixes it.
- **Exposure.** Kitchen view left open on the shared iPad, which its label "Big type for the counter" invites.
- **Related.** P2-PROF-09 (the shared iPad never returns to the picker, so a Kitchen view stays up). Not a Phase 2 duplicate: it is Prayer's own render path.

**What happens now.** `openKitchen()` is the only code that writes `#kitchenBody` (`apps/prayer.html:555, 1645-1656`). A remote change runs `absorbRemote` → `load()` and `renderAllScreens()` (`:699-705, 1152`), which never rebuild it, and the Kitchen overlay is not in the busy test (`:701-702`), so the repaint runs underneath. The date line is also fixed when it opens (`:1649-1650`). In the critic's run Mae added "Critic: rain for the garden" to the family list; the Kitchen iPad had it in its data after 20175 ms and on its Today list, but not on the open Kitchen view. It appeared only after Close and reopen.

**Expected.** Kitchen view re-renders on remote changes (rebuild it from `absorbRemote` while `#kitchen` is on) and at the day rollover.

**Why it matters to the household.** The counter display drifts from the real list with no sign: a new request is missing and an answered one is still asked for.

**Evidence.**
- Code: `apps/prayer.html:555, 699-705, 1152, 1645-1656, 1760`.
- Runs: `audits/evidence/p3/prayer/critic-sweep-kitchen.json`, `audits/evidence/p3/prayer/verify-critic-kitchen-view-stale-3-1.json`, `audits/evidence/p3/prayer/verify-critic-kitchen-view-stale-3-2.json`.
- Screenshots: `audits/evidence/p3/prayer/critic-kitchen-stale-ipad.png`, `audits/evidence/p3/prayer/verify-critic-kitchen-view-stale-3-1-ipad.png` (the answered "Pastor Tim and Rebecca" still listed under Church Leadership after the pull), `audits/evidence/p3/prayer/verify-critic-kitchen-view-stale-3-2-ipad-kitchen-after-pull.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/critic-sweep.mjs" kitchen` (real clock, WebKit). Eli on iPad landscape: Family → More → Kitchen view. Mae on a second phone: Family → Add → "Critic: rain for the garden" → Add to the list. Wait for the iPad's poll, then compare the data, `#todayList` and `#kitchenBody`. Observed: `ipadPulled {inData:true, afterMs:20175}`; `kitchenAfterPull {stillOpen:true, kitchenShowsNew:false, todayListHasNew:true}`; `kitchenReopened {kitchenShowsNew:true}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-critic-kitchen-view-stale-3-1.mjs"` twice (fresh typical instance, real clock, WebKit). Mae added a request through the Add form, and a batch write as Mae marked `s008` "Pastor Tim and Rebecca" answered. The iPad pulled both (after 20184 and 20196 ms): `afterPull {kitchenStillOpen:true, kitchenShowsNew:false, kitchenStillShowsAnswered:true, todayListShowsNew:true}`. It was the same after a second 30 s poll. After reopen: `{kitchenShowsNew:true, kitchenStillShowsAnswered:false}`.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-critic-kitchen-view-stale-3-2.mjs"` twice. Mae added a request and answered `s008` through the app's own save; the iPad pulled at 19228 and 19190 ms; `kitchenAfterPull {kitchenShowsNew:false, kitchenStillShowsAnswered:true, kitchenUnchanged:true, todayListHasNew:true}`; reopening fixed both.

**Corrected claim.** Confirmed and widened: a remote answer also goes stale (the answered request stays listed), not only a remote add, and the view never catches up by itself. Deletes take the same path but were not run; the date line going stale after midnight is from the code only. `TODAY` is a load-time constant (`apps/prayer.html:712`), so at the rollover the whole app is stale, not only this view (P2-STAB-03).

#### P3-PRAYER-20 — The Add form never says which list it adds to, so a private request can land on the family list (from the critic)

- **Severity: medium** (skeptics: medium / medium; the critic's medium). Error prevention fails in the add flow, and the exposure is real: kids, guests and other adults' push. Not (b): the person did pick Family on Today at some point, so nothing is shown against a choice they made; not high: adding works and the request lands where the Today switch points.
- **Exposure.** Any adult whose last Today choice was Family. The choice is stored in person scope (`apps/prayer.html:633, 694`), so it carries over to later opens and to the adult's other devices.
- **Related.** UX-PRAYER-4 is the same missing label in Settings (`audits/01-leads.md:187`). Not a Phase 2 duplicate: P2-PWA-01 covers private titles in the feed.

**What happens now.** Add pushes to `L()`, the list last chosen on Today (`apps/prayer.html:707, 1436`). The screen reads "Add a request / What are you praying for? / Who is it for? / Detail / Their number… / Category / How often / Add to the list" (`:479-501`), with no list name and no switch; Category defaults to "Personal". The only cue is the partial teal re-theme (`:875`; VIS-PRAYER-4): the mic glyph and the nav turn teal, while "Add to the list" keeps the person's colour. After saving there is no toast and no undo, and the app returns to Today. In the critic's run Eli had switched to Family, then used nav Add for "My blood test results on Friday". It was saved as family row `prayer:p012` (by eli), showed on Ezra's kid page, and the prayer push job would list it as new.

**Expected.** The Add screen names its target ("Add to My list" / "Add to the Family list"), or offers a Mine/Family choice on the form.

**Why it matters to the household.** A request an adult meant to keep private goes to the kids' cards, guests and other adults' lock screens with no warning.

**Evidence.**
- Code: `apps/prayer.html:479-501, 633, 694, 707, 875, 1271-1275, 1429-1443`; `worker/src/reminders.js:174-204`.
- Runs: `audits/evidence/p3/prayer/critic-add-focus.json` (first half; its `addScreenNamesList:true` is a false positive that matched the category option "Family"), `audits/evidence/p3/prayer/verify-critic-add-screen-no-list-name-4-1.json`, `audits/evidence/p3/prayer/verify-critic-add-screen-no-list-name-4-2.json`.
- Screenshots: `audits/evidence/p3/prayer/critic-add-on-family.png`, `audits/evidence/p3/prayer/verify-critic-add-screen-no-list-name-4-1-add-screen.png`, `audits/evidence/p3/prayer/verify-critic-add-screen-no-list-name-4-2-add-screen.png` (the form names no list; Category reads "Personal"), `audits/evidence/p3/prayer/verify-critic-add-screen-no-list-name-4-2-after-save.png`, `audits/evidence/p3/prayer/verify-critic-add-screen-no-list-name-4-2-ezra.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/critic-add-focus.mjs"` (first half; demo clock, WebKit, iPhone PWA as Eli). Tap Family, then nav Add, type "My blood test results on Friday", tap Add to the list; read `/api/data/prayer?scope=family`, then open Prayer as Ezra. Observed: `landedOnFamilyList {key:'prayer:p012', by:'eli'}`, `kidCanSee true`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-critic-add-screen-no-list-name-4-1.mjs"`. After Eli tapped Family and the device closed, a new page as Eli reopened on `'shared'`. The Add screen's visible text, leaving out the category select, named no list (`mentionsListOutsideCategorySelect false`, `listSwitchVisible false`, `bodyShared true`). The request landed at `{family:{key:'prayer:p012', by:'eli'}, person:null}` with no toast; Ezra saw it; the prayer job listed it as new, by eli.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-critic-add-screen-no-list-name-4-2.mjs"`: Family chosen, then a full reload gave `listAfterReopen {active:'shared'}`; the Add screen `namesListOutsideSelect:false`, `switchVisible:false`, with `--accent #137F77` reaching only the mic and nav; after save `{screen:'s-today', toast:null}`, landed `{family:{key:'prayer:p012', by:'eli'}, person:false}`; `kidSees:true`; the job listed it as new.

**Corrected claim.** Accurate, and slightly worse than filed: the Family choice persists across opens, reloads and the adult's devices, so it can come from an earlier session. There are cues (the Today switch reads Family when the app opens, and the app returns to the family Today after saving), but none on the Add screen itself. The push reaches other adults only if they have prayer pushes on; the rig had no subscriptions, and the job skipped only the author.

#### P3-PRAYER-21 — An undone tick still counts the day in the streak, month count and calendar (from the critic)

- **Severity: low** (skeptics: low / low; the critic's low). Only derived statistics are off by one day after an undone mis-tap; no request is lost and the tick itself works.
- **Exposure.** Any tick undone on a day with no other prayer on that list, on the personal or the family list.
- **Related.** Not a Phase 2 duplicate (P2-CHAT-04 is F260's chat tool). P3-PRAYER-05 is the family toggle that produces many of these un-ticks.

**What happens now.** `setPrayed` calls `markDay()` when a request is marked (`apps/prayer.html:1604`), and `markDay()` only adds (`:732-733`). Nothing removes `TODAY` from `prayerDays` on an un-tick; the only other writers are import (`:1513`) and the unused `mergeShared` (`:1700`). In the critic's run Mae (streak 3, 9 days this month, not yet prayed on Tuesday) ticked one request on List and ticked it again. The row's `lastPrayedAt` went back to null, but `prayerDays` kept 2026-09-22 on the server, and the strip and Record read "4 days in a row … 10 days this month".

**Expected.** When an un-tick leaves nothing on that list marked today, `TODAY` leaves `prayerDays`. On the family list the day must stay while any request still has `lastPrayedAt === TODAY` or a non-empty `prayedBy[TODAY]`, so one person's un-tick never wipes it for everyone.

**Why it matters to the household.** The streak and the Record calendar credit a day on which the person did not pray, and the Today strip contradicts itself ("0/1 today" beside "1 day in a row").

**Evidence.**
- Code: `apps/prayer.html:732-739, 747-760, 1513, 1593-1607, 1700`; `handoff/prayer/SPEC.md:121, 224`.
- Runs: `audits/evidence/p3/prayer/critic-sweep-untick.json`, `audits/evidence/p3/prayer/verify-critic-untick-keeps-day-5-1.json`, `audits/evidence/p3/prayer/verify-critic-untick-keeps-day-5-2.json`.
- Screenshots: `audits/evidence/p3/prayer/critic-untick-record.png`, `audits/evidence/p3/prayer/verify-critic-untick-keeps-day-5-1-record.png` (Tue 22 filled on the calendar), `audits/evidence/p3/prayer/verify-critic-untick-keeps-day-5-2-today.png` ("One left to pray through." over "0/1 today · 1 day in a row").

**Reproduction.** `node "audits/tools/phase3/prayer/critic-sweep.mjs" untick` (demo clock, WebKit, iPhone as Mae). List → open a group → tap a circle → reopen the group → tap the same circle; read `currentStreak()`, `prayerDays` and the server row. Observed: `before {daysHasToday:false, streak:3, month:9}`; `afterUntick {daysHasToday:true, streak:4, month:10, rowLastPrayedAt:null}`; `serverPrayerDaysHasToday true`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-critic-untick-keeps-day-5-1.mjs"` as Mae on List: after the tick streak 4 and month 10; after the un-tick the row's `lastPrayedAt` null and `anyTickedToday false`, yet streak 4 and month 10; the server's `prayerDays` ended `"2026-09-21","2026-09-22"`; after reopening Prayer, Record read "4 days in a row 6 best run 10 days this month" with today's calendar cell on.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-critic-untick-keeps-day-5-2.mjs"` as Dad from Today on a first-ever day. He added "Safe travel for the Millers", then ticked and un-ticked it: before `{streak:0, month:0}`; after the un-tick `{daysHasToday:true, streak:1, month:1, anyTickedToday:false}` and the strip "0/1 today 1 day in a row 1 days this month"; server `prayerDays ['2026-09-22']`; the same after reopening.

**Corrected claim.** Confirmed, and wider: it reproduces from Today as well as List, and on a first-ever day (0 → 1). It is not by design: the spec defines `prayerDays` as the dates "on which at least one request was marked", and treats an un-tick as undoing the mark (`handoff/prayer/SPEC.md:121, 224`). Nothing mitigates it: `mergeShared`'s union is dead code, and `prayerDays` syncs as a last-write-wins row, so a removal would reach other devices. ("1 days this month" is a separate plural slip.)

#### P3-PRAYER-22 — Every Sunday Today says "Some of the list has gone quiet" even when nothing has (from the critic)

- **Severity: low** (skeptics: low / low; the critic's low). Misleading copy; the review flow works, and Record corrects it one tap later.
- **Exposure.** Every adult, every Sunday, with the plan's review switch on (the default, `apps/prayer.html:604`). Kids never see it (`:396`).

**What happens now.** `reviewDue()` is true on any Sunday without reading the review lists (`apps/prayer.html:803-806`), and Today then shows "Some of the list has gone quiet." with "See what" (`:911-913`). On Sun 27 Sep, Mae and Mea both had cold 0, silent 0 and fresh 0 and still saw the prompt. See what opened Record, which said "Nothing needs attention. The list is current." with badge 0.

**Expected.** Surfacing review on Sundays is by design (`handoff/prayer/SPEC.md:83-85`); only the words are wrong. When `cold` is empty, show a Sunday-neutral line (for example "Sunday: a good day to look over the list."), or nothing when all three lists are empty.

**Why it matters to the household.** The app contradicts itself one tap later and adds guilt copy on the day the family sets aside.

**Evidence.**
- Code: `apps/prayer.html:396, 604, 793-806, 911-913, 971-981`; `handoff/prayer/SPEC.md:83-85`; `handoff/prayer/prayer.html:775`.
- Runs: `audits/evidence/p3/prayer/critic-sweep-sunday.json`, `audits/evidence/p3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-1.json`, `audits/evidence/p3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-2.json`.
- Screenshots: `audits/evidence/p3/prayer/critic-sunday-christian-today.png`, `audits/evidence/p3/prayer/critic-sunday-niece-today.png`, `audits/evidence/p3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-1-christian-sunday.png`, `audits/evidence/p3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-2-christian-sunday-today.png` (the nudge under the headline "Nothing on the list today.").

**Reproduction.** `node "audits/tools/phase3/prayer/critic-sweep.mjs" sunday`. It opens Prayer as Mae, Mea and Eli with the browser clock at Sun 27 Sep 2026 08:40 New York, reads `reviewItems()` and `#reviewPrompt`, then taps See what. Observed: `christian {cold:0, silent:0, fresh:0, prompt:'Some of the list has gone quiet. See what'}`; `christian-record {body:'Nothing needs attention. The list is current.', badge:'0'}`; Mea the same.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-1.mjs"` with a Saturday control (Sat 26 Sep 08:40): Saturday `reviewDue false` and no prompt for Mae or Mea; Sunday `reviewDue true` and the prompt for both, with all three lists empty; See what → "Nothing needs attention. The list is current.", count 0. Mea has no active requests at all.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-critic-sunday-nudge-says-gone-quiet-6-2.mjs"` (Saturday and Sunday, Mae and Mea): the same; Mea's Sunday page showed the nudge above "Nothing on this list yet. Add a request".

**Corrected claim.** Accurate, with two refinements. Showing review on Sundays is intended, so only the fixed wording at `apps/prayer.html:912` is wrong; the copy is inherited from the reference (`handoff/prayer/prayer.html:775`). The trigger is wider than filed: it also shows for a person with no requests at all.

#### P3-PRAYER-23 — Removing the category a "One category only" plan uses leaves the plan pointing at a deleted category (from the critic)

- **Severity: low** (skeptics: low / low; the critic's low). No request is lost (they move to Personal) and "Change the plan" recovers; an uncommon combination.
- **Exposure.** A "One category only" plan whose category is then removed in Settings. On the family list the stale plan syncs, so every adult's family Today empties.

**What happens now.** Rename fixes each plan's `dayMap` and its `focusCategory` (`apps/prayer.html:1348-1350`); Remove fixes only `dayMap` (`:1363-1364`). In focus mode `todaySet` keeps only requests in `focusCategory` (`:813-815`), and the Settings select marks an option selected only when it equals `focusCategory` (`:1196-1199`). Eli made the plan "Health week" (focus "Health Needs"; Today showed "Dad's knee recovery"), then removed "Health Needs". The plan kept `focusCategory:'Health Needs'`, the select displayed "Spiritual Needs", and Today read "Nothing on the list today." / "Nothing scheduled for today under this plan."

**Expected.** Remove re-points `focusCategory` the way Rename does: to Personal, where the requests went, or to the first category.

**Why it matters to the household.** Settings shows one category while Today filters by one that no longer exists. The list empties with no reason given, and on the family list it empties for everyone.

**Evidence.**
- Code: `apps/prayer.html:813-815, 1196-1199, 1341-1368, 1409-1410`.
- Runs: `audits/evidence/p3/prayer/critic-add-focus.json` (second half), `audits/evidence/p3/prayer/verify-critic-focus-plan-deleted-category-7-1.json`, `audits/evidence/p3/prayer/verify-critic-focus-plan-deleted-category-7-2.json`.
- Screenshots: `audits/evidence/p3/prayer/critic-focus-settings-after-remove.png`, `audits/evidence/p3/prayer/critic-focus-today-after-remove.png`, `audits/evidence/p3/prayer/verify-critic-focus-plan-deleted-category-7-1-settings.png`, `audits/evidence/p3/prayer/verify-critic-focus-plan-deleted-category-7-1-today.png`, `audits/evidence/p3/prayer/verify-critic-focus-plan-deleted-category-7-2-mine-settings.png`, `audits/evidence/p3/prayer/verify-critic-focus-plan-deleted-category-7-2-mine-today.png`, `audits/evidence/p3/prayer/verify-critic-focus-plan-deleted-category-7-2-family-settings.png`, `audits/evidence/p3/prayer/verify-critic-focus-plan-deleted-category-7-2-family-today.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/critic-add-focus.mjs"` (second half; demo clock, WebKit, iPhone as Eli on My list). More → New plan "Health week" → One category only → Health Needs → Today; then More → Categories → Remove on Health Needs → Remove → Today. Observed: `focusBefore {focus:'Health Needs', today:["Dad's knee recovery"]}`; `settingsAfterRemove {planFocusCategory:'Health Needs', selectShows:'Spiritual Needs', categoryStillListed:false}`; `todayAfterRemove {line:'Nothing on the list today.'}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-critic-focus-plan-deleted-category-7-1.mjs"` on My list: after the removal `focusCategory` was still "Health Needs", no option was selected and the select showed "Spiritual Needs"; Today was empty while both Health Needs requests sat in Personal (14 active); the same after reopening Prayer.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-critic-focus-plan-deleted-category-7-2.mjs"` on My list and on the Family list (removing "Spiritual Needs"): the same on both; Mom read the family plan through the API as `{mode:'focus', focusCategory:'Spiritual Needs', categoryExists:false}`.

**Corrected claim.** Confirmed on both lists, and saved (it survives a reopen). One more facet: the select falls back to its first option with none selected, so choosing that displayed category fires no change event (`apps/prayer.html:1410`); to repair the plan a person must first pick a different category.

#### P3-PRAYER-24 — Family prayed marks are kept by display name: a guest who shares a household name is shown as that person (from the critic)

- **Severity: low** (skeptics: low / low; the critic's low). Misattribution in a secondary display with a narrow precondition; nothing private is exposed. The one lost record, a same-name tap erasing the other person's mark for the day, is one day's who-prayed name for an adult, and it is set off by P3-PRAYER-05's shared toggle.
- **Exposure.** A guest whose name matches a household member's (neither Me → Add a guest nor `POST /api/profiles` rejects a duplicate name, `worker/src/index.js:174-201`), or an admin rename during the day.
- **Related.** **P3-KIDVERSE-07** (the Kid Verse report) owns the star credit that goes through the same name match (`apps/kidverse.html:426-434, 474`); this finding owns Prayer's faces, kid cards and the TV. Before the critic this was a code-only note in the §5 deviations table. Not a Phase 2 duplicate.

**What happens now.** `setPrayed` stores `hub.profile.name` in `prayedBy[TODAY]` (`apps/prayer.html:1599-1602`). Every reader matches by name: the kid card's done state (`mePrayed`, `:728-729`), the faces on family rows (`:1557-1566`), the TV's "who prayed today" (`index.html:1057-1061`) and chat's `mark_prayed` (`worker/src/chat.js:244-246`). Elizabeth added a guest named David, and he prayed `s008` on the family list. The server stored `prayedBy['2026-09-22']:['David']`, and Elizabeth's row read "Prayed today: David" with Dad's face.

**Expected.** `prayedBy` records profile ids, with names or faces drawn at render (or id plus name), so identity survives shared names and renames. A data change only; Prayer's layout and ids stay.

**Why it matters to the household.** The family list, the TV and a kid's own card credit the wrong person.

**Evidence.**
- Code: `apps/prayer.html:728-729, 1557-1566, 1578-1583, 1593-1607`; `index.html:1057-1061`; `worker/src/chat.js:244-246`; `worker/src/index.js:174-201`; `apps/kidverse.html:426-434, 474`.
- Runs: `audits/evidence/p3/prayer/critic-sweep-guest.json`, `audits/evidence/p3/prayer/verify-critic-prayedby-keyed-by-name-8-1.json`, `audits/evidence/p3/prayer/verify-critic-prayedby-keyed-by-name-8-2.json`.
- Screenshots: `audits/evidence/p3/prayer/critic-guest-samename-mom.png`, `audits/evidence/p3/prayer/verify-critic-prayedby-keyed-by-name-8-1-mom.png`, `audits/evidence/p3/prayer/verify-critic-prayedby-keyed-by-name-8-1-tv.png`, `audits/evidence/p3/prayer/verify-critic-prayedby-keyed-by-name-8-1-ezra.png`, `audits/evidence/p3/prayer/verify-critic-prayedby-keyed-by-name-8-2-mom.png`, `audits/evidence/p3/prayer/verify-critic-prayedby-keyed-by-name-8-2-tv.png` (the TV's "Prayed today" pane shows Dad's face for the guest's prayer).

**Reproduction.** `node "audits/tools/phase3/prayer/critic-sweep.mjs" guest` (demo clock, WebKit). As Mom, `POST /api/profiles {name:'David'}`; on a new device for that guest, open Prayer → Family → tick an unprayed row; read the server row and open Prayer → Family as Elizabeth. Observed: `guestCreated {status:200}`; `serverPrayedBy {'2026-09-22':['David']}`; `momSeesFaces {label:'Prayed today: David'}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-critic-prayedby-keyed-by-name-8-1.mjs"`, giving the guest his own emoji and colour. Elizabeth's row showed "Prayed today: David" with Dad's fishing-rod face and colour, and so did the TV's pane, while the feed line carried the guest's own avatar. A second guest named "Ezra" ticked `s006`; kid Ezra, who never tapped it, then saw his card as prayed (`pressed:'true'`, `liDone:true`). His star could not be observed, because the seed had already credited that day.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-critic-prayedby-keyed-by-name-8-2.mjs"`: the same faces on Elizabeth's row and the TV. When Dad had ticked `s006` and the guest David then tapped it, the row showed as done to the guest (the shared `lastPrayedAt`), his tap un-ticked it, and Dad's name was erased from `prayedBy['2026-09-22']`. Control: Eli's tap on a row Dad prayed left Dad's name.

**Corrected claim.** Confirmed for the faces, the TV and kid cards, with two corrections. The faces never show "whichever" David: `people()` lists Dad first, so the guest's prayers always show with Dad's face and the guest's own face never appears there. And adult taps never add a second name under one day, because the adult tap toggles the shared `lastPrayedAt` (`apps/prayer.html:1595`; P3-PRAYER-05); two names merge only through chat's `mark_prayed` or the forced-on paths (kid card, Pray now). What does happen is that a same-name tap on a row the other person prayed erases that person's mark. The rename facet is from the code only (`apps/prayer.html:728-729`).

#### P3-PRAYER-25 — Editing a family request's wording makes the prayer push announce it as "New on the family list" (from the critic)

- **Severity: low** (skeptics: low / low; the critic's low). Only the wording of a push is wrong; the row was already visible to everyone and the list stays right. It sits at the top of low because the false push uses up each recipient's one prayer push that day.
- **Exposure.** Any adult editing the title of a family request of any age. Detail-only edits do not trigger it.
- **Related.** p2Ref **P2-PWA-04** (medium): a family request added after the day's push is never announced. That is the missed-announcement side; this is the false-announcement side, and it makes P2-PWA-04 likelier, because `notify` sends one prayer push per person per day (`worker/src/reminders.js:50-63`).

**What happens now.** The prayer job fingerprints each family row as `createdAt|title` (`worker/src/reminders.js:157`) and treats any changed fingerprint as new (`:181`). Its comment assumes the app never changes either field after creation (`:143-147`), but the Edit sheet rewrites the title (`apps/prayer.html:1058`). Mae changed `s002` "Grandma Jo's visit this week" (created 2026-09-17) to "…this weekend", and the next job listed it under `new`; the control run with no change listed nothing. The push goes to every subscribed adult except the row's author, the editor included (`worker/src/reminders.js:195-203`).

**Expected.** Only rows the job has never seen count as new (compare keys or `createdAt`, not titles), or edits get their own wording.

**Why it matters to the household.** False "New on the family list" alerts teach the house to ignore the prayer push, and they use up the day's one prayer push, so a truly new request later that day is not pushed.

**Evidence.**
- Code: `worker/src/reminders.js:50-63, 143-157, 175-204`; `apps/prayer.html:1050-1063, 1347`.
- Runs: `audits/evidence/p3/prayer/critic-push-share.json` (first half), `audits/evidence/p3/prayer/verify-critic-title-edit-announced-as-new-9-1.json`, `audits/evidence/p3/prayer/verify-critic-title-edit-announced-as-new-9-2.json`.
- Screenshots: `audits/evidence/p3/prayer/verify-critic-title-edit-announced-as-new-9-1-after-save.png`, `audits/evidence/p3/prayer/verify-critic-title-edit-announced-as-new-9-2-edited-sheet.png`.

**Reproduction.** `node "audits/tools/phase3/prayer/critic-push-share.mjs"` (first half; demo clock, WebKit). `POST /api/admin/cron/run {job:'prayer'}` twice as Eli (baseline, then control); as Mae on the family list: List → search → open `s002` → Edit → change the title → Save; run the job again and read its `new`. Observed: `job1 (control) new []`; `serverAfterEdit {title:"Grandma Jo's visit this weekend", createdAt:'2026-09-17'}`; `job2 new [{title:"Grandma Jo's visit this weekend", by:'eli'}]`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-critic-title-edit-announced-as-new-9-1.mjs"` on a different row. A detail-only edit of `s006` gave `new []`. A title edit of `s008` (written by Dad on 2025-11-26) gave `new [{title:'Pastor Tim and Rebecca (updated)', by:'dad'}]`, skipping only Dad. A run after that with no change gave `new []`.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-critic-title-edit-announced-as-new-9-2.mjs"` end to end with a throwaway VAPID pair and `scripts/push-receiver.mjs`, with the five adults and the seeded guest Grandma Jo subscribed. A detail-only edit sent nothing. After the title edit the job notified christian, mom, dad, niece and `guest-grandmajo`, skipping Eli (the author), and the receiver decrypted five pushes reading "New on the family list: Grandma Jo's visit this weekend (for Grandma Jo)." One went to Mae, who made the edit.

**Corrected claim.** Confirmed end to end. One part of the filed exposure was wrong: a category rename changes only `category` (`apps/prayer.html:1347`), so it cannot trigger this. Import and P3-PRAYER-01's replaced rows were not re-tested.

#### P3-PRAYER-26 — Escape closes only Pray mode; the sheet, More, Kitchen view and ask panels ignore it, and Enter submits nothing (from the critic)

- **Severity: low** (skeptics: low / low; the critic's low). Keyboard only; every overlay has a visible Close, Done or Cancel, and tapping works. It breaks a stated house rule (CLAUDE.md "Adding an app" item 6, `CLAUDE.md:63`).
- **Exposure.** Desktop, or an iPad with a keyboard.
- **Related.** Phase 2's UX-HOME-4 (`audits/02-shell.md:615`) covers Escape in the shell's app viewer, not overlays inside the app. The inline `ask()` panel replaced native dialogs (`apps/prayer.html:1079-1083`; OK-PRAYER-2), which handled Enter and Escape by themselves, so this is a regression of that change.

**What happens now.** The only keydown listener is Pray mode's, and it returns unless Pray mode is open (`apps/prayer.html:1709-1714`). `ask()` wires Save and Cancel to clicks only (`:1089-1126`). `#f-title` is not inside a `<form>`, and `#f-save` is a plain button wired to click (`:481-482, 499, 1429`). On desktop (1440×900, Eli), Escape left the detail sheet, the More sheet, Kitchen view and an "Add an update" panel open. Enter in the Add title added nothing (19 → 19, still on `s-add`), and Enter in the New plan field created no plan and left the panel open. Escape in Pray mode closed it.

**Expected.** Escape closes the sheet, Kitchen view and any `ask()` panel; Enter submits the Add form and single-line `ask()` fields. Enter in a textarea, such as "Add an update", keeps inserting a newline.

**Why it matters to the household.** On the desktop, keyboard users must reach for the mouse, or Tab to a button, to dismiss every overlay and submit every form.

**Evidence.**
- Code: `apps/prayer.html:481-482, 499, 1079-1126, 1417-1424, 1429-1443, 1709-1714`; `CLAUDE.md:63`.
- Runs: `audits/evidence/p3/prayer/critic-keys.json`, `audits/evidence/p3/prayer/verify-critic-no-enter-escape-10-1.json`, `audits/evidence/p3/prayer/verify-critic-no-enter-escape-10-2.json`.
- Screenshot: `audits/evidence/p3/prayer/verify-critic-no-enter-escape-10-1-sheet-after-escape.png` (the detail sheet still open after Escape, with Done focused).

**Reproduction.** `node "audits/tools/phase3/prayer/critic-keys.mjs"` (demo clock, WebKit, desktop 1440×900 as Eli). Observed: `detailSheetOpenAfterEscape true, moreSheetOpenAfterEscape true, kitchenOpenAfterEscape true, askPanelOpenAfterEscape true, control_prayOpenAfterEscape false, addFormEnter {prayersBefore:19, prayersAfter:19}, askTextEnter {plansBefore:2, plansAfter:2, panelStillOpen:true}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/prayer/verify-critic-no-enter-escape-10-1.mjs"`, moving focus inside each overlay before Escape and keeping a valid value with Save enabled before Enter. The sheet (focus on its Close), More, Kitchen and the ask panel all stayed open, and Pray mode closed. Enter in the Add title left 19 requests on `s-add`, while clicking Add to the list made 20. The New plan field ("Weekday plan", Save enabled) made no plan on Enter (2 → 2) and a third on clicking Create.
- **Skeptic 2** ran `node "audits/tools/phase3/prayer/verify-critic-no-enter-escape-10-2.mjs"` in WebKit and Chromium, with the same results in both. Tabbing to the sheet's Done and pressing Enter did close it.

**Corrected claim.** Accurate, with one overstatement removed: keyboard users can still dismiss overlays by tabbing to Done, Close or Cancel and pressing Enter (skeptic 2). What is missing is Escape on the sheet, Kitchen view and `ask()` panels, and Enter on the Add title and single-line `ask()` fields. "Add an update" is a textarea, so only its Escape half applies.

### Usability, visual and gap findings

These were not adversarially verified. Items marked "from the visual check" were added or amended by the independent visual checker.

**UX**

- **UX-PRAYER-1 — The Add form's main button starts hidden under the tab bar** (medium).
  - When Add opens, "Add to the list" sits at y 846-904 while the nav starts at y 807 on the iPhone PWA and at 695 on iPad landscape; on desktop it is at y 843 with the nav at 775. It is visible on iPad portrait.
  - The person has to scroll to find the button that finishes the job.
  - Evidence: `audits/evidence/p3/prayer/layout.json` (`add.hiddenUnderNav` true on iphone-pwa, ipad-landscape and desktop); `audits/evidence/p3/prayer/layout-add-iphone.png`; `audits/screens/prayer/add-typical-iphone-pwa-light.png`; `apps/prayer.html:479-501`. Run `node "audits/tools/phase3/prayer/layout.mjs"`.
- **UX-PRAYER-2 — Kid cards: prayed and not-prayed look almost the same, the untapped button already says "Prayed", and nothing tells a pre-reader what a request is** (medium; amended from the visual check).
  - Every kid button reads "✓ Prayed", with the same check and label before and after the tap (`apps/prayer.html:1587-1588`). Only the fill changes, from the profile colour to olive (`:427`), plus a faded title.
  - The visual checker measured the two fills only 1.75:1 apart for Ezra in light and 1.16:1 in dark, and 1.28 and 1.06 for Kiara. A 4-5-year-old or a colour-blind viewer cannot tell done from not done, which breaks the house rule that kid flows work by icon, colour and position alone.
  - The title is text a pre-reader cannot read; there is no picture and no read-aloud (Kid Verse has read-aloud). A mis-tap cannot be undone (a second tap keeps the mark). The header shows the plan name ("Tuesday, September 22 · Everything").
  - The one non-reading cue is the kid's own face appearing under "prayed today" after the tap.
  - Evidence: `apps/prayer.html:427, 1577-1591`; `audits/evidence/p3/prayer/leads.json` (L9-kidCards, L9-kidHeader, kidTapTwice); `audits/evidence/p3/prayer/vischeck-fab-list.json`; `audits/evidence/p3/prayer/vischeck-kid-states-ezra-dark.png`; `audits/screens/prayer/kid-typical-ipad-portrait-light.png`; `audits/screens/prayer/kid-typical-desktop-dark.png`; `audits/screens/prayer/kid-all-prayed-typical-ipad-portrait-light.png`.
- **UX-PRAYER-3 — Nothing in Prayer is legible from across the room, including "Kitchen view — Big type for the counter"** (medium).
  - Measured readable distances on the iPad: h1 0.88 m, row titles 0.50 m, meta 0.38 m, nav 0.35 m, kid titles 0.96 m, Kitchen items (24 px) 0.69 m and its heading 1.0 m. 2-3 m needs roughly 90-130 px type.
  - Evidence: `audits/evidence/p3/prayer/layout.json` (`readableAtMetres`); `audits/screens/prayer/kitchen-typical-ipad-landscape-light.png`; `apps/prayer.html:357-362`. (The harness PNG `layout-kitchen-ipad-landscape.png` renders the font too thin; see the caveat in §5.)
- **UX-PRAYER-4 — Settings never says which list it edits, and silently edits the family plan** (medium).
  - Plans, categories and paste all act on the list last chosen on Today (`apps/prayer.html:707-708, 1171-1227`). The headings are "Settings, Prayer plan, Paste a list, Categories, Backup" and never name "My list" or "Family". On Family, a plan change rewrites the house's plan row.
  - Evidence: `apps/prayer.html:503-532, 707-708`; `audits/evidence/p3/prayer/leads.json` (L16-settingsNamesList); `audits/screens/prayer/settings-typical-iphone-pwa-light.png`.
- **UX-PRAYER-5 — Two different controls are both called "More"** (low). Today's "··· More" opens Kitchen view, Copy and Print (`apps/prayer.html:453, 1725-1735`); the tab bar's "More" opens Settings (`:570`). Evidence: `audits/evidence/p3/prayer/leads.json` (twoMores); `audits/screens/prayer/today-typical-iphone-pwa-light.png`.
- **UX-PRAYER-6 — A family request's detail sheet hides who asked and who prayed today** (low). The row shows "X asked" and the faces; the sheet shows neither (`apps/prayer.html:985-1019`). Evidence: `audits/evidence/p3/prayer/leads.json` (L21-familyDetail); `audits/screens/prayer/detail-family-typical-iphone-pwa-light.png`.
- **UX-PRAYER-7 — List category groups give no sign that they open** (low). The `<summary>` marker is hidden and there is no chevron (`apps/prayer.html:127-130`). Evidence: `audits/evidence/p3/prayer/leads.json` (L23-detailsChevron); `audits/screens/prayer/list-typical-iphone-pwa-light.png`.
- **UX-PRAYER-8 — No loading state; the kid page is blank while loading** (low).
  - No skeleton or spinner exists (NOT FOUND IN CODE). The adult loading page shows Pray now and More over nothing, then the content arrives; the kid page is empty. On a slow first open the empty state "Nothing on the list today." poses as real data (P3-PRAYER-02).
  - Evidence: `audits/screens/prayer/today-loading-iphone-pwa-light.png`; `audits/screens/prayer/kid-loading-ipad-portrait-light.png`; `audits/evidence/p3/prayer/slow-start-hold9s-first-paint.png`.
- **UX-PRAYER-9 — Pray now is not full-screen inside the hub, and its Close is a small text link** (low). The overlay fills the frame, but the shell's 48 px top bar stays above it; Close is 13.5 px text in a 49×33 box (`apps/prayer.html:324-331`). Evidence: `audits/evidence/p3/prayer/layout.json` (`pray.frameOffsetTop` 48); `audits/evidence/p3/prayer/layout-pray-iphone.png`; `audits/screens/prayer/pray-mode-typical-iphone-pwa-light.png`.
- **UX-PRAYER-10 — Rows are not sorted, so prayed rows sit mid-list** (low). Today is built daily, then weekly, then rotation (`apps/prayer.html:835`), each group in `hub.list` cache order (`apps/hub.js:225-229`): `p003, p004, p001✓, p002✓, p005✓, p006, …`. Order can differ by device. Evidence: `audits/evidence/p3/prayer/leads.json` (L15-rowOrder).
- **UX-PRAYER-11 — The paste parser keeps "Name - request" titles lower-case** (low). Titles come out as "recovery after surgery" and "settling in Kenya" (`apps/prayer.html:1466-1469`). Evidence: `audits/evidence/p3/prayer/leads.json` (L24-paste); `audits/screens/prayer/settings-paste-typical-iphone-pwa-light.png`.
- **UX-PRAYER-12 — Backup import needs the whole JSON file pasted into a textarea** (low). Export downloads `prayers-<date>.json` (26 KB in the rig; `apps/prayer.html:1500-1506`); import is paste-only with no file picker (`:1518-1522`), which is impractical on an iPad. Evidence: `audits/evidence/p3/prayer/import-family.json` (export via download event, 26361 bytes); `audits/screens/prayer/settings-import-typical-iphone-pwa-light.png`.
- **UX-PRAYER-13 — Every Prayed tap, including each Pray now step, posts its own feed line** (low; related P2-PWA-01, P2-PWA-13). `setPrayed` calls `hub.activity('Prayed for …')` on every mark (`apps/prayer.html:1606`), and each Pray now step goes through it (`:1706`), so one run of 6 posts 6 lines to "Around the house". For private requests those lines include the titles (P2-PWA-01 owns the leak).
- **UX-PRAYER-14 — A finished Today still leads with Pray now and shows the cheer twice** (low; from the visual check). With 9/9 done, the full-width "Pray now" remains the main action, and the streak cheer appears both as gold inline text and as a toast with the same words ("9 days in a row."). Evidence: `audits/screens/prayer/today-done-typical-iphone-safari-light.png`.

**Visual**

- **VIS-PRAYER-1 — Gold labels, the "shared" pill, done titles and dark nav labels fail contrast** (medium; amended from the visual check).
  - Rendered p10 contrast:
    - "Answered recently" (13 px gold on gold-soft): 2.78 Hearth, 3.11 Parchment, 3.30 Frost.
    - Record answered dates (12.5 px gold): 2.96, 3.24, 3.47.
    - "shared" pill (11 px teal on teal-soft): 3.64-4.29.
    - "not prayed in N days" (terra): 4.05.
    - Unpressed Mine/Family: 4.37-4.45.
    - Midnight, Forest and System-dark: done row titles (17.5 px muted) 3.24-3.27.
    - From the visual check: the unselected nav label "Record" (12 px) is 3.56 in Midnight and System-dark and 3.40 in Forest; provisional, because the rig paints the nav without blur.
  - Kid mode and Settings pass in every palette.
  - Evidence: `audits/evidence/p3/prayer/contrast.json`; `audits/tools/phase3/prayer/contrast.mjs`; `apps/prayer.html:107-108, 146, 153`; `audits/screens/prayer/today-typical-iphone-pwa-light.png`; `audits/screens/prayer/record-typical-ipad-portrait-dark.png`; `audits/screens/prayer/today-typical-iphone-pwa-dark.png`.
- **VIS-PRAYER-2 — The + button covers the last content on iPhone, on Today and List** (low; amended from the visual check).
  - The body's bottom padding (96 px) clears the nav but not the + (`apps/prayer.html:47, 264-266`).
  - On Today the + sits over the corner of the "Answered recently" card (not its text); in family mode it covers the "shared" pill.
  - From the visual check, the stronger case is List: scrolled to the end, the last category's count badge sits entirely under the + and its Copy button is half covered, on the iPhone PWA and Safari. Nothing is covered on iPad or desktop.
  - Evidence: `audits/evidence/p3/prayer/layout.json` (`fabOverLast`); `audits/evidence/p3/prayer/layout-today-bottom-iphone.png`; `audits/evidence/p3/prayer/vischeck-fab-list.json`; `audits/evidence/p3/prayer/vischeck-fab-list-iphone-pwa.png`; `audits/screens/prayer/today-lower-overflow-iphone-pwa-dark.png`.
- **VIS-PRAYER-3 — Category Rename/Remove and the Pray-mode Close are under 44 pt** (low). Rename 59×31, Remove 57×31 (padding 5px 3px, `apps/prayer.html:217-218`), Pray-mode Close 49×33 (`:330-331`); long names stack the two buttons into a column. Evidence: `audits/evidence/p3/prayer/layout.json` (`smallTargets`, `pray.close`); `audits/screens/prayer/settings-categories-typical-iphone-pwa-light.png`.
- **VIS-PRAYER-4 — Family mode only half re-themes** (low). `body.shared` rebinds `--accent` and `--accent-soft` to teal but not `--accent-deep` (`apps/prayer.html:39`), so the switch and nav turn teal while Pray now, the + and the chips keep the person's colour. Evidence: `audits/evidence/p3/prayer/contrast.json` (`accents.eliFamilyMode`); `audits/screens/prayer/today-family-typical-iphone-pwa-light.png`.
- **VIS-PRAYER-5 — The Record calendar has no month name, its weekday letters sit under the grid, and empty days vanish in dark mode** (low). The weekday row is emitted after the grid (`apps/prayer.html:762-763`); empty cells use `--sunk`. Evidence: `apps/prayer.html:752-764`; `audits/evidence/p3/prayer/leads.json` (L22-calendar); `audits/screens/prayer/record-typical-ipad-portrait-dark.png`; `audits/screens/prayer/record-empty-ipad-portrait-dark.png`.
- **VIS-PRAYER-6 — On desktop and iPad landscape the page is a 33rem column with the + pinned far right** (low). `.wrap{max-width:33rem}` (`apps/prayer.html:50`) centres the page at 528 px, while the + sits at x 1362 of 1440 (desktop) and 1102 of 1180 (iPad landscape). On iPad landscape with a long plan name (overflow seed), the header, the meter, the wrapped stats strip, the actions and the review nudge fill y 0-580 of 820, so one request shows above the nav (added after the critic). Evidence: `audits/evidence/p3/prayer/layout.json` (`targets.fab`); `audits/screens/prayer/today-typical-ipad-landscape-light.png`; `audits/screens/prayer/today-typical-desktop-light.png`; `audits/screens/prayer/today-overflow-ipad-landscape-light.png`.
- **VIS-PRAYER-7 — Offline, Prayer loses its typeface** (low). Manrope and Instrument Serif load from Google Fonts (`apps/prayer.html:12-14`), and the service worker skips cross-origin requests (`sw.js:36`). The visual checker saw the fallback face in the offline captures. Evidence: `audits/screens/prayer/kid-offline-ipad-portrait-light.png`; `audits/screens/prayer/today-offline-iphone-pwa-light.png`.
- **VIS-PRAYER-8 — The stats strip wraps on phones and shows a row of zeros when nothing is scheduled** (low). On the iPhone "5 answered" drops to y 279 while the others sit at y 229 (`apps/prayer.html:75-78, 904-908`); empty and unscheduled states show "0/0 today …". Evidence: `audits/evidence/p3/prayer/leads.json` (L25-stripWrap); `audits/screens/prayer/today-empty-iphone-pwa-light.png`.
- **VIS-PRAYER-9 — The detail sheet runs edge to edge across the iPad and over the app's own nav** (low; from the visual check). On iPad portrait (820 px) the sheet spans the full width with its content in a 33rem column; iPadOS would show a centred, inset sheet. In the dark iPhone capture the translucent sheet lets the rows behind compete with its text (the rig paints no blur, so judge legibility on a device). Evidence: `audits/screens/prayer/detail-typical-ipad-portrait-light.png`; `audits/screens/prayer/detail-typical-iphone-pwa-dark.png`.
- **VIS-PRAYER-10 — Delete in the detail sheet is not styled as destructive** (low; from the visual check). "Delete" is the same flat outlined button as "Edit"; terra appears only on the follow-up confirm. Evidence: `audits/screens/prayer/detail-typical-ipad-portrait-light.png`; `audits/screens/prayer/ask-delete-typical-iphone-pwa-light.png`.
- **VIS-PRAYER-11 — Pray mode on iPad landscape spreads its chrome to the corners** (low; from the visual check). The progress bar spans 26-1154 px over a centred column of about 500 px, and "6 of 6" and the text "Close" are pinned to the far corners, away from Back / Prayed / Skip. Evidence: `audits/screens/prayer/pray-mode-last-typical-ipad-landscape-dark.png`.

**Gap**

- **GAP-PRAYER-1 — No reminder to pray at a chosen time, and no word to the asker when someone prayed** (info). Push has only the "new family prayer" kind for Prayer (CLAUDE.md, Push; `worker/src/reminders.js:174`). Echo Prayer offers per-prayer and group reminders at chosen times, and Reminders alerts on add and complete (https://www.echoprayer.com/; https://support.apple.com/en-us/105124). Family rows record `prayedBy`, but the asker is never told.
- **GAP-PRAYER-2 — The answered record cannot be searched, filtered or grouped inside Record** (info). Record → Answered is one newest-first list with no year grouping (`apps/prayer.html:967-969`); search lives only in List, which shows answered prayers only while searching (`:946-952`); Print covers the last 90 days (`:1662`). Answered rows are kept forever. Evidence: `audits/screens/prayer/record-answered-typical-iphone-pwa-light.png`.

**What works**

- **OK-PRAYER-1 — Date maths is DST-safe** (info). The noon-pinned date object and rounded `daysSince` (`apps/prayer.html:713-715`) gave correct back-shifts, `daysSince`, streaks, month days and a 30-cell November calendar at 01:30 EDT, 01:30 EST, 23:59 on 2026-11-01 and 08:00 on 2026-11-02. Evidence: `audits/evidence/p3/prayer/dates.json`; run `node "audits/tools/phase3/prayer/dates.mjs"`.
- **OK-PRAYER-2 — Every confirm and prompt is an inline panel, not a native dialog** (info). `ask()` replaces alert, confirm and prompt (`apps/prayer.html:1079-1126`); the compliance tool counts 0 native dialogs; Mark answered offers an Undo toast (`:1331`), with the caveat of P3-PRAYER-09. Evidence: `audits/evidence/p3/_compliance/prayer.json`; `audits/screens/prayer/ask-answer-typical-iphone-pwa-light.png`.
- **OK-PRAYER-3 — Kid mode keeps kids on the family list: no inputs, one Prayed per card, faces** (info). All 49 logic checks pass, including "a kid always loads onto the family list", "a kid asking for Add lands on Today" and "each card carries one Prayed button". Kid text passes contrast in all five palettes, and the Prayed buttons are 64 px tall (the button states themselves are UX-PRAYER-2). Evidence: `handoff/prayer/check.js` (`node handoff/prayer/check.js apps/prayer.html` → 49 passed, 0 failed); `audits/evidence/p3/prayer/contrast.json`; `audits/evidence/p3/prayer/layout-kid-ipad.png`; `apps/prayer.html:393-430, 638`.
- **OK-PRAYER-4 — Glass stays on the navigation layer; content stays solid** (info; provisional, the rig paints no blur). The glass recipe is applied to the nav, sheet, + and Kitchen Close only, with a solid fallback (`apps/prayer.html:285-305`); rows, kid cards and the ledger stay solid. Evidence: `audits/screens/prayer/today-typical-iphone-pwa-light.png`; `audits/screens/prayer/detail-typical-iphone-pwa-dark.png`.

### Checked and not a bug

None. No bug, security or perf finding was refuted: all 26 sent to skeptics (16 from the investigator, 10 from the completeness critic) were confirmed 2/2. One investigator lead was narrowed and not filed: "Mark answered jumps to the top of the Record" (`audits/01-leads.md:195`). Record does open at scrollY 0, but the new answer lands at y 581 of 884, visible, on the iPhone with the typical seed (`audits/evidence/p3/prayer/leads.json` L20).

Sub-claims the skeptics refuted inside confirmed critic findings (each finding stands without them):
- **Kids see a shared copy's For** (P3-PRAYER-18). They do not: the kid card shows "<asker> asked" for every shared copy (`apps/prayer.html:1580-1582`; `audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-1.json`).
- **A category rename sets off the false "New on the family list" push** (P3-PRAYER-25). It cannot: a rename changes only `category`, not the fingerprinted title (`apps/prayer.html:1347`).
- **Adult taps merge a guest's and Dad's names under one day** (P3-PRAYER-24). The adult tap toggles the shared `lastPrayedAt` instead (`apps/prayer.html:1595`); names merge only through chat or the forced-on paths.
- **A fresh device's first open clears the plan-id payload** (P3-PRAYER-17). Only a first open that resets the family plan (a kid's) does; an adult's fresh device kept it (`audits/evidence/p3/prayer/verify-critic-plan-id-xss-1-2.json`).
- **The critic's check that the Add screen names a list** (`addScreenNamesList:true` in `audits/evidence/p3/prayer/critic-add-focus.json`) was a false positive that matched the category option "Family".

### Unresolved — needs a device or more evidence

No verified finding is unresolved. Items that depend on a device:
- **P3-PRAYER-17 on iPad and iPhone.** Confirmed in the rig's WebKit (Version/26.6) and desktop Chrome 154, which both keep an `<img>` inside `select.innerHTML`. Whether shipping iOS Safari does the same decides whether the sink runs script there: on the household iPad, set a `<select>`'s `innerHTML` to an `<option>` holding an `<img>` with an `onerror` and see whether it fires.
- **VIS-PRAYER-7 (offline typeface).** Open Prayer offline on an iPhone Home Screen app after the browser has evicted the Google Fonts, and compare with the online capture.
- **VIS-PRAYER-1 (dark nav labels) and VIS-PRAYER-9 (translucent sheet).** Both depend on real `backdrop-filter` blur; check on an iPad and iPhone in Midnight and Forest.
- **OK-PRAYER-4 (glass).** The blur itself needs a device.

## 5. Visual fidelity

### Rubric scores

| Dimension | Investigator | Checker | Final | Provisional? | Reason | Evidence |
|---|---|---|---|---|---|---|
| Typography | 5 | 5 | **5** | Yes (web fonts in the rig) | Manrope and Instrument Serif from Google Fonts, not system-ui, and they fall back offline. Numerals and kid mode are not ui-rounded. Sizes are fractional and off the Dynamic Type scale (h1 31, titles 17.5, meta 13.5, nav 12; 50 of 62 px sizes off-scale). Hierarchy by weight and size is clear, and the serif italic answer notes are handsome. | `audits/screens/prayer/today-typical-iphone-pwa-light.png`, `audits/screens/prayer/record-typical-ipad-portrait-dark.png`, `audits/screens/prayer/kid-offline-ipad-portrait-light.png` |
| Color & palette | 5 | 4 | **4** | No | A muted sand, mocha and olive palette, not vibrant pastel pairs. Gold labels fail at 2.78-3.47 and the "shared" pill at 3.64-4.29; gold and terra are each overloaded; in kid mode colour alone separates prayed from not prayed, 1.06-1.75:1 apart. The per-profile accent reaches the primary buttons (shown by Elizabeth's brown Pray now). | `audits/screens/prayer/today-family-typical-iphone-pwa-light.png`, `audits/evidence/p3/prayer/family-tick-3-elizabeth-phone.png`, `audits/screens/prayer/kid-typical-ipad-portrait-light.png` |
| Layout & spacing | 5 | 5 | **5** | No | Generous whitespace, but a 33rem column on iPad landscape and desktop with the + far away; the Add button starts under the nav; the + covers content on List (count badge, half the Copy button) and the corner of a card on Today; the detail sheet's buttons wrap ragged and the sheet runs edge to edge on iPad; 107 of 167 spacing values are off the 4-pt grid. | `audits/screens/prayer/today-typical-ipad-landscape-light.png`, `audits/evidence/p3/prayer/vischeck-fab-list-iphone-pwa.png`, `audits/screens/prayer/detail-typical-ipad-portrait-light.png` |
| Shape, depth & material | 6 | 5 | **5** | Yes (blur not rendered by the rig) | Glass only on the nav, sheet and +, over solid content; the pill switch, large kid-card radii and sheet grabber are right. But the detail sheet is a stack of flat outlined buttons not concentric with the sheet, Rename/Remove/Copy are bare text buttons, and the sheet is full-bleed on iPad. The calendar cells are rounded (about 7 px), not plain squares (checker's correction). | `audits/screens/prayer/detail-typical-iphone-pwa-dark.png`, `audits/screens/prayer/detail-typical-ipad-portrait-light.png`, `audits/screens/prayer/kid-typical-ipad-portrait-light.png` |
| Iconography | 5 | 5 | **5** | No | Five hand-drawn nav icons at a consistent 1.75 stroke, plus check and plus. Categories get only 6 px dots; Copy, Print and Kitchen have no icons; the kid fallback avatar is an emoji (🙏, `apps/prayer.html:1582`, not visible in any capture); not one named set. | `audits/screens/prayer/today-typical-iphone-pwa-light.png`, `audits/screens/prayer/list-typical-iphone-pwa-light.png`, `audits/screens/prayer/more-typical-iphone-pwa-light.png` |
| Motion & feedback | 6 | 5 | **5** | Partly (springs and durations are code claims; stills only) | An Undo toast after Mark answered, and code shows 220-320 ms rises, an overshoot check and press scales. But ticks on List fold every open group, Pray now and More paint before the list arrives (content jumps), the kid page is blank while loading, and nothing honours reduced transparency. | `audits/evidence/p3/prayer/list-collapse-2-after-tick.png`, `audits/screens/prayer/mark-answered-typical-iphone-pwa-light.png`, `audits/screens/prayer/today-loading-iphone-pwa-light.png` |
| Dark mode | 6 | 5 | **5** | No | Warm dark surfaces and a glowing gold answered rail through tokens. But done titles drop to 3.24-3.27, the dark nav labels to 3.40-3.56, the calendar's empty days vanish, and the kid prayed and unprayed fills are 1.06-1.16:1 apart. Only Midnight appears in the captures; the other palettes rest on `contrast.json`. | `audits/screens/prayer/record-typical-ipad-portrait-dark.png`, `audits/screens/prayer/record-empty-ipad-portrait-dark.png`, `audits/evidence/p3/prayer/vischeck-kid-states-kiara-dark.png` |
| Native feel | 5 | 5 | **5** | No | Web tells: a native multi-select for by-day plans, disclosure groups with no chevron, tiny text-link Rename/Remove, two controls named "More", no loading state, web fonts, and Pray now under the shell bar with a text Close. No native dialogs and no tap highlight. | `audits/screens/prayer/settings-byday-typical-iphone-pwa-light.png`, `audits/screens/prayer/settings-categories-typical-iphone-pwa-light.png`, `audits/screens/prayer/pray-mode-typical-iphone-pwa-light.png` |
| Glanceability | 3 | 3 | **3** | No | Measured readable distances: h1 0.88 m, row titles 0.5 m, Kitchen view items 0.69 m. Nothing on the 24/7 iPad reads at 2-3 m, although Kitchen view is labelled "Big type for the counter". | `audits/screens/prayer/kitchen-typical-ipad-landscape-light.png`, `audits/screens/prayer/today-typical-ipad-landscape-light.png`, `audits/screens/prayer/kid-typical-ipad-portrait-light.png` |
| Ease of use | 5 | 4 | **4** | No | The adult daily tick is 2 taps and Pray now is excellent. But the pre-reader's only control reads "✓ Prayed" before it is tapped and changes only to a similar colour; family ticks mean the wrong thing; Add is under the nav; Settings (and, per the critic, Add) silently use whichever list is active; the kid path is 3 taps. | `audits/screens/prayer/kid-typical-ipad-portrait-light.png`, `audits/evidence/p3/prayer/family-tick-3-elizabeth-phone.png`, `audits/evidence/p3/prayer/layout-add-iphone.png` |
| Delight | 6 | 6 | **6** | No | Answered notes in serif, anniversaries and milestones, faces of who prayed and who asked, the candle empty state, "Tell them you prayed", and a calm Pray now card. | `audits/screens/prayer/record-typical-ipad-portrait-dark.png`, `audits/screens/prayer/pray-mode-typical-iphone-pwa-light.png`, `audits/screens/prayer/today-empty-iphone-pwa-light.png` |

Average: (5 + 4 + 5 + 5 + 5 + 5 + 5 + 5 + 3 + 4 + 6) / 11 = 52 / 11 = **4.7**. The investigator's average was 5.2 (57 / 11); the shell's in Phase 2 was 4.9.

**How the scores were checked.**
- **What the checker opened:** 49 screenshots: the investigator's cited captures and evidence PNGs, more captures from `audits/screens/prayer/` (offline, loading, done, dark kid, iPad detail, iPad landscape Pray mode), and two new PNGs from its own script `audits/tools/phase3/prayer/vischeck-fab-list.mjs`.
- **Agreed:** 6 of 11 dimensions (Typography, Layout, Iconography, Native feel, Glanceability, Delight).
- **Adjusted by one point:** 5 dimensions, all down.
  - **Color & palette, 5 → 4:** the shell scored 4 for the same muted palette with passing light pairs; Prayer adds more failures (gold, pill, terra), overloads gold and terra, and separates kid states by colour only.
  - **Shape, depth & material, 6 → 5:** flat outlined sheet buttons not concentric with the sheet, bare text buttons, and a full-bleed sheet on iPad, level with the shell's 5.
  - **Motion & feedback, 6 → 5:** the captures prove only the Undo toast and the fold; content jumps on load and the kid page is blank, which the shell was also marked down for.
  - **Dark mode, 6 → 5:** the dark nav labels also fail (3.40-3.56), which the deviations list had omitted, and kid fills are nearly identical in dark.
  - **Ease of use, 5 → 4:** the pre-reader flow's only control reads "Prayed" before it is tapped and barely changes after.
- **Judge:** ruled on 0 dimensions; no gap reached 2 points.
- **Claim refuted by the checker:** the calendar cells are rounded rectangles (about 7 px), not "plain square" cells.
- **Evidence caveat from the checker.** The investigator's harness PNGs (`layout-*`, `list-collapse-*`, `family-tick-*`, the checker's own `vischeck-*`) render Manrope in a thin weight with dropped "l" glyphs ("Hea th Needs"), because the harness lacks the per-weight font files the Phase 1 rig requests (`audits/01-capture.md:119`, §3 item 9). They are valid for layout and state, not for typography or glanceability; this report cites `audits/screens/prayer/` captures for those.
- **After the completeness critic:** no score changed. The ten added defects (P3-PRAYER-17 to -26) are behaviour, copy and keyboard defects. The one closest to a scored dimension, the unnamed target list on Add (P3-PRAYER-20), is the same problem Ease of use already counts for Settings (UX-PRAYER-4), so the average stays 4.7.

### Deviations from the house style

Each is marked with the visual checker's verdict.

| Area | Deviation | Checker | Evidence |
|---|---|---|---|
| Type scale | Title 31 px (not 28 or 34); row titles 17.5, meta and strip 13.5, category summaries 14.5, gold captions 12.5, nav labels 12. 50 of 62 px sizes are off the Dynamic Type scale; 34 are fractional. | Supported (from `layout.json`; not measurable in PNGs) | `apps/prayer.html:53, 102, 104, 276`; `audits/evidence/p3/prayer/layout.json` |
| Font stack | Manrope with Instrument Serif from Google Fonts instead of system-ui; the grandfathered exception breaks offline. Numerals (strip counts, Pray-now counter) and kid mode are not ui-rounded. | Supported (offline captures show the fallback face) | `apps/prayer.html:12-14, 45, 148, 338`; `audits/screens/prayer/kid-offline-ipad-portrait-light.png` |
| Palette | Muted sand, mocha, olive, gold, teal and terracotta, not vibrant pastel fill/ink pairs; no pastel gradients on the chrome | Supported | `apps/prayer.html:16-36`; `audits/screens/prayer/today-typical-iphone-pwa-light.png` |
| Contrast | Failing pairs: gold labels 2.78 / 3.11 / 3.30; gold answered dates 2.96 / 3.24 / 3.47; "shared" pill 3.64-4.29; terra "not prayed" 4.05; unpressed switch 4.37-4.45; dark done titles 3.24-3.27; **dark nav labels 3.40-3.56** (checker's addition) | Supported, list completed by the checker | `audits/evidence/p3/prayer/contrast.json` |
| Semantic colours | Gold means both "answered" and the streak cheer; terracotta means both "attention" and "danger"; the done state is olive only, and in kid mode colour only | Supported | `apps/prayer.html:79, 106, 200, 427`; `audits/screens/prayer/today-done-typical-iphone-safari-light.png` |
| Per-profile accent | `--accent-deep` reaches Pray now, chips, the nav and the + for each person. Family mode swaps only `--accent` and `--accent-soft` to teal. (A sentence here on `prayedBy` being matched by name was a functional defect, not a style deviation; after the critic it is filed as P3-PRAYER-24.) | Supported (the checker's "Partly" was for the name matching, now moved) | `apps/prayer.html:39`; `audits/evidence/p3/prayer/family-tick-3-elizabeth-phone.png` |
| Radii | 14× `999px` instead of `var(--r-full)`, plus 26px (sheet), 18px (nav buttons) and 7px (calendar). The detail sheet's button rows are not concentric with the sheet radius. | Partly (the literals are code; the non-concentric buttons are visible) | `apps/prayer.html:65, 163, 239, 277`; `audits/screens/prayer/detail-typical-iphone-pwa-dark.png` |
| Glass | Correctly limited to the nav, sheet, + and Kitchen Close; no `prefers-reduced-transparency` or `prefers-contrast` handling | Supported (the second half is code only) | `apps/prayer.html:285-305`; `audits/evidence/p3/_compliance/prayer.json` |
| Sheet on iPad (checker's addition) | The detail sheet is full-bleed across the iPad and over the nav instead of a centred, inset sheet | Checker's addition | `audits/screens/prayer/detail-typical-ipad-portrait-light.png` |
| Destructive action (checker's addition) | Delete looks the same as Edit in the sheet | Checker's addition | `audits/screens/prayer/detail-typical-ipad-portrait-light.png` |
| Icon set | Ad-hoc inline SVGs (5 nav icons, check, plus, mic, dots) rather than one set; categories have dots, no icons | Supported | `apps/prayer.html:131-134, 566-570` |
| Spacing rhythm and margins | 107 of 167 px spacing values off the 4-pt grid (3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 18, 22, 26, 30, 38, 46), no `--sp` tokens; 22 px side margins; a 33rem column on wide screens | Supported (the grid count is from compliance; margins and column visible) | `apps/prayer.html:50`; `audits/evidence/p3/_compliance/prayer.json` |
| Tap targets | Category Rename 59×31 and Remove 57×31, Pray-mode Close 49×33, all under 44; kid buttons are 64 px tall | Supported | `audits/evidence/p3/prayer/layout.json`; `audits/screens/prayer/settings-categories-typical-iphone-pwa-light.png` |
| Motion | 21 literal durations and easings (no `--dur` / `--ease`); full re-renders fold groups and jump the scroll; the sheet slides 28 px with a fade rather than a full slide-up | Partly (the fold is shown; the rest is code only) | `apps/prayer.html:241-242, 1162`; `audits/evidence/p3/prayer/list-collapse.json` |
| Pray mode on iPad landscape (checker's addition) | A full-width progress bar over a 500 px column, with the counter and Close pinned to the corners | Checker's addition | `audits/screens/prayer/pray-mode-last-typical-ipad-landscape-dark.png` |
| Dark surfaces | Calendar empty cells use `--sunk` and nearly vanish; done titles are too faint | Supported | `audits/screens/prayer/record-empty-ipad-portrait-dark.png`; `audits/evidence/p3/prayer/contrast.json` |
| Layout shift and loading | No skeleton: Pray now and More paint over an empty page, then the content arrives. The web-font swap (`display=swap`) shifts the text. | Supported (the font-swap shift is not visible in stills) | `audits/screens/prayer/today-loading-iphone-pwa-light.png`; `apps/prayer.html:14` |

### Web tells

| Tell | Status | Evidence |
|---|---|---|
| Grey tap highlight | Absent | `-webkit-tap-highlight-color:transparent` on `*` (`apps/prayer.html:41`) |
| Long-press callout or text selection on chrome | Present | No `user-select` or `-webkit-touch-callout` rule in the file (compliance `userSelect` 0); design.css's `user-select:none` applies only to `.ds .btn` (`apps/design.css:355`) and Prayer has no `.ds`. The callout itself needs a device. |
| Default form controls | Partly | The single `<select>` is restyled (`apps/prayer.html:173-182`), but the by-day plan uses a native `<select multiple size=9>` ("tap to toggle", `:1207`); `audits/screens/prayer/settings-byday-typical-iphone-pwa-light.png` |
| Focus rings on touch | Absent | `:focus-visible` on buttons (`apps/prayer.html:95-96, 141, 201, 426`); inputs use an intended accent ring on `:focus` (`:184`) |
| Blue underlined links | Absent | No `<a>` elements in the markup |
| White flash on load or navigation | Needs a device | Body background `var(--paper)` (`apps/prayer.html:44`); the iframe load belongs to the shell (Phase 2) |
| Rubber-band overscroll mismatch | Needs a device | Inherits `overscroll-behavior:none` (`apps/design.css:304`); behaviour inside the iframe needs iOS |
| Tap delays | Absent | `width=device-width` viewport (`apps/prayer.html:5`) and `touch-action:manipulation` (`apps/design.css:303`) |
| Visible scrollbars on chrome | Partly | The sheet has `overflow:auto` (`apps/prayer.html:239`) with no scrollbar styling, so desktop shows a bar; hidden on iOS |
| Layout shift as data loads | Present | `audits/screens/prayer/today-loading-iphone-pwa-light.png` against the typical capture; `audits/evidence/p3/prayer/slow-start-hold9s-first-paint.png` shows the empty list first |
| Spinners where skeletons belong | Partly | Neither: a blank kid page and a bare adult page while loading (`audits/screens/prayer/kid-loading-ipad-portrait-light.png`) |
| `alert()` / `confirm()` / `prompt()` | Absent | The inline `ask()` panel (`apps/prayer.html:1079-1126`); compliance bypass counts 0 |

## 6. Platform compliance

**Data through hub.js.**
- **Calls used:** `hub.ready` (`apps/prayer.html:1753`), `hub.get`, `hub.list`, `hub.set` (only through `put()`, `:652-656`), `hub.remove` (`:692`), `hub.migrate` (`:649-650`), `hub.onChange` (`:1760`), `hub.activity`, `hub.canWrite`, `hub.profile`, `hub.people`, `hub.avatarHtml`, `hub.voiceInput` and the theme.
- **Bypasses: 0** localStorage, sessionStorage, IndexedDB, fetch, XHR or native dialogs (`audits/evidence/p3/_compliance/prayer.json`).
- **External requests:** Google Fonts only, the grandfathered exception (`apps/prayer.html:12-14`; compliance `externalUrl` 3).
- **`prefers-color-scheme`:** used in JS only, for the theme-color meta (`apps/prayer.html:1533, 1539`); `hub.theme()` never returns `'dark'`, so that branch is dead.
- **Own sync logic:** SNAP diffing in `put()` (`apps/prayer.html:622-656`) and the `absorbRemote` deferral (`:699-705`). `mergePrayer` and `mergeShared` (`:1677-1701`) are dead code.
- **Where it goes wrong:** ids are counted per device instead of using `hub.uid` (P3-PRAYER-01); list keys are written before the first pull (P3-PRAYER-02); row ids and plan ids reach HTML unescaped (P3-PRAYER-06, P3-PRAYER-17); `prayedBy` records display names, not profile ids (P3-PRAYER-24).
- **Keyboard (CLAUDE.md "Adding an app" item 6, "Enter/Escape on inputs and dialogs"; added after the critic).** Escape closes only Pray mode; the detail sheet, More, Kitchen view and `ask()` panels ignore it, and Enter submits neither Add nor a single-line `ask()` field (`apps/prayer.html:1709-1714`; `audits/evidence/p3/prayer/critic-keys.json`). Filed as P3-PRAYER-26.

**design.css tokens.** The `compliance.mjs` hits were reviewed by hand; the corrected counts:

| Category | Raw hits | Corrected | Notes |
|---|---|---|---|
| Hardcoded colours | 0 hex in CSS; 2 hex in JS; 4 named; 5 `colorDerived` | **0 on screen in CSS; 3 hex in total; 6 named, all print** | The 3 hex are the theme-color meta (`apps/prayer.html:9`, missed by the tool) and the JS fallback (`:1537` ×2). The 6 named colours are all inside `@media print` (`:370` ×2, `:375`, `:377`, `:379`, `:381`); the tool missed `dimgray` at 375 and 381. The 5 derived hits are `color-mix()` of tokens. |
| Font sizes | 68 | **65 on screen** | 63 px literals in CSS (68 minus 5 print pt) plus 2 inline in JS (`apps/prayer.html:1002` 14px, `:1174` 15px). 5 token uses, all in kid mode (`:402, 406, 408, 422, 428`). |
| Radii | 24 | **17 hard-coded on screen** | 14× `999px` that should be `var(--r-full)`, plus 7px, `26px 26px 0 0` and 18px. 6× `50%` circles are acceptable; 1 print `2pt`; 8 token uses. |
| Spacing | 135 declarations | **167 px values, 107 off the 4-pt grid; 0 `--sp-*` uses** | Plus 18 inline style declarations |
| Shadows | 9 | **9 with literal geometry** | Token colours |
| Durations and easings | 21 | **21** | None use `--dur` / `--ease` |
| z-index | 8 | **8 raw values** | |
| Undefined tokens | 0 | **0** | 21 local custom properties are defined in the file |
| Unguarded `:hover` | 5 | **5** | `apps/prayer.html:93, 140, 190, 198, 219`; the tool's line numbers are one early (92 for `.mark:hover` at 93) |

**Per-profile accent.** hub.js sets `--accent` on `<html>` (`apps/hub.js:80`). Prayer's `--accent-deep` (the person colour mixed 72% with black) reaches Pray now, chips, the nav current state and the +: Eli navy, Mae terracotta, Mom brown, Dad green, Mea green, Kiara gold, Ezra teal (`audits/evidence/p3/prayer/contrast.json` accents). On Family, `body.shared` rebinds only `--accent` and `--accent-soft` to teal (`apps/prayer.html:39`; VIS-PRAYER-4). Faces carry identity on family rows.

**Dark mode.**
- No `prefers-color-scheme` in CSS and no `data-scheme` use; the page relies on design.css's token blocks under `data-theme`, and follows all five palettes and System-dark (`contrast.json`).
- Remaining failures: done titles at 3.24-3.27, nav labels at 3.40-3.56 (provisional), calendar empty cells, and nearly identical kid state fills (VIS-PRAYER-1, VIS-PRAYER-5, UX-PRAYER-2).
- `prefers-reduced-motion` is honoured (`apps/prayer.html:384`); `prefers-reduced-transparency` and `prefers-contrast`: NOT FOUND IN CODE.

## 7. Improvements

Ratio = delight ÷ effort, with S = 1, M = 2, L = 3. None adds a routine or reward system or a shopping list. Prayer is on the CLAUDE.md "Do not touch" list: its layout and element ids stay, and restyling goes through design.css tokens, so every item below is logic, copy, tokens or an addition that leaves existing layout and ids in place. The one place a layout change would help (clearing the + at the bottom of the page, VIS-PRAYER-2) is flagged for the owner in Polish 5, not proposed.

**Polish**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Per-person done on the family list: an adult's tick reads and writes `prayedBy[TODAY]` for "me", as kid mode does, instead of the shared `lastPrayedAt`; others' ticks show as faces only | 5 | S | 5.0 | P3-PRAYER-05; `audits/evidence/p3/prayer/family-tick.json` |
| 2 | Collision-free ids: `hub.uid()` or `crypto.randomUUID()` in `nextId()` and in Send to family list | 4 | S | 4.0 | P3-PRAYER-01; `audits/evidence/p3/prayer/id-collision.json` |
| 3 | Keep the answer when un-answering: "Put back on the list" keeps the note (or moves it into `updates[]`) and shows an Undo toast | 3 | S | 3.0 | P3-PRAYER-04; `audits/evidence/p3/prayer/unanswer.json` |
| 4 | Keep open groups open: remember which `<details>` are open across `renderAll` and `absorbRemote` | 3 | S | 3.0 | P3-PRAYER-07; `audits/evidence/p3/prayer/list-collapse.json` |
| 5 | Scroll "Add to the list" into view when the form opens (logic only). Clearing the + needs a layout change in a Do-not-touch file, so it is flagged for the owner rather than proposed | 3 | S | 3.0 | UX-PRAYER-1, VIS-PRAYER-2; `audits/evidence/p3/prayer/layout.json` |
| 6 | Name the two Mores ("Share" on Today, "Settings" in the tab bar) and put "My list" or "Family list" in the Settings title and in the Add heading and button ("Add to the Family list") | 3 | S | 3.0 | UX-PRAYER-4, UX-PRAYER-5, P3-PRAYER-20; `audits/evidence/p3/prayer/leads.json`; `audits/evidence/p3/prayer/critic-add-focus.json` |
| 7 | Kid cards a pre-reader can read: a different done label and icon ("Prayed!" filled, "I prayed" before), the asker's face larger, and tap-to-hear the request with `speechSynthesis`, within the existing card and ids; not a reward system | 5 | M | 2.5 | UX-PRAYER-2; `audits/screens/prayer/kid-typical-ipad-portrait-light.png` |
| 8 | Escape and validate ids: `esc()` every id (row ids and plan ids) placed in markup, skip rows whose id is not the key suffix, and drop plans whose id fails `/^[A-Za-z0-9_-]+$/` on load | 2 | S | 2.0 | P3-PRAYER-06, P3-PRAYER-17; `audits/evidence/p3/prayer/xss-id.json`; `audits/evidence/p3/prayer/critic-sweep-planxss.json` |
| 9 | Copy fixes: a time-neutral headline, no cheer at 0/0, a distinct Needs-attention count, correct delete copy, category counts that agree, and a Sunday-neutral review line when nothing has gone cold ("Sunday: a good day to look over the list.") | 2 | S | 2.0 | P3-PRAYER-12, -13, -14, -15, -16, -22; `audits/evidence/p3/prayer/leads.json`; `audits/evidence/p3/prayer/critic-sweep-sunday.json` |
| 10 | Family teal all the way: also rebind `--accent-deep` under `body.shared` | 2 | S | 2.0 | VIS-PRAYER-4; `audits/evidence/p3/prayer/contrast.json` |
| 11 | Contrast and tokens pass: darker gold and teal inks for labels, dates and the pill; done titles at 4.5:1 in dark; px swapped for `--fs`, `--sp`, `--r-full` and `--dur` tokens | 2 | M | 1.0 | VIS-PRAYER-1; `audits/evidence/p3/_compliance/prayer.json` |

Added after the completeness critic. They are listed here, in their own ratio order, so the ranks above stay stable; by ratio they sit among ranks 8-11.

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 12 | An honest share panel: show the For and category that will be copied, each editable or removable, next to the title | 2 | S | 2.0 | P3-PRAYER-18; `audits/evidence/p3/prayer/critic-push-share.json` |
| 13 | Kitchen view keeps up: rebuild it from `absorbRemote` while it is open, and at the day rollover | 2 | S | 2.0 | P3-PRAYER-19; `audits/evidence/p3/prayer/critic-sweep-kitchen.json` |
| 14 | Plan and streak bookkeeping: an un-tick that leaves nothing marked today takes the day back out of `prayerDays`; Remove re-points a focus plan's category as Rename does | 2 | S | 2.0 | P3-PRAYER-21, P3-PRAYER-23; `audits/evidence/p3/prayer/critic-sweep-untick.json`; `audits/evidence/p3/prayer/critic-add-focus.json` |
| 15 | Prayed marks by profile id: store ids in `prayedBy` (names or faces drawn at render) in Prayer, chat's `mark_prayed`, the TV and Kid Verse together | 2 | M | 1.0 | P3-PRAYER-24, P3-KIDVERSE-07; `audits/evidence/p3/prayer/critic-sweep-guest.json` |
| 16 | The prayer push announces only rows it has never seen (compare keys or `createdAt`, not titles) | 1 | S | 1.0 | P3-PRAYER-25; `audits/evidence/p3/prayer/critic-push-share.json` |
| 17 | Keyboard: Escape closes the sheet, Kitchen view and `ask()` panels; Enter submits Add and single-line `ask()` fields | 1 | S | 1.0 | P3-PRAYER-26; `audits/evidence/p3/prayer/critic-keys.json` |

**Missing features**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | A room-scale family prayer board: family list only, titles at about 90 px cap height, the asker's face and who prayed today, on the TV board (`index.html`) and as larger Kitchen-view type through tokens | 4 | M | 2.0 | UX-PRAYER-3; `audits/evidence/p3/prayer/layout.json` |
| 2 | Show who asked and who prayed in the family detail sheet (reuse the row's asker and faces markup) | 2 | S | 2.0 | UX-PRAYER-6 |
| 3 | Safe restore: Import restores the personal list only, or merges family rows without deleting or overwriting newer ones; a file picker beside paste | 3 | M | 1.5 | P3-PRAYER-03, UX-PRAYER-12; `audits/evidence/p3/prayer/import-family.json` |
| 4 | Answered-journal browsing: group Record → Answered by year and month, with search inside Record, added below the existing list | 3 | M | 1.5 | GAP-PRAYER-2; `apps/prayer.html:967-969` |
| 5 | A reminder to pray at a chosen time: a per-person push time in Me → Notifications, reusing the push kinds | 3 | M | 1.5 | GAP-PRAYER-1; https://www.echoprayer.com/ |

**New ideas**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | "Around the table" pass-the-iPad Pray now: a family Pray now that shows each asker's face large and records everyone at the table with one tap each | 4 | M | 2.0 | `audits/screens/prayer/pray-mode-typical-iphone-pwa-light.png` |
| 2 | Answered-prayer anniversaries on the TV: "A year ago today: <family answered prayer>", family list only, never private titles | 4 | M | 2.0 | `apps/prayer.html:778-791` |
| 3 | Tell the asker, gently: a quiet line on the asker's Home ("Ezra and Mom prayed for Grandma Jo's visit"); not a push and not a reward | 3 | M | 1.5 | `apps/prayer.html:1597-1603` |

The most urgent work is not in the ratio order: the four data-loss criticals. Items 2 and 3 of Polish fix P3-PRAYER-01 and -04; P3-PRAYER-02 needs the shared hub.js fix for P2-SYNC-02/-17 (no writes before the first pull); P3-PRAYER-03 needs the safe restore (which must also cover v2 single-list backups). Next come the two stored-XSS sinks, P3-PRAYER-06 and -17, which Polish item 8 closes together.

## App-specific checks

| Check | Result | Evidence |
|---|---|---|
| Two-list model: who sees what | **PARTLY.** The personal list is person scope, seen only by its owner, but it leaks through feed titles (P2-PWA-01), cached rows after Switch (P2-PROF-15) and the Switch race (P2-SYNC-09). The family list is family scope, seen by every household profile and guests; kids see only it (`apps/prayer.html:638`). The TV never opens Prayer and reads only the family `prayedBy` names (`index.html:1058-1059`). "Send to family list" copies the request as a new `s` row with `sharedFrom`, dropping detail, phone and days (P3-PRAYER-08); the private row stays and nothing links the two. Family done state is wrong (P3-PRAYER-05). Home's Prayer card reads the personal list only (`index.html:848-869`). Added after the critic: the Add form never says which list it adds to, so an adult whose last list was Family can put a private request where kids see it (P3-PRAYER-20); and Send to family list silently carries the private request's For and category even when the title is rewritten, and the family push then shows "(for …)" (P3-PRAYER-18). | `apps/prayer.html:585-586, 1306-1323, 1436`; `audits/evidence/p3/prayer/family-tick.json`; `audits/evidence/p3/prayer/leads.json`; `audits/evidence/p3/prayer/critic-add-focus.json`; `audits/evidence/p3/prayer/critic-push-share.json` |
| Answered-prayer history | **PARTLY.** Stored on the row as `status 'answered'`, `answeredAt` and a required `answerNote` (`apps/prayer.html:1323-1331`). Shown in Record → Answered (newest first), Today's "Answered recently" (30 days), anniversaries and milestones, print (90 days), the detail sheet, and List search. Kept indefinitely. "Put back on the list" erases the note (P3-PRAYER-04, critical); Mark answered's Undo can fail (P3-PRAYER-09); no search or grouping inside Record (GAP-PRAYER-2). | `audits/evidence/p3/prayer/unanswer.json`; `audits/evidence/p3/prayer/undo-stale.json` |
| Prayed-today tracking, midnight, DST, time zone | **PARTLY.** DST is correct (OK-PRAYER-1). `TODAY` is fixed at load (`apps/prayer.html:712`; P2-STAB-03, not re-run). Another time zone files marks under the local date (P3-PRAYER-11). Family done uses the shared `lastPrayedAt` (P3-PRAYER-05). Added after the critic: an undone tick still counts the day in the streak, month count and calendar (P3-PRAYER-21), and family marks are kept by display name, so a same-named guest is shown as that person (P3-PRAYER-24). | `audits/evidence/p3/prayer/dates.json`; `audits/evidence/p3/prayer/family-tick.json`; `audits/evidence/p3/prayer/critic-sweep-untick.json`; `audits/evidence/p3/prayer/critic-sweep-guest.json` |
| Kid mode (Kiara prays on the family list only) | **PASS for scope, FAIL for pre-readers.** Big cards with the asker's face, one 64 px Prayed button, no nav, inputs or private list, every route lands on Today (49/49). But done and not done differ by colour only and the untapped button says "Prayed", there is no read-aloud or undo, the header shows the plan name, and kid Home has no Prayer entry (3 taps). A kid device's first open can reset the family plan (P2-SYNC-02). A guest who shares a kid's name makes that kid's card read Prayed (P3-PRAYER-24), and a crafted family plan id runs script on every kid device (P3-PRAYER-17). | `handoff/prayer/check.js`; `audits/evidence/p3/prayer/leads.json`; `audits/evidence/p3/prayer/taps.json`; `audits/evidence/p3/prayer/layout-kid-ipad.png` |
| Print, Copy, Kitchen | **PARTLY.** All three sit behind Today's "··· More". Kitchen view shows the active list by category at 24 px, legible to 0.69 m, and may show the private list on the shared iPad. Print is a tick list plus answered prayers from the last 90 days (Phase 1 captures only; `window.print` not run). Copy puts today's set as bullet text, with a "copy this yourself" fallback. Added after the critic: Kitchen view is a snapshot and never picks up other people's changes while open (P3-PRAYER-19). | `apps/prayer.html:1645-1674, 1725-1747`; `audits/evidence/p3/prayer/critic-sweep-kitchen.json`; `audits/screens/prayer/kitchen-typical-ipad-landscape-light.png`; `audits/screens/prayer/print-typical-ipad-portrait-light.png`; `audits/screens/prayer/more-copy-typical-iphone-pwa-light.png` |
| Backup import and export | **FAIL (critical, P3-PRAYER-03).** Export works through a real download (`prayers-2026-09-24.json`, 26,361 bytes, both lists). Import is paste-only; under 200 rows it tombstones newer family rows and prayed marks while saying "on this device"; over 200 rows it is P2-SYNC-06. A v2 single-list backup would tombstone the whole loaded family list (code only; P3-PRAYER-03). | `audits/evidence/p3/prayer/import-family.json`; `apps/prayer.html:1500-1527` |
| Plan settings | **PARTLY.** Plans, rotation size, by-day categories, focus category and show/hide chips are whole-array rows per list (`LIST_KEYS`, `apps/prayer.html:585`) under last-write-wins (P2-SYNC-01 class). They are reset by a first open (P2-SYNC-02) and by a slow or failed start (P3-PRAYER-02). Settings does not say which list it edits (UX-PRAYER-4). By-day uses a native multi-select. Added after the critic: removing a focus plan's category leaves the plan pointing at a deleted category, so Today empties (P3-PRAYER-23), and a crafted plan id is a stored-XSS sink (P3-PRAYER-17). | `apps/prayer.html:1181-1227`; `audits/evidence/p3/prayer/slow-start.json`; `audits/evidence/p3/prayer/leads.json` |
| `node handoff/prayer/check.js apps/prayer.html` | **PASS.** 49 passed, 0 failed. | `handoff/prayer/check.js` |

## Leads from 01-leads.md

| Lead | Outcome | Where it went |
|---|---|---|
| Opening Prayer on a new device resets the family list's settings (`audits/01-leads.md:157`) | Confirmed; seen again as "· Everything" on Kiara's fresh page | P2-SYNC-02 (pointer) |
| A slow start shows a false empty list and queues defaults over Eli's list (`:159`) | Widened: `prayerDays` 41 → 0 and plans replaced on the server; a failed pull triggers it at once; the family list is wiped too | P3-PRAYER-02 |
| On the family list one person's tick counts for everyone (`:161`) | Confirmed | P3-PRAYER-05 |
| Private requests show up in the family feed (`:163`) | Confirmed (`apps/prayer.html:1329, 1606`) | P2-PWA-01 (pointer); UX-PRAYER-13 |
| "Send to family list" drops a weekly request's days (`:165`) | Confirmed; narrowed to weekly requests under non-category plans | P3-PRAYER-08 |
| Any tap before `hub.ready` throws (`:167`) | Confirmed; the Record tap is lost too | P3-PRAYER-10 |
| The floating + covers the last content on iPhone (`:169`) | Confirmed on iPhone only; on Today it covers a card corner, on List the count badge and half a button | VIS-PRAYER-2 |
| The Add form's main button starts under the nav (`:171`) | Widened: also iPad landscape and desktop | UX-PRAYER-1 |
| Kid cards differ only by colour (`:173`) | Confirmed; the checker measured fills 1.06-1.75:1 apart | UX-PRAYER-2 |
| No loading indicator; kid mode blank while loading (`:175`) | Confirmed | UX-PRAYER-8 |
| The cheer shows when nothing was scheduled (`:177`) | Confirmed | P3-PRAYER-13 |
| Needs attention lists requests twice (`:179`) | Confirmed; the badge is the defect, the double listing follows the spec | P3-PRAYER-12 |
| The family delete confirm says deletions do not sync (`:181`) | Confirmed | P3-PRAYER-15 |
| Family mode only half re-themes (`:183`) | Confirmed | VIS-PRAYER-4 |
| Rows are in cache order (`:185`) | Narrowed: grouped daily → weekly → rotation, cache order inside each group | UX-PRAYER-10 |
| Settings never says which list it edits (`:187`) | Confirmed | UX-PRAYER-4 |
| A category's count disagrees with its Remove confirm (`:189`) | Confirmed; 5 of 28 categories | P3-PRAYER-14 |
| Category Rename and Remove are tiny (`:191`) | Confirmed: 59×31 and 57×31 | VIS-PRAYER-3 |
| Offline, Prayer loses its typeface (`:193`) | Confirmed from code and captures; runtime loss needs a device | VIS-PRAYER-7 |
| "Mark answered" jumps to the top of the Record (`:195`) | Narrowed: scrollY 0 confirmed, but the new answer is visible at y 581 of 884 in the typical seed | Not filed |
| A family request's detail sheet hides who asked and who prayed (`:197`) | Confirmed | UX-PRAYER-6 |
| The Record calendar has no month name and loses shape in dark (`:199`) | Confirmed | VIS-PRAYER-5 |
| List category groups give no hint that they open (`:201`) | Confirmed | UX-PRAYER-7 |
| The paste parser keeps text as typed; the paste box does not grow (`:203`) | Confirmed for the case; the box half is code only (`min-height` 120, `resize: vertical`, `apps/prayer.html:183`) | UX-PRAYER-11 |
| The stats strip wraps on phones and shows zeros (`:205`) | Confirmed | VIS-PRAYER-8 |
| Pray now is not full-screen inside the hub (`:207`) | Confirmed | UX-PRAYER-9 |
| On desktop and iPad landscape the page is a narrow column (`:209`) | Confirmed (the column, the far +, and the header filling the first screen on iPad landscape; the header half was added after the critic) | VIS-PRAYER-6 |

## Not verified

- **Priority follow-up: P3-TALLY-06 in Prayer** (from the Tally report). Could a guest who is first to open Prayer on a device holding `prayer-data-v3` (`apps/prayer.html:584`), with no `hub.migrated` mark for `prayer.person`, take the blob's personal list, the previous adult's private requests, into the guest's own person scope (`apps/prayer.html:649-650`; `apps/hub.js:400`)? If it reproduces, it is critical under rule (b). This is by code only. Run it as a guest with a planted legacy blob and a fresh `hub.migrated`.
- P2-SYNC-03 (legacy blob over a slow first pull, both scopes) and P3-TALLY-05 (family writes queued when Prayer closes): by code only in this report.
- Real iOS rendering: whether Manrope and Instrument Serif load, Liquid Glass blur (the rig paints none), and the long-press callout on chrome. The Typography and Shape scores are provisional.
- The offline typeface loss at runtime (VIS-PRAYER-7); code and Phase 1 captures only.
- Contrast of the nav labels in dark mode: the rig samples content through an unblurred nav, so 3.40-3.56 is provisional.
- `sms:` navigation from inside the hub iframe ("Tell them you prayed"), and the Blob download of Export in the standalone iPad and iPhone PWA.
- `window.print()` from inside the iframe; only the Phase 1 print captures were used.
- Pray-mode swipe gestures with real touch.
- How often a first `prayer/person` pull takes more than 6 s or fails on cellular or a cold Worker; this sets the likelihood of P3-PRAYER-02. Also untested: a first sign-in on a device whose Prayer cache is filled for another profile.
- P3-PRAYER-01 variants B (family list, iPad offline) and D (two shares) were run by the investigator only; the skeptics re-ran A and C with new scripts.
- Whether Kiara's Kid Verse star survives P3-PRAYER-03.
- P3-PRAYER-06 on the kiosk; and whether the stale-closure pattern of P3-PRAYER-09 affects other toast actions.
- The midnight rollover itself (P2-STAB-03), not re-run.
- The guest flow beyond the Phase 1 capture and a guest's Prayed tap (P3-PRAYER-24): guests can edit and delete any family request (no role check at `apps/prayer.html:1255-1262`), not exercised; that guests see a shared copy's For (P3-PRAYER-18) follows from the shared detail-sheet code, not a guest run.
- Importing a v2 (single-list) backup (P3-PRAYER-03): from the code only (`apps/prayer.html:1510-1514, 1524`), not run.
- P3-PRAYER-17 in shipping iOS Safari (see Unresolved).
- P3-PRAYER-19 with a remote delete, and the Kitchen date line after midnight: from the code only.
- P3-PRAYER-24's rename facet (a rename orphans that day's marks), and the kid star it can credit (owned by P3-KIDVERSE-07): from the code only in this report.
- P3-PRAYER-25 through Import or P3-PRAYER-01's replaced rows: not re-tested.
- The chat tools' Prayer paths (`mark_prayed`, `answer_prayer`), owned by Phase 2.
- Echo Prayer's features come from search snippets and PrayerMate's from product knowledge; neither app was used.

## Scripts and evidence

**Investigator** (`audits/tools/phase3/prayer/`):
- `id-collision.mjs`, `slow-start.mjs`, `import-family.mjs`, `family-tick.mjs`, `xss-id.mjs`, `list-collapse.mjs`, `unanswer.mjs`, `undo-stale.mjs`, `leads.mjs` (leads 5-25 and copy checks), `dates.mjs`, `taps.mjs`, `layout.mjs`, `contrast.mjs`, and `to1x.mjs` (rewrites the evidence PNGs at 1×; rerun it after any script that takes screenshots).
- Platform counts: `node audits/tools/phase3/compliance.mjs prayer` → `audits/evidence/p3/_compliance/prayer.json`.
- Logic: `node handoff/prayer/check.js apps/prayer.html`.

**Skeptics** (`audits/tools/phase3/prayer/`):

| Finding | Scripts |
|---|---|
| P3-PRAYER-01 | `verify-id-collision-1.mjs` (+ `verify-id-collision-1-1x.mjs`), `verify-id-collision-2.mjs` |
| P3-PRAYER-02 | `verify-slow-start-person-wipe-1.mjs`, `verify-slow-start-person-wipe-2.mjs` |
| P3-PRAYER-03 | `verify-import-wipes-family-1.mjs`, `verify-import-wipes-family-2.mjs` |
| P3-PRAYER-04 | `verify-unanswer-erases-note-1.mjs`, `verify-unanswer-erases-note-2.mjs` (+ `verify-unanswer-erases-note-2-1x.mjs`) |
| P3-PRAYER-05 | `verify-family-tick-shared-1.mjs`, `verify-family-tick-shared-2.mjs` (+ `verify-family-tick-shared-2-to1x.mjs`) |
| P3-PRAYER-06 | `verify-xss-row-id-1.mjs`, `verify-xss-row-id-2.mjs` |
| P3-PRAYER-07 | `verify-list-group-collapses-1.mjs` (+ `verify-list-group-collapses-1-to1x.mjs`), `verify-list-group-collapses-2.mjs` |
| P3-PRAYER-08 | `verify-share-drops-days-1.mjs`, `verify-share-drops-days-2.mjs` |
| P3-PRAYER-09 | `verify-undo-stale-object-1.mjs`, `verify-undo-stale-object-2.mjs` (+ `verify-undo-stale-object-2-to1x.mjs`) |
| P3-PRAYER-10 | `verify-tap-before-ready-1.mjs`, `verify-tap-before-ready-2.mjs` |
| P3-PRAYER-11 | `verify-other-timezone-date-1.mjs`, `verify-other-timezone-date-2.mjs` |
| P3-PRAYER-12 | `verify-review-double-count-1.mjs`, `verify-review-double-count-2.mjs` |
| P3-PRAYER-13 | `verify-cheer-at-zero-1.mjs`, `verify-cheer-at-zero-2.mjs` |
| P3-PRAYER-14 | `verify-category-count-mismatch-1.mjs`, `verify-category-count-mismatch-2.mjs` (+ `verify-category-count-mismatch-2-1x.mjs`) |
| P3-PRAYER-15 | `verify-delete-copy-wrong-1.mjs` (+ `verify-delete-copy-wrong-1-to1x.mjs`), `verify-delete-copy-wrong-2.mjs` |
| P3-PRAYER-16 | `verify-morning-copy-evening-1.mjs`, `verify-morning-copy-evening-2.mjs` |
| P3-PRAYER-17 | `verify-critic-plan-id-xss-1-1.mjs` (run with `webkit` and `chromium`), `verify-critic-plan-id-xss-1-2.mjs` |
| P3-PRAYER-18 | `verify-critic-share-copies-for-and-category-2-1.mjs` (+ `verify-critic-share-copies-for-and-category-2-1-to1x.mjs`), `verify-critic-share-copies-for-and-category-2-2.mjs` |
| P3-PRAYER-19 | `verify-critic-kitchen-view-stale-3-1.mjs`, `verify-critic-kitchen-view-stale-3-2.mjs` |
| P3-PRAYER-20 | `verify-critic-add-screen-no-list-name-4-1.mjs`, `verify-critic-add-screen-no-list-name-4-2.mjs` |
| P3-PRAYER-21 | `verify-critic-untick-keeps-day-5-1.mjs`, `verify-critic-untick-keeps-day-5-2.mjs` |
| P3-PRAYER-22 | `verify-critic-sunday-nudge-says-gone-quiet-6-1.mjs` (+ `verify-critic-sunday-nudge-says-gone-quiet-6-1-to1x.mjs`), `verify-critic-sunday-nudge-says-gone-quiet-6-2.mjs` |
| P3-PRAYER-23 | `verify-critic-focus-plan-deleted-category-7-1.mjs`, `verify-critic-focus-plan-deleted-category-7-2.mjs` |
| P3-PRAYER-24 | `verify-critic-prayedby-keyed-by-name-8-1.mjs`, `verify-critic-prayedby-keyed-by-name-8-2.mjs` |
| P3-PRAYER-25 | `verify-critic-title-edit-announced-as-new-9-1.mjs`, `verify-critic-title-edit-announced-as-new-9-2.mjs` |
| P3-PRAYER-26 | `verify-critic-no-enter-escape-10-1.mjs`, `verify-critic-no-enter-escape-10-2.mjs` |

**Completeness critic** (`audits/tools/phase3/prayer/`): `critic-sweep.mjs` (sections `planxss`, `kitchen`, `untick`, `sunday`, `guest`; pass the section name, and for `planxss` optionally `chromium`), `critic-push-share.mjs`, `critic-add-focus.mjs`, `critic-keys.mjs`. The skeptics' verdict JSONs are in the session scratchpad (`p3/verify/prayer/critic-*.json`); their evidence is the `verify-critic-*` files below.

**Visual checker.** `audits/tools/phase3/prayer/vischeck-fab-list.mjs` → `audits/evidence/p3/prayer/vischeck-fab-list.json` and the `vischeck-*` PNGs; it also re-read the investigator's `contrast.json` and `layout.json` and opened the 49 screenshots described in §5.

**Evidence** is in `audits/evidence/p3/prayer/`:
- JSON: `contrast.json`, `dates.json`, `family-tick.json`, `id-collision.json`, `id-collision-D.json`, `import-family.json`, `layout.json`, `leads.json`, `list-collapse.json`, `slow-start.json`, `taps.json`, `unanswer.json`, `undo-stale.json`, `xss-id.json`, `vischeck-fab-list.json`, the critic's `critic-*.json`, and the `verify-*.json` files (the `verify-critic-*` ones for P3-PRAYER-17 to -26).
- PNGs at 1× CSS scale: the `critic-*`, `family-tick-*`, `id-collision-*`, `import-family-*`, `layout-*`, `leads-*`, `list-collapse-*`, `slow-start-*`, `verify-*` and `vischeck-*` images.

The Phase 1 captures are under `audits/screens/prayer/` and the contact sheets under `audits/screens/_sheets/`.
