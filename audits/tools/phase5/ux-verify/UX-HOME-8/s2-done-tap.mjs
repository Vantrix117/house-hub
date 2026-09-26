// s2 skeptic, UX-HOME-8: one tap on a reminder's ✓ — who sees the ✓, what confirms/undoes it, what survives, where it shows.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-HOME-8/s2');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
const res = { whoSeesCheck: {} };
try {
  for (const [profile, device] of [['eli', 'ipad-portrait'], ['guest-grandmajo', 'iphone-pwa'], ['ezra', 'ipad-portrait']]) {
    const d = await L.device({ device, profile });
    await d.goto('#home');
    await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#remlist .rem-row'), null, { timeout: 15000 }).catch(() => {});
    await sleep(400);
    res.whoSeesCheck[profile] = await d.page.evaluate(() => [...document.querySelectorAll('#remlist [data-done]')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    await d.close();
  }
  // Mae (household adult) on the Kitchen iPad taps ✓ on the first reminder
  const d = await L.device({ device: 'ipad-portrait', profile: 'christian' });
  await d.goto('#home');
  await d.page.waitForFunction(() => hub.sync.lastPull > 0 && document.querySelector('#remlist [data-done]'), null, { timeout: 15000 });
  await sleep(400);
  const before = await d.page.evaluate(() => [...document.querySelectorAll('#remlist .rem-text')].map(e => e.textContent));
  let dialogs = 0; d.page.on('dialog', async dl => { dialogs++; await dl.dismiss(); });
  const id = await d.page.evaluate(() => document.querySelector('#remlist [data-done]').dataset.done);
  await d.page.tap(`#remlist [data-done="${id}"]`);
  await sleep(200);
  const right = await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return { list: [...document.querySelectorAll('#remlist .rem-text')].map(e => e.textContent), toastVisible: !!(t && !t.hidden && getComputedStyle(t).opacity !== '0' && t.textContent), toastText: t ? t.textContent : null, undo: [...document.querySelectorAll('button, [role=button], a')].filter(b => /undo|restore|bring back/i.test(b.textContent + (b.getAttribute('aria-label') || ''))).length }; });
  await d.shot(path.join(OUT, 'after-tap-ipad.png'));
  await d.page.evaluate(() => hub.flush()); await sleep(800);
  const server = await L.apiAs('eli', '/api/data/reminders?scope=family');
  const row = (server.body.items || []).find(i => i.key === 'item:' + id);
  // the feed line: does Home show it after a refresh?
  await d.page.evaluate(() => document.querySelector('#feed-refresh') && document.querySelector('#feed-refresh').click()); await sleep(1500);
  const feedOnHome = await d.page.evaluate(() => (document.querySelector('#feed') || {}).innerText?.replace(/\s+/g, ' ').slice(0, 200));
  await d.shot(path.join(OUT, 'after-tap-feed-ipad.png'));
  // another device (Eli's phone) after its next pull
  const e = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await e.goto('#home'); await e.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 15000 }); await sleep(600);
  const otherDevice = await e.page.evaluate(() => [...document.querySelectorAll('#remlist .rem-text')].map(x => x.textContent));
  Object.assign(res, { tapper: 'christian (Mae)', before, tapped: before[0], confirmDialogs: dialogs, afterTap: right, serverRow: row, feedOnHome, otherDeviceList: otherDevice });
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'done-tap.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
