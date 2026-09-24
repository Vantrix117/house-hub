// Skeptic #2 for "midnight-first-minute-yesterday" (apps/leftovers.html:295 submit reads the date box; :364-374 rollover on a 60 s tick).
// Independent run: iPhone PWA (not the iPad), Enter-key submit (not the Log button), page opened 25 s before midnight,
// no pre-midnight typing. Controllable browser clock; the rig server clock is set to the same instant.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EVID, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const T0 = Date.parse('2026-09-22T23:59:35-04:00');
const out = {};
try {
  await L.clock('2026-09-22T23:59:35-04:00');
  const d = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: T0 });
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
  const st = () => f.evaluate(() => ({ now: new Date().toString().slice(0, 24), dateBox: document.getElementById('date').value,
    max: document.getElementById('date').max, dayKey: __larder.today() }));
  out.opened = await st();
  await d.ctx.clock.runFor(45000);                                    // -> ~00:00:20 Wed, first 60 s tick not yet due
  out.beforeSubmit = await st();
  await f.fill('#name', 'Verify2 cocoa');
  await f.press('#name', 'Enter');                                    // form submit via keyboard
  await d.ctx.clock.runFor(500);
  const card = () => f.evaluate(() => [...document.querySelectorAll('.item')].filter(c => /Verify2/.test(c.querySelector('.nm').textContent))
    .map(c => ({ name: c.querySelector('.nm').textContent, days: c.dataset.days, meta: c.querySelector('.meta').textContent, group: c.closest('.group') && c.closest('.group').dataset.tone })));
  out.cardAfterSubmit = await card();
  out.afterSubmitState = await st();                                  // :300 resets the box to todayStr()
  await d.ctx.clock.runFor(60000);                                    // the minute tick
  out.afterTick = await st();
  out.cardAfterTick = await card();
  await sleep(2500);
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const rows = (r.body.items || r.body.rows || r.body.data || []);
  out.server = rows.filter(x => x.value && /Verify2/.test(x.value.name)).map(x => ({ key: x.key, name: x.value.name, dateLogged: x.value.dateLogged, byName: x.value.byName }));
  const p = path.join(EVID, 'verify-midnight-first-minute-yesterday-2.png');
  await d.page.screenshot({ path: p, scale: 'css', animations: 'disabled', caret: 'hide' });
  out.shot = 'audits/evidence/p3/leftovers/verify-midnight-first-minute-yesterday-2.png';
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EVID, 'verify-midnight-first-minute-yesterday-2.json'), JSON.stringify(out, null, 1));
  console.log('saved audits/evidence/p3/leftovers/verify-midnight-first-minute-yesterday-2.json');
} finally { await L.close(); }
