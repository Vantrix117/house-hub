# Batch 7 (Kid Verse): brief for the workers

## Setup
- **Repo:** `C:\Users\ex_bo\OneDrive\Claude Related\App Hub`. HEAD is `ac5f7e4`; batches 0a-6 are done.
- **SCRATCH:** `C:\Users\ex_bo\AppData\Local\Temp\claude\C--Users-ex-bo-OneDrive-Claude-Related-App-Hub\af3dfdac-12ca-439a-9836-6c1cb19fda21\scratchpad`.
- **Read `CLAUDE.md` first.** It is current through batch 6. The relevant parts:
  - the Kids bullet;
  - **Stars & badges**: read every word, this batch changes that machinery;
  - the TV board (its paraphrase copy of Kid Verse's table);
  - Push;
  - Who may write what (`worker/src/policy.js`);
  - Photos (`worker/src/media.js`);
  - the shared sprite (`icons/sprite.svg`, `svg.sym`), `hub.toast`, `hub.confirm`, the segmented control.
- **The house's people:**
  - kids Ezra and Kiara;
  - adults Eli (the admin), Mae (id `christian`), Elizabeth (Mom), David (Dad), Mea;
  - guests, the TV (kiosk, read-only) and the Kitchen device.

## The batch
- **Entries:** `SCRATCH/b7.md`. There are 16 entries, plus the three kept improvements at the end:
  - IMP-KIDVERSE-F3 (word highlight);
  - IMP-KIDVERSE-I1 (past weeks shelf);
  - IMP-KIDVERSE-I2 (a parent's recorded voice).
- **Carry-overs:** `SCRATCH/b7-carry.md` lists the earlier batches' unfinished entries that have a Kid Verse part. A classifier is writing it now; Worker B picks it up when it exists.
- **Phase 3 report:** `audits/03-apps/kidverse.md`. Each entry cites its line.
- **The app:** `apps/kidverse.html` (900 lines).
  - The adult/kid main part is about :1-720.
  - The story companion is about :800-900 (`renderStory`, its own speaker).
  - The rewards machinery: `weekCount` :505, `applyLedger` :544, `deriveStars` :582, `reconcile` :629.
- **The shell's half of rewards:** `index.html` "item 20: Kids' rewards", about :2866-2960 (`rewardRow`, `ledgerRows`, Cash in / Reset week). `effectiveStars()` and `kidStars()` also feed the Home Kids card and the TV's stars pane.

## Decisions (do not re-open)

### Stars
- **The day dots (P3-KIDVERSE-04).**
  - Each of the 7 dots shows every star earned that day, with one small mark per kind: a star for the verse, a book for the story, praying hands for prayed (from the sprite; add what is missing in Lucide style).
  - The label counts what ★N counts ("6 stars this week"), and VoiceOver reads each day's marks.
  - The grown-ups panel uses the same dots.
- **Reset week (P3-KIDVERSE-12, -13, UX-KIDVERSE-4).**
  - A reset row (`ledger:<kid>:<id>`, kind `reset`) clears its listed `days[]` for ALL THREE kinds, whatever the current ISO week when Kid Verse applies it.
    - Verse: read from the per-fact rows (`star:verse:<date>`).
    - Story and prayed: credited or not yet credited.
  - A story or prayed day that is listed and not yet credited is marked spent, with `reset:<kind>:<date>`, so `reconcile()` never credits it afterwards.
  - The one exception keeps CLAUDE.md's in-flight rule: a star whose `earnedAt` is later than the row's `at` stays. For a not-yet-credited story or prayed day, the underlying event has no time, so on the reset's OWN date treat it as before the reset (spent). Say this in a comment.
  - Old reset rows (with only `days[]`) must apply the same way. The shell's Reset week keeps writing `{kind:'reset', date, days[], by, at}`.
  - After a reset, the story card and the stars card agree. Example: "Heard 1 day · no stars this week".
  - A pressed "Done today" beside 0 stars gets a kind line, "Your star for today was reset", never a contradiction.
- **The row size (P3-KIDVERSE-09).**
  - The derived stars object and its family mirror must stop growing forever. Fold `credited.*` and `applied` entries older than the 14-day look-back (plus a safety margin; say how much) into counters, keeping every total identical.
  - Write the mirror once per change, never twice.
  - Prove it with a year of facts: the size is bounded, and the totals are unchanged against the unpruned derivation.
- **Labels (P3-KIDVERSE-06, VIS-KIDVERSE-11).**
  - The balance reads "to cash in". Earned reads "N ever".
  - The summary's items wrap as whole items, with no dangling "·" (a flex row with gaps, or separators that belong to the item after them).
- **Years (UX-KIDVERSE-9).** A date from an earlier year shows its year (the badges, the payouts, and "Last cashed in", in Kid Verse and in the shell's rewards card).

### The week
- **Story card on a week change (P3-KIDVERSE-05).** A week change from this device repaints the story card and its speaker at once. Prove it by the story text and the spoken text.
- **No week set (UX-KIDVERSE-5).**
  - Adults get "Pick this week's verse", with the stepper as the one action.
  - Kids get a friendly placeholder, a picture plus "A grown-up will pick this week's verse" (read aloud on tap). There is no verse star while no week is set.
  - The TV and Home must not crash on a missing week. Read their code and test it.
- **The week advancing (GAP-KIDVERSE-1).**
  - A week change posts a feed line: `hub.activity("Kid Verse is now week 39: <ref>")`.
  - From Sunday 5 pm (New York, `hub.today`/the house clock) until the week changes, an adult opening Kid Verse sees one quiet offer at the top of their panel, "Move to week N+1?", with Move and Not now. The offer only shows when the family week was set more than 5 days ago. Not now is remembered per adult per week (a person row). Week 52 offers nothing.
  - No push.

### Layout
- **Kids' first screen (UX-KIDVERSE-2).** On every device the art, the reference, the verse speaker and Done fit the first screen in the hub's viewer: 390×844, 430×932, 820×1180, 1180×820, 1440×900, at the default text size, light and dark. The story card and "I heard it" follow, and come at most one short scroll later. Shrink the art's height before anything else.
- **Adults first (UX-KIDVERSE-10).** For an adult, the grown-ups panel (the Kids' stars, the week stepper, the Move offer, the voice recording) comes FIRST. The kid preview follows, labelled "What the kids see".
- **The iPhone kids panel (VIS-KIDVERSE-5).** Each kid's name and ★ count sit on their own line, and the dots on the next.
- **Pictures, not reading (UX-KIDVERSE-1).**
  - The two speaker buttons get distinct pictures: a scroll for the verse, a book for the story.
  - "I heard it" becomes a big picture button: an ear (or ear + book) with the star mark.
  - Every toast a kid sees is also spoken, through the same voice as Read it to me. It never talks over itself or over a running read-aloud: queue or skip.
- **No doubled icons (VIS-KIDVERSE-9).**
  - Drop the ★ and ✓ text from labels that already have an icon.
  - The stepper uses the sprite's minus and plus (add them if missing).
  - The badges' numerals 7, 10 and 50 stay as words or numbers, not as icons. Say what you chose.

### Improvements
- **IMP-KIDVERSE-F3, the word highlight.**
  - While Read it to me (verse paraphrase) or the story speaker reads, the word being spoken is highlighted, using `SpeechSynthesisUtterance` `boundary` events (charIndex/charLength).
  - Where boundary events never fire (some iOS voices), nothing breaks and nothing is highlighted.
  - The highlight is a background or underline token, with no motion. Under Reduce Motion it is the same.
  - It is cleared on end, cancel and error.
- **IMP-KIDVERSE-I1, the past weeks shelf.**
  - Below the story card, "Earlier weeks" shows the weeks before the family week, newest first: the last 6, then "Show all".
  - Each is a card with that week's scene art and reference. A tap opens it read-only: the verse paraphrase and the story, each with its speaker and word highlight.
  - There is no Done, no "I heard it" and no stars, and the screen says so with a picture: "Just for listening".
  - Hidden for the TV. Kids and adults both see it.
- **IMP-KIDVERSE-I2, a parent's voice.**
  - **Who records.** A household adult (not a guest, the TV or the kitchen) can record the family week's verse (the paraphrase), with MediaRecorder, in the grown-ups panel: Record / Stop / Play / Save / Remove. It is at most 90 seconds and at most 1 MB; refuse anything larger in the app and in the Worker.
  - **One recording per week.** Saving over an existing one asks first (`hub.confirm`), naming whose it replaces.
  - **The Worker.** New routes in `worker/src/index.js`:
    - `POST /api/kidverse/voice/:week`: raw body, Content-Type one of `audio/webm`, `audio/mp4`, `audio/ogg`, `audio/mpeg` (the codec parameter allowed). Household adults only. The body is stored through `putMedia` under a random key `voice/<week>/<random>`.
    - The family row is written server-side: `app_data(family, kidverse, 'voice:<week>')` = `{id, by, byName, at, mime, ms, bytes}`. The previous recording's bytes are deleted.
    - `DELETE /api/kidverse/voice/:week`: the same adults; it deletes the bytes and tombstones the row.
    - **PRIVACY: unlike photos, voices are NOT public URLs.** `GET /api/kidverse/voice/:week/:id` needs a signed-in session (any household profile including kids, the kitchen and the TV; not an expired guest). The app fetches it with the session header and plays a blob URL.
    - `policy.js` refuses any client write of a `voice:` row; only the Worker writes it.
  - **Playback.** When a recording exists for the shown week, "Read it to me" plays it, labelled with the recorder's face and name ("Mom's voice"). The kid's card shows their face on the button. Where it cannot play (a decode error or offline), it falls back to the synthetic voice quietly. The word highlight does not apply to a recording.
  - **Where it plays.** The past weeks shelf plays a week's recording if one exists. The TV does not play.
  - **The microphone.** A refused microphone gives a calm toast. Hidden where MediaRecorder/getUserMedia is missing.
  - **Test it** in Chromium with a fake microphone (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`). Real Safari recording is a device check; say so.

## Hard rules (all workers)
- **Colour and CSS.** Every colour is a design.css token: no hex in any `<style>`, and never `prefers-color-scheme`. `apps/design.css`'s token half (lines 11-765) stays byte-identical to `git show ac5f7e4:apps/design.css | sed -n 11,765p`.
- **Never touch:**
  - the pre-paint bootstraps;
  - `handoff/` (`check.js` stays 47/2, `0g/check-ids.js` 49/49);
  - `apps/f260.html`, `apps/prayer.html`, `apps/verses.html`, `apps/timer.html`.
- **No build step, no downloads.**
- Keep line endings.
- **Secrets.** Never write or print a secret, PIN, code or token. The local code is in `SCRATCH/localcode`; pass it only as an argument.
- **No commit, no push, no deploy.**
- **Processes.** Do NOT run `SCRATCH/repo-tests.sh`. Never kill another worker's wrangler, and never run a command that kills processes by name.
- **Server rules stay**, except the narrow additions above: the voice routes, and policy refusing client `voice:` rows. The declined features stay out: no kid routines/chores app, no grocery list.
- **Kid Verse, signed in as that kid, stays the only writer** of the kid's star rows and the family mirrors `stars:<kid>` / `story:<kid>`. Adults write only ledger rows.
- **The verse text.** The paraphrase table (`KIDWORDS` / the story table) is copied in the TV (`index.html`) and in `apps/verses.html`, and tests check that the copies agree. If you must change it, change all three copies. Do not change Scripture references.
- **Existing ids and test hooks stay**; add new ones.
- **Shared files:**
  - Make small `Edit`s with unique anchors, and re-read before each one.
  - Workers A and B share `apps/kidverse.html`: **A owns the `<script>` logic for the stars, ledger, reconcile and derive code, and the week change; B owns `<style>`, markup, icons, layout, the speakers, the highlight and the shelf.**
  - Agree hooks (function names, data attributes) in `SCRATCH/b7-hooks.md`.
- **The shell:**
  - A owns `index.html`'s Kids' rewards region (item 20, `rewardRow`/`effectiveStars`/`kidStars`, Reset week and Cash in) and the Home Kids card's dots, if it has any.
  - C owns the rest of `index.html` (the TV's missing-week guard included), `worker/`, `apps.json`, `sw.js`, `CLAUDE.md`, `worker/README.md`, `scripts/smoke-api.sh`, `test-tv.mjs` and `test-home.mjs`.
- **The lock.** SCRATCH/suite.lock means one suite at a time machine-wide.
  - Write your name in it, and delete it when done.
  - Wait for it in a sleep loop inside your turn, with no limit; never remove someone else's lock.
  - Do not hand back while waiting. If you truly must stop, say exactly what remains.

## Worker A: the stars and the week logic (Sonnet)
- **Entries:** P3-KIDVERSE-04 (the data behind the dots; B draws them), -12, -13, -09, -06 (labels in both places), -05, UX-KIDVERSE-4, UX-KIDVERSE-9 (the date formatter), GAP-KIDVERSE-1 (the feed line, the Move offer's rule and its person row; B places the markup), and UX-KIDVERSE-5's logic (no week).
- **Tests:**
  - Extend `scripts/test-rewards.mjs` and `scripts/test-kidverse.mjs`.
  - Write a claims check at `audits/tools/phase6/7/stars-a-7.mjs` (pattern `audits/tools/phase6/6/timer-a-6.mjs`). It proves:
    - a cross-week reset;
    - an uncredited prayed or story day reset;
    - the in-flight star;
    - the row bound over a year;
    - totals equal to the unpruned derivation;
    - the dots matching the count;
    - the Move offer's window (Sunday 4:59 pm no, 5 pm yes, set 3 days ago no, Not now remembered);
    - the story repaint;
    - no week.

## Worker B: the look, the kids' first screen, F3 and I1, the carry-overs (Sonnet)
- **Entries:** UX-KIDVERSE-1, -2, -10, VIS-KIDVERSE-5, -9, -11, the dots' drawing (P3-KIDVERSE-04), the no-week screens (UX-KIDVERSE-5), the Move offer's markup, IMP-KIDVERSE-F3 and IMP-KIDVERSE-I1, and every item in `SCRATCH/b7-carry.md` under "Batch 7 must do for Kid Verse".
- **Icons:** take them from the sprite, adding what is missing in Lucide geometry and listing it in `icons/LICENSE-lucide.txt`. One drawing per meaning: check `icons/sprite.svg`'s existing symbols and Table ICON-6 in `audits/04-design-system.md`.
- **Check:** write `audits/tools/phase6/7/kidverse-look-7.mjs`. It measures:
  - the first-screen rule at the five sizes above (inside the hub's viewer), plus XXL;
  - adults first;
  - the iPhone kids panel with no overlap (including a long name);
  - no horizontal scroll from 375 to 1440;
  - kid targets ≥ 64 px;
  - the highlight's word under a fake boundary event;
  - the shelf being read-only (no star written).

## Worker C: the voice recording, the Worker, the shell guards, docs (Sonnet)
- **Entries:** IMP-KIDVERSE-I2 (Worker routes, policy, and the app's recording/playback; coordinate the markup with B through b7-hooks.md: C writes the voice code and B gives it a place), the TV and Home missing-week guard, and the docs.
- **Tests:**
  - `smoke-api.sh`: the voice routes, which cover:
    - the adult-only upload, refused for a kid, a guest, the TV and the kitchen;
    - the type and size limits;
    - GET needing a session;
    - DELETE;
    - policy refusing a client `voice:` row.
  - `test-kidverse.mjs` (with A): playback chooses the recording, and falls back to the synthetic voice on a decode error.
  - `test-tv.mjs`/`test-home.mjs`: no week set.
  - Write `audits/tools/phase6/7/voice-7.mjs` (a fake microphone, record, save, a second device plays it, replace confirms, remove).
- **Docs:** update `CLAUDE.md` (the Kids bullet, Stars & badges, the TV and Who may write what, Photos/media, and the Tests table with the new counts) and `worker/README.md` (the routes).
- **Precache:** tell the orchestrator if a file is added. The orchestrator runs `bump-sw` once at the end.

## How to check (report the numbers)
- **Scripts.** Run from the repo root: `NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules" node "<script>"`.
  - The batch's Phase 3 scripts are in `SCRATCH/b7-scripts.txt`; their before-run on the pre-batch code is in `SCRATCH/7-before/`.
  - If a script fails only because its UI or data contract changed on purpose, copy it to `audits/tools/phase6/7/<name>-7.mjs`, with a header comment saying why, and report both.
  - **Read the actual output, not only the exit code.**
- **Your own Worker.**
  - Copy `SCRATCH/d1-tmpl` to a SHORT path: A `C:\Users\ex_bo\AppData\Local\Temp\b7a\d1`, B `…\b7b\d1`, C `…\b7c\d1`.
  - `cd worker && npx wrangler dev --port <A 8792 | B 8793 | C 8794> --persist-to <that>`.
  - Use a fresh D1 per suite run, then stop it and delete the copy.
  - `d1-tmpl` may predate migration 008. Apply it to your copy once, before starting wrangler: `npx wrangler d1 execute house-hub --local --persist-to <copy> --file migrations/008-timer-live.sql`. It is idempotent.
  - The repo tests take `HUB_API` and the code as argv.
- **Capture.** ALWAYS pass your own `--out SCRATCH/b7<a|b|c>/cap` (`--area kidverse`; C also `--area shell` and `--area tv`). Never `--help`.
  - LOOK at the PNGs yourself: light and dark, at 390, 820, 1180 and 1440, and at XXL, for Ezra, Kiara, an adult and the TV.
- **Gates:**
  - `node SCRATCH/parse-check.cjs`: 0 failed.
  - No hex in `<style>`.
  - `audits/tools/phase6/5/home-art-5.mjs` stays at 0 (C, if Home changes).
  - `node scripts/bump-sw.mjs --check`.
  - `git checkout -- docs/screens` after tests.

## Report (short)
- Each entry: done, partly done or not done, and why.
- The files and regions you changed.
- Scripts before → after.
- Suite counts.
- What you looked at.
- What needs a real device.

## Timing note
The orchestrator's before-run uses the browser ports until `SCRATCH/before-7.log` contains a line starting `capture exit`. Until then, do not run any suite, script or capture: read, plan and edit first.
