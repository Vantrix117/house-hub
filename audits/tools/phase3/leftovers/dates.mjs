// Date maths of the Larder (apps/leftovers.html:166-170), Home's fridge card (index.html:679-681) and the 8 am push
// (worker/src/reminders.js:19, 66-79), on the local instance (empty seed + rows put through the real API).
//   1 DST spring-forward (Sun 14 Mar 2027, New York): viewed Tue 16 Mar 08:00 EDT
//   2 DST fall-back (Sun 1 Nov 2026): viewed Tue 3 Nov 08:00 EST
// Expected age = calendar days between dateLogged and today in New York (what the Worker computes).
import { local, openLarder, cards, putItem, save, shot, sleep } from './_lib.mjs';
const L = await local({ variant: 'empty', clock: 'demo' });
const out = {};
async function scenario(name, viewIso, logged) {
  await L.reset('empty');
  await L.clock(viewIso);
  for (const [i, dl] of logged.entries()) await putItem(L, 'eli', { id: `dst${i}`, name: `Logged ${dl}`, size: 'Medium', dateLogged: dl, by: 'eli', byName: 'Eli' });
  const t = Date.parse(viewIso);
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: t });
  const f = await openLarder(d);
  const app = (await cards(f)).map(c => ({ name: c.name, days: +c.days, chip: c.chip }));
  const s1 = await shot(d.page, `dates-${name}-larder.png`);
  await d.goto('#home'); await sleep(2500);
  const home = await d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(c => /In the fridge/.test(c.textContent)); return c ? { big: c.querySelector('.gbig').textContent, rows: [...c.querySelectorAll('.fl')].map(r => r.textContent) } : null; });
  const morning = (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } })).body;
  const expected = logged.map(dl => ({ dl, days: Math.round((Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t)) + 'T00:00:00Z') - Date.parse(dl + 'T00:00:00Z')) / 86400000) }));
  out[name] = { viewIso, expected, app, homeCard: home, pushDue: morning.due || morning, shot: s1 };
  console.log(`\n[${name}] viewed ${viewIso}`);
  for (const e of expected) { const a = app.find(x => x.name === 'Logged ' + e.dl); console.log(`  logged ${e.dl}: calendar ${e.days}d | app ${a && a.days}d "${a && a.chip}" ${a && a.days !== e.days ? '<-- OFF BY ' + (e.days - a.days) : ''}`); }
  console.log('  Home card:', JSON.stringify(home));
  console.log('  push due :', JSON.stringify(morning.due || morning));
  await d.close();
}
try {
  await scenario('spring-forward-2027', '2027-03-16T08:00:00-04:00', ['2027-03-09', '2027-03-11', '2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15']);
  await scenario('fall-back-2026', '2026-11-03T08:00:00-05:00', ['2026-10-27', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  console.log('\nsaved', save('dates-dst.json', out));
} finally { await L.close(); }
