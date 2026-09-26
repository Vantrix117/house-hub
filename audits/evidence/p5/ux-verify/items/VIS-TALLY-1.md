<!-- audits/03-apps/tally.md:517 · section "4. Issues and bugs" · area tally · kind VIS · rated medium -->
- **VIS-TALLY-1 — In every dark palette the dial and the +/− buttons barely stand out from the page** (medium).
  - The glass discs are near-black brown on a dark accent wash. The button fill measures:
    - − against the wash: 1.13-1.45:1 (Midnight, System-dark, Forest);
    - + against the wash: 1.17-1.62:1.

    The non-text target is 3:1.
  - The buttons are told apart only by their ring and shadow. The visual checker agreed the edge highlights still outline them.
  - The pastel never glows; the page reads as muddy navy and brown.
  - Evidence: `audits/evidence/p3/tally/themes.json`; `audits/evidence/p3/tally/theme-system-darkos-eli.png`; `audits/screens/tally/main-typical-ipad-portrait-dark.png`; `audits/screens/tally/kid-typical-ipad-portrait-dark.png`; `apps/tally.html:26-31`.
  - Run: `node "audits/tools/phase3/tally/themes.mjs"`.
