There is a file called prayer-handoff.zip in my Downloads folder. Unzip it so its contents land at handoff/prayer/ in this repo (the zip contains a folder named handoff — put its contents at handoff/prayer/, not handoff/handoff/). Commit that as "Add prayer app handoff".

Then read handoff/prayer/SPEC.md, handoff/prayer/TASKS.md, and handoff/prayer/prayer.html before writing anything else.

This is a personal prayer app for the house-hub. The prototype in handoff/prayer/prayer.html is working and tested; build from it, do not start over. prayers.json is a real export showing the data shape. check.js is a behaviour test — run `node handoff/prayer/check.js apps/prayer.html` after every task and keep it at 0 failed.

Do the tasks in TASKS.md in order, A through D, one commit per task with the task id in the message. Push after each section. Stop after each section and tell me what changed in two or three lines, then continue.

Rules that override anything else:
- Keep it one self-contained HTML file with no build step and no dependencies beyond Google Fonts.
- Keep the storage key prayer-data-v3 and add migrate() defaults for anything new.
- Keep the palette to the four accents in SPEC.md. No new colours.
- Never put a token or secret in the file or the repo. The sync token lives in localStorage only.
- The seed data in the prototype is placeholder. Do not invent real-looking names.
- Do not tell me something is done or verified unless you re-ran check.js and it passed. Say plainly what you could not test without a device.

When all sections are done, run the section E checklist and give me the list of what you verified and what you did not.
