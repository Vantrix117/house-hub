<!-- audits/03-apps/prayer.md:865 · section "4. Issues and bugs" · area prayer · kind UX · rated medium -->
- **UX-PRAYER-3 — Nothing in Prayer is legible from across the room, including "Kitchen view — Big type for the counter"** (medium).
  - Measured readable distances on the iPad: h1 0.88 m, row titles 0.50 m, meta 0.38 m, nav 0.35 m, kid titles 0.96 m, Kitchen items (24 px) 0.69 m and its heading 1.0 m. 2-3 m needs roughly 90-130 px type.
  - Evidence: `audits/evidence/p3/prayer/layout.json` (`readableAtMetres`); `audits/screens/prayer/kitchen-typical-ipad-landscape-light.png`; `apps/prayer.html:357-362`. (The harness PNG `layout-kitchen-ipad-landscape.png` renders the font too thin; see the caveat in §5.)
