// Two devices of one person reviewing: f260.recall and verses.log are whole-map rows under last-write-wins
// (apps/verses.html:294-298 writes {...recall()} and {...log()}; apps/hub.js:236 stamps the row, worker/src/data.js resolves per row).
// A (online): phone and iPad both open Verses as Eli. The phone rates Luke 14:26-27 and John 17:3 "Got it" (both flushed).
//    Within 30 s, before the iPad's next poll, the iPad rates Luke 14:26-27 "Almost" (the card it is showing).
// B (offline): the phone goes offline and rates all three due verses "Got it"; the iPad (online) later rates Luke "Almost";
//    the phone reconnects.
// Observed: which ratings survive on the server, the day's review count, and what the phone shows after its next poll.
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { openVerses, state, rate, serverRow, save, shot, waitQueueEmpty } from './_lib.mjs';
const MODE = process.argv[2] || 'A';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { mode: MODE };
const pick = rc => Object.fromEntries(['33-0', '36-1', '37-0'].map(id => [id, rc[id] && { s: rc[id].s, box: rc[id].box, due: rc[id].due, last: rc[id].last }]));
try {
  out.before = pick((await serverRow(L, 'eli', 'f260', 'f260.recall')).value);
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  const pf = await openVerses(phone);
  const t0 = Date.now();
  const vf = await openVerses(ipad);
  out.ipadOpenAt = 0;
  if (MODE === 'B') await phone.setOffline(true);
  await rate(pf, 'got'); await rate(pf, 'got');
  if (MODE === 'B') await rate(pf, 'got');
  if (MODE === 'A') await waitQueueEmpty(phone);
  out.phoneAfterRating = await state(pf);
  out.serverAfterPhone = pick((await serverRow(L, 'eli', 'f260', 'f260.recall')).value);
  out.ipadCardBeforeRating = await vf.evaluate(() => window.verses.current());
  await rate(vf, 'almost');
  out.ipadRatedAtMs = Date.now() - t0;
  await waitQueueEmpty(ipad);
  if (MODE === 'B') { await sleep(500); await phone.setOffline(false); await waitQueueEmpty(phone); await sleep(1500); }
  out.serverFinal = pick((await serverRow(L, 'eli', 'f260', 'f260.recall')).value);
  out.logFinal = (await serverRow(L, 'eli', 'verses', 'log')).value['2026-09-22'];
  // let both devices poll (hub.js pulls every 30 s)
  await sleep(33000);
  out.phoneAfterPoll = await state(pf);
  out.ipadAfterPoll = await state(vf);
  out.shotPhone = await shot(phone.page, `two-devices-${MODE}-phone-after-poll.png`);
  out.toasts = { phone: phone.logs.filter(l => /error/i.test(l)).slice(0, 5), ipad: ipad.logs.filter(l => /error/i.test(l)).slice(0, 5) };
  out.lost = Object.keys(out.serverAfterPhone).filter(id => MODE === 'A' && out.serverAfterPhone[id].last === '2026-09-22' && out.serverFinal[id].last !== '2026-09-22');
  if (MODE === 'B') out.lost = ['33-0', '36-1', '37-0'].filter(id => !(out.serverFinal[id].last === '2026-09-22' && out.serverFinal[id].s === 'got'));   // the phone rated all three Got it
  console.log(JSON.stringify(out, null, 1));
  save(`two-devices-${MODE}.json`, out);
} finally { await L.close(); }
