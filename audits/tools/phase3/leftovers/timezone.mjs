// A device in another time zone against the New York household (apps/leftovers.html:166-167, 192-193, 295).
// The harness pins every context to America/New_York (lib/devices.mjs contextOptions), so this script wraps
// browser.newContext to override timezoneId for the travelling phone only.
//   London arm: instant = Tue 22 Sep 2026 21:30 New York = Wed 23 Sep 02:30 London. Eli's phone (London) logs "London soup"
//               through the UI; the Kitchen iPad (New York) and the 8 am push read it.
//   LA arm:     instant = Tue 22 Sep 2026 22:30 Los Angeles = Wed 23 Sep 01:30 New York. Eli's phone (LA) logs "LA soup";
//               the iPad (NY) reads it at once; both devices show the seeded items' ages.
import { local, openLarder, cards, serverItems, save, shot, sleep } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const orig = L.browser.newContext.bind(L.browser);
let tz = null;
L.browser.newContext = o => orig({ ...o, ...(tz ? { timezoneId: tz } : {}) });
const out = {};
async function arm(name, zone, iso, food) {
  await L.reset('typical');
  await L.clock(iso);
  const t = Date.parse(iso);
  const ph = await L.newDevice({ name: 'Eli phone (' + zone + ')', profiles: ['eli'] });
  tz = zone;
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: t, as: ph });
  tz = null;
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: t });
  const fp = await openLarder(phone);
  const phoneClock = await fp.evaluate(() => ({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, local: new Date().toString(), dateBox: document.getElementById('date').value, max: document.getElementById('date').max }));
  await fp.fill('#name', food); await fp.click('.log'); await sleep(3000);
  const row = (await serverItems(L)).find(i => i.name === food);
  const fi = await openLarder(ipad);
  await sleep(500);
  const ipadCards = await cards(fi);
  const phoneCards = await cards(fp);
  const s = await shot(ipad.page, `tz-${name}-ipad.png`);
  const ipadRow = ipadCards.find(c => c.name === food);
  out[name] = { zone, instant: iso, phoneClock, serverRow: row, ipadSees: ipadRow, phoneSees: phoneCards.find(c => c.name === food),
    ageDisagreements: ipadCards.filter(c => c.name !== food).map(c => ({ name: c.name, ipad: +c.days, phone: +((phoneCards.find(p => p.id === c.id) || {}).days) })).filter(x => x.ipad !== x.phone), shot: s };
  console.log(`\n[${name}] ${zone} at ${iso}`);
  console.log('  phone clock:', JSON.stringify(phoneClock));
  console.log('  server row :', JSON.stringify(row));
  console.log('  NY iPad    :', JSON.stringify(ipadRow && { days: ipadRow.days, chip: ipadRow.chip, meta: ipadRow.meta, group: ipadRow.group }));
  console.log('  phone      :', JSON.stringify(out[name].phoneSees && { days: out[name].phoneSees.days, meta: out[name].phoneSees.meta }));
  console.log('  other items where iPad and phone disagree:', JSON.stringify(out[name].ageDisagreements));
  await phone.close(); await ipad.close();
}
try {
  await arm('london', 'Europe/London', '2026-09-22T21:30:00-04:00', 'London soup');
  await arm('los-angeles', 'America/Los_Angeles', '2026-09-22T22:30:00-07:00', 'LA soup');
  console.log('\nsaved', save('timezone.json', out));
} finally { await L.close(); }
