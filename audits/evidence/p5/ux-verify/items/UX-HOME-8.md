<!-- audits/02-shell.md:673 · section "Home and launcher" · area shell · kind UX · rated medium -->
**UX-HOME-8 (medium; investigator only) — One tap on ✓ deletes a household reminder, with no undo.**
- The ✓ is 44×44 px and appears for every adult-kind profile, guests included (`index.html:1224-1226`).
- Tapping it raises 0 dialogs, no toast and 0 undo controls. The server row becomes a tombstone (value null).
- The only trace is the feed line "Grandma Jo: Cleared the reminder: Trash and recycling go out tonight" (`index.html:1228-1235`; `leads-done.json`, `leads-done-after-tap.png`).
- Not critical under rule (a): ✓ is the designed "done" action, the reminder visibly goes, and its text survives in the feed line. The risk is an accidental tap with no way back.
- A kid can also delete reminders through the data API. That is owned by P2-PROF-05 (see Profiles; medium, downgraded from critical because it needs hand-made API requests).
- Reproduce: `leads.mjs done`.

