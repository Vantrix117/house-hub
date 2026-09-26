<!-- audits/03-apps/dollywood-live.md:630 · section "4. Issues and bugs" · area dollywood-live · kind UX · rated medium -->
- **UX-DOLLYWOOD-LIVE-5 — Kid mode needs reading** (medium; from the visual check).
  - A pre-reader's pill shows "Location is off for this site / Allow Location …" (beacon on) or "Rides and the family, live / Kiara · just looking".
  - On Waits, rides the kid is too short for (Drop Line 55", Thunderhead 48", Lightning Rod 48") are faded with no glyph saying why (`apps/dollywood-live.html:1532`, class `noride`), unlike Nearby and Search, which show a height chip. The chip row that shows the kid filter scrolls away (lead).
  - The map, labels and controls stay at the adult scale. Only the ride card's faces with ✓ work without reading (OK-DOLLYWOOD-LIVE-5).
  - Evidence: `audits/screens/dollywood-live/kid-typical-iphone-pwa-light.png`, `audits/screens/dollywood-live/kid-typical-ipad-portrait-dark.png`, `audits/screens/dollywood-live/waits-kid-typical-ipad-portrait-light.png`, `audits/screens/dollywood-live/kid-viewonly-typical-ipad-landscape-light.png`. Lead `audits/01-leads.md:336`.
