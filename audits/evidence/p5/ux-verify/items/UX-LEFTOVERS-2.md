<!-- audits/03-apps/leftovers.md:744 · section "4. Issues and bugs" · area leftovers · kind UX · rated high -->
- **UX-LEFTOVERS-2 — Kids get the full adult page: a ✓ on every family item, the add bar, the mic and the Hearth block, in small type with nothing to recognise** (high; the investigator's rating, not verified).
  - The app has no `data-kind="kid"` rules (only kiosk ones, `apps/leftovers.html:18, 96`), and `canEdit = hub.canWrite` (`apps/leftovers.html:180`), which is true for kids.
  - Ezra reaches the Larder in 2 taps and sees 6 ✓ buttons, the form, the mic and the Hearth copy.
  - Text is 16 / 12.5 / 11.5 px, although the kid token `--fs-md` is 19 px: the app sizes in px, so the kid type scale never reaches it. Only the card radius changes, because kid mode raises `--r-sm` to 16 px (`apps/design.css:283`; checker's correction).
  - Items have no pictures or icons (images 0), so a pre-reader cannot tell pancakes from chili.
  - The only big controls on the cards are the ✓ buttons; the add bar's Log button (88×52) and mic are as large. One ✓ removed Chicken alfredo on the server (feed "ezra: Finished the Chicken alfredo"). That data side is now a verified defect, **P3-LEFTOVERS-13 (critical)**. He also logged "asdfgh"; adding stays a ux matter, since chat deliberately lets kids add (`worker/src/chat.js:52`).
  - Phase 2 noted the same UI (`audits/02-shell.md:1636`); p2Ref P2-PROF-05. Phase 1 lead `audits/01-leads.md:134`.
  - Evidence: `apps.json:5`; `apps/leftovers.html:18, 96, 180, 275`; `audits/evidence/p3/leftovers/kid.json`; `audits/evidence/p3/leftovers/kid-ezra-larder-ipad.png`; `audits/screens/leftovers/kid-typical-ipad-portrait-light.png`.
  - Run: `node "audits/tools/phase3/leftovers/kid.mjs"`. Observed: `page.kind 'kid', canWrite true, doneButtons 6, formShown true, fontPx name 16px meta 12.5px chip 11.5px, kidTokenFsMd 19px, images 0, removedByKidOnServer ["Chicken alfredo"], kidLoggedOnServer true`.
