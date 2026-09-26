<!-- audits/03-apps/leftovers.md:738 · section "4. Issues and bugs" · area leftovers · kind UX · rated high -->
- **UX-LEFTOVERS-1 — One tap on ✓ deletes a family item for everyone, with no undo, no confirm and no completed history** (high; the investigator's rating, not verified).
  - `removeItem` writes a tombstone and posts "Finished the X" (`apps/leftovers.html:306-311`). There is no toast, no undo and no "Show completed".
  - The feed line is the only trace, and it cannot restore the item.
  - A mis-tap on the 48 px ✓ beside the chip loses the item for the whole house. Reminders keeps completed items reachable ("Show Completed", support.apple.com/en-us/102484).
  - Confirmed worst case: P3-LEFTOVERS-01. Phase 1 lead `audits/01-leads.md:133`.
  - Evidence: `apps/leftovers.html:275-283, 306-311`; `audits/evidence/p3/leftovers/doubletap.json` (`undoUi: false` in every arm); `audits/screens/leftovers/finished-typical-iphone-pwa-light.png`.
