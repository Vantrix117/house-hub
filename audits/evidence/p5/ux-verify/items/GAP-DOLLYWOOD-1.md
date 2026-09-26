<!-- audits/03-apps/dollywood.md:772 · section "4. Issues and bugs" · area dollywood · kind GAP · rated medium -->
- **GAP-DOLLYWOOD-1 — The 3D view never shows the current step** (medium).
  - LEGO Builder's core is a step you can zoom and spin. Here the 3D code never reads the current section or step: no `curSec`, `curIdx`, `stepTarget` or `highlight` between `apps/dollywood.html:1157` and `:1290` (NOT FOUND IN CODE), and entering 3D hides the 2D map that carries the step highlight (`apps/dollywood.html:1153`).
  - Evidence: `audits/screens/dollywood/view-3d-typical-ipad-portrait-light.png`; reference https://www.lego.com/en-us/builder-app.
