// Skeptic #2, finding "thresholds-disagree". An empty fridge seeded (via the local API, as Eli) with one item at each age
// 3..8 days relative to the demo date (Tue 22 Sep 2026, New York), then read through the Larder, Home, the Apps badge and
// the 8 am morning job (forced as admin). Worker and browser both run on the rig's demo clock (lib/server.mjs demoNow).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
const EV = path.join(ROOT, 'audits/evidence/p3/leftovers');
const L = await local({ variant: 'empty', clock: 'demo' });
try {
  const today = '2026-09-22';
  const ages = [3, 4, 5, 6, 7, 8];
  const items = ages.map(a => {
    const d = new Date(Date.parse(today + 'T00:00:00Z') - a * 86400000).toISOString().slice(0, 10);
    const id = 'v2age' + a;
    return { key: 'item:' + id, value: { id, name: 'Age' + a + ' dish', size: 'Medium', dateLogged: d, by: 'eli', byName: 'Eli' } };
  });
  const w = await L.apiAs('eli', '/api/data/leftovers/batch?scope=family', { method: 'POST', body: { items } });
  console.log('seed write', w.status);
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await d.goto('#home');
  const f = await d.openApp('leftovers'); await sleep(1500);
  const larder = await f.evaluate(() => ({
    banner: document.getElementById('alert').textContent.trim(),
    groups: [...document.querySelectorAll('.group')].map(g => g.querySelector('h2').textContent.replace(/\s+/g, ' ').trim()),
    cards: [...document.querySelectorAll('.item')].map(c => `${c.querySelector('.nm').textContent} ${c.dataset.days}d -> ${c.querySelector('.status').textContent}`),
  }));
  await d.goto('#home'); await sleep(2500);
  const home = await d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(c => /In the fridge/.test(c.textContent)); return c ? { big: c.querySelector('.gbig').textContent.trim(), rows: [...c.querySelectorAll('.fresh > div')].map(r => r.textContent.replace(/\s+/g, ' ').trim() + (r.className ? ' [' + r.className + ']' : '')) } : null; });
  await d.goto('#apps'); await sleep(1500);
  const badge = await d.page.evaluate(() => { const b = document.querySelector('.tile[data-id="leftovers"] .badge'); return b ? { text: b.textContent, aria: b.getAttribute('aria-label') } : null; });
  const m = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } });
  const due = (m.body && m.body.due) || [];
  // push body built exactly as worker/src/reminders.js:71-73 does from the same list
  const pushBody = due.length === 1 ? `${due[0]} — use it up.` : `${due.length} to use up: ` + due.slice(0, 4).join(', ') + (due.length > 4 ? '…' : '');
  const out = { seeded: items.map(i => `${i.value.name} logged ${i.value.dateLogged}`), larder, home, appsBadge: badge, morningJob: { status: m.status, due, notified: m.body && m.body.notified, skipped: m.body && m.body.skipped }, pushBodyPerCode: pushBody };
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, 'verify-thresholds-disagree-2.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
