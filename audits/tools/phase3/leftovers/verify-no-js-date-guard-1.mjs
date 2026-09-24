// Skeptic #1 for "no-js-date-guard": is a future date only stopped by the date box's max attribute?
// Independent re-run: for each engine, (A) type a future date in the form and tap Log, check the server;
// (B) bypass the form's native validation the way a text-only date box would (value set, then requestSubmit on a
//     form whose date box is still type=date) to show the JS handler itself has no guard;
// (C) write a future-dated row through the real API (as chat's add_list_item would) and read how the card renders.
// node "audits/tools/phase3/leftovers/verify-no-js-date-guard-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const EVID = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EVID, { recursive: true });
const out = {};

async function items(L) {
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const rows = (r.body.items || r.body.rows || r.body.data || []);
  return rows.filter(x => x.value).map(x => ({ key: x.key, name: x.value.name, dateLogged: x.value.dateLogged }));
}

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  const res = { engine };
  try {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
    const f = await d.openApp('leftovers');
    await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
    res.dateBox = await f.evaluate(() => { const el = document.getElementById('date'); return { type: el.type, value: el.value, max: el.max }; });

    // (A) the ordinary form path
    await f.fill('#name', 'Skeptic future A');
    let fillErr = null;
    try { await f.fill('#date', '2026-09-30'); } catch (e) { fillErr = String(e.message).slice(0, 160); }
    res.A = { fillErr, after: await f.evaluate(() => { const el = document.getElementById('date'); return { value: el.value, valid: el.validity.valid, rangeOverflow: el.validity.rangeOverflow }; }) };
    await f.click('.log'); await sleep(2500);
    res.A.landed = (await items(L)).find(i => i.name === 'Skeptic future A') || false;
    res.A.nameBoxAfter = await f.evaluate(() => document.getElementById('name').value);

    // (B) the handler itself: call form.onsubmit directly with a future date (what happens when nothing native blocks)
    await f.evaluate(() => {
      document.getElementById('name').value = 'Skeptic future B';
      const el = document.getElementById('date'); el.value = '2026-10-05';
      document.getElementById('add').onsubmit({ preventDefault() {} });
    });
    await sleep(2500);
    res.B = { landed: (await items(L)).find(i => i.name === 'Skeptic future B') || false };

    // (C) a future-dated row from another path (the API, as chat add_list_item writes it: dateLogged is a free string)
    const id = 'skepticC' + engine;
    const put = await L.apiAs('mom', '/api/data/leftovers/' + encodeURIComponent('item:' + id) + '?scope=family',
      { method: 'PUT', body: { value: { id, name: 'Skeptic future C', size: 'Medium', dateLogged: '2026-09-25', by: 'mom', byName: 'Mom' }, updated_at: Date.now() } });
    res.C = { put: put.status };
    await f.evaluate(() => window.hub && hub.sync && hub.sync.pull ? hub.sync.pull() : null).catch(() => {});
    await d.page.reload(); await sleep(500);
    const f2 = await d.openApp('leftovers');
    await f2.waitForFunction(() => window.__larder && document.querySelector('.item'), null, { timeout: 15000 });
    await f2.waitForFunction(() => [...document.querySelectorAll('.item .nm')].some(n => n.textContent.startsWith('Skeptic future')), null, { timeout: 15000 }).catch(() => {});
    res.C.cards = await f2.evaluate(() => [...document.querySelectorAll('.item')].filter(c => c.querySelector('.nm').textContent.startsWith('Skeptic future')).map(c => ({
      name: c.querySelector('.nm').textContent, days: c.dataset.days, tone: c.dataset.tone, meta: c.querySelector('.meta').textContent,
      chip: c.querySelector('.status').textContent, bar: c.querySelector('.bar').getAttribute('aria-label'), group: c.closest('.group') && c.closest('.group').dataset.tone })));
    const el = await f2.$('.item[data-id="' + id + '"]');
    if (el) { await el.scrollIntoViewIfNeeded(); await d.page.screenshot({ path: path.join(EVID, 'verify-no-js-date-guard-1-' + engine + '-future-card.png'), scale: 'css', animations: 'disabled' }); }
  } catch (e) { res.error = String(e.stack || e).slice(0, 600); }
  finally { await L.close(); }
  out[engine] = res;
  console.log(JSON.stringify(res));
}
fs.writeFileSync(path.join(EVID, 'verify-no-js-date-guard-1.json'), JSON.stringify(out, null, 1));
