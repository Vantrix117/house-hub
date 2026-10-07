# Batch 8: why 74 shell shots differ from batch 7, and why all 184 Larder shots differ

The final run (code `6688e17`, Windows, Playwright WebKit) was compared with the earlier captures:
- `pxdiff-shell-vs-7.txt`: the shell, 979 compared against batch 7's after-captures (`audits/screens-after/7/shell/`), **74 changed** beyond tolerance 48.
- `pxdiff-leftovers-vs-prebatch.txt`: the Larder, 184 compared against the pre-batch captures, **184 of 184 changed**. That is the batch itself: the Larder was redesigned (cards, add bar, groups, the kitchen and kid views), so every state differs. `pxdiff-leftovers-vs-phase1.txt` is the same comparison against Phase 1's set and is not used.

The batch's code between batch 7 (`31eb01d`) and `6688e17` changes three things the shell draws (`git diff 31eb01d 6688e17 -- index.html apps/hub.js sw.js`; `apps/design.css`, `apps.json` and the seed are untouched):
1. **Home's fridge wording** (P3-LEFTOVERS-02, `index.html`): the card, the hero's summary line and the Kitchen's glance now take their counts and words from `hub.larder.due` (the Larder's one rule): "N use it up · N eat soon" instead of "N to eat", "Nothing to eat soon" instead of "Nothing aging", and each item's age as the rule's short form.
2. **The Apps badge's `aria-label`** ("N to eat soon or use up"): not drawn.
3. `hub.js` gained `hub.larder` (the rule) and `index.html` reads it; nothing else the shell paints moved.

## Shell: 74 changed

### 62 explained by the Home fridge wording (change 1)
All eight Home groups, every device and both modes, and in each group every shot has the same changed box, which is the hero's summary line and the fridge card's head:
- `home-typical-*`: 10; `home-guest-typical-*`: 10; `home-offline-*`: 8; `home-overflow-*`: 8; `home-pull-typical-*`: 6; `home-timer-typical-*`: 10; `first-visit-typical-*`: 4; `home-empty-*`: 6. Within a group the pixel count and box are identical (for example iPad portrait: 4633 px at 53,126-639,345 in `home-typical`, `home-offline`, `home-pull-typical` and `first-visit-typical`), which is what one wording change on one fixed screen looks like.
- Looked at as pairs (`audits/screens-after/7/shell/` against `audits/screens-after/8/shell/`):
  - `home-typical-iphone-pwa-light`: the hero's "a reading waiting · 3 to eat · 6 to pray" becomes "a reading waiting · 1 use it up · 6 to pray", and the fridge card's head "3 to eat soon" becomes "1 use it up". Nothing else on the screen differs.
  - `home-typical-desktop-light` (after): the fridge card reads "1 use it up · 2 eat soon" over three bars with the short ages "8d", "5d", "4d"; the hero says "1 use it up". The 3088 px box covers exactly those two places.
  - `home-overflow-iphone-pwa-light`: the hero's "18 to eat" becomes "10 use it up" (the rule counts only the use-it-up items in the hero's short form), box 44,136-225,171 = that line.
  - `home-timer-typical-iphone-pwa-light`: "3 to eat" becomes "1 use it up" and the hero line re-wraps ("reading done · 1 use it up ·" / "4 to pray · a timer running ·" / "4 reminders"); this is why the timer group's boxes are 20 px taller than the plain Home's. The timer pill and its 6:20 are the same.
  - `home-empty-ipad-portrait-light`: "Nothing aging" becomes "Nothing to eat soon", which wraps to two lines at that size, so the card's head grows 1.2 % (11 753 px, the largest of the group, the only one whose layout moved: no neighbouring card moves, the grid row is the same height).
- The other Home screens (the kid's Home, the TV, the Kitchen) were not among the 74: the kid Home has no fridge card, and the rig has no kitchen profile (see below).

### 12 noise (not caused by this batch)
- `apps-empty-iphone-pwa-light`, `apps-overflow-iphone-pwa-dark`, `apps-typical-iphone-pwa-dark`: 3, each 60 px (0.015 %) in one 43 × 8 px box at 337,279-380,287, the "Kitchen timer" tile label. That is the same box and the same count batch 7 found and proved noise by a cloud re-capture (`audits/evidence/p6/7/capture/pixel-diff-accounting.md`, "apps-empty … and apps-guest-typical", also `cloud-recapture/pxdiff-shell-post-vs-post-rerun.txt`: the tree against itself differs in bytes from run to run). I opened `apps-typical-iphone-pwa-dark` before and after: the Larder tile's badge still reads 3 (the Apps badge's count is unchanged here), the labels and icons are the same, and no pixel I can see differs.
- `chat-typical-*`: 5 (14-24 px scattered over the thread, 0.002-0.005 %) and `chat-empty-ipad-*`: 4 (1 px each, 0 %). Batch 7 listed the same five `chat-typical` shots as noise with the same scatter (92,47-352,740 on the iPhone) and proved them so against its own re-run. Batch 8's only chat change is the Worker's `finish_leftover` wording (`worker/src/chat.js`, one line), which does not draw in the shell.

I did not re-capture the shell twice on Windows with identical code (that machine's rig is not available here), so for these 12 the evidence is that the same shots, with the same boxes and pixel counts, were already proved to flip between identical runs in batch 7, and that nothing batch 8 changed reaches them. Every one of the 12 is at most 0.015 % of the frame, and none contains text the batch touched.

## What the rig cannot show
- **The Kitchen glance** (the Kitchen Home's "Eat soon" block, now using the same rule and `fridgeWords`): the capture rig has no kitchen profile, as in batch 2a, so no shot covers it. `scripts/test-kitchen.mjs` 64/0 covers its logic; the look from across a room is a device check.
- **The Apps badge**: the number is the same (3) and only its `aria-label` changed; not drawn.

None of the 74 changed shots is an unintended change: 62 are the Home wording this batch asked for (P3-LEFTOVERS-02, N2), 12 are noise with batch 7's proof.
