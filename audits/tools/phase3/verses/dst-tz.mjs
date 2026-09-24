// Date maths across the end of daylight saving time (New York, Sun 1 Nov 2026) and the start (Sun 14 Mar 2027), and a
// device in another time zone. The app keys days by the device's local calendar (apps/verses.html:203 dayKey, 205 shiftDay
// via new Date(y, m-1, d+n), 206 daysBetween with Math.round over ms).
//   dst:  Eli's rows 1-0..5-0 set to box 1..5 due on the test day; each rated Got it on that day through the UI; the stored
//         due dates and the "Coming up" labels are compared with calendar arithmetic. Days: 2026-10-31, 2026-11-01, 2027-03-13.
//   tz:   at 20:30 New York on Tue 22 Sep, Eli rates on a phone set to Europe/London (01:30 Wed there) and Ezra does the
//         same; the Kitchen iPad (New York) then opens Verses.
import { local, sleep } from '../../lib/local.mjs';
import { openVerses, state, rate, serverRow, save, shot, waitQueueEmpty } from './_lib.mjs';
const MODE = process.argv[2] || 'dst';
const INTERVALS = [1, 2, 4, 7, 14];
const calc = (k, n) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { mode: MODE, runs: [] };
try {
  if (MODE === 'dst') {
    for (const day of ['2026-10-31', '2026-11-01', '2027-03-13', '2027-03-14']) {
      await L.clock(day + 'T10:00:00-04:00'); await L.reset('typical');
      const cur = (await serverRow(L, 'eli', 'f260', 'f260.recall')).value;
      // every other memorised verse pushed well into the future so the queue holds only the five test rows
      const rc = {};
      for (const id of Object.keys(cur)) rc[id] = { ...cur[id], due: '2027-12-31', last: calc(day, -1) };
      for (let b = 1; b <= 5; b++) rc[b + '-0'] = { s: 'got', t: 1, box: b, due: day, last: calc(day, -INTERVALS[b - 1]), streak: 1 };
      const now = (await L.apiAs('eli', '/api/data/f260?scope=person')).body.now;
      await L.apiAs('eli', '/api/data/f260/batch?scope=person', { method: 'POST', body: { items: [{ key: 'f260.recall', value: rc, updated_at: now + 1 }] } });
      const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.parse(day + 'T12:00:00' + (day.startsWith('2027-03-13') ? '-05:00' : day === '2027-03-14' ? '-04:00' : day === '2026-11-01' ? '-05:00' : '-04:00')) });
      const f = await openVerses(d);
      const s0 = await state(f);
      for (let b = 1; b <= 5; b++) await rate(f, 'got');
      await waitQueueEmpty(d);
      const after = (await serverRow(L, 'eli', 'f260', 'f260.recall')).value;
      const s1 = await state(f);
      const later = await f.evaluate(() => [...document.querySelectorAll('#later-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()).slice(0, 6));
      const rows = [1, 2, 3, 4, 5].map(b => { const nb = Math.min(5, b + 1); const exp = calc(day, INTERVALS[nb - 1]); return { id: b + '-0', from: b, to: after[b + '-0'].box, due: after[b + '-0'].due, expectedDue: exp, ok: after[b + '-0'].due === exp && after[b + '-0'].last === day }; });
      out.runs.push({ day, deviceToday: s0.today, queueBefore: s0.queue, rows, allOk: rows.every(r => r.ok), comingUp: later, doneSub: s1.doneSub });
      await d.close();
    }
  } else {
    // Europe/London contexts: patch newContext for the devices made inside this block only
    const orig = L.browser.newContext.bind(L.browser);
    const at = Date.parse('2026-09-22T20:30:00-04:00');
    L.browser.newContext = o => orig({ ...o, timezoneId: 'Europe/London' });
    const pe = await L.newDevice({ name: 'Eli phone (London)', profiles: ['eli', 'ezra'] });
    const lon = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: at, as: pe });
    const lonKid = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: at, as: pe });
    L.browser.newContext = orig;
    const f = await openVerses(lon);
    const s0 = await state(f);
    await rate(f, 'got');
    await waitQueueEmpty(lon);
    const kf = await openVerses(lonKid);
    await rate(kf, 'got');
    await waitQueueEmpty(lonKid);
    const rc = (await serverRow(L, 'eli', 'f260', 'f260.recall')).value['33-0'];
    const lg = (await serverRow(L, 'eli', 'verses', 'log')).value;
    const krc = (await serverRow(L, 'ezra', 'f260', 'f260.recall')).value;
    const ny = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: at + 60000 });
    const nf = await openVerses(ny);
    const nyKid = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: at + 60000 });
    const nkf = await openVerses(nyKid);
    out.runs.push({ londonToday: s0.today, stored33_0: rc, logKeysTail: Object.keys(lg).sort().slice(-3), ezraRecall: krc, nyEli: await state(nf), nyEzra: await state(nkf) });
    out.shotNyKid = await shot(nyKid.page, 'tz-ny-kid-ipad.png');
  }
  console.log(JSON.stringify(out, null, 1));
  save(`dst-tz-${MODE}.json`, out);
} finally { await L.close(); }
