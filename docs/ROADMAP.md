# House Hub roadmap

> Agreed 2026-09-17 in a review session. Goals: one polished product · every screen glanceable in 3 seconds · kids use their part unassisted · adults never re-enter anything on a second device · the visual fidelity of Hearth mixed with glassy modern iOS, illustrations + family photos, rich-but-calm motion.
>
> Hearth already covers groceries, meals, kid routines/chores and the calendar, so those stay out of the hub. Sequencing: trip first → visual foundation → daily use (each with its visual pass) → kids and the TV. Items are built only when explicitly asked for; each one ends with its acceptance criteria met, tests extended, and the live site verified.


Legend — **A** adults (Eli, Christian, Elizabeth, David, Mea) · **K** kids (Ezra, Kiara) · **TV** kiosk · **E** Eli/admin. Effort: QW < 1 h · M ≈ an afternoon · B multi-session.

## Sprint 0 — before the Dollywood trip

**1. Dollywood gating & privacy** (QW · K, A) — `apps.json`, `apps/dollywood-live.html`, `index.html`
- Build guide `visibleTo` = the 5 adults. Park map visible to all, but kid/kiosk get **view-only**: no GPS watch, no `hub.set('loc:…')`, no free-text Google/YouTube search in ride popups.
- Adults: explicit **"Share my spot"** toggle (default off, person scope), never auto-started; `hub.remove('loc:…')` when off. `allow="geolocation; screen-wake-lock; …"` on the iframe.
- AC: as Ezra the map shows rides + family markers, no search box, never prompts for location; as Eli the marker disappears within 30 s of switching sharing off.

**2. Park map ready for the day** (M · everyone) — `apps/dollywood-live.html`, `sw.js`
- Precache the map; move the four base64 layers to `apps/dollywood/*.jpg|png` loaded on demand; remove the dead 3D remnant; throttle label redraw to zoom-end; GPS only while visible; "Where's everyone" panel with last-seen times, stale > 4 h greyed, tombstoned after 24 h.
- AC: loads offline after one online open; mobile Lighthouse perf ≥ 80; two phones see each other within 30 s; no GPS when closed.

## Sprint 1 — visual foundation (the "one polished product" work)

**3. Design system v2 — `apps/design.css`** (B · everyone)
- **Direction:** Hearth fidelity × glassy iOS. Tokens: three surface layers (base paper → elevated glass with `backdrop-filter` + 1 px inner hairline → floating), semantic roles (`--ink/--ink-2/--ink-3`, `--tint` per person, `--ok/--warn/--danger/--info` with soft variants), elevation scale (`--e1…--e4`, tinted shadows), radius scale (16/22/28/full), spacing on a 4 px grid, type scale with **display serif for headlines + `ui-rounded`/SF-rounded sans for UI** (system fonts only; Prayer keeps its web fonts), motion tokens (`--spring`, `--ease-out`, 120/220/360 ms), density tokens for desktop, full dark palette with real depth (not just inverted).
- **Components (inside `.ds`):** glass cards and hero cards with an illustration slot, stat rings/bars with animated fill, chips and person chips (avatar + colour), list rows with leading art, bottom sheets with grabber + snap points, segmented controls, glass tab bar and glass top bar, toasts, skeletons and illustrated empty states, buttons in three weights with pressed spring.
- Desktop: `@media (min-width: 1024px)` layouts — sidebar navigation instead of the bottom tab bar, 2–3 column grids, max content width 1200, the app viewer as a framed canvas with a side rail.
- AC: `docs/design.html` style guide page renders every token/component in light and dark; every hub surface uses tokens only (no hex in `index.html`); WCAG AA contrast on all text; reduced-motion honoured.

**4. Hub shell redesign — `index.html`** (B · everyone)
- **Home:** time-of-day hero (greeting, date, soft gradient + illustration that changes morning/afternoon/evening), then editorial cards with art: Today's reading (book art, animated ring), Fridge (freshness bars), Prayer (faces), Reminders, Family map on trip days, Activity feed with photo/emoji avatars and person colours. Pull-to-refresh with a custom indicator.
- **Apps:** icon tiles with the illustrated icon set (item 5), wide tiles as mini-dashboards, spring press feedback.
- **Chat:** glass composer, avatar bubbles, chips styled as receipts, typing indicator.
- **Me:** profile hero (photo/emoji on person-colour gradient), grouped settings in glass sections, admin as a proper table on desktop.
- **Navigation & motion:** glass tab bar with sliding indicator; app open = scale-from-tile transition with the tile's colour as backdrop; sheet physics; haptics via `navigator.vibrate` where available; skeletons → content without layout shift.
- **Gate:** pairing/profile picker as a full-bleed welcome (illustrated background, large avatar cards with photo rings, PIN pad glass).
- AC: screenshots at 390×844 / 1024×1366 / 1440×900 light+dark for Home, Apps, Chat, Me, picker, kid Home, kiosk — reviewed against the style guide; Lighthouse perf ≥ 90 mobile; zero CLS on load.

**5. Illustration & icon set — `art/`** (M · everyone)
- Illustrated app icons (duotone with person-tint support), hero illustrations per app and per time-of-day, per-week story art for the kid verse (item 15), empty-state spot illustrations, TV ambient backdrops. All SVG, hand-drawn style in the sand/mocha palette; PNG fallbacks for `apple-touch-icon`.
- AC: every tile and every Home card has art; `sw.js` precaches the set; total ≤ 600 KB.

**6. Profile visuals & photos** (M · everyone) — Worker (new R2 binding), `index.html`, Me tab
- Photo avatars uploaded from Me (Worker route → R2, 256/1024 variants), person-colour ring, emoji-on-gradient fallback; family-scope album for the TV and prayer faces.
- AC: upload from an iPhone works; avatar shows in picker, feed, prayer rows, chat within one pull on every device.

**7. Preferences follow the person** (QW · A, TV) — `hub.js`, `f260.html`, `prayer.html`, `tally.html`
- Theme, F260 text size/autolock → person scope; kiosk gets "This screen only looks" toasts instead of silent drops/crashes.
- AC: Dark on the iPad → dark on the iPhone; kiosk tap leaves a reading unchecked with the toast.

**8. Housekeeping** (QW · maintainer)
- `sw.js`: bump VERSION, prune unused icons, add maskable icon + park map, add `scripts/bump-sw.mjs`; delete legacy `/items` + `HOUSE_KEY`, `beaconFlush`, `liveItems` import, `K.theme`, `prayer-icon*.png`, `migrate-leftovers.sql`; fix `hub.migrate` marking; refresh or delete `docs/INVENTORY.md`; `.gitignore` the stray root files.
- AC: all scripts (`smoke-api.sh`, `test-hub.mjs`, `test-apps.mjs`, `check.js`) green; `git status` clean.

## Sprint 2 — daily use, each with its visual pass

**9. Timer that survives navigation** (QW · everyone) — countdown in the shell (`timer.active` person scope), glass pill on every tab, beep + notification from the shell; Timer app = big glass dial. AC: start 1 min, leave the app, it beeps at 0 with the app closed and shows on a second device.

**10. F260 opens on Today** (M · A) — hero (next reading, 60 px Done, animated ring + streak, book art) above the fold; dashboards below; session-only `view`; in-place merge instead of reload; typography and cards on the v2 tokens (its own component CSS stays, restyled). AC: cold open shows Done at 390×844 without scrolling; Home card + tile update within 5 s.

**11. Prayer: primary action + visual alignment** (M · A) — "Pray now" primary; Print/Copy/Kitchen into overflow; delete sample data, stale warning, in-app theme chips; glass nav and v2 type scale while keeping its palette. AC: "Pray now" above the fold; empty profile has an illustrated empty state; `check.js` green.

**12. Larder Ledger list-first** (QW · A) — grouped list first (freshness bars, food art), sticky glass add bar (name + mic + Log), fixed midnight date, keep "Copy for Hearth". AC: oldest item + chip visible without scrolling at 390×844.

**13. Home widgets round 2** (M · everyone) — Prayer "N to pray · M done", Family map on park days, Kids' stars, richer feed. AC: cards render from cache instantly, one line of secondary text on phone.

**14. Chat tools round 2** (M · A, K) — `mark_prayed`, `answer_prayer`, `finish_leftover`, `where_is_family`, `f260_status`, kid `read_todays_verse` spoken via SpeechSynthesis. AC: `smoke-chat.sh` extended; chips + activity; kid restrictions hold.

**15. Push round 2** (M · A) — weekly "N days behind" (Sun 8 pm), new family prayer → adults, park-day child-marker-stale alert; toggles in Me. AC: each demonstrable via `/api/admin/cron/run` + the stand-in receiver; opt-outs honoured.

## Sprint 3 — kids and the TV

**16. Kid verse of the day + stars** (M · K) — new `apps/kidverse.html`: story art, big verse, "Read it to me" (SpeechSynthesis), "Done ★"; person-scope weekly stars; kid Home shows stars; small confetti on ★ (calm). AC: Ezra completes it with no reading; stars survive device switch; adults see "Ezra ★3".

**17. Kid F260 companion** (B · K, A) — per-week 2-line retelling + art tied to the adult reading; parents' F260 shows "Kids: Ezra 2/5". AC: story matches the week; completion posts to the feed.

**18. Family prayer with faces** (B · everyone) — photo/emoji cards, kid mode of the family list (big "Pray for Grandma 🙏" cards, tap = prayed), avatar who-prayed. AC: Kiara can pray on the family list only; her avatar appears on adults' lists.

**19. Memory-verse trainer** (B · A, K) — new `apps/verses.html`, Leitner over `f260.mem/verses/recall`, read-aloud, kid verses in kid mode. AC: due-today queue; writes back to `f260.recall`; Home card streak.

**20. Stars & badges** (B · K) — hub-native rewards for verse/story/prayed only; badges; parent cash-in/reset in Me. AC: rules in CLAUDE.md; totals visible to kids, adults, TV.

**21. TV glue board** (B · TV) — kiosk Home = ambient photo backdrop (blurred, slow crossfade) · clock · adult + kid verse · who prayed today · streaks · feed · stars; reminders off by default (Hearth shows them); large type, no interaction. AC: 24 h unattended without memory growth; nothing editable.

**22. Build-guide sync** (M · E) — hub.js person scope for progress/plot/theme, `hub.migrate` from localStorage, drop the private theme toggle. AC: tick on PC → ticked on iPad.

**23. Guest profiles on demand** (M · A) — `worker/src/index.js`, `worker/seed.sql` (no change), `index.html` Me/admin, picker
- Any adult creates a guest from Me → "Add a guest": name, a **choosable picture icon** (emoji grid, the illustrated avatar set from item 5, or a photo from item 6), colour; kind `adult` (full app access, never admin), PIN optional (guest can skip the PIN), optional expiry (tonight / a week / keep); appears in the picker on every paired device within one pull. Admin can remove guests; expired guests are hidden and their person-scope data kept 30 days then deleted.
- Endpoints: `POST /api/profiles` (adult token) creates a profile with `is_guest`, `created_by`, `expires_at`; `DELETE /api/admin/profiles/:id`; profiles list carries `is_guest`/`expires_at`; login skips `needs_pin_setup` for guests with no PIN.
- AC: Mea adds "Aunt Sue" with a chosen icon on the iPad; Sue signs in on Eli's phone without a PIN and can use F260/Prayer/Larder/chat like any adult; after expiry she is gone from the picker and Eli's admin panel can purge her data.

## Parked
Shared grocery list · weekly meal plan · kid chore routines (Hearth owns these) · named multi-counter Tally.

## Verification (every item)
Extend `scripts/test-apps.mjs` screenshots (390×844, 1024×1366, 1440×900; light/dark; adult/kid/kiosk) and the matching smoke scripts; Lighthouse mobile perf ≥ 90 on the shell; deploy = `git push` + `npx wrangler deploy` + `sw.js` VERSION bump; Eli's real-device checks (iPhone Home Screen, push test, park-day GPS).
