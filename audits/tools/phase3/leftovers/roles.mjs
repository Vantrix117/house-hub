// Roles and the Hearth copy block.
//   1 Kiosk (Downstairs TV profile) opening the Larder by URL: what is hidden, can it write (apps/leftovers.html:18, 96, 180, 275, 293)?
//     And does the TV board say anything about the fridge?
//   2 A guest (Grandma Jo, seeded) : can she log and finish?
//   3 "Copy list for Hearth" (:328-359): the label after a tap in WebKit, and the exact text copied (clipboard stubbed to
//     capture it), typical and empty fridge. Does the hub's chat have any Hearth tool? (grep, printed below)
import fs from 'node:fs';
import { local, sleep, openLarder, cards, serverItems, save, shot } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  // 1 kiosk
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  await tv.page.goto(L.site + '/apps/leftovers.html', { waitUntil: 'load' });
  await tv.page.waitForFunction(() => window.__larder && tally.textContent.length > 0);
  out.kiosk = await tv.page.evaluate(() => ({ kind: document.documentElement.dataset.kind, canWrite: hub.canWrite, formDisplay: getComputedStyle(document.getElementById('add')).display, hearthDisplay: getComputedStyle(document.querySelector('.hearth')).display, doneButtons: document.querySelectorAll('.done').length, cards: document.querySelectorAll('.item').length }));
  const w = await L.apiAs('tv', '/api/data/leftovers/item%3Atvtest?scope=family', { method: 'PUT', body: { value: { id: 'tvtest', name: 'TV stew', size: 'Small', dateLogged: '2026-09-22' }, updated_at: Date.now() } });
  out.kiosk.serverWrite = w.status + ' ' + JSON.stringify(w.body).slice(0, 80);
  out.kiosk.shot = await shot(tv.page, 'roles-kiosk-larder-tv.png');
  await tv.goto('#home'); await sleep(2500);
  out.kiosk.tvBoardMentionsFridge = await tv.page.evaluate(() => /fridge|leftover|larder|use it up/i.test(document.body.innerText));
  console.log('1 kiosk:', JSON.stringify(out.kiosk));
  await tv.close();
  // 2 guest
  const gid = L.S.profiles.find(p => /jo/i.test(p.name) && p.is_guest)?.id || 'guest-grandmajo';
  const g = await L.device({ device: 'ipad-portrait', profile: gid });
  const fg = await openLarder(g);
  await fg.fill('#name', 'Grandma soup'); await fg.click('.log'); await sleep(2500);
  out.guest = { id: gid, canWrite: await fg.evaluate(() => hub.canWrite), logged: (await serverItems(L)).some(i => i.name === 'Grandma soup'), doneButtons: await fg.evaluate(() => document.querySelectorAll('.done').length) };
  console.log('2 guest:', JSON.stringify(out.guest));
  await g.close();
  // 3 Hearth copy
  for (const v of ['typical', 'empty']) {
    await L.reset(v);
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
    const f = await openLarder(d);
    await f.click('#copy'); await sleep(200);
    const labelReal = await f.evaluate(() => document.getElementById('copy').textContent.trim());
    await sleep(2200);
    const labelLater = await f.evaluate(() => document.getElementById('copy').textContent.trim());
    await f.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = async t => { window.__copied = t; }; });
    await f.click('#copy'); await sleep(200);
    out['hearth-' + v] = { labelAfterTapInWebKit: labelReal, labelAfter2s: labelLater, copiedText: await f.evaluate(() => window.__copied), labelWithClipboard: await f.evaluate(() => document.getElementById('copy').textContent.trim()), icon: await f.evaluate(() => document.querySelector('#copy svg').innerHTML.slice(0, 60)) };
    if (v === 'typical') out['hearth-typical'].shot = await shot(d.page, 'roles-hearth-copied-iphone.png');
    console.log('3 hearth ' + v + ':', JSON.stringify(out['hearth-' + v]));
    await d.close();
  }
  const src = ['chat.js', 'index.js', 'reminders.js', 'data.js'].map(f => fs.readFileSync('worker/src/' + f, 'utf8')).join('\n');
  out.hearthInWorker = (src.match(/hearth/gi) || []).length;
  console.log('occurrences of "hearth" in worker/src/{chat,index,reminders,data}.js:', out.hearthInWorker);
  console.log('saved', save('roles.json', out));
} finally { await L.close(); }
