<!-- audits/03-apps/prayer.md:868 · section "4. Issues and bugs" · area prayer · kind UX · rated medium -->
- **UX-PRAYER-4 — Settings never says which list it edits, and silently edits the family plan** (medium).
  - Plans, categories and paste all act on the list last chosen on Today (`apps/prayer.html:707-708, 1171-1227`). The headings are "Settings, Prayer plan, Paste a list, Categories, Backup" and never name "My list" or "Family". On Family, a plan change rewrites the house's plan row.
  - Evidence: `apps/prayer.html:503-532, 707-708`; `audits/evidence/p3/prayer/leads.json` (L16-settingsNamesList); `audits/screens/prayer/settings-typical-iphone-pwa-light.png`.
