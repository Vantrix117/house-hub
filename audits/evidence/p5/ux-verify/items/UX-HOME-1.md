<!-- audits/02-shell.md:546 · section "Home and launcher" · area shell · kind UX · rated high -->
**UX-HOME-1 (investigator only; not verified; the investigator's "high" is not carried as high, see Unresolved 5) — Key numbers on the 24/7 iPad Home are 2.3–3.1 mm tall.**
- Only the greeting reaches H2 at 2 m, and nothing reaches H1.
- H2 at 2 m needs about 43 px type and H1 about 74 px, so the key numbers are 2–4.6 times too small.
- There is no iPad or ambient type scale.
- Rating: the investigator's. The constitution requires key information on the 24/7 iPad (today's reading, running timers, leftovers expiring) to be legible at 2–3 m (`audits/HUB-AUDIT-PROMPT.md:116-117`). That makes the across-the-room glance the core daily use of this screen.
- **Not verified.** No skeptic ran it: its record in the verification data (`ipad-home-not-glanceable`) has `votes: []`, and no new verification was run for HOME in this pass. The final critique asked for verification before Phase 5 carries "high", so it stays open as Unresolved item 5.
- Evidence: `glance.json`, `glance-adult-ipad-portrait.png`, `glance-timer-ipad-landscape.png`, `apps/design.css:22-24, 280-287`.
- Expected: the key Home numbers read at 2–3 m on the iPad.
- Reproduce: `node "audits/tools/phase2/HOME/glance.mjs"`.

