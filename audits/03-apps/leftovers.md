# Larder Ledger (leftovers) (`leftovers`) — Phase 3 deep dive

| | |
|---|---|
| **App code audited** | `fe6041d`, unchanged since the Phase 0 baseline. This phase changed no app code. |
| **File(s)** | `apps/leftovers.html` (383 lines). Shared code it depends on: `apps/hub.js` (500), `apps/design.css` (617), `index.html` (1716; the Home "In the fridge" card and the Apps badge), `worker/src/reminders.js` (261; the 8 am push), `worker/src/chat.js` (457; `add_list_item` and `finish_leftover`), `art/empty/fridge.svg` (7). Registry entry: `apps.json:5`. |
| **Date** | 2026-09-24 |
| **Inputs** | `audits/00-inventory.md` §9b "leftovers — Larder Ledger" (lines 3675-3786); the 184 Phase 1 captures under `audits/screens/leftovers/` and the 12 sheets `audits/screens/_sheets/leftovers--*.jpg`; `audits/01-leads.md` "Larder Ledger" (lines 129-154); Phase 2 IDs P2-CHAT-03, P2-CHAT-09, P2-HOME-04, P2-PROF-05, P2-PROF-19, P2-SYNC-03, P2-SYNC-06, P2-SYNC-07, P2-SYNC-15, P2-SYNC-17, P2-STAB-01, P2-PWA-06, P2-PWA-10, P2-PWA-11 and P2-PWA-13, plus the unverified Phase 2 items PWA-UX-3 and UX-HOME-1. |
| **Runtime** | Local instance with the demo household (typical seed unless stated; empty and overflow seeds where stated), Playwright WebKit. Chromium where stated (double-tap, bad dates, future dates, slow first open). Demo clock Tue 22 Sep 2026 08:40 New York; controllable browser clocks for the midnight and DST runs. No production data or endpoint was touched. |
| **Reproduce** | Scripts in `audits/tools/phase3/leftovers/`, evidence in `audits/evidence/p3/leftovers/`. Run each with `node "audits/tools/phase3/leftovers/<name>.mjs"`. |

**How to read this.** Every bug, security or perf finding went to two independent skeptics. Each re-read the code and re-ran the finding with their own script. A third skeptic would have broken a tied verdict, but no verdict was tied. A defect is **CONFIRMED** only when at least two skeptics reproduced it and more confirmed it than refuted it. Refuted findings go under "Checked and not a bug", and undecided ones under "Unresolved". UX, VIS, GAP and OK items describe the design, not malfunctions, so they were not adversarially verified. A separate agent re-checked every rubric score against the screenshots; a judge would have settled any gap of 2 or more points, but none arose. The visual checker also filed three bugs of its own; they went to the skeptics like the others and are marked "from the visual check". A completeness critic then re-read the report and ran its own sweep. Its four new bugs went to two skeptics each, like the others, and are marked "from the critic" (P3-LEFTOVERS-12 to -15). Severity follows the rule at the top of `audits/02-shell.md` (lines 25-37).

**Severity splits.** One tie rule settles every 1-1 severity split: the severity rule's own text is applied to the skeptics' corrected claim, and the finding says which clause decided it. Three findings split: P3-LEFTOVERS-02 (low / medium → medium: a secondary flow, the push, misleads every day), P3-LEFTOVERS-06 (low / medium → low: after both skeptics narrowed it, it is an edge case that loses only typed text) and P3-LEFTOVERS-13 (high / critical → critical: rule (a), loss through a shipped screen in normal use, with no dev-tools step).

## Summary

- **What it is.** The family's shared fridge log. Each leftover is a family-scope row `item:<id>` = `{id, name, size, dateLogged, by, byName}` (`apps/leftovers.html:294-297`). Items are grouped by age into Use it up (7+ days), Aging (4-6) and Fresh (0-3) (`apps/leftovers.html:137, 143-147, 168-170`). Home's "In the fridge" card, the Apps badge and an 8 am push read the same rows.
- **Confirmed defects: 15** (3 critical, 0 high, 3 medium, 9 low). None were refuted or left unresolved.
  - The three criticals are all one ✓ removing a family food that nobody chose, for the whole house, with no undo:
    - **P3-LEFTOVERS-01:** two quick taps on one ✓ remove that food and the one below it. It reproduced on iPhone and iPad touch, with a desktop double-click and in Chromium.
    - **P3-LEFTOVERS-12 (from the critic):** a change from another device re-renders the open list under a single tap, and the tap removes a different item.
    - **P3-LEFTOVERS-13 (from the critic):** a kid's one tap on a ✓ removes a family item. The hub's chat refuses fridge clean-up to kids, so this screen is the first shipped path for P2-PROF-05's kid writes.
  - The mediums: the push, Home and the Larder word "old" differently (P3-LEFTOVERS-02); after the March DST change every older item reads a day young (P3-LEFTOVERS-03); a date that is not YYYY-MM-DD shows "NaNd ago" and is never warned about (P3-LEFTOVERS-04).
  - Three of the lows came from the visual check: a false empty fridge on a slow first open (P3-LEFTOVERS-05), "select manually" with nothing to select (P3-LEFTOVERS-10), and long names that cannot be read (P3-LEFTOVERS-11). Two came from the critic: a second Log in the minute after midnight is refused (P3-LEFTOVERS-14), and the add bar's error line is below AA in Hearth (P3-LEFTOVERS-15).
- **Rubric: final average 4.3 / 10** (investigator 4.6). The visual checker lowered Colour & palette, Iconography, Dark mode and Ease of use by one point each. Motion & feedback and Glanceability are weakest at 3.
- **Biggest usability gaps.**
  - One tap on ✓ deletes an item for everyone, with no undo and no completed list (UX-LEFTOVERS-1).
  - Kids get the full adult editor, with no pictures and adult-size type (UX-LEFTOVERS-2); its data side is P3-LEFTOVERS-13.
  - Nothing on the page can be read from 2 m on the Kitchen iPad (UX-LEFTOVERS-3).
  - Logging takes 3 taps from Home.
- **Biggest visual gaps.** Earth-tone states instead of pastel pairs, with chip fills that vanish in dark mode (VIS-LEFTOVERS-3); a 2.69:1 amber bar (VIS-LEFTOVERS-2); a grey native select and raw ISO dates (VIS-LEFTOVERS-5); a fixed glass bar that covers cards on iPhone (VIS-LEFTOVERS-6); no press or removal motion (VIS-LEFTOVERS-8).
- **What works.** Every colour is a design.css token. Every list, chip and status text pair passes AA in all five palettes (lowest 4.9:1); the one exception is the add bar's 12 px error line, which fails in Hearth (4.35:1, P3-LEFTOVERS-15). There is no hub.js bypass. The kiosk is read-only in the UI and on the server. Two-device sync, the offline queue and the midnight rollover all converge (OK-LEFTOVERS-1 to 3).
- **Best-value improvement.** An undo toast on ✓ that also ignores ✓ taps for about 400 ms after any re-render, the user's own or another device's (delight 5, effort S). It closes P3-LEFTOVERS-01, -12 and UX-LEFTOVERS-1 together. Next come one set of words for "old" on all three surfaces (4, S) and New York calendar-day maths with the day re-checked on submit (3, S), which fixes P3-LEFTOVERS-03, -07, -08 and -14 at once.

## 1. Purpose and top jobs

The Larder Ledger is a single page (`apps/leftovers.html:100-131`):
- a title with a count ("6 in the fridge");
- a red banner when anything is a week or older;
- the grouped list, each card with a coloured stripe, name, "size · logged date · Nd ago · who", a freshness bar, a status chip and a ✓;
- a "Copy list for Hearth" block;
- a fixed glass add bar: name (with a mic), Log, size and date.

There is no usage data, so the top jobs are inferred from the app and the Home card:

| # | Job | Who | How often |
|---|---|---|---|
| 1 | "What needs eating?": mostly a glance at Home's "In the fridge" card on the Kitchen iPad (`index.html:1172-1182`), plus the 8 am push (`worker/src/reminders.js:66-79`) | Every adult | Several times a day |
| 2 | Log tonight's leftovers | Whoever cooked (Elizabeth, David, Mae, Eli) | About once a day, after dinner |
| 3 | Cross off what was eaten or thrown out | Whoever finishes it | About daily |

Kids (Ezra, Kiara) can open it, because `apps.json:5` has no `visibleTo`, and CLAUDE.md lists the Larder among kids' apps (`CLAUDE.md:18`). They have no real job here. The TV kiosk sees it read-only. Guests use it like adults.

## 2. Features and gaps

**References.**
- **Apple first-party:** Reminders with dates. The investigator read Apple's Reminders guide (https://support.apple.com/en-us/102484) with WebFetch. It confirms due dates ("Today, Tomorrow, This Weekend… Date & Time"), completed items that can be seen again ("Show Completed") and shared lists with assignment. The Today and Scheduled smart lists, overdue items in red and shake-to-undo are not on that page; they come from product knowledge.
- **Best in class:** NoWaste and Fridgely, expiry trackers with a use-by date per item and green, amber and red states. Their pages were not fetched, so these facts are product knowledge.

| Capability | This app | Reference | Gap |
|---|---|---|---|
| Log with size and date | Name, size (Small to Family-size), a date box defaulting to today, voice for the name (`apps/leftovers.html:120-131, 136, 289-304, 313-326`) | Reminders: add with a date; expiry apps: add with a use-by | None for logging |
| Age and freshness state | Days since logged, 3 groups, stripe, chip and bar (`apps/leftovers.html:137-147, 168-170, 249-273`) | Expiry apps: green, amber, red per item | The same fixed 4/7-day rule for every food (GAP-LEFTOVERS-1) |
| Use-by date per item | NOT FOUND IN CODE | Reminders due dates; expiry apps' use-by | Yes (GAP-LEFTOVERS-1) |
| Edit name, size or date | NOT FOUND IN CODE: the card has only a ✓ (`apps/leftovers.html:275-283`) | Reminders: tap to edit | Yes (GAP-LEFTOVERS-1) |
| Finish an item | One tap on ✓, no confirm (`apps/leftovers.html:281, 306-311`) | Reminders: tap the circle | A double-tap removes two (P3-LEFTOVERS-01); a change from another device can put a different item under the tap (P3-LEFTOVERS-12); kids can finish family items (P3-LEFTOVERS-13) |
| Undo and completed history | NOT FOUND IN CODE | Reminders "Show Completed"; shake to undo | Yes (UX-LEFTOVERS-1) |
| Full name / detail view | None: one line with an ellipsis (`apps/leftovers.html:75`) | Reminders detail view | Yes (P3-LEFTOVERS-11) |
| Search | NOT FOUND IN CODE | Reminders search | Yes; little value at 6-30 items |
| Food icon or photo | NOT FOUND IN CODE (`kid.json` images 0) | Expiry apps' food icons | Yes (UX-LEFTOVERS-2) |
| Reminder of old food | 8 am push for items 5+ days old (`worker/src/reminders.js:66-79`) | Reminders due alerts; expiry apps' notifications | Present, but its words differ from the app's (P3-LEFTOVERS-02) |
| Shared with the household | Family scope; the Home card and badge (`index.html:679-681, 699, 1172-1182`) | Reminders shared lists | None |
| Who logged it | `byName` as plain text (`apps/leftovers.html:265`) | Reminders assignment with a face | Partly (VIS-LEFTOVERS-4) |
| Offline and sync state | Offline queue; a 12 px status line (`apps/leftovers.html:26-27, 183-187`) | Native sync | No per-item pending mark (UX-LEFTOVERS-7) |
| Hand-off to another display | "Copy list for Hearth" (`apps/leftovers.html:113-117, 328-358`) | Share sheet | Misleading, and a dead end on failure (UX-LEFTOVERS-4, P3-LEFTOVERS-10) |

## 3. Ease of use

Taps measured with real clicks in `audits/tools/phase3/leftovers/taps.mjs` (evidence `audits/evidence/p3/leftovers/taps.json`) and `audits/tools/phase3/leftovers/kid.mjs` (`audits/evidence/p3/leftovers/kid.json`):

| Job | Profile | Path | Taps | Target ≤ 2 for the most frequent | Met? |
|---|---|---|---|---|---|
| What needs eating? (the most frequent) | Eli, iPhone PWA and iPad portrait | Home "In the fridge" card: the count and the 3 oldest items aged 4+ days, fully on screen (iPhone y 484-772 of 932; iPad 226-514 of 1180) | 0 | ≤ 2 | **Yes** |
| Log tonight's leftovers | Eli, iPhone PWA and iPad portrait | Home card "Open the ledger" → name box → type → Log (size and date defaults kept) | 3 + typing (4 from the Apps tab). Each further dish costs 2 taps (name box, Log) where 1 would do, because the field blurs after Log (`apps/leftovers.html:298`) and the keyboard has to reopen: 3 dishes = 3 + 2 + 2 = 7 taps plus typing | ≤ 2 (a daily job) | **No** |
| Cross off an item | Eli | Home card "Open the ledger" → ✓ | 2 on iPad; on iPhone items 5-7 sit under the add bar and need 1 scroll first | ≤ 2 | **Yes** on iPad, **partly** on iPhone |
| Kid opens the Larder | Ezra, iPad | Home "Let's play — open your apps" → Larder Ledger tile | 2; one more tap on ✓ removed Chicken alfredo on the server (P3-LEFTOVERS-13) | n/a | n/a |

Home shows only items aged 4 days or more, so seeing the Fresh ones takes the 1 tap into the ledger.

- **Discoverability.** Everything is on one page, but three things mislead:
  - The Hearth block tells people to ask Claude for something the hub's Claude cannot do (UX-LEFTOVERS-4).
  - The red banner names no item and cannot be tapped (UX-LEFTOVERS-9).
  - Long names cannot be read anywhere in the app (P3-LEFTOVERS-11).
- **Undo.** None (NOT FOUND IN CODE; `apps/leftovers.html:306-311`). One tap deletes for everyone (UX-LEFTOVERS-1), a double-tap deletes two (P3-LEFTOVERS-01), and a change from another device can move a different item under a single tap (P3-LEFTOVERS-12). The feed line "Finished the …" is the only trace, and it cannot restore anything.
- **Error prevention.**
  - An empty name does nothing, silently (UX-LEFTOVERS-5).
  - The name has no `maxlength` (P3-LEFTOVERS-11).
  - Only the date box's `max` stops a future date (P3-LEFTOVERS-09).
  - Dates written by chat are never checked (P3-LEFTOVERS-04).
  - Log is live before the app is ready (P3-LEFTOVERS-06).
  - In the minute after midnight a second Log is refused with a native error that blames the date shown (P3-LEFTOVERS-14).
  - Escape does nothing in the name field, and keyboard focus is lost after a ✓ (§6, Keyboard and focus).
- **One-handed phone use.**
  - The add bar sits at the bottom (y 799-929 on the 932-high iPhone), in the thumb zone.
  - The first ✓ is at y 285, in the top third.
  - The ✓ of items 5-7 (y 784, 877, 970) is under the bar, so they need a scroll first.
  - A new card lands under the bar (UX-LEFTOVERS-6) (`taps.json`).
- **iPad glanceability at 2-3 m.** The measure is cap height on the 11" iPad (0.1924 mm per CSS px), against Phase 2's two heuristics (`audits/02-shell.md:519-520`). H1 needs 10 mm at 2 m; H2 needs 5.8 mm. Every string fails both at 2 m and at 3 m:
  - the 28 px title: 3.85 mm;
  - item names: 2.31 mm;
  - chips, group titles and meta: 1.73 mm.

  So the glance job rests on Home's card, which Phase 2 measured at 2.3-3.1 mm (UX-HOME-1, `audits/02-shell.md:546`). Details: UX-LEFTOVERS-3.
- **Pre-reader use (Ezra, Kiara).** Nothing can be done by icon, colour and position alone:
  - There are no food pictures or icons (`images: 0`).
  - The type is 16 / 12.5 / 11.5 px, because the app's px sizes ignore the kid scale (`--fs-md` 19 px).
  - The only big controls on the cards are the ✓ buttons, and each one deletes a family item for the whole house (P3-LEFTOVERS-13). The add bar's Log button (88×52) and mic are as large, and they log for the house too (UX-LEFTOVERS-2).
- **Grandparents.** Meta lines are 12.5 px and chips 11.5 px. The status line that says sync is failing is 12 px amber text (UX-LEFTOVERS-7, UX-LEFTOVERS-8), and the voice error line is 12 px and below AA in Hearth (P3-LEFTOVERS-15).

## 4. Issues and bugs

### Register

| ID | Severity | Defect |
|---|---|---|
| P3-LEFTOVERS-01 | critical | A double-tap on one ✓ removes that item and the next one, for everyone, with no undo |
| P3-LEFTOVERS-12 | critical | A change from another device re-renders the open Larder under the finger, and a single tap removes a different item (from the critic) |
| P3-LEFTOVERS-13 | critical | A kid's tap on a ✓ removes a family fridge item for everyone, with no undo (from the critic) |
| P3-LEFTOVERS-02 | medium | Home, the Apps badge and the 8 am push word the fridge differently from the Larder ("use it up" for food the Larder calls "eat soon") |
| P3-LEFTOVERS-03 | medium | After the March DST change, every older item reads one day young in the Larder and on Home (the push is right) |
| P3-LEFTOVERS-04 | medium | A dateLogged that is not YYYY-MM-DD shows "NaNd ago", stays Fresh forever and is never warned about |
| P3-LEFTOVERS-05 | low | A slow first open shows "0 in the fridge" and "Nothing logged yet." as "the last copy saved here" (from the visual check) |
| P3-LEFTOVERS-06 | low | Tapping Log or pressing Enter before the app is ready reloads the page and loses the typed name |
| P3-LEFTOVERS-07 | low | A device in another time zone writes and reads its own local date ("-1d ago" on the New York iPad) |
| P3-LEFTOVERS-08 | low | The first item logged in the minute after midnight gets yesterday's date |
| P3-LEFTOVERS-09 | low | A future dateLogged is never clamped: it reads "-3d ago", files as Fresh and delays every warning |
| P3-LEFTOVERS-10 | low | "Copy failed — select manually" leaves nothing to select (from the visual check) |
| P3-LEFTOVERS-11 | low | Long item names are cut to one line and cannot be read in the Larder (from the visual check) |
| P3-LEFTOVERS-14 | low | After one Log in the minute after midnight, the next Log is refused with "must be yesterday or earlier" while the box shows today (from the critic) |
| P3-LEFTOVERS-15 | low | The add bar's 12 px error line is below AA in Hearth (4.22-4.41:1) (from the critic) |

The register is ordered by severity, then ID.

### Phase 2 defects that show up here

- **P2-CHAT-03** (critical). Chat's `finish_leftover` can remove a different food from this list on one shared word, and the Larder has no undo to bring it back (`apps/leftovers.html:306-311`). P3-LEFTOVERS-01 is the same class of loss through the Larder's own ✓.
- **P2-CHAT-09** (critical). A chat `finish_leftover` that loses last-write-wins shows "✓ Finished …" while the item is still in the Larder.
- **P2-PROF-05** (medium). The server lets kids write leftovers. Phase 2 already noted that the Larder hands kids "Mark used up" and the add form (`audits/02-shell.md:1636`), and left the UI side to Phase 3. The design side is filed here as UX-LEFTOVERS-2. P2-PROF-05's downgrade rests on "no shipped screen lets a kid send these writes" (`audits/02-shell.md:1269`). That holds for the forged writes Phase 2 tested, but not for a kid's ✓ in the Larder: that shipped-screen trigger is filed as P3-LEFTOVERS-13 (critical, p2Ref P2-PROF-05). P2-PROF-05 keeps its own medium for the API-only writes.
- **P2-SYNC-07** (critical). A fridge item logged just before the Kitchen iPad switches to the Downstairs TV profile is discarded. The leftovers channel is among those wiped (`audits/02-shell.md:2572-2574`). Not re-run.
- **P2-SYNC-15** (low). `hub.sync.state` starts as `'offline'`, so a warm open flashes "Can't reach the house list — showing the last copy saved here." Phase 2 measured it at 468-1535 ms (`audits/02-shell.md:2699-2728`); it was not re-measured here. The cold-open facet that P2-SYNC-15 said did not affect the Larder is filed as P3-LEFTOVERS-05.
- **P2-SYNC-17** (critical). F260's history wipe shares the root cause of P3-LEFTOVERS-05 and -06: `hub.ready` waits up to 6 s on a cold cache and then goes ahead as if there were no data (`apps/hub.js:334-337`). The Larder mechanisms are different, so they are filed separately.
- **P2-PROF-19** (critical). "Forget this device" deletes a queued (offline) fridge log or finish. Not re-run.
- **P2-SYNC-06** (critical). `hub.migrate` of a legacy `leftovers.items` array with more than 200 items would hit the dropped-batch limit (`apps/leftovers.html:174`). Not run.
- **P2-SYNC-03** (critical), by code, not run. The legacy `leftovers.items` migration (`apps/leftovers.html:174`) sets each `item:<id>` that is missing from the *local* cache (`apps/hub.js:406`). On a device with the legacy array and no mark, opened before the first `leftovers|family` pull lands, it would re-set items with a new stamp over the server's rows, including tombstones of items already finished elsewhere. The shell declares `leftovers|family` (index.html:458), so this is safe once the shell's pull has landed.
- **P2-STAB-01** (critical). With Reduce Motion on, the whole hub is blank, so the Larder cannot be reached. The app's own reduced-motion rule is fine (`apps/leftovers.html:97`).
- **P2-PWA-10** (low). One subscription row with no keys aborts the 8 am fridge push for everyone.
- **P2-PWA-11** (low). A failed 8 am fridge push counts as sent, so it is not retried that day.
- **P2-PWA-06** (medium). "Logged …" and "Finished the …" lines queued offline post late, under whoever acts next on the device.
- **P2-PWA-13** (low). Possibly seen, not isolated: the double-click arms of `doubletap.json` (B) and of skeptic 1's run (DBL) both have "Finished the Sunday pot roast" twice in the feed.
- **PWA-UX-3** (ux, low; `audits/02-shell.md:4855-4860`). Voice add has no "Listening…" text and one error line for every failure, and the mic is hidden without SpeechRecognition (`apps/leftovers.html:61, 315-325`). On iPhone the mic squeezes the placeholder to "Chicken alf". Not re-run.
- **UX-HOME-1** (ux; investigator-only "high" in Phase 2, `audits/02-shell.md:546`). The Home fridge card's text is 2.3-3.1 mm tall on the iPad. The Larder page's own glance is UX-LEFTOVERS-3.

### Confirmed defects

#### P3-LEFTOVERS-01 — A double-tap on one ✓ removes that item and the next one, for everyone, with no undo

- **Severity: critical** (skeptics: critical / critical; unchanged from the investigator's rating). This is rule (a): in normal use the shipped ✓ silently tombstones a family row that nobody chose, with no confirm, undo or completed list. That the item can be re-logged by hand is not a reason to lower it under the rule.
- **Exposure.** Two quick taps (up to at least 350 ms apart), a shaky hand, a child, or a mouse double-click, on a ✓ that has another card below it. On the iPhone and iPad the next ✓ is redrawn under the same point. Recovery means re-logging by hand with the original date. The row's id and "logged by" are lost, and its 8 am warning stops in the meantime.
- **Second trigger, same root cause.** The list is also rebuilt, with no animation and no tap guard, whenever another device's change arrives (`hub.onChange(render)`, `apps/leftovers.html:378`: the 30 s pull, a visibility change, reconnect or a `storage` event). A single careful tap aimed just before that re-render can land on a different item's ✓. That trigger is filed as P3-LEFTOVERS-12; one fix (undo plus a short tap guard after any re-render) closes both.
- **Related.** P2-CHAT-03 is the same class (a food still in the fridge removed, no undo) through chat. This is a new UI trigger, not a duplicate. UX-LEFTOVERS-1 covers the single-tap, no-undo design.

**What happens now.** The ✓ handler (`apps/leftovers.html:281`) calls `removeItem`. It tombstones the row, posts "Finished the …" and calls `render()` in the same call (`apps/leftovers.html:306-311`). `render()` empties and rebuilds the whole list (`apps/leftovers.html:203-246`). Cards in a group are the same height, so the next card's ✓ is drawn at the same screen point, and a second tap removes it. `touch-action: manipulation` (`apps/design.css:303, 312`) turns off double-tap zoom, so both taps reach the page. The investigator's runs:
- iPhone PWA, two touch taps 180 ms apart on Sunday pot roast: Sunday pot roast and Spaghetti and meatballs removed on the server.
- iPad portrait, a double-click: the same two.
- iPhone, two taps on Beef and bean chili: Beef and bean chili and Roasted sweet potatoes removed.

No arm showed any undo UI (`undoUi: false`).

**Expected.** One tap on one ✓ removes one item. A second tap during the re-layout does not reach a different row, and any removal can be undone.

**Why it matters to the household.** A food that is still in the fridge silently leaves the family list, and its 8 am "use it up" push stops. Nobody chose it, and nothing on screen says a second item went.

**Evidence.**
- Code: `apps/leftovers.html:203-246, 281, 306-311`; `apps/design.css:303, 312`.
- Runs: `audits/evidence/p3/leftovers/doubletap.json`, `audits/evidence/p3/leftovers/verify-double-tap-removes-next-item-1.json`, `audits/evidence/p3/leftovers/verify-double-tap-removes-next-item-2.json`.
- Screenshots: `audits/evidence/p3/leftovers/doubletap-A-touch-fresh-iphone-pwa.png` (4 in the fridge, Fresh 1), `audits/evidence/p3/leftovers/verify-double-tap-removes-next-item-1-DBL-desktop.png`, `audits/evidence/p3/leftovers/verify-double-tap-removes-next-item-2-double-chromium.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/doubletap.mjs"`. Observed:
- `A-touch-fresh removedOnServer ["Sunday pot roast","Spaghetti and meatballs"], undoUi false`
- `B-dblclick-fresh removedOnServer ["Sunday pot roast","Spaghetti and meatballs"]`
- `C-touch-aging removedOnServer ["Beef and bean chili","Roasted sweet potatoes"]`

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-double-tap-removes-next-item-1.mjs"`: a fresh instance, typical seed, `L.reset` before each arm, Eli, the Larder opened through the shell, and server rows read after a 4 s flush.
  - CTRL, one touch tap: afterwards the point is over the next ✓ (`underAfterFirst {onDoneButton:true, card:'Spaghetti and meatballs'}`), and only Sunday pot roast is removed.
  - T250 and T350, two touch taps 250 or 350 ms apart on the iPhone PWA: Sunday pot roast and Spaghetti and meatballs removed on the server. The feed had "Finished the Spaghetti and meatballs" and "Finished the Sunday pot roast"; no undo.
  - DBL, a mouse double-click on the 1440×900 desktop: the same two removed.
  - LAST, Chicken alfredo, the only card in "Use it up": `underAfterFirst {onDoneButton:false, card:'Roasted sweet potatoes'}`; only Chicken alfredo removed.
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-double-tap-removes-next-item-2.mjs"` (only `audits/tools/lib/local.mjs`, none of the investigator's helpers; WebKit, then Chromium) and a probe, `node "audits/tools/phase3/leftovers/verify-double-tap-removes-next-item-2-probe.mjs"`:
  - single-tap control: only Beef and bean chili removed.
  - WebKit iPhone, taps 250 ms apart: Beef and bean chili and Roasted sweet potatoes removed; 0 undo or toast nodes.
  - WebKit iPad portrait, 300 ms apart: the same two.
  - Chromium iPhone: the same two, so this is not a WebKit artefact.
  - Roasted sweet potatoes, the last card in "Aging": Roasted sweet potatoes and Sunday pot roast (the first Fresh card) removed. The probe showed the tap at frame y 482, the next ✓ redrawn at y 489-537, and WebKit's touch adjustment snapping the second tap onto it 7 px away.

**Corrected claim.** The core claim and the critical rating stand. The skeptics made the reach precise:
- Inside a group, the second tap always lands on the next card's ✓.
- At a group boundary it depends on how far the layout moves. When the group keeps its heading, the next group's first ✓ is a few pixels away, and touch adjustment snaps the tap onto it (skeptic 2). When the tapped card was the only one in its group, its heading and the red banner vanish too, the layout moves further, and only one item went (skeptic 1).
- It reproduces with taps 180-350 ms apart, with a desktop double-click and in Chromium. A real finger's contact area is larger than the 7 px gap, so the rig is if anything conservative (skeptic 2).

#### P3-LEFTOVERS-02 — Home, the Apps badge and the 8 am push word the fridge differently from the Larder

- **Severity: medium** (skeptics: low / medium; unchanged from the investigator's medium). The split was settled by the tie rule ("How to read this"): the rule's medium clause, "a secondary flow broken or misleading", fits the corrected claim. It is not the low clause's "edge case": it happens every day for every item aged 4-6 days or 7 and over. The push is a secondary flow, and its words contradict the app: it tells adults to "use up" food the Larder files as "eat soon". That makes it misleading, not cosmetic. It is not high, because the Larder's own list is right and every surface points at the same old items. Skeptic 1 rated it low as wording only.
- **Narrowed by both skeptics.** There are two cut-offs, not three, and the 5-day push is intentional (see Corrected claim).

**What happens now.** As filed, the investigator found three rules:
- **Larder:** Aging from 4 days; Use it up and the red banner from 7 (`apps/leftovers.html:137, 168-170, 207`). The Fresh group's sub-heading is "this week" (`apps/leftovers.html:146`).
- **Home card and Apps badge:** items of 4+ days count as "N to eat this week" (`index.html:679-681, 699, 1179`), and rows turn stale at 7 (`index.html:1175`).
- **Push:** 5+ days, with the body "N to use up: …" or "… is N days old — use it up." (`worker/src/reminders.js:69, 71-73`).

On the typical fridge:
- the Larder says "1 item at a week or older", with Beef and bean chili (5 days) under Aging;
- Home says "3 to eat this week", and the badge shows 3;
- the push's due list is "Chicken alfredo (8d), Beef and bean chili (5d)", so its body reads "2 to use up: …".

**Expected.** The same item gets the same words on every surface: for example "eat soon" for 4-6 days and "use it up" for 7 and over, in the app, on Home and in the push.

**Why it matters to the household.** The lock screen says a 5-day chili must be used up, the app calls it "eat soon", and Home calls an 8-day dish "to eat this week" while the app says "a week or older". People learn to ignore one of the three.

**Evidence.**
- Code: `apps/leftovers.html:137, 146, 168-170, 207`; `index.html:679-681, 699, 1175, 1179`; `worker/src/reminders.js:2, 69, 71-73`. The 5-day push is documented at `worker/README.md:131` and `CLAUDE.md:80`.
- Runs: `audits/evidence/p3/leftovers/thresholds.json`, `audits/evidence/p3/leftovers/verify-thresholds-disagree-1.json`, `audits/evidence/p3/leftovers/verify-thresholds-disagree-2.json`.
- Screenshots: `audits/evidence/p3/leftovers/thresholds-home-ipad.png` (Home, not the app), `audits/evidence/p3/leftovers/verify-thresholds-disagree-1-home-iphone.png`, `audits/evidence/p3/leftovers/verify-thresholds-disagree-1-larder-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/thresholds.mjs"`. Observed: `larder.banner "1 item at a week or older"`; `home.big "3 to eat this week"`; `appsTile "Larder Ledger 3"`; `push.due ["Chicken alfredo (8d)","Beef and bean chili (5d)"]`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-thresholds-disagree-1.mjs"` (typical seed, demo clock, Mom on the iPhone PWA; the morning job forced as Eli):
  - Home: "3 to eat this week", with Chicken alfredo 8d [stale], Beef and bean chili 5d and Roasted sweet potatoes 4d. The badge read "3" (aria "3 to eat this week").
  - Larder: the banner "1 item at a week or older", and the groups "Use it up 1 · a week or older", "Aging 2 · eat soon" and "Fresh 3 · this week".
  - Push: due `["Chicken alfredo (8d)","Beef and bean chili (5d)"]`. Every adult was skipped as `already_today`, so the body text comes from the code (`worker/src/reminders.js:71-73`) and was not seen in a real notification.
  - Rated it low.
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-thresholds-disagree-2.mjs"`: an empty seed plus six items aged 3-8 days, written through the batch API as Eli, read on the iPad portrait.
  - Larder: 8d and 7d "Use it up", 6d, 5d and 4d "Aging", 3d "Fresh"; banner "2 items at a week or older".
  - Home: "5 to eat this week", with the 8d and 7d rows stale. Badge "5".
  - Push: due for the 8d, 7d, 6d and 5d items, which gives "4 to use up: …".
  - Rated it medium.

**Corrected claim.** Both skeptics narrowed it:
- Home and the badge use the Larder's own boundaries. Their 4+ count (`index.html:681`) equals the Larder's Aging plus Use it up groups (`apps/leftovers.html:137, 169`), and Home's stale mark at 7 matches `WARN_DAYS`.
- The push's 5-day cut-off is deliberate and documented as an early warning (`CLAUDE.md:80`; `worker/README.md:131`; the comment at `worker/src/reminders.js:2`).

What remains are three contradictions in the wording:
1. The push says "use it up" or "N to use up" for 5-6 day items that the Larder files as "Aging · eat soon".
2. A 4-day item counts on Home and the badge but is never pushed.
3. Home and the badge call 7+ day items "to eat this week", while the Larder files them under "a week or older" and uses "this week" for its Fresh group.

#### P3-LEFTOVERS-03 — After the March DST change, every older item reads one day young in the Larder and on Home

- **Severity: medium** (skeptics: medium / medium; unchanged). Food-age labels, the red banner, the Home card and badge, and the Copy-for-Hearth text all read one day young, so "Aging" and "Use it up" arrive a day late. Nothing is lost or exposed. How often it happens plays no part in the rating (the Exposure line states that). It is medium on the rule's text: the ages are off by one day, not wrong in kind; the same old items are still listed in the same order; and the 8 am push, the one alert that reaches people without opening the app, keeps the right age. So job 1 is misleading rather than broken: "a secondary flow broken or misleading", not high's "a core daily flow … broken or wrong".
- **Exposure.** Every item whose `dateLogged` is on or before the second Sunday of March (14 Mar 2027 in New York), viewed after the change. The error lasts until the item is finished.

**What happens now.** `daysBetween` floors (local midnight today − local midnight of `dateLogged`) / 86400000 (`apps/leftovers.html:167`), and Home's `ageDays` uses the same formula (`index.html:679`). A span that crosses spring-forward is one hour short, so it floors a day low. The Worker takes a UTC date difference with `Math.round` (`worker/src/reminders.js:19`) and is right. Viewed on Tue 16 Mar 2027:
- an item logged 9 Mar (7 days) shows "6d · Aging" with no red banner, while the push says "(7d)";
- 12 Mar shows 3d "Fresh" instead of 4d "Aging";
- Home shows "2 to eat this week", with 6d and 4d.

The fall-back change on 1 Nov 2026 is correct: the span is an hour long, and the floor still gives the right day.

**Expected.** A calendar-day difference, as the Worker computes (`worker/src/reminders.js:19`).

**Why it matters to the household.** The Larder's main signal, the week-old warning, arrives a day late for a whole week's worth of food, and the app, Home and the lock screen disagree about the same dish.

**Evidence.**
- Code: `apps/leftovers.html:167, 207, 333-334`; `index.html:679, 699`; `worker/src/reminders.js:19`.
- Runs: `audits/evidence/p3/leftovers/dates-dst.json`, `audits/evidence/p3/leftovers/verify-dst-spring-forward-off-by-one-1.json`, `audits/evidence/p3/leftovers/verify-dst-spring-forward-off-by-one-2.json`.
- Screenshots: `audits/evidence/p3/leftovers/dates-spring-forward-2027-larder.png`, `audits/evidence/p3/leftovers/verify-dst-spring-forward-off-by-one-1-sat20-2100-larder.png`, `audits/evidence/p3/leftovers/verify-dst-spring-forward-off-by-one-1-control-feb-larder.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/dates.mjs"`. Observed for spring-forward: the item logged 2027-03-09 shows 6 days, "Aging", against a calendar 7; 03-11, 03-12, 03-13 and 03-14 are also one day low; the push's due list is `["Logged 2027-03-09 (7d)","Logged 2027-03-11 (5d)"]`; Home reads "2 to eat this week". All the fall-back rows match.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-dst-spring-forward-off-by-one-1.mjs"`: an empty seed in WebKit, items dated 7-15 Mar 2027 written through the real API, a frozen browser clock and the server clock set with `L.clock`. It viewed the iPhone PWA at Tue 16 Mar 07:30 EDT and the iPad at Sat 20 Mar 21:00 EDT, plus a February control.
  - Tue 16 Mar (calendar / Larder): 03-07 9/8; 03-09 7/6 "Aging"; 03-10 6/5; 03-12 4/3 "Fresh"; 03-13 3/2; 03-14 2/1; 03-15 1/1, correct.
  - Also on Tue 16 Mar: the banner said "1 item at a week or older" (should be 2) and Home "3 to eat this week" (should be 4). The Worker's due list was 9d, 7d and 6d, all correct.
  - Sat 20 Mar: every item logged on or before 03-14 was still one day low. 03-13 showed 6d "Aging" instead of 7d "Use it up", and the banner counted 4 instead of 5.
  - The February control, with the same spans and no DST change, matched exactly.
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-dst-spring-forward-off-by-one-2.mjs"`: an empty seed, the iPad portrait in the family's own zone (America/New_York), viewed Tue 16 Mar at 08:00 and 21:00 EDT, and Tue 23 Mar as a control.
  - 16 Mar (calendar / Larder): 03-09 7/6 "Aging"; 03-12 4/3 "Fresh"; 03-13 3/2; 03-14 2/1; 03-15 1/1.
  - There was no banner. Home read "1 to eat this week" (6d). The push said "(7d)".
  - 21:00 gave the same result, so the time of day makes no difference.
  - 23 Mar: items logged after the change were correct, but the 9 Mar item still read 13d against a calendar 14d.

**Corrected claim.** Correct as filed, with two refinements, mainly from skeptic 1:
- It affects every item logged on or before Sun 14 Mar, including items logged on the DST day itself. It lasts as long as the item stays listed: the error was still there 6-7 days later.
- It also reaches the Home tile badge (`index.html:699`) and the Copy-for-Hearth text (`apps/leftovers.html:333-334`), which use the same floor.

The Home count depends on the item set: the investigator's set gave 2, skeptic 1's gave 3 against a correct 4, and skeptic 2's gave 1.

#### P3-LEFTOVERS-04 — A dateLogged that is not YYYY-MM-DD shows "NaNd ago", stays Fresh forever and is never warned about

- **Severity: medium** (skeptics: medium / medium; unchanged). Once such a row exists, the app's core job fails for it: it reads Fresh forever and is left out of the banner, Home, the badge and the 8 am push. On its own that would be high.
- **Downgraded from high** because the only shipped trigger is unproven model behaviour: the chat model would have to send a non-ISO `dateLogged` against its schema description ("YYYY-MM-DD") and a system prompt that states today's ISO date (`worker/src/chat.js:32, 322`). The other trigger is a hand-made API write. The Larder's own add bar always writes an ISO date on real devices.
- **Exposure.** A leftover logged through chat with a date like "yesterday", "9/20/2026" or "2026-09-20T18:00", or written by any other path that skips the form.

**What happens now.** `add_list_item` stores `input.item.dateLogged` without a format check (`worker/src/chat.js:31-32, 187`). The app never validates a row's date (`apps/leftovers.html:167-170, 250-268`): `new Date('yesterday' + 'T00:00:00')` is invalid, so the age is NaN.
- The card reads "logged yesterday · NaNd ago", with the chip "Fresh", `--p` NaN and the aria-label "NaN of 10 days".
- Every "is it old?" comparison with NaN is false, so the Larder's groups, Home (`index.html:679-681`) and the push (`worker/src/reminders.js:19, 69`) never list it.

**Expected.** The Worker rejects or normalises a non-ISO date, and the app treats an unparseable date as "unknown" rather than Fresh.

**Why it matters to the household.** A leftover that chat logged can sit in the fridge for weeks marked Fresh, with no banner and no 8 am warning.

**Evidence.**
- Code: `worker/src/chat.js:31-32, 187, 322`; `apps/leftovers.html:167-170, 204, 265-268`; `index.html:679-681`; `worker/src/reminders.js:19, 69`.
- Runs: `audits/evidence/p3/leftovers/entry.json`, `audits/evidence/p3/leftovers/verify-non-iso-date-nan-1.json`, `audits/evidence/p3/leftovers/verify-non-iso-date-nan-2.json`.
- Screenshots: `audits/evidence/p3/leftovers/entry-chat-bad-date-ipad.png`, `audits/evidence/p3/leftovers/verify-non-iso-date-nan-1-larder-ipad.png`, `audits/evidence/p3/leftovers/verify-non-iso-date-nan-2-larder-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/entry.mjs"`. Step 4 uses a scripted model via the Phase 2 chat helper `audits/tools/phase2/CHAT/lib.mjs`. Observed: the chat cards show days "NaN", chip "Fresh" and meta "Medium · logged yesterday · NaNd ago · Eli"; the push's due list is `["Chicken alfredo (8d)","Beef and bean chili (5d)"]`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-non-iso-date-nan-1.mjs"`: four scripted `add_list_item` calls as Eli, dated 'yesterday', '9/20/2026', '2026-09-20T18:00' and an ISO control '2026-09-16'.
  - All four returned ok with a ✓ chip, and the server stored each date exactly as sent.
  - Each non-ISO card: days 'NaN', tone fresh, chip 'Fresh', meta "…NaNd ago…", `--p` NaN, aria "NaN of 10 days", bar fill 0 px. The ISO control read 6d "Aging".
  - Home read "4 to eat this week" and the push's due list had no NaN rows.
  - Node (V8, the engine of workerd and Chromium) also gives NaN for all three strings.
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-non-iso-date-nan-2.mjs"` in WebKit and in Chromium, with chat rows, a raw family PUT as Mom ('Sept 19') and an ISO control ('2026-09-14').
  - In both engines every bad row read NaN and Fresh.
  - Home's `fridgeDue` gave `days: null`. The badge "Larder Ledger 4" left the rows out, and so did the morning due list.
  - Rig note: in the Windows WebKit build `#date` falls back to a text box; in Chromium it is a real date input.

**Corrected claim.** Accurate, and wider than filed:
- Any non-ISO `dateLogged` from any path (a raw PUT, `set_data`, a migrated legacy row) behaves the same way, because neither the Worker nor the three consumers (`apps/leftovers.html:167`, `index.html:679`, `worker/src/reminders.js:19`) validate it.
- Date-time strings such as '2026-09-20T18:00' fail too.
- The Home badge leaves these rows out, and so (from code, not run) does the Copy-for-Hearth list (`apps/leftovers.html:329-330`).
- The sort comparators return NaN for them (`apps/leftovers.html:204`; `index.html:681`), so their order is undefined.
- The Larder's own date field cannot produce this on a real device. The Windows WebKit text fallback is a rig artefact, not a trigger.

#### P3-LEFTOVERS-05 — A slow first open shows "0 in the fridge" and "Nothing logged yet." as "the last copy saved here" (from the visual check)

- **Severity: low** (skeptics: low / low; the visual checker filed it as medium, so it is lowered). Nothing is written: 0 non-GET requests in every arm. It needs a first pull slower than 6 s on a device with nothing cached, and it clears when a pull lands. At worst someone logs an item twice, which shows and can be crossed off. Phase 2 rated the same symptom on Home and the TV low (P2-HOME-04, a pointer to P2-SYNC-15).
- **Exposure.** The first open on a new or cleared device, where neither the Larder nor the shell has cached `leftovers|family` (the shell pulls leftovers on Home, `index.html:458`), and the first pull takes more than 6 s or hangs.
- **Related.** P2-SYNC-15 (low) is the root cause: `hub.sync.state` starts as `'offline'` (`apps/hub.js:51`). It is filed separately because P2-SYNC-15's corrected claim says the Larder's cold open is safe, since `hub.ready` waits for the first pull (`audits/02-shell.md:2713`). That wait is capped at 6 s (`apps/hub.js:337`). This was also Phase 1 lead `audits/01-leads.md:136`.

**What happens now.** After 6 s, `hub.ready` stops waiting (`apps/hub.js:334-337`), and the Larder draws its final empty state (`apps/leftovers.html:172, 203-227`):
- "0 in the fridge";
- the empty fridge art with "Nothing logged yet.";
- above them, "Can't reach the house list — showing the last copy saved here." (`apps/leftovers.html:184`).

No copy exists, the server has 6 items, and `navigator.onLine` is true. The list fills in when a pull lands (`apps/leftovers.html:378`).

**Expected.** A loading state until the first pull has succeeded once (`hub.sync.lastPull > 0`, or a cache with `since > 0`). "Nothing logged yet." and a count only after that. "The last copy saved here" only when a copy exists.

**Why it matters to the household.** The page whose job is "what is in the fridge" tells a new phone the fridge is empty, which invites logging everything again.

**Evidence.**
- Code: `apps/hub.js:51, 334-337`; `apps/leftovers.html:172, 184, 203-227, 378`; `index.html:458`.
- Runs: `audits/evidence/p3/leftovers/before-ready.json` (B), `audits/evidence/p3/leftovers/verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-1.json`, `audits/evidence/p3/leftovers/verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-2.json`.
- Screenshots: `audits/screens/leftovers/stalled-loading-ipad-landscape-dark.png`, `audits/evidence/p3/leftovers/before-ready-B-stalled-7s-iphone.png`, `audits/evidence/p3/leftovers/verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-1-HOLD-7500ms-iphone.png`, `audits/evidence/p3/leftovers/verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-2-A-chromium-7s-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/before-ready.mjs"` (the leftovers GET delayed 9 s). Observed, arm B:
- at 7 s: `{tally:"0 in the fridge", empty:true, mode:"Can't reach the house list — showing the last copy saved here.", cards:0}`;
- after the pull: `{tally:"6 in the fridge", cards:6, mode:null}`;
- `serverHas: 6`.

The rig's recipe for the Phase 1 capture is `audits/tools/areas/leftovers.mjs:48-54`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-1.mjs"`, with a new iPhone PWA device for each arm and the frame sampled every 500 ms:
  - HOLD (the GET never answered): from 6.08-6.12 s, sync 'offline' with `onLine` true, "0 in the fridge", the empty block, 0 cards and the "last copy" line. Unchanged at 13.4 s, after the 12 s abort. 0 writes.
  - SLOW9 (answered after 9 s): the same false state from 6.07-6.10 s; in 4 of 6 runs, 6 cards at 9.1-9.3 s.
  - CTRL: 6 cards by 0.5 s.
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-2.mjs"`:
  - A, WebKit, the GET never answered, at 7.5 s: the same page; `sync {state:'offline', lastPull:0, lastError:null}`, cache null, server 6. At 13.5 s `lastError` was 'network' and the cache still null.
  - A2, Chromium: identical.
  - B, with Home loaded first: 6 cached cards at 7.5 s, with only P2-SYNC-15's false line.
  - C, the GET delayed 9 s: empty at 7.5 s, then 6 cards at 11.5 s.

**Corrected claim.** Accurate. The precondition is that the shell has not cached the scope either (arm B is safe). The page fixes itself when a pull lands, but with a hung request it stays empty past the 12 s abort, until a later pull succeeds. Line 184 never checks that a copy exists, so the "last copy" wording would also show on a genuinely offline first open. A possible longer-lasting variant is listed under Unresolved.

#### P3-LEFTOVERS-06 — Tapping Log or pressing Enter before the app is ready reloads the page and loses the typed name

- **Severity: low** (skeptics: low / medium; lowered from the investigator's medium). The split was settled by the tie rule ("How to read this"): the rule's low clause, "an edge case", fits the corrected claim, as the next two bullets show.
  - Both skeptics narrowed the exposure to a device with an empty leftovers cache, where the shell (`index.html:458`) has never completed one leftovers pull, plus a first pull slower than typing and tapping. On any device that has pulled once, the window is about 36 ms.
  - Only the text being typed is lost; no stored data is touched. That is an edge case under the rule.
  - Skeptic 2 rated it medium, because it is a failed write in the Larder's main flow and the cleared field can look like success.
- **Exposure.** The first open of the Larder on a new or cleared device on a slow network, before the first leftovers pull lands (up to 6 s).
- **Related.** P2-SYNC-17 (critical, F260) shares the root cause, `hub.ready`'s wait of up to 6 s on a cold cache, but not the mechanism.

**What happens now.** The form is live from first paint (`apps/leftovers.html:120-131`). It has no `action`, and its inputs have no `name`. `form.onsubmit` is attached only after `await hub.ready()` (`apps/leftovers.html:172, 289`), which on a cold cache waits up to 6 s (`apps/hub.js:334-337`). Until then the Log button has no label, the size select has no options and the date is blank. Tapping Log submits the form natively as a GET: the frame navigates to the same page with an empty query string (`leftovers.html?`), the name is cleared and nothing is saved.

**Expected.** Submission is blocked from the first byte (a `preventDefault` before `hub.ready`), and an entry made early is queued until the app is ready.

**Why it matters to the household.** The cook types tonight's dish, taps Log, and the page blanks. The item never reaches the list or the 8 am push.

**Evidence.**
- Code: `apps/leftovers.html:120-131, 172, 289`; `apps/hub.js:334-337`; `index.html:458`.
- Runs: `audits/evidence/p3/leftovers/before-ready.json` (A), `audits/evidence/p3/leftovers/verify-submit-before-ready-reloads-1.json`, `audits/evidence/p3/leftovers/verify-submit-before-ready-reloads-2.json`.
- Screenshots: `audits/evidence/p3/leftovers/before-ready-A-typed-iphone.png` (blank Log button, empty size and date while "Early soup" is typed), `audits/evidence/p3/leftovers/verify-submit-before-ready-reloads-2-A-after-tap-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/before-ready.mjs"` (the leftovers GET delayed 9 s). Observed, arm A:
- `stateBeforeReady {tally:"", logText:"", sizeOptions:0, ready:false}`
- `navigations [".../leftovers.html",".../leftovers.html?"]` (the script prints the path from `apps/`)
- `afterTap {url:".../leftovers.html?", name:""}`
- `landedOnServer false`

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-submit-before-ready-reloads-1.mjs"` (typical seed, WebKit, iPhone PWA, Eli; the leftovers GET delayed 9 s for the whole context):
  - A, cold, Log tapped at 1.9 s: `stateAtTap {onsubmitSet:false, logText:"", sizeOptions:0, date:"", ready:false}`. The frame navigated to `leftovers.html?`, the name was "", and the item was neither in localStorage nor on the server.
  - A2, Enter in the name field: the same.
  - W, a warm cache on the same slow link: handler set, item saved.
  - N, cold on a normal network: the frame was seen at 82 ms and the handler set at 118 ms, a 36 ms window.
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-submit-before-ready-reloads-2.mjs"` (every GET to /api/data delayed 8 s):
  - A, a touch tap at 1.67 s: `onsubmitWired:false`, `formAction:null`, inputs unnamed, 0 size options. The frame navigated to `leftovers.html?`, the name was "", and the item was not on the server or in the queue.
  - B, Enter: the same.
  - C, the warm control: saved normally.

**Corrected claim.** The mechanism is exactly as filed, with three refinements:
- Pressing Enter in the name field (`enterkeyhint="done"`, `apps/leftovers.html:122`) triggers it too.
- Only a cold leftovers cache is exposed, and the window lasts until the first pull lands or 6 s pass. The "about 1.5 s" in the original exposure line was only when the rig tapped.
- A successful Log also clears the name, so the person may believe the item was logged (skeptic 2).

#### P3-LEFTOVERS-07 — A device in another time zone writes and reads its own local date

- **Severity: low** (skeptics: low / low; unchanged). Ages and labels are off by one day, only on a device outside Eastern time, in the hours when its local date differs from New York's. No row is lost. No status chip changed in either skeptic's runs, and the Kitchen iPad and the push agree on New York dates.
- **Exposure.** A family member away from Eastern time who logs or views items in those hours.

**What happens now.** `todayStr()` and `daysBetween()` use the device's own zone (`apps/leftovers.html:166-167`). The date box's default and `max` come from `todayStr()` (`apps/leftovers.html:191-193`), and `dateLogged` is a bare date with no zone (`apps/leftovers.html:295`). The Worker uses New York dates throughout (`worker/src/reminders.js:14-19`; chat's `today()`, `worker/src/chat.js:112`).
- Eli's phone in London at 21:30 New York time (02:30 in London) logs 2026-09-23. The Kitchen iPad shows it as "-1d ago · Fresh", and every other item differs by one day between the two devices.
- A phone in Los Angeles at 22:30 local time (01:30 in New York) logs 2026-09-22, which the iPad shows as "1d ago" the moment it is logged.

**Expected.** Household dates in America/New_York, as the Worker computes them with `nyParts` (`worker/src/reminders.js:14-18`).

**Why it matters to the household.** A traveller's new item shows a negative or one-day age at home, and the traveller sees every other item a day older or younger than the kitchen does.

**Evidence.**
- Code: `apps/leftovers.html:166-167, 191-193, 267, 295`; `index.html:679`; `worker/src/reminders.js:14-19`; `worker/src/chat.js:112, 187`.
- Runs: `audits/evidence/p3/leftovers/timezone.json`, `audits/evidence/p3/leftovers/verify-other-timezone-ages-1.json`, `audits/evidence/p3/leftovers/verify-other-timezone-ages-2.json`.
- Screenshots: `audits/evidence/p3/leftovers/tz-london-ipad.png`, `audits/evidence/p3/leftovers/verify-other-timezone-ages-2-london-ipad.png`, `audits/evidence/p3/leftovers/verify-other-timezone-ages-1-la-ipad.png`.

**Reproduction.** Reproduce with `node "audits/tools/phase3/leftovers/timezone.mjs"` (the investigator's script; evidence `audits/evidence/p3/leftovers/timezone.json`, `audits/evidence/p3/leftovers/tz-london-ipad.png`, `audits/evidence/p3/leftovers/tz-los-angeles-ipad.png`) or the skeptics' `verify-other-timezone-ages-1.mjs` / `-2.mjs`. The investigator observed:
- London: server `dateLogged "2026-09-23"`; the New York iPad showed `{"days":"-1","chip":"Fresh","meta":"Medium · logged 2026-09-23 · -1d ago · Eli"}`.
- Los Angeles: the New York iPad showed days "1" for "LA soup".

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-other-timezone-ages-1.mjs"`. It wraps `browser.newContext` so that only a newly paired phone gets Europe/London or America/Los_Angeles; the rig pins every other context to New York.
  - London: the phone's date box showed 2026-09-23, and the server stored that. The iPad showed "-1d ago", the phone 0d. All 6 other items differed by a day (for example Chicken alfredo 8 on the iPad, 9 on the phone).
  - LA: the server stored 2026-09-22, and the iPad showed "1d ago". All 6 others differed the other way (9 / 8).
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-other-timezone-ages-2.mjs"`: London at 21:30 New York, LA at 01:30 New York, and a New York control.
  - London: iPad days -1, meta "Medium · logged 2026-09-23 · -1d ago · Eli"; all 7 other items differed by a day.
  - LA: the phone's date box `max` was its own 2026-09-22; the iPad showed days 1; all 7 others differed.
  - Control: days 0, and 0 of 7 items differed.
  - No status chip differed between the two devices in any case. The bar is clamped at 0 (`apps/leftovers.html:267`).

**Corrected claim.** None needed. Skeptic 2 adds that the traveller's date box `max` is their own local date, so in LA they cannot pick New York's date. The Home widget computes ages the same way (`index.html:679`).

#### P3-LEFTOVERS-08 — The first item logged in the minute after midnight gets yesterday's date

- **Severity: low** (skeptics: low / low; unchanged). The stored date is one day early and is never corrected, so the item turns Aging, Use it up and pushable a day early. No data is lost. It needs a page left open across midnight and a log within at most 60 s of it.
- **Exposure.** A device that kept the Larder open over midnight (the Kitchen iPad), logging in the first minute of the day.

**What happens now.** Submit takes the date box's value (`apps/leftovers.html:295`). The box moves to the new day only on the 60 s rollover tick or on `visibilitychange` (`apps/leftovers.html:364-375`). So "Midnight popcorn", logged at 00:00:11 on Wednesday, was stored as 2026-09-22 and read "1d ago" at once. After the tick, the date box, its `max` and all the ages moved correctly (OK-LEFTOVERS-2).

**Expected.** Submit re-checks the day before it reads the box (the rollover run at the top of the handler).

**Why it matters to the household.** A late snack put away just after midnight starts life a day old.

**Evidence.**
- Code: `apps/leftovers.html:166, 191-193, 289-300, 361-375`.
- Runs: `audits/evidence/p3/leftovers/midnight.json`, `audits/evidence/p3/leftovers/verify-midnight-first-minute-yesterday-1.json`, `audits/evidence/p3/leftovers/verify-midnight-first-minute-yesterday-2.json`.
- Screenshots: `audits/evidence/p3/leftovers/midnight-after-tick-ipad.png`, `audits/evidence/p3/leftovers/verify-midnight-first-minute-yesterday-1.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/midnight.mjs"`. Observed:
- `atTap {now:"Wed Sep 23 2026 00:00:11", dateBox:"2026-09-22", today:"2026-09-22"}`
- Midnight popcorn meta `"Medium · logged 2026-09-22 · 1d ago · Eli"`
- `afterTick dateBox "2026-09-23"`

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-midnight-first-minute-yesterday-1.mjs"` (iPad portrait, Eli, browser clock installed at 23:59:45; `runFor` to 00:00:05, then log, then `runFor` past the tick):
  - At the tap: the date box and the day key still read 2026-09-22.
  - The card read "logged 2026-09-22 · 1d ago", and the server row stored `dateLogged` 2026-09-22.
  - After the tap the box read 2026-09-23 but `max` was still 2026-09-22; after the tick both moved.
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-midnight-first-minute-yesterday-2.mjs"` (iPhone PWA, Mom; clock at 23:59:35; Enter-key submit at 00:00:20):
  - The card read "Medium · logged 2026-09-22 · 1d ago · Elizabeth", and the server stored 2026-09-22.
  - The box and `max` split after the submit in the same way; after the tick at 00:01:20 all moved.

**Corrected claim.** Accurate, with refinements from skeptic 1:
- Only the first item logged in the window gets yesterday's date, because submit then resets the box to `todayStr()` (`apps/leftovers.html:300`).
- The window lasts up to 60 s, depending on where the interval started, and closes early if the page is hidden and shown again.
- Between that first submit and the tick, the box holds today's date while `max` is still yesterday's. Skeptic 2's side note, that a second log in the window may then be blocked by the browser's range check because the form has no `novalidate` (`apps/leftovers.html:120`), has since been tested. In Chromium the second Log was refused with "Value must be 09/22/2026 or earlier." while the box showed 2026-09-23, and nothing was saved until the tick (`audits/evidence/p3/leftovers/critic-midnight-second-log.json`). That symptom is filed as P3-LEFTOVERS-14; one fix (run the rollover at the top of submit) closes both.

#### P3-LEFTOVERS-09 — A future dateLogged is never clamped: it reads "-3d ago", files as Fresh and delays every warning

- **Severity: low** (skeptics: low / low; unchanged). No data is lost and no core flow breaks. The result is a misleading age on a row that already has a future date, plus warnings that come late by the same number of days. The triggers are narrow (below).
- **Exposure.** A future `dateLogged` from chat's `add_list_item` (which depends on the model choosing one), a hand-made API write, or a browser that shows the date box as plain text. A device in a zone ahead of New York is the other source; P3-LEFTOVERS-07 covers it.

**What happens now.** As filed, only the date box's `max` (`apps/leftovers.html:193`) stops a future date; the submit handler never checks it (`apps/leftovers.html:289-297`).
- In Chromium the browser blocks the submit (`rangeOverflow` true, nothing saved).
- In the Windows WebKit rig, `<input type=date>` is a text box, and "Future stew" dated 2026-09-30 was saved.

A future row from any source renders a negative age: `daysBetween` has no clamp (`apps/leftovers.html:167`), and the meta text and aria-label print the raw days (`apps/leftovers.html:265, 268`). Only the bar is clamped (`apps/leftovers.html:267`).

**Expected.** A `dateLogged` after today is rejected by the Worker, and shown as "today" by the app.

**Why it matters to the household.** A future-dated dish shows "-3d ago", sits under Fresh, and its "use it up" warning in the app, on Home and in the push comes three days late.

**Evidence.**
- Code: `apps/leftovers.html:120-128, 167, 193, 265-268, 289-297`; `worker/src/chat.js:31-32, 187`; `worker/src/reminders.js:19, 69`; `index.html:681`.
- Runs: `audits/evidence/p3/leftovers/future-date-webkit.json`, `audits/evidence/p3/leftovers/future-date-chromium.json`, `audits/evidence/p3/leftovers/verify-no-js-date-guard-1.json`, `audits/evidence/p3/leftovers/verify-no-js-date-guard-2.json`.
- Screenshots: `audits/evidence/p3/leftovers/verify-no-js-date-guard-1-chromium-future-card.png`, `audits/evidence/p3/leftovers/verify-no-js-date-guard-2-future-row-chromium.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/future-date.mjs"`, in WebKit and then Chromium. Observed:
- WebKit: `{"typeInfo":{"type":"text"},"landed":true}`
- Chromium: `{"validity":{"valid":false,"rangeOverflow":true},"landed":false}`

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-no-js-date-guard-1.mjs"` in WebKit and Chromium:
  - (A) Fill and tap Log with 2026-09-30: WebKit saved it (`type:'text'`, valid). Chromium blocked it (`rangeOverflow:true`, the name still typed).
  - (B) Calling `form.onsubmit` directly with 2026-10-05 saved the row in both engines. That is a dev-tools path, but it shows the handler has no guard of its own.
  - (C) A row dated 2026-09-25 written through the API as Mom: "Medium · logged 2026-09-25 · -3d ago · Mom", chip Fresh, aria "-3 of 10 days". The form rows read "-8d ago" (A, WebKit only) and "-13d ago" (B).
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-no-js-date-guard-2.mjs"`:
  - WebKit: `engineDateSupport:false`, `dateType:'text'`, saved.
  - Chromium: `dateType:'date'`, `rangeOverflow:true`, nothing saved.
  - A PUT as Mom dated 2026-09-25 rendered `{days:"-3", tone:"fresh", meta:"Medium · logged 2026-09-25 · -3d ago · Mom", chip:"Fresh"}`.

**Corrected claim.** The form part is narrower than filed (skeptic 2; skeptic 1 flags the same rig caveat):
- The WebKit save is a rig artefact: Playwright WebKit on Windows has no date input.
- Every browser the household uses has date inputs, and the form has no `novalidate`, so native validation blocks a future date. Chromium proved it; iOS needs a device check.
- Relying on `max` there is reasonable.

The real, low defect is that nothing clamps a future `dateLogged` once it exists:
- chat accepts any date (`worker/src/chat.js:187`);
- the app prints a negative age and files the row under Fresh;
- its "use it up" warnings in the app, on Home and in the push come late by the same number of days.

#### P3-LEFTOVERS-10 — "Copy failed — select manually" leaves nothing to select (from the visual check)

- **Severity: low** (skeptics: low / low; unchanged from the visual checker's low). Only the failure path of a secondary hand-off is a dead end, and only when both clipboard paths fail. No data is lost, and Claude can still be asked directly. How often a real iPhone or iPad hits this inside the viewer iframe is unknown (Unresolved).
- **Exposure.** Both `navigator.clipboard.writeText` and the `execCommand('copy')` fallback fail. The code comment expects the first to fail in Safari iframes (`apps/leftovers.html:341`).
- **Related.** UX-LEFTOVERS-4 covers the rest of the Hearth block. This was also Phase 1 lead `audits/01-leads.md:143`.

**What happens now.** `copyText` tries the async clipboard and then a selection copy from a textarea that is invisible (`opacity:0`) and removed straight after `execCommand` (`apps/leftovers.html:339-347`). On failure the label reads "Copy failed — select manually" for 2 s and then reverts (`apps/leftovers.html:350-358`). The Hearth text is never shown on the page, so there is nothing to select. The hint "Copy the list below" (`apps/leftovers.html:114`) points down at the button; the list is above it.

**Expected.** On failure the text appears in a visible, pre-selected box (or a share sheet), and the label stays until it is dismissed.

**Why it matters to the household.** The one fallback the app offers tells the person to do something the page makes impossible.

**Evidence.**
- Code: `apps/leftovers.html:113-117, 339-358`.
- Runs: `audits/evidence/p3/leftovers/verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-1.json`, `audits/evidence/p3/leftovers/verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-2.json`.
- Screenshots: `audits/screens/leftovers/copy-error-iphone-safari-dark.png`, `audits/evidence/p3/leftovers/verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-1-failed.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-2.mjs"`. It adds an init script that makes `writeText` reject and `execCommand` return false, then taps `#copy` on the iPhone Safari profile. Observed at 0.2 s: `' Copy failed — select manually'`, textareas 0, Hearth text visible false, selection ''. At 2.3 s the label reads `' Copy list for Hearth'`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-1.mjs"` (iPhone Safari, Eli, with a recorder for appended textareas):
  - `writeText` was called once and `execCommand` once.
  - One textarea was appended, holding "Push these to the Hearth Calendar:\n• Chicken alfredo (Large) — logged 10d ago, use it up …" with `opacity: 0`. It was gone immediately (textarea count 0).
  - 0 matches for the Hearth text in `body.innerText`; `#list` comes before `#copy` in the DOM. The label reverted after 2.3 s.
- **Skeptic 2** ran the `-2-2` script above, plus a control with the real clipboard (`' Copied!'`, then idle at 2.3 s). The failing run matched the Phase 1 capture.

**Corrected claim.** Accurate, with one refinement (skeptic 1). The item cards stay visible above the button, so there is something to select, just not the Hearth text. That text keeps only the aging items (4 of 6), adds a header line and is written for Claude. It existed only in the invisible textarea.

#### P3-LEFTOVERS-11 — Long item names are cut to one line and cannot be read in the Larder (from the visual check)

- **Severity: low** (skeptics: low / low; unchanged). This is readability only: logging and finishing still work, and the first words plus the size and date usually tell items apart. It needs a name of more than about 30 characters on iPhone, or 45-50 on iPad and desktop.
- **Related.** It merges the investigator's own UX item on long names (no `maxlength`; a 599-character name stored whole) and Phase 1 lead `audits/01-leads.md:148`. Both skeptics note the kind could be ux or visual.

**What happens now.** `.nm` is one line with `nowrap`, `overflow: hidden` and an ellipsis (`apps/leftovers.html:75`). The card has no title, no tap handler and no detail view; its only control is the ✓, which deletes (`apps/leftovers.html:254-286`). On iPhone "Forgotten jar of homemade c…" keeps 37% of its name. The name input has no `maxlength` (`apps/leftovers.html:122`): `entry.mjs` typed 599 characters, and all 599 were stored and shown as one clipped line.

**Expected.** A name that does not fit wraps to two lines, or a tap on the card shows it in full (the edit sheet in §7).

**Why it matters to the household.** "Church potluck baked ziti (th…" and "Vegetable fried rice with scra…" hide the part that says which dish it is.

**Evidence.**
- Code: `apps/leftovers.html:75, 122, 254-286`; `index.html:1175`.
- Runs: `audits/evidence/p3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-1.json`, `audits/evidence/p3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-2.json`, `audits/evidence/p3/leftovers/entry.json` (`longName`).
- Screenshots: `audits/screens/leftovers/main-overflow-iphone-pwa-light.png`, `audits/screens/leftovers/main-overflow-ipad-portrait-dark.png`, `audits/evidence/p3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-1-iphone.png`, `audits/evidence/p3/leftovers/entry-long-name-ipad.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-2.mjs"` (overflow seed). For the long names, each `.item .nm` has `scrollWidth > clientWidth`, and no title or other visible element shows the full name. The investigator's `node "audits/tools/phase3/leftovers/entry.mjs"` printed `3 long name: {"typedLength":599,"stored":599,"card":true}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-1.mjs"` (overflow seed, Eli):
  - 16 of 32 cards were truncated on iPhone PWA, 15 of 32 on iPad portrait and 15 of 32 on desktop. The applesauce jar measured `scrollWidth` 612 against `clientWidth` 245.
  - No title on the card or the name, and no handler.
  - Tapping a truncated name changed nothing (`innerHTML` length 43023 before and after, 0 dialogs).
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-2.mjs"`:
  - The same counts, with 37-55% of each name visible on iPhone and 64-94% on iPad and desktop.
  - On iPhone names up to 29 characters fit ("Vegetable fried rice with egg"); 33 characters are cut.
  - The Home fridge card showed the 3 oldest names in full, wrapped.

**Corrected claim.** Accurate, with two qualifications:
- The full name is not wholly unreachable. It is in the ✓'s aria-label (`apps/leftovers.html:279`), so VoiceOver reads it. It also appears in the feed line "Finished the …", but only after the item is deleted (`apps/leftovers.html:309`). The Home card shows the full names of the three oldest items (`index.html:1175`). So "no way to read them" holds inside the Larder, and elsewhere only for items beyond the top three.
- Truncation also happens on iPad and desktop, not only on iPhone. Everyday names under about 30 characters fit on iPhone; the overflow seed's 70-80 character names are the extreme case.

#### P3-LEFTOVERS-12 — A change from another device re-renders the open Larder under the finger, and a single tap removes a different item (from the critic)

- **Severity: critical** (skeptics: critical / critical; the critic's rating). This is rule (a): the shipped ✓ tombstones a family row the user did not choose, for everyone, with no confirm or undo (`apps/leftovers.html:306-311`), in normal two-person use. No dev-tools step is needed: skeptic 2 had Mom finish her item through her own phone's UI and waited for Eli's device to repaint on its own 30 s timer. The narrow timing trigger does not lower the severity; it goes in the Exposure line.
- **Exposure.** A second person finishes an item on another device, and the open Larder repaints (the 30 s pull, a visibility change, reconnect or a `storage` event) between Eli aiming at a ✓ and tapping it. When the finished item is above the target in the same group, the next card's ✓ lands exactly under the finger, for touch and mouse alike. Across a group boundary the point lands on a card body, and touch adjustment in both engines snaps the tap onto that card's ✓. When the leaving item takes its group heading and the banner with it, the layout moves further and nothing was removed (arm A). Untested: a log from another device should shift cards the same way.
- **Related.** The same root cause and the same fix as P3-LEFTOVERS-01 (a full rebuild with no tap guard and no undo), through a trigger that one careful single tap cannot avoid. Not a Phase 2 duplicate: P2-HOME-01 is Home's reminder composer losing typed text on the 30 s re-render, and P2-SYNC-18 is `refreshScope` swapping the store without `onChange`.

**What happens now.** `hub.onChange(render)` (`apps/leftovers.html:378`) runs `render()`, which empties the list (`apps/leftovers.html:217`) and rebuilds every group and card with no animation (`apps/leftovers.html:203-246`). The pull that brings the other device's change runs every 30 s while the page is visible (`apps/hub.js:342`), and on visibility and reconnect; a write from the other window on the same device arrives as a `storage` event (`apps/hub.js:350`). A ✓ tap aimed just before the rebuild lands on whatever is drawn there afterwards, and `done.onclick` → `removeItem` tombstones that row (`apps/leftovers.html:281, 306-311`). In the critic's arm B, Mom finished Beef and bean chili while Eli aimed at Roasted sweet potatoes. After the pull the point was over the Sunday pot roast card; Eli's tap removed Sunday pot roast, and Roasted sweet potatoes stayed.

**Expected.** A tap aimed at one item never removes a different one: ✓ taps are ignored for a moment after any re-render the user did not start (or the card under the finger at `pointerdown` is the one acted on), removals are animated, and any removal can be undone.

**Why it matters to the household.** A dish that is still in the fridge silently leaves the family list, and its 8 am warning stops. Nobody chose it, and the item the person meant to finish is still listed.

**Evidence.**
- Code: `apps/leftovers.html:203-246, 217, 281, 306-311, 378`; `apps/hub.js:244, 342, 350`.
- Runs: `audits/evidence/p3/leftovers/critic-remote-shift.json`, `audits/evidence/p3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-1.json`, `audits/evidence/p3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-2-webkit.json`, `audits/evidence/p3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-2-chromium.json`.
- Screenshots: `audits/evidence/p3/leftovers/critic-remote-shift-B-iphone.png`, `audits/evidence/p3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-1-SAME-iphone.png`, `audits/evidence/p3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-2-C-webkit-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/critic-remote-shift.mjs"` (typical seed, WebKit, iPhone PWA as Eli). The script records the centre of the target ✓, has Mom PUT `value: null` with `updated_at` now to an item above it (the tombstone `hub.remove` writes, `apps/hub.js:244`), calls `hub.pull()` in Eli's frame as the 30 s timer would, sends one touch tap at the recorded point and reads the server rows 4 s later. Observed:
- `B: eliAimedAt "Roasted sweet potatoes", underAfterPull {onDone:false, card:"Sunday pot roast"}, removedByEliTap ["Sunday pot roast"], targetStillOnServer true`
- `A: removedByEliTap []`

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-1.mjs"` (a fresh instance, typical seed, WebKit, iPhone PWA as Eli, a capture-phase click listener in the Larder frame, a reset before each arm):
  - CTRL, no remote change: `clickReceivedBy ["Mark Roasted sweet potatoes used up"]`; only Roasted sweet potatoes removed.
  - B, the critic's arm: `underAfterPull {onDone:false, card:"Sunday pot roast"}`, `clickReceivedBy ["Mark Sunday pot roast used up"]`; Sunday pot roast removed, the target still on the server.
  - SAME, Mom finishes Sunday pot roast and Eli aims at Spaghetti and meatballs: `underAfterPull {onDone:true, card:"Blueberry pancakes"}`; Blueberry pancakes removed, the target still on the server.
  - SAMEMOUSE, the same with a mouse click: Blueberry pancakes removed.
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-2.mjs"` in WebKit and then Chromium. Mom finished her item with a touch tap on her own paired phone, Eli's phone was never told to pull, and the script waited for his own 30 s timer to repaint:
  - C, Mom finishes Sunday pot roast, Eli aims at Spaghetti and meatballs: repainted after 25935 ms (WebKit) and 26251 ms (Chromium); `underAfterRepaint {el:"BUTTON.done", onDone:true, card:"Blueberry pancakes"}`; Blueberry pancakes removed in both engines, the target still on the server.
  - B: `underAfterRepaint {el:"DIV.body", onDone:false, card:"Sunday pot roast"}`; Sunday pot roast removed in both engines.
  - CTRL: only Spaghetti and meatballs removed.

**Corrected claim.** Accurate, and broader than filed:
- It is not a WebKit touch-adjustment artefact. Within a group the next card's ✓ is drawn exactly under the finger, and a touch tap or a mouse click removes it, in WebKit and Chromium. The critic's arm B crosses a group boundary and relies on touch adjustment, which both engines applied.
- It needs no hand-made request and no forced pull: Mom's own UI tap and Eli's own 30 s timer are enough (skeptic 2).
- `hub.onChange(render)` is at `apps/leftovers.html:378`, not 377.

#### P3-LEFTOVERS-13 — A kid's tap on a ✓ removes a family fridge item for everyone, with no undo (from the critic)

- **Severity: critical** (skeptics: high / critical; the critic filed high). The split was settled by the tie rule ("How to read this"). Rule (a) fits the corrected claim: "loss … of household data that the shipped UI can cause in normal household use". A kid opening an app from their own launcher and tapping the biggest control on its cards is normal use, and the write goes through the shipped screen with no dev tools.
  - Skeptic 1's reasons for high were that the feed shows "ezra: Finished …", that an adult can re-log the item by hand, and that each tap removes one item. These are the same recoverability arguments this report already set aside for P3-LEFTOVERS-01.
  - It is not a matter of household taste either. The hub's own chat refuses fridge clean-up to kids (`worker/src/chat.js:52, 161, 339`), so the Larder's ✓ goes around a rule the platform already states.
- **Exposure.** A kid profile (Ezra or Kiara, 4-5, pre-readers) opens the Larder from their own launcher, where it is the first tile, on the family iPad or a kid's phone, and taps a ✓. The only trace is the feed line; an adult has to spot it and re-log the item by hand with its original date.
- **Related.** p2Ref **P2-PROF-05** (medium). Its downgrade rests on "no shipped screen lets a kid send these writes" (`audits/02-shell.md:1269`). The Larder is the first shipped screen that does, so this trigger is new and is owned here; P2-PROF-05 keeps the API-only writes. UX-LEFTOVERS-2 keeps the design side (no pictures, adult type). Phase 1 lead `audits/01-leads.md:134`.

**What happens now.** The Larder has no `visibleTo` (`apps.json:5`), so it is on every kid's launcher, and CLAUDE.md lists it among the kids' apps with no read-only rule (`CLAUDE.md:18`). `canEdit = hub.canWrite` (`apps/leftovers.html:180`), and `canWrite` is false only for the kiosk (`apps/hub.js:115`), so kid mode draws a 48×48 ✓ on every family item (`apps/leftovers.html:275-282`). The app has only kiosk rules (`apps/leftovers.html:18, 96`). One tap runs `removeItem`: `hub.remove` tombstones the row for the whole house and the feed gets "Finished the …", with no confirm and no undo (`apps/leftovers.html:306-311`). Chat, by contrast, leaves `finish_leftover` out of `KID_TOOLS` (`worker/src/chat.js:52`), refuses it to kids (`worker/src/chat.js:161`) and tells the model that fridge clean-up is a grown-up tool (`worker/src/chat.js:339`).

**Expected.** In kid mode (`data-kind="kid"`) the ✓ is hidden or needs an adult, as chat already does; at the least, a removal can be undone. Adding can stay open to kids: chat's `KID_TOOLS` includes `add_list_item`.

**Why it matters to the household.** A pre-reader cannot read which dish a ✓ belongs to. One tap drops food that is still in the fridge from the family list and from the 8 am warning, for everyone.

**Evidence.**
- Code: `apps.json:5`; `apps/leftovers.html:18, 96, 180, 275-282, 306-311`; `apps/hub.js:115`; `worker/src/chat.js:52, 161, 339`; `CLAUDE.md:18`; `audits/02-shell.md:1269`.
- Runs: `audits/evidence/p3/leftovers/kid.json`, `audits/evidence/p3/leftovers/verify-critic-kid-check-removes-family-item-3-1.json`, `audits/evidence/p3/leftovers/verify-critic-kid-check-removes-family-item-3-2.json`.
- Screenshots: `audits/evidence/p3/leftovers/kid-ezra-larder-ipad.png`, `audits/evidence/p3/leftovers/verify-critic-kid-check-removes-family-item-3-2-kiara-iphone-pwa-before.png`, `audits/evidence/p3/leftovers/verify-critic-kid-check-removes-family-item-3-2-eli-after-kids.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/kid.mjs"` (typical seed, iPad portrait, Ezra: Home "Let's play — open your apps" → Larder Ledger tile → one tap on the first ✓). Observed: `page.kind 'kid', canWrite true, doneButtons 6, removedByKidOnServer ["Chicken alfredo"], kidLoggedOnServer true`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-critic-kid-check-removes-family-item-3-1.mjs"`. Mom's phone opened the Larder first; then Ezra, on the Kitchen iPad, went Home → kid apps → Larder tile and tapped the first ✓ once:
  - `htmlKind 'kid'`, `larderTileOnKidLauncher true`; in the app `canWrite true`, 6 checks at 48×48, the Log button 88×52, the add form visible, 0 images and 0 undo controls.
  - Chicken alfredo was removed on the server, the feed read "ezra: Finished the Chicken alfredo", the item was gone from Mom's phone after a pull, and there was no undo in the app or the shell.
  - Rated high.
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-critic-kid-check-removes-family-item-3-2.mjs"` (WebKit; Kiara on a new iPhone PWA device, Ezra on the iPad):
  - Both kids: `data-kind 'kid'`, `canWrite true`, Larder Ledger the first tile on the launcher, and a 48×48 ✓ with the aria-label "Mark <name> used up" on every item.
  - Kiara's tap removed Chicken alfredo and Ezra's removed Beef and bean chili; `undoUi []` and `shellToast []` after each. Eli's own Larder then read "4 in the fridge". Feed: "ezra: Finished the Beef and bean chili", "kiara: Finished the Chicken alfredo".
  - Rated critical.

**Corrected claim.** The core claim holds, and it is not iPad-only (Kiara's iPhone does the same). Three corrections:
- The ✓s are the only large controls on the cards, not on the page: the add bar's Log button (88×52) and the mic are as large.
- A kid adding an item ("asdfgh") is not data loss, and chat deliberately lets kids add (`KID_TOOLS` includes `add_list_item`, `worker/src/chat.js:52`). That part stays ux, under UX-LEFTOVERS-2.
- Finishing is not a household-taste question: the platform's own chat treats fridge clean-up as a grown-up action.

#### P3-LEFTOVERS-14 — After one Log in the minute after midnight, the next Log is refused with "must be yesterday or earlier" while the box shows today (from the critic)

- **Severity: low** (skeptics: low / low; the critic's low). No data is lost: the typed name stays in the field, and the same Log saves with today's date once the rollover runs (at most 60 s after midnight, or on a visibility change). That is an edge case under the rule.
- **Exposure.** The Larder left open across midnight (the Kitchen iPad), and a second Log in the up-to-60 s before the minute tick. Chromium refuses it; iPad and iPhone Safari need a device check (the Windows WebKit rig has no date input).
- **Related.** The same root cause as P3-LEFTOVERS-08 (submit never runs the rollover) and the same fix. Skeptic 2 suggested filing it as a second symptom of P3-LEFTOVERS-08; it has its own ID because the visible failure differs (a refused Log, not a wrong date), and the two point at each other. Not a Phase 2 duplicate: P2-STAB-03 and P2-STAB-07 cover midnight in Prayer, F260 and Kid Verse.

**What happens now.** `max` is set once at load (`apps/leftovers.html:191-193`) and moved only by `rollover()`, on the 60 s tick or `visibilitychange` (`apps/leftovers.html:364-375`). Submit resets the date box to `todayStr()` without touching `max` (`apps/leftovers.html:300`), and the form has no `novalidate` (`apps/leftovers.html:120`). So after the first Log after midnight the box reads the new day while `max` still reads the old one, and the browser's range check refuses the next submit, by a tap or by Enter, with "Value must be 09/22/2026 or earlier." while the box shows 09/23. The name stays typed, focus jumps to the date box, and the app's own error line stays empty.

**Expected.** Submit re-keys the day (`rollover()`) before it reads or resets the date box, or sets `max` together with the value at line 300, so value and `max` never disagree.

**Why it matters to the household.** Right after midnight the cook's second dish will not save, and the only message blames the date that the box shows as today.

**Evidence.**
- Code: `apps/leftovers.html:120, 191-193, 289-300, 364-375`.
- Runs: `audits/evidence/p3/leftovers/critic-midnight-second-log.json`, `audits/evidence/p3/leftovers/verify-critic-midnight-second-log-blocked-2-1.json`, `audits/evidence/p3/leftovers/verify-critic-midnight-second-log-blocked-2-2.json`.
- Screenshots: `audits/evidence/p3/leftovers/critic-midnight-second-log-chromium-ipad.png`, `audits/evidence/p3/leftovers/verify-critic-midnight-second-log-blocked-2-1-chromium-ipad-portrait-click.png`, `audits/evidence/p3/leftovers/verify-critic-midnight-second-log-blocked-2-2-blocked.png`. Headless screenshots do not paint the native error bubble.

**Reproduction.** `node "audits/tools/phase3/leftovers/critic-midnight-second-log.mjs"` (Chromium, then WebKit; iPad portrait, Eli; browser clock at Tue 22 Sep 2026 23:59:50 New York; `runFor` 15 s; log "First after midnight"; `runFor` 2 s; log "Second after midnight"). Observed in Chromium:
- `between {value:"2026-09-23", max:"2026-09-22", valid:false, rangeOverflow:true, msg:"Value must be 09/22/2026 or earlier."}`
- `afterSecond {nameStillTyped:"Second after midnight", cards:["First after midnight"]}`
- `afterTick {value:"2026-09-23", max:"2026-09-23", valid:true}`; the server held only "First after midnight", dated 2026-09-22.

WebKit (a text box on Windows) saved the second item: a rig artefact.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-critic-midnight-second-log-blocked-2-1.mjs"` (clock at 23:59:50, `runFor` to 00:00:05, "Midnight A", then "Midnight B" sent three ways):
  - Chromium iPad (tap Log) and Chromium desktop (Enter): the box read `{value:"2026-09-23", max:"2026-09-22", valid:false, rangeOverflow:true}`; after the second Log `{nameField:"Midnight B", cards:["Midnight A"], focused:"date"}`. After the tick the box was valid, and a retry saved the item. Server: Midnight A 2026-09-22, Midnight B 2026-09-23.
  - WebKit: `type 'text'`, saved at once (rig artefact).
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-critic-midnight-second-log-blocked-2-2.mjs"` (Chromium; Mom on a second paired iPhone PWA; clock at 23:59:40; Enter to submit):
  - After the second submit (00:00:11): one `invalid` event, "Soup two" still in the name box, the app's `#err` empty, and only "Soup one" shown.
  - After the tick (00:01:11) the day key, value and `max` were all 2026-09-23; a retry showed both soups. Server: Soup one 2026-09-22, Soup two 2026-09-23.

**Corrected claim.** Accurate. It is blocked by a tap and by Enter, focus moves to the date box, and a retry after the tick saves with today's date. It was confirmed in Chromium (desktop Chrome and Edge); iPad and iPhone Safari need a device check.

#### P3-LEFTOVERS-15 — The add bar's 12 px error line is below AA in Hearth (from the critic)

- **Severity: low** (skeptics: low / low; the critic's low). One short-lived 12 px line is below the AA minimum; no data is lost and typing still works.
- **Exposure.** The Hearth palette (the default), and Parchment at its darkest backdrop pixels, whenever the voice error shows ("Couldn't hear that — try again or type it.", `apps/leftovers.html:322`) on a device with speech recognition. The kiosk-nudge line (`apps/leftovers.html:293`) never shows, because the kiosk hides the whole form (`apps/leftovers.html:96`).
- **Related.** It corrects this report's earlier claim that every text pair passes AA (Summary, VIS-LEFTOVERS-2, OK-LEFTOVERS-3, §6). Not a Phase 2 duplicate: the only contrast ID in the Phase 2 register is P2-VIS-06, the dark-mode Home hero.

**What happens now.** `.err` is 12 px in `var(--danger)` (`apps/leftovers.html:63`), which is the terra tone, not `--danger-ink` (`apps/design.css:82`). It sits at the bottom of the glass add bar (`apps/leftovers.html:33-45, 130`). The critic's token maths gave 4.35:1 in Hearth over the page and 4.41:1 over a card, below the 4.5:1 that text of this size needs. Parchment was 4.53-4.61, Frost 4.70-4.77, and Midnight and Forest 6.3-6.5.

**Expected.** The error line uses `--danger-ink`, as design.css's own danger components do (`apps/design.css:364, 513`), at 13 px or more. `--danger-ink` measured 7.11:1 on the same Hearth bar (skeptic 1).

**Why it matters to the household.** The one line that says why a voice entry failed is the hardest text in the app to read, at the bottom of a translucent bar.

**Evidence.**
- Code: `apps/leftovers.html:33-45, 63, 96, 130, 179, 293, 322`; `apps/design.css:56, 82, 364, 513`.
- Runs: `audits/evidence/p3/leftovers/critic-err-contrast.json`, `audits/evidence/p3/leftovers/verify-critic-err-line-below-aa-hearth-4-1.json`, `audits/evidence/p3/leftovers/verify-critic-err-line-below-aa-hearth-4-2.json`.
- Screenshots: `audits/evidence/p3/leftovers/critic-err-contrast-hearth-iphone.png`, `audits/evidence/p3/leftovers/verify-critic-err-line-below-aa-hearth-4-1-hearth-bar.png`, `audits/evidence/p3/leftovers/verify-critic-err-line-below-aa-hearth-4-2-at-rest.png`.

**Reproduction.** `node "audits/tools/phase3/leftovers/critic-err-contrast.mjs"` (typical seed, iPhone PWA, Eli). For each palette it sets `data-theme` on the Larder frame, unhides `#err` with the voice-error text, reads the computed colours and computes WCAG contrast with alpha compositing. Printed: `hearth {errPx:'12px', err_on_glass_over_bg:4.35, err_on_glass_over_card:4.41}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/leftovers/verify-critic-err-line-below-aa-hearth-4-1.mjs"`. It decoded screenshot pixels of the rendered glass beside the text (blur, sheen, pickup and the list behind the bar included), independently of the critic's token maths:
  - Hearth: 4.37 against the median backdrop, 4.41 against the lightest and 4.22 against the darkest; `--danger-ink` 7.11.
  - Parchment 4.57 (darkest 4.38); Frost 4.77 (darkest 4.60); Midnight and Forest 6.39.
- **Skeptic 2** ran `node "audits/tools/phase3/leftovers/verify-critic-err-line-below-aa-hearth-4-2.mjs"`. It stubbed `webkitSpeechRecognition` to fire `no-speech` and tapped `#mic`, so the line appeared through the real `onError` → `setErr` path, then decoded the `#err` box's pixels:
  - At rest 4.37 (4.22-4.41); with cards behind the bar 4.30 (4.23-4.34); scrolled to the end 4.30.
  - The kiosk never shows the form (`display: none`, `apps/leftovers.html:96`).

**Corrected claim.** The `.err` rule is at line 63, not 62. Measured from real pixels after the real voice-error path, Hearth renders at 4.22-4.41:1. Parchment's darkest backdrop pixels also fall below AA (4.38); Frost passes narrowly. The only real trigger is a failed voice capture.

### Usability, visual and gap findings

These were not adversarially verified. Items marked "from the visual check" were added by the independent visual checker.

**UX**

- **UX-LEFTOVERS-1 — One tap on ✓ deletes a family item for everyone, with no undo, no confirm and no completed history** (high; the investigator's rating, not verified).
  - `removeItem` writes a tombstone and posts "Finished the X" (`apps/leftovers.html:306-311`). There is no toast, no undo and no "Show completed".
  - The feed line is the only trace, and it cannot restore the item.
  - A mis-tap on the 48 px ✓ beside the chip loses the item for the whole house. Reminders keeps completed items reachable ("Show Completed", support.apple.com/en-us/102484).
  - Confirmed worst case: P3-LEFTOVERS-01. Phase 1 lead `audits/01-leads.md:133`.
  - Evidence: `apps/leftovers.html:275-283, 306-311`; `audits/evidence/p3/leftovers/doubletap.json` (`undoUi: false` in every arm); `audits/screens/leftovers/finished-typical-iphone-pwa-light.png`.
- **UX-LEFTOVERS-2 — Kids get the full adult page: a ✓ on every family item, the add bar, the mic and the Hearth block, in small type with nothing to recognise** (high; the investigator's rating, not verified).
  - The app has no `data-kind="kid"` rules (only kiosk ones, `apps/leftovers.html:18, 96`), and `canEdit = hub.canWrite` (`apps/leftovers.html:180`), which is true for kids.
  - Ezra reaches the Larder in 2 taps and sees 6 ✓ buttons, the form, the mic and the Hearth copy.
  - Text is 16 / 12.5 / 11.5 px, although the kid token `--fs-md` is 19 px: the app sizes in px, so the kid type scale never reaches it. Only the card radius changes, because kid mode raises `--r-sm` to 16 px (`apps/design.css:283`; checker's correction).
  - Items have no pictures or icons (images 0), so a pre-reader cannot tell pancakes from chili.
  - The only big controls on the cards are the ✓ buttons; the add bar's Log button (88×52) and mic are as large. One ✓ removed Chicken alfredo on the server (feed "ezra: Finished the Chicken alfredo"). That data side is now a verified defect, **P3-LEFTOVERS-13 (critical)**. He also logged "asdfgh"; adding stays a ux matter, since chat deliberately lets kids add (`worker/src/chat.js:52`).
  - Phase 2 noted the same UI (`audits/02-shell.md:1636`); p2Ref P2-PROF-05. Phase 1 lead `audits/01-leads.md:134`.
  - Evidence: `apps.json:5`; `apps/leftovers.html:18, 96, 180, 275`; `audits/evidence/p3/leftovers/kid.json`; `audits/evidence/p3/leftovers/kid-ezra-larder-ipad.png`; `audits/screens/leftovers/kid-typical-ipad-portrait-light.png`.
  - Run: `node "audits/tools/phase3/leftovers/kid.mjs"`. Observed: `page.kind 'kid', canWrite true, doneButtons 6, formShown true, fontPx name 16px meta 12.5px chip 11.5px, kidTokenFsMd 19px, images 0, removedByKidOnServer ["Chicken alfredo"], kidLoggedOnServer true`.
- **UX-LEFTOVERS-3 — Nothing in the Larder can be read from 2 m on the Kitchen iPad** (medium).
  - Cap heights on the 11" iPad (0.1924 mm per CSS px, canvas `measureText('H')`), against Phase 2's H1 (cap ≥ distance/200: 10 mm at 2 m) and H2 (≥ distance/344: 5.8 mm at 2 m), `audits/02-shell.md:519-520`:
    - the 28 px title: 3.85 mm;
    - item names (16 px): 2.31 mm;
    - chips, group titles and meta: 1.73 mm;
    - group subtitles: 1.35 mm.
  - Every string fails both heuristics at 2 m and 3 m, and there is no iPad or ambient scale.
  - The state that matters is a 13 px banner reading "1 item at a week or older" (`apps/leftovers.html:213`); the investigator's quote "1 to use up" was wrong (checker).
  - The investigator's p2Ref P2-VIS-06 (dark-mode Home hero contrast) does not fit. The related Phase 2 item is UX-HOME-1.
  - Evidence: `apps/leftovers.html:23, 30, 75, 82`; `audits/evidence/p3/leftovers/visual.json` (`type`); `audits/screens/leftovers/main-typical-ipad-portrait-light.png`.
  - Run: `node "audits/tools/phase3/leftovers/visual.mjs"`. Observed: `h1 {"px":28,…"capMm":3.85,…"at2m":"fail"}`, `name {"px":16,…"capMm":2.31,…"at2m":"fail"}`.
- **UX-LEFTOVERS-4 — "Copy list for Hearth" tells people to ask Claude for something the hub's Claude cannot do** (medium).
  - The block says to copy, then tell Claude "push my leftovers to Hearth", and that "it'll add them straight to the Hearth Calendar" (`apps/leftovers.html:114-115`). The hub's Chat tab is Claude, but the Worker has no Hearth tool: 0 occurrences of "hearth" in `worker/src`.
  - "Hearth" is also the name of the default palette.
  - The button uses the refresh icon (`apps/leftovers.html:152, 352`).
  - It stays live on an empty fridge, where it copies "Nothing aging right now — fridge's in good shape." (`apps/leftovers.html:331`).
  - It is the first thing below the list and runs behind the add bar on iPhone.
  - The failure path is P3-LEFTOVERS-10. Phase 1 lead `audits/01-leads.md:143`.
  - Evidence: `apps/leftovers.html:113-117, 328-358`; `audits/evidence/p3/leftovers/roles.json` (`hearthInWorker: 0`); `audits/evidence/p3/leftovers/roles-hearth-copied-iphone.png`; `audits/screens/leftovers/copy-typical-iphone-pwa-light.png`.
  - Run: `node "audits/tools/phase3/leftovers/roles.mjs"`.
- **UX-LEFTOVERS-5 — Log with an empty name does nothing, with no message and no focus** (low).
  - `if (!name) return;` (`apps/leftovers.html:291-292`), and the input has no `required`.
  - Evidence: `audits/evidence/p3/leftovers/entry.json` (`emptyName {"cardsBefore":7,"cardsAfter":7,"errShown":false,"focusOn":""}`).
- **UX-LEFTOVERS-6 — After Log there is no confirmation, and the new card can land under the add bar** (low).
  - The field clears and the count changes, but there is no toast and no scroll (`apps/leftovers.html:298-303`).
  - The new "Taco soup" card is hidden under the bar on four of the five devices, measured with `taps.mjs`'s method (card rect against the bar's rect in the frame, no scroll):
    - iPhone PWA: card top 872, bar top 742.
    - iPhone Safari: card top 872, bar top 550.
    - iPad landscape: card top 799, bar top 630.
    - Desktop: card top 799, bar top 710.
    - iPad portrait is the only one where it shows (card 799-883, bar top 990).
  - From the visual check: on iPad landscape a queued (offline) item also lands under the bar. The count reads 7 and Fresh 4, but only one Fresh card shows (`audits/screens/leftovers/queued-offline-ipad-landscape-light.png`).
  - Phase 1 lead `audits/01-leads.md:138`.
  - Evidence: `audits/evidence/p3/leftovers/taps.json` (`newCardOnScreen`); `audits/evidence/p3/leftovers/critic-followups.json` (`newCard`, all five devices); `audits/evidence/p3/leftovers/taps-logged-iphone-pwa.png`; `audits/evidence/p3/leftovers/critic-followups-logged-iphone-safari.png`; `audits/evidence/p3/leftovers/critic-followups-logged-desktop.png`; `audits/screens/leftovers/logged-typical-iphone-pwa-light.png`.
  - Run: `node "audits/tools/phase3/leftovers/critic-followups.mjs"`. Observed: `newCard iphone-safari {"cardTop":872,"barTop":550,"visibleAboveBar":false}`, `newCard desktop {"cardTop":799,"barTop":710,"visibleAboveBar":false}`.
- **UX-LEFTOVERS-7 — An item logged or finished offline looks exactly like a synced one; the only cue is a 12 px amber line** (low).
  - `itemCard` has no pending state (`apps/leftovers.html:249-287`), and the status line is 12 px (`apps/leftovers.html:26-27, 183-187`).
  - After reconnecting, the change converged in about 27 s (OK-LEFTOVERS-2).
  - Phase 1 lead `audits/01-leads.md:139`.
  - Evidence: `audits/evidence/p3/leftovers/sync.json` (`pendingMarker: false`, `fontPx "12px"`); `audits/evidence/p3/leftovers/sync-offline-queued-iphone.png`.
  - Run: `node "audits/tools/phase3/leftovers/sync.mjs"`.
- **UX-LEFTOVERS-8 — The sync error line shows a raw server code ("internal.") with no retry** (low; the visual checker filed the same).
  - `'The house list had a problem: ' + lastError` (`apps/leftovers.html:185`) renders "The house list had a problem: internal." in 12 px amber, quieter than the red banner below it.
  - Phase 1 lead `audits/01-leads.md:140`.
  - Evidence: `audits/screens/leftovers/main-error-iphone-pwa-light.png`.
- **UX-LEFTOVERS-9 — The red banner names no item and cannot be tapped** (low).
  - It is plain text, "N items at a week or older" (`apps/leftovers.html:207-215`). A 63-day-old jar and an 8-day-old dish get the same line.
  - Phase 1 lead `audits/01-leads.md:142`.
  - Evidence: `audits/screens/leftovers/main-overflow-iphone-pwa-light.png` ("10 items at a week or older").

**Visual**

- **VIS-LEFTOVERS-1 — While loading, the Log and Copy buttons are empty boxes and the size and date fields are blank** (low).
  - Labels and options are filled in only after `hub.ready` (`apps/leftovers.html:189-196, 349-359`). There is no skeleton.
  - Phase 1 lead `audits/01-leads.md:141`.
  - Evidence: `audits/screens/leftovers/main-loading-iphone-pwa-light.png`; `audits/evidence/p3/leftovers/before-ready.json` (`logText:"", sizeOptions:0`).
- **VIS-LEFTOVERS-2 — The amber freshness bar is under 3:1 against its track in Hearth and Parchment; the state tints are close under colour-blindness** (low).
  - Bar tint against track (non-text): warn 2.69 (Hearth), 2.83 (Parchment), 3.19 (Frost); urgent and fresh 3.56-3.99 in the light palettes.
  - The bar's left end is lighter still, because it is mixed with literal `white` (`apps/leftovers.html:80`).
  - Under simulated deuteranopia the three tints differ by only 1.04-1.46 in luminance ratio across the five palettes (Hearth 1.13-1.46).
  - Even with normal colour vision, the Use it up and Fresh tints have the same luminance in all three light palettes (1.00:1), and Aging and Fresh are 1.02-1.03:1 in the dark palettes (`visual.json` `cvd.normal`). So in greyscale, in glare on the Kitchen iPad, or with low colour sensitivity, the stripes and bars of those two states cannot be told apart at all. Under protanopia the pairs differ by 1.07-1.53 (`cvd.protan`).
  - The states stay distinguishable through text (chip labels, group headings), but not by colour alone at a glance, nor for pre-readers.
  - Every list, chip and status text pair passes 4.5:1 in all five palettes (lowest 4.9). The exception is the add bar's 12 px error line, which is 4.35:1 in Hearth (P3-LEFTOVERS-15; `audits/evidence/p3/leftovers/critic-err-contrast.json`).
  - Evidence: `apps/leftovers.html:78-80, 138-142`; `audits/evidence/p3/leftovers/visual.json` (`pairs`, `cvd`); `audits/evidence/p3/leftovers/visual-hearth-ipad.png`; `audits/evidence/p3/leftovers/visual-parchment-ipad.png`.
- **VIS-LEFTOVERS-3 — In the dark palettes the status chips lose their pill: the fill stands 1.01-1.08:1 from the card** (low).
  - The chip fills are `*-soft` tokens that are near-black in Midnight and Forest, so "Use it up" reads as loose pink text rather than a glowing pastel pill. That breaks the house "never muddy" rule.
  - Chip text contrast itself is fine (8.9-10.3:1).
  - Evidence: `apps/leftovers.html:82, 138-142`; `audits/evidence/p3/leftovers/visual.json`; `audits/evidence/p3/leftovers/visual-midnight-ipad.png`; `audits/screens/leftovers/main-typical-ipad-portrait-dark.png`.
- **VIS-LEFTOVERS-4 — The person's colour reaches only the add bar's glass tint; a card shows who logged it only as a name** (low).
  - `--accent` differs by profile (Eli #4F5D8C, Mae #BC5A38), but `form#add` is the only element whose paint differs: the glass pickup (`apps/leftovers.html:39`).
  - `byName` is plain text in the meta line (`apps/leftovers.html:265`), with no avatar or initial, although `hub.avatarHtml` exists.
  - Evidence: `audits/evidence/p3/leftovers/accent-and-tells.json`; `audits/evidence/p3/leftovers/accent-eli-ipad.png`; `audits/evidence/p3/leftovers/accent-mae-ipad.png`.
  - Run: `node "audits/tools/phase3/leftovers/accent.mjs"`.
- **VIS-LEFTOVERS-5 — Default form controls in the glass bar: a native grey select and raw ISO dates** (low).
  - The select keeps `appearance: auto` (`apps/leftovers.html:52-53`), so it shows a native grey control that does not match its siblings, and is lighter in dark mode.
  - Dates are raw ISO in the meta line ("logged 2026-09-14 · 8d ago"), and today reads "0d ago" (`apps/leftovers.html:265`).
  - Phase 1 leads `audits/01-leads.md:149` and `audits/01-leads.md:152`.
  - Evidence: `audits/evidence/p3/leftovers/accent-and-tells.json` (`select {"appearance":"auto",…}`); `audits/screens/leftovers/add-typical-iphone-pwa-light.png`; `audits/screens/leftovers/main-typical-ipad-portrait-dark.png`.
- **VIS-LEFTOVERS-6 — The fixed add bar covers cards and the Hearth block, and the list is read through it** (low).
  - The bar is about 130 px of fixed `glass-strong` (`apps/leftovers.html:33-45`).
  - On iPhone, cards 5-7 sit under it (their ✓ at y 784-970, with the bar's top at 799). On iPhone Safari it takes about 140 of 740 px and hides the Fresh heading (checker).
  - Card text shows through it on iPad landscape and desktop.
  - The column is capped at 560 px (`apps/leftovers.html:19, 36`), so iPad landscape and desktop leave more than half the width empty.
  - Phase 1 leads `audits/01-leads.md:146` and `audits/01-leads.md:147`.
  - Evidence: `audits/evidence/p3/leftovers/taps.json` (`addBar {top:799}`; Spaghetti and meatballs `checkCenterY 784`, `tappableWithoutScroll false`); `audits/screens/leftovers/main-typical-ipad-landscape-light.png`; `audits/screens/leftovers/add-typical-ipad-landscape-dark.png`; `audits/screens/leftovers/finished-typical-iphone-pwa-light.png`; `audits/screens/leftovers/main-typical-iphone-safari-light.png`.
- **VIS-LEFTOVERS-7 — The empty-state fridge art is a pale hard-coded SVG that stands out in dark mode** (low).
  - `art/empty/fridge.svg` is loaded as an `<img>` (`apps/leftovers.html:224`), so tokens cannot reach its pale fills (`art/empty/fridge.svg:2, 6`).
  - The checker agreed only partly: the art is bright on near-black but small, so "glares" overstates it a little.
  - Phase 1 lead `audits/01-leads.md:153`.
  - Evidence: `audits/screens/leftovers/main-empty-ipad-portrait-dark.png`.
- **VIS-LEFTOVERS-8 — No press scale, spring, toast or sheet: every action is an instant re-render** (low).
  - The `:active` rules change the background only (`apps/leftovers.html:57, 85, 95`). The ✓ has transition 0s and transform none.
  - A finished card vanishes with no animation.
  - The bar's 0.8 s width transition (`apps/leftovers.html:80`) never plays, because each render creates the bars at their final width (`apps/leftovers.html:203-246, 267`): 0 running animations after open, after a re-render and after a ✓. The mic pulse (1 s, `apps/leftovers.html:61`) is the only motion on the page.
  - Evidence: `audits/evidence/p3/leftovers/accent-and-tells.json` (`doneBtn {"transition-duration":"0s","transform":"none"}`, `pressRules`); `audits/evidence/p3/leftovers/critic-bar-motion.txt`.
  - Run: `node "audits/tools/phase3/leftovers/critic-bar-motion.mjs"`. Observed: `{"afterOpen":0,"afterRender":0,"afterDone":0,"transitionCss":"width 0.8s cubic-bezier(0.2, 0.7, 0.2, 1)"}`.
- **VIS-LEFTOVERS-9 — Two identical refresh glyphs on one screen do different things** (low; from the visual check).
  - The shell top bar's reload and the Larder's Copy button both use the circular-arrows glyph (`apps/leftovers.html:152, 352`).
  - Evidence: `audits/screens/leftovers/main-typical-ipad-portrait-light.png`; `audits/screens/leftovers/main-empty-iphone-pwa-light.png`.
- **VIS-LEFTOVERS-10 — In dark mode the ✓ buttons are black recessed wells** (low; from the visual check).
  - The ✓ uses `--surface-2` (`apps/leftovers.html:83`), which is darker than the card in the dark palettes, so the main action looks like a hole rather than a glowing control.
  - Evidence: `audits/screens/leftovers/main-typical-ipad-portrait-dark.png`; `audits/evidence/p3/leftovers/visual-forest-ipad.png`.
- **VIS-LEFTOVERS-11 — The name field shrinks by 60 px when the mic appears after ready** (low; from the visual check).
  - While loading the mic is hidden (`apps/leftovers.html:123`). After ready it appears (`apps/leftovers.html:315-316`), the name field narrows, and the iPhone placeholder is cut to "Chicken alf".
  - It is a layout shift in the control bar. The squeeze itself is part of the PWA-UX-3 pointer.
  - Evidence: `audits/screens/leftovers/main-loading-iphone-pwa-light.png` against `audits/screens/leftovers/main-typical-iphone-pwa-light.png`.

**Gap**

- **GAP-LEFTOVERS-1 — No way to fix a mistake or give a food its own use-by: no edit and no per-item expiry** (medium).
  - Items can only be added or removed. A wrong date or size needs delete and re-add, which loses "logged by".
  - Every food ages on the same 4/7-day rule (`apps/leftovers.html:137`).
  - Reminders has editable due dates (support.apple.com/en-us/102484), and NoWaste and Fridgely track a use-by per item.
  - Evidence: `apps/leftovers.html:249-311` (the card renders a ✓ only; no edit handler). NOT FOUND IN CODE: an edit or expiry field.

**What works**

- **OK-LEFTOVERS-1 — The kiosk is read-only in both the UI and the server; guests work like adults** (info).
  - As Downstairs TV: the form and the Hearth block are hidden, there are 0 ✓ buttons, and a PUT returns 403 `read_only` (`apps/leftovers.html:18, 96, 275`).
  - Guest Grandma Jo can log and finish (7 ✓ buttons).
  - Evidence: `audits/evidence/p3/leftovers/roles.json`; `audits/evidence/p3/leftovers/roles-kiosk-larder-tv.png`.
- **OK-LEFTOVERS-2 — Two-device sync, the offline queue and the midnight rollover work** (info).
  - Mae's phone item appeared on the open iPad in 28.8 s, without a reload.
  - An offline add and finish converged 27.1 s after reconnecting.
  - At midnight the date box, its `max` and the ages move on the minute tick (`apps/leftovers.html:361-378`).
  - Evidence: `audits/evidence/p3/leftovers/sync.json`; `audits/evidence/p3/leftovers/midnight.json`.
- **OK-LEFTOVERS-3 — Every colour is a design.css token, and every list and chip text pair passes AA in all five palettes** (info).
  - 0 hex, 0 `prefers-color-scheme` and 0 hub.js bypasses.
  - The lowest rendered list and chip text contrast is 4.9 (Hearth), 4.99 (Parchment), 4.95 (Frost), 5.6 (Midnight) and 5.39 (Forest). The sync line passes too (5.72-12.29).
  - Not the add bar's 12 px error line, which `visual.json` never measured: 4.35:1 in Hearth (P3-LEFTOVERS-15).
  - Evidence: `audits/evidence/p3/_compliance/leftovers.json`; `audits/evidence/p3/leftovers/visual.json` (`rendered`); `audits/evidence/p3/leftovers/critic-err-contrast.json` (`mode_on_page`, `err_on_glass_over_bg`).

### Checked and not a bug

None. No bug, security or perf finding was refuted: all 15 sent to skeptics (8 from the investigator, 3 from the visual check and 4 from the critic) were confirmed 2/2. Four claims were narrowed rather than refuted:
- The "three thresholds" of P3-LEFTOVERS-02 are two cut-offs plus wording; the 5-day push is documented and intended.
- The form path of P3-LEFTOVERS-09 is blocked by native validation in real browsers. The WebKit save was a rig artefact.
- The kiosk-nudge trigger of P3-LEFTOVERS-15 cannot happen: the kiosk hides the whole form (`apps/leftovers.html:96`).
- P3-LEFTOVERS-13's "the ✓s are the only large controls" holds for the cards only, and a kid adding an item is not data loss.

### Unresolved — needs a device or more evidence

No verified finding is unresolved. Open questions:
- **UX-LEFTOVERS-2's data facet** is now settled: two skeptics confirmed it as **P3-LEFTOVERS-13** (critical, p2Ref P2-PROF-05).
- **P3-LEFTOVERS-14 on iOS.** Whether iPad and iPhone Safari also refuse the second Log on `rangeOverflow`. To settle it, keep the Larder open over midnight on a Home Screen app and log two items in the first minute.
- **P3-LEFTOVERS-12 from a log.** Whether a new item logged on another device (a card inserted above the target) shifts a pending tap the same way. Not tested.
- **A longer-lasting empty fridge (P3-LEFTOVERS-05 side lead).** In two early runs, which only the console recorded, skeptic 1 saw sync reach 'synced' at about 9.2 s while the Larder kept "0 in the fridge" and no status line until sampling ended. A plausible race: `refreshScope` adopts the shell's fresh cache, so no change event fires (`apps/hub.js:190-195, 283-284, 356-361`). To settle it, repeat the SLOW9 arm 10 or more times, sampling to 30 s and logging `storage` events.
- **P3-LEFTOVERS-01 on a real iPhone and iPad.** How far apart real double-taps land, and whether both reach the page. The skeptics argue the rig is conservative. To settle it, double-tap a ✓ on the device and read the server rows.
- **P3-LEFTOVERS-09 on iOS.** Whether the iOS date picker and form validation block a date after today. To settle it, pick or type a future date in the Larder's date box on an iPhone and tap Log.
- **P3-LEFTOVERS-10 on iOS.** How often both clipboard paths fail inside the viewer iframe, in Safari and as a Home Screen app. To settle it, tap "Copy list for Hearth" on both.
- **P2-PWA-13.** Whether the doubled "Finished the Sunday pot roast" feed line in the double-click arms is that defect. Not isolated.

## 5. Visual fidelity

### Rubric scores

| Dimension | Investigator | Checker | Final | Provisional? | Reason | Evidence |
|---|---|---|---|---|---|---|
| Typography | 5 | 5 | **5** | Yes (fallback fonts in the rig) | The bold serif title with tight tracking has character. Below it the text sits off Dynamic Type: 16 px names, 12.5 px meta, 11.5 px chips, a 12 px mono uppercase tally and 11 px mono group subtitles (checker: only those two are mono uppercase). Nothing grows on the iPad or in kid mode. | `audits/screens/leftovers/main-typical-iphone-pwa-light.png`, `audits/screens/leftovers/main-typical-ipad-portrait-dark.png`, `audits/screens/leftovers/kid-typical-ipad-portrait-dark.png` |
| Color & palette | 5 | 4 | **4** | No | Careful, token-driven contrast (list and chip text 4.9-14.7:1; the add bar's 12 px error line is the exception at 4.35:1 in Hearth, P3-LEFTOVERS-15, found after scoring and not re-scored). But the states are low-chroma olive, gold and terra on paper, not house pastels; the size select is a grey no palette owns; the warn bar is 2.69:1 on its track; dark chip fills are 1.01-1.08. The chips carry text, so hue is not the only cue. In line with the shell's 4 for the same Hearth tokens. | `audits/screens/leftovers/main-typical-ipad-portrait-light.png`, `audits/evidence/p3/leftovers/visual-hearth-ipad.png`, `audits/evidence/p3/leftovers/visual-midnight-ipad.png` |
| Layout & spacing | 5 | 5 | **5** | No | The grouped list reads top-down with 16 px phone margins and even 10 px gaps. The 560 px column leaves more than half of iPad landscape and desktop empty. The fixed bar hides cards on iPhone and the logged or queued card on iPad landscape. There is no gap under the lede once the banner goes, and spacing is off the 4/8 rhythm (14, 18, 11 px). | `audits/screens/leftovers/main-typical-ipad-landscape-light.png`, `audits/screens/leftovers/finished-typical-iphone-pwa-light.png`, `audits/screens/leftovers/main-typical-iphone-safari-light.png` |
| Shape, depth & material | 5 | 5 | **5** | Yes (real blur not visible in the rig) | Glass on the control bar only and solid cards, which is right. Radii are modest (12 px cards), and the bar's 12 px fields sit at a 13 px inset inside its 16 px radius, so they are not concentric. Card text reads through the bar. In dark mode the ✓ buttons look recessed (checker). | `audits/screens/leftovers/main-typical-ipad-landscape-light.png`, `audits/screens/leftovers/add-typical-ipad-landscape-dark.png`, `audits/screens/leftovers/main-typical-ipad-portrait-dark.png` |
| Iconography | 6 | 5 | **5** | No | Inline Lucide at a consistent stroke, but only five glyphs and none in the list itself. The refresh glyph on Copy means the wrong thing and repeats the shell's reload icon on the same screen. Nothing helps a pre-reader. | `audits/screens/leftovers/main-typical-iphone-pwa-light.png`, `audits/screens/leftovers/copy-typical-iphone-pwa-light.png`, `audits/screens/leftovers/main-typical-ipad-portrait-light.png` |
| Motion & feedback | 3 | 3 | **3** | No | Presses change the background only. Log gives no confirmation, and the new card is out of view on iPhone. A finished item simply goes, and a double-tap removes two. The only feedback is the "Copied!" label and the mic pulse. | `audits/screens/leftovers/logged-typical-iphone-pwa-light.png`, `audits/screens/leftovers/finished-typical-iphone-pwa-light.png`, `audits/evidence/p3/leftovers/doubletap-A-touch-fresh-iphone-pwa.png` |
| Dark mode | 6 | 5 | **5** | No | Tokens flip and every text pair passes in the dark palettes (the error line included, 6.3-6.5:1), which beats the shell's 4. But the state chips go muddy, against the "never muddy" rule; the select is a lighter grey slab; the ✓ buttons are black wells; the empty-state art keeps its pale fills. The stripes, bars and Log button do glow. | `audits/screens/leftovers/main-typical-ipad-portrait-dark.png`, `audits/screens/leftovers/main-empty-ipad-portrait-dark.png`, `audits/evidence/p3/leftovers/visual-forest-ipad.png` |
| Native feel | 4 | 4 | **4** | No | A grey native select, raw ISO dates, selectable chrome text, blank controls while loading, a native form submit before ready, a raw "internal" error, and no swipe or undo. A tidy web form, though with no `confirm()` dialogs. | `audits/screens/leftovers/main-loading-iphone-pwa-light.png`, `audits/screens/leftovers/add-typical-iphone-pwa-light.png`, `audits/screens/leftovers/main-error-iphone-pwa-light.png` |
| Glanceability | 3 | 3 | **3** | No | On the always-on iPad the largest text is the 28 px title (3.85 mm cap); names are 16 px, and the warning is a 13 px banner, "1 item at a week or older" (checker's correction of the quote). Every string fails at 2 m. | `audits/screens/leftovers/main-typical-ipad-portrait-light.png`, `audits/screens/leftovers/main-overflow-ipad-portrait-dark.png`, `audits/evidence/p3/leftovers/visual.json` |
| Ease of use | 5 | 4 | **4** | No | The glance is 0 taps and finishing 2, but logging is 3. One tap deletes for everyone with no undo, and a double-tap deletes two. Kids get the full editor, with no path that works without reading. Long names are cut off, "select manually" leaves nothing to select, and a slow first open claims the fridge is empty. | `audits/evidence/p3/leftovers/taps-home-iphone-pwa.png`, `audits/evidence/p3/leftovers/kid-ezra-larder-ipad.png`, `audits/screens/leftovers/copy-error-iphone-safari-dark.png` |
| Delight | 4 | 4 | **4** | No | The serif "ledger" voice, the freshness bars and the fridge art are pleasant. There is no celebration and no faces, and "Copy the list below" points at a list that is not there. | `audits/screens/leftovers/main-typical-iphone-pwa-light.png`, `audits/screens/leftovers/main-empty-iphone-pwa-light.png`, `audits/screens/leftovers/copy-typical-iphone-pwa-light.png` |

Average: (5 + 4 + 5 + 5 + 5 + 3 + 5 + 4 + 3 + 4 + 4) / 11 = 47 / 11 = **4.3**. The investigator's average was 51 / 11 = 4.6.

**How the scores were checked.**
- **What the checker opened:** 45 screenshots. That is all 20 the investigator cited plus 25 more: main, empty, error, offline, loading, overflow, middle, lower, queued, slow-sync, stalled, kid, voice, voice-error and copy-error captures across iPad portrait and landscape, iPhone PWA and Safari and desktop, light and dark, plus the kid and main contact sheets. It wrote no script; it checked the numbers in the investigator's `visual.json`, `kid.json`, `before-ready.json` and the compliance JSON.
- **Agreed:** 7 of 11 dimensions.
- **Adjusted by one point:** 4 dimensions.
  - **Colour & palette, 5 → 4:** to match the shell's 4 for the same Hearth tokens; the grey native select belongs to no palette.
  - **Iconography, 6 → 5:** only five glyphs, and the Copy button's refresh glyph repeats the shell's live reload control.
  - **Dark mode, 6 → 5:** muddy state chips (the house "never muddy" rule) and black ✓ wells.
  - **Ease of use, 5 → 4:** kids have no path that works without reading, names are cut off, the Copy fallback is a dead end, and a slow first open shows a false empty fridge.
- **Judge:** ruled on 0 dimensions; no gap reached 2 points.
- **Claims the checker corrected:**
  - The banner reads "1 item at a week or older", not "1 to use up" (`apps/leftovers.html:213`).
  - `thresholds-home-ipad.png` is the Home screen, not the app.
  - The 12.5 and 11.5 px sizes are not mono uppercase.
  - The compliance JSON has 36 raw spacing hits; the investigator's 34 excludes 2 false positives (§6).
  - Kid mode does change the card radius (`apps/design.css:283`), though not the type.

### Deviations from the house style

Each is marked with the visual checker's verdict.

| Area | Deviation | Checker | Evidence |
|---|---|---|---|
| Type scale | h1 28 px (Title 1, fine); lede 14; tally 12 mono uppercase; banner 13; group title 13 uppercase; group subtitle 11 mono. Item name 16 (Headline would be 17); meta 12.5 and chip 11.5, both off the scale; select and date 15; Hearth note 13; error 12. Nothing scales up on the iPad, and kid mode leaves the type unchanged (it only raises `--r-sm`). | Partly: sizes confirmed; kid mode does change the radii | `audits/evidence/p3/leftovers/visual.json`; `apps/leftovers.html:23-26, 67-82`; `apps/design.css:283` |
| Font stacks | The list, form and Hearth block use `--font-sans`, which starts with ui-rounded (`apps/design.css:18`), so their text is SF Rounded on Apple devices, not numerals only. The title and lede use the serif display face (`apps/leftovers.html:16`), a house voice rather than system-ui. The tally and group counts are ui-monospace. | Supported | `apps/leftovers.html:16, 20, 24, 69`; `apps/design.css:18-21` |
| Palette | The states use the olive, gold and terra earth tones (`apps/design.css:74-82`), not pastel fill/ink pairs. The bar gradient mixes with literal `white`. The amber bar is 2.69:1 on its track in Hearth, and the dark chip fills are near-invisible (1.01-1.08). | Supported | `apps/design.css:74-82`; `apps/leftovers.html:80`; `audits/evidence/p3/leftovers/visual.json` |
| Semantic colours without hue | Freshness is shown by hue four times (heading colour, stripe, chip, bar) plus the chip text. There is no shape or icon per state. With normal vision Use it up and Fresh have the same luminance in the three light palettes (1.00:1), and Aging and Fresh are 1.02-1.03:1 in the dark ones. Under deuteranopia the tints differ by 1.04-1.46 across the five palettes, and under protanopia by 1.07-1.53. | Partly: the chips and headings carry text | `apps/leftovers.html:138-147, 230-273`; `audits/evidence/p3/leftovers/visual.json` (`cvd`) |
| Per-profile accent | `--accent` reaches only the add bar's glass pickup. "Logged by" is a plain name, with no avatar or initial. | Supported | `apps/leftovers.html:39, 265`; `audits/evidence/p3/leftovers/accent-and-tells.json` |
| Radii | Cards use 12 px (`--r-sm`), and the chip uses a `999px` literal instead of `--r-full`. The fields inside the 16 px bar are 12 px at a 13 px inset, so not concentric (the inner radius should be about 3). The stripe is clipped by the card's radius. | Supported (the clipping cannot be judged at 1×) | `apps/leftovers.html:41, 71, 82`; `audits/evidence/p3/leftovers/accent-and-tells.json` (`radii`) |
| Glass | Correctly on the control bar only (1 backdrop layer, fixed). But it is translucent enough that list text reads through it, and it hides the last cards on iPhone. | Supported | `apps/leftovers.html:33-45`; `audits/screens/leftovers/add-typical-ipad-landscape-dark.png` |
| Icon set | Lucide inlined consistently, but refresh doubles as "copy", and there are no food icons. | Supported | `apps/leftovers.html:148-155, 352` |
| Spacing rhythm and margins | 34 spacing literals (36 raw hits, less 2 false positives), 0 via `--sp-*`. Off-grid values include 14, 18, 11, 6, 10 and 2 px. The 16 px phone margin is fine; the iPad landscape column is 560 px. There is no gap under the lede once the banner goes (lead `audits/01-leads.md:154`). | Partly: 36 raw hits, corrected here | `audits/evidence/p3/_compliance/leftovers.json`; `apps/leftovers.html:17-19, 25, 30, 66-82` |
| Tap targets | ✓ 48×48 and the bar's 52 px controls pass for adults; the select and date are 44 px, at the minimum. There is no larger kid size: in kid mode the ✓ stays 48×48. | Supported | `audits/evidence/p3/leftovers/visual.json` (`targets`); `audits/evidence/p3/leftovers/kid.json` |
| Motion | No 0.97 press scale, no spring, no sheet and no removal animation. Durations are literals (1 s pulse, 0.8 s bar), not motion tokens, and the 0.8 s bar transition never plays because each render creates the bars at their final width (0 running animations; VIS-LEFTOVERS-8). The mic pulse is the only motion. | Supported (from code); the bar finding was measured after the check | `apps/leftovers.html:57, 61, 80, 85`; `audits/evidence/p3/leftovers/critic-bar-motion.txt` |
| Dark surfaces | Surfaces flip correctly, but the chips go muddy instead of glowing, the native select is lighter grey, and the empty-state art keeps pale hex fills. | Supported | `audits/screens/leftovers/main-typical-ipad-portrait-dark.png`; `audits/screens/leftovers/main-empty-ipad-portrait-dark.png` |
| Empty bar for today's items (from the leads) | An item logged today shows only the grey track (`--p` 0), which looks like a missing element | Not scored by the checker | `apps/leftovers.html:267`; `audits/screens/leftovers/main-typical-ipad-portrait-light.png` |
| Same glyph, two meanings (checker's addition) | The shell's reload and the Copy button share one icon on one screen (VIS-LEFTOVERS-9) | Checker's addition | `audits/screens/leftovers/main-typical-ipad-portrait-light.png` |
| Dark ✓ wells (checker's addition) | `--surface-2` is darker than the card in dark palettes (VIS-LEFTOVERS-10) | Checker's addition | `audits/evidence/p3/leftovers/visual-forest-ipad.png` |

### Web tells

| Tell | Status | Evidence |
|---|---|---|
| Grey tap highlight | Absent | `-webkit-tap-highlight-color: transparent` on body and buttons (`apps/design.css:302, 312`) |
| Long-press selection or callout on chrome | Present | `-webkit-user-select: text` on the ✓, the chip and the h1 (`audits/evidence/p3/leftovers/accent-and-tells.json`); no `-webkit-touch-callout` rule in the app |
| Default form controls | Present | `select#size` has `appearance: auto` (`audits/evidence/p3/leftovers/accent-and-tells.json`); `audits/screens/leftovers/add-typical-iphone-pwa-light.png` |
| Focus rings on touch | Partly | `#name` uses `:focus` with `outline: none` plus a custom 3 px ring (`apps/leftovers.html:48-49`), so it rings on touch; the select and date get the design.css `:focus-visible` ring (`apps/design.css:314-315`) |
| Blue underlined links | Absent | No `<a>` in the page (`apps/leftovers.html:100-131`) |
| White flash on load | Needs a device | Body background comes from tokens (rgb 247, 242, 235 in Hearth), but `html` is transparent (`accent-and-tells.json`); inside the shell iframe this needs a device check |
| Rubber-band overscroll background | Needs a device | `overscroll-behavior: none` (`apps/design.css:304`); the `html` background is transparent |
| Zoom on input focus | Needs a device | `select#size` and `#date` are 15 px (`apps/leftovers.html:52-53`; computed `{"name":"17px","size":"15px","date":"15px"}` in `audits/evidence/p3/leftovers/critic-followups.json`), below the 16 px at which iOS Safari zooms the page when a field gets focus. The viewport meta sets no `maximum-scale` (`apps/leftovers.html:5`). `#name` is 17 px (`apps/leftovers.html:47`), so it does not zoom. |
| Tap delays | Absent | `touch-action: manipulation` (`apps/design.css:303, 312`). This is also what lets a double-tap delete two items (P3-LEFTOVERS-01). |
| Visible scrollbars on chrome | Needs a device | `scrollbar-width: auto`; the page is the only scroller |
| Layout shift as data loads | Present | Blank controls fill in after ready (`audits/screens/leftovers/main-loading-iphone-pwa-light.png`); the name field narrows by 60 px when the mic appears (VIS-LEFTOVERS-11); the list jumps from empty to 6 cards on a slow cold open (P3-LEFTOVERS-05) |
| Spinners vs skeletons | Present | Neither: empty boxes and a false empty state (`apps/leftovers.html:189-196`; P3-LEFTOVERS-05) |
| `alert()` / `confirm()` / `prompt()` | Absent | Compliance bypass lists empty. The flip side is no protection at all on delete. |

## 6. Platform compliance

**Data through hub.js.**
- **Calls used:** `ready`, `list`, `get`, `set`, `remove`, `migrate`, `onChange`, `onSync`, `activity`, `uid`, `canWrite`, `kioskNudge`, `voiceSupported` / `voiceInput` and `profile` (`apps/leftovers.html:172-378`).
- **Bypasses: 0.** No localStorage, fetch or external URL (`audits/evidence/p3/_compliance/leftovers.json`: every bypass list is empty).
- **Clipboard:** `navigator.clipboard`, with an `execCommand` textarea fallback (`apps/leftovers.html:339-347`). That is not a data bypass.
- **Where hub.js itself fails the Larder:** the 6 s cold-cache `hub.ready` (`apps/hub.js:334-337`) is the root of P3-LEFTOVERS-05 and -06.

**design.css tokens.** The `compliance.mjs` hits were reviewed by hand; the corrected counts:

| Category | Raw hits | Corrected | Notes |
|---|---|---|---|
| Hardcoded colours | 0 hex; 1 `colorFunc`; 0 rgb/hsl; 0 named | **1** | The literal `white` inside `color-mix` at `apps/leftovers.html:80`. The tool filed it under `colorFunc`. |
| Token-derived colour | 5 `colorDerived` | **0 violations** | `color-mix()` of tokens at `apps/leftovers.html:14, 37-39, 45, 49, 56` |
| Font sizes | 16 | **16 px literals** | None uses the `--fs-*` tokens that exist (`apps/design.css:22-24`), so the kid type scale never reaches the app |
| Radii | 1 | **1 literal** | `999px` at `apps/leftovers.html:82` (`--r-full` exists); the other radii use `var(--r*)` |
| Spacing | 36 | **34 px literals** | The 2 `margin: 0 auto` hits at `apps/leftovers.html:19, 36` are false positives; 0 use `--sp-*` (`apps/design.css:29-30`) |
| Shadows | 3 | **3** | `apps/leftovers.html:42` is token-composed; `apps/leftovers.html:49, 56` are partly literal |
| Durations | 2 | **2** | `1s` at `apps/leftovers.html:61`, `.8s` at `apps/leftovers.html:80` (the tokens are at `apps/design.css:109`) |
| z-index | 1 | **1** | `20` at `apps/leftovers.html:34` |
| JS inline style | 1 | **1** | The clipboard textarea at `apps/leftovers.html:343`. The `--tint`, `--chip`, `--group-ink` and `--p` custom-property writes (`apps/leftovers.html:236, 256-258, 267`) are token plumbing, not counted. |
| Undefined tokens | 0 | **0** | 6 local custom properties are defined in the file (`apps/leftovers.html:14-15, 33, 45`) |

**Per-profile accent.** `--accent` reaches the app and differs by person (Eli #4F5D8C, Mae #BC5A38). Only the add bar's glass pickup uses it (VIS-LEFTOVERS-4).

**Dark mode.**
- No `prefers-color-scheme` and no `data-scheme` selectors. Every colour is a token that each palette redefines, so the app follows `data-theme` / `data-scheme` through design.css (`apps/leftovers.html:9-11`).
- Checked in Hearth, Parchment, Frost, Midnight and Forest (`audits/evidence/p3/leftovers/visual-*.png`): all list, chip and status text passes AA. The add bar's 12 px error line fails in Hearth (4.35:1; P3-LEFTOVERS-15).
- Defects: the dark chip fills vanish (VIS-LEFTOVERS-3), the ✓ buttons are black wells (VIS-LEFTOVERS-10), the empty-state art is not themed (VIS-LEFTOVERS-7), and the native select renders its own grey (VIS-LEFTOVERS-5).
- `prefers-reduced-motion` is honoured (`apps/leftovers.html:97`). `prefers-reduced-transparency` and `prefers-contrast`: NOT FOUND IN CODE.

**Keyboard and focus** (CLAUDE.md "Adding an app" step 6 asks for Enter/Escape on inputs).
- **Enter** in the name field submits (`enterkeyhint="done"`, `apps/leftovers.html:122`; the form's submit, `apps/leftovers.html:289`).
- **Escape** in the name field: NOT FOUND IN CODE. There is no keydown handler (`apps/leftovers.html:120-131, 289-304`). In the run, Escape left "Half-typed soup" in the field with focus still on it.
- **Focus after ✓.** `render()` empties and rebuilds the list (`apps/leftovers.html:203-246, 217`) inside `removeItem` (`apps/leftovers.html:306-311`), so the focused ✓ is destroyed. After Enter on a focused ✓ (Chicken alfredo, which was removed), focus fell back to `<body>`. A keyboard or VoiceOver user starts again from the top of the page. That VoiceOver restarts at the top is inferred from the focus result, not tested on a device.
- Evidence: `audits/evidence/p3/leftovers/critic-followups.json` (`keys`). Run: `node "audits/tools/phase3/leftovers/critic-followups.mjs"`. Observed: `keys {"escape":{"nameValue":"Half-typed soup","focused":"name"},"afterDone":{"tag":"BODY","isBody":true},"removedFirst":true}`.

## 7. Improvements

Ratio = delight ÷ effort, with S = 1, M = 2 and L = 3. None turns the Larder into a shopping list, and none adds a routine or reward system. The Larder is not on the CLAUDE.md "Do not touch" list.

**Polish**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Undo toast on ✓: keep the finished card in place for 5 s with "Undo", ignore ✓ taps for about 400 ms after any re-render (the user's own, `hub.onChange` from another device, and the midnight rollover), and animate the card out. This fixes the double-tap loss, the remote-change shift and one-tap deletion. | 5 | S | 5.0 | P3-LEFTOVERS-01, P3-LEFTOVERS-12, UX-LEFTOVERS-1; `apps/leftovers.html:306-311, 371, 378` |
| 2 | One set of words for "old": "eat soon" for 4-6 days and "use it up" for 7+, in the Larder, on the Home card, on the badge and in the 8 am push. The push may keep its early 5-day trigger. | 4 | S | 4.0 | P3-LEFTOVERS-02; `thresholds.json` |
| 3 | New York calendar-day maths: ages from the NY date (Intl with America/New_York) and a rounded day difference, as `worker/src/reminders.js:14-19` does, with the day re-checked on submit (the rollover run at the top of the handler, so the date box's value and `max` never disagree). Show "today", "yesterday" or "Tue 15 Sep" instead of ISO dates and "0d ago". | 3 | S | 3.0 | P3-LEFTOVERS-03, -07, -08, -14; VIS-LEFTOVERS-5 |
| 4 | Kid view: for `data-kind="kid"`, hide the ✓ (as chat already refuses fridge clean-up to kids) or keep it behind undo, use the kid type scale, and show a food emoji or icon per item with one big colour state | 4 | M | 2.0 | P3-LEFTOVERS-13, UX-LEFTOVERS-2; `kid.json` |
| 5 | Glanceable iPad hero: a large "1 to use up · 2 aging" summary in ui-rounded numerals (at least 5.8 mm cap at 2 m), plus a pending mark on offline items and plain-language sync errors | 4 | M | 2.0 | UX-LEFTOVERS-3, -7, -8; `visual.json` |
| 6 | Guard the form and the list until the first pull: `preventDefault` from the first byte, the button and select filled in the HTML, "Nothing logged yet." only after a successful pull, and "last copy" wording only when a copy exists. Treat a non-ISO or future `dateLogged` as unknown or today, with Worker-side validation. | 2 | S | 2.0 | P3-LEFTOVERS-04, -05, -06, -09; VIS-LEFTOVERS-1 |
| 7 | Visual pass: pastel state pairs with a glowing dark variant and distinct luminance per state, a shape or icon per state, concentric radii, a custom select, a 0.97 press scale, and the error line in `--danger-ink` at 13 px or more | 3 | M | 1.5 | VIS-LEFTOVERS-2, -3, -5, -8, -10; P3-LEFTOVERS-15 |

**Missing features**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Edit an item: tap a card to open a sheet showing the full name, where the name, size, date or a use-by can be fixed. It solves long names and wrong dates. | 4 | M | 2.0 | GAP-LEFTOVERS-1, P3-LEFTOVERS-11; `audits/screens/leftovers/main-overflow-iphone-pwa-light.png` |
| 2 | Recently finished (7 days) with Restore, like Reminders' "Show Completed": tombstoned items stay listed for a week, and one tap restores them with their original date and author | 4 | M | 2.0 | UX-LEFTOVERS-1, P3-LEFTOVERS-01, -12, -13, P2-CHAT-03 |
| 3 | An honest Hearth action: either give the hub chat a real tool, or rename it "Copy the use-soon list", hide it when nothing is aging, and show the copied text | 2 | S | 2.0 | UX-LEFTOVERS-4, P3-LEFTOVERS-10; `roles.json` |

**New ideas**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Swipe to finish, plus "someone ate some": an iOS-style trailing swipe (keeping the ✓ for grandparents) and a "half left" state instead of all-or-nothing | 3 | M | 1.5 | `taps.json` |
| 2 | Use-by presets per food: common foods (rice 4 days, soup 4, pie 3) get their own threshold when logged, so the rule gets smarter without becoming a shopping list | 3 | M | 1.5 | GAP-LEFTOVERS-1; `apps/leftovers.html:137` |

## App-specific checks

| Check (from the brief, plus the investigator's) | Result | Evidence |
|---|---|---|
| Date maths on ordinary days (days since logged, freshness groups) | **PASS.** 8/5/4/2/1/0 days → Use it up / Aging / Aging / Fresh ×3 | `audits/evidence/p3/leftovers/thresholds.json` |
| Midnight rollover while open | **PASS**, with two low defects: the date box, `max` and ages move on the minute tick, but the first item logged in the 60 s after midnight is dated yesterday (P3-LEFTOVERS-08), and a second Log in that window is refused (P3-LEFTOVERS-14) | `audits/evidence/p3/leftovers/midnight.json`; `audits/evidence/p3/leftovers/critic-midnight-second-log.json` |
| Item logged just before midnight | **PASS.** "Late snack", logged at about 23:59:2x on 22 Sep (`audits/tools/phase3/leftovers/midnight.mjs:14`), is stored as 2026-09-22 and reads "1d ago" after midnight | `audits/evidence/p3/leftovers/midnight.json` (`loggedCards`, `server`) |
| DST fall back, 2026-11-01 | **PASS** | `audits/evidence/p3/leftovers/dates-dst.json` |
| DST spring forward, 2027-03-14 | **FAIL (medium, P3-LEFTOVERS-03).** One day low in the Larder and on Home for every item logged on or before the change; the push is right | `audits/evidence/p3/leftovers/dates-dst.json`; `audits/evidence/p3/leftovers/verify-dst-spring-forward-off-by-one-1.json` |
| A device in another time zone (London, Los Angeles) | **FAIL (low, P3-LEFTOVERS-07).** A London log reads "-1d ago" on the New York iPad; an LA late-evening log reads "1d ago" at once | `audits/evidence/p3/leftovers/verify-other-timezone-ages-2.json` |
| Future dates | **PARTLY (low, P3-LEFTOVERS-09).** Native validation blocks them where the browser has a date input (Chromium); the Windows WebKit save is a rig artefact; iOS needs a device. Future rows from other paths read "-3d ago". | `audits/evidence/p3/leftovers/verify-no-js-date-guard-2.json` |
| Dates that are not YYYY-MM-DD | **FAIL (medium, P3-LEFTOVERS-04).** "NaNd ago", Fresh forever, never warned about | `audits/evidence/p3/leftovers/verify-non-iso-date-nan-1.json` |
| Colourful expiry states | **PARTLY.** Three states, each with a stripe, chip, bar and heading colour, but in earth tones, not house pastels | `audits/screens/leftovers/main-typical-ipad-portrait-light.png` |
| Legible expiry states (contrast, every theme) | **Text PASS; non-text FAIL.** All chip and heading text is at least 5.37:1 in light and 8.88:1 in dark. The warn bar is 2.69:1 against its track (Hearth) and 2.83:1 (Parchment), and the dark chip fills are invisible (VIS-LEFTOVERS-2, -3). | `audits/evidence/p3/leftovers/visual.json` |
| States distinguishable without hue | **PARTLY** (text only). Only through text (chip labels, group headings). Even with normal colour vision, the Use it up and Fresh tints have the same luminance in all three light palettes (1.00:1), and Aging and Fresh are 1.02-1.03:1 in the dark palettes (`cvd.normal`). Under deuteranopia the tints differ by 1.04-1.46, and under protanopia by 1.07-1.53 | `audits/evidence/p3/leftovers/visual.json` (`cvd`) |
| 8 am push agrees with the app | **PARTLY (medium, P3-LEFTOVERS-02).** The same items, but different words | `audits/evidence/p3/leftovers/verify-thresholds-disagree-2.json` |
| Undo for finish | **FAIL.** None; a double-tap removes two (P3-LEFTOVERS-01), a change from another device can put a different item under a single tap (P3-LEFTOVERS-12), and one tap deletes for everyone (UX-LEFTOVERS-1) | `audits/evidence/p3/leftovers/doubletap.json`; `audits/evidence/p3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-2-webkit.json` |
| Kid access | **FAIL.** A kid's ✓ removes a family item for everyone (P3-LEFTOVERS-13, critical); for a pre-reader it is the full editor, with no pictures and adult-size type (UX-LEFTOVERS-2) | `audits/evidence/p3/leftovers/kid.json`; `audits/evidence/p3/leftovers/verify-critic-kid-check-removes-family-item-3-2.json` |
| Copy for Hearth | **FAIL.** It copies the 4+ day items and shows "Copied!", but the hub's Claude has no Hearth tool, the icon is wrong, and the failure path is a dead end (UX-LEFTOVERS-4, P3-LEFTOVERS-10) | `audits/evidence/p3/leftovers/roles.json` |
| Sticky add bar | **PARTLY.** Always on screen and thumb-reachable (y 799-929 on iPhone), but it covers cards 5+ on iPhone, a new card lands under it on every device except iPad portrait (UX-LEFTOVERS-6), content shows through it (VIS-LEFTOVERS-6), and its 12 px error line is below AA in Hearth (P3-LEFTOVERS-15) | `audits/evidence/p3/leftovers/taps.json`; `audits/evidence/p3/leftovers/critic-followups.json` |
| Kiosk read-only; guest | **PASS** (OK-LEFTOVERS-1) | `audits/evidence/p3/leftovers/roles.json` |
| Two-device sync and offline | **PASS**, with no pending mark (OK-LEFTOVERS-2, UX-LEFTOVERS-7) | `audits/evidence/p3/leftovers/sync.json` |
| First open on a new device | **FAIL (low).** A slow first pull shows a false empty fridge (P3-LEFTOVERS-05), and Log before ready reloads the page (P3-LEFTOVERS-06) | `audits/evidence/p3/leftovers/before-ready.json` |

## Leads from 01-leads.md

| Lead | Outcome | Where it went |
|---|---|---|
| One tap on the check button deletes a family item for good (`audits/01-leads.md:133`) | Confirmed, and widened: a double-tap removes the next item too | P3-LEFTOVERS-01, UX-LEFTOVERS-1 |
| Kids get the full adult page and can clear or add (`:134`) | Confirmed: 6 ✓, the form, mic and Hearth; kid type scale ignored. The clearing side was confirmed 2/2 as a critical defect (Chicken alfredo, and Beef and bean chili, removed on the server by Ezra and Kiara) | P3-LEFTOVERS-13, UX-LEFTOVERS-2 |
| Tapping Log before ready reloads the page and loses the name (`:135`) | Confirmed, with Enter as a second trigger; exposure narrowed to a device with no leftovers cache | P3-LEFTOVERS-06 |
| A slow first load looks like an empty fridge (`:136`) | Confirmed by the visual check and 2/2 skeptics; a new facet of P2-SYNC-15 | P3-LEFTOVERS-05 |
| False "offline" line on every warm open (`:137`) | Owned by P2-SYNC-15 (468-1535 ms); not re-measured | P2-SYNC-15 pointer |
| Logging gives no confirmation; the new card lands out of sight (`:138`) | Confirmed on all four devices the lead names, measured: hidden on iPhone PWA (card top 872, bar 742), iPhone Safari (872, bar 550), iPad landscape (799, bar 630) and desktop (799, bar 710); per the checker a queued card also hides on iPad landscape. Visible only on iPad portrait (799, bar 990) | UX-LEFTOVERS-6; `audits/evidence/p3/leftovers/critic-followups.json` |
| An item logged offline has no pending marker (`:139`) | Confirmed | UX-LEFTOVERS-7 |
| Sync trouble easy to miss; raw server code (`:140`) | Confirmed: "internal." in 12 px | UX-LEFTOVERS-8 |
| The loading state is blank controls (`:141`) | Confirmed: `logText ''`, `sizeOptions 0` | VIS-LEFTOVERS-1 |
| The warning banner cannot be tapped and names no items (`:142`) | Confirmed | UX-LEFTOVERS-9 |
| "Copy list for Hearth" is confusing (`:143`) | Widened: the hub's Claude has no Hearth tool; the "select manually" dead end was confirmed 2/2 | UX-LEFTOVERS-4, P3-LEFTOVERS-10 |
| Weak voice feedback (`:144`) | Owned by Phase 2; not re-run | PWA-UX-3 pointer |
| The mic squeezes the name field on iPhone (`:145`) | Confirmed ("Chicken alf"), plus the checker's layout-shift facet | PWA-UX-3 pointer, VIS-LEFTOVERS-11 |
| Narrow column; the add bar takes a large share (`:146`) | Confirmed | VIS-LEFTOVERS-6 |
| You can read cards through the add bar (`:147`) | Confirmed | VIS-LEFTOVERS-6 |
| Long names cut off with no way to read them (`:148`) | Confirmed 2/2 and widened (no `maxlength`; iPad and desktop too); narrowed by the Home card and the aria-label. **byName wrap: confirmed.** The `.meta` line has no `nowrap` (`apps/leftovers.html:76`). On the overflow seed it wraps to two lines on 32 of 32 iPhone PWA cards and 4 of 32 iPad portrait cards (the long names, such as "Great-Aunt Wilhelmina Fairweather-Pennington"). On iPhone even the typical seed's "Elizabeth" and "David" wrap it (`audits/evidence/p3/leftovers/critic-followups-logged-iphone-safari.png`). Cosmetic: the whole line stays readable | P3-LEFTOVERS-11; `audits/evidence/p3/leftovers/critic-followups.json` (`metaWrap`); `audits/screens/leftovers/main-overflow-iphone-pwa-light.png` |
| Dates are raw ISO and today reads "0d ago" (`:149`) | Confirmed | VIS-LEFTOVERS-5 |
| Freshness is shown four times per card (`:150`) | Confirmed; folded into the deviations | §5 Semantic colours |
| Items logged today show an empty bar (`:151`) | Confirmed (Blueberry pancakes, `--p` 0) | §5 deviations |
| The size select looks like a grey native control (`:152`) | Confirmed (`appearance: auto`) | VIS-LEFTOVERS-5 |
| The empty-state fridge art glares in dark mode (`:153`) | Confirmed; the checker says "glares" overstates it a little | VIS-LEFTOVERS-7 |
| No gap under the lede when there is no banner (`:154`) | Confirmed (`audits/screens/leftovers/finished-typical-iphone-pwa-light.png`) | §5 Spacing |

## Not verified

- On a real iPhone and iPad: whether two quick taps on a ✓ both reach the page (expected, given `touch-action: manipulation`) and how far apart real taps land (P3-LEFTOVERS-01).
- The iOS Safari date picker: whether `max` and form validation block a future date (P3-LEFTOVERS-09). The Windows WebKit rig has no date input.
- The real clipboard inside the shell iframe on iOS, and how often both copy paths fail (P3-LEFTOVERS-10). WebKit on Windows reported "Copied!".
- Real Liquid Glass blur, SF Rounded and New York fonts, and ProMotion motion. The rig uses fallback fonts, so the Typography and Shape scores are provisional.
- Real speech recognition (the harness stubs it); voice UX belongs to PWA-UX-3.
- The 8 am push delivered through Apple's push service. Only the forced morning job's due list was checked, and the skeptic's run skipped every adult as `already_today`, so the push body is read from code.
- Rubber-band background, white flash and scrollbars in the standalone PWA.
- Whether the doubled "Finished the Sunday pot roast" feed line is P2-PWA-13 (not isolated).
- `hub.migrate` of a legacy `leftovers.items` array (the P2-SYNC-06 facet) was not run.
- The P2-SYNC-03 facet in the Larder was read from code, not run: a legacy `leftovers.items` array migrated before the first `leftovers|family` pull lands, re-setting items (and resurrecting ones finished elsewhere) over the server's rows (`apps/hub.js:406`).
- P2-SYNC-15's warm-open false offline line was not re-measured.
- P2-SYNC-07, P2-PROF-19, P2-PWA-06, P2-PWA-10 and P2-PWA-11 in the Larder: inherited from Phase 2, not re-run.
- On iOS: whether Safari refuses the second Log after midnight (P3-LEFTOVERS-14), and whether a 15 px select or date field zooms the page on focus inside the viewer (§5 Web tells).
- P3-LEFTOVERS-12 with a log (not a finish) from the other device.
- The NoWaste and Fridgely pages were not fetched, so those reference facts are product knowledge.

## Scripts and evidence

**Investigator** (`audits/tools/phase3/leftovers/`):
- `_lib.mjs` (shared helpers), `probe.mjs`, `doubletap.mjs`, `dates.mjs`, `entry.mjs`, `future-date.mjs`, `before-ready.mjs`, `kid.mjs`, `thresholds.mjs`, `sync.mjs`, `visual.mjs`, `accent.mjs`, `taps.mjs`, `roles.mjs`, `midnight.mjs` and `timezone.mjs`.
- Platform counts: `node audits/tools/phase3/compliance.mjs leftovers` → `audits/evidence/p3/_compliance/leftovers.json`.

**Completeness critic** (`audits/tools/phase3/leftovers/`): `critic-remote-shift.mjs` (P3-LEFTOVERS-12), `critic-midnight-second-log.mjs` (P3-LEFTOVERS-14), `critic-err-contrast.mjs` (P3-LEFTOVERS-15) and `critic-bar-motion.mjs` (VIS-LEFTOVERS-8; it only prints, so its output is kept in `critic-bar-motion.txt`). P3-LEFTOVERS-13 re-used the investigator's `kid.mjs`.

**Report patch** (`audits/tools/phase3/leftovers/critic-followups.mjs`): the per-device new-card check for lead `:138`, the byName wrap for lead `:148`, Escape and focus after ✓, and the fields' font sizes → `critic-followups.json`.

**Skeptics** (`audits/tools/phase3/leftovers/`):

| Finding | Scripts |
|---|---|
| P3-LEFTOVERS-01 | `verify-double-tap-removes-next-item-1.mjs`, `verify-double-tap-removes-next-item-2.mjs`, `verify-double-tap-removes-next-item-2-probe.mjs` |
| P3-LEFTOVERS-02 | `verify-thresholds-disagree-1.mjs`, `verify-thresholds-disagree-2.mjs` |
| P3-LEFTOVERS-03 | `verify-dst-spring-forward-off-by-one-1.mjs`, `verify-dst-spring-forward-off-by-one-2.mjs` |
| P3-LEFTOVERS-04 | `verify-non-iso-date-nan-1.mjs`, `verify-non-iso-date-nan-2.mjs` |
| P3-LEFTOVERS-05 | `verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-1.mjs`, `verify-vis-a-slow-first-open-reports-an-empty-fridge-as-the-1-2.mjs` |
| P3-LEFTOVERS-06 | `verify-submit-before-ready-reloads-1.mjs`, `verify-submit-before-ready-reloads-2.mjs` |
| P3-LEFTOVERS-07 | `verify-other-timezone-ages-1.mjs`, `verify-other-timezone-ages-2.mjs` |
| P3-LEFTOVERS-08 | `verify-midnight-first-minute-yesterday-1.mjs`, `verify-midnight-first-minute-yesterday-2.mjs` |
| P3-LEFTOVERS-09 | `verify-no-js-date-guard-1.mjs`, `verify-no-js-date-guard-2.mjs` |
| P3-LEFTOVERS-10 | `verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-1.mjs`, `verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-2.mjs` |
| P3-LEFTOVERS-11 | `verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-1.mjs`, `verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-2.mjs` |
| P3-LEFTOVERS-12 | `verify-critic-remote-change-rerender-shifts-tap-1-1.mjs`, `verify-critic-remote-change-rerender-shifts-tap-1-2.mjs` |
| P3-LEFTOVERS-13 | `verify-critic-kid-check-removes-family-item-3-1.mjs`, `verify-critic-kid-check-removes-family-item-3-2.mjs` |
| P3-LEFTOVERS-14 | `verify-critic-midnight-second-log-blocked-2-1.mjs`, `verify-critic-midnight-second-log-blocked-2-2.mjs` |
| P3-LEFTOVERS-15 | `verify-critic-err-line-below-aa-hearth-4-1.mjs`, `verify-critic-err-line-below-aa-hearth-4-2.mjs` |

**Visual checker.** Wrote no script. It re-read the investigator's `visual.json`, `kid.json`, `before-ready.json` and the compliance JSON, and opened the 45 screenshots listed in §5.

**Evidence** is in `audits/evidence/p3/leftovers/`:
- JSON: `accent-and-tells.json`, `before-ready.json`, `dates-dst.json`, `doubletap.json`, `entry.json`, `future-date-webkit.json`, `future-date-chromium.json`, `kid.json`, `midnight.json`, `roles.json`, `sync.json`, `taps.json`, `thresholds.json`, `timezone.json`, `visual.json`, `critic-remote-shift.json`, `critic-midnight-second-log.json`, `critic-err-contrast.json`, `critic-followups.json`, and the `verify-*.json` files. TXT: `critic-bar-motion.txt`.
- PNGs at 1× CSS scale: the `accent-*`, `before-ready-*`, `critic-*`, `dates-*`, `doubletap-*`, `entry-*`, `kid-*`, `midnight-*`, `roles-*`, `sync-*`, `taps-*`, `thresholds-*`, `tz-*`, `visual-*` and `verify-*` images.

The Phase 1 captures are under `audits/screens/leftovers/`, with contact sheets `audits/screens/_sheets/leftovers--*.jpg`.
