// Is a future date blocked? The only guard is the date box's max attribute (apps/leftovers.html:193); the submit handler
// (:289-304) never checks the date. Run in both engines: node future-date.mjs [webkit|chromium]
import { local, openLarder, serverItems, save, sleep } from './_lib.mjs';
const engine = process.argv[2] || 'webkit';
const L = await local({ variant: 'typical', clock: 'demo', engine });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  const f = await openLarder(d);
  const typeInfo = await f.evaluate(() => ({ type: date.type, supportsDate: (() => { const i = document.createElement('input'); i.type = 'date'; i.value = 'x'; return i.type === 'date' && i.value === ''; })() }));
  await f.fill('#name', 'Future stew'); await f.fill('#date', '2026-09-30');
  const validity = await f.evaluate(() => ({ value: date.value, max: date.max, valid: date.validity.valid, rangeOverflow: date.validity.rangeOverflow }));
  await f.click('.log'); await sleep(2500);
  const res = { engine, typeInfo, validity, landed: (await serverItems(L)).some(i => i.name === 'Future stew') };
  console.log(JSON.stringify(res));
  save('future-date-' + engine + '.json', res);
} finally { await L.close(); }
