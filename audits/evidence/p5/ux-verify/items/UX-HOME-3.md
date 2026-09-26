<!-- audits/02-shell.md:593 · section "Home and launcher" · area shell · kind UX · rated medium -->
**UX-HOME-3 (medium; investigator only) — On iPhone, Home is 4.7 screens tall.**
- Home is four full-width cards of 398×196–288 px, in one column below 720 px (`index.html:105-107`).
- 2 cards fit above the tab bar (1 in Safari). Reminders start at y=1295 and the feed at 1883, in a 4415 px page.
- On iPad portrait all 4 cards are visible (Reminders at 833, page 3243 px). In landscape, Reminders start at 815 against a fold at 820, in a 3681 px page that is mostly the 30-row feed.
- Evidence: `density.json` (eli-iphone-pwa.home, eli-iphone-safari.home), `audits/screens/shell/home-typical-iphone-pwa-light.png`.

