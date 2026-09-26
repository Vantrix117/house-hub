// UX-HOME-8 skeptic s1: an adult (Mae, id christian) taps ✓ on a family reminder on the Kitchen iPad. Dialog? toast? undo?
// Can the reminder be brought back from anywhere in the UI? Who sees ✓ (adult, guest, kid, TV)?
//   node "audits/tools/phase5/ux-verify/UX-HOME-8/s1-done-tap.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-HOME-8/s1');
fs.mkdirSync(OUT, { recursive: true });
const res = { whoSeesCheck: {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const [profile, device] of [['ezra', 'ipad-portrait'], ['guest-grandmajo', 'ipad-portrait'], ['tv', 'tv']]) {
    const d = await L.device({ device, profile });
    await d.goto('#home'); await sleep(2500);
    res.whoSeesCheck[profile] = await d.page.evaluate(() => ({ rows: document.querySelectorAll('.rem-row, #tv-rem-card li').length, doneButtons: document.querySelectorAll('[data-done]').length }));
    await d.close();
  }
  const d = await L.device({ device: 'ipad-portrait', profile: 'christian' });
  await d.goto('#home');
  await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#remlist [data-done]'), null, { timeout: 15000 });
  await sleep(500);
  const geom = await d.page.evaluate(() => [...document.querySelectorAll('#remlist .rem-row')].map(r => { const b = r.querySelector('[data-done]'); const rr = r.getBoundingClientRect(), br = b.getBoundingClientRect(); return { id: b.dataset.done, text: r.querySelector(".rem-text").textContent, row: [Math.round(rr.y), Math.round(rr.height)], btn: [Math.round(br.x), Math.round(br.y), Math.round(br.width), Math.round(br.height)] }; }));
  res.geometry = geom;
  let dialogs = 0; d.page.on('dialog', async dl => { dialogs++; await dl.dismiss(); });
  const target = geom[1];
  const box = target.btn;
  await d.page.touchscreen.tap(box[0] + box[2] / 2, box[1] + box[3] / 2);
  const t = [];
  for (const ms of [100, 1000, 3000]) {
    await sleep(ms === 100 ? 100 : ms - (ms === 1000 ? 100 : 1000));
    t.push({ at: ms, ...(await d.page.evaluate(() => { const to = document.getElementById('hub-toast'); return { list: [...document.querySelectorAll('#remlist .rem-text')].map(e => e.textContent), toast: to && !to.hidden ? to.textContent : null, undoControls: [...document.querySelectorAll('button,a,[role=button]')].filter(b => /undo|restore|bring back/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') || ''))).length }; })) });
  }
  res.tap = { target: target.text, dialogs, timeline: t };
  await d.page.screenshot({ path: path.join(OUT, 'after-tap-ipad-portrait.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await d.page.evaluate(() => hub.flush()); await sleep(1000);
  const server = await L.apiAs('eli', '/api/data/reminders?scope=family');
  res.serverRow = (server.body.items || []).find(i => i.key === 'item:' + target.id); const act = await L.apiAs('eli', '/api/activity?limit=10'); const rows = act.body.items || act.body.activity || act.body || []; res.feedServer = Array.isArray(rows) ? rows.filter(a => /Cleared the reminder/.test(a.text || '')).map(a => (a.name || a.profile_id) + ': ' + a.text) : rows;
  res.feedOnHome = await d.page.evaluate(async () => { await new Promise(r => setTimeout(r, 300)); return (document.querySelector('#feed') || {}).innerText?.split('\n').filter(l => /Cleared/.test(l)).slice(0, 3); });
  // anywhere else in the shell to restore? search the whole DOM of each tab for reminder-restore affordances
  const found = {};
  for (const tab of ['#home', '#apps', '#me']) { await d.page.evaluate(h => { location.hash = h; }, tab); await sleep(700); found[tab] = await d.page.evaluate(() => /undo|restore|recently cleared|deleted reminders/i.test(document.body.innerText)); }
  res.restoreAffordanceText = found;
  await d.close();
  fs.writeFileSync(path.join(OUT, 'done-tap.json'), JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
} finally { await L.close(); }
