// Skeptic #1 for finding "morning-copy-evening": does the Prayer headline say "this morning" regardless of time of day?
// Opens Prayer as Eli (adult, personal list) on a fresh local instance with the browser clock frozen at four times of
// day on the demo date (New York), and as Ezra (kid) at 21:10 as a control. Prints the headline and the device clock.
// Run: node "audits/tools/phase3/prayer/verify-morning-copy-evening-1.mjs"
//   -> audits/evidence/p3/prayer/verify-morning-copy-evening-1.json + verify-morning-copy-evening-1-2110-iphone.png
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = { demo: new Date(DEMO).toISOString(), runs: [] };
// DEMO = Tue 22 Sep 2026 08:40 New York. Offsets in hours from it.
const times = [['06:10', -2.5], ['08:40', 0], ['14:10', 5.5], ['21:10', 12.5]];
try {
  for (const [label, h] of times.concat([['21:10-kid', 12.5, 'ezra']])) {
    const profile = label.endsWith('-kid') ? 'ezra' : 'eli';
    const d = await L.device({ device: 'iphone-pwa', profile, fixedTime: DEMO + h * 3600e3 });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 });
    await sleep(800);
    const r = await f.evaluate(() => ({
      now: new Date().toString().slice(0, 24),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      headline: document.getElementById('todayLine').textContent,
      dateLine: document.getElementById('todayDate').textContent,
      setSize: typeof todaySet === 'function' ? todaySet().length : null,
    }));
    r.label = label; r.profile = profile;
    res.runs.push(r); console.log(label, profile, '→', JSON.stringify(r));
    if (label === '21:10') await d.shot(`${OUT}/verify-morning-copy-evening-1-2110-iphone.png`);
    await d.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/verify-morning-copy-evening-1.json`, JSON.stringify(res, null, 1));
  await L.close();
}
