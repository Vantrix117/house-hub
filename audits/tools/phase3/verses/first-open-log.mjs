// First Verses open on a device: the shell already caches the person's f260 scope (index.html:458 hub.use('f260','person')),
// so hub.ready does not wait for a pull (apps/hub.js:334-337 waits only when no channel has been pulled before) and Verses
// renders its due cards from that cache while its own channel (verses/person: the day-streak log) is still empty.
// A rating then writes log = { today: 1 } (apps/verses.html:297-298) stamped now, which beats the server's whole log.
//   offline: the phone (new device, Home opened once online) goes offline, opens Verses for the first time, rates one verse, reconnects.
//   slow:    the same phone online, with the verses channel's GET delayed 4 s (a slow network); one rating inside that window.
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { openVerses, state, rate, serverRow, save, shot, waitQueueEmpty } from './_lib.mjs';
const MODE = process.argv[2] || 'offline';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { mode: MODE };
try {
  const lb = await serverRow(L, 'eli', 'verses', 'log');
  out.logBefore = { days: Object.keys(lb.value).length, value: lb.value };
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  await phone.goto('#home'); await sleep(2500);
  out.cacheAfterHome = await phone.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.cache.')).map(k => k + ' since=' + (JSON.parse(localStorage.getItem(k)).since > 0)));
  if (MODE === 'offline') await phone.setOffline(true);
  if (MODE === 'slow') await phone.ctx.route(u => /\/api\/data\/verses$/.test(u.pathname) && u.searchParams.get('scope') === 'person', async r => { await sleep(4000); await r.continue(); });
  const t0 = Date.now();
  const f = await openVerses(phone);
  out.firstPaint = await state(f); out.firstPaintMs = Date.now() - t0;
  out.shotFirst = await shot(phone.page, `first-open-log-${MODE}-before-rating.png`);
  await rate(f, 'got');
  out.ratedAtMs = Date.now() - t0;
  out.afterRating = (await state(f)).stats;
  if (MODE === 'offline') { await sleep(500); await phone.setOffline(false); }
  await waitQueueEmpty(phone); await sleep(5000);
  const la = await serverRow(L, 'eli', 'verses', 'log');
  out.logAfter = { days: Object.keys(la.value).length, value: la.value };
  out.summaryAfter = (await serverRow(L, 'eli', 'verses', 'summary')).value;
  // Another device (the Kitchen iPad) opens Verses afterwards
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  const vf = await openVerses(ipad);
  out.ipadStats = (await state(vf)).stats;
  out.shotIpad = await shot(ipad.page, `first-open-log-${MODE}-ipad-after.png`);
  console.log(JSON.stringify(out, null, 1));
  save(`first-open-log-${MODE}.json`, out);
} finally { await L.close(); }
