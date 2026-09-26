<!-- audits/03-apps/dollywood.md:683 · section "4. Issues and bugs" · area dollywood · kind UX · rated medium -->
- **UX-DOLLYWOOD-6 — A tick made offline looks exactly like a synced one** (medium).
  - Offline, Mark done moved the count to "8 of 9 done" while `hub.sync` was `{state:"offline", pending:1}`. No word on screen mentioned offline, pending or sync, and no toast appeared. On reconnect the server reached 25. The shell's sync dot is hidden behind the viewer.
  - From the visual check: the offline captures match the online ones in the chrome.
  - Evidence: `audits/evidence/p3/dollywood/data-checks.json` (`O1.offlineTick`, `O1.afterReconnect`); `audits/evidence/p3/dollywood/offline-before-tick-online.png`; `audits/evidence/p3/dollywood/offline-after-tick.png`; `audits/screens/dollywood/map-offline-iphone-pwa-dark.png`.
