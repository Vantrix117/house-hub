<!-- audits/03-apps/leftovers.md:764 · section "4. Issues and bugs" · area leftovers · kind UX · rated medium -->
- **UX-LEFTOVERS-4 — "Copy list for Hearth" tells people to ask Claude for something the hub's Claude cannot do** (medium).
  - The block says to copy, then tell Claude "push my leftovers to Hearth", and that "it'll add them straight to the Hearth Calendar" (`apps/leftovers.html:114-115`). The hub's Chat tab is Claude, but the Worker has no Hearth tool: 0 occurrences of "hearth" in `worker/src`.
  - "Hearth" is also the name of the default palette.
  - The button uses the refresh icon (`apps/leftovers.html:152, 352`).
  - It stays live on an empty fridge, where it copies "Nothing aging right now — fridge's in good shape." (`apps/leftovers.html:331`).
  - It is the first thing below the list and runs behind the add bar on iPhone.
  - The failure path is P3-LEFTOVERS-10. Phase 1 lead `audits/01-leads.md:143`.
  - Evidence: `apps/leftovers.html:113-117, 328-358`; `audits/evidence/p3/leftovers/roles.json` (`hearthInWorker: 0`); `audits/evidence/p3/leftovers/roles-hearth-copied-iphone.png`; `audits/screens/leftovers/copy-typical-iphone-pwa-light.png`.
  - Run: `node "audits/tools/phase3/leftovers/roles.mjs"`.
