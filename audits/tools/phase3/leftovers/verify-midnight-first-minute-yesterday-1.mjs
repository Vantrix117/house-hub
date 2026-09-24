// Skeptic #1 for "midnight-first-minute-yesterday": an item logged just after local midnight, before the Larder's
// 60 s rollover tick (apps/leftovers.html:364-375), takes the stale date box value (:295) = yesterday.
// Fresh local instance, controllable browser clock starting 23:59:45 New York on Tue 22 Sep 2026.
import fs from 'node:fs'; import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EVID, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
const T0 = Date.parse('2026-09-22T23:59:45-04:00');
const probe = f => f.evaluate(() => ({ now: new Date().toString().slice(0, 24), dateBox: document.getElementById('date').value,
  max: document.getElementById('date').max, dayKey: window.__larder.today() }));
const card = (f, n) => f.evaluate(n => { const c = [...document.querySelectorAll('.item')].find(c => c.querySelector('.nm').textContent === n);
  return c ? { days: c.dataset.days, meta: c.querySelector('.meta').textContent } : null; }, n);
try {
  await L.clock('2026-09-22T23:59:45-04:00');
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: T0 });
  await d.goto('#home');
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
  const opened = await probe(f);
  await d.ctx.clock.runFor(20000);                         // -> ~00:00:05 Wed, rollover interval not yet fired
  await L.clock('2026-09-23T00:00:05-04:00');              // keep the Worker's clock in step (updated_at only)
  const atTap = await probe(f);
  await f.fill('#name', 'Verify popcorn'); await f.click('#add .log');
  await d.ctx.clock.runFor(500);
  const afterTap = await probe(f);
  const cardA = await card(f, 'Verify popcorn');
  await d.ctx.clock.runFor(61000);                         // the minute tick
  const afterTick = await probe(f);
  const cardB = await card(f, 'Verify popcorn');
  await sleep(2500);
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const rows = (r.body.items || r.body.rows || r.body.data || []).filter(x => x.value && x.value.name === 'Verify popcorn')
    .map(x => ({ key: x.key, dateLogged: x.value.dateLogged }));
  const png = path.join(EVID, 'verify-midnight-first-minute-yesterday-1.png');
  await d.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
  const out = { opened, atTap, afterTap, cardRightAfterTap: cardA, afterTick, cardAfterTick: cardB, server: rows,
    shot: 'audits/evidence/p3/leftovers/verify-midnight-first-minute-yesterday-1.png' };
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EVID, 'verify-midnight-first-minute-yesterday-1.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
