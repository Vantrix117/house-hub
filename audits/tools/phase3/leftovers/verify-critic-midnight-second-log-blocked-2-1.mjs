// Skeptic #1 for critic-midnight-second-log-blocked-2: after one Log in the minute after midnight, is the NEXT Log blocked
// by native constraint validation (date value = new day > max = old day)? Independent re-run on a fresh local instance.
// Chromium (real <input type=date>; = desktop Chrome/Edge) with the second Log sent two ways (click the Log button, and
// Enter in the name field), then WebKit for contrast. iPad portrait + desktop, Eli, controllable clock 23:59:50 New York.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
const EV = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EV, { recursive: true });
const P = 'verify-critic-midnight-second-log-blocked-2-1';
const T0 = Date.parse('2026-09-22T23:59:50-04:00');
const out = {};
const srv = async L => { const r = await L.apiAs('eli', '/api/data/leftovers?scope=family'); return (r.body.items || []).filter(x => x.value && /Midnight/.test(x.value.name)).map(x => ({ name: x.value.name, dateLogged: x.value.dateLogged })); };
const probe = f => f.evaluate(() => { const d = document.getElementById('date'); const r = d.getBoundingClientRect();
  return { now: new Date().toString().slice(0, 24), type: d.type, value: d.value, max: d.max, valid: d.validity.valid, rangeOverflow: d.validity.rangeOverflow, msg: d.validationMessage, formValid: document.getElementById('add').checkValidity(), dateVisible: r.width > 0 && r.height > 0, novalidate: document.getElementById('add').noValidate }; });
const typed = f => f.evaluate(() => ({ nameField: document.getElementById('name').value, cards: [...document.querySelectorAll('.item .nm')].map(n => n.textContent).filter(t => /Midnight/.test(t)), focused: document.activeElement && document.activeElement.id }));
const runs = [['chromium', 'ipad-portrait', 'click'], ['chromium', 'desktop', 'enter'], ['webkit', 'ipad-portrait', 'click']];
for (const [engine, device, how] of runs) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  const k = `${engine}-${device}-${how}`;
  try {
    await L.clock('2026-09-22T23:59:50-04:00');
    const d = await L.device({ device, profile: 'eli', installClock: T0 });
    await d.goto('#home');
    const f = await d.openApp('leftovers');
    await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 20000 });
    const before = await probe(f);
    await d.ctx.clock.runFor(15000);                                     // 00:00:05 Wed, before the 60 s tick
    await f.fill('#name', 'Midnight A'); await f.click('#add .log');
    await d.ctx.clock.runFor(1000);
    const between = await probe(f);
    await f.fill('#name', 'Midnight B');
    if (how === 'click') await f.click('#add .log'); else await f.press('#name', 'Enter');
    await d.ctx.clock.runFor(1500);
    const afterB = { ...(await typed(f)), date: await probe(f) };
    const shotPath = `${P}-${k}.png`;
    await d.page.screenshot({ path: path.join(EV, shotPath), scale: 'css' });
    await d.ctx.clock.runFor(60000);                                     // the minute tick -> rollover()
    const afterTick = await probe(f);
    await f.click('#add .log');                                          // retry the same (still-typed?) name
    await d.ctx.clock.runFor(1500);
    const afterRetry = await typed(f);
    await sleep(3000);
    const server = await srv(L);
    out[k] = { before, between, afterB, afterTick, afterRetry, server, shot: 'audits/evidence/p3/leftovers/' + shotPath };
    console.log(k, JSON.stringify(out[k], null, 0));
  } catch (e) { out[k] = { error: String(e) }; console.log(k, 'ERROR', e); }
  finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p3/leftovers/' + P + '.json');
