// Verses left open across midnight (Tue 22 → Wed 23 Sep 2026, New York). The app works out "today" only inside render()
// (apps/verses.html:310), which runs at load, after a tap and on hub.onChange (380-381); there is no timer or
// visibility handler of its own (setInterval/setTimeout: NOT FOUND IN CODE).
// Eli (iPad) and Ezra (phone) each finish their reviews at ~23:57, then both pages run 6 minutes of page time with real
// 30 s pulls (the Worker's demo clock is moved past midnight too), then a synthetic hide/show (hub.js pulls on visibility).
import { local, sleep } from '../../lib/local.mjs';
import { openVerses, state, rate, save, shot, waitQueueEmpty, advance } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  await L.clock('2026-09-22T23:55:00-04:00'); await L.reset('typical');
  const start = Date.parse('2026-09-22T23:57:00-04:00');
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: start });
  const kd = await L.newDevice({ name: 'Ezra phone', profiles: ['ezra'] });
  const kid = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: start, as: kd });
  const ef = await openVerses(ipad), kf = await openVerses(kid);
  for (let i = 0; i < 3; i++) await rate(ef, 'got');
  for (let i = 0; i < 2; i++) await rate(kf, 'got');
  await waitQueueEmpty(ipad); await waitQueueEmpty(kid);
  out.before = { eli: await state(ef), ezra: await state(kf) };
  await L.clock('2026-09-23T00:00:30-04:00');
  await Promise.all([advance(ipad, 6 * 60000), advance(kid, 6 * 60000)]);
  for (const d of [ipad, kid]) for (const f of [d.page, ...d.page.frames()]) await f.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }).catch(() => {});
  await sleep(1500);
  out.after = { eli: await state(ef), ezra: await state(kf) };
  out.shotEli = await shot(ipad.page, 'midnight-eli-ipad-after.png');
  out.shotEzra = await shot(kid.page, 'midnight-ezra-iphone-after.png');
  // what a fresh render would show at the same moment
  out.freshDueEli = await ef.evaluate(() => window.verses.dueIds());
  out.freshDueEzra = await kf.evaluate(() => window.verses.dueIds());
  const ipad2 = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: start + 6 * 60000 + 60000 });
  const f2 = await openVerses(ipad2);
  out.reopened = await state(f2);
  const pick = s => ({ today: s.today, who: s.who, trainer: s.trainer, ref: s.ref, doneBig: s.doneBig, doneSub: s.doneSub, stats: s.stats, queue: s.queue && s.queue.slice(0, 3) });
  const brief = { before: { eli: pick(out.before.eli), ezra: pick(out.before.ezra) }, after: { eli: pick(out.after.eli), ezra: pick(out.after.ezra) }, freshDueEli: out.freshDueEli, freshDueEzra: out.freshDueEzra, reopened: pick(out.reopened), shots: [out.shotEli, out.shotEzra] };
  console.log(JSON.stringify(brief, null, 1));
  save('midnight.json', brief);
} finally { await L.close(); }
