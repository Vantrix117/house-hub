// Skeptic #2 for "dst-spring-forward-off-by-one": independent re-run on a fresh local instance.
// Seeds items through the real API, views the Larder and Home on an iPad (browser TZ America/New_York, like the family's
// devices) at two times of day after the Sun 14 Mar 2027 spring-forward and once in an ordinary week (control),
// then evaluates daysBetween/ageDays in the page for the same dates, and runs the Worker's morning job.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EVID, { recursive: true });
const P = 'verify-dst-spring-forward-off-by-one-2';
const L = await local({ variant: 'empty', clock: 'demo', engine: 'webkit' });
const out = {};
const nyDate = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t));
const calDays = (dl, t) => Math.round((Date.parse(nyDate(t) + 'T00:00:00Z') - Date.parse(dl + 'T00:00:00Z')) / 86400000);
async function run(name, viewIso, dates, snap) {
  await L.reset('empty'); await L.clock(viewIso);
  for (const [i, dl] of dates.entries()) {
    const item = { id: 'v' + i, name: 'Item ' + dl, size: 'Medium', dateLogged: dl, by: 'eli', byName: 'Eli' };
    await L.apiAs('eli', '/api/data/leftovers/' + encodeURIComponent('item:' + item.id) + '?scope=family', { method: 'PUT', body: { value: item, updated_at: Date.now() } });
  }
  const t = Date.parse(viewIso);
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: t });
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => document.querySelectorAll('.item').length > 0, null, { timeout: 15000 });
  const larder = await f.evaluate(() => ({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone, now: new Date().toString(),
    banner: document.getElementById('alert').textContent,
    cards: [...document.querySelectorAll('.item')].map(c => ({ name: c.querySelector('.nm').textContent, days: +c.dataset.days, chip: c.querySelector('.status').textContent, meta: c.querySelector('.meta').textContent })),
  }));
  if (snap) await d.page.screenshot({ path: path.join(EVID, `${P}-${name}-larder.png`), scale: 'css', animations: 'disabled' });
  await d.goto('#home'); await sleep(2500);
  const home = await d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(c => /In the fridge/.test(c.textContent)); return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 300) : null; });
  const morning = (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } })).body;
  const rows = dates.map(dl => { const c = larder.cards.find(x => x.name === 'Item ' + dl) || {}; return { dl, calendar: calDays(dl, t), larder: c.days, chip: c.chip, meta: c.meta }; });
  out[name] = { viewIso, tz: larder.tz, browserNow: larder.now, banner: larder.banner, rows, home, pushDue: morning.due };
  console.log(`\n[${name}] ${viewIso}  browser: ${larder.now}`);
  for (const r of rows) console.log(`  ${r.dl}: calendar ${r.calendar}d | larder ${r.larder}d "${r.chip}"${r.calendar !== r.larder ? '  <-- OFF BY ' + (r.calendar - r.larder) : ''}`);
  console.log('  banner:', JSON.stringify(larder.banner)); console.log('  home  :', JSON.stringify(home)); console.log('  push  :', JSON.stringify(morning.due));
  await d.close();
}
try {
  const sf = ['2027-03-09', '2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15'];
  await run('spring-0800', '2027-03-16T08:00:00-04:00', sf, true);
  await run('spring-2100', '2027-03-16T21:00:00-04:00', sf, false);
  // one week later: items from 16-20 Mar span no DST change (control); 9 Mar still does
  await run('control-0800', '2027-03-23T08:00:00-04:00', ['2027-03-09', '2027-03-16', '2027-03-19', '2027-03-20'], false);
  fs.writeFileSync(path.join(EVID, `${P}.json`), JSON.stringify(out, null, 1));
  console.log('\nsaved audits/evidence/p3/leftovers/' + P + '.json');
} finally { await L.close(); }
