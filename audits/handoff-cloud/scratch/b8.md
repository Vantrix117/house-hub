# Batch 8 — Larder: 16 entries + the kept improvements at the end; carry-overs are in b8-carry.md

#### GAP-LEFTOVERS-1 — No way to fix a mistake or give a food its own use-by: no edit and no per-item expiry

- **Area** leftovers · **Type** feature gap · **Severity** medium · **Effort** M · **Batch** 8
- **Verified (step 3).** was medium; skeptics medium and medium. Correction: "Loses logged by" is true only when someone other than the original logger fixes the item; the same person re-logging keeps their own name. The report leaves out two things. The ✓-and-re-log fix also posts a false "Finished the <item>" line to the family feed, which strengthens the item.
- **Evidence.** `audits/03-apps/leftovers.md:862`; `apps/leftovers.html:137`, `apps/leftovers.html:249-311`
- **What happens now.** Items can only be added or removed. A wrong date or size needs delete and re-add, which loses "logged by".
- **Why it matters.** Mistakes need delete and re-add.
- **Proposed fix.** Tap a card to edit name, size, date and an optional use-by; the ramp uses the use-by when set. (Phase 3: IMP-LEFTOVERS-F1, IMP-LEFTOVERS-I2)
- **How it will be verified.** recapture its screens (capture area leftovers) and compare; plus batch 8's checks.

#### P3-LEFTOVERS-02 — Home, the Apps badge and the 8 am push word the fridge differently from the Larder

- **Area** leftovers · **Type** bug · **Severity** medium · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:212`; `apps/leftovers.html:137`, `apps/leftovers.html:146`, `index.html:679-681`, `index.html:1175`; `audits/evidence/p3/leftovers/thresholds-home-ipad.png`, `audits/evidence/p3/leftovers/verify-thresholds-disagree-1-home-iphone.png`
- **What happens now.** As filed, the investigator found three rules:
- **Why it matters.** The lock screen says a 5-day chili must be used up, the app calls it "eat soon", and Home calls an 8-day dish "to eat this week" while the app says "a week or older". People learn to ignore one of the three.
- **Proposed fix.** One freshness rule shared by the Larder, Home, the Apps badge and the 8 am push ("eat soon" 4-6 days, "use it up" 7+), from one function. (Phase 3: IMP-LEFTOVERS-P2)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-thresholds-disagree-1.mjs"`, `node "audits/tools/phase3/leftovers/verify-thresholds-disagree-2.mjs"`, `node "audits/tools/phase3/leftovers/thresholds.mjs"` — the defect must no longer reproduce; plus batch 8's checks.

#### P3-LEFTOVERS-10 — "Copy failed — select manually" leaves nothing to select (from the visual check)

- **Area** leftovers · **Type** bug · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:536`; `apps/leftovers.html:341`, `apps/leftovers.html:339-347`, `apps/leftovers.html:350-358`, `apps/leftovers.html:114`; `audits/screens/leftovers/copy-error-iphone-safari-dark.png`, `audits/evidence/p3/leftovers/verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-1-failed.png`
- **What happens now.** `copyText` tries the async clipboard and then a selection copy from a textarea that is invisible (`opacity:0`) and removed straight after `execCommand` (`apps/leftovers.html:339-347`). On failure the label reads "Copy failed — select manually" for 2 s and then reverts (`apps/leftovers.html:350-358`).
- **Why it matters.** The one fallback the app offers tells the person to do something the page makes impossible.
- **Proposed fix.** On copy failure show the text in a pre-selected box (or the share sheet). (Phase 3: IMP-LEFTOVERS-F3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-2.mjs"`, `node "audits/tools/phase3/leftovers/verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-1.mjs"` — the defect must no longer reproduce; plus batch 8's checks.

#### P3-LEFTOVERS-11 — Long item names are cut to one line and cannot be read in the Larder (from the visual check)

- **Area** leftovers · **Type** bug · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:564`; `apps/leftovers.html:75`, `apps/leftovers.html:254-286`, `apps/leftovers.html:122`, `index.html:1175`; `audits/screens/leftovers/main-overflow-iphone-pwa-light.png`, `audits/screens/leftovers/main-overflow-ipad-portrait-dark.png`
- **What happens now.** `.nm` is one line with `nowrap`, `overflow: hidden` and an ellipsis (`apps/leftovers.html:75`). The card has no title, no tap handler and no detail view; its only control is the ✓, which deletes (`apps/leftovers.html:254-286`). On iPhone "Forgotten jar of homemade c…" keeps 37% of its name.
- **Why it matters.** "Church potluck baked ziti (th…" and "Vegetable fried rice with scra…" hide the part that says which dish it is.
- **Proposed fix.** Names wrap to two lines; a tap opens the edit sheet with the full name. (Phase 3: IMP-LEFTOVERS-F1)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-2.mjs"`, `node "audits/tools/phase3/leftovers/verify-vis-long-item-names-are-cut-off-with-no-way-to-read--3-1.mjs"`, `node "audits/tools/phase3/leftovers/entry.mjs"` — the defect must no longer reproduce; plus batch 8's checks.

#### UX-LEFTOVERS-3 — Nothing in the Larder can be read from 2 m on the Kitchen iPad

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** M · **Batch** 8
- **Verified (step 3).** was medium; skeptics low (partly) and low (partly). Correction: Cap millimetres come from WebKit's integer-rounded actualBoundingBoxAscent, so they overstate slightly (item names about 2.2 mm, not 2.31; chips about 1.6 mm, not 1.73).
- **Evidence.** `audits/03-apps/leftovers.md:753`; `apps/leftovers.html:213`, `apps/leftovers.html:23`; `audits/screens/leftovers/main-typical-ipad-portrait-light.png`
- **What happens now.** Cap heights on the 11" iPad (0.1924 mm per CSS px, canvas `measureText('H')`), against Phase 2's H1 (cap ≥ distance/200: 10 mm at 2 m) and H2 (≥ distance/344: 5.8 mm at 2 m), `audits/02-shell.md:519-520`: the 28 px title: 3.85 mm;
- **Why it matters.** Nothing reads from 2 m.
- **Proposed fix.** Glance roles on the Kitchen iPad: the oldest item and its age at --fs-glance-3. (Phase 3: IMP-LEFTOVERS-P5)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/visual.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 8's checks.

#### UX-LEFTOVERS-4 — "Copy list for Hearth" tells people to ask Claude for something the hub's Claude cannot do

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** S · **Batch** 8
- **Verified (step 3).** was medium; skeptics medium and low (partly); tie-break low (partly). Correction: The report says "The hub's Chat tab is Claude". That is true only in the code, not in anything a household member sees, so the "tell Claude" instruction does not clearly point at the hub assistant.
- **Evidence.** `audits/03-apps/leftovers.md:764`; `apps/leftovers.html:114-115`, `apps/leftovers.html:152`, `apps/leftovers.html:331`, `apps/leftovers.html:113-117`; `audits/evidence/p3/leftovers/roles-hearth-copied-iphone.png`, `audits/screens/leftovers/copy-typical-iphone-pwa-light.png`
- **What happens now.** The block says to copy, then tell Claude "push my leftovers to Hearth", and that "it'll add them straight to the Hearth Calendar" (`apps/leftovers.html:114-115`). The hub's Chat tab is Claude, but the Worker has no Hearth tool: 0 occurrences of "hearth" in `worker/src`.
- **Why it matters.** It tells people to ask Claude for something it cannot do.
- **Proposed fix.** Remove the Hearth instructions, or add a real Hearth path (a chat tool) before telling people to use it. (Phase 3: IMP-LEFTOVERS-F3)
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/roles.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 8's checks.

#### UX-LEFTOVERS-5 — Log with an empty name does nothing, with no message and no focus

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:773`; `apps/leftovers.html:291-292`
- **What happens now.** `if (!name) return;` (`apps/leftovers.html:291-292`), and the input has no `required`.
- **Why it matters.** Nothing happens.
- **Proposed fix.** Log with an empty name shows "Type what it is" and focuses the field.
- **How it will be verified.** recapture its screens (capture area leftovers) and compare; plus batch 8's checks.

#### UX-LEFTOVERS-6 — After Log there is no confirmation, and the new card can land under the add bar

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:776`; `apps/leftovers.html:298-303`; `audits/screens/leftovers/queued-offline-ipad-landscape-light.png`, `audits/evidence/p3/leftovers/taps-logged-iphone-pwa.png`
- **What happens now.** The field clears and the count changes, but there is no toast and no scroll (`apps/leftovers.html:298-303`).
- **Why it matters.** The new card lands under the bar.
- **Proposed fix.** After Log, a toast "Logged Taco soup" and scroll the new card into view above the bar.
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/critic-followups.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 8's checks.

#### UX-LEFTOVERS-8 — The sync error line shows a raw server code ("internal.") with no retry

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:794`; `apps/leftovers.html:185`; `audits/screens/leftovers/main-error-iphone-pwa-light.png`
- **What happens now.** `'The house list had a problem: ' + lastError` (`apps/leftovers.html:185`) renders "The house list had a problem: internal." in 12 px amber, quieter than the red banner below it.
- **Why it matters.** A raw server code.
- **Proposed fix.** Plain-language sync error with Retry.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.

#### UX-LEFTOVERS-9 — The red banner names no item and cannot be tapped

- **Area** leftovers · **Type** usability · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:798`; `apps/leftovers.html:207-215`; `audits/screens/leftovers/main-overflow-iphone-pwa-light.png`
- **What happens now.** It is plain text, "N items at a week or older" (`apps/leftovers.html:207-215`). A 63-day-old jar and an 8-day-old dish get the same line.
- **Why it matters.** The banner says nothing useful.
- **Proposed fix.** The banner names the oldest item and scrolls to it on tap.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-4 — The person's colour reaches only the add bar's glass tint; a card shows who logged it only as a name

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:821`; `apps/leftovers.html:39`, `apps/leftovers.html:265`; `audits/evidence/p3/leftovers/accent-eli-ipad.png`, `audits/evidence/p3/leftovers/accent-mae-ipad.png`
- **What happens now.** `--accent` differs by profile (Eli #4F5D8C, Mae #BC5A38), but `form#add` is the only element whose paint differs: the glass pickup (`apps/leftovers.html:39`).
- **Why it matters.** The person's colour barely appears.
- **Proposed fix.** Show who logged it with hub.avatarHtml, not only a name.
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/accent.mjs"` — the defect must no longer reproduce; recapture its screens (as cited above) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-5 — Default form controls in the glass bar: a native grey select and raw ISO dates

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:826`; `apps/leftovers.html:52-53`, `apps/leftovers.html:265`; `audits/screens/leftovers/add-typical-iphone-pwa-light.png`, `audits/screens/leftovers/main-typical-ipad-portrait-dark.png`
- **What happens now.** The select keeps `appearance: auto` (`apps/leftovers.html:52-53`), so it shows a native grey control that does not match its siblings, and is lighter in dark mode.
- **Why it matters.** Native controls and raw ISO dates.
- **Proposed fix.** A styled size select and friendly dates ("Mon 14 Sep · 8 days"). (Phase 3: IMP-LEFTOVERS-P3)
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-6 — The fixed add bar covers cards and the Hearth block, and the list is read through it

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:831`; `apps/leftovers.html:33-45`, `apps/leftovers.html:19`; `audits/screens/leftovers/main-typical-ipad-landscape-light.png`, `audits/screens/leftovers/add-typical-ipad-landscape-dark.png`
- **What happens now.** The bar is about 130 px of fixed `glass-strong` (`apps/leftovers.html:33-45`).
- **Why it matters.** The bar covers cards.
- **Proposed fix.** Bottom padding equals the bar height; the bar is solid material over the list.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-8 — No press scale, spring, toast or sheet: every action is an instant re-render

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:843`; `apps/leftovers.html:57`, `apps/leftovers.html:80`, `apps/leftovers.html:203-246`, `apps/leftovers.html:61`
- **What happens now.** The `:active` rules change the background only (`apps/leftovers.html:57, 85, 95`). The ✓ has transition 0s and transform none.
- **Why it matters.** No press feedback or motion.
- **Proposed fix.** .pressable on the ✓ and Log, and a finished card animates out.
- **How it will be verified.** Rerun `node "audits/tools/phase3/leftovers/critic-bar-motion.mjs"` — the defect must no longer reproduce; recapture its screens (capture area leftovers) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-9 — Two identical refresh glyphs on one screen do different things

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:849`; `apps/leftovers.html:152`; `audits/screens/leftovers/main-typical-ipad-portrait-light.png`, `audits/screens/leftovers/main-empty-iphone-pwa-light.png`
- **What happens now.** The shell top bar's reload and the Larder's Copy button both use the circular-arrows glyph (`apps/leftovers.html:152, 352`).
- **Why it matters.** Two identical glyphs do different things.
- **Proposed fix.** Copy uses a copy icon, not the refresh glyph.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.

#### VIS-LEFTOVERS-11 — The name field shrinks by 60 px when the mic appears after ready

- **Area** leftovers · **Type** visual · **Severity** low · **Effort** S · **Batch** 8
- **Evidence.** `audits/03-apps/leftovers.md:855`; `apps/leftovers.html:123`, `apps/leftovers.html:315-316`; `audits/screens/leftovers/main-loading-iphone-pwa-light.png`, `audits/screens/leftovers/main-typical-iphone-pwa-light.png`
- **What happens now.** While loading the mic is hidden (`apps/leftovers.html:123`). After ready it appears (`apps/leftovers.html:315-316`), the name field narrows, and the iPhone placeholder is cut to "Chicken alf".
- **Why it matters.** The field shrinks after load.
- **Proposed fix.** Reserve the mic's space from the start.
- **How it will be verified.** recapture its screens (as cited above) and compare; plus batch 8's checks.
#### Improvements with no finding (leftovers)

These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). The household kept all of them (`audits/05-decisions.md`, "Features kept or cut"), so each app batch carries its own.

| ID | Improvement | Kind | Delight | Effort | Source | Status |
|---|---|---|---|---|---|---|
| IMP-LEFTOVERS-I1 | Swipe to finish, plus "someone ate some": an iOS-style trailing swipe (keeping the ✓ for grandparents) and a "half left" state instead of all-or-nothing | idea | 3 | M | `audits/03-apps/leftovers.md:1046` | open |

