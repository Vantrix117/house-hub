// Skeptic 2 for critic-midnight-second-log-blocked-2. Independent rerun: iPhone PWA, Mom, Enter-key submit (not a click),
// Chromium (a real <input type=date>, as iOS Safari has). Browser clock installed at Tue 22 Sep 2026 23:59:40 New York.
// Checks: after one Log at ~00:00:05 the date box reads today while max is still yesterday; a second Log by Enter fires
// 'invalid' and saves nothing; the app's own error line stays empty; retry after the 60 s tick saves with today's date.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
const EV = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EV, { recursive: true });
const NAME = 'verify-critic-midnight-second-log-blocked-2-2';
const T0 = Date.parse('2026-09-22T23:59:40-04:00');
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
try {
  await L.clock('2026-09-22T23:59:40-04:00');
  const ph = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: T0, as: ph });
  await d.goto('#home');
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 20000 });
  await f.evaluate(() => { window.__inv = 0; document.getElementById('date').addEventListener('invalid', () => window.__inv++); });
  const probe = () => f.evaluate(() => { const dt = document.getElementById('date'); return { now: new Date().toString().slice(0, 24), dayKey: window.__larder.today(), type: dt.type, value: dt.value, max: dt.max, valid: dt.validity.valid, rangeOverflow: dt.validity.rangeOverflow, msg: dt.validationMessage, invalidEvents: window.__inv, name: document.getElementById('name').value, errLine: document.getElementById('err').hidden ? '' : document.getElementById('err').textContent, cards: [...document.querySelectorAll('.item .nm')].map(n => n.textContent).filter(t => /Soup/.test(t)) }; });
  out.before = await probe();
  await d.ctx.clock.runFor(25000);                                   // -> 00:00:05 Wed
  await f.fill('#name', 'Soup one'); await f.press('#name', 'Enter');
  await d.ctx.clock.runFor(3000);
  out.afterFirst = await probe();
  await f.fill('#name', 'Soup two'); await f.press('#name', 'Enter');
  await d.ctx.clock.runFor(3000);
  out.afterSecond = await probe();
  await d.page.screenshot({ path: path.join(EV, NAME + '-blocked.png'), scale: 'css' });
  await d.ctx.clock.runFor(60000);                                   // the minute tick
  out.afterTick = await probe();
  await f.press('#name', 'Enter');                                   // retry the still-typed name
  await d.ctx.clock.runFor(3000);
  out.afterRetry = await probe();
  await sleep(3000);
  const r = await L.apiAs('mom', '/api/data/leftovers?scope=family');
  out.server = (r.body.items || []).filter(x => x.value && /Soup/.test(x.value.name)).map(x => ({ name: x.value.name, dateLogged: x.value.dateLogged }));
  for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, NAME + '.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p3/leftovers/' + NAME + '.json');
