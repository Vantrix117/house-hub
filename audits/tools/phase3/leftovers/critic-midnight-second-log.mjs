// Completeness critic: P3-LEFTOVERS-08's untested side note. After the first Log in the minute after midnight, submit resets
// the date box to todayStr() (the new day, apps/leftovers.html:300) while `max` stays yesterday's until the 60 s tick
// (apps/leftovers.html:364-375). The form has no `novalidate` (line 120), so a browser with a real date input should block
// the next Log with a native range error. Chromium (real date input) and WebKit (text fallback on Windows) for contrast.
// iPad portrait, Eli, controllable clock from Tue 22 Sep 2026 23:59:50 New York.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
const EV = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EV, { recursive: true });
const T0 = Date.parse('2026-09-22T23:59:50-04:00');
const out = {};
async function srv(L) { const r = await L.apiAs('eli', '/api/data/leftovers?scope=family'); return (r.body.items || []).filter(x => x.value).map(x => ({ name: x.value.name, dateLogged: x.value.dateLogged })); }
for (const engine of ['chromium', 'webkit']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  try {
    await L.clock('2026-09-22T23:59:50-04:00');
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: T0 });
    await d.goto('#home');
    const f = await d.openApp('leftovers');
    await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 20000 });
    await d.ctx.clock.runFor(15000);                                  // -> 00:00:05 Wed, before the minute tick
    await f.fill('#name', 'First after midnight'); await f.click('.log');
    await d.ctx.clock.runFor(2000);
    const between = await f.evaluate(() => ({ now: new Date().toString().slice(0, 24), type: date.type, value: date.value, max: date.max, valid: date.validity.valid, rangeOverflow: date.validity.rangeOverflow, msg: date.validationMessage }));
    await f.fill('#name', 'Second after midnight'); await f.click('.log');
    await d.ctx.clock.runFor(2000);
    const afterSecond = await f.evaluate(() => ({ nameStillTyped: document.getElementById('name').value, cards: [...document.querySelectorAll('.item .nm')].map(n => n.textContent).filter(t => /after midnight/.test(t)) }));
    await d.ctx.clock.runFor(60000);                                  // the tick
    const afterTick = await f.evaluate(() => ({ value: date.value, max: date.max, valid: date.validity.valid }));
    await sleep(3000);
    const server = (await srv(L)).filter(i => /after midnight/.test(i.name));
    const png = `critic-midnight-second-log-${engine}-ipad.png`;
    await d.page.screenshot({ path: path.join(EV, png), scale: 'css' });
    out[engine] = { between, afterSecond, afterTick, server, shot: 'audits/evidence/p3/leftovers/' + png };
    console.log(engine, JSON.stringify(out[engine]));
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, 'critic-midnight-second-log.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p3/leftovers/critic-midnight-second-log.json');
