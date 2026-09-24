// Skeptic #2 for finding "morning-copy-evening": does Prayer's Today headline say "this morning" at any hour?
// Fresh local instance, typical seed, WebKit. Opens Prayer as Eli (adult, personal list) on the iPhone PWA with the browser
// clock frozen at 08:40 (control), 15:00 and 21:10 New York on the demo day, and Ezra (kid) at 21:10.
// Run: node "audits/tools/phase3/prayer/verify-morning-copy-evening-2.mjs" -> audits/evidence/p3/prayer/verify-morning-copy-evening-2.json (+ PNG)
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '→', JSON.stringify(v)); };
async function check(label, profile, offsetH, shot) {
  const d = await L.device({ device: 'iphone-pwa', profile, fixedTime: DEMO + offsetH * 3600e3 });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(800);
  const v = await f.evaluate(() => ({
    localTime: new Date().toString().slice(0, 24), tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    headline: document.getElementById('todayLine').textContent, dateLine: document.getElementById('todayDate').textContent,
    strip: document.getElementById('todayStrip').textContent.replace(/\s+/g, ' ').trim() }));
  log(label, v);
  if (shot) await d.page.screenshot({ path: `${OUT}/verify-morning-copy-evening-2-${label}.png`, scale: 'css' });
  await d.close();
}
try {
  await check('eli-0840', 'eli', 0, false);
  await check('eli-1500', 'eli', 6 + 20 / 60, false);
  await check('eli-2110', 'eli', 12.5, true);
  await check('ezra-2110', 'ezra', 12.5, false);
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/verify-morning-copy-evening-2.json`, JSON.stringify(res, null, 1)); await L.close(); }
