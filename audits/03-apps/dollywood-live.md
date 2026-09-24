# Dollywood park map (`dollywood-live`) — Phase 3 deep dive

| | |
|---|---|
| **App code audited** | `fe6041d`, unchanged since the Phase 0 baseline. This phase changed no app code. |
| **File(s)** | `apps/dollywood-live.html` (1,614 lines; line 682 is the multi-megabyte embedded map payload and was never printed). It is generated from `../dollywood-build-project/scripts/template.html` (1,743 lines), so every fix belongs there, followed by an export (CLAUDE.md "Do not touch"). Shared code it depends on: `apps/hub.js` (500), `apps/design.css` (617), `index.html` (1,716; the Home "At the park" card and the Me guest sheet), `worker/src/index.js` (602; `/api/dollywood/waits`, `/api/dollywood/rally`, `/api/profiles`), `worker/src/reminders.js` (261; the park-day push), `sw.js` (70). Registry entry: `apps.json:10` (no `visibleTo`, so kids and guests see it). |
| **Date** | 2026-09-24 |
| **Inputs** | `audits/00-inventory.md` §9c "dollywood-live — Dollywood park map" (lines 4244-4469) and the shared §9c notes (3958-4004); the 722 Phase 1 captures under `audits/screens/dollywood-live/` and the 44 sheets `audits/screens/_sheets/dollywood-live--*.jpg`; `audits/01-leads.md` "Dollywood build guide and park map" (lines 305-352; park-map leads at 308-318, 333-338 and 344-347); Phase 2 IDs P2-PWA-18, P2-PWA-02, P2-CHAT-02, P2-PROF-05, P2-SYNC-15, P2-SYNC-02, P2-VIS-03, P2-STAB-01 and P2-SYNC-01, plus Phase 2's "OK: no stored XSS" and "no CSP" notes (`audits/02-shell.md:2000-2009`). |
| **Runtime** | Local instance with the demo household (typical, park, overflow and empty seeds as stated), Playwright WebKit. Chromium where stated (P3-DOLLYWOOD-LIVE-03). Demo clock Tue 22 Sep 2026 08:40 New York, or the real clock where a skeptic needed live timestamps. Geolocation injected with Playwright. No production data or endpoint was touched, and queue-times.com was not fetched: the waits feed is the rig's stand-in. |
| **Reproduce** | Scripts in `audits/tools/phase3/dollywood-live/`, evidence in `audits/evidence/p3/dollywood-live/`. Run each with `node "audits/tools/phase3/dollywood-live/<name>.mjs"`. |

**How to read this.** Every bug, security or perf finding went to two independent skeptics. Each re-read the code and re-ran the finding with their own script; a third skeptic would have broken a tie, but none was needed. A defect is **CONFIRMED** only when at least two skeptics reproduced it and more confirmed it than refuted it. Refuted findings go under "Checked and not a bug", and undecided ones under "Unresolved". UX, VIS, GAP and OK items describe the design, not malfunctions, so they were not adversarially verified. A separate agent re-checked every rubric score against the screenshots; a judge would have settled any gap of 2 or more points, but none arose. The visual checker also filed one bug of its own; it went to the skeptics like the others and is marked "from the visual check". A completeness critic then re-read the report against the brief, reproduced 7 more defects with its own `critic-*.mjs` scripts, and sent each to two new skeptics; those are P3-DOLLYWOOD-LIVE-12 to -18, marked "from the completeness critic". Severity follows the rule at the top of `audits/02-shell.md` (lines 25-37).

## Summary

- **What it is.** The family's map for a day at Dollywood: an illustrated park map with live ride waits (a Queue-Times proxy), a "you are here" dot, each person's opt-in position (`loc:<id>` family rows), a shared meeting point, kids' ride heights and walking directions. Kids are view-only unless an adult switches on their beacon; the TV is always view-only.
- **Confirmed defects: 17 primary** (1 critical, 1 high, 10 medium, 5 low), plus P3-DOLLYWOOD-LIVE-14 as a pointer to P3-DOLLYWOOD-06. Of the 18 IDs, 11 come from the first pass and 7 from the completeness critic (-14 is one of those 7). None were refuted or left unresolved.
  - The worst is **P3-DOLLYWOOD-LIVE-01 (critical)**: a guest name typed into Me → Add a guest runs as script in the park map of everyone who opens it, admin included. A skeptic replayed the admin tokens the script could read and got `/api/me` 200 as Eli, `isAdmin: true`. Phase 2's "no stored XSS" never tested this app.
  - **P3-DOLLYWOOD-LIVE-02 (high)**: a guest can switch a child's location beacon on or off and overwrite the kids' measured heights.
  - The mediums: a fresh phone with Share my spot on says "not sharing" and never locates you (03, lowered from high); the meeting-point bar loses its walk time and Go after you locate yourself and does not heal on its own (04); kids' beacon and height controls vanish until someone else shares (05); Share left on keeps publishing a home position, so Home says "At the park" (06); an old out-of-frame fix reads as live (07); restroom, first-aid and AED markers do nothing when tapped (08); the compass jumps the view to the entrance (09); on iPhone the pill cuts off the location-denied instructions (10, from the visual check); a parent's beacon-off is undone by the kid's open map, which republishes the child's spot (12, lowered from high); a beacon switched on does nothing until the kid's map is reopened (13).
  - The pointer: Search's "rider height: up to N" hides every ride with no height requirement (14). It is the build guide's P3-DOLLYWOOD-06 in this export (one template line, `../dollywood-build-project/scripts/template.html:1004`) and is counted there.
  - The new lows: waits keep showing as current after hours of feed failure while the map stays open (15); a kid with his beacon on gets a Share switch that snaps back on (16); a location denial bypasses the app's own designed denied state and its Set my spot chip (17); the meeting point's age freezes and its 2 h expiry is skipped while the map stays open (18).
- **Rubric: final average 5.6 / 10** (investigator 6.4). The checker lowered 8 of 11 dimensions by one point. Dark mode and Delight are strongest at 7; six dimensions sit at 5.
- **Biggest usability gaps.** A location denial skips the designed state (P3-DOLLYWOOD-LIVE-17) and speaks adult "Settings › Safari" to a 5-year-old (UX-DOLLYWOOD-LIVE-1); kid mode needs reading throughout (UX-DOLLYWOOD-LIVE-5); the build guide's engineering panels leak into the family map (UX-DOLLYWOOD-LIVE-4); "Rally the family" is promised by a dialog but cannot be sent (P2-PWA-18); a parent's kid-beacon switch does not take effect on the child's open map, in either direction (P3-DOLLYWOOD-LIVE-12, -13).
- **Biggest visual gaps.** Family and meeting-point labels pile up and clip (VIS-DOLLYWOOD-LIVE-1, -2); text below the 11 px floor (9.5 px "MIN", about 8.7 px family labels); five control rules under 44 px (VIS-DOLLYWOOD-LIVE-5); three icon families; saturated wait-band literals instead of pastel pairs; the illustrated map stays at daytime brightness in dark palettes.
- **What works.** One tap from Home's park card once someone is sharing (2 taps before that); waits show freshness, "park closed" and an offline stamp honestly on a fresh open, though a map left open keeps old waits past the 6 h limit (OK-DOLLYWOOD-LIVE-3, P3-DOLLYWOOD-LIVE-15); in-app time logic is relative, so midnight, DST and time zones cannot break it, though cross-device ages use each phone's own clock (OK-DOLLYWOOD-LIVE-1); dark mode keys off `data-scheme` and the person's accent follows (OK-DOLLYWOOD-LIVE-2); a restored, rough or hand-placed fix is never published (OK-DOLLYWOOD-LIVE-4).
- **Best-value improvement.** Escape every name and emoji in the Family pane and cards (delight 5, effort S), which closes the critical. Next come five S-effort items at ratio 4.0: household-adult-only kids' controls that are always shown, resuming GPS after the first pull, a complete kid-safe denied state that fits the phone, a kid's map that reacts at once when its beacon is switched on or off, and wiring the Rally button.

## 1. Purpose and top jobs

The park map is a full-screen map with a location pill at the top, a meeting-point bar under it, floating buttons (Find me, Whole park, compass) and a bottom sheet with Nearby / Waits, Family, Search and Style panes (`apps/dollywood-live.html:613-633`). There is no usage data, so the jobs are inferred from the app, the Home park card (`index.html:890-900`) and CLAUDE.md:

| # | Job | Who | How often |
|---|---|---|---|
| 1 | Glance at the illustrated map and the live ride waits | Every family member on a park day | Many times a visit; 1 tap from Home's "At the park" card (`index.html:900`) once someone shares, otherwise 2 through Apps (§3) |
| 2 | See where the family is, and walk to a person or the meeting point | Adults, on phones in the park (the Kitchen iPad stays home) | Often during a visit |
| 3 | Find yourself and get walking directions to the next open ride that each kid is tall enough for | Adults with kids | Several times a visit |

Kids (Ezra, Kiara) get the same map view-only unless an adult switches on their beacon in the Family pane (`apps/dollywood-live.html:693, 1307`). The TV kiosk is always view-only. Guests are treated as adults. The file still carries the build guide's code (step progress, `hub.migrate` of the guide's old localStorage keys at `apps/dollywood-live.html:1107`), which the park map does not show.

## 2. Features and gaps

**References.**
- **Apple first-party:** Find My (per-person opt-in location sharing with the family, live dots, a child never broadcast without setup, arrival and leave notifications) and Apple Maps ("you are here", search, walking directions). The investigator fetched Apple's Find My overview (https://support.apple.com/en-us/104978); that page is about finding devices, so the family-sharing model is cited from product knowledge.
- **Best in class:** the official Dollywood app, Queue-Times.com and Thrill-Data (live waits, hours, showtimes, wait history), and My Disney Experience (party locations, waits, mobile order). These pages were not fetched; the facts are product knowledge. The app already proxies Queue-Times with attribution.

| Capability | This app | Reference | Gap |
|---|---|---|---|
| Illustrated park map, "you are here" | Find me with a pulsing dot and accuracy note; high-accuracy watch (`apps/dollywood-live.html:1401-1408`) | Apple Maps | On a fresh device with Share on, it does not locate you (P3-DOLLYWOOD-LIVE-03) |
| Locate without GPS | Set my spot crosshair → I'm here (`apps/dollywood-live.html:1266, 1399`) | Apple Maps has no equivalent | None; 3 taps (§3) |
| Live ride waits | Queue-Times proxy with "posted N min ago", park-closed and offline states (`apps/dollywood-live.html:1499-1526`) | Dollywood app, Queue-Times, Thrill-Data | One feed ride silently unmatched (P3-DOLLYWOOD-LIVE-11); old waits stay on the chips and the hero while the map is open (P3-DOLLYWOOD-LIVE-15); no history or trend (GAP-DOLLYWOOD-LIVE-2) |
| Family locations | Share my spot per person (`apps/dollywood-live.html:1300-1311`), markers, trails (`apps/dollywood-live.html:1598`), Family pane | Find My | Off-site fixes still published (P3-DOLLYWOOD-LIVE-06); no arrival or leave alerts (GAP-DOLLYWOOD-LIVE-1) |
| A child's location | View-only unless an adult switches the beacon on (`apps/dollywood-live.html:693, 1307-1308`) | Find My for a child set up through Family Sharing | Guests can flip it (P3-DOLLYWOOD-LIVE-02); the switches are missing before anyone shares (P3-DOLLYWOOD-LIVE-05); the kid's open map ignores a switch in either direction (P3-DOLLYWOOD-LIVE-12, -13); the kid's own Share switch snaps back (P3-DOLLYWOOD-LIVE-16) |
| Meeting point | Pin, Go, long-press or "Meet here" on a ride card, 2 h expiry (`apps/dollywood-live.html:1457-1460, 1579-1591`) | Find My "notify when … arrives"; Disney party features | Rally push unreachable (P2-PWA-18); bar loses its walk time and Go (P3-DOLLYWOOD-LIVE-04); its age freezes and the 2 h expiry is skipped while the map stays open (P3-DOLLYWOOD-LIVE-18) |
| Walking directions | Turn-by-turn route to a ride, person, amenity or the meeting point (`apps/dollywood-live.html:1385`) | Apple Maps walking | None found (`audits/screens/dollywood-live/directions-steps-typical-iphone-pwa-dark.png`) |
| Who can ride | Kids' heights (`apps/dollywood-live.html:1546-1548`); "Next ride · door to seat" hero; kid filter chips | Dollywood app height filters | Waits rows only fade for a kid (UX-DOLLYWOOD-LIVE-5); guests can overwrite heights (P3-DOLLYWOOD-LIVE-02); Search's height select hides no-requirement rides (P3-DOLLYWOOD-LIVE-14); one tap per inch to enter a height (UX-DOLLYWOOD-LIVE-7) |
| Amenities | 63 restroom, first-aid, AED, nursing, stroller, lost-and-found and ATM markers; Nearby chips for four kinds (`apps/dollywood-live.html:1564-1575`) | Dollywood app amenity layer | Tapping a marker does nothing (P3-DOLLYWOOD-LIVE-08) |
| Search | The build guide's listings panel (`audits/screens/dollywood-live/search-query-typical-iphone-safari-dark.png`) | Apple Maps search | Not restyled for the park (UX-DOLLYWOOD-LIVE-4); the rider-height filter hides every no-requirement ride (P3-DOLLYWOOD-LIVE-14) |
| Hours, showtimes, dining | NOT FOUND IN CODE | Dollywood app, Thrill-Data | Out of scope for a family hub (GAP-DOLLYWOOD-LIVE-3) |
| Offline | The page and four rasters (relief, relief_soft, slope, illustrated_lo) are precached (`sw.js:16`); the Satellite style's `aerial.jpg` (`apps/dollywood-live.html:696`) is left out on purpose and cached on first use (`sw.js:15`, `scripts/bump-sw.mjs:18`), so Satellite has no image offline unless it was opened online earlier (not tested). Waits fall back to a cache of up to 6 h (`apps/dollywood-live.html:1504`) | Apple Maps offline maps | Positions are the last pull; no wider tiles (GAP-DOLLYWOOD-LIVE-4) |
| Notifications | A park-day "child's spot went quiet" push (P2-PWA-02); "Meet at <name>" on rally (P2-PWA-18) | Find My notifications | Both barely or never fire (Phase 2) |

## 3. Ease of use

Taps measured in `audits/tools/phase3/dollywood-live/measure.mjs` (evidence `audits/evidence/p3/dollywood-live/measure.json`) and `audits/tools/phase3/dollywood-live/geo.mjs` (`audits/evidence/p3/dollywood-live/geo.json`):

| Job | Profile | Path | Taps | Target ≤ 2 for the most frequent | Met? |
|---|---|---|---|---|---|
| Glance at the map and the waits (the most frequent) | Any adult, park day | Home "At the park" card → Open the map (`index.html:900`; `A_openFromHomeTaps: 1`, `A_homeHasParkCard: true`); the Waits list is one more tap on the Nearby / Waits segment. Measured on the park seed only | 1 (2 for the Waits list) | ≤ 2 | **Yes once someone shares; see next row** |
| Glance at the waits before anyone shares (start of a park day, or any other day) | Any | Apps tab → Dollywood park map tile → Waits segment. The Home card renders only when some `loc:` row is under 4 h old (`index.html:872-877, 890-900`); Phase 2 measured the 2-tap path (`audits/02-shell.md:605`) | 2 (3 for the Waits list) | ≤ 2 | **Partly** |
| See where the family is | Adult | Open the map: markers are drawn at once (`audits/evidence/p3/dollywood-live/geo-good-iphone.png`); the Family tab lists them | 1 (2 for the list) | ≤ 2 | **Yes** |
| Be located when Share my spot is already on | Adult, first open of the map on a device | Open the map → Find me, because the automatic resume fails (`geo.json` `A_firstOpen`: `shareOnNow true`, `watchId null`) | 2 (should be 1) | — | **No** (P3-DOLLYWOOD-LIVE-03) |
| Find yourself with no GPS | Adult | Open the map → Set my spot → I'm here (`A_setSpotTapsAfterMap: 2`) | 3 | — | **No** |
| Walk to the meeting point | Adult | Open the map → Go on the meeting bar | 2 when Go shows. After Set my spot or the first GPS fix, Go stays hidden until another device changes a family row (`audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-2.json`) | — | **Partly** (P3-DOLLYWOOD-LIVE-04) |
| Enter a kid's measured height | Adult with the kid, at the park | Open the map → Family tab → + once per inch from 36 (`apps/dollywood-live.html:1547-1548`; one family write per tap). Only when someone else is sharing (P3-DOLLYWOOD-LIVE-05) | 2 + 7 for 43" (2 + 12 for 48") | — | **No** (UX-DOLLYWOOD-LIVE-7) |

**Discoverability.**
- The meeting point can be dropped anywhere only by a long press (`apps/dollywood-live.html:1459-1460`); ride cards also offer "Meet here" (`apps/dollywood-live.html:1590-1591`).
- The "Meet here" dialog promises a Rally button that does not exist (P2-PWA-18).
- The kids' beacon and height controls are invisible until someone else is sharing (P3-DOLLYWOOD-LIVE-05).
- Amenity markers look tappable but do nothing (P3-DOLLYWOOD-LIVE-08), and the compass does something other than orient the map (P3-DOLLYWOOD-LIVE-09).

**Undo.** None anywhere. Clearing and setting the meeting point ask through `confirm()` (`apps/dollywood-live.html:1457, 1460, 1591`). A beacon switch or a height step applies at once with no undo (`apps/dollywood-live.html:1308, 1548`).

**Error prevention.**
- A restored, rough (over 150 m) or hand-placed fix is never published (`apps/dollywood-live.html:1250`).
- Heights are clamped to 28-72 in (`apps/dollywood-live.html:1548`); a meeting point expires after 2 h, but only when the map loads it again (`apps/dollywood-live.html:1579`; P3-DOLLYWOOD-LIVE-18); `loc:` rows over 24 h old are deleted by the next writing adult's device that opens the map (`apps/dollywood-live.html:1255`), not by the server.
- But a fix miles from the park is published (P3-DOLLYWOOD-LIVE-06), nothing stops a guest changing a child's beacon (P3-DOLLYWOOD-LIVE-02), and a parent's beacon-off is undone by the child's open map (P3-DOLLYWOOD-LIVE-12).

**One-handed phone use.** Find me and Whole park are 54×54 px at the bottom right, and the sheet tabs are 100×46 (`measure.json` `B_targets`), all in thumb reach. The pill and the meeting bar sit at the top (`apps/dollywood-live.html:516`, `top: calc(76px + safe area)`), and several controls are under 44 px: Set my spot 96×36, the meeting bar's Go and Done, the Nearby / Waits segment (VIS-DOLLYWOOD-LIVE-5).

**iPad glanceability at 2-3 m.** Not a board. On the iPad the pill title is 15.5 px, the subtitle 12.5, the meeting name 14.5, the tab labels 12, the section labels about 11.9 and the family labels about 8.7 px; a 2.5 m glance needs about a 65 px cap height (`measure.json` `C_ipadTextPx`, `glanceHeuristic`). That is the right call for a phone tool used in the park; the iPad's park glance is Home's card, which is Phase 2's.

**Pre-reader usability.**
- Kiara (view-only) gets the map, the markers and the waits. The kid ride card works without reading: faces with a ✓ for who can ride (`audits/screens/dollywood-live/ride-card-kid-typical-iphone-pwa-light.png`).
- Everything else needs reading: the pill ("Rides and the family, live / Kiara · just looking"), the Nearby text that points at a hidden button (UX-DOLLYWOOD-LIVE-2), the denied text for a kid whose beacon is on (UX-DOLLYWOOD-LIVE-1), and rides a kid is too short for, which only fade (UX-DOLLYWOOD-LIVE-5).
- The map and its controls use the adult scale in kid mode (`audits/screens/dollywood-live/kid-typical-ipad-portrait-dark.png`).

## 4. Issues and bugs

### Register

Sorted by severity. IDs follow filing order: 01-11 from the first pass, 12-18 from the completeness critic. The blocks below are in ID order. P3-DOLLYWOOD-LIVE-14 is a pointer to another app's primary: it keeps its ID and its place among the mediums, and the roll-up counts it under P3-DOLLYWOOD-06.

| ID | Severity | Defect |
|---|---|---|
| P3-DOLLYWOOD-LIVE-01 | critical | A profile or guest name runs as script in everyone's park map; the admin's tokens can be read and replayed |
| P3-DOLLYWOOD-LIVE-02 | high | The shipped UI lets a guest switch a child's location beacon on or off and overwrite the kids' heights |
| P3-DOLLYWOOD-LIVE-03 | medium | On a device's first open, the map says you are not sharing though Share my spot is on, and never locates you |
| P3-DOLLYWOOD-LIVE-04 | medium | After you locate yourself, the meeting-point bar has no walk time and no Go, and does not heal on its own |
| P3-DOLLYWOOD-LIVE-05 | medium | An adult cannot switch on a kid's beacon or set heights until someone else is already sharing |
| P3-DOLLYWOOD-LIVE-06 | medium | With Share my spot left on, opening the map away from the park publishes a home position, and Home says "At the park" |
| P3-DOLLYWOOD-LIVE-07 | medium | An old fix outside the map frame reads as a live position, with no "Last seen" and no Find me chip |
| P3-DOLLYWOOD-LIVE-08 | medium | Tapping a restroom, first-aid, AED or other amenity marker does nothing |
| P3-DOLLYWOOD-LIVE-09 | medium | Every tap of the compass jumps the view to the Entrance, and the first tap does not rotate anything |
| P3-DOLLYWOOD-LIVE-10 | medium | On iPhone the pill cuts off the location-denied instructions before "or use Set my spot" (from the visual check) |
| P3-DOLLYWOOD-LIVE-12 | medium | Switching a kid's beacon off while the kid's map is open does not hide the kid: the kid's phone republishes its spot and the last position stays (from the completeness critic; lowered from high) |
| P3-DOLLYWOOD-LIVE-13 | medium | Switching a kid's beacon on does nothing on the kid's open map until it is closed and reopened, while the parent's switch says it is sharing (from the completeness critic) |
| P3-DOLLYWOOD-LIVE-14 | pointer → P3-DOLLYWOOD-06 (medium) | Search's "rider height: up to N" filter hides every listing with no height requirement (carousel, train, playgrounds) (from the completeness critic) |
| P3-DOLLYWOOD-LIVE-11 | low | A waits-feed ride whose name differs from the listing (the Dollywood Express) silently shows no wait |
| P3-DOLLYWOOD-LIVE-15 | low | After the waits feed fails, a map left open keeps showing the last waits as current on the chips, the Next-ride hero and the directions bar, past the app's own 6 h limit (from the completeness critic) |
| P3-DOLLYWOOD-LIVE-16 | low | A kid with his beacon on gets a "Share my spot" switch that cannot be switched off: it snaps back on and his spot is republished (from the completeness critic) |
| P3-DOLLYWOOD-LIVE-17 | low | On a location denial the error handler bypasses the app's designed "denied" state, so no Set my spot chip appears until the app is backgrounded (from the completeness critic; was UX-DOLLYWOOD-LIVE-1's first bullet) |
| P3-DOLLYWOOD-LIVE-18 | low | While the map stays open, the meeting point never expires and its "set by … N min ago" age never updates (from the completeness critic) |

### Phase 2 defects that show up here

- **P2-PWA-18** (medium). "Rally the family" cannot be sent from any screen. Here: accepting "Meet here" on Thunderhead set the pin but sent 0 requests to `/api/dollywood/rally` (`audits/evidence/p3/dollywood-live/rally-guest-loading.json` `A_meetHere.rallyRequests: 0`). The dialog still says "Tap Rally afterwards to buzz the other adults" (`apps/dollywood-live.html:1591`), `rally()` has no caller (`apps/dollywood-live.html:1589`), and Done is a plain `hub.remove` (`apps/dollywood-live.html:1588`), so the "Meet at <name>" push (`worker/src/index.js:97`) and `DELETE /api/dollywood/rally` are unreachable.
- **P2-PWA-02** (high). The "Park day: a child's spot goes quiet" push that this app's `loc:` rows feed can fire only on the 8 am / 8 pm cron with a narrow window. The Me switch promises it (`index.html:1269`). Not re-run.
- **P2-CHAT-02** (medium). `dollywood-live` has no `visibleTo` (`apps.json:10`), so chat's kid guard does not cover it: a kid can rewrite this app's adult-only family rows (`meet`, `kidshare:*`, `loc:*`, `kid:*`) through chat. The map UI keeps them adult-only (`apps/dollywood-live.html:693, 1307, 1546, 1587`). Not re-run.
- **P2-PROF-05** (medium). The server does not enforce kid limits on these family rows. P3-DOLLYWOOD-LIVE-02 is a related new trigger (a guest, through the shipped UI), not a facet of it. Its ruling that a kid's position inside the household's family rows is not a high kids' privacy issue (`audits/02-shell.md:1270`) is the precedent the skeptics used to lower P3-DOLLYWOOD-LIVE-12 to medium.
- **P2-SYNC-15** (low). `hub.sync.state` starts as `'offline'`, which shows here as the Family header "offline — showing last known" on every cold open (UX-DOLLYWOOD-LIVE-3).
- **P2-SYNC-02** (critical). Same root cause as P3-DOLLYWOOD-LIVE-03: `hub.ready`'s `seen` is true when any channel has been pulled (`apps/hub.js:334`; `audits/02-shell.md:2398`). Here the effect is a missed GPS resume, not a write.
- **P2-VIS-03** (medium). Hearth on a dark-OS device: in this app `data-scheme` reads `light` while the body paints `rgb(26, 21, 18)` (`audits/evidence/p3/dollywood-live/theme-denied.json` `hearthOnDarkOS`). A shell theme-resolution issue; the park map follows whatever the shell resolves.
- **P2-STAB-01** (critical). With Reduce Motion on, the whole hub is blank, so the park map cannot be reached. The app's own reduced-motion rule removes transitions only (`apps/dollywood-live.html:139`). Not re-run.
- **P2-SYNC-01** (critical). Whole-row `progress` under last-write-wins in the build guide. The park map keeps the guide's keyboard path (D → `stepDone` → `hub.set('progress')`, `apps/dollywood-live.html:856, 1086, 1062`), which writes this app's own hidden person scope. Not run.
- **Phase 2 "OK: no stored XSS"** (`audits/02-shell.md:2000-2007`) is contradicted for this app by P3-DOLLYWOOD-LIVE-01; Phase 2's no-CSP gap (`audits/02-shell.md:2009`) is what lets the script reach the tokens.

### From another app's Phase 3 report

- **P3-DOLLYWOOD-16** (medium, build guide, `audits/03-apps/dollywood.md`). The same keydown handler, which ignores Ctrl/Cmd/Alt, ships here (`apps/dollywood-live.html:852`, template :849, `../dollywood-build-project/scripts/template.html:849`). Its D path is the `hub.set('progress')` write noted under P2-SYNC-01. By code; not run.
- **P3-DOLLYWOOD-06** (medium, build guide, `audits/03-apps/dollywood.md`). Primary for the rider-height filter (P3-DOLLYWOOD-LIVE-14).
- **P3-TALLY-05** (critical, Tally, `audits/03-apps/tally.md`; shell cause). `dollywood-live|person` (the Share my spot `share` row, `apps/dollywood-live.html:1310`) is not a shell channel: the shell declares only `dollywood-live|family` (`index.html:458-459`). A toggle queued offline when the map closes waits until it reopens. By code; not run.

### Confirmed defects

#### P3-DOLLYWOOD-LIVE-01 — A profile or guest name runs as script in everyone's park map; the admin's tokens can be read and replayed

- **Severity: critical** (skeptics: critical / critical; unchanged from the investigator's rating). Rule (b): another person's account, the admin's included, can be taken over. The script can read `hub.session` and `hub.device`, and a skeptic replayed them from another client: `/api/me` answered 200 as Eli with `isAdmin: true`. It needs only the shipped UI (Me → Add a guest, Share my spot, opening the map), so there are no grounds to downgrade.
- **Exposure.** An adult types an HTML name for a guest in Me → Add a guest (40-character limit, `index.html:1396`), perhaps copying what the guest said; the admin could do the same through Edit. That profile then has a `loc:` row under 24 h old, which happens when it switches on Share my spot with a GPS fix on the park map. Anyone signed in who then opens the park map runs the script: the admin, the kids and the other adults.
- **Related.** New. It contradicts Phase 2's "OK: no stored XSS" (`audits/02-shell.md:2000-2007`), which tested the picker, Home, Me and the TV but not this app. The no-CSP gap (`audits/02-shell.md:2009`) is why the script reaches the tokens. The investigator's p2Ref P2-PROF-05 is unrelated (both skeptics). P3-PRAYER-06 and P3-PRAYER-17 (Prayer, high, need a hand-made request; `audits/03-apps/prayer.md`) are the other stored-XSS sinks found in Phase 3. All three contradict Phase 2's "OK: no stored XSS", and the no-CSP, unsandboxed app iframe (`index.html:413`) is the shared amplifier.

**What happens now.**
- `publish()` writes the person's name into the family row `loc:<id>` (`apps/dollywood-live.html:1253`). The server stores any name, only trimmed and cut to 40 characters (`worker/src/index.js:178-179`).
- `renderFam()` builds the Family list with `innerHTML`, interpolating `${f.name||id}` and `${f.emoji}` unescaped (`apps/dollywood-live.html:1306`). The family card `showFamily()` does the same (`apps/dollywood-live.html:1316`), and so does the sharer's own row with `${hub.profile.name}` (`apps/dollywood-live.html:1302`).
- `loadFam()` calls `renderFam()` at map start and on every family pull (`apps/dollywood-live.html:1256, 1482`), filling the hidden `#fam-list`. The payload therefore runs as soon as the map opens, before anyone taps the Family pane.
- The app iframe has no sandbox (`index.html:413`) and shares the origin's localStorage, where the hub keeps both tokens; there is no Content-Security-Policy.

**Expected.** Names and emoji are escaped with `hub.escape` (`apps/hub.js:436`) or set with `textContent`, as on the picker, Home, Me and the TV (`audits/02-shell.md:2005`).

**Why it matters to the household.** A guest's name, typed in good faith or not, can hand whoever planted it the admin's account the next time Eli opens the map on a park day. The admin can reset PINs, rotate the pairing code and unpair devices. The kids' pages run the same script.

**Evidence.**
- Code: `apps/dollywood-live.html:1253, 1256, 1302, 1306, 1316, 1482`; `worker/src/index.js:178-180`; `index.html:413, 1396`; `apps/hub.js:436`.
- Investigator run: `audits/evidence/p3/dollywood-live/xss-guest-name.json`. The guest was added through the real `POST /api/profiles` (status 200, `storedName` the payload); a live `<img onerror>` fired in the guest's own page and in Eli's, Ezra's and Mom's pages (`viewers.*.dialogs` non-empty, `liveImgNodesInFamilyPane` present). A 40-character `import('//e.test/x')` payload was also accepted (`importPayloadAccepted.status: 200`). Screenshot: `audits/evidence/p3/dollywood-live/xss-guest-eli-family-ipad.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-xss-family-name-unescaped-1.json`, `audits/evidence/p3/dollywood-live/verify-xss-family-name-unescaped-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-xss-family-name-unescaped-1-eli-family-ipad.png`, `audits/evidence/p3/dollywood-live/verify-xss-family-name-unescaped-2-eli-family-ipad.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/xss-guest-name.mjs"` (API path), or `node "audits/tools/phase3/dollywood-live/verify-xss-family-name-unescaped-2.mjs"` (typed into the real Add a guest sheet; replays the tokens against the local `/api/me` only).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-xss-family-name-unescaped-1.mjs"` (park seed, real clock, WebKit). Mom typed `<img src=x onerror=PWN=localStorage>` (36 characters) into the real Me → Add a guest sheet; Mom's own guest list stayed inert (0 live nodes). The guest shared from an iPhone with a GPS fix, and the server row's `name` was the payload. The payload ran in the guest's page, in Eli's iPad page (`isAdmin: true`) and in Ezra's iPhone page (kind kid): each showed `pwnSet: true`, `pwnSeesHubSession: true`, `pwnSeesHubDevice: true`, and `pwnSetBeforeOpeningFamilyPane: true`. Tapping the row on Eli's iPad ran it again in the card (`liveImgInPop: 1`). Token values were never printed.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-xss-family-name-unescaped-2.mjs"` (park seed, real clock, WebKit), independent of the investigator's API path. Mom typed `<img src=x onerror=top.XS=localStorage>` (39 characters) into the sheet (`momPageExecuted: false`). The guest signed in on a second paired device, got a fix and switched on Share my spot. Eli opened the map on the iPad: `eliBeforeFamilyPane: true`, `sessionProfileReadable: "eli"`, `sessionIsAdmin: true`, `cardPathExecuted: true`. The Family row's name element had empty `textContent` and a live `<img>` as its `innerHTML`. Replaying the read session and device tokens from Node against the local `/api/me`: `status 200, profileId "eli", isAdmin true`.

**Corrected claim.** Confirmed, with three corrections from the skeptics.
1. **The trigger is broader.** The victim does not have to open the Family pane: the script runs as soon as any signed-in person opens the park map while the row is under 24 h old, and again on each pull. The family card (`apps/dollywood-live.html:1316`) and the sharer's own row (`apps/dollywood-live.html:1302`) are further sinks.
2. **The impact is proven, not inferred:** read-and-replay of the admin's tokens gave a full admin session on the local instance. Sending the tokens off the device was not tested (no network target), but a 40-character `import()` payload fits and was accepted.
3. **p2Ref:** new, related to Phase 2's SEC notes, not to P2-PROF-05.

The emoji is also unescaped in the same markup, but the server caps it at 8 characters (`worker/src/index.js:180`), so it is not a practical vector. `renderKids()` interpolates `${k.name}` unescaped as well (`apps/dollywood-live.html:1547`); kid names are set only by the admin, and this was not tested. The fix belongs in `../dollywood-build-project/scripts/template.html:1430, 1434, 1444, 1674-1675` (the sharer's own row, the Family list, the family card and `renderKids`), followed by an export.

#### P3-DOLLYWOOD-LIVE-02 — The shipped UI lets a guest switch a child's location beacon on or off and overwrite the kids' heights

- **Severity: high** (skeptics: high / high; unchanged). Under the rule this is a privacy and safety issue for kids that is not a hole under (b): the location goes only to the household and its invited guests, who already see everyone's dots, and the kid's own device must still open the map and get a fix. It is not (a): the change is a visible, deliberate edit.
- **Exposure.** A guest signed in (the seeded Grandma Jo opens on tap) on a day when another person has a `loc:` row, because the block renders only then (P3-DOLLYWOOD-LIVE-05).
- **Related.** A new trigger related to P2-PROF-05: a different actor (a guest) through the shipped UI, not a kid through hand-made requests. Phase 2 deferred this case to Phase 3 (`audits/02-shell.md:1638`). How the kid's open map reacts to either switch is P3-DOLLYWOOD-LIVE-12 and -13.

**What happens now.** The Kids' beacons block is gated only on `hub.profile.kind==='adult'&&hub.canWrite` (`apps/dollywood-live.html:1307`), and the heights stepper hides only when `kind!=='adult'` (`apps/dollywood-live.html:1546`). Guests are kind `adult` with `is_guest` set, so they get both. A switch writes `kidshare:<kid>` and, when switched off, removes `loc:<kid>` (`apps/dollywood-live.html:1308`); a stepper writes `kid:<id>` (`apps/dollywood-live.html:1548`). Once `kidshare:<kid>` is true, the kid's device may locate and publish (`apps/dollywood-live.html:693-694, 1601`) from its next open of the map: a kid map that is already open does not start (P3-DOLLYWOOD-LIVE-13).

**Expected.** Only household adults (kind `adult` and not `is_guest`) see and use these controls. Every other kid or household control already excludes guests: rally (`worker/src/index.js:92`), Me's Add a guest and Kids' rewards (`index.html:1256, 1272, 1351`), with `isGuest()` at `index.html:475`. The one exception is the map's own meeting point: setting it (long press or Meet here) and clearing it (Done) are also open to guests, because those gates check only `kind==='adult'` (`apps/dollywood-live.html:1440, 1459-1460, 1585-1586`; noted by Phase 2 at `audits/02-shell.md:3796`), while the rally route is household-only (`worker/src/index.js:92`).

**Why it matters to the household.** A visitor can start broadcasting a 4- or 5-year-old's live position that the parents left off, or switch off a beacon a parent turned on. Switching off removes `loc:<kid>`, so the parents lose the child's live marker; but a kid device with the map open republishes it within seconds, and the last position then stays on the map (P3-DOLLYWOOD-LIVE-12). A tap on a stepper overwrites the height a parent measured, and the who-can-ride filter follows it.

**Evidence.**
- Code: `apps/dollywood-live.html:693-694, 1307-1308, 1546-1548, 1601`; `index.html:475`; `worker/src/index.js:92`.
- Investigator run: `audits/evidence/p3/dollywood-live/rally-guest-loading.json` (`B_guest`: `isGuest true`, `beaconSwitches 2`, `heightSteppers 4`; `B_guestFlippedBeacon` wrote `kidshare:ezra = false`); `audits/evidence/p3/dollywood-live/rally-guest-family-iphone.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-guest-can-flip-kid-beacon-1.json`, `audits/evidence/p3/dollywood-live/verify-guest-can-flip-kid-beacon-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-guest-can-flip-kid-beacon-1-guest-family-iphone.png`, `audits/evidence/p3/dollywood-live/verify-guest-can-flip-kid-beacon-1-guest-after-iphone.png`, `audits/evidence/p3/dollywood-live/verify-guest-can-flip-kid-beacon-2-guest-family-iphone.png`. At 430 px the switches are below the fold; the JSON records them.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/rally-guest-loading.mjs"` (section B), or either skeptic script below.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-guest-can-flip-kid-beacon-1.mjs"` (park seed, WebKit, real clock, UI only). Grandma Jo on a new paired phone saw `{kind:'adult', is_guest:true, canWrite:true}`, beacon switches for Ezra (on) and Kiara (off), both group headings and 4 steppers. One tap turned `kidshare:ezra` from true to false; a stepper tap changed `kid:ezra` from `{height_in:43, by:'mom'}` to `{height_in:42, by:'guest-grandmajo'}`. Ezra's phone then showed `kidshareSeen: false`, `viewOnly: true`, the locate button hidden and the pill "Rides and the family, live": his device could no longer publish. Ezra's own pane had 0 switches and 0 steppers (baseline).
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-guest-can-flip-kid-beacon-2.mjs"` (park seed, WebKit, real clock). The guest switched Kiara's beacon on (`kidshare:kiara = true`, a row that did not exist before) and stepped Ezra's height from 43 to 44 (`by: 'guest-grandmajo'`). For contrast, `POST /api/dollywood/rally` as the same guest returned `403 adults_only`.

**Corrected claim.** Accurate, and widened: it works in both directions (off, which also removes the child's `loc:` row unless the kid's open map republishes it, P3-DOLLYWOOD-LIVE-12; and on, which takes effect from the kid's next open of the map, P3-DOLLYWOOD-LIVE-13), and a guest also overwrites the parents' measured heights. The case for "household adults only" rests on the codebase's consistent pattern, not on a written rule: `worker/README.md:112` calls a guest "an ordinary adult profile", and CLAUDE.md says a beacon is switched on by "an adult". The fix is one gate in `../dollywood-build-project/scripts/template.html:1435` and in `renderKids` (`../dollywood-build-project/scripts/template.html:1674`), then an export.

#### P3-DOLLYWOOD-LIVE-03 — On a device's first open, the map says you are not sharing though Share my spot is on, and never locates you

- **Severity: medium** (skeptics: medium / medium; **lowered** from the investigator's high). It goes against the code's own intent (the comment at `apps/dollywood-live.html:1486`: "sharing already on for this person: resume without a tap") and reproduces on WebKit and Chromium. It is not high: it happens once per person per device, one tap on the pill's Find me starts GPS and sharing, the next open resumes normally, and nothing is lost.
- **Exposure.** The device boots to Home, whose shell pulls the `dollywood-live` family channel (`index.html:459`), and this person has no cached `dollywood-live` person scope on it: Share was switched on from another device, a newly paired phone, or cleared site data. A cold deep link straight to `#dollywood-live` is not affected, and nor is any later open.
- **Related.** Same root cause as P2-SYNC-02 (`hub.ready`'s global `seen`, `apps/hub.js:334`; `audits/02-shell.md:2398`), different effect. It is the permanent form of the loading-copy lead (`audits/01-leads.md:316`, UX-DOLLYWOOD-LIVE-3).

**What happens now.** `hub.ready` resolves at once because another channel has already been pulled (`apps/hub.js:334-337`). `liveInit` then runs `if(shareOn())startGps()` (`apps/dollywood-live.html:1486`) before the person-scope `share` row arrives, so `shareOn()` is false. Nothing checks again after the pull: `onSync` only re-renders the Family list (`apps/dollywood-live.html:1483`). The pill stays "Where are you? / Only you see your dot until you switch on Share my spot" (`apps/dollywood-live.html:1269`) while the Family pane's Share switch shows on.

**Expected.** After the person pull, re-check `shareOn()` and start GPS; the pill never says "not sharing" while Share is on.

**Why it matters to the household.** A parent who switched on sharing is told, on the phone they just opened at the park, that only they can see their dot, and the family cannot see them until they tap Find me. A parent who believes the pill and taps the (already checked) Share switch "to switch it on" would switch sharing off; that follow-on was not tested.

**Evidence.**
- Code: `apps/dollywood-live.html:694, 1269, 1483, 1486`; `apps/hub.js:334-337`; `index.html:459`.
- Investigator run: `audits/evidence/p3/dollywood-live/geo.json` (`A_firstOpen`: `shareOnNow true`, `shareRowNow true`, `familyPaneSwitchChecked true`, `watchId null`, pill `idle`; `A_firstOpenAfter39s`: unchanged, `writesSoFar 0`; `B_secondOpen`: `good`, "At Thunderhead · ± 20 ft · sharing"); `audits/evidence/p3/dollywood-live/geo-first-open-iphone.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-first-open-gps-not-resumed-1.json`, `audits/evidence/p3/dollywood-live/verify-first-open-gps-not-resumed-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-first-open-gps-not-resumed-1-A-first-open.png`, `audits/evidence/p3/dollywood-live/verify-first-open-gps-not-resumed-1-B-second-open.png`, `audits/evidence/p3/dollywood-live/verify-first-open-gps-not-resumed-2-first-open-webkit.png`, `audits/evidence/p3/dollywood-live/verify-first-open-gps-not-resumed-2-first-open-chromium.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/geo.mjs"` (A vs B), or `node "audits/tools/phase3/dollywood-live/verify-first-open-gps-not-resumed-2.mjs"` (WebKit and Chromium).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-first-open-gps-not-resumed-1.mjs"` (park seed, real clock, WebKit, iPhone PWA as Eli). It granted geolocation and set the position before the shell loaded, ruling out a timing confound in the investigator's script, and counted `watchPosition` calls in the map frame. A (Home first): a person pull landed about 196 ms after the open, yet `watchPositionCalls 0`, `watchId null`, `shareOnNow true`, the Share switch checked and the idle pill; unchanged after 40 s. B (second open): 1 call at 191 ms, pill `good`. C (fresh device deep-linking to `#dollywood-live`): 1 call at 387 ms, pill `good`.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-first-open-gps-not-resumed-2.mjs"` on WebKit and on Chromium. Before the open only `hub.cache.dollywood-live.family` existed. On both engines `shareOn()` was true from the first sample, yet `watchId` was null in all 12 one-second samples and at 45 s (past a 30 s pull), with the idle pill and `sync 'synced'` while `#lv-share` was checked. One tap on the locate button gave "At Thunderhead · ± 20 ft · sharing"; the second open resumed.

**Corrected claim.** Narrowed to its precondition: the first open of the park map for a person on a device with no cached `dollywood-live` person scope, reached from Home. A deep link and every later open work. One tap on the pill's Find me recovers. Severity medium.

#### P3-DOLLYWOOD-LIVE-04 — After you locate yourself, the meeting-point bar has no walk time and no Go, and does not heal on its own

- **Severity: medium** (skeptics: medium / medium; unchanged). A secondary flow (walking to the meeting point) is missing its action and is misleading. The meeting point's name and its pin stay correct, and nothing is lost, so it is not high. That the bar stays broken for as long as the map is open when nobody else is sharing supports medium over low.
- **Exposure.** Anyone who opens the map with a meeting point set and no restored position from an earlier session, then uses Set my spot or gets a first GPS fix. It lasts until another device changes a family `loc:`, `meet` or `kid` row, or the map is reopened.
- **Related.** The same root cause (the bar is re-rendered only through `loadMeet`, never on a timer) also freezes the bar's "N min ago" and skips the 2 h expiry while the map stays open. That is filed separately as P3-DOLLYWOOD-LIVE-18, because its trigger (time passing) and its fix (re-run `loadMeet` on the 30 s timer, `apps/dollywood-live.html:1484`) differ from this one's (`renderMeet` from `setMe`).

**What happens now.** `setMe()` calls `drawMe`, `updLoc`, `renderNear`, `renderFam` and `publish`, but not `renderMeet` (`apps/dollywood-live.html:1245`). `renderMeet` is called only from `loadMeet`, `setMeet` and `clearMeet` (`apps/dollywood-live.html:1579, 1587, 1588`). `loadMeet` runs at start and from `loadFam` (`apps/dollywood-live.html:1256, 1483`), and `loadFam` runs only when another device changes a family row. The 30 s timer only redraws the family (`apps/dollywood-live.html:1484`). So the bar keeps "set by Mae 12 min ago" with Go hidden (`renderMeet` shows Go only with a walk time, `apps/dollywood-live.html:1583-1584`). Once a walk time does show, it does not update as you walk.

**Expected.** Placing yourself or a new fix refreshes the bar: walk time and Go at once, updated as you move.

**Why it matters to the household.** The moment after "where am I?" is when a parent wants "how far to the meeting point, and Go". The bar gives neither, with no hint why.

**Evidence.**
- Code: `apps/dollywood-live.html:1245, 1256, 1399, 1483-1484, 1579, 1583-1588`; `apps/hub.js:286-300` (pulls emit only changed rows).
- Investigator run: `audits/evidence/p3/dollywood-live/functional.json` (`meetBarAfterPlace`: "set by Mae 12 min ago", `goHidden true`; `meetBarAfterSync`: "2 min walk · …", `goHidden false`; the "after sync" state came from calling `loadMeet()` by hand).
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-1.json`, `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-1-A-after-place.png`, `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-1-B-after-45s-idle.png`, `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-1-C-after-family-change.png`, `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-1-D-after-gps-fix.png`, `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-2-A2-after-40s-no-remote.png`, `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-2-B2-gps-after-40s.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-meet-bar-stale-after-place-2.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-meet-bar-stale-after-place-1.mjs"` (park seed, real clock, WebKit, iPhone PWA as Eli). After Set my spot → I'm here: "set by Mae 12 min ago", `goHidden true`. After 45 s idle with 2 family pulls: unchanged. After Mom's `loc:` row changed on the server: healed 9 s later ("2 min walk · …", Go shown). Control: `renderMeet()` by hand fixed it at once. On a third device the first GPS fix left the bar the same way.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-meet-bar-stale-after-place-2.mjs"` (park seed, real clock, WebKit). A1 after placing: Go hidden. A2 after 40 s with no remote change: unchanged, `sync 'synced'`. A3 after Mom's write through the local API: healed 11 s later. B1 after the first GPS fix ("You're in Timber Canyon"): Go hidden; B2 after 40 s of walking: still no walk time.

**Corrected claim.** Widened by both skeptics. The bar also goes stale after the first GPS fix, not only after Set my spot (both paths go through `setMe`). It does **not** self-heal on the next 30 s sync, as the investigator wrote: it heals only when another device changes a family row (on a busy park day that is usually within about 30 s, which is why it looked self-healing), or on reopening the map. When nobody else is sharing, it stays without walk time and Go for as long as the map is open, and the walk time never follows you.

#### P3-DOLLYWOOD-LIVE-05 — An adult cannot switch on a kid's beacon or set heights until someone else is already sharing

- **Severity: medium** (skeptics: medium / medium; unchanged). A secondary setup flow is unreachable in the normal pre-trip state. No data is lost and nothing is exposed; the controls come back once another member's marker exists, and heights entered earlier still drive who-can-ride.
- **Exposure.** Any time no other person has a `loc:` row (an ordinary day, or the start of a park day). An adult's own sharing never counts, because `loadFam` skips the viewer's own row (`apps/dollywood-live.html:1254`); an old greyed row 4-24 h old does count.

**What happens now.** `renderFam()` returns right after the "No one else is sharing right now…" line when there are no other rows (`apps/dollywood-live.html:1304`), before the Kids' beacons block (`apps/dollywood-live.html:1307`) and before `renderKids()` (`apps/dollywood-live.html:1309`), which is its only call site. So the separate `#kid-list` heights container (`apps/dollywood-live.html:633`) stays empty too.

**Expected.** The adult beacon and height controls render whether or not anyone else is sharing. CLAUDE.md says an adult switches a kid's beacon on "in the map's Family pane"; nothing ties it to other people sharing.

**Why it matters to the household.** The natural time to set up a child's beacon and enter heights is before the family sets off, exactly when nobody is sharing yet. On an ordinary day the seeded heights (43" and 40") cannot be seen or corrected from the map.

**Evidence.**
- Code: `apps/dollywood-live.html:633, 1254, 1304, 1307, 1309, 1546`; source `../dollywood-build-project/scripts/template.html:1432`.
- Capture: `audits/screens/dollywood-live/family-kids-empty-ipad-portrait-light.png` (Share Off, "Eli (you) no fix yet", "No one else is sharing", no kids' sections).
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-1.json`, `audits/evidence/p3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-1-A-eli-family-ipad.png`, `audits/evidence/p3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-1-B-eli-family-ipad.png`, `audits/evidence/p3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-2-A-ipad.png`, `audits/evidence/p3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-2-C-ipad.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-2.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-1.mjs"` (typical seed, real clock, WebKit, Eli on the iPad). With only `kid:ezra` and `kid:kiara` on the server: 0 beacon switches, no group heading, 0 steppers, `#kid-list` empty, although `hub.people()` lists both kids and Eli is an adult with `canWrite`. After Mom switched on Share my spot in the UI on her own phone: the pane gained "Kids' beacons" with 2 switches and 2 steppers.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-beacon-height-controls-missing-when-nobody-sharing-2.mjs"` (typical seed, real clock, WebKit). A: the empty line, 0 switches, 0 steppers. B: after Eli switched on his own Share my spot, still 0 and 0. C: after Mom's `loc:mom` PUT (200) and a pull, groups `["Kids' beacons", "Kids' heights"]`, 2 switches, 4 steppers.

**Corrected claim.** Accurate as filed, made precise: the trigger is "no other person has any `loc:` row"; the adult's own sharing never brings the controls back; the height steppers vanish too, even when heights are already stored.

#### P3-DOLLYWOOD-LIVE-06 — With Share my spot left on, opening the map away from the park publishes a home position, and Home says "At the park"

- **Severity: medium** (skeptics: medium / medium; unchanged). A secondary surface (Home's "At the park" card and its count) misleads the whole household. No data is lost, and there is no access-control hole: the person chose to share, and the row stays in family scope. The park map itself labels the person correctly.
- **Exposure.** An adult or guest who switched Share my spot on at an earlier visit opens the park map away from the park, for example to check waits at home. Share is a persistent person setting, and GPS resumes without a tap (`apps/dollywood-live.html:1486`). Publishing happens only while the map is open and visible (`apps/dollywood-live.html:1475`).

**What happens now.** `publish()` writes `loc:<id>` for any GPS fix under 150 m accuracy and never checks `onProperty()` (`apps/dollywood-live.html:1250`, `onProperty` at `apps/dollywood-live.html:1170`). Home's `atPark()` counts every `loc:` row under 4 h old, with no position test (`index.html:872-877`). The same row also makes the Worker's park-day job treat the day as a park day (`worker/src/reminders.js:210-212`). Chat's `where_is_family` returns the same row too, as "x/y are Dollywood map positions from the Dollywood Live app", with no on-property test (`worker/src/chat.js:284-289`); what the model then says was not tested.

**Expected.** A fix that is not on the property is not published (or is marked off-property), and Home's park card ignores off-property rows.

**Why it matters to the household.** For up to 4 hours every Home in the house, the Kitchen iPad included, says a person is "At Dollywood · last seen just now" while they are at home.

**Evidence.**
- Code: `apps/dollywood-live.html:1170, 1177, 1213, 1250, 1475, 1486`; `index.html:872-877, 890-900`; `worker/src/reminders.js:210-212`; `worker/src/chat.js:284-289`.
- Investigator run: `audits/evidence/p3/dollywood-live/geo.json` (`D_atHome`: pill `far`, "7.4 mi from the park"; `D_serverLocEli` x -9000 y 10000 published; `D_momHomeParkCard` "At the park 4 of the family … Eli just now"); `audits/evidence/p3/dollywood-live/geo-far-mom-home-ipad.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-publish-off-site-1.json`, `audits/evidence/p3/dollywood-live/verify-publish-off-site-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-publish-off-site-1-mom-home-ipad.png`, `audits/evidence/p3/dollywood-live/verify-publish-off-site-1-eli-iphone-far.png`, `audits/evidence/p3/dollywood-live/verify-publish-off-site-2-mom-home-ipad.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-publish-off-site-2.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-publish-off-site-1.mjs"` on the typical seed (no `loc:` rows before), so Home's count comes only from the off-site publish. Eli switched on Share and tapped locate at map point (-9000, 10000): pill `far` "7.4 mi from the park", `onProperty false`, one POST writing `loc:eli`. Mom's Home: "At the park Eli At Dollywood · last seen just now … Open the map" and the hero "1 at the park". Mom's park map: no marker (`famGroupChildren 0`), Family row "Eli away from the park · just now".
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-publish-off-site-2.mjs"` (typical seed, real clock, WebKit). With `share=true` already set, reopening the map resumed GPS without a tap (`watching true`) and published `loc:eli` at (-9000, 10000) within 7 s. Mom's Home showed the same "At the park … last seen just now" card and "1 at the park"; Mom's map said "away from the park" with no marker.

**Corrected claim.** Two parts of the investigator's wording were wrong. (1) The park map does not show the person "At Dollywood": its Family list says "away from the park" and draws no marker (`apps/dollywood-live.html:1177, 1213`); only Home's card and hero are wrong. (2) The trigger is opening the map off-site with Share still on, not "driving home": the watch stops when the page is hidden (`apps/dollywood-live.html:1475`), so after a drive with the map closed Home shows the last in-park fix for the intended 4 h. The off-site row stays in D1 until some adult (or a kid whose beacon is on) opens the map more than 24 h later; only then does that client tombstone it (`apps/dollywood-live.html:1255`; no server retention: `worker/src/chat.js:286` and `worker/src/reminders.js:220` only read it). (Corrected by the completeness critic: an earlier draft said the row "lives up to 24 h".)

#### P3-DOLLYWOOD-LIVE-07 — An old fix outside the map frame reads as a live position, with no "Last seen" and no Find me chip

- **Severity: medium** (skeptics: medium / medium; unchanged; skeptic 2 called it borderline low). The pill's status line is misleading, a secondary flow. Restored fixes are never published (`apps/dollywood-live.html:1250`), so only the viewer's own pill is wrong, and the ◎ locate button stays on screen.
- **Exposure.** Any reopen within 12 h of a fix outside the map frame (`apps/dollywood-live.html:1478` restores anything under 12 h), until GPS resumes or the first fresh fix arrives. An 11-hour-old parking-lot fix reads exactly like a 90-minute one.

**What happens now.** In `updLoc()`, the "arriving" and "far" branches (`apps/dollywood-live.html:1270-1274`) never consult the computed `stale` flag (`apps/dollywood-live.html:1264`); only the in-frame branch does (`apps/dollywood-live.html:1279`). A restored parking-lot fix reads "At Dollywood — the parking lots / 350 ft N of the map · gates 0.9 mi, 19 min walk · ± 30 ft"; an 8.5 mi fix reads "8.5 mi from the park". The only stale cue is the amber title (`.warn`, `apps/dollywood-live.html:1282, 552`).

**Expected.** The same stale treatment as in the frame: "Last seen N ago" and a Find me chip.

**Why it matters to the household.** Reopening the map the next morning, a parent sees "At Dollywood — the parking lots" with a precise "± 30 ft", as if they were arriving now.

**Evidence.**
- Code: `apps/dollywood-live.html:1250, 1264, 1270-1274, 1279, 1282, 1478`.
- Investigator run: `audits/evidence/p3/dollywood-live/states.json` (`A_arriving` and `B_far`: `stale true`, `act null`; `C_inFrame`: "Last seen 2 h ago" + Find me); `audits/evidence/p3/dollywood-live/states-arriving.png`, `audits/evidence/p3/dollywood-live/states-far.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-out-of-frame-stale-reads-live-1.json`, `audits/evidence/p3/dollywood-live/verify-out-of-frame-stale-reads-live-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-out-of-frame-stale-reads-live-1-arriving_90min.png`, `audits/evidence/p3/dollywood-live/verify-out-of-frame-stale-reads-live-1-far_90min.png`, `audits/evidence/p3/dollywood-live/verify-out-of-frame-stale-reads-live-1-inFrame_90min.png`, `audits/evidence/p3/dollywood-live/verify-out-of-frame-stale-reads-live-2-arriving11h.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/states.mjs"` (A and B against the C control).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-out-of-frame-stale-reads-live-1.mjs"` (park seed, real clock, WebKit, iPhone PWA as Eli) with four seeded restored fixes. Parking lots 90 min and 10 h: state `arriving`, the live-sounding title and subtitle, `actionChip null`, `meStale true`, amber title. 8.5 mi, 90 min: state `far`, `actionChip null`. In-frame control: "Last seen 2 h ago", chip "Find me".
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-out-of-frame-stale-reads-live-2.mjs"`: the same for 90 min and 11 h out of frame (`pillAction null`, amber title `rgb(122,90,15)`, no dot tag), and the in-frame control with "Find me" and a "2 h ago" tag. In every case `#loc-btn` was visible, labelled "Find me".

**Corrected claim.** Confirmed with two qualifiers: "no Find me" means no Find me chip in the pill (the map's ◎ button stays visible to adults), and the amber title is the one remaining stale cue, undercut by the precise accuracy note. The in-frame control rounds a 90-minute fix to "Last seen 2 h ago" (`agoOf`, `apps/dollywood-live.html:1181`).

#### P3-DOLLYWOOD-LIVE-08 — Tapping a restroom, first-aid, AED or other amenity marker does nothing

- **Severity: medium** (skeptics: medium / medium; unchanged). A secondary flow is broken. The Nearby pane's chips still route to the nearest restroom, first aid, nursing room or stroller rental (`apps/dollywood-live.html:1571-1573`), so it is not high. AED, lost-and-found and ATM markers have no other way to their card.
- **Exposure.** Every amenity marker, whenever they are drawn: at a zoom of 0.6 m per pixel or closer, and not closer than 0.3 on the illustrated basemap (`apps/dollywood-live.html:1566`).

**What happens now.** `drawAmen` writes `data-pick="a:<kind>:<x>:<y>"`. `pick()` splits it with a two-part destructure, `const [k,v]=elm.dataset.pick.split(':')` (`apps/dollywood-live.html:844`), so `v` is only the kind and x and y come out undefined; no amenity matches, and `showAmen` (`apps/dollywood-live.html:1574`) is never reached. `pick()` still returns true, so `endPtr` skips `closePop()` (`apps/dollywood-live.html:849`): a tap on a marker while another card is open leaves that card showing.

**Expected.** The full `kind:x:y` reaches `showAmen`, and the amenity card opens.

**Why it matters to the household.** A parent tapping the restroom or first-aid marker nearest a child gets nothing, and an AED location can only be seen, not opened.

**Evidence.**
- Code: `apps/dollywood-live.html:844, 849, 1564-1575`; the source has the same line (`../dollywood-build-project/scripts/template.html:841`).
- Investigator run: `audits/evidence/p3/dollywood-live/functional.json` (`amenData.count 63`; `amenityTap`: token "a:restroom:860:972", `pickReturn true`, `cardOpenedByPickFn false`).
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-amenity-tap-dead-1.json`, `audits/evidence/p3/dollywood-live/verify-amenity-tap-dead-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-amenity-tap-dead-1-after-tap.png`, `audits/evidence/p3/dollywood-live/verify-amenity-tap-dead-1-control-showAmen.png`, `audits/evidence/p3/dollywood-live/verify-amenity-tap-dead-2-after-tap.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-amenity-tap-dead-2.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-amenity-tap-dead-1.mjs"` (park seed, real clock, WebKit, iPhone PWA as Eli). It zoomed with the app's own + button until 63 markers drew, then tapped three on-screen, top-most markers (a restroom and two AEDs) with real `mouse.click` and `touchscreen.tap`. Every tap reached `pick()` (e.g. `{token:'a:restroom:831:826', ret:true}`), and the card stayed closed. Control: `showAmen()` called directly opened "Restrooms". With a control card open, tapping a marker left that card on screen.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-amenity-tap-dead-2.mjs"`: the same three markers, `popShow false` and empty card text after each real click; `pick`'s parse gave `x` and `y` undefined while the matching record existed. Controls: `showAmen(record)` opened "Restrooms Timber Canyon · restroom · from the official map", and a real tap on ride marker `o:24` opened "Drop Line … 40 min wait", ruling out a hit-testing problem.

**Corrected claim.** Accurate, and widened: every amenity kind drawn is affected (restroom, first aid, AED, nursing, strollers, lost and found, ATM), and a tap on a marker leaves any open card in place. The fix belongs in `../dollywood-build-project/scripts/template.html:841`, then an export.

#### P3-DOLLYWOOD-LIVE-09 — Every tap of the compass jumps the view to the Entrance, and the first tap does not rotate anything

- **Severity: medium** (skeptics: medium / medium; unchanged). A secondary map control does the wrong thing. No data is touched, and Find me, Whole park or a pan get the view back; with GPS follow on, the next fix pulls the view back to the person (`apps/dollywood-live.html:1246`).
- **Exposure.** Every compass tap. It persists when follow is off (after any drag, `apps/dollywood-live.html:1398`, or with no GPS).
- **Related.** Same code as the build guide's P3-DOLLYWOOD-11 (`audits/03-apps/dollywood.md`; handler :1029 in both exports, `apps/dollywood-live.html:1029` and `apps/dollywood.html:1029`; `curSec` never set by `selectSection('all')`, :1121). It is medium here because every compass tap goes through it, and low there. The first-tap-does-not-rotate facet is park-map only. One template fix covers both (`../dollywood-build-project/scripts/template.html:1026, 1119`). No Phase 2 ID.

**What happens now.** `#lv-north` toggles the hidden `#l-upright` checkbox and fires its change handler (`apps/dollywood-live.html:1467`), which sets the rotation and then fits `SEC[curSec]` (`apps/dollywood-live.html:1029`). `curSec` starts as `'entrance'` (`apps/dollywood-live.html:1062`) and never changes in the park map: boot calls `selectSection('all')` (`apps/dollywood-live.html:1609`), which leaves it alone (`apps/dollywood-live.html:1121`), and section taps are ignored in the live flavour (`apps/dollywood-live.html:844`). The map already starts rotated (`liveInit`, `apps/dollywood-live.html:1425`) while the checkbox starts unchecked (`apps/dollywood-live.html:664`), so the first tap changes nothing visible but the view, and `aria-pressed` ends up the opposite of what the map shows.

**Expected.** The compass re-orients the current view (or the family) and does not move it to the entrance.

**Why it matters to the household.** A parent tapping the compass to get their bearings is thrown to the entrance and parking area, away from where they were looking and from the family's markers.

**Evidence.**
- Code: `apps/dollywood-live.html:664, 844, 1029, 1062, 1121, 1246, 1425, 1467, 1609`.
- Investigator runs: `audits/evidence/p3/dollywood-live/functional.json` (`compass_viewBefore` vs `compass_viewAfter` differ); `audits/evidence/p3/dollywood-live/measure.json` (`E_compass` ROT -98.71 unchanged, `uprightChecked` false → true); `audits/evidence/p3/dollywood-live/functional-compass-after.png`, `audits/evidence/p3/dollywood-live/measure-after-compass-ipad.png`; capture `audits/screens/dollywood-live/north-up-typical-iphone-pwa-light.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-compass-jumps-to-entrance-1.json`, `audits/evidence/p3/dollywood-live/verify-compass-jumps-to-entrance-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-compass-jumps-to-entrance-1-A1-before.png`, `audits/evidence/p3/dollywood-live/verify-compass-jumps-to-entrance-1-A2-after-tap1.png`, `audits/evidence/p3/dollywood-live/verify-compass-jumps-to-entrance-1-B3-after-next-fix.png`, `audits/evidence/p3/dollywood-live/verify-compass-jumps-to-entrance-2-after-tap1.png`, `audits/evidence/p3/dollywood-live/verify-compass-jumps-to-entrance-2-after-tap2.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-compass-jumps-to-entrance-2.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-compass-jumps-to-entrance-1.mjs"` (park seed, real clock, WebKit, iPhone PWA as Eli), measuring each point's distance from the screen centre. A1 (view at the east end after a real drag): far point 36 px from centre, entrance 956 px. A2 after tap 1: ROT still -98.71, entrance 0 px, far point 883 px. A3 after tap 2: ROT 0 (north up), entrance again 0 px. B (GPS follow at the far point): the tap moved the view to the entrance; the next fix brought it back (11 px).
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-compass-jumps-to-entrance-2.mjs"` from Country Fair (582 m from the entrance): after tap 1 the viewBox was identical to `fitBox(SEC.entrance.box)` at the same rotation (`same: true`, rotation unchanged); after tap 2 it was identical to the entrance fit at ROT 0 (`same: true`, rotation changed).

**Corrected claim.** "No visible rotation change" holds for the first tap only; the second tap does turn the map north-up and jumps to the entrance again. Every tap re-fits to Entrance & Plaza. Same root cause as the build guide's Upright lead (`audits/01-leads.md:326`), but here `curSec` is always `'entrance'`. That lead was filed in the build guide as P3-DOLLYWOOD-11 (low); see Related for why this one stays medium.

#### P3-DOLLYWOOD-LIVE-10 — On iPhone the pill cuts off the location-denied instructions before "or use Set my spot" (from the visual check)

- **Severity: medium** (skeptics: medium / medium; the visual checker's rating, unchanged). When location is denied on the main phone, the guidance is incomplete and the pill offers no action, a misleading secondary flow. It is not high: the visible half still names the main fix (Settings › Safari), Set my spot is reachable in the Nearby pane, and nothing is lost. The meeting-note facet on its own is low.
- **Exposure.** Any iPhone-width screen (430 px): the idle hint on every first open, the denied text whenever location permission is refused. Kid mode only for a kid whose beacon is on (a view-only kid has no Find me). All pill strings fit on the iPad.
- **Related.** The missing action chip on the denial path has its own cause, the error handler bypassing the designed state: P3-DOLLYWOOD-LIVE-17.

**What happens now.** The pill title and subtitle are single lines with an ellipsis (`apps/dollywood-live.html:399`), and so are the meeting bar's name and meta (`apps/dollywood-live.html:516-517`). There is no title attribute and no way to expand either (`apps/dollywood-live.html:613, 621`). On a 430 px iPhone:
- the idle hint "Only you see your dot until you switch on Share my spot" is cut (311 of 173 px);
- after a denial, the error handler writes "Allow Location for the Hub in Settings › Safari (or open the map on its own), or use Set my spot" straight into the pill (`apps/dollywood-live.html:1404-1405`), and it is cut after "Settings › Safari" (524 of 264 px), with no action chip in this path;
- if the designed denied state (`apps/dollywood-live.html:1267`) is reached later, its Set my spot chip squeezes the text so that even the title "Location is off for this site" is cut (185 of 150 px).

**Expected.** The instruction and the fallback are readable on the phone: two lines, a tap to expand, or shorter text, with the Set my spot action visible.

**Why it matters to the household.** At the moment location fails in the park, a parent reads half an instruction and sees no way forward, and the "or use Set my spot" escape route is never shown.

**Evidence.**
- Code: `apps/dollywood-live.html:399, 516-517, 613, 621, 1267, 1404-1405, 1589-1591`; `worker/src/index.js:108` (the rally note).
- Visual-check captures: `audits/evidence/p3/dollywood-live/denied-adult-iphone.png`, `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png`, `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/screens/dollywood-live/family-card-overflow-iphone-pwa-dark.png`, `audits/screens/dollywood-live/map-overflow-ipad-portrait-light.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-1.json`, `audits/evidence/p3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-1-denied-eli-iphone.png`, `audits/evidence/p3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-1-denied-updloc-eli-iphone.png`, `audits/evidence/p3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-1-denied-ezra-park-iphone.png`, `audits/evidence/p3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-2-denied-eli-iphone-pwa.png`, `audits/evidence/p3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-2-meet-overflow-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-2.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-1.mjs"` (WebKit; typical seed with the demo clock on iPhone PWA, iPhone Safari and iPad portrait as Eli and on iPhone PWA as Ezra; overflow and park seeds with the real clock). On both iPhones: idle subtitle 311/173 (cut); denied subtitle 524/264 (cut), state `searching`, `act null`, unchanged 10.5 s later; after forcing `updLoc()` the designed state shows "Set my spot" but the title is cut (185/150) and the subtitle too (360/150). iPad: every pill string fits. Ezra with his beacon on (park seed): 524/264, the same text. Overflow meeting bar: the name is cut on iPhone (342/268); the meta with the seeded note is cut on iPhone (837/268) and on iPad (837/658); rally's push-failed text is cut on iPhone (303/268).
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-2.mjs"` (WebKit, typical then overflow, demo clock). iPhone: idle 173/311 (56% visible); denied 264/524 (50% visible, on screen "Allow Location for the Hub in Settings › Safari ..."), state `searching`, `#lv-act` hidden, unchanged after 3 s and after tapping the pill. iPad: both fit. Long note: 32% visible on iPhone, 79% on iPad; a short note ("set by Mae 5 min ago · bring the stroller") fits on the iPhone. Ezra in the typical seed is view-only and never reaches the denied text.

**Corrected claim.** Confirmed with corrections. A meeting note is cut on the iPad too, not only on the iPhone (the checker said it was visible on iPad). The shipped UI never writes a note: `setMeet`, `rally()` and `meetHere` pass none (`apps/dollywood-live.html:1587-1591`); only a hand-made `POST /api/dollywood/rally` with a note sets one (`worker/src/index.js:108`), so the note facet is an edge case (low). Kid mode is affected only for a kid whose beacon is on. The measurements are WebKit on Windows; real iOS fonts could move the cut by a few characters, not close a roughly 2× overflow.

#### P3-DOLLYWOOD-LIVE-11 — A waits-feed ride whose name differs from the listing (the Dollywood Express) silently shows no wait

- **Severity: low** (skeptics: low / low; **lowered** from the investigator's medium). In the rig's realistic feed one ride of 34 loses its wait with no indication; the rest of the waits flow works. It would rate higher only if real Queue-Times names diverge widely, which the local instance cannot show.
- **Exposure.** Every day, for the train (and any ride renamed upstream later).

**What happens now.** `loadWaits` attaches a feed ride only when its normalised name (`wnorm`, `apps/dollywood-live.html:1493`) equals an attraction listing's exactly (`apps/dollywood-live.html:1501-1502`), and the alias table `WALIAS` is empty (`apps/dollywood-live.html:1494`). The feed name "Dollywood Express" does not match the listing "Dollywood Express Train Depot" (#79), so the train's wait never reaches its marker, card, the Waits list or the Next-ride hero, and nothing says a ride was dropped.

**Expected.** A known rename is aliased (the table exists "for the day one of them is renamed"), and unmatched feed names are reported somewhere a maintainer will see them.

**Why it matters to the household.** The family's train ride shows no posted wait, with no sign that one exists.

**Evidence.**
- Code: `apps/dollywood-live.html:1493-1494, 1501-1502`; `worker/src/index.js:63-77` (the Worker strips only ® and ™); `audits/tools/seed/waits.mjs:37` (the seed flags the mismatch on purpose); `../dollywood-build-project/README.md:192` ("`WALIAS` in the template takes any rename").
- Investigator run: `audits/evidence/p3/dollywood-live/waits.json` (`A_waits`: `attachedCount 2` of `feedRideCount 3`, using a hand-made feed with the invented name "Lightning Rod Roller Coaster"); `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-waits-name-match-drops-1.json`, `audits/evidence/p3/dollywood-live/verify-waits-name-match-drops-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-waits-name-match-drops-1-seeded-waits-iphone.png`, `audits/evidence/p3/dollywood-live/verify-waits-name-match-drops-2-A-rigfeed-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-waits-name-match-drops-1.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-waits-name-match-drops-1.mjs"` (park seed, demo clock, WebKit iPhone PWA as Eli) with the rig's seeded feed through the real Worker route: `feedRideCount 34`, `attachedCount 33`, `WALIAS "{}"`, unmatched "Dollywood Express" (listing "Dollywood Express Train Depot"). The Waits list showed 33 rows and no unmatched note. `wnorm` forgives spacing and case ("Thunder Head" → Thunderhead) but not "Lightning Rod Roller Coaster", "Wild Eagle Coaster" or "Dollywood Express".
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-waits-name-match-drops-2.mjs"`: A (rig feed) 33 of 34, `depotHasWait false`, no notice; B (a routed 3-ride feed with the invented name) 2 of 3, no notice.

**Corrected claim.** Narrowed. The investigator's sentence "the seed uses names that happen to match, hiding this" is wrong: the seed includes the Dollywood Express mismatch on purpose and flags it. "Lightning Rod Roller Coaster" is an invented name; the rig and the build project's check post "Lightning Rod (R)" (`../dollywood-build-project/scripts/verify.py:100`), which matches. That real Queue-Times names "often" differ is unproven. What is proven: one known mismatch, an empty alias table, and a silent drop. Severity low.

#### P3-DOLLYWOOD-LIVE-12 — Switching a kid's beacon off while the kid's map is open does not hide the kid: the kid's phone republishes its spot and the last position stays (from the completeness critic)

- **Severity: medium** (skeptics: medium / medium; **lowered** from the critic's high; kind **bug**, filed as security). The parent's explicit off switch silently fails and misleads, a broken secondary control. It is not high: the frozen position is shown only to the household and its invited guests, the same audience that saw it live a moment earlier, and live tracking stops at the kid device's next pull; Phase 2 set the same precedent for household-internal exposure (P2-PROF-05, `audits/02-shell.md:1270`). It is not critical: nothing leaves the family and no data is lost.
  - **Against P3-DOLLYWOOD-LIVE-02 (high).** -02 keeps high with the same "the household already sees the dots" audience argument that lowers this one to medium. What separates them is who decides: in -02 a guest decides a child's location sharing, over the parents' choice, and live tracking a guest switches on runs from the kid's next open of the map; here a parent decides, and the failure is a live republish that ends at the kid device's next pull (at most 30 s), then a frozen last position. One caveat for the roll-up: the P2-PROF-05 ruling cited above concerned hand-made requests (a forged `kidshare`, `audits/02-shell.md:1269-1270`), while this is shipped behaviour, and the leftovers report declined that precedent for a shipped screen (P3-LEFTOVERS-13, `audits/03-apps/leftovers.md`). What it set aside there was the hand-made-request downgrade (:1269), not the audience test (:1270) used here. The severity is unchanged; if the roll-up finds that distinction too thin, it should reconcile -02 and -12 there.
- **Exposure.** The kid's map is open with GPS fixes arriving when a parent switches the beacon off, which is the natural moment (at the park, while the child holds the phone). If no fix arrives between the parent's tombstone and the kid device's next pull (at most 30 s, `apps/hub.js:342`), the tombstone holds (skeptic 2's control).
- **Related.** New. P2-PROF-05 and P2-CHAT-02 cover who may write `kidshare:*`, not how the kid's device reacts. The guest trigger for the same switch is P3-DOLLYWOOD-LIVE-02; the opposite direction is P3-DOLLYWOOD-LIVE-13.

**What happens now.** The parent's switch writes `kidshare:<kid> = false` and tombstones `loc:<kid>` (`apps/dollywood-live.html:1308`). The kid's page still has `kidshare` true in its cache until its next pull, so `publish()`, which checks only `shareOn()` (`apps/dollywood-live.html:694, 1250-1253`), writes a fresh `loc:<kid>` on the next fix, and that later row beats the tombstone under last-write-wins. When the pull lands, the kid's `onChange` only calls `loadFam` and `renderNear` (`apps/dollywood-live.html:1483`): it never stops the watch, never tombstones its own row and never re-hides ◎, which is hidden once at start (`apps/dollywood-live.html:1485`). The last republished row then stays: drawn on every map for 4 h and faded after 45 min (`apps/dollywood-live.html:1212-1214`), on Home's At-the-park card (`index.html:872-877`) and in chat's `where_is_family` (`worker/src/chat.js:284-289`). The kid's device keeps its GPS watch and, by code, its screen wake lock (taken at `apps/dollywood-live.html:1400, 1408`, released only when the page is hidden, `apps/dollywood-live.html:1475`). Separately, the parent's own map keeps drawing the kid after the switch even when the tombstone holds, because the handler re-renders from the in-memory `FAM` without `loadFam()` (`apps/dollywood-live.html:1308`; skeptic 2, trial B).

**Expected.** Once a parent switches the beacon off, the kid's marker disappears and stays gone: the kid's device stops its watch, releases the wake lock, re-hides ◎ and tombstones its own row when `kidshare` turns false, and the parent's map drops the marker at once.

**Why it matters to the household.** A parent's deliberate choice to stop showing a 4- or 5-year-old's position is undone without any sign: the switch reads off while the child's last spot stays on every phone, the Kitchen iPad's Home card and chat for hours.

**Evidence.**
- Code: `apps/dollywood-live.html:694, 1212-1214, 1250-1253, 1308, 1400, 1408, 1475, 1483, 1485, 1601`; `apps/hub.js:342`; `index.html:872-877`; `worker/src/chat.js:284-289`.
- Critic run: `audits/evidence/p3/dollywood-live/critic-kid-beacon.json` (`A_rightAfterSwitchOff`: tombstone; `A_pollLocEzraAfterSwitchOff`: republished at s=5 (901,900) and s=8 (913,908), present to s=62; `A_ezraDeviceAfter60s`: `viewOnly true`, `shareOn false`, `watching true`, `locBtnHidden false`, pill `good`; `A_momSeesEzra`).
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-off-republished-1-1.json`, `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-off-republished-1-2.json`; screenshot `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-off-republished-1-2-A-mom-family-ipad.png` (1,033,760 bytes, just under 1 MiB).

**Reproduction.** `node "audits/tools/phase3/dollywood-live/critic-kid-beacon.mjs"` (section A), or `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-off-republished-1-2.mjs"` (walking trial and standing-still control).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-off-republished-1-1.mjs"` (park seed, real clock, WebKit). Ezra's paired phone walked 7 m every 2 s with the map open; Dad (not Mom, to vary the actor) tapped `input[data-kid=ezra]` on his iPad. The switch wrote `kidshare:ezra` at `updated_at 1790274419882`; 340 ms later the server held a live `loc:ezra` (885,905). Republished at s=8 and s=11; the kid's pull landed at s=14, and the last row (915,935) was still live at 61 s. Kid device after: `viewOnly true`, `shareOn false`, `watching true`, `locBtnHidden false`, pill `good`. Dad's map: "🦖 Ezra Wildwood Grove · 1 min ago" beside an unchecked switch; Dad's Home At-the-park card: "🦖 Ezra just now".
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-off-republished-1-2.mjs"` (park seed, real clock, WebKit; Mom's real Family-pane click; server polled every 1 s). Trial A (walking): a live row at s=1 (872,879), then republishes to (902,897) at s=10; the kid learned `kidshare` false at s=12 and stopped; the final row stayed live. Mom's map after a pull: marker drawn, "🦖 Ezra Wildwood Grove · just now", switch off. Trial B (standing still): the tombstone held, but Mom's own map still drew Ezra.

**Corrected claim.** Confirmed, with corrections. The republish lands within about 0.3 s of the switch, not 2 s, and continues until the kid device's next pull (6-14 s in these runs, at most 30 s), then freezes at the last position. It needs a GPS fix in that window; if none arrives, the tombstone holds. The wake-lock part is from code only: the rig's WebKit has no `navigator.wakeLock`, so `wakeLock` read false throughout. New facet: the parent's own map keeps the kid's marker after the switch until the next remote family change reloads `FAM`. Severity medium, kind bug. The fix goes in `../dollywood-build-project/scripts/template.html:1436, 1611, 1613` (react to `kidshare` turning false: stop the watch, release the lock, re-hide ◎, tombstone the own row; call `loadFam()` after the switch), then an export.

#### P3-DOLLYWOOD-LIVE-13 — Switching a kid's beacon on does nothing on the kid's open map until it is closed and reopened, while the parent's switch says it is sharing (from the completeness critic)

- **Severity: medium** (skeptics: medium / medium; unchanged). A secondary flow is broken and its copy misleads: the parent's switch reads "On — their device shares its spot with the family" (`apps/dollywood-live.html:1307`) and, from its next Family render, the kid's own pane shows "Share my spot" checked, while nothing is shared. It is not high: nothing is lost or exposed (the failure shares less, not more), and reopening the map recovers.
- **Exposure.** The kid's map is already open when an adult switches the beacon on, for example a parent setting it up at the park while the child holds the phone.
- **Related.** New. P2-PROF-05 and P2-CHAT-02 are about who may write `kidshare:*`. The opposite direction is P3-DOLLYWOOD-LIVE-12.

**What happens now.** `VIEW_ONLY()` and `shareOn()` read `kidshare` live (`apps/dollywood-live.html:693-694`), so after the pull the kid's page is no longer view-only and `shareOn()` is true. But `startGps` runs only at start (`apps/dollywood-live.html:1486, 1488`), the ◎ button is hidden once (`apps/dollywood-live.html:1485`), and `onChange` for a `kid*` key only calls `loadFam` and `renderNear` (`apps/dollywood-live.html:1483`). The visibility handler restarts only a watch that was running before (`apps/dollywood-live.html:1475-1476`). So the pill keeps "Rides and the family, live / Kiara · just looking", ◎ stays hidden and no `loc:<kid>` is written until the map is reopened, when the boot path starts GPS (the comment at `apps/dollywood-live.html:1486`: "resume without a tap").

**Expected.** When `kidshare:<kid>` turns true, the kid's open map starts locating, shows ◎ and publishes, as the parent's switch promises.

**Why it matters to the household.** At the park, a parent switches the beacon on for a child who already has the map open and expects the child's dot; nothing appears, and both switches say it is sharing.

**Evidence.**
- Code: `apps/dollywood-live.html:693-694, 1307, 1475-1476, 1483, 1485, 1486, 1488`.
- Critic run: `audits/evidence/p3/dollywood-live/critic-kid-beacon.json` (`B_serverKidshareKiaraAfterSwitch`; `B_kiaraWhileOpen` s=32 and s=47: `viewOnly false`, `shareOn true`, `watching false`, `locBtnHidden true`, `serverLocKiara` absent; `B_kiaraAfterReopen`: `watching true`, `loc:kiara` 9 s old).
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1.json`, `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1-kiara-open.png` (no ◎, "just looking"), `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1-kiara-reopened.png`, `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-2-kiara-open-90s.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1.mjs"`, or `node "audits/tools/phase3/dollywood-live/critic-kid-beacon.mjs"` (section B).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-1.mjs"` (park seed, real clock, WebKit). Kiara's paired phone opened the map with geolocation granted; Mom clicked `#fam-list input[data-kid=kiara]` (switch copy "Kiara's beacon On — their device shares its spot with the family"; server `kidshare:kiara = true`). After a forced `hub.pull()`, at s=4, 16, 28 and 40: `kidshare true`, `viewOnly false`, `shareOn true`, `watching false`, `meSrc null`, `locBtnHidden true`, pill idle "Kiara · just looking", no `loc:kiara`. After reopening: `watching true`, pill `good` "At Great Tree Swing · ± 30 ft · sharing", `loc:kiara` 9 s old.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-critic-kid-beacon-on-needs-reopen-2-2.mjs"` (park seed, real clock, WebKit; six polls over 92 s). The same state throughout, plus Kiara's own Family pane showing "Share my spot" checked (`famShareRow true`, `famShareChecked true`). A hidden-to-visible cycle did not start GPS either (◎ still hidden, no `loc:kiara`); it only changed the pill to "Where are you? / Sharing as Kiara once you have a fix" with a Find me action. Reopening recovered.

**Corrected claim.** Confirmed as filed, with two refinements: the kid's own Family pane also misleads (Share my spot checked, nothing published), and a background/foreground cycle does not start the beacon, though it adds a Find me chip a pre-reader is unlikely to use. On a real iPhone, starting location remotely would also need the permission prompt while the map is in the foreground. The fix goes in `../dollywood-build-project/scripts/template.html:1611, 1613-1614` (on a `kidshare` change, re-evaluate `VIEW_ONLY()`: unhide ◎ and call `startGps()`), then an export.

#### P3-DOLLYWOOD-LIVE-14 — Search's "rider height: up to N" filter hides every listing with no height requirement (carousel, train, playgrounds) (from the completeness critic) (pointer to P3-DOLLYWOOD-06)

**Pointer.** Same template code as P3-DOLLYWOOD-06 (template :1004, `../dollywood-build-project/scripts/template.html:1004`); the roll-up counts it there. Kept as park-map evidence: the select sits under the kid who-chips, which use the opposite rule (`fits()`, :1541, `apps/dollywood-live.html:1541`).

- **Severity: medium** (skeptics: medium / medium; unchanged; as a pointer it is counted under P3-DOLLYWOOD-06, not in this report's totals). A misleading secondary filter: for a small child it hides exactly the rides a small child can go on. It is not high: nothing is lost, and Nearby, Waits and the who-chips in the same pane give the right answer.
- **Exposure.** Any adult who picks an "up to N"" option in the Search pane's rider-height select.
- **Related.** New for this app. It is the build-guide lead at `audits/01-leads.md:322` (the same `listItems` code in `apps/dollywood.html:1007`); both exports come from one template line, so one fix covers both. The build guide's report filed it first, as **P3-DOLLYWOOD-06** (medium, `audits/03-apps/dollywood.md`), which is the primary. No Phase 2 ID.

**What happens now.** `listItems` keeps a listing under "up to N" only when `o.height_in&&o.height_in<=+hf` (`apps/dollywood-live.html:1007`), so a listing with no requirement never passes. The select sits in the Search pane (`apps/dollywood-live.html:1012`) directly under the kid who-chips, which use the opposite rule: `fits()` counts no requirement as rideable (`apps/dollywood-live.html:1541`) and only fades rides a kid cannot ride (`apps/dollywood-live.html:1452`). With "up to 36"", Search shows "9 of 145"; `fits()` at 36" would keep 129. Hidden: all 43 attractions with no requirement, among them Village Carousel, Dollywood Express Train Depot, Lil' Pilots Playground, Imagination Playhouse, The Amazing Flying Elephants and Treetop Tower.

**Expected.** "Up to N"" keeps listings with no requirement (`!o.height_in || o.height_in<=N`), as the who-chips do, or the select is removed in favour of the who-chips.

**Why it matters to the household.** A parent filtering for a 4-year-old loses the carousel, the train and the playgrounds, the rides a 4-year-old can actually go on.

**Evidence.**
- Code: `apps/dollywood-live.html:1007, 1012, 1452, 1541`; `audits/01-leads.md:322`.
- Critic run: `audits/evidence/p3/dollywood-live/critic-search-height.json` (`A_any` 145; `B_upTo42` 18 shown, 0 with no requirement; `C_upTo36` 9 shown, 0 with no requirement; 43 attractions with no requirement in the data); `audits/evidence/p3/dollywood-live/critic-search-height-36-iphone.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-critic-search-height-filter-hides-no-requirement-3-1.json`, `audits/evidence/p3/dollywood-live/verify-critic-search-height-filter-hides-no-requirement-3-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-critic-search-height-filter-hides-no-requirement-3-1-36-iphone.png`, `audits/evidence/p3/dollywood-live/verify-critic-search-height-filter-hides-no-requirement-3-2-upto36-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-critic-search-height-filter-hides-no-requirement-3-1.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-critic-search-height-filter-hides-no-requirement-3-1.mjs"` (typical seed, demo clock, WebKit, Eli on iPhone PWA; real `selectOption` on `#hf`). any: "145 of 145" (25 with a requirement, 120 without; 43 of 68 attractions without). none: "120 of 145". up to 36": "9 of 145", 0 without a requirement, while `fits()` would keep 129. up to 42": "18 of 145" (`fits()` 138). up to 48": "23 of 145". "zipline": "0 of 145" with no empty-state message.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-critic-search-height-filter-hides-no-requirement-3-2.mjs"` (typical seed, demo clock, WebKit). Up to 42": 18, none without a requirement; up to 36": 9, with Village Carousel, Treetop Tower, Imagination Playhouse and Amazing Flying Elephants hidden. With "any" and the Kiara chip: all 145 shown, 11 faded, none of them a no-requirement ride. The screenshot shows "up to 36"" and "9 of 145" directly under the "Kiara 40"" chip.

**Corrected claim.** Accurate, with corrections. In the seed Kiara is 40", so her nearest option is "up to 39"", not "up to 42"". The who-chips do not filter the Search list; they fade rides a kid cannot ride. "Up to N" hides all 120 listings with no requirement (the 43 attractions plus shops and dining), not only rides. The select also has a separate "no requirement" option, so the split looks deliberate in code, but the label "rider height" reads as the child's height, and on that reading the results are wrong. The fix goes in `../dollywood-build-project/scripts/template.html:1004` (and the select at `:1009`), then an export to both files.

#### P3-DOLLYWOOD-LIVE-15 — After the waits feed fails, a map left open keeps showing the last waits as current, past the app's own 6 h limit (from the completeness critic)

- **Severity: low** (skeptics: low / low; unchanged). Advisory information goes stale after a long outage; no data is lost, and the Nearby footer ("posted 7 h ago"), the ride card and the Waits-list stamp do show the age. Both skeptics called medium arguable only if the Next-ride hero counts as a core flow.
- **Exposure.** The feed or the phone's network fails for a long stretch while the map stays open (the wake lock keeps the screen on, `apps/dollywood-live.html:1400, 1408`).
- **Related.** New. It qualifies OK-DOLLYWOOD-LIVE-3, which holds on a fresh open. No Phase 2 ID.

**What happens now.** `loadWaits` applies the 6 h cache limit only inside `if(!WAITS.at)` (`apps/dollywood-live.html:1504`), that is, only when nothing has loaded since the map opened. After one success, each failure sets `WAITS.err` and keeps `WAITS.by`, however old. The marker chips (`apps/dollywood-live.html:1507-1510`), the Nearby rows and the Next-ride hero (`apps/dollywood-live.html:1554-1560`) and the directions bar keep the old numbers with no stale cue. The cues are the footer "posted N ago" and the Waits list's "⚠ Waits as of … — offline, retrying" stamp (`apps/dollywood-live.html:1521-1525`). A map reopened at the same instant drops the old cache and shows no waits, so the open map contradicts the app's own rule.

**Expected.** Waits older than the 6 h limit are dropped, or at least dimmed and marked stale everywhere they appear (chips, hero, Nearby rows, directions bar), not only in the Waits list and the footer.

**Why it matters to the household.** On a patchy park network, the Next-ride hero can steer the family to a ride using the morning's waits.

**Evidence.**
- Code: `apps/dollywood-live.html:1455, 1504, 1507-1510, 1521-1525, 1554-1560`; `sw.js:28, 35` (the service worker never serves `/api` from cache).
- Critic run: `audits/evidence/p3/dollywood-live/critic-waits-stale.json` (`B_after7hFailing`: `waitsAgeMin 420`, `err true`, hero unchanged, 33 marker chips, `nearbyHasStaleCue false`); `audits/evidence/p3/dollywood-live/critic-waits-stale-7h-iphone.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-critic-waits-stale-while-open-4-1.json`, `audits/evidence/p3/dollywood-live/verify-critic-waits-stale-while-open-4-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-critic-waits-stale-while-open-4-1-A-fresh.png`, `audits/evidence/p3/dollywood-live/verify-critic-waits-stale-while-open-4-1-B-7h-offline-route.png`, `audits/evidence/p3/dollywood-live/verify-critic-waits-stale-while-open-4-2-7h-offline-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-critic-waits-stale-while-open-4-1.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-critic-waits-stale-while-open-4-1.mjs"` (park seed, real clock, WebKit, Eli iPhone with an installed clock). The phone went fully offline, then `clock.fastForward('07:00:00')` and `runFor('02:30')`, so the app's own 60 s interval called `loadWaits`. After 7 h: `waitsAgeMin 423`, `err true`, 33 chips at full opacity, hero "Whistle Punk Chaser 1 min walk + 5 min wait", directions bar "… · 5 min wait · 3 steps", footer "posted 7 h ago", Waits list stamp "⚠ Waits as of 2:27 PM — offline, retrying…". Reopened offline: 0 waits.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-critic-waits-stale-while-open-4-2.mjs"` (park seed, WebKit, installed clock, context offline). At 90 min: hero and chips identical to fresh, no cue in the Nearby rows. At 7 h: 33 chips, hero unchanged, card "5 min wait posted 7 h ago", footer "posted 7 h ago". A map reopened at the same instant: no waits, "Wait times are not available right now."

**Corrected claim.** Confirmed, with refinements. It starts at the first failed refresh, not only after 6 h; the 6 h figure is the rule a reopened map applies. A real network loss behaves the same as a 502 from the feed. The ride card does carry a cue ("posted 7 h ago"); the surfaces without one are the marker chips, the Nearby row chips, the Next-ride hero and the directions bar. The fix goes in `../dollywood-build-project/scripts/template.html:1632` (apply the age limit on every failure, and mark or dim old waits), then an export.

#### P3-DOLLYWOOD-LIVE-16 — A kid with his beacon on gets a "Share my spot" switch that cannot be switched off: it snaps back on and his spot is republished (from the completeness critic)

- **Severity: low** (skeptics: low / low; unchanged). The control misleads a young child, and the family loses his dot for a few seconds, but the end state is what the parent chose (the beacon is the adult's control, CLAUDE.md). No data is lost and nothing is exposed beyond that choice.
- **Exposure.** A kid whose beacon is on opens the Family pane and taps the switch.
- **Related.** New. P2-PROF-05 and P2-CHAT-02 are about who may write `kidshare:*`. Same family of defects as P3-DOLLYWOOD-LIVE-12 and -13 (the kid's device does not follow the beacon as a parent's control).

**What happens now.** `renderFam` shows the Share switch to any writer who is not view-only (`canShare`, `apps/dollywood-live.html:1300-1301`), and a kid whose beacon is on is not view-only (`apps/dollywood-live.html:693`). Unticking runs `setShare(false)`: it writes person `share=false` and tombstones `loc:<kid>` (`apps/dollywood-live.html:1310-1313`). But `shareOn()` returns true first through `kidBeaconOn()` (`apps/dollywood-live.html:694, 1601`), so the switch re-renders checked, and the next accepted GPS fix republishes the spot through `publish()` (`apps/dollywood-live.html:1245, 1250-1253`).

**Expected.** For a kid, the beacon is the parent's control: hide the Share switch, or show a read-only line such as "Your beacon is on — a grown-up can switch it off".

**Why it matters to the household.** The switch looks as if the child can stop sharing, briefly deletes his marker for the parents, then quietly republishes it.

**Evidence.**
- Code: `apps/dollywood-live.html:693-694, 1245, 1250-1253, 1300-1301, 1310-1313, 1601`.
- Critic run: `audits/evidence/p3/dollywood-live/critic-kid-share-switch.json` (`B_rightAfterUntick`: switch checked, `shareOn true`, person share false, `loc:ezra` tombstone; `C_after12sWalking`: republished); `audits/evidence/p3/dollywood-live/critic-kid-share-switch-ezra-iphone.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-critic-kid-share-switch-noop-5-1.json`, `audits/evidence/p3/dollywood-live/verify-critic-kid-share-switch-noop-5-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-critic-kid-share-switch-noop-5-1-b-after-untick.png`, `audits/evidence/p3/dollywood-live/verify-critic-kid-share-switch-noop-5-2-C-after-ezra.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-critic-kid-share-switch-noop-5-2.mjs"` (with an adult control).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-critic-kid-share-switch-noop-5-1.mjs"` (park seed, real clock, WebKit, Ezra's paired iPhone). Before: switch shown and checked, "The family can see where you are". 1.5 s after the tap: person share false, `shareOn true`, switch checked, `loc:ezra` tombstone. Walking: republished at the first sample (t=3 s, 862,865), then on each move; a second tap did the same, republished 4 s later.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-critic-kid-share-switch-noop-5-2.mjs"` (park seed, real clock, WebKit). Ezra: after unticking, switch still checked, `loc:ezra` tombstone; after walking, `loc:ezra` back (886,881) and the pill ends "· sharing". Control, Mae (adult): the switch unchecks, reads "Off — only you see your dot", and her row stays a tombstone after walking.

**Corrected claim.** Confirmed. The republish comes on the very next accepted fix (within 3 s here), not after "12 s of walking"; a kid standing still stays hidden from the parents until he moves. The critic's citations are corrected here: `kidBeaconOn` is at `apps/dollywood-live.html:1601`, and the republish is `publish()` at `apps/dollywood-live.html:1250-1253`. The fix goes in `../dollywood-build-project/scripts/template.html:1428-1429` (no Share switch for a kid), then an export.

#### P3-DOLLYWOOD-LIVE-17 — On a location denial the error handler bypasses the app's designed "denied" state, so no Set my spot chip appears until the app is backgrounded (from the completeness critic)

- **Severity: low** (skeptics: low / low; unchanged). The pill text already explains the denial and names Set my spot; ◎ and the Nearby pane's Set my spot button still work. What is missing is the designed state with its one-tap chip. Nothing is lost or exposed.
- **Exposure.** Location permission refused for the site (on iOS, after "Don't Allow" on the first prompt), on any device.
- **Related.** Moved from UX-DOLLYWOOD-LIVE-1's first bullet, where it had been filed as UX (critic: misclassified; it goes against the code's own design). The truncation of the same text is P3-DOLLYWOOD-LIVE-10. No Phase 2 ID.

**What happens now.** For error code 1 the `watchPosition` handler writes "Location is off for this site" and the long Settings hint into `#loc-sec` and `#loc-acc`, then returns without calling `updLoc()` (`apps/dollywood-live.html:1404-1405`). `updLoc()` last ran synchronously at the end of `startGps` (`apps/dollywood-live.html:1408`), while the watch was still set, so it rendered `searching`. The designed state (`gpsErr===1&&!me` → `denied`, with a "Set my spot" chip, `apps/dollywood-live.html:1267`; listed as a pill state in the comment at `apps/dollywood-live.html:1257-1258`) is never rendered. With no fix, `updLoc` runs again only on a visibility change (`apps/dollywood-live.html:1476`), a Share toggle (`apps/dollywood-live.html:1313`) or a Set my spot toggle (`apps/dollywood-live.html:1469`); the 15 s timer needs a fix (`apps/dollywood-live.html:1477`), and the boot calls (`apps/dollywood-live.html:1480, 1489`) run before the tap.

**Expected.** The error path sets `gpsErr` and calls `updLoc()`, so the designed denied state with its Set my spot chip (and a kid-appropriate wording, UX-DOLLYWOOD-LIVE-1) shows at once.

**Why it matters to the household.** At the moment location fails in the park, the pill offers no action, although the app has a designed state for exactly this. On an iPhone the Nearby pane's Set my spot button sits just below the fold of the peek sheet.

**Evidence.**
- Code: `apps/dollywood-live.html:1267, 1313, 1404-1405, 1408, 1469, 1476, 1477, 1480, 1489`.
- Earlier runs: `audits/evidence/p3/dollywood-live/verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-1.json` (denied: state `searching`, `act null`, unchanged at 10.5 s; after forcing `updLoc()`, the designed state with "Set my spot"); `audits/evidence/p3/dollywood-live/theme-denied.json` (`C_deniedAdult`, `actShown false`).
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-1.json`, `audits/evidence/p3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-1-eli-iphone-pwa-denied.png`, `audits/evidence/p3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-1-eli-iphone-pwa-after-visibility.png`, `audits/evidence/p3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-2-webkit-rig-denied.png`, `audits/evidence/p3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-2-webkit-rig-after-updloc.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-2.mjs"` (WebKit rig denial, a WebKit stub with an asynchronous code-1 error, and Chromium).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-1.mjs"` (typical seed, demo clock, WebKit, geolocation not granted; Eli on iPhone PWA and Mom on iPad portrait). At 1.5 s and 17 s after tapping ◎: state `searching`, `gpsErr 1`, `watchId null`, "Location is off for this site", `#lv-act` hidden. After a `visibilitychange` with the page visible: state `denied`, `#lv-act` "Set my spot".
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-2.mjs"` in three runs (WebKit rig denial, WebKit with `watchPosition` failing asynchronously after 300 ms, Chromium). All three: `searching`, `act null`, `gpsErr 1` at 0.5, 3 and 16 s; the Nearby Set my spot button at top 889 px on an 884 px viewport; after `visibilitychange`, `denied` with "Set my spot".

**Corrected claim.** Accurate, with two refinements. The pill does not keep "Finding you…": the handler overwrites both lines, so only `data-state`, the status glyph and the chip are wrong. For a profile with an emoji (every seeded adult), the glyph is the emoji in both states, so the visible difference is the missing chip and the longer subtitle. Whether iOS fires `visibilitychange` around the first permission prompt (which would make the designed state appear once the prompt closes) needs a device. The fix goes in `../dollywood-build-project/scripts/template.html:1532-1533` (call `updLoc()` instead of writing text), then an export.

#### P3-DOLLYWOOD-LIVE-18 — While the map stays open, the meeting point never expires and its "set by … N min ago" age never updates (from the completeness critic)

- **Severity: low** (skeptics: low / low; unchanged). The pin still marks the latest meeting point anyone set, and any other device's family change or a reopen corrects it. The "N min ago" label misleads, and the soft 2 h expiry is skipped. Nothing is lost.
- **Exposure.** The map stays open while no other device changes a family `loc:`, `meet` or `kid*` row, for example when nobody else is sharing. The device's own GPS publishes do not refresh it (a pull emits only rows newer than the local copy, `apps/hub.js:292-298`), and nor does backgrounding (`apps/dollywood-live.html:1475-1476`).
- **Related.** Same root cause as P3-DOLLYWOOD-LIVE-04 (the bar is re-rendered only through `loadMeet`), different trigger and fix; not a Phase 2 ID (P2-SYNC-13 covers only the Me Sync card).

**What happens now.** `loadMeet` applies the 2 h expiry and calls `renderMeet`, which computes the age with `agoOf` (`apps/dollywood-live.html:1579, 1583-1584`). Both run only at start and from `loadFam` when another device changes a family row (`apps/dollywood-live.html:1256, 1483`). The 30 s timer only calls `drawFam` and `renderFam` (`apps/dollywood-live.html:1484`). So the age is frozen from the moment the map opens, and after 2 h the pin and bar stay.

**Expected.** The bar's age updates, and the pin and bar drop at 2 h, whether or not another device writes: re-run `loadMeet()` on the 30 s timer and on becoming visible.

**Why it matters to the household.** "12 min ago" on a 2-hour-old meeting point can send a parent to a place the family left long ago.

**Evidence.**
- Code: `apps/dollywood-live.html:1256, 1475-1476, 1483, 1484, 1579, 1583-1584`.
- Critic run: `audits/evidence/p3/dollywood-live/critic-meet-expiry.json` (`A_atOpen` "set by Mae 12 min ago"; `B_after2h10`: `barHidden false`, meta unchanged, `meetAgeMin 143`, `pinDrawn true`; `C_afterReopen`: `barHidden true`); `audits/evidence/p3/dollywood-live/critic-meet-expiry-iphone.png`.
- Skeptic runs: `audits/evidence/p3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-1.json`, `audits/evidence/p3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-2.json`; screenshots `audits/evidence/p3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-1-C-plus2h10.png`, `audits/evidence/p3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-1-D-after-family-change.png`, `audits/evidence/p3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-2-iphone.png`.

**Reproduction.** `node "audits/tools/phase3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-2.mjs"`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-1.mjs"` (park seed, real clock, WebKit, Eli on iPhone PWA with an installed clock). At open: "set by Mae 12 min ago". +20 min: still "12 min ago" (real age 33). +2 h 10: `barHidden false`, "12 min ago", pin drawn, real age 143 min. Control: one `loc:mom` write from Mom's device (200), and 40 s later the bar and pin were gone.
- **Skeptic 2** ran `node "audits/tools/phase3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-2.mjs"` (park seed, real clock, WebKit). +45 min: "12 min ago" (real 58), `sync 'synced'`. 2 h 10: bar and pin still shown, "12 min ago" (real 143). After a fresh `loc:christian` from Mae and one pull: bar hidden, pin gone, `MEET` null.

**Corrected claim.** Confirmed as filed. The age freezes at once, not only after 2 h. It heals whenever another device changes a family row, which at the park happens every few seconds while anyone else is sharing, so the trigger is narrow. The fix goes in `../dollywood-build-project/scripts/template.html:1612` (call `loadMeet()` in the 30 s timer, and on becoming visible), then an export.

### Usability, visual and gap findings

These were not adversarially verified. Items marked "from the visual check" were added by the independent visual checker; the rest are the investigator's.

**UX**

- **UX-DOLLYWOOD-LIVE-1 — The location-denied state is incomplete, and a kid gets adult "Settings › Safari" wording** (medium).
  - The missing designed state and its Set my spot chip were filed here first; the completeness critic reclassified that part as a bug against the code's own design, and it is now **P3-DOLLYWOOD-LIVE-17** (confirmed 2/2). What stays here is the wording.
  - Ezra, a kid whose beacon is on (so not view-only), gets the identical adult wording, "Location is off for this site / Allow Location for the Hub in Settings › Safari …" (`apps/dollywood-live.html:1404-1405`), which a 4- or 5-year-old cannot read or act on. The designed state's wording (`apps/dollywood-live.html:1267`) is adult too.
  - The truncation of this text on iPhone is P3-DOLLYWOOD-LIVE-10.
  - Evidence: `audits/evidence/p3/dollywood-live/theme-denied.json` (`C_deniedAdult`, `D_ezraDenied`); `audits/evidence/p3/dollywood-live/denied-adult-iphone.png`, `audits/evidence/p3/dollywood-live/denied-kid-iphone.png`. Lead `audits/01-leads.md:317`.
- **UX-DOLLYWOOD-LIVE-2 — A view-only kid is told to tap a button that is hidden for her** (low).
  - Nearby's empty text reads "Find yourself first: tap ◎, or use Set my spot." (`apps/dollywood-live.html:1290`), but ◎ is hidden for view-only users (`apps/dollywood-live.html:1485`). Set my spot is still offered to her; a placed spot is never published (`apps/dollywood-live.html:1250`), so there is no privacy leak, only confusion.
  - Evidence: `audits/evidence/p3/dollywood-live/states.json` (`D_kid`: `findMeBtnHidden true`, `setMySpotVisible true`; `D_kidNearbyText`); `audits/evidence/p3/dollywood-live/states-kid-nearby.png`; `audits/screens/dollywood-live/kid-nearby-typical-desktop-light.png`. Lead `audits/01-leads.md:318`.
- **UX-DOLLYWOOD-LIVE-3 — While the data loads, the map says you are offline and not sharing** (low; related to P2-SYNC-15).
  - With the family pull in flight, the Family header reads "offline — showing last known" (`apps/dollywood-live.html:1298`), Share my spot shows "Off", and the pill says "Only you see your dot until you switch on Share my spot" (`apps/dollywood-live.html:1269`), because `share` and `hub.sync` are read before the first pull.
  - On a person's first open of the map on a device, the wrong pill copy does not clear at all (P3-DOLLYWOOD-LIVE-03).
  - Evidence: `audits/evidence/p3/dollywood-live/rally-guest-loading.json` (`C_loading`); `audits/evidence/p3/dollywood-live/loading-family-ipad-dark.png`. Lead `audits/01-leads.md:316`.
- **UX-DOLLYWOOD-LIVE-4 — The build guide's engineering panels leak into the family park map** (medium; from the visual check).
  - The ride card's Track button opens the guide's coaster survey card: "Mapped track 936 m" (metric beside feet elsewhere), "Ground under track 1053–1098 ft", "In Planet Coaster 2: Wooden coaster; keep the station fly-through", an OpenStreetMap disclaimer and an elevation chart.
  - Search is the guide's listings panel ("2/2 placed", "Official listings", a native "rider height" select, whose "up to N"" options hide every no-requirement ride: P3-DOLLYWOOD-LIVE-14). A no-match search ("zipline") ends with "0 of 145" and no empty-state message (`audits/evidence/p3/dollywood-live/critic-search-height.json` `D_noMatch`; lead `audits/01-leads.md:338`). Style carries "Contour interval (satellite)", a native select and native checkboxes for "Section pieces" and "Contours" (`apps/dollywood-live.html:1464`).
  - The Track card's elevation profile uses the build guide's fixed 12-unit axis labels in a 1000-wide viewBox (`apps/dollywood-live.html:936`, the same line as the guide's), so they render at a few pixels on a phone (lead `audits/01-leads.md:341`; not measured in this app).
  - Evidence: `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png`, `audits/screens/dollywood-live/search-query-typical-iphone-safari-dark.png`, `audits/screens/dollywood-live/style-typical-iphone-safari-light.png`. Leads `audits/01-leads.md:333, 338, 344`.
- **UX-DOLLYWOOD-LIVE-5 — Kid mode needs reading** (medium; from the visual check).
  - A pre-reader's pill shows "Location is off for this site / Allow Location …" (beacon on) or "Rides and the family, live / Kiara · just looking".
  - On Waits, rides the kid is too short for (Drop Line 55", Thunderhead 48", Lightning Rod 48") are faded with no glyph saying why (`apps/dollywood-live.html:1532`, class `noride`), unlike Nearby and Search, which show a height chip. The chip row that shows the kid filter scrolls away (lead).
  - The map, labels and controls stay at the adult scale. Only the ride card's faces with ✓ work without reading (OK-DOLLYWOOD-LIVE-5).
  - Evidence: `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/kid-typical-ipad-portrait-dark.png`, `audits/screens/dollywood-live/waits-kid-typical-ipad-portrait-light.png`, `audits/screens/dollywood-live/kid-viewonly-typical-ipad-landscape-light.png`. Lead `audits/01-leads.md:336`.
- **UX-DOLLYWOOD-LIVE-6 — The waits error state says the same thing twice** (low; from the visual check).
  - Under the illustrated pin the pane says "Could not reach the wait-time feed. It retries every minute." (`apps/dollywood-live.html:1526`) and further down "Wait times are not available right now." (`apps/dollywood-live.html:1522`).
  - Evidence: `audits/screens/dollywood-live/waits-error-iphone-pwa-light.png`, `audits/evidence/p3/dollywood-live/waits-error-iphone.png`.
- **UX-DOLLYWOOD-LIVE-7 — Kids' heights take one tap per inch from 36** (low; from the completeness critic).
  - With no stored height the stepper starts from 36 and moves one inch per tap, with one family write per tap (`apps/dollywood-live.html:1547-1548`). Entering Ezra's measured 43" is 7 taps and 7 writes; 48" is 12. At the park that is a parent holding a child with one hand. A number field or a picker would take one entry. (The steppers also appear only when someone else is sharing, P3-DOLLYWOOD-LIVE-05.)
  - Evidence: code only; §3 taps table.

**Visual**

- **VIS-DOLLYWOOD-LIVE-1 — Family marker labels pile into an unreadable stack with long names** (medium).
  - `drawFam` draws each name pill with no collision handling (`apps/dollywood-live.html:1219-1221`), unlike the ride labels. In the overflow seed 4-5 long-name pills stack around Thunderhead and the Great Tree Swing ("Kiara Seraphina Josephine" covers "Ezra Bartholomew Anderson"), and a guest's label is clipped at the left edge. The same happens on iPhone.
  - Evidence: `audits/screens/dollywood-live/map-overflow-ipad-portrait-light.png`, `audits/screens/dollywood-live/meet-overflow-iphone-pwa-light.png`, `audits/screens/_sheets/dollywood-live--map.jpg`. Lead `audits/01-leads.md:335`.
- **VIS-DOLLYWOOD-LIVE-2 — The meeting-point label collides with pucks and is clipped** (low; from the visual check).
  - "Meet · The Wildwood Tree" is overdrawn by the Ezra, Elizabeth and Mae pucks and cut to "Meet · The Wildw…ree" on iPhone; a long name runs off the right edge under the buttons ("Meet · TimeSaver & Special Experiences Res").
  - Evidence: `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/meet-overflow-iphone-pwa-light.png`.
- **VIS-DOLLYWOOD-LIVE-3 — The ride card's ABOUT is often empty, and Track opens the raw survey card** (low).
  - The park-day ride card folds bookkeeping into an About section (`apps/dollywood-live.html:1447`) that often holds only the dollywood.com link. Track reuses the build guide's coaster card with no sticky head or action row; on phones the ride card covers the lower map, including Whole park and Find me.
  - The build guide's leads about unreadable profile axis labels and over-transparent glass cards (`audits/01-leads.md:341-342`) apply to the Track card too: the chart code is the same line (`apps/dollywood-live.html:936`) and the card styles are the guide's `.pop` rules (`apps/dollywood-live.html:113-114`). Neither was measured in this app; how much of the map reads through a card needs real blur on a device.
  - Evidence: `apps/dollywood-live.html:984, 1447`; `audits/screens/dollywood-live/ride-card-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/coaster-card-typical-desktop-dark.png`. Leads `audits/01-leads.md:333-334`.
- **VIS-DOLLYWOOD-LIVE-4 — On iPad portrait the coaster card covers the meeting bar and runs over the search field** (low; from the visual check).
  - The card's top edge hides "set by Mae 12 min ago" and half of Done; its "Zoom to it" area runs into the Search input behind it.
  - Evidence: `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png`.
- **VIS-DOLLYWOOD-LIVE-5 — Five control rules are under the 44 px minimum** (low; the investigator filed Set my spot, and the visual check widened it).
  - Measured: Set my spot 96×36 (`measure.json` `B_targets`). The checker estimated from 1× captures the meeting bar's Done at about 33 px, the Nearby / Waits segment at about 32 and the filter chips at about 36. The code agrees: `.lv-row-top button` 36 px (`apps/dollywood-live.html:432`), `.lv-meet button` 36 (`apps/dollywood-live.html:517`), `.lv-seg button` 32 (`apps/dollywood-live.html:522`), `.lv-chips button` 34 (`apps/dollywood-live.html:503`) and the pill's action chip 36 (`apps/dollywood-live.html:556`), all overriding the 44 px base (`apps/dollywood-live.html:224`). Find me, Whole park, the compass and the tabs pass (54, 54, 50, 46).
  - The investigator's citation `apps/dollywood-live.html:51` is the `.exag` rule, not Set my spot (checker).
  - Evidence: `audits/evidence/p3/dollywood-live/measure.json`; `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/screens/dollywood-live/meet-overflow-iphone-pwa-light.png`.
- **VIS-DOLLYWOOD-LIVE-6 — Seven :hover rules are not behind a fine-pointer query** (low).
  - `button`, `.oi`, `.info a.btn`, `.bitem`, `.pop a.btn`, `.offm` and `.used a` hover rules at `apps/dollywood-live.html:25, 65, 77, 100, 124, 134, 192`; `hoverGuarded 0`. On touch a tapped button can keep its hover look.
  - Evidence: `audits/evidence/p3/_compliance/dollywood-live.json` (`native.hoverRules`).
- **VIS-DOLLYWOOD-LIVE-7 — The family-marker fallback colour is Elizabeth's colour** (low).
  - The fallback `#8A6A4B` (`apps/dollywood-live.html:1213-1214, 1302, 1306, 1316, 1547`) is exactly Elizabeth's seed colour (`worker/seed.sql:8`), so a marker with no colour looks like hers. Code only: no capture shows the fallback (checker: "not visible").
  - Evidence: `audits/evidence/p3/dollywood-live/theme-denied.json` (`mom.accent #8A6A4B`).
- **VIS-DOLLYWOOD-LIVE-8 — The wait tiles' "MIN" label is 9.5 px white on saturated bands, failing 4.5:1 on green and amber** (low; from the visual check).
  - `.wtile small` is 9.5 px (`apps/dollywood-live.html:500`), below the 11 px floor. White on the short band `#1E8A4C` is 4.38:1 and on the mid band `#C77A00` 3.38:1 (`apps/dollywood-live.html:501`); the 20 px numerals pass 3:1 on every band. The bands are saturated literals, not house pastels with a deep ink.
  - Evidence: `audits/evidence/p3/dollywood-live/vischeck-contrast.json` (from `audits/tools/phase3/dollywood-live/vischeck-contrast.mjs`); `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/screens/dollywood-live/waits-typical-desktop-dark.png`.
- **VIS-DOLLYWOOD-LIVE-9 — An underlined text link on the ride card** (low; from the visual check).
  - "dollywood.com ↗" is underlined in light and dark; `.lv-link` sets no `text-decoration` (`apps/dollywood-live.html:491`).
  - Evidence: `audits/screens/dollywood-live/ride-card-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/ride-card-typical-ipad-landscape-dark.png`.
- **VIS-DOLLYWOOD-LIVE-10 — Desktop and iPad-landscape layout: 1,400 px rows and a visible edge to the map art** (low; from the visual check).
  - At 1440 px the Waits rows and the meeting bar span the full width, with the facts at opposite edges. The illustrated art ends in a hard vertical edge at about x 160 on desktop and x 82 on iPad landscape, with flat green beyond.
  - Evidence: `audits/screens/dollywood-live/waits-typical-desktop-dark.png`, `audits/screens/dollywood-live/map-typical-desktop-light.png`, `audits/screens/dollywood-live/family-offline-ipad-landscape-dark.png`, `audits/screens/dollywood-live/kid-viewonly-typical-ipad-landscape-light.png`.
- **VIS-DOLLYWOOD-LIVE-11 — Placing mode shows a cut-off sliver of sheet buttons under the tabs** (low; from the visual check).
  - Evidence: `audits/screens/dollywood-live/placing-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/placing-typical-iphone-safari-dark.png`, `audits/screens/dollywood-live/placing-typical-ipad-portrait-light.png`.
- **VIS-DOLLYWOOD-LIVE-12 — The illustrated map is one low-resolution raster that goes soft at ride zoom** (low; from the visual check).
  - The only illustrated asset is `apps/dollywood/illustrated_lo.jpg` (403,725 bytes; no higher-resolution illustrated file in `apps/dollywood/`). Zoomed on a ride on iPad landscape, the art is visibly blurred beside the crisp vector chips.
  - Evidence: `audits/screens/dollywood-live/ride-card-typical-ipad-landscape-dark.png`, `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png`.
- **VIS-DOLLYWOOD-LIVE-13 — Whole park on iPhone leaves the park small, and the full-height sheet ghosts over the meeting bar** (low; from the leads, confirmed by the investigator on the captures).
  - Whole park leaves empty green bands above and below the park (about 150 px under the meeting bar, per the checker). At full height, the sheet slides over the meeting bar, which shows through.
  - Evidence: `audits/screens/dollywood-live/whole-park-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/map-loading-iphone-pwa-light.png`, `audits/screens/dollywood-live/search-full-typical-iphone-pwa-light.png`. Leads `audits/01-leads.md:346-347`.

**Gaps** (severities are the writer's, from the investigator's reference comparison)

- **GAP-DOLLYWOOD-LIVE-1 — No Find-My-style arrival or leave alerts** (medium). Nothing tells a parent "Mae reached the meeting point" or "Ezra's phone left the park". The only proximity signal is the server's stale-kid push, which barely fires (P2-PWA-02), and the "Meet at <name>" push cannot be sent (P2-PWA-18).
- **GAP-DOLLYWOOD-LIVE-2 — No wait-time history or trend** (low). Thrill-Data shows whether a line is growing; here each wait is a single number (`apps/dollywood-live.html:1502`).
- **GAP-DOLLYWOOD-LIVE-3 — No park hours, showtimes or dining** (info). NOT FOUND IN CODE; reasonably out of scope for a family hub.
- **GAP-DOLLYWOOD-LIVE-4 — Offline is the precached page and rasters plus the last pull** (low). The page and four rasters (relief, relief_soft, slope, illustrated_lo) are precached (`sw.js:16`); the Satellite style's `aerial.jpg` (`apps/dollywood-live.html:696`) is not, by design (`sw.js:15`, `scripts/bump-sw.mjs:18`), so Satellite has no image offline unless it was opened online earlier (not tested). Family positions are whatever the last pull brought, and there are no wider tiles.

**What works**

- **OK-DOLLYWOOD-LIVE-1 — All in-app time logic is relative, so midnight, DST and time zones cannot break it.** Every time value is a `Date.now()` difference or `Date.parse` of an ISO stamp (`agoOf`, `apps/dollywood-live.html:1181`; `wago`, `apps/dollywood-live.html:1497`); the one calendar use is `toLocaleTimeString` for the waits error stamp (`apps/dollywood-live.html:1525`). No `getDate`, `getHours` or `setHours` in the live code (investigator's grep). Caveat (completeness critic): cross-device ages use each phone's own clock. A `loc:` row's `t` is the writer's `Date.now()` (`apps/dollywood-live.html:1253`) and is aged with the reader's (`apps/dollywood-live.html:1181, 1212-1214, 1255`), and the meeting point likewise (`apps/dollywood-live.html:1579`); `hub.skew` (`apps/hub.js:290`) is never applied in this app, so a phone with a wrong clock shifts "last seen", the 45-minute fade, the 4 h hide, the 24 h delete and the 2 h expiry. Not tested.
- **OK-DOLLYWOOD-LIVE-2 — The person's accent follows, and dark palettes key off `data-scheme`.** `--accent` differs per profile (Eli `#4F5D8C`, Elizabeth `#8A6A4B`) and drives the you-dot, the buttons, the route and the tab highlight. Midnight renders dark with denser glass (pill alpha 0.94); no `prefers-color-scheme` (`audits/evidence/p3/_compliance/dollywood-live.json`: `scheme.prefersColorScheme []`). Caveat from the checker: Hearth on a dark OS gives `data-scheme` light but a dark body (P2-VIS-03), and the investigator's "Parchment stays light on a dark OS" comes from `theme-follows.mjs` console output with no saved evidence file. Evidence: `audits/evidence/p3/dollywood-live/theme-denied.json`, `audits/evidence/p3/dollywood-live/theme-midnight-ipad.png`.
- **OK-DOLLYWOOD-LIVE-3 — Live-wait freshness, park-closed and error states are honest on a fresh open.** "Wait times via Queue-Times.com · posted 3 min ago" with attribution; "The park is closed — waits will show here once rides open."; an upstream 502 with a cache under 6 h keeps the waits and shows "Waits as of 12:52 PM — offline, retrying" (`apps/dollywood-live.html:1504, 1521-1526`). Qualified by P3-DOLLYWOOD-LIVE-15: a map left open through a long failure keeps old waits on the chips and the hero with no cue. Evidence: `audits/evidence/p3/dollywood-live/waits.json`, `audits/screens/dollywood-live/waits-park-closed-typical-iphone-pwa-light.png`, `audits/evidence/p3/dollywood-live/waits-error-iphone.png`.
- **OK-DOLLYWOOD-LIVE-4 — Kids are view-only by default, and only a fresh, accurate GPS fix is ever published.** A kid's device may locate only when an adult has set `kidshare:<kid>` (`apps/dollywood-live.html:693`); `publish()` refuses a restored, rough (over 150 m) or hand-placed fix (`apps/dollywood-live.html:1250`). (The guest loophole is P3-DOLLYWOOD-LIVE-02; the off-site one is P3-DOLLYWOOD-LIVE-06; a kid's open map not following the beacon switch is P3-DOLLYWOOD-LIVE-12, -13 and -16.)
- **OK-DOLLYWOOD-LIVE-5 — The kid ride card needs no reading** (from the visual check). Faces with ✓ show who can ride. Evidence: `audits/screens/dollywood-live/ride-card-kid-typical-iphone-pwa-light.png`.
- **OK-DOLLYWOOD-LIVE-6 — The map opens offline.** Unlike the build guide (P2-PWA-16), the park map and four of its five rasters are in the precache list (`sw.js:16`); the Satellite image is cached on first use (`sw.js:15`). Code only; the service worker was not exercised in the rig.

### Checked and not a bug

None. No bug, security or perf finding was refuted: all 18 sent to skeptics, 10 from the investigator, 1 from the visual check and 7 from the completeness critic, were confirmed 2/2. Several claims were narrowed or corrected rather than refuted:
- P3-DOLLYWOOD-LIVE-04 does not self-heal on the 30 s sync (the investigator's "after sync" state was a hand call to `loadMeet()`).
- P3-DOLLYWOOD-LIVE-06: the park map itself says "away from the park"; only Home is wrong.
- P3-DOLLYWOOD-LIVE-09: the second compass tap does rotate the map.
- P3-DOLLYWOOD-LIVE-11: the seed does not hide the mismatch, and the investigator's example name was invented.
- P3-DOLLYWOOD-LIVE-10: the meeting note is cut on iPad too, and the shipped UI never writes a note.
- P3-DOLLYWOOD-LIVE-12: lowered from high to medium and reclassified as a bug; the republish needs a GPS fix before the kid's next pull.
- P3-DOLLYWOOD-LIVE-14: Kiara's option is "up to 39"", and the who-chips fade rather than filter. It is now a pointer to the build guide's P3-DOLLYWOOD-06, not a primary.
- P3-DOLLYWOOD-LIVE-16: the republish comes on the next fix, and two of the critic's line numbers were wrong.

### Unresolved — needs a device or more evidence

No verified finding is unresolved. Open questions:
- **How many real Queue-Times names differ from the listings (P3-DOLLYWOOD-LIVE-11's reach).** To settle it, compare one real `queue-times.com/parks/55/queue_times.json` with the attraction names in the map data. Not fetched here (no external requests).
- **The Share switch trap (P3-DOLLYWOOD-LIVE-03).** Whether a parent who reads "switch on Share my spot" taps the already-checked switch and turns sharing off. A device test with a real person would settle it.
- **When the designed denied state appears (now P3-DOLLYWOOD-LIVE-17).** Traced from code: with no fix, `updLoc` runs only on a visibility change (`apps/dollywood-live.html:1476`), a Share toggle (`apps/dollywood-live.html:1313`) or a Set my spot toggle (`apps/dollywood-live.html:1469`); the 15 s timer needs a fix (`apps/dollywood-live.html:1477`). The designed denied state therefore appears only after the app is backgrounded and reopened, or one of those toggles is used. Whether iOS fires `visibilitychange` around its first permission prompt still needs a device.
- **A shared phone hands the next person the previous person's fix (critic observation, not sent to skeptics).** The last fix (`dollywood.live.last`, `apps/dollywood-live.html:1162, 1244, 1478`) and the trails (`dollywood.live.trails`, `apps/dollywood-live.html:1594-1597`) are device-wide, not keyed by profile. In the critic's run, Mom located herself with Share off on a family phone, switched to Kiara, and Kiara's map showed that fix as her own: "Last seen just now · Wildwood Grove" (`audits/evidence/p3/dollywood-live/critic-shared-device.json` `B_kiaraPill`, `B_kiaraView`; `audits/evidence/p3/dollywood-live/critic-shared-device-kiara-iphone.png`). An unshared adult position is shown to the next profile on the same device; it would need two skeptics before it is filed.
- **Hearth on a dark OS in this app (P2-VIS-03).** `theme-denied.json` records `data-scheme` light with a dark body; how the map chrome looks in that state was not captured.
- **Photo pucks.** The investigator's Delight reason cites photo family pucks; the demo pucks are emoji or colour discs in every capture the checker opened.

## 5. Visual fidelity

### Rubric scores

| Dimension | Investigator | Checker | Final | Provisional? | Reason | Evidence |
|---|---|---|---|---|---|---|
| Typography | 6 | 5 | **5** | No | Serif card titles (Fraunces falls back to Georgia; no web font loads) over a sans pill and rows. Sizes sit off Dynamic Type (pill 15.5 / 12.5, meeting name 14.5, tabs 12). Text below the 11 px floor: the 9.5 px "MIN" (`apps/dollywood-live.html:500`), family labels of about 8.7 px, about 6 px labels at the whole-park phone fit. The build guide's serif 600 headings in Search and Style (`apps/dollywood-live.html:59`). No ui-rounded numerals. | `audits/evidence/p3/dollywood-live/geo-good-iphone.png`, `audits/screens/dollywood-live/ride-card-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/map-loading-iphone-pwa-light.png`, `audits/screens/dollywood-live/search-query-typical-iphone-safari-dark.png` |
| Color & palette | 7 | 6 | **6** | No | A warm illustrated map (exempt cartography) and consistent category colours. The chrome is the Hearth paper the shell scored 4. Wait bands are clear but saturated literals, and the 9.5 px "MIN" fails 4.5:1 on green (4.38) and amber (3.38). The marker fallback is a real profile's colour. | `audits/evidence/p3/dollywood-live/waits-normal-iphone.png`, `audits/screens/dollywood-live/waits-typical-desktop-dark.png`, `audits/screens/dollywood-live/nearby-typical-ipad-portrait-dark.png`, `audits/evidence/p3/dollywood-live/vischeck-contrast.json` |
| Layout & spacing | 6 | 5 | **5** | No | A clean pill, buttons and bottom sheet on a good day. Overflow labels collide and clip; cards cover the buttons and the meeting bar on phones and iPad; 1,400 px rows and a visible map-art edge on desktop; empty bands at the whole-park iPhone fit; a sliver of buttons in placing mode. | `audits/evidence/p3/dollywood-live/geo-good-iphone.png`, `audits/screens/dollywood-live/map-overflow-ipad-portrait-light.png`, `audits/screens/dollywood-live/waits-typical-desktop-dark.png`, `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png`, `audits/screens/dollywood-live/placing-typical-iphone-pwa-light.png` |
| Shape, depth & material | 7 | 6 | **6** | Yes (no real blur in the rig) | Rounded glass pill, sheet and buttons, kept on the control layer; category top borders on cards. Held back by stacking (cards over the buttons and meeting bar; "Closed" chips under the Whole park button) and by the build guide's square chart, table and native checkboxes inside glass sheets. | `audits/evidence/p3/dollywood-live/theme-midnight-ipad.png`, `audits/evidence/p3/dollywood-live/loading-family-ipad-dark.png`, `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png`, `audits/screens/dollywood-live/nearby-typical-ipad-portrait-dark.png` |
| Iconography | 7 | 6 | **6** | No | Consistent stroked tab, button and turn icons. But the chrome mixes three families: text glyphs for the pill states (`apps/dollywood-live.html:1285`), emoji amenities (`apps/dollywood-live.html:1564`) and emoji profile markers. The shell scored 6 with one set. | `audits/screens/dollywood-live/directions-steps-typical-iphone-pwa-dark.png`, `audits/screens/dollywood-live/nearby-typical-ipad-portrait-dark.png`, `audits/screens/dollywood-live/ride-card-typical-iphone-pwa-light.png` |
| Motion & feedback | 6 | 5 | **5** | Yes (stills only) | Spring view and sheet tweens, button press scale and pulse rings in code. Reduced motion removes transitions only (`apps/dollywood-live.html:139`); the infinite animations keep running (`apps/dollywood-live.html:400, 413, 477, 546, 561`). Three `confirm()` dialogs and no undo (the house style puts undo under Motion & feedback). | `audits/evidence/p3/dollywood-live/geo-good-iphone.png`, `audits/00-inventory.md:4465-4467` |
| Dark mode | 8 | 7 | **7** | No | Well-made dark chrome (pill, meeting bar, sheet, directions, rows) through `data-scheme`, never `prefers-color-scheme`, well above the shell's 4. But the map stays a full-brightness daytime illustration under dark chrome, the wait tiles do not change, and the Search pane's native select stays generic. Dark text pairs were not measured. | `audits/evidence/p3/dollywood-live/theme-midnight-ipad.png`, `audits/screens/dollywood-live/waits-typical-desktop-dark.png`, `audits/screens/dollywood-live/kid-typical-ipad-portrait-dark.png`, `audits/screens/dollywood-live/directions-steps-typical-iphone-pwa-dark.png` |
| Native feel | 5 | 5 | **5** | No | A bottom sheet with a grabber, long press and drag to close. Against it: three `confirm()` dialogs, seven unguarded `:hover` rules, native selects in Search and Style and native checkboxes in Layers, an underlined "dollywood.com ↗" link, build-guide jargon, and a denied state that bypasses its designed state. | `audits/evidence/p3/dollywood-live/denied-adult-iphone.png`, `audits/screens/dollywood-live/style-typical-iphone-safari-light.png`, `audits/screens/dollywood-live/search-query-typical-iphone-safari-dark.png`, `audits/evidence/p3/_compliance/dollywood-live.json` |
| Glanceability | 5 | 5 | **5** | No | A phone tool in hand, rightly not a board: the 20 px wait numerals and the face pucks read at a glance. The labels do not (family labels about 8.7 px and colliding), and the whole-park fit on iPhone is unreadable. Nothing approaches the 65 px cap a 2.5 m glance needs. | `audits/screens/dollywood-live/map-overflow-ipad-portrait-light.png`, `audits/screens/dollywood-live/map-loading-iphone-pwa-light.png`, `audits/evidence/p3/dollywood-live/measure.json` |
| Ease of use | 6 | 5 | **5** | No | One tap to the map, with waits and family close by. But first-open GPS does not resume, the compass jumps, amenity taps are dead, the meeting bar loses Go, the denied text is cut and kid mode needs reading. | `audits/evidence/p3/dollywood-live/geo.json`, `audits/evidence/p3/dollywood-live/functional.json`, `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/waits-kid-typical-ipad-portrait-light.png` |
| Delight | 7 | 7 | **7** | No | The "Next ride · door to seat" hero, face pucks, walking turn-by-turn and the illustrated map are what a family would enjoy. Build-guide leftovers and label collisions keep it from 8. | `audits/screens/dollywood-live/nearby-typical-ipad-portrait-dark.png`, `audits/screens/dollywood-live/directions-steps-typical-iphone-pwa-dark.png`, `audits/evidence/p3/dollywood-live/geo-good-iphone.png` |

Average: (5 + 6 + 5 + 6 + 6 + 5 + 7 + 5 + 5 + 5 + 7) / 11 = 62 / 11 = **5.6**. The investigator's average was 70 / 11 = 6.4.

**How the scores were checked.**
- **What the checker opened:** 30 screenshots, including every one the investigator cited plus loading, overflow, kid, view-only, placing, search, style, coaster-card, directions and desktop captures across iPhone PWA and Safari, iPad portrait and landscape and desktop, light and dark. It wrote one measurement script, `audits/tools/phase3/dollywood-live/vischeck-contrast.mjs` (a pure computation from the CSS literals; output `audits/evidence/p3/dollywood-live/vischeck-contrast.json`).
- **Agreed:** 3 of 11 dimensions (Native feel, Glanceability, Delight).
- **Adjusted by one point:** 8 dimensions.
  - **Typography, 6 → 5:** text below 11 px (9.5 px "MIN", about 8.7 px family labels, about 6 px at the whole-park phone fit), build-guide serif headings in Search and Style, serif titles without tracking; the shell never went below 12 px and scored 5.
  - **Colour & palette, 7 → 6:** the chrome is the same Hearth paper the shell scored 4; saturated wait-band literals; the "MIN" contrast fails.
  - **Layout & spacing, 6 → 5:** desktop 1,400 px rows and the map-art edge, the whole-park empty band, the coaster card over the meeting bar on iPad, the placing-mode sliver.
  - **Shape, depth & material, 7 → 6:** stacking faults and build-guide components inside glass sheets.
  - **Iconography, 7 → 6:** three icon families where the shell had one.
  - **Motion & feedback, 6 → 5:** infinite animations under reduced motion, and `confirm()` with no undo.
  - **Dark mode, 8 → 7:** the map is not dimmed, the wait tiles do not change, a generic native select.
  - **Ease of use, 6 → 5:** kid mode needs reading, and the denied instruction is cut on iPhone.
- **Judge:** ruled on 0 dimensions; no gap reached 2 points.
- **Claims the checker corrected:**
  - `apps/dollywood-live.html:113` and `:119` are `.pop` rules; the wait numeral rule is `apps/dollywood-live.html:500`, and the file has no ui-rounded.
  - `apps/dollywood-live.html:114` is `.pop.show` and `:12` is the build guide's light token block; the wait-band literals are at `apps/dollywood-live.html:501`.
  - `apps/dollywood-live.html:16` is `.wrap` and `:41` is `.mapstage`; the tap-highlight rules are at `apps/dollywood-live.html:42, 222, 224, 416`.
  - `apps/dollywood-live.html:51` is `.exag`; Set my spot is in the markup at `apps/dollywood-live.html:632` (its 36 px rule is at `apps/dollywood-live.html:432`).
  - "Blue underlined links: absent" is contradicted by the ride card's "dollywood.com ↗".
  - "AA secondary text" was measured only in the light palette (`measure.json` `D_pairs`, 5.34:1).
  - "A light palette stays light on a dark OS" is only partly supported: Hearth gives `data-scheme` light but a dark body.
  - No photo puck appears in the captures; the demo pucks are emoji or colour discs.

### Deviations from the house style

Each is marked with the visual checker's verdict.

| Area | Deviation | Checker | Evidence |
|---|---|---|---|
| Type scale | Pill 15.5 / 12.5, meeting name 14.5, tabs 12, section labels about 11.9, family labels about 8.7 px: none on a Dynamic Type step, and the family label is well below the 11 px floor. 9.5 px "MIN" labels (checker). | Supported | `audits/evidence/p3/dollywood-live/measure.json` (`C_ipadTextPx`); `apps/dollywood-live.html:399, 500, 517` |
| ui-rounded numerals | Wait numerals are system 800 weight, not ui-rounded | Partly: the fact holds, but the citations were wrong; the rule is `apps/dollywood-live.html:500` | `apps/dollywood-live.html:500` |
| Hardcoded colours | 115 CSS hex (68 unique), 52 of them in the live block (lines 382-566); 110 JS hex, 97 excluding the 13 on the payload line 682. Much is exempt cartography, but the wait bands, scrims and glass shadows are chrome literals. | Supported (counts match); citations corrected to `apps/dollywood-live.html:501` | `audits/evidence/p3/_compliance/dollywood-live.json`; `apps/dollywood-live.html:501` |
| Design tokens | 0 references to `--fs-*`, `--sp-*`, `--r*` or `--tap`; the app borrows only `--accent`, the glass tokens and some palette tokens | Supported | `audits/00-inventory.md:4370`; `audits/evidence/p3/_compliance/dollywood-live.json` (`tokens.used`) |
| Glass on content | Glass is on the control layer (pill, sheet, buttons, route bar, overlay cards), and the map is solid | Partly: the translucent coaster card carries a data table and a chart; the cited `:16` and `:41` show nothing about glass | `audits/screens/dollywood-live/coaster-card-typical-ipad-portrait-light.png` |
| Tap targets | Set my spot 36 px; "others ≥ 44" | Partly: Done, the segment and the chips are also under 44 (VIS-DOLLYWOOD-LIVE-5) | `audits/evidence/p3/dollywood-live/measure.json`; `apps/dollywood-live.html:432, 503, 517, 522, 556` |
| Icon set | Stroked line icons plus emoji amenities, text-glyph pill states and emoji markers | Supported | `apps/dollywood-live.html:1285, 1564` |
| Confirm dialogs | Three native `confirm()` in the live path where the house style prefers undo | Supported (the build UI adds `apps/dollywood-live.html:1098`) | `apps/dollywood-live.html:1457, 1460, 1591` |
| Semantic colours | Wait bands are saturated green, amber and red literals with white text, not pastel fills with deep ink; "MIN" fails AA on two bands (checker's addition) | Checker's addition | `audits/evidence/p3/dollywood-live/vischeck-contrast.json` |
| Dark surfaces | The illustrated map stays at daytime brightness under dark chrome (checker's addition) | Checker's addition | `audits/screens/dollywood-live/kid-typical-ipad-portrait-dark.png`, `audits/screens/dollywood-live/waits-typical-desktop-dark.png` |
| Reduced motion | Only transitions are removed; five infinite animations keep running. `prefers-reduced-transparency` and `prefers-contrast`: NOT FOUND IN CODE. | Supported (from code) | `apps/dollywood-live.html:139, 400, 413, 477, 546, 561`; `audits/evidence/p3/_compliance/dollywood-live.json` (`scheme`) |

### Web tells

| Tell | Status | Evidence |
|---|---|---|
| `alert()` / `confirm()` / `prompt()` | Present | 3 `confirm()` in the live path (`apps/dollywood-live.html:1457, 1460, 1591`); `confirm()` at `apps/dollywood-live.html:1098` and `alert()` at `apps/dollywood-live.html:1101` only in the hidden build-guide UI; `audits/evidence/p3/dollywood-live/rally-guest-loading.json` captured the Meet-here text |
| Unguarded `:hover` | Present | 7 rules, 0 guarded (VIS-DOLLYWOOD-LIVE-6) |
| Grey tap highlight | Absent | `-webkit-tap-highlight-color: transparent` at `apps/dollywood-live.html:42, 222, 416` (checker's corrected lines) |
| Long-press selection or callout on chrome | Partly | Only the map is `user-select: none` (`apps/dollywood-live.html:42`). design.css's rule (`apps/design.css:355`) applies only inside `.ds`, which this app does not use, and no `-webkit-touch-callout` rule exists: NOT FOUND IN CODE (writer's code check; the investigator marked it absent). Not tested on a device. |
| Default form controls | Present | The Share and beacon switches are restyled (`apps/dollywood-live.html:435`), but Search has a native "rider height" select and Style a native contour select and Layers checkboxes (`apps/dollywood-live.html:1464`; `audits/screens/dollywood-live/style-typical-iphone-safari-light.png`) |
| Focus rings on touch | Absent | `:focus-visible` only (`apps/dollywood-live.html:27, 187, 226`) |
| Blue underlined links | Present (from the visual check) | "dollywood.com ↗" on the ride card (VIS-DOLLYWOOD-LIVE-9) |
| White flash on load | Needs a device | Body background from tokens; `apps.json:10` sets `"dark": true` to darken the viewer while loading |
| Rubber-band overscroll | Needs a device | `overscroll-behavior: contain` on the live card (`apps/dollywood-live.html:451`); body overflow hidden |
| Visible scrollbars on chrome | Needs a device | No custom scrollbar rules; content scrolls in the sheet body only |
| Layout shift as data loads | Present | The Family, Share and pill copy flips from "offline / not sharing" to the real state after the first pull (UX-DOLLYWOOD-LIVE-3; `audits/evidence/p3/dollywood-live/loading-family-ipad-dark.png`) |
| Spinners vs skeletons | Present | Spinners while locating (`apps/dollywood-live.html:406`) and a "Loading wait times…" line (`apps/dollywood-live.html:1526`); no skeletons |
| Tap delays | Absent | `touch-action: manipulation` on the body (`apps/dollywood-live.html:222`); not measurable headless |

## 6. Platform compliance

**Data through hub.js.**
- **Calls used:** `ready`, `get`, `set`, `remove`, `list`, `onChange`, `onSync`, `activity`, `migrate`, `canWrite`, `kioskNudge`, `people`, `photoUrl`, `request`, `api`, `sync` and `profile` (`audits/evidence/p3/_compliance/dollywood-live.json` `platform`). All family and person state goes through them: `loc:*`, `meet`, `kid:*`, `kidshare:*`, `share`, `progress`, `plot`.
- **localStorage bypasses (18 hits, all in try/catch):** per-device conveniences only: the last fix (`apps/dollywood-live.html:1244, 1478`), the track intent (`apps/dollywood-live.html:1402, 1404, 1469, 1487`), the style (`apps/dollywood-live.html:1416, 1479`), the who filter (`apps/dollywood-live.html:1461, 1543`), the waits cache (`apps/dollywood-live.html:1503-1504`), trails (`apps/dollywood-live.html:1596-1597`) and the build guide's offline fallback (`apps/dollywood-live.html:1055, 1057, 1061-1062`). None is shared household state; acceptable, with one caveat: the last fix and the trails are device-wide, not keyed by profile, so on a shared phone the next person inherits them (critic observation under Unresolved; `loc:` retention in the App-specific checks).
- **Network bypass (1):** `loadWaits` calls `fetch()` directly (`apps/dollywood-live.html:1500`), not `hub.request`, against `hub.api` or a hard-coded production Worker URL as a fallback (`apps/dollywood-live.html:1499`). The data is public, but the fallback means a page without `hub.api` would call production (low; not exercised here).
- **Where hub.js itself fails the map:** `hub.ready`'s global `seen` (`apps/hub.js:334-337`) is the root of P3-DOLLYWOOD-LIVE-03; `hub.sync.state` starting `'offline'` is behind UX-DOLLYWOOD-LIVE-3 (P2-SYNC-15).

**design.css tokens.** The `compliance.mjs` hits reviewed; the corrected counts:

| Category | Raw hits | Corrected | Notes |
|---|---|---|---|
| Hardcoded colours, CSS | 115 hex (68 unique); 14 named (`white`); 35 `rgb/rgba` | **115 hex**, of which 52 are in the live block (lines 382-566, 20 unique) | Much is exempt cartography (category, marker, coaster, water colours). The chrome literals are the wait bands (`apps/dollywood-live.html:501`), the meeting-bar flag and pin (`apps/dollywood-live.html:517-518`), the stamp tint (`apps/dollywood-live.html:519`), scrims and glass-shadow `rgba` |
| Hardcoded colours, JS | 110 hex | **97** (57 unique) | The 13 on the payload line 682 are map data and exempt. The rest include the `#8A6A4B` fallback (`apps/dollywood-live.html:1213`), `AMEN` (`apps/dollywood-live.html:1564`) and SVG filter colours |
| Token-derived colour | 45 `colorDerived` | 0 violations | `color-mix()` of tokens |
| Font sizes | 143 | **143 px literals** (25 distinct values), 0 via `--fs-*` | The kid type scale never reaches the app |
| Radii | 96 | **96 literals** (78 px, 18 %; 17 distinct values), 0 via `--r*` | The investigator's "68" is corrected here from the JSON |
| Spacing | 269 | **268 literals**, 1 via a token | 0 use `--sp-*` |
| Shadows | 30 | **30**, of which 16 compose tokens | |
| Durations | 21 | **21** | e.g. `.2s`, `.3s`, `2.2s` at `apps/dollywood-live.html:144, 151, 282` |
| z-index | 24 | **24** | |
| Inline styles | 23 declarations; 37 JS style writes | **23 / 37** | e.g. `apps/dollywood-live.html:982, 987` |
| Undefined tokens | 0 | **0** | 67 local custom properties are defined in the file |

**Per-profile accent.** `--accent` reaches the app and differs by person (Eli `#4F5D8C`, Elizabeth `#8A6A4B`; `audits/evidence/p3/dollywood-live/theme-denied.json`). It drives the you-dot, the buttons, the route line and the tab highlight (54 references). Family markers use each person's own colour, paired with their emoji or photo, which meets "never hue alone", except for the fallback colour (VIS-DOLLYWOOD-LIVE-7).

**Dark mode.** Keys off `data-scheme` (4 uses), never `prefers-color-scheme` (0), per CLAUDE.md. Midnight renders dark with denser glass. Hearth on a dark OS gives `data-scheme` light with a dark body (P2-VIS-03). The illustrated map is not dimmed in dark palettes (§5). `prefers-reduced-motion` is only partly honoured (transitions only), and `prefers-reduced-transparency` and `prefers-contrast` are NOT FOUND IN CODE.

**Native dialogs.** 3 `confirm()` in the live path, plus 1 `confirm()` and 1 `alert()` in the hidden build UI.

## 7. Improvements

Ratio = delight ÷ effort, with S = 1, M = 2 and L = 3. The park map is a generated file: every change goes into `../dollywood-build-project/scripts/template.html`, then `build_html.py`, `verify.py` and the export (CLAUDE.md). None adds a routine or reward system or a shopping list.

**Polish** (re-ranked by ratio after the completeness critic's four additions, ranks 5, 11, 13 and 14; rank 6 now also covers P3-DOLLYWOOD-LIVE-18)

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Escape every name and emoji in the Family pane, the family card, the own row and the kids' heights (`hub.escape` or `textContent`); reject `<` in names on the server as a second layer | 5 | S | 5.0 | P3-DOLLYWOOD-LIVE-01; `apps/dollywood-live.html:1302, 1306, 1316, 1547` |
| 2 | Kids' beacons and heights for household adults only, and always shown: gate on `kind==='adult' && !is_guest`, and render them before the "No one else is sharing" return | 4 | S | 4.0 | P3-DOLLYWOOD-LIVE-02, -05; `audits/evidence/p3/dollywood-live/verify-guest-can-flip-kid-beacon-1.json` |
| 3 | Resume GPS after the person pull (on `onSync`, or on a change to `share`) and never show "not sharing" copy while Share is on | 4 | S | 4.0 | P3-DOLLYWOOD-LIVE-03, UX-DOLLYWOOD-LIVE-3; `audits/evidence/p3/dollywood-live/geo.json` |
| 4 | A complete, kid-safe denied state that fits the phone: route the error through the designed state with its Set my spot chip, allow two lines or tap-to-expand, and use icon-led wording for a kid | 4 | S | 4.0 | P3-DOLLYWOOD-LIVE-17, P3-DOLLYWOOD-LIVE-10, UX-DOLLYWOOD-LIVE-1; `audits/evidence/p3/dollywood-live/theme-denied.json` |
| 5 | The kid's map follows the beacon: on a `kidshare` change, start or stop the watch, show or hide ◎, release the wake lock and tombstone its own row when it goes off; no Share switch for a kid; the parent's map reloads the family after the switch (from the completeness critic) | 4 | S | 4.0 | P3-DOLLYWOOD-LIVE-12, -13, -16; `audits/evidence/p3/dollywood-live/critic-kid-beacon.json` |
| 6 | Call `renderMeet()` from `setMe()`, and `loadMeet()` on the 30 s timer and on becoming visible, so walk time, Go, the age and the 2 h expiry stay current | 3 | S | 3.0 | P3-DOLLYWOOD-LIVE-04, -18; `audits/evidence/p3/dollywood-live/verify-meet-bar-stale-after-place-2.json` |
| 7 | Staleness in the arriving and far pill branches ("Last seen N ago" and Find me) | 3 | S | 3.0 | P3-DOLLYWOOD-LIVE-07; `audits/evidence/p3/dollywood-live/states.json` |
| 8 | Fix the amenity token parse, and make the compass orient the current view (sync `#l-upright` with the start rotation) instead of fitting `SEC[curSec]` | 3 | S | 3.0 | P3-DOLLYWOOD-LIVE-08, -09; `audits/evidence/p3/dollywood-live/functional.json` |
| 9 | Publish only on the property, and have Home's park card (and chat's `where_is_family`) ignore off-property rows | 3 | S | 3.0 | P3-DOLLYWOOD-LIVE-06; `audits/evidence/p3/dollywood-live/verify-publish-off-site-2.json` |
| 10 | Kid filter parity on Waits: the height chip (or a clear "too short" glyph) instead of fading, with the filter chip kept in view | 3 | S | 3.0 | UX-DOLLYWOOD-LIVE-5; `apps/dollywood-live.html:1532` |
| 11 | Search's rider-height filter keeps no-requirement rides (or is dropped for the who-chips), and a no-match search says so (from the completeness critic) | 3 | S | 3.0 | P3-DOLLYWOOD-LIVE-14 (primary P3-DOLLYWOOD-06; one template fix), UX-DOLLYWOOD-LIVE-4; `audits/evidence/p3/dollywood-live/critic-search-height.json` |
| 12 | Raise the five sub-44 control rules to 44 px, wrap the seven `:hover` rules in a fine-pointer query, and give markers without a colour a neutral design.css token instead of Elizabeth's `#8A6A4B` | 2 | S | 2.0 | VIS-DOLLYWOOD-LIVE-5, -6, -7 |
| 13 | Apply the 6 h age limit to waits on every failed refresh, and dim or mark old waits on the chips, the hero, the Nearby rows and the directions bar (from the completeness critic) | 2 | S | 2.0 | P3-DOLLYWOOD-LIVE-15; `audits/evidence/p3/dollywood-live/verify-critic-waits-stale-while-open-4-1.json` |
| 14 | A number field or picker for a kid's measured height instead of one tap per inch from 36 (from the completeness critic) | 2 | S | 2.0 | UX-DOLLYWOOD-LIVE-7; `apps/dollywood-live.html:1548` |
| 15 | De-collide family and meeting-point labels (as `drawNames` does for rides), with an 11 px floor | 3 | M | 1.5 | VIS-DOLLYWOOD-LIVE-1, -2; `audits/screens/dollywood-live/map-overflow-ipad-portrait-light.png` |
| 16 | Strip the build guide's leftovers from the park map (coaster engineering card, listings-style Search, contour and Layers controls) and hide an empty About | 3 | M | 1.5 | UX-DOLLYWOOD-LIVE-4, VIS-DOLLYWOOD-LIVE-3 |
| 17 | Wait tiles and dark map: band fills and ink from design.css tokens (pastel fills with a deep ink), labels of 11 px or more, and a dimmed illustration in dark palettes | 2 | M | 1.0 | VIS-DOLLYWOOD-LIVE-8; `audits/evidence/p3/dollywood-live/vischeck-contrast.json` |

**Missing features**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Wire the Rally control the Meet-here dialog already promises (`POST /api/dollywood/rally` exists, `worker/src/index.js:97`) | 4 | S | 4.0 | P2-PWA-18; `audits/evidence/p3/dollywood-live/rally-guest-loading.json` |
| 2 | Add the known alias ("Dollywood Express" → "Dollywood Express Train Depot") and report unmatched feed names at export or verify time. Delight lowered from the investigator's 4 because only one ride is shown to be affected. | 3 | S | 3.0 | P3-DOLLYWOOD-LIVE-11; `audits/evidence/p3/dollywood-live/verify-waits-name-match-drops-1.json` |
| 3 | Find-My-style arrival and leave nudges ("Mae reached the meeting point", "left the park") | 4 | M | 2.0 | GAP-DOLLYWOOD-LIVE-1; P2-PWA-02 |
| 4 | A wait-time trend arrow (Thrill-Data style) | 3 | M | 1.5 | GAP-DOLLYWOOD-LIVE-2 |

**New ideas**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | A shared "heading to X" that others can follow, so the family converges without a manual pin | 4 | M | 2.0 | Jobs analysis (§1); VIS-DOLLYWOOD-LIVE-2 |
| 2 | A park hours and showtimes strip beside the waits | 3 | M | 1.5 | GAP-DOLLYWOOD-LIVE-3 |

## App-specific checks

The Phase 3 brief lists no checks for this app (`audits/HUB-AUDIT-PROMPT.md:203-207` names only the timer, Tally, Larder, F260 and Prayer); these are the investigator's, plus the park-day switch row the completeness critic asked for, updated with the verification results.

| Check | Result | Evidence |
|---|---|---|
| Live waits: freshness, park closed, stale, error | **PASS on a fresh open** (OK-DOLLYWOOD-LIVE-3); **FAIL (low, P3-DOLLYWOOD-LIVE-15)** for a map left open through a long failure: old waits stay on the chips, the hero and the directions bar | `audits/evidence/p3/dollywood-live/waits.json`; `audits/screens/dollywood-live/waits-park-closed-typical-iphone-pwa-light.png`; `audits/evidence/p3/dollywood-live/verify-critic-waits-stale-while-open-4-2.json` |
| Live waits: name matching | **FAIL (low, P3-DOLLYWOOD-LIVE-11).** 33 of 34 attach in the rig feed; the train's wait is dropped silently | `audits/evidence/p3/dollywood-live/verify-waits-name-match-drops-1.json` |
| Geolocation: accuracy, cadence, battery | **PASS with notes.** High accuracy, `maximumAge` 5000, `timeout` 15000 (`apps/dollywood-live.html:1408`); publishes about every 6 s walking and 8 s standing (`apps/dollywood-live.html:1251-1252`): 7 writes in 40 s walking, 3 in 30 s still, about 450-630 writes an hour per person while open; the watch pauses when hidden (`apps/dollywood-live.html:1475`). The screen wake lock is taken with every watch (`apps/dollywood-live.html:1400, 1408`) and released only when the page is hidden (`apps/dollywood-live.html:1475`), so the screen never dims while the map is open with GPS on, including on a kid's phone after its beacon is switched off (`audits/evidence/p3/dollywood-live/critic-kid-beacon.json` `A_ezraDeviceAfter60s`: `watching true`; P3-DOLLYWOOD-LIVE-12). The rig's WebKit has no wake lock; real drain needs a device. | `audits/evidence/p3/dollywood-live/geo.json` (`C_walk`, `C_still`) |
| Geolocation: first open with Share on | **FAIL (medium, P3-DOLLYWOOD-LIVE-03)** | `audits/evidence/p3/dollywood-live/verify-first-open-gps-not-resumed-2.json` |
| Geolocation: permission denied | **FAIL.** The designed state and its chip are bypassed (low, P3-DOLLYWOOD-LIVE-17), adult wording for a kid (UX-DOLLYWOOD-LIVE-1), and the text is cut on iPhone (P3-DOLLYWOOD-LIVE-10) | `audits/evidence/p3/dollywood-live/theme-denied.json`; `audits/evidence/p3/dollywood-live/verify-critic-denied-designed-state-bypassed-6-2.json` |
| Geolocation: far from the park, off-site | **FAIL (medium).** The pill is right, but the row is published and Home says "At the park" (P3-DOLLYWOOD-LIVE-06); an old out-of-frame fix reads as live (P3-DOLLYWOOD-LIVE-07) | `audits/evidence/p3/dollywood-live/verify-publish-off-site-1.json`; `audits/evidence/p3/dollywood-live/states.json` |
| Kid beacon privacy: who can see, view-only, guests | **FAIL.** View-only by default is right (OK-DOLLYWOOD-LIVE-4), but a guest can flip a beacon (high, P3-DOLLYWOOD-LIVE-02), the controls are missing before anyone shares (P3-DOLLYWOOD-LIVE-05), a parent's beacon-off is undone by the kid's open map (P3-DOLLYWOOD-LIVE-12), a beacon-on does nothing until the kid's map is reopened (P3-DOLLYWOOD-LIVE-13), the kid's own Share switch snaps back (P3-DOLLYWOOD-LIVE-16), and the stored-script hole reaches kids' pages too (P3-DOLLYWOOD-LIVE-01). What a guest sees: guests (kind adult) see every marker, trail and Family row, kids' included, and can ask chat `where_is_family` (`worker/src/chat.js:284-289`); that is by design (CLAUDE.md: guests use every adult app). An expired guest's phone keeps the last pulled `loc:` rows and up to 20 trail points per person in localStorage (`apps/dollywood-live.html:1594-1597`); nothing clears them on expiry (not tested) | `audits/evidence/p3/dollywood-live/verify-guest-can-flip-kid-beacon-1.json`; `audits/evidence/p3/dollywood-live/verify-critic-kid-beacon-off-republished-1-2.json` |
| `loc:` retention | **Partly.** No server retention: the Worker only reads `loc:` rows (`worker/src/chat.js:286`, `worker/src/reminders.js:220`). A client deletes a row over 24 h old only when a writing, non-view-only viewer opens the map (`apps/dollywood-live.html:1255`); rows are hidden after 4 h and faded after 45 min (`apps/dollywood-live.html:1212-1214`). Each device keeps the last 20 positions per person in `dollywood.live.trails` with no age limit, including people no longer shown (`apps/dollywood-live.html:1594-1597`), and one device-wide last fix for 12 h (`apps/dollywood-live.html:1162, 1478`), so the next profile on a shared phone gets the previous person's unshared fix (`audits/evidence/p3/dollywood-live/critic-shared-device.json`; critic observation, see Unresolved) | code; `audits/evidence/p3/dollywood-live/states.json`; `audits/evidence/p3/dollywood-live/critic-shared-device.json` |
| Meeting point, Rally, heights | **FAIL.** Rally unreachable (P2-PWA-18); the bar loses its walk time and Go (P3-DOLLYWOOD-LIVE-04); its age freezes and the 2 h expiry is skipped while the map stays open (P3-DOLLYWOOD-LIVE-18); heights hidden before anyone shares (P3-DOLLYWOOD-LIVE-05), writable by guests (P3-DOLLYWOOD-LIVE-02) and one tap per inch (UX-DOLLYWOOD-LIVE-7); Search's height filter hides no-requirement rides (P3-DOLLYWOOD-LIVE-14) | `audits/evidence/p3/dollywood-live/rally-guest-loading.json`; `audits/evidence/p3/dollywood-live/verify-critic-meet-point-never-expires-while-open-7-2.json` |
| Park-day switch (Me) | Pointer: P2-PWA-02 (fires only on the 8 am / 8 pm cron). The switch "Park day: a child's spot goes quiet" is shown to adults who can see the map (`index.html:1269`) and is fed by this app's `loc:` rows, off-site ones included (P3-DOLLYWOOD-LIVE-06) | `audits/02-shell.md` P2-PWA-02 |
| Amenities | **FAIL (medium, P3-DOLLYWOOD-LIVE-08).** The Nearby chips work for four kinds | `audits/evidence/p3/dollywood-live/verify-amenity-tap-dead-2.json` |
| Map controls: compass | **FAIL (medium, P3-DOLLYWOOD-LIVE-09)** | `audits/evidence/p3/dollywood-live/verify-compass-jumps-to-entrance-2.json` |
| Offline or flaky in the park | **PASS with notes.** Precached (`sw.js:16`, OK-DOLLYWOOD-LIVE-6; not the Satellite image); waits fall back to a cache of up to 6 h with an offline stamp, but a map left open keeps old waits past that (P3-DOLLYWOOD-LIVE-15); family positions are the last pull. Only the waits error path was exercised: family positions and meeting-point writes under offline and reconnect were not (Not verified). The service worker was not exercised in WebKit headless. | `audits/evidence/p3/dollywood-live/waits.json` (`C_error`); `audits/evidence/p3/dollywood-live/verify-critic-waits-stale-while-open-4-1.json` |
| Sunlight legibility and contrast | **Provisional PASS for the pill and secondary text** in the light palette (14.68:1 and 5.34:1); **FAIL for the 9.5 px "MIN"** on green and amber (VIS-DOLLYWOOD-LIVE-8); dark pairs not measured; real sunlight needs a device | `audits/evidence/p3/dollywood-live/measure.json` (`D_pairs`); `audits/evidence/p3/dollywood-live/vischeck-contrast.json` |
| Kid view (pre-reader) | **FAIL.** Only the ride card's faces work without reading (UX-DOLLYWOOD-LIVE-1, -2, -5); a kid whose beacon is on gets a Share switch that snaps back (P3-DOLLYWOOD-LIVE-16) | `audits/evidence/p3/dollywood-live/states.json` (`D_kid`); `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png` |
| Date and time: midnight, DST, time zone | **PASS** (OK-DOLLYWOOD-LIVE-1), with an untested caveat: cross-device ages use each phone's own clock, and `hub.skew` is not applied | `apps/dollywood-live.html:1181, 1253, 1497, 1525` |
| Names rendered safely | **FAIL (critical, P3-DOLLYWOOD-LIVE-01)** | `audits/evidence/p3/dollywood-live/verify-xss-family-name-unescaped-2.json` |

## Leads from 01-leads.md

| Lead | Outcome | Where it went |
|---|---|---|
| Build guide: saved progress can be wiped by one tick on another device (`audits/01-leads.md:307`) | Partly relevant: the park map keeps the keyboard D → `stepDone` → `hub.set('progress')` path (`apps/dollywood-live.html:856, 1086, 1062`), writing this app's own hidden person scope. Not run. | P2-SYNC-01 pointer |
| Restroom, first-aid and AED markers do nothing when tapped (`:308`) | Confirmed 2/2 and widened: every amenity kind, and an open card stays | P3-DOLLYWOOD-LIVE-08 |
| "Rally the family" push cannot be triggered (`:309`) | Confirmed at runtime: 0 rally requests after Meet here | P2-PWA-18 pointer |
| Kids' beacons and heights missing when nobody else is sharing (`:310`) | Confirmed 2/2; the adult's own sharing never helps | P3-DOLLYWOOD-LIVE-05 |
| Guests get Share my spot, the beacon switches and the height steppers (`:311`) | Confirmed 2/2 for the kids' controls, both directions, and heights overwritten. A guest sharing their own spot is in line with CLAUDE.md. | P3-DOLLYWOOD-LIVE-02 |
| Meeting-point bar goes stale after Set my spot (`:313`) | Confirmed 2/2 and widened: after the first GPS fix too, and it does not self-heal | P3-DOLLYWOOD-LIVE-04 |
| An old location outside the frame reads as live (`:314`) | Confirmed 2/2 (90 min to 11 h) | P3-DOLLYWOOD-LIVE-07 |
| The compass jumps to the Entrance and parking area (`:315`) | Confirmed 2/2; the second tap does rotate | P3-DOLLYWOOD-LIVE-09 |
| While data loads it says not sharing and offline (`:316`) | Confirmed; permanent on a device's first open | UX-DOLLYWOOD-LIVE-3, P3-DOLLYWOOD-LIVE-03, P2-SYNC-15 |
| The location-denied message is incomplete; kids get adult wording (`:317`) | Confirmed; the text is also cut on iPhone (2/2) | UX-DOLLYWOOD-LIVE-1, P3-DOLLYWOOD-LIVE-10 |
| A view-only kid is pointed at a hidden button (`:318`) | Confirmed | UX-DOLLYWOOD-LIVE-2 |
| The ride card's Track button opens the raw survey card (`:333`) | Confirmed | VIS-DOLLYWOOD-LIVE-3, UX-DOLLYWOOD-LIVE-4 |
| The ride card has an empty ABOUT and covers controls on phones (`:334`) | Confirmed | VIS-DOLLYWOOD-LIVE-3 |
| Family marker labels collide (`:335`) | Confirmed, plus the meeting-point label (checker) | VIS-DOLLYWOOD-LIVE-1, -2 |
| When filtered for a kid, Waits rows are only faded (`:336`) | Confirmed (`apps/dollywood-live.html:1532` adds no height chip) | UX-DOLLYWOOD-LIVE-5 |
| Live waits attach only by exact normalised name (`:337`) | Confirmed 2/2, narrowed to one known ride; the investigator's example was invented | P3-DOLLYWOOD-LIVE-11 |
| Build guide: the "up to 36"" height filter hides everything with no requirement (`:322`) | The same `listItems` runs in the park map's Search pane (`apps/dollywood-live.html:1007, 1012`); confirmed 2/2 there (from the completeness critic) | P3-DOLLYWOOD-LIVE-14 (pointer to the build guide's P3-DOLLYWOOD-06) |
| The Search pane is the build guide's listings panel (`:338`) | Confirmed by the visual check; its no-match facet ("0 of 145" with no message) confirmed by the critic (`audits/evidence/p3/dollywood-live/critic-search-height.json` `D_noMatch`) | UX-DOLLYWOOD-LIVE-4 |
| Build guide: profile axis labels are unreadable on phones (`:341`) | Applies to the park map's Track card: the same chart line (`apps/dollywood-live.html:936`). Not measured here | UX-DOLLYWOOD-LIVE-4, VIS-DOLLYWOOD-LIVE-3 |
| Build guide: the glass cards and sheet are too transparent over the map (`:342`) | Applies to the ride and coaster cards (the guide's `.pop` rules); needs real blur on a device | VIS-DOLLYWOOD-LIVE-3 |
| The Style pane carries build-guide controls (`:344`) | Confirmed (`apps/dollywood-live.html:1464`) | UX-DOLLYWOOD-LIVE-4 |
| Whole park on iPhone leaves the park small (`:346`) | Confirmed | VIS-DOLLYWOOD-LIVE-13 |
| The full-height sheet slides over the meeting bar (`:347`) | Confirmed | VIS-DOLLYWOOD-LIVE-13 |

## Not verified

- Real Liquid Glass blur, SF Pro rendering and real touch. The rig is headless WebKit on Windows, so Shape and Motion are provisional and the contrast pairs over glass are computed, not seen.
- Service-worker offline behaviour, the white flash on load and rubber-band overscroll in the standalone PWA.
- Sunlight legibility of the pill and labels on a real phone; the dark-palette text pairs.
- Live GPS "weak" and "searching" states with a moving position, and the heading cone (the rig injects fixed coordinates).
- Wake lock on iPadOS, and battery drain with the map open all day. The code settles when the lock is held (every watch, until the page is hidden); the rig's WebKit has no `navigator.wakeLock`, so it was never observed.
- Family positions and meeting-point writes under offline and reconnect: the coalesced `loc:` writes queued and flushed on reconnect (`apps/hub.js:239, 257-281`), the Family header "offline — showing last known" (`apps/dollywood-live.html:1298`) and a meeting point set offline were not exercised; only the waits error path was.
- An expired guest's device keeping the last `loc:` rows and trails after expiry (code only, `apps/dollywood-live.html:1594-1597`).
- The shared-phone last-fix observation (Unresolved) and clock skew between phones (OK-DOLLYWOOD-LIVE-1's caveat).
- Real Queue-Times ride names (P3-DOLLYWOOD-LIVE-11's reach); no external request was made.
- The "Meet at <name>" push end to end: no UI calls it (P2-PWA-18).
- Whether the production fallback URL in `loadWaits` (`apps/dollywood-live.html:1499`) ever fires in the real app; only the local instance was exercised.
- Sending stolen tokens off the device (P3-DOLLYWOOD-LIVE-01): skeptic 2 proved read-and-replay locally; no network target was used.
- `renderKids()`'s unescaped `${k.name}` (`apps/dollywood-live.html:1547`); kid names are admin-set.
- P3-DOLLYWOOD-LIVE-10's exact cut points with real iOS fonts (the overflow is about 2×, so the result stands).
- The investigator's "Parchment stays light on a dark OS" rests on `theme-follows.mjs` console output with no saved evidence file.
- The keyboard D path writing `progress` in this app's scope (P2-SYNC-01 pointer) was not run.
- P2-PWA-02, P2-CHAT-02, P2-STAB-01 and P2-VIS-03 in this app: inherited from Phase 2, not re-run (P2-VIS-03 only observed in `theme-denied.json`).
- `compass2.mjs`, named in the investigator's draft, is not in the scripts folder; the compass finding rests on `functional.mjs`, `measure.mjs` and the two skeptic scripts.

## Scripts and evidence

**Investigator** (`audits/tools/phase3/dollywood-live/`):
- `_lib.mjs` (shared helpers), `geo.mjs`, `functional.mjs`, `states.mjs`, `theme-denied.mjs`, `theme-follows.mjs`, `rally-guest-loading.mjs`, `waits.mjs`, `measure.mjs` and `xss-guest-name.mjs`.
- Platform counts: `node audits/tools/phase3/compliance.mjs dollywood-live` → `audits/evidence/p3/_compliance/dollywood-live.json`.

**Skeptics** (`audits/tools/phase3/dollywood-live/`):

| Finding | Scripts |
|---|---|
| P3-DOLLYWOOD-LIVE-01 | `verify-xss-family-name-unescaped-1.mjs`, `verify-xss-family-name-unescaped-2.mjs` |
| P3-DOLLYWOOD-LIVE-02 | `verify-guest-can-flip-kid-beacon-1.mjs`, `verify-guest-can-flip-kid-beacon-2.mjs` |
| P3-DOLLYWOOD-LIVE-03 | `verify-first-open-gps-not-resumed-1.mjs`, `verify-first-open-gps-not-resumed-2.mjs` |
| P3-DOLLYWOOD-LIVE-04 | `verify-meet-bar-stale-after-place-1.mjs`, `verify-meet-bar-stale-after-place-2.mjs` |
| P3-DOLLYWOOD-LIVE-05 | `verify-beacon-height-controls-missing-when-nobody-sharing-1.mjs`, `verify-beacon-height-controls-missing-when-nobody-sharing-2.mjs` |
| P3-DOLLYWOOD-LIVE-06 | `verify-publish-off-site-1.mjs`, `verify-publish-off-site-2.mjs` |
| P3-DOLLYWOOD-LIVE-07 | `verify-out-of-frame-stale-reads-live-1.mjs`, `verify-out-of-frame-stale-reads-live-2.mjs` |
| P3-DOLLYWOOD-LIVE-08 | `verify-amenity-tap-dead-1.mjs`, `verify-amenity-tap-dead-2.mjs` |
| P3-DOLLYWOOD-LIVE-09 | `verify-compass-jumps-to-entrance-1.mjs`, `verify-compass-jumps-to-entrance-2.mjs` |
| P3-DOLLYWOOD-LIVE-10 | `verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-1.mjs`, `verify-vis-pill-and-meeting-bar-ellipsis-cuts-off-the-locat-1-2.mjs` |
| P3-DOLLYWOOD-LIVE-11 | `verify-waits-name-match-drops-1.mjs`, `verify-waits-name-match-drops-2.mjs` |
| P3-DOLLYWOOD-LIVE-12 | `verify-critic-kid-beacon-off-republished-1-1.mjs`, `verify-critic-kid-beacon-off-republished-1-2.mjs` |
| P3-DOLLYWOOD-LIVE-13 | `verify-critic-kid-beacon-on-needs-reopen-2-1.mjs`, `verify-critic-kid-beacon-on-needs-reopen-2-2.mjs` |
| P3-DOLLYWOOD-LIVE-14 | `verify-critic-search-height-filter-hides-no-requirement-3-1.mjs`, `verify-critic-search-height-filter-hides-no-requirement-3-2.mjs` |
| P3-DOLLYWOOD-LIVE-15 | `verify-critic-waits-stale-while-open-4-1.mjs`, `verify-critic-waits-stale-while-open-4-2.mjs` |
| P3-DOLLYWOOD-LIVE-16 | `verify-critic-kid-share-switch-noop-5-1.mjs`, `verify-critic-kid-share-switch-noop-5-2.mjs` |
| P3-DOLLYWOOD-LIVE-17 | `verify-critic-denied-designed-state-bypassed-6-1.mjs`, `verify-critic-denied-designed-state-bypassed-6-2.mjs` |
| P3-DOLLYWOOD-LIVE-18 | `verify-critic-meet-point-never-expires-while-open-7-1.mjs`, `verify-critic-meet-point-never-expires-while-open-7-2.mjs` |

**Completeness critic** (`audits/tools/phase3/dollywood-live/`): `critic-kid-beacon.mjs` (P3-DOLLYWOOD-LIVE-12, -13), `critic-search-height.mjs` (-14), `critic-waits-stale.mjs` (-15), `critic-kid-share-switch.mjs` (-16), `critic-meet-expiry.mjs` (-18) and `critic-shared-device.mjs` (the shared-phone observation under Unresolved). P3-DOLLYWOOD-LIVE-17 rests on the P3-DOLLYWOOD-LIVE-10 skeptic runs plus its own two.

The skeptics' verdict records were kept in the session's scratch folder, outside the repository; their evidence is in the folder below.

**Visual checker.** `audits/tools/phase3/dollywood-live/vischeck-contrast.mjs` → `audits/evidence/p3/dollywood-live/vischeck-contrast.json`; it opened the 30 screenshots summarised in §5.

**Evidence** is in `audits/evidence/p3/dollywood-live/`:
- JSON: `functional.json`, `geo.json`, `measure.json`, `rally-guest-loading.json`, `states.json`, `theme-denied.json`, `waits.json`, `xss-guest-name.json`, `vischeck-contrast.json`, the `critic-*.json` files, and the `verify-*.json` files.
- PNGs at 1× CSS scale: `denied-*`, `functional-compass-after`, `geo-*`, `loading-family-ipad-dark`, `measure-after-compass-ipad`, `rally-guest-family-iphone`, `states-*`, `theme-midnight-ipad`, `waits-*`, `xss-guest-eli-family-ipad`, the `critic-*` images, and the `verify-*` images.

The Phase 1 captures are under `audits/screens/dollywood-live/`, with contact sheets `audits/screens/_sheets/dollywood-live--*.jpg`.
