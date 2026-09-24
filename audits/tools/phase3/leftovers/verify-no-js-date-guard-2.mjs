// Skeptic #2 for "no-js-date-guard": is a future "Date logged" blocked only by the max attribute (apps/leftovers.html:193),
// is the WebKit result a rig artefact (Playwright WebKit on Windows has no date input), and what does a future-dated row look like?
// Run: node "audits/tools/phase3/leftovers/verify-no-js-date-guard-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EVID, { recursive: true });
const out = {};
async function items(L) {
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  return (r.body.items || r.body.rows || r.body.data || []).filter(x => x.value).map(x => ({ name: x.value.name, dateLogged: x.value.dateLogged }));
}
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  try {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
    await d.goto('#home');
    const f = await d.openApp('leftovers');
    await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
    const probe = await f.evaluate(() => { const i = document.createElement('input'); i.type = 'date'; return { engineDateSupport: i.type === 'date', formNoValidate: document.getElementById('add').noValidate, dateType: document.getElementById('date').type, max: document.getElementById('date').max }; });
    await f.fill('#name', 'Skeptic future stew');
    await f.fill('#date', '2026-09-30');
    const v = await f.evaluate(() => { const e = document.getElementById('date'); return { value: e.value, valid: e.validity.valid, rangeOverflow: e.validity.rangeOverflow, formValid: document.getElementById('add').checkValidity() }; });
    await f.click('#add .log'); await sleep(2500);
    const landed = (await items(L)).find(i => i.name === 'Skeptic future stew') || null;
    const r = { probe, validity: v, landed };
    // A future-dated row arriving by another path (chat add_list_item passes dateLogged through unchecked, worker/src/chat.js:187).
    if (engine === 'chromium') {
      const id = 'skep' + Date.now();
      const put = await L.apiAs('mom', '/api/data/leftovers/' + encodeURIComponent('item:' + id) + '?scope=family', { method: 'PUT', body: { value: { id, name: 'Tomorrow soup', size: 'Medium', dateLogged: '2026-09-25', by: 'mom', byName: 'Mom' }, updated_at: Date.now() } });
      r.putStatus = put.status;
      await d.page.reload(); await d.goto('#home');
      const f2 = await d.openApp('leftovers');
      await f2.waitForFunction(() => [...document.querySelectorAll('.item .nm')].some(n => n.textContent === 'Tomorrow soup'), null, { timeout: 20000 });
      r.futureCard = await f2.evaluate(() => { const c = [...document.querySelectorAll('.item')].find(c => c.querySelector('.nm').textContent === 'Tomorrow soup'); return { days: c.dataset.days, tone: c.dataset.tone, meta: c.querySelector('.meta').textContent, chip: c.querySelector('.status').textContent, group: c.closest('.group') && c.closest('.group').querySelector('h2,h3,.gh') && c.closest('.group').querySelector('h2,h3,.gh').textContent }; });
      const c = await f2.$('.item[data-days="-3"]');
      if (c) { await c.scrollIntoViewIfNeeded(); await d.page.screenshot({ path: path.join(EVID, 'verify-no-js-date-guard-2-future-row-chromium.png'), scale: 'css', animations: 'disabled' }); }
    }
    out[engine] = r;
    console.log(engine, JSON.stringify(r));
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EVID, 'verify-no-js-date-guard-2.json'), JSON.stringify(out, null, 1));
