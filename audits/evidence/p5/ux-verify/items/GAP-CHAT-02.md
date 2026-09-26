<!-- audits/02-shell.md:4399 · section "Hub chatbot" · area shell · kind GAP · rated medium -->
**GAP-02 — Chat actions are neither confirmed nor undoable (medium).** The brief expects one or the other.
- The SSE protocol has no confirm step (chat.js:4-9).
- None of the 12 tools is an undo (01: `undoLikeTools: []`).
- The Larder has no undo (apps/leftovers.html:306-311).

This gap underlies P2-CHAT-01, 03 and 04.

