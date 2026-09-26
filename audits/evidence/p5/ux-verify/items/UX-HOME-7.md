<!-- audits/02-shell.md:665 · section "Home and launcher" · area shell · kind UX · rated medium -->
**UX-HOME-7 (medium; investigator only) — Kid Home is text-heavy.**
- The only one-tap entry is a text button (`index.html:1146-1156, 902-910`).
- There is no Prayer entry, although praying earns a star (CLAUDE.md, Stars & badges).
- The adult reminders take up half of the screen.
- Rating: the investigator's. The constitution requires every kid-mode flow to be completable by icons, colour and position alone (`audits/HUB-AUDIT-PROMPT.md:118-119`), and this is the kid's landing screen.
- **Owner of the kid Home facet.** This item owns kid Home's text-only "Open Kid Verse" and Reminders. PROFILES ("kid-mode shell controls are below the 64 px kid size, and several kid controls are text-only", low) and VIS ("Kid mode keeps adult-sized details", low) point here for that facet. The 56 px kid tab bar, which both of those items also list, is owned by PROFILES.
- **Hero art invisible in light mode:** owned by the Visual section ("The kid hero art is invisible in light mode", low), which measured it: 0 of 58,200 pixels change by more than 30. HOME's observation that all 5 fills in `art/hero/play.svg` are `#FFFCF8` on a pale hero (`glance-kid-ipad-portrait.png`) is extra evidence.

