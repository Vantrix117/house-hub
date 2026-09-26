<!-- audits/04-design-system.md:1379 · section "Type (TYPE)" · area system · kind GAP · rated medium -->
#### GAP-TYPE-1 — No iPad type tier: body, secondary, button and tab text is the same size on the 820 px iPad as on the 430 px iPhone, in every area (investigator rating: medium)

- **What happens.**
  - Of the selectors seen on both devices, the same size on both: shell 160/163, F260 173/181, Prayer 131/132, Larder 31/31, park map 146/146, Verses 51/53, Kid Verse 55/57, Tally 8/10, Timer 10/12, build guide 107/113. Table TYPE-4 lists what grows.
  - What grows is display text, apart from a few controls:
    - display: the hero 30.1→44, the gate title 34→46, F260 titles 23-26→26-30, verse refs 38.7→56, Prayer's pray-mode line 30→42.6, the Tally count 111.8→162, the Timer digits 76.5→87.8;
    - controls: F260's journal-bar buttons 11→12 and labels 11.5→13, and the build guide's toolbar buttons 12.5→14 and 13→15. The build guide's zoom buttons shrink 20→15.
  - No design.css media query changes a type token. The only other width change is the shell's tab labels, 12→16 px in the ≥ 1024 px sidebar (`apps/design.css:573`).
- **Expected (house style).** Base on Dynamic Type and scale up for across-the-room reading on the iPad, the primary, always-on device. Body, secondary text and controls should step up at regular width, the way the kid and kiosk blocks already re-map the `--fs` tokens.
- **Why it matters.** The iPad is read from 2-3 m, yet reminders, Larder meta, prayer rows and captions stay at 12-16 px.
- **Evidence:** `roles.json` (`areas.*.scale`); `remeasure-raw.json`; `apps/design.css:22-24, 573`; `audits/screens/shell/home-typical-ipad-portrait-light.png` against `audits/screens/shell/home-typical-iphone-pwa-light.png`.
- **Reproduction:** `node audits/tools/phase4/TYPE/report.mjs ipad`.
- **Related (not re-filed):** UX-HOME-1 (P2, investigator only). It measured the iPad Home's key numbers at 2.3-3.1 mm and noted that "there is no iPad or ambient type scale" (`audits/02-shell.md:546-549`). This item is the cross-area measurement: the same holds in every app.

