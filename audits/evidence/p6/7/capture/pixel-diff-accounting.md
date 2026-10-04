# Batch 7: why 47 shell shots and 8 TV shots differ from batch 6

The final run's captures (Windows, Playwright WebKit) were compared with batch 6's after-captures: `pxdiff-shell-vs-6.txt` (979 compared, 47 changed beyond tolerance 48) and `pxdiff-tv-vs-6.txt` (34 compared, 8 changed). Kid Verse's 240 of 240 changed is the batch itself (`pxdiff-kidverse-vs-prebatch.txt`).

Batch 7's code commit `7a77c6b` changed three things the shell or the TV draw (`git show 7a77c6b -- index.html`):
1. **Me → Kids' rewards** (`renderRewards()` in `index.html`): each figure is a whole item that wraps as one (`★N to cash in`, `· N this week`, `· N ever`, `· last cash-in N on <date>`), and the date reads "Mar 8" (or "Mar 1, 2025" in an earlier year) instead of the raw "2026-03-08" (P3-KIDVERSE-06, VIS-KIDVERSE-11, UX-KIDVERSE-9).
2. **The TV's verse pane** with no family week: "A grown-up will pick this week's verse." with no week number, no refs and no kid line, instead of week 1's verse (UX-KIDVERSE-5).
3. The shell's copy of the ledger rules (`rewardRow`, `wasApplied`) reads more of the mirror; it draws nothing new. `icons/sprite.svg` gained two symbols (`i-scroll-text`, `i-ear`) that no shell screen uses.

Nothing else the shell draws changed: no edit to `apps/hub.js`, `apps/design.css`, `apps.json`, the seed or the capture rig's shell area between `ac5f7e4` and `7a77c6b`.

## Shell: 47 changed

### 36 explained by the Me rewards card (change 1)
The Me tab shows the Kids' rewards card above Notifications and Admin, so all three Me captures carry its lines.
- `me-rewards-typical-*`: 10 (desktop, iPad landscape, iPad portrait, iPhone PWA, iPhone Safari; light and dark). 429-1664 px in one line-high box (75 × 13 px on the iPhone): the date "on 2026-03-08" → "on Mar 8".
- `me-notifications-typical-*`: 10, the same date box (the card is above the Notifications section in frame).
- `me-admin-offline-*`: 8, the same date box (desktop, both iPads, iPhone PWA).
- `me-rewards-overflow-*`: 8 (desktop, both iPads, iPhone PWA), 859-6428 px (up to 1.6 %): the long names' lines now wrap as whole items with no dangling "·", and the date is shorter.

### 11 noise
- `chat-typical-*`: 5 (desktop light, iPhone PWA and Safari, light and dark), 14-24 px scattered over the whole thread (box 92,47-352,740 on the iPhone). Batch 7 changed nothing in the chat.
- `apps-empty-iphone-pwa-light` and `apps-guest-typical-iphone-*`: 5, 60 px in one 43 × 8 px box (337,279-380,287), which is the "Kitchen timer" tile label. The dark twin of the empty shot is the same, and batch 7 changed nothing in the Apps tab, `apps.json` or the tile icons.
- `home-overflow-iphone-pwa-dark`: 1, 12.6 % from y 246 down, while its light twin is the same. Batch 7 changed nothing in Home's markup.

**Proof (cloud re-capture, Chromium, so compared only with itself).** The Windows WebKit captures are not in this repo, so the same screens were captured again here on the pre-batch code (`git archive ac5f7e4`) and on `7a77c6b`, with the rig (`capture.mjs --area shell --screen home,apps,apps-guest,chat,me-rewards --state overflow,empty,typical --device iphone-pwa --mode light,dark`, 26 shots each), then the batch-7 tree a second time:
- `cloud-recapture/pxdiff-shell-pre-vs-post.txt`: `apps-empty`, `apps-guest-typical`, `chat-typical`, `chat-*`, `home-overflow` (light and dark) are all "same" or "noise" (bytes differ, no pixel over tolerance) between the pre-batch and the batch-7 code. Only the Me rewards card changes: `me-rewards-typical` 2217-2223 px, `me-rewards-overflow` 10.5-15.8 % (`cloud-recapture/crop-meo-pre.png` → `crop-meo-post.png`: "· 867 ever" moves whole to its own line, "on 2026-03-01" → "on Mar 1"), and `me-rewards-empty` 5-7 px at 258,226, the "·" before "0 this week" now set inside its own no-wrap item. One more, `home-typical-iphone-pwa-dark`, 2 px at 105,875 (0 %), is the live timer pill's seconds (see the TV's timer line below).
- `cloud-recapture/pxdiff-shell-post-vs-post-rerun.txt`: the batch-7 tree against itself, 26 compared, 0 changed; `chat-typical` (both modes), `apps-typical` and `home-typical` dark differ in bytes from run to run, as on Windows.

## TV: 8 changed, all explained by the no-week line (change 2)
All 8 are the `empty` household, which has never picked a family week:
- `board-empty-tv-*` and `board-evening-empty-tv-*`: 4, 26 541 px (1.28 %) in the verse pane (box 857,86-1646,293).
- `board-ipad-empty-ipad-landscape-*`: 2, 13 343 px (1.38 %), the verse pane.
- `board-ipad-empty-ipad-portrait-*`: 2, 21.9-22.3 %: in portrait the panes stack, so the verse pane, now one line shorter (no refs row, no kid line), moves every pane below it up.

Every `typical`, `overflow`, `loading` and `offline` board, the picker, Me and Chat on the TV are the same as in batch 6.

Cloud re-capture (`cloud-recapture/pxdiff-tv-pre-vs-post.txt`, `--area tv --state empty,typical`, 22 shots): the same 8 empty boards change (1.85 % on the 1920 × 1080 board, 13.5-13.8 % iPad landscape, 23.2-23.6 % iPad portrait; `crop-tvempty-pre.png` shows "Verse of the week · Week 1", Genesis 1:27 and its kid line; `crop-tvempty-post.png` shows "A grown-up will pick this week's verse."). Five typical shots also differ by 195-360 px in a 20 × 22 px box: that is the running timer line's seconds ("6:21 left" → "6:20 left", `crop-tv-timer-pre.png` / `crop-tv-timer-post.png`), the capture landing in a different second; it is noise, and on Windows those shots were the same.

None of the 55 changed shots is an unintended change.
