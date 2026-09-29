# Phase 4 scorecard, rescored after audit batch 1 (v3 design tokens)

Independent judge. Method: `audits/04-design-system.md` lines 24-241 (shared bases + written rules TYP-1 … DEL-4, net adjustment per dimension clamped to ±2, cells 1-10 in 0.5 steps, row = mean of 11). Evidence: `audits/screens-after/1/**` (88 before/after pairs opened, 8-17 per area, light + dark, iPhone + iPad + desktop/TV; composites in `scratchpad/rescore-1/pairs/`), `audits/evidence/p6/1/measure/*.json` against `audits/evidence/p4/measure/*.json`, `audits/evidence/p6/1/p4/**` (SHAPE/analyze, TELL/tells-webkit, GLASS/opaque-blur, TYPE/code-scan), and each Batch 1 Status line in `audits/05-findings.md`. As in Phase 4, the rig paints no backdrop blur and renders fallback fonts: Typography and Shape stay provisional.

"Before" is the Phase 4 score (fe6041d). "Now" is the working tree after batches 0a-0i and 1, so fixes from 0a-0i that change a rule (the Larder's one-tap finish, the kid picture view) count too.

## 1. Previous scores and the change

| Area | Typ.* | Colour | Layout | Shape* | Icons | Motion | Dark | Native | Glance | Ease | Delight | **Average** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Shell (with the TV board) | 4.5 → 6 | 2.5 → 5 | 5 → 6 | 4 → 5.5 | 4 → 4.5 | 2.5 → 3 | 4 → 5.5 | 4 → 6 | 4 → 4.5 | 4 → 5 | 6.5 → 7 | 4.1 → **5.3** (+1.2) |
| F260 | 3 → 5 | 2 → 5 | 5 → 5.5 | 4.5 → 6 | 3 → 3.5 | 3.5 → 4.5 | 4.5 → 6.5 | 4 → 5 | 3 → 5.5 | 5.5 → 6.5 | 6 → 6.5 | 4.0 → **5.4** (+1.4) |
| Larder Ledger | 4 → 6 | 4.5 → 6.5 | 4 → 4.5 | 5.5 → 6.5 | 4.5 → 5 | 3 → 5 | 4.5 → 6.5 | 4 → 5.5 | 3 → 3.5 | 3 → 6 | 4 → 5.5 | 4.0 → **5.5** (+1.5) |
| Prayer | 4 → 5.5 | 2.5 → 5 | 4 → 5 | 4.5 → 6 | 4.5 → 5 | 4 → 5 | 4.5 → 6.5 | 5 → 6 | 3 → 3.5 | 4 → 5.5 | 6 → 6.5 | 4.2 → **5.4** (+1.2) |
| Tally counter | 4.5 → 7 | 5 → 6 | 5 → 5.5 | 4 → 5.5 | 4 → 5.5 | 4 → 4.5 | 5 → 6.5 | 5.5 → 6.5 | 6 → 6.5 | 4 → 5 | 4 → 4.5 | 4.6 → **5.7** (+1.1) |
| Kitchen timer | 6 → 7 | 4 → 6 | 5.5 → 6 | 3.5 → 5.5 | 3 → 3.5 | 4 → 4.5 | 5 → 6.5 | 5 → 6 | 5 → 5.5 | 3.5 → 5 | 4 → 4.5 | 4.4 → **5.5** (+1.1) |
| Dollywood build guide | 3 → 4 | 2 → 4.5 | 3 | 4 → 5 | 3 | 2.5 → 3.5 | 4.5 → 5 | 3 → 5 | 3 → 3.5 | 3 → 3.5 | 5 → 5.5 | 3.3 → **4.1** (+0.8) |
| Dollywood park map | 3 → 5 | 2 → 4 | 3.5 | 5 → 6 | 3.5 | 3.5 → 4.5 | 4.5 → 5 | 4 → 5 | 5 → 5.5 | 3 → 4.5 | 7 → 7.5 | 4.0 → **4.9** (+0.9) |
| Kid Verse | 3 → 6 | 2.5 → 6 | 4.5 → 5 | 4 → 5.5 | 4 → 4.5 | 4 → 5 | 4 → 6 | 5 → 6.5 | 5 → 5.5 | 5 → 6 | 5.5 → 6 | 4.2 → **5.6** (+1.4) |
| Verses | 5 → 6 | 3.5 → 4.5 | 5.5 → 6 | 4 → 5.5 | 6 → 6.5 | 4 → 4.5 | 4.5 → 6.5 | 5 → 6 | 4 → 5.5 | 4 → 5 | 5 → 5.5 | 4.6 → **5.6** (+1.0) |
| **Apps mean (9)** | 3.9 → 5.7 | 3.1 → 5.3 | 4.4 → 4.9 | 4.3 → 5.7 | 3.9 → 4.4 | 3.6 → 4.6 | 4.6 → 6.1 | 4.5 → 5.7 | 4.1 → 4.9 | 3.9 → 5.2 | 5.2 → 5.8 | 4.1 → **5.3** (+1.2) |

- **Direction.** Of 110 cells, 106 went up and 4 held (build guide Layout and Icons, park map Layout and Icons); no cell fell. No row fell. Every row is now past the midpoint between "clean but obviously a web page" (4) and "polished App Store app" (7) except the Dollywood pair.
- **Where the gain comes from.** About 0.75 of each Hearth row's gain is the re-priced shared base (below); the rest is rules that no longer apply. **Rules-only sensitivity** (bases held at their Phase 4 values): shell 4.5, F260 4.6, Larder 4.7, Prayer 4.6, Tally 5.0, Timer 4.7, Kid Verse 4.9, Verses 4.8, build guide 3.6, park map 4.4; apps mean about 4.6. The true score sits between 4.6 and 5.3 depending on how much the base re-pricing is accepted; I accept it because every base change below rests on a Phase 4 "Against" item that is FIXED and visible in the after-screens.
- **Weakest / strongest.** Weakest across apps: Iconography (4.4; icon adoption deferred to per-app batches), then Motion (4.6) and Glanceability/Layout (4.9). Strongest: Dark mode (6.1).

### The bases, re-priced (only where a Phase 4 "Against" item is FIXED and visible)

| Dimension | hearth-shared | Why | dollywood-template | Why |
|---|---|---|---|---|
| Typography* | 5 → **6** | Serif 400 titles gone: bold tracked large titles (shell/home-typical-ipad-portrait-light, shell/picker-typical-ipad-landscape-dark); Dynamic Type roles with weights (design.css:74-84); iPad tier ×1.12; text-size preference; --fs-xs and floor scale for kids; kid display rounded. Held back: faces unverifiable on WebKit/Windows; viewer-title repeat (CONS-TYPE-1 PARTIAL). | 4 → **5** | Fraunces/Archivo no longer render (type.json families: all system); 149 → 8 literal sizes; 9 px N gone. SVG labels still sub-11 (charged by TYP-1). |
| Colour | 4 → **5** | House pastels at full chroma, per-person hue families re-tuned per scheme, --muted on wells fixed, gate over every component pair. Held back: tiles and card heads still raw apps.json hex; app colour = person colour (CONS-ACCENT-2 PARTIAL). | 4 → **4.5** | Chrome on role tokens; placeholders legible. Compass N still fails (dark 3.16-3.55, light p10 1.04-1.3). |
| Layout | 6 → **6.5** | Size-class margins (shell iPad 16 → 28); column/z/breakpoint tokens. | 4 → **4** | Spacing still 0 % tokenised, 83.5 % grid; park map margins 10 px. |
| Shape* | 5 → **6** | Concentric by construction (55 → 23 bad pairs), elevation roles, one glass recipe + guard, solid content cards, glass slider with Solid = Reduce Transparency (shell/me-appearance-typical-ipad-portrait-light). Held back: viewer bar glass over flat colour. | 5 → **5.5** | Large radii on tokens 42-55 % → 92-94 %; native controls still inside glass sheets. |
| Icons | 5 → **5.5** | Duotone renders on sprites, per-icon attrs live, icon tokens, Lucide notice. No shared sprite adopted. | 4 → **4** | Text glyphs, native disclosure, literal compass all deferred. |
| Motion | 4 → **4.5** | Sheen restyle fixed (F260 scroll p95 24-26 → 18 ms), press dim added, undo toast and loading tokens. Exits still one frame, no follow-finger (CONS-MOTION-3 PARTIAL); springs not visible in stills. | 3 → **4** | :active presses 0/16 → 14/16 (guide), 2/9 → 9/9 (park); smooth scrolls honour Reduce Motion; confirm() replaced with sheet + 30 s Undo. |
| Dark | 5 → **6.5** | P2-VIS-03, P4-TELL-03, soft fills, depth ladder, person colours per scheme, switch knob, inverted toast, stale theme-color all FIXED (shell/home-typical-ipad-portrait-dark, leftovers/main-typical-ipad-portrait-dark). Held back: no dark art (plate stopgap only). | 5 → **5** | Daylight map under dark chrome unchanged. |
| Native | 6 → **6.5** | Focus rings on .ds .btn, tiles, picker cards and composer; --focus ≥ 3:1; no flash; overlay scrollbars; overscroll reset; Reduce Transparency. Held back: iOS :active needs a device check (GAP-MOTION-3). | 4 → **5** | Selectable controls 54 → 2 / 13 → 1, fields ≥ 16 px, no reachable confirm()/alert(), no OS bar in the sheet. Native selects, checkboxes, range sliders remain. |
| Glanceability | 4 → **4.5** | iPad tier and glance tokens; Home facts still ~25 px. | 4 → **4.5** | Roles reach the template (largest 31-35 px). |
| Ease of use | 5 → **6** | Text-size preference, non-hue selected tab (shell/apps-typical-ipad-portrait-dark), bounded fields (shell/chat-typical-iphone-pwa-light), shared confirm sheet. | 4 → **4.5** | Reset with confirm sheet + Undo; glyph buttons under 44 and native filters remain. |
| Delight | 5 → **5.5** | The muted palette is gone (lavender hero, butter Kids card). No dark art, no celebration primitive. | 5 → **5.5** | The palette around it is no longer muted Hearth. |

### Rules behind each new cell

| Area | Base | Typ. | Colour | Layout | Shape | Icons | Motion | Dark | Native | Glance | Ease | Delight |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Shell | h | 6 → **6** | 5 → **5** | 6.5 LAY-3½, LAY-4, LAY-5 → **6** | 6 SHP-1½ → **5.5** | 5.5 ICO-2 → **4.5** | 4.5 MOT-2, MOT-4, MOT-5 → **3** | 6.5 DRK-1½, DRK-2 → **5.5** | 6.5 NAT-2 → **6** | 4.5 GLA-5, GLA-6 → **4.5** | 6 EOU-1, EOU-2½, EOU-3½, EOU-6 → **5** | 5.5 DEL-1, DEL-2, DEL-4 → **7** |
| F260 | h | 6 TYP-2 → **5** | 5 → **5** | 6.5 LAY-1, LAY-2, LAY-5 → **5.5** | 6 SHP-2, SHP-4 → **6** | 5.5 ICO-2b → **3.5** | 4.5 MOT-2, MOT-5 → **4.5** | 6.5 → **6.5** | 6.5 NAT-2, NAT-3, NAT-4, NAT-6 → **5** | 4.5 GLA-1 → **5.5** | 6 EOU-1, EOU-5½ → **6.5** | 5.5 DEL-1 → **6.5** |
| Larder | h | 6 → **6** | 5 COL-1, COL-5 → **6.5** | 6.5 LAY-1, LAY-2, LAY-3½, LAY-4 (clamp −2) → **4.5** | 6 SHP-2 → **6.5** | 5.5 ICO-4 → **5** | 4.5 MOT-5 → **5** | 6.5 → **6.5** | 6.5 NAT-3 → **5.5** | 4.5 GLA-3 → **3.5** | 6 → **6** | 5.5 → **5.5** |
| Prayer | h | 6 TYP-2, TYP-5 → **5.5** | 5 → **5** | 6.5 LAY-1, LAY-2, LAY-3½ → **5** | 6 SHP-2, SHP-4 → **6** | 5.5 ICO-4 → **5** | 4.5 MOT-2½, MOT-5 → **5** | 6.5 → **6.5** | 6.5 NAT-2, NAT-3½, NAT-6 → **6** | 4.5 GLA-3 → **3.5** | 6 EOU-1, EOU-2½, EOU-6 → **5.5** | 5.5 DEL-1 → **6.5** |
| Tally | h | 6 TYP-4 → **7** | 5 COL-1 → **6** | 6.5 LAY-2, LAY-4 → **5.5** | 6 SHP-1½ → **5.5** | 5.5 → **5.5** | 4.5 → **4.5** | 6.5 → **6.5** | 6.5 → **6.5** | 4.5 GLA-2 → **6.5** | 6 EOU-6 → **5** | 5.5 DEL-3 → **4.5** |
| Timer | h | 6 TYP-4 → **7** | 5 COL-1 → **6** | 6.5 LAY-2 → **6** | 6 SHP-1½ → **5.5** | 5.5 ICO-3b → **3.5** | 4.5 → **4.5** | 6.5 → **6.5** | 6.5 NAT-2 → **6** | 4.5 GLA-1 → **5.5** | 6 EOU-3 → **5** | 5.5 DEL-3 → **4.5** |
| Build guide | d | 5 TYP-1 → **4** | 4.5 → **4.5** | 4 LAY-3 → **3** | 5.5 SHP-4 → **5** | 4 ICO-3 → **3** | 4 MOT-2½ → **3.5** | 5 → **5** | 5 → **5** | 4.5 GLA-3 → **3.5** | 4.5 EOU-5 → **3.5** | 5.5 DEL-2, DEL-3 → **5.5** |
| Park map | d | 5 → **5** | 4.5 COL-4 → **4** | 4 LAY-3½, LAY-4, LAY-5 → **3.5** | 5.5 SHP-2 → **6** | 4 ICO-4 → **3.5** | 4 MOT-5 → **4.5** | 5 → **5** | 5 → **5** | 4.5 GLA-4 → **5.5** | 4.5 EOU-1, EOU-2 → **4.5** | 5.5 DEL-1, DEL-2 → **7.5** |
| Kid Verse | h | 6 → **6** | 5 COL-1 → **6** | 6.5 LAY-2, LAY-3 → **5** | 6 SHP-1½ → **5.5** | 5.5 ICO-2 → **4.5** | 4.5 MOT-5 → **5** | 6.5 DRK-5 → **6** | 6.5 → **6.5** | 4.5 GLA-4 → **5.5** | 6 → **6** | 5.5 DEL-1, DEL-4 → **6** |
| Verses | h | 6 → **6** | 5 COL-2, COL-5 → **4.5** | 6.5 LAY-2 → **6** | 6 SHP-1½ → **5.5** | 5.5 ICO-1 → **6.5** | 4.5 → **4.5** | 6.5 → **6.5** | 6.5 NAT-2 → **6** | 4.5 GLA-1 → **5.5** | 6 EOU-5 → **5** | 5.5 → **5.5** |

Policy calls made (stated so they can be overruled):
- **LAY-1 not applied to the kid ×1.25 spacing scale.** SHAPE/analyze now puts Kid Verse's macro spacing at 50.7 % on the 4 px grid (was 98.4 %), Tally 74 % (100 %), Verses 93.9 %, shell 93.8 %. Every new off-grid value is an exact 1.25× of an on-grid token (5, 10, 15, 25, 30 from `--space-k: 1.25`, design.css:587), the kid scale Phase 4's own proposal specified. Applied literally, Kid Verse Layout 5 → 4 and Tally 5.5 → 5 (rows 5.5 and 5.7).
- **TYP-2's "15 or more distinct sizes" is read from the code (code-scan), not the rig**, as Phase 4 did: the ×1.12 iPad tier and text size multiply rendered sizes (shell 16 → 34, F260 27 → 66 in type.json) without any literal being added.
- **SHP-1 halved** where the only live glass left on content is a secondary in-flow button (Tally and Timer Reset, Kid Verse and Verses Read aloud), per the halving policy ("only secondary controls").
- **GLA-1 for F260 and Verses** rests on size, not a re-measure: the key fact is now `--fs-glance-2` (64-72 px on the iPad; type.json), and Phase 3's own figure (44 px ≈ 1.5 m) puts 64 px at about 2.2 m. The batch did not re-run the glance script (UX-F260-12, UX-VERSES-7 notes).
- Rules whose Phase 4 reason is not recorded per area and for which no fix exists (shell EOU-6, Prayer EOU-6, Tally EOU-6, Verses EOU-5, build guide MOT-2½, DEL-4) are kept.

## 2. Per area: which rules changed and why

**Shell (with the TV board)** 4.1 → 5.3
- COL-2 and COL-4 lifted: Me → Switch now dark ink on a periwinkle pill (shell/me-typical-iphone-pwa-dark.png), dark hero passes (shell/home-typical-ipad-portrait-dark.png), gold heads fixed; shell failing text 4.1-5.9 % → 1.0-1.5 %, the rest disabled/loading. The card-head and tile icons still paint raw apps.json hex, now failing only in dark (1.87-3.22, P4-ICON-01 PARTIAL; shell/apps-kid-typical-ipad-portrait-dark.png, shell/home-typical-iphone-pwa-dark.png) → moved to DRK-2 (−½); DRK-1 halved (only the feed's person-hue names at 4.31 in dark remain).
- NAT-1 lifted (confirm sheet replaces native dialogs, CONS-TELL-2), NAT-4 lifted (Home skeletons, shell/home-loading-ipad-portrait-light.png); SHP-3 lifted (single recipe, guard fixed); LAY-2 lifted (iPad margins 28, shell/home-typical-ipad-portrait-light.png); TYP-3 lifted (numerals tabular). MOT-2 and MOT-4 stay (Home still moves 313/418 px on a slow pull; Apps-grid replay and viewer-exit are batch 2a); GLA-6 stays (TV info text still kiosk 18-22 px, tv/board-typical-tv-light.png).

**F260** 4.0 → 5.4
- COL-2, COL-3, COL-4 lifted: failing text 60.6 % (Hearth) → 0.1 %; person accent reaches Done, ring and progress; empty cells outlined (f260/today-typical-iphone-pwa-light.png, f260/behind-typical-desktop-light.png).
- TYP-1½ and TYP-3 lifted (no text under 11 px; tabular numerals); TYP-2 stays (56 role tokens vs 68 px×--ts clamps). GLA-3 lifted and GLA-1 earned: "Acts 6" is 64-72 px on the iPad (f260/today-typical-ipad-landscape-light.png).
- DRK-4, MOT-3, SHP-3, NAT-5 lifted. MOT-2 stays (week stepper 317/514 px), NAT-4 stays (loading shows "of 260 readings" with no number, f260/today-loading-iphone-pwa-light.png), NAT-3 stays (native "Show passcode" checkbox, f260/journal-typical-iphone-pwa-dark.png), ICO-2b stays.

**Larder Ledger** 4.0 → 5.5
- COL-1 earned (0 failing text in all seven theme keys) on top of COL-5; DRK-3 lifted (chips keep their pill in dark, green ✓ wells: leftovers/main-typical-ipad-portrait-dark.png); TYP-2 lifted (every size a role).
- 0h + batch 1: EOU-6 and DEL-3 lifted, MOT-5 earned (✓ finishes in place with Finished + Undo + toast, leftovers/finished-typical-iphone-pwa-light.png); EOU-3 lifted (kid picture view, no controls, leftovers/kid-typical-ipad-portrait-light.png); MOT-2 lifted (landmark move 363/472 px → 0); NAT-4 lifted (skeleton cards, leftovers/main-loading-iphone-pwa-light.png); NAT-2 lifted (0 selectable, 0 draggable).
- Still: LAY-1 (45.8 %), LAY-2 (560 px column, leftovers/main-typical-ipad-landscape-light.png), LAY-3½ (add bar over the list), NAT-3 (native size select and date field), GLA-3.

**Prayer** 4.2 → 5.4
- COL-2 and COL-4 lifted: Kitchen headings now pass (prayer/kitchen-typical-ipad-portrait-dark.png), gold labels/pill/done titles fixed; failing text 7.6 % → 0.6 %, the rest disabled Save or loading dim.
- EOU-4 lifted (Today tab is a filled pill, prayer/today-typical-ipad-landscape-light.png); SHP-3 lifted (FAB no longer opaque under blur; veil `--scrim-blur` 0); TYP-3 lifted (Manrope/Instrument Serif gone, tabular numerals); NAT-4 lifted (designed "Loading your prayer list…" state, prayer/today-loading-iphone-pwa-light.png); DRK-3 lifted; MOT-2 halved (Pray now moves 53-97 px).
- Still: TYP-2 (63 px×--ts clamps, 5 tokens), LAY-1/LAY-2 (33rem column), SHP-4 (radii 50 % on tokens), GLA-3 (key fact about 34 px on the iPad).

**Tally counter** 4.6 → 5.7
- TYP-3 lifted and TYP-4 earned: count in rounded tabular numerals at 162-180 px (tally/main-typical-ipad-portrait-light.png); ICO-3 lifted (+/− are 1.75 SVGs); NAT-4 lifted (skeleton in the dial instead of a false 0, tally/main-loading-iphone-pwa-light.png).
- SHP-1 halved: dial and discs are solid, only Reset to zero is still glass (glass.json content: button#reset only). Dark discs now glow in the person's hue (tally/kid-typical-ipad-portrait-dark.png).
- Still: LAY-4 (the "EZRA'S COUNTER" pill sits on the dial's top edge in kid landscape, tally/kid-typical-ipad-landscape-light.png), LAY-2, EOU-6, DEL-3.

**Kitchen timer** 4.4 → 5.5
- COL-1 restored: time's up now pulses by scale (timer.html:62-65), no dim phase; the person-coloured arc is lifted per scheme (timer/running-typical-ipad-portrait-dark.png, timer/done-typical-ipad-landscape-light.png); Timer-owned failures are loading-state only.
- EOU-4 lifted (selected preset is a solid fill, timer/running-typical-ipad-portrait-light.png); SHP-4 lifted (Start is a capsule); SHP-1 halved (dial solid); NAT-4 lifted (skeleton digits).
- Still: ICO-3b (no icon on any control), EOU-3 (kid presets are text "5 min", timer/kid-typical-ipad-portrait-light.png), NAT-2 (header art draggable), DEL-3.

**Dollywood build guide** 3.3 → 4.1
- COL-2 and COL-3 lifted (failing text 27.9 % → 0.2-0.5 %); DRK-4 lifted; SHP-3 lifted (steps sheet 0.96 → 0.8 alpha); NAT-4 lifted (no false 0/9 counts while loading, dollywood/map-loading-ipad-portrait-light.png); NAT-5 lifted.
- Still: TYP-1 (SVG section labels about 6.8 px at the far zoom, TYPE/hidden-text), LAY-3 (map below the fold; now further down on iPad, see §3), ICO-3 (toolbar text-only on iPad/desktop, dollywood/map-typical-ipad-portrait-light.png), SHP-4 (tabs r0), GLA-3, EOU-5.

**Dollywood park map** 4.0 → 4.9
- COL-2 and COL-3 lifted (walk times no longer raw person hex; failing text 36 % → 1.8 %); TYP-1 lifted (9 px N and 9.5 px MIN gone); EOU-3 lifted (kid controls all ≥ 64 px: handle 64, north 73, dollywood-live/kid-typical-iphone-pwa-light.png); DRK-4 lifted; SHP-3 lifted (north no longer opaque, ride card no longer three blurs).
- Still: COL-4 (91 of 104 information dots under 3:1, unchanged), EOU-2 (16 adult selectors under 44: sheet handle 22 px, About 29, mode chips 32), LAY-4 (family labels collide with the meet label, dollywood-live/kid-typical-iphone-pwa-light.png), ICO-4, the compass N in the template base (dark 3.16-3.55).

**Kid Verse** 4.2 → 5.6
- TYP-1, TYP-3, TYP-6 lifted: 16 px kid floor, rounded 900 star count, bold rounded verse ref (kidverse/kid-typical-ipad-landscape-light.png, kidverse/kid-stars-typical-iphone-pwa-light.png).
- COL-2 and COL-4 lifted and COL-1 earned: day-dot letters and today ring now pass (kidverse/kid-stars-typical-iphone-pwa-light.png); 0 failing text in five theme keys, the rest loading-dim.
- DRK-3 lifted (unearned badges readable, kidverse/kid-story-typical-ipad-portrait-light.png), MOT-2½ lifted (CLS 0.073/0.163 → 0), NAT-2 and NAT-4 lifted (art not draggable; "Getting your stars…" loading, kidverse/kid-loading-ipad-portrait-light.png), SHP-1 halved (scene solid, Read it to me still glass). Still: LAY-3 (Done ★ below the fold in iPad landscape), DRK-5 (story art is a dimmed pale plate in dark, kidverse/kid-typical-ipad-portrait-dark.png), ICO-2 (★ glyphs, 24 → 26).

**Verses** 4.6 → 5.6
- DRK-3 lifted (Not yet/Almost fills and low-box bars visible in dark, verses/revealed-typical-ipad-portrait-dark.png); NAT-4 lifted (verses/trainer-loading-iphone-pwa-light.png); SHP-1 halved (trainer and done cards solid, verses/trainer-typical-ipad-portrait-light.png); GLA-1 earned (reference at the glance size on the iPad).
- COL-2 stays: "Got it" is white on a sheen-lifted green at **4.34:1** at 20 px/600 on the desktop in light (failing-pairs/verses.json, devices/verses/revealed-typical-desktop-light), although VIS-VERSES-3 is marked FIXED (verses/revealed-typical-desktop-light.png). Still: LAY-2, EOU-5, NAT-2.

## 3. What got worse

1. **Build guide, iPad portrait: the hero's fourth stat wraps.** "1535×2212" now sits alone on a second row (bold display numerals at the iPad tier), making the hero about 58 px taller and pushing the map further below the fold. `audits/screens-after/1/dollywood/map-typical-ipad-portrait-light.png` (also `map-loading-ipad-portrait-light.png`). Already inside LAY-3, so no extra deduction.
2. **Macro spacing off the 4 px grid** (kid ×1.25 scale): Kid Verse 98.4 → 50.7 %, Tally 100 → 74 %, Verses 98.6 → 93.9 %, shell 99.7 → 93.8 %, Timer 100 → 92.3 % (`audits/evidence/p6/1/p4/SHAPE/analyze.json`). Not scored (see policy), but it is a literal regression of a Phase 4 metric.
3. **Shell radii on tokens fell**: adult large 87.5 → 79 %, kid 85.2 → 61 %; the TV board's off-concentric pairs rose 3 → 8 (kiosk ×1.5 radii) (`SHAPE/analyze.json`).
4. **F260 journal in dark: the New Testament paper tint stops part way down**, leaving a black band below the content. `audits/screens-after/1/f260/journal-typical-iphone-pwa-dark.png`. Cosmetic.
5. **Me → Notifications on the iPhone**: the switch now wraps under the description instead of sitting trailing, as iOS places it. `audits/screens-after/1/shell/me-notifications-typical-iphone-pwa-light.png`. Cosmetic.
6. **Profile picker**: "Downstairs TV" wraps to two lines at the new type size, so its card is taller than its row. `audits/screens-after/1/shell/picker-typical-ipad-landscape-dark.png`.
7. **Larder text glyphs as icons rose**: the status chips gained ×, ! and ✓ glyphs (ICON/static: ✓ 5 → 7). `audits/screens-after/1/leftovers/main-typical-ipad-landscape-light.png`. Phase 4 did not charge ICO-2 to the Larder for its ✓ glyphs, so no deduction was added, for consistency.
8. **Measured counts that rose** (heuristic, not verified by eye): Prayer information-graphic failures 2,594 → 3,128 (dots 2,988, rings 140), control-boundary failures in the shell 673 → 717, Prayer 1,491 → 1,679, TV 10 → 21 (`measure/nontext.json`).

Not worse, but contradicts a FIXED status: Verses "Got it" 4.34:1 (above); the TV kiosk Me screen still shows section titles with no cards over the photo, before and after (`tv/me-kiosk-typical-tv-light.png`).

## Not checked

Real-device blur, SF faces, iOS :active presses, spring motion and exits (stills only); readable distances (inferred from px); every profile colour beyond the rig's; the Phase 4 per-area reasons for shell/Prayer/Tally EOU-6, Verses EOU-5, build guide MOT-2½ and DEL-4 (kept as is).
