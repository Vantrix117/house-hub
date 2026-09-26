<!-- audits/03-apps/leftovers.md:862 · section "4. Issues and bugs" · area leftovers · kind GAP · rated medium -->
- **GAP-LEFTOVERS-1 — No way to fix a mistake or give a food its own use-by: no edit and no per-item expiry** (medium).
  - Items can only be added or removed. A wrong date or size needs delete and re-add, which loses "logged by".
  - Every food ages on the same 4/7-day rule (`apps/leftovers.html:137`).
  - Reminders has editable due dates (support.apple.com/en-us/102484), and NoWaste and Fridgely track a use-by per item.
  - Evidence: `apps/leftovers.html:249-311` (the card renders a ✓ only; no edit handler). NOT FOUND IN CODE: an edit or expiry field.

**What works**

