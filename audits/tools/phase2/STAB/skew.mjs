// STAB (2, cross-device): the running timer is shared as an absolute endAt taken from the starting device's own clock
// (apps/timer.html:116-117 endAt = Date.now() + left·1000), and every device counts down against ITS clock
// (index.html:816, apps/timer.html:106). hub.js measures each device's offset from the server (hub.skew, apps/hub.js:290)
// but neither side applies it. What does a second device show when the two clocks disagree by 2 minutes?
//   node "audits/tools/phase2/STAB/skew.mjs"
// Eli's phone runs 2 min fast (installed clock = now + 120 s) and starts a 10-minute timer; the Kitchen iPad (correct clock)
// pulls and shows the pill. Output: audits/evidence/p2/STAB/skew.json
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, DEMO } from '../../lib/local.mjs';
import { advance, settle } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });   // demo clock: the Worker's time barely moves, so each device's offset is exactly what it was given
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const now = DEMO + 500;
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: now + 120000, as: ph });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: now });
  await ipad.goto('#home'); await ipad.page.waitForSelector('#view-home .card'); await advance(ipad, 5000);
  const f = await phone.openApp('timer', { wait: '#go' });
  await f.click('[data-s="600"]'); await f.click('#go'); await phone.ctx.clock.runFor(1500); await settle(phone, { min: 800 });
  await advance(ipad, 31000);                                                   // one 30 s pull
  const r = {
    phone: { clock: await f.evaluate(() => new Date().toTimeString().slice(0, 8)), shows: await f.evaluate(() => document.getElementById('t').textContent), skewS: Math.round((await f.evaluate(() => hub.skew)) / 1000) },
    ipad: { clock: await ipad.page.evaluate(() => new Date().toTimeString().slice(0, 8)), pill: await ipad.page.evaluate(() => document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent), skewS: Math.round((await ipad.page.evaluate(() => hub.skew)) / 1000) },
  };
  console.log(JSON.stringify(r, null, 1));
  fs.writeFileSync(path.join(OUT, 'skew.json'), JSON.stringify(r, null, 1));
} finally { await L.close(); }
