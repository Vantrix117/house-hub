<!-- audits/02-shell.md:587 · section "Home and launcher" · area shell · kind VIS · rated medium -->
**VIS-HOME-1 (medium; investigator only) — The Apps grid uses one size everywhere: 48 px icon, 29 px glyph, 12 px label.**
- On the phone, 4 columns at a 103 px pitch matches iOS density, so "tiles too big on the phone" is refuted for this grid in pitch terms. What looks big is the card chrome around a 29 px glyph, about half the size of an iOS icon.
- Tiles with 2-line labels are 91×102, although the comment at `index.html:217` says squares stay square (`layout.json` tiles.nonSquare).
- The iPad gets the phone's icon size, and its tiles shrink from 118 px to 98 px when it turns to landscape.
- Evidence: `density-apps-iphone-pwa.png`, `density-apps-ipad-landscape.png`, `index.html:218-229`.

