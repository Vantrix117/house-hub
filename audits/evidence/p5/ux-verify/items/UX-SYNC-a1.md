<!-- audits/02-shell.md:2910 · section "Sync" · area shell · kind UX · rated medium -->
**UX (medium): nobody is told when a change did not sync.**
- The tab-bar dot (index.html:769) is covered by the full-screen viewer while any app is open (index.html:326). In e7 the element on top of `#syncdot` was the app `frame`, and F260 showed no sync wording with 3 writes waiting offline (e7-phone-f260-offline-pending.png).
- After a dropped queue, the next pull resets the state to "synced" (apps/hub.js:311). The recorded transitions were `error:bad_batch p201` → `synced p0` (verify-batch-over-200-dropped-1.json) and `error:read_only p0` → `synced p0` (verify-kiosk-drops-family-queue-1.json).
- Conflict losses produce no toast on either device (e2a, e2b).
- F260's journal says "Saved" for saves that never happened (P2-SYNC-19). Prayer says "Backup restored." for an import the server rejected (P2-SYNC-06).
- Reproduction: `node "audits/tools/phase2/SYNC/e7-sync-ui.mjs"`.
- This confirms three leads by mechanism: "Being offline is almost invisible" (Shell), "Neither app shows offline or unsent changes" (Tally/Timer) and "Offline is invisible in both apps" (Kid Verse/Verses).

