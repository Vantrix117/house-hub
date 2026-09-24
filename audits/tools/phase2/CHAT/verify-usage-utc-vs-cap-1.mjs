// Skeptic #1 for finding "usage-utc-vs-cap": Admin → Usage groups chat by UTC day (index.js:522-524) while the daily cap
// counts New York days (chat.js:112-117). Independent of the investigator's 03-cap.mjs.
//   node "audits/tools/phase2/CHAT/verify-usage-utc-vs-cap-1.mjs"
// Part A: the investigator's observation on the typical demo household (demo clock Tue 22 Sep 2026 08:40 NY).
// Part B: a controlled run on the EMPTY variant (no seeded chat): Dad sends at Mon 21 Sep 21:30 + 22:00 NY and
//         Tue 22 Sep 08:40 + 20:30 NY (EDT = UTC-4). Then read the cap counter and Admin → Usage at Tue 20:45 NY.
// Part C: the admin panel as Eli sees it (Me tab, iPad) — the Day column text for Dad's rows.
import path from 'node:path';
import fs from 'node:fs';
import { local } from '../../lib/local.mjs';
import { chat, history, save, EVID } from './lib.mjs';

const out = {};
const usageFor = async (L, pid) => ((await L.apiAs('eli', '/api/admin/usage')).body.chat || []).filter(r => r.profile_id === pid);

// A
let L = await local({ variant: 'typical', clock: 'demo' });
try {
  out.A = { capUsedToday: (await history(L, 'eli')).used, usageRowsForEli: (await usageFor(L, 'eli')).slice(0, 3) };
  console.log('A typical demo, Eli:', JSON.stringify(out.A));
} finally { await L.close(); }

// B + C
L = await local({ variant: 'empty', clock: 'demo' });
try {
  const P = 'dad';
  out.B = { sends: [] };
  for (const iso of ['2026-09-21T21:30:00-04:00', '2026-09-21T22:00:00-04:00', '2026-09-22T08:40:00-04:00', '2026-09-22T20:30:00-04:00']) {
    await L.clock(iso);
    await L.anthropic([{ text: 'ok' }]);
    const r = await chat(L, P, 'what is on the reminders card? (' + iso + ')');
    out.B.sends.push({ nyTime: iso, utc: new Date(iso).toISOString(), http: r.status, doneUsed: r.done && r.done.used });
  }
  await L.clock('2026-09-21T23:59:00-04:00');
  out.B.atMon2359NY = { capUsed: (await history(L, P)).used };
  await L.clock('2026-09-22T20:45:00-04:00');
  out.B.atTue2045NY = { capUsed: (await history(L, P)).used, usageRowsForDad: await usageFor(L, P) };
  console.log('B sends:', JSON.stringify(out.B.sends));
  console.log('B cap at Mon 23:59 NY:', JSON.stringify(out.B.atMon2359NY));
  console.log('B at Tue 20:45 NY:', JSON.stringify(out.B.atTue2045NY));

  // C: the admin table in the shell (browser clock fixed at the same instant)
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: Date.parse('2026-09-22T20:45:30-04:00') });
  await ipad.goto('#me');
  await ipad.page.waitForSelector('#admin-body table.usage', { timeout: 20000 });
  const rows = await ipad.page.$$eval('#admin-body table.usage', ts => [...ts[0].querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(c => c.textContent.trim())));
  out.C = { chatUsageTableRows: rows };
  console.log('C admin panel chat table rows:', JSON.stringify(rows));
  const el = await ipad.page.$('#admin-body table.usage');
  if (el) { await el.scrollIntoViewIfNeeded(); const f = path.join(EVID, 'verify-usage-utc-vs-cap-1-admin.png'); await el.screenshot({ path: f }); out.C.shot = path.relative(path.resolve(EVID, '..', '..', '..', '..'), f).replace(/\\/g, '/'); console.log('C shot:', out.C.shot, fs.statSync(f).size, 'bytes'); }
} finally { await L.close(); }
console.log('evidence:', save('verify-usage-utc-vs-cap-1.json', out));
