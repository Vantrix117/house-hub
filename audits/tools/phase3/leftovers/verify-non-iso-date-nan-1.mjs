// Skeptic #1 for finding "non-iso-date-nan": a dateLogged that is not YYYY-MM-DD (as chat's add_list_item accepts it,
// worker/src/chat.js:32, 187) -> what the Larder card (apps/leftovers.html:167, 250-268), Home's fridge card
// (index.html:680-681) and the 8 am push (worker/src/reminders.js:19, 69) do with it. A control row with a proper
// ISO date 6 days old goes through the same chat path.
// Run: node "audits/tools/phase3/leftovers/verify-non-iso-date-nan-1.mjs"   (local instance only)
import { local, sleep } from '../../lib/local.mjs';
import { toolCall } from '../../phase2/CHAT/lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const EVID = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-non-iso-date-nan-1';
const out = { engine: 'webkit', variant: 'typical', clock: 'demo' };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const inputs = ['yesterday', '9/20/2026', '2026-09-20T18:00', '2026-09-16'];   // last = ISO control, 6 days before the demo day
  out.chat = [];
  for (const dl of inputs) {
    const r = await toolCall(L, 'eli', 'add_list_item', { app_id: 'leftovers', item: { name: 'Vstew ' + dl, dateLogged: dl } }, { message: 'we made stew ' + dl });
    out.chat.push({ dateLogged: dl, status: r.status, ok: r.ok, chip: r.chip, stored: r.toolResult && String(r.toolResult.content).slice(0, 200) });
  }
  console.log('chat tool results:', JSON.stringify(out.chat));
  const srv = (await L.apiAs('eli', '/api/data/leftovers?scope=family')).body.items.filter(x => x.value && /^Vstew/.test(x.value.name));
  out.server = srv.map(x => ({ key: x.key, dateLogged: x.value.dateLogged }));
  console.log('server rows:', JSON.stringify(out.server));

  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await d.goto('#home'); await sleep(2500);
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
  await sleep(1500);
  out.cards = await f.evaluate(() => [...document.querySelectorAll('.item')].filter(c => /^Vstew/.test(c.querySelector('.nm').textContent)).map(c => ({
    name: c.querySelector('.nm').textContent, days: c.dataset.days, tone: c.dataset.tone, group: c.closest('.group') && c.closest('.group').dataset.tone,
    chip: c.querySelector('.status').textContent, meta: c.querySelector('.meta').textContent,
    barP: c.querySelector('.bar').style.getPropertyValue('--p'), barAria: c.querySelector('.bar').getAttribute('aria-label'),
    fillWidth: getComputedStyle(c.querySelector('.bar i')).width,
  })));
  for (const c of out.cards) console.log('card:', JSON.stringify(c));
  out.alert = await f.evaluate(() => { const a = document.getElementById('alert'); return a && !a.hidden ? a.textContent.trim().slice(0, 300) : null; });
  out.tally = await f.evaluate(() => document.getElementById('tally').textContent.trim());
  console.log('alert:', out.alert, '| tally:', out.tally);
  const target = await f.$('.item[data-id] >> text=Vstew yesterday');
  if (target) await target.scrollIntoViewIfNeeded();
  await sleep(300);
  await d.page.screenshot({ path: path.join(EVID, PFX + '-larder-ipad.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  // Home fridge card: what the shell's fridgeDue() makes of the rows
  await d.goto('#home'); await sleep(2500);
  out.home = await d.page.evaluate(() => {
    const due = (typeof fridgeDue === 'function') ? null : null;
    const c = [...document.querySelectorAll('.gcard')].find(c => /In the fridge/.test(c.textContent));
    return c ? c.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) : null;
  });
  console.log('Home fridge card:', out.home);

  // 8 am push, forced as the admin
  const m = (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } })).body;
  out.pushDue = m.due; out.pushDate = m.date;
  console.log('push date', m.date, 'due:', JSON.stringify(m.due));
  out.pushListsVstew = (m.due || []).filter(s => /^Vstew/.test(s));
  console.log('Vstew rows in push:', JSON.stringify(out.pushListsVstew));
  fs.writeFileSync(path.join(EVID, PFX + '.json'), JSON.stringify(out, null, 1));
  console.log('saved audits/evidence/p3/leftovers/' + PFX + '.json');
} finally { await L.close(); }
