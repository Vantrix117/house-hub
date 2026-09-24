// Midnight while the Larder is open (apps/leftovers.html:361-375: a 60 s interval + visibilitychange re-key "today").
// Controllable browser clock from Tue 22 Sep 2026 23:59:20 New York.
//   a) type a name before midnight, tap Log 10 s after midnight (before the minute tick): which date does it get?
//   b) after the tick: the date box, max, and the ages of the seeded items (+1 each?)
//   c) an item logged at 23:59:30 reads "1d ago" how soon after?
import { local, sleep, openLarder, cards, serverItems, save, shot } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const T0 = Date.parse('2026-09-22T23:59:20-04:00');
try {
  await L.clock('2026-09-22T23:59:20-04:00');
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: T0 });
  const f = await openLarder(d);
  const before = (await cards(f)).map(c => `${c.name} ${c.days}d`);
  await f.fill('#name', 'Late snack'); await f.click('.log');          // logged ~23:59:2x
  await d.ctx.clock.runFor(35000);                                     // -> ~23:59:55
  await f.fill('#name', 'Midnight popcorn');
  await d.ctx.clock.runFor(15000);                                     // -> ~00:00:10, before the minute tick
  const pre = await f.evaluate(() => ({ now: new Date().toString().slice(0, 24), dateBox: date.value, max: date.max, today: __larder.today() }));
  await f.click('.log');
  await d.ctx.clock.runFor(1000);
  const logged = (await cards(f)).filter(c => /Late snack|Midnight popcorn/.test(c.name)).map(c => ({ name: c.name, meta: c.meta }));
  await d.ctx.clock.runFor(60000);                                     // the minute tick fires
  const post = await f.evaluate(() => ({ now: new Date().toString().slice(0, 24), dateBox: date.value, max: date.max, today: __larder.today() }));
  const after = (await cards(f)).map(c => `${c.name} ${c.days}d`);
  await sleep(2500);
  const srv = (await serverItems(L)).filter(i => /Late snack|Midnight popcorn/.test(i.name));
  const s = await shot(d.page, 'midnight-after-tick-ipad.png');
  const out = { beforeMidnight: before, atTap: pre, loggedCards: logged, afterTick: post, agesAfter: after, server: srv, shot: s };
  console.log(JSON.stringify(out, null, 1));
  console.log('saved', save('midnight.json', out));
} finally { await L.close(); }
