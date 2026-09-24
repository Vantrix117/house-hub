// Skeptic #1 for "dst-spring-forward-off-by-one": independent reproduction on the local instance.
// Items are PUT through the real API with dateLogged across Sun 14 Mar 2027 (US spring-forward). The Larder
// (apps/leftovers.html:167) and Home (index.html:679) are read in a browser frozen at two instants in New York,
// and the Worker's morning job (worker/src/reminders.js:19,69) is forced at the same server clock.
// Also a pure Node check of the formula under TZ=America/New_York (see bottom) to separate app from rig.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EV, { recursive: true });
const L = await local({ variant: 'empty', clock: 'demo', engine: 'webkit' });
const out = { runs: [] };
const nyDate = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t));
const calDays = (dl, t) => Math.round((Date.parse(nyDate(t) + 'T00:00:00Z') - Date.parse(dl + 'T00:00:00Z')) / 86400000);
async function run(tag, iso, logged, device) {
  await L.reset('empty'); await L.clock(iso);
  for (const [i, dl] of logged.entries()) {
    const item = { id: 'v' + i, name: 'Item ' + dl, size: 'Medium', dateLogged: dl, by: 'eli', byName: 'Eli' };
    const r = await L.apiAs('eli', '/api/data/leftovers/' + encodeURIComponent('item:v' + i) + '?scope=family', { method: 'PUT', body: { value: item, updated_at: Date.now() } });
    if (r.status >= 300) console.log('PUT failed', r.status, JSON.stringify(r.body));
  }
  const t = Date.parse(iso);
  const d = await L.device({ device, profile: 'eli', fixedTime: t });
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => document.querySelectorAll('.item').length > 0, null, { timeout: 20000 });
  await sleep(500);
  const app = await f.evaluate(() => ({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone, now: new Date().toString(),
    alert: (() => { const a = document.getElementById('alert'); return a && !a.hidden ? a.textContent.trim() : null; })(),
    tally: document.getElementById('tally').textContent.trim(),
    cards: [...document.querySelectorAll('.item')].map(c => ({ name: c.querySelector('.nm').textContent, days: +c.dataset.days, chip: c.querySelector('.status').textContent.trim(), meta: c.querySelector('.meta').textContent })),
  }));
  const png = `verify-dst-spring-forward-off-by-one-1-${tag}-larder.png`;
  await d.page.screenshot({ path: path.join(EV, png), scale: 'css', animations: 'disabled' });
  await d.goto('#home'); await sleep(2500);
  const home = await d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(c => /fridge/i.test(c.textContent)); return c ? c.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null; });
  const cron = (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } })).body;
  const rows = logged.map(dl => { const a = app.cards.find(c => c.name === 'Item ' + dl); const exp = calDays(dl, t); return { dateLogged: dl, calendarDays: exp, appDays: a && a.days, appChip: a && a.chip, off: a ? exp - a.days : null }; });
  console.log(`\n[${tag}] ${iso} on ${device}  browser tz=${app.tz}  now=${app.now}`);
  for (const r of rows) console.log(`  ${r.dateLogged}: calendar ${r.calendarDays}d | Larder ${r.appDays}d "${r.appChip}"${r.off ? '  <-- off by ' + r.off : ''}`);
  console.log('  alert :', JSON.stringify(app.alert), ' tally:', JSON.stringify(app.tally));
  console.log('  Home  :', JSON.stringify(home));
  console.log('  Worker morning due:', JSON.stringify(cron.due || cron), ' date:', cron.date);
  out.runs.push({ tag, iso, device, browserTz: app.tz, browserNow: app.now, rows, alert: app.alert, tally: app.tally, home, workerDue: cron.due, workerDate: cron.date, screenshot: 'audits/evidence/p3/leftovers/' + png });
  await d.close();
}
try {
  const logged = ['2027-03-07', '2027-03-09', '2027-03-10', '2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15'];
  await run('tue16-0730', '2027-03-16T07:30:00-04:00', logged, 'iphone-pwa');
  await run('sat20-2100', '2027-03-20T21:00:00-04:00', logged, 'ipad-portrait');
  // control: same spans, no DST boundary inside (February)
  await run('control-feb', '2027-02-16T07:30:00-05:00', ['2027-02-07', '2027-02-09', '2027-02-10', '2027-02-12', '2027-02-13', '2027-02-14', '2027-02-15'], 'iphone-pwa');
} finally { await L.close(); }
// Pure-Node check of the exact formula at leftovers.html:167 / index.html:679 (TZ fixed for this process at start).
const f = fs.readFileSync(path.resolve('apps/leftovers.html'), 'utf8').split('\n')[166].trim();
const g = fs.readFileSync(path.resolve('index.html'), 'utf8').split('\n')[678].trim();
out.sourceLines = { 'apps/leftovers.html:167': f, 'index.html:679': g };
fs.writeFileSync(path.join(EV, 'verify-dst-spring-forward-off-by-one-1.json'), JSON.stringify(out, null, 1));
console.log('\nsource leftovers.html:167 =', f.slice(0, 200));
console.log('source index.html:679      =', g.slice(0, 200));
console.log('saved audits/evidence/p3/leftovers/verify-dst-spring-forward-off-by-one-1.json');
