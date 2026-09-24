// Skeptic #2 for "other-timezone-ages": a phone in another zone logs its own local date; the New York iPad reads it.
// Independent of timezone.mjs. The phone's context gets a different timezoneId by wrapping browser.newContext
// for exactly one call; everything else is the harness's defaults. Both devices share one fixed instant.
//   node "audits/tools/phase3/leftovers/verify-other-timezone-ages-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const EVID = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EVID, { recursive: true });
const out = { cases: {} };

const CASES = [
  { key: 'london', zone: 'Europe/London', at: '2026-09-22T21:30:00-04:00', name: 'Skeptic London stew' },
  { key: 'la', zone: 'America/Los_Angeles', at: '2026-09-23T01:30:00-04:00', name: 'Skeptic LA soup' },
  { key: 'control-ny', zone: 'America/New_York', at: '2026-09-22T21:30:00-04:00', name: 'Skeptic NY control' },
];

async function openLarder(d) {
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
  return f;
}
const cardsOf = f => f.evaluate(() => [...document.querySelectorAll('.item')].map(c => ({
  name: c.querySelector('.nm').textContent, days: +c.dataset.days, chip: c.querySelector('.status').textContent, meta: c.querySelector('.meta').textContent })));

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const c of CASES) {
    await L.reset('typical');
    const t = Date.parse(c.at);
    await L.clock(new Date(t).toISOString());
    const ph = await L.newDevice({ name: 'Eli travel phone ' + c.key, profiles: ['eli'] });
    // phone context in the other zone
    const orig = L.browser.newContext.bind(L.browser);
    L.browser.newContext = async o => { L.browser.newContext = orig; return orig({ ...o, timezoneId: c.zone }); };
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: t, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: t });
    const fp = await openLarder(phone);
    const phoneClock = await fp.evaluate(() => ({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, local: String(new Date()), dateBox: document.getElementById('date').value, max: document.getElementById('date').max }));
    await fp.fill('#name', c.name);
    await fp.evaluate(() => document.getElementById('add').requestSubmit());
    // wait for the write to reach the server
    let row = null;
    for (let i = 0; i < 40 && !row; i++) {
      await sleep(250);
      const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
      const rows = r.body.items || r.body.rows || r.body.data || [];
      const hit = rows.find(x => x.value && x.value.name === c.name);
      if (hit) row = { key: hit.key, dateLogged: hit.value.dateLogged };
    }
    const fi = await openLarder(ipad);
    const ipadClock = await fi.evaluate(() => ({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, local: String(new Date()), today: window.__larder.today() }));
    const ipadCards = await cardsOf(fi), phoneCards = await cardsOf(await openLarder(phone));
    const mine = n => (ipadCards.find(x => x.name === n) || null);
    const diffs = ipadCards.map(a => { const b = phoneCards.find(x => x.name === a.name); return b && b.days !== a.days ? { name: a.name, ipad: a.days, phone: b.days, ipadChip: a.chip, phoneChip: b.chip } : null; }).filter(Boolean);
    out.cases[c.key] = { zone: c.zone, instant: c.at, phoneClock, serverRow: row, ipadClock, ipadSeesNew: mine(c.name), phoneSeesNew: phoneCards.find(x => x.name === c.name) || null, otherItemsDiffer: diffs, itemCount: ipadCards.length };
    if (c.key !== 'control-ny') {
      const card = fi.locator('.item', { hasText: c.name });
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await fi.page().screenshot({ path: path.join(EVID, `verify-other-timezone-ages-2-${c.key}-ipad.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    }
    console.log(c.key, JSON.stringify({ phoneTz: phoneClock.tz, phoneDateBox: phoneClock.dateBox, server: row, ipadToday: ipadClock.today, ipadSees: mine(c.name), otherDiffs: diffs.length + '/' + ipadCards.length, sample: diffs.slice(0, 2) }));
    await phone.close(); await ipad.close();
  }
  fs.writeFileSync(path.join(EVID, 'verify-other-timezone-ages-2.json'), JSON.stringify(out, null, 1));
  console.log('wrote audits/evidence/p3/leftovers/verify-other-timezone-ages-2.json');
} finally { await L.close(); }
