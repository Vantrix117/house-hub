// What is "old"? The same typical fridge (demo clock, Tue 22 Sep 2026 08:40) through the four surfaces:
//   the Larder's groups and red banner (apps/leftovers.html:137, 168-170, 207-215), Home's "In the fridge" card and the Apps
//   tile badge (index.html:679-681, 699, 1173-1181), and the 8 am push (worker/src/reminders.js:66-79, forced as admin).
import { local, openLarder, cards, save, shot, sleep } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  const f = await openLarder(d);
  const app = (await cards(f)).map(c => `${c.name} ${c.days}d → ${c.chip}`);
  const banner = await f.evaluate(() => document.getElementById('alert').textContent);
  await d.goto('#home'); await sleep(2500);
  const home = await d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(c => /In the fridge/.test(c.textContent)); return { big: c.querySelector('.gbig').textContent, rows: [...c.querySelectorAll('.fresh > div')].map(r => r.textContent + (r.classList.contains('stale') ? ' [stale]' : '')) }; });
  const homeShot = await shot(d.page, 'thresholds-home-ipad.png');
  await d.goto('#apps'); await sleep(1200);
  const badge = await d.page.evaluate(() => { const t = document.querySelector('.tile[data-id="leftovers"]'); return t && t.textContent.replace(/\s+/g, ' ').trim(); });
  const m = (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } })).body;
  const items = m.due || [];
  const body = items.length === 1 ? `${items[0]} — use it up.` : `${items.length} to use up: ` + items.slice(0, 4).join(', ');   // wording per reminders.js:71-73
  const out = { larder: { cards: app, banner }, home, appsTile: badge, push: { due: m.due, bodyPerCode: body }, homeShot };
  console.log(JSON.stringify(out, null, 1));
  console.log('saved', save('thresholds.json', out));
} finally { await L.close(); }
