# Household decisions (2026-09-25)

The owner's answers to D1-D18 (`04-design-system.md`, "Decisions for the household") and P5-D1-D9 (`05-findings.md`, "Decisions for the household"), plus the other review items. Where an answer differs from the recommendation, the change to the plan is stated. These answers override the recommendations in both reports.

## Design (D1-D18)

| # | Decision | Answer | Change to the plan |
|---|---|---|---|
| D1 | System's day look | **Hearth**, warm (#F4F1EC, white cards) | none |
| D2 | Graphite theme | **Add as a choice** in Me; System stays Midnight at night | none |
| D3 | Who gets which colour | **The alternative set**: Eli periwinkle, Mae peach, Elizabeth bubblegum, David mint, Mea butter, Ezra aqua, Kiara lavender, TV graphite | Re-point the accent map, the profile `hue` seed and the preview's Accents section |
| D4 | Guests' colour | **Guests share whatever hue is left** (lavender is Kiara's; under D3 the free hue is **sky**); duplicates allowed, face + name tell guests apart | Guest default is sky, not lavender |
| D5 | App tile hues | **Separate app hues**: nine in-between pastels (for example a coral between peach and bubblegum, a teal between aqua and sky), one per app, none shared with a person | New app hue families in the token proposal, each passing the same gate as the people hues in all six palettes, light and dark; shown in the preview for approval before batch 1 |
| D6 | Large titles | **Bold system titles**; serif only for adults' reading text; kid mode rounded | none |
| D7 | Body text | **17 px, 19 px on the iPad**; text size S for the old density | none |
| D8 | Glass | **A four-level setting**: Clear (under 50 % opaque), Current (today's 62-66 %), **Frosted (78-80 %, the default)**, Solid (Reduce Transparency). The rest of D8 (fainter dark sheen, the person's colour in the pane) as recommended | New glass-level tokens and a person preference; Clear needs a text safeguard (scrim or shadow) and its own legibility check; the Reduce Transparency switch of D11 is the Solid level |
| D9 | Icon corners | **0.225** (iOS) | none |
| D10 | Celebration spring | **Celebrations, for everyone** (340 ms, 9 % overshoot) | none |
| D11 | Accessibility switches | **Add them** in Me → Appearance, per person | Glass switch is the four-level control of D8 |
| D12 | Park-map colours | **Documented cartography exemption** | none |
| D13 | Prayer's Google Fonts | **System fonts**; the grandfathered exception is retired | none |
| D14 | Forest's gold | **Keep the gold** | none |
| D15 | Dark primary buttons | **Glowing pastel capsule** with a dark label | none |
| D16 | TV type scale | **Re-lay out the TV now and turn on the 10-foot scale in batch 2c**, gated by `test-tv.mjs` and the 1920 × 1080 fit check | 10-foot scale becomes the TV default in 2c, not opt-in |
| D17 | F260 text size | **One hub-wide text size**; `f260.big = true` migrates to Large once | none |
| D18 | TV crossfade | **Allow 2.5 s** as the one ambient exception | none |

## Phase 5 (P5-D1-D9)

| # | Decision | Answer | Change to the plan |
|---|---|---|---|
| P5-D1 | Token proposal base | **Keep the synthesis as built** | none |
| P5-D2 | Kids in the Larder | **Read-only picture view**; server refuses kid writes | none |
| P5-D3 | Chat writes | **Act at once, Undo on the chip for 30 s** | none |
| P5-D4 | PIN reclaim | **One-time code**, valid 24 h | none |
| P5-D5 | Idle return on the Kitchen iPad | **Replaced: a shared Kitchen mode for that iPad, with no personal sign-ins.** Details below | New work, see "Kitchen device" |
| P5-D6 | Tally's Reset | **Undo toast**, smaller ↺ away from + | none |
| P5-D7 | Kids' notifications | **Off**: kids cannot subscribe | none |
| P5-D8 | Guests' rights | **Apps, not household**: no kids' beacons, no family week, no household pushes | none |
| P5-D9 | "Timer done" on a locked phone | **Server push at endAt** (Worker alarm) | none |

### Kitchen device (replaces P5-D5)

- **What it is.** A second shared profile kind beside the TV kiosk. It is **not read-only**: full use of the family-shared apps (Larder, the family prayer list, Timer, Tally, family reminders, the photo board). Nothing personal: no F260, Verses, private prayers, Me settings, admin or chat.
- **Who gets credit.** An action that credits a person (Prayed, finishing a food) first shows a row of family faces to tap, **no PIN**. It is attribution, not a sign-in. A kid tapping their face on "Prayed" earns that day's prayer ★ as usual.
- **How it is set.** Eli marks a paired device as Kitchen in Me → Admin → Devices. That device never shows the profile picker. Only Eli, with the admin PIN, from the admin panel, can change it back.
- **Plan impact.** It needs:
  - an additive migration: the device role, and the kitchen profile kind;
  - Worker rules: kitchen sessions may write family scope only, the attribution is checked against the household, and Kid Verse's prayer credit reads the attributed name;
  - shell work: no picker, no Me tab, and the face-tap sheet;
  - tests, in the style of `test-hub.mjs`: kitchen writes family data, cannot read or write person scope, and credits the tapped person.
- **Where it goes.** The data and server half joins batch 0d (security: server-side kind rules). The shell half joins batch 2a, and supersedes that batch's idle-return fix.

## Features kept or cut

- **Kept:**
  - Timer: second and custom timers, and a repeating alarm (6).
  - Named Tally counters (11).
  - Park arrive/leave alerts (10).
  - Larder use-by dates (8).
  - Pray reminders (3 / 2b).
  - The extra Home cards: Tally, Timer, Verses, build guide.
  - All 15 improvements with no finding.
  - Clear chat history (2b).
  - A mic on Home reminders (2a).
  - Search of answered prayers (3).
  - The Kid Verse week advancing by itself, with a feed line (7).
  - Ride wait history (10).
  - Park hours, showtimes and dining (10; needs a data source).
  - Better park offline (10).
  - Tally history, steps and sound (11).
- **Cut:** GAP-DOLLYWOOD-2, the read-only build view for other adults. It was not ticked.
- **Kept as fixes, not asked:**
  - change-my-PIN;
  - admin household management;
  - F260 catch-up for missed readings;
  - Verses verse text;
  - the build guide's 3D current step;
  - the `pushsubscriptionchange` handler and the manifest;
  - the design-system gaps in batch 1.

## Other items

| Item | Answer |
|---|---|
| App batch order | **As planned**: Prayer → F260 → Verses → Timer → Kid Verse → Larder → build guide → park map → Tally |
| Production DB backups | **Pre-approved**: Claude runs the read-only `npx wrangler d1 export house-hub --remote` at the start of each data batch (0b-0g, 1, and the Kitchen migration), checks the file and keeps it local and git-ignored |
| Unverified UX/VIS/CONS/GAP severities | **Verify the high and medium ones** with two skeptics before Phase 6; low items go in as rated |
| Uncommitted `docs/screens` PNGs (17) | **Discarded** (restored to the committed versions) |
| CLAUDE.md | **Updated in the same commit as each change** that makes a line untrue |
| The 17 minor token issues | **Folded into the proposal rework** for D3/D4/D5/D8, followed by the contrast gate and browser check |
| Design preview | **Rebuild with these answers, re-verify, recapture, then the owner approves** before Phase 6 |
| Phase 6 cadence | **One batch per turn**: commit, verify, report, wait for "next" |

## Before Phase 6 can start

1. Rework the token proposal (`audits/tools/phase4/tokens/`) for D3, D4, D5 and D8, and settle the 17 minor issues. Re-run `contrast.mjs` and `browser-check.mjs`.
2. Rebuild `audits/design-preview.html`: the new people map, the app hues, and the four glass levels. Recapture into `audits/screens-preview`, rebuild the sheets and send them to the owner.
3. Two-skeptic verification of the high and medium usability, visual, consistency and gap items. Update the severities in `05-findings.md` through `build-findings.mjs`.
4. Add the Kitchen device work to `plan-batches.mjs` and the fix files, and cut GAP-DOLLYWOOD-2. Rebuild `05-findings.md`.
5. The owner approves the rebuilt preview. Phase 6 then begins with batch 0a.
6. Device checks for the owner, on the Kitchen iPad, an iPhone and the TV:
   - the preview, looking at real blur and fonts;
   - push, keep-awake, and the Timer beep on iOS.
