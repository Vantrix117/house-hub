<!-- audits/02-shell.md:4370 · section "Hub chatbot" · area shell · kind UX · rated medium -->
**UX-01 — Kid chat has to be read; only the verse is spoken (medium).**
- `speakForKid` runs only for tool events with `speak:true`, which means only `read_todays_verse` (index.html:1456-1459, 1497).
- With speechSynthesis stubbed on Ezra's iPad, the verse was spoken. The plain reply "Great job, Ezra! Do you want to hear a story about Noah?" produced no speech (04-ui.json: `spokenAfterPlainReply` unchanged).
- The greeting, the placeholder and every reply are text (audits/evidence/p2/CHAT/04-kid-refused-tool-ipad-light.png; audits/screens/shell/chat-kid-typical-iphone-pwa-light.png).
- Ezra and Kiara are pre-readers. Their spoken question also waits for a Send tap (PWA-UX-4).

