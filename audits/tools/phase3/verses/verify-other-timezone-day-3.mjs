// Skeptic #3 (tie-break) for finding "other-timezone-day" (apps/verses.html:203 dayKey, :228 kid filter).
// Fresh local instance. Server clock and browser clocks at Tue 22 Sep 2026 20:30 New York (= 01:30 Wed Europe/London).
//  1. A phone whose time zone is Europe/London: Eli rates one card "Got it", Ezra rates one card "Got it".
//     What the London phone itself shows before and after, and what the server stores.
//  2. The Kitchen iPad (New York, the rig default zone) one minute later: Eli and Ezra open Verses.
//  3. The same iPad at Wed 23 Sep 08:00 New York: Eli and Ezra again.
// Also prints the device-local day rule other hub pages use (for the "by design / platform convention" question).
// Writes audits/evidence/p3/verses/verify-other-timezone-day-3.json and verify-other-timezone-day-3-ny-ezra-tue.png.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { openVerses, state, rate, serverRow, waitQueueEmpty, EVID } from './_lib.mjs';

const TUE = Date.parse('2026-09-22T20:30:00-04:00');
const WED = Date.parse('2026-09-23T08:00:00-04:00');
const tz = f => f.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  await L.clock(new Date(TUE).toISOString());
  const before = { eli: (await serverRow(L, 'eli', 'f260', 'f260.recall')).value, ezra: (await serverRow(L, 'ezra', 'f260', 'f260.recall'))?.value || {} };

  // 1. London phone
  const orig = L.browser.newContext.bind(L.browser);
  L.browser.newContext = o => orig({ ...o, timezoneId: 'Europe/London' });
  const pd = await L.newDevice({ name: 'Phone set to London', profiles: ['eli', 'ezra'] });
  const lonEli = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: TUE, as: pd });
  const lonEzra = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: TUE, as: pd });
  L.browser.newContext = orig;

  let f = await openVerses(lonEli);
  out.london = { tz: await tz(f), eliBefore: await state(f) };
  await rate(f, 'got'); await waitQueueEmpty(lonEli); out.london.eliAfter = await state(f);
  f = await openVerses(lonEzra);
  out.london.ezraBefore = await state(f);
  await rate(f, 'got'); await waitQueueEmpty(lonEzra); out.london.ezraAfter = await state(f);
  await lonEli.close(); await lonEzra.close();

  const eliRc = (await serverRow(L, 'eli', 'f260', 'f260.recall')).value;
  const ezraRc = (await serverRow(L, 'ezra', 'f260', 'f260.recall')).value;
  const diff = (a, b) => Object.fromEntries(Object.keys(b).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(k => [k, b[k]]));
  const eliLog = (await serverRow(L, 'eli', 'verses', 'log')).value;
  const ezraLog = (await serverRow(L, 'ezra', 'verses', 'log'))?.value;
  out.server = { eliChanged: diff(before.eli, eliRc), ezraChanged: diff(before.ezra, ezraRc),
    eliLogTail: Object.fromEntries(Object.keys(eliLog).sort().slice(-4).map(k => [k, eliLog[k]])), ezraLog };

  // 2. New York iPad, Tue 20:31
  const nyEliT = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: TUE + 60000 });
  f = await openVerses(nyEliT); out.nyTue = { tz: await tz(f), eli: await state(f) }; await nyEliT.close();
  const nyEzraT = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: TUE + 60000 });
  f = await openVerses(nyEzraT); out.nyTue.ezra = await state(f);
  await nyEzraT.page.screenshot({ path: path.join(EVID, 'verify-other-timezone-day-3-ny-ezra-tue.png'), scale: 'css', animations: 'disabled' });
  await nyEzraT.close();

  // 3. New York iPad, Wed 08:00
  await L.clock(new Date(WED).toISOString());
  const nyEliW = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: WED });
  f = await openVerses(nyEliW); out.nyWed = { eli: await state(f) }; await nyEliW.close();
  const nyEzraW = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: WED });
  f = await openVerses(nyEzraW); out.nyWed.ezra = await state(f); await nyEzraW.close();

  const pick = s => s && ({ who: s.who, today: s.today, ref: s.ref, done: s.done, doneBig: s.doneBig, stats: s.stats, again: s.again });
  const summary = {
    londonTz: out.london.tz, londonToday: out.london.eliBefore.today,
    londonEliBefore: pick(out.london.eliBefore), londonEliAfter: pick(out.london.eliAfter),
    londonEzraBefore: pick(out.london.ezraBefore), londonEzraAfter: pick(out.london.ezraAfter),
    server: out.server, nyTue: { tz: out.nyTue.tz, eli: pick(out.nyTue.eli), ezra: pick(out.nyTue.ezra) },
    nyWed: { eli: pick(out.nyWed.eli), ezra: pick(out.nyWed.ezra) },
  };
  console.log(JSON.stringify(summary, null, 1));
  fs.writeFileSync(path.join(EVID, 'verify-other-timezone-day-3.json'), JSON.stringify({ summary, raw: out }, null, 1));
} finally { await L.close(); }
