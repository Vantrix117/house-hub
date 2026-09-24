// Skeptic #1 for "other-timezone-ages": does a phone outside America/New_York write/read Larder dates in its own zone?
// Rig contexts are pinned to America/New_York (lib/devices.mjs:33); browser.newContext is wrapped so ONLY the travelling
// phone gets another timezoneId. The Kitchen iPad stays in New York. Everything local.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EV, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
const orig = L.browser.newContext.bind(L.browser);
let tz = null;
L.browser.newContext = o => orig({ ...o, ...(tz ? { timezoneId: tz } : {}) });
const read = f => f.evaluate(() => ({
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone, now: new Date().toString(),
  dateBox: document.getElementById('date') && document.getElementById('date').value,
  cards: [...document.querySelectorAll('.item')].map(c => ({ name: c.querySelector('.nm').textContent, days: c.dataset.days, chip: c.querySelector('.status').textContent, meta: c.querySelector('.meta').textContent })),
}));
const open = async d => { const f = await d.openApp('leftovers'); await f.waitForFunction(() => document.querySelectorAll('.item').length > 0 || document.getElementById('tally').textContent, null, { timeout: 15000 }); await sleep(400); return f; };
const out = {};
async function arm(name, zone, iso, food) {
  await L.reset('typical'); await L.clock(iso);
  const t = Date.parse(iso);
  const ph = await L.newDevice({ name: 'Eli travel phone', profiles: ['eli'] });
  tz = zone; const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: t, as: ph }); tz = null;
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: t });
  await phone.goto('#home'); const fp = await open(phone);
  const before = await read(fp);
  await fp.fill('#name', food); await fp.click('.log'); await sleep(3000);
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const rows = (r.body.items || r.body.rows || r.body.data || []).filter(x => x.value);
  const row = rows.find(x => x.value.name === food);
  await ipad.goto('#home'); const fi = await open(ipad);
  const ip = await read(fi); const pp = await read(fp);
  const png = path.join(EV, `verify-other-timezone-ages-1-${name}-ipad.png`);
  await ipad.page.screenshot({ path: png, scale: 'css', animations: 'disabled' });
  const diff = ip.cards.filter(c => c.name !== food).map(c => ({ name: c.name, ipad: +c.days, phone: +((pp.cards.find(p => p.name === c.name) || {}).days) })).filter(x => x.ipad !== x.phone);
  out[name] = { zone, instant: iso, phoneTz: before.tz, phoneNow: before.now, ipadTz: ip.tz, ipadNow: ip.now, phoneDateBox: before.dateBox,
    serverDateLogged: row && row.value.dateLogged, ipadCard: ip.cards.find(c => c.name === food), phoneCard: pp.cards.find(c => c.name === food),
    otherItemsDiffer: diff.length, otherItemsTotal: ip.cards.length - 1, sampleDiff: diff.slice(0, 3) };
  console.log(`[${name}]`, JSON.stringify(out[name], null, 1));
  await phone.close(); await ipad.close();
}
try {
  await arm('london', 'Europe/London', '2026-09-22T21:30:00-04:00', 'Verify London soup');
  await arm('la', 'America/Los_Angeles', '2026-09-22T22:30:00-07:00', 'Verify LA soup');
  fs.writeFileSync(path.join(EV, 'verify-other-timezone-ages-1.json'), JSON.stringify(out, null, 1));
  console.log('saved audits/evidence/p3/leftovers/verify-other-timezone-ages-1.json');
} finally { await L.close(); }
