<!-- audits/03-apps/kidverse.md:656 · section "4. Issues and bugs" · area kidverse · kind UX · rated medium -->
- **UX-KIDVERSE-1 — Several kid steps need reading: identical "Read it to me" buttons, the "I heard it" check, and text-only toasts** (medium).
  - Verse: speaker, then star, works by icon and position, but Done ★ is off the first iPhone screen and nothing tells the child to listen first.
  - Story: the second card repeats the same speaker button and label, so the two differ only by position (also from the visual check). "I heard it" is a check whose meaning is only in text (`apps/kidverse.html:665`).
  - Every toast is text and none is spoken: already, badge, cash-in, reset, cannot read aloud (`:301, 328, 480, 484, 636, 641`). The spoken text gives no next step.
  - After a reset or past midnight a pressed "Done today ★" can show beside 0 stars.
  - The house style asks that kid flows be completable by icon, colour and position alone.
  - Evidence: `audits/evidence/p3/kidverse/taps.json` (`doneAboveFold: false` on iphone-pwa); `audits/evidence/p3/kidverse/webtells-toast-over-content.png`; `audits/screens/kidverse/kid-story-typical-iphone-pwa-light.png`; `audits/screens/kidverse/kid-rewards-typical-iphone-pwa-light.png`; `audits/screens/kidverse/kid-week-reset-typical-iphone-safari-light.png`.
