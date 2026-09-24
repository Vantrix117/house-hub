# Tally counter (`tally`) — Phase 3 deep dive

| | |
|---|---|
| **App code audited** | `fe6041d`, unchanged since the Phase 0 baseline. This phase changed no app code. |
| **File(s)** | `apps/tally.html` (161 lines). Shared code it depends on: `apps/hub.js` (500), `apps/design.css` (617), `worker/src/data.js` (72). Registry entry: `apps.json:7`. |
| **Date** | 2026-09-24 |
| **Inputs** | `audits/00-inventory.md` §9b "tally — Tally counter" (lines 3788-3868); 60 Phase 1 captures under `audits/screens/tally/` and the sheets `audits/screens/_sheets/tally--main.jpg` and `audits/screens/_sheets/tally--kid.jpg`; `audits/01-leads.md` "Tally counter and Kitchen timer" (lines 210-253); Phase 2 IDs P2-SYNC-01, P2-SYNC-03, P2-SYNC-15, P2-SYNC-17, P2-SYNC-18, P2-PROF-02, P2-PROF-14, P2-PROF-19, P2-STAB-01, P2-VIS-03, P2-CHAT-01, P2-CHAT-09 and the unnumbered Sync UX note (`audits/02-shell.md:2910`). |
| **Runtime** | Local instance with the demo household (typical seed: Eli 37, Ezra 12, Kiara 5), Playwright WebKit. Chromium and the real clock where stated. No production data or endpoint was touched. |
| **Reproduce** | Scripts in `audits/tools/phase3/tally/`, evidence in `audits/evidence/p3/tally/`. Run each with `node "audits/tools/phase3/tally/<name>.mjs"`. |

**How to read this.** Every bug, security or perf finding went to two independent skeptics. Each re-read the code and re-ran the finding with their own script; a third skeptic would have broken a tie. A defect is **CONFIRMED** only when at least two skeptics reproduced it and more confirmed it than refuted it. Refuted findings go under "Checked and not a bug", and undecided ones under "Unresolved". After the draft, a completeness critic ran its own sweep; each of its six candidates also went to two skeptics, and five became P3-TALLY-05 to -09 (one of them reclassified from UX-TALLY-6, one from half of UX-TALLY-2), while the sixth, a positive, extends OK-TALLY-1. UX, VIS, GAP and OK items describe the design, not malfunctions, so they were not adversarially verified. A separate agent re-checked every rubric score against the screenshots; a judge would have settled any gap of 2 or more points, but none arose. Severity follows the rule at the top of `audits/02-shell.md` (lines 25-37).

## Summary

- **What it is.** One personal tap counter per person. It stores a single person-scope row, `app_data(person, 'tally', 'count')` (`apps/tally.html:150-155`). It has no Home card, no feed lines and no TV pane. Kids see it because its `apps.json:7` entry has no `visibleTo`.
- **Confirmed defects: 8 primary (3 critical, 0 high, 2 medium, 3 low), plus P3-TALLY-03 as a pointer to P2-SYNC-03.** None were refuted or left unresolved. The worst is **P3-TALLY-01**: when one person counts on two devices, each device's taps silently overwrite the other's. Runs lost 5 of 8, 12 of 13 and 4 of 6 taps. The other two criticals, P3-TALLY-02 and P3-TALLY-05, and the P2-SYNC-03 pointer (P3-TALLY-03) also destroy the count:
  - **P3-TALLY-02:** one tap during a slow or failed first load turned 37 into 1.
  - **P3-TALLY-05:** taps still queued when Tally is closed (offline, then the Hub button) are never sent by the shell, which reads "synced"; a count on another device then erased them (37 + 4 + 2 ended at 39).
  - **P3-TALLY-03, pointer to P2-SYNC-03:** a pre-hub value on the device replaced 37 with 5, with no tap at all. The cause is `hub.migrate`'s local-only check (`apps/hub.js:406-407`), which Phase 2 owns; the roll-up counts it there.

  P3-TALLY-01 and -02 are new Tally triggers of mechanisms Phase 2 proved elsewhere (P2-SYNC-01, P2-SYNC-17). P3-TALLY-05's cause, the shell declaring no tally channel, is owned by no P2 ID (P2-PROF-02 is its Switch trigger), so it stays primary. The two mediums: a guest who opens Tally first on a device takes the household's legacy count (P3-TALLY-06), and a slow or failed first load shows 0 as the count (P3-TALLY-07).
- **Rubric: final average 4.9 / 10** (investigator 5.1). The visual checker lowered Shape and Native feel by one point each. Glanceability is best at 7; Iconography, Motion, Dark mode and Delight are weakest at 4.
- **Biggest usability gaps.**
  - "Reset to zero" wipes the count in one tap, with no confirm and no undo. It is a text-only button in the same glass as +, 24 px below it, and pre-readers are shown it (UX-TALLY-1).
  - Counting takes 3 taps from Home (UX-TALLY-3).
  - While the app loads there is no busy state, and taps first do nothing (UX-TALLY-2); the fake 0 it shows is filed as a bug (P3-TALLY-07).
- **Biggest visual gaps.**
  - In every dark palette the + and − discs stand only 1.13-1.62:1 from the page wash (VIS-TALLY-1).
  - The count uses a serif face, not ui-rounded (VIS-TALLY-3).
  - Glass is on the content dial as well as the controls (VIS-TALLY-9).
- **What works.**
  - 100 rapid taps land exactly, in one POST, and 60 taps on a slow link with pulls forced mid-burst also end exact (OK-TALLY-1).
  - All text passes AA in every palette for every family colour (minimum 6.93:1).
  - Targets are large, and there are no hardcoded colours (OK-TALLY-2).
  - The kiosk cannot write (though it shows live controls, P3-TALLY-09), and guests get their own counter (OK-TALLY-3).
- **Best-value improvement.** An undo toast after Reset (delight 5, effort S). The most important fix is structural:
  - Count by delta, so taps from different devices add up (P3-TALLY-01).
  - Accept no taps, and show no number, until the data has arrived. Together with the shared hub.js fix for P2-SYNC-17 and P2-SYNC-03, this closes P3-TALLY-02, P3-TALLY-03 and P3-TALLY-07.
  - Send a closed app's queued taps: the shell flushes every queued channel of the signed-in person, and the frame flushes on `pagehide` (P3-TALLY-05; a hub.js and index.html fix shared with Phase 2).

## 1. Purpose and top jobs

Tally is a single-view tap counter (`apps/tally.html:130-140`):
- a "<Name>'s counter" pill;
- a glass dial showing the count;
- − and + buttons;
- a "Reset to zero" button.

Each person has their own count, including guests. The TV kiosk cannot write.

There is no usage data, so the top jobs are inferred from the app:

| # | Job | Who | How often |
|---|---|---|---|
| 1 | Count something by tapping + (reps, laps, pages, "how many times") | Any adult; Ezra and Kiara | Occasionally, in bursts of many taps |
| 2 | Glance at or show the current count | Kids showing a number; adults checking | Every time the app is opened |
| 3 | Start over with "Reset to zero" | Anyone; for kids, often by accident | At the end of a counting session |

## 2. Features and gaps

**References.**
- **Apple first-party:** there is no Apple tally app. The closest is Clock → Stopwatch. Lap is a tap-to-count with a running list, and Reset is offered only after Stop, so one stray tap cannot clear a run in progress. The Apple support page could not be fetched (only navigation came back), so these facts come from product knowledge, not a cited page.
- **Best in class:** dedicated App Store counter apps as a genre. No specific product was opened or checked for this report, so no single app is named; the capabilities below are the ones such apps commonly offer, from product knowledge: multiple named counters, step size, haptics and sound per tap, undo, history, widgets and goals.

| Capability | This app | Reference | Gap |
|---|---|---|---|
| Tap to add one | Yes, a 140 px + (kid 168 px) (`apps/tally.html:84, 123`) | Stopwatch Lap; counter apps | None |
| Subtract one | Yes, clamped at 0 (`apps/tally.html:152, 154`) | Counter apps | None. At 0 it still writes (P3-TALLY-04). |
| Reset | One tap, no confirm (`apps/tally.html:155`) | Stopwatch: only after Stop. Counter apps: confirm or undo. | Yes (UX-TALLY-1) |
| Undo | NOT FOUND IN CODE | Counter apps; iOS shake-to-undo | Yes |
| History of counts or resets | None: one `count` key (`apps/tally.html:150`) | Stopwatch lap list; counter-app history | Yes (GAP-TALLY-1) |
| Several named counters | No | Counter apps | Yes (GAP-TALLY-1) |
| Step size | No | Counter apps | Yes |
| Haptic or sound per tap | No (`navigator.vibrate`: NOT FOUND IN CODE) | Counter apps | Yes. On iOS a web page can realistically offer sound only; the Vibration API is not in iOS Safari (product knowledge). |
| Home or Lock Screen widget | No: tile `small`, no `widgetHtml` entry (`apps.json:7`; `audits/00-inventory.md:420`) | Counter-app widgets | Yes (UX-TALLY-3) |
| Sync across a person's devices | Yes, through hub.js, but taps get lost (P3-TALLY-01) or stay unsent once Tally is closed (P3-TALLY-05) | iCloud sync in counter apps | Partly |
| Sync or offline status | None: no `hub.onSync` in the file, and the shell's dot reads synced while Tally taps wait (P3-TALLY-05) | Not applicable | Yes (P2 Sync UX pointer) |
| VoiceOver hears the new count | No `aria-live` on `#n` (`apps/tally.html:134`) | Native controls announce values | Yes (UX-TALLY-4) |
| Per-person counter, kid sizes, kiosk read-only, guests | Yes (`apps/tally.html:122-124, 152`) | Not applicable | Partly (OK-TALLY-3): the kiosk's controls look live (P3-TALLY-09), and a guest can take the device's legacy count (P3-TALLY-06) |

## 3. Ease of use

Taps measured with real clicks in `audits/tools/phase3/tally/audiences.mjs` (evidence `audits/evidence/p3/tally/audiences.json` → `taps`):

| Job | Profile | Path | Taps | Target ≤ 2 for the most frequent | Met? |
|---|---|---|---|---|---|
| Count one (the most frequent job) | Eli, iPhone PWA | Home → Apps tab → Tally tile → + (server 37 → 38) | 3 | ≤ 2 | **No** |
| Count one, kid | Ezra, iPad portrait | Home → Apps tab → Tally tile (3rd tile, top right) → + (server 12 → 13) | 3 | ≤ 2 | **No** |
| See the count | Eli / Ezra | Home → Apps tab → Tally tile | 2 | n/a | n/a (2) |
| Reset to zero | Ezra, iPad portrait | Home → Apps tab → Tally tile → Reset (13 → 0, no dialog) | 3 | n/a | n/a |

Home has no Tally card or button (`homeHasTallyButton: false`).

- **Discoverability.** Inside the app everything is visible: + is obvious, and − and Reset sit under the dial. Outside it, Tally is reachable only from the Apps grid; neither Home nor the TV shows it (UX-TALLY-3).
- **Undo.** None for +, − or Reset (NOT FOUND IN CODE; `apps/tally.html:152-155`). One Reset loses the only record of the count (UX-TALLY-1).
- **Error prevention.**
  - − is clamped at 0, but it stays enabled and still writes a row on every tap (P3-TALLY-04).
  - Reset has no confirm (UX-TALLY-1).
  - Nothing stops taps while the data is still loading: they either do nothing (before hub.ready) or write over the real count (after it) (UX-TALLY-2, P3-TALLY-02). The 0 on screen meanwhile looks like the real count (P3-TALLY-07).
- **One-handed phone use.** The centre of + sits at 66% of the frame height on iPhone PWA (y 583 of 884) and 70% in Safari, in the thumb zone. Reset is 24 px below + (`audits/evidence/p3/tally/layout.json`). On a phone turned sideways, + is below the fold (UX-TALLY-5).
- **iPad glanceability at 2-3 m.** Distances use the heuristic "legible when ink height ≥ distance / 200", at 0.192 mm per CSS px on the iPad (`audits/tools/phase3/tally/glance.mjs:3-4`; evidence `audits/evidence/p3/tally/glance.json`).
  - A 2-digit count has 21.5 mm of ink: legible to about 4.3 m (kid view 4.5 m).
  - A 7-digit count (1284750) has 9.2 mm: about 1.84 m.
  - The owner pill has 1.7 mm: about 0.35 m.
- **Pre-reader use (Ezra, Kiara).**
  - + and − are big symbol buttons (168 / 116 px) and work without reading.
  - Reset is the words "Reset to zero", in the same bright glass as +, 24 px below it. One tap destroys the count (UX-TALLY-1).
  - The owner is shown only as 12 px uppercase text.
  - The Apps-grid tile icon ⊕ is recognisable (`audits/evidence/p3/tally/kid-apps-grid-ipad-portrait.png`).

## 4. Issues and bugs

### Register

| ID | Severity | Defect |
|---|---|---|
| P3-TALLY-01 | critical | Two devices of the same person lose each other's taps, because every tap writes the absolute count |
| P3-TALLY-02 | critical | A tap during a slow or failed first load replaces the saved count (37 → 1, or 37 → 0 with −) |
| P3-TALLY-03 | pointer → P2-SYNC-03 (critical) | Pre-hub Tally data on a device migrates over the real count when the first pull has not landed (37 → 5, no tap) |
| P3-TALLY-04 | low | − at 0 is not disabled and gives no feedback, yet every tap writes and re-stamps the row |
| P3-TALLY-05 | critical | Taps still queued when Tally closes are never sent by the shell, which reads synced; a later count on another device erases them (37 + 4 + 2 → 39) |
| P3-TALLY-06 | medium | A guest who opens Tally first on a device receives the household's legacy `tally.count`; the next household adult gets 0 |
| P3-TALLY-07 | medium | On a slow or failed first load Tally shows 0 as the person's count, for up to about 30 s after a failure |
| P3-TALLY-08 | low | Tally shows and counts from any value chat writes: −13 shows as -13 and + writes 0; 12.5 counts to 13.5; 1e21 stays 1e+21 |
| P3-TALLY-09 | low | Opened on the TV, Tally offers live-looking +, − and Reset, against CLAUDE.md's "check `hub.canWrite` before offering edits" |

### Phase 2 defects that show up here

- **P2-SYNC-01** (critical). The whole-row last-write-wins mechanism behind P3-TALLY-01. Tally's absolute counter is a new facet, filed as P3-TALLY-01.
- **P2-SYNC-17** (critical). The same 6 s `hub.ready` window, which also opens at once on a failed pull (`apps/hub.js:334-337`). Proven for Tally at runtime in P3-TALLY-02 (37 → 1). Phase 2 had left Tally unrun (`audits/02-shell.md:2975, 2996`). The display half, a 0 shown as the count while the window is open, is filed as P3-TALLY-07.
- **P2-SYNC-03** (critical). The same local-only `hub.has` check in `hub.migrate` (`apps/hub.js:406-407`); Tally only calls it as documented (`apps/tally.html:147`). Proven for Tally at runtime (37 → 5, no tap) and kept as **P3-TALLY-03, a pointer to this ID**; the roll-up counts it here. Extra exposure for P2-SYNC-03: the shell never pulls `tally|person` (`index.html:457-458`), so Phase 2's safe case, where the shell pulled first, never applies to Tally. A different trigger in the same function, a guest passing its adult check (`apps/hub.js:400`), is P3-TALLY-06, which stays primary.
- **P2-SYNC-18** (critical). Argued from code, not run: `refreshScope` can leave Tally's display stale. But the next tap reads `hub.get` from the refreshed store (`apps/tally.html:150`), so Tally never writes a stale value back; only the display lags.
- **P2-PROF-02** (critical). A person's offline Tally taps on the shared iPad stay stuck in that person's queue after Switch (person scope). Not re-run. A plain close of Tally strands its queue the same way, with no Switch and no second person, because the shell never declares the tally channel: a new trigger, filed as P3-TALLY-05.
- **P2-PROF-19** (critical). "Forget this device" deletes any queued Tally taps. Not re-run.
- **P2-PROF-14** (critical). A fast-clocked device's Tally write outranks later, correct writes from the same person's other devices. Not re-run.
- **P2-STAB-01** (critical). With Reduce Motion on, the shell is blank, so Tally cannot be reached from Home. Opened directly, Tally renders (`audits/evidence/p2/VIS/verify-rm2-webkit-standalone-tally-reduce.png`).
- **P2-VIS-03** (medium). Hearth on a dark OS paints a hybrid: the light-branch wash (`apps/tally.html:14-16`) under Midnight discs and text. The visual checker saw the wash turn light grey-lavender toward the bottom (`audits/evidence/p3/tally/theme-hearth-darkos-eli.png`). Text still passes at 10.5-11.6:1.
- **P2 Sync UX, "nobody is told when a change did not sync"** (medium, unnumbered; `audits/02-shell.md:2910`). Tally has no `hub.onSync` and no status. The offline captures look the same as the online ones (`audits/screens/tally/main-offline-*.png` against `main-typical-*`), which the visual checker confirmed. In two-devices C the phone showed 41 while offline and later, silently, 39. Once Tally is closed, the shell's dot and Me → Sync read "synced", 0 waiting, while Tally taps are still queued (P3-TALLY-05).
- **P2-SYNC-15** (low). `hub.sync.state` starts as `'offline'`. Tally never shows the state, so this has no visible effect here. Its display analogue in Tally, a 0 shown as the count on a cold load, lasts until a pull succeeds and is filed as P3-TALLY-07.
- **P2-CHAT-01** (medium). Chat's `set_data` can overwrite any person's Tally count, kids' included, with no confirmation or undo (`worker/src/chat.js:29-30, 52, 173-179`); the rig's mock even answers "set my tally to N" (`scripts/mock-anthropic.mjs:25`). Phase 2 counted kid Tally writes as within what the kid UI already allows (`audits/02-shell.md:3678`). The new facet, that `set_data` stores any value and Tally shows and counts from it unchecked, is P3-TALLY-08.
- **P2-CHAT-09** (critical). A chat "set my tally to N" that lost last-write-wins to a future-stamped device write still shows "✓ Saved count in tally". Not re-run.

### Confirmed defects

#### P3-TALLY-01 — Two devices of the same person lose each other's taps: every tap writes the absolute count

- **Severity: critical** (skeptics: critical / critical; unchanged from the investigator's rating). This is rule (a): in ordinary use the shipped UI silently overwrites the app's only household data, and no dev tools are needed.
- **Exposure.** The same person counts on two devices, for example the Kitchen iPad (open 24/7) and a phone, and the second device taps before its next pull. That happens when:
  - both apps are open, since an open app polls only every 30 s (`apps/hub.js:342`);
  - a reopen races its pull on a slow link;
  - either device is offline.

  Kids using Tally under their own profile on the shared iPad and on a parent's phone are exposed in the same way.
- **Related.** P2-SYNC-01 is the same stale-copy, per-row last-write-wins class, but covers only F260 and build-guide map rows, and its fix (one row per key) does not fix a single counter. Scenario B is also the cached-open window of P2-SYNC-17.

**What happens now.** Each tap writes `n() + 1`, computed from this device's own copy (`apps/tally.html:150-154`). `hub.set` stamps it with the current time (`apps/hub.js:231-243`), and the Worker keeps the newest stamp and no history (`worker/src/data.js:39-64`). Any taps the other device made since this one last pulled are overwritten, and nothing is shown.
- **A (both devices open).** The phone adds 5 (37 → 42), then the iPad, still showing 37, adds 3. The server holds 40 instead of 45, so 5 taps are lost. After its next poll the phone drops silently from 42 to 40.
- **B (stale cache).** The iPad had Tally open earlier (cache 37) and the phone counts to 50. The iPad reopens Tally on a slow link (GET held 1.5 s) and taps once. The server holds 38 instead of 51, so 12 taps are lost. Control B0, with no hold, gives 51.
- **C (both offline).** The phone adds 4 and the iPad adds 2, then they reconnect, phone first. The server holds 39 instead of 43, so the phone's 4 are lost.

**Expected.** Increments from every device add up, for example as a delta the Worker applies, or as one row per device summed on read. At the least, no tap should write before a fresh pull.

**Why it matters to the household.** The count is the app's only data. It silently goes down after it was counted up, and neither device says so; the phone's sync state still reads "synced".

**Evidence.**
- Code: `apps/tally.html:150-154`; `apps/hub.js:231-243, 295-296, 342`; `worker/src/data.js:39-64`.
- Runs: `audits/evidence/p3/tally/two-devices.json`, `audits/evidence/p3/tally/verify-lww-absolute-count-loses-increments-1.json`, `audits/evidence/p3/tally/verify-lww-absolute-count-loses-increments-2.json`.
- Screenshot: `audits/evidence/p3/tally/verify-lww-absolute-count-loses-increments-2-A-phone.png`.

**Reproduction.** `node "audits/tools/phase3/tally/two-devices.mjs"` (about 2 minutes). It prints:
- `A {start:37, afterPhone:42, afterIpad:40, expected:45, lost:5, phoneShowsAfterPoll:"40"}`
- `B {cachedOnIpad:"37", afterPhone:50, serverEnd:38, expected:51}`
- `B0 {serverEnd:51}`
- `C {afterPhoneOnline:41, serverEnd:39, expected:43, phoneShowsAfterPoll:"39"}`

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read `apps/tally.html:150-154`, `apps/hub.js:231-243, 293-299, 342` and `worker/src/data.js:36-61`. They ran `node "audits/tools/phase3/tally/verify-lww-absolute-count-loses-increments-1.mjs"` (typical seed, demo clock, WebKit) and saw:
  - A: `{start:37, ipadBefore:"37", afterPhone:42, ipadStillShowsBeforeTap:"37", afterIpad:40, expected:45, lost:5, phoneRightAfter:"42", phoneAfterPoll:"40"}`.
  - C: `{offline:{phone:"41", ipad:"39", server:37}, afterPhoneOnline:41, serverEnd:39, expected:43, lost:4}`.
  - Control K, where the iPad pulls before it taps: `serverEnd:45`. So the loss needs a stale local copy.
- **Skeptic 2** ran `node "audits/tools/phase3/tally/verify-lww-absolute-count-loses-increments-2.mjs" chromium` twice, on the **real clock in Chromium**, to rule out the demo clock and WebKit. Both runs gave the same numbers:
  - A: `{afterPhone:42, ipadShownBeforeTap:"37", afterIpad:40, lost:5, phoneShownAfterPoll:"40", phoneSync:{state:"synced", pending:0}, phoneToasts:[]}`.
  - Control A0: `{ipadShownBeforeTap:"42", afterIpad:45, lost:0}`.
  - C: `{serverEnd:39, expected:43, lost:4}`.

**Corrected claim.** The claim holds; the skeptics reproduced A and C but did not re-run B. Two refinements:
- Scenario B is the P2-SYNC-17 cached-open window: `hub.ready` resolves at once from the cache (`apps/hub.js:334-336`) before the pull lands. It names P2-SYNC-17 as a second related ID.
- P3-TALLY-04 adds a trigger with no visible effect: on a stale device, a − tap at 0 overwrote the other device's newer 5 with 0 (real clock).

#### P3-TALLY-02 — A tap during a slow or failed first load replaces the saved count

- **Severity: critical** (skeptics: critical / critical; unchanged). This is rule (a): one tap on + or − in the shipped UI replaces the person's saved count on the server, every other device adopts it, and the Worker keeps no history to restore from.
- **Exposure.** This is the first open of Tally for a profile on a device with no tally cache: a new or re-paired phone, the first sign-in on the shared iPad, or cleared storage. The first tally pull must take more than 6 s or fail; one 503 or one network error is enough. The trigger is a single tap.
- **Related.** P2-SYNC-17 has the same root cause (`hub.ready` cannot tell "no data yet" from "no data"), and one fix covers both. It is filed here because Phase 2 left Tally unrun (`audits/02-shell.md:2975, 2996`).

**What happens now.** On a device with no tally cache, `hub.ready` races the first pull against 6 s, and resolves at once if the pull fails (`apps/hub.js:334-337`). The shell does not sync the tally channel (`index.html:458`), so the app frame's own pull is the only one. Tally then paints 0 and wires + and − (`apps/tally.html:145-157`). A tap writes `count = 1` (or 0 with −) with a newer stamp, and its flush replaces the server's 37.
- **Hold (GET held 9 s):** ready at 6118 ms showing "0"; tap at 6531 ms; server 37 → 1.
- **Fail (503):** ready at 149 ms showing "0"; tap at about 1.1-1.4 s; server 37 → 1.
- **Control (no hold):** shows 37; the tap gives 38.

**Expected.** Tally writes nothing, and keeps + and − disabled, until its data has arrived. `hub.ready` should tell "no data yet" apart from "no data".

**Why it matters to the household.** The count is replaced for good. The screen already shows 0, as if the count had been wiped, which invites exactly the tap that makes the loss permanent. Kids, Tally's likeliest users, are hit the same way (Ezra 12 → 1).

**Evidence.**
- Code: `apps/hub.js:252-253, 295-296, 334-337`; `apps/tally.html:145-157`; `index.html:457-458`; `worker/src/data.js:60-62`.
- Run: `audits/evidence/p3/tally/first-load.json`.
- Screenshots:
  - `audits/evidence/p3/tally/first-load-hold-at-tap.png`
  - `audits/evidence/p3/tally/verify-first-load-tap-overwrites-count-2-hold10-at-tap.png`
  - `audits/evidence/p3/tally/verify-first-load-tap-overwrites-count-2-hold10-ipad-after.png`: the iPad shows ELI'S COUNTER 1.
  - `audits/screens/tally/main-loading-iphone-pwa-light.png`

**Reproduction.** `node "audits/tools/phase3/tally/first-load.mjs"`. Observed:
- hold: `{serverBefore:37, readyAtMs:6132, shownAtReady:"0", serverAfter:1}`
- fail: `{readyAtMs:149, shownAtReady:"0", serverAfter:1}`
- control: `{shownAtReady:"37", serverAfter:38}`

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/tally/verify-first-load-tap-overwrites-count-1.mjs"` with different triggers from the investigator's (typical seed, demo clock, WebKit, a newly paired phone for each mode):
  - abort, with the GET failing as a network error (no HTTP status): ready at 159 ms showing "0". **−** was tapped at 1372 ms, the POST went out at 1644 ms, and the server ended at `{value:0}`. The Kitchen iPad then showed "0".
  - hold (8 s): ready at 6129 ms showing "0". + was tapped at 6532 ms and the POST went out at 6786 ms, while the GET was still held. The server ended at 1, and the iPad showed "1".
  - control: 37 → 38.

  Screenshot: `audits/evidence/p3/tally/verify-first-load-tap-overwrites-count-1-abort-after-tap.png`.
- **Skeptic 2** ran `node "audits/tools/phase3/tally/verify-first-load-tap-overwrites-count-2.mjs"`:
  - hold10: ready at 6141 ms showing "0", with + enabled and no tally cache keys. A tap at 6564 ms took the server from 37 to 1, and the Kitchen iPad showed "1".
  - neterr: ready at 158 ms (lastError "network"); the tap took the server from 37 to 1.
  - minus: 37 → 0.
  - kid (Ezra): 12 → 1.
  - latetap control: 37 → 38.

**Corrected claim.** The substance holds, and the trigger is slightly wider:
- **Mechanism.** The overwrite is the tap's own flush, which the Worker accepts because its stamp is newer (`worker/src/data.js:60-62`). It is not `pullScope` skipping the server row.
  - In the hold run the POST landed before the held GET returned, so the later skip came from the local-stamp check (`apps/hub.js:296`), not the pending-queue check (`:295`).
  - After the failed pull `hub.sync` reads offline, but `navigator.onLine` is still true, so `flush()` goes ahead (`apps/hub.js:253`).
- **Wider trigger.**
  - A plain network error opens the window at once, not only a 503.
  - − writes 0.
  - A kid's counter is hit the same way.
  - During the hold, nothing on screen tells "still loading" apart from "zero".

#### P3-TALLY-03 — Pre-hub Tally data on a device migrates over the real count when the first pull has not landed (pointer to P2-SYNC-03)

**Pointer.** Same defect as P2-SYNC-03 (cause `apps/hub.js:406-407`); the roll-up counts it there. This block is kept as proof that P2-SYNC-03 reaches every `hub.migrate` caller. Extra exposure for P2-SYNC-03: the shell never pulls `tally|person` (`index.html:457-458`), so Phase 2's safe case, where the shell pulled first, never applies to Tally.

- **Severity: critical, counted under P2-SYNC-03** (skeptics: critical / critical; unchanged; not in this report's totals). This is rule (a): just opening Tally on a slow or failing network, with no tap, silently replaces a person's real count with a stale pre-hub value, and the new value then appears on all their devices.
- **Exposure.** The device must meet two conditions:
  - its localStorage still holds the pre-hub key `tally.count`;
  - it has no `hub.migrated['tally.person']` mark.

  An adult then opens Tally before the first tally pull lands, because the pull takes more than 6 s or fails. The mark is set on the first adult open, so this can happen only once per device, but "Forget this device" clears the mark (it removes only `hub.*` keys) and re-arms it. The local instance cannot show whether any household device still holds `tally.count`.
- **Related.** P2-SYNC-03 owns this defect: the same local-only check in `hub.migrate` (`apps/hub.js:406-407`), and one fix covers every caller. Phase 2 listed `tally.html:147` as an untested caller (`audits/02-shell.md:2975`).

**What happens now.** `hub.migrate` (`apps/tally.html:147`; `apps/hub.js:393-411`) writes the legacy value when `!hub.has('count')`. That check reads only the local cache (`apps/hub.js:224`), which is still empty when `hub.ready` has given up after 6 s or on a failed pull. With `tally.count = "5"` on the device and the first GET held 9 s, the page showed 5, and the server went from 37 to 5 with no tap. Unlike F260 (P2-SYNC-03), Tally has no safe case once the shell has pulled, because the shell never syncs the tally channel (`index.html:458`).

**Expected.** Migration runs only after a successful pull shows that the key is absent on the server. That is what the code comment promises (`apps/hub.js:391-392`: "only if that key is still empty on the server") and what the project's own test asserts (`scripts/test-hub.mjs:186-193`).

**Why it matters to the household.** The real count is silently replaced by an old number from before profiles existed, and nobody touched anything.

**Evidence.**
- Code: `apps/tally.html:147`; `apps/hub.js:224, 334-337, 391-411`; `index.html:458`.
- Runs: `audits/evidence/p3/tally/first-load.json` (the `migrate` case), `audits/evidence/p3/tally/verify-legacy-migrate-overwrites-count-1.json`, `audits/evidence/p3/tally/verify-legacy-migrate-overwrites-count-2.json`.
- Screenshots: `audits/evidence/p3/tally/verify-legacy-migrate-overwrites-count-1-hold9.png`, `audits/evidence/p3/tally/verify-legacy-migrate-overwrites-count-2-ipad.png`.

**Reproduction.** `node "audits/tools/phase3/tally/first-load.mjs"`. The `migrate` case prints `{serverBefore:37, readyAtMs:6120, shownAtReady:"5", tapAtMs:null, serverAfter:5}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/tally/verify-legacy-migrate-overwrites-count-1.mjs"`. Each arm used a new paired phone holding `tally.count = "5"`, with no taps:
  - control: shows 37, server stays 37.
  - hold5: ready at 5140 ms, shows 37, server stays 37.
  - hold9: ready at 6293 ms showing "5"; the server became `{value:5}`, and `legacyLeft` was '5'.
  - fail (503 for 8 s): ready at 152 ms showing "5"; server 5.
  - Afterwards the Kitchen iPad showed "5".
- **Skeptic 2** ran `node "audits/tools/phase3/tally/verify-legacy-migrate-overwrites-count-2.mjs"`:
  - WebKit hold9: ready at 6139 ms showing "5"; the queue held `{count:{value:5}}`; the server became 5, and the Kitchen iPad showed "5".
  - WebKit abort (network error): ready at 191 ms showing "5"; server 5.
  - WebKit hold4 and control: 37 kept.
  - **Chromium** hold9: ready at 6158 ms showing "5"; server 5.
  - In every arm the migrated mark was set and `tally.count` stayed on the device.

**Corrected claim.** The trigger is wider than "the first pull takes more than 6 s". The server is overwritten whenever the first tally pull has not landed when `hub.ready` resolves: a pull held past 6 s, or a failed pull (a 503 or a network error, overwriting within 0.2 s). A 4-5 s hold and a normal pull are safe. The overwritten value spreads to the person's other devices.

#### P3-TALLY-04 — − at 0 is not disabled and gives no feedback, yet every tap writes and re-stamps the row

- **Severity: low** (skeptics: low / low; unchanged). On its own this is an edge case: the value stays 0, and clamping at 0 is plainly intended. What is wrong is the enabled control that does nothing and says nothing, plus a redundant write. The one data effect, a stale device's − overwriting a newer count, is a trigger of P3-TALLY-01 and is rated there.

**What happens now.** `set(Math.max(0, -1))` writes 0 (`apps/tally.html:152`). `hub.set` always queues and re-stamps, and never compares with the current value (`apps/hub.js:236-241`). Three taps sent 3 batch POSTs of value 0. The button stays enabled, and nothing tells a child why nothing happened. Reset at 0 behaves the same way (`apps/tally.html:155`; `rapid.json` resetAtZero posts 1).

**Expected.** At 0, − is disabled or dimmed (`aria-disabled`), and no write is sent when the clamped value equals the current one.

**Why it matters to the household.** A child pressing − at 0 gets no response. On a device that has not pulled yet, a − that visibly did nothing can wipe the count someone just made on another device.

**Evidence.**
- Code: `apps/tally.html:152, 154-155`; `apps/hub.js:236-241`; `worker/src/data.js:60`.
- Runs: `audits/evidence/p3/tally/rapid.json` (minusAtZero), `audits/evidence/p3/tally/verify-minus-at-zero-silent-write-1.json`, `audits/evidence/p3/tally/verify-minus-at-zero-silent-write-2.json`, `audits/evidence/p3/tally/verify-minus-at-zero-silent-write-2-realclock.json`.
- Screenshot: `audits/evidence/p3/tally/verify-minus-at-zero-silent-write-1.png`.

**Reproduction.** `node "audits/tools/phase3/tally/rapid.mjs"` → `minusAtZero {display:0, posts:3, values:[[0],[0],[0]], button:{disabled:false}}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/tally/verify-minus-at-zero-silent-write-1.mjs"`:
  - Three taps at 0 sent one POST each with value 0, and the row's `updated_at` changed every time (1790080801231 → …2363 → …3484 → …4597).
  - `#minus` stayed `disabled:false` with `aria-disabled:null`, no toast appeared, and the display stayed "0".
  - A newer count of 4, written as if from another device, was then overwritten by the stale device's − tap (server `value:0`).
- **Skeptic 2** ran `node "audits/tools/phase3/tally/verify-minus-at-zero-silent-write-2.mjs"` on the demo clock and again with `CLOCK=real`:
  - S: `posts:3`, `rowRestamped:true`, the minus button `{disabled:false, ariaDisabled:null, opacity:'1'}`, no feedback in the shell or the frame.
  - X, real clock: the phone counted to 5, then the stale iPad's − posted 0 with `applied:true`, and the server ended at 0 (`phoneTapsLost:5`).
  - X, demo clock: the iPad's stamp came out older (`applied:false`). The skeptic attributes this to the rig's slowed demo clock, not the app.

**Corrected claim.** Accurate as filed. It sharpens the tie-in: on a device that has not pulled, a − tap at 0 looks like it did nothing, yet it overwrites the newer count from another device (5 → 0). That consequence is counted under P3-TALLY-01.

#### P3-TALLY-05 — Taps still queued when Tally closes are never sent by the shell; it reads synced, and a later count on another device erases them

- **Severity: critical** (skeptics: critical / critical; filed critical by the completeness critic). This is rule (a): the phone accepted and showed the taps, and in ordinary use (count offline, tap the Hub button, later count on another device) the shipped UI silently loses them. No dev tools are needed.
- **Exposure.** Taps must still be queued when Tally closes: made offline, or on a slow uplink within about 1-2 s of closing it. Any close counts (the Hub button, a tab tap). Without a write from another device the taps are only delayed until Tally is reopened on that device; they are lost for good when the same person counts on another device first. Any app whose channel the shell does not declare strands its queue the same way; Tally is the proven case.
- **Related.** P2-PROF-02 (critical) is the same stranded queue with the shell reading synced, triggered by Switch; here there is no Switch and no second person, only closing the app. The permanent loss is the absolute-count last-write-wins of P3-TALLY-01 (mechanism P2-SYNC-01). Phase 2 noted that nothing flushes on pagehide or unload (`audits/02-shell.md:1604`) and that tally is a channel the shell does not declare (`audits/02-shell.md:2342`).

**What happens now.** Only the Tally frame's own hub.js sends the tally queue. The shell's `hub.use` list has no tally channel (`index.html:457-458`), and `flush()` walks only the channels its own window declared (`apps/hub.js:183-187, 253-257`). The Hub button calls `showTab` → `closeViewer`, which flushes the shell's own channels and sets the frame to `about:blank` 220 ms later (`index.html:634-635, 729-734`). The shell's `visibilitychange` and `online` handlers and its 30 s poll also cover only its own channels (`apps/hub.js:339-342`). A grep finds no `pagehide`, `beforeunload`, `keepalive` or `sendBeacon` in hub.js, index.html or tally.html.
- **S (offline, then Hub).** Eli's phone goes offline, taps + 4 times (shows 41), taps Hub and comes back online. 35 s later the server still holds 37, the shell's `hub.sync` is `{state:'synced', pending:0}`, and `hub.queue.tally.person.eli` still holds 41. The Kitchen iPad (Eli) opens Tally at 37 and taps + twice → 39. When the phone reopens Tally, its older-stamped 41 loses: server and phone end at 39 (expected 43).
- **S0 (control, Tally left open while reconnecting).** Ends at 43.
- **Slow uplink** (each batch POST held 1.5 s by a Playwright route). 3 taps, then Hub 0.4 s after the last. The first batch (38) lands; the follow-up batch (40) never starts once the frame is gone. 35 s later the server holds 38 (expected 40), the shell reads synced, and 40 is still queued. Control, Hub 3 s after the last tap: 40.

**Expected.** Queued writes reach the server whenever the device is online, whether or not the app that made them is open. At the least, the shell sends every queued channel of the signed-in person on `online` and on `closeViewer`, the frame flushes on `pagehide` with `fetch(..., {keepalive: true})`, and the sync dot never reads synced while writes are waiting.

**Why it matters to the household.** Counting offline (in the car, at the park) and then going back to Home is ordinary use. The count never reaches the person's other devices, and if they keep counting there, the phone's taps are overwritten. The dot and Me → Sync ("synced", "Waiting to send 0") say all is well the whole time.

**Evidence.**
- Code: `index.html:457-458, 634-635, 729-734`; `apps/hub.js:183-187, 253-257, 339-342`.
- Runs: `audits/evidence/p3/tally/critic-stranded.json`, `audits/evidence/p3/tally/critic-stranded-online.json`, `audits/evidence/p3/tally/verify-critic-stranded-queue-on-close-1-1.json`, `audits/evidence/p3/tally/verify-critic-stranded-queue-on-close-1-2.json`.
- Screenshot: `audits/evidence/p3/tally/verify-critic-stranded-queue-on-close-1-2-A-me-sync.png` (Me with the green synced dot while the tally queue holds 40).

**Reproduction.** `node "audits/tools/phase3/tally/critic-stranded.mjs"` (about 2 minutes; typical seed, real clock, WebKit) prints:
- `S {start:37, offlineShown:"41", afterOnline_35s:37, shellSyncAfterOnline:{state:"synced", pending:0}, ipadShowsAtOpen:"37", afterIpad:39, serverEnd:39, expected:43}`
- `S0 {afterOnline_35s:41, ipadShowsAtOpen:"41", afterIpad:43, serverEnd:43}`

`node "audits/tools/phase3/tally/critic-stranded-online.mjs"` (about 90 s) prints `quick {start:37, server35sAfterClose:38, expected:40, shellSync:{state:"synced", pending:0}}` and `control {server35sAfterClose:40}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** re-read the cited code and ran `node "audits/tools/phase3/tally/verify-critic-stranded-queue-on-close-1-1.mjs"` (typical seed, real clock, WebKit):
  - A (offline, +4, Hub, online 35 s, then the iPad taps +2 and the phone reopens Tally): the server still held 37 after 35 s, the shell read synced/0, and the queue still held 41. The iPad opened at "37" and took the server to 39. At the end the server, the phone and the iPad all read 39, and the phone's queue was `{}`. Expected 43.
  - B (the phone reopens before any other device counts): 37 after 35 s, then 41 on reopen. The taps are only delayed.
  - C (slow link): the held first POST (38) still reached the server after the frame closed, no second POST was sent, and the server stayed at 38 (expected 40) with the shell at synced/0 and 40 queued.
- **Skeptic 2** ran `node "audits/tools/phase3/tally/verify-critic-stranded-queue-on-close-1-2.mjs"` (typical seed, real clock, WebKit):
  - A: offline +3 (shows 40), Hub, online. After 35 s and a hidden → visible cycle the server was still 37, and Me → Sync read "synced", "Waiting to send 0". The 40 landed only when Tally was reopened.
  - B: offline +3, Hub, online 5 s. The iPad opened at "37" and tapped +1: server 38 (expected 41), and the phone ended at "38".
  - C: batches `[38]`, `[40]`; server 38 after 12 s; shell synced/0; 40 queued.

**Corrected claim.** Confirmed, with three refinements:
- **Slow link.** On the rig `about:blank` did not cancel the in-flight POST. What is stranded is the follow-up batch, which never starts because hub.js sends batches one at a time behind `flushing` (`apps/hub.js:253-255`). The delay is a Playwright route inside the browser, so whether a real iOS WebView aborts the in-flight POST is untested; the offline arm alone carries the finding.
- **Root cause in the shell.** Any app channel missing from `index.html:457-458` is stranded the same way. The shell declares reminders, f260, leftovers, prayer|person, hub, timer, dollywood-live|family and kidverse (`index.html:457-458`). So `tally|person`, `verses|person`, `dollywood|person`, `prayer|family` and `dollywood-live|person` are stranded the same way (by code). No P2 ID owns this cause (P2-PROF-02 is the Switch trigger), so this ID stays primary; the other reports carry pointers.
- **Loss versus delay.** Permanent loss also needs Tally's absolute count under last-write-wins (P3-TALLY-01). Counting by delta would turn the loss into a delay, but would not send the taps any sooner.

#### P3-TALLY-06 — A guest who opens Tally first on a device receives the household's legacy count; the next household adult gets 0

- **Severity: medium** (skeptics: medium / medium; unchanged). Not critical under (a), because nothing is destroyed at once: the legacy original stays on the device (`apps/hub.js:392`), and the value sits in the guest's person scope until the purge 30 days after she expires. It is medium because a secondary, one-time flow (the legacy import) sends the household's count to the wrong person, and the adult it was meant for silently gets 0.
- **Exposure.** The device still holds the pre-hub key `tally.count`, has no `hub.migrated['tally.person']` mark (no adult has opened Tally there since the rebuild, or "Forget this device" re-armed it), and a guest opens Tally before any household adult does. The same guard applies to every `hub.migrate` caller that uses person scope.
- **Related.** P2-SYNC-03 is the same function with a different trigger and cause (the local-only `hub.has` check before the first pull), so this is not a duplicate. Phase 0 noted that a guest passes the check (`audits/00-inventory.md:1747`); Phase 2 did not file it.
- **Cause is platform (`apps/hub.js:400`); no P2 ID owns it, so this ID stays primary for every person-scope `hub.migrate` caller:** F260 (`apps/f260.html:905`), the build guide (`apps/dollywood.html:1107`), Tally (`apps/tally.html:147`), and Prayer (`apps/prayer.html:649-650`). Prayer's call moves the legacy blob's *personal* list, a household adult's private prayers, into the guest's person scope. That facet may meet severity rule (b). It was not run and is listed in the Prayer report's Not verified.

**What happens now.** `hub.migrate` gives person-scope legacy data to any profile whose kind is `'adult'` (`apps/hub.js:400`). Guests are created with kind `'adult'` and `is_guest` 1 (`worker/src/index.js:170, 197-198`), and `publicProfile` drops `is_guest` (`apps/hub.js:60-62`), so `hub.profile` cannot tell a guest from a household adult. The shell knows (`index.html:475`); `hub.migrate` never checks. On a phone holding `tally.count = "23"`:
- Grandma Jo (guest) opens Tally first. It shows 23, the server stores 23 in her person scope, and `hub.migrated` gets `'tally.person'`.
- Mom then signs in on the same phone and opens Tally. It shows 0, her server row stays empty, and `tally.count` "23" is left unused on the device.

**Expected.** Per `CLAUDE.md:66`, legacy data goes to the first household adult who opens the app on the device. `hub.migrate` should skip a guest, as it skips kids, and leave the migrated mark unset (for example by checking `hub.session.profile.is_guest`). The fix is in hub.js.

**Why it matters to the household.** The household's pre-profile count lands in a temporary visitor's profile and is later purged, and the adult who should have received it sees 0.

**Evidence.**
- Code: `apps/hub.js:60-62, 390-411`; `worker/src/index.js:170, 197-198`; `index.html:475`; `apps/tally.html:147`; `CLAUDE.md:66`.
- Runs: `audits/evidence/p3/tally/critic-guest-migrate.json`, `audits/evidence/p3/tally/verify-critic-guest-gets-legacy-migration-2-1.json`, `audits/evidence/p3/tally/verify-critic-guest-gets-legacy-migration-2-2.json`.
- Screenshots: `audits/evidence/p3/tally/verify-critic-guest-gets-legacy-migration-2-2-guest.png`, `audits/evidence/p3/tally/verify-critic-guest-gets-legacy-migration-2-2-mom.png`.

**Reproduction.** `node "audits/tools/phase3/tally/critic-guest-migrate.mjs"` (about 40 s; typical seed, real clock, WebKit). It prints `guest {who:"Grandma Jo's counter", shows:"23", serverGuest:23}` and `mom {who:"Elizabeth's counter", shows:"0", legacyStillOnDevice:"23", serverMom:null}`.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/tally/verify-critic-guest-gets-legacy-migration-2-1.mjs"`, opening Tally standalone rather than in the shell viewer (one shared iPhone PWA context with `tally.count = "23"`, typical seed, real clock):
  - A, guest first: `/api/me` returns `kind:'adult', is_guest:true`, but `hub.profile` has no guest flag. The guest saw 23, her server count became 23, and the mark was set. Mom then saw 0, with her server count null and `tally.count` still "23".
  - B, control with a kid first: Ezra saw his own 12 and the mark stayed null. Mom then saw 23, and her server count became 23.
- **Skeptic 2** ran `node "audits/tools/phase3/tally/verify-critic-guest-gets-legacy-migration-2-2.mjs"`:
  - A: the guest saw 23 (server 23; `hub.session.profile.is_guest` true while `hub.profile` had no flag); Mom saw 0 (server null).
  - B, control with Mom first on a fresh phone: 23, server 23.

**Corrected claim.** Accurate, with two corrections:
- The guest INSERT with kind `'adult'` is at `worker/src/index.js:197-198`; line 170 is the comment describing it.
- "No way to recover it" goes a little too far. The original stays on the device, and "Forget this device" clears `hub.migrated` (`audits/02-shell.md:1627`), so after re-pairing the next adult to open Tally gets it. Nobody would find that path unaided.

Skeptic 2 adds a facet for the other app reports: the same guard sends F260 and Prayer legacy person-scope data to a guest. If that data is personal (the F260 journal, a private prayer list), it may meet rule (b) there. Tally's counter does not.

#### P3-TALLY-07 — On a slow or failed first load Tally shows 0 as the person's count

- **Severity: medium** (skeptics: medium / medium; reclassified by the completeness critic from the display half of UX-TALLY-2). The display alone loses no data: the server stayed at 37 in every run without a tap, and the overwrite a tap causes is P3-TALLY-02. It is medium because the app's one value is shown wrong, for about 6 s after a slow pull and about 30 s after a failed one, with nothing to say so.
- **Exposure.** The first open of Tally for a profile on a device with no tally cache, when the first pull fails or takes more than 6 s. With a warm cache a failed pull keeps showing the cached count.
- **Related.** P2-SYNC-17 has the same root cause: `hub.ready` resolves after a failed first pull or at the 6 s cap. Its shell display analogue is P2-SYNC-15 (low). The Tally surface is new, because `apps/tally.html` has no loading branch at all.

**What happens now.** The markup's placeholder 0 (`apps/tally.html:134`) is painted as the count. `hub.ready` waits for the first pull only when no channel has a cache, caps the wait at 6 s, and resolves at once if the pull fails (`apps/hub.js:334-337`). `show()` then paints `n()` = 0, the name pill fills in and the buttons go live (`apps/tally.html:145-157`). After a held pull the 0 stays until the pull lands; after a failed pull it stays until the frame's next 30 s poll (`apps/hub.js:342`), because the shell does not sync the tally channel. There is no skeleton, `aria-busy` or error text, and Tally never shows `hub.sync`.
- **Held GET (9 s):** 0 with an empty pill from 148 ms; 0 with "Eli's counter" and a live + at 6265 ms; 37 at 9522 ms.
- **503:** 0 with the pill and a live + at 147 ms (sync `error`); the next GET at 30139 ms; 37 at 30469 ms.
- **Network error:** 0 at 109 ms (sync `offline`); 37 at 30200 ms.
- **Warm cache (control):** the cached 37 at 115 ms despite a 503.

**Expected.** Until a pull has succeeded or a warm cache exists, Tally shows a loading or "could not load" state (a skeleton, `aria-busy`, disabled buttons), never a number presented as the count.

**Why it matters to the household.** The screen says the count was wiped. That invites exactly the tap that makes the wipe permanent (P3-TALLY-02), and on a kid's device it looks as if their count is gone.

**Evidence.**
- Code: `apps/tally.html:134, 145-157`; `apps/hub.js:334-337, 342`.
- Runs: `audits/evidence/p3/tally/loading.json` (afterPullLanded at 10503 ms; buttons live at 6.1 s while showing 0), `audits/evidence/p3/tally/first-load.json` (fail: `readyAtMs:149, shownAtReady:"0"`), `audits/evidence/p3/tally/verify-critic-fake-zero-while-loading-5-1.json`, `audits/evidence/p3/tally/verify-critic-fake-zero-while-loading-5-2.json`.
- Screenshots: `audits/evidence/p3/tally/verify-critic-fake-zero-while-loading-5-1-fail-zero.png`, `audits/evidence/p3/tally/verify-critic-fake-zero-while-loading-5-2-abort-zero.png`, `audits/evidence/p3/tally/loading-at-1500ms-iphone.png`, `audits/screens/tally/main-loading-ipad-portrait-light.png`.

**Reproduction.** `node "audits/tools/phase3/tally/first-load.mjs"` (the fail case: the first GET answers 503) and `node "audits/tools/phase3/tally/loading.mjs"` (GET held 9 s; `#n` sampled over time).

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/tally/verify-critic-fake-zero-while-loading-5-1.mjs"` (typical seed, demo clock, WebKit, a newly paired phone, no taps), sampling every 500 ms: control 37 at 162 ms; hold 0 until 9522 ms, with the pill and a live + from 6265 ms; fail 0 from 147 ms until 30469 ms. The server stayed 37 throughout.
- **Skeptic 2** ran `node "audits/tools/phase3/tally/verify-critic-fake-zero-while-loading-5-2.mjs"`, sampling every 250 ms: abort 0 from 109 ms until 30200 ms (GETs at 63 ms, aborted, and 30074 ms); hold 0 until 8127 ms, with the pill from 6102 ms; warm control 37 at 115 ms. The server stayed 37 throughout.

**Corrected claim.** Accurate, with three refinements:
- During a held pull the markup 0 shows from about 150 ms with an empty pill, and taps do nothing because the handlers attach only after ready (UX-TALLY-2). From the 6 s cap the 0 has the name pill and live buttons.
- After a failure the retry is the frame's own 30 s poll. A visibility change, an `online` event or the viewer's reload button retries sooner, but nothing on screen suggests reloading.
- In the abort case the frame's `hub.sync.state` reads `offline` while the device is online, a facet of P2-SYNC-15.

#### P3-TALLY-08 — Tally shows and counts from any value chat writes: −13, 12.5 and 1e21 are shown as-is

- **Severity: low** (skeptics: low / low; unchanged). Tally's own buttons always write a non-negative integer. A bad value needs a chat `set_data` call with an unusual value (unproven model behaviour) or a hand-made PUT. What follows is a confusing display and a + that resets or does nothing; the value + replaces was already invalid.
- **Exposure.** Chat's `set_data`, which kids may call (`worker/src/chat.js:52`), writes a negative, fractional or non-numeric count; or a raw PUT to `/api/data` does.
- **Related.** P2-CHAT-01 (medium) owns `set_data` accepting any value. Phase 2 treated kid Tally writes as within what the kid UI allows (`audits/02-shell.md:3678`); negative, fractional and exponent values are outside it. The new facet is on the app side: Tally never checks the count it reads.

**What happens now.** `n()` is `Number(value) || 0`, with no rounding, clamping or finite check (`apps/tally.html:150`). `show()` prints it raw (`:151`), and `set()` clamps only on write with `Math.max(0, v)` (`:152`). `set_data`'s value schema is `{}`, and the handler stores `input.value` unchecked (`worker/src/chat.js:29-30, 173-179`). Each value below was set as Ezra with one scripted `set_data`, followed by one tap:
- −13 shows "-13"; + (or −) writes and shows 0.
- 12.5 shows "12.5"; + gives 13.5.
- 1e21 shows "1e+21"; + leaves 1e+21.
- "twelve" shows 0; + writes 1.
- The string "15" and the control 7 count normally (16, 8).

Every `set_data` returned the chip "✓ Saved count in tally".

**Expected.** Tally treats the count as a non-negative safe integer: `n()` rounds, clamps at 0 and rejects non-finite values, so + always adds one and the dial never shows a negative, fractional or exponent value. Ideally `set_data` also validates Tally's value.

**Why it matters to the household.** A kid who asks chat to "take 50 off my tally" could end up with a negative count, and pressing + then wipes it to 0. It is odd and confusing rather than destructive.

**Evidence.**
- Code: `apps/tally.html:150-152`; `worker/src/chat.js:29-30, 52, 173-179`.
- Runs: `audits/evidence/p3/tally/critic-chat-values.json`, `audits/evidence/p3/tally/verify-critic-count-not-sanitised-3-1.json`, `audits/evidence/p3/tally/verify-critic-count-not-sanitised-3-2.json`.
- Screenshots: `audits/evidence/p3/tally/critic-chat-values-minus13-after-plus-ipad.png` (Ezra's dial reads 0 after one + from −13), `audits/evidence/p3/tally/verify-critic-count-not-sanitised-3-2-minus13-ipad.png` (the dial reads -13).

**Reproduction.** `node "audits/tools/phase3/tally/critic-chat-values.mjs"` (about 60 s; typical seed, real clock, WebKit). For each value it scripts one `set_data` through `audits/tools/phase2/CHAT/lib.mjs` as Ezra, opens Ezra's Tally on the iPad, reads `#n`, taps + once and reads `#n` and the server.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/tally/verify-critic-count-not-sanitised-3-1.mjs"`: −13 → "-13", then + gives 0 and − gives 0; 12.5 → 13.5; 1e21 stays "1e+21"; "twelve" → 0, then 1; "15" → 16; control 7 → 8; a raw PUT of −13 (status 200) → "-13", then + gives 0.
- **Skeptic 2** ran `node "audits/tools/phase3/tally/verify-critic-count-not-sanitised-3-2.mjs"`: chat −13 → "-13", then 0; chat 12.5 → 13.5; raw PUT 1e21 (applied) → "1e+21" after +; raw PUT −4 → "-4", then 0.

**Corrected claim.** Accurate. The dial shows an ASCII hyphen ("-13"), not a typographic minus; from −13 the − button also writes 0, not −14; a numeric string counts normally; and 1e21 does not overflow the layout. Skeptic 2 proposed also naming P2-PROF-05 and P2-SEC-02 for the raw-API route. They are not named here: they cover kid limits on family data and client-only `visibleTo`, and a person writing their own Tally row falls under neither.

#### P3-TALLY-09 — Opened on the TV, Tally offers live-looking +, − and Reset

- **Severity: low** (skeptics: low / low; reclassified from UX-TALLY-6 by the completeness critic). Nothing is written: the tap-time guard (`apps/tally.html:152`) and `hub.set`'s `read_only` throw (`apps/hub.js:234`) both hold, with 0 POSTs and no row. It is an edge case, because the shell never offers Tally to the kiosk.
- **Exposure.** Only when `apps/tally.html` is loaded directly on the TV, by a typed URL or a bookmark.
- **Related.** No Phase 2 ID covers app-level kiosk affordances. The Dollywood build guide uses the same show-then-nudge pattern (`audits/00-inventory.md:4203`).

**What happens now.** The shell does not open Tally for the kiosk. On boot a kiosk always goes to Home (`index.html:626`), and `showTab` rewrites the hash to `#home` (`index.html:642`) with no toast. `visibleApps()` is empty for it (`index.html:479`), so there is no tile, and a later `#tally` hash change would be refused by `openApp` with a toast (`index.html:715`; by code, not run). Standalone, the page shows 0 under "Downstairs TV's counter", with +, − and Reset enabled and styled as live (`disabled:false`, `aria-disabled` absent, opacity 1, `cursor:pointer`), and nothing says the screen is view-only. Tally checks `hub.canWrite` only inside the tap handler (`apps/tally.html:152`), so each tap gives only the kiosk toast.

**Expected.** `CLAUDE.md:55`: "Check `hub.canWrite` (false for the kiosk) before offering edits." Hide or `aria-disable` the controls and show the pill as view-only, as Verses and F260 do (`apps/verses.html:327-336`; `apps/f260.html:1573-1574`).

**Why it matters to the household.** On the 10-foot TV a family member sees tappable-looking buttons that answer only with a toast.

**Evidence.**
- Code: `apps/tally.html:137-140, 152`; `index.html:479, 626, 642, 715`; `CLAUDE.md:55`.
- Runs: `audits/evidence/p3/tally/audiences.json` (kiosk: `standaloneShows:"0"`, `posts:[]`), `audits/evidence/p3/tally/verify-critic-kiosk-offers-edit-controls-4-1.json`, `audits/evidence/p3/tally/verify-critic-kiosk-offers-edit-controls-4-2.json`.
- Screenshots: `audits/evidence/p3/tally/kiosk-standalone-tv.png`, `audits/evidence/p3/tally/verify-critic-kiosk-offers-edit-controls-4-2-tv-after-tap.png`.

**Reproduction.** `node "audits/tools/phase3/tally/audiences.mjs"` (kiosk section): as profile `tv` on the TV device, open `apps/tally.html`, read the buttons' state, tap + and record the toast and POSTs.

**Verified: 2/2 skeptics confirmed.**
- **Skeptic 1** ran `node "audits/tools/phase3/tally/verify-critic-kiosk-offers-edit-controls-4-1.mjs"` (typical seed, demo clock, WebKit, 1920×1080): the shell deep link stayed on `#home` with no Tally frame or tile. Standalone, `canWrite:false`; − 96×96, + 140×140 and Reset 180×44 were all enabled, opacity 1 and `cursor:pointer`; no view-only text. +, − and Reset each gave the toast and left the dial at 0; writes `[]`; the server had no row for `tv`.
- **Skeptic 2** ran `node "audits/tools/phase3/tally/verify-critic-kiosk-offers-edit-controls-4-2.mjs"`: the shell showed `{hash:'#home', tallyIframe:false, toast:null}`, so the bounce is silent. Standalone results matched skeptic 1, with posts `[]` and no server row.

**Corrected claim.** None needed. Skeptic 2 notes that CLAUDE.md's Preferences line ("before changing their own UI") is met, because `show()` runs only after a successful set; the step-2 rule ("before offering edits") is not. "ux" would also fit, but "bug" is defensible given `CLAUDE.md:55`.

### Usability, visual and gap findings

These were not adversarially verified. Items marked "from the visual check" were added by the independent visual checker.

**UX**

- **UX-TALLY-1 — Reset to zero wipes the count in one tap, with no confirm and no undo, and pre-readers are shown it** (medium).
  - **Why ux/medium, not a rule-(a) bug.** P3-PRAYER-04 is critical because one tap, with no confirm or undo, erases data behind a label ("Put back on the list") that hides the loss (`audits/03-apps/prayer.md:288`). P3-LEFTOVERS-13 is critical because a kid's tap removes household data for everyone (`audits/03-apps/leftovers.md:634`). Here the label, "Reset to zero", names the loss, and the counter is a single throwaway value in the tapper's own person scope. But a pre-reader's mis-tap on the adjacent button (Reset sits 24 px below +) is the exposure those two findings rated critical: a mistaken tap in Prayer, a pre-reader's tap in the Larder. A 4-5-year-old cannot read the label that names the loss. The difference is left for the roll-up to settle.
  - Reset calls `set(0)` at once (`apps/tally.html:155`). As Ezra the count went 13 → 0 with no dialog, no toast and no undo (`audiences.json` kid: `dialogs:[]`, `toast:null`).
  - No history is kept, so the old number is gone.
  - From the visual check: the kid Reset is a word-only button in the same bright glass as + (162×64 against the 168×168 +), 24 px below it. A 4-5-year-old sees three identical-material buttons and cannot tell which one wipes the count. The kid flow therefore fails the house rule that it be completable by icon, colour and position alone.
  - Evidence: `apps/tally.html:140, 155`; `audits/evidence/p3/tally/kid-after-reset-ipad-portrait.png`; `audits/screens/tally/kid-typical-iphone-pwa-light.png`; `audits/screens/tally/kid-typical-ipad-portrait-light.png`; `audits/evidence/p3/tally/layout.json`.
  - Run: `node "audits/tools/phase3/tally/audiences.mjs"`.
- **UX-TALLY-2 — While loading there is no skeleton or busy state, and taps first do nothing** (medium). The display half of this item, the 0 shown as the count, was reclassified as a bug by the completeness critic, confirmed 2/2 and is now **P3-TALLY-07**; this ID keeps the missing loading state and the dead taps.
  - Until `hub.ready` resolves, the markup shows 0 and an empty pill, and the buttons have no handlers (`apps/tally.html:130, 134, 145-157`). Three taps at 1.5-2.8 s left the count at 0 with an empty queue: someone counting during a slow load loses those taps without a sign.
  - At 6.1 s the pill filled in and the buttons went live with the count still 0. From then until the held pull landed, a tap overwrites the real count (P3-TALLY-02).
  - The GET was held 9 s, and the 10.5 s sample read 37 (`loading.json` afterPullLanded `ms: 10503`).
  - There is no skeleton, no disabled state and no `aria-busy`.
  - Evidence: `audits/evidence/p3/tally/loading.json`; `audits/evidence/p3/tally/loading-at-1500ms-iphone.png`; `audits/screens/tally/main-loading-ipad-portrait-light.png`.
  - Run: `node "audits/tools/phase3/tally/loading.mjs"`.
  - Corrected by the visual check: the investigator wrote "up to 6 s" and "about 9 s"; the 0 lasts until the pull lands, and the buttons are live from 6.1 s.
- **UX-TALLY-3 — Counting takes 3 taps from Home, and Home never shows the count** (medium).
  - Home → Apps → Tally tile → + is 3 taps for Eli on iPhone and Ezra on iPad. Home has no Tally card or button.
  - The entry is tile `small`, with no widget (`apps.json:7`).
  - It misses the brief's target of 2 taps or fewer for the most frequent job.
  - Evidence: `audits/evidence/p3/tally/audiences.json` (`tapsHomeToCounted: 3`); `audits/evidence/p3/tally/kid-apps-grid-ipad-portrait.png`.
- **UX-TALLY-4 — VoiceOver hears "Add one" but never the new count** (low). `#n` has no `aria-live` and no `role=status`. Reset has no `aria-label` and relies on its text. Evidence: `apps/tally.html:134-140`; `audiences.json` `kid.ui.liveRegion: false`.
- **UX-TALLY-5 — On a phone turned sideways, + is below the fold and the pill overlaps the dial** (low).
  - At 932×430 the frame is 382 px tall, but the dial stays 360 px (Eli) or 400 px (Ezra), because its size depends on width only (`apps/tally.html:40, 124`).
  - + starts at y 416 (Eli) or 456 (Ezra), so counting needs a scroll first.
  - The pill overlaps the top of the dial by 26 px.
  - Evidence: `audits/evidence/p3/tally/landscape-phone.json`; `audits/evidence/p3/tally/landscape-phone-eli.png`.
  - Run: `node "audits/tools/phase3/tally/landscape-phone.mjs"`.
- **UX-TALLY-6 — moved to P3-TALLY-09.** Opened directly on the TV, Tally shows "Downstairs TV's counter" with live-looking buttons (investigator info, raised to low by the visual check). Because it goes against `CLAUDE.md:55`, the completeness critic reclassified it as a bug; two skeptics confirmed it, and it is now **P3-TALLY-09** (low). The ID is kept so that earlier references resolve.

**Visual**

- **VIS-TALLY-1 — In every dark palette the dial and the +/− buttons barely stand out from the page** (medium).
  - The glass discs are near-black brown on a dark accent wash. The button fill measures:
    - − against the wash: 1.13-1.45:1 (Midnight, System-dark, Forest);
    - + against the wash: 1.17-1.62:1.

    The non-text target is 3:1.
  - The buttons are told apart only by their ring and shadow. The visual checker agreed the edge highlights still outline them.
  - The pastel never glows; the page reads as muddy navy and brown.
  - Evidence: `audits/evidence/p3/tally/themes.json`; `audits/evidence/p3/tally/theme-system-darkos-eli.png`; `audits/screens/tally/main-typical-ipad-portrait-dark.png`; `audits/screens/tally/kid-typical-ipad-portrait-dark.png`; `apps/tally.html:26-31`.
  - Run: `node "audits/tools/phase3/tally/themes.mjs"`.
- **VIS-TALLY-2 — In kid mode the name pill overlaps the top of the dial on iPad landscape and iPhone Safari** (low).
  - The kid dial is sized from the width only (`clamp(260px, 80vw, 400px)`, `apps/tally.html:124`), and the pill is fixed at the top (`:117`).
  - The overlap is 8 px on iPad landscape (dial y 42, pill bottom 50) and 20 px on iPhone Safari.
  - Reset has 42 px clear on iPad landscape and is not cut.
  - Evidence: `audits/evidence/p3/tally/layout.json`; `audits/evidence/p3/tally/layout-typical-ezra-ipad-landscape-light.png`; `audits/evidence/p3/tally/layout-typical-ezra-iphone-safari-light.png`; `audits/screens/tally/kid-typical-ipad-landscape-light.png`.
- **VIS-TALLY-3 — The count is in the serif display face, not ui-rounded, in adult and kid mode** (low).
  - `.count` uses `var(--font-display)` (`apps/tally.html:58`), which is `var(--font-serif)` (`apps/design.css:19-20`).
  - The computed family is `ui-serif`: 162 px on iPad and 111.8 px on iPhone.
  - Evidence: `audits/evidence/p3/tally/layout.json`; `audits/screens/tally/main-typical-iphone-pwa-light.png`; `audits/screens/tally/kid-typical-iphone-pwa-light.png`.
- **VIS-TALLY-4 — The − disc is lighter glass than +, so it reads as secondary or disabled** (low).
  - − uses `--glass` and + uses `--glass-strong` (`apps/tally.html:69, 84`).
  - In light palettes, − against the wash is 2.24-3.48:1, and + against the wash is 2.76-4.64:1. From the visual check: the − fill against the + fill is 1.27-1.30:1 for every profile.
  - The − glyph itself passes AA at 7.1-10.1:1. The disc is also smaller (96 px against 140 px).
  - Evidence: `audits/evidence/p3/tally/themes.json`; `audits/screens/tally/main-typical-ipad-portrait-light.png`; `audits/screens/tally/kid-typical-iphone-pwa-light.png`.
- **VIS-TALLY-5 — In light mode several control discs fall under 3:1 against the wash** (low; from the visual check).
  - The − disc is 2.24-2.85:1 for Mae, Mom, Mea, Ezra and Kiara in System light, and 2.24-2.33 for Kiara across Parchment, System and Frost.
  - Kiara's + disc is 2.76-2.86:1.
  - The glyphs stay above 7:1, so the controls still read, but the button shapes fade into the wash for the lighter family colours.
  - Evidence: `audits/evidence/p3/tally/themes.json`; `audits/screens/tally/kid-typical-ipad-portrait-light.png`.
- **VIS-TALLY-6 — Large counts are not grouped** (low).
  - `textContent = v` (`apps/tally.html:151`) shows "1284750" and "250000".
  - The font shrinks to 69 px on iPad (61 px on iPhone) and then reads only to about 1.8 m.
  - Evidence: `audits/screens/tally/main-overflow-iphone-pwa-dark.png`; `audits/screens/tally/main-overflow-ipad-portrait-light.png`; `audits/screens/tally/kid-overflow-ipad-portrait-light.png`; `audits/evidence/p3/tally/glance.json`.
- **VIS-TALLY-7 — The press states may never show on iPhone or iPad** (low; needs a device).
  - The only tap feedback is the `:active` scale of .94 and .96 (`apps/tally.html:82, 108`). iOS Safari applies `:active` to a tap only when the page has a `touchstart` listener, and `grep -n "touchstart\|pointerdown" apps/tally.html apps/hub.js` finds none.
  - The count also changes with no transition, and there are no haptics.
  - From the visual check: the .94 press scale is deeper than the house's ~0.97.
  - Evidence: `apps/tally.html:80-82, 106-108`; manual check listed at `audits/01-capture.md:158`.
- **VIS-TALLY-8 — Whose counter it is shows only as the wash hue and a 12 px caps pill, with no avatar** (low).
  - The pill is "ELI'S COUNTER": 12 px, weight 700, uppercase (`.kicker`, `apps/design.css:333`).
  - It is not scaled in kid mode, because `--fs-xs` is not in the kid token set (`apps/design.css:280-283`).
  - Its ink is 1.7 mm on the iPad, legible to about 0.35 m.
  - `hub.avatarHtml` exists (`apps/hub.js:459-462`) but is not used.
  - Evidence: `apps/tally.html:130, 149`; `audits/evidence/p3/tally/glance.json`; `audits/screens/tally/main-typical-ipad-portrait-light.png`.
- **VIS-TALLY-9 — Glass is on the content dial as well as the controls: five backdrop-filter layers** (low).
  - `.dial`, both `.tbtn` buttons, `.who` and `.btn.reset` each carry `backdrop-filter: blur(var(--blur)) saturate(1.4)` (`apps/tally.html:51, 79, 104`). There is nothing to blur behind the dial except the gradient wash.
  - The recipe is hand-copied three times (`apps/tally.html:45-51, 73-79, 98-104`) instead of using `.glass-strong` / `.btn-glass` (`apps/design.css:388-403`).
  - Evidence: `audits/screens/tally/main-typical-iphone-pwa-light.png`.
- **VIS-TALLY-10 — The dial's tick ring shows in some themes only** (low; from the visual check).
  - The dashed ring (`apps/tally.html:54`) is nearly invisible on the white dial in light Hearth and Frost, and clearly drawn in dark and in Parchment.
  - Evidence: `audits/screens/tally/main-typical-iphone-pwa-light.png`; `audits/evidence/p3/tally/theme-parchment-lightos-eli.png`; `audits/screens/tally/main-typical-ipad-portrait-dark.png`.
- **VIS-TALLY-11 — The chosen theme barely reaches Tally** (info; from the visual check).
  - The wash is always the person's colour, so Forest (deep green, gold ink) renders almost exactly like Midnight: a navy wash, cream ink and a slight green-grey tint on the discs.
  - Evidence: `audits/evidence/p3/tally/theme-forest-lightos-eli.png`; `audits/evidence/p3/tally/theme-midnight-lightos-eli.png`.

**Gap**

- **GAP-TALLY-1 — One counter per person, with no history, step size or feedback sound** (low).
  - There is a single `count` key (`apps/tally.html:150`), and no record of past counts or resets.
  - `navigator.vibrate`, history and `item:` rows: NOT FOUND IN CODE.
  - Dedicated counter apps offer multiple named counters, history and per-tap feedback, and Stopwatch keeps a lap list.
  - Evidence: `apps/tally.html:150-155`; `audits/evidence/p3/_compliance/tally.json`.

**What works**

- **OK-TALLY-1 — Rapid taps are exact** (info).
  - Tally reads the store at tap time and `hub.set` updates it synchronously (`apps/tally.html:150-153`; `apps/hub.js:231-243`). Results:
    - 100 mouse clicks (4.7 ms per tap): +100.
    - 100 touch taps (3.6 ms per tap): +100.
    - 100 `el.click()` calls in one task: +100.

    Each burst went out as 1 batch POST.
  - `visualViewport.scale` stayed 1, and `touch-action: manipulation` is set (`apps/design.css:302-303, 312`).
  - Tally keeps no copy of its own, so it avoids P2-SYNC-18's stale write-back on one device.
  - Evidence: `audits/evidence/p3/tally/rapid.json`; run `node "audits/tools/phase3/tally/rapid.mjs"`.
  - **Also exact on a slow link** (added from the completeness critic; confirmed 2/2 as a positive, not a bug). 60 taps with every tally POST and GET delayed 700 ms and three pulls forced mid-burst ended at 97/97, with an empty queue, in WebKit (35 POSTs) and Chromium (4 POSTs) (`audits/evidence/p3/tally/critic-rapid-slow.json`; `node "audits/tools/phase3/tally/critic-rapid-slow.mjs"`).
    - Skeptic 1 (`audits/tools/phase3/tally/verify-critic-rapid-taps-slow-link-exact-6-1.mjs`): five runs, fixed 700 ms and jittered 200-1400 ms delays, all 97/97 with the queue `{}` and every posted value non-decreasing. Playwright's WebKit `click()` takes about 0.5 s per tap on this rig, which explains the 35 POSTs; tapped with in-page `el.click()` at about 110 ms, WebKit sent 4 POSTs, like Chromium.
    - Skeptic 2 (`audits/tools/phase3/tally/verify-critic-rapid-taps-slow-link-exact-6-2.mjs`): 50 taps with the delay on the request or on the reply (so the mid-burst pulls saw a newer server value while a POST was in flight) ended at 87 on the phone, the server and a second device, in WebKit and Chromium.
    - What keeps in-flight taps: the stamp bump and queue write in `hub.set` (`apps/hub.js:236-239`), the snapshot and compare-before-delete in `flush()` (`apps/hub.js:259, 274, 276`) and the pull guards (`apps/hub.js:295-296`). This covers one device only; two devices still lose taps (P3-TALLY-01).
    - Evidence: `audits/evidence/p3/tally/verify-critic-rapid-taps-slow-link-exact-6-1.json`, `audits/evidence/p3/tally/verify-critic-rapid-taps-slow-link-exact-6-2.json`.
- **OK-TALLY-2 — All text passes AA in every palette for all seven family colours, and every target is large** (info).
  - Contrast: the worst of 49 palette × profile cases is the − glyph at 6.93:1 (Parchment, Dad). The count, pill and Reset are 9.04-13.3:1.
  - Targets: adults get + 140 px, − 96 px and Reset 145×44; kids get + 168 px, − 116 px and Reset 162×64.
  - + sits in the thumb zone, and the count ink is 21.5 mm on the iPad.
  - Evidence: `audits/evidence/p3/tally/themes.json`; `audits/evidence/p3/tally/layout.json`; `audits/evidence/p3/tally/glance.json`.
- **OK-TALLY-3 — Kiosk read-only works, guests get their own counter, and the platform is clean** (info).
  - The TV's + only shows a toast (0 POSTs). Its controls still look live, which is filed as P3-TALLY-09.
  - Guest Grandma Jo counted 0 → 1 in her own person scope. A guest who opens Tally first on a device with legacy data takes that data, which is filed as P3-TALLY-06.
  - There are no localStorage, fetch or dialog bypasses and no hardcoded colours.
  - Dark mode keys off `[data-scheme="dark"]` only (`apps/tally.html:26`).
  - `--accent` reaches the page: 7 distinct accents in `themes.json`.
  - Evidence: `audits/evidence/p3/tally/audiences.json`; `audits/evidence/p3/_compliance/tally.json`.

### Checked and not a bug

No bug, security or perf finding was refuted: the investigator's four and the completeness critic's six candidates were all confirmed 2/2.

- **Rapid taps on a slow link.** The critic filed this as a candidate bug to test the overlapping case (taps while flushes and pulls are in flight). Both skeptics confirmed the outcome and said its kind is positive: 60 taps at 700 ms per request with forced pulls, and 50 taps with the reply delayed, all ended exact. It is recorded under OK-TALLY-1, not as a defect (`audits/evidence/p3/tally/verify-critic-rapid-taps-slow-link-exact-6-1.json`, `audits/evidence/p3/tally/verify-critic-rapid-taps-slow-link-exact-6-2.json`).

### Unresolved — needs a device or more evidence

No verified finding is unresolved. Two unverified items depend on a device:
- **VIS-TALLY-7 (press state on iOS).** To settle it, tap + and − on a real iPhone and iPad, both in the Home Screen app and inside the hub viewer, and watch for the scale-down (`audits/01-capture.md:158`).
- **P3-TALLY-05, slow-link arm.** The rig's delay is a Playwright route inside the browser, so it cannot show whether a real iOS WebView aborts an in-flight POST when the frame goes to `about:blank`. The finding stands on its offline arm. To settle the slow-link arm, tap + 3 times on a throttled real iPhone, tap Hub at once, and compare the server with the shown count after 35 s.

## 5. Visual fidelity

### Rubric scores

| Dimension | Investigator | Checker | Final | Provisional? | Reason | Evidence |
|---|---|---|---|---|---|---|
| Typography | 5 | 5 | **5** | Yes (fallback fonts in the rig) | The count is a serif (ui-serif / New York), not ui-rounded, in kid mode too. The pill is 12 px bold caps and not scaled for kids. Adult Reset is 16 px, kid Reset 19 px (checker's correction). Tight tracking (-3.24 px) and weight carry the hierarchy. | `audits/screens/tally/main-typical-iphone-pwa-light.png`, `audits/screens/tally/kid-typical-iphone-pwa-light.png`, `audits/evidence/p3/tally/theme-system-lightos-eli.png` |
| Color & palette | 5 | 5 | **5** | No | One deep hue (slate, teal) with grey-white discs: no pastel fill/ink pairs, and Reset has no destructive colour. Text contrast is excellent (6.9-13.3:1), but several light-mode disc edges are under 3:1 (VIS-TALLY-5). | `audits/screens/tally/main-typical-ipad-portrait-light.png`, `audits/screens/tally/kid-typical-ipad-portrait-light.png`, `audits/evidence/p3/tally/theme-parchment-lightos-eli.png` |
| Layout & spacing | 6 | 6 | **6** | No | A calm centred stack with no scroll on any matrix device. The kid pill overlaps the dial on iPad landscape and iPhone Safari. The iPad height is unused: the dial is capped at 360 px, leaving about 19% empty above and 23% below (checker's correction of "lower third"). | `audits/evidence/p3/tally/layout-typical-ezra-ipad-landscape-light.png`, `audits/evidence/p3/tally/layout-typical-ezra-iphone-safari-light.png`, `audits/screens/tally/main-typical-ipad-portrait-light.png` |
| Shape, depth & material | 6 | 5 | **5** | Yes (real blur not visible in the rig) | True circles and pills. But the content dial is the same glass as the controls, the − disc looks disabled, the tick ring shows only in some themes, and the dark discs are muddy pucks rather than glass. | `audits/screens/tally/main-typical-iphone-pwa-light.png`, `audits/screens/tally/main-typical-ipad-portrait-dark.png`, `audits/evidence/p3/tally/theme-system-darkos-eli.png` |
| Iconography | 4 | 4 | **4** | No | + and − are typed glyphs (the − thin, at weight 300), Reset is a word, and no icon set is used inside the app. The Apps-tile ⊕ is clear. | `audits/screens/tally/main-typical-iphone-pwa-light.png`, `audits/screens/tally/kid-typical-iphone-pwa-light.png`, `audits/evidence/p3/tally/kid-apps-grid-ipad-portrait.png` |
| Motion & feedback | 4 | 4 | **4** | Yes (motion not visible in stills) | The only feedback is an `:active` scale of .94, which may not fire on iOS. There is no number transition, haptic or sound, no feedback for − at 0, and no undo toast after Reset. | `audits/screens/tally/main-typical-iphone-pwa-light.png`, `audits/evidence/p3/tally/kid-after-reset-ipad-portrait.png` |
| Dark mode | 4 | 4 | **4** | No | Complete, and keyed off `data-scheme`. But the brown-black discs sit 1.13-1.62:1 from a navy or teal wash, the pastel never glows, Forest looks like Midnight, and Hearth on a dark OS gives a hybrid look. | `audits/evidence/p3/tally/theme-system-darkos-eli.png`, `audits/screens/tally/kid-typical-ipad-portrait-dark.png`, `audits/evidence/p3/tally/theme-hearth-darkos-eli.png` |
| Native feel | 6 | 5 | **5** | Yes (iOS press state needs a device) | No tap highlight, selection, dialogs or scrollbars. But a cold load shows an empty pill and a fake 0 until the pull lands (the 10.5 s sample), with live buttons from 6.1 s (P3-TALLY-07), and the TV shows live-looking controls (P3-TALLY-09). | `audits/evidence/p3/tally/loading-at-1500ms-iphone.png`, `audits/screens/tally/main-loading-ipad-portrait-light.png`, `audits/evidence/p3/tally/kiosk-standalone-tv.png` |
| Glanceability | 7 | 7 | **7** | No | A 2-digit count is huge, high-contrast ink in every theme, legible to about 4.3 m. A 7-digit count shrinks to a third and is ungrouped, and the owner's name is 1.7 mm. | `audits/screens/tally/main-typical-ipad-portrait-light.png`, `audits/screens/tally/main-overflow-ipad-portrait-light.png`, `audits/screens/tally/kid-typical-ipad-landscape-light.png` |
| Ease of use | 5 | 5 | **5** | No | A big thumb-zone +, and + and − work by symbol. But counting takes 3 taps from Home, and the one-tap, word-only Reset sits in the same glass right under +. Taps are lost or misapplied while loading, and counts silently drop across devices or stay unsent after closing (P3-TALLY-05). | `audits/evidence/p3/tally/kid-apps-grid-ipad-portrait.png`, `audits/screens/tally/kid-typical-iphone-pwa-light.png`, `audits/evidence/p3/tally/kid-after-reset-ipad-portrait.png` |
| Delight | 4 | 4 | **4** | No | The accent wash and the dial are calm and pleasant, but nothing responds when you count: no roll, no bump, no sound, no milestone. | `audits/screens/tally/main-typical-ipad-landscape-light.png`, `audits/screens/tally/kid-typical-desktop-light.png`, `audits/screens/_sheets/tally--main.jpg` |

Average: (5 + 5 + 6 + 5 + 4 + 4 + 4 + 5 + 7 + 5 + 4) / 11 = 54 / 11 = **4.9**. The investigator's average was 5.1; the shell's in Phase 2 was 4.9.

**How the scores were checked.**
- **What the checker opened:** 42 screenshots. That is all 20 the investigator cited, 18 more from `audits/screens/tally/`, both contact sheets and 4 further investigator evidence PNGs, covering every device, light and dark, and the empty, typical, overflow, loading, offline, kid and kiosk states. Phase 1 has no error-state capture for Tally.
- **Agreed:** 9 of 11 dimensions.
- **Adjusted by one point:** 2 dimensions.
  - **Shape, depth & material, 6 → 5:** glass on the content dial, a − disc that looks disabled, a tick ring that shows only in some themes, and muddy dark discs. This is in line with the shell's 5 for the same fault.
  - **Native feel, 6 → 5:** an empty pill and a fake 0 until the pull lands, and live-looking controls on the TV. This is level with the shell.
- **Judge:** ruled on 0 dimensions; no gap reached 2 points.
- **Claims the checker corrected:**
  - The kid Reset is 19 px, not 16.
  - The iPad's empty space is split top and bottom, not "the lower third".
  - The kid Reset is as bright as +, not as large.
  - The loading 0 lasts until the pull lands, not 6 s.

### Deviations from the house style

Each is marked with the visual checker's verdict.

| Area | Deviation | Checker | Evidence |
|---|---|---|---|
| Typography: numerals | The count uses the serif display face (`--font-display` = `--font-serif`) instead of ui-rounded, in adult and kid mode | Supported | `apps/tally.html:58`; `apps/design.css:19-20`; `audits/evidence/p3/tally/layout.json` |
| Typography: font stack | `--font-sans` starts with ui-rounded for everyone, while the house style keeps rounded for numerals and kid mode. Tally inherits it for the pill and Reset. The stack belongs to design.css (Phase 4). | Supported | `apps/design.css:18` |
| Typography: type scale | Pill 12 px bold caps, not scaled for kids. Reset 16 px (kid 19 px) where button text would be 17. + glyph 48 px at weight 400; − glyph 36 px at weight 300 (thin). Count 162 px on iPad, 111.8 px on iPhone. | Supported (kid Reset corrected to 19 px) | `apps/tally.html:72, 84`; `apps/design.css:22-23, 280-283, 333`; `audits/evidence/p3/tally/glance.json` |
| Colour: pastel pairs | No pastel fill/ink pairs. The wash is 74-84% of the saturated profile colour (for example slate #4F5D8C), with grey-white discs and dark ink. | Supported | `apps/tally.html:14-19`; `audits/screens/tally/main-typical-ipad-portrait-light.png` |
| Colour: semantic | Reset, a destructive action, looks like the neutral controls: same glass, no destructive colour, no icon | Supported | `apps/tally.html:95-111, 140`; `audits/screens/tally/kid-typical-iphone-pwa-light.png` |
| Colour: dark mode | Near-black brown discs, 1.13-1.62:1 against the wash; the pastel does not glow | Supported | `audits/evidence/p3/tally/themes.json`; `audits/evidence/p3/tally/theme-system-darkos-eli.png` |
| Colour: light-mode disc edges (from the checker) | The − disc is under 3:1 against the wash for five of seven profiles, and Kiara's + disc too | Checker's addition | `audits/evidence/p3/tally/themes.json` |
| Profile accent without hue | The owner is shown by the wash hue plus a 12 px text pill only; no avatar, emoji or initial | Supported | `apps/tally.html:130, 149`; `apps/hub.js:459-462` |
| Material | Glass on the content dial as well as the controls (five backdrop layers), and the recipe hand-copied three times | Supported | `apps/tally.html:38-52, 68-81, 95-105`; `apps/design.css:388-403` |
| Material: tick ring (from the checker) | The dial's dashed ring is nearly invisible in light Hearth and Frost | Checker's addition | `apps/tally.html:54`; `audits/screens/tally/main-typical-iphone-pwa-light.png` |
| Radii | None: every shape is a circle or pill (`var(--r-full)`) | Supported | `apps/tally.html:43, 54, 70, 106, 118` |
| Spacing rhythm | Off the rhythm: `inset: 10px`, the shadow `0 30px 70px -30px`, and a 3 px outline with a 3 px offset | Supported | `apps/tally.html:50, 54, 83` |
| Layout: kid | The kid pill overlaps the dial by 8 px (iPad landscape), 20 px (iPhone Safari) and 26 px on a sideways phone, where + is also below the fold. The dial size ignores height. | Supported | `audits/evidence/p3/tally/layout.json`; `audits/evidence/p3/tally/landscape-phone.json` |
| Tap targets | None below 44 pt. The kid Reset is as bright as + (not as large: 162×64 against 168×168), 24 px below it. | Partly: corrected as stated | `audits/evidence/p3/tally/layout.json` |
| Iconography | + and − are typed characters; Reset is text only | Supported | `apps/tally.html:137-140` |
| Motion | No numeric transition, no haptics, `:active`-only press state. Durations are 220 ms, within the house range. The press scale of .94 is deeper than the house's ~0.97 (checker). | Supported, with the .94 addition | `apps/tally.html:61, 80-82, 107-108`; `apps/design.css:109` |
| Feedback and undo | The destructive Reset has no undo or confirm; − at 0 gives no feedback | Supported | `apps/tally.html:152-155`; `audits/evidence/p3/tally/rapid.json` |
| Loading | No skeleton or disabled state. A placeholder 0 and an empty pill show until the pull lands (P3-TALLY-07); taps before 6.1 s are dropped, and taps after it are written against the 0. | Partly: corrected as stated | `audits/evidence/p3/tally/loading.json`; `audits/screens/tally/main-loading-ipad-portrait-light.png` |

### Web tells

| Tell | Status | Evidence |
|---|---|---|
| Grey tap highlight | Absent | `-webkit-tap-highlight-color: transparent` on body and buttons (`apps/design.css:302, 312`) |
| Long-press callout or selection on chrome | Absent | `user-select: none` on body and art (`apps/tally.html:22, 36`); no links. `-webkit-touch-callout`: NOT FOUND IN CODE |
| Default form controls | Absent | All three buttons are restyled (`apps/tally.html:68-111`); there are no inputs |
| Focus rings on touch | Absent | `:focus-visible` only (`apps/tally.html:83`; `apps/design.css:314-315`) |
| Blue underlined links | n/a | There are no links in the file |
| White flash on load | Absent | Phase 2 web-tells check with Tally in the viewer (`audits/evidence/p2/VIS/flash-webkit-viewer-tally-dark.png`); body background is `var(--bg)` (`apps/tally.html:17`) |
| Rubber-band overscroll mismatch | Needs a device | `overscroll-behavior: none` (`apps/design.css:304`) and `background-attachment: fixed` (`apps/tally.html:20`); iOS inside an iframe cannot be tested in the rig |
| Tap delays | Absent | `touch-action: manipulation`; 100 touch taps registered 100 (`audits/evidence/p3/tally/rapid.json`) |
| Visible scrollbars on chrome | Absent | `scrollHeight` equals the frame height on every matrix device (`audits/evidence/p3/tally/layout.json`); a sideways phone scrolls (`audits/evidence/p3/tally/landscape-phone.json`) |
| Layout shift as data loads | Partly | No box moves, but the content swaps from 0 to 37 once the held pull lands (`audits/evidence/p3/tally/loading.json`) |
| Spinners vs skeletons | Partly | Neither: a placeholder 0 poses as real data (P3-TALLY-07; `audits/screens/tally/main-loading-ipad-portrait-light.png`) |
| `alert()` / `confirm()` / `prompt()` | Absent | `audits/evidence/p3/_compliance/tally.json` (bypass lists empty); no dialog on Reset (`audiences.json` kid `dialogs: []`) |

## 6. Platform compliance

**Data through hub.js.**
- **Calls used:** `hub.ready` (`apps/tally.html:145`), `hub.migrate` (`:147`), `hub.profile.name` (`:149`), `hub.get` (`:150`), `hub.canWrite` / `hub.kioskNudge` / `hub.set` (`:152`) and `hub.onChange` (`:156`).
- **Not used:** `hub.activity` (no feed lines, by design) and `hub.onSync` (no sync status).
- **Bypasses: 0.** localStorage, sessionStorage, IndexedDB, fetch, XHR, external URLs and native dialogs: NOT FOUND IN CODE (`audits/evidence/p3/_compliance/tally.json`).
- **Where hub.js and the shell fail Tally:** hub.js's data-safety gaps are the root of P3-TALLY-01 to -03 and -07 (`apps/hub.js:224, 231-243, 334-337, 406-407`); its adult-only migration check lets guests through (P3-TALLY-06, `apps/hub.js:400`); and the shell never flushes the tally channel it does not declare (P3-TALLY-05, `index.html:457-458`).

**design.css tokens.** The `compliance.mjs` hits were reviewed by hand; the corrected counts:

| Category | Raw hits | Corrected | Notes |
|---|---|---|---|
| Hardcoded colours | 0 hex, 0 rgb/hsl, 0 named; 11 `colorDerived` | **0** | The 11 are `color-mix()` of tokens (`apps/tally.html:14-16, 27-29, 45, 73, 86, 98, 113`) |
| Font families | 2 | **0** | `var(--font-display)` (`apps/tally.html:58`) and `font: inherit` (`:72`) are a token and an inherit; the face itself is VIS-TALLY-3 |
| Font sizes | 1 | **1** | `clamp(96px, 26vw, 168px)` inside `min()` (`apps/tally.html:60`); the buttons use `--fs-3xl` / `--fs-4xl` |
| Radii | 0 | **0** | All `var(--r-full)`, plus `inherit` at `apps/tally.html:54` |
| Spacing | 2 | **1** | `inset: 10px` (`apps/tally.html:54`); the hit at `:106` is a false positive (`padding: 0 var(--sp-6)`) |
| Shadows | 6 | **6 declarations with literal offsets** | All use token colours; one (`apps/tally.html:50`) adds the bespoke `0 30px 70px -30px var(--accent-glow)` |
| Durations | 0 | **0** | All `var(--dur-2)` |
| z-index | 5 | **5 raw values** | `apps/tally.html:35, 42, 64, 106, 117` |
| Fixed dimensions (not counted by the script) | n/a | **7 declarations** | `apps/tally.html:36, 40, 70, 84, 122, 123, 124`, plus the 3 px outline and offset at `:83` |
| Undefined tokens | 0 | **0** | 16 local custom properties are defined in the file |
| Inline styles / JS style writes | 0 / 0 | **0 colour writes** | One JS custom-property write the script does not count, `--digits` (`apps/tally.html:151`), which only sizes the count |
| Duplicated recipe | n/a | **3 copies** | The glass recipe at `apps/tally.html:45-51, 73-79, 98-104` duplicates `.glass-strong` / `.btn-glass` (`apps/design.css:388-403`) |

**Per-profile accent.** `--accent` reaches the app through hub.js. `themes.json` shows 7 distinct accents (#4F5D8C Eli, #BC5A38 Mae, #8A6A4B Mom, #3D5A3D Dad, #5B8143 Mea, #137F77 Ezra, #B4861B Kiara), and each changes the wash and the glass pickup. The accent is the only identity cue besides the 12 px pill (VIS-TALLY-8).

**Dark mode.**
- Keyed off `:root[data-scheme="dark"]` only (`apps/tally.html:26`); `prefers-color-scheme`: 0 uses.
- Measured in all five palettes, plus System and Hearth on a dark OS: all text is at least 6.93:1, but the controls are only 1.13-1.62:1 from the wash in the dark palettes (VIS-TALLY-1).
- Hearth on a dark OS paints a hybrid (P2-VIS-03).
- `prefers-reduced-motion` is honoured (`apps/tally.html:126`). `prefers-reduced-transparency` and `prefers-contrast`: NOT FOUND IN CODE.

## 7. Improvements

Ratio = delight ÷ effort, with S = 1, M = 2, L = 3. None of these adds a routine or reward system, and all keep to the CLAUDE.md "Do not touch" list (Tally is not on it).

**Polish**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Undo toast after Reset (and after −): "Reset from 37. Undo" for 5 s, keeping the last value in the row (for example `{count, prev}`) so undo also works from another device | 5 | S | 5.0 | UX-TALLY-1; `audiences.json` kid 13 → 0 |
| 2 | Disable + and − and show a skeleton dial until the data has arrived (a successful pull or a warm cache); never paint a placeholder 0 | 4 | S | 4.0 | UX-TALLY-2; P3-TALLY-02; P3-TALLY-07; `first-load.json` 37 → 1 |
| 3 | Rounded numerals (a `--font-rounded` token), `toLocaleString` grouping, and a 200-300 ms roll or bump on change that respects reduced motion | 4 | S | 4.0 | VIS-TALLY-3, VIS-TALLY-6 |
| 4 | Kid-safe Reset: a ↺ icon, smaller, placed away from + (for example top right, beside the pill), relying on the undo toast rather than a confirm | 4 | S | 4.0 | UX-TALLY-1; `layout.json` gap 24 px |
| 5 | Send Tally's queued taps even when Tally is closed: the shell declares `hub.use('tally', 'person')`, or flushes every `hub.queue.*.<pid>` of the signed-in person on `online` and `closeViewer`; the frame also flushes on `pagehide` with `fetch(..., {keepalive: true})`. This touches hub.js and index.html, not Tally, so it is shared with Phase 2 (P2-PROF-02). | 4 | S | 4.0 | P3-TALLY-05; `critic-stranded.json`, `critic-stranded-online.json` |
| 6 | Discs that reach 3:1 against the wash in every palette: tint them with the accent in dark mode, and strengthen the − disc in light | 3 | S | 3.0 | VIS-TALLY-1, VIS-TALLY-4, VIS-TALLY-5 |
| 7 | Press feedback that works on iOS: a passive `touchstart` listener, or a `.pressed` class on `pointerdown`, with a ~0.97 scale; an optional short WebAudio tick | 3 | S | 3.0 | VIS-TALLY-7 |
| 8 | Height-aware dial (`min(vw, vh)`) and a larger, kid-scaled pill carrying `hub.avatarHtml` | 2 | S | 2.0 | VIS-TALLY-2, VIS-TALLY-8, UX-TALLY-5 |
| 9 | An in-app sync dot from `hub.onSync`, and `aria-live="polite"` on the count | 2 | S | 2.0 | UX-TALLY-4; the P2 Sync UX pointer |
| 10 | Disable − at zero, and every control on the kiosk (`aria-disabled` plus a view-only pill when `!hub.canWrite`); send no write when the value does not change; round and clamp the count on read (a finite, non-negative integer) | 2 | S | 2.0 | P3-TALLY-04, P3-TALLY-08, P3-TALLY-09 |
| 11 | `hub.migrate` skips guests (`hub.session.profile.is_guest`) and leaves the migrated mark unset for them. This is a hub.js fix shared by every `hub.migrate` caller. | 1 | S | 1.0 | P3-TALLY-06 |

**Missing features**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Count with deltas so devices add up: the Worker applies +1/−1 to the stored value, or each device keeps its own row (`count:<deviceId>`) and the page shows the sum. This also turns P3-TALLY-05's loss into a delay, but does not send the stranded taps sooner (polish 5 does). | 5 | M | 2.5 | P3-TALLY-01; `two-devices.json` (5, 12 and 4 lost) |
| 2 | A Home or wide-tile widget with the count and a + button (`apps.json` tile `wide` plus `widgetHtml` in index.html), bringing counting to 1-2 taps and showing the kids' counts on the iPad | 4 | M | 2.0 | UX-TALLY-3; `apps.json:7` |
| 3 | Several named general-purpose counters per person (`item:<id>` rows `{name, count, lastReset}`) with a short list of recent resets: counters only, not a routine or reward system | 3 | M | 1.5 | GAP-TALLY-1 |

**New ideas**

| Rank | Improvement | Delight | Effort | Ratio | Evidence |
|---|---|---|---|---|---|
| 1 | Across-the-room mode on the iPad: when idle, hide Reset and enlarge the count (for example a kids' game score on the Kitchen iPad) | 3 | M | 1.5 | `glance.json`: 4.3 m for 2 digits, 1.8 m for 7 |

## App-specific checks

| Check (from the brief, plus the investigator's) | Result | Evidence |
|---|---|---|
| Large targets (every control, every device, kid sizes) | **PASS.** Adult: + 140 px, − 96 px, Reset 145×44. Kid: + 168 px, − 116 px, Reset 162×64, on all five devices. The kid Reset is as bright as + and 24 px below it (UX-TALLY-1). | `audits/evidence/p3/tally/layout.json`; `audits/tools/phase3/tally/layout.mjs` |
| Undo after a mistaken +, − or Reset | **FAIL.** NOT FOUND IN CODE. Reset writes 0 at once, with no confirm, toast or history. | `apps/tally.html:152-155`; `audits/evidence/p3/tally/audiences.json` |
| Rapid repeated taps (100 mouse, 100 touch; 60 on a slow link) | **PASS.** Display and server exactly +100 each time, in 1 batch POST; `visualViewport.scale` 1. On a slow link (every request delayed 700 ms, three pulls forced mid-burst), 60 taps ended at 97/97 in WebKit and Chromium (OK-TALLY-1). Real iOS double-tap zoom needs a device. | `audits/evidence/p3/tally/rapid.json`; `audits/evidence/p3/tally/critic-rapid-slow.json` |
| Two devices of the same person on the same counter | **FAIL (critical, P3-TALLY-01).** A lost 5, B lost 12, C (offline) lost 4. | `audits/evidence/p3/tally/two-devices.json` |
| Offline taps, then reconnect | **FAIL (critical, P3-TALLY-05).** Taps sync on reconnect only while Tally is still open (two-devices C: the phone's 41 reached the server). Closed before reconnecting, they stay unsent and the shell reads synced; if the same person then counts on another device, they are lost (S: 37 + 4 + 2 → 39; control S0, Tally left open → 43). With a second device the earlier-stamped taps are lost either way (P3-TALLY-01), and neither device shows an offline or unsent mark. | `audits/evidence/p3/tally/critic-stranded.json`; `audits/evidence/p3/tally/critic-stranded-online.json`; `audits/evidence/p3/tally/two-devices.json`; `audits/screens/tally/main-offline-iphone-pwa-light.png` |
| Reset protection | **FAIL.** One tap, no confirm, no undo, and shown to pre-readers (UX-TALLY-1). | `audits/evidence/p3/tally/audiences.json` |
| Kid and pre-reader use | **PARTLY.** + and − work by symbol and position. Reset and the pill are text only, and one accidental Reset loses the count. The kid pill overlaps the dial on iPad landscape and iPhone Safari. | `audits/screens/tally/kid-typical-iphone-pwa-light.png`; `audits/evidence/p3/tally/layout-typical-ezra-ipad-landscape-light.png` |
| Kiosk read-only | **PASS** for writes, with P3-TALLY-09 (live-looking controls). The shell does not open `#tally` for the kiosk: on boot a kiosk always goes to Home (`index.html:626`), which rewrites the hash to `#home` (`index.html:642`); `visibleApps()` is empty for it (`index.html:479`), so a later `#tally` would be refused by `openApp` (`index.html:715`). Standalone, a tap gives a toast, 0 POSTs and no row. | `audits/evidence/p3/tally/audiences.json`; `audits/evidence/p3/tally/kiosk-standalone-tv.png` |
| Guest | **PARTLY.** Grandma Jo gets her own person-scope counter (0 → 1). But a guest who opens Tally first on a device with legacy `tally.count` receives that count, and the next household adult does not (P3-TALLY-06). | `audits/evidence/p3/tally/audiences.json`; `audits/evidence/p3/tally/critic-guest-migrate.json` |
| Chat writes to the count | **FAIL (low, P3-TALLY-08).** `set_data` stores any value (P2-CHAT-01), and Tally shows it as-is: -13, 12.5, 1e+21; + on -13 writes 0. | `audits/evidence/p3/tally/critic-chat-values.json` |
| Date and time (midnight, DST on 2026-11-01, another time zone) | **N/A.** No Date, timer or locale code in the file (NOT FOUND IN CODE). | `apps/tally.html:143-159` |
| First open on a new device | **FAIL (critical).** A slow or failed first pull shows 0 as the count (P3-TALLY-07), and one tap writes 1 over 37 (P3-TALLY-02). With legacy data, 37 becomes 5 with no tap (P3-TALLY-03, pointer to P2-SYNC-03), or the data goes to a guest who opens Tally first (P3-TALLY-06). | `audits/evidence/p3/tally/first-load.json` |

## Leads from 01-leads.md

| Lead | Outcome | Where it went |
|---|---|---|
| A tap during a slow first load can overwrite the saved count (`audits/01-leads.md:212`) | Confirmed and widened: 37 → 1 with the GET held 9 s; a 503 or network error opens the window at once; legacy migrate overwrites 37 with 5 with no tap | P3-TALLY-02, P3-TALLY-03 |
| Kids can wipe Tally's count with one tap (`:222`) | Confirmed: Ezra 13 → 0, no dialog, toast or undo; Reset is text only, 24 px under + | UX-TALLY-1 |
| Neither app shows offline or unsent changes, Tally part (`:224`) | Confirmed: no `hub.onSync` in the file; two-devices C shows 41 offline, then silently 39. Phase 2 owns the mechanism. Widened: once Tally is closed, the shell reads synced while its taps are still queued, and they are never sent until Tally reopens | P2 Sync UX pointer; P3-TALLY-05 |
| No loading state, and taps do nothing until data loads, Tally part (`:226`) | Confirmed, with a correction: taps before 6.1 s do nothing; after it they write against the placeholder 0, which is shown as the count | UX-TALLY-2, P3-TALLY-07 (and P3-TALLY-02) |
| Tally in kid mode on iPad landscape does not fit (`:241`) | Widened (also 20 px on iPhone Safari) and narrowed (Reset has 42 px clear and is not cut) | VIS-TALLY-2 |
| Tally's minus button looks disabled (`:247`) | Narrowed: the glyph passes AA at 7.1-10.1:1; only the fill is lighter (1.27-1.30:1 against +) | VIS-TALLY-4 |
| Tally does not group digits in large counts (`:253`) | Confirmed: 1284750 and 250000 ungrouped; 7 digits read only to about 1.84 m on the iPad | VIS-TALLY-6 |
| Timer-only leads in the same section (dial oval, pause, alerts, done state, pill, kid mode, preset chip, primary button, hours, duplicate title) | Not checked here | Timer report |

## Not verified

- The real iOS `:active` press state without a `touchstart` listener (VIS-TALLY-7); needs a device.
- Real iOS double-tap zoom and pinch; the rig's WebKit on Windows reported scale 1 only.
- Real Liquid Glass / `backdrop-filter` rendering, and the frame-rate cost of five blur layers on the iPad.
- SF Pro Rounded and New York rendering. The rig uses fallback fonts, so the Typography score is provisional.
- Rubber-band overscroll inside the viewer iframe on iOS.
- How often the household counts on two devices, or opens Tally cold on a slow link; and whether any household device still holds `tally.count`. Production was not touched.
- Scenario B of P3-TALLY-01 (the reopen on a slow link) was run by the investigator only; the skeptics reproduced A and C.
- P2-SYNC-18, P2-PROF-02, P2-PROF-19, P2-PROF-14 and P2-CHAT-09 in Tally: argued from code or inherited from Phase 2, not re-run.
- P3-TALLY-05's slow-link arm on a real iOS WebView (whether `about:blank` aborts an in-flight POST); see Unresolved.
- P3-TALLY-09: the refusal of a `#tally` hash change after boot on the kiosk (`index.html:715`) is by code only; the runs covered the boot deep link and the standalone page.
- The Apple Stopwatch support page could not be read (only navigation came back), so the reference facts are from product knowledge.
- Midnight, DST and time-zone behaviour were not run: there is no date logic in the app.

## Scripts and evidence

**Investigator** (`audits/tools/phase3/tally/`):
- `layout.mjs`, `two-devices.mjs`, `first-load.mjs`, `rapid.mjs`, `audiences.mjs`, `themes.mjs`, `glance.mjs`, `loading.mjs` and `landscape-phone.mjs`.
- Platform counts: `node audits/tools/phase3/compliance.mjs tally` → `audits/evidence/p3/_compliance/tally.json`.

**Skeptics** (`audits/tools/phase3/tally/`):

| Finding | Scripts |
|---|---|
| P3-TALLY-01 | `verify-lww-absolute-count-loses-increments-1.mjs`, `verify-lww-absolute-count-loses-increments-2.mjs` |
| P3-TALLY-02 | `verify-first-load-tap-overwrites-count-1.mjs`, `verify-first-load-tap-overwrites-count-2.mjs` |
| P3-TALLY-03 | `verify-legacy-migrate-overwrites-count-1.mjs`, `verify-legacy-migrate-overwrites-count-2.mjs` |
| P3-TALLY-04 | `verify-minus-at-zero-silent-write-1.mjs`, `verify-minus-at-zero-silent-write-2.mjs` |
| P3-TALLY-05 | `verify-critic-stranded-queue-on-close-1-1.mjs`, `verify-critic-stranded-queue-on-close-1-2.mjs` |
| P3-TALLY-06 | `verify-critic-guest-gets-legacy-migration-2-1.mjs`, `verify-critic-guest-gets-legacy-migration-2-2.mjs` |
| P3-TALLY-07 | `verify-critic-fake-zero-while-loading-5-1.mjs`, `verify-critic-fake-zero-while-loading-5-2.mjs` |
| P3-TALLY-08 | `verify-critic-count-not-sanitised-3-1.mjs`, `verify-critic-count-not-sanitised-3-2.mjs` |
| P3-TALLY-09 | `verify-critic-kiosk-offers-edit-controls-4-1.mjs`, `verify-critic-kiosk-offers-edit-controls-4-2.mjs` |
| OK-TALLY-1 (slow link) | `verify-critic-rapid-taps-slow-link-exact-6-1.mjs`, `verify-critic-rapid-taps-slow-link-exact-6-2.mjs` |

**Completeness critic** (`audits/tools/phase3/tally/`): `critic-stranded.mjs`, `critic-stranded-online.mjs`, `critic-guest-migrate.mjs`, `critic-chat-values.mjs` and `critic-rapid-slow.mjs`, with evidence in the matching `critic-*.json` files and `critic-chat-values-minus13-after-plus-ipad.png`.

**Visual checker.** Wrote no script; it re-read the investigator's `themes.json`, `layout.json`, `glance.json`, `loading.json` and `rapid.json`, and opened the 42 screenshots listed in §5.

**Evidence** is in `audits/evidence/p3/tally/`:
- JSON: `audiences.json`, `first-load.json`, `glance.json`, `landscape-phone.json`, `layout.json`, `layout-overflow.json`, `loading.json`, `rapid.json`, `themes.json`, `two-devices.json`, the `critic-*.json` files and the `verify-*.json` files.
- PNGs at 1× CSS scale: the `layout-*`, `theme-*`, `landscape-phone-*`, `kid-*`, `kiosk-*`, `loading-*`, `first-load-*`, `critic-*` and `verify-*` images.

The Phase 1 captures are under `audits/screens/tally/`.
