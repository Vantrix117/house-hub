// The add bar's input guards (apps/leftovers.html:120-131, 189-193, 289-304) and a date that is not YYYY-MM-DD.
//   1 future date typed into the date box (max = today) then Log     2 empty name then Log (any feedback?)
//   3 a 600-character name (no maxlength)                             4 chat's add_list_item with dateLogged "yesterday"
//     and "9/20/2026" (worker/src/chat.js:31-32, 187: no format check) -> what the Larder, Home and the 8 am push show
import { local, openLarder, cards, serverItems, save, shot, sleep } from './_lib.mjs';
import { toolCall } from '../../phase2/CHAT/lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  let f = await openLarder(d);
  // 1 future date
  await f.fill('#name', 'Future stew'); await f.fill('#date', '2026-09-30');
  const validity = await f.evaluate(() => ({ value: date.value, max: date.max, valid: date.validity.valid, rangeOverflow: date.validity.rangeOverflow }));
  await f.click('.log'); await sleep(2500);
  out.future = { validity, landed: (await serverItems(L)).some(i => i.name === 'Future stew'), nameStillTyped: await f.inputValue('#name') };
  console.log('1 future date:', JSON.stringify(out.future));
  await f.fill('#name', ''); await f.fill('#date', '2026-09-22');
  // 2 empty name
  const n0 = (await cards(f)).length;
  await f.click('.log'); await sleep(500);
  out.emptyName = { cardsBefore: n0, cardsAfter: (await cards(f)).length, errShown: await f.evaluate(() => !document.getElementById('err').hidden), focusOn: await f.evaluate(() => document.activeElement && document.activeElement.id) };
  console.log('2 empty name:', JSON.stringify(out.emptyName));
  // 3 long name
  const long = 'Very long casserole name '.repeat(24).trim();
  await f.fill('#name', long); await f.click('.log'); await sleep(2500);
  const lc = (await cards(f)).find(c => c.name.startsWith('Very long'));
  out.longName = { typedLength: long.length, stored: (await serverItems(L)).find(i => i.name.startsWith('Very long'))?.name.length, card: !!lc };
  out.longName.shot = await shot(d.page, 'entry-long-name-ipad.png');
  console.log('3 long name:', JSON.stringify(out.longName));
  // 4 non-ISO dates through chat
  out.chat = [];
  for (const dl of ['yesterday', '9/20/2026']) {
    const r = await toolCall(L, 'eli', 'add_list_item', { app_id: 'leftovers', item: { name: 'Chat stew ' + dl, dateLogged: dl } }, { message: 'we made stew ' + dl });
    out.chat.push({ dateLogged: dl, ok: r.ok, chip: r.chip });
  }
  await d.page.reload(); f = await openLarder(d); await sleep(1500);
  const cc = (await cards(f)).filter(c => c.name.startsWith('Chat stew'));
  out.chatCards = cc.map(c => ({ name: c.name, days: c.days, chip: c.chip, group: c.group, meta: c.meta }));
  out.chatShot = await shot(d.page, 'entry-chat-bad-date-ipad.png', { fullPage: false });
  console.log('4 chat cards:', JSON.stringify(out.chatCards));
  out.barWidths = await f.evaluate(() => [...document.querySelectorAll('.item')].filter(c => c.querySelector('.nm').textContent.startsWith('Chat stew')).map(c => getComputedStyle(c.querySelector('.bar')).getPropertyValue('--p') + ' / ' + c.querySelector('.bar').getAttribute('aria-label')));
  console.log('  bars:', JSON.stringify(out.barWidths));
  const morning = (await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } })).body;
  out.pushDue = morning.due;
  console.log('  push due:', JSON.stringify(morning.due));
  await d.goto('#home'); await sleep(2500);
  out.home = await d.page.evaluate(() => { const c = [...document.querySelectorAll('.gcard')].find(c => /In the fridge/.test(c.textContent)); return c && c.querySelector('.gbig').textContent; });
  console.log('  Home card:', out.home);
  console.log('saved', save('entry.json', out));
} finally { await L.close(); }
