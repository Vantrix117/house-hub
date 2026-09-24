// Skeptic #2 side check: what the Worker's Sunday "behind" rule (worker/src/reminders.js behindFor) makes of the weekStart row
// before and after the overwrite observed in verify-slow-first-pull-weekstart-2.mjs. Pure function, no server.
//   node "audits/tools/phase2/SYNC/verify-slow-first-pull-weekstart-2-behind.mjs"
import { behindFor } from '../../../../worker/src/reminders.js';
const summary = { week: 38, weekDone: 2, total: 187, finished: false, next: { week: 38, day: 2, ref: 'Acts 6' } };
const cases = {
  'before (week 38 started 2026-09-22)': { '38': '2026-09-22' },
  'after the phone overwrite ({1: 2026-09-24})': { '1': '2026-09-24' },
  'after a later boot re-adds week 38 = the boot day': { '1': '2026-09-24', '38': '2026-09-24' },
};
for (const [label, ws] of Object.entries(cases)) console.log(label.padEnd(52), 'Sunday 2026-09-27 →', JSON.stringify(behindFor({ 'f260.summary': summary, 'f260.weekStart': ws }, '2026-09-27')));
