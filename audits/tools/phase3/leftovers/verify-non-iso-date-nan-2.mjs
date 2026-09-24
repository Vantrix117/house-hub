// Skeptic #2 for finding "non-iso-date-nan": a leftovers row whose dateLogged is not YYYY-MM-DD.
// Writes three rows via chat's add_list_item (scripted upstream: 'yesterday', '9/20/2026', and an ISO control 8 days old)
// and one via a raw family PUT ('Sept 19'), then reads what the Larder (iPhone, WebKit + Chromium), Home's fridge data
// and the 8 am morning job make of them. Also: can the Larder's own add bar produce a non-ISO date? (input type=date)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { toolCall } from '../../phase2/CHAT/lib.mjs';
const EV = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EV, { recursive: true });
const out = { engines: {} };
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  const o = out.engines[engine] = {};
  try {
    o.chat = [];
    for (const [name, dl] of [['V2 stew yesterday', 'yesterday'], ['V2 stew slash', '9/20/2026'], ['V2 control ISO', '2026-09-14']]) {
      const r = await toolCall(L, 'eli', 'add_list_item', { app_id: 'leftovers', item: { name, dateLogged: dl } }, { message: 'log ' + name });
      o.chat.push({ name, dateLogged: dl, ok: r.ok, chip: r.chip, stored: r.toolResult && String(r.toolResult.content).slice(0, 200) });
    }
    const put = await L.apiAs('mom', '/api/data/leftovers/' + encodeURIComponent('item:v2raw') + '?scope=family', { method: 'PUT', body: { value: { id: 'v2raw', name: 'V2 raw PUT', size: 'Small', dateLogged: 'Sept 19', by: 'mom', byName: 'Mom' }, updated_at: Date.now() } });
    o.rawPut = put.status;
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
    await d.goto('#home'); await sleep(2500);
    const f = await d.openApp('leftovers'); await sleep(2500);
    o.cards = await f.evaluate(() => [...document.querySelectorAll('.item')].filter(c => /^V2 /.test(c.querySelector('.nm').textContent)).map(c => ({
      name: c.querySelector('.nm').textContent, daysAttr: c.dataset.days, tone: c.dataset.tone, chip: c.querySelector('.status').textContent,
      meta: c.querySelector('.meta').textContent, barP: getComputedStyle(c.querySelector('.bar')).getPropertyValue('--p').trim(),
      barAria: c.querySelector('.bar').getAttribute('aria-label'), group: (c.closest('section,.group,div[class*=group]')?.querySelector('h2,h3,.gh')?.textContent || '').trim().slice(0, 40) })));
    o.alertText = await f.evaluate(() => { const a = document.getElementById('alert'); return a ? (a.hidden ? '(hidden)' : a.textContent.trim().slice(0, 200)) : null; });
    o.dateInput = await f.evaluate(() => { const i = document.getElementById('date'); i.value = 'yesterday'; const v1 = i.value; i.value = '9/20/2026'; const v2 = i.value; return { type: i.type, afterSetYesterday: v1, afterSetSlash: v2 }; });
    if (engine === 'webkit') {
      const el = await f.$('.item:has(.nm:text-is("V2 stew yesterday"))').catch(() => null);
      if (el) { await el.scrollIntoViewIfNeeded(); await sleep(300); }
      await d.page.screenshot({ path: path.join(EV, 'verify-non-iso-date-nan-2-larder-iphone.png'), scale: 'css' });
    }
    await d.goto('#home'); await sleep(2000);
    o.homeFridgeDue = await d.page.evaluate(() => {
      const ageDays = s => { const then = new Date(s + 'T00:00:00'); const now = new Date(); now.setHours(0, 0, 0, 0); return Math.floor((now - then) / 86400000); };
      return hub.list('item:', { app: 'leftovers', scope: 'family' }).map(r => r.value).filter(i => /^V2 /.test(i.name)).map(i => ({ name: i.name, dateLogged: i.dateLogged, days: ageDays(i.dateLogged), dueOnHome: ageDays(i.dateLogged) >= 4 }));
    });
    o.homeTileBadge = await d.page.evaluate(() => { const t = document.querySelector('.tile[data-id="leftovers"]'); return t ? t.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : null; });
    const m = (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } })).body;
    o.morningDue = m.due;
  } finally { await L.close(); }
  console.log(engine, JSON.stringify(o, null, 1));
}
fs.writeFileSync(path.join(EV, 'verify-non-iso-date-nan-2.json'), JSON.stringify(out, null, 1));
console.log('saved', path.join(EV, 'verify-non-iso-date-nan-2.json'));
