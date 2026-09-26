// Batch 0b, Larder (P3-LEFTOVERS-08/-14): the phase 3 midnight scripts tap ~20 s after the app wired hub.onDay, so its
// tick may already have re-keyed the day. Here the Log taps land 2-4 s after midnight, before any onDay tick can fire
// (the app opens at 23:59:58, onDay polls every 20 s), so only the tap-time re-key can give them today's date.
// Chromium (a real <input type=date>, so a value > max would block the second Log natively).
import { local, sleep } from '../../lib/local.mjs';
const T0 = Date.parse('2026-09-22T23:59:55-04:00');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
const probe = f => f.evaluate(() => { const d = document.getElementById('date'); return { now: new Date().toString().slice(16, 24), value: d.value, max: d.max, valid: d.validity.valid, dayKey: window.__larder.today() }; });
try {
  await L.clock('2026-09-22T23:59:55-04:00');
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: T0 });
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 20000 });
  const opened = await probe(f);
  const toMidnight = Date.parse('2026-09-23T00:00:02-04:00') - (await f.evaluate(() => Date.now()));
  await d.ctx.clock.runFor(Math.max(0, toMidnight));
  const beforeTap = await probe(f);                      // expected: still yesterday's box (no tick yet)
  await f.fill('#name', 'Tap A'); await f.click('#add .log'); await d.ctx.clock.runFor(500);
  const afterA = await probe(f);
  await f.fill('#name', 'Tap B'); await f.press('#name', 'Enter'); await d.ctx.clock.runFor(500);
  const afterB = { ...(await probe(f)), nameLeft: await f.inputValue('#name') };
  await sleep(2500);
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const server = (r.body.items || []).filter(x => x.value && /^Tap /.test(x.value.name)).map(x => x.value.name + ' ' + x.value.dateLogged);
  const out = { opened, beforeTap, afterA, afterB, server };
  console.log(JSON.stringify(out, null, 1));
  const ok = beforeTap.value === '2026-09-22' && server.length === 2 && server.every(s => s.endsWith('2026-09-23')) && afterB.value === afterB.max;
  console.log(ok ? 'PASS: both Logs after midnight got 2026-09-23, box value = max' : (beforeTap.value !== '2026-09-22' ? 'INCONCLUSIVE: the day was re-keyed before the tap' : 'FAIL'));
} finally { await L.close(); }
